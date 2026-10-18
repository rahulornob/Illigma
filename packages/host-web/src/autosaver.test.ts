import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readPackage, type FileTree } from "@illigma/format";
import { Autosaver, opfsBackend, RecoveryJournal, RETRY_MS, type Backend, type SaveState } from "./index.js";
import { FakeFileSystem } from "./testing/fake-fs.js";
import { sampleDoc } from "./test-helpers.js";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-18T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

function setup(opts: { delayMs?: number } = {}) {
  const fs = new FakeFileSystem();
  const { doc, frame } = sampleDoc();
  const inner = opfsBackend(doc.fileId, doc.name, fs.root);
  const writes: FileTree[] = [];
  const backend: Backend = {
    label: inner.label,
    kind: inner.kind,
    read: () => inner.read(),
    write: async (tree) => {
      writes.push(tree);
      await inner.write(tree);
    },
  };
  const saver = new Autosaver(doc, backend, opts);
  const states: SaveState[] = [];
  saver.onStatus((s) => states.push(s.state));
  const rename = (name: string) => doc.transact("Rename", (tx) => tx.set(frame, "name", name));
  return { fs, doc, frame, inner, saver, writes, states, rename };
}

describe("Autosaver", () => {
  it("saves once, about 1 second after the last change", async () => {
    const { saver, writes, rename, inner } = setup();
    expect(saver.status.state).toBe("saved");

    rename("A");
    await vi.advanceTimersByTimeAsync(500);
    rename("B");
    await vi.advanceTimersByTimeAsync(900);
    rename("C");
    await vi.advanceTimersByTimeAsync(999);
    expect(writes).toHaveLength(0);
    expect(saver.status.state).toBe("unsaved");

    await vi.advanceTimersByTimeAsync(1);
    expect(writes).toHaveLength(1);
    expect(saver.status).toEqual({ state: "saved", savedAt: Date.now() });
    const file = readPackage(await inner.read());
    expect(file.nodes.some((n) => n.name === "C")).toBe(true);
  });

  it("never writes a drag halfway: it waits until the live edit ends", async () => {
    const { doc, frame, saver, writes, rename, inner } = setup();
    rename("A");
    const drag = doc.beginLive("Move layer");
    drag.update((tx) => tx.set(frame, "x", 40));
    await vi.advanceTimersByTimeAsync(5000);
    expect(writes).toHaveLength(0);
    expect(saver.status.state).toBe("unsaved");
    drag.cancel();
    await vi.advanceTimersByTimeAsync(1000);
    expect(writes).toHaveLength(1);
    const file = readPackage(await inner.read());
    expect(file.nodes.find((n) => n.id === frame)).toMatchObject({ name: "A", x: 0 });
  });

  it("honours a custom delay", async () => {
    const { writes, rename } = setup({ delayMs: 200 });
    rename("A");
    await vi.advanceTimersByTimeAsync(200);
    expect(writes).toHaveLength(1);
  });

  it("goes unsaved → saving → saved", async () => {
    const { states, rename } = setup();
    rename("A");
    rename("B");
    await vi.advanceTimersByTimeAsync(1000);
    expect(states).toEqual(["unsaved", "saving", "saved"]);
  });

  it("stays unsaved when an edit lands during a save, then saves again", async () => {
    const { saver, states, writes, rename, inner } = setup();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const write = inner.write.bind(inner);
    vi.spyOn(inner, "write").mockImplementationOnce(async (tree) => {
      await gate;
      await write(tree);
    });
    rename("A");
    await vi.advanceTimersByTimeAsync(1000);
    expect(saver.status.state).toBe("saving");
    rename("B");
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(saver.status.state).toBe("unsaved");
    expect(saver.status.savedAt).toBe(Date.now());
    await vi.advanceTimersByTimeAsync(1000);
    expect(writes).toHaveLength(2);
    expect(states).toEqual(["unsaved", "saving", "unsaved", "saving", "saved"]);
    expect(readPackage(await inner.read()).nodes.some((n) => n.name === "B")).toBe(true);
  });

  it("reports a failed save plainly and retries every 30 seconds", async () => {
    const { fs, saver, writes, rename, inner } = setup();
    fs.failWhen = (op) => (op.kind === "close" ? new DOMException("Quota", "QuotaExceededError") : false);
    rename("A");
    await vi.advanceTimersByTimeAsync(1000);
    expect(saver.status.state).toBe("error");
    expect(saver.status.message).toMatch(/^Couldn't save: there isn't enough storage space left\./);
    expect(saver.status.message).toMatch(/Retrying in 30 seconds/);

    await vi.advanceTimersByTimeAsync(RETRY_MS - 1);
    expect(writes).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(writes).toHaveLength(2);
    expect(saver.status.state).toBe("error");

    fs.failWhen = null;
    await vi.advanceTimersByTimeAsync(RETRY_MS);
    expect(writes).toHaveLength(3);
    expect(saver.status.state).toBe("saved");
    expect(readPackage(await inner.read()).nodes.some((n) => n.name === "A")).toBe(true);
  });

  it("keeps showing the error while new edits arrive", async () => {
    const { fs, saver, rename } = setup();
    fs.failWhen = (op) => op.kind === "close";
    rename("A");
    await vi.advanceTimersByTimeAsync(1000);
    rename("B");
    expect(saver.status.state).toBe("error");
  });

  it("reports a document that can't be serialized", async () => {
    const fs = new FakeFileSystem();
    const { doc, frame } = sampleDoc();
    const saver = new Autosaver(doc, opfsBackend(doc.fileId, doc.name, fs.root), {
      serialize: () => {
        throw new Error("Page 1 has a broken layer.");
      },
    });
    doc.transact("Rename", (tx) => tx.set(frame, "name", "X"));
    await saver.flushNow();
    expect(saver.status).toMatchObject({ state: "error", message: expect.stringMatching(/^Couldn't save: Page 1 has a broken layer\./) });
  });

  it("flushNow saves immediately, and does nothing when already saved", async () => {
    const { saver, writes, rename } = setup();
    await saver.flushNow();
    expect(writes).toHaveLength(0);
    rename("A");
    await saver.flushNow();
    expect(writes).toHaveLength(1);
    expect(saver.status.state).toBe("saved");
    await vi.advanceTimersByTimeAsync(5000);
    expect(writes).toHaveLength(1); // the debounce timer was cancelled
  });

  it("stops after dispose", async () => {
    const { saver, writes, rename } = setup();
    rename("A");
    saver.dispose();
    await vi.advanceTimersByTimeAsync(5000);
    rename("B");
    await vi.advanceTimersByTimeAsync(5000);
    expect(writes).toHaveLength(0);
  });

  it("clears the journal up to what was saved", async () => {
    const fs = new FakeFileSystem();
    const { doc, frame } = sampleDoc();
    const journal = new RecoveryJournal(doc.fileId, fs.root);
    journal.attach(doc);
    const saver = new Autosaver(doc, opfsBackend(doc.fileId, doc.name, fs.root), { journal });
    doc.transact("Rename", (tx) => tx.set(frame, "name", "A"));
    await vi.advanceTimersByTimeAsync(300);
    expect(await journal.pending()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(saver.status.state).toBe("saved");
    expect(await journal.pending()).toEqual([]);
  });
});
