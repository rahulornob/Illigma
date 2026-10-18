/**
 * Export settings, named after Figma's Plugin API (`ExportSettings`), plus
 * Illigma's JPG quality. A layer can carry several of them, one per file.
 */

export type ExportFormat = "PNG" | "JPG" | "SVG" | "PDF";
export const EXPORT_FORMATS: readonly ExportFormat[] = ["PNG", "JPG", "SVG", "PDF"];

/** How raster exports are sized: a multiplier (`2x`), or a fixed width (`512w`) or height (`512h`) in pixels. */
export interface ExportConstraint {
  type: "SCALE" | "WIDTH" | "HEIGHT";
  value: number;
}

interface ExportSettingsBase {
  /** Added to the file name before the extension, e.g. "@2x". Default "". */
  suffix?: string;
  /**
   * true (default): only the layer and its children. false: everything on the
   * page that shows inside the layer's bounds, as on the canvas.
   */
  contentsOnly?: boolean;
  /**
   * false (default): the bounds of what the layer draws, strokes and
   * clipped children included. true: the layer's own box, whatever it holds.
   */
  useAbsoluteBounds?: boolean;
}

export interface ExportSettingsImage extends ExportSettingsBase {
  format: "PNG" | "JPG";
  /** Default { type: "SCALE", value: 1 }. */
  constraint?: ExportConstraint;
  /** JPG only: 0 (smallest) to 100 (best). Default 90 (Figma's "High"). */
  quality?: number;
}

export interface ExportSettingsSVG extends ExportSettingsBase {
  format: "SVG";
  /** Text as glyph outlines. Not supported yet: text is always written as `<text>`. Default false. */
  svgOutlineText?: boolean;
  /** Layer names as `id` attributes. Default false. */
  svgIdAttribute?: boolean;
  /** Accepted for Figma parity. Strokes are always centred, so they are written as strokes either way. Default true. */
  svgSimplifyStroke?: boolean;
}

export interface ExportSettingsPDF extends ExportSettingsBase {
  format: "PDF";
}

export type ExportSettings = ExportSettingsImage | ExportSettingsSVG | ExportSettingsPDF;

export const DEFAULT_JPG_QUALITY = 90;

/** Raster size limits. Larger images would not fit in memory in a browser tab. */
export interface ExportLimits {
  /** Largest width or height, in pixels. Default 16,384. */
  maxDimension: number;
  /** Largest width × height, in pixels. Default 134,217,728 (16,384 × 8,192, 512 MB of pixels). */
  maxPixels: number;
}

export const DEFAULT_EXPORT_LIMITS: Readonly<ExportLimits> = Object.freeze({ maxDimension: 16_384, maxPixels: 16_384 * 8_192 });

/** An export that can't be made. The message is plain language, ready to show. */
export class ExportError extends Error {
  override readonly name = "ExportError";
}

export const MIME_TYPES: Readonly<Record<ExportFormat, string>> = Object.freeze({
  PNG: "image/png",
  JPG: "image/jpeg",
  SVG: "image/svg+xml",
  PDF: "application/pdf",
});

export const EXTENSIONS: Readonly<Record<ExportFormat, string>> = Object.freeze({ PNG: "png", JPG: "jpg", SVG: "svg", PDF: "pdf" });

/** Throws `ExportError` when settings can't be used. */
export function checkSettings(settings: ExportSettings): void {
  if (!settings || !EXPORT_FORMATS.includes(settings.format)) {
    throw new ExportError(`Unknown export format ${JSON.stringify((settings as { format?: unknown } | null)?.format)}. Use PNG, JPG, SVG or PDF.`);
  }
  if (settings.suffix !== undefined && typeof settings.suffix !== "string") throw new ExportError("The suffix must be text.");
  if (settings.format === "PNG" || settings.format === "JPG") {
    const c = settings.constraint;
    if (c) {
      if (c.type !== "SCALE" && c.type !== "WIDTH" && c.type !== "HEIGHT") throw new ExportError(`Unknown size ${JSON.stringify(c.type)}. Use SCALE, WIDTH or HEIGHT.`);
      if (!Number.isFinite(c.value) || c.value <= 0) {
        throw new ExportError(c.type === "SCALE" ? "The scale must be a number greater than 0." : `The ${c.type === "WIDTH" ? "width" : "height"} must be a number of pixels greater than 0.`);
      }
    }
    const q = settings.quality;
    if (q !== undefined && (!Number.isFinite(q) || q < 0 || q > 100)) throw new ExportError("JPG quality must be a number from 0 to 100.");
  }
}
