import { Document } from "@illigma/core";
import type { Color, NodeId, NodeType } from "@illigma/format";

const PALETTE: Color[] = [
  { r: 1, g: 0.42, b: 0.29, a: 1 },
  { r: 0.37, g: 0.83, b: 0.63, a: 1 },
  { r: 0.36, g: 0.55, b: 0.96, a: 1 },
  { r: 0.98, g: 0.75, b: 0.14, a: 1 },
  { r: 0.93, g: 0.93, b: 0.95, a: 1 },
  { r: 0.12, g: 0.12, b: 0.13, a: 1 },
];
const solid = (color: Color) => ({ type: "SOLID" as const, visible: true, color });

/** A page of `frames` phone screens, each holding `perFrame` shapes. 100 × 99 + 100 = 10,000 layers. */
export function buildScene(frames = 100, perFrame = 99): { doc: Document; page: NodeId; layers: number } {
  const doc = new Document("Benchmark");
  let page = "";
  doc.transact("Build benchmark scene", (tx) => {
    page = tx.addPage("Benchmark");
    const cols = Math.ceil(Math.sqrt(frames));
    for (let f = 0; f < frames; f++) {
      const frame = tx.create("FRAME", page, {
        name: `Screen ${f + 1}`,
        x: (f % cols) * 513,
        y: Math.floor(f / cols) * 972,
        width: 393,
        height: 852,
        cornerRadius: 24,
        fills: [solid({ r: 1, g: 1, b: 1, a: 1 })],
      });
      for (let i = 0; i < perFrame; i++) {
        const kind: NodeType = i % 3 === 0 ? "ELLIPSE" : i % 7 === 0 ? "TEXT" : "RECTANGLE";
        const col = i % 9;
        const row = Math.floor(i / 9);
        tx.create(kind, frame, {
          x: 16 + col * 41,
          y: 24 + row * 74,
          width: 36,
          height: kind === "TEXT" ? 18 : 64,
          cornerRadius: kind === "RECTANGLE" ? 8 : 0,
          fills: [solid(PALETTE[(i + f) % PALETTE.length] as Color)],
          strokes: i % 11 === 0 ? [solid(PALETTE[5] as Color)] : [],
        });
      }
    }
  });
  return { doc, page, layers: doc.size - 1 };
}
