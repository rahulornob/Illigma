// The text engine: auto width measuring and drawing without wrapping,
// alignment, letter spacing and line height, truncation, and the caret,
// selection and hit-testing the editor uses. CanvasKit runs in Node.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { beforeAll, describe, expect, it } from "vitest";
import CanvasKitInit, { type CanvasKit } from "canvaskit-wasm";
import { TextEngine, type TextNode } from "./text.js";

let ck: CanvasKit;
let engine: TextEngine;
beforeAll(async () => {
  ck = await CanvasKitInit();
  const buf = readFileSync(createRequire(import.meta.url).resolve("@fontsource/inter/files/inter-latin-400-normal.woff2"));
  engine = new TextEngine(ck, [{ family: "Inter", data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer }]);
});

const node = (fields: Partial<TextNode>): TextNode => ({ characters: "Hello you", fontFamily: "Inter", fontSize: 12, width: 100, height: 100, ...fields });
const lines = (n: TextNode) => {
  const p = engine.place(n);
  if (!p) throw new Error("no fonts");
  const count = p.paragraph.getLineMetrics().length;
  p.paragraph.delete();
  return count;
};

describe("TextEngine", () => {
  it("measures auto width text on one line, and never wraps it when drawn at that width", () => {
    const size = engine.measure(node({ textAutoResize: "WIDTH_AND_HEIGHT" }));
    expect(size?.width).toBeGreaterThan(40);
    expect(size?.width).toBeLessThan(70);
    expect(size?.height).toBeGreaterThan(12);
    // Stored widths are rounded by layout; even a slightly smaller box must not wrap.
    for (const width of [size?.width ?? 0, Math.floor(size?.width ?? 0), 1]) expect(lines(node({ textAutoResize: "WIDTH_AND_HEIGHT", width }))).toBe(1);
  });

  it("wraps fixed and auto height text at the box's width; line breaks make lines", () => {
    expect(lines(node({ textAutoResize: "NONE", width: 40 }))).toBe(2);
    expect(lines(node({ textAutoResize: "HEIGHT", width: 40 }))).toBe(2);
    expect(lines(node({ characters: "a\nb\n", textAutoResize: "WIDTH_AND_HEIGHT" }))).toBe(3);
    const h1 = engine.measure(node({ characters: "x" }), 100)?.height ?? 0;
    const h3 = engine.measure(node({ characters: "x\ny\nz" }), 100)?.height ?? 0;
    expect(h3).toBeCloseTo(h1 * 3, 0);
  });

  it("empty text is one line high", () => {
    const empty = engine.measure(node({ characters: "" }));
    const one = engine.measure(node({ characters: "x" }));
    expect(empty?.height).toBeCloseTo(one?.height ?? 0, 5);
    expect(empty?.width).toBe(1);
  });

  it("letter spacing and line height change the measured size", () => {
    const plain = engine.measure(node({}))?.width ?? 0;
    expect(engine.measure(node({ letterSpacing: { value: 2, unit: "PIXELS" } }))?.width).toBeCloseTo(plain + 2 * 9, 0);
    expect(engine.measure(node({ letterSpacing: { value: 50, unit: "PERCENT" } }))?.width).toBeCloseTo(plain + 6 * 9, 0);
    expect(engine.measure(node({ lineHeight: { value: 40, unit: "PIXELS" } }))?.height).toBeCloseTo(40, 0);
    expect(engine.measure(node({ lineHeight: { value: 200, unit: "PERCENT" } }))?.height).toBeCloseTo(24, 0);
    expect(engine.measure(node({ lineHeight: 30 }))?.height).toBeCloseTo(30, 0);
  });

  it("aligns lines horizontally and the paragraph vertically in its box", () => {
    const at = (fields: Partial<TextNode>) => {
      const l = engine.layout(node({ width: 200, height: 100, ...fields }));
      const first = l?.lines[0];
      l?.dispose();
      return first as { left: number; width: number; top: number; bottom: number };
    };
    const left = at({});
    const center = at({ textAlignHorizontal: "CENTER" });
    const right = at({ textAlignHorizontal: "RIGHT" });
    expect(left.left).toBeCloseTo(0, 1);
    expect(center.left).toBeCloseTo((200 - center.width) / 2, 0);
    expect(right.left + right.width).toBeCloseTo(200, 0);
    expect(at({ textAlignVertical: "BOTTOM" }).bottom).toBeCloseTo(100, 0);
    expect((at({ textAlignVertical: "CENTER" }).top + at({ textAlignVertical: "CENTER" }).bottom) / 2).toBeCloseTo(50, 0);
    // Auto width text that is narrower than its box keeps its alignment inside the box.
    const auto = at({ textAutoResize: "WIDTH_AND_HEIGHT", textAlignHorizontal: "RIGHT" });
    expect(auto.left + auto.width).toBeCloseTo(200, 0);
  });

  it("truncates with an ellipsis to the lines that fit", () => {
    const n = node({ characters: "one two three four five six", width: 30, height: 20, textAutoResize: "TRUNCATE" });
    expect(lines(n)).toBe(1);
  });

  it("caret positions, line metrics and hit-testing round-trip", () => {
    const l = engine.layout(node({ characters: "ab cd\nef", width: 200 }));
    if (!l) throw new Error("no layout");
    expect(l.lines.map((x) => [x.start, x.end, x.hard])).toEqual([
      [0, 5, true],
      [6, 8, false],
    ]);
    const xs = [0, 1, 2, 3, 4, 5].map((i) => l.caret(i).x);
    for (let i = 1; i < xs.length; i++) expect(xs[i] as number).toBeGreaterThan(xs[i - 1] as number);
    expect(l.caret(6).y).toBeGreaterThan(l.caret(5).y);
    for (const i of [0, 2, 5, 6, 8]) {
      const c = l.caret(i);
      expect(l.indexAt(c.x + 0.1, c.y + c.height / 2)).toBe(i);
    }
    // Past the end of a line: its end, not the next line's start.
    expect(l.indexAt(190, l.caret(0).y + 2)).toBe(5);
    expect(l.rangeRects(1, 7).length).toBeGreaterThanOrEqual(2);
    expect(l.before(6)).toBe(5);
    expect(l.after(5)).toBe(6);
    l.dispose();
  });

  it("a trailing line break gives an empty last line the caret can sit on", () => {
    const l = engine.layout(node({ characters: "ab\n", width: 200 }));
    if (!l) throw new Error("no layout");
    expect(l.lines).toHaveLength(2);
    expect(l.lines[1]?.start).toBe(3);
    expect(l.lineAt(3)).toBe(1);
    expect(l.lineAt(2)).toBe(0);
    expect(l.caret(3).y).toBeGreaterThan(l.caret(2).y);
    l.dispose();
  });

  it("emoji and combined letters move as one grapheme", () => {
    const l = engine.layout(node({ characters: "a😀b", width: 200 }));
    if (!l) throw new Error("no layout");
    expect(l.after(1)).toBe(3);
    expect(l.before(3)).toBe(1);
    l.dispose();
  });

  it("fonts added later are listed with their styles and reach listeners", () => {
    const e = new TextEngine(ck, []);
    expect(e.hasFonts).toBe(false);
    expect(e.measure(node({}))).toBeNull();
    let heard = 0;
    e.subscribe(() => heard++);
    const buf = readFileSync(createRequire(import.meta.url).resolve("@fontsource/inter/files/inter-latin-400-normal.woff2"));
    e.addFonts([{ family: "Local", data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, styles: ["Bold Italic", "Regular", "Bold"] }]);
    expect(heard).toBe(1);
    expect(e.families()).toEqual(["Local"]);
    expect(e.styles("Local")).toEqual(["Regular", "Bold", "Bold Italic"]);
    e.dispose();
  });
});

describe("TextEngine with out-of-range values and missing fonts (QC round 8)", () => {
  it("clamps a font size or line height a file can't hold, and never measures a size that isn't finite", () => {
    const huge = engine.measure(node({ fontSize: 1e300, textAutoResize: "WIDTH_AND_HEIGHT" }));
    expect(huge && Number.isFinite(huge.width) && Number.isFinite(huge.height)).toBe(true);
    const zero = engine.measure(node({ fontSize: 0, textAutoResize: "WIDTH_AND_HEIGHT" }));
    expect(zero).toEqual(engine.measure(node({ fontSize: 12, textAutoResize: "WIDTH_AND_HEIGHT" })));
    const tall = engine.measure(node({ lineHeight: 1e300, textAutoResize: "WIDTH_AND_HEIGHT" }));
    expect(tall && Number.isFinite(tall.height)).toBe(true);
    expect(engine.measure(node({}), Number.NaN)).toBeNull();
    // Text in a family that isn't registered isn't measured in the fallback: its stored size stays.
    expect(engine.measure(node({ fontFamily: "Not Installed", textAutoResize: "WIDTH_AND_HEIGHT" }))).toBeNull();
    expect(engine.measure(node({ fontFamily: undefined, textAutoResize: "WIDTH_AND_HEIGHT" }))).not.toBeNull();
    expect(engine.measure(node({}), Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("a variable font's weights (QC round 8)", () => {
  it("Thin, Regular and Black of the variable Inter draw and measure differently, Black as the static Black does", () => {
    const load = (file: string) => {
      const b = readFileSync(createRequire(import.meta.url).resolve(file));
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
    };
    const styles = ["Thin", "Regular", "Black"];
    const variable = new TextEngine(ck, [{ family: "Inter", data: load("@fontsource-variable/inter/files/inter-latin-wght-normal.woff2"), styles }]);
    const staticBlack = new TextEngine(ck, [{ family: "Inter", data: load("@fontsource/inter/files/inter-latin-900-normal.woff2"), styles: ["Black"] }]);
    const n = (fontStyle: string): TextNode => ({ characters: "Hamb", fontFamily: "Inter", fontStyle, fontSize: 120, textAutoResize: "WIDTH_AND_HEIGHT", width: 1, height: 1 });
    const ink = (e: TextEngine, style: string) => {
      const placed = e.place(n(style));
      if (!placed) throw new Error("no fonts");
      const surface = ck.MakeSurface(500, 200);
      if (!surface) throw new Error("no surface");
      surface.getCanvas().clear(ck.WHITE);
      surface.getCanvas().drawParagraph(placed.paragraph, 0, 0);
      const px = surface.getCanvas().readPixels(0, 0, { width: 500, height: 200, colorType: ck.ColorType.RGBA_8888, alphaType: ck.AlphaType.Unpremul, colorSpace: ck.ColorSpace.SRGB }) as Uint8Array;
      placed.paragraph.delete();
      surface.delete();
      let sum = 0;
      for (let i = 0; i < px.length; i += 4) sum += 255 - (px[i] as number);
      return sum;
    };
    const widths = styles.map((s) => variable.measure(n(s))?.width ?? 0);
    expect(widths[0]).toBeLessThan(widths[1] as number);
    expect(widths[1]).toBeLessThan(widths[2] as number);
    const inks = styles.map((s) => ink(variable, s));
    expect(inks[0]).toBeLessThan((inks[1] as number) * 0.5);
    expect(inks[2]).toBeGreaterThan((inks[1] as number) * 1.5);
    // The true Black, not Regular made bold: the same widths and pixels as the static Black file.
    expect(variable.measure(n("Black"))).toEqual(staticBlack.measure(n("Black")));
    expect(Math.abs(ink(variable, "Black") - ink(staticBlack, "Black"))).toBeLessThan(inks[2]! * 0.01);
    variable.dispose();
    staticBlack.dispose();
  });
});
