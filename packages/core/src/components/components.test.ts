import { describe, expect, it } from "vitest";
import { Document } from "../document.js";
import {
  addComponentProperty,
  combineAsVariants,
  componentsNormalizer,
  createComponent,
  createInstance,
  detachInstance,
  listComponents,
  resetOverrides,
  setInstanceProperty,
  setVariant,
  variantProperties,
} from "./index.js";

const red = [{ type: "SOLID" as const, visible: true, color: { r: 1, g: 0, b: 0, a: 1 } }];
const blue = [{ type: "SOLID" as const, visible: true, color: { r: 0, g: 0, b: 1, a: 1 } }];

function setup() {
  const doc = new Document("Test", { normalize: componentsNormalizer });
  let page = "";
  let comp = "";
  let rect = "";
  let label = "";
  doc.transact("Setup", (tx) => {
    page = tx.addPage("Page 1");
    const frame = tx.create("FRAME", page, { name: "Button", width: 120, height: 40 });
    rect = tx.create("RECTANGLE", frame, { name: "Bg", width: 120, height: 40, fills: red });
    label = tx.create("TEXT", frame, { name: "Label", characters: "OK", width: 40, height: 20 });
    comp = createComponent(doc, tx, [frame])[0] as string;
  });
  return { doc, page, comp, rect, label };
}

const snapshot = (doc: Document) => JSON.stringify(doc.toFile().nodes.slice().sort((a, b) => a.id.localeCompare(b.id)));
const kids = (doc: Document, id: string) => doc.children(id);

describe("components", () => {
  it("turns a frame into a component with the same id and children", () => {
    const { doc, comp, rect } = setup();
    expect(doc.get(comp)?.type).toBe("COMPONENT");
    expect(doc.get(rect)?.parentId).toBe(comp);
    expect(listComponents(doc).map((c) => c.id)).toEqual([comp]);
  });

  it("creates an instance with copied layers mapped to the main component", () => {
    const { doc, page, comp, rect } = setup();
    let inst = "";
    doc.transact("Instance", (tx) => (inst = createInstance(doc, tx, comp, page, { x: 300, y: 0 })));
    const c = kids(doc, inst);
    expect(c.map((n) => n.mainId)).toEqual([rect, expect.any(String)]);
    expect(c[0]?.fills).toEqual(red);
    expect(c[0]?.id).not.toBe(rect);
  });

  it("propagates main component edits and keeps overrides", () => {
    const { doc, page, comp, rect, label } = setup();
    let inst = "";
    doc.transact("Instance", (tx) => (inst = createInstance(doc, tx, comp, page, { x: 300, y: 0 })));
    const [bg, text] = kids(doc, inst);
    doc.transact("Override text", (tx) => tx.set(text!.id, "characters", "Cancel"));
    expect(doc.get(inst)?.overrides).toEqual({ [label]: { characters: "Cancel" } });
    doc.transact("Edit main", (tx) => {
      tx.set(rect, "fills", blue);
      tx.set(label, "characters", "Okay");
      tx.set(label, "fontSize", 20);
    });
    expect(doc.get(bg!.id)?.fills).toEqual(blue);
    expect(doc.get(text!.id)?.characters).toBe("Cancel");
    expect(doc.get(text!.id)?.fontSize).toBe(20);
  });

  it("adds and removes copies when the main component's layers change", () => {
    const { doc, page, comp, rect } = setup();
    let inst = "";
    doc.transact("Instance", (tx) => (inst = createInstance(doc, tx, comp, page, { x: 300, y: 0 })));
    let dot = "";
    doc.transact("Add", (tx) => (dot = tx.create("ELLIPSE", comp, { name: "Dot" })));
    expect(kids(doc, inst).map((n) => n.mainId)).toContain(dot);
    doc.transact("Delete", (tx) => tx.delete(rect));
    expect(kids(doc, inst).map((n) => n.mainId)).not.toContain(rect);
  });

  it("setting a field back to the main value removes the override", () => {
    const { doc, page, comp } = setup();
    let inst = "";
    doc.transact("Instance", (tx) => (inst = createInstance(doc, tx, comp, page, { x: 300, y: 0 })));
    const bg = kids(doc, inst)[0]!.id;
    doc.transact("Blue", (tx) => tx.set(bg, "fills", blue));
    expect(doc.get(inst)?.overrides).toBeTruthy();
    doc.transact("Red", (tx) => tx.set(bg, "fills", red));
    expect(doc.get(inst)?.overrides).toBeUndefined();
  });

  it("undo restores exactly, including propagation", () => {
    const { doc, page, comp, rect } = setup();
    let inst = "";
    doc.transact("Instance", (tx) => (inst = createInstance(doc, tx, comp, page, { x: 300, y: 0 })));
    const before = snapshot(doc);
    doc.transact("Edit main", (tx) => tx.set(rect, "fills", blue));
    doc.transact("Override", (tx) => tx.set(kids(doc, inst)[1]!.id, "characters", "X"));
    const after = snapshot(doc);
    doc.undo();
    doc.undo();
    expect(snapshot(doc)).toBe(before);
    doc.redo();
    doc.redo();
    expect(snapshot(doc)).toBe(after);
  });

  it("detaches an instance into a frame with the same layers", () => {
    const { doc, page, comp, rect } = setup();
    let inst = "";
    doc.transact("Instance", (tx) => (inst = createInstance(doc, tx, comp, page, { x: 300, y: 0 })));
    const ids = kids(doc, inst).map((n) => n.id);
    doc.transact("Detach", (tx) => detachInstance(doc, tx, inst));
    expect(doc.get(inst)?.type).toBe("FRAME");
    expect(doc.get(inst)?.componentId).toBeUndefined();
    expect(kids(doc, inst).map((n) => n.id)).toEqual(ids);
    expect(kids(doc, inst).every((n) => n.mainId === undefined)).toBe(true);
    doc.transact("Edit main", (tx) => tx.set(rect, "fills", blue));
    expect(kids(doc, inst)[0]?.fills).toEqual(red);
  });

  it("resets overrides", () => {
    const { doc, page, comp } = setup();
    let inst = "";
    doc.transact("Instance", (tx) => (inst = createInstance(doc, tx, comp, page, { x: 300, y: 0 })));
    const bg = kids(doc, inst)[0]!.id;
    doc.transact("Blue", (tx) => tx.set(bg, "fills", blue));
    doc.transact("Reset", (tx) => resetOverrides(doc, tx, inst));
    expect(doc.get(bg)?.fills).toEqual(red);
    expect(doc.get(inst)?.overrides).toBeUndefined();
  });

  it("propagates through nested instances", () => {
    const { doc, page, comp, rect } = setup();
    let card = "";
    let outer = "";
    doc.transact("Card", (tx) => {
      const f = tx.create("FRAME", page, { name: "Card", x: 0, y: 200, width: 300, height: 200 });
      createInstance(doc, tx, comp, f, { x: 10, y: 10 });
      card = createComponent(doc, tx, [f])[0]!;
    });
    doc.transact("Outer", (tx) => (outer = createInstance(doc, tx, card, page, { x: 400, y: 200 })));
    const nested = kids(doc, outer)[0]!;
    expect(nested.type).toBe("INSTANCE");
    doc.transact("Edit button", (tx) => tx.set(rect, "fills", blue));
    expect(kids(doc, nested.id)[0]?.fills).toEqual(blue);
    // An override deep inside belongs to the outermost instance.
    doc.transact("Override", (tx) => tx.set(kids(doc, nested.id)[1]!.id, "characters", "Deep"));
    expect(Object.keys(doc.get(outer)?.overrides ?? {})).toHaveLength(1);
    doc.transact("Edit button", (tx) => tx.set(rect, "fills", red));
    expect(kids(doc, nested.id)[1]?.characters).toBe("Deep");
    // Detach keeps the nested instance, now outermost, with the override carried over.
    doc.transact("Detach", (tx) => detachInstance(doc, tx, outer));
    const n2 = doc.get(nested.id)!;
    expect(n2.type).toBe("INSTANCE");
    expect(n2.mainId).toBeUndefined();
    expect(kids(doc, n2.id).map((k) => k.mainId)).toContain(rect);
    doc.transact("Edit button", (tx) => tx.set(rect, "fills", blue));
    expect(kids(doc, n2.id)[0]?.fills).toEqual(blue);
    expect(kids(doc, n2.id)[1]?.characters).toBe("Deep");
  });

  it("combines variants and switches between them, keeping overrides", () => {
    const { doc, page, comp, label } = setup();
    let other = "";
    let set = "";
    doc.transact("Second", (tx) => {
      const f = tx.create("FRAME", page, { name: "Button 2", x: 0, y: 100, width: 120, height: 40 });
      tx.create("RECTANGLE", f, { name: "Bg", width: 120, height: 40, fills: blue });
      tx.create("TEXT", f, { name: "Label", characters: "OK", width: 40, height: 20 });
      other = createComponent(doc, tx, [f])[0]!;
      set = combineAsVariants(doc, tx, [comp, other])!;
    });
    expect(doc.get(set)?.type).toBe("COMPONENT_SET");
    expect(variantProperties(doc, set)).toEqual({ "Property 1": ["Default", "Variant2"] });
    let inst = "";
    doc.transact("Instance", (tx) => (inst = createInstance(doc, tx, comp, page, { x: 300, y: 0 })));
    const ids = kids(doc, inst).map((n) => n.id);
    doc.transact("Text", (tx) => tx.set(ids[1]!, "characters", "Go"));
    expect(doc.get(inst)?.overrides?.[label]).toBeTruthy();
    doc.transact("Variant", (tx) => setVariant(doc, tx, inst, "Property 1", "Variant2"));
    expect(doc.get(inst)?.componentId).toBe(other);
    expect(kids(doc, inst).map((n) => n.id)).toEqual(ids);
    expect(kids(doc, inst)[0]?.fills).toEqual(blue);
    expect(kids(doc, inst)[1]?.characters).toBe("Go");
  });

  it("component properties drive visibility and text", () => {
    const { doc, page, comp, rect, label } = setup();
    let show = "";
    let text = "";
    doc.transact("Props", (tx) => {
      show = addComponentProperty(doc, tx, rect, "BOOLEAN")!;
      text = addComponentProperty(doc, tx, label, "TEXT")!;
    });
    expect(doc.get(comp)?.componentPropertyDefinitions?.[show]?.type).toBe("BOOLEAN");
    let inst = "";
    doc.transact("Instance", (tx) => (inst = createInstance(doc, tx, comp, page, { x: 300, y: 0 })));
    doc.transact("Set", (tx) => {
      setInstanceProperty(doc, tx, inst, show, false);
      setInstanceProperty(doc, tx, inst, text, "Hello");
    });
    expect(kids(doc, inst)[0]?.visible).toBe(false);
    expect(kids(doc, inst)[1]?.characters).toBe("Hello");
  });

  it("keeps instance layer ids stable across many edits (no churn)", () => {
    const { doc, page, comp, rect } = setup();
    let inst = "";
    doc.transact("Instance", (tx) => (inst = createInstance(doc, tx, comp, page, { x: 300, y: 0 })));
    const ids = kids(doc, inst).map((n) => n.id);
    for (let i = 0; i < 5; i++) doc.transact("w", (tx) => tx.set(rect, "width", 100 + i));
    expect(kids(doc, inst).map((n) => n.id)).toEqual(ids);
    expect(kids(doc, inst)[0]?.width).toBe(104);
  });
});
