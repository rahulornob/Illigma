/** Camera maths for zooming (interactions.md §8). Range 2% to 25,600%. */
import type { Rect } from "../geometry";

export interface Cam {
  x: number;
  y: number;
  zoom: number;
}

export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 256;

export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/** Zoom to `zoom` keeping the page point under the screen point (`sx`, `sy`) where it is. */
export function zoomAt(c: Cam, zoom: number, sx: number, sy: number): Cam {
  const z = clampZoom(zoom);
  const wx = c.x + sx / c.zoom;
  const wy = c.y + sy / c.zoom;
  return { zoom: z, x: wx - sx / z, y: wy - sy / z };
}

/** The camera showing `r` centred in a `w` × `h` view with `pad` screen pixels around it, at most `maxZoom`. */
export function fitRect(r: Rect, w: number, h: number, pad: number, maxZoom = MAX_ZOOM): Cam {
  const zw = r.width > 0 ? (w - pad * 2) / r.width : maxZoom;
  const zh = r.height > 0 ? (h - pad * 2) / r.height : maxZoom;
  const zoom = clampZoom(Math.min(maxZoom, zw, zh));
  return { zoom, x: r.x + r.width / 2 - w / (2 * zoom), y: r.y + r.height / 2 - h / (2 * zoom) };
}

/** ⌘+ and ⌘−: the next power of two up or down (100% → 200% → 400%; 75% → 100%). */
export function zoomStep(zoom: number, dir: 1 | -1): number {
  const e = Math.log2(zoom);
  const r = Math.round(e);
  const base = Math.abs(e - r) < 1e-6 ? r : dir > 0 ? Math.floor(e) : Math.ceil(e);
  return clampZoom(2 ** (base + dir));
}
