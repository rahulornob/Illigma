/** Small helpers over File System Access / OPFS handles. */

/** The OPFS root: `root` if given, else `navigator.storage.getDirectory()`. */
export async function opfsRoot(root?: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  if (root) return root;
  const storage = (globalThis as { navigator?: { storage?: Partial<StorageManager> } }).navigator?.storage;
  if (typeof storage?.getDirectory !== "function") {
    throw new DOMException("This browser has no private file storage (OPFS), so Illigma can't keep files here.", "NotSupportedError");
  }
  return storage.getDirectory();
}

/** Throw unless `id` is safe to use as one folder or file name. */
export function assertFileId(id: string): void {
  if (!/^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(id)) throw new Error(`Not a valid file id: "${id}".`);
}

/** Open (or create) the folder at `path` under `dir`. */
export async function openDir(dir: FileSystemDirectoryHandle, path: string[], create: boolean): Promise<FileSystemDirectoryHandle> {
  let cur = dir;
  for (const name of path) cur = await cur.getDirectoryHandle(name, { create });
  return cur;
}

/** Every file under `dir` as [relative path, handle], sorted by path. Names for which `skip` is true are left out, with their contents. */
export async function listFiles(
  dir: FileSystemDirectoryHandle,
  skip: (name: string) => boolean = () => false,
): Promise<[string, FileSystemFileHandle][]> {
  const out: [string, FileSystemFileHandle][] = [];
  const walk = async (d: FileSystemDirectoryHandle, prefix: string) => {
    for await (const [name, handle] of d.entries()) {
      if (skip(name)) continue;
      const path = prefix + name;
      if (handle.kind === "directory") await walk(handle as FileSystemDirectoryHandle, `${path}/`);
      else out.push([path, handle as FileSystemFileHandle]);
    }
  };
  await walk(dir, "");
  return out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

export async function readText(handle: FileSystemFileHandle): Promise<string> {
  return (await handle.getFile()).text();
}

export async function readBytes(handle: FileSystemFileHandle): Promise<Uint8Array> {
  return new Uint8Array(await (await handle.getFile()).arrayBuffer());
}

/** Replace a file's contents (text, or bytes). The browser applies the stream on close(), so a failure keeps the old contents. */
export async function writeText(handle: FileSystemFileHandle, text: string | Uint8Array): Promise<void> {
  const stream = await handle.createWritable();
  try {
    await stream.write(text as string | Uint8Array<ArrayBuffer>);
  } catch (err) {
    await stream.abort().catch(() => {});
    throw err;
  }
  await stream.close();
}

/** Add `text` to the end of a file, creating it if needed. */
export async function appendText(dir: FileSystemDirectoryHandle, name: string, text: string): Promise<void> {
  const handle = await dir.getFileHandle(name, { create: true });
  const size = (await handle.getFile()).size;
  const stream = await handle.createWritable({ keepExistingData: true });
  try {
    await stream.seek(size);
    await stream.write(text);
  } catch (err) {
    await stream.abort().catch(() => {});
    throw err;
  }
  await stream.close();
}
