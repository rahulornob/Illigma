/**
 * Paints, blend modes and effect filters in CanvasKit terms: gradient and
 * image shaders placed in a node's own space the way Figma places them, and
 * Figma's blend modes mapped onto Skia's.
 */

import type { DeepReadonly } from "@illigma/core";
import type { BlendMode, GradientPaint, ImagePaint, Transform } from "@illigma/format";
import type { Blender, CanvasKit, Image, Paint, RuntimeEffect, Shader } from "canvaskit-wasm";

/**
 * Node units per image pixel for an image paint on a `w` × `h` node (an
 * `iw` × `ih` image), to choose how detailed a copy of the image to draw.
 */
export function imagePixelScale(p: DeepReadonly<ImagePaint>, iw: number, ih: number, w: number, h: number): number {
  if (!(iw > 0 && ih > 0)) return 0;
  switch (p.scaleMode) {
    case "FILL":
      return Math.max(w / iw, h / ih);
    case "FIT":
      return Math.min(w / iw, h / ih);
    case "TILE":
      return p.scalingFactor ?? 1;
    case "CROP": {
      const inv = invertTransform(p.imageTransform ?? IDENTITY);
      return inv ? Math.sqrt(Math.abs(inv[0] * inv[4] - inv[1] * inv[3]) * ((w * h) / (iw * ih))) : 0;
    }
  }
  return 0;
}

/** Figma's blur radius (CSS blur) to a Gaussian sigma. */
export const sigma = (radius: number): number => radius / 2;

/** The inverse of an affine `[[a, c, e], [b, d, f]]`, or null when it has none. */
export function invertTransform(t: DeepReadonly<Transform> | Transform): [number, number, number, number, number, number] | null {
  const row = (i: number, j: number) => (t[i] as readonly number[])[j] as number;
  const a = row(0, 0), c = row(0, 1), e = row(0, 2);
  const b = row(1, 0), d = row(1, 1), f = row(1, 2);
  const det = a * d - b * c;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
  return [d / det, -c / det, (c * f - d * e) / det, -b / det, a / det, (b * e - a * f) / det];
}

/**
 * Local matrix (3 × 3, row-major) for a shader drawn in a "unit" space that
 * `t` maps the node's normalised box into: node point = box scale × t⁻¹ × unit point.
 * `ux` and `uy` first scale the shader's own units into unit space (an image's pixels).
 */
function unitToNode(t: DeepReadonly<Transform>, w: number, h: number, ux = 1, uy = 1): number[] | null {
  const inv = invertTransform(t);
  if (!inv) return null;
  const [ia, ic, ie, ib, id, iff] = inv;
  return [w * ia * ux, w * ic * uy, w * ie, h * ib * ux, h * id * uy, h * iff, 0, 0, 1];
}

const IDENTITY: DeepReadonly<Transform> = [
  [1, 0, 0],
  [0, 1, 0],
];

/** SkSL for Figma's diamond gradient: the ramp at 2 × (|dx| + |dy|) from the centre. */
const DIAMOND_SKSL = `
uniform shader ramp;
half4 main(float2 p) {
  float t = 2.0 * (abs(p.x - 0.5) + abs(p.y - 0.5));
  return ramp.eval(float2(t, 0.5));
}`;

/** Separable "linear" modes Skia has no enum for, as premultiplied blenders. */
const LINEAR_BURN_SKSL = `
half4 main(half4 src, half4 dst) {
  half3 c = (1 - dst.a) * src.rgb + (1 - src.a) * dst.rgb + max(src.a * dst.rgb + dst.a * src.rgb - src.a * dst.a, 0);
  return half4(c, src.a + dst.a * (1 - src.a));
}`;
const LINEAR_DODGE_SKSL = `
half4 main(half4 src, half4 dst) {
  half3 c = (1 - dst.a) * src.rgb + (1 - src.a) * dst.rgb + min(src.a * dst.rgb + dst.a * src.rgb, src.a * dst.a);
  return half4(c, src.a + dst.a * (1 - src.a));
}`;

/**
 * A blurred rounded rectangle or ellipse as a shader: its coverage blurred by
 * a Gaussian of `sigma`, from its signed distance (exact along straight edges,
 * close at corners), optionally inverted (the outside: an inner shadow's
 * source). One GPU pass, no offscreen mask, the same cost at every zoom.
 */
const BOX_BLUR_SKSL = `
uniform float2 center;
uniform float2 halfSize;
uniform float radius;
uniform float oval;
uniform float sigma;
uniform float invert;
uniform float4 color;

float erfApprox(float x) {
  float s = sign(x);
  float a = abs(x);
  float t = 1.0 + (0.278393 + (0.230389 + 0.078108 * (a * a)) * a) * a;
  t *= t;
  return s - s / (t * t);
}

half4 main(float2 p) {
  float2 q = p - center;
  float d;
  if (oval > 0.5) {
    float k0 = length(q / halfSize);
    float k1 = length(q / (halfSize * halfSize));
    d = k0 < 0.0001 ? -min(halfSize.x, halfSize.y) : k0 * (k0 - 1.0) / k1;
  } else {
    float r = min(radius, min(halfSize.x, halfSize.y));
    float2 e = abs(q) - halfSize + r;
    d = length(max(e, 0.0)) + min(max(e.x, e.y), 0.0) - r;
  }
  float cover = 0.5 - 0.5 * erfApprox(d / (sigma * 1.41421356));
  float a = color.a * (invert > 0.5 ? 1.0 - cover : cover);
  return half4(color.rgb * a, a);
}`;

/** A box in a node's own space: a rectangle, rounded rectangle (radius r) or ellipse. */
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  r: number;
  oval: boolean;
}

/**
 * CanvasKit objects shared by every paint a renderer draws: compiled
 * runtime effects and blenders, made once on first use. `dispose` frees them.
 */
export class PaintKit {
  private diamond: RuntimeEffect | null | undefined;
  private boxBlurEffect: RuntimeEffect | null | undefined;
  private readonly blenders = new Map<BlendMode, Blender | null>();

  constructor(private readonly ck: CanvasKit) {}

  /**
   * `box` blurred by `sigma` (> 0) in `color`, or with `invert` everything
   * outside it; null without runtime effects (callers fall back to masks).
   */
  boxBlur(box: Box, sigmaValue: number, color: { r: number; g: number; b: number; a: number }, invert: boolean): Shader | null {
    if (this.boxBlurEffect === undefined) this.boxBlurEffect = this.ck.RuntimeEffect?.Make(BOX_BLUR_SKSL) ?? null;
    if (!this.boxBlurEffect || !(sigmaValue > 0)) return null;
    const hw = Math.max(0, (box.x1 - box.x0) / 2);
    const hh = Math.max(0, (box.y1 - box.y0) / 2);
    return this.boxBlurEffect.makeShader([
      (box.x0 + box.x1) / 2,
      (box.y0 + box.y1) / 2,
      Math.max(hw, 1e-3),
      Math.max(hh, 1e-3),
      box.r,
      box.oval ? 1 : 0,
      sigmaValue,
      invert ? 1 : 0,
      color.r,
      color.g,
      color.b,
      color.a,
    ]);
  }

  dispose(): void {
    this.diamond?.delete();
    this.boxBlurEffect?.delete();
    for (const b of this.blenders.values()) b?.delete();
    this.blenders.clear();
  }

  /**
   * Apply a Figma blend mode to `paint`. Returns false for modes that mean
   * plain source-over (NORMAL, PASS_THROUGH, absent).
   */
  setBlend(paint: Paint, mode: BlendMode | undefined): boolean {
    const B = this.ck.BlendMode;
    switch (mode) {
      case undefined:
      case "NORMAL":
      case "PASS_THROUGH":
        paint.setBlendMode(B.SrcOver);
        return false;
      case "LINEAR_BURN":
      case "LINEAR_DODGE": {
        const blender = this.blender(mode);
        if (blender) paint.setBlender(blender);
        else paint.setBlendMode(mode === "LINEAR_BURN" ? B.Multiply : B.Plus);
        return true;
      }
      default:
        paint.setBlendMode(
          {
            DARKEN: B.Darken,
            MULTIPLY: B.Multiply,
            COLOR_BURN: B.ColorBurn,
            LIGHTEN: B.Lighten,
            SCREEN: B.Screen,
            COLOR_DODGE: B.ColorDodge,
            OVERLAY: B.Overlay,
            SOFT_LIGHT: B.SoftLight,
            HARD_LIGHT: B.HardLight,
            DIFFERENCE: B.Difference,
            EXCLUSION: B.Exclusion,
            HUE: B.Hue,
            SATURATION: B.Saturation,
            COLOR: B.Color,
            LUMINOSITY: B.Luminosity,
          }[mode],
        );
        return true;
    }
  }

  private blender(mode: "LINEAR_BURN" | "LINEAR_DODGE"): Blender | null {
    if (!this.blenders.has(mode)) {
      let blender: Blender | null = null;
      const effect = this.ck.RuntimeEffect?.MakeForBlender(mode === "LINEAR_BURN" ? LINEAR_BURN_SKSL : LINEAR_DODGE_SKSL);
      if (effect) {
        blender = effect.makeBlender([]);
        effect.delete();
      }
      this.blenders.set(mode, blender);
    }
    return this.blenders.get(mode) ?? null;
  }

  /** A gradient shader in the node's own space (w × h box), or null if the gradient's transform can't be inverted. */
  gradient(p: DeepReadonly<GradientPaint>, w: number, h: number): Shader | null {
    const ck = this.ck;
    // A zero-size box (a line's height) would make the matrix singular: treat that side as 1 unit.
    const local = unitToNode(p.gradientTransform, w || 1, h || 1);
    if (!local) return null;
    const stops = [...p.gradientStops].sort((a, b) => a.position - b.position);
    if (stops.length === 1) stops.push(stops[0] as (typeof stops)[number]);
    const colors = stops.map((s) => ck.Color4f(s.color.r, s.color.g, s.color.b, s.color.a));
    const pos = stops.map((s) => s.position);
    const clamp = ck.TileMode.Clamp;
    switch (p.type) {
      case "GRADIENT_LINEAR":
        return ck.Shader.MakeLinearGradient([0, 0.5], [1, 0.5], colors, pos, clamp, local);
      case "GRADIENT_RADIAL":
        return ck.Shader.MakeRadialGradient([0.5, 0.5], 0.5, colors, pos, clamp, local);
      case "GRADIENT_ANGULAR":
        return ck.Shader.MakeSweepGradient(0.5, 0.5, colors, pos, clamp, local, 0, 0, 360);
      case "GRADIENT_DIAMOND": {
        if (this.diamond === undefined) this.diamond = ck.RuntimeEffect?.Make(DIAMOND_SKSL) ?? null;
        // Without runtime effects, a radial gradient is the closest stand-in.
        if (!this.diamond) return ck.Shader.MakeRadialGradient([0.5, 0.5], 0.5, colors, pos, clamp, local);
        const ramp = ck.Shader.MakeLinearGradient([0, 0], [1, 0], colors, pos, clamp);
        const shader = this.diamond.makeShaderWithChildren([], [ramp], local);
        ramp.delete();
        return shader;
      }
    }
  }

  /** An image shader in the node's own space (w × h box), following the paint's scale mode. */
  /**
   * `img` is a smaller copy (level) of the paint's image when `factor` > 1:
   * the image's width over the copy's. `mipmaps` false samples without them
   * (for textures, where Skia would rebuild them on every draw).
   */
  image(p: DeepReadonly<ImagePaint>, img: Image, w: number, h: number, factor = 1, mipmaps = true): Shader | null {
    const ck = this.ck;
    const iw = img.width();
    const ih = img.height();
    if (!(iw > 0 && ih > 0 && w > 0 && h > 0)) return null;
    const T = ck.TileMode;
    let local: number[] | null;
    let tile = T.Decal;
    switch (p.scaleMode) {
      case "FILL":
      case "FIT": {
        const s = p.scaleMode === "FILL" ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
        local = [s, 0, (w - iw * s) / 2, 0, s, (h - ih * s) / 2, 0, 0, 1];
        break;
      }
      case "TILE": {
        const s = (p.scalingFactor ?? 1) * factor; // tile size in the full image's pixels
        local = [s, 0, 0, 0, s, 0, 0, 0, 1];
        tile = T.Repeat;
        break;
      }
      case "CROP":
        local = unitToNode(p.imageTransform ?? IDENTITY, w, h, 1 / iw, 1 / ih);
        break;
    }
    if (!local) return null;
    return img.makeShaderOptions(tile, tile, ck.FilterMode.Linear, mipmaps ? ck.MipmapMode.Linear : ck.MipmapMode.None, local);
  }
}
