import type { Document, Operation, ReadonlyNode, Transaction } from "@illigma/core";
import type { NodeId } from "@illigma/format";
import {
  fromSpace,
  parentPlacement,
  placementOf,
  resizeScale,
  rotate,
  scalePoint,
  scaleRect,
  toSpace,
  unionRects,
  worldBounds,
  type Handle,
  type Placement,
  type Point,
  type Rect,
  type ResizeModifiers,
} from "./geometry";

/** Top-level containers: a duplicate of one goes to its right, as in Figma. */
const CONTAINERS = new Set(["FRAME", "SECTION", "COMPONENT"]);
/** Space between a top-level frame and its duplicate. */
const DUPLICATE_GAP = 40;

/** True if `id` or any of its ancestors is locked. */
export function isLocked(doc: Document, id: NodeId): boolean {
  for (let n = doc.get(id); n && n.type !== "PAGE"; n = n.parentId ? doc.get(n.parentId) : undefined) if (n.locked) return true;
  return false;
}

/** True if an ancestor of `id` is in `ids`. */
function underAnother(doc: Document, id: NodeId, ids: ReadonlySet<NodeId>): boolean {
  for (let p = doc.get(id)?.parentId; p; p = doc.get(p)?.parentId) if (ids.has(p)) return true;
  return false;
}

/** The selected layers an edit applies to once: layers inside another selected layer come along with it. */
export function topmost(doc: Document, ids: readonly NodeId[]): NodeId[] {
  const set = new Set(ids);
  return ids.filter((id) => doc.has(id) && doc.get(id)?.type !== "PAGE" && !underAnother(doc, id, set));
}

/** The selected layers a drag can move or resize: locked layers (and those inside locked ones) stay put. */
export function movable(doc: Document, ids: readonly NodeId[]): NodeId[] {
  return topmost(doc, ids).filter((id) => !isLocked(doc, id));
}

/**
 * The selection box on the page. One layer: its own box, turned with it.
 * Several: the upright box around all of them.
 */
export interface SelectionFrame {
  /** Top-left corner on the page. */
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
}

export function selectionFrame(doc: Document, ids: readonly NodeId[]): SelectionFrame | null {
  const live = ids.filter((id) => doc.has(id));
  if (live.length === 1) {
    const n = doc.get(live[0] as NodeId) as ReadonlyNode;
    if (n.type === "PAGE") return null;
    const p = placementOf(doc, n.id);
    return { x: p.x, y: p.y, rotation: p.rotation, width: n.width, height: n.height };
  }
  const box = unionRects(live.map((id) => worldBounds(doc, id)).filter((r): r is Rect => r !== null));
  return box ? { ...box, rotation: 0 } : null;
}

/** A layer as it was when a drag started. */
export interface Start {
  id: NodeId;
  x: number;
  y: number;
  width: number;
  height: number;
  /** The layer's own rotation, relative to its parent. */
  rotation: number;
  /** Its parent's space on the page. */
  parent: Placement;
  /** Its upright bounds on the page. */
  bounds: Rect;
}

export function snapshot(doc: Document, ids: readonly NodeId[]): Start[] {
  const out: Start[] = [];
  for (const id of ids) {
    const n = doc.get(id);
    const bounds = worldBounds(doc, id);
    if (!n || !bounds) continue;
    out.push({ id, x: n.x, y: n.y, width: n.width, height: n.height, rotation: n.rotation || 0, parent: parentPlacement(doc, id), bounds });
  }
  return out;
}

/** The upright box around the layers at the start of a drag. */
export const startBounds = (starts: readonly Start[]): Rect | null => unionRects(starts.map((s) => s.bounds));

/** Rotation of a started layer on the page. */
const worldRotation = (s: Start) => s.parent.rotation + s.rotation;

const tidy = (v: number) => Math.round(v * 100) / 100;

/**
 * Move the layers by (`dx`, `dy`) on the page, from where they started.
 * Each layer moves in its own parent's space, so children of a turned
 * frame still follow the pointer.
 */
export function moveBy(tx: Transaction, starts: readonly Start[], dx: number, dy: number): void {
  for (const s of starts) {
    const d = rotate(dx, dy, -s.parent.rotation);
    tx.set(s.id, "x", tidy(s.x + d.x));
    tx.set(s.id, "y", tidy(s.y + d.y));
  }
}

/**
 * A page delta that lands the selection's top-left on whole pixels, so
 * dragging keeps whole-pixel positions (Figma's pixel grid).
 */
export function snapDelta(box: Rect, dx: number, dy: number): Point {
  return { x: Math.round(box.x + dx) - box.x, y: Math.round(box.y + dy) - box.y };
}

/**
 * Resize the layers by dragging `handle` by (`dx`, `dy`) on the page. One
 * layer resizes in its own (possibly turned) space; several scale together
 * inside their shared box, and flip past the opposite edge.
 */
export function resizeBy(tx: Transaction, starts: readonly Start[], handle: Handle, dx: number, dy: number, mods: ResizeModifiers): void {
  const only = starts.length === 1 ? starts[0] : undefined;
  if (only && worldRotation(only) !== 0) {
    // Turned layer: resize in its own space, then put its top-left back in the parent's.
    const d = rotate(dx, dy, -worldRotation(only));
    const box = { x: 0, y: 0, width: only.width, height: only.height };
    const r = scaleRect(box, resizeScale(box, handle, d.x, d.y, mods));
    const o = rotate(r.x, r.y, only.rotation);
    tx.set(only.id, "x", tidy(only.x + o.x));
    tx.set(only.id, "y", tidy(only.y + o.y));
    tx.set(only.id, "width", r.width);
    tx.set(only.id, "height", r.height);
    return;
  }
  const box = startBounds(starts);
  if (!box) return;
  const t = resizeScale(box, handle, dx, dy, mods);
  for (const s of starts) {
    const rot = worldRotation(s);
    if (rot === 0) {
      const r = scaleRect(s.bounds, t);
      const p = toSpace(s.parent, r.x, r.y);
      tx.set(s.id, "x", tidy(p.x));
      tx.set(s.id, "y", tidy(p.y));
      tx.set(s.id, "width", r.width);
      tx.set(s.id, "height", r.height);
      continue;
    }
    // A turned layer in a group: scale its size along its own axes and keep its centre in step.
    // Approximate (no skew, no mirroring), but it never corrupts the layer.
    const u = rotate(1, 0, rot);
    const v = rotate(0, 1, rot);
    const w = Math.max(1, tidy(s.width * Math.hypot(u.x * t.sx, u.y * t.sy)));
    const h = Math.max(1, tidy(s.height * Math.hypot(v.x * t.sx, v.y * t.sy)));
    const c = scalePoint(t, s.bounds.x + s.bounds.width / 2, s.bounds.y + s.bounds.height / 2);
    const half = rotate(w / 2, h / 2, rot);
    const p = toSpace(s.parent, c.x - half.x, c.y - half.y);
    tx.set(s.id, "x", tidy(p.x));
    tx.set(s.id, "y", tidy(p.y));
    tx.set(s.id, "width", w);
    tx.set(s.id, "height", h);
  }
}

/** Delete the layers (and everything inside them). */
export function deleteLayers(tx: Transaction, doc: Document, ids: readonly NodeId[]): void {
  for (const id of topmost(doc, ids)) tx.delete(id);
}

/**
 * Duplicate the layers, as ⌘D in Figma: each copy goes just above its
 * original in the same parent, in place; a top-level frame's copy goes to
 * its right instead. Returns the copies' ids, to select them.
 */
export function duplicateLayers(tx: Transaction, doc: Document, ids: readonly NodeId[]): NodeId[] {
  const copy = (n: ReadonlyNode, parent: NodeId, position: "last" | { after: NodeId }, dx: number): NodeId => {
    const { id: _id, type, parentId: _parent, index: _index, ...fields } = n;
    const id = tx.create(type, parent, { ...fields, x: n.x + dx }, position);
    for (const child of doc.children(n.id)) copy(child, id, "last", 0);
    return id;
  };
  const out: NodeId[] = [];
  for (const id of topmost(doc, ids)) {
    const n = doc.get(id);
    if (!n || !n.parentId) continue;
    const topLevel = doc.get(n.parentId)?.type === "PAGE" && CONTAINERS.has(n.type);
    out.push(copy(n, n.parentId, { after: id }, topLevel ? n.width + DUPLICATE_GAP : 0));
  }
  return out;
}

/**
 * The layers a change creates, outermost only (no pages, nor layers created
 * inside another one it creates), in order. Undoing a delete, or redoing a
 * duplicate or a drawn shape, selects them again, as in Figma.
 */
export function createdLayers(ops: readonly Operation[]): NodeId[] {
  const created = new Set<NodeId>();
  for (const o of ops) if (o.op === "create" && o.node.type !== "PAGE") created.add(o.node.id);
  const out: NodeId[] = [];
  for (const o of ops) {
    if (o.op !== "create" || !created.has(o.node.id)) continue;
    if (o.node.parentId !== null && created.has(o.node.parentId)) continue;
    out.push(o.node.id);
  }
  return out;
}

/**
 * Shift-click in the layers panel: every row from `anchor` to `target`, in
 * list order. Without an anchor in the list, just `target`.
 */
export function layerRange(rows: readonly NodeId[], anchor: NodeId | null, target: NodeId): NodeId[] {
  const a = anchor === null ? -1 : rows.indexOf(anchor);
  const b = rows.indexOf(target);
  if (a < 0 || b < 0) return [target];
  return rows.slice(Math.min(a, b), Math.max(a, b) + 1);
}

/** The page point of a selection-frame corner given in the frame's own space. */
export const framePoint = (f: SelectionFrame, x: number, y: number): Point => fromSpace(f, x, y);
