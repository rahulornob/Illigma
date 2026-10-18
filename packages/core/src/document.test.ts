import { describe, expect, it } from "vitest";
import { readPackage, writePackage } from "@illigma/format";
import { Document, type Change } from "./index.js";

function setup() {
  const doc = new Document("Test");
  const page = doc.transact("Add page", (tx) => tx.addPage("Page 1"));
  return { doc, page };
}

describe("Document", () => {
  it("creates nodes in order and reads children", () => {
    const { doc, page } = setup();
    const [a, b, c] = doc.transact("Add", (tx) => [
      tx.create("FRAME", page, { name: "A" }),
      tx.create("FRAME", page, { name: "B" }),
      tx.create("FRAME", page, { name: "C" }, "first"),
    ]);
    expect(doc.children(page).map((n) => n.id)).toEqual([c, a, b]);
  });

  it("undoes and redoes a whole transaction as one step", () => {
    const { doc, page } = setup();
    const id = doc.transact("Draw frame", (tx) => {
      const f = tx.create("FRAME", page);
      tx.set(f, "width", 393);
      tx.set(f, "name", "Sign up");
      return f;
    });
    expect(doc.undoLabel).toBe("Draw frame");
    doc.undo();
    expect(doc.has(id)).toBe(false);
    doc.redo();
    expect(doc.get(id)).toMatchObject({ width: 393, name: "Sign up" });
  });

  it("restores a deleted subtree exactly on undo", () => {
    const { doc, page } = setup();
    const frame = doc.transact("Add", (tx) => {
      const f = tx.create("FRAME", page, { name: "Card" });
      const t = tx.create("TEXT", f, { characters: "Hello" });
      tx.create("RECTANGLE", f);
      tx.create("ELLIPSE", t === f ? f : f);
      return f;
    });
    const before = doc.toFile();
    doc.transact("Delete", (tx) => tx.delete(frame));
    expect(doc.size).toBe(1);
    doc.undo();
    expect(doc.toFile().nodes.sort((x, y) => x.id.localeCompare(y.id))).toEqual(
      before.nodes.sort((x, y) => x.id.localeCompare(y.id)),
    );
  });

  it("moves nodes between parents and refuses to move a node into itself", () => {
    const { doc, page } = setup();
    const [f1, f2] = doc.transact("Add", (tx) => [tx.create("FRAME", page), tx.create("FRAME", page)]);
    const r = doc.transact("Add", (tx) => tx.create("RECTANGLE", f1 as string));
    doc.transact("Move", (tx) => tx.move(r, f2 as string));
    expect(doc.children(f2 as string).map((n) => n.id)).toEqual([r]);
    expect(doc.children(f1 as string)).toEqual([]);
    expect(() => doc.transact("Bad move", (tx) => tx.move(f2 as string, r))).toThrow(/inside itself/);
    doc.undo();
    expect(doc.children(f1 as string).map((n) => n.id)).toEqual([r]);
  });

  it("rolls back a transaction that throws", () => {
    const { doc, page } = setup();
    expect(() =>
      doc.transact("Broken", (tx) => {
        tx.create("FRAME", page);
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(doc.children(page)).toEqual([]);
    expect(doc.undoLabel).toBe("Add page");
  });

  it("skips no-op sets and clears redo after new work", () => {
    const { doc, page } = setup();
    const f = doc.transact("Add", (tx) => tx.create("FRAME", page));
    doc.transact("Same", (tx) => tx.set(f, "width", 100));
    expect(doc.undoLabel).toBe("Add");
    doc.undo();
    expect(doc.canRedo).toBe(true);
    doc.transact("Other", (tx) => tx.addPage("Page 2"));
    expect(doc.canRedo).toBe(false);
  });

  it("keeps at least 100 undo steps", () => {
    const { doc, page } = setup();
    const f = doc.transact("Add", (tx) => tx.create("FRAME", page));
    for (let i = 1; i <= 150; i++) doc.transact(`Width ${i}`, (tx) => tx.set(f, "width", 100 + i));
    let n = 0;
    while (doc.undo()) n++;
    expect(n).toBeGreaterThanOrEqual(100);
  });

  it("tells listeners about edits, undo and redo", () => {
    const { doc, page } = setup();
    const seen: Change["origin"][] = [];
    doc.subscribe((c) => seen.push(c.origin));
    doc.transact("Add", (tx) => tx.create("FRAME", page));
    doc.undo();
    doc.redo();
    expect(seen).toEqual(["edit", "undo", "redo"]);
  });

  it("keeps a file's last page", () => {
    const { doc, page } = setup();
    expect(() => doc.transact("Delete", (tx) => tx.delete(page))).toThrow(/at least one page/);
  });

  it("saves and reopens through the file format with nothing lost", () => {
    const { doc, page } = setup();
    doc.transact("Build", (tx) => {
      tx.addPage("Components");
      const f = tx.create("FRAME", page, { name: "Welcome", width: 393, height: 852 });
      tx.create("TEXT", f, { characters: "Every trail, offline.", fontSize: 28 });
      for (let i = 0; i < 50; i++) tx.create("RECTANGLE", f, { x: i * 4, cornerRadius: 8 });
    });
    const reopened = Document.fromFile(readPackage(writePackage(doc.toFile())));
    expect(reopened.fileId).toBe(doc.fileId);
    expect(reopened.pages().map((p) => p.name)).toEqual(["Page 1", "Components"]);
    const sort = (d: Document) => d.toFile().nodes.sort((a, b) => a.id.localeCompare(b.id));
    expect(sort(reopened)).toEqual(sort(doc));
    expect(reopened.children(page).length).toBe(1);
  });

  it("handles 10,000 layers quickly", () => {
    const { doc, page } = setup();
    const t0 = performance.now();
    doc.transact("Bulk", (tx) => {
      for (let i = 0; i < 100; i++) {
        const f = tx.create("FRAME", page);
        for (let j = 0; j < 99; j++) tx.create("RECTANGLE", f, { x: j });
      }
    });
    const tree = writePackage(doc.toFile());
    const back = Document.fromFile(readPackage(tree));
    const ms = performance.now() - t0;
    expect(back.size).toBe(10_001);
    expect(ms).toBeLessThan(5000);
  });
});
