/**
 * Format migrations. Each entry upgrades a raw file from version N to N + 1.
 * The app always writes the current version and never an older one.
 */

import { FORMAT_VERSION } from "./schema.js";

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
