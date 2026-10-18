import { useCallback, useEffect, useRef, useState } from "react";
import type { NodeId } from "@illigma/format";
import { Autosaver } from "@illigma/host-web";
import { hitTest as hitTestPage } from "@illigma/renderer";
import { discardRecovered, keepRecovered, saveCopyElsewhere, type Session } from "../files";
import { Icon, LogoMark } from "../ui/Icon";
import { Canvas, type CanvasHandle, type HitTest, type Tool } from "./Canvas";
import { useDocVersion, useSaveDisplay } from "./hooks";
import { LayersPanel } from "./LayersPanel";
import { PropertiesPanel } from "./PropertiesPanel";
import { TOOLS, ToolDock } from "./ToolDock";

interface EditorProps {
  session: Session;
  onClose(): void;
  /** The session changed: recovered edits kept (a new document) or discarded (the same one). */
  onSession(next: Session): void;
}

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/** Top-level containers whose children a plain click picks directly, as in Figma. */
const CONTAINERS = new Set(["FRAME", "SECTION", "COMPONENT"]);

const messageOf = (e: unknown) => (e instanceof Error && e.message ? e.message : String(e)).replace(/\.?$/, ".");

type Recovery = { busy: "keep" | "discard" | null; error: string | null };

export function Editor({ session, onClose, onSession }: EditorProps) {
  const { doc, backend, journal } = session;
  useDocVersion(doc);

  /** Another tab is editing this file: view only, no autosave, no journal. */
  const viewOnly = session.lock === null;
  const undecided = session.recovered.length > 0;

  const [autosaver, setAutosaver] = useState<Autosaver | null>(null);
  const [saverGeneration, setSaverGeneration] = useState(0);
  const saverRef = useRef<Autosaver | null>(null);
  const [recovery, setRecovery] = useState<Recovery>({ busy: null, error: null });
  const [notice, setNotice] = useState<string | null>(session.notice ?? null);
  const [copy, setCopy] = useState<{ busy: boolean; message: string | null; failed: boolean }>({ busy: false, message: null, failed: false });
  const [pageState, setPageId] = useState<NodeId>(() => doc.pages()[0]?.id ?? "");
  const [selectionState, setSelection] = useState<NodeId | null>(null);
  const [toolState, setTool] = useState<Tool>("move");
  const [zoom, setZoom] = useState(1);
  const [closing, setClosing] = useState(false);
  const canvas = useRef<CanvasHandle>(null);

  /** No edits: view-only tab, or Keep/Discard is running (an edit then could land on the document being replaced). */
  const locked = viewOnly || recovery.busy !== null;
  const tool: Tool = locked ? "move" : toolState;

  // Undo can remove the selected layer or a page: fall back gracefully.
  const pageId = doc.has(pageState) ? pageState : (doc.pages()[0]?.id ?? "");
  const selection = selectionState && doc.has(selectionState) ? selectionState : null;

  // Click-to-select, as in Figma: inside a top-level frame the click picks the frame's child (a group as a
  // whole); the frame itself is picked on its empty area. ⌘/Ctrl-click picks the deepest layer.
  const hitTest = useCallback<HitTest>(
    (x, y, { deep }) => {
      if (deep) return hitTestPage(doc, pageId, x, y, { deep: true });
      const top = hitTestPage(doc, pageId, x, y);
      const topNode = top ? doc.get(top) : undefined;
      if (!top || !topNode || !CONTAINERS.has(topNode.type)) return top;
      let cur = hitTestPage(doc, pageId, x, y, { deep: true }) ?? top;
      for (let parent = doc.get(cur)?.parentId; cur !== top && parent && parent !== top; parent = doc.get(cur)?.parentId) cur = parent;
      return cur;
    },
    [doc, pageId],
  );

  // Every committed edit goes to the recovery journal first (save-states.md rule 2).
  useEffect(() => {
    if (viewOnly) return; // the journal belongs to the tab that is editing
    const detach = journal.attach(doc);
    // The 250 ms batch must not be lost when the tab is hidden or closed.
    const flushJournal = () => void journal.flush().catch(() => {});
    const onHidden = () => document.visibilityState === "hidden" && flushJournal();
    window.addEventListener("pagehide", flushJournal);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", flushJournal);
      document.removeEventListener("visibilitychange", onHidden);
      detach();
    };
  }, [doc, journal, viewOnly]);

  // Autosave. It runs while the recovery banner is undecided too: the journal keeps the recovered
  // lines through its saves (only Keep or Discard removes them), so editing first loses nothing.
  useEffect(() => {
    if (viewOnly) return;
    const saver = new Autosaver(doc, backend, { journal });
    saverRef.current = saver;
    setAutosaver(saver);
    const flush = () => {
      if (saver.status.state !== "saved") void saver.flushNow();
    };
    const onHidden = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHidden);
      flush();
      saver.dispose();
      if (saverRef.current === saver) saverRef.current = null;
    };
  }, [doc, backend, journal, viewOnly, saverGeneration]);

  const save = useSaveDisplay(autosaver, backend);
  // Retrying every 30 seconds is the Autosaver's job (save-states.md rule 3).

  const retry = () => {
    // Asked inside the click: browsers only show the permission prompt during a user gesture.
    const asked = backend.requestAccess?.();
    void (async () => {
      if (asked) await asked.catch(() => false);
      await autosaver?.flushNow();
    })();
  };

  const saveCopy = () => {
    setCopy({ busy: true, message: null, failed: false });
    // Called inside the click, so the folder picker may open.
    saveCopyElsewhere(doc).then(
      (where) => setCopy({ busy: false, message: where ? `Saved a copy to ${where}` : null, failed: false }),
      (e: unknown) => setCopy({ busy: false, message: `Couldn't save a copy: ${messageOf(e)}`, failed: true }),
    );
  };

  const keep = async () => {
    setRecovery({ busy: "keep", error: null });
    // Stop autosaving this document: after the kept copy is saved, a late save of this one would overwrite it.
    saverRef.current?.dispose();
    try {
      onSession(await keepRecovered(session));
    } catch (e) {
      setRecovery({ busy: null, error: `Couldn't keep the recovered changes: ${messageOf(e)} Nothing was changed; they are still in the recovery journal.` });
      setSaverGeneration((g) => g + 1);
    }
  };

  const discard = () => {
    setRecovery({ busy: "discard", error: null });
    discardRecovered(session).then(
      (next) => {
        setRecovery({ busy: null, error: null });
        onSession(next);
      },
      (e: unknown) => setRecovery({ busy: null, error: `Couldn't discard the recovered changes: ${messageOf(e)} They are still in the recovery journal.` }),
    );
  };

  const goHome = async () => {
    setClosing(true);
    try {
      if (autosaver && autosaver.status.state !== "saved") await autosaver.flushNow();
      if (!viewOnly) await journal.flush().catch(() => {});
    } finally {
      onClose();
    }
  };

  // Keyboard shortcuts. ⌘ on macOS, Ctrl elsewhere.
  const keys = useRef({ autosaver, selection, tool, locked });
  keys.current = { autosaver, selection, tool, locked };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      const { locked: noEdits } = keys.current;
      if (mod && k === "s") {
        e.preventDefault();
        void keys.current.autosaver?.flushNow();
        return;
      }
      if (mod && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        canvas.current?.zoomIn();
        return;
      }
      if (mod && (e.key === "-" || e.key === "_")) {
        e.preventDefault();
        canvas.current?.zoomOut();
        return;
      }
      if (isTyping(e.target)) return;
      if (mod && k === "z") {
        e.preventDefault();
        if (noEdits) return;
        if (e.shiftKey) doc.redo();
        else doc.undo();
        return;
      }
      if (mod && k === "y") {
        e.preventDefault();
        if (!noEdits) doc.redo();
        return;
      }
      if (mod && e.key === "0") {
        e.preventDefault();
        canvas.current?.zoomTo(1);
        return;
      }
      if (mod || e.altKey) return;
      if (e.shiftKey && e.code === "Digit1") {
        e.preventDefault();
        canvas.current?.fit();
        return;
      }
      if (e.shiftKey && e.code === "Digit0") {
        e.preventDefault();
        canvas.current?.zoomTo(1);
        return;
      }
      if (e.key === "Escape") {
        if (keys.current.tool !== "move") setTool("move");
        else setSelection(null);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && keys.current.selection) {
        e.preventDefault();
        if (noEdits) return;
        const id = keys.current.selection;
        doc.transact("Delete layer", (tx) => tx.delete(id));
        setSelection(null);
        return;
      }
      const t = TOOLS.find((x) => x.key.toLowerCase() === k) ?? (k === "a" ? TOOLS.find((x) => x.id === "frame") : undefined);
      if (t && !e.shiftKey) {
        e.preventDefault();
        if (!noEdits) setTool(t.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doc]);

  const status = viewOnly ? { text: "Read-only", tone: "quiet" as const, state: "read-only", message: undefined } : save;

  return (
    <div className="editor">
      <header className="title-bar">
        <div className="title-left">
          <button type="button" className="icon-button" aria-label="Back to files" title="Back to files" onClick={() => void goHome()} disabled={closing}>
            <LogoMark size={20} />
          </button>
          <h1 className="file-title">{doc.name}</h1>
          <div className={`save-status tone-${status.tone}`} role="status" aria-live="polite" data-save-state={status.state} title={status.message}>
            {status.tone === "error" && <Icon name="triangle-alert" size={12} />}
            {viewOnly && <Icon name="lock" size={12} />}
            <span>{status.text}</span>
            {status.tone === "error" && (
              <>
                <span aria-hidden="true">·</span>
                <button type="button" className="link-button" onClick={retry}>
                  Retry
                </button>
              </>
            )}
          </div>
        </div>
        <div className="title-right" role="group" aria-label="Zoom">
          <button type="button" className="icon-button" aria-label="Zoom out (⌘−)" title="Zoom out  ⌘−" onClick={() => canvas.current?.zoomOut()}>
            <Icon name="minus" />
          </button>
          <button type="button" className="zoom-value" aria-label={`Zoom ${Math.round(zoom * 100)}%. Zoom to fit (Shift+1)`} title="Zoom to fit  ⇧1" onClick={() => canvas.current?.fit()}>
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" className="icon-button" aria-label="Zoom in (⌘+)" title="Zoom in  ⌘+" onClick={() => canvas.current?.zoomIn()}>
            <Icon name="plus" />
          </button>
        </div>
      </header>

      <div className="editor-body" aria-busy={recovery.busy !== null}>
        <LayersPanel
          doc={doc}
          pageId={pageId}
          selection={selection}
          onPage={(id) => {
            setPageId(id);
            setSelection(null);
          }}
          onSelect={setSelection}
        />

        <main className="canvas-area" aria-label="Canvas area">
          <Canvas
            doc={doc}
            pageId={pageId}
            tool={tool}
            selection={selection}
            hitTest={hitTest}
            readOnly={locked}
            onSelect={setSelection}
            onCreated={(id) => {
              setSelection(id);
              setTool("move");
            }}
            onZoom={setZoom}
            handle={canvas}
          />

          <div className="banners">
            {viewOnly && (
              <div className="banner banner-warning" role="status">
                <Icon name="lock" />
                <span className="banner-text">
                  <strong>Open in another tab — read-only here.</strong> Close the other tab, then reload to edit.
                </span>
                <button type="button" className="btn btn-secondary" onClick={() => location.reload()}>
                  Reload
                </button>
              </div>
            )}
            {undecided && !viewOnly && (
              <div className="banner banner-info" role="alert">
                <Icon name="history" />
                <span className="banner-text">
                  <strong>Recovered unsaved changes.</strong> {session.recovered.length} {session.recovered.length === 1 ? "edit" : "edits"} from your last session didn't reach the file.
                </span>
                <button type="button" className="btn btn-primary" onClick={() => void keep()} disabled={recovery.busy !== null}>
                  {recovery.busy === "keep" ? "Keeping…" : "Keep"}
                </button>
                <button type="button" className="btn btn-secondary" onClick={discard} disabled={recovery.busy !== null}>
                  Discard
                </button>
              </div>
            )}
            {recovery.error && (
              <div className="banner banner-error" role="alert">
                <Icon name="triangle-alert" />
                <span className="banner-text">{recovery.error}</span>
              </div>
            )}
            {notice && (
              <div className="banner banner-info" role="status">
                <Icon name="history" />
                <span className="banner-text">{notice}</span>
                <button type="button" className="btn btn-secondary" onClick={() => setNotice(null)}>
                  OK
                </button>
              </div>
            )}
            {save.tone === "error" && !viewOnly && (
              <div className="banner banner-error" role="alert">
                <Icon name="triangle-alert" />
                <span className="banner-text">
                  <strong>Couldn't save to {backend.label}.</strong> {save.reason ? `Reason: ${save.reason} ` : ""}Your changes are safe in this tab and in the recovery
                  journal. Illigma retries every 30 seconds.
                </span>
                <button type="button" className="btn btn-secondary" onClick={retry}>
                  Retry
                </button>
                <button type="button" className="btn btn-secondary" onClick={saveCopy} disabled={copy.busy}>
                  Save a copy elsewhere…
                </button>
              </div>
            )}
            {copy.message && (
              <div className={`banner ${copy.failed ? "banner-error" : "banner-info"}`} role={copy.failed ? "alert" : "status"}>
                <Icon name={copy.failed ? "triangle-alert" : "check"} />
                <span className="banner-text">{copy.message}</span>
                <button type="button" className="btn btn-secondary" onClick={() => setCopy({ busy: false, message: null, failed: false })}>
                  OK
                </button>
              </div>
            )}
          </div>

          <ToolDock tool={tool} onTool={(t) => !locked && setTool(t)} />
        </main>

        <PropertiesPanel doc={doc} pageId={pageId} selection={selection} readOnly={locked} />
      </div>
    </div>
  );
}
