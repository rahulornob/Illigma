/**
 * Component commands for the keyboard, menus and the Properties panel:
 * create component (⌥⌘K), combine as variants, detach instance (⌥⌘B), reset
 * overrides, go to main component, and inserting an instance from Assets.
 */
import {
  combineAsVariants,
  createComponent,
  createInstance,
  detachInstance,
  mainComponent,
  ownerInstance,
  resetOverrides,
  type Document,
} from "@illigma/core";
import type { NodeId } from "@illigma/format";

export type ComponentCommand = "create-component" | "combine-variants" | "detach-instance" | "reset-overrides";

export const COMPONENT_DRAG_TYPE = "application/x-illigma-component";

/** Which component commands apply to `selection`. */
export function componentCommandsFor(doc: Document, selection: readonly NodeId[]): Record<ComponentCommand, boolean> {
  const nodes = selection.map((id) => doc.get(id)).filter((n) => !!n);
  return {
    "create-component": nodes.length > 0 && nodes.every((n) => n.type !== "COMPONENT" && n.type !== "COMPONENT_SET" && n.type !== "PAGE"),
    "combine-variants": nodes.length > 1 && nodes.every((n) => n.type === "COMPONENT" && doc.get(n.parentId ?? "")?.type !== "COMPONENT_SET"),
    "detach-instance": nodes.some((n) => n.type === "INSTANCE" && ownerInstance(doc, n.id)?.id === n.id),
    "reset-overrides": nodes.some((n) => !!ownerInstance(doc, n.id)?.overrides || !!ownerInstance(doc, n.id)?.componentProperties),
  };
}

/** Run `cmd` on `selection` as one undo step. Returns the new selection, or null to keep it. */
export function runComponentCommand(doc: Document, cmd: ComponentCommand, selection: readonly NodeId[]): NodeId[] | null {
  if (doc.live) return null;
  switch (cmd) {
    case "create-component": {
      const ids = doc.transact("Create component", (tx) => createComponent(doc, tx, selection));
      return ids.length ? ids : null;
    }
    case "combine-variants": {
      const set = doc.transact("Combine as variants", (tx) => combineAsVariants(doc, tx, selection));
      return set ? [set] : null;
    }
    case "detach-instance": {
      const roots = selection.filter((id) => doc.get(id)?.type === "INSTANCE" && ownerInstance(doc, id)?.id === id);
      if (!roots.length) return null;
      doc.transact(roots.length === 1 ? "Detach instance" : `Detach ${roots.length} instances`, (tx) => {
        for (const id of roots) detachInstance(doc, tx, id);
      });
      return roots;
    }
    case "reset-overrides": {
      doc.transact("Reset overrides", (tx) => {
        for (const id of selection) {
          const owner = ownerInstance(doc, id);
          if (owner) resetOverrides(doc, tx, owner.id, id === owner.id ? undefined : id);
        }
      });
      return null;
    }
  }
}

/** Insert an instance of `componentId` centred at world point (x, y) on `pageId` (or in the frame under it). Returns its id. */
export function insertInstance(doc: Document, pageId: NodeId, componentId: NodeId, at: { x: number; y: number }): NodeId | null {
  const main = doc.get(componentId);
  if (main?.type !== "COMPONENT" || doc.live) return null;
  return doc.transact("Insert instance", (tx) => createInstance(doc, tx, componentId, pageId, { x: Math.round(at.x - main.width / 2), y: Math.round(at.y - main.height / 2) }));
}

/** The page holding `id`. */
export function pageOf(doc: Document, id: NodeId): NodeId | null {
  let n = doc.get(id);
  while (n && n.parentId) n = doc.get(n.parentId);
  return n?.type === "PAGE" ? n.id : null;
}

/** Main component of the selected instance (or of the instance a selected layer is in). */
export function mainOfSelection(doc: Document, id: NodeId): NodeId | null {
  const n = doc.get(id);
  if (n?.type === "INSTANCE") return mainComponent(doc, id)?.id ?? null;
  const owner = ownerInstance(doc, id);
  return owner ? (mainComponent(doc, owner.id)?.id ?? null) : null;
}
