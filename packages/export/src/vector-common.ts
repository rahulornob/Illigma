/**
 * What the SVG and PDF writers share: number formatting, paints, outlines
 * and the fallback text layout.
 */

import type { DeepReadonly, ReadonlyNode } from "@illigma/core";
import {
  lineHeightPx,
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
import { CLIPPING, invertTransform, shapeGeometry, type FillPath, type TextLine } from "@illigma/renderer";
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
      /** The image's own size in pixels, as shown (after its Exif orientation). */
      width: number;
      height: number;
      /** The header: stored size, orientation, JPEG details. */
      info: ImageInfo;
      /** The paint itself, to place the image again when a decoder reports another size. */
      paint: DeepReadonly<ImagePaint>;
      /** Image pixels (as shown) to the node's own space. */
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
      return { kind: "image", hash: paint.imageHash, bytes, format: size.format, width: size.width, height: size.height, info: size, paint, ...place, box: { width: ctx.width, height: ctx.height }, opacity, blend };
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

/** What `imageSize` reads from an image file's header. */
export interface ImageInfo {
  format: "png" | "jpg" | "webp" | "gif";
  /** Pixel size as shown: for a JPEG with an Exif orientation of 5 to 8, the stored size turned a quarter. */
  width: number;
  height: number;
  /** Exif orientation (JPEG only), 1 to 8; 1 when there is none. */
  orientation: number;
  /** Pixel size as stored in the file. */
  rawWidth: number;
  rawHeight: number;
  /** JPEG only: start-of-frame marker (0xC0 to 0xCF), colour components, bits per sample, and where the orientation value is. */
  jpeg?: { sof: number; components: number; precision: number; orientationAt: number | null };
}

/** An image file's format and pixel size, from its header (PNG, JPEG with its Exif orientation, GIF, WebP); null if unreadable. */
export function imageSize(b: Uint8Array): ImageInfo | null {
  const format = sniffImageFormat(b);
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
      const j = jpegHeader(b);
      if (!j) return null;
      const turned = j.orientation >= 5;
      return {
        format,
        width: turned ? j.height : j.width,
        height: turned ? j.width : j.height,
        orientation: j.orientation,
        rawWidth: j.width,
        rawHeight: j.height,
        jpeg: { sof: j.sof, components: j.components, precision: j.precision, orientationAt: j.orientationAt },
      };
    }
    default:
      return null;
  }
  return format && width > 0 && height > 0 ? { format, width, height, orientation: 1, rawWidth: width, rawHeight: height } : null;
}

/**
 * A JPEG's start-of-frame (size, components, precision) and its Exif
 * orientation, with the offset of the orientation value (to rewrite it).
 */
function jpegHeader(b: Uint8Array): { width: number; height: number; sof: number; components: number; precision: number; orientation: number; orientationAt: number | null } | null {
  const u16be = (i: number) => ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let orientation = 1;
  let orientationAt: number | null = null;
  let exifSeen = false;
  // Walk the markers to the first start-of-frame, reading the first Exif segment on the way.
  for (let i = 2; i + 9 < b.length; ) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1] as number;
    if (marker === 0xff) {
      i += 1; // a fill byte
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = u16be(i + 2);
    if (len < 2) return null;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = u16be(i + 5);
      const width = u16be(i + 7);
      return width > 0 && height > 0 ? { width, height, sof: marker, components: b[i + 9] ?? 0, precision: b[i + 4] ?? 0, orientation, orientationAt } : null;
    }
    if (marker === 0xe1 && !exifSeen) {
      const exif = exifOrientation(b, i + 4, Math.min(b.length, i + 2 + len));
      if (exif) {
        exifSeen = true;
        orientation = exif.orientation;
        orientationAt = exif.at;
      }
    }
    i += 2 + len;
  }
  return null;
}

/** The orientation tag in the first image directory of an APP1 segment's data (`start` to `end`), or null when it isn't Exif or has none. */
function exifOrientation(b: Uint8Array, start: number, end: number): { orientation: number; at: number } | null {
  // "Exif\0\0", then a TIFF header: byte order, 42, offset of the first directory.
  if (end - start < 14 || b[start] !== 0x45 || b[start + 1] !== 0x78 || b[start + 2] !== 0x69 || b[start + 3] !== 0x66 || b[start + 4] !== 0 || b[start + 5] !== 0) return null;
  const t = start + 6;
  const le = b[t] === 0x49 && b[t + 1] === 0x49;
  if (!le && !(b[t] === 0x4d && b[t + 1] === 0x4d)) return null;
  const u16 = (i: number) => (le ? (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8) : ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0));
  const u32 = (i: number) => (le ? u16(i) + u16(i + 2) * 0x10000 : u16(i) * 0x10000 + u16(i + 2));
  if (u16(t + 2) !== 42) return null;
  const ifd = t + u32(t + 4);
  if (ifd + 2 > end) return null;
  const count = u16(ifd);
  for (let k = 0; k < count; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > end) return null;
    if (u16(e) !== 0x0112) continue;
    if (u16(e + 2) !== 3) return null; // must be a SHORT
    const v = u16(e + 8);
    return v >= 1 && v <= 8 ? { orientation: v, at: e + 8 } : null;
  }
  return null;
}

/**
 * Exif orientation `o` as a matrix from stored pixel space (`w` × `h`, y
 * down) to shown pixel space, turning the image as decoders (CanvasKit's
 * included) do. The identity for 1 or anything unknown.
 */
export function orientationMatrix(o: number, w: number, h: number): Matrix {
  switch (o) {
    case 2: return [-1, 0, 0, 1, w, 0];
    case 3: return [-1, 0, 0, -1, w, h];
    case 4: return [1, 0, 0, -1, 0, h];
    case 5: return [0, 1, 1, 0, 0, 0];
    case 6: return [0, 1, -1, 0, h, 0];
    case 7: return [0, -1, -1, 0, h, w];
    case 8: return [0, -1, 1, 0, 0, w];
    default: return [1, 0, 0, 1, 0, 0];
  }
}

/**
 * The file with its Exif orientation set to 1 (stored as shown), for
 * writers that turn the image themselves: SVG and PDF viewers disagree on
 * whether to honour the tag. `bytes` itself when there is nothing to change.
 */
export function withoutOrientation(bytes: Uint8Array, info: ImageInfo): Uint8Array {
  const at = info.jpeg?.orientationAt;
  if (at === null || at === undefined || info.orientation === 1) return bytes;
  const out = bytes.slice();
  // A SHORT from 2 to 8: its non-zero byte says the byte order, 00 0n (big-endian) or 0n 00 (little-endian).
  const le = (out[at] ?? 0) !== 0;
  out[at] = le ? 1 : 0;
  out[at + 1] = le ? 0 : 1;
  return out;
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
  | { kind: "paths"; fills: readonly FillPath[]; stroke: readonly number[]; /** Arrow-head triangles, filled with the stroke paints. */ capFill?: readonly number[] | undefined }
  | { kind: "text" }
  | { kind: "none" };

/** The outline the renderer draws for `n` (groups and pages have none). */
export function outlineOf(n: ReadonlyNode, src?: { children(id: string): readonly ReadonlyNode[] }): Outline {
  const geo = shapeGeometry(n, src);
  if (geo) return { kind: "paths", fills: geo.fills, stroke: geo.stroke, capFill: geo.capFill };
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
  const lh = lineHeightPx(n) ?? content;
  const texts = (n.characters ?? "").split(/\r\n|[\n\r\u2028\u2029]/);
  // Vertical alignment in the box, as the renderer places the paragraph.
  const align = n.textAlignVertical === "CENTER" ? 0.5 : n.textAlignVertical === "BOTTOM" ? 1 : 0;
  const first = (lh - content) / 2 + ASCENT * size + (n.height - texts.length * lh) * align;
  return texts.map((text, i) => ({ text, left: 0, baseline: first + i * lh }));
}

/** Where `fallbackTextLines` lines are anchored: SVG's `text-anchor` and its x in the layer, for horizontal alignment. */
export function fallbackTextAnchor(n: ReadonlyNode): { anchor: "start" | "middle" | "end"; x: number } {
  if (n.textAlignHorizontal === "CENTER") return { anchor: "middle", x: n.width / 2 };
  if (n.textAlignHorizontal === "RIGHT") return { anchor: "end", x: n.width };
  return { anchor: "start", x: 0 };
}

const blends = (mode: BlendMode | null | undefined): boolean => !!mode && mode !== "NORMAL" && mode !== "PASS_THROUGH";

/**
 * True if some visible descendant blends with a mode of its own (layer or
 * paint), so a NORMAL parent must keep it from blending with what is under
 * the parent. As the renderer decides.
 */
export function blendsInside(children: (id: string) => readonly ReadonlyNode[], kids: readonly ReadonlyNode[]): boolean {
  for (const k of kids) {
    if (!k.visible) continue;
    if (blends(k.blendMode)) return true;
    if ([...k.fills, ...k.strokes].some((p) => p.visible && blends(p.blendMode))) return true;
    if (blendsInside(children, children(k.id))) return true;
  }
  return false;
}

/**
 * Whether the renderer casts `n`'s shadows from its outline (opaque
 * geometry) rather than from the pixels it draws: shapes without children,
 * and frames with children and a visible fill.
 */
export function shadowsFromOutline(n: ReadonlyNode, hasKids: boolean): boolean {
  if (n.type === "GROUP" || n.type === "PAGE" || n.type === "TEXT") return false;
  return !hasKids || (CLIPPING.has(n.type) && n.fills.some((p) => p.visible));
}

/**
 * The least opacity of `n`'s visible fills and strokes (gradients: their
 * most transparent stop; images count as opaque), from 0 to 1.
 */
export function leastPaintAlpha(n: ReadonlyNode): number {
  let least = 1;
  const stroked = n.strokeWeight > 0;
  for (const p of [...n.fills, ...(stroked ? n.strokes : [])]) {
    if (!p.visible) continue;
    let a = clamp01(p.opacity ?? 1);
    if (p.type === "SOLID") a *= clamp01(p.color.a);
    else if (p.type !== "IMAGE") a *= Math.min(1, ...p.gradientStops.map((s) => clamp01(s.color.a)));
    least = Math.min(least, a);
  }
  return least;
}

/** A small number written without exponent notation, to at least 4 significant digits (for scales far below 1). */
export function fmtFine(v: number): string {
  if (!Number.isFinite(v) || Math.abs(v) >= 1e-3 || v === 0) return fmt(v);
  const digits = Math.min(20, 4 - Math.floor(Math.log10(Math.abs(v))));
  const s = v.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
  return s === "-0" || /^-?0$/.test(s) ? "0" : s;
}

/** A 53-bit hash of a string (cyrb53), as base-36 text: a short, deterministic fingerprint. */
export function hashText(s: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
