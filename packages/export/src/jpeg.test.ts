// The fallback JPEG encoder, checked by decoding its output with CanvasKit (Skia's libjpeg-turbo).
import { describe, expect, it } from "vitest";
import { encodeJpeg } from "./jpeg.js";
import { canvasKit, decode } from "./test.fixture.js";

/** A test card: colour gradients, a hard black/white edge and a red square. */
function card(width: number, height: number): Uint8Array {
  const px = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const red = x > width * 0.6 && y > height * 0.6;
      px[i] = red ? 230 : Math.round((x / width) * 255);
      px[i + 1] = red ? 20 : Math.round((y / height) * 255);
      px[i + 2] = red ? 20 : x < width / 4 ? 0 : 255 - Math.round((x / width) * 255);
      px[i + 3] = 255;
    }
  }
  return px;
}

describe("encodeJpeg", () => {
  it("writes a file a standard decoder reads back closely, at any size", async () => {
    const ck = await canvasKit();
    for (const [w, h] of [[1, 1], [8, 8], [37, 21], [128, 96]] as const) {
      const src = card(w, h);
      const img = decode(ck, encodeJpeg(src, w, h, 95));
      expect([img.width, img.height]).toEqual([w, h]);
      let err = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const [r, g, b] = img.at(x, y);
          const i = (y * w + x) * 4;
          err += Math.abs((r as number) - (src[i] as number)) + Math.abs((g as number) - (src[i + 1] as number)) + Math.abs((b as number) - (src[i + 2] as number));
        }
      }
      expect(err / (w * h * 3)).toBeLessThan(3); // mean error per channel, out of 255
    }
  });

  it("trades size for quality, and is deterministic", () => {
    const src = card(96, 64);
    const sizes = [5, 50, 90, 100].map((q) => encodeJpeg(src, 96, 64, q).length);
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
    expect(sizes[0]).toBeLessThan(sizes[3] as number);
    expect(encodeJpeg(src, 96, 64, 80)).toEqual(encodeJpeg(src, 96, 64, 80));
    const head = encodeJpeg(src, 96, 64, 80);
    expect(Array.from(head.slice(0, 4))).toEqual([0xff, 0xd8, 0xff, 0xe0]);
    expect(Array.from(head.slice(-2))).toEqual([0xff, 0xd9]);
  });
});
