import { useCallback, useEffect } from "react";
import type { Document } from "@illigma/core";
import type { NodeId } from "@illigma/format";
import { Icon } from "../../ui/Icon";
import { closeExportDialog, useExportDialogOpen } from "./dialog-state";
import { ExportDialog } from "./ExportDialog";
import { ExportIcon } from "./icons";
import { cancelJob, chooseFolder, dismissJob, failureText, retryFailed, successText, useExportJob } from "./jobs";

/** How long a success toast stays. Failures stay until dismissed. */
const SUCCESS_MS = 8000;

/**
 * The Export dialog when it is open, and the export toast: progress while an
 * export runs outside the dialog, "Exported 3 files to “export”" when it
 * ends, or what failed with Retry. In a browser there is no Open folder (a
 * page can't open a folder on disk); the desktop app will add it.
 */
export function ExportHost({ doc, pageId }: { doc: Document; pageId: NodeId }) {
  const open = useExportDialogOpen();
  const job = useExportJob();
  const close = useCallback(() => closeExportDialog(), []);
  // A new file in this tab: no dialog left open from the last one.
  useEffect(() => close, [doc, close]);

  const shown = job && (job.from === "card" || !open) ? job : null;
  const success = shown?.phase === "done" && !shown.error && !shown.failures?.length && !!shown.written?.length;

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(dismissJob, SUCCESS_MS);
    return () => clearTimeout(t);
  }, [success, shown?.id]);

  const fileId = doc.fileId;
  let toast = null;
  // A cancel that left nothing written says nothing; one that stopped partway says what was written.
  if (shown && (!shown.cancelled || !!shown.written?.length)) {
    if (shown.phase !== "done") {
      const text = shown.phase === "writing" ? `Writing ${shown.done} of ${shown.total} files…` : `Exporting ${shown.done} of ${shown.total} files…`;
      toast = (
        <div className="export-toast" role="status">
          <span className="export-toast-text">{text}</span>
          <button type="button" className="link-button" onClick={cancelJob}>
            Cancel
          </button>
        </div>
      );
    } else if (success) {
      toast = (
        <div className="export-toast export-toast-success" role="status">
          <Icon name="check" />
          <span className="export-toast-text">{successText(shown)}</span>
          <button type="button" className="icon-button" aria-label="Dismiss" title="Dismiss" onClick={dismissJob}>
            <ExportIcon name="x" />
          </button>
        </div>
      );
    } else if (shown.cancelled) {
      // Stopped partway by the person: not a failure. Says what was written; the rest can still go.
      const rest = shown.failures?.length ?? 0;
      toast = (
        <div className="export-toast" role="status">
          <span className="export-toast-text">{shown.error}</span>
          {rest > 0 && (
            <button type="button" className="btn btn-secondary" onClick={() => void retryFailed(doc, fileId, doc.name)}>
              {rest === 1 ? "Export the other file" : `Export the other ${rest} files`}
            </button>
          )}
          <button type="button" className="icon-button" aria-label="Dismiss" title="Dismiss" onClick={dismissJob}>
            <ExportIcon name="x" />
          </button>
        </div>
      );
    } else if (shown.error || shown.failures?.length) {
      const count = shown.failures?.length || shown.requests.length;
      toast = (
        <div className="export-toast export-toast-error" role="alert">
          <ExportIcon name="circle-alert" />
          <span className="export-toast-text">{shown.error ?? failureText(shown)}</span>
          {shown.permissionLost ? (
            <button type="button" className="btn btn-secondary" onClick={() => void chooseFolder(fileId).then((d) => d && retryFailed(doc, fileId, doc.name))}>
              Choose folder again
            </button>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={() => void retryFailed(doc, fileId, doc.name)}>
              {count === 1 ? "Retry 1 file" : `Retry ${count} files`}
            </button>
          )}
          <button type="button" className="icon-button" aria-label="Dismiss" title="Dismiss" onClick={dismissJob}>
            <ExportIcon name="x" />
          </button>
        </div>
      );
    }
  }

  return (
    <>
      {open && <ExportDialog doc={doc} pageId={pageId} onClose={close} />}
      {toast && <div className="export-toast-area">{toast}</div>}
    </>
  );
}
