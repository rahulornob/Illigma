import type { MetaKey, Node, NodeId, NodeKey } from "@illigma/format";

/** `T` with every property and array readonly, at every depth. */
export type DeepReadonly<T> = T extends (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

/** A node as the document hands it out: frozen, so edits must go through a transaction. */
export type ReadonlyNode = DeepReadonly<Node>;

/**
 * Every change to a document is one of these operations. The editor UI,
 * plugins, the MCP server, sync and importers all send the same operations,
 * so undo, saving and (later) collaboration treat every source alike.
 */
export type Operation =
  | { readonly op: "create"; readonly node: ReadonlyNode }
  | { readonly op: "delete"; readonly node: ReadonlyNode }
  | { readonly op: "set"; readonly id: NodeId; readonly key: NodeKey; readonly value: unknown; readonly prev: unknown }
  /** A file-level definition list (local styles, variables) replaced as a whole. `undefined` means none. */
  | { readonly op: "meta"; readonly key: MetaKey; readonly value: unknown; readonly prev: unknown };

/** Operations on nodes (every kind except "meta"). */
export type NodeOperation = Exclude<Operation, { op: "meta" }>;

/** The operation that undoes `o`. */
export function invert(o: Operation): Operation {
  switch (o.op) {
    case "create":
      return { op: "delete", node: o.node };
    case "delete":
      return { op: "create", node: o.node };
    case "set":
      return { op: "set", id: o.id, key: o.key, value: o.prev, prev: o.value };
    case "meta":
      return { op: "meta", key: o.key, value: o.prev, prev: o.value };
  }
}

/** Deep copy of plain JSON data (node fields are always plain JSON). */
export function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

/**
 * Freeze `value` and everything inside it. Children freeze first, so a frozen
 * object is always frozen all the way down and can be skipped.
 */
export function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

/**
 * `deepFreeze(clone(value))` in one pass, which is faster for loading files.
 * Same results as `clone`: -0 becomes 0, undefined and functions are dropped,
 * and anything that isn't a plain object or array goes through JSON.
 */
export function frozenCopy<T>(value: T): DeepReadonly<T> {
  return copyFrozen(value) as DeepReadonly<T>;
}

function copyFrozen(v: unknown): unknown {
  if (typeof v !== "object" || v === null) return v === 0 ? 0 : typeof v === "number" && !Number.isFinite(v) ? null : v;
  if (Array.isArray(v)) {
    const out = new Array<unknown>(v.length);
    for (let i = 0; i < v.length; i++) {
      const x = v[i];
      out[i] = x === undefined || typeof x === "function" ? null : copyFrozen(x);
    }
    return Object.freeze(out);
  }
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) return deepFreeze(clone(v));
  const out: Record<string, unknown> = {};
  for (const k in v) {
    const x = (v as Record<string, unknown>)[k];
    if (x === undefined || typeof x === "function") continue;
    // An own "__proto__" key (JSON.parse makes those) must stay data, not set the prototype.
    if (k === "__proto__") Object.defineProperty(out, k, { value: copyFrozen(x), enumerable: true, writable: true, configurable: true });
    else out[k] = copyFrozen(x);
  }
  return Object.freeze(out);
}

/** Structural equality for plain JSON values. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}
