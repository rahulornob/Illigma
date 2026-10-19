import { describe, expect, it } from "vitest";
import { Document } from "@illigma/core";
import type { ColorStop, GradientPaint, Paint } from "@illigma/format";
import { validateNodeField } from "@illigma/format";
import { toHex, toHex8 } from "./color";
import {
  addStop,
  colorAt,
  convertEffect,
  convertPaint,
  defaultEffect,
  documentColors,
  flipStops,
  gradientAngle,
  handlesOf,
  IDENTITY,
  layerBlend,
  LINEAR_DEFAULT,
  moveStop,
  removeStop,
  rotateGradient,
  storedLayerBlend,
  transformFromHandles,
} from "./paints";

const red = { r: 1, g: 0, b: 0, a: 1 };
const blue = { r: 0, g: 0, b: 1, a: 1 };
const stops: ColorStop[] = [
  { position: 0, color: red },
  { position: 1, color: blue },
];
const linear = (t = LINEAR_DEFAULT): GradientPaint => ({ type: "GRADIENT_LINEAR", visible: true, gradientStops: stops, gradientTransform: t });
const paintsValid = (paints: Paint[]) => expect(validateNodeField("fills", paints)).toBeNull();

describe("gradient stops", () => {
  it("adds a stop with the colour the gradient has there, in order", () => {
    const r = addStop(stops, 0.25);
    expect(r.index).toBe(1);
    expect(r.stops.map((s) => s.position)).toEqual([0, 0.25, 1]);
    expect(toHex(r.stops[1]!.color)).toBe("BF0040");
    paintsValid([{ ...linear(), gradientStops: r.stops }]);
  });

  it("moves a stop past another and says where it went", () => {
    const three = addStop(stops, 0.5).stops;
    const r = moveStop(three, 0, 0.75);
    expect(r.stops.map((s) => s.position)).toEqual([0.5, 0.75, 1]);
    expect(r.index).toBe(1);
    expect(r.stops[1]!.color).toEqual(red);
    // Positions stay within 0…1 and to 0.01 %.
    expect(moveStop(three, 1, 1.7).stops.at(-1)!.position).toBe(1);
    expect(moveStop(three, 1, 0.123456).stops[1]!.position).toBe(0.1235);
  });

  it("removes a stop but keeps two", () => {
    const three = addStop(stops, 0.5).stops;
    const r = removeStop(three, 2);
    expect(r?.stops.length).toBe(2);
    expect(r?.index).toBe(1);
    expect(removeStop(stops, 0)).toBeNull();
  });

  it("flips the gradient", () => {
    const f = flipStops([...stops, { position: 0.2, color: { r: 0, g: 1, b: 0, a: 1 } }]);
    expect(f.map((s) => [s.position, toHex(s.color)])).toEqual([
      [0, "0000FF"],
      [0.8, "00FF00"],
      [1, "FF0000"],
    ]);
  });

  it("reads colours between and past the stops", () => {
    expect(colorAt(stops, -1)).toEqual(red);
    expect(colorAt(stops, 2)).toEqual(blue);
    expect(colorAt(stops, 0.5)).toEqual({ r: 0.5, g: 0, b: 0.5, a: 1 });
  });
});

describe("gradient handles", () => {
  it("starts linear gradients top to bottom, as Figma does", () => {
    const h = handlesOf(linear())!;
    expect(h.start).toEqual({ x: 0.5, y: 0 });
    expect(h.end).toEqual({ x: 0.5, y: 1 });
    expect(gradientAngle(linear(), 200, 100)).toBe(90);
  });

  it("round-trips handles and transforms for every type", () => {
    const t: GradientPaint["gradientTransform"] = [
      [0.8, 0.3, 0.1],
      [-0.2, 1.1, -0.05],
    ];
    for (const type of ["GRADIENT_LINEAR", "GRADIENT_RADIAL", "GRADIENT_ANGULAR", "GRADIENT_DIAMOND"] as const) {
      const p = { type, gradientTransform: t };
      const back = transformFromHandles(type, handlesOf(p)!)!;
      back.flat().forEach((v, i) => expect(v).toBeCloseTo(t.flat()[i]!, 6));
    }
    expect(handlesOf({ type: "GRADIENT_RADIAL", gradientTransform: IDENTITY })!.start).toEqual({ x: 0.5, y: 0.5 });
  });

  it("refuses handles on one line", () => {
    expect(transformFromHandles("GRADIENT_LINEAR", { start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, width: { x: 0.5, y: 0.5 } })).toBeNull();
  });

  it("turns a gradient to an angle on screen, keeping its length", () => {
    const p = linear(IDENTITY); // left to right, across a 200 × 100 box
    expect(gradientAngle(p, 200, 100)).toBe(0);
    const turned = { ...p, gradientTransform: rotateGradient(p, 90, 200, 100) };
    expect(gradientAngle(turned, 200, 100)).toBeCloseTo(90);
    const h = handlesOf(turned)!;
    // 200 px long, about the box's centre: from (100, -50) to (100, 150).
    expect(h.start.x * 200).toBeCloseTo(100);
    expect(h.start.y * 100).toBeCloseTo(-50);
    expect(h.end.y * 100).toBeCloseTo(150);
    paintsValid([turned]);
  });
});

describe("paint types", () => {
  const solid: Paint = { type: "SOLID", visible: true, color: { r: 1, g: 0.357, b: 0.18, a: 1 }, opacity: 0.5, blendMode: "MULTIPLY" };
  it("turns a solid into a gradient from its colour to transparent, and back", () => {
    const g = convertPaint(solid, "GRADIENT_RADIAL") as GradientPaint;
    expect(g.gradientStops.map((s) => toHex8(s.color))).toEqual(["FF5B2EFF", "FF5B2E00"]);
    expect(g.gradientTransform).toEqual(IDENTITY);
    expect(g.opacity).toBe(0.5);
    expect(g.blendMode).toBe("MULTIPLY");
    expect(convertPaint(g, "GRADIENT_ANGULAR")).toMatchObject({ type: "GRADIENT_ANGULAR", gradientStops: g.gradientStops });
    expect(convertPaint(g, "SOLID")).toMatchObject({ type: "SOLID", color: { r: 1 } });
    const img = convertPaint(solid, "IMAGE");
    expect(img).toEqual({ type: "IMAGE", visible: true, opacity: 0.5, blendMode: "MULTIPLY", imageHash: null, scaleMode: "FILL" });
    paintsValid([g, img, convertPaint(img, "SOLID"), convertPaint(solid, "GRADIENT_LINEAR")]);
  });
});

describe("effects", () => {
  it("adds Figma's default drop shadow and converts between types", () => {
    const drop = defaultEffect("DROP_SHADOW");
    expect(drop).toMatchObject({ offset: { x: 0, y: 4 }, radius: 4, color: { a: 0.25 }, showShadowBehindNode: false });
    const inner = convertEffect({ ...drop, radius: 12 }, "INNER_SHADOW");
    expect(inner).not.toHaveProperty("showShadowBehindNode");
    expect(inner.radius).toBe(12);
    const blur = convertEffect(inner, "LAYER_BLUR");
    expect(blur).toEqual({ type: "LAYER_BLUR", radius: 12, visible: true });
    expect(validateNodeField("effects", [drop, inner, blur, convertEffect(blur, "BACKGROUND_BLUR"), convertEffect(blur, "DROP_SHADOW")])).toBeNull();
  });
});

describe("layer blend mode", () => {
  it("reads Pass through on frames and Normal on shapes, and stores the default as absent", () => {
    expect(layerBlend({ type: "FRAME" })).toBe("PASS_THROUGH");
    expect(layerBlend({ type: "RECTANGLE" })).toBe("NORMAL");
    expect(layerBlend({ type: "RECTANGLE", blendMode: "MULTIPLY" })).toBe("MULTIPLY");
    expect(storedLayerBlend("RECTANGLE", "NORMAL")).toBeUndefined();
    expect(storedLayerBlend("FRAME", "NORMAL")).toBe("NORMAL");
    expect(storedLayerBlend("FRAME", "PASS_THROUGH")).toBeUndefined();
  });
});

describe("document colours", () => {
  it("collects solid fills and strokes on every page, most used first, once each, capped", () => {
    const doc = new Document("Colours");
    const solid = (r: number, a = 1): Paint => ({ type: "SOLID", visible: true, color: { r, g: 0, b: 0, a } });
    doc.transact("Make", (tx) => {
      const p1 = tx.addPage("One");
      const p2 = tx.addPage("Two");
      tx.create("RECTANGLE", p1, { fills: [solid(1)], strokes: [solid(0.5)] });
      tx.create("RECTANGLE", p1, { fills: [solid(0.5), solid(1, 0.5)] });
      tx.create("ELLIPSE", p2, { fills: [solid(0.5), linear()] });
      // Within an 8-bit step: the same colour.
      tx.create("ELLIPSE", p2, { fills: [solid(1.0001 - 0.0001)] });
      for (let i = 0; i < 40; i++) tx.create("RECTANGLE", p2, { fills: [solid(i / 255, 0.2)] });
    });
    const all = documentColors(doc, 100);
    expect(all.slice(0, 2).map(toHex8)).toEqual(["800000FF", "FF0000FF"]);
    expect(all.map(toHex8)).toContain("FF000080");
    expect(new Set(all.map(toHex8)).size).toBe(all.length);
    expect(all.length).toBe(2 + 1 + 40);
    expect(documentColors(doc).length).toBe(24);
  });
});
