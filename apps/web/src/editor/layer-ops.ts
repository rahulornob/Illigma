/**
 * Layer and page operations, as in Figma: group (⌘G), ungroup (⇧⌘G), frame
 * selection (⌥⌘G), layer order (⌘] ⌘[ ⌥⌘] ⌥⌘[), moving layers into another
 * parent (Layers panel drag), hide and lock, and pages (add, duplicate,
 * delete, rename, reorder). Every function writes into a transaction, so the
 * caller decides the undo step; layers always keep their place on the page.
 */
import { isInsideInstance, ownerInstance, wouldCreateCycle, type Document, type ReadonlyNode, type Transaction } from "@illigma/core";
import type { NodeId, NodeType } from "@illigma/format";
import { isAutoLayout, isInFlow, rotatedBounds } from "@illigma/layout";
import { refuseInsideInstance, topmost } from "./edit";
import { placementOf, rotate, toSpace, type Rect } from "./geometry";

const tidy = (v: number) => Math.round(v * 100) / 100;

/** Types a layer can be moved into (Layers panel drop, paste into the selection). */
export const CONTAINER_TYPES: ReadonlySet<NodeType> = new Set(["FRAME", "GROUP", "SECTION", "COMPONENT", "INSTANCE"]);

export const isContainer = (n: ReadonlyNode | undefined): boolean => !!n && (n.type === "PAGE" || CONTAINER_TYPES.has(n.type));

/** The ancestors of `id`, nearest first, ending with its page. */
export function ancestors(doc: Document, id: NodeId): NodeId[] {
  const out: NodeId[] = [];
  for (let p = doc.get(id)?.parentId; p; p = doc.get(p)?.parentId) out.push(p);
  return out;
}

/** The page `id` is on (itself for a page). */
export function pageOf(doc: Document, id: NodeId): NodeId | null {
  let n = doc.get(id);
  while (n?.parentId) n = doc.get(n.parentId);
  return n?.type === "PAGE" ? n.id : null;
}

/** The nearest parent every one of `ids` is inside. */
export function commonParent(doc: Document, ids: readonly NodeId[]): NodeId | null {
  if (!ids.length) return null;
  let chain = ancestors(doc, ids[0] as NodeId);
  for (const id of ids.slice(1)) {
    const set = new Set(ancestors(doc, id));
    chain = chain.filter((a) => set.has(a));
  }
  return chain[0] ?? null;
}

/** Siblings first in layer order (back to front), then by depth: the order a group stacks its layers in. */
export function documentOrder(doc: Document, ids: readonly NodeId[]): NodeId[] {
  const want = new Set(ids);
  const out: NodeId[] = [];
  const page = ids.length ? pageOf(doc, ids[0] as NodeId) : null;
  const walk = (parent: NodeId) => {
    for (const k of doc.children(parent)) {
      if (want.has(k.id)) out.push(k.id);
      else walk(k.id);
    }
  };
  if (page) walk(page);
  return out;
}

/**
 * Move `id` under `parentId` at `position`, keeping where it is on the page
 * (its position and rotation are recomputed in the new parent's space).
 * In an auto layout parent the flow places it; absolute positioning is
 * dropped when the new parent has no auto layout.
 */
export function moveKeepingPlace(tx: Transaction, doc: Document, id: NodeId, parentId: NodeId, position: Parameters<Transaction["move"]>[2] = "last"): void {
  const n = doc.get(id);
  if (!n) return;
  const from = placementOf(doc, n.parentId as NodeId);
  const to = placementOf(doc, parentId);
  // Top-left on the page, then in the new parent's space.
  const o = rotate(n.x, n.y, from.rotation);
  const p = toSpace(to, from.x + o.x, from.y + o.y);
  const rotation = normDeg((n.rotation || 0) + from.rotation - to.rotation);
  tx.move(id, parentId, position);
  tx.set(id, "x", tidy(p.x));
  tx.set(id, "y", tidy(p.y));
  if (rotation !== (n.rotation || 0)) tx.set(id, "rotation", rotation);
  const parent = doc.get(parentId);
  if (n.layoutPositioning === "ABSOLUTE" && !(parent && isAutoLayout(parent))) tx.set(id, "layoutPositioning", undefined);
  if (n.layoutSizingHorizontal === "FILL" && !(parent && isAutoLayout(parent))) tx.set(id, "layoutSizingHorizontal", "FIXED");
  if (n.layoutSizingVertical === "FILL" && !(parent && isAutoLayout(parent))) tx.set(id, "layoutSizingVertical", "FIXED");
}

function normDeg(d: number): number {
  let r = ((d % 360) + 360) % 360;
  if (r > 180) r -= 360;
  return tidy(r);
}

/** A layer's upright box in its parent's space (rotation included). */
function boxInParent(n: ReadonlyNode): Rect {
  const b = rotatedBounds(n.width, n.height, n.rotation || 0);
  return { x: n.x + b.x, y: n.y + b.y, width: b.width, height: b.height };
}

/**
 * Wrap the layers in a new GROUP or FRAME sized to fit them, at the place of
 * the front-most one, in their nearest common parent. Positions on the page
 * are kept; the wrapped layers keep their stacking order. Returns the new
 * layer's id, or null when there is nothing to wrap.
 */
export function wrapLayers(tx: Transaction, doc: Document, ids: readonly NodeId[], type: "GROUP" | "FRAME"): NodeId | null {
  const layers = documentOrder(doc, topmost(doc, ids));
  if (!layers.length) return null;
  refuseInsideInstance(doc, layers, "grouped");
  const parentId = commonParent(doc, layers);
  if (!parentId) return null;
  const parent = doc.get(parentId);
  // Where it goes: just above the front-most layer that is a direct child, else on top.
  const direct = layers.filter((id) => doc.get(id)?.parentId === parentId);
  const flowing = parent && isAutoLayout(parent) ? direct.filter((id) => isInFlow(doc.get(id) as ReadonlyNode)) : [];
  const anchor = flowing.length ? { before: flowing[0] as NodeId } : direct.length ? { after: direct.at(-1) as NodeId } : ("last" as const);
  // Gather every layer into the parent first (in place), then size the wrapper around them.
  for (const id of layers) if (doc.get(id)?.parentId !== parentId) moveKeepingPlace(tx, doc, id, parentId, "last");
  const boxes = layers.map((id) => boxInParent(doc.get(id) as ReadonlyNode));
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.width));
  const y1 = Math.max(...boxes.map((b) => b.y + b.height));
  const allAbsolute = parent && isAutoLayout(parent) && layers.every((id) => doc.get(id)?.layoutPositioning === "ABSOLUTE");
  const wrapper = tx.create(
    type,
    parentId,
    {
      name: type === "GROUP" ? nextName(doc, parentId, "Group") : nextName(doc, parentId, "Frame"),
      x: tidy(x0),
      y: tidy(y0),
      width: Math.max(0.01, tidy(x1 - x0)),
      height: Math.max(0.01, tidy(y1 - y0)),
      ...(allAbsolute ? { layoutPositioning: "ABSOLUTE" as const } : {}),
    },
    anchor,
  );
  for (const id of layers) {
    const n = doc.get(id) as ReadonlyNode;
    tx.move(id, wrapper, "last");
    tx.set(id, "x", tidy(n.x - x0));
    tx.set(id, "y", tidy(n.y - y0));
    if (n.layoutPositioning === "ABSOLUTE") tx.set(id, "layoutPositioning", undefined);
    if (n.layoutSizingHorizontal === "FILL") tx.set(id, "layoutSizingHorizontal", "FIXED");
    if (n.layoutSizingVertical === "FILL") tx.set(id, "layoutSizingVertical", "FIXED");
  }
  return wrapper;
}

/** "Group 3": one more than the highest number among the parent's layers named that way. */
function nextName(doc: Document, parentId: NodeId, base: string): string {
  let max = 0;
  const re = new RegExp(`^${base} (\\d+)$`);
  for (const k of doc.children(parentId)) {
    const m = re.exec(k.name);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${base} ${max + 1}`;
}

/**
 * Ungroup (⇧⌘G): each selected group or frame is replaced by its layers, in
 * its place in the layer order and on the page. Other layers stay selected.
 * Returns the new selection.
 */
export function ungroupLayers(tx: Transaction, doc: Document, ids: readonly NodeId[]): NodeId[] {
  const out: NodeId[] = [];
  for (const id of topmost(doc, ids)) {
    const g = doc.get(id);
    if (!g || !g.parentId || (g.type !== "GROUP" && g.type !== "FRAME" && g.type !== "SECTION")) {
      out.push(id);
      continue;
    }
    const kids = doc.children(id).map((k) => k.id);
    let after: NodeId = id;
    for (const k of kids) {
      moveKeepingPlace(tx, doc, k, g.parentId, { after });
      after = k;
      out.push(k);
    }
    // Opacity and visibility of the group carry over to its layers, as in Figma.
    if (g.opacity !== 1) for (const k of kids) tx.set(k, "opacity", tidy((doc.get(k)?.opacity ?? 1) * g.opacity));
    tx.delete(id);
  }
  return out;
}

export type OrderStep = "forward" | "backward" | "front" | "back";

/**
 * Bring forward / send backward one step (⌘] ⌘[), or to the front / back
 * (⌥⌘] ⌥⌘[), among each layer's siblings. A selected layer steps past its
 * unselected neighbour; runs move as a block. Returns whether anything moved.
 */
export function reorderZ(tx: Transaction, doc: Document, ids: readonly NodeId[], step: OrderStep): boolean {
  const byParent = new Map<NodeId, NodeId[]>();
  for (const id of topmost(doc, ids)) {
    const p = doc.get(id)?.parentId;
    if (!p) continue;
    byParent.set(p, [...(byParent.get(p) ?? []), id]);
  }
  let moved = false;
  for (const [parentId, chosenIds] of byParent) {
    const order = doc.children(parentId).map((n) => n.id);
    const chosen = new Set(chosenIds);
    let next: NodeId[];
    if (step === "front") next = [...order.filter((id) => !chosen.has(id)), ...order.filter((id) => chosen.has(id))];
    else if (step === "back") next = [...order.filter((id) => chosen.has(id)), ...order.filter((id) => !chosen.has(id))];
    else {
      next = [...order];
      const dir = step === "forward" ? 1 : -1;
      for (let k = dir > 0 ? next.length - 2 : 1; dir > 0 ? k >= 0 : k < next.length; k -= dir) {
        const a = next[k] as NodeId;
        const b = next[k + dir] as NodeId;
        if (chosen.has(a) && !chosen.has(b)) [next[k], next[k + dir]] = [b, a];
      }
    }
    moved = applyOrder(tx, doc, parentId, next) || moved;
  }
  return moved;
}

/** Put `parentId`'s children in `target` order with the fewest moves. */
function applyOrder(tx: Transaction, doc: Document, parentId: NodeId, target: readonly NodeId[]): boolean {
  const current = doc.children(parentId).map((n) => n.id);
  if (target.every((id, k) => id === current[k])) return false;
  for (let k = 0; k < target.length; k++) {
    const id = target[k] as NodeId;
    if (current[k] === id) continue;
    tx.move(id, parentId, k === 0 ? "first" : { after: target[k - 1] as NodeId });
    current.splice(current.indexOf(id), 1);
    current.splice(k, 0, id);
  }
  return true;
}

/** Where a Layers panel drop puts layers: inside `parentId`, before or after a sibling, or on top. */
export type DropPlace = { parentId: NodeId; position: "first" | "last" | { before: NodeId } | { after: NodeId } };

/** Whether `ids` may be dropped at `place`: never into themselves or their own layers, only into containers. */
export function canDrop(doc: Document, ids: readonly NodeId[], place: DropPlace): boolean {
  const target = doc.get(place.parentId);
  if (!isContainer(target)) return false;
  // An instance's layers come from its main component: nothing goes in or out (as in Figma), and no component goes in itself.
  if (ownerInstance(doc, place.parentId) || ids.some((id) => isInsideInstance(doc, id))) return false;
  if (wouldCreateCycle(doc, ids, place.parentId)) return false;
  const chain = new Set([place.parentId, ...ancestors(doc, place.parentId)]);
  if (ids.some((id) => chain.has(id))) return false;
  const pos = place.position;
  if (typeof pos === "object") {
    const ref = "before" in pos ? pos.before : pos.after;
    if (ids.includes(ref)) return false;
  }
  return ids.every((id) => {
    const n = doc.get(id);
    return !!n && n.type !== "PAGE" && pageOf(doc, id) === pageOf(doc, place.parentId);
  });
}

/**
 * Move layers (Layers panel drag) to `place`, keeping their order and where
 * they are on the page. Returns false (and changes nothing) when the drop
 * isn't allowed.
 */
export function moveLayers(tx: Transaction, doc: Document, ids: readonly NodeId[], place: DropPlace): boolean {
  const layers = documentOrder(doc, topmost(doc, ids));
  if (!layers.length || !canDrop(doc, layers, place)) return false;
  let pos: DropPlace["position"] = place.position;
  for (const id of layers) {
    if (doc.get(id)?.parentId === place.parentId) tx.move(id, place.parentId, pos);
    else moveKeepingPlace(tx, doc, id, place.parentId, pos);
    pos = { after: id };
  }
  return true;
}

/** Show or hide the layers: all hidden when any is visible, else all shown (⇧⌘H). */
export function toggleVisible(tx: Transaction, doc: Document, ids: readonly NodeId[]): void {
  const nodes = topmost(doc, ids).map((id) => doc.get(id) as ReadonlyNode);
  const hide = nodes.some((n) => n.visible);
  for (const n of nodes) tx.set(n.id, "visible", !hide);
}

/** Lock or unlock the layers: all locked when any is unlocked (⇧⌘L). */
export function toggleLocked(tx: Transaction, doc: Document, ids: readonly NodeId[]): void {
  const nodes = topmost(doc, ids).map((id) => doc.get(id) as ReadonlyNode);
  const lock = nodes.some((n) => !n.locked);
  for (const n of nodes) tx.set(n.id, "locked", lock);
}

/** Rename one layer or page. Blank names are refused (the old name stays). */
export function renameNode(tx: Transaction, id: NodeId, name: string): boolean {
  const clean = name.replace(/\s+/g, " ").trim();
  if (!clean) return false;
  tx.set(id, "name", clean);
  return true;
}

// ---- pages ----

/** "Page 3": one more than the highest numbered page. */
export function nextPageName(doc: Document): string {
  let max = doc.pages().length;
  for (const p of doc.pages()) {
    const m = /^Page (\d+)$/.exec(p.name);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `Page ${max + 1}`;
}

/** Copy `n` and everything inside it under `parentId`. Returns the copy's id. */
export function copyTree(tx: Transaction, doc: Document, n: ReadonlyNode, parentId: NodeId, position: DropPlace["position"] = "last"): NodeId {
  const { id: _id, type, parentId: _p, index: _i, ...fields } = n;
  const id = tx.create(type, parentId, fields, position);
  for (const k of doc.children(n.id)) copyTree(tx, doc, k, id, "last");
  return id;
}

/** Duplicate a page and all its layers, right after it. Returns the new page's id. */
export function duplicatePage(tx: Transaction, doc: Document, pageId: NodeId): NodeId {
  const page = doc.get(pageId) as ReadonlyNode;
  const copy = tx.addPage(`${page.name} copy`, { after: pageId });
  for (const k of doc.children(pageId)) copyTree(tx, doc, k, copy, "last");
  return copy;
}

/** Move a page one step up (-1) or down (+1), or to `index` among the pages. Returns whether it moved. */
export function movePage(tx: Transaction, doc: Document, pageId: NodeId, to: number): boolean {
  const pages = doc.pages().map((p) => p.id);
  const from = pages.indexOf(pageId);
  const at = Math.max(0, Math.min(pages.length - 1, to));
  if (from < 0 || from === at) return false;
  const rest = pages.filter((id) => id !== pageId);
  const before = rest[at - 1];
  const after = rest[at];
  tx.movePage(pageId, after ? { before: after } : before ? { after: before } : "last");
  return true;
}
