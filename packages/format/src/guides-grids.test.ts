import { describe, expect, it } from "vitest";
import { guidesProblem, layoutGridBands, layoutGridsProblem, validateNodeField } from "./index.js";

describe("masks, layout grids and guides: format fields", () => {
  it("validates isMask and maskType", () => {
    expect(validateNodeField("isMask", true)).toBeNull();
    expect(validateNodeField("isMask", "yes")).toMatch(/isMask/);
    expect(validateNodeField("maskType", "VECTOR")).toBeNull();
    expect(validateNodeField("maskType", "SHAPE")).toMatch(/maskType/);
  });

  it("validates layout grids", () => {
    expect(layoutGridsProblem([{ pattern: "GRID", sectionSize: 8 }])).toBeNull();
    expect(layoutGridsProblem([{ pattern: "COLUMNS", alignment: "STRETCH", count: 12, gutterSize: 16, offset: 24, visible: false, color: { r: 1, g: 0, b: 0, a: 0.1 } }])).toBeNull();
    expect(layoutGridsProblem([{ pattern: "GRID", sectionSize: 0 }])).toMatch(/sectionSize/);
    expect(layoutGridsProblem([{ pattern: "ROWS", alignment: "LEFT", count: 2, gutterSize: 0 }])).toMatch(/alignment/);
    expect(layoutGridsProblem([{ pattern: "ROWS", alignment: "MIN", count: 1.5, gutterSize: 0 }])).toMatch(/count/);
    expect(layoutGridsProblem([{ pattern: "DOTS" }])).toMatch(/pattern/);
    expect(layoutGridsProblem("x")).toMatch(/list/);
    expect(validateNodeField("layoutGrids", [{ pattern: "GRID", sectionSize: 10, color: { r: 2, g: 0, b: 0, a: 1 } }])).toMatch(/color/);
  });

  it("validates guides", () => {
    expect(guidesProblem([{ axis: "X", offset: 10 }, { axis: "Y", offset: -4.5 }])).toBeNull();
    expect(guidesProblem([{ axis: "Z", offset: 1 }])).toMatch(/guide 0/);
    expect(guidesProblem([{ axis: "X", offset: Infinity }])).toMatch(/guide 0/);
  });

  it("lays out stretch columns with margins and gutters, as Figma does", () => {
    const b = layoutGridBands({ pattern: "COLUMNS", alignment: "STRETCH", count: 4, gutterSize: 20, offset: 10 }, 440, 300);
    // (440 - 2×10 - 3×20) / 4 = 90
    expect(b.map((x) => [x.start, x.size])).toEqual([
      [10, 90],
      [120, 90],
      [230, 90],
      [340, 90],
    ]);
  });

  it("places fixed-width columns at the start, centre or end and rows on y", () => {
    const g = { pattern: "COLUMNS" as const, count: 2, gutterSize: 10, sectionSize: 50, offset: 5 };
    expect(layoutGridBands({ ...g, alignment: "MIN" }, 300, 100).map((x) => x.start)).toEqual([5, 65]);
    expect(layoutGridBands({ ...g, alignment: "MAX" }, 300, 100).map((x) => x.start)).toEqual([185, 245]);
    expect(layoutGridBands({ ...g, alignment: "CENTER" }, 300, 100).map((x) => x.start)).toEqual([95, 155]);
    const rows = layoutGridBands({ pattern: "ROWS", alignment: "STRETCH", count: 2, gutterSize: 0 }, 50, 100);
    expect(rows).toEqual([
      { axis: "Y", start: 0, size: 50 },
      { axis: "Y", start: 50, size: 50 },
    ]);
  });

  it("draws a square grid as lines inside the frame", () => {
    const b = layoutGridBands({ pattern: "GRID", sectionSize: 10 }, 30, 20);
    expect(b).toEqual([
      { axis: "X", start: 10, size: 0 },
      { axis: "X", start: 20, size: 0 },
      { axis: "Y", start: 10, size: 0 },
    ]);
  });
});
