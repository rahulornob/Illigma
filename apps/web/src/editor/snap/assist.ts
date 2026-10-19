/**
 * What the canvas asks on every pointer move of a drag: the snapped offset,
 * the guides to draw, and (for a move) the frame the layers would drop into.
 * Built once when the drag starts, so a move over 12,000 layers stays cheap.
 */
import type { Document } from "@illigma/core";
import type { NodeId } from "@illigma/format";
import type { Rect } from "../geometry";
import type { ReorderSlot } from "../edit";
import { snapIndexFor } from "./candidates";
import { droppable, dropSlot, dropTarget, sharedParent } from "./drop";
import type { GuideLayer } from "./overlay";
import { snapCoordinate, snapMove, snapPoint, type SnapIndex } from "./snap";

export interface Mods {
  /** Snapping on (Ctrl or ⌘ not held). */
  snap: boolean;
  /** Space held: keep the parent. */
  keep: boolean;
  /** ⌘ held: drop a larger layer into auto layout. */
  force: boolean;
}

export class MoveAssist {
  readonly #doc: Document;
  readonly #page: NodeId;
  readonly #ids: readonly NodeId[];
  readonly #box: Rect;
  #index: SnapIndex;
  #indexTarget: NodeId | null = null;
  readonly #self: boolean;
  /** Guides and gap pills to draw now. */
  layer: GuideLayer | null = null;
  /** The frame the layers would drop into; null: they keep their parent. */
  target: NodeId | null = null;
  /** In an auto layout target: where they would go. */
  slot: ReorderSlot | null = null;

  /** `ids`: the layers being dragged (or, for ⌥-drag, the originals: they stay and can be snapped to when `snapToSelf`). */
  constructor(doc: Document, pageId: NodeId, ids: readonly NodeId[], box: Rect, snapToSelf = false) {
    this.#doc = doc;
    this.#page = pageId;
    this.#ids = ids;
    this.#box = box;
    this.#self = snapToSelf;
    this.#index = snapIndexFor(doc, ids, [], !snapToSelf);
  }

  /** Snap the drag (`dx`, `dy`) and work out the drop target for the pointer at (`wx`, `wy`). `moving`: the layers that would drop. */
  move(dx: number, dy: number, wx: number, wy: number, threshold: number, mods: Mods, moving: readonly NodeId[] = this.#ids): { dx: number; dy: number } {
    const d = this.#doc;
    const movable = droppable(d, moving);
    const box = { ...this.#box, x: this.#box.x + dx, y: this.#box.y + dy };
    const parent = sharedParent(d, movable);
    let target = movable.length ? dropTarget(d, this.#page, wx, wy, movable, box, { keep: mods.keep, force: mods.force }) : null;
    if (target !== null && target === parent) target = null;
    // Mixed parents moving into the frame some of them are already in: the others still go.
    this.target = target;
    this.slot = target ? dropSlot(d, target, movable, wx, wy) : null;
    // Snap to the target's children too, once it is known.
    if (target !== this.#indexTarget) {
      this.#indexTarget = target;
      this.#index = snapIndexFor(d, this.#self ? moving : this.#ids, target ? [target] : []);
    }
    if (this.slot) {
      // Into auto layout: the layout places them, so no guides.
      this.layer = null;
      return { dx: Math.round(this.#box.x + dx) - this.#box.x, dy: Math.round(this.#box.y + dy) - this.#box.y };
    }
    const r = snapMove(this.#index, this.#box, dx, dy, threshold, mods.snap);
    this.layer = r.guides.length || r.gaps.length ? { guides: r.guides, gaps: r.gaps } : null;
    return { dx: r.dx, dy: r.dy };
  }
}

/** Snapping for a resize or a drawn shape: one index of the layers around. */
export class EdgeAssist {
  readonly #index: SnapIndex;
  layer: GuideLayer | null = null;

  constructor(doc: Document, ids: readonly NodeId[], parents: readonly NodeId[] = []) {
    this.#index = snapIndexFor(doc, ids, parents);
  }

  /** Snap the coordinate `v` on an axis (a moving edge). */
  coordinate(axis: "x" | "y", v: number, threshold: number, snap: boolean): number {
    return snapCoordinate(this.#index, axis, v, threshold, snap);
  }

  point(x: number, y: number, threshold: number, snap: boolean): { x: number; y: number } {
    const r = snapPoint(this.#index, { x, y }, threshold, snap);
    this.layer = r.guides.length ? { guides: r.guides, gaps: [] } : null;
    return r.point;
  }

  /** Guides for a box after its edges snapped. */
  showFor(box: Rect, snap: boolean): void {
    if (!snap) {
      this.layer = null;
      return;
    }
    const r = snapMove(this.#index, box, 0, 0, 0, true);
    this.layer = r.guides.length ? { guides: r.guides, gaps: [] } : null;
  }
}
