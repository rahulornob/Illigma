import type { Document, Operation, ReadonlyNode, Transaction } from "@illigma/core";
import type { NodeId } from "@illigma/format";
import { isInFlow, padding, rotatedBounds } from "@illigma/layout";
import { flowParent, inFlow, resizeLayer } from "./layout";
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
export function resizeBy(tx: Transaction, doc: Document, starts: readonly Start[], handle: Handle, dx: number, dy: number, mods: ResizeModifiers & { constraints?: boolean }): void {
  // Through layout: children follow their constraints (not with ⌘/Ctrl held), Hug or Fill becomes Fixed, auto layout reflows.
  const set = (id: NodeId, box: Rect) => resizeLayer(tx, doc, id, box, { constraints: mods.constraints !== false });
  const only = starts.length === 1 ? starts[0] : undefined;
  if (only && worldRotation(only) !== 0) {
    // Turned layer: resize in its own space, then put its top-left back in the parent's.
    const d = rotate(dx, dy, -worldRotation(only));
    const box = { x: 0, y: 0, width: only.width, height: only.height };
    const r = scaleRect(box, resizeScale(box, handle, d.x, d.y, mods));
    const o = rotate(r.x, r.y, only.rotation);
    set(only.id, { x: tidy(only.x + o.x), y: tidy(only.y + o.y), width: r.width, height: r.height });
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
      set(s.id, { x: tidy(p.x), y: tidy(p.y), width: r.width, height: r.height });
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
    set(s.id, { x: tidy(p.x), y: tidy(p.y), width: w, height: h });
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

// ---- auto layout: reordering instead of moving ----

/** The layers a drag or a nudge moves freely: layers in an auto layout flow get their position from their parent. */
export function freeLayers(doc: Document, ids: readonly NodeId[]): NodeId[] {
  return ids.filter((id) => !inFlow(doc, id));
}

/** The auto layout frame every one of `ids` flows in, or null (none, or not all in the same one). */
export function sharedFlowParent(doc: Document, ids: readonly NodeId[]): NodeId | null {
  let shared: NodeId | null = null;
  for (const id of ids) {
    const p = flowParent(doc, id);
    if (!p || (shared !== null && p.id !== shared)) return null;
    shared = p.id;
  }
  return shared;
}

/** A layer's upright box in its parent's space (rotation included). */
function slotBox(n: ReadonlyNode): Rect {
  const b = rotatedBounds(n.width, n.height, n.rotation || 0);
  return { x: n.x + b.x, y: n.y + b.y, width: b.width, height: b.height };
}

/** Where a reorder lands: before `before` (null: after the last layer in the flow), and the insertion line to show, on the page. */
export interface ReorderSlot {
  before: NodeId | null;
  /** A line on the page: `width` long along its own x axis, turned with the frame. */
  line: SelectionFrame;
}

/**
 * The slot among the other layers in `parentId`'s flow for a pointer at
 * (`wx`, `wy`) on the page: before the first layer whose centre is past the
 * pointer along the flow (Figma's insertion by pointer position). In a
 * wrapping frame, the layer nearest the pointer decides.
 */
export function reorderSlot(doc: Document, parentId: NodeId, ids: readonly NodeId[], wx: number, wy: number): ReorderSlot | null {
  const parent = doc.get(parentId);
  if (!parent) return null;
  const vertical = parent.layoutMode === "VERTICAL";
  const moving = new Set(ids);
  const rest = doc.children(parentId).filter((n) => isInFlow(n) && !moving.has(n.id));
  const space = placementOf(doc, parentId);
  const p = toSpace(space, wx, wy);
  const boxes = rest.map(slotBox);
  const start = (b: Rect) => (vertical ? b.y : b.x);
  const end = (b: Rect) => (vertical ? b.y + b.height : b.x + b.width);
  const centre = (b: Rect) => (start(b) + end(b)) / 2;
  const along = vertical ? p.y : p.x;
  let i: number;
  if (parent.layoutWrap === "WRAP" && boxes.length) {
    let best = 0;
    let bestD = Infinity;
    boxes.forEach((b, k) => {
      const d = Math.hypot(b.x + b.width / 2 - p.x, b.y + b.height / 2 - p.y);
      if (d < bestD) [best, bestD] = [k, d];
    });
    i = along < centre(boxes[best] as Rect) ? best : best + 1;
  } else {
    i = boxes.findIndex((b) => along < centre(b));
    if (i < 0) i = boxes.length;
  }
  // The line: in the gap before slot i, across the frame's content box.
  const pad = padding(parent);
  const [padStart, padEnd] = vertical ? [pad.top, pad.bottom] : [pad.left, pad.right];
  const prev = boxes[i - 1];
  const next = boxes[i];
  const at = prev && next ? (end(prev) + start(next)) / 2 : next ? start(next) - padStart / 2 : prev ? end(prev) + padEnd / 2 : padStart;
  const crossFrom = vertical ? pad.left : pad.top;
  const length = Math.max(1, (vertical ? parent.width - pad.left - pad.right : parent.height - pad.top - pad.bottom));
  const local = vertical ? { x: crossFrom, y: at } : { x: at, y: crossFrom };
  const origin = fromSpace(space, local.x, local.y);
  const line = { x: origin.x, y: origin.y, width: length, height: 0, rotation: space.rotation + (vertical ? 0 : 90) };
  return { before: next ? (rest[i] as ReadonlyNode).id : null, line };
}

/**
 * Move `ids` (children of `parentId`, kept in their current order) to just
 * before `before`, or after the last layer in the flow when it is null.
 * Layers outside the flow (absolute, hidden) keep their places. Records
 * nothing when the order would not change. Layout then reflows the frame.
 */
export function reorderLayers(tx: Transaction, doc: Document, parentId: NodeId, ids: readonly NodeId[], before: NodeId | null): boolean {
  const order = doc.children(parentId);
  const moving = order.filter((n) => ids.includes(n.id)).map((n) => n.id);
  if (!moving.length) return false;
  const rest = order.filter((n) => !ids.includes(n.id));
  let at: number;
  if (before !== null) {
    at = rest.findIndex((n) => n.id === before);
    if (at < 0) return false;
  } else {
    // After the last layer in the flow: absolute and hidden layers after it stay on top.
    let last = -1;
    rest.forEach((n, k) => isInFlow(n) && (last = k));
    at = last + 1;
  }
  const target = [...rest.slice(0, at).map((n) => n.id), ...moving, ...rest.slice(at).map((n) => n.id)];
  if (target.every((id, k) => id === order[k]?.id)) return false;
  moving.forEach((id, k) => {
    const ref = rest[at];
    const position = k > 0 ? { after: moving[k - 1] as NodeId } : ref ? { before: ref.id } : at > 0 ? { after: (rest[at - 1] as ReadonlyNode).id } : ("first" as const);
    tx.move(id, parentId, position);
  });
  return true;
}

/**
 * Arrow keys on layers in an auto layout flow reorder them by one step
 * (interactions.md): ←/↑ earlier, →/↓ later, along the frame's direction.
 * Returns null for an arrow across the flow (nothing to do), else whether the order changed.
 */
export function reorderStep(tx: Transaction, doc: Document, parentId: NodeId, ids: readonly NodeId[], key: string): boolean | null {
  const vertical = doc.get(parentId)?.layoutMode === "VERTICAL";
  const dir = vertical ? { ArrowUp: -1, ArrowDown: 1 }[key] : { ArrowLeft: -1, ArrowRight: 1 }[key];
  if (!dir) return null;
  const flow = doc.children(parentId).filter(isInFlow);
  const rest = flow.filter((n) => !ids.includes(n.id));
  const first = flow.findIndex((n) => ids.includes(n.id));
  if (first < 0) return false;
  const slot = Math.min(rest.length, Math.max(0, flow.slice(0, first).length + dir));
  return reorderLayers(tx, doc, parentId, ids, rest[slot]?.id ?? null);
}

/** The page point of a selection-frame corner given in the frame's own space. */
export const framePoint = (f: SelectionFrame, x: number, y: number): Point => fromSpace(f, x, y);
