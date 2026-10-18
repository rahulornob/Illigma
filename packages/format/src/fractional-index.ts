/**
 * Fractional indexing: string keys that sort between any two others.
 *
 * The algorithm is David Greenspan's, as implemented in rocicorp's
 * `fractional-indexing` (CC0, https://github.com/rocicorp/fractional-indexing);
 * this is our own TypeScript port of it.
 *
 * A key is a variable-length integer followed by an optional fraction, both
 * in base 62. The integer's first character says how long it is: "a"–"z"
 * mean 1–26 more digits (positive), "Z"–"A" mean 1–26 more digits (negative).
 * The first key is "a0"; appending gives "a1" … "az", "b00" …, and prepending
 * gives "Zz" … "Z0", "Yzz" …, so repeated appends and prepends grow keys
 * logarithmically. Inserting between two keys uses the fraction. A fraction
 * never ends in "0", which keeps every key unique for the position it names.
 * Keys compare with plain string comparison (`<`), the same in every language.
 */

const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const ZERO = "0";
const LAST = "z";
/** The smallest integer part. Nothing can sort before it, so it is not a valid key on its own. */
const SMALLEST_INTEGER = "A" + ZERO.repeat(26);
const KEY_CHARS = /^[0-9A-Za-z]+$/;

/** Length of the integer part that starts with `head`, or 0 if `head` can't start one. */
function integerLength(head: string): number {
  if (head >= "a" && head <= "z") return head.charCodeAt(0) - 97 + 2;
  if (head >= "A" && head <= "Z") return 90 - head.charCodeAt(0) + 2;
  return 0;
}

/** True when `key` is a well-formed index key. */
export function isValidKey(key: string): boolean {
  if (typeof key !== "string" || !KEY_CHARS.test(key)) return false;
  const len = integerLength(key[0] as string);
  if (len === 0 || key.length < len || key === SMALLEST_INTEGER) return false;
  return key.length === len || !key.endsWith(ZERO);
}

function integerPart(key: string): string {
  return key.slice(0, integerLength(key[0] as string));
}

function assertKey(key: string): void {
  if (!isValidKey(key)) throw new Error(`Invalid index key "${key}"`);
}

/** A fraction strictly between fractions `a` and `b` (`null` = 1). */
function midpoint(a: string, b: string | null): string {
  if (b !== null) {
    // Copy the shared prefix, then find a midpoint in what follows.
    let n = 0;
    while ((a[n] ?? ZERO) === b[n]) n++;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }
  const da = a ? DIGITS.indexOf(a[0] as string) : 0;
  const db = b !== null ? DIGITS.indexOf(b[0] as string) : DIGITS.length;
  if (db - da > 1) return DIGITS[Math.round((da + db) / 2)] as string;
  // Adjacent digits: keep b's first digit if b has more, else go one level deeper.
  if (b !== null && b.length > 1) return b.slice(0, 1);
  return (DIGITS[da] as string) + midpoint(a.slice(1), null);
}

/** The next integer, or `null` past the largest. */
function increment(int: string): string | null {
  const head = int[0] as string;
  const digits = int.slice(1).split("");
  for (let i = digits.length - 1; i >= 0; i--) {
    const d = DIGITS.indexOf(digits[i] as string) + 1;
    if (d < DIGITS.length) {
      digits[i] = DIGITS[d] as string;
      return head + digits.join("");
    }
    digits[i] = ZERO;
  }
  // Carried out of every digit: move to the next head, one digit longer or shorter.
  if (head === "Z") return "a" + ZERO;
  if (head === "z") return null;
  const next = String.fromCharCode(head.charCodeAt(0) + 1);
  if (next > "a") digits.push(ZERO);
  else digits.pop();
  return next + digits.join("");
}

/** The previous integer, or `null` before the smallest. */
function decrement(int: string): string | null {
  const head = int[0] as string;
  const digits = int.slice(1).split("");
  for (let i = digits.length - 1; i >= 0; i--) {
    const d = DIGITS.indexOf(digits[i] as string) - 1;
    if (d >= 0) {
      digits[i] = DIGITS[d] as string;
      return head + digits.join("");
    }
    digits[i] = LAST;
  }
  if (head === "a") return "Z" + LAST;
  if (head === "A") return null;
  const prev = String.fromCharCode(head.charCodeAt(0) - 1);
  if (prev < "Z") digits.push(LAST);
  else digits.pop();
  return prev + digits.join("");
}

/** A key strictly between `a` and `b`. `null` means the start or the end. */
export function keyBetween(a: string | null, b: string | null): string {
  if (a !== null) assertKey(a);
  if (b !== null) assertKey(b);
  if (a !== null && b !== null && a >= b) throw new Error(`Index key "${a}" must sort before "${b}"`);

  if (a === null) {
    if (b === null) return "a" + ZERO;
    const ib = integerPart(b);
    const fb = b.slice(ib.length);
    if (ib === SMALLEST_INTEGER) return ib + midpoint("", fb);
    if (ib < b) return ib; // b has a fraction: its bare integer sorts first
    const prev = decrement(ib);
    if (prev === null) throw new Error("No index key sorts before this one.");
    // The smallest integer isn't a key on its own; give it a fraction.
    return prev === SMALLEST_INTEGER ? prev + midpoint("", null) : prev;
  }

  const ia = integerPart(a);
  const fa = a.slice(ia.length);
  if (b === null) return increment(ia) ?? ia + midpoint(fa, null);

  const ib = integerPart(b);
  const fb = b.slice(ib.length);
  if (ia === ib) return ia + midpoint(fa, fb);
  const next = increment(ia);
  if (next === null) throw new Error("No index key sorts after this one.");
  return next < b ? next : ia + midpoint(fa, null);
}

/** `n` keys in order between `a` and `b`. */
export function keysBetween(a: string | null, b: string | null, n: number): string[] {
  if (n <= 0) return [];
  if (n === 1) return [keyBetween(a, b)];
  // Open-ended: step outwards so keys stay short.
  if (b === null) {
    const out = [keyBetween(a, null)];
    for (let i = 1; i < n; i++) out.push(keyBetween(out[i - 1] as string, null));
    return out;
  }
  if (a === null) {
    const out = [keyBetween(null, b)];
    for (let i = 1; i < n; i++) out.push(keyBetween(null, out[i - 1] as string));
    return out.reverse();
  }
  const half = Math.floor(n / 2);
  const mid = keyBetween(a, b);
  return [...keysBetween(a, mid, half), mid, ...keysBetween(mid, b, n - half - 1)];
}

/**
 * The same rule as `isValidKey`, as a regular expression (for JSON Schema):
 * one integer alternative per head letter, then an optional fraction.
 */
export function indexKeyPattern(): string {
  const d = "[0-9A-Za-z]";
  const heads: string[] = [];
  for (let i = 0; i < 26; i++) heads.push(`${String.fromCharCode(97 + i)}${d}{${i + 1}}`);
  for (let i = 0; i < 26; i++) heads.push(`${String.fromCharCode(90 - i)}${d}{${i + 1}}`);
  return `^(?!${SMALLEST_INTEGER}$)(?:${heads.join("|")})(?:${d}*[1-9A-Za-z])?$`;
}
