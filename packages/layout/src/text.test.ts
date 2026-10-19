/**
 * Text in layout: auto width and auto height text measured with `measureText`,
 * Hug text in auto layout, Fill width wrapping, fixed text untouched, text
 * fields counting as layout changes, and auto width text growing from its alignment.
 */

import type { Node, NodeId } from "@illigma/format";
import { describe, expect, it } from "vitest";
import { MemoryDoc } from "./fixture.js";
import { changedIds, relayout, resize, type TextMeasure } from "./relayout.js";

/** 10 px per character, 20 px lines, wrapping at the width (by whole characters). */
const measureText: TextMeasure = (n, width) => {
  const chars = (n.characters ?? "").length;
  if (width === undefined) return { width: Math.max(1, chars * 10), height: 20 };
  const perLine = Math.max(1, Math.floor(width / 10));
  return { width, height: 20 * Math.max(1, Math.ceil(chars / perLine)) };
};

const box = (doc: MemoryDoc, id: NodeId) => {
  const n = doc.nodes.get(id) as Node;
  return { x: n.x, y: n.y, width: n.width, height: n.height };
};

describe("text in layout", () => {
  it("auto width text hugs its text; auto height wraps at its width; fixed keeps its box", () => {
    const doc = new MemoryDoc();
    doc.add("TEXT", "A", { characters: "hello", textAutoResize: "WIDTH_AND_HEIGHT", width: 1, height: 1 });
    doc.add("TEXT", "H", { characters: "hello world", textAutoResize: "HEIGHT", width: 50, height: 1 });
    doc.add("TEXT", "F", { characters: "hello world", width: 50, height: 7 });
    doc.apply(relayout(doc, ["A", "H", "F"], { measureText }));
    expect(box(doc, "A")).toMatchObject({ width: 50, height: 20 });
    expect(box(doc, "H")).toMatchObject({ width: 50, height: 60 });
    expect(box(doc, "F")).toMatchObject({ width: 50, height: 7 });
  });

  it("without a measurer, text keeps its stored box", () => {
    const doc = new MemoryDoc();
    doc.add("TEXT", "A", { characters: "hello", textAutoResize: "WIDTH_AND_HEIGHT", width: 3, height: 4 });
    expect(relayout(doc, ["A"])).toEqual([]);
    expect(relayout(doc, ["A"], { measureText: () => null })).toEqual([]);
    // A size that isn't a finite number is never stored (QC round 8).
    expect(relayout(doc, ["A"], { measureText: () => ({ width: Number.NaN, height: 20 }) })).toEqual([]);
    expect(relayout(doc, ["A"], { measureText: () => ({ width: 20, height: Number.POSITIVE_INFINITY }) })).toEqual([]);
  });

  it("Hug text in an auto layout frame reflows the frame; Fill width wraps the text", () => {
    const doc = new MemoryDoc();
    doc.add("FRAME", "C", { layoutMode: "VERTICAL", paddingLeft: 10, paddingRight: 10, paddingTop: 10, paddingBottom: 10, itemSpacing: 5, width: 1, height: 1 });
    doc.add("RECTANGLE", "R", { width: 100, height: 40 }, "C");
    doc.add("TEXT", "T", { characters: "a caption wider than the box", textAutoResize: "WIDTH_AND_HEIGHT" }, "C");
    doc.apply(relayout(doc, ["C"], { measureText }));
    expect(box(doc, "T")).toMatchObject({ x: 10, y: 55, width: 280, height: 20 });
    expect(box(doc, "C")).toMatchObject({ width: 300, height: 85 });
    // Fill width: the text wraps at the frame's inner width and hugs its height.
    doc.nodes.set("T", { ...(doc.nodes.get("T") as Node), textAutoResize: "HEIGHT", layoutSizingHorizontal: "FILL" });
    doc.nodes.set("C", { ...(doc.nodes.get("C") as Node), counterAxisSizingMode: "FIXED", width: 120 });
    doc.apply(relayout(doc, ["T", "C"], { measureText }));
    expect(box(doc, "T")).toMatchObject({ width: 100, height: 60 });
    expect(box(doc, "C")).toMatchObject({ width: 120, height: 125 });
  });

  it("a changed text field is a layout change", () => {
    expect(changedIds([{ op: "set", id: "T", key: "characters", value: "a", prev: "" }])).toEqual(["T"]);
    expect(changedIds([{ op: "set", id: "T", key: "fontSize", value: 20, prev: 12 }])).toEqual(["T"]);
    expect(changedIds([{ op: "set", id: "T", key: "textAlignHorizontal", value: "CENTER", prev: undefined }])).toEqual([]);
  });

  it("auto width text grows from its alignment: left to the right, centred both ways, right to the left", () => {
    for (const [align, x] of [
      [undefined, 100],
      ["CENTER", 75],
      ["RIGHT", 50],
    ] as const) {
      const doc = new MemoryDoc();
      doc.add("TEXT", "T", { x: 100, y: 0, characters: "hello", textAutoResize: "WIDTH_AND_HEIGHT", width: 50, height: 20, ...(align && { textAlignHorizontal: align }) });
      doc.nodes.set("T", { ...(doc.nodes.get("T") as Node), characters: "hello worl" });
      doc.apply(relayout(doc, ["T"], { measureText }));
      expect(box(doc, "T")).toEqual({ x, y: 0, width: 100, height: 20 });
    }
  });

  it("resizing auto height text reflows its height at the new width", () => {
    const doc = new MemoryDoc();
    doc.add("TEXT", "T", { characters: "hello world", textAutoResize: "HEIGHT", width: 110, height: 20 });
    doc.apply(resize(doc, "T", { width: 50 }, { measureText }));
    expect(box(doc, "T")).toMatchObject({ width: 50, height: 60 });
  });
});
