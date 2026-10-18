// QC round 7: an open subpath counts as enclosing an area only when it does; even-odd holes survive one that does.
import { describe, expect, it } from "vitest";
import { vectorNetworkFromSvgPath, vectorNetworkProblem } from "./vector.js";

/** A 100 × 100 square with a 50 × 50 hole: two closed subpaths, eight segments. */
const HOLE = "M0 0 L100 0 L100 100 L0 100 Z M25 25 L75 25 L75 75 L25 75 Z";
const HOLE_REGION = [{ windingRule: "EVENODD", loops: [[0, 1, 2, 3], [4, 5, 6, 7]] }];

describe("open subpaths with no area", () => {
  it("straight segments along one line keep the even-odd region (the hole stays open)", () => {
    expect(vectorNetworkFromSvgPath(`${HOLE} M0 120 h10 h10`, { windingRule: "EVENODD" }).regions).toEqual(HOLE_REGION);
    // Going back over itself encloses nothing either.
    expect(vectorNetworkFromSvgPath(`${HOLE} M0 120 h20 h-10`, { windingRule: "EVENODD" }).regions).toEqual(HOLE_REGION);
    expect(vectorNetworkFromSvgPath(`${HOLE} M0 120 L10 130 L20 120 L10 130`, { windingRule: "EVENODD" }).regions).toEqual(HOLE_REGION);
    // A curve whose control points are on its line, and one at huge coordinates.
    expect(vectorNetworkFromSvgPath(`${HOLE} M0 120 C5 120 15 120 20 120`, { windingRule: "EVENODD" }).regions).toEqual(HOLE_REGION);
    expect(vectorNetworkFromSvgPath(`${HOLE} M1e15 1e15 L2e15 2e15 L3e15 3e15`, { windingRule: "EVENODD" }).regions).toEqual(HOLE_REGION);
  });

  it("an open subpath that does enclose an area still counts, straight or curved", () => {
    expect(vectorNetworkFromSvgPath("M0 0 L10 0 L10 10 Z M20 20 L30 20 L30 30").regions).toEqual([]);
    expect(vectorNetworkFromSvgPath("M0 0 L10 0 L10 10 Z M20 20 C30 0 40 0 50 20").regions).toEqual([]);
    // Thin but real.
    expect(vectorNetworkFromSvgPath("M0 0 L10 0 L10 10 Z M20 20 L1000020 20 L1000020 20.001").regions).toEqual([]);
  });
});

describe("even-odd with an open subpath that encloses an area", () => {
  it("overlapping subpaths keep their even-odd region, so the hole stays open (the open subpath goes unfilled)", () => {
    const net = vectorNetworkFromSvgPath(`${HOLE} M120 0 L160 0 L160 40`, { windingRule: "EVENODD" });
    // The open triangle is outside the square: the boxes that overlap are the square and its hole.
    expect(net.regions).toEqual(HOLE_REGION);
    expect(vectorNetworkProblem(net)).toBeNull();
  });

  it("subpaths that don't overlap fill alike under both rules: no region, every run fills as if closed", () => {
    expect(vectorNetworkFromSvgPath("M0 0 L90 0 L90 90 Z M110 110 L200 110 L200 200", { windingRule: "EVENODD" }).regions).toEqual([]);
  });

  it("nonzero: no region, every run fills as if closed (exactly as SVG)", () => {
    expect(vectorNetworkFromSvgPath(`${HOLE} M120 0 L160 0 L160 40`).regions).toEqual([]);
  });
});
