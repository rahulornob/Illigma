/**
 * Layer commands shared by the keyboard, the canvas and Layers context menus:
 * clipboard (⌘C ⌘X ⌘V ⇧⌘V), group (⌘G), ungroup (⇧⌘G), frame selection
 * (⌥⌘G), order (⌘] ⌘[ ⌥⌘] ⌥⌘[), hide (⇧⌘H), lock (⇧⌘L), rename (⌘R).
 */
import { useCallback, useEffect, useRef, useState, type ReactElement, type RefObject } from "react";
import type { Document } from "@illigma/core";
import type { NodeId } from "@illigma/format";
import type { CanvasHandle } from "./Canvas";
import { CLIPBOARD_TYPE, parseClip, pasteLayers, plainText, serializeLayers, type ClipData } from "./clipboard";
import { ContextMenu, type ContextEntry } from "./ContextMenu";
import { deleteLayers, duplicateLayers, topmost } from "./edit";
import { inLayer } from "./focus";
import { reorderZ, toggleLocked, toggleVisible, ungroupLayers, wrapLayers, type OrderStep } from "./layer-ops";
import { layoutTransact } from "./layout-props";

export type LayerCommand =
  | "copy"
  | "cut"
  | "paste"
  | "paste-in-place"
  | "duplicate"
  | "delete"
  | "group"
  | "ungroup"
  | "frame"
  | OrderStep
  | "toggle-visible"
  | "toggle-locked"
  | "rename"
  | "select-parent"
  | "select-children";

/** Asks the Layers panel to rename a layer inline (⌘R, the context menu). */
export const RENAME_EVENT = "illigma:rename-layer";

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/** The last layers copied in this browser: the context menu's Paste (it can't read the system clipboard). */
const STORE_KEY = "illigma:clipboard";
let memoryClip: string | null = null;
function remember(text: string): void {
  memoryClip = text;
  try {
    localStorage.setItem(STORE_KEY, text);
  } catch {
    // too large or storage off: this tab still has it
  }
}
function recalled(): ClipData | null {
  let text = memoryClip;
  try {
    text = localStorage.getItem(STORE_KEY) ?? text;
  } catch {
    // storage off
  }
  return parseClip(text);
}

interface Options {
  doc: Document;
  pageId: NodeId;
  selection: readonly NodeId[];
  setSelection(ids: NodeId[]): void;
  locked: boolean;
  canvas: RefObject<CanvasHandle | null>;
  onError(e: unknown): void;
}

export function useLayerCommands({ doc, pageId, selection, setSelection, locked, canvas, onError }: Options) {
  const state = useRef({ doc, pageId, selection, locked });
  state.current = { doc, pageId, selection, locked };
  const [menu, setMenu] = useState<{ x: number; y: number; from: "canvas" | "layers" } | null>(null);
  /** ⇧⌘V was pressed: the paste event that follows pastes in place. */
  const inPlace = useRef(false);

  const paste = useCallback(
    (data: ClipData, here: boolean) => {
      const { doc, pageId, selection, locked } = state.current;
      if (locked) return;
      const viewport = canvas.current?.viewport();
      const ids = layoutTransact(doc, data.layers.length === 1 ? "Paste layer" : `Paste ${data.layers.length} layers`, (tx) =>
        pasteLayers(tx, doc, data, { selection, pageId, inPlace: here, viewport }),
      );
      if (ids?.length) setSelection(ids);
    },
    [canvas, setSelection],
  );

  const run = useCallback(
    (cmd: LayerCommand) => {
      const { doc, pageId, selection: sel, locked } = state.current;
      try {
        switch (cmd) {
          case "copy":
          case "cut": {
            const data = serializeLayers(doc, sel);
            if (!data) return;
            const text = JSON.stringify(data);
            remember(text);
            // Puts it on the system clipboard too, through the copy event below (a menu click is a user gesture).
            pendingCopy.current = data;
            try {
              document.execCommand("copy");
            } catch {
              // not allowed: kept in this browser only
            }
            pendingCopy.current = null;
            if (cmd === "cut" && !locked) {
              doc.transact(sel.length === 1 ? "Cut layer" : `Cut ${sel.length} layers`, (tx) => deleteLayers(tx, doc, sel));
              setSelection([]);
            }
            return;
          }
          case "paste":
          case "paste-in-place": {
            const data = recalled();
            if (data) paste(data, cmd === "paste-in-place");
            return;
          }
          case "select-parent": {
            const parents = [...new Set(sel.map((id) => doc.get(id)?.parentId).filter((p): p is NodeId => !!p && p !== pageId && doc.get(p)?.type !== "PAGE"))];
            setSelection(parents);
            return;
          }
          case "select-children": {
            const kids = topmost(doc, sel).flatMap((id) => doc.children(id).filter((k) => k.visible && !k.locked).map((k) => k.id));
            if (kids.length) setSelection(kids);
            return;
          }
          case "rename": {
            const id = sel[sel.length - 1];
            if (id && !locked) window.dispatchEvent(new CustomEvent(RENAME_EVENT, { detail: id }));
            return;
          }
        }
        if (locked || !sel.length) return;
        const n = topmost(doc, sel).length;
        const many = (one: string, several: string) => (n === 1 ? one : several.replace("#", String(n)));
        switch (cmd) {
          case "duplicate":
            setSelection(doc.transact(many("Duplicate layer", "Duplicate # layers"), (tx) => duplicateLayers(tx, doc, sel)));
            return;
          case "delete":
            doc.transact(many("Delete layer", "Delete # layers"), (tx) => deleteLayers(tx, doc, sel));
            setSelection([]);
            return;
          case "group": {
            const g = layoutTransact(doc, "Group selection", (tx) => wrapLayers(tx, doc, sel, "GROUP"));
            if (g) setSelection([g]);
            return;
          }
          case "frame": {
            const f = layoutTransact(doc, "Frame selection", (tx) => wrapLayers(tx, doc, sel, "FRAME"));
            if (f) setSelection([f]);
            return;
          }
          case "ungroup": {
            const wrappers = sel.filter((id) => ["GROUP", "FRAME", "SECTION"].includes(doc.get(id)?.type ?? ""));
            if (!wrappers.length) return;
            const out = layoutTransact(doc, "Ungroup", (tx) => ungroupLayers(tx, doc, sel));
            if (out) setSelection(out);
            return;
          }
          case "forward":
          case "backward":
          case "front":
          case "back": {
            const label = { forward: "Bring forward", backward: "Send backward", front: "Bring to front", back: "Send to back" }[cmd];
            layoutTransact(doc, label, (tx) => reorderZ(tx, doc, sel, cmd));
            return;
          }
          case "toggle-visible":
            doc.transact("Show/hide", (tx) => toggleVisible(tx, doc, sel));
            return;
          case "toggle-locked":
            doc.transact("Lock/unlock", (tx) => toggleLocked(tx, doc, sel));
            return;
        }
      } catch (e) {
        onError(e);
      }
    },
    [paste, setSelection, onError],
  );

  /** Data the next copy event writes (a menu's Copy), instead of reading the selection. */
  const pendingCopy = useRef<ClipData | null>(null);

  // Clipboard events: the keyboard's ⌘C ⌘X ⌘V, and the menu's execCommand("copy").
  useEffect(() => {
    const blocked = (e: Event) => isTyping(e.target) || isTyping(document.activeElement) || inLayer(e.target as EventTarget) || state.current.doc.live !== null;
    const onCopy = (e: ClipboardEvent, cut: boolean) => {
      const pending = pendingCopy.current;
      if (!pending && blocked(e)) return;
      const { doc, selection, locked } = state.current;
      const data = pending ?? serializeLayers(doc, selection);
      if (!data || !e.clipboardData) return;
      const text = JSON.stringify(data);
      e.clipboardData.setData(CLIPBOARD_TYPE, text);
      e.clipboardData.setData("text/plain", plainText(data));
      e.preventDefault();
      if (pending) return;
      remember(text);
      if (cut && !locked) {
        try {
          doc.transact(selection.length === 1 ? "Cut layer" : `Cut ${selection.length} layers`, (tx) => deleteLayers(tx, doc, selection));
          setSelection([]);
        } catch (err) {
          onError(err);
        }
      }
    };
    const copy = (e: ClipboardEvent) => onCopy(e, false);
    const cut = (e: ClipboardEvent) => onCopy(e, true);
    const onPaste = (e: ClipboardEvent) => {
      const here = inPlace.current;
      inPlace.current = false;
      if (blocked(e)) return;
      const data = parseClip(e.clipboardData?.getData(CLIPBOARD_TYPE)) ?? parseClip(e.clipboardData?.getData("text/plain"));
      if (!data) return; // images and other content: the image import takes it
      e.preventDefault();
      e.stopImmediatePropagation();
      paste(data, here);
    };
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod && !(e.shiftKey && e.key === "F10") && e.key !== "ContextMenu") return;
      if (isTyping(e.target) || inLayer(e.target) || state.current.doc.live) return;
      const code = e.code;
      let cmd: LayerCommand | null = null;
      if (code === "KeyV" && e.shiftKey && !e.altKey) {
        // Browsers don't all send a paste event for ⇧⌘V outside a text field: paste the layers copied in this
        // browser instead (the system clipboard can't be read without one).
        e.preventDefault();
        if (recalled()) run("paste-in-place");
        else inPlace.current = true; // a paste event may still follow
        return;
      }
      if (code === "KeyG") cmd = e.altKey ? "frame" : e.shiftKey ? "ungroup" : "group";
      else if (code === "BracketRight") cmd = e.altKey ? "front" : "forward";
      else if (code === "BracketLeft") cmd = e.altKey ? "back" : "backward";
      else if (code === "KeyH" && e.shiftKey) cmd = "toggle-visible";
      else if (code === "KeyL" && e.shiftKey) cmd = "toggle-locked";
      else if (code === "KeyR" && !e.shiftKey && !e.altKey) cmd = "rename";
      else if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
        e.preventDefault();
        openAtFocus();
        return;
      }
      if (!cmd) return;
      e.preventDefault();
      e.stopPropagation();
      run(cmd);
    };
    window.addEventListener("copy", copy);
    window.addEventListener("cut", cut);
    window.addEventListener("paste", onPaste, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("copy", copy);
      window.removeEventListener("cut", cut);
      window.removeEventListener("paste", onPaste, true);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, paste]);

  /** The keyboard's menu key or Shift+F10: the menu opens at the focused layer row, or the middle of the canvas. */
  const openAtFocus = () => {
    const el = document.activeElement;
    const inLayers = el instanceof HTMLElement && el.closest(".layer-list") !== null;
    const r = (inLayers ? el : document.querySelector(".canvas-area"))?.getBoundingClientRect();
    if (!r) return;
    setMenu({ x: inLayers ? r.left + 24 : r.left + r.width / 2, y: inLayers ? r.bottom : r.top + r.height / 2, from: inLayers ? "layers" : "canvas" });
  };

  const openMenu = useCallback((x: number, y: number, from: "canvas" | "layers") => setMenu({ x, y, from }), []);

  const sel = selection;
  const has = sel.length > 0;
  const nodes = sel.map((id) => doc.get(id)).filter((n) => !!n);
  const canUngroup = nodes.some((n) => n.type === "GROUP" || n.type === "FRAME" || n.type === "SECTION");
  const anyVisible = nodes.some((n) => n.visible);
  const anyUnlocked = nodes.some((n) => !n.locked);
  const noEdit = locked || !has;
  const entries: ContextEntry<LayerCommand>[] = [
    { value: "copy", label: "Copy", shortcut: "⌘C", disabled: !has },
    { value: "cut", label: "Cut", shortcut: "⌘X", disabled: noEdit },
    { value: "paste", label: "Paste here", shortcut: "⌘V", disabled: locked },
    { value: "paste-in-place", label: "Paste to replace position", shortcut: "⇧⌘V", disabled: locked },
    { value: "duplicate", label: "Duplicate", shortcut: "⌘D", disabled: noEdit },
    { value: "delete", label: "Delete", shortcut: "⌫", disabled: noEdit },
    { kind: "separator" },
    { value: "front", label: "Bring to front", shortcut: "⌥⌘]", disabled: noEdit },
    { value: "forward", label: "Bring forward", shortcut: "⌘]", disabled: noEdit },
    { value: "backward", label: "Send backward", shortcut: "⌘[", disabled: noEdit },
    { value: "back", label: "Send to back", shortcut: "⌥⌘[", disabled: noEdit },
    { kind: "separator" },
    { value: "group", label: "Group selection", shortcut: "⌘G", disabled: noEdit },
    { value: "frame", label: "Frame selection", shortcut: "⌥⌘G", disabled: noEdit },
    { value: "ungroup", label: "Ungroup", shortcut: "⇧⌘G", disabled: noEdit || !canUngroup },
    { kind: "separator" },
    { value: "toggle-visible", label: anyVisible || !has ? "Hide" : "Show", shortcut: "⇧⌘H", disabled: noEdit },
    { value: "toggle-locked", label: anyUnlocked || !has ? "Lock" : "Unlock", shortcut: "⇧⌘L", disabled: noEdit },
    { value: "rename", label: "Rename", shortcut: "⌘R", disabled: noEdit || sel.length !== 1 },
    { value: "select-parent", label: "Select parent", shortcut: "⎋", disabled: !has },
  ];
  const element: ReactElement | null = menu ? (
    <ContextMenu x={menu.x} y={menu.y} label={menu.from === "layers" ? "Layer actions" : "Canvas actions"} entries={entries} onSelect={run} onClose={() => setMenu(null)} />
  ) : null;

  return { run, openMenu, menu: element };
}
