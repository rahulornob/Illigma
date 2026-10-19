import { useState } from "react";
import { deleteStyle, moveStyle, renameStyle, type Document } from "@illigma/core";
import type { StyleType } from "@illigma/format";
import { Icon } from "../../ui/Icon";
import { byFolder, edit, leafName, openVariables } from "./common";
import { StyleEditor } from "./StyleButton";
import { StylePreview } from "./StylePreview";

const SECTIONS: { type: StyleType; title: string }[] = [
  { type: "TEXT", title: "Text styles" },
  { type: "PAINT", title: "Color styles" },
  { type: "EFFECT", title: "Effect styles" },
  { type: "GRID", title: "Grid styles" },
];

/**
 * The file's local styles, shown in the Properties panel when nothing is
 * selected (as Figma does): grouped by type and by "/" folders. Rename with
 * a double-click (or Enter on a focused name), move up or down, edit, delete.
 */
export function LocalStylesCard({ doc, readOnly, onError }: { doc: Document; readOnly: boolean; onError(e: unknown): void }) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const all = doc.styles();
  const vars = doc.variables();
  const editingStyle = editing ? all.find((s) => s.id === editing) : undefined;
  return (
    <section className="card" aria-labelledby="local-styles-heading">
      <div className="card-head">
        <h2 id="local-styles-heading" className="section-heading card-title">
          Local styles
        </h2>
        <button type="button" className="btn btn-secondary" onClick={openVariables} title="Open the Variables manager">
          Variables{vars.variables.length ? ` · ${vars.variables.length}` : ""}
        </button>
      </div>
      {editingStyle && <StyleEditor doc={doc} style={editingStyle} readOnly={readOnly} onError={onError} onDone={() => setEditing(null)} />}
      {all.length === 0 && <p className="muted">No local styles yet. Select a layer and use the style button on its Fill, Stroke, Typography or Effects card to create one.</p>}
      {SECTIONS.map(({ type, title }) => {
        const styles = all.filter((s) => s.type === type);
        if (!styles.length) return null;
        return (
          <div key={type} className="style-section">
            <h3 className="style-section-title">{title}</h3>
            {byFolder(styles).map((g) => (
              <div key={g.folder} role="list" aria-label={g.folder ? `${title}: ${g.folder}` : title}>
                {g.folder && <p className="style-folder">{g.folder}</p>}
                {g.items.map((s) => {
                  const at = all.findIndex((x) => x.id === s.id);
                  return (
                    <div key={s.id} role="listitem" className="style-row" data-style-id={s.id}>
                      <StylePreview style={s} />
                      {renaming === s.id ? (
                        <input
                          className="field-input style-rename"
                          aria-label={`Rename ${s.name}`}
                          defaultValue={s.name}
                          autoFocus
                          onBlur={(e) => {
                            const name = e.currentTarget.value.trim();
                            if (name && name !== s.name) edit(doc, "Rename style", (tx) => renameStyle(tx, doc, s.id, name), onError);
                            setRenaming(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") {
                              e.currentTarget.value = s.name;
                              e.currentTarget.blur();
                            }
                            e.stopPropagation();
                          }}
                        />
                      ) : (
                        <button type="button" className="style-row-name" title={`${s.name}${s.description ? ` — ${s.description}` : ""} (double-click to rename)`} disabled={readOnly} onDoubleClick={() => setRenaming(s.id)} onKeyDown={(e) => e.key === "F2" && setRenaming(s.id)}>
                          {leafName(s.name)}
                        </button>
                      )}
                      <button type="button" className="icon-button" aria-label={`Edit ${s.name}`} title="Edit style" disabled={readOnly} onClick={() => setEditing(s.id)}>
                        <Icon name="pencil" size={12} />
                      </button>
                      <button type="button" className="icon-button" aria-label={`Move ${s.name} up`} title="Move up" disabled={readOnly || at === 0} onClick={() => edit(doc, "Reorder styles", (tx) => moveStyle(tx, doc, s.id, at - 1), onError)}>
                        <Icon name="arrow-up" size={12} />
                      </button>
                      <button type="button" className="icon-button" aria-label={`Move ${s.name} down`} title="Move down" disabled={readOnly || at === all.length - 1} onClick={() => edit(doc, "Reorder styles", (tx) => moveStyle(tx, doc, s.id, at + 1), onError)}>
                        <Icon name="arrow-down" size={12} />
                      </button>
                      <button type="button" className="icon-button" aria-label={`Delete ${s.name}`} title="Delete style (layers keep their values)" disabled={readOnly} onClick={() => edit(doc, "Delete style", (tx) => deleteStyle(tx, doc, s.id), onError)}>
                        <Icon name="trash-2" size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })}
    </section>
  );
}
