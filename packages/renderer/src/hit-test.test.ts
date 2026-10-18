import { describe, expect, it } from "vitest";
import { Document } from "@illigma/core";
import type { Node, NodeId, NodeType } from "@illigma/format";
import { hitTest } from "./hit-test.js";

type Fields = Partial<Omit<Node, "id" | "type" | "parentId" | "index">>;

function setup(build: (add: (type: NodeType, parent: NodeId, fields?: Fields) => NodeId, page: NodeId) => void) {
  const doc = new Document("Hit test");
  let page = "";
  doc.transact("Build", (tx) => {
    page = tx.addPage("Page");
    build((type, parent, fields = {}) => tx.create(type, parent, fields), page);
  });
  return { doc, page };
}

describe("hitTest", () => {
  it("returns null on empty canvas", () => {
    const { doc, page } = setup((add, p) => void add("RECTANGLE", p, { x: 0, y: 0, width: 10, height: 10 }));
    expect(hitTest(doc, page, 50, 50)).toBeNull();
  });

  it("returns the top-level child by default and the deepest node with deep", () => {
    let frame = "", inner = "", rect = "";
    const { doc, page } = setup((add, p) => {
      frame = add("FRAME", p, { x: 100, y: 100, width: 200, height: 200 });
      inner = add("FRAME", frame, { x: 20, y: 20, width: 100, height: 100 });
      rect = add("RECTANGLE", inner, { x: 10, y: 10, width: 20, height: 20 });
    });
    // World (135, 135) = frame-local (35, 35) = inner-local (15, 15): inside the rectangle.
    expect(hitTest(doc, page, 135, 135)).toBe(frame);
    expect(hitTest(doc, page, 135, 135, { deep: true })).toBe(rect);
    // Inside the inner frame but outside the rectangle.
    expect(hitTest(doc, page, 200, 200, { deep: true })).toBe(inner);
    // Inside the outer frame only.
    expect(hitTest(doc, page, 280, 280, { deep: true })).toBe(frame);
  });

  it("clipping frames hide children outside their bounds", () => {
    let frame = "", group = "", spill = "";
    const { doc, page } = setup((add, p) => {
      frame = add("FRAME", p, { x: 0, y: 0, width: 100, height: 100 });
      spill = add("RECTANGLE", frame, { x: 80, y: 0, width: 100, height: 50 });
      group = add("GROUP", p, { x: 300, y: 0, width: 50, height: 50 });
      add("RECTANGLE", group, { x: 80, y: 0, width: 100, height: 50 });
    });
    expect(hitTest(doc, page, 90, 10, { deep: true })).toBe(spill);
    expect(hitTest(doc, page, 150, 10, { deep: true })).toBeNull(); // clipped away
    // Groups don't clip: the child is hit outside the group's box, the group's own box is empty.
    expect(hitTest(doc, page, 300 + 150, 10)).toBe(group);
    expect(hitTest(doc, page, 300 + 10, 10)).toBeNull();
  });

  it("respects rotation", () => {
    let rect = "";
    const { doc, page } = setup((add, p) => {
      // 100 × 10 bar rotated 90° clockwise about its top-left: it now runs down from (0, 0) to the left.
      rect = add("RECTANGLE", p, { x: 0, y: 0, width: 100, height: 10, rotation: 90 });
    });
    expect(hitTest(doc, page, -5, 50)).toBe(rect);
    expect(hitTest(doc, page, 50, 5)).toBeNull();
    expect(hitTest(doc, page, 5, 50)).toBeNull();
  });

  it("rotated parents carry their children", () => {
    let child = "";
    const { doc, page } = setup((add, p) => {
      const f = add("FRAME", p, { x: 100, y: 100, width: 100, height: 100, rotation: 45 });
      child = add("RECTANGLE", f, { x: 0, y: 0, width: 20, height: 20 });
    });
    // Local (10, 10) rotated 45° clockwise lands at (0, 10√2) from the frame's corner.
    expect(hitTest(doc, page, 100, 100 + 10 * Math.SQRT2, { deep: true })).toBe(child);
    // (20, 0) from the corner is outside the rotated frame, so nothing is hit.
    expect(hitTest(doc, page, 120, 100, { deep: true })).toBeNull();
  });

  it("misses the corners of ellipses and rounded rectangles", () => {
    let ellipse = "", rounded = "";
    const { doc, page } = setup((add, p) => {
      ellipse = add("ELLIPSE", p, { x: 0, y: 0, width: 100, height: 50 });
      rounded = add("RECTANGLE", p, { x: 200, y: 0, width: 100, height: 100, cornerRadius: 20 });
    });
    expect(hitTest(doc, page, 50, 25)).toBe(ellipse);
    expect(hitTest(doc, page, 3, 3)).toBeNull();
    expect(hitTest(doc, page, 97, 47)).toBeNull();
    expect(hitTest(doc, page, 250, 50)).toBe(rounded);
    expect(hitTest(doc, page, 202, 2)).toBeNull(); // outside the top-left corner arc
    expect(hitTest(doc, page, 210, 2)).toBeNull();
    expect(hitTest(doc, page, 206, 6)).toBe(rounded); // just inside the arc
    expect(hitTest(doc, page, 250, 1)).toBe(rounded); // straight edge between corners
  });

  it("later siblings are on top", () => {
    let below = "", above = "";
    const { doc, page } = setup((add, p) => {
      below = add("RECTANGLE", p, { x: 0, y: 0, width: 100, height: 100 });
      above = add("RECTANGLE", p, { x: 50, y: 50, width: 100, height: 100 });
    });
    expect(hitTest(doc, page, 75, 75)).toBe(above);
    expect(hitTest(doc, page, 25, 25)).toBe(below);
  });

  it("follows sibling order after a move", () => {
    let a = "", b = "";
    const { doc, page } = setup((add, p) => {
      a = add("RECTANGLE", p, { x: 0, y: 0, width: 100, height: 100 });
      b = add("RECTANGLE", p, { x: 0, y: 0, width: 100, height: 100 });
    });
    expect(hitTest(doc, page, 50, 50)).toBe(b);
    doc.transact("Bring to front", (tx) => tx.move(a, page, "last"));
    expect(hitTest(doc, page, 50, 50)).toBe(a);
  });

  it("skips invisible and locked layers and their children", () => {
    let below = "", hidden = "", locked = "";
    const { doc, page } = setup((add, p) => {
      below = add("RECTANGLE", p, { x: 0, y: 0, width: 100, height: 100 });
      hidden = add("RECTANGLE", p, { x: 0, y: 0, width: 100, height: 100, visible: false });
      locked = add("FRAME", p, { x: 0, y: 0, width: 50, height: 50, locked: true });
      add("RECTANGLE", locked, { x: 0, y: 0, width: 50, height: 50 });
    });
    expect(hitTest(doc, page, 25, 25, { deep: true })).toBe(below);
    expect(hitTest(doc, page, 75, 75)).toBe(below);
    doc.transact("Show", (tx) => tx.set(hidden, "visible", true));
    expect(hitTest(doc, page, 75, 75)).toBe(hidden);
  });
});
