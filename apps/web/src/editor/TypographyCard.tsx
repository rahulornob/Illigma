import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Document, ReadonlyNode } from "@illigma/core";
import type { TextAlignHorizontal, TextAlignVertical, TextAutoResize } from "@illigma/format";
import type { TextEngine } from "@illigma/renderer";
import { Icon, type IconName } from "../ui/Icon";
import { MenuButton } from "../ui/Menu";
import { NumberField } from "../ui/NumberField";
import { guard, type OnEditError } from "./layout-props";
import { BUNDLED_FAMILY, currentTextEngine, HIDDEN_FAMILIES, INTER_STYLES, whenTextEngine } from "./text/engine";
import { FontPicker } from "./text/FontPicker";
import { ensureLocalFamily, loadLocalFontsIfGranted, useLocalFonts } from "./text/local-fonts";
import {
  alignHorizontalOf,
  alignVerticalOf,
  familiesInFile,
  fontSizeOf,
  letterSpacingIn,
  letterSpacingView,
  lineHeightIn,
  lineHeightView,
  resizeModeOf,
  resizePatch,
  setTextProps,
  whenIdle,
  typedLineHeight,
  type MetricUnit,
  type TextPatch,
} from "./text/props";

const same = <T,>(values: readonly T[]): T | undefined => (values.every((v) => v === values[0]) ? values[0] : undefined);

/**
 * Accessible names never say "width" or "height": the W and H fields own those words
 * (tooltips can: `title` shows Figma's names).
 */
type Option<T> = { value: T; label: string; title?: string; icon: IconName };

const H_ALIGN: Option<TextAlignHorizontal>[] = [
  { value: "LEFT", label: "Align left", icon: "align-left" },
  { value: "CENTER", label: "Align center", icon: "align-center" },
  { value: "RIGHT", label: "Align right", icon: "align-right" },
  { value: "JUSTIFIED", label: "Justify", icon: "align-justify" },
];
const V_ALIGN: Option<TextAlignVertical>[] = [
  { value: "TOP", label: "Align top", icon: "align-vertical-justify-start" },
  { value: "CENTER", label: "Align middle", icon: "align-vertical-justify-center" },
  { value: "BOTTOM", label: "Align bottom", icon: "align-vertical-justify-end" },
];
const RESIZE: Option<TextAutoResize>[] = [
  { value: "WIDTH_AND_HEIGHT", label: "Grow horizontally", title: "Auto width", icon: "move-horizontal" },
  { value: "HEIGHT", label: "Grow vertically", title: "Auto height", icon: "move-vertical" },
  { value: "NONE", label: "Fixed size", icon: "square" },
];
const FONT_SIZES = [10, 11, 12, 13, 14, 16, 20, 24, 32, 36, 40, 48, 64, 96, 128];
const UNIT_SUFFIX: Record<MetricUnit, string> = { PIXELS: "px", PERCENT: "%" };

/** Re-render when the text engine loads or gets fonts (fonts on this computer). */
function useTextEngine(): TextEngine | null {
  const [, setVersion] = useState(0);
  useEffect(() => {
    let unsubscribe = () => {};
    const stop = whenTextEngine((e) => {
      setVersion((v) => v + 1);
      unsubscribe = e.subscribe(() => setVersion((v) => v + 1));
    });
    return () => {
      stop();
      unsubscribe();
    };
  }, []);
  return currentTextEngine();
}

/** A row of icon buttons where one is chosen (alignment, resize mode). Arrow keys move and choose. */
function Segments<T extends string>({ label, options, value, disabled, onChange }: { label: string; options: Option<T>[]; value: T | undefined; disabled: boolean; onChange(v: T): void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = options.findIndex((o) => o.value === value);
  const onKey = (i: number) => (e: KeyboardEvent) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    e.stopPropagation(); // arrows nudge layers otherwise
    const j = (i + step + options.length) % options.length;
    refs.current[j]?.focus();
    onChange((options[j] as (typeof options)[number]).value);
  };
  return (
    <div className="seg-group" role="radiogroup" aria-label={label}>
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          className="seg"
          aria-checked={o.value === value}
          aria-label={o.label}
          title={o.title ?? o.label}
          tabIndex={i === (current < 0 ? 0 : current) ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          onKeyDown={onKey(i)}
        >
          <Icon name={o.icon} />
        </button>
      ))}
    </div>
  );
}

/**
 * The Typography card (Figma board "Card / Typography", 96:58849): font
 * family (font picker), style, size, line height (Auto, px or %), letter
 * spacing (px or %), horizontal and vertical alignment and the resize mode,
 * for every selected text layer (whole layers: mixed styles inside one text
 * aren't supported yet). Values that differ show "Mixed". Each change is
 * one undo step.
 */
export function TypographyCard({ doc, nodes, readOnly, onError }: { doc: Document; nodes: readonly ReadonlyNode[]; readOnly: boolean; onError?: OnEditError | undefined }) {
  const engine = useTextEngine();
  const local = useLocalFonts();
  const [picking, setPicking] = useState(false);
  const fontButton = useRef<HTMLButtonElement>(null);
  const ids = nodes.map((n) => n.id);
  const byId = (id: string) => doc.get(id) as ReadonlyNode;

  useEffect(() => void loadLocalFontsIfGranted(), []);
  // A family the file names that is on this computer: load it, so the text draws in it.
  const family = same(nodes.map((n) => n.fontFamily ?? BUNDLED_FAMILY));
  useEffect(() => {
    if (engine && family && local.status === "ready") void ensureLocalFamily(engine, family);
  }, [engine, family, local]);

  const closePicker = useCallback((refocus: boolean) => {
    setPicking(false);
    if (refocus) fontButton.current?.focus();
  }, []);

  if (!nodes.length) return null;

  const set = (patch: TextPatch | ((n: ReadonlyNode) => TextPatch), label: string) => setTextProps(doc, ids, patch, label);
  const command = (patch: TextPatch | ((n: ReadonlyNode) => TextPatch), label: string) => guard(onError, () => set(patch, label));

  const available = (f: string) => !engine || engine.hasFamily(f);
  const missing = family && !available(family) ? family : (nodes.map((n) => n.fontFamily ?? BUNDLED_FAMILY).find((f) => !available(f)) ?? null);
  const style = same(nodes.map((n) => n.fontStyle ?? "Regular"));
  const styles = family && engine?.hasFamily(family) ? engine.styles(family) : family === BUNDLED_FAMILY ? [...INTER_STYLES] : [];
  const styleOptions = style && !styles.includes(style) ? [style, ...styles] : styles;

  const lineViews = nodes.map(lineHeightView);
  const lineUnit = same(lineViews.map((v) => v.unit));
  const spacingViews = nodes.map(letterSpacingView);
  const spacingUnit = same(spacingViews.map((v) => v.unit));

  const pickFamily = (next: string) => {
    setPicking(false);
    fontButton.current?.focus();
    const apply = () =>
      command((n) => {
        // Keep the style when the new family has it; else Regular (or its first style).
        const have = engine?.hasFamily(next) ? engine.styles(next) : [];
        const keep = have.includes(n.fontStyle ?? "Regular") ? n.fontStyle : have.includes("Regular") || !have.length ? "Regular" : have[0];
        return { fontFamily: next, fontStyle: keep };
      }, `Font: ${next}`);
    // A font on this computer is read first, so layout measures the text in it.
    if (engine && !engine.hasFamily(next)) void ensureLocalFamily(engine, next).then(() => applyWhenIdle(next, apply));
    else apply();
  };

  /**
   * The font loaded after a moment: an edit may have started meanwhile (typing, a drag), and the
   * document takes no other edit until it ends. Apply the font then, never drop it silently.
   */
  const applyWhenIdle = (next: string, apply: () => boolean | undefined) => {
    if (apply() !== false) return;
    whenIdle(
      doc,
      () => {
        if (!ids.some((id) => doc.has(id))) onError?.(new Error(`The text layer was deleted before ${next} finished loading.`));
        else apply();
      },
      () => onError?.(new Error(`${next} loaded while another edit kept going, so it wasn't applied. Pick it again.`)),
    );
  };

  return (
    <section className="card typography-card" aria-labelledby="typography-heading">
      <div className="card-head">
        <span className="card-icon">
          <Icon name="type" />
        </span>
        <h2 id="typography-heading" className="section-heading card-title">
          Typography
        </h2>
      </div>

      <div className="type-row">
        <button
          ref={fontButton}
          type="button"
          className="select-button"
          aria-haspopup="dialog"
          aria-expanded={picking}
          aria-label={`Font: ${family ?? "Mixed"}${missing ? ` (${missing} is not installed)` : ""}`}
          disabled={readOnly}
          onClick={() => setPicking((p) => !p)}
        >
          {missing && (
            <span className="font-warn">
              <Icon name="triangle-alert" size={12} />
            </span>
          )}
          <span className="select-value">{family ?? "Mixed"}</span>
          <Icon name="chevron-down" />
        </button>
      </div>
      {missing && !picking && (
        <p className="type-missing" role="status">
          {missing} is not installed. The text uses {BUNDLED_FAMILY} until you pick a font.
        </p>
      )}
      {picking && (
        <FontPicker
          anchor={fontButton}
          current={family}
          inFile={familiesInFile(doc).filter((f) => !HIDDEN_FAMILIES.has(f))}
          bundled={[BUNDLED_FAMILY]}
          local={local}
          missing={missing}
          onPick={pickFamily}
          onClose={closePicker}
        />
      )}

      <div className="type-row type-pair">
        <div className="select">
          <label className="sr-only" htmlFor="prop-font-style">
            Font style
          </label>
          <select
            id="prop-font-style"
            className="select-input"
            value={style ?? ""}
            disabled={readOnly}
            onChange={(e) => command({ fontStyle: e.target.value }, `Font style: ${e.target.value}`)}
          >
            {!style && (
              <option value="" disabled>
                Mixed
              </option>
            )}
            {styleOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Icon name="chevron-down" />
        </div>
        <NumberField
          key={`size-${ids.join()}`}
          id="prop-font-size"
          label="Font size"
          prefix={<Icon name="a-large-small" size={12} />}
          values={nodes.map(fontSizeOf)}
          min={1}
          max={10000}
          readOnly={readOnly}
          onChange={(next) => set((n) => ({ fontSize: next(fontSizeOf(n)) }), "Change font size")}
          suffix={
            <MenuButton
              label="Preset sizes"
              title="Preset sizes"
              className="field-menu"
              disabled={readOnly}
              entries={FONT_SIZES.map((s) => ({ value: s, label: String(s), checked: nodes.every((n) => fontSizeOf(n) === s) }))}
              onSelect={(s) => command({ fontSize: s }, "Change font size")}
            >
              <Icon name="chevron-down" size={12} />
            </MenuButton>
          }
        />
      </div>

      <div className="type-row type-pair">
        <NumberField
          key={`lh-${ids.join()}`}
          id="prop-line-height"
          label="Line spacing"
          prefix={<Icon name="arrow-up-down" size={12} />}
          values={lineViews.map((v) => ("value" in v ? v.value : 0))}
          text={lineUnit === "AUTO" ? "Auto" : undefined}
          min={0}
          max={10000}
          readOnly={readOnly}
          onText={(t) => {
            if (t.toLowerCase() !== "auto") return false;
            set({ lineHeight: undefined }, "Line height: auto");
            return true;
          }}
          onChange={(next) => set((n) => ({ lineHeight: typedLineHeight(n, next("value" in lineHeightView(n) ? (lineHeightView(n) as { value: number }).value : 0)) }), "Change line height")}
          suffix={
            <>
              {lineUnit && lineUnit !== "AUTO" && (
                <span className="field-unit" aria-hidden="true">
                  {UNIT_SUFFIX[lineUnit]}
                </span>
              )}
              <MenuButton
                label={`Line spacing unit: ${lineUnit === "AUTO" ? "Auto" : lineUnit === "PERCENT" ? "Percent" : lineUnit === "PIXELS" ? "Pixels" : "Mixed"}`}
                title="Line spacing unit"
                className="field-menu"
                disabled={readOnly}
                entries={[
                  { value: "AUTO" as const, label: "Auto", checked: lineUnit === "AUTO" },
                  { value: "PIXELS" as const, label: "Pixels", checked: lineUnit === "PIXELS" },
                  { value: "PERCENT" as const, label: "Percent", checked: lineUnit === "PERCENT" },
                ]}
                onSelect={(u) => command((n) => ({ lineHeight: lineHeightIn(n, u) }), `Line height: ${u === "AUTO" ? "auto" : u === "PIXELS" ? "pixels" : "percent"}`)}
              >
                <Icon name="chevron-down" size={12} />
              </MenuButton>
            </>
          }
        />
        <NumberField
          key={`ls-${ids.join()}`}
          id="prop-letter-spacing"
          label="Letter spacing"
          prefix={<Icon name="letter-text" size={12} />}
          values={spacingViews.map((v) => v.value)}
          min={-10000}
          max={10000}
          readOnly={readOnly}
          onChange={(next) =>
            set((n) => {
              const v = letterSpacingView(n);
              return { letterSpacing: { unit: v.unit, value: Math.round(next(v.value) * 100) / 100 } };
            }, "Change letter spacing")
          }
          suffix={
            <>
              {spacingUnit && (
                <span className="field-unit" aria-hidden="true">
                  {UNIT_SUFFIX[spacingUnit]}
                </span>
              )}
              <MenuButton
                label={`Letter spacing unit: ${spacingUnit === "PIXELS" ? "Pixels" : spacingUnit === "PERCENT" ? "Percent" : "Mixed"}`}
                title="Letter spacing unit"
                className="field-menu"
                disabled={readOnly}
                entries={[
                  { value: "PIXELS" as const, label: "Pixels", checked: spacingUnit === "PIXELS" },
                  { value: "PERCENT" as const, label: "Percent", checked: spacingUnit === "PERCENT" },
                ]}
                onSelect={(u) => command((n) => ({ letterSpacing: letterSpacingIn(n, u) }), `Letter spacing: ${u === "PIXELS" ? "pixels" : "percent"}`)}
              >
                <Icon name="chevron-down" size={12} />
              </MenuButton>
            </>
          }
        />
      </div>

      <div className="type-row type-align">
        <Segments
          label="Text align"
          options={H_ALIGN}
          value={same(nodes.map(alignHorizontalOf))}
          disabled={readOnly}
          onChange={(v) => command({ textAlignHorizontal: v === "LEFT" ? undefined : v }, `Text align: ${v.toLowerCase()}`)}
        />
        <Segments
          label="Resizing"
          options={RESIZE}
          value={same(nodes.map(resizeModeOf))}
          disabled={readOnly}
          onChange={(v) => command((n) => resizePatch(n, v), `Resizing: ${(RESIZE.find((r) => r.value === v)?.title ?? "fixed size").toLowerCase()}`)}
        />
      </div>
      <div className="type-row type-align">
        <Segments
          label="Vertical align"
          options={V_ALIGN}
          value={same(nodes.map(alignVerticalOf))}
          disabled={readOnly}
          onChange={(v) => command({ textAlignVertical: v === "TOP" ? undefined : v }, `Vertical align: ${v === "CENTER" ? "middle" : v.toLowerCase()}`)}
        />
      </div>
    </section>
  );
}
