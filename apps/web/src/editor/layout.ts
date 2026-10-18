/**
 * The layout engine wired into editing. Every document the app opens gets
 * `DOCUMENT_OPTIONS`, whose normalizer runs `relayout` at the end of every
 * edit, inside the edit's own transaction or drag step: the document always
 * shows laid-out positions, one undo reverts an edit and its layout, and undo
 * and redo restore exact values without laying out again. Replayed edits
 * (recovery) are laid out too.
 *
 * Edits that need more than "lay out what changed" go through the helpers
 * here: a resize (children follow their constraints, from the size before the
 * resize) and the Hug/Fill → Fixed switch when a layer's size is set by hand.
 */

import type { Document, DocumentOptions, Normalizer, ReadonlyNode, Transaction } from "@illigma/core";
import type { NodeId } from "@illigma/format";
import { changedIds, isAutoLayout, isInFlow, layoutSizing, relayout, resize, type Box, type LayoutChange } from "@illigma/layout";

/** Apply layout's changes inside the running transaction. */
export function applyLayout(tx: Transaction, changes: readonly LayoutChange[]): void {
  for (const c of changes) tx.set(c.id, c.key, c.value);
}

/** Lays out whatever an edit changed, inside the edit (see `Normalizer` in `@illigma/core`). */
export const layoutNormalizer: Normalizer = (doc, tx, ops) => {
  const ids = changedIds(ops);
  if (ids.length) applyLayout(tx, relayout(doc, ids));
};

/** Options for every document the editor opens or creates. */
export const DOCUMENT_OPTIONS: DocumentOptions = Object.freeze({ normalize: layoutNormalizer });

/** The auto layout frame `id` flows in, or null: a top-level layer, a plain parent, or a hidden or absolute-positioned child. */
export function flowParent(doc: Document, id: NodeId): ReadonlyNode | null {
  const n = doc.get(id);
  const parent = n?.parentId ? doc.get(n.parentId) : undefined;
  return n && parent && isAutoLayout(parent) && isInFlow(n) ? parent : null;
}

/** True if `id` takes part in an auto layout flow: its position comes from its parent, not from x and y. */
export const inFlow = (doc: Document, id: NodeId): boolean => flowParent(doc, id) !== null;

const SIZING_KEY = { width: "layoutSizingHorizontal", height: "layoutSizingVertical" } as const;

/**
 * Give `id` a new box, as Figma's resize does: its children follow their
 * constraints from its old size (unless `constraints` is false: ⌘/Ctrl held),
 * and any auto layout around it reflows. A Hug or Fill axis the new box
 * changes switches to Fixed first (interactions.md: "Resize in auto layout").
 * A layer in an auto layout flow keeps the position its parent gives it.
 */
export function resizeLayer(tx: Transaction, doc: Document, id: NodeId, box: Partial<Box>, opts: { constraints?: boolean } = {}): void {
  const n = doc.get(id);
  if (!n) return;
  const flowing = inFlow(doc, id);
  for (const axis of ["width", "height"] as const) {
    const size = box[axis];
    if (size === undefined || size === n[axis] || layoutSizing(n, axis, flowing) === "FIXED") continue;
    const key = SIZING_KEY[axis];
    // An explicit Hug or Fill (and any setting on a plain layer) is the field itself.
    if (n[key] !== undefined || !isAutoLayout(n)) tx.set(id, key, "FIXED");
    if (isAutoLayout(n)) {
      // An auto layout frame hugging through its sizing mode (Figma's primary/counter axis "AUTO").
      const primary = (n.layoutMode === "HORIZONTAL") === (axis === "width");
      const mode = primary ? "primaryAxisSizingMode" : "counterAxisSizingMode";
      if ((n[mode] ?? "AUTO") === "AUTO") tx.set(id, mode, "FIXED");
    }
  }
  applyLayout(tx, resize(doc, id, box, opts.constraints === false ? { constraints: false } : {}));
}

/**
 * Set X, Y, W or H from the Properties panel. Width and height resize (with
 * constraints and the Fixed switch above). X and Y of a layer in an auto
 * layout flow are its parent's to set, so they change nothing.
 */
export function setBoxField(tx: Transaction, doc: Document, id: NodeId, field: keyof Box, value: number): void {
  if (field === "x" || field === "y") {
    if (!inFlow(doc, id)) tx.set(id, field, value);
    return;
  }
  resizeLayer(tx, doc, id, { [field]: value });
}
