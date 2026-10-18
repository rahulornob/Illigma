/**
 * Hit-testing in pure geometry: no GPU, no CanvasKit, so it runs in unit
 * tests and workers. It mirrors what the renderer draws: the same nesting,
 * transforms (x, y, then rotation about the node's top-left) and clipping.
 */

import type { ReadonlyNode } from "@illigma/core";
import type { NodeId, NodeType } from "@illigma/format";
import { flatten, insideFill, nearStroke, shapeGeometry, type ShapeGeometry } from "./geometry.js";

/** The part of `Document` hit-testing needs. */
export interface NodeSource {
  children(parentId: NodeId): readonly ReadonlyNode[];
}

/** Node types that clip their children. Must match the renderer. */
export const CLIPPING: ReadonlySet<NodeType> = new Set(["FRAME", "COMPONENT", "INSTANCE"]);

/** Types with no area of their own: they are hit only through their children. */
const NO_AREA: ReadonlySet<NodeType> = new Set(["GROUP", "PAGE"]);

export interface HitTestOptions {
  /** Return the deepest node under the point instead of its top-level ancestor. */
  deep?: boolean;
  /**
   * Extra reach, in world units, around strokes of lines and paths, so thin
   * ones can be picked. Pass a few screen pixels / zoom. Default 2.
   */
  tolerance?: number;
}

/** Default stroke reach for hit-testing, in world units. */
export const DEFAULT_HIT_TOLERANCE = 2;

/**
 * The topmost visible, unlocked node on `pageId` under the world point
 * (`x`, `y`). By default returns the page's direct child that contains the
 * hit, like a first click in Figma; with `deep` returns the deepest node.
 */
export function hitTest(doc: NodeSource, pageId: NodeId, x: number, y: number, options: HitTestOptions = {}): NodeId | null {
  const top = doc.children(pageId);
  // Later siblings draw on top, so test them first.
  const tolerance = Math.max(0, options.tolerance ?? DEFAULT_HIT_TOLERANCE);
  for (let i = top.length - 1; i >= 0; i--) {
    const n = top[i] as ReadonlyNode;
    const hit = hitNode(doc, n, x, y, tolerance);
    if (hit) return options.deep ? hit : n.id;
  }
  return null;
}

/** Deepest node hit in `n`'s subtree, with (`px`, `py`) in `n`'s parent space. */
function hitNode(doc: NodeSource, n: ReadonlyNode, px: number, py: number, tolerance: number): NodeId | null {
  // Hidden and locked layers can't be picked on the canvas, and neither can anything inside them.
  if (!n.visible || n.locked) return null;
  const [lx, ly] = toLocal(n, px, py);
  const inside = insideShape(n, lx, ly, tolerance);
  // A clipping frame hides everything outside its shape, children included (its own stroke may reach further).
  if (CLIPPING.has(n.type) && !(boxStrokeReach(n) > 0 ? insideBox(n, lx, ly, 0) : inside)) return inside ? n.id : null;
  const kids = doc.children(n.id);
  for (let i = kids.length - 1; i >= 0; i--) {
    const hit = hitNode(doc, kids[i] as ReadonlyNode, lx, ly, tolerance);
    if (hit) return hit;
  }
  return inside && !NO_AREA.has(n.type) ? n.id : null;
}

/** Parent space to `n`'s local space: undo the translate, then the rotation. */
export function toLocal(n: ReadonlyNode, px: number, py: number): [number, number] {
  const dx = px - n.x;
  const dy = py - n.y;
  if (!n.rotation) return [dx, dy];
  const t = (-n.rotation * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [dx * c - dy * s, dx * s + dy * c];
}

/**
 * Whether the local point is on `n`'s shape: inside a rectangle, rounded
 * rectangle, ellipse, polygon or star, or for lines and paths on their fill
 * or within half the stroke weight plus `tolerance` of their stroke. A
 * visible centred or outside stroke on a rectangle, ellipse or frame widens
 * it by how far the stroke reaches past the box.
 */
export function insideShape(n: ReadonlyNode, x: number, y: number, tolerance = DEFAULT_HIT_TOLERANCE): boolean {
  const geo = shapeGeometry(n);
  if (geo) return onGeometry(n, geo, x, y, tolerance);
  return insideBox(n, x, y, boxStrokeReach(n));
}

/** How far a box shape's visible stroke reaches past its box: half the weight centred, the whole weight outside, 0 inside. */
function boxStrokeReach(n: ReadonlyNode): number {
  if (n.type === "TEXT" || NO_AREA.has(n.type)) return 0;
  if (!(n.strokeWeight > 0) || !n.strokes.some((p) => p.visible)) return 0;
  const align = n.strokeAlign ?? "CENTER";
  return align === "CENTER" ? n.strokeWeight / 2 : align === "OUTSIDE" ? n.strokeWeight : 0;
}

/** Inside the (rounded) box or ellipse of `n`, grown by `grow` on every side. */
function insideBox(n: ReadonlyNode, x: number, y: number, grow: number): boolean {
  const w = n.width;
  const h = n.height;
  if (x < -grow || y < -grow || x > w + grow || y > h + grow) return false;
  if (n.type === "ELLIPSE") {
    if (w <= 0 || h <= 0) return grow > 0 && insideBoxCorners(x, y, w, h, 0, grow);
    // The stroke's outer edge, close enough: the ellipse with each semi-axis grown.
    const ex = (x - w / 2) / (w / 2 + grow);
    const ey = (y - h / 2) / (h / 2 + grow);
    return ex * ex + ey * ey <= 1;
  }
  // Text has no corners; its radius field is ignored when drawing too.
  const r = n.type === "TEXT" ? 0 : Math.min(n.cornerRadius, w / 2, h / 2);
  // A square corner's stroke stays square (miter); a rounded one grows round.
  if (r <= 0) return true;
  return insideBoxCorners(x, y, w, h, r, grow);
}

/** Inside a box with corner radius `r`, grown by `grow`: only the corner squares can miss. */
function insideBoxCorners(x: number, y: number, w: number, h: number, r: number, grow: number): boolean {
  const cx = x < r ? r : x > w - r ? w - r : x;
  const cy = y < r ? r : y > h - r ? h - r : y;
  const dx = x - cx;
  const dy = y - cy;
  const rr = r + grow;
  return dx * dx + dy * dy <= rr * rr;
}

/**
 * Paths, as Figma picks them: a vector by its filled regions when it has a
 * visible fill, and by its stroke when it has a visible stroke or no fill at
 * all; a polygon or star by its whole shape plus any stroke; a line by its stroke.
 */
function onGeometry(n: ReadonlyNode, geo: ShapeGeometry, x: number, y: number, tolerance: number): boolean {
  const hasFill = n.fills.some((p) => p.visible);
  const hasStroke = n.strokeWeight > 0 && n.strokes.some((p) => p.visible);
  const testFill = n.type === "VECTOR" ? hasFill : n.type !== "LINE";
  const testStroke = n.type === "LINE" || hasStroke || (n.type === "VECTOR" && !hasFill);
  if (testFill) {
    for (const f of geo.fills) if (insideFill(flatten(f.commands), x, y, f.evenOdd)) return true;
  }
  if (testStroke && geo.stroke.length) {
    const closed = n.type === "STAR" || n.type === "POLYGON" || (n.type === "VECTOR" && (n.vectorNetwork?.regions.length ?? 0) > 0);
    const align = closed && hasStroke ? (n.strokeAlign ?? "CENTER") : "CENTER";
    const weight = Math.max(0, n.strokeWeight);
    const flat = flatten(geo.stroke);
    // The outline itself is always within reach of `tolerance`, so thin strokes can be picked from either side.
    if (nearStroke(flat, x, y, tolerance)) return true;
    // A drawn stroke also reaches out with square caps and miter joins (lines have no joins).
    const join = n.type === "LINE" ? ("ROUND" as const) : n.strokeJoin;
    if (align === "CENTER") {
      const half = weight / 2;
      return nearStroke(flat, x, y, half + tolerance, hasStroke && half > 0 ? { half, cap: n.strokeCap, join } : undefined);
    }
    // Inside and outside strokes are drawn at double width and clipped to the outline (as the renderer does):
    // they reach the whole weight, on one side only.
    const insideOutline = geo.fills.some((f) => insideFill(flatten(f.commands), x, y, f.evenOdd));
    if (align === "INSIDE") return insideOutline && nearStroke(flat, x, y, weight + tolerance);
    return !insideOutline && nearStroke(flat, x, y, weight + tolerance, weight > 0 ? { half: weight, cap: n.strokeCap, join } : undefined);
  }
  return false;
}
