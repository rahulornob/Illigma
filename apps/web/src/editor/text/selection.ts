/**
 * The text cursor and selection while editing a text layer, as plain
 * functions of the text and its line layout (no DOM, no CanvasKit), so they
 * are unit-tested on their own.
 *
 * Indices are UTF-16 offsets into the layer's `characters`, as in the DOM and
 * CanvasKit. A selection is `anchor` (where it started) and `focus` (where the
 * caret is): Shift+arrows move the focus, plain arrows collapse it.
 */

export interface TextSelection {
  anchor: number;
  focus: number;
}

/** What the selection model needs from a laid-out text (`TextLayout` from `@illigma/renderer` fits). */
export interface LineLayout {
  readonly text: string;
  readonly lines: readonly { start: number; end: number; endTrimmed: number; top: number; bottom: number }[];
  lineAt(index: number): number;
  caret(index: number): { x: number; y: number; height: number };
  indexAt(x: number, y: number): number;
  before(index: number): number;
  after(index: number): number;
}

export const collapsed = (s: TextSelection): boolean => s.anchor === s.focus;
export const selStart = (s: TextSelection): number => Math.min(s.anchor, s.focus);
export const selEnd = (s: TextSelection): number => Math.max(s.anchor, s.focus);
export const caretAt = (i: number): TextSelection => ({ anchor: i, focus: i });

/** The selection within `length` characters. */
export function clampSelection(s: TextSelection, length: number): TextSelection {
  const c = (v: number) => Math.max(0, Math.min(length, v));
  return { anchor: c(s.anchor), focus: c(s.focus) };
}

const LINE_BREAK = /[\n\r\u2028\u2029]/;
const SPACE = /\s/;

type Seg = { segment: string; index: number; isWordLike?: boolean };
/** Word segments (Intl.Segmenter where there is one, else runs of letters and digits). */
function words(text: string): Seg[] {
  const Segmenter = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(t: string): Iterable<Seg> } }).Segmenter;
  if (Segmenter) return [...new Segmenter(undefined, { granularity: "word" }).segment(text)];
  const out: Seg[] = [];
  const re = /[\p{L}\p{N}_']+|\s+|[^\p{L}\p{N}_'\s]/gu;
  for (let m = re.exec(text); m; m = re.exec(text)) out.push({ segment: m[0], index: m.index, isWordLike: /[\p{L}\p{N}]/u.test(m[0]) });
  return out;
}

/**
 * The word at `index` (what a double-click selects): the word the index is
 * in or just after, else the run of spaces or the punctuation mark there.
 */
export function wordRange(text: string, index: number): [number, number] {
  if (!text) return [0, 0];
  const segs = words(text);
  const at = (i: number) => segs.find((s) => i >= s.index && i < s.index + s.segment.length);
  let seg = at(Math.min(index, text.length - 1));
  // At the end of a word (or the text), the word before wins over the space after it.
  const prev = index > 0 ? at(index - 1) : undefined;
  if (prev?.isWordLike && (!seg?.isWordLike || index === text.length)) seg = prev;
  if (!seg) return [index, index];
  if (LINE_BREAK.test(seg.segment)) return [seg.index, seg.index];
  return [seg.index, seg.index + seg.segment.length];
}

/** The paragraph at `index` (what a triple-click selects): between line breaks, with the break after it. */
export function paragraphRange(text: string, index: number): [number, number] {
  let start = index;
  while (start > 0 && !LINE_BREAK.test(text.charAt(start - 1))) start--;
  let end = index;
  while (end < text.length && !LINE_BREAK.test(text.charAt(end))) end++;
  if (end < text.length) end++; // the line break goes with it, as in text editors
  return [start, end];
}

/** ⌥← (Ctrl+← elsewhere): the start of the word before `index`, skipping spaces and punctuation. */
export function wordLeft(text: string, index: number): number {
  const segs = words(text.slice(0, index));
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i] as Seg;
    if (s.isWordLike) return s.index;
    if (LINE_BREAK.test(s.segment) && i === segs.length - 1 && s.index + s.segment.length === index) return s.index;
  }
  return 0;
}

/** ⌥→ (Ctrl+→ elsewhere): the end of the word after `index`. */
export function wordRight(text: string, index: number): number {
  const segs = words(text.slice(index));
  for (const s of segs) {
    if (s.isWordLike) return index + s.index + s.segment.length;
    if (LINE_BREAK.test(s.segment) && s.index === 0) return index + s.segment.length;
  }
  return text.length;
}

/** Home or ⌘← : where the visual line at `index` starts. */
export function lineStart(layout: LineLayout, index: number): number {
  return (layout.lines[layout.lineAt(index)] ?? { start: 0 }).start;
}

/** End or ⌘→ : where the visual line at `index` ends (before its line break, or before the spaces a wrap left at its end). */
export function lineEnd(layout: LineLayout, index: number): number {
  const i = layout.lineAt(index);
  const line = layout.lines[i];
  if (!line) return layout.text.length;
  // A wrapped line's end is the next line's start: stop before the spaces it wrapped at, so the caret stays on this line.
  return i < layout.lines.length - 1 && line.end === (layout.lines[i + 1] as { start: number }).start ? line.endTrimmed : line.end;
}

/**
 * ↑ or ↓: the index on the line above or below, nearest to `goalX` (the
 * caret's x when vertical moves began, so a column is kept across short
 * lines). Past the first or last line, the start or end of the text.
 */
export function moveVertical(layout: LineLayout, index: number, dir: -1 | 1, goalX: number): number {
  const li = layout.lineAt(index) + dir;
  if (li < 0) return 0;
  if (li >= layout.lines.length) return layout.text.length;
  const line = layout.lines[li] as { top: number; bottom: number };
  return layout.indexAt(goalX, (line.top + line.bottom) / 2);
}

/** Where `next` differs from `prev`: from `start`, `prev` had up to `prevEnd`, `next` has up to `nextEnd`. */
export function diffRange(prev: string, next: string): { start: number; prevEnd: number; nextEnd: number } {
  let start = 0;
  const min = Math.min(prev.length, next.length);
  while (start < min && prev.charCodeAt(start) === next.charCodeAt(start)) start++;
  let tail = 0;
  while (tail < min - start && prev.charCodeAt(prev.length - 1 - tail) === next.charCodeAt(next.length - 1 - tail)) tail++;
  return { start, prevEnd: prev.length - tail, nextEnd: next.length - tail };
}

/** The layer name Figma gives a text layer from its text: its first line, trimmed, or "Text". Long lines are cut at 99 UTF-16 units, never inside a character. */
export function autoName(characters: string): string {
  const first = characters.split(LINE_BREAK)[0]?.trim() ?? "";
  return first ? (first.length > 100 ? `${cutGraphemes(first, 99)}…` : first) : "Text";
}

/** The longest start of `text` of at most `max` UTF-16 units that ends between graphemes (never half an emoji or surrogate pair). */
export function cutGraphemes(text: string, max: number): string {
  if (text.length <= max) return text;
  const Segmenter = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(t: string): Iterable<{ index: number; segment: string }> } }).Segmenter;
  if (Segmenter) {
    let end = 0;
    for (const g of new Segmenter(undefined, { granularity: "grapheme" }).segment(text)) {
      if (g.index + g.segment.length > max) break;
      end = g.index + g.segment.length;
    }
    return text.slice(0, end);
  }
  // No Segmenter: at least never split a surrogate pair.
  const code = text.charCodeAt(max - 1);
  return text.slice(0, code >= 0xd800 && code <= 0xdbff ? max - 1 : max);
}

/** True for whitespace (a space or a line break). */
export const isSpace = (ch: string): boolean => SPACE.test(ch);
