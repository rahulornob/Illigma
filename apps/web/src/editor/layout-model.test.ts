import { describe, expect, it } from "vitest";
import { Document } from "@illigma/core";
import type { NodeId } from "@illigma/format";
import {
  addAutoLayout,
  alignmentCell,
  alignmentPatch,
  autoLayoutSelection,
  cellName,
  directionPatch,
  effectiveSizing,
  guessCounterAlign,
  guessDirection,
  guessGap,
  hasConstraints,
  removeAutoLayout,
  setSizing,
  sizingOptions,
  type Cell,
} from "./layout-model";
import { DOCUMENT_OPTIONS } from "./layout";
import { setBoxFields as setBoxField, setLayoutProps } from "./layout-props";

/** The sample file: a 1440 × 900 frame with two layers in it, and one layer on the page. */
function setup() {
  const doc = new Document("Test", DOCUMENT_OPTIONS);
  const page = doc.transact("Add page", (tx) => tx.addPage("Page 1"));
  const ids = doc.transact("Add", (tx) => {
    const frame = tx.create("FRAME", page, { name: "Desktop", x: 0, y: 0, width: 1440, height: 900 });
    const hero = tx.create("RECTANGLE", frame, { name: "Hero", x: 120, y: 160, width: 560, height: 320 });
    const avatar = tx.create("ELLIPSE", frame, { name: "Avatar", x: 1200, y: 40, width: 96, height: 96 });
    const loose = tx.create("RECTANGLE", page, { name: "Loose", x: 2000, y: 0, width: 50, height: 50 });
    return { frame, hero, avatar, loose };
  });
  return { doc, page, ...ids };
}

const box = (doc: Document, id: NodeId) => {
  const n = doc.get(id);
  return n && { x: n.x, y: n.y, width: n.width, height: n.height };
};

describe("alignment grid ↔ fields", () => {
  const cells: Cell[] = [];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) cells.push({ col, row });

  it("horizontal: columns are the primary axis, rows the counter axis", () => {
    expect(alignmentPatch("HORIZONTAL", { col: 2, row: 0 })).toEqual({ primaryAxisAlignItems: "MAX", counterAxisAlignItems: "MIN" });
    expect(alignmentPatch("WRAP", { col: 0, row: 1 })).toEqual({ primaryAxisAlignItems: "MIN", counterAxisAlignItems: "CENTER" });
  });

  it("vertical: rows are the primary axis, columns the counter axis", () => {
    expect(alignmentPatch("VERTICAL", { col: 2, row: 0 })).toEqual({ primaryAxisAlignItems: "MIN", counterAxisAlignItems: "MAX" });
    expect(alignmentPatch("VERTICAL", { col: 1, row: 2 })).toEqual({ primaryAxisAlignItems: "MAX", counterAxisAlignItems: "CENTER" });
  });

  it("round-trips every cell in both directions", () => {
    for (const layoutMode of ["HORIZONTAL", "VERTICAL"] as const) {
      for (const c of cells) {
        const fields = alignmentPatch(layoutMode, c);
        expect(alignmentCell({ layoutMode, ...fields })).toEqual({ ...c, spread: false });
      }
    }
  });

  it("an Auto gap keeps SPACE_BETWEEN and changes only the cross axis", () => {
    expect(alignmentCell({ layoutMode: "HORIZONTAL", primaryAxisAlignItems: "SPACE_BETWEEN", counterAxisAlignItems: "MAX" })).toEqual({ col: 1, row: 2, spread: true });
    expect(alignmentPatch("HORIZONTAL", { col: 0, row: 1 }, true)).toEqual({ counterAxisAlignItems: "CENTER" });
    expect(alignmentPatch("VERTICAL", { col: 2, row: 0 }, true)).toEqual({ counterAxisAlignItems: "MAX" });
  });

  it("absent fields are top left", () => {
    expect(alignmentCell({ layoutMode: "VERTICAL" })).toEqual({ col: 0, row: 0, spread: false });
  });

  it("names cells for screen readers", () => {
    expect(cellName({ col: 0, row: 0 })).toBe("Top left");
    expect(cellName({ col: 1, row: 1 })).toBe("Center");
    expect(cellName({ col: 2, row: 2 })).toBe("Bottom right");
    expect(cellName({ col: 1, row: 0 })).toBe("Top center");
  });
});

describe("Shift+A guesses", () => {
  const r = (x: number, y: number, width = 10, height = 10) => ({ x, y, width, height });

  it("a row of layers is horizontal, a column vertical", () => {
    expect(guessDirection([r(0, 0), r(20, 2), r(40, 0)])).toBe("HORIZONTAL");
    expect(guessDirection([r(0, 0), r(3, 20), r(0, 40)])).toBe("VERTICAL");
  });

  it("order of the input doesn't matter", () => {
    expect(guessDirection([r(0, 40), r(0, 0), r(0, 20)])).toBe("VERTICAL");
  });

  it("a diagonal goes along the axis it spreads further on", () => {
    expect(guessDirection([r(0, 0), r(100, 20)])).toBe("HORIZONTAL");
    expect(guessDirection([r(0, 0), r(20, 100)])).toBe("VERTICAL");
  });

  it("one layer makes a horizontal stack (text → button)", () => {
    expect(guessDirection([r(0, 0, 10, 100)])).toBe("HORIZONTAL");
    expect(guessDirection([])).toBe("HORIZONTAL");
  });

  it("gap is the average space between neighbours, rounded, never negative", () => {
    expect(guessGap([r(0, 0), r(18, 0), r(38, 0)], "HORIZONTAL")).toBe(9);
    expect(guessGap([r(0, 0), r(5, 0)], "HORIZONTAL")).toBe(0);
    expect(guessGap([r(0, 0)], "VERTICAL")).toBe(0);
  });

  it("cross-axis alignment follows shared edges", () => {
    expect(guessCounterAlign([r(0, 0, 10, 10), r(20, 0, 10, 30)], "HORIZONTAL")).toBe("MIN");
    expect(guessCounterAlign([r(0, 10, 10, 10), r(20, 0, 10, 30)], "HORIZONTAL")).toBe("CENTER");
    expect(guessCounterAlign([r(0, 20, 10, 10), r(20, 0, 10, 30)], "HORIZONTAL")).toBe("MAX");
    expect(guessCounterAlign([r(0, 3, 10, 10), r(20, 0, 10, 30)], "HORIZONTAL")).toBe("MIN");
  });
});

describe("Shift+A", () => {
  it("adds auto layout to a single frame, keeping its children in order and spacing", () => {
    const { doc, frame, hero, avatar } = setup();
    expect(autoLayoutSelection(doc, [frame])).toEqual([frame]);
    const f = doc.get(frame);
    expect(f?.layoutMode).toBe("HORIZONTAL");
    expect(f?.itemSpacing).toBe(520);
    expect([f?.paddingLeft, f?.paddingTop, f?.paddingRight, f?.paddingBottom]).toEqual([120, 40, 144, 420]);
    expect(box(doc, hero)).toEqual({ x: 120, y: 40, width: 560, height: 320 });
    expect(box(doc, avatar)).toEqual({ x: 1200, y: 40, width: 96, height: 96 });
    // It hugs: 120 + 560 + 520 + 96 + 144 wide, 40 + 320 + 420 high.
    expect(box(doc, frame)).toEqual({ x: 0, y: 0, width: 1440, height: 780 });
    doc.undo();
    expect(doc.get(frame)?.layoutMode).toBeUndefined();
    expect(box(doc, hero)).toEqual({ x: 120, y: 160, width: 560, height: 320 });
    expect(box(doc, frame)).toEqual({ x: 0, y: 0, width: 1440, height: 900 });
  });

  it("keeps an empty frame's size", () => {
    const { doc, page } = setup();
    const empty = doc.transact("Add", (tx) => tx.create("FRAME", page, { x: 0, y: 0, width: 200, height: 100 }));
    autoLayoutSelection(doc, [empty]);
    expect(box(doc, empty)).toEqual({ x: 0, y: 0, width: 200, height: 100 });
    expect(effectiveSizing(doc, doc.get(empty)!, "width")).toBe("FIXED");
  });

  it("wraps several layers in a new auto layout frame, in one undo step", () => {
    const { doc, frame, hero, avatar } = setup();
    const [wrapper] = autoLayoutSelection(doc, [hero, avatar]);
    expect(wrapper).toBeDefined();
    const w = doc.get(wrapper as NodeId);
    expect(w?.type).toBe("FRAME");
    expect(w?.parentId).toBe(frame);
    expect(w?.layoutMode).toBe("HORIZONTAL");
    // At the selection's top-left, hugging both: 560 + 520 + 96 wide.
    expect(box(doc, wrapper as NodeId)).toEqual({ x: 120, y: 40, width: 1176, height: 320 });
    expect(doc.children(wrapper as NodeId).map((n) => n.id)).toEqual([hero, avatar]);
    expect(box(doc, hero)).toEqual({ x: 0, y: 0, width: 560, height: 320 });
    expect(box(doc, avatar)).toEqual({ x: 1080, y: 0, width: 96, height: 96 });
    doc.undo();
    expect(doc.has(wrapper as NodeId)).toBe(false);
    expect(doc.get(hero)?.parentId).toBe(frame);
    expect(box(doc, hero)).toEqual({ x: 120, y: 160, width: 560, height: 320 });
    expect(box(doc, avatar)).toEqual({ x: 1200, y: 40, width: 96, height: 96 });
  });

  it("wraps a single shape (and an auto layout frame) instead of adding to it", () => {
    const { doc, hero, frame } = setup();
    const [w1] = autoLayoutSelection(doc, [hero]);
    expect(doc.get(hero)?.parentId).toBe(w1);
    expect(box(doc, w1 as NodeId)).toEqual({ x: 120, y: 160, width: 560, height: 320 });
    autoLayoutSelection(doc, [frame]);
    const [w2] = autoLayoutSelection(doc, [frame]);
    expect(w2).not.toBe(frame);
    expect(doc.get(frame)?.parentId).toBe(w2);
  });

  it("doesn't wrap layers from different parents", () => {
    const { doc, hero, loose } = setup();
    expect(autoLayoutSelection(doc, [hero, loose])).toEqual([hero, loose]);
    expect(doc.canUndo).toBe(true); // only the setup steps
    expect(doc.undoLabel).toBe("Add");
  });

  it("the + button adds auto layout to each selected frame", () => {
    const { doc, page } = setup();
    const [a, b] = doc.transact("Add", (tx) => [tx.create("FRAME", page, { x: 0, y: 0 }), tx.create("FRAME", page, { x: 300, y: 0 })]);
    expect(addAutoLayout(doc, [a as NodeId, b as NodeId])).toEqual([a, b]);
    expect(doc.get(a as NodeId)?.layoutMode).toBe("HORIZONTAL");
    expect(doc.get(b as NodeId)?.layoutMode).toBe("HORIZONTAL");
    expect(doc.undoLabel).toBe("Add auto layout");
  });

  it("removing auto layout keeps the frame's size and the children where they are", () => {
    const { doc, frame, avatar } = setup();
    autoLayoutSelection(doc, [frame]);
    // A Fill child (it fills exactly the 96 px left over, so nothing moves) becomes Fixed, as in Figma.
    setSizing(doc, [avatar], "width", "FILL");
    expect(doc.get(avatar)?.layoutSizingHorizontal).toBe("FILL");
    removeAutoLayout(doc, [frame]);
    expect(doc.get(avatar)?.layoutSizingHorizontal).toBe("FIXED");
    expect(doc.get(frame)?.layoutMode).toBeUndefined();
    expect(effectiveSizing(doc, doc.get(frame)!, "height")).toBe("FIXED");
    expect(box(doc, frame)).toEqual({ x: 0, y: 0, width: 1440, height: 780 });
    expect(box(doc, avatar)).toEqual({ x: 1200, y: 40, width: 96, height: 96 });
  });
});

describe("settings reflow the children in one undo step", () => {
  function auto() {
    const s = setup();
    autoLayoutSelection(s.doc, [s.frame]);
    return s;
  }

  it("direction, gap, padding and alignment", () => {
    const { doc, frame, hero, avatar } = auto();
    setLayoutProps(doc, [frame], directionPatch(doc.get(frame)!, "VERTICAL"), "Direction");
    expect(box(doc, avatar)).toEqual({ x: 120, y: 880, width: 96, height: 96 });
    setLayoutProps(doc, [frame], { itemSpacing: 10 });
    expect(box(doc, avatar)?.y).toBe(370);
    setLayoutProps(doc, [frame], { paddingLeft: 24, paddingRight: 24 });
    expect(box(doc, hero)?.x).toBe(24);
    setLayoutProps(doc, [frame], alignmentPatch("VERTICAL", { col: 1, row: 0 }));
    expect(box(doc, avatar)?.x).toBe(24 + (560 - 96) / 2);
    expect(box(doc, frame)?.width).toBe(608);
    doc.undo();
    expect(box(doc, avatar)?.x).toBe(24);
    expect(doc.undoLabel).toBe("Change auto layout");
  });

  it("an Auto gap spreads children over a fixed frame", () => {
    const { doc, frame, avatar } = auto();
    setBoxField(doc, [frame], "width", [2000], "Change width");
    expect(effectiveSizing(doc, doc.get(frame)!, "width")).toBe("FIXED");
    setLayoutProps(doc, [frame], { primaryAxisAlignItems: "SPACE_BETWEEN" });
    expect(box(doc, avatar)?.x).toBe(2000 - 144 - 96);
  });

  it("direction keeps each axis's sizing", () => {
    const { doc, frame } = auto();
    setSizing(doc, [frame], "width", "FIXED");
    setLayoutProps(doc, [frame], directionPatch(doc.get(frame)!, "VERTICAL"));
    expect(effectiveSizing(doc, doc.get(frame)!, "width")).toBe("FIXED");
    expect(effectiveSizing(doc, doc.get(frame)!, "height")).toBe("HUG");
  });
});

describe("sizing", () => {
  it("offers Hug only on auto layout frames and Fill only in an auto layout flow", () => {
    const { doc, frame, hero } = setup();
    expect(sizingOptions(doc, doc.get(frame)!)).toEqual(["FIXED"]);
    expect(sizingOptions(doc, doc.get(hero)!)).toEqual(["FIXED"]);
    autoLayoutSelection(doc, [frame]);
    expect(sizingOptions(doc, doc.get(frame)!)).toEqual(["FIXED", "HUG"]);
    expect(sizingOptions(doc, doc.get(hero)!)).toEqual(["FIXED", "FILL"]);
    setLayoutProps(doc, [hero], { layoutPositioning: "ABSOLUTE" });
    expect(sizingOptions(doc, doc.get(hero)!)).toEqual(["FIXED"]);
  });

  it("Fill on a child makes a hugging parent Fixed; Hug on the parent makes Fill children Fixed", () => {
    const { doc, frame, avatar } = setup();
    autoLayoutSelection(doc, [frame]);
    setSizing(doc, [avatar], "height", "FILL");
    expect(effectiveSizing(doc, doc.get(frame)!, "height")).toBe("FIXED");
    expect(box(doc, avatar)?.height).toBe(780 - 40 - 420);
    expect(doc.undoLabel).toBe("Height: Fill container");
    setSizing(doc, [frame], "height", "HUG");
    expect(effectiveSizing(doc, doc.get(avatar)!, "height")).toBe("FIXED");
  });

  it("typing a size on a Hug axis makes it Fixed", () => {
    const { doc, frame } = setup();
    autoLayoutSelection(doc, [frame]);
    setBoxField(doc, [frame], "height", [1000], "Change height");
    expect(effectiveSizing(doc, doc.get(frame)!, "height")).toBe("FIXED");
    expect(box(doc, frame)?.height).toBe(1000);
  });
});

describe("constraints", () => {
  it("apply to layers in plain frames and absolute layers in auto layout", () => {
    const { doc, frame, hero, loose } = setup();
    expect(hasConstraints(doc, doc.get(hero)!)).toBe(true);
    expect(hasConstraints(doc, doc.get(loose)!)).toBe(false);
    expect(hasConstraints(doc, doc.get(frame)!)).toBe(false);
    autoLayoutSelection(doc, [frame]);
    expect(hasConstraints(doc, doc.get(hero)!)).toBe(false);
    setLayoutProps(doc, [hero], { layoutPositioning: "ABSOLUTE" });
    expect(hasConstraints(doc, doc.get(hero)!)).toBe(true);
  });

  it("a typed frame size moves children by their constraints", () => {
    const { doc, frame, hero, avatar } = setup();
    setLayoutProps(doc, [hero], { constraints: { horizontal: "STRETCH", vertical: "MIN" } });
    setLayoutProps(doc, [avatar], { constraints: { horizontal: "MAX", vertical: "MIN" } });
    setBoxField(doc, [frame], "width", [1540], "Change width");
    expect(box(doc, hero)?.width).toBe(660);
    expect(box(doc, avatar)?.x).toBe(1300);
    doc.undo();
    expect(box(doc, hero)?.width).toBe(560);
    expect(box(doc, avatar)?.x).toBe(1200);
  });
});
