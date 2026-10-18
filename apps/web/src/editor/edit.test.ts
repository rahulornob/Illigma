import { describe, expect, it } from "vitest";
import { Document } from "@illigma/core";
import { createdLayers, deleteLayers, duplicateLayers, layerRange, movable, moveBy, resizeBy, selectionFrame, snapDelta, snapshot, startBounds } from "./edit";
import { worldBounds } from "./geometry";

function setup() {
  const doc = new Document("Test");
  const page = doc.transact("Add page", (tx) => tx.addPage("Page 1"));
  const ids = doc.transact("Add", (tx) => {
    const frame = tx.create("FRAME", page, { name: "Desktop", x: 100, y: 50, width: 400, height: 300 });
    const a = tx.create("RECTANGLE", frame, { name: "A", x: 10, y: 20, width: 100, height: 50 });
    const b = tx.create("RECTANGLE", page, { name: "B", x: 600, y: 50, width: 100, height: 100 });
    const inner = tx.create("ELLIPSE", a, { name: "Inner", x: 0, y: 0, width: 10, height: 10 });
    return { frame, a, b, inner };
  });
  return { doc, page, ...ids };
}

const xywh = (doc: Document, id: string) => {
  const n = doc.get(id);
  return n && { x: n.x, y: n.y, width: n.width, height: n.height };
};

describe("moving", () => {
  it("moves a child of a frame in its parent's space", () => {
    const { doc, a } = setup();
    const starts = snapshot(doc, [a]);
    expect(starts[0]?.bounds).toEqual({ x: 110, y: 70, width: 100, height: 50 });
    doc.transact("Move", (tx) => moveBy(tx, starts, 15, -5));
    expect(xywh(doc, a)).toEqual({ x: 25, y: 15, width: 100, height: 50 });
  });

  it("follows the pointer inside a turned frame", () => {
    const { doc, frame, a } = setup();
    doc.transact("Turn", (tx) => tx.set(frame, "rotation", 90));
    doc.transact("Move", (tx) => moveBy(tx, snapshot(doc, [a]), 10, 0));
    // Turned 90°, the frame's own y axis points left on the page: 10 px right is -10 on its y.
    expect(doc.get(a)?.x).toBeCloseTo(10);
    expect(doc.get(a)?.y).toBeCloseTo(10);
  });

  it("snaps the selection's top-left to whole pixels", () => {
    const d = snapDelta({ x: 10.4, y: 3, width: 1, height: 1 }, 2.3, 0.6);
    expect(10.4 + d.x).toBeCloseTo(13);
    expect(d.y).toBe(1);
  });

  it("leaves locked layers, layers in locked frames, and children of selected layers out", () => {
    const { doc, frame, a, b, inner } = setup();
    expect(movable(doc, [frame, a, inner, b])).toEqual([frame, b]);
    doc.transact("Lock", (tx) => tx.set(frame, "locked", true));
    expect(movable(doc, [a, b])).toEqual([b]);
  });
});

describe("resizing", () => {
  it("resizes a single layer from a handle, in parent space", () => {
    const { doc, a } = setup();
    doc.transact("Resize", (tx) => resizeBy(tx, doc, snapshot(doc, [a]), "nw", -10, -10, {}));
    expect(xywh(doc, a)).toEqual({ x: 0, y: 10, width: 110, height: 60 });
  });

  it("scales a multi-selection as one box, flipping members past the edge", () => {
    const { doc, a, b } = setup();
    const starts = snapshot(doc, [a, b]);
    expect(startBounds(starts)).toEqual({ x: 110, y: 50, width: 590, height: 100 });
    // Right edge dragged to the left edge's mirror: the box flips and keeps its width.
    doc.transact("Resize", (tx) => resizeBy(tx, doc, starts, "e", -1180, 0, {}));
    expect(worldBounds(doc, b)).toEqual({ x: -480, y: 50, width: 100, height: 100 });
    expect(worldBounds(doc, a)).toEqual({ x: 10, y: 70, width: 100, height: 50 });
    expect(xywh(doc, a)).toEqual({ x: -90, y: 20, width: 100, height: 50 });
  });

  it("resizes a turned layer along its own axes", () => {
    const { doc, b } = setup();
    doc.transact("Turn", (tx) => tx.set(b, "rotation", 90));
    // Its own right edge now points down the page: dragging down widens it.
    doc.transact("Resize", (tx) => resizeBy(tx, doc, snapshot(doc, [b]), "e", 0, 40, {}));
    expect(xywh(doc, b)).toEqual({ x: 600, y: 50, width: 140, height: 100 });
    // Its own left edge points up: dragging it up widens it too, and moves its top-left.
    doc.transact("Resize", (tx) => resizeBy(tx, doc, snapshot(doc, [b]), "w", 0, -20, {}));
    expect(doc.get(b)?.width).toBe(160);
    expect(doc.get(b)?.x).toBeCloseTo(600);
    expect(doc.get(b)?.y).toBeCloseTo(30);
  });

  it("shows one turned box for a single turned layer and an upright box around several", () => {
    const { doc, a, b } = setup();
    doc.transact("Turn", (tx) => tx.set(b, "rotation", 45));
    expect(selectionFrame(doc, [b])).toMatchObject({ x: 600, y: 50, rotation: 45, width: 100, height: 100 });
    expect(selectionFrame(doc, [a, b])?.rotation).toBe(0);
    expect(selectionFrame(doc, [])).toBeNull();
  });
});

describe("delete and duplicate", () => {
  it("deletes a selection with a parent and its child once, as one undo step", () => {
    const { doc, frame, a, b } = setup();
    doc.transact("Delete", (tx) => deleteLayers(tx, doc, [a, frame, b]));
    expect(doc.has(frame) || doc.has(a) || doc.has(b)).toBe(false);
    doc.undo();
    expect(doc.has(frame) && doc.has(a) && doc.has(b)).toBe(true);
  });

  it("duplicates in place, just above the original, with children; a top-level frame goes to its right", () => {
    const { doc, frame, a } = setup();
    const [copy] = doc.transact("Duplicate", (tx) => duplicateLayers(tx, doc, [a]));
    expect(doc.get(copy as string)).toMatchObject({ name: "A", x: 10, y: 20, width: 100, height: 50, parentId: frame });
    expect(doc.children(frame).map((n) => n.id)).toEqual([a, copy]);
    expect(doc.children(copy as string).map((n) => n.name)).toEqual(["Inner"]);
    const [frameCopy] = doc.transact("Duplicate", (tx) => duplicateLayers(tx, doc, [frame]));
    expect(doc.get(frameCopy as string)).toMatchObject({ x: 540, y: 50 });
    expect(doc.subtree(frameCopy as string)).toHaveLength(5);
    doc.undo();
    expect(doc.has(frameCopy as string)).toBe(false);
  });
});

describe("undo selection and layer ranges", () => {
  it("finds the outermost layers a change creates: undoing a delete brings them back to select", () => {
    const { doc, frame, a, b } = setup();
    doc.transact("Delete", (tx) => deleteLayers(tx, doc, [a, b]));
    let created: string[] = [];
    const stop = doc.subscribe((c) => (created = createdLayers(c.ops)));
    doc.undo();
    stop();
    expect(created.sort()).toEqual([a, b].sort());
    expect(createdLayers([])).toEqual([]);
    // Moves and renames create nothing.
    doc.transact("Move", (tx) => tx.set(frame, "x", 1));
    const off = doc.subscribe((c) => (created = createdLayers(c.ops)));
    doc.undo();
    off();
    expect(created).toEqual([]);
  });

  it("selects every row between the anchor and the Shift-clicked row, either way", () => {
    const rows = ["p", "q", "r", "s", "t"];
    expect(layerRange(rows, "q", "s")).toEqual(["q", "r", "s"]);
    expect(layerRange(rows, "t", "r")).toEqual(["r", "s", "t"]);
    expect(layerRange(rows, null, "r")).toEqual(["r"]);
    expect(layerRange(rows, "gone", "r")).toEqual(["r"]);
  });
});

describe("resizing a line", () => {
  it("keeps a line's height at 0 while its length changes", () => {
    const { doc, page } = setup();
    const line = doc.transact("Line", (tx) => tx.create("LINE", page, { x: 0, y: 400, width: 100, height: 0 }));
    const starts = snapshot(doc, [line]);
    doc.transact("Resize", (tx) => resizeBy(tx, doc, starts, "e", 50, 0, {}));
    expect(xywh(doc, line)).toEqual({ x: 0, y: 400, width: 150, height: 0 });
    doc.transact("Resize", (tx) => resizeBy(tx, doc, starts, "se", 50, 20, {}));
    expect(xywh(doc, line)).toEqual({ x: 0, y: 400, width: 150, height: 0 });
  });
});
