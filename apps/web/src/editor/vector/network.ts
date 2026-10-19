/**
 * Vector network maths for the pen and vector edit mode: pure functions on
 * plain networks (no document), so they are unit-tested on their own. Every
 * function returns a new network and leaves its input untouched.
 */

import type { DeepReadonly, ReadonlyNode } from "@illigma/core";
import type { StrokeCap, Vector2, VectorNetwork, VectorRegion, VectorSegment, VectorVertex } from "@illigma/format";
import { starPoints } from "@illigma/renderer";

export interface Pt {
  x: number;
  y: number;
}

const ZERO: Vector2 = { x: 0, y: 0 };

/** A deep, mutable copy. */
export function cloneNetwork(net: DeepReadonly<VectorNetwork>): VectorNetwork {
  return {
    vertices: net.vertices.map((v) => ({ ...v })),
    segments: net.segments.map((s) => ({ start: s.start, end: s.end, tangentStart: { ...s.tangentStart }, tangentEnd: { ...s.tangentEnd } })),
    regions: net.regions.map((r) => ({ windingRule: r.windingRule, loops: r.loops.map((l) => [...l]) })),
  };
}

export const emptyNetwork = (): VectorNetwork => ({ vertices: [], segments: [], regions: [] });

// ---- pen ----

/** `p` constrained to the nearest 45° direction from `from` (Shift with the pen and line tools). */
export function snap45(from: Pt, p: Pt): Pt {
  const dx = p.x - from.x;
  const dy = p.y - from.y;
  const len = Math.hypot(dx, dy);
  if (!len) return { ...p };
  const step = Math.PI / 4;
  const a = Math.round(Math.atan2(dy, dx) / step) * step;
  // Project onto the snapped direction, so the point stays under the pointer along it.
  const d = dx * Math.cos(a) + dy * Math.sin(a);
  return { x: from.x + Math.cos(a) * d, y: from.y + Math.sin(a) * d };
}

/** One point placed by the pen: where it is, and its handles relative to it. */
export interface PenPoint {
  x: number;
  y: number;
  /** Handle towards the previous point. */
  in: Vector2;
  /** Handle towards the next point. */
  out: Vector2;
}

/**
 * Handles from dragging out of a pen point to `drag`: the outgoing handle
 * follows the pointer, the incoming one mirrors it (symmetric), unless
 * `broken` keeps the incoming one as `keepIn` (⌥ breaks symmetry).
 */
export function penHandles(p: Pt, drag: Pt, broken = false, keepIn: Vector2 = ZERO): { in: Vector2; out: Vector2 } {
  const out = { x: drag.x - p.x, y: drag.y - p.y };
  return { out, in: broken ? { ...keepIn } : { x: -out.x, y: -out.y } };
}

/** The network for pen points, closed (with a filled region) or open. */
export function penNetwork(points: readonly PenPoint[], closed: boolean): VectorNetwork {
  const vertices: VectorVertex[] = points.map((p) => ({ x: p.x, y: p.y }));
  const segments: VectorSegment[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i] as PenPoint;
    const b = points[i + 1] as PenPoint;
    segments.push({ start: i, end: i + 1, tangentStart: { ...a.out }, tangentEnd: { ...b.in } });
  }
  const regions: VectorRegion[] = [];
  if (closed && points.length >= 2) {
    const last = points[points.length - 1] as PenPoint;
    const first = points[0] as PenPoint;
    segments.push({ start: points.length - 1, end: 0, tangentStart: { ...last.out }, tangentEnd: { ...first.in } });
    if (points.length >= 2) regions.push({ windingRule: "NONZERO", loops: [segments.map((_, i) => i)] });
  }
  return { vertices, segments, regions };
}

// ---- bounds and fitting ----

/** Extremes of one cubic coordinate on (0, 1). */
function cubicExtrema(p0: number, p1: number, p2: number, p3: number): number[] {
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;
  const ts: number[] = [];
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) ts.push(-c / b);
  } else {
    const d = b * b - 4 * a * c;
    if (d >= 0) {
      const s = Math.sqrt(d);
      ts.push((-b + s) / (2 * a), (-b - s) / (2 * a));
    }
  }
  return ts.filter((t) => t > 0 && t < 1);
}

const bez = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};

/** The tight box of the drawn network (curves at their extremes, not their handles). */
export function networkBounds(net: VectorNetwork): { x: number; y: number; width: number; height: number } | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x: number, y: number) => {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  };
  for (const v of net.vertices) add(v.x, v.y);
  for (const s of net.segments) {
    const a = net.vertices[s.start] as VectorVertex;
    const b = net.vertices[s.end] as VectorVertex;
    const c1 = { x: a.x + s.tangentStart.x, y: a.y + s.tangentStart.y };
    const c2 = { x: b.x + s.tangentEnd.x, y: b.y + s.tangentEnd.y };
    for (const t of cubicExtrema(a.x, c1.x, c2.x, b.x)) add(bez(a.x, c1.x, c2.x, b.x, t), bez(a.y, c1.y, c2.y, b.y, t));
    for (const t of cubicExtrema(a.y, c1.y, c2.y, b.y)) add(bez(a.x, c1.x, c2.x, b.x, t), bez(a.y, c1.y, c2.y, b.y, t));
  }
  if (x0 > x1) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/**
 * The network moved so its box starts at (0, 0), and how far it moved: the
 * node's box then fits the network exactly (`dx`, `dy` go to the node's
 * position, turned by its rotation).
 */
export function fitNetwork(net: VectorNetwork): { net: VectorNetwork; dx: number; dy: number; width: number; height: number } {
  const b = networkBounds(net) ?? { x: 0, y: 0, width: 0, height: 0 };
  const out = cloneNetwork(net);
  for (const v of out.vertices) {
    v.x = round(v.x - b.x);
    v.y = round(v.y - b.y);
  }
  return { net: out, dx: b.x, dy: b.y, width: b.width, height: b.height };
}

/** Rounds away float noise (1e-6), so fitted coordinates read cleanly. */
const round = (v: number) => Math.round(v * 1e6) / 1e6;

/** Every point moved by (dx, dy) after turning `deg` degrees about the origin; handles turn too. */
export function transformNetwork(net: VectorNetwork, dx: number, dy: number, deg = 0): VectorNetwork {
  const out = cloneNetwork(net);
  const t = (deg * Math.PI) / 180;
  const c = Math.cos(t), s = Math.sin(t);
  const rot = (p: Vector2) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c });
  for (const v of out.vertices) {
    const r = rot(v);
    v.x = r.x + dx;
    v.y = r.y + dy;
  }
  for (const seg of out.segments) {
    seg.tangentStart = rot(seg.tangentStart);
    seg.tangentEnd = rot(seg.tangentEnd);
  }
  return out;
}

/** Several networks as one (vertices, segments and regions renumbered). */
export function mergeNetworks(nets: readonly VectorNetwork[]): VectorNetwork {
  const out = emptyNetwork();
  for (const n of nets) {
    const vo = out.vertices.length;
    const so = out.segments.length;
    out.vertices.push(...n.vertices.map((v) => ({ ...v })));
    out.segments.push(...n.segments.map((s) => ({ start: s.start + vo, end: s.end + vo, tangentStart: { ...s.tangentStart }, tangentEnd: { ...s.tangentEnd } })));
    out.regions.push(...n.regions.map((r) => ({ windingRule: r.windingRule, loops: r.loops.map((l) => l.map((i) => i + so)) })));
  }
  return out;
}

// ---- shapes as networks ----

const KAPPA = 0.5522847498;

/**
 * A shape's outline as a vector network in its own space, as Figma converts
 * shapes on their first vector edit: rectangles and polygons keep their
 * corner radius on each point; an ellipse becomes four curves.
 */
export function shapeNetwork(n: ReadonlyNode): VectorNetwork | null {
  const w = n.width, h = n.height;
  const closedPoly = (pts: Pt[], radius: number): VectorNetwork => {
    const vertices: VectorVertex[] = pts.map((p) => (radius > 0 ? { x: p.x, y: p.y, cornerRadius: radius } : { x: p.x, y: p.y }));
    const segments: VectorSegment[] = pts.map((_, i) => ({ start: i, end: (i + 1) % pts.length, tangentStart: { ...ZERO }, tangentEnd: { ...ZERO } }));
    return { vertices, segments, regions: [{ windingRule: "NONZERO", loops: [segments.map((_, i) => i)] }] };
  };
  switch (n.type) {
    case "VECTOR":
      return n.vectorNetwork ? cloneNetwork(n.vectorNetwork) : emptyNetwork();
    case "RECTANGLE":
    case "FRAME":
      return closedPoly(
        [
          { x: 0, y: 0 },
          { x: w, y: 0 },
          { x: w, y: h },
          { x: 0, y: h },
        ],
        n.cornerRadius,
      );
    case "POLYGON":
    case "STAR": {
      const flat = starPoints(n);
      const pts: Pt[] = [];
      for (let i = 0; i < flat.length; i += 2) pts.push({ x: flat[i] as number, y: flat[i + 1] as number });
      return closedPoly(pts, n.cornerRadius);
    }
    case "LINE":
      return { vertices: [{ x: 0, y: 0 }, { x: w, y: 0 }], segments: [{ start: 0, end: 1, tangentStart: { ...ZERO }, tangentEnd: { ...ZERO } }], regions: [] };
    case "ELLIPSE": {
      const rx = w / 2, ry = h / 2, kx = rx * KAPPA, ky = ry * KAPPA;
      const vertices: VectorVertex[] = [
        { x: rx, y: 0 },
        { x: w, y: ry },
        { x: rx, y: h },
        { x: 0, y: ry },
      ];
      const segments: VectorSegment[] = [
        { start: 0, end: 1, tangentStart: { x: kx, y: 0 }, tangentEnd: { x: 0, y: -ky } },
        { start: 1, end: 2, tangentStart: { x: 0, y: ky }, tangentEnd: { x: kx, y: 0 } },
        { start: 2, end: 3, tangentStart: { x: -kx, y: 0 }, tangentEnd: { x: 0, y: ky } },
        { start: 3, end: 0, tangentStart: { x: 0, y: -ky }, tangentEnd: { x: -kx, y: 0 } },
      ];
      return { vertices, segments, regions: [{ windingRule: "NONZERO", loops: [[0, 1, 2, 3]] }] };
    }
    default:
      return null;
  }
}

// ---- editing ----

/** The handles at vertex `v`: each incident segment's tangent at `v`. */
export function handlesAt(net: VectorNetwork, v: number): { segment: number; end: "start" | "end"; t: Vector2 }[] {
  const out: { segment: number; end: "start" | "end"; t: Vector2 }[] = [];
  net.segments.forEach((s, i) => {
    if (s.start === v) out.push({ segment: i, end: "start", t: s.tangentStart });
    if (s.end === v) out.push({ segment: i, end: "end", t: s.tangentEnd });
  });
  return out;
}

/** Points in `vs` moved by (dx, dy); their handles move with them. */
export function moveVertices(net: VectorNetwork, vs: Iterable<number>, dx: number, dy: number): VectorNetwork {
  const out = cloneNetwork(net);
  for (const v of vs) {
    const p = out.vertices[v];
    if (!p) continue;
    p.x += dx;
    p.y += dy;
  }
  return out;
}

const isZero = (t: Vector2) => t.x === 0 && t.y === 0;

/**
 * Sets the handle of `segment` at its `end` to `t`. With `mirror`, the
 * opposite handle at the same point (a point joining two segments) turns to
 * stay in line: "angle" keeps its length, "length" mirrors it exactly.
 */
export function setHandle(net: VectorNetwork, segment: number, end: "start" | "end", t: Vector2, mirror: "none" | "angle" | "length" = "none"): VectorNetwork {
  const out = cloneNetwork(net);
  const s = out.segments[segment];
  if (!s) return out;
  if (end === "start") s.tangentStart = { ...t };
  else s.tangentEnd = { ...t };
  if (mirror === "none") return out;
  const v = end === "start" ? s.start : s.end;
  const others = handlesAt(out, v).filter((h) => !(h.segment === segment && h.end === end));
  if (others.length !== 1) return out;
  const o = others[0] as (typeof others)[number];
  const len = Math.hypot(t.x, t.y);
  let next: Vector2;
  if (mirror === "length" || !len) next = { x: -t.x, y: -t.y };
  else {
    const ol = Math.hypot(o.t.x, o.t.y) || len;
    next = { x: (-t.x / len) * ol, y: (-t.y / len) * ol };
  }
  const os = out.segments[o.segment] as VectorSegment;
  if (o.end === "start") os.tangentStart = next;
  else os.tangentEnd = next;
  return out;
}

/** True when the two handles at `v` are in line (a smooth point), or it has fewer than two. */
export function isSmooth(net: VectorNetwork, v: number): boolean {
  const hs = handlesAt(net, v);
  if (hs.length !== 2) return false;
  const [a, b] = hs as [(typeof hs)[number], (typeof hs)[number]];
  if (isZero(a.t) || isZero(b.t)) return false;
  const cross = a.t.x * b.t.y - a.t.y * b.t.x;
  const dot = a.t.x * b.t.x + a.t.y * b.t.y;
  return Math.abs(cross) <= 1e-3 * Math.hypot(a.t.x, a.t.y) * Math.hypot(b.t.x, b.t.y) && dot < 0;
}

/**
 * Double-click on a point: a smooth point (or one with any handle) becomes a
 * corner (handles removed); a corner becomes smooth, its handles along the
 * line through its neighbours, a third of the way to each.
 */
export function toggleSmooth(net: VectorNetwork, v: number): VectorNetwork {
  const out = cloneNetwork(net);
  const hs = handlesAt(out, v);
  const p = out.vertices[v];
  if (!p) return out;
  const set = (h: (typeof hs)[number], t: Vector2) => {
    const s = out.segments[h.segment] as VectorSegment;
    if (h.end === "start") s.tangentStart = t;
    else s.tangentEnd = t;
  };
  if (hs.some((h) => !isZero(h.t))) {
    for (const h of hs) set(h, { x: 0, y: 0 });
    return out;
  }
  const other = (h: (typeof hs)[number]) => {
    const s = out.segments[h.segment] as VectorSegment;
    return out.vertices[h.end === "start" ? s.end : s.start] as VectorVertex;
  };
  if (hs.length === 2) {
    const [a, b] = hs as [(typeof hs)[number], (typeof hs)[number]];
    const pa = other(a), pb = other(b);
    let dx = pb.x - pa.x, dy = pb.y - pa.y;
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl;
    dy /= dl;
    const la = Math.hypot(pa.x - p.x, pa.y - p.y) / 3;
    const lb = Math.hypot(pb.x - p.x, pb.y - p.y) / 3;
    set(a, { x: -dx * la, y: -dy * la });
    set(b, { x: dx * lb, y: dy * lb });
  } else {
    for (const h of hs) {
      const o = other(h);
      set(h, { x: (o.x - p.x) / 3, y: (o.y - p.y) / 3 });
    }
  }
  return out;
}

/** Point on segment `si` at `t`, and the segment's two halves' control points (de Casteljau). */
function splitAt(net: VectorNetwork, si: number, t: number) {
  const s = net.segments[si] as VectorSegment;
  const a = net.vertices[s.start] as VectorVertex;
  const b = net.vertices[s.end] as VectorVertex;
  const p0 = { x: a.x, y: a.y };
  const p1 = { x: a.x + s.tangentStart.x, y: a.y + s.tangentStart.y };
  const p2 = { x: b.x + s.tangentEnd.x, y: b.y + s.tangentEnd.y };
  const p3 = { x: b.x, y: b.y };
  const lerp = (u: Pt, v: Pt) => ({ x: u.x + (v.x - u.x) * t, y: u.y + (v.y - u.y) * t });
  const q0 = lerp(p0, p1), q1 = lerp(p1, p2), q2 = lerp(p2, p3);
  const r0 = lerp(q0, q1), r1 = lerp(q1, q2);
  const m = lerp(r0, r1);
  return { s, p0, p3, q0, r0, m, r1, q2 };
}

/** The point on segment `si` at parameter `t`. */
export function pointOnSegment(net: VectorNetwork, si: number, t: number): Pt {
  return splitAt(net, si, t).m;
}

/**
 * Adds a point on segment `si` at `t` (a click on a segment in vector edit
 * mode). The curve keeps its shape. Returns the new network and the new
 * point's index.
 */
export function splitSegment(net: VectorNetwork, si: number, t: number): { net: VectorNetwork; vertex: number } {
  const out = cloneNetwork(net);
  const { s, p0, p3, q0, r0, m, r1, q2 } = splitAt(out, si, t);
  const straight = isZero(s.tangentStart) && isZero(s.tangentEnd);
  const vi = out.vertices.length;
  out.vertices.push({ x: m.x, y: m.y });
  const end = s.end;
  const ni = out.segments.length;
  const second: VectorSegment = straight
    ? { start: vi, end, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
    : { start: vi, end, tangentStart: { x: r1.x - m.x, y: r1.y - m.y }, tangentEnd: { x: q2.x - p3.x, y: q2.y - p3.y } };
  const first = out.segments[si] as VectorSegment;
  first.end = vi;
  if (!straight) {
    first.tangentStart = { x: q0.x - p0.x, y: q0.y - p0.y };
    first.tangentEnd = { x: r0.x - m.x, y: r0.y - m.y };
  }
  out.segments.push(second);
  // Loops through the old segment now pass through both halves, in walking order.
  for (const r of out.regions) {
    r.loops = r.loops.map((loop) => {
      const res: number[] = [];
      for (let k = 0; k < loop.length; k++) {
        const id = loop[k] as number;
        if (id !== si) {
          res.push(id);
          continue;
        }
        // Walking direction: does the loop reach this segment at its start vertex or its end?
        const prev = loop[(k - 1 + loop.length) % loop.length] as number;
        const ps = net.segments[prev] as VectorSegment;
        const forwards = loop.length === 1 || ps.start === s.start || ps.end === s.start ? true : false;
        if (forwards) res.push(si, ni);
        else res.push(ni, si);
      }
      return res;
    });
  }
  return { net: out, vertex: vi };
}

/** The closest segment to (x, y) within `reach`, and where on it (`t`). */
export function nearestSegment(net: VectorNetwork, x: number, y: number, reach: number): { segment: number; t: number; dist: number } | null {
  let best: { segment: number; t: number; dist: number } | null = null;
  const STEPS = 48;
  net.segments.forEach((s, si) => {
    const a = net.vertices[s.start] as VectorVertex;
    const b = net.vertices[s.end] as VectorVertex;
    const c1 = { x: a.x + s.tangentStart.x, y: a.y + s.tangentStart.y };
    const c2 = { x: b.x + s.tangentEnd.x, y: b.y + s.tangentEnd.y };
    let bt = 0, bd = Infinity;
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      const d = Math.hypot(bez(a.x, c1.x, c2.x, b.x, t) - x, bez(a.y, c1.y, c2.y, b.y, t) - y);
      if (d < bd) [bd, bt] = [d, t];
    }
    // Refine around the best sample.
    let lo = Math.max(0, bt - 1 / STEPS), hi = Math.min(1, bt + 1 / STEPS);
    for (let k = 0; k < 20; k++) {
      const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
      const d1 = Math.hypot(bez(a.x, c1.x, c2.x, b.x, m1) - x, bez(a.y, c1.y, c2.y, b.y, m1) - y);
      const d2 = Math.hypot(bez(a.x, c1.x, c2.x, b.x, m2) - x, bez(a.y, c1.y, c2.y, b.y, m2) - y);
      if (d1 < d2) hi = m2;
      else lo = m1;
    }
    const t = (lo + hi) / 2;
    const d = Math.hypot(bez(a.x, c1.x, c2.x, b.x, t) - x, bez(a.y, c1.y, c2.y, b.y, t) - y);
    if (d <= reach && (!best || d < best.dist)) best = { segment: si, t, dist: d };
  });
  return best;
}

/**
 * Bends segment `si` so it passes through `p` at parameter `t` (⌘-drag in
 * vector edit mode), changing both handles by the same amount.
 */
export function bendSegment(net: VectorNetwork, si: number, t: number, p: Pt): VectorNetwork {
  const out = cloneNetwork(net);
  const s = out.segments[si];
  if (!s) return out;
  const cur = pointOnSegment(out, si, t);
  const w = 3 * (1 - t) * t; // weight of both handles together at t
  if (w < 1e-3) return out;
  const dx = (p.x - cur.x) / w;
  const dy = (p.y - cur.y) / w;
  s.tangentStart = { x: s.tangentStart.x + dx, y: s.tangentStart.y + dy };
  s.tangentEnd = { x: s.tangentEnd.x + dx, y: s.tangentEnd.y + dy };
  return out;
}

/**
 * Deletes points `vs` and the segments touching them. With `heal` (⌘⌫), a
 * point joining exactly two segments is replaced by one segment between its
 * neighbours (keeping their outer handles), so the path stays joined.
 * Regions whose loops lose a segment are dropped, or re-joined when healed.
 * Unused points are removed.
 */
export function deleteVertices(net: VectorNetwork, vs: Iterable<number>, heal = false): VectorNetwork {
  let out = cloneNetwork(net);
  const gone = new Set(vs);
  if (heal) {
    for (const v of [...gone].sort((a, b) => b - a)) {
      const hs = handlesAt(out, v);
      if (hs.length !== 2) continue;
      const [a, b] = hs as [(typeof hs)[number], (typeof hs)[number]];
      if (a.segment === b.segment) continue;
      const sa = out.segments[a.segment] as VectorSegment;
      const sb = out.segments[b.segment] as VectorSegment;
      // Walk u → v → w: u is sa's other end, w is sb's other end.
      const u = a.end === "start" ? sa.end : sa.start;
      const uT = a.end === "start" ? sa.tangentEnd : sa.tangentStart;
      const w = b.end === "start" ? sb.end : sb.start;
      const wT = b.end === "start" ? sb.tangentEnd : sb.tangentStart;
      if (u === w) continue;
      out.segments[a.segment] = { start: u, end: w, tangentStart: { ...uT }, tangentEnd: { ...wT } };
      // sb is removed: loops drop it (they still close through the healed segment).
      out = removeSegments(out, new Set([b.segment]), true);
      gone.delete(v);
      out = removeVertices(out, new Set([v]));
      // Indices above v shifted down by one.
      const shifted = new Set<number>();
      for (const g of gone) shifted.add(g > v ? g - 1 : g);
      gone.clear();
      for (const g of shifted) gone.add(g);
    }
  }
  if (gone.size) {
    const segs = new Set<number>();
    out.segments.forEach((s, i) => {
      if (gone.has(s.start) || gone.has(s.end)) segs.add(i);
    });
    out = removeSegments(out, segs, false);
    out = removeVertices(out, gone);
  }
  return out;
}

/** Segments removed and renumbered. `keepLoops`: loops just drop them; otherwise a loop that loses one goes, and a region left with no loops too. */
export function removeSegments(net: VectorNetwork, segs: ReadonlySet<number>, keepLoops: boolean): VectorNetwork {
  if (!segs.size) return net;
  const map = new Map<number, number>();
  const segments: VectorSegment[] = [];
  net.segments.forEach((s, i) => {
    if (segs.has(i)) return;
    map.set(i, segments.length);
    segments.push(s);
  });
  const regions: VectorRegion[] = [];
  for (const r of net.regions) {
    const loops: number[][] = [];
    for (const l of r.loops) {
      if (!keepLoops && l.some((i) => segs.has(i))) continue;
      const nl = l.filter((i) => !segs.has(i)).map((i) => map.get(i) as number);
      if (nl.length) loops.push(nl);
    }
    if (loops.length) regions.push({ windingRule: r.windingRule, loops });
  }
  return { vertices: net.vertices, segments, regions };
}

/** Vertices removed and renumbered (segments must no longer use them), plus any left with no segment. */
function removeVertices(net: VectorNetwork, vs: ReadonlySet<number>): VectorNetwork {
  const used = new Set<number>();
  for (const s of net.segments) {
    used.add(s.start);
    used.add(s.end);
  }
  const map = new Map<number, number>();
  const vertices: VectorVertex[] = [];
  net.vertices.forEach((v, i) => {
    if (vs.has(i) || !used.has(i)) return;
    map.set(i, vertices.length);
    vertices.push(v);
  });
  const segments = net.segments.map((s) => ({ ...s, start: map.get(s.start) as number, end: map.get(s.end) as number }));
  return { vertices, segments, regions: net.regions };
}

/** Sets a point's corner radius (0 removes it). */
export function setCornerRadius(net: VectorNetwork, vs: Iterable<number>, radius: number): VectorNetwork {
  const out = cloneNetwork(net);
  for (const v of vs) {
    const p = out.vertices[v];
    if (!p) continue;
    if (radius > 0) p.cornerRadius = radius;
    else delete p.cornerRadius;
  }
  return out;
}

/** Sets a point's own stroke cap (undefined: the layer's). */
export function setVertexCap(net: VectorNetwork, v: number, cap: StrokeCap | undefined): VectorNetwork {
  const out = cloneNetwork(net);
  const p = out.vertices[v];
  if (p) {
    if (cap) p.strokeCap = cap;
    else delete p.strokeCap;
  }
  return out;
}

/** The vertices inside the box (marquee in vector edit mode). */
export function verticesIn(net: VectorNetwork, box: { x: number; y: number; width: number; height: number }): number[] {
  const out: number[] = [];
  net.vertices.forEach((v, i) => {
    if (v.x >= box.x && v.y >= box.y && v.x <= box.x + box.width && v.y <= box.y + box.height) out.push(i);
  });
  return out;
}
