// QC round 7: images are capped by their size in pixels (read from the header, before any decoding), unused
// images are listed only when they are sound, and opening can hash images natively.
import { describe, expect, it } from "vitest";
import { imageDimensions, imageProblem, sha256Hex } from "./images.js";
import { FormatError, hashImage, readPackageWithReport, readPackageWithReportAsync, writePackage } from "./package.js";
import { GIF_1PX, GIF_HASH, PNG_1PX, PNG_HASH, paintsFile } from "./paints.fixture.js";
import { IMAGE_LIMITS } from "./schema.js";

/** PNG_1PX with its IHDR width and height replaced (the header's CRC is then wrong, which decoders reject anyway). */
function pngOfSize(width: number, height: number): Uint8Array {
  const out = PNG_1PX.slice();
  const view = new DataView(out.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return out;
}

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const riff = (chunk: string, body: number[]) => Uint8Array.from([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP"), ...ascii(chunk), 0, 0, 0, 0, ...body, ...new Array(16).fill(0)]);

describe("image size in pixels", () => {
  it("reads it from PNG, JPEG, WebP and GIF headers", () => {
    expect(imageDimensions(PNG_1PX)).toEqual({ width: 1, height: 1 });
    expect(imageDimensions(GIF_1PX)).toEqual({ width: 1, height: 1 });
    expect(imageDimensions(pngOfSize(20_000, 300))).toEqual({ width: 20_000, height: 300 });
    // JPEG: APP0, a DQT segment, then a progressive frame header (SOF2) of 640 × 480; fill bytes before the marker.
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 1, 2, 0xff, 0xdb, 0, 3, 0, 0xff, 0xff, 0xc2, 0, 11, 8, 0x01, 0xe0, 0x02, 0x80, 1, 1, 0x11, 0]);
    expect(imageDimensions(jpeg)).toEqual({ width: 640, height: 480 });
    // A DHT segment (C4) is not a frame header.
    expect(imageDimensions(Uint8Array.from([0xff, 0xd8, 0xff, 0xc4, 0, 7, 0, 0x10, 0, 0x20, 0, 0xff, 0xc0, 0, 11, 8, 0, 2, 0, 3, 1, 1, 0x11, 0]))).toEqual({ width: 3, height: 2 });
    // WebP: lossy (VP8), lossless (VP8L) and extended (VP8X).
    expect(imageDimensions(riff("VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2a, 0x20, 0x03, 0x58, 0x02]))).toEqual({ width: 800, height: 600 });
    // VP8L: signature 0x2f, then 14 bits of width − 1 and 14 bits of height − 1: 400 × 300.
    const w = 399, h = 299;
    const bits = w | (h << 14);
    expect(imageDimensions(riff("VP8L", [0x2f, bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, (bits >>> 24) & 0xff]))).toEqual({ width: 400, height: 300 });
    expect(imageDimensions(riff("VP8X", [0, 0, 0, 0, 0x1f, 0x4e, 0, 0x1f, 0x4e, 0]))).toEqual({ width: 20_000, height: 20_000 });
    // Damaged or cut short: unknown.
    expect(imageDimensions(PNG_1PX.slice(0, 20))).toBeNull();
    expect(imageDimensions(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]))).toBeNull();
    expect(imageDimensions(riff("VP8 ", [0, 0, 0, 1, 2, 3, 0, 0, 0, 0]))).toBeNull();
  });

  it("refuses images over 16,384 pixels a side or 64 megapixels, with a plain message", () => {
    expect(imageProblem(pngOfSize(16_384, 1))).toBeNull();
    expect(imageProblem(pngOfSize(16_385, 1))).toMatch(/too big \(16,385 × 1 pixels; Illigma opens images up to 16,384 pixels a side and 64 megapixels\)/);
    expect(imageProblem(pngOfSize(8192, 8192))).toBeNull(); // exactly 64 megapixels
    expect(imageProblem(pngOfSize(10_000, 10_000))).toMatch(/too big/);
    expect(imageProblem(pngOfSize(0, 10))).toMatch(/no pixels/);
    expect(imageProblem(PNG_1PX.slice(0, 20))).toMatch(/size in pixels can't be read/);
    // A 20,000 × 20,000 image in a small file never reaches a decoder: Document.addImage refuses it.
    expect(() => hashImage(pngOfSize(20_000, 20_000))).toThrow(FormatError);
    expect(() => hashImage(pngOfSize(20_000, 20_000))).toThrow(/This image can't be used: it is too big/);
    expect(IMAGE_LIMITS.maxPixels).toBe(64 * 1024 * 1024);
  });

  it("opens a file whose image is too big, without it, and never lists it for removal", () => {
    const file = paintsFile();
    const huge = pngOfSize(20_000, 20_000);
    const hugeHash = sha256Hex(huge);
    const tree = writePackage(file);
    tree.set(`images/${PNG_HASH}.png`, huge); // a used image replaced on disk by a huge one
    tree.set(`images/${hugeHash}.png`, huge); // and an unused huge one under its own name
    const { file: back, warnings, unusedImages } = readPackageWithReport(tree);
    expect(back.images?.has(PNG_HASH)).toBe(false);
    expect(back.images?.get(GIF_HASH)).toEqual(GIF_1PX);
    expect(warnings).toContain(`images/${PNG_HASH}.png is too big (20,000 × 20,000 pixels; Illigma opens images up to 16,384 pixels a side and 64 megapixels), so it was not opened.`);
    expect(unusedImages).toEqual([]);
  });
});

describe("unused and damaged images on reading", () => {
  it("lists only sound unused images under their own name as removable", () => {
    const tree = writePackage(paintsFile());
    const spare = Uint8Array.from([...PNG_1PX, 7]);
    const spareHash = sha256Hex(spare);
    tree.set(`images/${spareHash}.png`, spare);
    tree.set(`images/${"b".repeat(64)}.png`, PNG_1PX); // misnamed: its bytes have another hash
    tree.set(`images/${"c".repeat(64)}.gif`, Uint8Array.from(ascii("not a gif")));
    const { unusedImages } = readPackageWithReport(tree);
    expect(unusedImages).toEqual([`images/${spareHash}.png`]);
  });

  it("hashes natively when asked, with the same result as the synchronous reader", async () => {
    const tree = writePackage(paintsFile());
    const flipped = (tree.get(`images/${GIF_HASH}.gif`) as Uint8Array).slice();
    flipped[flipped.length - 3] = (flipped[flipped.length - 3] as number) ^ 0x55;
    tree.set(`images/${GIF_HASH}.gif`, flipped);
    const sync = readPackageWithReport(tree);
    const native = await readPackageWithReportAsync(tree);
    expect(native.warnings).toEqual(sync.warnings);
    expect(native.file.images).toEqual(sync.file.images);
    expect(native.warnings.join("\n")).toMatch(/is damaged \(its contents don't match its name\)/);
  });
});
