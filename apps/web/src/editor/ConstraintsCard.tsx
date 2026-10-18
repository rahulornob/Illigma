import type { MouseEvent } from "react";
import type { Document, ReadonlyNode } from "@illigma/core";
import type { ConstraintType, Constraints } from "@illigma/format";
import { Icon } from "../ui/Icon";
import { CONSTRAINT_OPTIONS, constraintTargets } from "./layout-model";
import { guard, setLayoutProps, type OnEditError } from "./layout-props";

type Side = keyof Constraints;

const DEFAULT: Constraints = { horizontal: "MIN", vertical: "MIN" };
const constraintsOf = (n: ReadonlyNode): Constraints => ({ ...DEFAULT, ...n.constraints });

/**
 * Constraints (Figma's Left, Right, Left & right, Center, Scale and the same
 * for Top and Bottom), for layers in a plain frame and absolute layers in an
 * auto layout frame. The two selects are the keyboard path; the widget is a
 * mouse shortcut, as in Figma (Shift-click a second edge for both edges).
 * A group shows and sets its children's constraints (`constraintTargets`).
 */
export function ConstraintsCard({ doc, nodes, readOnly, onError }: { doc: Document; nodes: readonly ReadonlyNode[]; readOnly: boolean; onError?: OnEditError | undefined }) {
  const targets = constraintTargets(
    doc,
    nodes.map((n) => n.id),
  );
  const values = targets.map((id) => constraintsOf(doc.get(id) as ReadonlyNode));
  const pick = (side: Side) => (values.every((c) => c[side] === values[0]?.[side]) ? values[0]?.[side] : undefined);
  const current: Record<Side, ConstraintType | undefined> = { horizontal: pick("horizontal"), vertical: pick("vertical") };

  const set = (side: Side, value: ConstraintType) =>
    guard(onError, () =>
      setLayoutProps(
        doc,
        targets,
        (id) => ({ constraints: { ...constraintsOf(doc.get(id) as ReadonlyNode), [side]: value } }),
        `Constrain ${CONSTRAINT_OPTIONS[side].find((o) => o.value === value)?.label.toLowerCase() ?? ""}`,
      ),
    );

  /** A click on an edge of the widget: that edge; Shift adds it to the opposite one (both edges). */
  const edge = (side: Side, which: "MIN" | "MAX" | "CENTER") => (e: MouseEvent) => {
    if (readOnly) return;
    const now = current[side];
    let next: ConstraintType = which;
    if (e.shiftKey && which !== "CENTER" && ((which === "MIN" && now === "MAX") || (which === "MAX" && now === "MIN"))) next = "STRETCH";
    set(side, next);
  };
  const on = (side: Side, which: "MIN" | "MAX" | "CENTER") => {
    const v = current[side];
    return v === which || (v === "STRETCH" && which !== "CENTER") || undefined;
  };

  return (
    <section className="card" aria-labelledby="constraints-heading">
      <div className="card-head">
        <span className="card-icon">
          <Icon name="pin" />
        </span>
        <h2 id="constraints-heading" className="section-heading card-title">
          Constraints
        </h2>
      </div>
      <div className="constraints-row">
        <div className="constraint-widget" aria-hidden="true">
          <span className="constraint-box" />
          <span className="constraint-line h min" data-on={on("horizontal", "MIN")} onClick={edge("horizontal", "MIN")} />
          <span className="constraint-line h max" data-on={on("horizontal", "MAX")} onClick={edge("horizontal", "MAX")} />
          <span className="constraint-line h mid" data-on={on("horizontal", "CENTER")} onClick={edge("horizontal", "CENTER")} />
          <span className="constraint-line v min" data-on={on("vertical", "MIN")} onClick={edge("vertical", "MIN")} />
          <span className="constraint-line v max" data-on={on("vertical", "MAX")} onClick={edge("vertical", "MAX")} />
          <span className="constraint-line v mid" data-on={on("vertical", "CENTER")} onClick={edge("vertical", "CENTER")} />
        </div>
        <div className="constraint-selects">
          {(["horizontal", "vertical"] as const).map((side) => (
            <div className="select" key={side}>
              <label className="sr-only" htmlFor={`prop-constraint-${side}`}>
                {side === "horizontal" ? "Horizontal constraint" : "Vertical constraint"}
              </label>
              <select
                id={`prop-constraint-${side}`}
                className="select-input"
                value={current[side] ?? ""}
                disabled={readOnly}
                onChange={(e) => set(side, e.target.value as ConstraintType)}
              >
                {current[side] === undefined && (
                  <option value="" disabled>
                    Mixed
                  </option>
                )}
                {CONSTRAINT_OPTIONS[side].map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <Icon name="chevron-down" size={12} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
