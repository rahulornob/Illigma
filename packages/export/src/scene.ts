/**
 * What an export covers: transforms, the bounds of what a layer draws, and
 * which layers to draw. Pure geometry, shared by every format, and mirroring
 * the renderer: x and y, then rotation about the top-left; FRAME, COMPONENT
 * and INSTANCE clip their children; hidden and fully transparent layers draw nothing.
 */

import type { ReadonlyNode } from "@illigma/core";
import type { NodeId } from "@illigma/format";
import { CLIPPING, flatten, shapeGeometry } from "@illigma/renderer";
import { ExportError, type ExportSettings } from "./settings.js";

/** The part of `Document` export reads. A `Document` is one. */
export interface ExportSource {
  get(id: NodeId): ReadonlyNode | undefined;
  children(parentId: NodeId): readonly ReadonlyNode[];
  /** Image files by `imageHash` (`Document.image`), for image paints. Without it, image paints are left out with a warning. */
  image?(hash: string): Uint8Array | undefined;
}

/** 2D affine transform, as in SVG: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Matrix = readonly [a: number, b: number, c: number, d: number, e: number, f: number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** Skia's default miter limit, which the renderer draws with: sharper corners are bevelled. */
export const MITER_LIMIT = 4;

export function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export function translation(x: number, y: number): Matrix {
  return [1, 0, 0, 1, x, y];
}

/** A node's own transform in its parent: translate by x, y, then rotate (degrees, clockwise) about its top-left. */
export function localMatrix(n: Pick<ReadonlyNode, "x" | "y" | "rotation">): Matrix {
  if (!n.rotation) return [1, 0, 0, 1, n.x, n.y];
  const t = (n.rotation * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [c, s, -s, c, n.x, n.y];
}

export function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** The transform from `n`'s parent's space to page space: every ancestor's own transform, up to the page. */
export function parentMatrix(source: ExportSource, n: ReadonlyNode): Matrix {
  const chain: ReadonlyNode[] = [];
  let parent = n.parentId === null ? undefined : source.get(n.parentId);
  // Bounded by depth; a cycle can't happen in a valid document, but stop anyway.
  for (let guard = 0; parent && parent.type !== "PAGE" && guard < 10_000; guard++) {
    chain.push(parent);
    parent = parent.parentId === null ? undefined : source.get(parent.parentId);
  }
  let m = IDENTITY;
  for (let i = chain.length - 1; i >= 0; i--) m = multiply(m, localMatrix(chain[i] as ReadonlyNode));
  return m;
}

/** The page a node is on (the node itself for a page), or null. */
export function pageOf(source: ExportSource, n: ReadonlyNode): ReadonlyNode | null {
  let cur: ReadonlyNode | undefined = n;
  for (let guard = 0; cur && guard < 10_000; guard++) {
    if (cur.type === "PAGE") return cur;
    cur = cur.parentId === null ? undefined : source.get(cur.parentId);
  }
  return null;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

class Box {
  x0 = Infinity;
  y0 = Infinity;
  x1 = -Infinity;
  y1 = -Infinity;
  add(x: number, y: number): void {
    if (x < this.x0) this.x0 = x;
    if (x > this.x1) this.x1 = x;
    if (y < this.y0) this.y0 = y;
    if (y > this.y1) this.y1 = y;
  }
  /** The four corners of a local rectangle under `m`. */
  addRect(m: Matrix, x0: number, y0: number, x1: number, y1: number): void {
    this.add(...apply(m, x0, y0));
    this.add(...apply(m, x1, y0));
    this.add(...apply(m, x1, y1));
    this.add(...apply(m, x0, y1));
  }
  addBox(b: Rect | null): void {
    if (!b) return;
    this.add(b.x, b.y);
    this.add(b.x + b.width, b.y + b.height);
  }
  rect(): Rect | null {
    return this.x0 <= this.x1 && this.y0 <= this.y1 ? { x: this.x0, y: this.y0, width: this.x1 - this.x0, height: this.y1 - this.y0 } : null;
  }
}

export function intersect(a: Rect, b: Rect): Rect | null {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.width, b.x + b.width);
  const y1 = Math.min(a.y + a.height, b.y + b.height);
  return x0 <= x1 && y0 <= y1 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
}

/** Whether a node draws at all (visible and not fully transparent). */
export function draws(n: ReadonlyNode): boolean {
  return n.visible && n.opacity > 0;
}

export const hasVisibleFill = (n: ReadonlyNode): boolean => n.fills.some((p) => p.visible);
export const hasVisibleStroke = (n: ReadonlyNode): boolean => n.strokeWeight > 0 && n.strokes.some((p) => p.visible);

/** The node's box (0, 0, width, height) under `m`, as an axis-aligned rectangle. */
export function boxBounds(n: ReadonlyNode, m: Matrix): Rect {
  const b = new Box();
  b.addRect(m, 0, 0, n.width, n.height);
  return b.rect() as Rect;
}

/**
 * The bounds of what `n` and its children draw, under `m` (the transform
 * from `n`'s own space), or null when it draws nothing. Strokes reach past
 * the outline by their alignment (mitred corners of paths can reach a little
 * further); drop shadows and layer blur count. Text counts as its box.
 */
export function subtreeBounds(source: ExportSource, n: ReadonlyNode, m: Matrix): Rect | null {
  const b = new Box();
  ownBounds(n, m, b);
  const kids = new Box();
  for (const child of source.children(n.id)) {
    if (draws(child)) kids.addBox(subtreeBounds(source, child, multiply(m, localMatrix(child))));
  }
  const kidRect = kids.rect();
  if (kidRect) b.addBox(CLIPPING.has(n.type) ? intersect(kidRect, boxBounds(n, m)) : kidRect);
  return withEffects(n, m, b.rect());
}

/**
 * `r` (what `n` draws, under `m`) grown by its drop shadows and layer blur,
 * as Figma's export bounds include them: each shadow is the shape moved by
 * its offset and grown by its spread and three blur deviations.
 */
function withEffects(n: ReadonlyNode, m: Matrix, r: Rect | null): Rect | null {
  if (!r || !n.effects?.length) return r;
  const scale = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
  const b = new Box();
  b.addBox(r);
  for (const e of n.effects) {
    if (!e.visible || e.type !== "DROP_SHADOW") continue;
    const dx = m[0] * e.offset.x + m[2] * e.offset.y;
    const dy = m[1] * e.offset.x + m[3] * e.offset.y;
    const pad = (1.5 * e.radius + Math.max(0, e.spread ?? 0)) * scale;
    b.addBox({ x: r.x + dx - pad, y: r.y + dy - pad, width: r.width + 2 * pad, height: r.height + 2 * pad });
  }
  const blur = Math.max(0, ...n.effects.filter((e) => e.visible && e.type === "LAYER_BLUR").map((e) => e.radius)) * 1.5 * scale;
  const out = b.rect() as Rect;
  return blur > 0 ? { x: out.x - blur, y: out.y - blur, width: out.width + 2 * blur, height: out.height + 2 * blur } : out;
}

/** How far a layer's strokes reach past its outline, as drawn: half the weight centred, all of it outside, none inside. */
function strokeReach(n: ReadonlyNode): number {
  const closed = n.type !== "LINE" && n.type !== "TEXT" && !(n.type === "VECTOR" && !(n.vectorNetwork?.regions.length ?? 0));
  const align = closed ? (n.strokeAlign ?? "CENTER") : "CENTER";
  return align === "CENTER" ? n.strokeWeight / 2 : align === "OUTSIDE" ? n.strokeWeight : 0;
}

/** The bounds of what `n` draws, in its parent's space under `parent`. */
export function renderBounds(source: ExportSource, n: ReadonlyNode, parent: Matrix): Rect | null {
  return draws(n) ? subtreeBounds(source, n, multiply(parent, localMatrix(n))) : null;
}

function ownBounds(n: ReadonlyNode, m: Matrix, b: Box): void {
  const fill = hasVisibleFill(n);
  const stroke = hasVisibleStroke(n);
  const half = stroke ? strokeReach(n) : 0;
  const geo = shapeGeometry(n);
  if (geo) {
    if (n.type === "LINE") {
      if (!stroke) return;
      // Butt ends stop at the endpoints; round and square ends reach half the weight past them.
      const cap = n.strokeCap === "ROUND" || n.strokeCap === "SQUARE" ? half : 0;
      b.addRect(m, -cap, -half, n.width + cap, half);
      return;
    }
    const pts = new Box();
    if (fill) for (const f of geo.fills) addPoints(pts, m, f.commands);
    if (stroke && geo.stroke.length) {
      const s = new Box();
      addPoints(s, m, geo.stroke);
      const r = s.rect();
      if (r) pts.addBox({ x: r.x - half, y: r.y - half, width: r.width + 2 * half, height: r.height + 2 * half });
      if (half > 0) addStrokeTips(pts, m, geo.stroke, half, n.strokeJoin ?? "MITER", n.strokeCap === "SQUARE");
    }
    b.addBox(pts.rect());
    return;
  }
  if (n.type === "GROUP" || n.type === "PAGE") return;
  if (n.type === "TEXT") {
    if (n.characters && n.fills.some((p) => p.visible)) b.addRect(m, 0, 0, n.width, n.height);
    return;
  }
  // Frames always cover their box (an empty frame exports at its size, as in Figma).
  if (!fill && !stroke && !CLIPPING.has(n.type)) return;
  if (n.type === "ELLIPSE") {
    // An ellipse's exact extent under rotation: half-axes u and v, then each axis is √(u² + v²).
    const [cx, cy] = apply(m, n.width / 2, n.height / 2);
    const rx = n.width / 2 + half;
    const ry = n.height / 2 + half;
    const ex = Math.hypot(m[0] * rx, m[2] * ry);
    const ey = Math.hypot(m[1] * rx, m[3] * ry);
    b.add(cx - ex, cy - ey);
    b.add(cx + ex, cy + ey);
    return;
  }
  b.addRect(m, -half, -half, n.width + half, n.height + half);
}

/**
 * Where a stroke reaching `reach` past its centre line goes beyond a box
 * around its points: miter tips (up to the miter limit; sharper corners are
 * drawn bevelled) and square caps' outer corners (√2 × reach from an open
 * end). Each point is added under `m`.
 */
function addStrokeTips(b: Box, m: Matrix, commands: readonly number[], reach: number, join: string, squareCaps: boolean): void {
  const miter = join === "MITER";
  if (!miter && !squareCaps) return;
  const flat = flatten(commands);
  flat.polys.forEach((poly, k) => {
    const closed = flat.closed[k] ?? false;
    // Drop repeated points (a closing point on the start, zero-length pieces): they have no direction.
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < poly.length; i += 2) {
      const x = poly[i] as number, y = poly[i + 1] as number;
      if (xs.length && Math.abs(x - (xs[xs.length - 1] as number)) < 1e-9 && Math.abs(y - (ys[ys.length - 1] as number)) < 1e-9) continue;
      xs.push(x);
      ys.push(y);
    }
    if (closed && xs.length > 1 && Math.abs((xs[0] as number) - (xs[xs.length - 1] as number)) < 1e-9 && Math.abs((ys[0] as number) - (ys[ys.length - 1] as number)) < 1e-9) {
      xs.pop();
      ys.pop();
    }
    const count = xs.length;
    if (count < 2) return;
    const dir = (from: number, to: number): [number, number] => {
      const dx = (xs[to] as number) - (xs[from] as number), dy = (ys[to] as number) - (ys[from] as number);
      const len = Math.hypot(dx, dy);
      return [dx / len, dy / len];
    };
    if (miter) {
      for (let i = closed ? 0 : 1; i < (closed ? count : count - 1); i++) {
        const [ax, ay] = dir((i - 1 + count) % count, i);
        const [bx, by] = dir(i, (i + 1) % count);
        // The miter's length over the stroke's half width is 1 / sin(θ / 2), θ the corner's inside angle.
        const sinHalf = Math.sqrt(Math.max(0, (1 + ax * bx + ay * by) / 2));
        if (sinHalf < 1 / MITER_LIMIT || sinHalf > 1 - 1e-9) continue; // bevelled, or no corner
        // The tip lies on the outer side of the turn, along the bisector.
        const ox = ax - bx, oy = ay - by;
        const ol = Math.hypot(ox, oy);
        const d = reach / sinHalf;
        b.add(...apply(m, (xs[i] as number) + (ox / ol) * d, (ys[i] as number) + (oy / ol) * d));
      }
    }
    if (squareCaps && !closed) {
      for (const [end, prev] of [[0, 1], [count - 1, count - 2]] as const) {
        const [dx, dy] = dir(prev, end);
        const ex = (xs[end] as number) + dx * reach, ey = (ys[end] as number) + dy * reach;
        b.add(...apply(m, ex - dy * reach, ey + dx * reach));
        b.add(...apply(m, ex + dy * reach, ey - dx * reach));
      }
    }
  });
}

/** Every point of a flattened outline under `m`. */
function addPoints(b: Box, m: Matrix, commands: readonly number[]): void {
  for (const poly of flatten(commands).polys) {
    for (let i = 0; i < poly.length; i += 2) b.add(...apply(m, poly[i] as number, poly[i + 1] as number));
  }
}

/** What one export draws: a region of the page and the layers in it. */
export interface ExportScene {
  node: ReadonlyNode;
  /** The exported area, in page space. */
  region: Rect;
  /** Layers to draw, each in its parent's space under `rootMatrix` (page space). */
  roots: readonly ReadonlyNode[];
  /** Parent space of `roots` to page space. */
  rootMatrix: Matrix;
}

/**
 * The area and layers an export covers. Throws `ExportError` for a missing,
 * hidden or empty layer.
 */
export function exportScene(source: ExportSource, nodeId: NodeId, settings: Pick<ExportSettings, "contentsOnly" | "useAbsoluteBounds">): ExportScene {
  const node = source.get(nodeId);
  if (!node) throw new ExportError(`There is no layer with id "${nodeId}" to export.`);
  const label = `“${node.name}”`;
  if (node.type === "PAGE") {
    // A page exports everything on it.
    const roots = source.children(node.id).filter(draws);
    const b = new Box();
    for (const r of roots) b.addBox(renderBounds(source, r, IDENTITY));
    const region = b.rect();
    if (!region) throw new ExportError(`The page ${label} has nothing visible to export.`);
    return { node, region, roots, rootMatrix: IDENTITY };
  }
  if (!draws(node)) throw new ExportError(`${label} is hidden, so there is nothing to export. Show the layer first.`);
  const parent = parentMatrix(source, node);
  const region = settings.useAbsoluteBounds ? boxBounds(node, multiply(parent, localMatrix(node))) : renderBounds(source, node, parent);
  if (!region) throw new ExportError(`${label} has nothing visible to export.`);
  if (settings.contentsOnly === false) {
    // Everything on the page that shows inside the region, as on the canvas.
    const page = pageOf(source, node);
    const roots = page
      ? source.children(page.id).filter((r) => {
          const rb = renderBounds(source, r, IDENTITY);
          return rb !== null && intersect(rb, region) !== null;
        })
      : [node];
    return { node, region, roots, rootMatrix: page ? IDENTITY : parent };
  }
  return { node, region, roots: [node], rootMatrix: parent };
}

/** Whether a subtree holds a TEXT layer that draws. */
export function hasText(source: ExportSource, roots: readonly ReadonlyNode[]): boolean {
  const stack = [...roots];
  while (stack.length) {
    const n = stack.pop() as ReadonlyNode;
    if (!draws(n)) continue;
    if (n.type === "TEXT" && n.characters) return true;
    stack.push(...source.children(n.id));
  }
  return false;
}
