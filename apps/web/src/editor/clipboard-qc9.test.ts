// QC round 9: copies of instance layers, main components and styled layers.
import { describe, expect, it } from "vitest";
import { addCollection, addVariable, bindVariable, createComponent, createInstance, createStyleFromNode, Document, withComponents, withDefinitions } from "@illigma/core";
import { pasteLayers, serializeLayers } from "./clipboard";
import { deleteLayers, duplicateLayers } from "./edit";
import { canDrop, wrapLayers } from "./layer-ops";

const red = [{ type: "SOLID" as const, visible: true, color: { r: 1, g: 0, b: 0, a: 1 } }];
const newDoc = () => new Document("T", { normalize: withComponents(withDefinitions()) });

function setup() {
  const doc = newDoc();
  let page = "", comp = "", inst = "";
  doc.transact("s", (tx) => {
    page = tx.addPage("P");
    const f = tx.create("FRAME", page, { name: "Card", width: 100, height: 100 });
    tx.create("RECTANGLE", f, { name: "r", width: 10, height: 10, fills: red });
    comp = createComponent(doc, tx, [f])[0]!;
  });
  doc.transact("i", (tx) => (inst = createInstance(doc, tx, comp, page, { x: 200, y: 0 })));
  const child = doc.children(inst)[0]!.id;
  return { doc, page, comp, inst, child };
}

describe("instance layers can't be duplicated, deleted or grouped", () => {
  it("refuses with a short message and changes nothing", () => {
    const { doc, child, inst } = setup();
    expect(() => doc.transact("d", (tx) => duplicateLayers(tx, doc, [child]))).toThrow(/inside an instance/);
    expect(() => doc.transact("x", (tx) => deleteLayers(tx, doc, [child]))).toThrow(/inside an instance/);
    expect(() => doc.transact("g", (tx) => wrapLayers(tx, doc, [child], "GROUP"))).toThrow(/inside an instance/);
    expect(doc.children(inst)).toHaveLength(1);
  });

  it("no drop into an instance, out of one, or of a component into itself", () => {
    const { doc, page, comp, inst, child } = setup();
    expect(canDrop(doc, [child], { parentId: page, position: "last" })).toBe(false);
    let other = "";
    doc.transact("o", (tx) => (other = tx.create("RECTANGLE", page, { name: "o" })));
    expect(canDrop(doc, [other], { parentId: inst, position: "last" })).toBe(false);
    expect(canDrop(doc, [inst], { parentId: comp, position: "last" })).toBe(false);
    expect(canDrop(doc, [other], { parentId: comp, position: "last" })).toBe(true);
  });
});

describe("paste", () => {
  it("a layer copied out of an instance loses its mainId; pasting into an instance goes beside it", () => {
    const { doc, page, inst, child } = setup();
    const data = serializeLayers(doc, [child])!;
    const [id] = doc.transact("p", (tx) => pasteLayers(tx, doc, data, { selection: [inst], pageId: page, inPlace: true }));
    expect(doc.get(id!)!.parentId).toBe(page);
    expect(doc.get(id!)!.mainId).toBeUndefined();
    expect(doc.children(inst)).toHaveLength(1);
  });

  it("a copied main component pastes as an instance in the same file", () => {
    const { doc, page, comp } = setup();
    const data = serializeLayers(doc, [comp])!;
    const [id] = doc.transact("p", (tx) => pasteLayers(tx, doc, data, { selection: [], pageId: page, inPlace: true }));
    expect(doc.get(id!)!.type).toBe("INSTANCE");
    expect(doc.get(id!)!.componentId).toBe(comp);
    expect(doc.children(id!)[0]!.mainId).toBe(doc.children(comp)[0]!.id);
  });

  it("refuses to paste a main component into itself", () => {
    const { doc, page, comp } = setup();
    const data = serializeLayers(doc, [comp])!;
    expect(() => doc.transact("p", (tx) => pasteLayers(tx, doc, data, { selection: [doc.children(comp)[0]!.id], pageId: page, inPlace: true }))).toThrow(/itself/);
  });

  it("in another file: a main becomes a local component, an instance a frame, no dangling ids", () => {
    const { doc, comp, inst } = setup();
    const data = serializeLayers(doc, [comp, inst])!;
    const dest = newDoc();
    let page = "";
    dest.transact("p", (tx) => (page = tx.addPage("P")));
    const [c, i] = dest.transact("p", (tx) => pasteLayers(tx, dest, data, { selection: [], pageId: page, inPlace: true }));
    expect(dest.get(c!)!.type).toBe("COMPONENT");
    expect(dest.get(i!)!.type).toBe("FRAME");
    for (const n of dest.subtree(page)) {
      expect(n.mainId).toBeUndefined();
      expect(n.componentId).toBeUndefined();
    }
  });

  it("in another file: styles and variables come along (reused when equal), never left dangling", () => {
    const src = newDoc();
    let page = "", rect = "", varId = "";
    src.transact("s", (tx) => {
      page = tx.addPage("P");
      rect = tx.create("RECTANGLE", page, { name: "Hero", width: 10, height: 10, fills: red });
      createStyleFromNode(tx, src, rect, "fills", "Brand/Hero");
      const coll = addCollection(tx, src, "Tokens");
      varId = addVariable(tx, src, coll.id, "radius", "FLOAT", 8).id;
      bindVariable(tx, src, rect, "cornerRadius", varId);
    });
    const data = serializeLayers(src, [rect])!;
    const dest = newDoc();
    let p2 = "";
    dest.transact("p", (tx) => (p2 = tx.addPage("P")));
    const [a] = dest.transact("p", (tx) => pasteLayers(tx, dest, data, { selection: [], pageId: p2, inPlace: true }));
    const n = dest.get(a!)!;
    expect(dest.styles().map((s) => s.name)).toEqual(["Brand/Hero"]);
    expect(n.fillStyleId).toBe(dest.styles()[0]!.id);
    expect(dest.variables().variables.map((v) => v.name)).toEqual(["radius"]);
    expect(n.boundVariables?.cornerRadius?.id).toBe(dest.variables().variables[0]!.id);
    // Pasting again reuses them.
    dest.transact("p", (tx) => pasteLayers(tx, dest, data, { selection: [], pageId: p2, inPlace: true }));
    expect(dest.styles()).toHaveLength(1);
    expect(dest.variables().variables).toHaveLength(1);
  });
});
