// QC round 7, tester findings: text past its box, round shadow spread in SVG, hidden layers in a PDF, file names, missing glyphs.
import { beforeAll, describe, expect, it } from "vitest";
import type { CanvasKit } from "canvaskit-wasm";
import type { Effect } from "@illigma/format";
import { exportNode, exportNodes, exportPdf, exportFilename, planExportFilenames, sanitizeFilePart, textLinesBounds, uniqueFilename } from "./index.js";
import { assertWellFormedXml, build, canvasKit, decode, interFonts, parsePdf, RED, solid, withoutIdPrefix } from "./test.fixture.js";

let ck: CanvasKit;
beforeAll(async () => {
  ck = await canvasKit();
});

const BLACK = { r: 0, g: 0, b: 0, a: 1 };
const svgOf = (bytes: Uint8Array) => {
  const text = new TextDecoder().decode(bytes);
  assertWellFormedXml(text);
  return withoutIdPrefix(text);
};
const mediaBoxes = (bytes: Uint8Array) => [...parsePdf(bytes).text.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map((m) => [Number(m[1]), Number(m[2])]);
const drop = (spread: number, extra: Partial<Effect> = {}): Effect => ({ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.5 }, offset: { x: 0, y: 4 }, radius: 8, spread, visible: true, ...extra }) as Effect;
const inner = (spread: number): Effect => ({ type: "INNER_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.8 }, offset: { x: 4, y: 6 }, radius: 6, spread, visible: true }) as Effect;
/** Characters written by code point, so the source shows what they are. */
const cp = (...points: number[]) => String.fromCodePoint(...points);

describe("text past its box (tester #1)", () => {
  const overflow = () =>
    build((add, p) => {
      const t = add("TEXT", p, { name: "Lines", width: 200, height: 40, characters: "line1\nline2\nline3", fontSize: 20, fontFamily: "Inter", fills: solid(BLACK) });
      const frame = add("FRAME", p, { name: "Card", x: 300, width: 200, height: 40 });
      add("TEXT", frame, { width: 200, height: 40, characters: "line1\nline2\nline3", fontSize: 20, fontFamily: "Inter", fills: solid(BLACK) });
      const group = add("GROUP", p, { name: "Faded", x: 600, opacity: 0.5 });
      add("TEXT", group, { width: 200, height: 40, characters: "line1\nline2\nline3", fontSize: 20, fontFamily: "Inter", fills: solid(BLACK) });
      return { t, frame, group };
    });

  it("exports all the lines, as the canvas draws them, in every format", async () => {
    const { doc, ids } = overflow();
    const deps = { canvasKit: ck, fonts: interFonts() };
    // Three lines of Inter at 20 px: 24 px apart, the last one's descent ending at 72.
    const png = await exportNode(doc, ids.t, { format: "PNG" }, deps);
    expect([png.width, png.height]).toEqual([200, 72]);
    const img = decode(ck, png.bytes);
    let inkBelowBox = 0;
    for (let y = 48; y < 72; y++) for (let x = 0; x < 200; x++) if ((img.at(x, y)[3] as number) > 128) inkBelowBox++;
    expect(inkBelowBox).toBeGreaterThan(50); // "line3" is there
    const svg = await exportNode(doc, ids.t, { format: "SVG" }, deps);
    expect(svg.width).toBe(200);
    expect(svg.height).toBeCloseTo(72, 0);
    expect(svgOf(svg.bytes)).toContain(">line3</tspan>");
    const pdf = await exportNode(doc, ids.t, { format: "PDF" }, deps);
    const [[w, h]] = mediaBoxes(pdf.bytes) as [[number, number]];
    expect(w).toBe(200);
    expect(h).toBeCloseTo(72, 0);
    // JPG and scale follow the same bounds.
    expect((await exportNode(doc, ids.t, { format: "JPG", constraint: { type: "SCALE", value: 2 } }, deps)).height).toBe(144);
  });

  it("keeps a clipping frame's clip, and a group's PDF form holds the whole text", async () => {
    const { doc, ids } = overflow();
    const deps = { canvasKit: ck, fonts: interFonts() };
    const frame = await exportNode(doc, ids.frame, { format: "PNG" }, deps);
    expect([frame.width, frame.height]).toEqual([200, 40]);
    const group = await exportNode(doc, ids.group, { format: "PDF" }, deps);
    expect(mediaBoxes(group.bytes)[0]?.[1]).toBeCloseTo(72, 0);
    const pdf = parsePdf(group.bytes);
    const bbox = /\/BBox \[([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)\]/.exec(pdf.text);
    expect(Number(bbox?.[4])).toBeGreaterThanOrEqual(72); // the form doesn't cut the text off at the box
  });

  it("uses the lines the SVG writes when no fonts are loaded", async () => {
    const { doc, ids } = overflow();
    const svg = await exportNode(doc, ids.t, { format: "SVG" });
    // Inter's metrics: three lines of 1.2109 em.
    expect(svg.height).toBeCloseTo(3 * 1.2109375 * 20, 2);
    // Without the text engine, PNG text is placeholder bars in the box.
    expect((await exportNode(doc, ids.t, { format: "PNG" }, { canvasKit: ck })).height).toBe(40);
  });

  it("measures lines past the box: below, above for tight line heights, and nothing for text that fits", () => {
    const { doc, ids } = build((add, p) => ({ t: add("TEXT", p, { width: 100, height: 100, characters: "a\nb", fontSize: 20, lineHeight: 10, fills: solid(BLACK) }) }));
    const n = doc.get(ids.t)!;
    expect(textLinesBounds(n, null)).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    expect(textLinesBounds(n, [{ text: "a", left: 0, baseline: 19.2 }, { text: "b", left: 0, baseline: 43.2 }])).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    // Line height 10 at 20 px: the glyphs rise above the top.
    const tight = textLinesBounds(n, [{ text: "a", left: 0, baseline: 8.6 }, { text: "b", left: 0, baseline: 18.6 }]);
    expect(tight.y).toBeCloseTo(8.6 - 0.96875 * 20, 3);
    expect(tight.y + tight.height).toBe(100);
    // Blank last lines draw nothing.
    const runOn = textLinesBounds(n, [{ text: "a", left: 0, baseline: 100 }, { text: "", left: 0, baseline: 200 }]);
    expect(runOn.height).toBeCloseTo(100 + 0.2421875 * 20, 3);
  });
});

describe("SVG shadow spread keeps the shape (tester #2)", () => {
  it("shrinks an ellipse's inner shadow hole as an ellipse, and grows its drop shadow as one", async () => {
    const { doc, ids } = build((add, p) => ({
      e: add("ELLIPSE", p, { width: 100, height: 100, fills: solid(RED), effects: [inner(10)] }),
      d: add("ELLIPSE", p, { x: 200, width: 100, height: 60, fills: solid(RED), effects: [drop(10)] }),
    }));
    const file = await exportNode(doc, ids.e, { format: "SVG" });
    const svg = svgOf(file.bytes);
    expect(file.warnings).toEqual([]);
    expect(svg).not.toContain("feMorphology");
    // The hole: the ellipse shrunk by 10, moved by the offset, cut out of a rectangle of shadow, clipped to the ellipse.
    expect(svg).toContain(`<g transform="translate(4 6)">\n<ellipse cx="50" cy="50" rx="40" ry="40" fill="black"/>\n</g>`);
    expect(svg).toMatch(/<clipPath id="shadow_clip_[^"]+">\n<ellipse cx="50" cy="50" rx="50" ry="50"\/>\n<\/clipPath>/);
    expect(svg).toMatch(/<g clip-path="url\(#shadow_clip_[^)]+\)">\n<g filter="url\(#shadow_blur_[^)]+\)" opacity="0.8">\n<rect [^>]+ fill="#000000" mask="url\(#shadow_hole_[^)]+\)"\/>/);
    expect(svg).toContain(`<feGaussianBlur stdDeviation="3"/>`);
    // Inner shadows go over the fill.
    expect(svg.indexOf(`fill="#FF0000"`)).toBeLessThan(svg.indexOf("clip-path=\"url(#shadow_clip"));
    const grown = svgOf((await exportNode(doc, ids.d, { format: "SVG" })).bytes);
    expect(grown).toContain(`<g transform="translate(0 4)" filter="url(#shadow_blur_`);
    expect(grown).toContain(`<ellipse cx="50" cy="30" rx="60" ry="40" fill="#000000"/>`);
    expect(grown).not.toContain("feMorphology");
  });

  it("grows rounded corners with the spread and keeps square ones square, as the renderer does", async () => {
    const { doc, ids } = build((add, p) => ({
      round: add("RECTANGLE", p, { width: 120, height: 80, cornerRadius: 20, fills: solid(RED), effects: [drop(8), inner(6)] }),
      square: add("RECTANGLE", p, { x: 200, width: 40, height: 40, fills: solid(RED), effects: [drop(-5)] }),
    }));
    const round = svgOf((await exportNode(doc, ids.round, { format: "SVG" })).bytes);
    expect(round).toContain(`<rect x="-8" y="-8" width="136" height="96" rx="28" fill="#000000"/>`);
    expect(round).toContain(`<rect x="6" y="6" width="108" height="68" rx="14" fill="black"/>`);
    // Drop shadow, fill, then inner shadow.
    expect(round.indexOf(`rx="28"`)).toBeLessThan(round.indexOf(`rx="20" fill="#FF0000"`));
    const square = svgOf((await exportNode(doc, ids.square, { format: "SVG" })).bytes);
    expect(square).toContain(`<rect x="5" y="5" width="30" height="30" fill="#000000"/>`);
  });

  it("grows paths by a mitred stroke of twice the spread, and shrinks them through a mask", async () => {
    const { doc, ids } = build((add, p) => ({
      grow: add("STAR", p, { width: 100, height: 100, pointCount: 5, fills: solid(RED), effects: [drop(6)] }),
      shrink: add("STAR", p, { x: 200, width: 100, height: 100, pointCount: 5, fills: solid(RED), effects: [drop(-4)] }),
      hole: add("POLYGON", p, { x: 400, width: 100, height: 100, pointCount: 6, fills: solid(RED), effects: [inner(5)] }),
    }));
    const grow = svgOf((await exportNode(doc, ids.grow, { format: "SVG" })).bytes);
    expect(grow).toMatch(/<path d="M50 0[^"]+" fill="#000000" stroke="#000000" stroke-width="12" stroke-miterlimit="4"\/>/);
    const shrink = svgOf((await exportNode(doc, ids.shrink, { format: "SVG" })).bytes);
    expect(shrink).toMatch(/<mask id="shadow_shrink_[^"]+" maskUnits="userSpaceOnUse"[^>]*>\n<path d="M50 0[^"]+" fill="white" stroke="black" stroke-width="8" stroke-miterlimit="4"\/>/);
    expect(shrink).toMatch(/<g mask="url\(#shadow_shrink_[^)]+\)">\n<path d="M50 0[^"]+" fill="#000000"\/>/);
    // An inner shadow's hole shrinks by a stroke in the mask's white.
    const hole = svgOf((await exportNode(doc, ids.hole, { format: "SVG" })).bytes);
    expect(hole).toMatch(/<path d="[^"]+" fill="black" stroke="white" stroke-width="10" stroke-miterlimit="4"\/>/);
  });

  it("keeps a see-through shape's drop shadow from under it, unless shown behind", async () => {
    const { doc, ids } = build((add, p) => ({
      a: add("ELLIPSE", p, { width: 50, height: 50, fills: solid({ r: 1, g: 0, b: 0, a: 0.5 }), effects: [drop(4)] }),
      b: add("ELLIPSE", p, { x: 100, width: 50, height: 50, fills: solid({ r: 1, g: 0, b: 0, a: 0.5 }), effects: [drop(4, { showShadowBehindNode: true })] }),
      c: add("ELLIPSE", p, { x: 200, width: 50, height: 50, fills: solid(RED), effects: [drop(4)] }),
    }));
    const a = svgOf((await exportNode(doc, ids.a, { format: "SVG" })).bytes);
    expect(a).toMatch(/<mask id="shadow_knockout_[^"]+"[^>]*>\n<rect [^>]+ fill="white"\/>\n<ellipse cx="25" cy="25" rx="25" ry="25" fill="black"\/>\n<\/mask>/);
    expect(a).toMatch(/<g mask="url\(#shadow_knockout_/);
    expect(svgOf((await exportNode(doc, ids.b, { format: "SVG" })).bytes)).not.toContain("knockout");
    expect(svgOf((await exportNode(doc, ids.c, { format: "SVG" })).bytes)).not.toContain("knockout");
  });

  it("casts from a centred stroke too, and leaves groups, text and one-sided strokes to the filter, with a warning", async () => {
    const { doc, ids } = build((add, p) => {
      const stroked = add("ELLIPSE", p, { width: 100, height: 100, fills: solid(RED), strokes: solid(BLACK), strokeWeight: 6, effects: [drop(6)] });
      const outside = add("ELLIPSE", p, { x: 200, width: 100, height: 100, fills: solid(RED), strokes: solid(BLACK), strokeWeight: 6, strokeAlign: "OUTSIDE", effects: [drop(6)] });
      const group = add("GROUP", p, { x: 400, effects: [drop(6)] });
      add("ELLIPSE", group, { width: 100, height: 100, fills: solid(RED) });
      return { stroked, outside, group };
    });
    const stroked = svgOf((await exportNode(doc, ids.stroked, { format: "SVG" })).bytes);
    expect(stroked).toContain(`<ellipse cx="50" cy="50" rx="56" ry="56" fill="#000000"/>`);
    expect(stroked).toContain(`<ellipse cx="50" cy="50" rx="50" ry="50" fill="none" stroke="#000000" stroke-width="18"/>`);
    for (const id of [ids.outside, ids.group]) {
      const file = await exportNode(doc, id, { format: "SVG" });
      expect(svgOf(file.bytes)).toContain(`<feMorphology in="`);
      expect(file.warnings).toEqual([
        "SVG filters grow shadows by their spread with square corners, so the spread shadows of groups, text and shapes with one-sided strokes are approximate.",
      ]);
    }
  });
});

describe("hidden layers in a PDF (tester #3)", () => {
  it("leaves hidden layers out with a warning, and fails only when every layer is hidden", async () => {
    const { doc, ids } = build((add, p) => ({
      a: add("RECTANGLE", p, { name: "A", width: 30, height: 20, fills: solid(RED) }),
      hidden: add("RECTANGLE", p, { name: "Secret", width: 50, height: 50, fills: solid(RED), visible: false }),
      b: add("RECTANGLE", p, { name: "B", width: 10, height: 40, fills: solid(RED) }),
    }));
    const file = await exportPdf(doc, [ids.hidden, ids.a, ids.b]);
    expect(parsePdf(file.bytes).pages).toBe(2);
    expect(mediaBoxes(file.bytes)).toEqual([[30, 20], [10, 40]]);
    expect(file.warnings).toEqual(["“Secret” is hidden, so it was left out of the PDF."]);
    // Named after the first layer it holds.
    expect(file.filename).toBe("A.pdf");
    expect(file.nodeId).toBe(ids.a);
    await expect(exportPdf(doc, [ids.hidden, ids.hidden])).rejects.toThrow("Every layer chosen is hidden");
    await expect(exportPdf(doc, [ids.hidden])).rejects.toThrow("“Secret” is hidden, so there is nothing to export.");
  });
});

describe("file names through every public path (tester #4)", () => {
  const RLO = cp(0x202e);
  const tricky = [`RTL ${RLO}gnp.exe`, `a${cp(0x200e)}b${cp(0x2067)}c${cp(0x2069)}${cp(0xfeff)}d${cp(0x2028)}e${cp(0x061c)}`, `COM${cp(0xb9)}`, `COM${cp(0xb2)}`, `COM${cp(0xb3)}`, `LPT${cp(0xb9)}`, `lpt${cp(0xb3)}`, "CON"];
  const expected = ["RTL gnp.exe", "abcde", `_COM${cp(0xb9)}`, `_COM${cp(0xb2)}`, `_COM${cp(0xb3)}`, `_LPT${cp(0xb9)}`, `_lpt${cp(0xb3)}`, "_CON"];

  it("drops direction overrides and reserves COM¹–³ and LPT¹–³ in exportNode, exportNodes, planExportFilenames and exportPdf", async () => {
    const { doc, ids } = build((add, p) => {
      const out: Record<string, string> = {};
      tricky.forEach((name, i) => (out[`n${i}`] = add("RECTANGLE", p, { name, width: 10, height: 10, fills: solid(RED) })));
      return out;
    });
    const nodeIds = tricky.map((_, i) => ids[`n${i}`] as string);
    for (let i = 0; i < tricky.length; i++) {
      expect((await exportNode(doc, nodeIds[i] as string, { format: "SVG" })).filename).toBe(`${expected[i]}.svg`);
      expect((await exportPdf(doc, [nodeIds[i] as string])).filename).toBe(`${expected[i]}.pdf`);
    }
    const requests = nodeIds.map((nodeId) => ({ nodeId, settings: { format: "SVG" as const } }));
    const planned = planExportFilenames(doc, requests);
    expect(planned).toEqual(expected.map((e) => `${e}.svg`));
    const batch = await exportNodes(doc, requests);
    expect(batch.files.map((f) => f.filename)).toEqual(planned);
    for (const name of planned) expect(name).not.toContain(RLO);
  });

  it("makes raw paths safe in uniqueFilename, and keeps exportFilename's names as they are", () => {
    const taken = new Set<string>();
    expect(uniqueFilename(`Icons/RTL ${RLO}gnp.exe.png`, taken)).toBe("Icons/RTL gnp.exe.png");
    expect(uniqueFilename(`COM${cp(0xb9)}.png`, taken)).toBe(`_COM${cp(0xb9)}.png`);
    expect(uniqueFilename("../lpt1/x:y.png", taken)).toBe("_lpt1/x_y.png");
    expect(uniqueFilename(" / ", taken)).toBe("Untitled");
    for (const name of [`photo${RLO}gnp.exe`, `COM${cp(0xb3)}`, "Icons/Arrow", "a".repeat(300), "😀".repeat(80)]) {
      const safe = exportFilename(name, "PNG", "@2x");
      expect(uniqueFilename(safe, new Set())).toBe(safe);
    }
    expect(sanitizeFilePart(`LPT${cp(0xb2)}`)).toBe(`_LPT${cp(0xb2)}`);
    expect(sanitizeFilePart(`x${RLO}y`)).toBe("xy");
  });

  it("reserves device names with spaces before the extension", () => {
    expect(exportFilename("CON", "PNG", " ")).toBe("_CON .png");
    expect(exportFilename(`COM${cp(0xb9)}`, "SVG", "  ")).toBe(`_COM${cp(0xb9)}  .svg`);
    expect(exportFilename("CONSOLE", "PNG", " ")).toBe("CONSOLE .png");
  });
});

describe("characters the fonts don't have (tester #5)", () => {
  it("warns, naming them, in PNG and PDF; not for text the fonts have, and not in SVG", async () => {
    const hebrew = cp(0x05e9, 0x05dc, 0x05d5, 0x05dd);
    const emoji = cp(0x1f600);
    const { doc, ids } = build((add, p) => ({
      mixed: add("TEXT", p, { name: "Mixed", width: 300, height: 30, characters: `Shalom ${hebrew} ${emoji}`, fontSize: 16, fontFamily: "Inter", fills: solid(BLACK) }),
      latin: add("TEXT", p, { name: "Latin", y: 50, width: 300, height: 30, characters: `Café ${cp(0x200d)}${cp(0xfe0f)} déjà vu`, fontSize: 16, fontFamily: "Inter", fills: solid(BLACK) }),
    }));
    const deps = { canvasKit: ck, fonts: interFonts() };
    const png = await exportNode(doc, ids.mixed, { format: "PNG" }, deps);
    const warning = png.warnings.find((w) => w.startsWith("The loaded fonts don't have"));
    expect(warning).toBe(`The loaded fonts don't have some of the text's characters (“${cp(0x05e9)}”, “${cp(0x05dc)}”, “${cp(0x05d5)}”, “${cp(0x05dd)}”, “${emoji}”), so they show as empty boxes. Load a font that has them.`);
    const pdf = await exportPdf(doc, [ids.latin, ids.mixed], deps);
    expect(pdf.warnings.some((w) => w.startsWith("The loaded fonts don't have"))).toBe(true);
    expect((await exportNode(doc, ids.latin, { format: "PNG" }, deps)).warnings).toEqual([]);
    expect((await exportNode(doc, ids.mixed, { format: "SVG" }, deps)).warnings).toEqual([]);
  });
});
