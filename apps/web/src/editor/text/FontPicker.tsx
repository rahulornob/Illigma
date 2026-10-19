import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Icon } from "../../ui/Icon";
import { requestLocalFonts, type LocalFonts } from "./local-fonts";

type Tab = "all" | "file" | "computer";
const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "file", label: "In this file" },
  { value: "computer", label: "On this computer" },
];

const WIDTH = 264;
const GUTTER = 8;

/**
 * The font picker (Figma board "Text selected · font picker open", 96:59007):
 * search, then fonts in this file, the bundled font, and fonts on this
 * computer (asked for with a click: the browser asks for permission). A
 * family the file names that isn't available shows a warning; picking
 * another font replaces it. Keyboard: type to search, ↑ ↓ to move, Enter to
 * pick, Escape to close (focus goes back to the font button).
 */
export function FontPicker({
  anchor,
  current,
  inFile,
  bundled,
  local,
  missing,
  onPick,
  onClose,
}: {
  anchor: RefObject<HTMLElement | null>;
  /** The selection's family, or undefined when mixed. */
  current: string | undefined;
  /** Families the file's text uses. */
  inFile: readonly string[];
  /** Families that come with Illigma (Inter). */
  bundled: readonly string[];
  local: LocalFonts;
  /** A family the selection uses that isn't available, or null. */
  missing: string | null;
  onPick(family: string): void;
  onClose(refocus: boolean): void;
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const listId = useId();

  useLayoutEffect(() => {
    const r = anchor.current?.getBoundingClientRect();
    if (!r) return;
    const height = root.current?.offsetHeight ?? 0;
    const left = Math.max(GUTTER, Math.min(r.right - WIDTH, window.innerWidth - WIDTH - GUTTER));
    const below = r.bottom + 4;
    const top = below + height > window.innerHeight - GUTTER ? Math.max(GUTTER, r.top - 4 - height) : below;
    setPos({ left, top });
  }, [anchor]);

  // Focus the search once the picker is placed (a hidden element can't take focus).
  const placed = pos !== null;
  useEffect(() => {
    if (placed) search.current?.focus();
  }, [placed]);

  useEffect(() => {
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!root.current?.contains(t) && !anchor.current?.contains(t)) onClose(false);
    };
    window.addEventListener("pointerdown", outside, true);
    return () => window.removeEventListener("pointerdown", outside, true);
  }, [anchor, onClose]);

  const q = query.trim().toLowerCase();
  const match = (f: string) => !q || f.toLowerCase().includes(q);
  const sections = useMemo(() => {
    const out: { label: string; families: string[] }[] = [];
    const fileFamilies = [...new Set([...inFile])];
    if (tab !== "computer") {
      out.push({ label: "In this file", families: fileFamilies.filter(match) });
      const extra = bundled.filter((f) => !fileFamilies.includes(f));
      if (extra.length) out.push({ label: "Included with Illigma", families: extra.filter(match) });
    }
    if (tab !== "file" && local.status === "ready") {
      const all = [...local.families.keys()];
      out.push({ label: `On this computer · ${all.length.toLocaleString("en-US")} fonts`, families: all.filter(match) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, q, inFile, bundled, local]);
  const options = sections.flatMap((s) => s.families.map((family) => ({ family, section: s.label })));
  const activeIndex = Math.min(active, Math.max(0, options.length - 1));
  const optionId = (i: number) => `${listId}-opt-${i}`;

  useEffect(() => {
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const onKey = (e: KeyboardEvent) => {
    // Keys in the picker never reach the editor's shortcuts.
    e.stopPropagation();
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((activeIndex + step + options.length) % Math.max(1, options.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = options[activeIndex];
      if (o) onPick(o.family);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose(true);
    }
  };

  let index = -1;
  const unavailable = (f: string) => f === missing;
  return (
    <div
      ref={root}
      className="font-picker"
      role="dialog"
      aria-label="Fonts"
      style={pos ? { left: pos.left, top: pos.top } : { visibility: "hidden" }}
      onKeyDown={onKey}
    >
      <div className="font-search">
        <Icon name="search" />
        <input
          ref={search}
          type="text"
          className="font-search-input"
          placeholder="Search fonts"
          aria-label="Search fonts"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={options.length ? optionId(activeIndex) : undefined}
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
        />
      </div>
      <div className="font-tabs" role="radiogroup" aria-label="Show fonts">
        {TABS.map((t) => (
          <button key={t.value} type="button" role="radio" className="font-tab" aria-checked={tab === t.value} onClick={() => setTab(t.value)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="font-list">
        {/* Only groups of options inside the listbox (ARIA): notes and buttons go after it. */}
        <div id={listId} role="listbox" aria-label="Fonts">
        {sections.filter((s) => s.families.length > 0).map((s) => (
          <div key={s.label} role="group" aria-label={s.label}>
            <div className="menu-heading" role="presentation">
              {s.label}
            </div>
            {s.families.map((family) => {
              index++;
              const i = index;
              return (
                <div
                  key={`${s.label}-${family}`}
                  id={optionId(i)}
                  role="option"
                  aria-selected={family === current}
                  className="font-option"
                  data-active={i === activeIndex || undefined}
                  onPointerMove={() => i !== activeIndex && setActive(i)}
                  onClick={() => onPick(family)}
                >
                  <span className="menu-check">{family === current && <Icon name="check" />}</span>
                  <span className="menu-label">{family}</span>
                  {unavailable(family) && (
                    <span className="font-warn" title="Not installed">
                      <Icon name="triangle-alert" size={12} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        </div>
        {options.length === 0 && <div className="font-empty">{q ? "No fonts match." : "No fonts here yet."}</div>}
        {tab !== "file" && local.status !== "ready" && (
          <div className="font-local">
            {local.status === "unsupported" ? (
              <p className="muted">This browser can't list the fonts on this computer. Chrome and Edge can.</p>
            ) : (
              <>
                {local.status === "denied" && <p className="muted">Font access was refused. Allow it in the browser's site settings, then try again.</p>}
                <button type="button" className="btn btn-secondary" disabled={local.status === "loading"} onClick={() => void requestLocalFonts()}>
                  {local.status === "loading" ? "Reading fonts…" : "Show fonts on this computer"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {missing && (
        <div className="font-missing" role="status">
          <Icon name="triangle-alert" />
          <span>
            <strong>{missing}</strong> is not installed. Text keeps its layout in {bundled[0] ?? "the default font"}; pick a font to replace it.
          </span>
        </div>
      )}
    </div>
  );
}
