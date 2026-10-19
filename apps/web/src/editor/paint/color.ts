/**
 * Colour conversions for the colour picker: hex, RGB (0–255), HSL and HSB
 * (hue 0–360, the rest 0–100), all from and to the file format's `Color`
 * (sRGB channels 0–1 plus alpha 0–1). Pure functions, no DOM.
 */

import type { Color } from "@illigma/format";

export interface Hsv {
  /** 0–360. */
  h: number;
  /** 0–1. */
  s: number;
  /** 0–1. */
  v: number;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export type ColorFormat = "HEX" | "RGB" | "HSL" | "HSB";
export const COLOR_FORMATS: readonly ColorFormat[] = ["HEX", "RGB", "HSL", "HSB"];
export const FORMAT_LABEL: Record<ColorFormat, string> = { HEX: "Hex", RGB: "RGB", HSL: "HSL", HSB: "HSB" };

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const byte = (v: number) => Math.round(clamp01(v) * 255);
const hex2 = (v: number) => byte(v).toString(16).padStart(2, "0").toUpperCase();
/** Hue in [0, 360). */
const wrapHue = (h: number) => (Number.isFinite(h) ? ((h % 360) + 360) % 360 : 0);

/** "FF5B2E" (no #, upper case, no alpha). */
export function toHex(c: Pick<Color, "r" | "g" | "b">): string {
  return `${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;
}

/** "FF5B2ECC": with alpha, for keys that tell two colours apart. */
export function toHex8(c: Color): string {
  return `${toHex(c)}${hex2(c.a)}`;
}

/**
 * Read a typed hex colour: 3, 4, 6 or 8 digits, with or without "#".
 * Returns null for anything else. Alpha is 1 unless the text gives it.
 */
export function parseHex(text: string): Color | null {
  let t = text.trim().replace(/^#/, "");
  if (!/^[0-9a-f]+$/i.test(t)) return null;
  if (t.length === 3 || t.length === 4) t = [...t].map((ch) => ch + ch).join("");
  // Two digits: a grey, as in Figma ("33" → 333333).
  if (t.length === 2) t = t.repeat(3);
  if (t.length === 1) t = t.repeat(6);
  if (t.length !== 6 && t.length !== 8) return null;
  const n = (i: number) => Number.parseInt(t.slice(i, i + 2), 16) / 255;
  return { r: n(0), g: n(2), b: n(4), a: t.length === 8 ? n(6) : 1 };
}

/** True when typed hex carries its own alpha: four digits (#rgba) or eight (#rrggbbaa). */
export function hexHasAlpha(text: string): boolean {
  const t = text.trim().replace(/^#/, "");
  return /^[0-9a-f]+$/i.test(t) && (t.length === 4 || t.length === 8);
}

/** RGB channels 0–255, rounded. */
export function toRgb255(c: Pick<Color, "r" | "g" | "b">): [number, number, number] {
  return [byte(c.r), byte(c.g), byte(c.b)];
}

export function fromRgb255(r: number, g: number, b: number, a = 1): Color {
  return { r: clamp01(r / 255), g: clamp01(g / 255), b: clamp01(b / 255), a: clamp01(a) };
}

export function rgbToHsv(c: Pick<Color, "r" | "g" | "b">): Hsv {
  const r = clamp01(c.r);
  const g = clamp01(c.g);
  const b = clamp01(c.b);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = wrapHue(h * 60);
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToRgb(hsv: Hsv, a = 1): Color {
  const h = wrapHue(hsv.h) / 60;
  const s = clamp01(hsv.s);
  const v = clamp01(hsv.v);
  const f = (n: number) => {
    const k = (n + h) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return { r: f(5), g: f(3), b: f(1), a: clamp01(a) };
}

export function rgbToHsl(c: Pick<Color, "r" | "g" | "b">): Hsl {
  const { h, s: sv, v } = rgbToHsv(c);
  const l = v * (1 - sv / 2);
  const s = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l);
  return { h, s, l };
}

export function hslToRgb(hsl: Hsl, a = 1): Color {
  const l = clamp01(hsl.l);
  const sl = clamp01(hsl.s);
  const v = l + sl * Math.min(l, 1 - l);
  const s = v === 0 ? 0 : 2 * (1 - l / v);
  return hsvToRgb({ h: hsl.h, s, v }, a);
}

export function hsvToHsl(hsv: Hsv): Hsl {
  const l = hsv.v * (1 - hsv.s / 2);
  const s = l === 0 || l === 1 ? 0 : (hsv.v - l) / Math.min(l, 1 - l);
  return { h: hsv.h, s, l };
}

export function hslToHsv(hsl: Hsl): Hsv {
  const v = hsl.l + hsl.s * Math.min(hsl.l, 1 - hsl.l);
  return { h: hsl.h, s: v === 0 ? 0 : 2 * (1 - hsl.l / v), v };
}

/** Two colours that look the same once written as 8-bit channels. */
export function sameColor(a: Color, b: Color): boolean {
  return toHex8(a) === toHex8(b);
}

/**
 * The HSV to show for `color`, keeping `prev`'s hue (and saturation) where the
 * colour alone can't say: a grey has no hue, black has no saturation. Without
 * this, dragging to black would throw the hue away.
 */
export function hsvFor(color: Color, prev: Hsv | null): Hsv {
  const next = rgbToHsv(color);
  if (prev && sameColor(hsvToRgb(prev, color.a), color)) return prev;
  if (!prev) return next;
  if (next.v === 0) return { h: prev.h, s: prev.s, v: 0 };
  if (next.s === 0) return { h: prev.h, s: 0, v: next.v };
  return next;
}

/** "rgba(255, 91, 46, 0.5)" for CSS swatches. */
export function cssColor(c: Color, alpha = c.a): string {
  const [r, g, b] = toRgb255(c);
  return `rgba(${r}, ${g}, ${b}, ${Math.round(clamp01(alpha) * 1000) / 1000})`;
}

/** Linear interpolation between two colours, channel by channel (as gradients draw). */
export function mixColor(a: Color, b: Color, t: number): Color {
  const k = clamp01(t);
  return { r: a.r + (b.r - a.r) * k, g: a.g + (b.g - a.g) * k, b: a.b + (b.b - a.b) * k, a: a.a + (b.a - a.a) * k };
}

/** Values the fields of `format` show for `color` (alpha separate), rounded for display. */
export function formatChannels(format: Exclude<ColorFormat, "HEX">, color: Color, hsv: Hsv): [number, number, number] {
  if (format === "RGB") return toRgb255(color);
  if (format === "HSB") return [Math.round(hsv.h), Math.round(hsv.s * 100), Math.round(hsv.v * 100)];
  const hsl = hsvToHsl(hsv);
  return [Math.round(hsl.h), Math.round(hsl.s * 100), Math.round(hsl.l * 100)];
}

/** The colour (and HSV) for typed channel values in `format`. */
export function fromChannels(format: Exclude<ColorFormat, "HEX">, values: readonly [number, number, number], alpha: number): { color: Color; hsv: Hsv } {
  const [x, y, z] = values;
  if (format === "RGB") {
    const color = fromRgb255(x, y, z, alpha);
    return { color, hsv: rgbToHsv(color) };
  }
  if (format === "HSB") {
    const hsv = { h: wrapHue(x), s: clamp01(y / 100), v: clamp01(z / 100) };
    return { color: hsvToRgb(hsv, alpha), hsv };
  }
  const hsl = { h: wrapHue(x), s: clamp01(y / 100), l: clamp01(z / 100) };
  const hsv = hslToHsv(hsl);
  return { color: hsvToRgb(hsv, alpha), hsv };
}
