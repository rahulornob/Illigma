import { describe, expect, it } from "vitest";
import { Document } from "@illigma/core";
import { DOCUMENT_OPTIONS } from "../editor/layout";
import { guard, setLayoutProps } from "../editor/layout-props";
import { clampTo, fmt, LIMITS } from "./NumberField";

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
