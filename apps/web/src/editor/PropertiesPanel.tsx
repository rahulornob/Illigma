import { useEffect, useState } from "react";
import type { Document } from "@illigma/core";
import type { NodeId } from "@illigma/format";

type Field = "x" | "y" | "width" | "height";

const FIELDS: { key: Field; letter: string; label: string; min?: number }[] = [
  { key: "x", letter: "X", label: "X position" },
  { key: "y", letter: "Y", label: "Y position" },
  { key: "width", letter: "W", label: "Width", min: 0.01 },
  { key: "height", letter: "H", label: "Height", min: 0.01 },
];

const fmt = (v: number) => String(Math.round(v * 100) / 100);

function NumberField({ doc, id, field, letter, label, min }: { doc: Document; id: NodeId; field: Field; letter: string; label: string; min?: number | undefined }) {
  const value = doc.get(id)?.[field] ?? 0;
  const [draft, setDraft] = useState(fmt(value));
  useEffect(() => setDraft(fmt(value)), [value]);

  const commit = () => {
    const parsed = Number.parseFloat(draft.replace(",", "."));
    if (!Number.isFinite(parsed)) {
      setDraft(fmt(value));
      return;
    }
    const next = min === undefined ? parsed : Math.max(min, parsed);
    if (next !== value) doc.transact(`Change ${label.toLowerCase()}`, (tx) => tx.set(id, field, next));
    setDraft(fmt(next));
  };

  const inputId = `prop-${field}`;
  return (
    <div className="field">
      <label className="field-letter" htmlFor={inputId} title={label}>
        {letter}
        <span className="sr-only"> {label}</span>
      </label>
      <input
        id={inputId}
        className="field-input"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            e.currentTarget.select();
          } else if (e.key === "Escape") {
            setDraft(fmt(value));
            e.currentTarget.blur();
          } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const step = (e.shiftKey ? 10 : 1) * (e.key === "ArrowUp" ? 1 : -1);
            const next = min === undefined ? value + step : Math.max(min, value + step);
            doc.transact(`Change ${label.toLowerCase()}`, (tx) => tx.set(id, field, next));
          }
        }}
      />
    </div>
  );
}

export function PropertiesPanel({ doc, pageId, selection }: { doc: Document; pageId: NodeId; selection: NodeId | null }) {
  const node = selection ? doc.get(selection) : undefined;
  const page = doc.get(pageId);

  return (
    <aside className="panel panel-right" aria-label="Properties">
      <div className="panel-tabs" role="presentation">
        <span className="panel-tab is-active">Design</span>
      </div>
      {node ? (
        <section className="card" aria-labelledby="position-heading">
          <div className="card-head">
            <h2 id="position-heading" className="section-heading">
              Position and size
            </h2>
            <span className="muted">{node.name}</span>
          </div>
          <div className="field-grid">
            {FIELDS.map((f) => (
              <NumberField key={`${node.id}-${f.key}`} doc={doc} id={node.id} field={f.key} letter={f.letter} label={f.label} min={f.min} />
            ))}
          </div>
        </section>
      ) : (
        <section className="card" aria-labelledby="page-heading">
          <div className="card-head">
            <h2 id="page-heading" className="section-heading">
              {page?.name ?? "Page"}
            </h2>
          </div>
          <p className="muted">Select a layer to see its position and size.</p>
        </section>
      )}
    </aside>
  );
}
