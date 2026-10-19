/**
 * Skia's PathOps through CanvasKit: boolean operations on paths, and a
 * stroke turned into its outline. Path commands are `@illigma/format`'s
 * flat lists (move, line, cubic, close).
 */

import { PATH_CLOSE, PATH_CUBIC, PATH_LINE, PATH_MOVE, type BooleanOperation, type PathCommands, type StrokeCap, type StrokeJoin } from "@illigma/format";
import type { CanvasKit, Path } from "canvaskit-wasm";
import { setPathOps, type FillPathLike, type PathOpsEngine } from "./shape-extras.js";

/** Our path commands as a CanvasKit path (the caller deletes it), or null. */
export function ckPathFromCommands(ck: CanvasKit, commands: readonly number[], evenOdd = false): Path | null {
  const cmds: number[] = [];
  for (let i = 0; i < commands.length; ) {
    const verb = commands[i++] as number;
    const n = verb === PATH_MOVE || verb === PATH_LINE ? 2 : verb === PATH_CUBIC ? 6 : verb === PATH_CLOSE ? 0 : -1;
    if (n < 0) break;
    cmds.push(verb === PATH_MOVE ? ck.MOVE_VERB : verb === PATH_LINE ? ck.LINE_VERB : verb === PATH_CUBIC ? ck.CUBIC_VERB : ck.CLOSE_VERB);
    for (let k = 0; k < n; k++) cmds.push(commands[i++] as number);
  }
  const path = ck.Path.MakeFromCmds(cmds);
  if (path && evenOdd) path.setFillType(ck.FillType.EvenOdd);
  return path;
}

/** A CanvasKit path as our path commands; quadratics and conics become cubics. */
export function commandsFromCkPath(ck: CanvasKit, path: Path): PathCommands {
  const c = path.toCmds();
  const out: PathCommands = [];
  let px = 0, py = 0;
  for (let i = 0; i < c.length; ) {
    const verb = c[i++];
    if (verb === ck.MOVE_VERB || verb === ck.LINE_VERB) {
      px = c[i++] as number;
      py = c[i++] as number;
      out.push(verb === ck.MOVE_VERB ? PATH_MOVE : PATH_LINE, px, py);
    } else if (verb === ck.QUAD_VERB || verb === ck.CONIC_VERB) {
      const qx = c[i++] as number, qy = c[i++] as number, x = c[i++] as number, y = c[i++] as number;
      const w = verb === ck.CONIC_VERB ? (c[i++] as number) : 1;
      // A conic of weight w is close to a cubic with handles 4w / (3 (1 + w)) of the way to its control point (exact for w = 1).
      const k = (4 * w) / (3 * (1 + w));
      out.push(PATH_CUBIC, px + (qx - px) * k, py + (qy - py) * k, x + (qx - x) * k, y + (qy - y) * k, x, y);
      px = x;
      py = y;
    } else if (verb === ck.CUBIC_VERB) {
      const a = Array.from(c.slice(i, i + 6)) as number[];
      i += 6;
      out.push(PATH_CUBIC, ...a);
      px = a[4] as number;
      py = a[5] as number;
    } else if (verb === ck.CLOSE_VERB) out.push(PATH_CLOSE);
    else break;
  }
  return out;
}

/** `a` combined with `b` by `op`, deleting both inputs (keeps `a` if Skia can't combine them). */
function combine(ck: CanvasKit, a: Path, b: Path, op: ReturnType<typeof opOf>): Path {
  // Path.MakeFromOp (the `makeCombined` method isn't in every CanvasKit build).
  const r = ck.Path.MakeFromOp(a, b, op);
  b.delete();
  if (!r) return a;
  a.delete();
  return r;
}

function opOf(ck: CanvasKit, op: BooleanOperation | "DIFFERENCE") {
  return op === "UNION" ? ck.PathOp.Union : op === "INTERSECT" ? ck.PathOp.Intersect : op === "SUBTRACT" || op === "DIFFERENCE" ? ck.PathOp.Difference : ck.PathOp.XOR;
}

/** Union of fill paths, each with its own winding rule, as one CanvasKit path (the caller deletes it). */
function unionOf(ck: CanvasKit, fills: readonly FillPathLike[]): Path {
  let acc: Path | null = null;
  for (const f of fills) {
    const p = ckPathFromCommands(ck, f.commands, f.evenOdd);
    if (!p) continue;
    acc = acc ? combine(ck, acc, p, ck.PathOp.Union) : p;
  }
  return acc ?? (ck.Path.MakeFromCmds([]) as Path);
}

/** Combines operands (bottom first) with `op`, as Figma does: subtract takes everything above from the bottom one. */
export function booleanPath(ck: CanvasKit, op: BooleanOperation, operands: readonly (readonly FillPathLike[])[]): FillPathLike | null {
  if (!operands.length) return null;
  const paths = operands.map((o) => unionOf(ck, o));
  let acc = paths[0] as Path;
  const skOp = opOf(ck, op);
  for (let i = 1; i < paths.length; i++) acc = combine(ck, acc, paths[i] as Path, skOp);
  const evenOdd = acc.getFillType() === ck.FillType.EvenOdd;
  const commands = commandsFromCkPath(ck, acc);
  acc.delete();
  return { evenOdd, commands };
}

/** The engine `shapeGeometry` uses for BOOLEAN_OPERATION nodes. */
export function pathOpsEngine(ck: CanvasKit): PathOpsEngine {
  return (op, operands) => booleanPath(ck, op, operands);
}

/** Plug CanvasKit's PathOps into the shared geometry (done by every `PageRenderer`). */
export function usePathOps(ck: CanvasKit): void {
  setPathOps(pathOpsEngine(ck));
}

/**
 * The outline of a stroke of `weight` along `commands` (Figma's "Outline
 * stroke"): a filled path, nonzero. `align` INSIDE / OUTSIDE need the closed
 * fill shape `fill` to clip against.
 */
export function strokeOutline(
  ck: CanvasKit,
  commands: readonly number[],
  opts: { weight: number; cap?: StrokeCap | undefined; join?: StrokeJoin | undefined; align?: "CENTER" | "INSIDE" | "OUTSIDE" | undefined; fill?: readonly FillPathLike[] | undefined },
): PathCommands {
  const path = ckPathFromCommands(ck, commands);
  if (!path) return [];
  const align = opts.align ?? "CENTER";
  const width = align === "CENTER" ? opts.weight : opts.weight * 2;
  const cap = opts.cap === "ROUND" ? ck.StrokeCap.Round : opts.cap === "SQUARE" ? ck.StrokeCap.Square : ck.StrokeCap.Butt;
  const join = opts.join === "ROUND" ? ck.StrokeJoin.Round : opts.join === "BEVEL" ? ck.StrokeJoin.Bevel : ck.StrokeJoin.Miter;
  const stroked = path.makeStroked({ width, cap, join, miter_limit: 4 });
  path.delete();
  if (!stroked) return [];
  // A union with nothing simplifies the outline (overlaps from joins and curves merged).
  let result = combine(ck, stroked, ck.Path.MakeFromCmds([]) as Path, ck.PathOp.Union);
  if (align !== "CENTER" && opts.fill?.length) result = combine(ck, result, unionOf(ck, opts.fill), align === "INSIDE" ? ck.PathOp.Intersect : ck.PathOp.Difference);
  // PathOps may answer with even-odd contours; the outline is used with the nonzero rule.
  const winding = result.makeAsWinding();
  if (winding) {
    result.delete();
    result = winding;
  }
  const out = commandsFromCkPath(ck, result);
  result.delete();
  return out;
}

/** SVG path data for path commands (for `vectorNetworkFromSvgPath`). */
export function svgFromCommands(commands: readonly number[]): string {
  const parts: string[] = [];
  const f = (v: number) => String(Math.round(v * 1e4) / 1e4);
  for (let i = 0; i < commands.length; ) {
    const verb = commands[i++];
    if (verb === PATH_MOVE) parts.push(`M${f(commands[i++] as number)} ${f(commands[i++] as number)}`);
    else if (verb === PATH_LINE) parts.push(`L${f(commands[i++] as number)} ${f(commands[i++] as number)}`);
    else if (verb === PATH_CUBIC) {
      const a = (Array.from(commands.slice(i, i + 6)) as number[]).map(f);
      i += 6;
      parts.push(`C${a.join(" ")}`);
    } else if (verb === PATH_CLOSE) parts.push("Z");
    else break;
  }
  return parts.join(" ");
}
