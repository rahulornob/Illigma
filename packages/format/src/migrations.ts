/**
 * Format migrations. Each entry upgrades a raw file from version N to N + 1.
 * The app always writes the current version and never an older one.
 */

import { FORMAT_VERSION, MAX_TEXT_METRIC } from "./schema.js";

export interface RawFile {
  manifest: unknown;
  nodes: unknown[];
}

type Migration = (file: RawFile) => RawFile;

/** `MIGRATIONS[n]` upgrades version n to n + 1. Version 0 is the first, so none exist yet. */
export const MIGRATIONS: Record<number, Migration> = {};

export function migrate(file: RawFile, fromVersion: number): RawFile {
  let current = file;
  for (let v = fromVersion; v < FORMAT_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`No migration from format ${v} to ${v + 1}.`);
    current = step(current);
  }
  return current;
}

/**
 * Format 0 files written before font size and line height were bounded
 * (QC round 8, 2026-10-19) may hold values no text can be laid out with
 * (a font size of 1e300 made every layout edit fail; 0 or less drew
 * nothing). Rather than refuse such a file, its values are clamped as it is
 * read, within what validation now takes: a font size of 1 to
 * `MAX_TEXT_METRIC`, and a line height in pixels of 0 (Auto, as format 0
 * drew 0 or less) to `MAX_TEXT_METRIC`. Anything else is left for
 * validation. Returns how many nodes changed; the raw nodes are changed in place.
 */
export function clampTextMetrics(nodes: unknown[]): number {
  let changed = 0;
  for (const raw of nodes) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const n = raw as Record<string, unknown>;
    let touched = false;
    const size = n.fontSize;
    // JSON has no NaN; 1e400 reads as Infinity, which clamps like any huge size.
    if (typeof size === "number" && !Number.isNaN(size) && !(size > 0 && size <= MAX_TEXT_METRIC)) {
      n.fontSize = size > MAX_TEXT_METRIC ? MAX_TEXT_METRIC : 1;
      touched = true;
    }
    const lh = n.lineHeight;
    if (typeof lh === "number" && !Number.isNaN(lh) && !(lh >= 0 && lh <= MAX_TEXT_METRIC)) {
      n.lineHeight = lh > MAX_TEXT_METRIC ? MAX_TEXT_METRIC : 0;
      touched = true;
    }
    if (touched) changed++;
  }
  return changed;
}
