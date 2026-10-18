import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildFromDisk } from "../scripts/build.mjs";
import { elevations, textStyles, tokens, type TokenName } from "./index";

const pkg = new URL("../", import.meta.url);
const read = (file: string) => readFileSync(new URL(file, pkg), "utf8");
const css = read("tokens.css");
const exported = JSON.parse(read("figma-export.json")) as {
  collections: { name: string; variables: { name: string; values: Record<string, { value: { r: number; g: number; b: number; a: number } | number }> }[] }[];
};

const names = Object.keys(tokens) as TokenName[];

function parseCssColor(value: string): { r: number; g: number; b: number; a: number } {
  const hex = /^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/i.exec(value);
  if (hex) return { r: parseInt(hex[1]!, 16), g: parseInt(hex[2]!, 16), b: parseInt(hex[3]!, 16), a: 1 };
  const rgba = /^rgba\((\d+), (\d+), (\d+), (0|1|0?\.\d+)\)$/.exec(value);
  if (rgba) return { r: Number(rgba[1]), g: Number(rgba[2]), b: Number(rgba[3]), a: Number(rgba[4]) };
  throw new Error(`Not a token colour: ${value}`);
}

/** HSL hue in degrees and saturation 0..1. */
function hueSat({ r, g, b }: { r: number; g: number; b: number }): { hue: number; sat: number } {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  if (d === 0) return { hue: 0, sat: 0 };
  const l = (max + min) / 2;
  const sat = d / (1 - Math.abs(2 * l - 1));
  let hue = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  hue *= 60;
  if (hue < 0) hue += 360;
  return { hue, sat };
}

// Purple/violet sits roughly at 255-315 degrees, lime/yellow-green at 65-105.
const isPurple = (c: { hue: number; sat: number }) => c.sat > 0.15 && c.hue >= 255 && c.hue <= 315;
const isLime = (c: { hue: number; sat: number }) => c.sat > 0.15 && c.hue >= 65 && c.hue <= 105;

describe("semantic tokens", () => {
  it("covers every variable in the Illigma UI collection", () => {
    const ui = exported.collections.find((c) => c.name === "Illigma UI")!;
    expect(names.sort()).toEqual(ui.variables.map((v) => v.name).sort());
  });

  it("has a Dark and a Light value for every token", () => {
    for (const name of names) {
      const t = tokens[name];
      expect(t.dark, `${name} dark`).not.toBeUndefined();
      expect(t.light, `${name} light`).not.toBeUndefined();
      if (t.type === "color") {
        parseCssColor(t.dark);
        parseCssColor(t.light);
        expect(t.alias.dark, `${name} dark alias`).toBeTruthy();
        expect(t.alias.light, `${name} light alias`).toBeTruthy();
      } else {
        expect(Number.isFinite(t.dark) && Number.isFinite(t.light), name).toBe(true);
      }
    }
  });

  it("uses no purple or lime hues (removed from the design on 2026-10-13)", () => {
    const offenders: string[] = [];
    for (const name of names) {
      const t = tokens[name];
      if (t.type !== "color") continue;
      for (const mode of ["dark", "light"] as const) {
        const hs = hueSat(parseCssColor(t[mode]));
        if (isPurple(hs) || isLime(hs)) offenders.push(`${name} (${mode}) ${t[mode]} hue ${Math.round(hs.hue)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("has no purple or lime primitives either", () => {
    const prim = exported.collections.find((c) => c.name === "Illigma Primitives")!;
    for (const v of prim.variables) expect(v.name).not.toMatch(/purple|violet|lime/i);
    const offenders = prim.variables.filter((v) => {
      const c = Object.values(v.values)[0]!.value as { r: number; g: number; b: number };
      const hs = hueSat({ r: c.r * 255, g: c.g * 255, b: c.b * 255 });
      return isPurple(hs) || isLime(hs);
    });
    expect(offenders.map((v) => v.name)).toEqual([]);
  });

  it("makes text alpha white in Dark and alpha black in Light", () => {
    // text/on-inverse sits on bg/inverse (the opposite surface), so it is a solid colour by design.
    const textTokens = names.filter((n) => n.startsWith("text/") && n !== "text/on-inverse");
    expect(textTokens.length).toBeGreaterThanOrEqual(4);
    for (const name of textTokens) {
      const t = tokens[name];
      if (t.type !== "color") throw new Error(`${name} is not a colour`);
      const dark = parseCssColor(t.dark), light = parseCssColor(t.light);
      expect([dark.r, dark.g, dark.b], `${name} dark`).toEqual([255, 255, 255]);
      expect(dark.a, `${name} dark alpha`).toBeLessThan(1);
      expect([light.r, light.g, light.b], `${name} light`).toEqual([0, 0, 0]);
      expect(light.a, `${name} light alpha`).toBeLessThan(1);
      expect(t.alias.dark, name).toMatch(/^alpha\/white-\d+$/);
      expect(t.alias.light, name).toMatch(/^alpha\/black-\d+$/);
    }
  });
});

describe("tokens.css", () => {
  it("parses: balanced braces and well-formed declarations", () => {
    expect(css.split("{").length).toBe(css.split("}").length);
    const body = css.replace(/\/\*[\s\S]*?\*\//g, "");
    let depth = 0;
    for (const ch of body) {
      if (ch === "{") depth++;
      if (ch === "}") depth--;
      expect(depth).toBeGreaterThanOrEqual(0);
    }
    expect(depth).toBe(0);
    for (const line of body.split("\n").map((l) => l.trim())) {
      if (!line || line.endsWith("{") || line === "}" || line.endsWith(",")) continue;
      expect(line, line).toMatch(/^(--[a-z0-9-]+|color-scheme): [^;{}]+;$/);
    }
    expect(css).not.toMatch(/undefined|NaN|\[object/);
  });

  it("defines every token, in each theme block where it varies", () => {
    const blocks = {
      dark: css.slice(css.indexOf(':root,\n[data-theme="dark"]'), css.indexOf('[data-theme="light"] {')),
      light: css.slice(css.indexOf('[data-theme="light"] {'), css.indexOf("@media")),
      system: css.slice(css.indexOf("@media (prefers-color-scheme: light)")),
    };
    for (const name of names) {
      const t = tokens[name];
      const v = (m: "dark" | "light") => (t.type === "color" ? t[m] : `${t[m]}px`);
      expect(css, name).toContain(`${t.cssVar}: `);
      if (v("dark") !== v("light")) {
        expect(blocks.dark, name).toContain(`${t.cssVar}: ${v("dark")};`);
        expect(blocks.light, name).toContain(`${t.cssVar}: ${v("light")};`);
        expect(blocks.system, name).toContain(`${t.cssVar}: ${v("light")};`);
      }
    }
    for (const s of Object.values(textStyles)) {
      expect(css).toContain(`${s.cssVar}: ${s.css};`);
      expect(css).toContain(`${s.letterSpacingVar}: `);
    }
    for (const e of Object.values(elevations)) expect(css).toContain(`${e.cssVar}: ${e.css};`);
    expect(css).toContain("--bg-shell: ");
    expect(css).toContain("--text-primary: ");
    expect(css).toContain('--type-ui-body: 400 12px/16px "Inter", system-ui, sans-serif;');
  });
});

describe("generated files", () => {
  it("match a fresh build of figma-export.json", () => {
    const files = buildFromDisk();
    for (const [file, content] of Object.entries(files)) expect(read(file), `${file} is stale: run npm run build:tokens`).toBe(content);
  });

  it("tokens.json references only primitives that exist", () => {
    const json = JSON.parse(read("tokens.json")) as Record<string, unknown>;
    const lookup = (path: string) => path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], json);
    const refs = read("tokens.json").match(/"\{[^}]+\}"/g) ?? [];
    expect(refs.length).toBeGreaterThan(0);
    for (const r of refs) {
      const target = lookup(r.slice(2, -2)) as { $type?: string } | undefined;
      expect(target?.$type, r).toBe("color");
    }
  });
});
