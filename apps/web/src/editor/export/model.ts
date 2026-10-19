/**
 * Export settings in the editor: reading them off layers, changing them (each
 * change one `Document.transact`, one undo step), parsing the size field,
 * and what an export will write (docs/design/export.md).
 */

import type { Document, ReadonlyNode } from "@illigma/core";
import { DEFAULT_EXPORT_LIMITS, exportScene, planExportFilenames, rasterSize, type ExportRequest } from "@illigma/export";
import { compareOrder, EXPORT_LIMITS, type ExportFormat, type ExportSettings, type ExportSettingsConstraints, type NodeId } from "@illigma/format";

export const FORMATS: readonly ExportFormat[] = ["PNG", "JPG", "SVG", "PDF"];

/** The size menu (Figma's): scales, then a fixed width and height. */
export const SIZE_PRESETS: readonly string[] = ["0.5x", "0.75x", "1x", "1.5x", "2x", "3x", "4x", "512w", "512h"];

const num = (v: number) => String(Math.round(v * 1000) / 1000);

/**
 * The size field's text as a constraint: "2x" (or "2", "0.5X", "@2x") is a
 * scale; "512w" a fixed width and "512h" a fixed height, in whole pixels.
 * Null for anything else, zero, or more than the format allows (100x, 100,000 px).
 */
export function parseSize(text: string): ExportSettingsConstraints | null {
  const m = /^\s*@?\s*(\d+(?:\.\d*)?|\.\d+)\s*(x|w|h|px\s*w|px\s*h)?\s*$/i.exec(text);
  if (!m) return null;
  const value = Number(m[1]);
  const unit = (m[2] ?? "x").toLowerCase().replace(/px\s*/, "");
  if (!Number.isFinite(value) || value <= 0) return null;
  if (unit === "x") {
    if (value > EXPORT_LIMITS.maxScale) return null;
    return { type: "SCALE", value: Math.round(value * 1000) / 1000 || 0.001 };
  }
  const px = Math.round(value);
  if (px < 1 || px > EXPORT_LIMITS.maxPixels) return null;
  return { type: unit === "w" ? "WIDTH" : "HEIGHT", value: px };
}

/** A constraint as the size field shows it: "1x", "0.5x", "512w", "512h". */
export function formatSize(c: ExportSettingsConstraints | undefined): string {
  if (!c) return "1x";
  return c.type === "SCALE" ? `${num(c.value)}x` : `${num(c.value)}${c.type === "WIDTH" ? "w" : "h"}`;
}

/** A setting's size, also for SVG and PDF (always 1x, as in Figma). */
export function sizeOf(s: ExportSettings): ExportSettingsConstraints | undefined {
  return s.format === "PNG" || s.format === "JPG" ? s.constraint : undefined;
}

/** "PNG 2x", "SVG", "JPG 512w": one setting in a summary. */
export function settingLabel(s: ExportSettings): string {
  const size = sizeOf(s);
  return size && !(size.type === "SCALE" && size.value === 1) ? `${s.format} ${formatSize(size)}` : s.format;
}

/** "PNG 1x, 2x · SVG", as the Export dialog lists a layer's formats. */
export function settingsSummary(list: readonly ExportSettings[]): string {
  const groups = new Map<ExportFormat, string[]>();
  for (const s of list) {
    const g = groups.get(s.format) ?? [];
    if (s.format === "PNG" || s.format === "JPG") g.push(formatSize(s.constraint));
    groups.set(s.format, g);
  }
  return [...groups].map(([f, sizes]) => (sizes.length ? `${f} ${sizes.join(", ")}` : f)).join(" · ");
}

/**
 * The setting + adds, as Figma does: the first is 1x PNG; the next ones go up
 * a scale with a matching suffix (2x "@2x", 3x "@3x", then 4x), in the format
 * of the last row.
 */
export function nextSetting(list: readonly ExportSettings[]): ExportSettings {
  if (!list.length) return { format: "PNG", suffix: "", constraint: { type: "SCALE", value: 1 } };
  const last = list[list.length - 1] as ExportSettings;
  const scales = list.map((s) => sizeOf(s)).map((c) => (c && c.type === "SCALE" ? c.value : 1));
  const scale = Math.min(4, Math.floor(Math.max(...scales)) + 1);
  const raster = last.format === "PNG" || last.format === "JPG";
  if (!raster) return { format: last.format, suffix: "" } as ExportSettings;
  return { format: last.format, suffix: `@${scale}x`, constraint: { type: "SCALE", value: scale } };
}

/** A setting changed to `format`, keeping what applies: size for PNG and JPG, SVG options for SVG. */
export function withFormat(s: ExportSettings, format: ExportFormat): ExportSettings {
  if (s.format === format) return s;
  const common = {
    ...(s.suffix !== undefined ? { suffix: s.suffix } : {}),
    ...(s.contentsOnly !== undefined ? { contentsOnly: s.contentsOnly } : {}),
    ...(s.useAbsoluteBounds !== undefined ? { useAbsoluteBounds: s.useAbsoluteBounds } : {}),
  };
  if (format === "PNG" || format === "JPG") {
    const size = sizeOf(s);
    return { ...common, format, constraint: size ?? { type: "SCALE", value: 1 } };
  }
  return { ...common, format } as ExportSettings;
}

/** A layer's settings (none when it has no `exportSettings`). */
export const settingsOf = (n: ReadonlyNode | undefined): readonly ExportSettings[] => (n?.exportSettings as readonly ExportSettings[] | undefined) ?? [];

const same = (a: readonly ExportSettings[], b: readonly ExportSettings[]) => JSON.stringify(a) === JSON.stringify(b);

/** The settings every one of `nodes` has, or null when they differ (Figma's "mixed"). */
export function sharedSettings(nodes: readonly ReadonlyNode[]): readonly ExportSettings[] | null {
  const first = settingsOf(nodes[0]);
  return nodes.every((n) => same(settingsOf(n), first)) ? first : null;
}

/** Plain copies, safe to change and to store. */
const copy = (list: readonly ExportSettings[]): ExportSettings[] => JSON.parse(JSON.stringify(list)) as ExportSettings[];

/**
 * Set each of `ids`' settings to `next(current)`, as one undo step. An empty
 * list removes the field, so a layer without settings saves as before.
 * Throws the document's error (nothing changed) for a value it refuses.
 */
export function updateExportSettings(doc: Document, ids: readonly NodeId[], next: (current: ExportSettings[]) => ExportSettings[], label: string): void {
  if (doc.live) return;
  doc.transact(label, (tx) => {
    for (const id of ids) {
      const n = doc.get(id);
      if (!n) continue;
      const list = next(copy(settingsOf(n)));
      tx.set(id, "exportSettings", list.length ? list : undefined);
    }
  });
}

/** One request per layer and setting, in order: what "Export" writes for `ids`. */
export function exportRequests(doc: Document, ids: readonly NodeId[]): ExportRequest[] {
  const out: ExportRequest[] = [];
  for (const id of ids) for (const settings of settingsOf(doc.get(id))) out.push({ nodeId: id, settings: copy([settings])[0] as ExportSettings });
  return out;
}

export interface ExportableLayer {
  node: ReadonlyNode;
  page: ReadonlyNode;
}

/**
 * Every layer (pages too) with export settings on `pages`, in layer-panel
 * order: top of the list first within each page, parents before children.
 */
export function layersWithSettings(doc: Document, pages: readonly ReadonlyNode[]): ExportableLayer[] {
  const out: ExportableLayer[] = [];
  for (const page of pages) {
    if (settingsOf(page).length) out.push({ node: page, page });
    const walk = (parent: NodeId) => {
      // The layers panel lists the topmost (last) child first.
      const kids = [...doc.children(parent)].sort(compareOrder).reverse();
      for (const k of kids) {
        if (settingsOf(k).length) out.push({ node: k, page });
        walk(k.id);
      }
    };
    walk(page.id);
  }
  return out;
}

export interface PlannedFile {
  request: ExportRequest;
  filename: string;
  /** "786 × 1704 px", or why it can't be made ("too big"). */
  size: string;
  /** The reason it will fail, found before exporting (too big, hidden, empty). */
  problem: string | null;
}

/**
 * What `requests` will write: file names (unique among themselves and
 * `taken`) and estimated sizes in pixels (SVG and PDF in their own units, 1x).
 */
export function planFiles(doc: Document, requests: readonly ExportRequest[], taken: Iterable<string> = []): PlannedFile[] {
  const names = planExportFilenames(doc, requests, taken);
  return requests.map((request, i) => {
    const filename = names[i] as string;
    try {
      const scene = exportScene(doc, request.nodeId, request.settings);
      const s = request.settings;
      if (s.format === "PNG" || s.format === "JPG") {
        const { width, height } = rasterSize(scene, s, DEFAULT_EXPORT_LIMITS);
        return { request, filename, size: `${width.toLocaleString("en-US")} × ${height.toLocaleString("en-US")} px`, problem: null };
      }
      const w = Math.max(1, Math.round(scene.region.width));
      const h = Math.max(1, Math.round(scene.region.height));
      return { request, filename, size: `${w.toLocaleString("en-US")} × ${h.toLocaleString("en-US")}${s.format === "PDF" ? " pt" : ""}`, problem: null };
    } catch (e) {
      return { request, filename, size: "", problem: e instanceof Error ? e.message : String(e) };
    }
  });
}
