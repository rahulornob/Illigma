/**
 * Fuzz-style robustness tests for the readers. Every input, however broken,
 * must either open as a valid file or be refused with a FormatError: never
 * another exception, and never a hang. Inputs come from a seeded PRNG, so a
 * failure always reproduces; the failing seed and case are in the message.
 */

import { describe, expect, it } from "vitest";
import { FormatError, readPackage, writePackage, type FileTree } from "./package.js";
import { sampleFile } from "./sample.fixture.js";
import { validateFile } from "./validate.js";
import { readZip, writeZip } from "./zip.js";

// Override to fuzz longer locally: FUZZ_SEED=42 FUZZ_CASES=100000 npx vitest run fuzz
const SEED = Number(process.env.FUZZ_SEED ?? 0x1111_9a);
const CASES = Number(process.env.FUZZ_CASES ?? 1000);

/** mulberry32: small, fast, seedable. */
function prng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  const pick = <T>(xs: readonly T[]): T => xs[int(xs.length)] as T;
  return { next, int, pick };
}
type Rng = ReturnType<typeof prng>;

const NODE_FIELDS = [
  "id", "type", "parentId", "index", "name", "visible", "locked", "x", "y", "width", "height",
  "rotation", "opacity", "fills", "strokes", "strokeWeight", "cornerRadius", "characters", "fontSize",
];
const MANIFEST_FIELDS = ["format", "version", "fileId", "name", "pages", "created", "app"];

/** A random JSON value, including the nasty ones (prototype keys, objects whose toString isn't callable). */
function randomJson(r: Rng, depth = 0): unknown {
  switch (r.int(depth > 2 ? 9 : 13)) {
    case 0: return null;
    case 1: return r.next() < 0.5;
    case 2: return r.pick([0, -1, 1, 0.5, 1e308, -1e308, 2 ** 53, -0, 255, 4294967295]);
    case 3: return r.pick(["", "PAGE", "FRAME", "page1", "frame1", "V", "0", "../x", "\u0000", "🧩", "__proto__", "constructor"]);
    case 4: return "x".repeat(r.int(300));
    case 5: return r.int(1000) - 500;
    case 6: return { toString: 1, valueOf: 2 };
    case 7: return JSON.parse('{"__proto__": {"polluted": true}}'); // an own "__proto__" key
    case 8: return { type: "SOLID", visible: true, color: { r: r.next() * 2, g: 0, b: 0, a: 1 } };
    case 9: return [randomJson(r, depth + 1), randomJson(r, depth + 1)];
    case 10: return { [r.pick(NODE_FIELDS)]: randomJson(r, depth + 1) };
    case 11: return [{ type: "SOLID", visible: r.next() < 0.5, color: randomJson(r, depth + 1) }];
    default: return Array.from({ length: r.int(4) }, () => randomJson(r, depth + 1));
  }
}

function mutateText(r: Rng, s: string): string {
  switch (r.int(5)) {
    case 0: return s.slice(0, r.int(s.length + 1)); // truncate
    case 1: { // replace one character
      const i = r.int(s.length || 1);
      return s.slice(0, i) + r.pick(['"', "{", "}", "[", "]", ",", ":", "0", "a", "\\", "\u0000", "é"]) + s.slice(i + 1);
    }
    case 2: { // delete a span
      const i = r.int(s.length || 1);
      return s.slice(0, i) + s.slice(i + 1 + r.int(20));
    }
    case 3: { // duplicate a span
      const i = r.int(s.length || 1);
      return s.slice(0, i) + s.slice(i, i + r.int(40)) + s.slice(i);
    }
    default: return JSON.stringify(randomJson(r));
  }
}

/** Change a parsed manifest or page in a structured way, then serialise it again. */
function mutateJson(r: Rng, path: string, s: string): string {
  const value = JSON.parse(s) as unknown;
  if (path === "manifest.json") {
    const m = value as Record<string, unknown>;
    const k = r.pick(MANIFEST_FIELDS);
    if (r.next() < 0.2) delete m[k];
    else if (k === "pages" && r.next() < 0.5) m.pages = [randomJson(r), { id: randomJson(r), name: "p" }];
    else if (k === "version" && r.next() < 0.5) m.version = r.pick([0, 1, -1, 0.5, "0", null]);
    else m[k] = randomJson(r);
    return JSON.stringify(m);
  }
  const nodes = value as Record<string, unknown>[];
  if (!nodes.length || r.next() < 0.1) return JSON.stringify([...nodes, randomJson(r)]);
  const node = nodes[r.int(nodes.length)] as Record<string, unknown>;
  const k = r.pick(NODE_FIELDS);
  switch (r.int(4)) {
    case 0: delete node[k]; break;
    case 1: nodes.push({ ...node }); break; // duplicate id
    case 2: node[k] = nodes[r.int(nodes.length)]?.id ?? null; break; // e.g. parent loops
    default: node[k] = randomJson(r);
  }
  return JSON.stringify(nodes);
}

function mutateTree(r: Rng, base: FileTree): FileTree {
  const tree = new Map(base);
  const rounds = 1 + r.int(3);
  for (let i = 0; i < rounds; i++) {
    const paths = [...tree.keys()];
    const path = r.pick(paths);
    const before = tree.get(path) as string;
    const op = r.int(10);
    if (op === 0) tree.delete(path);
    else if (op === 1) tree.set(`pages/${String(r.int(5))}.json`, mutateText(r, before));
    else if (op < 5) tree.set(path, mutateText(r, before));
    else {
      try {
        tree.set(path, mutateJson(r, path, before));
      } catch {
        tree.set(path, mutateText(r, before)); // an earlier round already broke the JSON
      }
    }
  }
  return tree;
}

function mutateBytes(r: Rng, base: Uint8Array): Uint8Array {
  const b = base.slice();
  switch (r.int(6)) {
    case 0: return b.subarray(0, r.int(b.length + 1)); // truncate
    case 1: { // flip bits
      for (let n = 1 + r.int(8); n > 0; n--) {
        const i = r.int(b.length);
        b[i] = (b[i] ?? 0) ^ (1 << r.int(8));
      }
      return b;
    }
    case 2: { // random bytes
      for (let n = 1 + r.int(8); n > 0; n--) b[r.int(b.length)] = r.int(256);
      return b;
    }
    case 3: { // a large or edge value in a 32-bit field (sizes, offsets, counts)
      const at = r.int(Math.max(1, b.length - 4));
      new DataView(b.buffer).setUint32(at, r.pick([0, 1, 0xffff, 0xffffffff, 0x7fffffff, b.length, r.int(2 ** 32)]), true);
      return b;
    }
    case 4: { // splice: drop a span in the middle
      const i = r.int(b.length);
      const out = new Uint8Array(b.length - Math.min(b.length - i, 1 + r.int(64)));
      out.set(b.subarray(0, i));
      out.set(b.subarray(b.length - (out.length - i)), i);
      return out;
    }
    default: { // pure noise behind a zip signature, or none at all
      const out = Uint8Array.from({ length: r.int(200) }, () => r.int(256));
      if (r.next() < 0.7 && out.length >= 4) out.set([0x50, 0x4b, 3, 4]);
      return out;
    }
  }
}

/** Run `read`; it must return a valid file or throw a FormatError. */
function expectSafe(read: () => unknown, label: string) {
  let result: unknown;
  try {
    result = read();
  } catch (e) {
    if (e instanceof FormatError) return "refused";
    throw new Error(`${label}: threw ${(e as Error)?.name}: ${(e as Error)?.message}\n${(e as Error)?.stack}`);
  }
  const problems = validateFile(result as Parameters<typeof validateFile>[0]);
  if (problems.length) throw new Error(`${label}: opened an invalid file: ${problems[0]}`);
  return "opened";
}

describe("reader robustness (seeded fuzz)", () => {
  const tree = writePackage(sampleFile());
  const zip = writeZip(tree);

  it(`readPackage: ${CASES} mutated package trees`, () => {
    const r = prng(SEED);
    const outcomes = { opened: 0, refused: 0 };
    for (let i = 0; i < CASES; i++) {
      const input = mutateTree(r, tree);
      outcomes[expectSafe(() => readPackage(input), `seed ${SEED} package case ${i}`)]++;
    }
    expect(outcomes.refused).toBeGreaterThan(CASES / 2); // the mutations bite…
    expect(outcomes.opened).toBeGreaterThan(0); // …and some leave a valid file
  });

  it(`readZip + readPackage: ${CASES} mutated and random archives`, () => {
    const r = prng(SEED + 1);
    const outcomes = { opened: 0, refused: 0 };
    for (let i = 0; i < CASES; i++) {
      const mutated = i % 5 === 0 ? mutateTree(r, tree) : null;
      const input = mutated?.has("manifest.json") ? writeZip(mutated) : mutateBytes(r, zip);
      outcomes[expectSafe(() => readPackage(readZip(input, { maxTotalBytes: 1_000_000 })), `seed ${SEED + 1} zip case ${i}`)]++;
    }
    expect(outcomes.refused).toBeGreaterThan(CASES / 2);
    expect(outcomes.opened).toBeGreaterThan(0);
  });
});
