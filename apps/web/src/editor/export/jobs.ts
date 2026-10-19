/**
 * The export job: where files go, running the export, writing or
 * downloading the files, and the outcome the Export card, the Export dialog
 * and the toast show (docs/design/export.md "Progress and failures").
 *
 * One job at a time per tab. It keeps running when the dialog closes; the
 * toast then shows how far it got and how it ended.
 */

import { useSyncExternalStore } from "react";
import type { Document } from "@illigma/core";
import { planExportFilenames, type ExportRequest } from "@illigma/export";
import {
  downloadExportFiles,
  existingNames,
  exportFolders,
  folderPermission,
  pickExportFolder,
  supportsFolderPicker,
  writeExportFiles,
  type OutputFile,
  type WrittenFile,
} from "../../export-files";
import { runExports } from "./runner";

export interface FileFailure {
  request: ExportRequest;
  filename: string;
  /** Plain language. */
  message: string;
}

export interface JobState {
  id: number;
  /** Where it was started: the card's results show in the toast, the dialog's in the dialog. */
  from: "card" | "dialog";
  /** "Sign up", or "6 layers". */
  label: string;
  requests: ExportRequest[];
  /** Planned file name per request, in order. */
  filenames: string[];
  phase: "exporting" | "writing" | "done";
  /** Files exported (exporting) or written (writing) so far. */
  done: number;
  total: number;
  /** Where the files went: the folder's name, or the download's name. */
  where?: string;
  downloaded?: boolean;
  written?: WrittenFile[];
  failures?: FileFailure[];
  /** The job stopped as a whole (no folder permission, cancelled, the engine failed). */
  error?: string;
  /** The folder permission was lost: offer "Choose folder again". */
  permissionLost?: boolean;
  cancelled?: boolean;
  /** What a retry repeats. */
  replace: boolean;
}

type Listener = () => void;
let state: JobState | null = null;
const listeners = new Set<Listener>();
let controller: AbortController | null = null;
let nextId = 1;

function set(next: JobState | null): void {
  state = next;
  for (const l of listeners) l();
}
const patch = (id: number, p: Partial<JobState>) => {
  if (state?.id === id) set({ ...state, ...p });
};

export function subscribeJob(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
export const currentJob = (): JobState | null => state;
export const useExportJob = (): JobState | null => useSyncExternalStore(subscribeJob, currentJob);
export const jobRunning = (): boolean => !!state && state.phase !== "done";

/** Forget a finished job (the toast or dialog was dismissed). */
export function dismissJob(): void {
  if (state && state.phase === "done") set(null);
}

/** Stop the running job. Nothing is written once it stops. */
export function cancelJob(): void {
  controller?.abort();
}

export interface Destination {
  kind: "folder" | "download";
  /** The folder's name, when one is chosen. */
  name?: string;
}

/** The remembered export folder of `fileId`, if any (no prompt). */
export async function rememberedFolder(fileId: string): Promise<FileSystemDirectoryHandle | null> {
  if (!supportsFolderPicker()) return null;
  return (await exportFolders().get(fileId).catch(() => undefined)) ?? null;
}

/**
 * Ask for an export folder for `fileId` and remember it. Run inside a click.
 * Null if the person cancelled.
 */
export async function chooseFolder(fileId: string): Promise<FileSystemDirectoryHandle | null> {
  const previous = await rememberedFolder(fileId);
  const dir = await pickExportFolder(previous ?? undefined);
  if (dir) await exportFolders().set(fileId, dir).catch(() => {});
  return dir;
}

export interface StartOptions {
  doc: Document;
  fileId: string;
  requests: readonly ExportRequest[];
  label: string;
  /** The zip's name when several files download. */
  zipBase: string;
  from: "card" | "dialog";
  /** Replace files with the same name (the dialog's switch). Default false. */
  replace?: boolean;
}

const messageOf = (e: unknown) => (e instanceof Error && e.message ? e.message : String(e)).replace(/\.$/, "");

/**
 * Export `requests` and write the files: into the file's export folder
 * (asking for one the first time, and for permission again when the browser
 * forgot it), or as a download. Call it from a click: the folder picker and
 * the permission prompt need one. Resolves when the job ends; its state is
 * in `currentJob()`.
 */
export async function startExport(o: StartOptions): Promise<void> {
  if (jobRunning() || !o.requests.length) return;
  const replace = !!o.replace;
  const id = nextId++;
  const requests = [...o.requests];
  set({ id, from: o.from, label: o.label, requests, filenames: planExportFilenames(o.doc, requests), phase: "exporting", done: 0, total: requests.length, replace });

  // Where the files go. Asked first, inside the click.
  let dir: FileSystemDirectoryHandle | null = null;
  if (supportsFolderPicker()) {
    try {
      dir = await rememberedFolder(o.fileId);
      if (dir && (await folderPermission(dir, true)) !== "granted") {
        patch(id, { phase: "done", where: dir.name, error: `Illigma no longer has permission to the “${dir.name}” folder. Nothing was exported.`, permissionLost: true });
        return;
      }
      if (!dir) dir = await chooseFolder(o.fileId);
    } catch (e) {
      patch(id, { phase: "done", error: `Couldn't open the export folder: ${messageOf(e)}. Nothing was exported.` });
      return;
    }
    if (!dir) {
      // Cancelled the picker: nothing happened, nothing to say.
      set(null);
      return;
    }
  }

  controller = new AbortController();
  const signal = controller.signal;
  try {
    let taken: string[] = [];
    if (dir && !replace) {
      try {
        taken = await existingNames(dir, state?.filenames ?? []);
      } catch {
        // Writing finds out why; numbering happens there too.
      }
    }
    const filenames = planExportFilenames(o.doc, requests, taken);
    patch(id, { filenames, ...(dir ? { where: dir.name } : {}) });
    const out = await runExports(o.doc, requests, { taken, signal, onProgress: (done, total) => patch(id, { done, total }) });
    if (signal.aborted) throw new DOMException("cancelled", "AbortError");
    const failures: FileFailure[] = out.failures.map((f) => ({ request: { nodeId: f.nodeId, settings: f.settings }, filename: f.filename, message: f.message }));
    const files: OutputFile[] = out.files;
    patch(id, { phase: "writing", done: 0, total: files.length });
    let written: WrittenFile[] = [];
    let where = dir?.name;
    let downloaded = false;
    if (files.length) {
      if (dir) {
        const res = await writeExportFiles(dir, files, { replace, onProgress: (done, total) => patch(id, { done, total }) });
        written = res.written;
        for (const f of res.failures) {
          const file = out.files.find((x) => x.filename === f.filename);
          if (file) failures.push({ request: { nodeId: file.nodeId, settings: file.settings }, filename: f.filename, message: f.message });
        }
      } else {
        const d = downloadExportFiles(files, o.zipBase);
        written = files.map((f) => ({ filename: f.filename, path: f.filename }));
        where = d.name;
        downloaded = true;
      }
    }
    // Failures in the order the files were planned.
    const order = new Map(filenames.map((n, i) => [n, i]));
    failures.sort((a, b) => (order.get(a.filename) ?? 0) - (order.get(b.filename) ?? 0));
    patch(id, { phase: "done", written, failures, downloaded, ...(where ? { where } : {}) });
  } catch (e) {
    const cancelled = (e as { name?: unknown })?.name === "AbortError";
    patch(id, { phase: "done", cancelled, error: cancelled ? "Export cancelled. Nothing was written." : `Couldn't export: ${messageOf(e)}. Nothing was written.` });
  } finally {
    controller = null;
  }
}

/** Run the failed files of the last job again (Retry N files). */
export function retryFailed(doc: Document, fileId: string, zipBase: string): Promise<void> {
  const last = state;
  if (!last || last.phase !== "done") return Promise.resolve();
  const requests = last.failures?.length ? last.failures.map((f) => f.request) : last.error ? last.requests : [];
  if (!requests.length) return Promise.resolve();
  state = null;
  return startExport({ doc, fileId, requests, label: last.label, zipBase, from: last.from, replace: last.replace });
}

/** "Exported 3 files to “export”", "Downloaded “Sign up.png”". */
export function successText(job: JobState): string {
  const n = job.written?.length ?? 0;
  const files = n === 1 ? "1 file" : `${n.toLocaleString("en-US")} files`;
  if (job.downloaded) return n === 1 ? `Downloaded “${job.where ?? job.written?.[0]?.path ?? ""}”` : `Downloaded ${files} as “${job.where ?? ""}”`;
  return `Exported ${files} to “${job.where ?? "the folder"}”`;
}

/** "11 of 13 files exported. App icon@2x.png and App icon@3x.png failed: the disk is full. Nothing else was changed." */
export function failureText(job: JobState): string {
  const failures = job.failures ?? [];
  const ok = job.written?.length ?? 0;
  const total = ok + failures.length;
  const reasons = new Map<string, string[]>();
  for (const f of failures) reasons.set(f.message, [...(reasons.get(f.message) ?? []), f.filename]);
  const parts = [...reasons].slice(0, 2).map(([message, names]) => {
    const shown = names.length > 2 ? `${names.slice(0, 2).join(", ")} and ${names.length - 2} more` : names.join(" and ");
    return `${shown} failed: ${message.replace(/\.$/, "")}.`;
  });
  if (reasons.size > 2) parts.push(`${reasons.size - 2} other problems.`);
  const head = ok ? `${ok} of ${total} files exported.` : total === 1 ? "The file wasn't exported." : `None of the ${total} files were exported.`;
  return `${head} ${parts.join(" ")} Nothing else was changed.`;
}
