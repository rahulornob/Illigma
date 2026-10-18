/**
 * Structural validation. `validateFile` checks a whole file; `validateNode`
 * and `validateNodeField` check single nodes and values with the same rules,
 * so the document model can refuse a bad value before it is ever stored.
 * Each returns plain-language problems; an empty list (or `null`) means valid.
 */

import { isValidKey } from "./fractional-index.js";
import {
  AXIS_SIZING_MODES,
  CONSTRAINT_TYPES,
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
  type IlligmaFile,
  type Node,
} from "./schema.js";
import { vectorNetworkProblem } from "./vector.js";

const MAX_PROBLEMS = 50;
const isId = (v: unknown): v is string => typeof v === "string" && NODE_ID_PATTERN.test(v);
/** True when a page id can be used as a file name (`pages/<id>.json`): node ids already are. */
export function isSafePageId(id: string): boolean {
  return isId(id);
}

const isFinite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const unit = (v: unknown): boolean => isFinite(v) && v >= 0 && v <= 1;
const TYPES = new Set<unknown>(NODE_TYPES);

function isColor(c: unknown): boolean {
  if (!c || typeof c !== "object") return false;
  const o = c as Record<string, unknown>;
  return unit(o.r) && unit(o.g) && unit(o.b) && unit(o.a);
}

function isPaintList(v: unknown): boolean {
  return (
    Array.isArray(v) &&
    v.every((p) => p && typeof p === "object" && p.type === "SOLID" && typeof p.visible === "boolean" && isColor(p.color))
  );
}

type Rule = (v: unknown) => string | null;

const number: Rule = (v) => (isFinite(v) ? null : "must be a number (not NaN or Infinity)");
const boolean: Rule = (v) => (typeof v === "boolean" ? null : "must be true or false");
const text: Rule = (v) => (typeof v === "string" ? null : "must be text");
const paints: Rule = (v) => (isPaintList(v) ? null : "must be a list of solid paints with colour channels from 0 to 1");
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
const constraintType = oneOf(CONSTRAINT_TYPES);
const constraints: Rule = (v) => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return "must be { horizontal, vertical }";
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length !== 2 || !("horizontal" in o) || !("vertical" in o)) return "must have exactly a horizontal and a vertical constraint";
  const p = constraintType(o.horizontal) ?? constraintType(o.vertical);
  return p && `horizontal and vertical ${p}`;
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
  fontSize: optional(number),
  lineHeight: optional(number),
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
