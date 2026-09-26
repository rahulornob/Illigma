import paper from "paper";

paper.setup(new paper.Size(1, 1));
paper.settings.insertItems = false;
export { paper };
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const round = (n) => Math.round(n * 100) / 100;
export const clone = (value) => structuredClone(value);
export function rotatePoint(p, angle, center = { x: 0, y: 0 }) {
  const a = (angle * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a);
  return {
    x: center.x + (p.x - center.x) * c - (p.y - center.y) * s,
    y: center.y + (p.x - center.x) * s + (p.y - center.y) * c,
  };
}
export function localPoint(obj, point) {
  const p = rotatePoint(point, -obj.rotation, {
    x: obj.x + obj.w / 2,
    y: obj.y + obj.h / 2,
  });
  return {
    x: ((p.x - obj.x) * (obj.baseW || obj.w)) / obj.w,
    y: ((p.y - obj.y) * (obj.baseH || obj.h)) / obj.h,
  };
}
export function objectBounds(obj) {
  const c = { x: obj.x + obj.w / 2, y: obj.y + obj.h / 2 };
  const points = [
    { x: obj.x, y: obj.y },
    { x: obj.x + obj.w, y: obj.y },
    { x: obj.x, y: obj.y + obj.h },
    { x: obj.x + obj.w, y: obj.y + obj.h },
  ].map((p) => rotatePoint(p, obj.rotation, c));
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  };
}
export function boundsOf(objects) {
  if (!objects.length) return { x: 0, y: 0, w: 0, h: 0 };
  const bounds = objects.map(objectBounds);
  const x = Math.min(...bounds.map((b) => b.x)),
    y = Math.min(...bounds.map((b) => b.y));
  return {
    x,
    y,
    w: Math.max(...bounds.map((b) => b.x + b.w)) - x,
    h: Math.max(...bounds.map((b) => b.y + b.h)) - y,
  };
}
export function localPath(obj) {
  if (obj.type === "rect")
    return new paper.Path.Rectangle({
      rectangle: [0, 0, obj.w, obj.h],
      radius: obj.radius || 0,
      insert: false,
    });
  if (obj.type === "ellipse")
    return new paper.Path.Ellipse({
      rectangle: [0, 0, obj.w, obj.h],
      insert: false,
    });
  if (obj.type === "path")
    return new paper.CompoundPath({ pathData: obj.d, insert: false });
  return null;
}
export function worldPath(obj) {
  const p = localPath(obj);
  if (!p) return null;
  if (obj.type === "path")
    p.scale(obj.w / obj.baseW, obj.h / obj.baseH, new paper.Point(0, 0));
  p.rotate(obj.rotation, new paper.Point(obj.w / 2, obj.h / 2));
  p.translate(new paper.Point(obj.x, obj.y));
  p.fillColor = obj.fill === "none" ? "#000000" : obj.fill;
  p.fillRule = "evenodd";
  p.reorient(false, true);
  return p;
}
export function pathObject(path, source, name = "Combined shape") {
  if (!path || !path.pathData || path.isEmpty()) return null;
  path.reorient(false, true);
  const b = path.bounds.clone();
  if (b.width < 0.01 || b.height < 0.01) return null;
  path.translate(new paper.Point(-b.x, -b.y));
  return {
    ...clone(source),
    id: crypto.randomUUID(),
    type: "path",
    name,
    x: b.x,
    y: b.y,
    w: b.width,
    h: b.height,
    baseW: b.width,
    baseH: b.height,
    rotation: 0,
    d: path.pathData,
    locked: false,
    visible: true,
  };
}
export function booleanObjects(objects, operation) {
  let result = worldPath(objects[0]);
  for (const obj of objects.slice(1)) {
    const next = worldPath(obj),
      previous = result;
    result = previous[operation](next, { insert: false });
    previous.remove();
    next.remove();
  }
  const names = {
    unite: "United shape",
    subtract: "Subtracted shape",
    intersect: "Intersection",
    exclude: "Excluded shape",
  };
  const obj = pathObject(result, objects[0], names[operation]);
  result.remove();
  return obj;
}
// Split overlapping areas into disjoint faces so the builder can manipulate regions.
export function buildRegions(objects) {
  let regions = [];
  for (const object of objects) {
    const shape = worldPath(object);
    let remainder = shape.clone({ insert: false });
    const next = [];
    for (const region of regions) {
      const outside = region.path
        .subtract(shape, { insert: false })
        .reorient(false, true);
      const inside = region.path
        .intersect(shape, { insert: false })
        .reorient(false, true);
      const rest = remainder
        .subtract(region.path, { insert: false })
        .reorient(false, true);
      remainder.remove();
      remainder = rest;
      if (!outside.isEmpty() && Math.abs(outside.area) > 0.05)
        next.push({ path: outside, source: region.source });
      else outside.remove();
      if (!inside.isEmpty() && Math.abs(inside.area) > 0.05)
        next.push({ path: inside, source: object });
      else inside.remove();
      region.path.remove();
    }
    if (!remainder.isEmpty() && Math.abs(remainder.area) > 0.05)
      next.push({ path: remainder, source: object });
    else remainder.remove();
    shape.remove();
    regions = next;
    if (regions.length > 150) {
      regions.forEach((r) => r.path.remove());
      throw new Error("Select fewer shapes for the shape builder.");
    }
  }
  // Separate disconnected islands, while attaching each hole to its enclosing face.
  return regions.flatMap((region) => {
    region.path.reorient(false, true);
    if (!region.path.children || region.path.children.length < 2)
      return [region];
    const children = region.path.children;
    const outers = children.filter((p) => p.clockwise),
      holes = children.filter((p) => !p.clockwise);
    const faces = outers.map((outer) => ({
      outer,
      path: new paper.CompoundPath({
        children: [outer.clone({ insert: false })],
        insert: false,
      }),
      source: region.source,
    }));
    for (const hole of holes) {
      const parent = faces
        .filter((face) => face.outer.contains(hole.interiorPoint))
        .sort((a, b) => Math.abs(a.outer.area) - Math.abs(b.outer.area))[0];
      if (parent) parent.path.addChild(hole.clone({ insert: false }));
    }
    region.path.remove();
    return faces.map(({ path, source }) => ({ path, source }));
  });
}
export function penData(points, closed = false) {
  if (!points.length) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length + (closed ? 1 : 0); i++) {
    const a = points[(i - 1) % points.length],
      b = points[i % points.length];
    const ah = a.out || { x: 0, y: 0 },
      bh = b.in || { x: 0, y: 0 };
    if (ah.x || ah.y || bh.x || bh.y)
      d += ` C ${a.x + ah.x} ${a.y + ah.y} ${b.x + bh.x} ${b.y + bh.y} ${b.x} ${b.y}`;
    else d += ` L ${b.x} ${b.y}`;
  }
  return d + (closed ? " Z" : "");
}
export function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0"))
      .join("")
  );
}
export function hexToHsv(hex) {
  const [r, g, b] = hexToRgb(hex).map((n) => n / 255),
    max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  let h = 0;
  if (d)
    h =
      max === r
        ? ((g - b) / d) % 6
        : max === g
          ? (b - r) / d + 2
          : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}
export function hsvToHex(h, s, v) {
  const c = v * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = v - c;
  const rgb =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return rgbToHex(...rgb.map((n) => (n + m) * 255));
}

// Pathfinder operations return independent editable objects in paint order.
export function pathfinderObjects(objects, operation) {
  if (["unite", "subtract", "intersect", "exclude"].includes(operation)) {
    const result = booleanObjects(objects, operation);
    return result ? [result] : [];
  }
  if (operation === "minus-back") {
    const result = booleanObjects(
      [objects.at(-1), ...objects.slice(0, -1)],
      "subtract",
    );
    if (result) result.name = "Minus back";
    return result ? [result] : [];
  }
  if (operation === "divide") {
    if (objects.length > 24)
      throw new Error("Select up to 24 shapes to divide.");
    return buildRegions(objects)
      .map(({ path, source }) => {
        const result = pathObject(path, source, "Divided region");
        path.remove();
        return result;
      })
      .filter(Boolean);
  }
  if (operation === "outline") return outlineObjects(objects);
  const inputs = operation === "crop" ? objects.slice(0, -1) : objects;
  const mask = operation === "crop" ? worldPath(objects.at(-1)) : null;
  const pieces = inputs
    .map((source, i) => {
      let path = worldPath(source);
      for (const front of inputs.slice(i + 1)) {
        const cutter = worldPath(front),
          next = path.subtract(cutter, { insert: false });
        path.remove();
        cutter.remove();
        path = next;
      }
      if (mask) {
        const next = path.intersect(mask, { insert: false });
        path.remove();
        path = next;
      }
      const result = pathObject(
        path,
        { ...source, stroke: "none", strokeWidth: 0 },
        operation === "crop" ? "Cropped shape" : "Trimmed shape",
      );
      path.remove();
      return result;
    })
    .filter(Boolean);
  mask?.remove();
  if (operation !== "merge") return pieces;
  const groups = new Map();
  for (const piece of pieces) {
    const key = `${piece.fill}:${piece.opacity}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(piece);
  }
  return [...groups.values()].map((group) => {
    const result = group.length > 1 ? booleanObjects(group, "unite") : group[0];
    result.name = "Merged shape";
    return result;
  });
}
function outlineObjects(objects) {
  const sources = objects.map((source) => ({
    source,
    path: worldPath(source),
  }));
  const output = [],
    seen = new Set();
  for (const { source, path } of sources) {
    for (const contour of path.children || [path]) {
      const cuts = contour.curves.map(() => [0, 1]);
      for (const other of sources) {
        if (other.path === path) continue;
        for (const crossing of contour.getIntersections(other.path))
          cuts[crossing.index]?.push(crossing.time);
      }
      contour.curves.forEach((curve, index) => {
        const times = [...new Set(cuts[index])].sort((a, b) => a - b);
        for (let i = 1; i < times.length; i++) {
          if (times[i] - times[i - 1] < 1e-8) continue;
          const part = curve.getPart(times[i - 1], times[i]);
          const points = [0, 0.25, 0.5, 0.75, 1].map((t) => {
            const p = part.getPointAtTime(t);
            return `${round(p.x)},${round(p.y)}`;
          });
          const key = [
            points.join(";"),
            [...points].reverse().join(";"),
          ].sort()[0];
          if (seen.has(key)) continue;
          seen.add(key);
          const edge = new paper.Path({
            segments: [part.segment1.clone(), part.segment2.clone()],
            insert: false,
          });
          const b = edge.bounds.clone();
          edge.translate(new paper.Point(-b.x, -b.y));
          output.push({
            ...clone(source),
            id: crypto.randomUUID(),
            type: "path",
            name: "Outline edge",
            x: b.x,
            y: b.y,
            w: Math.max(1, b.width),
            h: Math.max(1, b.height),
            baseW: Math.max(1, b.width),
            baseH: Math.max(1, b.height),
            d: edge.pathData,
            rotation: 0,
            fill: "none",
            stroke: source.fill === "none" ? source.stroke : source.fill,
            strokeWidth: 1,
          });
          edge.remove();
        }
      });
    }
  }
  sources.forEach(({ path }) => path.remove());
  return output;
}
