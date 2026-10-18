/**
 * Property tests for fractional index keys, driven by a seeded PRNG.
 *
 * Tests marked `it.fails` expose known bugs: they assert the correct
 * behaviour and currently fail.
 */

import { describe, expect, it } from "vitest";
import { isValidKey, keyBetween, keysBetween } from "./fractional-index.js";

const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A random valid key: an integer part (its head letter sets its length:
 * "a"–"z" = 1–26 more digits, "Z"–"A" = 1–26) and an optional fraction that
 * doesn't end in "0". Biased towards short integers and edge digits.
 */
function randomKey(rand: () => number): string {
  const digit = () => (rand() < 0.4 ? "01yz"[Math.floor(rand() * 4)] : DIGITS[Math.floor(rand() * DIGITS.length)]) as string;
  const heads = rand() < 0.9 ? "abcZYX" : "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const head = heads[Math.floor(rand() * heads.length)] as string;
  const intLen = head >= "a" ? head.charCodeAt(0) - 96 : 91 - head.charCodeAt(0);
  let k = head;
  for (let i = 0; i < intLen; i++) k += digit();
  if (k === "A" + "0".repeat(26)) k = "A" + "0".repeat(25) + "1"; // the one integer that isn't a key on its own
  const fracLen = rand() < 0.5 ? 0 : Math.floor(rand() * 5);
  let frac = "";
  for (let i = 0; i < fracLen; i++) frac += digit();
  return k + frac.replace(/0+$/, "");
}

describe("keyBetween properties", () => {
  it("returns a valid key strictly between any two valid keys (20,000 random pairs)", () => {
    const rand = prng(7);
    for (let i = 0; i < 20_000; i++) {
      let a = randomKey(rand);
      let b = randomKey(rand);
      if (a === b) continue;
      if (a > b) [a, b] = [b, a];
      const k = keyBetween(a, b);
      expect(isValidKey(k), `between ${a} and ${b}: ${k}`).toBe(true);
      expect(a < k && k < b, `between ${a} and ${b}: ${k}`).toBe(true);
    }
  });

  it("handles open ends: null/b and a/null", () => {
    const rand = prng(11);
    for (let i = 0; i < 5_000; i++) {
      const a = randomKey(rand);
      const lo = keyBetween(null, a);
      const hi = keyBetween(a, null);
      expect(isValidKey(lo) && isValidKey(hi)).toBe(true);
      expect(lo < a && a < hi, `${lo} < ${a} < ${hi}`).toBe(true);
    }
  });

  it("survives 2,000 random inserts into one list and keeps every key unique and ordered", () => {
    const rand = prng(3);
    const keys: string[] = [];
    for (let i = 0; i < 2_000; i++) {
      const at = Math.floor(rand() * (keys.length + 1));
      const k = keyBetween(keys[at - 1] ?? null, keys[at] ?? null);
      keys.splice(at, 0, k);
    }
    for (let i = 1; i < keys.length; i++) expect((keys[i - 1] as string) < (keys[i] as string)).toBe(true);
    expect(keys.every(isValidKey)).toBe(true);
  });

  it("repeatedly inserting between the same two neighbours stays valid", () => {
    let a = "a0";
    const b = "a1";
    for (let i = 0; i < 500; i++) {
      const k = keyBetween(a, b);
      expect(a < k && k < b && isValidKey(k)).toBe(true);
      a = k;
    }
  });

  it("keysBetween fills any gap with n ordered keys", () => {
    const rand = prng(5);
    for (let i = 0; i < 300; i++) {
      let a: string | null = randomKey(rand);
      let b: string | null = randomKey(rand);
      if (a === b) continue;
      if (a > b) [a, b] = [b, a];
      if (rand() < 0.2) a = null;
      if (rand() < 0.2) b = null;
      const n = Math.floor(rand() * 50);
      const ks = keysBetween(a, b, n);
      expect(ks).toHaveLength(n);
      const all = [a, ...ks, b];
      for (let j = 1; j < all.length; j++) {
        const lo = all[j - 1];
        const hi = all[j];
        if (lo != null && hi != null) expect(lo < hi).toBe(true);
      }
      expect(ks.every(isValidKey)).toBe(true);
    }
  });

  it("rejects invalid and out-of-order input", () => {
    for (const bad of ["", "V0", "a-b", "é", " "]) expect(() => keyBetween(bad, null)).toThrow();
    expect(() => keyBetween("a1", "a0")).toThrow(/sort before/);
    expect(() => keyBetween("a0", "a0")).toThrow(/sort before/);
  });

  // Fixed (was: keys grew by about one character every 5 appends or prepends):
  // appending 10,000 siblings one at a time ends with a 2,000-character key.
  // Files bloat (sum of key lengths is quadratic) and every sibling sort
  // compares long shared prefixes. Typical fractional indexing grows keys
  // logarithmically (variable-length integer part, as in rocicorp's
  // fractional-indexing).
  it("appending or prepending 10,000 keys one at a time keeps keys short", () => {
    let last: string | null = null;
    let first: string | null = null;
    for (let i = 0; i < 10_000; i++) {
      last = keyBetween(last, null);
      first = keyBetween(null, first);
    }
    expect((last as string).length).toBeLessThanOrEqual(16);
    expect((first as string).length).toBeLessThanOrEqual(16);
  });
});
