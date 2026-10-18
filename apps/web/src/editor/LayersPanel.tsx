import type { Document, ReadonlyNode } from "@illigma/core";
import type { Node, NodeId } from "@illigma/format";
import { Icon, type IconName } from "../ui/Icon";

interface LayersPanelProps {
  doc: Document;
  pageId: NodeId;
  selection: readonly NodeId[];
  onPage(id: NodeId): void;
  /** `toggle`: Shift- or ⌘-click adds the layer to the selection, or removes it. */
  onSelect(id: NodeId, toggle: boolean): void;
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

  const rows: { node: ReadonlyNode; depth: number }[] = [];
  const walk = (parent: NodeId, depth: number) => {
    // Top of the list = front-most, as in Figma.
    for (const n of [...doc.children(parent)].reverse()) {
      rows.push({ node: n, depth });
      walk(n.id, depth + 1);
    }
  };
  walk(pageId, 0);

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
                  onClick={(e) => onSelect(node.id, e.shiftKey || e.metaKey || e.ctrlKey)}
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
