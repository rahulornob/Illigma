/**
 * The `.illigma` file schema, format version 0.
 *
 * A file is a flat list of nodes. Each node names its parent and carries a
 * fractional index that orders it among its siblings, so moving or inserting
 * a node never rewrites its neighbours.
 */

export const FORMAT_NAME = "illigma";
export const FORMAT_VERSION = 0;

export type NodeId = string;

/** Node ids also name page files (`pages/<id>.json`), so they stay short and file-name safe. */
export const NODE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export type NodeType =
  | "PAGE"
  | "SECTION"
  | "FRAME"
  | "GROUP"
  | "RECTANGLE"
  | "ELLIPSE"
  | "LINE"
  | "POLYGON"
  | "STAR"
  | "VECTOR"
  | "TEXT"
  | "COMPONENT"
  | "COMPONENT_SET"
  | "INSTANCE";

export const NODE_TYPES: readonly NodeType[] = [
  "PAGE",
  "SECTION",
  "FRAME",
  "GROUP",
  "RECTANGLE",
  "ELLIPSE",
  "LINE",
  "POLYGON",
  "STAR",
  "VECTOR",
  "TEXT",
  "COMPONENT",
  "COMPONENT_SET",
  "INSTANCE",
];

/** sRGB colour, each channel 0–1. */
export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface SolidPaint {
  type: "SOLID";
  color: Color;
  visible: boolean;
}

/** Version 0 stores solid paints. Gradients and images arrive in later versions. */
export type Paint = SolidPaint;

/** Fields every node has. */
export interface NodeBase {
  id: NodeId;
  type: NodeType;
  /** `null` only for pages. */
  parentId: NodeId | null;
  /** Fractional index among siblings; compare as plain strings. */
  index: string;
  name: string;
  visible: boolean;
  locked: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees, clockwise. */
  rotation: number;
  opacity: number;
  fills: Paint[];
  strokes: Paint[];
  strokeWeight: number;
  cornerRadius: number;
}

export interface TextFields {
  characters?: string;
  fontFamily?: string;
  fontStyle?: string;
  fontSize?: number;
  lineHeight?: number;
}

/** Auto layout direction. "NONE" is a plain frame whose children keep their own positions. */
export type LayoutMode = "NONE" | "HORIZONTAL" | "VERTICAL";
/** Placement along the stack. The SPACE_* values are Figma's "Auto" gap (Between, Around, Evenly). */
export type PrimaryAxisAlign = "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN" | "SPACE_AROUND" | "SPACE_EVENLY";
export type CounterAxisAlign = "MIN" | "CENTER" | "MAX";
/** How wrapped rows (or columns) share the frame's spare space across the stack. */
export type CounterAxisAlignContent = "AUTO" | "SPACE_BETWEEN";
/** "AUTO" hugs the content; "FIXED" keeps the stored size. */
export type AxisSizingMode = "FIXED" | "AUTO";
export type LayoutWrap = "NO_WRAP" | "WRAP";
/** "ABSOLUTE" takes a child out of its auto layout parent's flow ("Ignore auto layout"). */
export type LayoutPositioning = "AUTO" | "ABSOLUTE";
export type LayoutSizing = "FIXED" | "HUG" | "FILL";
/** MIN = left or top, MAX = right or bottom, STRETCH = both edges, SCALE = proportional. */
export type ConstraintType = "MIN" | "CENTER" | "MAX" | "STRETCH" | "SCALE";

export interface Constraints {
  horizontal: ConstraintType;
  vertical: ConstraintType;
}

export const LAYOUT_MODES: readonly LayoutMode[] = ["NONE", "HORIZONTAL", "VERTICAL"];
export const PRIMARY_AXIS_ALIGNS: readonly PrimaryAxisAlign[] = ["MIN", "CENTER", "MAX", "SPACE_BETWEEN", "SPACE_AROUND", "SPACE_EVENLY"];
export const COUNTER_AXIS_ALIGNS: readonly CounterAxisAlign[] = ["MIN", "CENTER", "MAX"];
export const COUNTER_AXIS_ALIGN_CONTENTS: readonly CounterAxisAlignContent[] = ["AUTO", "SPACE_BETWEEN"];
export const AXIS_SIZING_MODES: readonly AxisSizingMode[] = ["FIXED", "AUTO"];
export const LAYOUT_WRAPS: readonly LayoutWrap[] = ["NO_WRAP", "WRAP"];
export const LAYOUT_POSITIONINGS: readonly LayoutPositioning[] = ["AUTO", "ABSOLUTE"];
export const LAYOUT_SIZINGS: readonly LayoutSizing[] = ["FIXED", "HUG", "FILL"];
export const CONSTRAINT_TYPES: readonly ConstraintType[] = ["MIN", "CENTER", "MAX", "STRETCH", "SCALE"];

/**
 * Auto layout and constraints, named after Figma's Plugin API. Every field is
 * optional and an absent field means Figma's default (noted on each), so files
 * written before these fields existed read, and save, exactly as before.
 */
export interface LayoutFields {
  // ---- on a frame: its own auto layout ----
  /** Default "NONE". */
  layoutMode?: LayoutMode;
  /** Gap between children along the stack. May be negative, for overlapping stacks. Default 0. */
  itemSpacing?: number;
  /** Gap between wrapped rows or columns, 0 or more. Default: the same as `itemSpacing`, but never negative. */
  counterAxisSpacing?: number;
  /** Inner padding, 0 or more. Default 0 each. */
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  /** Default "MIN". */
  primaryAxisAlignItems?: PrimaryAxisAlign;
  /** Default "MIN". */
  counterAxisAlignItems?: CounterAxisAlign;
  /** Wrapped frames only. Default "AUTO". */
  counterAxisAlignContent?: CounterAxisAlignContent;
  /** Sizing along the stack. Default "AUTO" (hug), as in Figma's file format. */
  primaryAxisSizingMode?: AxisSizingMode;
  /** Sizing across the stack. Default "AUTO" (hug). */
  counterAxisSizingMode?: AxisSizingMode;
  /** Default "NO_WRAP". */
  layoutWrap?: LayoutWrap;

  // ---- on any node: how it sits in its parent ----
  /** Default "AUTO". */
  layoutPositioning?: LayoutPositioning;
  /**
   * Fixed, Hug contents or Fill container, per axis. When set, it wins over the
   * sizing modes above. Absent: "HUG" on an auto layout frame's AUTO axes, else "FIXED".
   */
  layoutSizingHorizontal?: LayoutSizing;
  layoutSizingVertical?: LayoutSizing;
  /** How the node follows its parent frame when that frame is resized. Default left and top (both "MIN"). */
  constraints?: Constraints;
  /** Size limits applied by auto layout, 0 or more. Default: no limit. */
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
}

export type Node = NodeBase & TextFields & LayoutFields;

/** The node fields an operation may change. `id` and `type` never change. */
export type NodeKey = Exclude<keyof Node, "id" | "type">;

export interface PageEntry {
  id: NodeId;
  name: string;
}

export interface Manifest {
  format: typeof FORMAT_NAME;
  version: number;
  fileId: string;
  name: string;
  /** Page order. Each page's nodes live in `pages/<id>.json`. */
  pages: PageEntry[];
  /** ISO 8601. */
  created: string;
  /** The app that last wrote the file, e.g. "Illigma 0.0.0". */
  app: string;
}

/** A whole file in memory: the manifest plus every node, pages included. */
export interface IlligmaFile {
  manifest: Manifest;
  nodes: Node[];
}

/** Defaults for a new node of any type. */
export function defaultNode(type: NodeType, id: NodeId, parentId: NodeId | null, index: string): Node {
  return {
    id,
    type,
    parentId,
    index,
    name: type === "PAGE" ? "Page" : type.charAt(0) + type.slice(1).toLowerCase().replace("_", " "),
    visible: true,
    locked: false,
    x: 0,
    y: 0,
    width: type === "PAGE" ? 0 : 100,
    height: type === "PAGE" ? 0 : 100,
    rotation: 0,
    opacity: 1,
    fills: [],
    strokes: [],
    strokeWeight: 1,
    cornerRadius: 0,
  };
}
