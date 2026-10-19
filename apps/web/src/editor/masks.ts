/**
 * Masks (⌃⌘M "Use as mask", as in Figma): the bottom selected layer becomes
 * a mask (`isMask`) and the selection is grouped as "Mask group", so the mask
 * clips the layers above it. With only masks selected, it turns them back
 * into ordinary layers.
 */
import type { Document, Transaction } from "@illigma/core";
import type { NodeId } from "@illigma/format";
import { topmost } from "./edit";
import { documentOrder, wrapLayers } from "./layer-ops";

/** Run "Use as mask" on `ids`; returns the new selection, or null when nothing changed. */
export function toggleMask(tx: Transaction, doc: Document, ids: readonly NodeId[]): NodeId[] | null {
  const layers = documentOrder(doc, topmost(doc, ids)).filter((id) => doc.get(id)?.type !== "PAGE");
  if (!layers.length) return null;
  if (layers.every((id) => doc.get(id)?.isMask)) {
    for (const id of layers) {
      tx.set(id, "isMask", undefined);
      tx.set(id, "maskType", undefined);
    }
    return layers;
  }
  const bottom = layers[0] as NodeId;
  if (layers.length === 1) {
    tx.set(bottom, "isMask", true);
    return layers;
  }
  const group = wrapLayers(tx, doc, layers, "GROUP");
  if (!group) return null;
  tx.set(group, "name", "Mask group");
  tx.set(bottom, "isMask", true);
  return [group];
}

/** True if `id` is clipped by a mask below it among its siblings. */
export function isMasked(doc: Document, id: NodeId): boolean {
  const n = doc.get(id);
  if (!n?.parentId) return false;
  for (const s of doc.children(n.parentId)) {
    if (s.id === id) return false;
    if (s.isMask && s.visible) return true;
  }
  return false;
}
