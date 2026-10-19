// Export of the text fields (alignment, letter spacing, line height units,
// auto width): SVG anchors and spacing without fonts, line positions from the
// renderer with fonts, and PNG drawing the same aligned text as the canvas.
import { describe, expect, it } from "vitest";
import { exportNode } from "./index.js";
import { assertWellFormedXml, build, canvasKit, interFonts, RED, solid, withoutIdPrefix } from "./test.fixture.js";

const svgOf = async (...args: Parameters<typeof exportNode>) => {
  const file = await exportNode(...args);
  const text = new TextDecoder().decode(file.bytes);
  assertWellFormedXml(text);
  return withoutIdPrefix(text);
};

describe("text fields in export", () => {
  it("SVG without fonts: text-anchor for alignment, letter-spacing, vertical alignment and line height in percent", async () => {
    const { doc, ids } = build((add, p) => ({
      c: add("TEXT", p, { width: 100, height: 60, characters: "Hi", fontSize: 10, lineHeight: { value: 200, unit: "PERCENT" }, textAlignHorizontal: "CENTER", textAlignVertical: "BOTTOM", letterSpacing: { value: 10, unit: "PERCENT" }, fills: solid(RED) }),
      r: add("TEXT", p, { y: 100, width: 100, height: 20, characters: "Hi", fontSize: 10, textAlignHorizontal: "RIGHT", fills: solid(RED) }),
    }));
    const centred = await svgOf(doc, ids.c, { format: "SVG" });
    expect(centred).toContain(`letter-spacing="1"`);
    expect(centred).toContain(`text-anchor="middle"`);
    // A 20 px line at the bottom of a 60 px box: baseline 40 + (20 − 12.1) / 2 + 9.69.
    expect(centred).toContain(`<tspan x="50" y="53.6328">Hi</tspan>`);
    const right = await svgOf(doc, ids.r, { format: "SVG" });
    expect(right).toContain(`text-anchor="end"`);
    expect(right).toContain(`<tspan x="100"`);
  });

  it("SVG with fonts: lines sit where the renderer aligns them", async () => {
    const ck = await canvasKit();
    const { doc, ids } = build((add, p) => ({
      t: add("TEXT", p, { width: 200, height: 40, characters: "Hi", fontSize: 14, fontFamily: "Inter", textAlignHorizontal: "RIGHT", fills: solid(RED) }),
    }));
    const text = await svgOf(doc, ids.t, { format: "SVG" }, { canvasKit: ck, fonts: interFonts() });
    const x = Number(/<tspan x="([\d.]+)"/.exec(text)?.[1]);
    expect(x).toBeGreaterThan(170);
    expect(text).not.toContain("text-anchor");
  });

  it("PNG draws auto width text on one line, aligned like the canvas", async () => {
    const ck = await canvasKit();
    const { doc, ids } = build((add, p) => ({
      t: add("TEXT", p, { width: 54, height: 17, characters: "Hello you", fontSize: 12, fontFamily: "Inter", textAutoResize: "WIDTH_AND_HEIGHT", fills: solid(RED) }),
    }));
    const file = await exportNode(doc, ids.t, { format: "PNG", useAbsoluteBounds: true }, { canvasKit: ck, fonts: interFonts() });
    const img = ck.MakeImageFromEncoded(file.bytes);
    if (!img) throw new Error("not a PNG");
    const pixels = img.readPixels(0, 0, { width: img.width(), height: img.height(), colorType: ck.ColorType.RGBA_8888, alphaType: ck.AlphaType.Unpremul, colorSpace: ck.ColorSpace.SRGB }) as Uint8Array;
    // Ink only in the top line (a second line would draw below 17 px; the box is the image).
    let inked = 0;
    for (let i = 3; i < pixels.length; i += 4) if ((pixels[i] as number) > 0) inked++;
    expect(inked).toBeGreaterThan(50);
    expect(img.height()).toBe(17);
    img.delete();
  });
});

describe("fonts that aren't loaded (QC round 8)", () => {
  it("PNG and PDF say which font wasn't available and that Inter was used; SVG leaves it to the viewer", async () => {
    const ck = await canvasKit();
    const { doc, ids } = build((add, p) => ({
      f: add("FRAME", p, { width: 200, height: 80 }),
    }));
    const { doc: d2, ids: i2 } = build((add, p) => {
      const f = add("FRAME", p, { width: 200, height: 80 });
      add("TEXT", f, { width: 100, height: 20, characters: "Brand", fontFamily: "Brand Sans", fills: solid(RED) });
      add("TEXT", f, { y: 30, width: 100, height: 20, characters: "Plain", fontFamily: "Inter", fills: solid(RED) });
      return { f };
    });
    const deps = { canvasKit: ck, fonts: interFonts() };
    const png = await exportNode(d2, i2.f, { format: "PNG" }, deps);
    expect(png.warnings).toContain("Font “Brand Sans” isn't available to export, so Inter was used.");
    const pdf = await exportNode(d2, i2.f, { format: "PDF" }, deps);
    expect(pdf.warnings).toContain("Font “Brand Sans” isn't available to export, so Inter was used.");
    const svg = await exportNode(d2, i2.f, { format: "SVG" }, deps);
    expect(svg.warnings.some((w) => w.includes("Brand Sans"))).toBe(false);
    // With the font given (as the app sends fonts on this computer), no warning.
    const withBrand = await exportNode(d2, i2.f, { format: "PNG" }, { canvasKit: ck, fonts: [...interFonts(), { family: "Brand Sans", data: interFonts()[0]!.data }] });
    expect(withBrand.warnings.some((w) => w.includes("Brand Sans"))).toBe(false);
    const empty = await exportNode(doc, ids.f, { format: "PNG" }, deps);
    expect(empty.warnings).toEqual([]);
  });
});
