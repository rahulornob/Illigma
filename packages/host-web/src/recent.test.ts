import { afterEach, describe, expect, it, vi } from "vitest";
import { writePackage } from "@illigma/format";
import { listRecentFiles, opfsBackend } from "./index.js";
import { FakeFileSystem, installFakeOpfs } from "./testing/fake-fs.js";
import { sampleDoc } from "./test-helpers.js";

afterEach(() => {
  vi.useRealTimers();
});

async function save(fs: FakeFileSystem, name: string, at: string) {
  vi.setSystemTime(new Date(at));
  const { doc } = sampleDoc(name);
  await opfsBackend(doc.fileId, doc.name, fs.root).write(writePackage(doc.toFile()));
  return doc.fileId;
}

describe("listRecentFiles", () => {
  it("lists OPFS files newest first, skipping folders without a manifest", async () => {
    vi.useFakeTimers();
    const fs = new FakeFileSystem();
    const a = await save(fs, "Alpha", "2026-10-01T00:00:00Z");
    const b = await save(fs, "Beta", "2026-10-03T00:00:00Z");
    const c = await save(fs, "Gamma", "2026-10-02T00:00:00Z");
    fs.writeText("files/broken/pages/x.json", "[]");
    fs.writeText("files/garbled/manifest.json", "{nope");

    expect(await listRecentFiles(fs.root)).toEqual([
      { fileId: b, name: "Beta", updatedAt: Date.parse("2026-10-03T00:00:00Z") },
      { fileId: c, name: "Gamma", updatedAt: Date.parse("2026-10-02T00:00:00Z") },
      { fileId: a, name: "Alpha", updatedAt: Date.parse("2026-10-01T00:00:00Z") },
    ]);
  });

  it("is empty before anything is saved, and uses navigator.storage by default", async () => {
    const fs = new FakeFileSystem();
    const restore = installFakeOpfs(fs);
    try {
      expect(await listRecentFiles()).toEqual([]);
      const { doc } = sampleDoc("Default root");
      await opfsBackend(doc.fileId, doc.name).write(writePackage(doc.toFile()));
      expect((await listRecentFiles()).map((f) => f.name)).toEqual(["Default root"]);
    } finally {
      restore();
    }
  });
});
