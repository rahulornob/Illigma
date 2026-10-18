import type { Node, NodeId, NodeKey } from "@illigma/format";

/**
 * Every change to a document is one of these operations. The editor UI,
 * plugins, the MCP server, sync and importers all send the same operations,
 * so undo, saving and (later) collaboration treat every source alike.
 */
export type Operation =
  | { op: "create"; node: Node }
  | { op: "delete"; node: Node }
  | { op: "set"; id: NodeId; key: NodeKey; value: unknown; prev: unknown };

/** The operation that undoes `o`. */
export function invert(o: Operation): Operation {
  switch (o.op) {
    case "create":
      return { op: "delete", node: o.node };
    case "delete":
      return { op: "create", node: o.node };
    case "set":
      return { op: "set", id: o.id, key: o.key, value: o.prev, prev: o.value };
  }
}

/** Deep copy of plain JSON data (node fields are always plain JSON). */
export function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

/** Structural equality for plain JSON values. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}
