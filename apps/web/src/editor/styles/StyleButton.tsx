import { useState } from "react";
import {
  applyStyle,
  createStyleFromNode,
  deleteStyle,
  detachStyle,
  ROLE_TYPE,
  STYLE_REF,
  styleFromNode,
  styleUsage,
  updateStyle,
  type DeepReadonly,
  type Document,
  type ReadonlyNode,
  type StyleRole,
} from "@illigma/core";
import type { Style } from "@illigma/format";
import { Icon } from "../../ui/Icon";
import { Popover } from "../paint/Popover";
import { byFolder, edit, leafName } from "./common";
import { StylePreview } from "./StylePreview";

const NOUN: Record<StyleRole, string> = { fills: "Fill", strokes: "Stroke", text: "Text", effects: "Effect", grid: "Grid" };

/**
 * The "Style" button next to a card's title (Fill, Stroke, Typography,
 * Effects, Layout grid): shows the linked style's name, and opens the style
 * picker: apply a local style, detach, edit or delete the linked one, or
 * create a style from the selection's current values.
 */
export function StyleButton({ doc, nodes, role, readOnly, onError }: { doc: Document; nodes: readonly ReadonlyNode[]; role: StyleRole; readOnly: boolean; onError(e: unknown): void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  if (!nodes.length) return null;
  const key = STYLE_REF[role];
  const ids = nodes.map((n) => n.id);
  const linkedIds = nodes.map((n) => (n as unknown as Record<string, unknown>)[key] as string | undefined);
  const linked = linkedIds.every((x) => x === linkedIds[0]) ? linkedIds[0] : undefined;
  const styles = doc.styles().filter((s) => s.type === ROLE_TYPE[role]);
  const current = linked ? styles.find((s) => s.id === linked) : undefined;
  const noun = NOUN[role];
  const close = (refocus: boolean) => {
    const a = anchor;
    setAnchor(null);
    setEditing(null);
    if (refocus) a?.focus();
  };
  const create = () => {
    const name = newName.trim();
    if (!name || !nodes[0]) return;
    edit(
      doc,
      `Create ${noun.toLowerCase()} style`,
      (tx) => {
        const id = createStyleFromNode(tx, doc, ids[0] as string, role, name);
        for (const other of ids.slice(1)) applyStyle(tx, other, role, id, doc);
      },
      onError,
    );
    setNewName("");
  };
  const editingStyle = editing ? styles.find((s) => s.id === editing) : undefined;

  return (
    <>
      <button
        type="button"
        className={`style-button${current ? " is-linked" : ""}`}
        aria-label={current ? `${noun} style: ${current.name}. Change style` : `${noun} styles`}
        title={current ? current.name : `${noun} styles`}
        aria-haspopup="dialog"
        aria-expanded={!!anchor}
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
      >
        {current ? <span className="style-button-name">{leafName(current.name)}</span> : null}
        <Icon name="grid-2x2" />
      </button>
      {anchor && (
        <Popover anchor={anchor} label={`${noun} styles`} className="style-popover" onClose={close}>
          {editingStyle ? (
            <StyleEditor doc={doc} style={editingStyle} sourceNode={nodes[0] as ReadonlyNode} role={role} readOnly={readOnly} onError={onError} onDone={() => setEditing(null)} />
          ) : (
            <>
              <div className="picker-head">
                <h2 className="section-heading card-title">{noun} styles</h2>
                <button type="button" className="icon-button" aria-label="Close styles" title="Close (Esc)" onClick={() => close(true)}>
                  <Icon name="minus" />
                </button>
              </div>
              {current && (
                <div className="style-linked">
                  <StylePreview style={current} />
                  <span className="style-linked-name">{current.name}</span>
                  <button type="button" className="icon-button" aria-label={`Edit style ${current.name}`} title="Edit style" disabled={readOnly} onClick={() => setEditing(current.id)}>
                    <Icon name="pencil" />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Detach style"
                    title="Detach style (keep the values)"
                    disabled={readOnly}
                    onClick={() => edit(doc, "Detach style", (tx) => ids.forEach((id) => detachStyle(tx, id, role)), onError)}
                  >
                    <Icon name="unlink" />
                  </button>
                </div>
              )}
              {styles.length === 0 ? (
                <p className="muted">No {noun.toLowerCase()} styles in this file yet.</p>
              ) : (
                <div className="style-list" role="list" aria-label={`Local ${noun.toLowerCase()} styles`}>
                  {byFolder(styles).map((g) => (
                    <div key={g.folder} role="presentation">
                      {g.folder && <p className="style-folder">{g.folder}</p>}
                      {g.items.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          role="listitem"
                          className="style-option"
                          aria-current={s.id === linked || undefined}
                          disabled={readOnly}
                          title={s.description || s.name}
                          onClick={() => edit(doc, `Apply ${noun.toLowerCase()} style`, (tx) => ids.forEach((id) => applyStyle(tx, id, role, s.id, doc)), onError)}
                        >
                          <StylePreview style={s} />
                          <span>{leafName(s.name)}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              <form
                className="style-create"
                onSubmit={(e) => {
                  e.preventDefault();
                  create();
                }}
              >
                <div className="field">
                  <input className="field-input style-input" aria-label="New style name" placeholder="New style name (use / for folders)" value={newName} disabled={readOnly} onChange={(e) => setNewName(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-secondary" disabled={readOnly || !newName.trim()}>
                  Create style
                </button>
              </form>
            </>
          )}
        </Popover>
      )}
    </>
  );
}

/** Rename, describe, update from the selection, or delete a style. */
export function StyleEditor({
  doc,
  style,
  sourceNode,
  role,
  readOnly,
  onError,
  onDone,
}: {
  doc: Document;
  style: DeepReadonly<Style>;
  sourceNode?: ReadonlyNode;
  role?: StyleRole;
  readOnly: boolean;
  onError(e: unknown): void;
  onDone(): void;
}) {
  const [name, setName] = useState(style.name);
  const [description, setDescription] = useState(style.description ?? "");
  const used = styleUsage(doc, style.id);
  const save = () => {
    const patch: Record<string, unknown> = { name: name.trim() || style.name, description: description.trim() || undefined };
    edit(doc, "Edit style", (tx) => updateStyle(tx, doc, style.id, patch as never), onError);
  };
  return (
    <form
      className="style-editor"
      onSubmit={(e) => {
        e.preventDefault();
        save();
        onDone();
      }}
    >
      <div className="picker-head">
        <button type="button" className="icon-button" aria-label="Back" title="Back" onClick={onDone}>
          <Icon name="arrow-left" />
        </button>
        <h2 className="section-heading card-title">Edit style</h2>
      </div>
      <label className="style-label">
        Name
        <div className="field">
          <input className="field-input style-input" value={name} disabled={readOnly} onChange={(e) => setName(e.target.value)} />
        </div>
      </label>
      <label className="style-label">
        Description
        <div className="field">
          <input className="field-input style-input" value={description} disabled={readOnly} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </label>
      <p className="muted">
        Used by {used} layer{used === 1 ? "" : "s"}
      </p>
      <div className="style-editor-actions">
        {sourceNode && role && (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={readOnly}
            title="Replace the style's values with the selected layer's"
            onClick={() => {
              const next = styleFromNode(sourceNode, role, style.name, style.id) as unknown as Record<string, unknown>;
              const { id: _id, type: _type, name: _name, ...values } = next;
              edit(doc, "Update style", (tx) => updateStyle(tx, doc, style.id, values as never), onError);
            }}
          >
            Update from selection
          </button>
        )}
        <button
          type="button"
          className="btn btn-secondary"
          disabled={readOnly}
          onClick={() => {
            if (edit(doc, "Delete style", (tx) => deleteStyle(tx, doc, style.id), onError)) onDone();
          }}
        >
          Delete
        </button>
        <button type="submit" className="btn btn-primary" disabled={readOnly}>
          Save
        </button>
      </div>
    </form>
  );
}
