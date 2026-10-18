// Regression tests from QC review 3: never touch a folder that isn't ours,
// never overwrite a package that changed on disk, and tidy up a failed save
// in an order that can't tear it.
import { describe, expect, it } from "vitest";
import { Document } from "@illigma/core";
import { readPackage, writePackage } from "@illigma/format";
import {
  Autosaver,
  COMMIT_FILE,
  folderBackend,
  isChangedOnDisk,
  isCopyOfAnother,
  memoryLocationStore,
  NOT_A_PACKAGE_MESSAGE,
  opfsBackend,
  RecoveryJournal,
  REV_FILE,
  TEMP_SUFFIX,
} from "./index.js";
import { FakeFileSystem } from "./testing/fake-fs.js";
import { sampleDoc } from "./test-helpers.js";

const newPackage = (name = "my-site") => {
  const doc = new Document(name);
  doc.transact("p", (tx) => tx.addPage("Page 1"));
  return writePackage(doc.toFile());
};

describe("a folder that isn't an Illigma file is never touched", () => {
  it("refuses to write into a project folder with a pages/ subfolder (QC proof: Next.js pages/index.tsx)", async () => {
    const fs = new FakeFileSystem();
    fs.writeText("my-site/package.json", "{}");
    fs.writeText("my-site/pages/index.tsx", "export default () => <h1/>");
    fs.writeText("my-site/pages/about.tsx", "...");
    const before = fs.paths();
    const backend = folderBackend(await fs.root.getDirectoryHandle("my-site"));
    expect(await backend.canCreateFile()).toBe(false);
    const tree = await backend.read({ repair: false });
    expect(tree.has("manifest.json")).toBe(false);
    await expect(backend.write(newPackage())).rejects.toThrow(NOT_A_PACKAGE_MESSAGE);
    expect(fs.paths()).toEqual(before);
  });

  it("treats a web app's manifest.json as foreign", async () => {
    const fs = new FakeFileSystem();
    fs.writeText("app/manifest.json", '{"name":"My PWA","icons":[]}');
    const backend = folderBackend(await fs.root.getDirectoryHandle("app"));
    expect(await backend.canCreateFile()).toBe(false);
    await expect(backend.write(newPackage())).rejects.toMatchObject({ name: "NotAPackageError" });
    expect(fs.readText("app/manifest.json")).toBe('{"name":"My PWA","icons":[]}');
  });

  it("creates a file in an empty folder (OS files don't count) or one named *.illigma", async () => {
    const fs = new FakeFileSystem();
    fs.writeText("Empty/.DS_Store", "x");
    await fs.root.getDirectoryHandle("Empty", { create: true });
    const empty = folderBackend(await fs.root.getDirectoryHandle("Empty"));
    expect(await empty.canCreateFile()).toBe(true);
    await empty.write(newPackage());
    expect(fs.exists("Empty/manifest.json")).toBe(true);

    fs.writeText("Named.illigma/notes.txt", "mine");
    const named = folderBackend(await fs.root.getDirectoryHandle("Named.illigma"));
    expect(await named.canCreateFile()).toBe(true);
    await named.write(newPackage());
    expect(fs.readText("Named.illigma/notes.txt")).toBe("mine");
  });

  it("removes only page files the previous manifest listed", async () => {
    const fs = new FakeFileSystem();
    const { doc } = sampleDoc();
    const second = doc.transact("Add page", (tx) => tx.addPage("Page 2"));
    const backend = folderBackend(await fs.root.getDirectoryHandle("A.illigma", { create: true }));
    await backend.write(writePackage(doc.toFile()));
    fs.writeText("A.illigma/pages/notes.json", "mine");
    fs.writeText("A.illigma/pages/index.tsx", "mine");
    fs.writeText("A.illigma/pages/deep/x.json", "mine");

    doc.transact("Delete page", (tx) => tx.delete(second));
    await backend.write(writePackage(doc.toFile()));
    expect(fs.exists(`A.illigma/pages/${second}.json`)).toBe(false);
    expect(fs.paths("A.illigma/pages/").filter((p) => !p.includes(doc.pages()[0]!.id))).toEqual([
      "A.illigma/pages/deep/x.json",
      "A.illigma/pages/index.tsx",
      "A.illigma/pages/notes.json",
    ]);
  });
});

describe("changes on disk (save-states.md rule 4)", () => {
  async function twoWriters() {
    const fs = new FakeFileSystem();
    const { doc, frame } = sampleDoc();
    const dir = await fs.root.getDirectoryHandle("Shared.illigma", { create: true });
    await folderBackend(dir).write(writePackage(doc.toFile()));
    const mine = folderBackend(dir);
    await mine.read();
    const theirs = folderBackend(dir); // another browser, or a synced folder
    await theirs.read();
    return { fs, doc, frame, mine, theirs };
  }

  it("refuses to save over a package another writer changed, and writes nothing", async () => {
    const { fs, doc, frame, mine, theirs } = await twoWriters();
    doc.transact("theirs", (tx) => tx.set(frame, "name", "Theirs"));
    await theirs.write(writePackage(doc.toFile()));
    const onDisk = fs.paths().map((p) => [p, fs.readText(p)]);

    expect(await mine.changedOnDisk()).toBe(true);
    doc.transact("mine", (tx) => tx.set(frame, "name", "Mine"));
    const err = await mine.write(writePackage(doc.toFile())).catch((e: unknown) => e);
    expect(isChangedOnDisk(err)).toBe(true);
    expect(fs.paths().map((p) => [p, fs.readText(p)])).toEqual(onDisk);

    // Only an explicit overwrite replaces it; after that saves work normally.
    await mine.write(writePackage(doc.toFile()), { overwrite: true });
    expect(await mine.changedOnDisk()).toBe(false);
    await mine.write(writePackage(doc.toFile()));
    expect(Document.fromFile(readPackage(await mine.read())).get(frame)!.name).toBe("Mine");
  });

  it("a read that doesn't remember leaves the check in place (Compare)", async () => {
    const { doc, mine, theirs } = await twoWriters();
    await theirs.write(writePackage(doc.toFile()));
    await mine.read({ remember: false });
    expect(await mine.changedOnDisk()).toBe(true);
    await mine.read();
    expect(await mine.changedOnDisk()).toBe(false);
  });

  it("its own failed save that a repair finished is not a change on disk", async () => {
    const fs = new FakeFileSystem();
    const { doc, frame } = sampleDoc();
    const backend = opfsBackend(doc.fileId, doc.name, fs.root);
    await backend.write(writePackage(doc.toFile()));
    doc.transact("r", (tx) => tx.set(frame, "name", "B"));
    // The marker lands, then promoting fails: the save counts and the next repair finishes it.
    fs.failWhen = (op) => op.kind === "createWritable" && op.path === `files/${doc.fileId}/manifest.json`;
    await expect(backend.write(writePackage(doc.toFile()))).rejects.toThrow();
    fs.failWhen = null;
    expect(await backend.changedOnDisk()).toBe(false);
    await backend.write(writePackage(doc.toFile()));
  });

  it("the autosaver holds instead of overwriting, and only writes after overwriteDisk()", async () => {
    const { doc, frame, mine, theirs } = await twoWriters();
    await theirs.write(writePackage(doc.toFile()));
    const saver = new Autosaver(doc, mine, { delayMs: 1 });
    doc.transact("mine", (tx) => tx.set(frame, "name", "Mine"));
    await saver.flushNow();
    expect(saver.status.state).toBe("changed-on-disk");
    expect(saver.hasUnsavedChanges).toBe(true);
    doc.transact("more", (tx) => tx.set(frame, "name", "Mine 2"));
    await new Promise((r) => setTimeout(r, 10));
    expect(saver.status.state).toBe("changed-on-disk"); // no retry loop, no silent overwrite
    expect(Document.fromFile(readPackage(await theirs.read())).get(frame)!.name).toBe("Sign up");

    await saver.overwriteDisk();
    expect(saver.status.state).toBe("saved");
    expect(Document.fromFile(readPackage(await theirs.read())).get(frame)!.name).toBe("Mine 2");
    saver.dispose();
  });

  it("holdForDisk stops saving until overwriteDisk", async () => {
    const fs = new FakeFileSystem();
    const { doc, frame } = sampleDoc();
    const backend = opfsBackend(doc.fileId, doc.name, fs.root);
    await backend.write(writePackage(doc.toFile()));
    const saver = new Autosaver(doc, backend, { delayMs: 1 });
    doc.transact("x", (tx) => tx.set(frame, "name", "X"));
    saver.holdForDisk();
    await saver.flushNow();
    expect(saver.status.state).toBe("changed-on-disk");
    expect(Document.fromFile(readPackage(await backend.read())).get(frame)!.name).toBe("Sign up");
    saver.dispose();
  });
});

describe("a failed save is tidied up marker first", () => {
  it("removes the commit marker before any staged copy, and keeps the copies if the marker can't be removed", async () => {
    const fs = new FakeFileSystem();
    const { doc, frame } = sampleDoc();
    const backend = opfsBackend(doc.fileId, doc.name, fs.root);
    await backend.write(writePackage(doc.toFile()));
    doc.transact("r", (tx) => tx.set(frame, "name", "B"));
    const marker = `files/${doc.fileId}/${COMMIT_FILE}`;

    const start = fs.log.length;
    fs.failWhen = (op) => op.kind === "close" && op.path === marker;
    await expect(backend.write(writePackage(doc.toFile()))).rejects.toThrow();
    const removes = fs.log.slice(start).filter((op) => op.kind === "remove");
    expect(removes[0]!.path).toBe(marker);
    expect(removes.length).toBeGreaterThan(1);

    fs.failWhen = (op) => (op.kind === "close" && op.path === marker) || (op.kind === "remove" && op.path === marker);
    await expect(backend.write(writePackage(doc.toFile()))).rejects.toThrow();
    expect(fs.paths().filter((p) => p.endsWith(TEMP_SUFFIX)).length).toBeGreaterThan(0);
    fs.failWhen = null;
    expect(Document.fromFile(readPackage(await backend.read())).get(frame)!.name).toBe("Sign up");
    expect(fs.paths().filter((p) => p.endsWith(TEMP_SUFFIX))).toEqual([]);
  });
});

describe("recovered edits stay carried across a save (crash before the journal is trimmed)", () => {
  it("a save made while recovered edits are undecided marks this session's edits as saved, but not the recovered ones", async () => {
    const fs = new FakeFileSystem();
    const { doc, frame, page } = sampleDoc();
    const b1 = opfsBackend(doc.fileId, doc.name, fs.root);
    await b1.write(writePackage(doc.toFile()));
    const j1 = new RecoveryJournal(doc.fileId, fs.root);
    j1.attach(doc);
    doc.transact("lost", (tx) => tx.set(frame, "name", "Recovered"));
    await j1.flush(); // tab 1 dies

    const b2 = opfsBackend(doc.fileId, doc.name, fs.root);
    const d2 = Document.fromFile(readPackage(await b2.read()));
    const j2 = new RecoveryJournal(doc.fileId, fs.root);
    await j2.load(b2.saveId);
    expect(await j2.recovered()).toHaveLength(1);
    j2.attach(d2);
    d2.transact("mine", (tx) => tx.set(page, "name", "Saved page"));
    const mark = j2.checkpoint();
    await j2.markSave("s2", mark);
    await b2.write(writePackage(d2.toFile()), { saveId: "s2" });
    // tab 2 dies before clear(mark)

    const b3 = opfsBackend(doc.fileId, doc.name, fs.root);
    const d3 = Document.fromFile(readPackage(await b3.read()));
    expect(d3.get(page)!.name).toBe("Saved page");
    const j3 = new RecoveryJournal(doc.fileId, fs.root);
    await j3.load(b3.saveId);
    expect((await j3.recovered()).flat()).toEqual([expect.objectContaining({ key: "name", value: "Recovered" })]);
    expect(fs.readText(`files/${doc.fileId}/${REV_FILE}`)).toContain("s2");
  });
});

describe("copies of a package get their own file id", () => {
  it("flags a folder whose id lives in browser storage or in another folder that still exists", async () => {
    const fs = new FakeFileSystem();
    const store = memoryLocationStore();
    const a = await fs.root.getDirectoryHandle("A.illigma", { create: true });
    const b = await fs.root.getDirectoryHandle("A copy.illigma", { create: true });
    expect(await isCopyOfAnother("f1", a, store, fs.root)).toBe(false);
    expect(await isCopyOfAnother("f1", a, store, fs.root)).toBe(false); // same folder again
    expect(await isCopyOfAnother("f1", b, store, fs.root)).toBe(true);

    // Moved away (the old handle is gone): the new place takes the id, so its recovery journal still applies.
    const gone = {
      isSameEntry: async () => false,
      queryPermission: async () => "granted",
      keys: () => ({ next: () => Promise.reject(new DOMException("gone", "NotFoundError")) }),
    } as unknown as FileSystemDirectoryHandle;
    await store.set("f1", gone);
    expect(await isCopyOfAnother("f1", b, store, fs.root)).toBe(false);
    expect(await store.get("f1")).toBe(b);
    // No permission this session: can't tell, so it counts as moved, not copied.
    await store.set("f1", { ...gone, queryPermission: async () => "prompt" } as unknown as FileSystemDirectoryHandle);
    expect(await isCopyOfAnother("f1", a, store, fs.root)).toBe(false);

    fs.writeText("files/f2/manifest.json", "{}");
    expect(await isCopyOfAnother("f2", b, store, fs.root)).toBe(true);
  });
});
