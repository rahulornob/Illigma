/**
 * What the SVG and PDF writers share: number formatting, paints, outlines
 * and the fallback text layout.
 */

import type { DeepReadonly, ReadonlyNode } from "@illigma/core";
import {
  PATH_CLOSE,
  PATH_CUBIC,
  PATH_LINE,
  PATH_MOVE,
  sniffImageFormat,
  type BlendMode,
  type Color,
  type GradientType,
  type ImagePaint,
  type Paint,
  type PathCommands,
  type ShadowEffect,
} from "@illigma/format";
import { invertTransform, shapeGeometry, type FillPath, type TextLine } from "@illigma/renderer";
import type { Matrix } from "./scene.js";

/** Numbers in vector output: at most 4 decimals, no "-0", never exponent notation. */
export function fmt(v: number): string {
  if (!Number.isFinite(v)) return "0";
  const r = Math.round(v * 1e4) / 1e4;
  if (Object.is(r, -0) || r === 0) return "0";
  if (Math.abs(r) >= 1e21) return r > 0 ? "1e20" : "-1e20"; // out of any real document's range
  return String(r);
}

/** One gradient stop, in position order, colour without alpha. */
export interface ResolvedStop {
  position: number;
  color: Color;
  alpha: number;
}

/**
 * A paint the writers know how to write. Every kind carries the paint's
 * `opacity` and `blend` (null for normal).
 */
export type ResolvedPaint = (
  | { kind: "solid"; color: Color }
  | {
      kind: "gradient";
      type: GradientType;
      stops: ResolvedStop[];
      /** Gradient space (linear: (0, 0.5) to (1, 0.5); the others centred on (0.5, 0.5), radius 0.5) to the node's own space. */
      matrix: Matrix;
    }
  | {
      kind: "image";
      hash: string;
      bytes: Uint8Array;
      format: "png" | "jpg" | "webp" | "gif";
      /** The image's own size in pixels. */
      width: number;
      height: number;
      /** Image pixels to the node's own space. */
      matrix: Matrix;
      /** TILE: repeat the image (at `matrix`'s scale) across the box. */
      tile: boolean;
      /** The layer's box, which an untiled image is shown in. */
      box: { width: number; height: number };
    }
) & { opacity: number; blend: BlendMode | null };

/** What resolving a paint needs from the layer and the document. */
export interface PaintContext {
  /** The layer's box size. */
  width: number;
  height: number;
  /** Image files by hash (`Document.image`); absent: image paints are left out with a warning. */
  image?: ((hash: string) => Uint8Array | undefined) | undefined;
}

/** A visible paint as a `ResolvedPaint`, or null when it draws nothing. What can't be written is reported through `warn`. */
export function resolvePaint(paint: DeepReadonly<Paint>, warn: (message: string) => void, ctx: PaintContext = { width: 0, height: 0 }): ResolvedPaint | null {
  if (!paint.visible) return null;
  const opacity = clamp01(paint.opacity ?? 1);
  if (opacity <= 0) return null;
  const blend = paint.blendMode && paint.blendMode !== "NORMAL" && paint.blendMode !== "PASS_THROUGH" ? paint.blendMode : null;
  switch (paint.type) {
    case "SOLID": {
      const { r, g, b, a } = paint.color;
      if (a <= 0) return null;
      return { kind: "solid", color: { r: clamp01(r), g: clamp01(g), b: clamp01(b), a: 1 }, opacity: clamp01(a) * opacity, blend };
    }
    case "GRADIENT_LINEAR":
    case "GRADIENT_RADIAL":
    case "GRADIENT_ANGULAR":
    case "GRADIENT_DIAMOND": {
      const inv = invertTransform(paint.gradientTransform);
      if (!inv) return null; // the renderer draws nothing for these too
      const w = ctx.width || 1;
      const h = ctx.height || 1;
      const [ia, ic, ie, ib, id, iff] = inv;
      const stops = [...paint.gradientStops]
        .sort((x, y) => x.position - y.position)
        .map((s) => ({ position: clamp01(s.position), color: { r: clamp01(s.color.r), g: clamp01(s.color.g), b: clamp01(s.color.b), a: 1 }, alpha: clamp01(s.color.a) }));
      return { kind: "gradient", type: paint.type, stops, matrix: [w * ia, h * ib, w * ic, h * id, w * ie, h * iff], opacity, blend };
    }
    case "IMAGE": {
      if (paint.imageHash === null) return null;
      const bytes = ctx.image?.(paint.imageHash);
      if (!bytes) {
        warn(`An image (${paint.imageHash.slice(0, 12)}…) isn't in the document, so it was left out.`);
        return null;
      }
      const size = imageSize(bytes);
      if (!size) {
        warn(`An image (${paint.imageHash.slice(0, 12)}…) couldn't be read, so it was left out.`);
        return null;
      }
      const place = imagePlacement(paint, size.width, size.height, ctx.width, ctx.height);
      if (!place) return null;
      return { kind: "image", hash: paint.imageHash, bytes, format: size.format, width: size.width, height: size.height, ...place, box: { width: ctx.width, height: ctx.height }, opacity, blend };
    }
  }
}

/** Where an image paint's pixels go in a w × h box, as the renderer places them. Null when nothing shows. */
export function imagePlacement(p: DeepReadonly<ImagePaint>, iw: number, ih: number, w: number, h: number): { matrix: Matrix; tile: boolean } | null {
  if (!(iw > 0 && ih > 0 && w > 0 && h > 0)) return null;
  switch (p.scaleMode) {
    case "FILL":
    case "FIT": {
      const s = p.scaleMode === "FILL" ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
      return { matrix: [s, 0, 0, s, (w - iw * s) / 2, (h - ih * s) / 2], tile: false };
    }
    case "TILE": {
      const s = p.scalingFactor ?? 1;
      return { matrix: [s, 0, 0, s, 0, 0], tile: true };
    }
    case "CROP": {
      const inv = invertTransform(p.imageTransform ?? [[1, 0, 0], [0, 1, 0]]);
      if (!inv) return null;
      const [ia, ic, ie, ib, id, iff] = inv;
      return { matrix: [(w * ia) / iw, (h * ib) / iw, (w * ic) / ih, (h * id) / ih, w * ie, h * iff], tile: false };
    }
  }
}

/** An image file's format and pixel size, from its header (PNG, JPEG, GIF, WebP); null if unreadable. */
export function imageSize(b: Uint8Array): { format: "png" | "jpg" | "webp" | "gif"; width: number; height: number } | null {
  const format = sniffImageFormat(b);
  const u16be = (i: number) => ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
  const u16le = (i: number) => (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8);
  const u24le = (i: number) => u16le(i) | ((b[i + 2] ?? 0) << 16);
  const u32be = (i: number) => ((b[i] ?? 0) * 0x1000000) + (((b[i + 1] ?? 0) << 16) | ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0));
  let width = 0, height = 0;
  switch (format) {
    case "png":
      width = u32be(16);
      height = u32be(20);
      break;
    case "gif":
      width = u16le(6);
      height = u16le(8);
      break;
    case "webp": {
      const chunk = String.fromCharCode(...b.subarray(12, 16));
      if (chunk === "VP8 ") {
        width = u16le(26) & 0x3fff;
        height = u16le(28) & 0x3fff;
      } else if (chunk === "VP8L") {
        const bits = (b[21] ?? 0) | ((b[22] ?? 0) << 8) | ((b[23] ?? 0) << 16) | ((b[24] ?? 0) << 24);
        width = (bits & 0x3fff) + 1;
        height = ((bits >>> 14) & 0x3fff) + 1;
      } else if (chunk === "VP8X") {
        width = u24le(24) + 1;
        height = u24le(27) + 1;
      }
      break;
    }
    case "jpg": {
      // Walk the markers to the first start-of-frame.
      for (let i = 2; i + 9 < b.length; ) {
        if (b[i] !== 0xff) return null;
        const marker = b[i + 1] as number;
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
          i += 2;
          continue;
        }
        const len = u16be(i + 2);
        if ((marker >= 0xc0 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          height = u16be(i + 5);
          width = u16be(i + 7);
          break;
        }
        i += 2 + len;
      }
      break;
    }
    default:
      return null;
  }
  return format && width > 0 && height > 0 ? { format, width, height } : null;
}

/** Figma blend modes as CSS `mix-blend-mode` values; null for normal. LINEAR_BURN has no CSS mode (reported, then drawn as multiply). */
export function cssBlendMode(mode: BlendMode | null | undefined, warn: (message: string) => void): string | null {
  if (!mode || mode === "NORMAL" || mode === "PASS_THROUGH") return null;
  if (mode === "LINEAR_DODGE") return "plus-lighter";
  if (mode === "LINEAR_BURN") {
    warn("SVG has no linear burn blend mode, so it was written as multiply.");
    return "multiply";
  }
  return mode.toLowerCase().replace(/_/g, "-");
}

/** Figma blend modes as PDF `/BM` names; null for normal. The linear modes have none (reported, then drawn as multiply or screen). */
export function pdfBlendMode(mode: BlendMode | null | undefined, warn: (message: string) => void): string | null {
  if (!mode || mode === "NORMAL" || mode === "PASS_THROUGH") return null;
  if (mode === "LINEAR_BURN" || mode === "LINEAR_DODGE") {
    warn(`PDF has no ${mode === "LINEAR_BURN" ? "linear burn" : "linear dodge"} blend mode, so it was written as ${mode === "LINEAR_BURN" ? "multiply" : "screen"}.`);
    return mode === "LINEAR_BURN" ? "Multiply" : "Screen";
  }
  return mode
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

/** A layer's visible effects, sorted by kind. */
export function visibleEffects(n: ReadonlyNode): { drops: DeepReadonly<ShadowEffect>[]; inners: DeepReadonly<ShadowEffect>[]; layerBlur: number; backgroundBlur: number; any: boolean } {
  const out = { drops: [] as DeepReadonly<ShadowEffect>[], inners: [] as DeepReadonly<ShadowEffect>[], layerBlur: 0, backgroundBlur: 0, any: false };
  for (const e of n.effects ?? []) {
    if (!e.visible) continue;
    if (e.type === "DROP_SHADOW") out.drops.push(e);
    else if (e.type === "INNER_SHADOW") out.inners.push(e);
    else if (e.type === "LAYER_BLUR") out.layerBlur = Math.max(out.layerBlur, e.radius);
    else out.backgroundBlur = Math.max(out.backgroundBlur, e.radius);
  }
  out.any = out.drops.length > 0 || out.inners.length > 0 || out.layerBlur > 0 || out.backgroundBlur > 0;
  return out;
}

/** Where a layer's strokes sit, as the renderer draws them: lines, open paths and text are always centred. */
export function strokeAlignOf(n: ReadonlyNode): "CENTER" | "INSIDE" | "OUTSIDE" {
  const a = n.strokeAlign ?? "CENTER";
  if (a === "CENTER" || n.type === "LINE" || n.type === "TEXT" || n.type === "GROUP" || n.type === "PAGE") return "CENTER";
  if (n.type === "VECTOR" && !(n.vectorNetwork?.regions.length ?? 0)) return "CENTER";
  return a;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
/** Standard base64, for data URIs. */
export function base64(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = ((bytes[i] as number) << 16) | ((bytes[i + 1] as number) << 8) | (bytes[i + 2] as number);
    out += B64[n >> 18]! + B64[(n >> 12) & 63]! + B64[(n >> 6) & 63]! + B64[n & 63]!;
  }
  if (i < bytes.length) {
    const n = ((bytes[i] as number) << 16) | ((bytes[i + 1] ?? 0) << 8);
    out += B64[n >> 18]! + B64[(n >> 12) & 63]! + (i + 1 < bytes.length ? B64[(n >> 6) & 63]! : "=") + "=";
  }
  return out;
}

/** 2D affine `m` as SVG's `matrix(a b c d e f)`. */
export function svgMatrix(m: Matrix): string {
  return `matrix(${m.map(fmt).join(" ")})`;
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
