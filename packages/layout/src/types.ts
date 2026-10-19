import type { Constraints, Node, NodeId, VectorNetwork, WindingRule } from "@illigma/format";

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

/** A vector network as layout reads it: deeply read-only, so core's frozen nodes fit. */
export interface ReadonlyVectorNetwork {
  readonly vertices: readonly { readonly x: number; readonly y: number; readonly cornerRadius?: number }[];
  readonly segments: readonly {
    readonly start: number;
    readonly end: number;
    readonly tangentStart: { readonly x: number; readonly y: number };
    readonly tangentEnd: { readonly x: number; readonly y: number };
  }[];
  readonly regions: readonly { readonly windingRule: WindingRule; readonly loops: readonly (readonly number[])[] }[];
}

/**
 * The node fields layout reads. A `@illigma/core` document's frozen nodes fit
 * this type. Paints, effects and export settings are left out: layout never reads them, and
 * core freezes them deeply. A vector's network is read (deeply read-only) only
 * to scale it with the node when layout changes the node's size.
 */
export type LayoutNode = Readonly<Omit<Node, "fills" | "strokes" | "constraints" | "vectorNetwork" | "effects" | "exportSettings">> & {
  readonly constraints?: Readonly<Constraints>;
  readonly vectorNetwork?: ReadonlyVectorNetwork;
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

/**
 * One field value layout wants changed. Apply each with `tx.set(id, key, value)`
 * inside `Document.transact`. A vector whose size layout changes also gets its
 * `vectorNetwork` scaled to the new size: the network is in the node's own
 * space (0…width, 0…height).
 */
export type LayoutChange =
  | { id: NodeId; key: "x" | "y" | "width" | "height"; value: number }
  | { id: NodeId; key: "vectorNetwork"; value: VectorNetwork };
