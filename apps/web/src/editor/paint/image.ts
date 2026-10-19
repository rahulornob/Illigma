/**
 * Images into the file: from the file picker, a drop on the canvas or a
 * fill row, or a paste. `Document.addImage` checks each file (PNG, JPEG,
 * WebP or GIF, at most 32 MB, 16,384 px a side and 64 megapixels) and its
 * plain-language refusal is what the person sees. Images aren't undo
 * history; the layer or paint that uses one is (one undo step).
 */

import type { Document } from "@illigma/core";
import type { ImagePaint, NodeId, Paint } from "@illigma/format";
import { hashImageAsync, imageDimensions } from "@illigma/format";
import { placeAt } from "../geometry";

export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

/**
 * How much one drop or paste can bring in: at most 50 files and 512 MB
 * together (each file is also held to the document's own limits). Past
 * that, the rest are refused with a reason rather than read.
 */
export const IMAGE_IMPORT_LIMITS = { maxFiles: 50, maxTotalBytes: 512 * 1024 * 1024 } as const;

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

/** Decodes an image's bytes and says whether that worked. */
export type ImageDecoder = (bytes: Uint8Array, type: string) => Promise<boolean>;

/**
 * The browser's own decoder (`createImageBitmap`, off the main thread):
 * true if the image decodes. Where there is none (Node), every image passes.
 */
export const browserDecoder: ImageDecoder = async (bytes, type) => {
  if (typeof createImageBitmap !== "function") return true;
  try {
    const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type }));
    bitmap.close();
    return true;
  } catch {
    return false;
  }
};

/**
 * Read `file` and add it to the document. Throws the document's plain
 * message for a file it can't use, and "it isn't a readable image" for one
 * whose header is right but whose data doesn't decode (damaged or cut short),
 * so it is never stored to draw as an empty grey box. The hash is worked out
 * by the platform's native SHA-256 (`crypto.subtle`), so a large image
 * doesn't hold up the page.
 */
export async function addImageFile(doc: Pick<Document, "addImage">, file: Blob & { name?: string }, decode: ImageDecoder = browserDecoder): Promise<AddedImage> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  // Checks the file and remembers its hash, so `addImage` below doesn't hash it again on the main thread.
  await hashImageAsync(bytes);
  if (!(await decode(bytes, file.type))) throw new Error("This image can't be used: it isn't a readable image (its data is damaged or incomplete).");
  const hash = doc.addImage(bytes);
  const size = imageDimensions(bytes) ?? { width: 100, height: 100 };
  return { hash, width: size.width, height: size.height, name: nameOf(file) };
}

/** A file that wasn't used, and why ("it is larger than 32 MB"). */
export interface Refusal {
  name: string;
  reason: string;
}

/** An error's message as a reason after a file's name: "This image can't be used: it is…" → "it is…". */
function reasonOf(e: unknown): string {
  const text = e instanceof Error && e.message ? e.message : String(e);
  return text.replace(/^This image can't be used:\s*/, "").replace(/\.$/, "");
}

/**
 * Read and add `files` (in order) for one drop or paste, within
 * `IMAGE_IMPORT_LIMITS`. Returns the images added and, for each file that
 * wasn't, why. Never throws for a single bad file.
 */
export async function readImageFiles(
  doc: Pick<Document, "addImage">,
  files: readonly (Blob & { name?: string })[],
  limits: { maxFiles: number; maxTotalBytes: number } = IMAGE_IMPORT_LIMITS,
  decode: ImageDecoder = browserDecoder,
): Promise<{ added: AddedImage[]; refused: Refusal[] }> {
  const added: AddedImage[] = [];
  const refused: Refusal[] = [];
  let total = 0;
  for (const [i, file] of files.entries()) {
    const name = file.name || "Image";
    if (i >= limits.maxFiles) {
      refused.push({ name, reason: `only ${limits.maxFiles} files can be added at once` });
      continue;
    }
    if (total + file.size > limits.maxTotalBytes) {
      refused.push({ name, reason: `the files added together would be more than ${Math.round(limits.maxTotalBytes / (1024 * 1024))} MB` });
      continue;
    }
    total += file.size;
    try {
      added.push(await addImageFile(doc, file, decode));
    } catch (e) {
      refused.push({ name, reason: reasonOf(e) });
    }
  }
  return { added, refused };
}

/** At most this many files are named in one message; the rest are counted. */
const LISTED = 5;

/**
 * One message for every file a drop or paste couldn't use, naming each (up
 * to five, then "and N more"), or null when all were used.
 */
export function refusalMessage(refused: readonly Refusal[]): string | null {
  if (!refused.length) return null;
  const first = refused[0] as Refusal;
  if (refused.length === 1) return `“${first.name}” can't be used: ${first.reason}.`;
  const listed = refused.slice(0, LISTED).map((r) => `“${r.name}”: ${r.reason}`);
  const more = refused.length - listed.length;
  return `${refused.length} files can't be used. ${listed.join("; ")}${more > 0 ? `; and ${more} more` : ""}.`;
}

/**
 * Resolves once no live edit (a drag on the canvas or in a card) holds the
 * document, so an import that finished reading mid-drag is added after the
 * drag ends instead of being dropped. Checks on every change and every 50 ms
 * (a drag that changed nothing ends without a change).
 */
export function whenIdle(doc: Pick<Document, "live" | "subscribe">): Promise<void> {
  if (!doc.live) return Promise.resolve();
  return new Promise((resolve) => {
    let stop = () => {};
    const check = () => {
      if (doc.live) return;
      stop();
      resolve();
    };
    const unsubscribe = doc.subscribe(check);
    const timer = setInterval(check, 50);
    stop = () => {
      unsubscribe();
      clearInterval(timer);
    };
  });
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
 * `at` if there is one. In a rotated frame they are laid out in the frame's
 * own space, so they sit where they were dropped and turn with it. One undo
 * step. Returns the new layers.
 */
export function placeImages(doc: Document, pageId: NodeId, images: readonly AddedImage[], at: { x: number; y: number }, viewport?: WorldRect): NodeId[] {
  if (!images.length) return [];
  const sizes = images.map((img) => placedSize(img, viewport));
  const total = sizes.reduce((s, z) => s + z.width, 0) + GAP * (sizes.length - 1);
  const { parent, local } = placeAt(doc, pageId, at.x, at.y);
  let x = local.x - total / 2;
  const label = images.length === 1 ? "Place image" : `Place ${images.length} images`;
  return doc.transact(label, (tx) =>
    images.map((img, i) => {
      const size = sizes[i] as { width: number; height: number };
      const id = tx.create("RECTANGLE", parent, {
        name: img.name,
        x: Math.round(x),
        y: Math.round(local.y - size.height / 2),
        width: size.width,
        height: size.height,
        fills: [imagePaint(img.hash)],
      });
      x += size.width + GAP;
      return id;
    }),
  );
}
