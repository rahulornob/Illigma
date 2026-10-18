// QC round 6: huge numbers in path data, and fills of open subpaths.
import { describe, expect, it } from "vitest";
import { importPrototypeJson } from "./import-prototype.js";
import { FormatError } from "./package.js";
import { validateFile } from "./validate.js";
import { svgPathFromVectorNetwork, vectorNetworkFromSvgPath, vectorNetworkProblem } from "./vector.js";

describe("huge numbers", () => {
  it("refuses handles too large to be numbers, even when every coordinate is finite", () => {
    expect(() => vectorNetworkFromSvgPath("M-1e308 0 C1e308 0 0 0 0 0")).toThrow(FormatError);
    expect(() => vectorNetworkFromSvgPath("M1e308 0 C-1e308 0 0 0 0 0")).toThrow(/too large/);
    // Large but representable: fine.
    const net = vectorNetworkFromSvgPath("M-1e300 0 C1e300 0 0 0 0 0");
    expect(vectorNetworkProblem(net)).toBeNull();
  });

  it("writes coordinates of any size without Infinity, and reads them back", () => {
    for (const d of ["M0 0 L1e303 0", "M-1.7976931348623157e308 5 L3e302 -4e305", "M1234567890.123456 0 L0 0", "M0.1234567 0 L0 0"]) {
      const net = vectorNetworkFromSvgPath(d);
      const out = svgPathFromVectorNetwork(net);
      expect(out).not.toMatch(/Infinity|NaN/);
      const back = vectorNetworkFromSvgPath(out);
      expect(svgPathFromVectorNetwork(back)).toBe(out);
      for (const [i, v] of net.vertices.entries()) {
        expect(back.vertices[i]!.x).toBeCloseTo(v.x, 6);
        if (Math.abs(v.x) >= 1e9) expect(back.vertices[i]!.x).toBe(v.x); // written in full
      }
    }
  });

  it("the prototype importer warns about a path its scaling overflows instead of failing the import", () => {
    const doc = {
      title: "Huge",
      artboard: { width: 500, height: 500, fill: "#ffffff" },
      objects: [
        { id: "a", type: "path", x: 0, y: 0, w: 200, h: 100, baseW: 1, baseH: 1, d: "M0 0 L1e303 0", fill: "#ff0000" },
        { id: "b", type: "path", x: 0, y: 0, w: 10, h: 10, d: "M0 0 L10 10 L0 10 Z", fill: "#00ff00" },
      ],
    };
    const { file, warnings } = importPrototypeJson(doc);
    expect(validateFile(file)).toEqual([]);
    const vectors = file.nodes.filter((n) => n.type === "VECTOR");
    expect(vectors).toHaveLength(2);
    expect(vectors[0]!.vectorNetwork).toBeUndefined();
    expect(vectors[1]!.vectorNetwork).toBeDefined();
    expect(warnings.join(" ")).toMatch(/Couldn't read the outline of 1 path shape/);
  });
});

describe("open subpaths are filled, as in SVG", () => {
  it("a path with an open subpath that encloses an area has no region, so every run fills as if closed", () => {
    const net = vectorNetworkFromSvgPath("M0 0 L90 0 L90 90 Z M110 110 L200 110 L200 200", { windingRule: "EVENODD" });
    expect(net.regions).toEqual([]);
    // The stroke is unchanged: no closing segment was added to the open subpath.
    expect(svgPathFromVectorNetwork(net)).toBe("M110 110 L200 110 L200 200 M0 0 L90 0 L90 90 Z");
    // Same as a path with no closed subpath at all.
    expect(vectorNetworkFromSvgPath("M110 110 L200 110 L200 200").regions).toEqual([]);
    // One open curve also encloses an area.
    expect(vectorNetworkFromSvgPath("M0 0 L10 0 L10 10 Z M20 20 C30 0 40 0 50 20").regions).toEqual([]);
  });

  it("open subpaths with no area (a single straight line) keep the closed subpaths' region and winding rule", () => {
    const net = vectorNetworkFromSvgPath("M0 0 L90 0 L90 90 Z M110 110 L200 110", { windingRule: "EVENODD" });
    expect(net.regions).toEqual([{ windingRule: "EVENODD", loops: [[0, 1, 2]] }]);
    expect(vectorNetworkFromSvgPath("M0 0 L90 0 L90 90 Z").regions).toHaveLength(1);
  });
});
