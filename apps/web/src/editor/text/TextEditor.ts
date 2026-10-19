/**
 * Editing a text layer on the canvas (interactions.md §6).
 *
 * The text is drawn by the renderer as always; this draws only the caret
 * and the selection over it, from the renderer's own line layout
 * (`TextEngine.layout`: CanvasKit's glyph positions), so they sit exactly on
 * the drawn glyphs at any zoom and rotation.
 *
 * Keyboard input goes through a hidden `<textarea>` that holds the layer's
 * text and selection. It is the focus target (with an accessible name), so
 * the browser does typing, Backspace and Delete (word and line deletion
 * too), plain-text copy, cut and paste, and IME composition; each `input`
 * event writes the textarea's text to the document through a `TextSession`
 * (one undo step per typing burst). Caret moves that depend on the drawn
 * lines (↑ ↓, line start and end) and word moves are done here, from the
 * line layout, so they match the canvas rather than the hidden textarea.
 */

import type { Document, ReadonlyNode } from "@illigma/core";
import type { NodeId } from "@illigma/format";
import type { Camera, TextEngine, TextLayout } from "@illigma/renderer";
import { fromSpace, placementOf, toSpace, type Placement } from "../geometry";
import { TextSession, type EditKind, type NewText } from "./session";
import {
  caretAt,
  clampSelection,
  collapsed,
  diffRange,
  lineEnd,
  lineStart,
  moveVertical,
  paragraphRange,
  selEnd,
  selStart,
  wordLeft,
  wordRange,
  wordRight,
  type TextSelection,
} from "./selection";

/** A typing burst ends after this long without a key (one undo step per burst). */
export const BURST_IDLE_MS = 1000;
/**
 * …and after this long in any case: continuous typing, or an IME composition
 * left open, is kept (saved and journaled) at least this often. The caret
 * stays; the next key starts a new burst.
 */
export const BURST_MAX_MS = 2000;

/**
 * Keys with ⌘ (Ctrl elsewhere) that the text input needs itself: clipboard
 * and word or line deletion. Every other ⌘ shortcut (⌘S, ⌘D, ⌘P, ⌘= ⌘- ⌘0,
 * ⇧⌘E…) goes on to the editor, which keeps the browser's action from running.
 */
const INPUT_COMMANDS = new Set(["c", "x", "v", "backspace", "delete", "insert"]);
/** Pressing ⌘ itself (before the letter) is no shortcut yet. */
const MODIFIER_KEYS = new Set(["Meta", "Control", "Shift", "Alt", "OS"]);

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export interface TextEditorHost {
  doc(): Document;
  engine(): TextEngine | null;
  camera(): Camera;
  /** Draw the canvas again (the caret moves with it). */
  requestDraw(): void;
  /** Editing started on `id`: it should be the selection. */
  started(id: NodeId): void;
  /** Editing ended; `exists` is false when the layer was empty and removed. */
  ended(id: NodeId, exists: boolean): void;
}

/** Where editing starts: all text selected (Enter), the end, or the index nearest to a point in the layer. */
export type StartAt = "all" | "end" | { x: number; y: number };

export class TextEditor {
  /** The caret and selection, over the canvas; never takes pointer events. */
  readonly layer: HTMLDivElement;
  /** The hidden input: focus target, keyboard, clipboard and IME. */
  readonly input: HTMLTextAreaElement;
  private readonly caretEl: HTMLDivElement;
  private readonly rangesEl: HTMLDivElement;
  private session: TextSession | null = null;
  private sel: TextSelection = caretAt(0);
  /** The x ↑ and ↓ aim for, kept across vertical moves. */
  private goalX: number | null = null;
  private composing = false;
  private idle = 0;
  /** When the open typing burst began (performance.now), or null when none is open. */
  private burstStart: number | null = null;
  private dragAnchor: [number, number] | null = null;
  private cached: { node: ReadonlyNode; layout: TextLayout } | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly host: TextEditorHost,
    parent: HTMLElement,
  ) {
    this.layer = document.createElement("div");
    this.layer.className = "text-edit";
    this.layer.setAttribute("aria-hidden", "true");
    this.rangesEl = document.createElement("div");
    this.caretEl = document.createElement("div");
    this.caretEl.className = "text-caret";
    this.layer.append(this.rangesEl, this.caretEl);
    this.input = document.createElement("textarea");
    this.input.className = "text-input";
    this.input.setAttribute("autocomplete", "off");
    this.input.setAttribute("autocapitalize", "off");
    this.input.setAttribute("autocorrect", "off");
    this.input.spellcheck = false;
    this.input.wrap = "off";
    this.input.tabIndex = -1;
    this.input.hidden = true;
    parent.append(this.layer, this.input);
    this.input.addEventListener("keydown", this.onKey);
    this.input.addEventListener("beforeinput", this.onBeforeInput);
    this.input.addEventListener("input", this.onInput);
    this.input.addEventListener("compositionstart", this.onCompositionStart);
    this.input.addEventListener("compositionend", this.onCompositionEnd);
    this.input.addEventListener("blur", this.onBlur);
    document.addEventListener("selectionchange", this.onSelectionChange);
  }

  /** The layer being edited, or null. */
  get editing(): NodeId | null {
    return this.session?.id ?? null;
  }

  /** Start editing text layer `id`. */
  start(id: NodeId, at: StartAt = "all"): void {
    const doc = this.host.doc();
    const n = doc.get(id);
    if (!n || n.type !== "TEXT") return;
    if (this.session) this.stop(false);
    this.begin(new TextSession(doc, id));
    const text = this.session?.text ?? "";
    if (at === "all") this.sel = { anchor: 0, focus: text.length };
    else if (at === "end") this.sel = caretAt(text.length);
    else this.sel = caretAt(this.layout()?.indexAt(at.x, at.y) ?? text.length);
    this.syncInput();
  }

  /** Create a text layer (in one "Add text" step with what is typed first) and edit it. */
  create(id: NodeId, spec: NewText): void {
    if (this.session) this.stop(false);
    this.begin(new TextSession(this.host.doc(), id, spec));
    this.sel = caretAt(0);
    this.syncInput();
  }

  /**
   * Leave editing: keep what was typed and remove the layer if it is empty.
   * Tells the host (`ended`, which selects the layer) unless `quiet`: the
   * selection moved elsewhere already, which is why editing stops.
   */
  stop(focusCanvas = true, quiet = false): void {
    const s = this.session;
    if (!s) return;
    this.endBurstTimer();
    this.burstStart = null;
    this.session = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.dragAnchor = null;
    this.composing = false;
    this.dropLayout();
    let exists = false;
    try {
      exists = s.finish();
    } finally {
      this.input.hidden = true;
      this.input.value = "";
      this.layer.style.display = "none";
      if (focusCanvas && document.activeElement === this.input) this.input.blur();
      if (!quiet) this.host.ended(s.id, exists);
      this.host.requestDraw();
    }
  }

  /**
   * End the current typing burst now (before something else edits the
   * document). A new layer with no text yet stays open: it is never kept empty.
   */
  settle(): void {
    this.endBurstTimer();
    this.session?.commit();
    if (!this.session?.pending) this.burstStart = null;
  }

  /** True if the world point (wx, wy) is inside the layer being edited. */
  contains(wx: number, wy: number, slop = 0): boolean {
    const n = this.session?.node;
    if (!n) return false;
    const p = toSpace(this.placement(), wx, wy);
    const h = Math.max(n.height, this.layout()?.height ?? 0);
    return p.x >= -slop && p.y >= -slop && p.x <= n.width + slop && p.y <= h + slop;
  }

  /** A press on the layer being edited: 1 click places the caret (Shift extends), 2 select a word, 3 a paragraph. */
  pointerDown(wx: number, wy: number, clicks: number, shift: boolean): void {
    const layout = this.layout();
    if (!layout || !this.session) return;
    const p = toSpace(this.placement(), wx, wy);
    const i = layout.indexAt(p.x, p.y);
    this.settle();
    this.goalX = null;
    const text = layout.text;
    if (clicks >= 3) {
      const [a, b] = paragraphRange(text, i);
      this.sel = { anchor: a, focus: b };
      this.dragAnchor = [a, b];
    } else if (clicks === 2) {
      const [a, b] = wordRange(text, i);
      this.sel = { anchor: a, focus: b };
      this.dragAnchor = [a, b];
    } else {
      this.sel = shift ? { anchor: this.sel.anchor, focus: i } : caretAt(i);
      this.dragAnchor = [this.sel.anchor, this.sel.anchor];
    }
    this.syncInput();
  }

  /** A drag that started on the text extends the selection. */
  pointerMove(wx: number, wy: number): void {
    const layout = this.layout();
    if (!layout || !this.dragAnchor) return;
    const p = toSpace(this.placement(), wx, wy);
    const i = layout.indexAt(p.x, p.y);
    const [a, b] = this.dragAnchor;
    this.sel = i < a ? { anchor: b, focus: i } : { anchor: a, focus: Math.max(i, b) };
    this.syncInput();
  }

  pointerUp(): void {
    this.dragAnchor = null;
  }

  get dragging(): boolean {
    return this.dragAnchor !== null;
  }

  /** Place the caret and selection over the canvas for the current camera. Called on every frame. */
  render(): void {
    const s = this.session;
    const n = s?.node;
    const layout = n ? this.layout() : null;
    if (!s || !n || !layout) {
      this.layer.style.display = "none";
      return;
    }
    const cam = this.host.camera();
    const z = cam.zoom;
    const p = this.placement();
    const dpr = window.devicePixelRatio || 1;
    const snap = (v: number) => Math.round(v * dpr) / dpr;
    const origin = { x: (p.x - cam.x) * z, y: (p.y - cam.y) * z };
    this.layer.style.display = "block";
    this.layer.style.transform = `translate(${snap(origin.x)}px, ${snap(origin.y)}px)${p.rotation ? ` rotate(${p.rotation}deg)` : ""}`;
    const rects = layout.rangeRects(selStart(this.sel), selEnd(this.sel));
    while (this.rangesEl.children.length > rects.length) this.rangesEl.lastElementChild?.remove();
    rects.forEach((r, i) => {
      let el = this.rangesEl.children[i] as HTMLElement | undefined;
      if (!el) {
        el = document.createElement("div");
        el.className = "text-range";
        this.rangesEl.append(el);
      }
      el.style.transform = `translate(${r.x * z}px, ${r.y * z}px)`;
      el.style.width = `${Math.max(1, r.width * z)}px`;
      el.style.height = `${r.height * z}px`;
    });
    const c = layout.caret(this.sel.focus);
    this.caretEl.style.display = collapsed(this.sel) ? "block" : "none";
    this.caretEl.style.transform = `translate(${c.x * z - 1}px, ${c.y * z}px)`;
    this.caretEl.style.height = `${c.height * z}px`;
    // The hidden input follows the caret, so the IME's candidate window opens next to it.
    const at = fromSpace(p, c.x, c.y + c.height);
    this.input.style.transform = `translate(${(at.x - cam.x) * z}px, ${(at.y - cam.y) * z - c.height * z}px)`;
    this.input.style.height = `${Math.max(12, c.height * z)}px`;
  }

  dispose(): void {
    if (this.session) this.stop(false);
    this.dropLayout();
    this.input.removeEventListener("keydown", this.onKey);
    this.input.removeEventListener("beforeinput", this.onBeforeInput);
    this.input.removeEventListener("input", this.onInput);
    this.input.removeEventListener("compositionstart", this.onCompositionStart);
    this.input.removeEventListener("compositionend", this.onCompositionEnd);
    this.input.removeEventListener("blur", this.onBlur);
    document.removeEventListener("selectionchange", this.onSelectionChange);
    this.layer.remove();
    this.input.remove();
  }

  // ---- internals ----

  private begin(session: TextSession): void {
    this.session = session;
    this.goalX = null;
    this.unsubscribe = session.doc.subscribe(() => this.onDocChange());
    const n = session.node;
    this.input.hidden = false;
    this.input.setAttribute("aria-label", `Edit text: ${n?.name ?? "Text"}. Escape to finish.`);
    this.input.value = session.text;
    this.host.started(session.id);
    this.input.focus({ preventScroll: true });
  }

  private placement(): Placement {
    const s = this.session;
    return s ? placementOf(s.doc, s.id) : { x: 0, y: 0, rotation: 0 };
  }

  /** The edited layer laid out, cached until it changes (nodes are replaced on every change). */
  private layout(): TextLayout | null {
    const n = this.session?.node;
    const engine = this.host.engine();
    if (!n || !engine) return null;
    if (this.cached?.node === n) return this.cached.layout;
    this.dropLayout();
    const layout = engine.layout(n);
    if (layout) this.cached = { node: n, layout };
    return layout;
  }

  private dropLayout(): void {
    this.cached?.layout.dispose();
    this.cached = null;
  }

  /** Mirror the model's selection (and text) into the hidden input, then draw. */
  private syncInput(): void {
    const s = this.session;
    if (!s) return;
    if (!this.composing && this.input.value !== s.text) this.input.value = s.text;
    this.sel = clampSelection(this.sel, this.input.value.length);
    const dir = this.sel.focus < this.sel.anchor ? "backward" : "forward";
    if (!this.composing) this.input.setSelectionRange(selStart(this.sel), selEnd(this.sel), dir);
    this.restartBlink();
    this.host.requestDraw();
  }

  private restartBlink(): void {
    this.caretEl.classList.remove("is-blinking");
    void this.caretEl.offsetWidth;
    this.caretEl.classList.add("is-blinking");
  }

  /** The document changed (an edit here, an undo, a panel): follow it. */
  private onDocChange(): void {
    const s = this.session;
    if (!s) return;
    if (!s.node) {
      if (!s.pending) this.stop(false);
      return;
    }
    if (!this.composing && this.input.value !== s.text) {
      // Changed elsewhere (undo, a panel): put the caret after the change.
      const d = diffRange(this.input.value, s.text);
      this.input.value = s.text;
      this.sel = caretAt(d.nextEnd);
      this.syncInput();
    }
    this.host.requestDraw();
  }

  private endBurstTimer(): void {
    if (this.idle) clearTimeout(this.idle);
    this.idle = 0;
  }

  /** How long the open burst has run (0 when none is open). */
  private burstAge(): number {
    return this.burstStart === null ? 0 : performance.now() - this.burstStart;
  }

  /** End the burst after a pause (1 s), or once it is `BURST_MAX_MS` old, even mid-composition. */
  private restartBurstTimer(): void {
    this.endBurstTimer();
    const left = Math.max(0, BURST_MAX_MS - this.burstAge());
    this.idle = window.setTimeout(
      () => {
        this.idle = 0;
        if (this.composing && this.burstAge() < BURST_MAX_MS) {
          this.restartBurstTimer();
          return;
        }
        this.settle();
      },
      this.composing ? left : Math.min(BURST_IDLE_MS, left),
    );
  }

  private apply(kind: EditKind): void {
    const s = this.session;
    if (!s) return;
    const text = this.input.value;
    const start = this.input.selectionStart;
    const end = this.input.selectionEnd;
    this.sel = this.input.selectionDirection === "backward" ? { anchor: end, focus: start } : { anchor: start, focus: end };
    if (text !== s.text) {
      // A burst starts with its first change (for a new layer, with its first character).
      if (!s.pending || s.emptyNew) this.burstStart = performance.now();
      s.edit(text, kind);
      // Never longer than BURST_MAX_MS: kept now, the next key starts a new burst.
      if (this.burstAge() >= BURST_MAX_MS) this.settle();
      else this.restartBurstTimer();
    }
    this.goalX = null;
    this.restartBlink();
    this.host.requestDraw();
  }

  private undo(which: "undo" | "redo"): void {
    const s = this.session;
    if (!s) return;
    this.endBurstTimer();
    this.burstStart = null;
    const exists = s.step(which);
    if (!exists) {
      this.stop();
      return;
    }
    this.onDocChange();
  }

  private move(focus: number, extend: boolean, keepGoal = false): void {
    this.settle();
    if (!keepGoal) this.goalX = null;
    this.sel = extend ? { anchor: this.sel.anchor, focus } : caretAt(focus);
    this.syncInput();
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    const s = this.session;
    if (!s || e.isComposing || e.keyCode === 229) return; // keys inside an IME composition are the IME's
    const mod = IS_MAC ? e.metaKey : e.ctrlKey;
    const word = IS_MAC ? e.altKey : e.ctrlKey;
    const k = e.key;
    const text = this.input.value;
    const layout = this.layout();
    const handled = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    if (k === "Escape") {
      handled();
      this.stop();
      return;
    }
    if (mod && (k === "z" || k === "Z")) {
      handled();
      this.undo(e.shiftKey ? "redo" : "undo");
      return;
    }
    if (mod && !IS_MAC && (k === "y" || k === "Y")) {
      handled();
      this.undo("redo");
      return;
    }
    if (mod && (k === "a" || k === "A")) {
      handled();
      this.settle();
      this.sel = { anchor: 0, focus: text.length };
      this.syncInput();
      return;
    }
    // Rich-text shortcuts (bold, italic, underline) are per character in Figma; whole-layer styles come from the panel.
    if (mod && /^[biu]$/i.test(k)) {
      handled();
      return;
    }
    if (k === "Tab") {
      // Focus moves on (the browser does it); editing ends, as Escape does, so Tab never types into the layer.
      this.stop(false);
      return;
    }
    const extend = e.shiftKey;
    const focus = this.sel.focus;
    if (k === "ArrowLeft" || k === "ArrowRight") {
      handled();
      const left = k === "ArrowLeft";
      if (IS_MAC && e.metaKey && layout) this.move(left ? lineStart(layout, focus) : lineEnd(layout, focus), extend);
      else if (word) this.move(left ? wordLeft(text, focus) : wordRight(text, focus), extend);
      else if (!extend && !collapsed(this.sel)) this.move(left ? selStart(this.sel) : selEnd(this.sel), false);
      else if (layout) this.move(left ? layout.before(focus) : layout.after(focus), extend);
      return;
    }
    if (k === "ArrowUp" || k === "ArrowDown") {
      handled();
      const up = k === "ArrowUp";
      if ((IS_MAC && e.metaKey) || !layout) {
        this.move(up ? 0 : text.length, extend);
        return;
      }
      const from = !extend && !collapsed(this.sel) ? (up ? selStart(this.sel) : selEnd(this.sel)) : focus;
      const goal = this.goalX ?? layout.caret(from).x;
      const to = moveVertical(layout, from, up ? -1 : 1, goal);
      this.move(to, extend, true);
      this.goalX = goal;
      return;
    }
    if (k === "Home" || k === "End") {
      handled();
      const start = k === "Home";
      if (e.ctrlKey || e.metaKey || !layout) this.move(start ? 0 : text.length, extend);
      else this.move(start ? lineStart(layout, focus) : lineEnd(layout, focus), extend);
      return;
    }
    // ⌘ shortcuts the input doesn't need are the editor's (save, export, zoom…): the burst is kept first,
    // so they see the text as typed. On macOS, Ctrl+letter stays with the input (its text editing keys).
    if (mod && !INPUT_COMMANDS.has(k.toLowerCase()) && !MODIFIER_KEYS.has(k)) {
      this.settle();
      return;
    }
    // Everything else (typing, Enter, Backspace, Delete, clipboard) is the textarea's: see onInput. Keep it from the editor's shortcuts.
    e.stopPropagation();
  };

  private readonly onBeforeInput = (e: InputEvent): void => {
    if (e.inputType === "historyUndo" || e.inputType === "historyRedo") {
      e.preventDefault();
      this.undo(e.inputType === "historyUndo" ? "undo" : "redo");
    }
  };

  private readonly onInput = (e: Event): void => {
    const type = (e as InputEvent).inputType ?? "";
    if (this.composing || (e as InputEvent).isComposing) {
      // The composition is shown in the layer as it is typed; it is kept as a step when it ends.
      this.apply("ime");
      return;
    }
    const kind: EditKind = type === "insertFromPaste" || type === "insertFromDrop" || type === "deleteByCut" || type === "deleteByDrag" ? "paste" : type.startsWith("delete") ? "delete" : "insert";
    this.apply(kind);
  };

  private readonly onCompositionStart = (): void => {
    this.settle();
    this.composing = true;
  };

  private readonly onCompositionEnd = (): void => {
    this.composing = false;
    this.apply("ime");
    this.settle();
  };

  private readonly onBlur = (): void => {
    // Focus went to a panel or another app: keep what was typed, so other edits can run. Editing goes on.
    // A new layer with no text isn't kept (nothing to save); Typography changes go into it (`patchNew`).
    this.settle();
  };

  private readonly onSelectionChange = (): void => {
    if (!this.session || document.activeElement !== this.input || this.composing) return;
    const start = this.input.selectionStart;
    const end = this.input.selectionEnd;
    const next = this.input.selectionDirection === "backward" ? { anchor: end, focus: start } : { anchor: start, focus: end };
    if (next.anchor === this.sel.anchor && next.focus === this.sel.focus) return;
    this.sel = next;
    this.host.requestDraw();
  };
}
