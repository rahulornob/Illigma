import { describe, expect, it } from "vitest";
import {
  formatChannels,
  fromChannels,
  fromRgb255,
  hslToHsv,
  hslToRgb,
  hsvFor,
  hsvToHsl,
  hsvToRgb,
  parseHex,
  rgbToHsl,
  rgbToHsv,
  sameColor,
  toHex,
  toHex8,
  toRgb255,
} from "./color";

const rgb = (r: number, g: number, b: number, a = 1) => fromRgb255(r, g, b, a);

describe("hex", () => {
  it("reads 3, 4, 6 and 8 digits, with or without #, any case", () => {
    expect(toHex(parseHex("#ff5b2e")!)).toBe("FF5B2E");
    expect(toHex(parseHex("F53")!)).toBe("FF5533");
    expect(parseHex("f538")!.a).toBeCloseTo(0x88 / 255);
    expect(toHex8(parseHex("FF5B2E80")!)).toBe("FF5B2E80");
    expect(parseHex("  #000000 ")).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });
  it("reads Figma's short greys: one or two digits", () => {
    expect(toHex(parseHex("3")!)).toBe("333333");
    expect(toHex(parseHex("cc")!)).toBe("CCCCCC");
  });
  it("refuses anything else", () => {
    for (const bad of ["", "#", "12345", "1234567", "GGGGGG", "red", "#12 34 56"]) expect(parseHex(bad)).toBeNull();
  });
  it("round-trips every 8-bit channel value", () => {
    for (let v = 0; v < 256; v++) {
      const hex = v.toString(16).padStart(2, "0").toUpperCase().repeat(3);
      expect(toHex(parseHex(hex)!)).toBe(hex);
    }
  });
});

describe("RGB, HSB and HSL", () => {
  const samples = [
    [255, 91, 46],
    [0, 0, 0],
    [255, 255, 255],
    [128, 128, 128],
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [12, 200, 180],
    [250, 250, 1],
    [59, 130, 246],
  ] as const;

  it("knows the corners", () => {
    expect(rgbToHsv(rgb(255, 0, 0))).toEqual({ h: 0, s: 1, v: 1 });
    expect(rgbToHsv(rgb(0, 0, 255)).h).toBeCloseTo(240);
    expect(rgbToHsl(rgb(0, 255, 0))).toEqual({ h: 120, s: 1, l: 0.5 });
    expect(rgbToHsl(rgb(255, 255, 255))).toEqual({ h: 0, s: 0, l: 1 });
  });

  it("round-trips RGB through HSB and HSL to the same 8-bit colour", () => {
    for (const [r, g, b] of samples) {
      const c = rgb(r, g, b);
      expect(toRgb255(hsvToRgb(rgbToHsv(c)))).toEqual([r, g, b]);
      expect(toRgb255(hslToRgb(rgbToHsl(c)))).toEqual([r, g, b]);
      expect(toRgb255(hsvToRgb(hslToHsv(hsvToHsl(rgbToHsv(c)))))).toEqual([r, g, b]);
    }
  });

  it("round-trips a fine sweep of the RGB cube through HSB", () => {
    for (let r = 0; r < 256; r += 15) for (let g = 0; g < 256; g += 17) for (let b = 0; b < 256; b += 51) expect(toRgb255(hsvToRgb(rgbToHsv(rgb(r, g, b))))).toEqual([r, g, b]);
  });

  it("keeps alpha and clamps out-of-range input", () => {
    expect(hsvToRgb({ h: 0, s: 1, v: 1 }, 0.5).a).toBe(0.5);
    expect(hsvToRgb({ h: 720, s: 2, v: -1 })).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(hsvToRgb({ h: -120, s: 1, v: 1 })).toEqual(hsvToRgb({ h: 240, s: 1, v: 1 }));
  });

  it("shows and reads each format's fields", () => {
    const c = rgb(255, 91, 46);
    const hsv = rgbToHsv(c);
    expect(formatChannels("RGB", c, hsv)).toEqual([255, 91, 46]);
    expect(formatChannels("HSB", c, hsv)).toEqual([13, 82, 100]);
    expect(formatChannels("HSL", c, hsv)).toEqual([13, 100, 59]);
    for (const f of ["RGB", "HSB", "HSL"] as const) {
      const back = fromChannels(f, formatChannels(f, c, hsv), 0.4);
      expect(back.color.a).toBe(0.4);
      // HSB and HSL fields are whole numbers, so the colour comes back within a channel step or two.
      toRgb255(back.color).forEach((v, i) => expect(Math.abs(v - [255, 91, 46][i]!)).toBeLessThanOrEqual(3));
    }
  });
});

describe("hsvFor", () => {
  it("keeps the hue of a grey and the saturation of black", () => {
    const prev = { h: 200, s: 0.8, v: 0.6 };
    expect(hsvFor(rgb(0, 0, 0), prev)).toEqual({ h: 200, s: 0.8, v: 0 });
    expect(hsvFor(rgb(128, 128, 128), prev).h).toBe(200);
  });
  it("returns the previous value when it still makes the same colour", () => {
    const prev = { h: 13.4, s: 0.82, v: 1 };
    expect(hsvFor(hsvToRgb(prev), prev)).toBe(prev);
  });
  it("follows a colour changed elsewhere (undo, another field)", () => {
    expect(hsvFor(rgb(0, 0, 255), { h: 10, s: 1, v: 1 }).h).toBeCloseTo(240);
  });
  it("compares colours by their 8-bit values", () => {
    expect(sameColor({ r: 0.5, g: 0, b: 0, a: 1 }, { r: 0.5001, g: 0, b: 0, a: 1 })).toBe(true);
    expect(sameColor({ r: 0.5, g: 0, b: 0, a: 1 }, { r: 0.5, g: 0, b: 0, a: 0.5 })).toBe(false);
  });
});
