import { useEffect, useRef, useState, type ReactNode } from "react";

export const fmt = (v: number) => String(Math.round(v * 100) / 100);

/**
 * A number field for one value per selected layer. When the values differ it
 * is empty with "Mixed" as its placeholder (as in Figma); a typed value or an
 * arrow-key step then applies to each of them. Enter commits, Escape cancels,
 * ↑ ↓ step by 1 (Shift: 10).
 *
 * `prefix` is the field's letter or icon; `label` is its accessible name.
 * `text` replaces the shown value (e.g. "Auto" for an Auto gap) and
 * `onText` takes typed words the field understands ("auto"); it returns
 * false for text that is not a command.
 */
export function NumberField({
  id,
  label,
  prefix,
  values,
  min,
  readOnly = false,
  text,
  onText,
  suffix,
  onChange,
}: {
  id: string;
  label: string;
  prefix: ReactNode;
  values: readonly number[];
  min?: number | undefined;
  readOnly?: boolean;
  text?: string | undefined;
  onText?: ((typed: string) => boolean) | undefined;
  /** Shown after the value inside the field: a unit ("Hug") or a menu button. */
  suffix?: ReactNode;
  /** The new value for each target, from its current one. */
  onChange(next: (current: number) => number): void;
}) {
  const value = values[0] ?? 0;
  const mixed = values.some((v) => v !== value);
  const shown = text ?? (mixed ? "" : fmt(value));
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);
  // Escape blurs the field; the blur that follows must not commit the draft it just threw away.
  const cancelled = useRef(false);

  const clamp = (v: number) => (min === undefined ? v : Math.max(min, v));
  const apply = (next: (current: number) => number) => {
    if (readOnly) return;
    onChange((c) => clamp(next(c)));
  };

  const commit = () => {
    if (readOnly || draft === shown) return;
    const typed = draft.trim();
    if (onText?.(typed)) return;
    const parsed = Number.parseFloat(typed.replace(",", "."));
    if (!Number.isFinite(parsed)) {
      setDraft(shown);
      return;
    }
    apply(() => parsed);
    setDraft(fmt(clamp(parsed)));
  };

  return (
    <div className="field">
      <label className="field-letter" htmlFor={id} title={label}>
        {prefix}
        <span className="sr-only"> {label}</span>
      </label>
      <input
        id={id}
        className="field-input"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={draft}
        placeholder={mixed && text === undefined ? "Mixed" : undefined}
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
      {suffix}
    </div>
  );
}
