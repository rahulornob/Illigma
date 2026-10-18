/**
 * Vector networks: validation, walking loops and stroke chains, and
 * conversion to and from SVG path data.
 *
 * A network (Figma's model) is a set of vertices joined by straight or cubic
 * segments, which may branch, plus filled regions made of closed loops of
 * segments. Coordinates are in the node's own space.
 *
 * Everything here takes untrusted input: bad input is refused with a
 * `FormatError` (or, for validation, a plain-language problem), never another
 * exception.
 */

import { FormatError } from "./package.js";
import { VECTOR_LIMITS, WINDING_RULES, type VectorNetwork, type WindingRule } from "./schema.js";

/**
 * Flat path commands, shared by the renderer and hit-testing:
 * `PATH_MOVE x y`, `PATH_LINE x y`, `PATH_CUBIC x1 y1 x2 y2 x y`, `PATH_CLOSE`.
 */
export type PathCommands = number[];
export const PATH_MOVE = 0;
export const PATH_LINE = 1;
export const PATH_CUBIC = 4;
export const PATH_CLOSE = 5;

/** Longest SVG path data `vectorNetworkFromSvgPath` reads. */
export const MAX_SVG_PATH_CHARS = 10_000_000;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => v !== null && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const WINDING = new Set<unknown>(WINDING_RULES);
const count = (n: number) => n.toLocaleString("en-US");

/** True when `o` has exactly the keys in `required`, plus any in `optional`. */
function hasKeys(o: Obj, required: readonly string[], optional: readonly string[] = []): boolean {
  let n = 0;
  for (const k of Object.keys(o)) {
    if (required.includes(k)) n++;
    else if (!optional.includes(k)) return false;
  }
  return n === required.length;
}

const isPoint = (v: unknown): boolean => isObj(v) && hasKeys(v, ["x", "y"]) && finite(v.x) && finite(v.y);

/**
 * The problem with `value` as a vector network, or `null` if it is valid.
 * Checks shape, finite numbers, index ranges, size limits, and that every
 * region loop is a closed chain of segments.
 */
export function vectorNetworkProblem(value: unknown): string | null {
  if (!isObj(value) || !hasKeys(value, ["vertices", "segments", "regions"])) return "must be { vertices, segments, regions }";
  const { vertices, segments, regions } = value;
  if (!Array.isArray(vertices) || !Array.isArray(segments) || !Array.isArray(regions)) return "must have lists of vertices, segments and regions";
  const L = VECTOR_LIMITS;
  if (vertices.length > L.maxVertices) return `has ${count(vertices.length)} vertices; the most a vector can hold is ${count(L.maxVertices)}`;
  if (segments.length > L.maxSegments) return `has ${count(segments.length)} segments; the most a vector can hold is ${count(L.maxSegments)}`;
  if (regions.length > L.maxRegions) return `has ${count(regions.length)} regions; the most a vector can hold is ${count(L.maxRegions)}`;

  for (let i = 0; i < vertices.length; i++) {
    const v: unknown = vertices[i];
    if (!isObj(v) || !hasKeys(v, ["x", "y"], ["cornerRadius"]) || !finite(v.x) || !finite(v.y)) {
      return `vertex ${i} must be { x, y } with finite numbers (and an optional cornerRadius)`;
    }
    if (v.cornerRadius !== undefined && !(finite(v.cornerRadius) && v.cornerRadius >= 0)) return `vertex ${i} has a corner radius that isn't a number, 0 or more`;
  }
  const nv = vertices.length;
  const index = (x: unknown) => typeof x === "number" && Number.isInteger(x) && x >= 0 && x < nv;
  for (let i = 0; i < segments.length; i++) {
    const s: unknown = segments[i];
    if (!isObj(s) || !hasKeys(s, ["start", "end", "tangentStart", "tangentEnd"])) return `segment ${i} must be { start, end, tangentStart, tangentEnd }`;
    if (!index(s.start) || !index(s.end)) return `segment ${i} must join two of the ${count(nv)} vertices (by index, from 0)`;
    if (!isPoint(s.tangentStart) || !isPoint(s.tangentEnd)) return `segment ${i} must have tangents { x, y } with finite numbers`;
  }
  const net = value as unknown as VectorNetwork;
  let entries = 0;
  for (let r = 0; r < regions.length; r++) {
    const region: unknown = regions[r];
    if (!isObj(region) || !hasKeys(region, ["windingRule", "loops"]) || !Array.isArray(region.loops)) return `region ${r} must be { windingRule, loops }`;
    if (!WINDING.has(region.windingRule)) return `region ${r} must have a winding rule of "NONZERO" or "EVENODD"`;
    if (region.loops.length === 0) return `region ${r} has no loops`;
    for (let l = 0; l < region.loops.length; l++) {
      const loop: unknown = region.loops[l];
      if (!Array.isArray(loop) || loop.length === 0) return `region ${r} loop ${l} must be a list of segment indices`;
      entries += loop.length;
      if (entries > L.maxLoopEntries) return `has more than ${count(L.maxLoopEntries)} segments in its region loops`;
      for (const s of loop) {
        if (!(typeof s === "number" && Number.isInteger(s) && s >= 0 && s < segments.length)) return `region ${r} loop ${l} must list segments by index, from 0 to ${count(segments.length - 1)}`;
      }
      if (!walkVectorLoop(net, loop as number[])) return `region ${r} loop ${l} isn't closed: its segments must join end to end and return to where they started`;
    }
  }
  return null;
}

/**
 * Walks a loop of segments. Returns the vertex it starts at and each step as
 * `segment * 2 + (reversed ? 1 : 0)`, or `null` if the segments don't join
 * end to end into a closed loop. Assumes indices are in range.
 */
export function walkVectorLoop(net: VectorNetwork, loop: readonly number[]): { start: number; steps: number[] } | null {
  const segs = net.segments;
  const first = segs[loop[0] as number];
  if (!first) return null;
  if (loop.length === 1) return first.start === first.end ? { start: first.start, steps: [(loop[0] as number) * 2] } : null;
  const second = segs[loop[1] as number];
  if (!second) return null;
  // Orient the first segment so that it ends where the second one touches.
  let cur: number;
  let start: number;
  const steps: number[] = [];
  if (first.end === second.start || first.end === second.end) {
    start = first.start;
    cur = first.end;
    steps.push((loop[0] as number) * 2);
  } else if (first.start === second.start || first.start === second.end) {
    start = first.end;
    cur = first.start;
    steps.push((loop[0] as number) * 2 + 1);
  } else return null;
  for (let i = 1; i < loop.length; i++) {
    const si = loop[i] as number;
    const s = segs[si];
    if (!s) return null;
    if (s.start === cur) {
      steps.push(si * 2);
      cur = s.end;
    } else if (s.end === cur) {
      steps.push(si * 2 + 1);
      cur = s.start;
    } else return null;
  }
  return cur === start ? { start, steps } : null;
}

/** One stroke chain: a run of segments through vertices that join exactly two segments. */
export interface StrokeChain {
  start: number;
  /** `segment * 2 + (reversed ? 1 : 0)`, as in `walkVectorLoop`. */
  steps: number[];
  /** True for a loop of segments with no free ends, stroked with joins all round. */
  closed: boolean;
}

/**
 * Splits a valid network into stroke chains, so a stroke joins smoothly
 * through every vertex shared by exactly two segments, and ends (with its
 * cap) at free ends and branch points. Every segment is in exactly one chain.
 */
export function vectorStrokeChains(net: VectorNetwork): StrokeChain[] {
  const nv = net.vertices.length;
  const segs = net.segments;
  const degree = new Int32Array(nv);
  for (const s of segs) {
    degree[s.start] = (degree[s.start] as number) + 1;
    degree[s.end] = (degree[s.end] as number) + 1;
  }
  // Incident segments per vertex, packed (CSR).
  const offset = new Int32Array(nv + 1);
  for (let v = 0; v < nv; v++) offset[v + 1] = (offset[v] as number) + (degree[v] as number);
  const fill = offset.slice(0, nv);
  const incident = new Int32Array(offset[nv] as number);
  segs.forEach((s, i) => {
    for (const v of [s.start, s.end]) {
      const at = fill[v] as number;
      incident[at] = i;
      fill[v] = at + 1;
    }
  });
  const used = new Uint8Array(segs.length);
  const chains: StrokeChain[] = [];

  /** Follows segments from `from` along `si` while the next vertex joins exactly two segments. */
  const walk = (from: number, si: number): StrokeChain => {
    const steps: number[] = [];
    let cur = from;
    for (;;) {
      used[si] = 1;
      const s = segs[si] as (typeof segs)[number];
      const reversed = s.start !== cur;
      steps.push(si * 2 + (reversed ? 1 : 0));
      cur = reversed ? s.start : s.end;
      if (degree[cur] !== 2) break;
      const a = incident[offset[cur] as number] as number;
      const b = incident[(offset[cur] as number) + 1] as number;
      const next = a === si ? b : a;
      if (used[next]) break;
      si = next;
    }
    return { start: from, steps, closed: cur === from && degree[from] === 2 };
  };

  // Chains from free ends and branch points first, then the remaining pure loops.
  for (let v = 0; v < nv; v++) {
    if (degree[v] === 2) continue;
    for (let k = offset[v] as number; k < (offset[v + 1] as number); k++) {
      const si = incident[k] as number;
      if (!used[si]) chains.push(walk(v, si));
    }
  }
  for (let si = 0; si < segs.length; si++) {
    if (!used[si]) chains.push(walk((segs[si] as (typeof segs)[number]).start, si));
  }
  return chains;
}

/** Appends one walked run of segments to `out` as path commands. */
function appendSteps(net: VectorNetwork, start: number, steps: readonly number[], closed: boolean, out: PathCommands): void {
  const vs = net.vertices;
  const p0 = vs[start] as (typeof vs)[number];
  out.push(PATH_MOVE, p0.x, p0.y);
  for (let k = 0; k < steps.length; k++) {
    const step = steps[k] as number;
    const s = net.segments[step >> 1] as VectorNetwork["segments"][number];
    const a = vs[s.start] as (typeof vs)[number];
    const b = vs[s.end] as (typeof vs)[number];
    const ts = s.tangentStart;
    const te = s.tangentEnd;
    const straight = ts.x === 0 && ts.y === 0 && te.x === 0 && te.y === 0;
    // A closed run's last straight edge is drawn by the close itself.
    if (straight && closed && k === steps.length - 1 && steps.length > 1) break;
    if (step & 1) {
      if (straight) out.push(PATH_LINE, a.x, a.y);
      else out.push(PATH_CUBIC, b.x + te.x, b.y + te.y, a.x + ts.x, a.y + ts.y, a.x, a.y);
    } else if (straight) out.push(PATH_LINE, b.x, b.y);
    else out.push(PATH_CUBIC, a.x + ts.x, a.y + ts.y, b.x + te.x, b.y + te.y, b.x, b.y);
  }
  if (closed) out.push(PATH_CLOSE);
}

/**
 * Path commands for a valid network: one fill path per region (with its
 * winding rule) and one stroke path holding every segment.
 */
export function vectorNetworkPaths(net: VectorNetwork): { regions: { windingRule: WindingRule; commands: PathCommands }[]; stroke: PathCommands } {
  const regions = net.regions.map((r) => {
    const commands: PathCommands = [];
    for (const loop of r.loops) {
      const walked = walkVectorLoop(net, loop);
      if (walked) appendSteps(net, walked.start, walked.steps, true, commands);
    }
    return { windingRule: r.windingRule, commands };
  });
  const stroke: PathCommands = [];
  for (const c of vectorStrokeChains(net)) appendSteps(net, c.start, c.steps, c.closed, stroke);
  return { regions, stroke };
}

// ---- SVG path data ----

const isStraight = (s: VectorNetwork["segments"][number]) => s.tangentStart.x === 0 && s.tangentStart.y === 0 && s.tangentEnd.x === 0 && s.tangentEnd.y === 0;

/**
 * Numbers in SVG output: at most 6 decimals, no "-0". Values of a billion or
 * more are written in full (scaling them by a million could overflow to
 * Infinity), so every finite coordinate reads back as itself or its rounding.
 */
function num(v: number): string {
  const r = Math.abs(v) < 1e9 ? Math.round(v * 1e6) / 1e6 : v;
  return Object.is(r, -0) ? "0" : String(r);
}

/**
 * SVG path data for a vector network: every segment, as connected subpaths
 * (closed with Z where a run of segments returns to its start). Region
 * winding rules are not part of path data; read them from the network.
 * Throws `FormatError` if `net` is not a valid network.
 */
export function svgPathFromVectorNetwork(net: VectorNetwork): string {
  const problem = vectorNetworkProblem(net);
  if (problem) throw new FormatError(`The vector network ${problem}.`);
  const cmds = vectorNetworkPaths(net).stroke;
  const parts: string[] = [];
  for (let i = 0; i < cmds.length; ) {
    const verb = cmds[i++];
    if (verb === PATH_MOVE) parts.push(`M${num(cmds[i++] as number)} ${num(cmds[i++] as number)}`);
    else if (verb === PATH_LINE) parts.push(`L${num(cmds[i++] as number)} ${num(cmds[i++] as number)}`);
    else if (verb === PATH_CUBIC) {
      const c = cmds.slice(i, i + 6).map(num);
      i += 6;
      parts.push(`C${c[0]} ${c[1]} ${c[2]} ${c[3]} ${c[4]} ${c[5]}`);
    } else parts.push("Z");
  }
  return parts.join(" ");
}

export interface SvgPathOptions {
  /** The winding rule of the region made from the path's closed subpaths (see `vectorNetworkFromSvgPath`). Default "NONZERO", as in SVG. */
  windingRule?: WindingRule;
}

const COMMANDS = new Set("MLHVCSQTAZ");

/**
 * Reads SVG path data (`d`) into a vector network: every command (M, L, H,
 * V, C, S, Q, T, A, Z, absolute and relative), with quadratics raised to
 * cubics and elliptical arcs split into cubics of at most 90°. Each subpath
 * becomes a run of segments; the closed ones (Z) form one region with
 * `options.windingRule`. When an open subpath encloses an area (SVG fills it
 * as if closed, without stroking the closing line), there is no region
 * instead, and every run fills as if closed with the nonzero rule: a region
 * can't close a subpath without adding a stroked segment, so this is the
 * closest the network can come. Throws `FormatError` on unreadable data
 * (including coordinates or handles too large to be numbers) or more than
 * `VECTOR_LIMITS` allows.
 */
export function vectorNetworkFromSvgPath(d: string, options: SvgPathOptions = {}): VectorNetwork {
  if (typeof d !== "string") throw new FormatError("Path data must be text.");
  if (d.length > MAX_SVG_PATH_CHARS) throw new FormatError(`The path data is longer than ${count(MAX_SVG_PATH_CHARS)} characters.`);
  const windingRule = options.windingRule ?? "NONZERO";
  if (!WINDING.has(windingRule)) throw new FormatError('The winding rule must be "NONZERO" or "EVENODD".');

  const net: VectorNetwork = { vertices: [], segments: [], regions: [] };
  const loops: number[][] = [];
  let i = 0;
  const n = d.length;
  const fail = (why: string): never => {
    throw new FormatError(`The path data can't be read at character ${i + 1}: ${why}.`);
  };

  const isSep = (c: number) => c === 32 || c === 9 || c === 10 || c === 13 || c === 12 || c === 44;
  const skip = () => {
    while (i < n && isSep(d.charCodeAt(i))) i++;
  };
  const digit = (c: number) => c >= 48 && c <= 57;
  /** Reads a number at `i` (after separators), or fails. */
  const readNumber = (): number => {
    skip();
    const from = i;
    let c = d.charCodeAt(i);
    if (c === 43 || c === 45) c = d.charCodeAt(++i); // + -
    let digits = 0;
    while (digit(c)) {
      c = d.charCodeAt(++i);
      digits++;
    }
    if (c === 46) {
      c = d.charCodeAt(++i);
      while (digit(c)) {
        c = d.charCodeAt(++i);
        digits++;
      }
    }
    if (!digits) {
      i = from;
      fail("expected a number");
    }
    if (c === 101 || c === 69) {
      // An exponent, only if digits follow (so "1e" is refused rather than misread).
      let j = i + 1;
      let e = d.charCodeAt(j);
      if (e === 43 || e === 45) e = d.charCodeAt(++j);
      if (digit(e)) {
        while (digit(d.charCodeAt(j))) j++;
        i = j;
      }
    }
    const v = Number(d.slice(from, i));
    if (!Number.isFinite(v)) {
      i = from;
      fail("the number is too large");
    }
    return v;
  };
  /** An arc flag: a single 0 or 1, which may be written with no separator after it. */
  const readFlag = (): boolean => {
    skip();
    const c = d.charCodeAt(i);
    if (c !== 48 && c !== 49) fail("expected an arc flag (0 or 1)");
    i++;
    return c === 49;
  };

  // Pen state.
  let x = 0, y = 0; // current point
  let sx = 0, sy = 0; // subpath start point
  let startVertex = -1; // subpath start vertex, -1 before the first M
  let curVertex = -1;
  let firstSegment = 0; // subpath's first segment index
  let open = false; // a subpath is started and not yet closed
  let lastCubic: [number, number] | null = null; // second control point, for S
  let lastQuad: [number, number] | null = null; // control point, for T
  let openArea = false; // an open subpath encloses an area (see the end)

  const check = (...vs: number[]) => {
    for (const v of vs) if (!Number.isFinite(v)) fail("a coordinate is too large");
  };
  const addVertex = (vx: number, vy: number): number => {
    if (net.vertices.length >= VECTOR_LIMITS.maxVertices) throw new FormatError(`The path has more than ${count(VECTOR_LIMITS.maxVertices)} points.`);
    net.vertices.push({ x: vx + 0, y: vy + 0 }); // "+ 0": never -0, which JSON would write as 0
    return net.vertices.length - 1;
  };
  /**
   * Ends an open subpath (one not closed by Z). Drops it if it drew nothing (a
   * lone M), so it leaves no stray vertex; notes whether it encloses an area
   * that SVG fills as if closed (two or more segments, or one curve).
   */
  const dropEmptySubpath = () => {
    if (open) {
      const made = net.segments.length - firstSegment;
      if (made === 0 && curVertex === net.vertices.length - 1) net.vertices.pop();
      else if (made >= 2 || (made === 1 && !isStraight(net.segments[firstSegment] as VectorNetwork["segments"][number]))) openArea = true;
    }
    open = false;
  };
  const beginSubpath = () => {
    if (open) return;
    startVertex = curVertex = addVertex(x, y);
    sx = x;
    sy = y;
    firstSegment = net.segments.length;
    open = true;
  };
  const addSegment = (c1x: number, c1y: number, c2x: number, c2y: number, ex: number, ey: number, straight: boolean) => {
    check(c1x, c1y, c2x, c2y, ex, ey);
    beginSubpath();
    if (net.segments.length >= VECTOR_LIMITS.maxSegments) throw new FormatError(`The path has more than ${count(VECTOR_LIMITS.maxSegments)} segments.`);
    const from = net.vertices[curVertex] as { x: number; y: number };
    const tangentStart = straight ? { x: 0, y: 0 } : { x: c1x - from.x + 0, y: c1y - from.y + 0 };
    const tangentEnd = straight ? { x: 0, y: 0 } : { x: c2x - ex + 0, y: c2y - ey + 0 };
    // Finite points can still be too far apart for their difference to be a number (-1e308 to 1e308).
    check(tangentStart.x, tangentStart.y, tangentEnd.x, tangentEnd.y);
    const to = addVertex(ex, ey);
    net.segments.push({ start: curVertex, end: to, tangentStart, tangentEnd });
    curVertex = to;
    x = ex;
    y = ey;
  };
  const lineTo = (ex: number, ey: number) => addSegment(0, 0, 0, 0, ex, ey, true);
  const cubicTo = (c1x: number, c1y: number, c2x: number, c2y: number, ex: number, ey: number) => addSegment(c1x, c1y, c2x, c2y, ex, ey, false);
  const closePath = () => {
    if (!open) return;
    const segs = net.segments;
    if (segs.length === firstSegment) {
      dropEmptySubpath();
    } else {
      const end = net.vertices[curVertex] as { x: number; y: number };
      const tol = 1e-9 * Math.max(1, Math.abs(sx), Math.abs(sy));
      if (curVertex !== startVertex && Math.abs(end.x - sx) <= tol && Math.abs(end.y - sy) <= tol) {
        // The last segment already ends at the start: join it there instead of adding a zero-length edge.
        (segs[segs.length - 1] as { end: number }).end = startVertex;
        net.vertices.pop();
      } else if (curVertex !== startVertex) {
        if (segs.length >= VECTOR_LIMITS.maxSegments) throw new FormatError(`The path has more than ${count(VECTOR_LIMITS.maxSegments)} segments.`);
        segs.push({ start: curVertex, end: startVertex, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } });
      }
      const loop: number[] = [];
      for (let s = firstSegment; s < segs.length; s++) loop.push(s);
      loops.push(loop);
      open = false;
    }
    curVertex = startVertex;
    x = sx;
    y = sy;
  };

  let cmd = "";
  skip();
  while (i < n) {
    const c = d[i] as string;
    if (/[A-Za-z]/.test(c)) {
      if (!COMMANDS.has(c.toUpperCase())) fail(`"${c}" is not a path command`);
      if (startVertex === -1 && c !== "M" && c !== "m") fail("path data must start with a move (M or m)");
      cmd = c;
      i++;
    } else if (!cmd) {
      fail("path data must start with a move (M or m)");
    } else if (cmd === "Z" || cmd === "z") {
      fail("expected a command letter");
    }
    // Otherwise the previous command repeats with the next set of numbers (after M, as L).
    const U = cmd.toUpperCase();
    const rel = cmd !== U;
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    let wasCubic = false;
    let wasQuad = false;
    switch (U) {
      case "M": {
        const mx = readNumber() + ox;
        const my = readNumber() + oy;
        check(mx, my);
        dropEmptySubpath(); // and an M ends any open subpath
        x = mx;
        y = my;
        beginSubpath();
        // Implicit line-tos follow as L (or l).
        cmd = rel ? "l" : "L";
        break;
      }
      case "L":
        lineTo(readNumber() + ox, readNumber() + oy);
        break;
      case "H":
        lineTo(readNumber() + ox, y);
        break;
      case "V":
        lineTo(x, readNumber() + oy);
        break;
      case "C": {
        const v = [readNumber(), readNumber(), readNumber(), readNumber(), readNumber(), readNumber()];
        cubicTo((v[0] as number) + ox, (v[1] as number) + oy, (v[2] as number) + ox, (v[3] as number) + oy, (v[4] as number) + ox, (v[5] as number) + oy);
        lastCubic = [(v[2] as number) + ox, (v[3] as number) + oy];
        wasCubic = true;
        break;
      }
      case "S": {
        const v = [readNumber(), readNumber(), readNumber(), readNumber()];
        const [c1x, c1y] = lastCubic ? [2 * x - lastCubic[0], 2 * y - lastCubic[1]] : [x, y];
        const c2: [number, number] = [(v[0] as number) + ox, (v[1] as number) + oy];
        cubicTo(c1x, c1y, c2[0], c2[1], (v[2] as number) + ox, (v[3] as number) + oy);
        lastCubic = c2;
        wasCubic = true;
        break;
      }
      case "Q": {
        const v = [readNumber(), readNumber(), readNumber(), readNumber()];
        const q: [number, number] = [(v[0] as number) + ox, (v[1] as number) + oy];
        quadTo(q, (v[2] as number) + ox, (v[3] as number) + oy);
        lastQuad = q;
        wasQuad = true;
        break;
      }
      case "T": {
        const ex = readNumber() + ox;
        const ey = readNumber() + oy;
        const q: [number, number] = lastQuad ? [2 * x - lastQuad[0], 2 * y - lastQuad[1]] : [x, y];
        check(q[0], q[1]);
        quadTo(q, ex, ey);
        lastQuad = q;
        wasQuad = true;
        break;
      }
      case "A": {
        const rx = readNumber();
        const ry = readNumber();
        const phi = readNumber();
        const large = readFlag();
        const sweep = readFlag();
        const ex = readNumber() + ox;
        const ey = readNumber() + oy;
        check(ex, ey);
        for (const seg of arcToCubics(x, y, rx, ry, phi, large, sweep, ex, ey)) {
          if (seg.length === 2) lineTo(seg[0] as number, seg[1] as number);
          else cubicTo(...(seg as [number, number, number, number, number, number]));
        }
        break;
      }
      case "Z":
        closePath();
        break;
    }
    if (!wasCubic) lastCubic = null;
    if (!wasQuad) lastQuad = null;
    skip();
  }
  dropEmptySubpath();
  // SVG fills every subpath, the open ones as if closed by a straight line that isn't stroked. A
  // region can't close a subpath without a (stroked) segment, so when an open subpath encloses an
  // area the network gets no region: then every run fills as if closed (and with the nonzero rule),
  // as it does for paths with no closed subpath. Otherwise the closed subpaths are one region.
  if (loops.length && !openArea) net.regions.push({ windingRule, loops });
  return net;

  function quadTo(q: [number, number], ex: number, ey: number) {
    cubicTo(x + (2 / 3) * (q[0] - x), y + (2 / 3) * (q[1] - y), ex + (2 / 3) * (q[0] - ex), ey + (2 / 3) * (q[1] - ey), ex, ey);
  }
}

/**
 * An SVG elliptical arc (endpoint form) as cubic Béziers of at most 90° each,
 * per SVG 1.1 appendix F.6. Returns `[x, y]` for a straight line (a zero
 * radius) or `[c1x, c1y, c2x, c2y, x, y]` per cubic; nothing when the
 * endpoints are the same.
 */
export function arcToCubics(x1: number, y1: number, rx: number, ry: number, angleDeg: number, largeArc: boolean, sweep: boolean, x2: number, y2: number): number[][] {
  if (x1 === x2 && y1 === y2) return [];
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  if (rx === 0 || ry === 0) return [[x2, y2]];
  const phi = ((angleDeg % 360) * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  // Radii too small to reach the endpoint are scaled up (F.6.6).
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const k = Math.sqrt(lambda);
    rx *= k;
    ry *= k;
  }
  const rx2 = rx * rx;
  const ry2 = ry * ry;
  const den = rx2 * y1p * y1p + ry2 * x1p * x1p;
  const ratio = den > 0 ? Math.max(0, (rx2 * ry2 - den) / den) : 0;
  const coef = (largeArc !== sweep ? 1 : -1) * Math.sqrt(ratio);
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ux = (x1p - cxp) / rx;
  const uy = (y1p - cyp) / ry;
  const vx = (-x1p - cxp) / rx;
  const vy = (-y1p - cyp) / ry;
  const theta1 = Math.atan2(uy, ux);
  let delta = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  else if (sweep && delta < 0) delta += 2 * Math.PI;
  if (!Number.isFinite(delta) || !Number.isFinite(cx) || !Number.isFinite(cy)) return [[x2, y2]];
  const parts = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9));
  const step = delta / parts;
  const t = (4 / 3) * Math.tan(step / 4);
  /** A point on the unit circle (plus offset) mapped onto the ellipse. */
  const map = (px: number, py: number): [number, number] => [cx + cos * rx * px - sin * ry * py, cy + sin * rx * px + cos * ry * py];
  const out: number[][] = [];
  for (let k = 0; k < parts; k++) {
    const a1 = theta1 + k * step;
    const a2 = a1 + step;
    const c1 = Math.cos(a1), s1 = Math.sin(a1), c2 = Math.cos(a2), s2 = Math.sin(a2);
    const p1 = map(c1 - t * s1, s1 + t * c1);
    const p2 = map(c2 + t * s2, s2 - t * c2);
    const end = k === parts - 1 ? [x2, y2] : map(c2, s2);
    out.push([p1[0], p1[1], p2[0], p2[1], end[0] as number, end[1] as number]);
  }
  return out;
}
