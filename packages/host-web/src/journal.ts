/**
 * The recovery journal: every committed change is appended to
 * OPFS "journal/<fileId>.ndjson" shortly after it happens, before it
 * reaches the file. After a crash, `pending()` gives the operations that
 * were not yet saved; applying them to the last saved package restores the
 * document (save-states.md rule 2).
 *
 * Each line is one change: {"seq":n,"origin":"edit","label":"…","ops":[…]}.
 * A torn last line (the browser stopped mid-append) is skipped.
 */

import type { Change, Document, Operation } from "@illigma/core";
import { appendText, assertFileId, openDir, opfsRoot, readText, writeText } from "./fs.js";

/** How long changes are batched before they are appended. */
export const JOURNAL_FLUSH_MS = 250;

interface Entry {
  seq: number;
  line: string;
}

interface Line {
  seq?: number;
  ops?: Operation[];
}

export class RecoveryJournal {
  readonly fileName: string;
  private seq = 0;
  /** Recorded, not yet appended. */
  private buffer: Entry[] = [];
  /** Appended by this journal and not cleared. */
  private written: Entry[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private tail: Promise<unknown> = Promise.resolve();

  constructor(
    readonly fileId: string,
    private readonly root?: FileSystemDirectoryHandle,
  ) {
    assertFileId(fileId);
    this.fileName = `${fileId}.ndjson`;
  }

  /**
   * Record every change `doc` commits (edits, undo and redo). Changes are
   * appended in batches at most every 250 ms. Returns a function that stops
   * recording and appends what is still batched.
   */
  attach(doc: Document): () => void {
    const unsubscribe = doc.subscribe((change) => this.record(change));
    return () => {
      unsubscribe();
      void this.flush().catch(() => {});
    };
  }

  /** The sequence number of the last recorded change. Pass it to `clear` to drop only what came before. */
  checkpoint(): number {
    return this.seq;
  }

  /** Append batched changes now. */
  flush(): Promise<void> {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    return this.enqueue(async () => {
      if (!this.buffer.length) return;
      const batch = this.buffer.splice(0);
      try {
        await appendText(await this.dir(), this.fileName, batch.map((e) => e.line + "\n").join(""));
      } catch (err) {
        this.buffer.unshift(...batch);
        throw err;
      }
      this.written.push(...batch);
    });
  }

  /** Operations recorded since the last `clear()`, in order, including any not yet appended. */
  async pending(): Promise<Operation[]> {
    const ops: Operation[] = [];
    const text = await this.enqueue(async () => {
      try {
        const dir = await openDir(await opfsRoot(this.root), ["journal"], false);
        return await readText(await dir.getFileHandle(this.fileName));
      } catch (err) {
        if ((err as { name?: unknown })?.name === "NotFoundError") return "";
        throw err;
      }
    });
    for (const raw of text.split("\n")) {
      if (!raw.trim()) continue;
      let line: Line;
      try {
        line = JSON.parse(raw) as Line;
      } catch {
        continue; // torn write
      }
      if (Array.isArray(line.ops)) ops.push(...line.ops);
    }
    for (const e of this.buffer) ops.push(...(JSON.parse(e.line) as Line).ops!);
    return ops;
  }

  /**
   * Forget recorded changes: all of them, or only those up to `through`
   * (a value from `checkpoint()`), so changes made while a save was running
   * stay in the journal.
   */
  clear(through = Infinity): Promise<void> {
    return this.enqueue(async () => {
      this.buffer = this.buffer.filter((e) => e.seq > through);
      this.written = this.written.filter((e) => e.seq > through);
      const dir = await this.dir();
      const handle = await dir.getFileHandle(this.fileName, { create: true });
      await writeText(handle, this.written.map((e) => e.line + "\n").join(""));
    });
  }

  private record(change: Change): void {
    if (!change.ops.length) return;
    const seq = ++this.seq;
    this.buffer.push({ seq, line: JSON.stringify({ seq, origin: change.origin, label: change.label, ops: change.ops }) });
    if (this.timer === undefined) {
      this.timer = setTimeout(() => {
        this.timer = undefined;
        void this.flush().catch(() => {}); // kept in the buffer; retried with the next change
      }, JOURNAL_FLUSH_MS);
    }
  }

  private async dir(): Promise<FileSystemDirectoryHandle> {
    return openDir(await opfsRoot(this.root), ["journal"], true);
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.tail.then(task, task);
    this.tail = run.catch(() => {});
    return run;
  }
}
