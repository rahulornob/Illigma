/**
 * Phase 0 renderer spike: draws one page of a document with CanvasKit
 * (Skia compiled to WebAssembly) on WebGL2.
 *
 * The page is recorded once into an SkPicture; each frame only replays that
 * picture under the camera transform. Recording happens again only when the
 * document changes. Tiles, level of detail, text and hit-testing come later.
 */

import type { Document } from "@illigma/core";
import type { Node, NodeId, Paint as FilePaint } from "@illigma/format";
import type { Canvas, CanvasKit, Paint, SkPicture, Surface } from "canvaskit-wasm";

/** Screen point = (world point − camera.xy) × camera.zoom, in CSS pixels. */
export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface FrameStats {
  /** Milliseconds spent recording the page picture this frame (0 when cached). */
  recordMs: number;
  /** Milliseconds spent issuing the draw and flushing to the GPU. */
  drawMs: number;
  /** Nodes drawn in the current recording. */
  nodes: number;
}

const CLIPPING: ReadonlySet<Node["type"]> = new Set(["FRAME", "COMPONENT", "INSTANCE"]);
const CANVAS_BG = [0.118, 0.118, 0.125, 1] as const; // matches the editor's canvas token in Dark

export class PageRenderer {
  private picture: SkPicture | null = null;
  private dirty = true;
  private nodeCount = 0;
  private readonly paint: Paint;
  private readonly unsubscribe: () => void;

  constructor(
    private readonly ck: CanvasKit,
    private readonly surface: Surface,
    private readonly doc: Document,
    private pageId: NodeId,
    private readonly dpr = 1,
  ) {
    this.paint = new ck.Paint();
    this.paint.setAntiAlias(true);
    this.unsubscribe = doc.subscribe(() => {
      this.dirty = true;
    });
  }

  setPage(pageId: NodeId): void {
    this.pageId = pageId;
    this.dirty = true;
  }

  /** Draw one frame. */
  render(camera: Camera): FrameStats {
    let recordMs = 0;
    if (this.dirty || !this.picture) {
      const t = performance.now();
      this.record();
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
    return { recordMs, drawMs: performance.now() - t, nodes: this.nodeCount };
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
    this.paint.delete();
  }

  private record(): void {
    const recorder = new this.ck.PictureRecorder();
    const b = this.bounds() ?? { x: 0, y: 0, width: 1, height: 1 };
    const canvas = recorder.beginRecording(this.ck.XYWHRect(b.x - 1, b.y - 1, b.width + 2, b.height + 2));
    this.nodeCount = 0;
    for (const child of this.doc.children(this.pageId)) this.drawNode(canvas, child);
    this.picture?.delete();
    this.picture = recorder.finishRecordingAsPicture();
    recorder.delete();
    this.dirty = false;
  }

  private drawNode(canvas: Canvas, n: Readonly<Node>): void {
    if (!n.visible || n.opacity <= 0) return;
    this.nodeCount++;
    canvas.save();
    canvas.translate(n.x, n.y);
    if (n.rotation) canvas.rotate(n.rotation, 0, 0);

    const rect = this.ck.XYWHRect(0, 0, n.width, n.height);
    for (const fill of n.fills) this.drawShape(canvas, n, rect, fill, n.opacity, false);
    for (const stroke of n.strokes) this.drawShape(canvas, n, rect, stroke, n.opacity, true);

    if (CLIPPING.has(n.type)) {
      if (n.cornerRadius > 0) {
        canvas.clipRRect(this.ck.RRectXY(rect, n.cornerRadius, n.cornerRadius), this.ck.ClipOp.Intersect, true);
      } else {
        canvas.clipRect(rect, this.ck.ClipOp.Intersect, true);
      }
    }
    for (const child of this.doc.children(n.id)) this.drawNode(canvas, child);
    canvas.restore();
  }

  private drawShape(canvas: Canvas, n: Readonly<Node>, rect: Float32Array, paint: FilePaint, opacity: number, stroke: boolean): void {
    if (!paint.visible) return;
    const { r, g, b, a } = paint.color;
    this.paint.setColor(this.ck.Color4f(r, g, b, a * opacity));
    this.paint.setStyle(stroke ? this.ck.PaintStyle.Stroke : this.ck.PaintStyle.Fill);
    this.paint.setStrokeWidth(n.strokeWeight);
    if (n.type === "ELLIPSE") canvas.drawOval(rect, this.paint);
    else if (n.type === "TEXT") canvas.drawRect(this.ck.XYWHRect(0, n.height * 0.3, n.width, n.height * 0.4), this.paint); // text arrives in Phase 1
    else if (n.cornerRadius > 0) canvas.drawRRect(this.ck.RRectXY(rect, n.cornerRadius, n.cornerRadius), this.paint);
    else canvas.drawRect(rect, this.paint);
  }
}

/** Make a GPU surface for `canvas`, sized to its CSS box × devicePixelRatio. */
export function makeSurface(ck: CanvasKit, canvas: HTMLCanvasElement, dpr = globalThis.devicePixelRatio || 1): Surface {
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  const surface = ck.MakeWebGLCanvasSurface(canvas) ?? ck.MakeSWCanvasSurface(canvas);
  if (!surface) throw new Error("Couldn't create a drawing surface: WebGL2 is not available.");
  return surface;
}
