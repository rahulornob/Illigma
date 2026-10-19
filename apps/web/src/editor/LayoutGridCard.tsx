import type { Document, ReadonlyNode } from "@illigma/core";
import type { LayoutGrid, LayoutGridAlignment, MaskType } from "@illigma/format";
import { Icon } from "../ui/Icon";
import { NumberField } from "../ui/NumberField";
import { defaultGrid } from "./grids";
import { guard, type OnEditError } from "./layout-props";

const PATTERNS: { value: LayoutGrid["pattern"]; label: string }[] = [
  { value: "GRID", label: "Grid" },
  { value: "COLUMNS", label: "Columns" },
  { value: "ROWS", label: "Rows" },
];
const ALIGNMENTS: { value: LayoutGridAlignment; label: string }[] = [
  { value: "STRETCH", label: "Stretch" },
  { value: "MIN", label: "Left" },
  { value: "CENTER", label: "Center" },
  { value: "MAX", label: "Right" },
];

/** Frames (and components) can hold layout grids. */
export const hasGridCard = (nodes: readonly ReadonlyNode[]) => nodes.length === 1 && ["FRAME", "COMPONENT", "INSTANCE"].includes((nodes[0] as ReadonlyNode).type);

/**
 * Layout grid (Figma's layoutGrids): a grid, columns or rows per row, with
 * size, count, alignment, gutter and margin. ⌃G shows or hides every grid.
 */
export function LayoutGridCard({ doc, node, readOnly, onError }: { doc: Document; node: ReadonlyNode; readOnly: boolean; onError?: OnEditError | undefined }) {
  const grids = (node.layoutGrids ?? []) as readonly LayoutGrid[];
  const edit = (label: string, fn: (cur: LayoutGrid[]) => LayoutGrid[]) =>
    guard(onError, () =>
      doc.transact(label, (tx) => {
        const cur = ((doc.get(node.id)?.layoutGrids ?? []) as LayoutGrid[]).map((g) => ({ ...g }));
        const next = fn(cur);
        tx.set(node.id, "layoutGrids", next.length ? next : undefined);
      }),
    );
  const editRow = (i: number, label: string, fn: (g: LayoutGrid) => LayoutGrid) => edit(label, (cur) => cur.map((g, j) => (j === i ? fn(g) : g)));
  const num = (i: number, key: string, label: string, value: number, min: number, max = 100_000) => (
    <NumberField
      key={`${node.id}-${i}-${key}`}
      id={`grid-${i}-${key}`}
      label={`Grid ${i + 1} ${label.toLowerCase()}`}
      prefix={label}
      values={[value]}
      min={min}
      max={max}
      readOnly={readOnly}
      onChange={(next) => editRow(i, `Change grid ${label.toLowerCase()}`, (g) => ({ ...g, [key]: key === "count" ? Math.round(next(value)) : next(value) }) as LayoutGrid)}
    />
  );

  return (
    <section className="card layout-grid-card" aria-labelledby="layout-grid-heading">
      <div className="card-head">
        <span className="card-icon">
          <Icon name="grid-3x3" />
        </span>
        <h2 id="layout-grid-heading" className="section-heading card-title">
          Layout grid
        </h2>
        <button type="button" className="icon-button" aria-label="Add layout grid" title="Add layout grid" disabled={readOnly} onClick={() => edit("Add layout grid", (cur) => [...cur, defaultGrid("GRID")])}>
          <Icon name="plus" />
        </button>
      </div>
      {grids.length > 0 && (
        <ul className="grid-rows" aria-label="Layout grids">
          {grids.map((g, i) => (
            <li key={i} className="grid-row">
              <div className="grid-row-head">
                <div className="select">
                  <label className="sr-only" htmlFor={`grid-${i}-pattern`}>
                    Grid {i + 1} type
                  </label>
                  <select
                    id={`grid-${i}-pattern`}
                    className="select-input"
                    value={g.pattern}
                    disabled={readOnly}
                    onChange={(e) => {
                      const p = e.target.value as LayoutGrid["pattern"];
                      editRow(i, "Change grid type", (x) => ({ ...defaultGrid(p), visible: x.visible !== false, ...(x.color && { color: x.color }) }));
                    }}
                  >
                    {PATTERNS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <Icon name="chevron-down" size={12} />
                </div>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`${g.visible === false ? "Show" : "Hide"} grid ${i + 1}`}
                  title={g.visible === false ? "Show grid" : "Hide grid"}
                  aria-pressed={g.visible !== false}
                  disabled={readOnly}
                  onClick={() => editRow(i, g.visible === false ? "Show layout grid" : "Hide layout grid", (x) => ({ ...x, visible: x.visible === false }))}
                >
                  <Icon name={g.visible === false ? "eye-off" : "eye"} />
                </button>
                <button type="button" className="icon-button" aria-label={`Remove grid ${i + 1}`} title="Remove layout grid" disabled={readOnly} onClick={() => edit("Remove layout grid", (cur) => cur.filter((_, j) => j !== i))}>
                  <Icon name="minus" />
                </button>
              </div>
              <div className="field-grid">
                {g.pattern === "GRID" ? (
                  num(i, "sectionSize", "Size", g.sectionSize, 1)
                ) : (
                  <>
                    {num(i, "count", "Count", g.count, 0, 1000)}
                    <div className="select">
                      <label className="sr-only" htmlFor={`grid-${i}-alignment`}>
                        Grid {i + 1} alignment
                      </label>
                      <select
                        id={`grid-${i}-alignment`}
                        className="select-input"
                        value={g.alignment}
                        disabled={readOnly}
                        onChange={(e) => editRow(i, "Change grid alignment", (x) => ({ ...x, alignment: e.target.value as LayoutGridAlignment, ...(e.target.value !== "STRETCH" && x.pattern !== "GRID" && !x.sectionSize && { sectionSize: 64 }) }) as LayoutGrid)}
                      >
                        {ALIGNMENTS.map((a) => (
                          <option key={a.value} value={a.value}>
                            {g.pattern === "ROWS" ? a.label.replace("Left", "Top").replace("Right", "Bottom") : a.label}
                          </option>
                        ))}
                      </select>
                      <Icon name="chevron-down" size={12} />
                    </div>
                    {g.alignment !== "STRETCH" && num(i, "sectionSize", g.pattern === "ROWS" ? "Height" : "Width", g.sectionSize ?? 64, 1)}
                    {g.alignment !== "CENTER" && num(i, "offset", g.alignment === "STRETCH" ? "Margin" : "Offset", g.offset ?? 0, 0)}
                    {num(i, "gutterSize", "Gutter", g.gutterSize, 0)}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const MASK_TYPES: { value: MaskType; label: string }[] = [
  { value: "ALPHA", label: "Alpha" },
  { value: "VECTOR", label: "Vector (outline)" },
  { value: "LUMINANCE", label: "Luminance" },
];

/** Mask: how a mask layer clips the layers above it. */
export function MaskCard({ doc, nodes, readOnly, onError }: { doc: Document; nodes: readonly ReadonlyNode[]; readOnly: boolean; onError?: OnEditError | undefined }) {
  const types = nodes.map((n) => n.maskType ?? "ALPHA");
  const same = types.every((t) => t === types[0]) ? types[0] : undefined;
  return (
    <section className="card" aria-labelledby="mask-heading">
      <div className="card-head">
        <span className="card-icon">
          <Icon name="venetian-mask" />
        </span>
        <h2 id="mask-heading" className="section-heading card-title">
          Mask
        </h2>
      </div>
      <div className="select">
        <label className="sr-only" htmlFor="prop-mask-type">
          Mask type
        </label>
        <select
          id="prop-mask-type"
          className="select-input"
          value={same ?? ""}
          disabled={readOnly}
          onChange={(e) =>
            guard(onError, () =>
              doc.transact("Change mask type", (tx) => {
                const v = e.target.value as MaskType;
                for (const n of nodes) tx.set(n.id, "maskType", v === "ALPHA" ? undefined : v);
              }),
            )
          }
        >
          {same === undefined && (
            <option value="" disabled>
              Mixed
            </option>
          )}
          {MASK_TYPES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <Icon name="chevron-down" size={12} />
      </div>
    </section>
  );
}
