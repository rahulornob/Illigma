import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type FocusEvent, type KeyboardEvent, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactElement } from "react";
import type { Document, Operation } from "@illigma/core";
import type { Node, NodeId } from "@illigma/format";
import { Icon, type IconName } from "../ui/Icon";
import { layerRange, topmost } from "./edit";
import { canDrop, moveLayers, renameNode, isContainer, type DropPlace } from "./layer-ops";
import { layoutTransact } from "./layout-props";
import { PagesPanel, RenameField } from "./PagesPanel";
import { RENAME_EVENT } from "./useLayerCommands";
import { AssetsPanel } from "./components/AssetsPanel";

interface LayersPanelProps {
  doc: Document;
  pageId: NodeId;
  selection: readonly NodeId[];
  onPage(id: NodeId): void;
  /** The new selection after a click on a layer row. */
  onSelect(ids: NodeId[]): void;
  /** No edits (view-only tab): rows still select, but don't rename, hide, lock or move. */
  readOnly?: boolean;
  onError?(e: unknown): void;
  /** Place an instance of a component (Assets tab: Enter or double-click). */
  onInsertComponent?(componentId: NodeId): void;
  /** Open the layer context menu at a point (right-click or Shift+F10 on a row). */
  onLayerMenu?(x: number, y: number): void;
}

const TYPE_ICON: Partial<Record<Node["type"], IconName>> = {
  FRAME: "frame",
  GROUP: "square-dashed",
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
  /** Its parent's id (the page for a top-level layer). */
  parentId: NodeId;
  visible: boolean;
  locked: boolean;
  /** Its children are hidden in the list. */
  collapsed: boolean;
}

/** The rows of `pageId`'s layer tree, front-most first, children under their parent (not under collapsed ones). */
export function layerRows(doc: Document, pageId: NodeId, collapsed: ReadonlySet<NodeId> = new Set()): LayerRowData[] {
  const rows: LayerRowData[] = [];
  const walk = (parentId: NodeId, depth: number, parent: number) => {
    const kids = doc.children(parentId);
    for (let i = kids.length - 1; i >= 0; i--) {
      const n = kids[i]!;
      const at = rows.length;
      const hasChildren = doc.children(n.id).length > 0;
      const closed = hasChildren && collapsed.has(n.id);
      rows.push({ id: n.id, name: n.name, type: n.type, depth, posinset: kids.length - i, setsize: kids.length, hasChildren, parent, parentId, visible: n.visible, locked: n.locked, collapsed: closed });
      if (!closed) walk(n.id, depth + 1, at);
    }
  };
  walk(pageId, 0, -1);
  return rows;
}

/** Node fields the rows show or are built from. Edits to anything else (a drag's x and y) leave the rows as they are. */
const ROW_KEYS: ReadonlySet<string> = new Set(["name", "parentId", "index", "visible", "locked"]);
/** Whether operation `o` can change the layer rows (a create, delete, move, reorder or rename). */
export const touchesRows = (o: Operation) => o.op !== "set" || ROW_KEYS.has(o.key);

/** The page's layer rows, rebuilt only when an edit changes the tree or a name. */
function useLayerRows(doc: Document, pageId: NodeId, collapsed: ReadonlySet<NodeId>): LayerRowData[] {
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
  return useMemo(() => layerRows(doc, pageId, collapsed), [doc, pageId, v, collapsed]);
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
  renaming: boolean;
  /** "into": a drop puts the dragged layers inside this row's layer. */
  dropInto: boolean;
  actions: RowActions;
}

/** Row handlers, one stable object, so memoised rows never see new functions. */
interface RowActions {
  click(e: MouseEvent, index: number): void;
  pointerDown(e: ReactPointerEvent, index: number): void;
  menu(e: MouseEvent, index: number): void;
  toggle(id: NodeId): void;
  visible(id: NodeId): void;
  locked(id: NodeId): void;
  rename(id: NodeId | null, name?: string | null): void;
}

/** One layer row. Memoised: a drag step that moves layers changes none of its props, so no row re-renders. */
const LayerRow = memo(function LayerRow({ row, index, selected, tabbable, height, renaming, dropInto, actions }: RowProps) {
  const cls = `row layer-row${row.visible ? "" : " is-hidden"}${row.locked ? " is-locked" : ""}${dropInto ? " drop-into" : ""}`;
  return (
    <div
      role="treeitem"
      className={cls}
      id={`layer-row-${row.id}`}
      data-id={row.id}
      tabIndex={tabbable ? 0 : -1}
      aria-selected={selected}
      aria-level={row.depth + 1}
      aria-setsize={row.setsize}
      aria-posinset={row.posinset}
      aria-expanded={row.hasChildren ? !row.collapsed : undefined}
      aria-label={`${row.name}, ${row.type.toLowerCase()}${row.visible ? "" : ", hidden"}${row.locked ? ", locked" : ""}`}
      style={{ position: "absolute", top: index * height, left: 0, paddingLeft: 8 + row.depth * 16 }}
      onClick={(e) => actions.click(e, index)}
      onPointerDown={(e) => actions.pointerDown(e, index)}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest(".row-toggle, .row-chevron")) return;
        actions.rename(row.id);
      }}
      onContextMenu={(e) => actions.menu(e, index)}
    >
      <span
        className="row-chevron"
        aria-hidden="true"
        onClick={(e) => {
          if (!row.hasChildren) return;
          e.stopPropagation();
          actions.toggle(row.id);
        }}
      >
        {row.hasChildren && <Icon name={row.collapsed ? "chevron-right" : "chevron-down"} size={12} />}
      </span>
      <span className={`row-icon ${typeClass(row.type)}`}>
        <Icon name={TYPE_ICON[row.type] ?? "square"} />
      </span>
      {renaming ? (
        <RenameField name={row.name} label="Layer name" onDone={(name) => actions.rename(null, name)} />
      ) : (
        <span className="row-label">{row.name}</span>
      )}
      <button
        type="button"
        className={`row-toggle${row.locked ? " is-on" : ""}`}
        tabIndex={-1}
        aria-label={`${row.locked ? "Unlock" : "Lock"} ${row.name}`}
        title={row.locked ? "Unlock  ⇧⌘L" : "Lock  ⇧⌘L"}
        onClick={(e) => {
          e.stopPropagation();
          actions.locked(row.id);
        }}
      >
        <Icon name={row.locked ? "lock" : "lock-open"} />
      </button>
      <button
        type="button"
        className={`row-toggle${row.visible ? "" : " is-on"}`}
        tabIndex={-1}
        aria-label={`${row.visible ? "Hide" : "Show"} ${row.name}`}
        title={row.visible ? "Hide  ⇧⌘H" : "Show  ⇧⌘H"}
        onClick={(e) => {
          e.stopPropagation();
          actions.visible(row.id);
        }}
      >
        <Icon name={row.visible ? "eye" : "eye-off"} />
      </button>
    </div>
  );
});

/** Where a pointer over the list would drop layers: the place in the document and the line or box to show. */
interface DropTarget {
  place: DropPlace;
  /** Row index the indicator line sits above (rows.length: below the last), or null for "into". */
  line: number | null;
  depth: number;
  into: NodeId | null;
}

/**
 * The drop at `y` (list pixels) for a Layers drag: the upper quarter of a row
 * puts the layers in front of it, the lower quarter behind it (or inside it,
 * at the front, when it is expanded with children), and the middle of a
 * container row puts them inside it, at the front. Below the last row: the
 * back of the page.
 */
export function dropTargetAt(rows: readonly LayerRowData[], doc: Document, pageId: NodeId, y: number, rowHeight: number): DropTarget {
  const i = Math.floor(y / rowHeight);
  if (i >= rows.length || !rows.length) return { place: { parentId: pageId, position: "first" }, line: rows.length, depth: 0, into: null };
  if (i < 0) {
    const first = rows[0]!;
    return { place: { parentId: first.parentId, position: { after: first.id } }, line: 0, depth: first.depth, into: null };
  }
  const row = rows[i]!;
  const frac = y / rowHeight - i;
  const container = isContainer(doc.get(row.id));
  const open = row.hasChildren && !row.collapsed;
  if (container && frac > 0.25 && frac < 0.75) return { place: { parentId: row.id, position: "last" }, line: null, depth: row.depth + 1, into: row.id };
  if (frac < 0.5) return { place: { parentId: row.parentId, position: { after: row.id } }, line: i, depth: row.depth, into: null };
  if (open) return { place: { parentId: row.id, position: "last" }, line: i + 1, depth: row.depth + 1, into: null };
  return { place: { parentId: row.parentId, position: { before: row.id } }, line: i + 1, depth: row.depth, into: null };
}

export function LayersPanel({ doc, pageId, selection, onPage, onSelect, readOnly = false, onError = () => {}, onLayerMenu, onInsertComponent }: LayersPanelProps) {
  const [leftTab, setLeftTab] = useState<"layers" | "assets">("layers");
  /** Collapsed layers, per page (the list starts expanded). */
  const [collapsedByPage, setCollapsedByPage] = useState<ReadonlyMap<NodeId, ReadonlySet<NodeId>>>(new Map());
  const collapsed = useMemo(() => collapsedByPage.get(pageId) ?? new Set<NodeId>(), [collapsedByPage, pageId]);
  const rows = useLayerRows(doc, pageId, collapsed);
  const [renaming, setRenaming] = useState<NodeId | null>(null);
  const [drop, setDrop] = useState<DropTarget | null>(null);
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
        // WAI-ARIA tree: an expanded row collapses; otherwise focus goes to the parent.
        if (rows[from]?.hasChildren && !rows[from]?.collapsed && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          setCollapsed(rows[from]!.id, true);
          return;
        }
        to = rows[from]?.parent ?? -1;
        if (to < 0) to = null;
        break;
      case "ArrowRight":
        if (rows[from]?.collapsed && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          setCollapsed(rows[from]!.id, false);
          return;
        }
        to = rows[from]?.hasChildren ? from + 1 : null;
        break;
      case "F2":
        e.preventDefault();
        e.stopPropagation();
        if (from >= 0) startRename(rows[from]!.id);
        return;
      case "ContextMenu":
      case "F10": {
        if (e.key === "F10" && !e.shiftKey) return;
        e.preventDefault();
        e.stopPropagation();
        const el = document.getElementById(`layer-row-${rows[from]?.id}`);
        const r = el?.getBoundingClientRect();
        if (r) onLayerMenu?.(r.left + 24, r.bottom);
        return;
      }
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

  function setCollapsed(id: NodeId, closed: boolean) {
    setCollapsedByPage((m) => {
      const cur = new Set(m.get(pageId) ?? []);
      if (closed) cur.add(id);
      else cur.delete(id);
      const next = new Map(m);
      next.set(pageId, cur);
      return next;
    });
  }

  /** Rename `id` inline: its ancestors expand so its row is there, and it scrolls into view. */
  function startRename(id: NodeId) {
    if (readOnly || !doc.has(id)) return;
    const closedAbove: NodeId[] = [];
    for (let p = doc.get(id)?.parentId; p && p !== pageId; p = doc.get(p)?.parentId) if (collapsed.has(p)) closedAbove.push(p);
    if (closedAbove.length)
      setCollapsedByPage((m) => {
        const cur = new Set(m.get(pageId) ?? []);
        for (const p of closedAbove) cur.delete(p);
        return new Map(m).set(pageId, cur);
      });
    setRenaming(id);
  }
  const startRenameRef = useRef(startRename);
  startRenameRef.current = startRename;

  useEffect(() => {
    const on = (e: Event) => startRenameRef.current((e as CustomEvent<NodeId>).detail);
    window.addEventListener(RENAME_EVENT, on);
    return () => window.removeEventListener(RENAME_EVENT, on);
  }, []);
  useEffect(() => {
    if (renaming === null) return;
    const i = indexOf.get(renaming);
    if (i !== undefined) reveal(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renaming]);

  const edit = (label: string, fn: Parameters<typeof layoutTransact>[2]) => {
    try {
      layoutTransact(doc, label, fn);
    } catch (err) {
      onError(err);
    }
  };

  /** A pointer drag on rows: moves the layers when it passes 4 px. */
  const drag = useRef<{ ids: NodeId[]; x: number; y: number; started: boolean; pointerId: number } | null>(null);
  /** The click that ends a drag must not select. */
  const swallowClick = useRef(false);
  const dropRef = useRef<DropTarget | null>(null);

  const listY = (clientY: number) => clientY - (tree.current?.getBoundingClientRect().top ?? 0);

  const live = useRef({ doc, pageId, rows, selection, readOnly, onSelect, onLayerMenu, edit, rowHeight, choose });
  live.current = { doc, pageId, rows, selection, readOnly, onSelect, onLayerMenu, edit, rowHeight, choose };

  const actions = useMemo<RowActions>(
    () => ({
      click: (e, index) => {
        if (swallowClick.current) {
          swallowClick.current = false;
          return;
        }
        onRowClick(e, index);
      },
      pointerDown: (e, index) => {
        const l = live.current;
        if (e.button !== 0 || l.readOnly || (e.target as HTMLElement).closest(".row-toggle, .rename-field, .row-chevron")) return;
        const id = l.rows[index]?.id;
        if (!id) return;
        const ids = l.selection.includes(id) ? topmost(l.doc, l.selection) : [id];
        drag.current = { ids, x: e.clientX, y: e.clientY, started: false, pointerId: e.pointerId };
        const move = (ev: PointerEvent) => {
          const d = drag.current;
          if (!d || ev.pointerId !== d.pointerId) return;
          if (!d.started && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < 4) return;
          d.started = true;
          const ll = live.current;
          const t = dropTargetAt(ll.rows, ll.doc, ll.pageId, listY(ev.clientY), ll.rowHeight);
          const ok = canDrop(ll.doc, d.ids, t.place);
          dropRef.current = ok ? t : null;
          setDrop(ok ? t : null);
        };
        const up = (ev: PointerEvent) => {
          const d = drag.current;
          if (!d || ev.pointerId !== d.pointerId) return;
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          window.removeEventListener("pointercancel", up);
          drag.current = null;
          const t = dropRef.current;
          dropRef.current = null;
          setDrop(null);
          if (!d.started) return;
          swallowClick.current = true;
          setTimeout(() => (swallowClick.current = false), 0);
          if (ev.type === "pointercancel" || !t) return;
          const ll = live.current;
          ll.edit(d.ids.length === 1 ? "Move layer" : `Move ${d.ids.length} layers`, (tx) => moveLayers(tx, ll.doc, d.ids, t.place));
          ll.onSelect(d.ids.filter((x) => ll.doc.has(x)));
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", up);
      },
      menu: (e, index) => {
        e.preventDefault();
        const l = live.current;
        const id = l.rows[index]?.id;
        if (!id) return;
        if (!l.selection.includes(id)) l.choose(index, { shift: false, toggle: false });
        l.onLayerMenu?.(e.clientX, e.clientY);
      },
      toggle: (id) => {
        const row = live.current.rows.find((r) => r.id === id);
        if (row) setCollapsed(id, !row.collapsed);
      },
      visible: (id) => {
        const l = live.current;
        if (l.readOnly) return;
        const n = l.doc.get(id);
        if (n) l.edit(n.visible ? "Hide layer" : "Show layer", (tx) => tx.set(id, "visible", !n.visible));
      },
      locked: (id) => {
        const l = live.current;
        if (l.readOnly) return;
        const n = l.doc.get(id);
        if (n) l.edit(n.locked ? "Unlock layer" : "Lock layer", (tx) => tx.set(id, "locked", !n.locked));
      },
      rename: (id, name) => {
        if (id !== null) {
          startRenameRef.current(id);
          return;
        }
        setRenaming((cur) => {
          const l = live.current;
          if (cur && name != null && name !== l.doc.get(cur)?.name) l.edit("Rename layer", (tx) => void renameNode(tx, cur, name));
          if (cur) {
            wantFocus.current = cur;
            setFocusId(cur);
          }
          return null;
        });
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onRowClick],
  );

  const first = Math.max(0, Math.floor(view.top / rowHeight) - OVERSCAN);
  const last = Math.min(rows.length, Math.ceil((view.top + view.height) / rowHeight) + OVERSCAN);
  const item = (i: number) => {
    const row = rows[i]!;
    return (
      <LayerRow
        key={row.id}
        row={row}
        index={i}
        selected={selected.has(row.id)}
        tabbable={row.id === focusRow}
        height={rowHeight}
        renaming={renaming === row.id}
        dropInto={drop?.into === row.id}
        actions={actions}
      />
    );
  };
  const visible: ReactElement[] = [];
  // The focus row is always in the DOM, so Tab can reach the list wherever it is scrolled.
  const focusIndex = focusRow === undefined ? -1 : (indexOf.get(focusRow) ?? -1);
  if (focusIndex >= 0 && focusIndex < first) visible.push(item(focusIndex));
  for (let i = first; i < last; i++) visible.push(item(i));
  if (focusIndex >= last) visible.push(item(focusIndex));

  return (
    <aside className="panel panel-left" aria-label="Layers">
      <PagesPanel doc={doc} pageId={pageId} readOnly={readOnly} onPage={onPage} onError={onError} />

      <div className="panel-tabbar" role="tablist" aria-label="Left panel">
        <button type="button" role="tab" aria-selected={leftTab === "layers"} onClick={() => setLeftTab("layers")}>
          Layers
        </button>
        <button type="button" role="tab" aria-selected={leftTab === "assets"} onClick={() => setLeftTab("assets")}>
          Assets
        </button>
      </div>
      {leftTab === "assets" ? (
        <AssetsPanel doc={doc} onInsert={(id) => onInsertComponent?.(id)} />
      ) : (
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
            {drop && drop.line !== null && <div className="layer-drop-line" aria-hidden="true" style={{ top: drop.line * rowHeight - 1, left: 8 + drop.depth * 16 }} />}
          </div>
        )}
      </section>
      )}
    </aside>
  );
}
