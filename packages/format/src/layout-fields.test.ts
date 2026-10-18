/**
 * The optional auto layout and constraints fields: they round-trip, bad
 * values are refused, and files without them save byte for byte as before.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readPackage, writePackage } from "./package.js";
import { defaultNode, type Node } from "./schema.js";
import { sampleFile } from "./sample.fixture.js";
import { NODE_KEYS, validateFile, validateNode, validateNodeField } from "./validate.js";

const LAYOUT: Partial<Node> = {
  layoutMode: "VERTICAL",
  itemSpacing: -4,
  counterAxisSpacing: 12,
  paddingLeft: 16,
  paddingRight: 16,
  paddingTop: 8,
  paddingBottom: 24,
  primaryAxisAlignItems: "SPACE_BETWEEN",
  counterAxisAlignItems: "CENTER",
  counterAxisAlignContent: "SPACE_BETWEEN",
  primaryAxisSizingMode: "FIXED",
  counterAxisSizingMode: "AUTO",
  layoutWrap: "WRAP",
  minWidth: 0,
  maxWidth: 640,
  minHeight: 10,
  maxHeight: 900.5,
};

const CHILD: Partial<Node> = {
  layoutPositioning: "ABSOLUTE",
  layoutSizingHorizontal: "FILL",
  layoutSizingVertical: "HUG",
  constraints: { horizontal: "STRETCH", vertical: "SCALE" },
};

function layoutFile() {
  const file = sampleFile();
  const nodes = file.nodes as Node[];
  Object.assign(nodes[2] as Node, LAYOUT); // frame1
  Object.assign(nodes[3] as Node, CHILD); // text1
  return file;
}

describe("auto layout and constraints fields", () => {
  it("round-trip with nothing lost", () => {
    const file = layoutFile();
    expect(validateFile(file)).toEqual([]);
    const back = readPackage(writePackage(file));
    expect(back.nodes.find((n) => n.id === "frame1")).toMatchObject(LAYOUT);
    expect(back.nodes.find((n) => n.id === "text1")).toMatchObject(CHILD);
    expect([...writePackage(back).entries()]).toEqual([...writePackage(file).entries()]);
  });

  it("are optional: a file without them saves exactly as before", () => {
    // Pinned bytes: adding optional fields must never change files that don't use them.
    expect(writePackage(sampleFile()).get("pages/page1.json")).toBe(
      "[\n" +
        '{"cornerRadius":0,"fills":[{"color":{"a":1,"b":1,"g":1,"r":1},"type":"SOLID","visible":true}],"height":852,"id":"frame1","index":"a0","locked":false,"name":"Sign up","opacity":1,"parentId":"page1","rotation":0,"strokeWeight":1,"strokes":[],"type":"FRAME","visible":true,"width":393,"x":0,"y":0},\n' +
        '{"cornerRadius":0,"fills":[],"height":0,"id":"page1","index":"a0","locked":false,"name":"Onboarding","opacity":1,"parentId":null,"rotation":0,"strokeWeight":1,"strokes":[],"type":"PAGE","visible":true,"width":0,"x":0,"y":0},\n' +
        '{"characters":"Create account — ১২৩ 日本語","cornerRadius":0,"fills":[],"fontFamily":"Inter","fontSize":28,"height":100,"id":"text1","index":"a0","locked":false,"name":"Text","opacity":1,"parentId":"frame1","rotation":0,"strokeWeight":1,"strokes":[],"type":"TEXT","visible":true,"width":100,"x":0,"y":0}\n' +
        "]\n",
    );
    for (const key of Object.keys({ ...LAYOUT, ...CHILD })) expect(defaultNode("FRAME", "f", "p", "a0")).not.toHaveProperty(key);
  });

  it("refuse values outside their lists, negative sizes and malformed constraints", () => {
    const bad: [string, unknown][] = [
      ["layoutMode", "GRID"],
      ["layoutMode", "horizontal"],
      ["layoutMode", null],
      ["itemSpacing", NaN],
      ["itemSpacing", "8"],
      ["counterAxisSpacing", -1],
      ["paddingLeft", -1],
      ["paddingTop", Infinity],
      ["primaryAxisAlignItems", "BASELINE"],
      ["counterAxisAlignItems", "SPACE_BETWEEN"],
      ["counterAxisAlignContent", "CENTER"],
      ["primaryAxisSizingMode", "HUG"],
      ["counterAxisSizingMode", true],
      ["layoutWrap", "WRAP_REVERSE"],
      ["layoutPositioning", "FIXED"],
      ["layoutSizingHorizontal", "AUTO"],
      ["layoutSizingVertical", 1],
      ["minWidth", -0.5],
      ["maxHeight", "100"],
      ["constraints", "MIN"],
      ["constraints", []],
      ["constraints", { horizontal: "bogus", vertical: "MIN" }],
      ["constraints", { horizontal: "MIN" }],
      ["constraints", { horizontal: "MIN", vertical: "MAX", extra: 1 }],
      ["constraints", { horizontal: "LEFT", vertical: "TOP" }],
      ["constraints", JSON.parse('{"horizontal":"MIN","vertical":"MIN","__proto__":{}}')],
    ];
    for (const [key, value] of bad) {
      expect(validateNodeField(key, value), `${key} = ${JSON.stringify(value)}`).toMatch(new RegExp(`^"${key}"`));
      const node = { ...defaultNode("FRAME", "f", "p", "a0"), [key]: value };
      expect(validateNode(node).length, key).toBe(1);
    }
    expect(validateNodeField("constraints", { horizontal: "bogus", vertical: "MIN" })).toMatch(/one of "MIN", "CENTER"/);
  });

  it("accept every listed value, and undefined to clear a field", () => {
    for (const [key, value] of Object.entries({ ...LAYOUT, ...CHILD })) expect(validateNodeField(key, value), key).toBeNull();
    for (const key of Object.keys({ ...LAYOUT, ...CHILD })) expect(validateNodeField(key, undefined), key).toBeNull();
    for (const mode of ["NONE", "HORIZONTAL", "VERTICAL"]) expect(validateNodeField("layoutMode", mode)).toBeNull();
    for (const c of ["MIN", "CENTER", "MAX", "STRETCH", "SCALE"]) expect(validateNodeField("constraints", { horizontal: c, vertical: c })).toBeNull();
  });

  it("damaged values in a saved file are refused on open", () => {
    const tree = writePackage(layoutFile());
    tree.set("pages/page1.json", (tree.get("pages/page1.json") as string).replace('"layoutMode":"VERTICAL"', '"layoutMode":"DIAGONAL"'));
    expect(() => readPackage(tree)).toThrow(/layoutMode/);
  });

  it("are all described in the JSON Schema, and the schema has no fields the code doesn't know", () => {
    const schema = JSON.parse(readFileSync(new URL("../schema/node.v0.schema.json", import.meta.url), "utf8"));
    expect(Object.keys(schema.properties).sort()).toEqual([...NODE_KEYS].sort());
    expect(schema.properties.constraints.additionalProperties).toBe(false);
  });
});
