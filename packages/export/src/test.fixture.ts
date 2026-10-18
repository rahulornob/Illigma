// Test helpers for export (Node only): documents, CanvasKit, fonts and an XML well-formedness check.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import CanvasKitInit, { type CanvasKit } from "canvaskit-wasm";
import { Document } from "@illigma/core";
import type { Color, Node, NodeId, NodeType } from "@illigma/format";
import type { FontSource } from "@illigma/renderer";

export type Fields = Partial<Omit<Node, "id" | "type" | "parentId" | "index">>;

export const RED: Color = { r: 1, g: 0, b: 0, a: 1 };
export const BLUE: Color = { r: 0, g: 0, b: 1, a: 1 };
export const solid = (color: Color, visible = true) => [{ type: "SOLID" as const, visible, color }];

export type Add = (type: NodeType, parent: NodeId, fields?: Fields) => NodeId;

/** A one-page document. Returns it with the page id and every id `build` returned under its key. */
export function build<T extends Record<string, NodeId>>(fn: (add: Add, page: NodeId) => T, name = "Export"): { doc: Document; page: NodeId; ids: T } {
  const doc = new Document(name);
  let page = "";
  let ids = {} as T;
  doc.transact("Build", (tx) => {
    page = tx.addPage("Page");
    ids = fn((type, parent, fields = {}) => tx.create(type, parent, fields), page);
  });
  return { doc, page, ids };
}

let ck: Promise<CanvasKit> | null = null;
export function canvasKit(): Promise<CanvasKit> {
  ck ??= CanvasKitInit();
  return ck;
}

const require = createRequire(import.meta.url);
/** Inter Regular and Bold from @fontsource/inter (a dev dependency of the web app). */
export function interFonts(): FontSource[] {
  const load = (file: string) => {
    const buf = readFileSync(require.resolve(`@fontsource/inter/files/${file}`));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  };
  return [{ family: "Inter", data: load("inter-latin-400-normal.woff2") }, { family: "Inter", data: load("inter-latin-700-normal.woff2") }];
}

/** Decode a PNG or JPG with CanvasKit; returns its size and an RGBA reader. */
export function decode(kit: CanvasKit, bytes: Uint8Array) {
  const image = kit.MakeImageFromEncoded(bytes);
  if (!image) throw new Error("not an image");
  const width = image.width();
  const height = image.height();
  const px = image.readPixels(0, 0, { width, height, colorType: kit.ColorType.RGBA_8888, alphaType: kit.AlphaType.Unpremul, colorSpace: kit.ColorSpace.SRGB }) as Uint8Array;
  image.delete();
  const at = (x: number, y: number): [number, number, number, number] => {
    const i = (y * width + x) * 4;
    return [px[i] as number, px[i + 1] as number, px[i + 2] as number, px[i + 3] as number];
  };
  return { width, height, at };
}

/**
 * Throws unless `xml` is well-formed: one root element, balanced and
 * properly nested tags, quoted and unique attributes, known entities, and
 * no characters XML forbids. Enough to catch writer bugs without a parser dependency.
 */
export function assertWellFormedXml(xml: string): void {
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(xml)) throw new Error("forbidden control character");
  const stack: string[] = [];
  let roots = 0;
  let i = 0;
  const NAME = /^[A-Za-z_:][\w.:-]*/;
  const checkText = (t: string) => {
    if (t.includes("<")) throw new Error(`stray "<" in text: ${t}`);
    for (const m of t.matchAll(/&([^;]*);?/g)) {
      if (!/^(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+)$/.test(m[1] ?? "") || !m[0].endsWith(";")) throw new Error(`bad entity ${m[0]}`);
    }
  };
  while (i < xml.length) {
    const lt = xml.indexOf("<", i);
    const text = lt < 0 ? xml.slice(i) : xml.slice(i, lt);
    checkText(text);
    if (stack.length === 0 && text.trim()) throw new Error(`text outside the root: ${text.trim()}`);
    if (lt < 0) break;
    const gt = xml.indexOf(">", lt);
    if (gt < 0) throw new Error("unclosed tag");
    const tag = xml.slice(lt + 1, gt);
    i = gt + 1;
    if (tag.startsWith("?") || tag.startsWith("!--")) continue;
    if (tag.startsWith("/")) {
      const name = tag.slice(1).trim();
      if (stack.pop() !== name) throw new Error(`mismatched </${name}>`);
      continue;
    }
    const selfClosing = tag.endsWith("/");
    const body = selfClosing ? tag.slice(0, -1) : tag;
    const name = NAME.exec(body)?.[0];
    if (!name) throw new Error(`bad tag <${tag}>`);
    let rest = body.slice(name.length);
    const seen = new Set<string>();
    while (rest.trim()) {
      const m = /^\s+([A-Za-z_:][\w.:-]*)="([^"<]*)"/.exec(rest);
      if (!m) throw new Error(`bad attributes in <${tag}>`);
      if (seen.has(m[1] as string)) throw new Error(`duplicate attribute ${m[1]}`);
      seen.add(m[1] as string);
      checkText(m[2] as string);
      rest = rest.slice(m[0].length);
    }
    if (stack.length === 0) roots++;
    if (!selfClosing) stack.push(name);
  }
  if (stack.length) throw new Error(`unclosed <${stack.join("> <")}>`);
  if (roots !== 1) throw new Error(`expected one root element, found ${roots}`);
}

/** The PDF's objects by number, checking every cross-reference offset on the way. */
export function parsePdf(bytes: Uint8Array): { text: string; objects: Map<number, string>; pages: number } {
  let text = "";
  for (const b of bytes) text += String.fromCharCode(b);
  if (!text.startsWith("%PDF-1.7\n")) throw new Error("no PDF header");
  if (!text.endsWith("%%EOF\n")) throw new Error("no %%EOF");
  const startxref = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(text)?.[1]);
  if (!text.startsWith("xref\n", startxref)) throw new Error("startxref doesn't point at the xref table");
  const xref = text.slice(startxref).split("\n");
  const count = Number(xref[1]?.split(" ")[1]);
  const objects = new Map<number, string>();
  for (let n = 1; n < count; n++) {
    const offset = Number(xref[2 + n]?.slice(0, 10));
    if (!text.startsWith(`${n} 0 obj\n`, offset)) throw new Error(`xref offset of object ${n} is wrong`);
    const end = text.indexOf("\nendobj\n", offset);
    objects.set(n, text.slice(offset + `${n} 0 obj\n`.length, end));
  }
  // Every stream's /Length matches its data.
  for (const [n, body] of objects) {
    const m = /\/Length (\d+) >>\nstream\n/.exec(body);
    if (!m) continue;
    const start = (m.index ?? 0) + m[0].length;
    if (body.slice(start + Number(m[1])) !== "\nendstream") throw new Error(`object ${n}'s stream length is wrong`);
  }
  const pages = Number(/\/Type \/Pages \/Kids \[[^\]]*\] \/Count (\d+)/.exec(text)?.[1]);
  return { text, objects, pages };
}

/** The data of stream object `n`. */
export function streamOf(objects: Map<number, string>, n: number): string {
  const body = objects.get(n) ?? "";
  const m = /\/Length (\d+) >>\nstream\n/.exec(body);
  if (!m) throw new Error(`object ${n} isn't a stream`);
  const start = (m.index ?? 0) + m[0].length;
  return body.slice(start, start + Number(m[1]));
}

/** SVG text with the export's own id prefix (a fingerprint of the file) taken out, for golden comparisons. */
export function withoutIdPrefix(svg: string): string {
  return svg.replace(/(id="|#)i[0-9a-z]+_/g, "$1");
}

type M6 = [number, number, number, number, number, number];
/** Every `/Name Do` in a content stream, with the transform it is drawn under (`q`, `Q` and `cm` followed; forms aren't entered). */
export function pdfDraws(content: string): { name: string; ctm: M6 }[] {
  const out: { name: string; ctm: M6 }[] = [];
  const stack: M6[] = [];
  let ctm: M6 = [1, 0, 0, 1, 0, 0];
  let nums: number[] = [];
  let name = "";
  for (const tok of content.split(/\s+/)) {
    if (/^-?[\d.]+$/.test(tok)) {
      nums.push(Number(tok));
      continue;
    }
    if (tok === "q") stack.push(ctm);
    else if (tok === "Q") ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (tok === "cm") {
      const [a, b, c, d, e, f] = nums.slice(-6) as M6;
      const m = ctm;
      // The new matrix applies first: x' = m(n(x)).
      ctm = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]];
    } else if (tok === "Do") out.push({ name, ctm });
    else if (tok.startsWith("/")) name = tok.slice(1);
    nums = [];
  }
  return out;
}

/** Where a point (x, y) goes under a 2D affine matrix. */
export function applyM(m: readonly number[], x: number, y: number): [number, number] {
  return [(m[0] as number) * x + (m[2] as number) * y + (m[4] as number), (m[1] as number) * x + (m[3] as number) * y + (m[5] as number)];
}
