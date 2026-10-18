// Renderer tests on a CPU surface: CanvasKit runs in Node, so no browser or GPU is needed.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import CanvasKitInit, { type CanvasKit, type Surface } from "canvaskit-wasm";
import { Document } from "@illigma/core";
import type { Color, Node, NodeId, NodeType } from "@illigma/format";
import { PageRenderer, type Camera, type RendererOptions } from "./index.js";

type Fields = Partial<Omit<Node, "id" | "type" | "parentId" | "index">>;

const RED: Color = { r: 1, g: 0, b: 0, a: 1 };
const BLUE: Color = { r: 0, g: 0, b: 1, a: 1 };
const solid = (color: Color) => [{ type: "SOLID" as const, visible: true, color }];
const AT_ORIGIN: Camera = { x: 0, y: 0, zoom: 1 };
const INTER = fileURLToPath(new URL("../../../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2", import.meta.url));

let ck: CanvasKit;
beforeAll(async () => {
  ck = await CanvasKitInit();
});

function setup(build: (add: (type: NodeType, parent: NodeId, fields?: Fields) => NodeId, page: NodeId) => void, options: RendererOptions = {}) {
  const doc = new Document("Render");
  let page = "";
  doc.transact("Build", (tx) => {
    page = tx.addPage("Page");
    build((type, parent, fields = {}) => tx.create(type, parent, fields), page);
  });
  const surface = ck.MakeSurface(200, 200) as Surface;
  const renderer = new PageRenderer(ck, surface, doc, page, 1, options);
  /** RGBA 0–255 of one pixel. */
  const pixel = (x: number, y: number): number[] => {
    const px = surface.getCanvas().readPixels(x, y, { width: 1, height: 1, colorType: ck.ColorType.RGBA_8888, alphaType: ck.AlphaType.Unpremul, colorSpace: ck.ColorSpace.SRGB });
    return Array.from(px as Uint8Array);
  };
  return { doc, page, renderer, pixel };
}

describe("PageRenderer", () => {
  it("applies a node's opacity to its children as a group", () => {
    const { renderer, pixel } = setup((add, p) => {
      const frame = add("FRAME", p, { x: 0, y: 0, width: 100, height: 100, opacity: 0.5 });
      add("RECTANGLE", frame, { x: 0, y: 0, width: 100, height: 100, fills: solid(RED) });
    });
    renderer.render(AT_ORIGIN);
    const [r] = pixel(50, 50);
    // 50% red over the dark canvas (≈ 30) is ≈ 143; full red would be 255.
    expect(r).toBeGreaterThan(130);
    expect(r).toBeLessThan(156);
  });

  it("re-records only the top-level children an edit touched", () => {
    let a = "", b = "", rectA = "";
    const { doc, page, renderer, pixel } = setup((add, p) => {
      a = add("FRAME", p, { x: 0, y: 0, width: 50, height: 50 });
      rectA = add("RECTANGLE", a, { x: 0, y: 0, width: 50, height: 50, fills: solid(RED) });
      b = add("FRAME", p, { x: 100, y: 0, width: 50, height: 50 });
      add("RECTANGLE", b, { x: 0, y: 0, width: 50, height: 50, fills: solid(BLUE) });
    });
    expect(renderer.render(AT_ORIGIN).recorded).toBe(2);
    expect(renderer.render(AT_ORIGIN).recorded).toBe(0); // nothing changed, nothing recorded

    doc.transact("Recolour", (tx) => tx.set(rectA, "fills", solid(BLUE)));
    const stats = renderer.render(AT_ORIGIN);
    expect(stats.recorded).toBe(1);
    expect(pixel(25, 25).slice(0, 3)).toEqual([0, 0, 255]);

    // Moving a layer between screens re-records both.
    doc.transact("Move", (tx) => tx.move(rectA, b));
    expect(renderer.render(AT_ORIGIN).recorded).toBe(2);
    expect(pixel(25, 25)[2]).toBeLessThan(100); // gone from screen A

    // Undo puts it back, again touching both.
    doc.undo();
    expect(renderer.render(AT_ORIGIN).recorded).toBe(2);
    expect(pixel(25, 25).slice(0, 3)).toEqual([0, 0, 255]);

    // Deleting a whole screen records nothing new; adding one records just it.
    doc.transact("Delete", (tx) => tx.delete(b));
    expect(renderer.render(AT_ORIGIN).recorded).toBe(0);
    expect(pixel(125, 25)[2]).toBeLessThan(100);
    doc.transact("Add", (tx) => void tx.create("RECTANGLE", page, { x: 100, y: 100, width: 20, height: 20, fills: solid(RED) }));
    expect(renderer.render(AT_ORIGIN).recorded).toBe(1);
    expect(pixel(110, 110).slice(0, 3)).toEqual([255, 0, 0]);
  });

  it("doesn't cull content drawn outside a node's box", () => {
    const { renderer, pixel } = setup((add, p) => {
      // A group's child far outside the group's own box.
      const g = add("GROUP", p, { x: 0, y: 0, width: 10, height: 10 });
      add("RECTANGLE", g, { x: 500, y: 500, width: 20, height: 20, fills: solid(RED) });
      // A thick stroke reaching 10 past its rectangle's edge.
      add("RECTANGLE", p, { x: 0, y: 0, width: 10, height: 10, strokes: solid(BLUE), strokeWeight: 20 });
    });
    renderer.render({ x: 490, y: 490, zoom: 1 });
    expect(pixel(20, 20).slice(0, 3)).toEqual([255, 0, 0]);
    renderer.render({ x: -20, y: -20, zoom: 1 });
    expect(pixel(13, 25).slice(0, 3)).toEqual([0, 0, 255]); // world (−7, 5): stroke only
  });

  it("draws text with a loaded font, and a placeholder bar without one", () => {
    const text: Fields = { x: 0, y: 0, width: 150, height: 40, characters: "Hello", fontFamily: "Inter", fontSize: 32, lineHeight: 40, fills: solid(RED) };
    const reds = (pixel: (x: number, y: number) => number[]) => {
      let n = 0;
      for (let y = 0; y < 40; y += 2) for (let x = 0; x < 150; x += 2) if ((pixel(x, y)[0] as number) > 200) n++;
      return n;
    };
    const bar = setup((add, p) => void add("TEXT", p, text));
    bar.renderer.render(AT_ORIGIN);
    expect(bar.pixel(140, 20).slice(0, 3)).toEqual([255, 0, 0]); // the bar spans the full width
    expect(bar.pixel(140, 4)[0]).toBeLessThan(100);

    if (!existsSync(INTER)) return; // the font comes from the bench's @fontsource/inter
    const buf = readFileSync(INTER);
    const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    const real = setup((add, p) => void add("TEXT", p, text), { fonts: [{ family: "Inter", data }] });
    real.renderer.render(AT_ORIGIN);
    const glyphs = reds(real.pixel);
    expect(glyphs).toBeGreaterThan(20); // glyph pixels were drawn…
    expect(glyphs).toBeLessThan(reds(bar.pixel)); // …and they are not the solid bar
    expect(real.pixel(140, 20)[0]).toBeLessThan(100); // "Hello" at 32 px ends before x = 140
  });

  it("hit-tests in screen space through the camera", () => {
    let rect = "";
    const { renderer } = setup((add, p) => {
      const f = add("FRAME", p, { x: 100, y: 100, width: 50, height: 50 });
      rect = add("RECTANGLE", f, { x: 0, y: 0, width: 10, height: 10 });
    });
    const camera: Camera = { x: 100, y: 100, zoom: 2 };
    expect(renderer.hitTest(10, 10, camera, true)).toBe(rect); // world (105, 105)
    expect(renderer.hitTest(10, 10, camera)).not.toBe(rect); // top-level frame by default
    expect(renderer.hitTest(150, 150, camera)).toBeNull(); // world (175, 175)
  });
});
