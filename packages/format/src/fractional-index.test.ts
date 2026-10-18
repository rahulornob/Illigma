import { describe, expect, it } from "vitest";
import { isValidKey, keyBetween, keysBetween } from "./fractional-index.js";

describe("fractional index", () => {
  it("makes a first key and keys at both ends", () => {
    const k = keyBetween(null, null);
    expect(isValidKey(k)).toBe(true);
    expect(keyBetween(null, k) < k).toBe(true);
    expect(keyBetween(k, null) > k).toBe(true);
  });

  it("always sorts strictly between its neighbours", () => {
    let lo = keyBetween(null, null);
    let hi = keyBetween(lo, null);
    for (let i = 0; i < 500; i++) {
      const mid = keyBetween(lo, hi);
      expect(lo < mid && mid < hi).toBe(true);
      expect(isValidKey(mid)).toBe(true);
      if (i % 2) lo = mid;
      else hi = mid;
    }
  });

  it("survives many inserts at the start and the end", () => {
    let first = keyBetween(null, null);
    let last = first;
    for (let i = 0; i < 1000; i++) {
      const f = keyBetween(null, first);
      const l = keyBetween(last, null);
      expect(f < first && l > last).toBe(true);
      first = f;
      last = l;
    }
  });

  it("spreads n keys in order", () => {
    const keys = keysBetween(null, null, 100);
    expect(keys).toHaveLength(100);
    expect([...keys].sort()).toEqual(keys);
    expect(new Set(keys).size).toBe(100);
  });

  it("rejects keys out of order or malformed", () => {
    expect(() => keyBetween("b", "a")).toThrow();
    expect(() => keyBetween("a", "a")).toThrow();
    expect(() => keyBetween("V0", null)).toThrow();
    expect(() => keyBetween("V!", null)).toThrow();
  });
});
