/**
 * Text layout with CanvasKit's paragraph engine (SkParagraph), shared by
 * drawing, export, layout (auto width and auto height) and the editor's
 * caret and selection. One `TextEngine` holds the fonts; every TEXT node is
 * laid out by the same code wherever it is measured or drawn, so a text box
 * the layout engine sized never wraps differently on the canvas.
 *
 * Node fields (Figma's names): `fontFamily`, `fontStyle` (e.g. "Semi Bold
 * Italic"), `fontSize`, `lineHeight`, `letterSpacing`, `textAlignHorizontal`,
 * `textAlignVertical` and `textAutoResize`. A family that isn't loaded falls
 * back to the first font given (the text keeps a layout, as Figma does with
 * a missing font).
 */

import type { DeepReadonly, ReadonlyNode } from "@illigma/core";
import { letterSpacingPx, lineHeightPx, type Color } from "@illigma/format";
import type { CanvasKit, FontWeight, Paint, Paragraph, TypefaceFontProvider } from "canvaskit-wasm";

export interface FontSource {
  /** The family name TEXT nodes ask for, e.g. "Inter". */
  family: string;
  /** A TrueType, OpenType, WOFF or WOFF2 file. */
  data: ArrayBuffer;
  /**
   * The style names this file provides, e.g. ["Bold"] or, for a variable font,
   * all its named instances. Used to list styles; drawing matches by weight and slant.
   */
  styles?: readonly string[];
}

/** fontStyle names (Figma's, e.g. "Semi Bold Italic") to CSS weights. */
const WEIGHTS: [RegExp, number][] = [
  [/thin|hairline/, 100],
  [/extra ?light|ultra ?light/, 200],
  [/light/, 300],
  [/medium/, 500],
  [/semi ?bold|demi ?bold/, 600],
  [/extra ?bold|ultra ?bold/, 800],
  [/bold/, 700],
  [/black|heavy/, 900],
];

/** The CSS weight (100–900) a style name stands for. */
export function styleWeight(style: string): number {
  const s = style.toLowerCase();
  return WEIGHTS.find(([re]) => re.test(s))?.[1] ?? 400;
}

/** True for italic and oblique style names. */
export const styleItalic = (style: string): boolean => /italic|oblique/i.test(style);

/** A wrap width no text reaches: lays a paragraph out on one line per hard break. */
const UNBOUNDED = 1e6;
/**
 * Extra width an auto-width paragraph is laid out at, so float noise never
 * wraps its last word. SkParagraph rounds line widths up to whole pixels
 * before it compares them with the wrap width ("rounding hack"), so auto
 * widths are measured as whole pixels too.
 */
const WRAP_SLACK = 0.5;

/** Where a text cursor sits, in the node's space: a vertical line from (x, y), `height` long. */
export interface TextCaret {
  x: number;
  y: number;
  height: number;
}

export interface TextRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One line of a laid-out text, in the node's space. Indices are UTF-16 offsets into `characters`. */
export interface TextLayoutLine {
  /** First index on the line. */
  start: number;
  /** Where the line's content ends: before its line break, or where the next line starts (soft wrap). */
  end: number;
  /** End before trailing spaces, where End puts the caret on a wrapped line. */
  endTrimmed: number;
  top: number;
  bottom: number;
  baseline: number;
  left: number;
  width: number;
  /** The line ends in a line break typed by the person. */
  hard: boolean;
}

/**
 * A TEXT node laid out for editing: caret positions, selection rectangles and
 * hit-testing, all in the node's own space (0, 0 is its top-left). Holds a
 * CanvasKit paragraph: call `dispose()` when done.
 */
export class TextLayout {
  readonly lines: readonly TextLayoutLine[];
  /** The paragraph's height (one empty line for empty text). */
  readonly height: number;

  constructor(
    private readonly ck: CanvasKit,
    private paragraph: Paragraph | null,
    readonly text: string,
    /** Where the paragraph's origin sits in the node (alignment in a box of another size). */
    readonly offsetX: number,
    readonly offsetY: number,
    /** x of an empty line (alignment). */
    private readonly emptyX: number,
  ) {
    const p = paragraph as Paragraph;
    this.height = p.getHeight();
    const metrics = p.getLineMetrics();
    const lines: TextLayoutLine[] = [];
    let prevEnd = 0;
    for (const m of metrics) {
      // SkParagraph starts the empty line after a final line break at the break itself: never before the previous line's end.
      const start = Math.max(m.startIndex, prevEnd);
      const next = Math.max(start, m.endIncludingNewline);
      const breakChar = next > start && /[\n\r\u2028\u2029]/.test(text.charAt(next - 1));
      const end = breakChar ? next - 1 : next;
      lines.push({
        start,
        end,
        endTrimmed: Math.max(start, Math.min(end, m.endExcludingWhitespaces)),
        top: offsetY + m.baseline - m.ascent,
        bottom: offsetY + m.baseline + m.descent,
        baseline: offsetY + m.baseline,
        left: offsetX + m.left,
        width: m.width,
        hard: breakChar,
      });
      prevEnd = next;
    }
    if (!lines.length) {
      lines.push({ start: 0, end: 0, endTrimmed: 0, top: offsetY, bottom: offsetY + this.height, baseline: offsetY + this.height * 0.8, left: offsetX + emptyX, width: 0, hard: false });
    }
    this.lines = lines;
  }

  /** The line `index` is on. At a soft wrap, the index belongs to the line it starts. */
  lineAt(index: number): number {
    let i = 0;
    while (i + 1 < this.lines.length && (this.lines[i + 1] as TextLayoutLine).start <= index) i++;
    return i;
  }

  /** Start of the grapheme (letter, emoji, combined mark) that ends at `index`. */
  before(index: number): number {
    if (index <= 0) return 0;
    const info = this.paragraph?.getGlyphInfoAt(index - 1);
    const start = info?.graphemeClusterTextRange.start;
    return start !== undefined && start < index ? start : prevCodePoint(this.text, index);
  }

  /** End of the grapheme that starts at `index`. */
  after(index: number): number {
    if (index >= this.text.length) return this.text.length;
    const info = this.paragraph?.getGlyphInfoAt(index);
    const end = info?.graphemeClusterTextRange.end;
    return end !== undefined && end > index ? end : nextCodePoint(this.text, index);
  }

  /** The caret at `index` (clamped to the text). */
  caret(index: number): TextCaret {
    const i = Math.max(0, Math.min(this.text.length, index));
    const line = this.lines[this.lineAt(i)] as TextLayoutLine;
    const y = line.top;
    const height = Math.max(1, line.bottom - line.top);
    let x = line.left;
    if (this.paragraph && this.text) {
      if (i < line.end) {
        const r = this.rects(i, this.after(i))[0];
        if (r) x = r.x;
      } else if (i > line.start) {
        const r = this.rects(this.before(i), i).at(-1);
        if (r) x = r.x + r.width;
      }
    }
    return { x, y, height };
  }

  /** Highlight rectangles for the text from `a` to `b`, one or more per line. */
  rangeRects(a: number, b: number): TextRect[] {
    const from = Math.max(0, Math.min(a, b));
    const to = Math.min(this.text.length, Math.max(a, b));
    if (from === to || !this.paragraph) return [];
    const out = this.rects(from, to);
    // A selected line break shows as a short block at the end of its line, as in text editors.
    for (const line of this.lines) {
      if (!line.hard || line.end < from || line.end >= to) continue;
      const caret = this.caret(line.end);
      out.push({ x: caret.x, y: line.top, width: Math.max(4, (line.bottom - line.top) * 0.25), height: line.bottom - line.top });
    }
    return out;
  }

  /** The index nearest to the point (x, y) in the node's space: where a click puts the caret. */
  indexAt(x: number, y: number): number {
    let li = this.lines.findIndex((l) => y < l.bottom);
    if (li < 0) li = this.lines.length - 1;
    const line = this.lines[li] as TextLayoutLine;
    if (!this.paragraph || !this.text) return 0;
    const mid = (line.top + line.bottom) / 2 - this.offsetY;
    const pos = this.paragraph.getGlyphPositionAtCoordinate(x - this.offsetX, mid).pos;
    return Math.max(line.start, Math.min(line.end, pos));
  }

  dispose(): void {
    this.paragraph?.delete();
    this.paragraph = null;
  }

  private rects(a: number, b: number): TextRect[] {
    if (!this.paragraph) return [];
    return this.paragraph.getRectsForRange(a, b, this.ck.RectHeightStyle.Max, this.ck.RectWidthStyle.Tight).map((r) => {
      const [l, t, rr, bb] = r.rect as unknown as number[];
      return { x: (l as number) + this.offsetX, y: (t as number) + this.offsetY, width: (rr as number) - (l as number), height: (bb as number) - (t as number) };
    });
  }
}

function prevCodePoint(s: string, i: number): number {
  const c = s.charCodeAt(i - 1);
  return i >= 2 && c >= 0xdc00 && c <= 0xdfff && s.charCodeAt(i - 2) >= 0xd800 && s.charCodeAt(i - 2) <= 0xdbff ? i - 2 : i - 1;
}

function nextCodePoint(s: string, i: number): number {
  const c = s.charCodeAt(i);
  return c >= 0xd800 && c <= 0xdbff && i + 1 < s.length && s.charCodeAt(i + 1) >= 0xdc00 && s.charCodeAt(i + 1) <= 0xdfff ? i + 2 : i + 1;
}

/** A TEXT node's text fields: what layout and drawing read. */
export type TextNode = Pick<
  DeepReadonly<ReadonlyNode>,
  "characters" | "fontFamily" | "fontStyle" | "fontSize" | "lineHeight" | "letterSpacing" | "textAutoResize" | "textAlignHorizontal" | "textAlignVertical" | "width" | "height"
>;

/** A paragraph laid out for a node's box, and where to draw it in the node. */
export interface PlacedParagraph {
  paragraph: Paragraph;
  x: number;
  y: number;
}

/**
 * The fonts, and paragraphs built from them. `addFonts` registers more
 * (fonts on this computer); listeners then lay text out again.
 */
export class TextEngine {
  private readonly provider: TypefaceFontProvider;
  /** Fallback families: the first font given and the others given with it (e.g. a Latin Extended subset). */
  private readonly fallbacks: string[] = [];
  private readonly registered = new Map<string, Set<string>>();
  private readonly listeners = new Set<() => void>();
  private disposed = false;

  constructor(
    readonly ck: CanvasKit,
    fonts: readonly FontSource[] = [],
  ) {
    this.provider = ck.TypefaceFontProvider.Make();
    for (const f of fonts) this.register(f);
    this.fallbacks = [...new Set(fonts.map((f) => f.family))];
  }

  /** True once at least one font is registered: without fonts nothing can be laid out. */
  get hasFonts(): boolean {
    return this.registered.size > 0;
  }

  /** The first font family: what text in a missing font is drawn with. */
  get fallbackFamily(): string | null {
    return this.fallbacks[0] ?? null;
  }

  /** Every registered family, in the order they were added. */
  families(): string[] {
    return [...this.registered.keys()];
  }

  hasFamily(family: string): boolean {
    return this.registered.has(family);
  }

  /** The style names registered for `family` (e.g. "Regular", "Bold"), in weight order, upright first. */
  styles(family: string): string[] {
    const set = this.registered.get(family);
    if (!set) return [];
    return [...set].sort((a, b) => Number(styleItalic(a)) - Number(styleItalic(b)) || styleWeight(a) - styleWeight(b) || a.localeCompare(b));
  }

  /** Register more fonts. Text using them is laid out again by whoever listens (`subscribe`). */
  addFonts(fonts: readonly FontSource[]): void {
    if (this.disposed || !fonts.length) return;
    for (const f of fonts) this.register(f);
    for (const l of [...this.listeners]) l();
  }

  /** Called after `addFonts`. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Node `n`'s text laid out for its box: wrapped at its width (unless it is
   * auto width), aligned in it, and moved for vertical alignment. Drawn with
   * `color`, or with `paint` (gradients, images, opacity, blending). The
   * caller deletes the paragraph. Null without fonts.
   */
  place(n: TextNode, color: DeepReadonly<Color> = BLACK, paint: Paint | null = null): PlacedParagraph | null {
    if (!this.hasFonts) return null;
    const mode = n.textAutoResize ?? "NONE";
    let p = this.build(n, color, paint);
    let x = 0;
    if (mode === "WIDTH_AND_HEIGHT") {
      // Never wraps: laid out on one line per hard break, aligned within the node's width.
      p.layout(UNBOUNDED);
      const longest = Math.max(0, p.getLongestLine());
      const width = Math.max(n.width, Math.ceil(longest)) + WRAP_SLACK;
      p.layout(width);
      x = (n.width - width) * alignFactor(n.textAlignHorizontal);
    } else {
      p.layout(Math.max(1, n.width));
      if (mode === "TRUNCATE" && p.getHeight() > n.height + 0.01) {
        // The lines that fit (at least one), the last ending in "…".
        const lines = p.getLineMetrics();
        let fit = 0;
        while (fit < lines.length && (lines[fit] as { baseline: number; descent: number }).baseline + (lines[fit] as { descent: number }).descent <= n.height + 0.01) fit++;
        p.delete();
        p = this.build(n, color, paint, Math.max(1, fit));
        p.layout(Math.max(1, n.width));
      }
    }
    const y = (n.height - p.getHeight()) * alignFactor(n.textAlignVertical);
    return { paragraph: p, x, y };
  }

  /**
   * The size `n`'s text needs: at `width` (wrapping there) or, without a
   * width, on one line per line break (auto width). Empty text is one line
   * high. Null without fonts.
   */
  measure(n: TextNode, width?: number): { width: number; height: number } | null {
    if (!this.hasFonts) return null;
    const p = this.build(n, BLACK, null);
    try {
      if (width !== undefined) {
        p.layout(Math.max(1, width));
        return { width, height: p.getHeight() };
      }
      p.layout(UNBOUNDED);
      // Whole pixels, rounded up: the stored width never wraps the text it was measured from (see WRAP_SLACK).
      const longest = Math.ceil(Math.max(0, p.getLongestLine()) - 1e-3);
      return { width: Math.max(1, longest), height: p.getHeight() };
    } finally {
      p.delete();
    }
  }

  /** `n` laid out for caret, selection and hit-testing. Null without fonts. Dispose it when done. */
  layout(n: TextNode): TextLayout | null {
    const placed = this.place(n);
    if (!placed) return null;
    const width = placed.paragraph.getMaxWidth();
    const emptyX = width * alignFactor(n.textAlignHorizontal);
    return new TextLayout(this.ck, placed.paragraph, n.characters ?? "", placed.x, placed.y, emptyX);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.listeners.clear();
    this.provider.delete();
  }

  private register(f: FontSource): void {
    this.provider.registerFont(f.data, f.family);
    let set = this.registered.get(f.family);
    if (!set) this.registered.set(f.family, (set = new Set()));
    for (const s of f.styles?.length ? f.styles : ["Regular"]) set.add(s);
  }

  /** The paragraph for `n`, not laid out yet. `maxLines` ends the text with "…" after that many lines. */
  private build(n: TextNode, color: DeepReadonly<Color>, paint: Paint | null, maxLines?: number): Paragraph {
    const ck = this.ck;
    const fontSize = n.fontSize ?? 12;
    const style = n.fontStyle ?? "Regular";
    const families = n.fontFamily && this.registered.has(n.fontFamily) && n.fontFamily !== this.fallbacks[0] ? [n.fontFamily] : [];
    families.push(...this.fallbacks.filter((f) => !families.includes(f)));
    const lineHeight = lineHeightPx(n);
    const spacing = letterSpacingPx(n);
    const textStyle = {
      color: ck.Color4f(color.r, color.g, color.b, color.a),
      fontFamilies: families,
      fontSize,
      fontStyle: { weight: this.weight(style), slant: styleItalic(style) ? ck.FontSlant.Italic : ck.FontSlant.Upright },
      // Leading is split above and below each line, as in Figma.
      ...(lineHeight !== null ? { heightMultiplier: lineHeight / fontSize, halfLeading: true } : {}),
      ...(spacing ? { letterSpacing: spacing } : {}),
    };
    const align = { LEFT: ck.TextAlign.Left, CENTER: ck.TextAlign.Center, RIGHT: ck.TextAlign.Right, JUSTIFIED: ck.TextAlign.Justify }[n.textAlignHorizontal ?? "LEFT"] ?? ck.TextAlign.Left;
    const builder = ck.ParagraphBuilder.MakeFromFontProvider(
      new ck.ParagraphStyle({ textAlign: align, textStyle, ...(maxLines ? { maxLines, ellipsis: "…" } : {}) }),
      this.provider,
    );
    try {
      if (paint) {
        // The paint's shader is in the node's space, which is the paragraph's too (drawn at 0, 0).
        const background = new ck.Paint();
        background.setColor(ck.TRANSPARENT);
        builder.pushPaintStyle(new ck.TextStyle(textStyle), paint, background);
        builder.addText(n.characters ?? "");
        builder.pop();
        background.delete();
      } else {
        builder.addText(n.characters ?? "");
      }
      return builder.build();
    } finally {
      builder.delete();
    }
  }

  private weight(style: string): FontWeight {
    const W = this.ck.FontWeight;
    return ({ 100: W.Thin, 200: W.ExtraLight, 300: W.Light, 400: W.Normal, 500: W.Medium, 600: W.SemiBold, 700: W.Bold, 800: W.ExtraBold, 900: W.Black } as Record<number, FontWeight>)[styleWeight(style)] ?? W.Normal;
  }
}

const BLACK: Color = { r: 0, g: 0, b: 0, a: 1 };

/** 0 for start (left, top), 0.5 for centre, 1 for end. */
function alignFactor(a: string | undefined): number {
  return a === "CENTER" ? 0.5 : a === "RIGHT" || a === "BOTTOM" ? 1 : 0;
}
