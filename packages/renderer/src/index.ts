/**
 * Draws one page of a document with CanvasKit (Skia compiled to
 * WebAssembly) on WebGL2.
 *
 * Each top-level child of the page is recorded into its own SkPicture, and
 * the page picture replays those. A document change re-records only the
 * top-level children whose subtree it touched, so editing one layer on a
 * 10k-layer page costs one screen's worth of recording, not the whole page.
 * Each frame only replays the page picture under the camera transform.
 */

import type { Change, DeepReadonly, ReadonlyNode } from "@illigma/core";
import {
  PATH_CLOSE,
  PATH_CUBIC,
  PATH_LINE,
  PATH_MOVE,
  type Color,
  type Effect,
  type NodeId,
  type Paint as FilePaint,
  type ShadowEffect,
} from "@illigma/format";
import type { Canvas, CanvasKit, FontWeight, Image, ImageFilter, Paint, Paragraph, Path, SkPicture, Surface, TypefaceFontProvider } from "canvaskit-wasm";
import { shapeGeometry, type ShapeGeometry } from "./geometry.js";
import { CLIPPING, hitTest, type NodeSource } from "./hit-test.js";
import { PaintKit, sigma, type Box } from "./paint.js";

export { CLIPPING, DEFAULT_HIT_TOLERANCE, hitTest, insideShape, toLocal, type HitTestOptions, type NodeSource } from "./hit-test.js";
export { flatten, insideFill, nearStroke, PATH_TYPES, roundedPolygon, shapeGeometry, starPoints, type FillPath, type Flattened, type ShapeGeometry } from "./geometry.js";
export { GpuCanvas } from "./gpu-canvas.js";
export { invertTransform } from "./paint.js";

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

export interface FontSource {
  /** The family name TEXT nodes ask for, e.g. "Inter". */
  family: string;
  /** A TrueType, OpenType, WOFF or WOFF2 file. */
  data: ArrayBuffer;
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
}

/** One line of laid-out text, in the TEXT node's own space. */
export interface TextLine {
  text: string;
  /** Left edge of the line. */
  left: number;
  /** Baseline, from the top of the node. */
  baseline: number;
}

export interface RendererOptions {
  /** Fonts for TEXT nodes. The first family is the fallback. Without fonts, text draws as a placeholder bar. */
  fonts?: FontSource[];
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

/** fontStyle names (Figma's, e.g. "Semi Bold Italic") to CSS weights. */
const WEIGHTS: [RegExp, number][] = [
  [/thin|hairline/, 100],
  [/extra ?light|ultra ?light/, 200],
  [/light/, 300],
  [/medium/, 500],
  [/semi ?bold|demi ?bold/, 600],
  [/extra ?bold|ultra ?bold/, 800],
  [/bold/, 700],
  [/black|heavy/, 900],
];

/** Node types with no outline of their own: effects that need one (background blur) skip them. */
const NO_OUTLINE = new Set(["GROUP", "PAGE", "TEXT"]);

interface ChildPicture {
  picture: SkPicture | null; // null when the child draws nothing (hidden)
  nodes: number;
}

interface ImageEntry {
  /** "failed": the file isn't an image CanvasKit can decode; "missing": the source has no such file. */
  state: "loading" | "ready" | "failed" | "missing";
  image: Image | null;
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

export class PageRenderer {
  private picture: SkPicture | null = null;
  private readonly children = new Map<NodeId, ChildPicture>();
  /** Top-level children to re-record; `all` after a page switch or font change. */
  private readonly stale = new Set<NodeId>();
  private all = true;
  private dirty = true;
  private nodeCount = 0;
  private readonly paint: Paint;
  private readonly layerPaint: Paint;
  private readonly effectPaint: Paint;
  /** Never changed: for layers that only need defaults. */
  private readonly plainPaint: Paint;
  private readonly kit: PaintKit;
  private readonly fonts: TypefaceFontProvider | null = null;
  private readonly fallbackFamily: string | null = null;
  /** Every registered family after the first, tried in order for glyphs the others lack (e.g. a Latin Extended subset). */
  private readonly moreFamilies: string[] = [];
  private readonly unsubscribe: () => void;
  private readonly imageSource: ImageSource | null;
  private readonly onImageReady: (() => void) | undefined;
  private readonly images = new Map<string, ImageEntry>();
  private readonly decoding = new Set<Promise<void>>();
  /** The top-level child being recorded, so images that aren't ready yet know whom to re-record. */
  private recordingTop: NodeId | null = null;
  /** True inside `drawSubtree`: images are decoded on the spot rather than after the recording. */
  private decodeNow = false;
  private disposed = false;

  constructor(
    private readonly ck: CanvasKit,
    private surface: Surface,
    private readonly doc: RenderSource,
    private pageId: NodeId,
    private readonly dpr = 1,
    options: RendererOptions = {},
  ) {
    this.paint = new ck.Paint();
    this.paint.setAntiAlias(true);
    this.layerPaint = new ck.Paint();
    this.effectPaint = new ck.Paint();
    this.effectPaint.setAntiAlias(true);
    this.plainPaint = new ck.Paint();
    this.kit = new PaintKit(ck);
    if (options.fonts?.length) {
      this.fonts = ck.TypefaceFontProvider.Make();
      for (const f of options.fonts) this.fonts.registerFont(f.data, f.family);
      this.fallbackFamily = options.fonts[0]?.family ?? null;
      this.moreFamilies = [...new Set(options.fonts.slice(1).map((f) => f.family))].filter((f) => f !== this.fallbackFamily);
    }
    this.imageSource = options.images ?? (typeof doc.image === "function" ? (hash: string) => doc.image?.(hash) : null);
    this.onImageReady = options.onImageReady;
    this.unsubscribe = doc.subscribe((change) => this.invalidate(change));
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
    if (!n || n.type !== "TEXT" || !n.characters || !this.fonts) return null;
    const text = n.characters;
    const paragraph = this.paragraph(n, { r: 0, g: 0, b: 0, a: 1 }, null);
    const lines = paragraph.getLineMetrics().map((m) => ({
      text: text.slice(m.startIndex, m.endExcludingWhitespaces).replace(/[\r\n\u2028\u2029]+$/, ""),
      left: m.left,
      baseline: m.baseline,
    }));
    paragraph.delete();
    return lines;
  }

  dispose(): void {
    this.disposed = true;
    this.unsubscribe();
    this.picture?.delete();
    for (const c of this.children.values()) c.picture?.delete();
    this.children.clear();
    for (const e of this.images.values()) e.image?.delete();
    this.images.clear();
    this.fonts?.delete();
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
        if (n) this.markFrom(n.id, n.parentId);
        // A move also changes what the old parent draws.
        if (o.key === "parentId" && typeof o.prev === "string") this.markFrom(o.id, o.prev);
      } else {
        // Created or deleted: its parent's top-level ancestor changes. Deleted
        // ancestors can't be walked, but the topmost deleted node's parent can.
        this.markFrom(o.node.id, o.node.parentId);
      }
    }
  }

  /** Mark the top-level ancestor of node `id`, whose parent is `parentId`. */
  private markFrom(id: NodeId, parentId: NodeId | null): void {
    let cur: NodeId | null = id;
    let parent = parentId;
    // Bounded by depth; stops at another page or at a deleted ancestor.
    while (parent !== null && parent !== this.pageId) {
      const p = this.doc.get(parent);
      if (!p) return;
      cur = p.id;
      parent = p.parentId;
    }
    if (parent === this.pageId && cur !== null) this.stale.add(cur);
  }

  /** Re-record stale top-level children, then the page picture. Returns how many children were recorded. */
  private record(): number {
    const top = this.doc.children(this.pageId);
    const live = new Set(top.map((n) => n.id));
    for (const [id, c] of this.children) {
      if (live.has(id)) continue;
      c.picture?.delete();
      this.children.delete(id);
    }
    let recorded = 0;
    for (const n of top) {
      if (!this.all && !this.stale.has(n.id) && this.children.has(n.id)) continue;
      this.children.get(n.id)?.picture?.delete();
      this.children.set(n.id, this.recordChild(n));
      recorded++;
    }
    this.stale.clear();
    this.all = false;

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
    const recorder = new this.ck.PictureRecorder();
    const canvas = recorder.beginRecording(EVERYWHERE(this.ck), true);
    this.nodeCount = 0; // drawNode counts into this; record() re-sums the page total after
    this.recordingTop = n.id;
    this.drawNode(canvas, n);
    this.recordingTop = null;
    const nodes = this.nodeCount;
    const picture = recorder.finishRecordingAsPicture();
    recorder.delete();
    return { picture, nodes };
  }

  private drawNode(canvas: Canvas, n: ReadonlyNode): void {
    if (!n.visible || n.opacity <= 0) return;
    this.nodeCount++;
    const saved = canvas.save();
    canvas.translate(n.x, n.y);
    if (n.rotation) canvas.rotate(n.rotation, 0, 0);

    const kids = this.doc.children(n.id);
    const fx = n.effects?.length ? nodeEffects(n.effects) : null;
    const geometry = shapeGeometry(n);
    // Leaf shapes (and clipping frames with a fill) cast shadows from their outline, drawn directly;
    // anything else (groups, text, frames without a fill) from what it draws, through a layer filter.
    const shadows = !!fx && (fx.drops.length > 0 || fx.inners.length > 0);
    const outlined = !NO_OUTLINE.has(n.type) && (kids.length === 0 || (CLIPPING.has(n.type) && n.fills.some((p) => p.visible)));
    const outline = (shadows && outlined) || fx?.backgroundBlur || this.alignedStroke(n, geometry) ? this.outline(n, geometry) : null;
    const direct = shadows && outlined && outline !== null;

    // Background blur reads what is already drawn, so it goes before this node's own layer.
    if (fx?.backgroundBlur && outline) this.drawBackgroundBlur(canvas, outline, fx.backgroundBlur);

    // Opacity, blend mode, layer blur and filtered shadows apply to the node and its children as one group, as in Figma.
    const filter = fx ? this.layerFilter(fx, !direct) : null;
    const blend = n.blendMode && n.blendMode !== "PASS_THROUGH" && (n.blendMode !== "NORMAL" || this.blendsInside(kids));
    if (n.opacity < 1 || blend || filter) {
      this.layerPaint.setAlphaf(n.opacity);
      this.kit.setBlend(this.layerPaint, n.blendMode);
      this.layerPaint.setImageFilter(filter);
      canvas.saveLayer(this.layerPaint);
      this.layerPaint.setImageFilter(null);
      this.layerPaint.setBlendMode(this.ck.BlendMode.SrcOver);
      filter?.delete();
    }

    const rect = this.ck.XYWHRect(0, 0, n.width, n.height);
    const silhouette = direct && outline ? this.silhouette(n, geometry, outline) : null;
    if (silhouette && fx) this.drawDropShadows(canvas, n, silhouette, fx.drops);
    if (n.type === "TEXT" && this.fonts) {
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
    outline?.path.delete();

    if (CLIPPING.has(n.type)) {
      if (n.cornerRadius > 0) {
        canvas.clipRRect(this.ck.RRectXY(rect, n.cornerRadius, n.cornerRadius), this.ck.ClipOp.Intersect, true);
      } else {
        canvas.clipRect(rect, this.ck.ClipOp.Intersect, true);
      }
    }
    for (const child of kids) this.drawNode(canvas, child);
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
    const entry = this.imageEntry(paint.imageHash);
    // Export draws once and can't wait: decode now if the bytes are at hand.
    if (entry.state === "loading" && this.decodeNow) {
      const bytes = this.lookupImage(paint.imageHash);
      if (bytes instanceof Uint8Array) this.decodeInto(entry, bytes);
    }
    if (entry.state === "loading") {
      if (this.recordingTop) entry.waiting.add(this.recordingTop);
      return undefined;
    }
    return entry.image ? this.kit.image(paint, entry.image, n.width, n.height) : null;
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
    // A missing image may have been added since (e.g. `Document.addImage` after the paint): look again, synchronously.
    if (entry?.state === "missing") {
      const again = this.lookupImage(hash);
      if (!(again instanceof Uint8Array)) return entry;
      this.images.delete(hash);
      entry = undefined;
    }
    if (entry) return entry;
    const e: ImageEntry = { state: "loading", image: null, waiting: new Set() };
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
      if (e.state === "loading") this.decodeInto(e, bytes);
      for (const id of e.waiting) this.stale.add(id);
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
   * The image filter for the node's layer: layer blur, plus (with `shadows`)
   * drop and inner shadows cast from the layer's own pixels, for nodes
   * without one outline of their own (groups, text, frames without a fill).
   */
  private layerFilter(fx: NodeEffects, shadows: boolean): ImageFilter | null {
    const ck = this.ck;
    const IF = ck.ImageFilter;
    const made: ImageFilter[] = [];
    const keep = (f: ImageFilter) => (made.push(f), f);
    let result: ImageFilter | null = null; // null: the layer itself
    if (shadows) {
      for (const d of fx.inners) {
        // The layer's outside as an opaque shape: alpha inverted.
        const inverted = keep(IF.MakeColorFilter(ck.ColorFilter.MakeMatrix(INVERT_ALPHA), null));
        const s = d.spread ?? 0;
        const grown = s > 0 ? keep(IF.MakeDilate(s, s, inverted)) : s < 0 ? keep(IF.MakeErode(-s, -s, inverted)) : inverted;
        const shadow = keep(IF.MakeDropShadowOnly(d.offset.x, d.offset.y, sigma(d.radius), sigma(d.radius), ck.Color4f(d.color.r, d.color.g, d.color.b, d.color.a), grown));
        result = keep(IF.MakeBlend(ck.BlendMode.SrcATop, result, shadow));
      }
      let under: ImageFilter | null = null;
      for (const d of fx.drops) {
        const s = d.spread ?? 0;
        const grown = s > 0 ? keep(IF.MakeDilate(s, s, null)) : s < 0 ? keep(IF.MakeErode(-s, -s, null)) : null;
        let shadow = keep(IF.MakeDropShadowOnly(d.offset.x, d.offset.y, sigma(d.radius), sigma(d.radius), ck.Color4f(d.color.r, d.color.g, d.color.b, d.color.a), grown));
        // Not behind the layer: only where the layer is transparent.
        if (!d.showShadowBehindNode) shadow = keep(IF.MakeBlend(ck.BlendMode.DstOut, shadow, null));
        under = under ? keep(IF.MakeBlend(ck.BlendMode.SrcOver, under, shadow)) : shadow;
      }
      if (under) result = keep(IF.MakeBlend(ck.BlendMode.SrcOver, under, result));
    }
    if (fx.layerBlur > 0) result = keep(IF.MakeBlur(sigma(fx.layerBlur), sigma(fx.layerBlur), ck.TileMode.Decal, result));
    // Every filter holds references to its inputs, so only the outermost handle is kept.
    for (const f of made) if (f !== result) f.delete();
    return result;
  }

  // ---- text ----

  /**
   * Left-aligned text wrapped at the node's width, drawn once per visible
   * fill. Text strokes (glyph outlines) come with the full text engine.
   */
  private drawText(canvas: Canvas, n: ReadonlyNode): void {
    if (!n.characters || !this.fonts) return;
    for (const fill of n.fills) {
      if (!fill.visible) continue;
      // A plain solid colour needs no paint; anything else (gradients, images, opacity, blending) draws with one.
      const plain = fill.type === "SOLID" && (fill.opacity ?? 1) === 1 && (!fill.blendMode || fill.blendMode === "NORMAL" || fill.blendMode === "PASS_THROUGH");
      if (!plain && !this.usePaint(n, fill, false)) continue;
      const color = fill.type === "SOLID" ? fill.color : { r: 0, g: 0, b: 0, a: 1 };
      const paragraph = this.paragraph(n, color, plain ? null : this.paint);
      canvas.drawParagraph(paragraph, 0, 0);
      paragraph.delete();
    }
  }

  /** A TEXT node laid out at its width, in `color`, or with `paint` (gradients, images, opacity, blending). The caller deletes it. */
  private paragraph(n: ReadonlyNode, color: DeepReadonly<Color>, paint: Paint | null): Paragraph {
    const fonts = this.fonts as TypefaceFontProvider;
    const fontSize = n.fontSize ?? 12;
    const style = (n.fontStyle ?? "Regular").toLowerCase();
    const families = n.fontFamily && n.fontFamily !== this.fallbackFamily ? [n.fontFamily] : [];
    if (this.fallbackFamily) families.push(this.fallbackFamily);
    families.push(...this.moreFamilies.filter((f) => !families.includes(f)));
    const textStyle = {
      color: this.ck.Color4f(color.r, color.g, color.b, color.a),
      fontFamilies: families,
      fontSize,
      fontStyle: {
        weight: this.weight(style),
        slant: /italic|oblique/.test(style) ? this.ck.FontSlant.Italic : this.ck.FontSlant.Upright,
      },
      // lineHeight is in pixels; leading is split above and below each line, as in Figma.
      ...(n.lineHeight ? { heightMultiplier: n.lineHeight / fontSize, halfLeading: true } : {}),
    };
    const builder = this.ck.ParagraphBuilder.MakeFromFontProvider(
      new this.ck.ParagraphStyle({ textAlign: this.ck.TextAlign.Left, textStyle }),
      fonts,
    );
    if (paint) {
      // The paint's shader is in the node's space, which is the paragraph's too (drawn at 0, 0).
      const background = new this.ck.Paint();
      background.setColor(this.ck.TRANSPARENT);
      builder.pushPaintStyle(new this.ck.TextStyle(textStyle), paint, background);
      builder.addText(n.characters ?? "");
      builder.pop();
      background.delete();
    } else {
      builder.addText(n.characters ?? "");
    }
    const paragraph = builder.build();
    paragraph.layout(Math.max(1, n.width));
    builder.delete();
    return paragraph;
  }

  private weight(style: string): FontWeight {
    const w = WEIGHTS.find(([re]) => re.test(style))?.[1] ?? 400;
    const W = this.ck.FontWeight;
    return ({ 100: W.Thin, 200: W.ExtraLight, 300: W.Light, 400: W.Normal, 500: W.Medium, 600: W.SemiBold, 700: W.Bold, 800: W.ExtraBold, 900: W.Black } as Record<number, FontWeight>)[w] ?? W.Normal;
  }
}

/** Colour matrix: RGB to 0, alpha to 1 − alpha (the outside of a layer, as an opaque shape). */
const INVERT_ALPHA = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 1];

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
