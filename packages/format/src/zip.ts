/**
 * The single-file form of `.illigma`: the package tree in one zip archive.
 *
 * The zip holds exactly the package paths (`manifest.json`, `pages/…`), so
 * unzipping a file gives a valid package folder and zipping a package folder
 * gives a valid file. There is no extra marker entry. Instead:
 *
 * - `manifest.json` is always the first entry and is stored uncompressed, so
 *   a tool can read the format, version and name from the first local header
 *   without inflating anything.
 * - Every other entry follows in sorted path order, deflated (or stored when
 *   deflate doesn't make it smaller). Images (`images/…`, already
 *   compressed) are always stored, and come back as bytes; every other
 *   entry must be UTF-8 text.
 * - Timestamps are fixed at 1980-01-01 00:00 (the zip epoch), file names are
 *   flagged UTF-8, and there are no comments, extra fields or data
 *   descriptors. The same tree always zips to identical bytes.
 *
 * The container code is our own (it is small and lets us control every byte
 * and every limit); DEFLATE comes from fflate (MIT).
 *
 * Reading refuses anything unsafe: paths that escape the folder ("..",
 * absolute paths, drive letters, backslashes), duplicate paths, encrypted or
 * ZIP64 archives, unknown compression, CRC mismatches, and archives whose
 * contents add up to more than `maxTotalBytes` (default 512 MB). Every failure
 * is a `FormatError`.
 */

import { deflateSync, Inflate } from "fflate";
import { isBinaryPackagePath } from "./images.js";
import { FormatError, type FileData, type FileTree } from "./package.js";

export const ZIP_DEFAULT_MAX_TOTAL_BYTES = 512 * 1024 * 1024;

export interface ZipReadOptions {
  /** Refuse archives whose uncompressed contents add up to more than this. Default 512 MB. */
  maxTotalBytes?: number;
}

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_END = 0x06054b50;
const FLAG_ENCRYPTED = 0x0001;
const FLAG_UTF8 = 0x0800;
const VERSION = 20; // 2.0: deflate, folders
const DOS_TIME = 0; // 00:00:00
const DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01
const STORED = 0;
const DEFLATED = 8;
const INFLATE_CHUNK = 16 * 1024;
const MAX_DEFLATE_RATIO = 1100;
const MANIFEST = "manifest.json";

/** True when `bytes` starts like a zip archive (a local file header, or an empty archive). */
export function isZip(bytes: Uint8Array): boolean {
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return false;
  return (bytes[2] === 3 && bytes[3] === 4) || (bytes[2] === 5 && bytes[3] === 6);
}

// ---------------------------------------------------------------- paths

/** Why `path` is unsafe or malformed, or null when it's a clean relative path. */
function pathProblem(path: string): string | null {
  const shown = JSON.stringify(path);
  if (path.length === 0) return "An entry has an empty name.";
  if (/[\u0000-\u001f\u007f]/.test(path)) return `${shown} contains control characters.`;
  if (path.includes("\\")) return `${shown} uses backslashes.`;
  if (path.startsWith("/") || /^[A-Za-z]:/.test(path)) return `${shown} is an absolute path.`;
  const parts = path.replace(/\/$/, "").split("/");
  if (parts.some((p) => p === "..")) return `${shown} points outside the file.`;
  if (parts.some((p) => p === "" || p === ".")) return `${shown} is not a clean path.`;
  return null;
}

function unsafePath(problem: string): FormatError {
  return new FormatError("The file contains an unsafe path and was not opened.", [problem]);
}

function damaged(problem: string): FormatError {
  return new FormatError("The file is damaged and can't be opened safely.", [problem]);
}

// ---------------------------------------------------------------- CRC-32

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = (CRC_TABLE[(c ^ (data[i] as number)) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------- write

interface Entry {
  name: Uint8Array;
  method: number;
  crc: number;
  data: Uint8Array;
  size: number;
  offset: number;
}

/**
 * Zip a package tree into the single-file form. Deterministic: the same tree
 * (in any insertion order) gives identical bytes. Throws `FormatError` for
 * unsafe paths or a missing manifest.
 */
export function writeZip(tree: FileTree): Uint8Array {
  if (!tree.has(MANIFEST)) throw new FormatError("Can't save: the package has no manifest.json.");
  const paths = [...tree.keys()].filter((p) => p !== MANIFEST).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  paths.unshift(MANIFEST);

  const enc = new TextEncoder();
  const entries: Entry[] = [];
  let offset = 0;
  for (const path of paths) {
    const problem = pathProblem(path);
    if (problem) throw new FormatError("Can't save: the package has an unsafe path.", [problem]);
    if (path.endsWith("/")) throw new FormatError("Can't save: the package has an unsafe path.", [`${JSON.stringify(path)} is a folder.`]);
    const value = tree.get(path) as FileData;
    const raw = typeof value === "string" ? enc.encode(value) : value;
    const name = enc.encode(path);
    if (name.length > 0xffff) throw new FormatError("Can't save: a path is too long.", [path.slice(0, 80)]);
    let method = STORED;
    let data = raw;
    // Images are compressed already: storing them saves deflating megabytes for nothing.
    if (path !== MANIFEST && !isBinaryPackagePath(path)) {
      const packed = deflateSync(raw, { level: 6 });
      if (packed.length < raw.length) {
        method = DEFLATED;
        data = packed;
      }
    }
    entries.push({ name, method, crc: crc32(raw), data, size: raw.length, offset });
    offset += 30 + name.length + data.length;
  }

  const centralSize = entries.reduce((n, e) => n + 46 + e.name.length, 0);
  const total = offset + centralSize + 22;
  if (total > 0xffffffff || entries.length > 0xffff) throw new FormatError("Can't save: the file is too large for a zip.");

  const out = new Uint8Array(total);
  const v = new DataView(out.buffer);
  let p = 0;
  for (const e of entries) {
    v.setUint32(p, SIG_LOCAL, true);
    v.setUint16(p + 4, VERSION, true);
    v.setUint16(p + 6, FLAG_UTF8, true);
    v.setUint16(p + 8, e.method, true);
    v.setUint16(p + 10, DOS_TIME, true);
    v.setUint16(p + 12, DOS_DATE, true);
    v.setUint32(p + 14, e.crc, true);
    v.setUint32(p + 18, e.data.length, true);
    v.setUint32(p + 22, e.size, true);
    v.setUint16(p + 26, e.name.length, true);
    v.setUint16(p + 28, 0, true);
    out.set(e.name, p + 30);
    out.set(e.data, p + 30 + e.name.length);
    p += 30 + e.name.length + e.data.length;
  }
  const centralStart = p;
  for (const e of entries) {
    v.setUint32(p, SIG_CENTRAL, true);
    v.setUint16(p + 4, VERSION, true); // made by: 2.0, MS-DOS attributes
    v.setUint16(p + 6, VERSION, true);
    v.setUint16(p + 8, FLAG_UTF8, true);
    v.setUint16(p + 10, e.method, true);
    v.setUint16(p + 12, DOS_TIME, true);
    v.setUint16(p + 14, DOS_DATE, true);
    v.setUint32(p + 16, e.crc, true);
    v.setUint32(p + 20, e.data.length, true);
    v.setUint32(p + 24, e.size, true);
    v.setUint16(p + 28, e.name.length, true);
    // extra length, comment length, disk, internal attrs, external attrs: all 0
    v.setUint32(p + 42, e.offset, true);
    out.set(e.name, p + 46);
    p += 46 + e.name.length;
  }
  v.setUint32(p, SIG_END, true);
  v.setUint16(p + 8, entries.length, true);
  v.setUint16(p + 10, entries.length, true);
  v.setUint32(p + 12, centralSize, true);
  v.setUint32(p + 16, centralStart, true);
  return out;
}

// ---------------------------------------------------------------- read

function inflateExactly(data: Uint8Array, size: number): Uint8Array {
  const out = new Uint8Array(size);
  let filled = 0;
  let done = false;
  const inflater = new Inflate((chunk, final) => {
    if (filled + chunk.length > size) throw damaged("An entry is larger than the archive says.");
    out.set(chunk, filled);
    filled += chunk.length;
    if (final) done = true;
  });
  try {
    if (data.length === 0) inflater.push(data, true);
    for (let i = 0; i < data.length; i += INFLATE_CHUNK) {
      inflater.push(data.subarray(i, i + INFLATE_CHUNK), i + INFLATE_CHUNK >= data.length);
    }
  } catch (e) {
    if (e instanceof FormatError) throw e;
    throw damaged("An entry's compressed data is broken.");
  }
  if (!done || filled !== size) throw damaged("An entry is smaller than the archive says.");
  return out;
}

/** Strip OS noise and a single wrapping folder (as made by "Compress folder" in Finder or Explorer). */
function unwrap<T>(tree: Map<string, T>): Map<string, T> {
  if (tree.has(MANIFEST)) return tree;
  const first = [...tree.keys()][0];
  const slash = first?.indexOf("/") ?? -1;
  if (first === undefined || slash < 0) return tree;
  const prefix = first.slice(0, slash + 1);
  if (![...tree.keys()].every((k) => k.startsWith(prefix)) || !tree.has(prefix + MANIFEST)) return tree;
  return new Map([...tree].map(([k, data]) => [k.slice(prefix.length), data]));
}

/**
 * Unzip the single-file form into a package tree for `readPackage`.
 * Throws `FormatError` for anything that isn't a safe, intact zip.
 */
export function readZip(bytes: Uint8Array, options: ZipReadOptions = {}): FileTree {
  const maxTotal = options.maxTotalBytes ?? ZIP_DEFAULT_MAX_TOTAL_BYTES;
  if (!isZip(bytes)) throw new FormatError("This is not an Illigma file: it isn't a zip archive.");
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const len = bytes.length;

  // End of central directory: the last 22 bytes, unless a comment follows it.
  let end = -1;
  for (let i = len - 22; i >= 0 && i >= len - 22 - 0xffff; i--) {
    if (v.getUint32(i, true) === SIG_END && i + 22 + v.getUint16(i + 20, true) === len) {
      end = i;
      break;
    }
  }
  if (end < 0) throw damaged("The zip index is missing; the file may be cut short.");
  const count = v.getUint16(end + 10, true);
  const centralSize = v.getUint32(end + 12, true);
  const centralStart = v.getUint32(end + 16, true);
  if (count === 0xffff || centralSize === 0xffffffff || centralStart === 0xffffffff) {
    throw new FormatError("This file uses ZIP64, which this version of Illigma can't open.");
  }
  if (v.getUint16(end + 4, true) !== 0 || v.getUint16(end + 6, true) !== 0 || v.getUint16(end + 8, true) !== count) {
    throw new FormatError("Split or multi-part zip archives can't be opened.");
  }
  if (centralStart + centralSize > end) throw damaged("The zip index points past the end of the file.");

  const utf8 = new TextDecoder("utf-8", { fatal: true });
  const raws = new Map<string, Uint8Array>();
  let total = 0;
  let p = centralStart;
  const centralEnd = centralStart + centralSize;
  for (let i = 0; i < count; i++) {
    if (p + 46 > centralEnd || v.getUint32(p, true) !== SIG_CENTRAL) throw damaged("The zip index is broken.");
    const flags = v.getUint16(p + 8, true);
    const method = v.getUint16(p + 10, true);
    const crc = v.getUint32(p + 16, true);
    const packedSize = v.getUint32(p + 20, true);
    const size = v.getUint32(p + 24, true);
    const nameLen = v.getUint16(p + 28, true);
    const next = p + 46 + nameLen + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
    const localStart = v.getUint32(p + 42, true);
    if (next > centralEnd) throw damaged("The zip index is broken.");

    let name: string;
    try {
      name = utf8.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    } catch {
      throw damaged("An entry name is not valid UTF-8.");
    }
    p = next;

    const problem = pathProblem(name);
    if (problem) throw unsafePath(problem);
    if (packedSize === 0xffffffff || size === 0xffffffff || localStart === 0xffffffff) {
      throw new FormatError("This file uses ZIP64, which this version of Illigma can't open.");
    }
    if (flags & FLAG_ENCRYPTED) throw new FormatError("Encrypted zip archives can't be opened.");
    if (name.endsWith("/")) continue; // folder entry
    if (name.startsWith("__MACOSX/") || name === ".DS_Store" || name.endsWith("/.DS_Store")) continue;
    if (raws.has(name)) throw damaged(`${JSON.stringify(name)} appears twice.`);
    if (method !== STORED && method !== DEFLATED) {
      throw new FormatError(`${JSON.stringify(name)} uses a compression method Illigma can't read.`);
    }
    total += size;
    if (total > maxTotal) {
      throw new FormatError(
        `The file is too large to open: its contents add up to more than ${Math.floor(maxTotal / (1024 * 1024))} MB.`,
      );
    }

    if (localStart + 30 > centralStart || v.getUint32(localStart, true) !== SIG_LOCAL) {
      throw damaged(`The data for ${JSON.stringify(name)} is missing.`);
    }
    const dataStart = localStart + 30 + v.getUint16(localStart + 26, true) + v.getUint16(localStart + 28, true);
    if (dataStart + packedSize > centralStart) throw damaged(`The data for ${JSON.stringify(name)} is cut short.`);
    const packed = bytes.subarray(dataStart, dataStart + packedSize);

    let raw: Uint8Array;
    if (method === STORED) {
      if (packedSize !== size) throw damaged(`${JSON.stringify(name)} has the wrong size.`);
      raw = packed;
    } else {
      // DEFLATE can't expand more than about 1032:1, so a bigger claim is a lie: refuse it before allocating.
      if (size > packedSize * MAX_DEFLATE_RATIO + 1024) throw damaged(`${JSON.stringify(name)} claims an impossible size.`);
      raw = inflateExactly(packed, size);
    }
    if (crc32(raw) !== crc) throw damaged(`${JSON.stringify(name)} failed its checksum.`);
    raws.set(name, raw);
  }
  // Text or bytes is decided by the path inside the package, so after any wrapping folder is stripped.
  const tree: FileTree = new Map();
  for (const [name, raw] of unwrap(raws)) {
    if (isBinaryPackagePath(name)) {
      tree.set(name, raw.slice()); // its own copy, so the whole archive isn't kept alive
      continue;
    }
    try {
      tree.set(name, utf8.decode(raw));
    } catch {
      throw damaged(`${JSON.stringify(name)} is not UTF-8 text.`);
    }
  }
  return tree;
}
