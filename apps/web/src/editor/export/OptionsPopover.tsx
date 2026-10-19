import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import type { ExportSettings } from "@illigma/format";
import { ExportIcon } from "./icons";

const WIDTH = 248;
const GUTTER = 8;

/**
 * ⋯ on an export row: the format's options in a small popover
 * (docs/design/export.md). SVG: outline text (not available yet, so off and
 * disabled with a note), include "id" attribute, simplify stroke. All
 * formats: ignore overlapping layers (`contentsOnly`) and include the
 * bounding box (`useAbsoluteBounds`). JPG: quality.
 *
 * A non-modal dialog: Escape or a click outside closes it and focus goes back
 * to the button; Tab moves through it and closes it when focus leaves.
 */
export function OptionsPopover({
  setting,
  label,
  disabled,
  onChange,
}: {
  setting: ExportSettings;
  /** "Setting 1 options". */
  label: string;
  disabled: boolean;
  onChange(next: ExportSettings): void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const id = useId();
  const title = `${setting.format} options`;

  const close = (refocus: boolean) => {
    setOpen(false);
    setPos(null);
    if (refocus) button.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    const h = pop.current?.offsetHeight ?? 0;
    // To the left of the Properties panel's button, as in the design; below it when there is no room.
    let left = r.left - WIDTH - GUTTER;
    let top = Math.min(r.top - 8, window.innerHeight - h - GUTTER);
    if (left < GUTTER) {
      left = Math.max(GUTTER, Math.min(r.right - WIDTH, window.innerWidth - WIDTH - GUTTER));
      top = r.bottom + 4;
    }
    setPos({ left, top: Math.max(GUTTER, top) });
  }, [open]);

  useEffect(() => {
    if (!open || !pos) return;
    pop.current?.querySelector<HTMLElement>("input:not(:disabled)")?.focus();
  }, [open, pos]);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !button.current?.contains(t)) close(false);
    };
    window.addEventListener("pointerdown", outside, true);
    return () => window.removeEventListener("pointerdown", outside, true);
  }, [open]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    // The editor's shortcuts must not see keys meant for the popover.
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    }
  };

  const check = (key: string, text: string, value: boolean, set: (v: boolean) => void, note?: string, off = false) => (
    <label className="export-option" key={key}>
      <input type="checkbox" checked={value} disabled={disabled || off} onChange={(e) => set(e.target.checked)} />
      <span>
        {text}
        {note && <span className="export-option-note">{note}</span>}
      </span>
    </label>
  );

  const s = setting;
  const contentsOnly = s.contentsOnly !== false;
  const absolute = s.useAbsoluteBounds === true;

  return (
    <>
      <button
        ref={button}
        type="button"
        className="icon-button export-row-button"
        aria-label={label}
        title={title}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <ExportIcon name="ellipsis" />
      </button>
      {open && (
        <div
          ref={pop}
          id={id}
          className="export-popover"
          role="dialog"
          aria-label={title}
          style={pos ? { left: pos.left, top: pos.top } : { visibility: "hidden" }}
          onKeyDown={onKey}
          onBlur={(e) => {
            const next = e.relatedTarget as Node | null;
            if (next && !pop.current?.contains(next) && next !== button.current) close(false);
          }}
        >
          <div className="export-popover-title">{title}</div>
          {s.format === "SVG" && (
            <>
              {check("outline", "Outline text", false, () => {}, "Not available yet: text is written as text.", true)}
              {check("id", "Include “id” attribute", s.svgIdAttribute === true, (v) => onChange({ ...s, svgIdAttribute: v }))}
              {check("simplify", "Simplify stroke", s.svgSimplifyStroke !== false, (v) => onChange({ ...s, svgSimplifyStroke: v }))}
            </>
          )}
          {check("contents", "Ignore overlapping layers", contentsOnly, (v) => onChange({ ...s, contentsOnly: v }))}
          {check("bounds", "Include bounding box", absolute, (v) => onChange({ ...s, useAbsoluteBounds: v }))}
          {s.format === "JPG" && <QualityField setting={s} disabled={disabled} onChange={onChange} />}
          {s.format === "PNG" && <p className="export-option-note">PNG keeps transparency. Colour profiles aren't supported yet (sRGB).</p>}
        </div>
      )}
    </>
  );
}

function QualityField({ setting, disabled, onChange }: { setting: Extract<ExportSettings, { format: "PNG" | "JPG" }>; disabled: boolean; onChange(next: ExportSettings): void }) {
  const value = setting.quality ?? 90;
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const n = Math.round(Number(draft));
    setDraft(null);
    if (draft.trim() !== "" && Number.isFinite(n)) onChange({ ...setting, quality: Math.min(100, Math.max(0, n)) });
  };
  return (
    <label className="export-quality">
      <span>Quality</span>
      <span className="field">
        <input
          className="field-input"
          inputMode="numeric"
          value={draft ?? String(value)}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
          }}
        />
        <span className="field-unit">%</span>
      </span>
    </label>
  );
}
