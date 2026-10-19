import { useEffect, useRef, useState } from "react";
import {
  addCollection,
  addMode,
  addVariable,
  deleteCollection,
  deleteMode,
  deleteVariable,
  renameCollection,
  renameMode,
  setDefaultMode,
  splitName,
  updateVariable,
  variableUsage,
  type DeepReadonly,
  type Document,
} from "@illigma/core";
import { VARIABLE_TYPES, type Color, type Variable, type VariableResolvedType, type VariableValue } from "@illigma/format";
import { Icon } from "../../ui/Icon";
import { MenuButton, type MenuEntry } from "../../ui/Menu";
import { parseHex } from "../paint/color";
import { cssOf, edit, showValue } from "../styles/common";

const TYPE_LABEL: Record<VariableResolvedType, string> = { COLOR: "Colour", FLOAT: "Number", STRING: "String", BOOLEAN: "Boolean" };

type ModeAction = "rename" | "default" | "duplicate" | "delete";

/**
 * The Variables manager (variables.md, Figma "Variables manager"): it takes
 * the canvas area. Collections and groups on the left; a table with one
 * column per mode; values typed in place (hex, number, text, true/false, or
 * `{name}` to alias another variable). Every change is one undo step (⌘Z
 * works here too). Esc or the back arrow returns to the canvas.
 */
export function VariablesManager({ doc, readOnly, onClose, onError }: { doc: Document; readOnly: boolean; onClose(): void; onError(e: unknown): void }) {
  const v = doc.variables();
  const [colId, setColId] = useState<string | null>(v.collections[0]?.id ?? null);
  const [group, setGroup] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const col = v.collections.find((c) => c.id === colId) ?? v.collections[0];
  useEffect(() => {
    root.current?.focus();
  }, []);
  const vars = col ? v.variables.filter((x) => x.collectionId === col.id) : [];
  const groups = [...new Set(vars.map((x) => splitName(x.name).folders.join("/")).filter(Boolean))];
  const shown = group ? vars.filter((x) => x.name.startsWith(group + "/")) : vars;
  const nameOf = (id: string) => v.variables.find((x) => x.id === id)?.name;

  const parseValue = (x: DeepReadonly<Variable>, text: string): VariableValue | null => {
    const t = text.trim();
    const alias = /^\{(.+)\}$/.exec(t);
    if (alias) {
      const target = v.variables.find((y) => y.name === alias[1] && y.resolvedType === x.resolvedType && y.id !== x.id);
      return target ? { type: "VARIABLE_ALIAS", id: target.id } : null;
    }
    switch (x.resolvedType) {
      case "COLOR":
        return parseHex(t);
      case "FLOAT": {
        const n = Number(t);
        return t !== "" && Number.isFinite(n) ? n : null;
      }
      case "STRING":
        return text;
      case "BOOLEAN":
        return t === "true" ? true : t === "false" ? false : null;
    }
  };

  const modeEntries: MenuEntry<ModeAction>[] = [
    { value: "rename", label: "Rename mode" },
    { value: "duplicate", label: "Duplicate mode" },
    { value: "default", label: "Set as default" },
    { kind: "separator" },
    { value: "delete", label: "Delete mode" },
  ];
  const typeEntries: MenuEntry<VariableResolvedType>[] = VARIABLE_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }));

  return (
    <div
      ref={root}
      className="variables-manager"
      role="dialog"
      aria-modal="true"
      aria-label="Variables"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
          return;
        }
        // Undo and redo still reach the editor; other keys stay in the manager.
        if (!(e.metaKey || e.ctrlKey)) e.stopPropagation();
      }}
    >
      <header className="vm-head">
        <button type="button" className="icon-button" aria-label="Back to canvas" title="Back to canvas (Esc)" onClick={onClose}>
          <Icon name="arrow-left" />
        </button>
        <h1 className="section-heading">Variables</h1>
      </header>
      {!col ? (
        <div className="vm-empty">
          <Icon name="hexagon" size={20} />
          <p>No variables in this file yet.</p>
          <p className="muted">Collections hold variables and their modes, such as Light and Dark.</p>
          <button type="button" className="btn btn-primary" disabled={readOnly} onClick={() => edit(doc, "Create collection", (tx) => setColId(addCollection(tx, doc, "Collection", "Mode 1").id), onError)}>
            Create collection
          </button>
        </div>
      ) : (
        <div className="vm-body">
          <nav className="vm-side" aria-label="Collections">
            <h2 className="vm-side-title">Collections</h2>
            {v.collections.map((c) => (
              <div key={c.id} className="vm-collection" aria-current={c.id === col.id || undefined}>
                <button type="button" className="vm-side-item" onClick={() => (setColId(c.id), setGroup(null))} onDoubleClick={() => {
                  const name = window.prompt("Rename collection", c.name);
                  if (name?.trim()) edit(doc, "Rename collection", (tx) => renameCollection(tx, doc, c.id, name.trim()), onError);
                }}>
                  {c.name}
                </button>
                {c.id === col.id && (
                  <button type="button" className="icon-button" aria-label={`Delete collection ${c.name}`} title="Delete collection" disabled={readOnly} onClick={() => edit(doc, "Delete collection", (tx) => deleteCollection(tx, doc, c.id), onError)}>
                    <Icon name="trash-2" size={12} />
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-ghost" disabled={readOnly} onClick={() => edit(doc, "Create collection", (tx) => setColId(addCollection(tx, doc, `Collection ${v.collections.length + 1}`).id), onError)}>
              <Icon name="plus" size={12} /> New collection
            </button>
            {groups.length > 0 && (
              <>
                <h2 className="vm-side-title">Groups</h2>
                <button type="button" className="vm-side-item" aria-current={group === null || undefined} onClick={() => setGroup(null)}>
                  All variables
                </button>
                {groups.map((g) => (
                  <button key={g} type="button" className="vm-side-item" aria-current={group === g || undefined} onClick={() => setGroup(g)}>
                    {g}
                  </button>
                ))}
              </>
            )}
          </nav>
          <div className="vm-main">
            <table className="vm-table" aria-label={`${col.name} variables`}>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  {col.modes.map((m) => (
                    <th key={m.modeId} scope="col">
                      <span className="vm-mode">
                        {m.name}
                        {m.modeId === col.defaultModeId && <span className="vm-badge">Default</span>}
                        <MenuButton<ModeAction>
                          label={`Mode ${m.name} options`}
                          className="icon-button"
                          disabled={readOnly}
                          entries={modeEntries.filter((e) => !("value" in e) || (e.value !== "delete" || col.modes.length > 1))}
                          onSelect={(a) => {
                            if (a === "rename") {
                              const name = window.prompt("Rename mode", m.name);
                              if (name?.trim()) edit(doc, "Rename mode", (tx) => renameMode(tx, doc, col.id, m.modeId, name.trim()), onError);
                            } else if (a === "default") edit(doc, "Set default mode", (tx) => setDefaultMode(tx, doc, col.id, m.modeId), onError);
                            else if (a === "duplicate") edit(doc, "Duplicate mode", (tx) => addMode(tx, doc, col.id, `${m.name} copy`, m.modeId), onError);
                            else edit(doc, "Delete mode", (tx) => deleteMode(tx, doc, col.id, m.modeId), onError);
                          }}
                        >
                          <Icon name="chevron-down" size={12} />
                        </MenuButton>
                      </span>
                    </th>
                  ))}
                  <th scope="col" className="vm-add-col">
                    <button type="button" className="icon-button" aria-label="Add mode" title="Add mode" disabled={readOnly || col.modes.length >= 40} onClick={() => edit(doc, "Add mode", (tx) => addMode(tx, doc, col.id, `Mode ${col.modes.length + 1}`), onError)}>
                      <Icon name="plus" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((x) => {
                  const used = variableUsage(doc, x.id);
                  return (
                    <tr key={x.id} data-variable={x.name}>
                      <th scope="row">
                        <span className="vm-name">
                          <span className="vm-type" title={TYPE_LABEL[x.resolvedType]}>
                            {x.resolvedType === "COLOR" ? "◐" : x.resolvedType === "FLOAT" ? "#" : x.resolvedType === "STRING" ? "T" : "◑"}
                          </span>
                          <input
                            key={x.name}
                            className="field-input vm-input"
                            aria-label={`Variable name ${x.name}`}
                            defaultValue={x.name}
                            disabled={readOnly}
                            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                            onBlur={(e) => {
                              const name = e.currentTarget.value.trim();
                              if (name && name !== x.name) edit(doc, "Rename variable", (tx) => updateVariable(tx, doc, x.id, { name }), onError);
                              else e.currentTarget.value = x.name;
                            }}
                          />
                        </span>
                      </th>
                      {col.modes.map((m) => {
                        const val = x.valuesByMode[m.modeId] as VariableValue | undefined;
                        const shownVal = showValue(val, nameOf);
                        const isAlias = typeof val === "object" && val !== null && "type" in val;
                        return (
                          <td key={m.modeId}>
                            <span className="vm-cell">
                              {x.resolvedType === "COLOR" && !isAlias && val !== undefined && <span className="style-swatch" style={{ background: cssOf(val as Color) }} aria-hidden="true" />}
                              {x.resolvedType === "BOOLEAN" && !isAlias ? (
                                <input
                                  type="checkbox"
                                  aria-label={`${x.name} in ${m.name}`}
                                  checked={val === true}
                                  disabled={readOnly}
                                  onChange={(e) => edit(doc, "Change variable", (tx) => updateVariable(tx, doc, x.id, { values: { [m.modeId]: e.target.checked } }), onError)}
                                />
                              ) : (
                                <input
                                  key={shownVal}
                                  className="field-input vm-input"
                                  aria-label={`${x.name} in ${m.name}`}
                                  defaultValue={shownVal}
                                  disabled={readOnly}
                                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                                  onBlur={(e) => {
                                    const text = e.currentTarget.value;
                                    if (text === shownVal) return;
                                    const next = parseValue(x, text);
                                    if (next === null) {
                                      e.currentTarget.value = shownVal;
                                      onError(new Error(`"${text}" isn't a ${TYPE_LABEL[x.resolvedType].toLowerCase()} value or a {variable} of that type`));
                                      return;
                                    }
                                    if (!edit(doc, "Change variable", (tx) => updateVariable(tx, doc, x.id, { values: { [m.modeId]: next } }), onError)) e.currentTarget.value = shownVal;
                                  }}
                                />
                              )}
                            </span>
                          </td>
                        );
                      })}
                      <td className="vm-add-col">
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Delete variable ${x.name}`}
                          title={used ? `Delete (used by ${used} layer${used === 1 ? "" : "s"}; they keep their values)` : "Delete variable"}
                          disabled={readOnly}
                          onClick={() => edit(doc, "Delete variable", (tx) => deleteVariable(tx, doc, x.id), onError)}
                        >
                          <Icon name="trash-2" size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <MenuButton<VariableResolvedType>
              label="Create variable"
              className="btn btn-secondary vm-create"
              disabled={readOnly}
              entries={typeEntries}
              onSelect={(t) => {
                const base = group ? `${group}/` : "";
                let i = vars.length + 1;
                while (vars.some((x) => x.name === `${base}${TYPE_LABEL[t].toLowerCase()}-${i}`)) i++;
                edit(doc, "Create variable", (tx) => addVariable(tx, doc, col.id, `${base}${TYPE_LABEL[t].toLowerCase()}-${i}`, t), onError);
              }}
            >
              <Icon name="plus" size={12} /> Create variable
            </MenuButton>
          </div>
        </div>
      )}
    </div>
  );
}
