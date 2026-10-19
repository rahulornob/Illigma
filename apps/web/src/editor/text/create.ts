/**
 * New text layers from the Text tool, with Figma's defaults: Inter Regular
 * 12, black, auto line height. A click makes an auto width layer (the box
 * grows with the text); a drag makes a fixed-size box.
 */

import type { Node } from "@illigma/format";
import { BUNDLED_FAMILY } from "./engine";

export const DEFAULT_FONT_SIZE = 12;
/** Inter's line box (ascender + descender) in ems: an empty auto line's height, before layout measures it. */
const INTER_LINE = 1.2109375;

export interface TextBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where a new text layer goes, in its parent's space: a click at (x, y)
 * centres the first line on the point (the caret appears where clicked);
 * a dragged `box` is used as it is (at least 1 × 1).
 */
export function textPlacement(x: number, y: number, box: TextBox | null): TextBox {
  if (box) return { x: Math.round(box.x), y: Math.round(box.y), width: Math.max(1, Math.round(box.width)), height: Math.max(1, Math.round(box.height)) };
  const line = Math.ceil(DEFAULT_FONT_SIZE * INTER_LINE);
  return { x: Math.round(x), y: Math.round(y - line / 2), width: 1, height: line };
}

/** The fields of a new, empty text layer at `at`: auto width for a click (width 1), fixed size for a dragged box. */
export function newTextFields(at: TextBox, dragged: boolean): Partial<Node> {
  return {
    x: at.x,
    y: at.y,
    width: at.width,
    height: at.height,
    characters: "",
    fontFamily: BUNDLED_FAMILY,
    fontStyle: "Regular",
    fontSize: DEFAULT_FONT_SIZE,
    fills: [{ type: "SOLID", visible: true, color: { r: 0, g: 0, b: 0, a: 1 } }],
    textAutoResize: dragged ? "NONE" : "WIDTH_AND_HEIGHT",
  };
}
