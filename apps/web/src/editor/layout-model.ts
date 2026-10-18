/**
 * What the auto layout and constraints inspector shows, and the Shift+A
 * commands, as plain functions of the document: no React here, so all of it
 * is unit tested.
 */

import type { Document, ReadonlyNode, Transaction } from "@illigma/core";
import type { ConstraintType, CounterAxisAlign, LayoutSizing, NodeId, PrimaryAxisAlign } from "@illigma/format";
import { FRAME_TYPES, isAutoLayout, rotatedBounds } from "@illigma/layout";
import { topmost } from "./edit";
import { layoutTransact, setLayoutProps, type LayoutPatch } from "./layout-props";

export type Axis = "width" | "height";
/** The direction buttons: Wrap is a horizontal stack that wraps into rows. */
export type Direction = "HORIZONTAL" | "VERTICAL" | "WRAP";
/** One of the three positions on an axis: start, centre, end. */
export type Align3 = "MIN" | "CENTER" | "MAX";

const ALIGN3: readonly Align3[] = ["MIN", "CENTER", "MAX"];

export const isFrame = (n: ReadonlyNode | undefined): boolean => !!n && FRAME_TYPES.has(n.type);
export const isAutoLayoutNode = (n: ReadonlyNode | undefined): n is ReadonlyNode => !!n && isAutoLayout(n);

export function directionOf(n: ReadonlyNode): Direction | null {
  if (!isAutoLayout(n)) return null;
  if (n.layoutMode === "HORIZONTAL" && n.layoutWrap === "WRAP") return "WRAP";
  return n.layoutMode as "HORIZONTAL" | "VERTICAL";
}

// ---- the 9-point alignment grid ----

/** A cell of the alignment grid: column 0–2 (left to right), row 0–2 (top to bottom). */
export interface Cell {
  col: number;
  row: number;
}

/**
 * The grid cell for a frame's alignment. Columns follow the horizontal axis
 * and rows the vertical one, so a horizontal stack's primary alignment picks
 * the column and a vertical stack's picks the row. An Auto gap (SPACE_*) has
 * no primary position: it reads as the centre, and `spread` is true.
 */
export function alignmentCell(n: Pick<ReadonlyNode, "layoutMode" | "primaryAxisAlignItems" | "counterAxisAlignItems">): Cell & { spread: boolean } {
  const primary = n.primaryAxisAlignItems ?? "MIN";
  const spread = primary.startsWith("SPACE_");
  const p = spread ? 1 : ALIGN3.indexOf(primary as Align3);
  const c = ALIGN3.indexOf(n.counterAxisAlignItems ?? "MIN");
  return n.layoutMode === "VERTICAL" ? { col: c, row: p, spread } : { col: p, row: c, spread };
}

/**
 * The fields for clicking grid cell `cell` on a frame laid out in `direction`.
 * With an Auto gap only the cross-axis alignment changes; the gap stays Auto.
 */
export function alignmentPatch(direction: Direction, cell: Cell, spread = false): { primaryAxisAlignItems?: PrimaryAxisAlign; counterAxisAlignItems: CounterAxisAlign } {
  const vertical = direction === "VERTICAL";
  const primary = ALIGN3[vertical ? cell.row : cell.col] as Align3;
  const counter = ALIGN3[vertical ? cell.col : cell.row] as Align3;
  return spread ? { counterAxisAlignItems: counter } : { primaryAxisAlignItems: primary, counterAxisAlignItems: counter };
}

const ROW_NAMES = ["Top", "Center", "Bottom"] as const;
const COL_NAMES = ["left", "center", "right"] as const;
/** "Top left", "Center", "Bottom right", … */
export function cellName(cell: Cell): string {
  if (cell.row === 1 && cell.col === 1) return "Center";
  return `${ROW_NAMES[cell.row]} ${COL_NAMES[cell.col]}`;
}

/** The patch for a direction button. Sizing is written out first so swapping axes never flips Hug and Fixed. */
export function directionPatch(n: ReadonlyNode, direction: Direction): LayoutPatch {
  return {
    layoutMode: direction === "VERTICAL" ? "VERTICAL" : "HORIZONTAL",
    layoutWrap: direction === "WRAP" ? "WRAP" : undefined,
    layoutSizingHorizontal: storedSizing(n, "width"),
    layoutSizingVertical: storedSizing(n, "height"),
  };
}

// ---- sizing: Fixed, Hug contents, Fill container ----

/** The sizing a node stores for `axis`: the explicit field, else Hug on an auto layout frame's AUTO axes, else Fixed. */
export function storedSizing(n: ReadonlyNode, axis: Axis): LayoutSizing {
  const explicit = axis === "width" ? n.layoutSizingHorizontal : n.layoutSizingVertical;
  if (explicit) return explicit;
  if (!isAutoLayout(n)) return "FIXED";
  const primary = (n.layoutMode === "HORIZONTAL") === (axis === "width");
  return (primary ? n.primaryAxisSizingMode : n.counterAxisSizingMode) === "FIXED" ? "FIXED" : "HUG";
}

/** True when `n` sits in an auto layout parent's flow (Fill is possible). */
export function inAutoLayoutFlow(doc: Document, n: ReadonlyNode): boolean {
  const parent = n.parentId ? doc.get(n.parentId) : undefined;
  return isAutoLayoutNode(parent) && n.layoutPositioning !== "ABSOLUTE";
}

/** The sizing options the W or H menu offers for `n`: Hug only for auto layout frames, Fill only in an auto layout flow. */
export function sizingOptions(doc: Document, n: ReadonlyNode): LayoutSizing[] {
  const out: LayoutSizing[] = ["FIXED"];
  if (isAutoLayout(n)) out.push("HUG");
  if (inAutoLayoutFlow(doc, n)) out.push("FILL");
  return out;
}

/** The sizing the W or H field shows: what layout actually does with `n` (an invalid stored value acts as Fixed). */
export function effectiveSizing(doc: Document, n: ReadonlyNode, axis: Axis): LayoutSizing {
  const s = storedSizing(n, axis);
  return sizingOptions(doc, n).includes(s) ? s : "FIXED";
}

const SIZING_KEY = { width: "layoutSizingHorizontal", height: "layoutSizingVertical" } as const;

/**
 * Set `sizing` on `axis` for each of `ids`, as Figma does: a Fill child makes a
 * parent that hugs on that axis Fixed (it can't both hug and be filled), and a
 * frame set to Hug turns its Fill children on that axis to Fixed.
 */
export function setSizing(doc: Document, ids: readonly NodeId[], axis: Axis, sizing: LayoutSizing): void {
  const key = SIZING_KEY[axis];
  const label = `${axis === "width" ? "Width" : "Height"}: ${sizing === "FIXED" ? "Fixed" : sizing === "HUG" ? "Hug contents" : "Fill container"}`;
  const patches = new Map<NodeId, LayoutPatch>();
  const add = (id: NodeId, p: LayoutPatch) => patches.set(id, { ...patches.get(id), ...p });
  for (const id of ids) {
    const n = doc.get(id);
    if (!n || !sizingOptions(doc, n).includes(sizing)) continue;
    add(id, { [key]: sizing });
    if (sizing === "FILL") {
      const parent = doc.get(n.parentId as NodeId);
      if (parent && storedSizing(parent, axis) === "HUG" && !ids.includes(parent.id)) add(parent.id, { [key]: "FIXED" });
    }
    if (sizing === "HUG") {
      for (const k of doc.children(id)) if (k.layoutPositioning !== "ABSOLUTE" && storedSizing(k, axis) === "FILL") add(k.id, { [key]: "FIXED" });
    }
  }
  if (patches.size) setLayoutProps(doc, [...patches.keys()], (id) => patches.get(id) ?? {}, label);
}

// ---- constraints ----

export const CONSTRAINT_OPTIONS: Record<"horizontal" | "vertical", readonly { value: ConstraintType; label: string }[]> = {
  horizontal: [
    { value: "MIN", label: "Left" },
    { value: "MAX", label: "Right" },
    { value: "STRETCH", label: "Left & right" },
    { value: "CENTER", label: "Center" },
    { value: "SCALE", label: "Scale" },
  ],
  vertical: [
    { value: "MIN", label: "Top" },
    { value: "MAX", label: "Bottom" },
    { value: "STRETCH", label: "Top & bottom" },
    { value: "CENTER", label: "Center" },
    { value: "SCALE", label: "Scale" },
  ],
};

/**
 * True when `n` follows constraints: it sits in a frame (directly or through
 * groups) that is not an auto layout frame, or it ignores its auto layout
 * parent ("Absolute position"). Top-level layers on a page have none.
 */
export function hasConstraints(doc: Document, n: ReadonlyNode): boolean {
  let parent = n.parentId ? doc.get(n.parentId) : undefined;
  if (isAutoLayoutNode(parent)) return n.layoutPositioning === "ABSOLUTE";
  while (parent && parent.type === "GROUP") parent = parent.parentId ? doc.get(parent.parentId) : undefined;
  return isFrame(parent) && !isAutoLayoutNode(parent);
}

// ---- guessing a layout from an arrangement (Shift+A) ----

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const EPS = 0.5;

/** A layer's box in its parent's space (a rotated layer's bounding box). */
export function boxOf(n: ReadonlyNode): Rect {
  const b = rotatedBounds(n.width, n.height, n.rotation);
  return { x: n.x + b.x, y: n.y + b.y, width: b.width, height: b.height };
}

/**
 * The direction of a stack the layers in `rects` already form, as Figma
 * guesses it: the axis along which more neighbours sit side by side without
 * overlapping; on a tie, the axis they are spread further along. One layer
 * (or none) makes a horizontal stack, the usual start of a button.
 */
export function guessDirection(rects: readonly Rect[]): "HORIZONTAL" | "VERTICAL" {
  if (rects.length < 2) return "HORIZONTAL";
  const apart = (axis: "x" | "y") => {
    const size = axis === "x" ? "width" : "height";
    const sorted = [...rects].sort((a, b) => a[axis] - b[axis]);
    let n = 0;
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1] as Rect;
      if ((sorted[i] as Rect)[axis] >= prev[axis] + prev[size] - EPS) n++;
    }
    return n;
  };
  const h = apart("x");
  const v = apart("y");
  if (h !== v) return h > v ? "HORIZONTAL" : "VERTICAL";
  const spread = (axis: "x" | "y") => {
    const size = axis === "x" ? "width" : "height";
    const centres = rects.map((r) => r[axis] + r[size] / 2);
    return Math.max(...centres) - Math.min(...centres);
  };
  return spread("x") >= spread("y") ? "HORIZONTAL" : "VERTICAL";
}

/** `rects` in stack order along `direction` (left to right, or top to bottom). */
export function stackOrder<T extends Rect>(rects: readonly T[], direction: "HORIZONTAL" | "VERTICAL"): T[] {
  const axis = direction === "HORIZONTAL" ? "x" : "y";
  const cross = direction === "HORIZONTAL" ? "y" : "x";
  return [...rects].sort((a, b) => a[axis] - b[axis] || a[cross] - b[cross]);
}

/** The average space between neighbours along the stack, rounded to whole pixels, never negative. */
export function guessGap(rects: readonly Rect[], direction: "HORIZONTAL" | "VERTICAL"): number {
  if (rects.length < 2) return 0;
  const axis = direction === "HORIZONTAL" ? "x" : "y";
  const size = direction === "HORIZONTAL" ? "width" : "height";
  const sorted = stackOrder(rects, direction);
  let total = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1] as Rect;
    total += (sorted[i] as Rect)[axis] - (prev[axis] + prev[size]);
  }
  return Math.max(0, Math.round(total / (sorted.length - 1)));
}

/** How the layers line up across the stack: shared start, centre or end edges (start when none). */
export function guessCounterAlign(rects: readonly Rect[], direction: "HORIZONTAL" | "VERTICAL"): Align3 {
  if (rects.length < 2) return "MIN";
  const axis = direction === "HORIZONTAL" ? "y" : "x";
  const size = direction === "HORIZONTAL" ? "height" : "width";
  const same = (f: (r: Rect) => number) => {
    const v = rects.map(f);
    return Math.max(...v) - Math.min(...v) <= EPS;
  };
  if (same((r) => r[axis])) return "MIN";
  if (same((r) => r[axis] + r[size] / 2)) return "CENTER";
  if (same((r) => r[axis] + r[size])) return "MAX";
  return "MIN";
}

const round = (v: number) => Math.max(0, Math.round(v));

/** Order `ids` (children of one parent) as `order` lists them, by moving each to the end in turn. */
function reorder(tx: Transaction, parent: NodeId, order: readonly NodeId[]): void {
  for (const id of order) tx.move(id, parent, "last");
}

/**
 * Turn a plain frame into an auto layout frame that keeps its children where
 * they are as far as possible: direction, gap and alignment are guessed from
 * their arrangement, padding from their distance to the frame's edges, and
 * the frame hugs them. An empty frame keeps its size. Runs inside `tx`.
 */
export function addAutoLayoutTo(tx: Transaction, doc: Document, id: NodeId): void {
  const frame = doc.get(id);
  if (!frame || !isFrame(frame) || isAutoLayout(frame)) return;
  const kids = doc.children(id).filter((k) => k.visible && k.layoutPositioning !== "ABSOLUTE");
  const rects = kids.map((k) => ({ ...boxOf(k), id: k.id }));
  const direction = guessDirection(rects);
  const fields: LayoutPatch = { layoutMode: direction, itemSpacing: guessGap(rects, direction), counterAxisAlignItems: guessCounterAlign(rects, direction) };
  if (rects.length) {
    const x0 = Math.min(...rects.map((r) => r.x));
    const y0 = Math.min(...rects.map((r) => r.y));
    const x1 = Math.max(...rects.map((r) => r.x + r.width));
    const y1 = Math.max(...rects.map((r) => r.y + r.height));
    Object.assign(fields, {
      paddingLeft: round(x0),
      paddingTop: round(y0),
      paddingRight: round(frame.width - x1),
      paddingBottom: round(frame.height - y1),
      layoutSizingHorizontal: "HUG",
      layoutSizingVertical: "HUG",
    } satisfies LayoutPatch);
    // Children keep their visual order: hidden and absolute ones stay where they are in the stack.
    if (kids.length === doc.children(id).length) reorder(tx, id, stackOrder(rects, direction).map((r) => r.id));
  } else {
    Object.assign(fields, { layoutSizingHorizontal: "FIXED", layoutSizingVertical: "FIXED" } satisfies LayoutPatch);
  }
  for (const [key, value] of Object.entries(fields)) tx.set(id, key as keyof LayoutPatch, value as never);
}

/**
 * Wrap `ids` (siblings) in a new auto layout frame that hugs them, at the
 * place of the front-most one (or, in an auto layout parent, of the first in
 * its flow). Returns the new frame's id, or null when they don't share a parent.
 */
export function wrapInAutoLayout(tx: Transaction, doc: Document, ids: readonly NodeId[]): NodeId | null {
  const nodes = ids.map((id) => doc.get(id)).filter((n): n is ReadonlyNode => !!n && n.type !== "PAGE");
  const parentId = nodes[0]?.parentId;
  if (!parentId || nodes.some((n) => n.parentId !== parentId)) return null;
  const siblings = doc.children(parentId).map((n) => n.id);
  const chosen = new Set(nodes.map((n) => n.id));
  const inOrder = siblings.filter((id) => chosen.has(id));
  const parent = doc.get(parentId);
  const anchor = isAutoLayoutNode(parent) ? { before: inOrder[0] as NodeId } : { after: inOrder.at(-1) as NodeId };

  const rects = nodes.map((n) => ({ ...boxOf(n), id: n.id }));
  const direction = guessDirection(rects);
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.width));
  const y1 = Math.max(...rects.map((r) => r.y + r.height));
  const frame = tx.create(
    "FRAME",
    parentId,
    {
      x: x0,
      y: y0,
      width: x1 - x0,
      height: y1 - y0,
      layoutMode: direction,
      itemSpacing: guessGap(rects, direction),
      counterAxisAlignItems: guessCounterAlign(rects, direction),
      layoutSizingHorizontal: "HUG",
      layoutSizingVertical: "HUG",
    },
    anchor,
  );
  for (const r of stackOrder(rects, direction)) {
    const n = doc.get(r.id) as ReadonlyNode;
    tx.move(r.id, frame, "last");
    tx.set(r.id, "x", n.x - x0);
    tx.set(r.id, "y", n.y - y0);
    // A child that filled its old auto layout parent keeps its current size.
    if (n.layoutSizingHorizontal === "FILL") tx.set(r.id, "layoutSizingHorizontal", "FIXED");
    if (n.layoutSizingVertical === "FILL") tx.set(r.id, "layoutSizingVertical", "FIXED");
  }
  return frame;
}

/**
 * Shift+A, as in Figma: a single frame without auto layout gets it; anything
 * else (several layers, a shape, an auto layout frame) is wrapped in a new
 * auto layout frame. One undo step. Returns the selection afterwards.
 */
export function autoLayoutSelection(doc: Document, selection: readonly NodeId[]): NodeId[] {
  const layers = topmost(doc, selection);
  if (!layers.length) return [...selection];
  const only = layers.length === 1 ? doc.get(layers[0] as NodeId) : undefined;
  if (only && isFrame(only) && !isAutoLayout(only)) {
    layoutTransact(doc, "Add auto layout", (tx) => addAutoLayoutTo(tx, doc, only.id));
    return [only.id];
  }
  const frame = layoutTransact(doc, "Wrap in auto layout", (tx) => wrapInAutoLayout(tx, doc, layers));
  return frame ? [frame] : [...selection];
}

/** The + button: auto layout on each selected frame when every one is a plain frame, else Shift+A. */
export function addAutoLayout(doc: Document, selection: readonly NodeId[]): NodeId[] {
  const layers = topmost(doc, selection);
  if (layers.length > 1 && layers.every((id) => isFrame(doc.get(id)) && !isAutoLayout(doc.get(id) as ReadonlyNode))) {
    layoutTransact(doc, "Add auto layout", (tx) => layers.forEach((id) => addAutoLayoutTo(tx, doc, id)));
    return layers;
  }
  return autoLayoutSelection(doc, selection);
}

/** The − button and ⌥⇧A: back to a plain frame. Children stay where auto layout put them. */
export function removeAutoLayout(doc: Document, ids: readonly NodeId[]): void {
  const frames = ids.filter((id) => isAutoLayoutNode(doc.get(id)));
  if (!frames.length) return;
  // A plain frame can't hug: it keeps the size auto layout gave it.
  const fixed = (n: ReadonlyNode, axis: Axis) => (storedSizing(n, axis) === "HUG" ? "FIXED" : axis === "width" ? n.layoutSizingHorizontal : n.layoutSizingVertical);
  setLayoutProps(
    doc,
    frames,
    (id) => {
      const n = doc.get(id) as ReadonlyNode;
      return { layoutMode: undefined, layoutWrap: undefined, layoutSizingHorizontal: fixed(n, "width"), layoutSizingVertical: fixed(n, "height") };
    },
    "Remove auto layout",
  );
}
