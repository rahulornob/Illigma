import { describe, expect, it } from "vitest";
import { Document } from "@illigma/core";
import { DOCUMENT_OPTIONS } from "../editor/layout";
import { guard, setLayoutProps } from "../editor/layout-props";
import { clampTo, fmt, LIMITS, parseTyped, typedResult } from "./NumberField";

describe("number fields (QC round 6)", () => {
  it("keep typed values in range", () => {
    expect(clampTo(1e308, 0, LIMITS.spacing)).toBe(100_000);
    expect(clampTo(-1e308, -LIMITS.position, LIMITS.position)).toBe(-1_000_000);
    expect(clampTo(5, undefined, undefined)).toBe(5);
    expect(fmt(clampTo(1e308, 0.01, LIMITS.size))).toBe("1000000");
  });

  it("an edit the document refuses is reported, not thrown, and changes nothing", () => {
    const doc = new Document("T", DOCUMENT_OPTIONS);
    const page = doc.transact("p", (tx) => tx.addPage("P"));
    const frame = doc.transact("f", (tx) => tx.create("FRAME", page, { width: 100, height: 100, layoutMode: "VERTICAL" }));
    const before = doc.toFile();
    const errors: unknown[] = [];
    // Past the largest number: layout's sums would not be finite, and the document refuses.
    expect(guard((e) => errors.push(e), () => setLayoutProps(doc, [frame], { paddingLeft: 1e308, paddingRight: 1e308 }))).toBeUndefined();
    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).name).toBe("DocumentError");
    expect(doc.toFile()).toEqual(before);
    expect(doc.undoLabel).toBe("f");
    // Without a place to report it, it throws (tests and callers that handle it themselves).
    expect(() => guard(undefined, () => setLayoutProps(doc, [frame], { paddingLeft: 1e308, paddingRight: 1e308 }))).toThrow();
  });
});

describe("typed values (QC round 8)", () => {
  const set = (t: string) => {
    const p = parseTyped(t);
    return p?.kind === "set" ? p.value : p;
  };
  it("take numbers and simple maths, never a prefix of something else", () => {
    expect(set("12")).toBe(12);
    expect(set(" 1,5 ")).toBe(1.5);
    expect(set("12+12")).toBe(24);
    expect(set("3*4-2")).toBe(10);
    expect(set("(2+3)×4")).toBe(20);
    expect(set("10÷4")).toBe(2.5);
    expect(set("2x3")).toBe(6);
    expect(set("-5")).toBe(-5);
    expect(set("24px")).toBe(24);
    expect(set("120%")).toBe(120);
    for (const bad of ["12abc", "abc", "12+", "1..2", "(1+2", "1/0", "1e999", "2x"]) expect(parseTyped(bad)).toBeNull();
  });

  it("a leading + * or / is relative to each layer's value (Mixed works)", () => {
    const plus = parseTyped("+2");
    expect(plus).toEqual({ kind: "relative", op: "+", value: 2 });
    expect([10, 20].map((c) => typedResult(plus!, c))).toEqual([12, 22]);
    expect(typedResult(parseTyped("*2")!, 7)).toBe(14);
    expect(typedResult(parseTyped("/4")!, 10)).toBe(2.5);
    expect(typedResult(parseTyped("+1+1")!, 1)).toBe(3);
  });
});
