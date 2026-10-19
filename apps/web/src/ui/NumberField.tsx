import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export const fmt = (v: number) => String(Math.round(v * 100) / 100);

/**
 * Sane ranges for typed values, well inside what the file format accepts
 * (any finite number): layout adds positions, sizes, padding and gaps
 * together, and a sum must stay finite.
 */
export const LIMITS = {
  /** X and Y, either way. */
  position: 1e6,
  /** W and H. */
  size: 1e6,
  /** Padding, gap, corner radius. */
  spacing: 1e5,
} as const;

/** Keep `v` within `min`…`max` (either may be absent). */
export function clampTo(v: number, min: number | undefined, max: number | undefined): number {
  return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
}

/**
 * What was typed into a number field, as Figma reads it: a number or simple
 * maths (`12+4`, `3*4`, `100/3`, `(2+3)*4`; × ÷ and "x" between numbers
 * work too; "," as the decimal mark; a trailing "px" or "%" is ignored).
 * Starting with + * × / or ÷ makes it relative to each layer's own value
 * (`+2` adds 2 to each, `*2` doubles each), so it works on Mixed values.
 * A leading − is a negative number, as in Figma. Null for anything else.
 */
export type TypedValue = { kind: "set"; value: number } | { kind: "relative"; op: "+" | "*" | "/"; value: number };

export function parseTyped(typed: string): TypedValue | null {
  let t = typed.trim().replace(/\s+/g, "").replace(/(px|%)$/i, "").replace(/×/g, "*").replace(/÷/g, "/");
  // "x" is a times sign only between numbers (2x3); a "2x" scale isn't a number field's.
  t = t.replace(/(?<=[\d.)])x(?=[\d.(])/gi, "*");
  // A decimal comma (1,5), never a thousands separator inside maths.
  t = t.replace(/(\d),(\d)/g, "$1.$2");
  if (!t) return null;
  let op: "+" | "*" | "/" | null = null;
  if (t[0] === "+" || t[0] === "*" || t[0] === "/") {
    op = t[0] as "+" | "*" | "/";
    t = t.slice(1);
  }
  const value = evaluate(t);
  if (value === null || !Number.isFinite(value)) return null;
  return op ? { kind: "relative", op, value } : { kind: "set", value };
}

/** `+ - * /` and parentheses over decimal numbers, or null if it isn't that. */
function evaluate(src: string): number | null {
  let i = 0;
  const peek = () => src[i];
  const number = (): number | null => {
    const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i));
    if (!m) return null;
    i += m[0].length;
    return Number(m[0]);
  };
  const factor = (depth: number): number | null => {
    if (depth > 32) return null;
    if (peek() === "-" || peek() === "+") {
      const sign = src[i++] === "-" ? -1 : 1;
      const v = factor(depth + 1);
      return v === null ? null : sign * v;
    }
    if (peek() === "(") {
      i++;
      const v = sum(depth + 1);
      if (v === null || peek() !== ")") return null;
      i++;
      return v;
    }
    return number();
  };
  const product = (depth: number): number | null => {
    let v = factor(depth);
    while (v !== null && (peek() === "*" || peek() === "/")) {
      const o = src[i++];
      const r = factor(depth);
      if (r === null) return null;
      v = o === "*" ? v * r : v / r;
    }
    return v;
  };
  const sum = (depth: number): number | null => {
    let v = product(depth);
    while (v !== null && (peek() === "+" || peek() === "-")) {
      const o = src[i++];
      const r = product(depth);
      if (r === null) return null;
      v = o === "+" ? v + r : v - r;
    }
    return v;
  };
  const v = sum(0);
  return v !== null && i === src.length ? v : null;
}

/** Apply a typed value to a layer's `current` value. */
export function typedResult(t: TypedValue, current: number): number {
  if (t.kind === "set") return t.value;
  return t.op === "+" ? current + t.value : t.op === "*" ? current * t.value : current / t.value;
}

/** The words shown when a value can't be applied: the reason, kept short. */
const problemOf = (e: unknown) => {
  const text = e instanceof Error && e.message ? e.message : String(e);
  return `Couldn't apply that value. ${text.length > 120 ? `${text.slice(0, 117)}…` : text}`;
};

/**
 * A number field for one value per selected layer. When the values differ it
 * is empty with "Mixed" as its placeholder (as in Figma); a typed value or an
 * arrow-key step then applies to each of them. Enter commits, Escape cancels,
 * ↑ ↓ step by 1 (Shift: 10). Values stay within `min`…`max`.
 *
 * The field shows the document's value except while something is typed into
 * it: an arrow step writes the document directly, so a blur right after it
 * has nothing to commit (no stale value written back, one undo step). An
 * edit the document refuses leaves the value as it was and says why, in an
 * alert under the field.
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
  max,
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
  max?: number | undefined;
  readOnly?: boolean;
  text?: string | undefined;
  onText?: ((typed: string) => boolean) | undefined;
  /** Shown after the value inside the field: a unit ("Hug") or a menu button. */
  suffix?: ReactNode;
  /** The new value for each target, from its current one (read from the document when the change is made). */
  onChange(next: (current: number) => number): void;
}) {
  const value = values[0] ?? 0;
  const mixed = values.some((v) => v !== value);
  const shown = text ?? (mixed ? "" : fmt(value));
  /** What is typed and not yet committed, or null: the field shows the document's value. */
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Escape blurs the field; the blur that follows must not commit the draft it just threw away.
  const cancelled = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const selectOnRender = useRef(false);
  useLayoutEffect(() => {
    if (!selectOnRender.current) return;
    selectOnRender.current = false;
    if (document.activeElement === input.current) input.current?.select();
  });

  /** Run a change; one the document refuses leaves everything as it was and shows why. */
  const attempt = (change: () => void) => {
    try {
      change();
      setError(null);
    } catch (e) {
      setError(problemOf(e));
    }
  };

  const apply = (next: (current: number) => number) => {
    if (readOnly) return;
    attempt(() => onChange((c) => clampTo(next(c), min, max)));
  };

  const commit = () => {
    if (readOnly || draft === null) return;
    const typed = draft.trim();
    setDraft(null);
    if (typed === shown) return;
    let handled = false;
    if (onText) attempt(() => (handled = onText(typed)));
    if (handled) return;
    if (!typed) return;
    const parsed = parseTyped(typed);
    // Not a number or a sum: say so (the field shows the document's value again), never take a part of it.
    if (!parsed) {
      setError(`“${typed.length > 24 ? `${typed.slice(0, 23)}…` : typed}” isn't a number. Type a number or simple maths, like 12+4 or *2.`);
      return;
    }
    apply((c) => typedResult(parsed, c));
  };

  const inputId = error ? `${id}-error` : undefined;
  return (
    <div className="field" data-invalid={error ? true : undefined}>
      <label className="field-letter" htmlFor={id} title={label}>
        {prefix}
        <span className="sr-only"> {label}</span>
      </label>
      <input
        ref={input}
        id={id}
        className="field-input"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={draft ?? shown}
        placeholder={mixed && text === undefined ? "Mixed" : undefined}
        readOnly={readOnly}
        aria-invalid={error ? true : undefined}
        aria-describedby={inputId}
        onChange={(e) => {
          setDraft(e.target.value);
          setError(null);
        }}
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
            // Selected again once it shows the committed value (the next render), so typing replaces it.
            if (draft === null) e.currentTarget.select();
            else selectOnRender.current = true;
            commit();
          } else if (e.key === "Escape") {
            cancelled.current = true;
            setDraft(null);
            setError(null);
            e.currentTarget.blur();
          } else if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !readOnly) {
            e.preventDefault();
            const step = (e.shiftKey ? 10 : 1) * (e.key === "ArrowUp" ? 1 : -1);
            setDraft(null);
            apply((v) => v + step);
          }
        }}
      />
      {suffix}
      {error && (
        <span id={inputId} className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
