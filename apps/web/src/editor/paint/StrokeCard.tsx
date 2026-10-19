import type { Document, ReadonlyNode } from "@illigma/core";
import type { StrokeAlign, StrokeCap, StrokeJoin } from "@illigma/format";
import { STROKE_ALIGNS, STROKE_CAPS, STROKE_JOINS } from "@illigma/format";
import { MenuButton } from "../../ui/Menu";
import { NumberField } from "../../ui/NumberField";
import { hasPaints } from "./FillCard";
import { PaintIcon } from "./icons";
import { PaintList } from "./PaintList";
import { hasStrokeAlign, hasStrokeCaps, hasStrokeJoins, STROKE_CAP_LABEL, STROKE_JOIN_LABEL } from "./paints";

const ALIGN_LABEL: Record<StrokeAlign, string> = { INSIDE: "Inside", CENTER: "Center", OUTSIDE: "Outside" };

/** The one value all `values` share, or undefined (Mixed). */
const shared = <T,>(values: readonly T[]): T | undefined => (values.every((v) => v === values[0]) ? values[0] : undefined);

/** Largest stroke weight typed or stepped. */
const MAX_WEIGHT = 10_000;

/**
 * The Stroke card (Figma board "Card / Stroke", 20 · stroke expanded): the
 * stroke paints, then position (Inside, Center, Outside; lines are always
 * centred) and weight, and for lines and paths their caps and joins. The
 * first stroke added to a closed shape goes inside, as in Figma. Per-side
 * weights and dashes are not built yet.
 */
export function StrokeCard({ doc, nodes, readOnly, onError }: { doc: Document; nodes: readonly ReadonlyNode[]; readOnly: boolean; onError(e: unknown): void }) {
  if (!nodes.length || !nodes.every(hasPaints)) return null;
  const ids = nodes.map((n) => n.id);
  const set = (label: string, fn: (n: ReadonlyNode) => Record<string, unknown>) => {
    if (doc.live) return;
    try {
      doc.transact(label, (tx) => {
        for (const n of nodes) {
          const cur = doc.get(n.id);
          if (!cur) continue;
          for (const [k, v] of Object.entries(fn(cur))) tx.set(n.id, k as never, v as never);
        }
      });
    } catch (e) {
      onError(e);
    }
  };

  const align = shared(nodes.map((n) => n.strokeAlign ?? "CENTER"));
  const cap = shared(nodes.map((n) => n.strokeCap ?? "NONE"));
  const join = shared(nodes.map((n) => n.strokeJoin ?? "MITER"));
  const showAlign = nodes.every((n) => hasStrokeAlign(n.type));
  const showCaps = nodes.every((n) => hasStrokeCaps(n.type));
  const showJoins = nodes.every((n) => hasStrokeJoins(n.type));

  return (
    <PaintList doc={doc} nodes={nodes} paintKey="strokes" noun="Stroke" icon="square" readOnly={readOnly} onError={onError}>
      <div className="stroke-settings">
        {showAlign && (
          <MenuButton<StrokeAlign>
            label={`Stroke position: ${align ? ALIGN_LABEL[align] : "Mixed"}`}
            title="Stroke position"
            className="select-button"
            disabled={readOnly}
            entries={[{ kind: "heading", label: "Position" }, ...STROKE_ALIGNS.map((a) => ({ value: a, label: ALIGN_LABEL[a], checked: a === align }))]}
            onSelect={(a) => set(`Stroke ${ALIGN_LABEL[a].toLowerCase()}`, () => ({ strokeAlign: a }))}
          >
            <span className="select-button-label">{align ? ALIGN_LABEL[align] : "Mixed"}</span>
            <PaintIcon name="chevron-down" size={12} />
          </MenuButton>
        )}
        <NumberField
          key={ids.join(",")}
          id="prop-stroke-weight"
          label="Stroke weight"
          prefix={null}
          values={nodes.map((n) => n.strokeWeight)}
          min={0}
          max={MAX_WEIGHT}
          readOnly={readOnly}
          suffix={
            <span className="unit-suffix" aria-hidden="true">
              px
            </span>
          }
          onChange={(next) => {
            if (doc.live) return;
            doc.transact("Change stroke weight", (tx) => {
              for (const id of ids) {
                const n = doc.get(id);
                if (n) tx.set(id, "strokeWeight", next(n.strokeWeight));
              }
            });
          }}
        />
      </div>
      {(showCaps || showJoins) && (
        <div className="stroke-settings">
          {showCaps && (
            <MenuButton<StrokeCap>
              label={`Stroke ends: ${cap ? STROKE_CAP_LABEL[cap] : "Mixed"}`}
              title="Ends"
              className="select-button"
              disabled={readOnly}
              entries={[{ kind: "heading", label: "Ends" }, ...STROKE_CAPS.map((c) => ({ value: c, label: STROKE_CAP_LABEL[c], checked: c === cap }))]}
              onSelect={(c) => set("Change stroke ends", () => ({ strokeCap: c === "NONE" ? undefined : c }))}
            >
              <span className="select-button-label">Ends: {cap ? STROKE_CAP_LABEL[cap] : "Mixed"}</span>
              <PaintIcon name="chevron-down" size={12} />
            </MenuButton>
          )}
          {showJoins && (
            <MenuButton<StrokeJoin>
              label={`Stroke joins: ${join ? STROKE_JOIN_LABEL[join] : "Mixed"}`}
              title="Joins"
              className="select-button"
              disabled={readOnly}
              entries={[{ kind: "heading", label: "Joins" }, ...STROKE_JOINS.map((j) => ({ value: j, label: STROKE_JOIN_LABEL[j], checked: j === join }))]}
              onSelect={(j) => set("Change stroke joins", () => ({ strokeJoin: j === "MITER" ? undefined : j }))}
            >
              <span className="select-button-label">Joins: {join ? STROKE_JOIN_LABEL[join] : "Mixed"}</span>
              <PaintIcon name="chevron-down" size={12} />
            </MenuButton>
          )}
        </div>
      )}
    </PaintList>
  );
}
