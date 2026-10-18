/**
 * Autosave (save-states.md rules 1 and 3): the document is written about
 * 1 second after the last change. A failed save is never silent: the status
 * turns to "error" with a plain message and the save is retried every 30
 * seconds until it works.
 *
 * The status is reported as it is. Hiding a short "saving" state, so the
 * title bar never flickers, is the title bar's job.
 */

import type { Document } from "@illigma/core";
import { writePackage, type FileTree } from "@illigma/format";
import type { Backend } from "./backend.js";
import type { RecoveryJournal } from "./journal.js";

export type SaveState = "saved" | "saving" | "unsaved" | "error";

export interface SaveStatus {
  state: SaveState;
  /** Why the last save failed, in plain words. Only with "error". */
  message?: string;
  /** When the file was last saved (ms since epoch), once it has been. */
  savedAt?: number;
}

export interface AutosaverOptions {
  /** Wait after the last change before saving. Default 1000 ms. */
  delayMs?: number;
  /** Default: writePackage(doc.toFile()). */
  serialize?: (doc: Document) => FileTree;
  /** Cleared up to the saved state after each successful save. */
  journal?: RecoveryJournal;
}

export const RETRY_MS = 30_000;

export class Autosaver {
  private current: SaveStatus = { state: "saved" };
  private readonly listeners = new Set<(s: SaveStatus) => void>();
  private readonly delayMs: number;
  private readonly serialize: (doc: Document) => FileTree;
  private readonly journal: RecoveryJournal | undefined;
  private readonly unsubscribe: () => void;
  /** Bumped on every change. */
  private version = 0;
  private savedVersion = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private inFlight: Promise<void> | null = null;
  private savedAt: number | undefined;
  private disposed = false;

  constructor(
    private readonly doc: Document,
    private readonly backend: Backend,
    opts: AutosaverOptions = {},
  ) {
    this.delayMs = opts.delayMs ?? 1000;
    this.serialize = opts.serialize ?? ((d) => writePackage(d.toFile()));
    this.journal = opts.journal;
    this.unsubscribe = doc.subscribe(() => this.onChange());
  }

  get status(): SaveStatus {
    return this.current;
  }

  /** Called on every status change. Returns a function that stops it. */
  onStatus(cb: (s: SaveStatus) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  /** Save now if there are unsaved changes, e.g. before the window closes. Resolves when done; check `status` for the result. */
  async flushNow(): Promise<void> {
    await this.save();
  }

  /** Stop watching the document. Unsaved changes are not written; call flushNow() first. */
  dispose(): void {
    this.disposed = true;
    this.unsubscribe();
    this.clearTimers();
    this.listeners.clear();
  }

  private get dirty(): boolean {
    return this.version !== this.savedVersion;
  }

  private onChange(): void {
    if (this.disposed) return;
    this.version++;
    if (this.current.state === "saved") this.setStatus("unsaved");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.save(), this.delayMs);
  }

  private async save(): Promise<void> {
    while (this.inFlight) await this.inFlight;
    if (this.disposed || !this.dirty) return;
    this.clearTimers();
    const run = this.write();
    this.inFlight = run;
    try {
      await run;
    } finally {
      if (this.inFlight === run) this.inFlight = null;
    }
  }

  private async write(): Promise<void> {
    const version = this.version;
    const mark = this.journal?.checkpoint();
    this.setStatus("saving");
    try {
      await this.backend.write(this.serialize(this.doc));
    } catch (err) {
      if (this.disposed) return;
      this.setStatus("error", describeSaveError(err));
      this.retryTimer = setTimeout(() => void this.save(), RETRY_MS);
      return;
    }
    this.savedVersion = version;
    this.savedAt = Date.now();
    // The journal is only a backup; if clearing it fails, the next save clears it.
    if (this.journal) await this.journal.clear(mark).catch(() => {});
    if (this.disposed) return;
    this.setStatus(this.dirty ? "unsaved" : "saved");
  }

  private setStatus(state: SaveState, message?: string): void {
    const next: SaveStatus = { state };
    if (message !== undefined) next.message = message;
    if (this.savedAt !== undefined) next.savedAt = this.savedAt;
    this.current = next;
    for (const cb of [...this.listeners]) cb(next);
  }

  private clearTimers(): void {
    clearTimeout(this.timer);
    clearTimeout(this.retryTimer);
    this.timer = this.retryTimer = undefined;
  }
}

/** A plain sentence for the error banner. */
export function describeSaveError(err: unknown): string {
  const name = (err as { name?: unknown })?.name;
  const detail = (err instanceof Error && err.message ? err.message : String(err)).split("\n")[0]!.replace(/^Can't save: /, "");
  const reason =
    name === "QuotaExceededError"
      ? "there isn't enough storage space left."
      : name === "NotAllowedError" || name === "SecurityError"
        ? "Illigma doesn't have permission to write here."
        : name === "NotFoundError"
          ? "the file or its folder can't be found. It may have been moved or deleted."
          : name === "NoModificationAllowedError"
            ? "the file is locked by another tab or app."
            : detail;
  return `Couldn't save: ${reason.replace(/\.?$/, ".")} Your changes are safe in this window. Retrying in 30 seconds.`;
}
