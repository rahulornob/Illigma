/**
 * Reading and writing the `.illigma` package form.
 *
 * A package is a folder:
 *   manifest.json         file id, name, page order, format version
 *   pages/<page-id>.json  that page's nodes, sorted by id, one per line
 *
 * Output is canonical (sorted keys, fixed spacing), so writing the same
 * file twice gives identical bytes and Git diffs stay small.
 */

import { FORMAT_NAME, FORMAT_VERSION, type IlligmaFile, type Manifest, type Node, type NodeId } from "./schema.js";
import { isSafePageId, validateFile } from "./validate.js";
import { migrate } from "./migrations.js";

/** A package as path → text. Paths use "/" and no leading slash. */
export type FileTree = Map<string, string>;

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
}

/** `readPackage`, plus warnings about content the file ignores. */
export function readPackageWithReport(tree: FileTree): ReadReport {
  const manifestText = tree.get("manifest.json");
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
    const text = tree.get(`pages/${id}.json`);
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
  return { file, warnings };
}
