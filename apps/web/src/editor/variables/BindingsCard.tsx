import { useState } from "react";
import { bindVariable, Resolver, type Document, type ReadonlyNode } from "@illigma/core";
import { BINDABLE_FIELDS, bindingType, type VariableResolvedType } from "@illigma/format";
import { Icon } from "../../ui/Icon";
import { cssOf, edit, showValue } from "../styles/common";

/** Field names as the panel shows them. */
export const FIELD_LABEL: Record<string, string> = {
  cornerRadius: "Corner radius",
  itemSpacing: "Gap",
  counterAxisSpacing: "Row gap",
  paddingLeft: "Padding left",
  paddingRight: "Padding right",
  paddingTop: "Padding top",
  paddingBottom: "Padding bottom",
  width: "Width",
  height: "Height",
  minWidth: "Min width",
  maxWidth: "Max width",
  minHeight: "Min height",
  maxHeight: "Max height",
  opacity: "Opacity",
  strokeWeight: "Stroke weight",
  fontSize: "Font size",
  characters: "Text content",
  visible: "Visibility",
};
const label = (k: string) => FIELD_LABEL[k] ?? k.replace(/^(fills|strokes)\.(\d+)$/, (_m, l: string, i: string) => `${l === "fills" ? "Fill" : "Stroke"} ${Number(i) + 1} colour`);

/** Fields a node can bind (text-only fields only on text, auto layout fields only on frames). */
function fieldsFor(n: ReadonlyNode): string[] {
  const frame = n.type === "FRAME" || n.type === "COMPONENT" || n.type === "INSTANCE";
  return Object.keys(BINDABLE_FIELDS).filter((k) => {
    if (k === "characters" || k === "fontSize") return n.type === "TEXT";
    if (k === "itemSpacing" || k === "counterAxisSpacing" || k.startsWith("padding")) return frame;
    return true;
  });
}

/**
 * Variables bound on the selection: each binding shows the variable (hexagon
 * and name, the "Bound to variable" state) with a Detach button; "Bind"
 * binds another field (corner radius, gap, padding, size, opacity, text,
 * visibility) to a variable of the matching type. Colour bindings are made
 * from the colour picker's Variables tab.
 */
export function BindingsCard({ doc, nodes, readOnly, onError }: { doc: Document; nodes: readonly ReadonlyNode[]; readOnly: boolean; onError(e: unknown): void }) {
  const [field, setField] = useState("");
  const vars = doc.variables().variables;
  if (!vars.length || !nodes.length) return null;
  const r = new Resolver(doc);
  const nameOf = (id: string) => r.vars.get(id)?.name;
  const first = nodes[0] as ReadonlyNode;
  const bound = Object.entries(first.boundVariables ?? {}).filter(([k, a]) => nodes.every((n) => n.boundVariables?.[k]?.id === a.id));
  const fields = fieldsFor(first).filter((k) => nodes.every((n) => fieldsFor(n).includes(k)) && !bound.some(([b]) => b === k));
  const type: VariableResolvedType | null = field ? bindingType(field) : null;
  const options = type ? vars.filter((v) => v.resolvedType === type) : [];
  const ids = nodes.map((n) => n.id);
  return (
    <section className="card" aria-labelledby="bindings-heading">
      <div className="card-head">
        <span className="card-icon">
          <Icon name="hexagon" />
        </span>
        <h2 id="bindings-heading" className="section-heading card-title">
          Variables
        </h2>
      </div>
      {bound.map(([k, a]) => {
        const val = r.value(a.id, first);
        return (
          <div key={k} className="binding-row" data-binding={k}>
            <span className="binding-field">{label(k)}</span>
            <span className="binding-chip" title={`Bound to ${nameOf(a.id) ?? "a missing variable"}`}>
              {val !== undefined && typeof val === "object" && "r" in val ? <span className="style-swatch" style={{ background: cssOf(val) }} aria-hidden="true" /> : <Icon name="hexagon" size={12} />}
              <span>{nameOf(a.id) ?? "Missing variable"}</span>
              <span className="muted">{showValue(val as never, nameOf)}</span>
            </span>
            <button type="button" className="icon-button" aria-label={`Detach variable from ${label(k)}`} title="Detach variable" disabled={readOnly} onClick={() => edit(doc, "Detach variable", (tx) => ids.forEach((id) => bindVariable(tx, doc, id, k, null)), onError)}>
              <Icon name="unlink" />
            </button>
          </div>
        );
      })}
      <div className="binding-add">
        <div className="field">
          <select className="field-input mode-select" aria-label="Field to bind" value={field} disabled={readOnly} onChange={(e) => setField(e.target.value)}>
            <option value="">Bind a field…</option>
            {fields.map((k) => (
              <option key={k} value={k}>
                {label(k)}
              </option>
            ))}
          </select>
        </div>
        {field && (
          <div className="field">
            <select
              className="field-input mode-select"
              aria-label={`Variable for ${label(field)}`}
              value=""
              disabled={readOnly || !options.length}
              onChange={(e) => {
                const id = e.target.value;
                if (id && edit(doc, `Bind ${label(field).toLowerCase()}`, (tx) => ids.forEach((n) => bindVariable(tx, doc, n, field, id)), onError)) setField("");
              }}
            >
              <option value="">{options.length ? "Choose a variable…" : `No ${type?.toLowerCase()} variables`}</option>
              {options.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} · {showValue(r.value(v.id, first) as never, nameOf)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </section>
  );
}
