/**
 * PNG and JPG export: the renderer's own drawing code, on an offscreen CPU
 * surface (CanvasKit's raster backend, which runs in browsers, workers and Node).
 */

import type { ReadonlyNode } from "@illigma/core";
import { PageRenderer, type FontSource, type RenderSource } from "@illigma/renderer";
import type { CanvasKit, Surface } from "canvaskit-wasm";
import { encodeJpeg } from "./jpeg.js";
import { localMatrix, type ExportScene, type ExportSource, type Matrix } from "./scene.js";
import { DEFAULT_EXPORT_LIMITS, DEFAULT_JPG_QUALITY, ExportError, type ExportLimits, type ExportSettingsImage } from "./settings.js";

const NO_CHANGES = () => () => {};

/** A read-only view of an export source, as the renderer reads documents. */
export function renderSource(source: ExportSource): RenderSource {
  return { get: (id) => source.get(id), children: (id) => source.children(id), subscribe: NO_CHANGES };
}

/**
 * One renderer, reused for every raster export in a batch, so fonts are
 * registered once. It never draws to its own surface: export draws each
 * subtree onto a fresh one with `drawSubtree`.
 */
export class RasterContext {
  private renderer: PageRenderer | null = null;
  private surface: Surface | null = null;

  constructor(
    readonly ck: CanvasKit,
    private readonly source: ExportSource,
    private readonly fonts: readonly FontSource[] = [],
  ) {}

  get hasFonts(): boolean {
    return this.fonts.length > 0;
  }

  /** The shared renderer; its page id is unused, since nothing is recorded. */
  get pageRenderer(): PageRenderer {
    if (!this.renderer) {
      this.surface = this.ck.MakeSurface(1, 1);
      if (!this.surface) throw new ExportError("Couldn't start the image exporter: the drawing engine is out of memory.");
      this.renderer = new PageRenderer(this.ck, this.surface, renderSource(this.source), "", 1, { fonts: [...this.fonts] });
    }
    return this.renderer;
  }

  dispose(): void {
    this.renderer?.dispose();
    this.surface?.delete();
    this.renderer = null;
    this.surface = null;
  }
}

export interface PixelSize {
  width: number;
  height: number;
  /** Pixels per unit. */
  scale: number;
}

/** The pixel size of a raster export, checked against `limits`. Throws `ExportError` with a plain-language reason. */
export function rasterSize(scene: ExportScene, settings: ExportSettingsImage, limits: ExportLimits = DEFAULT_EXPORT_LIMITS): PixelSize {
  const { width: w, height: h } = scene.region;
  const c = settings.constraint ?? { type: "SCALE", value: 1 };
  const label = `“${scene.node.name}”`;
  let scale: number;
  if (c.type === "SCALE") scale = c.value;
  else {
    const side = c.type === "WIDTH" ? w : h;
    if (!(side > 0)) throw new ExportError(`${label} has no ${c.type === "WIDTH" ? "width" : "height"}, so it can't be exported at a fixed ${c.type === "WIDTH" ? "width" : "height"}. Use a scale instead.`);
    scale = c.value / side;
  }
  const width = Math.max(1, Math.round(w * scale));
  const height = Math.max(1, Math.round(h * scale));
  const at = c.type === "SCALE" ? `at ${c.value}x` : `at ${c.value} px ${c.type === "WIDTH" ? "wide" : "high"}`;
  if (width > limits.maxDimension || height > limits.maxDimension) {
    throw new ExportError(
      `${label} is too big to export ${at}: the image would be ${fmtInt(width)} × ${fmtInt(height)} px, and the most an export can be is ${fmtInt(limits.maxDimension)} px on each side. Try a smaller scale.`,
    );
  }
  if (width * height > limits.maxPixels) {
    throw new ExportError(
      `${label} is too big to export ${at}: the image would have ${fmtInt(width * height)} pixels, and the most an export can have is ${fmtInt(limits.maxPixels)}. Try a smaller scale.`,
    );
  }
  return { width, height, scale };
}

const fmtInt = (n: number) => n.toLocaleString("en-US");

/** Draw a scene at `size` and encode it. PNG keeps transparency; JPG is drawn over white. */
export function exportRaster(ctx: RasterContext, scene: ExportScene, settings: ExportSettingsImage, size: PixelSize): Uint8Array {
  const ck = ctx.ck;
  const surface = ck.MakeSurface(size.width, size.height);
  if (!surface) {
    throw new ExportError(`There isn't enough memory to export “${scene.node.name}” at ${fmtInt(size.width)} × ${fmtInt(size.height)} px. Try a smaller scale.`);
  }
  try {
    const canvas = surface.getCanvas();
    canvas.clear(settings.format === "JPG" ? ck.WHITE : ck.TRANSPARENT);
    canvas.save();
    canvas.scale(size.scale, size.scale);
    canvas.translate(-scene.region.x, -scene.region.y);
    canvas.concat(toCanvasMatrix(scene.rootMatrix));
    const renderer = ctx.pageRenderer;
    for (const root of scene.roots) renderer.drawSubtree(canvas, root.id);
    canvas.restore();
    surface.flush();
    const image = surface.makeImageSnapshot();
    try {
      if (settings.format === "JPG") {
        const quality = Math.round(settings.quality ?? DEFAULT_JPG_QUALITY);
        // CanvasKit's full build encodes JPEG; the default build doesn't, so encode the pixels here.
        const native = image.encodeToBytes(ck.ImageFormat.JPEG, quality);
        if (native) return native;
        const px = canvas.readPixels(0, 0, { width: size.width, height: size.height, colorType: ck.ColorType.RGBA_8888, alphaType: ck.AlphaType.Unpremul, colorSpace: ck.ColorSpace.SRGB });
        if (!px) throw new ExportError(`Couldn't read the pixels of “${scene.node.name}” to encode them as JPG.`);
        return encodeJpeg(px as Uint8Array, size.width, size.height, quality);
      }
      const bytes = image.encodeToBytes(ck.ImageFormat.PNG, 100);
      if (!bytes) throw new ExportError(`Couldn't encode “${scene.node.name}” as PNG.`);
      return bytes;
    } finally {
      image.delete();
    }
  } finally {
    surface.delete();
  }
}

/** A 2D affine matrix as CanvasKit's row-major 3 × 3. */
function toCanvasMatrix(m: Matrix): number[] {
  return [m[0], m[2], m[4], m[1], m[3], m[5], 0, 0, 1];
}

/**
 * RGBA pixels (unpremultiplied) of one leaf layer in its own space
 * (unrotated): the `area` from its top-left, fitted to `width` × `height`
 * pixels, for the PDF writer's text fallback. The layer's opacity is in the
 * pixels. `null` if the surface can't be made.
 */
export function rasterizeLeaf(ctx: RasterContext, n: ReadonlyNode, width: number, height: number, area: { width: number; height: number }): Uint8Array | null {
  if (!(area.width > 0) || !(area.height > 0)) return null;
  const ck = ctx.ck;
  const surface = ck.MakeSurface(width, height);
  if (!surface) return null;
  try {
    const canvas = surface.getCanvas();
    canvas.clear(ck.TRANSPARENT);
    canvas.scale(width / area.width, height / area.height);
    // drawSubtree applies the layer's x, y and rotation; undo them.
    canvas.concat(toCanvasMatrix(invert(localMatrix(n))));
    ctx.pageRenderer.drawSubtree(canvas, n.id);
    surface.flush();
    const px = canvas.readPixels(0, 0, { width, height, colorType: ck.ColorType.RGBA_8888, alphaType: ck.AlphaType.Unpremul, colorSpace: ck.ColorSpace.SRGB });
    return px ? Uint8Array.from(px as Uint8Array) : null;
  } finally {
    surface.delete();
  }
}

/** Inverse of a rotation-and-translation matrix. */
function invert(m: Matrix): Matrix {
  const det = m[0] * m[3] - m[1] * m[2];
  const a = m[3] / det, b = -m[1] / det, c = -m[2] / det, d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
}
