/**
 * Editing local styles and variables. Every function takes the running
 * transaction, so callers group them into one undo step with node edits;
 * the definitions normalizer then propagates the change to every user.
 */

import type { NodeId, NodeKey, Paint, Style, StyleType, Variable, VariableCollection, VariableResolvedType, VariableValue, VariablesData } from "@illigma/format";
import { DocumentError, type Document, type Transaction } from "../document.js";
import { newId } from "../ids.js";
import { clone, type ReadonlyNode } from "../operations.js";

const mutableStyles = (doc: Document): Style[] => clone(doc.styles()) as Style[];
const mutableVars = (doc: Document): VariablesData => clone(doc.variables()) as VariablesData;

/** Which node field links each style type, for a given role. */
export const STYLE_REF: Record<"fills" | "strokes" | "text" | "effects" | "grid", NodeKey> = {
  fills: "fillStyleId",
  strokes: "strokeStyleId",
  text: "textStyleId",
  effects: "effectStyleId",
  grid: "gridStyleId",
};
export type StyleRole = keyof typeof STYLE_REF;
export const ROLE_TYPE: Record<StyleRole, StyleType> = { fills: "PAINT", strokes: "PAINT", text: "TEXT", effects: "EFFECT", grid: "GRID" };

/** A new style's definition from a node's current values. */
export function styleFromNode(node: ReadonlyNode, role: StyleRole, name: string, id = newId()): Style {
  const n = clone(node) as unknown as Record<string, unknown>;
  switch (role) {
    case "fills":
    case "strokes":
      return { id, name, type: "PAINT", paints: n[role] as Paint[] };
    case "effects":
      return { id, name, type: "EFFECT", effects: (n.effects as never) ?? [] };
    case "grid":
      return { id, name, type: "GRID", layoutGrids: (n.layoutGrids as never) ?? [] };
    case "text": {
      const s: Style = { id, name, type: "TEXT", fontFamily: (n.fontFamily as string) ?? "Inter", fontStyle: (n.fontStyle as string) ?? "Regular", fontSize: (n.fontSize as number) ?? 12 };
      if (n.lineHeight !== undefined) s.lineHeight = n.lineHeight as never;
      if (n.letterSpacing !== undefined) s.letterSpacing = n.letterSpacing as never;
      return s;
    }
  }
}

/** Add a style (at the end, or after `afterId`). Returns its id. */
export function addStyle(tx: Transaction, doc: Document, style: Style, afterId?: string): string {
  const list = mutableStyles(doc);
  const at = afterId ? list.findIndex((s) => s.id === afterId) + 1 : list.length;
  list.splice(at > 0 ? at : list.length, 0, style);
  tx.setMeta("styles", list);
  return style.id;
}

/** Create a style from `nodeId`'s current values and link the node to it. */
export function createStyleFromNode(tx: Transaction, doc: Document, nodeId: NodeId, role: StyleRole, name: string): string {
  const node = doc.get(nodeId);
  if (!node) throw new DocumentError(`Node ${nodeId} does not exist.`);
  const id = addStyle(tx, doc, styleFromNode(node, role, name));
  tx.set(nodeId, STYLE_REF[role], id as never);
  return id;
}

/** Change a style's fields (not its id or type). Every node using it updates. */
export function updateStyle(tx: Transaction, doc: Document, id: string, patch: Partial<Omit<Style, "id" | "type">>): void {
  const list = mutableStyles(doc);
  const i = list.findIndex((s) => s.id === id);
  if (i < 0) throw new DocumentError(`Style ${id} does not exist.`);
  const next = { ...list[i], ...clone(patch) } as Record<string, unknown>;
  for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
  list[i] = next as unknown as Style;
  tx.setMeta("styles", list);
}

export function renameStyle(tx: Transaction, doc: Document, id: string, name: string): void {
  updateStyle(tx, doc, id, { name });
}

/** Move a style to position `to` in the list (folders are just name prefixes). */
export function moveStyle(tx: Transaction, doc: Document, id: string, to: number): void {
  const list = mutableStyles(doc);
  const i = list.findIndex((s) => s.id === id);
  if (i < 0) throw new DocumentError(`Style ${id} does not exist.`);
  const [s] = list.splice(i, 1);
  list.splice(Math.max(0, Math.min(list.length, to)), 0, s as Style);
  tx.setMeta("styles", list);
}

/** Delete a style. Nodes using it keep their values and lose the link (Figma keeps them too). */
export function deleteStyle(tx: Transaction, doc: Document, id: string): void {
  const list = mutableStyles(doc).filter((s) => s.id !== id);
  for (const n of usersOf(doc, (n) => refs(n).includes(id))) for (const key of Object.values(STYLE_REF)) if ((n as unknown as Record<string, unknown>)[key] === id) tx.set(n.id, key, undefined as never);
  tx.setMeta("styles", list.length ? list : undefined);
}

/** Unlink `nodeId` from its style for `role`, keeping the values. */
export function detachStyle(tx: Transaction, nodeId: NodeId, role: StyleRole): void {
  tx.set(nodeId, STYLE_REF[role], undefined as never);
}

/** Link `nodeId` to a style for `role`. */
export function applyStyle(tx: Transaction, nodeId: NodeId, role: StyleRole, styleId: string, doc?: Document): void {
  tx.set(nodeId, STYLE_REF[role], styleId as never);
  // A paint style replaces the paints, so colour bindings on them go.
  const bound = doc?.get(nodeId)?.boundVariables;
  if (bound && (role === "fills" || role === "strokes")) {
    const next = Object.fromEntries(Object.entries(bound).filter(([k]) => !k.startsWith(`${role}.`)));
    tx.set(nodeId, "boundVariables", (Object.keys(next).length ? next : undefined) as never);
  }
}

const refs = (n: ReadonlyNode): string[] => Object.values(STYLE_REF).map((k) => (n as unknown as Record<string, unknown>)[k]).filter((v): v is string => typeof v === "string");

function usersOf(doc: Document, test: (n: ReadonlyNode) => boolean): ReadonlyNode[] {
  const out: ReadonlyNode[] = [];
  for (const p of doc.pages()) for (const n of doc.subtree(p.id)) if (test(n)) out.push(n);
  return out;
}

/** How many layers use a style. */
export function styleUsage(doc: Document, id: string): number {
  return usersOf(doc, (n) => refs(n).includes(id)).length;
}

// ---- variables ----

const DEFAULTS: Record<VariableResolvedType, VariableValue> = { COLOR: { r: 0, g: 0, b: 0, a: 1 }, FLOAT: 0, STRING: "", BOOLEAN: true };

export function addCollection(tx: Transaction, doc: Document, name: string, modeName = "Mode 1"): VariableCollection {
  const v = mutableVars(doc);
  const modeId = newId();
  const c: VariableCollection = { id: newId(), name, modes: [{ modeId, name: modeName }], defaultModeId: modeId };
  v.collections.push(c);
  tx.setMeta("variables", v);
  return c;
}

export function renameCollection(tx: Transaction, doc: Document, id: string, name: string): void {
  const v = mutableVars(doc);
  const c = v.collections.find((c) => c.id === id);
  if (!c) throw new DocumentError(`Collection ${id} does not exist.`);
  c.name = name;
  tx.setMeta("variables", v);
}

/** Delete a collection and its variables; bindings to them are removed (values stay). */
export function deleteCollection(tx: Transaction, doc: Document, id: string): void {
  const v = mutableVars(doc);
  const gone = new Set(v.variables.filter((x) => x.collectionId === id).map((x) => x.id));
  v.collections = v.collections.filter((c) => c.id !== id);
  v.variables = v.variables.filter((x) => !gone.has(x.id));
  for (const x of v.variables) for (const [m, val] of Object.entries(x.valuesByMode)) if (isAliasTo(val, gone)) x.valuesByMode[m] = resolvedOr(doc, val, x.resolvedType);
  unbind(tx, doc, gone);
  for (const n of usersOf(doc, (n) => n.explicitVariableModes?.[id] !== undefined)) {
    const modes = { ...n.explicitVariableModes } as Record<string, string>;
    delete modes[id];
    tx.set(n.id, "explicitVariableModes", (Object.keys(modes).length ? modes : undefined) as never);
  }
  tx.setMeta("variables", v.collections.length ? v : undefined);
}

/** Add a mode; new values copy the default mode's. */
export function addMode(tx: Transaction, doc: Document, collectionId: string, name: string, copyFrom?: string): string {
  const v = mutableVars(doc);
  const c = v.collections.find((c) => c.id === collectionId);
  if (!c) throw new DocumentError(`Collection ${collectionId} does not exist.`);
  const modeId = newId();
  const from = copyFrom ?? c.defaultModeId;
  c.modes.push({ modeId, name });
  for (const x of v.variables) if (x.collectionId === collectionId) x.valuesByMode[modeId] = clone(x.valuesByMode[from] as VariableValue);
  tx.setMeta("variables", v);
  return modeId;
}

export function renameMode(tx: Transaction, doc: Document, collectionId: string, modeId: string, name: string): void {
  const v = mutableVars(doc);
  const m = v.collections.find((c) => c.id === collectionId)?.modes.find((m) => m.modeId === modeId);
  if (!m) throw new DocumentError(`Mode ${modeId} does not exist.`);
  m.name = name;
  tx.setMeta("variables", v);
}

export function setDefaultMode(tx: Transaction, doc: Document, collectionId: string, modeId: string): void {
  const v = mutableVars(doc);
  const c = v.collections.find((c) => c.id === collectionId);
  if (!c || !c.modes.some((m) => m.modeId === modeId)) throw new DocumentError(`Mode ${modeId} does not exist.`);
  c.defaultModeId = modeId;
  tx.setMeta("variables", v);
}

/** Delete a mode (a collection keeps at least one). Frames set to it go back to Auto. */
export function deleteMode(tx: Transaction, doc: Document, collectionId: string, modeId: string): void {
  const v = mutableVars(doc);
  const c = v.collections.find((c) => c.id === collectionId);
  if (!c || !c.modes.some((m) => m.modeId === modeId)) throw new DocumentError(`Mode ${modeId} does not exist.`);
  if (c.modes.length === 1) throw new DocumentError("A collection keeps at least one mode.");
  c.modes = c.modes.filter((m) => m.modeId !== modeId);
  if (c.defaultModeId === modeId) c.defaultModeId = (c.modes[0] as { modeId: string }).modeId;
  for (const x of v.variables) if (x.collectionId === collectionId) delete x.valuesByMode[modeId];
  for (const n of usersOf(doc, (n) => n.explicitVariableModes?.[collectionId] === modeId)) setFrameMode(tx, doc, n.id, collectionId, null);
  tx.setMeta("variables", v);
}

export function addVariable(tx: Transaction, doc: Document, collectionId: string, name: string, type: VariableResolvedType, value?: VariableValue): Variable {
  const v = mutableVars(doc);
  const c = v.collections.find((c) => c.id === collectionId);
  if (!c) throw new DocumentError(`Collection ${collectionId} does not exist.`);
  const valuesByMode: Record<string, VariableValue> = {};
  for (const m of c.modes) valuesByMode[m.modeId] = clone(value ?? DEFAULTS[type]);
  const x: Variable = { id: newId(), name, collectionId, resolvedType: type, valuesByMode };
  v.variables.push(x);
  tx.setMeta("variables", v);
  return x;
}

/** Change a variable's name, description, scopes or values. An alias loop is refused (DocumentError). */
export function updateVariable(tx: Transaction, doc: Document, id: string, patch: Partial<Pick<Variable, "name" | "description" | "scopes" | "hiddenFromPublishing">> & { values?: Record<string, VariableValue> }): void {
  const v = mutableVars(doc);
  const x = v.variables.find((x) => x.id === id);
  if (!x) throw new DocumentError(`Variable ${id} does not exist.`);
  const { values, ...rest } = clone(patch);
  Object.assign(x, rest);
  for (const k of Object.keys(x) as (keyof Variable)[]) if (x[k] === undefined) delete x[k];
  if (values) Object.assign(x.valuesByMode, values);
  tx.setMeta("variables", v);
}

/** Delete a variable. Layers bound to it keep their values and lose the binding; aliases to it become its value. */
export function deleteVariable(tx: Transaction, doc: Document, id: string): void {
  const v = mutableVars(doc);
  const gone = new Set([id]);
  for (const x of v.variables) for (const [m, val] of Object.entries(x.valuesByMode)) if (isAliasTo(val, gone)) x.valuesByMode[m] = resolvedOr(doc, val, x.resolvedType, m);
  v.variables = v.variables.filter((x) => x.id !== id);
  unbind(tx, doc, gone);
  tx.setMeta("variables", v);
}

/** How many layers are bound to a variable. */
export function variableUsage(doc: Document, id: string): number {
  return usersOf(doc, (n) => Object.values(n.boundVariables ?? {}).some((a) => a.id === id)).length;
}

/** Bind a node field (e.g. "cornerRadius", "fills.0") to a variable, or unbind it (`null`): detach keeps the value. */
export function bindVariable(tx: Transaction, doc: Document, nodeId: NodeId, field: string, variableId: string | null): void {
  const n = doc.get(nodeId);
  if (!n) throw new DocumentError(`Node ${nodeId} does not exist.`);
  const next = { ...(n.boundVariables ?? {}) } as Record<string, { type: "VARIABLE_ALIAS"; id: string }>;
  if (variableId === null) delete next[field];
  else next[field] = { type: "VARIABLE_ALIAS", id: variableId };
  tx.set(nodeId, "boundVariables", (Object.keys(next).length ? next : undefined) as never);
  // A paint bound to a variable no longer follows a paint style (as in Figma).
  if (variableId !== null && /^(fills|strokes)\./.test(field)) tx.set(nodeId, field.startsWith("fills") ? "fillStyleId" : "strokeStyleId", undefined as never);
}

/** Set (or with `null`, reset to Auto) the mode of a collection on a frame, section or page. Children inherit it. */
export function setFrameMode(tx: Transaction, doc: Document, nodeId: NodeId, collectionId: string, modeId: string | null): void {
  const n = doc.get(nodeId);
  if (!n) throw new DocumentError(`Node ${nodeId} does not exist.`);
  const next = { ...(n.explicitVariableModes ?? {}) } as Record<string, string>;
  if (modeId === null) delete next[collectionId];
  else next[collectionId] = modeId;
  tx.set(nodeId, "explicitVariableModes", (Object.keys(next).length ? next : undefined) as never);
}

function isAliasTo(val: VariableValue, ids: Set<string>): boolean {
  return typeof val === "object" && val !== null && "type" in val && val.type === "VARIABLE_ALIAS" && ids.has(val.id);
}

/** The value an alias resolves to now (default modes), or the type's default. */
function resolvedOr(doc: Document, val: VariableValue, type: VariableResolvedType, mode?: string): VariableValue {
  const vars = doc.variables();
  let cur: unknown = val;
  for (let i = 0; i < 100 && typeof cur === "object" && cur !== null && "type" in cur && (cur as { type: string }).type === "VARIABLE_ALIAS"; i++) {
    const x = vars.variables.find((x) => x.id === (cur as { id: string }).id);
    const c = vars.collections.find((c) => c.id === x?.collectionId);
    if (!x || !c) return DEFAULTS[type];
    cur = x.valuesByMode[mode && x.valuesByMode[mode] !== undefined ? mode : c.defaultModeId];
  }
  return (cur ?? DEFAULTS[type]) as VariableValue;
}

function unbind(tx: Transaction, doc: Document, ids: Set<string>): void {
  for (const n of usersOf(doc, (n) => Object.values(n.boundVariables ?? {}).some((a) => ids.has(a.id)))) {
    const next = Object.fromEntries(Object.entries(n.boundVariables ?? {}).filter(([, a]) => !ids.has(a.id)));
    tx.set(n.id, "boundVariables", (Object.keys(next).length ? next : undefined) as never);
  }
}

/** Folder path of a "/" name: "Brand/Primary" → ["Brand"], leaf "Primary". */
export function splitName(name: string): { folders: string[]; leaf: string } {
  const parts = name.split("/").map((s) => s.trim()).filter(Boolean);
  return { folders: parts.slice(0, -1), leaf: parts.at(-1) ?? name };
}
