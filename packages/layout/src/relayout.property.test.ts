/**
 * Seeded random trees and edits: after each edit, the incremental relayout
 * must reach the same layout as laying out everything from scratch, and
 * laying out again must change nothing.
 */

import type { Node, NodeId } from "@illigma/format";
import { describe, expect, it } from "vitest";
import { MemoryDoc } from "./fixture.js";
import { relayout } from "./relayout.js";

function prng(seed: number) {
  let t = seed >>> 0;
  const next = () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  const pick = <T>(xs: readonly T[]): T => xs[int(xs.length)] as T;
  return { next, int, pick };
}
type Rng = ReturnType<typeof prng>;

/** Random auto layout settings for a frame. */
function frameFields(r: Rng): Partial<Node> {
  return {
    layoutMode: r.pick(["HORIZONTAL", "VERTICAL", "VERTICAL", "HORIZONTAL", "NONE"] as const),
    itemSpacing: r.pick([0, 4, 8, -4]),
    paddingLeft: r.pick([0, 8]),
    paddingRight: r.pick([0, 12]),
    paddingTop: r.pick([0, 8]),
    paddingBottom: r.pick([0, 4]),
    primaryAxisAlignItems: r.pick(["MIN", "CENTER", "MAX", "SPACE_BETWEEN", "SPACE_AROUND", "SPACE_EVENLY"] as const),
    counterAxisAlignItems: r.pick(["MIN", "CENTER", "MAX"] as const),
    primaryAxisSizingMode: r.pick(["AUTO", "FIXED"] as const),
    counterAxisSizingMode: r.pick(["AUTO", "FIXED"] as const),
    layoutWrap: r.pick(["NO_WRAP", "NO_WRAP", "WRAP"] as const),
    counterAxisAlignContent: r.pick(["AUTO", "SPACE_BETWEEN"] as const),
    width: 50 + r.int(300),
    height: 50 + r.int(300),
  };
}

function childFields(r: Rng): Partial<Node> {
  const f: Partial<Node> = {};
  if (r.next() < 0.3) f.layoutSizingHorizontal = r.pick(["FIXED", "FILL", "HUG"] as const);
  if (r.next() < 0.3) f.layoutSizingVertical = r.pick(["FIXED", "FILL", "HUG"] as const);
  if (r.next() < 0.1) f.layoutPositioning = "ABSOLUTE";
  if (r.next() < 0.05) f.visible = false;
  if (r.next() < 0.1) f.minWidth = 30;
  if (r.next() < 0.1) f.maxHeight = 60;
  if (r.next() < 0.1) f.rotation = r.pick([90, 180, 30]);
  if (r.next() < 0.2) f.constraints = { horizontal: r.pick(["MIN", "MAX", "CENTER", "STRETCH", "SCALE"] as const), vertical: r.pick(["MIN", "MAX", "STRETCH"] as const) };
  return f;
}

function randomTree(r: Rng): { doc: MemoryDoc; ids: NodeId[] } {
  const doc = new MemoryDoc();
  const ids: NodeId[] = [];
  let next = 0;
  const grow = (parent: NodeId, depth: number) => {
    const count = 1 + r.int(depth > 2 ? 3 : 4);
    for (let i = 0; i < count; i++) {
      const id = `n${next++}`;
      ids.push(id);
      if (depth < 4 && r.next() < 0.5) {
        doc.add("FRAME", id, { ...frameFields(r), ...childFields(r) }, parent);
        grow(id, depth + 1);
      } else {
        doc.add("RECTANGLE", id, { width: 10 + r.int(80), height: 10 + r.int(60), ...childFields(r) }, parent);
      }
    }
  };
  doc.add("FRAME", "root", { x: 20, y: 20, ...frameFields(r), layoutMode: "VERTICAL" });
  ids.push("root");
  grow("root", 0);
  return { doc, ids };
}

/** A random edit to one node; returns its id. */
function edit(r: Rng, doc: MemoryDoc, ids: readonly NodeId[]): NodeId {
  const id = r.pick(ids);
  const n = doc.nodes.get(id) as Node;
  const changes: Partial<Node>[] = [
    { width: 10 + r.int(200) },
    { height: 10 + r.int(200) },
    { visible: !n.visible },
    { itemSpacing: r.pick([0, 6, -2, 20]) },
    { paddingLeft: r.pick([0, 5, 30]) },
    { primaryAxisAlignItems: r.pick(["MIN", "CENTER", "SPACE_BETWEEN"] as const) },
    { layoutSizingHorizontal: r.pick(["FIXED", "FILL", "HUG"] as const) },
    { layoutSizingVertical: r.pick(["FIXED", "FILL", "HUG"] as const) },
    { layoutMode: r.pick(["HORIZONTAL", "VERTICAL", "NONE"] as const) },
    { layoutPositioning: n.layoutPositioning === "ABSOLUTE" ? "AUTO" : "ABSOLUTE" },
    { maxWidth: r.pick([40, 120]) },
    { layoutWrap: n.layoutWrap === "WRAP" ? "NO_WRAP" : "WRAP" },
  ];
  doc.set(id, r.pick(changes));
  return id;
}

describe("incremental relayout", () => {
  it("matches a full layout after 2,000 random edits on 100 random trees", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const r = prng(seed);
      const { doc, ids } = randomTree(r);
      doc.apply(relayout(doc, ["root"], { deep: true }));
      expect(relayout(doc, ["root"], { deep: true }), `seed ${seed}: full layout is stable`).toEqual([]);
      for (let step = 0; step < 20; step++) {
        const id = edit(r, doc, ids);
        doc.apply(relayout(doc, [id]));
        expect(relayout(doc, ["root"], { deep: true }), `seed ${seed}, step ${step}: edited ${id}`).toEqual([]);
      }
    }
  });
});
