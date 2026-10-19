/**
 * What a drag snaps to (interactions.md §4): the moving layers' siblings and
 * their parent frame, plus the children of the frame the pointer is over.
 * Hidden layers and the layers being dragged never count.
 */
import type { Document } from "@illigma/core";
import type { NodeId } from "@illigma/format";
import { worldBounds, type Rect } from "../geometry";
import { buildIndex, type SnapIndex } from "./snap";
import { snapLinesFor } from "../grids";

/** Collect the boxes of `parents`' visible children (minus `skip`) and of the parents themselves (not pages). */
export function snapRects(doc: Document, parents: Iterable<NodeId>, skip: ReadonlySet<NodeId>): Rect[] {
  const out: Rect[] = [];
  const seen = new Set<NodeId>();
  for (const parent of parents) {
    if (seen.has(parent)) continue;
    seen.add(parent);
    const p = doc.get(parent);
    if (!p) continue;
    if (p.type !== "PAGE" && !skip.has(parent)) {
      const b = worldBounds(doc, parent);
      if (b) out.push(b);
    }
    for (const c of doc.children(parent)) {
      if (!c.visible || skip.has(c.id)) continue;
      const b = worldBounds(doc, c.id);
      if (b) out.push(b);
    }
  }
  return out;
}

/** The index for dragging `ids`: their parents' children and the parents; `extra` adds more parents (a drop target). */
export function snapIndexFor(doc: Document, ids: readonly NodeId[], extra: readonly NodeId[] = [], skipSelf = true): SnapIndex {
  const skip = new Set(skipSelf ? ids : []);
  const parents: NodeId[] = [];
  for (const id of ids) {
    const p = doc.get(id)?.parentId;
    if (p) parents.push(p);
  }
  parents.push(...extra);
  return buildIndex(snapRects(doc, parents, skip), snapLinesFor(doc, parents, skip));
}
