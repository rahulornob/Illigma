/**
 * Canvas text: the caret and selection model (word, paragraph and line
 * moves), the typing session's undo steps, Text tool placement, and the
 * Typography card's patches.
 */

import { describe, expect, it } from "vitest";
import { Document, type ReadonlyNode } from "@illigma/core";
import { relayout, type TextMeasure } from "@illigma/layout";
import type { NodeId } from "@illigma/format";
import { newTextFields, textPlacement } from "./create";
import { letterSpacingIn, lineHeightIn, lineHeightView, resizePatch, setTextProps, typedLineHeight } from "./props";
import { autoName, diffRange, lineEnd, lineStart, moveVertical, paragraphRange, wordLeft, wordRange, wordRight, type LineLayout } from "./selection";
import { TextSession } from "./session";
import { effectiveSizing, setSizing, sizingOptions, storedSizing } from "../layout-model";

/** A monospace layout: 10 px per character, 20 px lines, wrapping at `cols` characters (soft wraps keep the space on the line). */
function mono(text: string, cols = 1000): LineLayout {
  const lines: { start: number; end: number; endTrimmed: number; top: number; bottom: number }[] = [];
  let start = 0;
  const push = (end: number, next: number) => {
    let trimmed = end;
    while (trimmed > start && text.charAt(trimmed - 1) === " ") trimmed--;
    lines.push({ start, end, endTrimmed: trimmed, top: lines.length * 20, bottom: lines.length * 20 + 20 });
    start = next;
  };
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length) push(i, i);
    else if (text.charAt(i) === "\n") push(i, i + 1);
    else if (i - start >= cols) push(i, i);
  }
  const lineAt = (index: number) => {
    let l = 0;
    while (l + 1 < lines.length && (lines[l + 1] as { start: number }).start <= index) l++;
    return l;
  };
  return {
    text,
    lines,
    lineAt,
    caret: (i) => {
      const l = lineAt(i);
      const line = lines[l] as { start: number; top: number };
      return { x: (i - line.start) * 10, y: line.top, height: 20 };
    },
    indexAt: (x, y) => {
      const l = Math.max(0, Math.min(lines.length - 1, Math.floor(y / 20)));
      const line = lines[l] as { start: number; end: number };
      return Math.max(line.start, Math.min(line.end, line.start + Math.round(x / 10)));
    },
    before: (i) => Math.max(0, i - 1),
    after: (i) => Math.min(text.length, i + 1),
  };
}

describe("selection model", () => {
  it("finds the word at an index (double-click)", () => {
    const t = "Hello, wide world";
    expect(wordRange(t, 0)).toEqual([0, 5]);
    expect(wordRange(t, 3)).toEqual([0, 5]);
    expect(wordRange(t, 5)).toEqual([0, 5]); // just after a word: that word
    expect(wordRange(t, 9)).toEqual([7, 11]);
    expect(wordRange(t, t.length)).toEqual([12, 17]);
    expect(wordRange("", 0)).toEqual([0, 0]);
  });

  it("finds the paragraph at an index (triple-click), with its line break", () => {
    const t = "one\ntwo three\nfour";
    expect(paragraphRange(t, 1)).toEqual([0, 4]);
    expect(paragraphRange(t, 6)).toEqual([4, 14]);
    expect(paragraphRange(t, t.length)).toEqual([14, 18]);
  });

  it("moves by words (⌥← ⌥→), skipping spaces and punctuation", () => {
    const t = "Hello, wide world";
    expect(wordLeft(t, t.length)).toBe(12);
    expect(wordLeft(t, 12)).toBe(7);
    expect(wordLeft(t, 7)).toBe(0);
    expect(wordLeft(t, 0)).toBe(0);
    expect(wordRight(t, 0)).toBe(5);
    expect(wordRight(t, 5)).toBe(11);
    expect(wordRight(t, 11)).toBe(17);
    expect(wordRight(t, 17)).toBe(17);
  });

  it("goes to the start and end of visual lines, not hard lines", () => {
    const t = "aaaa bbbb cccc\ndd";
    const l = mono(t, 5); // "aaaa " "bbbb " "cccc" "dd"
    expect(lineStart(l, 7)).toBe(5);
    expect(lineEnd(l, 7)).toBe(9); // before the space the line wrapped at
    expect(lineEnd(l, 11)).toBe(14); // before the line break
    expect(lineStart(l, 16)).toBe(15);
    expect(lineEnd(l, 16)).toBe(17);
  });

  it("moves up and down keeping the column, to the text's ends past the first or last line", () => {
    const t = "abcdef\nab\nabcdef";
    const l = mono(t);
    expect(moveVertical(l, 4, 1, 40)).toBe(9); // a short line: its end
    expect(moveVertical(l, 9, 1, 40)).toBe(14); // the goal column comes back
    expect(moveVertical(l, 2, -1, 20)).toBe(0);
    expect(moveVertical(l, 12, 1, 20)).toBe(t.length);
  });

  it("finds what changed between two texts (caret after undo)", () => {
    expect(diffRange("Hello world", "Hello there world")).toEqual({ start: 6, prevEnd: 6, nextEnd: 12 });
    expect(diffRange("abc", "abc")).toEqual({ start: 3, prevEnd: 3, nextEnd: 3 });
    expect(diffRange("aXc", "aYYc")).toEqual({ start: 1, prevEnd: 2, nextEnd: 3 });
  });

  it("names a layer after its first line", () => {
    expect(autoName("  Hello  \nworld")).toBe("Hello");
    expect(autoName("")).toBe("Text");
    expect(autoName("\n\n")).toBe("Text");
    expect(autoName("x".repeat(150))).toHaveLength(100);
  });
});

function page() {
  const doc = new Document("Text");
  let pageId = "";
  let frame = "";
  doc.transact("Build", (tx) => {
    pageId = tx.addPage("Page");
    frame = tx.create("FRAME", pageId, { name: "Frame", width: 400, height: 400 });
  });
  return { doc, frame: frame as NodeId };
}

const newText = (parent: NodeId) => ({ parent, fields: newTextFields(textPlacement(10, 20, null), false) });

describe("typing session (undo steps)", () => {
  it("a new layer and its first burst are one step; leaving it empty leaves no step", () => {
    const { doc, frame } = page();
    const steps = () => doc.undoLabel;
    const s = new TextSession(doc, "t1", newText(frame));
    expect(doc.has("t1")).toBe(true);
    expect(s.creating).toBe(true);
    expect(s.finish()).toBe(false);
    expect(doc.has("t1")).toBe(false);
    expect(steps()).toBe("Build");
  });

  it("typing, a pause, then more typing: two steps; the layer is named after its text", () => {
    const { doc, frame } = page();
    const s = new TextSession(doc, "t2", newText(frame));
    s.edit("H", "insert");
    s.edit("Hello", "insert");
    expect(doc.get("t2")?.name).toBe("Hello");
    s.commit(); // the pause
    expect(doc.undoLabel).toBe("Add text");
    s.edit("Hello world", "insert");
    s.commit();
    expect(doc.undoLabel).toBe("Type text");
    doc.undo();
    expect(doc.get("t2")?.characters).toBe("Hello");
    doc.undo();
    expect(doc.has("t2")).toBe(false);
  });

  it("switching between typing and deleting starts a new step; paste is a step of its own", () => {
    const { doc, frame } = page();
    const s = new TextSession(doc, "t3", newText(frame));
    s.edit("abc", "insert");
    s.edit("ab", "delete"); // ends "Add text" with "abc"
    s.edit("abX", "paste"); // ends "Delete text"; the paste is kept at once
    expect(s.pending).toBe(false);
    expect(doc.undoLabel).toBe("Paste text");
    doc.undo();
    expect(doc.get("t3")?.characters).toBe("ab");
    doc.undo();
    expect(doc.get("t3")?.characters).toBe("abc");
  });

  it("undo while editing ends the burst first, then undoes it", () => {
    const { doc, frame } = page();
    const s = new TextSession(doc, "t4", newText(frame));
    s.edit("one", "insert");
    s.commit();
    s.edit("one two", "insert");
    expect(s.step("undo")).toBe(true);
    expect(doc.get("t4")?.characters).toBe("one");
    expect(s.step("redo")).toBe(true);
    expect(doc.get("t4")?.characters).toBe("one two");
    expect(s.step("undo")).toBe(true);
    expect(s.step("undo")).toBe(false); // the layer itself
  });

  it("text deleted to nothing is removed on exit, in the same step as the deleting (QC round 8)", () => {
    const { doc, frame } = page();
    const s = new TextSession(doc, "t5", newText(frame));
    s.edit("x", "insert");
    s.commit();
    s.edit("", "delete");
    s.commit(); // a pause: an emptied layer's burst stays open
    expect(s.emptied).toBe(true);
    expect(s.finish()).toBe(false);
    expect(doc.has("t5")).toBe(false);
    expect(doc.undoLabel).toBe("Delete text");
    doc.undo();
    expect(doc.get("t5")?.characters).toBe("x");
  });

  it("text emptied by another step (undo, a panel) is still removed on exit, as its own step", () => {
    const { doc, frame } = page();
    const s = new TextSession(doc, "t8", newText(frame));
    s.edit("x", "insert");
    s.commit();
    doc.transact("Clear", (tx) => tx.set("t8", "characters", ""));
    expect(s.finish()).toBe(false);
    expect(doc.undoLabel).toBe("Delete empty text");
  });

  it("undo right after deleting all the text brings it back", () => {
    const { doc, frame } = page();
    const s = new TextSession(doc, "t9", newText(frame));
    s.edit("abc", "insert");
    s.commit();
    s.edit("", "delete");
    expect(s.step("undo")).toBe(true);
    expect(doc.get("t9")?.characters).toBe("abc");
    expect(s.step("redo")).toBe(true);
    expect(doc.get("t9")?.characters).toBe("");
  });

  it("a renamed layer keeps its name", () => {
    const { doc, frame } = page();
    const s = new TextSession(doc, "t6", newText(frame));
    s.edit("a", "insert");
    s.commit();
    doc.transact("Rename", (tx) => tx.set("t6", "name", "Title"));
    s.edit("abc", "insert");
    s.commit();
    expect(doc.get("t6")?.name).toBe("Title");
  });

  it("a burst kept elsewhere (a save settles open edits) doesn't break the next key", () => {
    const { doc, frame } = page();
    const s = new TextSession(doc, "t7", newText(frame));
    s.edit("a", "insert");
    doc.live?.commit();
    s.edit("ab", "insert");
    s.commit();
    expect(doc.get("t7")?.characters).toBe("ab");
  });
});

describe("Text tool placement", () => {
  it("a click centres the first line on the point; a drag keeps its box", () => {
    expect(textPlacement(100.4, 50, null)).toEqual({ x: 100, y: 43, width: 1, height: 15 });
    expect(textPlacement(0, 0, { x: 10.2, y: 20.6, width: 119.6, height: 0.2 })).toEqual({ x: 10, y: 21, width: 120, height: 1 });
    expect(newTextFields({ x: 0, y: 0, width: 1, height: 15 }, false).textAutoResize).toBe("WIDTH_AND_HEIGHT");
    expect(newTextFields({ x: 0, y: 0, width: 120, height: 60 }, true).textAutoResize).toBe("NONE");
  });
});

describe("Typography card values", () => {
  const n = (fields: Partial<ReadonlyNode>) => ({ type: "TEXT", fontSize: 20, ...fields }) as unknown as ReadonlyNode;

  it("line height: Auto, legacy pixels, units, and switching units keeps the spacing", () => {
    expect(lineHeightView(n({}))).toEqual({ unit: "AUTO" });
    expect(lineHeightView(n({ lineHeight: 28 }))).toEqual({ unit: "PIXELS", value: 28 });
    expect(lineHeightIn(n({ lineHeight: 30 }), "PERCENT")).toEqual({ unit: "PERCENT", value: 150 });
    expect(lineHeightIn(n({ lineHeight: { unit: "PERCENT", value: 150 } }), "PIXELS")).toEqual({ unit: "PIXELS", value: 30 });
    expect(lineHeightIn(n({}), "PIXELS")).toEqual({ unit: "PIXELS", value: 24.22 });
    expect(lineHeightIn(n({ lineHeight: 30 }), "AUTO")).toBeUndefined();
    expect(typedLineHeight(n({}), 32)).toEqual({ unit: "PIXELS", value: 32 });
    expect(typedLineHeight(n({ lineHeight: { unit: "PERCENT", value: 120 } }), 140)).toEqual({ unit: "PERCENT", value: 140 });
  });

  it("letter spacing converts between pixels and percent", () => {
    expect(letterSpacingIn(n({}), "PIXELS")).toEqual({ unit: "PIXELS", value: 0 });
    expect(letterSpacingIn(n({ letterSpacing: { unit: "PERCENT", value: 10 } }), "PIXELS")).toEqual({ unit: "PIXELS", value: 2 });
    expect(letterSpacingIn(n({ letterSpacing: { unit: "PIXELS", value: 1 } }), "PERCENT")).toEqual({ unit: "PERCENT", value: 5 });
  });

  it("resize modes drop Fill where the text hugs", () => {
    expect(resizePatch(n({ layoutSizingHorizontal: "FILL", layoutSizingVertical: "FILL" }), "WIDTH_AND_HEIGHT")).toEqual({ textAutoResize: "WIDTH_AND_HEIGHT", layoutSizingHorizontal: undefined, layoutSizingVertical: undefined });
    expect(resizePatch(n({ layoutSizingHorizontal: "FILL" }), "HEIGHT")).toEqual({ textAutoResize: "HEIGHT" });
  });

  it("setTextProps changes every selected text layer in one step, and nothing else", () => {
    const { doc, frame } = page();
    let a = "";
    let r = "";
    doc.transact("Add", (tx) => {
      a = tx.create("TEXT", frame, { characters: "a" });
      r = tx.create("RECTANGLE", frame, {});
    });
    setTextProps(doc, [a, r], { fontSize: 30, textAlignHorizontal: "CENTER" }, "Change");
    expect(doc.get(a)?.fontSize).toBe(30);
    expect(doc.get(a)?.textAlignHorizontal).toBe("CENTER");
    expect(doc.undoLabel).toBe("Change");
    setTextProps(doc, [a], { textAlignHorizontal: undefined }, "Left");
    expect(doc.get(a)?.textAlignHorizontal).toBeUndefined();
  });
});

describe("text sizing (W and H menus) follows the resize mode", () => {
  /** A stand-in for the text engine: 7 px per character, 15 px lines, wrapping at the width. */
  const measure: TextMeasure = (node, width) => {
    const chars = (node.characters ?? "").length;
    const w = chars * 7;
    if (width === undefined) return { width: Math.max(1, w), height: 15 };
    return { width, height: 15 * Math.max(1, Math.ceil(w / Math.max(1, width))) };
  };

  it("Hug, Fixed and Fill map to auto width, auto height and fixed size", () => {
    const { doc, frame } = page();
    let auto = "";
    let t = "";
    doc.transact("Add", (tx) => {
      auto = tx.create("FRAME", frame, { layoutMode: "VERTICAL", width: 100, height: 100 });
      t = tx.create("TEXT", auto, { characters: "hello", textAutoResize: "WIDTH_AND_HEIGHT" });
    });
    const node = () => doc.get(t) as ReadonlyNode;
    expect(sizingOptions(doc, node())).toEqual(["FIXED", "HUG", "FILL"]);
    expect(storedSizing(node(), "width")).toBe("HUG");
    expect(storedSizing(node(), "height")).toBe("HUG");
    setSizing(doc, [t], "width", "FILL");
    expect(node().textAutoResize).toBe("HEIGHT");
    expect(effectiveSizing(doc, node(), "width")).toBe("FILL");
    expect(effectiveSizing(doc, node(), "height")).toBe("HUG");
    setSizing(doc, [t], "height", "FIXED");
    expect(node().textAutoResize).toBe("NONE");
    setSizing(doc, [t], "width", "HUG");
    expect(node().textAutoResize).toBe("WIDTH_AND_HEIGHT");
    expect(node().layoutSizingHorizontal).toBeUndefined();
    // Layout measures with the text engine (here a stand-in).
    expect(relayout(doc, [t], { measureText: measure }).filter((c) => c.id === t).map((c) => [c.key, c.value])).toEqual([["width", 35], ["height", 15]]);
  });
});
