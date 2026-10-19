/**
 * Masks, layout grids and ruler guides, named after Figma's Plugin API
 * (`isMask`, `maskType`, `layoutGrids`, `PageNode.guides`). Every field is
 * optional: absent means none, so files without them save exactly as before.
 */
import type { Color } from "./schema.js";

/** How a mask clips the layers above it. "ALPHA" (default) uses the mask's pixels' alpha, "VECTOR" its outline, "LUMINANCE" its brightness. */
export type MaskType = "ALPHA" | "VECTOR" | "LUMINANCE";
export const MASK_TYPES: readonly MaskType[] = ["ALPHA", "VECTOR", "LUMINANCE"];

export type LayoutGridPattern = "GRID" | "COLUMNS" | "ROWS";
export type LayoutGridAlignment = "MIN" | "MAX" | "STRETCH" | "CENTER";
export const LAYOUT_GRID_PATTERNS: readonly LayoutGridPattern[] = ["GRID", "COLUMNS", "ROWS"];
export const LAYOUT_GRID_ALIGNMENTS: readonly LayoutGridAlignment[] = ["MIN", "MAX", "STRETCH", "CENTER"];

/** A uniform square grid. */
export interface GridLayoutGrid {
  pattern: "GRID";
  /** Cell size in px, ≥ 1. */
  sectionSize: number;
  visible?: boolean;
  color?: Color;
}

/** Columns or rows. `sectionSize` is the column width (ignored when STRETCH). `offset` is the margin (STRETCH/MIN/MAX); `count` 0 means "auto". */
export interface RowsColsLayoutGrid {
  pattern: "COLUMNS" | "ROWS";
  alignment: LayoutGridAlignment;
  gutterSize: number;
  count: number;
  sectionSize?: number;
  offset?: number;
  visible?: boolean;
  color?: Color;
}

export type LayoutGrid = GridLayoutGrid | RowsColsLayoutGrid;

export interface Guide {
  axis: "X" | "Y";
  /** Page coordinate: x for "X" (a vertical line), y for "Y". */
  offset: number;
}

export const GRID_LIMITS = { maxGrids: 50, maxCount: 1_000, maxGuides: 2_000, maxSize: 100_000 } as const;

export interface MaskGridFields {
  /** This layer masks the siblings above it in its parent. Default false. */
  isMask?: boolean;
  /** Default "ALPHA". */
  maskType?: MaskType;
  /** FRAME (and component) layout grids, bottom first. Editor-only: never exported. */
  layoutGrids?: LayoutGrid[];
  /** PAGE: ruler guides. */
  guides?: Guide[];
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isColor = (c: unknown): boolean =>
  isObj(c) && ["r", "g", "b", "a"].every((k) => finite(c[k]) && (c[k] as number) >= 0 && (c[k] as number) <= 1);

/** Problem with a `layoutGrids` value, or null. */
export function layoutGridsProblem(v: unknown): string | null {
  if (!Array.isArray(v)) return "must be a list of layout grids";
  if (v.length > GRID_LIMITS.maxGrids) return `must have at most ${GRID_LIMITS.maxGrids} grids`;
  for (let i = 0; i < v.length; i++) {
    const g = v[i] as unknown;
    if (!isObj(g)) return `grid ${i} is not an object`;
    if (g.visible !== undefined && typeof g.visible !== "boolean") return `grid ${i} "visible" must be true or false`;
    if (g.color !== undefined && !isColor(g.color)) return `grid ${i} "color" must be an RGBA colour (0–1)`;
    const size = (k: string, min: number, opt: boolean) => {
      const x = g[k];
      if (x === undefined && opt) return null;
      return finite(x) && x >= min && x <= GRID_LIMITS.maxSize ? null : `grid ${i} "${k}" must be a number from ${min} to ${GRID_LIMITS.maxSize}`;
    };
    if (g.pattern === "GRID") {
      const p = size("sectionSize", 1, false);
      if (p) return p;
    } else if (g.pattern === "COLUMNS" || g.pattern === "ROWS") {
      if (!LAYOUT_GRID_ALIGNMENTS.includes(g.alignment as LayoutGridAlignment)) return `grid ${i} "alignment" must be MIN, MAX, STRETCH or CENTER`;
      if (!(Number.isInteger(g.count) && (g.count as number) >= 0 && (g.count as number) <= GRID_LIMITS.maxCount))
        return `grid ${i} "count" must be a whole number from 0 to ${GRID_LIMITS.maxCount}`;
      const p = size("gutterSize", 0, false) ?? size("sectionSize", 1, true) ?? size("offset", 0, true);
      if (p) return p;
    } else return `grid ${i} has an unknown pattern: use GRID, COLUMNS or ROWS`;
  }
  return null;
}

/** Problem with a `guides` value, or null. */
export function guidesProblem(v: unknown): string | null {
  if (!Array.isArray(v)) return "must be a list of guides";
  if (v.length > GRID_LIMITS.maxGuides) return `must have at most ${GRID_LIMITS.maxGuides} guides`;
  for (let i = 0; i < v.length; i++) {
    const g = v[i] as unknown;
    if (!isObj(g) || (g.axis !== "X" && g.axis !== "Y") || !finite(g.offset)) return `guide ${i} must be { axis: "X" | "Y", offset: number }`;
  }
  return null;
}

/** Figma's default grid colour (#FF0000 at 10%). */
export const DEFAULT_GRID_COLOR: Color = { r: 1, g: 0, b: 0, a: 0.1 };

export interface GridLine {
  /** "X": a vertical band/line at x; "Y": horizontal at y. Frame-local. */
  axis: "X" | "Y";
  start: number;
  /** 0 for a single line (GRID pattern). */
  size: number;
}

/**
 * Bands (columns or rows) or lines (GRID) of one layout grid inside a frame of
 * `width` × `height`, in frame-local coordinates. Matches Figma's maths.
 */
export function layoutGridBands(g: LayoutGrid, width: number, height: number): GridLine[] {
  const out: GridLine[] = [];
  if (g.pattern === "GRID") {
    const s = Math.max(1, g.sectionSize);
    for (let x = s; x < width && out.length < 4000; x += s) out.push({ axis: "X", start: x, size: 0 });
    for (let y = s; y < height && out.length < 8000; y += s) out.push({ axis: "Y", start: y, size: 0 });
    return out;
  }
  const axis = g.pattern === "COLUMNS" ? "X" : "Y";
  const extent = axis === "X" ? width : height;
  const gutter = Math.max(0, g.gutterSize);
  const offset = Math.max(0, g.offset ?? 0);
  let count = g.count;
  let size: number;
  let start: number;
  if (g.alignment === "STRETCH") {
    if (count < 1) count = 1;
    size = Math.max(0, (extent - 2 * offset - gutter * (count - 1)) / count);
    start = offset;
  } else {
    size = Math.max(1, g.sectionSize ?? 64);
    if (count < 1) count = Math.max(1, Math.floor((extent - 2 * offset + gutter) / (size + gutter)));
    const total = count * size + (count - 1) * gutter;
    start = g.alignment === "MIN" ? offset : g.alignment === "MAX" ? extent - offset - total : (extent - total) / 2;
  }
  for (let i = 0; i < count; i++) out.push({ axis, start: start + i * (size + gutter), size });
  return out;
}
