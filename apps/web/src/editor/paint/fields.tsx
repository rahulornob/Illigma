import { useRef, useState, type CSSProperties } from "react";

/**
 * A small text field inside a paint row or the colour picker (hex, opacity
 * %, stop position, angle): it shows the document's value, and a typed value
 * is committed with Enter or on blur (Escape throws it away). With `step`,
 * ↑ ↓ change the number by 1 (Shift: 10) and commit at once. `parse` turns
 * the typed text into a value to commit, or null to ignore it.
 */
export function InlineField({
  label,
  value,
  placeholder,
  className = "",
  readOnly = false,
  step,
  parse,
  onCommit,
  style,
}: {
  label: string;
  /** The text shown when nothing is being typed. */
  value: string;
  placeholder?: string | undefined;
  className?: string;
  readOnly?: boolean;
  /** Arrow keys step the number shown (`value` read as a number) by this much. */
  step?: number | undefined;
  parse(typed: string): number | string | null;
  onCommit(value: number | string): void;
  style?: CSSProperties;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);

  const commit = () => {
    if (draft === null || readOnly) return;
    const typed = draft.trim();
    setDraft(null);
    if (typed === value) return;
    const v = parse(typed);
    if (v !== null) onCommit(v);
  };

  return (
    <input
      type="text"
      className={`inline-field ${className}`}
      aria-label={label}
      title={label}
      value={draft ?? value}
      placeholder={placeholder}
      readOnly={readOnly}
      spellCheck={false}
      autoComplete="off"
      style={style}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => {
        if (cancelled.current) {
          cancelled.current = false;
          return;
        }
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
          e.currentTarget.select();
        } else if (e.key === "Escape" && draft !== null) {
          // The first Escape throws the typing away; the next one reaches the popover (closes it).
          e.preventDefault();
          e.stopPropagation();
          cancelled.current = true;
          setDraft(null);
          e.currentTarget.blur();
        } else if (step && (e.key === "ArrowUp" || e.key === "ArrowDown") && !readOnly) {
          e.preventDefault();
          e.stopPropagation();
          const now = Number.parseFloat((draft ?? value).replace(",", "."));
          if (!Number.isFinite(now)) return;
          setDraft(null);
          const v = parse(String(now + (e.shiftKey ? 10 : 1) * step * (e.key === "ArrowUp" ? 1 : -1)));
          if (v !== null) onCommit(v);
        }
      }}
    />
  );
}

/** "50%" or "50" → 50, kept within 0…100. */
export function parsePercent(typed: string): number | null {
  const n = Number.parseFloat(typed.replace("%", "").replace(",", "."));
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : null;
}

/** Shown percentages: whole numbers unless finer. */
export const pct = (fraction: number) => `${Math.round(fraction * 10_000) / 100}%`;
