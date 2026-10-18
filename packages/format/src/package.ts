/**
 * Reading and writing the `.illigma` package form.
 *
 * A package is a folder:
 *   manifest.json         file id, name, page order, format version
 *   pages/<page-id>.json  that page's nodes, sorted by id, one per line
 *   images/<hash>.<ext>   image files (binary), named by the SHA-256 of their bytes
 *
 * Output is canonical (sorted keys, fixed spacing), so writing the same
 * file twice gives identical bytes and Git diffs stay small.
 */

import { imagePath, imageProblem, isBinaryPackagePath, parseImagePath, referencedImageHashes, sha256Hex, sha256HexAsync, sniffImageFormat } from "./images.js";
import { FORMAT_NAME, FORMAT_VERSION, type IlligmaFile, type Manifest, type Node, type NodeId } from "./schema.js";
import { isSafePageId, validateFile } from "./validate.js";
import { migrate } from "./migrations.js";

/** One file's contents: text, or bytes for binary paths (`isBinaryPackagePath`: images). */
export type FileData = string | Uint8Array;

/** A package as path → contents. Paths use "/" and no leading slash. Text files are strings; images are bytes. */
export type FileTree = Map<string, FileData>;

/** Contents as text: strings as they are, bytes decoded as UTF-8 (for callers that only expect text files). */
export function fileText(data: FileData | undefined): string | undefined {
  if (data === undefined || typeof data === "string") return data;
  return new TextDecoder().decode(data);
}

/** Byte arrays already checked, with their hash, so saving the same image again doesn't hash it again. */
const verified = new WeakMap<Uint8Array, string>();

/**
 * Throws `FormatError` unless `bytes` is an image Illigma stores whose
 * SHA-256 is `hash`. Remembers arrays it has checked (don't change one after).
 */
export function checkImage(hash: string, bytes: Uint8Array): void {
  if (verified.get(bytes) === hash) return;
  const problem = imageProblem(bytes);
  if (problem) throw new FormatError(`Image ${hash.slice(0, 12)}… ${problem}.`);
  if (sha256Hex(bytes) !== hash) throw new FormatError(`Image ${hash.slice(0, 12)}… doesn't match its hash.`);
  verified.set(bytes, hash);
}

/** The `imageHash` for an image file's bytes, after checking it is one Illigma can store. Throws `FormatError` if not. */
export function hashImage(bytes: Uint8Array): string {
  const problem = imageProblem(bytes);
  if (problem) throw new FormatError(`This image can't be used: it ${problem}.`);
  const known = verified.get(bytes);
  if (known) return known;
  const hash = sha256Hex(bytes);
  verified.set(bytes, hash);
  return hash;
}

export class FormatError extends Error {
  constructor(
    message: string,
    readonly problems: string[] = [],
  ) {
    super(problems.length ? `${message}\n- ${problems.join("\n- ")}` : message);
    this.name = "FormatError";
  }
}

/** JSON with object keys sorted at every depth. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value).sort()) {
      const v = (value as Record<string, unknown>)[k];
      if (v !== undefined) out[k] = sortKeys(v);
    }
    return out;
  }
  return value;
}

/** The page that contains `node` (a page contains itself). */
function pageOf(node: Node, byId: Map<NodeId, Node>): NodeId | null {
  let cur: Node | undefined = node;
  const seen = new Set<NodeId>();
  while (cur && cur.parentId !== null) {
    if (seen.has(cur.id)) return null;
    seen.add(cur.id);
    cur = byId.get(cur.parentId);
  }
  return cur && cur.type === "PAGE" ? cur.id : null;
}

/** Write a file to its package form. Throws `FormatError` if the file is invalid. */
export function writePackage(file: IlligmaFile): FileTree {
  const problems = validateFile(file);
  if (problems.length) throw new FormatError("Can't save: the file is not valid.", problems);

  const byId = new Map(file.nodes.map((n) => [n.id, n]));
  const perPage = new Map<NodeId, Node[]>(file.manifest.pages.map((p) => [p.id, []]));
  for (const node of file.nodes) {
    const page = pageOf(node, byId);
    if (page === null) continue; // validateFile already rejects orphans
    perPage.get(page)?.push(node);
  }

  const tree: FileTree = new Map();
  const manifest: Manifest = { ...file.manifest, format: FORMAT_NAME, version: FORMAT_VERSION };
  tree.set("manifest.json", JSON.stringify(sortKeys(manifest), null, 2) + "\n");
  for (const [pageId, nodes] of perPage) {
    nodes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const lines = nodes.map((n) => canonicalJson(n));
    tree.set(`pages/${pageId}.json`, lines.length ? `[\n${lines.join(",\n")}\n]\n` : "[]\n");
  }
  // Every image the file holds, used or not: an edit that undo may bring back, or that the recovery journal holds, may
  // use one again (see docs/design/save-states.md, "Images"). Images some paint uses come first, in first-use order.
  // A paint whose image isn't in memory keeps its hash (a missing image, reported on reading).
  if (file.images?.size) {
    const used = referencedImageHashes(file.nodes);
    const rest = [...file.images.keys()].filter((h) => !used.includes(h)).sort();
    for (const hash of [...used, ...rest]) {
      const bytes = file.images.get(hash);
      if (!bytes) continue;
      checkImage(hash, bytes);
      tree.set(imagePath(hash, sniffImageFormat(bytes) ?? "png"), bytes);
    }
  }
  return tree;
}

/** Read a package. Older format versions are upgraded; newer ones are refused. */
export function readPackage(tree: FileTree): IlligmaFile {
  return readPackageWithReport(tree).file;
}

/** What `readPackageWithReport` found besides the file. */
export interface ReadReport {
  file: IlligmaFile;
  /** Things that didn't stop the file opening but may mean lost work, e.g. page files the manifest doesn't list. */
  warnings: string[];
  /**
   * Image files no layer uses that are sound images, named by Illigma for
   * their own bytes: the only image files a host may remove (see
   * docs/design/save-states.md, "Images"). Damaged, oversized, unknown and
   * used files are never listed.
   */
  unusedImages: string[];
}

export interface ReadPackageOptions {
  /** SHA-256 of image files by path, already computed (`readPackageWithReportAsync` hashes them natively first). */
  hashes?: ReadonlyMap<string, string>;
  /**
   * Images no layer uses: "skip" (default) leaves them out of the file;
   * "load" keeps the sound ones in `file.images`, e.g. when recovered edits
   * may use them again.
   */
  unusedImages?: "skip" | "load";
}

/**
 * `readPackageWithReport`, with every image hashed by the platform's native
 * SHA-256 first (`crypto.subtle`), so opening a file with large images
 * doesn't hash them in JavaScript on the main thread.
 */
export async function readPackageWithReportAsync(tree: FileTree, opts: Omit<ReadPackageOptions, "hashes"> = {}): Promise<ReadReport> {
  const hashes = new Map<string, string>();
  for (const [path, data] of tree) {
    if (data instanceof Uint8Array && parseImagePath(path) && !imageProblem(data)) hashes.set(path, await sha256HexAsync(data));
  }
  return readPackageWithReport(tree, { ...opts, hashes });
}

/** `readPackage`, plus warnings about content the file ignores. */
export function readPackageWithReport(tree: FileTree, opts: ReadPackageOptions = {}): ReadReport {
  const manifestText = fileText(tree.get("manifest.json"));
  if (manifestText === undefined) throw new FormatError("This is not an Illigma file: manifest.json is missing.");

  let rawManifest: unknown;
  try {
    rawManifest = JSON.parse(manifestText);
  } catch {
    throw new FormatError("manifest.json is not valid JSON.");
  }
  if (!rawManifest || typeof rawManifest !== "object" || (rawManifest as { format?: unknown }).format !== FORMAT_NAME) {
    throw new FormatError("This is not an Illigma file: manifest.json has no \"format\": \"illigma\".");
  }
  const version = (rawManifest as { version?: unknown }).version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 0) {
    throw new FormatError("manifest.json has no valid format version.");
  }
  if (version > FORMAT_VERSION) {
    throw new FormatError(
      `This file was saved by a newer Illigma (format ${version}). This version reads format ${FORMAT_VERSION} and older. Update Illigma to open it.`,
    );
  }

  const pages = (rawManifest as { pages?: unknown }).pages;
  if (!Array.isArray(pages)) throw new FormatError("manifest.json has no page list.");
  const rawNodes: unknown[] = [];
  for (const entry of pages) {
    const id = (entry as { id?: unknown })?.id;
    if (typeof id !== "string") throw new FormatError("manifest.json lists a page without an id.");
    // Checked before the id is used as a path.
    if (!isSafePageId(id)) throw new FormatError(`manifest.json lists a page id that can't be a file name: ${JSON.stringify(id.slice(0, 80))}.`);
    const text = fileText(tree.get(`pages/${id}.json`));
    if (text === undefined) throw new FormatError(`Page file pages/${id}.json is missing.`);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new FormatError(`pages/${id}.json is not valid JSON.`);
    }
    if (!Array.isArray(parsed)) throw new FormatError(`pages/${id}.json must hold a list of nodes.`);
    rawNodes.push(...parsed);
  }

  const file = migrate({ manifest: rawManifest, nodes: rawNodes }, version) as IlligmaFile;
  const problems = validateFile(file);
  if (problems.length) throw new FormatError("The file is damaged and can't be opened safely.", problems);

  const listed = new Set(pages.map((p) => `pages/${(p as { id: string }).id}.json`));
  const warnings: string[] = [];
  for (const path of [...tree.keys()].sort()) {
    if (path.startsWith("pages/") && !listed.has(path)) warnings.push(`${path} is not listed in manifest.json, so it was not opened.`);
  }
  const unusedImages: string[] = [];
  const images = readImages(tree, file, warnings, unusedImages, opts);
  if (images.size) file.images = images;
  return { file, warnings, unusedImages };
}

/** At most this many warnings about images, then one summary line. */
const MAX_IMAGE_WARNINGS = 20;

/**
 * The package's images that some paint uses (and, with `unusedImages:
 * "load"`, the sound ones no paint uses). A damaged, unknown or oversized
 * image is left out with a warning (its layers show a missing image, and the
 * rest of the file still opens), as are images no paint uses. Sound images
 * no paint uses are listed in `unused`.
 */
function readImages(tree: FileTree, file: IlligmaFile, warnings: string[], unused: string[], opts: ReadPackageOptions): Map<string, Uint8Array> {
  const used = new Set(referencedImageHashes(file.nodes));
  const images = new Map<string, Uint8Array>();
  const spare = new Map<string, Uint8Array>();
  const notes: string[] = [];
  /** Why the image file at `path` can't be opened as image `hash`, or null if it can. */
  const problemWith = (path: string, hash: string, data: unknown): string | null => {
    const problem = data instanceof Uint8Array ? imageProblem(data) : "was read as text, not bytes";
    if (problem || !(data instanceof Uint8Array)) return problem;
    if ((opts.hashes?.get(path) ?? sha256Hex(data)) !== hash) return "is damaged (its contents don't match its name)";
    verified.set(data, hash);
    return null;
  };
  for (const path of [...tree.keys()].sort()) {
    if (!isBinaryPackagePath(path)) continue;
    const parsed = parseImagePath(path);
    if (!parsed) {
      notes.push(`${path} is not an image file Illigma stores, so it was ignored.`);
      continue;
    }
    const data = tree.get(path);
    if (!used.has(parsed.hash)) {
      // Only a sound image, under its own name, may ever be removed; anything else stays as it is.
      const ok = !spare.has(parsed.hash) && problemWith(path, parsed.hash, data) === null;
      if (ok) {
        unused.push(path);
        spare.set(parsed.hash, data as Uint8Array);
      }
      if (!ok || opts.unusedImages !== "load") notes.push(`${path} is not used by any layer, so it was ignored.`);
      continue;
    }
    if (images.has(parsed.hash)) continue; // the same image under two extensions
    const problem = problemWith(path, parsed.hash, data);
    if (problem) {
      notes.push(`${path} ${problem}, so it was not opened.`);
      continue;
    }
    images.set(parsed.hash, data as Uint8Array);
  }
  // In first-use order, as writePackage writes them.
  const ordered = new Map<string, Uint8Array>();
  for (const hash of used) {
    const bytes = images.get(hash);
    if (bytes) ordered.set(hash, bytes);
    else notes.push(`Image ${hash.slice(0, 12)}… is missing, so the layers that use it show no image.`);
  }
  if (opts.unusedImages === "load") for (const [hash, bytes] of [...spare].sort(([a], [b]) => (a < b ? -1 : 1))) ordered.set(hash, bytes);
  warnings.push(...notes.slice(0, MAX_IMAGE_WARNINGS));
  if (notes.length > MAX_IMAGE_WARNINGS) warnings.push(`…and ${notes.length - MAX_IMAGE_WARNINGS} more problems with images.`);
  return ordered;
}
