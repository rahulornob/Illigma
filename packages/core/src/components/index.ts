/**
 * Components, variants and instances.
 *
 * Instances are **materialised**: an INSTANCE's children are stored nodes, a
 * copy of its main component's subtree. Every copied node carries `mainId`,
 * the id of the node it copies, and keeps its own stable id. So the
 * renderer, layout, hit testing and export read an instance exactly like a
 * frame and need no changes.
 *
 * `componentsNormalizer` keeps the copies in sync inside every edit (one
 * undo step, exact undo):
 *
 * 1. A user edit to a layer of an instance is recorded as an override on the
 *    outermost instance (`overrides[mainId][field]`; `""` is the instance
 *    itself). Setting a field back to the main component's value removes it.
 * 2. Instances whose main component changed (anything under it), or whose
 *    own `componentId`, `overrides` or `componentProperties` changed, are
 *    rebuilt from main + component properties + overrides. Instances nested
 *    in a component update first, then the instances of that component, until
 *    nothing changes.
 *
 * Nested instances: inside an outermost instance, a nested instance is copied
 * like any layer; the outermost instance's `mainId`s point into its own main
 * component's subtree (which holds the nested instance's expanded children).
 */

import type { Node, NodeId, NodeKey, NodeType, OverrideFields } from "@illigma/format";
import { COMPONENT_KEYS, parseVariantName, variantName } from "@illigma/format";
import type { Document, Normalizer, Transaction } from "../document.js";
import { clone, sameValue, type Operation, type ReadonlyNode } from "../operations.js";

const STRUCTURE = new Set<string>(["id", "type", "parentId", "index"]);
const COMPONENT_ONLY = new Set<string>(COMPONENT_KEYS);
/** Fields of an instance itself that are its own, never taken from the main component. */
const ROOT_LOCAL = new Set<string>([
  ...STRUCTURE,
  ...COMPONENT_KEYS,
  "name",
  "x",
  "y",
  "rotation",
  "visible",
  "locked",
  "layoutPositioning",
  "layoutSizingHorizontal",
  "layoutSizingVertical",
  "constraints",
  "exportSettings",
]);
/** Fields a nested instance copies from the node it copies (its own component settings). */
const NESTED_INSTANCE_KEYS = new Set<string>(["componentId", "overrides", "componentProperties"]);

const MAX_ROUNDS = 16;

type Fields = Record<string, unknown>;

// ---- reading ----

/** The outermost INSTANCE `id` is in or is, or null. */
export function ownerInstance(doc: Document, id: NodeId): ReadonlyNode | null {
  let owner: ReadonlyNode | null = null;
  for (let n = doc.get(id); n; n = n.parentId ? doc.get(n.parentId) : undefined) {
    if (n.type === "INSTANCE") owner = n;
  }
  return owner;
}

/** True if `id` is a layer inside an instance (not the instance itself). */
export function isInsideInstance(doc: Document, id: NodeId): boolean {
  const n = doc.get(id);
  const parent = n?.parentId ? doc.get(n.parentId) : undefined;
  return !!parent && ownerInstance(doc, parent.id) !== null;
}

/** The main COMPONENT of instance `id`, or undefined (missing, or not an instance). */
export function mainComponent(doc: Document, id: NodeId): ReadonlyNode | undefined {
  const n = doc.get(id);
  if (n?.type !== "INSTANCE" || !n.componentId) return undefined;
  const main = doc.get(n.componentId);
  return main?.type === "COMPONENT" ? main : undefined;
}

/** Every COMPONENT in the document, page order. */
export function listComponents(doc: Document): ReadonlyNode[] {
  const out: ReadonlyNode[] = [];
  for (const page of doc.pages()) for (const n of doc.subtree(page.id)) if (n.type === "COMPONENT") out.push(n);
  return out;
}

/** Every outermost instance whose main component is one of `componentIds` (all of them if omitted). */
export function listInstances(doc: Document, componentIds?: ReadonlySet<NodeId>): ReadonlyNode[] {
  const out: ReadonlyNode[] = [];
  const walk = (id: NodeId) => {
    for (const c of doc.children(id)) {
      if (c.type === "INSTANCE") {
        if (!componentIds || (c.componentId && componentIds.has(c.componentId))) out.push(c);
        continue; // nested instances follow their outermost one
      }
      walk(c.id);
    }
  };
  for (const page of doc.pages()) walk(page.id);
  return out;
}

/** The COMPONENT and COMPONENT_SET ancestors of `id` (and itself). */
function componentAncestors(doc: Document, id: NodeId | null, out: Set<NodeId>): void {
  for (let n = id ? doc.get(id) : undefined; n; n = n.parentId ? doc.get(n.parentId) : undefined) {
    if (n.type === "COMPONENT") out.add(n.id);
  }
}

/** The VARIANT properties of a COMPONENT_SET, from its variants' names: property → values in order. */
export function variantProperties(doc: Document, setId: NodeId): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const c of doc.children(setId)) {
    if (c.type !== "COMPONENT") continue;
    for (const [k, v] of Object.entries(parseVariantName(c.name))) {
      const list = (out[k] ??= []);
      if (!list.includes(v)) list.push(v);
    }
  }
  return out;
}

/** The component property definitions an instance of `main` offers (the set's and the component's own). */
export function propertyDefinitions(doc: Document, main: ReadonlyNode): Record<string, NonNullable<Node["componentPropertyDefinitions"]>[string]> {
  const parent = main.parentId ? doc.get(main.parentId) : undefined;
  const fromSet = parent?.type === "COMPONENT_SET" ? (parent.componentPropertyDefinitions ?? {}) : {};
  return clone({ ...fromSet, ...(main.componentPropertyDefinitions ?? {}) }) as Record<string, NonNullable<Node["componentPropertyDefinitions"]>[string]>;
}

// ---- syncing ----

/** What `m` (a node of the main subtree) becomes in the instance, before overrides. */
function copiedFields(m: ReadonlyNode, props: Readonly<Record<string, boolean | string>>): Fields {
  const out: Fields = {};
  for (const [k, v] of Object.entries(m)) {
    if (STRUCTURE.has(k)) continue;
    if (COMPONENT_ONLY.has(k) && !(m.type === "INSTANCE" && NESTED_INSTANCE_KEYS.has(k))) continue;
    out[k] = v;
  }
  const refs = m.componentPropertyReferences;
  if (refs) {
    if (refs.visible && typeof props[refs.visible] === "boolean") out.visible = props[refs.visible];
    if (refs.characters && typeof props[refs.characters] === "string") out.characters = props[refs.characters];
    if (refs.mainComponent && m.type === "INSTANCE" && typeof props[refs.mainComponent] === "string") out.componentId = props[refs.mainComponent];
  }
  return out;
}

/** Bring instance `id` (an outermost one) up to date with its main component. Does nothing if it has none. */
export function syncInstance(doc: Document, tx: Transaction, id: NodeId): void {
  const inst = doc.get(id);
  const main = mainComponent(doc, id);
  if (!inst || !main) return;
  // A component can't contain an instance of itself.
  for (let n: ReadonlyNode | undefined = inst; n; n = n.parentId ? doc.get(n.parentId) : undefined) if (n.id === main.id) return;
  const ov = (inst.overrides ?? {}) as Readonly<Record<string, OverrideFields>>;
  const props = (inst.componentProperties ?? {}) as Readonly<Record<string, boolean | string>>;

  // The instance itself.
  const rootWant: Fields = { ...copiedFields(main, props), ...(ov[""] ?? {}) };
  for (const k of new Set([...Object.keys(rootWant), ...Object.keys(inst)])) {
    if (ROOT_LOCAL.has(k)) continue;
    if (!sameValue(inst[k as keyof ReadonlyNode], rootWant[k])) tx.set(id, k as NodeKey, rootWant[k] as never);
  }
  syncChildren(doc, tx, main.id, id, ov, props, new Set([main.id]));
}

function syncChildren(
  doc: Document,
  tx: Transaction,
  mainParent: NodeId,
  instParent: NodeId,
  ov: Readonly<Record<string, OverrideFields>>,
  props: Readonly<Record<string, boolean | string>>,
  seen: Set<NodeId>,
): void {
  const existing = new Map<string, ReadonlyNode>();
  for (const c of doc.children(instParent)) if (c.mainId && !existing.has(c.mainId)) existing.set(c.mainId, c);
  const wanted: NodeId[] = [];
  const mains = doc.children(mainParent);
  const mainIds = new Set(mains.map((m) => m.id));
  // Copies of layers the main component no longer has go first, so ids are free.
  for (const [mid, c] of existing) if (!mainIds.has(mid)) tx.delete(c.id);
  for (const m of mains) {
    const want: Fields = { ...copiedFields(m, props), ...(ov[m.id] ?? {}), mainId: m.id };
    let e = existing.get(m.id);
    if (e && e.type !== m.type) {
      tx.delete(e.id);
      e = undefined;
    }
    let cid: NodeId;
    if (!e) {
      cid = tx.create(m.type as NodeType, instParent, want as never);
    } else {
      cid = e.id;
      for (const k of new Set([...Object.keys(want), ...Object.keys(e)])) {
        if (STRUCTURE.has(k)) continue;
        if (!sameValue(e[k as keyof ReadonlyNode], want[k])) tx.set(cid, k as NodeKey, want[k] as never);
      }
    }
    wanted.push(cid);
    // A nested instance swapped to another component copies that component's layers.
    let source = m.id;
    if (m.type === "INSTANCE" && typeof want.componentId === "string" && want.componentId !== m.componentId) {
      const swapped = doc.get(want.componentId);
      if (swapped?.type === "COMPONENT" && !seen.has(swapped.id)) source = swapped.id;
    }
    if (!seen.has(source) || source === m.id) {
      const next = new Set(seen);
      next.add(source);
      syncChildren(doc, tx, source, cid, ov, props, next);
    }
  }
  // Order: the copies follow the main component's order (layers added by hand stay after them).
  const current = doc.children(instParent).filter((c) => c.mainId !== undefined).map((c) => c.id);
  if (current.length !== wanted.length || current.some((c, i) => c !== wanted[i])) {
    let prev: NodeId | null = null;
    for (const w of wanted) {
      tx.move(w, instParent, prev ? { after: prev } : "first");
      prev = w;
    }
  }
}

// ---- the normalizer ----

/** The value field `key` of `n` (inside instance `owner`) would have without an override. */
function baseValue(doc: Document, owner: ReadonlyNode, n: ReadonlyNode, key: string): { value: unknown } | null {
  const props = (owner.componentProperties ?? {}) as Record<string, boolean | string>;
  if (n.id === owner.id) {
    const main = mainComponent(doc, owner.id);
    return main ? { value: copiedFields(main, props)[key] } : null;
  }
  const m = n.mainId ? doc.get(n.mainId) : undefined;
  return m ? { value: copiedFields(m, props)[key] } : null;
}

/** Record user edits to instance layers as overrides on their outermost instance. */
function recordOverrides(doc: Document, tx: Transaction, ops: readonly Operation[]): Set<NodeId> {
  const next = new Map<NodeId, Record<string, OverrideFields>>();
  for (const o of ops) {
    if (o.op !== "set" || STRUCTURE.has(o.key) || COMPONENT_ONLY.has(o.key)) continue;
    const n = doc.get(o.id);
    if (!n) continue;
    const owner = ownerInstance(doc, n.id);
    if (!owner) continue;
    const isRoot = owner.id === n.id;
    if (isRoot && ROOT_LOCAL.has(o.key)) continue;
    if (!isRoot && !n.mainId) continue;
    const base = baseValue(doc, owner, n, o.key);
    if (!base) continue;
    const ov = next.get(owner.id) ?? (clone(owner.overrides ?? {}) as Record<string, OverrideFields>);
    next.set(owner.id, ov);
    const key = isRoot ? "" : (n.mainId as string);
    const value = n[o.key as keyof ReadonlyNode];
    const fields = ov[key] ?? {};
    if (sameValue(value, base.value) || value === undefined) delete fields[o.key];
    else fields[o.key] = clone(value);
    if (Object.keys(fields).length) ov[key] = fields;
    else delete ov[key];
  }
  for (const [id, ov] of next) tx.set(id, "overrides", Object.keys(ov).length ? (ov as never) : undefined);
  return new Set(next.keys());
}

/** Path of names from `root` (exclusive) down to `id`, or null if `id` isn't under it. */
function namePath(doc: Document, root: NodeId, id: NodeId): string | null {
  const parts: string[] = [];
  for (let n = doc.get(id); n; n = n.parentId ? doc.get(n.parentId) : undefined) {
    if (n.id === root) return parts.reverse().join("\u0000");
    parts.push(n.name);
  }
  return null;
}

/** An instance switched to another variant: keep its layers and overrides by matching names. */
function remapVariant(doc: Document, tx: Transaction, instId: NodeId, oldMain: NodeId, newMain: NodeId): void {
  const byPath = new Map<string, NodeId>();
  for (const n of doc.subtree(newMain).slice(1)) {
    const p = namePath(doc, newMain, n.id);
    if (p !== null && !byPath.has(p)) byPath.set(p, n.id);
  }
  const remap = (mid: string): string | undefined => {
    const p = namePath(doc, oldMain, mid);
    return p === null ? undefined : byPath.get(p);
  };
  const inst = doc.get(instId);
  if (!inst) return;
  for (const n of doc.subtree(instId).slice(1)) {
    if (!n.mainId || !doc.has(n.mainId)) continue;
    const to = remap(n.mainId);
    if (to && to !== n.mainId) tx.set(n.id, "mainId", to);
  }
  if (inst.overrides) {
    const ov: Record<string, OverrideFields> = {};
    for (const [k, v] of Object.entries(inst.overrides)) {
      if (k === "") ov[k] = clone(v) as OverrideFields;
      else {
        const to = remap(k);
        if (to) ov[to] = clone(v) as OverrideFields;
      }
    }
    tx.set(instId, "overrides", Object.keys(ov).length ? (ov as never) : undefined);
  }
}

/** Update instances after `ops`. With `record`, user edits to instance layers become overrides first. */
export function normalizeComponents(doc: Document, tx: Transaction, ops: readonly Operation[], record = true): void {
  const touched = new Set<NodeId>();
  if (record) {
    for (const o of ops) {
      if (o.op === "set" && o.key === "componentId" && typeof o.prev === "string" && typeof o.value === "string") {
        const n = doc.get(o.id);
        if (n?.type === "INSTANCE" && doc.has(o.prev) && doc.has(o.value)) remapVariant(doc, tx, o.id, o.prev, o.value);
      }
    }
    for (const id of recordOverrides(doc, tx, ops)) touched.add(id);
  }
  let batch: readonly Operation[] = ops;
  let start = tx.ops.length;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const components = new Set<NodeId>();
    for (const o of batch) {
      if (o.op === "meta") continue;
      if (o.op === "set") {
        componentAncestors(doc, o.id, components);
        if (o.key === "parentId") componentAncestors(doc, o.prev as NodeId | null, components);
        const n = doc.get(o.id);
        if (n?.type === "INSTANCE" && (o.key === "componentId" || o.key === "overrides" || o.key === "componentProperties") && ownerInstance(doc, n.id)?.id === n.id) touched.add(n.id);
      } else {
        componentAncestors(doc, o.node.parentId, components);
        if (o.op === "create" && o.node.type === "INSTANCE") {
          const n = doc.get(o.node.id);
          if (n && ownerInstance(doc, n.id)?.id === n.id) touched.add(n.id);
        }
      }
    }
    const targets = new Map<NodeId, ReadonlyNode>();
    for (const id of touched) {
      const n = doc.get(id);
      if (n) targets.set(id, n);
    }
    touched.clear();
    if (components.size) for (const n of listInstances(doc, components)) targets.set(n.id, n);
    if (!targets.size) return;
    // Instances inside components first: their component's instances copy them after.
    const sorted = [...targets.values()].sort((a, b) => depthInComponents(doc, b.id) - depthInComponents(doc, a.id));
    for (const n of sorted) if (doc.has(n.id)) syncInstance(doc, tx, n.id);
    batch = tx.ops.slice(start);
    start = tx.ops.length;
    if (!batch.length) return;
  }
}

function depthInComponents(doc: Document, id: NodeId): number {
  let d = 0;
  for (let n = doc.get(id); n; n = n.parentId ? doc.get(n.parentId) : undefined) if (n.type === "COMPONENT") d++;
  return d;
}

/**
 * The components normalizer, run before `then` (layout). Layout's own
 * changes to main components reach instances in a second pass, laid out again.
 */
export function withComponents(then?: Normalizer): Normalizer {
  return (doc, tx, ops) => {
    // `ops` may not be in `tx` (replay runs the normalizer in a fresh transaction).
    const first = tx.ops.length;
    normalizeComponents(doc, tx, ops, true);
    if (!then) return;
    let start = tx.ops.length;
    then(doc, tx, [...ops, ...tx.ops.slice(first)]);
    const layoutOps = tx.ops.slice(start);
    if (!layoutOps.length) return;
    start = tx.ops.length;
    normalizeComponents(doc, tx, layoutOps, false);
    const synced = tx.ops.slice(start);
    if (synced.length) then(doc, tx, synced);
  };
}

/** The components normalizer on its own. */
export const componentsNormalizer: Normalizer = withComponents();

// ---- commands ----

/** Replace node `id` with one of `type` with the same id, fields and children (a node's type can't change). */
function retype(doc: Document, tx: Transaction, id: NodeId, type: NodeType, edit: (n: Fields, isRoot: boolean) => Fields = (n) => n): void {
  const all = doc.subtree(id);
  const root = all[0];
  if (!root?.parentId) return;
  const siblings = doc.children(root.parentId);
  const i = siblings.findIndex((s) => s.id === id);
  const after = i > 0 ? siblings[i - 1]?.id : undefined;
  const copies = all.map((n, k) => ({ id: n.id, type: k === 0 ? type : n.type, parentId: n.parentId as NodeId, fields: edit(clone(n) as unknown as Fields, k === 0) }));
  tx.delete(id);
  for (const [k, c] of copies.entries()) {
    const f = { ...c.fields };
    for (const s of STRUCTURE) delete f[s];
    tx.create(c.type, c.parentId, f as never, k === 0 ? (after ? { after } : "first") : "last", c.id);
  }
}

/** Box of `ids` in their parent's coordinates (rotation ignored). */
function boundsOf(doc: Document, ids: readonly NodeId[]): { x: number; y: number; width: number; height: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const id of ids) {
    const n = doc.get(id);
    if (!n) continue;
    x0 = Math.min(x0, n.x);
    y0 = Math.min(y0, n.y);
    x1 = Math.max(x1, n.x + n.width);
    y1 = Math.max(y1, n.y + n.height);
  }
  return Number.isFinite(x0) ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : { x: 0, y: 0, width: 100, height: 100 };
}

/** Wrap `ids` (same parent) in a new node of `type`, positioned where they were. Returns the new id. */
function wrap(doc: Document, tx: Transaction, ids: readonly NodeId[], type: NodeType, name: string, pad = 0): NodeId | null {
  const first = doc.get(ids[0] as NodeId);
  if (!first?.parentId) return null;
  const parentId = first.parentId;
  const same = ids.filter((id) => doc.get(id)?.parentId === parentId);
  const order = doc.children(parentId).filter((c) => same.includes(c.id));
  const top = order.at(-1);
  const b = boundsOf(doc, same);
  const id = tx.create(type, parentId, { name, x: b.x - pad, y: b.y - pad, width: b.width + pad * 2, height: b.height + pad * 2, fills: [] }, top ? { after: top.id } : "last");
  for (const c of order) {
    tx.move(c.id, id, "last");
    tx.set(c.id, "x", c.x - b.x + pad);
    tx.set(c.id, "y", c.y - b.y + pad);
  }
  return id;
}

/**
 * Create component (⌥⌘K): one frame (or group) becomes a component; any
 * other selection is wrapped in a new component. Returns the component ids.
 */
export function createComponent(doc: Document, tx: Transaction, ids: readonly NodeId[]): NodeId[] {
  const live = ids.filter((id) => {
    const n = doc.get(id);
    return n && n.type !== "PAGE" && n.type !== "COMPONENT" && n.type !== "COMPONENT_SET" && !isInsideInstance(doc, id);
  });
  if (!live.length) return [];
  if (live.length === 1) {
    const n = doc.get(live[0] as NodeId) as ReadonlyNode;
    if (n.type === "FRAME" && !hasComponent(doc, n.id)) {
      retype(doc, tx, n.id, "COMPONENT");
      return [n.id];
    }
  }
  const taken = new Set(listComponents(doc).map((c) => c.name));
  let k = 1;
  while (taken.has(`Component ${k}`)) k++;
  const id = wrap(doc, tx, live, "COMPONENT", `Component ${k}`);
  return id ? [id] : [];
}

function hasComponent(doc: Document, id: NodeId): boolean {
  return doc.subtree(id).some((n) => n.type === "COMPONENT" || n.type === "COMPONENT_SET");
}

/** Combine as variants: COMPONENTs with one parent go into a new COMPONENT_SET. Returns its id. */
export function combineAsVariants(doc: Document, tx: Transaction, ids: readonly NodeId[]): NodeId | null {
  const comps = ids.map((id) => doc.get(id)).filter((n): n is ReadonlyNode => n?.type === "COMPONENT" && doc.get(n.parentId ?? "")?.type !== "COMPONENT_SET");
  if (comps.length < 1) return null;
  const parentId = comps[0]?.parentId;
  const same = comps.filter((c) => c.parentId === parentId);
  // Figma names variants "Property 1=Default", "Property 1=Variant2", …
  let k = 1;
  for (const c of same) {
    if (Object.keys(parseVariantName(c.name)).length) continue;
    tx.set(c.id, "name", variantName({ "Property 1": k === 1 ? "Default" : `Variant${k}` }));
    k++;
  }
  const baseName = comps[0]?.name && !comps[0].name.includes("=") ? comps[0].name : "Component";
  const setId = wrap(doc, tx, same.map((c) => c.id), "COMPONENT_SET", baseName, 16);
  if (setId) {
    tx.set(setId, "strokes", [{ type: "SOLID", visible: true, color: { r: 0.231, g: 0.51, b: 0.965, a: 1 } }]);
    tx.set(setId, "cornerRadius", 8);
  }
  return setId;
}

/** Add a variant to a set: a copy of its last variant, placed after it. Returns the new component's id. */
export function addVariant(doc: Document, tx: Transaction, setId: NodeId): NodeId | null {
  const set = doc.get(setId);
  const last = doc.children(setId).filter((c) => c.type === "COMPONENT").at(-1);
  if (set?.type !== "COMPONENT_SET" || !last) return null;
  const props = parseVariantName(last.name);
  const first = Object.keys(props)[0] ?? "Property 1";
  const taken = new Set(doc.children(setId).map((c) => c.name));
  let k = 2;
  let name = "";
  do name = variantName({ ...props, [first]: `Variant${k++}` });
  while (taken.has(name));
  const ids = new Map<NodeId, NodeId>();
  let newId: NodeId | null = null;
  for (const n of doc.subtree(last.id)) {
    const f = clone(n) as unknown as Fields;
    for (const s of STRUCTURE) delete f[s];
    const parent = n.id === last.id ? setId : (ids.get(n.parentId as NodeId) as NodeId);
    if (n.id === last.id) {
      f.name = name;
      f.y = last.y + last.height + 16;
    }
    const id = tx.create(n.type, parent, f as never, n.id === last.id ? { after: last.id } : "last");
    ids.set(n.id, id);
    newId ??= id;
  }
  tx.set(setId, "height", Math.max(set.height, last.y + last.height * 2 + 32));
  return newId;
}

/** A new instance of `componentId` under `parentId` at (x, y). The normalizer fills in its layers. */
export function createInstance(doc: Document, tx: Transaction, componentId: NodeId, parentId: NodeId, at: { x: number; y: number }): NodeId {
  const main = doc.get(componentId);
  if (main?.type !== "COMPONENT") throw new Error("Not a component.");
  const setParent = main.parentId ? doc.get(main.parentId) : undefined;
  const name = setParent?.type === "COMPONENT_SET" ? setParent.name : main.name;
  const id = tx.create("INSTANCE", parentId, { name, x: at.x, y: at.y, width: main.width, height: main.height, componentId });
  syncInstance(doc, tx, id);
  return id;
}

/** Detach instance (⌥⌘B): it becomes a frame with the same layers; nested instances stay instances. */
export function detachInstance(doc: Document, tx: Transaction, id: NodeId): boolean {
  const inst = doc.get(id);
  if (inst?.type !== "INSTANCE" || ownerInstance(doc, id)?.id !== id) return false;
  const ov = (inst.overrides ?? {}) as Record<string, OverrideFields>;
  // Nested instances become outermost: their layers' mainIds now point into their own main component.
  const nested = new Map<NodeId, Record<string, OverrideFields>>();
  const remapped = new Map<NodeId, string | undefined>();
  for (const n of doc.subtree(id).slice(1)) {
    // The topmost instance between the detached one and `n`.
    let outerNested: NodeId | undefined;
    for (let p = n.parentId ? doc.get(n.parentId) : undefined; p && p.id !== id; p = p.parentId ? doc.get(p.parentId) : undefined) {
      if (p.type === "INSTANCE") outerNested = p.id;
    }
    if (!outerNested) continue;
    const to = n.mainId ? doc.get(n.mainId)?.mainId : undefined;
    remapped.set(n.id, to);
    if (n.mainId && ov[n.mainId] && to) {
      const o = nested.get(outerNested) ?? (clone(doc.get(outerNested)?.overrides ?? {}) as Record<string, OverrideFields>);
      o[to] = { ...(o[to] ?? {}), ...clone(ov[n.mainId]) };
      nested.set(outerNested, o);
    }
  }
  retype(doc, tx, id, "FRAME", (f, isRoot) => {
    for (const k of COMPONENT_KEYS) {
      if (!isRoot && f.type === "INSTANCE" && NESTED_INSTANCE_KEYS.has(k)) continue;
      if (k === "mainId" && !isRoot && remapped.has(f.id as NodeId)) {
        const to = remapped.get(f.id as NodeId);
        if (to) f.mainId = to;
        else delete f.mainId;
        continue;
      }
      delete f[k];
    }
    if (f.type === "INSTANCE" && nested.has(f.id as NodeId)) f.overrides = nested.get(f.id as NodeId);
    return f;
  });
  return true;
}

/** Reset overrides: all of instance `id`'s, or only those of its layer `layerId`. */
export function resetOverrides(doc: Document, tx: Transaction, id: NodeId, layerId?: NodeId): void {
  const owner = ownerInstance(doc, layerId ?? id);
  if (!owner) return;
  if (!layerId || layerId === owner.id) {
    tx.set(owner.id, "overrides", undefined);
    tx.set(owner.id, "componentProperties", undefined);
    syncInstance(doc, tx, owner.id);
    return;
  }
  const n = doc.get(layerId);
  if (!n?.mainId || !owner.overrides?.[n.mainId]) return;
  const ov = clone(owner.overrides) as Record<string, OverrideFields>;
  delete ov[n.mainId];
  tx.set(owner.id, "overrides", Object.keys(ov).length ? (ov as never) : undefined);
  syncInstance(doc, tx, owner.id);
}

/** Set a component property on instance `id` (`undefined` goes back to the default). */
export function setInstanceProperty(doc: Document, tx: Transaction, id: NodeId, name: string, value: boolean | string | undefined): void {
  const n = doc.get(id);
  if (n?.type !== "INSTANCE") return;
  const props = { ...(n.componentProperties ?? {}) } as Record<string, boolean | string>;
  if (value === undefined) delete props[name];
  else props[name] = value;
  tx.set(id, "componentProperties", Object.keys(props).length ? (props as never) : undefined);
}

/** Switch instance `id` to the variant of its set with `prop` = `value` (closest match on the other properties). */
export function setVariant(doc: Document, tx: Transaction, id: NodeId, prop: string, value: string): boolean {
  const main = mainComponent(doc, id);
  const set = main?.parentId ? doc.get(main.parentId) : undefined;
  if (!main || set?.type !== "COMPONENT_SET") return false;
  const want = { ...parseVariantName(main.name), [prop]: value };
  let best: ReadonlyNode | undefined;
  let score = -1;
  for (const c of doc.children(set.id)) {
    if (c.type !== "COMPONENT") continue;
    const p = parseVariantName(c.name);
    if (p[prop] !== value) continue;
    const s = Object.entries(want).filter(([k, v]) => p[k] === v).length;
    if (s > score) {
      best = c;
      score = s;
    }
  }
  if (!best || best.id === main.id) return false;
  tx.set(id, "componentId", best.id);
  return true;
}

/**
 * Add a component property to `componentId` (or its set, for a variant),
 * bound to layer `layerId` inside it: BOOLEAN drives its visibility, TEXT its
 * text, INSTANCE_SWAP its main component (a nested instance). Returns the name.
 */
export function addComponentProperty(doc: Document, tx: Transaction, layerId: NodeId, type: "BOOLEAN" | "TEXT" | "INSTANCE_SWAP"): string | null {
  const layer = doc.get(layerId);
  if (!layer) return null;
  let comp: ReadonlyNode | undefined;
  for (let n: ReadonlyNode | undefined = layer; n; n = n.parentId ? doc.get(n.parentId) : undefined) {
    if (n.type === "COMPONENT") {
      comp = n;
      break;
    }
  }
  if (!comp) return null;
  if (type === "TEXT" && layer.type !== "TEXT") return null;
  if (type === "INSTANCE_SWAP" && (layer.type !== "INSTANCE" || !layer.componentId)) return null;
  const parent = comp.parentId ? doc.get(comp.parentId) : undefined;
  const owner = parent?.type === "COMPONENT_SET" ? parent : comp;
  const defs = clone(owner.componentPropertyDefinitions ?? {}) as NonNullable<Node["componentPropertyDefinitions"]>;
  const base = type === "BOOLEAN" ? "Show " + layer.name : type === "TEXT" ? layer.name : "Swap " + layer.name;
  let name = base;
  for (let k = 2; defs[name]; k++) name = `${base} ${k}`;
  defs[name] = { type, defaultValue: type === "BOOLEAN" ? layer.visible : type === "TEXT" ? (layer.characters ?? "") : (layer.componentId as string) };
  tx.set(owner.id, "componentPropertyDefinitions", defs as never);
  const key = type === "BOOLEAN" ? "visible" : type === "TEXT" ? "characters" : "mainComponent";
  tx.set(layerId, "componentPropertyReferences", { ...(layer.componentPropertyReferences ?? {}), [key]: name } as never);
  return name;
}
