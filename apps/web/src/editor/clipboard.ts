/**
 * Copy, cut and paste of layers (⌘C ⌘X ⌘V ⇧⌘V), within a file and across
 * files and tabs. The clipboard holds Illigma's own JSON (layers with their
 * page position and the images they use) under CLIPBOARD_TYPE, and the layer
 * names as text/plain for other apps.
 */
import type { Document, ReadonlyNode, Transaction } from "@illigma/core";
import type { Node, NodeId } from "@illigma/format";
import { isAutoLayout } from "@illigma/layout";
import { topmost } from "./edit";
import { placementOf, rotate, toSpace, worldBounds, unionRects, type Rect } from "./geometry";
import { documentOrder, isContainer } from "./layer-ops";

export const CLIPBOARD_TYPE = "application/x-illigma+json";
const KIND = "illigma/layers";

/** A copied layer: its fields, its layers, and where it was on the page. */
export interface ClipNode {
  node: Omit<Node, "id" | "parentId" | "index">;
  children: ClipNode[];
}

export interface ClipTop extends ClipNode {
  /** Top-left on the page and rotation on the page, so a paste can land it in place in any parent. */
  world: { x: number; y: number; rotation: number };
}

export interface ClipData {
  kind: typeof KIND;
  version: 1;
  /** The file it came from, so a paste in the same file can tell (for "paste over the original"). */
  fileId: string;
  /** The ids of the copied layers, to find the originals when pasting in the same file. */
  sourceIds: NodeId[];
  /** The upright box around them on the page. */
  bounds: Rect;
  layers: ClipTop[];
  /** Image bytes (base64) by hash, for every image the layers use. */
  images: Record<string, string>;
}

function clip(doc: Document, n: ReadonlyNode): ClipNode {
  const { id: _id, parentId: _p, index: _i, ...node } = JSON.parse(JSON.stringify(n)) as Node;
  return { node, children: doc.children(n.id).map((k) => clip(doc, k)) };
}

/** Every image hash a node tree uses (paints anywhere in it). */
function imageHashes(value: unknown, out: Set<string>): void {
  if (Array.isArray(value)) for (const v of value) imageHashes(v, out);
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k === "imageHash" && typeof v === "string") out.add(v);
      else imageHashes(v, out);
    }
  }
}

const toBase64 = (bytes: Uint8Array): string => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromBase64 = (b64: string): Uint8Array => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** The clipboard contents for `ids` (the topmost of them, in layer order), or null for nothing copyable. */
export function serializeLayers(doc: Document, ids: readonly NodeId[]): ClipData | null {
  const layers = documentOrder(doc, topmost(doc, ids));
  if (!layers.length) return null;
  const out: ClipTop[] = [];
  const hashes = new Set<string>();
  for (const id of layers) {
    const n = doc.get(id) as ReadonlyNode;
    const parent = placementOf(doc, n.parentId as NodeId);
    const o = rotate(n.x, n.y, parent.rotation);
    const c = clip(doc, n);
    imageHashes(c, hashes);
    out.push({ ...c, world: { x: parent.x + o.x, y: parent.y + o.y, rotation: parent.rotation + (n.rotation || 0) } });
  }
  const images: Record<string, string> = {};
  for (const h of hashes) {
    const bytes = doc.image(h);
    if (bytes) images[h] = toBase64(bytes);
  }
  const bounds = unionRects(layers.map((id) => worldBounds(doc, id)).filter((r): r is Rect => r !== null)) ?? { x: 0, y: 0, width: 0, height: 0 };
  return { kind: KIND, version: 1, fileId: doc.fileId, sourceIds: layers, bounds, layers: out, images };
}

/** The names of the copied layers, one per line (text/plain). */
export const plainText = (data: ClipData): string => data.layers.map((l) => l.node.name).join("\n");

/** Parse clipboard text; null when it isn't Illigma layers. */
export function parseClip(text: string | null | undefined): ClipData | null {
  if (!text) return null;
  try {
    const v = JSON.parse(text) as ClipData;
    if (v && v.kind === KIND && v.version === 1 && Array.isArray(v.layers)) return v;
  } catch {
    // not ours
  }
  return null;
}

export interface PasteOptions {
  /** The current selection: a paste goes into a selected frame, or next to the selected layer. */
  selection: readonly NodeId[];
  pageId: NodeId;
  /** ⇧⌘V: exactly where the layers were on the page. */
  inPlace: boolean;
  /** The part of the page in view: a plain paste whose original place is out of view lands in its middle. */
  viewport?: Rect | undefined;
}

/**
 * Where a paste goes, as in Figma: into the selected frame (or group); next to
 * a selected layer, in its parent; else on the page. A layer selected that is
 * one of the copied ones pastes beside it, in its parent.
 */
export function pasteTarget(doc: Document, data: ClipData, opts: PasteOptions): { parentId: NodeId; after: NodeId | null } {
  const sel = opts.selection.filter((id) => doc.has(id));
  if (sel.length === 1) {
    const n = doc.get(sel[0] as NodeId) as ReadonlyNode;
    const copiedHere = data.fileId === doc.fileId && data.sourceIds.includes(n.id);
    if (!copiedHere && isContainer(n) && n.type !== "PAGE") return { parentId: n.id, after: null };
    if (n.parentId) return { parentId: n.parentId, after: n.id };
  }
  return { parentId: opts.pageId, after: null };
}

/**
 * Paste the layers. Positions: ⇧⌘V keeps the page position; a plain paste
 * keeps it too when that place is in view (and inside the target frame),
 * else centres the layers in view (or in the target frame). Images come
 * along. Returns the new layers' ids.
 */
export function pasteLayers(tx: Transaction, doc: Document, data: ClipData, opts: PasteOptions): NodeId[] {
  const hashMap = new Map<string, string>();
  for (const [h, b64] of Object.entries(data.images ?? {})) {
    try {
      hashMap.set(h, doc.addImage(fromBase64(b64)));
    } catch {
      // a broken image: the paint keeps its hash and shows as missing
    }
  }
  const { parentId, after } = pasteTarget(doc, data, opts);
  const parent = doc.get(parentId);
  const space = placementOf(doc, parentId);
  // Shift so the pasted box lands where it should, on the page.
  let dx = 0;
  let dy = 0;
  if (!opts.inPlace) {
    const b = data.bounds;
    const area: Rect | undefined = parent && parent.type !== "PAGE" ? (worldBounds(doc, parentId) ?? undefined) : opts.viewport;
    const fits = (r: Rect) => b.x >= r.x && b.y >= r.y && b.x + b.width <= r.x + r.width && b.y + b.height <= r.y + r.height;
    if (area && !fits(area)) {
      dx = Math.round(area.x + area.width / 2 - (b.x + b.width / 2));
      dy = Math.round(area.y + area.height / 2 - (b.y + b.height / 2));
    }
  }
  const out: NodeId[] = [];
  let pos: { after: NodeId } | "last" = after ? { after } : "last";
  const flow = parent && isAutoLayout(parent);
  for (const top of data.layers) {
    const local = toSpace(space, top.world.x + dx, top.world.y + dy);
    const rotation = Math.round((top.world.rotation - space.rotation) * 100) / 100;
    const id = create(tx, top, parentId, pos, hashMap, { x: Math.round(local.x * 100) / 100, y: Math.round(local.y * 100) / 100, rotation });
    if (!flow && top.node.layoutPositioning === "ABSOLUTE") tx.set(id, "layoutPositioning", undefined);
    out.push(id);
    pos = { after: id };
  }
  return out;
}

function create(tx: Transaction, c: ClipNode, parentId: NodeId, position: { after: NodeId } | "last", hashes: Map<string, string>, over: Partial<Node> = {}): NodeId {
  const fields = remapImages({ ...c.node, ...over }, hashes) as Node;
  const { type, ...rest } = fields;
  const id = tx.create(type, parentId, rest as never, position);
  for (const k of c.children ?? []) create(tx, k, id, "last", hashes);
  return id;
}

function remapImages<T>(value: T, hashes: Map<string, string>): T {
  if (!hashes.size) return value;
  if (Array.isArray(value)) return value.map((v) => remapImages(v, hashes)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = k === "imageHash" && typeof v === "string" ? (hashes.get(v) ?? v) : remapImages(v, hashes);
    return out as T;
  }
  return value;
}
