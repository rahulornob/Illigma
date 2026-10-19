import {
  compareOrder,
  defaultNode,
  hashImage,
  FORMAT_NAME,
  FORMAT_VERSION,
  keyBetween,
  NODE_ID_PATTERN,
  NODE_KEYS,
  NODE_TYPES,
  validateFile,
  validateNode,
  validateNodeField,
  validateMeta,
  META_KEYS,
  type MetaKey,
  type Style,
  type VariablesData,
  type IlligmaFile,
  type Node,
  type NodeId,
  type NodeKey,
  type NodeType,
} from "@illigma/format";
import { newId } from "./ids.js";
import { clone, deepFreeze, frozenCopy, invert, sameValue, type DeepReadonly, type Operation, type ReadonlyNode } from "./operations.js";

/** A committed transaction: its operations in order, plus a label for the undo menu. */
export interface Change {
  readonly label: string;
  /** A private copy for each listener, so changing it can't rewrite history. */
  readonly ops: readonly Operation[];
  /**
   * "edit" for new work, "undo" and "redo" for history moves, "replay" for `Document.replay`.
   * "live" is an in-between step of a `LiveEdit` (a drag in progress): it is not history and
   * is not saved on its own; the whole drag arrives once more as one "edit" when it is committed.
   */
  readonly origin: "edit" | "undo" | "redo" | "replay" | "live";
}

export type Listener = (change: Change) => void;

/**
 * A hook that completes every edit before it is kept, such as layout filling
 * in positions and sizes. It gets the document (already showing the edit),
 * the edit's transaction and the operations made so far, and may record more
 * with `tx`; they become part of the same undo step. It runs:
 *
 * - at the end of each top-level `transact`, before the step is committed;
 * - at the end of each `LiveEdit.update` (each step of a drag);
 * - after `replay`, so replayed edits are completed too (without history).
 *
 * It never runs on undo or redo: their operations already hold what it added,
 * so they restore exact values. If it throws, the whole edit is rolled back.
 */
export type Normalizer = (doc: Document, tx: Transaction, ops: readonly Operation[]) => void;

export interface DocumentOptions {
  /** Maximum undo steps kept. PRD minimum is 100. */
  historyLimit?: number;
  /** Completes every edit before it is kept: see `Normalizer`. */
  normalize?: Normalizer | undefined;
}

export class DocumentError extends Error {
  override name = "DocumentError";
}

/** Where a node goes among its new siblings. */
export type Position = { before: NodeId } | { after: NodeId } | "first" | "last";

/** Fields `create` accepts. id, type, parentId and index are always set by `create` itself. */
export type CreateFields = Partial<DeepReadonly<Omit<Node, "id" | "type" | "parentId" | "index">>>;

const NO_IDS: readonly NodeId[] = Object.freeze([]);
const EMPTY_VARIABLES: DeepReadonly<VariablesData> = deepFreeze({ collections: [], variables: [] });
const FIXED_FIELDS = new Set<string>(["id", "type", "parentId", "index"]);
const KNOWN_FIELDS = new Set<string>(NODE_KEYS);

// Module-private access to Document and Transaction internals, set in their
// static blocks. Not exported, so plugins can't reach them.
let applyOp: (doc: Document, o: Operation) => void;
let siblingIds: (doc: Document, parentId: NodeId | null) => readonly NodeId[];
let siblingPos: (doc: Document, node: ReadonlyNode) => number;
let currentTx: (doc: Document) => Transaction | null;
let txOps: (tx: Transaction) => Operation[];
let liveUpdate: (doc: Document, edit: LiveEdit, tx: Transaction, fn: (tx: Transaction) => void) => void;
let liveEnd: (doc: Document, edit: LiveEdit, tx: Transaction, commit: boolean) => void;

/** Deep copy of a caller's value; values JSON can't hold become a DocumentError. */
function copyIn<T>(value: T): T {
  try {
    return clone(value);
  } catch (err) {
    throw new DocumentError(`The value can't be stored: ${(err as Error).message}`);
  }
}

/**
 * The in-memory document: a flat map of nodes keyed by id. Parents are ids,
 * sibling order is a fractional index. All changes go through `transact`.
 * Stored nodes are frozen; every change replaces a node object instead of
 * mutating it, so what `get` returns can be kept and compared by identity.
 */
export class Document {
  readonly fileId: string;
  name: string;
  readonly created: string;
  #nodes = new Map<NodeId, ReadonlyNode>();
  /** Child ids per parent (`null` holds the pages), kept sorted by index, then id. */
  #kids = new Map<NodeId | null, NodeId[]>();
  #undoStack: Change[] = [];
  #redoStack: Change[] = [];
  #listeners = new Set<Listener>();
  readonly #historyLimit: number;
  readonly #normalize: Normalizer | undefined;
  #tx: Transaction | null = null;
  #live: LiveEdit | null = null;
  /** Image files by hash (content-addressed, never changed). */
  #images = new Map<string, Uint8Array>();
  #imageListeners = new Set<(hash: string, bytes: Uint8Array) => void>();
  /** File-level definitions (manifest `styles`, `variables`), frozen; absent when none. */
  #meta: { styles?: DeepReadonly<Style[]>; variables?: DeepReadonly<VariablesData> } = {};

  static {
    applyOp = (doc, o) => doc.#apply(o);
    siblingIds = (doc, parentId) => doc.#kids.get(parentId) ?? NO_IDS;
    siblingPos = (doc, node) => doc.#find(doc.#kids.get(node.parentId) ?? NO_IDS, node);
    currentTx = (doc) => doc.#tx;
    liveUpdate = (doc, edit, tx, fn) => doc.#liveUpdate(edit, tx, fn);
    liveEnd = (doc, edit, tx, commit) => doc.#liveEnd(edit, tx, commit);
  }

  constructor(name = "Untitled", options: DocumentOptions = {}) {
    this.fileId = newId();
    this.name = name;
    this.created = new Date().toISOString();
    this.#historyLimit = Math.max(100, options.historyLimit ?? 200);
    this.#normalize = options.normalize;
  }

  /** The hook that completes every edit, if any (pass it on to a copy: `Document.fromFile(doc.toFile(), { normalize: doc.normalizer })`). */
  get normalizer(): Normalizer | undefined {
    return this.#normalize;
  }

  /** Let the normalizer complete what `tx` holds, recording with `tx`. Runs while `tx` is the open transaction. */
  #normalized(tx: Transaction): void {
    const ops = txOps(tx);
    if (this.#normalize && ops.length) this.#normalize(this, tx, ops.slice());
  }

  // ---- reading ----

  get(id: NodeId): ReadonlyNode | undefined {
    return this.#nodes.get(id);
  }

  has(id: NodeId): boolean {
    return this.#nodes.has(id);
  }

  get size(): number {
    return this.#nodes.size;
  }

  // ---- file-level definitions ----

  /** Local styles in panel order (empty when the file has none). */
  styles(): DeepReadonly<Style[]> {
    return this.#meta.styles ?? [];
  }

  /** Variable collections and variables. */
  variables(): DeepReadonly<VariablesData> {
    return this.#meta.variables ?? EMPTY_VARIABLES;
  }

  /** A definition list as stored, or undefined. */
  meta(key: MetaKey): unknown {
    return this.#meta[key];
  }

  // ---- images ----

  /**
   * Add an image file (PNG, JPEG, WebP or GIF, at most 32 MB) and return its
   * `imageHash`, for IMAGE paints. Images are stored once per hash and are not
   * part of undo history: adding one changes nothing on the canvas until a
   * paint uses it, and saving writes only images some paint uses. Throws
   * `FormatError` for anything else. Don't change `bytes` afterwards.
   */
  addImage(bytes: Uint8Array): string {
    const hash = hashImage(bytes);
    if (this.#images.has(hash)) return hash; // the bytes already held are kept: no second copy
    this.#images.set(hash, bytes);
    for (const listener of this.#imageListeners) listener(hash, bytes);
    return hash;
  }

  /**
   * Call `listener` for each image added from now on (`addImage` with bytes
   * the document didn't hold yet), synchronously, before any edit can use
   * it. The recovery journal keeps a copy, so an image added after the last
   * save survives a crash. Returns a function that stops listening.
   */
  subscribeImages(listener: (hash: string, bytes: Uint8Array) => void): () => void {
    this.#imageListeners.add(listener);
    return () => this.#imageListeners.delete(listener);
  }

  /** Hashes of every image the document holds, used or not. */
  imageHashes(): string[] {
    return [...this.#images.keys()];
  }

  /** The image file for an `imageHash`, if this document has it. */
  image(hash: string): Uint8Array | undefined {
    return this.#images.get(hash);
  }

  pages(): ReadonlyNode[] {
    return this.#list(null);
  }

  /** Children of `parentId` in order. */
  children(parentId: NodeId): ReadonlyNode[] {
    return this.#list(parentId);
  }

  /** `id` and everything under it, parents before children. */
  subtree(id: NodeId): ReadonlyNode[] {
    const root = this.#nodes.get(id);
    if (!root) return [];
    const out: ReadonlyNode[] = [root];
    for (let i = 0; i < out.length; i++) {
      // A loop, not push(...ids): spreading 100k+ arguments overflows the stack.
      for (const cid of this.#kids.get((out[i] as ReadonlyNode).id) ?? NO_IDS) out.push(this.#nodes.get(cid) as ReadonlyNode);
    }
    return out;
  }

  #list(parentId: NodeId | null): ReadonlyNode[] {
    const ids = this.#kids.get(parentId) ?? NO_IDS;
    const out = new Array<ReadonlyNode>(ids.length);
    for (let i = 0; i < ids.length; i++) out[i] = this.#nodes.get(ids[i] as NodeId) as ReadonlyNode;
    return out;
  }

  // ---- history ----

  get canUndo(): boolean {
    return this.#undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.#redoStack.length > 0;
  }

  /** Label of the next undo, e.g. "Move 2 layers". */
  get undoLabel(): string | null {
    return this.#undoStack.at(-1)?.label ?? null;
  }

  undo(): boolean {
    this.#assertIdle("undo");
    const change = this.#undoStack.at(-1);
    if (!change) return false;
    const ops = deepFreeze([...change.ops].reverse().map(invert));
    this.#applyAll(ops); // all or nothing: on failure the entry stays on the stack
    this.#undoStack.pop();
    this.#redoStack.push(change);
    this.#emit(change.label, ops, "undo");
    return true;
  }

  redo(): boolean {
    this.#assertIdle("redo");
    const change = this.#redoStack.at(-1);
    if (!change) return false;
    this.#applyAll(change.ops);
    this.#redoStack.pop();
    this.#undoStack.push(change);
    this.#emit(change.label, change.ops, "redo");
    return true;
  }

  // ---- changing ----

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /**
   * Run `fn` as one undoable step. If `fn` throws, every operation it made
   * is rolled back and nothing is recorded. A nested call joins the outer
   * step; if it throws, only its own operations are rolled back.
   */
  transact<T>(label: string, fn: (tx: Transaction) => T): T {
    const outer = this.#tx;
    if (!outer && this.#live) throw new DocumentError("Can't start a transaction while a live edit is open.");
    if (outer) {
      const ops = txOps(outer);
      const start = ops.length;
      try {
        return fn(outer);
      } catch (err) {
        this.#rollback(ops, start);
        throw err;
      }
    }
    const tx = new Transaction(this);
    this.#tx = tx;
    let result: T;
    try {
      result = fn(tx);
      this.#normalized(tx);
    } catch (err) {
      this.#rollback(txOps(tx), 0);
      throw err;
    } finally {
      this.#tx = null;
    }
    this.#commit(label, txOps(tx));
    return result;
  }

  /** Record `ops` (already applied) as one undo step and tell listeners. */
  #commit(label: string, ops: Operation[]): void {
    if (!ops.length) return;
    const change: Change = Object.freeze({ label, ops: Object.freeze(ops), origin: "edit" as const });
    this.#undoStack.push(change);
    if (this.#undoStack.length > this.#historyLimit) this.#undoStack.shift();
    this.#redoStack = [];
    this.#emit(label, change.ops, "edit");
  }

  /** The live edit in progress (a drag on the canvas), or null. */
  get live(): LiveEdit | null {
    return this.#live;
  }

  /**
   * Start a live edit: a change that is redone many times while the person
   * drags (move, resize), then kept as one undo step with `commit()` or
   * thrown away with `cancel()`. Each `update(fn)` first undoes what the
   * previous update did, then runs `fn` from the state the edit started in,
   * so the document always shows the latest step. Listeners see each step as
   * a "live" change, and the whole edit once more as an "edit" on commit.
   * While it is open, `transact`, `undo`, `redo` and `replay` are refused.
   */
  beginLive(label: string): LiveEdit {
    this.#assertIdle("start a live edit");
    const edit = new LiveEdit(this, label);
    this.#live = edit;
    return edit;
  }

  #liveUpdate(edit: LiveEdit, tx: Transaction, fn: (tx: Transaction) => void): void {
    if (this.#live !== edit) throw new DocumentError("This live edit has already ended.");
    if (this.#tx) throw new DocumentError("Can't update a live edit inside a transaction.");
    const ops = txOps(tx);
    const before = ops.slice();
    const undone = before.map(invert).reverse();
    this.#rollback(ops, 0);
    this.#tx = tx;
    try {
      fn(tx);
      this.#normalized(tx);
    } catch (err) {
      // Back to where the previous update left it, as if this one never ran.
      this.#rollback(ops, 0);
      this.#applyAll(before);
      ops.push(...before);
      throw err;
    } finally {
      this.#tx = null;
    }
    if (undone.length || ops.length) this.#emit(edit.label, deepFreeze([...undone, ...ops]), "live");
  }

  #liveEnd(edit: LiveEdit, tx: Transaction, commit: boolean): void {
    if (this.#live !== edit) throw new DocumentError("This live edit has already ended.");
    this.#live = null;
    const ops = txOps(tx);
    if (commit) {
      this.#commit(edit.label, ops.slice());
      ops.length = 0;
      return;
    }
    const undone = deepFreeze(ops.map(invert).reverse());
    this.#rollback(ops, 0);
    if (undone.length) this.#emit(edit.label, undone, "live");
  }

  /**
   * Apply operations recorded elsewhere (a recovery journal, later sync)
   * without adding undo history. Each operation is checked first; if one is
   * invalid or fails, those already applied are undone and the error is thrown.
   */
  replay(ops: readonly Operation[]): void {
    this.#assertIdle("replay operations");
    const done: Operation[] = [];
    const parents = new Set<NodeId | null>();
    try {
      for (const raw of ops) {
        const o = this.#checked(raw);
        this.#apply(o);
        done.push(o);
        if (o.op === "create") parents.add(o.node.parentId);
        else if (o.op === "set" && (o.key === "parentId" || o.key === "index")) parents.add(this.#nodes.get(o.id)?.parentId ?? null);
      }
      // Checked at the end: a move sets parentId before index, so siblings may share an index in between.
      const shared = this.#sharedIndex(parents);
      if (shared !== undefined) throw new DocumentError(`Can't replay: two children of ${shared ?? "the file"} would share a position.`);
      if (this.#normalize && done.length) {
        // Replayed edits are completed like new ones: they may come from before the normalizer existed, or from elsewhere.
        const tx = new Transaction(this);
        this.#tx = tx;
        try {
          this.#normalize(this, tx, done.slice());
        } catch (err) {
          this.#rollback(txOps(tx), 0);
          throw err;
        } finally {
          this.#tx = null;
        }
        done.push(...txOps(tx));
      }
    } catch (err) {
      this.#rollback(done, 0);
      throw err;
    }
    if (done.length) this.#emit("Replay", done, "replay");
  }

  /** A frozen copy of an outside operation, checked against the current document. */
  #checked(raw: Operation): Operation {
    const o = copyIn(raw) as Operation;
    const fail = (why: string): never => {
      throw new DocumentError(`Can't replay ${JSON.stringify(raw)?.slice(0, 200)}: ${why}`);
    };
    if (!o || typeof o !== "object") return fail("it is not an operation.");
    switch (o.op) {
      case "create": {
        const problems = validateNode(o.node);
        if (problems.length) return fail(problems.join("; ") + ".");
        const n = o.node as Node;
        if (this.#nodes.has(n.id)) fail(`node ${n.id} already exists.`);
        if ((n.type === "PAGE") !== (n.parentId === null)) fail("only pages have no parent.");
        if (n.parentId !== null && !this.#nodes.has(n.parentId)) fail(`parent ${n.parentId} does not exist.`);
        return deepFreeze(o);
      }
      case "delete": {
        const id = (o.node as { id?: unknown } | undefined)?.id;
        if (typeof id !== "string" || !this.#nodes.has(id)) fail(`node ${String(id)} does not exist.`);
        // History needs the node as it is now, not as the operation remembers it.
        return deepFreeze({ op: "delete", node: this.#nodes.get(id as string) as ReadonlyNode });
      }
      case "set": {
        const n = this.#nodes.get(o.id);
        if (!n) return fail(`node ${o.id} does not exist.`);
        if (o.key === ("id" as NodeKey) || o.key === ("type" as NodeKey)) fail(`"${o.key}" can't change.`);
        const problem = validateNodeField(o.key, o.value);
        if (problem) fail(problem + ".");
        if (o.key === "parentId") {
          const p = o.value as NodeId | null;
          if ((p === null) !== (n.type === "PAGE")) fail("only pages have no parent.");
          for (let cur = p; cur !== null; cur = this.#nodes.get(cur)?.parentId ?? null) {
            if (cur === n.id) fail("a node can't be moved inside itself.");
            if (!this.#nodes.has(cur)) fail(`parent ${cur} does not exist.`);
          }
        }
        return deepFreeze({ op: "set", id: o.id, key: o.key, value: o.value, prev: n[o.key] });
      }
      case "meta": {
        if (!META_KEYS.includes(o.key)) return fail(`unknown definition "${String(o.key)}".`);
        if (o.value !== undefined) {
          const problem = validateMeta(o.key, o.value);
          if (problem) fail(problem + ".");
        }
        return deepFreeze({ op: "meta", key: o.key, value: o.value, prev: this.#meta[o.key] });
      }
      default:
        return fail("unknown operation.");
    }
  }

  /** Apply one operation without recording history. Callers check it first. */
  #apply(o: Operation): void {
    switch (o.op) {
      case "create": {
        if (this.#nodes.has(o.node.id)) throw new DocumentError(`Node ${o.node.id} already exists.`);
        const node = deepFreeze(o.node);
        this.#nodes.set(node.id, node);
        this.#link(node);
        return;
      }
      case "delete": {
        const existing = this.#nodes.get(o.node.id);
        if (!existing) throw new DocumentError(`Node ${o.node.id} does not exist.`);
        if (this.#kids.has(existing.id)) throw new DocumentError(`Node ${existing.id} still has children.`);
        this.#unlink(existing);
        this.#nodes.delete(existing.id);
        return;
      }
      case "set": {
        const n = this.#nodes.get(o.id);
        if (!n) throw new DocumentError(`Node ${o.id} does not exist.`);
        // Build a new frozen node; the old object stays as it was.
        const next = { ...n } as Record<string, unknown>;
        if (o.value === undefined) delete next[o.key];
        else next[o.key] = deepFreeze(o.value);
        const node = Object.freeze(next) as unknown as ReadonlyNode;
        const relink = o.key === "parentId" || o.key === "index";
        if (relink) this.#unlink(n);
        this.#nodes.set(n.id, node);
        if (relink) this.#link(node);
        return;
      }
      case "meta": {
        if (o.value === undefined) delete this.#meta[o.key];
        else (this.#meta as Record<string, unknown>)[o.key] = deepFreeze(o.value);
        return;
      }
    }
  }

  /** Apply `ops` in order; if one fails, undo the ones before it and rethrow. */
  #applyAll(ops: readonly Operation[]): void {
    let i = 0;
    try {
      for (; i < ops.length; i++) this.#apply(ops[i] as Operation);
    } catch (err) {
      for (let j = i - 1; j >= 0; j--) this.#apply(invert(ops[j] as Operation));
      throw err;
    }
  }

  /** Undo `ops` from the end back to `start`, and drop them. */
  #rollback(ops: Operation[], start: number): void {
    for (let i = ops.length - 1; i >= start; i--) this.#apply(invert(ops[i] as Operation));
    ops.length = start;
  }

  /** Position of `node` in sorted `ids`, or where it would go (binary search). */
  #find(ids: readonly NodeId[], node: ReadonlyNode): number {
    let lo = 0;
    let hi = ids.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (compareOrder(this.#nodes.get(ids[mid] as NodeId) as ReadonlyNode, node) < 0) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /** A parent among `parents` with two children sharing an index, or `undefined`. */
  #sharedIndex(parents: Iterable<NodeId | null>): NodeId | null | undefined {
    for (const p of parents) {
      const ids = this.#kids.get(p) ?? NO_IDS;
      // Sorted by index, so equal indexes sit next to each other.
      for (let i = 1; i < ids.length; i++) {
        if (this.#nodes.get(ids[i] as NodeId)?.index === this.#nodes.get(ids[i - 1] as NodeId)?.index) return p;
      }
    }
    return undefined;
  }

  #link(node: ReadonlyNode): void {
    let ids = this.#kids.get(node.parentId);
    if (!ids) this.#kids.set(node.parentId, (ids = []));
    const last = ids.length ? this.#nodes.get(ids[ids.length - 1] as NodeId) : undefined;
    // Appending is the common case and costs O(1).
    if (!last || compareOrder(last, node) < 0) ids.push(node.id);
    else ids.splice(this.#find(ids, node), 0, node.id);
  }

  /** Remove `node` from its parent's list. `node` is the stored object, before any change. */
  #unlink(node: ReadonlyNode): void {
    const ids = this.#kids.get(node.parentId);
    if (!ids) return;
    let i = ids.length - 1;
    if (ids[i] !== node.id) i = this.#find(ids, node);
    if (ids[i] !== node.id) i = ids.indexOf(node.id);
    if (i >= 0) ids.splice(i, 1);
    if (ids.length === 0) this.#kids.delete(node.parentId);
  }

  #assertIdle(what: string): void {
    if (this.#tx) throw new DocumentError(`Can't ${what} while a transaction is running.`);
    if (this.#live) throw new DocumentError(`Can't ${what} while a live edit is open.`);
  }

  #emit(label: string, ops: readonly Operation[], origin: Change["origin"]): void {
    for (const listener of this.#listeners) {
      // Each listener gets its own copy of the operations, made only if it reads them.
      let copy: Operation[] | undefined;
      listener({
        label,
        origin,
        get ops() {
          return (copy ??= structuredClone(ops) as Operation[]);
        },
      });
    }
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
        // Written only when present, so files without definitions save exactly as before.
        ...(this.#meta.styles?.length ? { styles: clone(this.#meta.styles) as Style[] } : {}),
        ...(this.#meta.variables && (this.#meta.variables.collections.length || this.#meta.variables.variables.length)
          ? { variables: clone(this.#meta.variables) as VariablesData }
          : {}),
      },
      nodes: [...this.#nodes.values()].map((n) => clone(n) as Node),
      // Every image, used or not (undo may bring a paint back); writePackage keeps only those in use. The bytes are shared, never changed.
      ...(this.#images.size ? { images: new Map(this.#images) } : {}),
    };
  }

  /** Build a document from a file. Throws `DocumentError` if the file is invalid. History starts empty. */
  static fromFile(file: IlligmaFile, options: DocumentOptions = {}): Document {
    const problems = validateFile(file);
    if (problems.length) throw new DocumentError(`The file is not valid:\n- ${problems.join("\n- ")}`);
    const doc = new Document(file.manifest.name, options);
    (doc as { fileId: string }).fileId = file.manifest.fileId;
    (doc as { created: string }).created = file.manifest.created;
    if (file.images) doc.#images = new Map(file.images);
    if (file.manifest.styles) doc.#meta.styles = frozenCopy(file.manifest.styles);
    if (file.manifest.variables) doc.#meta.variables = frozenCopy(file.manifest.variables);
    for (const n of file.nodes) {
      const node = frozenCopy(n);
      doc.#nodes.set(node.id, node);
      let ids = doc.#kids.get(node.parentId);
      if (!ids) doc.#kids.set(node.parentId, (ids = []));
      ids.push(node.id);
    }
    // Sort each sibling list once; pages come out in index order too.
    const nodes = doc.#nodes;
    const order = (a: NodeId, b: NodeId) => compareOrder(nodes.get(a) as ReadonlyNode, nodes.get(b) as ReadonlyNode);
    for (const ids of doc.#kids.values()) ids.sort(order);
    return doc;
  }
}

/**
 * A change that follows a drag: see `Document.beginLive`. Call `update` on
 * every pointer move, then `commit` (one undo step) or `cancel` (as if it
 * never happened).
 */
export class LiveEdit {
  readonly #doc: Document;
  readonly #tx: Transaction;
  #label: string;

  constructor(doc: Document, label: string) {
    this.#doc = doc;
    this.#label = label;
    this.#tx = new Transaction(doc);
  }

  /** The undo label, e.g. "Move 2 layers". */
  get label(): string {
    return this.#label;
  }

  /** True until `commit` or `cancel`. */
  get open(): boolean {
    return this.#doc.live === this;
  }

  /** The operations the edit holds now, from the state it started in. */
  get ops(): readonly Operation[] {
    return this.#tx.ops;
  }

  /** Replace the previous step with `fn`'s changes. If `fn` throws, the previous step stays and the error is rethrown. */
  update(fn: (tx: Transaction) => void): void {
    liveUpdate(this.#doc, this, this.#tx, fn);
  }

  /** Keep the edit as one undo step (nothing is recorded if it changed nothing). `label` replaces the starting label. */
  commit(label?: string): void {
    if (label !== undefined) this.#label = label;
    liveEnd(this.#doc, this, this.#tx, true);
  }

  /** Undo every step and end the edit; no history is recorded. */
  cancel(): void {
    liveEnd(this.#doc, this, this.#tx, false);
  }
}

/** The handle passed to `Document.transact`. Every method records an operation. */
export class Transaction {
  readonly #doc: Document;
  #ops: Operation[] = [];

  static {
    txOps = (tx) => tx.#ops;
  }

  constructor(doc: Document) {
    this.#doc = doc;
  }

  /** The operations recorded so far. */
  get ops(): readonly Operation[] {
    return this.#ops;
  }

  #record(o: Operation): void {
    if (currentTx(this.#doc) !== this) throw new DocumentError("This transaction has already ended.");
    const op = deepFreeze(o);
    applyOp(this.#doc, op);
    this.#ops.push(op);
  }

  /** Order key for a new child of `parentId` at `position`. */
  indexAt(parentId: NodeId | null, position: Position = "last", ignore?: NodeId): string {
    const ids = siblingIds(this.#doc, parentId);
    const key = (i: number) => (i >= 0 && i < ids.length ? (this.#doc.get(ids[i] as NodeId) as ReadonlyNode).index : null);
    if (position === "first") return keyBetween(null, key(ids[0] === ignore ? 1 : 0));
    if (position === "last") return keyBetween(key(ids.length - (ids.at(-1) === ignore ? 2 : 1)), null);
    const refId = "before" in position ? position.before : position.after;
    const ref = refId === ignore ? undefined : this.#doc.get(refId);
    if (!ref || ref.parentId !== parentId) throw new DocumentError(`Node ${refId} is not a sibling here.`);
    const i = siblingPos(this.#doc, ref);
    if ("before" in position) return keyBetween(key(ids[i - 1] === ignore ? i - 2 : i - 1), ref.index);
    return keyBetween(ref.index, key(ids[i + 1] === ignore ? i + 2 : i + 1));
  }

  addPage(name = "Page", position: Position = "last"): NodeId {
    const id = newId();
    const node = defaultNode("PAGE", id, null, this.indexAt(null, position));
    node.name = name;
    this.#record({ op: "create", node: this.#valid(node) });
    return id;
  }

  /**
   * Create a node under `parentId`. `fields` override the defaults; id,
   * type, parentId and index in `fields` are ignored, and unknown keys are refused.
   * `id` gives the new node a chosen id (one no node has): a live edit that
   * creates a node on every `update` keeps the same id throughout.
   */
  create(type: NodeType, parentId: NodeId, fields: CreateFields = {}, position: Position = "last", id: NodeId = newId()): NodeId {
    if (type === "PAGE") throw new DocumentError("Use addPage to add a page.");
    if (!NODE_TYPES.includes(type)) throw new DocumentError(`Unknown node type "${String(type)}".`);
    if (!this.#doc.has(parentId)) throw new DocumentError(`Parent ${parentId} does not exist.`);
    if (!fields || typeof fields !== "object") throw new DocumentError("Node fields must be an object.");
    const unknown = Object.keys(fields).filter((k) => !KNOWN_FIELDS.has(k));
    if (unknown.length) throw new DocumentError(`Unknown node field${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}.`);
    const own = copyIn(fields) as Record<string, unknown>;
    for (const k of FIXED_FIELDS) delete own[k];
    if (typeof id !== "string" || !NODE_ID_PATTERN.test(id)) throw new DocumentError(`"${String(id).slice(0, 64)}" is not a valid node id.`);
    if (this.#doc.has(id)) throw new DocumentError(`Node ${id} already exists.`);
    const node = { ...defaultNode(type, id, parentId, "a0"), ...own, id, type, parentId, index: this.indexAt(parentId, position) } as Node;
    this.#record({ op: "create", node: this.#valid(node) });
    return id;
  }

  #valid(node: Node): Node {
    const problems = validateNode(node);
    if (problems.length) throw new DocumentError(`Can't create the node: ${problems.join("; ")}.`);
    return node;
  }

  /** Change one field. Does nothing if the value is unchanged. */
  set<K extends NodeKey>(id: NodeId, key: K, value: DeepReadonly<Node[K]>): void {
    const n = this.#doc.get(id);
    if (!n) throw new DocumentError(`Node ${id} does not exist.`);
    if (key === "parentId" || key === "index") throw new DocumentError("Use move to change a node's parent or order.");
    if (FIXED_FIELDS.has(key)) throw new DocumentError(`A node's "${key}" can't change.`);
    const v = copyIn(value);
    const problem = validateNodeField(key, v);
    if (problem) throw new DocumentError(`Can't set ${key} on node ${id}: ${problem}.`);
    const prev = n[key];
    if (sameValue(prev, v)) return;
    this.#record({ op: "set", id, key, value: v, prev });
  }

  /**
   * Replace a file-level definition list (`styles` or `variables`) as a
   * whole. The value is checked (variable alias loops are refused);
   * `undefined` removes it. Does nothing if unchanged.
   */
  setMeta(key: MetaKey, value: unknown): void {
    if (!META_KEYS.includes(key)) throw new DocumentError(`"${String(key)}" is not a file definition.`);
    const v = copyIn(value);
    if (v !== undefined) {
      const problem = validateMeta(key, v);
      if (problem) throw new DocumentError(`Can't set ${key}: ${problem}.`);
    }
    const prev = this.#doc.meta(key);
    if (sameValue(prev, v)) return;
    this.#record({ op: "meta", key, value: v, prev });
  }

  /** Move `id` under `parentId` at `position`. */
  move(id: NodeId, parentId: NodeId, position: Position = "last"): void {
    const n = this.#doc.get(id);
    if (!n) throw new DocumentError(`Node ${id} does not exist.`);
    if (n.type === "PAGE") throw new DocumentError("Pages can't be moved into other nodes.");
    if (!this.#doc.has(parentId)) throw new DocumentError(`Parent ${parentId} does not exist.`);
    for (let cur: NodeId | null = parentId; cur !== null; cur = this.#doc.get(cur)?.parentId ?? null) {
      if (cur === id) throw new DocumentError("A node can't be moved inside itself.");
    }
    const index = this.indexAt(parentId, position, id);
    if (n.parentId !== parentId) this.#record({ op: "set", id, key: "parentId", value: parentId, prev: n.parentId });
    if (n.index !== index) this.#record({ op: "set", id, key: "index", value: index, prev: n.index });
  }

  /** Move page `id` to `position` among the pages (pages have no parent, so `move` can't take them). */
  movePage(id: NodeId, position: Position): void {
    const n = this.#doc.get(id);
    if (!n || n.type !== "PAGE") throw new DocumentError(`Page ${id} does not exist.`);
    const index = this.indexAt(null, position, id);
    if (n.index !== index) this.#record({ op: "set", id, key: "index", value: index, prev: n.index });
  }

  /** Delete `id` and everything under it. */
  delete(id: NodeId): void {
    const all = this.#doc.subtree(id);
    if (!all.length) throw new DocumentError(`Node ${id} does not exist.`);
    if (all[0]?.type === "PAGE" && this.#doc.pages().length === 1) throw new DocumentError("A file must keep at least one page.");
    for (let i = all.length - 1; i >= 0; i--) this.#record({ op: "delete", node: all[i] as ReadonlyNode });
  }
}
