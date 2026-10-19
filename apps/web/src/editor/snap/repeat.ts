/**
 * ⌘D after "duplicate then move" repeats the offset (interactions.md §2):
 * duplicate, drag the copy 100 px right, ⌘D, and the next copy lands another
 * 100 px right. ⌥-drag counts as a duplicate too.
 */
import type { Document, Transaction } from "@illigma/core";
import type { NodeId } from "@illigma/format";
import { worldBounds, type Point } from "../geometry";
import { moveBy, snapshot } from "../edit";

interface Last {
  sources: NodeId[];
  copies: NodeId[];
}

const last = new WeakMap<Document, Last>();

/** Remember that `copies` were just made from `sources`. */
export function rememberDuplicate(doc: Document, sources: readonly NodeId[], copies: readonly NodeId[]): void {
  if (sources.length && sources.length === copies.length) last.set(doc, { sources: [...sources], copies: [...copies] });
  else last.delete(doc);
}

/**
 * The offset to repeat when the selection is the last duplicate's copies and
 * they were moved away from their sources since: copy minus source, on the
 * page. Null otherwise (a plain ⌘D).
 */
export function repeatOffset(doc: Document, selection: readonly NodeId[]): Point | null {
  const l = last.get(doc);
  if (!l || selection.length !== l.copies.length || !selection.every((id) => l.copies.includes(id))) return null;
  const a = worldBounds(doc, l.sources[0] as NodeId);
  const b = worldBounds(doc, l.copies[0] as NodeId);
  if (!a || !b) return null;
  const off = { x: b.x - a.x, y: b.y - a.y };
  return off.x || off.y ? off : null;
}

/** Put each copy at its source's place plus `off` (the page offset), as the repeated step. */
export function placeCopies(tx: Transaction, doc: Document, sources: readonly NodeId[], copies: readonly NodeId[], off: Point): void {
  copies.forEach((id, i) => {
    const src = sources[i];
    const a = src ? worldBounds(doc, src) : null;
    const b = worldBounds(doc, id);
    const [s] = snapshot(doc, [id]);
    if (a && b && s) moveBy(tx, [s], a.x + off.x - b.x, a.y + off.y - b.y);
  });
}
