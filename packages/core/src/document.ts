import {
  defaultNode,
  FORMAT_NAME,
  FORMAT_VERSION,
  keyBetween,
  type IlligmaFile,
  type Node,
  type NodeId,
  type NodeKey,
  type NodeType,
} from "@illigma/format";
import { newId } from "./ids.js";
import { clone, invert, sameValue, type Operation } from "./operations.js";

/** A committed transaction: its operations in order, plus a label for the undo menu. */
export interface Change {
  label: string;
  ops: Operation[];
  /** "edit" for new work, "undo" and "redo" for history moves. */
  origin: "edit" | "undo" | "redo";
}

export type Listener = (change: Change) => void;

export interface DocumentOptions {
  /** Maximum undo steps kept. PRD minimum is 100. */
  historyLimit?: number;
}

export class DocumentError extends Error {
  override name = "DocumentError";
}

/** Where a node goes among its new siblings. */
export type Position = { before: NodeId } | { after: NodeId } | "first" | "last";

/**
 * The in-memory document: a flat map of nodes keyed by id. Parents are ids,
 * sibling order is a fractional index. All changes go through `transact`.
 */
export class Document {
  readonly fileId: string;
  name: string;
  readonly created: string;
  private nodes = new Map<NodeId, Node>();
  private childIds = new Map<NodeId, Set<NodeId>>();
  private pageOrder: NodeId[] = [];
  private undoStack: Change[] = [];
  private redoStack: Change[] = [];
  private listeners = new Set<Listener>();
  private readonly historyLimit: number;
  private activeTx: Transaction | null = null;

  constructor(name = "Untitled", options: DocumentOptions = {}) {
    this.fileId = newId();
    this.name = name;
    this.created = new Date().toISOString();
    this.historyLimit = Math.max(100, options.historyLimit ?? 200);
  }

  // ---- reading ----

  get(id: NodeId): Readonly<Node> | undefined {
    return this.nodes.get(id);
  }

  has(id: NodeId): boolean {
    return this.nodes.has(id);
  }

  get size(): number {
    return this.nodes.size;
  }

  pages(): Readonly<Node>[] {
    return this.pageOrder.map((id) => this.nodes.get(id)).filter((n): n is Node => !!n);
  }

  /** Children of `parentId` in order. */
  children(parentId: NodeId): Readonly<Node>[] {
    const out: Node[] = [];
    for (const id of this.childIds.get(parentId) ?? []) {
      const n = this.nodes.get(id);
      if (n) out.push(n);
    }
    return out.sort((a, b) => (a.index < b.index ? -1 : a.index > b.index ? 1 : a.id < b.id ? -1 : 1));
  }

  /** `id` and everything under it, parents before children. */
  subtree(id: NodeId): Readonly<Node>[] {
    const root = this.nodes.get(id);
    if (!root) return [];
    const out: Node[] = [root];
    for (let i = 0; i < out.length; i++) out.push(...(this.children((out[i] as Node).id) as Node[]));
    return out;
  }

  // ---- history ----

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Label of the next undo, e.g. "Move 2 layers". */
  get undoLabel(): string | null {
    return this.undoStack.at(-1)?.label ?? null;
  }

  undo(): boolean {
    const change = this.undoStack.pop();
    if (!change) return false;
    const ops = [...change.ops].reverse().map(invert);
    for (const o of ops) this.apply(o);
    this.redoStack.push(change);
    this.emit({ label: change.label, ops, origin: "undo" });
    return true;
  }

  redo(): boolean {
    const change = this.redoStack.pop();
    if (!change) return false;
    for (const o of change.ops) this.apply(o);
    this.undoStack.push(change);
    this.emit({ label: change.label, ops: change.ops, origin: "redo" });
    return true;
  }

  // ---- changing ----

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Run `fn` as one undoable step. If `fn` throws, every operation it made
   * is rolled back and nothing is recorded.
   */
  transact<T>(label: string, fn: (tx: Transaction) => T): T {
    if (this.activeTx) return fn(this.activeTx); // nested calls join the outer step
    const tx = new Transaction(this);
    this.activeTx = tx;
    let result: T;
    try {
      result = fn(tx);
    } catch (err) {
      for (const o of [...tx.ops].reverse()) this.apply(invert(o));
      throw err;
    } finally {
      this.activeTx = null;
    }
    if (tx.ops.length) {
      const change: Change = { label, ops: tx.ops, origin: "edit" };
      this.undoStack.push(change);
      if (this.undoStack.length > this.historyLimit) this.undoStack.shift();
      this.redoStack = [];
      this.emit(change);
    }
    return result;
  }

  /** Apply one operation without recording history. Used by transactions, undo and loading. */
  apply(o: Operation): void {
    switch (o.op) {
      case "create": {
        if (this.nodes.has(o.node.id)) throw new DocumentError(`Node ${o.node.id} already exists.`);
        this.nodes.set(o.node.id, clone(o.node));
        this.link(o.node.id, o.node.parentId);
        if (o.node.type === "PAGE" && !this.pageOrder.includes(o.node.id)) this.insertPageOrder(o.node);
        return;
      }
      case "delete": {
        const existing = this.nodes.get(o.node.id);
        if (!existing) throw new DocumentError(`Node ${o.node.id} does not exist.`);
        this.unlink(existing.id, existing.parentId);
        this.nodes.delete(o.node.id);
        this.pageOrder = this.pageOrder.filter((id) => id !== o.node.id);
        return;
      }
      case "set": {
        const n = this.nodes.get(o.id);
        if (!n) throw new DocumentError(`Node ${o.id} does not exist.`);
        const rec = n as unknown as Record<string, unknown>;
        if (o.key === "parentId") {
          this.unlink(n.id, n.parentId);
          this.link(n.id, o.value as NodeId | null);
        }
        if (o.value === undefined) delete rec[o.key];
        else rec[o.key] = clone(o.value);
        if (n.type === "PAGE" && o.key === "index") {
          this.pageOrder = this.pageOrder.filter((id) => id !== n.id);
          this.insertPageOrder(n);
        }
        return;
      }
    }
  }

  private link(id: NodeId, parentId: NodeId | null): void {
    if (parentId === null) return;
    let set = this.childIds.get(parentId);
    if (!set) this.childIds.set(parentId, (set = new Set()));
    set.add(id);
  }

  private unlink(id: NodeId, parentId: NodeId | null): void {
    if (parentId === null) return;
    const set = this.childIds.get(parentId);
    set?.delete(id);
    if (set && set.size === 0) this.childIds.delete(parentId);
  }

  private insertPageOrder(page: Node): void {
    const i = this.pageOrder.findIndex((id) => (this.nodes.get(id)?.index ?? "") > page.index);
    if (i < 0) this.pageOrder.push(page.id);
    else this.pageOrder.splice(i, 0, page.id);
  }

  private emit(change: Change): void {
    for (const l of this.listeners) l(change);
  }

  // ---- files ----

  toFile(app = "Illigma 0.0.0"): IlligmaFile {
    return {
      manifest: {
        format: FORMAT_NAME,
        version: FORMAT_VERSION,
        fileId: this.fileId,
        name: this.name,
        pages: this.pages().map((p) => ({ id: p.id, name: p.name })),
        created: this.created,
        app,
      },
      nodes: [...this.nodes.values()].map(clone),
    };
  }

  /** Build a document from a file. History starts empty. */
  static fromFile(file: IlligmaFile, options: DocumentOptions = {}): Document {
    const doc = new Document(file.manifest.name, options);
    (doc as { fileId: string }).fileId = file.manifest.fileId;
    (doc as { created: string }).created = file.manifest.created;
    const order = new Map(file.manifest.pages.map((p, i) => [p.id, i]));
    const pages = file.nodes.filter((n) => n.type === "PAGE").sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    for (const n of file.nodes) {
      doc.nodes.set(n.id, clone(n));
      doc.link(n.id, n.parentId);
    }
    doc.pageOrder = pages.map((p) => p.id);
    return doc;
  }
}

/** The handle passed to `Document.transact`. Every method records an operation. */
export class Transaction {
  readonly ops: Operation[] = [];

  constructor(private readonly doc: Document) {}

  private record(o: Operation): void {
    this.doc.apply(o);
    this.ops.push(o);
  }

  /** Order key for a new child of `parentId` at `position`. */
  indexAt(parentId: NodeId | null, position: Position = "last", ignore?: NodeId): string {
    const siblings = (parentId === null ? this.doc.pages() : this.doc.children(parentId)).filter((n) => n.id !== ignore);
    if (position === "first") return keyBetween(null, siblings[0]?.index ?? null);
    if (position === "last") return keyBetween(siblings.at(-1)?.index ?? null, null);
    const ref = "before" in position ? position.before : position.after;
    const i = siblings.findIndex((n) => n.id === ref);
    if (i < 0) throw new DocumentError(`Node ${ref} is not a sibling here.`);
    return "before" in position
      ? keyBetween(siblings[i - 1]?.index ?? null, (siblings[i] as Node).index)
      : keyBetween((siblings[i] as Node).index, siblings[i + 1]?.index ?? null);
  }

  addPage(name = "Page", position: Position = "last"): NodeId {
    const id = newId();
    const node = defaultNode("PAGE", id, null, this.indexAt(null, position));
    node.name = name;
    this.record({ op: "create", node });
    return id;
  }

  /** Create a node under `parentId`. `fields` override the defaults. */
  create(type: NodeType, parentId: NodeId, fields: Partial<Omit<Node, "id" | "type" | "parentId" | "index">> = {}, position: Position = "last"): NodeId {
    if (type === "PAGE") throw new DocumentError("Use addPage to add a page.");
    if (!this.doc.has(parentId)) throw new DocumentError(`Parent ${parentId} does not exist.`);
    const id = newId();
    const node: Node = { ...defaultNode(type, id, parentId, this.indexAt(parentId, position)), ...clone(fields) };
    this.record({ op: "create", node });
    return id;
  }

  /** Change one field. Does nothing if the value is unchanged. */
  set<K extends NodeKey>(id: NodeId, key: K, value: Node[K]): void {
    const n = this.doc.get(id);
    if (!n) throw new DocumentError(`Node ${id} does not exist.`);
    if (key === "parentId" || key === "index") throw new DocumentError("Use move to change a node's parent or order.");
    const prev = (n as Node)[key];
    if (sameValue(prev, value)) return;
    this.record({ op: "set", id, key, value: clone(value), prev: clone(prev) });
  }

  /** Move `id` under `parentId` at `position`. */
  move(id: NodeId, parentId: NodeId, position: Position = "last"): void {
    const n = this.doc.get(id);
    if (!n) throw new DocumentError(`Node ${id} does not exist.`);
    if (n.type === "PAGE") throw new DocumentError("Pages can't be moved into other nodes.");
    if (this.doc.subtree(id).some((d) => d.id === parentId)) throw new DocumentError("A node can't be moved inside itself.");
    const index = this.indexAt(parentId, position, id);
    if (n.parentId !== parentId) this.record({ op: "set", id, key: "parentId", value: parentId, prev: n.parentId });
    if (n.index !== index) this.record({ op: "set", id, key: "index", value: index, prev: n.index });
  }

  /** Delete `id` and everything under it. */
  delete(id: NodeId): void {
    const all = this.doc.subtree(id);
    if (!all.length) throw new DocumentError(`Node ${id} does not exist.`);
    if (all[0]?.type === "PAGE" && this.doc.pages().length === 1) throw new DocumentError("A file must keep at least one page.");
    for (const n of [...all].reverse()) this.record({ op: "delete", node: clone(n as Node) });
  }
}
