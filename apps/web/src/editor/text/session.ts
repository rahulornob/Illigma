/**
 * Writing typed text to the document, with Figma-like undo steps.
 *
 * Undo granularity (documented in docs/dev/phase-1.md, "Canvas text"):
 * - A new text layer and the text typed into it until the first pause are one
 *   step, "Add text". Leaving a new layer with no text removes it with no
 *   step at all (as in Figma, a click with the Text tool then Escape leaves nothing).
 * - After that, each typing burst is one step: "Type text", "Delete text" or
 *   "Paste text". A burst ends when the person pauses (1 s), moves the caret
 *   or changes the selection, switches between typing and deleting, pastes or
 *   cuts (each is a step of its own), finishes an IME composition, undoes, or
 *   leaves the text (Escape, a click elsewhere, focus moving to a panel).
 * - Undo while editing first ends the burst, then undoes one step.
 *
 * A burst is a `LiveEdit` (`Document.beginLive`): each keystroke replaces the
 * burst's previous step, so the canvas and layout follow every key, and the
 * burst is kept as one undo step when it ends. While it is open, other edits
 * are refused, so anything else that edits (a panel) ends it first (`commit`).
 */

import type { Document, LiveEdit, ReadonlyNode } from "@illigma/core";
import type { Node, NodeId } from "@illigma/format";
import { autoName } from "./selection";

export type EditKind = "insert" | "delete" | "paste" | "ime";

const LABEL: Record<EditKind, string> = { insert: "Type text", delete: "Delete text", paste: "Paste text", ime: "Type text" };

/** A text layer not in the document yet: created by the first edit (an "Add text" step). */
export interface NewText {
  parent: NodeId;
  fields: Partial<Omit<Node, "id" | "type" | "parentId" | "index">>;
}

export class TextSession {
  #live: LiveEdit | null = null;
  #kind: EditKind | null = null;
  /** The layer is new and its "Add text" step isn't kept yet. */
  #creating: NewText | null;

  constructor(
    readonly doc: Document,
    readonly id: NodeId,
    create?: NewText,
  ) {
    this.#creating = create ?? null;
    // A new layer exists from the start (empty), inside an open "Add text" edit, so the caret has a box to sit in.
    if (create) this.edit("", "insert");
  }

  /** True while the layer is new and nothing about it is kept yet. */
  get creating(): boolean {
    return this.#creating !== null && this.#live?.open === true;
  }

  /** True while a burst is open (not yet an undo step). */
  get pending(): boolean {
    return this.#live?.open === true;
  }

  get node(): ReadonlyNode | undefined {
    return this.doc.get(this.id);
  }

  /** The layer's text now ("" when it is gone). */
  get text(): string {
    return this.node?.characters ?? "";
  }

  /** The person's text is now `text`, after an edit of `kind`. */
  edit(text: string, kind: EditKind): void {
    if (this.#live && !this.#live.open) this.#ended(); // kept elsewhere (a save settled it)
    if (this.#live && this.#kind !== kind && !this.creating) this.commit();
    if (this.#live && this.#kind !== kind && this.creating && text !== "") this.commit();
    if (!this.#live) {
      // Another live edit (a drag) can't be running while typing; if one is, it is kept first.
      if (this.doc.live) this.doc.live.commit();
      if (!this.#creating && !this.doc.has(this.id)) return;
      this.#live = this.doc.beginLive(this.#creating ? "Add text" : LABEL[kind]);
      this.#kind = kind;
    }
    const create = this.#creating;
    this.#live.update((tx) => {
      if (create && !this.doc.has(this.id)) {
        tx.create("TEXT", create.parent, { ...create.fields, characters: text, name: autoName(text) }, "last", this.id);
        return;
      }
      const n = this.doc.get(this.id);
      if (!n) return;
      // The layer is named after its text until it is renamed (Figma).
      if (n.name === autoName(n.characters ?? "")) tx.set(this.id, "name", autoName(text));
      tx.set(this.id, "characters", text);
    });
    // Paste, cut and IME commits are steps of their own.
    if (kind === "paste") this.commit();
  }

  /**
   * End the burst: keep it as one undo step. A new layer with no text stays
   * open (so leaving it removes it without a trace) unless `force` (focus
   * left for a panel, which needs the layer to exist as an edit of its own).
   */
  commit(force = false): void {
    const live = this.#live;
    if (!live?.open) {
      this.#ended();
      return;
    }
    if (this.creating && this.text === "" && !force) return;
    live.commit();
    this.#live = null;
    this.#kind = null;
    this.#creating = null;
  }

  /**
   * Leave the text. Empty text is removed, as in Figma: a new layer with no
   * text leaves no undo step; one that had text is deleted as its own step.
   * Returns true if the layer still exists.
   */
  finish(): boolean {
    if (this.creating && this.text === "") {
      this.#live?.cancel();
      this.#live = null;
      this.#creating = null;
      return false;
    }
    this.commit(true);
    const n = this.node;
    if (!n) return false;
    if ((n.characters ?? "") === "" && !this.doc.live) {
      this.doc.transact("Delete empty text", (tx) => tx.delete(this.id));
      return false;
    }
    return true;
  }

  /** The burst ended outside this session (a save kept it): nothing is pending any more. */
  #ended(): void {
    this.#live = null;
    this.#kind = null;
    this.#creating = null;
  }

  /** Undo (or redo) one step, after ending the burst. Returns false when the layer is gone after it. */
  step(which: "undo" | "redo"): boolean {
    if (this.creating && this.text === "") return this.finish();
    this.commit(true);
    if (this.doc.live) return this.doc.has(this.id);
    if (which === "undo") this.doc.undo();
    else this.doc.redo();
    return this.doc.has(this.id);
  }
}
