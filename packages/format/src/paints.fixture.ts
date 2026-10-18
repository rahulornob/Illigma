/** A valid file with every kind of paint, effect, blend mode and stroke alignment, plus an image. Not part of the build. */

import { sha256Hex } from "./images.js";
import { defaultNode, type IlligmaFile, type Node, type Paint } from "./schema.js";
import { sampleFile } from "./sample.fixture.js";

/** A 1 × 1 PNG. */
export const PNG_1PX = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);
/** A 1 × 1 GIF. */
export const GIF_1PX = Uint8Array.from(atob("R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="), (c) => c.charCodeAt(0));

export const PNG_HASH = sha256Hex(PNG_1PX);
export const GIF_HASH = sha256Hex(GIF_1PX);

const red = { r: 1, g: 0, b: 0, a: 1 };
const blue = { r: 0, g: 0, b: 1, a: 0.5 };

export const ALL_PAINTS: Paint[] = [
  { type: "SOLID", visible: true, color: red, opacity: 0.5, blendMode: "MULTIPLY" },
  {
    type: "GRADIENT_LINEAR",
    visible: true,
    gradientStops: [
      { position: 0, color: red },
      { position: 1, color: blue },
    ],
    gradientTransform: [
      [1, 0, 0],
      [0, 1, 0],
    ],
  },
  {
    type: "GRADIENT_RADIAL",
    visible: false,
    opacity: 0.25,
    gradientStops: [{ position: 0.5, color: red }],
    gradientTransform: [
      [0.5, 0, 0.25],
      [0, 0.5, 0.25],
    ],
  },
  {
    type: "GRADIENT_ANGULAR",
    visible: true,
    blendMode: "LINEAR_DODGE",
    gradientStops: [
      { position: 1, color: blue },
      { position: 0, color: red },
    ],
    gradientTransform: [
      [0, 1, 0],
      [-1, 0, 1],
    ],
  },
  {
    type: "GRADIENT_DIAMOND",
    visible: true,
    gradientStops: [
      { position: 0, color: red },
      { position: 0.3, color: blue },
      { position: 1, color: red },
    ],
    gradientTransform: [
      [2, 0, -0.5],
      [0, 2, -0.5],
    ],
  },
  { type: "IMAGE", visible: true, imageHash: PNG_HASH, scaleMode: "FILL" },
  {
    type: "IMAGE",
    visible: true,
    imageHash: PNG_HASH,
    scaleMode: "CROP",
    imageTransform: [
      [0.5, 0, 0.1],
      [0, 0.5, 0.2],
    ],
    opacity: 0.8,
  },
  { type: "IMAGE", visible: true, imageHash: null, scaleMode: "TILE", scalingFactor: 0.5 },
];

export function paintsFile(): IlligmaFile {
  const file = sampleFile();
  const shape: Node = {
    ...defaultNode("RECTANGLE", "rect1", "frame1", "a1"),
    fills: ALL_PAINTS,
    strokes: [{ type: "IMAGE", visible: true, imageHash: GIF_HASH, scaleMode: "FIT" }],
    strokeAlign: "OUTSIDE",
    blendMode: "SOFT_LIGHT",
    effects: [
      { type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.25 }, offset: { x: 0, y: 4 }, radius: 8, spread: -2, visible: true, blendMode: "NORMAL", showShadowBehindNode: true },
      { type: "INNER_SHADOW", color: { r: 1, g: 1, b: 1, a: 0.5 }, offset: { x: -1, y: 1 }, radius: 0, visible: false },
      { type: "LAYER_BLUR", radius: 4, visible: true },
      { type: "BACKGROUND_BLUR", radius: 20, visible: true },
    ],
  };
  const group: Node = { ...defaultNode("GROUP", "group1", "frame1", "a2"), blendMode: "PASS_THROUGH", strokeAlign: "INSIDE" };
  file.nodes.push(shape, group);
  file.images = new Map([
    [PNG_HASH, PNG_1PX],
    [GIF_HASH, GIF_1PX],
  ]);
  return file;
}
