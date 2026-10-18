import type { Document, ReadonlyNode } from "@illigma/core";
import type { NodeId } from "@illigma/format";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** A node's bounds in page (world) coordinates, ignoring rotation. Used to place newly drawn layers. */
export function absoluteRect(doc: Document, id: NodeId): Rect | null {
  const n = doc.get(id);
  if (!n || n.type === "PAGE") return null;
  let x = n.x;
  let y = n.y;
  let parent = n.parentId ? doc.get(n.parentId) : undefined;
  while (parent && parent.type !== "PAGE") {
    x += parent.x;
    y += parent.y;
    parent = parent.parentId ? doc.get(parent.parentId) : undefined;
  }
  return { x, y, width: n.width, height: n.height };
}

const contains = (r: Rect, x: number, y: number) => x >= r.x && y >= r.y && x <= r.x + r.width && y <= r.y + r.height;

/** The innermost visible frame under a world point: where a newly drawn layer goes. */
export function frameAt(doc: Document, pageId: NodeId, x: number, y: number): NodeId | null {
  let found: NodeId | null = null;
  const visit = (parentId: NodeId) => {
    const kids = doc.children(parentId);
    for (let i = kids.length - 1; i >= 0; i--) {
      const n = kids[i];
      if (!n || !n.visible || n.type !== "FRAME") continue;
      const r = absoluteRect(doc, n.id);
      if (r && contains(r, x, y)) {
        found = n.id;
        visit(n.id);
        return;
      }
    }
  };
  visit(pageId);
  return found;
}

// ---- placement on the page ----

/**
 * Where a coordinate space sits on the page: its origin in world coordinates
 * and its rotation in degrees. The renderer draws each node at (x, y) in its
 * parent's space, then rotates it about its own top-left; so do these.
 */
export interface Placement {
  x: number;
  y: number;
  rotation: number;
}

/** Rotate a vector by `deg` degrees, the way the renderer turns a rotated node (clockwise on screen). */
export function rotate(dx: number, dy: number, deg: number): Point {
  if (!deg) return { x: dx, y: dy };
  const t = (deg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}

/** The space a node's children live in (its own local space), on the page. The page itself is the identity. */
export function placementOf(doc: Document, id: NodeId): Placement {
  const chain: ReadonlyNode[] = [];
  for (let n = doc.get(id); n && n.type !== "PAGE"; n = n.parentId ? doc.get(n.parentId) : undefined) chain.push(n);
  let p: Placement = { x: 0, y: 0, rotation: 0 };
  for (let i = chain.length - 1; i >= 0; i--) {
    const n = chain[i] as ReadonlyNode;
    const o = rotate(n.x, n.y, p.rotation);
    p = { x: p.x + o.x, y: p.y + o.y, rotation: p.rotation + (n.rotation || 0) };
  }
  return p;
}

/** The space a node's x and y are measured in: its parent's. */
export function parentPlacement(doc: Document, id: NodeId): Placement {
  const parent = doc.get(id)?.parentId;
  return parent ? placementOf(doc, parent) : { x: 0, y: 0, rotation: 0 };
}

/** A world point in the space `p`. */
export function toSpace(p: Placement, wx: number, wy: number): Point {
  return rotate(wx - p.x, wy - p.y, -p.rotation);
}

/** A point in the space `p`, in world coordinates. */
export function fromSpace(p: Placement, x: number, y: number): Point {
  const o = rotate(x, y, p.rotation);
  return { x: p.x + o.x, y: p.y + o.y };
}

/** The four corners of a node on the page, clockwise from its own top-left. */
export function worldCorners(doc: Document, id: NodeId): Point[] {
  const n = doc.get(id);
  if (!n || n.type === "PAGE") return [];
  const p = placementOf(doc, id);
  return [
    [0, 0],
    [n.width, 0],
    [n.width, n.height],
    [0, n.height],
  ].map(([x, y]) => fromSpace(p, x as number, y as number));
}

/** The smallest upright rectangle around `points`. */
export function boundsOf(points: readonly Point[]): Rect | null {
  if (!points.length) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** A node's upright bounds on the page (rotation included). */
export function worldBounds(doc: Document, id: NodeId): Rect | null {
  return boundsOf(worldCorners(doc, id));
}

/** The smallest rectangle around all of `rects`. */
export function unionRects(rects: readonly Rect[]): Rect | null {
  return boundsOf(rects.flatMap((r) => [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y + r.height },
  ]));
}

/** The rectangle between two corner points, in any order. */
export function rectFromPoints(x1: number, y1: number, x2: number, y2: number): Rect {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
}

/** True if the rectangles overlap or touch. */
export function rectsTouch(a: Rect, b: Rect): boolean {
  return a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;
}

/** The ids whose rectangles the marquee touches, in the given order. */
export function marqueeHits(candidates: readonly { id: NodeId; rect: Rect }[], marquee: Rect): NodeId[] {
  return candidates.filter((c) => rectsTouch(c.rect, marquee)).map((c) => c.id);
}

// ---- moving ----

/** Shift while dragging: keep only the axis that moved further. */
export function constrainToAxis(dx: number, dy: number): Point {
  return Math.abs(dx) >= Math.abs(dy) ? { x: dx, y: 0 } : { x: 0, y: dy };
}

/** The arrow-key nudge, in world pixels: 1, or the big nudge with Shift. Null for other keys. */
export function nudgeFor(key: string, shift: boolean, big = 10): Point | null {
  const step = shift ? big : 1;
  switch (key) {
    case "ArrowLeft":
      return { x: -step, y: 0 };
    case "ArrowRight":
      return { x: step, y: 0 };
    case "ArrowUp":
      return { x: 0, y: -step };
    case "ArrowDown":
      return { x: 0, y: step };
    default:
      return null;
  }
}

// ---- resizing ----

export type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

/** Each handle's side on each axis: -1 left or top, 0 middle, 1 right or bottom. */
export const HANDLES: Readonly<Record<Handle, { hx: -1 | 0 | 1; hy: -1 | 0 | 1 }>> = {
  nw: { hx: -1, hy: -1 },
  n: { hx: 0, hy: -1 },
  ne: { hx: 1, hy: -1 },
  e: { hx: 1, hy: 0 },
  se: { hx: 1, hy: 1 },
  s: { hx: 0, hy: 1 },
  sw: { hx: -1, hy: 1 },
  w: { hx: -1, hy: 0 },
};

export interface ResizeModifiers {
  /** Shift: keep the aspect ratio. */
  keepRatio?: boolean;
  /** Alt/Option: resize from the centre. */
  fromCenter?: boolean;
}

/**
 * A resize as a scale about a fixed point: x' = px + (x - px) × sx, and the
 * same for y. A negative scale means the box was dragged past its opposite
 * edge and is flipped on that axis.
 */
export interface Scale {
  sx: number;
  sy: number;
  px: number;
  py: number;
}

/**
 * Dragging `handle` of `box` by (`dx`, `dy`), as a scale. The opposite edge
 * stays put (or the centre, with `fromCenter`). With `keepRatio`, both axes
 * follow the axis that changed more; an edge handle scales the other axis
 * about its centre, as in Figma.
 */
export function resizeScale(box: Rect, handle: Handle, dx: number, dy: number, mods: ResizeModifiers = {}): Scale {
  const { hx, hy } = HANDLES[handle];
  const axis = (h: -1 | 0 | 1, start: number, size: number, d: number) => {
    if (h === 0 || size === 0) return { s: 1, p: start + size / 2 };
    const edge = h === 1 ? start + size : start;
    const pivot = mods.fromCenter ? start + size / 2 : h === 1 ? start : start + size;
    return { s: (edge + d - pivot) / (edge - pivot), p: pivot };
  };
  const ax = axis(hx, box.x, box.width, dx);
  const ay = axis(hy, box.y, box.height, dy);
  let { s: sx } = ax;
  let { s: sy } = ay;
  if (mods.keepRatio) {
    if (hx === 0) sx = Math.abs(sy);
    else if (hy === 0) sy = Math.abs(sx);
    else {
      // The axis the pointer changed more (growing, shrinking or flipping) sets the size of both.
      const m = Math.abs(Math.abs(sx - 1) >= Math.abs(sy - 1) ? sx : sy);
      sx = (Math.sign(sx) || 1) * m;
      sy = (Math.sign(sy) || 1) * m;
    }
  }
  return { sx, sy, px: ax.p, py: ay.p };
}

/**
 * `r` after the scale `t`, upright again (a flip just swaps its edges).
 * Edges that moved snap to whole pixels, edges that stayed put don't move,
 * and an axis the scale changes is never thinner than `min` (it grows away
 * from the fixed edge). An axis the scale leaves alone, or one with no size
 * (a line's height), keeps its size, even below `min`.
 */
export function scaleRect(r: Rect, t: Scale, opts: { snap?: boolean; min?: number } = {}): Rect {
  const snap = opts.snap ?? true;
  const min = opts.min ?? 1;
  const axis = (start: number, size: number, s: number, p: number): [number, number] => {
    if (s === 1 || size === 0) return [start, size];
    const map = (v: number) => {
      const out = p + (v - p) * s;
      return snap && Math.abs(out - v) > 1e-9 ? Math.round(out) : out;
    };
    let a = map(start);
    let b = map(start + size);
    if (Math.abs(b - a) < min) {
      // Grow away from the edge that stays put; with no fixed edge, from the pivot outwards.
      const dir = Math.sign(s) || 1;
      if (Math.abs(a - start) < 1e-9) b = a + min * dir;
      else if (Math.abs(b - (start + size)) < 1e-9) a = b - min * dir;
      else {
        a = p - min / 2;
        b = p + min / 2;
      }
    }
    return [Math.min(a, b), Math.abs(b - a)];
  };
  const [x, width] = axis(r.x, r.width, t.sx, t.px);
  const [y, height] = axis(r.y, r.height, t.sy, t.py);
  return { x, y, width, height };
}

/** Map a point through the scale `t`. */
export function scalePoint(t: Scale, x: number, y: number): Point {
  return { x: t.px + (x - t.px) * t.sx, y: t.py + (y - t.py) * t.sy };
}

/**
 * The handle under a point given in the selection frame's own space, in
 * screen pixels (0, 0 is the frame's top-left; `w`, `h` its size on screen).
 * Corners win over edges; edges can be grabbed anywhere along their length.
 *
 * Outside the box an edge grabs `tolerance` pixels; inside, at most a quarter
 * of the box, so the middle of a small layer always moves it (as in Figma)
 * and its corners stay reachable from outside. An axis with no size (a line)
 * has no edges on it: grabbing the line moves it, its ends resize it.
 */
export function handleAt(lx: number, ly: number, w: number, h: number, tolerance = 6): Handle | null {
  if (lx < -tolerance || ly < -tolerance || lx > w + tolerance || ly > h + tolerance) return null;
  /** -1 near the start edge, 1 near the end edge, 0 neither. */
  const side = (v: number, size: number): -1 | 0 | 1 => {
    if (size <= 0) return 0;
    const inside = Math.min(tolerance, size / 4);
    if (v <= inside) return -1;
    if (v >= size - inside) return 1;
    return 0;
  };
  const hx = side(lx, w);
  const hy = side(ly, h);
  if (!hx && !hy) return null;
  return (Object.keys(HANDLES) as Handle[]).find((k) => HANDLES[k].hx === hx && HANDLES[k].hy === hy) ?? null;
}

/** Edge handles are hidden below this on-screen size, where they would cover the corners (Figma does the same). */
export const SMALL_SELECTION = 24;

/** The resize cursor for a handle on a frame turned by `rotation` degrees. */
export function handleCursor(handle: Handle, rotation = 0): string {
  const { hx, hy } = HANDLES[handle];
  const angle = (((Math.atan2(hy, hx) * 180) / Math.PI + rotation) % 180 + 180) % 180;
  const step = Math.round(angle / 45) % 4;
  return ["ew-resize", "nwse-resize", "ns-resize", "nesw-resize"][step] as string;
}
