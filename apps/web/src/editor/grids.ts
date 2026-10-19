/**
 * Layout grids and ruler guides in the editor: what is shown (⌃G grids,
 * ⇧R rulers), the lines a drag snaps to, and the grid overlay. Grids are
 * an editor overlay only: the renderer and exports never draw them.
 */
import type { Document, ReadonlyNode } from "@illigma/core";
import { DEFAULT_GRID_COLOR, layoutGridBands, type Guide as PageGuide, type LayoutGrid, type NodeId } from "@illigma/format";
import { placementOf } from "./geometry";
import type { SnapLine } from "./snap/snap";

// ---- view settings ----

export interface ViewSettings {
  /** Layout grids drawn and snapped to (⌃G). Default on. */
  grids: boolean;
  /** Rulers along the canvas (⇧R). Default off. */
  rulers: boolean;
}

const KEY = "illigma.view";
let settings: ViewSettings = load();
const listeners = new Set<() => void>();

function load(): ViewSettings {
  try {
    const raw = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? "{}") as Partial<ViewSettings>;
    return { grids: raw.grids !== false, rulers: raw.rulers === true };
  } catch {
    return { grids: true, rulers: false };
  }
}

export function viewSettings(): ViewSettings {
  return settings;
}

export function setViewSettings(change: Partial<ViewSettings>): void {
  settings = { ...settings, ...change };
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(settings));
  } catch {
    // storage blocked: lasts until reload
  }
  for (const l of listeners) l();
}

export function subscribeView(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ---- grids ----

/** Visible layout grids of `n` (frames and components only). */
export function visibleGrids(n: ReadonlyNode | undefined): readonly LayoutGrid[] {
  if (!n || !n.layoutGrids?.length || (n.type !== "FRAME" && n.type !== "COMPONENT" && n.type !== "INSTANCE")) return [];
  return (n.layoutGrids as readonly LayoutGrid[]).filter((g) => g.visible !== false);
}

/** The page a node is on. */
function pageOf(doc: Document, id: NodeId): NodeId | null {
  for (let n = doc.get(id); n; n = n.parentId ? doc.get(n.parentId) : undefined) if (n.type === "PAGE") return n.id;
  return null;
}

/**
 * Lines a drag inside `parents` snaps to: the edges of their (upright) frames'
 * columns and rows, when grids are shown, and the page's ruler guides.
 */
export function snapLinesFor(doc: Document, parents: readonly NodeId[], skip: ReadonlySet<NodeId>): SnapLine[] {
  const out: SnapLine[] = [];
  const seen = new Set<NodeId>();
  let page: NodeId | null = null;
  for (const id of parents) {
    if (seen.has(id)) continue;
    seen.add(id);
    page ??= pageOf(doc, id);
    const n = doc.get(id);
    if (!settings.grids || skip.has(id)) continue;
    const grids = visibleGrids(n);
    if (!n || !grids.length) continue;
    const p = placementOf(doc, id);
    if (p.rotation) continue;
    for (const g of grids) {
      for (const b of layoutGridBands(g, n.width, n.height)) {
        const base = b.axis === "X" ? p.x : p.y;
        const axis = b.axis === "X" ? "x" : "y";
        out.push({ axis, at: base + b.start });
        if (b.size > 0) out.push({ axis, at: base + b.start + b.size });
      }
    }
  }
  if (page) for (const g of pageGuides(doc, page)) out.push({ axis: g.axis === "X" ? "x" : "y", at: g.offset });
  return out;
}

export function pageGuides(doc: Document, pageId: NodeId): readonly PageGuide[] {
  return (doc.get(pageId)?.guides as readonly PageGuide[] | undefined) ?? [];
}

/** Frames on the page with visible layout grids (any depth, skipping hidden branches). */
export function framesWithGrids(doc: Document, pageId: NodeId): NodeId[] {
  const out: NodeId[] = [];
  const visit = (id: NodeId) => {
    for (const k of doc.children(id)) {
      if (!k.visible) continue;
      if (visibleGrids(k).length) out.push(k.id);
      visit(k.id);
    }
  };
  visit(pageId);
  return out;
}

type Camera = { x: number; y: number; zoom: number };

/** Draw every grid of `frames` on a 2D overlay canvas sized to the canvas (CSS px × dpr). */
export function drawGrids(ctx: CanvasRenderingContext2D, doc: Document, frames: readonly NodeId[], camera: Camera, dpr: number): void {
  const { width, height } = ctx.canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (!settings.grids) return;
  const z = camera.zoom * dpr;
  for (const id of frames) {
    const n = doc.get(id);
    const grids = visibleGrids(n);
    if (!n || !grids.length) continue;
    const p = placementOf(doc, id);
    ctx.save();
    ctx.setTransform(z, 0, 0, z, -camera.x * z, -camera.y * z);
    ctx.translate(p.x, p.y);
    if (p.rotation) ctx.rotate((p.rotation * Math.PI) / 180);
    ctx.beginPath();
    ctx.rect(0, 0, n.width, n.height);
    ctx.clip();
    for (const g of grids) {
      const c = g.color ?? DEFAULT_GRID_COLOR;
      const css = `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${c.a})`;
      const bands = layoutGridBands(g, n.width, n.height);
      if (g.pattern === "GRID") {
        // Skip a grid whose cells are under 2 screen px: it would be a solid wash.
        if (g.sectionSize * camera.zoom < 2) continue;
        ctx.strokeStyle = css;
        ctx.lineWidth = 1 / z;
        ctx.beginPath();
        for (const b of bands) {
          if (b.axis === "X") {
            ctx.moveTo(b.start, 0);
            ctx.lineTo(b.start, n.height);
          } else {
            ctx.moveTo(0, b.start);
            ctx.lineTo(n.width, b.start);
          }
        }
        ctx.stroke();
      } else {
        ctx.fillStyle = css;
        for (const b of bands) {
          if (b.axis === "X") ctx.fillRect(b.start, 0, b.size, n.height);
          else ctx.fillRect(0, b.start, n.width, b.size);
        }
      }
    }
    ctx.restore();
  }
}

/** A new grid of each kind, with Figma's defaults. */
export function defaultGrid(pattern: LayoutGrid["pattern"]): LayoutGrid {
  if (pattern === "GRID") return { pattern, sectionSize: 10, visible: true, color: DEFAULT_GRID_COLOR };
  return { pattern, alignment: "STRETCH", count: 5, gutterSize: 20, offset: 0, visible: true, color: DEFAULT_GRID_COLOR };
}
