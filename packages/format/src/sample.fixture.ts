/** A small valid file shared by the tests. Not part of the build. */

import { keysBetween } from "./fractional-index.js";
import { defaultNode, FORMAT_VERSION, type IlligmaFile, type Node } from "./schema.js";

export function sampleFile(): IlligmaFile {
  const [p1, p2] = keysBetween(null, null, 2) as [string, string];
  const page: Node = { ...defaultNode("PAGE", "page1", null, p1), name: "Onboarding" };
  const page2: Node = { ...defaultNode("PAGE", "page2", null, p2), name: "Components 🧩" };
  const frame: Node = {
    ...defaultNode("FRAME", "frame1", "page1", "a0"),
    name: "Sign up",
    width: 393,
    height: 852,
    fills: [{ type: "SOLID", visible: true, color: { r: 1, g: 1, b: 1, a: 1 } }],
  };
  const text: Node = {
    ...defaultNode("TEXT", "text1", "frame1", "a0"),
    characters: "Create account — ১২৩ 日本語",
    fontFamily: "Inter",
    fontSize: 28,
  };
  return {
    manifest: {
      format: "illigma",
      version: FORMAT_VERSION,
      fileId: "file1",
      name: "Onboarding flow",
      pages: [
        { id: "page1", name: "Onboarding" },
        { id: "page2", name: "Components 🧩" },
      ],
      created: "2026-10-18T00:00:00.000Z",
      app: "Illigma test",
    },
    nodes: [page, page2, frame, text],
  };
}
