import type { Document, ReadonlyNode } from "@illigma/core";
import { PaintList } from "./PaintList";

/** Layers without paints of their own: a group shows its children's. */
export const hasPaints = (n: ReadonlyNode) => n.type !== "GROUP" && n.type !== "PAGE";

/** The Fill card (Figma board "Card / Fill"): the selection's fills, top first. */
export function FillCard({ doc, nodes, readOnly, onError }: { doc: Document; nodes: readonly ReadonlyNode[]; readOnly: boolean; onError(e: unknown): void }) {
  if (!nodes.length || !nodes.every(hasPaints)) return null;
  return <PaintList doc={doc} nodes={nodes} paintKey="fills" noun="Fill" icon="paint-bucket" readOnly={readOnly} onError={onError} />;
}
