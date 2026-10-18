// Shared by this package's tests. Not exported from the package.
import { Document } from "@illigma/core";
import type { IlligmaFile } from "@illigma/format";

export function sampleDoc(name = "Onboarding flow") {
  const doc = new Document(name);
  const page = doc.transact("Add page", (tx) => tx.addPage("Page 1"));
  const frame = doc.transact("Draw frame", (tx) => {
    const f = tx.create("FRAME", page, { name: "Sign up", width: 393, height: 852 });
    tx.create("TEXT", f, { characters: "Create account" });
    return f;
  });
  return { doc, page, frame };
}

/** A file with nodes in id order, for comparing documents. */
export function normalized(file: IlligmaFile): IlligmaFile {
  return { ...file, nodes: [...file.nodes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) };
}
