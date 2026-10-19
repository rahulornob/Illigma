import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

export type ContextEntry<T> = { kind?: "item"; value: T; label: string; shortcut?: string; disabled?: boolean } | { kind: "separator" };

const WIDTH = 240;
const GUTTER = 8;

/**
 * A context menu at a point (WAI-ARIA menu): opens with focus on the first
 * item; ↑ ↓ Home End move, Enter or Space picks, Escape or Tab closes and
 * gives focus back to where it was. A press outside closes it.
 */
export function ContextMenu<T>({
  x,
  y,
  label,
  entries,
  onSelect,
  onClose,
}: {
  x: number;
  y: number;
  label: string;
  entries: readonly ContextEntry<T>[];
  onSelect(value: T): void;
  onClose(): void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const returnTo = useRef<Element | null>(document.activeElement);

  const close = (refocus: boolean) => {
    onClose();
    if (refocus && returnTo.current instanceof HTMLElement && returnTo.current.isConnected) returnTo.current.focus({ preventScroll: true });
  };

  useLayoutEffect(() => {
    const h = menu.current?.offsetHeight ?? 0;
    const left = Math.max(GUTTER, Math.min(x, window.innerWidth - WIDTH - GUTTER));
    const top = Math.max(GUTTER, Math.min(y, window.innerHeight - h - GUTTER));
    setPos({ left, top });
  }, [x, y]);

  useEffect(() => {
    if (!pos) return;
    menu.current?.querySelector<HTMLElement>("[data-menu-item]:not([aria-disabled='true'])")?.focus();
  }, [pos]);

  useEffect(() => {
    const outside = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node)) close(false);
    };
    const blur = () => close(false);
    window.addEventListener("pointerdown", outside, true);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("blur", blur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const all = [...(menu.current?.querySelectorAll<HTMLElement>("[data-menu-item]:not([aria-disabled='true'])") ?? [])];
    const i = all.indexOf(document.activeElement as HTMLElement);
    const go = (j: number) => all[(j + all.length) % all.length]?.focus();
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(all.length - 1);
    else if (e.key === "Escape") close(true);
    else if (e.key === "Tab") close(true);
    else return;
    e.preventDefault();
  };

  return (
    <div
      ref={menu}
      className="menu context-menu"
      role="menu"
      aria-label={label}
      style={pos ? { left: pos.left, top: pos.top } : { left: x, top: y, visibility: "hidden" }}
      onKeyDown={onKey}
      onContextMenu={(e) => e.preventDefault()}
    >
      {entries.map((e, i) =>
        e.kind === "separator" ? (
          <div key={i} className="menu-separator" role="separator" />
        ) : (
          <button
            key={i}
            type="button"
            className="menu-item"
            role="menuitem"
            aria-disabled={e.disabled || undefined}
            aria-keyshortcuts={e.shortcut ? ariaKeys(e.shortcut) : undefined}
            tabIndex={-1}
            data-menu-item=""
            onClick={() => {
              if (e.disabled) return;
              close(true);
              onSelect(e.value);
            }}
          >
            <span className="menu-label">{e.label}</span>
            {e.shortcut && <span className="menu-shortcut">{e.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  );
}

/** "⇧⌘G" → "Shift+Meta+G" for aria-keyshortcuts. */
function ariaKeys(s: string): string {
  const parts: string[] = [];
  let rest = s;
  const mods: [string, string][] = [
    ["⇧", "Shift"],
    ["⌥", "Alt"],
    ["⌘", "Meta"],
  ];
  for (;;) {
    const m = mods.find(([sym]) => rest.startsWith(sym));
    if (!m) break;
    parts.push(m[1]);
    rest = rest.slice(m[0].length);
  }
  if (rest) parts.push(rest === "⌫" ? "Delete" : rest);
  return parts.join("+");
}
