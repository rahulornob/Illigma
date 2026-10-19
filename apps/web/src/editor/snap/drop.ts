/**
 * Dropping layers onto a frame while dragging them (interactions.md §2,
 * "Drop onto a frame"): which frame receives them, and moving them there with
 * their place on the page kept.
 */
import { isInsideInstance, wouldCreateCycle, type Document, type Transaction } from "@illigma/core";
import type { NodeId, NodeType } from "@illigma/format";
import { isAutoLayout, isInFlow } from "@illigma/layout";
import { placementOf, toSpace, worldBounds, type Rect } from "../geometry";
import { reorderSlot, type ReorderSlot } from "../edit";

/** Layers that take children when something is dropped on them. */
const RECEIVERS = new Set<NodeType>(["FRAME", "COMPONENT", "SECTION"]);
/** Parents a dragged layer can leave: layers inside a group stay in it. */
const LEAVABLE = new Set<NodeType>(["PAGE", "FRAME", "COMPONENT", "SECTION"]);

export interface DropOptions {
  /** Space held: keep the current parent. */
  keep?: boolean;
  /** ⌘ held: drop into auto layout even when the layers are larger than the frame. */
  force?: boolean;
}

/** True if `id` is one of `ids` or inside one of them. */
function within(doc: Document, id: NodeId, ids: ReadonlySet<NodeId>): boolean {
  for (let cur: NodeId | null | undefined = id; cur; cur = doc.get(cur)?.parentId) if (ids.has(cur)) return true;
  return false;
}

/** The layers of `ids` a drop can move to another parent (not those in a group). */
export function droppable(doc: Document, ids: readonly NodeId[]): NodeId[] {
  return ids.filter((id) => {
    const p = doc.get(id)?.parentId;
    const parent = p ? doc.get(p) : undefined;
    return !!parent && LEAVABLE.has(parent.type) && !isInsideInstance(doc, id);
  });
}

/**
 * The frame that receives layers dropped with the pointer at (`wx`, `wy`):
 * the innermost visible frame there that is larger than `box` (the layers'
 * box on the page) in both directions, or an auto layout frame with
 * `force`. The page when none. Frames being dragged (and their children)
 * never receive. Null with `keep`: nothing changes parent.
 */
export function dropTarget(doc: Document, pageId: NodeId, wx: number, wy: number, moving: readonly NodeId[], box: Rect, opts: DropOptions = {}): NodeId | null {
  if (opts.keep) return null;
  const skip = new Set(moving);
  let found: NodeId = pageId;
  let parent: NodeId = pageId;
  for (;;) {
    const kids = doc.children(parent);
    let next: NodeId | null = null;
    for (let i = kids.length - 1; i >= 0; i--) {
      const n = kids[i];
      if (!n || !n.visible || !RECEIVERS.has(n.type) || within(doc, n.id, skip)) continue;
      const p = toSpace(placementOf(doc, n.id), wx, wy);
      if (p.x < 0 || p.y < 0 || p.x > n.width || p.y > n.height) continue;
      next = n.id;
      const b = worldBounds(doc, n.id);
      const fits = !!b && box.width < b.width && box.height < b.height;
      if (fits || (opts.force && isAutoLayout(n))) found = n.id;
      break;
    }
    if (!next) return found;
    parent = next;
  }
}

/** The layers' parent if they all share one, else null. */
export function sharedParent(doc: Document, ids: readonly NodeId[]): NodeId | null {
  let p: NodeId | null = null;
  for (const id of ids) {
    const q = doc.get(id)?.parentId ?? null;
    if (q === null || (p !== null && q !== p)) return null;
    p = q;
  }
  return p;
}

/** Where in an auto layout target the layers go (the insertion line), or null if it isn't one. */
export function dropSlot(doc: Document, target: NodeId, ids: readonly NodeId[], wx: number, wy: number): ReorderSlot | null {
  const t = doc.get(target);
  return t && isAutoLayout(t) ? reorderSlot(doc, target, ids, wx, wy) : null;
}

/**
 * Move `ids` into `target` keeping where they are on the page (and how they
 * are turned). In auto layout they go before `before` (null: after the last
 * layer in the flow) and the layout places them. Layers already in `target`
 * stay as they are, except in an auto layout target where they are put at
 * the slot. Returns the layers that changed parent.
 */
export function reparent(tx: Transaction, doc: Document, ids: readonly NodeId[], target: NodeId, before: NodeId | null = null): NodeId[] {
  const t = doc.get(target);
  if (!t) return [];
  const auto = isAutoLayout(t);
  const space = placementOf(doc, target);
  const moved: NodeId[] = [];
  // Order kept as in the layers panel: the first one goes at the slot, the rest after it.
  let after: NodeId | null = null;
  const lastInFlow = () => {
    let last: NodeId | null = null;
    for (const c of doc.children(target)) if (isInFlow(c) && !ids.includes(c.id)) last = c.id;
    return last;
  };
  for (const id of ids) {
    const n = doc.get(id);
    if (!n || (n.parentId === target && !auto)) continue;
    if (n.parentId !== target && wouldCreateCycle(doc, id, target)) continue; // a component never goes inside itself
    const p = placementOf(doc, id);
    const local = toSpace(space, p.x, p.y);
    const position = after
      ? { after }
      : auto
        ? before && before !== id
          ? { before }
          : ((l) => (l ? { after: l } : ("first" as const)))(lastInFlow())
        : ("last" as const);
    if (n.parentId !== target) moved.push(id);
    tx.move(id, target, position);
    tx.set(id, "x", Math.round(local.x * 100) / 100);
    tx.set(id, "y", Math.round(local.y * 100) / 100);
    const rot = p.rotation - space.rotation;
    if ((n.rotation || 0) !== rot) tx.set(id, "rotation", rot);
    after = id;
  }
  return moved;
}
