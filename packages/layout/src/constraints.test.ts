/**
 * Constraints for one layer. The first case ports the geometry case of the
 * old prototype's `tests/constraints.spec.js` (commit 8e3bd2f), which used
 * page coordinates: a child at 150 in a parent at 100 that moves to 60. Here
 * positions are relative to the parent, so the child starts at 50.
 */

import type { ConstraintType } from "@illigma/format";
import { describe, expect, it } from "vitest";
import { applyConstraints, constrainAxis } from "./constraints.js";

describe("constrainAxis", () => {
  it("all axis modes preserve their geometric invariant at growth and shrink (prototype case)", () => {
    for (const newSize of [200, 800]) {
      const delta = newSize - 400;
      // Prototype expectations, minus the parent's new start (60).
      expect(constrainAxis(50, 80, 400, newSize, "MIN")).toEqual([110 - 60, 80]);
      expect(constrainAxis(50, 80, 400, newSize, "MAX")).toEqual([110 + delta - 60, 80]);
      expect(constrainAxis(50, 80, 400, newSize, "CENTER")).toEqual([110 + delta / 2 - 60, 80]);
      expect(constrainAxis(50, 80, 400, newSize, "STRETCH")).toEqual([110 - 60, Math.max(1, 80 + delta)]);
      expect(constrainAxis(50, 80, 400, newSize, "SCALE")).toEqual([(50 * newSize) / 400, (80 * newSize) / 400]);
    }
  });

  it("defaults to MIN (left and top)", () => {
    expect(constrainAxis(50, 80, 400, 600)).toEqual([50, 80]);
  });

  it("keeps the gaps to both edges with MAX, CENTER and STRETCH", () => {
    const right = (start: number, size: number, parent: number) => parent - start - size;
    for (const parent of [100, 1000]) {
      const [s, w] = constrainAxis(30, 40, 200, parent, "MAX");
      expect(right(s, w, parent)).toBe(right(30, 40, 200));
      const [cs, cw] = constrainAxis(30, 40, 200, parent, "CENTER");
      expect(cs + cw / 2 - parent / 2).toBe(30 + 20 - 100);
      const [ss, sw] = constrainAxis(30, 40, 200, parent, "STRETCH");
      if (40 + parent - 200 >= 1) expect([ss, right(ss, sw, parent)]).toEqual([30, right(30, 40, 200)]);
    }
  });

  it("never stretches or scales below 1 px, or below a size that was already smaller", () => {
    expect(constrainAxis(0, 10, 100, 10, "STRETCH")).toEqual([0, 1]);
    expect(constrainAxis(0, 0, 100, 10, "STRETCH")).toEqual([0, 0]); // a line's zero height
    expect(constrainAxis(0, 10, 100, 0, "SCALE")).toEqual([0, 1]);
    expect(constrainAxis(5, 10, 0, 100, "SCALE")).toEqual([5, 10]); // a zero-size parent can't give a ratio
  });
});

describe("applyConstraints", () => {
  const child = (horizontal: ConstraintType, vertical: ConstraintType, rotation = 0) => ({
    x: 280,
    y: 220,
    width: 100,
    height: 50,
    rotation,
    constraints: { horizontal, vertical },
  });

  it("applies each axis independently", () => {
    expect(applyConstraints({ width: 400, height: 300 }, { width: 600, height: 400 }, child("MAX", "MIN"))).toEqual({ x: 480, y: 220, width: 100, height: 50 });
    expect(applyConstraints({ width: 400, height: 300 }, { width: 600, height: 400 }, child("STRETCH", "CENTER"))).toEqual({ x: 280, y: 270, width: 300, height: 50 });
    expect(applyConstraints({ width: 400, height: 300 }, { width: 800, height: 600 }, child("SCALE", "SCALE"))).toEqual({ x: 560, y: 440, width: 200, height: 100 });
  });

  it("treats a child without constraints as left and top", () => {
    expect(applyConstraints({ width: 400, height: 300 }, { width: 10, height: 10 }, { x: 5, y: 6, width: 7, height: 8, rotation: 0 })).toEqual({ x: 5, y: 6, width: 7, height: 8 });
  });

  it("stretches a quarter-turned child along its turned sides", () => {
    // 100 × 20 turned 90°: its bounding box runs from x - 20 to x, and y to y + 100.
    const box = applyConstraints({ width: 400, height: 300 }, { width: 400, height: 400 }, { x: 50, y: 10, width: 100, height: 20, rotation: 90, constraints: { horizontal: "MAX", vertical: "STRETCH" } });
    expect(box).toEqual({ x: 50, y: 10, width: 200, height: 20 });
  });

  it("moves a child at an odd angle by its bounding box centre and keeps its size", () => {
    const c = { x: 100, y: 100, width: 40, height: 40, rotation: 45, constraints: { horizontal: "STRETCH" as const, vertical: "MAX" as const } };
    const box = applyConstraints({ width: 400, height: 300 }, { width: 600, height: 400 }, c);
    expect(box.width).toBe(40);
    expect(box.x).toBeCloseTo(200);
    expect(box.y).toBeCloseTo(200);
  });
});
