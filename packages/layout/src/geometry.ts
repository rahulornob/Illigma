import type { Box } from "./types.js";

/**
 * The smallest size layout ever computes (hug, fill, stretch), so a layer it
 * sizes stays visible and selectable. Sizes a user typed are kept as they are.
 */
export const MIN_SIZE = 1;

/** A finite number, or `fallback`. */
export const finite = (v: number | undefined, fallback = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** How many quarter turns `rotation` (degrees) is: 0–3, or -1 when it is not a multiple of 90°. */
export function quarterTurns(rotation: number): number {
  const r = ((finite(rotation) % 360) + 360) % 360;
  const q = Math.round(r / 90);
  return Math.abs(r - q * 90) < 1e-9 ? q % 4 : -1;
}

const COS = [1, 0, -1, 0] as const;
const SIN = [0, 1, 0, -1] as const;

/**
 * The bounding box of a `width` × `height` node rotated `rotation` degrees
 * clockwise about its top-left corner, relative to that corner. Quarter turns
 * are exact, so a 90° turn never leaves 1e-17 noise in a layout.
 */
export function rotatedBounds(width: number, height: number, rotation: number): Box {
  const q = quarterTurns(rotation);
  let c: number;
  let s: number;
  if (q >= 0) {
    c = COS[q as 0 | 1 | 2 | 3];
    s = SIN[q as 0 | 1 | 2 | 3];
  } else {
    const t = (finite(rotation) * Math.PI) / 180;
    c = Math.cos(t);
    s = Math.sin(t);
  }
  // Corners (0,0), (w,0), (0,h), (w,h) in parent space.
  const xs = [0, width * c, -height * s, width * c - height * s];
  const ys = [0, width * s, height * c, width * s + height * c];
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  return { x: x0 + 0, y: y0 + 0, width: Math.max(...xs) - x0, height: Math.max(...ys) - y0 };
}
