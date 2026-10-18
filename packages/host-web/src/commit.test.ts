// Regression tests for the multi-file save (QC review, critical): a save cut
// short anywhere must read back as the complete old package or the complete
// new one, never a mix.
import { describe, expect, it } from "vitest";
import { Document } from "@illigma/core";
import { readPackage, writePackage, type FileTree } from "@illigma/format";
import { COMMIT_FILE, folderBackend, opfsBackend, TEMP_SUFFIX } from "./index.js";
import { FakeFileSystem, type FakeFsOp } from "./testing/fake-fs.js";

/** Two pages; R sits on the page whose file is written first, G on the other. */
function twoPages() {
  for (;;) {
    const doc = new Document("T");
    const p1 = doc.transact("p", (tx) => tx.addPage("P1"));
    const p2 = doc.transact("p", (tx) => tx.addPage("P2"));
    if (!(p1 < p2)) continue; // page files are written in path order
    const g = doc.transact("g", (tx) => tx.create("FRAME", p2, { name: "G", width: 100, height: 100 }));
    const r = doc.transact("r", (tx) => tx.create("RECTANGLE", p1, { name: "R" }));
    return { doc, p1, p2, g, r };
  }
}

/** A saved package plus the next version of it: R moved across pages, one page added, then the other removed. */
async function scenario() {
  const fs = new FakeFileSystem();
  const { doc, p1, g, r } = twoPages();
  const backend = opfsBackend(doc.fileId, "T", fs.root);
  await backend.write(writePackage(doc.toFile()));
  const oldTree = await backend.read();
  doc.transact("move", (tx) => tx.move(r, g));
  doc.transact("page", (tx) => tx.addPage("P3"));
  doc.transact("rename", (tx) => tx.set(p1, "name", "First"));
  const newTree = writePackage(doc.toFile());
  return { fs, doc, backend, oldTree, newTree, r };
}

const ops = (fs: FakeFileSystem) => fs.log.length;

/** How many filesystem calls a clean save makes. */
async function countSaveOps(): Promise<number> {
  const { fs, backend, newTree } = await scenario();
  const start = ops(fs);
  await backend.write(newTree);
  return ops(fs) - start;
}

function sameTree(a: FileTree, b: FileTree): boolean {
  return a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);
}

describe("multi-file save is all or nothing", () => {
  it("the moved node is never lost when the destination page fails to commit (proof B)", async () => {
    const { fs, doc, backend, r } = await scenario();
    const g = doc.get(r)!.parentId!;
    const destPage = doc.pages().find((p) => doc.subtree(p.id).some((n) => n.id === g))!.id;
    fs.failWhen = (op) => op.kind === "close" && op.path === `files/${doc.fileId}/pages/${destPage}.json`;
    await expect(backend.write(writePackage(doc.toFile()))).rejects.toThrow();
    fs.failWhen = null;
    const reopened = Document.fromFile(readPackage(await opfsBackend(doc.fileId, "T", fs.root).read()));
    expect(reopened.has(r)).toBe(true);
    expect(reopened.get(r)!.parentId).toBe(g);
  });

  it("a failure at any single step reads back as the old or the new package", async () => {
    const total = await countSaveOps();
    expect(total).toBeGreaterThan(10);
    const seen = new Set<string>();
    for (let k = 0; k < total; k++) {
      const { fs, doc, backend, oldTree, newTree } = await scenario();
      const start = ops(fs);
      fs.failWhen = () => ops(fs) - start === k + 1; // only call k fails
      await backend.write(newTree).catch(() => {});
      fs.failWhen = null;

      const read = await opfsBackend(doc.fileId, "T", fs.root).read();
      const which = sameTree(read, newTree) ? "new" : sameTree(read, oldTree) ? "old" : "torn";
      expect(which, `failure at call ${k}`).not.toBe("torn");
      seen.add(which);
      readPackage(read); // opens
      // The next save works, and leaves nothing behind.
      await backend.write(newTree);
      expect(sameTree(await backend.read(), newTree)).toBe(true);
      expect(fs.paths().filter((p) => p.endsWith(TEMP_SUFFIX) || p.endsWith(COMMIT_FILE))).toEqual([]);
    }
    expect(seen).toEqual(new Set(["old", "new"]));
  });

  it("the tab closing at any step (nothing after it runs) reads back as the old or the new package", async () => {
    const total = await countSaveOps();
    for (let k = 0; k < total; k++) {
      const { fs, doc, backend, oldTree, newTree } = await scenario();
      const start = ops(fs);
      fs.failWhen = () => ops(fs) - start > k; // call k and everything after it never happen
      await backend.write(newTree).catch(() => {});
      fs.failWhen = null;

      const fresh = opfsBackend(doc.fileId, "T", fs.root);
      const read = await fresh.read();
      expect(sameTree(read, newTree) || sameTree(read, oldTree), `killed at call ${k}`).toBe(true);
      // The read finished or dropped the cut-short save on disk; reading again agrees and nothing is left over.
      expect(sameTree(await fresh.read(), read)).toBe(true);
      expect(fs.paths().filter((p) => p.endsWith(TEMP_SUFFIX) || p.endsWith(COMMIT_FILE))).toEqual([]);
    }
  });

  it("a read that can't repair (another tab, or read-only) still sees the finished save", async () => {
    const { fs, doc, backend, newTree } = await scenario();
    const start = ops(fs);
    // Stop right after the commit marker is written.
    let marked = false;
    fs.failWhen = (op: FakeFsOp) => {
      if (marked) return true;
      if (op.kind === "close" && op.path.endsWith(COMMIT_FILE)) marked = true;
      return false;
    };
    await backend.write(newTree).catch(() => {});
    fs.failWhen = null;
    expect(ops(fs) - start).toBeGreaterThan(0);
    const before = fs.paths();
    const read = await opfsBackend(doc.fileId, "T", fs.root).read({ repair: false });
    expect(sameTree(read, newTree)).toBe(true);
    expect(fs.paths()).toEqual(before); // nothing touched
  });

  it("a torn commit marker means the save never started", async () => {
    const { fs, doc, backend, oldTree } = await scenario();
    fs.writeText(`files/${doc.fileId}/${COMMIT_FILE}`, '{"files":["manif');
    fs.writeText(`files/${doc.fileId}/manifest.json${TEMP_SUFFIX}`, "{half");
    expect(sameTree(await backend.read(), oldTree)).toBe(true);
    expect(fs.exists(`files/${doc.fileId}/${COMMIT_FILE}`)).toBe(false);
  });

  it("records the save id with the package", async () => {
    const { fs, doc, backend, newTree } = await scenario();
    await backend.write(newTree, { saveId: "abc" });
    expect(backend.saveId).toBe("abc");
    const fresh = opfsBackend(doc.fileId, "T", fs.root);
    await fresh.read();
    expect(fresh.saveId).toBe("abc");
  });

  it("refuses package paths that clash with its bookkeeping files", async () => {
    const { backend } = await scenario();
    await expect(backend.write(new Map([[COMMIT_FILE, "{}"]]))).rejects.toThrow(/reserved/);
    await expect(backend.write(new Map([[`pages/a.json${TEMP_SUFFIX}`, "{}"]]))).rejects.toThrow(/reserved/);
  });
});

describe("folder permission", () => {
  it("requestAccess asks for readwrite and reports the answer", async () => {
    const fs = new FakeFileSystem();
    const dir = await fs.root.getDirectoryHandle("A.illigma", { create: true });
    const backend = folderBackend(dir);
    const asked: unknown[] = [];
    const handle = dir as unknown as { requestPermission(d: unknown): Promise<string> };
    const original = handle.requestPermission.bind(handle);
    handle.requestPermission = async (d) => {
      asked.push(d);
      return original(d);
    };
    fs.permission = "prompt";
    expect(await backend.requestAccess!()).toBe(false);
    fs.permission = "granted";
    expect(await backend.requestAccess!()).toBe(true);
    expect(asked).toEqual([{ mode: "readwrite" }, { mode: "readwrite" }]);
    await backend.write(new Map([["manifest.json", "{}"]]));
  });
});
