/**
 * Editor wiring for components: dropping a component from Assets onto the
 * canvas, inserting one in the middle of the view, and "Go to main component".
 */
import { useEffect, useRef, type DragEvent, type RefObject } from "react";
import type { Document } from "@illigma/core";
import type { NodeId } from "@illigma/format";
import type { CanvasHandle } from "../Canvas";
import { COMPONENT_DRAG_TYPE, insertInstance, pageOf } from "./commands";
import { GO_TO_NODE_EVENT } from "./ComponentCard";

interface Options {
  doc: Document;
  pageId: NodeId;
  canvas: RefObject<CanvasHandle | null>;
  locked: boolean;
  setSelection(ids: NodeId[]): void;
  switchPage(id: NodeId): void;
  onError(e: unknown): void;
  /** The canvas's other drop handlers (images). */
  drop: { onDragOver(e: DragEvent): void; onDrop(e: DragEvent): void };
}

export function useComponents({ doc, pageId, canvas, locked, setSelection, switchPage, onError, drop }: Options) {
  const s = useRef({ doc, pageId, locked, setSelection, switchPage, onError });
  s.current = { doc, pageId, locked, setSelection, switchPage, onError };

  useEffect(() => {
    const go = (e: Event) => {
      const id = (e as CustomEvent<NodeId>).detail;
      const { doc, pageId, setSelection, switchPage } = s.current;
      const page = pageOf(doc, id);
      if (!page) return;
      if (page !== pageId) switchPage(page);
      // After the page switch has restored that page's selection.
      setTimeout(() => {
        setSelection([id]);
        setTimeout(() => canvas.current?.zoomToSelection(), 0);
      }, 0);
    };
    window.addEventListener(GO_TO_NODE_EVENT, go);
    return () => window.removeEventListener(GO_TO_NODE_EVENT, go);
  }, [canvas]);

  const place = (componentId: NodeId, at: { x: number; y: number }) => {
    const { doc, pageId, locked, setSelection, onError } = s.current;
    if (locked) return;
    try {
      const id = insertInstance(doc, pageId, componentId, at);
      if (id) setSelection([id]);
    } catch (err) {
      onError(err);
    }
  };

  const insert = (componentId: NodeId) => {
    const v = canvas.current?.viewport();
    place(componentId, v ? { x: v.x + v.width / 2, y: v.y + v.height / 2 } : { x: 0, y: 0 });
  };

  const handlers = {
    onDragOver(e: DragEvent) {
      if (e.dataTransfer.types.includes(COMPONENT_DRAG_TYPE)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        return;
      }
      drop.onDragOver(e);
    },
    onDrop(e: DragEvent) {
      const id = e.dataTransfer.getData(COMPONENT_DRAG_TYPE);
      if (id) {
        e.preventDefault();
        const w = canvas.current?.toWorld(e.clientX, e.clientY);
        if (w) place(id, w);
        return;
      }
      drop.onDrop(e);
    },
  };
  return { insert, handlers };
}
