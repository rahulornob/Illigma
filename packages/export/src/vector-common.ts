/**
 * What the SVG and PDF writers share: number formatting, paints, outlines
 * and the fallback text layout.
 */

import type { DeepReadonly, ReadonlyNode } from "@illigma/core";
import { PATH_CLOSE, PATH_CUBIC, PATH_LINE, PATH_MOVE, type Color, type Paint, type PathCommands } from "@illigma/format";
import { shapeGeometry, type FillPath, type TextLine } from "@illigma/renderer";

/** Numbers in vector output: at most 4 decimals, no "-0", never exponent notation. */
export function fmt(v: number): string {
  if (!Number.isFinite(v)) return "0";
  const r = Math.round(v * 1e4) / 1e4;
  if (Object.is(r, -0) || r === 0) return "0";
  if (Math.abs(r) >= 1e21) return r > 0 ? "1e20" : "-1e20"; // out of any real document's range
  return String(r);
}

/**
 * A paint the writers know how to write. Version 0 files hold solid paints
 * only; gradients and images add their own kinds here and a case in each writer.
 */
export type ResolvedPaint = { kind: "solid"; color: Color; opacity: number };

/** A visible paint as a `ResolvedPaint`, or null when it draws nothing. Unsupported kinds are reported through `warn`. */
export function resolvePaint(paint: DeepReadonly<Paint>, warn: (message: string) => void): ResolvedPaint | null {
  if (!paint.visible) return null;
  switch (paint.type) {
    case "SOLID": {
      const { r, g, b, a } = paint.color;
      if (a <= 0) return null;
      return { kind: "solid", color: { r: clamp01(r), g: clamp01(g), b: clamp01(b), a: 1 }, opacity: clamp01(a) };
    }
    default:
      warn(`${String((paint as { type?: unknown }).type)} paints aren't exported yet; they were left out.`);
      return null;
  }
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** `#RRGGBB`, upper case. */
export function hex(c: Color): string {
  const h = (v: number) => Math.round(clamp01(v) * 255).toString(16).padStart(2, "0");
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`.toUpperCase();
}

/** How a layer's own outline is drawn. */
export type Outline =
  | { kind: "rect"; width: number; height: number; radius: number }
  | { kind: "ellipse"; width: number; height: number }
  | { kind: "paths"; fills: readonly FillPath[]; stroke: readonly number[] }
  | { kind: "text" }
  | { kind: "none" };

/** The outline the renderer draws for `n` (groups and pages have none). */
export function outlineOf(n: ReadonlyNode): Outline {
  const geo = shapeGeometry(n);
  if (geo) return { kind: "paths", fills: geo.fills, stroke: geo.stroke };
  switch (n.type) {
    case "GROUP":
    case "PAGE":
      return { kind: "none" };
    case "TEXT":
      return { kind: "text" };
    case "ELLIPSE":
      return { kind: "ellipse", width: n.width, height: n.height };
    default:
      return { kind: "rect", width: n.width, height: n.height, radius: clampRadius(n.cornerRadius, n.width, n.height) };
  }
}

/** Corner radius as drawn: never more than half the shorter side. */
export function clampRadius(r: number, w: number, h: number): number {
  return Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
}

/** Cubic handle length for a quarter circle of radius 1. */
const KAPPA = 0.5522847498307936;

/** A rectangle, rounded or not, as path commands (clockwise from the top-left). */
export function rectCommands(w: number, h: number, r: number): PathCommands {
  if (r <= 0) return [PATH_MOVE, 0, 0, PATH_LINE, w, 0, PATH_LINE, w, h, PATH_LINE, 0, h, PATH_CLOSE];
  const k = r * (1 - KAPPA);
  return [
    PATH_MOVE, r, 0,
    PATH_LINE, w - r, 0,
    PATH_CUBIC, w - k, 0, w, k, w, r,
    PATH_LINE, w, h - r,
    PATH_CUBIC, w, h - k, w - k, h, w - r, h,
    PATH_LINE, r, h,
    PATH_CUBIC, k, h, 0, h - k, 0, h - r,
    PATH_LINE, 0, r,
    PATH_CUBIC, 0, k, k, 0, r, 0,
    PATH_CLOSE,
  ];
}

/** An ellipse inscribed in w × h, as four cubics (clockwise from the right). */
export function ellipseCommands(w: number, h: number): PathCommands {
  const rx = w / 2, ry = h / 2, kx = rx * KAPPA, ky = ry * KAPPA;
  return [
    PATH_MOVE, w, ry,
    PATH_CUBIC, w, ry + ky, rx + kx, h, rx, h,
    PATH_CUBIC, rx - kx, h, 0, ry + ky, 0, ry,
    PATH_CUBIC, 0, ry - ky, rx - kx, 0, rx, 0,
    PATH_CUBIC, rx + kx, 0, w, ry - ky, w, ry,
    PATH_CLOSE,
  ];
}

/** Figma font style names ("Semi Bold Italic") to CSS weights, as the renderer reads them. */
const WEIGHTS: [RegExp, number][] = [
  [/thin|hairline/, 100],
  [/extra ?light|ultra ?light/, 200],
  [/light/, 300],
  [/medium/, 500],
  [/semi ?bold|demi ?bold/, 600],
  [/extra ?bold|ultra ?bold/, 800],
  [/bold/, 700],
  [/black|heavy/, 900],
];

export interface TextStyle {
  family: string;
  size: number;
  weight: number;
  italic: boolean;
}

export function textStyle(n: ReadonlyNode, fallbackFamily = "Inter"): TextStyle {
  const style = (n.fontStyle ?? "Regular").toLowerCase();
  return {
    family: n.fontFamily || fallbackFamily,
    size: n.fontSize ?? 12,
    weight: WEIGHTS.find(([re]) => re.test(style))?.[1] ?? 400,
    italic: /italic|oblique/.test(style),
  };
}

/** Inter's ascender and descender, in ems: the editor's UI and default font. */
const ASCENT = 0.96875;
const DESCENT = 0.2421875;

/**
 * Lines of a TEXT layer without a text engine: one per line break (no
 * wrapping), with baselines from Inter's metrics and the layer's line
 * height (leading split above and below, as in Figma).
 */
export function fallbackTextLines(n: ReadonlyNode): TextLine[] {
  const size = n.fontSize ?? 12;
  const content = (ASCENT + DESCENT) * size;
  const lh = n.lineHeight ?? content;
  const first = (lh - content) / 2 + ASCENT * size;
  return (n.characters ?? "").split(/\r\n|[\n\r\u2028\u2029]/).map((text, i) => ({ text, left: 0, baseline: first + i * lh }));
}
