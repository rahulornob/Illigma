import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "../ui/Icon";
import type { Tool } from "./Canvas";
import { VIcon, type VectorIconName } from "./vector/icons";
import { placeImageRequest } from "./vector/shortcuts";

/** Tools with a one-key shortcut (the Editor picks them by key). */
export const TOOLS: { id: Tool; label: string; key: string; icon: IconName }[] = [
  { id: "move", label: "Move", key: "V", icon: "mouse-pointer-2" },
  { id: "frame", label: "Frame", key: "F", icon: "frame" },
  { id: "rectangle", label: "Rectangle", key: "R", icon: "square" },
  { id: "ellipse", label: "Ellipse", key: "O", icon: "circle" },
  { id: "line", label: "Line", key: "L", icon: "minus" },
  { id: "pen", label: "Pen", key: "P", icon: "spline" },
  { id: "text", label: "Text", key: "T", icon: "type" },
];

/** Figma's shapes menu: the dock shows the last shape picked; its flyout lists them all. */
const SHAPES: { id: Tool | "image"; label: string; key: string; icon: VectorIconName }[] = [
  { id: "rectangle", label: "Rectangle", key: "R", icon: "rectangle" },
  { id: "line", label: "Line", key: "L", icon: "line" },
  { id: "arrow", label: "Arrow", key: "⇧L", icon: "arrow" },
  { id: "ellipse", label: "Ellipse", key: "O", icon: "ellipse" },
  { id: "polygon", label: "Polygon", key: "", icon: "polygon" },
  { id: "star", label: "Star", key: "", icon: "star" },
  { id: "image", label: "Place image…", key: "⇧⌘K", icon: "image" },
];
const SHAPE_TOOLS = new Set<Tool>(["rectangle", "line", "arrow", "ellipse", "polygon", "star"]);

function DockButton({ tool, id, label, keys, children, onTool }: { tool: Tool; id: Tool; label: string; keys: string; children: React.ReactNode; onTool(t: Tool): void }) {
  return (
    <button type="button" className="tool-button" aria-pressed={tool === id} aria-label={`${label} (${keys})`} aria-keyshortcuts={keys} title={`${label}  ${keys}`} onClick={() => onTool(id)}>
      {children}
    </button>
  );
}

export function ToolDock({ tool, onTool }: { tool: Tool; onTool(t: Tool): void }) {
  const [shape, setShape] = useState<Tool>("rectangle");
  const [open, setOpen] = useState(false);
  const group = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (SHAPE_TOOLS.has(tool)) setShape(tool);
  }, [tool]);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !group.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("keydown", close, true);
    return () => {
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("keydown", close, true);
    };
  }, [open]);
  const current = SHAPES.find((s) => s.id === shape) ?? (SHAPES[0] as (typeof SHAPES)[number]);
  const keyed = (id: Tool) => TOOLS.find((t) => t.id === id) as (typeof TOOLS)[number];
  return (
    <div className="tool-dock" role="toolbar" aria-label="Tools">
      {(["move", "frame"] as const).map((id) => (
        <DockButton key={id} tool={tool} id={id} label={keyed(id).label} keys={keyed(id).key} onTool={onTool}>
          <Icon name={keyed(id).icon} size={20} />
        </DockButton>
      ))}
      <div className="tool-group" ref={group}>
        <DockButton tool={SHAPE_TOOLS.has(tool) ? tool : "move"} id={current.id as Tool} label={current.label} keys={current.key || current.label} onTool={onTool}>
          <VIcon name={current.icon} size={20} />
        </DockButton>
        <button type="button" className="tool-flyout-toggle" aria-label="Shape tools" aria-haspopup="menu" aria-expanded={open} title="Shape tools" onClick={() => setOpen((o) => !o)}>
          <VIcon name="chevron" size={12} />
        </button>
        {open && (
          <div className="tool-flyout" role="menu" aria-label="Shape tools">
            {SHAPES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="menuitemradio"
                aria-checked={s.id === tool}
                className="tool-flyout-item"
                onClick={() => {
                  setOpen(false);
                  if (s.id === "image") placeImageRequest();
                  else onTool(s.id);
                }}
              >
                <VIcon name={s.icon} />
                <span>{s.label}</span>
                {s.key && <span className="tool-flyout-key">{s.key}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      <DockButton tool={tool} id="pen" label="Pen" keys="P" onTool={onTool}>
        <VIcon name="pen" size={20} />
      </DockButton>
      <DockButton tool={tool} id="text" label="Text" keys="T" onTool={onTool}>
        <Icon name="type" size={20} />
      </DockButton>
    </div>
  );
}
