import { setFrameMode, Resolver, type Document, type ReadonlyNode } from "@illigma/core";
import { Icon } from "../../ui/Icon";
import { edit, openVariables } from "../styles/common";

const MODE_HOLDERS = new Set(["PAGE", "FRAME", "SECTION", "COMPONENT", "COMPONENT_SET", "INSTANCE"]);

/**
 * Variable modes on a frame, section or page (variables.md "Modes on the
 * canvas"): for each collection with more than one mode, Auto (inherit from
 * the parent, then the page, then the collection's default) or a chosen
 * mode. Children inherit it; the canvas re-renders right away.
 */
export function ModesCard({ doc, nodes, readOnly, onError }: { doc: Document; nodes: readonly ReadonlyNode[]; readOnly: boolean; onError(e: unknown): void }) {
  const cols = doc.variables().collections.filter((c) => c.modes.length > 1);
  if (!cols.length || !nodes.length || !nodes.every((n) => MODE_HOLDERS.has(n.type))) return null;
  const r = new Resolver(doc);
  return (
    <section className="card" aria-labelledby="modes-heading">
      <div className="card-head">
        <span className="card-icon">
          <Icon name="sun-moon" />
        </span>
        <h2 id="modes-heading" className="section-heading card-title">
          Variable modes
        </h2>
        <button type="button" className="icon-button" aria-label="Open variables" title="Open variables…" onClick={openVariables}>
          <Icon name="hexagon" />
        </button>
      </div>
      {cols.map((c) => {
        const explicit = nodes.map((n) => n.explicitVariableModes?.[c.id] ?? "");
        const same = explicit.every((m) => m === explicit[0]) ? explicit[0] : "mixed";
        const parent = nodes[0]?.parentId ? doc.get(nodes[0].parentId) : undefined;
        const inherited = c.modes.find((m) => m.modeId === r.modeFor(parent, c.id))?.name ?? "";
        return (
          <div key={c.id} className="mode-row">
            <label className="mode-label" htmlFor={`mode-${c.id}`}>
              {c.name}
            </label>
            <div className="field mode-field">
              <select
                id={`mode-${c.id}`}
                className="field-input mode-select"
                value={same}
                disabled={readOnly}
                onChange={(e) => {
                  const m = e.target.value || null;
                  const name = c.modes.find((x) => x.modeId === m)?.name ?? "Auto";
                  edit(doc, `Set ${c.name} mode to ${name}`, (tx) => nodes.forEach((n) => setFrameMode(tx, doc, n.id, c.id, m)), onError);
                }}
              >
                {same === "mixed" && <option value="mixed">Mixed</option>}
                <option value="">Auto ({inherited})</option>
                {c.modes.map((m) => (
                  <option key={m.modeId} value={m.modeId}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );
      })}
    </section>
  );
}
