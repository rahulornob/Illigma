import { useRef, useState, type KeyboardEvent } from "react";
import type { Document, ReadonlyNode } from "@illigma/core";
import type { NodeId } from "@illigma/format";
import { Icon, type IconName } from "../ui/Icon";
import { MenuButton } from "../ui/Menu";
import { LIMITS, NumberField } from "../ui/NumberField";
import {
  addAutoLayout,
  alignmentCell,
  alignmentPatch,
  autoGapPatch,
  cellName,
  directionOf,
  directionPatch,
  isAutoLayoutNode,
  removeAutoLayout,
  type Cell,
  type Direction,
} from "./layout-model";
import { guard, setLayoutProps, type LayoutPatch, type OnEditError } from "./layout-props";

const DIRECTIONS: { value: Direction; label: string; icon: IconName }[] = [
  { value: "HORIZONTAL", label: "Horizontal", icon: "arrow-right" },
  { value: "VERTICAL", label: "Vertical", icon: "arrow-down" },
  { value: "WRAP", label: "Wrap", icon: "corner-down-left" },
];

const same = <T,>(values: readonly T[]): T | undefined => (values.every((v) => v === values[0]) ? values[0] : undefined);

/** Arrow keys inside a radio group: move and select, and never reach the editor's shortcuts (arrows nudge layers). */
function arrowStep(e: KeyboardEvent): { dx: number; dy: number } | null {
  const d = { ArrowLeft: { dx: -1, dy: 0 }, ArrowRight: { dx: 1, dy: 0 }, ArrowUp: { dx: 0, dy: -1 }, ArrowDown: { dx: 0, dy: 1 } }[e.key];
  if (!d) return null;
  e.preventDefault();
  e.stopPropagation();
  return d;
}

function DirectionGroup({ value, disabled, onChange }: { value: Direction | undefined; disabled: boolean; onChange(d: Direction): void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = DIRECTIONS.findIndex((d) => d.value === value);
  return (
    <div className="segmented" role="radiogroup" aria-label="Direction">
      {DIRECTIONS.map((d, i) => (
        <button
          key={d.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          className="segment"
          aria-checked={d.value === value}
          aria-label={d.label}
          title={d.label}
          // Roving tab stop: the checked button (or the first when mixed).
          tabIndex={i === (current < 0 ? 0 : current) ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(d.value)}
          onKeyDown={(e) => {
            const step = arrowStep(e);
            if (!step) return;
            const j = (i + step.dx + step.dy + DIRECTIONS.length) % DIRECTIONS.length;
            refs.current[j]?.focus();
            onChange((DIRECTIONS[j] as (typeof DIRECTIONS)[number]).value);
          }}
        >
          <Icon name={d.icon} />
        </button>
      ))}
    </div>
  );
}

/** The 9-point alignment grid. With an Auto gap, a whole row (or column) lights up: only the cross-axis position applies. */
function AlignmentGrid({ direction, cell, spread, disabled, onPick }: { direction: Direction | undefined; cell: Cell | undefined; spread: boolean; disabled: boolean; onPick(c: Cell): void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const vertical = direction === "VERTICAL";
  const lit = (c: Cell) => !!cell && (spread ? (vertical ? c.col === cell.col : c.row === cell.row) : c.col === cell.col && c.row === cell.row);
  const focusIndex = cell ? cell.row * 3 + cell.col : 0;
  return (
    <div className={`align-grid${vertical ? " is-vertical" : ""}`} role="radiogroup" aria-label={spread ? "Alignment (Auto gap: across the stack only)" : "Alignment"}>
      {Array.from({ length: 9 }, (_, i) => {
        const c = { col: i % 3, row: Math.floor(i / 3) };
        const checked = !!cell && c.col === cell.col && c.row === cell.row;
        return (
          <button
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            className="align-cell"
            data-lit={lit(c) || undefined}
            data-col={c.col}
            data-row={c.row}
            aria-checked={checked}
            aria-label={cellName(c)}
            title={cellName(c)}
            tabIndex={i === focusIndex ? 0 : -1}
            disabled={disabled}
            onClick={() => onPick(c)}
            onKeyDown={(e) => {
              const step = arrowStep(e);
              if (!step) return;
              const next = { col: Math.max(0, Math.min(2, c.col + step.dx)), row: Math.max(0, Math.min(2, c.row + step.dy)) };
              refs.current[next.row * 3 + next.col]?.focus();
              onPick(next);
            }}
          >
            <span className="align-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        );
      })}
    </div>
  );
}

const PADDING_SIDES = [
  { key: "paddingLeft", label: "Left padding", icon: "panel-left" },
  { key: "paddingTop", label: "Top padding", icon: "panel-top" },
  { key: "paddingRight", label: "Right padding", icon: "panel-right" },
  { key: "paddingBottom", label: "Bottom padding", icon: "panel-bottom" },
] as const;
type PaddingKey = (typeof PADDING_SIDES)[number]["key"];

/**
 * The "Auto layout" card (Figma board "01 Auto layout"): add or remove it;
 * direction; alignment; gap (a number or Auto); padding as horizontal and
 * vertical pairs, or each side. Every control applies to every selected
 * frame, and each change is one undo step.
 */
export function AutoLayoutCard({
  doc,
  nodes,
  readOnly,
  onSelect,
  onError,
}: {
  doc: Document;
  nodes: readonly ReadonlyNode[];
  readOnly: boolean;
  onSelect?: ((ids: NodeId[]) => void) | undefined;
  onError?: OnEditError | undefined;
}) {
  const ids = nodes.map((n) => n.id);
  const all = nodes.length > 0 && nodes.every((n) => isAutoLayoutNode(n));
  const pad = (n: ReadonlyNode, k: PaddingKey) => Math.max(0, n[k] ?? 0);
  const differ = nodes.some((n) => pad(n, "paddingLeft") !== pad(n, "paddingRight") || pad(n, "paddingTop") !== pad(n, "paddingBottom"));
  // Each side shows by default when the sides differ; the toggle then wins until the selection changes.
  const [chosen, setSides] = useState<boolean | null>(null);
  const sides = chosen ?? differ;

  /** For number fields: an edit the document refuses throws, and the field says why. */
  const set = (patch: LayoutPatch | ((id: NodeId) => LayoutPatch), label: string) => setLayoutProps(doc, ids, patch, label);
  /** For buttons and menus: a refused edit goes to `onError`. */
  const command = (patch: LayoutPatch | ((id: NodeId) => LayoutPatch), label: string) => guard(onError, () => set(patch, label));
  const byId = (id: NodeId) => doc.get(id) as ReadonlyNode;

  const direction = all ? same(nodes.map((n) => directionOf(n) as Direction)) : undefined;
  const cells = nodes.map((n) => alignmentCell(n));
  const cellKey = same(cells.map((c) => `${c.col},${c.row},${c.spread}`));
  const cell = cellKey ? cells[0] : undefined;
  const spread = nodes.length > 0 && cells.every((c) => c.spread);
  const wrap = direction === "WRAP";
  const vertical = direction === "VERTICAL";

  return (
    <section className="card" aria-labelledby="autolayout-heading">
      <div className="card-head">
        <span className="card-icon">
          <Icon name="rows-2" />
        </span>
        <h2 id="autolayout-heading" className="section-heading card-title">
          Auto layout
        </h2>
        {all ? (
          <button type="button" className="icon-button" aria-label="Remove auto layout" title="Remove auto layout  ⌥⇧A" disabled={readOnly} onClick={() => guard(onError, () => removeAutoLayout(doc, ids))}>
            <Icon name="minus" />
          </button>
        ) : (
          <button
            type="button"
            className="icon-button"
            aria-label="Add auto layout"
            title="Add auto layout  ⇧A"
            disabled={readOnly}
            onClick={() => {
              const next = guard(onError, () => addAutoLayout(doc, ids));
              if (next && next.join() !== ids.join()) onSelect?.(next);
            }}
          >
            <Icon name="plus" />
          </button>
        )}
      </div>
      {all && (
        <>
          <DirectionGroup value={direction} disabled={readOnly} onChange={(d) => command((id) => directionPatch(byId(id), d), `Direction: ${d.toLowerCase()}`)} />
          <div className="autolayout-body">
            <AlignmentGrid
              direction={direction}
              cell={cell}
              spread={spread}
              disabled={readOnly}
              onPick={(c) => command((id) => alignmentPatch(directionOf(byId(id)) ?? "HORIZONTAL", c, alignmentCell(byId(id)).spread), `Align ${cellName(c).toLowerCase()}`)}
            />
            <div className="autolayout-spacing">
              <NumberField
                key={`gap-${ids.join()}`}
                id="prop-gap"
                label={wrap ? "Gap between columns" : "Gap between items"}
                prefix={<Icon name={vertical ? "gap-vertical" : "gap"} size={12} />}
                values={nodes.map((n) => n.itemSpacing ?? 0)}
                text={spread ? "Auto" : undefined}
                // A negative gap overlaps the items, as in Figma.
                min={-LIMITS.spacing}
                max={LIMITS.spacing}
                readOnly={readOnly}
                onText={(t) => {
                  if (t.toLowerCase() !== "auto") return false;
                  set((id) => autoGapPatch(byId(id)), "Gap: auto");
                  return true;
                }}
                onChange={(next) => set((id) => ({ itemSpacing: next(byId(id).itemSpacing ?? 0), ...(alignmentCell(byId(id)).spread ? { primaryAxisAlignItems: "MIN" } : {}) }), "Change gap")}
                suffix={
                  <MenuButton
                    label={`Gap mode: ${spread ? "Auto" : "Fixed"}`}
                    title="Gap mode"
                    className="field-menu"
                    disabled={readOnly}
                    entries={[
                      { value: "auto", label: "Auto (space between)", checked: spread },
                      { value: "fixed", label: "Fixed", checked: nodes.every((n) => !alignmentCell(n).spread) },
                    ]}
                    onSelect={(v) =>
                      v === "auto"
                        ? command((id) => autoGapPatch(byId(id)), "Gap: auto")
                        : command((id) => (alignmentCell(byId(id)).spread ? { primaryAxisAlignItems: "MIN" } : {}), "Gap: fixed")
                    }
                  >
                    <Icon name="chevron-down" size={12} />
                  </MenuButton>
                }
              />
              {wrap && (
                <NumberField
                  key={`rowgap-${ids.join()}`}
                  id="prop-row-gap"
                  label="Gap between rows"
                  prefix={<Icon name="gap-vertical" size={12} />}
                  values={nodes.map((n) => n.counterAxisSpacing ?? Math.max(0, n.itemSpacing ?? 0))}
                  min={0}
                  max={LIMITS.spacing}
                  readOnly={readOnly}
                  onChange={(next) => set((id) => ({ counterAxisSpacing: next(byId(id).counterAxisSpacing ?? Math.max(0, byId(id).itemSpacing ?? 0)) }), "Change row gap")}
                />
              )}
              <div className="padding-row">
                {sides ? (
                  <div className="padding-sides">
                    {PADDING_SIDES.map((s) => (
                      <NumberField
                        key={`${s.key}-${ids.join()}`}
                        id={`prop-${s.key}`}
                        label={s.label}
                        prefix={<Icon name={s.icon} size={12} />}
                        values={nodes.map((n) => pad(n, s.key))}
                        min={0}
                        max={LIMITS.spacing}
                        readOnly={readOnly}
                        onChange={(next) => set((id) => ({ [s.key]: next(pad(byId(id), s.key)) }), `Change ${s.label.toLowerCase()}`)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="padding-pair">
                    {(
                      [
                        ["paddingLeft", "paddingRight", "Horizontal padding", "padding-horizontal", "prop-padding-h"],
                        ["paddingTop", "paddingBottom", "Vertical padding", "padding-vertical", "prop-padding-v"],
                      ] as const
                    ).map(([a, b, label, icon, id]) => (
                      <NumberField
                        key={`${id}-${ids.join()}`}
                        id={id}
                        label={label}
                        prefix={<Icon name={icon} size={12} />}
                        values={nodes.flatMap((n) => [pad(n, a), pad(n, b)])}
                        min={0}
                        max={LIMITS.spacing}
                        readOnly={readOnly}
                        onChange={(next) => set((nid) => ({ [a]: next(pad(byId(nid), a)), [b]: next(pad(byId(nid), b)) }), `Change ${label.toLowerCase()}`)}
                      />
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  className="icon-button toggle-button"
                  aria-label="Individual padding"
                  title="Individual padding"
                  aria-pressed={sides}
                  onClick={() => setSides(!sides)}
                >
                  <Icon name="square-dashed" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
