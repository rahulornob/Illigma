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
 *   from its pixels (shapes: from their outline as opaque geometry, as the
 *   renderer casts them). A shape's shadows with a spread are SVG shapes
 *   instead, grown or shrunk from its outline, moved and blurred: a filter
 *   can only grow pixels with a square. Background blur has no SVG equivalent (a warning).
 *   Opacity, blend mode and filter never share an element with a clip, a
 *   mask or a paint's blend mode: those get a `<g>` of their own. A NORMAL
 *   group whose children blend is `isolation: isolate`.
 * - Images are stored as in the file and turned by their Exif orientation in
 *   the pattern (the tag itself is cleared). Ids the writer makes start with
 *   a fingerprint of the file, so inlined exports don't clash.
 * - Text is `<text>` with one `<tspan>` per line: where the canvas wraps it
 *   when fonts are given, else one line per line break with Inter's metrics.
 *   Text isn't outlined, so it needs the font where the file is opened.
 */

import type { ReadonlyNode } from "@illigma/core";
import { PATH_CLOSE, PATH_CUBIC, PATH_LINE, PATH_MOVE } from "@illigma/format";
import { CLIPPING, type TextLine } from "@illigma/renderer";
import { draws, hasVisibleStroke, IDENTITY, localMatrix, multiply, subtreeBounds, translation, type ExportScene, type ExportSource, type Matrix, type TextBounds } from "./scene.js";
import {
  base64,
  blendsInside,
  cssBlendMode,
  fallbackTextLines,
  fmt,
  fmtFine,
  hashText,
  hex,
  leastPaintAlpha,
  orientationMatrix,
  outlineOf,
  resolvePaint,
  shadowsFromOutline,
  strokeAlignOf,
  svgMatrix,
  textStyle,
  visibleEffects,
  withoutOrientation,
  type Outline,
  type ResolvedPaint,
} from "./vector-common.js";

/**
 * Stands for the export's own id prefix while the file is written: a
 * character `escapeAttr` and `escapeText` remove, so it appears nowhere else.
 * The finished file replaces it with a fingerprint of its own content, so
 * two exports inlined in one page don't share ids, and the same layers
 * still give the same bytes.
 */
const ID_TOKEN = "\u0001";

/** A node id as part of an XML id: letters, digits, "_" and "-" only. */
const idPart = (s: string): string => s.replace(/[^A-Za-z0-9_-]/g, "_");

/** Smallest tile an image pattern is written with, in layer units (smaller ones are enlarged, with a warning). */
const MIN_TILE = 1e-4;

export interface SvgWriterOptions {
  /** Layer names as `id` attributes (Figma's "Include id attribute"). */
  idAttribute?: boolean;
  /** Line breaks and baselines of a TEXT layer, from the renderer's text engine; null to use the fallback. */
  textLayout?: (n: ReadonlyNode) => TextLine[] | null;
  /** What TEXT layers draw past their box (see `TextBounds`), for filter areas; without it, text counts as its box. */
  textBounds?: TextBounds;
  /** Called once per limitation met, in plain language. */
  warn?: (message: string) => void;
}

type Attr = readonly [name: string, value: string];

interface Element {
  tag: string;
  attrs: Attr[];
  /** Serialized child markup, on the same line (used by `<text>`). */
  inner?: string;
  /** A stroke (drawn after the fills and inner shadows). */
  stroke?: boolean;
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
    const text = out.join("\n");
    if (!text.includes(ID_TOKEN)) return text;
    // Generated ids start with a fingerprint of the file, so they are unique to this export's content.
    return text.replaceAll(ID_TOKEN, `i${hashText(text)}_`);
  }

  private uniqueId(base: string): string {
    let id = base;
    for (let i = 2; this.ids.has(id); i++) id = `${base}_${i}`;
    this.ids.add(id);
    return id;
  }

  /** An id for something the writer makes (a clip, gradient, pattern, filter), prefixed with the export's own token. Safe in attributes as it is. */
  private generatedId(base: string, n?: ReadonlyNode): string {
    return this.uniqueId(`${ID_TOKEN}${base}${n ? `_${idPart(n.id)}` : ""}`);
  }

  /** Write `n` and its children; `m` is its full transform from the parent element's space. */
  private node(n: ReadonlyNode, m: Matrix): void {
    if (!draws(n)) return;
    const common: Attr[] = [];
    if (this.options.idAttribute) common.push(["id", escapeAttr(this.uniqueId(n.name.replace(INVALID_XML, "") || n.type.toLowerCase()))]);
    const transform = transformAttr(m);
    if (transform) common.push(["transform", transform]);
    const kids = this.source.children(n.id).filter(draws);
    // Opacity, blend mode and filter apply to the layer as a whole: they never share an element with a clip or mask.
    const group: Attr[] = [];
    if (n.opacity < 1) group.push(["opacity", fmt(n.opacity)]);
    const blend = cssBlendMode(n.blendMode, this.warn);
    if (blend) group.push(["style", `mix-blend-mode: ${blend}`]);
    // A NORMAL layer keeps its children's blend modes inside it, as the renderer does.
    else if (n.blendMode === "NORMAL" && kids.length && blendsInside((id) => this.source.children(id), kids)) group.push(["style", "isolation: isolate"]);
    const shadows = this.outlineShadows(n, kids.length > 0);
    const filter = this.effects(n, kids.length > 0, shadows !== null);
    if (filter) group.push(["filter", `url(#${filter})`]);
    common.push(...group);

    const own = this.own(n);
    if (shadows) {
      // Drop shadows under the layer; inner shadows over its fills, under its strokes and children (as the renderer draws them).
      this.lines.push(`<g${attrText(common)}>`, ...shadows.drops);
      let inners = false;
      for (const e of own) {
        if (e.stroke && !inners) {
          this.lines.push(...shadows.inners);
          inners = true;
        }
        this.lines.push(serialize(e));
      }
      if (!inners) this.lines.push(...shadows.inners);
      this.children(n, kids);
      this.lines.push("</g>");
      return;
    }
    if (!kids.length) {
      if (!own.length) return;
      if (own.length === 1) {
        const only = own[0] as Element;
        const clipped = only.attrs.some(([k]) => k === "clip-path" || k === "mask");
        const twoBlends = !!blend && only.attrs.some(([k, v]) => k === "style" && v.includes("mix-blend-mode"));
        if (!(group.length && (clipped || twoBlends))) {
          this.lines.push(serialize({ ...only, attrs: [...common, ...only.attrs] }));
          return;
        }
      }
    }
    this.lines.push(`<g${attrText(common)}>`);
    for (const e of own) this.lines.push(serialize(e));
    this.children(n, kids);
    this.lines.push("</g>");
  }

  /** A layer's children, clipped to its box when it clips. */
  private children(n: ReadonlyNode, kids: readonly ReadonlyNode[]): void {
    if (kids.length && CLIPPING.has(n.type)) {
      const clip = this.generatedId("clip", n);
      const r = outlineOf(n);
      const box = r.kind === "rect" ? r : { width: n.width, height: n.height, radius: 0 };
      this.defs.push(`<clipPath id="${clip}">`, serialize({ tag: "rect", attrs: rectAttrs(box.width, box.height, box.radius) }), "</clipPath>");
      this.lines.push(`<g clip-path="url(#${clip})">`);
      for (const k of kids) this.node(k, localMatrix(k));
      this.lines.push("</g>");
    } else {
      for (const k of kids) this.node(k, localMatrix(k));
    }
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
    const strokeAttrs = (p: ResolvedPaint): Attr[] => [...this.paintAttrs(p, "stroke", n), ...strokeStyle(n, align === "CENTER" ? 1 : 2), ...(alignAttr ? [alignAttr] : [])];
    switch (outline.kind) {
      case "rect": {
        const shape = rectAttrs(outline.width, outline.height, outline.radius);
        for (const p of fills) out.push({ tag: "rect", attrs: [...shape, ...this.paintAttrs(p, "fill", n)] });
        for (const p of strokes) out.push({ tag: "rect", attrs: [...shape, ...strokeAttrs(p)], stroke: true });
        break;
      }
      case "ellipse": {
        const shape = ellipseAttrs(outline.width, outline.height);
        for (const p of fills) out.push({ tag: "ellipse", attrs: [...shape, ...this.paintAttrs(p, "fill", n)] });
        for (const p of strokes) out.push({ tag: "ellipse", attrs: [...shape, ...strokeAttrs(p)], stroke: true });
        break;
      }
      case "paths": {
        for (const p of fills) {
          for (const f of outline.fills) {
            const attrs: Attr[] = [["d", svgPathData(f.commands)]];
            if (f.evenOdd) attrs.push(["fill-rule", "evenodd"]);
            out.push({ tag: "path", attrs: [...attrs, ...this.paintAttrs(p, "fill", n)] });
          }
        }
        if (outline.stroke.length) {
          const d = svgPathData(outline.stroke);
          for (const p of strokes) out.push({ tag: "path", attrs: [["d", d], ...strokeAttrs(p)], stroke: true });
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
      const id = this.generatedId("stroke_inside", n);
      this.defs.push(`<clipPath id="${id}">`, ...shapes.map(serialize), "</clipPath>");
      return ["clip-path", `url(#${id})`];
    }
    const id = this.generatedId("stroke_outside", n);
    // The doubled stroke reaches its weight past the outline, and mitred corners up to the miter limit (4) times that.
    const pad = 4 * n.strokeWeight + 1;
    const area = [fmt(-pad), fmt(-pad), fmt(n.width + 2 * pad), fmt(n.height + 2 * pad)];
    this.defs.push(
      `<mask id="${id}" maskUnits="userSpaceOnUse" x="${area[0]}" y="${area[1]}" width="${area[2]}" height="${area[3]}">`,
      `<rect x="${area[0]}" y="${area[1]}" width="${area[2]}" height="${area[3]}" fill="white"/>`,
      ...shapes.map((s) => serialize({ ...s, attrs: [...s.attrs, ["fill", "black"]] })),
      "</mask>",
    );
    return ["mask", `url(#${id})`];
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
      const attrs: Attr[] = [...this.paintAttrs(paint, "fill", n), ["xml:space", "preserve"], ["style", "white-space: pre"], ["font-family", escapeAttr(fontFamily(style.family))], ["font-size", fmt(style.size)]];
      if (style.weight !== 400) attrs.push(["font-weight", String(style.weight)]);
      if (style.italic) attrs.push(["font-style", "italic"]);
      return { tag: "text", attrs, inner };
    });
  }

  /** Fill or stroke attributes for one paint, with any gradient or image pattern it needs added to `<defs>`. */
  private paintAttrs(p: ResolvedPaint, role: "fill" | "stroke", n: ReadonlyNode): Attr[] {
    const attrs: Attr[] = [];
    switch (p.kind) {
      case "solid":
        attrs.push([role, hex(p.color)]);
        break;
      case "gradient":
        attrs.push([role, `url(#${this.gradient(p, n)})`]);
        break;
      case "image":
        attrs.push([role, `url(#${this.pattern(p, n)})`]);
        break;
    }
    if (p.opacity < 1) attrs.push([`${role}-opacity`, fmt(p.opacity)]);
    const blend = cssBlendMode(p.blend, this.warn);
    if (blend) attrs.push(["style", `mix-blend-mode: ${blend}`]);
    return attrs;
  }

  private gradient(p: Extract<ResolvedPaint, { kind: "gradient" }>, n: ReadonlyNode): string {
    const linear = p.type === "GRADIENT_LINEAR";
    if (p.type === "GRADIENT_ANGULAR" || p.type === "GRADIENT_DIAMOND") {
      this.warn(`SVG has no ${p.type === "GRADIENT_ANGULAR" ? "angular" : "diamond"} gradient, so it was written as a radial gradient.`);
    }
    const id = this.generatedId(linear ? "linear" : "radial", n);
    const geometry = linear ? `x1="0" y1="0.5" x2="1" y2="0.5"` : `cx="0.5" cy="0.5" r="0.5"`;
    const stops = p.stops.map(
      (s) => `<stop offset="${fmt(s.position)}" stop-color="${hex(s.color)}"${s.alpha < 1 ? ` stop-opacity="${fmt(s.alpha)}"` : ""}/>`,
    );
    const tag = linear ? "linearGradient" : "radialGradient";
    this.defs.push(`<${tag} id="${id}" ${geometry} gradientUnits="userSpaceOnUse" gradientTransform="${svgMatrix(p.matrix)}">`, ...stops, `</${tag}>`);
    return id;
  }

  /** A pattern showing an image paint in the layer's space; the image itself is in `<defs>` once per file. */
  private pattern(p: Extract<ResolvedPaint, { kind: "image" }>, n: ReadonlyNode): string {
    const { info } = p;
    let image = this.images.get(p.hash);
    if (!image) {
      image = this.generatedId(`image_${idPart(p.hash.slice(0, 12))}`);
      this.images.set(p.hash, image);
      // Stored as it is in the file, with its Exif orientation cleared: the pattern turns it (viewers disagree on honouring the tag).
      const bytes = withoutOrientation(p.bytes, info);
      this.defs.push(`<image id="${image}" width="${info.rawWidth}" height="${info.rawHeight}" preserveAspectRatio="none" xlink:href="data:${MIME[p.format]};base64,${base64(bytes)}"/>`);
    }
    const id = this.generatedId("pattern", n);
    // An untiled image shows in one tile the size of the layer's box; a tiled one repeats at its scaled size.
    let [a, b, c, d] = p.matrix;
    let tileW = p.tile ? Math.hypot(a, b) * p.width : p.box.width;
    let tileH = p.tile ? Math.hypot(c, d) * p.height : p.box.height;
    if (p.tile && !(tileW >= MIN_TILE && tileH >= MIN_TILE)) {
      // A pattern tile rounds to nothing (and draws nothing): enlarge it, keeping its shape.
      const k = Math.max(MIN_TILE / tileW, MIN_TILE / tileH);
      if (!Number.isFinite(k)) return this.skipPattern(id);
      [a, b, c, d] = [a * k, b * k, c * k, d * k];
      tileW *= k;
      tileH *= k;
      this.warn("An image tiles too small to write to SVG, so its tiles were enlarged.");
    }
    const toShown = orientationMatrix(info.orientation, info.rawWidth, info.rawHeight);
    const place = multiply(p.tile ? [a, b, c, d, 0, 0] : p.matrix, toShown);
    this.defs.push(
      `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${fmt(tileW)}" height="${fmt(tileH)}">`,
      `<use xlink:href="#${image}" transform="matrix(${place.map(fmtFine).join(" ")})"/>`,
      "</pattern>",
    );
    return id;
  }

  /** An empty pattern, for an image that can't be placed. */
  private skipPattern(id: string): string {
    this.defs.push(`<pattern id="${id}" width="0" height="0"/>`);
    return id;
  }

  /**
   * A shape's shadows as SVG shapes, when one of them has a spread: the
   * outline grown or shrunk by the spread (rectangles, rounded rectangles and
   * ellipses exactly, as the renderer does; paths by a stroke twice the
   * spread, mitred), moved and blurred. A filter can only grow pixels with a
   * square (`feMorphology`), which would turn round shapes square. Drop
   * shadows are cast from the filled outline and a centred stroke, kept out
   * from under a see-through layer unless shown behind it; inner shadows are
   * the blurred outside of the moved, shrunk outline, clipped to the outline.
   * Null when the filter casts the shadows: no spread, layers that cast from
   * their pixels (groups, text, frames without a fill), or a one-sided stroke.
   */
  private outlineShadows(n: ReadonlyNode, hasKids: boolean): { drops: string[]; inners: string[] } | null {
    const fx = visibleEffects(n);
    if (![...fx.drops, ...fx.inners].some((e) => (e.spread ?? 0) !== 0) || !shadowsFromOutline(n, hasKids)) return null;
    const outline = outlineOf(n);
    if (outline.kind !== "rect" && outline.kind !== "ellipse" && !(outline.kind === "paths" && outline.fills.length)) return null;
    const filled = n.fills.some((p) => p.visible);
    const stroked = hasVisibleStroke(n);
    const align = strokeAlignOf(n);
    // Drop shadows come from the filled outline and a centred stroke; a one-sided stroke's ring stays with the filter.
    const ring = stroked && align === "CENTER";
    if (fx.drops.length && stroked && !ring && !(align === "INSIDE" && filled)) return null;
    if (ring && fx.drops.some((e) => (e.spread ?? 0) < 0)) return null;
    const base = subtreeBounds(this.source, n, IDENTITY, this.options.textBounds) ?? { x: 0, y: 0, width: n.width, height: n.height };
    const reach = Math.max(0, ...[...fx.drops, ...fx.inners].map((e) => Math.abs(e.offset.x) + Math.abs(e.offset.y) + 1.5 * e.radius + Math.abs(e.spread ?? 0)));
    const pad = reach + 2;
    const area = { x: base.x - pad, y: base.y - pad, width: base.width + 2 * pad, height: base.height + 2 * pad };
    const areaAttrs = `x="${fmt(area.x)}" y="${fmt(area.y)}" width="${fmt(area.width)}" height="${fmt(area.height)}"`;
    const fullRect = (fill: string) => `<rect ${areaAttrs} fill="${fill}"/>`;
    const blurred = (radius: number, opacity: number, transform: string | null, body: string[]): string[] => {
      const attrs: string[] = [];
      if (transform) attrs.push(` transform="${transform}"`);
      if (radius > 0) {
        const id = this.generatedId("shadow_blur", n);
        this.defs.push(`<filter id="${id}" ${areaAttrs} filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">`, `<feGaussianBlur stdDeviation="${fmt(radius / 2)}"/>`, "</filter>");
        attrs.push(` filter="url(#${id})"`);
      }
      if (opacity < 1) attrs.push(` opacity="${fmt(opacity)}"`);
      return [`<g${attrs.join("")}>`, ...body, "</g>"];
    };
    const move = (e: { offset: { x: number; y: number } }) => (fmt(e.offset.x) !== "0" || fmt(e.offset.y) !== "0" ? `translate(${fmt(e.offset.x)} ${fmt(e.offset.y)})` : null);
    const strokeRing = (color: string, width: number): string[] => {
      if (!ring || !(width > 0)) return [];
      const style = strokeStyle(n).filter(([k]) => k !== "stroke-width");
      const attrs: Attr[] = [["fill", "none"], ["stroke", color], ["stroke-width", fmt(width)], ...style];
      if (outline.kind === "rect") return [serialize({ tag: "rect", attrs: [...rectAttrs(outline.width, outline.height, outline.radius), ...attrs] })];
      if (outline.kind === "ellipse") return [serialize({ tag: "ellipse", attrs: [...ellipseAttrs(outline.width, outline.height), ...attrs] })];
      return outline.kind === "paths" && outline.stroke.length ? [serialize({ tag: "path", attrs: [["d", svgPathData(outline.stroke)], ...attrs] })] : [];
    };

    const drops: string[] = [];
    const castsDrops = filled || ring;
    if (fx.drops.length && castsDrops) {
      // Not under the layer where it lets the shadow show through, unless asked.
      let knockout: string | null = null;
      if (!opaque(n) && fx.drops.some((e) => !e.showShadowBehindNode)) {
        knockout = this.generatedId("shadow_knockout", n);
        this.defs.push(`<mask id="${knockout}" maskUnits="userSpaceOnUse" ${areaAttrs}>`, fullRect("white"), ...(filled ? this.spreadShape(n, outline, 0, "black") : []), ...strokeRing("black", n.strokeWeight), "</mask>");
      }
      for (const e of fx.drops) {
        const s = e.spread ?? 0;
        const color = hex(e.color);
        const body = [...(filled ? this.spreadShape(n, outline, s, color, areaAttrs) : []), ...strokeRing(color, n.strokeWeight + 2 * s)];
        if (!body.length) continue;
        const shadow = blurred(e.radius, e.color.a, move(e), body);
        drops.push(...(knockout && !e.showShadowBehindNode ? [`<g mask="url(#${knockout})">`, ...shadow, "</g>"] : shadow));
      }
    }

    const inners: string[] = [];
    if (fx.inners.length) {
      const clip = this.generatedId("shadow_clip", n);
      this.defs.push(`<clipPath id="${clip}">`, ...this.spreadShape(n, outline, 0, "black", undefined, true), "</clipPath>");
      for (const e of fx.inners) {
        // The hole the shadow is cast around: the outline shrunk by the spread (grown for a negative one), moved.
        const hole = this.generatedId("shadow_hole", n);
        const t = move(e);
        this.defs.push(
          `<mask id="${hole}" maskUnits="userSpaceOnUse" ${areaAttrs}>`,
          fullRect("white"),
          ...(t ? [`<g transform="${t}">`] : []),
          ...this.spreadShape(n, outline, -(e.spread ?? 0), "black", undefined, false, "white"),
          ...(t ? ["</g>"] : []),
          "</mask>",
        );
        inners.push(`<g clip-path="url(#${clip})">`, ...blurred(e.radius, e.color.a, null, [`<rect ${areaAttrs} fill="${hex(e.color)}" mask="url(#${hole})"/>`]), "</g>");
      }
    }
    return { drops, inners };
  }

  /**
   * The outline grown by `s` (shrunk when negative), filled with `color`:
   * rectangles keep square corners square and grow round ones, ellipses grow
   * their radii, as the renderer does; paths grow by a mitred stroke of 2s
   * and shrink through a mask (`area`) whose stroke cuts 2s off, or, over a
   * known `background`, by a stroke in it. `clip`: clip-path children.
   */
  private spreadShape(n: ReadonlyNode, outline: Outline, s: number, color: string, area?: string, clip = false, background?: string): string[] {
    const paint: Attr[] = clip ? [] : [["fill", color]];
    if (outline.kind === "rect" || outline.kind === "ellipse") {
      const w = outline.width + 2 * s, h = outline.height + 2 * s;
      if (!(w > 0) || !(h > 0)) return [];
      if (outline.kind === "ellipse") {
        const [cx, cy] = [outline.width / 2, outline.height / 2];
        return [serialize({ tag: "ellipse", attrs: [["cx", fmt(cx)], ["cy", fmt(cy)], ["rx", fmt(w / 2)], ["ry", fmt(h / 2)], ...paint] })];
      }
      const r = outline.radius > 0 ? Math.max(0, outline.radius + s) : 0;
      const at: Attr[] = s ? [["x", fmt(-s)], ["y", fmt(-s)]] : [];
      return [serialize({ tag: "rect", attrs: [...at, ...rectAttrs(w, h, r), ...paint] })];
    }
    if (outline.kind !== "paths") return [];
    const path = (f: (typeof outline.fills)[number], extra: Attr[]): string => {
      const attrs: Attr[] = [["d", svgPathData(f.commands)]];
      if (f.evenOdd) attrs.push([clip ? "clip-rule" : "fill-rule", "evenodd"]);
      return serialize({ tag: "path", attrs: [...attrs, ...paint, ...extra] });
    };
    const edge = (c: string): Attr[] => [["stroke", c], ["stroke-width", fmt(2 * Math.abs(s))], ["stroke-miterlimit", "4"]];
    if (s === 0 || clip) return outline.fills.map((f) => path(f, []));
    if (s > 0) return outline.fills.map((f) => path(f, edge(color)));
    if (background) return outline.fills.map((f) => path(f, edge(background)));
    const id = this.generatedId("shadow_shrink", n);
    this.defs.push(`<mask id="${id}" maskUnits="userSpaceOnUse" ${area ?? `x="${fmt(-n.width)}" y="${fmt(-n.height)}" width="${fmt(3 * n.width)}" height="${fmt(3 * n.height)}"`}>`);
    for (const f of outline.fills) this.defs.push(serialize({ tag: "path", attrs: [["d", svgPathData(f.commands)], ...(f.evenOdd ? ([["fill-rule", "evenodd"]] as Attr[]) : []), ["fill", "white"], ...edge("black")] }));
    this.defs.push("</mask>");
    return [`<g mask="url(#${id})">`, ...outline.fills.map((f) => path(f, [])), "</g>"];
  }

  /**
   * A `<filter>` for the layer's drop shadows, inner shadows and layer blur,
   * from its pixels (as Figma's SVG export does), or null when it has none.
   * Background blur has no SVG equivalent: reported, left out. With
   * `outlineShadows`, the shadows are drawn as shapes (see `outlineShadows`)
   * and the filter only blurs the layer.
   */
  private effects(n: ReadonlyNode, hasKids: boolean, outlineShadows = false): string | null {
    const all = visibleEffects(n);
    if (all.backgroundBlur > 0) this.warn("SVG has no background blur, so it was left out.");
    for (const e of [...all.drops, ...all.inners]) {
      if (e.blendMode && e.blendMode !== "NORMAL" && e.blendMode !== "PASS_THROUGH") this.warn("Shadow blend modes aren't written to SVG; those shadows are drawn normally.");
    }
    const fx = outlineShadows ? { ...all, drops: [], inners: [] } : all;
    if (!fx.drops.length && !fx.inners.length && !(fx.layerBlur > 0)) return null;
    if ([...fx.drops, ...fx.inners].some((e) => (e.spread ?? 0) !== 0)) {
      this.warn("SVG filters grow shadows by their spread with square corners, so the spread shadows of groups, text and shapes with one-sided strokes are approximate.");
    }
    const area = subtreeBounds(this.source, n, IDENTITY, this.options.textBounds) ?? { x: 0, y: 0, width: n.width, height: n.height };
    const id = this.generatedId("effects", n);
    const f: string[] = [
      `<filter id="${id}" x="${fmt(area.x - 2)}" y="${fmt(area.y - 2)}" width="${fmt(area.width + 4)}" height="${fmt(area.height + 4)}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">`,
    ];
    const flood = (c: { r: number; g: number; b: number; a: number }) => `flood-color="${hex(c)}" flood-opacity="${fmt(c.a)}"`;
    const morph = (input: string, spread: number, result: string) =>
      spread ? `<feMorphology in="${input}" operator="${spread > 0 ? "dilate" : "erode"}" radius="${fmt(Math.abs(spread))}" result="${result}"/>` : null;
    const merge: string[] = [];
    // Shapes cast shadows from their outline, as opaque geometry, however transparent their paints (as the
    // renderer does): their pixels' alpha, scaled up so the faintest paint counts as solid.
    let shape = "SourceAlpha";
    const faintest = leastPaintAlpha(n);
    if ((fx.drops.length || fx.inners.length) && shadowsFromOutline(n, hasKids) && faintest < 1) {
      f.push(`<feComponentTransfer in="SourceAlpha" result="silhouette"><feFuncA type="linear" slope="${fmt(Math.min(255, 1 / Math.max(faintest, 1e-3)))}"/></feComponentTransfer>`);
      shape = "silhouette";
    }
    fx.drops.forEach((e, i) => {
      const spread = morph(shape, e.spread ?? 0, `drop${i}_spread`);
      if (spread) f.push(spread);
      f.push(
        `<feOffset in="${spread ? `drop${i}_spread` : shape}" dx="${fmt(e.offset.x)}" dy="${fmt(e.offset.y)}"/>`,
        `<feGaussianBlur stdDeviation="${fmt(e.radius / 2)}" result="drop${i}_alpha"/>`,
        `<feFlood ${flood(e.color)} result="drop${i}_color"/>`,
        `<feComposite in="drop${i}_color" in2="drop${i}_alpha" operator="in" result="drop${i}"/>`,
      );
      // Not behind the layer: only where the layer is transparent.
      if (!e.showShadowBehindNode) f.push(`<feComposite in="drop${i}" in2="${shape}" operator="out" result="drop${i}"/>`);
      merge.push(`drop${i}`);
    });
    merge.push("SourceGraphic");
    fx.inners.forEach((e, i) => {
      // The layer's outside as an opaque shape, grown inwards by the spread, moved and blurred, then kept inside the layer.
      f.push(`<feComponentTransfer in="${shape}" result="inner${i}_outside"><feFuncA type="table" tableValues="1 0"/></feComponentTransfer>`);
      const spread = morph(`inner${i}_outside`, e.spread ?? 0, `inner${i}_spread`);
      if (spread) f.push(spread);
      f.push(
        `<feOffset in="${spread ? `inner${i}_spread` : `inner${i}_outside`}" dx="${fmt(e.offset.x)}" dy="${fmt(e.offset.y)}"/>`,
        `<feGaussianBlur stdDeviation="${fmt(e.radius / 2)}" result="inner${i}_alpha"/>`,
        `<feFlood ${flood(e.color)} result="inner${i}_color"/>`,
        `<feComposite in="inner${i}_color" in2="inner${i}_alpha" operator="in"/>`,
        `<feComposite in2="${shape}" operator="in" result="inner${i}"/>`,
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

/** True when every visible fill and stroke is an opaque solid colour, so nothing under the layer shows through it (as the renderer decides). */
function opaque(n: ReadonlyNode): boolean {
  return [...n.fills, ...n.strokes].every(
    (p) => !p.visible || (p.type === "SOLID" && p.color.a >= 1 && (p.opacity ?? 1) >= 1 && (!p.blendMode || p.blendMode === "NORMAL" || p.blendMode === "PASS_THROUGH")),
  );
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
