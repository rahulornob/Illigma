import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Document } from "@illigma/core";
import type { Autosaver, Backend, SaveStatus } from "@illigma/host-web";

/** Re-render whenever the document changes (edits, undo, redo). Returns a change counter. */
export function useDocVersion(doc: Document): number {
  const version = useRef(0);
  return useSyncExternalStore(
    (notify) =>
      doc.subscribe(() => {
        version.current++;
        notify();
      }),
    () => version.current,
  );
}

export interface SaveDisplay {
  text: string;
  tone: "quiet" | "busy" | "error";
  state: SaveStatus["state"];
  message?: string;
}

/**
 * The title-bar save status. "Saving…" appears only when a save has been
 * pending for over a second, so the status never flickers (save-states.md rule 1).
 */
export function useSaveDisplay(autosaver: Autosaver | null, backend: Backend): SaveDisplay {
  const [status, setStatus] = useState<SaveStatus>(autosaver?.status ?? { state: "saved" });
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!autosaver) return;
    setStatus(autosaver.status);
    return autosaver.onStatus(setStatus);
  }, [autosaver]);

  // Only a write in progress counts; the ~1 s autosave delay before it does not.
  const pending = status.state === "saving";
  useEffect(() => {
    if (!pending) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), 1000);
    return () => clearTimeout(t);
  }, [pending]);

  if (status.state === "error") {
    return { text: "Couldn't save", tone: "error", state: status.state, ...(status.message ? { message: status.message } : {}) };
  }
  if (pending && slow) return { text: "Saving…", tone: "busy", state: status.state };
  return { text: `Saved · ${backend.label}`, tone: "quiet", state: status.state };
}
