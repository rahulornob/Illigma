import type { CanvasKit, GrDirectContext, Surface } from "canvaskit-wasm";

/** GPU resource cache budget: room for a couple of very large images with their mipmaps. */
export const GPU_CACHE_BYTES = 768 * 1024 * 1024;

/**
 * One drawing surface per `<canvas>`, resizable without leaking.
 *
 * CanvasKit's MakeWebGLCanvasSurface creates a new WebGL context and
 * GrDirectContext on every call, and `surface.delete()` frees neither. So the
 * GPU context is made once here, and a resize only swaps the surface.
 */
export class GpuCanvas {
  private constructor(
    private readonly ck: CanvasKit,
    private readonly canvas: HTMLCanvasElement,
    private readonly dpr: number,
    /** 0 when WebGL is unavailable and the surface is CPU-backed. */
    private readonly glHandle: number,
    private readonly grContext: GrDirectContext | null,
    private current: Surface,
  ) {}

  /** Size `canvas` to its CSS box × `dpr` and make a surface for it, on the GPU when possible. */
  static create(ck: CanvasKit, canvas: HTMLCanvasElement, dpr = globalThis.devicePixelRatio || 1): GpuCanvas {
    GpuCanvas.fit(canvas, dpr);
    // GetWebGLContext returns 0 (or a negative error) rather than throwing when WebGL is off.
    const handle = ck.GetWebGLContext(canvas);
    if (handle > 0) {
      const gr = ck.MakeWebGLContext(handle);
      const surface = gr && ck.MakeOnScreenGLSurface(gr, canvas.width, canvas.height, ck.ColorSpace.SRGB);
      if (gr && surface) {
        // Skia's GPU cache keeps uploaded images, their mipmaps and layer textures between frames. A
        // budget smaller than one big image (8000 × 8000 with mipmaps is 340 MB) makes every frame
        // upload or rebuild it again. The cache only grows to what is drawn.
        if (gr.getResourceCacheLimitBytes() < GPU_CACHE_BYTES) gr.setResourceCacheLimitBytes(GPU_CACHE_BYTES);
        return new GpuCanvas(ck, canvas, dpr, handle, gr, surface);
      }
      gr?.delete();
      ck.deleteContext(handle);
      // The canvas is now bound to WebGL and can't give a 2D context for the CPU fallback.
      throw new Error("Couldn't create a GPU drawing surface on this canvas.");
    }
    const surface = ck.MakeSWCanvasSurface(canvas);
    if (!surface) throw new Error("Couldn't create a drawing surface: neither WebGL nor a 2D canvas is available.");
    return new GpuCanvas(ck, canvas, dpr, 0, null, surface);
  }

  get surface(): Surface {
    return this.current;
  }

  /** Whether drawing runs on the GPU (false means the CPU fallback). */
  get gpu(): boolean {
    return this.grContext !== null;
  }

  /** Re-fit to the canvas's CSS box after a layout change. Returns the new surface; the old one is deleted. */
  resize(): Surface {
    GpuCanvas.fit(this.canvas, this.dpr);
    this.current.delete();
    const next = this.grContext
      ? this.ck.MakeOnScreenGLSurface(this.grContext, this.canvas.width, this.canvas.height, this.ck.ColorSpace.SRGB)
      : this.ck.MakeSWCanvasSurface(this.canvas);
    if (!next) throw new Error("Couldn't recreate the drawing surface after a resize.");
    this.current = next;
    return next;
  }

  dispose(): void {
    this.current.delete();
    if (this.grContext) {
      this.grContext.releaseResourcesAndAbandonContext();
      this.grContext.delete();
      this.ck.deleteContext(this.glHandle);
    }
  }

  private static fit(canvas: HTMLCanvasElement, dpr: number): void {
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
  }
}
