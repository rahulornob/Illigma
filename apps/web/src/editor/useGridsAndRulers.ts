/**
 * The canvas's layout grid overlay and rulers with guides, and their
 * shortcuts: ⌃G shows or hides layout grids, ⇧R rulers.
 */
import { useEffect, useRef, type RefObject } from "react";
import type { Document } from "@illigma/core";
import type { NodeId } from "@illigma/format";
import { drawGrids, framesWithGrids, setViewSettings, subscribeView, viewSettings } from "./grids";
import { inLayer } from "./focus";
import { Rulers, type RulerHost } from "./rulers";

interface Options extends RulerHost {
  host: RefObject<HTMLElement | null>;
  grid: RefObject<HTMLCanvasElement | null>;
}

export interface GridOverlays {
  render(): void;
}

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/** True on macOS, where ⌃ and ⌘ are different keys. */
export const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Whether `e` is the layout grid shortcut: ⌃G on a Mac, ⌃⇧4 elsewhere (as in Figma). */
export function isGridShortcut(e: KeyboardEvent): boolean {
  if (IS_MAC) return e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && e.code === "KeyG";
  return e.ctrlKey && e.shiftKey && !e.altKey && e.code === "Digit4";
}

export function useGridsAndRulers(o: Options): RefObject<GridOverlays | null> {
  const opts = useRef(o);
  opts.current = o;
  const overlays = useRef<GridOverlays | null>(null);

  useEffect(() => {
    const host = o.host.current;
    if (!host) return;
    const h: RulerHost = {
      doc: () => opts.current.doc(),
      pageId: () => opts.current.pageId(),
      camera: () => opts.current.camera(),
      readOnly: () => opts.current.readOnly(),
      selection: () => opts.current.selection(),
      requestDraw: () => opts.current.requestDraw(),
    };
    const rulers = new Rulers(host, h);
    // Frames with grids, found again after each change (cheap next to rendering).
    let cache: { doc: Document; page: NodeId; frames: NodeId[] } | null = null;
    const frames = () => {
      const doc = h.doc();
      const page = h.pageId();
      if (!cache || cache.doc !== doc || cache.page !== page) cache = { doc, page, frames: framesWithGrids(doc, page) };
      return cache.frames;
    };
    let unsubDoc = h.doc().subscribe(() => (cache = null));
    let subscribed = h.doc();
    overlays.current = {
      render() {
        const doc = h.doc();
        if (doc !== subscribed) {
          unsubDoc();
          unsubDoc = doc.subscribe(() => (cache = null));
          subscribed = doc;
          cache = null;
        }
        const canvas = opts.current.grid.current;
        const ctx = canvas?.getContext("2d");
        if (canvas && ctx) {
          const dpr = window.devicePixelRatio || 1;
          const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
          const ht = Math.max(1, Math.round(canvas.clientHeight * dpr));
          if (canvas.width !== w) canvas.width = w;
          if (canvas.height !== ht) canvas.height = ht;
          drawGrids(ctx, doc, frames(), h.camera(), dpr);
        }
        rulers.render();
      },
    };
    const unsubView = subscribeView(() => h.requestDraw());
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || inLayer(e.target) || h.doc().live) return;
      if (isGridShortcut(e)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setViewSettings({ grids: !viewSettings().grids });
      } else if (e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && e.code === "KeyR") {
        e.preventDefault();
        setViewSettings({ rulers: !viewSettings().rulers });
      }
    };
    window.addEventListener("keydown", onKey, true);
    h.requestDraw();
    return () => {
      window.removeEventListener("keydown", onKey, true);
      unsubView();
      unsubDoc();
      rulers.dispose();
      overlays.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return overlays;
}
