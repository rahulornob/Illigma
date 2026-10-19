/**
 * Draws one page of a document with CanvasKit (Skia compiled to
 * WebAssembly) on WebGL2.
 *
 * Each top-level child of the page is recorded into its own SkPicture, and
 * the page picture replays those. A document change re-records only the
 * top-level children whose subtree it touched, so editing one layer on a
 * 10k-layer page costs one screen's worth of recording, not the whole page.
 * A top-level child with many children (a screen holding thousands of
 * layers) records them in chunks, each its own picture: editing one layer
 * re-records its chunk and replays the rest. Each frame only replays the
 * page picture under the camera transform.
 */

import type { Change, DeepReadonly, ReadonlyNode } from "@illigma/core";
import {
  PATH_CLOSE,
  PATH_CUBIC,
  PATH_LINE,
  PATH_MOVE,
  type Color,
  imageDimensions,
  type Effect,
  type NodeId,
  type Paint as FilePaint,
  type ShadowEffect,
} from "@illigma/format";
import type { Canvas, CanvasKit, Image, ImageFilter, Paint, Path, SkPicture, Surface } from "canvaskit-wasm";
import { shapeGeometry, type ShapeGeometry } from "./geometry.js";
import { usePathOps } from "./path-ops.js";
import { CLIPPING, hitTest, type NodeSource } from "./hit-test.js";
import { imagePixelScale, PaintKit, sigma, type Box } from "./paint.js";
import { pixelBlur, pixelShadow, type PixelTarget } from "./spread.js";
import { TextEngine, type FontSource, type PlacedParagraph } from "./text.js";

export { CLIPPING, DEFAULT_HIT_TOLERANCE, hitTest, insideShape, toLocal, type HitTestOptions, type NodeSource } from "./hit-test.js";
export { flatten, insideFill, nearStroke, PATH_TYPES, roundedPolygon, shapeGeometry, starPoints, type FillPath, type Flattened, type ShapeGeometry } from "./geometry.js";
export { GpuCanvas } from "./gpu-canvas.js";
export { booleanPath, ckPathFromCommands, commandsFromCkPath, pathOpsEngine, strokeOutline, svgFromCommands, usePathOps } from "./path-ops.js";
export { arrowHeads, arrowLength, booleanOperands, ellipseCommands, isArrowCap, openEnds, operandOutline, pathOps, rectCommands, roundPathCorners, setPathOps, transformCommands, type ChildSource, type FillPathLike, type PathOpsEngine } from "./shape-extras.js";
export { invertTransform } from "./paint.js";
export { styleItalic, styleWeight, TextEngine, TextLayout, type FontSource, type PlacedParagraph, type TextCaret, type TextLayoutLine, type TextNode, type TextRect } from "./text.js";

/** Screen point = (world point − camera.xy) × camera.zoom, in CSS pixels. */
export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface FrameStats {
  /** Milliseconds spent recording pictures this frame (0 when cached). */
  recordMs: number;
  /** Milliseconds spent issuing the draw and flushing to the GPU. */
  drawMs: number;
  /** Nodes drawn in the current recording. */
  nodes: number;
  /** Top-level children re-recorded this frame. */
  recorded: number;
}

/** Encoded image files (PNG, JPEG, WebP, GIF) by `imageHash`: a map, or a lookup that may answer later. */
export type ImageSource =
  | ReadonlyMap<string, Uint8Array>
  | ((hash: string) => Uint8Array | null | undefined | Promise<Uint8Array | null | undefined>);

/**
 * The part of `Document` the renderer reads. A `Document` is one; export
 * passes a read-only view whose `subscribe` never fires.
 */
export interface RenderSource extends NodeSource {
  get(id: NodeId): ReadonlyNode | undefined;
  subscribe(listener: (change: Change) => void): () => void;
  /** Image files by `imageHash` (`Document.image`): the default source for IMAGE paints. */
  image?(hash: string): Uint8Array | undefined;
  /** Called for each image added from now on (`Document.subscribeImages`), so layers showing it as missing can draw it. */
  subscribeImages?(listener: (hash: string) => void): () => void;
}

/** One line of laid-out text, in the TEXT node's own space. */
export interface TextLine {
  text: string;
  /** Left edge of the line. */
  left: number;
  /** Baseline, from the top of the node. */
  baseline: number;
  /** How far the line reaches above its baseline (positive). */
  ascent?: number;
  /** How far the line reaches below its baseline (positive). */
  descent?: number;
  /** The line's width: it runs from `left` to `left + width`. */
  width?: number;
}

export interface RendererOptions {
  /** Fonts for TEXT nodes. The first family is the fallback. Without fonts, text draws as a placeholder bar. */
  fonts?: FontSource[];
  /**
   * A text engine to share (fonts and text layout) instead of `fonts`: the
   * editor's, so layout measures text exactly as it is drawn and fonts added
   * later (fonts on this computer) reach both. The renderer doesn't dispose it.
   */
  textEngine?: TextEngine;
  /**
   * Image files for IMAGE paints. Default: the document's own images
   * (`Document.image`). Each image is decoded once, after the recording that
   * first needs it; until then its paints draw nothing, and once it is ready
   * the layers using it are re-recorded and `onImageReady` is called.
   */
  images?: ImageSource;
  /** Called when an image finished decoding (or failed), so the host can draw a new frame. */
  onImageReady?: () => void;
}

const CANVAS_BG = [0.118, 0.118, 0.125, 1] as const; // matches the editor's canvas token in Dark
/** What a missing or unreadable image draws: a faint grey, so the layer stays visible. */
const MISSING_IMAGE = [0.5, 0.5, 0.5, 0.25] as const;

/**
 * Recording rect for every picture. Node boxes are no good as cull rects:
 * strokes, rotation, text and group children can draw past them. With
 * computeBounds, Skia shrinks the cull rect to what was actually drawn, so
 * nothing visible is culled and off-screen screens are still skipped.
 */
const EVERYWHERE = (ck: CanvasKit) => ck.LTRBRect(-1e9, -1e9, 1e9, 1e9);

/** Node types with no outline of their own: effects that need one (background blur) skip them. */
const NO_OUTLINE = new Set(["GROUP", "PAGE", "TEXT"]);

interface ChildPicture {
  picture: SkPicture | null; // null when the child draws nothing (hidden)
  nodes: number;
  /** Set when its children are recorded in chunks (more than CHUNK_THRESHOLD of them); `picture` replays them. */
  chunks?: Chunk[];
  /** Child id → index of the chunk that draws it. */
  chunkOf?: Map<NodeId, number>;
  /** Images its own picture uses (its chunks list theirs), so decoded images nothing draws any more can be freed. */
  images?: Set<string>;
}

interface ImageEntry {
  /** "failed": the file isn't an image CanvasKit can decode; "missing": the source has no such file. */
  state: "loading" | "ready" | "failed" | "missing";
  image: Image | null;
  /**
   * Very large images on the GPU: `image` (a texture, uploaded once) and
   * copies of half the size each, made when first drawn that small. Image
   * shaders sample the level nearest the drawn size, without mipmaps.
   */
  levels?: Image[];
  /** Top-level children recorded while it was loading: re-recorded once it is ready. */
  waiting: Set<NodeId>;
}

type Shadow = DeepReadonly<ShadowEffect>;

/** A node's visible effects, sorted by kind. */
interface NodeEffects {
  drops: Shadow[];
  inners: Shadow[];
  layerBlur: number;
  backgroundBlur: number;
}

/** A node's filled area: a path, plus its box when it is a rectangle, rounded rectangle or ellipse (spread stays exact and fast). */
interface Outline {
  path: Path;
  box?: Box;
}

/** A run of consecutive children of a top-level node, recorded in that node's own space. */
interface Chunk {
  picture: SkPicture | null;
  nodes: number;
  /** Images this chunk's picture uses. */
  images?: Set<string>;
}

/** Above this many children, a top-level node records its children in chunks. */
export const CHUNK_THRESHOLD = 256;
/** Children per chunk: about √n, at least 64, so an edit re-records about √n layers and replays about √n chunks. */
const chunkSize = (n: number) => Math.max(64, Math.ceil(Math.sqrt(n)));

export class PageRenderer {
  private picture: SkPicture | null = null;
  private readonly children = new Map<NodeId, ChildPicture>();
  /**
   * Top-level children to re-record; `all` after a page switch or font change.
   * null: the whole child. A set: only the chunks drawing these of its children
   * (empty: just its own picture, which replays the chunks).
   */
  private readonly stale = new Map<NodeId, Set<NodeId> | null>();
  private all = true;
  private dirty = true;
  private nodeCount = 0;
  private readonly paint: Paint;
  private readonly layerPaint: Paint;
  private readonly effectPaint: Paint;
  /** Never changed: for layers that only need defaults. */
  private readonly plainPaint: Paint;
  private readonly kit: PaintKit;
  /** Fonts and text layout; null without fonts (text draws as a placeholder bar). */
  private readonly text: TextEngine | null = null;
  /** The renderer made `text` from `options.fonts`, so it disposes it. */
  private readonly ownsText: boolean = false;
  private readonly unsubscribeText: (() => void) | undefined;
  private readonly unsubscribe: () => void;
  private readonly unsubscribeImages: (() => void) | undefined;
  private readonly imageSource: ImageSource | null;
  private readonly onImageReady: (() => void) | undefined;
  private readonly images = new Map<string, ImageEntry>();
  private readonly decoding = new Set<Promise<void>>();
  /** The top-level child being recorded, so images that aren't ready yet know whom to re-record. */
  private recordingTop: NodeId | null = null;
  /** Images the picture being recorded uses (see `ChildPicture.images`). */
  private recordingImages: Set<string> | null = null;
  /** True inside `drawSubtree`: images are decoded on the spot rather than after the recording. */
  private decodeNow = false;
  private disposed = false;
  /** The zoom recordings are made for, as a power of two (pixel effects on the CPU and very large images depend on it). */
  private zoomStep = 1;
  /** Top-level children whose recording depends on `zoomStep`: re-recorded when it changes. */
  private readonly zoomDependent = new Set<NodeId>();
  /**
   * Device pixels per local unit of what is being drawn, and the device pixels
   * drawn at most (the surface): set by `drawSubtree` from its canvas, and for
   * recordings from the pixel density and `zoomStep`.
   */
  private drawScale = 1;
  private drawArea = 0;

  constructor(
    private readonly ck: CanvasKit,
    private surface: Surface,
    private readonly doc: RenderSource,
    private pageId: NodeId,
    private readonly dpr = 1,
    options: RendererOptions = {},
  ) {
    usePathOps(ck);
    this.paint = new ck.Paint();
    this.paint.setAntiAlias(true);
    this.layerPaint = new ck.Paint();
    this.effectPaint = new ck.Paint();
    this.effectPaint.setAntiAlias(true);
    this.plainPaint = new ck.Paint();
    this.kit = new PaintKit(ck);
    if (options.textEngine) {
      this.text = options.textEngine;
      // Fonts added later: every text layer may draw differently now.
      this.unsubscribeText = options.textEngine.subscribe(() => {
        this.all = true;
        this.dirty = true;
      });
    } else if (options.fonts?.length) {
      this.text = new TextEngine(ck, options.fonts);
      this.ownsText = true;
    }
    this.imageSource = options.images ?? (typeof doc.image === "function" ? (hash: string) => doc.image?.(hash) : null);
    this.onImageReady = options.onImageReady;
    this.unsubscribe = doc.subscribe((change) => this.invalidate(change));
    this.unsubscribeImages = doc.subscribeImages?.((hash) => this.imageAdded(hash));
  }

  setPage(pageId: NodeId): void {
    this.pageId = pageId;
    this.all = true;
    this.dirty = true;
  }

  /** Draw into a new surface, e.g. after `GpuCanvas.resize()`. Cached pictures are kept. */
  setSurface(surface: Surface): void {
    this.surface = surface;
  }

  /** Draw one frame. */
  render(camera: Camera): FrameStats {
    let recordMs = 0;
    let recorded = 0;
    // Some layers are recorded for the zoom: on the CPU, those with pixel effects (see `pixelTarget`);
    // anywhere, those with very large images (see `imageShader`). Re-record them when it changes by a
    // factor of two or more.
    const step = 2 ** Math.round(Math.log2(Math.min(256, Math.max(1 / 256, camera.zoom || 1))));
    if (step !== this.zoomStep) {
      this.zoomStep = step;
      for (const id of this.zoomDependent) this.stale.set(id, null);
      if (this.zoomDependent.size) this.dirty = true;
    }
    if (this.dirty || !this.picture) {
      const t = performance.now();
      recorded = this.record();
      recordMs = performance.now() - t;
    }
    const t = performance.now();
    const canvas = this.surface.getCanvas();
    canvas.clear(this.ck.Color4f(...CANVAS_BG));
    canvas.save();
    canvas.scale(this.dpr * camera.zoom, this.dpr * camera.zoom);
    canvas.translate(-camera.x, -camera.y);
    if (this.picture) canvas.drawPicture(this.picture);
    canvas.restore();
    this.surface.flush();
    return { recordMs, drawMs: performance.now() - t, nodes: this.nodeCount, recorded };
  }

  /** Resolves once every image the last recording asked for has been decoded (or has failed). */
  async whenImagesReady(): Promise<void> {
    while (this.decoding.size) await Promise.all([...this.decoding]);
  }

  /**
   * The topmost visible, unlocked node under a screen point (CSS pixels,
   * relative to the canvas). Returns the page's top-level child that holds
   * it, or with `deep` the deepest node.
   */
  hitTest(screenX: number, screenY: number, camera: Camera, deep = false): NodeId | null {
    // Thin lines and paths can be picked within 3 screen pixels of their stroke.
    return hitTest(this.doc, this.pageId, camera.x + screenX / camera.zoom, camera.y + screenY / camera.zoom, { deep, tolerance: 3 / camera.zoom });
  }

  /** World-space bounds of the page's top-level nodes, for "zoom to fit". */
  bounds(): { x: number; y: number; width: number; height: number } | null {
    const top = this.doc.children(this.pageId);
    if (!top.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of top) {
      x0 = Math.min(x0, n.x);
      y0 = Math.min(y0, n.y);
      x1 = Math.max(x1, n.x + n.width);
      y1 = Math.max(y1, n.y + n.height);
    }
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  }

  /**
   * Draw node `id` and its subtree onto `canvas`, uncached, in the node's
   * parent space: the node's own x, y, rotation and opacity apply, its
   * ancestors' don't. Used by export. Images the image source has at hand
   * (a map, or a lookup that answers synchronously, like the document's own)
   * are decoded on the spot, so they are in the result. Returns how many
   * nodes were drawn (0 when the node is missing or hidden).
   */
  drawSubtree(canvas: Canvas, id: NodeId): number {
    const n = this.doc.get(id);
    if (!n) return 0;
    const count = this.nodeCount;
    this.nodeCount = 0;
    this.decodeNow = true;
    const m = canvas.getTotalMatrix();
    this.drawScale = Math.sqrt(Math.abs((m[0] as number) * (m[4] as number) - (m[1] as number) * (m[3] as number))) || 1;
    const clip = canvas.getDeviceClipBounds();
    this.drawArea = Math.max(0, (clip[2] as number) - (clip[0] as number)) * Math.max(0, (clip[3] as number) - (clip[1] as number));
    try {
      this.drawNode(canvas, n);
    } finally {
      this.decodeNow = false;
    }
    const drawn = this.nodeCount;
    this.nodeCount = count;
    return drawn;
  }

  /**
   * How TEXT node `id` breaks into lines when drawn: each line's text, its
   * left edge and its baseline, in the node's own space. `null` without
   * fonts, for other node types, or for empty text. SVG export uses it, so
   * exported text wraps where the canvas wraps it.
   */
  layoutText(id: NodeId): TextLine[] | null {
    const n = this.doc.get(id);
    if (!n || n.type !== "TEXT" || !n.characters || !this.text?.hasFonts) return null;
    const text = n.characters;
    const placed = this.text.place(n) as PlacedParagraph;
    const lines = placed.paragraph.getLineMetrics().map((m) => ({
      text: text.slice(m.startIndex, m.endExcludingWhitespaces).replace(/[\r\n\u2028\u2029]+$/, ""),
      left: placed.x + m.left,
      baseline: placed.y + m.baseline,
      ascent: m.ascent,
      descent: m.descent,
      width: m.width,
    }));
    placed.paragraph.delete();
    return lines;
  }

  dispose(): void {
    this.disposed = true;
    this.unsubscribe();
    this.unsubscribeImages?.();
    this.picture?.delete();
    for (const c of this.children.values()) dropChild(c);
    this.children.clear();
    for (const e of this.images.values()) freeImage(e);
    this.images.clear();
    this.unsubscribeText?.();
    if (this.ownsText) this.text?.dispose();
    this.paint.delete();
    this.layerPaint.delete();
    this.effectPaint.delete();
    this.plainPaint.delete();
    this.kit.dispose();
  }

  /** Mark the top-level children a change touched. Runs after the whole change is applied. */
  private invalidate(change: Change): void {
    this.dirty = true;
    if (this.all) return;
    for (const o of change.ops) {
      if (o.op === "set") {
        const n = this.doc.get(o.id);
        // A new parent or place in the order changes which chunk draws it.
        if (n) this.markFrom(n.id, n.parentId, o.key === "parentId" || o.key === "index");
        // A move also changes what the old parent draws.
        if (o.key === "parentId" && typeof o.prev === "string") this.markFrom(o.id, o.prev, true);
      } else {
        // Created or deleted: its parent's top-level ancestor changes. Deleted
        // ancestors can't be walked, but the topmost deleted node's parent can.
        this.markFrom(o.node.id, o.node.parentId, true);
      }
    }
  }

  /**
   * Mark the top-level ancestor of node `id`, whose parent is `parentId`: the
   * chunk drawing `id` (or its ancestor among the top-level node's children),
   * or the whole top-level node when `id` joins, leaves or moves among its
   * children (`structural`), which changes the chunks.
   */
  private markFrom(id: NodeId, parentId: NodeId | null, structural: boolean): void {
    let cur: NodeId | null = id;
    let below: NodeId | null = null; // cur's child on the way up from id
    let parent = parentId;
    // Bounded by depth; stops at another page or at a deleted ancestor.
    while (parent !== null && parent !== this.pageId) {
      const p = this.doc.get(parent);
      if (!p) return;
      below = cur;
      cur = p.id;
      parent = p.parentId;
    }
    if (parent !== this.pageId || cur === null) return;
    const marked = this.stale.get(cur);
    if (marked === null) return; // already re-recorded whole
    if (below === null) {
      // The top-level node itself: re-record it whole if it moved among the page's layers,
      // else only its own picture (its chunks are in its own space).
      if (structural) this.stale.set(cur, null);
      else if (!marked) this.stale.set(cur, new Set());
      return;
    }
    if (structural && below === id) this.stale.set(cur, null);
    else if (marked) marked.add(below);
    else this.stale.set(cur, new Set([below]));
  }

  /** Re-record stale top-level children, then the page picture. Returns how many children were recorded. */
  private record(): number {
    this.drawScale = this.dpr * this.zoomStep;
    this.drawArea = this.surface.width() * this.surface.height();
    const top = this.doc.children(this.pageId);
    const live = new Set(top.map((n) => n.id));
    for (const [id, c] of this.children) {
      if (live.has(id)) continue;
      dropChild(c);
      this.children.delete(id);
      this.zoomDependent.delete(id);
    }
    let recorded = 0;
    for (const n of top) {
      const stale = this.stale.get(n.id);
      const cached = this.children.get(n.id);
      if (!this.all && stale === undefined && cached) continue;
      recorded++;
      // Every picture recorded for `n` (its chunks too) names it, so an image still loading re-records it once ready.
      this.recordingTop = n.id;
      // Recording it again finds out again whether it depends on the zoom (only a partial re-record keeps the old answer).
      if (!(!this.all && stale && cached?.chunks)) this.zoomDependent.delete(n.id);
      try {
        if (!this.all && stale && cached?.chunks && n.visible && n.opacity > 0) {
          this.rerecordChunks(n, cached, stale);
          continue;
        }
        if (cached) dropChild(cached);
        this.children.set(n.id, this.recordChild(n));
      } finally {
        this.recordingTop = null;
      }
    }
    this.stale.clear();
    this.all = false;
    this.freeUnusedImages();

    // The page picture is just one drawPicture per child, so re-recording it is cheap.
    const recorder = new this.ck.PictureRecorder();
    const canvas = recorder.beginRecording(EVERYWHERE(this.ck), true);
    this.nodeCount = 0;
    for (const n of top) {
      const c = this.children.get(n.id);
      if (!c?.picture) continue;
      canvas.drawPicture(c.picture);
      this.nodeCount += c.nodes;
    }
    this.picture?.delete();
    this.picture = recorder.finishRecordingAsPicture();
    recorder.delete();
    this.dirty = false;
    return recorded;
  }

  private recordChild(n: ReadonlyNode): ChildPicture {
    if (!n.visible || n.opacity <= 0) return { picture: null, nodes: 0 };
    const kids = this.doc.children(n.id);
    if (kids.length > CHUNK_THRESHOLD) {
      const size = chunkSize(kids.length);
      const chunks: Chunk[] = [];
      const chunkOf = new Map<NodeId, number>();
      for (let i = 0; i < kids.length; i += size) {
        const run = kids.slice(i, i + size);
        for (const k of run) chunkOf.set(k.id, chunks.length);
        chunks.push(this.recordRun(run));
      }
      return this.compose(n, { picture: null, nodes: 0, chunks, chunkOf });
    }
    const recorder = new this.ck.PictureRecorder();
    const canvas = recorder.beginRecording(EVERYWHERE(this.ck), true);
    this.nodeCount = 0; // drawNode counts into this; record() re-sums the page total after
    const images = this.collectImages(() => this.drawNode(canvas, n));
    const nodes = this.nodeCount;
    const picture = recorder.finishRecordingAsPicture();
    recorder.delete();
    return { picture, nodes, ...(images && { images }) };
  }

  /** Re-record the chunks drawing `kids` (children of the chunked top-level node `n`), then `n`'s own picture. */
  private rerecordChunks(n: ReadonlyNode, c: ChildPicture, kids: ReadonlySet<NodeId>): void {
    const chunks = c.chunks as Chunk[];
    const chunkOf = c.chunkOf as Map<NodeId, number>;
    const redo = new Set<number>();
    for (const id of kids) {
      const i = chunkOf.get(id);
      if (i !== undefined) redo.add(i);
    }
    if (redo.size) {
      // Chunks are runs of consecutive children; the order is unchanged (a change to it marks `n` whole).
      const all = this.doc.children(n.id);
      const size = chunkSize(all.length);
      for (const i of redo) {
        chunks[i]?.picture?.delete();
        chunks[i] = this.recordRun(all.slice(i * size, i * size + size));
      }
    }
    c.picture?.delete();
    this.compose(n, c);
  }

  /** Record `nodes` (siblings, in their parent's space) into one picture. */
  private recordRun(nodes: readonly ReadonlyNode[]): Chunk {
    const recorder = new this.ck.PictureRecorder();
    const canvas = recorder.beginRecording(EVERYWHERE(this.ck), true);
    this.nodeCount = 0;
    const images = this.collectImages(() => {
      for (const k of nodes) this.drawNode(canvas, k);
    });
    const chunk: Chunk = { picture: recorder.finishRecordingAsPicture(), nodes: this.nodeCount, ...(images && { images }) };
    recorder.delete();
    return chunk;
  }

  /** Record chunked top-level node `n` itself, replaying its chunks for its children, into `c`. */
  private compose(n: ReadonlyNode, c: ChildPicture): ChildPicture {
    const recorder = new this.ck.PictureRecorder();
    const canvas = recorder.beginRecording(EVERYWHERE(this.ck), true);
    this.nodeCount = 0;
    let nodes = 0;
    const images = this.collectImages(() =>
      this.drawNode(canvas, n, (inner) => {
        for (const chunk of c.chunks ?? []) {
          if (chunk.picture) inner.drawPicture(chunk.picture);
          nodes += chunk.nodes;
        }
      }),
    );
    if (images) c.images = images;
    else delete c.images;
    c.picture = recorder.finishRecordingAsPicture();
    c.nodes = this.nodeCount + nodes;
    recorder.delete();
    return c;
  }

  /**
   * Run `draw`, collecting the images it uses. Returns them, or undefined
   * for none. Nested calls don't happen: each recording is one picture.
   */
  private collectImages(draw: () => void): Set<string> | undefined {
    const images = new Set<string>();
    this.recordingImages = images;
    try {
      draw();
    } finally {
      this.recordingImages = null;
    }
    return images.size ? images : undefined;
  }

  /**
   * Free decoded images no cached picture uses any more (the layers using
   * them were deleted or changed). A picture keeps its own reference to the
   * images it draws, so freeing ours never changes what is on screen; an
   * image needed again is decoded again. Images still loading stay.
   */
  private freeUnusedImages(): void {
    if (!this.images.size) return;
    const used = new Set<string>();
    for (const c of this.children.values()) {
      for (const h of c.images ?? []) used.add(h);
      for (const chunk of c.chunks ?? []) for (const h of chunk.images ?? []) used.add(h);
    }
    for (const [hash, e] of this.images) {
      if (used.has(hash) || e.state === "loading") continue;
      freeImage(e);
      this.images.delete(hash);
    }
  }

  /** Draw `n` and its subtree; `children`, if given, draws its children instead (in its space, inside its clip). */
  private drawNode(canvas: Canvas, n: ReadonlyNode, children?: (canvas: Canvas) => void): void {
    if (!n.visible || n.opacity <= 0) return;
    this.nodeCount++;
    const saved = canvas.save();
    canvas.translate(n.x, n.y);
    if (n.rotation) canvas.rotate(n.rotation, 0, 0);

    const kids = this.doc.children(n.id);
    const fx = n.effects?.length ? nodeEffects(n.effects) : null;
    const geometry = shapeGeometry(n, this.doc);
    // Leaf shapes (and clipping frames with a fill) cast shadows from their outline, drawn directly;
    // anything else (groups, text, frames without a fill) from what it draws, through a layer filter.
    const shadows = !!fx && (fx.drops.length > 0 || fx.inners.length > 0);
    const outlined = !NO_OUTLINE.has(n.type) && (kids.length === 0 || (CLIPPING.has(n.type) && n.fills.some((p) => p.visible)));
    const outline = (shadows && outlined) || fx?.backgroundBlur || this.alignedStroke(n, geometry) ? this.outline(n, geometry) : null;
    const direct = shadows && outlined && outline !== null;

    // Background blur reads what is already drawn, so it goes before this node's own layer.
    if (fx?.backgroundBlur && outline) this.drawBackgroundBlur(canvas, outline, fx.backgroundBlur);

    // What the node draws in its own space: its shadows cast from its outline, fills, strokes, then its children inside its clip.
    const rect = this.ck.XYWHRect(0, 0, n.width, n.height);
    const content = (canvas: Canvas) => {
      const silhouette = direct && outline ? this.silhouette(n, geometry, outline) : null;
      if (silhouette && fx) this.drawDropShadows(canvas, n, silhouette, fx.drops);
      if (n.type === "TEXT" && this.text?.hasFonts) {
        this.drawText(canvas, n);
      } else if (geometry) {
        this.drawGeometry(canvas, n, geometry, direct && outline && fx ? fx.inners : [], outline);
      } else {
        for (const fill of n.fills) this.drawShape(canvas, n, rect, fill, false);
        if (direct && outline && fx) this.drawInnerShadows(canvas, outline, fx.inners);
        this.withStrokeAlign(canvas, n, this.alignedStroke(n, null) ? outline : null, (scale) => {
          for (const stroke of n.strokes) this.drawShape(canvas, n, rect, stroke, true, scale);
        });
      }
      if (silhouette && silhouette !== outline) silhouette.path.delete();
      if (CLIPPING.has(n.type)) {
        if (n.cornerRadius > 0) {
          canvas.clipRRect(this.ck.RRectXY(rect, n.cornerRadius, n.cornerRadius), this.ck.ClipOp.Intersect, true);
        } else {
          canvas.clipRect(rect, this.ck.ClipOp.Intersect, true);
        }
      }
      if (children) children(canvas);
      // A boolean's children are its operands: only the combined shape draws.
      else if (n.type !== "BOOLEAN_OPERATION") for (const child of kids) this.drawNode(canvas, child);
    };

    // Opacity, blend mode, layer blur and filtered shadows apply to the node and its children as one group, as in Figma.
    const filtered = !!fx && (fx.layerBlur > 0 || (!direct && (fx.drops.length > 0 || fx.inners.length > 0)));
    const blend = n.blendMode && n.blendMode !== "PASS_THROUGH" && (n.blendMode !== "NORMAL" || this.blendsInside(kids));
    if (filtered && fx) {
      // What the node draws is recorded first, so its layers can be bounded by it: without bounds a layer
      // is the whole clip (the whole surface), and every filter runs over all of it, which is slow on the CPU.
      const recorder = new this.ck.PictureRecorder();
      content(recorder.beginRecording(EVERYWHERE(this.ck), true));
      const picture = recorder.finishRecordingAsPicture();
      recorder.delete();
      const bounds = Float32Array.from(picture.cullRect());
      const pixelShadows = !direct && (fx.drops.length > 0 || fx.inners.length > 0);
      const grouped = n.opacity < 1 || blend || fx.layerBlur > 0;
      if (grouped) {
        const filters: ImageFilter[] = [];
        const keep = (f: ImageFilter) => (filters.push(f), f);
        const blur = fx.layerBlur > 0 ? pixelBlur(this.ck, sigma(fx.layerBlur), this.pixelTarget(bounds, 0), keep) : null;
        this.layerPaint.setAlphaf(n.opacity);
        this.kit.setBlend(this.layerPaint, n.blendMode);
        this.layerPaint.setImageFilter(blur);
        canvas.saveLayer(this.layerPaint, pixelShadows ? shadowReach(bounds, fx) : bounds);
        this.layerPaint.setImageFilter(null);
        this.layerPaint.setBlendMode(this.ck.BlendMode.SrcOver);
        for (const f of filters) f.delete();
      }
      if (pixelShadows) this.drawPixelDropShadows(canvas, picture, bounds, fx.drops);
      this.drawWithPixelInnerShadows(canvas, picture, bounds, pixelShadows ? fx.inners : []);
      picture.delete();
    } else {
      if (n.opacity < 1 || blend) {
        this.layerPaint.setAlphaf(n.opacity);
        this.kit.setBlend(this.layerPaint, n.blendMode);
        canvas.saveLayer(this.layerPaint);
        this.layerPaint.setBlendMode(this.ck.BlendMode.SrcOver);
      }
      content(canvas);
    }
    outline?.path.delete();
    canvas.restoreToCount(saved);
  }

  /** True if some visible descendant blends with a mode of its own, so a NORMAL parent must isolate it. */
  private blendsInside(kids: readonly ReadonlyNode[]): boolean {
    for (const k of kids) {
      if (!k.visible) continue;
      if (k.blendMode && k.blendMode !== "NORMAL" && k.blendMode !== "PASS_THROUGH") return true;
      if ([...k.fills, ...k.strokes].some((p) => p.visible && p.blendMode && p.blendMode !== "NORMAL" && p.blendMode !== "PASS_THROUGH")) return true;
      if (this.blendsInside(this.doc.children(k.id))) return true;
    }
    return false;
  }

  // ---- paints ----

  /**
   * Sets the shared paint for one fill or stroke; false when it draws nothing.
   * `widthScale` doubles a stroke drawn inside or outside a clip (strokeAlign).
   */
  private usePaint(n: ReadonlyNode, paint: DeepReadonly<FilePaint>, stroke: boolean, widthScale = 1): boolean {
    // A 0-weight stroke draws nothing (Skia would draw a hairline).
    if (!paint.visible || (stroke && !(n.strokeWeight > 0))) return false;
    const ck = this.ck;
    const p = this.paint;
    const opacity = paint.opacity ?? 1;
    if (paint.type === "SOLID") {
      const { r, g, b, a } = paint.color;
      p.setShader(null);
      p.setColor(ck.Color4f(r, g, b, a * opacity));
    } else {
      const shader =
        paint.type === "IMAGE" ? this.imageShader(n, paint) : this.kit.gradient(paint, n.width, n.height);
      if (shader === undefined) return false; // image still loading
      if (shader === null) {
        if (paint.type !== "IMAGE") return false;
        p.setShader(null);
        p.setColor(ck.Color4f(MISSING_IMAGE[0], MISSING_IMAGE[1], MISSING_IMAGE[2], MISSING_IMAGE[3] * opacity));
      } else {
        p.setColor(ck.Color4f(1, 1, 1, opacity));
        p.setShader(shader);
        shader.delete(); // the paint holds its own reference
      }
    }
    this.kit.setBlend(p, paint.blendMode);
    p.setStyle(stroke ? ck.PaintStyle.Stroke : ck.PaintStyle.Fill);
    if (stroke) {
      p.setStrokeWidth(n.strokeWeight * widthScale);
      p.setStrokeCap(n.strokeCap === "ROUND" ? ck.StrokeCap.Round : n.strokeCap === "SQUARE" ? ck.StrokeCap.Square : ck.StrokeCap.Butt);
      p.setStrokeJoin(n.strokeJoin === "ROUND" ? ck.StrokeJoin.Round : n.strokeJoin === "BEVEL" ? ck.StrokeJoin.Bevel : ck.StrokeJoin.Miter);
    }
    return true;
  }

  /**
   * The shader for an image paint: `undefined` while the image is loading
   * (it draws nothing, and the layer is re-recorded once it is ready), `null`
   * when it is missing or unreadable.
   */
  private imageShader(n: ReadonlyNode, paint: DeepReadonly<Extract<FilePaint, { type: "IMAGE" }>>) {
    if (paint.imageHash === null) return null;
    this.recordingImages?.add(paint.imageHash);
    const entry = this.imageEntry(paint.imageHash);
    // Export draws once and can't wait: decode now if the bytes are at hand.
    if (entry.state === "loading" && this.decodeNow) {
      const bytes = this.lookupImage(paint.imageHash);
      if (bytes instanceof Uint8Array) this.decodeInto(entry, bytes);
    }
    // Loading: re-recorded once decoded. Missing: re-recorded if the file is added later (`imageAdded`).
    if (this.recordingTop && (entry.state === "loading" || entry.state === "missing")) entry.waiting.add(this.recordingTop);
    if (entry.state === "loading") return undefined;
    if (!entry.image) return null;
    if (!entry.levels) return this.kit.image(paint, entry.image, n.width, n.height);
    // A very large image: the level whose pixels are closest to the device's (within a factor of 1.4), so it neither aliases nor blurs.
    if (this.recordingTop && !this.decodeNow) this.zoomDependent.add(this.recordingTop);
    const perPixel = imagePixelScale(paint, entry.image.width(), entry.image.height(), n.width, n.height) * this.drawScale;
    const level = perPixel > 0 ? Math.max(0, Math.round(Math.log2(1 / perPixel))) : 0;
    const { image, factor } = this.imageLevel(entry, level);
    return this.kit.image(paint, image, n.width, n.height, factor, false);
  }

  /** Level `level` of a very large image (half the size per level, down to 64 px), made on the GPU when first asked for. */
  private imageLevel(e: ImageEntry, level: number): { image: Image; factor: number } {
    const levels = e.levels as Image[];
    const ck = this.ck;
    while (levels.length <= level) {
      const prev = levels[levels.length - 1] as Image;
      if (prev.width() <= 64 && prev.height() <= 64) break;
      const w = Math.max(1, Math.ceil(prev.width() / 2));
      const h = Math.max(1, Math.ceil(prev.height() / 2));
      const surface = this.surface.makeSurface({ width: w, height: h, colorType: ck.ColorType.RGBA_8888, alphaType: ck.AlphaType.Premul, colorSpace: ck.ColorSpace.SRGB });
      if (!surface) break;
      const canvas = surface.getCanvas();
      canvas.clear(ck.TRANSPARENT);
      // Halving with bilinear sampling averages each 2 × 2 block exactly.
      canvas.drawImageRectOptions(prev, ck.XYWHRect(0, 0, prev.width(), prev.height()), ck.XYWHRect(0, 0, w, h), ck.FilterMode.Linear, ck.MipmapMode.None, null);
      levels.push(surface.makeImageSnapshot());
      surface.delete();
    }
    const i = Math.min(level, levels.length - 1);
    const image = levels[i] as Image;
    return { image, factor: (levels[0] as Image).width() / image.width() };
  }

  /**
   * An image was added to the document: if layers drew it as missing,
   * forget that and re-record them, so the next frame decodes it.
   */
  private imageAdded(hash: string): void {
    const entry = this.images.get(hash);
    if (this.disposed || entry?.state !== "missing") return;
    this.images.delete(hash);
    for (const id of entry.waiting) this.stale.set(id, null);
    this.dirty = true;
    this.onImageReady?.();
  }

  /**
   * On the GPU, in a browser: decode `bytes` off the main thread
   * (`createImageBitmap`) and upload it once, as a texture-backed image. A
   * CanvasKit-decoded image this big would be decoded on the main thread at
   * its first frame (800 ms for 8000 × 8000), and uploaded again on every
   * frame: with its mipmaps it doesn't stay in the GPU's resource cache. A
   * texture is never evicted, and `imageLevel` stands in for mipmaps (Skia
   * would rebuild those for a texture on every draw). Null when that isn't
   * possible: the caller decodes with CanvasKit.
   */
  private async decodeToTexture(bytes: Uint8Array): Promise<Image | null> {
    if (typeof createImageBitmap !== "function" || typeof Blob !== "function" || !this.surface.reportBackendTypeIsGPU()) return null;
    let bitmap: ImageBitmap | null = null;
    try {
      // Unpremultiplied, as WebGL uploads it by default: no rounding through premultiplied alpha.
      bitmap = await createImageBitmap(new Blob([bytes as Uint8Array<ArrayBuffer>]), { premultiplyAlpha: "none" });
      if (this.disposed || !this.surface.reportBackendTypeIsGPU()) return null;
      const ck = this.ck;
      const info = { width: bitmap.width, height: bitmap.height, alphaType: ck.AlphaType.Unpremul, colorType: ck.ColorType.RGBA_8888, colorSpace: ck.ColorSpace.SRGB };
      return this.surface.makeImageFromTextureSource(bitmap, info, false);
    } catch {
      return null; // not decodable by the browser, or too big for a texture
    } finally {
      bitmap?.close();
    }
  }

  private decodeInto(e: ImageEntry, bytes: Uint8Array | null | undefined): void {
    e.image = bytes ? this.ck.MakeImageFromEncoded(bytes) : null;
    e.state = e.image ? "ready" : bytes ? "failed" : "missing";
  }

  /** Ask the image source for a file. Throwing sources count as having none. */
  private lookupImage(hash: string): Uint8Array | null | undefined | Promise<Uint8Array | null | undefined> {
    try {
      const src = this.imageSource;
      return typeof src === "function" ? src(hash) : src?.get(hash);
    } catch {
      return null;
    }
  }

  private imageEntry(hash: string): ImageEntry {
    let entry = this.images.get(hash);
    // Layers that drew it as missing: re-recorded once it decodes.
    let waiting: Set<NodeId> | undefined;
    // A missing image may have been added since (e.g. `Document.addImage` after the paint): look again, synchronously.
    if (entry?.state === "missing") {
      const again = this.lookupImage(hash);
      if (!(again instanceof Uint8Array)) return entry;
      this.images.delete(hash);
      waiting = entry.waiting;
      entry = undefined;
    }
    if (entry) return entry;
    const e: ImageEntry = { state: "loading", image: null, waiting: waiting ?? new Set() };
    this.images.set(hash, e);
    const found = this.lookupImage(hash);
    if (!found) {
      e.state = "missing";
      return e;
    }
    const job = (async () => {
      let bytes: Uint8Array | null | undefined;
      try {
        bytes = await found;
      } catch {
        bytes = null;
      }
      // Decoded after the recording that asked, never inside it.
      await Promise.resolve();
      if (this.disposed) return;
      const size = bytes && e.state === "loading" ? imageDimensions(bytes) : null;
      const texture = size && size.width * size.height > BIG_IMAGE_PIXELS ? await this.decodeToTexture(bytes as Uint8Array) : null;
      if (this.disposed) {
        texture?.delete();
        return;
      }
      if (texture && e.state === "loading") {
        e.image = texture;
        e.levels = [texture];
        e.state = "ready";
      } else {
        texture?.delete();
      }
      if (e.state === "loading") this.decodeInto(e, bytes);
      for (const id of e.waiting) this.stale.set(id, null); // re-record the whole child: its chunks may hold the image too
      e.waiting.clear();
      this.dirty = true;
      this.onImageReady?.();
    })();
    this.decoding.add(job);
    void job.finally(() => this.decoding.delete(job));
    return e;
  }

  // ---- shapes ----

  /** Vectors, stars, polygons and lines: each fill over every region (with its winding rule), inner shadows, then each stroke. */
  private drawGeometry(canvas: Canvas, n: ReadonlyNode, geo: ShapeGeometry, inners: readonly Shadow[], outline: Outline | null): void {
    const visibleFills = n.fills.some((p) => p.visible);
    const visibleStrokes = n.strokeWeight > 0 && n.strokes.some((p) => p.visible);
    if (visibleFills && geo.fills.length) {
      const paths = geo.fills.map((f) => this.toPath(f.commands, f.evenOdd));
      for (const fill of n.fills) {
        if (!this.usePaint(n, fill, false)) continue;
        for (const path of paths) if (path) canvas.drawPath(path, this.paint);
      }
      for (const path of paths) path?.delete();
    }
    if (inners.length && outline) this.drawInnerShadows(canvas, outline, inners);
    if (visibleStrokes && geo.stroke.length) {
      const path = this.toPath(geo.stroke, false);
      if (path) {
        this.withStrokeAlign(canvas, n, this.alignedStroke(n, geo) ? outline : null, (scale) => {
          for (const stroke of n.strokes) if (this.usePaint(n, stroke, true, scale)) canvas.drawPath(path, this.paint);
        });
        path.delete();
      }
      // Arrow-head triangles, filled with the stroke's paints.
      const heads = geo.capFill?.length ? this.toPath(geo.capFill, false) : null;
      if (heads) {
        for (const stroke of n.strokes) if (this.usePaint(n, stroke, false)) canvas.drawPath(heads, this.paint);
        heads.delete();
      }
    }
  }

  /** Path commands (see `@illigma/format`) to a CanvasKit path, in one call into WebAssembly. */
  private toPath(commands: readonly number[], evenOdd: boolean): Path | null {
    const ck = this.ck;
    const cmds = new Float32Array(commands.length);
    for (let i = 0; i < commands.length; ) {
      const verb = commands[i] as number;
      const args = verb === PATH_MOVE || verb === PATH_LINE ? 2 : verb === PATH_CUBIC ? 6 : verb === PATH_CLOSE ? 0 : -1;
      if (args < 0) break;
      cmds[i] = verb === PATH_MOVE ? ck.MOVE_VERB : verb === PATH_LINE ? ck.LINE_VERB : verb === PATH_CUBIC ? ck.CUBIC_VERB : ck.CLOSE_VERB;
      for (let k = 1; k <= args; k++) cmds[i + k] = commands[i + k] as number;
      i += args + 1;
    }
    const path = ck.Path.MakeFromCmds(cmds);
    if (path && evenOdd) path.setFillType(ck.FillType.EvenOdd);
    return path;
  }

  private drawShape(canvas: Canvas, n: ReadonlyNode, rect: Float32Array, paint: DeepReadonly<FilePaint>, stroke: boolean, widthScale = 1): void {
    if (!this.usePaint(n, paint, stroke, widthScale)) return;
    if (n.type === "ELLIPSE") canvas.drawOval(rect, this.paint);
    else if (n.type === "TEXT") canvas.drawRect(this.ck.XYWHRect(0, n.height * 0.3, n.width, n.height * 0.4), this.paint); // placeholder until fonts are loaded
    else if (n.cornerRadius > 0) canvas.drawRRect(this.ck.RRectXY(rect, n.cornerRadius, n.cornerRadius), this.paint);
    else canvas.drawRect(rect, this.paint);
  }

  // ---- strokes ----

  /** True when the node's strokes sit inside or outside its outline (closed shapes only; lines and open paths are centred). */
  private alignedStroke(n: ReadonlyNode, geo: ShapeGeometry | null): boolean {
    if (!n.strokeAlign || n.strokeAlign === "CENTER" || !(n.strokeWeight > 0) || n.type === "TEXT") return false;
    if (n.type === "LINE") return false;
    if (n.type === "VECTOR") return !!geo && (n.vectorNetwork?.regions.length ?? 0) > 0;
    if (n.type === "BOOLEAN_OPERATION") return !!geo;
    return !NO_OUTLINE.has(n.type);
  }

  /**
   * Draw strokes with the node's alignment: centred as they are, or at twice
   * the weight clipped to the inside or the outside of the outline.
   */
  private withStrokeAlign(canvas: Canvas, n: ReadonlyNode, outline: Outline | null, draw: (widthScale: number) => void): void {
    if (!outline || !n.strokeAlign || n.strokeAlign === "CENTER") {
      draw(1);
      return;
    }
    canvas.save();
    canvas.clipPath(outline.path, n.strokeAlign === "INSIDE" ? this.ck.ClipOp.Intersect : this.ck.ClipOp.Difference, true);
    draw(2);
    canvas.restore();
  }

  // ---- outlines, for effects and stroke alignment ----

  /** The node's filled area in its own space, or null if it has none (groups, text, lines, open paths with nothing to fill). */
  private outline(n: ReadonlyNode, geo: ShapeGeometry | null): Outline | null {
    const ck = this.ck;
    if (NO_OUTLINE.has(n.type)) return null;
    if (geo) {
      let path: Path | null = null;
      for (const f of geo.fills) {
        const p = this.toPath(f.commands, f.evenOdd);
        if (!p) continue;
        if (!path) path = p;
        else {
          const u = ck.Path.MakeFromOp(path, p, ck.PathOp.Union);
          p.delete();
          if (u) {
            path.delete();
            path = u;
          }
        }
      }
      return path ? { path } : null;
    }
    const oval = n.type === "ELLIPSE";
    const r = oval ? 0 : Math.max(0, Math.min(n.cornerRadius, n.width / 2, n.height / 2));
    return this.boxOutline({ x0: 0, y0: 0, x1: n.width, y1: n.height, r, oval });
  }

  private boxOutline(box: NonNullable<Outline["box"]>): Outline {
    const ck = this.ck;
    const builder = new ck.PathBuilder();
    const rect = ck.LTRBRect(box.x0, box.y0, Math.max(box.x0, box.x1), Math.max(box.y0, box.y1));
    if (box.oval) builder.addOval(rect);
    else if (box.r > 0) builder.addRRect(ck.RRectXY(rect, box.r, box.r));
    else builder.addRect(rect);
    return { path: builder.detachAndDelete(), box };
  }

  /** `o` grown (spread > 0) or shrunk (spread < 0) by `spread`. Boxes stay boxes; other paths go through path operations. */
  private spread(o: Outline, spread: number): Outline | null {
    if (o.box) {
      const b = o.box;
      const x0 = b.x0 - spread, y0 = b.y0 - spread, x1 = b.x1 + spread, y1 = b.y1 + spread;
      if (x1 <= x0 || y1 <= y0) return null;
      // Figma keeps square corners square and grows round ones with the spread.
      const r = b.r > 0 ? Math.max(0, b.r + spread) : 0;
      return this.boxOutline({ x0, y0, x1, y1, r, oval: b.oval });
    }
    const ck = this.ck;
    const ring = o.path.makeStroked({ width: 2 * Math.abs(spread), join: ck.StrokeJoin.Miter, miter_limit: 4 });
    if (!ring) return { path: o.path.copy() };
    const path = ck.Path.MakeFromOp(o.path, ring, spread > 0 ? ck.PathOp.Union : ck.PathOp.Difference);
    ring.delete();
    return path ? { path } : null;
  }

  /**
   * What a shape's drop shadows are cast from: its outline where it has a
   * visible fill, plus where its visible strokes draw. May be `outline` itself.
   */
  private silhouette(n: ReadonlyNode, geo: ShapeGeometry | null, outline: Outline): Outline | null {
    const ck = this.ck;
    const filled = n.fills.some((p) => p.visible);
    const stroked = n.strokeWeight > 0 && n.strokes.some((p) => p.visible);
    if (!stroked) return filled ? outline : null;
    const align = this.alignedStroke(n, geo) ? n.strokeAlign : "CENTER";
    if (align === "INSIDE" && filled) return outline;
    const source = geo ? this.toPath(geo.stroke, false) : outline.path.copy();
    if (!source) return filled ? outline : null;
    const join = n.strokeJoin === "ROUND" ? ck.StrokeJoin.Round : n.strokeJoin === "BEVEL" ? ck.StrokeJoin.Bevel : ck.StrokeJoin.Miter;
    const cap = n.strokeCap === "ROUND" ? ck.StrokeCap.Round : n.strokeCap === "SQUARE" ? ck.StrokeCap.Square : ck.StrokeCap.Butt;
    const ring = source.makeStroked({ width: n.strokeWeight * (align === "CENTER" ? 1 : 2), join, cap });
    source.delete();
    if (!ring) return filled ? outline : null;
    // Inside or outside strokes only cover their side of the outline.
    let strokeArea: Path | null = ring;
    if (align !== "CENTER") {
      strokeArea = ck.Path.MakeFromOp(ring, outline.path, align === "INSIDE" ? ck.PathOp.Intersect : ck.PathOp.Difference);
      ring.delete();
    }
    if (!strokeArea) return filled ? outline : null;
    if (!filled) return { path: strokeArea };
    const both = ck.Path.MakeFromOp(outline.path, strokeArea, ck.PathOp.Union);
    strokeArea.delete();
    return both ? { path: both } : outline;
  }

  /** True when every visible fill and stroke is opaque, so nothing under the shape shows through it. */
  private opaque(n: ReadonlyNode): boolean {
    const solid = (p: DeepReadonly<FilePaint>) =>
      !p.visible || (p.type === "SOLID" && p.color.a >= 1 && (p.opacity ?? 1) >= 1 && (!p.blendMode || p.blendMode === "NORMAL" || p.blendMode === "PASS_THROUGH"));
    return n.fills.every(solid) && n.strokes.every(solid);
  }

  // ---- effects ----

  /** A shape's drop shadows, from its silhouette: offset, spread and blurred, and (unless asked) not showing through the shape. */
  private drawDropShadows(canvas: Canvas, n: ReadonlyNode, silhouette: Outline, drops: readonly Shadow[]): void {
    const knockOut = !this.opaque(n);
    for (const d of drops) {
      const shape = d.spread ? this.spread(silhouette, d.spread) : silhouette;
      if (!shape) continue;
      canvas.save();
      if (knockOut && !d.showShadowBehindNode) canvas.clipPath(silhouette.path, this.ck.ClipOp.Difference, true);
      canvas.translate(d.offset.x, d.offset.y);
      const s = sigma(d.radius);
      const box = shape.box;
      // Rectangles and rounded rectangles: Skia blurs them analytically. Ellipses: our blurred-box shader.
      // Either way no offscreen mask, so the cost doesn't grow as the zoom changes. Other paths use a mask.
      const shader = box ? this.kit.boxBlur(box, s, d.color, false) : null;
      if (shader) {
        this.useShadowPaint(d, false);
        this.effectPaint.setShader(shader);
        shader.delete();
        const pad = 3 * s + 1;
        canvas.drawRect(this.ck.LTRBRect(box!.x0 - pad, box!.y0 - pad, box!.x1 + pad, box!.y1 + pad), this.effectPaint);
        this.effectPaint.setShader(null);
      } else {
        this.useShadowPaint(d);
        if (box) this.drawBox(canvas, box, this.effectPaint);
        else canvas.drawPath(shape.path, this.effectPaint);
      }
      canvas.restore();
      if (shape !== silhouette) shape.path.delete();
    }
    this.effectPaint.setMaskFilter(null);
  }

  private drawBox(canvas: Canvas, box: Box, paint: Paint): void {
    const ck = this.ck;
    const rect = ck.LTRBRect(box.x0, box.y0, box.x1, box.y1);
    if (box.oval) canvas.drawOval(rect, paint);
    else if (box.r > 0) canvas.drawRRect(ck.RRectXY(rect, box.r, box.r), paint);
    else canvas.drawRect(rect, paint);
  }

  /** Inner shadows: the blurred outside of the (offset, shrunk) outline, clipped to the outline. */
  private drawInnerShadows(canvas: Canvas, outline: Outline, inners: readonly Shadow[]): void {
    const ck = this.ck;
    for (const d of inners) {
      // Spread grows the shadow inwards: the hole it is cast around shrinks.
      const hole = d.spread ? this.spread(outline, -d.spread) : outline;
      // Boxes: the outline drawn once with the blurred-box shader, inverted around the moved hole. No mask, no clip.
      const s = sigma(d.radius);
      if (outline.box && s > 0 && (!hole || hole.box)) {
        const holeBox = hole?.box;
        const shader = holeBox
          ? this.kit.boxBlur({ ...holeBox, x0: holeBox.x0 + d.offset.x, x1: holeBox.x1 + d.offset.x, y0: holeBox.y0 + d.offset.y, y1: holeBox.y1 + d.offset.y }, s, d.color, true)
          : null;
        if (!holeBox || shader) {
          this.useShadowPaint(d, false);
          if (shader) {
            this.effectPaint.setShader(shader);
            shader.delete();
          } else {
            this.effectPaint.setColor(ck.Color4f(d.color.r, d.color.g, d.color.b, d.color.a)); // spread swallowed the hole: all shadow
          }
          this.drawBox(canvas, outline.box, this.effectPaint);
          this.effectPaint.setShader(null);
          if (hole && hole !== outline) hole.path.delete();
          continue;
        }
      }
      const b = outline.path.getBounds();
      const pad = Math.abs(d.offset.x) + Math.abs(d.offset.y) + 3 * sigma(d.radius) + Math.abs(d.spread ?? 0) + 1;
      const frame = new ck.PathBuilder()
        .addRect(ck.LTRBRect((b[0] as number) - pad, (b[1] as number) - pad, (b[2] as number) + pad, (b[3] as number) + pad))
        .detachAndDelete();
      let ring: Path | null = frame;
      if (hole) {
        const moved = new ck.PathBuilder(hole.path).offset(d.offset.x, d.offset.y).detachAndDelete();
        ring = ck.Path.MakeFromOp(frame, moved, ck.PathOp.Difference);
        moved.delete();
        frame.delete();
        if (hole !== outline) hole.path.delete();
      }
      if (!ring) continue;
      canvas.save();
      canvas.clipPath(outline.path, ck.ClipOp.Intersect, true);
      this.useShadowPaint(d);
      canvas.drawPath(ring, this.effectPaint);
      canvas.restore();
      ring.delete();
    }
    this.effectPaint.setMaskFilter(null);
  }

  /** The shadow's colour and blend mode on the effect paint, and with `blurred` its blur as a mask filter. */
  private useShadowPaint(d: Shadow, blurred = true): void {
    const ck = this.ck;
    const { r, g, b, a } = d.color;
    // With a shader, the shader carries the colour; the paint stays opaque white so it doesn't tint it.
    this.effectPaint.setColor(blurred ? ck.Color4f(r, g, b, a) : ck.Color4f(1, 1, 1, 1));
    const s = sigma(d.radius);
    const blur = blurred && s > 0 ? ck.MaskFilter.MakeBlur(ck.BlurStyle.Normal, s, true) : null;
    this.effectPaint.setMaskFilter(blur);
    blur?.delete();
    this.kit.setBlend(this.effectPaint, d.blendMode);
  }

  /** Blur what is behind the node, inside its outline. */
  private drawBackgroundBlur(canvas: Canvas, outline: Outline, radius: number): void {
    const ck = this.ck;
    const s = sigma(radius);
    if (!(s > 0)) return;
    canvas.save();
    canvas.clipPath(outline.path, ck.ClipOp.Intersect, true);
    const blur = ck.ImageFilter.MakeBlur(s, s, ck.TileMode.Clamp, null);
    canvas.saveLayer(this.plainPaint, null, blur);
    canvas.restore();
    canvas.restore();
    blur.delete();
  }

  /**
   * Drop shadows cast from what a node without one outline draws (groups,
   * text, frames without a fill), recorded in `picture`, bottom first. Unless
   * a shadow shows behind the node, it is knocked out where the node draws:
   * that only matters inside the node's bounds, so only that part of the
   * shadow goes through the extra blend.
   */
  private drawPixelDropShadows(canvas: Canvas, picture: SkPicture, bounds: Float32Array, drops: readonly Shadow[]): void {
    const ck = this.ck;
    const paint = this.layerPaint;
    paint.setAlphaf(1);
    for (const d of drops) {
      const filters: ImageFilter[] = [];
      const keep = (f: ImageFilter) => (filters.push(f), f);
      const spec = { dx: d.offset.x, dy: d.offset.y, sigma: sigma(d.radius), spread: d.spread ?? 0, color: ck.Color4f(d.color.r, d.color.g, d.color.b, d.color.a) };
      const shadow = pixelShadow(ck, spec, this.pixelTarget(bounds, spec.spread), keep);
      const layer = (filter: ImageFilter, clip?: "inside" | "outside") => {
        canvas.save();
        // Hard-edged clips, so the two parts meet without a seam.
        if (clip) canvas.clipRect(bounds, clip === "inside" ? ck.ClipOp.Intersect : ck.ClipOp.Difference, false);
        paint.setImageFilter(filter);
        canvas.saveLayer(paint, bounds);
        paint.setImageFilter(null);
        canvas.drawPicture(picture);
        canvas.restore();
        canvas.restore();
      };
      if (d.showShadowBehindNode) {
        layer(shadow);
      } else {
        layer(shadow, "outside");
        layer(keep(ck.ImageFilter.MakeBlend(ck.BlendMode.DstOut, shadow, null)), "inside");
      }
      for (const f of filters) f.delete();
    }
  }

  /**
   * What a node without one outline draws (`picture`), with its inner
   * shadows on top. Each shadow is its colour wherever the node draws, less
   * the blurred, moved node (the hole it is cast around, which spread
   * shrinks), laid over the node with SrcATop, so the node's alpha stays as
   * it is. Built from the node's own pixels, so it stays within its bounds.
   */
  private drawWithPixelInnerShadows(canvas: Canvas, picture: SkPicture, bounds: Float32Array, inners: readonly Shadow[]): void {
    if (!inners.length) {
      canvas.drawPicture(picture);
      return;
    }
    const ck = this.ck;
    const IF = ck.ImageFilter;
    const filters: ImageFilter[] = [];
    const keep = (f: ImageFilter) => (filters.push(f), f);
    let result: ImageFilter | null = null; // null: the node itself
    for (const d of inners) {
      const spec = { dx: d.offset.x, dy: d.offset.y, sigma: sigma(d.radius), spread: -(d.spread ?? 0), color: ck.BLACK };
      const hole = pixelShadow(ck, spec, this.pixelTarget(bounds, spec.spread), keep);
      // The shadow's colour wherever the node isn't fully transparent (bounded, unlike a flood of colour).
      const { r, g, b, a } = d.color;
      const flood = ck.ColorFilter.MakeMatrix([0, 0, 0, 0, r, 0, 0, 0, 0, g, 0, 0, 0, 0, b, 0, 0, 0, 255, 0]);
      const fade = ck.ColorFilter.MakeMatrix([1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, a, 0]);
      const colour = keep(IF.MakeColorFilter(fade, keep(IF.MakeColorFilter(flood, null))));
      flood.delete();
      fade.delete();
      const shadow = keep(IF.MakeBlend(ck.BlendMode.DstOut, colour, hole));
      result = keep(IF.MakeBlend(ck.BlendMode.SrcATop, result, shadow));
    }
    this.layerPaint.setAlphaf(1);
    this.layerPaint.setImageFilter(result);
    canvas.saveLayer(this.layerPaint, bounds);
    this.layerPaint.setImageFilter(null);
    canvas.drawPicture(picture);
    canvas.restore();
    for (const f of filters) f.delete();
  }

  /**
   * Where pixel effects run (see `spread.ts`): device pixels per local unit
   * (`drawScale`: layers never scale, only the canvas does), the device
   * pixels a layer drawing `bounds` covers once grown by `spread` (at most
   * the surface), and whether on the GPU.
   */
  private pixelTarget(bounds: Float32Array, spread: number): PixelTarget {
    // Export draws straight onto its own (CPU) canvas; recordings replay on the editor's surface.
    const gpu = !this.decodeNow && this.surface.reportBackendTypeIsGPU();
    // On the CPU, recordings are made for the zoom (see `render`).
    if (!gpu && !this.decodeNow && this.recordingTop) this.zoomDependent.add(this.recordingTop);
    const scale = this.drawScale;
    const pad = Math.max(0, spread);
    const w = Math.max(0, (bounds[2] as number) - (bounds[0] as number) + 2 * pad);
    const h = Math.max(0, (bounds[3] as number) - (bounds[1] as number) + 2 * pad);
    return { scale, area: Math.min(w * h * scale * scale, this.drawArea || Infinity), gpu };
  }

  // ---- text ----

  /**
   * Text laid out for its box (`TextEngine.place`: wrapping, alignment, auto
   * width), drawn once per visible fill, then its strokes.
   */
  private drawText(canvas: Canvas, n: ReadonlyNode): void {
    const text = this.text;
    if (!n.characters || !text) return;
    for (const fill of n.fills) {
      if (!fill.visible) continue;
      // A plain solid colour needs no paint; anything else (gradients, images, opacity, blending) draws with one.
      const plain = fill.type === "SOLID" && (fill.opacity ?? 1) === 1 && (!fill.blendMode || fill.blendMode === "NORMAL" || fill.blendMode === "PASS_THROUGH");
      if (!plain && !this.usePaint(n, fill, false)) continue;
      const color = fill.type === "SOLID" ? fill.color : { r: 0, g: 0, b: 0, a: 1 };
      this.drawPlaced(canvas, text.place(n, color, plain ? null : this.paint));
    }
    this.drawTextStrokes(canvas, n);
  }

  private drawPlaced(canvas: Canvas, placed: PlacedParagraph | null): void {
    if (!placed) return;
    canvas.drawParagraph(placed.paragraph, placed.x, placed.y);
    placed.paragraph.delete();
  }

  /**
   * Text strokes, over the fills (as in Figma): the glyph outlines stroked
   * with each visible stroke paint. Centred strokes are drawn as they are.
   * Inside and outside strokes are drawn at twice the weight in a layer, then
   * cut to the inside (DstIn) or the outside (DstOut) of the glyphs, drawn
   * solid, so they cover exactly their side of the outline.
   */
  private drawTextStrokes(canvas: Canvas, n: ReadonlyNode): void {
    const text = this.text;
    if (!text || !(n.strokeWeight > 0) || !n.strokes.some((p) => p.visible)) return;
    const ck = this.ck;
    const align = n.strokeAlign === "INSIDE" || n.strokeAlign === "OUTSIDE" ? n.strokeAlign : "CENTER";
    const scale = align === "CENTER" ? 1 : 2;
    const black = { r: 0, g: 0, b: 0, a: 1 };
    let bounds: Float32Array | null = null;
    for (const stroke of n.strokes) {
      if (align === "CENTER") {
        if (!this.usePaint(n, stroke, true)) continue;
        this.drawPlaced(canvas, text.place(n, black, this.paint));
        continue;
      }
      if (!stroke.visible) continue;
      // The glyphs, solid: what the doubled stroke is cut to.
      const glyphs = text.place(n, black, null);
      if (!glyphs) continue;
      if (!bounds) {
        // The text's box and its lines (which may run past it), plus the stroke and its miters.
        const pad = n.strokeWeight * scale * 4 + 1;
        const p = glyphs.paragraph;
        const w = Math.max(n.width, glyphs.x + Math.max(p.getMaxIntrinsicWidth(), p.getLongestLine()));
        const h = Math.max(n.height, glyphs.y + p.getHeight());
        bounds = ck.LTRBRect(Math.min(0, glyphs.x) - pad, Math.min(0, glyphs.y) - pad, w + pad, h + pad);
      }
      // The layer blends with what is below in the stroke's blend mode; inside it, the stroke draws normally.
      this.kit.setBlend(this.layerPaint, stroke.blendMode);
      this.layerPaint.setAlphaf(1);
      canvas.saveLayer(this.layerPaint, bounds);
      this.layerPaint.setBlendMode(ck.BlendMode.SrcOver);
      if (this.usePaint(n, { ...stroke, blendMode: "NORMAL" }, true, scale)) this.drawPlaced(canvas, text.place(n, black, this.paint));
      this.plainPaint.setBlendMode(align === "INSIDE" ? ck.BlendMode.DstIn : ck.BlendMode.DstOut);
      canvas.saveLayer(this.plainPaint, bounds);
      this.plainPaint.setBlendMode(ck.BlendMode.SrcOver);
      this.drawPlaced(canvas, glyphs);
      canvas.restore();
      canvas.restore();
    }
  }
}

/** Images with more pixels than this (2048 × 2048) are decoded off the main thread and kept as GPU textures, where there is a GPU. */
const BIG_IMAGE_PIXELS = 2048 * 2048;

/** Free a decoded image and its smaller levels. */
function freeImage(e: ImageEntry): void {
  for (const level of e.levels ?? []) if (level !== e.image) level.delete();
  e.image?.delete();
  delete e.levels;
}

/** `bounds` grown by as far as the node's drop shadows reach (offset, spread, 3 sigma). */
function shadowReach(bounds: Float32Array, fx: NodeEffects): Float32Array {
  const [x0, y0, x1, y1] = bounds as unknown as [number, number, number, number];
  let l = x0, t = y0, r = x1, b = y1;
  for (const d of fx.drops) {
    const grow = Math.max(0, d.spread ?? 0) + 3 * sigma(d.radius) + 1;
    l = Math.min(l, x0 + d.offset.x - grow);
    t = Math.min(t, y0 + d.offset.y - grow);
    r = Math.max(r, x1 + d.offset.x + grow);
    b = Math.max(b, y1 + d.offset.y + grow);
  }
  return Float32Array.of(l, t, r, b);
}

function nodeEffects(effects: DeepReadonly<Effect[]>): NodeEffects | null {
  const fx: NodeEffects = { drops: [], inners: [], layerBlur: 0, backgroundBlur: 0 };
  for (const e of effects) {
    if (!e.visible) continue;
    if (e.type === "DROP_SHADOW") fx.drops.push(e);
    else if (e.type === "INNER_SHADOW") fx.inners.push(e);
    else if (e.type === "LAYER_BLUR") fx.layerBlur = Math.max(fx.layerBlur, e.radius);
    else fx.backgroundBlur = Math.max(fx.backgroundBlur, e.radius);
  }
  return fx.drops.length || fx.inners.length || fx.layerBlur > 0 || fx.backgroundBlur > 0 ? fx : null;
}

/** Free a top-level child's pictures, chunks included. */
function dropChild(c: ChildPicture): void {
  c.picture?.delete();
  for (const chunk of c.chunks ?? []) chunk.picture?.delete();
}

/**
 * Make a GPU surface for `canvas`, sized to its CSS box × devicePixelRatio.
 * @deprecated Each call makes a new WebGL context that `surface.delete()`
 * doesn't free, so calling it on every resize leaks. Use `GpuCanvas`.
 */
export function makeSurface(ck: CanvasKit, canvas: HTMLCanvasElement, dpr = globalThis.devicePixelRatio || 1): Surface {
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  let surface: Surface | null = null;
  try {
    surface = ck.MakeWebGLCanvasSurface(canvas);
  } catch {
    // CanvasKit throws, rather than returning null, when WebGL is unavailable.
    surface = ck.MakeSWCanvasSurface(canvas);
  }
  if (!surface) throw new Error("Couldn't create a drawing surface: neither WebGL nor a 2D canvas is available.");
  return surface;
}
