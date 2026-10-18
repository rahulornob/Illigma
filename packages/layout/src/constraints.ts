/**
 * Constraints: how a layer follows its parent frame when that frame is
 * resized (Figma's Left, Right, Left and right, Center and Scale, and the
 * same for Top and Bottom). Positions are relative to the parent, so moving
 * the frame never moves its children; only a change of size does.
 */

import type { ConstraintType } from "@illigma/format";
import { finite, MIN_SIZE, quarterTurns, rotatedBounds } from "./geometry.js";
import type { Box, LayoutNode, Size } from "./types.js";

/**
 * One axis: a child spanning `start` to `start + size` inside a parent that
 * goes from `oldParent` to `newParent` long. Returns the new start and size.
 *
 * - MIN keeps the distance to the left (top) edge.
 * - MAX keeps the distance to the right (bottom) edge.
 * - CENTER keeps the offset from the parent's centre.
 * - STRETCH keeps both distances, so the child grows and shrinks with the parent.
 * - SCALE keeps position and size as fractions of the parent.
 *
 * A stretched or scaled child never shrinks below MIN_SIZE (or below its own
 * size when that is already smaller, such as a line's zero height).
 */
export function constrainAxis(start: number, size: number, oldParent: number, newParent: number, type: ConstraintType = "MIN"): [number, number] {
  const delta = newParent - oldParent;
  const floor = Math.min(MIN_SIZE, Math.max(0, size));
  switch (type) {
    case "MAX":
      return [start + delta, size];
    case "CENTER":
      return [start + delta / 2, size];
    case "STRETCH":
      return [start, Math.max(floor, size + delta)];
    case "SCALE": {
      const ratio = oldParent > 0 ? newParent / oldParent : 1;
      return [start * ratio, Math.max(floor, size * ratio)];
    }
    default:
      return [start, size];
  }
}

/**
 * The new box of `child` when its parent goes from `oldParent` to `newParent`
 * in size. Works on the child's bounding box, as Figma does: a child turned
 * by a quarter turn stretches along its turned sides. A child at any other
 * angle keeps its size and the centre of its bounding box follows the
 * constraint; Stretch and Scale only move it (a simplification of Figma,
 * which also resizes it).
 */
export function applyConstraints(oldParent: Size, newParent: Size, child: Pick<LayoutNode, "x" | "y" | "width" | "height" | "rotation" | "constraints">): Box {
  const c = child.constraints;
  const b = rotatedBounds(child.width, child.height, child.rotation);
  const [sx, sw] = constrainAxis(child.x + b.x, b.width, oldParent.width, newParent.width, c?.horizontal);
  const [sy, sh] = constrainAxis(child.y + b.y, b.height, oldParent.height, newParent.height, c?.vertical);
  const q = quarterTurns(child.rotation);
  if (q < 0) {
    // Not a quarter turn: keep the size, centre the bounding box where the constraint puts it.
    return { x: finite(sx + (sw - b.width) / 2 - b.x), y: finite(sy + (sh - b.height) / 2 - b.y), width: child.width, height: child.height };
  }
  const width = q % 2 === 0 ? sw : sh;
  const height = q % 2 === 0 ? sh : sw;
  const nb = rotatedBounds(width, height, child.rotation);
  return { x: sx - nb.x, y: sy - nb.y, width, height };
}
