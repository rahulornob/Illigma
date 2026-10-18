import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "./Icon";

export type MenuEntry<T> =
  | { kind?: "item"; value: T; label: string; checked?: boolean; disabled?: boolean }
  | { kind: "separator" }
  | { kind: "heading"; label: string };

const MENU_WIDTH = 240;
const GUTTER = 8;

/**
 * A button that opens a menu (WAI-ARIA menu button). Items with `checked`
 * are radio items (Fixed / Hug / Fill). Keyboard: Enter, Space or ↓ opens and
 * focuses the checked item; ↑ ↓ Home End move; Enter or Space picks; Escape
 * closes and returns focus to the button; Tab closes. Keys never reach the
 * editor's shortcuts while the menu has focus.
 *
 * The popup is `position: fixed`, so the scrolling Properties panel never clips it.
 */
export function MenuButton<T>({
  label,
  title,
  className = "menu-button",
  disabled = false,
  entries,
  onSelect,
  children,
}: {
  label: string;
  title?: string;
  className?: string;
  disabled?: boolean;
  entries: readonly MenuEntry<T>[];
  onSelect(value: T): void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const items = entries.filter((e): e is Extract<MenuEntry<T>, { value: T }> => e.kind === undefined || e.kind === "item");

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    const height = menu.current?.offsetHeight ?? 0;
    const left = Math.max(GUTTER, Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - GUTTER));
    const below = r.bottom + 4;
    const top = below + height > window.innerHeight - GUTTER ? Math.max(GUTTER, r.top - 4 - height) : below;
    setPos({ left, top });
  }, [open]);

  // Focus the checked item (or the first) once the menu is placed.
  useEffect(() => {
    if (!open || !pos) return;
    const all = [...(menu.current?.querySelectorAll<HTMLElement>("[data-menu-item]:not([aria-disabled='true'])") ?? [])];
    (all.find((el) => el.getAttribute("aria-checked") === "true") ?? all[0])?.focus();
  }, [open, pos]);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !button.current?.contains(t)) close(false);
    };
    window.addEventListener("pointerdown", outside, true);
    return () => window.removeEventListener("pointerdown", outside, true);
  }, [open]);

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    // The editor's shortcuts (arrows nudge, Escape deselects, Delete) must not see keys meant for the menu.
    e.stopPropagation();
    const all = [...(menu.current?.querySelectorAll<HTMLElement>("[data-menu-item]:not([aria-disabled='true'])") ?? [])];
    const i = all.indexOf(document.activeElement as HTMLElement);
    const go = (j: number) => all[(j + all.length) % all.length]?.focus();
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(all.length - 1);
    else if (e.key === "Escape") close(true);
    else if (e.key === "Tab") {
      close(false);
      return; // let focus move on
    } else return;
    e.preventDefault();
  };

  const pick = (item: (typeof items)[number]) => {
    if (item.disabled) return;
    close(true);
    onSelect(item.value);
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        className={className}
        aria-label={label}
        title={title ?? label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }
        }}
      >
        {children}
      </button>
      {open && (
        <div
          ref={menu}
          id={id}
          className="menu"
          role="menu"
          aria-label={label}
          style={pos ? { left: pos.left, top: pos.top } : { visibility: "hidden" }}
          onKeyDown={onMenuKey}
        >
          {entries.map((e, i) =>
            e.kind === "separator" ? (
              <div key={i} className="menu-separator" role="separator" />
            ) : e.kind === "heading" ? (
              <div key={i} className="menu-heading" role="presentation">
                {e.label}
              </div>
            ) : (
              <button
                key={i}
                type="button"
                className="menu-item"
                role={e.checked === undefined ? "menuitem" : "menuitemradio"}
                aria-checked={e.checked}
                aria-disabled={e.disabled || undefined}
                tabIndex={-1}
                data-menu-item=""
                onClick={() => pick(e)}
              >
                <span className="menu-check">{e.checked && <Icon name="check" />}</span>
                <span className="menu-label">{e.label}</span>
              </button>
            ),
          )}
        </div>
      )}
    </>
  );
}
