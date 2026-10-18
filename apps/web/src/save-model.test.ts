// Regression model check (QC review 3): kill the "tab" at every filesystem
// call (that call and all later ones fail) during write / repair / autosave /
// Keep, then reopen. Every case must read back as a complete save, and the
// file plus the recovery journal must hold every edit exactly once.
import { describe, expect, it } from "vitest";
import { Document } from "@illigma/core";
import { readPackage, writePackage, type FileTree } from "@illigma/format";
import { Autosaver, opfsBackend, RecoveryJournal } from "@illigma/host-web";
import { FakeFileSystem } from "@illigma/host-web/testing";
import { keepRecovered, replayRecovered, type Session } from "./files";

function sampleDoc() {
  for (;;) {
    const doc = new Document("T");
    const p1 = doc.transact("p", (tx) => tx.addPage("P1"));
    const p2 = doc.transact("p", (tx) => tx.addPage("P2"));
    if (!(p1 < p2)) continue;
    const f = doc.transact("f", (tx) => tx.create("FRAME", p2, { name: "F", width: 100, height: 100 }));
    const r = doc.transact("r", (tx) => tx.create("RECTANGLE", p1, { name: "R" }));
    return { doc, p1, p2, f, r };
  }
}
const same = (a: FileTree, b: FileTree) => a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);
const canon = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon((v as Record<string, unknown>)[k])])) : v;
const norm = (d: Document) => {
  const f = d.toFile();
  return JSON.stringify(canon({ ...f, manifest: { ...f.manifest, app: "" }, nodes: [...f.nodes].sort((a, b) => (a.id < b.id ? -1 : 1)) }));
};

/** Kill: calls numbered > k (from now) fail forever. */
function killAfter(fs: FakeFileSystem, k: number) {
  const start = fs.log.length;
  fs.failWhen = () => fs.log.length - start > k;
}

async function base() {
  const fs = new FakeFileSystem();
  const s = sampleDoc();
  const b = opfsBackend(s.doc.fileId, "T", fs.root);
  await b.write(writePackage(s.doc.toFile()), { saveId: "OLD" });
  const oldTree = await b.read();
  s.doc.transact("m", (tx) => tx.move(s.r, s.f));
  s.doc.transact("pg", (tx) => tx.addPage("P3"));
  s.doc.transact("rn", (tx) => tx.set(s.p1, "name", "First"));
  const newTree = writePackage(s.doc.toFile());
  s.doc.transact("pg2", (tx) => tx.addPage("P4"));
  s.doc.transact("rm", (tx) => tx.delete(s.p2));
  const cTree = writePackage(s.doc.toFile());
  return { fs, id: s.doc.fileId, b, oldTree, newTree, cTree };
}

async function countOps(run: (x: Awaited<ReturnType<typeof base>>) => Promise<unknown>) {
  const x = await base();
  const s = x.fs.log.length;
  await run(x);
  return x.fs.log.length - s;
}

function classify(read: FileTree, saveId: string | null | undefined, x: { oldTree: FileTree; newTree: FileTree; cTree: FileTree }) {
  if (same(read, x.oldTree)) return saveId === "OLD" ? "old" : `old/rev=${saveId}`;
  if (same(read, x.newTree)) return saveId === "NEW" ? "new" : `new/rev=${saveId}`;
  if (same(read, x.cTree)) return saveId === "C" ? "c" : `c/rev=${saveId}`;
  return "TORN";
}

describe("write: nested kills", { timeout: 120_000 }, () => {
  it("kill in write at k, then kill in the repairing read at j, then read", async () => {
    const W = await countOps((x) => x.b.write(x.newTree, { saveId: "NEW" }));
    for (let k = 0; k <= W; k++) {
      for (let j = 0; j < 60; j++) {
        const x = await base();
        killAfter(x.fs, k);
        await x.b.write(x.newTree, { saveId: "NEW" }).catch(() => {});
        killAfter(x.fs, j);
        await opfsBackend(x.id, "T", x.fs.root).read().catch(() => {});
        x.fs.failWhen = null;
        const f = opfsBackend(x.id, "T", x.fs.root);
        const r = await f.read();
        const c = classify(r, f.saveId, x);
        expect(["old", "new"], `k=${k} j=${j}`).toContain(c);
      }
    }
  });

  it("kill in write W1 at k, then kill in write W2 at j", async () => {
    const W = await countOps((x) => x.b.write(x.newTree, { saveId: "NEW" }));
    for (let k = 0; k <= W; k += 1) {
      for (let j = 0; j <= W + 20; j += 1) {
        const x = await base();
        killAfter(x.fs, k);
        await x.b.write(x.newTree, { saveId: "NEW" }).catch(() => {});
        killAfter(x.fs, j);
        await opfsBackend(x.id, "T", x.fs.root).write(x.cTree, { saveId: "C" }).catch(() => {});
        x.fs.failWhen = null;
        const f = opfsBackend(x.id, "T", x.fs.root);
        const c = classify(await f.read(), f.saveId, x);
        expect(["old", "new", "c"], `k=${k} j=${j}`).toContain(c);
      }
    }
  });

  it("a read-only tab (repair:false) reading while the editing tab writes never sees a mix", async () => {
    const W = await countOps((x) => x.b.write(x.newTree, { saveId: "NEW" }));
    const bad: string[] = [];
    for (let k = 0; k <= W; k++) {
      const x = await base();
      const reader = opfsBackend(x.id, "T", x.fs.root);
      const start = x.fs.log.length;
      let p: Promise<FileTree> | null = null;
      x.fs.failWhen = () => {
        if (!p && x.fs.log.length - start > k) p = reader.read({ repair: false });
        return false;
      };
      await x.b.write(x.newTree, { saveId: "NEW" });
      x.fs.failWhen = null;
      const r = await (p ?? reader.read({ repair: false }));
      const c = classify(r, reader.saveId, x);
      if (c !== "old" && c !== "new") bad.push(`k=${k}:${c}`);
    }
    expect(bad).toEqual([]);
  });
});

describe("autosave + journal: kill at every call, nothing invisible", { timeout: 120_000 }, () => {
  async function session1() {
    const fs = new FakeFileSystem();
    const s = sampleDoc();
    const b = opfsBackend(s.doc.fileId, "T", fs.root);
    await b.write(writePackage(s.doc.toFile()));
    const j = new RecoveryJournal(s.doc.fileId, fs.root);
    await j.load(b.saveId);
    j.attach(s.doc);
    const saver = new Autosaver(s.doc, b, { journal: j, delayMs: 1e9 });
    s.doc.transact("e1", (tx) => tx.set(s.r, "name", "E1"));
    s.doc.transact("e2", (tx) => tx.create("ELLIPSE", s.p1, { name: "E2" }));
    await j.flush();
    return { fs, s, b, j, saver };
  }
  async function reopen(fs: FakeFileSystem, id: string) {
    const b = opfsBackend(id, "T", fs.root);
    const doc = Document.fromFile(readPackage(await b.read()));
    const j = new RecoveryJournal(id, fs.root);
    await j.load(b.saveId);
    const rec = await j.recovered();
    return { b, doc, j, rec, merged: replayRecovered(doc, rec).doc };
  }

  it("save killed anywhere: file + journal still give every flushed edit", async () => {
    const x0 = await session1();
    const st = x0.fs.log.length;
    await x0.saver.flushNow();
    const N = x0.fs.log.length - st;
    for (let k = 0; k <= N; k++) {
      const x = await session1();
      const want = norm(x.s.doc);
      killAfter(x.fs, k);
      await x.saver.flushNow().catch(() => {});
      x.fs.failWhen = null;
      const r = await reopen(x.fs, x.s.doc.fileId);
      expect(norm(r.merged), `k=${k}`).toBe(want);
    }
  });

  it("session 2 with undecided carried edits + new edits, save killed anywhere", async () => {
    const mk = async () => {
      const x = await session1(); // session 1 dies here, unsaved
      const r = await reopen(x.fs, x.s.doc.fileId);
      expect(r.rec.length).toBe(2);
      r.j.attach(r.doc);
      const saver = new Autosaver(r.doc, r.b, { journal: r.j, delayMs: 1e9 });
      const page = r.doc.pages()[1]!.id;
      r.doc.transact("e3", (tx) => tx.create("RECTANGLE", page, { name: "E3" }));
      await r.j.flush();
      const want = norm(replayRecovered(r.doc, r.rec).doc);
      return { x, r, saver, want };
    };
    const y0 = await mk();
    const st = y0.x.fs.log.length;
    await y0.saver.flushNow();
    const N = y0.x.fs.log.length - st;
    for (let k = 0; k <= N; k++) {
      const y = await mk();
      killAfter(y.x.fs, k);
      await y.saver.flushNow().catch(() => {});
      y.x.fs.failWhen = null;
      const r3 = await reopen(y.x.fs, y.x.s.doc.fileId);
      expect(norm(r3.merged), `k=${k}`).toBe(y.want);
      // Once the save landed, only the two undecided edits are offered again, not E3 (already saved).
      if (r3.doc.toFile().nodes.some((n) => n.name === "E3")) expect(r3.rec, `k=${k}`).toHaveLength(2);
    }
  });

  it("Keep killed anywhere: next launch gives the kept state", async () => {
    const mk = async () => {
      const x = await session1();
      const r = await reopen(x.fs, x.s.doc.fileId);
      r.j.attach(r.doc);
      const session: Session = { doc: r.doc, backend: r.b, journal: r.j, recovered: r.rec, lock: { release() {} } };
      const want = norm(replayRecovered(r.doc, r.rec).doc);
      return { x, session, want };
    };
    const y0 = await mk();
    const st = y0.x.fs.log.length;
    await keepRecovered(y0.session);
    const N = y0.x.fs.log.length - st;
    for (let k = 0; k <= N; k++) {
      const y = await mk();
      killAfter(y.x.fs, k);
      await keepRecovered(y.session).catch(() => {});
      y.x.fs.failWhen = null;
      const r3 = await reopen(y.x.fs, y.x.s.doc.fileId);
      expect(norm(r3.merged), `k=${k}`).toBe(y.want);
      // Edits Keep already saved are never offered again.
      if (norm(r3.doc) === y.want) expect(r3.rec, `k=${k}`).toEqual([]);
    }
  });
});
