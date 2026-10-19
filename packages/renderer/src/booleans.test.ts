// Booleans, per-point corner radius and arrow heads on a CPU surface (CanvasKit in Node).
import { beforeAll, describe, expect, it } from "vitest";
import CanvasKitInit, { type CanvasKit, type Surface } from "canvaskit-wasm";
import { Document } from "@illigma/core";
import type { Color } from "@illigma/format";
import { PageRenderer } from "./index.js";

const RED: Color = { r: 1, g: 0, b: 0, a: 1 };
const solid = (color: Color) => [{ type: "SOLID" as const, visible: true, color }];
let ck: CanvasKit;
beforeAll(async () => {
  ck = await CanvasKitInit();
});

function render(build: (doc: Document, page: string) => void) {
  const doc = new Document("B");
  let page = "";
  doc.transact("Build", (tx) => {
    page = tx.addPage("Page");
  });
  build(doc, page);
  const surface = ck.MakeSurface(200, 200) as Surface;
  const renderer = new PageRenderer(ck, surface, doc, page, 1);
  renderer.render({ x: 0, y: 0, zoom: 1 });
  const red = (x: number, y: number) => {
    const px = surface.getCanvas().readPixels(x, y, { width: 1, height: 1, colorType: ck.ColorType.RGBA_8888, alphaType: ck.AlphaType.Unpremul, colorSpace: ck.ColorSpace.SRGB }) as Uint8Array;
    return (px[0] as number) > 200 && (px[1] as number) < 60;
  };
  return { doc, red, renderer };
}

describe("PageRenderer: booleans", () => {
  it("draws the combined shape only, never the operands", () => {
    const { red } = render((doc, page) =>
      doc.transact("b", (tx) => {
        const b = tx.create("BOOLEAN_OPERATION", page, { width: 150, height: 100, booleanOperation: "EXCLUDE", fills: solid(RED) });
        tx.create("RECTANGLE", b, { width: 100, height: 100, fills: solid({ r: 0, g: 0, b: 1, a: 1 }) });
        tx.create("ELLIPSE", b, { x: 50, width: 100, height: 100, fills: solid({ r: 0, g: 0, b: 1, a: 1 }) });
      }),
    );
    expect(red(10, 10)).toBe(true); // A only
    expect(red(75, 50)).toBe(false); // both: excluded
    expect(red(140, 50)).toBe(true); // B only
  });

  it("rounds a vector's corners by the radius on each point", () => {
    const { red } = render((doc, page) =>
      doc.transact("b", (tx) =>
        void tx.create("VECTOR", page, {
          width: 100,
          height: 100,
          fills: solid(RED),
          vectorNetwork: {
            vertices: [{ x: 0, y: 0, cornerRadius: 40 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
            segments: [0, 1, 2, 3].map((i) => ({ start: i, end: (i + 1) % 4, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } })),
            regions: [{ windingRule: "NONZERO", loops: [[0, 1, 2, 3]] }],
          },
        }),
      ),
    );
    expect(red(3, 3)).toBe(false); // the rounded corner
    expect(red(97, 3)).toBe(true); // a square one
  });
});
