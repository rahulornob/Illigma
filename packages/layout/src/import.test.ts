/**
 * Prototype import (milestone 0.8) meets layout (0.7): a document the old
 * prototype laid out, imported with its auto layout and constraints, lays
 * out the same in `@illigma/layout`. The prototype saved computed positions,
 * so a full relayout of the imported file must change nothing.
 */

import { readFileSync } from "node:fs";
import { compareOrder, importPrototypeJson, type IlligmaFile, type Node, type NodeId } from "@illigma/format";
import { describe, expect, it } from "vitest";
import { relayout, resize } from "./index.js";
import type { LayoutChange, LayoutNode, LayoutReader } from "./types.js";

/**
 * Laid out by the prototype's own code: `autolayout.js`, `constraints.js` and
 * `applyAllAutoLayouts` from `main.js` at commit 8e3bd2f, run until stable.
 * Nested auto layout (a hugging card in a plain frame, with a Fill header, a
 * wrapping tag row, a Fill button with a max width and an absolute badge), a
 * fixed toolbar with a rotated layer, a group, a hidden layer and Fill with
 * min and max, an Evenly column, a negative gap, and constraints of every kind.
 */
const PROTOTYPE = JSON.parse(readFileSync(new URL("../../format/test-fixtures/auto-layout-document.json", import.meta.url), "utf8")) as {
  pages: { artboards: { name: string; x: number; y: number; width: number; height: number }[]; objects: { id: string; x: number; y: number; w: number; h: number; rotation: number; visible: boolean }[] }[];
};

/** A read-only view of an imported file for layout, with a way to apply changes. */
class FileReader implements LayoutReader {
  readonly nodes = new Map<NodeId, Node>();
  readonly #kids = new Map<NodeId, Node[]>();
  constructor(file: IlligmaFile) {
    for (const n of file.nodes) this.nodes.set(n.id, { ...n });
    this.#index();
  }
  #index(): void {
    this.#kids.clear();
    for (const n of this.nodes.values()) {
      if (n.parentId === null) continue;
      const list = this.#kids.get(n.parentId) ?? [];
      list.push(n);
      this.#kids.set(n.parentId, list);
    }
    for (const list of this.#kids.values()) list.sort(compareOrder);
  }
  get(id: NodeId): LayoutNode | undefined {
    return this.nodes.get(id);
  }
  children(id: NodeId): readonly LayoutNode[] {
    return this.#kids.get(id) ?? [];
  }
  byName(name: string): Node {
    const n = [...this.nodes.values()].find((x) => x.name === name);
    if (!n) throw new Error(`no node named ${name}`);
    return n;
  }
  /** Top-left corner in page coordinates. */
  abs(n: Node): { x: number; y: number } {
    let x = n.x;
    let y = n.y;
    for (let p = this.nodes.get(n.parentId as string); p && p.type !== "PAGE"; p = this.nodes.get(p.parentId as string)) {
      x += p.x;
      y += p.y;
    }
    return { x, y };
  }
  apply(changes: readonly LayoutChange[]): void {
    for (const c of changes) this.nodes.set(c.id, { ...(this.nodes.get(c.id) as Node), [c.key]: c.value });
    this.#index();
  }
}

/** A deep relayout of everything on every page, as for content that was never laid out. */
function relayoutAll(doc: FileReader): LayoutChange[] {
  const pages = [...doc.nodes.values()].filter((n) => n.type === "PAGE");
  return relayout(doc, pages.flatMap((p) => doc.children(p.id).map((k) => k.id)), { deep: true });
}

const imported = () => new FileReader(importPrototypeJson(PROTOTYPE, { now: new Date(0) }).file);

describe("prototype import + layout", () => {
  it("relayout of the imported page moves nothing (within 1e-6)", () => {
    const doc = imported();
    const changes = relayoutAll(doc);
    for (const c of changes) {
      const was = (doc.get(c.id) as Node)[c.key];
      expect(Math.abs(c.value - was), `${(doc.get(c.id) as Node).name}.${c.key}: ${was} → ${c.value}`).toBeLessThan(1e-6);
    }
  });

  it("puts every layer where the prototype drew it", () => {
    const doc = imported();
    doc.apply(relayoutAll(doc));
    const page = PROTOTYPE.pages[0];
    if (!page) throw new Error("fixture has no page");
    for (const f of page.artboards) {
      const n = doc.byName(f.name);
      expect({ ...doc.abs(n), width: n.width, height: n.height }).toEqual({ x: close(f.x), y: close(f.y), width: close(f.width), height: close(f.height) });
    }
    for (const o of page.objects) {
      if (o.rotation !== 0 || !o.visible) continue; // rotation moves the stored corner; hidden layers don't flow
      const n = doc.byName(o.id);
      expect({ ...doc.abs(n), width: n.width, height: n.height }, o.id).toEqual({ x: close(o.x), y: close(o.y), width: close(o.w), height: close(o.h) });
    }
  });

  it("keeps laying out like Figma after import", () => {
    const doc = imported();
    // A wider body widens the hugging card, and the Fill header with it.
    const body = doc.byName("body").id;
    doc.apply([{ id: body, key: "width", value: 300 }]);
    doc.apply(relayout(doc, [body]));
    expect(doc.byName("Card").width).toBe(348);
    expect(doc.byName("Header").width).toBe(300);
    expect(doc.byName("close")).toMatchObject({ x: 300 - 8 - 16 });
    // Resizing the screen moves the right-pinned card and stretches the stretchy layer.
    const screen = doc.byName("Screen");
    doc.apply(resize(doc, screen.id, { width: 1000, height: 700 }));
    expect(doc.byName("Card").x).toBe(600);
    expect(doc.byName("pinned")).toMatchObject({ x: 900, y: 640 });
    expect(doc.byName("stretchy")).toMatchObject({ width: 500 });
    expect(doc.byName("stretchy").height).toBeCloseTo(70, 9);
  });

  it("known difference: a Fill layer across a hugging frame no longer props it open", () => {
    // The prototype measured a hugging frame by every child, Fill included, so a Fill
    // layer that was once wider kept the frame at its width. Figma (and Illigma) hug
    // only the children that don't fill, so the frame shrinks to its widest fixed child.
    const proto = {
      version: 1,
      artboards: [{ id: "C", name: "Card", x: 0, y: 0, width: 300, height: 20, autoLayout: { enabled: true, direction: "vertical", gap: 0, paddingX: 0, paddingY: 0 } }],
      objects: [
        { id: "fill", name: "fill", type: "rect", frameId: "C", x: 0, y: 0, w: 300, h: 10, widthSizing: "fill" },
        { id: "fixed", name: "fixed", type: "rect", frameId: "C", x: 0, y: 10, w: 200, h: 10 },
      ],
    };
    const doc = new FileReader(importPrototypeJson(proto, { now: new Date(0) }).file);
    doc.apply(relayoutAll(doc));
    expect(doc.byName("Card").width).toBe(200);
    expect(doc.byName("fill").width).toBe(200);
  });
});

/** Equal within 1e-6, for `toEqual`. */
function close(v: number) {
  return expect.closeTo(v, 6);
}
