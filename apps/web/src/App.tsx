import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { listRecentFiles } from "@illigma/host-web";
import { Editor } from "./editor/Editor";
import { closeSession, createFile, openFolder, openStoredFile, type Session } from "./files";
import { Home } from "./home/Home";
import { applyUpdate, subscribeUpdate, updateReady } from "./sw-update";
import { Icon } from "./ui/Icon";

const FILE_HASH = /^#\/file\/([A-Za-z0-9_-]+)$/;

/** Files in this browser's storage get a URL (#/file/<id>) so a reload reopens them. */
function setFileHash(session: Session | null): void {
  const url = session?.backend.kind === "opfs" ? `#/file/${session.doc.fileId}` : location.pathname + location.search;
  history.replaceState(null, "", url);
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [generation, setGeneration] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = useSyncExternalStore(subscribeUpdate, updateReady);

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
    const m = FILE_HASH.exec(location.hash);
    if (!m || reopened.current) return;
    reopened.current = true;
    const fileId = m[1] as string;
    void open(async () => {
      const recent = (await listRecentFiles()).find((f) => f.fileId === fileId);
      return openStoredFile(fileId, recent?.name ?? fileId);
    });
  }, [open]);

  const updateToast = update && (
    <div className="banner update-toast" role="status">
      <Icon name="refresh-cw" />
      <span className="banner-text">
        <strong>Update ready</strong>
      </span>
      <span aria-hidden="true">·</span>
      <button type="button" className="btn btn-primary" onClick={applyUpdate}>
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
            closeSession(session);
            setSession(null);
            setFileHash(null);
          }}
          onSession={(next) => {
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
