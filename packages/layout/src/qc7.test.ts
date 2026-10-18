/**
 * QC round 7: `resizeMany` with a frame and layers inside it (through groups)
 * applies the frame's resize once, and vector networks scale without losing
 * detail or failing on huge coordinates.
 */

import type { Node, NodeId } from "@illigma/format";
import { describe, expect, it } from "vitest";
import { MemoryDoc } from "./fixture.js";
import { resize, resizeMany, scaleVectorNetwork, type ResizeEntry } from "./relayout.js";
import type { Box } from "./types.js";

const SCALE = { horizontal: "SCALE", vertical: "SCALE" } as const;

/** Frame F 100 × 100, group G at (10, 10) 20 × 20, rect R (0, 0) 20 × 20 in G with Scale. */
function nested() {
  const doc = new MemoryDoc();
  doc.add("FRAME", "F", { width: 100, height: 100 });
  doc.add("GROUP", "G", { x: 10, y: 10, width: 20, height: 20 }, "F");
  doc.add("RECTANGLE", "R", { width: 20, height: 20, constraints: SCALE }, "G");
  return doc;
}

const box = (doc: MemoryDoc, id: NodeId) => {
  const n = doc.nodes.get(id) as Node;
  return { x: n.x, y: n.y, width: n.width, height: n.height };
};

describe("resizeMany with a frame and layers in its groups", () => {
  it("a layer in a group gets its own box, not its own box scaled again", () => {
    const doc = nested().apply(resizeMany(nested(), [{ id: "F", box: { width: 200, height: 200 } }, { id: "R", box: { x: 0, y: 0, width: 40, height: 40 } }]));
    expect(box(doc, "R")).toEqual({ x: 0, y: 0, width: 40, height: 40 });
    expect(box(doc, "G")).toEqual({ x: 20, y: 20, width: 40, height: 40 });
  });

  it("a group with a box of its own lands there", () => {
    const doc = nested().apply(resizeMany(nested(), [{ id: "F", box: { width: 200, height: 200 } }, { id: "G", box: { x: 20, y: 20, width: 40, height: 40 } }]));
    expect(box(doc, "G")).toEqual({ x: 20, y: 20, width: 40, height: 40 });
    expect(box(doc, "R")).toEqual({ x: 0, y: 0, width: 40, height: 40 });
  });

  it("matches resizing one by one, parents first, for random batches over nested frames and groups", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const r = prng(seed);
      const { doc, ids } = randomTree(r);
      const picked = new Set<NodeId>();
      const count = 1 + r.int(4);
      for (let i = 0; i < count; i++) picked.add(r.pick(ids));
      const entries: ResizeEntry[] = [...picked].map((id) => ({ id, box: randomBox(r, doc.nodes.get(id) as Node) }));

      const batch = doc.clone().apply(resizeMany(doc, entries));
      const seq = doc.clone();
      // Parents first: a layer's own box is applied after its frame moved it.
      for (const e of [...entries].sort((a, b) => depth(doc, a.id) - depth(doc, b.id))) seq.apply(resize(seq, e.id, e.box));

      for (const id of ids) {
        const a = box(batch, id);
        const b = box(seq, id);
        for (const k of ["x", "y", "width", "height"] as const) {
          expect(Math.abs(a[k] - b[k]), `seed ${seed}: ${id}.${k} batch ${a[k]} vs one by one ${b[k]} (${JSON.stringify(entries)})`).toBeLessThan(1e-4);
        }
      }
    }
  });
});

describe("vector networks", () => {
  const net = (x: number) => ({
    vertices: [{ x: 0, y: 0 }, { x, y: 7.25 }],
    segments: [{ start: 0, end: 1, tangentStart: { x: x / 3, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
    regions: [],
  });

  it("scaling down a long way and back keeps the coordinates (no fixed decimals)", () => {
    const small = scaleVectorNetwork(net(123.456789), { width: 400, height: 10 }, { width: 0.01, height: 10 });
    expect(small).not.toBeNull();
    const back = scaleVectorNetwork(small!, { width: 0.01, height: 10 }, { width: 400, height: 10 });
    expect(back!.vertices[1]!.x).toBeCloseTo(123.456789, 9);
    expect(back!.segments[0]!.tangentStart.x).toBeCloseTo(123.456789 / 3, 9);
    // Float noise still goes: 0.1 × 3 is 0.3, not 0.30000000000000004.
    expect(scaleVectorNetwork(net(0.1), { width: 1, height: 1 }, { width: 3, height: 1 })!.vertices[1]!.x).toBe(0.3);
  });

  it("coordinates that would overflow keep the old network; the resize still happens", () => {
    const huge = net(1e305);
    expect(scaleVectorNetwork(huge, { width: 10, height: 10 }, { width: 100_000, height: 10 })).toBeNull();
    const doc = new MemoryDoc();
    doc.add("VECTOR", "v", { width: 10, height: 10, vectorNetwork: huge });
    const changes = resize(doc, "v", { width: 100_000 });
    expect(changes).toEqual([{ id: "v", key: "width", value: 100_000 }]);
  });
});

// ---- random trees: plain frames, groups and rectangles with constraints ----

function prng(seed: number) {
  let t = seed >>> 0;
  const next = () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  const pick = <T>(xs: readonly T[]): T => xs[int(xs.length)] as T;
  return { next, int, pick };
}
type Rng = ReturnType<typeof prng>;

const TYPES = ["MIN", "MAX", "CENTER", "STRETCH", "SCALE"] as const;

function randomTree(r: Rng): { doc: MemoryDoc; ids: NodeId[] } {
  const doc = new MemoryDoc();
  const ids: NodeId[] = [];
  let next = 0;
  const leaf = (parent: NodeId) => {
    const id = `n${next++}`;
    ids.push(id);
    doc.add("RECTANGLE", id, { x: r.int(60), y: r.int(60), width: 10 + r.int(40), height: 10 + r.int(40), constraints: { horizontal: r.pick(TYPES), vertical: r.pick(TYPES) } }, parent);
  };
  const grow = (parent: NodeId, depth: number) => {
    const count = 1 + r.int(3);
    for (let i = 0; i < count; i++) {
      const roll = depth < 3 ? r.next() : 1;
      const id = `n${next}`;
      if (roll < 0.3) {
        next++;
        ids.push(id);
        doc.add("FRAME", id, { x: r.int(40), y: r.int(40), width: 60 + r.int(100), height: 60 + r.int(100), constraints: { horizontal: r.pick(TYPES), vertical: r.pick(TYPES) } }, parent);
        grow(id, depth + 1);
      } else if (roll < 0.6) {
        next++;
        ids.push(id);
        // A group's box is the union of its layers', as the editor keeps it.
        doc.add("GROUP", id, { x: r.int(40), y: r.int(40) }, parent);
        grow(id, depth + 1);
        fit(doc, id);
      } else leaf(parent);
    }
  };
  doc.add("FRAME", "root", { x: 20, y: 20, width: 200, height: 200 });
  ids.push("root");
  grow("root", 0);
  return { doc, ids };
}

/** Fit group `id` around its layers (they move so the group's origin is the union's corner). */
function fit(doc: MemoryDoc, id: NodeId): void {
  const kids = doc.children(id);
  const x0 = Math.min(...kids.map((k) => k.x));
  const y0 = Math.min(...kids.map((k) => k.y));
  const x1 = Math.max(...kids.map((k) => k.x + k.width));
  const y1 = Math.max(...kids.map((k) => k.y + k.height));
  for (const k of kids) doc.set(k.id, { x: k.x - x0, y: k.y - y0 });
  const g = doc.nodes.get(id) as Node;
  doc.set(id, { x: g.x + x0, y: g.y + y0, width: x1 - x0, height: y1 - y0 });
}

/** A new box for `n`: some fields, sizes never smaller (so no constraint hits the minimum size). */
function randomBox(r: Rng, n: Node): Partial<Box> {
  const b: Partial<Box> = {};
  if (r.next() < 0.5) b.x = n.x + r.int(30) - 15;
  if (r.next() < 0.5) b.y = n.y + r.int(30) - 15;
  if (r.next() < 0.7) b.width = n.width + r.int(80);
  if (r.next() < 0.7) b.height = n.height + r.int(80);
  return b;
}

function depth(doc: MemoryDoc, id: NodeId): number {
  let d = 0;
  for (let n = doc.nodes.get(id); n?.parentId; n = doc.nodes.get(n.parentId)) d++;
  return d;
}
