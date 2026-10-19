import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import type { Document } from "@illigma/core";
import type { NodeId } from "@illigma/format";
import { Icon } from "../ui/Icon";
import { ContextMenu } from "./ContextMenu";
import { duplicatePage, movePage, nextPageName, renameNode } from "./layer-ops";

type PageAction = "rename" | "duplicate" | "delete";

/**
 * The Pages list above Layers, as in Figma: switch (click, Enter), add (+),
 * rename (double-click, Enter on the current page, F2), duplicate, delete
 * (asks first; never the last page), reorder (drag, or ⌥↑ ⌥↓). Right-click or
 * Shift+F10 opens the page menu.
 */
export function PagesPanel({
  doc,
  pageId,
  readOnly,
  onPage,
  onError,
}: {
  doc: Document;
  pageId: NodeId;
  readOnly: boolean;
  onPage(id: NodeId): void;
  onError(e: unknown): void;
}) {
  const pages = doc.pages();
  const [renaming, setRenaming] = useState<NodeId | null>(null);
  const [menu, setMenu] = useState<{ id: NodeId; x: number; y: number } | null>(null);
  const [confirm, setConfirm] = useState<NodeId | null>(null);
  const [drop, setDrop] = useState<{ id: NodeId; after: boolean } | null>(null);
  const dragging = useRef<NodeId | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const focusAfter = useRef<NodeId | null>(null);

  useEffect(() => {
    const id = focusAfter.current;
    if (!id) return;
    focusAfter.current = null;
    list.current?.querySelector<HTMLElement>(`[data-page-id="${id}"]`)?.focus();
  });

  const edit = (label: string, fn: Parameters<Document["transact"]>[1]) => {
    try {
      return doc.transact(label, fn);
    } catch (e) {
      onError(e);
      return undefined;
    }
  };

  const add = () => {
    if (readOnly) return;
    const id = edit("Add page", (tx) => tx.addPage(nextPageName(doc), { after: pageId }));
    if (typeof id === "string") {
      onPage(id);
      setRenaming(id);
    }
  };

  const act = (id: NodeId, a: PageAction) => {
    if (readOnly) return;
    if (a === "rename") setRenaming(id);
    else if (a === "duplicate") {
      const copy = edit("Duplicate page", (tx) => duplicatePage(tx, doc, id));
      if (typeof copy === "string") onPage(copy);
    } else if (a === "delete" && pages.length > 1) setConfirm(id);
  };

  const remove = (id: NodeId) => {
    setConfirm(null);
    const i = pages.findIndex((p) => p.id === id);
    const next = pages[i + 1]?.id ?? pages[i - 1]?.id;
    if (id === pageId && next) onPage(next);
    edit("Delete page", (tx) => tx.delete(id));
    if (next) focusAfter.current = next;
  };

  const reorder = (id: NodeId, to: number) => {
    if (readOnly) return;
    edit("Move page", (tx) => movePage(tx, doc, id, to));
    focusAfter.current = id;
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, id: NodeId, i: number) => {
    if (renaming) return;
    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      e.stopPropagation();
      reorder(id, i + (e.key === "ArrowUp" ? -1 : 1));
      return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      const j = Math.max(0, Math.min(pages.length - 1, i + (e.key === "ArrowUp" ? -1 : 1)));
      list.current?.querySelector<HTMLElement>(`[data-page-id="${pages[j]?.id}"]`)?.focus();
      return;
    }
    if (e.key === "F2" || (e.key === "Enter" && id === pageId)) {
      e.preventDefault();
      e.stopPropagation();
      act(id, "rename");
      return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && !e.repeat) {
      e.preventDefault();
      e.stopPropagation();
      act(id, "delete");
      return;
    }
    if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
      e.preventDefault();
      e.stopPropagation();
      const r = e.currentTarget.getBoundingClientRect();
      setMenu({ id, x: r.left + 24, y: r.bottom });
    }
  };

  const dropAt = (e: DragEvent, id: NodeId) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { id, after: e.clientY > r.top + r.height / 2 };
  };

  return (
    <section className="panel-section pages-section" aria-labelledby="pages-heading">
      <div className="section-head">
        <h2 id="pages-heading" className="section-heading">
          Pages
        </h2>
        <button type="button" className="icon-button" aria-label="Add page" title="Add page" onClick={add} disabled={readOnly}>
          <Icon name="plus" />
        </button>
      </div>
      <ul className="row-list page-list" ref={list}>
        {pages.map((p, i) => (
          <li
            key={p.id}
            className={drop?.id === p.id ? (drop.after ? "drop-after" : "drop-before") : undefined}
            onDragOver={(e) => {
              if (!dragging.current) return;
              e.preventDefault();
              setDrop(dropAt(e, p.id));
            }}
            onDragLeave={() => setDrop((d) => (d?.id === p.id ? null : d))}
            onDrop={(e) => {
              const from = dragging.current;
              if (!from) return;
              e.preventDefault();
              const d = dropAt(e, p.id);
              setDrop(null);
              const rest = pages.filter((x) => x.id !== from).map((x) => x.id);
              const at = rest.indexOf(p.id) + (d.after ? 1 : 0);
              reorder(from, at);
            }}
          >
            {renaming === p.id ? (
              <RenameField
                name={p.name}
                label="Page name"
                onDone={(name) => {
                  setRenaming(null);
                  if (name !== null && name !== p.name) edit("Rename page", (tx) => renameNode(tx, p.id, name));
                  focusAfter.current = p.id;
                }}
              />
            ) : (
              <button
                type="button"
                className="row page-row"
                data-page-id={p.id}
                aria-current={p.id === pageId ? "page" : undefined}
                draggable={!readOnly}
                onDragStart={(e) => {
                  dragging.current = p.id;
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/x-illigma-page", p.id);
                }}
                onDragEnd={() => {
                  dragging.current = null;
                  setDrop(null);
                }}
                onClick={() => onPage(p.id)}
                onDoubleClick={() => act(p.id, "rename")}
                onKeyDown={(e) => onKey(e, p.id, i)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ id: p.id, x: e.clientX, y: e.clientY });
                }}
              >
                <span className="row-icon">
                  <Icon name={p.id === pageId ? "check" : "file"} />
                </span>
                <span className="row-label">{p.name}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          label="Page actions"
          entries={[
            { value: "rename" as const, label: "Rename", disabled: readOnly },
            { value: "duplicate" as const, label: "Duplicate page", disabled: readOnly },
            { value: "delete" as const, label: "Delete page", disabled: readOnly || pages.length < 2 },
          ]}
          onSelect={(a) => act(menu.id, a)}
          onClose={() => setMenu(null)}
        />
      )}
      {confirm && (
        <ConfirmDelete
          name={doc.get(confirm)?.name ?? "Page"}
          count={doc.subtree(confirm).length - 1}
          onCancel={() => {
            focusAfter.current = confirm;
            setConfirm(null);
          }}
          onConfirm={() => remove(confirm)}
        />
      )}
    </section>
  );
}

/** Inline rename: Enter or leaving the field keeps the name, Escape puts the old one back. */
export function RenameField({ name, label, onDone }: { name: string; label: string; onDone(name: string | null): void }) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (v: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(v);
  };
  return (
    <input
      ref={ref}
      className="rename-field"
      aria-label={label}
      defaultValue={name}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") finish(e.currentTarget.value);
        else if (e.key === "Escape") finish(null);
      }}
      onBlur={(e) => finish(e.currentTarget.value)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    />
  );
}

function ConfirmDelete({ name, count, onCancel, onConfirm }: { name: string; count: number; onCancel(): void; onConfirm(): void }) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => cancel.current?.focus(), []);
  return (
    <div className="confirm-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-page-title"
        aria-describedby="confirm-page-text"
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") onCancel();
        }}
      >
        <h2 id="confirm-page-title" className="confirm-title">
          Delete “{name}”?
        </h2>
        <p id="confirm-page-text" className="muted">
          {count === 0 ? "The page is empty." : `Its ${count} ${count === 1 ? "layer goes" : "layers go"} with it.`} You can undo this with ⌘Z.
        </p>
        <div className="confirm-actions">
          <button ref={cancel} type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm}>
            Delete page
          </button>
        </div>
      </div>
    </div>
  );
}
