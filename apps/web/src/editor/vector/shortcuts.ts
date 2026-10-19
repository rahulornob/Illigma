/**
 * Vector shortcuts and commands (interactions.md §7): ⇧L arrow, ⇧⌘K place
 * image, ⌘E flatten, ⌥⌘O outline stroke, Enter to edit a vector or shape,
 * and the boolean operations. The commands are shared with the Properties
 * panel's buttons.
 */

import { useEffect, useRef } from "react";
import type { Document } from "@illigma/core";
import type { BooleanOperation, NodeId } from "@illigma/format";
import { inLayer, onControl } from "../focus";
import { loadCanvasKit } from "../text/engine";
import { booleanLayers, BOOLEAN_LABEL, flattenLayers, outlineStrokes, VECTOR_EDITABLE } from "./ops";
import { vectorEdit } from "./store";

/** Asks the image import (useImageImport) to open the file picker: Place image (⇧⌘K). */
export const PLACE_IMAGE_EVENT = "illigma:place-image";
export function placeImageRequest(): void {
  window.dispatchEvent(new CustomEvent(PLACE_IMAGE_EVENT));
}

export function flattenSelection(doc: Document, ids: readonly NodeId[]): NodeId | null {
  if (!ids.length || doc.live) return null;
  return doc.transact(ids.length === 1 ? "Flatten" : `Flatten ${ids.length} layers`, (tx) => flattenLayers(tx, doc, ids));
}

export async function outlineSelection(doc: Document, ids: readonly NodeId[]): Promise<NodeId[]> {
  if (!ids.length) return [];
  const ck = await loadCanvasKit();
  if (doc.live) return [];
  const live = ids.filter((id) => doc.has(id));
  return doc.transact("Outline stroke", (tx) => outlineStrokes(tx, doc, live, ck));
}

export function booleanSelection(doc: Document, ids: readonly NodeId[], op: BooleanOperation): NodeId | null {
  if (!ids.length || doc.live) return null;
  return doc.transact(BOOLEAN_LABEL[op], (tx) => booleanLayers(tx, doc, ids, op));
}

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/** Installs the vector shortcuts for the editor. */
export function useVectorShortcuts(opts: {
  doc: Document;
  selection: readonly NodeId[];
  locked: boolean;
  setTool(t: "arrow"): void;
  setSelection(ids: NodeId[]): void;
  onError(e: unknown): void;
}): void {
  const ref = useRef(opts);
  ref.current = opts;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { doc, selection: sel, locked, setTool, setSelection, onError } = ref.current;
      if (isTyping(e.target) || inLayer(e.target) || doc.live) return;
      if (vectorEdit.get()) return; // vector edit mode has its own keys
      const mod = e.metaKey || e.ctrlKey;
      const code = e.code;
      try {
        if (mod && e.shiftKey && !e.altKey && code === "KeyK") {
          e.preventDefault();
          if (!locked) placeImageRequest();
          return;
        }
        if (mod && !e.shiftKey && !e.altKey && code === "KeyE") {
          e.preventDefault();
          if (locked || !sel.length) return;
          const id = flattenSelection(doc, sel);
          if (id) setSelection([id]);
          return;
        }
        if (mod && e.altKey && !e.shiftKey && code === "KeyO") {
          e.preventDefault();
          if (locked || !sel.length) return;
          void outlineSelection(doc, sel).then((ids) => ids.length && setSelection(ids), onError);
          return;
        }
        if (!mod && !e.altKey && e.shiftKey && code === "KeyL") {
          e.preventDefault();
          if (!locked) setTool("arrow");
          return;
        }
        if (!mod && !e.altKey && !e.shiftKey && e.key === "Enter" && !onControl(e.target) && sel.length === 1) {
          const n = doc.get(sel[0] as NodeId);
          if (!n || !VECTOR_EDITABLE.has(n.type) || locked) return;
          e.preventDefault();
          e.stopPropagation();
          vectorEdit.control()?.edit(n.id);
        }
      } catch (err) {
        onError(err);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
}
