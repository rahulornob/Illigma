// Regression tests for the recovery journal across sessions (QC review): a
// new session must never erase what an earlier one left undecided, and
// changes that already reached the file must not be offered again.
import { afterEach, describe, expect, it, vi } from "vitest";
import { Document } from "@illigma/core";
import { readPackage, writePackage } from "@illigma/format";
import { acquireFileLock, Autosaver, opfsBackend, RecoveryJournal } from "./index.js";
import { FakeFileSystem } from "./testing/fake-fs.js";
import { sampleDoc } from "./test-helpers.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Session 1 renames the frame, the journal gets it, then the tab dies before saving. */
async function crashedSession() {
  const fs = new FakeFileSystem();
  const { doc, page, frame } = sampleDoc();
  const backend = opfsBackend(doc.fileId, doc.name, fs.root);
  await backend.write(writePackage(doc.toFile()));
  const j1 = new RecoveryJournal(doc.fileId, fs.root);
  j1.attach(doc);
  doc.transact("Rename", (tx) => tx.set(frame, "name", "IMPORTANT"));
  await j1.flush();
  return { fs, doc, page, frame };
}

/** What the next launch does: read the package, then the journal against the package's save id. */
async function reopen(fs: FakeFileSystem, fileId: string) {
  const backend = opfsBackend(fileId, "T", fs.root);
  const doc = Document.fromFile(readPackage(await backend.read()));
  const journal = new RecoveryJournal(fileId, fs.root);
  await journal.load(backend.saveId);
  return { doc, backend, journal, recovered: await journal.recovered() };
}

describe("recovered changes survive the next session until the person decides", () => {
  it("an autosave in the new session keeps the undecided recovered lines (proof A)", async () => {
    const { fs, doc, page } = await crashedSession();
    const s2 = await reopen(fs, doc.fileId);
    expect(s2.recovered).toHaveLength(1);

    // Even if something saves before Keep/Discard, the recovered line stays.
    s2.journal.attach(s2.doc);
    const saver = new Autosaver(s2.doc, s2.backend, { journal: s2.journal });
    s2.doc.transact("Rename page", (tx) => tx.set(page, "name", "P1b"));
    await saver.flushNow();
    expect(saver.status.state).toBe("saved");

    // The tab closes before the person chose: the rename is still offered.
    const s3 = await reopen(fs, doc.fileId);
    expect(s3.recovered.flat()).toEqual([expect.objectContaining({ op: "set", key: "name", value: "IMPORTANT" })]);
  });

  it("discardRecovered drops only the carried lines; this session's stay", async () => {
    const { fs, doc, frame } = await crashedSession();
    const s2 = await reopen(fs, doc.fileId);
    s2.journal.attach(s2.doc);
    s2.doc.transact("Resize", (tx) => tx.set(frame, "width", 10));
    await s2.journal.flush();
    await s2.journal.discardRecovered();
    expect(s2.journal.hasRecovered).toBe(false);
    expect(await s2.journal.pending()).toEqual([expect.objectContaining({ key: "width", value: 10 })]);
    const s3 = await reopen(fs, doc.fileId);
    expect(s3.recovered.flat()).toEqual([expect.objectContaining({ key: "width", value: 10 })]);
  });

  it("clear(mark) keeps carried lines; clear() and clear(mark, { recovered }) remove them", async () => {
    const { fs, doc } = await crashedSession();
    const j = new RecoveryJournal(doc.fileId, fs.root);
    await j.clear(j.checkpoint());
    expect(await j.recovered()).toHaveLength(1);
    await j.clear(j.checkpoint(), { recovered: true });
    expect(await new RecoveryJournal(doc.fileId, fs.root).recovered()).toEqual([]);

    const again = await crashedSession();
    const k = new RecoveryJournal(again.doc.fileId, again.fs.root);
    await k.clear();
    expect(await new RecoveryJournal(again.doc.fileId, again.fs.root).recovered()).toEqual([]);
  });

  it("changes a save already holds are not offered again, even if the tab died before clearing", async () => {
    const fs = new FakeFileSystem();
    const { doc, frame } = sampleDoc();
    const backend = opfsBackend(doc.fileId, doc.name, fs.root);
    await backend.write(writePackage(doc.toFile()));
    const journal = new RecoveryJournal(doc.fileId, fs.root);
    journal.attach(doc);
    doc.transact("Rename", (tx) => tx.set(frame, "name", "Saved"));
    // A save: marker, package write... and the tab dies before journal.clear(mark).
    const mark = journal.checkpoint();
    await journal.markSave("save-1", mark);
    await backend.write(writePackage(doc.toFile()), { saveId: "save-1" });
    doc.transact("Resize", (tx) => tx.set(frame, "width", 7));
    await journal.flush();

    const s2 = await reopen(fs, doc.fileId);
    expect(s2.doc.get(frame)!.name).toBe("Saved");
    expect(s2.recovered.flat()).toEqual([expect.objectContaining({ key: "width", value: 7 })]);
  });

  it("a save that never reached the package does not hide its changes", async () => {
    const fs = new FakeFileSystem();
    const { doc, frame } = sampleDoc();
    const backend = opfsBackend(doc.fileId, doc.name, fs.root);
    await backend.write(writePackage(doc.toFile()), { saveId: "save-0" });
    const journal = new RecoveryJournal(doc.fileId, fs.root);
    journal.attach(doc);
    doc.transact("Rename", (tx) => tx.set(frame, "name", "Lost?"));
    await journal.markSave("save-1", journal.checkpoint());
    fs.failWhen = (op) => op.kind === "close" && !op.path.startsWith("journal/");
    await expect(backend.write(writePackage(doc.toFile()), { saveId: "save-1" })).rejects.toThrow();
    fs.failWhen = null;

    const s2 = await reopen(fs, doc.fileId);
    expect(s2.recovered.flat()).toEqual([expect.objectContaining({ value: "Lost?" })]);
  });

  it("markSave doesn't vouch for undecided recovered changes unless the save includes them", async () => {
    const { fs, doc } = await crashedSession();
    const s2 = await reopen(fs, doc.fileId);
    await s2.journal.markSave("x", s2.journal.checkpoint());
    await s2.backend.write(writePackage(s2.doc.toFile()), { saveId: "x" });
    expect((await reopen(fs, doc.fileId)).recovered).toHaveLength(1);

    await s2.journal.markSave("y", s2.journal.checkpoint(), { includesRecovered: true });
    await s2.backend.write(writePackage(s2.doc.toFile()), { saveId: "y" });
    expect((await reopen(fs, doc.fileId)).recovered).toEqual([]);
  });

  it("does not journal replayed operations", async () => {
    const { fs, doc, frame } = await crashedSession();
    const s2 = await reopen(fs, doc.fileId);
    s2.journal.attach(s2.doc);
    s2.doc.replay((await s2.journal.recovered()).flat());
    expect(s2.doc.get(frame)!.name).toBe("IMPORTANT");
    expect(s2.journal.checkpoint()).toBe(0);
    await s2.journal.flush();
    expect(await s2.journal.pending()).toHaveLength(1); // only the carried line
  });
});

describe("acquireFileLock", () => {
  function fakeLocks() {
    const held = new Set<string>();
    return {
      async request(name: string, _opts: { ifAvailable: boolean }, cb: (lock: unknown) => Promise<void> | void) {
        if (held.has(name)) return cb(null);
        held.add(name);
        try {
          return await cb({ name });
        } finally {
          held.delete(name);
        }
      },
    };
  }

  it("lets one tab edit a file; others get null until it is released", async () => {
    vi.stubGlobal("navigator", { locks: fakeLocks() });
    const a = await acquireFileLock("f1");
    expect(a).not.toBeNull();
    expect(await acquireFileLock("f1")).toBeNull();
    expect(await acquireFileLock("f2")).not.toBeNull();
    a!.release();
    await Promise.resolve();
    await Promise.resolve();
    expect(await acquireFileLock("f1")).not.toBeNull();
  });

  it("grants a no-op lock where Web Locks don't exist", async () => {
    vi.stubGlobal("navigator", {});
    const lock = await acquireFileLock("f1");
    expect(lock).not.toBeNull();
    lock!.release();
  });
});
