import { describe, expect, it } from "vitest";
import { Document } from "@illigma/core";
import { vectorNetworkFromSvgPath, type Node, type NodeId, type NodeType } from "@illigma/format";
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

describe("hitTest: path shapes", () => {
  const solid = [{ type: "SOLID" as const, visible: true, color: { r: 1, g: 0, b: 0, a: 1 } }];
  const RING = "M50 0 A50 50 0 1 1 49.999 0 Z M50 25 A25 25 0 1 1 49.999 25 Z";

  it("hits stars and polygons by their shape, not their box", () => {
    let star = "", tri = "";
    const { doc, page } = setup((add, p) => {
      star = add("STAR", p, { x: 0, y: 0, width: 100, height: 100 });
      tri = add("POLYGON", p, { x: 200, y: 0, width: 100, height: 100 });
    });
    expect(hitTest(doc, page, 50, 50)).toBe(star);
    expect(hitTest(doc, page, 50, 2)).toBe(star); // the top point
    expect(hitTest(doc, page, 50, 80)).toBeNull(); // the notch between the lower points
    expect(hitTest(doc, page, 5, 5)).toBeNull();
    expect(hitTest(doc, page, 250, 70)).toBe(tri);
    expect(hitTest(doc, page, 250, 90)).toBeNull(); // below the triangle, inside its box
    expect(hitTest(doc, page, 205, 10)).toBeNull();
  });

  it("hits filled vectors by their regions, holes excluded", () => {
    let ring = "";
    const { doc, page } = setup((add, p) => {
      ring = add("VECTOR", p, { width: 100, height: 100, fills: solid, vectorNetwork: vectorNetworkFromSvgPath(RING, { windingRule: "EVENODD" }) });
    });
    expect(hitTest(doc, page, 50, 10)).toBe(ring);
    expect(hitTest(doc, page, 50, 50)).toBeNull(); // the hole
    expect(hitTest(doc, page, 3, 3)).toBeNull(); // outside the circle
    doc.transact("Non-zero", (tx) => tx.set(ring, "vectorNetwork", vectorNetworkFromSvgPath(RING, { windingRule: "NONZERO" })));
    expect(hitTest(doc, page, 50, 50)).toBe(ring);
  });

  it("hits unfilled vectors and lines near their stroke only, within the tolerance", () => {
    let path = "", line = "";
    const { doc, page } = setup((add, p) => {
      path = add("VECTOR", p, { width: 100, height: 100, strokes: solid, strokeWeight: 4, vectorNetwork: vectorNetworkFromSvgPath("M10 10 L90 10 L90 90 Z") });
      line = add("LINE", p, { x: 200, y: 50, width: 100, height: 0, rotation: 90, strokeWeight: 2 });
    });
    expect(hitTest(doc, page, 50, 10)).toBe(path);
    expect(hitTest(doc, page, 50, 13)).toBe(path); // 2 (half the stroke) + 2 (tolerance) from the edge
    expect(hitTest(doc, page, 50, 15)).toBeNull();
    expect(hitTest(doc, page, 70, 40)).toBeNull(); // inside, but there is no fill
    expect(hitTest(doc, page, 50, 15, { tolerance: 5 })).toBe(path);
    expect(hitTest(doc, page, 50, 11, { tolerance: 0 })).toBe(path);
    // The line is rotated 90° about its start, so it runs down from (200, 50) to (200, 150).
    expect(hitTest(doc, page, 200, 100)).toBe(line);
    expect(hitTest(doc, page, 202.5, 100)).toBe(line);
    expect(hitTest(doc, page, 204, 100)).toBeNull();
    expect(hitTest(doc, page, 250, 50)).toBeNull();
    expect(hitTest(doc, page, 200, 152.5)).toBe(line); // ends are reachable too
    expect(hitTest(doc, page, 200, 154)).toBeNull(); // past its end
  });

  it("hits a filled vector with a stroke on either, and an empty vector never", () => {
    let both = "";
    const { doc, page } = setup((add, p) => {
      both = add("VECTOR", p, { width: 100, height: 100, fills: solid, strokes: solid, strokeWeight: 10, vectorNetwork: vectorNetworkFromSvgPath("M10 10 L90 10 L90 90 Z") });
      add("VECTOR", p, { x: 200, width: 100, height: 100, fills: solid });
    });
    expect(hitTest(doc, page, 70, 30)).toBe(both);
    expect(hitTest(doc, page, 50, 4)).toBe(both); // on the stroke's outer half
    expect(hitTest(doc, page, 250, 50)).toBeNull();
  });
});

describe("hitTest: stroke alignment (QC round 7)", () => {
  const blue = [{ type: "SOLID" as const, visible: true, color: { r: 0, g: 0, b: 1, a: 1 } }];
  // A 100 × 100 square path at (0, 0), closed into one region, with no fill: only its 10-unit stroke can be hit.
  const square = (strokeAlign: "INSIDE" | "OUTSIDE" | "CENTER") =>
    setup((add, p) => {
      add("VECTOR", p, {
        width: 100,
        height: 100,
        fills: [],
        strokes: blue,
        strokeWeight: 10,
        strokeAlign,
        vectorNetwork: vectorNetworkFromSvgPath("M0 0 L100 0 L100 100 L0 100 Z"),
      });
    });

  it("inside strokes reach the whole weight inward, and nothing outward", () => {
    const { doc, page } = square("INSIDE");
    expect(hitTest(doc, page, 50, 8, { tolerance: 0 })).not.toBeNull(); // the visible band, 0–10 inside
    expect(hitTest(doc, page, 50, -4, { tolerance: 0 })).toBeNull(); // nothing is drawn outside
    expect(hitTest(doc, page, 50, 14, { tolerance: 0 })).toBeNull();
    expect(hitTest(doc, page, 50, -1, { tolerance: 2 })).not.toBeNull(); // the outline itself, within tolerance
  });

  it("outside strokes reach the whole weight outward, and nothing inward", () => {
    const { doc, page } = square("OUTSIDE");
    expect(hitTest(doc, page, 50, -8, { tolerance: 0 })).not.toBeNull();
    expect(hitTest(doc, page, 50, 4, { tolerance: 0 })).toBeNull(); // no phantom inner band
    expect(hitTest(doc, page, 50, -12, { tolerance: 0 })).toBeNull();
    // Miter corners reach past the corner on the outside.
    expect(hitTest(doc, page, -8, -8, { tolerance: 0 })).not.toBeNull();
  });

  it("centred strokes reach half the weight either side", () => {
    const { doc, page } = square("CENTER");
    expect(hitTest(doc, page, 50, 4, { tolerance: 0 })).not.toBeNull();
    expect(hitTest(doc, page, 50, -4, { tolerance: 0 })).not.toBeNull();
    expect(hitTest(doc, page, 50, 7, { tolerance: 0 })).toBeNull();
  });

  it("rectangles, ellipses and frames can be picked on a centred or outside stroke past their box", () => {
    let rect = "", ellipse = "", frame = "", inner = "", child = "";
    const { doc, page } = setup((add, p) => {
      rect = add("RECTANGLE", p, { x: 0, y: 0, width: 100, height: 100, fills: blue, strokes: blue, strokeWeight: 20, strokeAlign: "OUTSIDE" });
      ellipse = add("ELLIPSE", p, { x: 200, y: 0, width: 100, height: 100, fills: blue, strokes: blue, strokeWeight: 20, strokeAlign: "CENTER" });
      inner = add("RECTANGLE", p, { x: 400, y: 0, width: 100, height: 100, fills: blue, strokes: blue, strokeWeight: 20, strokeAlign: "INSIDE" });
      frame = add("FRAME", p, { x: 0, y: 200, width: 100, height: 100, strokes: blue, strokeWeight: 20, strokeAlign: "OUTSIDE" });
      child = add("RECTANGLE", frame, { x: 90, y: 0, width: 30, height: 30, fills: blue });
    });
    expect(hitTest(doc, page, -15, 50)).toBe(rect);
    expect(hitTest(doc, page, -25, 50)).toBeNull();
    expect(hitTest(doc, page, 118, 118)).toBe(rect); // the square corner of the outside stroke
    expect(hitTest(doc, page, 191, 50)).toBe(ellipse); // half of 20 past the left edge
    expect(hitTest(doc, page, 187, 50)).toBeNull();
    expect(hitTest(doc, page, 395, 50)).toBeNull(); // inside strokes don't reach out
    expect(hitTest(doc, page, 405, 50)).toBe(inner);
    expect(hitTest(doc, page, 50, 185)).toBe(frame);
    // The frame still clips its children to its box, not to its stroke.
    expect(hitTest(doc, page, 110, 210, { deep: true })).toBe(frame);
    expect(hitTest(doc, page, 95, 210, { deep: true })).toBe(child);
  });
});

describe("hitTest with masks", () => {
  it("a mask clips the siblings above it: only points inside the mask hit them", () => {
    let top = "";
    const { doc, page } = setup((add, p) => {
      const group = add("GROUP", p, { x: 0, y: 0, width: 100, height: 100 });
      add("ELLIPSE", group, { x: 0, y: 0, width: 100, height: 100, isMask: true });
      top = add("RECTANGLE", group, { x: 0, y: 0, width: 100, height: 100 });
    });
    expect(hitTest(doc, page, 50, 50, { deep: true })).toBe(top);
    // The corner is outside the ellipse: the rectangle is masked away there, and nothing else is hit.
    expect(hitTest(doc, page, 2, 2, { deep: true })).toBeNull();
  });
});
