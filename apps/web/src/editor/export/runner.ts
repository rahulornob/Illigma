/**
 * Runs exports for the editor. Off the main thread in a worker (CanvasKit
 * draws and encodes PNGs there), so the editor stays responsive; on the main
 * thread one file at a time, with a pause between files, where a worker
 * can't start its drawing engine. Either way, the export reads a snapshot of
 * the document taken when it starts, so edits made meanwhile don't mix in.
 */

import type { Document } from "@illigma/core";
import { exportScene, planExportFilenames, type ExportRequest } from "@illigma/export";
import type { ExportSettings, NodeId } from "@illigma/format";
import { exportBatchChunked, type BatchOutput } from "./engine";
import type { WorkerReply, WorkerRequest } from "./export.worker";
import { SnapshotSource, snapshotFor } from "./snapshot";

export interface RunOptions {
  /** Names already in the folder, which the batch must not reuse. */
  taken?: readonly string[];
  onProgress?(done: number, total: number): void;
  /** Stops the export: it rejects with an AbortError, and nothing is written. */
  signal?: AbortSignal;
}

interface Job {
  data: WorkerRequest;
  onProgress?: ((done: number, total: number) => void) | undefined;
  resolve(out: BatchOutput): void;
  reject(e: unknown): void;
}

/** Stop the worker after this long without work, to give its memory back. */
const IDLE_MS = 60_000;

let worker: Worker | null = null;
/** The worker can't run exports here (no workers, or its drawing engine failed): use the main thread. */
let useMainThread = false;
let nextId = 1;
const jobs = new Map<number, Job>();
let idleTimer: ReturnType<typeof setTimeout> | null = null;

/** For tests and diagnostics: where the last export ran. */
export let lastRunner: "worker" | "main" | null = null;

function abortError(): DOMException {
  return new DOMException("The export was cancelled.", "AbortError");
}

function stopWorker(): void {
  worker?.terminate();
  worker = null;
}

function armIdle(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!jobs.size) stopWorker();
  }, IDLE_MS);
}

/** The pending jobs, run on the main thread instead. */
function fallBack(): void {
  useMainThread = true;
  stopWorker();
  const pending = [...jobs.values()];
  jobs.clear();
  for (const job of pending) runOnMainThread(job.data, job.onProgress).then(job.resolve, job.reject);
}

function getWorker(): Worker | null {
  if (useMainThread) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./export.worker.ts", import.meta.url), { type: "module", name: "illigma-export" });
  } catch {
    useMainThread = true;
    return null;
  }
  worker.onmessage = (e: MessageEvent<WorkerReply>) => {
    const msg = e.data;
    const job = jobs.get(msg.id);
    if (!job) return;
    if (msg.kind === "progress") {
      job.onProgress?.(msg.done, msg.total);
      return;
    }
    if (msg.kind === "error" && msg.engine) {
      fallBack();
      return;
    }
    jobs.delete(msg.id);
    armIdle();
    if (msg.kind === "result") {
      lastRunner = "worker";
      job.resolve({ files: msg.files, failures: msg.failures });
    } else job.reject(new Error(msg.message));
  };
  // The worker script didn't load or crashed: finish its jobs here.
  worker.onerror = (e) => {
    e.preventDefault();
    fallBack();
  };
  return worker;
}

async function runOnMainThread(data: WorkerRequest, onProgress: ((done: number, total: number) => void) | undefined, signal?: AbortSignal): Promise<BatchOutput> {
  lastRunner = "main";
  const source = new SnapshotSource(data.snapshot);
  const names = planExportFilenames(source, data.requests, data.taken);
  const out = await exportBatchChunked(source, data.requests, names, (d, t) => onProgress?.(d, t), () => !!signal?.aborted);
  if (signal?.aborted) throw abortError();
  return out;
}

/** Export `requests` from a snapshot of `doc`. Failures (too big, hidden) are listed, not thrown. */
export function runExports(doc: Document, requests: readonly ExportRequest[], options: RunOptions = {}): Promise<BatchOutput> {
  const data: WorkerRequest = { id: nextId++, snapshot: snapshotFor(doc, requests), requests: [...requests], taken: [...(options.taken ?? [])] };
  return runSnapshot(data, options);
}

function runSnapshot(data: WorkerRequest, { onProgress, signal }: RunOptions): Promise<BatchOutput> {
  if (signal?.aborted) return Promise.reject(abortError());
  const w = getWorker();
  if (!w) return runOnMainThread(data, onProgress, signal);
  return new Promise<BatchOutput>((resolve, reject) => {
    jobs.set(data.id, { data, onProgress, resolve, reject });
    signal?.addEventListener(
      "abort",
      () => {
        if (!jobs.has(data.id)) return;
        // A job can't be stopped halfway inside the worker: stop the worker, and start the others again.
        const others = [...jobs.values()].filter((j) => j.data.id !== data.id);
        jobs.clear();
        stopWorker();
        reject(abortError());
        for (const j of others) runSnapshot(j.data, j.onProgress ? { onProgress: j.onProgress } : {}).then(j.resolve, j.reject);
      },
      { once: true },
    );
    w.postMessage(data);
  });
}

export interface Preview {
  url: string;
  width: number;
  height: number;
}

/**
 * A small PNG of `nodeId` as its first setting would draw it (its bounds
 * options), at most `box` CSS pixels, for the Export card. The caller
 * revokes `url`.
 */
export async function renderPreview(doc: Document, nodeId: NodeId, setting: ExportSettings | undefined, box: { width: number; height: number }): Promise<Preview> {
  const bounds = { ...(setting?.contentsOnly !== undefined ? { contentsOnly: setting.contentsOnly } : {}), ...(setting?.useAbsoluteBounds !== undefined ? { useAbsoluteBounds: setting.useAbsoluteBounds } : {}) };
  const { region } = exportScene(doc, nodeId, bounds);
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  const fit = Math.min(box.width / Math.max(region.width, 1e-6), box.height / Math.max(region.height, 1e-6));
  // Never more than 2x the layer's own size: a tiny icon stays crisp without huge previews.
  const scale = Math.max(0.001, Math.min(fit, 2) * dpr);
  const out = await runExports(doc, [{ nodeId, settings: { format: "PNG", constraint: { type: "SCALE", value: scale }, ...bounds } }]);
  const file = out.files[0];
  if (!file) throw new Error(out.failures[0]?.message ?? "The preview couldn't be drawn.");
  const url = URL.createObjectURL(new Blob([file.bytes as Uint8Array<ArrayBuffer>], { type: "image/png" }));
  return { url, width: file.width / dpr, height: file.height / dpr };
}
