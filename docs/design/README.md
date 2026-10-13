# Illigma visual design

**Design plan:** [PLAN.md](PLAN.md) (phases 1–6) · [principles.md](principles.md) · [core-loop.md](core-loop.md) (state map; replaces "States still to design" below).

Status (2026-10-13): the dark-theme editor screen is designed and has passed three audit rounds. Development starts once the remaining core states are designed and approved.

## Where the design lives

Figma file **"Illigma"** (key `K9mCPjBElVGiPOHJvZ4CWY`), page **"Illigma — Editor v1"**.

| Section | Node | What it is |
| --- | --- | --- |
| Home — dark | `88:24` | The user's style reference: panels expanded (`88:25`) and collapsed (`88:541`) |
| Right panel — states | `88:785` | Style reference for the inspector cards (image, text, shape and adjustment states) |
| 07 · Editor layout — B · Floating canvas (chosen) | `94:3118` | **Chosen Illigma editor layout** (`94:3119`): full-bleed canvas, floating Layers and Properties islands, bottom tool dock, context bar above the dock |
| Archive · other approaches | — | Approach A (old "06 · Design editor", `91:3182`), C (unified header) and D–H (philosophy explorations). Reference only |
| 01–05 | — | Earlier explorations (brand directions, layouts, styles, Studio), kept for reference only |

The reference designs set Illigma's **look**: a dark shell with rounded cards, the colours, Inter type sizes, inspector cards, toggles, colour-coded layer types, and blue selection. They do **not** set its features. Illigma is a UI design tool like Figma, not a photo editor.

## Layout (Approach B · Floating canvas)

- Title bar: 40 px on the shell colour, with file tabs, save state, zoom, Preview and Export.
- Canvas: full-bleed under the title bar (1600 × 960 at the reference size), dot grid, no card border.
- Layers island: 264 px wide, floating at an 8 px inset from the left and top, full height, radius 16, with a 1 px `border/default` stroke and a drop shadow.
- Properties island: 296 px wide, floating at an 8 px inset on the right, full height, with the same treatment.
- Tool dock: horizontal, centred on the visible canvas between the islands, 8 px from the bottom. It holds Figma-style grouped tools (Move, Frame, Shape, Pen, Text, Comment, Assets, Hand) and Actions ⌘K, split by dividers.
- Context bar: floats 8 px above the dock for the current selection.
- Spacing: islands have radius 16 and an 8 px gutter.
- Inspector cards: Align, Component, Position, Auto layout, Appearance, Fill, Selection colours, Stroke, Layout guide, Effects, Export, with Design / Prototype / Inspect tabs.

## Design system (2026-10-13)

Figma section **"00 · Design system"** (`94:12013`): a Foundations board (`94:12014`) and a Components board (`94:12872`).

- **Two variable collections.** "Illigma Primitives" holds raw ramps (neutral, ember, blue, green, red, amber, pink) and an alpha scale (white/black at 4–92%). "Illigma UI" (Dark / Light) holds the semantic tokens, and every one of them aliases a primitive. Components bind only to semantic tokens.
- **Brand roles.** Ember `#FF5B2E` is the brand only (logo, marketing, empty states). Blue is everything interactive: selection, focus, the active tool (blue fill, white icon), and components and instances (blue ◇). Purple and lime were removed on 2026-10-13.
- **Text is alpha, not grey hex.** `text/primary` / `secondary` / `tertiary` / `disabled` = white 92 / 70 / 50 / 32% in Dark and black 90 / 68 / 55 / 32% in Light, so text reads the same on every surface. Tertiary passes 4.5:1 on panel, card and field; disabled is for disabled states only.
- **Filled surfaces with text** use `accent/fill` (blue/700) and `state/danger-fill` (red/700), with hovers `accent/hover` (blue/750) and `state/danger-hover` (red/800), so white labels pass 4.5:1. `accent/default` stays the selection and focus colour.
- **Components:** Button, Icon button, Tool button, Input, Select, Toggle & checkbox, Tab, Layer row, Page row, Menu item (+ Menu example), Badge / key / avatar, Tooltip, Inspector card.
- **Board documentation text** uses `Doc/Display` 48/56 and `Doc/Heading` 24/32; UI text uses `UI/*` at 12/16 (Title 16/24).

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
| Active tool | `#3D8BFF` | `#2F7BF5` |
| Component selection | `#3D8BFF` | `#2F7BF5` |

**4 px grid (2026-10-13, universal):** every spacing, padding, gap, fixed size, radius and position is a multiple of 4. Type is on the grid too: font sizes are 12, 16 or 20 px (12 px is the minimum) and line heights 16 or 24 px. Text styles: `UI/Title` 16/24 Semi Bold; `UI/Heading` 12/16 Semi Bold; `UI/Button`, `UI/Value`, `UI/Tab`, `UI/Micro` 12/16 Medium or Semi Bold; `UI/Body`, `UI/Label`, `UI/Caption` 12/16 Regular. Hierarchy comes from weight and colour, not extra sizes. Icons are 12, 16 or 20 px. Only 1 px hairlines (dividers, borders) are exempt. Tokens updated to match: `radius/md` 8, `radius/tool` 8, `radius/button` 8, `radius/chip` 8, `size/row` 32.

Icons: Lucide, 1.2 px stroke at every size. This is a universal rule (2026-10-13). The **icon library** is the "Icons" board (`94:13574`) in "00 · Design system": 118 component sets named `icon/<lucide-name>` (from lucide-static 0.460.0, ISC licence), each with Size = 12 / 16 / 20, colour bound to `text/secondary`. An "Illigma custom" group holds icons Lucide lacks (inner/drop shadow, layer/background blur, noise, texture, corner-radius). Use instances from the library; never paste raw SVG.

**Corner smoothing:** every rounded corner uses 60% corner smoothing (2026-10-13, universal), including buttons, fields, cards, panels and menus.

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
