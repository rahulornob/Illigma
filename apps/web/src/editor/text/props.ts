/**
 * Whole-layer text settings from the Typography card: reading what a layer
 * shows (line height and letter spacing with their units, the resize mode)
 * and the patches that change them. Each change is one `Document.transact`,
 * so one undo step, and layout (auto width and height, Hug text in auto
 * layout) runs inside it.
 */

import type { Document, ReadonlyNode, Transaction } from "@illigma/core";
import type { LetterSpacing, LineHeight, NodeId, TextAlignHorizontal, TextAlignVertical, TextAutoResize, TextFields } from "@illigma/format";
import { lineHeightPx, MAX_TEXT_METRIC } from "@illigma/format";
import { textSessionOf } from "./session";

export type MetricUnit = "PIXELS" | "PERCENT";

/** Text fields the card sets; `undefined` removes the field (its default applies). */
export type TextPatch = { [K in keyof TextFields]?: TextFields[K] | undefined } & {
  layoutSizingHorizontal?: undefined;
  layoutSizingVertical?: undefined;
};

/** Inter's line box in ems: what "Auto" line height comes to, in pixels, when switching to a number. */
const AUTO_LINE = 1.2109375;

export const fontSizeOf = (n: ReadonlyNode): number => n.fontSize ?? 12;

/** The line height as the card shows it: "Auto", or a number with its unit (a bare number in the file is pixels). */
export function lineHeightView(n: ReadonlyNode): { unit: "AUTO" } | { unit: MetricUnit; value: number } {
  const lh = n.lineHeight;
  if (lh === undefined || (typeof lh === "number" && !(lh > 0))) return { unit: "AUTO" };
  if (typeof lh === "number") return { unit: "PIXELS", value: lh };
  if (lh.unit === "AUTO") return { unit: "AUTO" };
  return { unit: lh.unit, value: lh.value };
}

/** The line height in `unit`, from what `n` has now: switching units keeps the lines where they are. */
export function lineHeightIn(n: ReadonlyNode, unit: "AUTO" | MetricUnit): LineHeight | undefined {
  if (unit === "AUTO") return undefined;
  const px = lineHeightPx(n) ?? Math.round(fontSizeOf(n) * AUTO_LINE * 100) / 100;
  const value = unit === "PIXELS" ? px : (px / fontSizeOf(n)) * 100;
  // Within the format's bounds: a tiny font with a tall line can't go past 10,000%.
  return { unit, value: round2(Math.min(value, MAX_TEXT_METRIC)) };
}

/** A typed line height: a number in the unit shown (pixels when the line height was Auto). */
export function typedLineHeight(n: ReadonlyNode, value: number): LineHeight {
  const view = lineHeightView(n);
  return { unit: view.unit === "AUTO" ? "PIXELS" : view.unit, value: Math.max(0, round2(value)) };
}

export function letterSpacingView(n: ReadonlyNode): { unit: MetricUnit; value: number } {
  return n.letterSpacing ? { unit: n.letterSpacing.unit, value: n.letterSpacing.value } : { unit: "PERCENT", value: 0 };
}

/** The letter spacing in `unit`, converted from what `n` has now. */
export function letterSpacingIn(n: ReadonlyNode, unit: MetricUnit): LetterSpacing {
  const view = letterSpacingView(n);
  if (view.unit === unit) return { unit, value: view.value };
  const size = fontSizeOf(n);
  return { unit, value: round2(unit === "PIXELS" ? (view.value * size) / 100 : (view.value / size) * 100) };
}

/** The resize mode the card shows: absent is "NONE" (format 0 drew text in a fixed box). */
export const resizeModeOf = (n: ReadonlyNode): TextAutoResize => n.textAutoResize ?? "NONE";
export const alignHorizontalOf = (n: ReadonlyNode): TextAlignHorizontal => n.textAlignHorizontal ?? "LEFT";
export const alignVerticalOf = (n: ReadonlyNode): TextAlignVertical => n.textAlignVertical ?? "TOP";

/**
 * The patch for resize mode `mode`, as in Figma: auto width hugs both axes
 * (Fill on either axis goes), auto height hugs the height (Fill height goes);
 * fixed keeps the box.
 */
export function resizePatch(n: ReadonlyNode, mode: TextAutoResize): TextPatch {
  const patch: TextPatch = { textAutoResize: mode };
  if (mode === "WIDTH_AND_HEIGHT" && n.layoutSizingHorizontal === "FILL") patch.layoutSizingHorizontal = undefined;
  if ((mode === "WIDTH_AND_HEIGHT" || mode === "HEIGHT") && n.layoutSizingVertical === "FILL") patch.layoutSizingVertical = undefined;
  return patch;
}

/**
 * Apply `patch` (or a patch per layer) to the text layers `ids` as one undo
 * step. A new text layer that has no text yet takes it into its "Add text"
 * step (it isn't kept until something is typed). Returns false when nothing
 * could be applied because another live edit (a canvas drag, a typing burst)
 * is running: the caller may wait for it (`whenIdle`).
 */
export function setTextProps(doc: Document, ids: readonly NodeId[], patch: TextPatch | ((n: ReadonlyNode) => TextPatch), label: string): boolean {
  if (doc.live) {
    const s = textSessionOf(doc);
    const n = s?.emptyNew && ids.length === 1 && ids[0] === s.id ? doc.get(s.id) : undefined;
    return !!(s && n && s.patchNew(typeof patch === "function" ? patch(n) : patch));
  }
  doc.transact(label, (tx: Transaction) => {
    for (const id of ids) {
      const n = doc.get(id);
      if (!n || n.type !== "TEXT") continue;
      const p = typeof patch === "function" ? patch(n) : patch;
      for (const [key, value] of Object.entries(p)) tx.set(id, key as keyof TextFields, value as never);
    }
  });
  return true;
}

/**
 * Run `fn` once no live edit is open in `doc` (now, if none is). Gives up
 * after `timeoutMs`, calling `onTimeout`. Returns a function that cancels it.
 */
export function whenIdle(doc: Document, fn: () => void, onTimeout: () => void, timeoutMs = 30_000): () => void {
  if (!doc.live) {
    fn();
    return () => {};
  }
  let done = false;
  const finish = (run: () => void) => {
    if (done) return;
    done = true;
    off();
    clearTimeout(timer);
    run();
  };
  // Changes arrive while the live edit runs and once more when it ends: check after each.
  const off = doc.subscribe(() => {
    if (!doc.live) queueMicrotask(() => finish(fn));
  });
  const timer = setTimeout(() => finish(onTimeout), timeoutMs);
  return () => {
    done = true;
    off();
    clearTimeout(timer);
  };
}

/** Every font family the file's text layers use, sorted. */
export function familiesInFile(doc: Document): string[] {
  const out = new Set<string>();
  for (const page of doc.pages()) for (const n of doc.subtree(page.id)) if (n.type === "TEXT" && n.fontFamily) out.add(n.fontFamily);
  return [...out].sort((a, b) => a.localeCompare(b));
}

const round2 = (v: number) => Math.round(v * 100) / 100;
