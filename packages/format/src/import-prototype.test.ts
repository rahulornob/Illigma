/** Tests for importing the old prototype's documents (milestone 0.8). */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { importPrototypeJson, parsePrototypeColor, PROTOTYPE_IMPORT_LIMITS, type PrototypeImportOptions } from "./import-prototype.js";
import { FormatError, readPackage, writePackage } from "./package.js";
import { NODE_ID_PATTERN, type IlligmaFile, type Node } from "./schema.js";
import { compareOrder, validateFile } from "./validate.js";
import { svgPathFromVectorNetwork } from "./vector.js";
import { readZip, writeZip } from "./zip.js";

/** The prototype's own `sampleDocument()` output, with stable ids: as returned, and as saved after `preparePages`. */
const fixture = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(`../test-fixtures/${name}.json`, import.meta.url), "utf8")) as Record<string, unknown>;
const SAMPLE = fixture("sample-document");
const SAVED = fixture("sample-saved");

function stable(): PrototypeImportOptions {
  let n = 0;
  return { newId: () => `n${++n}`, now: new Date("2026-10-18T00:00:00.000Z"), app: "Illigma test" };
}

/** Children of `parentId`, in sibling order. */
function kids(file: IlligmaFile, parentId: string): Node[] {
  return file.nodes.filter((n) => n.parentId === parentId).sort(compareOrder);
}
const byName = (file: IlligmaFile, name: string): Node => {
  const n = file.nodes.find((x) => x.name === name);
  if (!n) throw new Error(`no node named ${name}`);
  return n;
};
const hex = (c: { r: number; g: number; b: number }) =>
  "#" + [c.r, c.g, c.b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
/** Where the centre of a node's box ends up, given Illigma's rotation about the top-left corner. */
function centre(n: Node): { x: number; y: number } {
  const a = (n.rotation * Math.PI) / 180;
  return {
    x: n.x + (n.width / 2) * Math.cos(a) - (n.height / 2) * Math.sin(a),
    y: n.y + (n.width / 2) * Math.sin(a) + (n.height / 2) * Math.cos(a),
  };
}

describe("importPrototypeJson: the prototype's sample document", () => {
  for (const [label, doc] of [["as returned by sampleDocument()", SAMPLE], ["as saved (after preparePages)", SAVED]] as const) {
    it(`imports ${label} into a valid file`, () => {
      const { file } = importPrototypeJson(doc, stable());
      expect(validateFile(file)).toEqual([]);
      expect(file.manifest.name).toBe("Objects in motion");
      expect(file.manifest.pages).toHaveLength(1);
      const page = file.nodes.find((n) => n.type === "PAGE") as Node;
      expect(page.name).toBe(label.startsWith("as returned") ? "Objects in motion" : "Page 1");
      const counts: Record<string, number> = {};
      for (const n of file.nodes) counts[n.type] = (counts[n.type] ?? 0) + 1;
      expect(counts).toEqual({ PAGE: 1, FRAME: 1, ELLIPSE: 2, RECTANGLE: 2, VECTOR: 2, TEXT: 7 });
    });
  }

  it("gives the same layers whether the document was saved or not", () => {
    const shape = (doc: unknown) =>
      importPrototypeJson(doc, stable()).file.nodes.filter((n) => n.type !== "PAGE").map(({ id: _id, ...rest }) => rest);
    expect(shape(SAVED)).toEqual(shape(SAMPLE));
  });

  it("keeps the prototype's z-order: the frame first, then layers bottom to top", () => {
    const { file } = importPrototypeJson(SAVED, stable());
    const page = file.nodes.find((n) => n.type === "PAGE") as Node;
    const top = kids(file, page.id);
    // The prototype drew every frame below every layer; Edition and Page number sit outside the frame.
    expect(top.map((n) => n.name)).toEqual(["Frame 1", "Edition", "Page number"]);
    const frame = top[0] as Node;
    const objects = (SAVED.objects as { name: string; frameId: string | null }[]).filter((o) => o.frameId !== null).map((o) => o.name);
    expect(kids(file, frame.id).map((n) => n.name)).toEqual(objects);
  });

  it("maps the artboard to a frame with its fill and size", () => {
    const { file } = importPrototypeJson(SAMPLE, stable());
    const frame = file.nodes.find((n) => n.type === "FRAME") as Node;
    expect(frame).toMatchObject({ name: "Frame 1", x: 0, y: 0, width: 1000, height: 720 });
    expect(frame.fills).toHaveLength(1);
    expect(hex(frame.fills[0]!.color)).toBe("#f2f0e7");
  });

  it("maps colours, strokes, locks and corner-free shapes", () => {
    const { file } = importPrototypeJson(SAMPLE, stable());
    const guide = byName(file, "Orbital guide");
    expect(guide).toMatchObject({ type: "ELLIPSE", fills: [], strokeWeight: 1, locked: true, visible: true, x: 490, y: 143, width: 425, height: 425 });
    expect(guide.strokes.map((p) => hex(p.color))).toEqual(["#c6c7bc"]);
    const rule = byName(file, "Top rule");
    expect(rule).toMatchObject({ type: "RECTANGLE", strokes: [], width: 880, height: 1, locked: true, cornerRadius: 0 });
    expect(hex(rule.fills[0]!.color)).toBe("#bcbeb2");
    expect(rule.fills[0]).toMatchObject({ type: "SOLID", visible: true, color: { a: 1 } });
    // makeObject's default stroke has width 0, so it draws nothing and is not kept.
    expect(byName(file, "Accent dot").strokes).toEqual([]);
  });

  it("maps text fields: characters, family, weight to style, size and line height in pixels", () => {
    const { file } = importPrototypeJson(SAMPLE, stable());
    expect(byName(file, "Title")).toMatchObject({
      type: "TEXT", characters: "Objects\nin motion.", fontFamily: "Inter", fontStyle: "Semi Bold", fontSize: 86, lineHeight: 99.76, width: 400,
    });
    expect(byName(file, "Description")).toMatchObject({ fontStyle: "Medium", fontSize: 16, lineHeight: 24.8 });
    expect(hex(byName(file, "Description").fills[0]!.color)).toBe("#6e7167");
  });

  it("keeps each rotated shape's centre where the prototype drew it", () => {
    const { file } = importPrototypeJson(SAMPLE, stable());
    for (const o of SAMPLE.objects as { name: string; x: number; y: number; w: number; h: number; rotation: number }[]) {
      const n = byName(file, o.name);
      expect(n.rotation).toBe(o.rotation);
      const c = centre(n);
      // Every sample object sits in the frame at 0,0 or on the page, so frame-relative = absolute.
      expect(c.x).toBeCloseTo(o.x + o.w / 2, 4);
      expect(c.y).toBeCloseTo(o.y + o.h / 2, 4);
    }
    expect(byName(file, "Blue orbit")).toMatchObject({ type: "VECTOR", rotation: 24, width: 268, height: 340 });
  });

  it("lists what format v0 can't hold, one warning per kind", () => {
    expect(importPrototypeJson(SAMPLE, stable()).warnings).toEqual([
      "Left out letter spacing on 4 text layers: format v0 has no letter spacing yet.",
      "Left out the document's 16 colour swatches: format v0 has no colour styles yet.",
      "Left out the canvas background colour (#090909): format v0 has no page background colour yet.",
    ]);
  });

  it("reads path outlines into vector networks, even-odd, in the layer's own space", () => {
    const { file } = importPrototypeJson(SAMPLE, stable());
    const orbit = byName(file, "Orange orbit");
    const net = orbit.vectorNetwork!;
    expect(net.regions).toEqual([{ windingRule: "EVENODD", loops: [[0, 1, 2, 3, 4], [5, 6, 7, 8, 9]] }]);
    expect(net.vertices[0]).toEqual({ x: 214.5, y: 0 });
    // Every point stays within the layer's 429 × 235 box (the outer ellipse touches all four sides).
    const xs = net.vertices.map((v) => v.x), ys = net.vertices.map((v) => v.y);
    expect(Math.min(...xs)).toBeCloseTo(0, 2);
    expect(Math.max(...xs)).toBeCloseTo(429, 2);
    expect(Math.max(...ys)).toBeCloseTo(235, 2);
    // No stroke (width 0), so no caps or joins are set.
    expect(orbit).not.toHaveProperty("strokeCap");
    expect(byName(file, "Blue orbit").vectorNetwork?.regions[0]?.loops).toHaveLength(2);
  });

  it("scales outlines and strokes from the path's base size to the layer's size", () => {
    const doc = {
      title: "Paths",
      artboard: { width: 500, height: 500, fill: "#ffffff" },
      objects: [
        { id: "a", type: "path", x: 0, y: 0, w: 200, h: 100, baseW: 100, baseH: 50, d: "M0 0 L100 0 C100 25 50 50 0 50 Z", fill: "#ff0000", stroke: "#000000", strokeWidth: 2 },
        { id: "b", type: "path", x: 0, y: 0, w: 100, h: 50, baseW: 100, baseH: 100, d: "M0 0 L100 100", fill: "none", stroke: "#000000", strokeWidth: 4 },
        { id: "c", type: "path", x: 0, y: 0, w: 10, h: 10, d: "M0 0 L10 10", fill: "#000000" },
      ],
    };
    const { file, warnings } = importPrototypeJson(doc, stable());
    expect(validateFile(file)).toEqual([]);
    const a = byName(file, "Path");
    expect(svgPathFromVectorNetwork(a.vectorNetwork!)).toBe("M0 0 L200 0 C200 50 100 100 0 100 Z");
    expect(a).toMatchObject({ strokeWeight: 4, strokeCap: "ROUND", strokeJoin: "ROUND" });
    const [, b, c] = file.nodes.filter((n) => n.type === "VECTOR");
    expect(svgPathFromVectorNetwork(b!.vectorNetwork!)).toBe("M0 0 L100 50");
    expect(b!.strokeWeight).toBeCloseTo(4 * Math.SQRT1_2, 6);
    // No base size: drawn at its own size.
    expect(svgPathFromVectorNetwork(c!.vectorNetwork!)).toBe("M0 0 L10 10");
    expect(warnings).toEqual(["1 path shape's stroke was stretched unevenly; the stroke weight is now the same all round."]);
  });

  it("keeps paths whose outline can't be read as empty vectors, and says so", () => {
    const doc = {
      artboard: { width: 500, height: 500, fill: "#ffffff" },
      objects: [
        { id: "a", type: "path", x: 0, y: 0, w: 10, h: 10, d: "M0 0 L", fill: "#ff0000" },
        { id: "b", type: "path", x: 0, y: 0, w: 10, h: 10, d: 42, fill: "#ff0000" },
        { id: "c", type: "path", x: 0, y: 0, w: 10, h: 10, fill: "#ff0000" },
        { id: "d", type: "path", x: 0, y: 0, w: 10, h: 10, d: "M0 0 L1 1", baseW: "wide", fill: "#ff0000" },
      ],
    };
    const { file, warnings } = importPrototypeJson(doc, stable());
    expect(validateFile(file)).toEqual([]);
    const vectors = file.nodes.filter((n) => n.type === "VECTOR");
    expect(vectors.map((n) => n.vectorNetwork === undefined)).toEqual([true, true, true, false]);
    expect(vectors[0]).toMatchObject({ width: 10, height: 10 });
    expect(warnings).toEqual([
      "Reset 1 broken value (such as a non-number opacity) to its default.",
      "Couldn't read the outline of 3 path shapes; they keep their position, size and colour as empty vectors.",
    ]);
  });

  it("makes fresh, valid ids and never reuses the prototype's", () => {
    const { file } = importPrototypeJson(SAVED);
    const ids = file.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of [...ids, file.manifest.fileId]) {
      expect(id).toMatch(NODE_ID_PATTERN);
      expect(id.startsWith("proto-")).toBe(false);
    }
  });

  it("is deterministic given the same id generator and time", () => {
    expect(importPrototypeJson(SAVED, stable())).toEqual(importPrototypeJson(SAVED, stable()));
    expect(importPrototypeJson(JSON.stringify(SAVED), stable())).toEqual(importPrototypeJson(SAVED, stable()));
  });

  it("round-trips through the package and zip forms with nothing lost", () => {
    const { file } = importPrototypeJson(SAVED, stable());
    const tree = writePackage(file);
    const back = readPackage(tree);
    const sort = (f: IlligmaFile) => [...f.nodes].sort((a, b) => (a.id < b.id ? -1 : 1));
    expect(back.manifest).toEqual(file.manifest);
    expect(sort(back)).toEqual(sort(file));
    expect(readPackage(readZip(writeZip(tree)))).toEqual(back);
    expect(writePackage(back)).toEqual(tree);
  });
});

/** A document using every prototype feature, built by hand. */
function richDocument(): Record<string, unknown> {
  const obj = (id: string, type: string, extra: Record<string, unknown> = {}) => ({
    id, type, name: id, x: 0, y: 0, w: 100, h: 50, rotation: 0, opacity: 1, fill: "#ff0000", stroke: "#242529", strokeWidth: 0,
    visible: true, locked: false, effects: [], ...extra,
  });
  const text = (id: string, extra: Record<string, unknown> = {}) =>
    obj(id, "text", { text: id, fontSize: 20, fontFamily: "Inter", fontWeight: 400, baseW: 100, baseH: 50, ...extra });
  return {
    version: 1,
    title: "Rich",
    swatches: ["#ffffff"],
    activePageId: "p1",
    pages: [
      {
        id: "p1",
        name: "Screens",
        canvasColor: "#101010",
        artboards: [
          { id: "A", name: "Desktop", x: 100, y: 200, width: 800, height: 600, fill: "#ffffff", clipContent: true, effects: [{ id: "e", type: "drop-shadow", visible: true, x: 0, y: 4, blur: 8, spread: 0, opacity: 0.2, color: "#000000" }] },
          { id: "B", name: "Card", parentId: "A", x: 150, y: 250, width: 300, height: 200, fill: "none", clipContent: false,
            autoLayout: { enabled: true, direction: "vertical", gap: 8, childOrder: ["b2", "b1"] }, widthSizing: "fixed" },
          { id: "L1", name: "Loop 1", parentId: "L2", x: 2000, y: 0, width: 10, height: 10, fill: "#000000" },
          { id: "L2", name: "Loop 2", parentId: "L1", x: 3000, y: 0, width: 10, height: 10, fill: "#000000" },
          { id: "bad", x: 0, y: 0, width: -5, height: 10, fill: "#000000" },
        ],
        objects: [
          obj("bottom", "rect", { frameId: "A", x: 110, y: 210, radius: 999, fill: "#00ff0080" }),
          obj("g1a", "rect", { frameId: "A", groupId: "G1", x: 120, y: 220 }),
          obj("between", "ellipse", { frameId: "A", x: 500, y: 500, fill: "rgba(0, 0, 255, 0.5)" }),
          obj("g1b", "ellipse", { frameId: "A", groupId: "G1", x: 300, y: 300, w: 40, h: 40, rotation: 90 }),
          obj("b1", "rect", { frameId: "B", x: 160, y: 260, constraints: { horizontal: "stretch" } }),
          obj("b2", "path", { frameId: "B", x: 160, y: 320, d: "M0 0 L10 10 Z", baseW: 100, baseH: 50, fill: "linear-gradient(red, blue)" }),
          text("bold", { frameId: "A", fontWeight: 700, letterSpacing: 1, lineHeight: 1.5 }),
          text("stretched", { frameId: "A", w: 200, h: 50, fontWeight: "600" }),
          text("scaled", { frameId: "A", w: 200, h: 100 }),
          obj("hidden", "rect", { frameId: "A", visible: false, opacity: "half", sparkle: true }),
          obj("ghost", "rect", { frameId: "nope" }),
          obj("loose", "rect", { frameId: null, x: -50, y: -50, stroke: "#123", strokeWidth: 2, effects: [{ type: "layer-blur", blur: 4 }, { type: "layer-blur", blur: 2 }] }),
          { type: "star", id: "x", x: 0, y: 0, w: 1, h: 1 },
          "not an object",
        ],
      },
      { id: "p2", name: "", artboard: { width: 100, height: 100, fill: "#000000" }, objects: [] },
      42,
    ],
  };
}

describe("importPrototypeJson: every prototype feature", () => {
  const { file, warnings } = importPrototypeJson(richDocument(), stable());
  const children = (name: string) => kids(file, byName(file, name).id).map((n) => n.name);

  it("produces a valid file with one page per prototype page", () => {
    expect(validateFile(file)).toEqual([]);
    expect(file.manifest.pages.map((p) => p.name)).toEqual(["Screens", "Page 2"]);
    expect(byName(file, "Page 2").type).toBe("PAGE");
    expect(kids(file, byName(file, "Page 2").id).map((n) => n.name)).toEqual(["Frame 1"]);
  });

  it("nests frames, makes coordinates relative to the parent and breaks parent loops", () => {
    const page = byName(file, "Screens");
    expect(kids(file, page.id).map((n) => n.name)).toEqual(["Desktop", "Loop 1", "ghost", "loose"]);
    expect(byName(file, "Card")).toMatchObject({ type: "FRAME", parentId: byName(file, "Desktop").id, x: 50, y: 50, fills: [] });
    expect(byName(file, "b1")).toMatchObject({ x: 10, y: 10 });
    expect(byName(file, "Loop 2")).toMatchObject({ parentId: byName(file, "Loop 1").id, x: 1000, y: 0 });
    expect(byName(file, "loose")).toMatchObject({ x: -50, y: -50, strokeWeight: 2 });
    expect(hex(byName(file, "loose").strokes[0]!.color)).toBe("#112233");
  });

  it("orders auto layout children by the prototype's childOrder", () => {
    expect(children("Card")).toEqual(["b2", "b1"]);
  });

  it("maps auto layout with the prototype's defaults, and constraints", () => {
    expect(byName(file, "Card")).toMatchObject({
      layoutMode: "VERTICAL", itemSpacing: 8, paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16,
      primaryAxisAlignItems: "MIN", counterAxisAlignItems: "MIN", primaryAxisSizingMode: "AUTO", counterAxisSizingMode: "AUTO",
      layoutSizingHorizontal: "HUG", layoutSizingVertical: "HUG",
    });
    expect(byName(file, "b1").constraints).toEqual({ horizontal: "STRETCH", vertical: "MIN" });
    expect(byName(file, "Desktop").layoutMode).toBeUndefined();
  });

  it("turns groupId into a group at its top member's position, sized to its members", () => {
    expect(children("Desktop")).toEqual(["Card", "bottom", "between", "Group 1", "bold", "stretched", "scaled", "hidden"]);
    const group = byName(file, "Group 1");
    expect(group.type).toBe("GROUP");
    expect(children("Group 1")).toEqual(["g1a", "g1b"]);
    // Members: 120,220 100×50 and a 40×40 square at 300,300 (rotation doesn't change a square's box).
    expect(group).toMatchObject({ x: 20, y: 20, width: 220, height: 120 });
    expect(byName(file, "g1a")).toMatchObject({ x: 0, y: 0 });
    const c = centre(byName(file, "g1b"));
    expect(c.x).toBeCloseTo(200, 6);
    expect(c.y).toBeCloseTo(100, 6);
  });

  it("maps colours with alpha, clamps corner radius and reads weights", () => {
    expect(byName(file, "bottom").fills[0]!.color).toEqual({ r: 0, g: 1, b: 0, a: 128 / 255 });
    expect(byName(file, "bottom").cornerRadius).toBe(25);
    expect(byName(file, "between").fills[0]!.color).toEqual({ r: 0, g: 0, b: 1, a: 0.5 });
    expect(byName(file, "b2").fills).toEqual([]);
    expect(byName(file, "bold")).toMatchObject({ fontStyle: "Bold", lineHeight: 30 });
    expect(byName(file, "stretched").fontStyle).toBe("Semi Bold");
    expect(byName(file, "scaled")).toMatchObject({ fontSize: 40, lineHeight: 46.4 });
    expect(byName(file, "hidden")).toMatchObject({ visible: false, opacity: 1 });
  });

  it("brings effects over, with shadow offsets turned into the layer's own space", () => {
    expect(byName(file, "Desktop").effects).toEqual([
      { type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.2 }, offset: { x: 0, y: 4 }, radius: 8, spread: 0, visible: true },
    ]);
    expect(byName(file, "loose").effects).toEqual([
      { type: "LAYER_BLUR", radius: 4, visible: true },
      { type: "LAYER_BLUR", radius: 2, visible: true },
    ]);
    expect(byName(file, "bottom").effects).toBeUndefined();
    const rotated = importPrototypeJson(
      {
        title: "Rotated",
        version: 1,
        pages: [
          {
            id: "p",
            name: "P",
            artboards: [],
            objects: [
              {
                id: "r", type: "rect", name: "r", x: 0, y: 0, w: 100, h: 50, opacity: 1, fill: "#ff0000", visible: true, locked: false,
                frameId: null,
                rotation: 90,
                effects: [
                  { type: "drop-shadow", x: 0, y: 10, blur: 2, color: "#ff0000", opacity: 0.5, visible: false },
                  { type: "inner-shadow" },
                  { type: "background-blur", blur: 30 },
                  { type: "glow" },
                  { type: "drop-shadow", color: "teal-ish" },
                ],
              },
            ],
          },
        ],
      },
      stable(),
    );
    // 10 down on the page is 10 along +x for a layer turned 90° clockwise (its x axis points down).
    expect(byName(rotated.file, "r").effects).toEqual([
      { type: "DROP_SHADOW", color: { r: 1, g: 0, b: 0, a: 0.5 }, offset: { x: 10, y: 0 }, radius: 2, spread: 0, visible: false },
      { type: "INNER_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.25 }, offset: { x: 4, y: 0 }, radius: 4, spread: 0, visible: true },
      { type: "BACKGROUND_BLUR", radius: 30, visible: true },
    ]);
    expect(rotated.warnings).toContain("Left out 2 effects (1 effect, 1 drop shadow) on 1 layer that couldn't be read.");
    expect(validateFile(rotated.file)).toEqual([]);
  });

  it("warns once per kind, with counts", () => {
    expect(warnings).toEqual([
      "Skipped 1 page that couldn't be read.",
      "Skipped 1 frame that couldn't be read (missing or broken position or size).",
      "Skipped 2 layers that couldn't be read (unknown type, or missing or broken position or size).",
      "1 layer pointed to a frame that doesn't exist, so it was placed on the page.",
      "Broke 1 loop of frames nested inside each other by moving one frame onto the page.",
      "Reset 1 broken value (such as a non-number opacity) to its default.",
      "Left out 1 gradient: the prototype never saved gradient fills, so CSS gradients aren't read.",
      "Left out letter spacing on 1 text layer: format v0 has no letter spacing yet.",
      "1 text layer was stretched unevenly; the font size now matches the height, so it may look narrower or wider.",
      "1 frame didn't clip its content; in format v0 frames always clip.",
      "1 group had other layers between its members; each group now sits where its top layer was, so stacking may differ slightly.",
      "Left out the document's 1 colour swatch: format v0 has no colour styles yet.",
      "Left out the canvas background colour (#101010): format v0 has no page background colour yet.",
      "Left out settings Illigma doesn't recognise on 1 layer: sparkle.",
    ]);
  });

  it("round-trips through the package form", () => {
    expect(readPackage(writePackage(file)).nodes.length).toBe(file.nodes.length);
  });
});

describe("importPrototypeJson: auto layout and constraints", () => {
  /** Laid out by the prototype's own code (8e3bd2f: autolayout.js, constraints.js and main.js's applyAllAutoLayouts). */
  const LAYOUT = fixture("auto-layout-document");
  const { file, warnings } = importPrototypeJson(LAYOUT, stable());
  const layoutFields = (name: string) => {
    const n = byName(file, name) as unknown as Record<string, unknown>;
    const keys = ["layoutMode", "itemSpacing", "counterAxisSpacing", "paddingLeft", "paddingRight", "paddingTop", "paddingBottom",
      "primaryAxisAlignItems", "counterAxisAlignItems", "counterAxisAlignContent", "primaryAxisSizingMode", "counterAxisSizingMode",
      "layoutWrap", "layoutPositioning", "layoutSizingHorizontal", "layoutSizingVertical", "constraints", "minWidth", "maxWidth", "minHeight", "maxHeight"];
    return Object.fromEntries(keys.filter((k) => n[k] !== undefined).map((k) => [k, n[k]]));
  };

  it("imports into a valid file with nothing left out", () => {
    expect(validateFile(file)).toEqual([]);
    expect(warnings).toEqual(["Left out the canvas background colour (#090909): format v0 has no page background colour yet."]);
  });

  it("maps direction, gap, padding, alignment, spacing mode, wrap and sizing", () => {
    expect(layoutFields("Card")).toEqual({
      layoutMode: "VERTICAL", itemSpacing: 12, paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16,
      primaryAxisAlignItems: "MIN", counterAxisAlignItems: "MIN", primaryAxisSizingMode: "AUTO", counterAxisSizingMode: "AUTO",
      layoutSizingHorizontal: "HUG", layoutSizingVertical: "HUG", constraints: { horizontal: "MAX", vertical: "MIN" },
    });
    // "center-left" in a row: centred across, Between along (the spacing mode wins over the alignment along the row).
    expect(layoutFields("Header")).toEqual({
      layoutMode: "HORIZONTAL", itemSpacing: 8, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
      primaryAxisAlignItems: "SPACE_BETWEEN", counterAxisAlignItems: "CENTER", primaryAxisSizingMode: "FIXED", counterAxisSizingMode: "AUTO",
      layoutSizingHorizontal: "FILL", layoutSizingVertical: "HUG",
    });
    expect(layoutFields("Tags")).toMatchObject({ layoutWrap: "WRAP", itemSpacing: 8, counterAxisSpacing: 6, paddingLeft: 0, layoutSizingHorizontal: "FIXED", layoutSizingVertical: "HUG" });
    expect(layoutFields("Toolbar")).toMatchObject({ primaryAxisAlignItems: "CENTER", counterAxisAlignItems: "CENTER", paddingLeft: 12, paddingTop: 8, layoutSizingHorizontal: "FIXED", layoutSizingVertical: "HUG" });
    // "top-right" in a column: right is across the column.
    expect(layoutFields("List")).toMatchObject({ layoutMode: "VERTICAL", primaryAxisAlignItems: "SPACE_EVENLY", counterAxisAlignItems: "MAX", primaryAxisSizingMode: "FIXED", counterAxisSizingMode: "FIXED" });
    expect(layoutFields("Avatars")).toMatchObject({ itemSpacing: -8, layoutSizingHorizontal: "HUG", layoutSizingVertical: "HUG" });
  });

  it("maps layer sizing, limits, ignore auto layout and constraints", () => {
    expect(layoutFields("body")).toEqual({ minWidth: 200 });
    expect(layoutFields("button")).toEqual({ layoutSizingHorizontal: "FILL", maxWidth: 200 });
    expect(layoutFields("t4")).toEqual({ layoutSizingVertical: "FILL", maxHeight: 30 });
    expect(layoutFields("title")).toEqual({ layoutSizingVertical: "HUG" }); // text: auto height
    expect(layoutFields("badge")).toEqual({ layoutPositioning: "ABSOLUTE", constraints: { horizontal: "MAX", vertical: "MIN" } });
    expect(layoutFields("pinned")).toEqual({ constraints: { horizontal: "MAX", vertical: "MAX" } });
    expect(layoutFields("stretchy")).toEqual({ constraints: { horizontal: "STRETCH", vertical: "SCALE" } });
    expect(layoutFields("centred")).toEqual({ constraints: { horizontal: "CENTER", vertical: "CENTER" } });
  });

  it("orders children by childOrder, then layers before frames, as the prototype flowed them", () => {
    const doc = {
      version: 1,
      artboards: [
        { id: "F", x: 0, y: 0, width: 100, height: 100, autoLayout: { enabled: true, childOrder: ["c"] } },
        { id: "inner", name: "inner", parentId: "F", x: 0, y: 0, width: 10, height: 10 },
      ],
      objects: ["a", "b", "c"].map((id) => ({ id, name: id, type: "rect", frameId: "F", x: 0, y: 0, w: 10, h: 10 })),
    };
    const out = importPrototypeJson(doc, stable()).file;
    expect(kids(out, byName(out, "Frame 1").id).map((n) => n.name)).toEqual(["c", "a", "b", "inner"]);
  });

  it("turns grid auto layout into a plain frame, with a warning", () => {
    const doc = {
      version: 1,
      artboards: [{ id: "G", x: 0, y: 0, width: 100, height: 100, autoLayout: { enabled: true, direction: "grid", columns: 2, columnTracks: "1fr 1fr", childOrder: ["b", "a"], flex: 1 } }],
      objects: [
        { id: "a", name: "a", type: "rect", frameId: "G", x: 0, y: 0, w: 10, h: 10, columnSpan: 2, widthSizing: "fill" },
        { id: "b", name: "b", type: "rect", frameId: "G", x: 0, y: 20, w: 10, h: 10, columnSpan: 1 },
      ],
    };
    const { file: out, warnings: w } = importPrototypeJson(doc, stable());
    const grid = byName(out, "Frame 1");
    expect(grid.layoutMode).toBeUndefined();
    expect(kids(out, grid.id).map((n) => n.name)).toEqual(["a", "b"]); // stacking as drawn, not childOrder
    expect(byName(out, "a").layoutSizingHorizontal).toBe("FILL");
    expect(w).toEqual([
      "1 frame uses grid auto layout, which format v0 can't hold yet: it is now a plain frame and its layers keep their current positions.",
      "Left out grid column and row spans on 1 layer.",
      "Left out settings Illigma doesn't recognise on 1 layer: autoLayout.flex.",
    ]);
  });

  it("resets broken layout values to the prototype's defaults", () => {
    const doc = {
      version: 1,
      artboards: [{ x: 0, y: 0, width: 100, height: 100, autoLayout: { enabled: true, direction: "sideways", gap: "8", paddingX: -4, align: 7, spacingMode: "spread", wrap: "yes", sizing: "big" } }],
      objects: [{ type: "rect", x: 0, y: 0, w: 10, h: 10, widthSizing: "huge", minWidth: "1", layoutAbsolute: 1, constraints: { horizontal: "left", vertical: "end" } }],
    };
    const { file: out, warnings: w } = importPrototypeJson(doc, stable());
    expect(validateFile(out)).toEqual([]);
    const frame = byName(out, "Frame 1");
    expect(frame).toMatchObject({
      layoutMode: "HORIZONTAL", itemSpacing: 16, paddingLeft: 0, paddingTop: 16, primaryAxisAlignItems: "MIN", counterAxisAlignItems: "MIN",
      layoutSizingHorizontal: "FIXED", layoutSizingVertical: "FIXED",
    });
    expect(frame.layoutWrap).toBeUndefined();
    const rect = byName(out, "Rectangle");
    expect(rect.layoutSizingHorizontal).toBeUndefined();
    expect(rect.minWidth).toBeUndefined();
    expect(rect.layoutPositioning).toBeUndefined();
    expect(rect.constraints).toEqual({ horizontal: "MIN", vertical: "MAX" });
    expect(w).toEqual(["Reset 9 broken values (such as a non-number opacity) to their defaults."]);
  });
});

describe("importPrototypeJson: QC round 5", () => {
  it("breaks a loop of frames once, and keeps frames that only hang below it", () => {
    // F sits in A; A and B sit in each other.
    const doc = {
      version: 1,
      artboards: [
        { id: "F", name: "F", parentId: "A", x: 0, y: 0, width: 10, height: 10 },
        { id: "A", name: "A", parentId: "B", x: 0, y: 0, width: 50, height: 50 },
        { id: "B", name: "B", parentId: "A", x: 0, y: 0, width: 100, height: 100 },
      ],
      objects: [],
    };
    const { file, warnings } = importPrototypeJson(doc, stable());
    expect(validateFile(file)).toEqual([]);
    const page = file.nodes.find((n) => n.type === "PAGE") as Node;
    expect(byName(file, "A").parentId).toBe(page.id);
    expect(byName(file, "B").parentId).toBe(byName(file, "A").id);
    expect(byName(file, "F").parentId).toBe(byName(file, "A").id);
    expect(warnings).toEqual(["Broke 1 loop of frames nested inside each other by moving one frame onto the page."]);
  });

  it("uses defaults quietly for missing text settings; only broken ones are reported", () => {
    const text = (extra: Record<string, unknown>) => ({ version: 1, objects: [{ type: "text", x: 0, y: 0, w: 10, h: 10, ...extra }] });
    const quiet = importPrototypeJson(text({}), stable());
    expect(quiet.warnings).toEqual([]);
    expect(byName(quiet.file, "Text")).toMatchObject({ characters: "", fontSize: 16, fontFamily: "Inter", fontStyle: "Regular" });
    expect(importPrototypeJson(text({ text: 5, fontSize: "big", fontFamily: 7 }), stable()).warnings).toEqual([
      "Reset 3 broken values (such as a non-number opacity) to their defaults.",
    ]);
  });

  it("reads JSON text that starts with a UTF-8 byte order mark", () => {
    expect(importPrototypeJson("\ufeff" + JSON.stringify(SAVED), stable())).toEqual(importPrototypeJson(SAVED, stable()));
  });

  /** Time budgets are tuned on a laptop. Shared CI runners are slower, so CI gets 3x (or PERF_BUDGET_SCALE). */
  const budget = (ms: number) => ms * (Number(process.env.PERF_BUDGET_SCALE) || (process.env.CI ? 3 : 1));
  const rect = (i: number, extra: Record<string, unknown> = {}) => ({ id: `o${i}`, type: "rect", x: (i % 100) * 10, y: Math.floor(i / 100) * 10, w: 5, h: 5, ...extra });

  it("imports large groups and many frames within budget", () => {
    // 10 pages of 10,000 layers each: once plain, once as one group per page with its members
    // spread between other layers. The group check was quadratic in the group's size (about
    // 4x the plain import before QC round 5); comparing with the plain import in the same run
    // keeps the test steady on a busy machine.
    const pages = (grouped: boolean) =>
      Array.from({ length: 10 }, () => ({ objects: Array.from({ length: 10_000 }, (_, i) => rect(i, { frameId: null, ...(grouped && i % 10 ? { groupId: "g" } : {}) })) }));
    const time = (doc: unknown) => {
      const t = performance.now();
      const result = importPrototypeJson(doc, stable());
      return { ms: performance.now() - t, result };
    };
    time({ version: 1, pages: pages(false).slice(0, 2) }); // warm up
    const plain = time({ version: 1, pages: pages(false) });
    const grouped = time({ version: 1, pages: pages(true) });
    expect(grouped.result.file.nodes.length).toBe(10 * (10_000 + 2));
    expect(grouped.result.warnings).toContain("10 groups had other layers between their members; each group now sits where its top layer was, so stacking may differ slightly.");
    expect(grouped.ms, `groups took ${Math.round(grouped.ms)} ms, plain ${Math.round(plain.ms)} ms`).toBeLessThan(2 * plain.ms + 100);

    // An older document (no frameId): each layer goes to the topmost frame holding its centre.
    // 5 pages × 1,000 frames × 10,000 layers: about 400 ms on a laptop (530 ms before).
    const frames = Array.from({ length: 1_000 }, (_, i) => ({ id: `f${i}`, x: 2_000 + i * 20, y: 0, width: 10, height: 10 }));
    const older = time({ version: 1, pages: Array.from({ length: 5 }, () => ({ artboards: frames, objects: Array.from({ length: 10_000 }, (_, i) => rect(i)) })) });
    expect(plain.ms, `plain import took ${Math.round(plain.ms)} ms`).toBeLessThan(budget(3000));
    expect(older.ms, `frames took ${Math.round(older.ms)} ms`).toBeLessThan(budget(3000));
  });
});

describe("parsePrototypeColor", () => {
  it("reads hex and rgb forms, and none", () => {
    expect(parsePrototypeColor("#FFFFFF")).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(parsePrototypeColor("#000")).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(parsePrototypeColor("#f008")).toEqual({ r: 1, g: 0, b: 0, a: 0x88 / 255 });
    expect(parsePrototypeColor(" rgb(255, 0, 0) ")).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    expect(parsePrototypeColor("none")).toBeNull();
    expect(parsePrototypeColor("transparent")).toBeNull();
  });
  it("returns undefined for anything else", () => {
    for (const s of ["", "#12", "#12345", "red", "rgba(300, 0, 0, 1)", "rgba(0,0,0,2)", "hsl(0 0% 0%)", "linear-gradient(red, blue)"]) {
      expect(parsePrototypeColor(s)).toBeUndefined();
    }
  });
});

describe("importPrototypeJson: unusable input", () => {
  const refuses = (input: unknown, message: RegExp) => {
    expect(() => importPrototypeJson(input)).toThrow(FormatError);
    expect(() => importPrototypeJson(input)).toThrow(message);
  };

  it("refuses things that aren't prototype documents, in plain language", () => {
    for (const v of [null, undefined, 42, true, [], [SAMPLE]]) refuses(v, /should be a JSON object/);
    refuses("{not json", /not valid JSON/);
    refuses({}, /no "objects" list/);
    refuses({ version: 1, pages: [42, null, "page"] }, /None of this document's pages could be read/);
    refuses({ version: 1, objects: "nope" }, /no "objects" list/);
    refuses({ ...SAMPLE, version: 2 }, /version 2\. Only version 1/);
    refuses({ ...SAMPLE, version: "1" }, /no valid version number/);
    refuses({ manifest: {}, nodes: [] }, /already an \.illigma file/);
    refuses({ format: "illigma", version: 0, pages: [] }, /already an \.illigma file/);
  });

  it("refuses documents beyond the size limits", () => {
    const L = PROTOTYPE_IMPORT_LIMITS;
    refuses({ ...SAMPLE, pages: Array.from({ length: L.maxPages + 1 }, () => ({ objects: [] })) }, /At most 100 can be imported/);
    refuses({ ...SAMPLE, objects: Array.from({ length: L.maxLayersPerPage + 1 }, () => ({})) }, /At most 10,000 per page/);
    refuses({ ...SAMPLE, artboards: Array.from({ length: L.maxFramesPerPage + 1 }, () => ({})) }, /At most 1,000 per page/);
  });

  it("imports an empty document as one empty page", () => {
    const { file, warnings } = importPrototypeJson({ version: 1, objects: [] });
    expect(validateFile(file)).toEqual([]);
    expect(file.manifest.name).toBe("Imported prototype");
    expect(file.nodes.map((n) => n.type)).toEqual(["PAGE"]);
    expect(warnings).toEqual([]);
  });

  it("refuses an id generator that keeps repeating itself", () => {
    expect(() => importPrototypeJson(SAMPLE, { newId: () => "same" })).toThrow(FormatError);
  });
});

/** mulberry32: small, fast, seedable. */
function prng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  const pick = <T>(xs: readonly T[]): T => xs[int(xs.length)] as T;
  return { next, int, pick };
}

const NASTY: unknown[] = [
  null, undefined, true, 0, -1, 1e308, -1e308, Number.MAX_SAFE_INTEGER, 0.5, "", "none", "#fff", "rgba(1,2,3,4)", "proto-0115", "A",
  "__proto__", "constructor", "x".repeat(2000), [], [null], {}, { toString: 1, valueOf: 2 }, JSON.parse('{"__proto__": {"polluted": true}}'),
  { type: "drop-shadow" }, [{ id: "e" }], { enabled: true, childOrder: [1, null, "proto-0101"] },
];

/** Replace or delete a random value somewhere inside `root`. */
function mutate(r: ReturnType<typeof prng>, root: Record<string, unknown>): void {
  let parent: unknown = root;
  for (let depth = 0; depth < 6; depth++) {
    const keys = parent && typeof parent === "object" ? Object.keys(parent) : [];
    if (!keys.length) return;
    const key = r.pick(keys);
    const child = (parent as Record<string, unknown>)[key];
    if (child && typeof child === "object" && r.next() < 0.7) {
      parent = child;
      continue;
    }
    if (r.next() < 0.2 && !Array.isArray(parent)) delete (parent as Record<string, unknown>)[key];
    else (parent as Record<string, unknown>)[key] = r.pick(NASTY);
    return;
  }
}

describe("importPrototypeJson: fuzzed documents", () => {
  const SEED = Number(process.env.FUZZ_SEED ?? 0x0be5);
  const CASES = Number(process.env.FUZZ_CASES ?? 400);

  it(`gives a valid file or a FormatError for ${CASES} random mutations, never another exception`, () => {
    const r = prng(SEED);
    let opened = 0;
    for (let i = 0; i < CASES; i++) {
      const doc = structuredClone(r.next() < 0.5 ? SAVED : SAMPLE) as Record<string, unknown>;
      for (let m = 1 + r.int(4); m > 0; m--) mutate(r, doc);
      try {
        const { file, warnings } = importPrototypeJson(doc, stable());
        expect(validateFile(file), `seed ${SEED} case ${i}`).toEqual([]);
        expect(readPackage(writePackage(file)).nodes.length).toBe(file.nodes.length);
        expect(warnings.every((w) => typeof w === "string")).toBe(true);
        opened++;
      } catch (e) {
        if (!(e instanceof FormatError)) throw new Error(`seed ${SEED} case ${i}: ${String(e)}\n${JSON.stringify(doc).slice(0, 2000)}`);
      }
    }
    expect(opened).toBeGreaterThan(CASES / 2); // most mutations are survivable
  });
});
