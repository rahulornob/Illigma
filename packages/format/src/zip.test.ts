import { strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { FormatError, readPackage, writePackage, type FileTree } from "./package.js";
import { sampleFile } from "./sample.fixture.js";
import { isZip, readZip, writeZip } from "./zip.js";

const text = new TextDecoder();
const u16 = (b: Uint8Array, at: number) => (b[at] as number) | ((b[at + 1] as number) << 8);

/** Offset of the central directory entry for `name`, found by scanning. */
function centralEntry(zip: Uint8Array, name: string): number {
  const needle = strToU8(name);
  for (let i = 0; i + 46 < zip.length; i++) {
    if (zip[i] !== 0x50 || zip[i + 1] !== 0x4b || zip[i + 2] !== 1 || zip[i + 3] !== 2) continue;
    if (u16(zip, i + 28) !== needle.length) continue;
    if (needle.every((c, k) => zip[i + 46 + k] === c)) return i;
  }
  throw new Error(`no central entry ${name}`);
}

function setU32(b: Uint8Array, at: number, value: number) {
  new DataView(b.buffer, b.byteOffset).setUint32(at, value, true);
}

describe(".illigma single-file (zip) form", () => {
  it("round-trips: the zip unpacks to exactly the package tree", () => {
    const tree = writePackage(sampleFile());
    const back = readZip(writeZip(tree));
    expect([...back.entries()].sort()).toEqual([...tree.entries()].sort());
    expect(readPackage(back)).toEqual(readPackage(tree));
  });

  it("writes identical bytes for the same tree, whatever the insertion order", () => {
    const tree = writePackage(sampleFile());
    const reversed: FileTree = new Map([...tree].reverse());
    const a = writeZip(tree);
    expect(writeZip(tree)).toEqual(a);
    expect(writeZip(reversed)).toEqual(a);
  });

  it("puts manifest.json first, stored, with a fixed timestamp", () => {
    const zip = writeZip(writePackage(sampleFile()));
    expect(isZip(zip)).toBe(true);
    expect(u16(zip, 8)).toBe(0); // stored
    expect([u16(zip, 10), u16(zip, 12)]).toEqual([0, 0x21]); // 1980-01-01 00:00
    expect(text.decode(zip.subarray(30, 43))).toBe("manifest.json");
    expect(text.decode(zip.subarray(43, 46))).toBe('{\n ');
  });

  it("is a standard zip other tools can read, and reads zips other tools made", () => {
    const tree = writePackage(sampleFile());
    const theirs = unzipSync(writeZip(tree));
    expect(Object.keys(theirs)).toEqual(["manifest.json", "pages/page1.json", "pages/page2.json"]);
    expect(text.decode(theirs["pages/page1.json"])).toBe(tree.get("pages/page1.json"));

    // A folder zipped by an OS: a wrapping folder, folder entries and Finder noise.
    const files = Object.fromEntries([...tree].map(([k, v]) => [k, strToU8(v)]));
    const zipped = zipSync({
      "Onboarding flow.illigma": files,
      __MACOSX: { "._manifest.json": new Uint8Array([0, 1, 2]) },
    });
    expect([...readZip(zipped).entries()].sort()).toEqual([...tree.entries()].sort());
  });

  it("refuses input that isn't a zip, in plain words", () => {
    expect(isZip(strToU8("{\"format\":\"illigma\"}"))).toBe(false);
    expect(isZip(new Uint8Array())).toBe(false);
    expect(() => readZip(strToU8("hello"))).toThrow(FormatError);
    expect(() => readZip(strToU8("hello"))).toThrow("This is not an Illigma file: it isn't a zip archive.");
  });

  it.each(["../evil.json", "pages/../../evil.json", "/etc/passwd", "C:/evil.json", "pages\\evil.json", "a//b.json", "./x"])(
    "refuses the unsafe entry %j",
    (name) => {
      const zip = zipSync({ "manifest.json": strToU8("{}"), [name]: strToU8("x") });
      expect(() => readZip(zip)).toThrow(/unsafe path/);
    },
  );

  it("refuses archives over the size limit before inflating them", () => {
    const zip = writeZip(writePackage(sampleFile()));
    expect(() => readZip(zip, { maxTotalBytes: 100 })).toThrow(/too large to open/);
    expect(() => readZip(zip, { maxTotalBytes: 1_000_000 })).not.toThrow();
  });

  it("refuses an entry that inflates past its declared size (zip bomb)", () => {
    const zip = zipSync({ "manifest.json": strToU8("{}"), "pages/a.json": new Uint8Array(4_000_000) });
    setU32(zip, centralEntry(zip, "pages/a.json") + 24, 10);
    expect(() => readZip(zip)).toThrow(/larger than the archive says/);

    // A tiny entry claiming 100 MB is refused before anything is allocated.
    setU32(zip, centralEntry(zip, "pages/a.json") + 24, 100_000_000);
    expect(() => readZip(zip)).toThrow(/impossible size/);
  });

  it("refuses duplicates, bad checksums, truncation, encryption and unknown methods", () => {
    const dup = zipSync({ "manifest.json": strToU8("{}"), "manifesu.json": strToU8("{}") }, { level: 0 });
    const at = centralEntry(dup, "manifesu.json");
    dup[at + 46 + 7] = "t".charCodeAt(0);
    expect(() => readZip(dup)).toThrow(/appears twice/);

    const good = writeZip(writePackage(sampleFile()));
    const flipped = good.slice();
    flipped[50] = (flipped[50] as number) ^ 0xff; // inside the stored manifest
    expect(() => readZip(flipped)).toThrow(/checksum/);

    expect(() => readZip(good.subarray(0, good.length - 5))).toThrow(/damaged/);

    const encrypted = good.slice();
    encrypted[centralEntry(encrypted, "manifest.json") + 8] = 1; // flags: encrypted
    expect(() => readZip(encrypted)).toThrow(/Encrypted/);

    const method = good.slice();
    method[centralEntry(method, "manifest.json") + 10] = 12; // bzip2
    expect(() => readZip(method)).toThrow(/compression method/);
  });

  it("refuses to write a tree with an unsafe path or no manifest", () => {
    const tree = writePackage(sampleFile());
    tree.set("pages/../../evil.json", "[]");
    expect(() => writeZip(tree)).toThrow(/unsafe path/);
    expect(() => writeZip(new Map([["pages/a.json", "[]"]]))).toThrow(/no manifest/);
  });
});

describe("page ids", () => {
  it("refuses a page id that would escape the pages folder", () => {
    const tree = writePackage(sampleFile());
    const m = JSON.parse(tree.get("manifest.json") as string);
    m.pages[0].id = "../../evil";
    tree.set("manifest.json", JSON.stringify(m));
    expect(() => readPackage(tree)).toThrow(/can't be a file name/);
  });
});
