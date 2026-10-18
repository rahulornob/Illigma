import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writePackage } from "@illigma/format";
import { Autosaver, JOURNAL_FLUSH_MS, opfsBackend, RecoveryJournal, STASH_MAX_CHARS, stashKey, type StashStorage } from "./index.js";
import { FakeFileSystem } from "./testing/fake-fs.js";
import { sampleDoc } from "./test-helpers.js";

/** localStorage stand-in. `broken` makes every call throw (storage disabled or full). */
class FakeStorage implements StashStorage {
  readonly map = new Map<string, string>();
  broken = false;
  getItem(k: string): string | null {
    if (this.broken) throw new Error("blocked");
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    if (this.broken) throw new Error("QuotaExceededError");
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    if (this.broken) throw new Error("blocked");
    this.map.delete(k);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const rename = (name: string, prev: string, id: string) => ({ op: "set", id, key: "name", value: name, prev });

describe("RecoveryJournal stash (tab closed before the batch was appended)", () => {
  it("offers changes made in the last 250 ms after the tab closed, and moves them into the file", async () => {
    const fs = new FakeFileSystem();
    const storage = new FakeStorage();
    const { doc, frame } = sampleDoc();
    const journal = new RecoveryJournal(doc.fileId, fs.root, { storage });
    journal.attach(doc);
    doc.transact("Rename", (tx) => tx.set(frame, "name", "A"));
    await vi.advanceTimersByTimeAsync(JOURNAL_FLUSH_MS); // appended
    doc.transact("Rename", (tx) => tx.set(frame, "name", "B"));
    doc.transact("Rename", (tx) => tx.set(frame, "name", "C"));
    journal.stashUnflushed(); // pagehide; the page goes away before the append runs
    expect(storage.map.get(stashKey(doc.fileId))!.split("\n")).toHaveLength(2);

    const next = new RecoveryJournal(doc.fileId, fs.root, { storage });
    await next.load();
    expect(await next.recovered()).toEqual([[rename("A", "Sign up", frame)], [rename("B", "A", frame)], [rename("C", "B", frame)]]);
    expect(storage.map.has(stashKey(doc.fileId))).toBe(false);
    // In the journal file now: a third session still finds them without the stash.
    expect(await new RecoveryJournal(doc.fileId, fs.root, { storage }).recovered()).toHaveLength(3);
  });

  it("drops the stash once the append it stood in for finishes", async () => {
    const fs = new FakeFileSystem();
    const storage = new FakeStorage();
    const { doc, frame } = sampleDoc();
    const journal = new RecoveryJournal(doc.fileId, fs.root, { storage });
    journal.attach(doc);
    doc.transact("Rename", (tx) => tx.set(frame, "name", "A"));
    journal.stashUnflushed();
    expect(storage.map.has(stashKey(doc.fileId))).toBe(true);
    await journal.flush();
    expect(storage.map.has(stashKey(doc.fileId))).toBe(false);
  });

  it("never doubles a change that reached the file before the stash could be dropped", async () => {
    const fs = new FakeFileSystem();
    const storage = new FakeStorage();
    const { doc, frame } = sampleDoc();
    const journal = new RecoveryJournal(doc.fileId, fs.root, { storage });
    journal.attach(doc);
    doc.transact("Rename", (tx) => tx.set(frame, "name", "A"));
    doc.transact("Rename", (tx) => tx.set(frame, "name", "B"));
    journal.stashUnflushed();
    const stash = storage.map.get(stashKey(doc.fileId))!;
    await journal.flush();
    storage.map.set(stashKey(doc.fileId), stash); // the page died between the append and dropping the stash
    doc.transact("Rename", (tx) => tx.set(frame, "name", "C"));
    journal.stashUnflushed(); // C only in the stash

    const recovered = await new RecoveryJournal(doc.fileId, fs.root, { storage }).recovered();
    expect(recovered).toEqual([[rename("A", "Sign up", frame)], [rename("B", "A", frame)], [rename("C", "B", frame)]]);
  });

  it("never offers stashed changes a save already holds", async () => {
    const fs = new FakeFileSystem();
    const storage = new FakeStorage();
    const { doc, frame } = sampleDoc();
    const backend = opfsBackend(doc.fileId, doc.name, fs.root);
    const journal = new RecoveryJournal(doc.fileId, fs.root, { storage });
    journal.attach(doc);
    const saver = new Autosaver(doc, backend, { journal });
    doc.transact("Rename", (tx) => tx.set(frame, "name", "A"));
    journal.stashUnflushed();
    await saver.flushNow(); // marks, saves, clears: the stash goes with the journal lines
    expect(storage.map.has(stashKey(doc.fileId))).toBe(false);
    expect(await new RecoveryJournal(doc.fileId, fs.root, { storage }).recovered()).toEqual([]);

    saver.dispose();

    // The page died after a save was written but before the journal was cleared: the stash outlives the save,
    // and the save marker vouches for the line it held.
    doc.transact("Rename", (tx) => tx.set(frame, "name", "B"));
    journal.stashUnflushed();
    const stashB = storage.map.get(stashKey(doc.fileId))!;
    await journal.markSave("save-2", journal.checkpoint());
    await backend.write(writePackage(doc.toFile()), { saveId: "save-2" });
    storage.map.set(stashKey(doc.fileId), stashB);
    const next = new RecoveryJournal(doc.fileId, fs.root, { storage });
    await next.load(backend.saveId);
    expect(await next.recovered()).toEqual([]);
    expect(storage.map.has(stashKey(doc.fileId))).toBe(false);
  });

  it("keeps the stash bounded, oldest changes first, and never throws when storage fails", async () => {
    const fs = new FakeFileSystem();
    const storage = new FakeStorage();
    const { doc, frame } = sampleDoc();
    const journal = new RecoveryJournal(doc.fileId, fs.root, { storage });
    journal.attach(doc);
    const big = "x".repeat(STASH_MAX_CHARS / 4);
    for (let i = 0; i < 6; i++) doc.transact("Rename", (tx) => tx.set(frame, "name", `${i}${big}`));
    journal.stashUnflushed();
    const text = storage.map.get(stashKey(doc.fileId))!;
    expect(text.split("\n").map((l) => (JSON.parse(l) as { seq: number }).seq)).toEqual([1, 2]);
    expect(text.length).toBeLessThanOrEqual(STASH_MAX_CHARS);

    storage.broken = true;
    expect(() => journal.stashUnflushed()).not.toThrow();
    await expect(journal.flush()).resolves.toBeUndefined();
  });
});
