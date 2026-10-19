import { useEffect, useMemo, useRef, useState } from "react";
import type { Document, ReadonlyNode } from "@illigma/core";
import type { ExportRequest } from "@illigma/export";
import type { NodeId } from "@illigma/format";
import { Icon, type IconName } from "../../ui/Icon";
import { existingNames, folderPermission, supportsFolderPicker } from "../../export-files";
import { useDocVersion } from "../hooks";
import { ExportIcon } from "./icons";
import { cancelJob, chooseFolder, currentJob, dismissJob, failureText, jobRunning, rememberedFolder, retryFailed, startExport, useExportJob, type JobState } from "./jobs";
import { layersWithSettings, planFiles, settingsOf, settingsSummary, type ExportableLayer } from "./model";

const TYPE_ICON: Partial<Record<ReadonlyNode["type"], IconName>> = {
  PAGE: "file",
  FRAME: "frame",
  SECTION: "frame",
  COMPONENT: "frame",
  GROUP: "square-dashed",
  TEXT: "type",
  ELLIPSE: "circle",
  STAR: "star",
  POLYGON: "hexagon",
  VECTOR: "spline",
  LINE: "spline",
};

type Scope = "page" | "all";

const requestKey = (r: ExportRequest) => `${r.nodeId}\u0000${JSON.stringify(r.settings)}`;

interface Row {
  layer: ExportableLayer;
  checked: boolean;
  /** Where its requests sit in the job (or plan) list, when checked. */
  start: number;
  count: number;
}

/** "Done", "2 of 3", "Waiting", "2 failed", "Skipped": a row's state during and after an export. */
function rowStatus(row: Row, job: JobState | null, requests: readonly ExportRequest[]): { text: string; tone: "quiet" | "success" | "danger" | "busy" } | null {
  if (!job) return null;
  if (!row.checked) return { text: "Skipped", tone: "quiet" };
  // The row's requests in the job (a retry holds only the failed ones).
  const jobKeys = job.requests.map(requestKey);
  const mine = requests.slice(row.start, row.start + row.count).map(requestKey);
  const idx = mine.map((k) => jobKeys.indexOf(k)).filter((i) => i >= 0);
  if (!idx.length) return null;
  if (job.phase === "done") {
    if (job.error && !job.failures) return null;
    const failed = (job.failures ?? []).filter((f) => mine.includes(requestKey(f.request))).length;
    if (failed && job.cancelled) return { text: failed === idx.length ? "Cancelled" : `${idx.length - failed} of ${idx.length}`, tone: "quiet" };
    return failed ? { text: `${failed} failed`, tone: "danger" } : { text: "Done", tone: "success" };
  }
  if (job.phase === "writing") return { text: "Writing…", tone: "busy" };
  const done = idx.filter((i) => i < job.done).length;
  if (done === idx.length) return { text: "Done", tone: "success" };
  if (done === 0) return { text: "Waiting", tone: "quiet" };
  return { text: `${done} of ${idx.length}`, tone: "busy" };
}

/**
 * The Export dialog, ⇧⌘E (Figma `96:51613`, states `96:53886`): every layer
 * with export settings on this page or on all pages, the files each writes
 * and their sizes, checkboxes, the folder, and Export. Progress, partial
 * failures with Retry, and cancelling run here; closing the dialog keeps the
 * export going (the toast follows it).
 *
 * Not here: "Also export the prototype as HTML" (there is no prototype
 * model yet) and "Open folder when done" (desktop app only; a browser can't
 * open a folder).
 */
export function ExportDialog({ doc, pageId, onClose }: { doc: Document; pageId: NodeId; onClose(): void }) {
  const version = useDocVersion(doc);
  const ref = useRef<HTMLDialogElement>(null);
  const job = useExportJob();
  const ours = job?.from === "dialog" ? job : null;
  const [scope, setScope] = useState<Scope>("page");
  const [unchecked, setUnchecked] = useState<ReadonlySet<NodeId>>(new Set());
  const [replace, setReplace] = useState(false);
  const [folder, setFolder] = useState<{ name: string; granted: boolean } | null>(null);
  const [taken, setTaken] = useState<string[]>([]);
  const [folderError, setFolderError] = useState<string | null>(null);
  const fileId = doc.fileId;
  const canPick = supportsFolderPicker();

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    // A clean or cancelled export from before is old news here: start with plain rows and the Export button.
    const last = currentJob();
    if (last?.phase === "done" && (last.cancelled || (!last.error && !last.failures?.length))) dismissJob();
  }, []);

  // The remembered folder, and the names already in it (only when the browser still allows reading it, without a prompt).
  const loadFolder = async () => {
    const dir = await rememberedFolder(fileId);
    if (!dir) return setFolder(null);
    const granted = (await folderPermission(dir, false)) === "granted";
    setFolder({ name: dir.name, granted });
    return dir;
  };
  useEffect(() => {
    void loadFolder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, ours?.phase]);

  const pages = useMemo(() => (scope === "all" ? doc.pages() : [doc.get(pageId)].filter((p): p is ReadonlyNode => !!p)), [doc, pageId, scope, version]);
  const layers = useMemo(() => layersWithSettings(doc, pages), [doc, pages, version]);

  const rows: Row[] = [];
  const requests: ExportRequest[] = [];
  for (const layer of layers) {
    const checked = !unchecked.has(layer.node.id);
    const list = settingsOf(layer.node);
    rows.push({ layer, checked, start: requests.length, count: checked ? list.length : 0 });
    if (checked) for (const settings of list) requests.push({ nodeId: layer.node.id, settings });
  }
  const files = useMemo(() => planFiles(doc, requests, replace ? [] : taken), [doc, JSON.stringify(requests), replace, taken, version]);

  // Names already in the folder, so the list shows the numbered names the export will write.
  const fileKey = files.map((f) => f.filename).join("\n");
  useEffect(() => {
    let live = true;
    if (!folder?.granted || replace) return setTaken([]);
    void (async () => {
      const dir = await rememberedFolder(fileId);
      if (!dir) return;
      const names = await existingNames(dir, planFiles(doc, requests).map((f) => f.filename)).catch(() => []);
      if (live) setTaken(names);
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder?.granted, folder?.name, replace, fileKey.length, ours?.phase]);

  const total = files.length;
  const page = doc.get(pageId);
  const running = !!ours && jobRunning();
  // A cancel is the person's choice, not a failure: it says what was written, and Export stays.
  const cancelled = ours?.phase === "done" && ours.cancelled ? ours : null;
  const failed = ours?.phase === "done" && !ours.cancelled && (!!ours.failures?.length || !!ours.error) ? ours : null;
  const rest = cancelled?.written?.length ? (cancelled.failures?.length ?? 0) : 0;
  const allChecked = layers.length > 0 && rows.every((r) => r.checked);
  const noneChecked = rows.every((r) => !r.checked);
  const headBox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headBox.current) headBox.current.indeterminate = !allChecked && !noneChecked;
  });

  // An export started here that finishes with nothing to report closes the dialog; the toast says where the files went.
  const started = useRef<number | null>(null);
  useEffect(() => {
    if (ours && ours.id === started.current && ours.phase === "done" && !ours.error && !ours.failures?.length) onClose();
  }, [ours, onClose]);

  const toggle = (id: NodeId) =>
    setUnchecked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const run = () => {
    if (!requests.length || running) return;
    dismissJob();
    const label = `${rows.filter((r) => r.checked).length} layers`;
    void startExport({ doc, fileId, requests, label, zipBase: doc.name, from: "dialog", replace });
    started.current = currentJob()?.id ?? null;
  };

  const retry = () => {
    void retryFailed(doc, fileId, doc.name);
    started.current = currentJob()?.id ?? null;
  };

  const pick = async () => {
    setFolderError(null);
    try {
      if (await chooseFolder(fileId)) await loadFolder();
    } catch (e) {
      setFolderError(`Couldn't choose that folder: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const scopeLabel = scope === "all" ? "All pages" : (page?.name ?? "Page");
  const progress = ours && running ? (ours.phase === "writing" ? `Writing ${ours.done} of ${ours.total} files…` : `Exporting ${ours.done} of ${ours.total} files…`) : null;
  const retryCount = failed?.failures?.length || (failed?.error ? failed.requests.length : 0);

  return (
    <dialog
      ref={ref}
      className="export-dialog"
      aria-labelledby="export-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // The editor's shortcuts must not see keys meant for the dialog (Escape, Delete, arrows).
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="export-dialog-head">
        <h2 id="export-dialog-title" className="export-dialog-title">
          Export
        </h2>
        <span className="export-chip">
          {scopeLabel} · {layers.length === 1 ? "1 layer" : `${layers.length} layers`}
        </span>
        <span className="export-dialog-spacer" />
        <button type="button" className="icon-button" aria-label="Close the Export dialog" title="Close (Esc)" onClick={onClose}>
          <ExportIcon name="x" />
        </button>
      </div>

      <div className="segmented export-scope" role="radiogroup" aria-label="Layers from">
        {(["page", "all"] as const).map((s) => (
          <button key={s} type="button" role="radio" className="segment" aria-checked={scope === s} disabled={running} onClick={() => setScope(s)}>
            {s === "page" ? "This page" : "All pages"}
          </button>
        ))}
      </div>

      {cancelled && (
        <div className="banner export-dialog-banner" role="status">
          <div className="banner-text">{cancelled.error ?? "Export cancelled."}</div>
        </div>
      )}

      {failed && (
        <div className="banner banner-error export-dialog-banner" role="alert">
          <ExportIcon name="circle-alert" />
          <div className="banner-text">
            {failed.error ?? failureText(failed)}
            {/* The summary names up to two files; past that, list them. */}
            {(failed.failures?.length ?? 0) > 2 && (
              <ul className="banner-list export-failures">
                {(failed.failures ?? []).slice(0, 8).map((f) => (
                  <li key={f.filename}>
                    <strong>{f.filename}</strong>: {f.message}
                  </li>
                ))}
                {(failed.failures?.length ?? 0) > 8 && <li>…and {(failed.failures?.length ?? 0) - 8} more.</li>}
              </ul>
            )}
          </div>
        </div>
      )}

      {layers.length === 0 ? (
        <p className="export-empty muted">
          No layers {scope === "page" ? "on this page " : ""}have export settings. Select a layer and click + in Properties › Export to add one.
        </p>
      ) : (
        <div className="export-list">
          <label className="export-list-head">
            <input
              ref={headBox}
              type="checkbox"
              checked={allChecked}
              disabled={running}
              onChange={() => setUnchecked(allChecked ? new Set(layers.map((l) => l.node.id)) : new Set())}
            />
            <span className="export-list-name">All layers with export settings</span>
            <span className="export-list-meta">{total === 1 ? "1 file" : `${total} files`}</span>
          </label>
          <ul className="export-list-rows" aria-label="Layers with export settings">
            {rows.map((row) => {
              const n = row.layer.node;
              const status = rowStatus(row, ours, requests);
              const mine = row.checked ? files.slice(row.start, row.start + row.count) : [];
              return (
                <li key={n.id} className="export-list-row" data-checked={row.checked || undefined}>
                  <div className="export-list-line">
                    <input type="checkbox" checked={row.checked} disabled={running} aria-label={`Export ${n.name}`} onChange={() => toggle(n.id)} />
                    <span className="export-type-tile" aria-hidden="true">
                      {n.type === "RECTANGLE" && n.fills.some((p) => p.type === "IMAGE") ? <ExportIcon name="image" /> : <Icon name={TYPE_ICON[n.type] ?? "square"} />}
                    </span>
                    <span className="export-list-name">
                      {n.name}
                      {scope === "all" && n.type !== "PAGE" && <span className="muted"> · {row.layer.page.name}</span>}
                    </span>
                    <span className="export-list-meta">{settingsSummary(settingsOf(n))}</span>
                    <span className={`export-status tone-${status?.tone ?? "quiet"}`}>{status?.text ?? ""}</span>
                  </div>
                  {mine.length > 0 && (
                    <ul className="export-files" aria-label={`Files for ${n.name}`}>
                      {mine.map((f) => (
                        <li key={f.filename} className="export-file" data-problem={f.problem ? "" : undefined}>
                          <span className="export-file-name">{f.filename}</span>
                          <span className="export-file-size">{f.problem ? f.problem : f.size}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {canPick ? (
        <div className="export-folder">
          <div className="field export-folder-field">
            <span className="field-letter export-folder-label">Folder</span>
            <span className="export-folder-name">{folder ? folder.name : "Not chosen yet: Export asks for one"}</span>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => void pick()} disabled={running}>
            <ExportIcon name="folder" />
            {folder ? "Change folder…" : "Choose…"}
          </button>
        </div>
      ) : (
        <p className="export-note muted">This browser can't write to a folder, so the files download: one as it is, several as a .zip.</p>
      )}
      {folderError && (
        <p className="export-note export-note-error" role="alert">
          {folderError}
        </p>
      )}

      {canPick && (
        <label className="export-switch-row">
          <span>Replace files with the same name</span>
          <input type="checkbox" role="switch" className="switch" checked={replace} disabled={running} onChange={(e) => setReplace(e.target.checked)} />
        </label>
      )}

      {progress && (
        <div className="export-progress">
          <span>{progress}</span>
          <progress max={ours?.total || 1} value={ours?.done ?? 0} aria-label="Export progress" />
        </div>
      )}

      <div className="export-dialog-foot">
        <p className="export-note muted">
          {running
            ? "You can keep working. Files are written in the background."
            : failed
              ? "Fix the problem (free some space, choose another folder or a smaller size), then retry."
              : canPick
                ? replace
                  ? "Files with the same name are replaced."
                  : "New names get a number (Welcome-1.png) instead of replacing files."
                : "Nothing is uploaded: the files stay on this computer."}
        </p>
        {running ? (
          <>
            <button type="button" className="btn btn-secondary" onClick={cancelJob}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled>
              <ExportIcon name="download" />
              Exporting…
            </button>
          </>
        ) : failed && retryCount > 0 ? (
          <>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
            {failed.permissionLost && (
              <button type="button" className="btn btn-secondary" onClick={() => void pick()}>
                Choose folder again
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={retry}>
              <Icon name="refresh-cw" />
              {retryCount === 1 ? "Retry 1 file" : `Retry ${retryCount} files`}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {cancelled ? "Close" : "Cancel"}
            </button>
            {rest > 0 && (
              <button type="button" className="btn btn-secondary" onClick={retry}>
                {rest === 1 ? "Export the other file" : `Export the other ${rest} files`}
              </button>
            )}
            <button type="button" className="btn btn-primary" disabled={!total} onClick={run}>
              <ExportIcon name="download" />
              {total === 1 ? "Export 1 file" : `Export ${total} files`}
            </button>
          </>
        )}
      </div>
    </dialog>
  );
}
