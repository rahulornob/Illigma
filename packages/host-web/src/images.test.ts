// Image files (binary) in saved packages: written as bytes, read back as bytes, written once, and removed when no longer used.
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

  it("removes image files no paint uses any more, and nothing else under images/", async () => {
    const fs = new FakeFileSystem();
    const { doc, rect, png, gif } = imageDoc();
    const backend = opfsBackend(doc.fileId, doc.name, fs.root);
    await backend.write(writePackage(doc.toFile()));
    fs.writeText(`files/${doc.fileId}/images/readme.txt`, "not ours");
    doc.transact("Drop the GIF", (tx) => tx.set(rect, "fills", [{ type: "IMAGE", visible: true, imageHash: png, scaleMode: "FILL" }]));
    await backend.write(writePackage(doc.toFile()));
    expect(fs.exists(`files/${doc.fileId}/images/${gif}.gif`)).toBe(false);
    expect(fs.exists(`files/${doc.fileId}/images/${png}.png`)).toBe(true);
    expect(fs.readText(`files/${doc.fileId}/images/readme.txt`)).toBe("not ours");
    // The document still has the GIF in memory, so undo brings it back on the next save.
    doc.undo();
    await backend.write(writePackage(doc.toFile()));
    expect(fs.exists(`files/${doc.fileId}/images/${gif}.gif`)).toBe(true);
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
