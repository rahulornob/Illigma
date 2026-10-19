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
 *
 * A new layer with no text yet is never kept: not on blur, not when a save
 * settles open edits, not when an IME composition starts. It stays an open
 * live edit (so it is neither saved nor journaled), and leaving it, or a save
 * that has to settle it (`settleTextForSave`), removes it with no undo step.
 * Typography changes made to it meanwhile go into it (`patchNew`).
 */

import type { Document, LiveEdit, ReadonlyNode } from "@illigma/core";
import type { Node, NodeId } from "@illigma/format";
import { autoName } from "./selection";

export type EditKind = "insert" | "delete" | "paste" | "ime";

const LABEL: Record<EditKind, string> = { insert: "Type text", delete: "Delete text", paste: "Paste text", ime: "Type text" };

/** Typing and IME input are the same kind of burst (a composition in a new layer stays in its "Add text" step). */
const sameKind = (a: EditKind | null, b: EditKind): boolean => (a === "ime" ? "insert" : a) === (b === "ime" ? "insert" : b);

/** A text layer not in the document yet: created by the first edit (an "Add text" step). */
export interface NewText {
  parent: NodeId;
  fields: Partial<Omit<Node, "id" | "type" | "parentId" | "index">>;
}

/** The text session editing in each document (one at a time). */
const active = new WeakMap<Document, TextSession>();

/** The session editing text in `doc`, if any. */
export const textSessionOf = (doc: Document): TextSession | undefined => active.get(doc);

/**
 * Before a save or journal flush that settles open edits: a new text layer
 * with no text is removed (no undo step), and a layer whose text was all
 * deleted is removed with that step, so an empty layer never reaches the
 * file. Editing it ends. Returns true if one was removed.
 */
export function settleTextForSave(doc: Document): boolean {
  return active.get(doc)?.settleForSave() ?? false;
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
    active.set(doc, this);
    // A new layer exists from the start (empty), inside an open "Add text" edit, so the caret has a box to sit in.
    if (create) this.edit("", "insert");
  }

  /** True while the layer is new and still has no text: it is not kept until something is typed. */
  get emptyNew(): boolean {
    return this.creating && this.text === "";
  }

  /**
   * True while an open burst has deleted all of an existing layer's text: it
   * isn't kept as a step of its own, so leaving the text (which removes the
   * empty layer) is one undo step with the deleting ("Delete text").
   */
  get emptied(): boolean {
    return this.#creating === null && this.#live?.open === true && this.text === "";
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
    if (this.#live && !sameKind(this.#kind, kind) && !this.creating) this.#keep();
    if (this.#live && !sameKind(this.#kind, kind) && this.creating && text !== "") this.commit();
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
   * open, never kept, so leaving it (or a reload) removes it without a trace;
   * so does a burst that deleted all of a layer's text (`emptied`), so that
   * clearing and removing the layer are one step.
   */
  commit(): void {
    if (this.emptyNew || this.emptied) return;
    this.#keep();
  }

  /** Keep the open burst as an undo step, whatever it holds. */
  #keep(): void {
    const live = this.#live;
    if (!live?.open) {
      this.#ended();
      return;
    }
    live.commit();
    this.#live = null;
    this.#kind = null;
    this.#creating = null;
  }

  /**
   * An open burst that deleted all of the layer's text: the layer is removed
   * in that same step ("Delete text"), so one undo brings back the layer and
   * its text. Returns true if it was removed.
   */
  #removeEmptied(): boolean {
    const live = this.#live;
    if (!live || !this.emptied) return false;
    live.update((tx) => {
      if (this.doc.has(this.id)) tx.delete(this.id);
    });
    this.#keep();
    return true;
  }

  /**
   * Before a save or journal flush that settles open edits: an empty new
   * layer goes with no step; a layer whose text was all deleted goes with
   * its "Delete text" step. Either way editing it ends. Returns true if one went.
   */
  settleForSave(): boolean {
    return this.dropIfEmptyNew() || this.#removeEmptied();
  }

  /**
   * Leave the text. Empty text is removed, as in Figma: a new layer with no
   * text leaves no undo step; one that had text is deleted as its own step.
   * Returns true if the layer still exists.
   */
  finish(): boolean {
    if (active.get(this.doc) === this) active.delete(this.doc);
    if (this.dropIfEmptyNew() || this.#removeEmptied()) return false;
    this.commit();
    const n = this.node;
    if (!n) return false;
    if ((n.characters ?? "") === "" && !this.doc.live) {
      this.doc.transact("Delete empty text", (tx) => tx.delete(this.id));
      return false;
    }
    return true;
  }

  /** Remove a new layer that still has no text (no undo step). Returns true if it was removed. */
  dropIfEmptyNew(): boolean {
    if (!this.emptyNew) return false;
    this.#live?.cancel();
    this.#live = null;
    this.#kind = null;
    this.#creating = null;
    return true;
  }

  /**
   * Typography changes (font, size, alignment…) to a new layer that has no
   * text yet: they become part of its "Add text" step, since it isn't kept
   * yet and other edits wait for it. Returns false if the layer isn't new and empty.
   */
  patchNew(patch: Readonly<Record<string, unknown>>): boolean {
    const create = this.#creating;
    const live = this.#live;
    if (!create || !live?.open || !this.emptyNew) return false;
    const fields: Record<string, unknown> = { ...create.fields };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete fields[k];
      else fields[k] = v;
    }
    this.#creating = { ...create, fields: fields as NewText["fields"] };
    const next = this.#creating;
    live.update((tx) => {
      if (!this.doc.has(this.id)) tx.create("TEXT", next.parent, { ...next.fields, characters: "", name: autoName("") }, "last", this.id);
    });
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
    if (this.emptyNew) return this.finish();
    // The burst is kept first (even one that emptied the text), then undone as a step of its own.
    this.#keep();
    if (this.doc.live) return this.doc.has(this.id);
    if (which === "undo") this.doc.undo();
    else this.doc.redo();
    return this.doc.has(this.id);
  }
}
