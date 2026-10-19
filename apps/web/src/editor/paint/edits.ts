/**
 * How the paint, effect and appearance cards write the document. Every
 * change is one undo step: a typed value or a click is one
 * `Document.transact`; a drag (colour area, sliders, gradient stops) is one
 * `Document.beginLive` edit, updated on every pointer move and committed on
 * release.
 */

import type { DeepReadonly, Document, LiveEdit, ReadonlyNode, Transaction } from "@illigma/core";
import type { Effect, Node, NodeId, NodeKey, Paint } from "@illigma/format";
import { DEFAULT_FILL, DEFAULT_STROKE, samePaints, solidPaint, strokesInsideByDefault } from "./paints";

/** Fields to set on one node (`undefined` removes an optional field, so its default applies). */
export type NodePatch = { [K in NodeKey]?: Node[K] | undefined };
/** The patch for each node, from the node as it is when the change is made. Null: leave it. */
export type Patcher = (node: ReadonlyNode) => NodePatch | null;

/** Where a change is in a gesture: a one-off edit, or the start, a step or the end of a drag. */
export type Phase = "once" | "start" | "move" | "end";

/** Values the document hands out are frozen; the cards only ever build new values from them. */
export const plain = <T>(v: DeepReadonly<T> | T): T => v as T;

function applyPatch(tx: Transaction, doc: Document, ids: readonly NodeId[], patch: Patcher): void {
  for (const id of ids) {
    const n = doc.get(id);
    if (!n) continue;
    const p = patch(n);
    if (!p) continue;
    for (const [k, v] of Object.entries(p)) tx.set(id, k as NodeKey, v as never);
  }
}

/**
 * Edits from one card. `change("once", …)` is one undo step; `start`, then
 * any number of `move`s, then `end` is one live edit (one undo step for the
 * whole drag). Each step's patch is computed from the state the drag started
 * in, so the last step is what is kept. Nothing happens while another live
 * edit (a canvas drag) owns the document.
 */
export class EditSession {
  readonly #doc: Document;
  #live: LiveEdit | null = null;

  constructor(doc: Document) {
    this.#doc = doc;
  }

  get dragging(): boolean {
    return !!this.#live?.open;
  }

  change(phase: Phase, label: string, ids: readonly NodeId[], patch: Patcher): void {
    const doc = this.#doc;
    if (phase === "once") {
      if (this.#live?.open) {
        this.#live.update((tx) => applyPatch(tx, doc, ids, patch));
        return;
      }
      if (doc.live) return;
      doc.transact(label, (tx) => applyPatch(tx, doc, ids, patch));
      return;
    }
    if (phase === "start") {
      if (this.#live?.open) this.#live.commit();
      if (doc.live) return;
      this.#live = doc.beginLive(label);
    }
    const live = this.#live;
    if (!live?.open) return;
    try {
      live.update((tx) => applyPatch(tx, doc, ids, patch));
    } catch (e) {
      if (phase === "end") this.#finish(true);
      throw e;
    }
    if (phase === "end") this.#finish(true);
  }

  /** End a drag: keep it (one undo step) or put everything back. */
  #finish(keep: boolean): void {
    const live = this.#live;
    this.#live = null;
    if (!live?.open) return;
    if (keep) live.commit();
    else live.cancel();
  }

  /** Keep a drag still open (the popover closed mid-drag). */
  settle(): void {
    this.#finish(true);
  }

  cancel(): void {
    this.#finish(false);
  }
}

// ---- paints ----

export type PaintKey = "fills" | "strokes";

/** The paints all `nodes` share, or null when they differ (Mixed). */
export function sharedPaints(nodes: readonly ReadonlyNode[], key: PaintKey): readonly Paint[] | null {
  const first = nodes[0];
  if (!first) return [];
  const list = plain<Paint[]>(first[key]);
  return nodes.every((n) => samePaints(plain<Paint[]>(n[key]), list)) ? list : null;
}

/** Replace paint `index` of each node (all share the same list) with `fn` of it. */
export const paintAt =
  (key: PaintKey, index: number, fn: (p: Paint) => Paint): Patcher =>
  (n) => {
    const list = plain<Paint[]>(n[key]);
    const p = list[index];
    if (!p) return null;
    return { [key]: list.map((q, i) => (i === index ? fn(q) : q)) };
  };

/**
 * A new paint on top of the list (Figma's +): grey for fills, black for
 * strokes. With Mixed paints it replaces them all ("Click + to replace mixed
 * content"). The first stroke on a closed shape goes inside, as in Figma.
 */
export function addPaint(key: PaintKey, mixed: boolean): Patcher {
  return (n) => {
    const fresh = solidPaint(key === "fills" ? DEFAULT_FILL : DEFAULT_STROKE);
    const list = mixed ? [] : plain<Paint[]>(n[key]);
    const patch: NodePatch = { [key]: [...list, fresh] };
    if (key === "strokes" && n.strokes.length === 0 && n.strokeAlign === undefined && strokesInsideByDefault(n.type)) patch.strokeAlign = "INSIDE";
    return patch;
  };
}

export const removePaint =
  (key: PaintKey, index: number): Patcher =>
  (n) => ({ [key]: plain<Paint[]>(n[key]).filter((_, i) => i !== index) });

/** Move paint `from` to `to` (array positions; the last paint is drawn on top). */
export const movePaint =
  (key: PaintKey, from: number, to: number): Patcher =>
  (n) => {
    const list = [...plain<Paint[]>(n[key])];
    if (from === to || !list[from] || to < 0 || to >= list.length) return null;
    const [p] = list.splice(from, 1);
    list.splice(to, 0, p as Paint);
    return { [key]: list };
  };

/** Set paints to exactly `paints` (a paste of paints, or a whole replacement). */
export const setPaints =
  (key: PaintKey, paints: readonly Paint[]): Patcher =>
  () => ({ [key]: [...paints] });

// ---- effects ----

/** The effects all `nodes` share, or null when they differ (Mixed). */
export function sharedEffects(nodes: readonly ReadonlyNode[]): readonly Effect[] | null {
  const first = nodes[0];
  if (!first) return [];
  const list = plain<Effect[]>(first.effects ?? []);
  const key = JSON.stringify(list);
  return nodes.every((n) => JSON.stringify(n.effects ?? []) === key) ? list : null;
}

/** An empty list is stored as no field at all: absent means no effects. */
const effectsPatch = (list: Effect[]): NodePatch => ({ effects: list.length ? list : undefined });

export const effectAt =
  (index: number, fn: (e: Effect) => Effect): Patcher =>
  (n) => {
    const list = plain<Effect[]>(n.effects ?? []);
    if (!list[index]) return null;
    return effectsPatch(list.map((e, i) => (i === index ? fn(e) : e)));
  };

export const addEffect =
  (effect: Effect, mixed: boolean): Patcher =>
  (n) =>
    effectsPatch([...(mixed ? [] : plain<Effect[]>(n.effects ?? [])), structuredClone(effect)]);

export const removeEffect =
  (index: number): Patcher =>
  (n) =>
    effectsPatch(plain<Effect[]>(n.effects ?? []).filter((_, i) => i !== index));
