/**
 * SVG export: a real vector file written from the layer tree, in the order
 * and with the geometry the renderer draws. Output is deterministic: the
 * same layers always give the same bytes.
 *
 * - Containers are `<g>` (with `opacity` for layer opacity, which in SVG and
 *   Figma applies to a group as a whole). Frames clip their children with a
 *   `<clipPath>` of their box.
 * - Rectangles are `<rect>` (`rx` for corner radius), ellipses `<ellipse>`;
 *   vectors, stars, polygons and lines are `<path>`, one per filled region
 *   with its winding rule, plus one for the stroke.
 * - Each visible paint is its own element, fills before strokes, as drawn.
 *   Strokes are centred, so they are written as SVG strokes.
 * - Text is `<text>` with one `<tspan>` per line: where the canvas wraps it
 *   when fonts are given, else one line per line break with Inter's metrics.
 *   Text isn't outlined, so it needs the font where the file is opened.
 */

import type { ReadonlyNode } from "@illigma/core";
import { PATH_CLOSE, PATH_CUBIC, PATH_LINE, PATH_MOVE } from "@illigma/format";
import { CLIPPING, type TextLine } from "@illigma/renderer";
import { draws, hasVisibleStroke, localMatrix, multiply, translation, type ExportScene, type ExportSource, type Matrix } from "./scene.js";
import { fallbackTextLines, fmt, hex, outlineOf, resolvePaint, textStyle, type ResolvedPaint } from "./vector-common.js";

export interface SvgWriterOptions {
  /** Layer names as `id` attributes (Figma's "Include id attribute"). */
  idAttribute?: boolean;
  /** Line breaks and baselines of a TEXT layer, from the renderer's text engine; null to use the fallback. */
  textLayout?: (n: ReadonlyNode) => TextLine[] | null;
  /** Called once per limitation met, in plain language. */
  warn?: (message: string) => void;
}

type Attr = readonly [name: string, value: string];

interface Element {
  tag: string;
  attrs: Attr[];
  /** Serialized child markup, on the same line (used by `<text>`). */
  inner?: string;
}

/** Characters XML 1.0 can't hold at all: control characters and unpaired surrogates. */
// eslint-disable-next-line no-control-regex
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Text for an attribute value in double quotes. */
export function escapeAttr(s: string): string {
  return s
    .replace(INVALID_XML, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/\t/g, "&#9;")
    .replace(/\n/g, "&#10;")
    .replace(/\r/g, "&#13;");
}

/** Text for element content. */
export function escapeText(s: string): string {
  return s.replace(INVALID_XML, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Path commands (see `@illigma/format`) as SVG path data. */
export function svgPathData(commands: readonly number[]): string {
  const parts: string[] = [];
  for (let i = 0; i < commands.length; ) {
    const verb = commands[i++];
    const at = (k: number) => fmt(commands[i + k] as number);
    if (verb === PATH_MOVE) {
      parts.push(`M${at(0)} ${at(1)}`);
      i += 2;
    } else if (verb === PATH_LINE) {
      parts.push(`L${at(0)} ${at(1)}`);
      i += 2;
    } else if (verb === PATH_CUBIC) {
      parts.push(`C${at(0)} ${at(1)} ${at(2)} ${at(3)} ${at(4)} ${at(5)}`);
      i += 6;
    } else if (verb === PATH_CLOSE) parts.push("Z");
    else break;
  }
  return parts.join("");
}

/** A rotation-and-translation matrix as `translate(x y) rotate(deg)`, or null for the identity. */
function transformAttr(m: Matrix): string | null {
  const deg = (Math.atan2(m[1], m[0]) * 180) / Math.PI;
  const parts: string[] = [];
  if (fmt(m[4]) !== "0" || fmt(m[5]) !== "0") parts.push(`translate(${fmt(m[4])} ${fmt(m[5])})`);
  if (fmt(deg) !== "0") parts.push(`rotate(${fmt(deg)})`);
  return parts.length ? parts.join(" ") : null;
}

function serialize(e: Element): string {
  const attrs = e.attrs.map(([k, v]) => ` ${k}="${v}"`).join("");
  return e.inner === undefined ? `<${e.tag}${attrs}/>` : `<${e.tag}${attrs}>${e.inner}</${e.tag}>`;
}

/** A CSS font family list entry, quoted when it isn't plain words. */
function fontFamily(name: string): string {
  return /^[A-Za-z][A-Za-z -]*$/.test(name) ? name : `'${name.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

class SvgWriter {
  private readonly lines: string[] = [];
  private readonly defs: string[] = [];
  private readonly ids = new Set<string>();

  constructor(
    private readonly source: ExportSource,
    private readonly options: SvgWriterOptions,
  ) {}

  write(scene: ExportScene): string {
    const { width, height } = scene.region;
    const top = multiply(translation(-scene.region.x, -scene.region.y), scene.rootMatrix);
    for (const root of scene.roots) this.node(root, multiply(top, localMatrix(root)));
    const w = fmt(width);
    const h = fmt(height);
    const out = [`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg">`, ...this.lines];
    if (this.defs.length) out.push("<defs>", ...this.defs, "</defs>");
    out.push("</svg>", "");
    return out.join("\n");
  }

  private uniqueId(base: string): string {
    let id = base;
    for (let i = 2; this.ids.has(id); i++) id = `${base}_${i}`;
    this.ids.add(id);
    return id;
  }

  /** Write `n` and its children; `m` is its full transform from the parent element's space. */
  private node(n: ReadonlyNode, m: Matrix): void {
    if (!draws(n)) return;
    const common: Attr[] = [];
    if (this.options.idAttribute) common.push(["id", escapeAttr(this.uniqueId(n.name.replace(INVALID_XML, "") || n.type.toLowerCase()))]);
    const transform = transformAttr(m);
    if (transform) common.push(["transform", transform]);
    if (n.opacity < 1) common.push(["opacity", fmt(n.opacity)]);

    const own = this.own(n);
    const kids = this.source.children(n.id).filter(draws);
    if (!kids.length) {
      if (!own.length) return;
      if (own.length === 1) {
        const only = own[0] as Element;
        this.lines.push(serialize({ ...only, attrs: [...common, ...only.attrs] }));
        return;
      }
    }
    this.lines.push(common.length ? `<g${common.map(([k, v]) => ` ${k}="${v}"`).join("")}>` : "<g>");
    for (const e of own) this.lines.push(serialize(e));
    if (kids.length && CLIPPING.has(n.type)) {
      const clip = this.uniqueId(`clip_${n.id}`);
      const r = outlineOf(n);
      const box = r.kind === "rect" ? r : { width: n.width, height: n.height, radius: 0 };
      this.defs.push(`<clipPath id="${escapeAttr(clip)}">`, serialize({ tag: "rect", attrs: rectAttrs(box.width, box.height, box.radius) }), "</clipPath>");
      this.lines.push(`<g clip-path="url(#${escapeAttr(clip)})">`);
      for (const k of kids) this.node(k, localMatrix(k));
      this.lines.push("</g>");
    } else {
      for (const k of kids) this.node(k, localMatrix(k));
    }
    this.lines.push("</g>");
  }

  private paints(n: ReadonlyNode, stroke: boolean): ResolvedPaint[] {
    if (stroke && !hasVisibleStroke(n)) return [];
    const out: ResolvedPaint[] = [];
    for (const p of stroke ? n.strokes : n.fills) {
      const r = resolvePaint(p, this.warn);
      if (r) out.push(r);
    }
    return out;
  }

  private readonly warn = (message: string): void => this.options.warn?.(message);

  /** The elements a layer draws itself: fills, then strokes (text: one `<text>`). */
  private own(n: ReadonlyNode): Element[] {
    const outline = outlineOf(n);
    if (outline.kind === "none") return [];
    if (outline.kind === "text") return this.text(n);
    const fills = this.paints(n, false);
    const strokes = this.paints(n, true);
    const out: Element[] = [];
    const strokeAttrs = (p: ResolvedPaint): Attr[] => [...paintAttrs(p, "stroke"), ...strokeStyle(n)];
    switch (outline.kind) {
      case "rect": {
        const shape = rectAttrs(outline.width, outline.height, outline.radius);
        for (const p of fills) out.push({ tag: "rect", attrs: [...shape, ...paintAttrs(p, "fill")] });
        for (const p of strokes) out.push({ tag: "rect", attrs: [...shape, ...strokeAttrs(p)] });
        break;
      }
      case "ellipse": {
        const rx = outline.width / 2, ry = outline.height / 2;
        const shape: Attr[] = [["cx", fmt(rx)], ["cy", fmt(ry)], ["rx", fmt(Math.abs(rx))], ["ry", fmt(Math.abs(ry))]];
        for (const p of fills) out.push({ tag: "ellipse", attrs: [...shape, ...paintAttrs(p, "fill")] });
        for (const p of strokes) out.push({ tag: "ellipse", attrs: [...shape, ...strokeAttrs(p)] });
        break;
      }
      case "paths": {
        for (const p of fills) {
          for (const f of outline.fills) {
            const attrs: Attr[] = [["d", svgPathData(f.commands)]];
            if (f.evenOdd) attrs.push(["fill-rule", "evenodd"]);
            out.push({ tag: "path", attrs: [...attrs, ...paintAttrs(p, "fill")] });
          }
        }
        if (outline.stroke.length) {
          const d = svgPathData(outline.stroke);
          for (const p of strokes) out.push({ tag: "path", attrs: [["d", d], ...strokeAttrs(p)] });
        }
        break;
      }
    }
    return out;
  }

  /** A `<text>` with one `<tspan>` per line, coloured by the first fill (as drawn). Text strokes aren't drawn. */
  private text(n: ReadonlyNode): Element[] {
    const first = n.fills[0];
    if (!n.characters || !first) return [];
    const paint = resolvePaint(first, this.warn);
    if (!paint) return [];
    const style = textStyle(n);
    const lines = this.options.textLayout?.(n) ?? fallbackTextLines(n);
    const inner = lines
      .filter((l) => l.text.length > 0)
      .map((l) => `<tspan x="${fmt(l.left)}" y="${fmt(l.baseline)}">${escapeText(l.text)}</tspan>`)
      .join("");
    if (!inner) return [];
    const attrs: Attr[] = [...paintAttrs(paint, "fill"), ["xml:space", "preserve"], ["style", "white-space: pre"], ["font-family", escapeAttr(fontFamily(style.family))], ["font-size", fmt(style.size)]];
    if (style.weight !== 400) attrs.push(["font-weight", String(style.weight)]);
    if (style.italic) attrs.push(["font-style", "italic"]);
    return [{ tag: "text", attrs, inner }];
  }
}

function rectAttrs(w: number, h: number, r: number): Attr[] {
  const attrs: Attr[] = [["width", fmt(w)], ["height", fmt(h)]];
  if (r > 0) attrs.push(["rx", fmt(r)]);
  return attrs;
}

/** Fill or stroke attributes for one paint. New paint kinds (gradients) add a case and their `<defs>`. */
function paintAttrs(p: ResolvedPaint, role: "fill" | "stroke"): Attr[] {
  switch (p.kind) {
    case "solid": {
      const attrs: Attr[] = [[role, hex(p.color)]];
      if (p.opacity < 1) attrs.push([`${role}-opacity`, fmt(p.opacity)]);
      return attrs;
    }
  }
}

function strokeStyle(n: ReadonlyNode): Attr[] {
  const attrs: Attr[] = [["stroke-width", fmt(n.strokeWeight)]];
  if (n.strokeCap === "ROUND") attrs.push(["stroke-linecap", "round"]);
  else if (n.strokeCap === "SQUARE") attrs.push(["stroke-linecap", "square"]);
  if (n.strokeJoin === "ROUND") attrs.push(["stroke-linejoin", "round"]);
  else if (n.strokeJoin === "BEVEL") attrs.push(["stroke-linejoin", "bevel"]);
  return attrs;
}

/** An SVG document for a scene. */
export function writeSvg(source: ExportSource, scene: ExportScene, options: SvgWriterOptions = {}): string {
  return new SvgWriter(source, options).write(scene);
}
