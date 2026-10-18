/**
 * Layout across a document: `resize` (constraints) and `relayout` (nested
 * auto layout). The first block ports the geometry of every case in the old
 * prototype's `tests/constraints.spec.js` (commit 8e3bd2f). Those were
 * browser tests; their UI steps (pin buttons, inspector, pointer capture,
 * SVG export) belong to the editor's end-to-end tests once it has a
 * constraints UI. The prototype's page positions are checked with `abs`.
 */

import type { Node } from "@illigma/format";
import { describe, expect, it } from "vitest";
import { MemoryDoc } from "./fixture.js";
import { changedIds, relayout, resize } from "./relayout.js";
import type { LayoutChange } from "./types.js";

/** The prototype's fixture: a 400 × 300 frame at (100, 100) with a 100 × 50 button at (380, 320). */
function card(button: Partial<Node> = {}) {
  const doc = new MemoryDoc();
  doc.add("FRAME", "frame", { x: 100, y: 100, width: 400, height: 300 });
  doc.add("RECTANGLE", "button", { x: 280, y: 220, width: 100, height: 50, ...button }, "frame");
  return doc;
}

const end = { constraints: { horizontal: "MAX", vertical: "MAX" } } as const;

/** No node and key is changed twice. */
function once(changes: readonly LayoutChange[]): readonly LayoutChange[] {
  const keys = changes.map((c) => `${c.id}.${c.key}`);
  expect(new Set(keys).size).toBe(keys.length);
  return changes;
}

describe("prototype cases (tests/constraints.spec.js)", () => {
  it("nested frames, hidden and locked descendants transform once; previews restore from baseline", () => {
    const doc = new MemoryDoc();
    doc.add("FRAME", "frame", { x: 100, y: 100, width: 400, height: 300 });
    doc.add("FRAME", "nested", { x: 200, y: 100, width: 180, height: 180, constraints: { horizontal: "MAX", vertical: "STRETCH" } }, "frame");
    doc.add("RECTANGLE", "child", { x: 100, y: 110, width: 60, height: 50, visible: false, locked: true, ...end }, "nested");
    const baseline = doc.clone();

    const grown = doc.clone().apply(once(resize(doc, "frame", { x: 50, y: 70, width: 600, height: 500 })));
    expect(Object.values(grown.abs("nested"))).toEqual([450, 170, 180, 380]);
    expect(Object.values(grown.abs("child"))).toEqual([550, 480, 60, 50]);

    // Each preview is computed from the document as it was before the gesture, so shrinking
    // to almost nothing and back loses nothing. Applying them one after another would.
    const tiny = resize(baseline, "frame", { x: 100, y: 100, width: 100, height: 1 });
    expect(doc.clone().apply(tiny).nodes.get("nested")?.height).toBe(1);
    expect(resize(baseline, "frame", { x: 100, y: 100, width: 400, height: 300 })).toEqual([]);
    const chained = doc.clone().apply(tiny);
    expect(chained.apply(resize(chained, "frame", { width: 400, height: 300 })).nodes.get("nested")?.height).not.toBe(180);

    // Ignoring constraints moves and resizes only the frame.
    const ignored = resize(doc, "frame", { x: 50, y: 70, width: 600, height: 500 }, { constraints: false });
    expect(new Set(ignored.map((c) => c.id))).toEqual(new Set(["frame"]));
  });

  it("pin controls: a right-and-bottom pinned button follows a numeric resize", () => {
    const doc = card(end);
    doc.apply(resize(doc, "frame", { width: 600, height: 400 }));
    expect(doc.abs("button")).toMatchObject({ x: 580, y: 420, width: 100 });
  });

  it("mixed selection: each layer keeps its own constraint on the other axis", () => {
    const doc = card({ constraints: { horizontal: "STRETCH", vertical: "MIN" } });
    doc.add("RECTANGLE", "second", { x: 20, y: 30, width: 100, height: 50, constraints: { horizontal: "STRETCH", vertical: "CENTER" } }, "frame");
    doc.apply(resize(doc, "frame", { width: 600, height: 400 }));
    expect(doc.nodes.get("button")).toMatchObject({ x: 280, y: 220, width: 300, height: 50 });
    expect(doc.nodes.get("second")).toMatchObject({ x: 20, y: 80, width: 300, height: 50 });
  });

  it("pointer preview: bypass with Ctrl/Cmd, then constraints again", () => {
    const doc = card(end);
    const drag = (constraints: boolean) => doc.clone().apply(resize(doc, "frame", { width: 480, height: 330 }, { constraints })).abs("button").x;
    expect(drag(true)).toBe(460);
    expect(drag(false)).toBe(380);
    expect(drag(true)).toBe(460);
  });

  it("nested freeform card inside auto layout resizes its constrained content", () => {
    const doc = new MemoryDoc();
    doc.add("FRAME", "frame", {
      x: 100, y: 100, width: 400, height: 300,
      layoutMode: "HORIZONTAL", primaryAxisSizingMode: "FIXED", counterAxisSizingMode: "FIXED",
      paddingLeft: 10, paddingRight: 10, paddingTop: 10, paddingBottom: 10, itemSpacing: 10,
    });
    doc.add("FRAME", "card", { x: 10, y: 10, width: 380, height: 280, layoutSizingHorizontal: "FILL", layoutSizingVertical: "FILL" }, "frame");
    doc.add("RECTANGLE", "button", { x: 260, y: 210, width: 100, height: 50, ...end }, "card");
    doc.apply(once(resize(doc, "frame", { width: 600 })));
    expect(doc.nodes.get("card")?.width).toBe(580);
    expect(doc.abs("button").x).toBe(570);
  });

  it("resizing multiple root frames applies each child constraint once", () => {
    const doc = card(end);
    doc.add("FRAME", "second-frame", { x: 600, y: 100, width: 400, height: 300 });
    doc.add("RECTANGLE", "second", { x: 280, y: 220, width: 100, height: 50, ...end }, "second-frame");
    // Scaling the 900 px selection by 0.9 from its left edge: each frame gets its own new box.
    const changes = once([...resize(doc, "frame", { width: 360 }), ...resize(doc, "second-frame", { x: 550, width: 360 })]);
    doc.apply(changes);
    expect([doc.abs("button").x, doc.abs("second").x]).toEqual([340, 790]);
    expect(["button", "second"].map((id) => [doc.nodes.get(id)?.width, doc.nodes.get(id)?.height])).toEqual([[100, 50], [100, 50]]);
  });

  it("stretched text keeps its height and gets a narrower box; Scale then scales both axes", () => {
    const doc = card();
    doc.add("TEXT", "text", { x: 20, y: 20, width: 360, height: 100, characters: "A responsive card", constraints: { horizontal: "STRETCH", vertical: "MIN" } }, "frame");
    doc.apply(resize(doc, "frame", { width: 220 }));
    expect(doc.nodes.get("text")).toMatchObject({ width: 180, height: 100 });
    doc.set("text", { constraints: { horizontal: "SCALE", vertical: "SCALE" } });
    doc.apply(resize(doc, "frame", { width: 440, height: 600 }));
    expect(doc.nodes.get("text")).toMatchObject({ x: 40, y: 40, width: 360, height: 200 });
  });
});

describe("constraints through groups", () => {
  it("each layer in a group follows the frame, then the group fits around them", () => {
    const doc = new MemoryDoc();
    doc.add("FRAME", "frame", { width: 400, height: 300 });
    doc.add("GROUP", "group", { x: 100, y: 100, width: 200, height: 100, constraints: { horizontal: "MAX", vertical: "MAX" } }, "frame");
    doc.add("RECTANGLE", "left", { x: 0, y: 0, width: 50, height: 50 }, "group");
    doc.add("RECTANGLE", "right", { x: 150, y: 50, width: 50, height: 50, ...end }, "group");
    doc.apply(resize(doc, "frame", { width: 500, height: 400 }));
    // "left" stays at (100, 100) in the frame; "right" moves by (100, 100) to (350, 250).
    expect(doc.nodes.get("group")).toMatchObject({ x: 100, y: 100, width: 300, height: 200 });
    expect(doc.abs("left")).toMatchObject({ x: 100, y: 100 });
    expect(doc.abs("right")).toMatchObject({ x: 350, y: 250 });
  });

  it("nested groups fit too", () => {
    const doc = new MemoryDoc();
    doc.add("FRAME", "frame", { width: 400, height: 300 });
    doc.add("GROUP", "outer", { x: 10, y: 10, width: 300, height: 100 }, "frame");
    doc.add("RECTANGLE", "a", { width: 10, height: 10 }, "outer");
    doc.add("GROUP", "inner", { x: 200, y: 0, width: 100, height: 100 }, "outer");
    doc.add("RECTANGLE", "b", { x: 0, y: 0, width: 100, height: 100, constraints: { horizontal: "STRETCH", vertical: "MIN" } }, "inner");
    doc.apply(resize(doc, "frame", { width: 500 }));
    expect(doc.abs("b")).toEqual({ x: 210, y: 10, width: 200, height: 100 });
    expect(doc.nodes.get("inner")).toMatchObject({ x: 200, width: 200 });
    expect(doc.nodes.get("outer")).toMatchObject({ x: 10, width: 400 });
  });
});

/** A vertical hugging list in a fixed page frame, with two hugging rows of fixed items. */
function list() {
  const doc = new MemoryDoc();
  doc.add("FRAME", "list", { x: 40, y: 40, layoutMode: "VERTICAL", itemSpacing: 8, paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16 });
  for (const r of [1, 2]) {
    doc.add("FRAME", `row${r}`, { layoutMode: "HORIZONTAL", itemSpacing: 4 }, "list");
    for (const i of [1, 2, 3]) doc.add("RECTANGLE", `r${r}i${i}`, { width: 20, height: 10 }, `row${r}`);
  }
  doc.apply(relayout(doc, ["list"], { deep: true }));
  return doc;
}

describe("relayout", () => {
  it("lays out content that was never laid out (deep)", () => {
    const doc = list();
    expect(doc.nodes.get("row1")).toMatchObject({ x: 16, y: 16, width: 68, height: 10 });
    expect(doc.nodes.get("row2")).toMatchObject({ x: 16, y: 34, width: 68, height: 10 });
    expect(doc.nodes.get("r2i3")).toMatchObject({ x: 48, y: 0 });
    expect(doc.nodes.get("list")).toMatchObject({ x: 40, y: 40, width: 100, height: 60 });
  });

  it("is idempotent: laying out again changes nothing", () => {
    const doc = list();
    expect(relayout(doc, ["list", "row1", "r1i1"], { deep: true })).toEqual([]);
  });

  it("hug propagates up: a bigger item grows its row and the list", () => {
    const doc = list();
    doc.set("r2i1", { width: 120 });
    const changes = relayout(doc, ["r2i1"]);
    expect(changes).toEqual([
      { id: "list", key: "width", value: 200 },
      { id: "row2", key: "width", value: 168 },
      { id: "r2i2", key: "x", value: 124 },
      { id: "r2i3", key: "x", value: 148 },
    ]);
  });

  it("fill propagates down: a row set to Fill takes the list's width, and its Fill item takes the rest", () => {
    const doc = list();
    doc.set("list", { layoutSizingHorizontal: "FIXED", width: 300 });
    doc.set("row1", { layoutSizingHorizontal: "FILL" });
    doc.set("r1i2", { layoutSizingHorizontal: "FILL" });
    doc.apply(relayout(doc, ["list", "row1", "r1i2"]));
    expect(doc.nodes.get("row1")?.width).toBe(268);
    expect(doc.nodes.get("r1i2")).toMatchObject({ x: 24, width: 268 - 40 - 8 });
    expect(doc.nodes.get("r1i3")?.x).toBe(268 - 20);
    expect(doc.nodes.get("row2")?.width).toBe(68);
  });

  it("hiding a child closes its gap; showing it opens it again", () => {
    const doc = list();
    doc.set("r1i2", { visible: false });
    doc.apply(relayout(doc, ["r1i2"]));
    expect(doc.nodes.get("r1i3")?.x).toBe(24);
    expect(doc.nodes.get("row1")?.width).toBe(44);
    doc.set("r1i2", { visible: true });
    doc.apply(relayout(doc, ["r1i2"]));
    expect(doc.nodes.get("r1i3")?.x).toBe(48);
  });

  it("absolute children don't take space and follow constraints when the frame grows", () => {
    const doc = list();
    doc.add("RECTANGLE", "badge", { x: 80, y: -4, width: 8, height: 8, layoutPositioning: "ABSOLUTE", constraints: { horizontal: "MAX", vertical: "MIN" } }, "list");
    expect(relayout(doc, ["badge"])).toEqual([]);
    doc.set("r1i1", { width: 120 });
    doc.apply(relayout(doc, ["r1i1"]));
    expect(doc.nodes.get("list")?.width).toBe(200);
    expect(doc.nodes.get("badge")).toMatchObject({ x: 180, y: -4 });
  });

  it("gives the same result whatever order the changes come in", () => {
    const a = list();
    a.set("r1i1", { width: 50 });
    a.set("r2i3", { height: 30 });
    const b = a.clone();
    expect(relayout(a, ["r1i1", "r2i3", "row2"])).toEqual(relayout(b, ["row2", "r2i3", "r1i1"]));
  });

  it("re-wraps content inside a stretched child and hugs the new height", () => {
    const doc = new MemoryDoc();
    doc.add("FRAME", "panel", { width: 300, height: 400, layoutMode: "VERTICAL", primaryAxisSizingMode: "FIXED", counterAxisSizingMode: "FIXED" });
    doc.add("FRAME", "tags", { layoutMode: "HORIZONTAL", layoutWrap: "WRAP", itemSpacing: 10, layoutSizingHorizontal: "FILL", layoutSizingVertical: "HUG" }, "panel");
    for (let i = 0; i < 6; i++) doc.add("RECTANGLE", `t${i}`, { width: 90, height: 20 }, "tags");
    doc.apply(relayout(doc, ["tags"], { deep: true }));
    expect(doc.nodes.get("tags")).toMatchObject({ width: 300, height: 50 }); // 3 per row, 2 rows
    doc.set("panel", { width: 200 });
    doc.apply(relayout(doc, ["panel"]));
    expect(doc.nodes.get("tags")).toMatchObject({ width: 200, height: 80 }); // 2 per row, 3 rows
    expect(doc.nodes.get("t5")).toMatchObject({ x: 100, y: 60 });
  });

  it("skips ids that no longer exist and leaves plain frames' children alone", () => {
    const doc = card(end);
    doc.set("frame", { width: 600 });
    expect(relayout(doc, ["gone", "frame", "button"])).toEqual([]);
  });

  it("resizing a child of an auto layout frame reflows its siblings", () => {
    const doc = list();
    doc.apply(resize(doc, "r1i1", { width: 30 }));
    expect(doc.nodes.get("r1i2")?.x).toBe(34);
    expect(doc.nodes.get("row1")?.width).toBe(78);
  });
});

describe("changedIds", () => {
  it("collects layout-relevant changes, both parents of a move and the parent of a deleted node", () => {
    const ops = [
      { op: "set", id: "a", key: "name", value: "x", prev: "y" },
      { op: "set", id: "b", key: "paddingLeft", value: 4, prev: 0 },
      { op: "set", id: "c", key: "parentId", value: "p2", prev: "p1" },
      { op: "create", node: { id: "d", parentId: "p3" } },
      { op: "delete", node: { id: "e", parentId: "p4" } },
      { op: "set", id: "b", key: "width", value: 4, prev: 0 },
    ] as const;
    expect(changedIds(ops)).toEqual(["b", "c", "p1", "p2", "d", "p3", "p4"]);
  });
});
