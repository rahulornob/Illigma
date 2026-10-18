/**
 * File names for exports, as Figma makes them: "<layer name><suffix>.<ext>",
 * with each "/" in a layer name starting a folder ("Icons/Arrow" writes
 * `Icons/Arrow.png`). Names are made safe on Windows, macOS and Linux. In a
 * batch, a name that is already taken gets a number (`Welcome-1.png`),
 * never replacing a file (docs/design/export.md).
 */

import { EXTENSIONS, type ExportFormat } from "./settings.js";

/** Characters no common file system accepts in a name. */
const ILLEGAL = /[\\:*?"<>|]/g;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/g;
/** Device names Windows reserves, with or without an extension. */
const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
/** Room for a suffix, a de-duplicating number and the extension within 255 bytes. */
const MAX_PART_BYTES = 200;

const encoder = new TextEncoder();

/** One file or folder name made safe: no illegal or control characters, no trailing dots or spaces, not reserved, not too long. */
export function sanitizeFilePart(part: string): string {
  let s = part.replace(CONTROL, "").replace(ILLEGAL, "_").trim();
  s = s.replace(/[. ]+$/, "");
  if (!s) return "";
  if (RESERVED.test(s)) s = `_${s}`;
  return truncateBytes(s, MAX_PART_BYTES);
}

/** Cut `s` to at most `max` UTF-8 bytes, never splitting a character. */
function truncateBytes(s: string, max: number): string {
  if (encoder.encode(s).length <= max) return s;
  let out = "";
  let bytes = 0;
  for (const ch of s) {
    const n = encoder.encode(ch).length;
    if (bytes + n > max) break;
    out += ch;
    bytes += n;
  }
  return out.replace(/[. ]+$/, "");
}

/**
 * The relative path Figma would write for a layer: folders from "/" in the
 * name, then the last part plus `suffix` and the format's extension. A name
 * with nothing usable left becomes "Untitled".
 */
export function exportFilename(layerName: string, format: ExportFormat, suffix = ""): string {
  const parts = layerName.split("/").map(sanitizeFilePart).filter(Boolean);
  const file = parts.pop() ?? "Untitled";
  // A suffix can't start a folder.
  const stem = truncateBytes(file + suffix.replace(CONTROL, "").replace(ILLEGAL, "_").replace(/\//g, "_"), MAX_PART_BYTES + 40);
  return [...parts, `${stem}.${EXTENSIONS[format]}`].join("/");
}

/**
 * `path`, or if it is taken, the same with `-1`, `-2`… before the extension.
 * Names compare without case, since macOS and Windows disks ignore it. Adds
 * the result to `taken`, whose entries are lower case.
 */
export function uniqueFilename(path: string, taken: Set<string>): string {
  const dot = path.lastIndexOf(".");
  const slash = path.lastIndexOf("/");
  const hasExt = dot > slash + 1;
  const stem = hasExt ? path.slice(0, dot) : path;
  const ext = hasExt ? path.slice(dot) : "";
  let candidate = path;
  for (let i = 1; taken.has(candidate.toLowerCase()); i++) candidate = `${stem}-${i}${ext}`;
  taken.add(candidate.toLowerCase());
  return candidate;
}
