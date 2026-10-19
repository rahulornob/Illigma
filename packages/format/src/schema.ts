/**
 * The `.illigma` file schema, format version 0.
 *
 * A file is a flat list of nodes. Each node names its parent and carries a
 * fractional index that orders it among its siblings, so moving or inserting
 * a node never rewrites its neighbours.
 */

import type { ComponentFields } from "./components.js";
import type { MaskGridFields } from "./guides-grids.js";

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
  | "BOOLEAN_OPERATION"
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
  "BOOLEAN_OPERATION",
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

/**
 * How a paint, a shadow or a whole layer mixes with what is under it: Figma's
 * list. PASS_THROUGH is for layers with children (they blend straight onto
 * what is under the layer, as if it had no layer of its own); on a paint or
 * a shape it means NORMAL.
 */
export type BlendMode =
  | "PASS_THROUGH"
  | "NORMAL"
  | "DARKEN"
  | "MULTIPLY"
  | "LINEAR_BURN"
  | "COLOR_BURN"
  | "LIGHTEN"
  | "SCREEN"
  | "LINEAR_DODGE"
  | "COLOR_DODGE"
  | "OVERLAY"
  | "SOFT_LIGHT"
  | "HARD_LIGHT"
  | "DIFFERENCE"
  | "EXCLUSION"
  | "HUE"
  | "SATURATION"
  | "COLOR"
  | "LUMINOSITY";

export const BLEND_MODES: readonly BlendMode[] = [
  "PASS_THROUGH",
  "NORMAL",
  "DARKEN",
  "MULTIPLY",
  "LINEAR_BURN",
  "COLOR_BURN",
  "LIGHTEN",
  "SCREEN",
  "LINEAR_DODGE",
  "COLOR_DODGE",
  "OVERLAY",
  "SOFT_LIGHT",
  "HARD_LIGHT",
  "DIFFERENCE",
  "EXCLUSION",
  "HUE",
  "SATURATION",
  "COLOR",
  "LUMINOSITY",
];

/**
 * An affine 2 × 3 matrix, `[[a, c, e], [b, d, f]]`, as in Figma's Plugin API:
 * (x, y) maps to (a·x + c·y + e, b·x + d·y + f).
 */
export type Transform = [[number, number, number], [number, number, number]];

/** Fields every paint may have. */
export interface PaintBase {
  visible: boolean;
  /** Multiplies the paint's alpha, 0–1. Default 1. */
  opacity?: number;
  /** How the paint mixes with the paints under it in the same layer. Default "NORMAL". */
  blendMode?: BlendMode;
}

export interface SolidPaint extends PaintBase {
  type: "SOLID";
  color: Color;
}

export type GradientType = "GRADIENT_LINEAR" | "GRADIENT_RADIAL" | "GRADIENT_ANGULAR" | "GRADIENT_DIAMOND";
export const GRADIENT_TYPES: readonly GradientType[] = ["GRADIENT_LINEAR", "GRADIENT_RADIAL", "GRADIENT_ANGULAR", "GRADIENT_DIAMOND"];

export interface ColorStop {
  /** 0–1 along the gradient. */
  position: number;
  color: Color;
}

/**
 * A gradient, as in Figma. `gradientTransform` maps the node's box,
 * normalised to 0…1 on both axes, into gradient space, where:
 * - linear runs from (0, 0.5) to (1, 0.5);
 * - radial is centred on (0.5, 0.5) and reaches the last stop at a distance of 0.5;
 * - angular sweeps clockwise around (0.5, 0.5), starting towards (1, 0.5);
 * - diamond is centred on (0.5, 0.5) and reaches the last stop where |dx| + |dy| = 0.5.
 * The identity is a left-to-right gradient across the whole box.
 */
export interface GradientPaint extends PaintBase {
  type: GradientType;
  /** At least one stop; drawn in position order. */
  gradientStops: ColorStop[];
  gradientTransform: Transform;
}

/** FILL covers the box (cropping), FIT fits inside it, CROP uses `imageTransform`, TILE repeats at `scalingFactor`. */
export type ImageScaleMode = "FILL" | "FIT" | "CROP" | "TILE";
export const IMAGE_SCALE_MODES: readonly ImageScaleMode[] = ["FILL", "FIT", "CROP", "TILE"];

/**
 * An image, stored once per file in `images/<imageHash>.<ext>` (see
 * `IlligmaFile.images`). `imageHash` is the SHA-256 of the image file's bytes,
 * in lowercase hex; `null` is an image paint with no image yet.
 */
export interface ImagePaint extends PaintBase {
  type: "IMAGE";
  imageHash: string | null;
  scaleMode: ImageScaleMode;
  /** CROP only: maps the node's box, normalised to 0…1, into the image, also normalised. Default: the identity (the image stretched over the box). */
  imageTransform?: Transform;
  /** TILE only: the size of one tile as a multiple of the image's own size in pixels. Default 1. */
  scalingFactor?: number;
}

export type Paint = SolidPaint | GradientPaint | ImagePaint;
export type PaintType = Paint["type"];
export const PAINT_TYPES: readonly PaintType[] = ["SOLID", ...GRADIENT_TYPES, "IMAGE"];

/**
 * Shadows, as in Figma. `radius` is the blur radius (CSS `box-shadow` blur:
 * twice the Gaussian standard deviation); `spread` grows (or, negative,
 * shrinks) the shape before it is blurred.
 */
export interface ShadowEffect {
  type: "DROP_SHADOW" | "INNER_SHADOW";
  color: Color;
  offset: Vector2;
  /** 0 or more. */
  radius: number;
  /** Default 0. */
  spread?: number;
  visible: boolean;
  /** Default "NORMAL". */
  blendMode?: BlendMode;
  /** DROP_SHADOW only: also show the shadow through the layer's transparent parts. Default false. */
  showShadowBehindNode?: boolean;
}

/** LAYER_BLUR blurs the layer itself; BACKGROUND_BLUR blurs what is behind it, seen through its fills. */
export interface BlurEffect {
  type: "LAYER_BLUR" | "BACKGROUND_BLUR";
  /** 0 or more, as for shadows. */
  radius: number;
  visible: boolean;
}

export type Effect = ShadowEffect | BlurEffect;
export type EffectType = Effect["type"];
export const EFFECT_TYPES: readonly EffectType[] = ["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"];

/** Where a stroke sits on the outline. See `EffectFields.strokeAlign` for the default. */
export type StrokeAlign = "CENTER" | "INSIDE" | "OUTSIDE";
export const STROKE_ALIGNS: readonly StrokeAlign[] = ["CENTER", "INSIDE", "OUTSIDE"];

/** Limits on paints and effects, so a file can't make the editor run out of memory or time. */
export const PAINT_LIMITS = {
  /** Fills, or strokes, on one node. */
  maxPaints: 1_000,
  maxGradientStops: 1_000,
  maxEffects: 100,
  /** Shadow and blur radius, |spread| and |offset|, in canvas units. */
  maxEffectRadius: 1_000,
  /** TILE scale. */
  maxScalingFactor: 1_000,
} as const;

/** The image file formats a package may hold, by file extension. */
export type ImageFormat = "png" | "jpg" | "webp" | "gif";
export const IMAGE_FORMATS: readonly ImageFormat[] = ["png", "jpg", "webp", "gif"];

export const IMAGE_LIMITS = {
  /** One image file, in bytes. */
  maxBytes: 32 * 1024 * 1024,
  /**
   * Pixels a side. A small file can hold a huge picture (a 1.5 MB PNG of
   * 20,000 × 20,000 pixels decodes to 1.6 GB), so the size in pixels is
   * capped too, before anything decodes it.
   */
  maxSide: 16_384,
  /** Pixels in all (64 megapixels, 256 MB decoded). */
  maxPixels: 64 * 1024 * 1024,
} as const;

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

/**
 * How a text layer's box follows its text (Figma's `textAutoResize`):
 * "WIDTH_AND_HEIGHT" grows on one line ("Auto width"), "HEIGHT" wraps at its
 * width and grows down ("Auto height"), "NONE" keeps its box ("Fixed size"),
 * "TRUNCATE" keeps its box and ends the last line that fits with "…".
 */
export type TextAutoResize = "NONE" | "WIDTH_AND_HEIGHT" | "HEIGHT" | "TRUNCATE";
export type TextAlignHorizontal = "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
export type TextAlignVertical = "TOP" | "CENTER" | "BOTTOM";
/** Space added between letters: pixels, or a percentage of the font size (Figma's `LetterSpacing`). */
export interface LetterSpacing {
  value: number;
  unit: "PIXELS" | "PERCENT";
}
/** Line height: pixels, a percentage of the font size, or the font's own ("AUTO"), as Figma's `LineHeight`. */
export type LineHeight = { value: number; unit: "PIXELS" | "PERCENT" } | { unit: "AUTO" };

export const TEXT_AUTO_RESIZES: readonly TextAutoResize[] = ["NONE", "WIDTH_AND_HEIGHT", "HEIGHT", "TRUNCATE"];
export const TEXT_ALIGN_HORIZONTALS: readonly TextAlignHorizontal[] = ["LEFT", "CENTER", "RIGHT", "JUSTIFIED"];
export const TEXT_ALIGN_VERTICALS: readonly TextAlignVertical[] = ["TOP", "CENTER", "BOTTOM"];
/** Largest font size, line height and letter spacing (in pixels or percent) a file may hold. */
export const MAX_TEXT_METRIC = 10_000;

/**
 * Text fields. `textAutoResize`, `textAlignHorizontal`, `textAlignVertical`
 * and `letterSpacing` are optional (Figma Plugin API names); absent means
 * how format 0 drew text: a fixed box ("NONE", as format 0 wrapped text at
 * its width), left and top aligned, no letter spacing. The editor sets
 * `textAutoResize` on the text layers it creates.
 */
export interface TextFields {
  characters?: string;
  fontFamily?: string;
  fontStyle?: string;
  fontSize?: number;
  /** A number is pixels (format 0); absent means "AUTO". */
  lineHeight?: number | LineHeight;
  letterSpacing?: LetterSpacing;
  textAutoResize?: TextAutoResize;
  textAlignHorizontal?: TextAlignHorizontal;
  textAlignVertical?: TextAlignVertical;
}

/** A text layer's line height in pixels, or null for the font's own ("AUTO"). */
export function lineHeightPx(n: Pick<TextFields, "lineHeight" | "fontSize">): number | null {
  const lh = n.lineHeight;
  if (lh === undefined) return null;
  if (typeof lh === "number") return lh > 0 ? lh : null;
  if (lh.unit === "AUTO") return null;
  const px = lh.unit === "PIXELS" ? lh.value : ((n.fontSize ?? 12) * lh.value) / 100;
  return px > 0 ? px : null;
}

/** A text layer's letter spacing in pixels (0 when absent). */
export function letterSpacingPx(n: Pick<TextFields, "letterSpacing" | "fontSize">): number {
  const ls = n.letterSpacing;
  if (!ls) return 0;
  return ls.unit === "PIXELS" ? ls.value : ((n.fontSize ?? 12) * ls.value) / 100;
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

/** A point or a direction, in the node's own coordinate space. */
export interface Vector2 {
  x: number;
  y: number;
}

/** A point of a vector network. */
export interface VectorVertex {
  x: number;
  y: number;
  /** Rounds the corner at this point, 0 or more. Default 0. */
  cornerRadius?: number;
  /** The cap where a stroke ends at this point (a free end), overriding the node's `strokeCap`. Default: the node's. */
  strokeCap?: StrokeCap;
}

/**
 * A straight or curved (cubic Bézier) edge between two vertices. The
 * tangents are the Bézier handles, relative to their vertex: `tangentStart`
 * from `start`, `tangentEnd` from `end`. Both { x: 0, y: 0 } is a straight line.
 */
export interface VectorSegment {
  /** Vertex index. */
  start: number;
  /** Vertex index. May equal `start` (a closed curve through one point). */
  end: number;
  tangentStart: Vector2;
  tangentEnd: Vector2;
}

export type WindingRule = "NONZERO" | "EVENODD";
export const WINDING_RULES: readonly WindingRule[] = ["NONZERO", "EVENODD"];

/** A filled area: one or more closed loops of segments (outer edges and holes), filled by its winding rule. */
export interface VectorRegion {
  windingRule: WindingRule;
  /** Each loop lists segment indices that join end to end and close. */
  loops: number[][];
}

/**
 * Figma's vector network: points joined by straight or curved segments,
 * which may branch, with filled regions. Coordinates are in the node's own
 * space (0…width, 0…height), so resizing the node rewrites the network.
 */
export interface VectorNetwork {
  vertices: VectorVertex[];
  segments: VectorSegment[];
  regions: VectorRegion[];
}

/** Line ends. Arrow caps draw an open arrow head (two lines) or a filled triangle at the end, as in Figma. */
export type StrokeCap = "NONE" | "ROUND" | "SQUARE" | "ARROW_LINES" | "ARROW_EQUILATERAL";
export type StrokeJoin = "MITER" | "BEVEL" | "ROUND";
export const STROKE_CAPS: readonly StrokeCap[] = ["NONE", "ROUND", "SQUARE", "ARROW_LINES", "ARROW_EQUILATERAL"];

/** How a BOOLEAN_OPERATION combines its children (Figma's `booleanOperation`). */
export type BooleanOperation = "UNION" | "INTERSECT" | "SUBTRACT" | "EXCLUDE";
export const BOOLEAN_OPERATIONS: readonly BooleanOperation[] = ["UNION", "INTERSECT", "SUBTRACT", "EXCLUDE"];
export const STROKE_JOINS: readonly StrokeJoin[] = ["MITER", "BEVEL", "ROUND"];

/** Limits on one vector network, so a file can't make the editor run out of memory. */
export const VECTOR_LIMITS = {
  maxVertices: 100_000,
  maxSegments: 100_000,
  maxRegions: 10_000,
  /** Segment references across all of a network's loops. */
  maxLoopEntries: 200_000,
} as const;

/** Polygon sides and star points: Figma's polygon and star tools allow 3 to 60; files may hold up to this. */
export const MAX_POINT_COUNT = 1_000;
/** Figma's defaults for nodes that don't store these fields. */
export const DEFAULT_POLYGON_POINTS = 3;
export const DEFAULT_STAR_POINTS = 5;
export const DEFAULT_STAR_INNER_RADIUS = 0.382;

/**
 * Shape geometry, named after Figma's Plugin API. Every field is optional:
 * absent means Figma's default, so files without them save exactly as before.
 */
export interface ShapeFields {
  /** VECTOR: the outline. Absent: an empty vector, which draws nothing. */
  vectorNetwork?: VectorNetwork;
  /** POLYGON sides or STAR points, a whole number from 3. Default 3 (polygon) or 5 (star). */
  pointCount?: number;
  /** STAR: inner points' distance from the centre, as a fraction (0–1) of the outer. Default 0.382. */
  innerRadius?: number;
  /** Ends of open paths and lines. Default "NONE". */
  strokeCap?: StrokeCap;
  /** Corners of strokes. Default "MITER". */
  strokeJoin?: StrokeJoin;
  /** BOOLEAN_OPERATION: how its children (the operands, bottom first) combine. Default "UNION". */
  booleanOperation?: BooleanOperation;
}

/**
 * Effects and compositing, named after Figma's Plugin API. Every field is
 * optional; absent means the default noted on each, so files without them
 * save exactly as before.
 */
export interface EffectFields {
  /** Shadows and blurs, bottom first. Default none. */
  effects?: Effect[];
  /** How the layer mixes with what is under it. Default "PASS_THROUGH" (the same as "NORMAL" on a layer without children). */
  blendMode?: BlendMode;
  /**
   * Where strokes sit on the outline. Absent means "CENTER": format 0 drew
   * every stroke centred before this field existed, so that stays the reading
   * of older files. (Figma's default for new shapes is "INSIDE"; the editor
   * sets it explicitly.) Lines and open paths are always stroked centred.
   */
  strokeAlign?: StrokeAlign;
}

/** Export file formats (Figma's `ExportSettings.format`). */
export type ExportFormat = "PNG" | "JPG" | "SVG" | "PDF";
export const EXPORT_FORMATS: readonly ExportFormat[] = ["PNG", "JPG", "SVG", "PDF"];

/** How a PNG or JPG export is sized: a multiplier (`2x`), or a fixed width (`512w`) or height (`512h`) in pixels. */
export interface ExportSettingsConstraints {
  type: "SCALE" | "WIDTH" | "HEIGHT";
  value: number;
}
export const EXPORT_CONSTRAINT_TYPES: readonly ExportSettingsConstraints["type"][] = ["SCALE", "WIDTH", "HEIGHT"];

interface ExportSettingsCommon {
  /** Added to the file name before the extension, e.g. "@2x". Default "". */
  suffix?: string;
  /** true (default): only the layer and its children. false: everything on the page inside its bounds. */
  contentsOnly?: boolean;
  /** false (default): the bounds of what the layer draws. true: the layer's own box. */
  useAbsoluteBounds?: boolean;
}

export interface ExportSettingsImage extends ExportSettingsCommon {
  format: "PNG" | "JPG";
  /** Default { type: "SCALE", value: 1 }. */
  constraint?: ExportSettingsConstraints;
  /** JPG only (Illigma's addition): 0 (smallest) to 100 (best). Default 90. */
  quality?: number;
}

export interface ExportSettingsSVG extends ExportSettingsCommon {
  format: "SVG";
  /** Text as outlines. Default false. */
  svgOutlineText?: boolean;
  /** Layer names as `id` attributes. Default false. */
  svgIdAttribute?: boolean;
  /** Default true. */
  svgSimplifyStroke?: boolean;
}

export interface ExportSettingsPDF extends ExportSettingsCommon {
  format: "PDF";
}

/** One file a layer exports to (Figma's `ExportSettings`). */
export type ExportSettings = ExportSettingsImage | ExportSettingsSVG | ExportSettingsPDF;

/** Limits on export settings, so a file can't ask for absurd work. Exports past the pixel limits fail with a reason. */
export const EXPORT_LIMITS = {
  /** Settings on one node. */
  maxSettings: 100,
  /** Characters in a suffix. */
  maxSuffix: 200,
  /** Largest scale (`100x`). */
  maxScale: 100,
  /** Largest fixed width or height, in pixels. */
  maxPixels: 100_000,
} as const;

/**
 * Export settings, named after Figma's Plugin API. Optional: absent means
 * none, so files without them save exactly as before.
 */
export interface ExportFields {
  /** The files this layer (or page) exports to, in order. Default none. */
  exportSettings?: ExportSettings[];
}

export type Node = NodeBase & TextFields & LayoutFields & ShapeFields & EffectFields & ExportFields & ComponentFields & MaskGridFields;

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
  /**
   * Image files by `imageHash` (the SHA-256 of their bytes, lowercase hex):
   * PNG, JPEG, WebP or GIF. Saved as `images/<hash>.<ext>`, only those some
   * paint uses. Absent or empty when the file has none.
   */
  images?: Map<string, Uint8Array>;
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
