import { describe, expect, it } from "vitest";
import { FormatError, readPackage, writePackage } from "./package.js";
import { defaultNode, FORMAT_VERSION, type IlligmaFile, type Node } from "./schema.js";
import { sampleFile } from "./sample.fixture.js";
import { validateFile } from "./validate.js";

const byId = (f: IlligmaFile) => Object.fromEntries(f.nodes.map((n) => [n.id, n]));

describe(".illigma package", () => {
  it("round-trips with nothing lost", () => {
    const file = sampleFile();
    const back = readPackage(writePackage(file));
    expect(back.manifest).toEqual(file.manifest);
    expect(byId(back)).toEqual(byId(file));
  });

  it("writes the same bytes every time, regardless of node order", () => {
    const a = writePackage(sampleFile());
    const shuffled = sampleFile();
    shuffled.nodes.reverse();
    const b = writePackage(shuffled);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });

  it("puts one node per line, sorted by id, in each page file", () => {
    const tree = writePackage(sampleFile());
    expect([...tree.keys()].sort()).toEqual(["manifest.json", "pages/page1.json", "pages/page2.json"]);
    const lines = (tree.get("pages/page1.json") as string).trim().split("\n");
    expect(lines[0]).toBe("[");
    expect(lines.at(-1)).toBe("]");
    expect(lines.slice(1, -1).map((l) => JSON.parse(l.replace(/,$/, "")).id)).toEqual(["frame1", "page1", "text1"]);
  });

  it("refuses a file from a newer format version", () => {
    const tree = writePackage(sampleFile());
    const m = JSON.parse(tree.get("manifest.json") as string);
    m.version = FORMAT_VERSION + 1;
    tree.set("manifest.json", JSON.stringify(m));
    expect(() => readPackage(tree)).toThrow(/newer Illigma/);
  });

  it("refuses files that are not Illigma files or are damaged", () => {
    expect(() => readPackage(new Map())).toThrow(FormatError);
    const tree = writePackage(sampleFile());
    tree.set("pages/page1.json", "[{\"id\":\"x\"}]");
    expect(() => readPackage(tree)).toThrow(/damaged/);
    tree.delete("pages/page1.json");
    expect(() => readPackage(tree)).toThrow(/missing/);
  });

  it("refuses to save an invalid file", () => {
    const file = sampleFile();
    (file.nodes[2] as Node).parentId = "nope";
    expect(() => writePackage(file)).toThrow(/not valid/);
  });
});

describe("validateFile", () => {
  it("accepts a valid file", () => {
    expect(validateFile(sampleFile())).toEqual([]);
  });

  it("finds duplicate ids, loops, shared positions and bad colours", () => {
    const file = sampleFile();
    const nodes = file.nodes as Node[];
    nodes.push({ ...(nodes[3] as Node) }); // duplicate text1
    (nodes[2] as Node).parentId = "text1"; // frame1 ↔ text1 loop
    nodes.push({ ...defaultNode("RECTANGLE", "r1", "page1", "a0") }); // same position as frame1? frame1 now moved; r1 alone
    nodes.push({ ...defaultNode("RECTANGLE", "r2", "page1", "a0") });
    (nodes[3] as Node).fills = [{ type: "SOLID", visible: true, color: { r: 2, g: 0, b: 0, a: 1 } }];
    const problems = validateFile(file).join("\n");
    expect(problems).toMatch(/used twice/);
    expect(problems).toMatch(/loop/);
    expect(problems).toMatch(/same position/);
    expect(problems).toMatch(/fills/);
  });
});
