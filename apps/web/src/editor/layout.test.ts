/**
 * The layout engine wired into editing: every edit, drag step and replay is
 * laid out inside itself, so one undo reverts an edit and its layout, and
 * undo and redo restore exact values.
 */

import { describe, expect, it } from "vitest";
import { Document, type Operation } from "@illigma/core";
import type { NodeId } from "@illigma/format";
import { loadDocument, replayRecovered, sampleDocument } from "../files";
import { deleteLayers, duplicateLayers, moveBy, reorderLayers, reorderSlot, reorderStep, resizeBy, sharedFlowParent, snapshot } from "./edit";
import { DOCUMENT_OPTIONS, setBoxField } from "./layout";

/** Time budgets are tuned on a laptop. Shared CI runners are slower, so CI gets 3x (or PERF_BUDGET_SCALE). */
const budget = (ms: number) => ms * (Number(process.env.PERF_BUDGET_SCALE) || (process.env.CI ? 3 : 1));

function sample() {
  const doc = sampleDocument();
  const page = doc.pages()[0]!.id;
  const byName = (name: string) => doc.subtree(page).find((n) => n.name === name)!.id;
  return {
    doc,
    page,
    desktop: byName("Desktop"),
    card: byName("Card"),
    image: byName("Image"),
    title: byName("Title"),
    button: byName("Button"),
    hero: byName("Hero"),
    avatar: byName("Avatar"),
  };
}

const box = (doc: Document, id: NodeId) => {
  const n = doc.get(id)!;
  return { x: n.x, y: n.y, width: n.width, height: n.height };
};
const names = (doc: Document, parent: NodeId) => doc.children(parent).map((n) => n.name);

describe("the sample file", () => {
  it("has a laid-out auto layout card", () => {
    const { doc, card, image, title, button } = sample();
    expect(box(doc, card)).toEqual({ x: 120, y: 560, width: 320, height: 264 });
    expect(box(doc, image)).toEqual({ x: 24, y: 24, width: 272, height: 120 });
    expect(box(doc, title)).toEqual({ x: 24, y: 160, width: 200, height: 24 });
    expect(box(doc, button)).toEqual({ x: 24, y: 200, width: 120, height: 40 });
    expect(doc.canUndo).toBe(false);
  });
});

describe("every edit is laid out in the same undo step", () => {
  it("a size typed in Properties reflows the card; one undo restores exact values; redo replays them", () => {
    const { doc, card, image, title, button } = sample();
    const before = doc.toFile();
    doc.transact("Change height", (tx) => setBoxField(tx, doc, image, "height", 200));
    expect(doc.get(card)?.height).toBe(344);
    expect(doc.get(title)?.y).toBe(240);
    expect(doc.get(button)?.y).toBe(280);
    const after = doc.toFile();
    doc.undo();
    expect(doc.toFile()).toEqual(before);
    expect(doc.canUndo).toBe(false);
    doc.redo();
    expect(doc.toFile()).toEqual(after);
  });

  it("X and Y of a layer in auto layout are its parent's: typing them records nothing", () => {
    const { doc, title } = sample();
    doc.transact("Change x position", (tx) => setBoxField(tx, doc, title, "x", 400));
    expect(doc.get(title)?.x).toBe(24);
    expect(doc.canUndo).toBe(false);
  });

  it("W typed on a Hug card switches it to Fixed; W typed on a Fill child too", () => {
    const { doc, card, title } = sample();
    doc.transact("Change width", (tx) => setBoxField(tx, doc, card, "width", 400));
    expect(doc.get(card)).toMatchObject({ width: 400, counterAxisSizingMode: "FIXED", height: 264 });
    doc.transact("Fill", (tx) => tx.set(title, "layoutSizingHorizontal", "FILL"));
    expect(doc.get(title)?.width).toBe(352);
    doc.transact("Change width", (tx) => setBoxField(tx, doc, title, "width", 100));
    expect(doc.get(title)).toMatchObject({ width: 100, layoutSizingHorizontal: "FIXED" });
  });

  it("delete inside auto layout reflows; undo restores", () => {
    const { doc, card, title, button } = sample();
    doc.transact("Delete layer", (tx) => deleteLayers(tx, doc, [title]));
    expect(doc.get(button)?.y).toBe(160);
    expect(doc.get(card)?.height).toBe(224);
    doc.undo();
    expect(doc.get(button)?.y).toBe(200);
    expect(doc.get(card)?.height).toBe(264);
  });

  it("⌘D inside auto layout puts the copy right after the original, laid out", () => {
    const { doc, card, title, button } = sample();
    const [copy] = doc.transact("Duplicate layer", (tx) => duplicateLayers(tx, doc, [title]));
    expect(names(doc, card)).toEqual(["Image", "Title", "Title", "Button"]);
    expect(doc.children(card)[2]?.id).toBe(copy);
    expect(box(doc, copy!)).toEqual({ x: 24, y: 200, width: 200, height: 24 });
    expect(doc.get(button)?.y).toBe(240);
    expect(doc.get(card)?.height).toBe(304);
    doc.undo();
    expect(doc.get(card)?.height).toBe(264);
    expect(doc.has(copy!)).toBe(false);
  });

  it("nudging a free layer still moves it; layers in auto layout reorder instead", () => {
    const { doc, card, hero, title } = sample();
    doc.transact("Move", (tx) => moveBy(tx, snapshot(doc, [hero]), 5, 0));
    expect(doc.get(hero)?.x).toBe(125);
    expect(sharedFlowParent(doc, [title])).toBe(card);
    doc.transact("Reorder", (tx) => reorderStep(tx, doc, card, [title], "ArrowDown"));
    expect(names(doc, card)).toEqual(["Image", "Button", "Title"]);
    expect(doc.get(title)?.y).toBe(216);
    expect(doc.transact("Reorder", (tx) => reorderStep(tx, doc, card, [title], "ArrowLeft"))).toBeNull(); // across the flow
    expect(doc.transact("Reorder", (tx) => reorderStep(tx, doc, card, [title], "ArrowDown"))).toBe(false); // already last
    doc.transact("Reorder", (tx) => reorderStep(tx, doc, card, [title], "ArrowUp"));
    doc.transact("Reorder", (tx) => reorderStep(tx, doc, card, [title], "ArrowUp"));
    expect(names(doc, card)).toEqual(["Title", "Image", "Button"]);
    expect(doc.get(title)?.y).toBe(24);
  });
});

describe("canvas resize", () => {
  it("children follow their constraints; ⌘/Ctrl resizes without them", () => {
    const { doc, desktop, avatar, hero } = sample();
    doc.transact("Resize", (tx) => resizeBy(tx, doc, snapshot(doc, [desktop]), "e", 100, 0, {}));
    expect(doc.get(desktop)?.width).toBe(1540);
    expect(doc.get(avatar)?.x).toBe(1300); // pinned right
    expect(doc.get(hero)?.x).toBe(120); // pinned left
    doc.undo();
    expect(doc.get(avatar)?.x).toBe(1200);
    doc.transact("Resize", (tx) => resizeBy(tx, doc, snapshot(doc, [desktop]), "e", 100, 0, { constraints: false }));
    expect(doc.get(desktop)?.width).toBe(1540);
    expect(doc.get(avatar)?.x).toBe(1200);
  });

  it("resizing a Hug card by its edge switches that axis to Fixed", () => {
    const { doc, card, image } = sample();
    doc.transact("Resize", (tx) => resizeBy(tx, doc, snapshot(doc, [card]), "e", 40, 0, {}));
    expect(doc.get(card)).toMatchObject({ width: 360, height: 264, counterAxisSizingMode: "FIXED" });
    expect(doc.get(card)?.primaryAxisSizingMode).toBeUndefined(); // the other axis still hugs
    expect(box(doc, image)).toEqual({ x: 24, y: 24, width: 272, height: 120 });
    doc.undo();
    expect(doc.get(card)?.counterAxisSizingMode).toBeUndefined();
    expect(doc.get(card)?.width).toBe(320);
  });

  it("resizing a child in auto layout keeps its slot and reflows the frame", () => {
    const { doc, card, image, title } = sample();
    doc.transact("Resize", (tx) => resizeBy(tx, doc, snapshot(doc, [image]), "s", 0, 30, {}));
    expect(box(doc, image)).toEqual({ x: 24, y: 24, width: 272, height: 150 });
    expect(doc.get(title)?.y).toBe(190);
    expect(doc.get(card)?.height).toBe(294);
  });

  it("a live resize lays out every step; cancel leaves no trace; commit is one undo step", () => {
    const { doc, desktop, avatar } = sample();
    const before = doc.toFile();
    const starts = snapshot(doc, [desktop]);
    const edit = doc.beginLive("Resize layer");
    for (const dx of [10, 50, 120]) {
      edit.update((tx) => resizeBy(tx, doc, starts, "e", dx, 0, {}));
      expect(doc.get(avatar)?.x).toBe(1200 + dx);
    }
    edit.cancel();
    expect(doc.toFile()).toEqual(before);
    expect(doc.canUndo).toBe(false);

    const again = doc.beginLive("Resize layer");
    again.update((tx) => resizeBy(tx, doc, starts, "e", 10, 0, {}));
    again.update((tx) => resizeBy(tx, doc, starts, "e", -40, 0, {}));
    again.commit();
    expect(doc.get(avatar)?.x).toBe(1160);
    doc.undo();
    expect(doc.toFile()).toEqual(before);
  });
});

describe("reorder by drag", () => {
  it("the slot follows the pointer along the flow, with an insertion line in the gap", () => {
    const { doc, card, title, image, button } = sample();
    // Card at (120, 560) on the page; Image 24–144, Button (without Title) 200–240 in the card.
    const at = (y: number) => reorderSlot(doc, card, [title], 200, 560 + y)!;
    expect(at(10).before).toBe(image);
    expect(at(100).before).toBe(button);
    expect(at(230).before).toBeNull();
    expect(at(100).line).toEqual({ x: 144, y: 560 + 172, width: 272, height: 0, rotation: 0 });
    expect(at(10).line.y).toBe(560 + 12);
  });

  it("dropping reorders inside one undo step, and the card reflows", () => {
    const { doc, card, title, button, image } = sample();
    const before = doc.toFile();
    const edit = doc.beginLive("Reorder layer");
    edit.update((tx) => void reorderLayers(tx, doc, card, [title], null));
    edit.commit();
    expect(names(doc, card)).toEqual(["Image", "Button", "Title"]);
    expect(doc.get(button)?.y).toBe(160);
    expect(doc.get(title)?.y).toBe(216);
    doc.undo();
    expect(doc.toFile()).toEqual(before);
    expect(doc.transact("Same place", (tx) => reorderLayers(tx, doc, card, [title], button))).toBe(false);
    expect(doc.canUndo).toBe(false);
    doc.transact("First", (tx) => reorderLayers(tx, doc, card, [button, title], image));
    expect(names(doc, card)).toEqual(["Title", "Button", "Image"]);
  });

  it("absolute children are not in the flow: they stay put and move freely", () => {
    const { doc, card, title } = sample();
    doc.transact("Absolute", (tx) => tx.set(title, "layoutPositioning", "ABSOLUTE"));
    expect(sharedFlowParent(doc, [title])).toBeNull();
    doc.transact("Move", (tx) => moveBy(tx, snapshot(doc, [title]), 10, 10));
    expect(doc.get(title)).toMatchObject({ x: 34, y: 170 });
    expect(doc.get(card)?.height).toBe(224); // the flow closed the gap
  });
});

describe("replay (recovery Keep)", () => {
  it("lays out replayed edits, even ones recorded without their layout", () => {
    const { doc, image, title, card } = sample();
    // Recorded by an older build: only the image's height changed.
    const recorded: Operation[] = [{ op: "set", id: image, key: "height", value: 200, prev: 120 }];
    const { doc: kept, skipped } = replayRecovered(doc, [recorded]);
    expect(skipped).toBe(0);
    expect(kept.get(title)?.y).toBe(240);
    expect(kept.get(card)?.height).toBe(344);
    expect(kept.canUndo).toBe(false);
    // Edits recorded with their layout replay to the same values.
    let ops: readonly Operation[] = [];
    doc.subscribe((c) => (ops = c.ops));
    doc.transact("Change height", (tx) => setBoxField(tx, doc, image, "height", 200));
    const again = replayRecovered(sampleLike(doc), [ops]);
    expect(again.doc.toFile().nodes).toEqual(doc.toFile().nodes);
  });

  it("files loaded for editing get the layout normalizer", () => {
    const { doc } = sample();
    expect(doc.normalizer).toBe(DOCUMENT_OPTIONS.normalize);
    expect(loadDocument(doc.toFile()).normalizer).toBe(DOCUMENT_OPTIONS.normalize);
  });
});

/** `doc` as it was before its last edit (undone on a copy of its file). */
function sampleLike(doc: Document): Document {
  doc.undo();
  const copy = loadDocument(doc.toFile());
  doc.redo();
  return copy;
}

describe("performance", () => {
  /** 10,000+ layers: 40 screens, each a vertical auto layout list of 50 rows with 4 layers inside, plus pinned layers. */
  function bigDocument() {
    const doc = new Document("Big", DOCUMENT_OPTIONS);
    const ids = doc.transact("Build", (tx) => {
      const page = tx.addPage("Page 1");
      const screens: NodeId[] = [];
      for (let s = 0; s < 40; s++) {
        const screen = tx.create("FRAME", page, { x: s * 500, width: 400, height: 3000 });
        screens.push(screen);
        tx.create("RECTANGLE", screen, { x: 360, y: 8, width: 32, height: 32, constraints: { horizontal: "MAX", vertical: "MIN" } });
        const list = tx.create("FRAME", screen, { x: 16, y: 48, width: 368, layoutMode: "VERTICAL", counterAxisSizingMode: "FIXED", itemSpacing: 8, paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, constraints: { horizontal: "STRETCH", vertical: "MIN" } });
        for (let r = 0; r < 50; r++) {
          const row = tx.create("FRAME", list, { layoutMode: "HORIZONTAL", itemSpacing: 8, layoutSizingHorizontal: "FILL" });
          tx.create("ELLIPSE", row, { width: 24, height: 24 });
          tx.create("RECTANGLE", row, { width: 120, height: 16 });
          tx.create("RECTANGLE", row, { width: 60, height: 16, layoutSizingHorizontal: "FILL" });
          tx.create("RECTANGLE", row, { width: 16, height: 16 });
        }
      }
      return { page, screens };
    });
    return { doc, ...ids };
  }

  it("a live drag and a live resize of a frame in a 10,000-layer document stay smooth", () => {
    const { doc, screens } = bigDocument();
    expect(doc.size).toBeGreaterThan(10_000);
    const target = screens[20]!;
    const steps = 60;

    let t0 = performance.now();
    const starts = snapshot(doc, [target]);
    const move = doc.beginLive("Move layer");
    for (let i = 1; i <= steps; i++) move.update((tx) => moveBy(tx, starts, i * 3, i));
    move.commit();
    const moveMs = (performance.now() - t0) / steps;
    expect(doc.get(target)?.x).toBe(20 * 500 + steps * 3);

    t0 = performance.now();
    const resize = doc.beginLive("Resize layer");
    for (let i = 1; i <= steps; i++) resize.update((tx) => resizeBy(tx, doc, starts, "e", i * 2, 0, {}));
    resize.commit();
    const resizeMs = (performance.now() - t0) / steps;
    expect(doc.get(target)?.width).toBe(400 + steps * 2);
    // The list stretched with the screen, so every row (Fill) and its Fill label grew too.
    const list = doc.children(target)[1]!;
    expect(list.width).toBe(368 + steps * 2);
    expect(doc.children(list.id)[0]?.width).toBe(336 + steps * 2);

    // A frame of input is 16 ms; a step must leave room for drawing.
    expect(moveMs, `move: ${moveMs.toFixed(2)} ms per step`).toBeLessThan(budget(4));
    expect(resizeMs, `resize: ${resizeMs.toFixed(2)} ms per step`).toBeLessThan(budget(8));
  }, 60_000);
});
