import { describe, expect, it } from "vitest";
import { unzlibSync } from "fflate";
import { vectorNetworkFromSvgPath } from "@illigma/format";
import { exportNode, exportPdf, pdfString } from "./index.js";
import { BLUE, build, canvasKit, interFonts, parsePdf, RED, solid, streamOf } from "./test.fixture.js";

/** Object numbers in a writePdf file: 1 catalog, 2 pages, 3 info, then per page: page, contents, resources. */
const PAGE = 4, CONTENTS = 5, RESOURCES = 6;

describe("PDF export", () => {
  it("writes a valid one-page file with vector paths (golden)", async () => {
    const { doc, ids } = build((add, p) => ({ r: add("RECTANGLE", p, { name: "Box", x: 10, y: 20, width: 100, height: 50, fills: solid(RED), strokes: solid(BLUE), strokeWeight: 2 }) }));
    const file = await exportNode(doc, ids.r, { format: "PDF" });
    expect(file).toMatchObject({ filename: "Box.pdf", mime: "application/pdf", width: 102, height: 52, warnings: [] });
    const pdf = parsePdf(file.bytes);
    expect(pdf.pages).toBe(1);
    expect(pdf.objects.get(1)).toBe("<< /Type /Catalog /Pages 2 0 R >>");
    expect(pdf.objects.get(2)).toBe("<< /Type /Pages /Kids [4 0 R] /Count 1 >>");
    expect(pdf.objects.get(3)).toBe("<< /Producer (Illigma) /Title (Box) >>");
    expect(pdf.objects.get(PAGE)).toBe("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 102 52] /Resources 6 0 R /Contents 5 0 R >>");
    expect(streamOf(pdf.objects, CONTENTS)).toBe(
      [
        "1 0 0 -1 0 52 cm",
        "1 0 0 1 -9 -19 cm",
        "q",
        "1 0 0 1 10 20 cm",
        "1 0 0 rg",
        "0 0 m 100 0 l 100 50 l 0 50 l h",
        "f",
        "0 0 1 RG",
        "2 w 0 J 0 j 4 M",
        "0 0 m 100 0 l 100 50 l 0 50 l h",
        "S",
        "Q",
      ].join("\n"),
    );
    expect(pdf.objects.get(RESOURCES)).toBe("<< /ExtGState <<  >> /XObject <<  >> >>");
    // Deterministic: no dates or ids.
    expect((await exportNode(doc, ids.r, { format: "PDF" })).bytes).toEqual(file.bytes);
  });

  it("uses transparency groups for layer opacity, alpha states for paints, clips frames and fills even-odd", async () => {
    const ring = vectorNetworkFromSvgPath("M0 0 L20 0 L20 20 L0 20 Z M5 5 L15 5 L15 15 L5 15 Z", { windingRule: "EVENODD" });
    const { doc, ids } = build((add, p) => {
      const frame = add("FRAME", p, { width: 100, height: 100, cornerRadius: 10, opacity: 0.5 });
      add("RECTANGLE", frame, { x: 50, y: 50, width: 100, height: 100, fills: solid({ r: 1, g: 0, b: 0, a: 0.25 }) });
      add("VECTOR", frame, { width: 20, height: 20, rotation: 30, fills: solid(BLUE), vectorNetwork: ring });
      return { frame };
    });
    const pdf = parsePdf((await exportNode(doc, ids.frame, { format: "PDF" })).bytes);
    const content = streamOf(pdf.objects, CONTENTS);
    expect(content).toBe("1 0 0 -1 0 100 cm\nq\n/G1 gs\n/Fm0 Do\nQ");
    const res = pdf.objects.get(RESOURCES) ?? "";
    // The children's state is made first, while writing the group.
    expect(res).toContain("/G0 << /Type /ExtGState /ca 0.25 >>");
    expect(res).toContain("/G1 << /Type /ExtGState /ca 0.5 /CA 0.5 >>");
    const formNum = Number(/\/Fm0 (\d+) 0 R/.exec(res)?.[1]);
    const formDict = pdf.objects.get(formNum) ?? "";
    expect(formDict).toContain("/Subtype /Form /BBox [-1 -1 101 101] /Group << /S /Transparency /I true >> /Resources 6 0 R");
    const form = streamOf(pdf.objects, formNum);
    // Rounded clip, then children: an alpha fill, a rotated even-odd vector.
    expect(form).toMatch(/^q\n10 0 m 90 0 l [^\n]* h W n\n/);
    expect(form).toContain("q\n/G0 gs\n1 0 0 rg\n0 0 m 100 0 l 100 100 l 0 100 l h\nf\nQ");
    expect(form).toContain("0.866 0.5 -0.5 0.866 0 0 cm");
    expect(form).toContain("\nf*");
  });

  it("puts one layer on each page in exportPdf", async () => {
    const { doc, ids } = build((add, p) => ({
      a: add("FRAME", p, { name: "Screen 1", width: 300, height: 200, fills: solid(RED) }),
      b: add("FRAME", p, { name: "Screen 2", x: 400, width: 100, height: 400, fills: solid(BLUE) }),
      c: add("ELLIPSE", p, { name: "Logo", x: 600, width: 50, height: 50, fills: solid(BLUE) }),
    }));
    const file = await exportPdf(doc, [ids.a, ids.b, ids.c]);
    expect(file.filename).toBe("Screen 1.pdf");
    const pdf = parsePdf(file.bytes);
    expect(pdf.pages).toBe(3);
    const boxes = [...pdf.text.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map((m) => `${m[1]}x${m[2]}`);
    expect(boxes).toEqual(["300x200", "100x400", "50x50"]);
    await expect(exportPdf(doc, [])).rejects.toThrow("Choose at least one layer");
  });

  it("embeds text as an image when fonts are given, and says so", async () => {
    const ck = await canvasKit();
    const { doc, ids } = build((add, p) => ({
      t: add("TEXT", p, { name: "Title", width: 120, height: 30, characters: "Hello PDF", fontSize: 20, fontFamily: "Inter", fills: solid({ r: 0, g: 0, b: 0, a: 1 }), opacity: 0.5 }),
    }));
    const file = await exportNode(doc, ids.t, { format: "PDF" }, { canvasKit: ck, fonts: interFonts() });
    expect(file.warnings).toEqual(["Text in the PDF is an image of the text, so it can't be selected or searched yet."]);
    const pdf = parsePdf(file.bytes);
    const content = streamOf(pdf.objects, CONTENTS);
    // Opacity is in the image; no transparency group.
    expect(content).not.toContain("/Fm0");
    expect(content).toMatch(/q\n120 0 0 -30 0 30 cm\n\/Im0 Do\nQ/);
    const imageNum = Number(/\/Im0 (\d+) 0 R/.exec(pdf.objects.get(RESOURCES) ?? "")?.[1]);
    const image = pdf.objects.get(imageNum) ?? "";
    expect(image).toMatch(/\/Subtype \/Image \/Width 480 \/Height 120 \/ColorSpace \/DeviceRGB \/BitsPerComponent 8 \/Filter \/FlateDecode \/SMask (\d+) 0 R/);
    // The soft mask holds the glyphs: some pixels opaque-ish (≈ 50%), most clear.
    const maskNum = Number(/\/SMask (\d+) 0 R/.exec(image)?.[1]);
    const raw = streamOf(pdf.objects, maskNum);
    const alpha = unzlibSync(Uint8Array.from(raw, (c) => c.charCodeAt(0)));
    expect(alpha.length).toBe(480 * 120);
    const inked = alpha.filter((a) => a > 100).length;
    expect(inked).toBeGreaterThan(1000);
    expect(Math.max(...alpha)).toBeLessThan(140);
  });

  it("leaves text out without a text engine, with a warning", async () => {
    const { doc, ids } = build((add, p) => {
      const f = add("FRAME", p, { width: 100, height: 40, fills: solid(BLUE) });
      add("TEXT", f, { width: 100, height: 20, characters: "Hi", fills: solid(RED) });
      return { f };
    });
    const file = await exportNode(doc, ids.f, { format: "PDF" });
    expect(file.warnings).toEqual(["Text was left out of the PDF: drawing text needs the drawing engine and fonts."]);
    expect(streamOf(parsePdf(file.bytes).objects, CONTENTS)).not.toContain("Do");
  });

  it("writes titles as PDF strings, escaped or as UTF-16", () => {
    expect(pdfString("Plain (1)\\")).toBe("(Plain \\(1\\)\\\\)");
    expect(pdfString("Café")).toBe("<FEFF0043006100660065>".replace("0065>", "00E9>"));
  });
});
