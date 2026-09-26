# Live Figma inspection — September 27, 2026

Evidence type: **read-only UI inspection**, plus one screenshot of the overall editor. This is not an interaction-parity test of all features.

Reference: the user's open [Illigma Figma file](https://www.figma.com/design/K9mCPjBElVGiPOHJvZ4CWY/Illigma?node-id=0-1).
Platform: Chrome on macOS; Figma Design, edit interface; 88% canvas zoom. Observed through the visible accessibility tree and screenshot, not guessed DOM internals.

## Observed

| Context | Confirmed visible behavior |
| --- | --- |
| No selection | Navigation rail, left File/Pages/Layers area, right Design/Prototype tabs and page properties, bottom tool strip |
| Layers heading | Expands to reveal selectable, collapsible frame rows; selection updates the contextual inspector |
| Frame 2, node `6:1826` | Position, Layout, Appearance, Fill, Stroke, Effects, Layout guide and Export; Freeform selected; Clip content checked |
| Container, node `6:1274` | Auto layout enabled, Vertical flow, Wrap control, width/height controls, nine-position alignment, gap, padding, Clip content |
| Same container's layout settings | Inside stroke = Included; Canvas stacking = Last on top; Layout = Updated; baseline control disabled in this context; Auto spacing displays Between and is disabled for this configuration |
| Same container's fill popover | Custom/Libraries tabs; paint-type controls; hue and opacity; color format; eyedropper control; page swatches; close control |
| Same container's stroke | Inside placement and weight control are available |

The color popover exposed Solid, Gradient, Pattern, Image, Video, and Shader choices in this account. This proves the controls were visible, not that every paint type was exercised or is available to every account.

## Not established

- Exact drag, resize, snap, keyboard-modifier, or selection-scope behavior.
- Numeric layout results for controlled fixtures.
- Full font, vector-network, mask, component, library, prototype, or collaboration behavior.
- Persistent saving or sync reliability. A connection warning appeared initially and later disappeared.
- Any universal entitlement or feature availability claim.

No design property values, artwork, permissions, comments, or sharing settings were changed. Temporary menus were closed, selection cleared, and the original collapsed Layers heading restored. The reference file's artwork was offscreen in the inspected view; the screenshot was useful for shell and inspector layout, not artwork comparison.

For a future feature, inspect the current app again and record a focused before/action/after observation. This note expires as evidence of the *current* UI whenever the UI, file, platform, or relevant setting changes.
