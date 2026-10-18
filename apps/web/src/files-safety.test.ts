// Regression tests from QC review 3 for the web app's file actions: Open
// Folder on someone's project, recovered edits that collide with new ones,
// changes on disk, and copies that shared a file id.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Document } from "@illigma/core";
import { readPackage, readZip, writePackage } from "@illigma/format";
import { Autosaver, folderBackend, memoryLocationStore, NOT_A_PACKAGE_MESSAGE, opfsBackend, RecoveryJournal } from "@illigma/host-web";
import { FakeFileSystem, installFakeOpfs } from "@illigma/host-web/testing";
import {
  closeSession,
  conflictName,
  keepRecovered,
  openCompareSnapshot,
  openFolder,
  openStoredFile,
  reloadFromDisk,
  saveConflictCopy,
  saveCopyElsewhere,
  skippedEditsJson,
  snapshotDiskVersion,
  type Session,
} from "./files";

let fs: FakeFileSystem;
let restore: () => void;

beforeEach(() => {
  fs = new FakeFileSystem();
  restore = installFakeOpfs(fs);
});

afterEach(() => {
  restore();
  vi.unstubAllGlobals();
});

const pickFolder = (dir: FileSystemDirectoryHandle) => vi.stubGlobal("showDirectoryPicker", vi.fn(async () => dir));
const fileIdIn = (path: string) => (JSON.parse(fs.readText(`${path}/manifest.json`)!) as { fileId: string }).fileId;

describe("Open Folder", () => {
  it("refuses a folder that isn't an Illigma file and leaves every file in it (QC proof: Next.js folder)", async () => {
    fs.writeText("my-site/package.json", "{}");
    fs.writeText("my-site/pages/index.tsx", "export default () => <h1/>");
    fs.writeText("my-site/pages/about.tsx", "...");
    const before = fs.paths();
    pickFolder(await fs.root.getDirectoryHandle("my-site"));
    await expect(openFolder(memoryLocationStore())).rejects.toThrow(NOT_A_PACKAGE_MESSAGE);
    expect(NOT_A_PACKAGE_MESSAGE).toBe("This folder isn't an Illigma file. Choose an empty folder or a .illigma folder.");
    expect(fs.paths()).toEqual(before);
  });

  it("starts a new file in an empty folder or a .illigma folder", async () => {
    pickFolder(await fs.root.getDirectoryHandle("Fresh", { create: true }));
    const s = await openFolder(memoryLocationStore());
    expect(s!.doc.name).toBe("Fresh");
    expect(fs.exists("Fresh/manifest.json")).toBe(true);
    closeSession(s!);

    pickFolder(await fs.root.getDirectoryHandle("Board.illigma", { create: true }));
    const t = await openFolder(memoryLocationStore());
    expect(t!.doc.name).toBe("Board");
    closeSession(t!);
  });

  it("gives a duplicated package (Finder Duplicate) its own file id and saves it", async () => {
    const store = memoryLocationStore();
    const doc = new Document("Dup");
    doc.transact("p", (tx) => tx.addPage("P"));
    await folderBackend(await fs.root.getDirectoryHandle("Dup.illigma", { create: true })).write(writePackage(doc.toFile()));
    await folderBackend(await fs.root.getDirectoryHandle("Dup copy.illigma", { create: true })).write(writePackage(doc.toFile()));

    pickFolder(await fs.root.getDirectoryHandle("Dup.illigma"));
    const original = await openFolder(store);
    expect(original!.doc.fileId).toBe(doc.fileId);

    pickFolder(await fs.root.getDirectoryHandle("Dup copy.illigma"));
    const copy = await openFolder(store);
    expect(copy!.doc.fileId).not.toBe(doc.fileId);
    expect(fileIdIn("Dup copy.illigma")).toBe(copy!.doc.fileId); // persisted
    expect(fileIdIn("Dup.illigma")).toBe(doc.fileId);

    // Reopening the copy keeps its new id.
    closeSession(copy!);
    pickFolder(await fs.root.getDirectoryHandle("Dup copy.illigma"));
    expect((await openFolder(store))!.doc.fileId).toBe(copy!.doc.fileId);
  });
});

describe("Save a copy elsewhere", () => {
  it("gives the copy a new file id (folder and download)", async () => {
    const doc = new Document("Orig");
    doc.transact("p", (tx) => tx.addPage("P"));
    pickFolder(await fs.root.getDirectoryHandle("Backups", { create: true }));
    expect(await saveCopyElsewhere(doc)).toBe("Backups/Orig.illigma");
    const copyId = fileIdIn("Backups/Orig.illigma");
    expect(copyId).not.toBe(doc.fileId);

    vi.unstubAllGlobals();
    let blob: Blob | undefined;
    vi.stubGlobal("URL", { createObjectURL: (b: Blob) => ((blob = b), "blob:x"), revokeObjectURL: () => {} });
    vi.stubGlobal("document", { createElement: () => ({ click() {} }) });
    expect(await saveCopyElsewhere(doc)).toBe("Orig.illigma");
    const zipped = readPackage(readZip(new Uint8Array(await blob!.arrayBuffer())));
    expect(zipped.manifest.fileId).not.toBe(doc.fileId);
  });
});

describe("Keep with a sibling drawn after reopening (QC proof)", () => {
  async function collide() {
    const doc = new Document("T");
    const page = doc.transact("p", (tx) => tx.addPage("P1"));
    const b = opfsBackend(doc.fileId, "T", fs.root);
    await b.write(writePackage(doc.toFile()));
    const j = new RecoveryJournal(doc.fileId, fs.root);
    await j.load(b.saveId);
    j.attach(doc);
    doc.transact("draw", (tx) => tx.create("RECTANGLE", page, { name: "Lost in crash" }));
    await j.flush(); // then the tab dies

    const b2 = opfsBackend(doc.fileId, "T", fs.root);
    const d2 = Document.fromFile(readPackage(await b2.read()));
    const j2 = new RecoveryJournal(doc.fileId, fs.root);
    await j2.load(b2.saveId);
    const recovered = await j2.recovered();
    j2.attach(d2);
    const saver = new Autosaver(d2, b2, { journal: j2, delayMs: 1e9 });
    d2.transact("draw", (tx) => tx.create("ELLIPSE", page, { name: "Drawn after reopen" })); // banner still undecided
    await saver.flushNow();
    saver.dispose();
    const s: Session = { doc: d2, backend: b2, journal: j2, recovered, lock: { release() {} } };
    return { doc, page, s };
  }

  it("keeps the recovered shape, placed right after the one that took its position", async () => {
    const { doc, page, s } = await collide();
    const kept = await keepRecovered(s);
    expect(kept.notice).toBeUndefined();
    expect(kept.doc.children(page).map((n) => n.name)).toEqual(["Drawn after reopen", "Lost in crash"]);
    const reopened = Document.fromFile(readPackage(await opfsBackend(doc.fileId, "T", fs.root).read()));
    expect(reopened.children(page).map((n) => n.name)).toEqual(["Drawn after reopen", "Lost in crash"]);
    const j3 = new RecoveryJournal(doc.fileId, fs.root);
    await j3.load(opfsBackend(doc.fileId, "T", fs.root).saveId);
    expect(await j3.recovered()).toEqual([]);
  });

  it("an edit that still can't apply stays in the journal and can be exported", async () => {
    const { doc, page, s } = await collide();
    // A second recovered edit renames a layer that is gone now.
    const extra = [{ op: "set", id: "gone-layer", key: "name", value: "X", prev: "Y" }] as never;
    const kept = await keepRecovered({ ...s, recovered: [...s.recovered, extra] });
    expect(kept.notice).toBe("1 recovered edit no longer fits the file and was skipped. It stays in the recovery journal.");
    expect(kept.skipped).toEqual([extra]);
    expect(JSON.parse(skippedEditsJson(kept))).toMatchObject({ file: "T", fileId: doc.fileId, edits: [extra] });
    expect(kept.doc.children(page)).toHaveLength(2);
  });
});

describe("changes on disk", () => {
  async function open() {
    const doc = new Document("Disk");
    const page = doc.transact("p", (tx) => tx.addPage("P"));
    await opfsBackend(doc.fileId, "Disk").write(writePackage(doc.toFile()));
    const s = await openStoredFile(doc.fileId, "Disk");
    // Another writer (e.g. another browser profile on a synced folder) saves a new version.
    const other = opfsBackend(doc.fileId, "Disk");
    const theirs = Document.fromFile(readPackage(await other.read()));
    theirs.transact("r", (tx) => tx.set(page, "name", "Theirs"));
    await other.write(writePackage(theirs.toFile()));
    return { s, page };
  }

  it("reloads the disk version when there are no unsaved edits, and saves against it after", async () => {
    const { s, page } = await open();
    expect(await s.backend.changedOnDisk!()).toBe(true);
    const next = await reloadFromDisk(s);
    expect(next.doc.get(page)!.name).toBe("Theirs");
    expect(await s.backend.changedOnDisk!()).toBe(false);
    await s.backend.write(writePackage(next.doc.toFile())); // no ChangedOnDiskError
    closeSession(next);
  });

  it("Compare opens a read-only snapshot without accepting the disk version", async () => {
    const { s, page } = await open();
    const id = await snapshotDiskVersion(s);
    expect(await s.backend.changedOnDisk!()).toBe(true); // still protected
    const view = await openCompareSnapshot(id);
    expect(view.lock).toBeNull();
    expect(view.compare).toBe(true);
    expect(view.doc.get(page)!.name).toBe("Theirs");
    expect(fs.paths("files/").some((p) => p.includes(id))).toBe(false); // not a recent file
    closeSession(s);
  });

  it("Keep mine writes this tab's version as a conflict copy with a new file id first", async () => {
    const { s, page } = await open();
    s.doc.transact("mine", (tx) => tx.set(page, "name", "Mine"));
    const where = await saveConflictCopy(s);
    expect(where).toMatch(/^Disk \(conflict \d{4}-\d\d-\d\d \d\d\.\d\d\) in browser storage$/);
    const ids = fs.paths("files/").map((p) => p.split("/")[1]!);
    const copyId = [...new Set(ids)].find((id) => id !== s.doc.fileId)!;
    const copy = Document.fromFile(readPackage(await opfsBackend(copyId, "x").read()));
    expect(copy.fileId).toBe(copyId);
    expect(copy.name).toMatch(/^Disk \(conflict /);
    expect(copy.get(page)!.name).toBe("Mine");
    expect(conflictName("A", new Date(2026, 9, 18, 9, 5))).toBe("A (conflict 2026-10-18 09.05)");
    closeSession(s);
  });
});

describe("Autosaver after a failed Keep", () => {
  it("starts unsaved and saves the edits the stopped autosaver never wrote", async () => {
    const doc = new Document("K");
    const page = doc.transact("p", (tx) => tx.addPage("P"));
    const backend = opfsBackend(doc.fileId, "K");
    await backend.write(writePackage(doc.toFile()));
    doc.transact("r", (tx) => tx.set(page, "name", "Edited"));
    const saver = new Autosaver(doc, backend, { delayMs: 1, unsaved: true });
    expect(saver.status.state).toBe("unsaved");
    await new Promise((r) => setTimeout(r, 20));
    expect(saver.status.state).toBe("saved");
    expect(Document.fromFile(readPackage(await backend.read())).get(page)!.name).toBe("Edited");
    saver.dispose();
  });
});
