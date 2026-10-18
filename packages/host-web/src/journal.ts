/**
 * The recovery journal: every committed change is appended to
 * OPFS "journal/<fileId>.ndjson" shortly after it happens, before it
 * reaches the file. After a crash, `recovered()` gives the changes that
 * were not yet saved; replaying them on the last saved package restores the
 * document (save-states.md rule 2).
 *
 * Lines:
 *   {"seq":n,"origin":"edit","label":"…","ops":[…]}   one change
 *   {"save":"<saveId>"}                                 a save was about to be written
 * A torn last line (the browser stopped mid-append) is skipped.
 *
 * Lines already in the file are told apart by save id: before each save the
 * journal appends {"save": id} after every change the save holds, and the
 * backend stores the same id in the package (".illigma-rev"). If the package
 * holds that id, the save happened, so every change line before the marker
 * is in the file, even if the tab closed before the journal was cleared.
 *
 * Changes left from an earlier session ("carried") are kept until the person
 * decides: only `discardRecovered()`, `clear()` without a checkpoint, or
 * `clear(mark, { recovered: true })` after they were saved remove them.
 */

import type { Change, Document, Operation } from "@illigma/core";
import { appendText, assertFileId, openDir, opfsRoot, readText, writeText } from "./fs.js";

/** How long changes are batched before they are appended. */
export const JOURNAL_FLUSH_MS = 250;

interface Entry {
  seq: number;
  line: string;
  ops: Operation[];
}

interface Line {
  seq?: number;
  ops?: Operation[];
  save?: string;
}

export class RecoveryJournal {
  readonly fileName: string;
  private seq = 0;
  /** Unsaved changes from an earlier session, found when the journal was loaded. */
  private carried: Entry[] = [];
  /** Recorded, not yet appended. */
  private buffer: Entry[] = [];
  /** Appended by this journal and not cleared. */
  private written: Entry[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private tail: Promise<unknown> = Promise.resolve();
  private loaded: Promise<void> | null = null;

  constructor(
    readonly fileId: string,
    private readonly root?: FileSystemDirectoryHandle,
  ) {
    assertFileId(fileId);
    this.fileName = `${fileId}.ndjson`;
  }

  /**
   * Read what earlier sessions left in the journal. `savedId` is the save id
   * the package holds (Backend.saveId): changes the package already has are
   * dropped. Runs once; every other method loads first (without a save id)
   * if this wasn't called, so the old lines are never overwritten unread.
   */
  load(savedId?: string | null): Promise<void> {
    return this.enqueue(() => this.loadNow(savedId));
  }

  /** `load` for code already running in the queue (enqueueing again would wait on itself). */
  private loadNow(savedId?: string | null): Promise<void> {
    this.loaded ??= (async () => {
      const text = await this.readFile();
      const lines: Line[] = [];
      for (const raw of text.split("\n")) {
        if (!raw.trim()) continue;
        try {
          lines.push(JSON.parse(raw) as Line);
        } catch {
          continue; // torn write
        }
      }
      // Everything before the marker of the save the package holds is in the package.
      const saved = savedId ? lines.map((l) => l.save).lastIndexOf(savedId) : -1;
      this.carried = lines
        .slice(saved + 1)
        .filter((l) => Array.isArray(l.ops) && l.ops.length > 0)
        .map((l) => ({ seq: 0, line: JSON.stringify(l), ops: l.ops! }));
    })().catch((err: unknown) => {
      this.loaded = null; // try again next time
      throw err;
    });
    return this.loaded;
  }

  /** True once loaded if an earlier session left unsaved changes. */
  get hasRecovered(): boolean {
    return this.carried.length > 0;
  }

  /** Unsaved changes from earlier sessions, one list of operations per change, oldest first. */
  async recovered(): Promise<Operation[][]> {
    await this.load();
    return this.carried.map((e) => e.ops);
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
    return this.enqueue(() => this.append(this.buffer.length ? this.buffer[this.buffer.length - 1]!.seq : 0));
  }

  /**
   * Call just before writing a save with `saveId` that holds every change up
   * to `through` (a checkpoint): appends those changes and the save marker.
   * Carried changes count as saved by the marker too, so it is only written
   * when the save holds them (`includesRecovered`, after Keep). Otherwise
   * a crash right after the save re-offers this session's changes, which is
   * safe; dropping undecided recovered edits would not be.
   */
  markSave(saveId: string, through: number, opts: { includesRecovered?: boolean } = {}): Promise<void> {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    return this.enqueue(async () => {
      await this.loadNow();
      const marker = !this.carried.length || opts.includesRecovered ? JSON.stringify({ save: saveId }) : undefined;
      await this.append(through, marker);
    });
  }

  /** Operations recorded since the last `clear()`, in order: carried, appended, then not yet appended. */
  async pending(): Promise<Operation[]> {
    await this.load();
    return [...this.carried, ...this.written, ...this.buffer].flatMap((e) => e.ops);
  }

  /**
   * Forget recorded changes once they are saved. `clear(mark)` drops this
   * session's changes up to `mark` (from `checkpoint()`), so changes made
   * while a save was running stay. Carried changes stay unless
   * `recovered: true` (they were saved too) or no mark is given (forget all).
   */
  clear(through = Infinity, opts: { recovered?: boolean } = {}): Promise<void> {
    const recovered = opts.recovered ?? through === Infinity;
    return this.enqueue(async () => {
      await this.loadNow();
      this.buffer = this.buffer.filter((e) => e.seq > through);
      this.written = this.written.filter((e) => e.seq > through);
      if (recovered) this.carried = [];
      await this.rewrite();
    });
  }

  /** Forget only the changes recovered from an earlier session (the person chose Discard). */
  discardRecovered(): Promise<void> {
    return this.enqueue(async () => {
      await this.loadNow();
      this.carried = [];
      await this.rewrite();
    });
  }

  private record(change: Change): void {
    // Replayed operations come from the journal or a file already; recording them again would double them.
    if (!change.ops.length || change.origin === "replay") return;
    const seq = ++this.seq;
    const ops = change.ops as Operation[];
    this.buffer.push({ seq, ops, line: JSON.stringify({ seq, origin: change.origin, label: change.label, ops }) });
    if (this.timer === undefined) {
      this.timer = setTimeout(() => {
        this.timer = undefined;
        void this.flush().catch(() => {}); // kept in the buffer; retried with the next change
      }, JOURNAL_FLUSH_MS);
    }
  }

  /** Append buffered changes up to `through`, then `extra`. Runs inside the queue. */
  private async append(through: number, extra?: string): Promise<void> {
    await this.loadNow();
    const batch = this.buffer.filter((e) => e.seq <= through);
    if (!batch.length && extra === undefined) return;
    const text = batch.map((e) => e.line + "\n").join("") + (extra === undefined ? "" : extra + "\n");
    await appendText(await this.dir(), this.fileName, text);
    this.buffer = this.buffer.filter((e) => e.seq > through);
    this.written.push(...batch);
  }

  private async rewrite(): Promise<void> {
    const handle = await (await this.dir()).getFileHandle(this.fileName, { create: true });
    await writeText(handle, [...this.carried, ...this.written].map((e) => e.line + "\n").join(""));
  }

  private async readFile(): Promise<string> {
    try {
      const dir = await openDir(await opfsRoot(this.root), ["journal"], false);
      return await readText(await dir.getFileHandle(this.fileName));
    } catch (err) {
      if ((err as { name?: unknown })?.name === "NotFoundError") return "";
      throw err;
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
