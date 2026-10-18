/**
 * PDF export: a minimal PDF 1.7 writer for vector output, one page per
 * exported layer (1 px = 1 pt, as in Figma). CanvasKit's default build has no
 * PDF backend, so this writes the file itself, with no dependency beyond
 * fflate (already used by the file format) for image data.
 *
 * - Shapes are vector paths: rectangles, rounded rectangles, ellipses,
 *   vectors, stars, polygons and lines, filled with their winding rule and
 *   stroked with their weight, caps and joins (strokes centred, as drawn).
 * - Solid paints with their alpha; layer opacity applies to a layer and its
 *   children as one transparency group, as on the canvas.
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
import { draws, hasVisibleStroke, IDENTITY, localMatrix, subtreeBounds, type ExportScene, type ExportSource, type Matrix } from "./scene.js";
import { ellipseCommands, fmt, outlineOf, rectCommands, resolvePaint, type ResolvedPaint } from "./vector-common.js";

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

  private warn(message: string): void {
    this.options.warn?.(message);
  }

  finish(): void {
    const gs = [...this.states].map(([key, name]) => `/${name} << /Type /ExtGState ${key} >>`).join(" ");
    const xo = [...this.xobjects].map(([name, num]) => `/${name} ${num} 0 R`).join(" ");
    this.file.set(this.resources, `<< /ExtGState << ${gs} >> /XObject << ${xo} >> >>`);
  }

  /** An ExtGState for fill (`ca`) and stroke (`CA`) alpha. */
  private state(fill: number | null, stroke: number | null): string {
    const key = [fill !== null ? `/ca ${fmt(fill)}` : "", stroke !== null ? `/CA ${fmt(stroke)}` : ""].filter(Boolean).join(" ");
    let name = this.states.get(key);
    if (!name) {
      name = `G${this.states.size}`;
      this.states.set(key, name);
    }
    return name;
  }

  /** Write `n` (with transform `m` from the current space) into `out`. */
  node(n: ReadonlyNode, m: Matrix, out: string[]): void {
    if (!draws(n)) return;
    out.push("q");
    if (!isIdentity(m)) out.push(`${m.map(fmt).join(" ")} cm`);
    // Rasterized text carries its own opacity.
    const raster = n.type === "TEXT" && !!this.options.rasterText;
    if (n.opacity < 1 && !raster) {
      const bounds = subtreeBounds(this.source, n, IDENTITY);
      if (bounds) {
        const body: string[] = [];
        this.content(n, body);
        const num = this.file.reserve();
        const name = `Fm${this.forms++}`;
        this.xobjects.set(name, num);
        const bbox = [bounds.x - 1, bounds.y - 1, bounds.x + bounds.width + 1, bounds.y + bounds.height + 1].map(fmt).join(" ");
        this.file.setStream(num, `/Type /XObject /Subtype /Form /BBox [${bbox}] /Group << /S /Transparency >> /Resources ${this.resources} 0 R`, body.join("\n"));
        out.push(`/${this.state(n.opacity, n.opacity)} gs`, `/${name} Do`);
      }
    } else {
      this.content(n, out);
    }
    out.push("Q");
  }

  /** A layer's own paints, then its (clipped) children, in its own space. */
  private content(n: ReadonlyNode, out: string[]): void {
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
      for (const p of n.fills) {
        const paint = resolvePaint(p, (m) => this.warn(m));
        if (!paint) continue;
        for (const f of fills) this.paint(paint, "fill", `${pathOps(f.commands)}\n${f.evenOdd ? "f*" : "f"}`, out);
      }
      if (hasVisibleStroke(n) && stroke.length) {
        const style = `${fmt(n.strokeWeight)} w ${n.strokeCap === "ROUND" ? 1 : n.strokeCap === "SQUARE" ? 2 : 0} J ${n.strokeJoin === "ROUND" ? 1 : n.strokeJoin === "BEVEL" ? 2 : 0} j 4 M`;
        const path = pathOps(stroke);
        for (const p of n.strokes) {
          const paint = resolvePaint(p, (m) => this.warn(m));
          if (paint) this.paint(paint, "stroke", `${style}\n${path}\nS`, out);
        }
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
    for (const k of kids) this.node(k, localMatrix(k), out);
    if (clip) out.push("Q");
  }

  /** One fill or stroke. New paint kinds (gradients as shadings) add a case here. */
  private paint(p: ResolvedPaint, role: "fill" | "stroke", draw: string, out: string[]): void {
    switch (p.kind) {
      case "solid": {
        const { r, g, b } = p.color;
        const color = `${fmt(r)} ${fmt(g)} ${fmt(b)} ${role === "fill" ? "rg" : "RG"}`;
        if (p.opacity < 1) out.push("q", `/${this.state(role === "fill" ? p.opacity : null, role === "stroke" ? p.opacity : null)} gs`, color, draw, "Q");
        else out.push(color, draw);
        return;
      }
    }
  }

  /** Text as an image of what the renderer draws, over the layer's box. */
  private text(n: ReadonlyNode, out: string[]): void {
    if (!n.characters || !n.fills[0]?.visible) return;
    const raster = this.options.rasterText?.(n) ?? null;
    if (!raster) {
      if (!this.warnedText) this.warn("Text was left out of the PDF: drawing text needs the drawing engine and fonts.");
      this.warnedText = true;
      return;
    }
    if (!this.warnedText) this.warn("Text in the PDF is an image of the text, so it can't be selected or searched yet.");
    this.warnedText = true;
    const { width, height, rgba, area } = raster;
    const rgb = new Uint8Array(width * height * 3);
    const alpha = new Uint8Array(width * height);
    for (let i = 0, j = 0, k = 0; i < rgba.length; i += 4, j += 3, k++) {
      rgb[j] = rgba[i] as number;
      rgb[j + 1] = rgba[i + 1] as number;
      rgb[j + 2] = rgba[i + 2] as number;
      alpha[k] = rgba[i + 3] as number;
    }
    const mask = this.file.reserve();
    this.file.setStream(mask, `/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`, zlibSync(alpha, { level: 9 }));
    const image = this.file.reserve();
    this.file.setStream(image, `/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /SMask ${mask} 0 R`, zlibSync(rgb, { level: 9 }));
    const name = `Im${this.images++}`;
    this.xobjects.set(name, image);
    // The image's unit square, flipped so its first row is at the top of the box.
    out.push("q", `${fmt(area.width)} 0 0 ${fmt(-area.height)} 0 ${fmt(area.height)} cm`, `/${name} Do`, "Q");
  }
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
    for (const root of scene.roots) writer.node(root, localMatrix(root), ops);
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
