/**
 * Snapping and smart guides (interactions.md §4). Pure maths on upright page
 * rectangles: no document, no DOM. A drag builds a `SnapIndex` once from the
 * layers it can snap to, then asks it on every pointer move. Edges and
 * centres sit in sorted arrays, so a lookup is a binary search: 12,000
 * candidate layers cost microseconds per move.
 */
import type { Point, Rect } from "../geometry";

/** Snap distance on screen, in pixels (interactions.md §4: 4 px). */
export const SNAP_PX = 4;

/** One axis of the index: every candidate edge and centre, sorted, and the rectangle each came from. */
interface Axis {
  values: Float64Array;
  refs: Int32Array;
}

export interface SnapIndex {
  rects: readonly Rect[];
  x: Axis;
  y: Axis;
}

function axis(rects: readonly Rect[], pos: (r: Rect) => number, size: (r: Rect) => number): Axis {
  const items: [number, number][] = [];
  rects.forEach((r, i) => {
    const a = pos(r);
    const s = size(r);
    items.push([a, i], [a + s / 2, i], [a + s, i]);
  });
  items.sort((p, q) => p[0] - q[0]);
  return { values: Float64Array.from(items, (p) => p[0]), refs: Int32Array.from(items, (p) => p[1]) };
}

export function buildIndex(rects: readonly Rect[]): SnapIndex {
  return {
    rects,
    x: axis(rects, (r) => r.x, (r) => r.width),
    y: axis(rects, (r) => r.y, (r) => r.height),
  };
}

/** First position in `values` not below `v`. */
function lowerBound(values: Float64Array, v: number): number {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((values[mid] as number) < v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The candidate value nearest `v`, if it is within `threshold`. */
export function nearestValue(values: Float64Array, v: number, threshold: number): number | null {
  const i = lowerBound(values, v);
  let best: number | null = null;
  let bestD = threshold;
  for (const k of [i - 1, i]) {
    if (k < 0 || k >= values.length) continue;
    const d = Math.abs((values[k] as number) - v);
    if (d <= bestD) [best, bestD] = [values[k] as number, d];
  }
  return best;
}

/** A 1 px smart guide on the page: `axis` x is a vertical line at x = `at`, from `from` to `to` along y. */
export interface Guide {
  axis: "x" | "y";
  at: number;
  from: number;
  to: number;
}

/** A distance pill: a measured span on the page with its value. */
export interface Gap {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  value: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: Guide[];
  gaps: Gap[];
}

const EPS = 0.01;
/** At most this many layers draw guides for one matching edge (a column of 5,000 icons draws 1 line, not 5,000). */
const MAX_GUIDE_RECTS = 64;

const edges = (pos: number, size: number) => [pos, pos + size / 2, pos + size];

/**
 * The offset (from -threshold to threshold) that moves one of `edgeValues`
 * onto a candidate, the smallest one. Null when none is close enough.
 */
function bestOffset(ax: Axis, edgeValues: readonly number[], threshold: number): number | null {
  let best: number | null = null;
  for (const e of edgeValues) {
    const c = nearestValue(ax.values, e, threshold);
    if (c === null) continue;
    const off = c - e;
    if (best === null || Math.abs(off) < Math.abs(best)) best = off;
  }
  return best;
}

/** The rectangles with an edge or centre at `v` on this axis. */
function rectsAt(ax: Axis, v: number): number[] {
  const out: number[] = [];
  for (let i = lowerBound(ax.values, v - EPS); i < ax.values.length && (ax.values[i] as number) <= v + EPS; i++) {
    const r = ax.refs[i] as number;
    if (!out.includes(r)) out.push(r);
    if (out.length >= MAX_GUIDE_RECTS) break;
  }
  return out;
}

/** Guides for every edge and centre of `box` that lines up with a candidate. */
export function guidesFor(index: SnapIndex, box: Rect): Guide[] {
  const out: Guide[] = [];
  for (const [name, ax] of [["x", index.x], ["y", index.y]] as const) {
    const vs = name === "x" ? edges(box.x, box.width) : edges(box.y, box.height);
    for (const v of new Set(vs)) {
      const hits = rectsAt(ax, v);
      if (!hits.length) continue;
      let from = name === "x" ? box.y : box.x;
      let to = name === "x" ? box.y + box.height : box.x + box.width;
      for (const h of hits) {
        const r = index.rects[h] as Rect;
        from = Math.min(from, name === "x" ? r.y : r.x);
        to = Math.max(to, name === "x" ? r.y + r.height : r.x + r.width);
      }
      out.push({ axis: name, at: v, from, to });
    }
  }
  return out;
}

/** Overlap of [a1, a2] and [b1, b2], or null. */
const overlap = (a1: number, a2: number, b1: number, b2: number): [number, number] | null => {
  const lo = Math.max(a1, b1);
  const hi = Math.min(a2, b2);
  return hi >= lo ? [lo, hi] : null;
};

/**
 * Equal spacing along one axis ("x": a row): a box between two neighbours
 * centred in the gap, or a box placed one existing gap from its neighbour.
 * Returns the offset to apply to the box and the gap pills to show.
 */
function spacing(rects: readonly Rect[], box: Rect, dir: "x" | "y", threshold: number): { off: number; gaps: Gap[] } | null {
  const P = dir === "x" ? (r: Rect) => r.x : (r: Rect) => r.y;
  const S = dir === "x" ? (r: Rect) => r.width : (r: Rect) => r.height;
  const Q = dir === "x" ? (r: Rect) => r.y : (r: Rect) => r.x;
  const T = dir === "x" ? (r: Rect) => r.height : (r: Rect) => r.width;
  const row = rects.filter((r) => overlap(Q(r), Q(r) + T(r), Q(box), Q(box) + T(box)) && (P(r) + S(r) <= P(box) + threshold || P(r) >= P(box) + S(box) - threshold));
  if (!row.length) return null;
  const start = P(box);
  const end = start + S(box);
  // Neighbours: the nearest on each side.
  let before: Rect | null = null;
  let after: Rect | null = null;
  for (const r of row) {
    if (P(r) + S(r) <= start + threshold && P(r) + S(r) / 2 < start + S(box) / 2 && (!before || P(r) + S(r) > P(before) + S(before))) before = r;
    if (P(r) >= end - threshold && P(r) + S(r) / 2 > start + S(box) / 2 && (!after || P(r) < P(after))) after = r;
  }
  const pill = (a: number, b: number, rA: Rect, rB: Rect): Gap => {
    const o = overlap(Q(rA), Q(rA) + T(rA), Q(rB), Q(rB) + T(rB));
    const c = o ? (o[0] + o[1]) / 2 : (Q(rA) + T(rA) / 2 + Q(rB) + T(rB) / 2) / 2;
    return dir === "x" ? { x1: a, y1: c, x2: b, y2: c, value: b - a } : { x1: c, y1: a, x2: c, y2: b, value: b - a };
  };
  const options: { off: number; gaps: Gap[] }[] = [];
  if (before && after) {
    const target = (P(before) + S(before) + P(after) - S(box)) / 2;
    const off = target - start;
    if (Math.abs(off) <= threshold && target >= P(before) + S(before)) {
      const moved = shift(box, dir, off);
      options.push({ off, gaps: [pill(P(before) + S(before), P(moved), before, moved), pill(P(moved) + S(moved), P(after), moved, after)] });
    }
  }
  // One existing gap from a neighbour: the neighbour's own neighbour sets it.
  const sorted = [...row].sort((a, b) => P(a) - P(b));
  if (before) {
    const prev = sorted.filter((r) => P(r) + S(r) <= P(before as Rect) + 0.001 && r !== before).pop();
    if (prev) {
      const g = P(before) - (P(prev) + S(prev));
      const target = P(before) + S(before) + g;
      const off = target - start;
      if (g >= 0 && Math.abs(off) <= threshold) {
        const moved = shift(box, dir, off);
        options.push({ off, gaps: [pill(P(prev) + S(prev), P(before), prev, before), pill(P(before) + S(before), P(moved), before, moved)] });
      }
    }
  }
  if (after) {
    const next = sorted.find((r) => P(r) >= P(after as Rect) + S(after as Rect) - 0.001 && r !== after);
    if (next) {
      const g = P(next) - (P(after) + S(after));
      const target = P(after) - g - S(box);
      const off = target - start;
      if (g >= 0 && Math.abs(off) <= threshold) {
        const moved = shift(box, dir, off);
        options.push({ off, gaps: [pill(P(moved) + S(moved), P(after), moved, after), pill(P(after) + S(after), P(next), after, next)] });
      }
    }
  }
  options.sort((a, b) => Math.abs(a.off) - Math.abs(b.off));
  return options[0] ?? null;
}

const shift = (r: Rect, dir: "x" | "y", d: number): Rect => (dir === "x" ? { ...r, x: r.x + d } : { ...r, y: r.y + d });

/**
 * Snap a box being moved by (`dx`, `dy`) from `box`: its edges and centres
 * to the candidates' within `threshold` (page units), or to equal spacing;
 * with nothing in reach, its top-left to whole pixels (the pixel grid).
 * `enabled` false (Ctrl held): pixel grid only, no guides.
 */
export function snapMove(index: SnapIndex | null, box: Rect, dx: number, dy: number, threshold: number, enabled = true): SnapResult {
  const pixel = (pos: number, d: number) => Math.round(pos + d) - pos;
  if (!enabled || !index || !index.rects.length) return { dx: pixel(box.x, dx), dy: pixel(box.y, dy), guides: [], gaps: [] };
  const moved = { ...box, x: box.x + dx, y: box.y + dy };
  const ex = bestOffset(index.x, edges(moved.x, moved.width), threshold);
  const ey = bestOffset(index.y, edges(moved.y, moved.height), threshold);
  const sx = spacing(index.rects, moved, "x", threshold);
  const sy = spacing(index.rects, moved, "y", threshold);
  const gaps: Gap[] = [];
  let ox: number;
  if (ex !== null && (!sx || Math.abs(ex) <= Math.abs(sx.off))) ox = ex;
  else if (sx) {
    ox = sx.off;
    gaps.push(...sx.gaps);
  } else ox = pixel(moved.x, 0);
  let oy: number;
  if (ey !== null && (!sy || Math.abs(ey) <= Math.abs(sy.off))) oy = ey;
  else if (sy) {
    oy = sy.off;
    gaps.push(...sy.gaps);
  } else oy = pixel(moved.y, 0);
  const final = { ...box, x: moved.x + ox, y: moved.y + oy };
  // Gaps found before the other axis snapped: shift their cross position with it.
  const fixed = gaps.map((g) => (g.y1 === g.y2 ? { ...g, y1: g.y1 + oy, y2: g.y2 + oy } : { ...g, x1: g.x1 + ox, x2: g.x2 + ox }));
  return { dx: dx + ox, dy: dy + oy, guides: guidesFor(index, final), gaps: dedupeGaps(fixed) };
}

function dedupeGaps(gaps: Gap[]): Gap[] {
  const out: Gap[] = [];
  for (const g of gaps) if (!out.some((o) => Math.abs(o.x1 - g.x1) < EPS && Math.abs(o.y1 - g.y1) < EPS && Math.abs(o.x2 - g.x2) < EPS && Math.abs(o.y2 - g.y2) < EPS)) out.push(g);
  return out;
}

/** Snap one coordinate (a resized edge, a drawn corner) on an axis; whole pixels when nothing is in reach. */
export function snapCoordinate(index: SnapIndex | null, axisName: "x" | "y", v: number, threshold: number, enabled = true): number {
  if (enabled && index) {
    const c = nearestValue(index[axisName].values, v, threshold);
    if (c !== null) return c;
  }
  return Math.round(v);
}

/** A point snapped on both axes (drawing a shape), with its guides. */
export function snapPoint(index: SnapIndex | null, p: Point, threshold: number, enabled = true): { point: Point; guides: Guide[] } {
  const point = { x: snapCoordinate(index, "x", p.x, threshold, enabled), y: snapCoordinate(index, "y", p.y, threshold, enabled) };
  return { point, guides: enabled && index ? guidesFor(index, { ...point, width: 0, height: 0 }) : [] };
}
