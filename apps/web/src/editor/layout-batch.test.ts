/**
 * QC round 6: resizing many layers in one layout pass, vectors scaling with
 * their node, and layout values rounded to a millionth.
 */

import { describe, expect, it } from "vitest";
import { Document } from "@illigma/core";
import type { NodeId, VectorNetwork } from "@illigma/format";
import { loadDocument, sampleDocument } from "../files";
import { resizeBy, snapshot } from "./edit";
import { DOCUMENT_OPTIONS, resizeLayer, setBoxField, setBoxValues } from "./layout";
import { setBoxFields } from "./layout-props";

/** Time budgets are tuned on a laptop. Shared CI runners are slower, so CI gets 3x (or PERF_BUDGET_SCALE). */
const budget = (ms: number) => ms * (Number(process.env.PERF_BUDGET_SCALE) || (process.env.CI ? 3 : 1));

/** A vertical auto layout list of `n` Fill-width rows. */
function list(n: number) {
  const doc = new Document("List", DOCUMENT_OPTIONS);
  const ids = doc.transact("Build", (tx) => {
    const page = tx.addPage("Page 1");
    const frame = tx.create("FRAME", page, { width: 400, layoutMode: "VERTICAL", counterAxisSizingMode: "FIXED", itemSpacing: 4, paddingTop: 8, paddingBottom: 8 });
    const rows: NodeId[] = [];
    for (let i = 0; i < n; i++) rows.push(tx.create("RECTANGLE", frame, { width: 100, height: 10, layoutSizingHorizontal: "FILL" }));
    return { page, frame, rows };
  });
  return { doc, ...ids };
}

describe("resizing many layers is one layout pass", () => {
  it("typing W for 1,000 children of one auto layout frame", () => {
    const { doc, frame, rows } = list(1000);
    const t0 = performance.now();
    setBoxFields(doc, rows, "height", rows.map(() => 20), "Change height");
    const ms = performance.now() - t0;
    expect(doc.get(frame)?.height).toBe(8 + 1000 * 20 + 999 * 4 + 8);
    expect(doc.get(rows[999]!)?.y).toBe(8 + 999 * 24);
    expect(ms, `1,000 heights: ${ms.toFixed(1)} ms`).toBeLessThan(budget(60));
    doc.undo();
    expect(doc.get(frame)?.height).toBe(8 + 1000 * 10 + 999 * 4 + 8);
  });

  it("a live resize of 1,000 selected children: every pointer move is one pass", () => {
    const { doc, frame, rows } = list(1000);
    const starts = snapshot(doc, rows);
    const edit = doc.beginLive("Resize layers");
    const steps = 10;
    const t0 = performance.now();
    for (let i = 1; i <= steps; i++) edit.update((tx) => resizeBy(tx, doc, starts, "s", 0, i * 100, {}));
    const ms = (performance.now() - t0) / steps;
    edit.commit();
    expect(doc.get(frame)?.height).toBeGreaterThan(8 + 1000 * 10 + 999 * 4 + 8);
    expect(ms, `live resize of 1,000 layers: ${ms.toFixed(1)} ms per step`).toBeLessThan(budget(60));
  });

  it("4,000 children stay linear", () => {
    const { doc, frame, rows } = list(4000);
    const t0 = performance.now();
    setBoxFields(doc, rows, "width", rows.map(() => 50), "Change width");
    const ms = performance.now() - t0;
    expect(doc.get(rows[3999]!)).toMatchObject({ width: 50, layoutSizingHorizontal: "FIXED" });
    expect(doc.get(frame)?.width).toBe(400);
    expect(ms, `4,000 widths: ${ms.toFixed(1)} ms`).toBeLessThan(budget(250));
  });

  it("same result as resizing one by one when the layers are siblings", () => {
    const one = sampleDocument();
    const many = loadDocument(one.toFile());
    const ids = (doc: Document) => ["Image", "Title", "Button"].map((name) => doc.subtree(doc.pages()[0]!.id).find((n) => n.name === name)!.id);
    one.transact("One by one", (tx) => ids(one).forEach((id, i) => setBoxField(tx, one, id, "width", 100 + i * 10)));
    many.transact("Together", (tx) => setBoxValues(tx, many, "width", ids(many).map((id, i) => [id, 100 + i * 10] as const)));
    expect(many.toFile().nodes).toEqual(one.toFile().nodes);
  });

  it("a resized child of a resized frame follows its constraints on the axes it doesn't set", () => {
    const doc = new Document("Nested", DOCUMENT_OPTIONS);
    const { frame, child } = doc.transact("Build", (tx) => {
      const page = tx.addPage("Page 1");
      const frame = tx.create("FRAME", page, { width: 200, height: 200 });
      const child = tx.create("RECTANGLE", frame, { x: 150, y: 10, width: 40, height: 40, constraints: { horizontal: "MAX", vertical: "MIN" } });
      return { frame, child };
    });
    doc.transact("Resize", (tx) => setBoxValues(tx, doc, "width", [[frame, 300], [child, 20]]));
    expect(doc.get(frame)?.width).toBe(300);
    expect(doc.get(child)).toMatchObject({ x: 250, width: 20 });
  });
});

/** A 100 × 50 vector: a closed curved shape with a corner radius on one point. */
function vectorDocument(fields: Record<string, unknown> = {}) {
  const network: VectorNetwork = {
    vertices: [{ x: 0, y: 0 }, { x: 100, y: 0, cornerRadius: 4 }, { x: 100, y: 50 }, { x: 0, y: 50 }],
    segments: [
      { start: 0, end: 1, tangentStart: { x: 20, y: -10 }, tangentEnd: { x: -20, y: -10 } },
      { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
      { start: 2, end: 3, tangentStart: { x: -30, y: 5 }, tangentEnd: { x: 30, y: 5 } },
      { start: 3, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
    ],
    regions: [{ windingRule: "NONZERO", loops: [[0, 1, 2, 3]] }],
  };
  const doc = new Document("Vector", DOCUMENT_OPTIONS);
  const ids = doc.transact("Build", (tx) => {
    const page = tx.addPage("Page 1");
    const frame = tx.create("FRAME", page, { width: 400, height: 300 });
    const vector = tx.create("VECTOR", frame, { x: 10, y: 10, width: 100, height: 50, vectorNetwork: network, ...fields });
    return { page, frame, vector };
  });
  return { doc, network, ...ids };
}

const netOf = (doc: Document, id: NodeId) => structuredClone(doc.get(id)?.vectorNetwork) as VectorNetwork;

describe("vectors scale with their node", () => {
  it("W and H scale vertices and tangents, keep corner radii; one undo restores the exact network", () => {
    const { doc, vector, network } = vectorDocument();
    doc.transact("Resize", (tx) => resizeLayer(tx, doc, vector, { width: 200, height: 25 }));
    const net = netOf(doc, vector);
    expect(net.vertices).toEqual([{ x: 0, y: 0 }, { x: 200, y: 0, cornerRadius: 4 }, { x: 200, y: 25 }, { x: 0, y: 25 }]);
    expect(net.segments[0]).toMatchObject({ tangentStart: { x: 40, y: -5 }, tangentEnd: { x: -40, y: -5 } });
    expect(net.segments[2]).toMatchObject({ tangentStart: { x: -60, y: 2.5 }, tangentEnd: { x: 60, y: 2.5 } });
    expect(net.regions).toEqual(network.regions);
    doc.undo();
    expect(netOf(doc, vector)).toEqual(network);
    doc.redo();
    expect(netOf(doc, vector)).toEqual(net);
  });

  it("dragging a handle scales it live; cancel restores the network exactly", () => {
    const { doc, vector, network } = vectorDocument();
    const starts = snapshot(doc, [vector]);
    const edit = doc.beginLive("Resize");
    for (const dx of [7, 33, 100]) edit.update((tx) => resizeBy(tx, doc, starts, "e", dx, 0, {}));
    expect(netOf(doc, vector).vertices[1]).toEqual({ x: 200, y: 0, cornerRadius: 4 });
    edit.cancel();
    expect(netOf(doc, vector)).toEqual(network);
  });

  it("constraints Scale and Stretch scale it with the frame", () => {
    const { doc, frame, vector } = vectorDocument({ constraints: { horizontal: "SCALE", vertical: "STRETCH" } });
    doc.transact("Resize frame", (tx) => resizeLayer(tx, doc, frame, { width: 800, height: 350 }));
    expect(doc.get(vector)).toMatchObject({ x: 20, width: 200, height: 100 });
    expect(netOf(doc, vector).vertices[2]).toEqual({ x: 200, y: 100 });
  });

  it("Fill in auto layout scales it", () => {
    const { doc, frame, vector } = vectorDocument();
    doc.transact("Auto layout", (tx) => {
      tx.set(frame, "layoutMode", "HORIZONTAL");
      tx.set(frame, "primaryAxisSizingMode", "FIXED");
      tx.set(frame, "counterAxisSizingMode", "FIXED");
      tx.set(vector, "layoutSizingHorizontal", "FILL");
    });
    expect(doc.get(vector)?.width).toBe(400);
    expect(netOf(doc, vector).vertices[1]).toEqual({ x: 400, y: 0, cornerRadius: 4 });
  });

  it("a zero-width line keeps its x and scales along y", () => {
    const doc = new Document("Line", DOCUMENT_OPTIONS);
    const network: VectorNetwork = {
      vertices: [{ x: 0, y: 0 }, { x: 0, y: 80 }],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
      regions: [],
    };
    const vector = doc.transact("Build", (tx) => tx.create("VECTOR", tx.addPage("Page 1"), { width: 0, height: 80, vectorNetwork: network }));
    doc.transact("Resize", (tx) => resizeLayer(tx, doc, vector, { width: 10, height: 40 }));
    expect(netOf(doc, vector).vertices).toEqual([{ x: 0, y: 0 }, { x: 0, y: 40 }]);
  });
});

describe("layout values are rounded", () => {
  it("a 0.01 px image leaves no float noise in the positions after it", () => {
    const doc = sampleDocument();
    const page = doc.pages()[0]!.id;
    const id = (name: string) => doc.subtree(page).find((n) => n.name === name)!.id;
    doc.transact("Height", (tx) => setBoxField(tx, doc, id("Image"), "height", 0.01));
    expect(doc.get(id("Title"))?.y).toBe(40.01);
    expect(doc.get(id("Button"))?.y).toBe(80.01);
    expect(doc.get(id("Card"))?.height).toBe(144.01);
  });
});
