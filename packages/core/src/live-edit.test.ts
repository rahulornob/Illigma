import { describe, expect, it } from "vitest";
import { Document, DocumentError, type Change } from "./index.js";

function setup() {
  const doc = new Document("Test");
  const page = doc.transact("Add page", (tx) => tx.addPage("Page 1"));
  const id = doc.transact("Draw", (tx) => tx.create("RECTANGLE", page, { x: 10, y: 20, width: 100, height: 50 }));
  const changes: Change[] = [];
  doc.subscribe((c) => changes.push(c));
  return { doc, page, id, changes };
}

describe("LiveEdit", () => {
  it("shows every step live and commits the whole drag as one undo step", () => {
    const { doc, id, changes } = setup();
    const edit = doc.beginLive("Move layer");
    for (let dx = 1; dx <= 30; dx++) {
      edit.update((tx) => tx.set(id, "x", 10 + dx));
      expect(doc.get(id)?.x).toBe(10 + dx);
    }
    expect(changes.every((c) => c.origin === "live")).toBe(true);
    expect(doc.undoLabel).toBe("Draw");
    edit.commit();
    expect(edit.open).toBe(false);
    expect(doc.get(id)?.x).toBe(40);
    expect(doc.undoLabel).toBe("Move layer");
    const last = changes.at(-1);
    expect(last?.origin).toBe("edit");
    // One net operation from the start state, not one per step.
    expect(last?.ops).toEqual([{ op: "set", id, key: "x", value: 40, prev: 10 }]);
    doc.undo();
    expect(doc.get(id)?.x).toBe(10);
    expect(doc.undoLabel).toBe("Draw");
    doc.redo();
    expect(doc.get(id)?.x).toBe(40);
  });

  it("each update starts from the state the edit began in", () => {
    const { doc, id } = setup();
    const edit = doc.beginLive("Resize layer");
    edit.update((tx) => {
      tx.set(id, "width", 200);
      tx.set(id, "height", 80);
    });
    // The second step only sets width: height goes back to where it started.
    edit.update((tx) => tx.set(id, "width", 150));
    expect(doc.get(id)).toMatchObject({ width: 150, height: 50 });
    edit.commit("Resize");
    expect(doc.undoLabel).toBe("Resize");
  });

  it("cancel restores the start state and records no history", () => {
    const { doc, id, changes } = setup();
    doc.transact("Rename", (tx) => tx.set(id, "name", "A"));
    doc.undo(); // something to redo
    const edit = doc.beginLive("Move layer");
    edit.update((tx) => tx.set(id, "y", 99));
    edit.cancel();
    expect(doc.get(id)?.y).toBe(20);
    expect(doc.undoLabel).toBe("Draw");
    expect(doc.canRedo).toBe(true); // a cancelled drag is not an edit
    expect(changes.at(-1)).toMatchObject({ origin: "live" });
    expect(changes.at(-1)?.ops).toEqual([{ op: "set", id, key: "y", value: 20, prev: 99 }]);
  });

  it("a commit that changed nothing records nothing", () => {
    const { doc, id } = setup();
    const edit = doc.beginLive("Move layer");
    edit.update((tx) => tx.set(id, "x", 50));
    edit.update(() => {});
    edit.commit();
    expect(doc.undoLabel).toBe("Draw");
    expect(doc.get(id)?.x).toBe(10);
  });

  it("a failing update keeps the previous step", () => {
    const { doc, id } = setup();
    const edit = doc.beginLive("Move layer");
    edit.update((tx) => tx.set(id, "x", 30));
    expect(() =>
      edit.update((tx) => {
        tx.set(id, "x", 60);
        tx.set("missing", "x", 1);
      }),
    ).toThrow(DocumentError);
    expect(doc.get(id)?.x).toBe(30);
    edit.commit();
    doc.undo();
    expect(doc.get(id)?.x).toBe(10);
  });

  it("refuses other edits and history moves while open, and works again after", () => {
    const { doc, id } = setup();
    const edit = doc.beginLive("Move layer");
    expect(() => doc.transact("Other", (tx) => tx.set(id, "x", 1))).toThrow(/live edit/);
    expect(() => doc.undo()).toThrow(/live edit/);
    expect(() => doc.redo()).toThrow(/live edit/);
    expect(() => doc.beginLive("Second")).toThrow(/live edit/);
    expect(doc.live).toBe(edit);
    edit.cancel();
    expect(doc.live).toBe(null);
    expect(() => edit.update(() => {})).toThrow(/ended/);
    expect(() => edit.commit()).toThrow(/ended/);
    doc.transact("Other", (tx) => tx.set(id, "x", 1));
    expect(doc.get(id)?.x).toBe(1);
  });

  it("a nested transact inside an update joins the step", () => {
    const { doc, id } = setup();
    const edit = doc.beginLive("Move layer");
    edit.update(() => doc.transact("inner", (tx) => tx.set(id, "x", 77)));
    edit.commit();
    expect(doc.undoLabel).toBe("Move layer");
    doc.undo();
    expect(doc.get(id)?.x).toBe(10);
  });
});
