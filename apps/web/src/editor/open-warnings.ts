/**
 * The banner shown when a file opened without some of its parts (QC round 7):
 * damaged or missing images, stray files in the package. The rest of the file
 * opened; the layers using a missing image show a faint grey instead.
 */

/** At most this many problems are listed; the rest are counted. */
export const MAX_LISTED_WARNINGS = 3;

export interface OpenWarnings {
  title: string;
  /** The first few problems, one line each. */
  items: string[];
  /** How many more there are (0 when all are listed). */
  more: number;
}

/** The format's summary line after its first 20 image warnings. */
const MORE_LINE = /^…and ([\d,]+) more problems? with images\.$/;
/** Image problems: a file under images/, or an image a layer uses that is missing. */
const IMAGE_LINE = /^(images\/|Image [0-9a-f]+…)/;

/** Banner content for `warnings` (`ReadReport.warnings`), or null when there are none. */
export function openWarnings(warnings: readonly string[] | undefined): OpenWarnings | null {
  if (!warnings?.length) return null;
  let total = 0;
  const lines: string[] = [];
  let imagesOnly = true;
  for (const w of warnings) {
    const more = MORE_LINE.exec(w);
    if (more) {
      total += Number((more[1] as string).replace(/,/g, ""));
      continue;
    }
    if (!IMAGE_LINE.test(w)) imagesOnly = false;
    lines.push(w);
    total++;
  }
  const items = lines.slice(0, MAX_LISTED_WARNINGS);
  return {
    title: imagesOnly ? "Some images couldn't be opened:" : "Some parts of this file couldn't be opened:",
    items,
    more: total - items.length,
  };
}
