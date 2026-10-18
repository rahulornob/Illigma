// QC round 6: flattening has a tolerance and a point budget (big vectors no
// longer stall hover), and hit-testing covers square caps and miter joins.
import { describe, expect, it } from "vitest";
import { Document } from "@illigma/core";
import { PATH_CUBIC, PATH_MOVE, vectorNetworkFromSvgPath, type Node, type NodeId, type NodeType, type VectorNetwork } from "@illigma/format";
import { FLATTEN_TOLERANCE, flatten, MAX_FLAT_POINTS } from "./geometry.js";
import { hitTest } from "./hit-test.js";

type Fields = Partial<Omit<Node, "id" | "type" | "parentId" | "index">>;
const BLUE = [{ type: "SOLID" as const, visible: true, color: { r: 0, g: 0, b: 1, a: 1 } }];
/** Time budgets are tuned on a laptop. Shared CI runners are slower, so CI gets 3x (or PERF_BUDGET_SCALE). */
const budget = (ms: number) => ms * (Number(process.env.PERF_BUDGET_SCALE) || (process.env.CI ? 3 : 1));

function one(type: NodeType, fields: Fields) {
  const doc = new Document("Hit test");
  let page = "";
  let id: NodeId = "";
  doc.transact("Build", (tx) => {
    page = tx.addPage("Page");
    id = tx.create(type, page, fields);
  });
  return { hit: (x: number, y: number, tolerance = 0.5) => hitTest(doc, page, x, y, { tolerance }) === id };
}

const points = (f: ReturnType<typeof flatten>) => f.polys.reduce((n, p) => n + p.length / 2, 0);

describe("flatten", () => {
  it("stays within the tolerance of a quarter circle, with few points", () => {
    const k = 0.5522847498 * 100; // a quarter circle of radius 100 around the origin
    const flat = flatten([PATH_MOVE, 100, 0, PATH_CUBIC, 100, k, k, 100, 0, 100]);
    const p = flat.polys[0]!;
    expect(p.length / 2).toBeLessThan(40);
    for (let i = 0; i + 3 < p.length; i += 2) {
      // Each chord's midpoint is near the circle (the cubic itself is within 0.03 of it).
      const mx = (p[i]! + p[i + 2]!) / 2, my = (p[i + 1]! + p[i + 3]!) / 2;
      expect(Math.abs(Math.hypot(mx, my) - 100)).toBeLessThan(FLATTEN_TOLERANCE + 0.03);
    }
  });

  it("a 100,000-segment curve is capped and fast", () => {
    const cmds: number[] = [PATH_MOVE, 0, 0];
    for (let i = 0; i < 100_000; i++) cmds.push(PATH_CUBIC, i * 10 + 3, 400, i * 10 + 7, -400, i * 10 + 10, 0);
    const t0 = performance.now();
    const flat = flatten(cmds);
    const ms = performance.now() - t0;
    expect(points(flat)).toBeLessThanOrEqual(MAX_FLAT_POINTS + 1);
    expect(flatten(cmds)).toBe(flat); // cached
    expect(ms, `${ms.toFixed(0)} ms`).toBeLessThan(budget(150));
  });

  it("first hover over a 100,000-segment vector is quick", () => {
    const n = 99_999;
    const net: VectorNetwork = { vertices: [], segments: [], regions: [] };
    for (let i = 0; i <= n; i++) net.vertices.push({ x: (i % 1000) * 10, y: Math.floor(i / 1000) * 20 });
    for (let i = 0; i < n; i++) net.segments.push({ start: i, end: i + 1, tangentStart: { x: 3, y: 8 }, tangentEnd: { x: -3, y: 8 } });
    const { hit } = one("VECTOR", { width: 10_000, height: 2_000, strokes: BLUE, strokeWeight: 1, vectorNetwork: net });
    const t0 = performance.now();
    hit(5_000, 1_000);
    const ms = performance.now() - t0;
    expect(ms, `${ms.toFixed(0)} ms`).toBeLessThan(budget(250));
  });
});

describe("open subpaths fill as in SVG", () => {
  it("the open triangle of a path that also has a closed one is filled (and picked by its fill)", () => {
    const net = vectorNetworkFromSvgPath("M0 0 L90 0 L90 90 Z M110 110 L200 110 L200 200", { windingRule: "EVENODD" });
    const shape = one("VECTOR", { width: 200, height: 200, fills: BLUE, vectorNetwork: net });
    expect(shape.hit(80, 10)).toBe(true); // inside the closed triangle
    expect(shape.hit(190, 130)).toBe(true); // inside the open one, closed by the fill
    expect(shape.hit(120, 190)).toBe(false);
  });
});

describe("hit-testing strokes like they are drawn", () => {
  it("square caps reach half the weight past the ends", () => {
    const { hit } = one("LINE", { x: 0, y: 0, width: 100, height: 0, strokes: BLUE, strokeWeight: 20, strokeCap: "SQUARE" });
    expect(hit(109, 9.5)).toBe(true); // a corner of the cap: 13 from the end point, beyond a round reach
    expect(hit(-9, -9.5)).toBe(true);
    expect(hit(111, 0)).toBe(false); // past the cap (10 + 0.5)
    const butt = one("LINE", { x: 0, y: 0, width: 100, height: 0, strokes: BLUE, strokeWeight: 20 });
    expect(butt.hit(109, 9.5)).toBe(false);
  });

  it("miter joins reach out to the miter tip; bevel and round joins don't", () => {
    const d = "M10 10 L90 10 L90 90";
    const corner: Fields = { width: 100, height: 100, strokes: BLUE, strokeWeight: 20, vectorNetwork: vectorNetworkFromSvgPath(d) };
    const miter = one("VECTOR", { ...corner, strokeJoin: "MITER" });
    expect(miter.hit(99, 1)).toBe(true); // the corner's outer square: 12.7 from the corner point
    expect(miter.hit(100.4, 0)).toBe(true); // within the tolerance of the tip
    expect(miter.hit(101, -1)).toBe(false);
    expect(one("VECTOR", { ...corner, strokeJoin: "BEVEL" }).hit(99, 1)).toBe(false);
    expect(one("VECTOR", { ...corner, strokeJoin: "ROUND" }).hit(99, 1)).toBe(false);
    // Default join is miter, as drawn.
    expect(one("VECTOR", corner).hit(99, 1)).toBe(true);
  });

  it("joins sharper than the miter limit are bevelled, so their tip isn't hit", () => {
    // A 20° spike at (50, 10): its miter would reach 10 / sin(10°) ≈ 58 past the corner, beyond the limit of 4.
    const spike = one("VECTOR", { width: 100, height: 100, strokes: BLUE, strokeWeight: 20, vectorNetwork: vectorNetworkFromSvgPath("M32.4 100 L50 0 L67.6 100") });
    expect(spike.hit(50, -30)).toBe(false);
    expect(spike.hit(50, -9)).toBe(true); // the round reach of the corner itself
  });

  it("a closed star's points take miters too", () => {
    // A square outline: every corner is a 90° miter, the first point's included.
    const square = one("VECTOR", { width: 100, height: 100, strokes: BLUE, strokeWeight: 10, vectorNetwork: vectorNetworkFromSvgPath("M0 0 L100 0 L100 100 L0 100 Z") });
    expect(square.hit(-4.5, -4.5)).toBe(true);
    expect(square.hit(104.5, 104.5)).toBe(true);
  });
});
