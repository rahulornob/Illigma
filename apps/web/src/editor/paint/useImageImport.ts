import { useEffect, useRef, type DragEvent } from "react";
import type { RefObject } from "react";
import type { Document } from "@illigma/core";
import type { NodeId } from "@illigma/format";
import type { CanvasHandle } from "../Canvas";
import { imageFiles, placeImages, readImageFiles, refusalMessage, whenIdle } from "./image";

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
const hasFiles = (e: { dataTransfer: DataTransfer | null }) => [...(e.dataTransfer?.types ?? [])].includes("Files");
const NOT_IMAGES = "Only PNG, JPEG, WebP and GIF images can be placed on the canvas.";

/**
 * Images onto the canvas, as in Figma: drop image files on the canvas, or
 * paste one (⌘V / Ctrl+V), and each becomes a rectangle with the image as
 * its fill, at its natural size (smaller if it wouldn't fit the view),
 * selected. A drop lands where it is dropped; a paste, or a drop anywhere
 * else in the window (a panel, the title bar), in the middle of the view, so
 * a dropped file never replaces the editor with the file. Files the document
 * refuses (not an image, too big, past the 50 files or 512 MB one drop can
 * bring) are listed with their reasons in one message; the rest are added.
 * Files are hashed by the platform's native SHA-256, so the page stays
 * responsive; if a drag is under way when they are ready, they are placed
 * when it ends.
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
    const { added, refused } = await readImageFiles(s.doc, files);
    const refusal = refusalMessage(refused);
    if (refusal) s.onError(refusal);
    if (!added.length) return;
    // Never write over a live edit (a drag started while the files were read): place them when it ends.
    await whenIdle(s.doc);
    const now = state.current;
    if (now.doc !== s.doc) return; // another file is open now
    const count = added.length === 1 ? "The image" : `The ${added.length} images`;
    if (now.locked) {
      now.onError(`${count} couldn't be placed: this file can't be changed right now.`);
      return;
    }
    const view = canvas.current?.viewport();
    if (!view) return;
    const point = at ?? { x: view.x + view.width / 2, y: view.y + view.height / 2 };
    try {
      now.onSelect(placeImages(now.doc, now.pageId, added, point, view));
    } catch (e) {
      now.onError(e instanceof Error ? e.message : String(e));
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
    // Files dropped outside the canvas and the paint cards (which handle their own drops): the browser would
    // otherwise open the file in this tab, leaving the editor. Place images in the middle of the view instead.
    const onWindowDragOver = (e: globalThis.DragEvent) => {
      if (e.defaultPrevented || !hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = state.current.locked ? "none" : "copy";
    };
    const onWindowDrop = (e: globalThis.DragEvent) => {
      if (e.defaultPrevented || !hasFiles(e)) return;
      e.preventDefault();
      if (state.current.locked) return;
      const files = imageFiles(e.dataTransfer?.files);
      if (!files.length) {
        state.current.onError(NOT_IMAGES);
        return;
      }
      void place(files, null);
    };
    window.addEventListener("paste", onPaste);
    window.addEventListener("dragover", onWindowDragOver);
    window.addEventListener("drop", onWindowDrop);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("dragover", onWindowDragOver);
      window.removeEventListener("drop", onWindowDrop);
    };
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
        state.current.onError(NOT_IMAGES);
        return;
      }
      void place(files, canvas.current?.toWorld(e.clientX, e.clientY) ?? null);
    },
  };
}
