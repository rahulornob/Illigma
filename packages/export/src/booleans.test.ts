// Booleans and arrow caps in SVG export: the computed path is written, never the operands.
import { describe, expect, it } from "vitest";
import { usePathOps } from "@illigma/renderer";
import { exportNode } from "./index.js";
import { assertWellFormedXml, build, canvasKit, RED, solid, withoutIdPrefix } from "./test.fixture.js";

describe("SVG export: booleans and arrows", () => {
  it("writes a boolean as its combined path", async () => {
    usePathOps(await canvasKit());
    const { doc, ids } = build((add, p) => {
      const bool = add("BOOLEAN_OPERATION", p, { name: "Cut", width: 150, height: 100, booleanOperation: "SUBTRACT", fills: solid(RED) });
      add("RECTANGLE", bool, { name: "A", width: 100, height: 100, fills: solid(RED) });
      add("RECTANGLE", bool, { name: "B", x: 50, width: 100, height: 100, fills: solid(RED) });
      return { bool };
    });
    const file = await exportNode(doc, ids.bool, { format: "SVG" });
    const text = withoutIdPrefix(new TextDecoder().decode(file.bytes));
    assertWellFormedXml(text);
    expect(text.match(/<path /g)).toHaveLength(1);
    expect(text).not.toContain("<rect");
    // The subtracted half is gone: the path stays within x ≤ 50.
    const d = /d="([^"]+)"/.exec(text)?.[1] ?? "";
    const xs = [...d.matchAll(/[ML](-?[\d.]+) /g)].map((m) => Number(m[1]));
    expect(Math.max(...xs)).toBeLessThanOrEqual(50.001);
  });

  it("writes arrow heads filled with the stroke paint", async () => {
    const { doc, ids } = build((add, p) => ({
      arrow: add("VECTOR", p, {
        name: "Arrow",
        width: 100,
        height: 0,
        strokes: solid(RED),
        strokeWeight: 2,
        vectorNetwork: { vertices: [{ x: 0, y: 0 }, { x: 100, y: 0, strokeCap: "ARROW_EQUILATERAL" }], segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }], regions: [] },
      }),
    }));
    const file = await exportNode(doc, ids.arrow, { format: "SVG" });
    const text = new TextDecoder().decode(file.bytes);
    assertWellFormedXml(text);
    expect(text).toMatch(/<path [^>]*Z" fill="#FF0000"/);
  });
});
