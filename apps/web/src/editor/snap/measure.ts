/**
 * ⌥ hover measurements (interactions.md §4): the distances between the
 * selection and another layer, or the parent's edges. Pure maths on upright
 * page rectangles.
 */
import type { Rect } from "../geometry";
import type { Gap } from "./snap";

const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;

const nonZero = (g: Gap) => Math.abs(g.value) > 0.001;

/** From each edge of `inner` out to the same edge of `outer`. */
function inside(inner: Rect, outer: Rect): Gap[] {
  const cy = inner.y + inner.height / 2;
  const cx = inner.x + inner.width / 2;
  return [
    { x1: outer.x, y1: cy, x2: inner.x, y2: cy, value: inner.x - outer.x },
    { x1: inner.x + inner.width, y1: cy, x2: outer.x + outer.width, y2: cy, value: outer.x + outer.width - inner.x - inner.width },
    { x1: cx, y1: outer.y, x2: cx, y2: inner.y, value: inner.y - outer.y },
    { x1: cx, y1: inner.y + inner.height, x2: cx, y2: outer.y + outer.height, value: outer.y + outer.height - inner.y - inner.height },
  ].filter(nonZero);
}

/** The distances between the selection `a` and the layer `b`, as spans to draw with their values. */
export function measureBetween(a: Rect, b: Rect): Gap[] {
  if (contains(b, a)) return inside(a, b);
  if (contains(a, b)) return inside(b, a);
  const out: Gap[] = [];
  const ay = a.y + a.height / 2;
  const ax = a.x + a.width / 2;
  // Across: the span between them, level with the middle of where they overlap (or of `a`).
  const oy1 = Math.max(a.y, b.y);
  const oy2 = Math.min(a.y + a.height, b.y + b.height);
  const y = oy2 >= oy1 ? (oy1 + oy2) / 2 : ay;
  if (a.x + a.width <= b.x) out.push({ x1: a.x + a.width, y1: y, x2: b.x, y2: y, value: b.x - a.x - a.width });
  else if (b.x + b.width <= a.x) out.push({ x1: b.x + b.width, y1: y, x2: a.x, y2: y, value: a.x - b.x - b.width });
  const ox1 = Math.max(a.x, b.x);
  const ox2 = Math.min(a.x + a.width, b.x + b.width);
  const x = ox2 >= ox1 ? (ox1 + ox2) / 2 : ax;
  if (a.y + a.height <= b.y) out.push({ x1: x, y1: a.y + a.height, x2: x, y2: b.y, value: b.y - a.y - a.height });
  else if (b.y + b.height <= a.y) out.push({ x1: x, y1: b.y + b.height, x2: x, y2: a.y, value: a.y - b.y - b.height });
  if (out.length) return out.filter(nonZero);
  // Overlapping without either holding the other: edge to matching edge.
  return [
    { x1: Math.min(a.x, b.x), y1: ay, x2: Math.max(a.x, b.x), y2: ay, value: Math.abs(a.x - b.x) },
    { x1: Math.min(a.x + a.width, b.x + b.width), y1: ay, x2: Math.max(a.x + a.width, b.x + b.width), y2: ay, value: Math.abs(a.x + a.width - b.x - b.width) },
    { x1: ax, y1: Math.min(a.y, b.y), x2: ax, y2: Math.max(a.y, b.y), value: Math.abs(a.y - b.y) },
    { x1: ax, y1: Math.min(a.y + a.height, b.y + b.height), x2: ax, y2: Math.max(a.y + a.height, b.y + b.height), value: Math.abs(a.y + a.height - b.y - b.height) },
  ].filter(nonZero);
}
