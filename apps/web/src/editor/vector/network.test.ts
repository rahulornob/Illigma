import { describe, expect, it } from "vitest";
import { Document } from "@illigma/core";
import { vectorNetworkProblem, type VectorNetwork } from "@illigma/format";
import {
  bendSegment,
  deleteVertices,
  fitNetwork,
  isSmooth,
  mergeNetworks,
  moveVertices,
  nearestSegment,
  networkBounds,
  penHandles,
  penNetwork,
  pointOnSegment,
  setHandle,
  shapeNetwork,
  snap45,
  splitSegment,
  toggleSmooth,
  verticesIn,
  type PenPoint,
} from "./network";

const pt = (x: number, y: number, out = { x: 0, y: 0 }, inn = { x: -out.x, y: -out.y }): PenPoint => ({ x, y, in: inn, out });
const valid = (net: VectorNetwork) => expect(vectorNetworkProblem(net)).toBeNull();
const SQUARE = penNetwork([pt(0, 0), pt(100, 0), pt(100, 100), pt(0, 100)], true);

describe("pen maths", () => {
  it("snaps to 45° steps from the last point", () => {
    expect(snap45({ x: 0, y: 0 }, { x: 100, y: 8 })).toEqual({ x: 100, y: 0 });
    const d = snap45({ x: 0, y: 0 }, { x: 100, y: 90 });
    expect(d.x).toBeCloseTo(d.y, 9);
    const v = snap45({ x: 10, y: 10 }, { x: 13, y: -90 });
    expect(v.x).toBeCloseTo(10, 9);
    expect(v.y).toBeCloseTo(-90, 9);
  });

  it("drags out symmetric handles, or breaks them with ⌥", () => {
    expect(penHandles({ x: 10, y: 10 }, { x: 30, y: 0 })).toEqual({ out: { x: 20, y: -10 }, in: { x: -20, y: 10 } });
    expect(penHandles({ x: 10, y: 10 }, { x: 30, y: 0 }, true, { x: 5, y: 5 })).toEqual({ out: { x: 20, y: -10 }, in: { x: 5, y: 5 } });
  });

  it("makes valid open and closed networks; closed ones get a region", () => {
    const open = penNetwork([pt(0, 0), pt(50, 50, { x: 10, y: 0 }), pt(100, 0)], false);
    valid(open);
    expect(open.segments).toHaveLength(2);
    expect(open.regions).toHaveLength(0);
    expect(open.segments[0]?.tangentEnd).toEqual({ x: -10, y: -0 });
    expect(open.segments[1]?.tangentStart).toEqual({ x: 10, y: 0 });
    valid(SQUARE);
    expect(SQUARE.segments).toHaveLength(4);
    expect(SQUARE.regions[0]?.loops).toEqual([[0, 1, 2, 3]]);
    // Two points closed: a lens of two segments.
    valid(penNetwork([pt(0, 0, { x: 0, y: -20 }), pt(100, 0, { x: 0, y: 20 })], true));
  });
});

describe("bounds and fitting", () => {
  it("measures curves at their extremes, not their handles", () => {
    const arc = penNetwork([pt(0, 0, { x: 0, y: -40 }, { x: 0, y: 0 }), pt(100, 0, { x: 0, y: 0 }, { x: 0, y: -40 })], false);
    const b = networkBounds(arc);
    expect(b?.y).toBeCloseTo(-30, 6); // a cubic reaches 3/4 of its handles' height
    expect(b?.width).toBeCloseTo(100, 6);
  });

  it("fits a network to (0, 0) and says how far it moved", () => {
    const f = fitNetwork(moveVertices(SQUARE, [0, 1, 2, 3], 20, 30));
    expect([f.dx, f.dy, f.width, f.height]).toEqual([20, 30, 100, 100]);
    expect(f.net.vertices[0]).toEqual({ x: 0, y: 0 });
    valid(f.net);
  });

  it("merges networks, renumbering segments and regions", () => {
    const m = mergeNetworks([SQUARE, moveVertices(SQUARE, [0, 1, 2, 3], 200, 0)]);
    valid(m);
    expect(m.regions[1]?.loops).toEqual([[4, 5, 6, 7]]);
  });
});

describe("shapes as networks", () => {
  it("converts rectangles (corner radius per point), ellipses, stars and lines", () => {
    const doc = new Document("x");
    let ids: string[] = [];
    doc.transact("b", (tx) => {
      const p = tx.addPage("P");
      ids = [
        tx.create("RECTANGLE", p, { width: 80, height: 40, cornerRadius: 6 }),
        tx.create("ELLIPSE", p, { width: 80, height: 40 }),
        tx.create("STAR", p, { width: 100, height: 100 }),
        tx.create("LINE", p, { width: 50, height: 0 }),
      ];
    });
    const [rect, ell, star, line] = ids.map((id) => shapeNetwork(doc.get(id)!)!) as [VectorNetwork, VectorNetwork, VectorNetwork, VectorNetwork];
    for (const n of [rect, ell, star, line]) valid(n);
    expect(rect.vertices.every((v) => v.cornerRadius === 6)).toBe(true);
    expect(networkBounds(ell)).toEqual({ x: 0, y: 0, width: 80, height: 40 });
    expect(star.vertices).toHaveLength(10);
    expect(line.regions).toHaveLength(0);
  });
});

describe("editing", () => {
  it("adds a point on a segment without changing the curve", () => {
    const curve = penNetwork([pt(0, 0, { x: 30, y: -40 }), pt(100, 0, { x: 30, y: 40 })], true);
    const before = pointOnSegment(curve, 0, 0.25);
    const { net, vertex } = splitSegment(curve, 0, 0.5);
    valid(net);
    expect(vertex).toBe(2);
    expect(net.segments).toHaveLength(3);
    expect(net.regions[0]?.loops[0]).toEqual([0, 2, 1]);
    // The first half's midpoint is the old curve at t = 0.25.
    const after = pointOnSegment(net, 0, 0.5);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });

  it("finds the nearest segment and where on it", () => {
    const hit = nearestSegment(SQUARE, 50, 2, 5);
    expect(hit?.segment).toBe(0);
    expect(hit?.t).toBeCloseTo(0.5, 3);
    expect(nearestSegment(SQUARE, 50, 50, 5)).toBeNull();
  });

  it("deletes points (the region goes) or heals across them (it stays)", () => {
    const cut = deleteVertices(SQUARE, [1]);
    valid(cut);
    expect(cut.vertices).toHaveLength(3);
    expect(cut.segments).toHaveLength(2);
    expect(cut.regions).toHaveLength(0);
    const healed = deleteVertices(SQUARE, [1], true);
    valid(healed);
    expect(healed.vertices).toHaveLength(3);
    expect(healed.segments).toHaveLength(3);
    expect(healed.regions[0]?.loops[0]).toHaveLength(3);
    // Deleting several at once, healed.
    const two = deleteVertices(SQUARE, [1, 3], true);
    valid(two);
    expect(two.vertices).toHaveLength(2);
  });

  it("toggles corner and smooth points", () => {
    const smooth = toggleSmooth(SQUARE, 1);
    valid(smooth);
    expect(isSmooth(smooth, 1)).toBe(true);
    const corner = toggleSmooth(smooth, 1);
    expect(isSmooth(corner, 1)).toBe(false);
    expect(corner.segments.every((s) => s.tangentStart.x === 0 && s.tangentEnd.x === 0)).toBe(true);
  });

  it("mirrors a smooth point's handle, or breaks it", () => {
    const smooth = toggleSmooth(SQUARE, 1); // segment 0 ends at 1, segment 1 starts at 1
    const mirrored = setHandle(smooth, 1, "start", { x: 0, y: 50 }, "angle");
    expect(mirrored.segments[0]?.tangentEnd.x).toBeCloseTo(0, 9);
    expect(mirrored.segments[0]?.tangentEnd.y).toBeLessThan(0);
    expect(isSmooth(mirrored, 1)).toBe(true);
    const broken = setHandle(smooth, 1, "start", { x: 0, y: 50 }, "none");
    expect(broken.segments[0]?.tangentEnd).toEqual(smooth.segments[0]?.tangentEnd);
  });

  it("bends a segment through the pointer", () => {
    const bent = bendSegment(SQUARE, 0, 0.5, { x: 50, y: -20 });
    const p = pointOnSegment(bent, 0, 0.5);
    expect(p.x).toBeCloseTo(50, 9);
    expect(p.y).toBeCloseTo(-20, 9);
    valid(bent);
  });

  it("selects points in a box", () => {
    expect(verticesIn(SQUARE, { x: -1, y: -1, width: 102, height: 50 })).toEqual([0, 1]);
  });
});
