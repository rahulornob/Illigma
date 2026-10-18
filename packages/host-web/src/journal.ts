/**
 * The recovery journal: every committed change is appended to
 * OPFS "journal/<fileId>.ndjson" shortly after it happens, before it
 * reaches the file. After a crash, `recovered()` gives the changes that
 * were not yet saved; replaying them on the last saved package restores the
 * document (save-states.md rule 2).
 *
 * Lines:
 *   {"seq":n,"sid":"…","origin":"edit","label":"…","ops":[…]}   one change
 *   {"save":"<saveId>","keep":[…]}                                a save was about to be written
 * A torn last line (the browser stopped mid-append) is skipped. "sid" names
 * the journal session that wrote the line; with "seq" it identifies a change.
 *
 * Closing the tab: the OPFS append is asynchronous, so changes made in the
 * last 250 ms may never reach the file. `stashUnflushed()` (called on
 * pagehide) also copies them synchronously into localStorage; the next
 * `load` appends the ones the file doesn't have (by sid and seq) and removes
 * the stash, so the recovery banner offers them too.
 *
 * Lines already in the file are told apart by save id: before each save the
 * journal appends {"save": id} after every change the save holds, and the
 * backend stores the same id in the package (".illigma-rev"). If the package
 * holds that id, the save happened, so every change line before the marker
 * is in the file, even if the tab closed before the journal was cleared.
 * Carried changes the save does not hold (undecided, or skipped by Keep) are
 * copied into the marker's "keep" list, so they stay carried after it.
 *
 * Changes left from an earlier session ("carried") are kept until the person
 * decides: only `discardRecovered()`, `clear()` without a checkpoint, or
 * `clear(mark, { recovered: true })` after they were saved remove them.
 */

import type { Change, Document, Operation } from "@illigma/core";
import { appendText, assertFileId, openDir, opfsRoot, readText, writeText } from "./fs.js";
import { atLocation } from "./location-queue.js";

/** How long changes are batched before they are appended. */
export const JOURNAL_FLUSH_MS = 250;

/** The localStorage key holding the changes stashed when a tab closed before they were appended. */
export const stashKey = (fileId: string) => `illigma.journal-stash.${fileId}`;
/** At most this many characters are stashed per file (localStorage holds a few MB per site). */
export const STASH_MAX_CHARS = 1_000_000;

/** The part of Web Storage the stash uses (tests pass a fake). */
export type StashStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface JournalOptions {
  /** Where unflushed changes are stashed on close. Default: localStorage in a browser; null for none. */
  storage?: StashStorage | null;
}

/** localStorage, if this is a browser that allows it. */
function defaultStorage(): StashStorage | null {
  try {
    return typeof document !== "undefined" && typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null; // blocked (e.g. storage disabled for the site)
  }
}

interface Stashed {
  raw: string;
  sid?: string;
  seq?: number;
  ops?: Operation[];
}

const idOf = (l: { sid?: unknown; seq?: unknown }) => (typeof l.sid === "string" && typeof l.seq === "number" ? `${l.sid}:${l.seq}` : null);

interface Entry {
  seq: number;
  line: string;
  ops: Operation[];
}

interface Line {
  seq?: number;
  sid?: string;
  ops?: Operation[];
  save?: string;
  /** In a save marker: carried change lines the save does not hold. */
  keep?: unknown;
}

const hasOps = (l: Line | null | undefined): l is Line & { ops: Operation[] } => Array.isArray(l?.ops) && l.ops.length > 0;

export class RecoveryJournal {
  readonly fileName: string;
  private seq = 0;
  /** This session's id, written on every change line so a stashed copy can be matched with the file. */
  private readonly sid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  private readonly storage: StashStorage | null;
  /** Unsaved changes from an earlier session, found when the journal was loaded. */
  private carried: Entry[] = [];
  /** Recorded, not yet appended. */
  private buffer: Entry[] = [];
  /** Appended by this journal and not cleared. */
  private written: Entry[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private loaded: Promise<void> | null = null;

  constructor(
    readonly fileId: string,
    private readonly root?: FileSystemDirectoryHandle,
    opts: JournalOptions = {},
  ) {
    assertFileId(fileId);
    this.fileName = `${fileId}.ndjson`;
    this.storage = opts.storage === undefined ? defaultStorage() : opts.storage;
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
      await this.mergeStash(lines);
      // Everything before the marker of the save the package holds is in the package, except what the marker kept.
      const saved = savedId ? lines.map((l) => l.save).lastIndexOf(savedId) : -1;
      const kept = saved >= 0 && Array.isArray(lines[saved]!.keep) ? (lines[saved]!.keep as Line[]) : [];
      this.carried = [...kept, ...lines.slice(saved + 1)].filter(hasOps).map((l) => ({ seq: 0, line: JSON.stringify(l), ops: l.ops }));
    })().catch((err: unknown) => {
      this.loaded = null; // try again next time
      throw err;
    });
    return this.loaded;
  }

  /**
   * Changes an earlier session stashed on close (see `stashUnflushed`) that
   * the file doesn't have: appended to the file, and to `lines`, after what
   * is there (they were that session's newest). The stash is removed once
   * they are in the file; if appending fails it stays for the next load.
   */
  private async mergeStash(lines: Line[]): Promise<void> {
    const stashed = this.readStash().filter((l) => l.sid !== this.sid);
    if (!stashed.length) return;
    const seen = new Set<string>();
    for (const l of lines) {
      const id = idOf(l);
      if (id) seen.add(id);
      if (Array.isArray(l.keep)) for (const k of l.keep as Line[]) if (k && typeof k === "object" && idOf(k)) seen.add(idOf(k)!);
    }
    const missing = stashed.filter((l) => hasOps(l) && !seen.has(idOf(l) ?? ""));
    lines.push(...missing.map((l) => ({ seq: l.seq, sid: l.sid, ops: l.ops }) as Line));
    try {
      if (missing.length) await appendText(await this.dir(), this.fileName, missing.map((l) => l.raw + "\n").join(""));
      this.dropStashed((l) => l.sid !== this.sid);
    } catch {
      // Still offered now; the stash stays, and its lines are matched by id if they reach the file later.
    }
  }

  /**
   * Copy the changes not yet appended into localStorage, synchronously, for
   * when the page goes away before the asynchronous append finishes (call it
   * on pagehide, then `flush`). Bounded by STASH_MAX_CHARS; never throws.
   */
  stashUnflushed(): void {
    const store = this.storage;
    if (!store) return;
    try {
      const others = this.readStash().filter((l) => l.sid !== this.sid);
      const lines = others.map((l) => l.raw);
      let size = lines.reduce((n, l) => n + l.length + 1, 0);
      for (const e of this.buffer) {
        if (size + e.line.length + 1 > STASH_MAX_CHARS) break; // the oldest ones, in order: never a gap
        lines.push(e.line);
        size += e.line.length + 1;
      }
      if (lines.length) store.setItem(stashKey(this.fileId), lines.join("\n"));
      else store.removeItem(stashKey(this.fileId));
    } catch {
      // Storage full or blocked: the asynchronous append is all there is.
    }
  }

  private readStash(): Stashed[] {
    let text: string | null = null;
    try {
      text = this.storage?.getItem(stashKey(this.fileId)) ?? null;
    } catch {
      return [];
    }
    if (!text) return [];
    const out: Stashed[] = [];
    for (const raw of text.split("\n")) {
      try {
        const l = JSON.parse(raw) as Line;
        if (l && typeof l === "object") out.push({ raw, ...(typeof l.sid === "string" && { sid: l.sid }), ...(typeof l.seq === "number" && { seq: l.seq }), ...(hasOps(l) && { ops: l.ops }) });
      } catch {
        continue;
      }
    }
    return out;
  }

  /** Remove stashed lines matching `drop` (they reached the file, or a save holds them). */
  private dropStashed(drop: (l: Stashed) => boolean): void {
    const store = this.storage;
    if (!store) return;
    try {
      const all = this.readStash();
      if (!all.length) return;
      const keep = all.filter((l) => !drop(l));
      if (keep.length === all.length) return;
      if (keep.length) store.setItem(stashKey(this.fileId), keep.map((l) => l.raw).join("\n"));
      else store.removeItem(stashKey(this.fileId));
    } catch {
      // ignore: matched by id on the next load
    }
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
   * recording and appends what is still batched; its promise settles once
   * that is done (it never rejects: what failed stays in the buffer).
   */
  attach(doc: Document): () => Promise<void> {
    const unsubscribe = doc.subscribe((change) => this.record(change));
    return () => {
      unsubscribe();
      return this.flush().catch(() => {});
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
   * Carried changes the save doesn't hold are copied into the marker, so
   * they stay carried if the tab closes before `clear`: all of them, or
   * with `includesRecovered` (Keep) only those at the indexes in `keep`
   * (edits Keep skipped).
   */
  markSave(saveId: string, through: number, opts: { includesRecovered?: boolean; keep?: readonly number[] } = {}): Promise<void> {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    return this.enqueue(async () => {
      await this.loadNow();
      const keep = opts.includesRecovered ? this.carried.filter((_, i) => opts.keep?.includes(i)) : this.carried;
      const marker = keep.length ? `{"save":${JSON.stringify(saveId)},"keep":[${keep.map((e) => e.line).join(",")}]}` : JSON.stringify({ save: saveId });
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
   * `recovered: true` (they were saved too) or no mark is given (forget all);
   * even then those at the indexes in `keep` stay (edits Keep skipped).
   */
  clear(through = Infinity, opts: { recovered?: boolean; keep?: readonly number[] } = {}): Promise<void> {
    const recovered = opts.recovered ?? through === Infinity;
    return this.enqueue(async () => {
      await this.loadNow();
      this.buffer = this.buffer.filter((e) => e.seq > through);
      this.written = this.written.filter((e) => e.seq > through);
      if (recovered) this.carried = this.carried.filter((_, i) => opts.keep?.includes(i));
      // A stashed copy of what the save holds must not come back as a recovery.
      this.dropStashed((l) => (l.sid === this.sid ? (l.seq ?? 0) <= through : recovered));
      await this.rewrite();
    });
  }

  /** Forget only the changes recovered from an earlier session (the person chose Discard). */
  discardRecovered(): Promise<void> {
    return this.enqueue(async () => {
      await this.loadNow();
      this.carried = [];
      this.dropStashed((l) => l.sid !== this.sid);
      await this.rewrite();
    });
  }

  private record(change: Change): void {
    // Replayed operations come from the journal or a file already; recording them again would double them.
    // Live steps of a drag aren't recorded: the whole drag arrives as one "edit" when it is committed.
    if (change.origin === "replay" || change.origin === "live" || !change.ops.length) return;
    const seq = ++this.seq;
    const ops = change.ops as Operation[];
    this.buffer.push({ seq, ops, line: JSON.stringify({ seq, sid: this.sid, origin: change.origin, label: change.label, ops }) });
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
    if (batch.length) this.dropStashed((l) => l.sid === this.sid && (l.seq ?? 0) <= through);
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

  /**
   * Run `task` after every earlier one for this journal file, from this
   * journal or another one for the same file id (e.g. the journal of an
   * editor that was closed while the file opens again): see location-queue.ts.
   */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    return atLocation({ kind: "opfs", path: ["journal", this.fileId], root: this.root }, task);
  }
}
