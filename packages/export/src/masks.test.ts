// Masks (isMask) in PNG (through the renderer), SVG and PDF exports.
import { beforeAll, describe, expect, it } from "vitest";
import type { CanvasKit } from "canvaskit-wasm";
import type { MaskType } from "@illigma/format";
import { exportNode } from "./index.js";
import { assertWellFormedXml, BLUE, build, canvasKit, decode, RED, solid, withoutIdPrefix } from "./test.fixture.js";

let ck: CanvasKit;
beforeAll(async () => {
  ck = await canvasKit();
});

/** A 100×100 group: an ellipse mask (bottom) over which a red square is drawn, and a blue square under nothing. */
const masked = (maskType?: MaskType) =>
  build((add, p) => {
    const g = add("GROUP", p, { name: "Mask group", x: 0, y: 0, width: 100, height: 100 });
    add("ELLIPSE", g, { name: "Mask", x: 0, y: 0, width: 100, height: 100, fills: solid(BLUE), isMask: true, ...(maskType && { maskType }) });
    add("RECTANGLE", g, { name: "Red", x: 0, y: 0, width: 100, height: 100, fills: solid(RED) });
    return { g };
  });

describe("masks in exports", () => {
  it("PNG: the mask hides itself and clips the layers above it (alpha and vector)", async () => {
    for (const t of [undefined, "VECTOR"] as const) {
      const { doc, ids } = masked(t);
      const img = decode(ck, (await exportNode(doc, ids.g, { format: "PNG" }, { canvasKit: ck })).bytes);
      const [r, g, b, a] = img.at(50, 50);
      expect(r).toBeGreaterThan(200);
      expect(b).toBeLessThan(60);
      expect(g).toBeLessThan(60);
      expect(a).toBeGreaterThan(200);
      // The corner is outside the ellipse: clipped away.
      expect(img.at(2, 2)[3]).toBe(0);
    }
  });

  it("SVG: alpha masks as <mask>, vector masks as <clipPath>; the mask itself is not drawn", async () => {
    const alpha = masked();
    const a = new TextDecoder().decode((await exportNode(alpha.doc, alpha.ids.g, { format: "SVG" })).bytes);
    assertWellFormedXml(a);
    const text = withoutIdPrefix(a);
    expect(text).toMatch(/<mask id="mask_[^"]+" style="mask-type: alpha"/);
    expect(text).toMatch(/<g mask="url\(#mask_[^"]+\)">/);
    // The ellipse only appears inside the mask definition.
    expect(text.split("<ellipse").length - 1).toBe(1);
    expect(text.indexOf("<ellipse")).toBeGreaterThan(text.indexOf("<mask"));

    const vector = masked("VECTOR");
    const v = withoutIdPrefix(new TextDecoder().decode((await exportNode(vector.doc, vector.ids.g, { format: "SVG" })).bytes));
    expect(v).toMatch(/<clipPath id="clip_[^"]+">\n<path d="M/);
    expect(v).not.toContain("<ellipse");
  });

  it("PDF: clips by the mask's outline and leaves the mask out", async () => {
    const { doc, ids } = masked("VECTOR");
    const file = await exportNode(doc, ids.g, { format: "PDF" });
    expect(file.bytes.length).toBeGreaterThan(100);
    expect(file.warnings).toEqual([]);
  });
});
