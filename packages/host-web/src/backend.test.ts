import { afterEach, describe, expect, it, vi } from "vitest";
import { Document } from "@illigma/core";
import { readPackage, writePackage } from "@illigma/format";
import { COMMIT_FILE, folderBackend, opfsBackend, pickFolderBackend, REV_FILE, supportsFolderAccess, TEMP_SUFFIX } from "./index.js";
import { FakeFileSystem } from "./testing/fake-fs.js";
import { normalized, sampleDoc } from "./test-helpers.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("opfsBackend", () => {
  it("round-trips a document through OPFS", async () => {
    const fs = new FakeFileSystem();
    const { doc } = sampleDoc();
    const backend = opfsBackend(doc.fileId, doc.name, fs.root);
    expect(backend.label).toBe("Browser storage");
    expect(backend.kind).toBe("opfs");

    await backend.write(writePackage(doc.toFile()));
    expect(fs.paths()).toEqual([`files/${doc.fileId}/${REV_FILE}`, `files/${doc.fileId}/manifest.json`, `files/${doc.fileId}/pages/${doc.pages()[0]!.id}.json`]);

    const reopened = Document.fromFile(readPackage(await opfsBackend(doc.fileId, doc.name, fs.root).read()));
    expect(normalized(reopened.toFile())).toEqual(normalized(doc.toFile()));
  });

  it("reads an empty tree for a file never saved", async () => {
    const fs = new FakeFileSystem();
    expect((await opfsBackend("nothing", "New", fs.root).read()).size).toBe(0);
  });

  it("refuses unsafe file ids", () => {
    expect(() => opfsBackend("../x", "Bad")).toThrow();
    expect(() => opfsBackend("a/b", "Bad")).toThrow();
  });

  it("removes page files that are no longer in the package", async () => {
    const fs = new FakeFileSystem();
    const { doc } = sampleDoc();
    const second = doc.transact("Add page", (tx) => tx.addPage("Page 2"));
    const backend = opfsBackend(doc.fileId, doc.name, fs.root);
    await backend.write(writePackage(doc.toFile()));
    expect(fs.exists(`files/${doc.fileId}/pages/${second}.json`)).toBe(true);

    doc.transact("Delete page", (tx) => tx.delete(second));
    await backend.write(writePackage(doc.toFile()));
    expect(fs.exists(`files/${doc.fileId}/pages/${second}.json`)).toBe(false);
    expect(readPackage(await backend.read()).manifest.pages).toHaveLength(1);
  });
});

describe("atomic writes", () => {
  async function savedPackage() {
    const fs = new FakeFileSystem();
    const { doc, frame } = sampleDoc();
    const backend = opfsBackend(doc.fileId, doc.name, fs.root);
    await backend.write(writePackage(doc.toFile()));
    const before = await backend.read();
    doc.transact("Rename", (tx) => tx.set(frame, "name", "Welcome"));
    doc.transact("Add page", (tx) => tx.addPage("Page 2"));
    return { fs, doc, backend, before };
  }

  it("keeps the old package intact when a write fails part-way through", async () => {
    const { fs, doc, backend, before } = await savedPackage();
    let writes = 0;
    fs.failWhen = (op) => op.kind === "write" && ++writes === 2; // the second file fails mid-write
    await expect(backend.write(writePackage(doc.toFile()))).rejects.toThrow(/Simulated failure/);
    fs.failWhen = null;

    expect(await backend.read()).toEqual(before);
    expect(fs.paths().filter((p) => p.endsWith(TEMP_SUFFIX))).toEqual([]);
    expect(readPackage(await backend.read()).manifest.pages).toHaveLength(1);
  });

  it("keeps the old package intact when the disk fills up on close", async () => {
    const { fs, doc, backend, before } = await savedPackage();
    fs.failWhen = (op) => (op.kind === "close" && op.path.endsWith(`manifest.json${TEMP_SUFFIX}`) ? new DOMException("Full", "QuotaExceededError") : false);
    await expect(backend.write(writePackage(doc.toFile()))).rejects.toThrow("Full");
    fs.failWhen = null;
    expect(await backend.read()).toEqual(before);
  });

  it("stages every file before replacing any, and writes the manifest last", async () => {
    const { fs, doc, backend } = await savedPackage();
    fs.log.length = 0;
    await backend.write(writePackage(doc.toFile()));
    const closes = fs.log.filter((op) => op.kind === "close").map((op) => op.path.replace(`files/${doc.fileId}/`, ""));
    const firstReal = closes.findIndex((p) => !p.endsWith(TEMP_SUFFIX));
    expect(closes.slice(0, firstReal).every((p) => p.endsWith(TEMP_SUFFIX))).toBe(true);
    expect(closes.slice(firstReal).every((p) => !p.endsWith(TEMP_SUFFIX))).toBe(true);
    expect(closes.at(-1)).toBe("manifest.json");
  });

  it("ignores staged copies left behind when reading", async () => {
    const { fs, doc, backend, before } = await savedPackage();
    fs.writeText(`files/${doc.fileId}/manifest.json${TEMP_SUFFIX}`, "{half");
    expect(await backend.read()).toEqual(before);
  });
});

describe("folderBackend", () => {
  it("reads and writes a package folder, skipping hidden files", async () => {
    const fs = new FakeFileSystem();
    const dir = await fs.root.getDirectoryHandle("Onboarding flow.illigma", { create: true });
    const backend = folderBackend(dir);
    expect(backend.label).toBe("Onboarding flow.illigma");
    expect(backend.kind).toBe("folder");

    const { doc } = sampleDoc();
    const tree = writePackage(doc.toFile());
    await backend.write(tree);
    fs.writeText("Onboarding flow.illigma/.DS_Store", "x");
    expect(await backend.read()).toEqual(tree);
  });

  it("reports lost permission plainly", async () => {
    const fs = new FakeFileSystem();
    const dir = await fs.root.getDirectoryHandle("A.illigma", { create: true });
    fs.permission = "prompt";
    await expect(folderBackend(dir).write(new Map([["manifest.json", "{}"]]))).rejects.toMatchObject({ name: "NotAllowedError" });
  });

  it("picks a folder when the browser supports it", async () => {
    expect(supportsFolderAccess()).toBe(false);
    expect(await pickFolderBackend()).toBeNull();

    const fs = new FakeFileSystem();
    const dir = await fs.root.getDirectoryHandle("Picked.illigma", { create: true });
    const picker = vi.fn(async () => dir);
    vi.stubGlobal("showDirectoryPicker", picker);
    expect(supportsFolderAccess()).toBe(true);
    expect((await pickFolderBackend())?.label).toBe("Picked.illigma");
    expect(picker).toHaveBeenCalledWith({ mode: "readwrite" });

    vi.stubGlobal("showDirectoryPicker", async () => {
      throw new DOMException("cancelled", "AbortError");
    });
    expect(await pickFolderBackend()).toBeNull();
  });
});
