/**
 * Edge cases for the `.illigma` package: text, numbers, ordering, page
 * layout, ids and damaged input.
 *
 * Tests marked `it.fails` expose known bugs: they assert the correct
 * behaviour and currently fail. When a bug is fixed, Vitest reports the
 * `it.fails` test as unexpectedly passing; turn it back into `it` then.
 */

import { describe, expect, it } from "vitest";
import { keyBetween, keysBetween } from "./fractional-index.js";
import { FormatError, readPackage, writePackage, type FileTree } from "./package.js";
import { defaultNode, FORMAT_VERSION, type IlligmaFile, type Node, type NodeType } from "./schema.js";
import { validateFile } from "./validate.js";

const NUMBER_FIELDS = ["x", "y", "width", "height", "rotation", "opacity", "strokeWeight", "cornerRadius"] as const;

function file(pages: { id: string; name?: string }[], nodes: Node[] = []): IlligmaFile {
  const keys = keysBetween(null, null, pages.length);
  const pageNodes = pages.map((p, i) => ({ ...defaultNode("PAGE", p.id, null, keys[i] as string), name: p.name ?? "Page" }));
  return {
    manifest: {
      format: "illigma",
      version: FORMAT_VERSION,
      fileId: "file1",
      name: "Edge cases",
      pages: pageNodes.map((p) => ({ id: p.id, name: p.name })),
      created: "2026-10-18T00:00:00.000Z",
      app: "Illigma test",
    },
    nodes: [...pageNodes, ...nodes],
  };
}

function node(type: NodeType, id: string, parentId: string, index = "V", extra: Partial<Node> = {}): Node {
  return { ...defaultNode(type, id, parentId, index), ...extra };
}

const byId = (f: IlligmaFile) => [...f.nodes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
const roundTrip = (f: IlligmaFile) => readPackage(writePackage(f));

describe("text", () => {
  const STRINGS = [
    "Components 🧩",
    "👩🏽‍💻👨‍👩‍👧‍👦🏳️‍🌈", // ZWJ sequences and skin tones
    "مرحبا بالعالم", // Arabic (RTL)
    "שלום עולם", // Hebrew (RTL)
    "abc‮evil‬", // RTL override
    "é vs é", // combining vs precomposed: must not be normalised
    "日本語 ১২৩ 한국어",
    "line\nbreak\r\nand\ttab",
    "  ", // JSON-safe line separators
    "﻿bom",
    "nul\u0000char",
    "lone \uD800 surrogate", // not valid UTF-16, still must survive JSON
    '"quotes" \\ backslash / slash',
    "",
  ];

  it("keeps unicode, RTL, emoji, control characters and lone surrogates exactly", () => {
    const nodes = STRINGS.map((s, i) => node("TEXT", `t${i}`, "p1", keysBetween(null, null, STRINGS.length)[i], { name: s, characters: s, fontFamily: s }));
    const f = file([{ id: "p1", name: STRINGS[1] as string }], nodes);
    f.manifest.name = STRINGS.join(" | ");
    const back = roundTrip(f);
    expect(back.manifest).toEqual(f.manifest);
    expect(byId(back)).toEqual(byId(f));
    for (const [i, s] of STRINGS.entries()) expect(back.nodes.find((n) => n.id === `t${i}`)?.characters).toBe(s);
  });

  it("keeps one node per line even when text contains line breaks", () => {
    const f = file([{ id: "p1" }], [node("TEXT", "t", "p1", "V", { characters: "a\nb\r\nc d" })]);
    const lines = (writePackage(f).get("pages/p1.json") as string).trimEnd().split("\n");
    expect(lines).toHaveLength(4); // "[", two nodes, "]"
  });

  it("keeps 1 MB of text (and 1M UTF-16 units of emoji) exactly", () => {
    const big = "Lorem ipsum dolor sit amet. ".repeat(40_000).slice(0, 1_000_000);
    const emoji = "🧩".repeat(500_000);
    const f = file([{ id: "p1" }], [node("TEXT", "t1", "p1", "V", { characters: big }), node("TEXT", "t2", "p1", "k", { characters: emoji, name: emoji })]);
    const back = roundTrip(f);
    expect(back.nodes.find((n) => n.id === "t1")?.characters).toBe(big);
    expect(back.nodes.find((n) => n.id === "t2")?.characters).toBe(emoji);
    expect(big.length).toBe(1_000_000);
  });
});

describe("numbers", () => {
  it("keeps tiny, huge and awkward finite numbers exactly", () => {
    const values = [1e-12, 1e15, 5e-324, Number.MAX_VALUE, -Number.MAX_VALUE, Number.MAX_SAFE_INTEGER, 0.1 + 0.2, -123.456, 1 / 3];
    const nodes = values.map((v, i) =>
      node("RECTANGLE", `r${i}`, "p1", keysBetween(null, null, values.length)[i], { x: v, y: -v, width: v, rotation: v, opacity: v, cornerRadius: v }),
    );
    const back = roundTrip(file([{ id: "p1" }], nodes));
    values.forEach((v, i) => {
      const n = back.nodes.find((m) => m.id === `r${i}`) as Node;
      expect([n.x, n.y, n.width, n.rotation, n.opacity, n.cornerRadius]).toEqual([v, -v, v, v, v, v]);
    });
  });

  it("turns -0 into 0 (JSON has no -0), which is accepted", () => {
    const back = roundTrip(file([{ id: "p1" }], [node("RECTANGLE", "r", "p1", "V", { x: -0, rotation: -0 })]));
    const n = back.nodes.find((m) => m.id === "r") as Node;
    expect(Object.is(n.x, 0) && Object.is(n.rotation, 0)).toBe(true);
  });

  it("rejects NaN, Infinity and -Infinity in every number field", () => {
    for (const field of NUMBER_FIELDS) {
      for (const bad of [NaN, Infinity, -Infinity]) {
        const f = file([{ id: "p1" }], [node("RECTANGLE", "r", "p1", "V", { [field]: bad })]);
        expect(validateFile(f).join("\n"), `${field}=${bad}`).toMatch(new RegExp(`"${field}" must be a number`));
        expect(() => writePackage(f)).toThrow(FormatError);
      }
    }
  });

  it("rejects numbers given as strings, null or missing", () => {
    for (const bad of ["12", null, undefined]) {
      const f = file([{ id: "p1" }], [node("RECTANGLE", "r", "p1", "V", { width: bad as unknown as number })]);
      expect(validateFile(f).join("\n")).toMatch(/"width" must be a number/);
    }
  });

  it("rejects colour channels that are non-finite or outside 0–1", () => {
    for (const bad of [NaN, Infinity, -Infinity, -0.0001, 1.0001]) {
      const f = file([{ id: "p1" }], [node("RECTANGLE", "r", "p1", "V", { strokes: [{ type: "SOLID", visible: true, color: { r: 0, g: bad, b: 0, a: 1 } }] })]);
      expect(validateFile(f).join("\n"), `g=${bad}`).toMatch(/"strokes"/);
    }
  });

  it("refuses to open a page file whose number overflows to Infinity", () => {
    const tree = writePackage(file([{ id: "p1" }], [node("RECTANGLE", "r", "p1", "V", { x: 5 })]));
    tree.set("pages/p1.json", (tree.get("pages/p1.json") as string).replace('"x":5', '"x":1e400'));
    expect(() => readPackage(tree)).toThrow(/damaged/);
  });

  // BUG: validateFile checks "characters" but not fontSize, lineHeight,
  // fontFamily or fontStyle. NaN fontSize is saved as null, a string
  // fontSize passes, and the bad value reaches the renderer.
  it.fails("validates the optional text fields fontSize, lineHeight, fontFamily and fontStyle", () => {
    const bads: Partial<Node>[] = [
      { fontSize: NaN },
      { fontSize: Infinity },
      { fontSize: "12" as unknown as number },
      { lineHeight: null as unknown as number },
      { fontFamily: 12 as unknown as string },
      { fontStyle: {} as unknown as string },
    ];
    for (const extra of bads) {
      const f = file([{ id: "p1" }], [node("TEXT", "t", "p1", "V", { characters: "Hi", ...extra })]);
      expect(validateFile(f), JSON.stringify(extra)).not.toEqual([]);
    }
  });
});

describe("ordering", () => {
  it("keysBetween gives 10,000 short, valid, strictly increasing keys", () => {
    const keys = keysBetween(null, null, 10_000);
    expect(new Set(keys).size).toBe(10_000);
    for (let i = 1; i < keys.length; i++) expect((keys[i - 1] as string) < (keys[i] as string)).toBe(true);
    expect(Math.max(...keys.map((k) => k.length))).toBeLessThanOrEqual(4);
    // Every gap can still take a new key.
    for (let i = 1; i < keys.length; i += 97) {
      const k = keyBetween(keys[i - 1] as string, keys[i] as string);
      expect(keys[i - 1] as string < k && k < (keys[i] as string)).toBe(true);
    }
  });

  it("keeps the order of 10,000 siblings through save and open, whatever the node order", () => {
    const keys = keysBetween(null, null, 10_000);
    // Ids sort in the opposite order from the keys, and nodes are shuffled.
    const nodes = keys.map((k, i) => node("RECTANGLE", `n${String(99_999 - i).padStart(5, "0")}`, "p1", k));
    const shuffled = [...nodes];
    let s = 42;
    for (let i = shuffled.length - 1; i > 0; i--) {
      s = (s * 1103515245 + 12345) % 2 ** 31;
      const j = s % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j] as Node, shuffled[i] as Node];
    }
    const back = roundTrip(file([{ id: "p1" }], shuffled));
    const order = back.nodes.filter((n) => n.parentId === "p1").sort((a, b) => (a.index < b.index ? -1 : 1));
    expect(order.map((n) => n.id)).toEqual(nodes.map((n) => n.id));
  });

  it("keeps the manifest page order even when it disagrees with page index keys", () => {
    const f = file([{ id: "a" }, { id: "b" }, { id: "c" }]);
    f.manifest.pages.reverse(); // c, b, a — the keys say a, b, c
    expect(validateFile(f)).toEqual([]); // accepted today; see core's document.edge.test.ts for the fallout
    expect(roundTrip(f).manifest.pages.map((p) => p.id)).toEqual(["c", "b", "a"]);
  });

  it("rejects two siblings with the same key, and two pages with the same key", () => {
    const f = file([{ id: "p1" }], [node("RECTANGLE", "a", "p1", "V"), node("RECTANGLE", "b", "p1", "V")]);
    expect(validateFile(f).join("\n")).toMatch(/same position/);
    const g = file([{ id: "p1" }, { id: "p2" }]);
    (g.nodes[1] as Node).index = (g.nodes[0] as Node).index;
    expect(validateFile(g).join("\n")).toMatch(/same position/);
  });
});

describe("pages", () => {
  it("round-trips empty pages, each as its own file holding only the page node", () => {
    const f = file([{ id: "p1" }, { id: "p2" }, { id: "p3" }], [node("FRAME", "f", "p2")]);
    const tree = writePackage(f);
    expect([...tree.keys()].sort()).toEqual(["manifest.json", "pages/p1.json", "pages/p2.json", "pages/p3.json"]);
    expect(JSON.parse(tree.get("pages/p1.json") as string).map((n: Node) => n.id)).toEqual(["p1"]);
    const back = readPackage(tree);
    expect(byId(back)).toEqual(byId(f));
    expect(back.manifest).toEqual(f.manifest);
  });

  it("refuses a page file that lost its page node", () => {
    const tree = writePackage(file([{ id: "p1" }, { id: "p2" }]));
    tree.set("pages/p2.json", "[]\n");
    expect(() => readPackage(tree)).toThrow(/no PAGE node/);
  });

  it("refuses a page listed twice in the manifest", () => {
    const tree = writePackage(file([{ id: "p1" }]));
    const m = JSON.parse(tree.get("manifest.json") as string);
    m.pages.push(m.pages[0]);
    tree.set("manifest.json", JSON.stringify(m));
    expect(() => readPackage(tree)).toThrow(FormatError);
  });

  it("reads files whose line endings were changed to CRLF (e.g. by git on Windows)", () => {
    const f = file([{ id: "p1" }], [node("TEXT", "t", "p1", "V", { characters: "a\nb" })]);
    const tree: FileTree = new Map([...writePackage(f)].map(([k, v]) => [k, v.replace(/\n/g, "\r\n")]));
    expect(byId(readPackage(tree))).toEqual(byId(f));
  });

  it("writes byte-identical output after a save → open → save cycle", () => {
    const f = file([{ id: "p1" }, { id: "p2" }], [node("FRAME", "f", "p1"), node("TEXT", "t", "f", "V", { characters: "日本語" })]);
    const once = writePackage(f);
    const twice = writePackage(readPackage(once));
    expect([...twice.entries()]).toEqual([...once.entries()]);
  });

  it("keeps fields it does not know (forward compatibility within a version)", () => {
    const n = { ...node("FRAME", "f", "p1"), future: { nested: [1, "two", null] } } as Node;
    const back = roundTrip(file([{ id: "p1" }], [n]));
    expect(back.nodes.find((m) => m.id === "f")).toEqual(n);
  });
});

describe("ids and names", () => {
  it("allows any characters in file, page and layer names (names are not paths)", () => {
    const names = ["../../etc/passwd", "a/b\\c:d*e?f", "CON", "nul\u0000", "🧩", " ", ""];
    const f = file(names.map((name, i) => ({ id: `p${i}`, name })));
    f.manifest.name = names.join("");
    const back = roundTrip(f);
    expect(back.manifest).toEqual(f.manifest);
    expect(back.manifest.pages.map((p) => p.name)).toEqual(names);
  });

  it("keeps unusual non-page node ids (they never become file names)", () => {
    const ids = ["🧩", "a b", 'q"uote', "new\nline", "__proto__", "constructor", "../x"];
    const nodes = ids.map((id, i) => node("RECTANGLE", id, "p1", keysBetween(null, null, ids.length)[i]));
    const back = roundTrip(file([{ id: "p1" }], nodes));
    expect(byId(back)).toEqual(byId(file([{ id: "p1" }], nodes)));
  });

  it("rejects an empty node id", () => {
    expect(validateFile(file([{ id: "p1" }], [node("RECTANGLE", "", "p1")])).join("\n")).toMatch(/has no id/);
  });

  // BUG: a page id becomes a file name (`pages/<id>.json`) but validateFile
  // accepts any non-empty string. "../x" writes outside pages/, "a/b" makes a
  // sub-folder, and NUL or backslash break on real file systems. An opened
  // package could make the app read or write files outside the package.
  it.fails("page ids that are unsafe as file names are rejected", () => {
    const SAFE = /^pages\/[0-9A-Za-z_-]+\.json$/;
    for (const id of ["../escape", "../../../tmp/x", "a/b", "a\\b", "..", "x\u0000y", "x.json"]) {
      const f = file([{ id }]);
      let tree: FileTree | null = null;
      try {
        tree = writePackage(f);
      } catch {
        /* refusing is the fix */
      }
      const pageKeys = tree ? [...tree.keys()].filter((k) => k !== "manifest.json") : [];
      expect(pageKeys.every((k) => SAFE.test(k)), `page id ${JSON.stringify(id)} → ${pageKeys}`).toBe(true);
    }
  });

  // BUG (low): ids mix upper and lower case (core's newId alphabet), so two
  // pages can map to page files that collide on case-insensitive file systems
  // (macOS and Windows defaults): one page would overwrite the other on disk.
  it.fails("page file names never collide on case-insensitive file systems", () => {
    const f = file([{ id: "PageA" }, { id: "pagea" }]);
    let tree: FileTree | null = null;
    try {
      tree = writePackage(f);
    } catch {
      /* refusing is a fix too */
    }
    if (!tree) return;
    const lower = [...tree.keys()].map((k) => k.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
  });
});

describe("damaged input never crashes with a TypeError", () => {
  const good = () => writePackage(file([{ id: "p1" }], [node("FRAME", "f", "p1")]));
  const cases: [string, (t: FileTree) => void][] = [
    ["manifest is null", (t) => t.set("manifest.json", "null")],
    ["manifest is an array", (t) => t.set("manifest.json", "[]")],
    ["manifest is truncated", (t) => t.set("manifest.json", (t.get("manifest.json") as string).slice(0, 20))],
    ["pages is not a list", (t) => t.set("manifest.json", JSON.stringify({ ...JSON.parse(t.get("manifest.json") as string), pages: {} }))],
    ["page entry is null", (t) => t.set("manifest.json", JSON.stringify({ ...JSON.parse(t.get("manifest.json") as string), pages: [null] }))],
    ["page entry id is a number", (t) => t.set("manifest.json", JSON.stringify({ ...JSON.parse(t.get("manifest.json") as string), pages: [{ id: 1 }] }))],
    ["version is a string", (t) => t.set("manifest.json", JSON.stringify({ ...JSON.parse(t.get("manifest.json") as string), version: "0" }))],
    ["version is negative", (t) => t.set("manifest.json", JSON.stringify({ ...JSON.parse(t.get("manifest.json") as string), version: -1 }))],
    ["page file is an object", (t) => t.set("pages/p1.json", "{}")],
    ["page file holds null", (t) => t.set("pages/p1.json", "[null]")],
    ["page file holds numbers", (t) => t.set("pages/p1.json", "[1, 2]")],
    ["node fills are null", (t) => t.set("pages/p1.json", (t.get("pages/p1.json") as string).replace('"fills":[]', '"fills":null'))],
    ["node fills hold null", (t) => t.set("pages/p1.json", (t.get("pages/p1.json") as string).replace('"fills":[]', '"fills":[null]'))],
    ["paint colour is null", (t) => t.set("pages/p1.json", (t.get("pages/p1.json") as string).replace('"fills":[]', '"fills":[{"type":"SOLID","visible":true,"color":null}]'))],
    ["index key ends in 0", (t) => t.set("pages/p1.json", (t.get("pages/p1.json") as string).replace('"index":"V"', '"index":"V0"'))],
    ["page has a parent", (t) => t.set("pages/p1.json", (t.get("pages/p1.json") as string).replace('"parentId":null', '"parentId":"f"'))],
  ];
  for (const [label, damage] of cases) {
    it(label, () => {
      const t = good();
      damage(t);
      let err: unknown = null;
      try {
        readPackage(t);
      } catch (e) {
        err = e;
      }
      expect(err, label).toBeInstanceOf(FormatError);
    });
  }

  it("validateFile reports instead of throwing on a null manifest or node list", () => {
    expect(() => validateFile({ manifest: null, nodes: null } as unknown as IlligmaFile)).not.toThrow();
    expect(validateFile({ manifest: null, nodes: null } as unknown as IlligmaFile).length).toBeGreaterThan(0);
  });
});
