import { describe, expect, it } from "vitest";
import { ExportError, exportScene, type Rect } from "./index.js";
import { BLUE, build, RED, solid } from "./test.fixture.js";

const near = (r: Rect, x: number, y: number, w: number, h: number) => {
  expect(r.x).toBeCloseTo(x, 3);
  expect(r.y).toBeCloseTo(y, 3);
  expect(r.width).toBeCloseTo(w, 3);
  expect(r.height).toBeCloseTo(h, 3);
};

describe("exportScene: bounds", () => {
  it("covers what a layer draws: strokes reach half their weight outside", () => {
    const { doc, ids } = build((add, p) => ({ r: add("RECTANGLE", p, { x: 10, y: 20, width: 100, height: 50, fills: solid(RED), strokes: solid(BLUE), strokeWeight: 4 }) }));
    near(exportScene(doc, ids.r, {}).region, 8, 18, 104, 54);
    // useAbsoluteBounds: the box itself.
    near(exportScene(doc, ids.r, { useAbsoluteBounds: true }).region, 10, 20, 100, 50);
  });

  it("follows rotation, exactly for ellipses", () => {
    const { doc, ids } = build((add, p) => ({
      sq: add("RECTANGLE", p, { width: 100, height: 100, rotation: 45, fills: solid(RED) }),
      el: add("ELLIPSE", p, { x: 200, width: 100, height: 40, rotation: 90, fills: solid(RED) }),
    }));
    const d = 100 * Math.SQRT2;
    near(exportScene(doc, ids.sq, {}).region, -d / 2, 0, d, d);
    // A 100 × 40 ellipse turned 90° about its top-left covers x 160…200, y 0…100.
    near(exportScene(doc, ids.el, {}).region, 160, 0, 40, 100);
  });

  it("clips children to frames, but not to groups", () => {
    const { doc, ids } = build((add, p) => {
      const frame = add("FRAME", p, { x: 0, y: 0, width: 100, height: 100 });
      add("RECTANGLE", frame, { x: 50, y: 50, width: 200, height: 200, fills: solid(RED) });
      const group = add("GROUP", p, { x: 300, y: 0, width: 10, height: 10 });
      add("RECTANGLE", group, { x: 10, y: 10, width: 50, height: 20, fills: solid(RED) });
      add("RECTANGLE", group, { x: 100, y: 40, width: 10, height: 10, fills: solid(RED) });
      const empty = add("FRAME", p, { x: 500, y: 0, width: 80, height: 60 });
      return { frame, group, empty };
    });
    near(exportScene(doc, ids.frame, {}).region, 0, 0, 100, 100);
    near(exportScene(doc, ids.group, {}).region, 310, 10, 100, 40);
    // An empty frame still exports at its size.
    near(exportScene(doc, ids.empty, {}).region, 500, 0, 80, 60);
  });

  it("measures lines by their stroke and caps", () => {
    const { doc, ids } = build((add, p) => ({
      butt: add("LINE", p, { width: 100, height: 0, strokes: solid(BLUE), strokeWeight: 4 }),
      square: add("LINE", p, { y: 50, width: 100, height: 0, strokes: solid(BLUE), strokeWeight: 4, strokeCap: "SQUARE" }),
    }));
    near(exportScene(doc, ids.butt, {}).region, 0, -2, 100, 4);
    near(exportScene(doc, ids.square, {}).region, -2, 48, 104, 4);
  });

  it("measures stars by their points, not their box", () => {
    const { doc, ids } = build((add, p) => ({ s: add("POLYGON", p, { width: 100, height: 100, fills: solid(RED) }) }));
    // A triangle on the inscribed ellipse: its base is at y = 75.
    near(exportScene(doc, ids.s, {}).region, 50 - 43.3013, 0, 86.6025, 75);
  });

  it("places nested layers through their ancestors' transforms", () => {
    const { doc, ids } = build((add, p) => {
      const outer = add("FRAME", p, { x: 100, y: 100, width: 200, height: 200, rotation: 90 });
      const inner = add("RECTANGLE", outer, { x: 10, y: 20, width: 30, height: 40, fills: solid(RED) });
      return { inner };
    });
    // Turned 90° clockwise about (100, 100): local (10, 20)…(40, 60) maps to x 40…80, y 110…140.
    const scene = exportScene(doc, ids.inner, {});
    near(scene.region, 40, 110, 40, 30);
    expect(scene.roots.map((n) => n.id)).toEqual([ids.inner]);
  });

  it("with contentsOnly off, draws every top-level layer that overlaps", () => {
    const { doc, page, ids } = build((add, p) => ({
      a: add("RECTANGLE", p, { width: 100, height: 100, fills: solid(RED) }),
      b: add("RECTANGLE", p, { x: 50, y: 50, width: 100, height: 100, fills: solid(BLUE) }),
      c: add("RECTANGLE", p, { x: 500, width: 10, height: 10, fills: solid(BLUE) }),
    }));
    const scene = exportScene(doc, ids.a, { contentsOnly: false });
    expect(scene.roots.map((n) => n.id)).toEqual([ids.a, ids.b]);
    // A page exports everything on it.
    const all = exportScene(doc, page, {});
    near(all.region, 0, 0, 510, 150);
  });

  it("refuses missing, hidden and empty layers with a plain reason", () => {
    const { doc, ids } = build((add, p) => ({
      hidden: add("RECTANGLE", p, { name: "Ghost", visible: false, fills: solid(RED) }),
      empty: add("GROUP", p, { name: "Nothing" }),
      clear: add("RECTANGLE", p, { name: "Clear", fills: solid(RED, false) }),
    }));
    expect(() => exportScene(doc, "nope", {})).toThrow(ExportError);
    expect(() => exportScene(doc, ids.hidden, {})).toThrow("“Ghost” is hidden, so there is nothing to export. Show the layer first.");
    expect(() => exportScene(doc, ids.empty, {})).toThrow("“Nothing” has nothing visible to export.");
    expect(() => exportScene(doc, ids.clear, {})).toThrow("has nothing visible");
  });
});
