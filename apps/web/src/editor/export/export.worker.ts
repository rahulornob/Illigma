/**
 * Runs exports off the main thread, so the editor stays responsive while
 * PNGs are drawn and encoded. One job at a time, in the order they arrive.
 */

import type { ExportRequest } from "@illigma/export";
import { exportBatch, loadExportDeps } from "./engine";
import { SnapshotSource, type Snapshot } from "./snapshot";

export type WorkerRequest = { id: number; snapshot: Snapshot; requests: ExportRequest[]; taken: string[] };
export type WorkerReply =
  | { id: number; kind: "progress"; done: number; total: number }
  | { id: number; kind: "result"; files: import("@illigma/export").ExportedFile[]; failures: import("@illigma/export").ExportFailure[] }
  | { id: number; kind: "error"; message: string; engine: boolean };

/** The worker scope, typed by hand: the app compiles against the DOM library. */
const scope = self as unknown as { onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null; postMessage(message: WorkerReply, transfer?: Transferable[]): void };
let queue: Promise<void> = Promise.resolve();

scope.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const job = e.data;
  queue = queue.then(() => run(job));
};

async function run({ id, snapshot, requests, taken }: WorkerRequest): Promise<void> {
  try {
    await loadExportDeps();
  } catch (e) {
    // The drawing engine didn't start here: the page runs the job itself.
    scope.postMessage({ id, kind: "error", message: e instanceof Error ? e.message : String(e), engine: true } satisfies WorkerReply);
    return;
  }
  try {
    const source = new SnapshotSource(snapshot);
    const out = await exportBatch(source, requests, taken, (done, total) => scope.postMessage({ id, kind: "progress", done, total } satisfies WorkerReply), snapshot.fonts);
    // Hand the bytes over instead of copying them: each buffer once, and only buffers a file owns whole.
    const owned = out.files.filter((f) => f.bytes.byteOffset === 0 && f.bytes.byteLength === f.bytes.buffer.byteLength);
    const transfer = [...new Set(owned.map((f) => f.bytes.buffer as ArrayBuffer))];
    scope.postMessage({ id, kind: "result", files: out.files, failures: out.failures } satisfies WorkerReply, transfer);
  } catch (e) {
    scope.postMessage({ id, kind: "error", message: e instanceof Error ? e.message : String(e), engine: false } satisfies WorkerReply);
  }
}
