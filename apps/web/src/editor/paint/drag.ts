import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { Phase } from "./edits";

/** Where a pointer is across `el`, each axis 0–1. */
export function fractionIn(el: HTMLElement, clientX: number, clientY: number): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  const f = (v: number, size: number) => (size > 0 ? Math.min(1, Math.max(0, v / size)) : 0);
  return { x: f(clientX - r.left, r.width), y: f(clientY - r.top, r.height) };
}

/**
 * Pointer handlers for a drag on `el` (a colour area, a slider, a stop):
 * `onDrag` gets the pointer's place across it and the drag's phase — "start"
 * on press, "move" while dragging, "end" on release — so the whole drag is
 * one live edit (one undo step).
 */
export function useDrag<T extends HTMLElement>(el: RefObject<T | null>, onDrag: (at: { x: number; y: number }, phase: Phase) => void, disabled = false) {
  const active = useRef<number | null>(null);
  const latest = useRef(onDrag);
  latest.current = onDrag;
  const at = (e: ReactPointerEvent) => (el.current ? fractionIn(el.current, e.clientX, e.clientY) : { x: 0, y: 0 });
  const end = (e: ReactPointerEvent) => {
    if (active.current !== e.pointerId) return;
    active.current = null;
    latest.current(at(e), "end");
  };
  return {
    onPointerDown(e: ReactPointerEvent) {
      if (disabled || e.button !== 0 || active.current !== null) return;
      e.preventDefault();
      el.current?.focus();
      el.current?.setPointerCapture(e.pointerId);
      active.current = e.pointerId;
      latest.current(at(e), "start");
    },
    onPointerMove(e: ReactPointerEvent) {
      if (active.current !== e.pointerId) return;
      latest.current(at(e), "move");
    },
    onPointerUp: end,
    onPointerCancel: end,
    onLostPointerCapture: end,
  };
}
