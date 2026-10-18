/**
 * Import documents saved by the old browser prototype (removed 2026-10-12,
 * code at commit 8e3bd2f) into a `.illigma` file.
 *
 * The prototype saved one JSON document (`localStorage["illigma.document.v1"]`
 * or "Save editable document"): a title, a canvas colour, colour swatches,
 * one or more pages, each with frames ("artboards") and a flat, z-ordered
 * list of objects (rect, ellipse, path, text). Objects and frames use
 * absolute page coordinates; objects rotate about their centre; groups are a
 * shared `groupId` on their members. Older documents have no `pages` or
 * `artboards`, only one `artboard` and `objects`; they are read the way the
 * prototype's `preparePages` upgraded them.
 *
 * Input comes from users, so nothing about it is trusted: unusable input is
 * refused with a `FormatError` in plain language, broken layers are skipped
 * or repaired, and everything format v0 can't hold yet is listed in
 * `warnings`, one line per kind with counts, never dropped silently.
 */

import { keysBetween } from "./fractional-index.js";
import { FormatError } from "./package.js";
import { defaultNode, FORMAT_NAME, FORMAT_VERSION, type Color, type IlligmaFile, type Node, type NodeType, type Paint } from "./schema.js";
import { validateFile } from "./validate.js";

export interface PrototypeImportOptions {
  /** Makes node and file ids. Defaults to random 12-character ids. Must return ids matching NODE_ID_PATTERN. */
  newId?: () => string;
  /** The new file's creation time. Defaults to now. */
  now?: Date;
  /** Written to the manifest's `app` field. */
  app?: string;
}

export interface PrototypeImport {
  file: IlligmaFile;
  /** Plain-language notes about what couldn't be carried over, one per kind. */
  warnings: string[];
}

/** Size limits. The prototype itself allowed 100 pages, 100 frames and 3,000 objects per page. */
export const PROTOTYPE_IMPORT_LIMITS = {
  /** Characters of JSON text, when the input is a string. */
  maxJsonChars: 64 * 1024 * 1024,
  maxPages: 100,
  maxFramesPerPage: 1_000,
  maxLayersPerPage: 10_000,
  /** Longer names are shortened. */
  maxNameChars: 1_000,
  /** Longer text layers are shortened. */
  maxTextChars: 1_000_000,
} as const;

/** The prototype's own canvas size limits. */
const MAX_COORD = 1_000_000;
const MAX_SIZE = 50_000;
const DEFAULT_LINE_HEIGHT = 1.16; // the prototype's default line height multiplier
const ID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Prototype layout-item properties (auto layout children and constraints). */
const SIZING_KEYS = ["widthSizing", "heightSizing", "minWidth", "maxWidth", "minHeight", "maxHeight", "layoutAbsolute", "columnSpan", "rowSpan"];
const CONSTRAINT_KEYS = ["constraints", "constraintTextWrap"];
const OBJECT_KEYS = new Set([
  "id", "type", "name", "x", "y", "w", "h", "rotation", "opacity", "fill", "stroke", "strokeWidth", "visible", "locked",
  "effects", "frameId", "groupId", "radius", "d", "baseW", "baseH", "text", "fontSize", "fontFamily", "fontWeight",
  "letterSpacing", "lineHeight", ...SIZING_KEYS, ...CONSTRAINT_KEYS,
]);
const FRAME_KEYS = new Set([
  "id", "name", "x", "y", "width", "height", "fill", "parentId", "clipContent", "effects", "autoLayout", "visible", "locked",
  ...SIZING_KEYS, ...CONSTRAINT_KEYS,
]);
const OBJECT_TYPES: Record<string, NodeType> = { rect: "RECTANGLE", ellipse: "ELLIPSE", path: "VECTOR", text: "TEXT" };
const OBJECT_NAMES: Record<string, string> = { rect: "Rectangle", ellipse: "Ellipse", path: "Path", text: "Text" };
const FONT_STYLES: [number, string][] = [
  [100, "Thin"], [200, "Extra Light"], [300, "Light"], [400, "Regular"], [500, "Medium"],
  [600, "Semi Bold"], [700, "Bold"], [800, "Extra Bold"], [900, "Black"],
];
const EFFECT_NAMES: Record<string, [string, string]> = {
  "drop-shadow": ["drop shadow", "drop shadows"],
  "inner-shadow": ["inner shadow", "inner shadows"],
  "layer-blur": ["layer blur", "layer blurs"],
  "background-blur": ["background blur", "background blurs"],
};

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => v !== null && typeof v === "object" && !Array.isArray(v);
/** An own property only, so keys like "constructor" never reach Object.prototype. */
const get = (o: Obj, key: string): unknown => (Object.prototype.hasOwnProperty.call(o, key) ? o[key] : undefined);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Computed values (rotated positions, pixel line heights) are rounded to a millionth, so files don't carry float noise like 99.75999999999999. */
const round = (v: number) => Math.round(v * 1e6) / 1e6;
const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

function randomId(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ID_ALPHABET[b % ID_ALPHABET.length];
  return out;
}

/** "#rgb", "#rgba", "#rrggbb", "#rrggbbaa", "rgb(…)", "rgba(…)" → a colour; "none" or "transparent" → null. */
export function parsePrototypeColor(value: string): Color | null | undefined {
  const s = value.trim().toLowerCase();
  if (s === "none" || s === "transparent") return null;
  let m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s);
  if (m) {
    let hex = m[1] as string;
    if (hex.length <= 4) hex = [...hex].map((c) => c + c).join("");
    const ch = (i: number) => parseInt(hex.slice(i, i + 2), 16) / 255;
    return { r: ch(0), g: ch(2), b: ch(4), a: hex.length === 8 ? ch(6) : 1 };
  }
  m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(s);
  if (m) {
    const [r, g, b] = [m[1], m[2], m[3]].map((c) => Number(c) / 255) as [number, number, number];
    const a = m[4] === undefined ? 1 : Number(m[4]);
    if ([r, g, b, a].every((c) => Number.isFinite(c) && c >= 0 && c <= 1)) return { r, g, b, a };
  }
  return undefined; // unreadable
}

/** Counts of everything that couldn't be carried over exactly, turned into one warning per kind at the end. */
class Notes {
  readonly counts = new Map<string, number>();
  readonly effects = new Map<string, number>();
  readonly unknownKeys = new Set<string>();
  readonly canvasColors = new Set<string>();
  add(kind: string, n = 1): void {
    this.counts.set(kind, (this.counts.get(kind) ?? 0) + n);
  }
  n(kind: string): number {
    return this.counts.get(kind) ?? 0;
  }
  warnings(): string[] {
    const w: string[] = [];
    const n = (k: string) => this.n(k);
    if (n("skippedPages")) w.push(`Skipped ${plural(n("skippedPages"), "page", "pages")} that couldn't be read.`);
    if (n("skippedFrames")) w.push(`Skipped ${plural(n("skippedFrames"), "frame", "frames")} that couldn't be read (missing or broken position or size).`);
    if (n("skippedLayers")) w.push(`Skipped ${plural(n("skippedLayers"), "layer", "layers")} that couldn't be read (unknown type, or missing or broken position or size).`);
    if (n("missingFrame")) w.push(`${plural(n("missingFrame"), "layer", "layers")} pointed to a frame that doesn't exist, so ${n("missingFrame") === 1 ? "it was" : "they were"} placed on the page.`);
    if (n("frameLoop")) w.push(`Broke ${plural(n("frameLoop"), "loop", "loops")} of frames nested inside each other by moving ${n("frameLoop") === 1 ? "one frame" : "one frame per loop"} onto the page.`);
    if (n("reset")) w.push(`Reset ${plural(n("reset"), "broken value", "broken values")} (such as a non-number opacity) to ${n("reset") === 1 ? "its default" : "their defaults"}.`);
    if (n("trimmed")) w.push(`Shortened ${plural(n("trimmed"), "very long name or text", "very long names or texts")}.`);
    if (n("paths")) w.push(`${plural(n("paths"), "path shape keeps", "path shapes keep")} position, size and colour, but not ${n("paths") === 1 ? "its outline" : "their outlines"}: format v0 can't store vector outlines yet.`);
    if (this.effects.size) {
      const total = [...this.effects.values()].reduce((a, b) => a + b, 0);
      const parts = [...this.effects].map(([type, count]) => {
        const names = EFFECT_NAMES[type] ?? ["effect", "effects"];
        return plural(count, names[0], names[1]);
      });
      w.push(`Left out ${plural(total, "effect", "effects")} (${parts.join(", ")}) on ${plural(n("effectLayers"), "layer", "layers")}: format v0 has no effects yet.`);
    }
    if (n("gradients")) w.push(`Left out ${plural(n("gradients"), "gradient", "gradients")}: format v0 holds solid colours only.`);
    if (n("badColors")) w.push(`Left out ${plural(n("badColors"), "colour", "colours")} that couldn't be read.`);
    if (n("letterSpacing")) w.push(`Left out letter spacing on ${plural(n("letterSpacing"), "text layer", "text layers")}: format v0 has no letter spacing yet.`);
    if (n("stretchedText")) w.push(`${plural(n("stretchedText"), "text layer was", "text layers were")} stretched unevenly; the font size now matches the height, so ${n("stretchedText") === 1 ? "it" : "they"} may look narrower or wider.`);
    if (n("autoLayout")) w.push(`${plural(n("autoLayout"), "frame uses", "frames use")} auto layout. Layers keep their current positions, but the auto layout settings are left out until format v0 can hold them.`);
    if (n("constraints")) w.push(`Left out resizing constraints on ${plural(n("constraints"), "layer", "layers")}.`);
    if (n("sizing")) w.push(`Left out sizing rules (hug, fill, minimum and maximum size, grid span or absolute position) on ${plural(n("sizing"), "layer", "layers")}.`);
    if (n("noClip")) w.push(`${plural(n("noClip"), "frame", "frames")} didn't clip ${n("noClip") === 1 ? "its" : "their"} content; in format v0 frames always clip.`);
    if (n("groupsMoved")) w.push(`${plural(n("groupsMoved"), "group had", "groups had")} other layers between ${n("groupsMoved") === 1 ? "its" : "their"} members; each group now sits where its top layer was, so stacking may differ slightly.`);
    if (n("swatches")) w.push(`Left out the document's ${plural(n("swatches"), "colour swatch", "colour swatches")}: format v0 has no colour styles yet.`);
    if (this.canvasColors.size) w.push(`Left out the canvas background colour (${[...this.canvasColors].slice(0, 5).join(", ")}): format v0 has no page background colour yet.`);
    if (this.unknownKeys.size) {
      const keys = [...this.unknownKeys].sort();
      const shown = keys.slice(0, 8).join(", ") + (keys.length > 8 ? `, and ${keys.length - 8} more` : "");
      w.push(`Left out settings Illigma doesn't recognise on ${plural(n("unknownLayers"), "layer", "layers")}: ${shown}.`);
    }
    return w;
  }
}

/** A frame (prototype "artboard"), with absolute coordinates. */
interface FrameIn {
  raw: Obj;
  protoId: string | null;
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  parent: FrameIn | null;
  /** Position in the page's frame list, from 1; unnamed frames are called "Frame <number>", as in the prototype. */
  number: number;
}

/** An object, after validation, with its absolute box (before rotation) and z position. */
interface LayerIn {
  raw: Obj;
  protoId: string | null;
  kind: string;
  z: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
}

/** One child slot of a page or frame: a frame, a layer, or a group of layers. */
type Entry =
  | { kind: "frame"; frame: FrameIn }
  | { kind: "layer"; layer: LayerIn }
  | { kind: "group"; members: LayerIn[]; z: number };

/**
 * Convert a prototype document (parsed JSON, or JSON text) into a `.illigma`
 * file. Throws `FormatError` when the input is not a usable prototype
 * document; otherwise every problem is a warning.
 */
export function importPrototypeJson(json: unknown, opts: PrototypeImportOptions = {}): PrototypeImport {
  const L = PROTOTYPE_IMPORT_LIMITS;
  if (typeof json === "string") {
    if (json.length > L.maxJsonChars) throw new FormatError(`This file is too large to import (more than ${L.maxJsonChars / 1024 / 1024} MB).`);
    try {
      json = JSON.parse(json);
    } catch {
      throw new FormatError("This file is not valid JSON, so it can't be an Illigma prototype document.");
    }
  }
  if (!isObj(json)) throw new FormatError("This is not an Illigma prototype document: it should be a JSON object.");
  const doc = json;
  if (get(doc, "format") === FORMAT_NAME || isObj(get(doc, "manifest"))) {
    throw new FormatError("This is already an .illigma file, not an old prototype document. Open it in Illigma directly.");
  }
  const version = get(doc, "version");
  if (version !== undefined && version !== 1) {
    throw new FormatError(
      finite(version)
        ? `This prototype document is version ${version}. Only version 1 documents can be imported.`
        : "This prototype document has no valid version number. Only version 1 documents can be imported.",
    );
  }

  // Pages: the saved form lists them; older documents are one page made of the root fields.
  const rawPages = get(doc, "pages");
  let pages: Obj[];
  const usesPages = Array.isArray(rawPages) && rawPages.length > 0;
  if (Array.isArray(rawPages) && usesPages) {
    if (rawPages.length > L.maxPages) throw new FormatError(`This document has ${rawPages.length.toLocaleString("en-US")} pages. At most ${L.maxPages} can be imported.`);
    pages = rawPages.filter(isObj);
    if (pages.length === 0) throw new FormatError("None of this document's pages could be read.");
  } else {
    if (!Array.isArray(get(doc, "objects"))) {
      throw new FormatError('This is not an Illigma prototype document: it has no "objects" list and no pages.');
    }
    pages = [{ name: undefined, artboard: get(doc, "artboard"), artboards: get(doc, "artboards"), objects: get(doc, "objects"), canvasColor: get(doc, "canvasColor") }];
  }
  const notes = new Notes();
  if (usesPages && Array.isArray(rawPages) && pages.length < rawPages.length) notes.add("skippedPages", rawPages.length - pages.length);

  const newId = opts.newId ?? randomId;
  const used = new Set<string>();
  const freshId = (): string => {
    for (let i = 0; i < 100; i++) {
      const id = newId();
      if (!used.has(id)) {
        used.add(id);
        return id;
      }
    }
    throw new FormatError("Couldn't make unique layer ids: the id generator keeps repeating itself.");
  };
  const text = (v: unknown, fallback: string): string => {
    if (typeof v !== "string") return fallback;
    if (v.length > L.maxNameChars) {
      notes.add("trimmed");
      return v.slice(0, L.maxNameChars);
    }
    return v;
  };

  const title = typeof get(doc, "title") === "string" ? text(get(doc, "title"), "").trim() : "";
  const fileName = title || "Imported prototype";
  const nodes: Node[] = [];
  const pageKeys = keysBetween(null, null, Math.max(1, pages.length));
  const pageEntries: { id: string; name: string }[] = [];

  const swatches = get(doc, "swatches");
  if (Array.isArray(swatches) && swatches.length) notes.add("swatches", swatches.length);

  pages.forEach((page, pageIndex) => {
    // Older documents have no pages: their one page is named after the document.
    const name = text(get(page, "name"), "").trim() || (usesPages ? `Page ${pageIndex + 1}` : title || "Page 1");
    const pageNode: Node = { ...defaultNode("PAGE", freshId(), null, pageKeys[pageIndex] as string), name };
    nodes.push(pageNode);
    pageEntries.push({ id: pageNode.id, name });
    const canvas = get(page, "canvasColor") ?? get(doc, "canvasColor");
    if (typeof canvas === "string" && canvas.trim()) notes.canvasColors.add(canvas.trim().slice(0, 40));
    importPage(page, pageNode.id, nodes, notes, freshId, text);
  });

  const file: IlligmaFile = {
    manifest: {
      format: FORMAT_NAME,
      version: FORMAT_VERSION,
      fileId: freshId(),
      name: fileName,
      pages: pageEntries,
      created: (opts.now ?? new Date()).toISOString(),
      app: opts.app ?? "Illigma (prototype import)",
    },
    nodes,
  };
  const problems = validateFile(file);
  if (problems.length) throw new FormatError("The import produced a file that isn't valid. Please report this as a bug.", problems);
  return { file, warnings: notes.warnings() };
}

function importPage(page: Obj, pageId: string, out: Node[], notes: Notes, freshId: () => string, text: (v: unknown, fallback: string) => string): void {
  const L = PROTOTYPE_IMPORT_LIMITS;

  // Frames: `artboards`, or the single `artboard` of older documents.
  let rawFrames = get(page, "artboards");
  if (!Array.isArray(rawFrames) || rawFrames.length === 0) rawFrames = isObj(get(page, "artboard")) ? [get(page, "artboard")] : [];
  const frameList = rawFrames as unknown[];
  if (frameList.length > L.maxFramesPerPage) {
    throw new FormatError(`A page has ${frameList.length.toLocaleString("en-US")} frames. At most ${L.maxFramesPerPage.toLocaleString("en-US")} per page can be imported.`);
  }
  const frames: FrameIn[] = [];
  const frameById = new Map<string, FrameIn>();
  frameList.forEach((raw, i) => {
    if (!isObj(raw)) {
      return notes.add("skippedFrames");
    }
    const x = get(raw, "x") ?? 0;
    const y = get(raw, "y") ?? 0;
    const width = get(raw, "width");
    const height = get(raw, "height");
    if (!finite(x) || !finite(y) || !finite(width) || !finite(height) || width <= 0 || height <= 0) {
      return notes.add("skippedFrames");
    }
    const protoId = typeof get(raw, "id") === "string" ? (get(raw, "id") as string) : null;
    const frame: FrameIn = { raw, protoId, id: freshId(), x: coord(x, notes), y: coord(y, notes), width: size(width, notes), height: size(height, notes), parent: null, number: i + 1 };
    frames.push(frame);
    if (protoId !== null && !frameById.has(protoId)) frameById.set(protoId, frame);
  });
  for (const f of frames) {
    const parentId = get(f.raw, "parentId");
    if (parentId === undefined || parentId === null) continue;
    const parent = typeof parentId === "string" ? frameById.get(parentId) : undefined;
    if (parent && parent !== f) f.parent = parent;
    else notes.add("missingFrame");
  }
  // Break parent loops: walk up from each frame; one that reaches itself moves to the page.
  for (const f of frames) {
    const seen = new Set<FrameIn>([f]);
    for (let cur = f.parent; cur; cur = cur.parent) {
      if (seen.has(cur)) {
        f.parent = null;
        notes.add("frameLoop");
        break;
      }
      seen.add(cur);
    }
  }

  // Layers, in z-order (first is bottom).
  const rawObjects = get(page, "objects");
  const objectList = Array.isArray(rawObjects) ? (rawObjects as unknown[]) : [];
  if (objectList.length > L.maxLayersPerPage) {
    throw new FormatError(`A page has ${objectList.length.toLocaleString("en-US")} layers. At most ${L.maxLayersPerPage.toLocaleString("en-US")} per page can be imported.`);
  }
  const layers: LayerIn[] = [];
  objectList.forEach((raw, z) => {
    if (!isObj(raw)) return notes.add("skippedLayers");
    const kind = get(raw, "type");
    const [x, y, w, h] = ["x", "y", "w", "h"].map((k) => get(raw, k));
    if (typeof kind !== "string" || !Object.prototype.hasOwnProperty.call(OBJECT_TYPES, kind) || !finite(x) || !finite(y) || !finite(w) || !finite(h) || w <= 0 || h <= 0) {
      return notes.add("skippedLayers");
    }
    const rotation = get(raw, "rotation") ?? 0;
    if (!finite(rotation)) notes.add("reset");
    const protoId = typeof get(raw, "id") === "string" ? (get(raw, "id") as string) : null;
    layers.push({ raw, protoId, kind, z, x: coord(x, notes), y: coord(y, notes), w: size(w, notes), h: size(h, notes), rotation: finite(rotation) ? rotation % 360 : 0 });
  });

  // Which frame holds each layer: `frameId`, or (older documents) the topmost frame containing its centre, as the prototype did.
  const holder = new Map<LayerIn, FrameIn | null>();
  for (const layer of layers) {
    const frameId = get(layer.raw, "frameId");
    if (frameId === undefined) {
      const cx = layer.x + layer.w / 2;
      const cy = layer.y + layer.h / 2;
      holder.set(layer, [...frames].reverse().find((f) => cx >= f.x && cy >= f.y && cx <= f.x + f.width && cy <= f.y + f.height) ?? null);
    } else if (frameId === null) {
      holder.set(layer, null);
    } else {
      const frame = typeof frameId === "string" ? frameById.get(frameId) : undefined;
      if (!frame) notes.add("missingFrame");
      holder.set(layer, frame ?? null);
    }
  }

  // Build each container's children: frames first (the prototype drew every frame below every layer), then layers and groups by z-order.
  const children = new Map<FrameIn | null, Entry[]>();
  const entriesOf = (c: FrameIn | null) => {
    let list = children.get(c);
    if (!list) children.set(c, (list = []));
    return list;
  };
  for (const f of frames) entriesOf(f.parent).push({ kind: "frame", frame: f });
  const groups = new Map<string, { kind: "group"; members: LayerIn[]; z: number }>();
  for (const layer of layers) {
    const container = holder.get(layer) ?? null;
    const groupId = get(layer.raw, "groupId");
    if (typeof groupId === "string" && groupId) {
      const key = `${container?.id ?? ""}\u0000${groupId}`;
      let group = groups.get(key);
      if (!group) {
        group = { kind: "group", members: [], z: layer.z };
        groups.set(key, group);
        entriesOf(container).push(group);
      }
      group.members.push(layer);
      group.z = layer.z; // a group sits where its top member was
    } else {
      entriesOf(container).push({ kind: "layer", layer });
    }
  }
  // Note groups whose members weren't next to each other in the z-order (the stacking may change slightly).
  for (const [container, list] of children) {
    const zs = list.flatMap((e) => (e.kind === "layer" ? [e.layer.z] : e.kind === "group" ? e.members.map((m) => m.z) : []));
    for (const e of list) {
      if (e.kind !== "group") continue;
      const lo = e.members[0]?.z ?? 0;
      if (zs.some((z) => z > lo && z < e.z && !e.members.some((m) => m.z === z))) notes.add("groupsMoved");
    }
    const ez = (e: Entry) => (e.kind === "frame" ? -1 : e.kind === "group" ? e.z : e.layer.z);
    list.sort((a, b) => (a.kind === "frame" ? (b.kind === "frame" ? 0 : -1) : b.kind === "frame" ? 1 : ez(a) - ez(b)));
    // Auto layout frames order their children by `childOrder`. That order is
    // also the z-order in Illigma (as in Figma), so it decides the sibling order.
    const al = container ? get(container.raw, "autoLayout") : undefined;
    const order = isObj(al) && get(al, "enabled") === true ? get(al, "childOrder") : undefined;
    if (Array.isArray(order)) {
      const rank = new Map<string, number>();
      order.forEach((id, i) => typeof id === "string" && !rank.has(id) && rank.set(id, i));
      const r = (e: Entry): number => {
        const ids = e.kind === "frame" ? [e.frame.protoId] : e.kind === "layer" ? [e.layer.protoId] : e.members.map((m) => m.protoId);
        const ranks = ids.flatMap((id) => (id !== null && rank.has(id) ? [rank.get(id) as number] : []));
        return ranks.length ? Math.min(...ranks) : Infinity;
      };
      const before = new Map(list.map((e, i) => [e, i]));
      list.sort((a, b) => r(a) - r(b) || (before.get(a) as number) - (before.get(b) as number));
    }
  }

  const groupNumber = { n: 0, next: () => ++groupNumber.n };
  // Emit nodes depth-first. Coordinates become relative to the parent node.
  const emit = (container: FrameIn | null, parentId: string, originX: number, originY: number): void => {
    const list = children.get(container) ?? [];
    const keys = keysBetween(null, null, list.length);
    list.forEach((entry, i) => {
      const index = keys[i] as string;
      if (entry.kind === "frame") {
        const f = entry.frame;
        out.push(frameNode(f, parentId, index, originX, originY, notes, text));
        emit(f, f.id, f.x, f.y);
      } else if (entry.kind === "layer") {
        out.push(layerNode(entry.layer, freshId(), parentId, index, originX, originY, notes, text));
      } else {
        const box = boundsOf(entry.members);
        const group: Node = {
          ...defaultNode("GROUP", freshId(), parentId, index),
          name: `Group ${groupNumber.next()}`,
          x: round(box.x - originX),
          y: round(box.y - originY),
          width: round(box.w),
          height: round(box.h),
        };
        out.push(group);
        const memberKeys = keysBetween(null, null, entry.members.length);
        entry.members.forEach((m, j) => out.push(layerNode(m, freshId(), group.id, memberKeys[j] as string, box.x, box.y, notes, text)));
      }
    });
  };
  emit(null, pageId, 0, 0);
}

function coord(v: number, notes: Notes): number {
  if (Math.abs(v) <= MAX_COORD) return v;
  notes.add("reset");
  return clamp(v, -MAX_COORD, MAX_COORD);
}

function size(v: number, notes: Notes): number {
  if (v <= MAX_SIZE) return v;
  notes.add("reset");
  return MAX_SIZE;
}

/** A solid paint for a prototype colour string; [] for "none", missing or unreadable values. */
function paints(v: unknown, notes: Notes): Paint[] {
  if (v === undefined || v === null) return [];
  if (typeof v !== "string") {
    notes.add("badColors");
    return [];
  }
  const color = parsePrototypeColor(v);
  if (color === undefined) notes.add(/gradient/i.test(v) ? "gradients" : "badColors");
  return color ? [{ type: "SOLID", visible: true, color }] : [];
}

function noteCommon(raw: Obj, known: Set<string>, notes: Notes): void {
  const effects = get(raw, "effects");
  if (Array.isArray(effects) && effects.length) {
    notes.add("effectLayers");
    for (const e of effects) {
      const type = isObj(e) && typeof get(e, "type") === "string" ? (get(e, "type") as string) : "";
      const key = Object.prototype.hasOwnProperty.call(EFFECT_NAMES, type) ? type : "other";
      notes.effects.set(key, (notes.effects.get(key) ?? 0) + 1);
    }
  }
  // TODO(0.7): map these to the auto layout and constraint fields once they are in the schema.
  if (CONSTRAINT_KEYS.some((k) => get(raw, k) !== undefined)) notes.add("constraints");
  if (SIZING_KEYS.some((k) => get(raw, k) !== undefined)) notes.add("sizing");
  const unknown = Object.keys(raw).filter((k) => !known.has(k));
  if (unknown.length) {
    notes.add("unknownLayers");
    for (const k of unknown) if (notes.unknownKeys.size < 50) notes.unknownKeys.add(k.slice(0, 40));
  }
}

/** `v` if it is a usable number, `fallback` if it is missing; a broken value is reset to `fallback` and noted. */
function numberOr(v: unknown, fallback: number, ok: (n: number) => boolean, notes: Notes): number {
  if (v === undefined) return fallback;
  if (finite(v) && ok(v)) return v;
  notes.add("reset");
  return fallback;
}

function flag(raw: Obj, key: string, fallback: boolean, notes: Notes): boolean {
  const v = get(raw, key);
  if (v === undefined) return fallback;
  if (typeof v === "boolean") return v;
  notes.add("reset");
  return fallback;
}

function frameNode(f: FrameIn, parentId: string, index: string, originX: number, originY: number, notes: Notes, text: (v: unknown, fallback: string) => string): Node {
  const raw = f.raw;
  noteCommon(raw, FRAME_KEYS, notes);
  const al = get(raw, "autoLayout");
  // TODO(0.7): map `autoLayout` (direction, gap, padding, alignment, wrap, sizing, grid tracks) once the schema has auto layout fields.
  if (isObj(al) && get(al, "enabled") === true) notes.add("autoLayout");
  if (get(raw, "clipContent") === false) notes.add("noClip");
  return {
    ...defaultNode("FRAME", f.id, parentId, index),
    name: text(get(raw, "name"), "").trim() || `Frame ${f.number}`,
    visible: flag(raw, "visible", true, notes),
    locked: flag(raw, "locked", false, notes),
    x: f.x - originX,
    y: f.y - originY,
    width: f.width,
    height: f.height,
    fills: paints(get(raw, "fill"), notes),
  };
}

/** The prototype rotates about the box centre; Illigma (like Figma) rotates about the top-left corner, so move that corner to where the rotation put it. */
function rotatedOrigin(l: LayerIn): { x: number; y: number } {
  const a = (l.rotation * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const cx = l.x + l.w / 2;
  const cy = l.y + l.h / 2;
  return { x: cx - (l.w / 2) * cos + (l.h / 2) * sin, y: cy - (l.w / 2) * sin - (l.h / 2) * cos };
}

/** The box around some layers, rotation included (the prototype's `objectBounds`). */
function boundsOf(layers: LayerIn[]): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const l of layers) {
    const a = (l.rotation * Math.PI) / 180;
    const hw = (Math.abs(Math.cos(a)) * l.w + Math.abs(Math.sin(a)) * l.h) / 2;
    const hh = (Math.abs(Math.sin(a)) * l.w + Math.abs(Math.cos(a)) * l.h) / 2;
    const cx = l.x + l.w / 2;
    const cy = l.y + l.h / 2;
    x0 = Math.min(x0, cx - hw);
    y0 = Math.min(y0, cy - hh);
    x1 = Math.max(x1, cx + hw);
    y1 = Math.max(y1, cy + hh);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function layerNode(l: LayerIn, id: string, parentId: string, index: string, originX: number, originY: number, notes: Notes, text: (v: unknown, fallback: string) => string): Node {
  const raw = l.raw;
  noteCommon(raw, OBJECT_KEYS, notes);
  const type = OBJECT_TYPES[l.kind] as NodeType;
  const origin = rotatedOrigin(l);
  const opacity = numberOr(get(raw, "opacity"), 1, () => true, notes);
  const strokeWidth = numberOr(get(raw, "strokeWidth"), 0, (n) => n >= 0, notes);
  const strokes = strokeWidth > 0 ? paints(get(raw, "stroke"), notes) : [];
  const node: Node = {
    ...defaultNode(type, id, parentId, index),
    name: text(get(raw, "name"), "").trim() || (OBJECT_NAMES[l.kind] as string),
    visible: flag(raw, "visible", true, notes),
    locked: flag(raw, "locked", false, notes),
    x: round(origin.x - originX),
    y: round(origin.y - originY),
    width: l.w,
    height: l.h,
    rotation: l.rotation,
    opacity: clamp(opacity, 0, 1),
    fills: paints(get(raw, "fill"), notes),
    strokes,
    strokeWeight: strokes.length ? Math.min(strokeWidth, MAX_SIZE) : 1,
  };
  if (l.kind === "rect") {
    const radius = get(raw, "radius");
    if (radius !== undefined && !finite(radius)) notes.add("reset");
    node.cornerRadius = finite(radius) ? clamp(radius, 0, Math.min(l.w, l.h) / 2) : 0;
  } else if (l.kind === "path") {
    // The outline (`d`, drawn scaled by w/baseW and h/baseH) has no place in format v0 yet.
    notes.add("paths");
  } else if (l.kind === "text") {
    Object.assign(node, textFields(raw, l, notes));
  }
  return node;
}

function textFields(raw: Obj, l: LayerIn, notes: Notes): Partial<Node> {
  const L = PROTOTYPE_IMPORT_LIMITS;
  let characters = get(raw, "text");
  if (typeof characters !== "string") {
    notes.add("reset");
    characters = "";
  }
  let chars = characters as string;
  if (chars.length > L.maxTextChars) {
    notes.add("trimmed");
    chars = chars.slice(0, L.maxTextChars);
  }
  let fontSize = numberOr(get(raw, "fontSize") ?? NaN, 16, (n) => n > 0, notes);
  // The prototype drew text scaled by w/baseW and h/baseH. Format v0 has no
  // text scaling, so scale the font size by the height instead.
  const baseW = get(raw, "baseW");
  const baseH = get(raw, "baseH");
  if (finite(baseW) && finite(baseH) && baseW > 0 && baseH > 0) {
    const sx = l.w / baseW;
    const sy = l.h / baseH;
    if (Math.abs(sy - 1) > 1e-6) fontSize *= sy;
    if (Math.abs(sx - sy) > 0.01 * Math.max(sx, sy)) notes.add("stretchedText");
  }
  fontSize = round(Math.min(fontSize, MAX_SIZE));
  const family = get(raw, "fontFamily");
  const fontFamily = typeof family === "string" && family.trim() && family.length <= 100 ? family.trim() : "Inter";
  if (fontFamily !== family) notes.add("reset");
  // fontWeight 400–700 (any 100–900 is accepted) → Figma-style style name.
  // Never Number() an arbitrary JSON value: {"valueOf": 1} would throw.
  const rawWeight = get(raw, "fontWeight") ?? 400;
  const weight = finite(rawWeight) ? rawWeight : typeof rawWeight === "string" && /^\d{3}$/.test(rawWeight) ? Number(rawWeight) : NaN;
  if (!Number.isFinite(weight)) notes.add("reset");
  const fontStyle = Number.isFinite(weight)
    ? (FONT_STYLES.reduce((best, s) => (Math.abs(s[0] - weight) < Math.abs(best[0] - weight) ? s : best))[1])
    : "Regular";
  // Line height: the prototype stored a multiplier (default 1.16); format v0 stores pixels.
  const lineHeight = numberOr(get(raw, "lineHeight"), DEFAULT_LINE_HEIGHT, (n) => n > 0, notes);
  const letterSpacing = get(raw, "letterSpacing");
  if (letterSpacing !== undefined && letterSpacing !== 0) notes.add("letterSpacing");
  return { characters: chars, fontFamily, fontStyle, fontSize, lineHeight: round(Math.min(fontSize * lineHeight, MAX_SIZE)) };
}
