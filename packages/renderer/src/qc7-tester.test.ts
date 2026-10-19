// QC round 7 (tester): fast shadow spread and wide blurs on CPU surfaces,
// text strokes, layoutText metrics, and images added after a paint used them.
// CPU surfaces: CanvasKit runs in Node.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { beforeAll, describe, expect, it } from "vitest";
import CanvasKitInit, { type Canvas, type CanvasKit, type ImageFilter, type Surface } from "canvaskit-wasm";
import { Document } from "@illigma/core";
import type { Color, Effect, Node, NodeId, NodeType } from "@illigma/format";
import { PageRenderer, type Camera } from "./index.js";
import { imagePixelScale } from "./paint.js";
import { blurReduction, passSteps, spreadReduction, SPREAD_BUDGET } from "./spread.js";

type Fields = Partial<Omit<Node, "id" | "type" | "parentId" | "index">>;
const RED: Color = { r: 1, g: 0, b: 0, a: 1 };
const WHITE: Color = { r: 1, g: 1, b: 1, a: 1 };
const BLUE: Color = { r: 0, g: 0.5, b: 1, a: 1 };
const solid = (color: Color) => [{ type: "SOLID" as const, visible: true, color }];
const AT_ORIGIN: Camera = { x: 0, y: 0, zoom: 1 };
/** Time budgets are tuned on a laptop. Shared CI runners are slower, so CI gets 3x (or PERF_BUDGET_SCALE). */
const budget = (ms: number) => ms * (Number(process.env.PERF_BUDGET_SCALE) || (process.env.CI ? 3 : 1));
const shadow = (type: "DROP_SHADOW" | "INNER_SHADOW", x: number, y: number, radius: number, spread: number, color: Color = { r: 0.8, g: 0, b: 0, a: 0.7 }): Effect =>
  ({ type, color, offset: { x, y }, radius, spread, visible: true }) as Effect;

let ck: CanvasKit;
let inter: ArrayBuffer;
beforeAll(async () => {
  ck = await CanvasKitInit();
  const buf = readFileSync(createRequire(import.meta.url).resolve("@fontsource/inter/files/inter-latin-400-normal.woff2"));
  inter = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
});

/** A document with one page; `build` adds layers to it. */
function scene(build: (add: (type: NodeType, parent: NodeId, fields?: Fields) => NodeId, page: NodeId) => void) {
  const doc = new Document("QC7");
  let page = "";
  doc.transact("Build", (tx) => {
    page = tx.addPage("Page");
    build((type, parent, fields = {}) => tx.create(type, parent, fields), page);
  });
  return { doc, page };
}

/** A group holding a rectangle, a half-transparent ellipse, a thin tilted line and text: pixels with every kind of edge. */
function busyGroup(add: (type: NodeType, parent: NodeId, fields?: Fields) => NodeId, parent: NodeId, effects: Effect[]): NodeId {
  const g = add("GROUP", parent, { x: 40, y: 40, width: 120, height: 110, effects });
  add("RECTANGLE", g, { x: 0, y: 0, width: 50, height: 40, fills: solid(BLUE) });
  add("ELLIPSE", g, { x: 70, y: 10, width: 40, height: 40, fills: solid({ r: 0, g: 0.8, b: 0, a: 0.5 }) });
  add("LINE", g, { x: 5, y: 70, width: 110, height: 0, rotation: -8, strokes: solid({ r: 0, g: 0, b: 0, a: 1 }), strokeWeight: 1.5 });
  add("TEXT", g, { x: 5, y: 80, width: 115, height: 30, characters: "Spread", fontSize: 22, fills: solid({ r: 0.1, g: 0.1, b: 0.1, a: 1 }) });
  return g;
}

const read = (surface: Surface, w: number, h: number) =>
  surface.getCanvas().readPixels(0, 0, { width: w, height: h, colorType: ck.ColorType.RGBA_8888, alphaType: ck.AlphaType.Unpremul, colorSpace: ck.ColorSpace.SRGB }) as Uint8Array;

/** Largest per-channel difference, and how many pixels differ by more than `tol`. */
function compare(a: Uint8Array, b: Uint8Array, tol = 2) {
  let max = 0, over = 0;
  for (let i = 0; i < a.length; i += 4) {
    const d = Math.max(Math.abs(a[i]! - b[i]!), Math.abs(a[i + 1]! - b[i + 1]!), Math.abs(a[i + 2]! - b[i + 2]!), Math.abs(a[i + 3]! - b[i + 3]!));
    max = Math.max(max, d);
    if (d > tol) over++;
  }
  return { max, over };
}

/**
 * The same group drawn by `drawSubtree` without its effects, inside a layer
 * whose filter is the effect built from Skia's own (slow, exact) morphology:
 * the way pixel-based shadows were drawn before QC round 7.
 */
function reference(effect: Effect, size = 200): Uint8Array {
  const { doc, page } = scene((add, page) => void busyGroup(add, page, []));
  const g = doc.children(page)[0]!.id;
  const surface = ck.MakeSurface(size, size) as Surface;
  const renderer = new PageRenderer(ck, surface, doc, page, 1, { fonts: [{ family: "Inter", data: inter }] });
  const canvas = surface.getCanvas();
  canvas.clear(ck.Color4f(0.118, 0.118, 0.125, 1));
  const IF = ck.ImageFilter;
  const d = effect as Extract<Effect, { type: "DROP_SHADOW" | "INNER_SHADOW" }>;
  const s = d.spread ?? 0;
  const color = ck.Color4f(d.color.r, d.color.g, d.color.b, d.color.a);
  let filter: ImageFilter;
  if (d.type === "DROP_SHADOW") {
    const grown = s > 0 ? IF.MakeDilate(s, s, null) : s < 0 ? IF.MakeErode(-s, -s, null) : null;
    const shade = IF.MakeDropShadowOnly(d.offset.x, d.offset.y, d.radius / 2, d.radius / 2, color, grown);
    filter = IF.MakeBlend(ck.BlendMode.SrcOver, IF.MakeBlend(ck.BlendMode.DstOut, shade, null), null);
  } else {
    const inverted = IF.MakeColorFilter(ck.ColorFilter.MakeMatrix([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 1]), null);
    const grown = s > 0 ? IF.MakeDilate(s, s, inverted) : s < 0 ? IF.MakeErode(-s, -s, inverted) : inverted;
    filter = IF.MakeBlend(ck.BlendMode.SrcATop, null, IF.MakeDropShadowOnly(d.offset.x, d.offset.y, d.radius / 2, d.radius / 2, color, grown));
  }
  const paint = new ck.Paint();
  paint.setImageFilter(filter);
  canvas.saveLayer(paint);
  renderer.drawSubtree(canvas, g);
  canvas.restore();
  surface.flush();
  return read(surface, size, size);
}

function rendered(effect: Effect, size = 200): Uint8Array {
  const { doc, page } = scene((add, page) => void busyGroup(add, page, [effect]));
  const surface = ck.MakeSurface(size, size) as Surface;
  new PageRenderer(ck, surface, doc, page, 1, { fonts: [{ family: "Inter", data: inter }] }).render(AT_ORIGIN);
  return read(surface, size, size);
}

describe("QC round 7: shadow spread from a layer's pixels", () => {
  it("covers a window of offsets with a few doubling passes", () => {
    expect(passSteps(1)).toEqual([1]);
    expect(passSteps(20)).toEqual([1, 2, 4, 8, 5]);
    expect(passSteps(600).length).toBe(10);
    for (const w of [1, 2, 3, 7, 64, 99, 1000]) expect(passSteps(w).reduce((a, b) => a + b, 0)).toBe(w);
    // Only reduced when the passes would cost too much, never past 16x for spread; blurs reduce while sigma stays ≥ 4 reduced px.
    expect(spreadReduction(10, 200 * 200)).toBe(1);
    expect(spreadReduction(300, 800 * 800)).toBeGreaterThan(1);
    expect(spreadReduction(5000, 4e6)).toBeLessThanOrEqual(16);
    expect(spreadReduction(5000, 4e6)).toBeGreaterThan(4);
    const k = spreadReduction(300, 800 * 800);
    expect(((800 * 800) / (k * k)) * 2 * passSteps(Math.round(600 / k)).length).toBeLessThanOrEqual(SPREAD_BUDGET);
    expect(blurReduction(5)).toBe(1);
    expect(blurReduction(8)).toBe(2);
    expect(blurReduction(16)).toBe(4);
    expect(blurReduction(500)).toBe(64);
  });

  it("matches Skia's own morphology on groups, text and thin lines: drop shadows grown and shrunk, inner shadows", () => {
    for (const effect of [
      shadow("DROP_SHADOW", 3, 4, 0, 7),
      shadow("DROP_SHADOW", 3, 4, 6, 7),
      shadow("DROP_SHADOW", 2, 2, 4, -3),
      shadow("INNER_SHADOW", 3, 3, 4, 5),
      shadow("INNER_SHADOW", 3, 3, 4, -5),
      shadow("INNER_SHADOW", 4, 4, 10, 0),
    ]) {
      const { max, over } = compare(rendered(effect), reference(effect));
      expect(max, JSON.stringify(effect)).toBeLessThanOrEqual(6);
      expect(over, JSON.stringify(effect)).toBeLessThan(40);
    }
  });

  it("keeps a group's shadow outside its bounds, and knocks it out only where the group draws", () => {
    const { doc, page } = scene((add, page) => {
      const g = add("GROUP", page, { x: 50, y: 50, width: 40, height: 40, effects: [shadow("DROP_SHADOW", 60, 0, 0, 0, RED)] });
      add("RECTANGLE", g, { x: 0, y: 0, width: 40, height: 40, fills: solid({ r: 1, g: 1, b: 1, a: 0.5 }) });
    });
    const surface = ck.MakeSurface(200, 200) as Surface;
    new PageRenderer(ck, surface, doc, page, 1).render(AT_ORIGIN);
    const px = read(surface, 200, 200);
    const at = (x: number, y: number) => Array.from(px.slice((y * 200 + x) * 4, (y * 200 + x) * 4 + 3));
    // The shadow, 60 px to the right, well past the group's bounds: half as strong as the half-transparent group.
    expect(Math.abs(at(130, 70)[0]! - Math.round(0.5 * 255 + 0.5 * at(10, 10)[0]!))).toBeLessThanOrEqual(3);
    expect(at(130, 70)[1]).toBeLessThan(40);
    expect(at(100, 70)).toEqual(at(10, 10)); // between them: nothing
    // Under the half-transparent group, no shadow shows (it is knocked out there).
    expect(at(60, 70)[0]).toBeLessThan(160);
  });

  it("grows by the spread at reduced resolution when the spread is huge (within a few pixels)", () => {
    const { doc, page } = scene((add, page) => {
      const g = add("GROUP", page, { x: 900, y: 950, width: 200, height: 100, effects: [shadow("DROP_SHADOW", 0, 0, 0, 300, RED)] });
      add("RECTANGLE", g, { x: 0, y: 0, width: 200, height: 100, fills: solid(WHITE) });
    });
    const surface = ck.MakeSurface(2000, 2000) as Surface;
    new PageRenderer(ck, surface, doc, page, 1).render(AT_ORIGIN);
    const pixel = (x: number, y: number) => Array.from(read1(surface, x, y));
    expect(pixel(900 - 290, 1000)[0]).toBeGreaterThan(200); // inside the spread
    expect(pixel(900 - 290, 1000)[1]).toBeLessThan(40);
    expect(pixel(900 - 312, 1000)[0]).toBeLessThan(60); // past it
    expect(pixel(1100 + 290, 1050 + 290)[0]).toBeGreaterThan(200); // the corner stays square
  });
});

function read1(surface: Surface, x: number, y: number): Uint8Array {
  return surface.getCanvas().readPixels(x, y, { width: 1, height: 1, colorType: ck.ColorType.RGBA_8888, alphaType: ck.AlphaType.Unpremul, colorSpace: ck.ColorSpace.SRGB }) as Uint8Array;
}

// Budgets are about 3x the times measured alone (the whole suite runs in parallel); before the fix these took 7–180 s.
describe("QC round 7: pixel effects stay fast on a 2000 × 2000 CPU surface", () => {
  /** Median ms of drawing `camera` three times (each time re-recorded when `rerecord`). */
  function frames(effects: Effect[], camera: Camera = AT_ORIGIN) {
    const { doc, page } = scene((add, page) => {
      const g = add("GROUP", page, { x: 50, y: 50, width: 200, height: 100, effects });
      add("RECTANGLE", g, { x: 0, y: 0, width: 50, height: 50, fills: solid(BLUE) });
    });
    const surface = ck.MakeSurface(2000, 2000) as Surface;
    const renderer = new PageRenderer(ck, surface, doc, page, 1);
    const times: number[] = [];
    for (let i = 0; i < 3; i++) {
      const t = performance.now();
      renderer.render({ ...camera, x: camera.x + i });
      times.push(performance.now() - t);
    }
    renderer.dispose();
    surface.delete();
    return times.sort((a, b) => a - b)[1]!;
  }

  // Before QC round 7, spread 300 took about 72 s per frame here, and radius, spread and offset 1000 about 180 s.
  it("a group's drop shadow with spread 300", () => {
    expect(frames([shadow("DROP_SHADOW", 0, 0, 10, 300)])).toBeLessThan(budget(200));
  });
  it("radius, spread and offset 1000 (the shadow covers the whole surface)", () => {
    expect(frames([shadow("DROP_SHADOW", 1000, 1000, 1000, 1000)])).toBeLessThan(budget(1600));
  });
  it("inner shadows, eroding spread, and a layer blur of 1000", () => {
    expect(frames([shadow("INNER_SHADOW", 1000, 1000, 1000, 1000)])).toBeLessThan(budget(200));
    expect(frames([shadow("DROP_SHADOW", 5, 5, 10, -20)])).toBeLessThan(budget(200));
    // A layer that covers the whole surface costs about 240 ms in CanvasKit's CPU build, whatever the effect.
    expect(frames([{ type: "LAYER_BLUR", radius: 1000, visible: true }])).toBeLessThan(budget(1000));
  });
  it("at zoom 4, recorded again for that zoom", () => {
    expect(frames([shadow("DROP_SHADOW", 0, 0, 10, 300)], { x: 0, y: 0, zoom: 4 })).toBeLessThan(budget(1600));
  });

  it("export-style drawing at 4x (drawSubtree onto a scaled canvas)", () => {
    const { doc, page } = scene((add, page) => {
      const g = add("GROUP", page, { x: 0, y: 0, width: 200, height: 200, effects: [shadow("DROP_SHADOW", 10, 10, 10, 50)] });
      add("RECTANGLE", g, { x: 0, y: 0, width: 200, height: 200, fills: solid(BLUE) });
    });
    const g = doc.children(page)[0]!.id;
    const surface = ck.MakeSurface(1440, 1440) as Surface;
    const renderer = new PageRenderer(ck, surface, doc, page, 1);
    const canvas: Canvas = surface.getCanvas();
    const t = performance.now();
    canvas.save();
    canvas.scale(4, 4);
    canvas.translate(60, 60);
    renderer.drawSubtree(canvas, g);
    canvas.restore();
    surface.flush();
    expect(performance.now() - t).toBeLessThan(budget(1500)); // 35.7 s before
    // The spread reaches 50 units (200 px) out, plus the offset; the blur (sigma 5) fades it around there.
    expect(Math.abs(read1(surface, 4 * (60 + 200 + 10 + 35), 4 * (60 + 100))[3]! - Math.round(0.7 * 255))).toBeLessThanOrEqual(3);
    expect(read1(surface, 4 * (60 + 200 + 10 + 50), 4 * (60 + 100))[3]).toBeGreaterThan(60);
    expect(read1(surface, 4 * (60 + 200 + 10 + 50), 4 * (60 + 100))[3]).toBeLessThan(120);
    expect(read1(surface, 4 * (60 + 200 + 10 + 70), 4 * (60 + 100))[3]).toBeLessThan(3);
  });

  it("re-records layers with pixel effects when the zoom changes on the CPU, and only those", () => {
    const { doc, page } = scene((add, page) => {
      const g = add("GROUP", page, { x: 0, y: 0, width: 50, height: 50, effects: [shadow("DROP_SHADOW", 0, 0, 4, 10)] });
      add("RECTANGLE", g, { x: 0, y: 0, width: 50, height: 50, fills: solid(BLUE) });
      add("RECTANGLE", page, { x: 100, y: 0, width: 50, height: 50, fills: solid(BLUE) });
    });
    const surface = ck.MakeSurface(300, 300) as Surface;
    const renderer = new PageRenderer(ck, surface, doc, page, 1);
    expect(renderer.render(AT_ORIGIN).recorded).toBe(2);
    expect(renderer.render({ x: 0, y: 0, zoom: 1.2 }).recorded).toBe(0); // same power of two
    expect(renderer.render({ x: 0, y: 0, zoom: 2 }).recorded).toBe(1);
    expect(renderer.render({ x: 5, y: 0, zoom: 2 }).recorded).toBe(0);
  });
});

describe("QC round 7: text strokes", () => {
  /** One row of the left stem of a big "H": the fill's left edge, and red/white checks around it. */
  function stem(strokeAlign?: "CENTER" | "INSIDE" | "OUTSIDE") {
    const { doc, page } = scene((add, page) => {
      add("TEXT", page, {
        x: 20, y: 0, width: 260, height: 260, characters: "H", fontSize: 200, fills: solid(WHITE),
        ...(strokeAlign ? { strokes: solid(RED), strokeWeight: 6, strokeAlign } : {}),
      });
    });
    const surface = ck.MakeSurface(300, 260) as Surface;
    new PageRenderer(ck, surface, doc, page, 1, { fonts: [{ family: "Inter", data: inter }] }).render(AT_ORIGIN);
    const row = read(surface, 300, 260).slice(130 * 300 * 4, 131 * 300 * 4);
    const at = (x: number) => Array.from(row.slice(x * 4, x * 4 + 3));
    return { at };
  }
  const isRed = (p: number[]) => p[0]! > 200 && p[1]! < 60 && p[2]! < 60;
  const isWhite = (p: number[]) => p.every((v) => v > 220);
  const isBg = (p: number[]) => p.every((v) => v < 50);

  it("draws centred, inside and outside strokes on their side of the glyph outline", () => {
    const plain = stem();
    let edge = 0;
    while (edge < 300 && !isWhite(plain.at(edge))) edge++;
    expect(edge).toBeGreaterThan(20);
    expect(edge).toBeLessThan(80);
    const center = stem("CENTER");
    expect(isRed(center.at(edge - 2))).toBe(true);
    expect(isRed(center.at(edge + 1))).toBe(true);
    expect(isBg(center.at(edge - 6))).toBe(true);
    expect(isWhite(center.at(edge + 8))).toBe(true);
    const inside = stem("INSIDE");
    expect(isBg(inside.at(edge - 2))).toBe(true);
    expect(isRed(inside.at(edge + 2))).toBe(true);
    expect(isRed(inside.at(edge + 4))).toBe(true);
    expect(isWhite(inside.at(edge + 9))).toBe(true);
    const outside = stem("OUTSIDE");
    expect(isRed(outside.at(edge - 2))).toBe(true);
    expect(isRed(outside.at(edge - 5))).toBe(true);
    expect(isBg(outside.at(edge - 9))).toBe(true);
    expect(isWhite(outside.at(edge + 2))).toBe(true);
  });

  it("layoutText gives each line's ascent, descent and width", () => {
    const { doc, page } = scene((add, page) => void add("TEXT", page, { width: 400, height: 60, characters: "Hello\nWorld wide", fontSize: 20 }));
    const id = doc.children(page)[0]!.id;
    const surface = ck.MakeSurface(10, 10) as Surface;
    const lines = new PageRenderer(ck, surface, doc, page, 1, { fonts: [{ family: "Inter", data: inter }] }).layoutText(id)!;
    expect(lines).toHaveLength(2);
    for (const l of lines) {
      expect(l.ascent).toBeGreaterThan(10);
      expect(l.descent).toBeGreaterThan(2);
      expect(l.width).toBeGreaterThan(40);
    }
    expect(lines[1]!.width).toBeGreaterThan(lines[0]!.width!);
  });
});

describe("QC round 7: very large images pick a level by drawn size", () => {
  it("imagePixelScale: node units per image pixel for each scale mode", () => {
    const paint = (scaleMode: "FILL" | "FIT" | "TILE" | "CROP", extra = {}) => ({ type: "IMAGE" as const, visible: true, imageHash: null, scaleMode, ...extra });
    expect(imagePixelScale(paint("FILL"), 8000, 4000, 400, 400)).toBeCloseTo(0.1);
    expect(imagePixelScale(paint("FIT"), 8000, 4000, 400, 400)).toBeCloseTo(0.05);
    expect(imagePixelScale(paint("TILE", { scalingFactor: 0.25 }), 8000, 4000, 400, 400)).toBeCloseTo(0.25);
    // CROP showing the left half of the image across the whole box: 0.1 across, 0.05 down; their geometric mean.
    const half = paint("CROP", { imageTransform: [[0.5, 0, 0], [0, 1, 0]] });
    expect(imagePixelScale(half, 8000, 8000, 400, 400)).toBeCloseTo(Math.sqrt(0.1 * 0.05));
    expect(imagePixelScale(paint("FILL"), 0, 0, 400, 400)).toBe(0);
  });
});

describe("QC round 7: an image added after a paint used it", () => {
  it("draws once the document gains the file, and asks for a frame", async () => {
    const s = ck.MakeSurface(4, 4) as Surface;
    s.getCanvas().clear(ck.Color4f(1, 1, 0, 1));
    const img = s.makeImageSnapshot();
    const png = img.encodeToBytes() as Uint8Array;
    img.delete();
    const { createHash } = await import("node:crypto");
    const hash = createHash("sha256").update(png).digest("hex");
    const { doc, page } = scene((add, page) => {
      add("RECTANGLE", page, { width: 40, height: 40, fills: [{ type: "IMAGE", visible: true, imageHash: hash, scaleMode: "FILL" }] });
    });
    const surface = ck.MakeSurface(50, 50) as Surface;
    let frames = 0;
    const renderer = new PageRenderer(ck, surface, doc, page, 1, { onImageReady: () => frames++ });
    renderer.render(AT_ORIGIN);
    expect(Array.from(read1(surface, 20, 20)).slice(0, 3)).not.toEqual([255, 255, 0]); // missing: faint grey
    doc.addImage(png);
    expect(frames).toBe(1);
    renderer.render(AT_ORIGIN);
    await renderer.whenImagesReady();
    renderer.render(AT_ORIGIN);
    expect(Array.from(read1(surface, 20, 20)).slice(0, 3)).toEqual([255, 255, 0]);
    renderer.dispose();
  });
});
