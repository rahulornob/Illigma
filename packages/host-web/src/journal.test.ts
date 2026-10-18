import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Document, type Operation } from "@illigma/core";
import { readPackage, writePackage } from "@illigma/format";
import { Autosaver, JOURNAL_FLUSH_MS, opfsBackend, RecoveryJournal } from "./index.js";
import { FakeFileSystem } from "./testing/fake-fs.js";
import { normalized, sampleDoc } from "./test-helpers.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function replay(doc: Document, ops: Operation[]): void {
  for (const op of ops) doc.apply(op);
}

describe("RecoveryJournal", () => {
  it("appends committed changes in batches of at most 250 ms", async () => {
    const fs = new FakeFileSystem();
    const { doc, frame } = sampleDoc();
    const journal = new RecoveryJournal(doc.fileId, fs.root);
    journal.attach(doc);
    const path = `journal/${doc.fileId}.ndjson`;

    doc.transact("Rename", (tx) => tx.set(frame, "name", "A"));
    doc.transact("Resize", (tx) => tx.set(frame, "width", 400));
    await vi.advanceTimersByTimeAsync(JOURNAL_FLUSH_MS - 1);
    expect(fs.readText(path)).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    const lines = fs.readText(path)!.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!)).toMatchObject({ seq: 1, origin: "edit", label: "Rename" });

    doc.undo();
    await vi.advanceTimersByTimeAsync(JOURNAL_FLUSH_MS);
    const undo = JSON.parse(fs.readText(path)!.trim().split("\n")[2]!);
    expect(undo).toMatchObject({ origin: "undo", ops: [{ op: "set", key: "width", value: 393, prev: 400 }] });
  });

  it("includes changes not yet appended in pending()", async () => {
    const fs = new FakeFileSystem();
    const { doc, frame } = sampleDoc();
    const journal = new RecoveryJournal(doc.fileId, fs.root);
    journal.attach(doc);
    doc.transact("Rename", (tx) => tx.set(frame, "name", "A"));
    expect(await journal.pending()).toEqual([{ op: "set", id: frame, key: "name", value: "A", prev: "Sign up" }]);
  });

  it("clear() forgets everything; clear(checkpoint) keeps later changes", async () => {
    const fs = new FakeFileSystem();
    const { doc, frame } = sampleDoc();
    const journal = new RecoveryJournal(doc.fileId, fs.root);
    journal.attach(doc);
    doc.transact("Rename", (tx) => tx.set(frame, "name", "A"));
    await journal.flush();
    const mark = journal.checkpoint();
    doc.transact("Rename", (tx) => tx.set(frame, "name", "B"));
    await journal.clear(mark);
    expect(await journal.pending()).toEqual([{ op: "set", id: frame, key: "name", value: "B", prev: "A" }]);
    await journal.flush();
    expect(fs.readText(`journal/${doc.fileId}.ndjson`)!.trim().split("\n")).toHaveLength(1);
    await journal.clear();
    expect(await journal.pending()).toEqual([]);
  });

  it("stops recording when detached, appending what was batched", async () => {
    const fs = new FakeFileSystem();
    const { doc, frame } = sampleDoc();
    const journal = new RecoveryJournal(doc.fileId, fs.root);
    const detach = journal.attach(doc);
    doc.transact("Rename", (tx) => tx.set(frame, "name", "A"));
    detach();
    doc.transact("Rename", (tx) => tx.set(frame, "name", "B"));
    await vi.advanceTimersByTimeAsync(0);
    expect(await new RecoveryJournal(doc.fileId, fs.root).pending()).toHaveLength(1);
  });

  it("skips a torn last line", async () => {
    const fs = new FakeFileSystem();
    const op = { op: "set", id: "x", key: "name", value: "A", prev: "B" };
    fs.writeText("journal/f1.ndjson", `${JSON.stringify({ seq: 1, ops: [op] })}\n{"seq":2,"ops":[{"op":"se`);
    expect(await new RecoveryJournal("f1", fs.root).pending()).toEqual([op]);
  });

  it("recovers unsaved work after a crash", async () => {
    const fs = new FakeFileSystem();
    const { doc, page, frame } = sampleDoc();
    const backend = opfsBackend(doc.fileId, doc.name, fs.root);
    const journal = new RecoveryJournal(doc.fileId, fs.root);
    journal.attach(doc);
    const saver = new Autosaver(doc, backend, { journal });
    await backend.write(writePackage(doc.toFile())); // the file as first created
    await journal.clear();

    // Some work gets saved…
    doc.transact("Rename", (tx) => tx.set(frame, "name", "Welcome"));
    await saver.flushNow();
    // …then more work, which the journal has but the file doesn't.
    doc.transact("Add", (tx) => {
      const card = tx.create("FRAME", page, { name: "Card", x: 500 });
      tx.create("RECTANGLE", card, { width: 40 });
      tx.move(frame, card);
    });
    doc.transact("Delete text", (tx) => tx.delete(doc.children(frame)[0]!.id));
    doc.transact("Resize", (tx) => tx.set(frame, "width", 320));
    doc.undo();
    doc.transact("Recolor", (tx) => tx.set(frame, "opacity", 0.5));
    await vi.advanceTimersByTimeAsync(JOURNAL_FLUSH_MS);
    const expected = normalized(doc.toFile());
    saver.dispose(); // crash: nothing else runs

    // Next launch.
    const reopened = Document.fromFile(readPackage(await opfsBackend(doc.fileId, doc.name, fs.root).read()));
    expect(normalized(reopened.toFile())).not.toEqual(expected);
    replay(reopened, await new RecoveryJournal(doc.fileId, fs.root).pending());
    expect(normalized(reopened.toFile())).toEqual(expected);
  });
});
