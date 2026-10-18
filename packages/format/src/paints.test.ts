import { createHash } from "node:crypto";
import { unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { imagePath, isBinaryPackagePath, parseImagePath, referencedImageHashes, sha256Hex, sniffImageFormat } from "./images.js";
import { checkImage, FormatError, hashImage, readPackage, readPackageWithReport, writePackage, type FileTree } from "./package.js";
import { ALL_PAINTS, GIF_1PX, GIF_HASH, paintsFile, PNG_1PX, PNG_HASH } from "./paints.fixture.js";
import { sampleFile } from "./sample.fixture.js";
import { IMAGE_LIMITS, PAINT_LIMITS, type IlligmaFile } from "./schema.js";
import { validateFile, validateNodeField } from "./validate.js";
import { readZip, writeZip } from "./zip.js";

const enc = new TextEncoder();
/** Packages store nodes per page, sorted by id: compare files that way. */
const byId = (f: IlligmaFile) => ({ ...f, nodes: [...f.nodes].sort((a, b) => (a.id < b.id ? -1 : 1)) });

describe("paints, effects and blend modes in the file", () => {
  it("round-trip through the package and the zip unchanged, and write identical bytes twice", () => {
    const file = paintsFile();
    const tree = writePackage(file);
    const back = readPackage(tree);
    expect(byId(back)).toEqual(byId(file));
    expect([...writePackage(back)]).toEqual([...tree]);
    const zipped = writeZip(tree);
    expect(byId(readPackage(readZip(zipped)))).toEqual(byId(file));
    expect(writeZip(writePackage(readPackage(readZip(zipped))))).toEqual(zipped);
  });

  it("leave files without them exactly as before", () => {
    const text = writePackage(sampleFile()).get("pages/page1.json") as string;
    expect(text).not.toMatch(/effects|blendMode|strokeAlign|gradient|imageHash/);
    expect(text).toContain('"fills":[{"color":{"a":1,"b":1,"g":1,"r":1},"type":"SOLID","visible":true}]'); // no paint opacity
    expect([...writePackage(sampleFile()).keys()].some((p) => p.startsWith("images/"))).toBe(false);
  });

  it("accepts every paint, effect and blend mode Figma has", () => {
    expect(validateNodeField("fills", ALL_PAINTS)).toBeNull();
    for (const mode of ["PASS_THROUGH", "NORMAL", "DARKEN", "MULTIPLY", "LINEAR_BURN", "COLOR_BURN", "LIGHTEN", "SCREEN", "LINEAR_DODGE", "COLOR_DODGE", "OVERLAY", "SOFT_LIGHT", "HARD_LIGHT", "DIFFERENCE", "EXCLUSION", "HUE", "SATURATION", "COLOR", "LUMINOSITY"]) {
      expect(validateNodeField("blendMode", mode)).toBeNull();
      expect(validateNodeField("fills", [{ type: "SOLID", visible: true, color: { r: 0, g: 0, b: 0, a: 1 }, blendMode: mode }])).toBeNull();
    }
    for (const align of ["CENTER", "INSIDE", "OUTSIDE"]) expect(validateNodeField("strokeAlign", align)).toBeNull();
    expect(validateNodeField("effects", [])).toBeNull();
    expect(validateNodeField("effects", undefined)).toBeNull();
  });

  const solid = { type: "SOLID", visible: true, color: { r: 0, g: 0, b: 0, a: 1 } };
  const linear = {
    type: "GRADIENT_LINEAR",
    visible: true,
    gradientStops: [{ position: 0, color: { r: 0, g: 0, b: 0, a: 1 } }],
    gradientTransform: [
      [1, 0, 0],
      [0, 1, 0],
    ],
  };
  const image = { type: "IMAGE", visible: true, imageHash: PNG_HASH, scaleMode: "FILL" };
  const drop = { type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 1 }, offset: { x: 0, y: 0 }, radius: 4, visible: true };

  const badPaints: [string, unknown, RegExp][] = [
    ["an unknown paint type", [{ ...solid, type: "VIDEO" }], /unknown type "VIDEO"/],
    ["an unknown key", [{ ...solid, filters: {} }], /unknown field "filters"/],
    ["a missing colour", [{ type: "SOLID", visible: true }], /has no "color"/],
    ["an opacity above 1", [{ ...solid, opacity: 2 }], /"opacity" must be a number from 0 to 1/],
    ["an unknown paint blend mode", [{ ...solid, blendMode: "ADD" }], /"blendMode" must be one of/],
    ["no stops", [{ ...linear, gradientStops: [] }], /1 to 1,000 colour stops/],
    ["a stop past 1", [{ ...linear, gradientStops: [{ position: 1.5, color: solid.color }] }], /stop 0/],
    ["a stop with an extra key", [{ ...linear, gradientStops: [{ position: 0, color: solid.color, midpoint: 0.5 }] }], /stop 0/],
    ["a 3 × 3 transform", [{ ...linear, gradientTransform: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] }], /2 × 3 matrix/],
    ["a NaN in the transform", [{ ...linear, gradientTransform: [[NaN, 0, 0], [0, 1, 0]] }], /2 × 3 matrix/],
    ["too many stops", [{ ...linear, gradientStops: Array.from({ length: PAINT_LIMITS.maxGradientStops + 1 }, () => ({ position: 0, color: solid.color })) }], /colour stops/],
    ["an uppercase hash", [{ ...image, imageHash: PNG_HASH.toUpperCase() }], /SHA-256/],
    ["a short hash", [{ ...image, imageHash: "abc" }], /SHA-256/],
    ["a path as a hash", [{ ...image, imageHash: "../../etc/passwd" }], /SHA-256/],
    ["an unknown scale mode", [{ ...image, scaleMode: "STRETCH" }], /"scaleMode"/],
    ["a zero tile scale", [{ ...image, scaleMode: "TILE", scalingFactor: 0 }], /"scalingFactor"/],
    ["a bad crop transform", [{ ...image, scaleMode: "CROP", imageTransform: [1, 0, 0, 0, 1, 0] }], /"imageTransform"/],
    ["a paint that isn't an object", ["red"], /paint 0 is not an object/],
    ["too many paints", Array.from({ length: PAINT_LIMITS.maxPaints + 1 }, () => solid), /at most 1,000 paints/],
  ];
  it.each(badPaints)("refuses %s in a paint list", (_, value, message) => {
    expect(validateNodeField("fills", value)).toMatch(message);
    expect(validateNodeField("strokes", value)).toMatch(message);
  });

  const badEffects: [string, unknown, RegExp][] = [
    ["an unknown effect", [{ ...drop, type: "NOISE" }], /unknown type "NOISE"/],
    ["a negative radius", [{ ...drop, radius: -1 }], /"radius" must be a number from 0 to 1,000/],
    ["a huge radius", [{ ...drop, radius: 1e6 }], /"radius"/],
    ["a huge spread", [{ ...drop, spread: -5000 }], /"spread"/],
    ["an offset with an extra key", [{ ...drop, offset: { x: 0, y: 0, z: 1 } }], /"offset"/],
    ["a missing offset", [{ type: "DROP_SHADOW", color: drop.color, radius: 1, visible: true }], /has no "offset"/],
    ["showShadowBehindNode on an inner shadow", [{ ...drop, type: "INNER_SHADOW", showShadowBehindNode: true }], /unknown field "showShadowBehindNode"/],
    ["a colour on a blur", [{ type: "LAYER_BLUR", radius: 4, visible: true, color: drop.color }], /unknown field "color"/],
    ["a blur without visible", [{ type: "BACKGROUND_BLUR", radius: 4 }], /has no "visible"/],
    ["too many effects", Array.from({ length: PAINT_LIMITS.maxEffects + 1 }, () => drop), /at most 100 effects/],
    ["not a list", drop, /must be a list of effects/],
  ];
  it.each(badEffects)("refuses %s", (_, value, message) => {
    expect(validateNodeField("effects", value)).toMatch(message);
  });

  it("refuses unknown layer blend modes and stroke alignments", () => {
    expect(validateNodeField("blendMode", "ADD")).toMatch(/must be one of/);
    expect(validateNodeField("strokeAlign", "MIDDLE")).toMatch(/must be one of/);
  });

  it("refuses a damaged paint on reading, naming the node", () => {
    const tree = writePackage(paintsFile());
    const page = tree.get("pages/page1.json") as string;
    tree.set("pages/page1.json", page.replace('"scaleMode":"FILL"', '"scaleMode":"SQUASH"'));
    expect(() => readPackage(tree)).toThrow(/Node rect1: "fills" paint 5 \(IMAGE\) "scaleMode"/);
  });
});

describe("images in the package", () => {
  it("are stored once each, by hash and format, only when a paint uses them", () => {
    const file = paintsFile();
    const unused = Uint8Array.from([...PNG_1PX, 0]); // still a PNG by its first bytes
    file.images?.set(sha256Hex(unused), unused);
    const tree = writePackage(file);
    expect([...tree.keys()].filter((k) => k.startsWith("images/"))).toEqual([imagePath(PNG_HASH, "png"), imagePath(GIF_HASH, "gif")]);
    expect(tree.get(`images/${PNG_HASH}.png`)).toBe(PNG_1PX);
    expect(readPackage(tree).images).toEqual(new Map([[PNG_HASH, PNG_1PX], [GIF_HASH, GIF_1PX]]));
  });

  it("refuse to save an image that doesn't match its hash, isn't an image, or is too large", () => {
    const wrong = paintsFile();
    wrong.images?.set(PNG_HASH, Uint8Array.from([...PNG_1PX, 1]));
    expect(() => writePackage(wrong)).toThrow(/doesn't match its hash/);
    const text = paintsFile();
    text.images?.set(PNG_HASH, enc.encode("not an image"));
    expect(() => writePackage(text)).toThrow(/not a PNG, JPEG, WebP or GIF/);
    expect(validateFile(text).join()).toMatch(/not a PNG, JPEG, WebP or GIF/);
    const huge = new Uint8Array(IMAGE_LIMITS.maxBytes + 1);
    huge.set(PNG_1PX);
    const big = paintsFile();
    big.images?.set(PNG_HASH, huge);
    expect(validateFile(big).join()).toMatch(/larger than 32 MB/);
    expect(() => hashImage(huge)).toThrow(FormatError);
    expect(() => hashImage(enc.encode("GIF87"))).toThrow(/can't be used/);
    const notMap = paintsFile() as unknown as { images: unknown };
    notMap.images = { [PNG_HASH]: PNG_1PX };
    expect(validateFile(notMap as never).join()).toMatch(/must be a map/);
    const badKey = paintsFile();
    badKey.images?.set("x", PNG_1PX);
    expect(validateFile(badKey).join()).toMatch(/no valid hash/);
  });

  it("save a paint whose image isn't in memory as just its hash, and warn about it on reading", () => {
    const file = paintsFile();
    file.images?.delete(GIF_HASH);
    const { file: back, warnings } = readPackageWithReport(writePackage(file));
    expect(back.images?.has(GIF_HASH)).toBe(false);
    expect(warnings).toEqual([`Image ${GIF_HASH.slice(0, 12)}… is missing, so the layers that use it show no image.`]);
    const none = paintsFile();
    delete none.images;
    expect(readPackageWithReport(writePackage(none)).file.images).toBeUndefined();
  });

  it("open the rest of the file when an image is damaged, unknown, unused or misnamed, with a warning for each", () => {
    const tree = writePackage(paintsFile());
    const png = `images/${PNG_HASH}.png`;
    const gif = `images/${GIF_HASH}.gif`;
    const flipped = (tree.get(png) as Uint8Array).slice();
    flipped[20] = (flipped[20] as number) ^ 0xff;
    tree.set(png, flipped);
    tree.set(gif, enc.encode("GIF? no"));
    const stray = "a".repeat(64);
    tree.set(`images/${stray}.png`, PNG_1PX);
    tree.set("images/notes.txt", enc.encode("hello"));
    const { file, warnings } = readPackageWithReport(tree);
    expect(file.images).toBeUndefined();
    // Files in path order, then missing images in first-use order.
    expect(warnings).toEqual([
      `images/${stray}.png is not used by any layer, so it was ignored.`,
      `${gif} is not a PNG, JPEG, WebP or GIF image, so it was not opened.`,
      `${png} is damaged (its contents don't match its name), so it was not opened.`,
      "images/notes.txt is not an image file Illigma stores, so it was ignored.",
      `Image ${PNG_HASH.slice(0, 12)}… is missing, so the layers that use it show no image.`,
      `Image ${GIF_HASH.slice(0, 12)}… is missing, so the layers that use it show no image.`,
    ]);
  });

  it("refuse an image read as text, and accept .jpeg as well as .jpg", () => {
    const tree = writePackage(paintsFile());
    tree.set(`images/${PNG_HASH}.png`, "\u0089PNG");
    expect(readPackageWithReport(tree).warnings[0]).toMatch(/was read as text/);
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
    const hash = sha256Hex(jpeg);
    const file = paintsFile();
    file.nodes.find((n) => n.id === "rect1")!.fills = [{ type: "IMAGE", visible: true, imageHash: hash, scaleMode: "FILL" }];
    file.nodes.find((n) => n.id === "rect1")!.strokes = [];
    file.images = new Map([[hash, jpeg]]);
    const t2 = writePackage(file);
    expect(t2.has(`images/${hash}.jpg`)).toBe(true);
    t2.set(`images/${hash}.jpeg`, t2.get(`images/${hash}.jpg`) as Uint8Array);
    t2.delete(`images/${hash}.jpg`);
    expect(readPackage(t2).images?.get(hash)).toEqual(jpeg);
  });

  it("caps image warnings", () => {
    const tree = writePackage(paintsFile());
    for (let i = 0; i < 30; i++) tree.set(`images/${String(i).padStart(64, "0")}.png`, PNG_1PX);
    const { warnings } = readPackageWithReport(tree);
    expect(warnings.length).toBe(21);
    expect(warnings.at(-1)).toBe("…and 10 more problems with images.");
  });

  it("travel in the zip as stored bytes, also inside a wrapping folder", () => {
    const tree = writePackage(paintsFile());
    const zip = writeZip(tree);
    const entries = unzipSync(zip);
    expect(entries[`images/${PNG_HASH}.png`]).toEqual(PNG_1PX);
    // Images are stored, not deflated: their bytes appear as they are.
    const at = Buffer.from(zip).indexOf(Buffer.from(GIF_1PX));
    expect(at).toBeGreaterThan(0);
    const back = readZip(zip);
    expect(back.get(`images/${GIF_HASH}.gif`)).toEqual(GIF_1PX);
    expect(typeof back.get("manifest.json")).toBe("string");
    // Zipped as "My file/…" by an OS "Compress" command: images are still bytes once the folder is stripped.
    const wrapped: FileTree = new Map([...tree].map(([k, v]) => [`My file/${k}`, v]));
    const folderOnly = writeZipWithoutRootManifest(wrapped);
    expect(byId(readPackage(readZip(folderOnly)))).toEqual(byId(paintsFile()));
  });

  it("are binary by path, and named by hash and format", () => {
    expect(isBinaryPackagePath("images/x.png")).toBe(true);
    expect(isBinaryPackagePath("pages/x.json")).toBe(false);
    expect(parseImagePath(`images/${PNG_HASH}.png`)).toEqual({ hash: PNG_HASH, ext: "png" });
    expect(parseImagePath(`images/${PNG_HASH}.bmp`)).toBeNull();
    expect(parseImagePath(`images/sub/${PNG_HASH}.png`)).toBeNull();
    expect(sniffImageFormat(PNG_1PX)).toBe("png");
    expect(sniffImageFormat(GIF_1PX)).toBe("gif");
    expect(sniffImageFormat(Uint8Array.from([0xff, 0xd8, 0xff, 0xdb]))).toBe("jpg");
    expect(sniffImageFormat(enc.encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "))).toBe("webp");
    expect(sniffImageFormat(enc.encode("RIFF\u0000\u0000\u0000\u0000WAVE"))).toBeNull();
    expect(sniffImageFormat(enc.encode("<svg"))).toBeNull();
    expect(referencedImageHashes(paintsFile().nodes)).toEqual([PNG_HASH, GIF_HASH]);
    expect(() => checkImage(PNG_HASH, GIF_1PX)).toThrow(/doesn't match/);
    expect(hashImage(PNG_1PX)).toBe(PNG_HASH);
  });
});

/** A zip whose entries are all under one folder (no top-level manifest), as Finder makes them. writeZip insists on a top-level manifest. */
function writeZipWithoutRootManifest(tree: FileTree): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  for (const [k, v] of tree) files[k] = typeof v === "string" ? enc.encode(v) : v;
  return zipSync(files, { level: 6 });
}

describe("sha256Hex", () => {
  it("matches the standard test vectors", () => {
    expect(sha256Hex(new Uint8Array())).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex(enc.encode("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex(enc.encode("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"))).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
  });

  it("matches node:crypto at every length around the block boundaries, and on views into larger buffers", () => {
    const big = Uint8Array.from({ length: 1200 }, (_, i) => (i * 31 + 7) & 0xff);
    for (let len = 0; len <= 300; len++) {
      const view = big.subarray(13, 13 + len);
      expect(sha256Hex(view), `length ${len}`).toBe(createHash("sha256").update(view).digest("hex"));
    }
    const mb = Uint8Array.from({ length: 1 << 20 }, (_, i) => (i * 7) & 0xff);
    expect(sha256Hex(mb)).toBe(createHash("sha256").update(mb).digest("hex"));
  });
});
