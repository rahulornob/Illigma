import CanvasKitInit from "canvaskit-wasm";
import wasmUrl from "canvaskit-wasm/bin/canvaskit.wasm?url";
import { makeSurface, PageRenderer, type Camera } from "@illigma/renderer";
import { buildScene } from "./scene";

export interface BenchResult {
  layers: number;
  frames: number;
  medianFps: number;
  p95Ms: number;
  withinBudget: number;
  drawMsAvg: number;
  recordMs: number;
  passed: boolean;
  renderer: string;
}

declare global {
  interface Window {
    __bench?: BenchResult;
  }
}

const BUDGET_MS = 1000 / 60;
const RUN_MS = 6000;
const WARMUP_FRAMES = 30;
const $ = (id: string) => document.getElementById(id) as HTMLElement;

async function main() {
  const ck = await CanvasKitInit({ locateFile: () => wasmUrl });
  const canvasEl = $("c") as HTMLCanvasElement;
  const dpr = window.devicePixelRatio || 1;
  let surface = makeSurface(ck, canvasEl, dpr);
  const gl = (canvasEl.getContext("webgl2") as WebGL2RenderingContext | null);
  const dbg = gl?.getExtension("WEBGL_debug_renderer_info");
  const gpu = gl && dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "unknown GPU";

  const { doc, page, layers } = buildScene();
  let renderer = new PageRenderer(ck, surface, doc, page, dpr);
  $("layers").textContent = layers.toLocaleString();

  const b = renderer.bounds() ?? { x: 0, y: 0, width: 1000, height: 1000 };
  const fit = (): Camera => {
    const zoom = Math.min(canvasEl.clientWidth / b.width, canvasEl.clientHeight / b.height) * 0.9;
    return { zoom, x: b.x + b.width / 2 - canvasEl.clientWidth / (2 * zoom), y: b.y + b.height / 2 - canvasEl.clientHeight / (2 * zoom) };
  };
  let camera = fit();
  let recordMs = renderer.render(camera).recordMs;
  $("record").textContent = `${recordMs.toFixed(1)} ms (once)`;

  // Scripted pan and zoom: from the whole page down to a single screen and back, sweeping across.
  const cameraAt = (t: number): Camera => {
    const f = fit();
    const phase = (t / RUN_MS) * Math.PI * 2;
    const zoom = f.zoom * Math.exp(Math.log(1.6 / f.zoom) * (0.5 - 0.5 * Math.cos(phase)));
    const cx = b.x + b.width * (0.5 + 0.4 * Math.sin(phase * 1.5));
    const cy = b.y + b.height * (0.5 + 0.4 * Math.sin(phase));
    return { zoom, x: cx - canvasEl.clientWidth / (2 * zoom), y: cy - canvasEl.clientHeight / (2 * zoom) };
  };

  let running = false;
  const run = () =>
    new Promise<BenchResult>((resolve) => {
      running = true;
      ($("run") as HTMLButtonElement).disabled = true;
      $("verdict").className = "";
      $("verdict").textContent = "Measuring…";
      const deltas: number[] = [];
      const draws: number[] = [];
      let start = 0;
      let last = 0;
      let n = 0;
      const frame = (now: number) => {
        if (!start) start = now;
        const t = now - start;
        if (n > WARMUP_FRAMES && last) deltas.push(now - last);
        last = now;
        n++;
        const stats = renderer.render(cameraAt(t));
        if (n > WARMUP_FRAMES) draws.push(stats.drawMs);
        if (t < RUN_MS) requestAnimationFrame(frame);
        else resolve(summarize(deltas, draws));
      };
      requestAnimationFrame(frame);
    }).then((r) => {
      running = false;
      camera = cameraAt(RUN_MS);
      show(r);
      return r;
    });

  const summarize = (deltas: number[], draws: number[]): BenchResult => {
    const sorted = [...deltas].sort((a, z) => a - z);
    const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
    // A frame counts as within budget if it arrived on the next 60 Hz vsync (allowing 10% jitter).
    const within = deltas.filter((d) => d <= BUDGET_MS * 1.1).length / Math.max(1, deltas.length);
    const result: BenchResult = {
      layers,
      frames: deltas.length,
      medianFps: 1000 / Math.max(0.001, pct(0.5)),
      p95Ms: pct(0.95),
      withinBudget: within,
      drawMsAvg: draws.reduce((a, z) => a + z, 0) / Math.max(1, draws.length),
      recordMs,
      passed: within >= 0.95,
      renderer: gpu,
    };
    window.__bench = result;
    return result;
  };

  const show = (r: BenchResult) => {
    $("frames").textContent = r.frames.toLocaleString();
    $("fps").textContent = `${r.medianFps.toFixed(0)} fps`;
    $("p95").textContent = `${r.p95Ms.toFixed(1)} ms`;
    $("within").textContent = `${(r.withinBudget * 100).toFixed(0)}%`;
    $("draw").textContent = `${r.drawMsAvg.toFixed(2)} ms`;
    $("verdict").className = r.passed ? "ok" : "bad";
    $("verdict").textContent = r.passed ? "Gate met: 60 fps with 10,000 layers" : "Below the 60 fps gate";
    $("verdict").title = r.renderer;
    ($("run") as HTMLButtonElement).disabled = false;
  };

  // Interactive pan and zoom after the run.
  let drag: { x: number; y: number } | null = null;
  canvasEl.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY };
    canvasEl.setPointerCapture(e.pointerId);
  });
  canvasEl.addEventListener("pointermove", (e) => {
    if (!drag || running) return;
    camera = { ...camera, x: camera.x - (e.clientX - drag.x) / camera.zoom, y: camera.y - (e.clientY - drag.y) / camera.zoom };
    drag = { x: e.clientX, y: e.clientY };
    renderer.render(camera);
  });
  canvasEl.addEventListener("pointerup", () => (drag = null));
  canvasEl.addEventListener(
    "wheel",
    (e) => {
      if (running) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0015);
      const zoom = Math.min(64, Math.max(0.02, camera.zoom * factor));
      const wx = camera.x + e.clientX / camera.zoom;
      const wy = camera.y + e.clientY / camera.zoom;
      camera = { zoom, x: wx - e.clientX / zoom, y: wy - e.clientY / zoom };
      renderer.render(camera);
    },
    { passive: false },
  );
  window.addEventListener("resize", () => {
    renderer.dispose();
    surface.delete();
    surface = makeSurface(ck, canvasEl, dpr);
    renderer = new PageRenderer(ck, surface, doc, page, dpr);
    renderer.render(camera);
  });
  $("run").addEventListener("click", () => void run());

  await run();
}

main().catch((err: unknown) => {
  $("verdict").className = "bad";
  $("verdict").textContent = err instanceof Error ? err.message : "The benchmark couldn't start.";
});
