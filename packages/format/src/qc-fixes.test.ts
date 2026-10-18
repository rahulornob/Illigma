/** Regression tests for the QC review fixes in @illigma/format. */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { indexKeyPattern, isValidKey, keyBetween, keysBetween } from "./fractional-index.js";
import { readPackage, readPackageWithReport, writePackage } from "./package.js";
import { sampleFile } from "./sample.fixture.js";
import type { Manifest, Node } from "./schema.js";
import { validateFile, validateNode, validateNodeField } from "./validate.js";

function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0;
    return s / 4294967296;
  };
}

describe("fractional index keys (rocicorp algorithm)", () => {
  it("starts at a0 and appends a0, a1 … az, b00", () => {
    expect(keyBetween(null, null)).toBe("a0");
    expect(keysBetween(null, null, 3)).toEqual(["a0", "a1", "a2"]);
    expect(keyBetween("az", null)).toBe("b00");
    expect(keyBetween(null, "a0")).toBe("Zz");
    expect(keyBetween("Zz", "a0")).toBe("ZzV");
  });

  it("keeps keys at most 8 characters after 10,000 appends and 10,000 prepends", () => {
    let last: string | null = null;
    let first: string | null = null;
    for (let i = 0; i < 10_000; i++) {
      const l = keyBetween(last, null);
      const f = keyBetween(null, first);
      if (last !== null) expect(l > last).toBe(true);
      if (first !== null) expect(f < first).toBe(true);
      last = l;
      first = f;
    }
    expect((last as string).length).toBeLessThanOrEqual(8);
    expect((first as string).length).toBeLessThanOrEqual(8);
  });

  it("keeps a random list ordered under 5,000 random inserts (ordering fuzz)", () => {
    const rand = prng(42);
    const keys: string[] = [];
    for (let i = 0; i < 5_000; i++) {
      const at = Math.floor(rand() * (keys.length + 1));
      const k = keyBetween(keys[at - 1] ?? null, keys[at] ?? null);
      expect(isValidKey(k)).toBe(true);
      keys.splice(at, 0, k);
    }
    expect([...keys].sort()).toEqual(keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("the JSON Schema index pattern says exactly what isValidKey says", () => {
    const schema = JSON.parse(readFileSync(new URL("../schema/node.v0.schema.json", import.meta.url), "utf8"));
    expect(schema.properties.index.pattern).toBe(indexKeyPattern());
    const re = new RegExp(indexKeyPattern());
    const rand = prng(9);
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!-";
    const samples = ["a0", "a00", "Zz", "Z", "a", "A" + "0".repeat(26), "A" + "0".repeat(26) + "1", "z".repeat(27), "b0", "b00", ""];
    for (let i = 0; i < 20_000; i++) {
      let k = "";
      const len = Math.floor(rand() * 8);
      for (let j = 0; j < len; j++) k += chars[Math.floor(rand() * chars.length)];
      samples.push(k);
    }
    samples.push(...keysBetween(null, null, 500));
    for (const k of samples) expect(re.test(k), k).toBe(isValidKey(k));
  });
});

describe("per-field validation shared with the document model", () => {
  it("validateNodeField accepts good values and names the problem otherwise", () => {
    expect(validateNodeField("x", 3)).toBeNull();
    expect(validateNodeField("x", NaN)).toMatch(/"x"/);
    expect(validateNodeField("fontSize", undefined)).toBeNull();
    expect(validateNodeField("fontSize", Infinity)).toMatch(/"fontSize"/);
    expect(validateNodeField("fontFamily", 12)).toMatch(/"fontFamily"/);
    expect(validateNodeField("bogus", 1)).toMatch(/not a node field/);
    expect(validateNodeField("index", "V")).toMatch(/"index"/);
  });

  it("validateNode checks every field of one node", () => {
    const node = sampleFile().nodes[2] as Node;
    expect(validateNode(node)).toEqual([]);
    const problems = validateNode({ ...node, lineHeight: NaN, id: "a/b" }).join("\n");
    expect(problems).toMatch(/"lineHeight"/);
    expect(problems).toMatch(/"id"/);
    expect(validateNode(null)).not.toEqual([]);
  });
});

describe("validateFile", () => {
  it("type-checks the manifest's created, app and page names", () => {
    for (const patch of [{ created: 1 }, { app: null }, { pages: [{ id: "page1", name: 3 }, { id: "page2", name: "x" }] }]) {
      const f = sampleFile();
      f.manifest = { ...f.manifest, ...patch } as unknown as Manifest;
      expect(validateFile(f), JSON.stringify(patch)).not.toEqual([]);
    }
  });

  it("rejects a manifest page order that disagrees with page index order", () => {
    const f = sampleFile();
    f.manifest.pages.reverse();
    expect(validateFile(f).join("\n")).toMatch(/page order/);
  });

  it("restricts node ids to 1–64 of [A-Za-z0-9_-] and rejects page ids that differ only in case", () => {
    const f = sampleFile();
    (f.nodes[2] as Node).id = "frame.1";
    (f.nodes[3] as Node).parentId = "frame.1";
    expect(validateFile(f).join("\n")).toMatch(/"id"/);
    const g = sampleFile();
    (g.nodes[1] as Node).id = "PAGE1";
    (g.manifest.pages[1] as { id: string }).id = "PAGE1";
    expect(validateFile(g).join("\n")).toMatch(/differ only in case/);
  });
});

describe("readPackageWithReport", () => {
  it("warns about page files the manifest doesn't list; readPackage keeps its signature", () => {
    const tree = writePackage(sampleFile());
    expect(readPackageWithReport(tree).warnings).toEqual([]);
    tree.set("pages/orphan.json", "[]\n");
    const { file, warnings } = readPackageWithReport(tree);
    expect(warnings).toEqual(["pages/orphan.json is not listed in manifest.json, so it was not opened."]);
    expect(readPackage(tree)).toEqual(file);
  });
});
