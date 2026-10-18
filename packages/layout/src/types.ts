import type { Constraints, Node, NodeId } from "@illigma/format";

/** A size in pixels. */
export interface Size {
  width: number;
  height: number;
}

/** A node's position (relative to its parent) and size: its `x`, `y`, `width` and `height` fields. */
export interface Box extends Size {
  x: number;
  y: number;
}

/**
 * The node fields layout reads. A `@illigma/core` document's frozen nodes fit
 * this type. Paints, effects and vector geometry are left out: layout never reads them,
 * and core freezes them deeply.
 */
export type LayoutNode = Readonly<Omit<Node, "fills" | "strokes" | "constraints" | "vectorNetwork" | "effects">> & {
  readonly constraints?: Readonly<Constraints>;
};

/**
 * Read access to a document. `@illigma/core`'s `Document` fits this shape,
 * so layout can read a document (even in the middle of a transaction) without
 * depending on the document model.
 */
export interface LayoutReader {
  get(id: NodeId): LayoutNode | undefined;
  /** Children of `id` in order (first = bottom of the stack). */
  children(id: NodeId): readonly LayoutNode[];
}

/** One field value layout wants changed. Apply each with `tx.set(id, key, value)` inside `Document.transact`. */
export interface LayoutChange {
  id: NodeId;
  key: "x" | "y" | "width" | "height";
  value: number;
}
