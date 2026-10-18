import { describe, expect, it } from "vitest";
import { vectorNetworkFromSvgPath } from "@illigma/format";
import { exportNode, writeSvg, exportScene, escapeAttr } from "./index.js";
import { assertWellFormedXml, BLUE, build, canvasKit, interFonts, RED, solid } from "./test.fixture.js";

const svgOf = async (...args: Parameters<typeof exportNode>) => {
  const file = await exportNode(...args);
  const text = new TextDecoder().decode(file.bytes);
  assertWellFormedXml(text);
  return { file, text };
};

describe("SVG export: golden files", () => {
  it("writes a frame with shapes, clipping, opacity and rotation", async () => {
    const { doc, ids } = build((add, p) => {
      const frame = add("FRAME", p, { name: "Card", x: 100, y: 50, width: 120, height: 80, cornerRadius: 8, fills: solid({ r: 1, g: 1, b: 1, a: 1 }), strokes: solid(BLUE), strokeWeight: 2 });
      add("RECTANGLE", frame, { name: "Box", x: 10, y: 10, width: 40, height: 20, fills: solid({ r: 1, g: 0, b: 0, a: 0.5 }), opacity: 0.8 });
      add("ELLIPSE", frame, { name: "Dot", x: 60, y: 10, width: 20, height: 10, rotation: 90, fills: solid(BLUE), strokes: solid(RED), strokeWeight: 1 });
      add("POLYGON", frame, { name: "Tri", x: 90, y: 40, width: 20, height: 20, fills: solid(RED) });
      add("LINE", frame, { name: "Rule", x: 10, y: 70, width: 100, height: 0, strokes: solid({ r: 0, g: 0, b: 0, a: 1 }), strokeWeight: 2, strokeCap: "ROUND" });
      add("RECTANGLE", frame, { name: "Hidden", visible: false, fills: solid(RED) });
      return { frame };
    });
    const { file, text } = await svgOf(doc, ids.frame, { format: "SVG" });
    expect(file).toMatchObject({ filename: "Card.svg", mime: "image/svg+xml", width: 122, height: 82, warnings: [] });
    expect(text).toBe(
      [
        `<svg width="122" height="82" viewBox="0 0 122 82" fill="none" xmlns="http://www.w3.org/2000/svg">`,
        `<g transform="translate(1 1)">`,
        `<rect width="120" height="80" rx="8" fill="#FFFFFF"/>`,
        `<rect width="120" height="80" rx="8" stroke="#0000FF" stroke-width="2"/>`,
        `<g clip-path="url(#clip_${ids.frame})">`,
        `<rect transform="translate(10 10)" opacity="0.8" width="40" height="20" fill="#FF0000" fill-opacity="0.5"/>`,
        `<g transform="translate(60 10) rotate(90)">`,
        `<ellipse cx="10" cy="5" rx="10" ry="5" fill="#0000FF"/>`,
        `<ellipse cx="10" cy="5" rx="10" ry="5" stroke="#FF0000" stroke-width="1"/>`,
        `</g>`,
        `<path transform="translate(90 40)" d="M10 0L18.6603 15L1.3397 15Z" fill="#FF0000"/>`,
        `<path transform="translate(10 70)" d="M0 0L100 0" stroke="#000000" stroke-width="2" stroke-linecap="round"/>`,
        `</g>`,
        `</g>`,
        `<defs>`,
        `<clipPath id="clip_${ids.frame}">`,
        `<rect width="120" height="80" rx="8"/>`,
        `</clipPath>`,
        `</defs>`,
        `</svg>`,
        ``,
      ].join("\n"),
    );
    // Deterministic.
    expect((await svgOf(doc, ids.frame, { format: "SVG" })).text).toBe(text);
  });

  it("writes vectors region by region with their winding rule, and strokes with joins", async () => {
    const ring = vectorNetworkFromSvgPath("M0 0 L20 0 L20 20 L0 20 Z M5 5 L15 5 L15 15 L5 15 Z", { windingRule: "EVENODD" });
    const open = vectorNetworkFromSvgPath("M0 0 L10 10 L20 0");
    const { doc, ids } = build((add, p) => ({
      ring: add("VECTOR", p, { name: "Ring", width: 20, height: 20, fills: solid(BLUE), vectorNetwork: ring }),
      open: add("VECTOR", p, { name: "Check", x: 50, width: 20, height: 10, strokes: solid(RED), strokeWeight: 2, strokeJoin: "BEVEL", strokeCap: "SQUARE", vectorNetwork: open }),
    }));
    expect((await svgOf(doc, ids.ring, { format: "SVG" })).text).toBe(
      [
        `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">`,
        `<path d="M0 0L20 0L20 20L0 20ZM5 5L15 5L15 15L5 15Z" fill-rule="evenodd" fill="#0000FF"/>`,
        `</svg>`,
        ``,
      ].join("\n"),
    );
    expect((await svgOf(doc, ids.open, { format: "SVG" })).text).toBe(
      [
        `<svg width="22" height="12" viewBox="0 0 22 12" fill="none" xmlns="http://www.w3.org/2000/svg">`,
        `<path transform="translate(1 1)" d="M0 0L10 10L20 0" stroke="#FF0000" stroke-width="2" stroke-linecap="square" stroke-linejoin="bevel"/>`,
        `</svg>`,
        ``,
      ].join("\n"),
    );
  });

  it("writes text as <text>, one <tspan> per line break without fonts", async () => {
    const { doc, ids } = build((add, p) => ({
      t: add("TEXT", p, { name: "Label", width: 100, height: 40, characters: "Hi & <bye>\nLine 2", fontSize: 10, lineHeight: 20, fontFamily: "Inter", fontStyle: "Semi Bold Italic", fills: solid(RED) }),
    }));
    const { file, text } = await svgOf(doc, ids.t, { format: "SVG" });
    expect(text).toBe(
      [
        `<svg width="100" height="40" viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg">`,
        `<text fill="#FF0000" xml:space="preserve" style="white-space: pre" font-family="Inter" font-size="10" font-weight="600" font-style="italic"><tspan x="0" y="13.6328">Hi &amp; &lt;bye&gt;</tspan><tspan x="0" y="33.6328">Line 2</tspan></text>`,
        `</svg>`,
        ``,
      ].join("\n"),
    );
    expect(file.warnings).toEqual(["Text is written one line per line break, without wrapping, because no fonts were loaded."]);
  });
});

describe("SVG export: options and safety", () => {
  it("adds layer names as unique, escaped ids when asked", async () => {
    const { doc, ids } = build((add, p) => {
      const g = add("GROUP", p, { name: 'Icons "set" <1>' });
      add("RECTANGLE", g, { name: "Dot", width: 10, height: 10, fills: solid(RED) });
      add("RECTANGLE", g, { name: "Dot", x: 20, width: 10, height: 10, fills: solid(RED) });
      add("RECTANGLE", g, { name: "Bell\u0007", x: 40, width: 10, height: 10, fills: solid(RED) });
      return { g };
    });
    const { text } = await svgOf(doc, ids.g, { format: "SVG", svgIdAttribute: true });
    expect(text).toContain(`<g id="Icons &quot;set&quot; &lt;1&gt;">`);
    expect(text).toContain(`<rect id="Dot" width="10" height="10" fill="#FF0000"/>`);
    expect(text).toContain(`<rect id="Dot_2" transform="translate(20 0)" width="10" height="10" fill="#FF0000"/>`);
    expect(text).toContain(`<rect id="Bell" transform="translate(40 0)"`);
    const plain = (await svgOf(doc, ids.g, { format: "SVG" })).text;
    expect(plain).not.toContain(" id=");
  });

  it("places a nested layer through its ancestors' rotation", async () => {
    const { doc, ids } = build((add, p) => {
      const outer = add("FRAME", p, { x: 100, y: 100, width: 200, height: 200, rotation: 90 });
      return { inner: add("RECTANGLE", outer, { x: 10, y: 20, width: 30, height: 40, fills: solid(RED) }) };
    });
    const { text } = await svgOf(doc, ids.inner, { format: "SVG" });
    // Region x 40…80, y 110…140; the rectangle's corner (10, 20) lands at page (80, 110), i.e. (40, 0) in the file.
    expect(text).toContain(`<svg width="40" height="30" viewBox="0 0 40 30"`);
    expect(text).toContain(`<rect transform="translate(40 0) rotate(90)" width="30" height="40" fill="#FF0000"/>`);
  });

  it("with contentsOnly off, includes what overlaps; layers outside are left out", async () => {
    const { doc, ids } = build((add, p) => ({
      a: add("RECTANGLE", p, { width: 100, height: 100, fills: solid(RED) }),
      b: add("ELLIPSE", p, { x: 50, y: 50, width: 100, height: 100, fills: solid(BLUE) }),
      c: add("RECTANGLE", p, { x: 900, width: 10, height: 10, fills: solid(BLUE) }),
    }));
    const { text } = await svgOf(doc, ids.a, { format: "SVG", contentsOnly: false });
    expect(text.match(/<(rect|ellipse)/g)).toEqual(["<rect", "<ellipse"]);
  });

  it("wraps text where the canvas does when fonts are given", async () => {
    const ck = await canvasKit();
    const { doc, ids } = build((add, p) => ({
      t: add("TEXT", p, { width: 60, height: 60, characters: "one two three four", fontSize: 14, fontFamily: "Inter", fills: solid(RED) }),
    }));
    const { file, text } = await svgOf(doc, ids.t, { format: "SVG", svgOutlineText: true }, { canvasKit: ck, fonts: interFonts() });
    const lines = [...text.matchAll(/<tspan x="([\d.]+)" y="([\d.]+)">([^<]*)<\/tspan>/g)];
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.map((l) => l[3]).join(" ")).toBe("one two three four");
    const ys = lines.map((l) => Number(l[2]));
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    expect(file.warnings).toEqual(["Outline text isn't available yet, so text is written as editable text and needs its font installed to look right."]);
  });

  it("stays well-formed whatever the names and text hold", () => {
    const nasty = ["]]>", "<!--", "&amp;", "\"'", "\u0000\u0001￿", "\uD800 lone", "emoji 😀", "\t\n\r", "</svg>"];
    const { doc, ids } = build((add, p) => {
      const g = add("FRAME", p, { name: nasty.join(" "), width: 100, height: 100, fills: solid(RED) });
      nasty.forEach((s, i) => add("TEXT", g, { name: s, y: i * 10, width: 100, height: 10, characters: s, fontFamily: s, fills: solid(BLUE) }));
      return { g };
    });
    const text = writeSvg(doc, exportScene(doc, ids.g, {}), { idAttribute: true });
    assertWellFormedXml(text);
    expect(text).toContain("emoji 😀");
    expect(escapeAttr("a\nb")).toBe("a&#10;b");
  });
});
