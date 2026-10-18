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

export type Node = NodeBase & TextFields;

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
