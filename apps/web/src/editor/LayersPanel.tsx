import { useRef, type MouseEvent } from "react";
import type { Document, ReadonlyNode } from "@illigma/core";
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
  TEXT: "type",
};

const typeClass = (t: Node["type"]) =>
  t === "TEXT" ? "type-text" : t === "FRAME" || t === "SECTION" || t === "COMPONENT" || t === "INSTANCE" ? "type-frame" : "type-shape";

export function LayersPanel({ doc, pageId, selection, onPage, onSelect }: LayersPanelProps) {
  const pages = doc.pages();
  /** Where a Shift-click range starts: the row last clicked without Shift. */
  const anchor = useRef<NodeId | null>(null);

  const rows: { node: ReadonlyNode; depth: number }[] = [];
  const walk = (parent: NodeId, depth: number) => {
    // Top of the list = front-most, as in Figma.
    for (const n of [...doc.children(parent)].reverse()) {
      rows.push({ node: n, depth });
      walk(n.id, depth + 1);
    }
  };
  walk(pageId, 0);

  // As in Figma: a click selects the layer, ⌘/Ctrl-click adds or removes it, Shift-click selects the range from the last click.
  const click = (e: MouseEvent, id: NodeId) => {
    if (e.shiftKey) {
      const order = rows.map((r) => r.node.id);
      const from = anchor.current !== null && order.includes(anchor.current) ? anchor.current : (selection[selection.length - 1] ?? null);
      onSelect(layerRange(order, from, id));
      return;
    }
    anchor.current = id;
    if (e.metaKey || e.ctrlKey) onSelect(selection.includes(id) ? selection.filter((x) => x !== id) : [...selection, id]);
    else onSelect([id]);
  };

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

      <section className="panel-section panel-grow" aria-labelledby="layers-heading">
        <h2 id="layers-heading" className="section-heading">
          Layers
        </h2>
        {rows.length === 0 ? (
          <p className="muted panel-empty">No layers on this page yet. Pick Frame (F) and drag on the canvas.</p>
        ) : (
          <ul className="row-list layer-list" aria-label="Layers on this page">
            {rows.map(({ node, depth }) => (
              <li key={node.id}>
                <button
                  type="button"
                  className="row layer-row"
                  aria-pressed={selection.includes(node.id)}
                  aria-label={`${node.name}, ${node.type.toLowerCase()}`}
                  style={{ paddingLeft: 8 + depth * 16 }}
                  onClick={(e) => click(e, node.id)}
                >
                  <span className={`row-icon ${typeClass(node.type)}`}>
                    <Icon name={TYPE_ICON[node.type] ?? "square"} />
                  </span>
                  <span className="row-label">{node.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
