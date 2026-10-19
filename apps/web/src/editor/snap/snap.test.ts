import { describe, expect, it } from "vitest";
import { Document } from "@illigma/core";
import { DOCUMENT_OPTIONS } from "../layout";
import { worldBounds } from "../geometry";
import { duplicateLayers } from "../edit";
import { buildIndex, nearestValue, snapCoordinate, snapMove, snapPoint } from "./snap";
import { measureBetween } from "./measure";
import { droppable, dropTarget, reparent } from "./drop";
import { placeCopies, rememberDuplicate, repeatOffset } from "./repeat";
import { snapIndexFor } from "./candidates";
import { fitRect, zoomAt, zoomStep } from "../camera/zoom";

const r = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

describe("snap maths", () => {
  it("finds the nearest candidate within the threshold", () => {
    const v = Float64Array.from([0, 10, 20, 50]);
    expect(nearestValue(v, 12, 4)).toBe(10);
    expect(nearestValue(v, 16, 4)).toBe(20);
    expect(nearestValue(v, 35, 4)).toBeNull();
    expect(nearestValue(v, -3, 4)).toBe(0);
  });

  it("snaps an edge to a neighbour's edge and draws a guide across both", () => {
    const index = buildIndex([r(0, 0, 100, 100)]);
    // Box at x 200 moved to 102 → its left edge is 2 px from the neighbour's right edge (100).
    const res = snapMove(index, r(200, 300, 50, 50), -98, 0, 4);
    expect(res.dx).toBe(-100);
    const g = res.guides.find((x) => x.axis === "x" && x.at === 100);
    expect(g).toEqual({ axis: "x", at: 100, from: 0, to: 350 });
  });

  it("snaps centres to centres", () => {
    const index = buildIndex([r(0, 0, 100, 100)]);
    // Centre of a 20 wide box: x + 10. Neighbour centre: 50. Move it to 41 → centre 51 → snaps to 50.
    const res = snapMove(index, r(0, 200, 20, 20), 41, 0, 4);
    expect(res.dx).toBe(40);
  });

  it("falls back to whole pixels with nothing in reach, and with snapping suspended", () => {
    const index = buildIndex([r(0, 0, 100, 100)]);
    expect(snapMove(index, r(500.4, 500, 10, 10), 3.3, 0, 4).dx).toBeCloseTo(3.6);
    const off = snapMove(index, r(200, 300, 50, 50), -98, 0, 4, false);
    expect(off.dx).toBe(-98);
    expect(off.guides).toEqual([]);
  });

  it("centres a box between two neighbours with equal gaps and labels them", () => {
    const index = buildIndex([r(0, 0, 100, 100), r(300, 0, 100, 100)]);
    // The gap is 200; a 40 wide box centred has gaps of 80. Dropped at 182 (left 182 → gap 82 / 78).
    const res = snapMove(index, r(182, 1000, 40, 40), 0, -980, 4);
    expect(res.dx).toBeCloseTo(-2);
    expect(res.gaps.map((g) => Math.round(g.value))).toEqual([80, 80]);
  });

  it("repeats an existing gap after the last of a row", () => {
    const index = buildIndex([r(0, 0, 100, 100), r(120, 0, 100, 100)]);
    // Gap 20 between the two; a box near 240 snaps there.
    const res = snapMove(index, r(400, 0, 100, 100), -157, 0, 4);
    expect(res.dx).toBe(-160);
    expect(res.gaps.some((g) => Math.round(g.value) === 20)).toBe(true);
  });

  it("snaps a coordinate and a point", () => {
    const index = buildIndex([r(10, 10, 100, 100)]);
    expect(snapCoordinate(index, "x", 108.5, 4)).toBe(110);
    expect(snapCoordinate(index, "x", 300.4, 4)).toBe(300);
    const p = snapPoint(index, { x: 12, y: 58 }, 4);
    expect(p.point).toEqual({ x: 10, y: 60 });
    expect(p.guides.length).toBe(2);
  });

  it("stays fast with 12,000 candidates", () => {
    const rects = Array.from({ length: 12000 }, (_, i) => r((i % 120) * 37.3, Math.floor(i / 120) * 41.7, 30, 30));
    const t0 = performance.now();
    const index = buildIndex(rects);
    const built = performance.now() - t0;
    const t1 = performance.now();
    for (let k = 0; k < 60; k++) snapMove(index, r(5000, 5000, 50, 50), -k * 13.1, -k * 9.7, 4);
    const perMove = (performance.now() - t1) / 60;
    expect(built).toBeLessThan(200);
    expect(perMove).toBeLessThan(8);
  });
});

describe("measurements", () => {
  it("measures the gap between two layers side by side", () => {
    const m = measureBetween(r(0, 0, 100, 100), r(150, 20, 50, 50));
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ x1: 100, x2: 150, value: 50, y1: 45 });
  });

  it("measures a diagonal neighbour on both axes", () => {
    const m = measureBetween(r(0, 0, 100, 100), r(200, 300, 50, 50));
    expect(m.map((g) => g.value).sort((a, b) => a - b)).toEqual([100, 200]);
  });

  it("measures to each edge of the parent", () => {
    const m = measureBetween(r(10, 20, 30, 40), r(0, 0, 100, 100));
    expect(m.map((g) => g.value)).toEqual([10, 60, 20, 40]);
  });
});

function setup() {
  const doc = new Document("Test", DOCUMENT_OPTIONS);
  const page = doc.transact("Add page", (tx) => tx.addPage("Page 1"));
  const ids = doc.transact("Add", (tx) => {
    const frame = tx.create("FRAME", page, { name: "Frame", x: 100, y: 100, width: 400, height: 300 });
    const small = tx.create("RECTANGLE", page, { name: "Small", x: 0, y: 0, width: 50, height: 50 });
    const big = tx.create("RECTANGLE", page, { name: "Big", x: 0, y: 600, width: 500, height: 50 });
    const auto = tx.create("FRAME", page, { name: "Auto", x: 700, y: 100, width: 200, height: 100, layoutMode: "HORIZONTAL", itemSpacing: 10 });
    const item = tx.create("RECTANGLE", auto, { name: "Item", x: 0, y: 0, width: 40, height: 40 });
    const group = tx.create("GROUP", page, { name: "Group", x: 0, y: 900, width: 50, height: 50 });
    const inGroup = tx.create("RECTANGLE", group, { name: "In group", x: 0, y: 0, width: 50, height: 50 });
    return { frame, small, big, auto, item, group, inGroup };
  });
  return { doc, page, ...ids };
}

describe("drop onto a frame", () => {
  it("drops a smaller layer into the frame under the pointer", () => {
    const { doc, page, frame, small } = setup();
    expect(dropTarget(doc, page, 200, 200, [small], r(180, 180, 50, 50))).toBe(frame);
  });

  it("never drops a layer larger than the frame, except into auto layout with ⌘", () => {
    const { doc, page, frame, big, auto } = setup();
    expect(dropTarget(doc, page, 200, 200, [big], r(0, 180, 500, 50))).toBe(page);
    expect(dropTarget(doc, page, 710, 110, [big], r(600, 150, 500, 50))).toBe(page);
    expect(dropTarget(doc, page, 710, 110, [big], r(600, 150, 500, 50), { force: true })).toBe(auto);
    expect(frame).toBeTruthy();
  });

  it("keeps the parent with Space", () => {
    const { doc, page, small } = setup();
    expect(dropTarget(doc, page, 200, 200, [small], r(180, 180, 50, 50), { keep: true })).toBeNull();
  });

  it("never drops a frame into itself", () => {
    const { doc, page, frame } = setup();
    expect(dropTarget(doc, page, 200, 200, [frame], r(150, 150, 50, 50))).toBe(page);
  });

  it("keeps the page position when reparenting, in one undo step", () => {
    const { doc, frame, small } = setup();
    const before = worldBounds(doc, small);
    doc.transact("Move", (tx) => reparent(tx, doc, [small], frame));
    expect(doc.get(small)?.parentId).toBe(frame);
    expect(worldBounds(doc, small)).toEqual(before);
    expect(doc.get(small)).toMatchObject({ x: -100, y: -100 });
    doc.undo();
    expect(doc.get(small)?.parentId).not.toBe(frame);
  });

  it("drags a layer out of its frame onto the page", () => {
    const { doc, page, frame, small } = setup();
    doc.transact("In", (tx) => reparent(tx, doc, [small], frame));
    doc.transact("Out", (tx) => reparent(tx, doc, [small], page));
    expect(doc.get(small)).toMatchObject({ parentId: page, x: 0, y: 0 });
  });

  it("places a layer at the slot inside auto layout", () => {
    const { doc, auto, item, small } = setup();
    doc.transact("In", (tx) => reparent(tx, doc, [small], auto, item));
    expect(doc.children(auto).map((n) => n.id)).toEqual([small, item]);
  });

  it("keeps layers in a group where they are", () => {
    const { doc, small, inGroup } = setup();
    expect(droppable(doc, [small, inGroup])).toEqual([small]);
  });

  it("keeps the page angle when a turned layer enters a turned frame", () => {
    const { doc, frame, small } = setup();
    doc.transact("Turn", (tx) => {
      tx.set(frame, "rotation", 30);
      tx.set(small, "rotation", 45);
    });
    doc.transact("In", (tx) => reparent(tx, doc, [small], frame));
    expect(doc.get(small)?.rotation).toBeCloseTo(15);
  });
});

describe("⌘D repeats the last offset", () => {
  it("offsets the next copy by how far the last copy was moved", () => {
    const { doc, small } = setup();
    const [copy] = doc.transact("Dup", (tx) => duplicateLayers(tx, doc, [small]));
    rememberDuplicate(doc, [small], [copy as string]);
    expect(repeatOffset(doc, [copy as string])).toBeNull();
    doc.transact("Move", (tx) => tx.set(copy as string, "x", 80));
    const off = repeatOffset(doc, [copy as string]);
    expect(off).toEqual({ x: 80, y: 0 });
    const [next] = doc.transact("Dup", (tx) => {
      const made = duplicateLayers(tx, doc, [copy as string]);
      placeCopies(tx, doc, [copy as string], made, off as { x: number; y: number });
      return made;
    });
    expect(doc.get(next as string)?.x).toBe(160);
  });
});

describe("snap candidates", () => {
  it("are the siblings and the parent, never the dragged layers", () => {
    const { doc, auto, item } = setup();
    const index = snapIndexFor(doc, [item]);
    expect(index.rects).toHaveLength(1); // the auto layout frame itself
    expect(index.rects[0]).toEqual(worldBounds(doc, auto));
  });
});

describe("zoom", () => {
  it("steps by powers of two", () => {
    expect(zoomStep(1, 1)).toBe(2);
    expect(zoomStep(1, -1)).toBe(0.5);
    expect(zoomStep(0.75, 1)).toBe(1);
    expect(zoomStep(0.75, -1)).toBe(0.5);
    expect(zoomStep(256, 1)).toBe(256);
  });

  it("keeps the point under the pointer", () => {
    const c = zoomAt({ x: 0, y: 0, zoom: 1 }, 2, 100, 50);
    expect(c.x + 100 / c.zoom).toBe(100);
    expect(c.y + 50 / c.zoom).toBe(50);
  });

  it("fits a rectangle with padding", () => {
    const c = fitRect(r(0, 0, 100, 100), 328, 328, 64);
    expect(c.zoom).toBe(2);
    expect(c.x).toBe(50 - 328 / 4);
  });
});
