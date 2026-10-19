/**
 * The pen, the line and arrow tools, and vector edit mode on the canvas
 * (interactions.md §7). The canvas hands it pointer events first; it draws
 * its own overlay (points, handles, the path being drawn) in an SVG layer
 * over the canvas, and edits the document through transactions and live
 * edits (one undo step per drag).
 */

import type { Document, LiveEdit, ReadonlyNode } from "@illigma/core";
import type { NodeId, VectorNetwork } from "@illigma/format";
import type { Camera } from "@illigma/renderer";
import { fromSpace, placeAt, placementOf, rotate, toSpace, type Placement, type Point } from "../geometry";
import {
  bendSegment,
  cloneNetwork,
  deleteVertices,
  fitNetwork,
  handlesAt,
  isSmooth,
  moveVertices,
  nearestSegment,
  penHandles,
  penNetwork,
  setHandle,
  snap45,
  splitSegment,
  toggleSmooth,
  verticesIn,
  type PenPoint,
} from "./network";
import { convertToVector, setNetworkFitted, VECTOR_EDITABLE } from "./ops";
import { vectorEdit } from "./store";
import "./vector.css";

export type VectorTool = "pen" | "line" | "arrow";
export const isVectorTool = (t: string): t is VectorTool => t === "pen" || t === "line" || t === "arrow";

export interface VectorHost {
  doc(): Document;
  pageId(): NodeId;
  camera(): Camera;
  tool(): string;
  readOnly(): boolean;
  requestDraw(): void;
  select(ids: NodeId[]): void;
  /** A layer was made: select it and go back to the Move tool. */
  created(id: NodeId): void;
}

/** A pointer event, in canvas pixels, with its modifiers (`meta`: ⌘ on macOS, Ctrl elsewhere). */
export interface VPointer {
  sx: number;
  sy: number;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

/** Grab distance around points, handles and segments, in screen pixels. */
const GRAB = 6;
const DRAG = 2;
/** Overlays draw at most this many points (a huge network still edits, its points just aren't all drawn). */
const MAX_DRAWN_POINTS = 5000;
const SVG = "http://www.w3.org/2000/svg";
const BLACK = { type: "SOLID" as const, visible: true, color: { r: 0, g: 0, b: 0, a: 1 } };

type EditGesture =
  | { kind: "points"; wx: number; wy: number; start: Placement; net: VectorNetwork; points: number[]; live: LiveEdit; moved: boolean }
  | { kind: "handle"; start: Placement; net: VectorNetwork; segment: number; end: "start" | "end"; mirror: "none" | "angle"; live: LiveEdit }
  | { kind: "bend"; start: Placement; net: VectorNetwork; segment: number; t: number; live: LiveEdit }
  | { kind: "marquee"; wx: number; wy: number; x: number; y: number; base: number[]; additive: boolean };

type LineDraft = { tool: "line" | "arrow"; parent: NodeId; wx: number; wy: number; sx: number; sy: number; ex: number; ey: number };

export class VectorController {
  readonly #host: VectorHost;
  readonly #svg: SVGSVGElement;
  // Pen
  #pen: { parent: NodeId; points: PenPoint[]; drag: { index: number; sx: number; sy: number; moved: boolean; closing: boolean; keepIn: { x: number; y: number } } | null } | null = null;
  #hover: Point | null = null;
  // Line and arrow
  #line: LineDraft | null = null;
  // Vector edit mode
  #edit: { id: NodeId; points: number[] } | null = null;
  #gesture: EditGesture | null = null;
  readonly #onKey = (e: KeyboardEvent) => this.#key(e);

  constructor(host: VectorHost, parent: HTMLElement) {
    this.#host = host;
    this.#svg = document.createElementNS(SVG, "svg");
    this.#svg.setAttribute("class", "vector-overlay");
    this.#svg.setAttribute("aria-hidden", "true");
    parent.append(this.#svg);
    window.addEventListener("keydown", this.#onKey, true);
    vectorEdit.register({ edit: (id) => this.edit(id), exit: () => this.exit() });
  }

  dispose(): void {
    this.cancel();
    this.exit();
    this.#svg.remove();
    window.removeEventListener("keydown", this.#onKey, true);
    vectorEdit.register(null);
  }

  /** In vector edit mode: the canvas hides its own selection handles. */
  editing(): NodeId | null {
    return this.#edit?.id ?? null;
  }

  /** Drawing a path with the pen. */
  drawing(): boolean {
    return !!this.#pen;
  }

  // ---- entering and leaving ----

  /** Vector edit mode on `id`: a shape converts to a vector first (one undo step). */
  edit(id: NodeId): boolean {
    const doc = this.#host.doc();
    const n = doc.get(id);
    if (!n || n.locked || this.#host.readOnly() || !VECTOR_EDITABLE.has(n.type) || doc.live) return false;
    this.finishPen(false);
    let vid: NodeId | null = id;
    if (n.type !== "VECTOR") vid = doc.transact("Convert to vector", (tx) => convertToVector(tx, doc, id));
    if (!vid) return false;
    this.#edit = { id: vid, points: [] };
    this.#host.select([vid]);
    this.#publish();
    this.#host.requestDraw();
    return true;
  }

  exit(): void {
    if (this.#pen) this.finishPen(false);
    if (!this.#edit) return;
    this.cancel();
    this.#edit = null;
    this.#publish();
    this.#host.requestDraw();
  }

  /** The selection changed elsewhere (the Layers panel, undo): leave edit mode unless it is still the vector alone. */
  selectionChanged(sel: readonly NodeId[]): void {
    if (this.#edit && (sel.length !== 1 || sel[0] !== this.#edit.id)) this.exit();
  }

  /** Another tool was picked: a path being drawn is finished. */
  toolChanged(tool: string): void {
    if (tool !== "pen" && this.#pen) this.finishPen(false);
    if (tool !== "move" && this.#edit) this.exit();
  }

  /** Sets the selected points (the Properties panel and tests). */
  selectPoints(points: number[]): void {
    if (!this.#edit) return;
    this.#edit.points = points;
    this.#publish();
    this.#host.requestDraw();
  }

  #publish(): void {
    vectorEdit.set(this.#edit ? { nodeId: this.#edit.id, points: [...this.#edit.points] } : null);
  }

  // ---- coordinates ----

  #toWorld(sx: number, sy: number): Point {
    const c = this.#host.camera();
    return { x: c.x + sx / c.zoom, y: c.y + sy / c.zoom };
  }

  #toScreen(wx: number, wy: number): Point {
    const c = this.#host.camera();
    return { x: (wx - c.x) * c.zoom, y: (wy - c.y) * c.zoom };
  }

  #zoom(): number {
    return this.#host.camera().zoom;
  }

  /** The vector being edited, if it still exists. */
  #node(): ReadonlyNode | null {
    if (!this.#edit) return null;
    const n = this.#host.doc().get(this.#edit.id);
    if (!n || n.type !== "VECTOR") {
      this.#edit = null;
      this.#publish();
      return null;
    }
    return n;
  }

  // ---- pointer ----

  /** A press on the canvas. Returns true if the vector tools took it. */
  pointerDown(p: VPointer, clicks: number): boolean {
    if (this.#host.readOnly()) return false;
    const tool = this.#host.tool();
    if (this.#edit) return this.#editDown(p, clicks);
    if (tool === "pen") return this.#penDown(p);
    if (tool === "line" || tool === "arrow") {
      const w = this.#toWorld(p.sx, p.sy);
      const { parent } = placeAt(this.#host.doc(), this.#host.pageId(), w.x, w.y);
      this.#line = { tool, parent, wx: w.x, wy: w.y, sx: p.sx, sy: p.sy, ex: w.x, ey: w.y };
      return true;
    }
    return false;
  }

  pointerMove(p: VPointer): void {
    const w = this.#toWorld(p.sx, p.sy);
    if (this.#line) {
      let e = p.shift ? snap45({ x: this.#line.wx, y: this.#line.wy }, w) : w;
      e = { x: e.x, y: e.y };
      this.#line.ex = e.x;
      this.#line.ey = e.y;
      this.#host.requestDraw();
      return;
    }
    if (this.#pen?.drag) {
      this.#penDrag(p);
      return;
    }
    if (this.#gesture) this.#editMove(p);
  }

  /** The pointer moved with no button down: the pen's rubber band follows it. */
  hover(p: VPointer): void {
    if (!this.#pen) return;
    const w = this.#toWorld(p.sx, p.sy);
    const last = this.#pen.points[this.#pen.points.length - 1];
    if (p.shift && last) {
      const lw = this.#penWorld(last);
      this.#hover = snap45(lw, w);
    } else this.#hover = w;
    this.#host.requestDraw();
  }

  pointerUp(p: VPointer | null): void {
    if (this.#line) {
      const l = this.#line;
      this.#line = null;
      if (p) this.#createLine(l, p);
      this.#host.requestDraw();
      return;
    }
    if (this.#pen?.drag) {
      const closing = this.#pen.drag.closing;
      this.#pen.drag = null;
      if (closing) this.finishPen(true);
      this.#host.requestDraw();
      return;
    }
    const g = this.#gesture;
    this.#gesture = null;
    if (!g) return;
    if (g.kind === "marquee") {
      this.#host.requestDraw();
      return;
    }
    if (g.live.open) g.live.commit();
    this.#host.requestDraw();
  }

  /** Double-click: on a point in edit mode, toggles it between corner and smooth. Returns true if used. */
  doubleClick(p: VPointer): boolean {
    const n = this.#node();
    if (!n || !n.vectorNetwork) return false;
    const v = this.#vertexAt(n, p.sx, p.sy);
    if (v === null) return false;
    const doc = this.#host.doc();
    const net = toggleSmooth(cloneNetwork(n.vectorNetwork), v);
    doc.transact("Change point", (tx) => setNetworkFitted(tx, doc, n.id, net));
    return true;
  }

  /** Drops a running drag, putting back what it changed. */
  cancel(): void {
    this.#line = null;
    if (this.#pen?.drag) this.#pen.drag = null;
    const g = this.#gesture;
    this.#gesture = null;
    if (g && g.kind !== "marquee" && g.live.open) g.live.cancel();
    this.#host.requestDraw();
  }

  // ---- line and arrow ----

  #createLine(l: LineDraft, p: VPointer): void {
    const doc = this.#host.doc();
    const clicked = Math.hypot(p.sx - l.sx, p.sy - l.sy) <= DRAG;
    let a = { x: l.wx, y: l.wy };
    let b = clicked ? { x: l.wx + 100, y: l.wy } : { x: l.ex, y: l.ey };
    // ⌥ draws from the centre.
    if (p.alt && !clicked) a = { x: 2 * l.wx - b.x, y: 2 * l.wy - b.y };
    const place = placementOf(doc, l.parent);
    a = toSpace(place, a.x, a.y);
    b = toSpace(place, b.x, b.y);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (!len) return;
    const page = this.#host.pageId();
    if (l.tool === "line") {
      const count = doc.subtree(page).filter((n) => n.type === "LINE").length + 1;
      const id = doc.transact("Draw line", (tx) =>
        tx.create("LINE", l.parent, {
          name: `Line ${count}`,
          x: a.x,
          y: a.y,
          width: len,
          height: 0,
          rotation: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
          fills: [],
          strokes: [BLACK],
          strokeWeight: 1,
        }),
      );
      this.#host.created(id);
      return;
    }
    // An arrow: a two-point vector whose end has an arrow head (Figma's arrow tool).
    const net: VectorNetwork = {
      vertices: [
        { x: a.x, y: a.y },
        { x: b.x, y: b.y, strokeCap: "ARROW_LINES" },
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
      regions: [],
    };
    const fit = fitNetwork(net);
    const count = doc.subtree(page).filter((n) => n.name.startsWith("Arrow")).length + 1;
    const id = doc.transact("Draw arrow", (tx) =>
      tx.create("VECTOR", l.parent, { name: `Arrow ${count}`, x: fit.dx, y: fit.dy, width: fit.width, height: fit.height, vectorNetwork: fit.net, fills: [], strokes: [BLACK], strokeWeight: 1 }),
    );
    this.#host.created(id);
  }

  // ---- pen ----

  #penWorld(pt: { x: number; y: number }): Point {
    const doc = this.#host.doc();
    return this.#pen ? fromSpace(placementOf(doc, this.#pen.parent), pt.x, pt.y) : pt;
  }

  #penLocal(w: Point): Point {
    const doc = this.#host.doc();
    return this.#pen ? toSpace(placementOf(doc, this.#pen.parent), w.x, w.y) : w;
  }

  #penDown(p: VPointer): boolean {
    const doc = this.#host.doc();
    let w = this.#toWorld(p.sx, p.sy);
    if (!this.#pen) {
      const { parent } = placeAt(doc, this.#host.pageId(), w.x, w.y);
      this.#pen = { parent, points: [], drag: null };
    }
    const pen = this.#pen;
    const first = pen.points[0];
    if (first && pen.points.length >= 2) {
      const fs = this.#toScreenPt(this.#penWorld(first));
      if (Math.hypot(fs.x - p.sx, fs.y - p.sy) <= GRAB + 2) {
        // Clicking the first point closes the path; dragging from it shapes its handles.
        pen.drag = { index: 0, sx: p.sx, sy: p.sy, moved: false, closing: true, keepIn: { ...first.in } };
        return true;
      }
    }
    const last = pen.points[pen.points.length - 1];
    if (p.shift && last) w = snap45(this.#penWorld(last), w);
    const local = this.#penLocal(w);
    pen.points.push({ x: local.x, y: local.y, in: { x: 0, y: 0 }, out: { x: 0, y: 0 } });
    pen.drag = { index: pen.points.length - 1, sx: p.sx, sy: p.sy, moved: false, closing: false, keepIn: { x: 0, y: 0 } };
    this.#hover = null;
    this.#host.requestDraw();
    return true;
  }

  #toScreenPt(w: Point): Point {
    return this.#toScreen(w.x, w.y);
  }

  #penDrag(p: VPointer): void {
    const pen = this.#pen;
    const d = pen?.drag;
    if (!pen || !d) return;
    if (!d.moved && Math.hypot(p.sx - d.sx, p.sy - d.sy) <= DRAG) return;
    d.moved = true;
    const pt = pen.points[d.index] as PenPoint;
    const local = this.#penLocal(this.#toWorld(p.sx, p.sy));
    const h = penHandles(pt, local, p.alt, d.keepIn);
    if (d.closing) {
      // Dragging on the first point to close: the closing curve arrives along the drag.
      pt.in = { x: -h.out.x, y: -h.out.y };
      if (!p.alt) pt.out = { ...h.out };
    } else {
      pt.out = h.out;
      pt.in = h.in;
    }
    this.#host.requestDraw();
  }

  /** Ends the path being drawn: kept as a vector if it has two points or more (one undo step). */
  finishPen(closed: boolean): void {
    const pen = this.#pen;
    this.#pen = null;
    this.#hover = null;
    if (!pen || pen.points.length < 2) {
      this.#host.requestDraw();
      return;
    }
    const doc = this.#host.doc();
    if (!doc.has(pen.parent) || doc.live) return;
    const fit = fitNetwork(penNetwork(pen.points, closed));
    const count = doc.subtree(this.#host.pageId()).filter((n) => n.type === "VECTOR").length + 1;
    const id = doc.transact("Draw path", (tx) =>
      tx.create("VECTOR", pen.parent, { name: `Vector ${count}`, x: fit.dx, y: fit.dy, width: fit.width, height: fit.height, vectorNetwork: fit.net, fills: [], strokes: [BLACK], strokeWeight: 1 }),
    );
    this.#host.created(id);
    this.#host.requestDraw();
  }

  /** ⌫ while drawing: removes the last point placed. */
  #penBack(): void {
    const pen = this.#pen;
    if (!pen) return;
    pen.points.pop();
    if (!pen.points.length) this.#pen = null;
    this.#host.requestDraw();
  }

  // ---- vector edit mode ----

  /** Local (node-space) point of a screen point, for the vector `n`. */
  #local(n: ReadonlyNode, sx: number, sy: number, place = placementOf(this.#host.doc(), n.id)): Point {
    const w = this.#toWorld(sx, sy);
    return toSpace(place, w.x, w.y);
  }

  #screenOf(place: Placement, x: number, y: number): Point {
    const w = fromSpace(place, x, y);
    return this.#toScreen(w.x, w.y);
  }

  #vertexAt(n: ReadonlyNode, sx: number, sy: number): number | null {
    const net = n.vectorNetwork;
    if (!net) return null;
    const place = placementOf(this.#host.doc(), n.id);
    let best: number | null = null;
    let bd = GRAB + 1;
    net.vertices.forEach((v, i) => {
      const s = this.#screenOf(place, v.x, v.y);
      const d = Math.hypot(s.x - sx, s.y - sy);
      if (d < bd) [bd, best] = [d, i];
    });
    return best;
  }

  /** The handle (of a selected point) under a screen point. */
  #handleAt(n: ReadonlyNode, sx: number, sy: number): { segment: number; end: "start" | "end"; vertex: number } | null {
    const net = n.vectorNetwork;
    if (!net || !this.#edit) return null;
    const place = placementOf(this.#host.doc(), n.id);
    for (const v of this.#edit.points) {
      const p = net.vertices[v];
      if (!p) continue;
      for (const h of handlesAt(net as VectorNetwork, v)) {
        if (h.t.x === 0 && h.t.y === 0) continue;
        const s = this.#screenOf(place, p.x + h.t.x, p.y + h.t.y);
        if (Math.hypot(s.x - sx, s.y - sy) <= GRAB) return { segment: h.segment, end: h.end, vertex: v };
      }
    }
    return null;
  }

  #editDown(p: VPointer, clicks: number): boolean {
    const n = this.#node();
    if (!n || !this.#edit) return false;
    const doc = this.#host.doc();
    if (doc.live) return true;
    const net = cloneNetwork(n.vectorNetwork ?? { vertices: [], segments: [], regions: [] });
    const place = placementOf(doc, n.id);
    const w = this.#toWorld(p.sx, p.sy);
    const handle = this.#handleAt(n, p.sx, p.sy);
    if (handle) {
      const mirror = !p.alt && isSmooth(net, handle.vertex) ? "angle" : "none";
      this.#gesture = { kind: "handle", start: place, net, segment: handle.segment, end: handle.end, mirror, live: doc.beginLive("Move handle") };
      return true;
    }
    const v = this.#vertexAt(n, p.sx, p.sy);
    if (v !== null) {
      const sel = this.#edit.points;
      let next: number[];
      if (p.shift) next = sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v];
      else next = sel.includes(v) ? sel : [v];
      this.#edit.points = next;
      this.#publish();
      if (next.includes(v)) this.#gesture = { kind: "points", wx: w.x, wy: w.y, start: place, net, points: next, live: doc.beginLive(next.length === 1 ? "Move point" : `Move ${next.length} points`), moved: false };
      this.#host.requestDraw();
      return true;
    }
    const local = this.#local(n, p.sx, p.sy, place);
    const reach = GRAB / (this.#zoom() || 1);
    const seg = nearestSegment(net, local.x, local.y, reach);
    if (seg) {
      if (p.meta) {
        this.#gesture = { kind: "bend", start: place, net, segment: seg.segment, t: Math.min(0.95, Math.max(0.05, seg.t)), live: doc.beginLive("Bend segment") };
        return true;
      }
      // A click on a segment adds a point there (and a drag moves it).
      const split = splitSegment(net, seg.segment, seg.t);
      this.#edit.points = [split.vertex];
      this.#publish();
      const live = doc.beginLive("Add point");
      live.update((tx) => setNetworkFitted(tx, doc, n.id, split.net));
      this.#gesture = { kind: "points", wx: w.x, wy: w.y, start: place, net: split.net, points: [split.vertex], live, moved: false };
      this.#host.requestDraw();
      return true;
    }
    // Empty space: a marquee selects points; a click clears the point selection.
    this.#gesture = { kind: "marquee", wx: w.x, wy: w.y, x: w.x, y: w.y, base: p.shift ? [...this.#edit.points] : [], additive: p.shift };
    if (!p.shift) {
      this.#edit.points = [];
      this.#publish();
    }
    this.#host.requestDraw();
    return true;
  }

  #editMove(p: VPointer): void {
    const g = this.#gesture;
    const n = this.#node();
    if (!g || !n || !this.#edit) return;
    const doc = this.#host.doc();
    const w = this.#toWorld(p.sx, p.sy);
    if (g.kind === "marquee") {
      g.x = w.x;
      g.y = w.y;
      const place = placementOf(doc, n.id);
      const a = toSpace(place, g.wx, g.wy);
      const b = toSpace(place, w.x, w.y);
      const box = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
      const hits = n.vectorNetwork ? verticesIn(n.vectorNetwork as VectorNetwork, box) : [];
      this.#edit.points = g.additive ? [...new Set([...g.base, ...hits])] : hits;
      this.#publish();
      this.#host.requestDraw();
      return;
    }
    if (!g.live.open) {
      this.#gesture = null;
      return;
    }
    const local = toSpace(g.start, w.x, w.y);
    let next: VectorNetwork;
    if (g.kind === "points") {
      let a = toSpace(g.start, g.wx, g.wy);
      let dx = local.x - a.x;
      let dy = local.y - a.y;
      if (!g.moved && Math.hypot(dx, dy) * this.#zoom() <= DRAG) return;
      g.moved = true;
      if (p.shift) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      a = { x: dx, y: dy };
      next = moveVertices(g.net, g.points, a.x, a.y);
    } else if (g.kind === "handle") {
      const s = g.net.segments[g.segment];
      if (!s) return;
      const v = g.net.vertices[g.end === "start" ? s.start : s.end];
      if (!v) return;
      next = setHandle(g.net, g.segment, g.end, { x: local.x - v.x, y: local.y - v.y }, p.alt ? "none" : g.mirror);
    } else {
      next = bendSegment(g.net, g.segment, g.t, local);
    }
    g.live.update((tx) => setNetworkFitted(tx, doc, n.id, next));
    this.#host.requestDraw();
  }

  // ---- keys ----

  #key(e: KeyboardEvent): void {
    if (!this.#pen && !this.#edit) return;
    const t = e.target;
    if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (t instanceof HTMLElement && t.closest("[role=dialog],[role=menu],[role=listbox]")) return;
    const mod = e.metaKey || e.ctrlKey;
    const stop = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    if (this.#pen) {
      if (e.key === "Enter" || e.key === "Escape") {
        stop();
        if (this.#pen.drag) this.#pen.drag = null;
        this.finishPen(false);
      } else if (e.key === "Backspace" || e.key === "Delete") {
        stop();
        this.#penBack();
      }
      return;
    }
    const n = this.#node();
    if (!n || !this.#edit) return;
    if (e.key === "Escape" || (e.key === "Enter" && !this.#gesture)) {
      stop();
      if (this.#gesture) this.cancel();
      else this.exit();
      return;
    }
    const doc = this.#host.doc();
    if (doc.live) return;
    if ((e.key === "Backspace" || e.key === "Delete") && this.#edit.points.length) {
      stop();
      const net = deleteVertices(n.vectorNetwork as VectorNetwork, this.#edit.points, mod);
      const count = this.#edit.points.length;
      this.#edit.points = [];
      this.#publish();
      if (!net.vertices.length) {
        doc.transact("Delete vector", (tx) => tx.delete(n.id));
        this.exit();
        return;
      }
      doc.transact(count === 1 ? "Delete point" : `Delete ${count} points`, (tx) => setNetworkFitted(tx, doc, n.id, net));
      return;
    }
    const step = e.shiftKey ? 10 : 1;
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const a = arrows[e.key];
    if (a && this.#edit.points.length && !mod) {
      stop();
      const d = rotate(a[0], a[1], -placementOf(doc, n.id).rotation);
      const net = moveVertices(n.vectorNetwork as VectorNetwork, this.#edit.points, d.x, d.y);
      doc.transact("Move points", (tx) => setNetworkFitted(tx, doc, n.id, net));
      return;
    }
    if (mod && e.key.toLowerCase() === "a" && !e.shiftKey) {
      stop();
      this.selectPoints((n.vectorNetwork?.vertices ?? []).map((_, i) => i));
    }
  }

  // ---- drawing the overlay ----

  render(): void {
    const svg = this.#svg;
    const parts: string[] = [];
    const doc = this.#host.doc();
    if (this.#line) {
      const a = this.#toScreen(this.#line.wx, this.#line.wy);
      const b = this.#toScreen(this.#line.ex, this.#line.ey);
      parts.push(`<path class="v-path" d="M${a.x} ${a.y}L${b.x} ${b.y}"/>`);
    }
    if (this.#pen && doc.has(this.#pen.parent)) {
      const pts = this.#pen.points;
      const sp = pts.map((p) => ({ p, s: this.#toScreenPt(this.#penWorld(p)), sin: this.#toScreenPt(this.#penWorld({ x: p.x + p.in.x, y: p.y + p.in.y })), sout: this.#toScreenPt(this.#penWorld({ x: p.x + p.out.x, y: p.y + p.out.y })) }));
      if (sp.length) {
        let d = `M${sp[0]?.s.x} ${sp[0]?.s.y}`;
        for (let i = 1; i < sp.length; i++) {
          const a = sp[i - 1] as (typeof sp)[number];
          const b = sp[i] as (typeof sp)[number];
          d += `C${a.sout.x} ${a.sout.y} ${b.sin.x} ${b.sin.y} ${b.s.x} ${b.s.y}`;
        }
        if (this.#pen.drag?.closing && sp.length > 1) {
          const a = sp[sp.length - 1] as (typeof sp)[number];
          const b = sp[0] as (typeof sp)[number];
          d += `C${a.sout.x} ${a.sout.y} ${b.sin.x} ${b.sin.y} ${b.s.x} ${b.s.y}`;
        }
        parts.push(`<path class="v-path" d="${d}"/>`);
        const last = sp[sp.length - 1] as (typeof sp)[number];
        if (this.#hover && !this.#pen.drag) {
          const h = this.#toScreenPt(this.#hover);
          parts.push(`<path class="v-rubber" d="M${last.s.x} ${last.s.y}C${last.sout.x} ${last.sout.y} ${h.x} ${h.y} ${h.x} ${h.y}"/>`);
        }
        // Handles of the last point, then every point.
        if (last.p.out.x || last.p.out.y || last.p.in.x || last.p.in.y) {
          parts.push(`<path class="v-handle-line" d="M${last.sin.x} ${last.sin.y}L${last.s.x} ${last.s.y}L${last.sout.x} ${last.sout.y}"/>`);
          parts.push(`<circle class="v-handle" cx="${last.sin.x}" cy="${last.sin.y}" r="3"/>`, `<circle class="v-handle" cx="${last.sout.x}" cy="${last.sout.y}" r="3"/>`);
        }
        sp.forEach((q, i) => parts.push(`<circle class="v-point${i === sp.length - 1 ? " is-selected" : ""}" cx="${q.s.x}" cy="${q.s.y}" r="4"/>`));
      }
    }
    const n = this.#node();
    if (n && n.vectorNetwork && this.#edit) {
      const net = n.vectorNetwork as VectorNetwork;
      const place = placementOf(doc, n.id);
      const scr = net.vertices.map((v) => this.#screenOf(place, v.x, v.y));
      let d = "";
      for (const s of net.segments) {
        const a = net.vertices[s.start];
        const b = net.vertices[s.end];
        if (!a || !b) continue;
        const p0 = scr[s.start] as Point;
        const p3 = scr[s.end] as Point;
        const c1 = this.#screenOf(place, a.x + s.tangentStart.x, a.y + s.tangentStart.y);
        const c2 = this.#screenOf(place, b.x + s.tangentEnd.x, b.y + s.tangentEnd.y);
        d += `M${p0.x} ${p0.y}C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p3.x} ${p3.y}`;
      }
      parts.push(`<path class="v-path" d="${d}"/>`);
      const sel = new Set(this.#edit.points);
      for (const v of sel) {
        const p = net.vertices[v];
        if (!p) continue;
        const s = scr[v] as Point;
        for (const h of handlesAt(net, v)) {
          if (h.t.x === 0 && h.t.y === 0) continue;
          const hs = this.#screenOf(place, p.x + h.t.x, p.y + h.t.y);
          parts.push(`<path class="v-handle-line" d="M${s.x} ${s.y}L${hs.x} ${hs.y}"/>`, `<circle class="v-handle" cx="${hs.x}" cy="${hs.y}" r="3"/>`);
        }
      }
      const drawn = Math.min(scr.length, MAX_DRAWN_POINTS);
      for (let i = 0; i < drawn; i++) {
        const s = scr[i] as Point;
        parts.push(`<circle class="v-point${sel.has(i) ? " is-selected" : ""}" cx="${s.x}" cy="${s.y}" r="4" data-point="${i}"/>`);
      }
      const g = this.#gesture;
      if (g?.kind === "marquee") {
        const a = this.#toScreen(g.wx, g.wy);
        const b = this.#toScreen(g.x, g.y);
        parts.push(`<rect class="v-marquee" x="${Math.min(a.x, b.x)}" y="${Math.min(a.y, b.y)}" width="${Math.abs(b.x - a.x)}" height="${Math.abs(b.y - a.y)}"/>`);
      }
    }
    svg.innerHTML = parts.join("");
    svg.dataset.mode = this.#edit ? "edit" : this.#pen ? "pen" : "";
  }
}
