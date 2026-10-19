import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import { FakeFileSystem } from "@illigma/host-web/testing";
import { existingNames, folderPermission, memoryExportFolderStore, writeErrorMessage, writeExportFiles, zipExportFiles, zipName, type OutputFile } from "./export-files";

const file = (filename: string, text = filename): OutputFile => ({ filename, mime: filename.endsWith(".svg") ? "image/svg+xml" : "image/png", bytes: new TextEncoder().encode(text) });

describe("writing exports into a folder", () => {
  it("writes files, making subfolders for “/” in names", async () => {
    const fs = new FakeFileSystem("export");
    const res = await writeExportFiles(fs.root, [file("Welcome.png"), file("Icons/Arrow@2x.png"), file("Icons/Small/Dot.svg")]);
    expect(res.failures).toEqual([]);
    expect(res.written.map((w) => w.path)).toEqual(["Welcome.png", "Icons/Arrow@2x.png", "Icons/Small/Dot.svg"]);
    expect(fs.paths()).toEqual(["Icons/Arrow@2x.png", "Icons/Small/Dot.svg", "Welcome.png"]);
    expect(fs.readText("Icons/Small/Dot.svg")).toBe("Icons/Small/Dot.svg");
  });

  it("never replaces a file: taken names get a number, compared without case", async () => {
    const fs = new FakeFileSystem("export");
    fs.writeText("Welcome.png", "old");
    fs.writeText("Icons/arrow.png", "old arrow");
    const progress: number[] = [];
    const res = await writeExportFiles(fs.root, [file("Welcome.png", "new"), file("Icons/Arrow.png", "new arrow"), file("Welcome.png", "newer")], { onProgress: (d) => progress.push(d) });
    expect(res.written.map((w) => w.path)).toEqual(["Welcome-1.png", "Icons/Arrow-1.png", "Welcome-2.png"]);
    expect(fs.readText("Welcome.png")).toBe("old");
    expect(fs.readText("Icons/arrow.png")).toBe("old arrow");
    expect(fs.readText("Welcome-2.png")).toBe("newer");
    expect(progress).toEqual([1, 2, 3]);
  });

  it("a file never takes a folder's name", async () => {
    const fs = new FakeFileSystem("export");
    fs.writeText("Logo.png/readme.txt", "a folder named like a file");
    const res = await writeExportFiles(fs.root, [file("Logo.png")]);
    expect(res.written[0]?.path).toBe("Logo-1.png");
    expect((await existingNames(fs.root, ["Logo.png"])).sort()).toEqual(["Logo-1.png", "Logo.png/"]);
  });

  it("replaces files with the same name only when asked", async () => {
    const fs = new FakeFileSystem("export");
    fs.writeText("Welcome.png", "old");
    const res = await writeExportFiles(fs.root, [file("Welcome.png", "new")], { replace: true });
    expect(res.written[0]?.path).toBe("Welcome.png");
    expect(fs.readText("Welcome.png")).toBe("new");
  });

  it("one failed file doesn't stop the others, says why in plain words, and leaves nothing half-written", async () => {
    const fs = new FakeFileSystem("export");
    fs.failWhen = (op) => (op.kind === "close" && op.path === "B.png" ? new DOMException("full", "QuotaExceededError") : false);
    const res = await writeExportFiles(fs.root, [file("A.png"), file("B.png"), file("C.png")]);
    expect(res.written.map((w) => w.path)).toEqual(["A.png", "C.png"]);
    expect(res.failures).toEqual([{ filename: "B.png", message: "the disk is full" }]);
    expect(fs.exists("B.png") ? fs.readText("B.png") : "").toBe("");
  });

  it("a folder it can't read fails every file with the reason", async () => {
    const fs = new FakeFileSystem("export");
    fs.failWhen = (op) => (op.kind === "list" ? new DOMException("no", "NotAllowedError") : false);
    const res = await writeExportFiles(fs.root, [file("A.png"), file("B.png")]);
    expect(res.written).toEqual([]);
    expect(res.failures.map((f) => f.message)).toEqual(["Illigma no longer has permission to the “export” folder", "Illigma no longer has permission to the “export” folder"]);
  });

  it("lists only the folders the files write into", async () => {
    const fs = new FakeFileSystem("export");
    fs.writeText("A.png", "");
    fs.writeText("Icons/B.png", "");
    fs.writeText("Other/C.png", "");
    expect((await existingNames(fs.root, ["Icons/X.png"])).sort()).toEqual(["A.png", "Icons/", "Icons/B.png", "Other/"]);
    expect(await existingNames(fs.root, ["Missing/X.png"])).toEqual(["A.png", "Icons/", "Other/"]);
  });

  it("asks for permission again only when allowed to", async () => {
    const fs = new FakeFileSystem("export");
    fs.permission = "prompt";
    expect(await folderPermission(fs.root, false)).toBe("prompt");
    fs.permission = "granted";
    expect(await folderPermission(fs.root, true)).toBe("granted");
  });

  it("remembers a folder per design file", async () => {
    const store = memoryExportFolderStore();
    const fs = new FakeFileSystem("export");
    await store.set("file-1", fs.root);
    expect(await store.get("file-1")).toBe(fs.root);
    expect(await store.get("file-2")).toBeUndefined();
  });

  it("explains other write errors plainly", () => {
    expect(writeErrorMessage(new DOMException("x", "NotFoundError"), "export")).toBe("the “export” folder was moved or deleted");
    expect(writeErrorMessage(new Error("Something odd."), "export")).toBe("Something odd");
  });
});

describe("downloads", () => {
  it("several files zip with their folders, names made unique", () => {
    const { bytes, paths } = zipExportFiles([file("A.png"), file("Icons/B.svg"), file("a.png")]);
    expect(paths).toEqual(["A.png", "Icons/B.svg", "a-1.png"]);
    const entries = unzipSync(bytes);
    expect(Object.keys(entries).sort()).toEqual(["A.png", "Icons/B.svg", "a-1.png"]);
    expect(new TextDecoder().decode(entries["Icons/B.svg"])).toBe("Icons/B.svg");
  });

  it("names the zip safely", () => {
    expect(zipName("Onboarding flow")).toBe("Onboarding flow.zip");
    expect(zipName("a/b:c. ")).toBe("a_b_c.zip");
    expect(zipName("")).toBe("Export.zip");
  });
});
