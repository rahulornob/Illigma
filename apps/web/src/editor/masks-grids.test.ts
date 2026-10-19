import { describe, expect, it } from "vitest";
import { Document } from "@illigma/core";
import type { NodeId } from "@illigma/format";
import { snapLinesFor, setViewSettings } from "./grids";
import { layerRows } from "./LayersPanel";
import { isMasked, toggleMask } from "./masks";
import { tickStep } from "./rulers";
import { snapIndexFor } from "./snap/candidates";
import { buildIndex, snapMove } from "./snap/snap";

function setup() {
  const doc = new Document("Masks");
  const ids = doc.transact("Build", (tx) => {
    const page = tx.addPage("Page 1");
    const frame = tx.create("FRAME", page, { name: "Frame", x: 100, y: 0, width: 440, height: 300 });
    const a = tx.create("ELLIPSE", frame, { name: "A", x: 10, y: 10, width: 50, height: 50 });
    const b = tx.create("RECTANGLE", frame, { name: "B", x: 20, y: 20, width: 80, height: 80 });
    const c = tx.create("RECTANGLE", frame, { name: "C", x: 300, y: 200, width: 10, height: 10 });
    return { page, frame, a, b, c };
  });
  return { doc, ...ids };
}

describe("Use as mask (⌃⌘M)", () => {
  it("groups the selection as a Mask group whose bottom layer is the mask, in one undo step", () => {
    const { doc, frame, a, b } = setup();
    const sel = doc.transact("Use as mask", (tx) => toggleMask(tx, doc, [b, a])) as NodeId[];
    expect(sel).toHaveLength(1);
    const g = doc.get(sel[0] as NodeId);
    expect(g).toMatchObject({ type: "GROUP", name: "Mask group", parentId: frame });
    expect(doc.children(g?.id as NodeId).map((n) => n.name)).toEqual(["A", "B"]);
    expect(doc.get(a)?.isMask).toBe(true);
    expect(isMasked(doc, b)).toBe(true);
    expect(isMasked(doc, a)).toBe(false);
    const rows = layerRows(doc, doc.get(frame)?.parentId as NodeId);
    expect(rows.find((r) => r.id === a)?.isMask).toBe(true);
    doc.undo();
    expect(doc.get(a)?.isMask).toBeUndefined();
    expect(doc.get(a)?.parentId).toBe(frame);
  });

  it("with only masks selected, turns them back into layers", () => {
    const { doc, a, b } = setup();
    doc.transact("Use as mask", (tx) => toggleMask(tx, doc, [a, b]));
    doc.transact("Remove mask", (tx) => toggleMask(tx, doc, [a]));
    expect(doc.get(a)?.isMask).toBeUndefined();
  });
});

describe("snapping to layout grids and guides", () => {
  it("frame columns and page guides become snap lines", () => {
    const { doc, page, frame, c } = setup();
    doc.transact("Grid", (tx) => {
      tx.set(frame, "layoutGrids", [{ pattern: "COLUMNS", alignment: "STRETCH", count: 4, gutterSize: 20, offset: 10 }]);
      tx.set(page, "guides", [{ axis: "Y", offset: 333 }]);
    });
    setViewSettings({ grids: true });
    const lines = snapLinesFor(doc, [frame], new Set());
    // Column edges on the page: 100 + 10, 100 + 100, 100 + 120, …
    expect(lines.filter((l) => l.axis === "x").map((l) => l.at)).toEqual([110, 200, 220, 310, 330, 420, 440, 530]);
    expect(lines.filter((l) => l.axis === "y").map((l) => l.at)).toEqual([333]);
    setViewSettings({ grids: false });
    expect(snapLinesFor(doc, [frame], new Set()).map((l) => l.at)).toEqual([333]);
    setViewSettings({ grids: true });

    const index = snapIndexFor(doc, [c]);
    const box = { x: 400, y: 200, width: 10, height: 10 };
    const r = snapMove(index, box, 18, 0, 4, true);
    expect(box.x + r.dx).toBe(420); // left edge onto the column edge at 420
    const down = snapMove(index, box, 0, 125, 4, true);
    expect(box.y + down.dy + box.height).toBe(333); // bottom edge onto the guide
  });

  it("lines never count for equal spacing and guides span the moving box", () => {
    const index = buildIndex([], [{ axis: "x", at: 50 }]);
    const r = snapMove(index, { x: 0, y: 0, width: 10, height: 10 }, 42, 0, 4, true);
    expect(r.dx).toBe(40);
    expect(r.gaps).toEqual([]);
    expect(r.guides[0]).toMatchObject({ axis: "x", at: 50, from: 0, to: 10 });
  });
});

describe("rulers", () => {
  it("picks 1-2-5 tick steps that keep labels apart", () => {
    expect(tickStep(1)).toBe(100);
    expect(tickStep(2)).toBe(50);
    expect(tickStep(0.1)).toBe(1000);
    expect(tickStep(8)).toBe(10);
  });
});
