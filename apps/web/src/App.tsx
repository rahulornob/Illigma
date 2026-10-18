import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { listRecentFiles, pruneCompareSnapshots, type OpfsBackend } from "@illigma/host-web";
import { Editor } from "./editor/Editor";
import { closeSession, createFile, openCompareSnapshot, openFolder, openStoredFile, type Session } from "./files";
import { Home } from "./home/Home";
import { applyUpdate, subscribeUpdate, updateReady } from "./sw-update";
import { Icon } from "./ui/Icon";

const FILE_HASH = /^#\/file\/([A-Za-z0-9_-]+)$/;
/** A read-only snapshot of a file's disk version, opened by Compare… in a new tab. */
const COMPARE_HASH = /^#\/compare\/([A-Za-z0-9_-]+)$/;

/** Files in this browser's storage get a URL (#/file/<id>) so a reload reopens them. */
function setFileHash(session: Session | null): void {
  const url =
    session?.backend.kind === "opfs"
      ? session.compare
        ? `#/compare/${(session.backend as OpfsBackend).fileId}`
        : `#/file/${session.doc.fileId}`
      : location.pathname + location.search;
  history.replaceState(null, "", url);
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  /** The open session, for callbacks that finish after it was closed. */
  const current = useRef<Session | null>(null);
  current.current = session;
  const [generation, setGeneration] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = useSyncExternalStore(subscribeUpdate, updateReady);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const reload = () => {
    setUpdateError(null);
    applyUpdate().catch((e: unknown) => {
      setUpdateError(`Couldn't update yet: ${e instanceof Error ? e.message : String(e)} Your edits are still here.`);
    });
  };

  const open = useCallback(async (load: () => Promise<Session | null>) => {
    setBusy(true);
    setError(null);
    try {
      const s = await load();
      if (s) {
        setSession(s);
        setGeneration((g) => g + 1);
        setFileHash(s);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "The file couldn't be opened.");
    } finally {
      setBusy(false);
    }
  }, []);

  // Reopen the file named in the URL after a reload. Once only: in development StrictMode runs effects
  // twice, and a second open would find the first one's editing lock and open read-only.
  const reopened = useRef(false);
  useEffect(() => {
    if (reopened.current) return;
    reopened.current = true;
    void pruneCompareSnapshots();
    const compare = COMPARE_HASH.exec(location.hash);
    if (compare) {
      void open(() => openCompareSnapshot(compare[1] as string));
      return;
    }
    const m = FILE_HASH.exec(location.hash);
    if (!m) return;
    const fileId = m[1] as string;
    void open(async () => {
      const recent = (await listRecentFiles()).find((f) => f.fileId === fileId);
      return openStoredFile(fileId, recent?.name ?? fileId);
    });
  }, [open]);

  // A file link pasted into this tab's address bar (#/file/<id>) opens that file. An open file closes
  // first, as Back to files does: the editor unmounts (its last save and journal flush run), then
  // closeSession waits for them and lets the editing lock go.
  useEffect(() => {
    const onHash = () => {
      const m = FILE_HASH.exec(location.hash);
      if (!m) return;
      const fileId = m[1] as string;
      const was = current.current;
      if (was && !was.compare && was.doc.fileId === fileId) return;
      void open(async () => {
        if (was && current.current === was) {
          flushSync(() => setSession(null));
          await closeSession(was);
        }
        const recent = (await listRecentFiles()).find((f) => f.fileId === fileId);
        return openStoredFile(fileId, recent?.name ?? fileId);
      });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [open]);

  const updateToast = update && (
    <div className="banner update-toast" role="status">
      <Icon name="refresh-cw" />
      <span className="banner-text">
        <strong>Update ready</strong>
        {updateError && <> {updateError}</>}
      </span>
      <span aria-hidden="true">·</span>
      <button type="button" className="btn btn-primary" onClick={reload}>
        Reload
      </button>
    </div>
  );

  if (session) {
    return (
      <>
        <Editor
          key={generation}
          session={session}
          onClose={() => {
            // Unmount the editor now, so its cleanup notes its last save before closeSession waits for it.
            flushSync(() => setSession(null));
            void closeSession(session);
            setFileHash(null);
          }}
          onSession={(next) => {
            // Keep, Discard or a reload that finished after the file was closed: the close already let the lock go.
            if (current.current !== session) {
              if (next.lock && next.lock !== session.lock) void closeSession(next);
              return;
            }
            // A new document (after Keep) needs a fresh editor; the same one only re-renders.
            if (next.doc !== session.doc) setGeneration((g) => g + 1);
            setSession(next);
          }}
        />
        {updateToast}
      </>
    );
  }

  return (
    <>
      <Home
        busy={busy}
        error={error}
        onDismissError={() => setError(null)}
        onNew={() => void open(createFile)}
        onOpenFolder={() => void open(openFolder)}
        onOpenRecent={(f) => void open(() => openStoredFile(f.fileId, f.name))}
      />
      {updateToast}
    </>
  );
}
