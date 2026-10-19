import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { Document } from "@illigma/core";
import type { NodeId } from "@illigma/format";
import type { CanvasHandle } from "./Canvas";

type Camera = { x: number; y: number; zoom: number };

/**
 * Each page keeps its own camera and selection, as in Figma: switching away
 * and back shows the page where it was left. A page seen for the first time
 * is fitted (the canvas does that on a page switch). Returns the page switcher.
 */
export function usePageMemory({
  doc,
  pageId,
  selection,
  setPageId,
  setSelection,
  canvas,
}: {
  doc: Document;
  pageId: NodeId;
  selection: readonly NodeId[];
  setPageId(id: NodeId): void;
  setSelection(ids: NodeId[]): void;
  canvas: RefObject<CanvasHandle | null>;
}) {
  const memory = useRef(new Map<NodeId, { camera: Camera | null; selection: NodeId[] }>());
  const current = useRef({ pageId, selection });
  current.current = { pageId, selection };

  const switchPage = useCallback(
    (id: NodeId) => {
      const { pageId: from, selection: sel } = current.current;
      if (id === from) return;
      memory.current.set(from, { camera: canvas.current?.camera() ?? null, selection: [...sel] });
      const saved = memory.current.get(id);
      setPageId(id);
      setSelection(saved ? saved.selection.filter((s) => doc.has(s)) : []);
    },
    [doc, canvas, setPageId, setSelection],
  );

  // After the canvas has fitted the new page (its effect runs first), put back the camera the page had.
  useEffect(() => {
    const saved = memory.current.get(pageId)?.camera;
    if (saved) canvas.current?.setCamera(saved);
  }, [pageId, canvas]);

  return switchPage;
}
