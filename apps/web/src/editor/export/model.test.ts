import { describe, expect, it } from "vitest";
import { Document } from "@illigma/core";
import { exportNode } from "@illigma/export";
import type { ExportSettings } from "@illigma/format";
import {
  exportRequests,
  formatSize,
  layersWithSettings,
  nextSetting,
  parseSize,
  planFiles,
  settingsOf,
  settingsSummary,
  sharedSettings,
  sizeOf,
  updateExportSettings,
  withFormat,
} from "./model";
import { SnapshotSource, snapshotFor } from "./snapshot";

function setup() {
  const doc = new Document("Test");
  const page = doc.transact("Add page", (tx) => tx.addPage("Page 1"));
  const ids = doc.transact("Add", (tx) => {
    const frame = tx.create("FRAME", page, { name: "Desktop", x: 100, y: 50, width: 400, height: 300, fills: [{ type: "SOLID", visible: true, color: { r: 1, g: 1, b: 1, a: 1 } }] });
    const a = tx.create("RECTANGLE", frame, { name: "Icons/Arrow", x: 10, y: 20, width: 100, height: 50, fills: [{ type: "SOLID", visible: true, color: { r: 1, g: 0, b: 0, a: 1 } }] });
    const b = tx.create("ELLIPSE", page, { name: "Dot", x: 600, y: 50, width: 100, height: 100, fills: [{ type: "SOLID", visible: true, color: { r: 0, g: 0, b: 1, a: 1 } }] });
    return { frame, a, b };
  });
  return { doc, page, ...ids };
}

describe("the size field", () => {
  it("reads scales, fixed widths and fixed heights", () => {
    expect(parseSize("2x")).toEqual({ type: "SCALE", value: 2 });
    expect(parseSize("2")).toEqual({ type: "SCALE", value: 2 });
    expect(parseSize(" 0.5X ")).toEqual({ type: "SCALE", value: 0.5 });
    expect(parseSize(".75x")).toEqual({ type: "SCALE", value: 0.75 });
    expect(parseSize("@3x")).toEqual({ type: "SCALE", value: 3 });
    expect(parseSize("512w")).toEqual({ type: "WIDTH", value: 512 });
    expect(parseSize("512 W")).toEqual({ type: "WIDTH", value: 512 });
    expect(parseSize("512h")).toEqual({ type: "HEIGHT", value: 512 });
    expect(parseSize("512px h")).toEqual({ type: "HEIGHT", value: 512 });
    expect(parseSize("100.4w")).toEqual({ type: "WIDTH", value: 100 });
  });

  it("refuses anything else, zero and sizes past the format's caps", () => {
    for (const bad of ["", "x", "abc", "2y", "-2x", "0x", "0", "0w", "0.4w", "1e3x", "2xx", "101x", "100001w", "NaN", "Infinityx"]) {
      expect(parseSize(bad), bad).toBeNull();
    }
    expect(parseSize("100x")).toEqual({ type: "SCALE", value: 100 });
    expect(parseSize("100000h")).toEqual({ type: "HEIGHT", value: 100_000 });
  });

  it("shows constraints as typed", () => {
    expect(formatSize(undefined)).toBe("1x");
    expect(formatSize({ type: "SCALE", value: 1.5 })).toBe("1.5x");
    expect(formatSize({ type: "WIDTH", value: 512 })).toBe("512w");
    expect(formatSize({ type: "HEIGHT", value: 64 })).toBe("64h");
    for (const s of ["0.5x", "2x", "512w", "512h"]) expect(formatSize(parseSize(s) ?? undefined)).toBe(s);
  });
});

describe("adding and changing settings", () => {
  it("+ adds 1x PNG, then 2x @2x, 3x @3x, up to 4x, as in Figma", () => {
    const one = nextSetting([]);
    expect(one).toEqual({ format: "PNG", suffix: "", constraint: { type: "SCALE", value: 1 } });
    const two = nextSetting([one]);
    expect(two).toEqual({ format: "PNG", suffix: "@2x", constraint: { type: "SCALE", value: 2 } });
    const three = nextSetting([one, two]);
    expect(three).toEqual({ format: "PNG", suffix: "@3x", constraint: { type: "SCALE", value: 3 } });
    expect(sizeOf(nextSetting([one, two, three, nextSetting([one, two, three])]))).toEqual({ type: "SCALE", value: 4 });
    expect(nextSetting([{ format: "SVG" }])).toEqual({ format: "SVG", suffix: "" });
  });

  it("changing the format keeps what applies", () => {
    const png: ExportSettings = { format: "PNG", suffix: "@2x", constraint: { type: "SCALE", value: 2 }, contentsOnly: false };
    const svg = withFormat(png, "SVG");
    expect(svg).toEqual({ format: "SVG", suffix: "@2x", contentsOnly: false });
    expect(withFormat({ ...svg, svgIdAttribute: true } as ExportSettings, "JPG")).toEqual({ format: "JPG", suffix: "@2x", contentsOnly: false, constraint: { type: "SCALE", value: 1 } });
    expect(withFormat(png, "JPG")).toEqual({ format: "JPG", suffix: "@2x", contentsOnly: false, constraint: { type: "SCALE", value: 2 } });
  });

  it("summarises a layer's settings as the dialog lists them", () => {
    expect(settingsSummary([{ format: "PNG" }, { format: "PNG", constraint: { type: "SCALE", value: 2 } }, { format: "SVG" }])).toBe("PNG 1x, 2x · SVG");
    expect(settingsSummary([{ format: "JPG", constraint: { type: "WIDTH", value: 512 } }, { format: "PDF" }])).toBe("JPG 512w · PDF");
  });
});

describe("export settings in the document", () => {
  it("each change is one undo step; an empty list removes the field", () => {
    const { doc, a, b } = setup();
    updateExportSettings(doc, [a, b], (cur) => [...cur, nextSetting(cur)], "Add export setting");
    expect(settingsOf(doc.get(a))).toHaveLength(1);
    expect(settingsOf(doc.get(b))).toHaveLength(1);
    expect(sharedSettings([doc.get(a), doc.get(b)].filter((n) => !!n))).toHaveLength(1);
    updateExportSettings(doc, [a], (cur) => [...cur, nextSetting(cur)], "Add export setting");
    expect(sharedSettings([doc.get(a), doc.get(b)].filter((n) => !!n))).toBeNull();
    doc.undo();
    expect(settingsOf(doc.get(a))).toHaveLength(1);
    doc.undo();
    expect(doc.get(a)?.exportSettings).toBeUndefined();
    expect(doc.get(b)?.exportSettings).toBeUndefined();
    doc.redo();
    updateExportSettings(doc, [a, b], () => [], "Remove export setting");
    expect("exportSettings" in (doc.get(a) ?? {})).toBe(false);
    expect(doc.toFile().nodes.find((n) => n.id === a)).not.toHaveProperty("exportSettings");
  });

  it("the document refuses settings the format doesn't allow, and nothing changes", () => {
    const { doc, a } = setup();
    updateExportSettings(doc, [a], () => [{ format: "PNG" }], "Add");
    expect(() => updateExportSettings(doc, [a], () => [{ format: "PNG", suffix: "x".repeat(201) }], "Suffix")).toThrow(/suffix/i);
    expect(() => updateExportSettings(doc, [a], () => [{ format: "PNG", constraint: { type: "SCALE", value: 500 } }], "Size")).toThrow(/at most 100/);
    expect(() => updateExportSettings(doc, [a], () => [{ format: "GIF" } as unknown as ExportSettings], "Format")).toThrow(/unknown format/);
    expect(settingsOf(doc.get(a))).toEqual([{ format: "PNG" }]);
  });

  it("lists layers with settings in layer-panel order, pages included, and the files they write", () => {
    const { doc, page, frame, a, b } = setup();
    updateExportSettings(doc, [frame, a, b, page], (cur) => [...cur, nextSetting(cur)], "Add");
    updateExportSettings(doc, [a], (cur) => [...cur, nextSetting(cur), { format: "SVG", suffix: "" }], "Add");
    const pageNode = doc.get(page);
    const layers = layersWithSettings(doc, pageNode ? [pageNode] : []).map((l) => l.node.name);
    expect(layers).toEqual(["Page 1", "Dot", "Desktop", "Icons/Arrow"]);
    const files = planFiles(doc, exportRequests(doc, [a, b]));
    expect(files.map((f) => [f.filename, f.size])).toEqual([
      ["Icons/Arrow.png", "100 × 50 px"],
      ["Icons/Arrow@2x.png", "200 × 100 px"],
      ["Icons/Arrow.svg", "100 × 50"],
      ["Dot.png", "100 × 100 px"],
    ]);
    // Names already in the folder get a number; a size past the limits is found before exporting.
    updateExportSettings(doc, [b], () => [{ format: "PNG", constraint: { type: "WIDTH", value: 50_000 } }], "Big");
    const planned = planFiles(doc, exportRequests(doc, [b]), ["dot.png"]);
    expect(planned[0]?.filename).toBe("Dot-1.png");
    expect(planned[0]?.problem).toMatch(/too big/);
  });

  it("a snapshot exports exactly what the document does", async () => {
    const { doc, a, b } = setup();
    const svg: ExportSettings = { format: "SVG", svgIdAttribute: true };
    const snap = snapshotFor(doc, [
      { nodeId: a, settings: svg },
      { nodeId: b, settings: svg },
    ]);
    // Arrow's subtree and its ancestors; Dot and its page. Not the whole file.
    expect(snap.nodes.map((n) => n.name).sort()).toEqual(["Desktop", "Dot", "Icons/Arrow", "Page 1"]);
    const source = new SnapshotSource(snap);
    for (const id of [a, b]) {
      const direct = new TextDecoder().decode((await exportNode(doc, id, svg)).bytes);
      const viaSnapshot = new TextDecoder().decode((await exportNode(source, id, svg)).bytes);
      expect(viaSnapshot).toBe(direct);
    }
    // Drawing what overlaps (contentsOnly false) needs the whole page.
    expect(snapshotFor(doc, [{ nodeId: a, settings: { format: "SVG", contentsOnly: false } }]).nodes).toHaveLength(4);
  });
});
