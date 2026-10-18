/**
 * QC round 6: `resizeMany` (one layout pass for many resized nodes), vector
 * networks scaling with their node, and rounded layout output.
 */

import { describe, expect, it } from "vitest";
import { MemoryDoc } from "./fixture.js";
import { roundLayout } from "./geometry.js";
import { relayout, resize, resizeMany, scaleVectorNetwork } from "./relayout.js";
import type { LayoutChange } from "./types.js";

/** Time budgets are tuned on a laptop. Shared CI runners are slower, so CI gets 3x (or PERF_BUDGET_SCALE). */
const budget = (ms: number) => ms * (Number(process.env.PERF_BUDGET_SCALE) || (process.env.CI ? 3 : 1));

/** No node and key is changed twice. */
function once(changes: readonly LayoutChange[]): readonly LayoutChange[] {
  const keys = changes.map((c) => `${c.id}.${c.key}`);
  expect(new Set(keys).size).toBe(keys.length);
  return changes;
}

describe("resizeMany", () => {
  /** A horizontal auto layout row of `n` 10 × 10 squares, gap 2. */
  function row(n: number) {
    const doc = new MemoryDoc();
    doc.add("FRAME", "row", { width: 0, height: 10, layoutMode: "HORIZONTAL", itemSpacing: 2 });
    for (let i = 0; i < n; i++) doc.add("RECTANGLE", `s${i}`, { width: 10, height: 10 }, "row");
    return doc;
  }

  it("matches resizing one by one, for siblings in a flow", () => {
    const a = row(5);
    const b = row(5);
    for (let i = 0; i < 5; i++) a.apply(resize(a, `s${i}`, { width: 10 + i }));
    b.apply(once(resizeMany(b, [0, 1, 2, 3, 4].map((i) => ({ id: `s${i}`, box: { width: 10 + i } })))));
    expect([...b.nodes.values()]).toEqual([...a.nodes.values()]);
    expect(b.nodes.get("row")?.width).toBe(10 + 11 + 12 + 13 + 14 + 4 * 2);
  });

  it("lays the shared frame out once: 5,000 siblings in milliseconds", () => {
    const doc = row(5000);
    const t0 = performance.now();
    const changes = resizeMany(doc, [...Array(5000).keys()].map((i) => ({ id: `s${i}`, box: { height: 20 } })));
    const ms = performance.now() - t0;
    doc.apply(changes);
    expect(doc.nodes.get("row")?.height).toBe(20);
    expect(ms, `${ms.toFixed(1)} ms`).toBeLessThan(budget(100));
  });

  it("constraints off for every resized node; a later entry for a node merges over an earlier one", () => {
    const doc = new MemoryDoc();
    doc.add("FRAME", "frame", { width: 400, height: 300 });
    doc.add("RECTANGLE", "button", { x: 280, y: 220, width: 100, height: 50, constraints: { horizontal: "MAX", vertical: "MAX" } }, "frame");
    const changes = resizeMany(doc, [{ id: "frame", box: { width: 500 } }, { id: "frame", box: { height: 200 } }], { constraints: false });
    expect(changes).toEqual([
      { id: "frame", key: "width", value: 500 },
      { id: "frame", key: "height", value: 200 },
    ]);
  });
});

describe("vector networks scale with their node", () => {
  const network = {
    vertices: [{ x: 0, y: 0 }, { x: 40, y: 0, cornerRadius: 3 }, { x: 40, y: 20 }],
    segments: [
      { start: 0, end: 1, tangentStart: { x: 10, y: 4 }, tangentEnd: { x: -10, y: 4 } },
      { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
      { start: 2, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
    ],
    regions: [{ windingRule: "EVENODD" as const, loops: [[0, 1, 2]] }],
  };

  it("a resize emits the scaled network (here through a Stretch constraint)", () => {
    const doc = new MemoryDoc();
    doc.add("FRAME", "frame", { width: 100, height: 100 });
    doc.add("VECTOR", "v", { width: 40, height: 20, vectorNetwork: structuredClone(network), constraints: { horizontal: "STRETCH", vertical: "MIN" } }, "frame");
    const changes = once(resize(doc, "frame", { width: 120 }));
    expect(changes).toContainEqual({ id: "v", key: "width", value: 60 });
    const net = changes.find((c) => c.key === "vectorNetwork")?.value as typeof network;
    expect(net.vertices).toEqual([{ x: 0, y: 0 }, { x: 60, y: 0, cornerRadius: 3 }, { x: 60, y: 20 }]);
    expect(net.segments[0]).toEqual({ start: 0, end: 1, tangentStart: { x: 15, y: 4 }, tangentEnd: { x: -15, y: 4 } });
    expect(net.regions).toEqual(network.regions);
    // Moving it (no size change) leaves the network alone.
    expect(resize(doc, "v", { x: 5 }).some((c) => c.key === "vectorNetwork")).toBe(false);
  });

  it("scaleVectorNetwork: an unchanged size is null; a zero-length axis keeps its coordinates", () => {
    expect(scaleVectorNetwork(network, { width: 40, height: 20 }, { width: 40, height: 20 })).toBeNull();
    const line = { vertices: [{ x: 0, y: 0 }, { x: 0, y: 10 }], segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }], regions: [] };
    expect(scaleVectorNetwork(line, { width: 0, height: 10 }, { width: 5, height: 30 })?.vertices).toEqual([{ x: 0, y: 0 }, { x: 0, y: 30 }]);
    expect(scaleVectorNetwork(line, { width: 0, height: 10 }, { width: 5, height: 10 })).toBeNull();
  });
});

describe("rounding", () => {
  it("computed positions and sizes carry no float noise; values layout keeps stay exact", () => {
    const doc = new MemoryDoc();
    doc.add("FRAME", "col", { width: 100, height: 0, layoutMode: "VERTICAL", itemSpacing: 0.1 });
    doc.add("RECTANGLE", "a", { width: 10, height: 0.1 }, "col");
    doc.add("RECTANGLE", "b", { width: 10, height: 0.2 }, "col");
    doc.add("RECTANGLE", "c", { width: 10.000000000000002, height: 1 }, "col");
    doc.apply(relayout(doc, ["col"]));
    expect(doc.nodes.get("b")?.y).toBe(0.2); // 0.1 + 0.1
    expect(doc.nodes.get("c")?.y).toBe(0.5); // 0.1 + 0.1 + 0.2 + 0.1 = 0.5000000000000001 unrounded
    expect(doc.nodes.get("c")?.width).toBe(10.000000000000002); // not computed: kept as stored
    expect(doc.nodes.get("col")?.height).toBe(1.5);
    expect(relayout(doc, ["col"])).toEqual([]);
  });

  it("roundLayout: a millionth, no -0, huge values kept", () => {
    expect(roundLayout(40.010000000000005)).toBe(40.01);
    expect(Object.is(roundLayout(-1e-9), 0)).toBe(true);
    expect(roundLayout(1e20)).toBe(1e20);
    expect(roundLayout(Infinity)).toBe(Infinity);
    for (const v of [0.1 + 0.2, 1 / 3, -7.0000004999, 123456.7890123]) expect(roundLayout(roundLayout(v))).toBe(roundLayout(v));
  });
});
