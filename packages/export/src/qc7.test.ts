// QC round 7: Exif orientation, miter bounds, SVG grouping and ids, PDF images, budgets and isolation, file names.
import { beforeAll, describe, expect, it } from "vitest";
import type { CanvasKit } from "canvaskit-wasm";
import type { Effect, Paint } from "@illigma/format";
import { encodeJpeg } from "./jpeg.js";
import { exportNode, exportNodes, exportPdf, exportScene, exportFilename, planExportFilenames, sanitizeFilePart, uniqueFilename, writePdf, type RasterText } from "./index.js";
import { imageSize, orientationMatrix } from "./vector-common.js";
import { applyM, assertWellFormedXml, BLUE, build, canvasKit, decode, interFonts, parsePdf, pdfDraws, RED, solid, streamOf } from "./test.fixture.js";

let ck: CanvasKit;
beforeAll(async () => {
  ck = await canvasKit();
});

/** Object numbers in a one-page writePdf file. */
const CONTENTS = 5;

/** A w × h JPEG whose pixels come from `color(x, y)`, with an Exif orientation (big- or little-endian TIFF) when given. */
function jpeg(w: number, h: number, color: (x: number, y: number) => [number, number, number], orientation?: number, littleEndian = false): Uint8Array {
  const px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = color(x, y);
      px.set([r, g, b, 255], (y * w + x) * 4);
    }
  }
  const plain = encodeJpeg(px, w, h, 95);
  if (orientation === undefined) return plain;
  const u16 = (v: number) => (littleEndian ? [v & 255, v >> 8] : [v >> 8, v & 255]);
  const u32 = (v: number) => (littleEndian ? [...u16(v & 0xffff), ...u16(v >>> 16)] : [...u16(v >>> 16), ...u16(v & 0xffff)]);
  // A TIFF header, then one directory with one entry: orientation (0x0112), SHORT, count 1.
  const tiff = [...(littleEndian ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8), ...u16(1), ...u16(0x0112), ...u16(3), ...u32(1), ...u16(orientation), 0, 0, ...u32(0)];
  const body = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 255, ...body, ...plain.subarray(2)]);
}

/** Left half red, right half blue. */
const halves = (w: number) => (x: number): [number, number, number] => (x < w / 2 ? [255, 0, 0] : [0, 0, 255]);
const isRed = ([r, g, b]: number[]) => (r as number) > 200 && (g as number) < 60 && (b as number) < 60;
const isBlue = ([r, , b]: number[]) => (r as number) < 60 && (b as number) > 200;
const svgOf = (bytes: Uint8Array) => {
  const text = new TextDecoder().decode(bytes);
  assertWellFormedXml(text);
  return text;
};
const shadow = (extra: Partial<Effect> = {}): Effect => ({ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 1 }, offset: { x: 0, y: 4 }, radius: 4, visible: true, ...extra }) as Effect;

describe("Exif orientation (QC7 #1)", () => {
  it("turns images as CanvasKit does, for every orientation and byte order", () => {
    // A red 10 × 10 block in the stored top-left corner of a blue 40 × 20 image.
    for (const le of [false, true]) {
      for (let o = 1; o <= 8; o++) {
        const bytes = jpeg(40, 20, (x, y) => (x < 10 && y < 10 ? [255, 0, 0] : [0, 0, 255]), o, le);
        const info = imageSize(bytes);
        const img = decode(ck, bytes);
        expect(info).toMatchObject({ format: "jpg", width: img.width, height: img.height, orientation: o, rawWidth: 40, rawHeight: 20 });
        const [x, y] = applyM(orientationMatrix(o, 40, 20), 5, 5);
        expect(isRed(img.at(Math.floor(x), Math.floor(y))), `orientation ${o}`).toBe(true);
        const [bx, by] = applyM(orientationMatrix(o, 40, 20), 30, 15);
        expect(isBlue(img.at(Math.floor(bx), Math.floor(by))), `orientation ${o}`).toBe(true);
      }
    }
  });

  it("places a phone photo (40 × 20 stored, orientation 6) the same in PNG, SVG and PDF", async () => {
    const photo = jpeg(40, 20, halves(40), 6);
    expect(imageSize(photo)).toMatchObject({ width: 20, height: 40 });
    const { doc, ids } = build((add, p) => ({ r: add("RECTANGLE", p, { width: 20, height: 40 }) }));
    const hash = doc.addImage(photo);
    doc.transact("Image", (tx) => tx.set(ids.r, "fills", [{ type: "IMAGE", visible: true, imageHash: hash, scaleMode: "FILL" }]));

    // The renderer: turned a quarter clockwise, the stored left (red) is on top.
    const png = decode(ck, (await exportNode(doc, ids.r, { format: "PNG" }, { canvasKit: ck })).bytes);
    expect([png.width, png.height]).toEqual([20, 40]);
    expect(isRed(png.at(10, 5))).toBe(true);
    expect(isBlue(png.at(10, 35))).toBe(true);

    // SVG: the stored image, its orientation cleared, turned by the pattern.
    const svg = svgOf((await exportNode(doc, ids.r, { format: "SVG" })).bytes);
    expect(svg).toMatch(/<image id="[^"]+" width="40" height="20" /);
    const embedded = Buffer.from(/base64,([^"]+)"/.exec(svg)?.[1] ?? "", "base64");
    expect(imageSize(new Uint8Array(embedded))).toMatchObject({ orientation: 1, width: 40, height: 20 });
    const m = (/<use [^>]*transform="matrix\(([^)]+)\)"/.exec(svg)?.[1] ?? "").split(" ").map(Number);
    expect(applyM(m, 5, 10)[1]).toBeLessThan(20); // a red stored pixel lands in the top half
    expect(applyM(m, 35, 10)[1]).toBeGreaterThan(20); // a blue one in the bottom half
    expect(applyM(m, 5, 10)[0]).toBeGreaterThan(0);
    expect(applyM(m, 5, 10)[0]).toBeLessThan(20);

    // PDF, with and without CanvasKit: the JPEG as it is (stored 40 × 20), turned by the placement.
    for (const deps of [{}, { canvasKit: ck }]) {
      const file = await exportNode(doc, ids.r, { format: "PDF" }, deps);
      expect(file.warnings).toEqual([]);
      const pdf = parsePdf(file.bytes);
      expect(pdf.text).toContain("/Width 40 /Height 20 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode");
      const draw = pdfDraws(streamOf(pdf.objects, CONTENTS)).find((d) => d.name.startsWith("Im"));
      expect(draw).toBeDefined();
      // Image space: u across the stored pixels, v up from the last row. Page space is y-up on a 40-high page.
      const at = (rx: number, ry: number) => {
        const [x, y] = applyM(draw!.ctm, rx / 40, 1 - ry / 20);
        return [x, 40 - y];
      };
      expect(at(5, 10)[1]).toBeLessThan(20);
      expect(at(35, 10)[1]).toBeGreaterThan(20);
      expect(at(5, 10)[0]).toBeGreaterThan(0);
      expect(at(5, 10)[0]).toBeLessThan(20);
    }
  });
});

describe("PDF images (QC7 #5, #14)", () => {
  it("embeds baseline JPEGs as they are even with CanvasKit, and decodes other images", async () => {
    const photo = jpeg(64, 64, (x, y) => [x * 4, y * 4, 128]);
    const { doc, ids } = build((add, p) => ({ r: add("RECTANGLE", p, { width: 64, height: 64 }) }));
    const hash = doc.addImage(photo);
    doc.transact("Image", (tx) => tx.set(ids.r, "fills", [{ type: "IMAGE", visible: true, imageHash: hash, scaleMode: "FILL" }]));
    const file = await exportNode(doc, ids.r, { format: "PDF" }, { canvasKit: ck });
    expect(file.warnings).toEqual([]);
    expect(parsePdf(file.bytes).text).toContain("/Filter /DCTDecode");
    expect(parsePdf(file.bytes).text).not.toContain("/FlateDecode");
    expect(file.bytes.length).toBeLessThan(photo.length + 2000);
  });

  it("doesn't decode images too big for a PDF, from their header", () => {
    // A PNG header claiming 20,000 × 10 pixels.
    const png = new Uint8Array(33);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    png.set([0, 0, 0x4e, 0x20, 0, 0, 0, 10], 16);
    const { doc, ids } = build((add, p) => ({ r: add("RECTANGLE", p, { width: 10, height: 10 }) }));
    // Documents refuse such images (addImage), but a file can still hold one: hand it to the writer directly.
    const hash = "a".repeat(64);
    doc.transact("Image", (tx) => tx.set(ids.r, "fills", [{ type: "IMAGE", visible: true, imageHash: hash, scaleMode: "FILL" }]));
    const source = { get: (id: string) => doc.get(id), children: (id: string) => doc.children(id), image: (h: string) => (h === hash ? png : undefined) };
    let decoded = 0;
    const warnings: string[] = [];
    writePdf(source, [exportScene(source, ids.r, {})], { decodeImage: () => (decoded++, null), warn: (m) => warnings.push(m) });
    expect(decoded).toBe(0);
    expect(warnings).toEqual(["Images larger than 16,384 px on a side or 64 million pixels can't go into a PDF yet, so some were left out."]);
  });

  it("writes at most 10,000 image tiles per page, not per paint (QC7 #11)", async () => {
    const tile = jpeg(8, 8, () => [255, 0, 0]);
    const { doc, ids } = build((add, p) => {
      const g = add("GROUP", p, {});
      add("RECTANGLE", g, { width: 800, height: 800 });
      add("RECTANGLE", g, { x: 900, width: 800, height: 800 });
      return { g };
    });
    const hash = doc.addImage(tile);
    for (const n of doc.children(ids.g)) doc.transact("Image", (tx) => tx.set(n.id, "fills", [{ type: "IMAGE", visible: true, imageHash: hash, scaleMode: "TILE", scalingFactor: 1 } as Paint]));
    const file = await exportNode(doc, ids.g, { format: "PDF" });
    const content = new TextDecoder("latin1").decode(file.bytes);
    expect(content.match(/\/Im0 Do/g)).toHaveLength(10_000); // 2 × 100 × 100 asked for
    expect(file.warnings).toEqual(["Images tile more than 10,000 times on one page, so only the first 10,000 tiles were written."]);
  });
});

describe("Miter joins and square caps in export bounds (QC7 #2)", () => {
  it("reaches the miter tips of a polygon, in every format", async () => {
    const { doc, ids } = build((add, p) => ({ t: add("POLYGON", p, { width: 100, height: 100, fills: solid(RED), strokes: solid(BLUE), strokeWeight: 20, opacity: 0.5 }) }));
    // An equilateral triangle: 60° corners take miters 2 × the half weight (20) along their bisectors.
    const { region } = exportScene(doc, ids.t, {});
    expect(region.y).toBeCloseTo(-20, 6); // the apex (50, 0), 20 above (was 10: cut)
    expect(region.x).toBeCloseTo(6.6987 - 20 * Math.cos(Math.PI / 6), 3);
    expect(region.y + region.height).toBeCloseTo(75 + 10, 6);
    const png = decode(ck, (await exportNode(doc, ids.t, { format: "PNG", constraint: { type: "SCALE", value: 2 } }, { canvasKit: ck })).bytes);
    // The tip reaches the top edge.
    expect(png.at(Math.round((50 - region.x) * 2), 4)[3]).toBeGreaterThan(0);
    // The PDF's group box holds it too.
    const pdf = parsePdf((await exportNode(doc, ids.t, { format: "PDF" })).bytes);
    expect(pdf.text).toMatch(/\/BBox \[-11\.\d+ -21 /);
    // And the SVG's filter region, with a shadow.
    doc.transact("Shadow", (tx) => tx.set(ids.t, "effects", [shadow({ radius: 0, offset: { x: 0, y: 0 } })]));
    const svg = svgOf((await exportNode(doc, ids.t, { format: "SVG" })).bytes);
    expect(svg).toMatch(/<filter id="[^"]+" x="-12\.\d+" y="-22" /);
  });

  it("reaches √2 × half past open ends with square caps, and the weight with outside strokes", () => {
    const { doc, ids } = build((add, p) => ({
      v: add("STAR", p, { width: 100, height: 100, strokes: solid(BLUE), strokeWeight: 4, strokeAlign: "OUTSIDE", strokeJoin: "MITER" }),
      b: add("STAR", p, { x: 200, width: 100, height: 100, strokes: solid(BLUE), strokeWeight: 4, strokeAlign: "OUTSIDE", strokeJoin: "BEVEL" }),
    }));
    const miter = exportScene(doc, ids.v, {}).region;
    const bevel = exportScene(doc, ids.b, {}).region;
    // The outside stroke's miter at the star's top point goes further than its bevel (which reaches the weight).
    expect(miter.y).toBeLessThan(bevel.y - 1);
    expect(bevel.y).toBeCloseTo(-4, 6);
  });
});

describe("SVG grouping (QC7 #3, #4, #8) and shadows (QC7 extra)", () => {
  it("never puts a filter on the element a stroke's mask or clip is on", async () => {
    const { doc, ids } = build((add, p) => ({
      o: add("RECTANGLE", p, { width: 40, height: 40, strokes: solid(BLUE), strokeWeight: 4, strokeAlign: "OUTSIDE", effects: [shadow()], opacity: 0.5 }),
    }));
    const svg = svgOf((await exportNode(doc, ids.o, { format: "SVG" })).bytes);
    expect(svg).toMatch(/<g transform="translate\(10 6\)" opacity="0.5" filter="url\(#[^)]+\)">\n<rect width="40" height="40" stroke="#0000FF" stroke-width="8" mask="url\(#[^)]+\)"\/>\n<\/g>/);
    for (const tag of svg.match(/<[^>]+>/g) ?? []) expect(tag.includes("filter=") && (tag.includes("mask=") || tag.includes("clip-path="))).toBe(false);
  });

  it("keeps a layer's blend mode apart from its paint's", async () => {
    const { doc, ids } = build((add, p) => ({ r: add("RECTANGLE", p, { width: 10, height: 10, blendMode: "MULTIPLY", fills: [{ type: "SOLID", visible: true, color: RED, blendMode: "SCREEN" }] }) }));
    const svg = svgOf((await exportNode(doc, ids.r, { format: "SVG" })).bytes);
    expect(svg).toContain(`<g style="mix-blend-mode: multiply">\n<rect width="10" height="10" fill="#FF0000" style="mix-blend-mode: screen"/>\n</g>`);
  });

  it("isolates a NORMAL group whose children blend, in SVG and PDF; not a pass-through one", async () => {
    const { doc, ids } = build((add, p) => {
      const normal = add("GROUP", p, { blendMode: "NORMAL" });
      add("RECTANGLE", normal, { width: 10, height: 10, fills: solid(RED), blendMode: "MULTIPLY" });
      const pass = add("GROUP", p, { x: 50, blendMode: "PASS_THROUGH" });
      add("RECTANGLE", pass, { width: 10, height: 10, fills: solid(RED), blendMode: "MULTIPLY" });
      return { normal, pass };
    });
    expect(svgOf((await exportNode(doc, ids.normal, { format: "SVG" })).bytes)).toContain(`<g style="isolation: isolate">`);
    expect(svgOf((await exportNode(doc, ids.pass, { format: "SVG" })).bytes)).not.toContain("isolation");
    const pdf = parsePdf((await exportNode(doc, ids.normal, { format: "PDF" })).bytes);
    expect(pdf.text).toContain("/Group << /S /Transparency /I true >>");
    expect(streamOf(pdf.objects, CONTENTS)).toMatch(/\/Fm\d+ Do/);
    expect(pdf.text.match(/\/Subtype \/Form/g)).toHaveLength(2); // the group, and the child for its blend mode
    expect(parsePdf((await exportNode(doc, ids.pass, { format: "PDF" })).bytes).text.match(/\/Subtype \/Form/g)).toHaveLength(1);
  });

  it("casts a translucent shape's shadows from its outline, as the renderer does", async () => {
    const { doc, ids } = build((add, p) => ({
      half: add("RECTANGLE", p, { width: 40, height: 40, fills: solid({ r: 1, g: 0, b: 0, a: 0.5 }), effects: [shadow(), { type: "INNER_SHADOW", color: { r: 0, g: 0, b: 0, a: 1 }, offset: { x: 0, y: 2 }, radius: 2, visible: true } as Effect] }),
      solid: add("RECTANGLE", p, { x: 100, width: 40, height: 40, fills: solid(RED), effects: [shadow()] }),
    }));
    const svg = svgOf((await exportNode(doc, ids.half, { format: "SVG" })).bytes);
    expect(svg).toContain(`<feComponentTransfer in="SourceAlpha" result="silhouette"><feFuncA type="linear" slope="2"/></feComponentTransfer>`);
    expect(svg).toContain(`<feOffset in="silhouette" dx="0" dy="4"/>`);
    expect(svg).toContain(`<feComponentTransfer in="silhouette" result="inner0_outside">`);
    expect(svgOf((await exportNode(doc, ids.solid, { format: "SVG" })).bytes)).not.toContain("silhouette");
  });
});

describe("SVG ids and tiles (QC7 #11, #12)", () => {
  it("prefixes generated ids with a fingerprint of the export, so inlined exports don't clash", async () => {
    const grad = { type: "GRADIENT_LINEAR", visible: true, gradientStops: [{ position: 0, color: RED }, { position: 1, color: BLUE }], gradientTransform: [[1, 0, 0], [0, 1, 0]] } as Paint;
    const { doc, ids } = build((add, p) => ({
      a: add("RECTANGLE", p, { width: 10, height: 10, fills: [grad] }),
      b: add("RECTANGLE", p, { x: 20, width: 20, height: 10, fills: [grad] }),
    }));
    const a = svgOf((await exportNode(doc, ids.a, { format: "SVG" })).bytes);
    const b = svgOf((await exportNode(doc, ids.b, { format: "SVG" })).bytes);
    const idA = /<linearGradient id="([^"]+)"/.exec(a)?.[1] ?? "";
    const idB = /<linearGradient id="([^"]+)"/.exec(b)?.[1] ?? "";
    expect(idA).toMatch(new RegExp(`^i[0-9a-z]+_linear_${ids.a}$`));
    expect(idA).not.toBe(idB);
    expect(a).toContain(`fill="url(#${idA})"`);
    expect(a).not.toContain("\u0001");
    // Deterministic.
    expect(svgOf((await exportNode(doc, ids.a, { format: "SVG" })).bytes)).toBe(a);
  });

  it("enlarges image tiles too small to write, with a warning", async () => {
    const { doc, ids } = build((add, p) => ({ r: add("RECTANGLE", p, { width: 10, height: 10 }) }));
    const hash = doc.addImage(jpeg(20, 10, halves(20)));
    doc.transact("Image", (tx) => tx.set(ids.r, "fills", [{ type: "IMAGE", visible: true, imageHash: hash, scaleMode: "TILE", scalingFactor: 1e-9 } as Paint]));
    const file = await exportNode(doc, ids.r, { format: "SVG" });
    const svg = svgOf(file.bytes);
    expect(file.warnings).toEqual(["An image tiles too small to write to SVG, so its tiles were enlarged."]);
    expect(svg).toMatch(/<pattern id="[^"]+" patternUnits="userSpaceOnUse" width="0.0002" height="0.0001">/);
    expect(svg).toContain(`transform="matrix(0.00001 0 0 0.00001 0 0)"`);
  });
});

describe("PDF effects budget and blend modes (QC7 #6, #10)", () => {
  it("keeps the pixels drawn for effects within one budget per file, lowering the resolution, then leaving effects out", () => {
    const { doc, ids } = build((add, p) => {
      const out: Record<string, string> = {};
      for (let i = 0; i < 40; i++) out[`n${i}`] = add("RECTANGLE", p, { x: i * 3000, width: 2000, height: 2000, fills: solid(RED), effects: [{ type: "LAYER_BLUR", radius: 1000, visible: true } as Effect] });
      out.bg = add("RECTANGLE", p, { y: 5000, width: 10, height: 10, fills: solid(RED), effects: [{ type: "BACKGROUND_BLUR", radius: 10, visible: true } as Effect] });
      return out;
    });
    let pixels = 0;
    const asked: string[] = [];
    const warnings = new Set<string>();
    const rasterNode = (n: { id: string }, area: { width: number; height: number }, scale: number): RasterText => {
      asked.push(n.id);
      const width = Math.ceil(area.width * scale), height = Math.ceil(area.height * scale);
      pixels += width * height;
      return { width, height, rgba: new Uint8Array(width * height * 4), area };
    };
    const scenes = Object.values(ids).map((id) => exportScene(doc, id, {}));
    writePdf(doc, scenes, { rasterNode, warn: (m) => warnings.add(m) });
    expect(pixels).toBeLessThanOrEqual(8_000_000);
    expect(asked.length).toBeGreaterThan(0);
    expect(asked.length).toBeLessThan(40);
    expect(asked).not.toContain(ids.bg); // background blur alone isn't drawn into an image
    expect([...warnings]).toEqual(
      expect.arrayContaining([
        "This PDF has many large shadows and blurs, so they were drawn at a lower resolution.",
        "This PDF has too many large shadows and blurs to draw them all, so some were left out.",
        "Background blur needs what is behind the layer, which a PDF export doesn't have, so it was left out.",
      ]),
    );
  });

  it("keeps the blend mode of text and of layers drawn as images", async () => {
    const { doc, ids } = build((add, p) => ({
      t: add("TEXT", p, { width: 80, height: 20, characters: "Blend", fontSize: 16, fontFamily: "Inter", fills: solid(RED), blendMode: "MULTIPLY" }),
      r: add("RECTANGLE", p, { y: 50, width: 20, height: 20, fills: solid(RED), blendMode: "SCREEN", effects: [shadow()] }),
    }));
    const deps = { canvasKit: ck, fonts: interFonts() };
    for (const [id, mode] of [[ids.t, "Multiply"], [ids.r, "Screen"]] as const) {
      const pdf = parsePdf((await exportNode(doc, id, { format: "PDF" }, deps)).bytes);
      const state = new RegExp(`/(G\\d+) << /Type /ExtGState /BM /${mode} >>`).exec(pdf.text)?.[1];
      expect(state, mode).toBeDefined();
      expect(streamOf(pdf.objects, CONTENTS)).toMatch(new RegExp(`/${state} gs\\n(q\\n)?[^\\n]* cm\\n/Im0 Do`));
    }
  });
});

describe("Text bounds (QC7 #7)", () => {
  it("measures text when any fill shows, not only the first", async () => {
    const { doc, ids } = build((add, p) => ({
      t: add("TEXT", p, { width: 60, height: 20, characters: "Hi", fills: [...solid(BLUE, false), ...solid(RED)] }),
    }));
    expect(exportScene(doc, ids.t, {}).region).toEqual({ x: 0, y: 0, width: 60, height: 20 });
  });
});

describe("Batches with bad suffixes (QC7 #9)", () => {
  it("fails only the export whose suffix isn't text", async () => {
    const { doc, ids } = build((add, p) => ({ r: add("RECTANGLE", p, { name: "Box", width: 10, height: 10, fills: solid(RED) }) }));
    const requests = [
      { nodeId: ids.r, settings: { format: "SVG", suffix: 42 as unknown as string } as const },
      { nodeId: ids.r, settings: { format: "SVG" } as const },
    ];
    expect(planExportFilenames(doc, requests)).toEqual(["Box.svg", "Box-1.svg"]);
    const result = await exportNodes(doc, requests);
    expect(result.files.map((f) => f.filename)).toEqual(["Box-1.svg"]);
    expect(result.failures).toMatchObject([{ filename: "Box.svg", message: "The suffix must be text." }]);
    await expect(exportPdf(doc, [ids.r], {}, { suffix: 42 as unknown as string })).rejects.toThrow("The suffix must be text.");
  });
});

describe("File names (QC7 #13)", () => {
  it("renames every Windows device name, after the suffix and the cut", () => {
    expect(exportFilename("CONIN$", "PNG")).toBe("_CONIN$.png");
    expect(exportFilename("conout$", "PNG")).toBe("_conout$.png");
    expect(exportFilename("COM¹", "PNG")).toBe("_COM¹.png");
    expect(exportFilename("lpt³", "SVG")).toBe("_lpt³.svg");
    expect(exportFilename("CO", "PNG", "N")).toBe("_CON.png");
    expect(exportFilename(`CON${" ".repeat(300)}x`, "PNG")).toBe("_CON.png");
    expect(exportFilename("CON", "PNG", "-dark")).toBe("CON-dark.png");
    expect(sanitizeFilePart("nul")).toBe("_nul");
  });

  it("drops direction controls and unpaired surrogates", () => {
    expect(exportFilename("photo‮gnp.exe", "PNG")).toBe("photognp.exe.png");
    expect(exportFilename("a‎b‏c⁦d⁩", "PNG", "‪")).toBe("abcd.png");
    expect(exportFilename("\ud800abc\udc00", "PNG")).toBe("abc.png");
  });

  it("compares names without case or accent encoding, and keeps files and folders apart", () => {
    const taken = new Set<string>();
    expect(uniqueFilename("Café.png", taken)).toBe("Café.png");
    expect(uniqueFilename("CAFÉ.png", taken)).toBe("CAFÉ-1.png");
    // A folder can't share a file's path, nor the reverse.
    expect(uniqueFilename("Icon.png", taken)).toBe("Icon.png");
    expect(uniqueFilename("Icon.png/Arrow.png", taken)).toBe("Icon.png-1/Arrow.png");
    expect(uniqueFilename("Icons/Arrow.png", taken)).toBe("Icons/Arrow.png");
    expect(uniqueFilename("Icons", taken)).toBe("Icons-1");
    const { doc, ids } = build((add, p) => ({ a: add("RECTANGLE", p, { name: "Logo.png/Mark", fills: solid(RED) }) }));
    expect(planExportFilenames(doc, [{ nodeId: ids.a, settings: { format: "PNG" } }], ["logo.png"])).toEqual(["Logo.png-1/Mark.png"]);
  });

  it("cuts long names between whole graphemes", () => {
    const name = sanitizeFilePart("é".repeat(100)); // 3 bytes each
    expect(name).toBe("é".repeat(66));
  });
});
