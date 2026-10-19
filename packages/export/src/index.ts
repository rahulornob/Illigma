/**
 * `@illigma/export`: PNG, JPG, SVG and PDF files from layers, with Figma's
 * export settings and file names. Runs in browsers, workers and Node: it
 * never touches the disk. The app decides where the bytes go.
 */

import type { ReadonlyNode } from "@illigma/core";
import type { NodeId } from "@illigma/format";
import type { FontSource, TextLine } from "@illigma/renderer";
import type { CanvasKit, Typeface } from "canvaskit-wasm";
import { exportFilename, takenNames, uniqueFilename } from "./filename.js";
import { writePdf, type PdfWriterOptions, type RasterText } from "./pdf.js";
import { exportRaster, rasterizeLeaf, rasterSize, RasterContext } from "./raster.js";
import { draws, exportScene, hasText, textLinesBounds, type ExportScene, type ExportSource, type Rect, type TextBounds } from "./scene.js";
import { checkSettings, DEFAULT_EXPORT_LIMITS, ExportError, MIME_TYPES, type ExportLimits, type ExportSettings, type ExportSettingsPDF } from "./settings.js";
import { writeSvg } from "./svg.js";
import { fallbackTextLines, imageSize } from "./vector-common.js";

export { exportFilename, sanitizeFilePart, uniqueFilename } from "./filename.js";
export { pdfString, writePdf, type PdfWriterOptions, type RasterText } from "./pdf.js";
export { rasterSize, type PixelSize } from "./raster.js";
export { exportScene, renderBounds, textLinesBounds, type ExportScene, type ExportSource, type Matrix, type Rect, type TextBounds } from "./scene.js";
export * from "./settings.js";
export { escapeAttr, escapeText, svgPathData, writeSvg, type SvgWriterOptions } from "./svg.js";

/** What raster export and text need. Vector export works without any of it, except text in PDFs. */
export interface ExportDeps {
  /** CanvasKit, already loaded. Needed for PNG and JPG, for text in PDFs, and for SVG text to wrap as on the canvas. */
  canvasKit?: CanvasKit;
  /** Fonts for text, as the renderer takes them. The first family is the fallback. */
  fonts?: readonly FontSource[];
  /** Raster size limits; defaults to `DEFAULT_EXPORT_LIMITS`. */
  limits?: Partial<ExportLimits>;
}

export interface ExportedFile {
  nodeId: NodeId;
  settings: ExportSettings;
  /** Relative path: "<layer name><suffix>.<ext>", with folders from "/" in the name. */
  filename: string;
  mime: string;
  bytes: Uint8Array;
  /** Pixels for PNG and JPG; design units (1 px = 1 pt in PDF) for SVG and PDF. */
  width: number;
  height: number;
  /** What the file leaves out or approximates, in plain language. */
  warnings: string[];
}

/** One layer and one of its export settings. */
export interface ExportRequest {
  nodeId: NodeId;
  settings: ExportSettings;
}

export interface ExportFailure extends ExportRequest {
  filename: string;
  message: string;
}

export interface BatchResult {
  files: ExportedFile[];
  /** Exports that failed, with why. The others still succeeded; retry these on their own. */
  failures: ExportFailure[];
}

/** Characters that draw no glyph of their own: controls, format characters (joiners, direction marks), separators and spaces, variation selectors. */
const NO_GLYPH_NEEDED = /^[\p{Cc}\p{Cf}\p{Z}\uFE00-\uFE0F\u{E0100}-\u{E01EF}]$/u;

/** Lazily made CanvasKit state shared by a batch. */
class Session {
  private raster: RasterContext | null = null;

  constructor(
    readonly source: ExportSource,
    readonly deps: ExportDeps,
  ) {}

  get limits(): ExportLimits {
    return { ...DEFAULT_EXPORT_LIMITS, ...this.deps.limits };
  }

  get hasTextEngine(): boolean {
    return !!this.deps.canvasKit && !!this.deps.fonts?.length;
  }

  context(): RasterContext {
    const ck = this.deps.canvasKit;
    if (!ck) throw new ExportError("PNG and JPG export need the drawing engine (CanvasKit), which isn't loaded.");
    this.raster ??= new RasterContext(ck, this.source, this.deps.fonts ?? []);
    return this.raster;
  }

  dispose(): void {
    this.raster?.dispose();
    this.raster = null;
    for (const t of this.typefaces ?? []) t.delete();
    this.typefaces = null;
  }

  /** The loaded fonts as typefaces, for checking which characters they have. */
  private typefaces: Typeface[] | null = null;

  /**
   * Characters in the TEXT layers under `roots` that none of the loaded
   * fonts has: the text engine draws them as empty boxes. Spaces, controls
   * and invisible format characters don't count. Empty without fonts.
   */
  missingGlyphs(roots: readonly ReadonlyNode[]): string[] {
    const ck = this.deps.canvasKit;
    if (!ck || !this.deps.fonts?.length) return [];
    const factory = ck.Typeface as unknown as { MakeTypefaceFromData?: (d: ArrayBuffer) => Typeface | null; MakeFreeTypeFaceFromData?: (d: ArrayBuffer) => Typeface | null } | undefined;
    const make = factory?.MakeTypefaceFromData ?? factory?.MakeFreeTypeFaceFromData;
    if (!make) return [];
    this.typefaces ??= this.deps.fonts.map((f) => make.call(factory, f.data)).filter((t): t is Typeface => !!t);
    if (!this.typefaces.length) return [];
    const chars = new Set<string>();
    const stack = [...roots];
    while (stack.length) {
      const n = stack.pop() as ReadonlyNode;
      if (!draws(n)) continue;
      if (n.type === "TEXT" && n.characters && n.fills.some((p) => p.visible)) {
        for (const ch of n.characters) if (!NO_GLYPH_NEEDED.test(ch)) chars.add(ch);
      }
      stack.push(...this.source.children(n.id));
    }
    if (!chars.size) return [];
    const list = [...chars];
    const found = list.map(() => false);
    for (const t of this.typefaces) {
      const ids = t.getGlyphIDs(list.join(""), list.length);
      for (let i = 0; i < list.length; i++) if (ids[i]) found[i] = true;
    }
    return list.filter((_, i) => !found[i]);
  }

  /** A warning naming characters the loaded fonts don't have, for text drawn by the text engine (PNG, JPG, PDF). */
  warnMissingGlyphs(roots: readonly ReadonlyNode[], warn: (message: string) => void): void {
    const missing = this.missingGlyphs(roots);
    if (!missing.length) return;
    const shown = missing.slice(0, 5).map((c) => `“${c}”`).join(", ") + (missing.length > 5 ? " and more" : "");
    warn(`The loaded fonts don't have some of the text's characters (${shown}), so they show as empty boxes. Load a font that has them.`);
  }

  /**
   * The font families the visible text under `roots` asks for that none of
   * the loaded fonts is: that text is drawn in the fallback (the first font
   * given, Inter in the app). Empty without fonts (text is then drawn as bars).
   */
  missingFamilies(roots: readonly ReadonlyNode[]): string[] {
    const fonts = this.deps.fonts ?? [];
    if (!fonts.length) return [];
    const have = new Set(fonts.map((f) => f.family));
    const missing = new Set<string>();
    const stack = [...roots];
    while (stack.length) {
      const n = stack.pop() as ReadonlyNode;
      if (!draws(n)) continue;
      if (n.type === "TEXT" && n.fontFamily && !have.has(n.fontFamily) && n.characters) missing.add(n.fontFamily);
      stack.push(...this.source.children(n.id));
    }
    return [...missing].sort((a, b) => a.localeCompare(b));
  }

  /** "Font X isn't available to export, so Inter was used.", for text drawn by the text engine (PNG, JPG, PDF). */
  warnMissingFamilies(roots: readonly ReadonlyNode[], warn: (message: string) => void): void {
    const missing = this.missingFamilies(roots);
    if (!missing.length) return;
    const fallback = this.deps.fonts?.[0]?.family ?? "the fallback font";
    const names = missing.slice(0, 3).map((f) => `“${f}”`);
    const list = missing.length > 3 ? `${names.join(", ")} and ${missing.length - 3} more` : names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
    warn(`${missing.length === 1 ? "Font" : "Fonts"} ${list} ${missing.length === 1 ? "isn't" : "aren't"} available to export, so ${fallback} was used.`);
  }

  /** Laid-out lines by layer, for this session (the document doesn't change during an export). */
  private readonly layouts = new Map<NodeId, TextLine[] | null>();

  textLayout = (n: ReadonlyNode): TextLine[] | null => {
    if (!this.hasTextEngine) return null;
    if (!this.layouts.has(n.id)) this.layouts.set(n.id, this.context().pageRenderer.layoutText(n.id));
    return this.layouts.get(n.id) ?? null;
  };

  /**
   * What TEXT layers draw in `format`: the renderer's lines, past the box
   * where they don't fit it (as on the canvas); in SVG without fonts, the
   * lines the SVG writes. Undefined: the box.
   */
  textBounds(format: ExportSettings["format"]): TextBounds | undefined {
    if (this.hasTextEngine) return (n) => textLinesBounds(n, this.textLayout(n));
    if (format === "SVG") return (n) => textLinesBounds(n, fallbackTextLines(n));
    return undefined;
  }

  /** A layer with shadows or blurs, drawn by the renderer for PDF (`scale` px per pt, chosen by the writer; at most 4,096 on a side). */
  rasterNode = (n: ReadonlyNode, area: Rect, scale = 2): RasterText | null => {
    if (!this.deps.canvasKit) return null;
    // Without fonts, text would come out as placeholder bars: draw it as vectors instead.
    if (!this.hasTextEngine && hasText(this.source, [n])) return null;
    const k = Math.min(scale, 4096 / Math.max(area.width, area.height, 1));
    const width = Math.max(1, Math.ceil(area.width * k));
    const height = Math.max(1, Math.ceil(area.height * k));
    const rgba = rasterizeLeaf(this.context(), n, width, height, area);
    return rgba ? { width, height, rgba, area } : null;
  };

  /** An image file as RGBA pixels, decoded by CanvasKit, for PDF. Null for files too big to decode (16,384 px a side, 64 million pixels, from the header). */
  decodeImage = (bytes: Uint8Array): { width: number; height: number; rgba: Uint8Array } | null => {
    const ck = this.deps.canvasKit;
    const size = imageSize(bytes);
    if (!size || size.rawWidth > 16_384 || size.rawHeight > 16_384 || size.rawWidth * size.rawHeight > 64_000_000) return null;
    const image = ck?.MakeImageFromEncoded(bytes);
    if (!ck || !image) return null;
    try {
      const width = image.width();
      const height = image.height();
      const px = image.readPixels(0, 0, { width, height, colorType: ck.ColorType.RGBA_8888, alphaType: ck.AlphaType.Unpremul, colorSpace: ck.ColorSpace.SRGB });
      return px ? { width, height, rgba: Uint8Array.from(px as Uint8Array) } : null;
    } finally {
      image.delete();
    }
  };

  /** What the PDF writer gets from this session. */
  pdfOptions(warn: (message: string) => void, title: string): PdfWriterOptions {
    const textBounds = this.textBounds("PDF");
    return {
      ...(this.hasTextEngine ? { rasterText: this.rasterText } : {}),
      ...(textBounds ? { textBounds } : {}),
      ...(this.deps.canvasKit ? { rasterNode: this.rasterNode, decodeImage: this.decodeImage } : {}),
      warn,
      title,
    };
  }

  rasterText = (n: ReadonlyNode): RasterText | null => {
    if (!this.hasTextEngine) return null;
    // The box, and past it where the text runs out of it (as it draws on the canvas).
    const area = textLinesBounds(n, this.textLayout(n));
    // 4 pixels per point, at most 4,096 on a side.
    const k = Math.min(4, 4096 / Math.max(area.width, area.height, 1));
    const width = Math.max(1, Math.ceil(area.width * k));
    const height = Math.max(1, Math.ceil(area.height * k));
    const rgba = rasterizeLeaf(this.context(), n, width, height, area);
    return rgba ? { width, height, rgba, area } : null;
  };
}

function exportWith(session: Session, nodeId: NodeId, settings: ExportSettings, filename: string): ExportedFile {
  checkSettings(settings);
  const { source } = session;
  const textBounds = session.textBounds(settings.format);
  const scene = exportScene(source, nodeId, settings, textBounds);
  const warnings = new Set<string>();
  const warn = (m: string) => void warnings.add(m);
  const text = hasText(source, scene.roots);
  let bytes: Uint8Array;
  let width = scene.region.width;
  let height = scene.region.height;
  switch (settings.format) {
    case "PNG":
    case "JPG": {
      const size = rasterSize(scene, settings, session.limits);
      if (text && !session.deps.fonts?.length) warn("No fonts were loaded, so text is drawn as placeholder bars.");
      bytes = exportRaster(session.context(), scene, settings, size);
      width = size.width;
      height = size.height;
      break;
    }
    case "SVG": {
      if (text && settings.svgOutlineText) warn("Outline text isn't available yet, so text is written as editable text and needs its font installed to look right.");
      if (text && !session.hasTextEngine) warn("Text is written one line per line break, without wrapping, because no fonts were loaded.");
      const svg = writeSvg(source, scene, { idAttribute: settings.svgIdAttribute ?? false, textLayout: session.textLayout, ...(textBounds ? { textBounds } : {}), warn });
      bytes = new TextEncoder().encode(svg);
      break;
    }
    case "PDF": {
      bytes = writePdf(source, [scene], session.pdfOptions(warn, scene.node.name));
      width = Math.max(1, width);
      height = Math.max(1, height);
      break;
    }
  }
  // SVG text is drawn by the viewer's fonts; the others by ours.
  if (text && settings.format !== "SVG") {
    session.warnMissingFamilies(scene.roots, warn);
    session.warnMissingGlyphs(scene.roots, warn);
  }
  return { nodeId, settings, filename, mime: MIME_TYPES[settings.format], bytes, width, height, warnings: [...warnings] };
}

/**
 * The file name a request writes. Never throws: bad settings (an unknown
 * format, a suffix that isn't text) still get a name, and `checkSettings`
 * then fails that one export with an `ExportError`.
 */
function nameFor(source: ExportSource, req: ExportRequest): string {
  const node = source.get(req.nodeId);
  const format = req.settings?.format;
  const suffix = req.settings?.suffix;
  const name = typeof node?.name === "string" ? node.name : "Untitled";
  return exportFilename(name, format && Object.hasOwn(MIME_TYPES, format) ? format : "PNG", typeof suffix === "string" ? suffix : "");
}

/**
 * Export one layer with one setting (Figma's `exportAsync`). Throws
 * `ExportError` with a plain-language reason when it can't.
 */
export async function exportNode(source: ExportSource, nodeId: NodeId, settings: ExportSettings, deps: ExportDeps = {}): Promise<ExportedFile> {
  const session = new Session(source, deps);
  try {
    return exportWith(session, nodeId, settings, nameFor(source, { nodeId, settings }));
  } finally {
    session.dispose();
  }
}

/**
 * The file names a batch will write, in order: Figma's names, made unique
 * against each other and against `taken` (names already in the folder, when
 * not replacing files) by adding `-1`, `-2`…
 */
export function planExportFilenames(source: ExportSource, requests: readonly ExportRequest[], taken: Iterable<string> = []): string[] {
  const used = takenNames(taken);
  return requests.map((r) => uniqueFilename(nameFor(source, r), used));
}

export interface BatchOptions {
  /** Names already in the folder (relative paths), which new files must not replace. */
  taken?: Iterable<string>;
  /** Called after each request, done or failed. */
  onProgress?: (done: number, total: number) => void;
}

/**
 * Export many layers and settings at once (the Export dialog, ⇧⌘E). A
 * request that fails doesn't stop the others; it is listed in `failures`.
 */
export async function exportNodes(source: ExportSource, requests: readonly ExportRequest[], deps: ExportDeps = {}, options: BatchOptions = {}): Promise<BatchResult> {
  const names = planExportFilenames(source, requests, options.taken);
  const session = new Session(source, deps);
  const files: ExportedFile[] = [];
  const failures: ExportFailure[] = [];
  try {
    for (let i = 0; i < requests.length; i++) {
      const req = requests[i] as ExportRequest;
      const filename = names[i] as string;
      try {
        files.push(exportWith(session, req.nodeId, req.settings, filename));
      } catch (e) {
        failures.push({ ...req, filename, message: e instanceof Error ? e.message : String(e) });
      }
      options.onProgress?.(i + 1, requests.length);
    }
  } finally {
    session.dispose();
  }
  return { files, failures };
}

/**
 * One PDF with a page per layer, in order (Figma's "Export frames to PDF").
 * Named after the first layer it holds. Hidden layers among several are
 * left out with a warning; it fails only when every layer is hidden.
 */
export async function exportPdf(
  source: ExportSource,
  nodeIds: readonly NodeId[],
  deps: ExportDeps = {},
  settings: Omit<ExportSettingsPDF, "format"> = {},
): Promise<ExportedFile> {
  if (!nodeIds.length) throw new ExportError("Choose at least one layer to export to PDF.");
  if (settings.suffix !== undefined && typeof settings.suffix !== "string") throw new ExportError("The suffix must be text.");
  const session = new Session(source, deps);
  try {
    const textBounds = session.textBounds("PDF");
    const warnings = new Set<string>();
    const scenes: ExportScene[] = [];
    for (const id of nodeIds) {
      const n = source.get(id);
      // Among several, a hidden layer is left out (as a batch export skips it); the PDF fails only when none is left.
      if (nodeIds.length > 1 && n && n.type !== "PAGE" && !draws(n)) {
        warnings.add(`“${n.name}” is hidden, so it was left out of the PDF.`);
        continue;
      }
      scenes.push(exportScene(source, id, settings, textBounds));
    }
    if (!scenes.length) throw new ExportError("Every layer chosen is hidden, so there is nothing to export to PDF. Show the layers first.");
    const first = scenes[0] as ExportScene;
    const docTitle = first.node.name;
    const warn = (m: string) => void warnings.add(m);
    const bytes = writePdf(source, scenes, session.pdfOptions(warn, docTitle));
    session.warnMissingFamilies(scenes.flatMap((s) => s.roots), warn);
    session.warnMissingGlyphs(scenes.flatMap((s) => s.roots), warn);
    const full: ExportSettingsPDF = { ...settings, format: "PDF" };
    return {
      nodeId: first.node.id,
      settings: full,
      filename: exportFilename(docTitle, "PDF", settings.suffix ?? ""),
      mime: MIME_TYPES.PDF,
      bytes,
      width: Math.max(1, first.region.width),
      height: Math.max(1, first.region.height),
      warnings: [...warnings],
    };
  } finally {
    session.dispose();
  }
}
