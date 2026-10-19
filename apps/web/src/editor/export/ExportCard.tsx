import { useEffect, useId, useRef, useState } from "react";
import type { Document, ReadonlyNode } from "@illigma/core";
import type { ExportFormat, ExportSettings, ExportSettingsConstraints, NodeId } from "@illigma/format";
import { Icon } from "../../ui/Icon";
import { MenuButton } from "../../ui/Menu";
import { useDocVersion } from "../hooks";
import { guard, type OnEditError } from "../layout-props";
import { supportsFolderPicker } from "../../export-files";
import { openExportDialog } from "./dialog-state";
import { ExportIcon } from "./icons";
import { jobRunning, rememberedFolder, startExport, useExportJob } from "./jobs";
import { exportRequests, formatSize, FORMATS, nextSetting, parseSize, SIZE_PRESETS, settingsOf, sharedSettings, sizeOf, updateExportSettings, withFormat } from "./model";
import { OptionsPopover } from "./OptionsPopover";
import { renderPreview, type Preview } from "./runner";

const SIZE_HELP = "Use a scale (2x), a width (512w) or a height (512h): at most 100x or 100,000 px.";

/** The size field: "2x", "512w" or "512h", with Figma's presets in a menu. SVG and PDF are always 1x. */
function SizeField({ n, value, fixed, readOnly, onCommit }: { n: number; value: ExportSettingsConstraints | undefined; fixed: boolean; readOnly: boolean; onCommit(c: ExportSettingsConstraints): void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const shown = fixed ? "1x" : formatSize(value);
  const commit = () => {
    if (draft === null) return;
    const c = parseSize(draft);
    if (!c) {
      setError(SIZE_HELP);
      return;
    }
    setDraft(null);
    setError(null);
    if (formatSize(c) !== formatSize(value)) onCommit(c);
  };
  return (
    <div className="field export-size" data-invalid={error ? "" : undefined}>
      <input
        className="field-input"
        aria-label={`Setting ${n} size`}
        title={fixed ? "SVG and PDF export at 1x" : "Scale (2x), width (512w) or height (512h)"}
        value={draft ?? shown}
        disabled={readOnly || fixed}
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          setDraft(e.target.value);
          setError(null);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setDraft(null);
            setError(null);
          }
        }}
      />
      {!fixed && (
        <MenuButton
          label={`Setting ${n} size presets`}
          className="field-menu"
          disabled={readOnly}
          entries={SIZE_PRESETS.map((p) => ({ value: p, label: p, checked: p === shown }))}
          onSelect={(p) => {
            const c = parseSize(p);
            setDraft(null);
            setError(null);
            if (c) onCommit(c);
          }}
        >
          <Icon name="chevron-down" size={12} />
        </MenuButton>
      )}
      {error && (
        <span id={errorId} className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/** The suffix field ("@2x"), committed on Enter or when it loses focus. */
function SuffixField({ n, value, readOnly, onCommit }: { n: number; value: string; readOnly: boolean; onCommit(v: string): void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    setDraft(null);
    if (draft !== value) onCommit(draft.slice(0, 200));
  };
  return (
    <div className="field export-suffix">
      <input
        className="field-input"
        aria-label={`Setting ${n} suffix`}
        placeholder="Suffix"
        maxLength={200}
        spellCheck={false}
        value={draft ?? value}
        disabled={readOnly}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setDraft(null);
          }
        }}
      />
    </div>
  );
}

/** The preview of the first layer, as its first setting draws it, at a small size. */
function ExportPreview({ doc, nodeId, setting }: { doc: Document; nodeId: NodeId; setting: ExportSettings | undefined }) {
  const version = useDocVersion(doc);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const bounds = JSON.stringify([setting?.contentsOnly, setting?.useAbsoluteBounds]);
  const last = useRef<string | null>(null);

  useEffect(() => {
    let stale = false;
    // Edits come in bursts (typing, dragging): draw once they settle.
    const t = setTimeout(() => {
      renderPreview(doc, nodeId, setting, { width: 232, height: 136 }).then(
        (p) => {
          if (stale) return URL.revokeObjectURL(p.url);
          if (last.current) URL.revokeObjectURL(last.current);
          last.current = p.url;
          setPreview(p);
          setProblem(null);
        },
        (e: unknown) => {
          if (stale) return;
          setProblem(e instanceof Error ? e.message : String(e));
        },
      );
    }, 250);
    return () => {
      stale = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `setting` is read through `bounds`
  }, [doc, nodeId, version, bounds]);

  useEffect(
    () => () => {
      if (last.current) URL.revokeObjectURL(last.current);
    },
    [],
  );

  const name = doc.get(nodeId)?.name ?? "layer";
  return (
    <div className="export-preview" data-state={problem ? "error" : preview ? "ready" : "loading"}>
      {problem ? (
        <p className="export-preview-note">{problem}</p>
      ) : preview ? (
        <img src={preview.url} width={preview.width} height={preview.height} alt={`Preview of ${name}`} />
      ) : (
        <p className="export-preview-note">Drawing preview…</p>
      )}
    </div>
  );
}

let previewOpen = true;

/**
 * Properties › Export (Figma section "18 · Export", `96:50721`): one row per
 * setting (size, suffix, format, options, remove), + to add one, the
 * Export button, and a preview. Shows the page's settings when nothing is
 * selected. With several layers, rows edit all of them; when their settings
 * differ, + replaces them with one setting each (Figma's "mixed").
 */
export function ExportCard({ doc, targets, readOnly, onError }: { doc: Document; targets: readonly NodeId[]; readOnly: boolean; onError?: OnEditError | undefined }) {
  const nodes = targets.map((id) => doc.get(id)).filter((n): n is ReadonlyNode => !!n);
  const shared = sharedSettings(nodes);
  const mixed = shared === null;
  const list = shared ?? [];
  const ids = nodes.map((n) => n.id);
  const job = useExportJob();
  const [showPreview, setShowPreview] = useState(previewOpen);
  const [folder, setFolder] = useState<string | null>(null);
  const fileId = doc.fileId;

  useEffect(() => {
    let live = true;
    void rememberedFolder(fileId).then((d) => live && setFolder(d?.name ?? null));
    return () => {
      live = false;
    };
  }, [fileId, job?.phase]);

  if (!nodes.length) return null;
  const first = nodes[0] as ReadonlyNode;
  const isPage = nodes.length === 1 && first.type === "PAGE";

  const edit = (label: string, fn: (current: ExportSettings[]) => ExportSettings[]) => guard(onError, () => updateExportSettings(doc, ids, fn, label));
  const editRow = (i: number, label: string, fn: (s: ExportSettings) => ExportSettings) =>
    edit(label, (cur) => cur.map((s, j) => (j === i ? fn(s) : s)));

  const add = () =>
    mixed ? edit("Replace export settings", () => [nextSetting([])]) : edit("Add export setting", (cur) => [...cur, nextSetting(cur)]);

  const requests = exportRequests(doc, ids);
  const files = requests.length;
  const busy = !!job && jobRunning();
  const name = nodes.length === 1 ? first.name : `${nodes.length} layers`;
  const exportLabel = `Export ${name}${files > 1 ? ` · ${files} files` : ""}`;
  const where = supportsFolderPicker()
    ? folder
      ? `Saves to the “${folder}” folder. Change it in the Export dialog (⇧⌘E).`
      : "Asks for a folder the first time, then saves there. Change it in the Export dialog (⇧⌘E)."
    : files > 1
      ? "Downloads the files as one .zip (this browser can't write to a folder)."
      : "Downloads the file (this browser can't write to a folder).";

  return (
    <section className="card export-card" aria-labelledby="export-heading">
      <div className="card-head">
        <span className="card-icon">
          <ExportIcon name="share" />
        </span>
        <h2 id="export-heading" className="section-heading card-title">
          Export
        </h2>
        <button type="button" className="icon-button" aria-label={mixed ? "Replace mixed export settings" : "Add export setting"} title={mixed ? "Replace mixed export settings" : "Add export setting"} disabled={readOnly} onClick={add}>
          <Icon name="plus" />
        </button>
      </div>
      {mixed && <p className="muted export-mixed">The selected layers have different export settings. Click + to replace them.</p>}
      {list.length > 0 && (
        <ul className="export-rows" aria-label={isPage ? `Export settings of the page ${first.name}` : "Export settings"}>
          {list.map((s, i) => {
            const n = i + 1;
            const raster = s.format === "PNG" || s.format === "JPG";
            return (
              <li key={i} className="export-row">
                <SizeField n={n} value={sizeOf(s)} fixed={!raster} readOnly={readOnly} onCommit={(c) => editRow(i, "Change export size", (x) => (x.format === "PNG" || x.format === "JPG" ? { ...x, constraint: c } : x))} />
                <SuffixField n={n} value={s.suffix ?? ""} readOnly={readOnly} onCommit={(v) => editRow(i, "Change export suffix", (x) => ({ ...x, suffix: v }))} />
                <MenuButton<ExportFormat>
                  label={`Setting ${n} format: ${s.format}`}
                  className="export-format"
                  disabled={readOnly}
                  entries={FORMATS.map((f) => ({ value: f, label: f, checked: f === s.format }))}
                  onSelect={(f) => editRow(i, "Change export format", (x) => withFormat(x, f))}
                >
                  <span>{s.format}</span>
                  <Icon name="chevron-down" size={12} />
                </MenuButton>
                <OptionsPopover setting={s} label={`Setting ${n} options`} disabled={readOnly} onChange={(next) => editRow(i, "Change export options", () => next)} />
                <button
                  type="button"
                  className="icon-button export-row-button"
                  aria-label={`Remove setting ${n}`}
                  title="Remove export setting"
                  disabled={readOnly}
                  onClick={() => edit("Remove export setting", (cur) => cur.filter((_, j) => j !== i))}
                >
                  <Icon name="minus" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {files > 0 && (
        <>
          <button
            type="button"
            className="btn btn-secondary export-button"
            disabled={busy}
            onClick={() => void startExport({ doc, fileId, requests, label: name, zipBase: nodes.length === 1 ? first.name : doc.name, from: "card" })}
          >
            <ExportIcon name="download" />
            <span className="export-button-label">{busy ? "Exporting…" : exportLabel}</span>
          </button>
          <div className="export-preview-head">
            <button
              type="button"
              className="link-button export-preview-toggle"
              aria-expanded={showPreview}
              onClick={() => {
                previewOpen = !showPreview;
                setShowPreview(previewOpen);
              }}
            >
              <ExportIcon name="chevron-right" size={12} />
              Preview
            </button>
          </div>
          {showPreview && <ExportPreview doc={doc} nodeId={first.id} setting={settingsOf(first)[0]} />}
          <p className="muted export-where">
            {where}{" "}
            <button type="button" className="link-button" onClick={openExportDialog}>
              Open Export dialog
            </button>
          </p>
        </>
      )}
    </section>
  );
}
