import { describe, expect, it } from "vitest";
import { exportNodes } from "./index.js";
import { BLUE, build, canvasKit, decode, RED, solid } from "./test.fixture.js";

describe("exportNodes", () => {
  it("exports every layer and setting, naming files as Figma does without replacing any", async () => {
    const ck = await canvasKit();
    const { doc, ids } = build((add, p) => ({
      a: add("RECTANGLE", p, { name: "Icons/Arrow", width: 16, height: 16, fills: solid(RED) }),
      b: add("RECTANGLE", p, { name: "Icons/Arrow", x: 20, width: 16, height: 16, fills: solid(BLUE) }),
      c: add("ELLIPSE", p, { name: "Logo", x: 40, width: 32, height: 32, fills: solid(BLUE) }),
    }));
    const progress: string[] = [];
    const result = await exportNodes(
      doc,
      [
        { nodeId: ids.a, settings: { format: "PNG" } },
        { nodeId: ids.a, settings: { format: "PNG", suffix: "@2x", constraint: { type: "SCALE", value: 2 } } },
        { nodeId: ids.b, settings: { format: "PNG" } },
        { nodeId: ids.c, settings: { format: "SVG" } },
        { nodeId: ids.c, settings: { format: "PDF" } },
        { nodeId: ids.c, settings: { format: "JPG", constraint: { type: "WIDTH", value: 64 } } },
      ],
      { canvasKit: ck },
      { taken: ["Logo.svg"], onProgress: (done, total) => progress.push(`${done}/${total}`) },
    );
    expect(result.failures).toEqual([]);
    expect(result.files.map((f) => [f.filename, f.mime, f.width, f.height])).toEqual([
      ["Icons/Arrow.png", "image/png", 16, 16],
      ["Icons/Arrow@2x.png", "image/png", 32, 32],
      ["Icons/Arrow-1.png", "image/png", 16, 16],
      ["Logo-1.svg", "image/svg+xml", 32, 32],
      ["Logo.pdf", "application/pdf", 32, 32],
      ["Logo.jpg", "image/jpeg", 64, 64],
    ]);
    expect(progress).toEqual(["1/6", "2/6", "3/6", "4/6", "5/6", "6/6"]);
    // The second "Icons/Arrow" is the blue one.
    const blue = decode(ck, result.files[2]?.bytes as Uint8Array).at(8, 8);
    expect(blue[2]).toBeGreaterThan(200);
  });

  it("keeps going when some fail, and says which and why", async () => {
    const { doc, ids } = build((add, p) => ({
      ok: add("RECTANGLE", p, { name: "Fine", width: 10, height: 10, fills: solid(RED) }),
      hidden: add("RECTANGLE", p, { name: "Ghost", visible: false, width: 10, height: 10, fills: solid(RED) }),
      huge: add("RECTANGLE", p, { name: "Huge", width: 10_000, height: 10, fills: solid(RED) }),
    }));
    const ck = await canvasKit();
    const result = await exportNodes(
      doc,
      [
        { nodeId: ids.hidden, settings: { format: "SVG" } },
        { nodeId: ids.ok, settings: { format: "SVG" } },
        { nodeId: ids.huge, settings: { format: "PNG", constraint: { type: "SCALE", value: 2 } } },
        { nodeId: ids.ok, settings: { format: "PNG" } },
      ],
      { canvasKit: ck },
    );
    expect(result.files.map((f) => f.filename)).toEqual(["Fine.svg", "Fine.png"]);
    expect(result.failures).toEqual([
      { nodeId: ids.hidden, settings: { format: "SVG" }, filename: "Ghost.svg", message: "“Ghost” is hidden, so there is nothing to export. Show the layer first." },
      {
        nodeId: ids.huge,
        settings: { format: "PNG", constraint: { type: "SCALE", value: 2 } },
        filename: "Huge.png",
        message: "“Huge” is too big to export at 2x: the image would be 20,000 × 20 px, and the most an export can be is 16,384 px on each side. Try a smaller scale.",
      },
    ]);
  });
});
