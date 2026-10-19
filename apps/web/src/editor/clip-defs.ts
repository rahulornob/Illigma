/**
 * Styles and variables travel with copied layers (QC round 9). A copy carries
 * the definitions its layers use; a paste in another file brings them in:
 * a style or variable the file already has (same name and value) is reused,
 * a missing one is added, and one whose name is taken by a different value is
 * detached (the layer keeps its values, the link goes), so a paste never
 * changes how the file's own layers look. Links to definitions the target
 * file doesn't have are always removed, so no layer points at nothing.
 */
import { newId, type Document, type Transaction } from "@illigma/core";
import { STYLE_REF_KEYS, type Style, type Variable, type VariableCollection, type VariableValue, type VariablesData } from "@illigma/format";

const STYLE_KEYS = Object.values(STYLE_REF_KEYS) as string[];

export interface ClipDefinitions {
  styles?: Style[];
  variables?: VariablesData;
}

type Fields = Record<string, unknown>;

const isAlias = (v: unknown): v is { type: "VARIABLE_ALIAS"; id: string } => !!v && typeof v === "object" && (v as Fields).type === "VARIABLE_ALIAS" && typeof (v as Fields).id === "string";

function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as Fields).filter((k) => (a as Fields)[k] !== undefined);
  const kb = Object.keys(b as Fields).filter((k) => (b as Fields)[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => equal((a as Fields)[k], (b as Fields)[k]));
}

/** Every node object in a copied tree (`{ node, children }`). */
type Tree = { node: object; children?: Tree[] };
function* nodesOf(trees: readonly Tree[]): Generator<Fields> {
  for (const t of trees) {
    yield t.node as Fields;
    yield* nodesOf(t.children ?? []);
  }
}

/** The styles, variables (with what they alias) and collections the copied layers use. */
export function collectDefinitions(doc: Document, trees: readonly Tree[]): ClipDefinitions {
  const styleIds = new Set<string>();
  const varIds = new Set<string>();
  const collIds = new Set<string>();
  for (const n of nodesOf(trees)) {
    for (const k of STYLE_KEYS) if (typeof n[k] === "string") styleIds.add(n[k] as string);
    for (const a of Object.values((n.boundVariables as Fields | undefined) ?? {})) if (isAlias(a)) varIds.add(a.id);
    for (const c of Object.keys((n.explicitVariableModes as Fields | undefined) ?? {})) collIds.add(c);
  }
  const all = doc.variables();
  const queue = [...varIds];
  while (queue.length) {
    const v = all.variables.find((x) => x.id === queue.pop());
    if (!v) continue;
    collIds.add(v.collectionId);
    for (const val of Object.values(v.valuesByMode)) if (isAlias(val) && !varIds.has(val.id)) (varIds.add(val.id), queue.push(val.id));
  }
  const out: ClipDefinitions = {};
  const styles = doc.styles().filter((s) => styleIds.has(s.id));
  if (styles.length) out.styles = JSON.parse(JSON.stringify(styles)) as Style[];
  const variables = all.variables.filter((v) => varIds.has(v.id));
  const collections = all.collections.filter((c) => collIds.has(c.id));
  if (variables.length || collections.length) out.variables = JSON.parse(JSON.stringify({ collections, variables })) as VariablesData;
  return out;
}

/** How copied definition ids map into the target file. A missing entry: unlink. */
export interface DefinitionMap {
  styles: Map<string, string>;
  variables: Map<string, string>;
  collections: Map<string, string>;
  modes: Map<string, string>;
}

/** Same file: every definition that still exists maps to itself. */
export function identityMap(doc: Document): DefinitionMap {
  const vars = doc.variables();
  return {
    styles: new Map(doc.styles().map((s) => [s.id, s.id])),
    variables: new Map(vars.variables.map((v) => [v.id, v.id])),
    collections: new Map(vars.collections.map((c) => [c.id, c.id])),
    modes: new Map(vars.collections.flatMap((c) => c.modes.map((m) => [m.modeId, m.modeId] as const))),
  };
}

/** Bring the copied definitions into `doc` (another file), reusing equal ones. */
export function importDefinitions(tx: Transaction, doc: Document, defs: ClipDefinitions): DefinitionMap {
  const map: DefinitionMap = { styles: new Map(), variables: new Map(), collections: new Map(), modes: new Map() };
  // Styles: same name, type and value is the same style; same name with another value is detached.
  const styles = JSON.parse(JSON.stringify(doc.styles())) as Style[];
  let stylesChanged = false;
  for (const s of defs.styles ?? []) {
    const { id: _id, ...value } = s;
    const named = styles.filter((d) => d.name === s.name && d.type === s.type);
    const same = named.find((d) => equal({ ...d, id: undefined }, value));
    if (same) map.styles.set(s.id, same.id);
    else if (!named.length) {
      const copy = { ...JSON.parse(JSON.stringify(s)), id: newId() } as Style;
      styles.push(copy);
      stylesChanged = true;
      map.styles.set(s.id, copy.id);
    }
  }
  if (stylesChanged) tx.setMeta("styles", styles);

  const src = defs.variables;
  if (!src) return map;
  const data = JSON.parse(JSON.stringify(doc.variables())) as VariablesData;
  let varsChanged = false;
  const fresh = new Set<string>(); // collections added by this paste
  for (const c of src.collections) {
    const names = c.modes.map((m) => m.name);
    const match = data.collections.find((d) => d.name === c.name && equal(d.modes.map((m) => m.name), names));
    if (match) {
      map.collections.set(c.id, match.id);
      for (const m of c.modes) map.modes.set(m.modeId, match.modes.find((x) => x.name === m.name)!.modeId);
      continue;
    }
    const modes = c.modes.map((m) => ({ modeId: newId(), name: m.name }));
    c.modes.forEach((m, i) => map.modes.set(m.modeId, modes[i]!.modeId));
    const copy: VariableCollection = { id: newId(), name: c.name, modes, defaultModeId: map.modes.get(c.defaultModeId) ?? modes[0]!.modeId };
    data.collections.push(copy);
    fresh.add(copy.id);
    map.collections.set(c.id, copy.id);
    varsChanged = true;
  }
  const busy = new Set<string>();
  const resolve = (id: string): string | null => {
    if (map.variables.has(id)) return map.variables.get(id)!;
    const v = src.variables.find((x) => x.id === id);
    const coll = v ? map.collections.get(v.collectionId) : undefined;
    if (!v || !coll || busy.has(id)) return null;
    busy.add(id);
    const values: Record<string, VariableValue> = {};
    let ok = true;
    for (const [mode, val] of Object.entries(v.valuesByMode)) {
      const to = map.modes.get(mode);
      if (!to) continue;
      if (isAlias(val)) {
        const target = resolve(val.id);
        if (!target) ok = false;
        else values[to] = { type: "VARIABLE_ALIAS", id: target };
      } else values[to] = JSON.parse(JSON.stringify(val)) as VariableValue;
    }
    busy.delete(id);
    if (!ok) return null;
    const existing = fresh.has(coll) ? undefined : data.variables.find((x) => x.collectionId === coll && x.name === v.name);
    if (existing) {
      if (existing.resolvedType !== v.resolvedType || !equal(existing.valuesByMode, values)) return null;
      map.variables.set(id, existing.id);
      return existing.id;
    }
    const copy: Variable = { ...(JSON.parse(JSON.stringify(v)) as Variable), id: newId(), collectionId: coll, valuesByMode: values };
    data.variables.push(copy);
    varsChanged = true;
    map.variables.set(id, copy.id);
    return copy.id;
  };
  for (const v of src.variables) resolve(v.id);
  if (varsChanged) tx.setMeta("variables", data);
  return map;
}

/** A copied node's definition links, mapped into the target file (unmapped ones removed: the values stay). */
export function remapDefinitions(fields: Fields, map: DefinitionMap): Fields {
  const out = { ...fields };
  for (const k of STYLE_KEYS) {
    if (typeof out[k] !== "string") continue;
    const to = map.styles.get(out[k] as string);
    if (to) out[k] = to;
    else delete out[k];
  }
  const bound = out.boundVariables as Fields | undefined;
  if (bound) {
    const next: Fields = {};
    for (const [k, a] of Object.entries(bound)) {
      const to = isAlias(a) ? map.variables.get(a.id) : undefined;
      if (to) next[k] = { type: "VARIABLE_ALIAS", id: to };
    }
    if (Object.keys(next).length) out.boundVariables = next;
    else delete out.boundVariables;
  }
  const modes = out.explicitVariableModes as Record<string, string> | undefined;
  if (modes) {
    const next: Record<string, string> = {};
    for (const [c, m] of Object.entries(modes)) {
      const cc = map.collections.get(c);
      const mm = map.modes.get(m);
      if (cc && mm) next[cc] = mm;
    }
    if (Object.keys(next).length) out.explicitVariableModes = next;
    else delete out.explicitVariableModes;
  }
  return out;
}
