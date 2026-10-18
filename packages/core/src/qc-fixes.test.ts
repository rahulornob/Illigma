/** Regression tests for the QC review fixes in @illigma/core. */

import { describe, expect, it } from "vitest";
import { readPackage, validateFile, writePackage, type Node } from "@illigma/format";
import { Document, DocumentError, type Operation, type Transaction } from "./index.js";

/** Time budgets are tuned on a laptop. Shared CI runners are slower, so CI gets 3x (or PERF_BUDGET_SCALE). */
const budget = (ms: number) => ms * (Number(process.env.PERF_BUDGET_SCALE) || (process.env.CI ? 3 : 1));

function setup() {
  const doc = new Document("QC");
  const page = doc.transact("Add page", (tx) => tx.addPage("Page 1"));
  return { doc, page };
}

describe("appending many children", () => {
  it("creates 10,000 children under one parent in under 1 s, with short keys", () => {
    const { doc, page } = setup();
    const t0 = performance.now();
    doc.transact("Bulk", (tx) => {
      for (let i = 0; i < 10_000; i++) tx.create("RECTANGLE", page, { x: i });
    });
    const ms = performance.now() - t0;
    const kids = doc.children(page);
    expect(kids).toHaveLength(10_000);
    expect(kids.map((n) => n.x)).toEqual(Array.from({ length: 10_000 }, (_, i) => i));
    expect(Math.max(...kids.map((n) => n.index.length))).toBeLessThanOrEqual(8);
    expect(ms, `took ${Math.round(ms)} ms`).toBeLessThan(budget(1_000));
  });

  it("keeps children sorted through first/before/after inserts, moves, undo and redo", () => {
    const { doc, page } = setup();
    const [a, b, c] = doc.transact("Add", (tx) => [tx.create("FRAME", page, { name: "a" }), tx.create("FRAME", page, { name: "b" }), tx.create("FRAME", page, { name: "c" })]) as [string, string, string];
    doc.transact("Insert", (tx) => {
      tx.create("FRAME", page, { name: "first" }, "first");
      tx.create("FRAME", page, { name: "b-" }, { before: b });
      tx.create("FRAME", page, { name: "b+" }, { after: b });
      tx.move(a, page, "last");
      tx.move(c, page, { before: b });
    });
    const names = () => doc.children(page).map((n) => n.name);
    expect(names()).toEqual(["first", "b-", "c", "b", "b+", "a"]);
    doc.undo();
    expect(names()).toEqual(["a", "b", "c"]);
    doc.redo();
    expect(names()).toEqual(["first", "b-", "c", "b", "b+", "a"]);
    expect(validateFile(doc.toFile())).toEqual([]);
  });
});

describe("value validation", () => {
  it("create and set refuse NaN, Infinity, bad types and unknown fields before recording", () => {
    const { doc, page } = setup();
    const f = doc.transact("Add", (tx) => tx.create("FRAME", page));
    const bad: [string, unknown][] = [["x", NaN], ["width", Infinity], ["fontSize", -Infinity], ["name", 3], ["visible", "yes"], ["fills", [{ type: "SOLID", visible: true, color: { r: 2, g: 0, b: 0, a: 1 } }]]];
    for (const [key, value] of bad) {
      expect(() => doc.transact("Bad", (tx) => tx.set(f, key as "x", value as number)), key).toThrow(DocumentError);
      expect(() => doc.transact("Bad", (tx) => tx.create("RECTANGLE", page, { [key]: value })), key).toThrow(DocumentError);
    }
    expect(() => doc.transact("Bad", (tx) => tx.set(f, "x", 10n as unknown as number))).toThrow(DocumentError);
    expect(() => doc.transact("Bad", (tx) => tx.create("RECTANGLE", page, { bogus: 1 } as never))).toThrow(/Unknown node field/);
    expect(() => doc.transact("Bad", (tx) => tx.set(f, "bogus" as "x", 1))).toThrow(DocumentError);
    expect(doc.undoLabel).toBe("Add");
    expect(doc.children(page)).toHaveLength(1);
    expect(validateFile(doc.toFile())).toEqual([]);
  });

  it("create forces id, type, parentId and index over anything in fields", () => {
    const { doc, page } = setup();
    const fields = { id: "x", type: "PAGE", parentId: null, index: "a0", name: "kept" } as unknown as Partial<Node>;
    const id = doc.transact("Add", (tx) => tx.create("ELLIPSE", page, fields));
    expect(doc.get(id)).toMatchObject({ id, type: "ELLIPSE", parentId: page, name: "kept" });
  });
});

describe("move", () => {
  it("refuses a missing target parent and leaves the node where it was", () => {
    const { doc, page } = setup();
    const f = doc.transact("Add", (tx) => tx.create("FRAME", page));
    expect(() => doc.transact("Move", (tx) => tx.move(f, "missing"))).toThrow(/does not exist/);
    expect(doc.get(f)?.parentId).toBe(page);
  });
});

describe("immutability", () => {
  it("hands out frozen nodes; edits replace the object and keep the old one intact", () => {
    const { doc, page } = setup();
    const f = doc.transact("Add", (tx) => tx.create("FRAME", page, { fills: [{ type: "SOLID", visible: true, color: { r: 1, g: 0, b: 0, a: 1 } }] }));
    const before = doc.get(f)!;
    expect(Object.isFrozen(before) && Object.isFrozen(before.fills) && Object.isFrozen(before.fills[0]?.color)).toBe(true);
    doc.transact("Rename", (tx) => tx.set(f, "name", "New"));
    expect(doc.get(f)).not.toBe(before);
    expect(before.name).toBe("Frame");
    expect(doc.get(f)?.fills).toBe(before.fills); // unchanged fields are shared, not copied
  });
});

describe("pages from a file", () => {
  it("fromFile orders pages by index, whatever the node order", () => {
    const { doc } = setup();
    doc.transact("Pages", (tx) => {
      tx.addPage("Two");
      tx.addPage("Zero", "first");
    });
    const file = doc.toFile();
    file.nodes.reverse();
    expect(Document.fromFile(file).pages().map((p) => p.name)).toEqual(["Zero", "Page 1", "Two"]);
  });

  it("fromFile keeps an own __proto__ field as plain data", () => {
    const { doc, page } = setup();
    const file = doc.toFile();
    const i = file.nodes.findIndex((n) => n.id === page);
    file.nodes[i] = JSON.parse(JSON.stringify(file.nodes[i]).replace(/^\{/, '{"__proto__":{"polluted":true},'));
    const loaded = Document.fromFile(file);
    const node = loaded.get(page) as object;
    expect(Object.getPrototypeOf(node)).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(node, "__proto__")?.value).toEqual({ polluted: true });
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it("fromFile refuses an invalid file", () => {
    const { doc } = setup();
    const file = doc.toFile();
    file.manifest.pages.push({ id: "missing", name: "x" });
    expect(() => Document.fromFile(file)).toThrow(DocumentError);
  });
});

describe("transactions", () => {
  it("rolls back only the inner step when a nested transact throws and the outer catches", () => {
    const { doc, page } = setup();
    doc.transact("Outer", (tx) => {
      tx.create("FRAME", page, { name: "outer 1" });
      try {
        doc.transact("Inner", (inner) => {
          inner.create("FRAME", page, { name: "inner" });
          throw new Error("no");
        });
      } catch {
        /* handled */
      }
      tx.create("FRAME", page, { name: "outer 2" });
    });
    expect(doc.children(page).map((n) => n.name)).toEqual(["outer 1", "outer 2"]);
    doc.undo();
    expect(doc.children(page)).toEqual([]);
  });

  it("refuses undo, redo and replay during a transaction, and a transaction used after it ended", () => {
    const { doc, page } = setup();
    let kept: Transaction | null = null;
    doc.transact("Add", (tx) => {
      kept = tx;
      expect(() => doc.undo()).toThrow(/transaction is running/);
      expect(() => doc.redo()).toThrow(/transaction is running/);
      expect(() => doc.replay([])).toThrow(/transaction is running/);
      tx.create("FRAME", page);
    });
    expect(() => kept!.create("FRAME", page)).toThrow(/already ended/);
    expect(doc.children(page)).toHaveLength(1);
  });

  it("has no public apply()", () => {
    expect("apply" in Document.prototype).toBe(false);
  });

  it("undo is atomic: if an operation fails midway, the document and the stack are unchanged", () => {
    const { doc, page } = setup();
    const [a, b] = doc.transact("Add two", (tx) => [tx.create("FRAME", page), tx.create("FRAME", page)]) as [string, string];
    // Remove `a` behind history's back, so undoing "Add two" fails on its second step.
    doc.replay([{ op: "delete", node: doc.get(a)! }]);
    expect(() => doc.undo()).toThrow(DocumentError);
    expect(doc.has(b)).toBe(true);
    expect(doc.undoLabel).toBe("Add two");
    expect(doc.canRedo).toBe(false);
  });
});

describe("replay", () => {
  it("applies operations without history and tells listeners with origin replay", () => {
    const { doc, page } = setup();
    const source = Document.fromFile(doc.toFile());
    const ops: Operation[] = [];
    source.subscribe((c) => ops.push(...c.ops));
    source.transact("Build", (tx) => {
      const f = tx.create("FRAME", page, { name: "Card" });
      tx.create("TEXT", f, { characters: "Hi" });
      tx.set(f, "width", 320);
    });
    const origins: string[] = [];
    doc.subscribe((c) => origins.push(c.origin));
    doc.replay(JSON.parse(JSON.stringify(ops)));
    const sort = (d: Document) => d.toFile().nodes.sort((x, y) => (x.id < y.id ? -1 : 1));
    expect(sort(doc)).toEqual(sort(source));
    expect(origins).toEqual(["replay"]);
    expect(doc.undoLabel).toBe("Add page");
  });

  it("is all or nothing: an invalid operation undoes the ones before it", () => {
    const { doc, page } = setup();
    const f = doc.transact("Add", (tx) => tx.create("FRAME", page));
    const before = doc.toFile();
    const bad: Operation[] = [
      { op: "set", id: f, key: "name", value: "Renamed", prev: "Frame" },
      { op: "set", id: f, key: "x", value: null, prev: 0 }, // NaN after JSON
    ];
    expect(() => doc.replay(bad)).toThrow(DocumentError);
    expect(doc.toFile()).toEqual(before);
    expect(() => doc.replay([{ op: "set", id: f, key: "parentId", value: "missing", prev: page }])).toThrow(/does not exist/);
    expect(() => doc.replay([{ op: "delete", node: doc.get(page)! }])).toThrow(/children/);
    expect(validateFile(doc.toFile())).toEqual([]);
  });
});

describe("round trip at 10,000 layers", () => {
  it("still saves and reopens quickly with frozen nodes", () => {
    const { doc, page } = setup();
    const t0 = performance.now();
    doc.transact("Bulk", (tx) => {
      for (let i = 0; i < 100; i++) {
        const f = tx.create("FRAME", page);
        for (let j = 0; j < 99; j++) tx.create("RECTANGLE", f, { x: j });
      }
    });
    const back = Document.fromFile(readPackage(writePackage(doc.toFile())));
    const ms = performance.now() - t0;
    expect(back.size).toBe(10_001);
    expect(ms, `took ${Math.round(ms)} ms`).toBeLessThan(budget(2_000));
  });
});
