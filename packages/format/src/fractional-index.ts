/**
 * Fractional indexing: string keys that sort between any two others.
 *
 * Keys are base-62 fractions after an implied "0.", so "V" ≈ 0.5 and
 * "V8" sits between "V" and "W". A key never ends in "0", which keeps
 * every key unique for the value it represents. Keys compare with plain
 * string comparison (`<`), the same in every language.
 */

const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = DIGITS.length;

function digitAt(key: string, i: number): number {
  const ch = key[i];
  if (ch === undefined) return 0;
  const d = DIGITS.indexOf(ch);
  if (d < 0) throw new Error(`Invalid index key character "${ch}" in "${key}"`);
  return d;
}

/** True when `key` is a well-formed index key. */
export function isValidKey(key: string): boolean {
  if (key.length === 0 || key.endsWith("0")) return false;
  for (const ch of key) if (!DIGITS.includes(ch)) return false;
  return true;
}

/** A key strictly between `a` and `b`. `null` means the start or the end. */
export function keyBetween(a: string | null, b: string | null): string {
  if (a !== null && !isValidKey(a)) throw new Error(`Invalid index key "${a}"`);
  if (b !== null && !isValidKey(b)) throw new Error(`Invalid index key "${b}"`);
  if (a !== null && b !== null && a >= b) throw new Error(`Index key "${a}" must sort before "${b}"`);
  return midpoint(a ?? "", b);
}

function midpoint(a: string, b: string | null): string {
  if (b !== null) {
    // Copy the shared prefix, then find a midpoint in what follows.
    let n = 0;
    while (n < b.length && digitAt(a, n) === digitAt(b, n)) n++;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }
  const da = a.length ? digitAt(a, 0) : 0;
  const db = b !== null ? digitAt(b, 0) : BASE;
  if (db - da > 1) {
    return DIGITS[Math.round((da + db) / 2)] as string;
  }
  // Adjacent digits: keep a's first digit and go one level deeper.
  if (b !== null && b.length > 1) return b.slice(0, 1);
  return (DIGITS[da] as string) + midpoint(a.slice(1), null);
}

/** `n` keys in order, evenly spread between `a` and `b`. */
export function keysBetween(a: string | null, b: string | null, n: number): string[] {
  if (n <= 0) return [];
  if (n === 1) return [keyBetween(a, b)];
  const mid = keyBetween(a, b);
  const left = Math.floor((n - 1) / 2);
  return [...keysBetween(a, mid, left), mid, ...keysBetween(mid, b, n - 1 - left)];
}
