/**
 * An in-memory fake of the File System Access API and OPFS handles, for
 * tests that run in Node. It follows the browser behaviour that matters for
 * saving: `createWritable()` writes to a swap copy and only replaces the
 * file on `close()`, so an aborted or failed stream leaves the file as it was.
 *
 *   const fs = new FakeFileSystem();
 *   const backend = opfsBackend("f1", "Test", fs.root);
 *   fs.failWhen = (op) => op.kind === "close" && op.path.startsWith("files/f1/pages/");
 *
 * Covered: getDirectoryHandle, getFileHandle, removeEntry, entries / keys /
 * values / async iteration, isSameEntry, resolve, queryPermission /
 * requestPermission, createWritable (write, seek, truncate, close, abort)
 * and getFile (text, arrayBuffer, size, lastModified).
 */

/** One filesystem call, passed to `FakeFileSystem.failWhen`. Paths are relative to the root, "/"-separated. */
export interface FakeFsOp {
  kind: "getDirectory" | "getFile" | "createWritable" | "write" | "close" | "read" | "remove" | "list";
  path: string;
}

type Permission = "granted" | "denied" | "prompt";

class FileEntry {
  readonly kind = "file";
  constructor(
    public data: Uint8Array = new Uint8Array(0),
    public lastModified = Date.now(),
  ) {}
}

class DirEntry {
  readonly kind = "directory";
  readonly children = new Map<string, FileEntry | DirEntry>();
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function domError(name: string, message: string): DOMException {
  return new DOMException(message, name);
}

function checkName(name: string): void {
  if (typeof name !== "string" || name === "" || name === "." || name === ".." || name.includes("/") || name.includes("\\")) {
    throw new TypeError(`Name is not allowed: "${name}"`);
  }
}

function join(path: string, name: string): string {
  return path ? `${path}/${name}` : name;
}

export class FakeFileSystem {
  /** The root directory handle; pass it wherever a `FileSystemDirectoryHandle` is expected. */
  readonly root: FileSystemDirectoryHandle;
  /** Return true (or an error to throw) to make that call fail. Checked before every call. */
  failWhen: ((op: FakeFsOp) => boolean | Error | undefined) | null = null;
  /** What queryPermission / requestPermission answer. */
  permission: Permission = "granted";
  /** Every call made, in order. */
  readonly log: FakeFsOp[] = [];
  private readonly top = new DirEntry();

  constructor(rootName = "") {
    this.root = new FakeDirectoryHandle(this, this.top, rootName, "") as unknown as FileSystemDirectoryHandle;
  }

  /** @internal */
  check(kind: FakeFsOp["kind"], path: string): void {
    const op = { kind, path };
    this.log.push(op);
    const result = this.failWhen?.(op);
    if (result instanceof Error) throw result;
    if (result) throw domError("InvalidStateError", `Simulated failure: ${kind} ${path}`);
  }

  /** Text of the file at `path`, or undefined if there is none. */
  readText(path: string): string | undefined {
    const e = this.lookup(path);
    return e instanceof FileEntry ? decoder.decode(e.data) : undefined;
  }

  /** Create or replace the file at `path`, making folders as needed. Not subject to `failWhen`. */
  writeText(path: string, text: string): void {
    const parts = path.split("/");
    const name = parts.pop() as string;
    let dir = this.top;
    for (const p of parts) {
      let next = dir.children.get(p);
      if (!next) dir.children.set(p, (next = new DirEntry()));
      if (!(next instanceof DirEntry)) throw new Error(`${p} is a file`);
      dir = next;
    }
    dir.children.set(name, new FileEntry(encoder.encode(text)));
  }

  /** Bytes of the file at `path`, or undefined if there is none. */
  readBytes(path: string): Uint8Array | undefined {
    const e = this.lookup(path);
    return e instanceof FileEntry ? e.data.slice() : undefined;
  }

  /** Create or replace the file at `path` with bytes, making folders as needed. Not subject to `failWhen`. */
  writeBytes(path: string, bytes: Uint8Array): void {
    this.writeText(path, "");
    const parts = path.split("/");
    const name = parts.pop() as string;
    const dir = this.lookup(parts.join("/")) as DirEntry;
    dir.children.set(name, new FileEntry(bytes.slice()));
  }

  /** True if a file or folder exists at `path`. */
  exists(path: string): boolean {
    return this.lookup(path) !== undefined;
  }

  /** Paths of all files under `prefix` (default: everything), sorted. */
  paths(prefix = ""): string[] {
    const out: string[] = [];
    const walk = (dir: DirEntry, path: string) => {
      for (const [name, e] of dir.children) {
        const p = join(path, name);
        if (e instanceof DirEntry) walk(e, p);
        else out.push(p);
      }
    };
    walk(this.top, "");
    return out.filter((p) => p.startsWith(prefix)).sort();
  }

  private lookup(path: string): FileEntry | DirEntry | undefined {
    let cur: FileEntry | DirEntry | undefined = this.top;
    for (const p of path.split("/").filter(Boolean)) {
      if (!(cur instanceof DirEntry)) return undefined;
      cur = cur.children.get(p);
    }
    return cur;
  }
}

abstract class FakeHandle {
  abstract readonly kind: "file" | "directory";
  constructor(
    protected readonly fs: FakeFileSystem,
    readonly name: string,
    /** @internal path from the root */
    readonly path: string,
  ) {}

  async isSameEntry(other: FileSystemHandle): Promise<boolean> {
    const o = other as unknown as FakeHandle;
    return o instanceof FakeHandle && o.fs === this.fs && o.kind === this.kind && o.path === this.path;
  }

  async queryPermission(_desc?: { mode?: "read" | "readwrite" }): Promise<Permission> {
    return this.fs.permission;
  }

  async requestPermission(_desc?: { mode?: "read" | "readwrite" }): Promise<Permission> {
    return this.fs.permission;
  }
}

class FakeFileHandle extends FakeHandle {
  readonly kind = "file" as const;

  constructor(
    fs: FakeFileSystem,
    private readonly parent: DirEntry,
    name: string,
    path: string,
  ) {
    super(fs, name, path);
  }

  private entry(): FileEntry {
    const e = this.parent.children.get(this.name);
    if (!(e instanceof FileEntry)) throw domError("NotFoundError", `File not found: ${this.path}`);
    return e;
  }

  async getFile(): Promise<File> {
    this.fs.check("read", this.path);
    const e = this.entry();
    return new File([e.data.slice()], this.name, { lastModified: e.lastModified });
  }

  async createWritable(options: { keepExistingData?: boolean } = {}): Promise<FileSystemWritableFileStream> {
    this.fs.check("createWritable", this.path);
    const start = options.keepExistingData ? this.entry().data.slice() : new Uint8Array(0);
    if (!options.keepExistingData) this.entry(); // must exist
    return new FakeWritable(this.fs, this.path, start, (data) => {
      const existing = this.parent.children.get(this.name);
      if (existing instanceof FileEntry) {
        existing.data = data;
        existing.lastModified = Date.now();
      } else {
        this.parent.children.set(this.name, new FileEntry(data));
      }
    }) as unknown as FileSystemWritableFileStream;
  }
}

type WriteData = string | ArrayBuffer | ArrayBufferView | Blob;
type WriteParams =
  | { type: "write"; data: WriteData; position?: number }
  | { type: "seek"; position: number }
  | { type: "truncate"; size: number };

class FakeWritable {
  private cursor = 0;
  private state: "open" | "closed" | "aborted" = "open";

  constructor(
    private readonly fs: FakeFileSystem,
    private readonly path: string,
    private data: Uint8Array,
    private readonly commit: (data: Uint8Array) => void,
  ) {}

  private assertOpen(): void {
    if (this.state !== "open") throw new TypeError("The stream is closed.");
  }

  async write(chunk: WriteData | WriteParams): Promise<void> {
    this.assertOpen();
    if (typeof chunk === "object" && chunk !== null && "type" in chunk && !(chunk instanceof Blob)) {
      if (chunk.type === "seek") return this.seek(chunk.position);
      if (chunk.type === "truncate") return this.truncate(chunk.size);
      if (chunk.position !== undefined) this.cursor = chunk.position;
      return this.write(chunk.data);
    }
    this.fs.check("write", this.path);
    const bytes = await toBytes(chunk);
    const end = this.cursor + bytes.length;
    if (end > this.data.length) {
      const grown = new Uint8Array(end);
      grown.set(this.data);
      this.data = grown;
    }
    this.data.set(bytes, this.cursor);
    this.cursor = end;
  }

  async seek(position: number): Promise<void> {
    this.assertOpen();
    this.cursor = position;
  }

  async truncate(size: number): Promise<void> {
    this.assertOpen();
    const next = new Uint8Array(size);
    next.set(this.data.subarray(0, size));
    this.data = next;
    if (this.cursor > size) this.cursor = size;
  }

  async close(): Promise<void> {
    this.assertOpen();
    try {
      this.fs.check("close", this.path);
    } catch (err) {
      this.state = "aborted"; // a failed close discards the swap copy, like the browser
      throw err;
    }
    this.state = "closed";
    this.commit(this.data);
  }

  async abort(): Promise<void> {
    this.state = "aborted";
  }
}

async function toBytes(chunk: WriteData): Promise<Uint8Array> {
  if (typeof chunk === "string") return encoder.encode(chunk);
  if (chunk instanceof Blob) return new Uint8Array(await chunk.arrayBuffer());
  if (chunk instanceof ArrayBuffer) return new Uint8Array(chunk.slice(0));
  return new Uint8Array(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength));
}

class FakeDirectoryHandle extends FakeHandle {
  readonly kind = "directory" as const;

  constructor(
    fs: FakeFileSystem,
    private readonly dir: DirEntry,
    name: string,
    path: string,
  ) {
    super(fs, name, path);
  }

  async getDirectoryHandle(name: string, options: { create?: boolean } = {}): Promise<FileSystemDirectoryHandle> {
    checkName(name);
    const path = join(this.path, name);
    this.fs.check("getDirectory", path);
    let e = this.dir.children.get(name);
    if (!e) {
      if (!options.create) throw domError("NotFoundError", `Folder not found: ${path}`);
      this.dir.children.set(name, (e = new DirEntry()));
    }
    if (!(e instanceof DirEntry)) throw domError("TypeMismatchError", `${path} is a file, not a folder.`);
    return new FakeDirectoryHandle(this.fs, e, name, path) as unknown as FileSystemDirectoryHandle;
  }

  async getFileHandle(name: string, options: { create?: boolean } = {}): Promise<FileSystemFileHandle> {
    checkName(name);
    const path = join(this.path, name);
    this.fs.check("getFile", path);
    const e = this.dir.children.get(name);
    if (!e) {
      if (!options.create) throw domError("NotFoundError", `File not found: ${path}`);
      this.dir.children.set(name, new FileEntry());
    } else if (!(e instanceof FileEntry)) {
      throw domError("TypeMismatchError", `${path} is a folder, not a file.`);
    }
    return new FakeFileHandle(this.fs, this.dir, name, path) as unknown as FileSystemFileHandle;
  }

  async removeEntry(name: string, options: { recursive?: boolean } = {}): Promise<void> {
    checkName(name);
    const path = join(this.path, name);
    this.fs.check("remove", path);
    const e = this.dir.children.get(name);
    if (!e) throw domError("NotFoundError", `Not found: ${path}`);
    if (e instanceof DirEntry && e.children.size && !options.recursive) {
      throw domError("InvalidModificationError", `Folder is not empty: ${path}`);
    }
    this.dir.children.delete(name);
  }

  async resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null> {
    const d = possibleDescendant as unknown as FakeHandle;
    if (!(d instanceof FakeHandle)) return null;
    if (d.path === this.path) return [];
    const prefix = this.path ? `${this.path}/` : "";
    return d.path.startsWith(prefix) ? d.path.slice(prefix.length).split("/") : null;
  }

  private handleFor(name: string, e: FileEntry | DirEntry): FileSystemHandle {
    const path = join(this.path, name);
    return (e instanceof DirEntry
      ? new FakeDirectoryHandle(this.fs, e, name, path)
      : new FakeFileHandle(this.fs, this.dir, name, path)) as unknown as FileSystemHandle;
  }

  async *entries(): AsyncIterableIterator<[string, FileSystemHandle]> {
    this.fs.check("list", this.path);
    for (const [name, e] of [...this.dir.children]) {
      if (this.dir.children.get(name) === e) yield [name, this.handleFor(name, e)];
    }
  }

  async *keys(): AsyncIterableIterator<string> {
    for await (const [name] of this.entries()) yield name;
  }

  async *values(): AsyncIterableIterator<FileSystemHandle> {
    for await (const [, handle] of this.entries()) yield handle;
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemHandle]> {
    return this.entries();
  }
}

/**
 * Make `navigator.storage.getDirectory()` return `fs.root`, as OPFS does in
 * the browser. Returns a function that undoes it.
 */
export function installFakeOpfs(fs: FakeFileSystem): () => void {
  const g = globalThis as { navigator?: object };
  const hadNavigator = "navigator" in globalThis;
  const nav = (g.navigator ?? {}) as object;
  if (!hadNavigator) Object.defineProperty(globalThis, "navigator", { value: nav, configurable: true, writable: true });
  const previous = Object.getOwnPropertyDescriptor(nav, "storage");
  Object.defineProperty(nav, "storage", { value: { getDirectory: async () => fs.root }, configurable: true });
  return () => {
    if (previous) Object.defineProperty(nav, "storage", previous);
    else delete (nav as { storage?: unknown }).storage;
    if (!hadNavigator) delete (globalThis as { navigator?: unknown }).navigator;
  };
}
