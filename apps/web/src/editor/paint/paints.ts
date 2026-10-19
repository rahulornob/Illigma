/**
 * The paint and effect model behind the Fill, Stroke, Effects and Appearance
 * cards: labels, defaults, paint type changes, gradient stops and handles,
 * and the colours used in a file. Pure functions on format values, no DOM
 * and no document writes (see `edits.ts` for those).
 */

import type { Document, ReadonlyNode } from "@illigma/core";
import type {
  BlendMode,
  Color,
  ColorStop,
  Effect,
  EffectType,
  GradientPaint,
  GradientType,
  ImagePaint,
  ImageScaleMode,
  NodeType,
  Paint,
  PaintType,
  ShadowEffect,
  StrokeCap,
  StrokeJoin,
  Transform,
} from "@illigma/format";
import { GRADIENT_TYPES } from "@illigma/format";
import { mixColor, toHex, toHex8 } from "./color";

// ---- labels ----

export const PAINT_TYPE_LABEL: Record<PaintType, string> = {
  SOLID: "Solid",
  GRADIENT_LINEAR: "Linear",
  GRADIENT_RADIAL: "Radial",
  GRADIENT_ANGULAR: "Angular",
  GRADIENT_DIAMOND: "Diamond",
  IMAGE: "Image",
};

/** Figma's blend mode menu, in its order and groups (null is a separator). */
export const BLEND_MENU: readonly (BlendMode | null)[] = [
  "PASS_THROUGH",
  "NORMAL",
  null,
  "DARKEN",
  "MULTIPLY",
  "LINEAR_BURN",
  "COLOR_BURN",
  null,
  "LIGHTEN",
  "SCREEN",
  "LINEAR_DODGE",
  "COLOR_DODGE",
  null,
  "OVERLAY",
  "SOFT_LIGHT",
  "HARD_LIGHT",
  null,
  "DIFFERENCE",
  "EXCLUSION",
  null,
  "HUE",
  "SATURATION",
  "COLOR",
  "LUMINOSITY",
];

export const BLEND_LABEL: Record<BlendMode, string> = {
  PASS_THROUGH: "Pass through",
  NORMAL: "Normal",
  DARKEN: "Darken",
  MULTIPLY: "Multiply",
  LINEAR_BURN: "Plus darker",
  COLOR_BURN: "Color burn",
  LIGHTEN: "Lighten",
  SCREEN: "Screen",
  LINEAR_DODGE: "Plus lighter",
  COLOR_DODGE: "Color dodge",
  OVERLAY: "Overlay",
  SOFT_LIGHT: "Soft light",
  HARD_LIGHT: "Hard light",
  DIFFERENCE: "Difference",
  EXCLUSION: "Exclusion",
  HUE: "Hue",
  SATURATION: "Saturation",
  COLOR: "Color",
  LUMINOSITY: "Luminosity",
};

export const SCALE_MODE_LABEL: Record<ImageScaleMode, string> = { FILL: "Fill", FIT: "Fit", CROP: "Crop", TILE: "Tile" };

export const EFFECT_LABEL: Record<EffectType, string> = {
  DROP_SHADOW: "Drop shadow",
  INNER_SHADOW: "Inner shadow",
  LAYER_BLUR: "Layer blur",
  BACKGROUND_BLUR: "Background blur",
};

export const STROKE_CAP_LABEL: Record<StrokeCap, string> = { NONE: "None", ROUND: "Round", SQUARE: "Square" };
export const STROKE_JOIN_LABEL: Record<StrokeJoin, string> = { MITER: "Miter", BEVEL: "Bevel", ROUND: "Round" };

/** Layers that hold children: their blend mode can be Pass through (the default). */
const CONTAINER_TYPES = new Set<NodeType>(["FRAME", "GROUP", "SECTION", "COMPONENT", "COMPONENT_SET", "INSTANCE"]);
export const isContainer = (type: NodeType) => CONTAINER_TYPES.has(type);

/**
 * A layer's blend mode as the Appearance card shows it. Absent is Pass
 * through, which on a layer without children draws as Normal, so it reads
 * "Normal" there (as in Figma).
 */
export function layerBlend(node: Pick<ReadonlyNode, "type" | "blendMode">): BlendMode {
  const mode = node.blendMode ?? "PASS_THROUGH";
  return mode === "PASS_THROUGH" && !isContainer(node.type) ? "NORMAL" : mode;
}

/** The value to store for a picked layer blend mode: the default (absent) where it means the same. */
export function storedLayerBlend(type: NodeType, mode: BlendMode): BlendMode | undefined {
  if (mode === "PASS_THROUGH") return undefined;
  if (mode === "NORMAL" && !isContainer(type)) return undefined;
  return mode;
}

/** Shapes whose outline is closed: a new stroke goes inside, as in Figma. */
const CLOSED_TYPES = new Set<NodeType>(["RECTANGLE", "ELLIPSE", "POLYGON", "STAR", "FRAME", "COMPONENT", "INSTANCE", "SECTION"]);
export const strokesInsideByDefault = (type: NodeType) => CLOSED_TYPES.has(type);
/** Line ends: lines and vectors (open paths). */
export const hasStrokeCaps = (type: NodeType) => type === "LINE" || type === "VECTOR";
/** Stroke corners: shapes with corners drawn by joins. */
export const hasStrokeJoins = (type: NodeType) => type === "VECTOR" || type === "POLYGON" || type === "STAR" || type === "RECTANGLE";
/** Lines are always stroked centred, so they have no alignment. */
export const hasStrokeAlign = (type: NodeType) => type !== "LINE";

// ---- paints ----

/** Figma's new-fill grey (#D9D9D9). */
export const DEFAULT_FILL: Color = { r: 217 / 255, g: 217 / 255, b: 217 / 255, a: 1 };
export const DEFAULT_STROKE: Color = { r: 0, g: 0, b: 0, a: 1 };

export const solidPaint = (color: Color): Paint => ({ type: "SOLID", visible: true, color: { ...color } });

/** Top to bottom, as Figma starts a linear gradient: (u, v) → (v, 1 − u). */
export const LINEAR_DEFAULT: Transform = [
  [0, 1, 0],
  [-1, 0, 1],
];
export const IDENTITY: Transform = [
  [1, 0, 0],
  [0, 1, 0],
];

export const isGradient = (p: Pick<Paint, "type">): p is GradientPaint => (GRADIENT_TYPES as readonly string[]).includes(p.type);

/** The paint's main colour: a solid's colour, a gradient's first stop, or null for images. */
export function paintColor(p: Paint): Color | null {
  if (p.type === "SOLID") return p.color;
  if (isGradient(p)) return p.gradientStops[0]?.color ?? null;
  return null;
}

/** Keep the fields every paint shares (visibility, opacity, blend mode). */
function base(p: Paint): Pick<Paint, "visible" | "opacity" | "blendMode"> {
  return { visible: p.visible, ...(p.opacity !== undefined ? { opacity: p.opacity } : {}), ...(p.blendMode !== undefined ? { blendMode: p.blendMode } : {}) };
}

/**
 * The paint as another type, as Figma converts it: a solid becomes a
 * gradient from its colour to the same colour, transparent; a gradient keeps
 * its stops and handles across gradient types and becomes its first stop as
 * a solid; an image starts with no image chosen.
 */
export function convertPaint(p: Paint, type: PaintType): Paint {
  if (p.type === type) return p;
  if (type === "SOLID") return { type: "SOLID", ...base(p), color: { ...(paintColor(p) ?? DEFAULT_FILL) } };
  if (type === "IMAGE") return { type: "IMAGE", ...base(p), imageHash: null, scaleMode: "FILL" } satisfies ImagePaint;
  if (isGradient(p)) return { ...p, type };
  const c = paintColor(p) ?? DEFAULT_FILL;
  return {
    type,
    ...base(p),
    gradientStops: [
      { position: 0, color: { ...c, a: 1 } },
      { position: 1, color: { ...c, a: 0 } },
    ],
    gradientTransform: type === "GRADIENT_LINEAR" ? LINEAR_DEFAULT : IDENTITY,
  };
}

/** A short text for a paint row: hex for solids, the type for gradients and images. */
export function paintLabel(p: Paint): string {
  if (p.type === "SOLID") return toHex(p.color);
  return PAINT_TYPE_LABEL[p.type];
}

/** The paint's alpha as the row shows it: opacity × (a solid's alpha). */
export function paintAlpha(p: Paint): number {
  return p.opacity ?? 1;
}

// ---- gradient stops ----

/** Stops in position order (ties keep their order). */
export const sortStops = (stops: readonly ColorStop[]): ColorStop[] => stops.map((s, i) => ({ s, i })).sort((a, b) => a.s.position - b.s.position || a.i - b.i).map((x) => x.s);

/** The colour a gradient draws at `t` (0–1), between its stops. */
export function colorAt(stops: readonly ColorStop[], t: number): Color {
  const sorted = sortStops(stops);
  const first = sorted[0];
  if (!first) return { r: 0, g: 0, b: 0, a: 0 };
  if (t <= first.position) return first.color;
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1] as ColorStop;
    const b = sorted[i] as ColorStop;
    if (t <= b.position) return mixColor(a.color, b.color, b.position === a.position ? 1 : (t - a.position) / (b.position - a.position));
  }
  return (sorted.at(-1) as ColorStop).color;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Positions are kept to 4 decimals (0.01 %), so typed and dragged values round-trip. */
const roundPos = (v: number) => Math.round(clamp01(v) * 10_000) / 10_000;

/** Add a stop at `position` with the colour the gradient has there. Returns the stops (sorted) and the new stop's index. */
export function addStop(stops: readonly ColorStop[], position: number): { stops: ColorStop[]; index: number } {
  const stop: ColorStop = { position: roundPos(position), color: { ...colorAt(stops, position) } };
  const next = sortStops([...stops, stop]);
  return { stops: next, index: next.indexOf(stop) };
}

/** Move stop `index` to `position`. Returns the stops (sorted) and where that stop is now. */
export function moveStop(stops: readonly ColorStop[], index: number, position: number): { stops: ColorStop[]; index: number } {
  const old = stops[index];
  if (!old) return { stops: [...stops], index };
  const moved: ColorStop = { ...old, position: roundPos(position) };
  const next = sortStops(stops.map((s, i) => (i === index ? moved : s)));
  return { stops: next, index: next.indexOf(moved) };
}

/** Change stop `index`'s colour. */
export function recolorStop(stops: readonly ColorStop[], index: number, color: Color): ColorStop[] {
  return stops.map((s, i) => (i === index ? { position: s.position, color: { ...color } } : s));
}

/** A gradient keeps at least two stops. */
export const MIN_STOPS = 2;

/** Remove stop `index`, or null if that would leave fewer than two. Returns the index to select next. */
export function removeStop(stops: readonly ColorStop[], index: number): { stops: ColorStop[]; index: number } | null {
  if (stops.length <= MIN_STOPS || !stops[index]) return null;
  const next = stops.filter((_, i) => i !== index);
  return { stops: next, index: Math.min(index, next.length - 1) };
}

/** Reverse the gradient: each stop goes to 1 − its position. */
export function flipStops(stops: readonly ColorStop[]): ColorStop[] {
  return sortStops(stops.map((s) => ({ position: roundPos(1 - s.position), color: s.color })));
}

/** CSS for a stop bar or swatch: a left-to-right linear gradient through the stops. */
export function cssStops(stops: readonly ColorStop[]): string {
  const css = (c: Color) => `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${Math.round(c.a * 1000) / 1000})`;
  return sortStops(stops)
    .map((s) => `${css(s.color)} ${Math.round(s.position * 10_000) / 100}%`)
    .join(", ");
}

// ---- gradient handles ----

export interface Point {
  x: number;
  y: number;
}

/**
 * A gradient's handles in the layer's box, normalised to 0…1: where the
 * gradient starts (linear) or its centre (the others), where it ends, and
 * the third point that sets its width (the perpendicular reach). These are
 * what Figma's on-canvas handles show.
 */
export interface GradientHandles {
  start: Point;
  end: Point;
  width: Point;
}

/** The three points in gradient space the handles map to, per type. */
function anchors(type: GradientType): [Point, Point, Point] {
  return type === "GRADIENT_LINEAR"
    ? [
        { x: 0, y: 0.5 },
        { x: 1, y: 0.5 },
        { x: 0, y: 1 },
      ]
    : [
        { x: 0.5, y: 0.5 },
        { x: 1, y: 0.5 },
        { x: 0.5, y: 1 },
      ];
}

function invert(t: Transform): Transform | null {
  const [[a, c, e], [b, d, f]] = t;
  const det = a * d - b * c;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
  return [
    [d / det, -c / det, (c * f - d * e) / det],
    [-b / det, a / det, (b * e - a * f) / det],
  ];
}

const apply = (t: Transform, p: Point): Point => ({ x: t[0][0] * p.x + t[0][1] * p.y + t[0][2], y: t[1][0] * p.x + t[1][1] * p.y + t[1][2] });

/** The handles of a gradient (null if its transform can't be inverted). */
export function handlesOf(p: Pick<GradientPaint, "type" | "gradientTransform">): GradientHandles | null {
  const inv = invert(p.gradientTransform);
  if (!inv) return null;
  const [s, e, w] = anchors(p.type);
  return { start: apply(inv, s), end: apply(inv, e), width: apply(inv, w) };
}

/**
 * The transform whose handles are `h`: the one affine map taking the three
 * handle points to the gradient's three anchors. Null if they are on one line.
 */
export function transformFromHandles(type: GradientType, h: GradientHandles): Transform | null {
  // M maps anchors → handles (columns: the anchor basis); the gradient transform is its inverse.
  const [s, e, w] = anchors(type);
  // Solve M with M(s) = start, M(e) = end, M(w) = width. With anchors' edge vectors u = e − s, v = w − s:
  const u = { x: e.x - s.x, y: e.y - s.y };
  const v = { x: w.x - s.x, y: w.y - s.y };
  const det = u.x * v.y - u.y * v.x;
  const du = { x: h.end.x - h.start.x, y: h.end.y - h.start.y };
  const dv = { x: h.width.x - h.start.x, y: h.width.y - h.start.y };
  // Linear part L with L·u = du and L·v = dv: L = [du dv]·[u v]⁻¹.
  const inv = [
    [v.y / det, -v.x / det],
    [-u.y / det, u.x / det],
  ] as const;
  const a = du.x * inv[0][0] + dv.x * inv[1][0];
  const c = du.x * inv[0][1] + dv.x * inv[1][1];
  const b = du.y * inv[0][0] + dv.y * inv[1][0];
  const d = du.y * inv[0][1] + dv.y * inv[1][1];
  const m: Transform = [
    [a, c, h.start.x - (a * s.x + c * s.y)],
    [b, d, h.start.y - (b * s.x + d * s.y)],
  ];
  const t = invert(m);
  if (!t) return null;
  return t.map((row) => row.map((x) => Math.round(x * 1e9) / 1e9 + 0)) as Transform;
}

/** The gradient's direction in degrees on screen (0 = to the right, 90 = down), for a box `w` × `h`. */
export function gradientAngle(p: Pick<GradientPaint, "type" | "gradientTransform">, w: number, h: number): number {
  const hd = handlesOf(p);
  if (!hd) return 0;
  const deg = (Math.atan2((hd.end.y - hd.start.y) * h, (hd.end.x - hd.start.x) * w) * 180) / Math.PI;
  return Math.round((((deg % 360) + 360) % 360) * 100) / 100;
}

/**
 * The transform turned to point at `angle` degrees on screen, around its
 * start (centre for radial, angular and diamond) or the middle of a linear
 * gradient, keeping its length and width in pixels. A box of `w` × `h`.
 */
export function rotateGradient(p: Pick<GradientPaint, "type" | "gradientTransform">, angle: number, w: number, h: number): Transform {
  const hd = handlesOf(p);
  if (!hd || w <= 0 || h <= 0) return p.gradientTransform;
  const turn = ((angle - gradientAngle(p, w, h)) * Math.PI) / 180;
  const px = (q: Point) => ({ x: q.x * w, y: q.y * h });
  const pivot = p.type === "GRADIENT_LINEAR" ? px({ x: (hd.start.x + hd.end.x) / 2, y: (hd.start.y + hd.end.y) / 2 }) : px(hd.start);
  const rot = (q: Point): Point => {
    const a = px(q);
    const dx = a.x - pivot.x;
    const dy = a.y - pivot.y;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    return { x: (pivot.x + dx * cos - dy * sin) / w, y: (pivot.y + dx * sin + dy * cos) / h };
  };
  return transformFromHandles(p.type as GradientType, { start: rot(hd.start), end: rot(hd.end), width: rot(hd.width) }) ?? p.gradientTransform;
}

// ---- effects ----

/** Figma's defaults for a new effect: a soft black shadow 4 px down, or a 4 px blur. */
export function defaultEffect(type: EffectType): Effect {
  if (type === "LAYER_BLUR" || type === "BACKGROUND_BLUR") return { type, radius: 4, visible: true };
  const shadow: ShadowEffect = { type, color: { r: 0, g: 0, b: 0, a: 0.25 }, offset: { x: 0, y: 4 }, radius: 4, spread: 0, visible: true, blendMode: "NORMAL" };
  if (type === "DROP_SHADOW") shadow.showShadowBehindNode = false;
  return shadow;
}

export const isShadow = (e: Effect): e is ShadowEffect => e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW";

/** The effect as another type, keeping what carries over (colour, offset, radius, visibility). */
export function convertEffect(e: Effect, type: EffectType): Effect {
  if (e.type === type) return e;
  const next = defaultEffect(type);
  next.visible = e.visible;
  next.radius = e.radius;
  if (isShadow(e) && isShadow(next)) {
    next.color = { ...e.color };
    next.offset = { ...e.offset };
    if (e.spread !== undefined) next.spread = e.spread;
    if (e.blendMode !== undefined) next.blendMode = e.blendMode;
  }
  return next;
}

// ---- colours in the file ----

/** How many document colours the picker shows. */
export const DOCUMENT_COLORS_CAP = 24;

/**
 * Every solid colour the file uses (fills and strokes on every page), most
 * used first, the same colour (8-bit channels and alpha) only once, at most `cap`.
 */
export function documentColors(doc: Pick<Document, "pages" | "subtree">, cap = DOCUMENT_COLORS_CAP): Color[] {
  const seen = new Map<string, { color: Color; count: number; first: number }>();
  let order = 0;
  for (const page of doc.pages()) {
    for (const node of doc.subtree(page.id)) {
      for (const p of [...node.fills, ...node.strokes]) {
        if (p.type !== "SOLID") continue;
        const key = toHex8(p.color);
        const entry = seen.get(key);
        if (entry) entry.count++;
        else seen.set(key, { color: { ...p.color }, count: 1, first: order++ });
      }
    }
  }
  return [...seen.values()]
    .sort((a, b) => b.count - a.count || a.first - b.first)
    .slice(0, cap)
    .map((e) => e.color);
}

/** Two paint lists that are the same (for a multi-selection: one list, or Mixed). */
export function samePaints(a: readonly Paint[], b: readonly Paint[]): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}
