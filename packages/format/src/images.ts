/**
 * Image files in a package. Each image is stored once, under
 * `images/<hash>.<ext>`, where the hash is the SHA-256 of its bytes in
 * lowercase hex (the `imageHash` of the paints that use it) and the
 * extension names its format. Images are the package's only binary files.
 */

import { IMAGE_LIMITS, type ImageFormat, type Node } from "./schema.js";

/** A valid `imageHash`: SHA-256 as 64 lowercase hex digits. */
export const IMAGE_HASH_PATTERN = /^[0-9a-f]{64}$/;

const IMAGE_PATH = /^images\/([0-9a-f]{64})\.(png|jpg|jpeg|webp|gif)$/;

/** True for package paths whose contents are bytes rather than UTF-8 text: everything under `images/`. */
export function isBinaryPackagePath(path: string): boolean {
  return path.startsWith("images/");
}

/** The package path of an image. */
export function imagePath(hash: string, format: ImageFormat): string {
  return `images/${hash}.${format}`;
}

/** The hash an `images/…` path names, or null if it isn't one of ours. Accepts ".jpeg" as well as ".jpg". */
export function parseImagePath(path: string): { hash: string; ext: string } | null {
  const m = IMAGE_PATH.exec(path);
  return m ? { hash: m[1] as string, ext: m[2] as string } : null;
}

const startsWith = (b: Uint8Array, sig: readonly number[], at = 0) => b.length >= at + sig.length && sig.every((x, i) => b[at + i] === x);

/** The format of an image file, from its first bytes; null if it is none Illigma stores. */
export function sniffImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return "gif";
  return null;
}

/** Why `bytes` can't be stored as an image, or null if it can. Checks the size in pixels too (`imageDimensions`), without decoding. */
export function imageProblem(bytes: unknown): string | null {
  if (!(bytes instanceof Uint8Array)) return "is not binary data";
  if (bytes.length > IMAGE_LIMITS.maxBytes) return `is larger than ${IMAGE_LIMITS.maxBytes / (1024 * 1024)} MB`;
  if (!sniffImageFormat(bytes)) return "is not a PNG, JPEG, WebP or GIF image";
  return imageSizeProblem(imageDimensions(bytes));
}

/** Why an image of this size in pixels can't be used (null if it can), or that its size can't be read. */
export function imageSizeProblem(size: { width: number; height: number } | null): string | null {
  if (!size) return "is damaged (its size in pixels can't be read)";
  const { width, height } = size;
  if (width < 1 || height < 1) return "is damaged (it has no pixels)";
  if (width > IMAGE_LIMITS.maxSide || height > IMAGE_LIMITS.maxSide || width * height > IMAGE_LIMITS.maxPixels) {
    return `is too big (${width.toLocaleString("en-US")} × ${height.toLocaleString("en-US")} pixels; Illigma opens images up to ${IMAGE_LIMITS.maxSide.toLocaleString("en-US")} pixels a side and 64 megapixels)`;
  }
  return null;
}

/**
 * The size in pixels an image file declares in its header, read without
 * decoding it: PNG (IHDR), JPEG (the SOF marker), WebP (VP8, VP8L or VP8X)
 * and GIF (the logical screen). Null if the header is missing or damaged.
 */
export function imageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const format = sniffImageFormat(bytes);
  const u16be = (i: number) => ((bytes[i] as number) << 8) | (bytes[i + 1] as number);
  const u16le = (i: number) => (bytes[i] as number) | ((bytes[i + 1] as number) << 8);
  const u24le = (i: number) => u16le(i) | ((bytes[i + 2] as number) << 16);
  const u32be = (i: number) => (((bytes[i] as number) << 24) >>> 0) + (((bytes[i + 1] as number) << 16) | ((bytes[i + 2] as number) << 8) | (bytes[i + 3] as number));
  if (format === "png") {
    // Signature, then the IHDR chunk first: length (13), "IHDR", width, height.
    if (bytes.length < 24 || !startsWith(bytes, [0x49, 0x48, 0x44, 0x52], 12)) return null;
    return { width: u32be(16), height: u32be(20) };
  }
  if (format === "gif") {
    if (bytes.length < 10) return null;
    return { width: u16le(6), height: u16le(8) };
  }
  if (format === "webp") {
    if (bytes.length < 30) return null;
    const chunk = String.fromCharCode(bytes[12] as number, bytes[13] as number, bytes[14] as number, bytes[15] as number);
    if (chunk === "VP8X") return { width: u24le(24) + 1, height: u24le(27) + 1 };
    if (chunk === "VP8L") {
      if (bytes[20] !== 0x2f) return null;
      const b = (i: number) => bytes[21 + i] as number;
      return { width: 1 + (((b(1) & 0x3f) << 8) | b(0)), height: 1 + (((b(3) & 0x0f) << 10) | (b(2) << 2) | ((b(1) & 0xc0) >> 6)) };
    }
    if (chunk === "VP8 ") {
      // Frame tag (3 bytes), then the start code 9d 01 2a, then 14-bit width and height.
      if (!startsWith(bytes, [0x9d, 0x01, 0x2a], 23)) return null;
      return { width: u16le(26) & 0x3fff, height: u16le(28) & 0x3fff };
    }
    return null;
  }
  if (format === "jpg") {
    // Walk the markers to the first start-of-frame (SOF0–SOF15, except DHT C4, JPG C8 and DAC CC).
    let i = 2;
    while (i + 3 < bytes.length) {
      if (bytes[i] !== 0xff) return null;
      const marker = bytes[i + 1] as number;
      if (marker === 0xff) {
        i++; // fill byte
        continue;
      }
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
        i += 2; // no length
        continue;
      }
      if (marker === 0xd9 || marker === 0xda) return null; // end of image, or scan data before any frame header
      const length = u16be(i + 2);
      if (length < 2) return null;
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        if (i + 9 > bytes.length) return null;
        return { width: u16be(i + 7), height: u16be(i + 5) };
      }
      i += 2 + length;
    }
    return null;
  }
  return null;
}

/** Every `imageHash` the nodes' fills and strokes use, in first-use order. */
export function referencedImageHashes(nodes: readonly Pick<Node, "fills" | "strokes">[]): string[] {
  const out = new Set<string>();
  for (const n of nodes) {
    for (const list of [n.fills, n.strokes]) {
      if (!Array.isArray(list)) continue;
      for (const p of list) if (p?.type === "IMAGE" && typeof p.imageHash === "string") out.add(p.imageHash);
    }
  }
  return [...out];
}

// ---------------------------------------------------------------- SHA-256

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/**
 * SHA-256 of `bytes` as 64 lowercase hex digits, through the platform's
 * native `crypto.subtle` when there is one (browsers, Node), off the main
 * thread's JavaScript; otherwise `sha256Hex`.
 */
export async function sha256HexAsync(bytes: Uint8Array): Promise<string> {
  const subtle = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
  if (!subtle) return sha256Hex(bytes);
  try {
    const digest = new Uint8Array(await subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>));
    let out = "";
    for (const b of digest) out += b.toString(16).padStart(2, "0");
    return out;
  } catch {
    return sha256Hex(bytes); // e.g. an insecure context, where subtle is missing or refuses
  }
}

/**
 * SHA-256 of `bytes`, as 64 lowercase hex digits. Synchronous, so reading a
 * package can check every image against its name without waiting.
 */
export function sha256Hex(bytes: Uint8Array): string {
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const len = bytes.length;
  // The message, a 1 bit, zeros, then the length in bits as 64 bits: a whole number of 64-byte blocks.
  const total = Math.ceil((len + 9) / 64) * 64;
  const tail = new Uint8Array(total - Math.floor(len / 64) * 64);
  const tailStart = Math.floor(len / 64) * 64;
  tail.set(bytes.subarray(tailStart));
  tail[len - tailStart] = 0x80;
  const bits = len * 8;
  const tv = new DataView(tail.buffer);
  tv.setUint32(tail.length - 8, Math.floor(bits / 0x100000000));
  tv.setUint32(tail.length - 4, bits >>> 0);
  const main = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  for (let off = 0; off < total; off += 64) {
    const fromTail = off >= tailStart;
    const view = fromTail ? tv : main;
    const base = fromTail ? off - tailStart : off;
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(base + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15] as number, b = w[i - 2] as number;
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[i] = ((w[i - 16] as number) + s0 + (w[i - 7] as number) + s1) | 0;
    }
    let a = h[0] as number, b = h[1] as number, c = h[2] as number, d = h[3] as number;
    let e = h[4] as number, f = h[5] as number, g = h[6] as number, hh = h[7] as number;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + (K[i] as number) + (w[i] as number)) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h[0] = (h[0] as number) + a;
    h[1] = (h[1] as number) + b;
    h[2] = (h[2] as number) + c;
    h[3] = (h[3] as number) + d;
    h[4] = (h[4] as number) + e;
    h[5] = (h[5] as number) + f;
    h[6] = (h[6] as number) + g;
    h[7] = (h[7] as number) + hh;
  }
  let out = "";
  for (const x of h) out += x.toString(16).padStart(8, "0");
  return out;
}
