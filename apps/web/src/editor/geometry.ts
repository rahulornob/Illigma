import type { Document } from "@illigma/core";
import type { NodeId } from "@illigma/format";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A node's bounds in page (world) coordinates. Rotation is ignored in Phase 0. */
export function absoluteRect(doc: Document, id: NodeId): Rect | null {
  const n = doc.get(id);
  if (!n || n.type === "PAGE") return null;
  let x = n.x;
  let y = n.y;
  let parent = n.parentId ? doc.get(n.parentId) : undefined;
  while (parent && parent.type !== "PAGE") {
    x += parent.x;
    y += parent.y;
    parent = parent.parentId ? doc.get(parent.parentId) : undefined;
  }
  return { x, y, width: n.width, height: n.height };
}

const contains = (r: Rect, x: number, y: number) => x >= r.x && y >= r.y && x <= r.x + r.width && y <= r.y + r.height;

/** The innermost visible frame under a world point: where a newly drawn layer goes. */
export function frameAt(doc: Document, pageId: NodeId, x: number, y: number): NodeId | null {
  let found: NodeId | null = null;
  const visit = (parentId: NodeId) => {
    const kids = doc.children(parentId);
    for (let i = kids.length - 1; i >= 0; i--) {
      const n = kids[i];
      if (!n || !n.visible || n.type !== "FRAME") continue;
      const r = absoluteRect(doc, n.id);
      if (r && contains(r, x, y)) {
        found = n.id;
        visit(n.id);
        return;
      }
    }
  };
  visit(pageId);
  return found;
}
