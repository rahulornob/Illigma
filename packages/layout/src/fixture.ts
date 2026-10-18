/**
 * A small in-memory document for the tests: nodes in insertion order, and a
 * way to apply layout changes. Not part of the public API.
 */

import { defaultNode, type Node, type NodeId, type NodeType } from "@illigma/format";
import type { LayoutChange, LayoutNode, LayoutReader } from "./types.js";

export class MemoryDoc implements LayoutReader {
  readonly nodes = new Map<NodeId, Node>();
  readonly #kids = new Map<NodeId, NodeId[]>();

  constructor(readonly pageId = "page") {
    this.nodes.set(pageId, defaultNode("PAGE", pageId, null, "a0"));
  }

  /** Add a node as the last child of `parentId` (default: the page). */
  add(type: NodeType, id: NodeId, fields: Partial<Node> = {}, parentId: NodeId = this.pageId): NodeId {
    const node = { ...defaultNode(type, id, parentId, "a0"), ...fields, id, type, parentId };
    this.nodes.set(id, node);
    const list = this.#kids.get(parentId) ?? [];
    list.push(id);
    this.#kids.set(parentId, list);
    return id;
  }

  get(id: NodeId): LayoutNode | undefined {
    return this.nodes.get(id);
  }

  children(id: NodeId): readonly LayoutNode[] {
    return (this.#kids.get(id) ?? []).map((k) => this.nodes.get(k) as Node);
  }

  /** The node's box in page coordinates (ignores rotation; enough for the tests). */
  abs(id: NodeId): { x: number; y: number; width: number; height: number } {
    const n = this.nodes.get(id) as Node;
    let x = n.x;
    let y = n.y;
    for (let p = this.nodes.get(n.parentId as string); p && p.type !== "PAGE"; p = this.nodes.get(p.parentId as string)) {
      x += p.x;
      y += p.y;
    }
    return { x, y, width: n.width, height: n.height };
  }

  set(id: NodeId, fields: Partial<Node>): void {
    this.nodes.set(id, { ...(this.nodes.get(id) as Node), ...fields });
  }

  apply(changes: readonly LayoutChange[]): this {
    for (const c of changes) this.set(c.id, { [c.key]: c.value });
    return this;
  }

  /** A deep copy, so a test can compare before and after. */
  clone(): MemoryDoc {
    const copy = new MemoryDoc(this.pageId);
    for (const [id, n] of this.nodes) if (id !== this.pageId) copy.add(n.type, id, structuredClone(n), n.parentId as NodeId);
    return copy;
  }
}
