/**
 * Where exported files go, local-first (docs/design/export.md). Nothing is
 * uploaded.
 *
 * - Browsers with the File System Access API (Chromium): into a folder the
 *   person picks. The folder is remembered per design file in IndexedDB (as
 *   host-web's locations.ts keeps file locations), and its permission is
 *   asked for again when it is used. "/" in a file name makes subfolders.
 *   Files with a name that is already taken get a number (`Welcome-1.png`)
 *   unless "Replace files with the same name" is on (principle 1: never lose
 *   work).
 * - Other browsers: a download. One file downloads as it is; several as one
 *   `.zip` (fflate), with their folders inside it.
 */

import { uniqueFilename } from "@illigma/export";
import { zipSync, type Zippable } from "fflate";

/** One file to write: a relative path ("Icons/Arrow@2x.png") and its bytes. */
export interface OutputFile {
  filename: string;
  mime: string;
  bytes: Uint8Array;
}

export interface WrittenFile {
  /** The name it was planned under. */
  filename: string;
  /** Where it went, relative to the folder: a numbered name when the planned one was taken. */
  path: string;
}

export interface WriteFailure {
  filename: string;
  /** Plain language, ready to show. */
  message: string;
}

export interface WriteResult {
  written: WrittenFile[];
  failures: WriteFailure[];
  /** Set when the write was cancelled (`WriteOptions.signal`): the planned names of the files not written, in order. */
  cancelled?: string[];
}

// ---- remembered folders ----

/** The last export folder per design file. */
export interface ExportFolderStore {
  get(fileId: string): Promise<FileSystemDirectoryHandle | undefined>;
  set(fileId: string, dir: FileSystemDirectoryHandle): Promise<void>;
}

export function memoryExportFolderStore(): ExportFolderStore {
  const map = new Map<string, FileSystemDirectoryHandle>();
  return {
    get: async (id) => map.get(id),
    set: async (id, dir) => void map.set(id, dir),
  };
}

/** Its own IndexedDB database, so the editor's "illigma" database keeps its version. */
const DB = "illigma-export";
const STORE = "folders";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** IndexedDB ("illigma-export" › "folders"); in memory where IndexedDB is missing. */
export function idbExportFolderStore(): ExportFolderStore {
  const idb = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  if (!idb) return memoryExportFolderStore();
  let db: Promise<IDBDatabase> | null = null;
  const open = () => {
    db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = idb.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch((err: unknown) => {
      db = null;
      throw err;
    });
    return db;
  };
  return {
    get: async (id) => (await request((await open()).transaction(STORE).objectStore(STORE).get(id))) as FileSystemDirectoryHandle | undefined,
    set: async (id, dir) => void (await request((await open()).transaction(STORE, "readwrite").objectStore(STORE).put(dir, id))),
  };
}

let sharedStore: ExportFolderStore | null = null;
/** The app's store (one per page). */
export const exportFolders = (): ExportFolderStore => (sharedStore ??= idbExportFolderStore());

// ---- folder access ----

type DirectoryPicker = (options?: { id?: string; mode?: "read" | "readwrite"; startIn?: FileSystemHandle | string }) => Promise<FileSystemDirectoryHandle>;
type PermissionHandle = {
  queryPermission?: (d: { mode: "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (d: { mode: "readwrite" }) => Promise<PermissionState>;
};

/** True where the browser can write into a folder the person picks (Chromium). Elsewhere exports download. */
export function supportsFolderPicker(): boolean {
  return typeof (globalThis as { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";
}

/**
 * Ask for an export folder. Must run inside a click (browsers only show the
 * picker during a user gesture). Null if the person cancelled.
 */
export async function pickExportFolder(startIn?: FileSystemHandle): Promise<FileSystemDirectoryHandle | null> {
  const picker = (globalThis as unknown as { showDirectoryPicker: DirectoryPicker }).showDirectoryPicker;
  try {
    return await picker.call(globalThis, { id: "illigma-export", mode: "readwrite", ...(startIn ? { startIn } : {}) });
  } catch (err) {
    if ((err as { name?: unknown })?.name === "AbortError") return null;
    throw err;
  }
}

/**
 * Whether Illigma may write to `dir`. With `ask`, asks again (inside a click)
 * when the permission lapsed, as browsers forget it between sessions.
 */
export async function folderPermission(dir: FileSystemDirectoryHandle, ask: boolean): Promise<PermissionState> {
  const h = dir as unknown as PermissionHandle;
  if (typeof h.queryPermission !== "function") return "granted";
  const state = await h.queryPermission.call(dir, { mode: "readwrite" }).catch((): PermissionState => "prompt");
  if (state === "granted" || !ask || typeof h.requestPermission !== "function") return state;
  return h.requestPermission.call(dir, { mode: "readwrite" }).catch((): PermissionState => "denied");
}

const errorName = (e: unknown) => (e as { name?: unknown })?.name;

/** A write error in plain language. */
export function writeErrorMessage(e: unknown, folder: string): string {
  switch (errorName(e)) {
    case "QuotaExceededError":
      return "the disk is full";
    case "NotAllowedError":
    case "SecurityError":
      return `Illigma no longer has permission to the “${folder}” folder`;
    case "NotFoundError":
      return `the “${folder}” folder was moved or deleted`;
    case "NoModificationAllowedError":
      return "the file is open in another app or can't be changed";
    case "TypeMismatchError":
      return "a folder with that name is in the way";
    default: {
      const m = e instanceof Error && e.message ? e.message : String(e);
      return m.replace(/\.$/, "");
    }
  }
}

/** The folder at `parts` under `dir`, or null if it doesn't exist. */
async function findDir(dir: FileSystemDirectoryHandle, parts: readonly string[]): Promise<FileSystemDirectoryHandle | null> {
  let cur = dir;
  for (const p of parts) {
    try {
      cur = await cur.getDirectoryHandle(p);
    } catch (e) {
      if (errorName(e) === "NotFoundError" || errorName(e) === "TypeMismatchError") return null;
      throw e;
    }
  }
  return cur;
}

/**
 * Names already in `dir` that `paths` could collide with: the entries of
 * each folder those paths write into (not the whole tree), as relative paths.
 * Folders come back with their files' paths, so a file never takes a folder's name.
 */
export async function existingNames(dir: FileSystemDirectoryHandle, paths: Iterable<string>): Promise<string[]> {
  const folders = new Set<string>();
  for (const p of paths) {
    const parts = p.split("/");
    for (let i = 0; i < parts.length; i++) folders.add(parts.slice(0, i).join("/"));
  }
  const out: string[] = [];
  for (const folder of folders) {
    const parts = folder ? folder.split("/") : [];
    const d = await findDir(dir, parts);
    if (!d) continue;
    const prefix = folder ? `${folder}/` : "";
    for await (const [name, handle] of (d as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) {
      // Folders end in "/": a file can't take a folder's name.
      out.push(handle.kind === "directory" ? `${prefix}${name}/` : `${prefix}${name}`);
    }
  }
  return out;
}

/** A set of taken name keys (as `uniqueFilename` keeps them) from relative paths. */
function takenSet(paths: Iterable<string>): Set<string> {
  const taken = new Set<string>();
  // Each existing path is unique on disk, so this adds it (and its folders) as it is. A folder ("x/") is added through a placeholder file inside it.
  for (const p of paths) uniqueFilename(p.endsWith("/") ? `${p}_` : p, taken);
  return taken;
}

/** True if `dir` has a file named `name` (a folder or nothing there: false). */
async function hasFile(dir: FileSystemDirectoryHandle, name: string): Promise<boolean> {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

/**
 * Write one file. A file this write created is removed again if the write
 * fails (an empty file must not be left behind); a file that was there
 * before keeps its old content (`createWritable` writes to a copy, and
 * `abort` drops it).
 */
async function writeOne(dir: FileSystemDirectoryHandle, path: string, bytes: Uint8Array): Promise<void> {
  const parts = path.split("/");
  const name = parts.pop() as string;
  let cur = dir;
  for (const p of parts) cur = await cur.getDirectoryHandle(p, { create: true });
  const existed = await hasFile(cur, name);
  try {
    const handle = await cur.getFileHandle(name, { create: true });
    const stream = await handle.createWritable();
    try {
      await stream.write(bytes as Uint8Array<ArrayBuffer>);
      await stream.close();
    } catch (e) {
      await stream.abort().catch(() => {});
      throw e;
    }
  } catch (e) {
    if (!existed) await cur.removeEntry(name).catch(() => {});
    throw e;
  }
}

export interface WriteOptions {
  /** Replace files with the same name. Off by default: taken names get a number. */
  replace?: boolean;
  /** After each file, written or failed. */
  onProgress?(done: number, total: number): void;
  /** Stops between files: the files not written yet are listed in `cancelled`. A file being written finishes. */
  signal?: AbortSignal;
}

/**
 * Write `files` into `dir`, making subfolders for "/" in names. Without
 * `replace`, a name already in the folder (checked again here, so a file
 * that appeared since the dialog listed the folder is never replaced) gets
 * `-1`, `-2`… One failed file doesn't stop the others.
 */
export async function writeExportFiles(dir: FileSystemDirectoryHandle, files: readonly OutputFile[], options: WriteOptions = {}): Promise<WriteResult> {
  const written: WrittenFile[] = [];
  const failures: WriteFailure[] = [];
  let taken: Set<string> | null = null;
  if (!options.replace) {
    try {
      taken = takenSet(await existingNames(dir, files.map((f) => f.filename)));
    } catch (e) {
      // The folder can't be read: nothing can be written either.
      const message = writeErrorMessage(e, dir.name);
      return { written, failures: files.map((f) => ({ filename: f.filename, message })) };
    }
  }
  for (let i = 0; i < files.length; i++) {
    const f = files[i] as OutputFile;
    if (options.signal?.aborted) return { written, failures, cancelled: files.slice(i).map((x) => x.filename) };
    try {
      const path = taken ? uniqueFilename(f.filename, taken) : f.filename;
      await writeOne(dir, path, f.bytes);
      written.push({ filename: f.filename, path });
    } catch (e) {
      failures.push({ filename: f.filename, message: writeErrorMessage(e, dir.name) });
    }
    options.onProgress?.(i + 1, files.length);
  }
  // Cancelled during the last file: it was finished, so nothing is left out.
  return { written, failures };
}

// ---- downloads ----

/** Start a download of `blob` as `name`. */
export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * The zip several files download as, with their folders. Names are made
 * unique inside it (`Welcome-1.png`), as in a folder.
 */
export function zipExportFiles(files: readonly OutputFile[]): { bytes: Uint8Array; paths: string[] } {
  const taken = new Set<string>();
  const tree: Zippable = {};
  const paths: string[] = [];
  for (const f of files) {
    const path = uniqueFilename(f.filename, taken);
    paths.push(path);
    // PNG, JPG and PDF are compressed already; storing them is faster and as small.
    tree[path] = [f.bytes, { level: f.mime === "image/svg+xml" ? 6 : 0 }];
  }
  return { bytes: zipSync(tree), paths };
}

/** The download name of the zip for several files: after the file or layer, safe for any disk. */
export function zipName(base: string): string {
  const safe = base.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim().replace(/[. ]+$/, "") || "Export";
  return `${safe.slice(0, 120)}.zip`;
}

/**
 * Download `files`: one as it is, several as one `.zip` named `zipBase`.
 * Returns what was downloaded (the name the browser was given).
 */
export function downloadExportFiles(files: readonly OutputFile[], zipBase: string): { name: string; count: number } {
  if (files.length === 1) {
    const f = files[0] as OutputFile;
    const name = f.filename.split("/").pop() || f.filename;
    downloadBlob(name, new Blob([f.bytes as Uint8Array<ArrayBuffer>], { type: f.mime }));
    return { name, count: 1 };
  }
  const { bytes } = zipExportFiles(files);
  const name = zipName(zipBase);
  downloadBlob(name, new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/zip" }));
  return { name, count: files.length };
}
