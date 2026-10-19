// QC round 8: images hashed without blocking, and prototype colours with alpha imported as paint opacity.

import { describe, expect, it } from "vitest";
import { sha256Hex } from "./images.js";
import { importPrototypeJson } from "./import-prototype.js";
import { FormatError, hashImage, hashImageAsync } from "./package.js";
import { PNG_1PX, PNG_HASH } from "./paints.fixture.js";
import type { Node } from "./schema.js";

describe("hashImageAsync", () => {
  it("gives the same hash as hashImage, which then reuses it without hashing again", async () => {
    const bytes = PNG_1PX.slice();
    expect(await hashImageAsync(bytes)).toBe(PNG_HASH);
    // Change the last byte (the end chunk's checksum: still a PNG of the same size). A fresh hash would differ;
    // the remembered one comes back, so `Document.addImage` after `hashImageAsync` doesn't hash on the main thread.
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] as number) ^ 0xff;
    expect(sha256Hex(bytes)).not.toBe(PNG_HASH);
    expect(hashImage(bytes)).toBe(PNG_HASH);
  });

  it("refuses what hashImage refuses, with the same message", async () => {
    const junk = new Uint8Array([1, 2, 3, 4]);
    await expect(hashImageAsync(junk)).rejects.toBeInstanceOf(FormatError);
    await expect(hashImageAsync(junk)).rejects.toThrow("This image can't be used: it is not a PNG, JPEG, WebP or GIF image.");
    expect(() => hashImage(junk)).toThrow("This image can't be used: it is not a PNG, JPEG, WebP or GIF image.");
  });
});

describe("prototype colours with alpha", () => {
  it("stores the colour opaque and its alpha as the paint's opacity, for fills and strokes", () => {
    const obj = (id: string, extra: Record<string, unknown>) => ({
      id, type: "rect", name: id, frameId: "A", x: 10, y: 10, w: 20, h: 20, rotation: 0, opacity: 1, stroke: "#000000", strokeWidth: 0,
      visible: true, locked: false, effects: [], ...extra,
    });
    const doc = {
      version: 1,
      title: "Alpha",
      activePageId: "p1",
      pages: [
        {
          id: "p1",
          name: "Page 1",
          artboards: [{ id: "A", name: "Frame", x: 0, y: 0, width: 200, height: 200, fill: "#ffffff" }],
          objects: [
            obj("eight", { fill: "#ff000080", stroke: "rgba(0, 0, 255, 0.25)", strokeWidth: 2 }),
            obj("four", { fill: "#0f08" }),
            obj("opaque", { fill: "#00ff00" }),
          ],
        },
      ],
    };
    const { file } = importPrototypeJson(doc);
    const byName = (name: string) => file.nodes.find((n) => n.name === name) as Node;
    expect(byName("eight").fills).toEqual([{ type: "SOLID", visible: true, color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 128 / 255 }]);
    expect(byName("eight").strokes).toEqual([{ type: "SOLID", visible: true, color: { r: 0, g: 0, b: 1, a: 1 }, opacity: 0.25 }]);
    expect(byName("four").fills).toEqual([{ type: "SOLID", visible: true, color: { r: 0, g: 1, b: 0, a: 1 }, opacity: 0x88 / 255 }]);
    // Opaque colours get no opacity field (its default is 1), as before.
    expect(byName("opaque").fills).toEqual([{ type: "SOLID", visible: true, color: { r: 0, g: 1, b: 0, a: 1 } }]);
  });
});
