import { useCallback, useEffect, useRef, useState } from "react";
import type { NodeId } from "@illigma/format";
import { Autosaver } from "@illigma/host-web";
import { hitTest as hitTestPage } from "@illigma/renderer";
import {
  discardRecovered,
  exportSkippedEdits,
  keepRecovered,
  reloadFromDisk,
  saveConflictCopy,
  saveCopyElsewhere,
  snapshotDiskVersion,
  undoReload,
  whileClosing,
  type Session,
} from "../files";
import { onBeforeUpdate } from "../sw-update";
import { Icon, LogoMark } from "../ui/Icon";
import { Canvas, type CanvasHandle, type HitTest, type Tool } from "./Canvas";
import { createdLayers, deleteLayers, duplicateLayers, freeLayers, movable, moveBy, reorderStep, sharedFlowParent, snapshot, topmost } from "./edit";
import { placeCopies, rememberDuplicate, repeatOffset } from "./snap/repeat";
import { nudgeFor } from "./geometry";
import { autoLayoutSelection, removeAutoLayout } from "./layout-model";
import { useDocVersion, useSaveDisplay } from "./hooks";
import { LayersPanel } from "./LayersPanel";
import { PropertiesPanel } from "./PropertiesPanel";
import { openWarnings } from "./open-warnings";
import { useImageImport } from "./paint/useImageImport";
import { openExportDialog } from "./export/dialog-state";
import { ExportHost } from "./export/ExportHost";
import { TOOLS, ToolDock } from "./ToolDock";
import { settleTextForSave } from "./text/session";
import { inLayer, onControl } from "./focus";
import { useLayerCommands } from "./useLayerCommands";
import { usePageMemory } from "./usePageMemory";

interface EditorProps {
  session: Session;
  onClose(): void;
  /** The session changed: recovered edits kept (a new document) or discarded (the same one). */
  onSession(next: Session): void;
}

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/** Top-level containers whose children a plain click picks directly, as in Figma. */
const CONTAINERS = new Set(["FRAME", "SECTION", "COMPONENT"]);

/** How close to a thin line or stroke a click still picks it, in screen pixels. */
const HIT_TOLERANCE_PX = 3;

const messageOf = (e: unknown) => (e instanceof Error && e.message ? e.message : String(e)).replace(/\.?$/, ".");

type Recovery = { busy: "keep" | "discard" | null; error: string | null };
/** "Changed on disk" (save-states.md rule 4): Keep mine saves this version as a conflict copy, then asks before replacing the disk version. */
type Conflict = { busy: boolean; copiedTo: string | null; error: string | null };

/** How often a file in a folder is checked for changes made outside this tab (synced folders, other apps). */
const DISK_CHECK_MS = 5000;

export function Editor({ session, onClose, onSession }: EditorProps) {
  const { doc, backend, journal } = session;
  useDocVersion(doc);

  /** Another tab is editing this file: view only, no autosave, no journal. */
  const viewOnly = session.lock === null;
  const undecided = session.recovered.length > 0;

  const [autosaver, setAutosaver] = useState<Autosaver | null>(null);
  const [saverGeneration, setSaverGeneration] = useState(0);
  const saverRef = useRef<Autosaver | null>(null);
  /** The next autosaver starts unsaved: the one before it stopped with edits it never wrote (a failed Keep). */
  const startUnsaved = useRef(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const [diskBusy, setDiskBusy] = useState(false);
  const [conflict, setConflict] = useState<Conflict>({ busy: false, copiedTo: null, error: null });
  const [reloaded, setReloaded] = useState<{ busy: boolean; error: string | null } | null>(session.reloadedFrom ? { busy: false, error: null } : null);
  /** Going Home with edits that aren't saved: ask first (rule 3, never silent). */
  const [leaving, setLeaving] = useState<{ journalOk: boolean } | null>(null);
  const [recovery, setRecovery] = useState<Recovery>({ busy: null, error: null });
  const [notice, setNotice] = useState<string | null>(session.notice ?? null);
  /** What couldn't be read when the file opened: shown until dismissed. */
  const [opened, setOpened] = useState(() => openWarnings(session.warnings));
  /** An edit the document refused (it changed nothing): said once, until dismissed or the next one. */
  const [editError, setEditError] = useState<string | null>(null);
  const reportEditError = useCallback((e: unknown) => setEditError(`Couldn't make that change: ${messageOf(e)} Nothing was changed.`), []);
  const [copy, setCopy] = useState<{ busy: boolean; message: string | null; failed: boolean }>({ busy: false, message: null, failed: false });
  const [pageState, setPageId] = useState<NodeId>(() => doc.pages()[0]?.id ?? "");
  const [selectionState, setSelection] = useState<NodeId[]>([]);
  const [toolState, setTool] = useState<Tool>("move");
  const [zoom, setZoom] = useState(1);
  const [closing, setClosing] = useState(false);
  const canvas = useRef<CanvasHandle>(null);

  /** No edits: view-only tab, or Keep/Discard or a reload from disk is running (an edit then could land on the document being replaced). */
  const locked = viewOnly || recovery.busy !== null || diskBusy;
  const tool: Tool = locked ? "move" : toolState;

  // Undo can remove the selected layer or a page: fall back gracefully.
  const pageId = doc.has(pageState) ? pageState : (doc.pages()[0]?.id ?? "");
  const selection = selectionState.every((id) => doc.has(id)) ? selectionState : selectionState.filter((id) => doc.has(id));

  // Click-to-select, as in Figma: inside a top-level frame the click picks the frame's child (a group as a
  // whole); the frame itself is picked on its empty area. ⌘/Ctrl-click picks the deepest layer.
  // Thin lines and strokes are picked within 3 screen pixels at any zoom.
  const hitTest = useCallback<HitTest>(
    (x, y, { deep }) => {
      const tolerance = HIT_TOLERANCE_PX / zoom;
      if (deep) return hitTestPage(doc, pageId, x, y, { deep: true, tolerance });
      const top = hitTestPage(doc, pageId, x, y, { tolerance });
      const topNode = top ? doc.get(top) : undefined;
      if (!top || !topNode || !CONTAINERS.has(topNode.type)) return top;
      let cur = hitTestPage(doc, pageId, x, y, { deep: true, tolerance }) ?? top;
      for (let parent = doc.get(cur)?.parentId; cur !== top && parent && parent !== top; parent = doc.get(cur)?.parentId) cur = parent;
      return cur;
    },
    [doc, pageId, zoom],
  );

  /**
   * A drag still open on the canvas is kept before anything that writes the document
   * (closing the tab, going Home, Keep, an app update): a save or journal flush would
   * otherwise silently leave it out, or fail on it.
   */
  const settleDrag = useCallback(() => {
    // A new text layer with no text is removed, never kept: an empty layer must not reach the file.
    settleTextForSave(doc);
    const drag = doc.live;
    if (drag?.open) drag.commit();
  }, [doc]);

  /** Writes that replace the session (Keep, Discard, reloads): closing the file waits for them before giving up the lock. */
  const track = <T,>(work: Promise<T>): Promise<T> => {
    whileClosing(doc.fileId, work);
    return work;
  };

  // Every committed edit goes to the recovery journal first (save-states.md rule 2).
  useEffect(() => {
    if (viewOnly) return; // the journal belongs to the tab that is editing
    const detach = journal.attach(doc);
    // The 250 ms batch must not be lost when the tab is hidden or closed. The OPFS append is asynchronous and may
    // not finish before the page goes away, so the batch is also stashed synchronously; the next load picks it up.
    const flushJournal = () => {
      settleDrag();
      journal.stashUnflushed();
      void journal.flush().catch(() => {});
    };
    const onHidden = () => document.visibilityState === "hidden" && flushJournal();
    window.addEventListener("pagehide", flushJournal);
    window.addEventListener("beforeunload", flushJournal);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", flushJournal);
      window.removeEventListener("beforeunload", flushJournal);
      document.removeEventListener("visibilitychange", onHidden);
      whileClosing(doc.fileId, detach());
    };
  }, [doc, journal, viewOnly, settleDrag]);

  // Autosave. It runs while the recovery banner is undecided too: the journal keeps the recovered
  // lines through its saves (only Keep or Discard removes them), so editing first loses nothing.
  useEffect(() => {
    if (viewOnly) return;
    const unsaved = startUnsaved.current;
    startUnsaved.current = false;
    const saver = new Autosaver(doc, backend, unsaved ? { journal, unsaved } : { journal });
    saverRef.current = saver;
    setAutosaver(saver);
    const flush = () => {
      settleDrag();
      return saver.status.state !== "saved" ? saver.flushNow() : Promise.resolve();
    };
    const onHide = () => void flush();
    const onHidden = () => document.visibilityState === "hidden" && onHide();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHidden);
      // The file stays locked until this last save is done (files.ts whileClosing).
      whileClosing(doc.fileId, flush());
      saver.dispose();
      if (saverRef.current === saver) saverRef.current = null;
    };
  }, [doc, backend, journal, viewOnly, saverGeneration, settleDrag]);

  const save = useSaveDisplay(autosaver, backend);
  // Retrying every 30 seconds is the Autosaver's job (save-states.md rule 3).

  // An app update reloads the page: flush the journal and save first. A journal that can't be written stops the update.
  useEffect(() => {
    if (viewOnly) return;
    return onBeforeUpdate(async () => {
      settleDrag();
      await journal.flush();
      await saverRef.current?.flushNow();
    });
  }, [journal, viewOnly, settleDrag]);

  // Changes on disk (rule 4). Every save checks first; a file in a folder is also checked now and then and on focus,
  // so a synced change shows up before the next edit. No unsaved edits: reload quietly. Otherwise hold saving.
  const checking = useRef(false);
  const checkDisk = useCallback(async () => {
    const saver = saverRef.current;
    if (!saver || checking.current || !backend.changedOnDisk) return;
    const current = sessionRef.current;
    checking.current = true;
    try {
      if (!(await backend.changedOnDisk())) return;
      if (!saver.hasUnsavedChanges && saver.status.state === "saved" && !current.recovered.length) {
        setDiskBusy(true);
        try {
          const next = await track(reloadFromDisk(current));
          // An edit that slipped in meanwhile: keep it, and let the person choose instead.
          if (!saver.hasUnsavedChanges) {
            onSession(next);
            return;
          }
        } catch {
          // A different file now: hold, and the banner explains.
        } finally {
          setDiskBusy(false);
        }
      }
      saver.holdForDisk();
    } catch {
      // The folder can't be read right now; the next save reports why.
    } finally {
      checking.current = false;
    }
  }, [backend, onSession]);

  useEffect(() => {
    if (viewOnly || backend.kind !== "folder" || !backend.changedOnDisk) return;
    const run = () => void checkDisk();
    const onVisible = () => document.visibilityState === "visible" && run();
    const timer = setInterval(run, DISK_CHECK_MS);
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [backend, viewOnly, checkDisk, saverGeneration]);

  /** Compare…: open the disk version read-only in a new tab. The tab opens inside the click so it isn't blocked. */
  const compare = () => {
    const win = window.open("", "_blank");
    setConflict((c) => ({ ...c, error: null }));
    snapshotDiskVersion(session).then(
      (id) => {
        const url = `${location.pathname}${location.search}#/compare/${id}`;
        if (win) win.location.href = url;
        else window.open(url, "_blank");
      },
      (e: unknown) => {
        win?.close();
        setConflict((c) => ({ ...c, error: `Couldn't open the version on disk: ${messageOf(e)}` }));
      },
    );
  };

  /** Keep mine, step 1: this version goes to a conflict copy first (the picker opens inside the click). */
  const keepMine = () => {
    setConflict({ busy: true, copiedTo: null, error: null });
    saveConflictCopy(session).then(
      (where) => setConflict({ busy: false, copiedTo: where, error: null }),
      (e: unknown) => setConflict({ busy: false, copiedTo: null, error: `Couldn't save your version as a copy: ${messageOf(e)} Nothing was changed.` }),
    );
  };

  /** Keep mine, step 2, after the person confirms: replace the disk version and keep saving here. */
  const replaceDisk = () => {
    setConflict((c) => ({ ...c, busy: true, error: null }));
    void (async () => {
      await saverRef.current?.overwriteDisk();
      setConflict({ busy: false, copiedTo: null, error: null });
    })();
  };

  const undoReloadFromDisk = () => {
    setReloaded({ busy: true, error: null });
    track(undoReload(session)).then(onSession, (e: unknown) =>
      setReloaded({ busy: false, error: `Couldn't undo: ${messageOf(e)} The version from disk is still open.` }),
    );
  };

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
    settleDrag(); // the kept copy is made from the document as it is: half a drag would be saved without being an edit
    setRecovery({ busy: "keep", error: null });
    // Stop autosaving this document: after the kept copy is saved, a late save of this one would overwrite it.
    const old = saverRef.current;
    const hadUnsaved = old !== null && (old.hasUnsavedChanges || old.status.state !== "saved");
    old?.dispose();
    try {
      onSession(await track(keepRecovered(session)));
    } catch (e) {
      setRecovery({ busy: null, error: `Couldn't keep the recovered changes: ${messageOf(e)} Nothing was changed; they are still in the recovery journal.` });
      // The new autosaver must not claim "Saved" for edits the stopped one never wrote; it saves them instead.
      startUnsaved.current = hadUnsaved;
      setSaverGeneration((g) => g + 1);
    }
  };

  const discard = () => {
    setRecovery({ busy: "discard", error: null });
    track(discardRecovered(session)).then(
      (next) => {
        setRecovery({ busy: null, error: null });
        onSession(next);
      },
      (e: unknown) => setRecovery({ busy: null, error: `Couldn't discard the recovered changes: ${messageOf(e)} They are still in the recovery journal.` }),
    );
  };

  const goHome = async () => {
    settleDrag();
    setClosing(true);
    let journalOk = true;
    try {
      if (autosaver && autosaver.status.state !== "saved") await autosaver.flushNow();
      if (!viewOnly)
        await journal.flush().catch(() => {
          journalOk = false;
        });
    } catch {
      // reported below
    }
    // Never leave silently with edits the file doesn't hold (rule 3).
    if (!viewOnly && autosaver && autosaver.status.state !== "saved") {
      setLeaving({ journalOk });
      setClosing(false);
      return;
    }
    onClose();
  };

  // Keyboard shortcuts. ⌘ on macOS, Ctrl elsewhere.
  const keys = useRef({ autosaver, selection, tool, locked, pageId });
  keys.current = { autosaver, selection, tool, locked, pageId };
  useEffect(() => {
    /** Undo or redo. Layers it brings back (an undone delete, a redone duplicate) are selected again, as in Figma. */
    const step = (which: "undo" | "redo") => {
      let created: NodeId[] = [];
      const stop = doc.subscribe((c) => {
        if (c.origin === which) created = createdLayers(c.ops);
      });
      try {
        if (which === "undo") doc.undo();
        else doc.redo();
      } finally {
        stop();
      }
      const page = keys.current.pageId;
      const onPage = created.filter((id) => {
        let n = doc.get(id);
        while (n?.parentId) n = doc.get(n.parentId);
        return n?.id === page;
      });
      if (onPage.length) setSelection(onPage);
    };
    const onKey = (e: KeyboardEvent) => {
      // An edit the document refuses rolls back on its own: say so, never throw from a key press.
      try {
        handleKey(e);
      } catch (err) {
        reportEditError(err);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      const { locked: noEdits } = keys.current;
      if (mod && k === "s") {
        e.preventDefault();
        void keys.current.autosaver?.flushNow();
        return;
      }
      // ⇧⌘E: the Export dialog (export.md). Exporting changes nothing, so it works read-only too.
      if (mod && e.shiftKey && (k === "e" || e.code === "KeyE")) {
        e.preventDefault();
        openExportDialog();
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
      if (mod && e.key === "0") {
        e.preventDefault();
        canvas.current?.zoomTo(1);
        return;
      }
      // ⌘D is the browser's bookmark shortcut and ⌘P prints the page: never let them through, even from a
      // field or while editing text (where they do nothing).
      if (mod && (k === "d" || k === "p")) e.preventDefault();
      if (isTyping(e.target)) return;
      // Enter and Space on a focused button press the button; keys inside a dialog, popover or menu are theirs.
      if (!mod && (inLayer(e.target) || ((e.key === "Enter" || e.key === " ") && onControl(e.target)))) return;
      // A drag on the canvas is running: it owns the document until it ends (Escape cancels it there).
      if (doc.live) {
        if (mod || e.key === "Delete" || e.key === "Backspace" || e.key.startsWith("Arrow")) e.preventDefault();
        return;
      }
      const sel = keys.current.selection;
      if (mod && k === "d") {
        e.preventDefault(); // the browser's bookmark shortcut
        if (noEdits || !sel.length) return;
        // After "duplicate then move", the next ⌘D repeats that offset (interactions.md §2).
        const off = repeatOffset(doc, sel);
        const copies = doc.transact(sel.length === 1 ? "Duplicate layer" : `Duplicate ${sel.length} layers`, (tx) => {
          const made = duplicateLayers(tx, doc, sel);
          if (off) placeCopies(tx, doc, topmost(doc, sel), made, off);
          return made;
        });
        rememberDuplicate(doc, topmost(doc, sel), copies);
        setSelection(copies);
        return;
      }
      if (mod && k === "a") {
        // Select all in the current context: the selection's siblings, or the page's top-level layers.
        e.preventDefault();
        const parent = (sel[0] && doc.get(sel[0])?.parentId) || keys.current.pageId;
        setSelection(doc.children(parent).filter((n) => n.visible && !n.locked).map((n) => n.id));
        return;
      }
      if (mod && k === "z") {
        e.preventDefault();
        if (!noEdits) step(e.shiftKey ? "redo" : "undo");
        return;
      }
      if (mod && k === "y") {
        e.preventDefault();
        if (!noEdits) step("redo");
        return;
      }
      // Shift+A: add auto layout, or wrap the selection in an auto layout frame. ⌥⇧A removes it. By the
      // character typed (AZERTY puts A elsewhere); with ⌥ by the key's place, as ⌥ changes e.key on macOS ("Å").
      if (!mod && e.shiftKey && (k === "a" || (e.altKey && e.code === "KeyA"))) {
        e.preventDefault();
        if (noEdits || !sel.length) return;
        if (e.altKey) removeAutoLayout(doc, sel);
        else setSelection(autoLayoutSelection(doc, sel));
        return;
      }
      if (mod || e.altKey) return;
      if (e.shiftKey && e.code === "Digit1") {
        e.preventDefault();
        canvas.current?.fit();
        return;
      }
      if (e.shiftKey && e.code === "Digit2") {
        e.preventDefault();
        canvas.current?.zoomToSelection();
        return;
      }
      if (e.shiftKey && e.code === "Digit0") {
        e.preventDefault();
        canvas.current?.zoomTo(1);
        return;
      }
      if (e.key === "Escape") {
        if (keys.current.tool !== "move") setTool("move");
        else {
          // Escape selects the parent (inside a group or frame), as in Figma; at the top it clears the selection.
          const parents = [...new Set(sel.map((id) => doc.get(id)?.parentId))].filter((p): p is NodeId => !!p && doc.get(p)?.type !== "PAGE");
          setSelection(parents);
        }
        return;
      }
      // Enter on a selected text layer edits it, all its text selected (interactions.md §6).
      if (e.key === "Enter" && !e.shiftKey && sel.length === 1 && doc.get(sel[0] as NodeId)?.type === "TEXT") {
        e.preventDefault();
        if (!noEdits) canvas.current?.editText(sel[0] as NodeId);
        return;
      }
      // Enter selects the children of the selected groups and frames; Shift+Enter their parents.
      if (e.key === "Enter" && sel.length && !e.defaultPrevented) {
        e.preventDefault();
        if (e.shiftKey) {
          const parents = [...new Set(sel.map((id) => doc.get(id)?.parentId))].filter((p): p is NodeId => !!p && doc.get(p)?.type !== "PAGE");
          if (parents.length) setSelection(parents);
        } else {
          const kids = sel.flatMap((id) => doc.children(id).filter((k) => k.visible && !k.locked).map((k) => k.id));
          if (kids.length) setSelection(kids);
        }
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && sel.length) {
        e.preventDefault();
        if (noEdits) return;
        doc.transact(sel.length === 1 ? "Delete layer" : `Delete ${sel.length} layers`, (tx) => deleteLayers(tx, doc, sel));
        setSelection([]);
        return;
      }
      const nudge = nudgeFor(e.key, e.shiftKey);
      if (nudge && sel.length) {
        // Arrow keys nudge 1 px, Shift+arrow 10 px. Each press is one undo step; locked layers stay put.
        e.preventDefault();
        if (noEdits) return;
        // Layers in an auto layout flow reorder one step instead (an arrow across the flow does nothing).
        const flow = sharedFlowParent(doc, movable(doc, sel));
        if (flow) {
          const ids = movable(doc, sel);
          doc.transact(ids.length === 1 ? "Reorder layer" : `Reorder ${ids.length} layers`, (tx) => reorderStep(tx, doc, flow, ids, e.key));
          return;
        }
        const starts = snapshot(doc, freeLayers(doc, movable(doc, sel)));
        if (starts.length) doc.transact(starts.length === 1 ? "Move layer" : `Move ${starts.length} layers`, (tx) => moveBy(tx, starts, nudge.x, nudge.y));
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
  }, [doc, reportEditError]);

  // Images dropped on the canvas or pasted (⌘V): placed as image-filled rectangles. A refused file says why.
  const imageDrop = useImageImport({ doc, pageId, canvas, locked, onSelect: setSelection, onError: setEditError });

  // Layers and pages: clipboard, group, order, hide/lock, context menus; each page keeps its own camera and selection.
  const layerCommands = useLayerCommands({ doc, pageId, selection, setSelection, locked, canvas, onError: reportEditError });
  const switchPage = usePageMemory({ doc, pageId, selection, setPageId, setSelection, canvas });
  const onCanvasMenu = (e: { preventDefault(): void; clientX: number; clientY: number }) => {
    e.preventDefault();
    if (doc.live) return;
    const w = canvas.current?.toWorld(e.clientX, e.clientY);
    const hit = w ? hitTest(w.x, w.y, { deep: false }) : null;
    // Right-click on a layer that isn't selected selects it first; on empty canvas it clears the selection.
    if (hit && !selection.includes(hit)) setSelection([hit]);
    else if (!hit) setSelection([]);
    layerCommands.openMenu(e.clientX, e.clientY, "canvas");
  };
  /** Double-click inside the selected group or frame selects its layer under the pointer (entering it). */
  const enterAt = (x: number, y: number) => {
    const deep = hitTestPage(doc, pageId, x, y, { deep: true, tolerance: HIT_TOLERANCE_PX / zoom });
    if (!deep) return;
    const chain: NodeId[] = [];
    for (let id: NodeId | null | undefined = deep; id && id !== pageId; id = doc.get(id)?.parentId) chain.unshift(id);
    const at = selection.length === 1 ? chain.indexOf(selection[0] as NodeId) : -1;
    const next = at >= 0 ? chain[at + 1] : undefined;
    if (next) {
      if (doc.get(next)?.type === "TEXT" && !locked) canvas.current?.editText(next);
      setSelection([next]);
    }
  };

  const status = viewOnly
    ? { text: session.compare ? "Disk version · read-only" : "Read-only", tone: "quiet" as const, state: "read-only", message: undefined }
    : save;

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
          onPage={switchPage}
          onSelect={setSelection}
          readOnly={locked}
          onError={reportEditError}
          onLayerMenu={(x, y) => layerCommands.openMenu(x, y, "layers")}
        />

        <main className="canvas-area" aria-label="Canvas area" {...imageDrop} onContextMenu={onCanvasMenu}>
          <Canvas
            doc={doc}
            pageId={pageId}
            tool={tool}
            selection={selection}
            hitTest={hitTest}
            readOnly={locked}
            onSelect={setSelection}
            onCreated={(id) => {
              setSelection([id]);
              setTool("move");
            }}
            onZoom={setZoom}
            onDoubleClickLayer={enterAt}
            handle={canvas}
          />

          <div className="banners">
            {session.compare && (
              <div className="banner banner-info" role="status">
                <Icon name="lock" />
                <span className="banner-text">
                  <strong>The version on disk — read-only.</strong> Opened by Compare… so you can check it against your edits in the other tab. Nothing here is saved.
                </span>
              </div>
            )}
            {viewOnly && !session.compare && (
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
            {editError && (
              <div className="banner banner-error" role="alert">
                <Icon name="triangle-alert" />
                <span className="banner-text">{editError}</span>
                <button type="button" className="btn btn-secondary" onClick={() => setEditError(null)}>
                  OK
                </button>
              </div>
            )}
            {opened && (
              <div className="banner banner-warning open-warnings" role="status">
                <Icon name="triangle-alert" />
                <div className="banner-text">
                  <strong>{opened.title}</strong>
                  <ul className="banner-list">
                    {opened.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                    {opened.more > 0 && <li>…and {opened.more.toLocaleString("en-US")} more.</li>}
                  </ul>
                </div>
                <button type="button" className="btn btn-secondary" onClick={() => setOpened(null)}>
                  OK
                </button>
              </div>
            )}
            {notice && (
              <div className="banner banner-info" role="status">
                <Icon name="history" />
                <span className="banner-text">{notice}</span>
                {session.skipped?.length ? (
                  <button type="button" className="btn btn-secondary" onClick={() => exportSkippedEdits(session)}>
                    Export skipped edits…
                  </button>
                ) : null}
                <button type="button" className="btn btn-secondary" onClick={() => setNotice(null)}>
                  OK
                </button>
              </div>
            )}
            {reloaded && !viewOnly && (
              <div className={`banner ${reloaded.error ? "banner-error" : "banner-info"}`} role="status">
                <Icon name={reloaded.error ? "triangle-alert" : "refresh-cw"} />
                <span className="banner-text">{reloaded.error ?? <strong>Updated from disk</strong>}</span>
                <span aria-hidden="true">·</span>
                <button type="button" className="btn btn-secondary" onClick={undoReloadFromDisk} disabled={reloaded.busy}>
                  Undo
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setReloaded(null)}>
                  OK
                </button>
              </div>
            )}
            {save.state === "changed-on-disk" && !viewOnly && (
              <div className="banner banner-warning" role="alert">
                <Icon name="triangle-alert" />
                {conflict.copiedTo ? (
                  <span className="banner-text">
                    <strong>Your version is saved as {conflict.copiedTo}.</strong> Replace the version on disk with yours and keep saving here? The version on disk will
                    be overwritten; use Compare… first if you need anything from it.
                  </span>
                ) : (
                  <span className="banner-text">
                    <strong>Changed on disk.</strong> “{backend.kind === "folder" ? backend.label : doc.name}” was changed outside this tab (another app, browser or computer) while you had unsaved edits, so
                    Illigma stopped saving. Your edits are safe in this tab and in the recovery journal.
                  </span>
                )}
                <button type="button" className="btn btn-secondary" onClick={compare} disabled={conflict.busy}>
                  Compare…
                </button>
                {conflict.copiedTo ? (
                  <>
                    <button type="button" className="btn btn-primary" onClick={replaceDisk} disabled={conflict.busy}>
                      Replace disk version
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setConflict({ busy: false, copiedTo: null, error: null })} disabled={conflict.busy}>
                      Not now
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={keepMine} disabled={conflict.busy}>
                    Keep mine
                  </button>
                )}
              </div>
            )}
            {conflict.error && (
              <div className="banner banner-error" role="alert">
                <Icon name="triangle-alert" />
                <span className="banner-text">{conflict.error}</span>
              </div>
            )}
            {leaving && (
              <div className="banner banner-error" role="alertdialog" aria-label="Unsaved edits">
                <Icon name="triangle-alert" />
                <span className="banner-text">
                  <strong>Your latest edits aren't saved to {backend.label}.</strong>{" "}
                  {leaving.journalOk
                    ? "They are kept in the recovery journal and offered again when you open this file."
                    : "The recovery journal couldn't be written either, so leaving now loses them."}
                </span>
                <button type="button" className="btn btn-secondary" onClick={saveCopy} disabled={copy.busy}>
                  Save a copy elsewhere…
                </button>
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  {leaving.journalOk ? "Leave anyway (edits stay recoverable)" : "Leave anyway (edits will be lost)"}
                </button>
                <button type="button" className="btn btn-primary" onClick={() => setLeaving(null)}>
                  Stay
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

          {/* Selection changes, for screen readers: "Rectangle 3 selected", "3 layers selected". */}
          <div className="sr-only selection-announcer" role="status" aria-live="polite">
            {selection.length === 0 ? "" : selection.length === 1 ? `${doc.get(selection[0] as NodeId)?.name ?? "Layer"} selected` : `${selection.length} layers selected`}
          </div>
        </main>

        <PropertiesPanel doc={doc} pageId={pageId} selection={selection} readOnly={locked} onSelect={setSelection} onError={reportEditError} />
      </div>
      <ExportHost doc={doc} pageId={pageId} />
      {layerCommands.menu}
    </div>
  );
}
