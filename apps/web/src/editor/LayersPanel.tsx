import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type FocusEvent, type KeyboardEvent, type MouseEvent, type ReactElement } from "react";
import type { Document, Operation } from "@illigma/core";
import type { Node, NodeId } from "@illigma/format";
import { Icon, type IconName } from "../ui/Icon";
import { layerRange } from "./edit";

interface LayersPanelProps {
  doc: Document;
  pageId: NodeId;
  selection: readonly NodeId[];
  onPage(id: NodeId): void;
  /** The new selection after a click on a layer row. */
  onSelect(ids: NodeId[]): void;
}

const TYPE_ICON: Partial<Record<Node["type"], IconName>> = {
  FRAME: "frame",
  SECTION: "frame",
  COMPONENT: "frame",
  INSTANCE: "frame",
  RECTANGLE: "square",
  ELLIPSE: "circle",
  STAR: "star",
  POLYGON: "hexagon",
  VECTOR: "spline",
  LINE: "minus",
  TEXT: "type",
};

const typeClass = (t: Node["type"]) =>
  t === "TEXT" ? "type-text" : t === "FRAME" || t === "SECTION" || t === "COMPONENT" || t === "INSTANCE" ? "type-frame" : "type-shape";

/** One row of the layer tree, in list order (top = front-most, as in Figma). */
export interface LayerRowData {
  id: NodeId;
  name: string;
  type: Node["type"];
  /** 0 for the page's own layers. */
  depth: number;
  /** Its position among its siblings (1-based) and how many siblings there are, for aria-posinset and aria-setsize. */
  posinset: number;
  setsize: number;
  hasChildren: boolean;
  /** Index of its parent's row, or -1 for a top-level layer. */
  parent: number;
}

/** The rows of `pageId`'s layer tree, front-most first, children under their parent. */
export function layerRows(doc: Document, pageId: NodeId): LayerRowData[] {
  const rows: LayerRowData[] = [];
  const walk = (parentId: NodeId, depth: number, parent: number) => {
    const kids = doc.children(parentId);
    for (let i = kids.length - 1; i >= 0; i--) {
      const n = kids[i]!;
      const at = rows.length;
      rows.push({ id: n.id, name: n.name, type: n.type, depth, posinset: kids.length - i, setsize: kids.length, hasChildren: doc.children(n.id).length > 0, parent });
      walk(n.id, depth + 1, at);
    }
  };
  walk(pageId, 0, -1);
  return rows;
}

/** Node fields the rows show or are built from. Edits to anything else (a drag's x and y) leave the rows as they are. */
const ROW_KEYS: ReadonlySet<string> = new Set(["name", "parentId", "index"]);
/** Whether operation `o` can change the layer rows (a create, delete, move, reorder or rename). */
export const touchesRows = (o: Operation) => o.op !== "set" || ROW_KEYS.has(o.key);

/** The page's layer rows, rebuilt only when an edit changes the tree or a name. */
function useLayerRows(doc: Document, pageId: NodeId): LayerRowData[] {
  const version = useRef(0);
  const subscribe = useCallback(
    (notify: () => void) =>
      doc.subscribe((change) => {
        // A drag step ("live") is skipped without reading its operations (each read copies them): drags
        // move and resize. A drag that reorders (a drop in auto layout) is committed at once, and the
        // commit arrives as an "edit"; a cancelled one puts back the tree these rows were built from.
        if (change.origin === "live" || !change.ops.some(touchesRows)) return;
        version.current++;
        notify();
      }),
    [doc],
  );
  const snapshot = () => version.current;
  const v = useSyncExternalStore(subscribe, snapshot, snapshot);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => layerRows(doc, pageId), [doc, pageId, v]);
}

/** Whether two selections hold the same layers (in any order). */
function sameIds(a: readonly NodeId[], b: readonly NodeId[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((id) => s.has(id));
}

/** Rows drawn above and below the visible ones, so short lists render whole and scrolling shows no gaps. */
const OVERSCAN = 24;
const ROW_FALLBACK = 32;

interface RowProps {
  row: LayerRowData;
  index: number;
  selected: boolean;
  /** The row that takes Tab focus (roving tabindex). */
  tabbable: boolean;
  height: number;
  onRowClick(e: MouseEvent, index: number): void;
}

/** One layer row. Memoised: a drag step that moves layers changes none of its props, so no row re-renders. */
const LayerRow = memo(function LayerRow({ row, index, selected, tabbable, height, onRowClick }: RowProps) {
  return (
    <div
      role="treeitem"
      className="row layer-row"
      id={`layer-row-${row.id}`}
      data-id={row.id}
      tabIndex={tabbable ? 0 : -1}
      aria-selected={selected}
      aria-level={row.depth + 1}
      aria-setsize={row.setsize}
      aria-posinset={row.posinset}
      // No aria-expanded: rows can't collapse yet, and an always-"true" state would promise a toggle that isn't there.
      aria-label={`${row.name}, ${row.type.toLowerCase()}`}
      style={{ position: "absolute", top: index * height, left: 0, paddingLeft: 8 + row.depth * 16 }}
      onClick={(e) => onRowClick(e, index)}
    >
      <span className={`row-icon ${typeClass(row.type)}`}>
        <Icon name={TYPE_ICON[row.type] ?? "square"} />
      </span>
      <span className="row-label">{row.name}</span>
    </div>
  );
});

export function LayersPanel({ doc, pageId, selection, onPage, onSelect }: LayersPanelProps) {
  const pages = doc.pages();
  const rows = useLayerRows(doc, pageId);
  const selected = useMemo(() => new Set(selection), [selection]);
  /** Where a Shift-click or Shift+arrow range starts: the row last clicked or moved to without Shift. */
  const anchor = useRef<NodeId | null>(null);
  /** The row with keyboard focus (roving tabindex); falls back to the last selected row, then the first. */
  const [focusId, setFocusId] = useState<NodeId | null>(null);
  const scroller = useRef<HTMLElement>(null);
  const tree = useRef<HTMLDivElement>(null);
  const [rowHeight, setRowHeight] = useState(ROW_FALLBACK);
  const [view, setView] = useState({ top: 0, height: 900 });
  /** A row to move DOM focus to once it is rendered (it may not be yet), or null. */
  const wantFocus = useRef<NodeId | null>(null);

  const indexOf = useMemo(() => {
    const m = new Map<NodeId, number>();
    rows.forEach((r, i) => m.set(r.id, i));
    return m;
  }, [rows]);

  // Latest values for the stable handlers below, so memoised rows never see a new function.
  const latest = useRef({ rows, selection, onSelect, indexOf });
  latest.current = { rows, selection, onSelect, indexOf };

  /** The visible slice of the list, in the scroller's coordinates relative to the tree. */
  const measure = useCallback(() => {
    const s = scroller.current;
    const t = tree.current;
    if (!s || !t) return;
    // offsetTop is relative to the scroller (it is positioned) and ignores its scrolling.
    const top = s.scrollTop - t.offsetTop;
    setView((v) => (v.top === top && v.height === s.clientHeight ? v : { top, height: s.clientHeight }));
  }, []);

  useLayoutEffect(() => {
    const t = tree.current;
    if (t) {
      const h = parseFloat(getComputedStyle(t).getPropertyValue("--size-row"));
      if (h > 0) setRowHeight(h);
    }
    measure();
    const s = scroller.current;
    if (!s || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(s);
    return () => ro.disconnect();
  }, [measure, rows.length > 0]);

  /** Scroll the list so row `i` is in view (the least scrolling that does it). */
  const reveal = useCallback(
    (i: number) => {
      const s = scroller.current;
      const t = tree.current;
      if (!s || !t || i < 0) return;
      // offsetTop is relative to the scroller (it is positioned) and ignores its scrolling.
      const top = i === 0 ? 0 : t.offsetTop + i * rowHeight;
      const bottom = t.offsetTop + (i + 1) * rowHeight;
      if (top < s.scrollTop) s.scrollTop = top;
      else if (bottom > s.scrollTop + s.clientHeight) s.scrollTop = bottom - s.clientHeight;
      measure();
    },
    [rowHeight, measure],
  );

  /**
   * The selection this list last asked for (a click or a key in the list), until the selection effect sees it.
   * A selection made here keeps the row the user is on in view; only one made elsewhere scrolls to the selection.
   */
  const fromList = useRef<readonly NodeId[] | null>(null);

  const lastSelected = selection[selection.length - 1];
  const focusRow = focusId !== null && indexOf.has(focusId) ? focusId : lastSelected !== undefined && indexOf.has(lastSelected) ? lastSelected : rows[0]?.id;

  useEffect(() => {
    const asked = fromList.current;
    fromList.current = null;
    if (asked !== null && sameIds(asked, selection)) {
      // Made in the list: the row the user clicked or moved to stays in view. Not the selection's last row: a
      // range is in list order, so after Shift+↑ or Shift+Home that is the anchor, which may be far away.
      const i = focusRow === undefined ? -1 : (indexOf.get(focusRow) ?? -1);
      if (i >= 0) reveal(i);
      return;
    }
    // Made elsewhere (canvas, undo, ⌘D): its row scrolls into view, as in Figma. Unless the list has focus or is
    // about to take it back, Tab into the list lands on the new selection.
    if (wantFocus.current === null && !tree.current?.contains(document.activeElement)) setFocusId(null);
    if (lastSelected === undefined) return;
    const i = indexOf.get(lastSelected);
    if (i !== undefined) reveal(i);
    // Only when the selection changes, not on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  /** The row that had DOM focus while the list had it; kept when that row is removed (a Delete), so focus can move on. */
  const hadFocus = useRef<NodeId | null>(null);
  const prevRows = useRef(rows);
  useLayoutEffect(() => {
    const before = prevRows.current;
    prevRows.current = rows;
    const gone = hadFocus.current;
    if (before === rows || gone === null || indexOf.has(gone)) return;
    hadFocus.current = null;
    const active = document.activeElement;
    if (active !== null && active !== document.body) return;
    // The focused row was deleted and focus fell to <body>: move it to the next row that is left, else the previous.
    const at = before.findIndex((r) => r.id === gone);
    let next: NodeId | undefined;
    for (let i = at + 1; at >= 0 && i < before.length && next === undefined; i++) if (indexOf.has(before[i]!.id)) next = before[i]!.id;
    for (let i = at - 1; i >= 0 && next === undefined; i--) if (indexOf.has(before[i]!.id)) next = before[i]!.id;
    if (next === undefined) return;
    wantFocus.current = next;
    setFocusId(next);
    reveal(indexOf.get(next)!);
  }, [rows, indexOf, reveal]);

  const onTreeFocus = useCallback((e: FocusEvent<HTMLDivElement>) => {
    hadFocus.current = (e.target as HTMLElement).dataset["id"] ?? null;
  }, []);
  const onTreeBlur = useCallback((e: FocusEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    // Focus leaving for good (a click elsewhere, Tab) forgets the row; a row removed from the DOM keeps it.
    queueMicrotask(() => {
      if (t.isConnected && hadFocus.current === (t.dataset["id"] ?? null) && !tree.current?.contains(document.activeElement)) hadFocus.current = null;
    });
  }, []);

  useEffect(() => {
    // The row named when focus was asked for, not this render's focus row: a render that hasn't seen the
    // new focus row yet (focus moving on from a deleted row) would send focus elsewhere.
    const id = wantFocus.current;
    if (id === null) return;
    const el = document.getElementById(`layer-row-${id}`);
    if (!el) {
      if (!indexOf.has(id)) wantFocus.current = null; // gone: nothing to wait for
      return;
    }
    wantFocus.current = null;
    el.focus({ preventScroll: true });
  });

  // As in Figma: a click selects the layer, ⌘/Ctrl-click adds or removes it, Shift-click selects the range from the last click.
  const choose = useCallback((index: number, mods: { shift: boolean; toggle: boolean }) => {
    const { rows, selection, onSelect } = latest.current;
    const id = rows[index]?.id;
    if (id === undefined) return;
    setFocusId(id);
    const ask = (ids: NodeId[]) => {
      fromList.current = ids;
      onSelect(ids);
    };
    if (mods.shift) {
      const order = rows.map((r) => r.id);
      const from = anchor.current !== null && order.includes(anchor.current) ? anchor.current : (selection[selection.length - 1] ?? null);
      ask(layerRange(order, from, id));
      return;
    }
    anchor.current = id;
    if (mods.toggle) ask(selection.includes(id) ? selection.filter((x) => x !== id) : [...selection, id]);
    else ask([id]);
  }, []);

  const onRowClick = useCallback(
    (e: MouseEvent, index: number) => {
      // The click focused its row: an earlier request to focus another one is over.
      wantFocus.current = null;
      choose(index, { shift: e.shiftKey, toggle: e.metaKey || e.ctrlKey });
    },
    [choose],
  );

  /** Tree keyboard navigation (WAI-ARIA tree view): selection follows focus, Shift extends the range, ⌘/Ctrl moves focus only. */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const from = focusRow === undefined ? -1 : (indexOf.get(focusRow) ?? -1);
    const page = Math.max(1, Math.floor(view.height / rowHeight) - 1);
    let to: number | null = null;
    switch (e.key) {
      case "ArrowDown":
        to = from + 1;
        break;
      case "ArrowUp":
        to = from - 1;
        break;
      case "Home":
        to = 0;
        break;
      case "End":
        to = rows.length - 1;
        break;
      case "PageDown":
        to = from + page;
        break;
      case "PageUp":
        to = from - page;
        break;
      case "ArrowLeft":
        to = rows[from]?.parent ?? -1;
        if (to < 0) to = null;
        break;
      case "ArrowRight":
        to = rows[from]?.hasChildren ? from + 1 : null;
        break;
      case "Enter":
      case " ":
        // Space and Enter select the focused row, as clicking it does (Space still pans over the canvas: it isn't stopped here).
        if (from >= 0 && !e.repeat) choose(from, { shift: e.shiftKey, toggle: e.metaKey || e.ctrlKey });
        if (e.key === "Enter") e.preventDefault();
        return;
      default:
        return;
    }
    // Arrows here move in the list: they must not reach the editor's nudge shortcut.
    e.preventDefault();
    e.stopPropagation();
    if (to === null || !rows.length) return;
    const i = Math.min(rows.length - 1, Math.max(0, to));
    const id = rows[i]!.id;
    wantFocus.current = id;
    setFocusId(id);
    reveal(i);
    if (e.metaKey || e.ctrlKey) return;
    if (e.shiftKey) choose(i, { shift: true, toggle: false });
    else choose(i, { shift: false, toggle: false });
  };

  const first = Math.max(0, Math.floor(view.top / rowHeight) - OVERSCAN);
  const last = Math.min(rows.length, Math.ceil((view.top + view.height) / rowHeight) + OVERSCAN);
  const item = (i: number) => {
    const row = rows[i]!;
    return <LayerRow key={row.id} row={row} index={i} selected={selected.has(row.id)} tabbable={row.id === focusRow} height={rowHeight} onRowClick={onRowClick} />;
  };
  const visible: ReactElement[] = [];
  // The focus row is always in the DOM, so Tab can reach the list wherever it is scrolled.
  const focusIndex = focusRow === undefined ? -1 : (indexOf.get(focusRow) ?? -1);
  if (focusIndex >= 0 && focusIndex < first) visible.push(item(focusIndex));
  for (let i = first; i < last; i++) visible.push(item(i));
  if (focusIndex >= last) visible.push(item(focusIndex));

  return (
    <aside className="panel panel-left" aria-label="Layers">
      <section className="panel-section" aria-labelledby="pages-heading">
        <h2 id="pages-heading" className="section-heading">
          Pages
        </h2>
        <ul className="row-list">
          {pages.map((p) => (
            <li key={p.id}>
              <button type="button" className="row" aria-current={p.id === pageId ? "page" : undefined} onClick={() => onPage(p.id)}>
                <span className="row-icon">
                  <Icon name={p.id === pageId ? "check" : "file"} />
                </span>
                <span className="row-label">{p.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section ref={scroller} className="panel-section panel-grow" aria-labelledby="layers-heading" style={{ position: "relative" }} onScroll={measure}>
        <h2 id="layers-heading" className="section-heading">
          Layers
        </h2>
        {rows.length === 0 ? (
          <p className="muted panel-empty">No layers on this page yet. Pick Frame (F) and drag on the canvas.</p>
        ) : (
          // Only the rows in view (plus a margin) are in the DOM: a page can hold tens of thousands of layers.
          <div
            ref={tree}
            role="tree"
            aria-label="Layers on this page"
            aria-multiselectable="true"
            className="row-list layer-list"
            data-rows={rows.length}
            style={{ position: "relative", height: rows.length * rowHeight, flex: "none" }}
            onKeyDown={onKeyDown}
            onFocus={onTreeFocus}
            onBlur={onTreeBlur}
          >
            {visible}
          </div>
        )}
      </section>
    </aside>
  );
}
