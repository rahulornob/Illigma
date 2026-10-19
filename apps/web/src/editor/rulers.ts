/**
 * Rulers and ruler guides (interactions.md: ⇧R shows rulers; drag from a
 * ruler to add a guide, drag it off to remove it). Rulers run along the top
 * and left of the canvas in page units, with the selection's extent
 * highlighted. Guides live on the page (`PAGE.guides`), are drawn 1 px at any
 * zoom, and can be dragged while the rulers are shown. Each add, move or
 * removal is one undo step.
 */
import type { Document } from "@illigma/core";
import type { Guide, NodeId } from "@illigma/format";
import { pageGuides, viewSettings } from "./grids";

/** Ruler thickness in CSS px (4 px grid). */
export const RULER_SIZE = 20;

type Camera = { x: number; y: number; zoom: number };
type Extent = { x: number; y: number; width: number; height: number } | null;

export interface RulerHost {
  doc(): Document;
  pageId(): NodeId;
  camera(): Camera;
  readOnly(): boolean;
  /** The selection's upright bounds on the page, or null. */
  selection(): Extent;
  requestDraw(): void;
}

/** A tick step (1, 2, 5 × 10ⁿ page units) that keeps labels at least ~60 px apart. */
export function tickStep(zoom: number): number {
  const min = 60 / zoom;
  const pow = 10 ** Math.floor(Math.log10(min));
  for (const m of [1, 2, 5, 10]) if (pow * m >= min) return pow * m;
  return pow * 10;
}

const fmt = (v: number) => String(Math.round(v * 100) / 100);

export class Rulers {
  readonly #root: HTMLElement;
  readonly #top: HTMLCanvasElement;
  readonly #left: HTMLCanvasElement;
  readonly #lines: HTMLElement;
  readonly #host: RulerHost;
  /** A guide being dragged: from a ruler (`index` -1) or an existing one. */
  #drag: { axis: "X" | "Y"; index: number; offset: number; pointer: number } | null = null;
  readonly #cleanup: (() => void)[] = [];

  constructor(root: HTMLElement, host: RulerHost) {
    this.#root = root;
    this.#host = host;
    this.#top = root.querySelector(".ruler-top canvas") as HTMLCanvasElement;
    this.#left = root.querySelector(".ruler-left canvas") as HTMLCanvasElement;
    this.#lines = root.querySelector(".ruler-guides") as HTMLElement;
    const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void) => {
      el.addEventListener(type, fn as EventListener);
      this.#cleanup.push(() => el.removeEventListener(type, fn as EventListener));
    };
    // Drag from the top ruler: a horizontal guide (axis Y); from the left: a vertical one (axis X).
    on(this.#top, "pointerdown", (e) => this.#startNew(e, "Y"));
    on(this.#left, "pointerdown", (e) => this.#startNew(e, "X"));
    on(this.#lines, "pointerdown", (e) => this.#startExisting(e));
    for (const el of [this.#top, this.#left, this.#lines]) {
      on(el, "pointermove", (e) => this.#move(e));
      on(el, "pointerup", (e) => this.#end(e, true));
      on(el, "pointercancel", (e) => this.#end(e, false));
    }
  }

  dispose(): void {
    for (const c of this.#cleanup) c();
  }

  /** Whether a guide drag is under way. */
  get dragging(): boolean {
    return this.#drag !== null;
  }

  #local(e: PointerEvent): { sx: number; sy: number } {
    const r = this.#root.getBoundingClientRect();
    return { sx: e.clientX - r.left, sy: e.clientY - r.top };
  }

  #world(axis: "X" | "Y", e: PointerEvent): number {
    const c = this.#host.camera();
    const { sx, sy } = this.#local(e);
    const v = axis === "X" ? c.x + sx / c.zoom : c.y + sy / c.zoom;
    return Math.round(v);
  }

  #startNew(e: PointerEvent, axis: "X" | "Y"): void {
    if (e.button !== 0 || this.#host.readOnly()) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    this.#drag = { axis, index: -1, offset: this.#world(axis, e), pointer: e.pointerId };
    this.#host.requestDraw();
  }

  #startExisting(e: PointerEvent): void {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-guide]");
    if (!el || e.button !== 0 || this.#host.readOnly()) return;
    const index = Number(el.dataset.guide);
    const g = pageGuides(this.#host.doc(), this.#host.pageId())[index];
    if (!g) return;
    e.preventDefault();
    e.stopPropagation();
    this.#lines.setPointerCapture(e.pointerId);
    this.#drag = { axis: g.axis, index, offset: g.offset, pointer: e.pointerId };
    this.#host.requestDraw();
  }

  #move(e: PointerEvent): void {
    const d = this.#drag;
    if (!d || d.pointer !== e.pointerId) return;
    d.offset = this.#world(d.axis, e);
    this.#host.requestDraw();
  }

  /** Over a ruler (or outside the canvas): dropping there removes the guide. */
  #offCanvas(e: PointerEvent, axis: "X" | "Y"): boolean {
    const { sx, sy } = this.#local(e);
    const r = this.#root.getBoundingClientRect();
    if (sx < 0 || sy < 0 || sx > r.width || sy > r.height) return true;
    return axis === "Y" ? sy < RULER_SIZE : sx < RULER_SIZE;
  }

  #end(e: PointerEvent, commit: boolean): void {
    const d = this.#drag;
    if (!d || d.pointer !== e.pointerId) return;
    this.#drag = null;
    if (commit) {
      const doc = this.#host.doc();
      const page = this.#host.pageId();
      const guides = [...pageGuides(doc, page)].map((g) => ({ ...g }));
      const remove = this.#offCanvas(e, d.axis);
      let label: string | null = null;
      if (d.index < 0) {
        if (!remove) {
          guides.push({ axis: d.axis, offset: d.offset });
          label = "Add guide";
        }
      } else if (remove) {
        guides.splice(d.index, 1);
        label = "Remove guide";
      } else if (guides[d.index]?.offset !== d.offset) {
        guides[d.index] = { axis: d.axis, offset: d.offset };
        label = "Move guide";
      }
      if (label && !doc.live) doc.transact(label, (tx) => tx.set(page, "guides", guides.length ? guides : undefined));
    }
    this.#host.requestDraw();
  }

  /** Draw rulers and guides; called every canvas frame. */
  render(): void {
    const show = viewSettings().rulers;
    this.#root.dataset.rulers = show ? "on" : "off";
    const camera = this.#host.camera();
    this.#renderGuides(camera, show);
    if (!show) return;
    const sel = this.#host.selection();
    const d = this.#drag;
    this.#ruler(this.#top, "X", camera, sel, d && d.axis === "X" ? d.offset : null);
    this.#ruler(this.#left, "Y", camera, sel, d && d.axis === "Y" ? d.offset : null);
  }

  #renderGuides(camera: Camera, interactive: boolean): void {
    const guides: (Guide & { index: number })[] = pageGuides(this.#host.doc(), this.#host.pageId()).map((g, index) => ({ ...g, index }));
    const d = this.#drag;
    if (d) {
      if (d.index >= 0) guides[d.index] = { axis: d.axis, offset: d.offset, index: d.index };
      else guides.push({ axis: d.axis, offset: d.offset, index: -1 });
    }
    this.#lines.dataset.interactive = interactive ? "on" : "off";
    let i = 0;
    for (const g of guides) {
      let el = this.#lines.children[i++] as HTMLElement | undefined;
      if (!el) {
        el = document.createElement("div");
        this.#lines.append(el);
      }
      const cls = `ruler-guide ${g.axis === "X" ? "v" : "h"}${d && d.index === g.index ? " dragging" : ""}`;
      if (el.className !== cls) el.className = cls;
      el.dataset.guide = String(g.index);
      const s = g.axis === "X" ? (g.offset - camera.x) * camera.zoom : (g.offset - camera.y) * camera.zoom;
      el.style.transform = g.axis === "X" ? `translateX(${Math.round(s)}px)` : `translateY(${Math.round(s)}px)`;
      el.title = `${g.axis === "X" ? "x" : "y"} ${fmt(g.offset)}`;
    }
    while (this.#lines.children.length > i) this.#lines.lastElementChild?.remove();
  }

  #ruler(canvas: HTMLCanvasElement, axis: "X" | "Y", camera: Camera, sel: Extent, drag: number | null): void {
    const dpr = window.devicePixelRatio || 1;
    const css = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(css.width * dpr));
    const h = Math.max(1, Math.round(css.height * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const style = getComputedStyle(this.#root);
    const color = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, css.width, css.height);
    const length = axis === "X" ? css.width : css.height;
    const origin = axis === "X" ? camera.x : camera.y;
    const toScreen = (v: number) => (v - origin) * camera.zoom;
    // The selection's extent, tinted.
    if (sel) {
      const a = toScreen(axis === "X" ? sel.x : sel.y);
      const b = toScreen(axis === "X" ? sel.x + sel.width : sel.y + sel.height);
      ctx.fillStyle = color("--accent-fill", "rgba(13,153,255,0.2)");
      if (axis === "X") ctx.fillRect(a, 0, b - a, RULER_SIZE);
      else ctx.fillRect(0, a, RULER_SIZE, b - a);
    }
    const step = tickStep(camera.zoom);
    const minor = step / 5;
    const first = Math.floor(origin / minor) * minor;
    const last = origin + length / camera.zoom;
    ctx.strokeStyle = color("--text-tertiary", "rgba(255,255,255,0.4)");
    ctx.fillStyle = color("--text-secondary", "rgba(255,255,255,0.6)");
    ctx.font = "10px Inter, system-ui, sans-serif";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let v = first; v <= last; v += minor) {
      const s = Math.round(toScreen(v)) + 0.5;
      const major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
      const len = major ? 8 : 4;
      if (axis === "X") {
        ctx.moveTo(s, RULER_SIZE - len);
        ctx.lineTo(s, RULER_SIZE);
      } else {
        ctx.moveTo(RULER_SIZE - len, s);
        ctx.lineTo(RULER_SIZE, s);
      }
      if (major) {
        const label = fmt(Math.round(v / step) * step);
        if (axis === "X") ctx.fillText(label, s + 4, 10);
        else {
          ctx.save();
          ctx.translate(10, s - 4);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(label, 0, 0);
          ctx.restore();
        }
      }
    }
    ctx.stroke();
    // The selection's edges as labels in blue.
    const marks: number[] = [];
    if (sel) marks.push(axis === "X" ? sel.x : sel.y, axis === "X" ? sel.x + sel.width : sel.y + sel.height);
    if (drag !== null) marks.push(drag);
    ctx.fillStyle = color("--accent-default", "#0d99ff");
    for (const m of marks) {
      const s = Math.round(toScreen(m));
      if (axis === "X") ctx.fillRect(s, 0, 1, RULER_SIZE);
      else ctx.fillRect(0, s, RULER_SIZE, 1);
    }
  }
}
