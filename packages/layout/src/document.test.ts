/**
 * Layout with the real document model: changes are applied inside the same
 * `Document.transact` as the edit, so one undo reverts both, and a
 * 10,000-node nested auto layout tree lays out within a time budget.
 */

import { Document, type Transaction } from "@illigma/core";
import type { NodeId } from "@illigma/format";
import { describe, expect, it } from "vitest";
import { changedIds, relayout, resize } from "./index.js";
import type { LayoutChange } from "./types.js";

/** Time budgets are tuned on a laptop. Shared CI runners are slower, so CI gets 3x (or PERF_BUDGET_SCALE). */
const budget = (ms: number) => ms * (Number(process.env.PERF_BUDGET_SCALE) || (process.env.CI ? 3 : 1));

const apply = (tx: Transaction, changes: readonly LayoutChange[]) => {
  for (const c of changes) tx.set(c.id, c.key, c.value);
};

function setup() {
  const doc = new Document("Layout");
  const ids = doc.transact("Build", (tx) => {
    const page = tx.addPage("Page 1");
    const button = tx.create("FRAME", page, { name: "Button", layoutMode: "HORIZONTAL", paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, itemSpacing: 8 });
    const icon = tx.create("RECTANGLE", button, { width: 16, height: 16 });
    const label = tx.create("TEXT", button, { width: 60, height: 20, characters: "Sign up" });
    const badge = tx.create("ELLIPSE", button, { x: 90, y: -4, width: 8, height: 8, layoutPositioning: "ABSOLUTE", constraints: { horizontal: "MAX", vertical: "MIN" } });
    apply(tx, relayout(doc, [button], { deep: true }));
    return { page, button, icon, label, badge };
  });
  return { doc, ...ids };
}

describe("with @illigma/core", () => {
  it("lays out inside the transaction that caused it, and one undo reverts both", () => {
    const { doc, button, label, badge } = setup();
    expect(doc.get(button)).toMatchObject({ width: 116, height: 36 });
    expect(doc.get(label)).toMatchObject({ x: 40, y: 8 });
    expect(doc.get(badge)?.x).toBe(106); // pinned right: followed the new frame from 100 to 116 wide

    doc.transact("Longer label", (tx) => {
      tx.set(label, "width", 100);
      apply(tx, relayout(doc, [label])); // reads the document as it is mid-transaction
    });
    expect(doc.get(button)?.width).toBe(156);
    expect(doc.get(badge)?.x).toBe(146);
    expect(doc.undoLabel).toBe("Longer label");

    doc.undo();
    expect(doc.get(button)?.width).toBe(116);
    expect(doc.get(label)?.width).toBe(60);
    expect(doc.get(badge)?.x).toBe(106);
  });

  it("finds what to lay out from a change's operations", () => {
    const { doc, button, icon } = setup();
    let ops: Parameters<typeof changedIds>[0] = [];
    doc.subscribe((change) => (ops = change.ops));
    doc.transact("Hide icon", (tx) => tx.set(icon, "visible", false));
    expect(changedIds(ops)).toEqual([icon]);
    doc.transact("Relayout", (tx) => apply(tx, relayout(doc, changedIds(ops))));
    expect(doc.get(button)?.width).toBe(116 - 24);
  });

  it("resizes with constraints in one undoable step", () => {
    const doc = new Document("Constraints");
    const { frame, pinned } = doc.transact("Build", (tx) => {
      const page = tx.addPage();
      const frame = tx.create("FRAME", page, { width: 400, height: 300 });
      const pinned = tx.create("RECTANGLE", frame, { x: 280, y: 220, width: 100, height: 50, constraints: { horizontal: "MAX", vertical: "MAX" } });
      return { frame, pinned };
    });
    doc.transact("Resize", (tx) => apply(tx, resize(doc, frame, { width: 600, height: 400 })));
    expect(doc.get(pinned)).toMatchObject({ x: 480, y: 320 });
    doc.undo();
    expect(doc.get(pinned)).toMatchObject({ x: 280, y: 220 });
    expect(doc.get(frame)).toMatchObject({ width: 400, height: 300 });
  });

  it("lays out a 10,000-node nested auto layout tree within budget", () => {
    // Page > a fixed-width wrapping board > 100 rows (Fill width, hug height)
    // > 10 cards each (hug) > 9 layers each: 10,101 nodes.
    const doc = new Document("Big");
    const { board, leaf } = doc.transact("Build", (tx) => {
      const page = tx.addPage();
      const board = tx.create("FRAME", page, { width: 4000, layoutMode: "VERTICAL", primaryAxisSizingMode: "AUTO", counterAxisSizingMode: "FIXED", itemSpacing: 12, paddingLeft: 24, paddingRight: 24, paddingTop: 24, paddingBottom: 24 });
      let leaf: NodeId = "";
      for (let r = 0; r < 100; r++) {
        const row = tx.create("FRAME", board, { layoutMode: "HORIZONTAL", layoutWrap: "WRAP", itemSpacing: 8, counterAxisSpacing: 8, layoutSizingHorizontal: "FILL", layoutSizingVertical: "HUG" });
        for (let c = 0; c < 10; c++) {
          const card = tx.create("FRAME", row, { layoutMode: "VERTICAL", itemSpacing: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 8, paddingBottom: 8, counterAxisAlignItems: "CENTER" });
          for (let i = 0; i < 9; i++) {
            leaf = tx.create("RECTANGLE", card, { width: 40 + i, height: 10, ...(i === 0 && { layoutSizingHorizontal: "FILL" as const }) });
          }
        }
      }
      return { board, leaf };
    });
    expect(doc.size).toBe(10_102);

    let t = performance.now();
    const first = relayout(doc, [board], { deep: true });
    const full = performance.now() - t;
    doc.transact("Layout", (tx) => apply(tx, first));
    expect(doc.get(board)?.height).toBeGreaterThan(100 * 10);
    expect(relayout(doc, [board], { deep: true })).toEqual([]);

    // One layer changes: only its card, its row, the rows below it and the board move.
    t = performance.now();
    const edit = doc.transact("Wider", (tx) => {
      tx.set(leaf, "width", 400);
      const changes = relayout(doc, [leaf]);
      apply(tx, changes);
      return changes;
    });
    const incremental = performance.now() - t;
    expect(edit.length).toBeGreaterThan(0);
    expect(edit.length).toBeLessThan(200);

    expect(incremental, `one edit took ${Math.round(incremental)} ms`).toBeLessThan(budget(50));
    expect(full, `full layout took ${Math.round(full)} ms`).toBeLessThan(budget(400));
  });
});
