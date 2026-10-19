import { useEffect, useMemo, useState } from "react";
import type { Document, ReadonlyNode } from "@illigma/core";
import type { Effect, EffectType, Paint, ShadowEffect } from "@illigma/format";
import { EFFECT_TYPES, PAINT_LIMITS } from "@illigma/format";
import { MenuButton } from "../../ui/Menu";
import { NumberField } from "../../ui/NumberField";
import { ColorPicker } from "./ColorPicker";
import { cssColor, hexHasAlpha, parseHex, toHex } from "./color";
import { addEffect, EditSession, effectAt, removeEffect, sharedEffects, type Patcher, type Phase } from "./edits";
import { InlineField, parsePercent, pct } from "./fields";
import { PaintIcon, type PaintIconName } from "./icons";
import { convertEffect, defaultEffect, EFFECT_LABEL, isShadow } from "./paints";
import { Popover } from "./Popover";

const EFFECT_ICON: Record<EffectType, PaintIconName> = {
  DROP_SHADOW: "copy",
  INNER_SHADOW: "square-square",
  LAYER_BLUR: "droplets",
  BACKGROUND_BLUR: "layers-2",
};

const LIMIT = PAINT_LIMITS.maxEffectRadius;

/** The CSS a settings preview uses to show an effect on a sample card. */
function previewStyle(e: Effect): { boxShadow?: string; filter?: string; backdropFilter?: string } {
  if (!e.visible) return {};
  if (isShadow(e)) return { boxShadow: `${e.type === "INNER_SHADOW" ? "inset " : ""}${e.offset.x}px ${e.offset.y}px ${e.radius}px ${e.spread ?? 0}px ${cssColor(e.color)}` };
  if (e.type === "LAYER_BLUR") return { filter: `blur(${e.radius / 2}px)` };
  return { backdropFilter: `blur(${e.radius / 2}px)` };
}

/**
 * The Effects card (Figma boards "Card / Effects" and 21 · drop shadow
 * settings): + adds a drop shadow; each row picks its type (Drop shadow,
 * Inner shadow, Layer blur, Background blur), opens its settings, shows or
 * hides it, or removes it. Rows list the top effect first.
 */
export function EffectsCard({ doc, nodes, readOnly, onError }: { doc: Document; nodes: readonly ReadonlyNode[]; readOnly: boolean; onError(e: unknown): void }) {
  const session = useMemo(() => new EditSession(doc), [doc]);
  // Never leave a drag open when the card goes (selection changed mid-drag): an open edit holds autosave and swallows ⌘Z.
  useEffect(() => () => session.settle(), [session]);
  const [open, setOpen] = useState<{ index: number; anchor: HTMLElement } | null>(null);
  if (!nodes.length || nodes.some((n) => n.type === "PAGE")) return null;
  const ids = nodes.map((n) => n.id);
  const effects = sharedEffects(nodes);
  const count = effects?.length ?? 0;

  const run = (phase: Phase, label: string, patch: Patcher) => {
    try {
      session.change(phase, label, ids, patch);
    } catch (e) {
      session.cancel();
      onError(e);
    }
  };
  const openEffect = open && effects ? effects[open.index] : undefined;

  return (
    <section className="card paint-card" aria-labelledby="effects-heading">
      <div className="card-head">
        <span className="card-icon">
          <PaintIcon name="sparkles" />
        </span>
        <h2 id="effects-heading" className="section-heading card-title">
          Effects
        </h2>
        <button
          type="button"
          className="icon-button"
          aria-label={effects === null ? "Replace mixed effects" : "Add effect"}
          title="Add effect"
          disabled={readOnly || count >= PAINT_LIMITS.maxEffects}
          onClick={() => run("once", "Add drop shadow", addEffect(defaultEffect("DROP_SHADOW"), effects === null))}
        >
          <PaintIcon name="plus" />
        </button>
      </div>
      {effects === null ? (
        <p className="muted paint-mixed">Click + to replace mixed content</p>
      ) : (
        count > 0 && (
          <div className="paint-rows">
            {effects
              .map((e, i) => ({ e, i }))
              .reverse()
              .map(({ e, i }) => {
                const n = count - i;
                const name = EFFECT_LABEL[e.type];
                return (
                  <div key={i} className="paint-row" data-hidden={!e.visible || undefined} data-open={open?.index === i || undefined}>
                    <div className="field paint-field effect-field">
                      <MenuButton<EffectType>
                        label={`Effect ${n} type: ${name}`}
                        title="Effect type"
                        className="effect-type"
                        disabled={readOnly}
                        entries={EFFECT_TYPES.map((t) => ({ value: t, label: EFFECT_LABEL[t], checked: t === e.type }))}
                        onSelect={(t) => run("once", `Change to ${EFFECT_LABEL[t].toLowerCase()}`, effectAt(i, (x) => convertEffect(x, t)))}
                      >
                        <span className="effect-tile">
                          <PaintIcon name={EFFECT_ICON[e.type]} />
                        </span>
                        <span className="effect-name">{name}</span>
                      </MenuButton>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Effect ${n} settings`}
                        title="Effect settings"
                        aria-haspopup="dialog"
                        aria-expanded={open?.index === i}
                        onClick={(ev) => {
                          const anchor = ev.currentTarget;
                          setOpen((o) => (o?.index === i ? null : { index: i, anchor }));
                        }}
                      >
                        <PaintIcon name="sliders-horizontal" />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={e.visible ? `Hide effect ${n}` : `Show effect ${n}`}
                      title={e.visible ? "Hide" : "Show"}
                      disabled={readOnly}
                      onClick={() => run("once", e.visible ? "Hide effect" : "Show effect", effectAt(i, (x) => ({ ...x, visible: !x.visible })))}
                    >
                      <PaintIcon name={e.visible ? "eye" : "eye-off"} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove effect ${n}`}
                      title="Remove effect"
                      disabled={readOnly}
                      onClick={() => {
                        if (open?.index === i) setOpen(null);
                        run("once", "Remove effect", removeEffect(i));
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
      {open && openEffect && (
        <EffectSettings
          key={open.index}
          doc={doc}
          anchor={open.anchor}
          number={count - open.index}
          effect={openEffect}
          readOnly={readOnly}
          onEffect={(next, phase, label) => run(phase, label, effectAt(open.index, () => next))}
          onSettle={() => session.settle()}
          onError={onError}
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

/** An effect's settings popover: type, preview, X, Y, blur, spread, colour, and "show behind transparent areas". */
function EffectSettings({
  doc,
  anchor,
  number,
  effect,
  readOnly,
  onEffect,
  onSettle,
  onError,
  onClose,
}: {
  doc: Document;
  anchor: HTMLElement;
  number: number;
  effect: Effect;
  readOnly: boolean;
  onEffect(next: Effect, phase: Phase, label: string): void;
  /** End a drag still open (the colour picker closed mid-drag): keep it as one undo step. */
  onSettle(): void;
  onError(e: unknown): void;
  onClose(refocus: boolean): void;
}) {
  const [picker, setPicker] = useState<HTMLElement | null>(null);
  const name = EFFECT_LABEL[effect.type];
  const lower = name.toLowerCase();
  const num = (key: string, label: string, letter: string, value: number, min: number, apply: (e: Effect, v: number) => Effect) => (
    <NumberField
      key={key}
      id={`effect-${number}-${key}`}
      label={label}
      prefix={letter}
      values={[value]}
      min={min}
      max={LIMIT}
      readOnly={readOnly}
      suffix={
        <span className="unit-suffix" aria-hidden="true">
          px
        </span>
      }
      onChange={(next) => onEffect(apply(effect, next(value)), "once", `Change ${lower} ${label.toLowerCase().replace(/^shadow /, "")}`)}
    />
  );
  const shadow = isShadow(effect) ? (effect as ShadowEffect) : null;
  const colorPaint: Paint | null = shadow ? { type: "SOLID", visible: true, color: shadow.color } : null;

  return (
    <Popover anchor={anchor} label={`Effect ${number}: ${name} settings`} className="effect-settings" onClose={onClose}>
      <div className="picker-head">
        <MenuButton<EffectType>
          label={`Effect type: ${name}`}
          title="Effect type"
          className="select-button grow"
          disabled={readOnly}
          entries={EFFECT_TYPES.map((t) => ({ value: t, label: EFFECT_LABEL[t], checked: t === effect.type }))}
          onSelect={(t) => onEffect(convertEffect(effect, t), "once", `Change to ${EFFECT_LABEL[t].toLowerCase()}`)}
        >
          <span className="select-button-label">{name}</span>
          <PaintIcon name="chevron-down" size={12} />
        </MenuButton>
        <button type="button" className="icon-button" aria-label="Close effect settings" title="Close (Esc)" onClick={() => onClose(true)}>
          <PaintIcon name="x" />
        </button>
      </div>
      <div className="effect-preview" aria-hidden="true">
        <span className="effect-sample" style={previewStyle(effect)} />
      </div>
      {shadow ? (
        <>
          <div className="field-grid">
            {num("x", "Shadow X offset", "X", shadow.offset.x, -LIMIT, (e, v) => ({ ...(e as ShadowEffect), offset: { x: v, y: (e as ShadowEffect).offset.y } }))}
            {num("y", "Shadow Y offset", "Y", shadow.offset.y, -LIMIT, (e, v) => ({ ...(e as ShadowEffect), offset: { x: (e as ShadowEffect).offset.x, y: v } }))}
            {num("blur", "Shadow blur", "B", shadow.radius, 0, (e, v) => ({ ...e, radius: v }))}
            {num("spread", "Shadow spread", "S", shadow.spread ?? 0, -LIMIT, (e, v) => ({ ...(e as ShadowEffect), spread: v }))}
          </div>
          <div className="field paint-field">
            <button
              type="button"
              className="paint-swatch"
              aria-label={`Shadow colour: ${toHex(shadow.color)}. Open colour picker`}
              aria-haspopup="dialog"
              aria-expanded={!!picker}
              style={{ ["--paint" as string]: `linear-gradient(${cssColor(shadow.color)}, ${cssColor(shadow.color)})` }}
              onClick={(e) => {
                const el = e.currentTarget;
                setPicker((p) => (p ? null : el));
              }}
            />
            <InlineField
              label="Shadow colour hex"
              className="paint-hex"
              value={toHex(shadow.color)}
              readOnly={readOnly}
              parse={(t) => (parseHex(t) ? t : null)}
              onCommit={(t) => {
                const c = parseHex(String(t));
                // #rgba and #rrggbbaa carry their own alpha; otherwise the shadow keeps its alpha.
                if (c) onEffect({ ...shadow, color: { ...c, a: hexHasAlpha(String(t)) ? c.a : shadow.color.a } }, "once", `Change ${lower} colour`);
              }}
            />
            <InlineField
              label="Shadow colour opacity"
              className="paint-opacity"
              value={pct(shadow.color.a)}
              readOnly={readOnly}
              step={1}
              parse={parsePercent}
              onCommit={(v) => onEffect({ ...shadow, color: { ...shadow.color, a: (v as number) / 100 } }, "once", `Change ${lower} colour`)}
            />
          </div>
          {shadow.type === "DROP_SHADOW" && (
            <label className="check-row">
              <input
                type="checkbox"
                checked={!!shadow.showShadowBehindNode}
                disabled={readOnly}
                onChange={(e) => {
                  const next = { ...shadow };
                  if (e.target.checked) next.showShadowBehindNode = true;
                  else next.showShadowBehindNode = false;
                  onEffect(next, "once", e.target.checked ? "Show shadow behind transparent areas" : "Hide shadow behind transparent areas");
                }}
              />
              <span>Show behind transparent areas</span>
            </label>
          )}
        </>
      ) : (
        <div className="field-grid">{num("blur", "Blur", "B", effect.radius, 0, (e, v) => ({ ...e, radius: v }))}</div>
      )}
      {picker && colorPaint && shadow && (
        <ColorPicker
          doc={doc}
          anchor={picker}
          label="Shadow colour"
          paint={colorPaint}
          kind="color"
          box={{ width: 100, height: 100 }}
          readOnly={readOnly}
          onPaint={(next, phase) => {
            if (next.type === "SOLID") onEffect({ ...shadow, color: { ...next.color } }, phase, `Change ${lower} colour`);
          }}
          onError={(m) => onError(new Error(m))}
          onClose={(refocus) => {
            onSettle();
            const el = picker;
            setPicker(null);
            if (refocus && el.isConnected) el.focus();
          }}
        />
      )}
    </Popover>
  );
}
