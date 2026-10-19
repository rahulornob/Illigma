import { describe, expect, it } from "vitest";
import { Document } from "@illigma/core";
import type { Paint } from "@illigma/format";
import { addEffect, addPaint, EditSession, effectAt, movePaint, paintAt, removeEffect, removePaint, sharedEffects, sharedPaints } from "./edits";
import { addImageFile, imageFiles, placedSize, placeImages } from "./image";
import { defaultEffect } from "./paints";

const solid = (r: number): Paint => ({ type: "SOLID", visible: true, color: { r, g: 0, b: 0, a: 1 } });

function setup() {
  const doc = new Document("Test");
  const page = doc.transact("Add page", (tx) => tx.addPage("Page 1"));
  const ids = doc.transact("Add", (tx) => ({
    frame: tx.create("FRAME", page, { name: "Desktop", x: 100, y: 100, width: 800, height: 600 }),
    rect: tx.create("RECTANGLE", page, { name: "A", fills: [solid(1)] }),
    rect2: tx.create("RECTANGLE", page, { name: "B", fills: [solid(1)] }),
    line: tx.create("LINE", page, { name: "L" }),
  }));
  return { doc, page, ...ids };
}

/** A PNG header (no pixels) declaring `w` × `h`: enough for the file checks, which read the size before decoding. */
function pngHeader(w: number, h: number): Uint8Array {
  const b = new Uint8Array(8 + 25);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const v = new DataView(b.buffer);
  v.setUint32(8, 13);
  b.set([0x49, 0x48, 0x44, 0x52], 12);
  v.setUint32(16, w);
  v.setUint32(20, h);
  b.set([8, 6, 0, 0, 0], 24);
  return b;
}

describe("EditSession", () => {
  it("makes a one-off change one undo step", () => {
    const { doc, rect, rect2 } = setup();
    new EditSession(doc).change("once", "Change fill colour", [rect, rect2], paintAt("fills", 0, () => solid(0.2)));
    expect(doc.get(rect)?.fills[0]).toEqual(solid(0.2));
    expect(doc.get(rect2)?.fills[0]).toEqual(solid(0.2));
    doc.undo();
    expect(doc.get(rect)?.fills[0]).toEqual(solid(1));
    expect(doc.get(rect2)?.fills[0]).toEqual(solid(1));
  });

  it("makes a whole drag one undo step, keeping the last step", () => {
    const { doc, rect } = setup();
    const s = new EditSession(doc);
    const changes: string[] = [];
    doc.subscribe((c) => changes.push(c.origin));
    s.change("start", "Change fill colour", [rect], paintAt("fills", 0, () => solid(0.9)));
    for (let i = 8; i > 2; i--) s.change("move", "Change fill colour", [rect], paintAt("fills", 0, () => solid(i / 10)));
    expect(s.dragging).toBe(true);
    s.change("end", "Change fill colour", [rect], paintAt("fills", 0, () => solid(0.25)));
    expect(s.dragging).toBe(false);
    expect(doc.get(rect)?.fills[0]).toEqual(solid(0.25));
    expect(changes.filter((c) => c === "edit").length).toBe(1);
    doc.undo();
    expect(doc.get(rect)?.fills[0]).toEqual(solid(1));
    doc.redo();
    expect(doc.get(rect)?.fills[0]).toEqual(solid(0.25));
  });

  it("leaves the document alone while a canvas drag owns it", () => {
    const { doc, rect } = setup();
    const canvasDrag = doc.beginLive("Move layer");
    const s = new EditSession(doc);
    s.change("once", "x", [rect], paintAt("fills", 0, () => solid(0)));
    s.change("start", "x", [rect], paintAt("fills", 0, () => solid(0)));
    canvasDrag.cancel();
    expect(doc.get(rect)?.fills[0]).toEqual(solid(1));
  });

  it("settles a drag left open (the picker closed mid-drag)", () => {
    const { doc, rect } = setup();
    const s = new EditSession(doc);
    s.change("start", "Change fill colour", [rect], paintAt("fills", 0, () => solid(0.5)));
    s.settle();
    expect(doc.live).toBeNull();
    expect(doc.get(rect)?.fills[0]).toEqual(solid(0.5));
  });
});

describe("paint lists", () => {
  it("adds a fill on top, or replaces mixed fills", () => {
    const { doc, rect, rect2 } = setup();
    const s = new EditSession(doc);
    s.change("once", "Add fill", [rect], addPaint("fills", false));
    expect(doc.get(rect)?.fills.length).toBe(2);
    expect(sharedPaints([doc.get(rect)!, doc.get(rect2)!], "fills")).toBeNull();
    s.change("once", "Add fill", [rect, rect2], addPaint("fills", true));
    expect(doc.get(rect)?.fills.length).toBe(1);
    expect(sharedPaints([doc.get(rect)!, doc.get(rect2)!], "fills")?.length).toBe(1);
  });

  it("puts the first stroke of a closed shape inside, as Figma does, but not on a line or an explicit choice", () => {
    const { doc, rect, line, frame } = setup();
    const s = new EditSession(doc);
    s.change("once", "Add stroke", [rect, line, frame], addPaint("strokes", false));
    expect(doc.get(rect)?.strokeAlign).toBe("INSIDE");
    expect(doc.get(frame)?.strokeAlign).toBe("INSIDE");
    expect(doc.get(line)?.strokeAlign).toBeUndefined();
    expect(doc.get(rect)?.strokes[0]).toEqual({ type: "SOLID", visible: true, color: { r: 0, g: 0, b: 0, a: 1 } });
    doc.transact("Center", (tx) => tx.set(rect, "strokeAlign", "CENTER"));
    s.change("once", "Remove stroke", [rect], removePaint("strokes", 0));
    s.change("once", "Add stroke", [rect], addPaint("strokes", false));
    expect(doc.get(rect)?.strokeAlign).toBe("CENTER");
    // One undo removes the stroke and its alignment together.
    doc.undo();
    doc.undo();
    doc.undo();
    doc.undo();
    expect(doc.get(rect)?.strokes).toEqual([]);
    expect(doc.get(rect)?.strokeAlign).toBeUndefined();
  });

  it("reorders paints", () => {
    const { doc, rect } = setup();
    doc.transact("Fills", (tx) => tx.set(rect, "fills", [solid(0.1), solid(0.2), solid(0.3)]));
    new EditSession(doc).change("once", "Reorder fills", [rect], movePaint("fills", 0, 2));
    expect(doc.get(rect)?.fills.map((p) => (p.type === "SOLID" ? p.color.r : -1))).toEqual([0.2, 0.3, 0.1]);
  });
});

describe("effects", () => {
  it("adds, edits and removes effects; none left means no field", () => {
    const { doc, rect } = setup();
    const s = new EditSession(doc);
    s.change("once", "Add drop shadow", [rect], addEffect(defaultEffect("DROP_SHADOW"), false));
    expect(sharedEffects([doc.get(rect)!])?.length).toBe(1);
    s.change("once", "Blur", [rect], effectAt(0, (e) => ({ ...e, radius: 20 })));
    expect(doc.get(rect)?.effects?.[0]?.radius).toBe(20);
    s.change("once", "Remove effect", [rect], removeEffect(0));
    expect(doc.get(rect)).not.toHaveProperty("effects");
  });
});

describe("images", () => {
  it("places images at their natural size, smaller to fit the view, centred, inside the frame under the point", async () => {
    const { doc, page, frame } = setup();
    const big = await addImageFile(doc, Object.assign(new Blob([pngHeader(4000, 2000) as BlobPart]), { name: "Photo.png" }));
    expect(big).toMatchObject({ width: 4000, height: 2000, name: "Photo" });
    const small = await addImageFile(doc, new Blob([pngHeader(64, 32) as BlobPart]));
    expect(small.name).toBe("Image");
    const view = { x: 0, y: 0, width: 1000, height: 800 };
    const [a, b] = placeImages(doc, page, [big, small], { x: 500, y: 400 }, view);
    const na = doc.get(a!)!;
    const nb = doc.get(b!)!;
    expect(na.parentId).toBe(frame);
    expect([na.width, na.height]).toEqual([1000, 500]);
    expect([nb.width, nb.height]).toEqual([64, 32]);
    expect(na.fills).toEqual([{ type: "IMAGE", visible: true, imageHash: big.hash, scaleMode: "FILL" }]);
    // Side by side, centred on (500, 400) on the page; positions are in the frame's space (it sits at 100, 100).
    expect(na.x + 100).toBe(Math.round(500 - (1000 + 20 + 64) / 2));
    expect(na.y + 100).toBe(400 - 250);
    doc.undo();
    expect(doc.has(a!)).toBe(false);
    expect(doc.has(b!)).toBe(false);
  });

  it("refuses images that are too big, with the document's plain message", async () => {
    const doc = new Document("Big");
    await expect(addImageFile(doc, new Blob([pngHeader(20_000, 100) as BlobPart]))).rejects.toThrow(/too big \(20,000 × 100 pixels/);
    await expect(addImageFile(doc, new Blob(["not an image"]))).rejects.toThrow(/not a PNG, JPEG, WebP or GIF/);
    expect(doc.imageHashes()).toEqual([]);
  });

  it("keeps image sizes whole and at least 1 px, and picks image files", () => {
    expect(placedSize({ width: 10_000, height: 1 }, { width: 100, height: 100 })).toEqual({ width: 100, height: 1 });
    expect(placedSize({ width: 300, height: 200 })).toEqual({ width: 300, height: 200 });
    const f = (name: string, type: string) => new File([""], name, { type });
    expect(imageFiles([f("a.png", "image/png"), f("b.txt", "text/plain"), f("c.JPG", ""), f("d.illigma", "")]).map((x) => x.name)).toEqual(["a.png", "c.JPG"]);
  });
});
