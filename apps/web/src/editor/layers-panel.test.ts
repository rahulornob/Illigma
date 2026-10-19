/**
 * QC round 6: the Layers panel renders only the rows in view (as a tree with
 * aria-level, aria-setsize and aria-posinset), rebuilds its rows only for edits
 * that change them, and shows each shape type's own icon.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Document, type Operation } from "@illigma/core";
import type { NodeId } from "@illigma/format";
import { layerRows, LayersPanel, touchesRows } from "./LayersPanel";

function big(n: number) {
  const doc = new Document("Big");
  const ids = doc.transact("Build", (tx) => {
    const page = tx.addPage("Page 1");
    const frame = tx.create("FRAME", page, { name: "Desktop", width: 1440, height: 900 });
    const kids: NodeId[] = [];
    for (let i = 0; i < n; i++) kids.push(tx.create("RECTANGLE", frame, { name: `Box ${i}` }));
    const star = tx.create("STAR", page, { name: "Star" });
    return { page, frame, kids, star };
  });
  return { doc, ...ids };
}

const render = (doc: Document, pageId: NodeId, selection: NodeId[] = []) =>
  renderToStaticMarkup(createElement(LayersPanel, { doc, pageId, selection, onPage: () => {}, onSelect: () => {} }));

describe("Layers panel", () => {
  it("rows: front-most first, children under their parent, with level, position and set size", () => {
    const { doc, page, frame, kids, star } = big(3);
    const rows = layerRows(doc, page);
    expect(rows.map((r) => r.id)).toEqual([star, frame, kids[2], kids[1], kids[0]]);
    expect(rows[0]).toMatchObject({ depth: 0, posinset: 1, setsize: 2, hasChildren: false, parent: -1 });
    expect(rows[1]).toMatchObject({ depth: 0, posinset: 2, setsize: 2, hasChildren: true, parent: -1 });
    expect(rows[2]).toMatchObject({ depth: 1, posinset: 1, setsize: 3, parent: 1 });
    expect(rows[4]).toMatchObject({ depth: 1, posinset: 3, setsize: 3, parent: 1 });
  });

  it("renders a tree with only the rows in view, out of 12,000", () => {
    const { doc, page } = big(12_000);
    const html = render(doc, page);
    const items = html.match(/role="treeitem"/g) ?? [];
    expect(items.length).toBeGreaterThan(20);
    expect(items.length).toBeLessThan(100);
    expect(html).toMatch(/role="tree"[^>]*aria-multiselectable="true"/);
    expect(html).toContain('data-rows="12002"');
    expect(html).toMatch(/aria-level="2" aria-setsize="12000" aria-posinset="1"/);
    // The list keeps its full height, so the scrollbar is right.
    expect(html).toContain(`height:${12_002 * 32}px`);
  });

  it("only rows with children have aria-expanded, and collapsing hides their rows", () => {
    const { doc, page, frame } = big(3);
    const html = render(doc, page);
    expect(html.match(/aria-expanded="true"/g)).toHaveLength(1);
    expect(html).not.toContain('aria-expanded="false"');
    const rows = layerRows(doc, page, new Set([frame]));
    expect(rows.map((r) => r.id)).toHaveLength(2);
    expect(rows[1]).toMatchObject({ id: frame, collapsed: true, hasChildren: true });
  });

  it("selected rows are aria-selected; one row is in the Tab order", () => {
    const { doc, page, frame } = big(5);
    // The Layers / Assets tabs have their own aria-selected.
    const html = render(doc, page, [frame]).replace(/<div class="panel-tabbar".*?<\/div>/s, "");
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html).toMatch(/tabindex="0"[^>]*aria-selected="true"[^>]*aria-label="Desktop, frame"/);
  });

  it("stars, polygons, vectors and lines have their own icons", () => {
    const doc = new Document("Shapes");
    const page = doc.transact("Build", (tx) => {
      const p = tx.addPage("Page 1");
      for (const type of ["STAR", "POLYGON", "VECTOR", "LINE", "RECTANGLE"] as const) tx.create(type, p, { name: type });
      return p;
    });
    const html = render(doc, page);
    const iconOf = (name: string) => new RegExp(`aria-label="${name}, [a-z]+"[^>]*>.*?<svg[^>]*>(.*?)</svg>`).exec(html)?.[1];
    const icons = ["STAR", "POLYGON", "VECTOR", "LINE", "RECTANGLE"].map(iconOf);
    expect(new Set(icons).size).toBe(5);
    expect(iconOf("LINE")).toContain('d="M5 12h14"');
  });

  it("only edits to the tree or names rebuild the rows; a drag's x and y don't", () => {
    const set = (key: string): Operation => ({ op: "set", id: "a", key, value: 1, prev: 0 }) as Operation;
    expect(touchesRows(set("x"))).toBe(false);
    expect(touchesRows(set("y"))).toBe(false);
    expect(touchesRows(set("width"))).toBe(false);
    expect(touchesRows(set("name"))).toBe(true);
    expect(touchesRows(set("parentId"))).toBe(true);
    expect(touchesRows(set("index"))).toBe(true);
  });
});
