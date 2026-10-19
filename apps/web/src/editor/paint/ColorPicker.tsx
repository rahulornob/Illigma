import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Document } from "@illigma/core";
import type { BlendMode, Color, GradientPaint, ImagePaint, Paint, PaintType } from "@illigma/format";
import { PAINT_TYPES } from "@illigma/format";
import { MenuButton, type MenuEntry } from "../../ui/Menu";
import { NumberField } from "../../ui/NumberField";
import {
  COLOR_FORMATS,
  cssColor,
  FORMAT_LABEL,
  formatChannels,
  fromChannels,
  hsvFor,
  hsvToRgb,
  parseHex,
  toHex,
  type ColorFormat,
  type Hsv,
} from "./color";
import { useDrag } from "./drag";
import type { Phase } from "./edits";
import { InlineField, parsePercent, pct } from "./fields";
import { GradientEditor } from "./GradientEditor";
import { PaintIcon } from "./icons";
import { ImageFill } from "./ImageFill";
import { BLEND_LABEL, BLEND_MENU, convertPaint, documentColors, isGradient, PAINT_TYPE_LABEL, recolorStop } from "./paints";
import { Popover } from "./Popover";

/** What a picker change edits, for the undo label ("Change fill colour"). */
export type PickerWhat = "colour" | "type" | "blend mode" | "gradient" | "gradient stop" | "image" | "image scale mode" | "tile scale";

/** The format the fields show, remembered while the app is open (Figma keeps it too). */
let lastFormat: ColorFormat = "HEX";

interface EyeDropperResult {
  sRGBHex: string;
}
type EyeDropperCtor = new () => { open(): Promise<EyeDropperResult> };
const eyeDropper = (): EyeDropperCtor | null => (typeof window !== "undefined" && "EyeDropper" in window ? (window as unknown as { EyeDropper: EyeDropperCtor }).EyeDropper : null);

/** A paint's colour, written back: a solid's colour keeps its own alpha and its opacity takes the picker's alpha. */
function withOpacity<P extends Paint>(p: P, alpha: number): P {
  const next = { ...p };
  if (alpha >= 1) delete next.opacity;
  else next.opacity = Math.max(0, alpha);
  return next;
}

export interface ColorPickerProps {
  doc: Document;
  anchor: HTMLElement | null;
  /** The dialog's name, e.g. "Fill 1 colour". */
  label: string;
  paint: Paint;
  /**
   * "paint": a fill or stroke (paint type, blend mode, gradients, images; a
   * solid's alpha is the paint's opacity). "color": a plain colour with its
   * own alpha (shadows).
   */
  kind: "paint" | "color";
  /** The layer's size, for the gradient angle. */
  box: { width: number; height: number };
  readOnly: boolean;
  onPaint(next: Paint, phase: Phase, what: PickerWhat): void;
  onError(message: string): void;
  onClose(refocus: boolean): void;
}

/**
 * The colour picker (Figma board "Colour picker", 15 · picker): Custom tab
 * with paint type and blend mode, the gradient's stops, a saturation and
 * brightness area, hue and opacity sliders, Hex / RGB / HSL / HSB fields,
 * the eyedropper (where the browser has one) and the colours used in this
 * file. The Variables tab is shown but not available yet (variables.md).
 *
 * Every drag is one undo step, every typed value or click one more.
 */
export function ColorPicker({ doc, anchor, label, paint, kind, box, readOnly, onPaint, onError, onClose }: ColorPickerProps) {
  const [stopState, setStop] = useState(0);
  const [hsvState, setHsv] = useState<Hsv | null>(null);
  const [format, setFormatState] = useState<ColorFormat>(lastFormat);
  const setFormat = (f: ColorFormat) => {
    lastFormat = f;
    setFormatState(f);
  };
  // Worked out once when the picker opens: the file doesn't change its colours while you pick one.
  const swatches = useMemo(() => documentColors(doc), [doc]);
  const id = useId();

  const gradient = isGradient(paint) ? paint : null;
  const stop = gradient ? Math.min(stopState, gradient.gradientStops.length - 1) : 0;

  /** The colour being edited, with the alpha the opacity slider shows. */
  const current: Color | null =
    paint.type === "SOLID"
      ? kind === "paint"
        ? { ...paint.color, a: paint.opacity ?? 1 }
        : paint.color
      : gradient
        ? (gradient.gradientStops[stop]?.color ?? null)
        : null;
  const hsv = current ? hsvFor(current, hsvState) : { h: 0, s: 0, v: 0 };

  const setColor = (c: Color, phase: Phase) => {
    if (readOnly) return;
    if (paint.type === "SOLID") {
      if (kind === "paint") onPaint(withOpacity({ ...paint, color: { r: c.r, g: c.g, b: c.b, a: paint.color.a } }, c.a), phase, "colour");
      else onPaint({ ...paint, color: { ...c } }, phase, "colour");
    } else if (gradient) {
      onPaint({ ...gradient, gradientStops: recolorStop(gradient.gradientStops as GradientPaint["gradientStops"], stop, c) }, phase, "colour");
    }
  };
  const setFromHsv = (next: Hsv, alpha: number, phase: Phase) => {
    setHsv(next);
    setColor(hsvToRgb(next, alpha), phase);
  };
  const alpha = current?.a ?? 1;

  // ---- drags ----
  const area = useRef<HTMLDivElement>(null);
  const hue = useRef<HTMLDivElement>(null);
  const opacity = useRef<HTMLDivElement>(null);
  /** The colour as a drag started, so each step is computed from it (the hue of a grey survives). */
  const startHsv = useRef(hsv);
  const areaDrag = useDrag(
    area,
    (at, phase) => {
      if (phase === "start") startHsv.current = hsv;
      setFromHsv({ h: startHsv.current.h, s: at.x, v: 1 - at.y }, alpha, phase);
    },
    readOnly,
  );
  const hueDrag = useDrag(
    hue,
    (at, phase) => {
      if (phase === "start") startHsv.current = hsv;
      setFromHsv({ ...startHsv.current, h: Math.min(359.9, at.x * 360) }, alpha, phase);
    },
    readOnly,
  );
  const alphaDrag = useDrag(
    opacity,
    (at, phase) => {
      if (phase === "start") startHsv.current = hsv;
      setFromHsv(startHsv.current, Math.round(at.x * 100) / 100, phase);
    },
    readOnly,
  );

  /** Arrow keys on a slider: 1 step (Shift: 10), Home / End to the ends. */
  const sliderKeys = (e: KeyboardEvent, apply: (delta: number | "min" | "max", vertical: boolean) => void) => {
    const big = e.shiftKey ? 10 : 1;
    let d: number | "min" | "max" | null = null;
    let vertical = false;
    if (e.key === "ArrowRight") d = big;
    else if (e.key === "ArrowLeft") d = -big;
    else if (e.key === "ArrowUp") (d = big), (vertical = true);
    else if (e.key === "ArrowDown") (d = -big), (vertical = true);
    else if (e.key === "Home") d = "min";
    else if (e.key === "End") d = "max";
    if (d === null || readOnly) return;
    e.preventDefault();
    apply(d, vertical);
  };
  const step = (v: number, d: number | "min" | "max", unit: number, max = 1) => (d === "min" ? 0 : d === "max" ? max : Math.min(max, Math.max(0, v + d * unit)));

  // ---- menus ----
  const typeEntries: MenuEntry<PaintType>[] = PAINT_TYPES.map((t) => ({ value: t, label: PAINT_TYPE_LABEL[t], checked: t === paint.type }));
  const blend = paint.blendMode && paint.blendMode !== "PASS_THROUGH" ? paint.blendMode : "NORMAL";
  const blendEntries: MenuEntry<BlendMode>[] = BLEND_MENU.slice(1).map((m) => (m === null ? { kind: "separator" } : { value: m, label: BLEND_LABEL[m], checked: m === blend }));

  const channelLabels: Record<Exclude<ColorFormat, "HEX">, [string, string, string]> = {
    RGB: ["Red", "Green", "Blue"],
    HSL: ["Hue", "Saturation", "Lightness"],
    HSB: ["Hue", "Saturation", "Brightness"],
  };
  const channelMax: Record<Exclude<ColorFormat, "HEX">, [number, number, number]> = { RGB: [255, 255, 255], HSL: [360, 100, 100], HSB: [360, 100, 100] };

  const pick = async () => {
    const Ctor = eyeDropper();
    if (!Ctor || readOnly) return;
    try {
      const r = await new Ctor().open();
      const c = parseHex(r.sRGBHex);
      if (c) {
        setHsv(null);
        setColor({ ...c, a: alpha }, "once");
      }
    } catch {
      // Cancelled (Escape): nothing to do.
    }
  };

  return (
    <Popover anchor={anchor} label={label} className="color-picker" onClose={onClose} initialFocus=".picker-focus-first">
      <div className="picker-head">
        <div className="picker-tabs" role="tablist" aria-label="Colour source">
          <button type="button" role="tab" aria-selected="true" className="picker-tab picker-focus-first" id={`${id}-custom`}>
            Custom
          </button>
          <button type="button" role="tab" aria-selected="false" aria-disabled="true" tabIndex={-1} className="picker-tab" title="Variables aren't available yet">
            Variables
          </button>
        </div>
        <button type="button" className="icon-button" aria-label="Close colour picker" title="Close (Esc)" onClick={() => onClose(true)}>
          <PaintIcon name="x" />
        </button>
      </div>

      {kind === "paint" && (
        <div className="picker-row">
          <MenuButton<PaintType>
            label={`Paint type: ${PAINT_TYPE_LABEL[paint.type]}`}
            title="Paint type"
            className="picker-select"
            disabled={readOnly}
            entries={typeEntries}
            onSelect={(t) => {
              setStop(0);
              onPaint(convertPaint(paint, t), "once", "type");
            }}
          >
            <span className="picker-select-label">{PAINT_TYPE_LABEL[paint.type]}</span>
            <PaintIcon name="chevron-down" size={12} />
          </MenuButton>
          <span className="picker-spacer" />
          <MenuButton<BlendMode>
            label={`Paint blend mode: ${BLEND_LABEL[blend]}`}
            className="icon-button"
            disabled={readOnly}
            entries={blendEntries}
            onSelect={(m) => {
              const next = { ...paint };
              if (m === "NORMAL") delete next.blendMode;
              else next.blendMode = m;
              onPaint(next, "once", "blend mode");
            }}
          >
            <PaintIcon name="blend" />
          </MenuButton>
        </div>
      )}

      {gradient && <GradientEditor paint={gradient} stop={stop} box={box} readOnly={readOnly} onStop={setStop} onPaint={(next, phase, what) => onPaint(next, phase, what)} />}

      {paint.type === "IMAGE" && <ImageFill doc={doc} paint={paint as ImagePaint} readOnly={readOnly} onPaint={(next, phase, what) => onPaint(next, phase, what)} onError={onError} />}

      {current && (
        <>
          <div
            ref={area}
            className="sv-area"
            role="slider"
            tabIndex={0}
            aria-label="Saturation and brightness"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(hsv.s * 100)}
            aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
            aria-disabled={readOnly || undefined}
            style={{ ["--hue" as string]: `hsl(${hsv.h} 100% 50%)` }}
            {...areaDrag}
            onKeyDown={(e) =>
              sliderKeys(e, (d, vertical) => {
                // ← → saturation, ↑ ↓ brightness.
                const s = vertical ? hsv.s : step(hsv.s, d, 0.01);
                const v = vertical ? step(hsv.v, d, 0.01) : hsv.v;
                setFromHsv({ h: hsv.h, s, v }, alpha, "once");
              })
            }
          >
            <span className="sv-thumb" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: cssColor(current, 1) }} />
          </div>
          <div className="picker-sliders">
            <div
              ref={hue}
              className="channel-slider hue-slider"
              role="slider"
              tabIndex={0}
              aria-label="Hue"
              aria-valuemin={0}
              aria-valuemax={360}
              aria-valuenow={Math.round(hsv.h)}
              aria-disabled={readOnly || undefined}
              {...hueDrag}
              onKeyDown={(e) => sliderKeys(e, (d) => setFromHsv({ ...hsv, h: step(hsv.h, d, 1, 359.9) }, alpha, "once"))}
            >
              <span className="slider-thumb" style={{ left: `${(hsv.h / 360) * 100}%`, background: `hsl(${hsv.h} 100% 50%)` }} />
            </div>
            <div
              ref={opacity}
              className="channel-slider alpha-slider"
              role="slider"
              tabIndex={0}
              aria-label="Opacity"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(alpha * 100)}
              aria-valuetext={pct(alpha)}
              aria-disabled={readOnly || undefined}
              style={{ ["--solid" as string]: cssColor(current, 1) }}
              {...alphaDrag}
              onKeyDown={(e) => sliderKeys(e, (d) => setFromHsv(hsv, Math.round(step(alpha, d, 0.01) * 100) / 100, "once"))}
            >
              <span className="slider-thumb" style={{ left: `${alpha * 100}%`, background: cssColor(current) }} />
            </div>
          </div>
          <div className="picker-row">
            <MenuButton<ColorFormat>
              label={`Colour format: ${FORMAT_LABEL[format]}`}
              title="Colour format"
              className="picker-select format-select"
              entries={COLOR_FORMATS.map((f) => ({ value: f, label: FORMAT_LABEL[f], checked: f === format }))}
              onSelect={setFormat}
            >
              <span className="picker-select-label">{FORMAT_LABEL[format]}</span>
              <PaintIcon name="chevron-down" size={12} />
            </MenuButton>
            {format === "HEX" && (
              <InlineField
                label="Hex colour"
                className="picker-field hex"
                value={toHex(current)}
                readOnly={readOnly}
                parse={(t) => (parseHex(t) ? t : null)}
                onCommit={(t) => {
                  const c = parseHex(String(t));
                  if (!c) return;
                  setHsv(null);
                  // Eight digits carry their own alpha; otherwise the alpha stays.
                  setColor({ ...c, a: String(t).replace("#", "").trim().length === 8 ? c.a : alpha }, "once");
                }}
              />
            )}
            {format !== "HEX" && <span className="picker-spacer" />}
            <InlineField
              label="Opacity percent"
              className="picker-field narrow"
              value={pct(alpha)}
              readOnly={readOnly}
              step={1}
              parse={parsePercent}
              onCommit={(v) => setFromHsv(hsv, (v as number) / 100, "once")}
            />
            {eyeDropper() && (
              <button type="button" className="icon-button" aria-label="Pick a colour from the screen" title="Eyedropper" disabled={readOnly} onClick={() => void pick()}>
                <PaintIcon name="pipette" />
              </button>
            )}
          </div>
          {format !== "HEX" && (
            <div className="picker-channels">
              {formatChannels(format, current, hsv).map((v, i) => (
                <NumberField
                  key={`${format}-${i}`}
                  id={`${id}-ch-${i}`}
                  label={channelLabels[format][i] as string}
                  prefix={(channelLabels[format][i] as string).charAt(0)}
                  values={[v]}
                  min={0}
                  max={channelMax[format][i] as number}
                  readOnly={readOnly}
                  onChange={(next) => {
                    const vals = formatChannels(format, current, hsv);
                    vals[i] = next(vals[i] as number);
                    const r = fromChannels(format, vals, alpha);
                    setFromHsv(r.hsv, alpha, "once");
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {swatches.length > 0 && current && (
        <div className="picker-swatches">
          <span className="picker-caption">In this file</span>
          <div className="swatch-grid">
            {swatches.map((c, i) => (
              <button
                key={i}
                type="button"
                className="doc-swatch"
                aria-label={`Use ${toHex(c)}${c.a < 1 ? ` at ${pct(c.a)}` : ""}`}
                title={`${toHex(c)}${c.a < 1 ? ` · ${pct(c.a)}` : ""}`}
                disabled={readOnly}
                style={{ ["--swatch" as string]: cssColor(c) }}
                onClick={() => {
                  setHsv(null);
                  setColor({ ...c }, "once");
                }}
              />
            ))}
          </div>
        </div>
      )}
    </Popover>
  );
}
