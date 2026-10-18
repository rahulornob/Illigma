/**
 * Layout for a whole document. Layout only reads the document and returns
 * the field values that should change; the caller applies them in the same
 * `Document.transact` as the edit that caused them, so one undo reverts both:
 *
 *   doc.transact("Change padding", (tx) => {
 *     tx.set(frame, "paddingLeft", 24);
 *     for (const c of relayout(doc, [frame])) tx.set(c.id, c.key, c.value);
 *   });
 *
 * How it works: each changed node climbs to the outermost auto layout frame
 * it is nested in through auto layout parents (a "root"); a hugging frame
 * can grow its parent, which can grow its own parent, and so on. Each root is
 * then laid out top-down. Sizes come from `measure`, which hugs nested frames
 * bottom-up and is cached per node and forced size, so every frame is laid out
 * once or twice per run. Only nodes on the path to a change, or whose size
 * changed, are descended into; everything else was already laid out. When a
 * frame's size changes, children outside its auto layout flow (all children
 * of a plain frame, absolute children of an auto layout frame) follow their
 * constraints from the old size to the new one.
 */

import type { NodeId, VectorNetwork } from "@illigma/format";
import { FRAME_TYPES, frameSize, isAutoLayout, isInFlow, layoutFrame, layoutSizing, type Axis, type FrameLayout } from "./auto-layout.js";
import { applyConstraints } from "./constraints.js";
import { quarterTurns, rotatedBounds, roundLayout } from "./geometry.js";
import type { Box, LayoutChange, LayoutNode, LayoutReader, ReadonlyVectorNetwork, Size } from "./types.js";

export interface RelayoutOptions {
  /**
   * Lay out everything under the affected frames, not only the paths to the
   * changes. Use it once for content that was never laid out (an import).
   */
  deep?: boolean;
}

/**
 * The changes that bring the layout up to date after `changed` nodes changed.
 * Pass every node whose size, position, visibility, order or layout settings
 * changed, plus the parent of any node that was created, deleted or moved
 * (`changedIds` collects these from a transaction's operations). Ids that no
 * longer exist are skipped. Same document and ids, same result.
 *
 * Use `resize` instead for a user resizing a frame: constraints need the
 * frame's size before the resize, which the document no longer has afterwards.
 */
export function relayout(doc: LayoutReader, changed: Iterable<NodeId>, options: RelayoutOptions = {}): LayoutChange[] {
  return new Engine(doc, new Map(), new Set(), options.deep ?? false).run(changed);
}

export interface ResizeOptions {
  /** false: children keep their positions and sizes (Figma: hold Cmd or Ctrl while resizing). Default true. */
  constraints?: boolean;
}

/**
 * Figma's `resize`: the changes for giving node `id` a new box, including the
 * node's own fields, its children following their constraints, and every auto
 * layout that reflows as a result. Fields left out of `box` keep their value.
 *
 * A child of an auto layout frame keeps the position its parent gives it, and
 * a Fill or Hug axis keeps its computed size: set `layoutSizingHorizontal` or
 * `Vertical` to "FIXED" first, in the same transaction, as Figma does when a
 * user resizes such a layer.
 */
export function resize(doc: LayoutReader, id: NodeId, box: Partial<Box>, options: ResizeOptions = {}): LayoutChange[] {
  return resizeMany(doc, [{ id, box }], options);
}

/** One node and its new box, for `resizeMany`. */
export interface ResizeEntry {
  id: NodeId;
  box: Partial<Box>;
}

/**
 * `resize` for many nodes at once, in one layout pass: resizing N children
 * of one auto layout frame costs one layout of that frame, not N. All boxes
 * apply together: constraints work from the sizes before any of them (a
 * resized node inside another resized frame follows its constraints on the
 * axes its own box leaves out), and auto layout reflows once around all of
 * them. A later entry for the same node merges over an earlier one.
 */
export function resizeMany(doc: LayoutReader, entries: Iterable<ResizeEntry>, options: ResizeOptions = {}): LayoutChange[] {
  const overlay = new Map<NodeId, Partial<Box>>();
  for (const { id, box } of entries) overlay.set(id, { ...overlay.get(id), ...box });
  const ignore = new Set<NodeId>(options.constraints === false ? overlay.keys() : []);
  return new Engine(doc, overlay, ignore, false).run(overlay.keys());
}

/** The shape of a `@illigma/core` operation, as far as `changedIds` needs it. */
export type OperationLike =
  | { readonly op: "create" | "delete"; readonly node: { readonly id: NodeId; readonly parentId: NodeId | null } }
  | { readonly op: "set"; readonly id: NodeId; readonly key: string; readonly value: unknown; readonly prev: unknown };

/** Node fields whose change can move or resize layers. */
export const LAYOUT_KEYS: ReadonlySet<string> = new Set([
  "parentId", "index", "visible", "x", "y", "width", "height", "rotation",
  "layoutMode", "itemSpacing", "counterAxisSpacing", "paddingLeft", "paddingRight", "paddingTop", "paddingBottom",
  "primaryAxisAlignItems", "counterAxisAlignItems", "counterAxisAlignContent", "primaryAxisSizingMode", "counterAxisSizingMode",
  "layoutWrap", "layoutPositioning", "layoutSizingHorizontal", "layoutSizingVertical",
  "minWidth", "maxWidth", "minHeight", "maxHeight",
]);

/** The ids to pass to `relayout` after `ops` (e.g. a `Change`'s operations), in first-seen order. */
export function changedIds(ops: Iterable<OperationLike>): NodeId[] {
  const ids = new Set<NodeId>();
  const add = (id: unknown) => {
    if (typeof id === "string") ids.add(id);
  };
  for (const o of ops) {
    if (o.op === "set") {
      if (!LAYOUT_KEYS.has(o.key)) continue;
      add(o.id);
      // A move changes both the old and the new parent's layout.
      if (o.key === "parentId") {
        add(o.prev);
        add(o.value);
      }
    } else {
      if (o.op === "create") add(o.node.id);
      add(o.node.parentId);
    }
  }
  return [...ids];
}

const KEYS = ["x", "y", "width", "height"] as const;

class Engine {
  readonly #doc: LayoutReader;
  /** Box values that replace the document's (the resized node), before anything is written. */
  readonly #overlay: Map<NodeId, Partial<Box>>;
  /** Nodes whose children don't follow constraints this run. */
  readonly #ignore: Set<NodeId>;
  readonly #deep: boolean;
  /** Changed nodes and all their ancestors: the paths layout must walk down. */
  readonly #dirty = new Set<NodeId>();
  readonly #flows = new Map<string, FrameLayout>();
  readonly #out = new Map<NodeId, Box>();

  constructor(doc: LayoutReader, overlay: Map<NodeId, Partial<Box>>, ignore: Set<NodeId>, deep: boolean) {
    this.#doc = doc;
    this.#overlay = overlay;
    this.#ignore = ignore;
    this.#deep = deep;
  }

  run(changed: Iterable<NodeId>): LayoutChange[] {
    const roots = new Set<NodeId>();
    for (const id of changed) {
      const node = this.#node(id);
      if (!node) continue;
      for (let cur: LayoutNode | undefined = node; cur && !this.#dirty.has(cur.id); cur = this.#parent(cur)) this.#dirty.add(cur.id);
      // Climb while the parent is an auto layout frame: its layout depends on this node.
      let root = node;
      for (let p = this.#parent(root); p && isAutoLayout(p); p = this.#parent(root)) root = p;
      roots.add(root.id);
    }
    // A root inside another root is laid out with it. Sorted, so input order never matters.
    const outer = [...roots].filter((id) => !this.#insideAny(id, roots)).sort();
    for (const id of outer) {
      const n = this.#node(id) as LayoutNode;
      this.#place(n, { x: n.x, y: n.y, ...this.#measure(n, undefined, undefined) }, undefined, undefined);
    }

    const changes: LayoutChange[] = [];
    for (const [id, box] of this.#out) {
      const raw = this.#doc.get(id) as LayoutNode;
      for (const key of KEYS) if (box[key] !== raw[key]) changes.push({ id, key, value: box[key] });
      // A vector's network is in its own space: it scales with the node.
      const net = raw.vectorNetwork && scaleVectorNetwork(raw.vectorNetwork, raw, box);
      if (net) changes.push({ id, key: "vectorNetwork", value: net });
    }
    return changes;
  }

  // ---- reading, with the overlay on top ----

  #node(id: NodeId): LayoutNode | undefined {
    const n = this.#doc.get(id);
    return n && this.#with(n);
  }

  #with(n: LayoutNode): LayoutNode {
    const o = this.#overlay.get(n.id);
    return o ? { ...n, ...o } : n;
  }

  #kids(id: NodeId): readonly LayoutNode[] {
    const kids = this.#doc.children(id);
    return this.#overlay.size ? kids.map((k) => this.#with(k)) : kids;
  }

  #parent(n: LayoutNode): LayoutNode | undefined {
    return n.parentId === null ? undefined : this.#node(n.parentId);
  }

  #insideAny(id: NodeId, roots: Set<NodeId>): boolean {
    let n = this.#node(id);
    let steps = 0;
    for (n = n && this.#parent(n); n && steps < 1e6; n = this.#parent(n), steps++) if (roots.has(n.id)) return true;
    return false;
  }

  // ---- measuring ----

  /** A forced size that equals what the node would be anyway is dropped, so cached layouts are reused. */
  #spec(n: LayoutNode, axis: Axis, forced: number | undefined): number | undefined {
    return forced !== undefined && forced === n[axis] && layoutSizing(n, axis, false) !== "HUG" ? undefined : forced;
  }

  /** `n`'s size with the forced width and/or height (`undefined`: its own sizing, hugging if it hugs). */
  #measure(n: LayoutNode, width: number | undefined, height: number | undefined): Size {
    if (!isAutoLayout(n)) return { width: width ?? n.width, height: height ?? n.height };
    // Nothing in this frame changed and it keeps its size: its last layout still holds.
    const same = (width === undefined || width === n.width) && (height === undefined || height === n.height);
    if (same && !this.#deep && !this.#dirty.has(n.id) && !this.#overlay.has(n.id)) return { width: n.width, height: n.height };
    const fw = this.#spec(n, "width", width);
    const fh = this.#spec(n, "height", height);
    const hugW = fw === undefined && layoutSizing(n, "width", false) === "HUG";
    const hugH = fh === undefined && layoutSizing(n, "height", false) === "HUG";
    // Fixed on both axes: no need to look at the children.
    if (!hugW && !hugH) return { width: frameSize(n, "width", fw ?? n.width, false), height: frameSize(n, "height", fh ?? n.height, false) };
    const lay = this.#flow(n, fw, fh);
    return { width: lay.width, height: lay.height };
  }

  #flow(n: LayoutNode, width: number | undefined, height: number | undefined): FrameLayout {
    const fw = this.#spec(n, "width", width);
    const fh = this.#spec(n, "height", height);
    const key = `${n.id} ${fw} ${fh}`;
    let lay = this.#flows.get(key);
    if (!lay) {
      lay = layoutFrame(n, this.#kids(n.id), { width: fw, height: fh, measure: (c, w, h) => this.#measure(c, w, h) });
      this.#flows.set(key, lay);
    }
    return lay;
  }

  // ---- placing ----

  /** Record `box` (rounded, see `roundLayout`) as `id`'s new box. Returns the rounded box. */
  #record(id: NodeId, unrounded: Box): Box {
    const raw = this.#doc.get(id) as LayoutNode;
    // Only computed values are rounded: a value layout leaves as it is stays exactly as stored.
    const box = roundBox(unrounded, raw);
    if (box.x !== raw.x || box.y !== raw.y || box.width !== raw.width || box.height !== raw.height) this.#out.set(id, box);
    else this.#out.delete(id);
    return box;
  }

  /** Give `n` its final box (from its parent), then lay out its children if anything they depend on changed. */
  #place(n: LayoutNode, unrounded: Box, width: number | undefined, height: number | undefined): void {
    const raw = this.#doc.get(n.id) as LayoutNode;
    // Children follow the size that is stored, so the next layout sees the same numbers.
    const box = this.#record(n.id, unrounded);
    const old: Size = { width: raw.width, height: raw.height };
    const resized = box.width !== old.width || box.height !== old.height;
    if (!this.#deep && !resized && !this.#dirty.has(n.id)) return;
    const kids = this.#kids(n.id);
    if (!kids.length) return;
    const constrain = FRAME_TYPES.has(n.type) && resized && !this.#ignore.has(n.id);

    if (isAutoLayout(n)) {
      const lay = this.#flow(n, width, height);
      for (const k of kids) {
        const b = lay.children.get(k.id);
        if (b) {
          const f = lay.forced.get(k.id);
          this.#place(k, b, f?.width, f?.height);
        } else if (k.layoutPositioning === "ABSOLUTE" && constrain) this.#constrain(k, old, box);
        else this.#keep(k); // hidden: it rejoins the flow when shown

      }
      return;
    }
    for (const k of kids) {
      if (constrain) this.#constrain(k, old, box);
      else this.#keep(k);
    }
  }

  /** A child that keeps its position; it still hugs its content. */
  #keep(k: LayoutNode): void {
    this.#place(k, { x: k.x, y: k.y, ...this.#measure(k, undefined, undefined) }, undefined, undefined);
  }

  /** A child following its constraints as its parent goes from `old` to `now` in size. */
  #constrain(k: LayoutNode, old: Size, now: Size): void {
    if (this.#isFlatGroup(k)) {
      this.#record(k.id, this.#constrainGroup(k, 0, 0, old, now));
      return;
    }
    const own = this.#overlay.get(k.id);
    if (own) {
      // Resized itself in the same pass (`resizeMany`): it follows its constraints from where it
      // was, then its own box wins on the fields it gives.
      const raw = this.#doc.get(k.id) as LayoutNode;
      const at = { ...applyConstraints(old, now, raw), ...own };
      const [box, fw, fh] = this.#constrained({ ...k, width: at.width, height: at.height }, at, now, now);
      this.#place(k, box, fw, fh);
      return;
    }
    const [box, fw, fh] = this.#constrained(k, k, old, now);
    this.#place(k, box, fw, fh);
  }

  /**
   * `k` constrained, where `at` holds its position in the constraining frame's
   * space. An auto layout frame keeps hugging on its Hug axes.
   */
  #constrained(k: LayoutNode, at: Box, old: Size, now: Size): [Box, number | undefined, number | undefined] {
    const box = applyConstraints(old, now, { x: at.x, y: at.y, width: k.width, height: k.height, rotation: k.rotation, ...(k.constraints && { constraints: k.constraints }) });
    if (!isAutoLayout(k)) return [box, undefined, undefined];
    const fw = layoutSizing(k, "width", false) === "HUG" ? undefined : box.width;
    const fh = layoutSizing(k, "height", false) === "HUG" ? undefined : box.height;
    const size = this.#measure(k, fw, fh);
    return [{ ...box, width: size.width, height: size.height }, fw, fh];
  }

  /** Groups take no constraints of their own (Figma): their layers follow the frame, then the group fits around them. */
  #isFlatGroup(k: LayoutNode): boolean {
    return k.type === "GROUP" && quarterTurns(k.rotation) === 0 && this.#doc.children(k.id).length > 0;
  }

  /**
   * Constrain the layers inside group `g` against the frame, then fit the
   * group around them. `ox`, `oy`: where `g`'s parent's origin sits in the
   * frame. Returns the group's new box relative to its parent.
   */
  #constrainGroup(g: LayoutNode, ox: number, oy: number, old: Size, now: Size): Box {
    const gx = ox + g.x;
    const gy = oy + g.y;
    const placed: { node: LayoutNode; box: Box; group: boolean; fw?: number | undefined; fh?: number | undefined }[] = [];
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const k of this.#kids(g.id)) {
      let entry: (typeof placed)[number];
      if (this.#isFlatGroup(k)) {
        const b = this.#constrainGroup(k, gx, gy, old, now);
        entry = { node: k, box: { ...b, x: b.x + gx, y: b.y + gy }, group: true };
      } else {
        const [box, fw, fh] = this.#constrained(k, { x: gx + k.x, y: gy + k.y, width: k.width, height: k.height }, old, now);
        entry = { node: k, box, group: false, fw, fh };
      }
      placed.push(entry);
      const b = rotatedBounds(entry.box.width, entry.box.height, entry.group ? 0 : k.rotation);
      x0 = Math.min(x0, entry.box.x + b.x);
      y0 = Math.min(y0, entry.box.y + b.y);
      x1 = Math.max(x1, entry.box.x + b.x + b.width);
      y1 = Math.max(y1, entry.box.y + b.y + b.height);
    }
    for (const p of placed) {
      const rel = { ...p.box, x: p.box.x - x0, y: p.box.y - y0 };
      if (p.group) this.#record(p.node.id, rel);
      else this.#place(p.node, rel, p.fw, p.fh);
    }
    return { x: x0 - ox, y: y0 - oy, width: x1 - x0, height: y1 - y0 };
  }
}

/** `b` rounded (`roundLayout`), except values equal to `raw`'s, which are kept exactly. */
const roundBox = (b: Box, raw: Box): Box => {
  const r = (key: keyof Box) => (b[key] === raw[key] ? raw[key] : roundLayout(b[key]));
  return { x: r("x"), y: r("y"), width: r("width"), height: r("height") };
};

/**
 * `net` (in a `from`-sized node's space) scaled to a `to`-sized node, or null
 * when the size is unchanged. An axis that was zero long (a straight vertical
 * or horizontal line) has nothing to scale and keeps its coordinates. Corner
 * radii keep their value, as in Figma.
 */
export function scaleVectorNetwork(net: ReadonlyVectorNetwork, from: Size, to: Size): VectorNetwork | null {
  const sx = from.width > 0 && to.width !== from.width ? to.width / from.width : 1;
  const sy = from.height > 0 && to.height !== from.height ? to.height / from.height : 1;
  if (sx === 1 && sy === 1) return null;
  const x = (v: number) => roundLayout(v * sx);
  const y = (v: number) => roundLayout(v * sy);
  return {
    vertices: net.vertices.map((v) => ({ ...v, x: x(v.x), y: y(v.y) })),
    segments: net.segments.map((s) => ({
      start: s.start,
      end: s.end,
      tangentStart: { x: x(s.tangentStart.x), y: y(s.tangentStart.y) },
      tangentEnd: { x: x(s.tangentEnd.x), y: y(s.tangentEnd.y) },
    })),
    regions: net.regions.map((r) => ({ windingRule: r.windingRule, loops: r.loops.map((l) => [...l]) })),
  };
}
