/**
 * Outlines of the path-based node types (VECTOR, STAR, POLYGON, LINE) as
 * flat path commands, in the node's own space. Pure geometry with no
 * CanvasKit, so the renderer draws and hit-testing tests the same shapes.
 */

import type { ReadonlyNode } from "@illigma/core";
import {
  DEFAULT_POLYGON_POINTS,
  DEFAULT_STAR_INNER_RADIUS,
  DEFAULT_STAR_POINTS,
  PATH_CLOSE,
  PATH_CUBIC,
  PATH_LINE,
  PATH_MOVE,
  vectorNetworkPaths,
  type NodeType,
  type PathCommands,
  type VectorNetwork,
} from "@illigma/format";
import { arrowHeads, booleanOperands, isArrowCap, pathOps, roundPathCorners, type ChildSource } from "./shape-extras.js";

export interface FillPath {
  evenOdd: boolean;
  commands: readonly number[];
}

export interface ShapeGeometry {
  /** Filled areas, each with its own winding rule. */
  fills: readonly FillPath[];
  /** The stroked outline (empty when there is nothing to stroke). */
  stroke: readonly number[];
  /** Arrow-head triangles at stroke ends, filled with the stroke's paints. */
  capFill?: readonly number[];
}

/** Node types drawn from path geometry rather than as rectangles or ellipses. */
export const PATH_TYPES: ReadonlySet<NodeType> = new Set(["VECTOR", "STAR", "POLYGON", "LINE", "BOOLEAN_OPERATION"]);

const EMPTY: ShapeGeometry = Object.freeze({ fills: Object.freeze([]), stroke: Object.freeze([]) });

/** Networks are frozen document values, replaced on change, so geometry is cached per network. */
const vectorCache = new WeakMap<object, ShapeGeometry>();

/**
 * The outline of a path-based node, or `null` for the other types. A
 * BOOLEAN_OPERATION needs `src` (its children are its operands); without it
 * it has no outline.
 */
export function shapeGeometry(n: ReadonlyNode, src?: ChildSource): ShapeGeometry | null {
  const geo = baseGeometry(n, src);
  if (!geo || (n.type !== "LINE" && n.type !== "VECTOR")) return geo;
  return withArrows(n, geo);
}

const arrowCache = new WeakMap<ShapeGeometry, { weight: number; cap: string | undefined; net: unknown; geo: ShapeGeometry }>();

/** Adds arrow heads where the node's (or a point's) cap is an arrow. */
function withArrows(n: ReadonlyNode, geo: ShapeGeometry): ShapeGeometry {
  const net = n.type === "VECTOR" ? n.vectorNetwork : undefined;
  const pointCaps = !!net && net.vertices.some((v) => v.strokeCap !== undefined);
  if (!isArrowCap(n.strokeCap) && !pointCaps) return geo;
  const hit = arrowCache.get(geo);
  if (hit && hit.weight === n.strokeWeight && hit.cap === n.strokeCap && hit.net === net) return hit.geo;
  const capAt = (x: number, y: number) => {
    if (net) for (const v of net.vertices) if (v.strokeCap !== undefined && v.x === x && v.y === y) return v.strokeCap;
    return n.strokeCap;
  };
  const heads = arrowHeads(geo.stroke, n.strokeWeight, capAt);
  const out: ShapeGeometry = Object.freeze({
    fills: geo.fills,
    stroke: heads.stroke.length ? [...geo.stroke, ...heads.stroke] : geo.stroke,
    ...(heads.fill.length && { capFill: heads.fill }),
  });
  arrowCache.set(geo, { weight: n.strokeWeight, cap: n.strokeCap, net, geo: out });
  return out;
}

const LINE_CACHE = new WeakMap<ReadonlyNode, ShapeGeometry>();
const booleanCache = new WeakMap<ReadonlyNode, { deps: ReadonlyNode[]; geo: ShapeGeometry }>();

function subtreeOf(src: ChildSource, id: string, out: ReadonlyNode[]): ReadonlyNode[] {
  for (const k of src.children(id)) {
    out.push(k);
    subtreeOf(src, k.id, out);
  }
  return out;
}

/** A boolean's result, cached until it or anything under it changes (nodes are replaced on change). */
function booleanGeometry(n: ReadonlyNode, src: ChildSource): ShapeGeometry {
  const deps = subtreeOf(src, n.id, []);
  const hit = booleanCache.get(n);
  if (hit && hit.deps.length === deps.length && hit.deps.every((d, i) => d === deps[i])) return hit.geo;
  const operands = booleanOperands(src, n, (k, s) => shapeGeometry(k, s));
  const engine = pathOps();
  let geo: ShapeGeometry;
  const op = n.booleanOperation ?? "UNION";
  const result = engine && operands.length ? engine(op, operands) : null;
  if (result) geo = Object.freeze({ fills: Object.freeze([{ evenOdd: result.evenOdd, commands: result.commands }]), stroke: result.commands });
  else {
    // No engine (or nothing to combine): the operands as they are.
    const fills = operands.flat().map((f) => ({ evenOdd: f.evenOdd, commands: f.commands }));
    geo = Object.freeze({ fills, stroke: fills.flatMap((f) => f.commands as number[]) });
  }
  if (engine) booleanCache.set(n, { deps, geo });
  return geo;
}

function baseGeometry(n: ReadonlyNode, src?: ChildSource): ShapeGeometry | null {
  switch (n.type) {
    case "BOOLEAN_OPERATION":
      return src ? booleanGeometry(n, src) : EMPTY;
    case "LINE": {
      // Figma's line runs along its width, at y = 0; its height is 0. Cached so arrow heads cache too.
      let g = LINE_CACHE.get(n);
      if (!g) {
        g = Object.freeze({ fills: [], stroke: [PATH_MOVE, 0, 0, PATH_LINE, n.width, 0] });
        LINE_CACHE.set(n, g);
      }
      return g;
    }
    case "POLYGON":
    case "STAR": {
      const outline = starPoints(n);
      const commands = n.cornerRadius > 0 ? roundedPolygon(outline, n.cornerRadius) : polygon(outline);
      return { fills: [{ evenOdd: false, commands }], stroke: commands };
    }
    case "VECTOR": {
      const net = n.vectorNetwork;
      if (!net) return EMPTY;
      let geo = vectorCache.get(net);
      if (!geo) {
        geo = vectorGeometry(net as VectorNetwork);
        vectorCache.set(net, geo);
      }
      return geo;
    }
    default:
      return null;
  }
}

function vectorGeometry(net: VectorNetwork): ShapeGeometry {
  const paths = vectorNetworkPaths(net);
  let { regions, stroke } = paths;
  // Per-point corner radius rounds the corners between straight segments.
  if (net.vertices.some((v) => (v.cornerRadius ?? 0) > 0)) {
    const radii = new Map<string, number>();
    for (const v of net.vertices) if ((v.cornerRadius ?? 0) > 0) radii.set(`${v.x},${v.y}`, v.cornerRadius as number);
    const at = (x: number, y: number) => radii.get(`${x},${y}`) ?? 0;
    regions = regions.map((r) => ({ windingRule: r.windingRule, commands: roundPathCorners(r.commands, at) }));
    stroke = roundPathCorners(stroke, at);
  }
  // With no regions, fills cover each open or closed run as if closed, as in Figma and SVG.
  const fills: FillPath[] = regions.length
    ? regions.map((r) => ({ evenOdd: r.windingRule === "EVENODD", commands: r.commands }))
    : stroke.length
      ? [{ evenOdd: false, commands: stroke }]
      : [];
  return Object.freeze({ fills: Object.freeze(fills), stroke });
}

/**
 * Corner points of a polygon or star, as Figma places them: on the ellipse
 * inscribed in the node's box, the first at the top centre, going clockwise.
 * A star alternates outer points and inner points at `innerRadius`.
 */
export function starPoints(n: Pick<ReadonlyNode, "type" | "width" | "height" | "pointCount" | "innerRadius">): number[] {
  const star = n.type === "STAR";
  const count = n.pointCount ?? (star ? DEFAULT_STAR_POINTS : DEFAULT_POLYGON_POINTS);
  const inner = n.innerRadius ?? DEFAULT_STAR_INNER_RADIUS;
  const rx = n.width / 2;
  const ry = n.height / 2;
  const corners = star ? count * 2 : count;
  const out: number[] = [];
  for (let i = 0; i < corners; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / corners;
    const r = star && i % 2 ? inner : 1;
    out.push(rx + rx * r * Math.cos(a), ry + ry * r * Math.sin(a));
  }
  return out;
}

function polygon(pts: readonly number[]): PathCommands {
  const out: PathCommands = [];
  for (let i = 0; i < pts.length; i += 2) out.push(i ? PATH_LINE : PATH_MOVE, pts[i] as number, pts[i + 1] as number);
  out.push(PATH_CLOSE);
  return out;
}

/**
 * A closed polygon with every corner rounded by a circular arc of `radius`
 * (drawn as a cubic). A corner's rounding is limited to half of each edge
 * next to it, so neighbouring arcs never overlap.
 */
export function roundedPolygon(pts: readonly number[], radius: number): PathCommands {
  const n = pts.length / 2;
  if (n < 3) return polygon(pts);
  const out: PathCommands = [];
  for (let i = 0; i < n; i++) {
    const px = pts[2 * i] as number, py = pts[2 * i + 1] as number;
    const j = (i + n - 1) % n, k = (i + 1) % n;
    let ax = (pts[2 * j] as number) - px, ay = (pts[2 * j + 1] as number) - py;
    let bx = (pts[2 * k] as number) - px, by = (pts[2 * k + 1] as number) - py;
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    // The turn at this corner: θ is the inside angle between the two edges.
    const theta = la && lb ? Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)))) : Math.PI;
    if (!la || !lb || theta < 1e-6 || Math.PI - theta < 1e-6) {
      out.push(i ? PATH_LINE : PATH_MOVE, px, py);
      continue;
    }
    ax /= la; ay /= la; bx /= lb; by /= lb;
    const tanHalf = Math.tan(theta / 2);
    const t = Math.min(radius / tanHalf, la / 2, lb / 2); // distance from the corner to where the arc starts
    const r = t * tanHalf;
    const h = (4 / 3) * Math.tan((Math.PI - theta) / 4) * r; // Bézier handle length for that arc
    const sx = px + ax * t, sy = py + ay * t;
    const ex = px + bx * t, ey = py + by * t;
    out.push(i ? PATH_LINE : PATH_MOVE, sx, sy);
    out.push(PATH_CUBIC, sx - ax * h, sy - ay * h, ex - bx * h, ey - by * h, ex, ey);
  }
  out.push(PATH_CLOSE);
  return out;
}

// ---- flattening, for hit-testing ----

export interface Flattened {
  /** Polylines as x, y pairs. */
  polys: Float64Array[];
  /** Whether each polyline was closed (its last point joins its first). */
  closed: boolean[];
  /** x0, y0, x1, y1 of every point, control points included. */
  bounds: [number, number, number, number];
}

/**
 * How far (world units) a flattened curve may stray from the true curve.
 * Zoom-independent; it grows with very large paths (a 10,000th of their size)
 * so they don't explode into millions of points.
 */
export const FLATTEN_TOLERANCE = 0.05;
/** At most this many points per flattened path: a 100,000-segment network stays a few megabytes and a few milliseconds per hit test. */
export const MAX_FLAT_POINTS = 250_000;
/** At most this many straight pieces per cubic. */
const MAX_PIECES = 1024;

const flatCache = new WeakMap<readonly number[], Flattened>();

/**
 * Path commands as polylines; each cubic is split into as few straight
 * pieces as keep it within the tolerance (Wang's formula), and the whole path
 * into at most MAX_FLAT_POINTS points. Cached per commands array.
 */
export function flatten(commands: readonly number[]): Flattened {
  const cached = flatCache.get(commands);
  if (cached) return cached;
  const c = commands;

  // Pass 1: bounds, and each cubic's second-difference size (Wang's formula needs it).
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (x: number, y: number) => {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  };
  const curvature: number[] = [];
  let straight = 0; // points from moves and lines
  let px = 0, py = 0, sx = 0, sy = 0;
  for (let i = 0; i < c.length; ) {
    const verb = c[i++];
    if (verb === PATH_MOVE || verb === PATH_LINE) {
      px = c[i++] as number;
      py = c[i++] as number;
      if (verb === PATH_MOVE) [sx, sy] = [px, py];
      grow(px, py);
      straight++;
    } else if (verb === PATH_CUBIC) {
      const bx = c[i++] as number, by = c[i++] as number, cx = c[i++] as number, cy = c[i++] as number, dx = c[i++] as number, dy = c[i++] as number;
      grow(bx, by);
      grow(cx, cy);
      grow(dx, dy);
      curvature.push(Math.max(Math.hypot(px - 2 * bx + cx, py - 2 * by + cy), Math.hypot(bx - 2 * cx + dx, by - 2 * cy + dy)));
      px = dx;
      py = dy;
    } else if (verb === PATH_CLOSE) {
      [px, py] = [sx, sy];
    } else break;
  }
  const size = Number.isFinite(x1 - x0 + y1 - y0) ? Math.max(x1 - x0, y1 - y0) : 0;
  const tolerance = Math.max(FLATTEN_TOLERANCE, size / 10_000);
  const pieces = curvature.map((m) => Math.max(1, Math.min(MAX_PIECES, Math.ceil(Math.sqrt((0.75 * m) / tolerance)))));
  let curved = 0;
  for (const n of pieces) curved += n;
  // Over the point budget: share what is left after the corners among the curves (at least one piece each).
  if (straight + curved > MAX_FLAT_POINTS) {
    const scale = Math.max(0, MAX_FLAT_POINTS - straight) / curved;
    for (let k = 0; k < pieces.length; k++) pieces[k] = Math.max(1, Math.floor((pieces[k] as number) * scale));
  }

  // Pass 2: the polylines.
  const polys: Float64Array[] = [];
  const closed: boolean[] = [];
  let cur: number[] = [];
  const end = (isClosed: boolean) => {
    if (cur.length >= 2) {
      polys.push(Float64Array.from(cur));
      closed.push(isClosed);
    }
    cur = [];
  };
  const add = (x: number, y: number) => {
    cur.push(x, y);
    px = x;
    py = y;
  };
  let k = 0;
  for (let i = 0; i < c.length; ) {
    const verb = c[i++];
    if (verb === PATH_MOVE) {
      end(false);
      add(c[i++] as number, c[i++] as number);
    } else if (verb === PATH_LINE) {
      add(c[i++] as number, c[i++] as number);
    } else if (verb === PATH_CUBIC) {
      const ax = px, ay = py;
      const bx = c[i++] as number, by = c[i++] as number, cx = c[i++] as number, cy = c[i++] as number, dx = c[i++] as number, dy = c[i++] as number;
      const steps = pieces[k++] as number;
      for (let s = 1; s <= steps; s++) {
        const t = s / steps, u = 1 - t;
        const w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
        add(w0 * ax + w1 * bx + w2 * cx + w3 * dx, w0 * ay + w1 * by + w2 * cy + w3 * dy);
      }
    } else if (verb === PATH_CLOSE) {
      const startX = cur[0], startY = cur[1];
      end(true);
      if (startX !== undefined && startY !== undefined) {
        px = startX;
        py = startY;
      }
    } else break;
  }
  end(false);
  const flat: Flattened = { polys, closed, bounds: [x0, y0, x1, y1] };
  flatCache.set(commands, flat);
  return flat;
}

/** Whether (x, y) is inside the filled area of `flat`, every polyline taken as closed. */
export function insideFill(flat: Flattened, x: number, y: number, evenOdd: boolean): boolean {
  const [bx0, by0, bx1, by1] = flat.bounds;
  if (x < bx0 || x > bx1 || y < by0 || y > by1) return false;
  let winding = 0;
  let crossings = 0;
  for (const p of flat.polys) {
    const n = p.length;
    for (let i = 0; i < n; i += 2) {
      const ax = p[i] as number, ay = p[i + 1] as number;
      const j = i + 2 < n ? i + 2 : 0;
      const bx = p[j] as number, by = p[j + 1] as number;
      if (ay <= y) {
        if (by > y && (bx - ax) * (y - ay) - (x - ax) * (by - ay) > 0) {
          winding++;
          crossings++;
        }
      } else if (by <= y && (bx - ax) * (y - ay) - (x - ax) * (by - ay) < 0) {
        winding--;
        crossings++;
      }
    }
  }
  return evenOdd ? crossings % 2 === 1 : winding !== 0;
}

/** How a stroke ends and turns, for `nearStroke`. */
export interface StrokeShape {
  /** Half the stroke weight: how far caps and miters reach past the line. */
  half: number;
  /** Arrow caps reach like butt ends (their heads are tested on their own). */
  cap?: "NONE" | "ROUND" | "SQUARE" | "ARROW_LINES" | "ARROW_EQUILATERAL" | undefined;
  join?: "MITER" | "BEVEL" | "ROUND" | undefined;
}

/** Skia's default miter limit, which the renderer uses: sharper joins are drawn bevelled. */
export const MITER_LIMIT = 4;

/**
 * Whether (x, y) is within `reach` of any line of `flat`. With `stroke`, also
 * on the parts a stroke draws past its lines' round reach: square caps (half
 * the weight past each open end) and miter joins (out to the miter tip, up to
 * the miter limit), each with the same extra tolerance (`reach − stroke.half`).
 */
export function nearStroke(flat: Flattened, x: number, y: number, reach: number, stroke?: StrokeShape): boolean {
  const half = stroke ? Math.max(0, Math.min(stroke.half, reach)) : 0;
  const tol = reach - half;
  const square = half > 0 && stroke?.cap === "SQUARE";
  const miter = half > 0 && (stroke?.join ?? "MITER") === "MITER";
  // A square cap reaches √2 × half from its end point; a miter up to MITER_LIMIT × half from its corner.
  const far = miter ? half * MITER_LIMIT + tol : square ? half * Math.SQRT2 + tol : reach;
  const [bx0, by0, bx1, by1] = flat.bounds;
  if (x < bx0 - far || x > bx1 + far || y < by0 - far || y > by1 + far) return false;
  const r2 = reach * reach;
  for (let k = 0; k < flat.polys.length; k++) {
    const p = flat.polys[k] as Float64Array;
    const n = p.length;
    const isClosed = flat.closed[k] as boolean;
    const last = isClosed ? n : n - 2;
    for (let i = 0; i < last; i += 2) {
      const ax = p[i] as number, ay = p[i + 1] as number;
      const j = i + 2 < n ? i + 2 : 0;
      const dx = (p[j] as number) - ax, dy = (p[j + 1] as number) - ay;
      const l2 = dx * dx + dy * dy;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
      const ex = ax + t * dx - x, ey = ay + t * dy - y;
      if (ex * ex + ey * ey <= r2) return true;
    }
    if (n === 2) {
      const ex = (p[0] as number) - x, ey = (p[1] as number) - y;
      if (ex * ex + ey * ey <= r2) return true;
      continue;
    }
    if (square && !isClosed && (squareCap(p, 0, 2, x, y, half, tol) || squareCap(p, n - 2, n - 4, x, y, half, tol))) return true;
    if (miter) {
      const points = n / 2;
      // Corners: every inner point, and on a closed polyline its first point too.
      for (let v = isClosed ? 0 : 1; v < (isClosed ? points : points - 1); v++) {
        const prev = (v + points - 1) % points;
        const next = (v + 1) % points;
        if (miterJoin(p, prev * 2, v * 2, next * 2, x, y, half, tol)) return true;
      }
    }
  }
  return false;
}

/** On the square cap at point `at` of polyline `p` (its neighbour on the line at `from`)? */
function squareCap(p: Float64Array, at: number, from: number, x: number, y: number, half: number, tol: number): boolean {
  const ex = p[at] as number, ey = p[at + 1] as number;
  let dx = ex - (p[from] as number), dy = ey - (p[from + 1] as number);
  const len = Math.hypot(dx, dy);
  if (!len) return false;
  dx /= len;
  dy /= len;
  // In the cap's own axes: along the line past its end, and across it.
  const u = (x - ex) * dx + (y - ey) * dy;
  const v = -(x - ex) * dy + (y - ey) * dx;
  return u >= 0 && u <= half + tol && Math.abs(v) <= half + tol;
}

/** On the miter at corner `v` of polyline `p`, between the lines from `a` and to `b`? */
function miterJoin(p: Float64Array, a: number, v: number, b: number, x: number, y: number, half: number, tol: number): boolean {
  const vx = p[v] as number, vy = p[v + 1] as number;
  const qx = x - vx, qy = y - vy;
  if (qx * qx + qy * qy > (half * MITER_LIMIT + tol) ** 2) return false;
  let ix = vx - (p[a] as number), iy = vy - (p[a + 1] as number); // into the corner
  let ox = (p[b] as number) - vx, oy = (p[b + 1] as number) - vy; // out of it
  const li = Math.hypot(ix, iy), lo = Math.hypot(ox, oy);
  if (!li || !lo) return false;
  ix /= li;
  iy /= li;
  ox /= lo;
  oy /= lo;
  // The outer bisector, and sin of half the angle between the two lines.
  let mx = ix - ox, my = iy - oy;
  const ml = Math.hypot(mx, my);
  if (ml < 1e-9) return false; // straight on: no corner
  mx /= ml;
  my /= ml;
  const sinHalf = Math.hypot(ix + ox, iy + oy) / 2;
  if (1 / sinHalf > MITER_LIMIT) return false; // drawn bevelled: the round reach already covers it
  const tip = half / sinHalf;
  // The miter is the kite between the corner, the two outer edge offsets and the tip.
  const side = (nx: number, ny: number) => (nx * mx + ny * my >= 0 ? [nx, ny] : [-nx, -ny]) as [number, number];
  const [ax, ay] = side(-iy, ix);
  const [bx, by] = side(-oy, ox);
  const kite: [number, number][] = [
    [0, 0],
    [ax * half, ay * half],
    [mx * tip, my * tip],
    [bx * half, by * half],
  ];
  return insideConvex(kite, qx, qy) || nearPolygon(kite, qx, qy, tol);
}

/** Inside the convex polygon `pts` (either winding)? */
function insideConvex(pts: readonly [number, number][], x: number, y: number): boolean {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i] as [number, number];
    const [bx, by] = pts[(i + 1) % pts.length] as [number, number];
    const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (cross === 0) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** Within `reach` of an edge of polygon `pts`? */
function nearPolygon(pts: readonly [number, number][], x: number, y: number, reach: number): boolean {
  if (reach <= 0) return false;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i] as [number, number];
    const [bx, by] = pts[(i + 1) % pts.length] as [number, number];
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
    if ((ax + t * dx - x) ** 2 + (ay + t * dy - y) ** 2 <= reach * reach) return true;
  }
  return false;
}
