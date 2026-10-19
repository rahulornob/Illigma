/**
 * QC round 8: font size and line height are bounded, so every valid file's
 * text can be laid out (a font size of 1e300 made layout NaN, so every edit
 * that reached the text failed). Files written before the bounds are clamped
 * as they are read (format 0), not refused.
 */

import { describe, expect, it } from "vitest";
import { clampTextMetrics } from "./migrations.js";
import { readPackageWithReport, writePackage } from "./package.js";
import { MAX_TEXT_METRIC } from "./schema.js";
import { sampleFile } from "./sample.fixture.js";
import { validateNodeField } from "./validate.js";

describe("text metrics are bounded", () => {
  it("fontSize: above 0 and at most MAX_TEXT_METRIC; a numeric lineHeight: 0 to MAX_TEXT_METRIC", () => {
    expect(validateNodeField("fontSize", 0.5)).toBeNull();
    expect(validateNodeField("fontSize", MAX_TEXT_METRIC)).toBeNull();
    for (const bad of [0, -3, 1e300, MAX_TEXT_METRIC + 1, Number.NaN, Number.POSITIVE_INFINITY]) expect(validateNodeField("fontSize", bad)).not.toBeNull();
    expect(validateNodeField("lineHeight", 0)).toBeNull();
    expect(validateNodeField("lineHeight", 24)).toBeNull();
    for (const bad of [-1, 1e300, MAX_TEXT_METRIC + 1]) expect(validateNodeField("lineHeight", bad)).not.toBeNull();
  });

  it("a file written before the bounds opens with its values clamped, and says so", () => {
    const file = sampleFile();
    const text = file.nodes.find((n) => n.type === "TEXT");
    if (!text) throw new Error("the sample has a text layer");
    const tree = writePackage(file);
    // Out-of-range values written by an older Illigma (or by hand): edit the page JSON directly.
    for (const [path, data] of tree) {
      if (!path.startsWith("pages/") || typeof data !== "string") continue;
      const nodes = JSON.parse(data) as Record<string, unknown>[];
      const n = nodes.find((x) => x.id === text.id);
      if (!n) continue;
      n.fontSize = 1e300;
      n.lineHeight = -4;
      tree.set(path, JSON.stringify(nodes));
    }
    const { file: back, warnings } = readPackageWithReport(tree);
    const again = back.nodes.find((n) => n.id === text.id);
    expect(again?.fontSize).toBe(MAX_TEXT_METRIC);
    expect(again?.lineHeight).toBe(0);
    expect(warnings.some((w) => /font size or line height out of range/.test(w))).toBe(true);
  });

  it("clampTextMetrics: huge sizes to the most, 0 or less to 1; leaves good values and other fields", () => {
    const nodes: unknown[] = [
      { id: "a", fontSize: 0, lineHeight: 1e9 },
      { id: "b", fontSize: Number.POSITIVE_INFINITY },
      { id: "c", fontSize: 12, lineHeight: 18 },
      { id: "d", fontSize: "x" },
      null,
    ];
    expect(clampTextMetrics(nodes)).toBe(2);
    expect(nodes[0]).toEqual({ id: "a", fontSize: 1, lineHeight: MAX_TEXT_METRIC });
    expect(nodes[1]).toEqual({ id: "b", fontSize: MAX_TEXT_METRIC });
    expect(nodes[2]).toEqual({ id: "c", fontSize: 12, lineHeight: 18 });
    expect(nodes[3]).toEqual({ id: "d", fontSize: "x" });
  });
});
