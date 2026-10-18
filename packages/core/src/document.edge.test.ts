/**
 * Isolation (aliasing) and edge-case tests for the document model.
 *
 * Tests marked `it.fails` expose known bugs: they assert the correct
 * behaviour and currently fail. When a bug is fixed, Vitest reports the
 * `it.fails` test as unexpectedly passing; turn it back into `it` then.
 */

import { describe, expect, it } from "vitest";
import { keysBetween, validateFile, type IlligmaFile, type Node, type Paint } from "@illigma/format";
import { Document, type Change, type Operation } from "./index.js";

const RED: Paint = { type: "SOLID", visible: true, color: { r: 1, g: 0, b: 0, a: 1 } };
const BLUE: Paint = { type: "SOLID", visible: true, color: { r: 0, g: 0, b: 1, a: 1 } };

function setup() {
  const doc = new Document("Edge");
  const page = doc.transact("Add page", (tx) => tx.addPage("Page 1"));
  const frame = doc.transact("Add frame", (tx) => tx.create("FRAME", page, { name: "Card", fills: [RED] }));
  return { doc, page, frame };
}

const sorted = (f: IlligmaFile) => [...f.nodes].sort((a, b) => (a.id < b.id ? -1 : 1));

describe("isolation: inputs are copied", () => {
  it("mutating the fields passed to create does not change the node", () => {
    const { doc, page } = setup();
    const fields = { name: "A", fills: [structuredClone(RED)] };
    const id = doc.transact("Add", (tx) => tx.create("RECTANGLE", page, fields));
    fields.name = "B";
    (fields.fills[0] as Paint).color.g = 1;
    fields.fills.push(BLUE);
    expect(doc.get(id)).toMatchObject({ name: "A", fills: [RED] });
  });

  it("mutating a value passed to set does not change the node or its undo history", () => {
    const { doc, frame } = setup();
    const fills = [structuredClone(BLUE)];
    doc.transact("Fill", (tx) => tx.set(frame, "fills", fills));
    (fills[0] as Paint).color.r = 1;
    fills.push(RED);
    expect(doc.get(frame)?.fills).toEqual([BLUE]);
    doc.undo();
    expect(doc.get(frame)?.fills).toEqual([RED]);
    doc.redo();
    expect(doc.get(frame)?.fills).toEqual([BLUE]);
  });

  it("mutating the file passed to fromFile does not change the document", () => {
    const { doc, frame } = setup();
    const file = doc.toFile();
    const copy = Document.fromFile(file);
    const node = file.nodes.find((n) => n.id === frame) as Node;
    node.name = "Changed";
    (node.fills[0] as Paint).color.b = 1;
    file.manifest.pages[0]!.name = "Changed";
    file.nodes.length = 0;
    expect(copy.get(frame)).toMatchObject({ name: "Card", fills: [RED] });
    expect(copy.pages().map((p) => p.name)).toEqual(["Page 1"]);
    expect(copy.size).toBe(2);
  });

  it("mutating the result of toFile does not change the document", () => {
    const { doc, frame } = setup();
    const before = doc.toFile();
    const file = doc.toFile();
    const node = file.nodes.find((n) => n.id === frame) as Node;
    node.name = "Changed";
    (node.fills[0] as Paint).color.b = 1;
    node.fills.push(BLUE);
    file.manifest.pages.pop();
    expect(sorted(doc.toFile())).toEqual(sorted(before));
    expect(doc.toFile().manifest).toEqual(before.manifest);
  });
});

describe("isolation: outputs must not alias the store", () => {
  // BUG: get()/children()/pages()/subtree() return the live stored objects.
  // `Readonly<Node>` is shallow, so `doc.get(id)!.fills.push(...)` type-checks
  // and silently edits the document without an operation, undo step or event.
  it.fails("mutating a node returned by get() does not change the document", () => {
    const { doc, frame } = setup();
    const seen: Change[] = [];
    doc.subscribe((c) => seen.push(c));
    doc.get(frame)?.fills.push(BLUE); // compiles: Readonly<Node> does not freeze arrays
    ((doc.get(frame) as Node).fills[0] as Paint).color.g = 1;
    (doc.get(frame) as Node).name = "Hacked";
    expect(doc.get(frame)).toMatchObject({ name: "Card", fills: [RED] });
    expect(seen).toEqual([]);
  });

  it.fails("mutating nodes returned by children(), pages() and subtree() does not change the document", () => {
    const { doc, page, frame } = setup();
    (doc.children(page)[0] as Node).name = "via children";
    (doc.pages()[0] as Node).name = "via pages";
    (doc.subtree(frame)[0] as Node).x = 999;
    expect(doc.get(frame)).toMatchObject({ name: "Card", x: 0 });
    expect(doc.get(page)?.name).toBe("Page 1");
  });

  it.fails("mutating a node's index through get() cannot break sibling order", () => {
    const { doc, page } = setup();
    const [a, b] = doc.transact("Add", (tx) => [tx.create("RECTANGLE", page), tx.create("RECTANGLE", page)]) as [string, string];
    (doc.get(b) as Node).index = (doc.get(a) as Node).index; // now two siblings share a key
    expect(validateFile(doc.toFile())).toEqual([]);
  });

  // BUG: the Change passed to listeners holds the same op objects as the undo
  // stack (and undo's inverted ops share `node` with them), so a listener can
  // rewrite history.
  it.fails("a listener that mutates its Change cannot rewrite undo/redo history", () => {
    const { doc, page } = setup();
    doc.subscribe((c) => {
      for (const o of c.ops as Operation[]) {
        if (o.op === "create" || o.op === "delete") o.node.name = "Rewritten";
        else o.value = "Rewritten";
      }
    });
    const id = doc.transact("Add", (tx) => tx.create("RECTANGLE", page, { name: "Original" }));
    doc.undo();
    doc.redo();
    expect(doc.get(id)?.name).toBe("Original");
  });
});

describe("edge cases that already behave", () => {
  it("normalises -0 to 0 (JSON has no -0)", () => {
    const { doc, frame } = setup();
    doc.transact("x", (tx) => tx.set(frame, "x", 5));
    doc.transact("x", (tx) => tx.set(frame, "x", -0));
    expect(Object.is(doc.get(frame)?.x, 0)).toBe(true);
  });

  it("keeps tiny and huge finite numbers exactly", () => {
    const { doc, frame } = setup();
    for (const v of [1e-12, 1e15, 5e-324, Number.MAX_VALUE, -Number.MAX_SAFE_INTEGER, 0.1 + 0.2]) {
      doc.transact("x", (tx) => tx.set(frame, "x", v));
      expect(doc.get(frame)?.x).toBe(v);
    }
    expect(validateFile(doc.toFile())).toEqual([]);
  });

  it("removes an optional text field when set to undefined and restores it on undo", () => {
    const { doc, page } = setup();
    const t = doc.transact("Text", (tx) => tx.create("TEXT", page, { characters: "Hi", fontSize: 12 }));
    doc.transact("Clear", (tx) => tx.set(t, "characters", undefined));
    expect("characters" in (doc.get(t) as object)).toBe(false);
    doc.undo();
    expect(doc.get(t)?.characters).toBe("Hi");
  });

  it("refuses a move relative to the node itself", () => {
    const { doc, page, frame } = setup();
    expect(() => doc.transact("Move", (tx) => tx.move(frame, page, { before: frame }))).toThrow(/not a sibling/);
  });

  it("deletes a page that is not the last one, and undo restores page order", () => {
    const { doc } = setup();
    const [p2, p3] = doc.transact("Pages", (tx) => [tx.addPage("2"), tx.addPage("3")]);
    const order = doc.pages().map((p) => p.id);
    doc.transact("Delete", (tx) => tx.delete(p2 as string));
    expect(doc.pages().map((p) => p.id)).toEqual(order.filter((id) => id !== p2));
    doc.undo();
    expect(doc.pages().map((p) => p.id)).toEqual(order);
    expect(p3).toBeDefined();
  });
});

describe("known bugs", () => {
  // BUG: move() never checks that the new parent exists. The node is linked
  // under a missing id and the document can no longer be saved.
  it.fails("move into a missing parent is refused", () => {
    const { doc, frame } = setup();
    expect(() => doc.transact("Move", (tx) => tx.move(frame, "missing"))).toThrow();
    expect(validateFile(doc.toFile())).toEqual([]);
  });

  // BUG: set() deep-copies through JSON, so NaN, Infinity and -Infinity are
  // stored as null. The call type-checks, nothing throws, and the next save
  // fails validation.
  it.fails("set refuses non-finite numbers instead of storing null", () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      const { doc, frame } = setup();
      let threw = false;
      try {
        doc.transact("Width", (tx) => tx.set(frame, "width", bad));
      } catch {
        threw = true;
      }
      expect(threw || Object.is(doc.get(frame)?.width, bad)).toBe(true);
      expect(validateFile(doc.toFile())).toEqual([]);
    }
  });

  it.fails("set refuses paints with non-finite channels instead of storing null", () => {
    const { doc, frame } = setup();
    const bad: Paint = { type: "SOLID", visible: true, color: { r: NaN, g: 0, b: 0, a: 1 } };
    try {
      doc.transact("Fill", (tx) => tx.set(frame, "fills", [bad]));
    } catch {
      /* refusing is fine */
    }
    expect(validateFile(doc.toFile())).toEqual([]);
  });

  // BUG: a nested transact() joins the outer one. If the inner callback
  // throws and the outer callback catches it, the inner operations stay
  // applied, although transact() promises "every operation it made is
  // rolled back".
  it.fails("an inner transaction that throws is rolled back even when the outer one catches", () => {
    const { doc, page } = setup();
    doc.transact("Outer", () => {
      try {
        doc.transact("Inner", (tx) => {
          tx.create("RECTANGLE", page, { name: "inner" });
          throw new Error("inner failed");
        });
      } catch {
        /* the caller handles the failure */
      }
    });
    expect(doc.children(page).some((n) => n.name === "inner")).toBe(false);
  });

  // BUG: create() spreads `fields` over the defaults, so at runtime (plugins,
  // MCP, JS callers) fields can override id, type, parentId and index. The
  // returned id then names no node, and a PAGE can be created under a frame.
  it.fails("create ignores id, type, parentId and index smuggled in through fields", () => {
    const { doc, page, frame } = setup();
    const fields = { id: "forced", type: "PAGE", parentId: frame, index: "V" } as unknown as Partial<Node>;
    const id = doc.transact("Add", (tx) => tx.create("RECTANGLE", page, fields));
    expect(doc.get(id)).toMatchObject({ type: "RECTANGLE", parentId: page });
    expect(doc.has("forced")).toBe(false);
    expect(validateFile(doc.toFile())).toEqual([]);
  });

  // BUG: set() only blocks "parentId" and "index" at runtime; "id" and "type"
  // are blocked by TypeScript alone. Changing "id" desynchronises the map key.
  it.fails("set refuses id and type at runtime", () => {
    const { doc, frame } = setup();
    expect(() => doc.transact("Id", (tx) => tx.set(frame, "id" as "name", "other"))).toThrow();
    expect(() => doc.transact("Type", (tx) => tx.set(frame, "type" as "name", "PAGE"))).toThrow();
    expect(validateFile(doc.toFile())).toEqual([]);
  });

  // BUG: undo() and redo() can run inside an active transaction. Undoing the
  // step that created the page deletes it under the new child (apply("delete")
  // does not check for children), and committing then clears the redo stack,
  // so the page can never come back: the document is left with an orphan.
  it.fails("undo inside an active transaction is refused or leaves a valid document", () => {
    const doc = new Document("Edge");
    doc.transact("Page 1", (tx) => tx.addPage("Page 1"));
    const p2 = doc.transact("Page 2", (tx) => tx.addPage("Page 2"));
    try {
      doc.transact("Draw", (tx) => {
        tx.create("RECTANGLE", p2);
        doc.undo(); // e.g. a plugin or listener calling undo mid-transaction
      });
    } catch {
      /* refusing is fine */
    }
    expect(validateFile(doc.toFile())).toEqual([]);
  });

  // BUG: Document.fromFile takes page order from the manifest, but new page
  // keys are computed from neighbours in that order. When the manifest order
  // disagrees with the page nodes' index keys (validateFile accepts this),
  // addPage("last") can reuse an existing key and addPage({ after }) throws
  // "must sort before".
  it.fails("a file whose manifest page order disagrees with page indexes still gets valid page keys", () => {
    const d = new Document("Order");
    const [p1, p2] = d.transact("Pages", (tx) => [tx.addPage("One"), tx.addPage("Two")]) as [string, string];
    const file = d.toFile();
    // p1 has the smaller key, p2 the larger; list them in the opposite order.
    file.manifest.pages.reverse();
    expect(file.manifest.pages.map((p) => p.id)).toEqual([p2, p1]);
    if (validateFile(file).length) return; // rejecting the file is also a fix
    const doc = Document.fromFile(file);
    doc.transact("Add", (tx) => tx.addPage("Three"));
    expect(validateFile(doc.toFile())).toEqual([]);
    expect(() => doc.transact("Add", (tx) => tx.addPage("Four", { after: p2 }))).not.toThrow();
    expect(validateFile(doc.toFile())).toEqual([]);
  });

  // BUG: subtree() collects with out.push(...children), which spreads the
  // whole sibling list as call arguments. With 200,000 direct children this
  // throws "RangeError: Maximum call stack size exceeded", so such a page
  // can't be deleted, and a frame with that many children can't be moved or deleted.
  it.fails("subtree and delete work with 200,000 direct children", () => {
    const seed = new Document("Big");
    const [p1] = seed.transact("Pages", (tx) => [tx.addPage("Big"), tx.addPage("Other")]) as [string, string];
    const file = seed.toFile();
    const base = file.nodes.find((n) => n.id === p1) as Node;
    const keys = keysBetween(null, null, 200_000);
    keys.forEach((index, i) => file.nodes.push({ ...base, type: "RECTANGLE", id: `r${i}`, parentId: p1, index, name: "r" }));
    const doc = Document.fromFile(file);
    expect(doc.subtree(p1).length).toBe(200_001);
    doc.transact("Delete", (tx) => tx.delete(p1));
    expect(doc.size).toBe(1);
  }, 60_000);
});
