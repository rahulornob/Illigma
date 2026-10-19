// QC round 7: images survive crashes, undo and damaged copies. Saves never remove image files; opening a file with
// no recovered edits pending removes the ones nothing uses.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Document } from "@illigma/core";
import { writePackage } from "@illigma/format";
import { Autosaver, opfsBackend, RecoveryJournal } from "@illigma/host-web";
import { FakeFileSystem, installFakeOpfs } from "@illigma/host-web/testing";
import { closeSession, keepRecovered, openStoredFile } from "./files";

const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));

let fs: FakeFileSystem;
let restore: () => void;

beforeEach(() => {
  fs = new FakeFileSystem();
  restore = installFakeOpfs(fs);
});

afterEach(() => {
  restore();
  vi.unstubAllGlobals();
});

function base() {
  const doc = new Document("T");
  const page = doc.transact("p", (tx) => tx.addPage("P1"));
  const frame = doc.transact("f", (tx) => tx.create("FRAME", page, { name: "F", width: 100, height: 100 }));
  return { doc, page, frame };
}

const imagePath = (fileId: string, hash: string) => `files/${fileId}/images/${hash}.png`;

describe("images across crashes (QC round 7)", () => {
  it("delete an image layer, autosave, undo, crash: Keep brings the image back", async () => {
    const { doc, frame } = base();
    const hash = doc.addImage(PNG);
    const photo = doc.transact("Photo", (tx) => tx.create("RECTANGLE", frame, { name: "Photo", fills: [{ type: "IMAGE", visible: true, imageHash: hash, scaleMode: "FILL" }] }));
    const backend = opfsBackend(doc.fileId, "T");
    await backend.write(writePackage(doc.toFile()));
    const journal = new RecoveryJournal(doc.fileId);
    await journal.load(backend.saveId);
    journal.attach(doc);
    const saver = new Autosaver(doc, backend, { journal, delayMs: 1 });

    doc.transact("Delete", (tx) => tx.delete(photo));
    await saver.flushNow();
    expect(saver.status.state).toBe("saved");
    // The save keeps the image file: the document still holds the bytes, and undo may use them again.
    expect(fs.exists(imagePath(doc.fileId, hash))).toBe(true);
    doc.undo();
    await journal.flush();
    saver.dispose(); // the tab dies before the next save

    const s = await openStoredFile(doc.fileId, "T");
    expect(s.recovered).toHaveLength(1);
    expect(s.doc.image(hash)).toEqual(PNG); // unused on disk, but recovered edits may need it
    const kept = await keepRecovered(s);
    expect(kept.doc.get(photo)?.fills[0]).toMatchObject({ imageHash: hash });
    expect(kept.doc.image(hash)).toEqual(PNG);
    expect(fs.readBytes(imagePath(doc.fileId, hash))).toEqual(PNG);
    await closeSession(kept);

    // Opened again: the image is in use, nothing is collected.
    const again = await openStoredFile(doc.fileId, "T");
    expect(again.doc.image(hash)).toEqual(PNG);
    expect(fs.exists(imagePath(doc.fileId, hash))).toBe(true);
    await closeSession(again);
  });

  it("add an image after the last save, crash before the next: Keep has the image (from the journal's copy)", async () => {
    const { doc, frame } = base();
    const backend = opfsBackend(doc.fileId, "T");
    await backend.write(writePackage(doc.toFile()));
    const journal = new RecoveryJournal(doc.fileId);
    await journal.load(backend.saveId);
    journal.attach(doc);
    const hash = doc.addImage(PNG);
    doc.transact("Image fill", (tx) => tx.set(frame, "fills", [{ type: "IMAGE", visible: true, imageHash: hash, scaleMode: "FILL" }]));
    await journal.flush(); // the tab dies before the autosave
    expect(fs.exists(imagePath(doc.fileId, hash))).toBe(false);

    const s = await openStoredFile(doc.fileId, "T");
    expect(s.recovered).toHaveLength(1);
    expect(s.doc.image(hash)).toEqual(PNG);
    const kept = await keepRecovered(s);
    expect(kept.doc.get(frame)?.fills[0]).toMatchObject({ imageHash: hash });
    expect(fs.readBytes(imagePath(doc.fileId, hash))).toEqual(PNG);
    await closeSession(kept);
    // Saved: the journal's copy is gone.
    expect(fs.paths(`journal/${doc.fileId}.images/`)).toEqual([]);
  });

  it("opening with no recovered edits removes image files nothing uses, and only those", async () => {
    const { doc, frame } = base();
    const used = doc.addImage(PNG);
    const spare = Uint8Array.from([...PNG, 1]);
    const unused = doc.addImage(spare);
    doc.transact("Image fill", (tx) => tx.set(frame, "fills", [{ type: "IMAGE", visible: true, imageHash: used, scaleMode: "FILL" }]));
    await opfsBackend(doc.fileId, "T").write(writePackage(doc.toFile()));
    expect(fs.exists(imagePath(doc.fileId, unused))).toBe(true);
    fs.writeText(`files/${doc.fileId}/images/notes.txt`, "mine");

    const s = await openStoredFile(doc.fileId, "T");
    expect(s.recovered).toEqual([]);
    expect(s.doc.image(unused)).toBeUndefined();
    expect(fs.exists(imagePath(doc.fileId, unused))).toBe(false);
    expect(fs.exists(imagePath(doc.fileId, used))).toBe(true);
    expect(fs.readText(`files/${doc.fileId}/images/notes.txt`)).toBe("mine");
    await closeSession(s);
  });
});

describe("what couldn't be opened is reported (QC round 7, tester)", () => {
  it("a damaged image, a missing one and a stray file reach the session's warnings; the rest opens", async () => {
    const { doc, frame } = base();
    const hash = doc.addImage(PNG);
    const missing = "ab".repeat(32);
    doc.transact("Photos", (tx) => {
      tx.create("RECTANGLE", frame, { name: "Photo", fills: [{ type: "IMAGE", visible: true, imageHash: hash, scaleMode: "FILL" }] });
      tx.create("RECTANGLE", frame, { name: "Gone", fills: [{ type: "IMAGE", visible: true, imageHash: missing, scaleMode: "FILL" }] });
    });
    await opfsBackend(doc.fileId, "T").write(writePackage(doc.toFile()));
    const damaged = Uint8Array.from(PNG);
    damaged[damaged.length - 20] = (damaged[damaged.length - 20] ?? 0) ^ 0xff;
    fs.writeBytes(imagePath(doc.fileId, hash), damaged);
    fs.writeText(`files/${doc.fileId}/images/notes.txt`, "hi");

    const s = await openStoredFile(doc.fileId, "T");
    expect(s.doc.get(frame)).toBeTruthy();
    const text = (s.warnings ?? []).join("\n");
    expect(text).toMatch(new RegExp(`images/${hash}\\.png is damaged`));
    expect(text).toMatch(/Image (ab){6}… is missing/);
    expect(text).toMatch(/images\/notes\.txt is not an image file/);
    await closeSession(s);

    // A sound file opens with nothing to report.
    const clean = new Document("Clean");
    clean.transact("p", (tx) => tx.addPage("P1"));
    await opfsBackend(clean.fileId, "Clean").write(writePackage(clean.toFile()));
    const ok = await openStoredFile(clean.fileId, "Clean");
    expect(ok.warnings).toBeUndefined();
    await closeSession(ok);
  });
});
