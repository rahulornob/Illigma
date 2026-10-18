import { useEffect, useImperativeHandle, useRef, useState, type PointerEvent as ReactPointerEvent, type Ref } from "react";
import CanvasKitInit, { type CanvasKit } from "canvaskit-wasm";
import interUrl from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import interExtUrl from "@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2?url";
import wasmUrl from "canvaskit-wasm/bin/canvaskit.wasm?url";
import type { Document, LiveEdit } from "@illigma/core";
import type { NodeId, NodeType } from "@illigma/format";
import { GpuCanvas, PageRenderer, type Camera, type FontSource } from "@illigma/renderer";
import { movable, moveBy, resizeBy, selectionFrame, snapDelta, snapshot, startBounds, type SelectionFrame, type Start } from "./edit";
import {
  absoluteRect,
  boundsOf,
  constrainToAxis,
  frameAt,
  fromSpace,
  handleAt,
  handleCursor,
  marqueeHits,
  placementOf,
  rectFromPoints,
  SMALL_SELECTION,
  toSpace,
  worldBounds,
  worldCorners,
  type Handle,
  type Rect,
} from "./geometry";

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
  selection: readonly NodeId[];
  hitTest?: HitTest | undefined;
  /** Viewing only: no drawing, moving or resizing. Selecting still works. */
  readOnly?: boolean | undefined;
  onSelect(ids: NodeId[]): void;
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

/** Top-level containers: dragging on their empty area draws a marquee over their children, as in Figma. */
const CONTAINERS = new Set<NodeType>(["FRAME", "SECTION", "COMPONENT"]);
/** Grab distance around a handle or an edge, in screen pixels. */
const HANDLE_GRAB = 6;
const HANDLE_NAMES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

const sameIds = (a: readonly NodeId[], b: readonly NodeId[]) => a.length === b.length && a.every((id, i) => id === b[i]);
const plural = (n: number, verb: string) => (n === 1 ? `${verb} layer` : `${verb} ${n} layers`);

/** Where the pointer is during a drag, and which modifiers are held (they can change without the pointer moving). */
type Pointer = { sx: number; sy: number; shift: boolean; alt: boolean };

/**
 * What the pointer is doing. A press on the canvas waits until the pointer
 * travels past DRAG_THRESHOLD; only then does it become a move, a resize
 * or a marquee. Releasing before that is a click.
 */
type Gesture =
  | { kind: "pan"; lastX: number; lastY: number }
  | {
      kind: "press";
      sx: number;
      sy: number;
      wx: number;
      wy: number;
      /** What a drag from here does. */
      then: "move" | "resize" | "marquee" | "none";
      /** The layers a move or resize changes. */
      ids: NodeId[];
      handle: Handle | null;
      /** Marquee: whose children it can select (the page, or the frame it started in). */
      scope: NodeId;
      /** Marquee with Shift: add to `base` instead of replacing it. */
      additive: boolean;
      base: NodeId[];
      /** The selection after a click (no drag), or null to leave it as is. */
      click: NodeId[] | null;
    }
  | { kind: "move"; wx: number; wy: number; starts: Start[]; box: Rect; edit: LiveEdit; last: Pointer }
  | { kind: "resize"; wx: number; wy: number; starts: Start[]; handle: Handle; edit: LiveEdit; last: Pointer }
  | { kind: "marquee"; wx: number; wy: number; scope: NodeId; additive: boolean; base: NodeId[]; rect: Rect | null }
  | { kind: "draw"; tool: Exclude<Tool, "move">; wx: number; wy: number; sx: number; sy: number };

export function Canvas(props: CanvasProps) {
  const { doc, pageId, selection, tool, handle } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLDivElement>(null);
  const outlinesRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorText, setErrorText] = useState("");
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  /** A resize cursor while the pointer is over a handle or a resize is running. */
  const [resizeCursor, setResizeCursor] = useState<string | null>(null);

  // Mutable state the event handlers and render loop share.
  const live = useRef({
    props,
    camera: { x: -40, y: -40, zoom: 1 } as Camera,
    renderer: null as PageRenderer | null,
    frame: 0,
    gesture: null as Gesture | null,
    /** The pointer that owns the gesture: a second finger or pen never takes it over. */
    pointerId: null as number | null,
    draft: null as { x: number; y: number; width: number; height: number } | null,
    space: false,
    /** The pointer is over the canvas. */
    hover: false,
    /** The layer a click would select, outlined on hover. */
    hoverId: null as NodeId | null,
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

  const toScreen = (wx: number, wy: number) => {
    const { camera } = live.current;
    return { x: (wx - camera.x) * camera.zoom, y: (wy - camera.y) * camera.zoom };
  };

  /** The selected layers that exist and sit on the page shown. */
  const pageSelection = (): NodeId[] => {
    const { doc: d, pageId: page, selection: sel } = live.current.props;
    return sel.filter((id) => {
      let cur = d.get(id);
      while (cur && cur.parentId) cur = d.get(cur.parentId);
      return cur?.id === page && id !== page;
    });
  };

  /** The selected layers a drag may change: none while viewing only or drawing. */
  const editable = (ids: readonly NodeId[]) => {
    const p = live.current.props;
    return p.readOnly || p.tool !== "move" ? [] : movable(p.doc, ids);
  };

  /**
   * The box the resize handles sit on: around the layers a drag changes (not locked
   * ones, nor children of a selected parent), so the box follows the pointer. Null if
   * none can be resized.
   */
  const handleFrame = (): SelectionFrame | null => {
    const ids = editable(pageSelection());
    return ids.length ? selectionFrame(live.current.props.doc, ids) : null;
  };

  /** Lay an overlay box over a (possibly turned) box on the page; lines stay 1 px and sharp at any zoom. */
  const place = (el: HTMLElement, f: SelectionFrame) => {
    const dpr = window.devicePixelRatio || 1;
    const snap = (v: number) => Math.round(v * dpr) / dpr;
    const s = toScreen(f.x, f.y);
    const z = live.current.camera.zoom;
    el.style.display = "block";
    el.style.transform = `translate(${snap(s.x)}px, ${snap(s.y)}px)${f.rotation ? ` rotate(${f.rotation}deg)` : ""}`;
    el.style.width = `${f.width * z}px`;
    el.style.height = `${f.height * z}px`;
  };

  /** A layer's own box on the page. */
  const layerFrame = (id: NodeId): SelectionFrame | null => {
    const n = live.current.props.doc.get(id);
    if (!n || n.type === "PAGE") return null;
    const p = placementOf(live.current.props.doc, id);
    return { x: p.x, y: p.y, rotation: p.rotation, width: n.width, height: n.height };
  };

  const updateOverlay = () => {
    const { props: p, draft, gesture, hoverId } = live.current;
    const sel = selRef.current;
    const label = sizeRef.current;
    const ids = pageSelection();
    // With handles, the box is the one they resize; otherwise it's around everything selected.
    const resizable = handleFrame();
    const frame = resizable ?? selectionFrame(p.doc, ids);
    if (sel && label) {
      if (frame) {
        place(sel, frame);
        sel.dataset.handles = resizable && gesture?.kind !== "move" ? "on" : "off";
        const z = live.current.camera.zoom;
        // On a tiny selection the edge handles would cover the corners: show the corners only.
        sel.dataset.small = frame.width * z < SMALL_SELECTION || frame.height * z < SMALL_SELECTION ? "on" : "off";
        // The size label sits under the selection's upright bounds, whatever its rotation.
        const corners = [fromSpace(frame, 0, 0), fromSpace(frame, frame.width, 0), fromSpace(frame, frame.width, frame.height), fromSpace(frame, 0, frame.height)];
        const b = boundsOf(corners.map((c) => toScreen(c.x, c.y))) as Rect;
        label.style.display = "block";
        label.style.transform = `translate(${b.x + b.width / 2}px, ${b.y + b.height + 8}px) translateX(-50%)`;
        label.textContent = `${round(frame.width)} × ${round(frame.height)}`;
      } else {
        sel.style.display = "none";
        label.style.display = "none";
      }
    }
    // Thin outlines: each member of a multi-selection, and the layer under the pointer.
    const outlines = outlinesRef.current;
    if (outlines) {
      const boxes: SelectionFrame[] = [];
      if (ids.length > 1) for (const id of ids) {
        const f = layerFrame(id);
        if (f) boxes.push(f);
      }
      const showHover = hoverId && !gesture && !ids.includes(hoverId) && p.doc.has(hoverId);
      const hover = showHover ? layerFrame(hoverId) : null;
      if (hover) boxes.push(hover);
      while (outlines.children.length > boxes.length) outlines.lastElementChild?.remove();
      boxes.forEach((f, i) => {
        let el = outlines.children[i] as HTMLElement | undefined;
        if (!el) {
          el = document.createElement("div");
          el.className = "layer-outline";
          outlines.append(el);
        }
        place(el, f);
      });
    }
    const m = marqueeRef.current;
    if (m) {
      if (gesture?.kind === "marquee" && gesture.rect) place(m, { ...gesture.rect, rotation: 0 });
      else m.style.display = "none";
    }
    const d = draftRef.current;
    if (d) {
      if (draft) {
        place(d, { ...draft, rotation: 0 });
        d.dataset.shape = gesture?.kind === "draw" ? gesture.tool : "";
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(requestDraw, [selection, tool, props.readOnly]);

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

  const local = (e: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return { sx: e.clientX - (rect?.left ?? 0), sy: e.clientY - (rect?.top ?? 0) };
  };

  /** The resize handle of the selection under a screen point, if the selection can be resized. */
  const handleUnder = (sx: number, sy: number): Handle | null => {
    const f = handleFrame();
    if (!f) return null;
    const z = live.current.camera.zoom;
    const w = toWorld(sx, sy);
    const lp = toSpace(f, w.x, w.y);
    return handleAt(lp.x * z, lp.y * z, f.width * z, f.height * z, HANDLE_GRAB);
  };

  /** True for a top-level frame with visible children: dragging on its empty area draws a marquee inside it. */
  const isFrameBackground = (id: NodeId) => {
    const { doc: d, pageId: page } = live.current.props;
    const n = d.get(id);
    return !!n && n.parentId === page && CONTAINERS.has(n.type) && d.children(id).some((c) => c.visible);
  };

  const select = (ids: NodeId[]) => {
    if (!sameIds(ids, live.current.props.selection)) live.current.props.onSelect(ids);
  };

  /** Apply the running move, resize or marquee for the pointer at `p`. */
  const applyDrag = (p: Pointer) => {
    const l = live.current;
    const g = l.gesture;
    if (!g) return;
    const w = toWorld(p.sx, p.sy);
    let dx = w.x - (g.kind === "pan" ? 0 : g.wx);
    let dy = w.y - (g.kind === "pan" ? 0 : g.wy);
    if ((g.kind === "move" || g.kind === "resize") && !g.edit.open) {
      // Ended elsewhere (committed before a save the page needed): the drag is over.
      l.gesture = null;
      l.pointerId = null;
      setResizeCursor(null);
      requestDraw();
      return;
    }
    if (g.kind === "move") {
      g.last = p;
      if (p.shift) ({ x: dx, y: dy } = constrainToAxis(dx, dy));
      const snapped = snapDelta(g.box, dx, dy);
      // A held axis stays exactly where it was, even if the box started off the pixel grid.
      const mx = dx === 0 ? 0 : snapped.x;
      const my = dy === 0 ? 0 : snapped.y;
      g.edit.update((tx) => moveBy(tx, g.starts, mx, my));
    } else if (g.kind === "resize") {
      g.last = p;
      g.edit.update((tx) => resizeBy(tx, g.starts, g.handle, dx, dy, { keepRatio: p.shift, fromCenter: p.alt }));
    } else if (g.kind === "marquee") {
      g.rect = rectFromPoints(g.wx, g.wy, w.x, w.y);
      const d = l.props.doc;
      const candidates = d
        .children(g.scope)
        .filter((n) => n.visible && !n.locked)
        .map((n) => ({ id: n.id, rect: worldBounds(d, n.id) }))
        .filter((c): c is { id: NodeId; rect: Rect } => c.rect !== null);
      const hits = marqueeHits(candidates, g.rect);
      select(g.additive ? [...g.base, ...hits.filter((id) => !g.base.includes(id))] : hits);
      requestDraw();
    }
  };

  /** Stop a move, resize or marquee and put everything back as it was before it. Returns false if nothing was running. */
  const cancelDrag = (): boolean => {
    const l = live.current;
    const g = l.gesture;
    if (!g) return false;
    if (g.kind === "move" || g.kind === "resize") {
      if (g.edit.open) g.edit.cancel();
    } else if (g.kind === "marquee") {
      select(g.base);
    } else if (g.kind === "draw") {
      l.draft = null;
    } else return false;
    l.gesture = null;
    l.pointerId = null;
    setResizeCursor(null);
    requestDraw();
    return true;
  };

  /** The press became a drag: start the move, resize or marquee it was waiting for. */
  const startDrag = (g: Extract<Gesture, { kind: "press" }>) => {
    const l = live.current;
    const d = l.props.doc;
    if (g.then === "marquee") {
      l.gesture = { kind: "marquee", wx: g.wx, wy: g.wy, scope: g.scope, additive: g.additive, base: g.base, rect: null };
      return;
    }
    if ((g.then !== "move" && g.then !== "resize") || d.live) {
      l.gesture = null;
      return;
    }
    const starts = snapshot(d, g.ids);
    const box = startBounds(starts);
    if (!box) {
      l.gesture = null;
      return;
    }
    if (g.then === "resize" && g.handle) {
      const edit = d.beginLive(plural(starts.length, "Resize"));
      l.gesture = { kind: "resize", wx: g.wx, wy: g.wy, starts, handle: g.handle, edit, last: { sx: g.sx, sy: g.sy, shift: false, alt: false } };
    } else {
      const edit = d.beginLive(plural(starts.length, "Move"));
      l.gesture = { kind: "move", wx: g.wx, wy: g.wy, starts, box, edit, last: { sx: g.sx, sy: g.sy, shift: false, alt: false } };
    }
  };

  // Escape cancels a drag (before the editor's Escape clears the selection); Shift and Alt re-apply it at once.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = live.current.gesture;
      if (!g) return;
      if (e.type === "keydown" && e.key === "Escape") {
        if (g.kind === "press") {
          // Before a drag starts, Escape drops the press (no move follows); the editor's Escape still deselects.
          live.current.gesture = null;
          live.current.pointerId = null;
          setResizeCursor(null);
          requestDraw();
          return;
        }
        if (cancelDrag()) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      if ((e.key === "Shift" || e.key === "Alt") && (g.kind === "move" || g.kind === "resize")) {
        applyDrag({ ...g.last, shift: e.shiftKey, alt: e.altKey });
      }
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leaving the window or tab mid-drag (Alt-Tab, a system dialog) cancels it: the pointer-up may never come.
  useEffect(() => {
    const onBlur = () => abortGesture();
    const onHidden = () => document.visibilityState === "hidden" && abortGesture();
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onHidden);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A drag left open when the page or file changes (or the canvas goes away) is cancelled, never half-kept.
  useEffect(
    () => () => {
      cancelDrag();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc, pageId],
  );

  /** Press with the Move tool: decide what a drag from here will do, and select as Figma does. */
  const pressMove = (e: ReactPointerEvent, sx: number, sy: number) => {
    const l = live.current;
    const p = l.props;
    const w = toWorld(sx, sy);
    const current = pageSelection();
    const base = { kind: "press" as const, sx, sy, wx: w.x, wy: w.y, handle: null, scope: p.pageId, additive: false, base: current, click: null };
    // A handle of the selection resizes, even where another layer is on top (Shift then keeps the ratio).
    const handle = handleUnder(sx, sy);
    if (handle) {
      // Released without a drag, the selection stays as it is (as in Figma), even if another layer is under the handle.
      l.gesture = { ...base, then: "resize", ids: editable(current), handle, click: null };
      setResizeCursor(handleCursor(handle, handleFrame()?.rotation ?? 0));
      return;
    }
    const hit = p.hitTest?.(w.x, w.y, { deep: e.metaKey || e.ctrlKey }) ?? null;
    if (e.shiftKey) {
      if (!hit) {
        l.gesture = { ...base, then: "marquee", ids: [], additive: true };
        return;
      }
      // Shift-click adds the layer at once, or removes a selected one on release; a Shift-drag moves the selection along one axis.
      if (current.includes(hit)) {
        l.gesture = { ...base, then: "move", ids: editable(current), click: current.filter((id) => id !== hit) };
        return;
      }
      const next = [...current, hit];
      select(next);
      l.gesture = { ...base, then: "move", ids: editable(next) };
      return;
    }
    if (hit && current.includes(hit)) {
      // Dragging a selected layer moves the whole selection; a plain click narrows it to this layer.
      l.gesture = { ...base, then: "move", ids: editable(current), click: [hit] };
      return;
    }
    if (hit && isFrameBackground(hit)) {
      // The empty area of a top-level frame: a click selects the frame, a drag draws a marquee over its children.
      l.gesture = { ...base, then: "marquee", ids: [], scope: hit, click: [hit] };
      return;
    }
    if (hit) {
      select([hit]);
      l.gesture = { ...base, then: "move", ids: editable([hit]) };
      return;
    }
    // Empty canvas inside a multi-selection's box still drags the selection, as in Figma.
    const f = current.length > 1 ? selectionFrame(p.doc, current) : null;
    const inside = f && w.x >= f.x && w.y >= f.y && w.x <= f.x + f.width && w.y <= f.y + f.height;
    l.gesture = inside ? { ...base, then: "move", ids: editable(current), click: [] } : { ...base, then: "marquee", ids: [], click: [] };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (status !== "ready") return;
    const l = live.current;
    if (l.gesture) return; // a second button, finger or pen during a drag: the first pointer keeps it
    e.currentTarget.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture(e.pointerId);
    const { sx, sy } = local(e);
    l.pointerId = e.pointerId;
    l.hoverId = null;
    if (e.button === 1 || l.space) {
      l.gesture = { kind: "pan", lastX: sx, lastY: sy };
      setPanning(true);
      return;
    }
    if (e.button !== 0) return;
    if (l.props.tool === "move" || l.props.readOnly) {
      pressMove(e, sx, sy);
      requestDraw();
      return;
    }
    const w = toWorld(sx, sy);
    l.gesture = { kind: "draw", tool: l.props.tool, wx: w.x, wy: w.y, sx, sy };
  };

  /** Hover with the Move tool: outline what a click would select, and show a resize cursor over handles. */
  const hover = (e: ReactPointerEvent, sx: number, sy: number) => {
    const l = live.current;
    const p = l.props;
    if (l.space || (p.tool !== "move" && !p.readOnly)) {
      if (l.hoverId) {
        l.hoverId = null;
        requestDraw();
      }
      return;
    }
    const handle = handleUnder(sx, sy);
    setResizeCursor(handle ? handleCursor(handle, handleFrame()?.rotation ?? 0) : null);
    const w = toWorld(sx, sy);
    const next = handle ? null : (p.hitTest?.(w.x, w.y, { deep: e.metaKey || e.ctrlKey }) ?? null);
    if (next !== l.hoverId) {
      l.hoverId = next;
      requestDraw();
    }
  };

  /** Events from a pointer that doesn't own the running gesture are ignored. */
  const foreign = (e: { pointerId: number }) => {
    const l = live.current;
    return l.gesture !== null && l.pointerId !== null && e.pointerId !== l.pointerId;
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const l = live.current;
    const g = l.gesture;
    const { sx, sy } = local(e);
    if (!g) {
      hover(e, sx, sy);
      return;
    }
    if (foreign(e)) return;
    if ((e.buttons & 1) === 0 && g.kind !== "pan") {
      // The button is up but the pointer-up never came (released outside the window, a system dialog):
      // end the drag where it is now, as a release would.
      finishGesture(null);
      return;
    }
    if (g.kind === "press") {
      if (Math.hypot(sx - g.sx, sy - g.sy) <= DRAG_THRESHOLD) return;
      startDrag(g);
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
    } else if (cur) {
      applyDrag({ sx, sy, shift: e.shiftKey, alt: e.altKey });
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (foreign(e)) return;
    finishGesture(e);
  };

  /**
   * End the gesture as a release does: a click selects, a move or resize is kept,
   * a drawn shape is created. `e` null: the release was missed (only seen as a move
   * with no button down), so a pending click or a shape being drawn is dropped.
   */
  const finishGesture = (e: ReactPointerEvent<HTMLCanvasElement> | null) => {
    const l = live.current;
    const g = l.gesture;
    l.gesture = null;
    l.pointerId = null;
    setPanning(false);
    setResizeCursor(null);
    if (!g) return;
    if (g.kind === "press") {
      // A click: no drag happened.
      if (g.click && e) select(g.click);
      requestDraw();
      return;
    }
    if (g.kind === "move" || g.kind === "resize") {
      if (g.edit.open) g.edit.commit();
      requestDraw();
      return;
    }
    if (g.kind === "marquee") {
      requestDraw();
      return;
    }
    if (g.kind !== "draw") return;
    if (!e) {
      l.draft = null;
      requestDraw();
      return;
    }
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

  /** Stop whatever the pointer is doing and put back what a drag changed. */
  const abortGesture = () => {
    const l = live.current;
    if (!cancelDrag()) {
      l.gesture = null;
      l.pointerId = null;
      setResizeCursor(null);
    }
    l.draft = null;
    setPanning(false);
    requestDraw();
  };

  const onPointerCancel = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!foreign(e)) abortGesture();
  };

  const cursor =
    spaceHeld || panning ? (panning ? "grabbing" : "grab") : (resizeCursor ?? (tool === "move" || props.readOnly ? "default" : "crosshair"));

  return (
    <div className="canvas-host" ref={hostRef}>
      <canvas
        ref={canvasRef}
        className="canvas"
        style={{ cursor }}
        tabIndex={0}
        role="application"
        aria-roledescription="design canvas"
        aria-label="Canvas. Click to select, Shift-click to add, drag to move or to select an area, arrow keys nudge. Hold Space and drag to pan, scroll to zoom. Pick a tool in the dock and drag to draw."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerEnter={() => (live.current.hover = true)}
        onPointerLeave={() => {
          live.current.hover = false;
          if (live.current.hoverId && !live.current.gesture) {
            live.current.hoverId = null;
            requestDraw();
          }
        }}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={(e) => live.current.gesture && live.current.gesture.kind !== "pan" && onPointerCancel(e)}
        // Right-click never opens the browser's menu over the canvas (and can't leave a drag open behind it).
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="canvas-overlay" aria-hidden="true">
        <div ref={outlinesRef} />
        <div ref={marqueeRef} className="marquee-box" />
        <div ref={selRef} className="selection-box">
          {HANDLE_NAMES.map((h) => (
            <span key={h} className={`handle ${h}`} />
          ))}
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
