import type { Document, ReadonlyNode } from "@illigma/core";
import { EffectsCard } from "./EffectsCard";
import { FillCard } from "./FillCard";
import { LayerCard } from "./LayerCard";
import { StrokeCard } from "./StrokeCard";

/**
 * The Appearance, Fill, Stroke and Effects cards, in Figma's order, for the
 * Properties panel. Keyed by the selection there, so an open picker closes
 * when the selection changes.
 */
export function PaintCards({ doc, nodes, readOnly, onError }: { doc: Document; nodes: readonly ReadonlyNode[]; readOnly: boolean; onError?: ((e: unknown) => void) | undefined }) {
  const report =
    onError ??
    ((e: unknown) => {
      throw e;
    });
  return (
    <>
      <LayerCard doc={doc} nodes={nodes} readOnly={readOnly} onError={report} />
      <FillCard doc={doc} nodes={nodes} readOnly={readOnly} onError={report} />
      <StrokeCard doc={doc} nodes={nodes} readOnly={readOnly} onError={report} />
      <EffectsCard doc={doc} nodes={nodes} readOnly={readOnly} onError={report} />
    </>
  );
}
