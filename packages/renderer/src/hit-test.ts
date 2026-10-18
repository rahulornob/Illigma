/**
 * Hit-testing in pure geometry: no GPU, no CanvasKit, so it runs in unit
 * tests and workers. It mirrors what the renderer draws: the same nesting,
 * transforms (x, y, then rotation about the node's top-left) and clipping.
 */

import type { ReadonlyNode } from "@illigma/core";
import type { NodeId, NodeType } from "@illigma/format";

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
}

/**
 * The topmost visible, unlocked node on `pageId` under the world point
 * (`x`, `y`). By default returns the page's direct child that contains the
 * hit, like a first click in Figma; with `deep` returns the deepest node.
 */
export function hitTest(doc: NodeSource, pageId: NodeId, x: number, y: number, options: HitTestOptions = {}): NodeId | null {
  const top = doc.children(pageId);
  // Later siblings draw on top, so test them first.
  for (let i = top.length - 1; i >= 0; i--) {
    const n = top[i] as ReadonlyNode;
    const hit = hitNode(doc, n, x, y);
    if (hit) return options.deep ? hit : n.id;
  }
  return null;
}

/** Deepest node hit in `n`'s subtree, with (`px`, `py`) in `n`'s parent space. */
function hitNode(doc: NodeSource, n: ReadonlyNode, px: number, py: number): NodeId | null {
  // Hidden and locked layers can't be picked on the canvas, and neither can anything inside them.
  if (!n.visible || n.locked) return null;
  const [lx, ly] = toLocal(n, px, py);
  const inside = insideShape(n, lx, ly);
  // A clipping frame hides everything outside its shape, children included.
  if (CLIPPING.has(n.type) && !inside) return null;
  const kids = doc.children(n.id);
  for (let i = kids.length - 1; i >= 0; i--) {
    const hit = hitNode(doc, kids[i] as ReadonlyNode, lx, ly);
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

/** Whether the local point is inside `n`'s fill shape: rectangle, rounded rectangle or ellipse. */
export function insideShape(n: ReadonlyNode, x: number, y: number): boolean {
  const w = n.width;
  const h = n.height;
  if (x < 0 || y < 0 || x > w || y > h) return false;
  if (n.type === "ELLIPSE") {
    if (w <= 0 || h <= 0) return false;
    const ex = (x - w / 2) / (w / 2);
    const ey = (y - h / 2) / (h / 2);
    return ex * ex + ey * ey <= 1;
  }
  // Text has no corners; its radius field is ignored when drawing too.
  const r = n.type === "TEXT" ? 0 : Math.min(n.cornerRadius, w / 2, h / 2);
  if (r <= 0) return true;
  // Only the four corner squares can miss: test against the corner's circle.
  const cx = x < r ? r : x > w - r ? w - r : x;
  const cy = y < r ? r : y > h - r ? h - r : y;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}
