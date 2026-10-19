/**
 * Structural validation. `validateFile` checks a whole file; `validateNode`
 * and `validateNodeField` check single nodes and values with the same rules,
 * so the document model can refuse a bad value before it is ever stored.
 * Each returns plain-language problems; an empty list (or `null`) means valid.
 */

import { isValidKey } from "./fractional-index.js";
import { IMAGE_HASH_PATTERN, imageProblem } from "./images.js";
import {
  AXIS_SIZING_MODES,
  BLEND_MODES,
  GRADIENT_TYPES,
  IMAGE_SCALE_MODES,
  PAINT_LIMITS,
  STROKE_ALIGNS,
  CONSTRAINT_TYPES,
  EXPORT_CONSTRAINT_TYPES,
  EXPORT_LIMITS,
  COUNTER_AXIS_ALIGN_CONTENTS,
  COUNTER_AXIS_ALIGNS,
  FORMAT_NAME,
  LAYOUT_MODES,
  LAYOUT_POSITIONINGS,
  LAYOUT_SIZINGS,
  LAYOUT_WRAPS,
  MAX_POINT_COUNT,
  NODE_ID_PATTERN,
  NODE_TYPES,
  PRIMARY_AXIS_ALIGNS,
  STROKE_CAPS,
  STROKE_JOINS,
  BOOLEAN_OPERATIONS,
  MAX_TEXT_METRIC,
  TEXT_ALIGN_HORIZONTALS,
  TEXT_ALIGN_VERTICALS,
  TEXT_AUTO_RESIZES,
  type IlligmaFile,
  type Node,
} from "./schema.js";
import { vectorNetworkProblem } from "./vector.js";
import { guidesProblem, layoutGridsProblem, MASK_TYPES } from "./guides-grids.js";

const MAX_PROBLEMS = 50;
const isId = (v: unknown): v is string => typeof v === "string" && NODE_ID_PATTERN.test(v);
/** True when a page id can be used as a file name (`pages/<id>.json`): node ids already are. */
export function isSafePageId(id: string): boolean {
  return isId(id);
}

const isFinite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const unit = (v: unknown): boolean => isFinite(v) && v >= 0 && v <= 1;
const fraction0 = (v: unknown): string | null => (unit(v) ? null : "must be a number from 0 to 1");
const TYPES = new Set<unknown>(NODE_TYPES);

function isColor(c: unknown): boolean {
  if (!c || typeof c !== "object") return false;
  const o = c as Record<string, unknown>;
  return unit(o.r) && unit(o.g) && unit(o.b) && unit(o.a);
}

type Rule = (v: unknown) => string | null;

const number: Rule = (v) => (isFinite(v) ? null : "must be a number (not NaN or Infinity)");
const boolean: Rule = (v) => (typeof v === "boolean" ? null : "must be true or false");
const text: Rule = (v) => (typeof v === "string" ? null : "must be text");
const optional =
  (rule: Rule): Rule =>
  (v) =>
    v === undefined ? null : rule(v);
const notNegative: Rule = (v) => (isFinite(v) && v >= 0 ? null : "must be a number, 0 or more");
/** One of a fixed list of words, e.g. "HORIZONTAL". */
const oneOf = (values: readonly string[]): Rule => {
  const set = new Set<unknown>(values);
  const message = `must be one of ${values.map((x) => `"${x}"`).join(", ")}`;
  return (v) => (set.has(v) ? null : message);
};

// ---- paints and effects ----

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const colorRule: Rule = (v) => (isColor(v) ? null : "must be a colour { r, g, b, a } with channels from 0 to 1");
const blendMode = oneOf(BLEND_MODES);
const transform: Rule = (v) =>
  Array.isArray(v) && v.length === 2 && v.every((row) => Array.isArray(row) && row.length === 3 && row.every(isFinite))
    ? null
    : "must be a 2 × 3 matrix [[a, c, e], [b, d, f]] of numbers";
const point: Rule = (v) =>
  isObject(v) && Object.keys(v).length === 2 && isFinite(v.x) && isFinite(v.y) && Math.abs(v.x) <= PAINT_LIMITS.maxEffectRadius && Math.abs(v.y) <= PAINT_LIMITS.maxEffectRadius
    ? null
    : `must be { x, y }, each from -${PAINT_LIMITS.maxEffectRadius.toLocaleString("en-US")} to ${PAINT_LIMITS.maxEffectRadius.toLocaleString("en-US")}`;
const radius: Rule = (v) =>
  isFinite(v) && v >= 0 && v <= PAINT_LIMITS.maxEffectRadius ? null : `must be a number from 0 to ${PAINT_LIMITS.maxEffectRadius.toLocaleString("en-US")}`;
const spread: Rule = (v) =>
  isFinite(v) && Math.abs(v) <= PAINT_LIMITS.maxEffectRadius ? null : `must be a number from -${PAINT_LIMITS.maxEffectRadius.toLocaleString("en-US")} to ${PAINT_LIMITS.maxEffectRadius.toLocaleString("en-US")}`;
const stops: Rule = (v) => {
  if (!Array.isArray(v) || v.length === 0 || v.length > PAINT_LIMITS.maxGradientStops) {
    return `must be a list of 1 to ${PAINT_LIMITS.maxGradientStops.toLocaleString("en-US")} colour stops`;
  }
  for (let i = 0; i < v.length; i++) {
    const s = v[i] as unknown;
    if (!isObject(s) || Object.keys(s).length !== 2 || !unit(s.position) || !isColor(s.color)) {
      return `stop ${i} must be { position, color } with a position from 0 to 1 and colour channels from 0 to 1`;
    }
  }
  return null;
};
const hash: Rule = (v) => (v === null || (typeof v === "string" && IMAGE_HASH_PATTERN.test(v)) ? null : "must be null or a SHA-256 hash (64 lowercase hex digits)");
const scalingFactor: Rule = (v) =>
  isFinite(v) && v > 0 && v <= PAINT_LIMITS.maxScalingFactor ? null : `must be a number above 0 and at most ${PAINT_LIMITS.maxScalingFactor.toLocaleString("en-US")}`;

/** Each object kind's fields: [rule, required]. Other keys are refused, so a typo can't hide a value. */
type Shape = Record<string, [Rule, boolean]>;
const PAINT_BASE: Shape = { type: [() => null, true], visible: [boolean, true], opacity: [fraction0, false], blendMode: [blendMode, false] };
const SOLID_SHAPE: Shape = { ...PAINT_BASE, color: [colorRule, true] };
const GRADIENT_SHAPE: Shape = { ...PAINT_BASE, gradientStops: [stops, true], gradientTransform: [transform, true] };
const IMAGE_SHAPE: Shape = {
  ...PAINT_BASE,
  imageHash: [hash, true],
  scaleMode: [oneOf(IMAGE_SCALE_MODES), true],
  imageTransform: [transform, false],
  scalingFactor: [scalingFactor, false],
};
const SHADOW_SHAPE: Shape = {
  type: [() => null, true],
  color: [colorRule, true],
  offset: [point, true],
  radius: [radius, true],
  spread: [spread, false],
  visible: [boolean, true],
  blendMode: [blendMode, false],
};
const DROP_SHADOW_SHAPE: Shape = { ...SHADOW_SHAPE, showShadowBehindNode: [boolean, false] };
const BLUR_SHAPE: Shape = { type: [() => null, true], radius: [radius, true], visible: [boolean, true] };

const PAINT_SHAPES: Record<string, Shape> = { SOLID: SOLID_SHAPE, IMAGE: IMAGE_SHAPE };
for (const t of GRADIENT_TYPES) PAINT_SHAPES[t] = GRADIENT_SHAPE;
const EFFECT_SHAPES: Record<string, Shape> = {
  DROP_SHADOW: DROP_SHADOW_SHAPE,
  INNER_SHADOW: SHADOW_SHAPE,
  LAYER_BLUR: BLUR_SHAPE,
  BACKGROUND_BLUR: BLUR_SHAPE,
};

/** The problem with one object against its shape, or null. */
function shapeProblem(o: Record<string, unknown>, shape: Shape): string | null {
  for (const k of Object.keys(o)) {
    if (!Object.prototype.hasOwnProperty.call(shape, k)) return `has an unknown field "${k.slice(0, 40)}"`;
  }
  for (const [k, [rule, required]] of Object.entries(shape)) {
    const v = o[k];
    if (v === undefined) {
      if (required) return `has no "${k}"`;
      continue;
    }
    const p = rule(v);
    if (p) return `"${k}" ${p}`;
  }
  return null;
}

/** A list of typed objects (paints or effects), each checked against the shape for its `type`. */
const typedList =
  (shapes: Record<string, Shape>, what: string, max: number): Rule =>
  (v) => {
    if (!Array.isArray(v)) return `must be a list of ${what}s`;
    if (v.length > max) return `must have at most ${max.toLocaleString("en-US")} ${what}s`;
    for (let i = 0; i < v.length; i++) {
      const p = v[i] as unknown;
      if (!isObject(p)) return `${what} ${i} is not an object`;
      const type = p.type;
      const shape = typeof type === "string" && Object.prototype.hasOwnProperty.call(shapes, type) ? shapes[type] : undefined;
      if (!shape) return `${what} ${i} has an unknown type${typeof type === "string" ? ` "${type.slice(0, 40)}"` : ""}`;
      const problem = shapeProblem(p, shape);
      if (problem) return `${what} ${i} (${type}) ${problem}`;
    }
    return null;
  };

const paints = typedList(PAINT_SHAPES, "paint", PAINT_LIMITS.maxPaints);
const effects = typedList(EFFECT_SHAPES, "effect", PAINT_LIMITS.maxEffects);
const constraintType = oneOf(CONSTRAINT_TYPES);
const constraints: Rule = (v) => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return "must be { horizontal, vertical }";
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length !== 2 || !("horizontal" in o) || !("vertical" in o)) return "must have exactly a horizontal and a vertical constraint";
  const p = constraintType(o.horizontal) ?? constraintType(o.vertical);
  return p && `horizontal and vertical ${p}`;
};

// ---- text ----

const MAX_METRIC = MAX_TEXT_METRIC.toLocaleString("en-US");
const metricUnit = oneOf(["PIXELS", "PERCENT"]);
const letterSpacing: Rule = (v) => {
  if (!isObject(v) || Object.keys(v).length !== 2 || metricUnit(v.unit) || !isFinite(v.value) || Math.abs(v.value) > MAX_TEXT_METRIC) {
    return `must be { value, unit } with a value from -${MAX_METRIC} to ${MAX_METRIC} and a unit "PIXELS" or "PERCENT"`;
  }
  return null;
};
const lineHeight: Rule = (v) => {
  // Format 0: a number of pixels.
  if (typeof v === "number") return isFinite(v) && v >= 0 && v <= MAX_TEXT_METRIC ? null : `must be a number of pixels from 0 to ${MAX_METRIC}`;
  if (isObject(v) && Object.keys(v).length === 1 && v.unit === "AUTO") return null;
  if (isObject(v) && Object.keys(v).length === 2 && !metricUnit(v.unit) && isFinite(v.value) && v.value >= 0 && v.value <= MAX_TEXT_METRIC) return null;
  return `must be a number of pixels, { unit: "AUTO" }, or { value, unit } with a value from 0 to ${MAX_METRIC} and a unit "PIXELS" or "PERCENT"`;
};
/** Font size: above 0 and at most `MAX_TEXT_METRIC` (a huge size made layout NaN, so the text could never be edited). */
const fontSize: Rule = (v) => (isFinite(v) && v > 0 && v <= MAX_TEXT_METRIC ? null : `must be a number above 0 and at most ${MAX_METRIC}`);
// ---- export settings ----

const suffix: Rule = (v) =>
  typeof v === "string" && v.length <= EXPORT_LIMITS.maxSuffix ? null : `must be text of at most ${EXPORT_LIMITS.maxSuffix} characters`;
const exportConstraint: Rule = (v) => {
  if (!isObject(v) || Object.keys(v).length !== 2 || !("type" in v) || !("value" in v)) return "must be { type, value }";
  const t = oneOf(EXPORT_CONSTRAINT_TYPES)(v.type);
  if (t) return `type ${t}`;
  const max = v.type === "SCALE" ? EXPORT_LIMITS.maxScale : EXPORT_LIMITS.maxPixels;
  return isFinite(v.value) && v.value > 0 && v.value <= max ? null : `value must be a number above 0 and at most ${max.toLocaleString("en-US")}`;
};
const quality: Rule = (v) => (isFinite(v) && v >= 0 && v <= 100 ? null : "must be a number from 0 to 100");
const EXPORT_BASE: Shape = { format: [() => null, true], suffix: [suffix, false], contentsOnly: [boolean, false], useAbsoluteBounds: [boolean, false] };
const EXPORT_IMAGE_SHAPE: Shape = { ...EXPORT_BASE, constraint: [exportConstraint, false], quality: [quality, false] };
const EXPORT_SHAPES: Record<string, Shape> = {
  PNG: EXPORT_IMAGE_SHAPE,
  JPG: EXPORT_IMAGE_SHAPE,
  SVG: { ...EXPORT_BASE, svgOutlineText: [boolean, false], svgIdAttribute: [boolean, false], svgSimplifyStroke: [boolean, false] },
  PDF: EXPORT_BASE,
};
const exportSettings: Rule = (v) => {
  if (!Array.isArray(v)) return "must be a list of export settings";
  if (v.length > EXPORT_LIMITS.maxSettings) return `must have at most ${EXPORT_LIMITS.maxSettings} export settings`;
  for (let i = 0; i < v.length; i++) {
    const e = v[i] as unknown;
    if (!isObject(e)) return `setting ${i} is not an object`;
    const f = e.format;
    const shape = typeof f === "string" && Object.prototype.hasOwnProperty.call(EXPORT_SHAPES, f) ? EXPORT_SHAPES[f] : undefined;
    if (!shape) return `setting ${i} has an unknown format${typeof f === "string" ? ` "${f.slice(0, 40)}"` : ""}: use PNG, JPG, SVG or PDF`;
    const problem = shapeProblem(e, shape);
    if (problem) return `setting ${i} (${f}) ${problem}`;
  }
  return null;
};

const pointCount: Rule = (v) =>
  typeof v === "number" && Number.isInteger(v) && v >= 3 && v <= MAX_POINT_COUNT ? null : `must be a whole number from 3 to ${MAX_POINT_COUNT.toLocaleString("en-US")}`;
const fraction: Rule = (v) => (unit(v) ? null : "must be a number from 0 to 1");

/** One rule per node field. Typed against `Node`, so a new field can't be forgotten here. */
const RULES: { [K in keyof Node]-?: Rule } = {
  id: (v) => (isId(v) ? null : v === undefined || v === "" ? "is missing: the node has no id" : 'must be 1–64 letters, digits, "_" or "-"'),
  // Never String() an arbitrary JSON value: {"toString": 1} would throw.
  type: (v) => (TYPES.has(v) ? null : typeof v === "string" ? `is an unknown type "${v.slice(0, 40)}"` : "is not a node type"),
  parentId: (v) => (v === null || isId(v) ? null : "must be a node id or null"),
  index: (v) => (typeof v === "string" && isValidKey(v) ? null : "must be a valid order index"),
  name: text,
  visible: boolean,
  locked: boolean,
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number,
  opacity: number,
  fills: paints,
  strokes: paints,
  strokeWeight: number,
  cornerRadius: number,
  characters: optional(text),
  fontFamily: optional(text),
  fontStyle: optional(text),
  fontSize: optional(fontSize),
  lineHeight: optional(lineHeight),
  letterSpacing: optional(letterSpacing),
  textAutoResize: optional(oneOf(TEXT_AUTO_RESIZES)),
  textAlignHorizontal: optional(oneOf(TEXT_ALIGN_HORIZONTALS)),
  textAlignVertical: optional(oneOf(TEXT_ALIGN_VERTICALS)),
  layoutMode: optional(oneOf(LAYOUT_MODES)),
  itemSpacing: optional(number),
  counterAxisSpacing: optional(notNegative),
  paddingLeft: optional(notNegative),
  paddingRight: optional(notNegative),
  paddingTop: optional(notNegative),
  paddingBottom: optional(notNegative),
  primaryAxisAlignItems: optional(oneOf(PRIMARY_AXIS_ALIGNS)),
  counterAxisAlignItems: optional(oneOf(COUNTER_AXIS_ALIGNS)),
  counterAxisAlignContent: optional(oneOf(COUNTER_AXIS_ALIGN_CONTENTS)),
  primaryAxisSizingMode: optional(oneOf(AXIS_SIZING_MODES)),
  counterAxisSizingMode: optional(oneOf(AXIS_SIZING_MODES)),
  layoutWrap: optional(oneOf(LAYOUT_WRAPS)),
  layoutPositioning: optional(oneOf(LAYOUT_POSITIONINGS)),
  layoutSizingHorizontal: optional(oneOf(LAYOUT_SIZINGS)),
  layoutSizingVertical: optional(oneOf(LAYOUT_SIZINGS)),
  constraints: optional(constraints),
  minWidth: optional(notNegative),
  maxWidth: optional(notNegative),
  minHeight: optional(notNegative),
  maxHeight: optional(notNegative),
  vectorNetwork: optional(vectorNetworkProblem),
  pointCount: optional(pointCount),
  innerRadius: optional(fraction),
  strokeCap: optional(oneOf(STROKE_CAPS)),
  strokeJoin: optional(oneOf(STROKE_JOINS)),
  booleanOperation: optional(oneOf(BOOLEAN_OPERATIONS)),
  effects: optional(effects),
  blendMode: optional(blendMode),
  strokeAlign: optional(oneOf(STROKE_ALIGNS)),
  exportSettings: optional(exportSettings),
  isMask: optional(boolean),
  maskType: optional(oneOf(MASK_TYPES)),
  layoutGrids: optional(layoutGridsProblem),
  guides: optional(guidesProblem),
};

/** Every node field name, required and optional. */
export const NODE_KEYS = Object.freeze(Object.keys(RULES)) as readonly (keyof Node)[];

const KNOWN = new Set<string>(NODE_KEYS);
const RULE_LIST = Object.entries(RULES) as [keyof Node, Rule][];

/** The problem with `value` as node field `key`, or `null` if it is valid. Unknown keys are a problem. */
export function validateNodeField(key: string, value: unknown): string | null {
  if (!KNOWN.has(key)) return `"${key}" is not a node field`;
  const problem = RULES[key as keyof Node](value);
  return problem && `"${key}" ${problem}`;
}

/** Problems with one node's own fields (not its links to other nodes). Unknown extra keys are allowed. */
export function validateNode(node: unknown): string[] {
  if (!node || typeof node !== "object" || Array.isArray(node)) return ["the node is not an object"];
  const o = node as Record<string, unknown>;
  const problems: string[] = [];
  for (const [k, rule] of RULE_LIST) {
    const p = rule(o[k]);
    if (p) problems.push(`"${k}" ${p}`);
  }
  return problems;
}

export function validateFile(file: IlligmaFile): string[] {
  const problems: string[] = [];
  const m = file?.manifest as unknown as Record<string, unknown>;
  if (!m || m.format !== FORMAT_NAME) problems.push('The manifest must have "format": "illigma".');
  if (typeof m?.fileId !== "string" || !m.fileId) problems.push("The manifest has no file id.");
  if (typeof m?.name !== "string") problems.push("The manifest has no file name.");
  if (typeof m?.created !== "string") problems.push('The manifest\'s "created" date must be text.');
  if (typeof m?.app !== "string") problems.push('The manifest\'s "app" must be text.');
  if (!Array.isArray(m?.pages) || m.pages.length === 0) problems.push("The file must have at least one page.");
  if (!Array.isArray(file?.nodes)) return [...problems, "The file has no node list."];
  const images = file.images as unknown;
  if (images !== undefined) {
    if (!(images instanceof Map)) problems.push("The file's images must be a map from image hash to bytes.");
    else {
      for (const [hash, bytes] of images as Map<unknown, unknown>) {
        const shown = typeof hash === "string" ? hash.slice(0, 64) : "?";
        if (typeof hash !== "string" || !IMAGE_HASH_PATTERN.test(hash)) problems.push(`Image ${JSON.stringify(shown)} has no valid hash.`);
        else {
          const p = imageProblem(bytes);
          if (p) problems.push(`Image ${shown.slice(0, 12)}… ${p}.`);
        }
        if (problems.length >= MAX_PROBLEMS) break;
      }
    }
  }

  const byId = new Map<string, Node>();
  file.nodes.forEach((n, i) => {
    const o = n as unknown as Record<string, unknown> | null;
    const where = isId(o?.id) ? `Node ${o.id}` : `Node #${i + 1}`;
    for (const p of validateNode(n)) problems.push(`${where}: ${p}.`);
    if (!isId(o?.id)) return;
    if (byId.has(o.id)) problems.push(`Node id ${o.id} is used twice.`);
    byId.set(o.id, n);
  });

  // Page ids name files (pages/<id>.json), so they must also differ ignoring case.
  const pageIds = new Set<string>();
  const lowerIds = new Map<string, string>();
  const listed: string[] = [];
  for (const p of (Array.isArray(m?.pages) ? m.pages : []) as { id?: unknown; name?: unknown }[]) {
    const id = typeof p?.id === "string" ? p.id : "";
    // A page id becomes a file name (pages/<id>.json), so it must be one plain path segment.
    if (!isSafePageId(id)) problems.push(`Page id ${JSON.stringify(id.slice(0, 80))} can't be used as a file name.`);
    if (typeof p?.name !== "string") problems.push(`Page ${id} has no name in the manifest.`);
    if (pageIds.has(id)) problems.push(`Page ${id} is listed twice.`);
    else if (lowerIds.has(id.toLowerCase())) problems.push(`Pages ${lowerIds.get(id.toLowerCase())} and ${id} differ only in case.`);
    pageIds.add(id);
    lowerIds.set(id.toLowerCase(), id);
    listed.push(id);
    const node = byId.get(id);
    if (!node || node.type !== "PAGE") problems.push(`Page ${id} is listed but has no PAGE node.`);
  }

  // Tree checks only use nodes whose links are well-typed; validateNode already reported the rest.
  const linked = [...byId.values()].filter((n) => !RULES.parentId(n.parentId) && !RULES.index(n.index));

  const pages: Node[] = [];
  for (const n of linked) {
    if (n.type === "PAGE") {
      pages.push(n);
      if (n.parentId !== null) problems.push(`Page ${n.id} must not have a parent.`);
      if (!pageIds.has(n.id)) problems.push(`Page ${n.id} is not listed in the manifest.`);
      continue;
    }
    if (n.parentId === null) {
      problems.push(`Node ${n.id} has no parent.`);
      continue;
    }
    if (!byId.has(n.parentId)) problems.push(`Node ${n.id} points to a missing parent ${n.parentId}.`);
    // Cycle check: walk up at most byId.size steps.
    let cur: Node | undefined = n;
    let steps = 0;
    while (cur && cur.parentId !== null && steps <= byId.size) {
      cur = byId.get(cur.parentId);
      steps++;
    }
    if (steps > byId.size) problems.push(`Node ${n.id} is inside a parent loop.`);
  }

  // The manifest's page order must agree with the pages' order keys.
  pages.sort(compareOrder);
  if (pages.length === listed.length && pages.some((p, i) => p.id !== listed[i])) {
    problems.push("The manifest's page order doesn't match the pages' order indexes.");
  }

  // Sibling order keys must be unique within a parent.
  const seen = new Map<string, string>();
  for (const n of linked) {
    const k = `${n.parentId ?? ""}\u0000${n.index}`;
    const other = seen.get(k);
    if (other) problems.push(`Nodes ${other} and ${n.id} share the same position.`);
    else seen.set(k, n.id);
  }

  return problems.slice(0, MAX_PROBLEMS);
}

/** Sibling order: by index, then by id. */
export function compareOrder(a: { index: string; id: string }, b: { index: string; id: string }): number {
  return a.index < b.index ? -1 : a.index > b.index ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
