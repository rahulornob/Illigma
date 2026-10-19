import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
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
 *
 * A drag always ends: on release, and also when the pointer is cancelled,
 * capture is lost (the element left the page, the window lost focus) or the
 * component unmounts (Escape closed its popover mid-drag). Those end at the
 * last place the pointer was, so the edit is kept as one step and never left
 * open (an open edit holds autosave and swallows ⌘Z).
 */
export function useDrag<T extends HTMLElement>(el: RefObject<T | null>, onDrag: (at: { x: number; y: number }, phase: Phase) => void, disabled = false) {
  const active = useRef<number | null>(null);
  const last = useRef({ x: 0, y: 0 });
  const latest = useRef(onDrag);
  latest.current = onDrag;
  const at = (e: ReactPointerEvent) => (el.current ? fractionIn(el.current, e.clientX, e.clientY) : last.current);
  const finish = (where: { x: number; y: number }) => {
    active.current = null;
    latest.current(where, "end");
  };
  const release = (e: ReactPointerEvent) => {
    if (active.current !== e.pointerId) return;
    finish((last.current = at(e)));
  };
  /** Cancelled, or capture lost: the pointer's place may be meaningless, so end where it last was. */
  const abandon = (e: ReactPointerEvent) => {
    if (active.current !== e.pointerId) return;
    finish(last.current);
  };
  useEffect(
    () => () => {
      if (active.current !== null) finish(last.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  return {
    onPointerDown(e: ReactPointerEvent) {
      if (disabled || e.button !== 0 || active.current !== null) return;
      e.preventDefault();
      el.current?.focus();
      el.current?.setPointerCapture(e.pointerId);
      active.current = e.pointerId;
      latest.current((last.current = at(e)), "start");
    },
    onPointerMove(e: ReactPointerEvent) {
      if (active.current !== e.pointerId) return;
      latest.current((last.current = at(e)), "move");
    },
    onPointerUp: release,
    onPointerCancel: abandon,
    onLostPointerCapture: abandon,
  };
}
