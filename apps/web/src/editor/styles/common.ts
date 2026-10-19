import { splitName, type Document, type Transaction } from "@illigma/core";
import type { Color, VariableValue } from "@illigma/format";
import { toHex } from "../paint/color";

/** Run `fn` as one undo step; a refused edit goes to `onError` (never during a canvas drag). */
export function edit(doc: Document, label: string, fn: (tx: Transaction) => void, onError: (e: unknown) => void): boolean {
  if (doc.live) return false;
  try {
    doc.transact(label, fn);
    return true;
  } catch (e) {
    onError(e);
    return false;
  }
}

/** Group items by the folders in their "/" names, keeping list order: [{ folder: "Brand", items }]. */
export function byFolder<T extends { name: string }>(items: readonly T[]): { folder: string; items: T[] }[] {
  const out: { folder: string; items: T[] }[] = [];
  for (const it of items) {
    const folder = splitName(it.name).folders.join(" / ");
    let g = out.find((g) => g.folder === folder);
    if (!g) out.push((g = { folder, items: [] }));
    g.items.push(it);
  }
  return out;
}

export const leafName = (name: string) => splitName(name).leaf;

/** Fires the window event the editor listens to, so any panel can open the Variables manager. */
export const OPEN_VARIABLES_EVENT = "illigma:open-variables";
export function openVariables(): void {
  window.dispatchEvent(new Event(OPEN_VARIABLES_EVENT));
}

const isColor = (v: unknown): v is Color => typeof v === "object" && v !== null && "r" in v;

/** A variable value as the table and pickers show it. */
export function showValue(v: VariableValue | undefined, nameOf: (id: string) => string | undefined): string {
  if (v === undefined) return "";
  if (typeof v === "object" && "type" in v) return `{${nameOf(v.id) ?? "missing"}}`;
  if (isColor(v)) return `#${toHex(v)}`;
  return String(v);
}

export function cssOf(c: Color): string {
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${c.a})`;
}
