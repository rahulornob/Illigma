import { describe, expect, it } from "vitest";
import { Document } from "@illigma/core";
import type { NodeId } from "@illigma/format";
import { worldBounds } from "./geometry";
import { canDrop, documentOrder, duplicatePage, movePage, moveLayers, nextPageName, reorderZ, renameNode, toggleLocked, toggleVisible, ungroupLayers, wrapLayers } from "./layer-ops";
import { dropTargetAt, layerRows } from "./LayersPanel";
import { parseClip, pasteLayers, pasteTarget, plainText, serializeLayers } from "./clipboard";

function setup() {
  const doc = new Document("Ops");
  const ids = doc.transact("Build", (tx) => {
    const page = tx.addPage("Page 1");
    const frame = tx.create("FRAME", page, { name: "Card", x: 100, y: 50, width: 400, height: 300 });
    const a = tx.create("RECTANGLE", frame, { name: "A", x: 10, y: 20, width: 50, height: 40 });
    const b = tx.create("RECTANGLE", frame, { name: "B", x: 100, y: 120, width: 30, height: 30 });
    const c = tx.create("ELLIPSE", frame, { name: "C", x: 200, y: 10, width: 20, height: 20 });
    const loose = tx.create("RECTANGLE", page, { name: "Loose", x: 700, y: 0, width: 10, height: 10 });
    return { page, frame, a, b, c, loose };
  });
  return { doc, ...ids };
}

const world = (doc: Document, id: NodeId) => worldBounds(doc, id);
const names = (doc: Document, parent: NodeId) => doc.children(parent).map((n) => n.name);

describe("group, ungroup, frame selection", () => {
  it("⌘G wraps the layers in a group sized to them, keeping their places and order, in one undo step", () => {
    const { doc, frame, a, b, c } = setup();
    const before = [a, b].map((id) => world(doc, id));
    const g = doc.transact("Group", (tx) => wrapLayers(tx, doc, [b, a], "GROUP")) as NodeId;
    const group = doc.get(g)!;
    expect(group.type).toBe("GROUP");
    expect(group.parentId).toBe(frame);
    expect(group).toMatchObject({ x: 10, y: 20, width: 120, height: 130, name: "Group 1" });
    expect(names(doc, g)).toEqual(["A", "B"]);
    expect([a, b].map((id) => world(doc, id))).toEqual(before);
    // The group sits where the front-most grouped layer was: below C.
    expect(names(doc, frame)).toEqual(["Group 1", "C"]);
    expect(doc.children(frame).map((n) => n.id)).toContain(g);
    doc.undo();
    expect(doc.has(g)).toBe(false);
    expect(names(doc, frame)).toEqual(["A", "B", "C"]);
    expect(c).toBeTruthy();
  });

  it("groups layers from different parents in their nearest common parent", () => {
    const { doc, page, a, loose } = setup();
    const before = [a, loose].map((id) => world(doc, id));
    const g = doc.transact("Group", (tx) => wrapLayers(tx, doc, [a, loose], "GROUP")) as NodeId;
    expect(doc.get(g)!.parentId).toBe(page);
    expect([a, loose].map((id) => world(doc, id))).toEqual(before);
  });

  it("⇧⌘G puts the layers back in the group's place and removes it", () => {
    const { doc, frame, a, b } = setup();
    const g = doc.transact("Group", (tx) => wrapLayers(tx, doc, [a, b], "GROUP")) as NodeId;
    doc.transact("Move", (tx) => tx.set(g, "x", 30));
    const moved = world(doc, a);
    const out = doc.transact("Ungroup", (tx) => ungroupLayers(tx, doc, [g]));
    expect(out).toEqual([a, b]);
    expect(doc.has(g)).toBe(false);
    expect(names(doc, frame)).toEqual(["A", "B", "C"]);
    expect(world(doc, a)).toEqual(moved);
  });

  it("⌥⌘G frames the selection with a frame that fits it", () => {
    const { doc, a } = setup();
    const f = doc.transact("Frame", (tx) => wrapLayers(tx, doc, [a], "FRAME")) as NodeId;
    expect(doc.get(f)).toMatchObject({ type: "FRAME", x: 10, y: 20, width: 50, height: 40 });
    expect(doc.get(a)).toMatchObject({ x: 0, y: 0, parentId: f });
  });

  it("keeps a rotated layer's place when it moves into a rotated parent", () => {
    const { doc, frame, loose } = setup();
    doc.transact("Turn", (tx) => tx.set(frame, "rotation", 30));
    const before = world(doc, loose)!;
    doc.transact("Move", (tx) => moveLayers(tx, doc, [loose], { parentId: frame, position: "last" }));
    const after = world(doc, loose)!;
    expect(after.x).toBeCloseTo(before.x, 1);
    expect(after.y).toBeCloseTo(before.y, 1);
    expect(doc.get(loose)!.rotation).toBeCloseTo(-30, 5);
  });
});

describe("order and reparenting", () => {
  it("⌘] and ⌘[ step past one neighbour; ⌥⌘] and ⌥⌘[ go to the front and back", () => {
    const { doc, frame, a, c } = setup();
    doc.transact("f", (tx) => reorderZ(tx, doc, [a], "forward"));
    expect(names(doc, frame)).toEqual(["B", "A", "C"]);
    doc.transact("b", (tx) => reorderZ(tx, doc, [c], "backward"));
    expect(names(doc, frame)).toEqual(["B", "C", "A"]);
    doc.transact("back", (tx) => reorderZ(tx, doc, [a], "back"));
    expect(names(doc, frame)).toEqual(["A", "B", "C"]);
    doc.transact("front", (tx) => reorderZ(tx, doc, [a], "front"));
    expect(names(doc, frame)).toEqual(["B", "C", "A"]);
    expect(doc.transact("noop", (tx) => reorderZ(tx, doc, [a], "front"))).toBe(false);
  });

  it("drops never go into the dragged layers themselves or into shapes", () => {
    const { doc, page, frame, a, b } = setup();
    expect(canDrop(doc, [frame], { parentId: a, position: "last" })).toBe(false);
    expect(canDrop(doc, [frame], { parentId: frame, position: "last" })).toBe(false);
    expect(canDrop(doc, [a], { parentId: page, position: { before: a } })).toBe(false);
    expect(canDrop(doc, [a], { parentId: frame, position: { after: b } })).toBe(true);
  });

  it("moves several layers out of a frame, in order, keeping their places", () => {
    const { doc, page, frame, a, b, loose } = setup();
    const before = [a, b].map((id) => world(doc, id));
    doc.transact("Move", (tx) => moveLayers(tx, doc, [b, a], { parentId: page, position: { after: loose } }));
    expect(names(doc, page)).toEqual(["Card", "Loose", "A", "B"]);
    expect(names(doc, frame)).toEqual(["C"]);
    expect([a, b].map((id) => world(doc, id))).toEqual(before);
  });

  it("drop targets: upper half in front, lower half behind, middle of a frame inside", () => {
    const { doc, page, frame, c } = setup();
    const rows = layerRows(doc, page);
    // rows: Loose, Card, C, B, A
    expect(dropTargetAt(rows, doc, page, 32 + 16, 32).place).toEqual({ parentId: frame, position: "last" });
    expect(dropTargetAt(rows, doc, page, 2, 32).place).toEqual({ parentId: page, position: { after: rows[0]!.id } });
    expect(dropTargetAt(rows, doc, page, 2 * 32 + 30, 32).place).toEqual({ parentId: frame, position: { before: c } });
    expect(dropTargetAt(rows, doc, page, 999, 32).place).toEqual({ parentId: page, position: "first" });
  });

  it("documentOrder sorts by the layer tree", () => {
    const { doc, a, c, loose } = setup();
    expect(documentOrder(doc, [loose, c, a])).toEqual([a, c, loose]);
  });
});

describe("hide, lock, rename", () => {
  it("toggles visibility and locks for the whole selection", () => {
    const { doc, a, b } = setup();
    doc.transact("h", (tx) => toggleVisible(tx, doc, [a, b]));
    expect([doc.get(a)!.visible, doc.get(b)!.visible]).toEqual([false, false]);
    doc.transact("h", (tx) => toggleVisible(tx, doc, [a, b]));
    expect(doc.get(a)!.visible).toBe(true);
    doc.transact("l", (tx) => toggleLocked(tx, doc, [a]));
    expect(doc.get(a)!.locked).toBe(true);
  });

  it("refuses blank names", () => {
    const { doc, a } = setup();
    expect(doc.transact("r", (tx) => renameNode(tx, a, "   "))).toBe(false);
    doc.transact("r", (tx) => renameNode(tx, a, "  Hero  image "));
    expect(doc.get(a)!.name).toBe("Hero image");
  });
});

describe("pages", () => {
  it("adds, duplicates, reorders and never deletes the last page", () => {
    const { doc, page } = setup();
    expect(nextPageName(doc)).toBe("Page 2");
    const p2 = doc.transact("Add", (tx) => tx.addPage(nextPageName(doc)));
    const copy = doc.transact("Dup", (tx) => duplicatePage(tx, doc, page));
    expect(doc.pages().map((p) => p.name)).toEqual(["Page 1", "Page 1 copy", "Page 2"]);
    expect(doc.subtree(copy).length).toBe(doc.subtree(page).length);
    doc.transact("Move", (tx) => movePage(tx, doc, p2, 0));
    expect(doc.pages().map((p) => p.name)).toEqual(["Page 2", "Page 1", "Page 1 copy"]);
    doc.undo();
    expect(doc.pages().map((p) => p.name)).toEqual(["Page 1", "Page 1 copy", "Page 2"]);
    doc.transact("Del", (tx) => tx.delete(copy));
    doc.transact("Del", (tx) => tx.delete(p2));
    expect(() => doc.transact("Del", (tx) => tx.delete(page))).toThrow();
  });
});

describe("clipboard", () => {
  it("round-trips layers through JSON with their page place, children and images", () => {
    const { doc, page, frame, a } = setup();
    const hash = doc.addImage(Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0)));
    doc.transact("img", (tx) => tx.set(a, "fills", [{ type: "IMAGE", imageHash: hash, scaleMode: "FILL", visible: true, opacity: 1 } as never]));
    const data = serializeLayers(doc, [frame, a])!;
    expect(data.layers).toHaveLength(1); // A comes along inside Card
    expect(plainText(data)).toBe("Card");
    expect(Object.keys(data.images)).toEqual([hash]);
    const parsed = parseClip(JSON.stringify(data))!;
    expect(parseClip("hello")).toBeNull();

    const other = new Document("Other");
    const p = other.transact("p", (tx) => tx.addPage("P"));
    const ids = other.transact("Paste", (tx) => pasteLayers(tx, other, parsed, { selection: [], pageId: p, inPlace: true }));
    expect(ids).toHaveLength(1);
    const pasted = other.get(ids[0]!)!;
    expect(pasted).toMatchObject({ name: "Card", x: 100, y: 50, width: 400 });
    expect(other.subtree(ids[0]!)).toHaveLength(doc.subtree(frame).length);
    expect(other.image(hash)).toBeDefined();
    expect(page).toBeTruthy();
  });

  it("pastes into a selected frame, next to a selected copy, else on the page", () => {
    const { doc, page, frame, a, loose } = setup();
    const data = serializeLayers(doc, [loose])!;
    expect(pasteTarget(doc, data, { selection: [frame], pageId: page, inPlace: false })).toEqual({ parentId: frame, after: null });
    expect(pasteTarget(doc, data, { selection: [loose], pageId: page, inPlace: false })).toEqual({ parentId: page, after: loose });
    expect(pasteTarget(doc, data, { selection: [a], pageId: page, inPlace: false })).toEqual({ parentId: frame, after: a });
    expect(pasteTarget(doc, data, { selection: [], pageId: page, inPlace: false })).toEqual({ parentId: page, after: null });
  });

  it("a plain paste out of view lands in the middle of the view; ⇧⌘V keeps the page place", () => {
    const { doc, page, loose } = setup();
    const data = serializeLayers(doc, [loose])!;
    const viewport = { x: 0, y: 1000, width: 200, height: 200 };
    const [moved] = doc.transact("p", (tx) => pasteLayers(tx, doc, data, { selection: [], pageId: page, inPlace: false, viewport }));
    expect(doc.get(moved!)).toMatchObject({ x: 95, y: 1095 });
    const [kept] = doc.transact("p", (tx) => pasteLayers(tx, doc, data, { selection: [], pageId: page, inPlace: true, viewport }));
    expect(doc.get(kept!)).toMatchObject({ x: 700, y: 0 });
  });
});
