/**
 * Properties cards for vectors: polygon and star count and ratio, the
 * boolean, flatten and outline stroke commands, and in vector edit mode the
 * selected points' corner radius.
 */

import type { Document, ReadonlyNode } from "@illigma/core";
import { BOOLEAN_OPERATIONS, DEFAULT_POLYGON_POINTS, DEFAULT_STAR_INNER_RADIUS, DEFAULT_STAR_POINTS, type BooleanOperation, type NodeId, type VectorNetwork } from "@illigma/format";
import { NumberField } from "../../ui/NumberField";
import { guard, type OnEditError } from "../layout-props";
import { VIcon, type VectorIconName } from "./icons";
import { setCornerRadius } from "./network";
import { BOOLEAN_LABEL, setNetworkFitted } from "./ops";
import { booleanSelection, flattenSelection, outlineSelection } from "./shortcuts";
import { useVectorEdit } from "./store";

const OP_ICON: Record<BooleanOperation, VectorIconName> = { UNION: "union", SUBTRACT: "subtract", INTERSECT: "intersect", EXCLUDE: "exclude" };
const PATHS = new Set(["VECTOR", "RECTANGLE", "ELLIPSE", "POLYGON", "STAR", "LINE", "BOOLEAN_OPERATION", "GROUP", "TEXT", "FRAME"]);

export function VectorCards({ doc, nodes, readOnly, onSelect, onError }: { doc: Document; nodes: readonly ReadonlyNode[]; readOnly: boolean; onSelect?: ((ids: NodeId[]) => void) | undefined; onError?: OnEditError | undefined }) {
  const edit = useVectorEdit();
  const ids = nodes.map((n) => n.id);
  const shapes = nodes.length > 0 && nodes.every((n) => n.type === "POLYGON" || n.type === "STAR");
  const stars = nodes.length > 0 && nodes.every((n) => n.type === "STAR");
  const editing = edit && nodes.length === 1 && nodes[0]?.id === edit.nodeId ? (nodes[0] as ReadonlyNode) : null;
  const canCombine = !editing && (nodes.length > 1 || nodes[0]?.type === "BOOLEAN_OPERATION") && nodes.every((n) => PATHS.has(n.type));
  const canFlatten = !editing && nodes.length > 0 && nodes.every((n) => PATHS.has(n.type));
  const currentOp = nodes.length === 1 && nodes[0]?.type === "BOOLEAN_OPERATION" ? (nodes[0].booleanOperation ?? "UNION") : null;
  const setShape = (key: "pointCount" | "innerRadius", label: string, next: (n: ReadonlyNode) => number) =>
    guard(onError, () =>
      doc.transact(label, (tx) => {
        for (const n of nodes) {
          const cur = doc.get(n.id);
          if (cur) tx.set(n.id, key, next(cur));
        }
      }),
    );
  return (
    <>
      {shapes && (
        <section className="card" aria-labelledby="shape-heading">
          <div className="card-head">
            <h2 id="shape-heading" className="section-heading">
              {stars ? "Star" : nodes.every((n) => n.type === "POLYGON") ? "Polygon" : "Shape"}
            </h2>
          </div>
          <div className="field-grid">
            <NumberField
              id="prop-point-count"
              label={stars ? "Points" : "Count"}
              prefix="#"
              values={nodes.map((n) => n.pointCount ?? (n.type === "STAR" ? DEFAULT_STAR_POINTS : DEFAULT_POLYGON_POINTS))}
              min={3}
              max={60}
              readOnly={readOnly}
              onChange={(next) => setShape("pointCount", "Change count", (n) => Math.round(Math.max(3, Math.min(60, next(n.pointCount ?? (n.type === "STAR" ? DEFAULT_STAR_POINTS : DEFAULT_POLYGON_POINTS))))))}
            />
            {stars && (
              <NumberField
                id="prop-star-ratio"
                label="Ratio (percent)"
                prefix="%"
                values={nodes.map((n) => Math.round((n.innerRadius ?? DEFAULT_STAR_INNER_RADIUS) * 1000) / 10)}
                min={0}
                max={100}
                readOnly={readOnly}
                onChange={(next) => setShape("innerRadius", "Change ratio", (n) => Math.max(0, Math.min(1, next((n.innerRadius ?? DEFAULT_STAR_INNER_RADIUS) * 100) / 100)))}
              />
            )}
          </div>
        </section>
      )}
      {editing && <PointCard doc={doc} node={editing} points={edit?.points ?? []} readOnly={readOnly} onError={onError} />}
      {(canCombine || canFlatten) && (
        <section className="card" aria-labelledby="boolean-heading">
          <div className="card-head">
            <h2 id="boolean-heading" className="section-heading">
              {currentOp ? `Boolean · ${BOOLEAN_LABEL[currentOp]}` : "Combine"}
            </h2>
          </div>
          <div className="vector-actions" role="group" aria-label="Boolean operations and path commands">
            {canCombine &&
              BOOLEAN_OPERATIONS.map((op) => (
                <button
                  key={op}
                  type="button"
                  className="icon-button toggle-button"
                  aria-label={`${BOOLEAN_LABEL[op]} selection`}
                  title={`${BOOLEAN_LABEL[op]} selection`}
                  aria-pressed={currentOp === op}
                  disabled={readOnly}
                  onClick={() => guard(onError, () => {
                    const id = booleanSelection(doc, ids, op);
                    if (id) onSelect?.([id]);
                  })}
                >
                  <VIcon name={OP_ICON[op]} />
                </button>
              ))}
            {canFlatten && (
              <button type="button" className="icon-button" aria-label="Flatten (⌘E)" title="Flatten  ⌘E" disabled={readOnly} onClick={() => guard(onError, () => {
                const id = flattenSelection(doc, ids);
                if (id) onSelect?.([id]);
              })}>
                <VIcon name="flatten" />
              </button>
            )}
            {canFlatten && nodes.some((n) => n.strokeWeight > 0 && n.strokes.some((p) => p.visible)) && (
              <button
                type="button"
                className="icon-button"
                aria-label="Outline stroke (⌥⌘O)"
                title="Outline stroke  ⌥⌘O"
                disabled={readOnly}
                onClick={() => void outlineSelection(doc, ids).then((out) => out.length && onSelect?.(out), (e) => onError?.(e))}
              >
                <VIcon name="outline" />
              </button>
            )}
          </div>
        </section>
      )}
    </>
  );
}

/** The selected points in vector edit mode: their corner radius. */
function PointCard({ doc, node, points, readOnly, onError }: { doc: Document; node: ReadonlyNode; points: readonly number[]; readOnly: boolean; onError?: OnEditError | undefined }) {
  const net = node.vectorNetwork;
  const valid = points.filter((p) => net && p < net.vertices.length);
  return (
    <section className="card" aria-labelledby="points-heading">
      <div className="card-head">
        <h2 id="points-heading" className="section-heading">
          Vector points
        </h2>
        <span className="muted">{valid.length ? (valid.length === 1 ? "1 point" : `${valid.length} points`) : "No points selected"}</span>
      </div>
      {valid.length > 0 && net && (
        <div className="field-grid">
          <NumberField
            id="prop-point-radius"
            label="Corner radius"
            prefix="R"
            values={valid.map((p) => net.vertices[p]?.cornerRadius ?? 0)}
            min={0}
            max={1e5}
            readOnly={readOnly}
            onChange={(next) =>
              guard(onError, () => {
                const cur = doc.get(node.id)?.vectorNetwork;
                if (!cur) return;
                const r = Math.max(0, next(cur.vertices[valid[0] as number]?.cornerRadius ?? 0));
                const updated = setCornerRadius(cur as VectorNetwork, valid, r);
                doc.transact("Change corner radius", (tx) => setNetworkFitted(tx, doc, node.id, updated));
              })
            }
          />
        </div>
      )}
      <p className="muted">Drag points and handles; ⌥ breaks handle symmetry, ⌘ bends a segment, double-click a point to make it smooth or a corner. Esc or Enter leaves.</p>
    </section>
  );
}
