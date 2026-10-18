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

import type { Change, DeepReadonly, Document, ReadonlyNode } from "@illigma/core";
import { PATH_CLOSE, PATH_CUBIC, PATH_LINE, PATH_MOVE, type NodeId, type Paint as FilePaint } from "@illigma/format";
import type { Canvas, CanvasKit, FontWeight, Paint, Path, SkPicture, Surface, TypefaceFontProvider } from "canvaskit-wasm";
import { shapeGeometry, type ShapeGeometry } from "./geometry.js";
import { CLIPPING, hitTest } from "./hit-test.js";

export { DEFAULT_HIT_TOLERANCE, hitTest, insideShape, toLocal, type HitTestOptions, type NodeSource } from "./hit-test.js";
export { flatten, insideFill, nearStroke, PATH_TYPES, roundedPolygon, shapeGeometry, starPoints, type FillPath, type Flattened, type ShapeGeometry } from "./geometry.js";
export { GpuCanvas } from "./gpu-canvas.js";

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

export interface RendererOptions {
  /** Fonts for TEXT nodes. The first family is the fallback. Without fonts, text draws as a placeholder bar. */
  fonts?: FontSource[];
}

const CANVAS_BG = [0.118, 0.118, 0.125, 1] as const; // matches the editor's canvas token in Dark

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

interface ChildPicture {
  picture: SkPicture | null; // null when the child draws nothing (hidden)
  nodes: number;
  /** Set when its children are recorded in chunks (more than CHUNK_THRESHOLD of them); `picture` replays them. */
  chunks?: Chunk[];
  /** Child id → index of the chunk that draws it. */
  chunkOf?: Map<NodeId, number>;
}

/** A run of consecutive children of a top-level node, recorded in that node's own space. */
interface Chunk {
  picture: SkPicture | null;
  nodes: number;
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
  private readonly fonts: TypefaceFontProvider | null = null;
  private readonly fallbackFamily: string | null = null;
  /** Every registered family after the first, tried in order for glyphs the others lack (e.g. a Latin Extended subset). */
  private readonly moreFamilies: string[] = [];
  private readonly unsubscribe: () => void;

  constructor(
    private readonly ck: CanvasKit,
    private surface: Surface,
    private readonly doc: Document,
    private pageId: NodeId,
    private readonly dpr = 1,
    options: RendererOptions = {},
  ) {
    this.paint = new ck.Paint();
    this.paint.setAntiAlias(true);
    this.layerPaint = new ck.Paint();
    if (options.fonts?.length) {
      this.fonts = ck.TypefaceFontProvider.Make();
      for (const f of options.fonts) this.fonts.registerFont(f.data, f.family);
      this.fallbackFamily = options.fonts[0]?.family ?? null;
      this.moreFamilies = [...new Set(options.fonts.slice(1).map((f) => f.family))].filter((f) => f !== this.fallbackFamily);
    }
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

  dispose(): void {
    this.unsubscribe();
    this.picture?.delete();
    for (const c of this.children.values()) dropChild(c);
    this.children.clear();
    this.fonts?.delete();
    this.paint.delete();
    this.layerPaint.delete();
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
    const top = this.doc.children(this.pageId);
    const live = new Set(top.map((n) => n.id));
    for (const [id, c] of this.children) {
      if (live.has(id)) continue;
      dropChild(c);
      this.children.delete(id);
    }
    let recorded = 0;
    for (const n of top) {
      const stale = this.stale.get(n.id);
      const cached = this.children.get(n.id);
      if (!this.all && stale === undefined && cached) continue;
      recorded++;
      if (!this.all && stale && cached?.chunks && n.visible && n.opacity > 0) {
        this.rerecordChunks(n, cached, stale);
        continue;
      }
      if (cached) dropChild(cached);
      this.children.set(n.id, this.recordChild(n));
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
    this.drawNode(canvas, n);
    const nodes = this.nodeCount;
    const picture = recorder.finishRecordingAsPicture();
    recorder.delete();
    return { picture, nodes };
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
    for (const k of nodes) this.drawNode(canvas, k);
    const chunk = { picture: recorder.finishRecordingAsPicture(), nodes: this.nodeCount };
    recorder.delete();
    return chunk;
  }

  /** Record chunked top-level node `n` itself, replaying its chunks for its children, into `c`. */
  private compose(n: ReadonlyNode, c: ChildPicture): ChildPicture {
    const recorder = new this.ck.PictureRecorder();
    const canvas = recorder.beginRecording(EVERYWHERE(this.ck), true);
    this.nodeCount = 0;
    let nodes = 0;
    this.drawNode(canvas, n, (inner) => {
      for (const chunk of c.chunks ?? []) {
        if (chunk.picture) inner.drawPicture(chunk.picture);
        nodes += chunk.nodes;
      }
    });
    c.picture = recorder.finishRecordingAsPicture();
    c.nodes = this.nodeCount + nodes;
    recorder.delete();
    return c;
  }

  /** Draw `n` and its subtree; `children`, if given, draws its children instead (in its space, inside its clip). */
  private drawNode(canvas: Canvas, n: ReadonlyNode, children?: (canvas: Canvas) => void): void {
    if (!n.visible || n.opacity <= 0) return;
    this.nodeCount++;
    const saved = canvas.save();
    canvas.translate(n.x, n.y);
    if (n.rotation) canvas.rotate(n.rotation, 0, 0);
    // Opacity applies to the node and its children as one group, as in Figma,
    // so it needs a layer rather than a multiplied paint alpha.
    if (n.opacity < 1) {
      this.layerPaint.setAlphaf(n.opacity);
      canvas.saveLayer(this.layerPaint);
    }

    const rect = this.ck.XYWHRect(0, 0, n.width, n.height);
    const geometry = shapeGeometry(n);
    if (n.type === "TEXT" && this.fonts) {
      this.drawText(canvas, n);
    } else if (geometry) {
      this.drawGeometry(canvas, n, geometry);
    } else {
      for (const fill of n.fills) this.drawShape(canvas, n, rect, fill, false);
      for (const stroke of n.strokes) this.drawShape(canvas, n, rect, stroke, true);
    }

    if (CLIPPING.has(n.type)) {
      if (n.cornerRadius > 0) {
        canvas.clipRRect(this.ck.RRectXY(rect, n.cornerRadius, n.cornerRadius), this.ck.ClipOp.Intersect, true);
      } else {
        canvas.clipRect(rect, this.ck.ClipOp.Intersect, true);
      }
    }
    if (children) children(canvas);
    else for (const child of this.doc.children(n.id)) this.drawNode(canvas, child);
    canvas.restoreToCount(saved);
  }

  /** Sets the shared paint for one fill or stroke; false when it draws nothing. */
  private usePaint(n: ReadonlyNode, paint: DeepReadonly<FilePaint>, stroke: boolean): boolean {
    // A 0-weight stroke draws nothing (Skia would draw a hairline).
    if (!paint.visible || (stroke && !(n.strokeWeight > 0))) return false;
    const { r, g, b, a } = paint.color;
    const ck = this.ck;
    this.paint.setColor(ck.Color4f(r, g, b, a));
    this.paint.setStyle(stroke ? ck.PaintStyle.Stroke : ck.PaintStyle.Fill);
    if (stroke) {
      this.paint.setStrokeWidth(n.strokeWeight);
      this.paint.setStrokeCap(n.strokeCap === "ROUND" ? ck.StrokeCap.Round : n.strokeCap === "SQUARE" ? ck.StrokeCap.Square : ck.StrokeCap.Butt);
      this.paint.setStrokeJoin(n.strokeJoin === "ROUND" ? ck.StrokeJoin.Round : n.strokeJoin === "BEVEL" ? ck.StrokeJoin.Bevel : ck.StrokeJoin.Miter);
    }
    return true;
  }

  /** Vectors, stars, polygons and lines: each fill over every region (with its winding rule), then each stroke. */
  private drawGeometry(canvas: Canvas, n: ReadonlyNode, geo: ShapeGeometry): void {
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
    if (visibleStrokes && geo.stroke.length) {
      const path = this.toPath(geo.stroke, false);
      if (path) {
        for (const stroke of n.strokes) if (this.usePaint(n, stroke, true)) canvas.drawPath(path, this.paint);
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

  private drawShape(canvas: Canvas, n: ReadonlyNode, rect: Float32Array, paint: DeepReadonly<FilePaint>, stroke: boolean): void {
    if (!this.usePaint(n, paint, stroke)) return;
    if (n.type === "ELLIPSE") canvas.drawOval(rect, this.paint);
    else if (n.type === "TEXT") canvas.drawRect(this.ck.XYWHRect(0, n.height * 0.3, n.width, n.height * 0.4), this.paint); // placeholder until fonts are loaded
    else if (n.cornerRadius > 0) canvas.drawRRect(this.ck.RRectXY(rect, n.cornerRadius, n.cornerRadius), this.paint);
    else canvas.drawRect(rect, this.paint);
  }

  /**
   * Left-aligned text wrapped at the node's width, coloured by its first
   * fill. Text strokes (glyph outlines) come with the full text engine.
   */
  private drawText(canvas: Canvas, n: ReadonlyNode): void {
    const fill = n.fills[0];
    if (!fill?.visible || !n.characters || !this.fonts) return;
    const { r, g, b, a } = fill.color;
    const fontSize = n.fontSize ?? 12;
    const style = (n.fontStyle ?? "Regular").toLowerCase();
    const families = n.fontFamily && n.fontFamily !== this.fallbackFamily ? [n.fontFamily] : [];
    if (this.fallbackFamily) families.push(this.fallbackFamily);
    families.push(...this.moreFamilies.filter((f) => !families.includes(f)));
    const builder = this.ck.ParagraphBuilder.MakeFromFontProvider(
      new this.ck.ParagraphStyle({
        textAlign: this.ck.TextAlign.Left,
        textStyle: {
          color: this.ck.Color4f(r, g, b, a),
          fontFamilies: families,
          fontSize,
          fontStyle: {
            weight: this.weight(style),
            slant: /italic|oblique/.test(style) ? this.ck.FontSlant.Italic : this.ck.FontSlant.Upright,
          },
          // lineHeight is in pixels; leading is split above and below each line, as in Figma.
          ...(n.lineHeight ? { heightMultiplier: n.lineHeight / fontSize, halfLeading: true } : {}),
        },
      }),
      this.fonts,
    );
    builder.addText(n.characters);
    const paragraph = builder.build();
    paragraph.layout(Math.max(1, n.width));
    canvas.drawParagraph(paragraph, 0, 0);
    paragraph.delete();
    builder.delete();
  }

  private weight(style: string): FontWeight {
    const w = WEIGHTS.find(([re]) => re.test(style))?.[1] ?? 400;
    const W = this.ck.FontWeight;
    return ({ 100: W.Thin, 200: W.ExtraLight, 300: W.Light, 400: W.Normal, 500: W.Medium, 600: W.SemiBold, 700: W.Bold, 800: W.ExtraBold, 900: W.Black } as Record<number, FontWeight>)[w] ?? W.Normal;
  }
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
