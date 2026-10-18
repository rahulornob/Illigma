// Image files (binary) in saved packages: written as bytes, read back as bytes, written once, never removed by a save
// (only by collectImages, at open), and never removed when Illigma couldn't load them.
import { describe, expect, it } from "vitest";
import { Document } from "@illigma/core";
import { readPackage, readPackageWithReport, writePackage, type FileTree } from "@illigma/format";
import { COMMIT_FILE, folderBackend, opfsBackend, TEMP_SUFFIX } from "./index.js";
import { FakeFileSystem } from "./testing/fake-fs.js";
import { sampleDoc } from "./test-helpers.js";

const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
const GIF = Uint8Array.from(atob("R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="), (c) => c.charCodeAt(0));

function imageDoc() {
  const { doc, frame } = sampleDoc();
  const png = doc.addImage(PNG);
  const gif = doc.addImage(GIF);
  const rect = doc.transact("Image", (tx) =>
    tx.create("RECTANGLE", frame, {
      fills: [
        { type: "IMAGE", visible: true, imageHash: png, scaleMode: "FILL" },
        { type: "IMAGE", visible: true, imageHash: gif, scaleMode: "TILE", scalingFactor: 2 },
      ],
    }),
  );
  return { doc, frame, rect, png, gif };
}

describe("images in saved packages", () => {
  it("round-trip as bytes through OPFS and a real folder", async () => {
    const fs = new FakeFileSystem();
    const { doc, png, gif } = imageDoc();
    const backend = opfsBackend(doc.fileId, doc.name, fs.root);
    await backend.write(writePackage(doc.toFile()));
    expect(fs.paths(`files/${doc.fileId}/images/`)).toEqual([`files/${doc.fileId}/images/${gif}.gif`, `files/${doc.fileId}/images/${png}.png`].sort());

    const tree = await opfsBackend(doc.fileId, doc.name, fs.root).read();
    expect(tree.get(`images/${png}.png`)).toEqual(PNG);
    expect(typeof tree.get("manifest.json")).toBe("string");
    const { file, warnings } = readPackageWithReport(tree);
    expect(warnings).toEqual([]);
    const reopened = Document.fromFile(file);
    expect(reopened.image(png)).toEqual(PNG);
    expect(reopened.image(gif)).toEqual(GIF);

    const dir = await fs.root.getDirectoryHandle("Mine.illigma", { create: true });
    await folderBackend(dir).write(writePackage(reopened.toFile()));
    expect(readPackage(await folderBackend(dir).read()).images?.get(gif)).toEqual(GIF);
  });

  it("writes an image only once: later saves leave it alone", async () => {
    const fs = new FakeFileSystem();
    const { doc, frame, png } = imageDoc();
    const backend = opfsBackend(doc.fileId, doc.name, fs.root);
    await backend.write(writePackage(doc.toFile()));
    doc.transact("Rename", (tx) => tx.set(frame, "name", "Welcome"));
    const start = fs.log.length;
    await backend.write(writePackage(doc.toFile()));
    const writes = fs.log.slice(start).filter((op) => op.kind === "createWritable").map((op) => op.path);
    expect(writes.some((p) => p.includes("/images/"))).toBe(false);
    expect(writes.some((p) => p.includes("/pages/"))).toBe(true);
    expect((await backend.read()).get(`images/${png}.png`)).toEqual(PNG);
  });

  it("never removes image files when saving: an image no paint uses stays for undo, and goes only through collectImages", async () => {
    const fs = new FakeFileSystem();
    const { doc, rect, png, gif } = imageDoc();
    const backend = opfsBackend(doc.fileId, doc.name, fs.root);
    await backend.write(writePackage(doc.toFile()));
    fs.writeText(`files/${doc.fileId}/images/readme.txt`, "not ours");
    doc.transact("Drop the GIF", (tx) => tx.set(rect, "fills", [{ type: "IMAGE", visible: true, imageHash: png, scaleMode: "FILL" }]));
    await backend.write(writePackage(doc.toFile()));
    // The document still holds the GIF (undo may bring its paint back), so the save keeps it.
    expect(fs.exists(`files/${doc.fileId}/images/${gif}.gif`)).toBe(true);
    expect(fs.exists(`files/${doc.fileId}/images/${png}.png`)).toBe(true);

    // Opened again with nothing that could use it: the host collects it, and nothing else.
    const again = opfsBackend(doc.fileId, doc.name, fs.root);
    const report = readPackageWithReport(await again.read());
    expect(report.unusedImages).toEqual([`images/${gif}.gif`]);
    expect(await again.collectImages!(report.unusedImages)).toEqual([`images/${gif}.gif`]);
    expect(fs.exists(`files/${doc.fileId}/images/${gif}.gif`)).toBe(false);
    expect(fs.exists(`files/${doc.fileId}/images/${png}.png`)).toBe(true);
    expect(fs.readText(`files/${doc.fileId}/images/readme.txt`)).toBe("not ours");
  });

  it("collectImages removes nothing once the package changed on disk, and never anything but image names", async () => {
    const fs = new FakeFileSystem();
    const { doc, rect, png, gif } = imageDoc();
    doc.transact("Drop the GIF", (tx) => tx.set(rect, "fills", [{ type: "IMAGE", visible: true, imageHash: png, scaleMode: "FILL" }]));
    await opfsBackend(doc.fileId, doc.name, fs.root).write(writePackage(doc.toFile()));
    const mine = opfsBackend(doc.fileId, doc.name, fs.root);
    const { unusedImages } = readPackageWithReport(await mine.read());
    // Another tab or app saves meanwhile (it may use the GIF again).
    await opfsBackend(doc.fileId, doc.name, fs.root).write(writePackage(doc.toFile()));
    expect(await mine.collectImages!(unusedImages)).toEqual([]);
    expect(fs.exists(`files/${doc.fileId}/images/${gif}.gif`)).toBe(true);
    const fresh = opfsBackend(doc.fileId, doc.name, fs.root);
    await fresh.read();
    expect(await fresh.collectImages!(["manifest.json", "images/readme.txt", `pages/x.json`])).toEqual([]);
    expect(fs.exists(`files/${doc.fileId}/manifest.json`)).toBe(true);
  });

  it("keeps an image file it couldn't load: a damaged copy survives the next save (QC round 7, data loss)", async () => {
    const fs = new FakeFileSystem();
    const { doc, frame, png } = imageDoc();
    await opfsBackend(doc.fileId, doc.name, fs.root).write(writePackage(doc.toFile()));
    const path = `files/${doc.fileId}/images/${png}.png`;
    const damaged = fs.readBytes(path)!;
    damaged[damaged.length - 6] = (damaged[damaged.length - 6] as number) ^ 0xff;
    fs.writeBytes(path, damaged);

    const backend = opfsBackend(doc.fileId, doc.name, fs.root);
    const report = readPackageWithReport(await backend.read());
    expect(report.warnings.join("\n")).toMatch(/damaged/);
    expect(report.unusedImages).toEqual([]);
    const reopened = Document.fromFile(report.file);
    expect(reopened.image(png)).toBeUndefined();
    reopened.transact("Rename", (tx) => tx.set(frame, "name", "Welcome"));
    await backend.write(writePackage(reopened.toFile()));
    // Left exactly as it was: maybe another app can still read it, and the paint still names it.
    expect(fs.readBytes(path)).toEqual(damaged);
  });

  it("checks an image already on disk once per session before skipping it, so a same-size damaged copy is repaired", async () => {
    const fs = new FakeFileSystem();
    const { doc, frame, png } = imageDoc();
    await opfsBackend(doc.fileId, doc.name, fs.root).write(writePackage(doc.toFile()));
    const path = `files/${doc.fileId}/images/${png}.png`;
    const damaged = fs.readBytes(path)!;
    damaged[damaged.length - 6] = (damaged[damaged.length - 6] as number) ^ 0xff;
    fs.writeBytes(path, damaged);

    // This session holds the good bytes: the first save writes them again.
    const backend = opfsBackend(doc.fileId, doc.name, fs.root);
    await backend.read();
    await backend.write(writePackage(doc.toFile()));
    expect(fs.readBytes(path)).toEqual(PNG);
    // After that the size is enough: no image is read or written again.
    doc.transact("Rename", (tx) => tx.set(frame, "name", "Welcome"));
    const start = fs.log.length;
    await backend.write(writePackage(doc.toFile()));
    const touched = fs.log.slice(start).filter((op) => (op.kind === "createWritable" || op.kind === "read") && op.path.includes("/images/"));
    expect(touched.filter((op) => op.kind === "createWritable")).toEqual([]);
    expect(touched.filter((op) => op.kind === "read").length).toBeLessThanOrEqual(2); // sizes only
  });

  it("retries a read when a listed file is removed before it is read (another tab saving)", async () => {
    const fs = new FakeFileSystem();
    const { doc, png } = imageDoc();
    await opfsBackend(doc.fileId, doc.name, fs.root).write(writePackage(doc.toFile()));
    let gone = 1;
    fs.failWhen = (op) => (op.kind === "read" && op.path.endsWith(`${png}.png`) && gone-- > 0 ? new DOMException("Removed meanwhile", "NotFoundError") : false);
    const tree = await opfsBackend(doc.fileId, doc.name, fs.root).read();
    fs.failWhen = null;
    expect(tree.get(`images/${png}.png`)).toEqual(PNG);
    // A package that is gone altogether still reads as empty.
    expect((await opfsBackend("missing-file", "Gone", fs.root).read()).size).toBe(0);
  });

  it("finishes a save cut short after its commit, images included", async () => {
    const fs = new FakeFileSystem();
    const { doc, gif } = imageDoc();
    const backend = opfsBackend(doc.fileId, doc.name, fs.root);
    const tree: FileTree = writePackage(doc.toFile());
    // Promotion fails for the GIF: the commit marker and its staged copy stay.
    fs.failWhen = (op) => op.kind === "createWritable" && op.path.endsWith(`images/${gif}.gif`);
    await expect(backend.write(tree)).rejects.toThrow();
    fs.failWhen = null;
    expect(fs.exists(`files/${doc.fileId}/${COMMIT_FILE}`)).toBe(true);
    expect(fs.exists(`files/${doc.fileId}/images/${gif}.gif${TEMP_SUFFIX}`)).toBe(true);
    // A reader sees the staged image as bytes; the repair then promotes it.
    const read = await opfsBackend(doc.fileId, doc.name, fs.root).read();
    expect(read.get(`images/${gif}.gif`)).toEqual(GIF);
    expect(fs.exists(`files/${doc.fileId}/images/${gif}.gif`)).toBe(true);
    expect(fs.exists(`files/${doc.fileId}/${COMMIT_FILE}`)).toBe(false);
  });
});
