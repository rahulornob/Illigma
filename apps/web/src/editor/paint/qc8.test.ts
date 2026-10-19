// QC round 8, paint panel: hidden solid alpha, stable gradient stop keys, the open picker following its paint,
// typed hex alpha, image imports (limits, one message, waiting for a drag) and placement in rotated frames.

import { describe, expect, it } from "vitest";
import { Document } from "@illigma/core";
import type { GradientPaint, Paint } from "@illigma/format";
import { frameAt, placeAt, rectInSpace, worldCorners } from "../geometry";
import { hexHasAlpha, parseHex } from "./color";
import { EditSession, movedIndex, movePaint, paintAt } from "./edits";
import { placeImages, readImageFiles, refusalMessage, whenIdle } from "./image";
import { addStop, convertPaint, flipStops, moveStop, paintAlpha, removeStop, setSolid, solidAlpha, stopKeys, withPaintOpacity } from "./paints";

type Solid = Extract<Paint, { type: "SOLID" }>;
const red = { r: 1, g: 0, b: 0 };

/** A PNG header (no pixels) declaring `w` × `h`: enough for the file checks. */
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
const png = (name: string, w = 10, h = 10) => new File([pngHeader(w, h) as BlobPart], name, { type: "image/png" });

describe("item 1: a solid's alpha is all in its opacity", () => {
  const linear = (stops: GradientPaint["gradientStops"], opacity?: number): GradientPaint => ({
    type: "GRADIENT_LINEAR",
    visible: true,
    ...(opacity !== undefined ? { opacity } : {}),
    gradientStops: stops,
    gradientTransform: [
      [1, 0, 0],
      [0, 1, 0],
    ],
  });

  it("a gradient back to Solid keeps an opaque colour and moves the first stop's alpha into the opacity", () => {
    const solid = { type: "SOLID", visible: true, color: { ...red, a: 1 } } as const satisfies Paint;
    // Linear, flipped: the transparent end comes first.
    const flipped = linear(flipStops((convertPaint(solid, "GRADIENT_LINEAR") as GradientPaint).gradientStops));
    const back = convertPaint(flipped, "SOLID") as Solid;
    expect(back.color).toEqual({ ...red, a: 1 });
    expect(back.opacity).toBe(0);
    expect(paintAlpha(back)).toBe(0);
    // A first stop at half alpha, on a paint at 80 %: the solid is at 40 %.
    const half = convertPaint(linear([{ position: 0, color: { ...red, a: 0.5 } }, { position: 1, color: { ...red, a: 1 } }], 0.8), "SOLID") as Solid;
    expect(half).toEqual({ type: "SOLID", visible: true, color: { ...red, a: 1 }, opacity: 0.4 });
    // An opaque first stop gives no opacity field (100 %).
    expect(convertPaint(linear([{ position: 0, color: { ...red, a: 1 } }, { position: 1, color: { ...red, a: 0 } }]), "SOLID")).toEqual({ type: "SOLID", visible: true, color: { ...red, a: 1 } });
  });

  it("an older solid with alpha in its colour shows that alpha, and keeps its look as a gradient", () => {
    const old: Solid = { type: "SOLID", visible: true, color: { ...red, a: 0.5 }, opacity: 0.8 };
    expect(solidAlpha(old)).toBeCloseTo(0.4, 12);
    expect(paintAlpha(old)).toBeCloseTo(0.4, 12);
    const g = convertPaint(old, "GRADIENT_LINEAR") as GradientPaint;
    expect(g.gradientStops[0]?.color).toEqual({ ...red, a: 1 });
    expect(g.opacity).toBeCloseTo(0.4, 12);
  });

  it("the first edit folds the colour's alpha into the opacity, in one undo step, exactly", () => {
    const doc = new Document("Alpha");
    const page = doc.transact("Page", (tx) => tx.addPage("Page 1"));
    const old: Solid = { type: "SOLID", visible: true, color: { r: 0.2, g: 0.4, b: 0.6, a: 0.5 }, opacity: 0.5 };
    const rect = doc.transact("Add", (tx) => tx.create("RECTANGLE", page, { name: "R", fills: [old] }));
    const before = JSON.stringify(doc.get(rect));
    // A hue change from the picker: the picker shows (and passes back) the effective alpha, 25 %.
    new EditSession(doc).change("once", "Change fill colour", [rect], paintAt("fills", 0, (p) => setSolid(p as Solid, red, solidAlpha(p as Solid))));
    expect(doc.get(rect)?.fills[0]).toEqual({ type: "SOLID", visible: true, color: { ...red, a: 1 }, opacity: 0.25 });
    doc.undo();
    expect(JSON.stringify(doc.get(rect))).toBe(before);
    // Typing 100 % in the row makes it fully opaque: no hidden alpha is left.
    new EditSession(doc).change("once", "Change fill opacity", [rect], paintAt("fills", 0, (p) => setSolid(p as Solid, (p as Solid).color, 1)));
    expect(doc.get(rect)?.fills[0]).toEqual({ type: "SOLID", visible: true, color: { r: 0.2, g: 0.4, b: 0.6, a: 1 } });
  });

  it("withPaintOpacity stores full opacity as no field", () => {
    const p: Paint = { type: "IMAGE", visible: true, opacity: 0.3, imageHash: null, scaleMode: "FILL" };
    expect(withPaintOpacity(p, 1)).not.toHaveProperty("opacity");
    expect(withPaintOpacity(p, 0.5).opacity).toBe(0.5);
    expect(withPaintOpacity(p, -1).opacity).toBe(0);
  });
});

describe("item 11: typed hex alpha", () => {
  it("#rgba and #rrggbbaa carry alpha; other forms don't", () => {
    for (const t of ["#f008", "F008", "#ff000080", " ff000080 "]) expect(hexHasAlpha(t)).toBe(true);
    for (const t of ["#f00", "ff0000", "33", "f", "#ff00008", "zzzz"]) expect(hexHasAlpha(t)).toBe(false);
    expect(parseHex("#f008")).toEqual({ r: 1, g: 0, b: 0, a: 0x88 / 255 });
    expect(parseHex("#ff000080")?.a).toBe(0x80 / 255);
  });

  it("a typed #rrggbbaa sets the colour opaque and the alpha as opacity", () => {
    const p: Solid = { type: "SOLID", visible: true, color: { r: 0, g: 0, b: 0, a: 1 } };
    const c = parseHex("#00ff0040")!;
    expect(setSolid(p, c, hexHasAlpha("#00ff0040") ? c.a : solidAlpha(p))).toEqual({ type: "SOLID", visible: true, color: { r: 0, g: 1, b: 0, a: 1 }, opacity: 0x40 / 255 });
  });
});

describe("item 5: gradient stops keep their keys through moves", () => {
  it("follows a stop moved past another, an added stop and a removed one", () => {
    const stops = [
      { position: 0, color: { ...red, a: 1 } },
      { position: 0.5, color: { r: 0, g: 1, b: 0, a: 1 } },
      { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } },
    ];
    let keys = [10, 11, 12];
    // Stop 0 moved past the middle one: it is now second, and its key goes with it.
    const m = moveStop(stops, 0, 0.6);
    keys = stopKeys.move(keys, 0, m.index);
    expect(m.index).toBe(1);
    expect(keys).toEqual([11, 10, 12]);
    expect(m.stops[1]?.color.r).toBe(1);
    const a = addStop(m.stops, 0.8);
    keys = stopKeys.insert(keys, a.index, 13);
    expect(keys).toEqual([11, 10, 13, 12]);
    const r = removeStop(a.stops, 0)!;
    keys = stopKeys.remove(keys, 0);
    expect(keys).toEqual([10, 13, 12]);
    expect(r.stops).toHaveLength(3);
  });
});

describe("item 9: an open picker follows its paint", () => {
  it("movedIndex matches movePaint for every from, to and index", () => {
    const doc = new Document("Move");
    const page = doc.transact("Page", (tx) => tx.addPage("Page 1"));
    const fills: Paint[] = [0, 1, 2, 3].map((i) => ({ type: "SOLID", visible: true, color: { r: i / 4, g: 0, b: 0, a: 1 } }));
    const rect = doc.transact("Add", (tx) => tx.create("RECTANGLE", page, { name: "R", fills }));
    for (let from = 0; from < 4; from++) {
      for (let to = 0; to < 4; to++) {
        if (from === to) continue;
        const before = doc.get(rect)!.fills.map((p) => JSON.stringify(p));
        new EditSession(doc).change("once", "Reorder", [rect], movePaint("fills", from, to));
        const after = doc.get(rect)!.fills.map((p) => JSON.stringify(p));
        for (let i = 0; i < 4; i++) expect(after[movedIndex(i, from, to)]).toBe(before[i]);
        doc.undo();
      }
    }
  });
});

describe("items 7 and 8: image imports", () => {
  it("adds what it can and gives one reason per refused file, within the file count and size caps", async () => {
    const doc = new Document("Imports");
    const files = [png("a.png", 10, 10), new File(["not an image"], "b.png", { type: "image/png" }), png("c.png", 20, 20), png("d.png", 30, 30)];
    const { added, refused } = await readImageFiles(doc, files, { maxFiles: 3, maxTotalBytes: 1024 });
    expect(added.map((a) => a.name)).toEqual(["a", "c"]);
    expect(refused).toEqual([
      { name: "b.png", reason: "it is not a PNG, JPEG, WebP or GIF image" },
      { name: "d.png", reason: "only 3 files can be added at once" },
    ]);
    // The size cap: the second file would take the total past it.
    const big = await readImageFiles(doc, [png("e.png", 1, 1), png("f.png", 2, 2)], { maxFiles: 50, maxTotalBytes: 40 });
    expect(big.added.map((a) => a.name)).toEqual(["e"]);
    expect(big.refused).toEqual([{ name: "f.png", reason: "the files added together would be more than 0 MB" }]);
  });

  it("refuses an image whose header is right but whose data doesn't decode, and stores nothing (QC tester A)", async () => {
    const doc = new Document("Corrupt");
    const corrupt = new File([pngHeader(200, 100) as BlobPart, new Uint8Array(64).fill(7) as BlobPart], "Corrupt.png", { type: "image/png" });
    const seen: string[] = [];
    const decoder = async (_bytes: Uint8Array, type: string) => {
      seen.push(type);
      return false;
    };
    const { added, refused } = await readImageFiles(doc, [corrupt], undefined, decoder);
    expect(added).toEqual([]);
    expect(seen).toEqual(["image/png"]);
    expect(doc.imageHashes()).toEqual([]);
    expect(refusalMessage(refused)).toBe("“Corrupt.png” can't be used: it isn't a readable image (its data is damaged or incomplete).");
  });

  it("puts every refusal in one message", () => {
    expect(refusalMessage([])).toBeNull();
    expect(refusalMessage([{ name: "Huge.png", reason: "it is too big (20,000 × 100 pixels)" }])).toBe("“Huge.png” can't be used: it is too big (20,000 × 100 pixels).");
    const many = Array.from({ length: 7 }, (_, i) => ({ name: `${i}.png`, reason: "it is larger than 32 MB" }));
    const text = refusalMessage(many)!;
    expect(text.startsWith("7 files can't be used. “0.png”: it is larger than 32 MB; “1.png”")).toBe(true);
    expect(text.endsWith("“4.png”: it is larger than 32 MB; and 2 more.")).toBe(true);
  });

  it("waits for a live edit to end, kept or cancelled (even one that changed nothing)", async () => {
    const doc = new Document("Live");
    const page = doc.transact("Page", (tx) => tx.addPage("Page 1"));
    const rect = doc.transact("Add", (tx) => tx.create("RECTANGLE", page, { name: "R" }));
    await whenIdle(doc); // nothing open: at once
    let live = doc.beginLive("Move");
    let done = false;
    const kept = whenIdle(doc).then(() => (done = true));
    live.update((tx) => tx.set(rect, "x", 50));
    await new Promise((r) => setTimeout(r, 80));
    expect(done).toBe(false);
    live.commit();
    await kept;
    expect(done).toBe(true);
    live = doc.beginLive("Nothing");
    const cancelled = whenIdle(doc);
    live.cancel(); // no change, no event: found by the 50 ms check
    await cancelled;
    expect(doc.live).toBeNull();
  });
});

describe("item 6: placing into rotated frames", () => {
  function rotatedFrame() {
    const doc = new Document("Rotated");
    const page = doc.transact("Page", (tx) => tx.addPage("Page 1"));
    // 400 × 200 at (100, 100), turned 90° about its top-left: on the page it covers x −100…100, y 100…500.
    const frame = doc.transact("Add", (tx) => tx.create("FRAME", page, { name: "F", x: 100, y: 100, width: 400, height: 200, rotation: 90 }));
    return { doc, page, frame };
  }
  const centreOf = (doc: Document, id: string) => {
    const c = worldCorners(doc, id);
    return { x: ((c[0]?.x ?? 0) + (c[2]?.x ?? 0)) / 2, y: ((c[0]?.y ?? 0) + (c[2]?.y ?? 0)) / 2 };
  };

  it("finds the frame under a point as drawn, not its unrotated box", () => {
    const { doc, page, frame } = rotatedFrame();
    expect(frameAt(doc, page, 0, 300)).toBe(frame); // inside as drawn, outside the unrotated box
    expect(frameAt(doc, page, 300, 150)).toBeNull(); // inside the unrotated box only
    expect(placeAt(doc, page, 0, 300)).toEqual({ parent: frame, local: { x: expect.closeTo(200, 9), y: expect.closeTo(100, 9) } });
  });

  it("a dropped image is centred where it was dropped and turns with the frame", async () => {
    const { doc, page, frame } = rotatedFrame();
    const { added } = await readImageFiles(doc, [png("Photo.png", 60, 40)]);
    const [id] = placeImages(doc, page, added, { x: 0, y: 300 });
    const n = doc.get(id!)!;
    expect(n.parentId).toBe(frame);
    expect([n.width, n.height, n.rotation]).toEqual([60, 40, 0]);
    const c = centreOf(doc, id!);
    expect(c.x).toBeCloseTo(0, 6);
    expect(c.y).toBeCloseTo(300, 6);
  });

  it("a drawn box keeps its centre and size in the frame's space (the draw and text tools)", () => {
    const { doc, frame } = rotatedFrame();
    const r = rectInSpace(doc, frame, { x: -40, y: 250, width: 80, height: 100 });
    expect(r.width).toBe(80);
    expect(r.height).toBe(100);
    const id = doc.transact("Draw", (tx) => tx.create("RECTANGLE", frame, { name: "R", x: r.x, y: r.y, width: r.width, height: r.height }));
    const c = centreOf(doc, id);
    expect(c.x).toBeCloseTo(0, 6);
    expect(c.y).toBeCloseTo(300, 6);
    // Unrotated frames are as before: page position minus the frame's.
    const flat = doc.transact("Add", (tx) => tx.create("FRAME", doc.pages()[0]!.id, { name: "G", x: 1000, y: 1000, width: 100, height: 100 }));
    expect(rectInSpace(doc, flat, { x: 1010, y: 1020, width: 30, height: 40 })).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });
});
