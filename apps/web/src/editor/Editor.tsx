import { useCallback, useEffect, useRef, useState } from "react";
import type { NodeId } from "@illigma/format";
import { Autosaver } from "@illigma/host-web";
import { hitTest as hitTestPage } from "@illigma/renderer";
import type { Session } from "../files";
import { Icon, LogoMark } from "../ui/Icon";
import { Canvas, type CanvasHandle, type HitTest, type Tool } from "./Canvas";
import { useDocVersion, useSaveDisplay } from "./hooks";
import { LayersPanel } from "./LayersPanel";
import { PropertiesPanel } from "./PropertiesPanel";
import { TOOLS, ToolDock } from "./ToolDock";

interface EditorProps {
  session: Session;
  onClose(): void;
  onKeepRecovered(): void;
  onDiscardRecovered(): void;
}

const RETRY_MS = 30_000;

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export function Editor({ session, onClose, onKeepRecovered, onDiscardRecovered }: EditorProps) {
  const { doc, backend, journal } = session;
  useDocVersion(doc);

  const [autosaver, setAutosaver] = useState<Autosaver | null>(null);
  const [pageState, setPageId] = useState<NodeId>(() => doc.pages()[0]?.id ?? "");
  const [selectionState, setSelection] = useState<NodeId | null>(null);
  const [tool, setTool] = useState<Tool>("move");
  const [zoom, setZoom] = useState(1);
  const [closing, setClosing] = useState(false);
  const canvas = useRef<CanvasHandle>(null);

  // Undo can remove the selected layer or a page: fall back gracefully.
  const pageId = doc.has(pageState) ? pageState : (doc.pages()[0]?.id ?? "");
  const selection = selectionState && doc.has(selectionState) ? selectionState : null;

  // Click-to-select: the topmost layer under the pointer, in page coordinates.
  const hitTest = useCallback<HitTest>((x, y) => hitTestPage(doc, pageId, x, y), [doc, pageId]);

  useEffect(() => {
    // Every committed edit goes to the recovery journal first; the autosaver clears it after each save.
    const detachJournal = journal.attach(doc);
    const saver = new Autosaver(doc, backend, { journal });
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
      detachJournal();
    };
  }, [doc, backend, journal]);

  const save = useSaveDisplay(autosaver, backend);

  // Failures are never silent, and Illigma keeps trying (save-states.md rule 3).
  useEffect(() => {
    if (save.state !== "error" || !autosaver) return;
    const t = setInterval(() => void autosaver.flushNow(), RETRY_MS);
    return () => clearInterval(t);
  }, [save.state, autosaver]);

  const goHome = async () => {
    setClosing(true);
    try {
      if (autosaver && autosaver.status.state !== "saved") await autosaver.flushNow();
    } finally {
      onClose();
    }
  };

  // Keyboard shortcuts. ⌘ on macOS, Ctrl elsewhere.
  const keys = useRef({ autosaver, selection, tool });
  keys.current = { autosaver, selection, tool };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
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
        if (e.shiftKey) doc.redo();
        else doc.undo();
        return;
      }
      if (mod && k === "y") {
        e.preventDefault();
        doc.redo();
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
        const id = keys.current.selection;
        doc.transact("Delete layer", (tx) => tx.delete(id));
        setSelection(null);
        return;
      }
      const t = TOOLS.find((x) => x.key.toLowerCase() === k) ?? (k === "a" ? TOOLS.find((x) => x.id === "frame") : undefined);
      if (t && !e.shiftKey) {
        e.preventDefault();
        setTool(t.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doc]);

  return (
    <div className="editor">
      <header className="title-bar">
        <div className="title-left">
          <button type="button" className="icon-button" aria-label="Back to files" title="Back to files" onClick={() => void goHome()} disabled={closing}>
            <LogoMark size={20} />
          </button>
          <h1 className="file-title">{doc.name}</h1>
          <div className={`save-status tone-${save.tone}`} role="status" aria-live="polite" data-save-state={save.state} title={save.message}>
            {save.tone === "error" && <Icon name="triangle-alert" size={12} />}
            <span>{save.text}</span>
            {save.tone === "error" && (
              <>
                <span aria-hidden="true">·</span>
                <button type="button" className="link-button" onClick={() => void autosaver?.flushNow()}>
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

      <div className="editor-body">
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
            onSelect={setSelection}
            onCreated={(id) => {
              setSelection(id);
              setTool("move");
            }}
            onZoom={setZoom}
            handle={canvas}
          />

          <div className="banners">
            {session.recovered.length > 0 && (
              <div className="banner banner-info" role="alert">
                <Icon name="history" />
                <span className="banner-text">
                  <strong>Recovered unsaved changes.</strong> {session.recovered.length} {session.recovered.length === 1 ? "edit" : "edits"} from your last session didn't reach the file.
                </span>
                <button type="button" className="btn btn-primary" onClick={onKeepRecovered}>
                  Keep
                </button>
                <button type="button" className="btn btn-secondary" onClick={onDiscardRecovered}>
                  Discard
                </button>
              </div>
            )}
            {save.tone === "error" && (
              <div className="banner banner-error" role="alert">
                <Icon name="triangle-alert" />
                <span className="banner-text">
                  <strong>Couldn't save to {backend.label}.</strong> {save.message ?? ""} Your changes are safe in this tab and in the recovery journal. Illigma retries every 30 seconds.
                </span>
                <button type="button" className="btn btn-secondary" onClick={() => void autosaver?.flushNow()}>
                  Retry
                </button>
              </div>
            )}
          </div>

          <ToolDock tool={tool} onTool={setTool} />
        </main>

        <PropertiesPanel doc={doc} pageId={pageId} selection={selection} />
      </div>
    </div>
  );
}
