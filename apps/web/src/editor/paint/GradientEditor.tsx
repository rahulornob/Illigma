import { useEffect, useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { ColorStop, GradientPaint } from "@illigma/format";
import { toHex } from "./color";
import type { Phase } from "./edits";
import { InlineField, pct } from "./fields";
import { PaintIcon } from "./icons";
import { addStop, cssStops, flipStops, gradientAngle, MIN_STOPS, moveStop, removeStop, rotateGradient, sortStops, stopKeys } from "./paints";
import { fractionIn } from "./drag";

/** What a gradient edit changed, for the undo label. */
export type GradientWhat = "gradient stop" | "gradient";

/** How far (CSS px) a pressed stop must move before it is dragged; less is a click, which only selects it. */
const STOP_DRAG_START = 3;

/**
 * The gradient's stop bar and settings (Figma's gradient row in the colour
 * picker): click the bar to add a stop, drag a stop to move it (one undo
 * step), select a stop to edit its colour below. Keyboard: Tab to a stop,
 * ← → move it 1 % (Shift: 10 %), Home / End to the ends, Delete removes it
 * (a gradient keeps two). Below: the stop's position, the angle, rotate 90°
 * and flip.
 */
export function GradientEditor({
  paint,
  stop,
  box,
  readOnly,
  onStop,
  onPaint,
}: {
  paint: GradientPaint;
  /** The selected stop (index into `gradientStops`). */
  stop: number;
  /** The layer's size, so the angle is the one seen on the canvas. */
  box: { width: number; height: number };
  readOnly: boolean;
  onStop(index: number): void;
  onPaint(next: GradientPaint, phase: Phase, what: GradientWhat): void;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const stops = paint.gradientStops as ColorStop[];
  /**
   * A press on a stop: where it started, the pointer's offset from the stop's
   * centre (so the stop doesn't jump to the pointer), and whether it has moved
   * far enough to be a drag. A press that never moves only selects.
   */
  const drag = useRef<{ pointer: number; stops: ColorStop[]; keys: number[]; index: number; x0: number; offset: number; moving: boolean; last: number } | null>(null);
  const order = sortStops(stops);
  const selected = stops[stop];

  // ---- stable keys: a stop keeps its handle (focus, pointer capture) while moves re-sort the list ----
  const serial = useRef(0);
  const keyed = useRef<{ json: string; keys: number[] }>({ json: "", keys: [] });
  const pending = useRef<{ json: string; keys: number[] } | null>(null);
  const json = JSON.stringify(stops);
  if (keyed.current.json !== json) {
    const p = pending.current;
    if (p && p.json === json) keyed.current = { json, keys: p.keys };
    else if (keyed.current.keys.length === stops.length) keyed.current = { json, keys: keyed.current.keys };
    else keyed.current = { json, keys: stops.map(() => serial.current++) };
    pending.current = null;
  }
  const keys = keyed.current.keys;

  const withStops = (next: ColorStop[]): GradientPaint => ({ ...paint, gradientStops: next });
  /** Write `next`, with the keys that follow its stops. */
  const write = (next: ColorStop[], nextKeys: number[], phase: Phase, what: GradientWhat = "gradient stop") => {
    pending.current = { json: JSON.stringify(next), keys: nextKeys };
    onPaint(withStops(next), phase, what);
  };

  const move = (index: number, position: number, phase: Phase, from = stops, fromKeys = keys) => {
    const r = moveStop(from, index, position);
    write(r.stops, stopKeys.move(fromKeys, index, r.index), phase);
    onStop(r.index);
  };

  const remove = (index: number) => {
    const r = removeStop(stops, index);
    if (!r || readOnly) return;
    write(r.stops, stopKeys.remove(keys, index), "once");
    onStop(r.index);
  };

  const add = (position: number) => {
    if (readOnly) return;
    const r = addStop(stops, position);
    write(r.stops, stopKeys.insert(keys, r.index, serial.current++), "once");
    onStop(r.index);
  };

  /** "Add stop": halfway between the selected stop and the next one (or the one before, at the end). */
  const addNext = () => {
    const i = order.indexOf(selected as ColorStop);
    const a = order[i] ?? order[0];
    const b = order[i + 1] ?? order[i - 1] ?? a;
    add(((a?.position ?? 0) + (b?.position ?? 1)) / 2);
  };

  const onBarDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.target !== bar.current || e.button !== 0 || readOnly) return;
    add(fractionIn(bar.current, e.clientX, e.clientY).x);
  };

  /** The stop position under the pointer, keeping the offset it was grabbed at. */
  const positionAt = (clientX: number, offset: number) => (bar.current ? fractionIn(bar.current, clientX - offset, 0).x : 0);
  const stopDown = (index: number) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    onStop(index);
    if (readOnly) return;
    e.preventDefault();
    e.currentTarget.focus();
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    const s = stops[index];
    drag.current = { pointer: e.pointerId, stops: [...stops], keys: [...keys], index, x0: e.clientX, offset: e.clientX - (r.left + r.width / 2), moving: false, last: s?.position ?? 0 };
  };
  const stopMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId || !bar.current) return;
    if (!d.moving) {
      // A click is not a drag: nothing changes (and no undo step) until the pointer has moved a few pixels.
      if (Math.abs(e.clientX - d.x0) < STOP_DRAG_START) return;
      d.moving = true;
      write(d.stops, d.keys, "start");
    }
    d.last = positionAt(e.clientX, d.offset);
    move(d.index, d.last, "move", d.stops, d.keys);
  };
  /** Release: the drag is one undo step; a press that never moved only selected the stop. */
  const stopUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    drag.current = null;
    if (d.moving) move(d.index, bar.current ? positionAt(e.clientX, d.offset) : d.last, "end", d.stops, d.keys);
  };
  /** Cancelled, capture lost or unmounted mid-drag: keep the drag where it last was, as one step. */
  const stopAbandon = (e: ReactPointerEvent<HTMLButtonElement> | null) => {
    const d = drag.current;
    if (!d || (e && d.pointer !== e.pointerId)) return;
    drag.current = null;
    if (d.moving) move(d.index, d.last, "end", d.stops, d.keys);
  };
  const abandon = useRef(stopAbandon);
  abandon.current = stopAbandon;
  useEffect(() => () => abandon.current(null), []);

  const stopKey = (index: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const s = stops[index];
    if (!s || readOnly) return;
    const step = e.shiftKey ? 0.1 : 0.01;
    let to: number | null = null;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") to = s.position - step;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") to = s.position + step;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = 1;
    else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      remove(index);
      return;
    } else return;
    e.preventDefault();
    move(index, to, "once");
  };

  const angle = gradientAngle(paint, box.width, box.height);
  const rotate = (deg: number) => onPaint({ ...paint, gradientTransform: rotateGradient(paint, deg, box.width, box.height) }, "once", "gradient");

  return (
    <div className="gradient-editor">
      <div className="stop-bar-wrap">
        <div ref={bar} className="stop-bar" style={{ ["--stops" as string]: `linear-gradient(90deg, ${cssStops(stops)})` }} onPointerDown={onBarDown} title="Click to add a stop">
          {/* In key order, not position order: a moved stop stays the same element in the same place in the page, so it keeps focus and pointer capture. */}
          {stops
            .map((s, i) => ({ s, i, key: keys[i] ?? -1 - i }))
            .sort((a, b) => a.key - b.key)
            .map(({ s, i, key }) => {
            const rank = order.indexOf(s) + 1;
            return (
              <button
                key={key}
                type="button"
                className="stop-handle"
                role="slider"
                aria-label={`Gradient stop ${rank} of ${stops.length}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(s.position * 100)}
                aria-valuetext={`${pct(s.position)}, ${toHex(s.color)}`}
                aria-pressed={undefined}
                data-selected={i === stop || undefined}
                style={{ left: `${s.position * 100}%`, ["--stop" as string]: `rgb(${Math.round(s.color.r * 255)}, ${Math.round(s.color.g * 255)}, ${Math.round(s.color.b * 255)})` }}
                onFocus={() => onStop(i)}
                onPointerDown={stopDown(i)}
                onPointerMove={stopMove}
                onPointerUp={stopUp}
                onPointerCancel={stopAbandon}
                onLostPointerCapture={stopAbandon}
                onKeyDown={stopKey(i)}
              />
            );
          })}
        </div>
      </div>
      <div className="picker-row">
        <InlineField
          label="Stop position"
          className="picker-field narrow"
          value={selected ? pct(selected.position) : ""}
          readOnly={readOnly}
          step={1}
          parse={(t) => {
            const n = Number.parseFloat(t.replace("%", "").replace(",", "."));
            return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) / 100 : null;
          }}
          onCommit={(v) => move(stop, v as number, "once")}
        />
        <InlineField
          label="Gradient angle"
          className="picker-field narrow"
          value={`${angle}°`}
          readOnly={readOnly}
          step={1}
          parse={(t) => {
            const n = Number.parseFloat(t.replace("°", "").replace(",", "."));
            return Number.isFinite(n) ? n : null;
          }}
          onCommit={(v) => rotate(v as number)}
        />
        <span className="picker-spacer" />
        <button type="button" className="icon-button" aria-label="Add gradient stop" title="Add stop" disabled={readOnly} onClick={addNext}>
          <PaintIcon name="plus" />
        </button>
        <button type="button" className="icon-button" aria-label="Remove gradient stop" title="Remove stop (Delete)" disabled={readOnly || stops.length <= MIN_STOPS} onClick={() => remove(stop)}>
          <PaintIcon name="minus" />
        </button>
        <button type="button" className="icon-button" aria-label="Rotate gradient 90°" title="Rotate 90°" disabled={readOnly} onClick={() => rotate(angle + 90)}>
          <PaintIcon name="rotate-cw" />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Flip gradient"
          title="Flip"
          disabled={readOnly}
          onClick={() => {
            const flipped = flipStops(stops);
            write(flipped, [...keys].reverse(), "once", "gradient");
            const s = stops[stop];
            if (s) onStop(Math.max(0, flipped.findIndex((f) => Math.abs(f.position - (1 - s.position)) < 1e-6 && f.color === s.color)));
          }}
        >
          <PaintIcon name="arrow-left-right" />
        </button>
      </div>
    </div>
  );
}
