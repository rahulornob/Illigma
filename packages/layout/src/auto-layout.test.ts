/**
 * Auto layout for one frame. The first block ports every case of the old
 * prototype's `tests/autolayout.spec.js` (commit 8e3bd2f). The prototype
 * used page coordinates with the frame at (10, 20); Illigma positions are
 * relative to the parent, so expected positions here are 10 and 20 less.
 */

import { defaultNode, type Node, type NodeType } from "@illigma/format";
import { describe, expect, it } from "vitest";
import { layoutFrame, layoutSizing } from "./auto-layout.js";

const node = (type: NodeType, id: string, fields: Partial<Node> = {}): Node => ({ ...defaultNode(type, id, "frame", "a0"), ...fields });

/** The prototype's test frame: 400 × 200, fixed, horizontal, padding 10, gap 10. */
const frame = (fields: Partial<Node> = {}): Node =>
  node("FRAME", "frame", {
    x: 10,
    y: 20,
    width: 400,
    height: 200,
    layoutMode: "HORIZONTAL",
    layoutSizingHorizontal: "FIXED",
    layoutSizingVertical: "FIXED",
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 10,
    paddingBottom: 10,
    itemSpacing: 10,
    ...fields,
  });
const item = (id: string, fields: Partial<Node> = {}): Node => node("RECTANGLE", id, { width: 50, height: 30, ...fields });

const boxes = (lay: ReturnType<typeof layoutFrame>) => [...lay.children.values()];
const at = (lay: ReturnType<typeof layoutFrame>, id: string) => {
  const b = lay.children.get(id);
  if (!b) throw new Error(`${id} was not laid out`);
  return b;
};

describe("prototype cases (tests/autolayout.spec.js)", () => {
  it("2026 automatic spacing starts single Between child at start and never overlaps", () => {
    expect(at(layoutFrame(frame({ primaryAxisAlignItems: "SPACE_BETWEEN" }), [item("a")]), "a").x).toBe(10);
    for (const align of ["SPACE_BETWEEN", "SPACE_AROUND", "SPACE_EVENLY"] as const) {
      const lay = layoutFrame(frame({ primaryAxisAlignItems: align }), [item("a", { width: 250 }), item("b", { width: 250 })]);
      expect(at(lay, "b").x - at(lay, "a").x, align).toBe(250);
    }
    const evenly = layoutFrame(frame({ primaryAxisAlignItems: "SPACE_EVENLY" }), [item("a"), item("b")]);
    expect(at(evenly, "a").x).toBeCloseTo(10 + 280 / 3);
  });

  it("fill redistributes at min/max and equalizes nested content areas", () => {
    const lay = layoutFrame(frame(), [
      item("a", { layoutSizingHorizontal: "FILL", minWidth: 250 }),
      item("b", { layoutSizingHorizontal: "FILL", maxWidth: 150 }),
    ]);
    expect(boxes(lay).map((b) => b.width)).toEqual([250, 120]);
    const padded = layoutFrame(frame(), [
      node("FRAME", "a", { height: 30, layoutMode: "HORIZONTAL", paddingLeft: 20, paddingRight: 20, layoutSizingHorizontal: "FILL", layoutSizingVertical: "FIXED" }),
      node("FRAME", "b", { height: 30, layoutMode: "HORIZONTAL", paddingLeft: 10, paddingRight: 10, layoutSizingHorizontal: "FILL", layoutSizingVertical: "FIXED" }),
    ]);
    expect(at(padded, "a").width - at(padded, "b").width).toBeCloseTo(20);
  });

  it("padding floor wins over max size; absolute/hidden layers do not affect hug", () => {
    const lay = layoutFrame(
      frame({ layoutSizingHorizontal: "HUG", layoutSizingVertical: "HUG", paddingLeft: 30, paddingRight: 40, maxWidth: 20 }),
      [item("a", { layoutPositioning: "ABSOLUTE", width: 900 }), item("b", { visible: false })],
    );
    expect(lay.width).toBe(70);
    expect(lay.height).toBe(20);
    expect(lay.children.size).toBe(0);
  });

  it("horizontal and vertical wrap use independent cross gaps and hug cross size", () => {
    const horizontal = layoutFrame(frame({ layoutWrap: "WRAP", layoutSizingVertical: "HUG", counterAxisSpacing: 15, width: 140 }), [item("a"), item("b"), item("c")]);
    expect(boxes(horizontal).map((b) => [b.x, b.y])).toEqual([[10, 10], [70, 10], [10, 55]]);
    expect(horizontal.height).toBe(95);
    const vertical = layoutFrame(
      frame({ layoutMode: "VERTICAL", layoutWrap: "WRAP", layoutSizingHorizontal: "HUG", counterAxisSpacing: 15, height: 100 }),
      [item("a"), item("b"), item("c")],
    );
    expect(boxes(vertical).map((b) => [b.x, b.y])).toEqual([[10, 10], [10, 50], [75, 10]]);
    expect(vertical.width).toBe(135);
  });

  // Grid auto layout is P1 (PRD 5.5, Phase 4) and not in format v0. The prototype case to port then:
  // 3 columns "1fr 2fr 1fr", hug rows, row gap 12; a (span 2, fill), b (fill), c (span 3, fill, h 40)
  // → cells [0,0] [2,0] [0,1]; widths 280, 90, 380; frame height 102.
  it.todo("grid auto placement respects spans, fractional tracks, fill and auto rows");

  it("explicit negative gaps permit deliberate overlap", () => {
    const lay = layoutFrame(frame({ itemSpacing: -10, layoutSizingHorizontal: "HUG" }), [item("a"), item("b")]);
    expect(at(lay, "b").x - at(lay, "a").x).toBe(40);
    expect(lay.width).toBe(110);
  });

  it("empty zero-padding frames retain a valid positive size", () => {
    const lay = layoutFrame(frame({ layoutSizingHorizontal: "HUG", layoutSizingVertical: "HUG", paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 }), []);
    expect([lay.width, lay.height]).toEqual([1, 1]);
  });
});

describe("alignment and spacing", () => {
  it("places children with the 9-point alignment", () => {
    const cases = [
      ["MIN", "MIN", 10, 10],
      ["CENTER", "CENTER", 10 + (380 - 110) / 2, 10 + (180 - 30) / 2],
      ["MAX", "MAX", 400 - 10 - 110, 200 - 10 - 30],
    ] as const;
    for (const [primary, counter, x, y] of cases) {
      const lay = layoutFrame(frame({ primaryAxisAlignItems: primary, counterAxisAlignItems: counter }), [item("a"), item("b")]);
      expect([at(lay, "a").x, at(lay, "a").y], `${primary} ${counter}`).toEqual([x, y]);
      expect(at(lay, "b").x).toBe(x + 60);
    }
  });

  it("aligns each child across the stack by its own size", () => {
    const lay = layoutFrame(frame({ counterAxisAlignItems: "CENTER" }), [item("a", { height: 20 }), item("b", { height: 100 })]);
    expect(at(lay, "a").y).toBe(10 + 80);
    expect(at(lay, "b").y).toBe(10 + 40);
  });

  it("Around and Evenly centre a single child; Between keeps it at the start", () => {
    expect(at(layoutFrame(frame({ primaryAxisAlignItems: "SPACE_AROUND" }), [item("a")]), "a").x).toBe(10 + 165);
    expect(at(layoutFrame(frame({ primaryAxisAlignItems: "SPACE_EVENLY" }), [item("a")]), "a").x).toBe(10 + 165);
    expect(at(layoutFrame(frame({ primaryAxisAlignItems: "SPACE_BETWEEN" }), [item("a")]), "a").x).toBe(10);
  });

  it("Between spreads children edge to edge and ignores the fixed gap", () => {
    const lay = layoutFrame(frame({ primaryAxisAlignItems: "SPACE_BETWEEN", itemSpacing: 500 }), [item("a"), item("b"), item("c")]);
    expect(boxes(lay).map((b) => b.x)).toEqual([10, 175, 340]);
  });

  it("overflowing children start at the leading edge with an Auto gap, and overflow by alignment otherwise", () => {
    const wide = [item("a", { width: 300 }), item("b", { width: 300 })];
    expect(at(layoutFrame(frame({ primaryAxisAlignItems: "SPACE_EVENLY" }), wide), "a").x).toBe(10);
    expect(at(layoutFrame(frame({ primaryAxisAlignItems: "MAX" }), wide), "a").x).toBe(10 + 380 - 610);
  });

  it("vertical stacks run top to bottom", () => {
    const lay = layoutFrame(frame({ layoutMode: "VERTICAL", itemSpacing: 4 }), [item("a"), item("b")]);
    expect(boxes(lay).map((b) => [b.x, b.y])).toEqual([[10, 10], [10, 44]]);
  });

  it("wrapped rows default their gap to the item spacing, never negative", () => {
    const rows = (fields: Partial<Node>) => boxes(layoutFrame(frame({ layoutWrap: "WRAP", width: 140, ...fields }), [item("a"), item("b"), item("c")]))[2]?.y;
    expect(rows({ itemSpacing: 6 })).toBe(10 + 30 + 6);
    expect(rows({ itemSpacing: -6 })).toBe(10 + 30);
  });

  it("wrapped rows can spread across a fixed frame (counterAxisAlignContent SPACE_BETWEEN)", () => {
    const lay = layoutFrame(frame({ layoutWrap: "WRAP", width: 140, counterAxisAlignContent: "SPACE_BETWEEN" }), [item("a"), item("b"), item("c")]);
    expect(at(lay, "c").y).toBe(200 - 10 - 30);
  });

  it("wrapped rows align as a block with the counter axis alignment", () => {
    const lay = layoutFrame(frame({ layoutWrap: "WRAP", width: 140, counterAxisSpacing: 0, counterAxisAlignItems: "MAX" }), [item("a"), item("b"), item("c")]);
    expect([at(lay, "a").y, at(lay, "c").y]).toEqual([200 - 10 - 60, 200 - 10 - 30]);
  });

  it("does not wrap a frame that hugs its length", () => {
    const lay = layoutFrame(frame({ layoutWrap: "WRAP", width: 140, layoutSizingHorizontal: "HUG" }), [item("a"), item("b"), item("c")]);
    expect(boxes(lay).map((b) => b.y)).toEqual([10, 10, 10]);
    expect(lay.width).toBe(190);
  });
});

describe("sizing", () => {
  it("hugs the content plus padding on both axes", () => {
    const lay = layoutFrame(frame({ layoutSizingHorizontal: "HUG", layoutSizingVertical: "HUG" }), [item("a"), item("b", { height: 44 })]);
    expect([lay.width, lay.height]).toEqual([130, 64]);
  });

  it("hugs within min and max, aligning the content inside the extra room", () => {
    const lay = layoutFrame(frame({ layoutSizingHorizontal: "HUG", minWidth: 200, maxHeight: 40, layoutSizingVertical: "HUG", primaryAxisAlignItems: "CENTER" }), [item("a")]);
    expect([lay.width, lay.height]).toEqual([200, 40]);
    expect(at(lay, "a").x).toBe(75);
  });

  it("uses the sizing modes when layoutSizing is absent: AUTO hugs, FIXED keeps the size", () => {
    const base = { layoutSizingHorizontal: undefined, layoutSizingVertical: undefined } as Partial<Node>;
    const f = frame(base);
    delete f.layoutSizingHorizontal;
    delete f.layoutSizingVertical;
    expect(layoutFrame(f, [item("a")])).toMatchObject({ width: 70, height: 50 }); // Figma's default: AUTO on both axes
    expect(layoutFrame({ ...f, primaryAxisSizingMode: "FIXED" }, [item("a")])).toMatchObject({ width: 400, height: 50 });
    expect(layoutFrame({ ...f, counterAxisSizingMode: "FIXED" }, [item("a")])).toMatchObject({ width: 70, height: 200 });
    // layoutSizing wins over the sizing mode when both are set.
    expect(layoutFrame({ ...f, primaryAxisSizingMode: "FIXED", layoutSizingHorizontal: "HUG" }, [item("a")]).width).toBe(70);
  });

  it("stretches Fill children across the stack, within their limits", () => {
    const lay = layoutFrame(frame(), [item("a", { layoutSizingVertical: "FILL" }), item("b", { layoutSizingVertical: "FILL", maxHeight: 50 })]);
    expect([at(lay, "a").height, at(lay, "b").height]).toEqual([180, 50]);
    expect(lay.forced.get("a")).toEqual({ height: 180 });
  });

  it("stretches Fill children to the tallest fixed sibling in a hugging frame", () => {
    const lay = layoutFrame(frame({ layoutSizingVertical: "HUG" }), [item("a", { height: 60 }), item("divider", { height: 500, layoutSizingVertical: "FILL" })]);
    expect(lay.height).toBe(80);
    expect(at(lay, "divider").height).toBe(60);
  });

  it("a hugging frame whose children all fill keeps their natural size", () => {
    const lay = layoutFrame(frame({ layoutSizingVertical: "HUG" }), [item("a", { height: 70, layoutSizingVertical: "FILL" }), item("b", { layoutSizingVertical: "FILL" })]);
    expect(lay.height).toBe(90);
    expect([at(lay, "a").height, at(lay, "b").height]).toEqual([70, 70]);
  });

  it("shares the free length equally among Fill children, after fixed ones and gaps", () => {
    const lay = layoutFrame(frame(), [item("a", { layoutSizingHorizontal: "FILL" }), item("fixed", { width: 100 }), item("b", { layoutSizingHorizontal: "FILL" })]);
    expect(boxes(lay).map((b) => [b.x, b.width])).toEqual([[10, 130], [150, 100], [260, 130]]);
  });

  it("Fill along the stack acts as the natural size when the frame hugs its length", () => {
    const lay = layoutFrame(frame({ layoutSizingHorizontal: "HUG" }), [item("a", { width: 80, layoutSizingHorizontal: "FILL" })]);
    expect([lay.width, at(lay, "a").width]).toEqual([100, 80]);
  });

  it("Fill children shrink to their padding (and at least 1 px) when there is no room", () => {
    const lay = layoutFrame(frame({ width: 50 }), [
      node("FRAME", "a", { layoutMode: "HORIZONTAL", paddingLeft: 8, paddingRight: 8, layoutSizingHorizontal: "FILL", layoutSizingVertical: "FIXED" }),
      item("b", { layoutSizingHorizontal: "FILL" }),
      item("c", { width: 100 }),
    ]);
    expect([at(lay, "a").width, at(lay, "b").width]).toEqual([16, 1]);
  });

  it("clamps fixed children to their own min and max", () => {
    const lay = layoutFrame(frame(), [item("a", { width: 10, minWidth: 40 }), item("b", { height: 300, maxHeight: 25 })]);
    expect([at(lay, "a").width, at(lay, "b").height]).toEqual([40, 25]);
  });

  it("layoutSizing: Hug needs an auto layout frame and Fill needs an auto layout parent", () => {
    expect(layoutSizing(item("r", { layoutSizingHorizontal: "HUG" }), "width", true)).toBe("FIXED");
    expect(layoutSizing(item("r", { layoutSizingHorizontal: "FILL" }), "width", false)).toBe("FIXED");
    expect(layoutSizing(item("r", { layoutSizingHorizontal: "FILL" }), "width", true)).toBe("FILL");
    expect(layoutSizing(frame({ layoutSizingVertical: "HUG" }), "height", false)).toBe("HUG");
    expect(layoutSizing({ ...frame(), layoutMode: "NONE" }, "height", false)).toBe("FIXED");
  });
});

describe("rotation", () => {
  it("lays out a quarter-turned child by its rotated bounding box", () => {
    // 100 × 20 turned 90° clockwise about its top-left: occupies 20 × 100, to the left of its origin.
    const lay = layoutFrame(frame({ layoutSizingVertical: "HUG" }), [item("a", { width: 100, height: 20, rotation: 90 }), item("b")]);
    expect(at(lay, "a")).toEqual({ x: 10 + 20, y: 10, width: 100, height: 20 });
    expect(at(lay, "b").x).toBe(10 + 20 + 10);
    expect(lay.height).toBe(120);
  });

  it("a half-turned child still fills, placed from its far corner", () => {
    const lay = layoutFrame(frame(), [item("a", { rotation: 180, layoutSizingHorizontal: "FILL" })]);
    expect(at(lay, "a")).toEqual({ x: 10 + 380, y: 10 + 30, width: 380, height: 30 });
  });

  it("Fill does not apply to a child at an odd angle", () => {
    const lay = layoutFrame(frame(), [item("a", { rotation: 45, width: 40, height: 40, layoutSizingHorizontal: "FILL" })]);
    const b = at(lay, "a");
    expect(b.width).toBe(40);
    expect(b.x).toBeCloseTo(10 + 20 * Math.SQRT2);
    expect(b.y).toBeCloseTo(10);
  });
});
