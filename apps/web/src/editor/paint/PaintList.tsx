import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { Document, ReadonlyNode } from "@illigma/core";
import type { Paint } from "@illigma/format";
import { ColorPicker, type PickerWhat } from "./ColorPicker";
import { cssColor, hexHasAlpha, parseHex, toHex } from "./color";
import { addPaint, EditSession, movedIndex, movePaint, paintAt, removePaint, sharedPaints, type PaintKey, type Patcher, type Phase } from "./edits";
import { InlineField, parsePercent, pct } from "./fields";
import { PaintIcon, type PaintIconName } from "./icons";
import { imageFiles, imagePaint, readImageFiles, refusalMessage, whenIdle } from "./image";
import { cssStops, isGradient, PAINT_TYPE_LABEL, paintAlpha, setSolid, solidAlpha, withPaintOpacity } from "./paints";
import { bindVariable } from "@illigma/core";
import { StyleButton } from "../styles/StyleButton";
import { Icon } from "../../ui/Icon";

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
  // Never leave a drag open when the card goes (selection changed mid-drag): an open edit holds autosave and swallows ⌘Z.
  useEffect(() => () => session.settle(), [session]);
  const ids = nodes.map((n) => n.id);
  const paints = sharedPaints(nodes, paintKey);
  const lower = noun.toLowerCase();
  /** The paint whose picker is open; `serial` names the picker, so it stays the same picker while its paint moves. */
  const [open, setOpen] = useState<{ index: number; anchor: HTMLElement; serial: number } | null>(null);
  const serial = useRef(0);
  const [dropAt, setDropAt] = useState<number | null>(null);
  /** Read out after a reorder (polite live region): "Fill moved to position 1 of 3, now Fill 1". */
  const [announce, setAnnounce] = useState("");
  const reorder = useRef<{ pointer: number; from: number; y: number; moved: boolean; released?: boolean } | null>(null);
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

  /**
   * Images dropped on the card: on a row, the first replaces that paint; elsewhere each becomes an image
   * paint on top, in the order dropped, all in one undo step (as Figma adds them). Files that can't be used
   * are listed in one message; the rest are still added.
   */
  const addImages = async (files: File[], replace: number | null) => {
    const { added, refused } = await readImageFiles(doc, files);
    const refusal = refusalMessage(refused);
    if (refusal) onError(new Error(refusal));
    const first = added[0];
    if (!first) return;
    // A drag that started while the files were read ends first; the images are added after it.
    await whenIdle(doc);
    if (replace !== null) run("once", `Change ${lower} image`, paintAt(paintKey, replace, (p) => imagePaint(first.hash, p)));
    else run("once", added.length === 1 ? `Add image ${lower}` : `Add ${added.length} image ${lower}s`, (n) => ({ [paintKey]: [...(n[paintKey] as Paint[]), ...added.map((a) => imagePaint(a.hash))] }));
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

  // ---- reorder (drag a swatch, or Alt+↑ / Alt+↓) ----
  const swatchOf = (i: number) => rows.current[i]?.querySelector<HTMLButtonElement>(".paint-swatch") ?? null;
  /**
   * Move paint `from` to `to` (one undo step). An open picker follows its
   * paint (and its swatch), and the new place is read out. Returns whether it moved.
   */
  const reorderPaint = (from: number, to: number): boolean => {
    const before = ids[0] ? doc.get(ids[0])?.[paintKey] : undefined;
    run("once", `Reorder ${lower}s`, movePaint(paintKey, from, to));
    if (!ids[0] || doc.get(ids[0])?.[paintKey] === before) return false; // nothing moved (a canvas drag holds the file)
    setOpen((o) => {
      if (!o) return o;
      const index = movedIndex(o.index, from, to);
      return index === o.index ? o : { ...o, index, anchor: swatchOf(index) ?? o.anchor };
    });
    setAnnounce(`${noun} moved to position ${rowNumber(to)} of ${count}, now ${noun} ${rowNumber(to)}`);
    return true;
  };
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
    if (!r || r.pointer !== e.pointerId || r.released) return;
    if (!r.moved) {
      reorder.current = null;
      return;
    }
    r.released = true;
    const to = targetAt(e.clientY);
    setDropAt(null);
    if (to !== null && to !== r.from) reorderPaint(r.from, to);
    // The click that follows this release must not open the picker.
    setTimeout(() => {
      reorder.current = null;
    });
  };
  /** Cancelled or capture lost before release: no reorder. */
  const swatchLost = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const r = reorder.current;
    if (!r || r.pointer !== e.pointerId || r.released) return;
    reorder.current = null;
    setDropAt(null);
  };
  const swatchKey = (i: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown") || readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    // Up the list is towards the top paint: a higher index.
    const to = e.key === "ArrowUp" ? i + 1 : i - 1;
    if (to < 0 || to >= count) return;
    if (!reorderPaint(i, to)) return;
    // Keep focus on the moved row's swatch.
    requestAnimationFrame(() => swatchOf(to)?.focus());
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
        <StyleButton doc={doc} nodes={nodes} role={paintKey} readOnly={readOnly} onError={onError} />
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
                        aria-description={count > 1 ? "Alt+Up and Alt+Down arrows move it up or down the list" : undefined}
                        aria-haspopup="dialog"
                        aria-expanded={open?.index === i}
                        style={swatchStyle(p)}
                        onPointerDown={swatchDown(i)}
                        onPointerMove={swatchMove}
                        onPointerUp={swatchUp}
                        onPointerCancel={swatchLost}
                        onLostPointerCapture={swatchLost}
                        onKeyDown={swatchKey(i)}
                        onClick={(e) => {
                          if (reorder.current?.moved) return;
                          const anchor = e.currentTarget;
                          setOpen((o) => (o?.index === i ? null : { index: i, anchor, serial: ++serial.current }));
                        }}
                      >
                        {p.type === "IMAGE" && <PaintIcon name="image" size={12} />}
                      </button>
                      {p.type === "SOLID" && nodes.length === 1 && nodes[0]?.boundVariables?.[`${paintKey}.${i}`] ? (
                        <span className="paint-bound" title="Bound to a variable">
                          <Icon name="hexagon" size={12} />
                          {doc.variables().variables.find((v) => v.id === nodes[0]?.boundVariables?.[`${paintKey}.${i}`]?.id)?.name ?? "Missing variable"}
                        </span>
                      ) : p.type === "SOLID" ? (
                        <InlineField
                          label={`${name} hex`}
                          className="paint-hex"
                          value={toHex(p.color)}
                          readOnly={readOnly}
                          parse={(t) => (parseHex(t) ? t : null)}
                          onCommit={(t) => {
                            const c = parseHex(String(t));
                            // #rgba and #rrggbbaa set the opacity too; otherwise the alpha shown stays (any alpha the colour carried is folded into the opacity).
                            if (c) run("once", `Change ${lower} colour`, paintAt(paintKey, i, (q) => (q.type === "SOLID" ? setSolid(q, c, hexHasAlpha(String(t)) ? c.a : solidAlpha(q)) : q)));
                          }}
                        />
                      ) : (
                        <span className="paint-type">{PAINT_TYPE_LABEL[p.type]}</span>
                      )}
                      <InlineField
                        label={`${name} opacity`}
                        className="paint-opacity"
                        value={pct(paintAlpha(p))}
                        readOnly={readOnly}
                        step={1}
                        parse={parsePercent}
                        onCommit={(v) =>
                          run(
                            "once",
                            `Change ${lower} opacity`,
                            paintAt(paintKey, i, (q) => (q.type === "SOLID" ? setSolid(q, q.color, (v as number) / 100) : withPaintOpacity(q, (v as number) / 100))),
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
                        // The open picker closes with its paint, or follows its paint down the list.
                        if (open?.index === i) setOpen(null);
                        else if (open && open.index > i) setOpen({ ...open, index: open.index - 1, anchor: swatchOf(open.index - 1) ?? open.anchor });
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
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
      {open && openPaint && (
        <ColorPicker
          key={open.serial}
          doc={doc}
          anchor={open.anchor}
          label={`${noun} ${rowNumber(open.index)} colour`}
          paint={openPaint}
          kind="paint"
          box={box}
          readOnly={readOnly}
          onPaint={(next, phase, what: PickerWhat) => run(phase, `Change ${lower} ${what}`, paintAt(paintKey, open.index, () => next))}
          onError={(m) => onError(new Error(m))}
          variables={
            nodes.length === 1 && nodes[0] && openPaint.type === "SOLID"
              ? {
                  node: nodes[0],
                  boundId: nodes[0].boundVariables?.[`${paintKey}.${open.index}`]?.id,
                  onBind: (id) => {
                    if (doc.live) return;
                    try {
                      doc.transact(id ? `Bind ${lower} to variable` : "Detach variable", (tx) => bindVariable(tx, doc, ids[0] as string, `${paintKey}.${open.index}`, id));
                    } catch (e) {
                      onError(e);
                    }
                  },
                }
              : undefined
          }
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
