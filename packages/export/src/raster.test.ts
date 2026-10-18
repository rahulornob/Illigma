// PNG and JPG export, checked pixel by pixel after decoding with CanvasKit (CPU, in Node).
import { beforeAll, describe, expect, it } from "vitest";
import type { CanvasKit } from "canvaskit-wasm";
import { DEFAULT_EXPORT_LIMITS, ExportError, exportNode, rasterSize, exportScene } from "./index.js";
import { BLUE, build, canvasKit, decode, interFonts, RED, solid } from "./test.fixture.js";

let ck: CanvasKit;
beforeAll(async () => {
  ck = await canvasKit();
});

const isRed = ([r, g, b, a]: number[]) => (r as number) > 200 && (g as number) < 60 && (b as number) < 60 && (a as number) > 200;
const isBlue = ([r, g, b, a]: number[]) => (r as number) < 60 && (b as number) > 200 && (a as number) > 200;

describe("PNG export", () => {
  it("draws the layer at its bounds with a transparent background", async () => {
    const { doc, ids } = build((add, p) => ({ e: add("ELLIPSE", p, { name: "Dot", x: 37, y: 11, width: 100, height: 50, fills: solid(RED) }) }));
    const file = await exportNode(doc, ids.e, { format: "PNG" }, { canvasKit: ck });
    expect(file).toMatchObject({ filename: "Dot.png", mime: "image/png", width: 100, height: 50, warnings: [] });
    expect(Array.from(file.bytes.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const img = decode(ck, file.bytes);
    expect([img.width, img.height]).toEqual([100, 50]);
    expect(isRed(img.at(50, 25))).toBe(true);
    expect(img.at(1, 1)[3]).toBe(0); // the corner is outside the ellipse: transparent
  });

  it("scales by a multiplier, a fixed width or a fixed height", async () => {
    const { doc, ids } = build((add, p) => ({ r: add("RECTANGLE", p, { width: 40, height: 20, fills: solid(RED) }) }));
    const at = async (constraint: { type: "SCALE" | "WIDTH" | "HEIGHT"; value: number }) => {
      const f = await exportNode(doc, ids.r, { format: "PNG", constraint }, { canvasKit: ck });
      const img = decode(ck, f.bytes);
      return [img.width, img.height, f.width, f.height];
    };
    expect(await at({ type: "SCALE", value: 2 })).toEqual([80, 40, 80, 40]);
    expect(await at({ type: "SCALE", value: 0.5 })).toEqual([20, 10, 20, 10]);
    expect(await at({ type: "WIDTH", value: 100 })).toEqual([100, 50, 100, 50]);
    expect(await at({ type: "HEIGHT", value: 15 })).toEqual([30, 15, 30, 15]);
    // Never smaller than one pixel.
    expect(await at({ type: "SCALE", value: 0.001 })).toEqual([1, 1, 1, 1]);
  });

  it("includes strokes, rotation and a frame's clipping", async () => {
    const { doc, ids } = build((add, p) => {
      const frame = add("FRAME", p, { x: 0, y: 0, width: 100, height: 100, fills: solid(BLUE) });
      add("RECTANGLE", frame, { x: 50, y: 50, width: 100, height: 100, fills: solid(RED) });
      const sq = add("RECTANGLE", p, { x: 300, y: 0, width: 100, height: 100, rotation: 45, fills: solid(RED), strokes: solid(BLUE), strokeWeight: 10 });
      return { frame, sq };
    });
    const f = decode(ck, (await exportNode(doc, ids.frame, { format: "PNG" }, { canvasKit: ck })).bytes);
    expect([f.width, f.height]).toEqual([100, 100]);
    expect(isBlue(f.at(25, 25))).toBe(true);
    expect(isRed(f.at(75, 75))).toBe(true);
    // A diamond with a stroke 10 wide: the stroke's outer square (110) turned 45° is 155.6 across.
    const d = decode(ck, (await exportNode(doc, ids.sq, { format: "PNG" }, { canvasKit: ck })).bytes);
    expect([d.width, d.height]).toEqual([156, 156]);
    expect(isRed(d.at(78, 78))).toBe(true);
    expect(isBlue(d.at(78, 5))).toBe(true);
    expect(d.at(5, 5)[3]).toBe(0);
  });

  it("applies the layer's own opacity, but not its parent's", async () => {
    const { doc, ids } = build((add, p) => {
      const frame = add("FRAME", p, { width: 100, height: 100, opacity: 0.2 });
      const r = add("RECTANGLE", frame, { width: 100, height: 100, fills: solid(RED), opacity: 0.5 });
      return { r };
    });
    const img = decode(ck, (await exportNode(doc, ids.r, { format: "PNG" }, { canvasKit: ck })).bytes);
    const [r, , , a] = img.at(50, 50);
    expect(r).toBeGreaterThan(250);
    expect(a).toBeGreaterThan(120);
    expect(a).toBeLessThan(135);
  });

  it("with contentsOnly off, also draws what overlaps the layer", async () => {
    const { doc, ids } = build((add, p) => ({
      a: add("RECTANGLE", p, { width: 100, height: 100, fills: solid(RED) }),
      b: add("RECTANGLE", p, { x: 50, y: 50, width: 100, height: 100, fills: solid(BLUE) }),
    }));
    const only = decode(ck, (await exportNode(doc, ids.a, { format: "PNG" }, { canvasKit: ck })).bytes);
    expect(isRed(only.at(75, 75))).toBe(true);
    const all = decode(ck, (await exportNode(doc, ids.a, { format: "PNG", contentsOnly: false }, { canvasKit: ck })).bytes);
    expect([all.width, all.height]).toEqual([100, 100]);
    expect(isBlue(all.at(75, 75))).toBe(true);
    expect(isRed(all.at(25, 25))).toBe(true);
  });

  it("draws text with the fonts given, and says when there are none", async () => {
    const { doc, ids } = build((add, p) => ({
      t: add("TEXT", p, { width: 200, height: 40, characters: "Export", fontSize: 32, fontFamily: "Inter", fills: solid({ r: 0, g: 0, b: 0, a: 1 }) }),
    }));
    const file = await exportNode(doc, ids.t, { format: "PNG" }, { canvasKit: ck, fonts: interFonts() });
    expect(file.warnings).toEqual([]);
    const img = decode(ck, file.bytes);
    let ink = 0;
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if ((img.at(x, y)[3] as number) > 128) ink++;
    // Glyphs cover part of the box, not all of it (a placeholder bar would be a solid band).
    expect(ink).toBeGreaterThan(300);
    expect(ink).toBeLessThan(200 * 40 * 0.4);
    const bare = await exportNode(doc, ids.t, { format: "PNG" }, { canvasKit: ck });
    expect(bare.warnings).toEqual(["No fonts were loaded, so text is drawn as placeholder bars."]);
  });
});

describe("JPG export", () => {
  it("draws over white, at the quality asked", async () => {
    const { doc, ids } = build((add, p) => ({ e: add("ELLIPSE", p, { name: "Dot", width: 64, height: 64, fills: solid(RED) }) }));
    const best = await exportNode(doc, ids.e, { format: "JPG", quality: 100 }, { canvasKit: ck });
    expect(best).toMatchObject({ filename: "Dot.jpg", mime: "image/jpeg", width: 64, height: 64 });
    expect(Array.from(best.bytes.slice(0, 3))).toEqual([0xff, 0xd8, 0xff]);
    const img = decode(ck, best.bytes);
    const corner = img.at(1, 1);
    expect(corner.every((v) => v > 245)).toBe(true); // white, opaque
    expect(isRed(img.at(32, 32))).toBe(true);
    const small = await exportNode(doc, ids.e, { format: "JPG", quality: 5 }, { canvasKit: ck });
    expect(small.bytes.length).toBeLessThan(best.bytes.length);
  });
});

describe("raster limits and errors", () => {
  const big = () => build((add, p) => ({ r: add("RECTANGLE", p, { name: "Poster", width: 5000, height: 3000, fills: solid(RED) }) }));

  it("refuses images over 16,384 px a side, saying why and what to do", async () => {
    const { doc, ids } = big();
    await expect(exportNode(doc, ids.r, { format: "PNG", constraint: { type: "SCALE", value: 4 } }, { canvasKit: ck })).rejects.toThrow(
      "“Poster” is too big to export at 4x: the image would be 20,000 × 12,000 px, and the most an export can be is 16,384 px on each side. Try a smaller scale.",
    );
    await expect(exportNode(doc, ids.r, { format: "PNG", constraint: { type: "WIDTH", value: 20000 } }, { canvasKit: ck })).rejects.toThrow("at 20000 px wide");
  });

  it("refuses too many pixels overall, and takes custom limits", () => {
    const { doc, ids } = big();
    const scene = exportScene(doc, ids.r, {});
    // 15,000 × 9,000 fits each side but not the pixel budget.
    expect(() => rasterSize(scene, { format: "PNG", constraint: { type: "SCALE", value: 3 } })).toThrow("the image would have 135,000,000 pixels, and the most an export can have is 134,217,728");
    expect(rasterSize(scene, { format: "PNG", constraint: { type: "SCALE", value: 2 } })).toEqual({ width: 10000, height: 6000, scale: 2 });
    expect(() => rasterSize(scene, { format: "PNG" }, { ...DEFAULT_EXPORT_LIMITS, maxDimension: 4096 })).toThrow("4,096 px on each side");
  });

  it("checks settings and needs CanvasKit for raster formats", async () => {
    const { doc, ids } = build((add, p) => ({ r: add("RECTANGLE", p, { width: 10, height: 10, fills: solid(RED) }), l: add("LINE", p, { width: 10, height: 0, strokes: solid(RED) }) }));
    await expect(exportNode(doc, ids.r, { format: "PNG" })).rejects.toThrow("PNG and JPG export need the drawing engine (CanvasKit), which isn't loaded.");
    await expect(exportNode(doc, ids.r, { format: "PNG", constraint: { type: "SCALE", value: 0 } }, { canvasKit: ck })).rejects.toThrow("The scale must be a number greater than 0.");
    await expect(exportNode(doc, ids.r, { format: "JPG", quality: 101 }, { canvasKit: ck })).rejects.toThrow("JPG quality must be a number from 0 to 100.");
    await expect(exportNode(doc, ids.r, { format: "GIF" } as never, { canvasKit: ck })).rejects.toThrow(ExportError);
    // A butt-capped line 1 wide has height 1: fine. A fixed height on a zero-height box isn't.
    const { doc: d2, ids: i2 } = build((add, p) => ({ g: add("FRAME", p, { width: 10, height: 0 }) }));
    await expect(exportNode(d2, i2.g, { format: "PNG", constraint: { type: "HEIGHT", value: 10 } }, { canvasKit: ck })).rejects.toThrow("has no height");
    expect((await exportNode(doc, ids.l, { format: "PNG" }, { canvasKit: ck })).height).toBe(1);
  });
});
