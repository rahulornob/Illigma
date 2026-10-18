// Pixel tests for gradients, images, blend modes, effects and stroke alignment, on a CPU surface (CanvasKit in Node).
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import CanvasKitInit, { type CanvasKit, type Surface } from "canvaskit-wasm";
import { Document } from "@illigma/core";
import type { BlendMode, Color, Effect, GradientType, Node, NodeId, NodeType, Paint, Transform } from "@illigma/format";
import { hitTest, PageRenderer, type Camera, type RendererOptions } from "./index.js";

type Fields = Partial<Omit<Node, "id" | "type" | "parentId" | "index">>;

const RED: Color = { r: 1, g: 0, b: 0, a: 1 };
const GREEN: Color = { r: 0, g: 1, b: 0, a: 1 };
const BLUE: Color = { r: 0, g: 0, b: 1, a: 1 };
const WHITE: Color = { r: 1, g: 1, b: 1, a: 1 };
const BLACK: Color = { r: 0, g: 0, b: 0, a: 1 };
const IDENTITY: Transform = [
  [1, 0, 0],
  [0, 1, 0],
];
const solid = (color: Color, extra: Partial<Extract<Paint, { type: "SOLID" }>> = {}): Paint => ({ type: "SOLID", visible: true, color, ...extra });
const gradient = (type: GradientType, transform: Transform = IDENTITY, stops: [number, Color][] = [[0, RED], [1, BLUE]]): Paint => ({
  type,
  visible: true,
  gradientStops: stops.map(([position, color]) => ({ position, color })),
  gradientTransform: transform,
});
const shadow = (type: "DROP_SHADOW" | "INNER_SHADOW", x: number, y: number, radius: number, extra: Partial<Effect> = {}): Effect =>
  ({ type, color: BLACK, offset: { x, y }, radius, visible: true, ...extra }) as Effect;
const AT_ORIGIN: Camera = { x: 0, y: 0, zoom: 1 };
/** The canvas behind everything: about (30, 30, 32). */
const BG = 30;
const INTER = fileURLToPath(new URL("../../../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2", import.meta.url));

let ck: CanvasKit;
beforeAll(async () => {
  ck = await CanvasKitInit();
});

function setup(build: (add: (type: NodeType, parent: NodeId, fields?: Fields) => NodeId, page: NodeId, doc: Document) => void, options: RendererOptions = {}) {
  const doc = new Document("Paints");
  let page = "";
  doc.transact("Build", (tx) => {
    page = tx.addPage("Page");
    build((type, parent, fields = {}) => tx.create(type, parent, fields), page, doc);
  });
  const surface = ck.MakeSurface(200, 200) as Surface;
  const renderer = new PageRenderer(ck, surface, doc, page, 1, options);
  /** RGB 0–255 of one pixel. */
  const pixel = (x: number, y: number): number[] => {
    const px = surface.getCanvas().readPixels(x, y, { width: 1, height: 1, colorType: ck.ColorType.RGBA_8888, alphaType: ck.AlphaType.Unpremul, colorSpace: ck.ColorSpace.SRGB });
    return Array.from(px as Uint8Array).slice(0, 3);
  };
  renderer.render(AT_ORIGIN);
  return { doc, page, renderer, pixel };
}

/** Each channel within `tol` of the expected value. */
function near(actual: number[], expected: number[], tol = 6): boolean {
  return actual.every((v, i) => Math.abs(v - (expected[i] as number)) <= tol);
}

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

describe("PageRenderer: gradients", () => {
  it("draws a linear gradient across the box, and follows its transform", () => {
    const { pixel } = setup((add, p) => {
      add("RECTANGLE", p, { width: 100, height: 100, fills: [gradient("GRADIENT_LINEAR")] });
      // Swapping x and y runs the gradient from top to bottom.
      add("RECTANGLE", p, { x: 100, width: 100, height: 100, fills: [gradient("GRADIENT_LINEAR", [[0, 1, 0], [1, 0, 0]])] });
    });
    expect(near(pixel(1, 50), [255, 0, 0], 8)).toBe(true);
    expect(near(pixel(98, 50), [0, 0, 255], 8)).toBe(true);
    const mid = pixel(50, 50);
    expect(mid[0]).toBeGreaterThan(100);
    expect(mid[2]).toBeGreaterThan(100);
    expect(near(pixel(150, 1), [255, 0, 0], 8)).toBe(true);
    expect(near(pixel(150, 98), [0, 0, 255], 8)).toBe(true);
    expect(near(pixel(101, 50), pixel(198, 50), 4)).toBe(true); // constant across
  });

  it("draws radial, angular and diamond gradients around the box's centre", () => {
    const { pixel } = setup((add, p) => {
      add("RECTANGLE", p, { width: 100, height: 100, fills: [gradient("GRADIENT_RADIAL")] });
      add("RECTANGLE", p, { x: 100, width: 100, height: 100, fills: [gradient("GRADIENT_ANGULAR")] });
      add("RECTANGLE", p, { y: 100, width: 100, height: 100, fills: [gradient("GRADIENT_DIAMOND")] });
    });
    // Radial: red at the centre, blue from a distance of 50 (the corners).
    expect(near(pixel(50, 50), [255, 0, 0], 12)).toBe(true);
    expect(near(pixel(2, 2), [0, 0, 255], 8)).toBe(true);
    expect(near(pixel(50, 2), [0, 0, 255], 20)).toBe(true);
    // Angular: starts at 3 o'clock and runs clockwise, so just below the start is red and just above it is blue.
    expect(pixel(190, 54)[0]).toBeGreaterThan(200);
    expect(pixel(190, 46)[2]).toBeGreaterThan(200);
    expect(near(pixel(150, 90), [191, 0, 64], 20)).toBe(true); // a quarter turn: 25% blue
    // Diamond: red at the centre, blue where |dx| + |dy| reaches 50; equal on the diagonal and the axis.
    expect(near(pixel(50, 150), [255, 0, 0], 12)).toBe(true);
    expect(near(pixel(76, 176), [0, 0, 255], 8)).toBe(true);
    expect(near(pixel(70, 150), pixel(60, 160), 8)).toBe(true);
  });

  it("applies paint opacity and per-paint blend modes", () => {
    const { pixel } = setup((add, p) => {
      add("RECTANGLE", p, { width: 50, height: 50, fills: [solid(RED, { opacity: 0.5 })] });
      // Yellow, then cyan multiplied over it: green.
      add("RECTANGLE", p, { x: 50, width: 50, height: 50, fills: [solid({ r: 1, g: 1, b: 0, a: 1 }), solid({ r: 0, g: 1, b: 1, a: 1 }, { blendMode: "MULTIPLY" })] });
      add("RECTANGLE", p, { x: 100, width: 50, height: 50, fills: [gradient("GRADIENT_LINEAR"), { ...gradient("GRADIENT_LINEAR"), visible: false }] });
      add("RECTANGLE", p, { x: 150, width: 50, height: 50, fills: [{ ...gradient("GRADIENT_LINEAR", IDENTITY, [[0, WHITE]]), opacity: 0.5 }] });
    });
    const [r] = pixel(25, 25);
    expect(r).toBeGreaterThan(130);
    expect(r).toBeLessThan(156);
    expect(near(pixel(75, 25), [0, 255, 0])).toBe(true);
    expect(near(pixel(101, 25), [255, 0, 0], 12)).toBe(true);
    expect(near(pixel(175, 25), [143, 143, 144], 8)).toBe(true); // one stop: a flat colour, at half opacity
  });

  it("skips a gradient whose transform can't be inverted", () => {
    const { pixel } = setup((add, p) => void add("RECTANGLE", p, { width: 50, height: 50, fills: [gradient("GRADIENT_LINEAR", [[0, 0, 0], [0, 0, 0]])] }));
    expect(near(pixel(25, 25), [BG, BG, BG + 2])).toBe(true);
  });
});

describe("PageRenderer: blend modes", () => {
  const over = (mode: BlendMode, under: Color, top: Color, x = 25) => {
    const { pixel } = setup((add, p) => {
      add("RECTANGLE", p, { width: 50, height: 50, fills: [solid(under)] });
      add("RECTANGLE", p, { width: 50, height: 50, fills: [solid(top)], blendMode: mode });
    });
    return pixel(x, 25);
  };

  it("blends a layer with what is under it", () => {
    expect(near(over("SCREEN", RED, GREEN), [255, 255, 0])).toBe(true);
    expect(near(over("MULTIPLY", { r: 1, g: 1, b: 0, a: 1 }, { r: 0, g: 1, b: 1, a: 1 }), [0, 255, 0])).toBe(true);
    expect(near(over("DIFFERENCE", RED, WHITE), [0, 255, 255])).toBe(true);
    expect(near(over("DARKEN", { r: 0.2, g: 0.8, b: 0.5, a: 1 }, { r: 0.6, g: 0.4, b: 0.5, a: 1 }), [51, 102, 128], 3)).toBe(true);
    expect(near(over("LIGHTEN", { r: 0.2, g: 0.8, b: 0.5, a: 1 }, { r: 0.6, g: 0.4, b: 0.5, a: 1 }), [153, 204, 128], 3)).toBe(true);
    expect(near(over("NORMAL", RED, GREEN), [0, 255, 0])).toBe(true);
    expect(near(over("PASS_THROUGH", RED, GREEN), [0, 255, 0])).toBe(true);
  });

  it("does linear burn and linear dodge", () => {
    const grey = (v: number): Color => ({ r: v, g: v, b: v, a: 1 });
    expect(near(over("LINEAR_BURN", grey(0.6), grey(0.6)), [51, 51, 51], 3)).toBe(true); // 0.6 + 0.6 − 1
    expect(near(over("LINEAR_DODGE", grey(0.3), grey(0.3)), [153, 153, 153], 3)).toBe(true); // 0.3 + 0.3
  });

  it("does the non-separable modes (hue, saturation, colour, luminosity)", () => {
    // Pure hue over grey keeps the grey's luminosity: not the top colour, not the bottom one.
    const color = over("COLOR", { r: 0.5, g: 0.5, b: 0.5, a: 1 }, RED);
    expect(color[0]).toBeGreaterThan(color[1] as number);
    expect(near(color, [255, 0, 0], 20)).toBe(false);
    const lum = over("LUMINOSITY", RED, { r: 0.5, g: 0.5, b: 0.5, a: 1 });
    expect(lum[0]).toBeGreaterThan(lum[1] as number);
    for (const mode of ["HUE", "SATURATION", "OVERLAY", "SOFT_LIGHT", "HARD_LIGHT", "COLOR_DODGE", "COLOR_BURN", "EXCLUSION"] as BlendMode[]) {
      expect(over(mode, { r: 0.4, g: 0.6, b: 0.2, a: 1 }, { r: 0.7, g: 0.3, b: 0.5, a: 1 }).length).toBe(3);
    }
  });

  it("lets children of a pass-through frame blend with what is under the frame, and isolates them in a NORMAL one", () => {
    const { pixel } = setup((add, p) => {
      add("RECTANGLE", p, { width: 200, height: 50, fills: [solid(RED)] });
      const pass = add("FRAME", p, { width: 100, height: 50 });
      add("RECTANGLE", pass, { width: 100, height: 50, fills: [solid(GREEN)], blendMode: "SCREEN" });
      const normal = add("FRAME", p, { x: 100, width: 100, height: 50, blendMode: "NORMAL" });
      add("RECTANGLE", normal, { width: 100, height: 50, fills: [solid(GREEN)], blendMode: "SCREEN" });
    });
    expect(near(pixel(50, 25), [255, 255, 0])).toBe(true);
    expect(near(pixel(150, 25), [0, 255, 0])).toBe(true);
  });
});

describe("PageRenderer: effects", () => {
  it("draws a drop shadow offset, spread and blurred under the shape", () => {
    const { pixel } = setup((add, p) => {
      add("RECTANGLE", p, { x: 20, y: 20, width: 40, height: 40, fills: [solid(WHITE)], effects: [shadow("DROP_SHADOW", 20, 20, 0)] });
      add("RECTANGLE", p, { x: 120, y: 20, width: 40, height: 40, fills: [solid(WHITE)], effects: [shadow("DROP_SHADOW", 0, 0, 0, { spread: 10 })] });
      add("RECTANGLE", p, { x: 20, y: 120, width: 40, height: 40, fills: [solid(WHITE)], effects: [shadow("DROP_SHADOW", 0, 0, 20)] });
    });
    expect(near(pixel(40, 40), [255, 255, 255])).toBe(true);
    expect(near(pixel(70, 70), [0, 0, 0])).toBe(true); // shadow only
    expect(near(pixel(85, 50), [BG, BG, BG + 2])).toBe(true); // past it
    expect(near(pixel(114, 40), [0, 0, 0])).toBe(true); // within the 10 spread
    expect(near(pixel(105, 40), [BG, BG, BG + 2])).toBe(true);
    // Blurred: dark right at the edge, fading out.
    const edge = pixel(62, 140)[0] as number;
    const far = pixel(75, 140)[0] as number;
    expect(edge).toBeLessThan(BG - 5);
    expect(far).toBeGreaterThan(edge);
    expect(far).toBeLessThanOrEqual(BG + 1);
  });

  it("shows a shadow through a translucent fill only with showShadowBehindNode", () => {
    const half: Color = { r: 1, g: 0, b: 0, a: 0.5 };
    const { pixel } = setup((add, p) => {
      add("RECTANGLE", p, { x: 20, y: 20, width: 60, height: 60, fills: [solid(half)], effects: [shadow("DROP_SHADOW", 0, 0, 0, { spread: 10 })] });
      add("RECTANGLE", p, { x: 120, y: 20, width: 60, height: 60, fills: [solid(half)], effects: [shadow("DROP_SHADOW", 0, 0, 0, { spread: 10, showShadowBehindNode: true })] });
    });
    expect(near(pixel(50, 50), [143, 15, 16], 8)).toBe(true); // half red over the canvas
    expect(near(pixel(150, 50), [128, 0, 0], 8)).toBe(true); // half red over the shadow
    expect(near(pixel(15, 50), [0, 0, 0])).toBe(true); // the spread still shows outside
  });

  it("draws an inner shadow inside the shape, on the side it is offset from", () => {
    const { pixel } = setup((add, p) => {
      add("RECTANGLE", p, { x: 50, y: 50, width: 100, height: 100, fills: [solid(WHITE)], effects: [shadow("INNER_SHADOW", 10, 10, 0)] });
    });
    expect(near(pixel(55, 100), [0, 0, 0])).toBe(true);
    expect(near(pixel(100, 55), [0, 0, 0])).toBe(true);
    expect(near(pixel(100, 100), [255, 255, 255])).toBe(true);
    expect(near(pixel(145, 145), [255, 255, 255])).toBe(true);
    expect(near(pixel(45, 100), [BG, BG, BG + 2])).toBe(true); // nothing outside
  });

  it("grows an inner shadow inwards with spread, and blurs it", () => {
    const { pixel } = setup((add, p) => {
      add("ELLIPSE", p, { x: 0, y: 0, width: 100, height: 100, fills: [solid(WHITE)], effects: [shadow("INNER_SHADOW", 0, 0, 0, { spread: 15 })] });
      add("RECTANGLE", p, { x: 100, y: 0, width: 100, height: 100, fills: [solid(WHITE)], effects: [shadow("INNER_SHADOW", 0, 0, 20)] });
    });
    expect(near(pixel(50, 8), [0, 0, 0])).toBe(true); // within 15 of the edge
    expect(near(pixel(50, 22), [255, 255, 255])).toBe(true);
    const edge = pixel(101, 50)[0] as number;
    const inside = pixel(120, 50)[0] as number;
    expect(edge).toBeLessThan(200);
    expect(inside).toBeGreaterThan(edge);
    expect(near(pixel(150, 50), [255, 255, 255], 3)).toBe(true);
  });

  it("blurs ellipse and rounded-rectangle shadows, inside and out", () => {
    const { pixel } = setup((add, p) => {
      add("ELLIPSE", p, { x: 10, y: 10, width: 80, height: 60, fills: [solid(WHITE)], effects: [shadow("DROP_SHADOW", 0, 0, 16)] });
      add("ELLIPSE", p, { x: 110, y: 10, width: 80, height: 60, fills: [solid(WHITE)], effects: [shadow("INNER_SHADOW", 0, 0, 16)] });
      add("RECTANGLE", p, { x: 10, y: 110, width: 80, height: 60, cornerRadius: 12, fills: [solid(WHITE)], effects: [shadow("DROP_SHADOW", 0, 10, 8, { spread: 4 })] });
    });
    // Outside the ellipse: dark next to it, fading to the canvas.
    const near1 = pixel(50, 73)[0] as number;
    const far1 = pixel(50, 90)[0] as number;
    expect(near1).toBeLessThan(BG - 8);
    expect(far1).toBeGreaterThan(near1);
    expect(near(pixel(50, 40), [255, 255, 255])).toBe(true);
    // Inside the other: dark at the rim, white in the middle.
    const rim = pixel(112, 40)[0] as number;
    expect(rim).toBeLessThan(180);
    expect(near(pixel(150, 40), [255, 255, 255], 6)).toBe(true);
    expect(near(pixel(105, 40), [BG, BG, BG + 2])).toBe(true);
    // Rounded rectangle, offset down and spread: below it is dark, above it is not.
    expect(pixel(50, 178)[0]).toBeLessThan(BG - 10);
    expect(near(pixel(50, 104), [BG, BG, BG + 2], 3)).toBe(true);
  });

  it("casts the shadows of a group from what its children draw", () => {
    const { pixel } = setup((add, p) => {
      const g = add("GROUP", p, { width: 100, height: 100, effects: [shadow("DROP_SHADOW", 10, 10, 0), shadow("INNER_SHADOW", 5, 0, 0, { color: BLUE })] });
      add("RECTANGLE", g, { x: 20, y: 20, width: 30, height: 30, fills: [solid(WHITE)] });
      add("ELLIPSE", g, { x: 100, y: 100, width: 40, height: 40, fills: [solid(WHITE)] });
    });
    expect(near(pixel(55, 55), [0, 0, 0])).toBe(true); // under the rectangle, offset
    expect(near(pixel(145, 120), [0, 0, 0])).toBe(true); // past the ellipse's right edge
    expect(near(pixel(30, 30), [255, 255, 255])).toBe(true);
    expect(near(pixel(22, 35), [0, 0, 255])).toBe(true); // the inner shadow's 5 px strip on the left
    expect(near(pixel(5, 5), [BG, BG, BG + 2])).toBe(true);
  });

  it("casts a frame's shadow from its outline when it has a fill, and from its children when it doesn't", () => {
    const { pixel } = setup((add, p) => {
      const filled = add("FRAME", p, { x: 10, y: 10, width: 60, height: 60, fills: [solid(WHITE)], effects: [shadow("DROP_SHADOW", 15, 0, 0)] });
      add("RECTANGLE", filled, { width: 20, height: 20, fills: [solid(RED)] });
      const bare = add("FRAME", p, { x: 110, y: 10, width: 60, height: 60, effects: [shadow("DROP_SHADOW", 15, 0, 0)] });
      add("RECTANGLE", bare, { width: 20, height: 20, fills: [solid(RED)] });
    });
    expect(near(pixel(78, 60), [0, 0, 0])).toBe(true);
    expect(near(pixel(130, 15), [0, 0, 0])).toBe(true); // the child's shadow
    expect(near(pixel(178, 60), [BG, BG, BG + 2])).toBe(true); // no frame-shaped shadow
  });

  it("blurs a layer, children included", () => {
    const { pixel } = setup((add, p) => {
      const f = add("FRAME", p, { x: 50, y: 50, width: 100, height: 100, fills: [solid(WHITE)], effects: [{ type: "LAYER_BLUR", radius: 16, visible: true }] });
      add("RECTANGLE", f, { width: 50, height: 100, fills: [solid(BLACK)] });
    });
    expect(near(pixel(100, 100), [128, 128, 128], 30)).toBe(true); // the black and white edge is soft
    expect(near(pixel(125, 100), [255, 255, 255], 10)).toBe(true);
    const outside = pixel(155, 100)[0] as number;
    expect(outside).toBeGreaterThan(BG + 10); // white bleeds past the frame's edge
  });

  it("blurs what is behind a layer with a background blur", () => {
    const { pixel } = setup((add, p) => {
      for (let i = 0; i < 10; i++) add("RECTANGLE", p, { x: i * 20, width: 10, height: 200, fills: [solid(WHITE)] });
      add("RECTANGLE", p, { x: 100, width: 100, height: 100, fills: [solid({ r: 1, g: 1, b: 1, a: 0.1 })], effects: [{ type: "BACKGROUND_BLUR", radius: 20, visible: true }] });
    });
    // Unblurred stripes outside the layer: pure white and pure canvas.
    expect(near(pixel(45, 150), [255, 255, 255])).toBe(true);
    expect(near(pixel(55, 150), [BG, BG, BG + 2])).toBe(true);
    // Behind the layer: the stripes are mixed into grey.
    const a = pixel(145, 50)[0] as number;
    const b = pixel(155, 50)[0] as number;
    expect(Math.abs(a - b)).toBeLessThan(40);
    expect(a).toBeGreaterThan(100);
    expect(a).toBeLessThan(220);
  });

  it("ignores hidden effects and keeps shadows out of hit-testing", () => {
    let rect = "";
    const { doc, page, pixel } = setup((add, p) => {
      rect = add("RECTANGLE", p, { x: 20, y: 20, width: 40, height: 40, fills: [solid(WHITE)], effects: [{ ...shadow("DROP_SHADOW", 30, 30, 0), visible: false }, shadow("DROP_SHADOW", 0, 0, 0, { spread: 20 })] });
    });
    expect(near(pixel(85, 85), [BG, BG, BG + 2])).toBe(true); // where the hidden one would be
    expect(near(pixel(10, 40), [0, 0, 0])).toBe(true);
    expect(hitTest(doc, page, 10, 40)).toBeNull();
    expect(hitTest(doc, page, 30, 30)).toBe(rect);
  });

  it("still re-records only the layer an edit touched", () => {
    let a = "";
    const { doc, renderer, pixel } = setup((add, p) => {
      a = add("RECTANGLE", p, { x: 10, y: 10, width: 40, height: 40, fills: [solid(WHITE)], effects: [shadow("DROP_SHADOW", 10, 10, 4)] });
      add("RECTANGLE", p, { x: 110, y: 10, width: 40, height: 40, fills: [gradient("GRADIENT_RADIAL")], effects: [shadow("INNER_SHADOW", 2, 2, 4)] });
    });
    expect(renderer.render(AT_ORIGIN).recorded).toBe(0);
    doc.transact("Shadow", (tx) => tx.set(a, "effects", [shadow("DROP_SHADOW", 0, 0, 0, { spread: 5, color: RED })]));
    expect(renderer.render(AT_ORIGIN).recorded).toBe(1);
    expect(near(pixel(7, 30), [255, 0, 0])).toBe(true);
  });
});

describe("PageRenderer: stroke alignment", () => {
  it("draws strokes centred by default, or inside or outside the outline", () => {
    const { pixel } = setup((add, p) => {
      const base = { y: 20, width: 40, height: 40, fills: [solid(WHITE)], strokes: [solid(BLUE)], strokeWeight: 10 };
      add("RECTANGLE", p, { ...base, x: 20 });
      add("RECTANGLE", p, { ...base, x: 80, strokeAlign: "INSIDE" });
      add("RECTANGLE", p, { ...base, x: 140, strokeAlign: "OUTSIDE", cornerRadius: 10 });
      add("ELLIPSE", p, { ...base, x: 20, y: 100, strokeAlign: "OUTSIDE" });
      add("STAR", p, { ...base, x: 80, y: 100, strokeAlign: "INSIDE" });
    });
    // Centred: 5 each side of the edge at x = 20.
    expect(near(pixel(17, 40), [0, 0, 255])).toBe(true);
    expect(near(pixel(23, 40), [0, 0, 255])).toBe(true);
    expect(near(pixel(13, 40), [BG, BG, BG + 2])).toBe(true);
    // Inside: 10 within the edge at x = 80, nothing outside.
    expect(near(pixel(77, 40), [BG, BG, BG + 2])).toBe(true);
    expect(near(pixel(88, 40), [0, 0, 255])).toBe(true);
    expect(near(pixel(92, 40), [255, 255, 255])).toBe(true);
    // Outside: 10 beyond the edge at x = 140, the fill untouched; rounded with the corner.
    expect(near(pixel(132, 40), [0, 0, 255])).toBe(true);
    expect(near(pixel(142, 40), [255, 255, 255])).toBe(true);
    expect(near(pixel(131, 11), [BG, BG, BG + 2])).toBe(true); // the outer corner is round
    // Ellipse outside: the stroke rings the circle.
    expect(near(pixel(14, 120), [0, 0, 255])).toBe(true);
    expect(near(pixel(22, 120), [255, 255, 255])).toBe(true);
    // Star inside: the tip at the top is blue, nothing above it.
    expect(near(pixel(100, 104), [0, 0, 255])).toBe(true);
    expect(near(pixel(100, 97), [BG, BG, BG + 2])).toBe(true);
  });

  it("hit-tests outside strokes of closed paths over their full weight", () => {
    let star = "";
    const { doc, page } = setup((add, p) => {
      star = add("STAR", p, { x: 50, y: 50, width: 100, height: 100, strokes: [solid(BLUE)], strokeWeight: 10, strokeAlign: "OUTSIDE", strokeJoin: "ROUND" });
    });
    // The top tip is at (100, 50): 8 above it is inside the 10-unit outside stroke (plus 0 tolerance), not with centring.
    // Round joins: a miter tip would reach past it either way.
    expect(hitTest(doc, page, 100, 42, { tolerance: 0 })).toBe(star);
    doc.transact("Centre", (tx) => tx.set(star, "strokeAlign", "CENTER"));
    expect(hitTest(doc, page, 100, 42, { tolerance: 0 })).toBeNull();
  });
});

describe("PageRenderer: images", () => {
  it("decodes an image once it is needed, then re-records the layers that use it", async () => {
    const png = twoTonePng();
    let ready = 0;
    let hash = "";
    const { renderer, pixel } = setup(
      (add, p, doc) => {
        hash = doc.addImage(png);
        add("RECTANGLE", p, { width: 100, height: 100, fills: [{ type: "IMAGE", visible: true, imageHash: hash, scaleMode: "FILL" }] });
        add("RECTANGLE", p, { x: 100, width: 50, height: 50, fills: [solid(GREEN)] });
      },
      { onImageReady: () => ready++ },
    );
    expect(near(pixel(25, 50), [BG, BG, BG + 2])).toBe(true); // not decoded yet: nothing drawn
    await renderer.whenImagesReady();
    expect(ready).toBe(1);
    expect(renderer.render(AT_ORIGIN).recorded).toBe(1); // only the image's layer
    // FILL: 20 × 10 scaled by 10 to cover, centred: x 0–50 is the red half, 50–100 the blue.
    expect(near(pixel(25, 50), [255, 0, 0])).toBe(true);
    expect(near(pixel(75, 50), [0, 0, 255])).toBe(true);
  });

  it("places images by scale mode: fit, tile and crop", async () => {
    const png = twoTonePng();
    const images = new Map<string, Uint8Array>();
    const { renderer, pixel } = setup(
      (add, p, doc) => {
        const hash = doc.addImage(png);
        images.set(hash, png);
        const img = (extra: object): Paint => ({ type: "IMAGE", visible: true, imageHash: hash, scaleMode: "FIT", ...extra }) as Paint;
        add("RECTANGLE", p, { width: 100, height: 100, fills: [img({ scaleMode: "FIT" })] });
        add("RECTANGLE", p, { x: 100, width: 100, height: 100, fills: [img({ scaleMode: "TILE", scalingFactor: 1 })] });
        // Crop to the left half of the image: all red.
        add("RECTANGLE", p, { y: 100, width: 100, height: 100, fills: [img({ scaleMode: "CROP", imageTransform: [[0.5, 0, 0], [0, 1, 0]] })] });
        add("RECTANGLE", p, { x: 100, y: 100, width: 100, height: 100, fills: [img({ scaleMode: "FILL", opacity: 0.5 })] });
      },
      { images },
    );
    await renderer.whenImagesReady();
    renderer.render(AT_ORIGIN);
    // FIT: scaled by 5 to 100 × 50, centred: empty above and below.
    expect(near(pixel(25, 50), [255, 0, 0])).toBe(true);
    expect(near(pixel(75, 50), [0, 0, 255])).toBe(true);
    expect(near(pixel(50, 10), [BG, BG, BG + 2])).toBe(true);
    // TILE at 1×: 20 × 10 tiles from the top left.
    expect(near(pixel(105, 5), [255, 0, 0])).toBe(true);
    expect(near(pixel(115, 5), [0, 0, 255])).toBe(true);
    expect(near(pixel(125, 15), [255, 0, 0])).toBe(true);
    expect(near(pixel(90, 190), [255, 0, 0])).toBe(true);
    expect(near(pixel(125, 150), [143, 15, 16], 8)).toBe(true);
  });

  it("draws a faint placeholder for a missing or unreadable image, and the image once the source has it", async () => {
    const png = twoTonePng();
    const hash = "0".repeat(64);
    const images = new Map([["f".repeat(64), new Uint8Array([1, 2, 3])]]);
    let rect = "";
    const { doc, renderer, pixel } = setup(
      (add, p) => {
        rect = add("RECTANGLE", p, { width: 100, height: 100, fills: [{ type: "IMAGE", visible: true, imageHash: hash, scaleMode: "FILL" }] });
        add("RECTANGLE", p, { x: 100, width: 100, height: 100, fills: [{ type: "IMAGE", visible: true, imageHash: "f".repeat(64), scaleMode: "FILL" }] });
      },
      { images },
    );
    await renderer.whenImagesReady();
    renderer.render(AT_ORIGIN);
    for (const p of [pixel(50, 50), pixel(150, 50)]) {
      expect(near(p, [BG, BG, BG + 2], 2)).toBe(false); // something is drawn…
      expect(near(p, [BG, BG, BG], 40)).toBe(true); // …but faintly
    }
    images.set(hash, png);
    doc.transact("Touch", (tx) => tx.set(rect, "name", "Photo"));
    renderer.render(AT_ORIGIN);
    await renderer.whenImagesReady();
    renderer.render(AT_ORIGIN);
    expect(near(pixel(25, 50), [255, 0, 0])).toBe(true);
  });

  it("draws gradient-filled text", () => {
    if (!existsSync(INTER)) return;
    const buf = readFileSync(INTER);
    const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    const { pixel } = setup(
      (add, p) =>
        void add("TEXT", p, { width: 200, height: 60, characters: "WWWWWW", fontFamily: "Inter", fontSize: 48, lineHeight: 60, fills: [gradient("GRADIENT_LINEAR")] }),
      { fonts: [{ family: "Inter", data }] },
    );
    let reds = 0, blues = 0;
    for (let y = 0; y < 60; y += 2) {
      for (let x = 0; x < 200; x += 2) {
        const [r, , b] = pixel(x, y) as [number, number, number];
        if (r > 180 && b < 90 && x < 60) reds++;
        if (b > 180 && r < 90 && x > 100) blues++;
      }
    }
    expect(reds).toBeGreaterThan(10);
    expect(blues).toBeGreaterThan(10);
  });
});
