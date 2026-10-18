/**
 * Where a file's `.illigma` package lives in the browser: the private
 * origin storage (OPFS) or a real folder picked through the File System
 * Access API (Chromium).
 */

import type { FileTree } from "@illigma/format";
import { assertFileId, listFiles, openDir, opfsRoot, readText, writeText } from "./fs.js";

/** Where a file's package lives. */
export interface Backend {
  /** Shown in the title bar, e.g. "Browser storage" or "Onboarding flow.illigma". */
  readonly label: string;
  readonly kind: "opfs" | "folder";
  read(): Promise<FileTree>;
  /** Atomic per file: each file is written to a temporary copy first, then replaced. */
  write(tree: FileTree): Promise<void>;
}

/** A package stored in OPFS. */
export interface OpfsBackend extends Backend {
  readonly kind: "opfs";
  readonly fileId: string;
  readonly name: string;
}

/** Suffix of staged copies. Readers skip these files. */
export const TEMP_SUFFIX = ".illigma-tmp";

/** Folders whose files belong to the package, so stale ones are removed on save. */
const OWNED_FOLDERS = ["pages"];

function splitPath(path: string): { dirs: string[]; name: string } {
  const parts = path.split("/");
  if (!path || path.startsWith("/") || parts.some((p) => p === "" || p === "." || p === ".." || p.includes("\\"))) {
    throw new Error(`Can't save "${path}": not a valid package path.`);
  }
  const name = parts.pop() as string;
  if (name.endsWith(TEMP_SUFFIX)) throw new Error(`Can't save "${path}": reserved file name.`);
  return { dirs: parts, name };
}

function isSkipped(name: string): boolean {
  return name.startsWith(".") || name.endsWith(TEMP_SUFFIX);
}

/** Read every package file under `dir`, skipping hidden files and staged copies. */
async function readTree(dir: FileSystemDirectoryHandle): Promise<FileTree> {
  const tree: FileTree = new Map();
  for (const [path, handle] of await listFiles(dir, isSkipped)) tree.set(path, await readText(handle));
  return tree;
}

/**
 * Write `tree` into `dir` so that a failure never leaves a half-written file:
 *
 * 1. Stage: every file is written to "<name>.illigma-tmp". If any staging
 *    write fails, the staged copies are removed and the package is untouched.
 * 2. Commit: each file is replaced from its staged text through a writable
 *    stream, which the browser applies atomically on close(). Page files go
 *    first and manifest.json last, so the manifest never points at a page
 *    that isn't there yet.
 * 3. Clean up: staged copies, and page files no longer in the package, are removed.
 */
async function writeTree(dir: FileSystemDirectoryHandle, tree: FileTree): Promise<void> {
  const files = [...tree].map(([path, text]) => ({ path, text, ...splitPath(path) }));
  files.sort((a, b) => Number(a.path === "manifest.json") - Number(b.path === "manifest.json") || (a.path < b.path ? -1 : 1));

  const staged: { parent: FileSystemDirectoryHandle; tempName: string }[] = [];
  const removeStaged = async () => {
    for (const s of staged.splice(0)) await s.parent.removeEntry(s.tempName).catch(() => {});
  };

  const parents = new Map<string, FileSystemDirectoryHandle>();
  const parentOf = async (dirs: string[]) => {
    const key = dirs.join("/");
    let handle = parents.get(key);
    if (!handle) parents.set(key, (handle = await openDir(dir, dirs, true)));
    return handle;
  };

  try {
    for (const f of files) {
      const parent = await parentOf(f.dirs);
      const tempName = f.name + TEMP_SUFFIX;
      staged.push({ parent, tempName });
      await writeText(await parent.getFileHandle(tempName, { create: true }), f.text);
    }
  } catch (err) {
    await removeStaged();
    throw err;
  }

  for (const f of files) {
    const parent = await parentOf(f.dirs);
    await writeText(await parent.getFileHandle(f.name, { create: true }), f.text);
  }
  await removeStaged();

  for (const folder of OWNED_FOLDERS) {
    let handle: FileSystemDirectoryHandle;
    try {
      handle = await dir.getDirectoryHandle(folder);
    } catch {
      continue;
    }
    for (const [path] of await listFiles(handle, isSkipped)) {
      if (!tree.has(`${folder}/${path}`) && !path.includes("/")) await handle.removeEntry(path).catch(() => {});
    }
  }
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
  return {
    label: "Browser storage",
    kind: "opfs",
    fileId,
    name,
    read: () =>
      queue(async () => {
        try {
          return await readTree(await fileDir(false));
        } catch (err) {
          if (isNotFound(err)) return new Map();
          throw err;
        }
      }),
    write: (tree) => queue(async () => writeTree(await fileDir(true), tree)),
  };
}

type PermissionMode = "read" | "readwrite";
type PermissionHandle = { queryPermission?: (d: { mode: PermissionMode }) => Promise<PermissionState> };

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
  return {
    label: dir.name,
    kind: "folder",
    read: () =>
      queue(async () => {
        await assertPermission(dir, "read");
        return readTree(dir);
      }),
    write: (tree) =>
      queue(async () => {
        await assertPermission(dir, "readwrite");
        await writeTree(dir, tree);
      }),
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
