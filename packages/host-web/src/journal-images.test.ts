// QC round 7: the recovery journal keeps a copy of every image the document adds, ahead of the change lines that
// use it, so an image added after the last save survives a crash.
import { describe, expect, it } from "vitest";
import { writePackage } from "@illigma/format";
import { Autosaver, opfsBackend, RecoveryJournal } from "./index.js";
import { FakeFileSystem } from "./testing/fake-fs.js";
import { sampleDoc } from "./test-helpers.js";

const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));

describe("image copies in the recovery journal", () => {
  it("copies an added image before the line that uses it, offers it after a crash, and drops it once saved", async () => {
    const fs = new FakeFileSystem();
    const { doc, frame } = sampleDoc();
    const backend = opfsBackend(doc.fileId, doc.name, fs.root);
    await backend.write(writePackage(doc.toFile()));
    const j1 = new RecoveryJournal(doc.fileId, fs.root, { storage: null });
    j1.attach(doc);
    const hash = doc.addImage(PNG);
    doc.transact("Image fill", (tx) => tx.set(frame, "fills", [{ type: "IMAGE", visible: true, imageHash: hash, scaleMode: "FILL" }]));
    await j1.flush();
    // The copy was written before the change line.
    const copy = `journal/${doc.fileId}.images/${hash}`;
    const writes = fs.log.filter((op) => op.kind === "close").map((op) => op.path);
    expect(writes.indexOf(copy)).toBeGreaterThanOrEqual(0);
    expect(writes.indexOf(copy)).toBeLessThan(writes.indexOf(`journal/${doc.fileId}.ndjson`));
    expect(fs.readBytes(copy)).toEqual(PNG);

    // The tab dies here. The next session gets the change and the image.
    const j2 = new RecoveryJournal(doc.fileId, fs.root, { storage: null });
    await j2.load(backend.saveId);
    expect((await j2.recovered()).flat()).toEqual([expect.objectContaining({ key: "fills" })]);
    expect(await j2.recoveredImages()).toEqual(new Map([[hash, PNG]]));
    // Once the recovered changes are saved, the copy goes.
    await j2.clear(j2.checkpoint(), { recovered: true });
    expect(fs.exists(copy)).toBe(false);
  });

  it("removes this session's copy only after a save that came after a later change", async () => {
    const fs = new FakeFileSystem();
    const { doc, frame } = sampleDoc();
    const backend = opfsBackend(doc.fileId, doc.name, fs.root);
    await backend.write(writePackage(doc.toFile()));
    const journal = new RecoveryJournal(doc.fileId, fs.root, { storage: null });
    await journal.load(backend.saveId);
    journal.attach(doc);
    const saver = new Autosaver(doc, backend, { journal, delayMs: 1 });
    doc.transact("Rename", (tx) => tx.set(frame, "name", "A"));
    const before = journal.checkpoint();
    const hash = doc.addImage(PNG);
    await journal.flush();
    const copy = `journal/${doc.fileId}.images/${hash}`;
    expect(fs.exists(copy)).toBe(true);
    // A save through a mark taken before the image was added doesn't hold it for sure: the copy stays.
    await journal.clear(before);
    expect(fs.exists(copy)).toBe(true);
    doc.transact("Use it", (tx) => tx.set(frame, "fills", [{ type: "IMAGE", visible: true, imageHash: hash, scaleMode: "FIT" }]));
    await saver.flushNow();
    expect(saver.status.state).toBe("saved");
    expect(fs.exists(copy)).toBe(false);
    expect(fs.exists(`files/${doc.fileId}/images/${hash}.png`)).toBe(true);
    saver.dispose();
  });

  it("holds change lines back while an image copy can't be written, so no line names an image the journal lacks", async () => {
    const fs = new FakeFileSystem();
    const { doc, frame } = sampleDoc();
    const journal = new RecoveryJournal(doc.fileId, fs.root, { storage: null });
    journal.attach(doc);
    fs.failWhen = (op) => op.path.includes(".images/");
    const hash = doc.addImage(PNG);
    doc.transact("Use it", (tx) => tx.set(frame, "fills", [{ type: "IMAGE", visible: true, imageHash: hash, scaleMode: "FIT" }]));
    await expect(journal.flush()).rejects.toThrow();
    expect(fs.readText(`journal/${doc.fileId}.ndjson`) ?? "").not.toContain(hash);
    fs.failWhen = null;
    await journal.flush();
    expect(fs.readText(`journal/${doc.fileId}.ndjson`)).toContain(hash);
    expect(fs.readBytes(`journal/${doc.fileId}.images/${hash}`)).toEqual(PNG);
  });

  it("Discard drops the carried image copies", async () => {
    const fs = new FakeFileSystem();
    const { doc, frame } = sampleDoc();
    const backend = opfsBackend(doc.fileId, doc.name, fs.root);
    await backend.write(writePackage(doc.toFile()));
    const j1 = new RecoveryJournal(doc.fileId, fs.root, { storage: null });
    j1.attach(doc);
    const hash = doc.addImage(PNG);
    doc.transact("Use it", (tx) => tx.set(frame, "fills", [{ type: "IMAGE", visible: true, imageHash: hash, scaleMode: "FIT" }]));
    await j1.flush();
    const j2 = new RecoveryJournal(doc.fileId, fs.root, { storage: null });
    await j2.load(backend.saveId);
    await j2.discardRecovered();
    expect(fs.exists(`journal/${doc.fileId}.images/${hash}`)).toBe(false);
  });
});
