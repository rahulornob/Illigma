/**
 * @illigma/host-web: the browser host for files. Packages live in OPFS or
 * in a real folder (File System Access API); edits are autosaved and
 * journalled for crash recovery. No network.
 */

export {
  type Backend,
  type OpfsBackend,
  type ReadOptions,
  type WriteOptions,
  COMMIT_FILE,
  REV_FILE,
  newSaveId,
  opfsBackend,
  folderBackend,
  pickFolderBackend,
  supportsFolderAccess,
  TEMP_SUFFIX,
} from "./backend.js";
export { Autosaver, describeSaveError, saveErrorReason, RETRY_MS, type AutosaverOptions, type SaveState, type SaveStatus } from "./autosaver.js";
export { RecoveryJournal, JOURNAL_FLUSH_MS } from "./journal.js";
export { listRecentFiles, type RecentFile } from "./recent.js";
export { acquireFileLock, type FileLock } from "./lock.js";
