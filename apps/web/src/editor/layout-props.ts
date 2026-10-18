/**
 * How the inspector writes layout: auto layout settings, sizing, constraints
 * and typed position and size values. Each call is one `Document.transact`
 * (one undo step). Layout itself runs in the document's normalizer
 * (`DOCUMENT_OPTIONS` in `layout.ts`) at the end of that transaction, so the
 * canvas shows the reflowed layers at once and a single undo reverts the
 * setting and everything it moved.
 */

import type { Document, Transaction } from "@illigma/core";
import type { LayoutFields, NodeId } from "@illigma/format";
import { setBoxField } from "./layout";

/** Layout fields the inspector sets. `undefined` removes the field (its default applies). */
export type LayoutPatch = { [K in keyof LayoutFields]?: LayoutFields[K] | undefined };

/** Run `fn` as one undo step. Does nothing while a canvas drag owns the document. */
export function layoutTransact<T>(doc: Document, label: string, fn: (tx: Transaction) => T): T | undefined {
  if (doc.live) return undefined;
  return doc.transact(label, fn);
}

/** Where a panel reports an edit the document refused (rolled back: nothing changed). */
export type OnEditError = (error: unknown) => void;

/** Run a panel command; an edit the document refuses goes to `onError` instead of being thrown (without one, it throws). */
export function guard<T>(onError: OnEditError | undefined, fn: () => T): T | undefined {
  try {
    return fn();
  } catch (e) {
    if (!onError) throw e;
    onError(e);
    return undefined;
  }
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
 * Typed X, Y, W or H values, one per id, as one undo step. Through
 * `setBoxField`: a size resizes (children follow their constraints, Hug or
 * Fill becomes Fixed); X and Y of a layer in an auto layout flow stay its parent's.
 */
export function setBoxFields(doc: Document, ids: readonly NodeId[], field: BoxField, values: readonly number[], label: string): void {
  const changes = ids.map((id, i) => [id, values[i]] as const).filter(([id, v]) => v !== undefined && doc.get(id)?.[field] !== v);
  if (changes.length) layoutTransact(doc, label, (tx) => changes.forEach(([id, v]) => setBoxField(tx, doc, id, field, v as number)));
}
