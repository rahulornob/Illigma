import {
  fontFamilies,
  restoreFonts,
  importLocalFont,
  importGoogleFont,
} from "./fonts.js";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./styles.css";
import {
  createIcons,
  Grid2x2,
  MousePointer2,
  Navigation2,
  Square,
  Circle,
  PenTool,
  Type,
  Shapes,
  Pipette,
  Hand,
  ChevronDown,
  ChevronRight,
  Undo2,
  Redo2,
  ArrowUpRight,
  Minus,
  Plus,
  Scan,
  SlidersHorizontal,
  RotateCw,
  Blend,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  Copy,
  Frame,
  Combine,
  CircleHelp,
  X,
  FilePlus2,
  Download,
  FolderOpen,
  RotateCcw,
  Keyboard,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Spline,
  Search,
  ArrowRight,
  ArrowDown,
  Columns2,
  MoveHorizontal,
  MoveVertical,
  Shrink,
  Maximize2,
} from "lucide";
import {
  paper,
  clamp,
  round,
  clone,
  rotatePoint,
  localPoint,
  boundsOf,
  objectBounds,
  localPath,
  worldPath,
  pathObject,
  pathfinderObjects,
  buildRegions,
  penData,
  hexToRgb,
  rgbToHex,
  hexToHsv,
  hsvToHex,
} from "./geometry.js";
import {
  state,
  defaults,
  makeObject,
  selectedObjects,
  begin,
  commit,
  cancel,
  history,
  sampleDocument,
  validDocument,
  replaceDocument,
  syncActivePage,
  preparePages,
} from "./store.js";
export { state };

const icons = {
  Grid2x2,
  MousePointer2,
  Navigation2,
  Square,
  Circle,
  PenTool,
  Type,
  Shapes,
  Pipette,
  Hand,
  ChevronDown,
  ChevronRight,
  Undo2,
  Redo2,
  ArrowUpRight,
  Minus,
  Plus,
  Scan,
  SlidersHorizontal,
  RotateCw,
  Blend,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  Copy,
  Frame,
  Combine,
  CircleHelp,
  X,
  FilePlus2,
  Download,
  FolderOpen,
  RotateCcw,
  Keyboard,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Spline,
  Search,
  ArrowRight,
  ArrowDown,
  Columns2,
  MoveHorizontal,
  MoveVertical,
  Shrink,
  Maximize2,
};
const $ = (id) => document.getElementById(id);
const svg = $("canvas"),
  viewport = $("viewport"),
  objectLayer = $("objects"),
  overlay = $("canvas-overlays");
const NS = "http://www.w3.org/2000/svg";
let lastCanvasTap = null,
  altKeyIsDown = false,
  hoverTargetId = null,
  layerStructure = "",
  toastTimer,
  textEditor,
  draggedLayer,
  pendingColor = false,
  hsv = { h: 220, s: 1, v: 1 },
  builderHover = -1,
  rendering = false;
function el(tag, attrs = {}, text) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs))
    if (value !== undefined) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}
function icon(name) {
  const i = document.createElement("i");
  i.dataset.lucide = name;
  return i;
}
function refreshIcons() {
  createIcons({ icons, attrs: { "aria-hidden": "true" } });
}
function toast(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $("toast").hidden = true;
  }, 3300);
}
function save() {
  syncActivePage();
  state.doc.objects.filter(o => o.frameId === undefined).forEach(assignFrame);
  applyAllAutoLayouts();
  const saved = commit();
  $("save-status").lastElementChild.textContent = saved
    ? "All changes saved"
    : "Browser storage full · save a file";
  render();
}
function transaction(fn) {
  begin();
  fn();
  save();
}
function updateInput(id, value) {
  if (document.activeElement !== $(id)) $(id).value = value;
}
function screenPoint(event) {
  const r = svg.getBoundingClientRect();
  return { x: event.clientX - r.left, y: event.clientY - r.top };
}
function worldPoint(event) {
  const p = screenPoint(event);
  return {
    x: (p.x - state.pan.x) / state.zoom,
    y: (p.y - state.pan.y) / state.zoom,
  };
}
function getObject(id) {
  return state.doc.objects.find((o) => o.id === id);
}
function pickObject(event) {
  const node = event.target.closest("[data-object]");
  return node ? getObject(node.dataset.object) : null;
}
function canvasColor() {
  const page = state.doc?.pages?.find((p) => p.id === state.doc.activePageId);
  return page?.canvasColor || state.doc?.canvasColor || "#090909";
}
function updateCanvasBackground(color = canvasColor()) {
  const c = color === "none" ? "#090909" : color;
  document.documentElement.style.setProperty("--canvas-void", c);
  if ($("canvas-container")) $("canvas-container").style.backgroundColor = c;
}
function eyedropperColor(event) {
  const object = pickObject(event);
  if (object) {
    if (object.fill !== "none") return object.fill;
    if (object.stroke !== "none" && object.strokeWidth > 0)
      return object.stroke;
  }
  const point = worldPoint(event),
    board = [...pageFrames()].reverse().find(f => point.x >= f.x && point.y >= f.y && point.x <= f.x + f.width && point.y <= f.y + f.height);
  if (!board) return canvasColor();
  return point.x >= board.x &&
    point.y >= board.y &&
    point.x <= board.x + board.width &&
    point.y <= board.y + board.height &&
    board.fill !== "none"
    ? board.fill
    : canvasColor();
}
function updateEyedropperPreview(event) {
  const preview = $("eyedropper-preview");
  if (state.tool !== "eyedropper" || state.space || state.pointer) {
    preview.hidden = true;
    return;
  }
  const color = eyedropperColor(event);
  preview.hidden = false;
  $("eyedropper-swatch").style.background = color || "#262626";
  $("eyedropper-swatch").style.color =
    color && hexToRgb(color).reduce((sum, n) => sum + n, 0) > 420
      ? "#111"
      : "#fff";
  $("eyedropper-value").textContent = color ? color.toUpperCase() : "No color";
  $("eyedropper-caption").textContent = color
    ? `Click to apply to ${state.paint}`
    : "Move over artwork";
  const width = preview.offsetWidth,
    height = preview.offsetHeight;
  preview.style.left = `${clamp(event.clientX + 20, 8, window.innerWidth - width - 8)}px`;
  preview.style.top = `${event.clientY + 24 + height > window.innerHeight - 8 ? event.clientY - height - 16 : event.clientY + 24}px`;
}
function transform(obj) {
  return `translate(${obj.x} ${obj.y}) rotate(${obj.rotation} ${obj.w / 2} ${obj.h / 2})`;
}
function measureText(obj) {
  const canvas = document.createElement("canvas"),
    ctx = canvas.getContext("2d");
  ctx.font = `${obj.fontWeight} ${obj.fontSize}px ${obj.fontFamily === "monospace" ? "monospace" : JSON.stringify(obj.fontFamily)}`;
  const lines = obj.text.split("\n");
  const width = Math.max(
    1,
    ...lines.map(
      (t) =>
        ctx.measureText(t).width +
        Math.max(0, t.length - 1) * (obj.letterSpacing || 0),
    ),
  );
  obj.w = obj.baseW = width;
  obj.h = obj.baseH = Math.max(
    1,
    lines.length * obj.fontSize * (obj.lineHeight || 1.16),
  );
}
function shapeElement(obj) {
  const style = {
    fill: obj.fill,
    stroke: obj.stroke,
    "stroke-width": obj.strokeWidth,
    "stroke-linejoin": "round",
    "stroke-linecap": "round",
    opacity: obj.opacity,
  };
  if (obj.type === "rect")
    return el("rect", {
      width: obj.w,
      height: obj.h,
      rx: obj.radius || 0,
      ...style,
    });
  if (obj.type === "ellipse")
    return el("ellipse", {
      cx: obj.w / 2,
      cy: obj.h / 2,
      rx: obj.w / 2,
      ry: obj.h / 2,
      ...style,
    });
  if (obj.type === "path")
    return el("path", {
      d: obj.d,
      transform: `scale(${obj.w / obj.baseW} ${obj.h / obj.baseH})`,
      "fill-rule": "evenodd",
      ...style,
    });
  const text = el("text", {
    "font-family": obj.fontFamily,
    "font-size": obj.fontSize,
    "font-weight": obj.fontWeight,
    "letter-spacing": obj.letterSpacing || 0,
    transform: `scale(${obj.w / obj.baseW} ${obj.h / obj.baseH})`,
    ...style,
  });
  obj.text
    .split("\n")
    .forEach((line, i) =>
      text.append(
        el(
          "tspan",
          { x: 0, y: obj.fontSize * (0.84 + i * (obj.lineHeight || 1.16)) },
          line || " ",
        ),
      ),
    );
  return text;
}
function pageFrames() {
  const page = state.doc.pages.find(p => p.id === state.doc.activePageId);
  if (!page.artboards) preparePages(state.doc);
  return page.artboards;
}
function frameContents(frame) {
  return state.doc.objects.filter(o => o.frameId === frame.id);
}
function assignFrame(object) {
  const b = objectBounds(object);
  const frame = [...pageFrames()].sort((a,b) => frameAncestors(b).length-frameAncestors(a).length || a.width*a.height-b.width*b.height).find(f => b.x + b.w / 2 >= f.x && b.y + b.h / 2 >= f.y && b.x + b.w / 2 <= f.x + f.width && b.y + b.h / 2 <= f.y + f.height);
  object.frameId = frame?.id || null;
}
function frameAncestors(frame) {
  const result = [], seen = new Set([frame.id]);
  let parent = pageFrames().find(f => f.id === frame.parentId);
  while (parent && !seen.has(parent.id)) {
    result.push(parent); seen.add(parent.id); parent = pageFrames().find(f => f.id === parent.parentId);
  }
  return result;
}
function frameSubtree(frame) {
  return pageFrames().filter(f => f.id === frame.id || frameAncestors(f).some(p => p.id === frame.id));
}
function moveFrame(frame, x, y) {
  const dx = x - frame.x, dy = y - frame.y;
  const frames = frameSubtree(frame), ids = new Set(frames.map(f => f.id));
  state.doc.objects.filter(o => ids.has(o.frameId)).forEach(o => { o.x += dx; o.y += dy; });
  frames.forEach(f => { f.x += dx; f.y += dy; });
}
function duplicateFrame(original, offset = original.width + 100) {
  const frames = frameSubtree(original), ids = new Map(frames.map(f => [f.id, crypto.randomUUID()]));
  const copies = frames.map(f => ({...clone(f), id:ids.get(f.id), parentId:ids.get(f.parentId) || f.parentId || null, x:f.x + offset, name:`${f.name} copy`}));
  const objectCopies = state.doc.objects.filter(o => ids.has(o.frameId)).map(o => {
    const id = crypto.randomUUID(); ids.set(o.id, id);
    return {...clone(o), id, frameId:ids.get(o.frameId), x:o.x+offset};
  });
  copies.forEach(f => { if (f.autoLayout?.childOrder) f.autoLayout.childOrder = f.autoLayout.childOrder.map(id => ids.get(id)).filter(Boolean); });
  state.doc.objects.push(...objectCopies);
  pageFrames().push(...copies); return copies[0];
}
function assignFrameParent(frame) {
  const excluded = new Set(frameSubtree(frame).map(f => f.id));
  const parent = [...pageFrames()].filter(f => !excluded.has(f.id) && frame.x >= f.x && frame.y >= f.y && frame.x + frame.width <= f.x + f.width && frame.y + frame.height <= f.y + f.height).sort((a,b) => a.width*a.height-b.width*b.height)[0];
  frame.parentId = parent?.id || null;
}
function layoutChildren(frame) {
  const children = [...frameContents(frame).filter(o => o.visible), ...pageFrames().filter(f => f.parentId === frame.id)];
  const order = frame.autoLayout?.childOrder || [];
  const ranks = new Map(children.map((child,i) => [child.id, order.includes(child.id) ? order.indexOf(child.id) : order.length+i]));
  return children.sort((a,b) => ranks.get(a.id)-ranks.get(b.id));

}
function placeLayoutChild(frame, id, targetId = null, after = true) {
  if (!frame?.autoLayout?.enabled) return;
  const order = layoutChildren(frame).map(o => o.id).filter(item => item !== id);
  const index = order.indexOf(targetId);
  order.splice(index < 0 ? order.length : index + (after ? 1 : 0), 0, id);
  frame.autoLayout.childOrder = order;
}
function layoutBounds(child) {
  return child.width !== undefined ? {x:child.x,y:child.y,w:child.width,h:child.height} : objectBounds(child);
}
function shiftLayoutChild(child, dx, dy) {
  if (child.width !== undefined) moveFrame(child, child.x + dx, child.y + dy);
  else { child.x += dx; child.y += dy; }
}
function frameClipBounds(frame, includeSelf = true) {
  let x = -1e7, y = -1e7, right = 1e7, bottom = 1e7;
  for (const f of [...(includeSelf ? [frame] : []), ...frameAncestors(frame)].filter(f => f.clipContent !== false)) {
    x = Math.max(x,f.x); y = Math.max(y,f.y); right = Math.min(right,f.x+f.width); bottom = Math.min(bottom,f.y+f.height);
  }
  return {x,y,width:Math.max(0,right-x),height:Math.max(0,bottom-y)};
}
function activateFrame(id) {
  const frame = pageFrames().find(f => f.id === id);
  if (!frame) return;
  state.doc.artboard = frame;
  syncActivePage();
  selectArtboard();
}
function nextFrameName() {
  const frames = pageFrames();
  const usesArtboard = frames.some(f => f.name.toLowerCase().startsWith("artboard"));
  const prefix = "Frame";
  let number = 1;
  while (frames.some(f => f.name === `${prefix} ${number}`)) number++;
  return `${prefix} ${number}`;
}
function addFrame() {
  finishPageEditing();
  transaction(() => {
    const frames = pageFrames();
    if (frames.length >= 100) return;
    const current = state.doc.artboard;
    const name = nextFrameName();
    const frame = {id: crypto.randomUUID(), name, x: Math.max(...frames.map(f => f.x + f.width)) + 100, y: current.y, width: current.width, height: current.height, fill: current.fill, clipContent: true};
    frames.push(frame); state.doc.artboard = frame; state.selected = ["__artboard__"];
  });
  setTool("select"); fitCanvas();
}
$("add-artboard").addEventListener("click", addFrame);
const artboardSelected = () => state.selected.includes("__artboard__");
const artboardName = () => state.doc.artboard.name || "Frame 1";
let lastArtboardClick = 0;
function selectArtboard() {
  setTool("select");
  state.selected = ["__artboard__"];
  state.paint = "fill";
  render();
}
function renameArtboard() {
  if (document.querySelector(".artboard-name-editor")) return;
  const input = document.createElement("input");
  input.className = "artboard-name-editor";
  input.setAttribute("aria-label", "Frame name");
  input.setAttribute("title", "Frame name");
  input.value = artboardName();
  input.maxLength = 100;
  const rect = $("artboard-label").getBoundingClientRect();
  input.style.left = `${rect.left}px`;
  input.style.top = `${rect.top - 4}px`;
  document.body.append(input);
  let done = false;
  const finish = (saveName) => {
    if (done) return;
    done = true;
    const name = input.value.trim();
    input.remove();
    if (saveName && name && name !== artboardName())
      transaction(() => {
        state.doc.artboard.name = name;
      });
    svg.focus({ preventScroll: true });
  };
  input.addEventListener("blur", () => finish(true));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();
      finish(e.key === "Enter");
    }
  });
  input.focus();
  input.select();
}
function parseAlign(align = "top-left") {
  let valign = "top", halign = "left";
  if (align.includes("top")) valign = "top";
  else if (align.includes("bottom")) valign = "bottom";
  else valign = "center";

  if (align.includes("left")) halign = "left";
  else if (align.includes("right")) halign = "right";
  else halign = "center";

  return { valign, halign };
}
function applyAutoLayout(frame) {
  if (!frame || !frame.autoLayout || !frame.autoLayout.enabled) return;
  const al = frame.autoLayout;
  const direction = al.direction || "horizontal";
  const gap = Math.max(0, Number(al.gap) || 0);
  const paddingX = Math.max(0, Number(al.paddingX) || 0);
  const paddingY = Math.max(0, Number(al.paddingY) || 0);
  const align = al.align || "top-left";
  const sizing = al.sizing || "hug";

  const contents = layoutChildren(frame);
  const hugWidth = (al.widthSizing || sizing) === "hug";
  const hugHeight = (al.heightSizing || sizing) === "hug";
  if (!contents.length) {
    if (hugWidth) frame.width = Math.max(1, paddingX * 2);
    if (hugHeight) frame.height = Math.max(1, paddingY * 2);
    return;
  }

  // Resolve fill against a fixed parent axis before positioning children.
  const sizingOf = (child, axis) => child.width !== undefined ? child.autoLayout?.[`${axis}Sizing`] : child[`${axis}Sizing`];
  for (const axis of ["width", "height"]) {
    const horizontal = axis === "width", main = horizontal === (direction === "horizontal");
    if (horizontal ? hugWidth : hugHeight) continue;
    const padding = horizontal ? paddingX : paddingY;
    const fillers = contents.filter(child => sizingOf(child, axis) === "fill");
    const available = Math.max(1, frame[axis] - padding * 2);
    const occupied = main ? contents.filter(child => sizingOf(child,axis) !== "fill").reduce((sum,child) => sum + layoutBounds(child)[horizontal ? "w" : "h"], 0) + Math.max(0,contents.length-1)*gap : 0;
    for (const child of fillers) {
      const size = Math.max(1, (available-occupied) / (main ? fillers.length : 1));
      if (child.width !== undefined) child[axis] = size;
      else child[horizontal ? "w" : "h"] = size;
    }
  }
  const { valign, halign } = parseAlign(align);
  const boundsList = contents.map(layoutBounds);

  if (direction === "horizontal") {
    const totalChildW = boundsList.reduce((sum, b) => sum + b.w, 0);
    const totalGaps = (contents.length - 1) * gap;
    const contentW = totalChildW + totalGaps;
    const maxChildH = Math.max(...boundsList.map(b => b.h), 0);

    if (hugWidth) frame.width = Math.max(1, contentW + paddingX * 2);
    if (hugHeight) frame.height = Math.max(1, maxChildH + paddingY * 2);

    const availW = frame.width - paddingX * 2;
    const availH = frame.height - paddingY * 2;

    let startX = frame.x + paddingX;
    if (halign === "center") {
      startX = frame.x + paddingX + Math.max(0, (availW - contentW) / 2);
    } else if (halign === "right") {
      startX = frame.x + frame.width - paddingX - contentW;
    }

    let currX = startX;
    contents.forEach((child, i) => {
      const b = boundsList[i];
      let targetY = frame.y + paddingY;
      if (valign === "center") {
        targetY = frame.y + paddingY + (availH - b.h) / 2;
      } else if (valign === "bottom") {
        targetY = frame.y + frame.height - paddingY - b.h;
      }

      const dx = currX - b.x;
      const dy = targetY - b.y;
      shiftLayoutChild(child, dx, dy);
      currX += b.w + gap;
    });
  } else {
    const totalChildH = boundsList.reduce((sum, b) => sum + b.h, 0);
    const totalGaps = (contents.length - 1) * gap;
    const contentH = totalChildH + totalGaps;
    const maxChildW = Math.max(...boundsList.map(b => b.w), 0);

    if (hugWidth) frame.width = Math.max(1, maxChildW + paddingX * 2);
    if (hugHeight) frame.height = Math.max(1, contentH + paddingY * 2);

    const availW = frame.width - paddingX * 2;
    const availH = frame.height - paddingY * 2;

    let startY = frame.y + paddingY;
    if (valign === "center") {
      startY = frame.y + paddingY + Math.max(0, (availH - contentH) / 2);
    } else if (valign === "bottom") {
      startY = frame.y + frame.height - paddingY - contentH;
    }

    let currY = startY;
    contents.forEach((child, i) => {
      const b = boundsList[i];
      let targetX = frame.x + paddingX;
      if (halign === "center") {
        targetX = frame.x + paddingX + (availW - b.w) / 2;
      } else if (halign === "right") {
        targetX = frame.x + frame.width - paddingX - b.w;
      }

      const dx = targetX - b.x;
      const dy = currY - b.y;
      shiftLayoutChild(child, dx, dy);
      currY += b.h + gap;
    });
  }
}
function applyAllAutoLayouts() {
  const frames = [...pageFrames()].sort((a,b) => frameAncestors(b).length-frameAncestors(a).length);
  frames.forEach(applyAutoLayout);
  [...frames].reverse().forEach(applyAutoLayout);
}
function reorderAutoLayoutChildren(frame) {
  if (!frame?.autoLayout?.enabled) return;
  const contents = layoutChildren(frame);
  if (contents.length <= 1) return;
  const isHoriz = (frame.autoLayout.direction || "horizontal") === "horizontal";
  const sorted = [...contents].sort((a, b) => isHoriz ? a.x - b.x : a.y - b.y);
  frame.autoLayout.childOrder = sorted.map(o => o.id);
  const ids = new Set(sorted.map(o => o.id));
  const sortedObjects = sorted.filter(o => o.width === undefined);
  const firstIndex = state.doc.objects.findIndex(o => ids.has(o.id));
  if (firstIndex >= 0) {
    state.doc.objects = state.doc.objects.filter(o => !ids.has(o.id));
    state.doc.objects.splice(firstIndex, 0, ...sortedObjects);
  }
}
function enableAutoLayout(frame) {
  if (!frame) return;
  transaction(() => {
    const contents = frameContents(frame);
    let direction = frame.autoLayout?.direction || "horizontal";
    if (!frame.autoLayout && contents.length >= 2) {
      const minX = Math.min(...contents.map(o => o.x));
      const maxX = Math.max(...contents.map(o => o.x));
      const minY = Math.min(...contents.map(o => o.y));
      const maxY = Math.max(...contents.map(o => o.y));
      if ((maxY - minY) > (maxX - minX)) {
        direction = "vertical";
      }
    }
    const sorted = [...contents].sort((a, b) => {
      return direction === "horizontal" ? a.x - b.x : a.y - b.y;
    });
    const sortedIds = new Set(sorted.map(o => o.id));
    const firstIdx = state.doc.objects.findIndex(o => sortedIds.has(o.id));
    if (firstIdx >= 0) {
      state.doc.objects = state.doc.objects.filter(o => !sortedIds.has(o.id));
      state.doc.objects.splice(firstIdx, 0, ...sorted);
    }
    frame.autoLayout = {
      enabled: true,
      direction,
      gap: frame.autoLayout?.gap ?? 16,
      paddingX: frame.autoLayout?.paddingX ?? 16,
      paddingY: frame.autoLayout?.paddingY ?? 16,
      align: frame.autoLayout?.align || "top-left",
      sizing: frame.autoLayout?.sizing || "hug",
    };
    applyAutoLayout(frame);
  });
  toast("Added auto layout");
}
function removeAutoLayout(frame) {
  if (!frame || !frame.autoLayout) return;
  transaction(() => {
    frame.autoLayout.enabled = false;
  });
  toast("Removed auto layout");
}
function groupSelection() {
  const objs = selectedObjects();
  if (objs.length < 2) return;
  finishPageEditing();
  transaction(() => {
    const groupId = crypto.randomUUID();
    objs.forEach(o => o.groupId = groupId);
    const sortedIds = new Set(objs.map(o => o.id));
    const firstIdx = state.doc.objects.findIndex(o => sortedIds.has(o.id));
    state.doc.objects = state.doc.objects.filter(o => !sortedIds.has(o.id));
    state.doc.objects.splice(Math.max(0, firstIdx), 0, ...objs);
  });
  render();
  toast("Grouped selection");
}
function ungroupSelection() {
  const objs = selectedObjects();
  const groupIds = new Set(objs.filter(o => o.groupId).map(o => o.groupId));
  if (groupIds.size === 0) return;
  finishPageEditing();
  transaction(() => {
    state.doc.objects.forEach(o => {
      if (groupIds.has(o.groupId)) delete o.groupId;
    });
  });
  render();
  toast("Ungrouped");
}
function wrapSelectionInAutoLayout() {
  const objs = selectedObjects();
  if (!objs.length) return;
  finishPageEditing();
  transaction(() => {
    const b = boundsOf(objs);
    const pad = 16;
    const gap = 16;
    let direction = "horizontal";
    if (objs.length >= 2) {
      const minX = Math.min(...objs.map(o => o.x));
      const maxX = Math.max(...objs.map(o => o.x));
      const minY = Math.min(...objs.map(o => o.y));
      const maxY = Math.max(...objs.map(o => o.y));
      if ((maxY - minY) > (maxX - minX)) {
        direction = "vertical";
      }
    }
    const sorted = [...objs].sort((a, b) => {
      return direction === "horizontal" ? a.x - b.x : a.y - b.y;
    });
    const frame = {
      id: crypto.randomUUID(),
      name: nextFrameName(),
      parentId: objs.every(o => o.frameId === objs[0].frameId) ? objs[0].frameId : null,
      x: b.x - pad,
      y: b.y - pad,
      width: b.w + pad * 2,
      height: b.h + pad * 2,
      fill: "#ffffff",
      clipContent: true,
      autoLayout: {
        enabled: true,
        direction,
        gap,
        paddingX: pad,
        paddingY: pad,
        align: "top-left",
        sizing: "hug",
      },
    };
    const sortedIds = new Set(sorted.map(o => o.id));
    const firstIdx = state.doc.objects.findIndex(o => sortedIds.has(o.id));
    state.doc.objects = state.doc.objects.filter(o => !sortedIds.has(o.id));
    state.doc.objects.splice(Math.max(0, firstIdx), 0, ...sorted);
    sorted.forEach((o) => { o.frameId = frame.id; });
    pageFrames().push(frame);
    state.doc.artboard = frame;
    state.selected = ["__artboard__"];
    applyAutoLayout(frame);
  });
  setTool("select");
  toast("Added auto layout");
}
function createFilterElement(id, effects, rotation = 0) {
  const visible = (effects || []).filter((e) => e && e.visible !== false);
  if (!visible.length) return null;

  const filter = el("filter", {
    id,
    x: "-100%",
    y: "-100%",
    width: "300%",
    height: "300%",
  });

  const layerBlur = visible.find((e) => e.type === "layer-blur");
  let graphicSource = "SourceGraphic";
  if (layerBlur) {
    const stdDev = Math.max(0.01, (layerBlur.blur || 0) / 2);
    filter.append(
      el("feGaussianBlur", {
        in: "SourceGraphic",
        stdDeviation: stdDev,
        result: "blurred_graphic",
      }),
    );
    graphicSource = "blurred_graphic";
  }

  const dropShadows = visible.filter((e) => e.type === "drop-shadow");
  const innerShadows = visible.filter((e) => e.type === "inner-shadow");

  dropShadows.forEach((eff, i) => {
    const rot = rotatePoint({ x: eff.x ?? 0, y: eff.y ?? 4 }, -rotation);
    const dx = round(rot.x);
    const dy = round(rot.y);
    const blurStd = Math.max(0.01, (eff.blur ?? 4) / 2);
    const spread = eff.spread ?? 0;
    const color = eff.color || "#000000";
    const opacity = eff.opacity ?? 0.25;

    let alphaIn = "SourceAlpha";
    if (spread !== 0) {
      const morphRes = `spread_morph_${i}`;
      filter.append(
        el("feMorphology", {
          in: "SourceAlpha",
          operator: spread > 0 ? "dilate" : "erode",
          radius: Math.abs(spread),
          result: morphRes,
        }),
      );
      alphaIn = morphRes;
    }

    const blurRes = `drop_blur_${i}`;
    filter.append(
      el("feGaussianBlur", {
        in: alphaIn,
        stdDeviation: blurStd,
        result: blurRes,
      }),
    );

    const offsetRes = `drop_offset_${i}`;
    filter.append(
      el("feOffset", {
        in: blurRes,
        dx,
        dy,
        result: offsetRes,
      }),
    );

    const floodRes = `drop_flood_${i}`;
    filter.append(
      el("feFlood", {
        "flood-color": color,
        "flood-opacity": opacity,
        result: floodRes,
      }),
    );

    const compRes = `drop_shadow_${i}`;
    filter.append(
      el("feComposite", {
        in: floodRes,
        in2: offsetRes,
        operator: "in",
        result: compRes,
      }),
    );
  });

  innerShadows.forEach((eff, i) => {
    const rot = rotatePoint({ x: eff.x ?? 0, y: eff.y ?? 4 }, -rotation);
    const dx = round(rot.x);
    const dy = round(rot.y);
    const blurStd = Math.max(0.01, (eff.blur ?? 4) / 2);
    const spread = eff.spread ?? 0;
    const color = eff.color || "#000000";
    const opacity = eff.opacity ?? 0.25;

    let inAlpha = "SourceAlpha";
    if (spread !== 0) {
      const morphRes = `in_spread_morph_${i}`;
      filter.append(
        el("feMorphology", {
          in: "SourceAlpha",
          operator: spread < 0 ? "dilate" : "erode",
          radius: Math.abs(spread),
          result: morphRes,
        }),
      );
      inAlpha = morphRes;
    }

    const offsetRes = `in_offset_${i}`;
    filter.append(
      el("feOffset", {
        in: inAlpha,
        dx,
        dy,
        result: offsetRes,
      }),
    );

    const blurRes = `in_blur_${i}`;
    filter.append(
      el("feGaussianBlur", {
        in: offsetRes,
        stdDeviation: blurStd,
        result: blurRes,
      }),
    );

    const invRes = `in_inv_${i}`;
    filter.append(
      el("feComposite", {
        in: "SourceAlpha",
        in2: blurRes,
        operator: "out",
        result: invRes,
      }),
    );

    const floodRes = `in_flood_${i}`;
    filter.append(
      el("feFlood", {
        "flood-color": color,
        "flood-opacity": opacity,
        result: floodRes,
      }),
    );

    const shadowRes = `inner_shadow_${i}`;
    filter.append(
      el("feComposite", {
        in: floodRes,
        in2: invRes,
        operator: "in",
        result: shadowRes,
      }),
    );
  });

  if (!layerBlur && !dropShadows.length && !innerShadows.length) {
    return null;
  }

  const merge = el("feMerge");
  dropShadows.forEach((_, i) => {
    merge.append(el("feMergeNode", { in: `drop_shadow_${i}` }));
  });
  merge.append(el("feMergeNode", { in: graphicSource }));
  innerShadows.forEach((_, i) => {
    merge.append(el("feMergeNode", { in: `inner_shadow_${i}` }));
  });
  filter.append(merge);

  return filter;
}
function renderObjects() {
  const defs = $("frame-clips");
  defs.replaceChildren();
  pageFrames().forEach((f, i) => {
    const clip = el("clipPath", {
      id: `frame-clip-${i}`,
      clipPathUnits: "userSpaceOnUse",
    });
    clip.append(el("rect", frameClipBounds(f)));
    defs.append(clip);
    const parentClip = el("clipPath", {id:`frame-parent-clip-${i}`,clipPathUnits:"userSpaceOnUse"});
    parentClip.append(el("rect", frameClipBounds(f, false))); defs.append(parentClip);
  });
  const filterDefs = $("effect-filters");
  if (filterDefs) filterDefs.replaceChildren();

  const existing = new Map(
    [...objectLayer.children].map((node) => [node.dataset.object, node]),
  );
  let index = 0;
  for (const obj of state.doc.objects) {
    if (!obj.visible) continue;
    if (filterDefs) {
      const filterEl = createFilterElement(
        `effect-filter-${obj.id}`,
        obj.effects,
        obj.rotation,
      );
      if (filterEl) filterDefs.append(filterEl);
    }
    const signature = JSON.stringify(obj);
    let group = existing.get(obj.id);
    if (!group || group._signature !== signature) {
      const replacement = el("g", {
        "data-object": obj.id,
        class: `canvas-object${obj.locked ? " locked" : ""}`,
      });
      const hasVisibleEffects = (obj.effects || []).some(
        (e) => e && e.visible !== false && e.type !== "background-blur",
      );
      const content = el("g", {
        transform: transform(obj),
        ...(hasVisibleEffects
          ? { filter: `url(#effect-filter-${obj.id})` }
          : {}),
      });
      const bgBlur = (obj.effects || []).find(
        (e) => e && e.visible !== false && e.type === "background-blur",
      );
      if (bgBlur) {
        content.style.backdropFilter = `blur(${bgBlur.blur}px)`;
        content.style.webkitBackdropFilter = `blur(${bgBlur.blur}px)`;
      }
      replacement.append(content);
      content.append(shapeElement(obj));
      // A screen-space hit stroke makes thin and zoomed-out paths easy to pick.
      // This is editor-only geometry; exports still use the original artwork.
      if (
        obj.type !== "text" &&
        (obj.fill !== "none" || (obj.stroke !== "none" && obj.strokeWidth > 0))
      ) {
        const hit = shapeElement(obj);
        hit.setAttribute("fill", "none");
        hit.setAttribute("stroke", "transparent");
        hit.setAttribute("stroke-width", "12");
        hit.setAttribute("vector-effect", "non-scaling-stroke");
        hit.setAttribute("opacity", "1");
        hit.setAttribute("class", "object-hit-stroke");
        hit.setAttribute("aria-hidden", "true");
        content.append(hit);
      }
      if (obj.type === "text" && !obj.locked)
        content.append(
          el("rect", {
            width: obj.w,
            height: obj.h,
            fill: "transparent",
            "data-text-hit": obj.id,
          }),
        );
      replacement._signature = signature;
      if (group) group.replaceWith(replacement);
      group = replacement;
    }
    if (objectLayer.children[index] !== group)
      objectLayer.insertBefore(group, objectLayer.children[index] || null);
    const frameIndex = pageFrames().findIndex((f) => f.id === obj.frameId);
    if (frameIndex >= 0)
      group.setAttribute("clip-path", `url(#frame-clip-${frameIndex})`);
    else group.removeAttribute("clip-path");
    group.style.visibility = textEditor?.obj.id === obj.id ? "hidden" : "";
    existing.delete(obj.id);
    index++;
  }
  existing.forEach((node) => node.remove());
  $("artboard").setAttribute("x", state.doc.artboard.x);
  $("artboard").setAttribute("y", state.doc.artboard.y);
  $("artboard").setAttribute("width", state.doc.artboard.width);
  $("artboard").setAttribute("height", state.doc.artboard.height);
  $("artboard").setAttribute("fill", state.doc.artboard.fill);
  if (filterDefs) {
    const artboardFilter = createFilterElement(
      `effect-filter-${state.doc.artboard.id}`,
      state.doc.artboard.effects,
      0,
    );
    if (artboardFilter) filterDefs.append(artboardFilter);
    if (artboardFilter) {
      $("artboard").setAttribute(
        "filter",
        `url(#effect-filter-${state.doc.artboard.id})`,
      );
      $("artboard").style.filter = "none";
    } else {
      $("artboard").removeAttribute("filter");
      $("artboard").style.filter = "";
    }
    const frameBgBlur = (state.doc.artboard.effects || []).find(
      (e) => e && e.visible !== false && e.type === "background-blur",
    );
    if (frameBgBlur) {
      $("artboard").style.backdropFilter = `blur(${frameBgBlur.blur}px)`;
      $("artboard").style.webkitBackdropFilter = `blur(${frameBgBlur.blur}px)`;
    } else {
      $("artboard").style.backdropFilter = "";
      $("artboard").style.webkitBackdropFilter = "";
    }
  }
  $("artboard-label").textContent = artboardName();
  $("artboard-tree").querySelector("span").textContent = artboardName();
}
let pixelGridVisible = localStorage.getItem("illigma.pixel-grid") === "true";
function renderView() {
  const frames = pageFrames(),
    active = state.doc.artboard;
  // Filled strips avoid SVG pattern strokes scaling into thick tiles.
  const line = 1 / state.zoom;
  $("pixel-grid-lines").setAttribute("d", `M0 0H1V${line}H${line}V1H0Z`);
  const grids = $("extra-pixel-grids");
  grids.replaceChildren();
  const extras = $("extra-artboards");
  const activeRect = $("artboard");
  activeRect.remove();
  extras.replaceChildren();
  const filterDefs = $("effect-filters");
  [...frames].sort((a,b) => frameAncestors(a).length-frameAncestors(b).length).forEach((frame) => {
      if (frame.id === active.id) { activeRect.setAttribute("clip-path", `url(#frame-parent-clip-${frames.indexOf(frame)})`); extras.append(activeRect); return; }
      if (filterDefs) {
        const extraFilter = createFilterElement(
          `effect-filter-${frame.id}`,
          frame.effects,
          0,
        );
        if (extraFilter) filterDefs.append(extraFilter);
      }
      const hasFrameEffects = (frame.effects || []).some(
        (e) => e && e.visible !== false && e.type !== "background-blur",
      );
      const frameBgBlur = (frame.effects || []).find(
        (e) => e && e.visible !== false && e.type === "background-blur",
      );
      const frameRect = el("rect", {
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
        fill: frame.fill,
        "data-frame-background": frame.id,
        ...(hasFrameEffects ? { filter: `url(#effect-filter-${frame.id})` } : {}),
      });
      if (frameBgBlur) {
        frameRect.style.backdropFilter = `blur(${frameBgBlur.blur}px)`;
        frameRect.style.webkitBackdropFilter = `blur(${frameBgBlur.blur}px)`;
      }
      frameRect.setAttribute("clip-path", `url(#frame-parent-clip-${frames.indexOf(frame)})`);
      extras.append(frameRect);
    extras.append(el("text", {x: 0, y: -18, transform: `translate(${frame.x} ${frame.y}) scale(${1 / state.zoom})`, fill: "#999999", "font-size": 12, "font-family": "Inter", "data-frame-label": frame.id, role: "button", tabindex: 0}, frame.name));
    if (pixelGridVisible && state.zoom >= 4) grids.append(el("rect", {x: frame.x, y: frame.y, width: frame.width, height: frame.height, fill: "url(#pixel-grid-pattern)", "pointer-events": "none"}));
  });
  $("artboard-label").dataset.frameLabel = active.id;
  $("artboard").dataset.frameBackground = active.id;
  const grid = $("pixel-grid");
  grid.setAttribute("x", active.x);
  grid.setAttribute("y", active.y);
  grid.setAttribute("width", state.doc.artboard.width);
  grid.setAttribute("height", state.doc.artboard.height);
  grid.setAttribute("display", pixelGridVisible && state.zoom >= 4 ? "inline" : "none");
  $("toggle-pixel-grid").setAttribute("aria-pressed", String(pixelGridVisible));
  $("toggle-pixel-grid").title = pixelGridVisible
    ? "Hide pixel grid (visible at 400% zoom and above)"
    : "Show pixel grid (visible at 400% zoom and above)";
  $("artboard-label").setAttribute("transform", `translate(${active.x} ${active.y}) scale(${1 / state.zoom})`);
  $("artboard-label").setAttribute(
    "fill",
    artboardSelected() ? "#0099ff" : "#999999",
  );
  $("artboard-label").setAttribute("aria-label", `Select ${artboardName()}`);
  $("artboard-tree").classList.toggle("selected", artboardSelected());
  viewport.setAttribute(
    "transform",
    `translate(${state.pan.x} ${state.pan.y}) scale(${state.zoom})`,
  );
  $("zoom-value").textContent = `${Math.round(state.zoom * 100)}%`;
  $("dot-grid").setAttribute(
    "patternTransform",
    `translate(${state.pan.x % (24 * state.zoom)} ${state.pan.y % (24 * state.zoom)}) scale(${state.zoom})`,
  );
}
// Draft pen geometry is updated synchronously; visual feedback is coalesced per frame.
let penHover = null;
let penFrame = 0;
let penRedo = [];
function schedulePenPreview() {
  if (penFrame) return;
  penFrame = requestAnimationFrame(() => {
    penFrame = 0;
    renderSelection();
  });
}
function penPosition(event) {
  const point = worldPoint(event),
    last = state.pen.at(-1);
  if (event.shiftKey && last && !state.pointer) {
    const dx = point.x - last.x,
      dy = point.y - last.y;
    const angle =
      (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI) / 4;
    const distance = Math.hypot(dx, dy);
    return {
      x: last.x + Math.cos(angle) * distance,
      y: last.y + Math.sin(angle) * distance,
    };
  }
  return point;
}
function nearPenAnchor(point, anchor, pixels = 6) {
  return (
    anchor &&
    Math.hypot(point.x - anchor.x, point.y - anchor.y) * state.zoom <= pixels
  );
}
function updatePenGesture(event, gesture) {
  const point = worldPoint(event),
    p = gesture.point;
  let vector = { x: point.x - p.x, y: point.y - p.y };
  if (!gesture.dragged && Math.hypot(vector.x, vector.y) * state.zoom < 3)
    return;
  gesture.dragged = true;
  if (event.shiftKey) {
    const angle =
      (Math.round(Math.atan2(vector.y, vector.x) / (Math.PI / 4)) * Math.PI) /
      4;
    const length = Math.hypot(vector.x, vector.y);
    vector = { x: Math.cos(angle) * length, y: Math.sin(angle) * length };
  }
  if (gesture.closing) {
    p.in = { x: -vector.x, y: -vector.y };
  } else {
    p.out = vector;
    // Alt/Option breaks the tangent without disturbing the incoming curve.
    p.in = event.altKey
      ? { ...gesture.originalIn }
      : { x: -vector.x, y: -vector.y };
  }
  penHover = null;
}
function drawMeasureLine(x1, y1, x2, y2, val, group, z) {
  if (val <= 0.5) return;
  const d = Math.round(val);
  group.append(el("line", { x1, y1, x2, y2, stroke: "#ff3333", "stroke-width": 1/z, "pointer-events": "none" }));
  const midX = (x1 + x2)/2;
  const midY = (y1 + y2)/2;
  const g = el("g", { transform: `translate(${midX} ${midY}) scale(${1/z})`, "pointer-events": "none" });
  const text = el("text", { x: 0, y: 1, fill: "white", "font-size": "10px", "font-family": "Inter", "text-anchor": "middle", "dominant-baseline": "middle" });
  text.textContent = d;
  const w = d.toString().length * 6 + 8;
  const rect = el("rect", { fill: "#ff3333", rx: 3, ry: 3, x: -w/2, y: -7, width: w, height: 14 });
  g.append(rect, text);
  group.append(g);
}

function renderMeasurements(sb, hb, group, z) {
  group.append(el("rect", { x: hb.x, y: hb.y, width: hb.w, height: hb.h, fill: "none", stroke: "#ff3333", "stroke-width": 1/z, "pointer-events": "none" }));
  if (sb.x >= hb.x && sb.y >= hb.y && sb.x + sb.w <= hb.x + hb.w && sb.y + sb.h <= hb.y + hb.h) {
    drawMeasureLine(sb.x + sb.w/2, sb.y, sb.x + sb.w/2, hb.y, sb.y - hb.y, group, z);
    drawMeasureLine(sb.x + sb.w/2, sb.y + sb.h, sb.x + sb.w/2, hb.y + hb.h, (hb.y + hb.h) - (sb.y + sb.h), group, z);
    drawMeasureLine(sb.x, sb.y + sb.h/2, hb.x, sb.y + sb.h/2, sb.x - hb.x, group, z);
    drawMeasureLine(sb.x + sb.w, sb.y + sb.h/2, hb.x + hb.w, sb.y + sb.h/2, (hb.x + hb.w) - (sb.x + sb.w), group, z);
    return;
  }
  if (sb.y + sb.h < hb.y) drawMeasureLine(sb.x + sb.w/2, sb.y + sb.h, sb.x + sb.w/2, hb.y, hb.y - (sb.y + sb.h), group, z);
  else if (hb.y + hb.h < sb.y) drawMeasureLine(sb.x + sb.w/2, sb.y, sb.x + sb.w/2, hb.y + hb.h, sb.y - (hb.y + hb.h), group, z);
  if (sb.x + sb.w < hb.x) drawMeasureLine(sb.x + sb.w, sb.y + sb.h/2, hb.x, sb.y + sb.h/2, hb.x - (sb.x + sb.w), group, z);
  else if (hb.x + hb.w < sb.x) drawMeasureLine(sb.x, sb.y + sb.h/2, hb.x + hb.w, sb.y + sb.h/2, sb.x - (hb.x + hb.w), group, z);
}

function renderSelection() {
  overlay.replaceChildren();
  if (textEditor) return;
  if (artboardSelected()) {
    overlay.append(
      el("rect", {
        x: state.doc.artboard.x,
        y: state.doc.artboard.y,
        width: state.doc.artboard.width,
        height: state.doc.artboard.height,
        class: "selection-box",
        "data-artboard-selection": "true",
      }),
    );
    const f = state.doc.artboard, size = 7 / state.zoom;
    for (const [name, x, y] of [["nw",f.x,f.y],["ne",f.x+f.width,f.y],["se",f.x+f.width,f.y+f.height],["sw",f.x,f.y+f.height]]) overlay.append(el("rect", {x:x-size/2,y:y-size/2,width:size,height:size,fill:"#fff",stroke:"#0099ff","stroke-width":1/state.zoom,"data-frame-handle":name,style:`cursor:${name}-resize`}));
    return;
  }
  const objs = selectedObjects(),
    z = state.zoom;
  if (state.builder) {
    state.builder.regions.forEach((r, i) => {
      if (i !== builderHover && !state.builder.chosen?.has(i)) return;
      overlay.append(
        el("path", {
          d: r.path.pathData,
          fill: "url(#region-hatch)",
          stroke: "#0099ff",
          "stroke-width": 1 / z,
          "pointer-events": "none",
        }),
      );
    });
  }
  if (state.pen.length) {
    if (penHover && !state.pointer) {
      const closing =
        state.pen.length > 1 && nearPenAnchor(penHover, state.pen[0]);
      const next = closing ? state.pen[0] : { ...penHover, in: { x: 0, y: 0 } };
      overlay.append(
        el("path", {
          d: penData([state.pen.at(-1), next]),
          fill: "none",
          stroke: "#0099ff",
          "stroke-width": 1 / z,
          "stroke-opacity": 0.65,
          "pointer-events": "none",
          "data-pen-preview": "true",
        }),
      );
      if (closing)
        overlay.append(
          el("circle", {
            cx: next.x,
            cy: next.y,
            r: 8 / z,
            fill: "none",
            stroke: "#0099ff",
            "stroke-width": 1 / z,
            "pointer-events": "none",
            "data-pen-close": "true",
          }),
        );
    }
    overlay.append(
      el("path", {
        d: penData(state.pen),
        "data-pen-draft": "true",
        fill: "none",
        stroke: "#0099ff",
        "stroke-width": 1.5 / z,
        "pointer-events": "none",
      }),
    );
    state.pen.forEach((p, i) => {
      if (p.out)
        for (const side of ["in", "out"]) {
          const h = p[side];
          overlay.append(
            el("line", {
              x1: p.x,
              y1: p.y,
              x2: p.x + h.x,
              y2: p.y + h.y,
              class: "anchor-line",
            }),
          );
          overlay.append(
            el("circle", {
              cx: p.x + h.x,
              cy: p.y + h.y,
              r: 2.5 / z,
              class: "anchor-control",
            }),
          );
        }
      overlay.append(
        el("rect", {
          x: p.x - 3 / z,
          y: p.y - 3 / z,
          width: 6 / z,
          height: 6 / z,
          class: "anchor-point",
          "data-pen-start": i === 0 ? "true" : undefined,
          "data-pen-anchor": i,
          "pointer-events": "none",
        }),
      );
    });
  }
  if (state.pointer?.type === "marquee") {
    const { start, end } = state.pointer;
    overlay.append(
      el("rect", {
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y),
        class: "marquee",
        "pointer-events": "none",
      }),
    );
  }
  if (!objs.length || state.pen.length || state.tool === "builder") return;
  if (state.tool === "direct") {
    for (const obj of objs) {
      if (obj.type !== "path") continue;
      const p = localPath(obj),
        paths = p.children || [p];
      const group = el("g", { transform: transform(obj) });
      const sx = obj.w / obj.baseW,
        sy = obj.h / obj.baseH;
      group.append(
        el("path", {
          d: obj.d,
          transform: `scale(${sx} ${sy})`,
          class: "selection-box",
        }),
      );
      paths.forEach((path, pi) =>
        path.segments.forEach((seg, si) => {
          for (const side of ["handleIn", "handleOut"]) {
            const h = seg[side];
            if (h.length < 0.01) continue;
            group.append(
              el("line", {
                x1: seg.point.x * sx,
                y1: seg.point.y * sy,
                x2: (seg.point.x + h.x) * sx,
                y2: (seg.point.y + h.y) * sy,
                class: "anchor-line",
              }),
            );
            group.append(
              el("circle", {
                cx: (seg.point.x + h.x) * sx,
                cy: (seg.point.y + h.y) * sy,
                r: 3 / z,
                class: "anchor-control",
                "data-anchor": `${obj.id}:${pi}:${si}:${side}`,
              }),
            );
          }
          group.append(
            el("rect", {
              x: seg.point.x * sx - 3 / z,
              y: seg.point.y * sy - 3 / z,
              width: 6 / z,
              height: 6 / z,
              class: "anchor-point",
              "data-anchor": `${obj.id}:${pi}:${si}:point`,
            }),
          );
        }),
      );
      overlay.append(group);
      p.remove();
    }
    return;
  }
  const single = objs.length === 1,
    b = single ? objs[0] : boundsOf(objs);
  const group = el("g", {
    transform: single ? transform(b) : `translate(${b.x} ${b.y})`,
  });
  group.append(el("rect", { width: b.w, height: b.h, class: "selection-box" }));
  const positions = { nw: [0, 0], ne: [b.w, 0], se: [b.w, b.h], sw: [0, b.h] };
  const cursors = {
    nw: "nwse",
    se: "nwse",
    ne: "nesw",
    sw: "nesw",
    n: "ns",
    s: "ns",
    e: "ew",
    w: "ew",
  };
  for (const [name, [x, y]] of Object.entries(positions))
    group.append(
      el("rect", {
        x: x - 3 / z,
        y: y - 3 / z,
        width: 6 / z,
        height: 6 / z,
        class: "selection-handle",
        "data-handle": name,
        style: `cursor:${cursors[name]}-resize`,
      }),
    );
  const label = `${round(b.w)} × ${round(b.h)}`;
  const badgeWidth = label.length * 6.5 + 12;
  const badge = el("g", {
    transform: `translate(${b.w / 2} ${b.h + 8 / z}) scale(${1 / z})`,
    "pointer-events": "none",
    "data-size-badge": "true",
  });
  badge.append(
    el("rect", {
      x: -badgeWidth / 2,
      width: badgeWidth,
      height: 18,
      rx: 3,
      fill: "#0099ff",
    }),
  );
  badge.append(
    el(
      "text",
      {
        x: 0,
        y: 13,
        "text-anchor": "middle",
        "font-family": "Inter",
        "font-size": 11,
        "font-weight": 500,
        fill: "#ffffff",
      },
      label,
    ),
  );
  group.append(badge);
  overlay.append(group);

  if (altKeyIsDown && hoverTargetId && !state.selected.includes(hoverTargetId)) {
    let hb = null;
    if (hoverTargetId === "artboard" || (!hoverTargetId && artboardSelected() === false)) {
      hb = { x: state.doc.artboard.x, y: state.doc.artboard.y, w: state.doc.artboard.width, h: state.doc.artboard.height };
    } else {
      const hoverObj = getObject(hoverTargetId);
      if (hoverObj) hb = objectBounds(hoverObj);
    }
    if (hb) {
      const g = el("g");
      const sb = { x: b.x, y: b.y, w: b.w, h: b.h };
      renderMeasurements(sb, hb, g, state.zoom);
      overlay.append(g);
    }
  }
}
function renderProperties() {
  const objs = selectedObjects(),
    obj = objs[0],
    single = objs.length === 1,
    b = single
      ? obj
      : objs.length
        ? boundsOf(objs)
        : {
            x: state.doc.artboard.x,
            y: state.doc.artboard.y,
            w: state.doc.artboard.width,
            h: state.doc.artboard.height,
          };
  $("selection-type").textContent = !obj
    ? "Canvas"
    : single
      ? { rect: "Rectangle", ellipse: "Ellipse", path: "Path", text: "Text" }[
          obj.type
        ]
      : "Multiple";
  $("selection-name").textContent = single
    ? obj.name
    : obj
      ? `${objs.length} objects selected`
      : "Nothing selected";
  $("selection-count").textContent = "";
  for (const key of ["x", "y", "w", "h", "rotation", "opacity"]) {
    const input = $(`prop-${key}`);
    input.disabled = !obj;
    updateInput(
      `prop-${key}`,
      key === "opacity"
        ? Math.round((obj?.opacity ?? 1) * 100)
        : key === "rotation"
          ? round(single ? obj.rotation : 0)
          : round(b[key]),
    );
  }
  document.querySelectorAll(".align-row [data-align]").forEach((btn) => {
    btn.disabled = !obj;
  });
  const childParent = single && obj?.frameId ? pageFrames().find(f => f.id === obj.frameId) : null;
  $("child-layout-sizing").hidden = !childParent?.autoLayout?.enabled;
  if (childParent?.autoLayout?.enabled) {
    updateInput("child-width-sizing", obj.widthSizing || "fixed");
    updateInput("child-height-sizing", obj.heightSizing || "fixed");
  }
  $("frame-properties").hidden = !artboardSelected();
  $("clip-content").checked = state.doc.artboard.clipContent !== false;
  if (artboardSelected()) {
    $("selection-type").textContent = "Frame";
    $("selection-name").textContent = artboardName();
    $("prop-x").disabled = false;
    $("prop-y").disabled = false;
    $("prop-w").disabled = false;
    $("prop-h").disabled = false;
  }
  const isFrame = artboardSelected();
  const activeFrame = isFrame ? state.doc.artboard : null;
  const canAddAutoLayout = isFrame || objs.length > 0;
  if ($("autolayout-panel")) {
    $("autolayout-panel").hidden = !canAddAutoLayout;
    if (activeFrame && activeFrame.autoLayout?.enabled) {
      const al = activeFrame.autoLayout;
      $("add-autolayout").hidden = true;
      $("remove-autolayout").hidden = false;
      $("autolayout-controls").hidden = false;

      $("al-dir-horizontal").classList.toggle("active", (al.direction || "horizontal") === "horizontal");
      $("al-dir-vertical").classList.toggle("active", al.direction === "vertical");

      for (const axis of ["width", "height"]) $(`al-${axis}-sizing`).querySelector('[value="fill"]').disabled = !pageFrames().find(f => f.id === activeFrame.parentId)?.autoLayout?.enabled;
      updateInput("al-width-sizing", al.widthSizing || al.sizing || "hug");
      updateInput("al-height-sizing", al.heightSizing || al.sizing || "hug");
      $("al-sizing-hug").classList.toggle("active", al.sizing !== "fixed");
      $("al-sizing-fixed").classList.toggle("active", al.sizing === "fixed");

      const currentAlign = al.align || "top-left";
      document.querySelectorAll(".al-matrix .al-dot").forEach((dot) => {
        const dotAlign = dot.dataset.alAlign || dot.dataset.align;
        dot.classList.toggle("active", dotAlign === currentAlign);
      });

      updateInput("al-gap", al.gap ?? 16);
      updateInput("al-pad-x", al.paddingX ?? 16);
      updateInput("al-pad-y", al.paddingY ?? 16);
    } else {
      $("add-autolayout").hidden = false;
      $("remove-autolayout").hidden = true;
      $("autolayout-controls").hidden = true;
    }
  }
  const isCanvas = !obj && !artboardSelected();
  for (const id of [
    "stroke-hex",
    "stroke-width",
    "stroke-preview",
    "no-stroke",
    "color-stroke",
  ])
    $(id).disabled = artboardSelected() || isCanvas;
  const paint =
    obj ||
    (artboardSelected()
      ? { fill: state.doc.artboard.fill, stroke: "none", strokeWidth: 0 }
      : { fill: canvasColor(), stroke: "none", strokeWidth: 0 });
  for (const kind of ["fill", "stroke"]) {
    const color = paint[kind] || "none";
    $(`${kind}-preview`).style.background = color === "none" ? "" : color;
    $(`${kind}-preview`).classList.toggle("none", color === "none");
    updateInput(`${kind}-hex`, color === "none" ? "None" : color.slice(1));
  }
  $("fill-opacity").textContent = `${Math.round((obj?.opacity ?? 1) * 100)}%`;
  updateInput("stroke-width", paint.strokeWidth || 0);
  if ($("fill-title")) {
    $("fill-title").textContent = isCanvas ? "Page background" : "Fill";
  }
  $("fill-preview").title = isCanvas ? "Edit canvas background" : "Edit fill";
  $("fill-preview").setAttribute("aria-label", isCanvas ? "Select canvas background" : "Select fill");
  $("no-fill").title = isCanvas ? "Reset canvas background" : "Remove fill";
  $("no-fill").setAttribute("aria-label", isCanvas ? "Reset canvas background" : "Remove fill");
  $("text-properties").hidden = !single || obj.type !== "text";
  if (single && obj.type === "text") {
    updateInput("font-size", obj.fontSize);
    updateInput("font-family", obj.fontFamily);
    updateInput("font-weight", obj.fontWeight);
  }
  const capable = objs.length >= 2 && objs.every((o) => o.type !== "text");
  document.querySelectorAll("[data-boolean]").forEach((btn) => {
    btn.disabled = !capable;
  });
  $("boolean-hint").textContent = capable
    ? `${objs.length} shapes ready to combine.`
    : objs.some((o) => o.type === "text")
      ? "Pathfinder works with shapes and paths."
      : "Select two or more shapes to combine.";
  $("duplicate").disabled = !obj && !artboardSelected();
  const effectTarget = obj || (artboardSelected() ? state.doc.artboard : null);
  if ($("effects-section")) {
    $("effects-section").hidden = !effectTarget;
    if (effectTarget) renderEffects(effectTarget);
    else closeEffectPopover();
  }
  if (!pendingColor) renderColor();
}
let pagesSignature = "";
const pageViews = new Map();
function renderPages() {
  const filter = $("page-search").value.trim().toLowerCase();
  const signature = JSON.stringify([
    state.doc.pages.map((p) => [p.id, p.name]),
    state.doc.activePageId,
    filter,
  ]);
  if (signature === pagesSignature) return;
  pagesSignature = signature;
  $("pages-list").replaceChildren();
  for (const page of state.doc.pages.filter((p) =>
    p.name.toLowerCase().includes(filter),
  )) {
    const row = document.createElement("div");
    row.className = `page-row${page.id === state.doc.activePageId ? " active" : ""}`;
    row.dataset.page = page.id;
    row.setAttribute("role", "listitem");
    const button = document.createElement("button");
    button.className = "page-name";
    button.textContent = page.name;
    button.setAttribute(
      "aria-current",
      page.id === state.doc.activePageId ? "page" : "false",
    );
    button.addEventListener("click", () => activatePage(page.id));
    button.addEventListener("dblclick", () => {
      const input = document.createElement("input");
      input.value = page.name;
      input.maxLength = 100;
      input.setAttribute("aria-label", "Page name");
      button.replaceWith(input);
      input.focus();
      input.select();
      let finished = false;
      const finish = (saveName) => {
        if (finished) return;
        finished = true;
        const name = input.value.trim();
        pagesSignature = "";
        if (saveName && name)
          transaction(() => {
            page.name = name;
          });
        else renderPages();
      };
      input.addEventListener("blur", () => finish(true));
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === "Escape") {
          event.preventDefault();
          finish(event.key === "Enter");
        }
      });
    });
    const remove = document.createElement("button");
    remove.className = "page-remove micro-button";
    remove.setAttribute("aria-label", `Delete ${page.name}`);
    remove.title = "Delete page";
    remove.textContent = "×";
    remove.disabled = state.doc.pages.length === 1;
    remove.addEventListener("click", () => {
      finishPageEditing();
      transaction(() => {
        syncActivePage();
        const index = state.doc.pages.findIndex((p) => p.id === page.id);
        state.doc.pages.splice(index, 1);
        if (state.doc.activePageId === page.id) {
          const next =
            state.doc.pages[Math.min(index, state.doc.pages.length - 1)];
          state.doc.activePageId = next.id;
          state.doc.artboard = next.artboard;
          state.doc.objects = next.objects;
          state.selected = [];
        }
      });
      fitCanvas();
    });
    row.append(button, remove);
    $("pages-list").append(row);
  }
  $("pages-empty").hidden = $("pages-list").children.length > 0;
  $("add-page").disabled = state.doc.pages.length >= 100;
}
function finishPageEditing() {
  if (state.pointer) finishGesture(null, true);
  if (textEditor) finishText();
  if (state.pen.length) finishPen();
  closeColorPicker();
  clearBuilder();
}
function activatePage(id) {
  if (id === state.doc.activePageId) return;
  finishPageEditing();
  pageViews.set(state.doc.activePageId, {
    pan: { ...state.pan },
    zoom: state.zoom,
  });
  transaction(() => {
    syncActivePage();
    const page = state.doc.pages.find((p) => p.id === id);
    state.doc.activePageId = id;
    state.doc.artboard = page.artboard;
    state.doc.objects = page.objects;
    preparePages(state.doc);
    state.selected = [];
  });
  setTool("select");
  refreshFontOptions();
  const view = pageViews.get(id);
  if (view) {
    state.pan = { ...view.pan };
    state.zoom = view.zoom;
    renderView();
    renderSelection();
  } else fitCanvas();
}
$("add-page").addEventListener("click", () => {
  if (state.doc.pages.length >= 100) return;
  finishPageEditing();
  pageViews.set(state.doc.activePageId, {
    pan: { ...state.pan },
    zoom: state.zoom,
  });
  transaction(() => {
    syncActivePage();
    let number = 1;
    while (state.doc.pages.some((p) => p.name === `Page ${number}`)) number++;
    const page = {
      id: crypto.randomUUID(),
      name: `Page ${number}`,
      artboard: { width: 1000, height: 720, fill: "#ffffff" },
      objects: [],
    };
    state.doc.pages.push(page);
    state.doc.activePageId = page.id;
    state.doc.artboard = page.artboard;
    state.doc.objects = page.objects;
    preparePages(state.doc);
    state.selected = [];
  });
  $("page-search").value = "";
  setTool("select");
  fitCanvas();
});
$("search-pages").addEventListener("click", () => {
  $("page-search").hidden = !$("page-search").hidden;
  if (!$("page-search").hidden) $("page-search").focus();
  else {
    $("page-search").value = "";
    renderPages();
  }
});
$("page-search").addEventListener("input", renderPages);

const collapsedFrames = new Set();
function renderLayers() {
  const frames = pageFrames();
  $("add-artboard").disabled = frames.length >= 100;
  if ($("artboard-tree")) $("artboard-tree").style.display = frames.length > 1 ? "none" : "";
  const structure = JSON.stringify([frames.map(f => [f.id, f.name, f.parentId, collapsedFrames.has(f.id)]), state.doc.objects.map(o => [o.id, o.name, o.type, o.visible, o.locked, o.frameId]), frames.map(f => [!!f.autoLayout?.enabled,f.autoLayout?.childOrder])]);
  if (structure === layerStructure) {
    document.querySelectorAll("[data-frame-id]").forEach(row => row.classList.toggle("selected", artboardSelected() && row.dataset.frameId === state.doc.artboard.id));
    document.querySelectorAll("[data-layer]").forEach((row) => {
      row.classList.toggle(
        "selected",
        state.selected.includes(row.dataset.layer),
      );
      row.setAttribute(
        "aria-selected",
        state.selected.includes(row.dataset.layer),
      );
    });
    return;
  }
  layerStructure = structure;
  const layers = $("layers"),
    scroll = layers.scrollTop;
  layers.replaceChildren();
  const containers = new Map();
  [...frames].sort((a,b) => frameAncestors(a).length-frameAncestors(b).length).forEach(frame => {
    const section = document.createElement("div"); section.className = "frame-section";
    const row = document.createElement("div"); row.className = `layer-row${artboardSelected() && frame.id === state.doc.artboard.id ? " selected" : ""}`; row.dataset.frameId = frame.id; row.draggable = true;
    row.tabIndex = 0; row.setAttribute("role", "option"); row.setAttribute("aria-label", frame.name);
    row.addEventListener("click", () => { activateFrame(frame.id); svg.focus({preventScroll:true}); });
    row.addEventListener("dblclick", () => { activateFrame(frame.id); renameArtboard(); });
    const toggle = document.createElement("button"); toggle.className = "layer-toggle";
    toggle.append(icon(collapsedFrames.has(frame.id) ? "chevron-right" : "chevron-down"));
    toggle.setAttribute("aria-label", `Toggle ${frame.name} layers`);
    toggle.setAttribute("aria-expanded", String(!collapsedFrames.has(frame.id)));
    toggle.addEventListener("click", (e) => { e.stopPropagation(); collapsedFrames.has(frame.id) ? collapsedFrames.delete(frame.id) : collapsedFrames.add(frame.id); renderLayers(); });
    const name = document.createElement("span"); name.className = "layer-name"; name.textContent = frame.name;
    name.addEventListener("dblclick", (e) => { e.stopPropagation(); activateFrame(frame.id); renameArtboard(); });
    row.append(toggle, icon("frame"), name);
    const children = document.createElement("div"); children.className = "frame-children"; children.hidden = collapsedFrames.has(frame.id);
    section.append(row, children); (containers.get(frame.parentId) || layers).append(section); containers.set(frame.id, children);
    row.addEventListener("dragover", event => { if (draggedLayer) event.preventDefault(); });
    row.addEventListener("drop", event => {
      if (!draggedLayer) return; event.preventDefault(); event.stopPropagation();
      const sourceFrame = pageFrames().find(f => f.id === draggedLayer);
      if (sourceFrame && frameSubtree(sourceFrame).some(f => f.id === frame.id)) { draggedLayer = null; return; }
      transaction(() => {
        if (sourceFrame) sourceFrame.parentId = frame.id;
        else getObject(draggedLayer).frameId = frame.id;
        placeLayoutChild(frame, draggedLayer);
      }); draggedLayer = null;
    });
  });
  for (const obj of [...state.doc.objects].reverse()) {
    const row = document.createElement("div");
    row.className = `layer-row${state.selected.includes(obj.id) ? " selected" : ""}${!obj.visible ? " hidden-layer" : ""}`;
    row.dataset.layer = obj.id;
    row.draggable = true;
    row.tabIndex = 0;
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", state.selected.includes(obj.id));
    row.setAttribute("aria-label", obj.name);
    row.append(
      icon(
        { rect: "square", ellipse: "circle", path: "spline", text: "type" }[
          obj.type
        ],
      ),
    );
    const name = document.createElement("span");
    name.className = "layer-name";
    name.textContent = obj.name;
    row.append(name);
    const lock = document.createElement("button");
    lock.className = "layer-action";
    lock.dataset.lock = obj.id;
    lock.title = obj.locked ? "Unlock layer" : "Lock layer";
    lock.setAttribute(
      "aria-label",
      `${obj.locked ? "Unlock" : "Lock"} ${obj.name}`,
    );
    lock.classList.toggle("is-locked", obj.locked);
    lock.append(icon(obj.locked ? "lock" : "lock-open"));
    row.append(lock);
    const eye = document.createElement("button");
    eye.className = "layer-action";
    eye.dataset.visibility = obj.id;
    eye.title = obj.visible ? "Hide layer" : "Show layer";
    eye.setAttribute(
      "aria-label",
      `${obj.visible ? "Hide" : "Show"} ${obj.name}`,
    );
    eye.append(icon(obj.visible ? "eye" : "eye-off"));
    row.append(eye);
    const parent = containers.get(obj.frameId) || layers;
    if (frames.find(f => f.id === obj.frameId)?.autoLayout?.enabled) parent.prepend(row);
    else parent.append(row);
  }
  frames.filter(f => f.autoLayout?.enabled).forEach(frame => {
    const container = containers.get(frame.id);
    const nodes = new Map([...container.children].map(node => [node.dataset.layer || node.querySelector("[data-frame-id]")?.dataset.frameId, node]));
    layoutChildren(frame).forEach(child => { if (nodes.has(child.id)) container.append(nodes.get(child.id)); });
  });
  layers.scrollTop = scroll;
  $("layer-total").textContent = state.doc.objects.length;
  $("layers-empty").hidden = state.doc.objects.length > 0;
  document.querySelector(".tree-size").textContent =
    `${state.doc.artboard.width} × ${state.doc.artboard.height}`;
  refreshIcons();
}
function currentColor() {
  const isCanvas = !artboardSelected() && !selectedObjects().length;
  if (isCanvas) {
    const color = canvasColor();
    return color === "none" ? "#090909" : color;
  }
  const color = artboardSelected()
    ? state.doc.artboard.fill
    : selectedObjects()[0]?.[state.paint] || defaults[state.paint];
  return color === "none" ? "#000000" : color;
}
function renderColor() {
  const color = currentColor();
  hsv = hexToHsv(color);
  updateInput("color-hex", color.toUpperCase());
  hexToRgb(color).forEach((n, i) =>
    updateInput(["color-r", "color-g", "color-b"][i], n),
  );
  $("native-color").value = color;
  $("hue-slider").value = hsv.h;
  updateColorSquare();
  $("color-fill").classList.toggle("active", state.paint === "fill");
  $("color-stroke").classList.toggle("active", state.paint === "stroke");
  document
    .querySelectorAll(".swatch")
    .forEach((b) => b.classList.toggle("active", b.dataset.color === color));
}
function updateColorSquare() {
  $("color-square").style.background =
    `linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,transparent),hsl(${hsv.h},100%,50%)`;
  $("color-cursor").style.left = `${hsv.s * 100}%`;
  $("color-cursor").style.top = `${(1 - hsv.v) * 100}%`;
  $("color-square").setAttribute("aria-valuenow", Math.round(hsv.s * 100));
  $("color-square").setAttribute(
    "aria-valuetext",
    `Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`,
  );
}
function renderSwatches() {
  $("swatches").replaceChildren();
  state.doc.swatches.forEach((color) => {
    const b = document.createElement("button");
    b.className = "swatch";
    b.dataset.color = color;
    b.style.background = color;
    b.title = color.toUpperCase();
    b.setAttribute("aria-label", `Apply ${color} to ${state.paint}`);
    $("swatches").append(b);
  });
}
function render() {
  updateCanvasBackground();
  renderObjects();
  renderSelection();
  renderProperties();
  renderLayers();
  renderView();
  updateInput("document-title", state.doc.title);
  renderPages();
  $("undo").disabled = state.undo.length === 0;
  $("redo").disabled = state.redo.length === 0;
}
function renderFast() {
  if (rendering) return;
  rendering = true;
  requestAnimationFrame(() => {
    updateCanvasBackground();
    renderObjects();
    renderSelection();
    renderProperties();
    if (["frame-move", "frame-resize"].includes(state.pointer?.type)) renderView();
    rendering = false;
  });
}
function fitCanvas() {
  const r = svg.getBoundingClientRect(),
    aw = state.doc.artboard.width,
    ah = state.doc.artboard.height;
  const bottomSpace = window.innerWidth <= 1050 ? 80 : 160;
  state.zoom = clamp(
    Math.min((r.width - 48) / aw, (r.height - 70 - bottomSpace) / ah),
    0.08,
    1.25,
  );
  state.pan = {
    x: (r.width - aw * state.zoom) / 2 - state.doc.artboard.x * state.zoom,
    y: 70 + (r.height - 70 - bottomSpace - ah * state.zoom) / 2 - state.doc.artboard.y * state.zoom,
  };
  renderView();
  renderSelection();
}
function zoomAt(
  factor,
  point = { x: svg.clientWidth / 2, y: svg.clientHeight / 2 },
) {
  const old = state.zoom;
  state.zoom = clamp(old * factor, 0.02, 256);
  state.pan.x = point.x - ((point.x - state.pan.x) * state.zoom) / old;
  state.pan.y = point.y - ((point.y - state.pan.y) * state.zoom) / old;
  renderView();
  renderSelection();
}
function clearBuilder() {
  if (state.builder) state.builder.regions.forEach((r) => r.path.remove());
  state.builder = null;
  builderHover = -1;
}
function prepareBuilder() {
  clearBuilder();
  const objs = selectedObjects().filter((o) => o.type !== "text");
  if (objs.length < 2) {
    toast("Select two or more shapes, then choose Shape builder.");
    return false;
  }
  if (objs.length > 24) {
    toast("Select up to 24 shapes for the shape builder.");
    return false;
  }
  try {
    state.builder = {
      ids: objs.map((o) => o.id),
      regions: buildRegions(objs),
      chosen: new Set(),
    };
    return true;
  } catch (e) {
    toast(e.message);
    return false;
  }
}
function convertToPath(obj) {
  if (!["rect", "ellipse"].includes(obj.type)) return;
  const p = localPath(obj);
  obj.type = "path";
  obj.d = p.pathData;
  obj.baseW = obj.w;
  obj.baseH = obj.h;
  p.remove();
}
function setTool(tool) {
  $("eyedropper-preview").hidden = true;
  penHover = null;
  penRedo = [];
  if (textEditor) finishText();
  if (state.pen.length) finishPen();
  clearBuilder();
  state.tool = tool;
  if (tool === "direct")
    transaction(() => selectedObjects().forEach(convertToPath));
  if (tool === "builder") prepareBuilder();
  document.querySelectorAll("[data-tool]").forEach((b) => {
    b.classList.toggle("active", b.dataset.tool === tool);
    b.setAttribute("aria-pressed", b.dataset.tool === tool);
  });
  svg.dataset.tool = tool;
  render();
}
function selectObject(obj, additive = false) {
  state.selected = state.selected.filter((id) => id !== "__artboard__");
  if (!obj || obj.locked || !obj.visible) {
    if (!additive) state.selected = [];
    return;
  }
  let targetIds = [obj.id];
  if (obj.groupId) {
    targetIds = state.doc.objects.filter(o => o.groupId === obj.groupId && !o.locked && o.visible).map(o => o.id);
  }
  if (additive) {
    const allSelected = targetIds.every(id => state.selected.includes(id));
    if (allSelected) {
      state.selected = state.selected.filter(id => !targetIds.includes(id));
    } else {
      state.selected = [...new Set([...state.selected, ...targetIds])];
    }
  } else {
    state.selected = targetIds;
  }
  if (state.tool === "direct") transaction(() => convertToPath(obj));
}
function applyPaint(color, kind = state.paint, live = false) {
  if (!/^(#[\da-f]{6}|none)$/i.test(color)) return false;
  color = color.toLowerCase();
  begin();
  defaults[kind] = color;
  if (artboardSelected() && kind === "fill") state.doc.artboard.fill = color;
  if (!artboardSelected() && !selectedObjects().length && kind === "fill") {
    const page = state.doc.pages?.find((p) => p.id === state.doc.activePageId);
    const canvasCol = color === "none" ? "#090909" : color;
    if (page) page.canvasColor = canvasCol;
    state.doc.canvasColor = canvasCol;
    updateCanvasBackground(canvasCol);
  }
  selectedObjects().forEach((o) => {
    o[kind] = color;
    if (kind === "stroke" && color !== "none" && !o.strokeWidth)
      o.strokeWidth = 1;
  });
  if (kind === "stroke" && color !== "none" && !defaults.strokeWidth)
    defaults.strokeWidth = 1;
  if (live) {
    renderFast();
  } else save();
  return true;
}
function normalizeHex(value) {
  let v = value.trim().replace(/^#/, "");
  if (/^[\da-f]{3}$/i.test(v))
    v = v
      .split("")
      .map((c) => c + c)
      .join("");
  return /^[\da-f]{6}$/i.test(v) ? `#${v}` : null;
}
function deleteSelection() {
  if (artboardSelected()) {
    if (pageFrames().length === 1) { toast("Keep at least one frame on this page."); return; }
    transaction(() => {
      const frames = pageFrames();
      const ids = new Set(frameSubtree(state.doc.artboard).map(f => f.id));
      if (ids.size === frames.length) { toast("Keep at least one frame on this page."); return; }
      state.doc.objects = state.doc.objects.filter(o => !ids.has(o.frameId));
      for (let i=frames.length-1;i>=0;i--) if (ids.has(frames[i].id)) frames.splice(i,1);
      state.doc.artboard = frames[0]; state.selected = [];
    });
    return;
  }
  if (!selectedObjects().length) return;
  transaction(() => {
    const ids = new Set(selectedObjects().map((o) => o.id));
    state.doc.objects = state.doc.objects.filter((o) => !ids.has(o.id));
    state.selected = [];
  });
  clearBuilder();
}
function duplicateSelection() {
  if (artboardSelected()) {
    transaction(() => {
      state.doc.artboard = duplicateFrame(state.doc.artboard);
    });
    fitCanvas(); return;
  }
  const selected = selectedObjects();
  if (!selected.length) return;
  transaction(() => {
    const copies = selected.map((o) => ({
      ...clone(o),
      id: crypto.randomUUID(),
      x: o.x + 24,
      y: o.y + 24,
      name: `${o.name} copy`,
    }));
    state.doc.objects.push(...copies);
    state.selected = copies.map((o) => o.id);
  });
  clearBuilder();
}
function performBoolean(operation) {
  const objs = selectedObjects();
  if (objs.length < 2 || objs.some((o) => o.type === "text")) return;
  try {
    const results = pathfinderObjects(objs, operation),
      ids = new Set(objs.map((o) => o.id));
    transaction(() => {
      const index = state.doc.objects.findIndex((o) => ids.has(o.id));
      state.doc.objects = state.doc.objects.filter((o) => !ids.has(o.id));
      state.doc.objects.splice(index, 0, ...results);
      state.selected = results.map((result) => result.id);
    });
    clearBuilder();
    setTool("select");
    toast(
      results.length
        ? `Pathfinder applied · ${results.length} ${results.length === 1 ? "object" : "objects"}`
        : "The operation produced an empty shape. Undo to restore.",
    );
  } catch (e) {
    toast("These paths could not be combined. Try simpler closed shapes.");
    console.error(e);
  }
}
function finishPen(closed = false) {
  penHover = null;
  penRedo = [];
  if (state.pen.length < 2) {
    state.pen = [];
    renderSelection();
    return;
  }
  const p = new paper.CompoundPath({
    pathData: penData(state.pen, closed),
    insert: false,
  });
  const source = makeObject("path", {
    fill: closed ? defaults.fill : "none",
    stroke: closed ? defaults.stroke : defaults.fill,
    strokeWidth: closed
      ? defaults.strokeWidth
      : Math.max(2, defaults.strokeWidth),
  });
  // Open horizontal or vertical paths still need a nonzero model box.
  const b = p.bounds.clone();
  p.translate(new paper.Point(-b.x, -b.y));
  const obj = {
    ...source,
    x: b.x,
    y: b.y,
    w: Math.max(1, b.width),
    h: Math.max(1, b.height),
    baseW: Math.max(1, b.width),
    baseH: Math.max(1, b.height),
    d: p.pathData,
  };
  transaction(() => {
    state.doc.objects.push(obj);
    state.selected = [obj.id];
  });
  p.remove();
  state.pen = [];
  render();
}
function startText(obj, point) {
  if (textEditor) finishText();
  begin();
  if (!obj) {
    obj = makeObject("text", {
      x: point.x,
      y: point.y,
      text: "",
      fontFamily: "Inter",
      fontSize: 40,
      fontWeight: 500,
      fill: defaults.fill,
      baseW: 180,
      baseH: 48,
      w: 180,
      h: 48,
    });
    state.doc.objects.push(obj);
  }
  state.selected = [obj.id];
  render();
  const input = document.createElement("textarea");
  input.className = "text-editor";
  input.value = obj.text;
  input.placeholder = "Type something";
  input.setAttribute("aria-label", "Edit canvas text");
  input.wrap = "off";
  input.spellcheck = false;
  const scaleX = obj.w / obj.baseW,
    scaleY = obj.h / obj.baseH;
  const origin = rotatePoint({ x: obj.x, y: obj.y }, obj.rotation, {
    x: obj.x + obj.w / 2,
    y: obj.y + obj.h / 2,
  });
  const angle = (obj.rotation * Math.PI) / 180;
  const metricsContext = document.createElement("canvas").getContext("2d");
  metricsContext.font = `${obj.fontWeight} ${obj.fontSize}px ${obj.fontFamily === "monospace" ? "monospace" : JSON.stringify(obj.fontFamily)}`;
  const metrics = metricsContext.measureText("Hg");
  const ascent = metrics.fontBoundingBoxAscent ?? obj.fontSize * 0.8;
  const descent = metrics.fontBoundingBoxDescent ?? obj.fontSize * 0.2;
  const lineHeight = obj.fontSize * (obj.lineHeight || 1.16);
  const baselineOffset =
    obj.fontSize * 0.84 - ((lineHeight - ascent - descent) / 2 + ascent);
  const syncEditor = () => {
    input.style.left = `${state.pan.x + origin.x * state.zoom}px`;
    input.style.top = `${state.pan.y + origin.y * state.zoom}px`;
    input.style.width = `${Math.max(obj.fontSize, obj.baseW + Math.abs(obj.letterSpacing || 0) + 4)}px`;
    input.style.height = `${obj.baseH + 2}px`;
    input.style.fontFamily = obj.fontFamily;
    input.style.fontWeight = obj.fontWeight;
    input.style.fontSize = `${obj.fontSize}px`;
    input.style.lineHeight = `${lineHeight}px`;
    input.style.letterSpacing = `${obj.letterSpacing || 0}px`;
    input.style.color = obj.fill === "none" ? obj.stroke : obj.fill;
    input.style.opacity = obj.opacity;
    const sx = scaleX * state.zoom,
      sy = scaleY * state.zoom;
    input.style.transform = `matrix(${Math.cos(angle) * sx}, ${Math.sin(angle) * sx}, ${-Math.sin(angle) * sy}, ${Math.cos(angle) * sy}, 0, 0) translateY(${baselineOffset}px)`;
  };
  syncEditor();
  $("canvas-container").append(input);
  textEditor = { input, obj, initialText: obj.text };
  renderObjects();
  renderSelection();
  input.addEventListener("input", () => {
    obj.text = input.value;
    measureText(obj);
    obj.w *= scaleX;
    obj.h *= scaleY;
    const half = { x: obj.w / 2, y: obj.h / 2 };
    const rotated = rotatePoint(half, obj.rotation);
    obj.x = origin.x - half.x + rotated.x;
    obj.y = origin.y - half.y + rotated.y;
    syncEditor();
    renderObjects();
  });
  input.addEventListener("blur", () => finishText());
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      const editor = textEditor;
      textEditor = null;
      editor.input.remove();
      cancel();
      state.selected = [];
      render();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      finishText();
    }
  });
  input.focus();
  input.select();
}
function finishText() {
  if (!textEditor) return;
  const { input, obj, initialText } = textEditor;
  textEditor = null;
  obj.text = input.value;
  if (!obj.text.trim()) {
    state.doc.objects = state.doc.objects.filter((o) => o.id !== obj.id);
    state.selected = [];
  } else if (obj.text !== initialText) {
    obj.name = obj.text.split("\n")[0].slice(0, 32);
  }
  input.remove();
  save();
}

// Canvas gesture state machine: document mutations form a single undo transaction.
svg.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 && event.button !== 1) return;
  if (state.pointer) return;
  if (textEditor) finishText();
  event.preventDefault();
  svg.focus({ preventScroll: true });
  svg.setPointerCapture(event.pointerId);
  const point = worldPoint(event),
    screen = screenPoint(event),
    obj = pickObject(event),
    handle = event.target.dataset.handle,
    anchor = event.target.dataset.anchor;
  if (state.space || state.tool === "hand" || event.button === 1) {
    state.pointer = { type: "pan", screen, pan: { ...state.pan } };
    svg.classList.add("is-panning");
    return;
  }
  if (event.target.dataset.frameHandle && artboardSelected()) {
    begin(); state.pointer = {type:"frame-resize", handle:event.target.dataset.frameHandle, start:point, original:clone(state.doc.artboard), frame:state.doc.artboard}; return;
  }
  const frameLabel = event.target.closest("[data-frame-label]");
  if (frameLabel) {
    const now = performance.now();
    const sameFrame = frameLabel.dataset.frameLabel === state.doc.artboard.id;
    activateFrame(frameLabel.dataset.frameLabel);
    if (sameFrame && lastArtboardClick && now - lastArtboardClick < 450) {
      lastArtboardClick = 0;
      renameArtboard();
    } else {
      lastArtboardClick = now;
      begin();
      state.pointer = {type: "frame-move", start: point, frame: state.doc.artboard, x: state.doc.artboard.x, y: state.doc.artboard.y, contents: frameContents(state.doc.artboard).map(o => ({id:o.id, x:o.x, y:o.y}))};
    }
    return;
  }
  if (state.tool === "frame") {
    begin();
    const frame = {
      id: crypto.randomUUID(),
      name: nextFrameName(),
      x: point.x,
      y: point.y,
      width: 1,
      height: 1,
      fill: "#ffffff",
      clipContent: true,
    };
    pageFrames().push(frame);
    state.doc.artboard = frame;
    state.selected = ["__artboard__"];
    state.pointer = { type: "draw-frame", start: point, frame };
    render();
    return;
  }
  if (state.tool === "eyedropper") {
    const sample = eyedropperColor(event);
    if (sample) {
      applyPaint(sample);
      toast(`Sampled ${sample.toUpperCase()}`);
    }
    updateEyedropperPreview(event);
    return;
  }
  if (state.tool === "builder") {
    if (!state.builder && !prepareBuilder()) {
      if (obj) selectObject(obj, event.shiftKey);
      render();
      return;
    }
    const index = state.builder.regions.findIndex((r) =>
      r.path.contains(new paper.Point(point.x, point.y)),
    );
    if (index >= 0) {
      state.builder.chosen = new Set([index]);
      state.pointer = { type: "builder", deleting: event.altKey };
      builderHover = index;
      renderSelection();
    }
    return;
  }
  if (state.tool === "text") {
    startText(obj?.type === "text" ? obj : null, point);
    return;
  }
  if (state.tool === "pen") {
    const position = penPosition(event),
      previous = clone(state.pen);
    const closing = state.pen.length > 1 && nearPenAnchor(point, state.pen[0]);
    const continuing = !closing && nearPenAnchor(point, state.pen.at(-1), 4);
    const p = closing
      ? state.pen[0]
      : continuing
        ? state.pen.at(-1)
        : {
            ...position,
            in: { x: 0, y: 0 },
            out: { x: 0, y: 0 },
          };
    const originalIn = { ...p.in };
    if (continuing) p.out = { x: 0, y: 0 };
    if (!closing && !continuing) state.pen.push(p);
    penHover = null;
    penRedo = [];
    state.pointer = {
      type: "pen",
      pointerId: event.pointerId,
      point: p,
      previous,
      originalIn,
      closing,
      dragged: false,
    };
    renderSelection();
    return;
  }
  if (state.tool === "rect" || state.tool === "ellipse") {
    begin();
    const shape = makeObject(state.tool, {
      x: point.x,
      y: point.y,
      w: 1,
      h: 1,
    });
    state.doc.objects.push(shape);
    state.selected = [shape.id];
    state.pointer = { type: "draw", start: point, obj: shape };
    render();
    return;
  }
  if (anchor) {
    const [id, pathIndex, segmentIndex, kind] = anchor.split(":");
    begin();
    state.pointer = {
      type: "anchor",
      obj: getObject(id),
      pathIndex: +pathIndex,
      segmentIndex: +segmentIndex,
      kind,
    };
    return;
  }
  if (handle && selectedObjects().length) {
    begin();
    const originals = clone(selectedObjects()),
      single = originals.length === 1,
      b = single ? { ...originals[0] } : boundsOf(originals),
      center = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    state.pointer = {
      type: handle === "rotate" ? "rotate" : "resize",
      handle,
      start: point,
      originals,
      bounds: b,
      center,
      startAngle:
        (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI,
    };
    return;
  }
  if (
    obj?.type === "text" &&
    !obj.locked &&
    lastCanvasTap?.id === obj.id &&
    performance.now() - lastCanvasTap.time < 450 &&
    Math.hypot(
      screen.x - lastCanvasTap.screen.x,
      screen.y - lastCanvasTap.screen.y,
    ) < 6
  ) {
    lastCanvasTap = null;
    startText(obj);
    return;
  }
  if (obj && !obj.locked) {
    if (event.shiftKey) selectObject(obj, true);
    else if (!state.selected.includes(obj.id)) selectObject(obj);
    if (state.tool === "direct" && obj.type !== "path" && obj.type !== "text")
      transaction(() => convertToPath(obj));
    begin();
    state.pointer = {
      type: "move",
      start: point,
      screen,
      clickedId: obj.id,
      originals: clone(selectedObjects()),
    };
    render();
  } else {
    const frameBg = event.target.dataset.frameBackground;
    const isSelectedFrame = frameBg && artboardSelected() && state.doc.artboard.id === frameBg;
    state.pointer = {
      type: "canvas-down",
      start: point,
      screen,
      frameBg,
      isSelectedFrame,
      originalSelection: event.shiftKey
        ? state.selected.filter((id) => id !== "__artboard__")
        : [],
      shiftKey: event.shiftKey,
    };
  }
});
svg.addEventListener("pointermove", (event) => {
  updateEyedropperPreview(event);
  const point = worldPoint(event),
    gesture = state.pointer;
  if (!gesture) {
    const hoverEl = event.target.closest("[data-object], [data-frame-label], #artboard");
    const newHover = hoverEl ? (hoverEl.dataset.object || hoverEl.dataset.frameLabel || "artboard") : "artboard";
    if (newHover !== hoverTargetId) {
      hoverTargetId = newHover;
      if (altKeyIsDown && state.selected.length > 0) renderSelection();
    }
    if (state.tool === "pen" && state.pen.length) {
      penHover = penPosition(event);
      schedulePenPreview();
    }
    if (state.tool === "builder" && state.builder) {
      const hit = state.builder.regions.findIndex((r) =>
        r.path.contains(new paper.Point(point.x, point.y)),
      );
      if (hit !== builderHover) {
        builderHover = hit;
        renderSelection();
      }
    }
    return;
  }
  if (gesture.type === "draw-frame") {
    let dx = point.x - gesture.start.x,
      dy = point.y - gesture.start.y;
    if (event.shiftKey) {
      const size = Math.max(Math.abs(dx), Math.abs(dy));
      dx = Math.sign(dx || 1) * size;
      dy = Math.sign(dy || 1) * size;
    }
    gesture.frame.x = gesture.start.x + Math.min(0, dx);
    gesture.frame.y = gesture.start.y + Math.min(0, dy);
    gesture.frame.width = Math.max(1, Math.abs(dx));
    gesture.frame.height = Math.max(1, Math.abs(dy));
    renderFast();
    return;
  }
  if (gesture.type === "canvas-down") {
    const dist = Math.hypot(point.x - gesture.start.x, point.y - gesture.start.y);
    if (dist >= 4) {
      if (gesture.isSelectedFrame && !gesture.shiftKey) {
        begin();
        state.pointer = {
          type: "frame-move",
          start: gesture.start,
          frame: state.doc.artboard,
          x: state.doc.artboard.x,
          y: state.doc.artboard.y,
          contents: frameContents(state.doc.artboard).map(o => ({ id: o.id, x: o.x, y: o.y })),
        };
      } else {
        if (!gesture.shiftKey) state.selected = [];
        state.pointer = {
          type: "marquee",
          start: gesture.start,
          end: point,
          originalSelection: gesture.originalSelection,
        };
        render();
      }
    }
    return;
  }
  if (gesture.type === "frame-resize") {
    const f = gesture.frame, o = gesture.original, h = gesture.handle;
    const dx = point.x - gesture.start.x, dy = point.y - gesture.start.y;
    f.x = h.includes("w") ? Math.min(o.x + dx, o.x + o.width - 1) : o.x;
    f.y = h.includes("n") ? Math.min(o.y + dy, o.y + o.height - 1) : o.y;
    f.width = h.includes("w") ? o.x + o.width - f.x : Math.max(1, o.width + dx);
    f.height = h.includes("n") ? o.y + o.height - f.y : Math.max(1, o.height + dy);
    if (f.autoLayout?.enabled) {
      f.autoLayout.sizing = "fixed";
      applyAutoLayout(f);
    }
    renderFast(); return;
  }
  if (gesture.type === "frame-move") {
    const dx = point.x - gesture.start.x, dy = point.y - gesture.start.y;
    if (event.altKey && !gesture.duplicated && Math.hypot(dx, dy) > 2) {
      gesture.duplicated = true;
      moveFrame(gesture.frame, gesture.x, gesture.y);
      gesture.frame = duplicateFrame(gesture.frame, 0);
      state.doc.artboard = gesture.frame;
      renderLayers();
    }
    moveFrame(gesture.frame, gesture.x + dx, gesture.y + dy);
    renderFast(); return;
  }
  if (gesture.type === "pan") {
    const p = screenPoint(event);
    state.pan = {
      x: gesture.pan.x + p.x - gesture.screen.x,
      y: gesture.pan.y + p.y - gesture.screen.y,
    };
    renderView();
    return;
  }
  if (gesture.type === "pen") {
    if (event.pointerId !== gesture.pointerId) return;
    updatePenGesture(event, gesture);
    schedulePenPreview();
    return;
  }
  if (gesture.type === "builder") {
    const index = state.builder.regions.findIndex((r) =>
      r.path.contains(new paper.Point(point.x, point.y)),
    );
    if (index >= 0) state.builder.chosen.add(index);
    builderHover = index;
    renderSelection();
    return;
  }
  if (gesture.type === "draw") {
    let dx = point.x - gesture.start.x,
      dy = point.y - gesture.start.y;
    if (event.shiftKey) {
      const size = Math.max(Math.abs(dx), Math.abs(dy));
      dx = Math.sign(dx || 1) * size;
      dy = Math.sign(dy || 1) * size;
    }
    Object.assign(gesture.obj, {
      x: gesture.start.x + Math.min(0, dx),
      y: gesture.start.y + Math.min(0, dy),
      w: Math.max(1, Math.abs(dx)),
      h: Math.max(1, Math.abs(dy)),
    });
  } else if (gesture.type === "move") {
    let dx = point.x - gesture.start.x,
      dy = point.y - gesture.start.y;
    if (event.shiftKey) {
      if (Math.abs(dx) > Math.abs(dy)) dy = 0;
      else dx = 0;
    }
    if (event.altKey && !gesture.duplicated && Math.hypot(dx, dy) > 2) {
      gesture.duplicated = true;
      const newIds = [];
      const newOriginals = [];
      gesture.originals.forEach((original) => {
        const o = getObject(original.id);
        o.x = original.x;
        o.y = original.y;
        const dup = clone(o);
        dup.id = crypto.randomUUID();
        if (!dup.name.endsWith(" copy")) dup.name += " copy";
        const index = state.doc.objects.findIndex((x) => x.id === o.id);
        state.doc.objects.splice(index + 1, 0, dup);
        newIds.push(dup.id);
        newOriginals.push(clone(dup));
      });
      state.selected = newIds;
      gesture.originals = newOriginals;
      renderLayers();
    }
    gesture.originals.forEach((original) => {
      const o = getObject(original.id);
      o.x = original.x + dx;
      o.y = original.y + dy;
    });
  } else if (gesture.type === "marquee") {
    gesture.end = point;
    const rect = {
      x: Math.min(point.x, gesture.start.x),
      y: Math.min(point.y, gesture.start.y),
      w: Math.abs(point.x - gesture.start.x),
      h: Math.abs(point.y - gesture.start.y),
    };
    const ids = state.doc.objects
      .filter((o) => {
        if (o.locked || !o.visible) return false;
        const b = objectBounds(o);
        return (
          b.x >= rect.x &&
          b.y >= rect.y &&
          b.x + b.w <= rect.x + rect.w &&
          b.y + b.h <= rect.y + rect.h
        );
      })
      .map((o) => o.id);
    const selectedIds = new Set(ids);
    state.doc.objects.forEach(o => {
      if (o.groupId && selectedIds.has(o.id)) {
         state.doc.objects.filter(g => g.groupId === o.groupId).forEach(g => selectedIds.add(g.id));
      }
    });
    const f = state.doc.artboard;
    if (f) {
      const startedOutside = gesture.start.x < f.x || gesture.start.y < f.y || gesture.start.x > f.x + f.width || gesture.start.y > f.y + f.height;
      const intersects = rect.x < f.x + f.width && rect.x + rect.w > f.x && rect.y < f.y + f.height && rect.y + rect.h > f.y;
      if (startedOutside && intersects) {
        selectedIds.add("__artboard__");
      }
    }
    state.selected = [...new Set([...gesture.originalSelection, ...selectedIds])];
  } else if (gesture.type === "rotate") {
    let delta =
      (Math.atan2(point.y - gesture.center.y, point.x - gesture.center.x) *
        180) /
        Math.PI -
      gesture.startAngle;
    if (event.shiftKey) delta = Math.round(delta / 15) * 15;
    gesture.originals.forEach((original) => {
      const o = getObject(original.id),
        center = rotatePoint(
          { x: original.x + original.w / 2, y: original.y + original.h / 2 },
          delta,
          gesture.center,
        );
      o.x = center.x - original.w / 2;
      o.y = center.y - original.h / 2;
      o.rotation = round((original.rotation + delta + 360) % 360);
    });
  } else if (gesture.type === "resize") {
    const b = gesture.bounds,
      single = gesture.originals.length === 1,
      rotation = single ? b.rotation : 0;
    const p = rotatePoint(point, -rotation, gesture.center),
      px = p.x - b.x,
      py = p.y - b.y;
    let left = 0,
      right = b.w,
      top = 0,
      bottom = b.h;
    if (gesture.handle.includes("w")) left = Math.min(px, b.w - 1);
    if (gesture.handle.includes("e")) right = Math.max(px, 1);
    if (gesture.handle.includes("n")) top = Math.min(py, b.h - 1);
    if (gesture.handle.includes("s")) bottom = Math.max(py, 1);
    if (event.shiftKey && gesture.handle.length === 2) {
      const ratio = b.w / b.h,
        h = (right - left) / ratio;
      if (gesture.handle.includes("n")) top = bottom - h;
      else bottom = top + h;
    }
    const nw = right - left,
      nh = bottom - top;
    if (single) {
      const center = rotatePoint(
        { x: b.x + left + nw / 2, y: b.y + top + nh / 2 },
        rotation,
        gesture.center,
      );
      Object.assign(getObject(gesture.originals[0].id), {
        x: center.x - nw / 2,
        y: center.y - nh / 2,
        w: nw,
        h: nh,
      });
    } else
      gesture.originals.forEach((original) => {
        Object.assign(getObject(original.id), {
          x: b.x + left + ((original.x - b.x) * nw) / b.w,
          y: b.y + top + ((original.y - b.y) * nh) / b.h,
          w: Math.max(1, (original.w * nw) / b.w),
          h: Math.max(1, (original.h * nh) / b.h),
        });
      });
  } else if (gesture.type === "anchor") {
    const o = gesture.obj,
      p = localPath(o),
      path = (p.children || [p])[gesture.pathIndex],
      segment = path.segments[gesture.segmentIndex],
      local = localPoint(o, point);
    if (gesture.kind === "point")
      segment.point = new paper.Point(local.x, local.y);
    else {
      const vector = new paper.Point(
        local.x - segment.point.x,
        local.y - segment.point.y,
      );
      segment[gesture.kind] = vector;
      if (event.shiftKey)
        segment[gesture.kind === "handleIn" ? "handleOut" : "handleIn"] =
          vector.negate();
    }
    o.d = p.pathData;
    p.remove();
  }
  renderFast();
});
function finishGesture(event, cancelled = false) {
  const gesture = state.pointer;
  if (!gesture) return;
  if (gesture.type === "pen") {
    if (event && event.pointerId !== gesture.pointerId) return;
    if (cancelled) state.pen = gesture.previous;
    else if (event && event.type === "pointerup")
      updatePenGesture(event, gesture);
    state.pointer = null;
    penHover = null;
    if (!cancelled && gesture.closing) finishPen(true);
    else renderSelection();
    return;
  }
  state.pointer = null;
  svg.classList.remove("is-panning");
  if (cancelled) {
    cancel();
    if (gesture.type === "pen") state.pen.pop();
    if (state.builder) state.builder.chosen.clear();
    state.selected = state.selected.filter((id) => getObject(id));
    render();
    return;
  }
  if (gesture.type === "builder") {
    const builder = state.builder,
      chosen = [...builder.chosen];
    if (!chosen.length) return;
    let merged = null;
    if (!gesture.deleting)
      chosen.forEach((index) => {
        const p = builder.regions[index].path;
        if (!merged) merged = p.clone({ insert: false });
        else {
          const prev = merged;
          merged = merged.unite(p, { insert: false });
          prev.remove();
        }
      });
    const replacements = builder.regions
      .filter((r, i) => !builder.chosen.has(i))
      .map((r) =>
        pathObject(r.path.clone({ insert: false }), r.source, "Shape region"),
      )
      .filter(Boolean);
    const combined = merged
      ? pathObject(merged, builder.regions[chosen[0]].source, "Built shape")
      : null;
    if (combined) replacements.push(combined);
    if (merged) merged.remove();
    transaction(() => {
      const ids = new Set(builder.ids),
        index = state.doc.objects.findIndex((o) => ids.has(o.id));
      state.doc.objects = state.doc.objects.filter((o) => !ids.has(o.id));
      state.doc.objects.splice(index, 0, ...replacements);
      state.selected = replacements.map((o) => o.id);
    });
    clearBuilder();
    if (replacements.length > 1) prepareBuilder();
    render();
    toast(gesture.deleting ? "Region removed" : "Regions combined");
    return;
  }
  if (gesture.type === "move" && event) {
    const screen = screenPoint(event);
    if (
      Math.hypot(screen.x - gesture.screen.x, screen.y - gesture.screen.y) < 4
    )
      lastCanvasTap = {
        id: gesture.clickedId,
        screen,
        time: performance.now(),
      };
    else lastCanvasTap = null;
  }
  if (gesture.type === "canvas-down") {
    if (gesture.frameBg) {
      activateFrame(gesture.frameBg);
    } else {
      state.selected = [];
      render();
    }
    return;
  }
  if (gesture.type === "draw-frame") {
    if (gesture.frame.width < 10 && gesture.frame.height < 10) {
      gesture.frame.width = 1000;
      gesture.frame.height = 720;
    }
    assignFrameParent(gesture.frame);
    state.doc.objects.forEach(assignFrame);
    setTool("select");
    save();
    return;
  }
  if (gesture.type === "draw" && gesture.obj.w < 3 && gesture.obj.h < 3) {
    gesture.obj.w = 120;
    gesture.obj.h = 120;
  }
  if (gesture.type === "anchor") {
    // Rebase modified path geometry so the properties panel reflects its new bounds.
    const old = gesture.obj,
      path = worldPath(old),
      normalized = pathObject(path, old, old.name);
    if (normalized) Object.assign(old, normalized, { id: old.id });
    path.remove();
  }
  if (["draw-frame", "frame-move"].includes(gesture.type)) assignFrameParent(gesture.frame);
  if (gesture.type === "frame-resize" && gesture.frame?.autoLayout?.enabled) {
    gesture.frame.autoLayout.widthSizing = "fixed";
    gesture.frame.autoLayout.heightSizing = "fixed";
    gesture.frame.autoLayout.sizing = "fixed";
    applyAutoLayout(gesture.frame);
  }
  if (["move", "draw", "resize"].includes(gesture.type)) {
    const affectedFrames = new Set();
    selectedObjects().forEach((o) => { if (o.frameId) affectedFrames.add(o.frameId); });
    if (["move", "draw"].includes(gesture.type)) selectedObjects().forEach(assignFrame);
    selectedObjects().forEach((o) => { if (o.frameId) affectedFrames.add(o.frameId); });
    pageFrames().forEach((f) => {
      if (affectedFrames.has(f.id) && f.autoLayout?.enabled) {
        if (["move", "draw"].includes(gesture.type)) reorderAutoLayoutChildren(f);
        applyAutoLayout(f);
      }
    });
  }
  if (["frame-resize", "frame-move", "move", "draw", "resize", "rotate", "anchor", "draw-frame"].includes(gesture.type))
    save();
  else render();
  if (gesture.type === "draw") setTool("select");
  if (gesture.type === "marquee" && state.tool === "direct")
    transaction(() => selectedObjects().forEach(convertToPath));
}
svg.addEventListener("pointerup", (event) => finishGesture(event));
svg.addEventListener("pointercancel", (event) => finishGesture(event));
svg.addEventListener("lostpointercapture", (event) => {
  if (state.pointer) finishGesture(event);
});
svg.addEventListener("pointerleave", () => {
  $("eyedropper-preview").hidden = true;
  penHover = null;
  if (state.tool === "pen") schedulePenPreview();
});
svg.addEventListener("dblclick", (event) => {
  // Native double-click timing must never terminate a sequence of pen points.
  if (state.tool === "pen") {
    event.preventDefault();
    return;
  }
  const frameLabel = event.target.closest("[data-frame-label]");
  if (frameLabel) {
    event.preventDefault();
    activateFrame(frameLabel.dataset.frameLabel);
    renameArtboard();
    return;
  }
  const obj = pickObject(event);
  if (obj?.type === "text" && !obj.locked) {
    event.preventDefault();
    startText(obj);
  }
});
svg.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    if (textEditor) finishText();
    if (event.ctrlKey || event.metaKey)
      zoomAt(Math.exp(-event.deltaY * 0.008), screenPoint(event));
    else {
      state.pan.x -= event.deltaX;
      state.pan.y -= event.deltaY;
      renderView();
    }
  },
  { passive: false },
);
// Context actions share the same document transactions as the toolbar.
const contextMenu = document.createElement("div");
contextMenu.id = "canvas-context-menu";
contextMenu.setAttribute("role", "menu");
contextMenu.setAttribute("aria-label", "Editing actions");
contextMenu.hidden = true;
document.body.append(contextMenu);
let copiedObjects = [];
let contextPoint = null;
function closeContextMenu() { contextMenu.hidden = true; }
function copySelection() {
  copiedObjects = clone(selectedObjects());
}
function pasteObjects(point = null, replace = false) {
  if (!copiedObjects.length) return;
  const originals = selectedObjects();
  const source = boundsOf(copiedObjects);
  const target = replace && originals.length ? boundsOf(originals) : point;
  transaction(() => {
    if (replace) {
      const ids = new Set(originals.map(o => o.id));
      state.doc.objects = state.doc.objects.filter(o => !ids.has(o.id));
    }
    const copies = copiedObjects.map(o => ({ ...clone(o), id: crypto.randomUUID(),
      x: o.x + (target ? target.x - source.x : 24),
      y: o.y + (target ? target.y - source.y : 24),
      locked: false, visible: true }));
    state.doc.objects.push(...copies);
    state.selected = copies.map(o => o.id);
  });
  clearBuilder();
}
function openContextMenu(event) {
  if (event.target.closest("input, textarea, [contenteditable=true]")) return;
  event.preventDefault();
  if (state.pointer) return;
  if (textEditor) finishText();
  setTool("select");
  const target = event.target.closest("[data-object], [data-layer]");
  const id = target?.dataset.object || target?.dataset.layer;
  if (id && !state.selected.includes(id)) state.selected = [id];
  else if (!id && event.currentTarget === svg) state.selected = [];
  render();
  contextPoint = event.currentTarget === svg ? worldPoint(event) : null;
  contextMenu.replaceChildren();
  const selected = selectedObjects();
  const layers = state.doc.objects.filter(o => state.selected.includes(o.id));
  const add = (label, action, enabled = true, shortcut = "") => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "menuitem");
    button.disabled = !enabled;
    const text = document.createElement("span"); text.textContent = label;
    const hint = document.createElement("kbd"); hint.textContent = shortcut; hint.setAttribute("aria-hidden", "true");
    button.append(text, hint);
    button.addEventListener("click", () => { closeContextMenu(); action(); svg.focus({preventScroll:true}); });
    contextMenu.append(button);
  };
  const separator = () => { const line = document.createElement("hr"); line.setAttribute("role", "separator"); contextMenu.append(line); };
  add("Copy", copySelection, !!selected.length, "⌘/Ctrl C");
  add("Cut", () => { copySelection(); deleteSelection(); }, !!selected.length, "⌘/Ctrl X");
  add("Paste here", () => pasteObjects(contextPoint), !!copiedObjects.length);
  add("Paste to replace", () => pasteObjects(null, true), !!copiedObjects.length && !!selected.length);
  add("Duplicate", duplicateSelection, !!selected.length, "⌘/Ctrl D");
  const frameForAl = artboardSelected() ? state.doc.artboard : null;
  const hasAutoLayout = frameForAl?.autoLayout?.enabled;
  if (hasAutoLayout) {
    add("Remove auto layout", () => removeAutoLayout(frameForAl), true, "⌥⇧A");
  } else if (frameForAl || selected.length > 0) {
    add("Add auto layout", () => {
      if (frameForAl) enableAutoLayout(frameForAl);
      else wrapSelectionInAutoLayout();
    }, true, "⇧A");
  }
  separator();
  const canGroup = selected.length > 1;
  const canUngroup = selected.some(o => o.groupId);
  add("Group", groupSelection, canGroup, "⌘/Ctrl G");
  add("Ungroup", ungroupSelection, canUngroup, "⌘/Ctrl ⇧ G");
  separator();
  const reorder = front => transaction(() => {
    const ids = new Set(selected.map(o => o.id));
    const rest = state.doc.objects.filter(o => !ids.has(o.id));
    state.doc.objects = front ? [...rest, ...selected] : [...selected, ...rest];
  });
  add("Bring to front", () => reorder(true), !!selected.length);
  add("Send to back", () => reorder(false), !!selected.length);
  separator();
  add(layers.some(o => !o.visible) ? "Show" : "Hide", () => transaction(() => {
    const visible = layers.some(o => !o.visible);
    layers.forEach(o => o.visible = visible); state.selected = [];
  }), !!layers.length);
  add(layers.some(o => o.locked) ? "Unlock" : "Lock", () => transaction(() => {
    const locked = !layers.some(o => o.locked);
    layers.forEach(o => o.locked = locked); state.selected = [];
  }), !!layers.length);
  add("Delete", deleteSelection, !!selected.length, "⌫");
  separator();
  add("Select all", () => { state.selected = state.doc.objects.filter(o => o.visible && !o.locked).map(o => o.id); render(); });
  if (!selected.length && !artboardSelected()) {
    add("Change canvas color...", () => openColorPicker("fill"), true);
  }
  add("Fit frame", fitCanvas, true, "⇧ 1");
  add(pixelGridVisible ? "Hide pixel grid" : "Show pixel grid", () => $("toggle-pixel-grid").click());
  contextMenu.hidden = false;
  contextMenu.style.left = `${Math.max(8, Math.min(event.clientX, innerWidth - contextMenu.offsetWidth - 8))}px`;
  contextMenu.style.top = `${Math.max(8, Math.min(event.clientY, innerHeight - contextMenu.offsetHeight - 8))}px`;
  contextMenu.querySelector("button:not(:disabled)")?.focus();
}
svg.addEventListener("contextmenu", openContextMenu);
$("layers").addEventListener("contextmenu", openContextMenu);
window.addEventListener("pointerdown", event => {
  if (!contextMenu.contains(event.target)) closeContextMenu();
}, true);
window.addEventListener("resize", closeContextMenu);

contextMenu.addEventListener("keydown", event => {
  if (event.key === "Escape" || event.key === "Tab") {
    closeContextMenu(); svg.focus(); event.preventDefault(); event.stopPropagation();
  } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
    event.preventDefault(); event.stopPropagation();
    const items = [...contextMenu.querySelectorAll("button:not(:disabled)")];
    const index = items.indexOf(document.activeElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  }
});

// One floating color editor combines the picker and the project palette.
let colorPickerAnchor;
function positionColorPicker() {
  if ($("color-popover").hidden) return;
  const popup = $("color-popover"),
    anchor = (colorPickerAnchor || $("fill-preview")).getBoundingClientRect();
  const inspector = document
    .querySelector(".inspector")
    .getBoundingClientRect();
  const width = popup.offsetWidth,
    height = popup.offsetHeight;
  popup.style.left = `${Math.max(8, inspector.left - width - 12)}px`;
  popup.style.top = `${clamp(anchor.top - 100, 8, Math.max(8, window.innerHeight - height - 8))}px`;
}
function openColorPicker(kind) {
  state.paint = kind;
  colorPickerAnchor = $(`${kind}-preview`);
  $("color-popover").hidden = false;
  for (const k of ["fill", "stroke"])
    $(`${k}-preview`).setAttribute("aria-expanded", k === kind);
  renderSwatches();
  renderColor();
  positionColorPicker();
}
function closeColorPicker(restoreFocus = false) {
  $("color-popover").hidden = true;
  for (const k of ["fill", "stroke"])
    $(`${k}-preview`).setAttribute("aria-expanded", "false");
  if (restoreFocus) colorPickerAnchor?.focus();
}
for (const kind of ["fill", "stroke"]) {
  $(`${kind}-preview`).setAttribute("aria-haspopup", "dialog");
  $(`${kind}-preview`).setAttribute("aria-controls", "color-popover");
  $(`${kind}-preview`).setAttribute("aria-expanded", "false");
}
$("close-color-picker").addEventListener("click", () => closeColorPicker(true));
$("picker-eyedropper").addEventListener("click", () => {
  closeColorPicker();
  setTool("eyedropper");
});
document.addEventListener("pointerdown", (e) => {
  if (
    !$("color-popover").hidden &&
    !e.target.closest("#color-popover, #fill-preview, #stroke-preview")
  )
    closeColorPicker();
});
window.addEventListener(
  "keydown",
  (e) => {
    if (e.key === "Escape" && !$("color-popover").hidden) {
      e.preventDefault();
      e.stopImmediatePropagation();
      closeColorPicker(true);
    }
  },
  true,
);
window.addEventListener("resize", positionColorPicker);

// Effects management & settings popover (Figma 1:1)
let activeEffectInfo = null;
let effectPopoverAnchor = null;

function effectTypeName(type) {
  const map = {
    "drop-shadow": "Drop shadow",
    "inner-shadow": "Inner shadow",
    "layer-blur": "Layer blur",
    "background-blur": "Background blur",
  };
  return map[type] || "Drop shadow";
}

function defaultEffect(type = "drop-shadow") {
  return {
    id: crypto.randomUUID(),
    type,
    visible: true,
    x: 0,
    y: 4,
    blur: ["layer-blur", "background-blur"].includes(type) ? 10 : 4,
    spread: 0,
    color: "#000000",
    opacity: 0.25,
  };
}

function activeEffect() {
  if (!activeEffectInfo) return null;
  const target =
    selectedObjects()[0] || (artboardSelected() ? state.doc.artboard : null);
  if (!target) return null;
  return (target.effects || []).find((e) => e.id === activeEffectInfo.effectId);
}

function syncEffectPopoverFields(eff) {
  if (!eff) return;
  $("effect-popover-title").textContent = effectTypeName(eff.type);
  const isShadow = ["drop-shadow", "inner-shadow"].includes(eff.type);
  $("shadow-fields").hidden = !isShadow;
  $("shadow-color-section").hidden = !isShadow;
  $("blur-fields").hidden = isShadow;

  if (isShadow) {
    updateInput("effect-x", eff.x ?? 0);
    updateInput("effect-y", eff.y ?? 4);
    updateInput("effect-blur", eff.blur ?? 4);
    updateInput("effect-spread", eff.spread ?? 0);
    updateInput("effect-hex", (eff.color || "#000000").replace("#", ""));
    updateInput("effect-opacity", Math.round((eff.opacity ?? 0.25) * 100));
    $("effect-color-preview").style.background = eff.color || "#000000";
  } else {
    updateInput("effect-blur-only", eff.blur ?? 10);
  }
}

function positionEffectPopover() {
  if ($("effect-popover").hidden) return;
  const popup = $("effect-popover"),
    anchor = (effectPopoverAnchor || $("add-effect")).getBoundingClientRect();
  const inspector = document.querySelector(".inspector").getBoundingClientRect();
  const width = popup.offsetWidth || 230,
    height = popup.offsetHeight || 180;
  popup.style.left = `${Math.max(8, inspector.left - width - 12)}px`;
  popup.style.top = `${clamp(anchor.top - 40, 8, Math.max(8, window.innerHeight - height - 8))}px`;
}

function openEffectPopover(target, eff, anchor) {
  activeEffectInfo = { effectId: eff.id };
  effectPopoverAnchor = anchor;
  syncEffectPopoverFields(eff);
  $("effect-popover").hidden = false;
  positionEffectPopover();
  document.querySelectorAll(".effect-row").forEach((r) => {
    r.classList.toggle("active", r.dataset.effectId === eff.id);
  });
}

function closeEffectPopover() {
  $("effect-popover").hidden = true;
  activeEffectInfo = null;
  document.querySelectorAll(".effect-row").forEach((r) => r.classList.remove("active"));
}

function toggleEffectPopover(target, eff, anchor) {
  if (activeEffectInfo?.effectId === eff.id && !$("effect-popover").hidden) {
    closeEffectPopover();
  } else {
    openEffectPopover(target, eff, anchor);
  }
}

function updateActiveEffect(updater) {
  if (!activeEffectInfo) return;
  const eff = activeEffect();
  if (!eff) return;
  updater(eff);
  const target =
    selectedObjects()[0] || (artboardSelected() ? state.doc.artboard : null);
  if (!artboardSelected()) {
    const selected = selectedObjects();
    if (selected.length > 1) {
      selected.forEach((o) => {
        if (o.id !== target.id) {
          const match = (o.effects || []).find(
            (e) => e.id === eff.id || e.type === eff.type,
          );
          if (match) updater(match);
        }
      });
    }
  }
  syncEffectPopoverFields(eff);
  renderFast();
}

function renderEffects(target) {
  const list = $("effects-list");
  if (!list) return;
  list.replaceChildren();
  const effects = target.effects || [];

  effects.forEach((eff) => {
    const row = document.createElement("div");
    row.className = `effect-row${activeEffectInfo?.effectId === eff.id && !$("effect-popover").hidden ? " active" : ""}`;
    row.dataset.effectId = eff.id;

    const settingsBtn = document.createElement("button");
    settingsBtn.className = "effect-settings-btn";
    settingsBtn.type = "button";
    settingsBtn.title = "Effect settings";
    settingsBtn.setAttribute("aria-label", "Effect settings");
    settingsBtn.innerHTML = `<i data-lucide="sliders-horizontal"></i>`;
    settingsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleEffectPopover(target, eff, settingsBtn);
    });

    const select = document.createElement("select");
    select.className = "effect-type-select";
    select.setAttribute("aria-label", "Effect type");
    [
      { value: "drop-shadow", label: "Drop shadow" },
      { value: "inner-shadow", label: "Inner shadow" },
      { value: "layer-blur", label: "Layer blur" },
      { value: "background-blur", label: "Background blur" },
    ].forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      if (eff.type === opt.value) o.selected = true;
      select.append(o);
    });
    select.addEventListener("change", (e) => {
      transaction(() => {
        eff.type = e.target.value;
        if (["layer-blur", "background-blur"].includes(eff.type)) {
          eff.blur ||= 10;
        } else {
          eff.blur ||= 4;
          eff.color ||= "#000000";
          eff.opacity ??= 0.25;
        }
      });
      activeEffectInfo = { effectId: eff.id };
      syncEffectPopoverFields(eff);
    });

    const actions = document.createElement("div");
    actions.className = "effect-actions";

    const toggleBtn = document.createElement("button");
    toggleBtn.className = `micro-button effect-toggle-btn${!eff.visible ? " is-hidden" : ""}`;
    toggleBtn.type = "button";
    toggleBtn.title = eff.visible ? "Hide effect" : "Show effect";
    toggleBtn.setAttribute("aria-label", eff.visible ? "Hide effect" : "Show effect");
    toggleBtn.innerHTML = `<i data-lucide="${eff.visible ? "eye" : "eye-off"}"></i>`;
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      transaction(() => {
        eff.visible = !eff.visible;
      });
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "micro-button effect-delete-btn";
    deleteBtn.type = "button";
    deleteBtn.title = "Remove effect";
    deleteBtn.setAttribute("aria-label", "Remove effect");
    deleteBtn.innerHTML = `<i data-lucide="minus"></i>`;
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      transaction(() => {
        if (artboardSelected()) {
          state.doc.artboard.effects = (state.doc.artboard.effects || []).filter((e) => e.id !== eff.id);
        } else {
          selectedObjects().forEach((o) => {
            o.effects = (o.effects || []).filter((e) => e.id !== eff.id);
          });
        }
      });
      if (activeEffectInfo?.effectId === eff.id) {
        closeEffectPopover();
      }
    });

    actions.append(toggleBtn, deleteBtn);
    row.append(settingsBtn, select, actions);
    list.append(row);
  });

  if (!$("effect-popover").hidden && activeEffectInfo) {
    const eff = activeEffect();
    if (eff) syncEffectPopoverFields(eff);
    else closeEffectPopover();
  }

  refreshIcons();
}

$("add-effect").addEventListener("click", () => {
  const selectedObjs = selectedObjects();
  if (!selectedObjs.length && !artboardSelected()) return;
  transaction(() => {
    const newEff = defaultEffect("drop-shadow");
    if (artboardSelected()) {
      state.doc.artboard.effects ||= [];
      state.doc.artboard.effects.push(newEff);
    } else {
      selectedObjs.forEach((o) => {
        o.effects ||= [];
        o.effects.push({ ...newEff, id: crypto.randomUUID() });
      });
    }
  });
  const target = selectedObjs[0] || state.doc.artboard;
  const eff = target.effects[target.effects.length - 1];
  const lastRow = $("effects-list").lastElementChild;
  const anchor = lastRow?.querySelector(".effect-settings-btn") || $("add-effect");
  openEffectPopover(target, eff, anchor);
});

for (const prop of ["x", "y", "blur", "spread"]) {
  $(`effect-${prop}`).addEventListener("input", (e) => {
    const val = Number(e.target.value) || 0;
    updateActiveEffect((eff) => {
      eff[prop] = prop === "blur" ? Math.max(0, val) : val;
    });
  });
  $(`effect-${prop}`).addEventListener("change", () => save());
}
$("effect-blur-only").addEventListener("input", (e) => {
  const val = Math.max(0, Number(e.target.value) || 0);
  updateActiveEffect((eff) => {
    eff.blur = val;
  });
});
$("effect-blur-only").addEventListener("change", () => save());

$("effect-hex").addEventListener("change", (e) => {
  const hex = normalizeHex(e.target.value);
  if (hex) {
    updateActiveEffect((eff) => {
      eff.color = hex;
    });
    save();
  } else {
    e.target.value = (activeEffect()?.color || "#000000").replace("#", "");
    toast("Enter a valid hex color, such as #000000.");
  }
});

$("effect-opacity").addEventListener("change", (e) => {
  const num = clamp(Number(e.target.value) || 0, 0, 100);
  updateActiveEffect((eff) => {
    eff.opacity = num / 100;
  });
  save();
});

$("effect-color-preview").addEventListener("click", () => {
  const eff = activeEffect();
  if (eff) $("effect-native-color").value = eff.color || "#000000";
  $("effect-native-color").click();
});
$("effect-native-color").addEventListener("input", (e) => {
  updateActiveEffect((eff) => {
    eff.color = e.target.value;
  });
});
$("effect-native-color").addEventListener("change", () => save());

$("close-effect-popover").addEventListener("click", () => closeEffectPopover());
window.addEventListener("resize", positionEffectPopover);
document.addEventListener("pointerdown", (e) => {
  if (
    !$("effect-popover").hidden &&
    !e.target.closest(
      "#effect-popover, .effect-settings-btn, #add-effect, .effects-section, .effect-row",
    )
  ) {
    closeEffectPopover();
  }
});
window.addEventListener(
  "keydown",
  (e) => {
    if (e.key === "Escape" && !$("effect-popover").hidden) {
      e.preventDefault();
      e.stopImmediatePropagation();
      closeEffectPopover();
    }
  },
  true,
);



// Fonts are loaded before changing text metrics and saved locally for future visits.
function refreshFontOptions() {
  const current = $("font-family").value;
  const families = [
    ...new Set([
      ...fontFamilies(),
      ...state.doc.objects
        .filter((o) => o.type === "text")
        .map((o) => o.fontFamily),
    ]),
  ];
  $("font-family").replaceChildren(
    ...families.map((family) => {
      const option = document.createElement("option");
      option.value = option.textContent = family;
      return option;
    }),
  );
  $("font-family").value = current || "Inter";
  $("font-library").replaceChildren(
    ...fontFamilies().map((family) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = family;
      button.style.fontFamily = JSON.stringify(family);
      button.title = `Apply ${family}`;
      button.addEventListener("click", () => {
        applyFont(family);
        $("font-dialog").close();
      });
      return button;
    }),
  );
}
function applyFont(
  family,
  ids = selectedObjects()
    .filter((o) => o.type === "text")
    .map((o) => o.id),
) {
  transaction(() => {
    state.doc.objects
      .filter((o) => ids.includes(o.id) && o.type === "text")
      .forEach((o) => {
        o.fontFamily = family;
        measureText(o);
      });
  });
  refreshFontOptions();
  renderProperties();
}
$("add-fonts").addEventListener("click", () => {
  closeColorPicker();
  refreshFontOptions();
  $("font-status").textContent = "";
  $("font-dialog").showModal();
});
$("close-font-dialog").addEventListener("click", () =>
  $("font-dialog").close(),
);
for (const source of ["google", "local"])
  $("font-source-" + source).addEventListener("click", () => {
    $("google-font-form").hidden = source !== "google";
    $("local-font-form").hidden = source !== "local";
    $("font-source-google").classList.toggle("active", source === "google");
    $("font-source-local").classList.toggle("active", source === "local");
    $("font-status").textContent = "";
  });
for (const source of ["google", "local"])
  $(source + "-font-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = $("load-" + source + "-font"),
      ids = selectedObjects()
        .filter((o) => o.type === "text")
        .map((o) => o.id);
    button.disabled = true;
    $("font-status").textContent = "Loading font…";
    try {
      const family =
        source === "google"
          ? await importGoogleFont($("google-font-name").value)
          : await importLocalFont(
              $("local-font-file").files[0],
              $("local-font-family").value,
              $("local-font-weight").value,
            );
      refreshFontOptions();
      applyFont(family, ids);
      $("font-status").textContent =
        `${family} added${ids.length ? " and applied" : ""}. Saved on this device.`;
    } catch (error) {
      $("font-status").textContent =
        error.message.includes("fetch") || error.name === "TimeoutError"
          ? "Unable to download the font. Check your connection and try again."
          : error.message;
    } finally {
      button.disabled = false;
    }
  });

$("clip-content").addEventListener("change", event => transaction(() => { state.doc.artboard.clipContent = event.target.checked; }));
// Inspector controls.
document
  .querySelectorAll("[data-tool]")
  .forEach((button) =>
    button.addEventListener("click", () => setTool(button.dataset.tool)),
  );
for (const key of ["x", "y", "w", "h", "rotation", "opacity"]) {
  $(`prop-${key}`).addEventListener("change", (event) => {
    const value = Number(event.target.value),
      objs = selectedObjects();
    if (
      artboardSelected() &&
      ["x", "y", "w", "h"].includes(key) &&
      Number.isFinite(value)
    ) {
      transaction(() => {
        if (key === "x" || key === "y") {
          const f = state.doc.artboard; moveFrame(f, key === "x" ? value : f.x, key === "y" ? value : f.y); return;
        }
        state.doc.artboard[key === "w" ? "width" : "height"] = clamp(
          value,
          1,
          50000,
        );
        if (state.doc.artboard.autoLayout?.enabled) {
          state.doc.artboard.autoLayout[key === "w" ? "widthSizing" : "heightSizing"] = "fixed";
          applyAutoLayout(state.doc.artboard);
        }
      });
      return;
    }
    if (!Number.isFinite(value) || !objs.length) {
      renderProperties();
      return;
    }
    clearBuilder();
    transaction(() => {
      if (key === "opacity")
        objs.forEach((o) => {
          o.opacity = clamp(value / 100, 0, 1);
        });
      else if (key === "rotation")
        objs.forEach((o) => {
          o.rotation = value % 360;
        });
      else if (objs.length === 1)
        objs[0][key] = key === "w" || key === "h" ? Math.max(1, value) : value;
      else {
        const b = boundsOf(objs);
        if (key === "x" || key === "y")
          objs.forEach((o) => {
            o[key] += value - b[key];
          });
        else {
          const dimension = key,
            axis = key === "w" ? "x" : "y",
            scale = Math.max(1, value) / b[key];
          objs.forEach((o) => {
            o[axis] = b[axis] + (o[axis] - b[axis]) * scale;
            o[dimension] = Math.max(1, o[dimension] * scale);
          });
        }
      }
    });
  });
}
document.querySelectorAll(".align-row [data-align]").forEach((button) =>
  button.addEventListener("click", () => {
    const objs = selectedObjects();
    if (!objs.length) return;
    const b =
        objs.length > 1
          ? boundsOf(objs)
          : {
              x: state.doc.artboard.x,
              y: state.doc.artboard.y,
              w: state.doc.artboard.width,
              h: state.doc.artboard.height,
            },
      direction = button.dataset.align;
    clearBuilder();
    transaction(() =>
      objs.forEach((o) => {
        const ob = objectBounds(o);
        if (direction === "left") o.x += b.x - ob.x;
        if (direction === "center") o.x += b.x + b.w / 2 - ob.x - ob.w / 2;
        if (direction === "right") o.x += b.x + b.w - ob.x - ob.w;
        if (direction === "top") o.y += b.y - ob.y;
        if (direction === "middle") o.y += b.y + b.h / 2 - ob.y - ob.h / 2;
        if (direction === "bottom") o.y += b.y + b.h - ob.y - ob.h;
      }),
    );
  }),
);
$("add-autolayout")?.addEventListener("click", () => {
  if (artboardSelected()) enableAutoLayout(state.doc.artboard);
  else if (selectedObjects().length > 0) wrapSelectionInAutoLayout();
});
$("remove-autolayout")?.addEventListener("click", () => {
  if (artboardSelected()) removeAutoLayout(state.doc.artboard);
});
$("al-dir-horizontal")?.addEventListener("click", () => {
  if (artboardSelected() && state.doc.artboard.autoLayout?.enabled) {
    transaction(() => {
      state.doc.artboard.autoLayout.direction = "horizontal";
      applyAutoLayout(state.doc.artboard);
    });
  }
});
$("al-dir-vertical")?.addEventListener("click", () => {
  if (artboardSelected() && state.doc.artboard.autoLayout?.enabled) {
    transaction(() => {
      state.doc.artboard.autoLayout.direction = "vertical";
      applyAutoLayout(state.doc.artboard);
    });
  }
});
for (const axis of ["width", "height"]) {
  $(`child-${axis}-sizing`).addEventListener("change", event => {
    const child = selectedObjects()[0], parent = pageFrames().find(f => f.id === child?.frameId);
    if (!child || !parent?.autoLayout?.enabled) return;
    transaction(() => {
      child[`${axis}Sizing`] = event.target.value;
      if (event.target.value === "fill") parent.autoLayout[`${axis}Sizing`] = "fixed";
    });
  });
  $(`al-${axis}-sizing`).addEventListener("change", event => {
    if (!artboardSelected() || !state.doc.artboard.autoLayout?.enabled) return;
    transaction(() => {
      const parent = pageFrames().find(f => f.id === state.doc.artboard.parentId);
      if (event.target.value === "fill") {
        if (!parent?.autoLayout?.enabled) return;
        parent.autoLayout[`${axis}Sizing`] = "fixed";
      }
      state.doc.artboard.autoLayout[`${axis}Sizing`] = event.target.value;
    });
  });
}
$("al-sizing-hug")?.addEventListener("click", () => {
  if (artboardSelected() && state.doc.artboard.autoLayout?.enabled) {
    transaction(() => {
      state.doc.artboard.autoLayout.widthSizing = "hug";
      state.doc.artboard.autoLayout.heightSizing = "hug";
      state.doc.artboard.autoLayout.sizing = "hug";
      applyAutoLayout(state.doc.artboard);
    });
  }
});
$("al-sizing-fixed")?.addEventListener("click", () => {
  if (artboardSelected() && state.doc.artboard.autoLayout?.enabled) {
    transaction(() => {
      state.doc.artboard.autoLayout.widthSizing = "fixed";
      state.doc.artboard.autoLayout.heightSizing = "fixed";
      state.doc.artboard.autoLayout.sizing = "fixed";
      applyAutoLayout(state.doc.artboard);
    });
  }
});
document.querySelectorAll(".al-matrix .al-dot").forEach((dot) => {
  dot.addEventListener("click", () => {
    if (artboardSelected() && state.doc.artboard.autoLayout?.enabled) {
      const align = dot.dataset.alAlign || dot.dataset.align;
      transaction(() => {
        state.doc.artboard.autoLayout.align = align;
        applyAutoLayout(state.doc.artboard);
      });
    }
  });
});
["al-gap", "al-pad-x", "al-pad-y"].forEach((id) => {
  const prop = id === "al-gap" ? "gap" : id === "al-pad-x" ? "paddingX" : "paddingY";
  const handler = (event) => {
    if (!artboardSelected() || !state.doc.artboard.autoLayout?.enabled) return;
    const value = Math.max(0, Number(event.target.value) || 0);
    transaction(() => {
      state.doc.artboard.autoLayout[prop] = value;
      applyAutoLayout(state.doc.artboard);
    });
  };
  $(id)?.addEventListener("input", handler);
  $(id)?.addEventListener("change", handler);
});
for (const [id, key] of [
  ["font-size", "fontSize"],
  ["font-family", "fontFamily"],
  ["font-weight", "fontWeight"],
])
  $(id).addEventListener("change", (e) =>
    transaction(() =>
      selectedObjects()
        .filter((o) => o.type === "text")
        .forEach((o) => {
          o[key] =
            key === "fontFamily"
              ? e.target.value
              : clamp(Number(e.target.value) || 12, 6, 700);
          measureText(o);
        }),
    ),
  );
for (const kind of ["fill", "stroke"]) {
  $(`${kind}-hex`).addEventListener("change", (event) => {
    const color = normalizeHex(event.target.value);
    if (color) {
      state.paint = kind;
      applyPaint(color, kind);
    } else {
      toast("Enter a hex color, such as #0099FF.");
      event.target.value = (
        selectedObjects()[0]?.[kind] ||
        (kind === "fill"
          ? (artboardSelected() ? state.doc.artboard.fill : canvasColor())
          : defaults[kind])
      ).replace("#", "");
    }
  });
  $(`${kind}-preview`).addEventListener("click", () => {
    openColorPicker(kind);
  });
  $(`no-${kind}`).addEventListener("click", () => applyPaint("none", kind));
  $(`color-${kind}`).addEventListener("click", () => {
    state.paint = kind;
    renderSwatches();
    renderColor();
  });
}
$("stroke-width").addEventListener("change", (e) =>
  transaction(() => {
    const n = clamp(Number(e.target.value) || 0, 0, 200);
    defaults.strokeWidth = n;
    selectedObjects().forEach((o) => {
      o.strokeWidth = n;
      if (n && o.stroke === "none") o.stroke = "#242722";
    });
  }),
);
$("swatches").addEventListener("click", (event) => {
  const color = event.target.dataset.color;
  if (color) applyPaint(color);
});
$("add-swatch").addEventListener("click", () => {
  const color = currentColor();
  if (state.doc.swatches.includes(color)) {
    toast("This color is already in your palette.");
    return;
  }
  if (state.doc.swatches.length >= 128) {
    toast("Your palette is full.");
    return;
  }
  transaction(() => state.doc.swatches.push(color));
  renderSwatches();
  renderColor();
  toast("Color added to your palette");
});
$("color-hex").addEventListener("change", (e) => {
  const color = normalizeHex(e.target.value);
  if (color) applyPaint(color);
  else {
    e.target.value = currentColor();
    toast("Enter a valid hex color.");
  }
});
for (const id of ["color-r", "color-g", "color-b"])
  $(id).addEventListener("change", () => {
    const channels = ["color-r", "color-g", "color-b"].map((id) =>
      clamp(Number($(id).value) || 0, 0, 255),
    );
    applyPaint(rgbToHex(...channels));
  });
function setHsvColor() {
  pendingColor = true;
  applyPaint(hsvToHex(hsv.h, hsv.s, hsv.v), state.paint, true);
  updateColorSquare();
}
$("color-square").addEventListener("pointerdown", (event) => {
  event.preventDefault();
  const target = event.currentTarget;
  target.focus();
  target.setPointerCapture(event.pointerId);
  begin();
  const move = (e) => {
    const rect = target.getBoundingClientRect();
    hsv.s = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    hsv.v = 1 - clamp((e.clientY - rect.top) / rect.height, 0, 1);
    setHsvColor();
  };
  const finish = () => {
    target.removeEventListener("pointermove", move);
    pendingColor = false;
    save();
  };
  move(event);
  target.addEventListener("pointermove", move);
  target.addEventListener("pointerup", finish, { once: true });
  target.addEventListener("pointercancel", finish, { once: true });
});
$("color-square").addEventListener("keydown", (e) => {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key))
    return;
  e.preventDefault();
  hsv.s = clamp(
    hsv.s + (e.key === "ArrowRight" ? 0.01 : e.key === "ArrowLeft" ? -0.01 : 0),
    0,
    1,
  );
  hsv.v = clamp(
    hsv.v + (e.key === "ArrowUp" ? 0.01 : e.key === "ArrowDown" ? -0.01 : 0),
    0,
    1,
  );
  applyPaint(hsvToHex(hsv.h, hsv.s, hsv.v));
});
$("hue-slider").addEventListener("input", (e) => {
  hsv.h = +e.target.value;
  setHsvColor();
});
$("hue-slider").addEventListener("change", () => {
  pendingColor = false;
  save();
});
$("native-color").addEventListener("input", (e) => {
  pendingColor = true;
  applyPaint(e.target.value, state.paint, true);
});
$("native-color").addEventListener("change", () => {
  pendingColor = false;
  save();
});

// Normal layers follow paint order; auto-layout children follow layout order.
let layerSelectionAnchor = null;
$("layers").addEventListener("click", (event) => {
  const visibility = event.target.closest("[data-visibility]"),
    lock = event.target.closest("[data-lock]"),
    row = event.target.closest("[data-layer]");
  if (!row) return;
  const obj = getObject(row.dataset.layer);
  clearBuilder();
  if (visibility)
    transaction(() => {
      obj.visible = !obj.visible;
      if (!obj.visible)
        state.selected = state.selected.filter((id) => id !== obj.id);
    });
  else if (lock)
    transaction(() => {
      obj.locked = !obj.locked;
      if (obj.locked)
        state.selected = state.selected.filter((id) => id !== obj.id);
    });
  else {
    // Layer selection exits drawing mode and commits any pending pen path.
    // Otherwise the draft overlay hides selection and the next drag keeps drawing.
    if (state.tool !== "select" && state.tool !== "direct") setTool("select");
    if (event.shiftKey && layerSelectionAnchor) {
      const rows = [...$("layers").querySelectorAll("[data-layer]")].filter(row => row.getClientRects().length);
      const start = rows.findIndex(row => row.dataset.layer === layerSelectionAnchor);
      const end = rows.findIndex(row => row.dataset.layer === obj.id);
      if (start >= 0 && end >= 0) state.selected = rows.slice(Math.min(start,end),Math.max(start,end)+1).map(row => getObject(row.dataset.layer)).filter(o => o.visible && !o.locked).map(o => o.id);
      else selectObject(obj, true);
    } else {
      selectObject(obj, event.metaKey || event.ctrlKey);
      layerSelectionAnchor = obj.id;
    }
    if (obj.locked) toast("Unlock this layer to edit it.");
    else if (!obj.visible) toast("Show this layer to select it on the canvas.");
    render();
    svg.focus({ preventScroll: true });
  }
});
$("layers").addEventListener("keydown", (event) => {
  if (event.target.tagName === "INPUT") return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    event.target.click();
  }
});
$("layers").addEventListener("dblclick", (event) => {
  const name = event.target.closest(".layer-name");
  if (!name) return;
  if (!name.closest("[data-layer]")) return;
  const row = name.closest("[data-layer]"),
    obj = getObject(row.dataset.layer),
    input = document.createElement("input");
  input.value = obj.name;
  input.setAttribute("aria-label", "Layer name");
  name.replaceChildren(input);
  row.draggable = false;
  input.focus();
  input.select();
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    transaction(() => {
      obj.name = input.value.trim().slice(0, 100) || obj.name;
    });
  };
  input.addEventListener("click", (e) => e.stopPropagation());
  input.addEventListener("blur", finish);
  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") input.blur();
    if (e.key === "Escape") {
      done = true;
      layerStructure = "";
      renderLayers();
    }
  });
});
$("layers").addEventListener("dragstart", (event) => {
  const row = event.target.closest("[data-layer], [data-frame-id]");
  if (!row) return;
  draggedLayer = row.dataset.layer || row.dataset.frameId;
  event.dataTransfer.setData("text/plain", draggedLayer);
  event.dataTransfer.effectAllowed = "move";
});
$("layers").addEventListener("dragover", (event) => {
  const row = event.target.closest("[data-layer]");
  if (!draggedLayer) return;
  event.preventDefault();
  if (!row) return;
  document
    .querySelectorAll(".drag-over")
    .forEach((r) => r.classList.remove("drag-over"));
  row.classList.add("drag-over");
});
$("layers").addEventListener("drop", (event) => {
  event.preventDefault();
  const row = event.target.closest("[data-layer]");
  if (!draggedLayer || row?.dataset.layer === draggedLayer) return;
  if (!row && !event.target.closest("[data-frame-id]")) {
    transaction(() => { const frame = pageFrames().find(f => f.id === draggedLayer); if (frame) frame.parentId = null; else getObject(draggedLayer).frameId = null; });
    draggedLayer = null; return;
  }
  if (!row) return;
  const target = getObject(row.dataset.layer),
    source = getObject(draggedLayer),
    after =
      event.clientY >
      row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
  if (!source || !target) return;
  transaction(() => {
    state.doc.objects = state.doc.objects.filter((o) => o.id !== source.id);
    const index = state.doc.objects.findIndex((o) => o.id === target.id);
    source.frameId = target.frameId;
    placeLayoutChild(pageFrames().find(f => f.id === target.frameId), source.id, target.id, after);
    const layoutOrder = pageFrames().find(f => f.id === target.frameId)?.autoLayout?.enabled;
    state.doc.objects.splice(index + (layoutOrder ? (after ? 1 : 0) : (after ? 0 : 1)), 0, source);
  });
  clearBuilder();
  draggedLayer = null;
});
$("layers").addEventListener("dragend", () => {
  draggedLayer = null;
  document
    .querySelectorAll(".drag-over")
    .forEach((r) => r.classList.remove("drag-over"));
});
$("artboard-label").setAttribute("tabindex", "0");
$("artboard-label").setAttribute("role", "button");
$("artboard-label").addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    event.stopPropagation();
    selectArtboard();
  }
  if (event.key === "F2") {
    event.preventDefault();
    event.stopPropagation();
    selectArtboard();
    renameArtboard();
  }
});
$("artboard-tree").addEventListener("click", (event) => {
  if (!$("artboard-tree").firstElementChild.contains(event.target)) {
    selectArtboard();
    return;
  }
  $("layers").hidden = !$("layers").hidden;
  $("artboard-tree").setAttribute("aria-expanded", !$("layers").hidden);
  $("artboard-tree").firstElementChild.style.transform = $("layers").hidden
    ? "rotate(-90deg)"
    : "";
});
$("duplicate").addEventListener("click", duplicateSelection);
document
  .querySelectorAll("[data-boolean]")
  .forEach((b) =>
    b.addEventListener("click", () => performBoolean(b.dataset.boolean)),
  );

function undoRedo(direction) {
  if (textEditor) finishText();
  if (state.pointer) finishGesture(null, true);
  state.pen = [];
  clearBuilder();
  if (history(direction)) {
    renderSwatches();
    render();
  }
}
$("undo").addEventListener("click", () => undoRedo("undo"));
$("redo").addEventListener("click", () => undoRedo("redo"));
$("toggle-pixel-grid").addEventListener("click", () => {
  pixelGridVisible = !pixelGridVisible;
  localStorage.setItem("illigma.pixel-grid", String(pixelGridVisible));
  renderView();
});
$("zoom-in").addEventListener("click", () => zoomAt(1.2));
$("zoom-out").addEventListener("click", () => zoomAt(1 / 1.2));
$("zoom-value").addEventListener("click", () => zoomAt(1 / state.zoom));
$("fit-canvas").addEventListener("click", fitCanvas);
$("document-title").addEventListener("change", (e) =>
  transaction(() => {
    state.doc.title = e.target.value.trim() || "Untitled document";
  }),
);
$("design-tab").addEventListener("click", () => {
  document
    .querySelector(".inspector-scroll")
    .scrollTo({ top: 0, behavior: "smooth" });
});
function toggleMenu(open) {
  $("document-menu").hidden = !open;
  $("menu-button").setAttribute("aria-expanded", open);
}
$("menu-button").addEventListener("click", () =>
  toggleMenu($("document-menu").hidden),
);
document.addEventListener("pointerdown", (e) => {
  if (!e.target.closest("#document-menu") && !e.target.closest("#menu-button"))
    toggleMenu(false);
});
function openHelp() {
  toggleMenu(false);
  $("help-dialog").showModal();
}
$("show-help").addEventListener("click", openHelp);
$("close-help").addEventListener("click", () => $("help-dialog").close());
$("help-dialog").addEventListener("click", (e) => {
  if (e.target === $("help-dialog")) {
    const r = e.target.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      e.target.close();
  }
});
function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function safeFileName() {
  return (
    state.doc.title.replace(/[^\p{L}\p{N}\s_-]/gu, "").trim() || "Untitled"
  );
}
$("save-json").addEventListener("click", () => {
  if (textEditor) finishText();
  syncActivePage();
  download(
    new Blob([JSON.stringify(state.doc, null, 2)], {
      type: "application/json",
    }),
    `${safeFileName()}.illigma`,
  );
  toggleMenu(false);
  toast("Editable document saved");
});
$("open-json").addEventListener("click", () => {
  toggleMenu(false);
  $("file-input").click();
});
$("file-input").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 15 * 1024 * 1024)
      throw new Error("File is too large (15 MB maximum).");
    const doc = JSON.parse(await file.text());
    if (!validDocument(doc))
      throw new Error("This is not a valid Illigma document.");
    if (textEditor) finishText();
    clearBuilder();
    state.pen = [];
    replaceDocument(doc);
    refreshFontOptions();
    renderSwatches();
    render();
    fitCanvas();
    toast("Document opened · Undo to return to your previous work");
  } catch (error) {
    toast(error.message);
  } finally {
    event.target.value = "";
  }
});
function loadDocument(doc) {
  if (textEditor) finishText();
  clearBuilder();
  state.pen = [];
  replaceDocument(doc);
  renderSwatches();
  setTool("select");
  render();
  fitCanvas();
  toggleMenu(false);
}
$("new-document").addEventListener("click", () => {
  loadDocument({
    version: 1,
    title: "Untitled document",
    artboard: { width: 1000, height: 720, fill: "#ffffff" },
    objects: [],
    swatches: [...state.doc.swatches],
  });
  toast("New document · Undo to return to your previous work");
});
$("reset-demo").addEventListener("click", () => {
  const doc = sampleDocument();
  doc.objects.filter((o) => o.type === "text").forEach(measureText);
  loadDocument(doc);
});
export function exportSvg() {
  const frames = pageFrames();
  const left = Math.min(...frames.map((f) => f.x)),
    top = Math.min(...frames.map((f) => f.y));
  const width = Math.max(...frames.map((f) => f.x + f.width)) - left;
  const height = Math.max(...frames.map((f) => f.y + f.height)) - top;
  const output = el("svg", {
    xmlns: NS,
    width,
    height,
    viewBox: `${left} ${top} ${width} ${height}`,
  });
  output.append(el("title", {}, state.doc.title));
  const defs = el("defs");
  frames.forEach((f, i) => {
    const clip = el("clipPath", {
      id: `export-frame-${i}`,
      clipPathUnits: "userSpaceOnUse",
    });
    clip.append(el("rect", frameClipBounds(f)));
    defs.append(clip);
    const parentClip = el("clipPath", {id:`export-parent-${i}`,clipPathUnits:"userSpaceOnUse"});
    parentClip.append(el("rect", frameClipBounds(f, false))); defs.append(parentClip);
  });
  frames.forEach((f) => {
    const filter = createFilterElement(`export-filter-${f.id}`, f.effects, 0);
    if (filter) defs.append(filter);
  });
  state.doc.objects
    .filter((o) => o.visible)
    .forEach((o) => {
      const filter = createFilterElement(
        `export-filter-${o.id}`,
        o.effects,
        o.rotation,
      );
      if (filter) defs.append(filter);
    });
  output.append(defs);
  frames.forEach((f) => {
    const hasFilter = (f.effects || []).some(
      (e) => e && e.visible !== false && e.type !== "background-blur",
    );
    const rect = el("rect", {
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      fill: f.fill,
      ...(hasFilter ? { filter: `url(#export-filter-${f.id})` } : {}),
    });
    rect.setAttribute("clip-path", `url(#export-parent-${frames.indexOf(f)})`);
    output.append(rect);
  });
  state.doc.objects
    .filter((o) => o.visible)
    .forEach((o) => {
      const hasFilter = (o.effects || []).some(
        (e) => e && e.visible !== false && e.type !== "background-blur",
      );
      const group = el("g", {
        transform: transform(o),
        ...(hasFilter ? { filter: `url(#export-filter-${o.id})` } : {}),
      });
      group.append(el("title", {}, o.name));
      group.append(shapeElement(o));
      const index = frames.findIndex(
        (f) => f.id === o.frameId,
      );
      const wrapper = el(
        "g",
        index >= 0 ? { "clip-path": `url(#export-frame-${index})` } : {},
      );
      wrapper.append(group);
      output.append(wrapper);
    });
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    new XMLSerializer().serializeToString(output)
  );
}
$("export").addEventListener("click", () => {
  if (textEditor) finishText();
  if (state.pen.length) finishPen();
  download(
    new Blob([exportSvg()], { type: "image/svg+xml" }),
    `${safeFileName()}.svg`,
  );
  toast("SVG exported. Make something great.");
});

// Keyboard commands do not intercept typing in the inspector or text editor.
window.addEventListener("keydown", (event) => {
  if (
    event.target.closest("input, textarea, select, [contenteditable=true]") ||
    $("help-dialog").open ||
    $("font-dialog").open
  )
    return;
  const key = event.key.toLowerCase(),
    mod = event.metaKey || event.ctrlKey;
  if (event.key === "Alt") {
    altKeyIsDown = true;
    if (state.selected.length > 0) renderSelection();
  }
  if (event.code === "Space") {
    event.preventDefault();
    state.space = true;
    $("eyedropper-preview").hidden = true;
    svg.dataset.tool = "hand";
    return;
  }
  if (
    state.tool === "pen" &&
    !state.pointer &&
    (state.pen.length || penRedo.length)
  ) {
    if (mod && (key === "z" || key === "y")) {
      event.preventDefault();
      if (event.shiftKey || key === "y") {
        if (penRedo.length) state.pen.push(penRedo.pop());
      } else if (state.pen.length) penRedo.push(state.pen.pop());
      renderSelection();
      return;
    }
    if (key === "backspace" || key === "delete") {
      event.preventDefault();
      if (state.pen.length) penRedo.push(state.pen.pop());
      renderSelection();
      return;
    }
  }
  if (mod && key === "z") {
    event.preventDefault();
    undoRedo(event.shiftKey ? "redo" : "undo");
    return;
  }
  if (mod && key === "y") {
    event.preventDefault();
    undoRedo("redo");
    return;
  }
  if (key === "a" && event.shiftKey) {
    event.preventDefault();
    if (event.altKey) {
      if (artboardSelected()) removeAutoLayout(state.doc.artboard);
    } else {
      if (artboardSelected()) enableAutoLayout(state.doc.artboard);
      else if (selectedObjects().length > 0) wrapSelectionInAutoLayout();
    }
    return;
  }
  if (mod && key === "a") {
    event.preventDefault();
    state.selected = state.doc.objects
      .filter((o) => o.visible && !o.locked)
      .map((o) => o.id);

    clearBuilder();
    render();
    return;
  }
  if (mod && ["c", "x", "v"].includes(key)) {
    event.preventDefault();
    closeContextMenu();
    if (key === "v") pasteObjects();
    else { copySelection(); if (key === "x") deleteSelection(); }
    return;
  }
  if (mod && key === "d") {
    event.preventDefault();
    duplicateSelection();
    return;
  }
  if (mod && key === "g") {
    event.preventDefault();
    if (event.shiftKey) ungroupSelection();
    else groupSelection();
    return;
  }
  if (mod && key === "s") {
    event.preventDefault();
    $("save-json").click();
    return;
  }
  if (mod) return;
  if (key === "escape") {
    if (state.pointer) finishGesture(null, true);
    state.pen = [];
    penHover = null;
    penRedo = [];
    clearBuilder();
    state.selected = [];
    toggleMenu(false);
    setTool("select");
    return;
  }
  if (key === "enter" && state.pen.length) {
    event.preventDefault();
    finishPen();
    setTool("select");
    return;
  }
  if (key === "delete" || key === "backspace") {
    event.preventDefault();
    deleteSelection();
    return;
  }
  if (event.shiftKey && event.code === "Digit1") {
    event.preventDefault();
    fitCanvas();
    return;
  }
  if (key === "=" || key === "+") {
    zoomAt(1.2);
    return;
  }
  if (key === "-") {
    zoomAt(1 / 1.2);
    return;
  }
  if (key === "?") {
    openHelp();
    return;
  }
  if (key.startsWith("arrow")) {
    event.preventDefault();
    const n = event.shiftKey ? 10 : 1;
    const objs = selectedObjects();
    if (objs.length === 1 && objs[0].frameId) {
      const frame = pageFrames().find((f) => f.id === objs[0].frameId);
      if (frame?.autoLayout?.enabled) {
        const isHoriz = (frame.autoLayout.direction || "horizontal") === "horizontal";
        const movePrev = (isHoriz && key === "arrowleft") || (!isHoriz && key === "arrowup");
        const moveNext = (isHoriz && key === "arrowright") || (!isHoriz && key === "arrowdown");
        if (movePrev || moveNext) {
          transaction(() => {
            const siblings = frameContents(frame);
            const curIdx = siblings.findIndex((s) => s.id === objs[0].id);
            const targetIdx = curIdx + (movePrev ? -1 : 1);
            if (targetIdx >= 0 && targetIdx < siblings.length) {
              const targetSibling = siblings[targetIdx];
              const i = state.doc.objects.indexOf(objs[0]);
              const j = state.doc.objects.indexOf(targetSibling);
              [state.doc.objects[i], state.doc.objects[j]] = [state.doc.objects[j], state.doc.objects[i]];
              placeLayoutChild(frame, objs[0].id, targetSibling.id, moveNext);
              applyAutoLayout(frame);
            }
          });
          return;
        }
      }
    }
    if (artboardSelected() && !objs.length) {
      transaction(() => {
        const f = state.doc.artboard;
        const dx = key === "arrowleft" ? -n : key === "arrowright" ? n : 0;
        const dy = key === "arrowup" ? -n : key === "arrowdown" ? n : 0;
        moveFrame(f, f.x + dx, f.y + dy);
      });
      return;
    }
    transaction(() => {
      objs.forEach((o) => {
        if (key === "arrowleft") o.x -= n;
        if (key === "arrowright") o.x += n;
        if (key === "arrowup") o.y -= n;
        if (key === "arrowdown") o.y += n;
      });
      objs.forEach(assignFrame);
    });
    clearBuilder();
    return;
  }
  if (key === "]" || key === "[") {
    transaction(() => {
      const objs = selectedObjects();
      for (const obj of key === "]" ? [...objs].reverse() : objs) {
        const i = state.doc.objects.indexOf(obj),
          j = clamp(
            i + (key === "]" ? 1 : -1),
            0,
            state.doc.objects.length - 1,
          );
        [state.doc.objects[i], state.doc.objects[j]] = [
          state.doc.objects[j],
          state.doc.objects[i],
        ];
      }
    });
    return;
  }
  const tools = {
    v: "select",
    a: "direct",
    f: "frame",
    r: "rect",
    o: "ellipse",
    p: "pen",
    t: "text",
    i: "eyedropper",
    h: "hand",
  };
  if (key === "m" && event.shiftKey) setTool("builder");
  else if (tools[key]) setTool(tools[key]);
});
window.addEventListener("keyup", (event) => {
  if (event.key === "Alt") {
    altKeyIsDown = false;
    if (state.selected.length > 0) renderSelection();
  }
  if (event.code === "Space") {
    state.space = false;
    svg.dataset.tool = state.tool;
  }
});
window.addEventListener("blur", () => {
  altKeyIsDown = false;
  hoverTargetId = null;
  state.space = false;
  svg.dataset.tool = state.tool;
  if (state.selected.length > 0) renderSelection();
  if (state.pointer) finishGesture(null);
});
window.addEventListener("resize", () => {
  if (textEditor) finishText();
  renderView();
  renderSelection();
});

try {
  await restoreFonts();
} catch {
  /* Font import reports storage errors when used. */
}
refreshFontOptions();
await document.fonts.ready;
// Fresh sample text metrics are measured from the bundled font, not a network fallback.
if (state.fresh)
  state.doc.objects.filter((o) => o.type === "text").forEach(measureText);
refreshIcons();
renderSwatches();
render();
fitCanvas();
svg.dataset.tool = state.tool;
commit();
