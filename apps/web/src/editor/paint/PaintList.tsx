import { useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { Document, ReadonlyNode } from "@illigma/core";
import type { Paint } from "@illigma/format";
import { ColorPicker, type PickerWhat } from "./ColorPicker";
import { cssColor, parseHex, toHex } from "./color";
import { addPaint, EditSession, movePaint, paintAt, removePaint, sharedPaints, type PaintKey, type Patcher, type Phase } from "./edits";
import { InlineField, parsePercent, pct } from "./fields";
import { PaintIcon, type PaintIconName } from "./icons";
import { addImageFile, imageFiles, imagePaint } from "./image";
import { cssStops, isGradient, PAINT_TYPE_LABEL } from "./paints";

/** The swatch's look (`--paint`, drawn over a checkerboard): the colour, the gradient, or none for an image (a glyph shows). */
export function swatchStyle(p: Paint): Record<string, string> {
  if (p.type === "SOLID") {
    const c = cssColor(p.color, p.color.a * (p.opacity ?? 1));
    return { "--paint": `linear-gradient(${c}, ${c})` };
  }
  if (isGradient(p)) return { "--paint": `linear-gradient(90deg, ${cssStops(p.gradientStops)})` };
  return {};
}

const DRAG_START = 4;

/**
 * A card with a list of paints (Fill, Stroke): + adds one on top, each row
 * has its swatch (opens the colour picker; drag it up or down to reorder,
 * or Alt+↑ / Alt+↓ with the keyboard), its hex (solids) or type, its
 * opacity, show / hide and remove. Rows list the top paint first, as in
 * Figma. With several layers whose paints differ the card says Mixed, and +
 * replaces them. Image files dropped on a row replace its paint; dropped
 * elsewhere on the card they are added as image paints.
 */
export function PaintList({
  doc,
  nodes,
  paintKey,
  noun,
  icon,
  readOnly,
  onError,
  children,
}: {
  doc: Document;
  nodes: readonly ReadonlyNode[];
  paintKey: PaintKey;
  /** "Fill" or "Stroke": the card's title and the rows' names ("Fill 1"). */
  noun: string;
  icon: PaintIconName;
  readOnly: boolean;
  onError(e: unknown): void;
  /** Settings under the rows (the stroke's weight and position). */
  children?: ReactNode;
}) {
  const session = useMemo(() => new EditSession(doc), [doc]);
  const ids = nodes.map((n) => n.id);
  const paints = sharedPaints(nodes, paintKey);
  const lower = noun.toLowerCase();
  const [open, setOpen] = useState<{ index: number; anchor: HTMLElement } | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const reorder = useRef<{ pointer: number; from: number; y: number; moved: boolean } | null>(null);
  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const headingId = `${paintKey}-heading`;

  const run = (phase: Phase, label: string, patch: Patcher) => {
    try {
      session.change(phase, label, ids, patch);
    } catch (e) {
      session.cancel();
      onError(e);
    }
  };

  const count = paints?.length ?? 0;
  /** Row number for array index `i`: the top paint (last in the list) is 1. */
  const rowNumber = (i: number) => count - i;

  const addImages = async (files: File[], replace: number | null) => {
    for (const file of files) {
      try {
        const added = await addImageFile(doc, file);
        if (replace !== null) run("once", `Change ${lower} image`, paintAt(paintKey, replace, (p) => imagePaint(added.hash, p)));
        else run("once", `Add image ${lower}`, (n) => ({ [paintKey]: [...(n[paintKey] as Paint[]), imagePaint(added.hash)] }));
      } catch (e) {
        onError(e);
      }
    }
  };
  const fileDrag = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes("Files");
  const dropFiles = (replace: number | null) => (e: DragEvent) => {
    if (!fileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    if (readOnly) return;
    const files = imageFiles(e.dataTransfer.files);
    if (!files.length) {
      onError(new Error("Only PNG, JPEG, WebP and GIF images can be used as a fill"));
      return;
    }
    void addImages(replace === null ? files : files.slice(0, 1), replace);
  };

  // ---- reorder by dragging a swatch ----
  const targetAt = (clientY: number): number | null => {
    let best: number | null = null;
    rows.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (clientY >= r.top - 2 && clientY <= r.bottom + 2) best = i;
    });
    return best;
  };
  const swatchDown = (i: number) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || readOnly || count < 2) return;
    reorder.current = { pointer: e.pointerId, from: i, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const swatchMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const r = reorder.current;
    if (!r || r.pointer !== e.pointerId) return;
    if (!r.moved && Math.abs(e.clientY - r.y) < DRAG_START) return;
    r.moved = true;
    setDropAt(targetAt(e.clientY));
  };
  const swatchUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const r = reorder.current;
    if (!r || r.pointer !== e.pointerId) return;
    if (!r.moved) {
      reorder.current = null;
      return;
    }
    const to = targetAt(e.clientY);
    setDropAt(null);
    if (to !== null && to !== r.from) run("once", `Reorder ${lower}s`, movePaint(paintKey, r.from, to));
    // The click that follows this release must not open the picker.
    setTimeout(() => {
      reorder.current = null;
    });
  };
  const swatchKey = (i: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown") || readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    // Up the list is towards the top paint: a higher index.
    const to = e.key === "ArrowUp" ? i + 1 : i - 1;
    if (to < 0 || to >= count) return;
    run("once", `Reorder ${lower}s`, movePaint(paintKey, i, to));
    // Keep focus on the moved row's swatch.
    requestAnimationFrame(() => rows.current[to]?.querySelector<HTMLButtonElement>(".paint-swatch")?.focus());
  };

  const box = nodes[0] ? { width: nodes[0].width, height: nodes[0].height } : { width: 100, height: 100 };
  const openPaint = open && paints ? paints[open.index] : undefined;

  return (
    <section className="card paint-card" aria-labelledby={headingId} onDragOver={(e) => fileDrag(e) && e.preventDefault()} onDrop={dropFiles(null)}>
      <div className="card-head">
        <span className="card-icon">
          <PaintIcon name={icon} />
        </span>
        <h2 id={headingId} className="section-heading card-title">
          {noun}
        </h2>
        <button
          type="button"
          className="icon-button"
          aria-label={paints === null ? `Replace mixed ${lower}s` : `Add ${lower}`}
          title={`Add ${lower}`}
          disabled={readOnly}
          onClick={() => run("once", `Add ${lower}`, addPaint(paintKey, paints === null))}
        >
          <PaintIcon name="plus" />
        </button>
      </div>
      {paints === null ? (
        <p className="muted paint-mixed">Click + to replace mixed content</p>
      ) : (
        paints.length > 0 && (
          <div className="paint-rows">
            {paints
              .map((p, i) => ({ p, i }))
              .reverse()
              .map(({ p, i }) => {
                const n = rowNumber(i);
                const name = `${noun} ${n}`;
                return (
                  <div
                    key={i}
                    ref={(el) => {
                      rows.current[i] = el;
                    }}
                    className="paint-row"
                    data-hidden={!p.visible || undefined}
                    data-drop={dropAt === i || undefined}
                    onDragOver={(e) => fileDrag(e) && e.preventDefault()}
                    onDrop={dropFiles(i)}
                  >
                    <div className="field paint-field">
                      <button
                        type="button"
                        className="paint-swatch"
                        aria-label={`${name}: ${p.type === "SOLID" ? toHex(p.color) : PAINT_TYPE_LABEL[p.type]}. Open colour picker`}
                        title={`Edit ${lower} (drag or Alt+↑ ↓ to reorder)`}
                        aria-haspopup="dialog"
                        aria-expanded={open?.index === i}
                        style={swatchStyle(p)}
                        onPointerDown={swatchDown(i)}
                        onPointerMove={swatchMove}
                        onPointerUp={swatchUp}
                        onPointerCancel={swatchUp}
                        onKeyDown={swatchKey(i)}
                        onClick={(e) => {
                          if (reorder.current?.moved) return;
                          const anchor = e.currentTarget;
                          setOpen((o) => (o?.index === i ? null : { index: i, anchor }));
                        }}
                      >
                        {p.type === "IMAGE" && <PaintIcon name="image" size={12} />}
                      </button>
                      {p.type === "SOLID" ? (
                        <InlineField
                          label={`${name} hex`}
                          className="paint-hex"
                          value={toHex(p.color)}
                          readOnly={readOnly}
                          parse={(t) => (parseHex(t) ? t : null)}
                          onCommit={(t) => {
                            const c = parseHex(String(t));
                            if (c) run("once", `Change ${lower} colour`, paintAt(paintKey, i, (q) => (q.type === "SOLID" ? { ...q, color: { ...c, a: q.color.a } } : q)));
                          }}
                        />
                      ) : (
                        <span className="paint-type">{PAINT_TYPE_LABEL[p.type]}</span>
                      )}
                      <InlineField
                        label={`${name} opacity`}
                        className="paint-opacity"
                        value={pct(p.opacity ?? 1)}
                        readOnly={readOnly}
                        step={1}
                        parse={parsePercent}
                        onCommit={(v) =>
                          run(
                            "once",
                            `Change ${lower} opacity`,
                            paintAt(paintKey, i, (q) => {
                              const next = { ...q };
                              if ((v as number) >= 100) delete next.opacity;
                              else next.opacity = (v as number) / 100;
                              return next;
                            }),
                          )
                        }
                      />
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={p.visible ? `Hide ${lower} ${n}` : `Show ${lower} ${n}`}
                      title={p.visible ? "Hide" : "Show"}
                      disabled={readOnly}
                      onClick={() => run("once", p.visible ? `Hide ${lower}` : `Show ${lower}`, paintAt(paintKey, i, (q) => ({ ...q, visible: !q.visible })))}
                    >
                      <PaintIcon name={p.visible ? "eye" : "eye-off"} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove ${lower} ${n}`}
                      title={`Remove ${lower}`}
                      disabled={readOnly}
                      onClick={() => {
                        if (open?.index === i) setOpen(null);
                        run("once", `Remove ${lower}`, removePaint(paintKey, i));
                      }}
                    >
                      <PaintIcon name="minus" />
                    </button>
                  </div>
                );
              })}
          </div>
        )
      )}
      {paints && paints.length > 0 && children}
      {open && openPaint && (
        <ColorPicker
          key={open.index}
          doc={doc}
          anchor={open.anchor}
          label={`${noun} ${rowNumber(open.index)} colour`}
          paint={openPaint}
          kind="paint"
          box={box}
          readOnly={readOnly}
          onPaint={(next, phase, what: PickerWhat) => run(phase, `Change ${lower} ${what}`, paintAt(paintKey, open.index, () => next))}
          onError={(m) => onError(new Error(m))}
          onClose={(refocus) => {
            session.settle();
            const anchor = open.anchor;
            setOpen(null);
            if (refocus && anchor.isConnected) anchor.focus();
          }}
        />
      )}
    </section>
  );
}
