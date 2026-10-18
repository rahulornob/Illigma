/**
 * Auto layout for one frame: Figma's horizontal and vertical stacks, with
 * padding, gap (fixed, negative or Auto), alignment, wrap, and Fixed, Hug or
 * Fill sizing with min and max limits. It follows Figma's flexbox-aligned
 * layout version:
 *
 * - Fill children share the free space by content box, as in CSS: each one's
 *   own padding is added on top of an equal share, and min and max limits
 *   are honoured by freezing the children that hit them and sharing again.
 * - An Auto gap (Between, Around, Evenly) is never negative; when children
 *   overflow they start at the leading edge. A single child in Between sits
 *   at the start. An explicit negative gap overlaps children.
 * - A frame is never smaller than its padding, even with a smaller max size.
 * - Hidden children and children set to ignore auto layout ("ABSOLUTE") take
 *   no space.
 * - Children rotated by anything other than 0° or 180° are laid out by their
 *   rotated bounding box at their own size; Fill does not apply to them.
 *
 * Nested frames come in through `measure`, which reports a child's size
 * (hugging its own content) for given forced widths or heights.
 */

import type { CounterAxisAlign, LayoutSizing, NodeId, NodeType, PrimaryAxisAlign } from "@illigma/format";
import { finite, MIN_SIZE, quarterTurns, rotatedBounds } from "./geometry.js";
import type { Box, LayoutNode, Size } from "./types.js";

export type Axis = "width" | "height";

/** A child's size given the width and/or height its parent forces on it (`undefined` = its own sizing). */
export type Measure = (child: LayoutNode, width: number | undefined, height: number | undefined) => Size;

/** Node types that can be auto layout frames and that apply constraints to their children. */
export const FRAME_TYPES: ReadonlySet<NodeType> = new Set<NodeType>(["FRAME", "COMPONENT", "COMPONENT_SET", "INSTANCE"]);

/** True for a frame, component or instance with a horizontal or vertical auto layout. */
export function isAutoLayout(n: LayoutNode): boolean {
  return FRAME_TYPES.has(n.type) && (n.layoutMode === "HORIZONTAL" || n.layoutMode === "VERTICAL");
}

/** True when `n` takes part in its auto layout parent's flow: visible and not set to ignore auto layout. */
export function isInFlow(n: LayoutNode): boolean {
  return n.visible && n.layoutPositioning !== "ABSOLUTE";
}

/**
 * How `n` is sized on `axis`. `layoutSizingHorizontal`/`Vertical` win when
 * set; otherwise an auto layout frame hugs on its "AUTO" axes and everything
 * else is fixed. Hug needs an auto layout frame (text sizing comes with text
 * layout) and Fill needs an auto layout parent; otherwise they act as Fixed.
 */
export function layoutSizing(n: LayoutNode, axis: Axis, inAutoLayout: boolean): LayoutSizing {
  const al = isAutoLayout(n);
  const explicit = axis === "width" ? n.layoutSizingHorizontal : n.layoutSizingVertical;
  const sizing = explicit ?? (al && sizingMode(n, axis) === "AUTO" ? "HUG" : "FIXED");
  if (sizing === "HUG" && !al) return "FIXED";
  if (sizing === "FILL" && !inAutoLayout) return "FIXED";
  return sizing;
}

function sizingMode(n: LayoutNode, axis: Axis) {
  const primary = (n.layoutMode === "HORIZONTAL") === (axis === "width");
  return (primary ? n.primaryAxisSizingMode : n.counterAxisSizingMode) ?? "AUTO";
}

/** A frame's padding; absent or invalid sides are 0. */
export function padding(n: LayoutNode): { left: number; right: number; top: number; bottom: number } {
  const side = (v: number | undefined) => Math.max(0, finite(v));
  return { left: side(n.paddingLeft), right: side(n.paddingRight), top: side(n.paddingTop), bottom: side(n.paddingBottom) };
}

/** Padding on both sides of `axis` (left + right for width). Only auto layout frames have padding. */
export function insets(n: LayoutNode, axis: Axis): number {
  if (!isAutoLayout(n)) return 0;
  const p = padding(n);
  return axis === "width" ? p.left + p.right : p.top + p.bottom;
}

/** `value` within the node's min and max on `axis`. When they conflict, min wins, as in CSS. */
export function limit(n: LayoutNode, axis: Axis, value: number): number {
  const min = axis === "width" ? n.minWidth : n.minHeight;
  const max = axis === "width" ? n.maxWidth : n.maxHeight;
  let v = value;
  if (max !== undefined) v = Math.min(v, max);
  if (min !== undefined) v = Math.max(v, min);
  return v;
}

/** A frame's size on `axis`: within its limits and never smaller than its padding. Computed sizes are at least MIN_SIZE. */
export function frameSize(n: LayoutNode, axis: Axis, value: number, computed: boolean): number {
  const v = Math.max(limit(n, axis, value), insets(n, axis));
  return computed ? Math.max(v, MIN_SIZE) : v;
}

/** The size layout gives a stretched or filling child: within its limits, at least its padding and MIN_SIZE. */
function computedSize(n: LayoutNode, axis: Axis, value: number): number {
  return Math.max(limit(n, axis, value), insets(n, axis), MIN_SIZE);
}

/** A child's stored size, or the forced one. The default `measure`, for children that are plain boxes. */
export const storedSize: Measure = (child, width, height) => ({ width: width ?? child.width, height: height ?? child.height });

/** Sizes forced on a child by its parent (Fill), per axis. */
export interface Forced {
  width?: number | undefined;
  height?: number | undefined;
}

/** The result of laying out one auto layout frame. */
export interface FrameLayout extends Size {
  /**
   * The new box of each child in the flow, relative to the frame: `x` and `y`
   * are the child's own `x` and `y`, so a rotated child's bounding box lands
   * in its slot. Hidden and absolute children are not included.
   */
  children: Map<NodeId, Box>;
  /** The width and/or height the frame forced on each child it filled or stretched. */
  forced: Map<NodeId, Forced>;
}

export interface LayoutFrameOptions {
  /** The frame's width when its parent sets it (Fill). Default: the frame's own sizing. */
  width?: number | undefined;
  /** The frame's height when its parent sets it (Fill). Default: the frame's own sizing. */
  height?: number | undefined;
  /** Reports each child's size; the default uses stored sizes. `relayout` passes one that hugs nested frames. */
  measure?: Measure;
}

interface Item {
  node: LayoutNode;
  /** 0° or 180°: the node's width and height run along the frame's axes, so Fill can apply. */
  upright: boolean;
  fillMain: boolean;
  fillCross: boolean;
  /** The size of the item's slot along and across the stack (the rotated bounding box). */
  main: number;
  cross: number;
  /** The node's own size. */
  width: number;
  height: number;
  forced: Forced;
}

const FACTOR: Record<CounterAxisAlign, number> = { MIN: 0, CENTER: 0.5, MAX: 1 };

/** Lay out the children of auto layout `frame`. Children are in stacking order, which is also flow order. */
export function layoutFrame(frame: LayoutNode, children: readonly LayoutNode[], options: LayoutFrameOptions = {}): FrameLayout {
  const measure = options.measure ?? storedSize;
  const horizontal = frame.layoutMode !== "VERTICAL";
  const MAIN: Axis = horizontal ? "width" : "height";
  const CROSS: Axis = horizontal ? "height" : "width";
  const pad = padding(frame);
  const mainStart = horizontal ? pad.left : pad.top;
  const mainPad = horizontal ? pad.left + pad.right : pad.top + pad.bottom;
  const crossStart = horizontal ? pad.top : pad.left;
  const crossPad = horizontal ? pad.top + pad.bottom : pad.left + pad.right;
  const given: Forced = { width: options.width, height: options.height };

  const hugMain = given[MAIN] === undefined && layoutSizing(frame, MAIN, false) === "HUG";
  const hugCross = given[CROSS] === undefined && layoutSizing(frame, CROSS, false) === "HUG";
  let mainSize = hugMain ? 0 : frameSize(frame, MAIN, given[MAIN] ?? frame[MAIN], false);

  const align: PrimaryAxisAlign = frame.primaryAxisAlignItems ?? "MIN";
  const autoGap = align === "SPACE_BETWEEN" || align === "SPACE_AROUND" || align === "SPACE_EVENLY";
  const gap = finite(frame.itemSpacing);
  const packedGap = autoGap ? 0 : gap;
  const lineGap = frame.counterAxisSpacing !== undefined ? Math.max(0, finite(frame.counterAxisSpacing)) : Math.max(0, gap);
  // Wrapping needs a known length to wrap at.
  const wrap = frame.layoutWrap === "WRAP" && !hugMain;
  const crossFactor = FACTOR[frame.counterAxisAlignItems ?? "MIN"];

  // A single line in a frame of known thickness spans its inner thickness. Known up front, so
  // children that stretch across are measured at their stretched size from the start (what a
  // child hugs along the stack can depend on it: wrapped content).
  const knownCross = !wrap && !hugCross ? Math.max(0, frameSize(frame, CROSS, given[CROSS] ?? frame[CROSS], false) - crossPad) : undefined;

  // 1. Items, with natural sizes for those that don't fill along the stack.
  const items: Item[] = [];
  for (const node of children) {
    if (!isInFlow(node)) continue;
    const upright = quarterTurns(node.rotation) % 2 === 0;
    const item: Item = {
      node,
      upright,
      fillMain: upright && !hugMain && layoutSizing(node, MAIN, true) === "FILL",
      fillCross: upright && layoutSizing(node, CROSS, true) === "FILL",
      main: 0,
      cross: 0,
      width: 0,
      height: 0,
      forced: {},
    };
    if (item.fillCross && knownCross !== undefined) item.forced[CROSS] = computedSize(node, CROSS, knownCross);
    // Wrapping breaks lines by natural size, so filling items are measured too.
    if (!item.fillMain || wrap) natural(item, measure(node, item.forced.width, item.forced.height));
    items.push(item);
  }

  // 2. Lines: one, unless the frame wraps.
  const lines: Item[][] = [[]];
  let used = 0;
  for (const item of items) {
    const line = lines[lines.length - 1] as Item[];
    const next = used + (line.length ? packedGap : 0) + item.main;
    if (wrap && line.length && next > mainSize - mainPad + 1e-6) {
      lines.push([item]);
      used = item.main;
    } else {
      line.push(item);
      used = next;
    }
  }

  // 3. Length along the stack: hug the longest line, or share the free space among Fill items.
  if (hugMain) {
    let longest = 0;
    for (const line of lines) longest = Math.max(longest, sumMain(line) + Math.max(0, line.length - 1) * packedGap);
    mainSize = frameSize(frame, MAIN, longest + mainPad, true);
  } else {
    for (const line of lines) {
      const fillers = line.filter((i) => i.fillMain);
      if (!fillers.length) continue;
      const rest = line.filter((i) => !i.fillMain);
      fill(fillers, MAIN, mainSize - mainPad - sumMain(rest) - Math.max(0, line.length - 1) * packedGap);
      for (const item of fillers) {
        item.forced[MAIN] = item.main;
        // The filled length can change what the item hugs across the stack (wrapping content).
        const size = measure(item.node, item.forced.width, item.forced.height);
        item.cross = limit(item.node, CROSS, size[CROSS]);
        setSize(item, MAIN, item.main);
        setSize(item, CROSS, item.cross);
      }
    }
  }

  // 4. Size across the stack: each line is as thick as its thickest item that doesn't stretch.
  // A single line in a frame of known size spans the whole inner height (or width).
  const extents = !wrap && !hugCross ? [0] : lines.map((line) => lineExtent(line, measure, CROSS));
  const crossSize = hugCross
    ? frameSize(frame, CROSS, total(extents) + Math.max(0, lines.length - 1) * lineGap + crossPad, true)
    : frameSize(frame, CROSS, given[CROSS] ?? frame[CROSS], false);
  if (!wrap) extents[0] = Math.max(0, crossSize - crossPad);

  // 5. Stretch the remaining Fill items across their line (in wrapped or hugging frames).
  let remeasured = false;
  for (const [li, line] of lines.entries()) {
    for (const item of line) {
      if (!item.fillCross || knownCross !== undefined) continue;
      item.cross = computedSize(item.node, CROSS, extents[li] as number);
      item.forced[CROSS] = item.cross;
      setSize(item, CROSS, item.cross);
      if (!item.fillMain) {
        // What an item hugs along the stack can depend on its stretched size, so it is measured again.
        const size = measure(item.node, item.forced.width, item.forced.height);
        const main = limit(item.node, MAIN, size[MAIN]);
        remeasured ||= main !== item.main;
        item.main = main;
        setSize(item, MAIN, main);
      }
    }
  }
  // A hugging frame follows. (Known limit: Fill siblings and line breaks are not redone for
  // this rare case, wrapped content inside a child stretched across a hugging or wrapping frame.)
  if (remeasured && hugMain) {
    let longest = 0;
    for (const line of lines) longest = Math.max(longest, sumMain(line) + Math.max(0, line.length - 1) * packedGap);
    mainSize = frameSize(frame, MAIN, longest + mainPad, true);
  }

  // 6. Positions.
  const boxes = new Map<NodeId, Box>();
  const forced = new Map<NodeId, Forced>();
  const innerMain = mainSize - mainPad;
  const innerCross = crossSize - crossPad;
  const lineTotal = total(extents) + Math.max(0, lines.length - 1) * lineGap;
  let lineCursor = crossStart + (innerCross - lineTotal) * crossFactor;
  let between = lineGap;
  if (wrap && lines.length > 1 && frame.counterAxisAlignContent === "SPACE_BETWEEN") {
    lineCursor = crossStart;
    between = Math.max(0, innerCross - total(extents)) / (lines.length - 1);
  }
  for (const [li, line] of lines.entries()) {
    const extent = extents[li] as number;
    const free = innerMain - sumMain(line) - Math.max(0, line.length - 1) * packedGap;
    const { start, step } = distribute(align, free, line.length, packedGap);
    let cursor = mainStart + start;
    for (const item of line) {
      const across = lineCursor + (extent - item.cross) * crossFactor;
      const sx = horizontal ? cursor : across;
      const sy = horizontal ? across : cursor;
      const b = rotatedBounds(item.width, item.height, item.node.rotation);
      boxes.set(item.node.id, { x: sx - b.x, y: sy - b.y, width: item.width, height: item.height });
      if (item.forced.width !== undefined || item.forced.height !== undefined) forced.set(item.node.id, item.forced);
      cursor += item.main + step;
    }
    lineCursor += extent + between;
  }

  return horizontal
    ? { width: mainSize, height: crossSize, children: boxes, forced }
    : { width: crossSize, height: mainSize, children: boxes, forced };

  function natural(item: Item, size: Size): void {
    item.width = limit(item.node, "width", size.width);
    item.height = limit(item.node, "height", size.height);
    const b = item.upright ? { width: item.width, height: item.height } : rotatedBounds(item.width, item.height, item.node.rotation);
    item.main = b[MAIN];
    item.cross = b[CROSS];
  }
}

function setSize(item: Item, axis: Axis, value: number): void {
  if (axis === "width") item.width = value;
  else item.height = value;
}

/**
 * A line's thickness: its thickest item that doesn't stretch across. When
 * every item stretches, the thickest natural size of them all.
 */
function lineExtent(line: readonly Item[], measure: Measure, CROSS: Axis): number {
  let extent = 0;
  let firm = false;
  for (const item of line) {
    if (item.fillCross) continue;
    extent = firm ? Math.max(extent, item.cross) : item.cross;
    firm = true;
  }
  if (firm) return extent;
  for (const item of line) {
    const size = measure(item.node, item.forced.width, item.forced.height);
    extent = Math.max(extent, limit(item.node, CROSS, size[CROSS]));
  }
  return extent;
}

function sumMain(items: readonly Item[]): number {
  let s = 0;
  for (const item of items) s += item.main;
  return s;
}

function total(values: readonly number[]): number {
  let s = 0;
  for (const v of values) s += v;
  return s;
}

/**
 * Share `available` among Fill items along `axis`, the way CSS flexbox does
 * with equal flex-grow and a zero basis: equal content boxes (each item's
 * own padding comes on top), then items that hit a min or max are frozen at
 * it and the rest is shared again.
 */
function fill(items: Item[], axis: Axis, available: number): void {
  let open = items;
  let free = available;
  while (open.length) {
    let pads = 0;
    for (const item of open) pads += insets(item.node, axis);
    const share = (free - pads) / open.length;
    const targets = open.map((item) => insets(item.node, axis) + share);
    const sizes = open.map((item, i) => computedSize(item.node, axis, targets[i] as number));
    let violation = 0;
    for (const [i, size] of sizes.entries()) violation += size - (targets[i] as number);
    if (Math.abs(violation) < 1e-9) {
      for (const [i, item] of open.entries()) item.main = sizes[i] as number;
      return;
    }
    // Freeze the items that hit a min (when the total grew) or a max (when it shrank), then share again.
    const next: Item[] = [];
    for (const [i, item] of open.entries()) {
      const size = sizes[i] as number;
      const target = targets[i] as number;
      if ((violation > 0 && size > target) || (violation < 0 && size < target)) {
        item.main = size;
        free -= size;
      } else next.push(item);
    }
    open = next;
  }
}

/** Where the first item starts and the step between items, for the primary axis alignment. */
function distribute(align: PrimaryAxisAlign, free: number, count: number, gap: number): { start: number; step: number } {
  // Auto gaps are never negative: overflowing items start at the leading edge.
  const room = Math.max(0, free);
  switch (align) {
    case "SPACE_BETWEEN":
      return { start: 0, step: count > 1 ? room / (count - 1) : 0 };
    case "SPACE_AROUND":
      return { start: count ? room / count / 2 : 0, step: count ? room / count : 0 };
    case "SPACE_EVENLY":
      return { start: room / (count + 1), step: room / (count + 1) };
    default:
      return { start: free * FACTOR[align], step: gap };
  }
}
