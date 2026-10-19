/**
 * A copy of the part of a document an export reads, so the export can run
 * in a worker, and on a fixed version of the document while editing goes on.
 */

import type { Document, ReadonlyNode } from "@illigma/core";
import type { ExportRequest, ExportSource } from "@illigma/export";
import { compareOrder, type Node, type NodeId } from "@illigma/format";

export interface Snapshot {
  nodes: Node[];
  /** Image files by hash, for the image paints the nodes use. */
  images: [string, Uint8Array][];
}

/**
 * The nodes `requests` need: each layer's subtree and its ancestors (their
 * positions place it); the whole page when a setting draws what overlaps
 * the layer (`contentsOnly: false`) or the layer is a page.
 */
export function snapshotFor(doc: Document, requests: readonly ExportRequest[]): Snapshot {
  const nodes = new Map<NodeId, ReadonlyNode>();
  const addSubtree = (id: NodeId) => {
    for (const n of doc.subtree(id)) nodes.set(n.id, n);
  };
  const done = new Set<string>();
  for (const r of requests) {
    const whole = r.settings.contentsOnly === false;
    const key = `${r.nodeId}\u0000${whole}`;
    if (done.has(key)) continue;
    done.add(key);
    const n = doc.get(r.nodeId);
    if (!n) continue;
    let page: ReadonlyNode = n;
    for (let cur: ReadonlyNode | undefined = n; cur; cur = cur.parentId ? doc.get(cur.parentId) : undefined) {
      nodes.set(cur.id, cur);
      page = cur;
    }
    if (whole || n.type === "PAGE") addSubtree(page.id);
    else addSubtree(n.id);
  }
  const hashes = new Set<string>();
  for (const n of nodes.values()) {
    for (const p of [...n.fills, ...n.strokes]) if (p.type === "IMAGE" && p.imageHash) hashes.add(p.imageHash);
  }
  const images: [string, Uint8Array][] = [];
  for (const h of hashes) {
    const bytes = doc.image(h);
    if (bytes) images.push([h, bytes]);
  }
  return { nodes: [...nodes.values()] as Node[], images };
}

/** An export source over a snapshot. */
export class SnapshotSource implements ExportSource {
  private readonly byId = new Map<NodeId, ReadonlyNode>();
  private readonly kids = new Map<NodeId, ReadonlyNode[]>();
  private readonly imageMap: Map<string, Uint8Array>;

  constructor(snapshot: Snapshot) {
    for (const n of snapshot.nodes) {
      this.byId.set(n.id, n);
      if (n.parentId === null) continue;
      const list = this.kids.get(n.parentId) ?? [];
      list.push(n);
      this.kids.set(n.parentId, list);
    }
    for (const list of this.kids.values()) list.sort(compareOrder);
    this.imageMap = new Map(snapshot.images);
  }

  get(id: NodeId): ReadonlyNode | undefined {
    return this.byId.get(id);
  }

  children(parentId: NodeId): readonly ReadonlyNode[] {
    return this.kids.get(parentId) ?? [];
  }

  image(hash: string): Uint8Array | undefined {
    return this.imageMap.get(hash);
  }
}
