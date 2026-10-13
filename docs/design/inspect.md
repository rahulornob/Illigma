# Inspect mode

Draft · 13 October 2026 · Phase 4.7 of the [design plan](PLAN.md) · Figma section "17 · Inspect"

Inspect is the developer hand-off view, like Figma's Dev Mode, but free and built in. It is the third tab in the Properties panel (Design · Prototype · Inspect). It is read-only: nothing in Inspect changes the file.

## Screens

| Screen | Node | What it shows |
|---|---|---|
| Inspect · Button selected, measuring to Password | `96:47901` | A selected instance, with a pink redline to the hovered layer. Cards for component, layout, typography, colours and code |
| Inspect · Scrolled to Code and Export, CSS copied | `96:52500` | The lower cards: wrapped code, Export settings (scale + format), the copy button's check state and a "Copied CSS" toast |
| Inspect · Nothing selected | `96:48963` | Page summary: colours and text styles used on the page, and the assets marked for export |

## Measuring

- Select a layer, then hover another layer (or hold ⌥ / Alt in Design mode) to see the distance. Lines and labels use the pink **guide/smart** colour, the same colour as smart guides, and only for measurements.
- Distances are shown in design units (px at 1x), not screen pixels at the current zoom.
- The hovered layer gets a pink outline. The selected layer keeps its blue selection.

## Cards

1. **Component** (instances only): name in component purple, variant, description, and a button that goes to the main component.
2. **Layout**: width and height with their sizing (Fill, Hug, Fixed), position, auto layout (direction, alignment, gap), padding and radius. Values bound to a variable show the variable as a chip (`radius/button`).
3. **Typography** (text, or layers with text inside): text style, font, size, line height, letter spacing and colour.
4. **Colours**: every fill and stroke, showing the variable name when bound.
5. **Code**: CSS, Tailwind, SwiftUI or Jetpack Compose. Variables become CSS custom properties (`var(--accent-default)`) or platform tokens using each variable's **code syntax** (see [variables.md](variables.md)). Copy button in the card header. Units: px or rem, and the scale (1x, 2x).
6. **Export** (P0): export settings for the selection (scale + format: PNG, JPG, SVG, PDF), a preview and **Export <layer>**, same as the Design tab.
7. **Nothing selected**: colours and text styles on the page, plus the assets to export with **Export N assets…** (opens the Export dialog, 4.8).

## Rules

- Every value can be copied with a click. A "Copied" toast confirms it.
- Code uses the **Code/Body** text style (JetBrains Mono 12/16, OFL licence). Long values break onto an indented next line, so the card never scrolls sideways.
- No account or seat is needed. Inspect works in any file, offline.

## Not yet designed

- Text-layer and multi-selection (mixed values) states of Inspect. They come with the core-loop states in 4.10.
