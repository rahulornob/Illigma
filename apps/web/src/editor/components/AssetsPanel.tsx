/**
 * Assets (a tab next to Layers): this file's components, grouped by page,
 * with search. Drag one onto the canvas to place an instance there, or press
 * Enter on it to place one in the middle of the view.
 */
import { useState } from "react";
import { listComponents, type Document } from "@illigma/core";
import type { NodeId } from "@illigma/format";
import { Icon } from "../../ui/Icon";
import { COMPONENT_DRAG_TYPE, pageOf } from "./commands";
import "./components.css";

export function AssetsPanel({ doc, onInsert }: { doc: Document; onInsert(componentId: NodeId): void }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const all = listComponents(doc).map((c) => {
    const parent = c.parentId ? doc.get(c.parentId) : undefined;
    const label = parent?.type === "COMPONENT_SET" ? `${parent.name} / ${c.name}` : c.name;
    return { id: c.id, label, page: doc.get(pageOf(doc, c.id) ?? "")?.name ?? "" };
  });
  const shown = q ? all.filter((c) => c.label.toLowerCase().includes(q)) : all;
  const pages = [...new Set(shown.map((c) => c.page))];
  return (
    <section className="panel-section panel-grow" aria-labelledby="assets-heading">
      <h2 id="assets-heading" className="section-heading">
        Local components
      </h2>
      <div className="field assets-search">
        <Icon name="search" size={12} />
        <input className="field-input" type="search" aria-label="Search assets" placeholder="Search assets" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {all.length === 0 ? (
        <p className="muted panel-empty">No components yet. Select layers and press ⌥⌘K to create one.</p>
      ) : shown.length === 0 ? (
        <p className="muted panel-empty">No components match “{query}”.</p>
      ) : (
        pages.map((page) => (
          <div key={page}>
            <div className="asset-group">{page}</div>
            <ul className="asset-list" aria-label={`Components on ${page}`}>
              {shown
                .filter((c) => c.page === page)
                .map((c) => (
                  <li
                    key={c.id}
                    className="asset-item"
                    tabIndex={0}
                    draggable
                    data-component-id={c.id}
                    title={`${c.label} — drag to the canvas, or press Enter to insert`}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(COMPONENT_DRAG_TYPE, c.id);
                      e.dataTransfer.setData("text/plain", c.label);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onDoubleClick={() => onInsert(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onInsert(c.id);
                      }
                    }}
                  >
                    <Icon name="frame" />
                    <span className="asset-item-name">{c.label}</span>
                  </li>
                ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
