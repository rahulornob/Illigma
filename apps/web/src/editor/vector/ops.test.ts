// Flatten, outline stroke and booleans, with CanvasKit's PathOps in Node.
import { beforeAll, describe, expect, it } from "vitest";
import CanvasKitInit, { type CanvasKit } from "canvaskit-wasm";
import { Document } from "@illigma/core";
import { vectorNetworkProblem, type Color, type NodeId, type VectorNetwork } from "@illigma/format";
import { booleanPath, flatten, hitTest, insideFill, shapeGeometry, usePathOps } from "@illigma/renderer";
import { booleanLayers, convertToVector, flattenLayers, outlineStrokes, setNetworkFitted } from "./ops";
import { moveVertices } from "./network";

const RED: Color = { r: 1, g: 0, b: 0, a: 1 };
const solid = (color: Color) => [{ type: "SOLID" as const, visible: true, color }];

let ck: CanvasKit;
beforeAll(async () => {
  ck = await CanvasKitInit();
  usePathOps(ck);
});

/** Two overlapping 100 × 100 squares: A at (0, 0), B at (50, 0). */
function twoSquares() {
  const doc = new Document("Ops");
  let page = "", a = "", b = "";
  doc.transact("Build", (tx) => {
    page = tx.addPage("Page");
    a = tx.create("RECTANGLE", page, { name: "A", width: 100, height: 100, fills: solid(RED) });
    b = tx.create("RECTANGLE", page, { name: "B", x: 50, width: 100, height: 100, fills: solid(RED) });
  });
  return { doc, page, a, b };
}

const inside = (doc: Document, id: NodeId, x: number, y: number) => {
  const n = doc.get(id)!;
  const geo = shapeGeometry(n, doc)!;
  return geo.fills.some((f) => insideFill(flatten(f.commands), x - n.x, y - n.y, f.evenOdd));
};

describe("booleans", () => {
  it("combines with Skia's PathOps: union, subtract, intersect, exclude", () => {
    const sq = (x: number) => [{ evenOdd: false, commands: [0, x, 0, 1, x + 100, 0, 1, x + 100, 100, 1, x, 100, 5] }];
    const area = (op: Parameters<typeof booleanPath>[1]) => {
      const r = booleanPath(ck, op, [sq(0), sq(50)])!;
      const f = flatten(r.commands);
      let n = 0;
      for (let x = 5; x < 150; x += 10) for (let y = 5; y < 100; y += 10) if (insideFill(f, x, y, r.evenOdd)) n++;
      return n;
    };
    expect(area("UNION")).toBe(150);
    expect(area("SUBTRACT")).toBe(50);
    expect(area("INTERSECT")).toBe(50);
    expect(area("EXCLUDE")).toBe(100);
  });

  it("makes a BOOLEAN_OPERATION whose children are the operands, drawn and hit by the result", () => {
    const { doc, page, a, b } = twoSquares();
    const id = doc.transact("Subtract", (tx) => booleanLayers(tx, doc, [a, b], "SUBTRACT"))!;
    const n = doc.get(id)!;
    expect(n.type).toBe("BOOLEAN_OPERATION");
    expect(n.booleanOperation).toBe("SUBTRACT");
    expect([n.x, n.y, n.width, n.height]).toEqual([0, 0, 150, 100]);
    expect(doc.children(id).map((c) => c.name)).toEqual(["A", "B"]);
    expect(inside(doc, id, 25, 50)).toBe(true);
    expect(inside(doc, id, 75, 50)).toBe(false); // subtracted
    expect(hitTest(doc, page, 25, 50)).toBe(id);
    expect(hitTest(doc, page, 75, 50)).toBeNull();
    expect(hitTest(doc, page, 25, 50, { deep: true })).toBe(id); // operands aren't picked on the canvas
    // Changing the operation, then moving an operand, updates the result.
    doc.transact("Union", (tx) => booleanLayers(tx, doc, [id], "UNION"));
    expect(inside(doc, id, 75, 50)).toBe(true);
    doc.transact("Move", (tx) => tx.set(b, "x", 200));
    expect(inside(doc, id, 125, 50)).toBe(false);
  });

  it("flatten bakes a boolean into one vector", () => {
    const { doc, a, b } = twoSquares();
    const bool = doc.transact("Intersect", (tx) => booleanLayers(tx, doc, [a, b], "INTERSECT"))!;
    const v = doc.transact("Flatten", (tx) => flattenLayers(tx, doc, [bool]))!;
    const n = doc.get(v)!;
    expect(n.type).toBe("VECTOR");
    expect(vectorNetworkProblem(n.vectorNetwork)).toBeNull();
    expect([n.x, n.y, n.width, n.height].map(Math.round)).toEqual([50, 0, 50, 100]);
    expect(doc.has(a) || doc.has(bool)).toBe(false);
  });
});

describe("flatten", () => {
  it("merges several layers into one vector, keeping them in place", () => {
    const { doc, a, b } = twoSquares();
    const v = doc.transact("Flatten", (tx) => flattenLayers(tx, doc, [a, b]))!;
    const n = doc.get(v)!;
    expect(vectorNetworkProblem(n.vectorNetwork)).toBeNull();
    expect(n.vectorNetwork?.regions).toHaveLength(2);
    expect([n.x, n.y, n.width, n.height]).toEqual([0, 0, 150, 100]);
    expect(inside(doc, v, 10, 10)).toBe(true);
    expect(inside(doc, v, 140, 90)).toBe(true);
  });

  it("converts a shape to a vector in place, with the corner radius on its points", () => {
    const doc = new Document("x");
    let r = "";
    doc.transact("b", (tx) => {
      const p = tx.addPage("P");
      r = tx.create("RECTANGLE", p, { x: 10, y: 20, width: 80, height: 40, cornerRadius: 8, rotation: 30, fills: solid(RED) });
    });
    const v = doc.transact("Convert", (tx) => convertToVector(tx, doc, r))!;
    const n = doc.get(v)!;
    expect([n.type, n.x, n.y, n.width, n.height, n.rotation]).toEqual(["VECTOR", 10, 20, 80, 40, 30]);
    expect(n.vectorNetwork?.vertices[0]?.cornerRadius).toBe(8);
    expect(n.fills).toEqual(solid(RED));
    // Moving a point past the box re-fits it, keeping the others where they were on the page.
    doc.transact("Move", (tx) => setNetworkFitted(tx, doc, v, moveVertices(n.vectorNetwork as VectorNetwork, [0], -10, -10)));
    const m = doc.get(v)!;
    expect([m.width, m.height]).toEqual([90, 50]);
    // Vertex 2 (80, 40) in the old space is now (90, 50) in the new one, and the same point on the page.
    const world = (node: typeof m, x: number, y: number) => {
      const t = (node.rotation * Math.PI) / 180;
      return [node.x + x * Math.cos(t) - y * Math.sin(t), node.y + x * Math.sin(t) + y * Math.cos(t)];
    };
    const before = world(n, 80, 40);
    const after = world(m, m.vectorNetwork!.vertices[2]!.x, m.vectorNetwork!.vertices[2]!.y);
    expect(after[0]).toBeCloseTo(before[0]!, 6);
    expect(after[1]).toBeCloseTo(before[1]!, 6);
  });
});

describe("outline stroke", () => {
  it("turns a line's stroke into a filled vector", () => {
    const doc = new Document("x");
    let line = "";
    doc.transact("b", (tx) => {
      const p = tx.addPage("P");
      line = tx.create("LINE", p, { x: 10, y: 50, width: 100, height: 0, strokes: solid(RED), strokeWeight: 10, fills: [] });
    });
    const [v] = doc.transact("Outline", (tx) => outlineStrokes(tx, doc, [line], ck));
    const n = doc.get(v as NodeId)!;
    expect(n.type).toBe("VECTOR");
    expect(vectorNetworkProblem(n.vectorNetwork)).toBeNull();
    expect([n.x, n.y, n.width, n.height].map((x) => Math.round(x))).toEqual([10, 45, 100, 10]);
    expect(n.fills).toEqual(solid(RED));
    expect(n.strokes).toEqual([]);
    expect(doc.has(line)).toBe(false);
    expect(inside(doc, v as NodeId, 60, 50)).toBe(true);
    expect(inside(doc, v as NodeId, 60, 58)).toBe(false);
  });

  it("keeps a filled shape's fill under its outlined (inside) stroke", () => {
    const doc = new Document("x");
    let r = "";
    doc.transact("b", (tx) => {
      const p = tx.addPage("P");
      r = tx.create("RECTANGLE", p, { width: 100, height: 100, fills: solid(RED), strokes: solid(RED), strokeWeight: 4, strokeAlign: "INSIDE" });
    });
    const [v] = doc.transact("Outline", (tx) => outlineStrokes(tx, doc, [r], ck));
    const n = doc.get(v as NodeId)!;
    expect([n.width, n.height].map(Math.round)).toEqual([100, 100]);
    expect(doc.get(r)?.strokes).toEqual([]);
    expect(inside(doc, v as NodeId, 2, 50)).toBe(true);
    expect(inside(doc, v as NodeId, 6, 50)).toBe(false);
  });
});

describe("arrow caps", () => {
  it("draws arrow heads at the ends whose cap is an arrow", () => {
    const doc = new Document("x");
    let v = "";
    doc.transact("b", (tx) => {
      const p = tx.addPage("P");
      v = tx.create("VECTOR", p, {
        width: 100,
        height: 0,
        strokes: solid(RED),
        strokeWeight: 2,
        vectorNetwork: { vertices: [{ x: 0, y: 0 }, { x: 100, y: 0, strokeCap: "ARROW_EQUILATERAL" }], segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }], regions: [] },
      });
    });
    const geo = shapeGeometry(doc.get(v)!)!;
    expect(geo.capFill?.length).toBeGreaterThan(0);
    // The triangle reaches above and below the line near its tip only.
    expect(insideFill(flatten(geo.capFill!), 96, 2, false)).toBe(true);
    expect(insideFill(flatten(geo.capFill!), 4, 2, false)).toBe(false);
    doc.transact("lines", (tx) => tx.set(v, "strokeCap", "ARROW_LINES"));
    doc.transact("lines", (tx) =>
      tx.set(v, "vectorNetwork", { vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }], segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }], regions: [] }),
    );
    const both = shapeGeometry(doc.get(v)!)!;
    expect(both.stroke.filter((c, i) => c === 0 && i % 3 === 0).length).toBeGreaterThanOrEqual(1);
    expect(both.stroke.length).toBeGreaterThan(6); // the line plus two heads
  });
});
