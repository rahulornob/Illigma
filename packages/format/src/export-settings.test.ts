import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readPackage, writePackage } from "./package.js";
import { sampleFile } from "./sample.fixture.js";
import { EXPORT_LIMITS, type ExportSettings } from "./schema.js";
import { validateFile, validateNodeField } from "./validate.js";

const ok = (v: unknown) => expect(validateNodeField("exportSettings", v)).toBeNull();
const bad = (v: unknown, pattern: RegExp) => expect(validateNodeField("exportSettings", v)).toMatch(pattern);

describe("exportSettings (Figma's ExportSettings)", () => {
  it("accepts Figma's shapes, with every optional field", () => {
    ok(undefined);
    ok([]);
    ok([{ format: "PNG" }]);
    ok([
      { format: "PNG", suffix: "", constraint: { type: "SCALE", value: 1 } },
      { format: "PNG", suffix: "@2x", constraint: { type: "SCALE", value: 2 }, contentsOnly: true, useAbsoluteBounds: false },
      { format: "JPG", constraint: { type: "WIDTH", value: 512 }, quality: 80 },
      { format: "JPG", constraint: { type: "HEIGHT", value: 0.5 } },
      { format: "SVG", svgIdAttribute: true, svgOutlineText: false, svgSimplifyStroke: true },
      { format: "PDF", suffix: "-print", contentsOnly: false },
    ]);
  });

  it("refuses unknown formats, unknown keys and fields of another format", () => {
    bad({ format: "PNG" }, /list of export settings/);
    bad([null], /setting 0 is not an object/);
    bad([{ format: "GIF" }], /unknown format "GIF"/);
    bad([{}], /unknown format/);
    bad([{ format: "PNG", colour: 1 }], /unknown field "colour"/);
    bad([{ format: "SVG", constraint: { type: "SCALE", value: 2 } }], /setting 0 \(SVG\) has an unknown field "constraint"/);
    bad([{ format: "PDF", svgIdAttribute: true }], /unknown field "svgIdAttribute"/);
    bad([{ format: "PNG", quality: 101 }], /"quality" must be a number from 0 to 100/);
    bad([{ format: "PNG", contentsOnly: "yes" }], /"contentsOnly" must be true or false/);
  });

  it("caps sizes, suffixes and the number of settings", () => {
    ok([{ format: "PNG", constraint: { type: "SCALE", value: EXPORT_LIMITS.maxScale } }]);
    bad([{ format: "PNG", constraint: { type: "SCALE", value: EXPORT_LIMITS.maxScale + 1 } }], /at most 100/);
    bad([{ format: "PNG", constraint: { type: "SCALE", value: 0 } }], /above 0/);
    bad([{ format: "PNG", constraint: { type: "SCALE", value: -2 } }], /above 0/);
    bad([{ format: "PNG", constraint: { type: "WIDTH", value: Number.NaN } }], /above 0/);
    bad([{ format: "PNG", constraint: { type: "WIDTH", value: Infinity } }], /above 0/);
    ok([{ format: "PNG", constraint: { type: "WIDTH", value: EXPORT_LIMITS.maxPixels } }]);
    bad([{ format: "PNG", constraint: { type: "HEIGHT", value: EXPORT_LIMITS.maxPixels + 1 } }], /at most 100,000/);
    bad([{ format: "PNG", constraint: { type: "SIZE", value: 2 } }], /must be one of "SCALE", "WIDTH", "HEIGHT"/);
    bad([{ format: "PNG", constraint: { type: "SCALE" } }], /must be \{ type, value \}/);
    bad([{ format: "PNG", constraint: { type: "SCALE", value: 1, extra: 1 } }], /must be \{ type, value \}/);
    ok([{ format: "PNG", suffix: "s".repeat(EXPORT_LIMITS.maxSuffix) }]);
    bad([{ format: "PNG", suffix: "s".repeat(EXPORT_LIMITS.maxSuffix + 1) }], /at most 200 characters/);
    bad([{ format: "PNG", suffix: 2 }], /"suffix" must be text/);
    ok(Array.from({ length: EXPORT_LIMITS.maxSettings }, () => ({ format: "PNG" })));
    bad(
      Array.from({ length: EXPORT_LIMITS.maxSettings + 1 }, () => ({ format: "PNG" })),
      /at most 100 export settings/,
    );
  });

  it("round-trips through the package, and files without it save as before", () => {
    const file = sampleFile();
    const before = writePackage(file);
    const frame = file.nodes.find((n) => n.type === "FRAME");
    expect(frame).toBeDefined();
    const settings: ExportSettings[] = [
      { format: "PNG", suffix: "", constraint: { type: "SCALE", value: 1 } },
      { format: "SVG", suffix: "", svgIdAttribute: true },
    ];
    (frame as { exportSettings?: ExportSettings[] }).exportSettings = settings;
    expect(validateFile(file)).toEqual([]);
    const back = readPackage(writePackage(file));
    expect(back.nodes.find((n) => n.id === frame?.id)?.exportSettings).toEqual(settings);
    delete (frame as { exportSettings?: ExportSettings[] }).exportSettings;
    expect(writePackage(file)).toEqual(before);
  });

  it("is described in the JSON Schema with the same caps", () => {
    const schema = JSON.parse(readFileSync(new URL("../schema/node.v0.schema.json", import.meta.url), "utf8"));
    expect(schema.properties.exportSettings.maxItems).toBe(EXPORT_LIMITS.maxSettings);
    const image = schema.$defs.exportSettings.oneOf[0];
    expect(image.properties.suffix.maxLength).toBe(EXPORT_LIMITS.maxSuffix);
    expect(image.properties.constraint.properties.value.maximum).toBe(EXPORT_LIMITS.maxPixels);
    expect(schema.$defs.exportSettings.oneOf.every((s: { additionalProperties: boolean }) => s.additionalProperties === false)).toBe(true);
  });
});
