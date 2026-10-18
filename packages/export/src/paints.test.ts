// Gradients, images, effects, blend modes and stroke alignment in every export format.
import { beforeAll, describe, expect, it } from "vitest";
import type { CanvasKit, Surface } from "canvaskit-wasm";
import type { Effect, Paint, Transform } from "@illigma/format";
import { exportNode, exportPdf } from "./index.js";
import { imageSize } from "./vector-common.js";
import { assertWellFormedXml, BLUE, build, canvasKit, decode, parsePdf, RED, solid, withoutIdPrefix } from "./test.fixture.js";

let ck: CanvasKit;
beforeAll(async () => {
  ck = await canvasKit();
});

const IDENTITY: Transform = [
  [1, 0, 0],
  [0, 1, 0],
];
const linear = (transform: Transform = IDENTITY, type: Paint["type"] = "GRADIENT_LINEAR"): Paint =>
  ({
    type,
    visible: true,
    gradientStops: [
      { position: 0, color: RED },
      { position: 1, color: BLUE },
    ],
    gradientTransform: transform,
  }) as Paint;
const shadow = (x: number, y: number, radius: number, extra: Partial<Effect> = {}): Effect =>
  ({ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 1 }, offset: { x, y }, radius, visible: true, ...extra }) as Effect;

/** A w × h PNG: the left half red, the right half blue. */
function twoTonePng(w = 20, h = 10): Uint8Array {
  const s = ck.MakeSurface(w, h) as Surface;
  const c = s.getCanvas();
  const p = new ck.Paint();
  c.clear(ck.BLUE);
  p.setColor(ck.RED);
  c.drawRect(ck.XYWHRect(0, 0, w / 2, h), p);
  const img = s.makeImageSnapshot();
  const png = img.encodeToBytes() as Uint8Array;
  img.delete();
  p.delete();
  s.delete();
  return png;
}

const isRed = ([r, g, b, a]: number[]) => (r as number) > 200 && (g as number) < 60 && (b as number) < 60 && (a as number) > 200;
const isBlue = ([r, , b, a]: number[]) => (r as number) < 60 && (b as number) > 200 && (a as number) > 200;
const svgText = (bytes: Uint8Array) => {
  const text = new TextDecoder().decode(bytes);
  assertWellFormedXml(text);
  return withoutIdPrefix(text);
};

describe("PNG and JPG export of paints and effects", () => {
  it("draws a gradient, a drop shadow and the document's image, with the shadow inside the bounds", async () => {
    const png = twoTonePng();
    const { doc, ids } = build((add, p) => {
      const frame = add("FRAME", p, { name: "Card", width: 100, height: 100, fills: [linear()], effects: [shadow(0, 20, 0)] });
      return { frame, photo: add("RECTANGLE", frame, { x: 10, y: 60, width: 80, height: 40, fills: [] }) };
    });
    const hash = doc.addImage(png);
    doc.transact("Image", (tx) => tx.set(ids.photo, "fills", [{ type: "IMAGE", visible: true, imageHash: hash, scaleMode: "FILL" }]));
    const file = await exportNode(doc, ids.frame, { format: "PNG" }, { canvasKit: ck });
    expect(file.warnings).toEqual([]);
    const img = decode(ck, file.bytes);
    expect([img.width, img.height]).toEqual([100, 120]); // the shadow reaches 20 below
    expect(isRed(img.at(2, 30))).toBe(true); // the gradient's start…
    expect(isBlue(img.at(97, 30))).toBe(true); // …and its end
    expect(isRed(img.at(30, 80))).toBe(true); // the image's left half (FILL: 80 × 40 covers it exactly)
    expect(isBlue(img.at(70, 80))).toBe(true);
    const below = img.at(50, 110);
    expect(below[3]).toBeGreaterThan(200); // the shadow
    expect(below[0]).toBeLessThan(20);
  });

  it("applies layer blend modes and inside strokes", async () => {
    const { doc, ids } = build((add, p) => {
      const frame = add("FRAME", p, { width: 40, height: 40, fills: solid(RED) });
      add("RECTANGLE", frame, { width: 40, height: 40, fills: solid({ r: 0, g: 1, b: 0, a: 1 }), blendMode: "SCREEN" });
      const box = add("RECTANGLE", p, { x: 100, width: 40, height: 40, fills: solid(RED), strokes: solid(BLUE), strokeWeight: 10, strokeAlign: "INSIDE" });
      return { frame, box };
    });
    const f = decode(ck, (await exportNode(doc, ids.frame, { format: "PNG" }, { canvasKit: ck })).bytes);
    expect(f.at(20, 20).slice(0, 3)).toEqual([255, 255, 0]);
    const b = decode(ck, (await exportNode(doc, ids.box, { format: "PNG" }, { canvasKit: ck })).bytes);
    expect([b.width, b.height]).toEqual([40, 40]); // an inside stroke doesn't grow the bounds
    expect(isBlue(b.at(5, 20))).toBe(true);
    expect(isRed(b.at(20, 20))).toBe(true);
  });
});

describe("SVG export of paints and effects", () => {
  it("writes linear and radial gradients in the layer's space", async () => {
    const { doc, ids } = build((add, p) => ({
      a: add("RECTANGLE", p, { width: 100, height: 50, fills: [linear()] }),
      b: add("ELLIPSE", p, { x: 200, width: 40, height: 40, fills: [{ ...linear(IDENTITY, "GRADIENT_RADIAL"), opacity: 0.5 } as Paint] }),
    }));
    const a = svgText((await exportNode(doc, ids.a, { format: "SVG" })).bytes);
    expect(a).toContain(`<rect width="100" height="50" fill="url(#linear_${ids.a})"/>`);
    expect(a).toContain(`<linearGradient id="linear_${ids.a}" x1="0" y1="0.5" x2="1" y2="0.5" gradientUnits="userSpaceOnUse" gradientTransform="matrix(100 0 0 50 0 0)">`);
    expect(a).toContain(`<stop offset="0" stop-color="#FF0000"/>`);
    expect(a).toContain(`<stop offset="1" stop-color="#0000FF"/>`);
    const b = svgText((await exportNode(doc, ids.b, { format: "SVG" })).bytes);
    expect(b).toContain(`fill="url(#radial_${ids.b})" fill-opacity="0.5"`);
    expect(b).toContain(`<radialGradient id="radial_${ids.b}" cx="0.5" cy="0.5" r="0.5" gradientUnits="userSpaceOnUse" gradientTransform="matrix(40 0 0 40 0 0)">`);
  });

  it("writes angular and diamond gradients as radial ones, with a warning", async () => {
    const { doc, ids } = build((add, p) => ({ a: add("RECTANGLE", p, { width: 10, height: 10, fills: [linear(IDENTITY, "GRADIENT_ANGULAR"), linear(IDENTITY, "GRADIENT_DIAMOND")] }) }));
    const file = await exportNode(doc, ids.a, { format: "SVG" });
    expect(svgText(file.bytes).match(/<radialGradient/g)).toHaveLength(2);
    expect(file.warnings).toEqual(["SVG has no angular gradient, so it was written as a radial gradient.", "SVG has no diamond gradient, so it was written as a radial gradient."]);
  });

  it("embeds each image once and places it with a pattern", async () => {
    const png = twoTonePng();
    const { doc, ids } = build((add, p) => {
      const g = add("GROUP", p, { width: 200, height: 40 });
      add("RECTANGLE", g, { name: "A", width: 80, height: 40 });
      add("RECTANGLE", g, { name: "B", x: 100, width: 100, height: 40 });
      return { g };
    });
    const hash = doc.addImage(png);
    for (const n of doc.children(ids.g)) {
      doc.transact("Image", (tx) => tx.set(n.id, "fills", [{ type: "IMAGE", visible: true, imageHash: hash, scaleMode: n.name === "A" ? "FILL" : "TILE", scalingFactor: 2 } as Paint]));
    }
    const file = await exportNode(doc, ids.g, { format: "SVG" });
    const text = svgText(file.bytes);
    expect(file.warnings).toEqual([]);
    expect(text).toContain(`xmlns:xlink="http://www.w3.org/1999/xlink"`);
    expect(text.match(/data:image\/png;base64,/g)).toHaveLength(1);
    expect(text).toContain(`<image id="image_${hash.slice(0, 12)}" width="20" height="10" preserveAspectRatio="none" xlink:href="data:image/png;base64,`);
    // FILL: 20 × 10 scaled by 4 to cover 80 × 40.
    expect(text).toContain(`<use xlink:href="#image_${hash.slice(0, 12)}" transform="matrix(4 0 0 4 0 0)"/>`);
    // TILE at 2×: 40 × 20 tiles.
    expect(text).toContain(`<pattern id="pattern_${doc.children(ids.g)[1]?.id}" patternUnits="userSpaceOnUse" width="40" height="20">`);
    expect(Buffer.from(/base64,([^"]+)"/.exec(text)?.[1] ?? "", "base64").equals(Buffer.from(png))).toBe(true);
  });

  it("warns about images the document doesn't have", async () => {
    const { doc, ids } = build((add, p) => ({ r: add("RECTANGLE", p, { width: 10, height: 10, fills: [{ type: "IMAGE", visible: true, imageHash: "0".repeat(64), scaleMode: "FILL" }] }) }));
    const file = await exportNode(doc, ids.r, { format: "SVG" });
    expect(file.warnings).toEqual(["An image (000000000000…) isn't in the document, so it was left out."]);
  });

  it("writes shadows and layer blur as a filter, and warns about background blur", async () => {
    const { doc, ids } = build((add, p) => ({
      r: add("RECTANGLE", p, {
        width: 40,
        height: 40,
        fills: solid(RED),
        effects: [
          shadow(0, 4, 8, { spread: 2 }),
          { type: "INNER_SHADOW", color: { r: 1, g: 1, b: 1, a: 0.5 }, offset: { x: 0, y: 2 }, radius: 4, visible: true },
          { type: "LAYER_BLUR", radius: 2, visible: true },
          { type: "BACKGROUND_BLUR", radius: 10, visible: true },
        ],
      }),
    }));
    const file = await exportNode(doc, ids.r, { format: "SVG" });
    const text = svgText(file.bytes);
    expect(file.warnings).toEqual(["SVG has no background blur, so it was left out."]);
    // Bounds: the shadow (spread 2 and blur 3σ = 12 each side, moved down 4) and the layer blur (3σ = 3) widen the export.
    expect([file.width, file.height]).toEqual([74, 74]);
    expect(text).toContain(`filter="url(#effects_${ids.r})"`);
    for (const piece of [
      `<feMorphology in="SourceAlpha" operator="dilate" radius="2" result="drop0_spread"/>`,
      `<feOffset in="drop0_spread" dx="0" dy="4"/>`,
      `<feGaussianBlur stdDeviation="4" result="drop0_alpha"/>`,
      `<feComposite in="drop0" in2="SourceAlpha" operator="out" result="drop0"/>`,
      `<feFuncA type="table" tableValues="1 0"/>`,
      `<feFlood flood-color="#FFFFFF" flood-opacity="0.5" result="inner0_color"/>`,
      `<feMergeNode in="drop0"/>`,
      `<feMergeNode in="SourceGraphic"/>`,
      `<feMergeNode in="inner0"/>`,
      `<feGaussianBlur in="merged" stdDeviation="1"/>`,
    ]) {
      expect(text).toContain(piece);
    }
  });

  it("writes blend modes as mix-blend-mode, and inside and outside strokes", async () => {
    const { doc, ids } = build((add, p) => {
      const g = add("GROUP", p, { width: 100, height: 40, blendMode: "MULTIPLY" });
      add("RECTANGLE", g, { width: 40, height: 40, fills: [{ type: "SOLID", visible: true, color: RED, blendMode: "COLOR_DODGE" }], strokes: solid(BLUE), strokeWeight: 4, strokeAlign: "INSIDE" });
      add("ELLIPSE", g, { x: 60, width: 40, height: 40, fills: [{ type: "SOLID", visible: true, color: RED, blendMode: "LINEAR_BURN" }], strokes: solid(BLUE), strokeWeight: 4, strokeAlign: "OUTSIDE" });
      return { g };
    });
    const file = await exportNode(doc, ids.g, { format: "SVG" });
    const text = svgText(file.bytes);
    expect(file.warnings).toEqual(["SVG has no linear burn blend mode, so it was written as multiply."]);
    expect(text).toContain(`style="mix-blend-mode: multiply"`);
    expect(text).toContain(`fill="#FF0000" style="mix-blend-mode: color-dodge"`);
    expect(text).toMatch(/<rect width="40" height="40" stroke="#0000FF" stroke-width="8" clip-path="url\(#stroke_inside_[^)]+\)"\/>/);
    expect(text).toMatch(/<ellipse cx="20" cy="20" rx="20" ry="20" stroke="#0000FF" stroke-width="8" mask="url\(#stroke_outside_[^)]+\)"\/>/);
    expect(text).toContain(`<ellipse cx="20" cy="20" rx="20" ry="20" fill="black"/>`);
    // An outside stroke reaches its full weight (4 past the ellipse); an inside one nothing.
    expect([file.width, file.height]).toEqual([104, 48]);
  });
});

describe("PDF export of paints and effects", () => {
  it("writes gradients as shading patterns placed in page space", async () => {
    const { doc, ids } = build((add, p) => ({
      a: add("RECTANGLE", p, { width: 100, height: 50, fills: [linear()], strokes: [linear(IDENTITY, "GRADIENT_RADIAL")], strokeWeight: 2 }),
    }));
    const file = await exportNode(doc, ids.a, { format: "PDF" });
    const { text } = parsePdf(file.bytes);
    expect(file.warnings).toEqual([]);
    expect(text).toContain("/Pattern cs /P0 scn");
    expect(text).toContain("/Pattern CS /P1 SCN");
    // The page is 102 × 52 (the stroke), y-up: the gradient's unit space maps through the flip.
    expect(text).toContain("/PatternType 2 /Shading << /ShadingType 2 /ColorSpace /DeviceRGB /Coords [0 0.5 1 0.5] /Function << /FunctionType 2 /Domain [0 1] /C0 [1 0 0] /C1 [0 0 1] /N 1 >> /Extend [true true] >> /Matrix [100 0 0 -50 1 51]");
    expect(text).toContain("/ShadingType 3");
    expect(text).toContain("/Resources");
    expect(text).toMatch(/\/Pattern << \/P0 \d+ 0 R \/P1 \d+ 0 R >>/);
  });

  it("stitches gradients with several stops, and warns about stops with different opacity", async () => {
    const { doc, ids } = build((add, p) => ({
      a: add("RECTANGLE", p, {
        width: 10,
        height: 10,
        fills: [
          {
            type: "GRADIENT_LINEAR",
            visible: true,
            gradientStops: [
              { position: 0.2, color: RED },
              { position: 0.5, color: { r: 0, g: 1, b: 0, a: 0.5 } },
              { position: 0.5, color: BLUE },
            ],
            gradientTransform: IDENTITY,
          },
        ],
      }),
    }));
    const file = await exportNode(doc, ids.a, { format: "PDF" });
    const { text } = parsePdf(file.bytes);
    expect(text).toContain("/FunctionType 3 /Domain [0 1] /Functions [");
    expect(text).toContain("/Bounds [0.2 0.5] /Encode [0 1 0 1 0 1]");
    expect(file.warnings).toEqual(["PDF gradients can't change transparency along the gradient, so each one uses its stops' average opacity."]);
  });

  it("embeds images decoded by CanvasKit, clipped to the shape, once per page", async () => {
    const png = twoTonePng();
    const { doc, ids } = build((add, p) => {
      const g = add("GROUP", p, { width: 100, height: 40 });
      add("ELLIPSE", g, { width: 40, height: 40 });
      add("RECTANGLE", g, { x: 60, width: 40, height: 40 });
      return { g };
    });
    const hash = doc.addImage(png);
    for (const n of doc.children(ids.g)) doc.transact("Image", (tx) => tx.set(n.id, "fills", [{ type: "IMAGE", visible: true, imageHash: hash, scaleMode: "FIT" }]));
    const file = await exportNode(doc, ids.g, { format: "PDF" }, { canvasKit: ck });
    const { text } = parsePdf(file.bytes);
    expect(file.warnings).toEqual([]);
    expect(text.match(/\/Subtype \/Image \/Width 20 \/Height 10 \/ColorSpace \/DeviceRGB/g)).toHaveLength(1);
    expect(text).toContain("W n");
    expect(text.match(/\/Im0 Do/g)).toHaveLength(2);
    // Without CanvasKit, a PNG can't be embedded: a warning, not a silent gap.
    const bare = await exportNode(doc, ids.g, { format: "PDF" });
    expect(bare.warnings).toEqual(["Images other than JPEG need the drawing engine to go into a PDF, so some were left out."]);
  });

  it("embeds JPEGs as they are, without CanvasKit", async () => {
    // A JPEG header up to its start-of-frame (8 × 4 pixels, 3 components) is all the writer reads.
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, 0, 4, 0, 8, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9]);
    expect(imageSize(jpeg)).toMatchObject({ format: "jpg", width: 8, height: 4, orientation: 1, rawWidth: 8, rawHeight: 4 });
    const { doc, ids } = build((add, p) => ({ r: add("RECTANGLE", p, { width: 8, height: 4 }) }));
    const hash = doc.addImage(jpeg);
    doc.transact("Image", (tx) => tx.set(ids.r, "fills", [{ type: "IMAGE", visible: true, imageHash: hash, scaleMode: "FILL" }]));
    const file = await exportNode(doc, ids.r, { format: "PDF" });
    const { text } = parsePdf(file.bytes);
    expect(file.warnings).toEqual([]);
    expect(text).toContain("/Width 8 /Height 4 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode");
  });

  it("draws layers with effects as images with CanvasKit, and warns without it", async () => {
    const { doc, ids } = build((add, p) => ({ r: add("RECTANGLE", p, { width: 40, height: 40, fills: solid(RED), effects: [shadow(0, 10, 0)] }) }));
    const withCk = await exportNode(doc, ids.r, { format: "PDF" }, { canvasKit: ck });
    expect(withCk.warnings).toEqual(["Layers with shadows or blurs are drawn into the PDF as images, as on the canvas."]);
    expect([withCk.width, withCk.height]).toEqual([40, 50]);
    expect(parsePdf(withCk.bytes).text).toContain("/Subtype /Image /Width 80 /Height 100"); // 2 px per pt
    const without = await exportNode(doc, ids.r, { format: "PDF" });
    expect(without.warnings).toEqual(["Shadows and blurs need the drawing engine to go into a PDF, so they were left out."]);
    expect(parsePdf(without.bytes).text).toContain("1 0 0 rg");
  });

  it("writes blend modes as /BM, and clips inside and outside strokes", async () => {
    const { doc, ids } = build((add, p) => {
      const g = add("GROUP", p, { width: 100, height: 40, blendMode: "OVERLAY" });
      add("RECTANGLE", g, { width: 40, height: 40, fills: [{ type: "SOLID", visible: true, color: RED, blendMode: "SOFT_LIGHT" }], strokes: solid(BLUE), strokeWeight: 4, strokeAlign: "INSIDE" });
      add("RECTANGLE", g, { x: 60, width: 40, height: 40, strokes: solid(BLUE), strokeWeight: 4, strokeAlign: "OUTSIDE" });
      return { g };
    });
    const file = await exportPdf(doc, [ids.g]);
    const { text } = parsePdf(file.bytes);
    expect(file.warnings).toEqual([]);
    expect(text).toContain("/BM /Overlay");
    expect(text).toContain("/BM /SoftLight");
    expect(text).toContain("0 0 m 40 0 l 40 40 l 0 40 l h W n");
    expect(text).toContain("8 w 0 J 0 j 4 M");
    expect(text).toContain("-17 -17 74 74 re 0 0 m 40 0 l 40 40 l 0 40 l h W* n");
  });
});
