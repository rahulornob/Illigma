import { Document } from "@illigma/core";
import { vectorNetworkFromSvgPath, type Color, type NodeId, type NodeType } from "@illigma/format";

const PALETTE: Color[] = [
  { r: 1, g: 0.42, b: 0.29, a: 1 },
  { r: 0.37, g: 0.83, b: 0.63, a: 1 },
  { r: 0.36, g: 0.55, b: 0.96, a: 1 },
  { r: 0.98, g: 0.75, b: 0.14, a: 1 },
  { r: 0.93, g: 0.93, b: 0.95, a: 1 },
  { r: 0.12, g: 0.12, b: 0.13, a: 1 },
];
const WORDS = ["Label", "Title", "Price", "Menu", "Done", "Save", "Share", "Inbox", "Log out", "Sign in"];
const solid = (color: Color) => ({ type: "SOLID" as const, visible: true, color });

/** A 36 × 64 ring of curves with an even-odd hole, for the vector layers. */
const RING = "M18 0 C28 0 36 14 36 32 C36 50 28 64 18 64 C8 64 0 50 0 32 C0 14 8 0 18 0 Z M18 16 C23 16 26 23 26 32 C26 41 23 48 18 48 C13 48 10 41 10 32 C10 23 13 16 18 16 Z";

/**
 * A page of `frames` phone screens, each holding `perFrame` shapes. 100 × 99 + 100 = 10,000 layers.
 * Mostly rectangles, ellipses and text, with stars, polygons and vectors (each with its own network) mixed in.
 */
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
        const kind: NodeType =
          i % 3 === 0 ? "ELLIPSE" : i % 13 === 0 ? "STAR" : i % 17 === 0 ? "POLYGON" : i % 19 === 0 ? "VECTOR" : i % 7 === 0 ? "TEXT" : "RECTANGLE";
        const col = i % 9;
        const row = Math.floor(i / 9);
        tx.create(kind, frame, {
          x: 16 + col * 41,
          y: 24 + row * 74,
          width: 36,
          height: kind === "TEXT" ? 18 : 64,
          cornerRadius: kind === "RECTANGLE" ? 8 : 0,
          fills: [solid((kind === "TEXT" ? PALETTE[5] : PALETTE[(i + f) % PALETTE.length]) as Color)], // dark text reads on the white screens
          strokes: i % 11 === 0 ? [solid(PALETTE[5] as Color)] : [],
          // Two-word labels wrap onto a second line at this width.
          ...(kind === "STAR" ? { pointCount: 5 + (f % 4) } : {}),
          ...(kind === "POLYGON" ? { pointCount: 3 + (f % 5), cornerRadius: 4 } : {}),
          ...(kind === "VECTOR" ? { vectorNetwork: vectorNetworkFromSvgPath(RING, { windingRule: "EVENODD" }) } : {}),
          ...(kind === "TEXT" ? { characters: WORDS[(i + f) % WORDS.length] as string, fontFamily: "Inter", fontStyle: "Regular", fontSize: 12, lineHeight: 16 } : {}),
        });
      }
    }
  });
  return { doc, page, layers: doc.size - 1 };
}
