/**
 * `@illigma/export`: PNG, JPG, SVG and PDF files from layers, with Figma's
 * export settings and file names. Runs in browsers, workers and Node: it
 * never touches the disk. The app decides where the bytes go.
 */

import type { ReadonlyNode } from "@illigma/core";
import type { NodeId } from "@illigma/format";
import type { FontSource } from "@illigma/renderer";
import type { CanvasKit } from "canvaskit-wasm";
import { exportFilename, uniqueFilename } from "./filename.js";
import { writePdf, type PdfWriterOptions, type RasterText } from "./pdf.js";
import { exportRaster, rasterizeLeaf, rasterSize, RasterContext } from "./raster.js";
import { exportScene, hasText, type ExportScene, type ExportSource, type Rect } from "./scene.js";
import { checkSettings, DEFAULT_EXPORT_LIMITS, ExportError, MIME_TYPES, type ExportLimits, type ExportSettings, type ExportSettingsPDF } from "./settings.js";
import { writeSvg } from "./svg.js";

export { exportFilename, sanitizeFilePart, uniqueFilename } from "./filename.js";
export { pdfString, writePdf, type PdfWriterOptions, type RasterText } from "./pdf.js";
export { rasterSize, type PixelSize } from "./raster.js";
export { exportScene, renderBounds, type ExportScene, type ExportSource, type Matrix, type Rect } from "./scene.js";
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
  }

  textLayout = (n: ReadonlyNode) => (this.hasTextEngine ? this.context().pageRenderer.layoutText(n.id) : null);

  /** A layer with shadows or blurs, drawn by the renderer for PDF (4 px per pt, at most 4,096 on a side). */
  rasterNode = (n: ReadonlyNode, area: Rect): RasterText | null => {
    if (!this.deps.canvasKit) return null;
    // Without fonts, text would come out as placeholder bars: draw it as vectors instead.
    if (!this.hasTextEngine && hasText(this.source, [n])) return null;
    const k = Math.min(4, 4096 / Math.max(area.width, area.height, 1));
    const width = Math.max(1, Math.ceil(area.width * k));
    const height = Math.max(1, Math.ceil(area.height * k));
    const rgba = rasterizeLeaf(this.context(), n, width, height, area);
    return rgba ? { width, height, rgba, area } : null;
  };

  /** An image file as RGBA pixels, decoded by CanvasKit, for PDF. */
  decodeImage = (bytes: Uint8Array): { width: number; height: number; rgba: Uint8Array } | null => {
    const ck = this.deps.canvasKit;
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
    return {
      ...(this.hasTextEngine ? { rasterText: this.rasterText } : {}),
      ...(this.deps.canvasKit ? { rasterNode: this.rasterNode, decodeImage: this.decodeImage } : {}),
      warn,
      title,
    };
  }

  rasterText = (n: ReadonlyNode): RasterText | null => {
    if (!this.hasTextEngine) return null;
    // The box, and below it if the text runs past its bottom (as it draws on the canvas).
    const lines = this.textLayout(n) ?? [];
    const last = lines[lines.length - 1];
    const area = { width: n.width, height: Math.max(n.height, last ? last.baseline + (n.fontSize ?? 12) * 0.5 : 0) };
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
  const scene = exportScene(source, nodeId, settings);
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
      const svg = writeSvg(source, scene, { idAttribute: settings.svgIdAttribute ?? false, textLayout: session.textLayout, warn });
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
  return { nodeId, settings, filename, mime: MIME_TYPES[settings.format], bytes, width, height, warnings: [...warnings] };
}

function nameFor(source: ExportSource, req: ExportRequest): string {
  const node = source.get(req.nodeId);
  const format = req.settings?.format;
  return exportFilename(node?.name ?? "Untitled", format && MIME_TYPES[format] ? format : "PNG", req.settings?.suffix ?? "");
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
  const used = new Set([...taken].map((t) => t.toLowerCase()));
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
 * Named after the first layer.
 */
export async function exportPdf(
  source: ExportSource,
  nodeIds: readonly NodeId[],
  deps: ExportDeps = {},
  settings: Omit<ExportSettingsPDF, "format"> = {},
): Promise<ExportedFile> {
  if (!nodeIds.length) throw new ExportError("Choose at least one layer to export to PDF.");
  const session = new Session(source, deps);
  try {
    const scenes: ExportScene[] = nodeIds.map((id) => exportScene(source, id, settings));
    const warnings = new Set<string>();
    const first = scenes[0] as ExportScene;
    const docTitle = first.node.name;
    const bytes = writePdf(source, scenes, session.pdfOptions((m) => void warnings.add(m), docTitle));
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
