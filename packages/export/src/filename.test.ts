import { describe, expect, it } from "vitest";
import { exportFilename, planExportFilenames, sanitizeFilePart, uniqueFilename } from "./index.js";
import { build, solid, RED } from "./test.fixture.js";

describe("exportFilename", () => {
  it("is the layer name, then the suffix and extension, as in Figma", () => {
    expect(exportFilename("Icon", "PNG")).toBe("Icon.png");
    expect(exportFilename("Icon", "PNG", "@2x")).toBe("Icon@2x.png");
    expect(exportFilename("Home page", "JPG", "draft")).toBe("Home pagedraft.jpg");
    expect(exportFilename("Logo", "SVG")).toBe("Logo.svg");
    expect(exportFilename("Logo", "PDF")).toBe("Logo.pdf");
  });

  it("turns each / in the name into a folder", () => {
    expect(exportFilename("Icons/Arrow/Left", "PNG", "@3x")).toBe("Icons/Arrow/Left@3x.png");
    expect(exportFilename("Icons // Arrow /", "SVG")).toBe("Icons/Arrow.svg");
    expect(exportFilename(" / ", "PNG")).toBe("Untitled.png");
    expect(exportFilename("", "PNG")).toBe("Untitled.png");
  });

  it("never climbs out of the export folder", () => {
    expect(exportFilename("../../etc/passwd", "PNG")).toBe("etc/passwd.png");
    expect(exportFilename("./a/../b", "SVG")).toBe("a/b.svg");
  });

  it("replaces characters disks refuse and drops control characters", () => {
    expect(exportFilename('a:b*c?"d<e>f|g\\h', "PNG")).toBe("a_b_c__d_e_f_g_h.png");
    expect(exportFilename("Tab\there\u0000\u001f", "PNG")).toBe("Tabhere.png");
    expect(exportFilename("Name. . ", "PNG")).toBe("Name.png");
    expect(exportFilename("Icon", "PNG", "/2x")).toBe("Icon_2x.png");
  });

  it("keeps clear of Windows device names", () => {
    expect(exportFilename("CON", "PNG")).toBe("_CON.png");
    expect(exportFilename("Icons/nul.txt", "PNG")).toBe("Icons/_nul.txt.png");
    expect(exportFilename("Console", "PNG")).toBe("Console.png");
  });

  it("keeps non-Latin names and cuts very long ones without splitting a character", () => {
    expect(exportFilename("Écran d’accueil 🏠", "PNG")).toBe("Écran d’accueil 🏠.png");
    const long = sanitizeFilePart("😀".repeat(100));
    expect(new TextEncoder().encode(long).length).toBeLessThanOrEqual(200);
    expect(long).toBe("😀".repeat(50));
  });
});

describe("uniqueFilename", () => {
  it("numbers names already taken, ignoring case, as the Export dialog does", () => {
    const taken = new Set<string>();
    expect(uniqueFilename("Welcome.png", taken)).toBe("Welcome.png");
    expect(uniqueFilename("Welcome.png", taken)).toBe("Welcome-1.png");
    expect(uniqueFilename("welcome.PNG", taken)).toBe("welcome-2.PNG");
    expect(uniqueFilename("Icons/Welcome.png", taken)).toBe("Icons/Welcome.png");
    expect(uniqueFilename("Welcome-1.png", taken)).toBe("Welcome-1-1.png");
  });
});

describe("planExportFilenames", () => {
  it("names a batch in order, around files already in the folder", () => {
    const { doc, ids } = build((add, p) => ({
      a: add("RECTANGLE", p, { name: "Icon", fills: solid(RED) }),
      b: add("RECTANGLE", p, { name: "Icon", fills: solid(RED) }),
      c: add("RECTANGLE", p, { name: "Icons/Arrow", fills: solid(RED) }),
    }));
    const names = planExportFilenames(
      doc,
      [
        { nodeId: ids.a, settings: { format: "PNG" } },
        { nodeId: ids.a, settings: { format: "PNG", suffix: "@2x", constraint: { type: "SCALE", value: 2 } } },
        { nodeId: ids.b, settings: { format: "PNG" } },
        { nodeId: ids.b, settings: { format: "SVG" } },
        { nodeId: ids.c, settings: { format: "PDF" } },
        { nodeId: "missing", settings: { format: "PNG" } },
      ],
      ["icon.png", "Icons/Arrow.pdf"],
    );
    expect(names).toEqual(["Icon-1.png", "Icon@2x.png", "Icon-2.png", "Icon.svg", "Icons/Arrow-1.pdf", "Untitled.png"]);
  });
});
