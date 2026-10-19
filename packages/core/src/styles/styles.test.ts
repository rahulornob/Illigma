import { readPackage, writePackage } from "@illigma/format";
import { describe, expect, it } from "vitest";
import { Document } from "../document.js";
import {
  addCollection,
  addMode,
  addVariable,
  bindVariable,
  createStyleFromNode,
  deleteStyle,
  deleteVariable,
  detachStyle,
  moveStyle,
  setFrameMode,
  updateStyle,
  updateVariable,
  withDefinitions,
} from "./index.js";

const red = { r: 1, g: 0, b: 0, a: 1 };
const blue = { r: 0, g: 0, b: 1, a: 1 };
const solid = (color: typeof red) => [{ type: "SOLID" as const, visible: true, color }];

function setup() {
  const doc = new Document("T", { normalize: withDefinitions() });
  const ids = doc.transact("setup", (tx) => {
    const page = tx.addPage();
    const frame = tx.create("FRAME", page, { fills: solid(red) });
    const a = tx.create("RECTANGLE", frame, { fills: solid(red) });
    const b = tx.create("RECTANGLE", frame, { fills: solid(blue) });
    return { page, frame, a, b };
  });
  return { doc, ...ids };
}

describe("styles", () => {
  it("propagates a paint style edit to every user in one undo step", () => {
    const { doc, a, b } = setup();
    const sid = doc.transact("Create style", (tx) => createStyleFromNode(tx, doc, a, "fills", "Brand/Red"));
    doc.transact("Apply", (tx) => tx.set(b, "fillStyleId", sid));
    expect(doc.get(b)?.fills).toEqual(solid(red));
    doc.transact("Edit style", (tx) => updateStyle(tx, doc, sid, { paints: solid(blue) } as never));
    expect(doc.get(a)?.fills).toEqual(solid(blue));
    expect(doc.get(b)?.fills).toEqual(solid(blue));
    doc.undo();
    expect(doc.get(a)?.fills).toEqual(solid(red));
    expect(doc.get(b)?.fills).toEqual(solid(red));
    doc.redo();
    expect(doc.get(b)?.fills).toEqual(solid(blue));
  });

  it("detaches when the field is edited by hand, and on detach keeps values", () => {
    const { doc, a, b } = setup();
    const sid = doc.transact("c", (tx) => createStyleFromNode(tx, doc, a, "fills", "Red"));
    doc.transact("hand edit", (tx) => tx.set(a, "fills", solid(blue)));
    expect(doc.get(a)?.fillStyleId).toBeUndefined();
    expect(doc.get(a)?.fills).toEqual(solid(blue));
    doc.transact("apply", (tx) => tx.set(b, "fillStyleId", sid));
    doc.transact("detach", (tx) => detachStyle(tx, b, "fills"));
    expect(doc.get(b)?.fills).toEqual(solid(red));
  });

  it("reorders, deletes and round-trips through the package", () => {
    const { doc, a } = setup();
    const s1 = doc.transact("c", (tx) => createStyleFromNode(tx, doc, a, "fills", "One"));
    const s2 = doc.transact("c", (tx) => createStyleFromNode(tx, doc, a, "strokes", "Two"));
    doc.transact("m", (tx) => moveStyle(tx, doc, s2, 0));
    expect(doc.styles().map((s) => s.id)).toEqual([s2, s1]);
    const back = Document.fromFile(readPackage(writePackage(doc.toFile())));
    expect(back.styles()).toEqual(doc.styles());
    doc.transact("d", (tx) => deleteStyle(tx, doc, s2));
    expect(doc.get(a)?.strokeStyleId).toBeUndefined();
    expect(doc.get(a)?.fillStyleId).toBe(s1);
  });

  it("writes files without definitions exactly as before", () => {
    const { doc } = setup();
    expect(doc.toFile().manifest).not.toHaveProperty("styles");
    expect(doc.toFile().manifest).not.toHaveProperty("variables");
  });
});

describe("variables", () => {
  it("binds colour and number, follows modes inherited from the frame, undoes exactly", () => {
    const { doc, frame, a } = setup();
    const { col, light, dark, bg, radius } = doc.transact("vars", (tx) => {
      const c = addCollection(tx, doc, "Theme", "Light");
      const dark = addMode(tx, doc, c.id, "Dark");
      const bg = addVariable(tx, doc, c.id, "bg", "COLOR", red);
      updateVariable(tx, doc, bg.id, { values: { [dark]: blue } });
      const radius = addVariable(tx, doc, c.id, "radius", "FLOAT", 4);
      updateVariable(tx, doc, radius.id, { values: { [dark]: 12 } });
      return { col: c, light: c.defaultModeId, dark, bg, radius };
    });
    doc.transact("bind", (tx) => {
      bindVariable(tx, doc, a, "fills.0", bg.id);
      bindVariable(tx, doc, a, "cornerRadius", radius.id);
    });
    expect(doc.get(a)?.cornerRadius).toBe(4);
    const before = doc.toFile();
    doc.transact("Dark", (tx) => setFrameMode(tx, doc, frame, col.id, dark));
    expect(doc.get(a)?.fills).toEqual(solid(blue));
    expect(doc.get(a)?.cornerRadius).toBe(12);
    doc.undo();
    expect(doc.toFile().nodes).toEqual(before.nodes);
    doc.redo();
    doc.transact("Light", (tx) => setFrameMode(tx, doc, a, col.id, light));
    expect(doc.get(a)?.cornerRadius).toBe(4);
  });

  it("follows aliases and refuses alias loops", () => {
    const { doc, a } = setup();
    const { x, y } = doc.transact("vars", (tx) => {
      const c = addCollection(tx, doc, "Prims");
      const x = addVariable(tx, doc, c.id, "x", "FLOAT", 8);
      const y = addVariable(tx, doc, c.id, "y", "FLOAT", { type: "VARIABLE_ALIAS", id: x.id });
      return { c, x, y };
    });
    doc.transact("bind", (tx) => bindVariable(tx, doc, a, "cornerRadius", y.id));
    expect(doc.get(a)?.cornerRadius).toBe(8);
    const m = doc.variables().collections[0]!.defaultModeId;
    expect(() => doc.transact("loop", (tx) => updateVariable(tx, doc, x.id, { values: { [m]: { type: "VARIABLE_ALIAS", id: y.id } } }))).toThrow(/loop/);
    doc.transact("edit", (tx) => updateVariable(tx, doc, x.id, { values: { [m]: 20 } }));
    expect(doc.get(a)?.cornerRadius).toBe(20);
    doc.transact("del", (tx) => deleteVariable(tx, doc, x.id));
    expect(doc.get(a)?.cornerRadius).toBe(20);
    expect(doc.variables().variables[0]?.valuesByMode[m]).toBe(20);
  });

  it("binds text characters and visibility; a hand edit detaches", () => {
    const { doc, frame, a } = setup();
    const t = doc.transact("t", (tx) => tx.create("TEXT", frame, { characters: "x", fontFamily: "Inter", fontStyle: "Regular", fontSize: 12 }));
    const { s, v } = doc.transact("vars", (tx) => {
      const c = addCollection(tx, doc, "Copy");
      return { s: addVariable(tx, doc, c.id, "title", "STRING", "Hello"), v: addVariable(tx, doc, c.id, "show", "BOOLEAN", false) };
    });
    doc.transact("bind", (tx) => {
      bindVariable(tx, doc, t, "characters", s.id);
      bindVariable(tx, doc, a, "visible", v.id);
    });
    expect(doc.get(t)?.characters).toBe("Hello");
    expect(doc.get(a)?.visible).toBe(false);
    doc.transact("type", (tx) => tx.set(t, "characters", "Bye"));
    expect(doc.get(t)?.boundVariables).toBeUndefined();
  });

  it("round-trips variables through a package", () => {
    const { doc } = setup();
    doc.transact("v", (tx) => {
      const c = addCollection(tx, doc, "Theme");
      addVariable(tx, doc, c.id, "bg/app", "COLOR", red);
    });
    const back = Document.fromFile(readPackage(writePackage(doc.toFile())));
    expect(back.variables()).toEqual(doc.variables());
  });

  it("replays meta operations", () => {
    const { doc } = setup();
    const ops: unknown[] = [];
    doc.subscribe((c) => ops.push(...c.ops));
    doc.transact("v", (tx) => addCollection(tx, doc, "Theme"));
    const copy = Document.fromFile(doc.toFile());
    const fresh = setup().doc;
    void copy;
    expect(() => fresh.replay(ops as never)).not.toThrow();
    expect(fresh.variables().collections).toHaveLength(1);
  });
});
