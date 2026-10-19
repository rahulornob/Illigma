import { useEffect, useImperativeHandle, useRef, useState, type PointerEvent as ReactPointerEvent, type Ref } from "react";
import type { CanvasKit } from "canvaskit-wasm";
import { isInsideInstance, newId, type Document, type LiveEdit, type Transaction } from "@illigma/core";
import type { NodeId, NodeType } from "@illigma/format";
import { GpuCanvas, PageRenderer, type Camera, type TextEngine } from "@illigma/renderer";
import { loadCanvasKit, loadTextEngine } from "./text/engine";
import { newTextFields, textPlacement } from "./text/create";
import { TextEditor } from "./text/TextEditor";
import { useFileFonts } from "./text/file-fonts";
import { VectorController } from "./vector/VectorController";
import { VECTOR_EDITABLE } from "./vector/ops";
import { inLayer, keyboardFocused, onControl } from "./focus";
import { EdgeAssist, MoveAssist, type Mods } from "./snap/assist";
import { renderGuides, type GuideLayer } from "./snap/overlay";
import { useGridsAndRulers } from "./useGridsAndRulers";
import { measureBetween } from "./snap/measure";
import { droppable, reparent } from "./snap/drop";
import { rememberDuplicate } from "./snap/repeat";
import { SNAP_PX } from "./snap/snap";
import { snapToObjects } from "./snap/settings";
import { fitRect, zoomStep } from "./camera/zoom";
import {
  duplicateLayers,
  freeLayers,
  movable,
  moveBy,
  reorderLayers,
  reorderSlot,
  resizeBy,
  selectionFrame,
  sharedFlowParent,
  snapshot,
  startBounds,
  type ReorderSlot,
  type SelectionFrame,
  type Start,
} from "./edit";
import {
  boundsOf,
  constrainToAxis,
  frameAt,
  HANDLES,
  fromSpace,
  handleAt,
  handleCursor,
  marqueeHits,
  placeAt,
  placementOf,
  rectFromPoints,
  rectInSpace,
  SMALL_SELECTION,
  unionRects,
  toSpace,
  worldBounds,
  worldCorners,
  type Handle,
  type Rect,
} from "./geometry";

export type Tool = "move" | "frame" | "rectangle" | "ellipse" | "line" | "arrow" | "polygon" | "star" | "pen" | "text";

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
  /** Zoom to fit the selection (Shift+2). */
  zoomToSelection(): void;
  /** A point in the window (client pixels) in page (world) coordinates. */
  toWorld(clientX: number, clientY: number): { x: number; y: number };
  /** The part of the page the canvas shows, in world coordinates. */
  viewport(): { x: number; y: number; width: number; height: number };
  /** Edit text layer `id` on the canvas, all its text selected (Enter on a selected text layer). */
  editText(id: NodeId): void;
  /** The camera (per-page cameras in the editor) and setting it back. */
  camera(): { x: number; y: number; zoom: number };
  setCamera(camera: { x: number; y: number; zoom: number }): void;
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
  /** A double-click with the Move tool that didn't start text editing (entering groups and frames), in page coordinates. */
  onDoubleClickLayer?: ((x: number, y: number) => void) | undefined;
  handle: Ref<CanvasHandle>;
}

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 256;
const FIT_PADDING = 64;
const DRAG_THRESHOLD = 3;

const DRAW: Record<Exclude<Tool, "move" | "text" | "line" | "arrow" | "pen">, { type: NodeType; label: string; fill: [number, number, number] }> = {
  frame: { type: "FRAME", label: "Frame", fill: [1, 1, 1] },
  rectangle: { type: "RECTANGLE", label: "Rectangle", fill: [0.85, 0.85, 0.85] },
  ellipse: { type: "ELLIPSE", label: "Ellipse", fill: [0.85, 0.85, 0.85] },
  polygon: { type: "POLYGON", label: "Polygon", fill: [0.85, 0.85, 0.85] },
  star: { type: "STAR", label: "Star", fill: [0.85, 0.85, 0.85] },
};

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/** Top-level containers: dragging on their empty area draws a marquee over their children, as in Figma. */
const CONTAINERS = new Set<NodeType>(["FRAME", "SECTION", "COMPONENT"]);
/** Grab distance around a handle or an edge, in screen pixels. */
const HANDLE_GRAB = 6;
const HANDLE_NAMES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

const sameIds = (a: readonly NodeId[], b: readonly NodeId[]) => a.length === b.length && a.every((id, i) => id === b[i]);
const plural = (n: number, verb: string) => (n === 1 ? `${verb} layer` : `${verb} ${n} layers`);

/** Where the pointer is during a drag, and which modifiers are held (they can change without the pointer moving). */
type Pointer = {
  sx: number;
  sy: number;
  shift: boolean;
  alt: boolean;
  /** ⌘ on macOS, Ctrl elsewhere: resize without constraints, drop a larger layer into auto layout. */ meta: boolean;
  /** Ctrl (or ⌘) held: snapping suspended (interactions.md §4). */ free: boolean;
};

/** macOS: ⌘ is the command key, and Ctrl is kept for suspending snapping (interactions.md §4). */
const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const pointerOf = (sx: number, sy: number, e: { shiftKey: boolean; altKey: boolean; metaKey: boolean; ctrlKey: boolean }): Pointer => ({
  sx,
  sy,
  shift: e.shiftKey,
  alt: e.altKey,
  meta: IS_MAC ? e.metaKey : e.ctrlKey,
  free: e.ctrlKey || e.metaKey,
});

/** How far outside an auto layout frame (screen pixels) a dragged child still reorders; further out, dropping does nothing. */
const REORDER_REACH = 24;

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
  | {
      kind: "move";
      wx: number;
      wy: number;
      starts: Start[];
      box: Rect;
      edit: LiveEdit;
      last: Pointer;
      /** Snapping, guides and the drop target. */
      assist: MoveAssist;
      /** ⌥-drag: the copies' ids by original (the originals stay). */
      dup: Map<NodeId, NodeId> | null;
      /** The last change applied, so a release can add the reparenting to it. */
      apply: ((tx: Transaction) => void) | null;
    }
  | { kind: "resize"; wx: number; wy: number; starts: Start[]; handle: Handle; edit: LiveEdit; last: Pointer; assist: EdgeAssist }
  /**
   * Dragging layers in an auto layout flow reorders them (interactions.md §5): the selection box
   * follows the pointer, an insertion line shows the slot, and the order changes on release.
   */
  | {
      kind: "reorder";
      wx: number;
      wy: number;
      parent: NodeId;
      ids: NodeId[];
      edit: LiveEdit;
      last: Pointer;
      dx: number;
      dy: number;
      slot: ReorderSlot | null;
      /** Dragged out of the frame: where the layers would drop. */
      assist: MoveAssist;
    }
  | { kind: "marquee"; wx: number; wy: number; scope: NodeId; additive: boolean; base: NodeId[]; rect: Rect | null }
  | { kind: "draw"; tool: Exclude<Tool, "move" | "line" | "arrow" | "pen">; wx: number; wy: number; sx: number; sy: number; assist: EdgeAssist }
  /** The pen, line and arrow tools, and vector edit mode (vector/VectorController.ts). */
  | { kind: "vector" }
  /** Placing the caret or selecting in the text being edited. */
  | { kind: "text" };

/** Presses this close in time and space count as one double or triple click. */
const MULTI_CLICK_MS = 500;
const MULTI_CLICK_PX = 4;

export function Canvas(props: CanvasProps) {
  const { doc, pageId, selection, tool, handle } = props;
  // The file's fonts on this computer, loaded as it opens (when permission was granted before).
  useFileFonts(doc);
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLDivElement>(null);
  const outlinesRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const insertRef = useRef<HTMLDivElement>(null);
  const guidesRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorText, setErrorText] = useState("");
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  /** A resize cursor while the pointer is over a handle or a resize is running. */
  const [resizeCursor, setResizeCursor] = useState<string | null>(null);
  /** An I-beam over the text being edited. */
  const [textCursor, setTextCursor] = useState(false);

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
    /** Editing a text layer: caret, selection and the hidden input (created on mount). */
    text: null as TextEditor | null,
    /** The pen, line and arrow tools and vector edit mode. */
    vector: null as VectorController | null,
    engine: null as TextEngine | null,
    /** The last press, for double and triple clicks. */
    lastPress: { t: 0, sx: 0, sy: 0, count: 0 },
    /** The press went to the text being edited: keep focus in its input (no mousedown focus change). */
    keepFocus: false,
    /** Smart guides of the running drag, and ⌥ hover measurements. */
    guides: null as GuideLayer | null,
    measure: null as GuideLayer | null,
    /** Where the pointer last hovered (⌥ pressed without moving measures there). */
    lastHover: null as { sx: number; sy: number } | null,
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
    if (live.current.vector?.editing()) return null;
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
    const still = live.current.vector?.editing() ? null : (resizable ?? selectionFrame(p.doc, ids));
    // While reordering, the box follows the pointer (the layers move on release).
    const frame = still && gesture?.kind === "reorder" ? { ...still, x: still.x + gesture.dx, y: still.y + gesture.dy } : still;
    if (sel && label) {
      if (frame) {
        place(sel, frame);
        sel.dataset.handles = resizable && gesture?.kind !== "move" && gesture?.kind !== "reorder" && !live.current.text?.editing ? "on" : "off";
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
    const gl = guidesRef.current;
    if (gl) renderGuides(gl, gesture ? live.current.guides : live.current.measure, toScreen);
    const assist = gesture?.kind === "move" || gesture?.kind === "reorder" ? gesture.assist : null;
    const drop = dropRef.current;
    if (drop) {
      const t = assist?.target;
      const f = t && t !== p.pageId ? layerFrame(t) : null;
      if (f) place(drop, f);
      else drop.style.display = "none";
    }
    const slot = gesture?.kind === "reorder" ? (gesture.slot ?? assist?.slot) : assist?.slot;
    const line = insertRef.current;
    if (line) {
      if (slot) {
        place(line, slot.line);
        line.style.height = ""; // its thickness comes from CSS: 2 px at any zoom
      } else line.style.display = "none";
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
    overlays.current?.render();
    updateOverlay();
    l.text?.render();
    l.vector?.render();
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
      zoomAround(zoomStep(live.current.camera.zoom, 1), w / 2, h / 2);
    },
    zoomOut: () => {
      const { w, h } = size();
      zoomAround(zoomStep(live.current.camera.zoom, -1), w / 2, h / 2);
    },
    zoomToSelection: () => {
      const d = live.current.props.doc;
      const r = unionRects(pageSelection().map((id) => worldBounds(d, id)).filter((b): b is Rect => b !== null));
      if (!r) return;
      const { w, h } = size();
      setCamera(fitRect(r, w, h, FIT_PADDING));
    },
    zoomTo: (z: number) => {
      const { w, h } = size();
      zoomAround(z, w / 2, h / 2);
    },
    fit: () => fit(),
    toWorld: (clientX: number, clientY: number) => {
      const r = canvasRef.current?.getBoundingClientRect();
      return toWorld(clientX - (r?.left ?? 0), clientY - (r?.top ?? 0));
    },
    viewport: () => {
      const { w, h } = size();
      const { camera } = live.current;
      return { x: camera.x, y: camera.y, width: w / camera.zoom, height: h / camera.zoom };
    },
    editText: (id: NodeId) => {
      if (!live.current.props.readOnly) live.current.text?.start(id, "all");
    },
    camera: () => ({ ...live.current.camera }),
    setCamera: (c) => setCamera({ x: c.x, y: c.y, zoom: clampZoom(c.zoom) }),
  }));

  // CanvasKit, the GPU surface and the page renderer. Rebuilt when the canvas resizes.
  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    let disposed = false;
    let ck: CanvasKit | null = null;
    let gpu: GpuCanvas | null = null;
    let engine: TextEngine | null = null;
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
      // An image decodes after the recording that first needs it: draw again once it is ready, with no interaction needed.
      // The app's text engine: layout measures text with it, so the canvas draws text exactly as it was measured.
      live.current.renderer = new PageRenderer(ck, gpu.surface, live.current.props.doc, live.current.props.pageId, dpr, { ...(engine && { textEngine: engine }), onImageReady: requestDraw });
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

    // CanvasKit and the bundled Inter (no font CDN), shared with layout and text editing (text/engine.ts).
    // Without fonts, text layers fall back to placeholder bars.
    let unsubscribeFonts = () => {};
    Promise.all([loadCanvasKit(), loadTextEngine()])
      .then(([loaded, loadedEngine]) => {
        if (disposed) return;
        ck = loaded;
        engine = loadedEngine.hasFonts ? loadedEngine : null;
        live.current.engine = engine;
        // Fonts added later (fonts on this computer): draw again.
        unsubscribeFonts = loadedEngine.subscribe(requestDraw);
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
      unsubscribeFonts();
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  // Page switches: show the new page, fitted.
  useEffect(() => {
    live.current.text?.stop(false, true);
    const r = live.current.renderer;
    if (!r) return;
    r.setPage(pageId);
    fit(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(requestDraw, [selection, tool, props.readOnly]);

  // Layout grids (⌃G) and rulers with guides (⇧R).
  const overlays = useGridsAndRulers({
    host: hostRef,
    grid: gridRef,
    doc: () => live.current.props.doc,
    pageId: () => live.current.props.pageId,
    camera: () => live.current.camera,
    readOnly: () => !!live.current.props.readOnly,
    selection: () => unionRects(pageSelection().map((id) => worldBounds(live.current.props.doc, id)).filter((b): b is Rect => b !== null)),
    requestDraw: () => requestDraw(),
  });

  // Text editing (text/TextEditor.ts): its caret, selection and hidden input live in the canvas host.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const l = live.current;
    const editor = new TextEditor(
      {
        doc: () => live.current.props.doc,
        engine: () => live.current.engine,
        camera: () => live.current.camera,
        requestDraw,
        started: (id) => select([id]),
        ended: (id, exists) => {
          select(exists ? [id] : []);
          canvasRef.current?.focus({ preventScroll: true });
        },
      },
      host,
    );
    l.text = editor;
    return () => {
      editor.dispose();
      l.text = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  // The vector tools draw in their own overlay layer in the canvas host.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const l = live.current;
    const vector = new VectorController(
      {
        doc: () => live.current.props.doc,
        pageId: () => live.current.props.pageId,
        camera: () => live.current.camera,
        tool: () => live.current.props.tool,
        readOnly: () => !!live.current.props.readOnly,
        requestDraw,
        select: (ids) => select(ids),
        created: (id) => live.current.props.onCreated(id),
      },
      host,
    );
    l.vector = vector;
    return () => {
      vector.dispose();
      l.vector = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);
  useEffect(() => live.current.vector?.selectionChanged(selection), [selection]);
  useEffect(() => live.current.vector?.toolChanged(tool), [tool]);
  useEffect(() => live.current.vector?.exit(), [pageId]);

  // Editing ends when the selection moves elsewhere (the Layers panel), another tool is picked, or editing is locked.
  useEffect(() => {
    const t = live.current.text;
    const id = t?.editing;
    if (!t || !id) return;
    if (tool !== "move" || props.readOnly || selection.length !== 1 || selection[0] !== id) t.stop(false, true);
  }, [selection, tool, props.readOnly]);

  // Wheel zoom (needs a non-passive listener to stop the browser zooming the page).
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      // ⌘/Ctrl + scroll and pinch (a wheel with ctrlKey) zoom around the pointer; plain scrolling pans (Shift: sideways).
      if (e.ctrlKey || e.metaKey) {
        const speed = e.deltaMode === 1 ? 0.05 : e.ctrlKey && !e.metaKey ? 0.01 : 0.0015;
        zoomAround(live.current.camera.zoom * Math.exp(-e.deltaY * speed), e.clientX - rect.left, e.clientY - rect.top);
        return;
      }
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? rect.height : 1;
      const [ddx, ddy] = e.shiftKey && !e.deltaX ? [e.deltaY, 0] : [e.deltaX, e.deltaY];
      const { camera } = live.current;
      setCamera({ ...camera, x: camera.x + (ddx * unit) / camera.zoom, y: camera.y + (ddy * unit) / camera.zoom });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hold Space to pan with any tool, wherever focus is (except text fields).
  useEffect(() => {
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    let swallowed = false;
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || typing(e.target) || inLayer(e.target)) return;
      // A control focused from the keyboard (focus ring shown): Space presses it, wherever the pointer is.
      const control = onControl(e.target);
      if (control && keyboardFocused(e.target)) return;
      // A button focused by a click (a tool in the dock) keeps Space unless the pointer is over the canvas:
      // then it's a pan. Pressing on the canvas moves focus there, so the button isn't pressed.
      if (!control || live.current.hover) {
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
    if (!g || g.kind === "text" || g.kind === "vector") return;
    const w = toWorld(p.sx, p.sy);
    let dx = w.x - (g.kind === "pan" ? 0 : g.wx);
    let dy = w.y - (g.kind === "pan" ? 0 : g.wy);
    if ((g.kind === "move" || g.kind === "resize" || g.kind === "reorder") && !g.edit.open) {
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
      const d = l.props.doc;
      const dup = g.dup;
      const moving = dup ? g.starts.map((s) => dup.get(s.id) ?? s.id) : g.starts.map((s) => s.id);
      const snapped = g.assist.move(dx, dy, w.x, w.y, SNAP_PX / l.camera.zoom, { ...mods(p), keep: l.space }, moving);
      l.guides = g.assist.layer;
      // A held axis stays exactly where it was, even if the box started off the pixel grid.
      const mx = dx === 0 ? 0 : snapped.dx;
      const my = dy === 0 ? 0 : snapped.dy;
      const sources = g.starts.map((s) => s.id);
      const starts = dup ? g.starts.map((s) => ({ ...s, id: idFor(dup, s.id) })) : g.starts;
      g.apply = (tx) => {
        if (dup) duplicateLayers(tx, d, sources, { inPlace: true, idFor: (id) => idFor(dup, id) });
        moveBy(tx, starts, mx, my);
      };
      g.edit.update(g.apply);
      const copies = starts.map((s) => s.id);
      if (dup && !sameIds(copies, l.props.selection)) select(copies);
    } else if (g.kind === "resize") {
      g.last = p;
      const d = l.props.doc;
      // Snap the moving edges (upright layers; not when resizing from the centre).
      const box = startBounds(g.starts);
      const upright = g.starts.every((s) => s.rotation + s.parent.rotation === 0);
      if (box && upright && !p.alt) {
        const { hx, hy } = HANDLES[g.handle];
        const t = SNAP_PX / l.camera.zoom;
        if (hx) {
          const edge = hx > 0 ? box.x + box.width : box.x;
          dx = g.assist.coordinate("x", edge + dx, t, !p.free && snapToObjects()) - edge;
        }
        if (hy) {
          const edge = hy > 0 ? box.y + box.height : box.y;
          dy = g.assist.coordinate("y", edge + dy, t, !p.free && snapToObjects()) - edge;
        }
        const x1 = hx < 0 ? box.x + dx : box.x;
        const x2 = hx > 0 ? box.x + box.width + dx : box.x + box.width;
        const y1 = hy < 0 ? box.y + dy : box.y;
        const y2 = hy > 0 ? box.y + box.height + dy : box.y + box.height;
        g.assist.showFor(rectFromPoints(x1, y1, x2, y2), !p.free && !p.shift && snapToObjects());
        l.guides = g.assist.layer;
      } else l.guides = null;
      g.edit.update((tx) => resizeBy(tx, d, g.starts, g.handle, dx, dy, { keepRatio: p.shift, fromCenter: p.alt, constraints: !p.meta }));
    } else if (g.kind === "reorder") {
      g.last = p;
      g.dx = dx;
      g.dy = dy;
      // Far outside the frame there is no slot (no line), and letting go puts the layers back.
      g.slot = reorderSlot(l.props.doc, g.parent, g.ids, w.x, w.y, REORDER_REACH / l.camera.zoom);
      // Dragged out of the frame: it drops onto the page or another frame.
      if (g.slot) {
        g.assist.target = null;
        g.assist.slot = null;
      } else g.assist.move(dx, dy, w.x, w.y, SNAP_PX / l.camera.zoom, { ...mods(p), keep: l.space }, g.ids);
      l.guides = null;
      requestDraw();
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
    l.guides = null;
    if (g.kind === "move" || g.kind === "resize" || g.kind === "reorder") {
      if (g.edit.open) g.edit.cancel();
      if (g.kind === "move" && g.dup) select(g.starts.map((s) => s.id));
    } else if (g.kind === "vector") {
      l.vector?.cancel();
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
  const startDrag = (g: Extract<Gesture, { kind: "press" }>, alt = false) => {
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
    const last: Pointer = { sx: g.sx, sy: g.sy, shift: false, alt: false, meta: false, free: false };
    // Layers in an auto layout flow are reordered, not moved (a mix moves only the free ones).
    const flow = g.then === "move" ? sharedFlowParent(d, g.ids) : null;
    if (flow) {
      const edit = d.beginLive(plural(g.ids.length, "Reorder"));
      const box = startBounds(snapshot(d, g.ids)) ?? { x: g.wx, y: g.wy, width: 0, height: 0 };
      const assist = new MoveAssist(d, l.props.pageId, g.ids, box);
      l.gesture = { kind: "reorder", wx: g.wx, wy: g.wy, parent: flow, ids: g.ids, edit, last, dx: 0, dy: 0, slot: null, assist };
      return;
    }
    const starts = snapshot(d, g.then === "move" ? freeLayers(d, g.ids) : g.ids);
    const box = startBounds(starts);
    if (!box) {
      l.gesture = null;
      return;
    }
    if (g.then === "resize" && g.handle) {
      const edit = d.beginLive(plural(starts.length, "Resize"));
      const assist = new EdgeAssist(d, starts.map((s) => s.id));
      l.gesture = { kind: "resize", wx: g.wx, wy: g.wy, starts, handle: g.handle, edit, last, assist };
    } else {
      // ⌥-drag duplicates: the copies move, the originals stay (and can be snapped to). Not layers inside an instance: they just move.
      const dupOk = alt && !starts.some((s) => isInsideInstance(d, s.id));
      const ids = starts.map((s) => s.id);
      const edit = d.beginLive(dupOk ? plural(starts.length, "Duplicate") : plural(starts.length, "Move"));
      const assist = new MoveAssist(d, l.props.pageId, ids, box, dupOk);
      l.gesture = { kind: "move", wx: g.wx, wy: g.wy, starts, box, edit, last, assist, dup: dupOk ? new Map() : null, apply: null };
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
      if ((e.key === "Shift" || e.key === "Alt" || e.key === "Meta" || e.key === "Control") && (g.kind === "move" || g.kind === "resize")) {
        applyDrag(pointerOf(g.last.sx, g.last.sy, e));
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
    const deep = e.metaKey || e.ctrlKey;
    const top = p.hitTest?.(w.x, w.y, { deep }) ?? null;
    // A selected layer nested inside the one a click would pick (a child of an auto layout card) keeps the press, as in Figma.
    let hit = top;
    if (top && !deep && current.length) {
      for (let id = p.hitTest?.(w.x, w.y, { deep: true }) ?? null; id && id !== top; id = p.doc.get(id)?.parentId ?? null) {
        if (current.includes(id)) {
          hit = id;
          break;
        }
      }
    }
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

  /** How many presses in a row this one makes (1, 2 for a double click, 3 for a triple click). */
  const countClicks = (sx: number, sy: number): number => {
    const p = live.current.lastPress;
    const now = performance.now();
    const count = now - p.t < MULTI_CLICK_MS && Math.hypot(sx - p.sx, sy - p.sy) <= MULTI_CLICK_PX ? p.count + 1 : 1;
    live.current.lastPress = { t: now, sx, sy, count };
    return count;
  };

  /**
   * A press while a text layer is being edited: on that text it places the
   * caret or selects; on another text layer (Move tool) editing moves there,
   * as in Figma. Anywhere else editing ends and the press does what it
   * normally does. Returns true if the press was used here.
   */
  const pressText = (e: ReactPointerEvent<HTMLCanvasElement>, sx: number, sy: number, clicks: number): boolean => {
    const l = live.current;
    const t = l.text;
    if (!t?.editing) return false;
    const w = toWorld(sx, sy);
    if (t.contains(w.x, w.y, 2 / l.camera.zoom)) {
      t.pointerDown(w.x, w.y, clicks, e.shiftKey);
      return true;
    }
    const hit = l.props.tool === "move" ? l.props.hitTest?.(w.x, w.y, { deep: true }) : null;
    const node = hit ? l.props.doc.get(hit) : undefined;
    if (hit && node?.type === "TEXT" && !node.locked) {
      startEditingAt(hit, w.x, w.y);
      return true;
    }
    t.stop(false);
    return false;
  };

  /** Edit text layer `id` with the caret nearest to the world point (wx, wy). */
  const startEditingAt = (id: NodeId, wx: number, wy: number) => {
    const { props: p, text } = live.current;
    if (!text || p.readOnly) return;
    const local = toSpace(placementOf(p.doc, id), wx, wy);
    text.start(id, local);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (status !== "ready") return;
    const l = live.current;
    if (l.gesture) return; // a second button, finger or pen during a drag: the first pointer keeps it
    const { sx, sy } = local(e);
    l.keepFocus = false;
    let clicks = 1;
    if (e.button === 0 && !l.space) {
      clicks = countClicks(sx, sy);
      if (pressText(e, sx, sy, clicks)) {
        // The text input keeps focus; the drag selects text.
        l.keepFocus = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        l.pointerId = e.pointerId;
        l.gesture = { kind: "text" };
        return;
      }
    }
    e.currentTarget.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture(e.pointerId);
    l.pointerId = e.pointerId;
    l.hoverId = null;
    if (e.button === 1 || l.space) {
      l.gesture = { kind: "pan", lastX: sx, lastY: sy };
      setPanning(true);
      return;
    }
    if (e.button !== 0) return;
    if (l.vector?.pointerDown(pointerOf(sx, sy, e), clicks)) {
      l.gesture = { kind: "vector" };
      requestDraw();
      return;
    }
    if (l.props.tool === "move" || l.props.readOnly) {
      pressMove(e, sx, sy);
      requestDraw();
      return;
    }
    const tool = l.props.tool;
    if (tool === "line" || tool === "arrow" || tool === "pen") return;
    const raw = toWorld(sx, sy);
    const { doc: d, pageId: page } = l.props;
    const inside = frameAt(d, page, raw.x, raw.y);
    const assist = new EdgeAssist(d, [], inside ? [page, inside] : [page]);
    const w = assist.point(raw.x, raw.y, SNAP_PX / l.camera.zoom, !(e.ctrlKey || e.metaKey) && snapToObjects());
    l.gesture = { kind: "draw", tool, wx: w.x, wy: w.y, sx, sy, assist };
  };

  /** Hover with the Move tool: outline what a click would select, and show a resize cursor over handles. */
  const hover = (e: ReactPointerEvent, sx: number, sy: number) => {
    const l = live.current;
    const p = l.props;
    l.vector?.hover(pointerOf(sx, sy, e));
    if (l.text?.editing) {
      // Over the text being edited: an I-beam.
      const w = toWorld(sx, sy);
      setTextCursor(l.text.contains(w.x, w.y));
    } else setTextCursor(false);
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
    l.lastHover = { sx, sy };
    const had = l.measure;
    l.measure = measureAt(w.x, w.y, e.altKey, e.metaKey || e.ctrlKey);
    if (next !== l.hoverId || had || l.measure) {
      l.hoverId = next;
      requestDraw();
    }
  };

  /**
   * ⌥ held with something selected: the distances from the selection to the
   * layer under the pointer, or to its parent's edges (interactions.md §4).
   * ⌘⌥ measures to layers nested inside frames.
   */
  const measureAt = (wx: number, wy: number, alt: boolean, deep: boolean): GuideLayer | null => {
    const { props: p, gesture, text } = live.current;
    if (!alt || gesture || text?.editing) return null;
    const ids = pageSelection();
    const d = p.doc;
    const a = unionRects(ids.map((id) => worldBounds(d, id)).filter((b): b is Rect => b !== null));
    if (!a) return null;
    const hit = p.hitTest?.(wx, wy, { deep }) ?? null;
    let other: NodeId | null = hit && !ids.includes(hit) ? hit : null;
    if (!other) {
      const parent = ids[0] ? d.get(ids[0])?.parentId : null;
      if (parent && d.get(parent)?.type !== "PAGE") other = parent;
    }
    const b = other ? worldBounds(d, other) : null;
    const gaps = b ? measureBetween(a, b) : [];
    return gaps.length ? { guides: [], gaps } : null;
  };

  // Pressing or letting go of ⌥ over the canvas shows or hides measurements without moving the pointer.
  useEffect(() => {
    const onAlt = (e: KeyboardEvent) => {
      if (e.key !== "Alt") return;
      const l = live.current;
      if (!l.hover || !l.lastHover || l.gesture) return;
      const w = toWorld(l.lastHover.sx, l.lastHover.sy);
      l.measure = measureAt(w.x, w.y, e.type === "keydown", e.metaKey || e.ctrlKey);
      requestDraw();
    };
    window.addEventListener("keydown", onAlt);
    window.addEventListener("keyup", onAlt);
    return () => {
      window.removeEventListener("keydown", onAlt);
      window.removeEventListener("keyup", onAlt);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      startDrag(g, e.altKey);
    }
    const cur = l.gesture;
    if (cur?.kind === "vector") {
      l.vector?.pointerMove(pointerOf(sx, sy, e));
      return;
    }
    if (cur?.kind === "text") {
      const w = toWorld(sx, sy);
      l.text?.pointerMove(w.x, w.y);
      return;
    }
    if (cur?.kind === "pan") {
      const { camera } = l;
      setCamera({ ...camera, x: camera.x - (sx - cur.lastX) / camera.zoom, y: camera.y - (sy - cur.lastY) / camera.zoom });
      cur.lastX = sx;
      cur.lastY = sy;
    } else if (cur?.kind === "draw") {
      const raw = toWorld(sx, sy);
      const w = e.shiftKey ? raw : cur.assist.point(raw.x, raw.y, SNAP_PX / l.camera.zoom, !(e.ctrlKey || e.metaKey) && snapToObjects());
      l.guides = e.shiftKey ? null : cur.assist.layer;
      let dx = w.x - cur.wx;
      let dy = w.y - cur.wy;
      if (e.shiftKey) {
        const s = Math.max(Math.abs(dx), Math.abs(dy));
        dx = Math.sign(dx || 1) * s;
        dy = Math.sign(dy || 1) * s;
      }
      // ⌥ draws from the centre.
      const ox = e.altKey ? cur.wx - dx : cur.wx;
      const oy = e.altKey ? cur.wy - dy : cur.wy;
      l.draft = { x: Math.min(ox, cur.wx + dx), y: Math.min(oy, cur.wy + dy), width: Math.abs(cur.wx + dx - ox), height: Math.abs(cur.wy + dy - oy) };
      requestDraw();
    } else if (cur) {
      applyDrag(pointerOf(sx, sy, e));
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
    l.guides = null;
    if (!g) return;
    if (g.kind === "text") {
      l.text?.pointerUp();
      return;
    }
    if (g.kind === "vector") {
      l.vector?.pointerUp(e ? pointerOf(local(e).sx, local(e).sy, e) : null);
      requestDraw();
      return;
    }
    if (g.kind === "press") {
      // A click: no drag happened.
      if (g.click && e) select(g.click);
      requestDraw();
      return;
    }
    if (g.kind === "move") {
      if (g.edit.open) {
        // Dropped onto a frame (or out onto the page): reparented in the same undo step, page position kept.
        const { doc: d } = l.props;
        const target = g.assist.target;
        const apply = g.apply;
        const dup = g.dup;
        const moving = g.starts.map((s) => (dup ? (dup.get(s.id) ?? s.id) : s.id));
        if (target && apply) {
          const before = g.assist.slot?.before ?? null;
          g.edit.update((tx) => {
            apply(tx);
            reparent(tx, d, droppable(d, moving), target, before);
          });
        }
        g.edit.commit();
        if (dup && apply) rememberDuplicate(d, g.starts.map((s) => s.id), moving);
      }
      requestDraw();
      return;
    }
    if (g.kind === "resize") {
      if (g.edit.open) g.edit.commit();
      requestDraw();
      return;
    }
    if (g.kind === "reorder") {
      if (g.edit.open) {
        // The slot the insertion line showed (where the last pointer move put it); layout reflows inside the same step.
        const { doc: d } = l.props;
        const slot = g.slot;
        const target = g.assist.target;
        if (slot) g.edit.update((tx) => void reorderLayers(tx, d, g.parent, g.ids, slot.before));
        else if (target) {
          // Dragged out of its auto layout frame onto the page or another frame.
          const starts = snapshot(d, g.ids);
          const before = g.assist.slot?.before ?? null;
          g.edit.update((tx) => {
            moveBy(tx, starts, Math.round(g.dx), Math.round(g.dy));
            reparent(tx, d, droppable(d, g.ids), target, before);
          });
        }
        g.edit.commit();
      }
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
    if (g.tool === "text") {
      const draft = l.draft;
      l.draft = null;
      createText(g.wx, g.wy, clicked ? null : draft);
      requestDraw();
      return;
    }
    const rect = clicked || !l.draft ? { x: g.wx - 50, y: g.wy - 50, width: 100, height: 100 } : l.draft;
    l.draft = null;
    const spec = DRAW[g.tool];
    const { doc: d, pageId: page } = l.props;
    const parent = frameAt(d, page, g.wx, g.wy) ?? page;
    // In the frame's own space (its rotation too): the shape lands where it was drawn.
    const inFrame = rectInSpace(d, parent, rect);
    const count = d.subtree(page).filter((n) => n.type === spec.type).length + 1;
    const [r, gr, b] = spec.fill;
    const id = d.transact(`Draw ${spec.label.toLowerCase()}`, (tx) =>
      tx.create(spec.type, parent, {
        name: `${spec.label} ${count}`,
        x: Math.round(inFrame.x),
        y: Math.round(inFrame.y),
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
        fills: [{ type: "SOLID", visible: true, color: { r, g: gr, b, a: 1 } }],
      }),
    );
    l.props.onCreated(id);
    requestDraw();
  };

  /**
   * The Text tool: a click makes an auto width text layer at the point (or,
   * on a text layer, edits it); a drag makes a fixed-size text box. Editing
   * starts at once; the layer and what is typed first are one undo step.
   */
  const createText = (wx: number, wy: number, box: Rect | null) => {
    const { doc: d, pageId: page, text } = live.current.props.readOnly ? { ...live.current.props, text: null } : { ...live.current.props, text: live.current.text };
    if (!text) return;
    if (!box) {
      const hit = live.current.props.hitTest?.(wx, wy, { deep: true });
      const node = hit ? d.get(hit) : undefined;
      if (hit && node?.type === "TEXT" && !node.locked) {
        startEditingAt(hit, wx, wy);
        live.current.props.onCreated(hit);
        return;
      }
    }
    // In the frame's own space (its rotation too): the text lands where it was clicked or dragged.
    const { parent, local: point } = placeAt(d, page, wx, wy);
    const id = newId();
    const at = textPlacement(point.x, point.y, box && rectInSpace(d, parent, box));
    text.create(id, { parent, fields: newTextFields(at, box !== null) });
    live.current.props.onCreated(id);
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
    spaceHeld || panning
      ? panning
        ? "grabbing"
        : "grab"
      : (resizeCursor ?? (textCursor || (tool === "text" && !props.readOnly) ? "text" : tool === "move" || props.readOnly ? "default" : "crosshair"));

  return (
    <div className="canvas-host" ref={hostRef}>
      <canvas
        ref={canvasRef}
        className="canvas"
        style={{ cursor }}
        tabIndex={0}
        role="application"
        aria-roledescription="design canvas"
        aria-label="Canvas. Click to select, Shift-click to add, drag to move or to select an area, arrow keys nudge. Hold Space and drag to pan, scroll to pan, ⌘ or Ctrl and scroll to zoom. Pick a tool in the dock and drag to draw."
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
        // A press on the text being edited keeps focus in its input (mousedown would move it to the canvas).
        onMouseDown={(e) => live.current.keepFocus && e.preventDefault()}
        onDoubleClick={(e) => {
          // Double-click on a text layer edits it, the caret where it was clicked (interactions.md §6).
          const l = live.current;
          if (l.text?.editing || l.props.tool !== "move" || l.props.readOnly || l.space) return;
          const { sx, sy } = local(e);
          if (l.vector?.doubleClick(pointerOf(sx, sy, e))) return;
          const w = toWorld(sx, sy);
          const hit = l.props.hitTest?.(w.x, w.y, { deep: true });
          const node = hit ? l.props.doc.get(hit) : undefined;
          if (hit && node?.type === "TEXT" && !node.locked) startEditingAt(hit, w.x, w.y);
          // On a vector or a shape: vector edit mode (interactions.md §7).
          else if (hit && node && VECTOR_EDITABLE.has(node.type) && !node.locked && !l.vector?.editing()) l.vector?.edit(hit);
          else l.props.onDoubleClickLayer?.(w.x, w.y);
        }}
        onLostPointerCapture={(e) => live.current.gesture && live.current.gesture.kind !== "pan" && onPointerCancel(e)}
        // Right-click never opens the browser's menu over the canvas (and can't leave a drag open behind it).
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="canvas-overlay" aria-hidden="true">
        <canvas ref={gridRef} className="grid-overlay" />
        <div ref={outlinesRef} />
        <div ref={marqueeRef} className="marquee-box" />
        <div ref={insertRef} className="insert-line" />
        <div ref={dropRef} className="drop-target" />
        <div ref={guidesRef} className="snap-guides" />
        <div ref={selRef} className="selection-box">
          {HANDLE_NAMES.map((h) => (
            <span key={h} className={`handle ${h}`} />
          ))}
        </div>
        <div ref={sizeRef} className="size-pill" />
        <div ref={draftRef} className="draft-box" />
      </div>
      <div className="ruler-guides" aria-hidden="true" />
      <div className="ruler ruler-top" aria-hidden="true">
        <canvas />
      </div>
      <div className="ruler ruler-left" aria-hidden="true">
        <canvas />
      </div>
      <div className="ruler-corner" aria-hidden="true" />
      {status !== "ready" && (
        <div className="canvas-status" role={status === "error" ? "alert" : "status"}>
          {status === "loading" ? "Loading canvas…" : `Couldn't start the canvas. ${errorText}`}
        </div>
      )}
    </div>
  );
}

/** Modifiers for snapping and dropping. */
function mods(p: Pointer): Mods {
  return { snap: !p.free && snapToObjects(), keep: false, force: p.meta };
}

/** The copy's id for an original, made once per drag so live updates keep it. */
function idFor(map: Map<NodeId, NodeId>, id: NodeId): NodeId {
  let c = map.get(id);
  if (!c) {
    c = newId();
    map.set(id, c);
  }
  return c;
}

function round(v: number): string {
  return String(Math.round(v * 100) / 100);
}
