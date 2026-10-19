import type { DeepReadonly } from "@illigma/core";
import type { Paint, Style } from "@illigma/format";
import { Icon } from "../../ui/Icon";
import { PaintIcon } from "../paint/icons";
import { swatchStyle } from "../paint/PaintList";

/** A small preview of a style: its paint, "Ag" for text, an icon for effects and grids. */
export function StylePreview({ style }: { style: DeepReadonly<Style> }) {
  switch (style.type) {
    case "PAINT": {
      const top = style.paints.at(-1);
      return <span className="style-swatch paint-swatch" aria-hidden="true" style={top ? swatchStyle(top as Paint) : {}} />;
    }
    case "TEXT":
      return (
        <span className="style-swatch style-text" aria-hidden="true">
          Ag
        </span>
      );
    case "EFFECT":
      return (
        <span className="style-swatch" aria-hidden="true">
          <PaintIcon name="sparkles" size={12} />
        </span>
      );
    case "GRID":
      return (
        <span className="style-swatch" aria-hidden="true">
          <Icon name="grid-2x2" size={12} />
        </span>
      );
  }
}
