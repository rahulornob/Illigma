import { Icon, type IconName } from "../ui/Icon";
import type { Tool } from "./Canvas";

export const TOOLS: { id: Tool; label: string; key: string; icon: IconName }[] = [
  { id: "move", label: "Move", key: "V", icon: "mouse-pointer-2" },
  { id: "frame", label: "Frame", key: "F", icon: "frame" },
  { id: "rectangle", label: "Rectangle", key: "R", icon: "square" },
  { id: "ellipse", label: "Ellipse", key: "O", icon: "circle" },
];

export function ToolDock({ tool, onTool }: { tool: Tool; onTool(t: Tool): void }) {
  return (
    <div className="tool-dock" role="toolbar" aria-label="Tools">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          type="button"
          className="tool-button"
          aria-pressed={tool === t.id}
          aria-label={`${t.label} (${t.key})`}
          aria-keyshortcuts={t.key}
          title={`${t.label}  ${t.key}`}
          onClick={() => onTool(t.id)}
        >
          <Icon name={t.icon} size={20} />
        </button>
      ))}
    </div>
  );
}
