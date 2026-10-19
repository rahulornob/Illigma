/**
 * Resolving styles and variables into nodes' own fields.
 *
 * Nodes keep both the link (`fillStyleId`, `boundVariables`…) and the
 * resolved value in the plain field (`fills`, `cornerRadius`…), so the
 * renderer, layout and export read ordinary fields and need no change.
 * `withDefinitions` wraps the document's normalizer: at the end of every
 * edit it rewrites the fields of every node whose links, definitions or
 * mode changed, in the same transaction, so one undo reverts the edit and
 * everything it propagated.
 *
 * Editing a linked field by hand (a fill's colour on a node with a fill
 * style, a bound corner radius) detaches it, as in Figma.
 */

import {
  bindingType,
  isAlias,
  isColorValue,
  NODE_KEYS,
  paintBinding,
  type Color,
  type NodeId,
  type NodeKey,
  type Style,
  type Variable,
  type VariableCollection,
  type VariableValue,
  type VariablesData,
} from "@illigma/format";
import type { Document, Normalizer, Transaction } from "../document.js";
import type { DeepReadonly, Operation, ReadonlyNode } from "../operations.js";
import { sameValue } from "../operations.js";

type Vars = DeepReadonly<VariablesData>;
type RVar = DeepReadonly<Variable>;

const STYLE_FIELDS: Record<string, readonly string[]> = {
  fillStyleId: ["fills"],
  strokeStyleId: ["strokes"],
  textStyleId: ["fontFamily", "fontStyle", "fontSize", "lineHeight", "letterSpacing"],
  effectStyleId: ["effects"],
  gridStyleId: ["layoutGrids"],
};
const STYLE_KEYS = Object.keys(STYLE_FIELDS);
/** The style key whose fields include `key`. */
const STYLE_OF_FIELD = new Map<string, string>();
for (const [k, fields] of Object.entries(STYLE_FIELDS)) for (const f of fields) STYLE_OF_FIELD.set(f, k);
const KNOWN = new Set<string>(NODE_KEYS);

/** Lookup tables for one resolution pass. */
export class Resolver {
  readonly styles = new Map<string, DeepReadonly<Style>>();
  readonly vars = new Map<string, RVar>();
  readonly cols = new Map<string, DeepReadonly<VariableCollection>>();
  readonly #modeCache = new Map<string, string>();

  constructor(readonly doc: Document) {
    for (const s of doc.styles()) this.styles.set(s.id, s);
    const v: Vars = doc.variables();
    for (const c of v.collections) this.cols.set(c.id, c);
    for (const x of v.variables) this.vars.set(x.id, x);
  }

  /** The mode of `collectionId` that applies at `node`: its own or an ancestor's explicit mode, else the default. */
  modeFor(node: ReadonlyNode | undefined, collectionId: string): string | undefined {
    const col = this.cols.get(collectionId);
    if (!col) return undefined;
    const valid = (m: string | undefined) => (m !== undefined && col.modes.some((x) => x.modeId === m) ? m : undefined);
    let steps = 0;
    for (let cur = node; cur && steps < 10_000; cur = cur.parentId ? this.doc.get(cur.parentId) : undefined, steps++) {
      const key = `${cur.id}\u0000${collectionId}`;
      const cached = this.#modeCache.get(key);
      if (cached) return cached;
      const m = valid(cur.explicitVariableModes?.[collectionId]);
      if (m) {
        this.#modeCache.set(key, m);
        return m;
      }
    }
    return col.defaultModeId;
  }

  /** A variable's value for `node` (aliases followed, each in the mode that applies at `node`), or undefined. */
  value(varId: string, node: ReadonlyNode | undefined, mode?: string): DeepReadonly<Exclude<VariableValue, { type: "VARIABLE_ALIAS" }>> | undefined {
    let id = varId;
    let explicitMode = mode;
    for (let depth = 0; depth < 100; depth++) {
      const v = this.vars.get(id);
      if (!v) return undefined;
      const m = explicitMode ?? this.modeFor(node, v.collectionId);
      explicitMode = undefined;
      if (m === undefined) return undefined;
      const val = v.valuesByMode[m];
      if (val === undefined) return undefined;
      if (isAlias(val)) {
        id = val.id;
        continue;
      }
      return val as DeepReadonly<Exclude<VariableValue, { type: "VARIABLE_ALIAS" }>>;
    }
    return undefined; // alias loop (refused on save, but never trust)
  }

  /** The fields `node` should hold given its links, as [key, value] pairs (only those that resolve). */
  resolved(node: ReadonlyNode): [string, unknown][] {
    const out: [string, unknown][] = [];
    const n = node as unknown as Record<string, unknown>;
    for (const sk of STYLE_KEYS) {
      const id = n[sk];
      if (typeof id !== "string") continue;
      const s = this.styles.get(id);
      if (!s) continue;
      switch (s.type) {
        case "PAINT":
          out.push([sk === "fillStyleId" ? "fills" : "strokes", s.paints]);
          break;
        case "EFFECT":
          if (sk === "effectStyleId") out.push(["effects", s.effects]);
          break;
        case "GRID":
          if (sk === "gridStyleId" && KNOWN.has("layoutGrids")) out.push(["layoutGrids", s.layoutGrids]);
          break;
        case "TEXT":
          if (sk !== "textStyleId" || node.type !== "TEXT") break;
          out.push(["fontFamily", s.fontFamily], ["fontStyle", s.fontStyle], ["fontSize", s.fontSize]);
          out.push(["lineHeight", s.lineHeight], ["letterSpacing", s.letterSpacing]);
          break;
      }
    }
    const bound = node.boundVariables;
    if (bound) {
      let fills: unknown[] | undefined;
      let strokes: unknown[] | undefined;
      for (const [key, alias] of Object.entries(bound)) {
        const val = this.value(alias.id, node);
        if (val === undefined) continue;
        const t = bindingType(key);
        const pb = paintBinding(key);
        if (pb && isColorValue(val)) {
          const [list, i] = pb;
          const from = list === "fills" ? (fills ??= structuredClone((out.find((e) => e[0] === "fills")?.[1] ?? node.fills) as unknown[])) : (strokes ??= structuredClone((out.find((e) => e[0] === "strokes")?.[1] ?? node.strokes) as unknown[]));
          const p = from[i] as { type?: string; color?: Color } | undefined;
          if (p && p.type === "SOLID") p.color = { ...(val as Color) };
          continue;
        }
        if (t === "FLOAT" && typeof val === "number") out.push([key, key === "opacity" ? Math.min(1, Math.max(0, val)) : key === "fontSize" ? Math.max(0.01, val) : val]);
        else if (t === "STRING" && typeof val === "string" && node.type === "TEXT") out.push([key, val]);
        else if (t === "BOOLEAN" && typeof val === "boolean") out.push([key, val]);
      }
      if (fills) out.push(["fills", fills]);
      if (strokes) out.push(["strokes", strokes]);
    }
    return out;
  }
}

/** Write `node`'s resolved fields with `tx`, skipping unchanged and invalid ones. */
function apply(tx: Transaction, r: Resolver, id: NodeId): void {
  const node = r.doc.get(id);
  if (!node) return;
  for (const [key, value] of r.resolved(node)) {
    if (!KNOWN.has(key)) continue;
    const cur = (node as unknown as Record<string, unknown>)[key];
    if (sameValue(cur, value)) continue;
    try {
      tx.set(id, key as NodeKey, value as never);
    } catch {
      // A value the field refuses (e.g. a negative padding from a variable) keeps the old one.
    }
  }
}

const LINK_KEYS = new Set<string>([...STYLE_KEYS, "boundVariables", "explicitVariableModes"]);

/** True if the node links to anything. */
function linked(n: ReadonlyNode): boolean {
  const o = n as unknown as Record<string, unknown>;
  for (const k of LINK_KEYS) if (k !== "explicitVariableModes" && o[k] !== undefined) return true;
  return false;
}

/**
 * Detach links whose field this edit set by hand to something else: the
 * node keeps the value it was given, and loses the style or binding.
 */
function detachEdited(doc: Document, tx: Transaction, ops: readonly Operation[], r: Resolver): void {
  const setKeys = new Map<NodeId, Set<string>>();
  for (const o of ops) {
    if (o.op !== "set") continue;
    let s = setKeys.get(o.id);
    if (!s) setKeys.set(o.id, (s = new Set()));
    s.add(o.key);
  }
  for (const [id, keys] of setKeys) {
    const node = doc.get(id);
    if (!node || !linked(node)) continue;
    const want = new Map(r.resolved(node));
    for (const key of keys) {
      const sk = STYLE_OF_FIELD.get(key);
      if (sk && !keys.has(sk) && (node as unknown as Record<string, unknown>)[sk] !== undefined && want.has(key) && !sameValue(want.get(key), (node as unknown as Record<string, unknown>)[key])) {
        tx.set(id, sk as NodeKey, undefined as never);
      }
    }
    const bound = doc.get(id)?.boundVariables;
    if (!bound || keys.has("boundVariables")) continue;
    let next: Record<string, unknown> | undefined;
    for (const [bk, alias] of Object.entries(bound)) {
      const pb = paintBinding(bk);
      const field = pb ? pb[0] : bk;
      if (!keys.has(field)) continue;
      const val = r.value(alias.id, node);
      const cur = pb ? ((node[pb[0]][pb[1]] as { color?: unknown } | undefined)?.color) : (node as unknown as Record<string, unknown>)[bk];
      if (val !== undefined && !sameValue(val, cur)) {
        next ??= { ...bound };
        delete next[bk];
      }
    }
    if (next) tx.set(id, "boundVariables", (Object.keys(next).length ? next : undefined) as never);
  }
}

/** Node ids whose resolved fields may have changed in `ops`. */
function affected(doc: Document, ops: readonly Operation[]): Set<NodeId> | "all" {
  const out = new Set<NodeId>();
  for (const o of ops) {
    if (o.op === "meta") return "all";
    if (o.op === "create") {
      if (o.node.type !== "PAGE") for (const n of doc.subtree(o.node.id)) out.add(n.id);
    } else if (o.op === "set") {
      if (o.key === "explicitVariableModes" || o.key === "parentId") for (const n of doc.subtree(o.id)) out.add(n.id);
      else if (LINK_KEYS.has(o.key)) out.add(o.id);
    }
  }
  return out;
}

/** Every node linked to a definition, walking the whole document. */
function allLinked(doc: Document): NodeId[] {
  const out: NodeId[] = [];
  for (const p of doc.pages()) for (const n of doc.subtree(p.id)) if (linked(n)) out.push(n.id);
  return out;
}

/** Resolve styles and variables for what `ops` touched (see the module comment). */
export const definitionsNormalizer: Normalizer = (doc, tx, ops) => {
  const hasDefs = doc.styles().length > 0 || doc.variables().variables.length > 0;
  if (!hasDefs && !ops.some((o) => o.op === "meta")) return;
  const r = new Resolver(doc);
  detachEdited(doc, tx, ops, r);
  const ids = affected(doc, ops);
  const list = ids === "all" ? allLinked(doc) : [...ids].filter((id) => {
    const n = doc.get(id);
    return n !== undefined && linked(n);
  });
  for (const id of list) apply(tx, r, id);
};

/** A normalizer that resolves definitions first, then runs `inner` (e.g. layout) on everything so far. */
export function withDefinitions(inner?: Normalizer): Normalizer {
  return (doc, tx, ops) => {
    const start = tx.ops.length;
    definitionsNormalizer(doc, tx, ops);
    // `ops` may not be in `tx` (replay), so pass them plus what resolving added.
    if (inner) inner(doc, tx, [...ops, ...tx.ops.slice(start)]);
  };
}
