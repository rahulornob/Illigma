/**
 * The Properties panel's component card (core-states.md "14 · Components"):
 *
 * - an instance (or a layer in one): its main component, variant pickers,
 *   component properties (boolean toggles, text, instance swap), and
 *   Go to main component, Reset all changes and Detach;
 * - a main component or a layer in one: its properties, and "Create property"
 *   for the selected layer (visibility, text or nested instance);
 * - a component set: its variant properties and Add variant.
 *
 * Colour roles: components are blue (the "type/component" token), never purple.
 */
import {
  addComponentProperty,
  addVariant,
  listComponents,
  mainComponent,
  ownerInstance,
  propertyDefinitions,
  setInstanceProperty,
  setVariant,
  variantProperties,
  type Document,
  type ReadonlyNode,
} from "@illigma/core";
import { parseVariantName, type NodeId } from "@illigma/format";
import { Icon } from "../../ui/Icon";
import { guard, type OnEditError } from "../layout-props";
import { runComponentCommand } from "./commands";
import "./components.css";

/** Ask the editor to show node `id` (switching page if needed) and select it. */
export const GO_TO_NODE_EVENT = "illigma:go-to-node";

interface Props {
  doc: Document;
  node: ReadonlyNode;
  readOnly: boolean;
  onSelect?: ((ids: NodeId[]) => void) | undefined;
  onError?: OnEditError | undefined;
}

export function ComponentCard({ doc, node, readOnly, onSelect, onError }: Props) {
  const owner = ownerInstance(doc, node.id);
  if (owner) return <InstanceCard doc={doc} node={node} inst={owner} readOnly={readOnly} onSelect={onSelect} onError={onError} />;
  if (node.type === "COMPONENT_SET") return <SetCard doc={doc} set={node} readOnly={readOnly} onSelect={onSelect} onError={onError} />;
  let comp: ReadonlyNode | undefined;
  for (let n: ReadonlyNode | undefined = node; n; n = n.parentId ? doc.get(n.parentId) : undefined) {
    if (n.type === "COMPONENT") {
      comp = n;
      break;
    }
  }
  if (comp) return <MainCard doc={doc} comp={comp} layer={node} readOnly={readOnly} onError={onError} />;
  return null;
}

function Head({ title, label }: { title: string; label: string }) {
  return (
    <div className="card-head">
      <span className="card-icon component-icon">
        <Icon name="frame" />
      </span>
      <h2 id="component-heading" className="section-heading card-title">
        {title}
      </h2>
      <span className="muted component-name" title={label}>
        {label}
      </span>
    </div>
  );
}

function InstanceCard({ doc, node, inst, readOnly, onSelect, onError }: { doc: Document; node: ReadonlyNode; inst: ReadonlyNode; readOnly: boolean; onSelect?: ((ids: NodeId[]) => void) | undefined; onError?: OnEditError | undefined }) {
  const main = mainComponent(doc, inst.id);
  const set = main?.parentId ? doc.get(main.parentId) : undefined;
  const variants = set?.type === "COMPONENT_SET" ? variantProperties(doc, set.id) : {};
  const current = main ? parseVariantName(main.name) : {};
  const defs = main ? propertyDefinitions(doc, main) : {};
  const values = inst.componentProperties ?? {};
  const isRoot = node.id === inst.id;
  const changed = !!inst.overrides || !!inst.componentProperties;
  const components = listComponents(doc);
  const run = (label: string, fn: Parameters<Document["transact"]>[1]) => guard(onError, () => doc.transact(label, fn));
  const mainName = main ? (set?.type === "COMPONENT_SET" ? `${set.name} · ${main.name}` : main.name) : "Missing main component";

  return (
    <section className="card component-card" aria-labelledby="component-heading">
      <Head title={isRoot ? "Instance" : "In instance"} label={mainName} />
      {Object.entries(variants).map(([prop, options]) => (
        <div className="component-row" key={prop}>
          <label className="component-label" htmlFor={`variant-${prop}`}>
            {prop}
          </label>
          <select
            id={`variant-${prop}`}
            className="select-input"
            value={current[prop] ?? ""}
            disabled={readOnly}
            onChange={(e) => run(`${prop}: ${e.target.value}`, (tx) => void setVariant(doc, tx, inst.id, prop, e.target.value))}
          >
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      ))}
      {Object.entries(defs)
        .filter(([, d]) => d.type !== "VARIANT")
        .map(([name, d]) => {
          const value = values[name] ?? d.defaultValue;
          const id = `component-prop-${name.replace(/\W+/g, "-")}`;
          return (
            <div className="component-row" key={name}>
              <label className="component-label" htmlFor={id}>
                {name}
              </label>
              {d.type === "BOOLEAN" ? (
                <button
                  id={id}
                  type="button"
                  role="switch"
                  aria-checked={value === true}
                  className="component-switch"
                  disabled={readOnly}
                  onClick={() => run(`${name}: ${value === true ? "off" : "on"}`, (tx) => setInstanceProperty(doc, tx, inst.id, name, value !== true))}
                >
                  <span className="component-switch-knob" />
                </button>
              ) : d.type === "TEXT" ? (
                <input
                  id={id}
                  key={`${inst.id}-${name}-${String(value)}`}
                  className="field-input component-text"
                  defaultValue={String(value)}
                  disabled={readOnly}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                  onBlur={(e) => {
                    if (e.target.value !== String(value)) run(`${name}: text`, (tx) => setInstanceProperty(doc, tx, inst.id, name, e.target.value));
                  }}
                />
              ) : (
                <select id={id} className="select-input" value={String(value)} disabled={readOnly} onChange={(e) => run(`Swap ${name}`, (tx) => setInstanceProperty(doc, tx, inst.id, name, e.target.value))}>
                  {components.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      <div className="component-actions">
        {main && (
          <button type="button" className="btn btn-secondary" onClick={() => window.dispatchEvent(new CustomEvent(GO_TO_NODE_EVENT, { detail: main.id }))}>
            Go to main component
          </button>
        )}
        <button type="button" className="btn btn-ghost" disabled={readOnly || !changed} onClick={() => guard(onError, () => runComponentCommand(doc, "reset-overrides", [node.id]))}>
          Reset all changes
        </button>
        {isRoot && (
          <button
            type="button"
            className="btn btn-ghost"
            title="Detach instance  ⌥⌘B"
            disabled={readOnly}
            onClick={() => {
              const next = guard(onError, () => runComponentCommand(doc, "detach-instance", [inst.id]));
              if (next) onSelect?.(next);
            }}
          >
            Detach
          </button>
        )}
      </div>
    </section>
  );
}

function MainCard({ doc, comp, layer, readOnly, onError }: { doc: Document; comp: ReadonlyNode; layer: ReadonlyNode; readOnly: boolean; onError?: OnEditError | undefined }) {
  const defs = propertyDefinitions(doc, comp);
  const run = (label: string, type: "BOOLEAN" | "TEXT" | "INSTANCE_SWAP") => guard(onError, () => doc.transact(label, (tx) => void addComponentProperty(doc, tx, layer.id, type)));
  const refs = layer.componentPropertyReferences ?? {};
  const inside = layer.id !== comp.id;
  return (
    <section className="card component-card" aria-labelledby="component-heading">
      <Head title={inside ? "In component" : "Component"} label={comp.name} />
      {Object.entries(defs).map(([name, d]) => (
        <div className="component-row" key={name}>
          <span className="component-label">{name}</span>
          <span className="muted">{d.type === "BOOLEAN" ? "Boolean" : d.type === "TEXT" ? "Text" : d.type === "INSTANCE_SWAP" ? "Instance swap" : "Variant"}</span>
        </div>
      ))}
      {inside && (
        <div className="component-actions">
          <button type="button" className="btn btn-secondary" disabled={readOnly || !!refs.visible} onClick={() => run("Create boolean property", "BOOLEAN")}>
            Visibility property
          </button>
          {layer.type === "TEXT" && (
            <button type="button" className="btn btn-secondary" disabled={readOnly || !!refs.characters} onClick={() => run("Create text property", "TEXT")}>
              Text property
            </button>
          )}
          {layer.type === "INSTANCE" && (
            <button type="button" className="btn btn-secondary" disabled={readOnly || !!refs.mainComponent} onClick={() => run("Create instance swap property", "INSTANCE_SWAP")}>
              Swap property
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function SetCard({ doc, set, readOnly, onSelect, onError }: { doc: Document; set: ReadonlyNode; readOnly: boolean; onSelect?: ((ids: NodeId[]) => void) | undefined; onError?: OnEditError | undefined }) {
  const props = variantProperties(doc, set.id);
  return (
    <section className="card component-card" aria-labelledby="component-heading">
      <Head title="Variants" label={set.name} />
      {Object.entries(props).map(([name, options]) => (
        <div className="component-row" key={name}>
          <span className="component-label">{name}</span>
          <span className="muted">{options.join(", ")}</span>
        </div>
      ))}
      <div className="component-actions">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={readOnly}
          onClick={() => {
            const id = guard(onError, () => doc.transact("Add variant", (tx) => addVariant(doc, tx, set.id)));
            if (id) onSelect?.([id]);
          }}
        >
          Add variant
        </button>
      </div>
    </section>
  );
}
