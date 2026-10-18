import { describe, expect, it } from "vitest";
import {
  constrainToAxis,
  handleAt,
  handleCursor,
  marqueeHits,
  nudgeFor,
  rectFromPoints,
  rectsTouch,
  resizeScale,
  rotate,
  scaleRect,
  unionRects,
  type Handle,
  type Rect,
  type ResizeModifiers,
} from "./geometry";

const box: Rect = { x: 100, y: 50, width: 200, height: 100 };
const resize = (handle: Handle, dx: number, dy: number, mods: ResizeModifiers = {}, r: Rect = box) => scaleRect(r, resizeScale(r, handle, dx, dy, mods));

describe("resize", () => {
  it("moves only the dragged edges; the opposite ones stay put", () => {
    expect(resize("se", 50, 20)).toEqual({ x: 100, y: 50, width: 250, height: 120 });
    expect(resize("nw", 50, 20)).toEqual({ x: 150, y: 70, width: 150, height: 80 });
    expect(resize("e", 30, 99)).toEqual({ x: 100, y: 50, width: 230, height: 100 });
    expect(resize("n", 99, -30)).toEqual({ x: 100, y: 20, width: 200, height: 130 });
    expect(resize("w", -10, 0)).toEqual({ x: 90, y: 50, width: 210, height: 100 });
    expect(resize("s", 0, 25)).toEqual({ x: 100, y: 50, width: 200, height: 125 });
  });

  it("Shift keeps the aspect ratio, following the larger change", () => {
    expect(resize("se", 200, 10, { keepRatio: true })).toEqual({ x: 100, y: 50, width: 400, height: 200 });
    expect(resize("se", 10, 100, { keepRatio: true })).toEqual({ x: 100, y: 50, width: 400, height: 200 });
    // Shrinking keeps the ratio too.
    expect(resize("nw", 100, 0, { keepRatio: true })).toEqual({ x: 200, y: 100, width: 100, height: 50 });
    // Flipped past the left edge: same size, mirrored; the ratio holds.
    expect(resize("se", -400, 0, { keepRatio: true })).toEqual({ x: -100, y: 50, width: 200, height: 100 });
  });

  it("Shift on an edge handle scales the other axis about its centre", () => {
    expect(resize("e", 200, 0, { keepRatio: true })).toEqual({ x: 100, y: 0, width: 400, height: 200 });
    expect(resize("s", 0, 100, { keepRatio: true })).toEqual({ x: 0, y: 50, width: 400, height: 200 });
  });

  it("Alt resizes from the centre", () => {
    expect(resize("e", 20, 0, { fromCenter: true })).toEqual({ x: 80, y: 50, width: 240, height: 100 });
    expect(resize("se", 20, 10, { fromCenter: true })).toEqual({ x: 80, y: 40, width: 240, height: 120 });
    expect(resize("se", 100, 0, { fromCenter: true, keepRatio: true })).toEqual({ x: 0, y: 0, width: 400, height: 200 });
  });

  it("dragging past the opposite edge flips without a jump", () => {
    // The right edge dragged 250 px left: 50 px past the left edge.
    const t = resizeScale(box, "e", -250, 0);
    expect(t.sx).toBeLessThan(0);
    expect(scaleRect(box, t)).toEqual({ x: 50, y: 50, width: 50, height: 100 });
    // A corner dragged past both edges flips both ways.
    expect(resize("se", -230, -130)).toEqual({ x: 70, y: 20, width: 30, height: 30 });
    expect(resize("nw", 260, 140)).toEqual({ x: 300, y: 150, width: 60, height: 40 });
  });

  it("never gets thinner than 1 px, growing away from the fixed edge", () => {
    expect(resize("e", -200, 0)).toEqual({ x: 100, y: 50, width: 1, height: 100 });
    expect(resize("w", 200, 0)).toEqual({ x: 299, y: 50, width: 1, height: 100 });
    expect(resize("e", -199.8, 0).width).toBe(1);
  });

  it("leaves an axis it doesn't scale, or one with no size, alone (a line keeps height 0)", () => {
    const line: Rect = { x: 10, y: 20, width: 100, height: 0 };
    expect(resize("e", 40, 0, {}, line)).toEqual({ x: 10, y: 20, width: 140, height: 0 });
    expect(resize("se", 40, 30, {}, line)).toEqual({ x: 10, y: 20, width: 140, height: 0 });
    expect(resize("e", 0, 0, { fromCenter: true }, { x: 0, y: 0, width: 0, height: 10 })).toEqual({ x: 0, y: 0, width: 0, height: 10 });
    // A thin layer resized along the other axis stays thin.
    expect(resize("e", 20, 0, {}, { x: 0, y: 0, width: 10, height: 0.5 })).toEqual({ x: 0, y: 0, width: 30, height: 0.5 });
  });

  it("snaps moved edges to whole pixels but leaves edges that stayed put alone", () => {
    const odd = { x: 10.5, y: 0.25, width: 20, height: 20 };
    expect(resize("e", 3.4, 0, {}, odd)).toEqual({ x: 10.5, y: 0.25, width: 23.5, height: 20 });
    expect(scaleRect(odd, resizeScale(odd, "e", 3.4, 0), { snap: false }).width).toBeCloseTo(23.4);
  });
});

describe("moving and nudging", () => {
  it("Shift keeps the axis that moved further", () => {
    expect(constrainToAxis(30, -10)).toEqual({ x: 30, y: 0 });
    expect(constrainToAxis(3, -10)).toEqual({ x: 0, y: -10 });
  });

  it("arrow keys nudge 1 px, Shift+arrow 10 px", () => {
    expect(nudgeFor("ArrowLeft", false)).toEqual({ x: -1, y: 0 });
    expect(nudgeFor("ArrowRight", true)).toEqual({ x: 10, y: 0 });
    expect(nudgeFor("ArrowUp", false)).toEqual({ x: 0, y: -1 });
    expect(nudgeFor("ArrowDown", true)).toEqual({ x: 0, y: 10 });
    expect(nudgeFor("ArrowDown", true, 8)).toEqual({ x: 0, y: 8 });
    expect(nudgeFor("a", false)).toBeNull();
  });

  it("rotates vectors the way the renderer turns layers", () => {
    const r = rotate(10, 0, 90);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(10);
    expect(rotate(3, 4, 0)).toEqual({ x: 3, y: 4 });
  });
});

describe("marquee", () => {
  const layers = [
    { id: "a", rect: { x: 0, y: 0, width: 10, height: 10 } },
    { id: "b", rect: { x: 20, y: 0, width: 10, height: 10 } },
    { id: "c", rect: { x: 0, y: 40, width: 10, height: 10 } },
  ];

  it("selects every layer it touches, dragged in any direction", () => {
    expect(marqueeHits(layers, rectFromPoints(25, 5, 5, 8))).toEqual(["a", "b"]);
    expect(marqueeHits(layers, rectFromPoints(12, 12, 18, 30))).toEqual([]);
    expect(marqueeHits(layers, rectFromPoints(-5, -5, 100, 100))).toEqual(["a", "b", "c"]);
  });

  it("counts touching edges", () => {
    expect(rectsTouch({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 10, width: 5, height: 5 })).toBe(true);
    expect(rectsTouch({ x: 0, y: 0, width: 10, height: 10 }, { x: 10.1, y: 0, width: 5, height: 5 })).toBe(false);
  });

  it("unions boxes", () => {
    expect(unionRects(layers.map((l) => l.rect))).toEqual({ x: 0, y: 0, width: 30, height: 50 });
    expect(unionRects([])).toBeNull();
  });
});

describe("handles", () => {
  it("finds corners first, then edges anywhere along their length", () => {
    expect(handleAt(0, 0, 100, 50)).toBe("nw");
    expect(handleAt(103, 52, 100, 50)).toBe("se");
    expect(handleAt(50, -3, 100, 50)).toBe("n");
    expect(handleAt(20, 50, 100, 50)).toBe("s");
    expect(handleAt(99, 30, 100, 50)).toBe("e");
    expect(handleAt(-4, 10, 100, 50)).toBe("w");
    expect(handleAt(50, 25, 100, 50)).toBeNull();
    expect(handleAt(120, 25, 100, 50)).toBeNull();
  });

  it("picks the nearer edge on a box smaller than the grab area", () => {
    expect(handleAt(1, 1, 4, 4)).toBe("nw");
    expect(handleAt(3.5, 3.5, 4, 4)).toBe("se");
  });

  it("keeps the middle of a small box for moving: inside, an edge grabs at most a quarter of the box", () => {
    expect(handleAt(5, 50, 10, 100)).toBeNull();
    expect(handleAt(4, 4, 8, 8)).toBeNull();
    expect(handleAt(2, 50, 10, 100)).toBe("w");
    expect(handleAt(8, 50, 10, 100)).toBe("e");
    // Corners and edges are still reachable from outside.
    expect(handleAt(-4, -4, 8, 8)).toBe("nw");
    expect(handleAt(12, 12, 8, 8)).toBe("se");
    expect(handleAt(4, -5, 8, 8)).toBe("n");
    expect(handleAt(-5, 4, 8, 8)).toBe("w");
    expect(handleAt(4, 13, 8, 8)).toBe("s");
    expect(handleAt(4, 15, 8, 8)).toBeNull();
    // Big boxes keep the full 6 px inside.
    expect(handleAt(95, 25, 100, 50)).toBe("e");
  });

  it("gives a line (no height) no top or bottom edge: grabbing it moves, its ends resize", () => {
    expect(handleAt(50, 0, 100, 0)).toBeNull();
    expect(handleAt(50, 4, 100, 0)).toBeNull();
    expect(handleAt(-3, 0, 100, 0)).toBe("w");
    expect(handleAt(103, 1, 100, 0)).toBe("e");
  });

  it("turns the resize cursor with the layer", () => {
    expect(handleCursor("e")).toBe("ew-resize");
    expect(handleCursor("se")).toBe("nwse-resize");
    expect(handleCursor("n")).toBe("ns-resize");
    expect(handleCursor("ne")).toBe("nesw-resize");
    expect(handleCursor("e", 90)).toBe("ns-resize");
    expect(handleCursor("se", 90)).toBe("nesw-resize");
  });
});
