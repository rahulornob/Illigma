/**
 * One queue per place on disk, shared by every backend and journal in this
 * tab. A file can have more than one backend at a time: closing an editor
 * starts its last save, and reopening the file makes a new backend before
 * that save is done. Two writes to one package at once would remove each
 * other's staged copies (or a late, older save would land on top of a newer
 * one), so every read, repair and write of a package, and every write of a
 * recovery journal, waits for the ones before it at the same place.
 *
 * Places:
 * - OPFS: the root (the default origin storage, or a test's root handle)
 *   plus the path under it, e.g. "files/<fileId>" or "journal/<fileId>".
 * - A folder: its directory handle. Two handles for the same folder (picked
 *   twice) are one place: they are matched with `isSameEntry`.
 *
 * Writing stays in this tab: another tab is kept out by the editing lock
 * (lock.ts), another app by the save id check (backend.ts).
 */

/** What is known about one place. Kept for the life of the tab: one small entry per file opened. */
export interface LocationState {
  /** Settles when every task queued so far has. */
  tail: Promise<unknown>;
  /** The newest backend (by `nextGeneration`) that has saved here. 0: none yet. */
  newestSaved: number;
}

export type FileLocation =
  /** `path`: folder names under the OPFS root. `root`: the root handle, if not the default one. */
  | { kind: "opfs"; path: readonly string[]; root?: FileSystemDirectoryHandle | undefined }
  | { kind: "folder"; dir: FileSystemDirectoryHandle };

/** Stands for `navigator.storage.getDirectory()`, which may hand out a new handle object on each call. */
const DEFAULT_ROOT = {};
const opfsPlaces = new WeakMap<object, Map<string, LocationState>>();
/** Every folder seen, to match a new handle for the same folder with `isSameEntry`. */
const folderPlaces: { dir: FileSystemDirectoryHandle; state: LocationState }[] = [];
const folderByHandle = new WeakMap<FileSystemDirectoryHandle, LocationState>();
/** Folder lookups run one at a time, so two new handles for one folder can't each make a place. */
let folderLookup: Promise<unknown> = Promise.resolve();

let generations = 0;

/** A number for a new backend: a backend made later (a file opened again) gets a higher one. */
export function nextGeneration(): number {
  return ++generations;
}

const newState = (): LocationState => ({ tail: Promise.resolve(), newestSaved: 0 });

function opfsState(root: object, path: readonly string[]): LocationState {
  let places = opfsPlaces.get(root);
  if (!places) opfsPlaces.set(root, (places = new Map()));
  const key = path.join("/");
  let state = places.get(key);
  if (!state) places.set(key, (state = newState()));
  return state;
}

async function sameFolder(a: FileSystemDirectoryHandle, b: FileSystemDirectoryHandle): Promise<boolean> {
  if (a === b) return true;
  if (typeof a.isSameEntry !== "function") return false; // can't tell: only the same handle counts
  return a.isSameEntry(b).catch(() => false);
}

/** Find (or make) the folder's place, then queue `task` there in the same turn, so tasks keep call order. */
function atFolder<T>(dir: FileSystemDirectoryHandle, task: (state: LocationState) => Promise<T>): Promise<T> {
  const known = folderByHandle.get(dir);
  if (known) return enqueue(known, task);
  let run!: Promise<T>;
  const found = folderLookup.then(async () => {
    let state = folderByHandle.get(dir);
    for (const place of folderPlaces) {
      if (state) break;
      if (await sameFolder(place.dir, dir)) state = place.state;
    }
    if (!state) folderPlaces.push({ dir, state: (state = newState()) });
    folderByHandle.set(dir, state);
    run = enqueue(state, task);
  });
  folderLookup = found.catch(() => {});
  return found.then(() => run);
}

function enqueue<T>(state: LocationState, task: (state: LocationState) => Promise<T>): Promise<T> {
  const run = state.tail.then(
    () => task(state),
    () => task(state),
  );
  state.tail = run.catch(() => {});
  return run;
}

/**
 * Run `task` once every task queued earlier for the same place has settled,
 * whichever backend or journal queued it. Tasks for one place run one at a
 * time, in the order they were queued. A task must not queue another for
 * its own place and wait for it: that would wait for itself.
 */
export function atLocation<T>(loc: FileLocation, task: (state: LocationState) => Promise<T>): Promise<T> {
  return loc.kind === "opfs" ? enqueue(opfsState(loc.root ?? DEFAULT_ROOT, loc.path), task) : atFolder(loc.dir, task);
}
