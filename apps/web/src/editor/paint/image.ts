/**
 * Images into the file: from the file picker, a drop on the canvas or a
 * fill row, or a paste. `Document.addImage` checks each file (PNG, JPEG,
 * WebP or GIF, at most 32 MB, 16,384 px a side and 64 megapixels) and its
 * plain-language refusal is what the person sees. Images aren't undo
 * history; the layer or paint that uses one is (one undo step).
 */

import type { Document } from "@illigma/core";
import type { ImagePaint, NodeId, Paint } from "@illigma/format";
import { imageDimensions } from "@illigma/format";
import { absoluteRect, frameAt } from "../geometry";

export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

export interface AddedImage {
  hash: string;
  width: number;
  height: number;
  /** The file's name without its extension ("Image" if it has none). */
  name: string;
}

/** The image files among dropped or pasted files (by type, or by extension when the type is missing). */
export function imageFiles(files: Iterable<File> | ArrayLike<File> | null | undefined): File[] {
  if (!files) return [];
  return Array.from(files).filter((f) => /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif)$/i.test(f.name));
}

const nameOf = (file: { name?: string }) => (file.name ?? "").replace(/\.[^.]+$/, "").trim() || "Image";

/** Read `file` and add it to the document. Throws the document's plain message for a file it can't use. */
export async function addImageFile(doc: Pick<Document, "addImage">, file: Blob & { name?: string }): Promise<AddedImage> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = doc.addImage(bytes);
  const size = imageDimensions(bytes) ?? { width: 100, height: 100 };
  return { hash, width: size.width, height: size.height, name: nameOf(file) };
}

/** An image paint for `hash`, keeping the visibility, opacity and blend mode of `from` when given. */
export function imagePaint(hash: string, from?: Paint): ImagePaint {
  const keep = from ? { visible: from.visible, ...(from.opacity !== undefined ? { opacity: from.opacity } : {}), ...(from.blendMode !== undefined ? { blendMode: from.blendMode } : {}) } : { visible: true };
  if (from?.type === "IMAGE") return { ...from, imageHash: hash };
  return { type: "IMAGE", ...keep, imageHash: hash, scaleMode: "FILL" };
}

/** A box in page (world) coordinates. */
export interface WorldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The size an image is placed at: its natural size in pixels, made smaller
 * (keeping its shape) to fit `fit` when given, at least 1 × 1, whole pixels.
 */
export function placedSize(image: { width: number; height: number }, fit?: { width: number; height: number }): { width: number; height: number } {
  const k = fit && fit.width > 0 && fit.height > 0 ? Math.min(1, fit.width / image.width, fit.height / image.height) : 1;
  return { width: Math.max(1, Math.round(image.width * k)), height: Math.max(1, Math.round(image.height * k)) };
}

const GAP = 20;

/**
 * Rectangles with each image as a FILL paint, at its natural size capped to
 * `viewport`, centred on `at` (several side by side), inside the frame under
 * `at` if there is one. One undo step. Returns the new layers.
 */
export function placeImages(doc: Document, pageId: NodeId, images: readonly AddedImage[], at: { x: number; y: number }, viewport?: WorldRect): NodeId[] {
  if (!images.length) return [];
  const sizes = images.map((img) => placedSize(img, viewport));
  const total = sizes.reduce((s, z) => s + z.width, 0) + GAP * (sizes.length - 1);
  const parent = frameAt(doc, pageId, at.x, at.y) ?? pageId;
  const origin = parent === pageId ? { x: 0, y: 0 } : (absoluteRect(doc, parent) ?? { x: 0, y: 0 });
  let x = at.x - total / 2;
  const label = images.length === 1 ? "Place image" : `Place ${images.length} images`;
  return doc.transact(label, (tx) =>
    images.map((img, i) => {
      const size = sizes[i] as { width: number; height: number };
      const id = tx.create("RECTANGLE", parent, {
        name: img.name,
        x: Math.round(x - origin.x),
        y: Math.round(at.y - size.height / 2 - origin.y),
        width: size.width,
        height: size.height,
        fills: [imagePaint(img.hash)],
      });
      x += size.width + GAP;
      return id;
    }),
  );
}
