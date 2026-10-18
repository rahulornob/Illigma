/**
 * The `normalize` hook: it completes every edit inside the edit's own
 * transaction (or live step, or replay), so one undo reverts both, and undo
 * and redo restore exact values without running it again.
 */

import { describe, expect, it, vi } from "vitest";
import type { NodeId } from "@illigma/format";
import { Document, DocumentError, type Change, type Normalizer, type Operation } from "./index.js";

/** A toy "layout": a rectangle named "Follower" always sits 10 px right of the one named "Leader". */
function setup(extra: Partial<{ fail: boolean }> = {}) {
  const calls: (readonly Operation[])[] = [];
  const state = { fail: extra.fail ?? false };
  const normalize: Normalizer = (doc, tx, ops) => {
    calls.push(ops);
    if (state.fail) throw new Error("normalizer failed");
    const page = doc.pages()[0];
    if (!page) return;
    const kids = doc.children(page.id);
    const leader = kids.find((n) => n.name === "Leader");
    const follower = kids.find((n) => n.name === "Follower");
    if (leader && follower) tx.set(follower.id, "x", leader.x + 10);
  };
  const doc = new Document("Test", { normalize });
  const ids = doc.transact("Build", (tx) => {
    const page = tx.addPage("Page 1");
    const leader = tx.create("RECTANGLE", page, { name: "Leader", x: 0 });
    const follower = tx.create("RECTANGLE", page, { name: "Follower", x: 0 });
    return { page, leader, follower };
  });
  const changes: Change[] = [];
  doc.subscribe((c) => changes.push(c));
  calls.length = 0;
  return { doc, ...ids, calls, state, changes, normalize };
}

const x = (doc: Document, id: NodeId) => doc.get(id)?.x;

describe("Document normalize hook", () => {
  it("runs inside the edit's transaction; one undo reverts both and undo/redo don't run it again", () => {
    const { doc, leader, follower, calls, changes } = setup();
    expect(x(doc, follower)).toBe(10); // the build itself was normalized
    doc.transact("Move leader", (tx) => tx.set(leader, "x", 50));
    expect(x(doc, follower)).toBe(60);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([{ op: "set", id: leader, key: "x", value: 50, prev: 0 }]);
    expect(changes.at(-1)?.ops).toEqual([
      { op: "set", id: leader, key: "x", value: 50, prev: 0 },
      { op: "set", id: follower, key: "x", value: 60, prev: 10 },
    ]);

    doc.undo();
    expect([x(doc, leader), x(doc, follower)]).toEqual([0, 10]);
    doc.redo();
    expect([x(doc, leader), x(doc, follower)]).toEqual([50, 60]);
    expect(calls).toHaveLength(1); // not on undo or redo
  });

  it("runs once for nested transactions, at the end of the outer one", () => {
    const { doc, leader, follower, calls } = setup();
    doc.transact("Outer", (tx) => {
      tx.set(leader, "x", 5);
      doc.transact("Inner", (inner) => inner.set(leader, "y", 5));
      expect(x(doc, follower)).toBe(10); // not yet
    });
    expect(calls).toHaveLength(1);
    expect(x(doc, follower)).toBe(15);
  });

  it("is not called for an edit that changed nothing", () => {
    const { doc, leader, calls } = setup();
    doc.transact("Nothing", (tx) => tx.set(leader, "x", 0));
    expect(calls).toHaveLength(0);
    expect(doc.undoLabel).toBe("Build");
  });

  it("rolls the whole edit back if it throws", () => {
    const { doc, leader, follower, state } = setup();
    state.fail = true;
    expect(() => doc.transact("Move leader", (tx) => tx.set(leader, "x", 50))).toThrow("normalizer failed");
    expect([x(doc, leader), x(doc, follower)]).toEqual([0, 10]);
    expect(doc.undoLabel).toBe("Build");
  });

  it("completes every live step; commit keeps one undo step; cancel leaves no trace", () => {
    const { doc, leader, follower, changes, calls } = setup();
    const before = doc.toFile();
    const edit = doc.beginLive("Move leader");
    for (const v of [5, 12, 30]) {
      edit.update((tx) => tx.set(leader, "x", v));
      expect(x(doc, follower)).toBe(v + 10);
    }
    expect(calls).toHaveLength(3);
    edit.cancel();
    expect(doc.toFile()).toEqual(before);
    expect(doc.undoLabel).toBe("Build");
    expect(changes.every((c) => c.origin === "live")).toBe(true);

    const again = doc.beginLive("Move leader");
    again.update((tx) => tx.set(leader, "x", 7));
    again.update((tx) => tx.set(leader, "x", 8));
    again.commit();
    expect(calls).toHaveLength(5); // not again on commit
    expect(changes.at(-1)?.origin).toBe("edit");
    expect(changes.at(-1)?.ops).toEqual([
      { op: "set", id: leader, key: "x", value: 8, prev: 0 },
      { op: "set", id: follower, key: "x", value: 18, prev: 10 },
    ]);
    doc.undo();
    expect(doc.toFile()).toEqual(before);
  });

  it("a live step whose normalizer throws keeps the previous step", () => {
    const { doc, leader, follower, state } = setup();
    const edit = doc.beginLive("Move leader");
    edit.update((tx) => tx.set(leader, "x", 5));
    state.fail = true;
    expect(() => edit.update((tx) => tx.set(leader, "x", 9))).toThrow("normalizer failed");
    expect([x(doc, leader), x(doc, follower)]).toEqual([5, 15]);
    edit.cancel();
    expect([x(doc, leader), x(doc, follower)]).toEqual([0, 10]);
  });

  it("completes replayed operations without adding history", () => {
    const { doc, leader, follower, changes, calls } = setup();
    // A recorded edit from before the normalizer: only the leader moved.
    doc.replay([{ op: "set", id: leader, key: "x", value: 40, prev: 0 }]);
    expect(calls).toHaveLength(1);
    expect(x(doc, follower)).toBe(50);
    expect(doc.undoLabel).toBe("Build");
    expect(changes.at(-1)?.origin).toBe("replay");
    expect(changes.at(-1)?.ops).toHaveLength(2);
  });

  it("a replay whose normalizer throws changes nothing", () => {
    const { doc, leader, follower, state } = setup();
    state.fail = true;
    expect(() => doc.replay([{ op: "set", id: leader, key: "x", value: 40, prev: 0 }])).toThrow("normalizer failed");
    expect([x(doc, leader), x(doc, follower)]).toEqual([0, 10]);
  });

  it("is kept by fromFile when passed again, and readable from the document", () => {
    const { doc, normalize } = setup();
    expect(doc.normalizer).toBe(normalize);
    const copy = Document.fromFile(doc.toFile(), { normalize: doc.normalizer });
    const spy = vi.fn(normalize);
    const other = Document.fromFile(doc.toFile(), { normalize: spy });
    const leader = other.children(other.pages()[0]!.id).find((n) => n.name === "Leader")!.id;
    other.transact("Move", (tx) => tx.set(leader, "x", 3));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(copy.normalizer).toBe(normalize);
    expect(new Document().normalizer).toBeUndefined();
  });

  it("can't be used to start another top-level transaction from inside", () => {
    const doc = new Document("T", {
      normalize: (d) => {
        // Joins the running edit: nested transact is allowed and records into the same step.
        d.transact("nested", () => {});
        expect(() => d.undo()).toThrow(DocumentError);
      },
    });
    doc.transact("Page", (tx) => tx.addPage("P"));
    expect(doc.undoLabel).toBe("Page");
  });
});
