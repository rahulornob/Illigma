import { useEffect, useImperativeHandle, useRef, useState, type PointerEvent as ReactPointerEvent, type Ref } from "react";
import CanvasKitInit, { type CanvasKit } from "canvaskit-wasm";
import interUrl from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import interExtUrl from "@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2?url";
import wasmUrl from "canvaskit-wasm/bin/canvaskit.wasm?url";
import type { Document } from "@illigma/core";
import type { NodeId, NodeType } from "@illigma/format";
import { GpuCanvas, PageRenderer, type Camera, type FontSource } from "@illigma/renderer";
import { absoluteRect, frameAt } from "./geometry";

export type Tool = "move" | "frame" | "rectangle" | "ellipse";

/**
 * Canvas hit-testing: given a point in page (world) coordinates on the
 * current page, return the layer to select, or null for empty canvas.
 * `deep` is ⌘/Ctrl-click: the deepest layer under the pointer.
 */
export type HitTest = (x: number, y: number, opts: { deep: boolean }) => NodeId | null;

export interface CanvasHandle {
  zoomIn(): void;
  zoomOut(): void;
  zoomTo(zoom: number): void;
  fit(): void;
}

interface CanvasProps {
  doc: Document;
  pageId: NodeId;
  tool: Tool;
  selection: NodeId | null;
  hitTest?: HitTest | undefined;
  /** Viewing only: no drawing. */
  readOnly?: boolean | undefined;
  onSelect(id: NodeId | null): void;
  onCreated(id: NodeId): void;
  onZoom(zoom: number): void;
  handle: Ref<CanvasHandle>;
}

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 256;
const FIT_PADDING = 64;
const DRAG_THRESHOLD = 3;

const DRAW: Record<Exclude<Tool, "move">, { type: NodeType; label: string; fill: [number, number, number] }> = {
  frame: { type: "FRAME", label: "Frame", fill: [1, 1, 1] },
  rectangle: { type: "RECTANGLE", label: "Rectangle", fill: [0.85, 0.85, 0.85] },
  ellipse: { type: "ELLIPSE", label: "Ellipse", fill: [0.85, 0.85, 0.85] },
};

let canvasKit: Promise<CanvasKit> | undefined;
const loadCanvasKit = () => (canvasKit ??= CanvasKitInit({ locateFile: () => wasmUrl }));

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

type Gesture =
  | { kind: "pan"; lastX: number; lastY: number }
  | { kind: "press"; startX: number; startY: number; lastX: number; lastY: number }
  | { kind: "draw"; tool: Exclude<Tool, "move">; wx: number; wy: number; sx: number; sy: number };

export function Canvas(props: CanvasProps) {
  const { doc, pageId, selection, tool, handle } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorText, setErrorText] = useState("");
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);

  // Mutable state the event handlers and render loop share.
  const live = useRef({
    props,
    camera: { x: -40, y: -40, zoom: 1 } as Camera,
    renderer: null as PageRenderer | null,
    frame: 0,
    gesture: null as Gesture | null,
    draft: null as { x: number; y: number; width: number; height: number } | null,
    space: false,
    /** The pointer is over the canvas. */
    hover: false,
    fitted: false,
  });
  live.current.props = props;

  const size = () => {
    const el = canvasRef.current;
    return { w: el?.clientWidth ?? 1, h: el?.clientHeight ?? 1 };
  };

  const toWorld = (sx: number, sy: number) => {
    const { camera } = live.current;
    return { x: camera.x + sx / camera.zoom, y: camera.y + sy / camera.zoom };
  };

  const updateOverlay = () => {
    const { camera, props: p, draft } = live.current;
    const sel = selRef.current;
    const label = sizeRef.current;
    const r = p.selection ? absoluteRect(p.doc, p.selection) : null;
    const node = p.selection ? p.doc.get(p.selection) : undefined;
    const onPage = (() => {
      let cur = node;
      while (cur && cur.parentId) cur = p.doc.get(cur.parentId);
      return cur?.id === p.pageId;
    })();
    if (sel && label) {
      if (r && onPage) {
        const left = (r.x - camera.x) * camera.zoom;
        const top = (r.y - camera.y) * camera.zoom;
        const width = r.width * camera.zoom;
        const height = r.height * camera.zoom;
        sel.style.display = "block";
        sel.style.transform = `translate(${left}px, ${top}px)`;
        sel.style.width = `${width}px`;
        sel.style.height = `${height}px`;
        label.style.display = "block";
        label.style.transform = `translate(${left + width / 2}px, ${top + height + 8}px) translateX(-50%)`;
        label.textContent = `${round(r.width)} × ${round(r.height)}`;
      } else {
        sel.style.display = "none";
        label.style.display = "none";
      }
    }
    const d = draftRef.current;
    if (d) {
      if (draft) {
        d.style.display = "block";
        d.style.transform = `translate(${(draft.x - camera.x) * camera.zoom}px, ${(draft.y - camera.y) * camera.zoom}px)`;
        d.style.width = `${draft.width * camera.zoom}px`;
        d.style.height = `${draft.height * camera.zoom}px`;
        d.dataset.shape = live.current.gesture?.kind === "draw" ? live.current.gesture.tool : "";
      } else d.style.display = "none";
    }
  };

  const draw = () => {
    const l = live.current;
    l.frame = 0;
    l.renderer?.render(l.camera);
    updateOverlay();
  };

  const requestDraw = () => {
    if (!live.current.frame) live.current.frame = requestAnimationFrame(draw);
  };

  const setCamera = (camera: Camera) => {
    live.current.camera = camera;
    live.current.props.onZoom(camera.zoom);
    requestDraw();
  };

  const zoomAround = (zoom: number, sx: number, sy: number) => {
    const { camera } = live.current;
    const z = clampZoom(zoom);
    const wx = camera.x + sx / camera.zoom;
    const wy = camera.y + sy / camera.zoom;
    setCamera({ zoom: z, x: wx - sx / z, y: wy - sy / z });
  };

  const fit = (maxZoom = MAX_ZOOM) => {
    const { w, h } = size();
    const b = live.current.renderer?.bounds();
    if (!b || b.width <= 0 || b.height <= 0) {
      setCamera({ zoom: 1, x: -w / 2, y: -h / 2 });
      return;
    }
    const zoom = clampZoom(Math.min(maxZoom, (w - FIT_PADDING * 2) / b.width, (h - FIT_PADDING * 2) / b.height));
    setCamera({ zoom, x: b.x + b.width / 2 - w / (2 * zoom), y: b.y + b.height / 2 - h / (2 * zoom) });
  };

  useImperativeHandle(handle, () => ({
    zoomIn: () => {
      const { w, h } = size();
      zoomAround(live.current.camera.zoom * 2, w / 2, h / 2);
    },
    zoomOut: () => {
      const { w, h } = size();
      zoomAround(live.current.camera.zoom / 2, w / 2, h / 2);
    },
    zoomTo: (z: number) => {
      const { w, h } = size();
      zoomAround(z, w / 2, h / 2);
    },
    fit: () => fit(),
  }));

  // CanvasKit, the GPU surface and the page renderer. Rebuilt when the canvas resizes.
  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    let disposed = false;
    let ck: CanvasKit | null = null;
    let gpu: GpuCanvas | null = null;
    let fonts: FontSource[] = [];
    let dpr = window.devicePixelRatio || 1;
    let contextLost = false;

    const teardown = () => {
      // After a lost context the GPU objects may already be gone; freeing them must not stop the rebuild.
      try {
        live.current.renderer?.dispose();
      } catch {
        /* already gone */
      }
      live.current.renderer = null;
      try {
        gpu?.dispose();
      } catch {
        /* already gone */
      }
      gpu = null;
    };
    const fail = (e: unknown) => {
      setErrorText(e instanceof Error ? e.message : String(e));
      setStatus("error");
    };
    /** Start over with a new GPU surface and renderer (new pixel ratio, or a restored WebGL context). */
    const rebuild = () => {
      teardown();
      try {
        build();
      } catch (e) {
        fail(e);
      }
    };
    // One GPU context per canvas: a resize only swaps the surface, and the cached page pictures survive.
    const build = () => {
      if (!ck || disposed || contextLost || canvasEl.clientWidth === 0 || canvasEl.clientHeight === 0) return;
      if (gpu && live.current.renderer) {
        live.current.renderer.setSurface(gpu.resize());
        draw();
        return;
      }
      teardown();
      gpu = GpuCanvas.create(ck, canvasEl, dpr);
      live.current.renderer = new PageRenderer(ck, gpu.surface, live.current.props.doc, live.current.props.pageId, dpr, { fonts });
      if (!live.current.fitted) {
        live.current.fitted = true;
        fit(1);
      }
      draw();
    };

    let resizeFrame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        try {
          build();
        } catch (e) {
          fail(e);
        }
      });
    });

    // The GPU can drop the WebGL context (driver reset, too many contexts, sleep). Wait for it to come back, then rebuild.
    const onLost = (e: Event) => {
      e.preventDefault(); // lets the browser restore the context
      contextLost = true;
      cancelAnimationFrame(live.current.frame);
      live.current.frame = 0;
    };
    const onRestored = () => {
      contextLost = false;
      rebuild();
      setStatus((s) => (s === "error" ? s : "ready"));
    };
    canvasEl.addEventListener("webglcontextlost", onLost);
    canvasEl.addEventListener("webglcontextrestored", onRestored);

    // Moving the window to a screen with another pixel ratio (or browser zoom) needs a sharper or smaller surface.
    let dprQuery: MediaQueryList | null = null;
    const watchDpr = () => {
      dprQuery?.removeEventListener("change", onDpr);
      dprQuery = window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`) ?? null;
      dprQuery?.addEventListener("change", onDpr);
    };
    const onDpr = () => {
      watchDpr();
      const next = window.devicePixelRatio || 1;
      if (next === dpr) return;
      dpr = next;
      rebuild();
    };
    watchDpr();

    // The bundled Inter (no font CDN), Latin and Latin Extended. Without it, text layers fall back to placeholder bars.
    const font = (url: string, family: string) =>
      fetch(url)
        .then((r) => r.arrayBuffer())
        .then((data): FontSource[] => [{ family, data }])
        .catch((): FontSource[] => []);
    const loadInter = Promise.all([font(interUrl, "Inter"), font(interExtUrl, "Inter Latin Extended")]).then((sets) => sets.flat());

    Promise.all([loadCanvasKit(), loadInter])
      .then(([loaded, loadedFonts]) => {
        if (disposed) return;
        ck = loaded;
        fonts = loadedFonts;
        build();
        setStatus("ready");
        observer.observe(canvasEl);
      })
      .catch((e: unknown) => {
        if (disposed) return;
        setErrorText(e instanceof Error ? e.message : String(e));
        setStatus("error");
      });

    const unsubscribe = doc.subscribe(requestDraw);
    return () => {
      disposed = true;
      observer.disconnect();
      canvasEl.removeEventListener("webglcontextlost", onLost);
      canvasEl.removeEventListener("webglcontextrestored", onRestored);
      dprQuery?.removeEventListener("change", onDpr);
      cancelAnimationFrame(resizeFrame);
      cancelAnimationFrame(live.current.frame);
      live.current.frame = 0;
      unsubscribe();
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  // Page switches: show the new page, fitted.
  useEffect(() => {
    const r = live.current.renderer;
    if (!r) return;
    r.setPage(pageId);
    fit(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  useEffect(requestDraw, [selection]);

  // Wheel zoom (needs a non-passive listener to stop the browser zooming the page).
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const speed = e.deltaMode === 1 ? 0.05 : e.ctrlKey ? 0.01 : 0.0015;
      zoomAround(live.current.camera.zoom * Math.exp(-e.deltaY * speed), e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hold Space to pan with any tool, wherever focus is (except text fields).
  useEffect(() => {
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const isButton = (t: EventTarget | null) => t instanceof HTMLElement && t.closest("button") !== null;
    let swallowed = false;
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || typing(e.target)) return;
      // On a focused button, Space still presses the button for keyboard users, unless the pointer is
      // over the canvas (then it's a pan). Pressing on the canvas moves focus there, so the button isn't pressed.
      if (!isButton(e.target) || live.current.hover) {
        e.preventDefault();
        swallowed = true;
      }
      if (!live.current.space) {
        live.current.space = true;
        setSpaceHeld(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (swallowed) e.preventDefault();
      swallowed = false;
      live.current.space = false;
      setSpaceHeld(false);
    };
    const blur = () => {
      live.current.space = false;
      setSpaceHeld(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  const local = (e: ReactPointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (status !== "ready") return;
    e.currentTarget.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture(e.pointerId);
    const { sx, sy } = local(e);
    const l = live.current;
    if (e.button === 1 || l.space) {
      l.gesture = { kind: "pan", lastX: sx, lastY: sy };
      setPanning(true);
      return;
    }
    if (e.button !== 0) return;
    const w = toWorld(sx, sy);
    if (l.props.tool === "move" || l.props.readOnly) {
      const hit = l.props.hitTest?.(w.x, w.y, { deep: e.metaKey || e.ctrlKey });
      if (hit) {
        l.props.onSelect(hit);
        return;
      }
      l.gesture = { kind: "press", startX: sx, startY: sy, lastX: sx, lastY: sy };
      return;
    }
    l.gesture = { kind: "draw", tool: l.props.tool, wx: w.x, wy: w.y, sx, sy };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const l = live.current;
    const g = l.gesture;
    if (!g) return;
    const { sx, sy } = local(e);
    if (g.kind === "press" && Math.hypot(sx - g.startX, sy - g.startY) > DRAG_THRESHOLD) {
      l.gesture = { kind: "pan", lastX: g.lastX, lastY: g.lastY };
      setPanning(true);
    }
    const cur = l.gesture;
    if (cur?.kind === "pan") {
      const { camera } = l;
      setCamera({ ...camera, x: camera.x - (sx - cur.lastX) / camera.zoom, y: camera.y - (sy - cur.lastY) / camera.zoom });
      cur.lastX = sx;
      cur.lastY = sy;
    } else if (cur?.kind === "draw") {
      const w = toWorld(sx, sy);
      let dx = w.x - cur.wx;
      let dy = w.y - cur.wy;
      if (e.shiftKey) {
        const s = Math.max(Math.abs(dx), Math.abs(dy));
        dx = Math.sign(dx || 1) * s;
        dy = Math.sign(dy || 1) * s;
      }
      l.draft = { x: Math.min(cur.wx, cur.wx + dx), y: Math.min(cur.wy, cur.wy + dy), width: Math.abs(dx), height: Math.abs(dy) };
      requestDraw();
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const l = live.current;
    const g = l.gesture;
    l.gesture = null;
    setPanning(false);
    if (!g) return;
    if (g.kind === "press") {
      // A click on empty canvas (or anywhere, until hit-testing lands) clears the selection.
      l.props.onSelect(null);
      return;
    }
    if (g.kind !== "draw") return;
    const { sx, sy } = local(e);
    const clicked = Math.hypot(sx - g.sx, sy - g.sy) <= DRAG_THRESHOLD;
    const rect = clicked || !l.draft ? { x: g.wx - 50, y: g.wy - 50, width: 100, height: 100 } : l.draft;
    l.draft = null;
    const spec = DRAW[g.tool];
    const { doc: d, pageId: page } = l.props;
    const parent = frameAt(d, page, g.wx, g.wy) ?? page;
    const origin = parent === page ? { x: 0, y: 0 } : (absoluteRect(d, parent) ?? { x: 0, y: 0 });
    const count = d.subtree(page).filter((n) => n.type === spec.type).length + 1;
    const [r, gr, b] = spec.fill;
    const id = d.transact(`Draw ${spec.label.toLowerCase()}`, (tx) =>
      tx.create(spec.type, parent, {
        name: `${spec.label} ${count}`,
        x: Math.round(rect.x - origin.x),
        y: Math.round(rect.y - origin.y),
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
        fills: [{ type: "SOLID", visible: true, color: { r, g: gr, b, a: 1 } }],
      }),
    );
    l.props.onCreated(id);
    requestDraw();
  };

  const cursor = spaceHeld || panning ? (panning ? "grabbing" : "grab") : tool === "move" || props.readOnly ? "default" : "crosshair";

  return (
    <div className="canvas-host" ref={hostRef}>
      <canvas
        ref={canvasRef}
        className="canvas"
        style={{ cursor }}
        tabIndex={0}
        role="application"
        aria-roledescription="design canvas"
        aria-label="Canvas. Drag to pan, scroll to zoom. Pick a tool in the dock and drag to draw."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerEnter={() => (live.current.hover = true)}
        onPointerLeave={() => (live.current.hover = false)}
        onPointerCancel={() => {
          live.current.gesture = null;
          live.current.draft = null;
          setPanning(false);
          requestDraw();
        }}
      />
      <div className="canvas-overlay" aria-hidden="true">
        <div ref={selRef} className="selection-box">
          <span className="handle nw" />
          <span className="handle ne" />
          <span className="handle sw" />
          <span className="handle se" />
        </div>
        <div ref={sizeRef} className="size-pill" />
        <div ref={draftRef} className="draft-box" />
      </div>
      {status !== "ready" && (
        <div className="canvas-status" role={status === "error" ? "alert" : "status"}>
          {status === "loading" ? "Loading canvas…" : `Couldn't start the canvas. ${errorText}`}
        </div>
      )}
    </div>
  );
}

function round(v: number): string {
  return String(Math.round(v * 100) / 100);
}
