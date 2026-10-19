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
 *   warnings); images as image XObjects clipped to the shape (8-bit grey and
 *   RGB JPEGs embedded as they are, turned by their Exif orientation; other
 *   images decoded by CanvasKit, up to 16,384 px a side and 64 million
 *   pixels). Blend modes as `/BM`. Inside and outside strokes are doubled
 *   and clipped to their side.
 * - Layer opacity and blend mode apply to a layer and its children as one
 *   isolated transparency group, as on the canvas; so does a NORMAL layer
 *   whose children blend.
 * - Shadows and blurs have no PDF equivalent: with CanvasKit, a layer that has
 *   them is drawn by the renderer into an image (2 px per pt, less when the
 *   file's budget of 8 million pixels runs short, then left out; with
 *   warnings); without it, they are left out (with a warning). Background
 *   blur alone is left out (with a warning).
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
import { hasPixelMask, maskOutline } from "./masks.js";
import { draws, hasVisibleStroke, IDENTITY, localMatrix, multiply, subtreeBounds, translation, type ExportScene, type ExportSource, type Matrix, type Rect, type TextBounds } from "./scene.js";
import {
  blendsInside,
  ellipseCommands,
  fmt,
  imagePlacement,
  orientationMatrix,
  outlineOf,
  pdfBlendMode,
  rectCommands,
  resolvePaint,
  strokeAlignOf,
  visibleEffects,
  withoutOrientation,
  type ImageInfo,
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
  /** The area the pixels cover in the layer's own units: from `x`, `y` (default its top-left). */
  area: { x?: number; y?: number; width: number; height: number };
}

export interface PdfWriterOptions {
  /** Draws a TEXT layer (its box, and its lines where they run past it, in its own space) into pixels; null leaves the text out. */
  rasterText?: (n: ReadonlyNode) => RasterText | null;
  /** What TEXT layers draw past their box (see `TextBounds`), for the areas of groups and effects; without it, text counts as its box. */
  textBounds?: TextBounds;
  /**
   * Draws a layer and its children (the `area` of its own space) into pixels,
   * at about `scale` pixels per unit, for layers with shadows or blurs; null
   * draws them without. The writer picks the scale within a pixel budget per file.
   */
  rasterNode?: (n: ReadonlyNode, area: Rect, scale: number) => RasterText | null;
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
  private readonly imageNames = new Map<string, ImageFile | null>();
  private forms = 0;
  private images = 0;
  /** Image tiles written on this page so far (at most MAX_TILES). */
  private tiles = 0;
  readonly resources: number;
  private warnedText = false;

  constructor(
    private readonly file: PdfFile,
    private readonly source: ExportSource,
    private readonly options: PdfWriterOptions,
    private readonly budget: RasterBudget = { remaining: MAX_RASTER_PIXELS, scale: RASTER_SCALE },
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
    const blend = pdfBlendMode(n.blendMode, this.warn);
    if (fx.backgroundBlur > 0) this.warn("Background blur needs what is behind the layer, which a PDF export doesn't have, so it was left out.");
    // PDF has no shadows or blurs: a layer with them is drawn by the renderer into an image, when it can be.
    // Background blur alone isn't worth an image: it would be left out of it anyway.
    if (rasterEffects(fx) || hasPixelMask(n, this.source)) {
      const done = this.options.rasterNode ? this.rasterized(n, out, blend) : "no-engine";
      if (done === "drawn") {
        out.push("Q");
        return;
      }
      if (done === "no-engine" && rasterEffects(fx)) this.warn("Shadows and blurs need the drawing engine to go into a PDF, so they were left out.");
    }
    // Rasterized text carries its own opacity; its blend mode applies to the image.
    const raster = n.type === "TEXT" && !!this.options.rasterText;
    // A NORMAL layer keeps its children's blend modes inside it, as the renderer does.
    const isolate = n.blendMode === "NORMAL" && blendsInside((id) => this.source.children(id), this.source.children(n.id).filter(draws));
    if (raster) {
      if (blend) out.push(`/${this.state(null, null, blend)} gs`);
      this.content(n, out, here);
    } else if (n.opacity < 1 || blend || isolate) {
      const bounds = subtreeBounds(this.source, n, IDENTITY, this.options.textBounds);
      if (bounds) {
        const body: string[] = [];
        this.content(n, body, IDENTITY); // a form's content starts in the space it is drawn in
        const num = this.file.reserve();
        const name = `Fm${this.forms++}`;
        this.xobjects.set(name, num);
        const bbox = [bounds.x - 1, bounds.y - 1, bounds.x + bounds.width + 1, bounds.y + bounds.height + 1].map(fmt).join(" ");
        // Isolated, as the renderer's layers are: children blend with each other, not with what is under the group.
        this.file.setStream(num, `/Type /XObject /Subtype /Form /BBox [${bbox}] /Group << /S /Transparency /I true >> /Resources ${this.resources} 0 R`, body.join("\n"));
        const alpha = n.opacity < 1 ? n.opacity : null;
        if (alpha !== null || blend) out.push(`/${this.state(alpha, alpha, blend)} gs`);
        out.push(`/${name} Do`);
      }
    } else {
      this.content(n, out, here);
    }
    out.push("Q");
  }

  /**
   * A layer with effects as an image of what the renderer draws, within the
   * file's pixel budget: "drawn"; "skipped" (over budget, reported) or
   * "failed" when it is drawn as vectors without its effects.
   */
  private rasterized(n: ReadonlyNode, out: string[], blend: string | null): "drawn" | "skipped" | "failed" | "no-engine" {
    const area = subtreeBounds(this.source, n, IDENTITY, this.options.textBounds);
    if (!area || !(area.width > 0) || !(area.height > 0)) return "failed";
    const units = area.width * area.height;
    // The file's scale, then no more than the layer's share and what is left of the budget.
    const fit = Math.sqrt(Math.min(MAX_LAYER_PIXELS, this.budget.remaining) / units);
    const scale = Math.min(this.budget.scale, fit);
    if (!(scale >= MIN_RASTER_SCALE)) {
      this.warn("This PDF has too many large shadows and blurs to draw them all, so some were left out.");
      return "skipped";
    }
    if (scale < RASTER_SCALE * 0.999) this.warn("This PDF has many large shadows and blurs, so they were drawn at a lower resolution.");
    const raster = this.options.rasterNode?.(n, area, scale) ?? null;
    if (!raster) return "no-engine";
    this.budget.remaining -= raster.width * raster.height;
    this.warn("Layers with shadows or blurs are drawn into the PDF as images, as on the canvas.");
    const name = this.imageXObject(raster.width, raster.height, raster.rgba);
    out.push("q");
    // The layer's opacity is in the pixels; its blend mode applies to the image.
    if (blend) out.push(`/${this.state(null, null, blend)} gs`);
    out.push(`${fmt(area.width)} 0 0 ${fmt(-area.height)} ${fmt(area.x)} ${fmt(area.y + area.height)} cm`, `/${name} Do`, "Q");
    return "drawn";
  }

  /** A layer's own paints, then its (clipped) children, in its own space; `here` maps that space to the stream's. */
  private content(n: ReadonlyNode, out: string[], here: Matrix): void {
    const outline = outlineOf(n, this.source);
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
    const kids = n.type === "BOOLEAN_OPERATION" ? [] : this.source.children(n.id).filter(draws);
    if (!kids.length) return;
    const clip = CLIPPING.has(n.type);
    if (clip) {
      out.push("q");
      const r = outline.kind === "rect" ? outline.radius : 0;
      out.push(r > 0 ? `${pathOps(rectCommands(n.width, n.height, r))} W n` : `0 0 ${fmt(n.width)} ${fmt(n.height)} re W n`);
    }
    this.masked(kids, out, here);
    if (clip) out.push("Q");
  }

  /** Siblings bottom first; a mask hides itself and clips those above it by its outline. */
  private masked(kids: readonly ReadonlyNode[], out: string[], here: Matrix): void {
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i] as ReadonlyNode;
      if (!k.isMask) {
        this.node(k, localMatrix(k), out, here);
        continue;
      }
      if (k.maskType !== "VECTOR") this.warn("Alpha and luminance masks clip by their outline in a PDF made without the drawing engine.");
      const paths = maskOutline(k, this.source);
      out.push("q", paths.length ? `${paths.map((p) => pathOps(p.commands)).join(" ")} ${paths.some((p) => p.evenOdd) ? "W*" : "W"} n` : "0 0 0 0 re W n");
      this.masked(kids.slice(i + 1), out, here);
      out.push("Q");
      return;
    }
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
        const file = this.imageFile(p);
        if (!file) return;
        // A decoder may report another size than the header (an orientation it honours): place the image as decoded, as the renderer does.
        let matrix = p.matrix;
        if (file.width !== p.width || file.height !== p.height) {
          const place = imagePlacement(p.paint, file.width, file.height, box.width, box.height);
          if (!place) return;
          matrix = place.matrix;
        }
        // Clip to the shape, then place the image (every tile, for TILE) in the layer's space.
        const body = [`${shape.path} ${shape.evenOdd ? "W*" : "W"} n`, `${matrix.map(fmt).join(" ")} cm`];
        const draw = (x: number, y: number) => `q ${multiply(translation(x, y), file.unit).map(fmt).join(" ")} cm /${file.name} Do Q`;
        if (!p.tile) body.push(draw(0, 0));
        else {
          const [a, b, c, d] = matrix;
          const across = Math.ceil(box.width / Math.max(Math.hypot(a, b) * file.width, 1e-6));
          const down = Math.ceil(box.height / Math.max(Math.hypot(c, d) * file.height, 1e-6));
          if (across * down > MAX_TILES - this.tiles) {
            this.warn(`Images tile more than ${MAX_TILES.toLocaleString("en-US")} times on one page, so only the first ${MAX_TILES.toLocaleString("en-US")} tiles were written.`);
          }
          for (let j = 0; j < down && this.tiles < MAX_TILES; j++) {
            for (let i = 0; i < across && this.tiles < MAX_TILES; i++, this.tiles++) body.push(draw(i * file.width, j * file.height));
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

  /**
   * The image XObject for an image paint, once per image, with its shown
   * size and `unit`: the image's unit square to its shown pixels (turned by
   * its Exif orientation). Null (reported) when it can't be embedded.
   *
   * 8-bit greyscale and RGB JPEGs (baseline or progressive) are embedded as
   * they are (DCTDecode): smaller and faster than decoding them. Other
   * images are decoded by the drawing engine, within a pixel cap; without
   * it, other JPEGs are still embedded as they are.
   */
  private imageFile(p: Extract<ResolvedPaint, { kind: "image" }>): ImageFile | null {
    if (this.imageNames.has(p.hash)) return this.imageNames.get(p.hash) ?? null;
    const { info } = p;
    const j = info.jpeg;
    const passThrough = (any: boolean): ImageFile | null => {
      if (!j || !(any || (j.precision === 8 && (j.components === 1 || j.components === 3) && (j.sof === 0xc0 || j.sof === 0xc1 || j.sof === 0xc2)))) return null;
      const name = this.jpegXObject(info, p.bytes);
      if (!name) return null;
      const unit = multiply(orientationMatrix(info.orientation, info.rawWidth, info.rawHeight), [info.rawWidth, 0, 0, -info.rawHeight, 0, info.rawHeight]);
      return { name, width: info.width, height: info.height, unit };
    };
    let file = passThrough(false);
    let reported = false;
    if (!file && this.options.decodeImage) {
      if (info.rawWidth > MAX_DECODE_SIDE || info.rawHeight > MAX_DECODE_SIDE || info.rawWidth * info.rawHeight > MAX_DECODE_PIXELS) {
        this.warn(`Images larger than ${MAX_DECODE_SIDE.toLocaleString("en-US")} px on a side or ${MAX_DECODE_PIXELS / 1e6} million pixels can't go into a PDF yet, so some were left out.`);
        reported = true;
      } else {
        const px = this.options.decodeImage(p.bytes);
        if (px) file = { name: this.imageXObject(px.width, px.height, px.rgba), width: px.width, height: px.height, unit: [px.width, 0, 0, -px.height, 0, px.height] };
      }
    } else if (!file) {
      // Without the drawing engine, any JPEG goes in as it is.
      file = passThrough(true);
      if (!file) this.warn("Images other than JPEG need the drawing engine to go into a PDF, so some were left out.");
      reported = true;
    }
    if (!file && !reported) this.warn("Some images couldn't be read, so they were left out of the PDF.");
    this.imageNames.set(p.hash, file);
    return file;
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
      this.file.setStream(mask, `/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`, zlibSync(alpha, { level: 6 }));
      smask = ` /SMask ${mask} 0 R`;
    }
    const image = this.file.reserve();
    this.file.setStream(image, `/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode${smask}`, zlibSync(rgb, { level: 6 }));
    const name = `Im${this.images++}`;
    this.xobjects.set(name, image);
    return name;
  }

  /** A JPEG embedded as it is (DCTDecode), without decoding it. */
  private jpegXObject(info: ImageInfo, bytes: Uint8Array): string | null {
    const components = info.jpeg?.components;
    if (components !== 1 && components !== 3 && components !== 4) return null;
    const space = components === 1 ? "/DeviceGray" : components === 4 ? "/DeviceCMYK /Decode [1 0 1 0 1 0 1 0]" : "/DeviceRGB";
    const image = this.file.reserve();
    // Stored as in the file; the placement turns it. Its orientation tag is cleared, so no viewer turns it twice.
    this.file.setStream(image, `/Type /XObject /Subtype /Image /Width ${info.rawWidth} /Height ${info.rawHeight} /ColorSpace ${space} /BitsPerComponent 8 /Filter /DCTDecode`, withoutOrientation(bytes, info));
    const name = `Im${this.images++}`;
    this.xobjects.set(name, image);
    return name;
  }

  /** Text as an image of what the renderer draws, over the layer's box and wherever its lines run past it. */
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
    const { x = 0, y = 0, width, height } = raster.area;
    out.push("q", `${fmt(width)} 0 0 ${fmt(-height)} ${fmt(x)} ${fmt(y + height)} cm`, `/${name} Do`, "Q");
  }
}

/** At most this many image tiles per page. */
const MAX_TILES = 10_000;

/** Pixels per unit for layers with shadows or blurs drawn into images, when the budget allows. */
const RASTER_SCALE = 2;
/** Below this many pixels per unit, a layer's effects are left out instead. */
const MIN_RASTER_SCALE = 0.25;
/** Most pixels drawn for effects in one PDF, and for one layer: blurs cost time by the pixel. */
const MAX_RASTER_PIXELS = 8_000_000;
const MAX_LAYER_PIXELS = 8_000_000;
/** Largest image (stored size) decoded for a PDF. */
const MAX_DECODE_SIDE = 16_384;
const MAX_DECODE_PIXELS = 64_000_000;

/** An embedded image: its XObject name, shown size in pixels, and its unit square to shown pixels. */
interface ImageFile {
  name: string;
  width: number;
  height: number;
  unit: Matrix;
}

/** What is left of one PDF's pixel budget for effects, and the scale its layers are drawn at. */
interface RasterBudget {
  remaining: number;
  scale: number;
}

/** Whether a layer's effects need it drawn into an image: shadows or layer blur (background blur alone is left out anyway). */
function rasterEffects(fx: ReturnType<typeof visibleEffects>): boolean {
  return fx.drops.length > 0 || fx.inners.length > 0 || fx.layerBlur > 0;
}

/**
 * The scale every layer with effects can be drawn at within the budget: the
 * area (in units) of what they draw, outermost layers only, as the writer
 * will draw them.
 */
function rasterScale(source: ExportSource, scenes: readonly ExportScene[], text?: TextBounds): number {
  let units = 0;
  const visit = (n: ReadonlyNode) => {
    if (!draws(n)) return;
    if (rasterEffects(visibleEffects(n))) {
      const area = subtreeBounds(source, n, IDENTITY, text);
      if (area) units += area.width * area.height;
      return;
    }
    for (const k of source.children(n.id)) visit(k);
  };
  for (const s of scenes) for (const r of s.roots) visit(r);
  // Too much for the least scale: the first layers get it, until the budget runs out.
  return units > 0 ? Math.max(MIN_RASTER_SCALE, Math.min(RASTER_SCALE, Math.sqrt(MAX_RASTER_PIXELS / units))) : RASTER_SCALE;
}

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
  // One pixel budget for the whole file's shadows and blurs.
  const budget: RasterBudget = { remaining: MAX_RASTER_PIXELS, scale: options.rasterNode ? rasterScale(source, scenes, options.textBounds) : RASTER_SCALE };
  for (const scene of scenes) {
    const page = file.reserve();
    const contents = file.reserve();
    const writer = new PageWriter(file, source, options, budget);
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
