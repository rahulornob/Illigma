/**
 * Where a file's `.illigma` package lives in the browser: the private
 * origin storage (OPFS) or a real folder picked through the File System
 * Access API (Chromium).
 */

import { isSafePageId, type FileTree } from "@illigma/format";
import { assertFileId, listFiles, openDir, opfsRoot, readText, writeText } from "./fs.js";

export interface ReadOptions {
  /**
   * Finish a save that was cut short and remove leftover staged copies.
   * Default true. Pass false when another tab may be writing the same
   * package (a read-only tab must never touch its staged files).
   */
  repair?: boolean;
  /**
   * Take what was read as the version this tab edits, so later saves compare
   * against its save id (see WriteOptions.overwrite). Default true. Pass false
   * to look at the disk without accepting its version (Compare).
   */
  remember?: boolean;
}

export interface WriteOptions {
  /** Recorded with the package (".illigma-rev"), so the recovery journal can tell which edits reached it. Default: a random id. */
  saveId?: string;
  /**
   * Write even if the package changed on disk since this backend last read
   * or wrote it. Without it such a write throws ChangedOnDiskError and
   * changes nothing (save-states.md rule 4).
   */
  overwrite?: boolean;
}

/**
 * The package on disk holds a different save than the one this tab last read
 * or wrote: another app, browser or computer (through a synced folder)
 * changed it. Nothing was written.
 */
export class ChangedOnDiskError extends Error {
  override readonly name = "ChangedOnDiskError";
  constructor(label: string) {
    super(`"${label}" changed on disk since Illigma last read it.`);
  }
}

export function isChangedOnDisk(err: unknown): err is ChangedOnDiskError {
  return (err as { name?: unknown })?.name === "ChangedOnDiskError";
}

/** The plain refusal when a folder is neither empty nor an Illigma file (it may be someone's project). */
export const NOT_A_PACKAGE_MESSAGE = "This folder isn't an Illigma file. Choose an empty folder or a .illigma folder.";

export class NotAPackageError extends Error {
  override readonly name = "NotAPackageError";
  constructor() {
    super(NOT_A_PACKAGE_MESSAGE);
  }
}

/** Where a file's package lives. */
export interface Backend {
  /** Shown in the title bar, e.g. "Browser storage" or "Onboarding flow.illigma". */
  readonly label: string;
  readonly kind: "opfs" | "folder";
  /** Always the complete package of one save: never a mix of two (see `writeTree`). */
  read(opts?: ReadOptions): Promise<FileTree>;
  /** All files or none: a failure, or the tab closing, leaves the previous save readable. */
  write(tree: FileTree, opts?: WriteOptions): Promise<void>;
  /** The save id of the package as last read or written; null if it has none. */
  readonly saveId?: string | null;
  /** True if the package on disk now holds another save than the one last read or written here. Never repairs. */
  changedOnDisk?(): Promise<boolean>;
  /**
   * Folders only: true if a new file may be created here, i.e. the folder is
   * empty or named "*.illigma". Any other folder may be someone's project.
   */
  canCreateFile?(): Promise<boolean>;
  /**
   * Ask the person for write access again (folders only). Call it straight
   * from a click: browsers only show the prompt during a user gesture.
   */
  requestAccess?(): Promise<boolean>;
}

/** A package stored in OPFS. */
export interface OpfsBackend extends Backend {
  readonly kind: "opfs";
  readonly fileId: string;
  readonly name: string;
}

/** Suffix of staged copies. Readers skip these files. */
export const TEMP_SUFFIX = ".illigma-tmp";
/** Written once every file is staged; lists what to promote. Its presence means "this save must be finished". */
export const COMMIT_FILE = ".illigma-commit.json";
/** The id of the save the package holds (WriteOptions.saveId). */
export const REV_FILE = ".illigma-rev";

/** Files the operating system drops into any folder; they don't make a folder "not empty". */
const OS_FILES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);

function splitPath(path: string): { dirs: string[]; name: string } {
  const parts = path.split("/");
  if (!path || path.startsWith("/") || parts.some((p) => p === "" || p === "." || p === ".." || p.includes("\\"))) {
    throw new Error(`Can't save "${path}": not a valid package path.`);
  }
  const name = parts.pop() as string;
  return { dirs: parts, name };
}

/** Package paths from the caller: our own bookkeeping names are reserved. */
function checkTreePath(path: string): void {
  const { name } = splitPath(path);
  if (name.endsWith(TEMP_SUFFIX) || name.startsWith(".illigma-")) throw new Error(`Can't save "${path}": reserved file name.`);
}

function isSkipped(name: string): boolean {
  return name.startsWith(".") || name.endsWith(TEMP_SUFFIX);
}

function isMissing(err: unknown): boolean {
  const name = (err as { name?: unknown })?.name;
  return name === "NotFoundError" || name === "TypeMismatchError";
}

async function fileAt(dir: FileSystemDirectoryHandle, path: string, create: boolean): Promise<FileSystemFileHandle> {
  const { dirs, name } = splitPath(path);
  return (await openDir(dir, dirs, create)).getFileHandle(name, { create });
}

/** Text of the file at `path`, or undefined if there is none. */
async function tryRead(dir: FileSystemDirectoryHandle, path: string): Promise<string | undefined> {
  try {
    return await readText(await fileAt(dir, path, false));
  } catch (err) {
    if (isMissing(err)) return undefined;
    throw err;
  }
}

async function removeAt(dir: FileSystemDirectoryHandle, path: string): Promise<void> {
  const { dirs, name } = splitPath(path);
  try {
    await (await openDir(dir, dirs, false)).removeEntry(name);
  } catch (err) {
    if (!isMissing(err)) throw err;
  }
}

interface Commit {
  /** Final paths. Each has a staged copy at path + TEMP_SUFFIX until the commit is finished. */
  files: string[];
  /** Page files the new save no longer has. */
  remove: string[];
}

/** The pending commit, null if there is none, or "invalid" for a marker torn mid-write (no file was promoted yet). */
async function readCommit(dir: FileSystemDirectoryHandle): Promise<Commit | null | "invalid"> {
  const text = await tryRead(dir, COMMIT_FILE);
  if (text === undefined) return null;
  try {
    const c = JSON.parse(text) as Partial<Commit>;
    const paths = (v: unknown) => Array.isArray(v) && v.every((p) => typeof p === "string" && (splitPath(p), true));
    if (paths(c.files) && paths(c.remove)) return { files: c.files!, remove: c.remove! };
  } catch {
    // fall through
  }
  return "invalid";
}

interface Snapshot {
  tree: FileTree;
  saveId: string | null;
  /** True if a commit is pending or staged copies are lying around. */
  untidy: boolean;
}

/**
 * The package as it is once any pending commit is finished, without
 * changing anything on disk: a staged copy listed in the commit marker wins
 * over the file it replaces. So a save cut short anywhere reads as either the
 * complete old package (no marker yet) or the complete new one.
 */
async function snapshot(dir: FileSystemDirectoryHandle): Promise<Snapshot> {
  const tree: FileTree = new Map();
  let untidy = false;
  for (const [path, handle] of await listFiles(dir, (name) => {
    if (name.endsWith(TEMP_SUFFIX)) untidy = true;
    return isSkipped(name);
  })) {
    tree.set(path, await readText(handle));
  }
  let rev = await tryRead(dir, REV_FILE);
  const commit = await readCommit(dir);
  if (commit) untidy = true;
  if (commit && commit !== "invalid") {
    for (const path of commit.files) {
      const staged = await tryRead(dir, path + TEMP_SUFFIX);
      if (staged === undefined) continue; // already promoted
      if (path === REV_FILE) rev = staged;
      else tree.set(path, staged);
    }
    for (const path of commit.remove) tree.delete(path);
  }
  return { tree, saveId: parseRev(rev), untidy };
}

function parseRev(text: string | undefined): string | null {
  if (text === undefined) return null;
  try {
    const save = (JSON.parse(text) as { save?: unknown }).save;
    return typeof save === "string" ? save : null;
  } catch {
    return null;
  }
}

/** Remove every staged copy under `dir`. Only safe when no commit is pending. */
async function removeStagedCopies(dir: FileSystemDirectoryHandle): Promise<void> {
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === "directory") {
      if (!name.startsWith(".")) await removeStagedCopies(handle as FileSystemDirectoryHandle);
    } else if (name.endsWith(TEMP_SUFFIX)) {
      await dir.removeEntry(name).catch((err: unknown) => {
        if (!isMissing(err)) throw err;
      });
    }
  }
}

/**
 * Finish a commit that was cut short (roll forward), then remove staged
 * copies no commit refers to. Every step can be repeated, so a repair cut
 * short is finished by the next one.
 */
async function repair(dir: FileSystemDirectoryHandle): Promise<void> {
  const commit = await readCommit(dir);
  if (commit && commit !== "invalid") {
    for (const path of commit.files) {
      const staged = await tryRead(dir, path + TEMP_SUFFIX);
      if (staged !== undefined) await writeText(await fileAt(dir, path, true), staged);
    }
    for (const path of commit.remove) await removeAt(dir, path);
  }
  if (commit) await removeAt(dir, COMMIT_FILE);
  await removeStagedCopies(dir);
}

/** Text for REV_FILE. */
function revText(saveId: string): string {
  return JSON.stringify({ save: saveId }) + "\n";
}

export function newSaveId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

interface WriteCheck {
  /** Shown in errors. */
  label: string;
  /** Refuse unless the package on disk holds one of these save ids (null: none). Undefined: don't check. */
  expectSaveIds?: ReadonlySet<string | null> | undefined;
  /** Refuse a folder that is neither a package, nor blank, nor named "*.illigma". */
  guardFolder?: boolean;
}

/**
 * Write `tree` into `dir` so that the package is always one complete save,
 * even if a write fails or the tab is closed half-way (roll-forward commit):
 *
 * 0. Check and repair: refuse a folder that isn't a package, finish any
 *    earlier commit that was cut short (so its staged copies are never mixed
 *    with this save's), and refuse if the package changed on disk.
 * 1. Stage: every file is written to "<name>.illigma-tmp". If staging
 *    fails, the staged copies are removed and the package is untouched.
 * 2. Mark: COMMIT_FILE is written (atomically, on close) listing every file
 *    to promote and every stale page to remove. From here on the save
 *    counts: readers see the staged copies even before they are promoted.
 * 3. Promote: each file is rewritten from its text (atomically per file).
 *    Copying rather than FileSystemHandle.move() keeps every staged copy
 *    until the marker is gone, so a repair can always redo this step; move()
 *    onto an existing file also differs between Chromium versions.
 * 4. Remove stale pages, then the marker, then the staged copies.
 */
async function writeTree(dir: FileSystemDirectoryHandle, tree: FileTree, saveId: string, check: WriteCheck): Promise<string> {
  for (const path of tree.keys()) checkTreePath(path);
  // Before anything is written, even a repair: a folder that isn't ours is never touched.
  if (check.guardFolder && !(await mayHoldPackage(dir))) throw new NotAPackageError();
  await repair(dir);
  if (check.expectSaveIds && !check.expectSaveIds.has(parseRev(await tryRead(dir, REV_FILE)))) throw new ChangedOnDiskError(check.label);
  const previousManifest = await tryRead(dir, "manifest.json");
  const files: [string, string][] = [...tree, [REV_FILE, revText(saveId)]];
  // The manifest goes last, so a reader that ignores the marker (an older Illigma) still never sees a page missing.
  files.sort(([a], [b]) => Number(a === "manifest.json") - Number(b === "manifest.json") || (a < b ? -1 : a > b ? 1 : 0));

  const staged: string[] = [];
  const abandon = async () => {
    // The marker first: if it did land, staged copies without it would read as a torn save. If it can't be removed,
    // keep the staged copies so the next repair finishes this save instead.
    if (staged.includes(COMMIT_FILE) && !(await removeAt(dir, COMMIT_FILE).then(() => true, () => false))) return;
    for (const path of staged.splice(0)) if (path !== COMMIT_FILE) await removeAt(dir, path).catch(() => {});
  };
  let remove: string[];
  try {
    for (const [path, text] of files) {
      staged.push(path + TEMP_SUFFIX);
      await writeText(await fileAt(dir, path + TEMP_SUFFIX, true), text);
    }
    remove = stalePages(previousManifest, tree);
    staged.push(COMMIT_FILE); // a torn marker is "invalid" and ignored, but tidy it up too
    await writeText(await fileAt(dir, COMMIT_FILE, true), JSON.stringify({ files: files.map(([p]) => p), remove }));
  } catch (err) {
    await abandon();
    throw err;
  }

  // Committed. A failure from here on leaves the marker, and the next read or write finishes the job.
  for (const [path, text] of files) await writeText(await fileAt(dir, path, true), text);
  for (const path of remove) await removeAt(dir, path);
  // The save is complete even if tidying up fails: a later repair removes the leftovers.
  await removeAt(dir, COMMIT_FILE).catch(() => {});
  await removeStagedCopies(dir).catch(() => {});
  return saveId;
}

/**
 * Page files to remove: only "pages/<id>.json" files the previous manifest
 * listed and the new save no longer has. Anything else in the folder is
 * never touched, even under pages/ (it isn't ours).
 */
function stalePages(previousManifest: string | undefined, tree: FileTree): string[] {
  if (previousManifest === undefined) return [];
  let pages: unknown;
  try {
    pages = (JSON.parse(previousManifest) as { pages?: unknown }).pages;
  } catch {
    return [];
  }
  if (!Array.isArray(pages)) return [];
  const out: string[] = [];
  for (const entry of pages) {
    const id = (entry as { id?: unknown } | null)?.id;
    if (typeof id !== "string" || !isSafePageId(id)) continue;
    const path = `pages/${id}.json`;
    if (!tree.has(path) && !out.includes(path)) out.push(path);
  }
  return out;
}

/** How often a read retries while another tab keeps saving under it. */
const READ_ATTEMPTS = 8;

/** The commit marker and save id as they are now: if both are the same before and after a snapshot, no save ran during it. */
async function stamp(dir: FileSystemDirectoryHandle): Promise<string> {
  return `${await tryRead(dir, COMMIT_FILE)}\u0000${await tryRead(dir, REV_FILE)}`;
}

/**
 * `snapshot`, retried until no save ran while it was taken: a read that never
 * repairs (another tab may be saving) could otherwise list half-promoted
 * files and miss the marker that explains them.
 */
async function stableSnapshot(dir: FileSystemDirectoryHandle): Promise<Snapshot> {
  for (let i = 0; i < READ_ATTEMPTS; i++) {
    const before = await stamp(dir);
    const snap = await snapshot(dir);
    if ((await stamp(dir)) === before) return snap;
    await new Promise((r) => setTimeout(r, 20 * (i + 1)));
  }
  throw new Error("The file kept changing while Illigma read it (another tab or app is saving it). Try again in a moment.");
}

/** Read through `stableSnapshot`, then (if asked) tidy up on disk. Tidying is best effort: the snapshot is already right. */
async function readPackageDir(dir: FileSystemDirectoryHandle, opts: ReadOptions = {}): Promise<Snapshot> {
  const snap = await stableSnapshot(dir);
  if (snap.untidy && opts.repair !== false) await repair(dir).catch(() => {});
  return snap;
}

/** The save id the package holds, counting a pending commit, without reading the whole package. */
async function diskSaveId(dir: FileSystemDirectoryHandle): Promise<string | null> {
  for (let i = 0; i < READ_ATTEMPTS; i++) {
    const before = await stamp(dir);
    const commit = await readCommit(dir);
    const staged = commit && commit !== "invalid" && commit.files.includes(REV_FILE) ? await tryRead(dir, REV_FILE + TEMP_SUFFIX) : undefined;
    const rev = staged ?? (await tryRead(dir, REV_FILE));
    if ((await stamp(dir)) === before) return parseRev(rev);
  }
  throw new Error("The file kept changing while Illigma read it (another tab or app is saving it). Try again in a moment.");
}

/** True if `dir` holds nothing but Illigma's own bookkeeping and OS files. */
async function isBlankDir(dir: FileSystemDirectoryHandle): Promise<boolean> {
  for await (const name of dir.keys()) {
    if (!OS_FILES.has(name) && !name.startsWith(".illigma-") && !name.endsWith(TEMP_SUFFIX)) return false;
  }
  return true;
}

/** A new package may be written into `dir`: it already is one, it is blank, or it is named "*.illigma". */
async function mayHoldPackage(dir: FileSystemDirectoryHandle): Promise<boolean> {
  if (dir.name.endsWith(".illigma")) return true;
  const manifest = await tryRead(dir, "manifest.json");
  // Web apps have a manifest.json too: only ours counts.
  if (manifest !== undefined) return isIlligmaManifest(manifest);
  return isBlankDir(dir);
}

function isIlligmaManifest(text: string): boolean {
  try {
    return (JSON.parse(text) as { format?: unknown }).format === "illigma";
  } catch {
    return false;
  }
}

/**
 * The save this tab knows the package holds. Saves compare it with the disk
 * (rule 4); until the package was read or written here there is nothing to
 * compare, e.g. a new file.
 */
function knownSave() {
  let known = false;
  let saveId: string | null = null;
  /** Ids of our own writes that failed: one may still have landed (a repair finishes it), so it isn't someone else's. */
  const attempted = new Set<string>();
  const ours = () => new Set<string | null>([saveId, ...attempted]);
  return {
    get saveId() {
      return saveId;
    },
    set(id: string | null) {
      known = true;
      saveId = id;
      attempted.clear();
    },
    /** Run one write of ours with `id`: remembered as possibly landed if it fails. */
    async write(id: string, run: () => Promise<string>): Promise<void> {
      attempted.add(id);
      this.set(await run());
    },
    /** For WriteCheck.expectSaveIds. */
    expect(opts?: WriteOptions): ReadonlySet<string | null> | undefined {
      return known && !opts?.overwrite ? ours() : undefined;
    },
    /** True if the package on disk holds a save that isn't ours. */
    async changed(dir: FileSystemDirectoryHandle): Promise<boolean> {
      return known && !ours().has(await diskSaveId(dir));
    },
  };
}

/** Run writes one at a time, in call order. */
function serial(): <T>(task: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return (task) => {
    const run = tail.then(task, task);
    tail = run.catch(() => {});
    return run;
  };
}

function isNotFound(err: unknown): boolean {
  return (err as { name?: unknown })?.name === "NotFoundError";
}

export interface OpfsOptions {
  /** The OPFS root; default navigator.storage.getDirectory(). */
  root?: FileSystemDirectoryHandle;
  /** Top-level OPFS folder: "files" (the person's files, default) or "compare" (read-only snapshots for Compare…). */
  area?: "files" | "compare";
}

/**
 * A package in OPFS under "files/<fileId>/". Reading a file that was never
 * written gives an empty tree.
 */
export function opfsBackend(fileId: string, name: string, rootOrOptions?: FileSystemDirectoryHandle | OpfsOptions): OpfsBackend {
  assertFileId(fileId);
  const opts: OpfsOptions = rootOrOptions && "kind" in rootOrOptions ? { root: rootOrOptions } : ((rootOrOptions as OpfsOptions | undefined) ?? {});
  const queue = serial();
  const fileDir = async (create: boolean) => openDir(await opfsRoot(opts.root), [opts.area ?? "files", fileId], create);
  const save = knownSave();
  const label = "Browser storage";
  return {
    label,
    kind: "opfs",
    fileId,
    name,
    get saveId() {
      return save.saveId;
    },
    read: (ropts) =>
      queue(async () => {
        try {
          const snap = await readPackageDir(await fileDir(false), ropts);
          if (ropts?.remember !== false) save.set(snap.saveId);
          return snap.tree;
        } catch (err) {
          if (isNotFound(err)) return new Map();
          throw err;
        }
      }),
    write: (tree, wopts) =>
      queue(async () => {
        const id = wopts?.saveId ?? newSaveId();
        const check = { label, expectSaveIds: save.expect(wopts) };
        await save.write(id, async () => writeTree(await fileDir(true), tree, id, check));
      }),
    changedOnDisk: () =>
      queue(async () => {
        try {
          return await save.changed(await fileDir(false));
        } catch (err) {
          if (isNotFound(err)) return false; // gone: the next save says so
          throw err;
        }
      }),
  };
}

/** Remove Compare snapshots (OPFS "compare/") older than `maxAgeMs`. Best effort. */
export async function pruneCompareSnapshots(maxAgeMs = 24 * 60 * 60 * 1000, root?: FileSystemDirectoryHandle): Promise<void> {
  try {
    const area = await (await opfsRoot(root)).getDirectoryHandle("compare");
    for await (const [name, handle] of area.entries()) {
      if (handle.kind !== "directory") continue;
      const manifest = await (handle as FileSystemDirectoryHandle).getFileHandle("manifest.json").then(
        (h) => h.getFile(),
        () => null,
      );
      if (!manifest || Date.now() - manifest.lastModified > maxAgeMs) await area.removeEntry(name, { recursive: true }).catch(() => {});
    }
  } catch {
    // nothing to prune
  }
}

type PermissionMode = "read" | "readwrite";
type PermissionHandle = {
  queryPermission?: (d: { mode: PermissionMode }) => Promise<PermissionState>;
  requestPermission?: (d: { mode: PermissionMode }) => Promise<PermissionState>;
};

async function assertPermission(dir: FileSystemDirectoryHandle, mode: PermissionMode): Promise<void> {
  const query = (dir as unknown as PermissionHandle).queryPermission;
  if (typeof query !== "function") return;
  const state = await query.call(dir, { mode });
  if (state !== "granted") {
    const what = mode === "read" ? "open" : "save to";
    throw new DOMException(`Illigma no longer has permission to ${what} the folder "${dir.name}".`, "NotAllowedError");
  }
}

/** True if this browser can open real folders (window.showDirectoryPicker). */
export function supportsFolderAccess(): boolean {
  return typeof (globalThis as { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";
}

/** A package in a real folder. */
export interface FolderBackend extends Backend {
  readonly kind: "folder";
  /** The "<Name>.illigma" package folder. */
  readonly dir: FileSystemDirectoryHandle;
  canCreateFile(): Promise<boolean>;
}

/**
 * A package in a real folder; `dir` is the "<Name>.illigma" package folder.
 * It never writes into a folder that holds anything but an Illigma package,
 * unless the folder is named "*.illigma" (NotAPackageError).
 */
export function folderBackend(dir: FileSystemDirectoryHandle): FolderBackend {
  const queue = serial();
  const save = knownSave();
  return {
    label: dir.name,
    kind: "folder",
    dir,
    get saveId() {
      return save.saveId;
    },
    read: (opts) =>
      queue(async () => {
        await assertPermission(dir, "read");
        const snap = await readPackageDir(dir, opts);
        if (opts?.remember !== false) save.set(snap.saveId);
        return snap.tree;
      }),
    write: (tree, opts) =>
      queue(async () => {
        await assertPermission(dir, "readwrite");
        const id = opts?.saveId ?? newSaveId();
        await save.write(id, () => writeTree(dir, tree, id, { label: dir.name, expectSaveIds: save.expect(opts), guardFolder: true }));
      }),
    changedOnDisk: () =>
      queue(async () => {
        await assertPermission(dir, "read");
        return save.changed(dir);
      }),
    canCreateFile: () => mayHoldPackage(dir),
    // Not queued: the prompt must open while the click's user activation is still live.
    requestAccess: async () => {
      const request = (dir as unknown as PermissionHandle).requestPermission;
      if (typeof request !== "function") return true;
      return (await request.call(dir, { mode: "readwrite" })) === "granted";
    },
  };
}

type DirectoryPicker = (options?: { mode?: PermissionMode; id?: string }) => Promise<FileSystemDirectoryHandle>;

/** Ask the user for a package folder. Null if the browser can't, or the user cancels. */
export async function pickFolderBackend(): Promise<FolderBackend | null> {
  const picker = (globalThis as { showDirectoryPicker?: unknown }).showDirectoryPicker;
  if (typeof picker !== "function") return null;
  try {
    const dir = await (picker as DirectoryPicker).call(globalThis, { mode: "readwrite" });
    return folderBackend(dir);
  } catch (err) {
    if ((err as { name?: unknown })?.name === "AbortError") return null;
    throw err;
  }
}
