// QC round 6: a top-level frame with thousands of children records them in
// chunks, so editing one layer re-records its chunk, not the whole frame.
// CPU surface: CanvasKit runs in Node.
import { beforeAll, describe, expect, it } from "vitest";
import CanvasKitInit, { type CanvasKit, type Surface } from "canvaskit-wasm";
import { Document } from "@illigma/core";
import type { Color, NodeId } from "@illigma/format";
import { CHUNK_THRESHOLD, PageRenderer, type Camera } from "./index.js";

const RED: Color = { r: 1, g: 0, b: 0, a: 1 };
const BLUE: Color = { r: 0, g: 0, b: 1, a: 1 };
const GREEN: Color = { r: 0, g: 1, b: 0, a: 1 };
const solid = (color: Color) => [{ type: "SOLID" as const, visible: true, color }];
const AT_ORIGIN: Camera = { x: 0, y: 0, zoom: 1 };
/** Time budgets are tuned on a laptop. Shared CI runners are slower, so CI gets 3x (or PERF_BUDGET_SCALE). */
const budget = (ms: number) => ms * (Number(process.env.PERF_BUDGET_SCALE) || (process.env.CI ? 3 : 1));

let ck: CanvasKit;
beforeAll(async () => {
  ck = await CanvasKitInit();
});

/** A 200 × 200 frame holding `n` 2 × 2 red squares in a 100-wide grid, the first at (0, 0). */
function grid(n: number) {
  const doc = new Document("Chunks");
  const ids = doc.transact("Build", (tx) => {
    const page = tx.addPage("Page");
    const frame = tx.create("FRAME", page, { width: 200, height: 200 });
    const cells: NodeId[] = [];
    for (let i = 0; i < n; i++) cells.push(tx.create("RECTANGLE", frame, { x: (i % 100) * 2, y: Math.floor(i / 100) * 2, width: 2, height: 2, fills: solid(RED) }));
    return { page, frame, cells };
  });
  const surface = ck.MakeSurface(200, 200) as Surface;
  const renderer = new PageRenderer(ck, surface, doc, ids.page);
  const pixel = (x: number, y: number): number[] => {
    const px = surface.getCanvas().readPixels(x, y, { width: 1, height: 1, colorType: ck.ColorType.RGBA_8888, alphaType: ck.AlphaType.Unpremul, colorSpace: ck.ColorSpace.SRGB });
    return Array.from(px as Uint8Array).slice(0, 3);
  };
  return { doc, renderer, pixel, ...ids };
}

describe("chunked recording of big frames", () => {
  it("draws, recolours, moves, reorders, hides and deletes children of a chunked frame correctly", () => {
    const { doc, frame, cells, renderer, pixel } = grid(CHUNK_THRESHOLD * 4);
    const first = renderer.render(AT_ORIGIN);
    expect(first.nodes).toBe(CHUNK_THRESHOLD * 4 + 1);
    expect(pixel(1, 1)).toEqual([255, 0, 0]);
    expect(pixel(199, 19)).toEqual([255, 0, 0]); // cell 999 at (198, 18)

    doc.transact("Recolour", (tx) => tx.set(cells[999]!, "fills", solid(BLUE)));
    expect(renderer.render(AT_ORIGIN)).toMatchObject({ recorded: 1, nodes: CHUNK_THRESHOLD * 4 + 1 });
    expect(pixel(199, 19)).toEqual([0, 0, 255]);
    expect(pixel(1, 1)).toEqual([255, 0, 0]);

    // Moving a child: it draws at its new place and nothing stays behind.
    doc.transact("Move", (tx) => tx.set(cells[0]!, "y", 100));
    renderer.render(AT_ORIGIN);
    expect(pixel(1, 101)).toEqual([255, 0, 0]);
    expect(pixel(1, 1)[0]).toBeLessThan(100);

    // A child brought to the front (a reorder) covers the one below it.
    doc.transact("Green", (tx) => tx.create("RECTANGLE", frame, { x: 0, y: 100, width: 2, height: 2, fills: solid(GREEN) }, "first"));
    renderer.render(AT_ORIGIN);
    expect(pixel(1, 101)).toEqual([255, 0, 0]); // the green one is at the back
    const green = doc.children(frame)[0]!.id;
    doc.transact("To front", (tx) => tx.move(green, frame, "last"));
    renderer.render(AT_ORIGIN);
    expect(pixel(1, 101)).toEqual([0, 255, 0]);

    // The frame's own changes keep its chunks: it moves as a whole.
    doc.transact("Move frame", (tx) => tx.set(frame, "x", -10));
    renderer.render(AT_ORIGIN);
    expect(pixel(189, 19)).toEqual([0, 0, 255]);
    expect(pixel(199, 19)[2]).toBeLessThan(100);
    doc.transact("Hide", (tx) => tx.set(frame, "visible", false));
    expect(renderer.render(AT_ORIGIN).nodes).toBe(0);
    doc.transact("Show", (tx) => tx.set(frame, "visible", true));
    renderer.render(AT_ORIGIN);
    expect(pixel(189, 19)).toEqual([0, 0, 255]);

    doc.transact("Delete", (tx) => tx.delete(cells[999]!));
    renderer.render(AT_ORIGIN);
    expect(pixel(189, 19)[2]).toBeLessThan(100);
    doc.undo();
    renderer.render(AT_ORIGIN);
    expect(pixel(189, 19)).toEqual([0, 0, 255]);
  });

  it("a change deep inside a child re-records its chunk only", () => {
    const { doc, frame, renderer, pixel } = grid(CHUNK_THRESHOLD * 2);
    const inner = doc.transact("Nest", (tx) => {
      const group = tx.create("FRAME", frame, { x: 100, y: 150, width: 20, height: 20 }, "last");
      return tx.create("RECTANGLE", group, { width: 20, height: 20, fills: solid(RED) });
    });
    renderer.render(AT_ORIGIN);
    expect(pixel(110, 160)).toEqual([255, 0, 0]);
    doc.transact("Recolour", (tx) => tx.set(inner, "fills", solid(GREEN)));
    renderer.render(AT_ORIGIN);
    expect(pixel(110, 160)).toEqual([0, 255, 0]);
  });

  it("editing one of 12,000 children costs a chunk, not the frame", () => {
    const { doc, cells, renderer } = grid(12_000);
    const full = renderer.render(AT_ORIGIN).recordMs;
    const steps: number[] = [];
    for (let i = 1; i <= 20; i++) {
      doc.transact("Move", (tx) => tx.set(cells[6000]!, "x", i));
      steps.push(renderer.render(AT_ORIGIN).recordMs);
    }
    steps.sort((a, b) => a - b);
    const median = steps[10]!;
    expect(median, `full ${full.toFixed(1)} ms, one edit ${median.toFixed(2)} ms`).toBeLessThan(Math.max(budget(3), full / 10));
  });

  it("draws images in a chunked frame once they are decoded, and frees images nothing draws any more", async () => {
    // QC round 7: images inside chunks (and on the chunked frame itself) never appeared, because nothing re-recorded the frame.
    const png = (color: Float32Array) => {
      const s = ck.MakeSurface(4, 4) as Surface;
      s.getCanvas().clear(color);
      const img = s.makeImageSnapshot();
      const bytes = img.encodeToBytes() as Uint8Array;
      img.delete();
      s.delete();
      return bytes;
    };
    const doc = new Document("Chunked images");
    let ready = 0;
    const ids = doc.transact("Build", (tx) => {
      const page = tx.addPage("Page");
      const blue = doc.addImage(png(ck.BLUE));
      const green = doc.addImage(png(ck.GREEN));
      const frame = tx.create("FRAME", page, { width: 200, height: 200, fills: [{ type: "IMAGE", visible: true, imageHash: blue, scaleMode: "FILL" }] });
      const cells: NodeId[] = [];
      for (let i = 0; i < 300; i++) cells.push(tx.create("RECTANGLE", frame, { x: (i % 100) * 2, y: Math.floor(i / 100) * 2, width: 2, height: 2, fills: solid(RED) }));
      const photo = tx.create("RECTANGLE", frame, { x: 100, y: 100, width: 50, height: 50, fills: [{ type: "IMAGE", visible: true, imageHash: green, scaleMode: "FILL" }] });
      return { page, frame, cells, photo };
    });
    expect(doc.children(ids.frame).length).toBe(301);
    expect(doc.children(ids.frame).length).toBeGreaterThan(CHUNK_THRESHOLD);
    const surface = ck.MakeSurface(200, 200) as Surface;
    const renderer = new PageRenderer(ck, surface, doc, ids.page, 1, { onImageReady: () => ready++ });
    const pixel = (x: number, y: number): number[] => {
      const px = surface.getCanvas().readPixels(x, y, { width: 1, height: 1, colorType: ck.ColorType.RGBA_8888, alphaType: ck.AlphaType.Unpremul, colorSpace: ck.ColorSpace.SRGB });
      return Array.from(px as Uint8Array).slice(0, 3);
    };
    renderer.render(AT_ORIGIN);
    expect(pixel(1, 1)).toEqual([255, 0, 0]);
    await renderer.whenImagesReady();
    expect(ready).toBeGreaterThan(0);
    expect(renderer.render(AT_ORIGIN).recorded).toBe(1);
    expect(pixel(50, 150)).toEqual([0, 0, 255]); // the frame's own image fill
    expect(pixel(125, 125)).toEqual([0, 255, 0]); // the image in a chunk
    expect(pixel(1, 1)).toEqual([255, 0, 0]);

    // An edit to another chunk keeps the image.
    doc.transact("Recolour", (tx) => tx.set(ids.cells[0]!, "fills", solid(BLUE)));
    renderer.render(AT_ORIGIN);
    expect(pixel(125, 125)).toEqual([0, 255, 0]);

    // Deleting the photo frees its decoded image; the frame's image stays.
    const images = (renderer as unknown as { images: Map<string, unknown> }).images;
    expect(images.size).toBe(2);
    doc.transact("Delete", (tx) => tx.delete(ids.photo));
    renderer.render(AT_ORIGIN);
    expect(images.size).toBe(1);
    expect(pixel(125, 125)).toEqual([0, 0, 255]);
    // Undo brings it back: decoded again.
    doc.undo();
    renderer.render(AT_ORIGIN);
    await renderer.whenImagesReady();
    renderer.render(AT_ORIGIN);
    expect(pixel(125, 125)).toEqual([0, 255, 0]);
    renderer.dispose();
  });
});
