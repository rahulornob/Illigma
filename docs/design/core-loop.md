# Core loop and state map

Draft · 13 October 2026 · Phase 1 of the [design plan](PLAN.md)

This map lists every step a designer takes in the six v1 journeys (PRD section 3), the editor states each step needs, and the canvas behaviours behind it. It replaces the old "States still to design" list. The inventory column points to the P0 rows in [`../feature-inventory/`](../feature-inventory/) (`01` = Design, `02` = Design systems and prototyping, `03` = Dev Mode and platform).

Status: **Done** = designed in layout B · **Part** = partly designed · **—** = not designed yet. "Phase" says where the work lands in the [plan](PLAN.md).

## The loop

```mermaid
flowchart LR
  A[Open or create a file] --> B[Frame and draw]
  B --> C[Lay out with auto layout]
  C --> D[Style: fills, text, effects]
  D --> E[Make components and variants]
  E --> F[Theme with variables and modes]
  F --> G[Prototype and present]
  G --> H[Hand off: inspect and export]
  H --> I[Save, version, share the file]
  I --> A
```

## Step by step

### A · Open or create a file (journeys 1, 6)

| State | Status | Phase | Inventory |
|---|---|---|---|
| Home / file browser: recent files, folders on disk, new file, import | Done (11) | 4 | 01 Interface & navigation; 03 Desktop app |
| Empty file: blank canvas, first-run hints | Done (12) | 3, 4 | 01 Interface & navigation |
| Tab switcher (open tabs, other windows, recent files) | Done | — | 01 File utilities |
| Import (Figma REST, .fig, SVG, Penpot) dialog and progress | Done (20 · Import) | 4 | 01 Import & export |
| Save state and errors (saved, saving, disk full, conflict) | Done (13) | 4 | 01 File utilities |

### B · Frame and draw (journey 1)

| State | Status | Phase | Inventory |
|---|---|---|---|
| Tool dock with flyouts (move/scale, frame/section/slice, shapes, pen/pencil, text, comment) | Done (20 · flyout) | 4 | 01 Interface & navigation |
| Frame presets panel (phone, tablet, desktop sizes) | Done (12) | 4 | 01 Frames & groups |
| **Canvas:** draw frame and shape, selection, handles, resize, rotate, nudge, duplicate | Done (09 spec) | **2** | 01 Position, transform, measure |
| **Canvas:** deep select, multi-select, marquee | Done (09 spec, 20 · multi-select) | **2** | 01 Layers; Position |
| **Canvas:** smart guides, snapping, measurement (⌥) | Done (09 spec, 17) | **2** | 01 Position, transform, measure |
| **Canvas:** pen tool and vector edit mode, boolean operations | Done (09 spec) | **2** | 01 Vector editing |
| Nothing selected (page properties, local variables and styles) | Done (14 · Assets, 20 · Styles) | 4 | 01 Layers |
| Layers panel: pages, tree, rename, lock, hide, drag to reorder | Part (static + states) | 4 | 01 Layers |
| Zoom and view menu, rulers, guides, outline mode | Done (20 · View menu) | 2, 4 | 01 View, zoom, rulers |

### C · Lay out with auto layout (journeys 1, 3)

| State | Status | Phase | Inventory |
|---|---|---|---|
| Inspector: auto layout card (direction, wrap, grid, gap, padding, alignment) | Done | — | 01 Auto layout |
| Selected auto-layout frame on canvas: padding and gap handles | Done (09 spec) | **2**, 4 | 01 Auto layout |
| Child in auto layout: fill / hug / fixed, absolute position | Part | 2, 4 | 01 Auto layout |
| Constraints and layout guides card | Done (20) | 4 | 01 Constraints & layout guides |

### D · Style (journey 1)

| State | Status | Phase | Inventory |
|---|---|---|---|
| Fill card + colour picker (custom, variables, document colours, gradients, image) | Done (15 · picker) | 4 | 01 Fills & color picker; Gradients; Images |
| Stroke card expanded (weight, position, per-side, dashes) | Done (20) | 4 | 01 Strokes |
| Effects card + menu (shadows, blurs, noise, texture, glass) | Part (menu done) | 4 | 01 Effects |
| Corner radius: independent corners, smoothing | Part | 4 | 01 Corner radius & smoothing |
| Text selected: typography card, text styles, font picker | Done (20) | 4 | 01 Text & typography; Fonts |
| **Canvas:** text editing (caret, selection, resize modes) | Done (09 spec) | **2** | 01 Text & typography |

### E · Components and variants (journey 3)

| State | Status | Phase | Inventory |
|---|---|---|---|
| Instance selected (properties, reset, swap, detach, go to main) | Done | — | 02 Instances |
| Main component selected (properties editor, description) | Done (14) | 4 | 02 Components; Component properties |
| Variant set selected (variant grid, property values) | Done (14) | 4 | 02 Variants and component sets |
| Swap instance / assets panel and library browser | Done (14) | 4 | 02 Instances; Libraries |
| Create component flow (⌥⌘K) and combine as variants | Done (14) | 3 | 02 Components |

### F · Variables and modes (journey 3)

| State | Status | Phase | Inventory |
|---|---|---|---|
| Variables manager (full page: collections, modes, groups, values, aliases, scopes) | Done (15) | 4 | 02 Variables: collections, types, scopes |
| Bind a property to a variable (picker from any field) | Done (15) | 4 | 02 Variables: applying |
| Mode switching on a frame (Dark / Light) | Done (15) | 4 | 02 Variable modes |
| Styles (colour, text, effect, grid) create and apply | Done (20 · Styles) | 4 | 02 Styles |

### G · Prototype and present (journey 4)

| State | Status | Phase | Inventory |
|---|---|---|---|
| Prototype mode: connections on canvas, interaction panel (trigger, action, animation) | Done (16) | 3, 4 | 02 Prototyping: connections, triggers, animation |
| Flows and starting points, overlays, scroll behaviour | Part (16; overlays not drawn) | 4 | 02 Prototyping: flows and overlays; scroll |
| Presentation view (full screen, device frame, hotspots) | Done (16) | 4 | 02 Prototype playback |
| Live preview on a phone over the local network | Done (16) | 4 | 03 Mobile app (local equivalent) |

### H · Hand off (journey 5)

| State | Status | Phase | Inventory |
|---|---|---|---|
| Inspect mode: measurements, properties, code (CSS, Tailwind, SwiftUI, Compose) | Done (17) | 3, 4 | 03 Dev Mode: inspect panel; code snippets; measurements |
| Export card and export dialog (PNG, SVG, PDF at 1x/2x/3x) | Done (18) | 4 | 01 Import & export |
| Token export (JSON) | Done (18) | 4 | 02 Variables; 03 Dev Mode |
| Comments (pins, threads, resolve) | Done (20 · Comments) | 4 | 02 Comments |

### I · Save, version and share (journeys 1, 6)

| State | Status | Phase | Inventory |
|---|---|---|---|
| Version history panel (named versions, restore, compare) | Done (19) | 4 | 02 Branching and merging; 01 File utilities |
| Readable file diff for Git (outside the editor; spec only) | — (spec only, Phase 6) | 4 | PRD 6.2 file format |
| Preferences (theme, nudge amount, units, shortcuts) | Done (19) | 4 | 01 Interface & navigation |

## Cross-cutting states

These apply on every screen and get one spec each in Phase 2 or Phase 4.

| State | Phase |
|---|---|
| Hover, focus ring, pressed, disabled, mixed value, overridden, bound to variable | 2 (spec), 4 (components) |
| Tooltips with shortcuts | 4 |
| Right-click context menu (canvas, layers, pages) | 4 |
| ⌘K command palette and quick actions | 4 |
| Toasts and undo hints | 4 (component done) |
| Light mode | Done (20 · Light mode) |
| Docked-panel option for layout B (Figma reverted UI3 to docked) | Part (View menu option; docked layout not drawn) |
| Panels collapsed (canvas only, ⌘\) | Part (View menu: Hide interface) |

## Summary

| Area | Done | Part | Not yet |
|---|---|---|---|
| 45 step states above | 38 | 5 | 2 |

Updated after Phase 4 (13 October 2026). The canvas behaviours are specified in [interactions.md](interactions.md) (Phase 2), and the screens in sections 11–20. What is left: the docked-panel layout, prototype overlays, independent corner and effect detail states, and drag-to-reorder in Layers. These go to Phase 5 testing.
