import { useEffect, useRef, useState } from "react";
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

/**
 * One number for every selected layer. When the layers differ, the field is
 * empty with "Mixed" as its placeholder (as in Figma); a typed value or an
 * arrow-key step then applies to each of them.
 */
function NumberField({
  doc,
  ids,
  field,
  letter,
  label,
  min,
  readOnly,
}: {
  doc: Document;
  ids: readonly NodeId[];
  field: Field;
  letter: string;
  label: string;
  min?: number | undefined;
  readOnly: boolean;
}) {
  const values = ids.map((id) => doc.get(id)?.[field] ?? 0);
  const value = values[0] ?? 0;
  const mixed = values.some((v) => v !== value);
  const shown = mixed ? "" : fmt(value);
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);
  // Escape blurs the field; the blur that follows must not commit the draft it just threw away.
  const cancelled = useRef(false);

  const clamp = (v: number) => (min === undefined ? v : Math.max(min, v));
  const apply = (next: (current: number) => number) => {
    // Never during a canvas drag: it owns the document until it ends.
    if (doc.live) return;
    const changes = ids.map((id, i) => [id, clamp(next(values[i] ?? 0))] as const).filter(([, v], i) => v !== values[i]);
    if (changes.length) doc.transact(`Change ${label.toLowerCase()}`, (tx) => changes.forEach(([id, v]) => tx.set(id, field, v)));
  };

  const commit = () => {
    if (readOnly) return;
    const parsed = Number.parseFloat(draft.replace(",", "."));
    if (!Number.isFinite(parsed)) {
      setDraft(shown);
      return;
    }
    apply(() => parsed);
    setDraft(fmt(clamp(parsed)));
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
        placeholder={mixed ? "Mixed" : undefined}
        readOnly={readOnly}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (cancelled.current) {
            cancelled.current = false;
            return;
          }
          commit();
        }}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            e.currentTarget.select();
          } else if (e.key === "Escape") {
            cancelled.current = true;
            setDraft(shown);
            e.currentTarget.blur();
          } else if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !readOnly) {
            e.preventDefault();
            const step = (e.shiftKey ? 10 : 1) * (e.key === "ArrowUp" ? 1 : -1);
            apply((v) => v + step);
          }
        }}
      />
    </div>
  );
}

export function PropertiesPanel({
  doc,
  pageId,
  selection,
  readOnly = false,
}: {
  doc: Document;
  pageId: NodeId;
  selection: readonly NodeId[];
  readOnly?: boolean;
}) {
  const ids = selection.filter((id) => doc.has(id));
  const node = ids.length === 1 ? doc.get(ids[0] as NodeId) : undefined;
  const page = doc.get(pageId);

  return (
    <aside className="panel panel-right" aria-label="Properties">
      <div className="panel-tabs" role="presentation">
        <span className="panel-tab is-active">Design</span>
      </div>
      {ids.length ? (
        <section className="card" aria-labelledby="position-heading">
          <div className="card-head">
            <h2 id="position-heading" className="section-heading">
              Position and size
            </h2>
            <span className="muted">{node ? node.name : `${ids.length} layers`}</span>
          </div>
          <div className="field-grid">
            {FIELDS.map((f) => (
              <NumberField key={`${ids.join(",")}-${f.key}`} doc={doc} ids={ids} field={f.key} letter={f.letter} label={f.label} min={f.min} readOnly={readOnly} />
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
