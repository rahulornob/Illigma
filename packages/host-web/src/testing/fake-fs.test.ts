import { describe, expect, it } from "vitest";
import { FakeFileSystem } from "./fake-fs.js";

describe("FakeFileSystem", () => {
  it("applies a writable stream only on close, like the browser", async () => {
    const fs = new FakeFileSystem();
    fs.writeText("a.txt", "old");
    const handle = await fs.root.getFileHandle("a.txt");
    const stream = await handle.createWritable();
    await stream.write("new");
    expect(await (await handle.getFile()).text()).toBe("old");
    await stream.abort();
    expect(fs.readText("a.txt")).toBe("old");

    const again = await handle.createWritable();
    await again.write("new");
    await again.close();
    expect(fs.readText("a.txt")).toBe("new");
  });

  it("appends with keepExistingData and seek", async () => {
    const fs = new FakeFileSystem();
    const handle = await fs.root.getFileHandle("log", { create: true });
    for (const line of ["ä\n", "b\n"]) {
      const size = (await handle.getFile()).size;
      const s = await handle.createWritable({ keepExistingData: true });
      await s.seek(size);
      await s.write(line);
      await s.close();
    }
    expect(fs.readText("log")).toBe("ä\nb\n");
  });

  it("matches browser errors for missing, mistyped and non-empty entries", async () => {
    const fs = new FakeFileSystem();
    fs.writeText("dir/file", "x");
    await expect(fs.root.getFileHandle("nope")).rejects.toMatchObject({ name: "NotFoundError" });
    await expect(fs.root.getFileHandle("dir")).rejects.toMatchObject({ name: "TypeMismatchError" });
    await expect(fs.root.removeEntry("dir")).rejects.toMatchObject({ name: "InvalidModificationError" });
    await fs.root.removeEntry("dir", { recursive: true });
    expect(fs.paths()).toEqual([]);
  });

  it("lists entries and resolves paths", async () => {
    const fs = new FakeFileSystem();
    fs.writeText("a/b/c.json", "{}");
    const a = await fs.root.getDirectoryHandle("a");
    const names: string[] = [];
    for await (const [name, handle] of a.entries()) names.push(`${name}:${handle.kind}`);
    expect(names).toEqual(["b:directory"]);
    const c = await (await a.getDirectoryHandle("b")).getFileHandle("c.json");
    expect(await fs.root.resolve(c)).toEqual(["a", "b", "c.json"]);
    expect(await c.isSameEntry(await (await a.getDirectoryHandle("b")).getFileHandle("c.json"))).toBe(true);
  });
});
