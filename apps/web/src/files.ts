/**
 * Opening and creating files. Everything here is local: files live in this
 * browser's private storage (OPFS) or in a folder the person picks.
 */
import { Document, type Operation } from "@illigma/core";
import { readPackage, writePackage, writeZip, type FileTree, type NodeId } from "@illigma/format";
import {
  acquireFileLock,
  folderBackend,
  newSaveId,
  opfsBackend,
  pickFolderBackend,
  RecoveryJournal,
  supportsFolderAccess,
  type Backend,
  type FileLock,
} from "@illigma/host-web";

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
}

const solid = (r: number, g: number, b: number) => ({ type: "SOLID" as const, visible: true, color: { r, g, b, a: 1 } });

/** A new document with one page and a sample frame. Its undo history starts empty. */
export function sampleDocument(name = "Untitled"): Document {
  const draft = new Document(name);
  draft.transact("Create file", (tx) => {
    const page = tx.addPage("Page 1");
    const frame = tx.create("FRAME", page, { name: "Desktop", x: 0, y: 0, width: 1440, height: 900, fills: [solid(1, 1, 1)] });
    tx.create("RECTANGLE", frame, { name: "Hero", x: 120, y: 160, width: 560, height: 320, cornerRadius: 16, fills: [solid(0.85, 0.85, 0.85)] });
    tx.create("ELLIPSE", frame, { name: "Avatar", x: 1200, y: 40, width: 96, height: 96, fills: [solid(1, 0.357, 0.18)] });
  });
  // Re-reading the file drops the "Create file" step, so undo can't remove the only page.
  return Document.fromFile(draft.toFile());
}

function isEmpty(tree: FileTree): boolean {
  return !tree.has("manifest.json");
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
  const lock = await acquireFileLock(fileId);
  return holding(lock, async () => {
    const backend = opfsBackend(fileId, name);
    // Without the lock, leave any save in progress alone: it belongs to the other tab.
    const tree = await backend.read({ repair: lock !== null });
    if (isEmpty(tree)) throw new Error(`"${name}" is empty or was removed from this browser's storage.`);
    return startSession(Document.fromFile(readPackage(tree)), backend, lock);
  });
}

/** Ask for a folder, then open the `.illigma` package in it, or start a new file there if it's empty. */
export async function openFolder(): Promise<Session | null> {
  const backend = await pickFolderBackend();
  if (!backend) return null;
  // The file id is in the package, so read before locking, without repairing; the first save repairs.
  const tree = await backend.read({ repair: false });
  if (isEmpty(tree)) {
    const doc = sampleDocument(backend.label);
    const lock = await acquireFileLock(doc.fileId);
    return holding(lock, async () => {
      await backend.write(writePackage(doc.toFile()));
      return startSession(doc, backend, lock);
    });
  }
  const doc = Document.fromFile(readPackage(tree));
  const lock = await acquireFileLock(doc.fileId);
  return holding(lock, () => startSession(doc, backend, lock));
}

/** Let another tab edit the file. */
export function closeSession(session: Session): void {
  session.lock?.release();
}

/**
 * Replay recovered edits on a copy of `base`. An edit that no longer fits
 * (its layer or parent is gone, e.g. deleted while the banner was up) is
 * skipped with everything created inside it; the rest still apply.
 */
export function replayRecovered(base: Document, changes: readonly (readonly Operation[])[]): { doc: Document; skipped: number } {
  const doc = Document.fromFile(base.toFile());
  const dropped = new Set<NodeId>(); // creations skipped, so their children are too
  let skipped = 0;
  for (const change of changes) {
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
    if (kept.length < change.length) skipped++;
    if (!kept.length) continue;
    try {
      replayOps(doc, kept);
    } catch {
      // Still doesn't fit (e.g. a half-applied move): skip the whole edit.
      if (kept.length === change.length) skipped++;
      for (const id of created) dropped.add(id);
    }
  }
  return { doc, skipped };
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
 */
export async function keepRecovered(session: Session): Promise<Session> {
  const { journal, backend } = session;
  const mark = journal.checkpoint();
  const { doc, skipped } = replayRecovered(session.doc, session.recovered);
  const tree = writePackage(doc.toFile()); // validates
  const saveId = newSaveId();
  await journal.markSave(saveId, mark, { includesRecovered: true }).catch(() => {});
  await backend.write(tree, { saveId });
  // In the file now: the recovered edits and this session's edits up to `mark`.
  await journal.clear(mark, { recovered: true }).catch(() => {});
  const notice = skipped
    ? `${skipped} recovered ${skipped === 1 ? "edit no longer fits" : "edits no longer fit"} the file and ${skipped === 1 ? "was" : "were"} skipped.`
    : undefined;
  return { ...session, doc, recovered: [], notice };
}

/** Discard recovered edits. This session's own edits stay in the journal. */
export async function discardRecovered(session: Session): Promise<Session> {
  await session.journal.discardRecovered();
  return { ...session, recovered: [] };
}

type DirectoryPicker = (options?: { mode?: "read" | "readwrite"; id?: string }) => Promise<FileSystemDirectoryHandle>;

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
 * single-file (zip) form. Returns where it went, or null if they cancelled.
 */
export async function saveCopyElsewhere(doc: Document): Promise<string | null> {
  const tree = writePackage(doc.toFile());
  if (supportsFolderAccess()) {
    const picker = (globalThis as unknown as { showDirectoryPicker: DirectoryPicker }).showDirectoryPicker;
    let parent: FileSystemDirectoryHandle;
    try {
      parent = await picker.call(globalThis, { mode: "readwrite", id: "illigma-copy" });
    } catch (err) {
      if ((err as { name?: unknown })?.name === "AbortError") return null;
      throw err;
    }
    const dir = await freePackageDir(parent, doc.name);
    await folderBackend(dir).write(tree);
    return `${parent.name}/${dir.name}`;
  }
  const url = URL.createObjectURL(new Blob([writeZip(tree) as BlobPart], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileNameFor(doc.name)}.illigma`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return a.download;
}
