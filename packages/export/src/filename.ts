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
/**
 * Characters dropped from names: control characters, the invisible
 * direction marks, embeddings, overrides and isolates that can make a name
 * read as another ("photo{U+202E}gnp.exe"), line and paragraph separators, other
 * invisible format characters (deprecated format controls, the byte order
 * mark), and unpaired surrogates (not text; some disks refuse them). Written
 * as escapes: the characters themselves are invisible in the source.
 * U+200D (zero-width joiner) stays: emoji sequences need it.
 */
// eslint-disable-next-line no-control-regex
const DROPPED = /[\u0000-\u001f\u007f\u061c\u200e\u200f\u2028-\u202e\u2066-\u206f\ufeff]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
/**
 * Device names Windows reserves, with or without an extension, and with
 * spaces before it ("CON .png" opens CON too). COM¹ to COM³ and LPT¹ to
 * LPT³ (superscript digits) included.
 */
const RESERVED = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³]|conin\$|conout\$) *(\..*)?$/i;
/** Room for a suffix, a de-duplicating number and the extension within 255 bytes. */
const MAX_PART_BYTES = 200;

const encoder = new TextEncoder();

/** One file or folder name made safe: no illegal or control characters, no trailing dots or spaces, not reserved, not too long. */
export function sanitizeFilePart(part: string): string {
  const s = cleanPart(part);
  return s ? unreserved(s) : "";
}

/** `part` without dropped or illegal characters, trimmed, at most MAX_PART_BYTES, with no trailing dots or spaces. Not checked against device names. */
function cleanPart(part: string): string {
  const s = part.replace(DROPPED, "").replace(ILLEGAL, "_").trim().replace(/[. ]+$/, "");
  return s ? truncateBytes(s, MAX_PART_BYTES) : "";
}

/** `name` with a "_" in front when Windows reserves it. */
function unreserved(name: string): string {
  return RESERVED.test(name) ? `_${name}` : name;
}

const segmenter: { segment(s: string): Iterable<{ segment: string }> } | null =
  typeof Intl !== "undefined" && "Segmenter" in Intl ? new (Intl as unknown as { Segmenter: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter(undefined, { granularity: "grapheme" }) : null;

/** Cut `s` to at most `max` UTF-8 bytes, never splitting a character (or, where the platform can tell, a grapheme cluster: a letter and its accents, an emoji sequence). */
function truncateBytes(s: string, max: number): string {
  if (encoder.encode(s).length <= max) return s;
  let out = "";
  let bytes = 0;
  const pieces: Iterable<string> = segmenter ? [...segmenter.segment(s)].map((g) => g.segment) : s;
  for (const ch of pieces) {
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
  const parts = layerName.split("/");
  const folders = parts.slice(0, -1).map(sanitizeFilePart).filter(Boolean);
  const file = cleanPart(parts[parts.length - 1] ?? "") || (folders.length ? "" : "Untitled");
  // A name ending in "/" uses its last folder as the file name ("Icons/Arrow/" writes Icons/Arrow.png).
  const base = file || (folders.pop() as string);
  // A suffix can't start a folder. Device names are checked on the finished name, after the suffix and the cut.
  const stem = truncateBytes(base + suffix.replace(DROPPED, "").replace(ILLEGAL, "_").replace(/\//g, "_"), MAX_PART_BYTES + 40) || "Untitled";
  return [...folders, unreserved(`${stem}.${EXTENSIONS[format]}`)].join("/");
}

/** How names compare on disk: macOS and Windows ignore case, and macOS ignores how accents are encoded. */
function nameKey(path: string): string {
  return path.normalize("NFC").toLowerCase();
}

/** The keys of paths already in the export folder, with their folders, for `uniqueFilename`. */
export function takenNames(paths: Iterable<string>): Set<string> {
  const taken = new Set<string>();
  for (const p of paths) {
    const parts = p.split("/").filter(Boolean);
    for (let i = 1; i < parts.length; i++) taken.add(`${nameKey(parts.slice(0, i).join("/"))}/`);
    if (parts.length) taken.add(nameKey(parts.join("/")));
  }
  return taken;
}

/**
 * A relative path made safe part by part, for paths that didn't come from
 * `exportFilename`: dropped and illegal characters, trailing dots and
 * spaces, ".", ".." and empty parts, and device names, as `exportFilename`
 * treats them. Its own results come back unchanged.
 */
function safePath(path: string): string {
  const parts = path
    .split("/")
    .map((p) => p.replace(DROPPED, "").replace(ILLEGAL, "_").trim().replace(/[. ]+$/, ""))
    .filter(Boolean)
    .map(unreserved);
  return parts.length ? parts.join("/") : "Untitled";
}

/**
 * `path`, or if it is taken, the same with `-1`, `-2`… before the extension.
 * Names compare without case and accent encoding (see `nameKey`), and a
 * file never takes the path of a folder or the reverse: a folder whose name
 * is a file's gets a number too. Adds the result to `taken`, which holds
 * keys: files as they are, folders with a trailing "/" (see `takenNames`).
 * A path that isn't safe yet (not from `exportFilename`) is made safe first.
 */
export function uniqueFilename(path: string, taken: Set<string>): string {
  const parts = safePath(path).split("/");
  const file = parts.pop() as string;
  const folders: string[] = [];
  for (const f of parts) {
    const prefix = folders.length ? `${folders.join("/")}/` : "";
    let name = f;
    for (let i = 1; taken.has(nameKey(prefix + name)); i++) name = `${f}-${i}`;
    folders.push(name);
  }
  const dir = folders.length ? `${folders.join("/")}/` : "";
  const dot = file.lastIndexOf(".");
  const stem = dot > 0 ? file.slice(0, dot) : file;
  const ext = dot > 0 ? file.slice(dot) : "";
  let candidate = file;
  const isTaken = (c: string) => taken.has(nameKey(dir + c)) || taken.has(`${nameKey(dir + c)}/`);
  for (let i = 1; isTaken(candidate); i++) candidate = `${stem}-${i}${ext}`;
  for (let i = 1; i <= folders.length; i++) taken.add(`${nameKey(folders.slice(0, i).join("/"))}/`);
  taken.add(nameKey(dir + candidate));
  return dir + candidate;
}
