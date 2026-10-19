/**
 * Geometry added with the vector editor: per-point corner radius, arrow
 * caps, and boolean operations. Pure TypeScript; the boolean maths itself
 * (Skia PathOps) is plugged in by `setPathOps`, since only CanvasKit has it.
 */

import type { ReadonlyNode } from "@illigma/core";
import { PATH_CLOSE, PATH_CUBIC, PATH_LINE, PATH_MOVE, type BooleanOperation, type NodeId, type PathCommands, type StrokeCap } from "@illigma/format";

export interface FillPathLike {
  evenOdd: boolean;
  commands: readonly number[];
}

// ---- per-point corner radius ----

/**
 * Rounds the corners of `commands` where `radiusAt(x, y)` gives a radius
 * above 0: only corners between two straight edges, each rounding limited to
 * half of each edge, as Figma does for polygons. Other commands pass through.
 */
export function roundPathCorners(commands: readonly number[], radiusAt: (x: number, y: number) => number): PathCommands {
  const out: PathCommands = [];
  // Split into subpaths, each a list of [verb, ...args] entries.
  type Entry = { verb: number; args: number[] };
  const subpaths: { entries: Entry[]; closed: boolean }[] = [];
  let cur: { entries: Entry[]; closed: boolean } | null = null;
  for (let i = 0; i < commands.length; ) {
    const verb = commands[i++] as number;
    const n = verb === PATH_MOVE || verb === PATH_LINE ? 2 : verb === PATH_CUBIC ? 6 : 0;
    const args = Array.from(commands.slice(i, i + n)) as number[];
    i += n;
    if (verb === PATH_MOVE) {
      cur = { entries: [{ verb, args }], closed: false };
      subpaths.push(cur);
    } else if (verb === PATH_CLOSE) {
      if (cur) cur.closed = true;
      cur = null;
    } else if (cur) cur.entries.push({ verb, args });
  }
  for (const sp of subpaths) {
    const pts = sp.entries.map((e) => [e.args[e.args.length - 2] as number, e.args[e.args.length - 1] as number] as const);
    let es = sp.entries;
    // A closed path whose last line returns to the start: drop that point (the close draws the edge).
    if (sp.closed && es.length > 2) {
      const a = pts[0] as readonly [number, number];
      const b = pts[pts.length - 1] as readonly [number, number];
      if (a[0] === b[0] && a[1] === b[1] && es[es.length - 1]?.verb === PATH_LINE) {
        es = es.slice(0, -1);
        pts.pop();
      }
    }
    const count = es.length;
    // Whether the edge arriving at point k is straight (for k = 0 on a closed path: the closing edge).
    const straightIn = (k: number) => (k === 0 ? sp.closed : es[k]?.verb === PATH_LINE);
    const straightOut = (k: number) => (k === count - 1 ? sp.closed : es[k + 1]?.verb === PATH_LINE);
    const corners: ({ sx: number; sy: number; c1x: number; c1y: number; c2x: number; c2y: number; ex: number; ey: number } | null)[] = [];
    for (let k = 0; k < count; k++) {
      const p = pts[k] as readonly [number, number];
      const r = radiusAt(p[0], p[1]);
      const hasPrev = k > 0 || sp.closed;
      const hasNext = k < count - 1 || sp.closed;
      if (!(r > 0) || !hasPrev || !hasNext || !straightIn(k) || !straightOut(k)) {
        corners.push(null);
        continue;
      }
      const a = pts[(k - 1 + count) % count] as readonly [number, number];
      const b = pts[(k + 1) % count] as readonly [number, number];
      let ax = a[0] - p[0], ay = a[1] - p[1], bx = b[0] - p[0], by = b[1] - p[1];
      const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
      const theta = la && lb ? Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)))) : Math.PI;
      if (!la || !lb || theta < 1e-6 || Math.PI - theta < 1e-6) {
        corners.push(null);
        continue;
      }
      ax /= la; ay /= la; bx /= lb; by /= lb;
      const tanHalf = Math.tan(theta / 2);
      const t = Math.min(r / tanHalf, la / 2, lb / 2);
      const rr = t * tanHalf;
      const h = (4 / 3) * Math.tan((Math.PI - theta) / 4) * rr;
      const sx = p[0] + ax * t, sy = p[1] + ay * t, ex = p[0] + bx * t, ey = p[1] + by * t;
      corners.push({ sx, sy, c1x: sx - ax * h, c1y: sy - ay * h, c2x: ex - bx * h, c2y: ey - by * h, ex, ey });
    }
    for (let k = 0; k < count; k++) {
      const e = es[k] as Entry;
      const c = corners[k];
      if (k === 0) {
        if (c) out.push(PATH_MOVE, c.sx, c.sy, PATH_CUBIC, c.c1x, c.c1y, c.c2x, c.c2y, c.ex, c.ey);
        else out.push(PATH_MOVE, ...e.args);
        continue;
      }
      if (c) out.push(PATH_LINE, c.sx, c.sy, PATH_CUBIC, c.c1x, c.c1y, c.c2x, c.c2y, c.ex, c.ey);
      else out.push(e.verb, ...e.args);
    }
    if (sp.closed) out.push(PATH_CLOSE);
  }
  return out;
}

// ---- arrow caps ----

/** True for the caps drawn as arrow heads. */
export const isArrowCap = (cap: StrokeCap | undefined): cap is "ARROW_LINES" | "ARROW_EQUILATERAL" => cap === "ARROW_LINES" || cap === "ARROW_EQUILATERAL";

/** The free ends of the open subpaths in `stroke`: the end point and the direction the stroke arrives in. */
export function openEnds(stroke: readonly number[]): { x: number; y: number; dx: number; dy: number; subpath: number; end: "start" | "end" }[] {
  const out: { x: number; y: number; dx: number; dy: number; subpath: number; end: "start" | "end" }[] = [];
  let pts: number[] = []; // x, y pairs, control points included, in order
  let sub = -1;
  const flush = (closed: boolean) => {
    if (pts.length >= 4 && !closed) {
      const n = pts.length / 2;
      const at = (i: number) => [pts[2 * i] as number, pts[2 * i + 1] as number] as const;
      const s = at(0);
      let j = 1;
      while (j < n - 1 && at(j)[0] === s[0] && at(j)[1] === s[1]) j++;
      const s2 = at(j);
      if (s2[0] !== s[0] || s2[1] !== s[1]) out.push({ x: s[0], y: s[1], dx: s[0] - s2[0], dy: s[1] - s2[1], subpath: sub, end: "start" });
      const e = at(n - 1);
      let k = n - 2;
      while (k > 0 && at(k)[0] === e[0] && at(k)[1] === e[1]) k--;
      const e2 = at(k);
      if (e2[0] !== e[0] || e2[1] !== e[1]) out.push({ x: e[0], y: e[1], dx: e[0] - e2[0], dy: e[1] - e2[1], subpath: sub, end: "end" });
    }
    pts = [];
  };
  for (let i = 0; i < stroke.length; ) {
    const verb = stroke[i++];
    if (verb === PATH_MOVE) {
      flush(false);
      sub++;
      pts.push(stroke[i++] as number, stroke[i++] as number);
    } else if (verb === PATH_LINE) pts.push(stroke[i++] as number, stroke[i++] as number);
    else if (verb === PATH_CUBIC) {
      for (let k = 0; k < 6; k++) pts.push(stroke[i++] as number);
    } else {
      flush(true);
    }
  }
  flush(false);
  return out;
}

/** Arrow head length for a stroke weight: Figma's heads grow with the stroke. */
export const arrowLength = (weight: number) => Math.max(6, weight * 4);

/**
 * Arrow heads for the open ends of `stroke` whose cap (from `capAt`) is an
 * arrow: open heads as extra stroke commands, triangles as fill commands
 * (drawn with the stroke's paints).
 */
export function arrowHeads(stroke: readonly number[], weight: number, capAt: (x: number, y: number, subpath: number, end: "start" | "end") => StrokeCap | undefined): { stroke: PathCommands; fill: PathCommands } {
  const lines: PathCommands = [];
  const fill: PathCommands = [];
  const len = arrowLength(weight);
  for (const e of openEnds(stroke)) {
    const cap = capAt(e.x, e.y, e.subpath, e.end);
    if (!isArrowCap(cap)) continue;
    const l = Math.hypot(e.dx, e.dy);
    if (!l) continue;
    const ux = e.dx / l, uy = e.dy / l; // pointing out of the stroke
    const px = -uy, py = ux;
    if (cap === "ARROW_LINES") {
      const back = len, side = len * Math.tan(Math.PI / 6) * 1.2;
      lines.push(PATH_MOVE, e.x - ux * back + px * side, e.y - uy * back + py * side, PATH_LINE, e.x, e.y, PATH_LINE, e.x - ux * back - px * side, e.y - uy * back - py * side);
    } else {
      // An equilateral triangle whose tip sits a little past the end, so the line's butt end hides under it.
      const side = len * 1.15;
      const h = (side * Math.sqrt(3)) / 2;
      const tipX = e.x + ux * weight * 0.5, tipY = e.y + uy * weight * 0.5;
      fill.push(PATH_MOVE, tipX, tipY, PATH_LINE, tipX - ux * h + (px * side) / 2, tipY - uy * h + (py * side) / 2, PATH_LINE, tipX - ux * h - (px * side) / 2, tipY - uy * h - (py * side) / 2, PATH_CLOSE);
    }
  }
  return { stroke: lines, fill };
}

// ---- transforms and primitive outlines ----

/** `commands` moved by (x, y) after turning `rotation` degrees about the origin (a node's own space to its parent's). */
export function transformCommands(commands: readonly number[], x: number, y: number, rotation: number): PathCommands {
  const t = (rotation * Math.PI) / 180;
  const c = Math.cos(t), s = Math.sin(t);
  const out: PathCommands = [];
  for (let i = 0; i < commands.length; ) {
    const verb = commands[i++] as number;
    out.push(verb);
    const n = verb === PATH_MOVE || verb === PATH_LINE ? 1 : verb === PATH_CUBIC ? 3 : 0;
    for (let k = 0; k < n; k++) {
      const px = commands[i++] as number, py = commands[i++] as number;
      out.push(x + px * c - py * s, y + px * s + py * c);
    }
  }
  return out;
}

const KAPPA = 0.5522847498;

/** An ellipse in the box (0, 0, w, h), four cubics clockwise from the top. */
export function ellipseCommands(w: number, h: number): PathCommands {
  const rx = w / 2, ry = h / 2, cx = rx, cy = ry, kx = rx * KAPPA, ky = ry * KAPPA;
  return [
    PATH_MOVE, cx, 0,
    PATH_CUBIC, cx + kx, 0, w, cy - ky, w, cy,
    PATH_CUBIC, w, cy + ky, cx + kx, h, cx, h,
    PATH_CUBIC, cx - kx, h, 0, cy + ky, 0, cy,
    PATH_CUBIC, 0, cy - ky, cx - kx, 0, cx, 0,
    PATH_CLOSE,
  ];
}

/** A box (0, 0, w, h), its corners rounded by `r` (clamped to half the shorter side). */
export function rectCommands(w: number, h: number, r: number): PathCommands {
  const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  if (!rr) return [PATH_MOVE, 0, 0, PATH_LINE, w, 0, PATH_LINE, w, h, PATH_LINE, 0, h, PATH_CLOSE];
  const k = rr * (1 - KAPPA);
  return [
    PATH_MOVE, rr, 0,
    PATH_LINE, w - rr, 0,
    PATH_CUBIC, w - k, 0, w, k, w, rr,
    PATH_LINE, w, h - rr,
    PATH_CUBIC, w, h - k, w - k, h, w - rr, h,
    PATH_LINE, rr, h,
    PATH_CUBIC, k, h, 0, h - k, 0, h - rr,
    PATH_LINE, 0, rr,
    PATH_CUBIC, 0, k, k, 0, rr, 0,
    PATH_CLOSE,
  ];
}

// ---- boolean operations ----

/**
 * The boolean maths: combine operands (each a list of fill paths, unioned
 * first) with `op`, bottom operand first. Returns one fill path.
 */
export type PathOpsEngine = (op: BooleanOperation, operands: readonly (readonly FillPathLike[])[]) => FillPathLike | null;

let engine: PathOpsEngine | null = null;

/** Plug in the boolean engine (the renderer does, from CanvasKit's PathOps). Without one, booleans draw their operands' union, unmerged. */
export function setPathOps(e: PathOpsEngine | null): void {
  engine = e;
}

export function pathOps(): PathOpsEngine | null {
  return engine;
}

/** The part of a document boolean geometry reads. */
export interface ChildSource {
  children(parentId: NodeId): readonly ReadonlyNode[];
}

/**
 * The outline of `n` used as a boolean operand, in its own space: its fill
 * shape (box, ellipse, path), a group's or boolean's combined children.
 * `geometryOf` is `shapeGeometry` (passed in to avoid an import cycle).
 */
export function operandOutline(src: ChildSource, n: ReadonlyNode, geometryOf: (n: ReadonlyNode, src: ChildSource) => { fills: readonly FillPathLike[] } | null): FillPathLike[] {
  if (n.type === "GROUP") {
    const out: FillPathLike[] = [];
    for (const k of src.children(n.id)) {
      if (!k.visible) continue;
      for (const f of operandOutline(src, k, geometryOf)) out.push({ evenOdd: f.evenOdd, commands: transformCommands(f.commands, k.x, k.y, k.rotation) });
    }
    return out;
  }
  const geo = geometryOf(n, src);
  if (geo) return geo.fills.map((f) => ({ evenOdd: f.evenOdd, commands: f.commands }));
  if (n.type === "ELLIPSE") return [{ evenOdd: false, commands: ellipseCommands(n.width, n.height) }];
  return [{ evenOdd: false, commands: rectCommands(n.width, n.height, n.type === "TEXT" ? 0 : n.cornerRadius) }];
}

/** The operands of boolean `n` in its own space, bottom first (visible children only). */
export function booleanOperands(src: ChildSource, n: ReadonlyNode, geometryOf: (n: ReadonlyNode, src: ChildSource) => { fills: readonly FillPathLike[] } | null): FillPathLike[][] {
  const out: FillPathLike[][] = [];
  for (const k of src.children(n.id)) {
    if (!k.visible) continue;
    out.push(operandOutline(src, k, geometryOf).map((f) => ({ evenOdd: f.evenOdd, commands: transformCommands(f.commands, k.x, k.y, k.rotation) })));
  }
  return out;
}
