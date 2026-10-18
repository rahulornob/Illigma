/**
 * Structural validation for a whole file. Returns plain-language problems;
 * an empty list means the file is valid.
 */

import { isValidKey } from "./fractional-index.js";
import { FORMAT_NAME, NODE_TYPES, type IlligmaFile, type Node, type NodeType } from "./schema.js";

const NUMBER_FIELDS = ["x", "y", "width", "height", "rotation", "opacity", "strokeWeight", "cornerRadius"] as const;
const BOOLEAN_FIELDS = ["visible", "locked"] as const;
const MAX_PROBLEMS = 50;

function isColor(c: unknown): boolean {
  if (!c || typeof c !== "object") return false;
  const o = c as Record<string, unknown>;
  return ["r", "g", "b", "a"].every((k) => typeof o[k] === "number" && (o[k] as number) >= 0 && (o[k] as number) <= 1);
}

function isPaintList(v: unknown): boolean {
  return (
    Array.isArray(v) &&
    v.every((p) => p && typeof p === "object" && p.type === "SOLID" && typeof p.visible === "boolean" && isColor(p.color))
  );
}

function checkNode(n: unknown, at: string, problems: string[]): n is Node {
  if (!n || typeof n !== "object") {
    problems.push(`${at} is not an object.`);
    return false;
  }
  const o = n as Record<string, unknown>;
  const id = typeof o.id === "string" && o.id.length > 0 ? o.id : null;
  const where = id ? `Node ${id}` : at;
  if (!id) problems.push(`${at} has no id.`);
  if (!NODE_TYPES.includes(o.type as NodeType)) problems.push(`${where} has an unknown type "${String(o.type)}".`);
  if (!(o.parentId === null || typeof o.parentId === "string")) problems.push(`${where} has an invalid parentId.`);
  if (typeof o.index !== "string" || !isValidKey(o.index)) problems.push(`${where} has an invalid order index.`);
  if (typeof o.name !== "string") problems.push(`${where} has no name.`);
  for (const k of NUMBER_FIELDS) {
    if (typeof o[k] !== "number" || !Number.isFinite(o[k] as number)) problems.push(`${where}: "${k}" must be a number.`);
  }
  for (const k of BOOLEAN_FIELDS) {
    if (typeof o[k] !== "boolean") problems.push(`${where}: "${k}" must be true or false.`);
  }
  if (!isPaintList(o.fills)) problems.push(`${where}: "fills" must be a list of solid paints.`);
  if (!isPaintList(o.strokes)) problems.push(`${where}: "strokes" must be a list of solid paints.`);
  if (o.characters !== undefined && typeof o.characters !== "string") problems.push(`${where}: "characters" must be text.`);
  return id !== null;
}

export function validateFile(file: IlligmaFile): string[] {
  const problems: string[] = [];
  const m = file.manifest as unknown as Record<string, unknown>;
  if (!m || m.format !== FORMAT_NAME) problems.push('The manifest must have "format": "illigma".');
  if (typeof m?.fileId !== "string" || !m.fileId) problems.push("The manifest has no file id.");
  if (typeof m?.name !== "string") problems.push("The manifest has no file name.");
  if (!Array.isArray(m?.pages) || m.pages.length === 0) problems.push("The file must have at least one page.");
  if (!Array.isArray(file.nodes)) return [...problems, "The file has no node list."];

  const byId = new Map<string, Node>();
  file.nodes.forEach((n, i) => {
    if (checkNode(n, `Node #${i + 1}`, problems)) {
      if (byId.has(n.id)) problems.push(`Node id ${n.id} is used twice.`);
      byId.set(n.id, n);
    }
  });

  const pageIds = new Set<string>();
  for (const p of (Array.isArray(m?.pages) ? m.pages : []) as { id?: unknown }[]) {
    const id = typeof p?.id === "string" ? p.id : "";
    if (pageIds.has(id)) problems.push(`Page ${id} is listed twice.`);
    pageIds.add(id);
    const node = byId.get(id);
    if (!node || node.type !== "PAGE") problems.push(`Page ${id} is listed but has no PAGE node.`);
  }

  for (const n of byId.values()) {
    if (n.type === "PAGE") {
      if (n.parentId !== null) problems.push(`Page ${n.id} must not have a parent.`);
      if (!pageIds.has(n.id)) problems.push(`Page ${n.id} is not listed in the manifest.`);
      continue;
    }
    if (n.parentId === null) {
      problems.push(`Node ${n.id} has no parent.`);
      continue;
    }
    if (!byId.has(n.parentId)) problems.push(`Node ${n.id} points to a missing parent ${n.parentId}.`);
    // Cycle check: walk up at most byId.size steps.
    let cur: Node | undefined = n;
    let steps = 0;
    while (cur && cur.parentId !== null && steps <= byId.size) {
      cur = byId.get(cur.parentId);
      steps++;
    }
    if (steps > byId.size) problems.push(`Node ${n.id} is inside a parent loop.`);
  }

  // Sibling order keys must be unique within a parent.
  const seen = new Map<string, string>();
  for (const n of byId.values()) {
    const k = `${n.parentId ?? ""}\u0000${n.index}`;
    const other = seen.get(k);
    if (other) problems.push(`Nodes ${other} and ${n.id} share the same position.`);
    else seen.set(k, n.id);
  }

  return problems.slice(0, MAX_PROBLEMS);
}
