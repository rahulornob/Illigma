// Transaction.create with a chosen id: a live edit that creates a node on
// every update keeps one id; ids must be valid and unused.
import { describe, expect, it } from "vitest";
import { Document } from "./document.js";

describe("create with a chosen id", () => {
  it("keeps the id across live edit updates, and cancel leaves nothing", () => {
    const doc = new Document("Ids");
    let page = "";
    doc.transact("Page", (tx) => (page = tx.addPage("P")));
    const edit = doc.beginLive("Add text");
    for (const characters of ["a", "ab", "abc"]) edit.update((tx) => void tx.create("TEXT", page, { characters }, "last", "text_1"));
    expect(doc.get("text_1")?.characters).toBe("abc");
    expect(doc.children(page)).toHaveLength(1);
    edit.cancel();
    expect(doc.has("text_1")).toBe(false);
  });

  it("refuses an id in use or an invalid one", () => {
    const doc = new Document("Ids");
    let page = "";
    doc.transact("Page", (tx) => (page = tx.addPage("P")));
    doc.transact("A", (tx) => tx.create("RECTANGLE", page, {}, "last", "r1"));
    expect(() => doc.transact("B", (tx) => tx.create("RECTANGLE", page, {}, "last", "r1"))).toThrow(/already exists/);
    expect(() => doc.transact("C", (tx) => tx.create("RECTANGLE", page, {}, "last", "bad id!"))).toThrow(/not a valid node id/);
    expect(doc.children(page)).toHaveLength(1);
  });
});
