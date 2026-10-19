/**
 * Effects cast from a layer's pixels (groups, text, frames without a fill):
 * drop and inner shadows with spread, and layer blur, built so their cost on
 * CPU surfaces (export, the CPU fallback canvas) stays near the cost of the
 * pixels they cover, whatever the spread and blur.
 *
 * Spread. Skia's morphology filters (`ImageFilter.MakeDilate` / `MakeErode`)
 * visit every pixel within the radius, for every pixel, and in CanvasKit's
 * CPU build they cost about a microsecond per pixel per radius step: a 300 px
 * spread on a 2000 × 2000 surface took over a minute. Here a dilation by R
 * pixels is a chain of about log2(2R) cheap passes, each the maximum of the
 * image and a shifted copy of itself (shifts of 1, 2, 4, … pixels add up to
 * the whole window). The result matches `MakeDilate` pixel for pixel (both
 * round the radius to whole device pixels).
 *
 * The maximum of two alphas isn't a blend mode, but it is one for opaque
 * colours: `Lighten` of two opaque greys is the lighter grey. So the layer's
 * alpha is first moved into the colour channels of an opaque image (wherever
 * it isn't fully transparent, so the image keeps the layer's bounds), and
 * moved back at the end. Erosion uses `Darken` (the minimum) and keeps only
 * pixels both copies cover.
 *
 * Each pass is a `Compose` whose outer filter reads its source twice: the
 * source is the inner chain's finished image, so nothing is computed twice
 * (an input shared by two filters is computed for each, which doubles the
 * work per pass).
 *
 * Reduced resolution. When the passes would still cost too much for the area
 * involved, or the blur is wide (Skia's CPU blur gets slow at large sigmas),
 * the work runs on a copy reduced by a power of two (each halving an exact
 * 2 × 2 average, so thin lines aren't lost) and the result is scaled back up.
 * A wide blur hides the reduction completely; a spread with little blur gets
 * edges within about one reduced pixel of where they should be, a little
 * softer.
 *
 * On the GPU, Skia's own filters are fast enough, and exact: they are used
 * as they are there.
 */

import type { CanvasKit, Color, ImageFilter } from "canvaskit-wasm";

/** Alpha into opaque grey: R = G = B = alpha; alpha = 1 wherever alpha isn't 0 (transparent stays transparent). */
const ENCODE = [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 255, 0];
/** Back: alpha = the grey. */
const DECODE = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0];
/** Keep the grey, make every covered pixel opaque again (after averaging, edge pixels are partly covered). */
const RESTEP = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 255, 0];

/**
 * Pixel-passes the spread may cost before it runs at reduced resolution:
 * about 150 ms of CanvasKit's CPU raster pipeline (≈ 100 ns per pixel per pass).
 */
export const SPREAD_BUDGET = 1_500_000;
/** Spread never reduces by more than this: past it, edges get visibly blocky. */
const MAX_SPREAD_REDUCTION = 16;
/** A blur reduces by at most this. */
const MAX_BLUR_REDUCTION = 64;

/** Shift sizes (in pixels) whose running maxima cover a window `width` pixels wide (offsets 0…width). */
export function passSteps(width: number): number[] {
  const out: number[] = [];
  let sum = 0;
  while (sum < width) {
    const s = Math.min(sum + 1, width - sum);
    out.push(s);
    sum += s;
  }
  return out;
}

/**
 * How much to reduce the image (1, 2, 4, …) for a spread of `radius` device
 * pixels over `area` device pixels to stay within SPREAD_BUDGET.
 */
export function spreadReduction(radius: number, area: number): number {
  let k = 1;
  for (;;) {
    const r = Math.round(radius / k);
    const cost = (area / (k * k)) * 2 * passSteps(2 * r).length;
    if (cost <= SPREAD_BUDGET || k >= MAX_SPREAD_REDUCTION || r <= 1) return k;
    k *= 2;
  }
}

/** How much a Gaussian blur of `sigma` device pixels can be reduced without a visible difference: sigma stays ≥ 4 reduced pixels. */
export function blurReduction(sigma: number): number {
  let k = 1;
  while (k * 2 <= MAX_BLUR_REDUCTION && sigma >= 8 * k) k *= 2;
  return k;
}

export interface PixelShadow {
  /** Offset, blur sigma and spread, in local units (Figma's `radius` is 2 × sigma). */
  dx: number;
  dy: number;
  sigma: number;
  spread: number;
  color: Color;
}

/** Where the filters run: device pixels per local unit, the device pixels involved, and whether on the GPU. */
export interface PixelTarget {
  scale: number;
  /** Device pixels of the layer's content grown by the spread (capped at the surface), for the cost estimate. */
  area: number;
  gpu: boolean;
}

type Keep = (f: ImageFilter) => ImageFilter;

/** Halve `input` `k` times over (k a power of two), as exact 2 × 2 averages; `restep` keeps encoded alpha opaque. */
function reduce(ck: CanvasKit, input: ImageFilter | null, k: number, keep: Keep, restep: boolean): ImageFilter | null {
  const IF = ck.ImageFilter;
  let f = input;
  const cf = restep ? ck.ColorFilter.MakeMatrix(RESTEP) : null;
  for (let s = 1; s < k; s *= 2) {
    f = keep(IF.MakeMatrixTransform(ck.Matrix.scaled(0.5, 0.5), { filter: ck.FilterMode.Linear }, f));
    if (cf) f = keep(IF.MakeColorFilter(cf, f));
  }
  cf?.delete();
  return f;
}

/** Scale `input` back up by `k`. */
function enlarge(ck: CanvasKit, input: ImageFilter, k: number, keep: Keep): ImageFilter {
  return k > 1 ? keep(ck.ImageFilter.MakeMatrixTransform(ck.Matrix.scaled(k, k), { filter: ck.FilterMode.Linear }, input)) : input;
}

/**
 * The layer's alpha (`input` already reduced by the caller, in reduced
 * pixels) grown (`spread` > 0) or shrunk by `radius` reduced pixels, with a
 * square window. `unit` is one device pixel in local units.
 */
function morph(ck: CanvasKit, input: ImageFilter | null, radius: number, grow: boolean, unit: number, keep: Keep): ImageFilter {
  const IF = ck.ImageFilter;
  let f = input as ImageFilter;
  for (const axis of [0, 1]) {
    for (const step of passSteps(2 * radius)) {
      const d = step * unit;
      const shifted = keep(IF.MakeOffset(axis ? 0 : d, axis ? d : 0, null));
      let pass: ImageFilter;
      if (grow) {
        pass = keep(IF.MakeBlend(ck.BlendMode.Lighten, null, shifted));
      } else {
        // Darken keeps the darker grey where both cover, else whichever covers; DstIn then drops pixels either misses.
        const darker = keep(IF.MakeBlend(ck.BlendMode.Darken, null, shifted));
        pass = keep(IF.MakeBlend(ck.BlendMode.DstIn, keep(IF.MakeBlend(ck.BlendMode.DstIn, darker, null)), shifted));
      }
      f = keep(IF.MakeCompose(pass, f));
    }
  }
  return keep(IF.MakeOffset(-radius * unit, -radius * unit, f)); // the window ran 0…2r: centre it
}

/**
 * A shadow cast from the layer's alpha (only the shadow, not the layer):
 * grown or shrunk by its spread, moved and blurred, in its colour. Every
 * filter made goes to `keep`, which owns them.
 */
export function pixelShadow(ck: CanvasKit, d: PixelShadow, at: PixelTarget, keep: Keep): ImageFilter {
  const IF = ck.ImageFilter;
  const shadowOf = (f: ImageFilter | null, k: number) => keep(IF.MakeDropShadowOnly(d.dx / k, d.dy / k, d.sigma / k, d.sigma / k, d.color, f));
  const deviceRadius = Math.abs(d.spread) * at.scale;
  const spread = at.scale > 0 && Math.round(deviceRadius) >= 1;
  if (at.gpu || !(at.scale > 0)) {
    const s = Math.abs(d.spread);
    if (!spread) return shadowOf(null, 1);
    return shadowOf(keep(d.spread > 0 ? IF.MakeDilate(s, s, null) : IF.MakeErode(s, s, null)), 1);
  }
  const k = Math.max(spread ? spreadReduction(deviceRadius, at.area) : 1, blurReduction(d.sigma * at.scale));
  const radius = spread ? Math.round(deviceRadius / k) : 0;
  if (radius < 1) return enlarge(ck, shadowOf(reduce(ck, null, k, keep, false), k), k, keep);
  const encode = ck.ColorFilter.MakeMatrix(ENCODE);
  const decode = ck.ColorFilter.MakeMatrix(DECODE);
  try {
    let f: ImageFilter | null = keep(IF.MakeColorFilter(encode, null));
    f = reduce(ck, f, k, keep, true);
    // One reduced pixel is one device pixel of the reduced content: the reduction shrinks the content, not the units.
    f = morph(ck, f, radius, d.spread > 0, 1 / at.scale, keep);
    f = keep(IF.MakeColorFilter(decode, f));
    return enlarge(ck, shadowOf(f, k), k, keep);
  } finally {
    encode.delete();
    decode.delete();
  }
}

/** A layer blur of `sigma` local units, on a reduced copy when it is wide (CPU only). */
export function pixelBlur(ck: CanvasKit, sigma: number, at: PixelTarget, keep: Keep): ImageFilter {
  const IF = ck.ImageFilter;
  const k = at.gpu || !(at.scale > 0) ? 1 : blurReduction(sigma * at.scale);
  return enlarge(ck, keep(IF.MakeBlur(sigma / k, sigma / k, ck.TileMode.Decal, reduce(ck, null, k, keep, false))), k, keep);
}
