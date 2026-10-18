/**
 * Opening and creating files. Everything here is local: files live in this
 * browser's private storage (OPFS) or in a folder the person picks.
 */
import { Document, newId, type Operation } from "@illigma/core";
import { keyBetween, readPackage, writePackage, writeZip, type FileTree, type IlligmaFile, type NodeId } from "@illigma/format";
import {
  acquireFileLock,
  folderBackend,
  idbLocationStore,
  isCopyOfAnother,
  newSaveId,
  NOT_A_PACKAGE_MESSAGE,
  opfsBackend,
  pickFolderBackend,
  RecoveryJournal,
  supportsFolderAccess,
  type Backend,
  type FileLock,
  type FolderBackend,
  type LocationStore,
} from "@illigma/host-web";
import { relayout } from "@illigma/layout";
import { DOCUMENT_OPTIONS } from "./editor/layout";

/** An open file: the document, where it is saved, and any recovered edits. */
export interface Session {
  doc: Document;
  backend: Backend;
  journal: RecoveryJournal;
  /** Edits found in the recovery journal that never reached the file, one list of operations per edit. */
  recovered: Operation[][];
  /** This tab's editing lock. Null when another tab has the file open: this one is read-only. */
  lock: FileLock | null;
  /** Shown once in the editor, e.g. how many recovered edits were skipped. */
  notice?: string | undefined;
  /** Recovered edits Keep couldn't apply. They stay in the recovery journal; the notice offers to export them. */
  skipped?: Operation[][] | undefined;
  /** A read-only snapshot of the disk version opened by Compare…, not the person's file. */
  compare?: boolean | undefined;
  /** Set after an automatic reload from disk: the version it replaced, for "Updated from disk · Undo". */
  reloadedFrom?: Document | undefined;
}

const solid = (r: number, g: number, b: number) => ({ type: "SOLID" as const, visible: true, color: { r, g, b, a: 1 } });

/**
 * A document read from a file, laid out on every edit: the editor's documents
 * all come through here (or `sampleDocument`), so layout never misses one.
 *
 * The file is laid out once as it opens, deeply, on every page: a file
 * written elsewhere (an import, another app, an older Illigma) may hold
 * positions its layout settings don't produce. Without this, the first
 * unrelated edit would make those layers jump, and recovery (which replays
 * edits made on the laid-out version) would start from a different one. It
 * is not an undo step; the layout is the same every time the file opens, and
 * the file holds it after the next save.
 */
export function loadDocument(file: IlligmaFile): Document {
  const doc = Document.fromFile(file, DOCUMENT_OPTIONS);
  layOutOnOpen(doc);
  return doc;
}

/** Lay out every page of `doc` as if nothing had been laid out yet, without undo history. */
export function layOutOnOpen(doc: Document): void {
  const tops = doc.pages().flatMap((p) => doc.children(p.id).map((n) => n.id));
  const ops: Operation[] = [];
  for (const c of relayout(doc, tops, { deep: true })) {
    const prev = doc.get(c.id)?.[c.key];
    if (prev !== c.value) ops.push({ op: "set", id: c.id, key: c.key, value: c.value, prev } as Operation);
  }
  if (ops.length) doc.replay(ops);
}

/**
 * A new document with one page and a sample frame: a hero, an avatar pinned
 * to the top right (it follows the frame's right edge), and a card with
 * vertical auto layout. Its undo history starts empty.
 */
export function sampleDocument(name = "Untitled"): Document {
  const draft = new Document(name, DOCUMENT_OPTIONS);
  draft.transact("Create file", (tx) => {
    const page = tx.addPage("Page 1");
    const frame = tx.create("FRAME", page, { name: "Desktop", x: 0, y: 0, width: 1440, height: 900, fills: [solid(1, 1, 1)] });
    // Laid out by the document's normalizer at the end of this transaction: 320 × 264 at (120, 560).
    const card = tx.create("FRAME", frame, {
      name: "Card",
      x: 120,
      y: 560,
      cornerRadius: 16,
      fills: [solid(0.96, 0.96, 0.96)],
      layoutMode: "VERTICAL",
      itemSpacing: 16,
      paddingLeft: 24,
      paddingRight: 24,
      paddingTop: 24,
      paddingBottom: 24,
    });
    tx.create("RECTANGLE", card, { name: "Image", width: 272, height: 120, cornerRadius: 8, fills: [solid(0.85, 0.85, 0.85)] });
    tx.create("RECTANGLE", card, { name: "Title", width: 200, height: 24, cornerRadius: 4, fills: [solid(0.7, 0.7, 0.7)] });
    tx.create("RECTANGLE", card, { name: "Button", width: 120, height: 40, cornerRadius: 8, fills: [solid(1, 0.357, 0.18)] });
    tx.create("RECTANGLE", frame, { name: "Hero", x: 120, y: 160, width: 560, height: 320, cornerRadius: 16, fills: [solid(0.85, 0.85, 0.85)] });
    tx.create("ELLIPSE", frame, { name: "Avatar", x: 1200, y: 40, width: 96, height: 96, fills: [solid(1, 0.357, 0.18)], constraints: { horizontal: "MAX", vertical: "MIN" } });
  });
  // Re-reading the file drops the "Create file" step, so undo can't remove the only page.
  return loadDocument(draft.toFile());
}

function isEmpty(tree: FileTree): boolean {
  return !tree.has("manifest.json");
}

/** `file` as a different file: a new id, so copies never share an editing lock or a recovery journal. */
function withNewFileId(file: IlligmaFile, name = file.manifest.name): IlligmaFile {
  return { ...file, manifest: { ...file.manifest, fileId: newId(), name } };
}

/** Only the tab holding the lock reads the journal: in a read-only tab it belongs to the other tab's live session. */
async function startSession(doc: Document, backend: Backend, lock: FileLock | null): Promise<Session> {
  const journal = new RecoveryJournal(doc.fileId);
  let recovered: Operation[][] = [];
  if (lock) {
    try {
      await journal.load(backend.saveId);
      recovered = await journal.recovered();
    } catch {
      // An unreadable journal is not a reason to refuse the file. Its lines stay on disk: the journal never rewrites what it couldn't read.
      recovered = [];
    }
  }
  return { doc, backend, journal, recovered, lock };
}

/** Run `open` holding `lock`; release it if opening fails. */
async function holding<T>(lock: FileLock | null, open: () => Promise<T>): Promise<T> {
  try {
    return await open();
  } catch (err) {
    lock?.release();
    throw err;
  }
}

/** Create a new file in this browser's storage. */
export async function createFile(): Promise<Session> {
  const doc = sampleDocument();
  const lock = await acquireFileLock(doc.fileId);
  return holding(lock, async () => {
    const backend = opfsBackend(doc.fileId, doc.name);
    await backend.write(writePackage(doc.toFile()));
    return startSession(doc, backend, lock);
  });
}

/** Open a file from this browser's storage. Read-only if another tab is editing it. */
export async function openStoredFile(fileId: string, name: string): Promise<Session> {
  await closedBeforeOpening([fileId], name); // the file's last editor may still be saving
  const lock = await acquireFileLock(fileId);
  return holding(lock, async () => {
    const backend = opfsBackend(fileId, name);
    // Without the lock, leave any save in progress alone: it belongs to the other tab.
    const tree = await backend.read({ repair: lock !== null });
    if (isEmpty(tree)) throw new Error(`"${name}" is empty or was removed from this browser's storage.`);
    return startSession(loadDocument(readPackage(tree)), backend, lock);
  });
}

let locationStore: LocationStore | null = null;

/**
 * Ask for a folder, then open the `.illigma` package in it, or start a new
 * file there if it is empty or named "*.illigma". Any other folder is refused
 * untouched: it may be someone's project.
 */
export async function openFolder(locations: LocationStore = (locationStore ??= idbLocationStore())): Promise<Session | null> {
  const backend = await pickFolderBackend();
  if (!backend) return null;
  // The file id is only known after reading, and a closing editor's last save may be queued after this read:
  // wait for every file being closed first, so the read sees that save.
  await closedBeforeOpening(null, backend.label);
  // The file id is in the package, so read before locking, without repairing; the first save repairs.
  const tree = await backend.read({ repair: false });
  if (isEmpty(tree)) {
    if (!(await backend.canCreateFile())) throw new Error(NOT_A_PACKAGE_MESSAGE);
    const doc = sampleDocument(backend.label.replace(/\.illigma$/, ""));
    const lock = await acquireFileLock(doc.fileId);
    return holding(lock, async () => {
      await backend.write(writePackage(doc.toFile()));
      await isCopyOfAnother(doc.fileId, backend.dir, locations).catch(() => false); // records where it lives
      return startSession(doc, backend, lock);
    });
  }
  let doc = loadDocument(readPackage(tree));
  const copy = await isCopyOfAnother(doc.fileId, backend.dir, locations).catch(() => false);
  if (copy) doc = loadDocument(withNewFileId(doc.toFile()));
  const lock = await acquireFileLock(doc.fileId);
  return holding(lock, async () => {
    if (copy && lock) {
      // Persist the new id now; if that fails the copy just gets another new id next time.
      await backend.write(writePackage(doc.toFile())).catch(() => {});
      await isCopyOfAnother(doc.fileId, backend.dir, locations).catch(() => false);
    }
    return startSession(doc, backend, lock);
  });
}

/** Work a closing editor still has running, per file id: its last save and journal flush. */
const closingWork = new Map<string, Set<Promise<unknown>>>();
/** Files being closed, per file id: settles once their last writes are done and the lock is free. */
const closing = new Map<string, Promise<void>>();

/**
 * Note work the editor of `fileId` still runs while it closes (its last
 * save, its journal flush). Closing the file waits for it before the lock is
 * given up, and opening the file again waits for that, so the closed
 * editor's last save never runs next to the reopened file's first one.
 */
export function whileClosing(fileId: string, work: Promise<unknown>): void {
  let set = closingWork.get(fileId);
  if (!set) closingWork.set(fileId, (set = new Set()));
  const done = work.then(
    () => {},
    () => {},
  );
  set.add(done);
  void done.then(() => {
    set.delete(done);
    if (!set.size && closingWork.get(fileId) === set) closingWork.delete(fileId);
  });
}

/** Wait for every write a closing editor of `fileId` still runs, including work noted while waiting. */
async function closingDone(fileId: string): Promise<void> {
  for (let set = closingWork.get(fileId); set?.size; set = closingWork.get(fileId)) await Promise.all(set);
}

/** Wait until `fileId` is fully closed (see whileClosing). Resolves at once if it isn't closing. */
function settled(fileId: string): Promise<void> {
  return closing.get(fileId) ?? Promise.resolve();
}

/** How long opening a file waits for its last editor's save before giving up. */
export const CLOSING_WAIT_MS = 10_000;

/**
 * Wait until `fileIds` (every file being closed if `null`) are fully closed,
 * at most CLOSING_WAIT_MS. A save that never finishes must not leave opening
 * stuck with no way out: this throws a plain message instead, and opening can
 * be tried again.
 */
async function closedBeforeOpening(fileIds: readonly string[] | null, name: string): Promise<void> {
  const waits = fileIds ? fileIds.map(settled) : [...closing.values()];
  if (!waits.length) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((r) => (timer = setTimeout(() => r("timeout"), CLOSING_WAIT_MS)));
  const result = await Promise.race([Promise.all(waits), timeout]);
  clearTimeout(timer);
  if (result === "timeout") {
    throw new Error(`"${name}" is still saving from when it was last closed. Wait a moment, then open it again.`);
  }
}

/**
 * Let another tab edit the file, once the closing editor's last writes are
 * done. Resolves when the lock is free.
 */
export function closeSession(session: Session): Promise<void> {
  const fileId = session.doc.fileId;
  const done = (async () => {
    await settled(fileId).catch(() => {});
    // The editor unmounts right after this call; let its cleanup note its last save first.
    await new Promise((r) => setTimeout(r, 0));
    await closingDone(fileId);
    session.lock?.release();
    await session.lock?.released;
  })();
  closing.set(fileId, done);
  void done.then(() => {
    if (closing.get(fileId) === done) closing.delete(fileId);
  });
  return done;
}

/** Sibling index keys under `parentId` in `doc`, leaving out `except`. */
function siblingKeys(doc: Document, parentId: NodeId | null, except?: NodeId): string[] {
  const nodes = parentId === null ? doc.pages() : doc.children(parentId);
  return nodes.filter((n) => n.id !== except).map((n) => n.index);
}

/** `index` if no key in `taken` has it, else a fresh key right after it (after the sibling that took its place). */
function freeIndex(index: string, taken: readonly string[]): string {
  if (!taken.includes(index)) return index;
  const next = taken.filter((k) => k > index).sort()[0] ?? null;
  return keyBetween(index, next);
}

/**
 * Give recovered nodes new positions where a sibling made since (e.g. drawn
 * while the recovery banner was up) took theirs, so the edit still applies.
 */
function reposition(doc: Document, ops: readonly Operation[]): Operation[] {
  const used = new Map<NodeId | null, string[]>(); // keys this change already places, per parent
  const movedTo = new Map<NodeId, NodeId | null>();
  const taken = (parent: NodeId | null, except?: NodeId) => [...siblingKeys(doc, parent, except), ...(used.get(parent) ?? [])];
  const place = (parent: NodeId | null, key: string) => used.set(parent, [...(used.get(parent) ?? []), key]);
  return ops.map((o) => {
    if (o.op === "create") {
      const index = freeIndex(o.node.index, taken(o.node.parentId));
      place(o.node.parentId, index);
      return index === o.node.index ? o : { ...o, node: { ...o.node, index } };
    }
    if (o.op === "set" && o.key === "parentId") movedTo.set(o.id, o.value as NodeId | null);
    if (o.op === "set" && o.key === "index" && typeof o.value === "string") {
      const parent = movedTo.has(o.id) ? (movedTo.get(o.id) as NodeId | null) : (doc.get(o.id)?.parentId ?? null);
      const index = freeIndex(o.value, taken(parent, o.id));
      place(parent, index);
      return index === o.value ? o : { ...o, value: index };
    }
    return o;
  });
}

/**
 * Replay recovered edits on a copy of `base`. A node whose position a newer
 * sibling took goes right after that sibling. An edit that no longer fits
 * (its layer or parent is gone, e.g. deleted while the banner was up) is
 * skipped with everything created inside it; the rest still apply.
 * `skippedChanges` holds the index of every edit skipped in whole or part.
 */
export function replayRecovered(base: Document, changes: readonly (readonly Operation[])[]): { doc: Document; skipped: number; skippedChanges: number[] } {
  const doc = loadDocument(base.toFile());
  const dropped = new Set<NodeId>(); // creations skipped, so their children are too
  const skippedChanges: number[] = [];
  changes.forEach((change, i) => {
    const created = new Set<NodeId>();
    const exists = (id: NodeId) => !dropped.has(id) && (created.has(id) || doc.has(id));
    const kept: Operation[] = [];
    for (const o of change) {
      if (o.op === "create") {
        const parent = o.node.parentId;
        if ((parent !== null && !exists(parent)) || doc.has(o.node.id)) {
          dropped.add(o.node.id);
          continue;
        }
        created.add(o.node.id);
      } else if (o.op === "delete") {
        if (!exists(o.node.id)) continue;
      } else {
        if (!exists(o.id)) continue;
        if (o.key === "parentId" && typeof o.value === "string" && !exists(o.value)) continue;
      }
      kept.push(o);
    }
    let whole = kept.length === change.length;
    if (kept.length) {
      try {
        replayOps(doc, reposition(doc, kept));
      } catch {
        // Still doesn't fit (e.g. a half-applied move): skip the whole edit.
        whole = false;
        for (const id of created) dropped.add(id);
      }
    }
    if (!whole) skippedChanges.push(i);
  });
  return { doc, skipped: skippedChanges.length, skippedChanges };
}

/** The one place recovered operations are applied, without undo history. */
export function replayOps(doc: Document, ops: readonly Operation[]): void {
  doc.replay(ops);
}

/**
 * Keep recovered edits: replay them on a copy of the open document, check the
 * result is a valid file, save it, and only then hand back the new document.
 * The caller disables editing while this runs, so no edit can land on the
 * old document after the copy was taken. Throws without changing anything
 * if the result can't be saved; the edits stay in the recovery journal.
 * Edits that don't fit stay in the journal too (never dropped silently);
 * the notice says so and `skipped` holds them for export.
 */
export async function keepRecovered(session: Session): Promise<Session> {
  const { journal, backend } = session;
  const mark = journal.checkpoint();
  const { doc, skipped, skippedChanges } = replayRecovered(session.doc, session.recovered);
  const tree = writePackage(doc.toFile()); // validates
  const saveId = newSaveId();
  await journal.markSave(saveId, mark, { includesRecovered: true, keep: skippedChanges }).catch(() => {});
  await backend.write(tree, { saveId });
  // In the file now: the recovered edits and this session's edits up to `mark`. Skipped edits stay carried.
  await journal.clear(mark, { recovered: true, keep: skippedChanges }).catch(() => {});
  const notice = skipped
    ? `${skipped} recovered ${skipped === 1 ? "edit no longer fits" : "edits no longer fit"} the file and ${skipped === 1 ? "was" : "were"} skipped. ${skipped === 1 ? "It stays" : "They stay"} in the recovery journal.`
    : undefined;
  const skippedEdits = skippedChanges.map((i) => session.recovered[i]!);
  return { ...session, doc, recovered: [], notice, skipped: skippedEdits.length ? skippedEdits : undefined };
}

/** Discard recovered edits. This session's own edits stay in the journal. */
export async function discardRecovered(session: Session): Promise<Session> {
  await session.journal.discardRecovered();
  return { ...session, recovered: [] };
}

/** Download a file the person asked for (export, or the zip form of a copy). */
function download(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** "Export skipped edits…": the recovered edits Keep couldn't apply, as JSON, so nothing depends on the journal alone. */
export function skippedEditsJson(session: Session): string {
  return JSON.stringify({ file: session.doc.name, fileId: session.doc.fileId, exported: new Date().toISOString(), edits: session.skipped ?? [] }, null, 2) + "\n";
}

export function exportSkippedEdits(session: Session): string {
  const name = `${fileNameFor(session.doc.name)} skipped edits.json`;
  download(name, new Blob([skippedEditsJson(session)], { type: "application/json" }));
  return name;
}

// ---- Changes on disk (save-states.md rule 4) ----

/**
 * The file changed on disk and this tab has no unsaved edits: read the new
 * version, which later saves then compare against. Throws if it is now a
 * different file (another file id): the caller must then hold saving
 * (Autosaver.holdForDisk) and show the "changed on disk" banner.
 */
export async function reloadFromDisk(session: Session): Promise<Session> {
  const tree = await session.backend.read({ repair: false });
  const doc = loadDocument(readPackage(tree));
  if (doc.fileId !== session.doc.fileId) throw new Error("The folder now holds a different file.");
  return { ...session, doc, notice: undefined, skipped: undefined, reloadedFrom: session.doc };
}

/** "Updated from disk · Undo": save the version the reload replaced back over the disk version. */
export async function undoReload(session: Session): Promise<Session> {
  const previous = session.reloadedFrom;
  if (!previous) return session;
  await session.backend.write(writePackage(previous.toFile()));
  return { ...session, doc: previous, reloadedFrom: undefined };
}

/**
 * "Compare…": copy the version on disk into browser storage as a read-only
 * snapshot, without accepting it as this tab's version. Returns its id for
 * `#/compare/<id>`.
 */
export async function snapshotDiskVersion(session: Session): Promise<string> {
  const tree = await session.backend.read({ repair: false, remember: false });
  readPackage(tree); // must open
  const id = newId();
  await opfsBackend(id, session.doc.name, { area: "compare" }).write(tree);
  return id;
}

/** Open a Compare snapshot: view only, never saved, no journal. */
export async function openCompareSnapshot(id: string): Promise<Session> {
  const backend = opfsBackend(id, "Disk version", { area: "compare" });
  const tree = await backend.read();
  if (isEmpty(tree)) throw new Error("This comparison copy is no longer available. Use Compare… again.");
  const doc = loadDocument(readPackage(tree));
  return { doc, backend, journal: new RecoveryJournal(doc.fileId), recovered: [], lock: null, compare: true };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "<name> (conflict 2026-10-18 13.05)": colons aren't allowed in file names everywhere. */
export function conflictName(name: string, at = new Date()): string {
  const date = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}.${pad(at.getMinutes())}`;
  return `${name} (conflict ${date})`;
}

type DirectoryPicker = (options?: { mode?: "read" | "readwrite"; id?: string; startIn?: FileSystemHandle }) => Promise<FileSystemDirectoryHandle>;

/**
 * "Keep mine", step 1: write this tab's version as a conflict copy, a new
 * file with its own id, so it is safe on disk before anything else happens.
 * Browser storage: a new file there. Folder: "<name> (conflict <date>).illigma"
 * in a folder the person picks (browsers can't reach a folder's parent, so
 * the picker starts at the file). Returns where it went, or null if cancelled.
 */
export async function saveConflictCopy(session: Session): Promise<string | null> {
  const name = conflictName(session.doc.name);
  const file = withNewFileId(session.doc.toFile(), name);
  const tree = writePackage(file);
  if (session.backend.kind === "folder") {
    const parent = await pickDirectory({ mode: "readwrite", id: "illigma-conflict", startIn: (session.backend as FolderBackend).dir });
    if (!parent) return null;
    const dir = await freePackageDir(parent, name);
    await folderBackend(dir).write(tree);
    return `${parent.name}/${dir.name}`;
  }
  await opfsBackend(file.manifest.fileId, name).write(tree);
  return `${name} in browser storage`;
}

async function pickDirectory(options: Parameters<DirectoryPicker>[0]): Promise<FileSystemDirectoryHandle | null> {
  const picker = (globalThis as unknown as { showDirectoryPicker: DirectoryPicker }).showDirectoryPicker;
  try {
    return await picker.call(globalThis, options);
  } catch (err) {
    if ((err as { name?: unknown })?.name === "AbortError") return null;
    throw err;
  }
}

const fileNameFor = (name: string) => name.replace(/[\\/:*?"<>|]/g, "-").trim() || "Untitled";

/** A new "<name>.illigma" folder in `parent`, numbered if that name is taken, so a copy never overwrites anything. */
async function freePackageDir(parent: FileSystemDirectoryHandle, name: string): Promise<FileSystemDirectoryHandle> {
  for (let i = 1; ; i++) {
    const candidate = `${fileNameFor(name)}${i === 1 ? "" : ` ${i}`}.illigma`;
    try {
      await parent.getDirectoryHandle(candidate);
    } catch (err) {
      if ((err as { name?: unknown })?.name === "NotFoundError") return parent.getDirectoryHandle(candidate, { create: true });
      throw err;
    }
  }
}

/**
 * "Save a copy elsewhere…" (save-states.md rule 3): when saving fails, put a
 * copy of the open document somewhere else. In a folder the person picks
 * where the browser can (Chromium), otherwise as a download of the
 * single-file (zip) form. The copy gets its own file id. Returns where it
 * went, or null if they cancelled.
 */
export async function saveCopyElsewhere(doc: Document): Promise<string | null> {
  const tree = writePackage(withNewFileId(doc.toFile()));
  if (supportsFolderAccess()) {
    const parent = await pickDirectory({ mode: "readwrite", id: "illigma-copy" });
    if (!parent) return null;
    const dir = await freePackageDir(parent, doc.name);
    await folderBackend(dir).write(tree);
    return `${parent.name}/${dir.name}`;
  }
  const name = `${fileNameFor(doc.name)}.illigma`;
  download(name, new Blob([writeZip(tree) as BlobPart], { type: "application/zip" }));
  return name;
}
