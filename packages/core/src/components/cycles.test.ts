// QC round 9: components containing instances of each other must never grow without limit.
import { describe, expect, it, vi } from "vitest";
import { Document } from "../document.js";
import { componentsNormalizer, createComponent, createInstance, wouldCreateCycle } from "./index.js";

function twoComponents() {
  const doc = new Document("Test", { normalize: componentsNormalizer });
  let page = "",
    a = "",
    b = "";
  doc.transact("Setup", (tx) => {
    page = tx.addPage("Page 1");
    const fa = tx.create("FRAME", page, { name: "A", width: 100, height: 100 });
    tx.create("RECTANGLE", fa, { name: "ra", width: 10, height: 10 });
    const fb = tx.create("FRAME", page, { name: "B", x: 200, width: 100, height: 100 });
    tx.create("RECTANGLE", fb, { name: "rb", width: 10, height: 10 });
    a = createComponent(doc, tx, [fa])[0]!;
    b = createComponent(doc, tx, [fb])[0]!;
  });
  return { doc, page, a, b };
}

describe("component cycles", () => {
  it("refuses an instance of a component inside itself, directly or through another component", () => {
    const { doc, a, b } = twoComponents();
    expect(wouldCreateCycle(doc, a, a)).toBe(true);
    expect(() => doc.transact("self", (tx) => createInstance(doc, tx, a, a, { x: 0, y: 0 }))).toThrow(/itself/);
    doc.transact("B in A", (tx) => createInstance(doc, tx, b, a, { x: 0, y: 0 }));
    expect(wouldCreateCycle(doc, a, b)).toBe(true);
    const before = doc.toFile().nodes.length;
    expect(() => doc.transact("A in B", (tx) => createInstance(doc, tx, a, b, { x: 0, y: 0 }))).toThrow(/itself/);
    expect(doc.toFile().nodes.length).toBe(before);
  });

  it("moving an instance into a component that it uses is a cycle; elsewhere it isn't", () => {
    const { doc, page, a, b } = twoComponents();
    let ia = "";
    doc.transact("A on page", (tx) => (ia = createInstance(doc, tx, a, page, { x: 0, y: 300 })));
    doc.transact("B in A", (tx) => createInstance(doc, tx, b, a, { x: 0, y: 0 }));
    expect(wouldCreateCycle(doc, [ia], b)).toBe(true);
    expect(wouldCreateCycle(doc, [ia], page)).toBe(false);
  });

  it("a file that already has a cycle stops syncing (and warns) instead of growing", () => {
    const { doc, a, b } = twoComponents();
    doc.transact("B in A", (tx) => createInstance(doc, tx, b, a, { x: 0, y: 0 }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Forced past the check, as an old or hand-made file could be.
    doc.transact("A in B (forced)", (tx) => void tx.create("INSTANCE", b, { name: "A", width: 100, height: 100, componentId: a }));
    const n1 = doc.toFile().nodes.length;
    for (let i = 0; i < 3; i++) doc.transact("edit", (tx) => tx.set(a, "width", 101 + i));
    expect(doc.toFile().nodes.length).toBe(n1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
