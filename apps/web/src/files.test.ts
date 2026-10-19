// Regression tests for opening files and crash recovery in the web app (QC review).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createComponent, Document, type Operation } from "@illigma/core";
import { importPrototypeJson, readPackage, writePackage } from "@illigma/format";
import { Autosaver, opfsBackend, RecoveryJournal } from "@illigma/host-web";
import { FakeFileSystem, installFakeOpfs } from "@illigma/host-web/testing";
import { closeSession, discardRecovered, keepRecovered, loadDocument, openStoredFile, replayRecovered, whileClosing, CLOSING_WAIT_MS } from "./files";

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

function base() {
  const doc = new Document("T");
  const p1 = doc.transact("p", (tx) => tx.addPage("P1"));
  const f = doc.transact("f", (tx) => tx.create("FRAME", p1, { name: "F", width: 100, height: 100 }));
  const r = doc.transact("r", (tx) => tx.create("RECTANGLE", f, { name: "R" }));
  return { doc, p1, f, r };
}

/** Save `doc`, then make `edit` reach the journal but not the file (the tab dies). */
async function crashAfter(doc: Document, edit: () => void) {
  await opfsBackend(doc.fileId, "T").write(writePackage(doc.toFile()));
  const journal = new RecoveryJournal(doc.fileId);
  journal.attach(doc);
  edit();
  await journal.flush();
}

const reopen = async (fileId: string) => {
  const s = await openStoredFile(fileId, "T");
  closeSession(s);
  return s;
};

describe("recovery in the web app", () => {
  it("recovered edits survive an autosave made before Keep/Discard (proof A)", async () => {
    const { doc, f } = base();
    await crashAfter(doc, () => doc.transact("rename", (tx) => tx.set(f, "name", "IMPORTANT")));

    const s = await openStoredFile(doc.fileId, "T");
    expect(s.recovered).toHaveLength(1);
    s.journal.attach(s.doc);
    const saver = new Autosaver(s.doc, s.backend, { journal: s.journal, delayMs: 1 });
    s.doc.transact("x", (tx) => tx.set(s.doc.pages()[0]!.id, "name", "P1b")); // an edit while the banner is up
    await saver.flushNow();
    saver.dispose();
    closeSession(s);

    const s3 = await reopen(doc.fileId);
    expect(s3.recovered.flat()).toEqual([expect.objectContaining({ key: "name", value: "IMPORTANT" })]);
    expect(s3.doc.pages()[0]!.name).toBe("P1b"); // the autosave landed too
    const kept = await keepRecovered(s3);
    expect(kept.doc.get(f)!.name).toBe("IMPORTANT");
  });

  it("Keep skips a create whose parent is gone, reports it, and leaves both documents valid (proof C)", async () => {
    const { doc, f } = base();
    await crashAfter(doc, () => {
      doc.transact("draw", (tx) => {
        const card = tx.create("FRAME", f, { name: "Card" });
        tx.create("TEXT", card, { name: "Label", characters: "Hi" });
      });
      doc.transact("rename page", (tx) => tx.set(doc.pages()[0]!.id, "name", "Renamed"));
    });
    const s = await openStoredFile(doc.fileId, "T");
    s.doc.transact("del", (tx) => tx.delete(f)); // deleted while the banner is up
    const before = s.doc.toFile();

    const kept = await keepRecovered(s);
    expect(kept.notice).toBe("1 recovered edit no longer fits the file and was skipped. It stays in the recovery journal.");
    expect(kept.skipped).toHaveLength(1);
    expect(kept.doc.has(f)).toBe(false);
    expect(kept.doc.pages()[0]!.name).toBe("Renamed"); // the edit that still fits was applied
    expect(s.doc.toFile()).toEqual(before); // the open document was never touched
    writePackage(s.doc.toFile());
    const reread = Document.fromFile(readPackage(await opfsBackend(doc.fileId, "T").read()));
    expect(reread.pages()[0]!.name).toBe("Renamed");
    closeSession(kept);
    // The skipped edit is never dropped: it is offered again (only it; the applied one is in the file).
    const again = await reopen(doc.fileId);
    expect(again.recovered).toHaveLength(1);
    expect(again.recovered[0]!.map((o) => o.op)).toEqual(["create", "create"]);
  });

  it("Keep recovers a frame turned into a component (delete + create with the same ids) (QC9)", async () => {
    const { doc, f, r } = base();
    await crashAfter(doc, () => doc.transact("component", (tx) => createComponent(doc, tx, [f])));
    const s = await openStoredFile(doc.fileId, "T");
    const kept = await keepRecovered(s);
    expect(kept.notice).toBeUndefined();
    expect(kept.doc.get(f)?.type).toBe("COMPONENT");
    expect(kept.doc.get(r)?.parentId).toBe(f);
    closeSession(kept);
  });

  it("an edit that deletes and can't apply in full is skipped whole: Keep never deletes content (QC9)", () => {
    const { doc, f, r } = base();
    const del = [
      { op: "delete", node: doc.get(r)! },
      { op: "delete", node: doc.get(f)! },
      { op: "create", node: { ...doc.get(f)!, parentId: "missing" } },
    ] as never;
    const { doc: out, skipped } = replayRecovered(doc, [del]);
    expect(skipped).toBe(1);
    expect(out.has(f)).toBe(true);
    expect(out.has(r)).toBe(true);
  });

  it("replayRecovered skips the subtree of a skipped create across later edits", () => {
    const { doc, p1, f } = base();
    const gone = "missing-frame";
    const changes = [
      [{ op: "create", node: { ...doc.get(f)!, id: "card", parentId: gone, name: "Card", index: "a0" } }],
      [{ op: "create", node: { ...doc.get(f)!, id: "inner", parentId: "card", name: "Inner", index: "a0" } }],
      [{ op: "set", id: "inner", key: "name", value: "X", prev: "Inner" }],
      [{ op: "set", id: p1, key: "name", value: "Kept", prev: "P1" }],
    ] as never;
    const { doc: out, skipped } = replayRecovered(doc, changes);
    expect(skipped).toBe(3);
    expect(out.has("card")).toBe(false);
    expect(out.has("inner")).toBe(false);
    expect(out.get(p1)!.name).toBe("Kept");
  });

  it("a Keep that can't be saved changes nothing and keeps the edits in the journal", async () => {
    const { doc, f } = base();
    await crashAfter(doc, () => doc.transact("rename", (tx) => tx.set(f, "name", "Again")));
    const s = await openStoredFile(doc.fileId, "T");
    fs.failWhen = (op) => op.kind === "close" && op.path.startsWith("files/");
    await expect(keepRecovered(s)).rejects.toThrow();
    fs.failWhen = null;
    expect(s.doc.get(f)!.name).toBe("F");
    closeSession(s);
    expect((await reopen(doc.fileId)).recovered).toHaveLength(1);
  });

  it("Keep keeps this session's edits made after its checkpoint in the journal", async () => {
    const { doc, f, r } = base();
    await crashAfter(doc, () => doc.transact("rename", (tx) => tx.set(f, "name", "Kept")));
    const s = await openStoredFile(doc.fileId, "T");
    s.journal.attach(s.doc);
    const keeping = keepRecovered(s);
    s.doc.transact("late", (tx) => tx.set(r, "name", "Late")); // the editor blocks this; the journal still must not lose it
    const kept = await keeping;
    await s.journal.flush();
    expect(await kept.journal.pending()).toEqual([expect.objectContaining({ key: "name", value: "Late" })]);
  });

  it("Discard drops only the recovered edits", async () => {
    const { doc, f, r } = base();
    await crashAfter(doc, () => doc.transact("rename", (tx) => tx.set(f, "name", "Gone")));
    const s = await openStoredFile(doc.fileId, "T");
    s.journal.attach(s.doc);
    s.doc.transact("mine", (tx) => tx.set(r, "name", "Mine"));
    const next = await discardRecovered(s);
    expect(next.recovered).toEqual([]);
    expect(await s.journal.pending()).toEqual([expect.objectContaining({ value: "Mine" })]);
  });

  it("a second tab opens the file read-only and never sees the first tab's journal as recovered", async () => {
    const held = new Set<string>();
    vi.stubGlobal("navigator", {
      ...globalThis.navigator,
      storage: { getDirectory: async () => fs.root },
      locks: {
        async request(name: string, _o: unknown, cb: (l: unknown) => unknown) {
          if (held.has(name)) return cb(null);
          held.add(name);
          try {
            return await cb({});
          } finally {
            held.delete(name);
          }
        },
      },
    });
    const { doc, f } = base();
    await opfsBackend(doc.fileId, "T").write(writePackage(doc.toFile()));
    const first = await openStoredFile(doc.fileId, "T");
    expect(first.lock).not.toBeNull();
    first.journal.attach(first.doc);
    first.doc.transact("live", (tx) => tx.set(f, "name", "Live"));
    await first.journal.flush();

    const second = await openStoredFile(doc.fileId, "T");
    expect(second.lock).toBeNull();
    expect(second.recovered).toEqual([]);

    closeSession(first);
    await new Promise((r) => setTimeout(r, 0));
    const third = await openStoredFile(doc.fileId, "T");
    expect(third.lock).not.toBeNull();
    expect(third.recovered).toHaveLength(1);
  });
});

describe("closing and reopening a file", () => {
  it("reopening waits for the closed editor's last save", async () => {
    const { doc } = base();
    await opfsBackend(doc.fileId, "T").write(writePackage(doc.toFile()));
    const s = await openStoredFile(doc.fileId, "T");
    let finish!: () => void;
    const lastSave = new Promise<void>((r) => (finish = r));
    const closed = closeSession(s);
    whileClosing(doc.fileId, lastSave);
    let opened = false;
    const next = openStoredFile(doc.fileId, "T").then((x) => ((opened = true), x));
    await new Promise((r) => setTimeout(r, 20));
    expect(opened).toBe(false);
    finish();
    await closed;
    const s2 = await next;
    expect(s2.lock).not.toBeNull(); // this tab edits it again, not read-only
    await closeSession(s2);
  });

  it("gives up waiting for a save that never finishes, with a plain message", async () => {
    const { doc } = base();
    await opfsBackend(doc.fileId, "T").write(writePackage(doc.toFile()));
    const s = await openStoredFile(doc.fileId, "T");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      void closeSession(s);
      whileClosing(doc.fileId, new Promise(() => {})); // a stuck save
      const opening = openStoredFile(doc.fileId, "T").then(
        () => null,
        (e: unknown) => e,
      );
      await vi.advanceTimersByTimeAsync(CLOSING_WAIT_MS + 10);
      expect(String(await opening)).toMatch(/still saving from when it was last closed/);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("files are laid out as they open (QC round 6)", () => {
  // The importer's "known difference" (packages/layout/src/import.test.ts): the prototype let a Fill
  // layer prop a hugging frame open, so the file holds a 300 px card that layout makes 200 px.
  const proto = {
    version: 1,
    artboards: [{ id: "C", name: "Card", x: 0, y: 0, width: 300, height: 20, autoLayout: { enabled: true, direction: "vertical", gap: 0, paddingX: 0, paddingY: 0 } }],
    objects: [
      { id: "fill", name: "fill", type: "rect", frameId: "C", x: 0, y: 0, w: 300, h: 10, widthSizing: "fill" },
      { id: "fixed", name: "fixed", type: "rect", frameId: "C", x: 0, y: 10, w: 200, h: 10 },
    ],
  };
  const file = () => importPrototypeJson(proto, { now: new Date(0) }).file;
  const byName = (doc: Document, name: string) => [...doc.toFile().nodes].find((n) => n.name === name)!;

  it("opens laid out, without an undo step", () => {
    expect(byName(Document.fromFile(file()), "Card").width).toBe(300); // as stored
    const doc = loadDocument(file());
    expect(byName(doc, "Card").width).toBe(200);
    expect(byName(doc, "fill").width).toBe(200);
    expect(doc.canUndo).toBe(false);
  });

  it("an unrelated edit moves nothing else, and recovery replays onto the same layout", () => {
    const stored = file();
    const doc = loadDocument(stored);
    const card = byName(doc, "Card");
    let ops: readonly Operation[] = [];
    doc.subscribe((c) => (ops = c.ops));
    doc.transact("Move", (tx) => tx.set(card.id, "x", 40));
    expect(ops).toHaveLength(1);
    expect(byName(doc, "Card")).toMatchObject({ x: 40, width: 200 });
    const { doc: kept, skipped } = replayRecovered(loadDocument(stored), [ops]);
    expect(skipped).toBe(0);
    expect(kept.toFile().nodes).toEqual(doc.toFile().nodes);
  });

  it("a file that is already laid out opens unchanged", () => {
    const laidOut = loadDocument(file()).toFile();
    const again = loadDocument(laidOut);
    expect(again.toFile().nodes).toEqual(laidOut.nodes);
    expect(again.canUndo).toBe(false);
  });
});
