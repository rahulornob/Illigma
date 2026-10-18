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

export interface FillPath {
  evenOdd: boolean;
  commands: readonly number[];
}

export interface ShapeGeometry {
  /** Filled areas, each with its own winding rule. */
  fills: readonly FillPath[];
  /** The stroked outline (empty when there is nothing to stroke). */
  stroke: readonly number[];
}

/** Node types drawn from path geometry rather than as rectangles or ellipses. */
export const PATH_TYPES: ReadonlySet<NodeType> = new Set(["VECTOR", "STAR", "POLYGON", "LINE"]);

const EMPTY: ShapeGeometry = Object.freeze({ fills: Object.freeze([]), stroke: Object.freeze([]) });

/** Networks are frozen document values, replaced on change, so geometry is cached per network. */
const vectorCache = new WeakMap<object, ShapeGeometry>();

/** The outline of a path-based node, or `null` for the other types. */
export function shapeGeometry(n: ReadonlyNode): ShapeGeometry | null {
  switch (n.type) {
    case "LINE":
      // Figma's line runs along its width, at y = 0; its height is 0.
      return { fills: [], stroke: [PATH_MOVE, 0, 0, PATH_LINE, n.width, 0] };
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
  const { regions, stroke } = vectorNetworkPaths(net);
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

const flatCache = new WeakMap<readonly number[], Flattened>();

/** Path commands as polylines; cubics are split into short straight pieces. */
export function flatten(commands: readonly number[]): Flattened {
  const cached = flatCache.get(commands);
  if (cached) return cached;
  const polys: Float64Array[] = [];
  const closed: boolean[] = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  let cur: number[] = [];
  let px = 0, py = 0;
  const end = (isClosed: boolean) => {
    if (cur.length >= 2) {
      polys.push(Float64Array.from(cur));
      closed.push(isClosed);
    }
    cur = [];
  };
  const add = (x: number, y: number) => {
    cur.push(x, y);
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
    px = x;
    py = y;
  };
  const c = commands;
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
      // Pieces by the control polygon's length: about one per 4 units, 2 to 64.
      const len = Math.hypot(bx - ax, by - ay) + Math.hypot(cx - bx, cy - by) + Math.hypot(dx - cx, dy - cy);
      const steps = Math.max(2, Math.min(64, Math.ceil(len / 4)));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps, u = 1 - t;
        const w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
        add(w0 * ax + w1 * bx + w2 * cx + w3 * dx, w0 * ay + w1 * by + w2 * cy + w3 * dy);
      }
    } else if (verb === PATH_CLOSE) {
      const sx = cur[0], sy = cur[1];
      end(true);
      if (sx !== undefined && sy !== undefined) {
        px = sx;
        py = sy;
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

/** Whether (x, y) is within `reach` of any line of `flat`. */
export function nearStroke(flat: Flattened, x: number, y: number, reach: number): boolean {
  const [bx0, by0, bx1, by1] = flat.bounds;
  if (x < bx0 - reach || x > bx1 + reach || y < by0 - reach || y > by1 + reach) return false;
  const r2 = reach * reach;
  for (let k = 0; k < flat.polys.length; k++) {
    const p = flat.polys[k] as Float64Array;
    const n = p.length;
    const last = flat.closed[k] ? n : n - 2;
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
    }
  }
  return false;
}
