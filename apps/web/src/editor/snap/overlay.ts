/**
 * Draws smart guides, gap and measurement pills over the canvas as DOM
 * elements in screen pixels: lines stay 1 px and pills keep their size at
 * any zoom (interactions.md: overlays never scale). Elements are reused
 * between frames.
 */
import type { Gap, Guide } from "./snap";

export interface GuideLayer {
  guides: readonly Guide[];
  gaps: readonly Gap[];
}

type ToScreen = (x: number, y: number) => { x: number; y: number };

const fmt = (v: number) => String(Math.round(Math.abs(v) * 100) / 100);

function take(container: HTMLElement, i: number, className: string): HTMLElement {
  let el = container.children[i] as HTMLElement | undefined;
  if (!el) {
    el = document.createElement("div");
    container.append(el);
  }
  if (el.className !== className) el.className = className;
  return el;
}

export function renderGuides(container: HTMLElement, layer: GuideLayer | null, toScreen: ToScreen): void {
  let i = 0;
  if (layer) {
    for (const g of layer.guides) {
      const el = take(container, i++, `snap-line ${g.axis === "x" ? "v" : "h"}`);
      const a = g.axis === "x" ? toScreen(g.at, g.from) : toScreen(g.from, g.at);
      const b = g.axis === "x" ? toScreen(g.at, g.to) : toScreen(g.to, g.at);
      el.style.transform = `translate(${Math.round(a.x)}px, ${Math.round(a.y)}px)`;
      el.style.width = g.axis === "x" ? "" : `${Math.max(1, b.x - a.x)}px`;
      el.style.height = g.axis === "x" ? `${Math.max(1, b.y - a.y)}px` : "";
      el.textContent = "";
    }
    for (const g of layer.gaps) {
      const horizontal = g.y1 === g.y2;
      const a = toScreen(g.x1, g.y1);
      const b = toScreen(g.x2, g.y2);
      const line = take(container, i++, `snap-line ${horizontal ? "h" : "v"} gap`);
      line.style.transform = `translate(${Math.round(Math.min(a.x, b.x))}px, ${Math.round(Math.min(a.y, b.y))}px)`;
      line.style.width = horizontal ? `${Math.max(1, Math.abs(b.x - a.x))}px` : "";
      line.style.height = horizontal ? "" : `${Math.max(1, Math.abs(b.y - a.y))}px`;
      line.textContent = "";
      const pill = take(container, i++, "snap-pill");
      pill.style.transform = `translate(${Math.round((a.x + b.x) / 2)}px, ${Math.round((a.y + b.y) / 2)}px) translate(-50%, ${horizontal ? "4px" : "-50%"})`;
      pill.textContent = fmt(g.value);
    }
  }
  while (container.children.length > i) container.lastElementChild?.remove();
}
