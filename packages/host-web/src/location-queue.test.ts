import { describe, expect, it } from "vitest";
import { readPackage, writePackage } from "@illigma/format";
import { isSuperseded, opfsBackend, TEMP_SUFFIX } from "./index.js";
import { atLocation } from "./location-queue.js";
import { FakeFileSystem } from "./testing/fake-fs.js";
import { sampleDoc } from "./test-helpers.js";

describe("one queue per place on disk", () => {
  it("runs tasks for one place one at a time, in call order, across callers", async () => {
    const fs = new FakeFileSystem();
    const loc = { kind: "opfs", path: ["files", "x"], root: fs.root } as const;
    const seen: string[] = [];
    let open = 0;
    const task = (name: string) => async () => {
      open++;
      expect(open).toBe(1);
      await new Promise((r) => setTimeout(r, 5));
      seen.push(name);
      open--;
    };
    await Promise.all([atLocation(loc, task("a")), atLocation({ ...loc, path: ["files", "x"] }, task("b")), atLocation(loc, task("c"))]);
    expect(seen).toEqual(["a", "b", "c"]);
  });

  it("keeps two backends for the same file from writing at once", async () => {
    const fs = new FakeFileSystem();
    const { doc } = sampleDoc();
    const closed = opfsBackend(doc.fileId, doc.name, fs.root); // the closed editor's
    const reopened = opfsBackend(doc.fileId, doc.name, fs.root);
    const older = writePackage(doc.toFile());
    doc.transact("rename", (tx) => tx.set(doc.pages()[0]!.id, "name", "Newer"));
    const newer = writePackage(doc.toFile());
    await Promise.all([closed.write(older), reopened.write(newer)]);
    expect(readPackage(await reopened.read()).nodes.find((n) => n.type === "PAGE")?.name).toBe("Newer");
    expect(fs.paths().filter((p) => p.endsWith(TEMP_SUFFIX))).toEqual([]);
  });

  it("drops a retired save once the file was opened again and saved", async () => {
    const fs = new FakeFileSystem();
    const { doc } = sampleDoc();
    const closed = opfsBackend(doc.fileId, doc.name, fs.root);
    const reopened = opfsBackend(doc.fileId, doc.name, fs.root);
    const older = writePackage(doc.toFile());
    doc.transact("rename", (tx) => tx.set(doc.pages()[0]!.id, "name", "Newer"));
    await reopened.write(writePackage(doc.toFile()));
    const late = await closed.write(older, { retired: () => true }).then(() => null, (e: unknown) => e);
    expect(isSuperseded(late)).toBe(true);
    expect(readPackage(await reopened.read()).nodes.find((n) => n.type === "PAGE")?.name).toBe("Newer");
  });

  it("still writes a retired save when nothing newer has saved", async () => {
    const fs = new FakeFileSystem();
    const { doc } = sampleDoc();
    const closed = opfsBackend(doc.fileId, doc.name, fs.root);
    opfsBackend(doc.fileId, doc.name, fs.root); // opened again, not saved yet
    await closed.write(writePackage(doc.toFile()), { retired: () => true });
    expect((await closed.read()).size).toBeGreaterThan(0);
  });
});
