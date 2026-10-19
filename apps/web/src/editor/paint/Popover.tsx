import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

const GUTTER = 8;

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Focusable elements of `root` that belong to it, not to a popover nested inside it. */
function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.closest(".popover") === root && el.offsetParent !== null);
}

/**
 * A popover dialog beside the Properties panel (colour picker, effect
 * settings), as in Figma: it opens to the left of the panel (or of the
 * popover it was opened from), level with its anchor.
 *
 * Keyboard: focus moves into it when it opens and Tab stays inside it;
 * Escape closes it and puts focus back on the control that opened it. Keys
 * never reach the editor's shortcuts (arrows would nudge the layer), except
 * ⌘/Ctrl combinations (undo, redo). A press outside closes it.
 */
export function Popover({
  anchor,
  label,
  className = "",
  initialFocus,
  onClose,
  children,
}: {
  /** The control that opened it: placement, and where focus returns. */
  anchor: HTMLElement | null;
  label: string;
  className?: string;
  /** A selector for the element to focus first (default: the first focusable one). */
  initialFocus?: string;
  /** `refocus`: put focus back on the anchor (Escape, the close button), not after a press elsewhere. */
  onClose(refocus: boolean): void;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useLayoutEffect(() => {
    const place = () => {
      const el = root.current;
      if (!el || !anchor) return;
      const a = anchor.getBoundingClientRect();
      // Beside the popover it came from, else beside the Properties panel, else beside the anchor.
      const parentPopover = anchor.closest(".popover");
      const side = (parentPopover ?? anchor.closest(".panel-right"))?.getBoundingClientRect() ?? a;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const left = Math.max(GUTTER, side.left - w - GUTTER);
      const top = Math.max(GUTTER, Math.min(a.top - 8, window.innerHeight - h - GUTTER));
      setPos((p) => (p && p.left === left && p.top === top ? p : { left, top }));
    };
    place();
    const ro = new ResizeObserver(place);
    if (root.current) ro.observe(root.current);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [anchor]);

  // Focus moves in once it is placed.
  const focused = useRef(false);
  useEffect(() => {
    const el = root.current;
    if (!pos || !el || focused.current) return;
    focused.current = true;
    const first = (initialFocus ? el.querySelector<HTMLElement>(initialFocus) : null) ?? focusables(el)[0] ?? el;
    first.focus();
  }, [pos, initialFocus]);

  useEffect(() => {
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (root.current?.contains(t) || anchor?.contains(t)) return;
      // A menu opened from inside (rendered inside too) counts as inside; anything else closes.
      close.current(false);
    };
    window.addEventListener("pointerdown", outside, true);
    return () => window.removeEventListener("pointerdown", outside, true);
  }, [anchor]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.metaKey || e.ctrlKey) return; // undo and redo still work while it is open
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      close.current(true);
      return;
    }
    if (e.key !== "Tab") return;
    const el = root.current;
    if (!el) return;
    const all = focusables(el);
    if (!all.length) return;
    const i = all.indexOf(document.activeElement as HTMLElement);
    const next = e.shiftKey ? (i <= 0 ? all.length - 1 : i - 1) : i === -1 || i === all.length - 1 ? 0 : i + 1;
    e.preventDefault();
    all[next]?.focus();
  };

  return (
    <div
      ref={root}
      className={`popover ${className}`}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      style={pos ? { left: pos.left, top: pos.top } : { visibility: "hidden", left: 0, top: 0 }}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}
