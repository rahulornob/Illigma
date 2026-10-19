/**
 * A copy of the part of a document an export reads, so the export can run
 * in a worker, and on a fixed version of the document while editing goes on.
 */

import type { Document, Operation, ReadonlyNode } from "@illigma/core";
import type { ExportRequest, ExportSource } from "@illigma/export";
import { compareOrder, type Node, type NodeId } from "@illigma/format";
import type { FontSource } from "@illigma/renderer";

export interface Snapshot {
  nodes: Node[];
  /** Image files by hash, for the image paints the nodes use. */
  images: [string, Uint8Array][];
  /** Font files beyond the bundled Inter that the nodes' text uses (fonts on this computer). */
  fonts?: FontSource[];
}

/** The font families the snapshot's text layers name, sorted. */
export function snapshotFamilies(snapshot: Snapshot): string[] {
  const out = new Set<string>();
  for (const n of snapshot.nodes) if (n.type === "TEXT" && n.fontFamily) out.add(n.fontFamily);
  return [...out].sort((a, b) => a.localeCompare(b));
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

/**
 * True if `ops` (one change to `doc`, already applied) can change what a
 * snapshot of `nodeId` reads: the layer, anything inside it, its ancestors
 * (they place it), or, with `whole` (`contentsOnly: false`, or a page),
 * anything on its page. A layer moved in or out counts through its old and
 * new parent. Edits elsewhere leave the Export card's preview as it is.
 */
export function changeTouches(doc: Document, ops: readonly Operation[], nodeId: NodeId, whole: boolean): boolean {
  const target = doc.get(nodeId);
  if (!target) return true; // gone (or back): draw again, which says so
  const ancestors = new Set<NodeId>();
  let page: NodeId = nodeId;
  for (let cur: ReadonlyNode | undefined = target; cur; cur = cur.parentId ? doc.get(cur.parentId) : undefined) {
    ancestors.add(cur.id);
    page = cur.id;
  }
  const scope = whole || target.type === "PAGE" ? page : nodeId;
  /** `id` is the layer, an ancestor, or inside the scope. */
  const reaches = (id: unknown): boolean => {
    if (typeof id !== "string") return false;
    if (ancestors.has(id)) return true;
    let steps = 0;
    for (let cur = doc.get(id); cur && steps < 10_000; cur = cur.parentId ? doc.get(cur.parentId) : undefined, steps++) if (cur.id === scope) return true;
    return false;
  };
  for (const o of ops) {
    if (o.op === "meta") continue;
    if (o.op === "set") {
      if (reaches(o.id)) return true;
      if (o.key === "parentId" && (reaches(o.value) || reaches(o.prev))) return true;
    } else if (reaches(o.node.id) || reaches(o.node.parentId)) return true;
  }
  return false;
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
