/**
 * Performance guards with generous limits. They catch accidental quadratic
 * behaviour, not small regressions.
 *
 * Tests marked `it.fails` expose known bugs: they assert the correct
 * behaviour and currently fail.
 */

import { describe, expect, it } from "vitest";
import { readPackage, writePackage } from "@illigma/format";
import { Document } from "./index.js";

describe("performance guards", () => {
  it("50,000 nodes: create, toFile, writePackage, readPackage and fromFile in under 10 s", () => {
    const t0 = performance.now();
    const doc = new Document("Big");
    const pages = doc.transact("Pages", (tx) => [tx.addPage("One"), tx.addPage("Two")]);
    doc.transact("Bulk", (tx) => {
      // 2 pages × 50 frames × 10 groups × 49 leaves ≈ 50k nodes, in a realistic tree.
      for (const page of pages) {
        for (let f = 0; f < 50; f++) {
          const frame = tx.create("FRAME", page, { name: `Screen ${f}`, x: f * 400 });
          for (let g = 0; g < 10; g++) {
            const group = tx.create("GROUP", frame);
            for (let l = 0; l < 49; l++) {
              tx.create(l % 7 === 0 ? "TEXT" : "RECTANGLE", group, l % 7 === 0 ? { characters: `Label ${l}` } : { cornerRadius: 4 });
            }
          }
        }
      }
    });
    expect(doc.size).toBeGreaterThanOrEqual(50_000);
    const file = doc.toFile();
    const tree = writePackage(file);
    const back = Document.fromFile(readPackage(tree));
    const ms = performance.now() - t0;
    expect(back.size).toBe(doc.size);
    expect(ms, `took ${Math.round(ms)} ms`).toBeLessThan(10_000);
  }, 60_000);

  // Fixed; was: every create computes its key with indexAt(), which calls
  // children(parent) and so re-sorts the whole sibling list, and keys grow
  // about one character per 5 appends (see fractional-index.property.test.ts).
  // Appending n children to one parent is therefore O(n² log n) with long
  // string compares: 1k ≈ 0.05 s, 2k ≈ 0.2 s, 4k ≈ 1 s, 10k ≈ 6+ s.
  // Suspected fix: keep children per parent in a sorted array (or cache the
  // first/last key), and use keys that grow logarithmically.
  it("10,000 creates appended as the last child of one parent take under 3 s", () => {
    const doc = new Document("Flat");
    const page = doc.transact("Page", (tx) => tx.addPage());
    const t0 = performance.now();
    doc.transact("Bulk", (tx) => {
      for (let i = 0; i < 10_000; i++) tx.create("RECTANGLE", page, { x: i });
    });
    const ms = performance.now() - t0;
    expect(doc.children(page)).toHaveLength(10_000);
    expect(ms, `took ${Math.round(ms)} ms`).toBeLessThan(3_000);
  }, 120_000);
});
