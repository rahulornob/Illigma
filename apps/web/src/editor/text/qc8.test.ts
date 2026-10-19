/**
 * QC round 8 (text): text in a font that isn't loaded keeps its stored size
 * through layout; a new text layer is never kept empty (blur, saves, IME);
 * Typography changes to an empty new layer go into its "Add text" step; a
 * font picked while another edit runs is applied when it ends.
 */

import { afterEach, describe, expect, it } from "vitest";
import { Document } from "@illigma/core";
import type { NodeId } from "@illigma/format";
import { DOCUMENT_OPTIONS, setTextMeasure } from "../layout";
import { newTextFields, textPlacement } from "./create";
import { layoutMeasure } from "./engine";
import { setTextProps, whenIdle } from "./props";
import { autoName } from "./selection";
import { settleTextForSave, TextSession, textSessionOf } from "./session";

/** A stand-in engine: 10 px per character, 20 px lines; it has the families in `have`. */
function fakeEngine(have: string[]) {
  return {
    hasFamily: (f: string) => have.includes(f),
    measure: (n: { characters?: string | undefined }, width?: number) => ({ width: width ?? Math.max(1, (n.characters ?? "").length * 10), height: 20 }),
  };
}

afterEach(() => setTextMeasure(undefined));

function page() {
  const doc = new Document("Text", DOCUMENT_OPTIONS);
  let pageId = "";
  let frame = "";
  doc.transact("Build", (tx) => {
    pageId = tx.addPage("Page");
    frame = tx.create("FRAME", pageId, { name: "Frame", width: 400, height: 400 });
  });
  return { doc, frame: frame as NodeId };
}

const newText = (parent: NodeId) => ({ parent, fields: newTextFields(textPlacement(10, 20, null), false) });

describe("text in a font that isn't loaded", () => {
  it("is not measured: layout keeps its stored size", () => {
    const m = layoutMeasure(fakeEngine(["Inter"]) as never);
    expect(m({ characters: "abc", fontFamily: "Brand Sans" } as never, undefined)).toBeNull();
    expect(m({ characters: "abc", fontFamily: "Inter" } as never, undefined)).toEqual({ width: 30, height: 20 });
    expect(m({ characters: "abc" } as never, undefined)).toEqual({ width: 30, height: 20 });
  });

  it("keeps its width and height when its parent moves or a sibling in its auto layout changes; measured once the font loads", () => {
    const have = ["Inter"];
    setTextMeasure(layoutMeasure(fakeEngine(have) as never));
    const { doc, frame } = page();
    let stack = "";
    let text = "";
    let box = "";
    doc.transact("Add", (tx) => {
      stack = tx.create("FRAME", frame, { name: "Stack", layoutMode: "VERTICAL", itemSpacing: 8 });
      box = tx.create("RECTANGLE", stack, { width: 50, height: 10 });
      text = tx.create("TEXT", stack, { characters: "Hello", fontFamily: "Brand Sans", textAutoResize: "WIDTH_AND_HEIGHT", width: 77, height: 33 });
    });
    const size = () => ({ width: doc.get(text)?.width, height: doc.get(text)?.height });
    expect(size()).toEqual({ width: 77, height: 33 });
    doc.transact("Move", (tx) => tx.set(stack, "x", 40));
    doc.transact("Taller", (tx) => tx.set(box, "height", 30));
    expect(size()).toEqual({ width: 77, height: 33 });
    // The font arrives: the next edit that reaches the text measures it in that font.
    have.push("Brand Sans");
    doc.transact("Taller", (tx) => tx.set(box, "height", 40));
    expect(size()).toEqual({ width: 50, height: 20 });
  });
});

describe("a new text layer is never kept empty", () => {
  it("ending a burst (blur, a pause, an IME composition starting) keeps nothing while it has no text", () => {
    const { doc, frame } = page();
    const s = new TextSession(doc, "e1", newText(frame));
    s.commit();
    expect(doc.live).not.toBeNull();
    expect(doc.undoLabel).toBe("Build");
    // An IME composition then commits: one "Add text" step with the text.
    s.edit("に", "ime");
    s.edit("日本", "ime");
    s.commit();
    expect(doc.undoLabel).toBe("Add text");
    doc.undo();
    expect(doc.has("e1")).toBe(false);
    expect(doc.undoLabel).toBe("Build");
  });

  it("a save that settles open edits removes it with no undo step; editing it ends", () => {
    const { doc, frame } = page();
    const s = new TextSession(doc, "e2", newText(frame));
    expect(textSessionOf(doc)).toBe(s);
    expect(settleTextForSave(doc)).toBe(true);
    expect(doc.live).toBeNull();
    expect(doc.has("e2")).toBe(false);
    expect(doc.undoLabel).toBe("Build");
    expect(doc.toFile().nodes.some((n) => n.type === "TEXT")).toBe(false);
    expect(s.finish()).toBe(false);
    expect(textSessionOf(doc)).toBeUndefined();
  });

  it("a save leaves a layer with text alone (its burst is kept by the save)", () => {
    const { doc, frame } = page();
    const s = new TextSession(doc, "e3", newText(frame));
    s.edit("Hi", "insert");
    expect(settleTextForSave(doc)).toBe(false);
    expect(doc.get("e3")?.characters).toBe("Hi");
    s.finish();
  });

  it("Typography changes to it go into its Add text step", () => {
    const { doc, frame } = page();
    const s = new TextSession(doc, "e4", newText(frame));
    s.commit(); // focus left for the panel
    expect(setTextProps(doc, ["e4"], { fontSize: 32, textAlignHorizontal: "CENTER" }, "Change font size")).toBe(true);
    expect(doc.get("e4")?.fontSize).toBe(32);
    expect(doc.undoLabel).toBe("Build");
    s.edit("Big", "insert");
    s.commit();
    expect(doc.undoLabel).toBe("Add text");
    expect(doc.get("e4")).toMatchObject({ characters: "Big", fontSize: 32, textAlignHorizontal: "CENTER" });
    doc.undo();
    expect(doc.has("e4")).toBe(false);
    // Left empty, the change leaves nothing either.
    const t = new TextSession(doc, "e5", newText(frame));
    setTextProps(doc, ["e5"], { fontSize: 40 }, "Change font size");
    expect(t.finish()).toBe(false);
    expect(doc.has("e5")).toBe(false);
  });
});

describe("a font picked while another edit runs", () => {
  it("setTextProps says it couldn't apply; whenIdle applies it once the edit ends", async () => {
    const { doc, frame } = page();
    let a = "";
    doc.transact("Add", (tx) => {
      a = tx.create("TEXT", frame, { characters: "a" });
    });
    const s = new TextSession(doc, a as NodeId);
    s.edit("ab", "insert"); // a typing burst is open
    expect(setTextProps(doc, [a], { fontFamily: "Brand Sans" }, "Font: Brand Sans")).toBe(false);
    let timedOut = false;
    whenIdle(
      doc,
      () => setTextProps(doc, [a], { fontFamily: "Brand Sans" }, "Font: Brand Sans"),
      () => (timedOut = true),
    );
    expect(doc.get(a)?.fontFamily).toBeUndefined();
    s.commit(); // the burst ends
    await Promise.resolve();
    expect(doc.get(a)?.fontFamily).toBe("Brand Sans");
    expect(doc.undoLabel).toBe("Font: Brand Sans");
    expect(timedOut).toBe(false);
  });

  it("gives up after the timeout and says so", async () => {
    const { doc, frame } = page();
    const s = new TextSession(doc, "w1", newText(frame));
    s.edit("x", "insert");
    let timedOut = false;
    whenIdle(
      doc,
      () => {},
      () => (timedOut = true),
      5,
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(timedOut).toBe(true);
    s.finish();
  });
});

describe("layer names from long text", () => {
  it("are cut between characters, never inside an emoji or a surrogate pair", () => {
    const name = autoName(`${"a".repeat(98)}😀😀 and more`);
    expect(name).toBe(`${"a".repeat(98)}…`);
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(name)).toBe(false);
    const flags = autoName(`${"a".repeat(96)}👨‍👩‍👧 tail ${"b".repeat(20)}`);
    expect(flags).toBe(`${"a".repeat(96)}…`);
    expect(autoName("short")).toBe("short");
  });
});
