import { describe, expect, it } from "vitest";
import { openWarnings } from "./open-warnings";

describe("openWarnings (QC round 7)", () => {
  it("says nothing when the whole file opened", () => {
    expect(openWarnings(undefined)).toBeNull();
    expect(openWarnings([])).toBeNull();
  });

  it("lists the first image problems and counts the rest, including the format's own summary line", () => {
    const w = openWarnings([
      "images/aa.png is damaged (its contents don't match its name), so it was not opened.",
      "Image 0123456789ab… is missing, so the layers that use it show no image.",
      "images/notes.txt is not an image file Illigma stores, so it was ignored.",
      "images/bb.png is damaged (its contents don't match its name), so it was not opened.",
      "…and 1,203 more problems with images.",
    ]);
    expect(w?.title).toBe("Some images couldn't be opened:");
    expect(w?.items).toHaveLength(3);
    expect(w?.items[0]).toMatch(/^images\/aa\.png is damaged/);
    expect(w?.more).toBe(1 + 1203);
  });

  it("names the file, not images, when other parts were left out", () => {
    const w = openWarnings(["pages/x.json is not listed in manifest.json, so it was not opened."]);
    expect(w).toEqual({ title: "Some parts of this file couldn't be opened:", items: ["pages/x.json is not listed in manifest.json, so it was not opened."], more: 0 });
  });
});
