# Illigma visual design

Status (2026-10-13): the dark-theme editor screen is designed and has passed three audit rounds. Development starts once the remaining core states are designed and approved.

## Where the design lives

Figma file **"Illigma"** (key `K9mCPjBElVGiPOHJvZ4CWY`), page **"Illigma — Editor v1"**.

| Section | Node | What it is |
| --- | --- | --- |
| Home — dark | `88:24` | The user's style reference: panels expanded (`88:25`) and collapsed (`88:541`) |
| Right panel — states | `88:785` | Style reference for the inspector cards (image, text, shape and adjustment states) |
| 06 · Design editor | `91:3182` | **Current Illigma editor screen** (`91:3183`, "component instance selected") plus a full-height inspector (`91:7975`) |
| 01–05 | — | Earlier explorations (brand directions, layouts, styles, Studio), kept for reference only |

The reference designs set Illigma's **look**: a dark shell with rounded cards, the colours, Inter type sizes, inspector cards, toggles, colour-coded layer types, blue selection and the lime active tool. They do **not** set its features. Illigma is a UI design tool like Figma, not a photo editor.

## Layout

- Title bar: 40 px, with file tabs, save state, zoom, Preview and Export.
- Tool rail: 52 px, with Figma-style grouped tools (Move, Frame, Shape, Pen, Text, Comment, Assets, Hand) and Actions ⌘K.
- Layers card: 264 px.
- Canvas card: dot grid.
- Properties card: 296 px.
- Spacing: cards have radius 16 and an 8 px gutter.
- Context bar: floats on the canvas for the current selection.
- Inspector cards: Align, Component, Position, Auto layout, Appearance, Fill, Selection colours, Stroke, Layout guide, Effects, Export, with Design / Prototype / Inspect tabs.

## Tokens

[`tokens.json`](tokens.json) holds the exported variable collection **"Illigma UI"** (Dark and Light modes) in W3C Design Tokens format:

- **Colours:** 36 tokens across shell, panels, text, accent, selection, layer types and canvas.
- **Dimensions:** 11 tokens for radius, size and spacing.
- **Text styles:** 9 `UI/*` styles, all in Inter.

| Use | Dark | Light |
| --- | --- | --- |
| Shell / canvas / panel / card | `#0C0C0E` / `#101012` / `#17171A` / `#1F1F23` | `#E9E9EC` / `#F4F4F6` / `#FFFFFF` / `#F6F6F8` |
| Field / border | `#2A2A30` / `#2C2C32` | `#ECECEF` / `#E2E2E6` |
| Text primary / secondary | `#EDEDF0` / `#8E8E98` | `#17171A` / `#6B6B75` |
| Accent (selection, primary) | `#3D8BFF` | `#2F7BF5` |
| Active tool | `#C6F432` | `#C6F432` |
| Component selection | `#9B6BFF` | `#8A4FFF` |

Icons: Lucide-style, 1.5 px stroke at every size (12–19 px).

## Design audit

Every new or changed screen is checked by a read-only audit agent. It covers:

- **A:** adoption of the reference style
- **B:** any photo-editor features that have crept in
- **C:** gaps against Figma, using [`../feature-inventory/`](../feature-inventory/) and PRD section 5
- **D:** the top fixes

## States still to design

1. **Core selection states:** auto layout parent (with padding and gap handles), text layer, nothing selected, mixed multi-selection, main component, variant set.
2. **Popovers and menus:** tool flyouts, colour and variable picker, instance ⋯ menu, swap instance, min/max, auto layout settings, right-click menu.
3. **Expanded sections:** stroke, drop shadow, independent corners, export, absolute position with constraints, nested instance or slot.
4. **Modes and views:** Prototype, Inspect, comments, rulers and guides, panels collapsed, light mode.
