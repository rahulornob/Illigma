/**
 * The optional text fields (textAutoResize, textAlignHorizontal,
 * textAlignVertical, letterSpacing, lineHeight units): they round-trip, bad
 * values are refused, and the helpers read them as the renderer does.
 */

import { describe, expect, it } from "vitest";
import { readPackage, writePackage } from "./package.js";
import { letterSpacingPx, lineHeightPx, type Node } from "./schema.js";
import { sampleFile } from "./sample.fixture.js";
import { validateNodeField } from "./validate.js";

const TEXT: Partial<Node> = {
  textAutoResize: "HEIGHT",
  textAlignHorizontal: "JUSTIFIED",
  textAlignVertical: "BOTTOM",
  letterSpacing: { value: -2.5, unit: "PERCENT" },
  lineHeight: { value: 140, unit: "PERCENT" },
};

describe("text fields", () => {
  it("round-trip through a package", () => {
    const file = sampleFile();
    const text = file.nodes.find((n) => n.type === "TEXT");
    if (!text) throw new Error("the sample has a text layer");
    Object.assign(text, TEXT);
    const back = readPackage(writePackage(file));
    const again = back.nodes.find((n) => n.id === text.id);
    expect(again).toMatchObject(TEXT);
  });

  it("accept Figma's values", () => {
    for (const v of ["NONE", "WIDTH_AND_HEIGHT", "HEIGHT", "TRUNCATE"]) expect(validateNodeField("textAutoResize", v)).toBeNull();
    for (const v of ["LEFT", "CENTER", "RIGHT", "JUSTIFIED"]) expect(validateNodeField("textAlignHorizontal", v)).toBeNull();
    for (const v of ["TOP", "CENTER", "BOTTOM"]) expect(validateNodeField("textAlignVertical", v)).toBeNull();
    expect(validateNodeField("letterSpacing", { value: 1.5, unit: "PIXELS" })).toBeNull();
    expect(validateNodeField("lineHeight", 24)).toBeNull(); // format 0: pixels
    expect(validateNodeField("lineHeight", { unit: "AUTO" })).toBeNull();
    expect(validateNodeField("lineHeight", { value: 24, unit: "PIXELS" })).toBeNull();
  });

  it("refuse bad values", () => {
    expect(validateNodeField("textAutoResize", "AUTO")).toMatch(/must be one of/);
    expect(validateNodeField("textAlignHorizontal", "JUSTIFY")).toMatch(/must be one of/);
    expect(validateNodeField("textAlignVertical", "MIDDLE")).toMatch(/must be one of/);
    expect(validateNodeField("letterSpacing", { value: 1, unit: "EM" })).toMatch(/letterSpacing/);
    expect(validateNodeField("letterSpacing", { value: 1 })).toMatch(/letterSpacing/);
    expect(validateNodeField("letterSpacing", { value: 1, unit: "PIXELS", extra: 1 })).toMatch(/letterSpacing/);
    expect(validateNodeField("letterSpacing", { value: 1e9, unit: "PIXELS" })).toMatch(/letterSpacing/);
    expect(validateNodeField("lineHeight", { value: -1, unit: "PIXELS" })).toMatch(/lineHeight/);
    expect(validateNodeField("lineHeight", { unit: "AUTO", value: 3 })).toMatch(/lineHeight/);
    expect(validateNodeField("lineHeight", Number.NaN)).toMatch(/lineHeight/);
  });

  it("read in pixels as the renderer draws them", () => {
    expect(lineHeightPx({ fontSize: 20 })).toBeNull();
    expect(lineHeightPx({ fontSize: 20, lineHeight: 30 })).toBe(30);
    expect(lineHeightPx({ fontSize: 20, lineHeight: 0 })).toBeNull();
    expect(lineHeightPx({ fontSize: 20, lineHeight: { unit: "AUTO" } })).toBeNull();
    expect(lineHeightPx({ fontSize: 20, lineHeight: { value: 150, unit: "PERCENT" } })).toBe(30);
    expect(lineHeightPx({ lineHeight: { value: 100, unit: "PERCENT" } })).toBe(12);
    expect(letterSpacingPx({ fontSize: 20 })).toBe(0);
    expect(letterSpacingPx({ fontSize: 20, letterSpacing: { value: 10, unit: "PERCENT" } })).toBe(2);
    expect(letterSpacingPx({ fontSize: 20, letterSpacing: { value: -1, unit: "PIXELS" } })).toBe(-1);
  });
});
