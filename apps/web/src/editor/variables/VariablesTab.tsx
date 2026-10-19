import { Resolver, type Document, type ReadonlyNode } from "@illigma/core";
import type { Color } from "@illigma/format";
import { Icon } from "../../ui/Icon";
import { byFolder, cssOf, leafName, openVariables, showValue } from "../styles/common";

export interface PickerVariables {
  /** The layer whose mode the swatches show. */
  node: ReadonlyNode;
  /** The colour variable the paint is bound to now. */
  boundId: string | undefined;
  /** Bind to a variable, or detach (`null`, keeping the colour). */
  onBind(id: string | null): void;
}

/**
 * The colour picker's Variables tab (variables.md "Binding"): colour
 * variables grouped by collection and "/" groups, swatches showing the value
 * for the layer's current mode. Choosing one binds the paint.
 */
export function VariablesTab({ doc, vars, readOnly }: { doc: Document; vars: PickerVariables; readOnly: boolean }) {
  const r = new Resolver(doc);
  const all = doc.variables();
  const colors = all.variables.filter((v) => v.resolvedType === "COLOR" && (!v.scopes || v.scopes.length === 0 || v.scopes.some((s) => s === "ALL_SCOPES" || s.endsWith("FILL") || s === "STROKE_COLOR")));
  const nameOf = (id: string) => r.vars.get(id)?.name;
  return (
    <div className="picker-variables">
      {vars.boundId && (
        <div className="style-linked">
          <Icon name="hexagon" size={12} />
          <span className="style-linked-name">{nameOf(vars.boundId) ?? "Missing variable"}</span>
          <button type="button" className="icon-button" aria-label="Detach variable" title="Detach variable (keep the colour)" disabled={readOnly} onClick={() => vars.onBind(null)}>
            <Icon name="unlink" />
          </button>
        </div>
      )}
      {colors.length === 0 ? (
        <div className="picker-variables-empty">
          <p className="muted">No colour variables in this file yet.</p>
          <button type="button" className="btn btn-secondary" onClick={openVariables}>
            Open variables
          </button>
        </div>
      ) : (
        all.collections.map((c) => {
          const mine = colors.filter((v) => v.collectionId === c.id);
          if (!mine.length) return null;
          return (
            <div key={c.id} role="listbox" aria-label={`${c.name} colour variables`} className="style-list">
              <p className="style-folder">{c.name}</p>
              {byFolder(mine).map((g) => (
                <div key={g.folder} role="presentation">
                  {g.folder && <p className="style-folder">{g.folder}</p>}
                  {g.items.map((v) => {
                    const val = r.value(v.id, vars.node);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        role="option"
                        aria-selected={v.id === vars.boundId}
                        className="style-option"
                        disabled={readOnly}
                        onClick={() => vars.onBind(v.id)}
                        title={`${v.name} · ${showValue(val as never, nameOf)}`}
                      >
                        <span className="style-swatch" style={val && typeof val === "object" ? { background: cssOf(val as Color) } : {}} aria-hidden="true" />
                        <span>{leafName(v.name)}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}
