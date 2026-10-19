/**
 * Runs exports for the editor. Off the main thread in a worker (CanvasKit
 * draws and encodes PNGs there), so the editor stays responsive; on the main
 * thread one file at a time, with a pause between files, where a worker
 * can't start its drawing engine. Either way, the export reads a snapshot of
 * the document taken when it starts, so edits made meanwhile don't mix in.
 *
 * Fonts: the snapshot carries the files of the fonts on this computer its
 * text uses (as the canvas draws them); a family that isn't available is
 * drawn in Inter, and the file's warnings say so.
 *
 * Previews (the Export card) wait behind real exports and replace each
 * other: at most one is waiting, and it takes its snapshot only when it
 * runs, so a burst of edits draws one preview, not one per edit.
 */

import type { Document } from "@illigma/core";
import { exportScene, planExportFilenames, type ExportRequest } from "@illigma/export";
import type { ExportSettings, NodeId } from "@illigma/format";
import type { FontSource } from "@illigma/renderer";
import { BUNDLED_FAMILY, currentTextEngine, HIDDEN_FAMILIES } from "../text/engine";
import { ensureLocalFamily, localFonts, localFontSources } from "../text/local-fonts";
import { exportBatchChunked, type BatchOutput } from "./engine";
import type { WorkerReply, WorkerRequest } from "./export.worker";
import { SnapshotSource, snapshotFamilies, snapshotFor } from "./snapshot";

export interface RunOptions {
  /** Names already in the folder, which the batch must not reuse. */
  taken?: readonly string[];
  onProgress?(done: number, total: number): void;
  /** Stops the export: it rejects with an AbortError, and nothing is written. */
  signal?: AbortSignal;
  /**
   * A preview: runs after real exports, and a newer preview replaces one
   * still waiting (it rejects with an AbortError). Its snapshot is taken when it runs.
   */
  preview?: boolean;
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

/** Jobs started and not finished (worker or main thread): previews wait until there are none. */
let inFlight = 0;

interface PendingPreview {
  make(): Promise<WorkerRequest>;
  onProgress?: ((done: number, total: number) => void) | undefined;
  resolve(out: BatchOutput): void;
  reject(e: unknown): void;
}
/** The one preview waiting for its turn. */
let pendingPreview: PendingPreview | null = null;

function track(work: Promise<BatchOutput>): Promise<BatchOutput> {
  inFlight++;
  const done = () => {
    inFlight--;
    pump();
  };
  work.then(done, done);
  return work;
}

/** Start the waiting preview once nothing else runs. */
function pump(): void {
  if (inFlight > 0 || !pendingPreview) return;
  const p = pendingPreview;
  pendingPreview = null;
  // Counted from now, so a real export started meanwhile queues behind it rather than beside it.
  void track(
    p
      .make()
      .then((data) => runSnapshot(data, p.onProgress ? { onProgress: p.onProgress } : {}))
      .then(
        (out) => {
          p.resolve(out);
          return out;
        },
        (e: unknown) => {
          p.reject(e);
          throw e;
        },
      ),
  ).catch(() => {});
}

function schedulePreview(make: () => Promise<WorkerRequest>, { onProgress, signal }: RunOptions): Promise<BatchOutput> {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise<BatchOutput>((resolve, reject) => {
    // A preview still waiting is out of date: this one replaces it.
    pendingPreview?.reject(abortError());
    const mine: PendingPreview = { make, onProgress, resolve, reject };
    pendingPreview = mine;
    signal?.addEventListener(
      "abort",
      () => {
        if (pendingPreview !== mine) return; // already running: its result is ignored by the caller
        pendingPreview = null;
        reject(abortError());
      },
      { once: true },
    );
    queueMicrotask(pump);
  });
}

/**
 * The font files the snapshot's text needs beyond the bundled Inter: the
 * families on this computer it uses (read now if the list is there but the
 * family wasn't loaded yet). A family that isn't available is left out; the
 * export draws it in Inter and warns.
 */
async function fontsFor(families: readonly string[]): Promise<FontSource[]> {
  const out: FontSource[] = [];
  for (const family of families) {
    if (family === BUNDLED_FAMILY || HIDDEN_FAMILIES.has(family)) continue;
    let files = localFontSources(family);
    const engine = currentTextEngine();
    if (!files && engine && localFonts().families.has(family) && (await ensureLocalFamily(engine, family))) files = localFontSources(family);
    if (files) out.push(...files);
  }
  return out;
}

async function requestFor(doc: Document, requests: readonly ExportRequest[], options: RunOptions): Promise<WorkerRequest> {
  const snapshot = snapshotFor(doc, requests);
  snapshot.fonts = await fontsFor(snapshotFamilies(snapshot));
  return { id: nextId++, snapshot, requests: [...requests], taken: [...(options.taken ?? [])] };
}

async function runOnMainThread(data: WorkerRequest, onProgress: ((done: number, total: number) => void) | undefined, signal?: AbortSignal): Promise<BatchOutput> {
  lastRunner = "main";
  const source = new SnapshotSource(data.snapshot);
  const names = planExportFilenames(source, data.requests, data.taken);
  const out = await exportBatchChunked(source, data.requests, names, (d, t) => onProgress?.(d, t), () => !!signal?.aborted, data.snapshot.fonts);
  if (signal?.aborted) throw abortError();
  return out;
}

/** Export `requests` from a snapshot of `doc`. Failures (too big, hidden) are listed, not thrown. */
export function runExports(doc: Document, requests: readonly ExportRequest[], options: RunOptions = {}): Promise<BatchOutput> {
  if (options.preview) return schedulePreview(() => requestFor(doc, requests, options), options);
  // The snapshot is taken now (before any await), so edits made after the click don't mix in.
  const snapshot = snapshotFor(doc, requests);
  return track(
    fontsFor(snapshotFamilies(snapshot)).then((fonts) => {
      if (options.signal?.aborted) throw abortError();
      return runSnapshot({ id: nextId++, snapshot: { ...snapshot, fonts }, requests: [...requests], taken: [...(options.taken ?? [])] }, options);
    }),
  );
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
export async function renderPreview(doc: Document, nodeId: NodeId, setting: ExportSettings | undefined, box: { width: number; height: number }, signal?: AbortSignal): Promise<Preview> {
  const bounds = { ...(setting?.contentsOnly !== undefined ? { contentsOnly: setting.contentsOnly } : {}), ...(setting?.useAbsoluteBounds !== undefined ? { useAbsoluteBounds: setting.useAbsoluteBounds } : {}) };
  const { region } = exportScene(doc, nodeId, bounds);
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  const fit = Math.min(box.width / Math.max(region.width, 1e-6), box.height / Math.max(region.height, 1e-6));
  // Never more than 2x the layer's own size: a tiny icon stays crisp without huge previews.
  const scale = Math.max(0.001, Math.min(fit, 2) * dpr);
  const out = await runExports(doc, [{ nodeId, settings: { format: "PNG", constraint: { type: "SCALE", value: scale }, ...bounds } }], { preview: true, ...(signal ? { signal } : {}) });
  const file = out.files[0];
  if (!file) throw new Error(out.failures[0]?.message ?? "The preview couldn't be drawn.");
  const url = URL.createObjectURL(new Blob([file.bytes as Uint8Array<ArrayBuffer>], { type: "image/png" }));
  return { url, width: file.width / dpr, height: file.height / dpr };
}
