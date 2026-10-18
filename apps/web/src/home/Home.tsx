import { useEffect, useState } from "react";
import { listRecentFiles, supportsFolderAccess } from "@illigma/host-web";
import { Icon, LogoMark } from "../ui/Icon";

export interface RecentFile {
  fileId: string;
  name: string;
  updatedAt: number;
}

interface HomeProps {
  busy: boolean;
  error: string | null;
  onDismissError(): void;
  onNew(): void;
  onOpenFolder(): void;
  onOpenRecent(file: RecentFile): void;
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function edited(at: number): string {
  if (!at) return "Edited some time ago";
  const s = Math.round((at - Date.now()) / 1000);
  if (s > -60) return "Edited just now";
  if (s > -3600) return `Edited ${rtf.format(Math.round(s / 60), "minute")}`;
  if (s > -86400) return `Edited ${rtf.format(Math.round(s / 3600), "hour")}`;
  return `Edited ${rtf.format(Math.round(s / 86400), "day")}`;
}

export function Home({ busy, error, onDismissError, onNew, onOpenFolder, onOpenRecent }: HomeProps) {
  const [recent, setRecent] = useState<RecentFile[] | null>(null);
  const [listError, setListError] = useState(false);
  const folders = supportsFolderAccess();

  useEffect(() => {
    let live = true;
    listRecentFiles()
      .then((files) => live && setRecent(files))
      .catch(() => live && (setRecent([]), setListError(true)));
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="home">
      <header className="home-bar">
        <LogoMark size={20} />
        <span className="home-brand">Illigma</span>
      </header>

      <main className="home-main" aria-busy={busy}>
        <h1 className="home-title">Files</h1>

        {error && (
          <div className="banner banner-error" role="alert">
            <Icon name="triangle-alert" />
            <span className="banner-text">{error}</span>
            <button type="button" className="btn btn-ghost" onClick={onDismissError}>
              Dismiss
            </button>
          </div>
        )}

        <div className="home-actions">
          <button type="button" className="btn btn-primary btn-md" onClick={onNew} disabled={busy}>
            <Icon name="plus" />
            New design file
          </button>
          {folders && (
            <button type="button" className="btn btn-secondary btn-md" onClick={onOpenFolder} disabled={busy}>
              <Icon name="folder-open" />
              Open folder…
            </button>
          )}
        </div>

        <section aria-labelledby="recent-heading" className="home-section">
          <h2 id="recent-heading" className="section-heading">
            Recent
          </h2>
          {recent === null ? (
            <p className="muted">Loading files…</p>
          ) : recent.length === 0 ? (
            <p className="muted">{listError ? "Couldn't read this browser's file storage." : "No files yet. Create a design file to start."}</p>
          ) : (
            <ul className="file-grid" aria-label="Recent files">
              {recent.map((f) => (
                <li key={f.fileId}>
                  <button type="button" className="file-card" onClick={() => onOpenRecent(f)} disabled={busy}>
                    <span className="file-thumb" aria-hidden="true">
                      <Icon name="file" size={20} />
                    </span>
                    <span className="file-name">{f.name}</span>
                    <span className="file-meta">
                      <Icon name="hard-drive" size={12} />
                      <span className="file-meta-text">This browser · {edited(f.updatedAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="home-note">
          Files are saved on this computer, in this browser's private storage{folders ? " or in a folder you choose" : ""}. Nothing is uploaded.
        </p>
      </main>
    </div>
  );
}
