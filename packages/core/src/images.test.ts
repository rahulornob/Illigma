import { describe, expect, it } from "vitest";
import { FormatError, readPackage, sha256Hex, writePackage } from "@illigma/format";
import { Document, DocumentError } from "./index.js";

const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));

describe("Document images", () => {
  it("stores an image once by its SHA-256 and carries it through files", () => {
    const doc = new Document("Images");
    const hash = doc.addImage(PNG);
    expect(hash).toBe(sha256Hex(PNG));
    expect(doc.addImage(PNG.slice())).toBe(hash);
    expect(doc.image(hash)).toBe(PNG);
    expect(doc.image("0".repeat(64))).toBeUndefined();

    const page = doc.transact("Page", (tx) => tx.addPage("P"));
    doc.transact("Image", (tx) => tx.create("RECTANGLE", page, { fills: [{ type: "IMAGE", visible: true, imageHash: hash, scaleMode: "FIT" }] }));
    const back = Document.fromFile(readPackage(writePackage(doc.toFile())));
    expect(back.image(hash)).toEqual(PNG);
  });

  it("adds images outside undo history, and leaves files without images as before", () => {
    const doc = new Document("Images");
    expect(doc.toFile().images).toBeUndefined();
    doc.addImage(PNG);
    expect(doc.canUndo).toBe(false);
    expect(doc.toFile().images?.size).toBe(1);
  });

  it("refuses files that aren't images", () => {
    const doc = new Document("Images");
    expect(() => doc.addImage(new TextEncoder().encode("<svg/>"))).toThrow(FormatError);
  });

  it("refuses an image paint with a bad hash in a transaction", () => {
    const doc = new Document("Images");
    const page = doc.transact("Page", (tx) => tx.addPage("P"));
    expect(() => doc.transact("Bad", (tx) => tx.create("RECTANGLE", page, { fills: [{ type: "IMAGE", visible: true, imageHash: "nope", scaleMode: "FIT" }] }))).toThrow(DocumentError);
    expect(() =>
      doc.transact("Bad", (tx) => tx.create("RECTANGLE", page, { effects: [{ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 1 }, offset: { x: 0, y: 0 }, radius: -1, visible: true }] })),
    ).toThrow(/radius/);
  });
});
