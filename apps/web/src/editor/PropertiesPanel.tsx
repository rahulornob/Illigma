import type { Document, ReadonlyNode } from "@illigma/core";
import type { LayoutSizing, NodeId } from "@illigma/format";
import { Icon } from "../ui/Icon";
import { MenuButton, type MenuEntry } from "../ui/Menu";
import { fmt, LIMITS, NumberField } from "../ui/NumberField";
import { AutoLayoutCard } from "./AutoLayoutCard";
import { ConstraintsCard } from "./ConstraintsCard";
import { TypographyCard } from "./TypographyCard";
import { effectiveSizing, hasConstraints, isAutoLayoutNode, setSizing, sizingOptions, type Axis } from "./layout-model";
import { guard, setBoxFields, setLayoutProps, type BoxField, type OnEditError } from "./layout-props";

const FIELDS: { key: BoxField; letter: string; label: string; min: number; max: number }[] = [
  { key: "x", letter: "X", label: "X position", min: -LIMITS.position, max: LIMITS.position },
  { key: "y", letter: "Y", label: "Y position", min: -LIMITS.position, max: LIMITS.position },
  { key: "width", letter: "W", label: "Width", min: 0.01, max: LIMITS.size },
  { key: "height", letter: "H", label: "Height", min: 0.01, max: LIMITS.size },
];

const SIZING_NAME: Record<LayoutSizing, string> = { FIXED: "Fixed", HUG: "Hug", FILL: "Fill" };
const SHORT: Record<LayoutSizing, string> = { FIXED: "Fixed", HUG: "Hug contents", FILL: "Fill container" };

/** The sizing menu on W or H (Figma board "21 · width sizing menu"): only the options that apply to every selected layer. */
function SizingMenu({ doc, nodes, axis, readOnly, onError }: { doc: Document; nodes: readonly ReadonlyNode[]; axis: Axis; readOnly: boolean; onError?: OnEditError | undefined }) {
  const options = (["FIXED", "HUG", "FILL"] as const).filter((s) => nodes.every((n) => sizingOptions(doc, n).includes(s)));
  if (options.length < 2) return null;
  const current = nodes.map((n) => effectiveSizing(doc, n, axis));
  const same = current.every((s) => s === current[0]) ? current[0] : undefined;
  const word = axis === "width" ? "width" : "height";
  const size = nodes.length === 1 ? ` · ${fmt((nodes[0] as ReadonlyNode)[axis])}` : "";
  const label: Record<LayoutSizing, string> = { FIXED: `Fixed ${word}${size}`, HUG: "Hug contents", FILL: "Fill container" };
  const entries: MenuEntry<LayoutSizing>[] = [{ kind: "heading", label: axis === "width" ? "Width" : "Height" }, ...options.map((s) => ({ value: s, label: label[s], checked: s === same }))];
  const name = axis === "width" ? "Horizontal resizing" : "Vertical resizing";
  return (
    <MenuButton
      // Never "width" or "height" in the name: the W and H fields own those labels.
      label={`${name}: ${same ? SHORT[same] : "Mixed"}`}
      title={name}
      className="field-menu"
      disabled={readOnly}
      entries={entries}
      onSelect={(s) =>
        guard(onError, () =>
          setSizing(
            doc,
            nodes.map((n) => n.id),
            axis,
            s,
          ),
        )
      }
    >
      <Icon name="chevron-down" size={12} />
    </MenuButton>
  );
}

export function PropertiesPanel({
  doc,
  pageId,
  selection,
  readOnly = false,
  onSelect,
  onError,
}: {
  doc: Document;
  pageId: NodeId;
  selection: readonly NodeId[];
  readOnly?: boolean;
  /** The selection after a command that makes a new layer (wrapping layers in an auto layout frame). */
  onSelect?(ids: NodeId[]): void;
  /** An edit the document refused (nothing changed). Number fields say so themselves, under the field. */
  onError?: OnEditError | undefined;
}) {
  const ids = selection.filter((id) => doc.has(id));
  const nodes = ids.map((id) => doc.get(id) as ReadonlyNode);
  const node = nodes.length === 1 ? nodes[0] : undefined;
  const page = doc.get(pageId);

  // "Absolute position" applies to children of auto layout frames.
  const inAutoLayout = nodes.length > 0 && nodes.every((n) => isAutoLayoutNode(n.parentId ? doc.get(n.parentId) : undefined));
  const absolute = inAutoLayout && nodes.every((n) => n.layoutPositioning === "ABSOLUTE");
  const constrained = nodes.length > 0 && nodes.every((n) => hasConstraints(doc, n));

  return (
    <aside className="panel panel-right" aria-label="Properties">
      <div className="panel-tabs" role="presentation">
        <span className="panel-tab is-active">Design</span>
      </div>
      <div className="panel-scroll">
        {ids.length ? (
          <>
            <section className="card" aria-labelledby="position-heading">
              <div className="card-head">
                <h2 id="position-heading" className="section-heading">
                  Position and size
                </h2>
                <span className="muted">{node ? node.name : `${ids.length} layers`}</span>
                {inAutoLayout && (
                  <button
                    type="button"
                    className="icon-button toggle-button"
                    aria-label="Absolute position"
                    title="Absolute position (ignore auto layout)"
                    aria-pressed={absolute}
                    disabled={readOnly}
                    onClick={() =>
                      guard(onError, () => setLayoutProps(doc, ids, { layoutPositioning: absolute ? undefined : "ABSOLUTE" }, absolute ? "Use auto layout position" : "Absolute position"))
                    }
                  >
                    <Icon name="square-dashed-mouse-pointer" />
                  </button>
                )}
              </div>
              <div className="field-grid">
                {FIELDS.map((f) => {
                  const values = nodes.map((n) => n[f.key]);
                  const axis = f.key === "width" || f.key === "height" ? f.key : null;
                  const sizing = axis ? nodes.map((n) => effectiveSizing(doc, n, axis)) : [];
                  const unit = sizing.length && sizing.every((s) => s === sizing[0]) && sizing[0] !== "FIXED" ? SIZING_NAME[sizing[0] as LayoutSizing] : null;
                  return (
                    <NumberField
                      key={`${ids.join(",")}-${f.key}`}
                      id={`prop-${f.key}`}
                      label={f.label}
                      prefix={f.letter}
                      values={values}
                      min={f.min}
                      max={f.max}
                      readOnly={readOnly}
                      onChange={(next) =>
                        setBoxFields(
                          doc,
                          ids,
                          f.key,
                          // From the document as it is now, not as this render saw it.
                          ids.map((id) => next(doc.get(id)?.[f.key] ?? 0)),
                          `Change ${f.label.toLowerCase()}`,
                        )
                      }
                      suffix={
                        axis && (
                          <>
                            {unit && (
                              <span className="field-unit" aria-hidden="true">
                                {unit}
                              </span>
                            )}
                            <SizingMenu doc={doc} nodes={nodes} axis={axis} readOnly={readOnly} onError={onError} />
                          </>
                        )
                      }
                    />
                  );
                })}
              </div>
            </section>
            <AutoLayoutCard key={ids.join(",")} doc={doc} nodes={nodes} readOnly={readOnly} onSelect={onSelect} onError={onError} />
            {constrained && <ConstraintsCard doc={doc} nodes={nodes} readOnly={readOnly} onError={onError} />}
            {nodes.every((n) => n.type === "TEXT") && <TypographyCard doc={doc} nodes={nodes} readOnly={readOnly} onError={onError} />}
          </>
        ) : (
          <section className="card" aria-labelledby="page-heading">
            <div className="card-head">
              <h2 id="page-heading" className="section-heading">
                {page?.name ?? "Page"}
              </h2>
            </div>
            <p className="muted">Select a layer to see its position and size.</p>
          </section>
        )}
      </div>
    </aside>
  );
}
