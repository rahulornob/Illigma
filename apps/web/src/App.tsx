import { useCallback, useEffect, useState } from "react";
import { listRecentFiles } from "@illigma/host-web";
import { Editor } from "./editor/Editor";
import { createFile, discardRecovered, keepRecovered, openFolder, openStoredFile, type Session } from "./files";
import { Home } from "./home/Home";

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

  // Reopen the file named in the URL after a reload.
  useEffect(() => {
    const m = FILE_HASH.exec(location.hash);
    if (!m) return;
    const fileId = m[1] as string;
    void open(async () => {
      const recent = (await listRecentFiles()).find((f) => f.fileId === fileId);
      return openStoredFile(fileId, recent?.name ?? fileId);
    });
  }, [open]);

  if (session) {
    return (
      <Editor
        key={generation}
        session={session}
        onClose={() => {
          setSession(null);
          setFileHash(null);
        }}
        onKeepRecovered={() => void open(() => keepRecovered(session))}
        onDiscardRecovered={() => void discardRecovered(session).then(setSession)}
      />
    );
  }

  return (
    <Home
      busy={busy}
      error={error}
      onDismissError={() => setError(null)}
      onNew={() => void open(createFile)}
      onOpenFolder={() => void open(openFolder)}
      onOpenRecent={(f) => void open(() => openStoredFile(f.fileId, f.name))}
    />
  );
}
