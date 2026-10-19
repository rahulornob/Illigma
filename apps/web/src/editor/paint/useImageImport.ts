import { useEffect, useRef, type DragEvent, type RefObject } from "react";
import type { Document } from "@illigma/core";
import type { NodeId } from "@illigma/format";
import type { CanvasHandle } from "../Canvas";
import { addImageFile, imageFiles, placeImages, type AddedImage } from "./image";

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
const hasFiles = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes("Files");

/**
 * Images onto the canvas, as in Figma: drop image files on the canvas, or
 * paste one (⌘V / Ctrl+V), and each becomes a rectangle with the image as
 * its fill, at its natural size (smaller if it wouldn't fit the view),
 * selected. A drop lands where it is dropped; a paste in the middle of the
 * view. A file the document refuses (not an image, too big) is reported with
 * its reason and nothing is added.
 *
 * Returns the drag handlers for the canvas area.
 */
export function useImageImport({
  doc,
  pageId,
  canvas,
  locked,
  onSelect,
  onError,
}: {
  doc: Document;
  pageId: NodeId;
  canvas: RefObject<CanvasHandle | null>;
  /** No edits now (view only, a reload or Keep running). */
  locked: boolean;
  onSelect(ids: NodeId[]): void;
  /** The reason a file couldn't be used, in plain words. */
  onError(message: string): void;
}): { onDragOver(e: DragEvent): void; onDrop(e: DragEvent): void } {
  const state = useRef({ doc, pageId, locked, onSelect, onError });
  state.current = { doc, pageId, locked, onSelect, onError };

  const place = async (files: File[], at: { x: number; y: number } | null) => {
    const s = state.current;
    if (s.locked || !files.length) return;
    const added: AddedImage[] = [];
    for (const file of files) {
      try {
        added.push(await addImageFile(s.doc, file));
      } catch (e) {
        s.onError(e instanceof Error && e.message ? `${file.name ? `“${file.name}”: ` : ""}${e.message}` : String(e));
      }
    }
    const view = canvas.current?.viewport();
    if (!added.length || !view) return;
    const point = at ?? { x: view.x + view.width / 2, y: view.y + view.height / 2 };
    // The file's state may have changed while reading (a drag started): never write over a live edit.
    if (s.doc.live || state.current.locked) return;
    try {
      s.onSelect(placeImages(s.doc, state.current.pageId, added, point, view));
    } catch (e) {
      s.onError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target) || isTyping(document.activeElement)) return;
      const files = imageFiles(e.clipboardData?.files);
      if (!files.length) return;
      e.preventDefault();
      void place(files, null);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // `place` reads everything it needs from refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    onDragOver: (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = state.current.locked ? "none" : "copy";
    },
    onDrop: (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      const files = imageFiles(e.dataTransfer.files);
      if (!files.length) {
        state.current.onError("Only PNG, JPEG, WebP and GIF images can be placed on the canvas.");
        return;
      }
      void place(files, canvas.current?.toWorld(e.clientX, e.clientY) ?? null);
    },
  };
}
