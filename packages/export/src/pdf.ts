/**
 * PDF export: a minimal PDF 1.7 writer for vector output, one page per
 * exported layer (1 px = 1 pt, as in Figma). CanvasKit's default build has no
 * PDF backend, so this writes the file itself, with no dependency beyond
 * fflate (already used by the file format) for image data.
 *
 * - Shapes are vector paths: rectangles, rounded rectangles, ellipses,
 *   vectors, stars, polygons and lines, filled with their winding rule and
 *   stroked with their weight, caps and joins (strokes centred, as drawn).
 * - Solid paints with their alpha; linear and radial gradients as shading
 *   patterns (angular and diamond as radial, one alpha per gradient, with
 *   warnings); images as image XObjects clipped to the shape (decoded by
 *   CanvasKit; JPEGs embed as they are without it). Blend modes as `/BM`.
 *   Inside and outside strokes are doubled and clipped to their side.
 * - Layer opacity and blend mode apply to a layer and its children as one
 *   transparency group, as on the canvas.
 * - Shadows and blurs have no PDF equivalent: with CanvasKit, a layer that has
 *   them is drawn by the renderer into an image (with a warning); without it,
 *   they are left out (with a warning).
 * - Frames clip their children.
 * - Text is drawn by the renderer into an image (4 px per pt) and placed
 *   where the text is, so it looks right but can't be selected or searched
 *   yet. Without CanvasKit and fonts, text is left out (with a warning).
 *
 * Output is deterministic: no dates or random ids.
 */

import type { ReadonlyNode } from "@illigma/core";
import { PATH_CLOSE, PATH_CUBIC, PATH_LINE, PATH_MOVE } from "@illigma/format";
import { CLIPPING } from "@illigma/renderer";
import { zlibSync } from "fflate";
import { draws, hasVisibleStroke, IDENTITY, localMatrix, multiply, subtreeBounds, translation, type ExportScene, type ExportSource, type Matrix, type Rect } from "./scene.js";
import {
  ellipseCommands,
  fmt,
  outlineOf,
  pdfBlendMode,
  rectCommands,
  resolvePaint,
  strokeAlignOf,
  visibleEffects,
  type ResolvedPaint,
  type ResolvedStop,
} from "./vector-common.js";

/** A TEXT layer drawn into pixels by the renderer, for the PDF's text fallback. */
export interface RasterText {
  /** Pixels across and down. */
  width: number;
  height: number;
  /** RGBA, unpremultiplied, row by row from the top. Includes the layer's opacity. */
  rgba: Uint8Array;
  /** The area the pixels cover, from the layer's top-left, in its own units. */
  area: { width: number; height: number };
}

export interface PdfWriterOptions {
  /** Draws a TEXT layer's box (its own space) into pixels; null leaves the text out. */
  rasterText?: (n: ReadonlyNode) => RasterText | null;
  /** Draws a layer and its children (the `area` of its own space) into pixels, for layers with shadows or blurs; null draws them without. */
  rasterNode?: (n: ReadonlyNode, area: Rect) => RasterText | null;
  /** Decodes an image file to RGBA pixels (unpremultiplied); without it only JPEG images can be embedded. */
  decodeImage?: (bytes: Uint8Array) => { width: number; height: number; rgba: Uint8Array } | null;
  /** Called once per limitation met, in plain language. */
  warn?: (message: string) => void;
  /** Document title (`/Title`). */
  title?: string;
}

const latin1 = (s: string): Uint8Array => {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
};

/** A PDF text string: plain ASCII in parentheses, anything else as UTF-16BE hex with a byte order mark. */
export function pdfString(s: string): string {
  if (/^[\x20-\x7e]*$/.test(s)) return `(${s.replace(/[\\()]/g, (c) => `\\${c}`)})`;
  let hexs = "FEFF";
  for (let i = 0; i < s.length; i++) hexs += s.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase();
  return `<${hexs}>`;
}

/** Objects of one file, numbered from 1, written in order with a cross-reference table. */
class PdfFile {
  private readonly bodies: (Uint8Array[] | null)[] = [];

  reserve(): number {
    this.bodies.push(null);
    return this.bodies.length;
  }

  set(num: number, ...parts: (string | Uint8Array)[]): void {
    this.bodies[num - 1] = parts.map((p) => (typeof p === "string" ? latin1(p) : p));
  }

  /** A stream object; `dict` is the dictionary's entries without /Length. */
  setStream(num: number, dict: string, data: string | Uint8Array): void {
    const bytes = typeof data === "string" ? latin1(data) : data;
    this.set(num, `<< ${dict}${dict ? " " : ""}/Length ${bytes.length} >>\nstream\n`, bytes, "\nendstream");
  }

  bytes(root: number, info: number): Uint8Array {
    const chunks: Uint8Array[] = [latin1("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n")];
    let offset = chunks[0]!.length;
    const offsets: number[] = [];
    this.bodies.forEach((body, i) => {
      if (!body) throw new Error(`PDF object ${i + 1} was never written.`);
      offsets.push(offset);
      for (const part of [latin1(`${i + 1} 0 obj\n`), ...body, latin1("\nendobj\n")]) {
        chunks.push(part);
        offset += part.length;
      }
    });
    const xref = [`xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`, ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)].join("");
    chunks.push(latin1(`${xref}trailer\n<< /Size ${offsets.length + 1} /Root ${root} 0 R /Info ${info} 0 R >>\nstartxref\n${offset}\n%%EOF\n`));
    const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let at = 0;
    for (const c of chunks) {
      out.set(c, at);
      at += c.length;
    }
    return out;
  }
}

/** Resources and content of one page; transparency groups (forms) share its resources. */
class PageWriter {
  private readonly states = new Map<string, string>();
  private readonly xobjects = new Map<string, number>();
  private readonly patterns = new Map<string, number>();
  /** Image XObject names by image hash, so an image used twice is stored once per page. */
  private readonly imageNames = new Map<string, string | null>();
  private forms = 0;
  private images = 0;
  readonly resources: number;
  private warnedText = false;

  constructor(
    private readonly file: PdfFile,
    private readonly source: ExportSource,
    private readonly options: PdfWriterOptions,
  ) {
    this.resources = file.reserve();
  }

  private readonly warn = (message: string): void => {
    this.options.warn?.(message);
  };

  finish(): void {
    const gs = [...this.states].map(([key, name]) => `/${name} << /Type /ExtGState ${key} >>`).join(" ");
    const xo = [...this.xobjects].map(([name, num]) => `/${name} ${num} 0 R`).join(" ");
    const pat = [...this.patterns].map(([name, num]) => `/${name} ${num} 0 R`).join(" ");
    this.file.set(this.resources, `<< /ExtGState << ${gs} >> /XObject << ${xo} >>${pat ? ` /Pattern << ${pat} >>` : ""} >>`);
  }

  /** An ExtGState for fill (`ca`) and stroke (`CA`) alpha and a blend mode (`BM`). */
  private state(fill: number | null, stroke: number | null, blend: string | null = null): string {
    const key = [fill !== null ? `/ca ${fmt(fill)}` : "", stroke !== null ? `/CA ${fmt(stroke)}` : "", blend ? `/BM /${blend}` : ""].filter(Boolean).join(" ");
    let name = this.states.get(key);
    if (!name) {
      name = `G${this.states.size}`;
      this.states.set(key, name);
    }
    return name;
  }

  /**
   * Write `n` (with transform `m` from the current space) into `out`. `base`
   * maps the current space to the content stream's own space, which shading
   * patterns are placed in.
   */
  node(n: ReadonlyNode, m: Matrix, out: string[], base: Matrix = IDENTITY): void {
    if (!draws(n)) return;
    out.push("q");
    if (!isIdentity(m)) out.push(`${m.map(fmt).join(" ")} cm`);
    const here = multiply(base, m);
    const fx = visibleEffects(n);
    // PDF has no shadows or blurs: a layer with them is drawn by the renderer into an image, when it can be.
    if (fx.any) {
      if (this.options.rasterNode && this.rasterized(n, out)) {
        out.push("Q");
        return;
      }
      this.warn("Shadows and blurs need the drawing engine to go into a PDF, so they were left out.");
    }
    // Rasterized text carries its own opacity.
    const raster = n.type === "TEXT" && !!this.options.rasterText;
    const blend = pdfBlendMode(n.blendMode, this.warn);
    if ((n.opacity < 1 || blend) && !raster) {
      const bounds = subtreeBounds(this.source, n, IDENTITY);
      if (bounds) {
        const body: string[] = [];
        this.content(n, body, IDENTITY); // a form's content starts in the space it is drawn in
        const num = this.file.reserve();
        const name = `Fm${this.forms++}`;
        this.xobjects.set(name, num);
        const bbox = [bounds.x - 1, bounds.y - 1, bounds.x + bounds.width + 1, bounds.y + bounds.height + 1].map(fmt).join(" ");
        this.file.setStream(num, `/Type /XObject /Subtype /Form /BBox [${bbox}] /Group << /S /Transparency >> /Resources ${this.resources} 0 R`, body.join("\n"));
        const alpha = n.opacity < 1 ? n.opacity : null;
        out.push(`/${this.state(alpha, alpha, blend)} gs`, `/${name} Do`);
      }
    } else {
      this.content(n, out, here);
    }
    out.push("Q");
  }

  /** A layer with effects as an image of what the renderer draws. False when it couldn't be drawn. */
  private rasterized(n: ReadonlyNode, out: string[]): boolean {
    const area = subtreeBounds(this.source, n, IDENTITY);
    if (!area || !(area.width > 0) || !(area.height > 0)) return false;
    const raster = this.options.rasterNode?.(n, area) ?? null;
    if (!raster) return false;
    this.warn("Layers with shadows or blurs are drawn into the PDF as images, as on the canvas.");
    if (visibleEffects(n).backgroundBlur > 0) this.warn("Background blur needs what is behind the layer, which a PDF export doesn't have, so it was left out.");
    const name = this.imageXObject(raster.width, raster.height, raster.rgba);
    out.push("q", `${fmt(area.width)} 0 0 ${fmt(-area.height)} ${fmt(area.x)} ${fmt(area.y + area.height)} cm`, `/${name} Do`, "Q");
    return true;
  }

  /** A layer's own paints, then its (clipped) children, in its own space; `here` maps that space to the stream's. */
  private content(n: ReadonlyNode, out: string[], here: Matrix): void {
    const outline = outlineOf(n);
    if (outline.kind === "text") this.text(n, out);
    else if (outline.kind !== "none") {
      let fills: { commands: readonly number[]; evenOdd: boolean }[];
      let stroke: readonly number[];
      if (outline.kind === "paths") {
        fills = outline.fills.map((f) => ({ commands: f.commands, evenOdd: f.evenOdd }));
        stroke = outline.stroke;
      } else {
        const c = outline.kind === "rect" ? rectCommands(outline.width, outline.height, outline.radius) : ellipseCommands(outline.width, outline.height);
        fills = [{ commands: c, evenOdd: false }];
        stroke = c;
      }
      const ctx = { width: n.width, height: n.height, image: this.source.image ? (h: string) => this.source.image?.(h) : undefined };
      for (const p of n.fills) {
        const paint = resolvePaint(p, this.warn, ctx);
        if (!paint) continue;
        for (const f of fills) this.paint(paint, "fill", { path: pathOps(f.commands), evenOdd: f.evenOdd }, out, here, n);
      }
      if (hasVisibleStroke(n) && stroke.length) {
        // Inside and outside strokes: twice the weight, clipped to their side of the outline.
        const align = strokeAlignOf(n);
        const width = n.strokeWeight * (align === "CENTER" ? 1 : 2);
        const style = `${fmt(width)} w ${n.strokeCap === "ROUND" ? 1 : n.strokeCap === "SQUARE" ? 2 : 0} J ${n.strokeJoin === "ROUND" ? 1 : n.strokeJoin === "BEVEL" ? 2 : 0} j 4 M`;
        const path = pathOps(stroke);
        let clip: string | null = null;
        if (align !== "CENTER") {
          const outlinePath = fills.map((f) => pathOps(f.commands)).join(" ");
          const evenOdd = fills.some((f) => f.evenOdd);
          if (align === "INSIDE") clip = `${outlinePath} ${evenOdd ? "W*" : "W"} n`;
          else {
            const pad = 2 * width + 1;
            clip = `${fmt(-pad)} ${fmt(-pad)} ${fmt(n.width + 2 * pad)} ${fmt(n.height + 2 * pad)} re ${outlinePath} W* n`;
          }
        }
        if (clip) out.push("q", clip);
        for (const p of n.strokes) {
          const paint = resolvePaint(p, this.warn, ctx);
          if (paint) this.paint(paint, "stroke", { path: `${style}\n${path}`, evenOdd: false }, out, here, n);
        }
        if (clip) out.push("Q");
      }
    }
    const kids = this.source.children(n.id).filter(draws);
    if (!kids.length) return;
    const clip = CLIPPING.has(n.type);
    if (clip) {
      out.push("q");
      const r = outline.kind === "rect" ? outline.radius : 0;
      out.push(r > 0 ? `${pathOps(rectCommands(n.width, n.height, r))} W n` : `0 0 ${fmt(n.width)} ${fmt(n.height)} re W n`);
    }
    for (const k of kids) this.node(k, localMatrix(k), out, here);
    if (clip) out.push("Q");
  }

  /** One fill or stroke of `shape` (path operators; for strokes, with their style first), in a layer of size `box`. */
  private paint(p: ResolvedPaint, role: "fill" | "stroke", shape: { path: string; evenOdd: boolean }, out: string[], here: Matrix, box: { width: number; height: number }): void {
    const blend = pdfBlendMode(p.blend, this.warn);
    const paintOp = role === "fill" ? (shape.evenOdd ? "f*" : "f") : "S";
    const withAlpha = (alpha: number, body: string[]) => {
      if (alpha < 1 || blend) {
        const a = alpha < 1 ? alpha : null;
        out.push("q", `/${this.state(role === "fill" ? a : null, role === "stroke" ? a : null, blend)} gs`, ...body, "Q");
      } else out.push(...body);
    };
    switch (p.kind) {
      case "solid": {
        const { r, g, b } = p.color;
        withAlpha(p.opacity, [`${fmt(r)} ${fmt(g)} ${fmt(b)} ${role === "fill" ? "rg" : "RG"}`, shape.path, paintOp]);
        return;
      }
      case "gradient": {
        // PDF shadings have no alpha: one alpha for the whole gradient (exact when every stop shares it).
        const alphas = p.stops.map((s) => s.alpha);
        const alpha = alphas.reduce((x, y) => x + y, 0) / alphas.length;
        if (alphas.some((a) => Math.abs(a - (alphas[0] as number)) > 1e-3)) {
          this.warn("PDF gradients can't change transparency along the gradient, so each one uses its stops' average opacity.");
        }
        const pattern = this.shadingPattern(p, here);
        withAlpha(alpha * p.opacity, [role === "fill" ? `/Pattern cs /${pattern} scn` : `/Pattern CS /${pattern} SCN`, shape.path, paintOp]);
        return;
      }
      case "image": {
        if (role === "stroke") {
          this.warn("Image strokes aren't written to PDF yet, so they were left out.");
          return;
        }
        const name = this.imageFile(p);
        if (!name) return;
        // Clip to the shape, then place the image (every tile, for TILE) in the layer's space.
        const body = [`${shape.path} ${shape.evenOdd ? "W*" : "W"} n`, `${p.matrix.map(fmt).join(" ")} cm`];
        const draw = (x: number, y: number) => `q ${p.width} 0 0 ${-p.height} ${fmt(x)} ${fmt(y + p.height)} cm /${name} Do Q`;
        if (!p.tile) body.push(draw(0, 0));
        else {
          const [a, b, c, d] = p.matrix;
          const across = Math.ceil(box.width / Math.max(Math.hypot(a, b) * p.width, 1e-6));
          const down = Math.ceil(box.height / Math.max(Math.hypot(c, d) * p.height, 1e-6));
          if (across * down > MAX_TILES) {
            this.warn(`An image tiles more than ${MAX_TILES.toLocaleString("en-US")} times, so only the first ${MAX_TILES.toLocaleString("en-US")} tiles were written.`);
          }
          let count = 0;
          for (let j = 0; j < down && count < MAX_TILES; j++) {
            for (let i = 0; i < across && count < MAX_TILES; i++, count++) body.push(draw(i * p.width, j * p.height));
          }
        }
        withAlpha(p.opacity, body);
        return;
      }
    }
  }

  /** A shading pattern for a gradient, placed through `here` (the layer's space to the stream's). */
  private shadingPattern(p: Extract<ResolvedPaint, { kind: "gradient" }>, here: Matrix): string {
    const linear = p.type === "GRADIENT_LINEAR";
    if (p.type === "GRADIENT_ANGULAR" || p.type === "GRADIENT_DIAMOND") {
      this.warn(`PDF has no ${p.type === "GRADIENT_ANGULAR" ? "angular" : "diamond"} gradient, so it was written as a radial gradient.`);
    }
    const coords = linear ? "/ShadingType 2 /ColorSpace /DeviceRGB /Coords [0 0.5 1 0.5]" : "/ShadingType 3 /ColorSpace /DeviceRGB /Coords [0.5 0.5 0 0.5 0.5 0.5]";
    const num = this.file.reserve();
    this.file.set(num, `<< /Type /Pattern /PatternType 2 /Shading << ${coords} /Function ${shadingFunction(p.stops)} /Extend [true true] >> /Matrix [${multiply(here, p.matrix).map(fmt).join(" ")}] >>`);
    const name = `P${this.patterns.size}`;
    this.patterns.set(name, num);
    return name;
  }

  /** The image XObject for an image paint, once per image; null (reported) when it can't be decoded. */
  private imageFile(p: Extract<ResolvedPaint, { kind: "image" }>): string | null {
    if (this.imageNames.has(p.hash)) return this.imageNames.get(p.hash) ?? null;
    let name: string | null = null;
    const pixels = this.options.decodeImage?.(p.bytes) ?? null;
    if (pixels) name = this.imageXObject(pixels.width, pixels.height, pixels.rgba);
    else if (p.format === "jpg") name = this.jpegXObject(p.bytes);
    if (!name) this.warn("Images other than JPEG need the drawing engine to go into a PDF, so some were left out.");
    this.imageNames.set(p.hash, name);
    return name;
  }

  /** An RGB image XObject (with its alpha as a soft mask when it has any), from unpremultiplied RGBA rows. */
  private imageXObject(width: number, height: number, rgba: Uint8Array): string {
    const rgb = new Uint8Array(width * height * 3);
    const alpha = new Uint8Array(width * height);
    let opaque = true;
    for (let i = 0, j = 0, k = 0; i < rgba.length; i += 4, j += 3, k++) {
      rgb[j] = rgba[i] as number;
      rgb[j + 1] = rgba[i + 1] as number;
      rgb[j + 2] = rgba[i + 2] as number;
      alpha[k] = rgba[i + 3] as number;
      if (alpha[k] !== 255) opaque = false;
    }
    let smask = "";
    if (!opaque) {
      const mask = this.file.reserve();
      this.file.setStream(mask, `/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`, zlibSync(alpha, { level: 9 }));
      smask = ` /SMask ${mask} 0 R`;
    }
    const image = this.file.reserve();
    this.file.setStream(image, `/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode${smask}`, zlibSync(rgb, { level: 9 }));
    const name = `Im${this.images++}`;
    this.xobjects.set(name, image);
    return name;
  }

  /** A JPEG embedded as it is (DCTDecode), without decoding it. */
  private jpegXObject(bytes: Uint8Array): string | null {
    const info = jpegInfo(bytes);
    if (!info) return null;
    const space = info.components === 1 ? "/DeviceGray" : info.components === 4 ? "/DeviceCMYK /Decode [1 0 1 0 1 0 1 0]" : "/DeviceRGB";
    const image = this.file.reserve();
    this.file.setStream(image, `/Type /XObject /Subtype /Image /Width ${info.width} /Height ${info.height} /ColorSpace ${space} /BitsPerComponent 8 /Filter /DCTDecode`, bytes);
    const name = `Im${this.images++}`;
    this.xobjects.set(name, image);
    return name;
  }

  /** Text as an image of what the renderer draws, over the layer's box. */
  private text(n: ReadonlyNode, out: string[]): void {
    if (!n.characters || !n.fills.some((f) => f.visible)) return;
    const raster = this.options.rasterText?.(n) ?? null;
    if (!raster) {
      if (!this.warnedText) this.warn("Text was left out of the PDF: drawing text needs the drawing engine and fonts.");
      this.warnedText = true;
      return;
    }
    if (!this.warnedText) this.warn("Text in the PDF is an image of the text, so it can't be selected or searched yet.");
    this.warnedText = true;
    const name = this.imageXObject(raster.width, raster.height, raster.rgba);
    // The image's unit square, flipped so its first row is at the top of the box.
    out.push("q", `${fmt(raster.area.width)} 0 0 ${fmt(-raster.area.height)} 0 ${fmt(raster.area.height)} cm`, `/${name} Do`, "Q");
  }
}

/** At most this many image tiles per paint. */
const MAX_TILES = 10_000;

/** A PDF function from 0–1 to RGB through the stops: one exponential segment per pair, stitched. */
function shadingFunction(stops: readonly ResolvedStop[]): string {
  const c = (s: ResolvedStop) => `[${fmt(s.color.r)} ${fmt(s.color.g)} ${fmt(s.color.b)}]`;
  const all = [...stops];
  const first = all[0] as ResolvedStop;
  const last = all[all.length - 1] as ResolvedStop;
  if (first.position > 0) all.unshift({ ...first, position: 0 });
  if (last.position < 1) all.push({ ...last, position: 1 });
  const segments: [ResolvedStop, ResolvedStop][] = [];
  for (let i = 0; i + 1 < all.length; i++) {
    const a = all[i] as ResolvedStop, b = all[i + 1] as ResolvedStop;
    if (b.position > a.position) segments.push([a, b]);
  }
  const seg = ([a, b]: [ResolvedStop, ResolvedStop]) => `<< /FunctionType 2 /Domain [0 1] /C0 ${c(a)} /C1 ${c(b)} /N 1 >>`;
  if (segments.length === 0) return seg([first, first]);
  if (segments.length === 1) return seg(segments[0] as [ResolvedStop, ResolvedStop]);
  const bounds = segments.slice(1).map(([a]) => fmt(a.position));
  return `<< /FunctionType 3 /Domain [0 1] /Functions [${segments.map(seg).join(" ")}] /Bounds [${bounds.join(" ")}] /Encode [${segments.map(() => "0 1").join(" ")}] >>`;
}

/** A JPEG's size and colour components, from its start-of-frame marker. */
function jpegInfo(b: Uint8Array): { width: number; height: number; components: number } | null {
  const u16 = (i: number) => ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  for (let i = 2; i + 9 < b.length; ) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1] as number;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      i += 2;
      continue;
    }
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = u16(i + 5), width = u16(i + 7), components = b[i + 9] as number;
      return width > 0 && height > 0 && [1, 3, 4].includes(components) ? { width, height, components } : null;
    }
    i += 2 + u16(i + 2);
  }
  return null;
}

function isIdentity(m: Matrix): boolean {
  return m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] === 0;
}

/** Path commands as PDF path operators. */
export function pathOps(commands: readonly number[]): string {
  const ops: string[] = [];
  for (let i = 0; i < commands.length; ) {
    const verb = commands[i++];
    const take = (k: number) => {
      const v = commands.slice(i, i + k).map((x) => fmt(x as number));
      i += k;
      return v.join(" ");
    };
    if (verb === PATH_MOVE) ops.push(`${take(2)} m`);
    else if (verb === PATH_LINE) ops.push(`${take(2)} l`);
    else if (verb === PATH_CUBIC) ops.push(`${take(6)} c`);
    else if (verb === PATH_CLOSE) ops.push("h");
    else break;
  }
  return ops.join(" ");
}

/** A PDF with one page per scene. */
export function writePdf(source: ExportSource, scenes: readonly ExportScene[], options: PdfWriterOptions = {}): Uint8Array {
  const file = new PdfFile();
  const catalog = file.reserve();
  const pages = file.reserve();
  const info = file.reserve();
  const kids: number[] = [];
  for (const scene of scenes) {
    const page = file.reserve();
    const contents = file.reserve();
    const writer = new PageWriter(file, source, options);
    const w = Math.max(scene.region.width, 1);
    const h = Math.max(scene.region.height, 1);
    // Design space is y-down from the region's top-left; PDF space is y-up from the bottom-left.
    const ops: string[] = [`1 0 0 -1 0 ${fmt(h)} cm`];
    if (fmt(scene.region.x) !== "0" || fmt(scene.region.y) !== "0") ops.push(`1 0 0 1 ${fmt(-scene.region.x)} ${fmt(-scene.region.y)} cm`);
    if (!isIdentity(scene.rootMatrix)) ops.push(`${scene.rootMatrix.map(fmt).join(" ")} cm`);
    // The same transforms as a matrix, for placing gradient patterns (which ignore the current transform).
    const base = multiply(multiply([1, 0, 0, -1, 0, h], translation(-scene.region.x, -scene.region.y)), scene.rootMatrix);
    for (const root of scene.roots) writer.node(root, localMatrix(root), ops, base);
    writer.finish();
    file.setStream(contents, "", ops.join("\n"));
    file.set(page, `<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${fmt(w)} ${fmt(h)}] /Resources ${writer.resources} 0 R /Contents ${contents} 0 R >>`);
    kids.push(page);
  }
  file.set(catalog, `<< /Type /Catalog /Pages ${pages} 0 R >>`);
  file.set(pages, `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`);
  file.set(info, `<< /Producer (Illigma)${options.title !== undefined ? ` /Title ${pdfString(options.title)}` : ""} >>`);
  return file.bytes(catalog, info);
}
