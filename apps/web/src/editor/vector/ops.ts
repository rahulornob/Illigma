/**
 * Document edits for vectors: fitting a node's box to its network, shapes
 * converted to vectors, flatten, outline stroke and boolean operations. Each
 * runs inside a transaction (or a live edit step) the caller opens.
 */

import type { Document, ReadonlyNode, Transaction } from "@illigma/core";
import { vectorNetworkFromSvgPath, vectorNetworkProblem, type BooleanOperation, type NodeId, type VectorNetwork } from "@illigma/format";
import { ellipseCommands, rectCommands, shapeGeometry, strokeOutline, svgFromCommands, transformCommands } from "@illigma/renderer";
import type { CanvasKit } from "canvaskit-wasm";
import { topmost } from "../edit";
import { placementOf, rotate, toSpace, type Point } from "../geometry";
import { fitNetwork, mergeNetworks, shapeNetwork, transformNetwork } from "./network";

/** Node types the vector editor can edit (shapes convert to a vector first). */
export const VECTOR_EDITABLE = new Set(["VECTOR", "RECTANGLE", "ELLIPSE", "POLYGON", "STAR", "LINE"]);

/** Fields a converted or flattened layer keeps from the one it replaces. */
const SHAPE_ONLY = new Set(["id", "type", "parentId", "index", "pointCount", "innerRadius", "cornerRadius", "vectorNetwork", "booleanOperation", "characters", "fontFamily", "fontStyle", "fontSize", "lineHeight", "letterSpacing", "textAutoResize", "textAlignHorizontal", "textAlignVertical"]);
const CONTAINER_ONLY = ["layoutMode", "itemSpacing", "counterAxisSpacing", "paddingLeft", "paddingRight", "paddingTop", "paddingBottom", "primaryAxisAlignItems", "counterAxisAlignItems", "counterAxisAlignContent", "primaryAxisSizingMode", "counterAxisSizingMode", "layoutWrap"];

function keptFields(n: ReadonlyNode): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(n)) if (!SHAPE_ONLY.has(k) && !CONTAINER_ONLY.includes(k) && v !== undefined) out[k] = v;
  return out;
}

/**
 * Puts `net` (in the node's current own space) on vector `id`, with the
 * node's box re-fitted around it: the shape stays where it is on the canvas.
 */
export function setNetworkFitted(tx: Transaction, doc: Document, id: NodeId, net: VectorNetwork): void {
  const n = doc.get(id);
  if (!n) return;
  const fit = fitNetwork(net);
  const o = rotate(fit.dx, fit.dy, n.rotation);
  tx.set(id, "vectorNetwork", fit.net);
  tx.set(id, "x", n.x + o.x);
  tx.set(id, "y", n.y + o.y);
  tx.set(id, "width", fit.width);
  tx.set(id, "height", fit.height);
}

/**
 * A shape as a VECTOR in its place (same parent, order, transform and
 * paints), as Figma converts a shape on its first vector edit. A vector is
 * returned as it is. Returns the vector's id, or null for types that can't.
 */
export function convertToVector(tx: Transaction, doc: Document, id: NodeId): NodeId | null {
  const n = doc.get(id);
  if (!n || !n.parentId) return null;
  if (n.type === "VECTOR") return id;
  const net = shapeNetwork(n);
  if (!net) return null;
  const fields = keptFields(n);
  const vid = tx.create("VECTOR", n.parentId, { ...fields, vectorNetwork: net }, { after: id });
  tx.delete(id);
  return vid;
}

/** Commands for a layer's filled area in its own space (boxes and ellipses too); groups combine their children. */
function fillCommands(doc: Document, n: ReadonlyNode): { commands: number[]; evenOdd: boolean }[] {
  if (n.type === "GROUP") {
    return doc.children(n.id).flatMap((k) => fillCommands(doc, k).map((f) => ({ evenOdd: f.evenOdd, commands: transformCommands(f.commands, k.x, k.y, k.rotation) })));
  }
  const geo = shapeGeometry(n, doc);
  if (geo) return geo.fills.map((f) => ({ evenOdd: f.evenOdd, commands: [...f.commands] }));
  if (n.type === "ELLIPSE") return [{ evenOdd: false, commands: ellipseCommands(n.width, n.height) }];
  return [{ evenOdd: false, commands: rectCommands(n.width, n.height, n.type === "TEXT" ? 0 : n.cornerRadius) }];
}

/** A layer's own outline as a network in its own space: its network, a shape's points, or (booleans, text) its filled area. */
function ownNetwork(doc: Document, n: ReadonlyNode): VectorNetwork | null {
  if (n.type !== "BOOLEAN_OPERATION" && n.type !== "GROUP" && n.type !== "TEXT") {
    const net = shapeNetwork(n);
    if (net) return net;
  }
  const parts = fillCommands(doc, n).map((f) => {
    const d = svgFromCommands(f.commands);
    return d ? vectorNetworkFromSvgPath(d, { windingRule: f.evenOdd ? "EVENODD" : "NONZERO" }) : null;
  });
  const nets = parts.filter((p): p is VectorNetwork => p !== null);
  return nets.length ? mergeNetworks(nets) : null;
}

/** A layer's network in the space `target` (a parent's own space), through every transform between. */
function networkIn(doc: Document, n: ReadonlyNode, target: NodeId): VectorNetwork | null {
  const net = ownNetwork(doc, n);
  if (!net) return null;
  const here = placementOf(doc, n.id);
  const there = placementOf(doc, target);
  const origin = toSpace(there, here.x, here.y);
  return transformNetwork(net, origin.x, origin.y, here.rotation - there.rotation);
}

/**
 * Flatten (⌘E): the layers become one VECTOR holding all their outlines, in
 * the place of the topmost one, with the paints of the bottom one. Booleans
 * are baked into their result. Returns the new vector's id.
 */
export function flattenLayers(tx: Transaction, doc: Document, ids: readonly NodeId[]): NodeId | null {
  const top = topmost(doc, ids).filter((id) => doc.get(id)?.parentId);
  if (!top.length) return null;
  const order = sortedByOrder(doc, top);
  const last = doc.get(order[order.length - 1] as NodeId) as ReadonlyNode;
  const first = doc.get(order[0] as NodeId) as ReadonlyNode;
  const parent = last.parentId as NodeId;
  const nets = order.map((id) => networkIn(doc, doc.get(id) as ReadonlyNode, parent)).filter((n): n is VectorNetwork => n !== null);
  if (!nets.length) return null;
  const merged = mergeNetworks(nets);
  if (vectorNetworkProblem(merged)) return null;
  const fit = fitNetwork(merged);
  const fields = keptFields(first);
  const id = tx.create(
    "VECTOR",
    parent,
    { ...fields, name: order.length === 1 ? first.name : "Vector", rotation: 0, x: fit.dx, y: fit.dy, width: fit.width, height: fit.height, vectorNetwork: fit.net },
    { after: last.id },
  );
  for (const old of order) tx.delete(old);
  return id;
}

/** Layers in drawing order (bottom first) across parents: by their path of sibling positions. */
function sortedByOrder(doc: Document, ids: readonly NodeId[]): NodeId[] {
  const path = (id: NodeId) => {
    const out: string[] = [];
    for (let n = doc.get(id); n && n.parentId; n = doc.get(n.parentId)) out.unshift(n.index);
    return out;
  };
  const keys = new Map(ids.map((id) => [id, path(id)]));
  return [...ids].sort((a, b) => {
    const pa = keys.get(a) as string[], pb = keys.get(b) as string[];
    for (let i = 0; i < Math.min(pa.length, pb.length); i++) if (pa[i] !== pb[i]) return (pa[i] as string) < (pb[i] as string) ? -1 : 1;
    return pa.length - pb.length;
  });
}

/** Commands of what a layer's stroke follows, in its own space. */
function strokePath(doc: Document, n: ReadonlyNode): number[] {
  const geo = shapeGeometry(n, doc);
  if (geo) return [...geo.stroke];
  if (n.type === "ELLIPSE") return ellipseCommands(n.width, n.height);
  return rectCommands(n.width, n.height, n.cornerRadius);
}

/**
 * Outline stroke (⌥⌘O): each layer's stroke becomes a filled VECTOR (filled
 * with the stroke's paints) in its place. A layer that also has a fill keeps
 * it, without its stroke, under the outline. Returns the outlines' ids.
 */
export function outlineStrokes(tx: Transaction, doc: Document, ids: readonly NodeId[], ck: CanvasKit): NodeId[] {
  const out: NodeId[] = [];
  for (const id of topmost(doc, ids)) {
    const n = doc.get(id);
    if (!n || !n.parentId || n.type === "GROUP" || n.type === "TEXT" || n.type === "PAGE") continue;
    if (!(n.strokeWeight > 0) || !n.strokes.some((p) => p.visible)) continue;
    const align = n.type === "LINE" || (n.type === "VECTOR" && !n.vectorNetwork?.regions.length) ? "CENTER" : (n.strokeAlign ?? "CENTER");
    const commands = strokeOutline(ck, strokePath(doc, n), { weight: n.strokeWeight, cap: n.strokeCap, join: n.strokeJoin, align, fill: fillCommands(doc, n) });
    const d = svgFromCommands(commands);
    if (!d) continue;
    const net = vectorNetworkFromSvgPath(d, { windingRule: "NONZERO" });
    const fit = fitNetwork(net);
    const o = rotate(fit.dx, fit.dy, n.rotation);
    const fields = keptFields(n);
    const vid = tx.create(
      "VECTOR",
      n.parentId,
      { ...fields, name: `${n.name}`, x: n.x + o.x, y: n.y + o.y, width: fit.width, height: fit.height, vectorNetwork: fit.net, fills: n.strokes.map((p) => ({ ...p })), strokes: [], strokeWeight: 0 },
      { after: id },
    );
    const hasFill = n.fills.some((p) => p.visible);
    if (hasFill) tx.set(id, "strokes", []);
    else tx.delete(id);
    out.push(vid);
  }
  return out;
}

const OP_NAME: Record<BooleanOperation, string> = { UNION: "Union", SUBTRACT: "Subtract", INTERSECT: "Intersect", EXCLUDE: "Exclude" };
export const BOOLEAN_LABEL = OP_NAME;

/**
 * Booleans: the layers become the children (operands) of a new
 * BOOLEAN_OPERATION in the place of the topmost one, bottom first, keeping
 * where they are on the canvas. Its box fits its operands; it takes the
 * bottom operand's paints. Selecting a single boolean changes its operation
 * instead. Returns the boolean's id.
 */
export function booleanLayers(tx: Transaction, doc: Document, ids: readonly NodeId[], op: BooleanOperation): NodeId | null {
  const top = topmost(doc, ids).filter((id) => doc.get(id)?.parentId);
  if (top.length === 1 && doc.get(top[0] as NodeId)?.type === "BOOLEAN_OPERATION") {
    tx.set(top[0] as NodeId, "booleanOperation", op);
    return top[0] as NodeId;
  }
  if (top.length < 2) return null;
  const order = sortedByOrder(doc, top);
  const last = doc.get(order[order.length - 1] as NodeId) as ReadonlyNode;
  const first = doc.get(order[0] as NodeId) as ReadonlyNode;
  const parent = last.parentId as NodeId;
  const parentPlace = placementOf(doc, parent);
  // The operands' boxes in the parent's space.
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const id of order) {
    const n = doc.get(id) as ReadonlyNode;
    const p = placementOf(doc, id);
    for (const [cx, cy] of [[0, 0], [n.width, 0], [n.width, n.height], [0, n.height]] as const) {
      const w = rotate(cx, cy, p.rotation);
      const q: Point = toSpace(parentPlace, p.x + w.x, p.y + w.y);
      x0 = Math.min(x0, q.x);
      y0 = Math.min(y0, q.y);
      x1 = Math.max(x1, q.x);
      y1 = Math.max(y1, q.y);
    }
  }
  const fields = keptFields(first);
  const bid = tx.create(
    "BOOLEAN_OPERATION",
    parent,
    {
      ...fields,
      name: OP_NAME[op],
      booleanOperation: op,
      x: x0,
      y: y0,
      width: Math.max(0, x1 - x0),
      height: Math.max(0, y1 - y0),
      rotation: 0,
      opacity: 1,
      effects: [],
    },
    { after: last.id },
  );
  const bPlace = placementOf(doc, bid);
  for (const id of order) {
    const p = placementOf(doc, id);
    const at = toSpace(bPlace, p.x, p.y);
    tx.move(id, bid, "last");
    tx.set(id, "x", at.x);
    tx.set(id, "y", at.y);
    tx.set(id, "rotation", p.rotation - bPlace.rotation);
  }
  return bid;
}
