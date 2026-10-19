/**
 * File-level definitions: local styles and variables (Figma's local styles
 * and variable collections). They live in `manifest.json` under the optional
 * `styles` and `variables` keys, written only when the file has some, so
 * files without them are byte-identical to before (format 0, no migration).
 *
 * Nodes point at them by id: `fillStyleId`, `strokeStyleId`, `textStyleId`,
 * `effectStyleId`, `gridStyleId` for styles, `boundVariables` for variables
 * and `explicitVariableModes` for a frame's (or page's) chosen mode. The
 * resolved values are always also stored in the node's own fields, so a
 * reader that knows nothing about styles or variables still draws the file.
 */

import type { Color, Effect, LetterSpacing, LineHeight, Paint } from "./schema.js";

export type StyleType = "PAINT" | "TEXT" | "EFFECT" | "GRID";
export const STYLE_TYPES: readonly StyleType[] = ["PAINT", "TEXT", "EFFECT", "GRID"];

interface StyleBase {
  id: string;
  /** "/" separates folders: "Brand/Primary" sits in folder "Brand". */
  name: string;
  description?: string;
}
export interface PaintStyle extends StyleBase {
  type: "PAINT";
  paints: Paint[];
}
export interface TextStyle extends StyleBase {
  type: "TEXT";
  fontFamily: string;
  fontStyle: string;
  fontSize: number;
  lineHeight?: number | LineHeight;
  letterSpacing?: LetterSpacing;
}
export interface EffectStyle extends StyleBase {
  type: "EFFECT";
  effects: Effect[];
}
/** Layout grids are plain JSON here; their shape is the node field `layoutGrids`. */
export interface GridStyle extends StyleBase {
  type: "GRID";
  layoutGrids: Record<string, unknown>[];
}
export type Style = PaintStyle | TextStyle | EffectStyle | GridStyle;

/** Node field that refers to each style type. */
export const STYLE_REF_KEYS = {
  fills: "fillStyleId",
  strokes: "strokeStyleId",
  text: "textStyleId",
  effects: "effectStyleId",
  grid: "gridStyleId",
} as const;

export type VariableResolvedType = "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
export const VARIABLE_TYPES: readonly VariableResolvedType[] = ["COLOR", "FLOAT", "STRING", "BOOLEAN"];

export interface VariableAlias {
  type: "VARIABLE_ALIAS";
  id: string;
}
export type VariableValue = boolean | number | string | Color | VariableAlias;

export interface VariableMode {
  modeId: string;
  name: string;
}
export interface VariableCollection {
  id: string;
  name: string;
  /** At least one; the first is not necessarily the default. */
  modes: VariableMode[];
  defaultModeId: string;
}
export interface Variable {
  id: string;
  /** "/" makes groups: "bg/app" is in group "bg". */
  name: string;
  collectionId: string;
  resolvedType: VariableResolvedType;
  /** One value per mode of its collection. */
  valuesByMode: Record<string, VariableValue>;
  description?: string;
  /** Where the variable is offered (Figma's `VariableScope`). Absent: everywhere. */
  scopes?: string[];
  hiddenFromPublishing?: boolean;
}
export interface VariablesData {
  collections: VariableCollection[];
  variables: Variable[];
}

/** Doc-level definition keys an operation may change. */
export type MetaKey = "styles" | "variables";
export const META_KEYS: readonly MetaKey[] = ["styles", "variables"];

/** Fields that may be bound to a variable, with the type the variable must have. "fills.0" binds the first fill's colour. */
export const BINDABLE_FIELDS: Readonly<Record<string, VariableResolvedType>> = Object.freeze({
  cornerRadius: "FLOAT",
  itemSpacing: "FLOAT",
  counterAxisSpacing: "FLOAT",
  paddingLeft: "FLOAT",
  paddingRight: "FLOAT",
  paddingTop: "FLOAT",
  paddingBottom: "FLOAT",
  width: "FLOAT",
  height: "FLOAT",
  minWidth: "FLOAT",
  maxWidth: "FLOAT",
  minHeight: "FLOAT",
  maxHeight: "FLOAT",
  opacity: "FLOAT",
  strokeWeight: "FLOAT",
  fontSize: "FLOAT",
  characters: "STRING",
  visible: "BOOLEAN",
});
const PAINT_BINDING = /^(fills|strokes)\.(\d{1,4})$/;

/** The type a binding key needs, or null if the key can't be bound. */
export function bindingType(key: string): VariableResolvedType | null {
  if (PAINT_BINDING.test(key)) return "COLOR";
  return Object.prototype.hasOwnProperty.call(BINDABLE_FIELDS, key) ? (BINDABLE_FIELDS[key] as VariableResolvedType) : null;
}
/** ["fills", 0] for "fills.0", else null. */
export function paintBinding(key: string): ["fills" | "strokes", number] | null {
  const m = PAINT_BINDING.exec(key);
  return m ? [m[1] as "fills" | "strokes", Number(m[2])] : null;
}

export const DEFINITION_LIMITS = { maxStyles: 10_000, maxVariables: 20_000, maxCollections: 1_000, maxModes: 40, maxName: 500 } as const;

// ---- validation ----

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isText = (v: unknown, max: number = DEFINITION_LIMITS.maxName): v is string => typeof v === "string" && v.length <= max;
const isDefId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_:-]{1,64}$/.test(v);
const isUnit = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
export const isColorValue = (v: unknown): v is Color => isObj(v) && isUnit(v.r) && isUnit(v.g) && isUnit(v.b) && isUnit(v.a) && Object.keys(v).length === 4;
export const isAlias = (v: unknown): v is VariableAlias => isObj(v) && v.type === "VARIABLE_ALIAS" && isDefId(v.id) && Object.keys(v).length === 2;

/** Checks node-field values (paints, effects…) with the node validator, injected to avoid an import cycle. */
export type FieldCheck = (key: string, value: unknown) => string | null;

export function stylesProblem(v: unknown, field: FieldCheck): string | null {
  if (!Array.isArray(v)) return "styles must be a list";
  if (v.length > DEFINITION_LIMITS.maxStyles) return `at most ${DEFINITION_LIMITS.maxStyles} styles`;
  const ids = new Set<string>();
  for (let i = 0; i < v.length; i++) {
    const s = v[i] as unknown;
    if (!isObj(s)) return `style ${i} is not an object`;
    if (!isDefId(s.id)) return `style ${i} has no valid id`;
    if (ids.has(s.id)) return `style id ${s.id} is used twice`;
    ids.add(s.id);
    if (!isText(s.name) || !s.name) return `style ${s.id} needs a name`;
    if (s.description !== undefined && !isText(s.description, 10_000)) return `style ${s.id} description must be text`;
    const allowed = new Set(["id", "name", "description", "type"]);
    let p: string | null = null;
    switch (s.type) {
      case "PAINT":
        allowed.add("paints");
        p = field("fills", s.paints);
        break;
      case "EFFECT":
        allowed.add("effects");
        p = s.effects === undefined ? "has no effects" : field("effects", s.effects);
        break;
      case "GRID":
        allowed.add("layoutGrids");
        p = Array.isArray(s.layoutGrids) && s.layoutGrids.every(isObj) ? null : "layoutGrids must be a list of objects";
        break;
      case "TEXT":
        for (const k of ["fontFamily", "fontStyle", "fontSize", "lineHeight", "letterSpacing"]) allowed.add(k);
        if (!isText(s.fontFamily) || !isText(s.fontStyle)) p = "needs a fontFamily and fontStyle";
        else p = field("fontSize", s.fontSize) ?? (s.fontSize === undefined ? "has no fontSize" : null) ?? field("lineHeight", s.lineHeight) ?? field("letterSpacing", s.letterSpacing);
        break;
      default:
        return `style ${s.id} has an unknown type`;
    }
    if (p) return `style ${s.id}: ${p}`;
    for (const k of Object.keys(s)) if (!allowed.has(k)) return `style ${s.id} has an unknown field "${k.slice(0, 40)}"`;
  }
  return null;
}

function valueFits(t: VariableResolvedType, v: unknown): boolean {
  if (isAlias(v)) return true;
  switch (t) {
    case "COLOR":
      return isColorValue(v);
    case "FLOAT":
      return typeof v === "number" && Number.isFinite(v);
    case "STRING":
      return typeof v === "string" && v.length <= 100_000;
    case "BOOLEAN":
      return typeof v === "boolean";
  }
}

export function variablesProblem(v: unknown): string | null {
  if (!isObj(v) || !Array.isArray(v.collections) || !Array.isArray(v.variables)) return "variables must be { collections, variables }";
  if (Object.keys(v).length !== 2) return "variables has unknown fields";
  if (v.collections.length > DEFINITION_LIMITS.maxCollections) return "too many collections";
  if (v.variables.length > DEFINITION_LIMITS.maxVariables) return "too many variables";
  const cols = new Map<string, Set<string>>();
  for (const c of v.collections as unknown[]) {
    if (!isObj(c) || !isDefId(c.id)) return "a collection has no valid id";
    if (cols.has(c.id)) return `collection id ${c.id} is used twice`;
    if (!isText(c.name)) return `collection ${c.id} needs a name`;
    if (!Array.isArray(c.modes) || c.modes.length < 1 || c.modes.length > DEFINITION_LIMITS.maxModes) return `collection ${c.id} needs 1 to ${DEFINITION_LIMITS.maxModes} modes`;
    const modes = new Set<string>();
    for (const m of c.modes as unknown[]) {
      if (!isObj(m) || !isDefId(m.modeId) || !isText(m.name) || Object.keys(m).length !== 2) return `collection ${c.id} has an invalid mode`;
      if (modes.has(m.modeId)) return `collection ${c.id} lists mode ${m.modeId} twice`;
      modes.add(m.modeId);
    }
    if (!isDefId(c.defaultModeId) || !modes.has(c.defaultModeId)) return `collection ${c.id}'s default mode is not one of its modes`;
    for (const k of Object.keys(c)) if (!["id", "name", "modes", "defaultModeId"].includes(k)) return `collection ${c.id} has an unknown field "${k.slice(0, 40)}"`;
    cols.set(c.id, modes);
  }
  const types = new Map<string, VariableResolvedType>();
  const byId = new Map<string, Record<string, unknown>>();
  for (const x of v.variables as unknown[]) {
    if (!isObj(x) || !isDefId(x.id)) return "a variable has no valid id";
    if (byId.has(x.id)) return `variable id ${x.id} is used twice`;
    if (!isText(x.name) || !x.name) return `variable ${x.id} needs a name`;
    if (!VARIABLE_TYPES.includes(x.resolvedType as VariableResolvedType)) return `variable ${x.id} has an unknown type`;
    if (typeof x.collectionId !== "string" || !cols.has(x.collectionId)) return `variable ${x.id} is in a missing collection`;
    for (const k of Object.keys(x)) {
      if (!["id", "name", "collectionId", "resolvedType", "valuesByMode", "description", "scopes", "hiddenFromPublishing"].includes(k)) return `variable ${x.id} has an unknown field "${k.slice(0, 40)}"`;
    }
    if (x.description !== undefined && !isText(x.description, 10_000)) return `variable ${x.id} description must be text`;
    if (x.scopes !== undefined && !(Array.isArray(x.scopes) && x.scopes.every((s) => isText(s, 64)))) return `variable ${x.id} scopes must be a list of words`;
    if (x.hiddenFromPublishing !== undefined && typeof x.hiddenFromPublishing !== "boolean") return `variable ${x.id} hiddenFromPublishing must be true or false`;
    types.set(x.id, x.resolvedType as VariableResolvedType);
    byId.set(x.id, x);
  }
  for (const [id, x] of byId) {
    const modes = cols.get(x.collectionId as string) as Set<string>;
    const vals = x.valuesByMode;
    if (!isObj(vals)) return `variable ${id} has no values`;
    for (const m of Object.keys(vals)) if (!modes.has(m)) return `variable ${id} has a value for unknown mode ${m.slice(0, 64)}`;
    for (const m of modes) {
      const val = vals[m];
      if (val === undefined) return `variable ${id} has no value for mode ${m}`;
      if (!valueFits(x.resolvedType as VariableResolvedType, val)) return `variable ${id}'s value for mode ${m} doesn't fit its type`;
      if (isAlias(val)) {
        const t = types.get(val.id);
        if (!t) return `variable ${id} points to missing variable ${val.id}`;
        if (t !== x.resolvedType) return `variable ${id} points to ${val.id}, which has another type`;
      }
    }
  }
  // Alias cycles: a variable may not reach itself through aliases in any mode.
  const state = new Map<string, 1 | 2>();
  const visit = (id: string): boolean => {
    const s = state.get(id);
    if (s === 2) return false;
    if (s === 1) return true;
    state.set(id, 1);
    const vals = (byId.get(id)?.valuesByMode ?? {}) as Record<string, unknown>;
    for (const val of Object.values(vals)) if (isAlias(val) && visit(val.id)) return true;
    state.set(id, 2);
    return false;
  };
  for (const id of byId.keys()) if (visit(id)) return `variable aliases form a loop (through ${id})`;
  return null;
}

/** A node's `boundVariables`: binding key → alias. */
export function boundVariablesProblem(v: unknown): string | null {
  if (!isObj(v)) return "must be an object of variable aliases";
  for (const [k, a] of Object.entries(v)) {
    if (!bindingType(k)) return `"${k.slice(0, 40)}" can't be bound to a variable`;
    if (!isAlias(a)) return `"${k.slice(0, 40)}" must be { type: "VARIABLE_ALIAS", id }`;
  }
  return null;
}

/** A node's `explicitVariableModes`: collection id → mode id. */
export function explicitModesProblem(v: unknown): string | null {
  if (!isObj(v)) return "must be an object from collection id to mode id";
  for (const [k, m] of Object.entries(v)) if (!isDefId(k) || !isDefId(m)) return "must map collection ids to mode ids";
  return null;
}

export const styleIdProblem = (v: unknown): string | null => (isDefId(v) ? null : "must be a style id");
