/**
 * Where a file's `.illigma` package lives in the browser: the private
 * origin storage (OPFS) or a real folder picked through the File System
 * Access API (Chromium).
 */

import type { FileTree } from "@illigma/format";
import { assertFileId, listFiles, openDir, opfsRoot, readText, writeText } from "./fs.js";

export interface ReadOptions {
  /**
   * Finish a save that was cut short and remove leftover staged copies.
   * Default true. Pass false when another tab may be writing the same
   * package (a read-only tab must never touch its staged files).
   */
  repair?: boolean;
}

export interface WriteOptions {
  /** Recorded with the package (".illigma-rev"), so the recovery journal can tell which edits reached it. Default: a random id. */
  saveId?: string;
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

/** Folders whose files belong to the package, so stale ones are removed on save. */
const OWNED_FOLDERS = ["pages"];

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

/**
 * Write `tree` into `dir` so that the package is always one complete save,
 * even if a write fails or the tab is closed half-way (roll-forward commit):
 *
 * 0. Repair: finish any earlier commit that was cut short, so its staged
 *    copies are never mixed with this save's.
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
async function writeTree(dir: FileSystemDirectoryHandle, tree: FileTree, saveId: string): Promise<string> {
  await repair(dir);
  for (const path of tree.keys()) checkTreePath(path);
  const files: [string, string][] = [...tree, [REV_FILE, revText(saveId)]];
  // The manifest goes last, so a reader that ignores the marker (an older Illigma) still never sees a page missing.
  files.sort(([a], [b]) => Number(a === "manifest.json") - Number(b === "manifest.json") || (a < b ? -1 : a > b ? 1 : 0));

  const staged: string[] = [];
  const abandon = async () => {
    for (const path of staged.splice(0)) await removeAt(dir, path).catch(() => {});
  };
  let remove: string[];
  try {
    for (const [path, text] of files) {
      staged.push(path + TEMP_SUFFIX);
      await writeText(await fileAt(dir, path + TEMP_SUFFIX, true), text);
    }
    remove = await stalePages(dir, tree);
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

async function stalePages(dir: FileSystemDirectoryHandle, tree: FileTree): Promise<string[]> {
  const out: string[] = [];
  for (const folder of OWNED_FOLDERS) {
    let handle: FileSystemDirectoryHandle;
    try {
      handle = await dir.getDirectoryHandle(folder);
    } catch (err) {
      if (isMissing(err)) continue;
      throw err;
    }
    for (const [path] of await listFiles(handle, isSkipped)) {
      if (!path.includes("/") && !tree.has(`${folder}/${path}`)) out.push(`${folder}/${path}`);
    }
  }
  return out;
}

/** Read through `snapshot`, then (if asked) tidy up on disk. Tidying is best effort: the snapshot is already right. */
async function readPackageDir(dir: FileSystemDirectoryHandle, opts: ReadOptions = {}): Promise<Snapshot> {
  const snap = await snapshot(dir);
  if (snap.untidy && opts.repair !== false) await repair(dir).catch(() => {});
  return snap;
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

/**
 * A package in OPFS under "files/<fileId>/". Reading a file that was never
 * written gives an empty tree.
 */
export function opfsBackend(fileId: string, name: string, root?: FileSystemDirectoryHandle): OpfsBackend {
  assertFileId(fileId);
  const queue = serial();
  const fileDir = async (create: boolean) => openDir(await opfsRoot(root), ["files", fileId], create);
  let saveId: string | null = null;
  return {
    label: "Browser storage",
    kind: "opfs",
    fileId,
    name,
    get saveId() {
      return saveId;
    },
    read: (opts) =>
      queue(async () => {
        try {
          const snap = await readPackageDir(await fileDir(false), opts);
          saveId = snap.saveId;
          return snap.tree;
        } catch (err) {
          if (isNotFound(err)) return new Map();
          throw err;
        }
      }),
    write: (tree, opts) =>
      queue(async () => {
        saveId = await writeTree(await fileDir(true), tree, opts?.saveId ?? newSaveId());
      }),
  };
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

/** A package in a real folder; `dir` is the "<Name>.illigma" package folder. */
export function folderBackend(dir: FileSystemDirectoryHandle): Backend {
  const queue = serial();
  let saveId: string | null = null;
  return {
    label: dir.name,
    kind: "folder",
    get saveId() {
      return saveId;
    },
    read: (opts) =>
      queue(async () => {
        await assertPermission(dir, "read");
        const snap = await readPackageDir(dir, opts);
        saveId = snap.saveId;
        return snap.tree;
      }),
    write: (tree, opts) =>
      queue(async () => {
        await assertPermission(dir, "readwrite");
        saveId = await writeTree(dir, tree, opts?.saveId ?? newSaveId());
      }),
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
export async function pickFolderBackend(): Promise<Backend | null> {
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
