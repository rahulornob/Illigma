/**
 * Where each file id was last opened from. A package copied outside Illigma
 * (Finder "Duplicate", a synced copy, an old "Save a copy") keeps its file
 * id; two packages with one id would share an editing lock and a recovery
 * journal. When a folder is opened, `isCopyOfAnother` tells whether another
 * existing location holds the same id, so the caller can give it a new one.
 *
 * Folder handles can only be kept in IndexedDB, so that is where this lives.
 */

import { opfsRoot } from "./fs.js";

export interface LocationStore {
  get(fileId: string): Promise<FileSystemDirectoryHandle | undefined>;
  set(fileId: string, dir: FileSystemDirectoryHandle): Promise<void>;
}

/** For tests, and browsers without IndexedDB. */
export function memoryLocationStore(): LocationStore {
  const map = new Map<string, FileSystemDirectoryHandle>();
  return {
    get: async (id) => map.get(id),
    set: async (id, dir) => void map.set(id, dir),
  };
}

const DB = "illigma";
const STORE = "locations";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** The IndexedDB store ("illigma" › "locations"); in memory where IndexedDB is missing. */
export function idbLocationStore(): LocationStore {
  const idb = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  if (!idb) return memoryLocationStore();
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

/** True if the folder still exists. Undefined if the browser won't say (no permission this session). */
async function stillThere(dir: FileSystemDirectoryHandle): Promise<boolean | undefined> {
  const query = (dir as unknown as { queryPermission?: (d: { mode: "read" }) => Promise<PermissionState> }).queryPermission;
  if (typeof query === "function" && (await query.call(dir, { mode: "read" }).catch(() => "denied")) !== "granted") return undefined;
  try {
    await dir.keys().next();
    return true;
  } catch (err) {
    const name = (err as { name?: unknown })?.name;
    return name === "NotFoundError" ? false : undefined;
  }
}

/**
 * Is the package in `dir` (holding `fileId`) a copy of another file? True if
 * this browser's storage has a file with that id, or the id was last opened
 * from another folder that still exists. Otherwise `dir` becomes the id's
 * location. A folder that can't be checked (no permission this session)
 * counts as moved, not copied, so its recovery journal still applies.
 */
export async function isCopyOfAnother(fileId: string, dir: FileSystemDirectoryHandle, store: LocationStore, root?: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    const files = await (await opfsRoot(root)).getDirectoryHandle("files");
    await (await files.getDirectoryHandle(fileId)).getFileHandle("manifest.json");
    return true;
  } catch {
    // not in browser storage
  }
  const known = await store.get(fileId).catch(() => undefined);
  if (known && !(await known.isSameEntry(dir).catch(() => false)) && (await stillThere(known)) === true) return true;
  await store.set(fileId, dir).catch(() => {});
  return false;
}
