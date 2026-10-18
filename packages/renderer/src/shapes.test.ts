// Pixel tests for vectors, stars, polygons and lines, on a CPU surface (CanvasKit in Node), as in renderer.test.ts.
import { beforeAll, describe, expect, it } from "vitest";
import CanvasKitInit, { type CanvasKit, type Surface } from "canvaskit-wasm";
import { Document } from "@illigma/core";
import { vectorNetworkFromSvgPath, type Color, type Node, type NodeId, type NodeType } from "@illigma/format";
import { PageRenderer, type Camera } from "./index.js";

type Fields = Partial<Omit<Node, "id" | "type" | "parentId" | "index">>;

const RED: Color = { r: 1, g: 0, b: 0, a: 1 };
const BLUE: Color = { r: 0, g: 0, b: 1, a: 1 };
const solid = (color: Color) => [{ type: "SOLID" as const, visible: true, color }];
const AT_ORIGIN: Camera = { x: 0, y: 0, zoom: 1 };
/** A ring: a circle of radius 50 with a hole of radius 25. Both loops run the same way, so only even-odd leaves the hole. */
const RING = "M50 0 A50 50 0 1 1 49.999 0 Z M50 25 A25 25 0 1 1 49.999 25 Z";

let ck: CanvasKit;
beforeAll(async () => {
  ck = await CanvasKitInit();
});

function setup(build: (add: (type: NodeType, parent: NodeId, fields?: Fields) => NodeId, page: NodeId) => void) {
  const doc = new Document("Shapes");
  let page = "";
  doc.transact("Build", (tx) => {
    page = tx.addPage("Page");
    build((type, parent, fields = {}) => tx.create(type, parent, fields), page);
  });
  const surface = ck.MakeSurface(200, 200) as Surface;
  const renderer = new PageRenderer(ck, surface, doc, page, 1);
  const pixel = (x: number, y: number): number[] => {
    const px = surface.getCanvas().readPixels(x, y, { width: 1, height: 1, colorType: ck.ColorType.RGBA_8888, alphaType: ck.AlphaType.Unpremul, colorSpace: ck.ColorSpace.SRGB });
    return Array.from(px as Uint8Array).slice(0, 3);
  };
  const red = (x: number, y: number) => (pixel(x, y)[0] as number) > 200 && (pixel(x, y)[2] as number) < 60;
  const blue = (x: number, y: number) => (pixel(x, y)[2] as number) > 200 && (pixel(x, y)[0] as number) < 60;
  renderer.render(AT_ORIGIN);
  return { doc, page, renderer, pixel, red, blue };
}

describe("PageRenderer: path shapes", () => {
  it("draws a star with its first point at the top centre", () => {
    const { red } = setup((add, p) => void add("STAR", p, { width: 100, height: 100, fills: solid(RED) }));
    // Default: 5 points, inner radius 0.382 (Figma's).
    expect(red(50, 3)).toBe(true); // the top point
    expect(red(50, 50)).toBe(true);
    expect(red(70, 78)).toBe(true); // inside the lower right point, whose tip is at (79.4, 90.5)
    expect(red(50, 80)).toBe(false); // the notch between the two lower points, at y ≈ 69
    expect(red(30, 3)).toBe(false);
    expect(red(3, 3)).toBe(false);
  });

  it("follows pointCount and innerRadius", () => {
    const { red } = setup((add, p) => void add("STAR", p, { width: 100, height: 100, pointCount: 4, innerRadius: 0.3, fills: solid(RED) }));
    expect(red(50, 20)).toBe(true); // the top point
    expect(red(80, 50)).toBe(true); // 4 points, 90° apart: one at the right
    expect(red(75, 25)).toBe(false); // between points, outside the inner radius
  });

  it("draws polygons inscribed in their box, with rounded corners", () => {
    const { red } = setup((add, p) => {
      // Triangle: (50, 0), (93.3, 75), (6.7, 75), so the box's bottom quarter is empty, as in Figma.
      add("POLYGON", p, { width: 100, height: 100, fills: solid(RED) });
      add("POLYGON", p, { x: 100, width: 100, height: 100, pointCount: 4, cornerRadius: 20, fills: solid(RED) });
    });
    expect(red(50, 5)).toBe(true);
    expect(red(50, 70)).toBe(true);
    expect(red(50, 90)).toBe(false);
    expect(red(15, 30)).toBe(false);
    // Diamond with rounded corners: its tips are cut off.
    expect(red(150, 50)).toBe(true);
    expect(red(150, 2)).toBe(false);
    expect(red(150, 20)).toBe(true);
    expect(red(102, 50)).toBe(false);
  });

  it("fills a curved path by its regions' winding rule", () => {
    const { red } = setup((add, p) => {
      add("VECTOR", p, { width: 100, height: 100, fills: solid(RED), vectorNetwork: vectorNetworkFromSvgPath(RING, { windingRule: "EVENODD" }) });
      add("VECTOR", p, { x: 100, width: 100, height: 100, fills: solid(RED), vectorNetwork: vectorNetworkFromSvgPath(RING, { windingRule: "NONZERO" }) });
    });
    expect(red(50, 10)).toBe(true); // the ring
    expect(red(50, 50)).toBe(false); // the even-odd hole
    expect(red(4, 4)).toBe(false); // outside the circle, inside the box
    expect(red(150, 10)).toBe(true);
    expect(red(150, 50)).toBe(true); // non-zero: same-direction loops fill the hole
  });

  it("strokes paths along their segments, with caps and joins, and fills open paths as if closed", () => {
    const corner = vectorNetworkFromSvgPath("M10 10 L90 10 L90 90");
    const { red, blue } = setup((add, p) => {
      add("VECTOR", p, { width: 100, height: 100, strokes: solid(BLUE), strokeWeight: 6, vectorNetwork: corner });
      add("VECTOR", p, { x: 100, width: 100, height: 100, fills: solid(RED), vectorNetwork: corner });
    });
    expect(blue(50, 10)).toBe(true);
    expect(blue(90, 50)).toBe(true);
    expect(blue(92, 8)).toBe(true); // the mitred corner
    expect(blue(50, 50)).toBe(false); // no fill
    expect(blue(6, 10)).toBe(false); // no cap past the end
    expect(red(170, 30)).toBe(true); // implicit fill of the open path's triangle
    expect(red(130, 70)).toBe(false);
  });

  it("draws round caps and joins when asked", () => {
    const { blue } = setup((add, p) => {
      add("VECTOR", p, { width: 100, height: 100, strokes: solid(BLUE), strokeWeight: 10, strokeCap: "ROUND", strokeJoin: "ROUND", vectorNetwork: vectorNetworkFromSvgPath("M10 10 L90 10 L90 90") });
    });
    expect(blue(7, 10)).toBe(true); // round cap reaches 5 past the end
    expect(blue(95, 4)).toBe(false); // round join: the mitre's corner is cut
  });

  it("draws a line along its width, as a stroke only", () => {
    const { blue, red } = setup((add, p) => {
      add("LINE", p, { x: 20, y: 50, width: 100, height: 0, strokes: solid(BLUE), strokeWeight: 4, fills: solid(RED) });
      add("LINE", p, { x: 20, y: 100, width: 100, height: 0, strokes: solid(BLUE), strokeWeight: 4, strokeCap: "SQUARE" });
      add("LINE", p, { x: 20, y: 150, width: 100, height: 0, rotation: 90, strokes: solid(BLUE), strokeWeight: 4 });
    });
    expect(blue(70, 50)).toBe(true);
    expect(blue(70, 48)).toBe(true);
    expect(blue(70, 54)).toBe(false);
    expect(blue(121, 50)).toBe(false); // no cap
    expect(red(70, 50)).toBe(false); // lines have no fill
    expect(blue(121, 100)).toBe(true); // square cap
    // Rotated 90° clockwise about its start: it runs down from (20, 150).
    expect(blue(20, 180)).toBe(true);
    expect(blue(50, 150)).toBe(false);
  });

  it("draws nothing for an empty vector, and no hairline for a 0-weight stroke", () => {
    const { blue } = setup((add, p) => {
      add("VECTOR", p, { width: 100, height: 100, fills: solid(BLUE), strokes: solid(BLUE) });
      add("RECTANGLE", p, { x: 110, y: 10, width: 50, height: 50, strokes: solid(BLUE), strokeWeight: 0 });
    });
    expect(blue(50, 50)).toBe(false);
    expect(blue(110, 30)).toBe(false);
  });

  it("re-records only the vector an edit touched, and draws its new outline", () => {
    let a = "";
    const { doc, renderer, red } = setup((add, p) => {
      a = add("VECTOR", p, { width: 100, height: 100, fills: solid(RED), vectorNetwork: vectorNetworkFromSvgPath("M0 0 L50 0 L50 50 Z") });
      add("STAR", p, { x: 100, width: 100, height: 100, fills: solid(RED) });
    });
    expect(red(40, 10)).toBe(true);
    expect(red(80, 80)).toBe(false);
    doc.transact("Edit path", (tx) => tx.set(a, "vectorNetwork", vectorNetworkFromSvgPath("M0 0 L100 0 L100 100 Z")));
    expect(renderer.render(AT_ORIGIN).recorded).toBe(1);
    expect(red(90, 80)).toBe(true);
    doc.transact("Move", (tx) => tx.set(a, "y", 50));
    expect(renderer.render(AT_ORIGIN).recorded).toBe(1);
    expect(red(90, 20)).toBe(false);
    expect(red(90, 120)).toBe(true);
  });
});
