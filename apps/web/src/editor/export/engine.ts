/**
 * The export engine: CanvasKit, the bundled Inter fonts and `@illigma/export`,
 * shared by the export worker and the main-thread fallback.
 */

import CanvasKitInit, { type CanvasKit } from "canvaskit-wasm";
import interUrl from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import interExtUrl from "@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2?url";
import wasmUrl from "canvaskit-wasm/bin/canvaskit.wasm?url";
import { exportNode, exportNodes, type ExportDeps, type ExportedFile, type ExportFailure, type ExportRequest, type ExportSource } from "@illigma/export";
import type { FontSource } from "@illigma/renderer";

let deps: Promise<ExportDeps> | null = null;

/** CanvasKit and the fonts, loaded once per thread. Text without fonts still exports, as placeholder bars, with a warning. */
export function loadExportDeps(): Promise<ExportDeps> {
  deps ??= (async () => {
    const font = (url: string, family: string): Promise<FontSource[]> =>
      fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((data) => [{ family, data }])
        .catch(() => []);
    const [canvasKit, fonts] = await Promise.all([
      CanvasKitInit({ locateFile: () => wasmUrl }) as Promise<CanvasKit>,
      Promise.all([font(interUrl, "Inter"), font(interExtUrl, "Inter Latin Extended")]).then((s) => s.flat()),
    ]);
    return { canvasKit, fonts };
  })().catch((e: unknown) => {
    deps = null;
    throw e;
  });
  return deps;
}

export interface BatchOutput {
  files: ExportedFile[];
  failures: ExportFailure[];
}

/** The loaded deps with `extra` fonts after the bundled ones (Inter stays first: the fallback). */
export async function depsWith(extra: readonly FontSource[] = []): Promise<ExportDeps> {
  const d = await loadExportDeps();
  return extra.length ? { ...d, fonts: [...(d.fonts ?? []), ...extra] } : d;
}

/** A batch in one go (in the worker, where nothing else waits on the thread). */
export async function exportBatch(
  source: ExportSource,
  requests: readonly ExportRequest[],
  taken: readonly string[],
  onProgress: (done: number, total: number) => void,
  fonts: readonly FontSource[] = [],
): Promise<BatchOutput> {
  return exportNodes(source, requests, await depsWith(fonts), { taken, onProgress });
}

/**
 * The same, one file at a time with a pause between files, so the page stays
 * responsive when it runs on the main thread. `filenames` are the planned
 * names (from `planExportFilenames`), one per request.
 */
export async function exportBatchChunked(
  source: ExportSource,
  requests: readonly ExportRequest[],
  filenames: readonly string[],
  onProgress: (done: number, total: number) => void,
  cancelled: () => boolean,
  fonts: readonly FontSource[] = [],
): Promise<BatchOutput> {
  const d = await depsWith(fonts);
  const files: ExportedFile[] = [];
  const failures: ExportFailure[] = [];
  for (let i = 0; i < requests.length; i++) {
    if (cancelled()) break;
    const req = requests[i] as ExportRequest;
    const filename = filenames[i] as string;
    try {
      files.push({ ...(await exportNode(source, req.nodeId, req.settings, d)), filename });
    } catch (e) {
      failures.push({ ...req, filename, message: e instanceof Error ? e.message : String(e) });
    }
    onProgress(i + 1, requests.length);
    await new Promise((r) => setTimeout(r, 0));
  }
  return { files, failures };
}
