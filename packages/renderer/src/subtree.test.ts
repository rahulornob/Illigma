// drawSubtree and layoutText: the renderer API that export uses (CPU surface, CanvasKit in Node).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { beforeAll, describe, expect, it } from "vitest";
import CanvasKitInit, { type CanvasKit, type Surface } from "canvaskit-wasm";
import { Document } from "@illigma/core";
import type { Color } from "@illigma/format";
import { PageRenderer, type RenderSource } from "./index.js";

const RED: Color = { r: 1, g: 0, b: 0, a: 1 };
const solid = (color: Color) => [{ type: "SOLID" as const, visible: true, color }];

let ck: CanvasKit;
beforeAll(async () => {
  ck = await CanvasKitInit();
});

function inter(): ArrayBuffer {
  const buf = readFileSync(createRequire(import.meta.url).resolve("@fontsource/inter/files/inter-latin-400-normal.woff2"));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

describe("PageRenderer.drawSubtree", () => {
  it("draws one node and its children onto any canvas, in its parent's space, from a read-only source", () => {
    const doc = new Document("Subtree");
    let frame = "", other = "";
    doc.transact("Build", (tx) => {
      const page = tx.addPage("Page");
      frame = tx.create("FRAME", page, { x: 10, y: 10, width: 50, height: 50 });
      tx.create("RECTANGLE", frame, { x: 0, y: 0, width: 50, height: 50, fills: solid(RED) });
      other = tx.create("RECTANGLE", page, { x: 70, y: 10, width: 20, height: 20, fills: solid(RED) });
    });
    // A source without change events, as export passes.
    const source: RenderSource = { get: (id) => doc.get(id), children: (id) => doc.children(id), subscribe: () => () => {} };
    const surface = ck.MakeSurface(100, 100) as Surface;
    const renderer = new PageRenderer(ck, surface, source, "", 1);
    const canvas = surface.getCanvas();
    canvas.clear(ck.TRANSPARENT);
    expect(renderer.drawSubtree(canvas, frame)).toBe(2);
    expect(renderer.drawSubtree(canvas, "missing")).toBe(0);
    const alpha = (x: number, y: number) => (canvas.readPixels(x, y, { width: 1, height: 1, colorType: ck.ColorType.RGBA_8888, alphaType: ck.AlphaType.Unpremul, colorSpace: ck.ColorSpace.SRGB }) as Uint8Array)[3];
    expect(alpha(30, 30)).toBe(255);
    expect(alpha(5, 5)).toBe(0);
    expect(alpha(80, 20)).toBe(0); // only the subtree asked for
    renderer.dispose();
    surface.delete();
    expect(other).not.toBe("");
  });
});

describe("PageRenderer.layoutText", () => {
  it("breaks text into lines where it draws them, with baselines", () => {
    const doc = new Document("Text");
    let text = "", rect = "";
    doc.transact("Build", (tx) => {
      const page = tx.addPage("Page");
      text = tx.create("TEXT", page, { width: 50, height: 100, characters: "alpha beta gamma\ndelta", fontSize: 12, lineHeight: 20, fontFamily: "Inter", fills: solid(RED) });
      rect = tx.create("RECTANGLE", page, {});
    });
    const surface = ck.MakeSurface(10, 10) as Surface;
    const bare = new PageRenderer(ck, surface, doc, "", 1);
    expect(bare.layoutText(text)).toBeNull(); // no fonts
    bare.dispose();
    const renderer = new PageRenderer(ck, surface, doc, "", 1, { fonts: [{ family: "Inter", data: inter() }] });
    const lines = renderer.layoutText(text);
    expect(lines?.map((l) => l.text)).toEqual(["alpha", "beta", "gamma", "delta"]);
    const baselines = (lines ?? []).map((l) => l.baseline);
    // 20 px lines; each baseline 20 below the last.
    for (let i = 1; i < baselines.length; i++) expect((baselines[i] as number) - (baselines[i - 1] as number)).toBeCloseTo(20, 3);
    expect(renderer.layoutText(rect)).toBeNull();
    renderer.dispose();
    surface.delete();
  });
});
