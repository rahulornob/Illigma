import type { Document, ReadonlyNode } from "@illigma/core";
import type { BlendMode } from "@illigma/format";
import { MenuButton, type MenuEntry } from "../../ui/Menu";
import { fmt, NumberField } from "../../ui/NumberField";
import { PaintIcon } from "./icons";
import { BLEND_LABEL, BLEND_MENU, isContainer, layerBlend, storedLayerBlend } from "./paints";

/**
 * The Appearance card (Figma board "Card / Appearance"): the layer's
 * opacity, its blend mode (Figma's list; frames and groups default to Pass
 * through, other layers to Normal) and visibility. Each change is one undo step.
 */
export function LayerCard({ doc, nodes, readOnly, onError }: { doc: Document; nodes: readonly ReadonlyNode[]; readOnly: boolean; onError(e: unknown): void }) {
  if (!nodes.length || nodes.some((n) => n.type === "PAGE")) return null;
  const ids = nodes.map((n) => n.id);

  const blends = nodes.map(layerBlend);
  const blend = blends.every((b) => b === blends[0]) ? blends[0] : undefined;
  const containers = nodes.every((n) => isContainer(n.type));
  const entries: MenuEntry<BlendMode>[] = [{ kind: "heading", label: "Layer blend" }];
  for (const m of BLEND_MENU) {
    if (m === "PASS_THROUGH" && !containers) continue;
    if (m === null) entries.push({ kind: "separator" });
    else entries.push({ value: m, label: BLEND_LABEL[m], checked: m === blend });
  }
  const visible = nodes.every((n) => n.visible);

  const transact = (label: string, fn: (n: ReadonlyNode) => Record<string, unknown>) => {
    if (doc.live) return;
    try {
      doc.transact(label, (tx) => {
        for (const id of ids) {
          const n = doc.get(id);
          if (!n) continue;
          for (const [k, v] of Object.entries(fn(n))) tx.set(id, k as never, v as never);
        }
      });
    } catch (e) {
      onError(e);
    }
  };

  return (
    <section className="card" aria-labelledby="appearance-heading">
      <div className="card-head">
        <span className="card-icon">
          <PaintIcon name="droplet" />
        </span>
        <h2 id="appearance-heading" className="section-heading card-title">
          Appearance
        </h2>
        <MenuButton<BlendMode>
          label={`Layer blend mode: ${blend ? BLEND_LABEL[blend] : "Mixed"}`}
          title={`Blend mode: ${blend ? BLEND_LABEL[blend] : "Mixed"}`}
          className="icon-button"
          disabled={readOnly}
          entries={entries}
          onSelect={(m) => transact(`Blend mode ${BLEND_LABEL[m].toLowerCase()}`, (n) => ({ blendMode: storedLayerBlend(n.type, m) }))}
        >
          <PaintIcon name="blend" />
        </MenuButton>
        <button
          type="button"
          className="icon-button"
          aria-label={visible ? "Hide layer" : "Show layer"}
          title={visible ? "Hide layer" : "Show layer"}
          disabled={readOnly}
          onClick={() => transact(visible ? "Hide layer" : "Show layer", () => ({ visible: !visible }))}
        >
          <PaintIcon name={visible ? "eye" : "eye-off"} />
        </button>
      </div>
      <div className="field-grid">
        <NumberField
          key={ids.join(",")}
          id="prop-opacity"
          label="Layer opacity"
          prefix={<PaintIcon name="droplet" />}
          values={nodes.map((n) => Math.round(n.opacity * 10_000) / 100)}
          min={0}
          max={100}
          readOnly={readOnly}
          suffix={
            <span className="unit-suffix" aria-hidden="true">
              %
            </span>
          }
          onChange={(next) => {
            if (doc.live) return;
            doc.transact("Change opacity", (tx) => {
              for (const id of ids) {
                const n = doc.get(id);
                if (n) tx.set(id, "opacity", Math.round(next(Number(fmt(n.opacity * 100))) * 100) / 10_000);
              }
            });
          }}
        />
      </div>
    </section>
  );
}
