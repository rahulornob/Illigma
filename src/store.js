import { clone } from "./geometry.js";
export const STORAGE_KEY = "illigma.document.v1";
export const defaults = { fill: "#2353e8", stroke: "#242529", strokeWidth: 0 };
export function makeObject(type, props = {}) {
  return {
    id: crypto.randomUUID(),
    type,
    name: { rect: "Rectangle", ellipse: "Ellipse", path: "Path", text: "Text" }[
      type
    ],
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    rotation: 0,
    opacity: 1,
    fill: defaults.fill,
    stroke: defaults.stroke,
    strokeWidth: defaults.strokeWidth,
    visible: true,
    locked: false,
    effects: props.effects ? clone(props.effects) : [],
    ...props,
  };
}
const ring = (w, h, t) =>
  `M ${w / 2} 0 A ${w / 2} ${h / 2} 0 1 1 ${w / 2 - 0.001} 0 Z M ${w / 2} ${t} A ${w / 2 - t} ${h / 2 - t} 0 1 0 ${w / 2 + 0.001} ${t} Z`;
export function sampleDocument() {
  const text = (name, value, x, y, size, extra = {}) =>
    makeObject("text", {
      name,
      text: value,
      x,
      y,
      fontSize: size,
      fontFamily: "Inter",
      fontWeight: 500,
      fill: "#242722",
      w: 400,
      h: size * 1.2,
      baseW: 400,
      baseH: size * 1.2,
      ...extra,
    });
  return {
    version: 1,
    title: "Objects in motion",
    canvasColor: "#090909",
    artboard: { width: 1000, height: 720, fill: "#f2f0e7" },
    swatches: [
      "#ffffff",
      "#f2f0e7",
      "#242722",
      "#2353e8",
      "#0099ff",
      "#fa633b",
      "#e6bd4d",
      "#bbbcad",
      "#9075de",
      "#e79cad",
      "#8eac94",
      "#7bc5c1",
      "#4a6d8c",
      "#9b694a",
      "#6b6964",
      "#090909",
    ],
    objects: [
      makeObject("ellipse", {
        name: "Orbital guide",
        x: 490,
        y: 143,
        w: 425,
        h: 425,
        fill: "none",
        stroke: "#c6c7bc",
        strokeWidth: 1,
        locked: true,
      }),
      text("Collection label", "EXPLORATIONS IN FORM", 60, 45, 11, {
        letterSpacing: 2.5,
        locked: true,
      }),
      text("Edition", "VOL. 01  /  2026", 816, 45, 10, {
        letterSpacing: 1.2,
        locked: true,
      }),
      makeObject("rect", {
        name: "Top rule",
        x: 60,
        y: 80,
        w: 880,
        h: 1,
        fill: "#bcbeb2",
        locked: true,
      }),
      text("Title", "Objects\nin motion.", 56, 158, 86, {
        fontWeight: 600,
        letterSpacing: -5.5,
      }),
      text(
        "Description",
        "A study of shape, space,\nand the beauty in between.",
        62,
        386,
        16,
        { fill: "#6e7167", lineHeight: 1.55 },
      ),
      makeObject("path", {
        name: "Orange orbit",
        x: 506,
        y: 292,
        w: 429,
        h: 235,
        baseW: 429,
        baseH: 235,
        d: ring(429, 235, 39),
        rotation: -34,
        fill: "#fa633b",
      }),
      makeObject("path", {
        name: "Blue orbit",
        x: 579,
        y: 158,
        w: 268,
        h: 340,
        baseW: 268,
        baseH: 340,
        d: ring(268, 340, 60),
        rotation: 24,
        fill: "#2353e8",
      }),
      makeObject("ellipse", {
        name: "Accent dot",
        x: 886,
        y: 165,
        w: 24,
        h: 24,
        fill: "#fa633b",
      }),
      makeObject("rect", {
        name: "Bottom rule",
        x: 60,
        y: 626,
        w: 880,
        h: 1,
        fill: "#bcbeb2",
        locked: true,
      }),
      text("Studio signature", "FORM & FEEL", 60, 653, 11, {
        letterSpacing: 2,
        fontWeight: 600,
        locked: true,
      }),
      text(
        "Footnote",
        "A little curiosity. Endless possibilities.",
        386,
        653,
        10,
        { fill: "#6e7167", locked: true },
      ),
      text("Page number", "001", 916, 650, 15, { locked: true }),
    ],
  };
}
export function validDocument(doc) {
  if (doc?.pages !== undefined) {
    if (
      !Array.isArray(doc.pages) ||
      !doc.pages.length ||
      doc.pages.length > 100 ||
      !doc.pages.some((p) => p.id === doc.activePageId)
    )
      return false;
    const pageIds = new Set();
    for (const page of doc.pages) {
      if (
        !page ||
        typeof page.id !== "string" ||
        pageIds.has(page.id) ||
        typeof page.name !== "string" ||
        !page.name.trim() ||
        page.name.length > 100
      )
        return false;
      pageIds.add(page.id);
      if (
        !validDocument({
          ...doc,
          pages: undefined,
          artboard: page.artboard,
          artboards: page.artboards,
          objects: page.objects,
          canvasColor: page.canvasColor,
        })
      )
        return false;
    }
  }

  if (
    doc?.artboard?.name !== undefined &&
    (typeof doc.artboard.name !== "string" || doc.artboard.name.length > 100)
  )
    return false;
  const color = (c) => typeof c === "string" && /^(#[\da-f]{6}|none)$/i.test(c);
  if (
    !doc ||
    doc.version !== 1 ||
    !Array.isArray(doc.objects) ||
    doc.objects.length > 3000 ||
    typeof doc.title !== "string" ||
    doc.title.length > 200 ||
    !doc.artboard ||
    !color(doc.artboard.fill) ||
    ![doc.artboard.width, doc.artboard.height].every(
      (n) => Number.isFinite(n) && n > 0 && n <= 50000,
    )
  )
    return false;
  if (
    !Array.isArray(doc.swatches) ||
    doc.swatches.length > 128 ||
    !doc.swatches.every(color) ||
    (doc.canvasColor !== undefined && !color(doc.canvasColor))
  )
    return false;
  const validEffects = (effects) => {
    if (effects === undefined) return true;
    if (!Array.isArray(effects) || effects.length > 50) return false;
    return effects.every((eff) => {
      if (
        !eff ||
        typeof eff.id !== "string" ||
        !["drop-shadow", "inner-shadow", "layer-blur", "background-blur"].includes(eff.type) ||
        typeof eff.visible !== "boolean"
      )
        return false;
      if (["drop-shadow", "inner-shadow"].includes(eff.type)) {
        return (
          [eff.x, eff.y, eff.blur, eff.spread, eff.opacity].every(Number.isFinite) &&
          eff.blur >= 0 &&
          eff.opacity >= 0 &&
          eff.opacity <= 1 &&
          color(eff.color)
        );
      }
      if (["layer-blur", "background-blur"].includes(eff.type)) {
        return Number.isFinite(eff.blur) && eff.blur >= 0;
      }
      return false;
    });
  };
  const validLayoutItem = item =>
    (item.constraints===undefined || (item.constraints && typeof item.constraints==='object' && !Array.isArray(item.constraints) &&
      ['horizontal','vertical'].every(axis=>item.constraints[axis]===undefined || ['start','end','stretch','center','scale'].includes(item.constraints[axis])))) &&
    (item.constraintTextWrap===undefined || typeof item.constraintTextWrap==='boolean') &&
    ["minWidth","maxWidth","minHeight","maxHeight"].every(key=>item[key]===undefined || (Number.isFinite(item[key]) && item[key]>=1 && item[key]<=50000)) &&
    ["widthSizing","heightSizing"].every(key=>item[key]===undefined || ["hug","fixed","fill"].includes(item[key])) &&
    (item.layoutAbsolute===undefined || typeof item.layoutAbsolute==="boolean") &&
    ["columnSpan","rowSpan"].every(key=>item[key]===undefined || (Number.isInteger(item[key]) && item[key]>=1 && item[key]<=(key==="columnSpan"?24:100)));
  if (doc.artboards !== undefined) {
    if (!Array.isArray(doc.artboards) || !doc.artboards.length || doc.artboards.length > 100) return false;
    const frameIds = new Set();
    for (const frame of doc.artboards) {
      if (!frame || !validLayoutItem(frame) || typeof frame.id !== "string" || frameIds.has(frame.id) ||
          ![frame.x, frame.y].every(n => Number.isFinite(n) && Math.abs(n) <= 1000000) ||
          ![frame.width, frame.height].every(n => Number.isFinite(n) && n > 0 && n <= 50000) ||
          !color(frame.fill) || !validEffects(frame.effects) || (frame.name !== undefined && (typeof frame.name !== "string" || frame.name.length > 100))) return false;
      if (frame.autoLayout !== undefined) {
        const al = frame.autoLayout;
        if (!al || typeof al.enabled !== "boolean" ||
            (al.direction !== undefined && !["horizontal", "vertical", "grid"].includes(al.direction)) ||
            ["crossGap", "paddingX", "paddingY", "paddingLeft", "paddingRight", "paddingTop", "paddingBottom"].some(key => al[key] !== undefined && (!Number.isFinite(al[key]) || al[key] < 0 || al[key] > 50000)) ||
            ["sizing", "widthSizing", "heightSizing"].some(key => al[key] !== undefined && !["hug", "fixed", "fill"].includes(al[key])) ||
            (al.gap !== undefined && (!Number.isFinite(al.gap) || Math.abs(al.gap)>50000)) ||
            (al.wrap !== undefined && typeof al.wrap !== "boolean") ||
            (al.spacingMode !== undefined && !["packed","between","around","evenly"].includes(al.spacingMode)) ||
            (al.columns !== undefined && (!Number.isInteger(al.columns) || al.columns<1 || al.columns>24)) ||
            ["columnTracks","rowTracks"].some(key=>al[key] !== undefined && (typeof al[key]!=="string" || al[key].length>2000)) ||
            (al.childOrder !== undefined && (!Array.isArray(al.childOrder) || al.childOrder.length > 3100 || !al.childOrder.every(id => typeof id === "string")))) return false;
      }
      frameIds.add(frame.id);
    }
    for (const frame of doc.artboards) {
      const seen = new Set([frame.id]); let current = frame;
      while (current.parentId != null) {
        if (typeof current.parentId !== "string" || seen.has(current.parentId)) return false;
        seen.add(current.parentId); current = doc.artboards.find(f => f.id === current.parentId);
        if (!current) return false;
      }
    }
  }
  const ids = new Set();
  return doc.objects.every((o) => {
    if (
      !o ||
      typeof o.id !== "string" ||
      ids.has(o.id) ||
      typeof o.name !== "string" ||
      !["rect", "ellipse", "path", "text"].includes(o.type) ||
      !validEffects(o.effects) || !validLayoutItem(o)
    )
      return false;
    if (o.frameId !== undefined && o.frameId !== null && (typeof o.frameId !== "string" || (doc.artboards && !doc.artboards.some(f => f.id === o.frameId)))) return false;
    ids.add(o.id);
    if (
      ![o.x, o.y, o.w, o.h, o.rotation, o.opacity, o.strokeWidth].every(
        Number.isFinite,
      ) ||
      o.w <= 0 ||
      o.h <= 0 ||
      o.opacity < 0 ||
      o.opacity > 1 ||
      o.strokeWidth < 0 ||
      !color(o.fill) ||
      !color(o.stroke)
    )
      return false;
    if (
      o.type === "path" &&
      (typeof o.d !== "string" ||
        !/^[\d\s.,+eE\-MmZzLlHhVvCcSsQqTtAa]*$/.test(o.d))
    )
      return false;
    if (
      ["path", "text"].includes(o.type) &&
      ![o.baseW, o.baseH].every((n) => Number.isFinite(n) && n > 0)
    )
      return false;
    if (
      o.type === "text" &&
      (typeof o.text !== "string" ||
        !Number.isFinite(o.fontSize) ||
        o.fontSize <= 0 ||
        typeof o.fontFamily !== "string" ||
        o.fontFamily.length > 100 ||
        !/^[\p{L}\p{N} ._-]+$/u.test(o.fontFamily) ||
        ![400, 500, 600, 700].includes(Number(o.fontWeight)))
    )
      return false;
    if (o.letterSpacing !== undefined && !Number.isFinite(o.letterSpacing))
      return false;
    if (
      o.lineHeight !== undefined &&
      (!Number.isFinite(o.lineHeight) || o.lineHeight <= 0)
    )
      return false;
    return true;
  });
}
// The root fields remain aliases for the active page for the rendering engine.
export function preparePages(doc) {
  doc.canvasColor ||= "#090909";
  if (!doc.pages) {
    const id = crypto.randomUUID();
    doc.pages = [
      { id, name: "Page 1", artboard: doc.artboard, objects: doc.objects, canvasColor: doc.canvasColor },
    ];
    doc.activePageId = id;
  }
  for (const p of doc.pages) {
    p.canvasColor ||= doc.canvasColor || "#090909";
    p.artboards ||= [p.artboard];
    for (const [index, frame] of p.artboards.entries()) {
      frame.id ||= crypto.randomUUID(); frame.x ??= 0; frame.y ??= 0;
      frame.name ||= p.artboard?.name || `Frame ${index + 1}`;
      frame.clipContent ??= true;
      frame.effects ||= [];
    }
    for (const o of p.objects) {
      o.effects ||= [];
      if (o.frameId === undefined) {
        const frame = [...p.artboards].reverse().find(f => o.x + o.w / 2 >= f.x && o.y + o.h / 2 >= f.y && o.x + o.w / 2 <= f.x + f.width && o.y + o.h / 2 <= f.y + f.height);
        o.frameId = frame?.id || null;
      }
    }
    p.artboard = p.artboards.find(f => f.id === p.artboard?.id) || p.artboards[0];
  }
  const page = doc.pages.find((p) => p.id === doc.activePageId) || doc.pages[0];
  doc.activePageId = page.id;
  doc.canvasColor = page.canvasColor || doc.canvasColor || "#090909";
  doc.artboard = page.artboard;
  doc.artboards = page.artboards;
  doc.objects = page.objects;
  return doc;
}
export function syncActivePage() {
  const page = state.doc.pages.find((p) => p.id === state.doc.activePageId);
  page.artboards ||= [state.doc.artboard];
  state.doc.artboards = page.artboards;
  page.artboard = state.doc.artboard;
  page.objects = state.doc.objects;
  page.canvasColor = state.doc.canvasColor || page.canvasColor || "#090909";
}
let initial;
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (validDocument(saved)) initial = saved;
} catch {
  /* Corrupt or unavailable storage starts a fresh document. */
}
export const state = {
  fresh: !initial,
  doc: preparePages(initial || sampleDocument()),
  selected: [],
  tool: "select",
  zoom: 1,
  pan: { x: 0, y: 0 },
  paint: "fill",
  pen: [],
  undo: [],
  redo: [],
  pointer: null,
  space: false,
  builder: null,
};
if (!initial)
  state.selected = [state.doc.objects.find((o) => o.name === "Blue orbit").id];
export const selectedObjects = () =>
  state.doc.objects.filter(
    (o) => state.selected.includes(o.id) && o.visible && !o.locked,
  );
export const snapshot = () => {
  syncActivePage();
  return JSON.stringify(state.doc);
};
let transaction;
export function begin() {
  if (transaction === undefined) transaction = snapshot();
}
export function commit() {
  const current = snapshot();
  if (transaction !== undefined && transaction !== current) {
    state.undo.push(transaction);
    if (state.undo.length > 100) state.undo.shift();
    state.redo = [];
  }
  transaction = undefined;
  try {
    localStorage.setItem(STORAGE_KEY, current);
    return true;
  } catch {
    return false;
  }
}
export function cancel() {
  if (transaction !== undefined)
    state.doc = preparePages(JSON.parse(transaction));
  transaction = undefined;
}
export function history(direction) {
  const from = state[direction],
    to = state[direction === "undo" ? "redo" : "undo"];
  if (!from.length) return false;
  to.push(snapshot());
  state.doc = preparePages(JSON.parse(from.pop()));
  state.selected = state.selected.filter((id) =>
    state.doc.objects.some((o) => o.id === id),
  );
  transaction = undefined;
  commit();
  return true;
}
export function replaceDocument(doc) {
  begin();
  state.doc = preparePages(clone(doc));
  state.selected = [];
  commit();
}
