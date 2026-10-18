/**
 * The one way the inspector writes layout: auto layout settings, sizing,
 * constraints, and typed position and size values. Each call is one
 * `Document.transact` (one undo step), and the layout engine runs inside that
 * same transaction, so the canvas shows the reflowed layers at once and a
 * single undo reverts the setting and everything it moved.
 *
 * `layoutTransact` is the only place that calls `relayout`. When relayout is
 * wired into the edit path for every transaction, this call becomes a no-op
 * (relayout of an up-to-date layout changes nothing) and can be dropped here.
 */

import type { Document, Transaction } from "@illigma/core";
import type { LayoutFields, NodeId } from "@illigma/format";
import { changedIds, relayout, resize } from "@illigma/layout";

/** Layout fields the inspector sets. `undefined` removes the field (its default applies). */
export type LayoutPatch = { [K in keyof LayoutFields]?: LayoutFields[K] | undefined };

/**
 * Run `fn` as one undo step, then bring auto layout and constraints up to
 * date for everything it changed, in the same step. Does nothing while a
 * canvas drag owns the document.
 */
export function layoutTransact<T>(doc: Document, label: string, fn: (tx: Transaction) => T): T | undefined {
  if (doc.live) return undefined;
  return doc.transact(label, (tx) => {
    const result = fn(tx);
    for (const c of relayout(doc, changedIds(tx.ops))) tx.set(c.id, c.key, c.value);
    return result;
  });
}

/** Apply `patch` (or a patch per node) to each of `ids`, as one undo step. */
export function setLayoutProps(
  doc: Document,
  ids: readonly NodeId[],
  patch: LayoutPatch | ((id: NodeId) => LayoutPatch),
  label = "Change auto layout",
): void {
  layoutTransact(doc, label, (tx) => {
    for (const id of ids) {
      if (!doc.has(id)) continue;
      const p = typeof patch === "function" ? patch(id) : patch;
      for (const [key, value] of Object.entries(p)) tx.set(id, key as keyof LayoutFields, value as never);
    }
  });
}

export type BoxField = "x" | "y" | "width" | "height";

/**
 * Typed position or size values (the X, Y, W and H fields), one per id.
 * A size change works like Figma's resize: children follow their constraints
 * and auto layout reflows. Typing a size on a Hug or Fill axis makes it Fixed.
 */
export function setBoxField(doc: Document, ids: readonly NodeId[], field: BoxField, values: readonly number[], label: string): void {
  layoutTransact(doc, label, (tx) => {
    ids.forEach((id, i) => {
      const n = doc.get(id);
      const v = values[i];
      if (!n || v === undefined || n[field] === v) return;
      if (field === "x" || field === "y") {
        tx.set(id, field, v);
        return;
      }
      const sizing = field === "width" ? "layoutSizingHorizontal" : "layoutSizingVertical";
      if (n[sizing] === "HUG" || n[sizing] === "FILL" || (n[sizing] === undefined && hugsByDefault(doc, id, field))) tx.set(id, sizing, "FIXED");
      for (const c of resize(doc, id, { [field]: v })) tx.set(c.id, c.key, c.value);
    });
  });
}

/** An auto layout frame with no explicit sizing hugs on its AUTO axes (the format's default). */
function hugsByDefault(doc: Document, id: NodeId, axis: "width" | "height"): boolean {
  const n = doc.get(id);
  if (!n || (n.layoutMode !== "HORIZONTAL" && n.layoutMode !== "VERTICAL")) return false;
  const primary = (n.layoutMode === "HORIZONTAL") === (axis === "width");
  return (primary ? n.primaryAxisSizingMode : n.counterAxisSizingMode) !== "FIXED";
}
