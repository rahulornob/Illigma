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
 *   Gradients are `<linearGradient>` / `<radialGradient>` in the layer's
 *   space (angular and diamond become radial, with a warning); images are
 *   `<pattern>`s using one embedded `<image>` per file. Paint and layer blend
 *   modes are CSS `mix-blend-mode`. Centred strokes are SVG strokes; inside and
 *   outside strokes are doubled and clipped or masked to their side.
 * - Drop shadows, inner shadows and layer blur are one `<filter>` per layer,
 *   from its pixels. Background blur has no SVG equivalent (a warning).
 * - Text is `<text>` with one `<tspan>` per line: where the canvas wraps it
 *   when fonts are given, else one line per line break with Inter's metrics.
 *   Text isn't outlined, so it needs the font where the file is opened.
 */

import type { ReadonlyNode } from "@illigma/core";
import { PATH_CLOSE, PATH_CUBIC, PATH_LINE, PATH_MOVE } from "@illigma/format";
import { CLIPPING, type TextLine } from "@illigma/renderer";
import { draws, hasVisibleStroke, IDENTITY, localMatrix, multiply, subtreeBounds, translation, type ExportScene, type ExportSource, type Matrix } from "./scene.js";
import {
  base64,
  cssBlendMode,
  fallbackTextLines,
  fmt,
  hex,
  outlineOf,
  resolvePaint,
  strokeAlignOf,
  svgMatrix,
  textStyle,
  visibleEffects,
  type Outline,
  type ResolvedPaint,
} from "./vector-common.js";

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

/** Attributes as markup. Several `style` attributes (a layer's and a paint's blend mode) merge into one. */
function attrText(attrs: readonly Attr[]): string {
  const styles = attrs.filter(([k]) => k === "style").map(([, v]) => v);
  let first = true;
  const out: Attr[] = [];
  for (const a of attrs) {
    if (a[0] !== "style") out.push(a);
    else if (first) {
      out.push(["style", styles.join("; ")]); // where the first one was
      first = false;
    }
  }
  return out.map(([k, v]) => ` ${k}="${v}"`).join("");
}

function serialize(e: Element): string {
  const attrs = attrText(e.attrs);
  return e.inner === undefined ? `<${e.tag}${attrs}/>` : `<${e.tag}${attrs}>${e.inner}</${e.tag}>`;
}

/** A CSS font family list entry, quoted when it isn't plain words. */
function fontFamily(name: string): string {
  return /^[A-Za-z][A-Za-z -]*$/.test(name) ? name : `'${name.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

class SvgWriter {
  private readonly lines: string[] = [];
  private readonly defs: string[] = [];
  private readonly ids = new Set<string>();
  /** Image ids already in `<defs>`, by hash. */
  private readonly images = new Map<string, string>();

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
    const xlink = this.images.size ? ` xmlns:xlink="http://www.w3.org/1999/xlink"` : "";
    const out = [`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg"${xlink}>`, ...this.lines];
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
    const blend = cssBlendMode(n.blendMode, this.warn);
    if (blend) common.push(["style", `mix-blend-mode: ${blend}`]);
    const filter = this.effects(n);
    if (filter) common.push(["filter", `url(#${escapeAttr(filter)})`]);

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
    this.lines.push(`<g${attrText(common)}>`);
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
    const ctx = { width: n.width, height: n.height, image: this.source.image ? (h: string) => this.source.image?.(h) : undefined };
    for (const p of stroke ? n.strokes : n.fills) {
      const r = resolvePaint(p, this.warn, ctx);
      if (r) out.push(r);
    }
    return out;
  }

  private readonly warn = (message: string): void => this.options.warn?.(message);

  /** The elements a layer draws itself: fills, then strokes (text: one `<text>` per fill). */
  private own(n: ReadonlyNode): Element[] {
    const outline = outlineOf(n);
    if (outline.kind === "none") return [];
    if (outline.kind === "text") return this.text(n);
    const fills = this.paints(n, false);
    const strokes = this.paints(n, true);
    const out: Element[] = [];
    // Inside and outside strokes: twice the weight, clipped to the inside, or masked to the outside, of the shape.
    const align = strokeAlignOf(n);
    let alignAttr: Attr | null = null;
    if (strokes.length && align !== "CENTER") alignAttr = this.strokeClip(n, outline, align);
    const strokeAttrs = (p: ResolvedPaint): Attr[] => [...this.paintAttrs(p, "stroke"), ...strokeStyle(n, align === "CENTER" ? 1 : 2), ...(alignAttr ? [alignAttr] : [])];
    switch (outline.kind) {
      case "rect": {
        const shape = rectAttrs(outline.width, outline.height, outline.radius);
        for (const p of fills) out.push({ tag: "rect", attrs: [...shape, ...this.paintAttrs(p, "fill")] });
        for (const p of strokes) out.push({ tag: "rect", attrs: [...shape, ...strokeAttrs(p)] });
        break;
      }
      case "ellipse": {
        const shape = ellipseAttrs(outline.width, outline.height);
        for (const p of fills) out.push({ tag: "ellipse", attrs: [...shape, ...this.paintAttrs(p, "fill")] });
        for (const p of strokes) out.push({ tag: "ellipse", attrs: [...shape, ...strokeAttrs(p)] });
        break;
      }
      case "paths": {
        for (const p of fills) {
          for (const f of outline.fills) {
            const attrs: Attr[] = [["d", svgPathData(f.commands)]];
            if (f.evenOdd) attrs.push(["fill-rule", "evenodd"]);
            out.push({ tag: "path", attrs: [...attrs, ...this.paintAttrs(p, "fill")] });
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

  /** The clip (INSIDE) or mask (OUTSIDE) that keeps a doubled stroke on one side of the outline. */
  private strokeClip(n: ReadonlyNode, outline: Outline, align: "INSIDE" | "OUTSIDE"): Attr | null {
    const shapes: Element[] = [];
    if (outline.kind === "rect") shapes.push({ tag: "rect", attrs: rectAttrs(outline.width, outline.height, outline.radius) });
    else if (outline.kind === "ellipse") shapes.push({ tag: "ellipse", attrs: ellipseAttrs(outline.width, outline.height) });
    else if (outline.kind === "paths") {
      for (const f of outline.fills) shapes.push({ tag: "path", attrs: [["d", svgPathData(f.commands)], ...(f.evenOdd ? ([[align === "INSIDE" ? "clip-rule" : "fill-rule", "evenodd"]] as Attr[]) : [])] });
    }
    if (!shapes.length) return null;
    if (align === "INSIDE") {
      const id = this.uniqueId(`stroke_inside_${n.id}`);
      this.defs.push(`<clipPath id="${escapeAttr(id)}">`, ...shapes.map(serialize), "</clipPath>");
      return ["clip-path", `url(#${escapeAttr(id)})`];
    }
    const id = this.uniqueId(`stroke_outside_${n.id}`);
    const pad = 2 * n.strokeWeight + 1;
    const area = [fmt(-pad), fmt(-pad), fmt(n.width + 2 * pad), fmt(n.height + 2 * pad)];
    this.defs.push(
      `<mask id="${escapeAttr(id)}" maskUnits="userSpaceOnUse" x="${area[0]}" y="${area[1]}" width="${area[2]}" height="${area[3]}">`,
      `<rect x="${area[0]}" y="${area[1]}" width="${area[2]}" height="${area[3]}" fill="white"/>`,
      ...shapes.map((s) => serialize({ ...s, attrs: [...s.attrs, ["fill", "black"]] })),
      "</mask>",
    );
    return ["mask", `url(#${escapeAttr(id)})`];
  }

  /** `<text>` with one `<tspan>` per line, once per visible fill (as drawn). Text strokes aren't drawn. */
  private text(n: ReadonlyNode): Element[] {
    if (!n.characters) return [];
    const paints = this.paints(n, false);
    if (!paints.length) return [];
    const style = textStyle(n);
    const lines = this.options.textLayout?.(n) ?? fallbackTextLines(n);
    const inner = lines
      .filter((l) => l.text.length > 0)
      .map((l) => `<tspan x="${fmt(l.left)}" y="${fmt(l.baseline)}">${escapeText(l.text)}</tspan>`)
      .join("");
    if (!inner) return [];
    return paints.map((paint) => {
      const attrs: Attr[] = [...this.paintAttrs(paint, "fill"), ["xml:space", "preserve"], ["style", "white-space: pre"], ["font-family", escapeAttr(fontFamily(style.family))], ["font-size", fmt(style.size)]];
      if (style.weight !== 400) attrs.push(["font-weight", String(style.weight)]);
      if (style.italic) attrs.push(["font-style", "italic"]);
      return { tag: "text", attrs, inner };
    });
  }

  /** Fill or stroke attributes for one paint, with any gradient or image pattern it needs added to `<defs>`. */
  private paintAttrs(p: ResolvedPaint, role: "fill" | "stroke"): Attr[] {
    const attrs: Attr[] = [];
    switch (p.kind) {
      case "solid":
        attrs.push([role, hex(p.color)]);
        break;
      case "gradient":
        attrs.push([role, `url(#${escapeAttr(this.gradient(p))})`]);
        break;
      case "image":
        attrs.push([role, `url(#${escapeAttr(this.pattern(p))})`]);
        break;
    }
    if (p.opacity < 1) attrs.push([`${role}-opacity`, fmt(p.opacity)]);
    const blend = cssBlendMode(p.blend, this.warn);
    if (blend) attrs.push(["style", `mix-blend-mode: ${blend}`]);
    return attrs;
  }

  private gradient(p: Extract<ResolvedPaint, { kind: "gradient" }>): string {
    const linear = p.type === "GRADIENT_LINEAR";
    if (p.type === "GRADIENT_ANGULAR" || p.type === "GRADIENT_DIAMOND") {
      this.warn(`SVG has no ${p.type === "GRADIENT_ANGULAR" ? "angular" : "diamond"} gradient, so it was written as a radial gradient.`);
    }
    const id = this.uniqueId(linear ? "linear" : "radial");
    const geometry = linear ? `x1="0" y1="0.5" x2="1" y2="0.5"` : `cx="0.5" cy="0.5" r="0.5"`;
    const stops = p.stops.map(
      (s) => `<stop offset="${fmt(s.position)}" stop-color="${hex(s.color)}"${s.alpha < 1 ? ` stop-opacity="${fmt(s.alpha)}"` : ""}/>`,
    );
    const tag = linear ? "linearGradient" : "radialGradient";
    this.defs.push(`<${tag} id="${escapeAttr(id)}" ${geometry} gradientUnits="userSpaceOnUse" gradientTransform="${svgMatrix(p.matrix)}">`, ...stops, `</${tag}>`);
    return id;
  }

  /** A pattern showing an image paint in the layer's space; the image itself is in `<defs>` once per file. */
  private pattern(p: Extract<ResolvedPaint, { kind: "image" }>): string {
    let image = this.images.get(p.hash);
    if (!image) {
      image = this.uniqueId(`image_${p.hash.slice(0, 12)}`);
      this.images.set(p.hash, image);
      this.defs.push(`<image id="${escapeAttr(image)}" width="${p.width}" height="${p.height}" preserveAspectRatio="none" xlink:href="data:${MIME[p.format]};base64,${base64(p.bytes)}"/>`);
    }
    const id = this.uniqueId("pattern");
    // An untiled image shows in one tile the size of the layer's box; a tiled one repeats at its scaled size.
    const [a, b, c, d] = p.matrix;
    const tileW = p.tile ? Math.hypot(a, b) * p.width : p.box.width;
    const tileH = p.tile ? Math.hypot(c, d) * p.height : p.box.height;
    this.defs.push(
      `<pattern id="${escapeAttr(id)}" patternUnits="userSpaceOnUse" width="${fmt(tileW)}" height="${fmt(tileH)}">`,
      `<use xlink:href="#${escapeAttr(image)}" transform="${svgMatrix(p.tile ? [a, b, c, d, 0, 0] : p.matrix)}"/>`,
      "</pattern>",
    );
    return id;
  }

  /**
   * A `<filter>` for the layer's drop shadows, inner shadows and layer blur,
   * from its pixels (as Figma's SVG export does), or null when it has none.
   * Background blur has no SVG equivalent: reported, left out.
   */
  private effects(n: ReadonlyNode): string | null {
    const fx = visibleEffects(n);
    if (fx.backgroundBlur > 0) this.warn("SVG has no background blur, so it was left out.");
    if (!fx.drops.length && !fx.inners.length && !(fx.layerBlur > 0)) return null;
    for (const e of [...fx.drops, ...fx.inners]) {
      if (e.blendMode && e.blendMode !== "NORMAL" && e.blendMode !== "PASS_THROUGH") this.warn("Shadow blend modes aren't written to SVG; those shadows are drawn normally.");
    }
    const area = subtreeBounds(this.source, n, IDENTITY) ?? { x: 0, y: 0, width: n.width, height: n.height };
    const id = this.uniqueId(`effects_${n.id}`);
    const f: string[] = [
      `<filter id="${escapeAttr(id)}" x="${fmt(area.x - 2)}" y="${fmt(area.y - 2)}" width="${fmt(area.width + 4)}" height="${fmt(area.height + 4)}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">`,
    ];
    const flood = (c: { r: number; g: number; b: number; a: number }) => `flood-color="${hex(c)}" flood-opacity="${fmt(c.a)}"`;
    const morph = (input: string, spread: number, result: string) =>
      spread ? `<feMorphology in="${input}" operator="${spread > 0 ? "dilate" : "erode"}" radius="${fmt(Math.abs(spread))}" result="${result}"/>` : null;
    const merge: string[] = [];
    fx.drops.forEach((e, i) => {
      const spread = morph("SourceAlpha", e.spread ?? 0, `drop${i}_spread`);
      if (spread) f.push(spread);
      f.push(
        `<feOffset in="${spread ? `drop${i}_spread` : "SourceAlpha"}" dx="${fmt(e.offset.x)}" dy="${fmt(e.offset.y)}"/>`,
        `<feGaussianBlur stdDeviation="${fmt(e.radius / 2)}" result="drop${i}_alpha"/>`,
        `<feFlood ${flood(e.color)} result="drop${i}_color"/>`,
        `<feComposite in="drop${i}_color" in2="drop${i}_alpha" operator="in" result="drop${i}"/>`,
      );
      // Not behind the layer: only where the layer is transparent.
      if (!e.showShadowBehindNode) f.push(`<feComposite in="drop${i}" in2="SourceAlpha" operator="out" result="drop${i}"/>`);
      merge.push(`drop${i}`);
    });
    merge.push("SourceGraphic");
    fx.inners.forEach((e, i) => {
      // The layer's outside as an opaque shape, grown inwards by the spread, moved and blurred, then kept inside the layer.
      f.push(`<feComponentTransfer in="SourceAlpha" result="inner${i}_outside"><feFuncA type="table" tableValues="1 0"/></feComponentTransfer>`);
      const spread = morph(`inner${i}_outside`, e.spread ?? 0, `inner${i}_spread`);
      if (spread) f.push(spread);
      f.push(
        `<feOffset in="${spread ? `inner${i}_spread` : `inner${i}_outside`}" dx="${fmt(e.offset.x)}" dy="${fmt(e.offset.y)}"/>`,
        `<feGaussianBlur stdDeviation="${fmt(e.radius / 2)}" result="inner${i}_alpha"/>`,
        `<feFlood ${flood(e.color)} result="inner${i}_color"/>`,
        `<feComposite in="inner${i}_color" in2="inner${i}_alpha" operator="in"/>`,
        `<feComposite in2="SourceAlpha" operator="in" result="inner${i}"/>`,
      );
      merge.push(`inner${i}`);
    });
    f.push(`<feMerge${fx.layerBlur > 0 ? ` result="merged"` : ""}>`, ...merge.map((m) => `<feMergeNode in="${m}"/>`), "</feMerge>");
    if (fx.layerBlur > 0) f.push(`<feGaussianBlur in="merged" stdDeviation="${fmt(fx.layerBlur / 2)}"/>`);
    f.push("</filter>");
    this.defs.push(...f);
    return id;
  }
}

function rectAttrs(w: number, h: number, r: number): Attr[] {
  const attrs: Attr[] = [["width", fmt(w)], ["height", fmt(h)]];
  if (r > 0) attrs.push(["rx", fmt(r)]);
  return attrs;
}

function ellipseAttrs(w: number, h: number): Attr[] {
  const rx = w / 2, ry = h / 2;
  return [["cx", fmt(rx)], ["cy", fmt(ry)], ["rx", fmt(Math.abs(rx))], ["ry", fmt(Math.abs(ry))]];
}

function strokeStyle(n: ReadonlyNode, widthScale = 1): Attr[] {
  const attrs: Attr[] = [["stroke-width", fmt(n.strokeWeight * widthScale)]];
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
