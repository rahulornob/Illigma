/**
 * One editing tab per file. Two tabs autosaving the same package would
 * overwrite each other's saves and clear each other's recovery journal, so
 * the first tab takes a Web Lock named "illigma:<fileId>" and keeps it while
 * the file is open; any other tab opens the file read-only.
 */

export interface FileLock {
  /** Let another tab edit the file. Safe to call more than once. */
  release(): void;
}

interface LockManagerLike {
  request(name: string, options: { ifAvailable: boolean }, callback: (lock: unknown) => Promise<void> | void): Promise<unknown>;
}

/**
 * Take the editing lock for `fileId`, or null if another tab has it. In a
 * browser without Web Locks every tab gets a lock (the old behaviour).
 */
export function acquireFileLock(fileId: string): Promise<FileLock | null> {
  const locks = (globalThis as { navigator?: { locks?: LockManagerLike } }).navigator?.locks;
  if (typeof locks?.request !== "function") return Promise.resolve({ release() {} });
  return new Promise((resolve, reject) => {
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    locks
      .request(`illigma:${fileId}`, { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(null);
          return;
        }
        resolve({ release });
        return held; // the lock is held until this settles
      })
      .catch(reject);
  });
}
