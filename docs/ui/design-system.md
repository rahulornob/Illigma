# Illigma editor UI design system

| | |
| --- | --- |
| **Status** | Planning phase. This is documentation only; no code exists yet. Every token, icon, component and checklist item below has status **Not started**. Nothing here claims parity with Figma or fidelity to Framer. |
| **Date** | 2026-10-08 |
| **Scope** | **Illigma's own editor chrome:** the window, navigation rail, sidebars, toolbar, controls, menus, popovers, dialogs, and the canvas chrome (selection, handles, guides, measurements, noodles). It does **not** cover user documents. Page backgrounds, fills, layout grids and prototype backgrounds are document data and render exactly as stored. |
| **Product rule** | Figma decides behavior, data and workflows. Framer decides how the chrome looks. When they conflict, follow Figma for behavior and Framer for looks. This document defines the look and the kit. Each component names the **Figma function** it serves; the behavior itself is specified in the parity specs (`docs/parity/*.md`). |
| **Inputs** | `docs/ui/framer-visual-reference.md` (cited as **FVR**): the visual evidence, source ids F1–U11, and decisions D-1…D-7. The user's previously approved tokens from the deleted prototype (`scratchpad/old/src/styles.css`, cited as **[USER-TOKENS]**). `docs/architecture.md` ADR-021 (SolidJS + Zag.js/Ark UI), ADR-022 (kit layers and workbench), ADR-024 (tests). Parity specs: `10-panels-shortcuts-workflow.md` (UX), `03-auto-layout.md` (AL), `05-paint-effects-color-export.md` (PE), `06-text-typography.md` (TX), `07-components-variants.md` (CP), `08-variables-styles-design-systems.md` (DS), `09-prototyping.md` (PR). |
| **Checklist prefix** | `KIT-` (§7). The visual acceptance items `FVR-001…036` in FVR §13 remain valid. KIT items cover tokens, the kit's components and the kit's behavior contracts. |

---

## 0. How to read this document

### 0.1 Evidence tags

| Tag | Meaning |
| --- | --- |
| `[API]` | Figma Plugin API typings v1.141.0 / REST API types v0.44.0, read locally in this session. |
| `[DOC:<id>]` | Official Figma Help Center article. "excerpt" means only a search-engine excerpt was seen in this session, not the article body. |
| `[OBS]` | The read-only live-Figma observation of 2026-09-27. |
| `[SRC:<id or url>]` | Other web or package source. Ids F1, F3, G1–G8, T1, D1, N1–N2 and U1–U11 are defined with their URLs in FVR §0. "excerpt" = search excerpt only. |
| `[USER-TOKENS]` | The user's previously approved values in the old prototype's `styles.css` (read in full in this session). |
| `[KNOW]` | The author's background knowledge, **not verified in this session**. |
| `[COMPUTED]` | A WCAG 2.x contrast ratio computed in this session from the hex values shown (sRGB relative luminance). |
| `[DECISION]` | A design decision made by this document for Illigma. It needs no external evidence but can be overruled by the user. |

Any behavioral claim that rests only on `[KNOW]` or a third-party source and affects correctness is repeated in §9, *Needs live Figma verification*. No live Figma or Framer session, screenshot or video was inspected for this document. help.figma.com and framer.com could not be fetched; Help Center content appears only as search excerpts.

### 0.2 Status of every value

| Label | Meaning | Who can change it |
| --- | --- | --- |
| **locked (user-approved)** | The value appears in the user's previous token file or prototype, or it is a layout decision the user confirmed previously. | Only the user. CI guards it (KIT-006). |
| **proposed** | New in this document. It comes from Framer evidence, an accessibility requirement or design reasoning. When it replaces a user value, the decision id that asks the user is named. | The user approves or rejects it through the decision table (§8). |
| **verify against Framer** | A placeholder resting on `[KNOW]` or on missing evidence. Lock it from the captures listed in FVR "Verification needed". | Becomes locked or proposed after sampling. |

Combined labels such as "proposed · verify" are allowed. In tables, the labels are abbreviated as **L**, **P** and **V**.

---

## 1. Principles

### P-1. Framer look, Figma function

- Every control, option, enum, default, keyboard path and order comes from Figma ([API], help articles, [OBS]). The Framer skin may change only colour, type, radius, spacing, iconography, elevation and motion (FVR M-1).
- The kit never invents, removes, merges, renames or reorders a Figma option. Section names stay Figma's: Position, Layout, Appearance, Typography, Fill, Stroke, Effects, Layout guide, Export [OBS].
- An Illigma-only affordance, such as the "−/+" buttons in the zoom pill, is labelled **Illigma extension** in this document. It may only call an existing Figma command, and it never replaces the Figma path to that command.
- Every component in §5 names the Figma function and data it edits.

### P-2. Density: Framer rhythm, Figma's field set

- The rhythm is Framer's: 30 px controls, a 40 px property-row pitch, 15 px gutters and 10 px gaps [SRC:F1, G3, G5].
- The field set is Figma's, which is denser than Framer's. Multi-field rows (X/Y, W/H, padding, corner radii, typography metrics) drop the left label and use 2-up or 4-up inputs with prefix glyphs (FVR M-4).
- Figma's **Property labels** view option (being renamed **Additional labels**) shows labels for fields [DOC:23954856027159 excerpt]. Illigma implements the same toggle. With it on, rows show labels above or below the fields. This is the only user-initiated layout change in the inspector.
- Interface scale follows Figma's "Interface scale" command (make larger / reset; ⌥⇧⌘= and ⌥⇧⌘0 on macOS) [DOC:35063862380311 excerpt]. It scales every chrome size token uniformly (§6.4).
- One density ships at M0. A compact density (24 px controls, 32 px pitch) is a P2 option and must not be built before M8.

### P-3. Keyboard-first

- Every chrome action has a keyboard path. Shortcuts are Figma's, owned by `10-panels-shortcuts-workflow.md` §5, and are displayed with platform glyphs: ⌘ ⌥ ⇧ ⌃ on macOS, and Ctrl, Alt, Shift on Windows and Linux.
- **Region cycling:** F6 / ⌃F6 moves focus between the top-level regions. Tab / ⇧Tab moves within a region and through canvas layers [DOC:35063862380311 excerpt]. The region order is rail → left sidebar → canvas → toolbar → right sidebar (§4.8). The order is `[KNOW]`; verify it (§9 V-UI-01).
- **Composite widgets** use a roving tabindex with arrow keys inside: toolbar, tabs, segmented controls, alignment matrix, constraints widget, menus, variables table. The layers tree is the exception. In Figma, ↑/↓ nudge the canvas selection and never move row focus [`10-panels…` §3.2, KNOW]. The tree therefore moves focus with Tab/⇧Tab, and arrows keep nudging (§5.32; verify V-UI-02).
- **Typing:** global single-key shortcuts are suspended while a text or number field has focus (ADR-027 scoped keymap). Figma also offers a preference to ignore Figma shortcuts in text fields [DOC:35063862380311 excerpt]. Focusing a numeric field selects its whole value.
- **Esc** closes the innermost popover or menu first. In a field it reverts the edit. On the canvas it is handled by CV.

### P-4. No layout shift

1. All numeric displays use tabular figures: inputs, rulers, measurement pills, the W × H badge and the zoom %.
2. Hover-revealed actions (eye, lock, +, −, grip, detach) keep their space reserved. They animate `opacity` and `visibility` only, never `display` or width.
3. Control heights are fixed by tokens. "Mixed", style chips and variable chips all fit inside the same 30 px control box. A chip is 22 px tall.
4. Errors never insert text below a field. An error is shown as an inset danger ring plus a tooltip, and the value reverts on blur as Figma does [KNOW].
5. Scroll containers use overlay scrollbars or `scrollbar-gutter: stable`, so content width never changes when a scrollbar appears.
6. A new selection renders its inspector in the same frame, with no skeleton flash for local data. Async content (font previews, image thumbnails) uses fixed-size placeholders.
7. Fonts are bundled and loaded before first paint, so there is no flash of unstyled or invisible text.
8. Tooltips, toasts, menus and popovers are overlays and never reflow panels.
9. Panel widths change only when the user resizes them.

### P-5. Accessibility (target: WCAG 2.2 AA)

Figma states it is working toward WCAG 2.2 AA [DOC:35063862380311 excerpt]. Illigma's chrome targets the same level.

- **Text contrast.** All informative chrome text is 10–13 px, so none of it counts as "large text". It must reach **4.5:1** against the surface it sits on, in every state. §2.2.8 lists the computed ratios. Consequences:
  - Tertiary grey is restricted to disabled text and decorative glyphs.
  - Placeholders and units use `--ill-text-placeholder`.
  - Text on accent, danger and component fills uses the darker `*-fill` tokens.
- **Non-text contrast** (1.4.11). Control boundaries that carry meaning, state indicators, meaningful icons and focus indicators need **3:1** against adjacent colours.
- **Visible focus** (2.4.7 and 2.4.11):
  - Inputs show an inset 1 px accent ring [SRC:F1].
  - Every other control shows a 2 px outline at 2 px offset, for keyboard focus only [USER-TOKENS].
  - A focused element must never be hidden under the floating toolbar or a popover. The scroll-into-view logic includes the toolbar inset.
- **Target size** (2.5.8). Every interactive hit area is at least **24 × 24 CSS px**, even when its glyph is 12–16 px. This raises FVR's 20 px eye/lock hit area (proposed).
- **Reduced motion.** Honour `prefers-reduced-motion: reduce` and an in-app preference. Durations drop to 0, except opacity fades of 100 ms or less. Nothing slides or scales.
- **Forced colours.** Under `forced-colors: active` (Windows High Contrast), chrome maps to system colours (`Canvas`, `CanvasText`, `ButtonText`, `Highlight`, `GrayText`). Canvas chrome draws in `Highlight`.
- **Never colour alone.** Component state uses an icon plus colour. Errors use a ring plus a tooltip. An overridden property uses a dot plus a tooltip.
- **Screen readers.** ARIA roles come from Zag.js machines (menu, listbox, tree, tablist, slider, spinbutton, dialog, tooltip). Toasts and the save status are polite live regions. The canvas accessibility tree belongs to CV/M8, not the kit.
- **Scale.** Chrome survives 200 % interface scale (1.4.4). Panels scroll; nothing is clipped.

### P-6. Calm chrome that never hides state

Thin strokes, no glows, no gradients, and quiet elevation (FVR §1). If a minimal treatment would hide a Figma state (mixed values, overrides, detached styles, missing fonts, invalid values, read-only fields), the kit adds a visible indicator built from existing primitives (FVR M-8).

### P-7. Canvas chrome is screen-space and immediate

- Selection, handles, guides, measurements and noodles are drawn by the render core's overlay pass (ADR-003), not by the DOM.
- They use constant screen-pixel widths at every zoom and are DPR-aware.
- They are never animated: feedback tracks the pointer one-to-one.
- Their colours come from the same token source as CSS (§6.3).

### P-8. Two themes from M0

- **Dark is the default** (confirmed). Light ships in M0. **Use system theme** follows the OS. Figma offers the same three choices, and the setting is device-specific [DOC:5576781786647 excerpt].
- The theme is an app preference, never document data. Switching theme never edits the document and never adds an undo step.
- Page backgrounds are data. Figma sets a new file's canvas colour from the theme active **at file creation** (#F5F5F5 light, #1E1E1E dark) [DOC:360041064814 excerpt]. See D-8.

### P-9. Local-first status is always visible

The file header always shows the document's save state: Saved, Saving…, Unsaved changes, Recovered, or Save failed (ADR-017/018). This is Illigma's equivalent of Figma's connection status, and it uses the same toast and indicator primitives.

---

## 2. Design tokens

### 2.1 Token architecture and naming

- **Three tiers.**
  1. **Palette.** Raw values, such as `gray.900 = #141414`. Components never reference the palette.
  2. **Semantic.** `--ill-*` roles. These are what components use.
  3. **Component.** Rare, for geometry that belongs to one component, such as `--ill-layer-indent`.
- **Source of truth.** `packages/ui-tokens/tokens.json` holds every token with its themed values, status, evidence and decision id. A build step generates the CSS custom properties, TypeScript constants, `.d.ts` types, the canvas-chrome RGBA table (§6.3) and the tables in this section (§6.1).
- **Naming.**
  - Colour roles are `--ill-<role>`. They keep FVR §2.2's names (`--ill-panel`, `--ill-surface-2`, `--ill-control`, …) and extend them.
  - Other categories are `--ill-<category>-<name>`, where the category is one of `font`, `fs` (font size), `lh`, `fw`, `tracking`, `space`, `size`, `radius`, `border`, `shadow`, `blur`, `dur`, `delay`, `ease` or `z`.
- **Mapping from the user's previous names** [USER-TOKENS]:

  | Old | New | Note |
  | --- | --- | --- |
  | `--canvas-void` | `--ill-canvas` | Chrome "void" colour; see D-8 for page backgrounds. |
  | `--panel-surface` | `--ill-panel` | |
  | `--hover-active` | `--ill-surface-2` | |
  | `--text-primary` | `--ill-text` | |
  | `--text-muted` | `--ill-text-2` | |
  | `--border` | `--ill-divider` | |
  | `--accent` | `--ill-accent` | |
  | `--panel-padding` | `--ill-gutter` | |
  | `--pill-radius` | `--ill-radius-pill` | D-3 |
  | `--panel-shadow` | `--ill-shadow-float` | |
  | `--panel-highlight` | `--ill-highlight-top` | |
  | `--selection-glow` | (dropped) | Proposed: Framer chrome uses no glows (FVR M-5). |
  | `--grid: 8px` | `--ill-space-*` | Superseded if D-5 adopts the 5 px base. |

### 2.2 Colour tokens

Columns: **CSS custom property · Role · Dark (default) · Light · Status · Evidence.** Colours are sRGB hex or `rgba()`.

#### 2.2.1 Surfaces, by elevation

| Property | Role | Dark | Light | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| `--ill-canvas` | e0 **chrome void**: shown where no page background is drawn yet (first frame, file browser, workbench, behind the player chrome). **Not** the page background, which is data (D-8). | `#090909` | `#f5f5f5` | dark **L**; light **P · V** | [USER-TOKENS] `--canvas-void`; light = Figma's default light canvas [DOC:360041064814 excerpt] |
| `--ill-panel` | e1 docked surfaces: rail, sidebars, floating toolbar, zoom pill, modal body | `#141414` | `#ffffff` | dark **L** (D-6 open: Framer `#111111`); light **P** | [USER-TOKENS]; [SRC:G1, G2] |
| `--ill-surface-2` | e2 row hover, cards, segmented track, interaction cards | `#1c1c1c` | `#eeeeee` | dark **L**; light **P** | [USER-TOKENS] `--hover-active`; [SRC:G1] |
| `--ill-control` | Idle fill of inputs, selects, steppers and secondary buttons | `#2b2b2b` | `#f3f3f3` | **P** (D-4; user: `#1c1c1c` + `#292929` border) | [SRC:G1, T1] |
| `--ill-control-hover` | Control hover | `#303030` | `#eeeeee` | dark **P · V**; light **P** | Dark value chosen so `#999` text keeps 4.63:1 [COMPUTED]; light [SRC:G1] |
| `--ill-control-active` | Pressed control | `#232323` | `#dddddd` | **P** | [SRC:F1] |
| `--ill-control-edge` | Control border (none in the Framer look) | `transparent` | `transparent` | **P** (D-4 option B: `#292929` / `#e5e5e5`) | [SRC:F1] borderless controls |
| `--ill-raised` | Segmented active indicator, switch knob track "on" surface | `#474747` | `#ffffff` | **P · V** | [SRC:G3] (`#555` in older [SRC:G4]) |
| `--ill-elevated` | e3 menus, dropdowns, popovers, colour picker, variable picker | `#1c1c1c` | `#ffffff` | dark **L**; light **P** | [USER-TOKENS] context menu and effect popover `#1c1c1c` |
| `--ill-tooltip` | Tooltip surface | `#222222` | `#222222` | **L** (light stays dark: **V**) | [USER-TOKENS] `.tool-tip`; [KNOW] |
| `--ill-toast` | Toast surface | `#242424` | `#242424` | dark **L**; light **V** | [USER-TOKENS] `#toast` |
| `--ill-modal` | Dialog surface | `#141414` | `#ffffff` | dark **L**; light **P** | [USER-TOKENS] `dialog`; [SRC:G2] |
| `--ill-scrim` | Modal backdrop | `rgba(0,0,0,.6)` | `rgba(0,0,0,.2)` | dark **L** (FVR proposes `.5`); light **P · V** | [USER-TOKENS] `#0009`; [SRC:G1] |
| `--ill-code-bg` | Code and CSS blocks (Copy as code, CSS export preview) | `#141414` | `#fdfdfd` | **P** | [SRC:G1] |

#### 2.2.2 Borders, edges and focus

| Property | Role | Dark | Light | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| `--ill-divider` | Separators between panels, sections and list groups | `#262626` | `#eeeeee` | dark **L**; light **P** | [USER-TOKENS] `--border`; [SRC:G1] |
| `--ill-edge` | 1 px edge of floating surfaces (toolbar, popovers) | `rgba(255,255,255,.07)` | `rgba(0,0,0,.08)` | **P** | Equivalent to the user's `#262626` border on `#141414` [USER-TOKENS]; FVR §2.2 |
| `--ill-edge-strong` | 1 px edge of menus, tooltips and dialogs | `#363636` (menus) / `#333333` (tooltip, dialog) | `rgba(0,0,0,.10)` | dark **L**; light **P** | [USER-TOKENS] context menu `#363636`, tooltip and dialog `#333` |
| `--ill-highlight-top` | Top-lit inner edge of raised and floating surfaces | `inset 0 .5px 0 rgba(255,255,255,.22)` (menus `.094`) | `none` | dark **L**; light **P** | [USER-TOKENS] `--panel-highlight`, context menu `#ffffff18` |
| `--ill-focus` | Focus ring and outline | `#0099ff` | `#0077ff` | dark **L**; light **P** | [USER-TOKENS]; light needs 3:1 against `#f3f3f3`: `#0099ff` = 2.70, `#0077ff` = 3.72 [COMPUTED] |
| `--ill-drop-indicator` | Drag-and-drop insertion line or target ring | `#0099ff` | `#0099ff` | **L** | [USER-TOKENS] `.layer-row.drag-over` |

#### 2.2.3 Text

| Property | Role | Dark | Light | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| `--ill-text` | Primary text, values, layer names | `#ffffff` | `#333333` | dark **L**; light **P** | [USER-TOKENS]; [SRC:G1] |
| `--ill-text-strong` | Titles (differs only in light) | `#ffffff` | `#222222` | **P** | [SRC:G2] |
| `--ill-text-2` | Labels, secondary text, shortcut hints, idle icons | `#999999` | `#666666` | dark **L**; light **P** | [USER-TOKENS] `--text-muted`; [SRC:G1, G2] |
| `--ill-text-3` | **Restricted:** disabled text, decorative glyphs and idle meaningful icons (needs 3:1 only). Never informative text. | `#777777` | `#8a8a8a` | dark **L** (role restricted: D-7); light **P** | [USER-TOKENS] `.muted-icon #777`; light `#8a8a8a` = 3.45 on white [COMPUTED] (Framer `#999` = 2.85 fails 3:1) |
| `--ill-text-placeholder` | Placeholders, units (`px`, `%`, `°`) and split-input sub-labels | `#999999` | `#6b6b6b` | **P** (D-7) | 4.97 on `--ill-control`, 4.63 on hover (dark); 4.80 on `#f3f3f3` (light) [COMPUTED] |
| `--ill-on-accent` | Text and icons on accent, danger and component fills | `#ffffff` | `#ffffff` | **L** | [USER-TOKENS] `.primary` |
| `--ill-code-text` | Code text | `#eeeeee` | `#666666` | **P** | [SRC:G1] |

#### 2.2.4 Accent and selection

| Property | Role | Dark | Light | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| `--ill-accent` | Non-text accent: selection outline, focus, checked controls, active tool fill, icons, noodles | `#0099ff` | `#0099ff` | **L** | [USER-TOKENS]; [SRC:F1, G1] "Framer Blue" |
| `--ill-accent-hover` | Hover of non-text accent fills | `#0088ff` | `#0088ff` | **P** (replaces user `#168ff0`) | [SRC:G1] |
| `--ill-accent-pressed` | Pressed non-text accent fills | `#0077ff` | `#0077ff` | **P** | [SRC:F1] |
| `--ill-accent-fill` | Accent fills that **carry text**: primary button, highlighted menu item, W × H badge, flow badge | `#0073e6` | `#0073e6` | **P** (D-7) | White text = 4.57:1. White on `#0099ff` is only 3.00:1 [COMPUTED]. |
| `--ill-accent-fill-hover` | Hover of the above | `#0068d1` | `#0068d1` | **P** | White = 5.38 [COMPUTED] |
| `--ill-accent-fill-pressed` | Pressed | `#005cb8` | `#005cb8` | **P** | White = 6.52 [COMPUTED] |
| `--ill-accent-text` | Accent used as text (active text tab in light, link-like actions) | `#0099ff` | `#0073e6` | **P** | 6.14 on `#141414`; 4.57 on white [COMPUTED] |
| `--ill-accent-dim` | Selected row background, text selection, active chip background | `rgba(0,153,255,.15)` | `rgba(0,153,255,.10)` | **P** | [SRC:G1, F1] |
| `--ill-accent-dim-2` | Band behind descendants of a selected container (layers) | `rgba(0,153,255,.06)` | `rgba(0,153,255,.05)` | **P · V** | FVR §8.2; Figma band [KNOW] |
| `--ill-text-selection-bg` / `-fg` | `::selection` inside inputs | `--ill-accent-dim` / `--ill-accent-text` | same | **P** | [SRC:F1] 3.0 change |

#### 2.2.5 Component family (purple)

| Property | Role | Dark | Light | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| `--ill-component` | Non-text purple: component, instance and slot outlines, handles, type icons, property-type glyphs | `#8855ff` | `#8855ff` | **V** | [SRC:U10] purple for components; the hex is [KNOW] |
| `--ill-component-text` | Purple **text**: component and instance names in Layers and Assets, the instance header, purple chips | `#9a70ff` | `#7040e8` | **P** | 5.38 on `#141414`, 4.98 on `#1c1c1c`; light 5.85 on white [COMPUTED] (`#8855ff` gives 4.20 and 4.38, which fail) |
| `--ill-component-dim` | Selected component-family row and purple chip background | `rgba(136,85,255,.15)` | `rgba(136,85,255,.10)` | **P** | Mirrors accent-dim |
| `--ill-component-fill` | Purple fills that carry text (for example the "Update" button for library components) | `#7b4cf5` | `#7b4cf5` | **P** | White = 5.01 [COMPUTED]; [SRC:U10] |
| `--ill-component-fill-hover` | Hover | `#6b38e0` | `#6b38e0` | **P** | White = 6.43 [COMPUTED] |

#### 2.2.6 Status and overlays

| Property | Role | Dark | Light | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| `--ill-danger` | Destructive glyphs, error rings, destructive menu text (dark) | `#ff3366` | `#ff3366` | **P** | [SRC:G6, T1]; 5.19 on `#141414` [COMPUTED] |
| `--ill-danger-text` | Destructive or error **text** | `#ff3366` | `#e5195a` | **P** | Light 4.55 on white [COMPUTED] |
| `--ill-danger-fill` / `-hover` | Destructive button, highlighted destructive menu item, error badge | `#e5195a` / `#d40f4e` | same | **P** | White 4.55 / 5.28 [COMPUTED]; Framer `#ff3366` = 3.55 fails |
| `--ill-warning` | Warning glyphs: missing font, outdated library, legacy layout | `#ff9500` | `#ff9500` | **P** | [SRC:G7 excerpt] |
| `--ill-warning-text` | Warning text | `#ff9500` | `#b35c00` | **P** | Dark 8.38; light 4.72 on white [COMPUTED] |
| `--ill-success` / `-text` | Success glyph / text (toasts, "Saved") | `#00cc88` / `#00cc88` | `#00b87a` / `#00875a` | **P** | [SRC:G1]; light text 4.55 [COMPUTED] |
| `--ill-info` | Info glyph | `= --ill-accent` | same | **P** | [SRC:D1] four toast variants |
| `--ill-overlay-hover` | Hover tint on coloured surfaces (for example inside a selected row) | `rgba(255,255,255,.10)` | `rgba(0,0,0,.05)` | dark **L**; light **P** | [USER-TOKENS] `.layer-row button:hover` |
| `--ill-overlay-press` | Press tint | `rgba(255,255,255,.20)` | `rgba(0,0,0,.10)` | dark **L**; light **P** | [USER-TOKENS] selected-row button hover |
| `--ill-media-scrim` | Translucent back of small on-canvas or on-media buttons | `rgba(0,0,0,.5)` | `rgba(0,0,0,.5)` | **P** | [SRC:T1] (with 10 px blur) |

#### 2.2.7 Canvas chrome

All canvas chrome is drawn in screen space and does not scale with zoom (P-7). It sits over **user content of any colour**, so contrast cannot be guaranteed. Mitigations are thin outlines, white-filled handles with accent strokes, and pills with their own fill. A "high-contrast canvas chrome" preference is a P2 option.

| Property | Role | Dark | Light | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| `--ill-sel` | Selection bounds, multi-selection outlines, hover outline | `#0099ff` | `#0099ff` | **L** | [USER-TOKENS] `.selection-box`; [SRC:U11] |
| `--ill-sel-handle-fill` / `-stroke` | Resize handles | `#ffffff` / `#0099ff` | same | **L** (size and shape **V**) | [USER-TOKENS] `.selection-handle` |
| `--ill-marquee-fill` | Marquee fill (stroke = `--ill-sel`) | `rgba(0,153,255,.07)` | same | **L** | [USER-TOKENS] `#0099ff12` |
| `--ill-wh-badge-bg` / `-text` | W × H size badge under a selection | `--ill-accent-fill` / `#ffffff` | same | **P · V** | User drew accent-coloured text with no pill [USER-TOKENS]; pill per FVR §9 [KNOW]; AA via `--ill-accent-fill` |
| `--ill-frame-label` / `-active` | Frame and section titles idle / hovered or selected | `#999999` / `#0099ff` | `#666666` / `#0073e6` | **P · V** | FVR §9 [KNOW]; [USER-TOKENS] `#artboard-label:hover` accent |
| `--ill-guide` | Smart alignment guides and ruler guides | `#ff3366` | `#ff3366` | **P · V** | Figma's guides and ⌥ measurements are red [SRC:https://forum.figma.com/ask-the-community-7/red-alignment-lines-not-showing-in-figma-desktop-app-28706 excerpt]; Framer red [SRC:G6]; Framer's own guide colour is unknown |
| `--ill-guide-selected` | A selected ruler guide | `#0099ff` | `#0099ff` | **P · V** | [KNOW] |
| `--ill-measure` / `--ill-measure-fill` | ⌥-hover distance lines / their value pills (white 11/600 text) | `#ff3366` / `#e5195a` | same | **P · V** | Lines as `--ill-guide`; pill fill darkened for AA (white 4.55) [COMPUTED] |
| `--ill-layout-overlay` | Auto layout gap and padding hatches and handles, equal-spacing markers | `#f24fd3` | `#f24fd3` | **P · V** | Figma shows **pink** overlays [DOC:360040451373 excerpt via `03-auto-layout.md` §3.17]; no Framer evidence |
| `--ill-layout-overlay-fill` | Value pills for the above (white text) | `#c2189f` | `#c2189f` | **P · V** | White 5.35 [COMPUTED] |
| `--ill-ruler-bg` / `-tick` / `-text` | Ruler strip / ticks / numbers | `#141414` / `#777777` / `#999999` | `#ffffff` / `#8a8a8a` / `#666666` | **P · V** | FVR §9 [KNOW] |
| `--ill-ruler-sel` | Selection-extent band on rulers | `--ill-accent-dim` | same | **P · V** | [KNOW] |
| `--ill-noodle` | Prototype connections, hotspot outline, connection handle | `#0099ff` | `#0099ff` | **P · V** | Figma connections are blue [KNOW]; [DOC:4411431245335 excerpt] names them "connections" |
| `--ill-flow-badge` | Flow starting-point badge (white text) | `--ill-accent-fill` | same | **P** | [DOC:360039823894 excerpt via `09-prototyping.md`] |
| `--ill-slot-outline` | Empty-slot highlight and drop target | `#8855ff` dashed 1 px | same | **P · V** | `07-components-variants.md` §4.6 |
| `--ill-caret` | Text caret | `#0099ff` | `#0099ff` | **P · V** | FVR §9 |
| `--ill-anchor-fill` / `-stroke` | Vector anchor points | `#ffffff` / `#0099ff` | same | **L** | [USER-TOKENS] `.anchor-point` |
| `--ill-anchor-selected-fill` | Selected anchor point (stroke white) | `#0099ff` | same | **P** | FVR §9 |
| `--ill-bezier` | Bézier handle lines and dots | `#0099ff` | same | **L** | [USER-TOKENS] `.anchor-line`, `.anchor-control` |
| `--ill-pixel-grid` | Pixel grid at high zoom | `rgba(255,255,255,.08)` | `rgba(0,0,0,.08)` | **P · V** | Figma shows the pixel grid at ≥ 400 % [old `feature-guide.md` §8, DOC:360041065034] |
| `--ill-canvas-focus` | Keyboard focus box around a canvas layer (dashed 1 px) | `#0099ff` | `#0077ff` | **P** | Figma draws a pink dashed focus box [SRC:https://forum.figma.com/suggest-a-feature-11/keyboard-navigation-focus-indicator-43575 excerpt]; Illigma uses the focus colour |

**Document data, not chrome.** These render exactly as stored and have no tokens: layout grids (`LayoutGrid.color` [API]), page backgrounds (`PageNode.backgrounds` [API]), prototype backgrounds (`prototypeBackgrounds` [API]) and guides' document positions.

#### 2.2.8 Contrast matrix (dark / light) [COMPUTED]

| Pair | Ratio | Requirement | Result |
| --- | --- | --- | --- |
| `--ill-text` `#fff` on `--ill-panel` `#141414` | 18.42 | 4.5 | Pass |
| `--ill-text-2` `#999` on `#141414` / on `#1c1c1c` / on `--ill-control` `#2b2b2b` / on `#303030` | 6.47 / 5.98 / 4.97 / 4.63 | 4.5 | Pass |
| `#999` on `--ill-tooltip` `#222` | 5.58 | 4.5 | Pass |
| `--ill-text-3` `#777` on `#141414` / `#2b2b2b` | 4.11 / 3.16 | 3.0 (icons only) | Pass as icon; **fails as text**, hence restricted |
| `--ill-accent` `#0099ff` on `#141414` / `#2b2b2b` | 6.14 / 4.72 | 3.0 (non-text) | Pass |
| White on `#0099ff` (Framer primary) | 3.00 | 4.5 (text) | **Fails**. Use `--ill-accent-fill` `#0073e6` = 4.57 |
| White on `#ff3366` | 3.55 | 4.5 | **Fails**. Use `--ill-danger-fill` `#e5195a` = 4.55 |
| `#8855ff` as text on `#141414` | 4.20 | 4.5 | **Fails**. Use `--ill-component-text` `#9a70ff` = 5.38 |
| Light `#333` on white | 12.63 | 4.5 | Pass |
| Light `#666` on white / `#f3f3f3` / `#eee` | 5.74 / 5.17 / 4.95 | 4.5 | Pass |
| Light `#999` on white | 2.85 | 3.0 | **Fails** even as an icon. Light `--ill-text-3` = `#8a8a8a` (3.45) |
| Light focus `#0099ff` / `#0077ff` vs `#f3f3f3` | 2.70 / 3.72 | 3.0 | `#0077ff` passes |
| `#ff3366` guide vs light canvas `#f5f5f5` | 3.26 | 3.0 | Pass |

The automated contrast test (KIT-008) checks every text token against every surface it is allowed on, in both themes.

### 2.3 Typography

| Property | Value | Status | Evidence / note |
| --- | --- | --- | --- |
| `--ill-font-ui` | `"Inter Variable", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif` | **L** (Inter) | [USER-TOKENS] `font-family: Inter`. Bundle Inter **4.x** locally (OFL-1.1): `inter-ui@4.1.1` (2025-06-22) or `@fontsource-variable/inter@5.3.0` (architecture Appendix A). Confirm the bundled build contains `cv11` (KIT-011). |
| `--ill-font-mono` | `"JetBrains Mono Variable", ui-monospace, "SF Mono", Menlo, Consolas, monospace` | **P** | Framer uses Input Mono [SRC:G1], which is not freely licensable. JetBrains Mono is OFL (`@fontsource-variable/jetbrains-mono@5.3.0`). |
| `--ill-font-features` | `"cv01", "cv05", "cv09", "cv11"` on all chrome text | **P · V** | Framer 3.0 global alternates [SRC:F1, G2, F4] |
| `--ill-font-numeric` | `font-variant-numeric: tabular-nums` on inputs, rulers, pills, zoom %, coordinates, variables-table number cells | **P** | [SRC:F1] `tnum` on numeric inputs |
| Rendering | `-webkit-font-smoothing: antialiased; font-synthesis: none; text-rendering: optimizeLegibility` | **L** (`font-synthesis`) / **P** | [USER-TOKENS]; [SRC:F1] |

**Scale.** One family and few sizes. Weight carries emphasis; grey level carries secondary information.

| Token (size / line-height) | px | Weight(s) | Used for | Status |
| --- | --- | --- | --- | --- |
| `--ill-fs-10` / `--ill-lh-10` | 10 / 14 | 500 | Split-input sub-labels, ruler numbers, file-badge and save-status meta | **P · V** (user used 10 px for save status [USER-TOKENS]) |
| `--ill-fs-11` / `--ill-lh-11` | 11 / 16 | 500 / 600 | Menu section labels (600), canvas labels (frame titles 500; measurement pills and W × H badge 600), counters, kbd in menus | **P · V** |
| `--ill-fs-12` / `--ill-lh-12` | **12 / 18** | **500** default, **600** emphasis | Everything else: labels, values, layer names, menu items, tabs, buttons, tooltips | Size **L** [USER-TOKENS]; line-height **P** [SRC:F1]; weight **P** (D-11: the user default was 400) |
| `--ill-fs-13` / `--ill-lh-13` | 13 / 20 | 600 | Modal, panel and popover titles | **P · V** |
| `--ill-fs-24` / `--ill-lh-24` | 24 / 30 | 500 | Display: file browser, onboarding, empty states, large dialog titles such as Keyboard shortcuts | **P** (the user's dialog `h2` was 25 px / 500 / −0.7 px [USER-TOKENS]; rounded onto the scale) |

| Weight token | Value | Use | Status |
| --- | --- | --- | --- |
| `--ill-fw-regular` | 400 | Code and long help text only | **P** |
| `--ill-fw-medium` | 500 | Default chrome text | **P** (D-11) |
| `--ill-fw-semibold` | 600 | Section titles, buttons, active tab or segment, menu section labels, pills | **L** (the user's inspector headings used 600) |

| Tracking token | Value | Use | Status |
| --- | --- | --- | --- |
| `--ill-tracking` | `0` | All chrome text | **P** (drops the user's `0.05px` on headings) |
| `--ill-tracking-display` | `-0.02em` | `--ill-fs-24` only | **P** (≈ the user's −0.7 px at 25 px) |

**Rules.**
- No weight other than 400, 500 and 600. In particular no 550 or 650 variable-font weights, which render differently across platforms.
- Values never wrap. Labels and names truncate with an ellipsis, and the full text appears in a tooltip after the tooltip delay.
- Canvas text (frame titles, pills, badge) uses the same font but is rasterized by the render core at the device pixel ratio. It never scales with zoom.
- Keyboard-shortcut **sheet**: the `kbd` chip is `#252525` background, 1 px `#373737` border, radius 4, padding 3 × 6, 12 px, `#bbbbbb` [USER-TOKENS] (**L**). In menus and tooltips, shortcuts are plain `--ill-text-2` text. The user used `#888` in tooltips; `--ill-text-2` keeps AA (P).

### 2.4 Spacing

**Base unit 5 px** (proposed, D-5). Framer's plugins use `--spacing: 5px` [SRC:G1, G2], and the user's own 15 px gutter sits on that grid. The values 2, 4, 6 and 8 are allowed **inside** components for icon gaps and insets. The floating toolbar keeps its user-approved 8 px padding and gap.

| Property | Value | Status | Use |
| --- | --- | --- | --- |
| `--ill-space-1` | 1px | P | Hairline nudges |
| `--ill-space-2` | 2px | P | Segmented inset [SRC:F1, G4] |
| `--ill-space-4` | 4px | P | Swatch inset in a colour input [SRC:G3]; chip padding |
| `--ill-space-5` | 5px | P | Row padding above and below a 30 px control (40 px pitch); menu padding |
| `--ill-space-6` | 6px | P | Icon–label gap in rows; tooltip offset |
| `--ill-space-8` | 8px | **L** (toolbar) / P (inputs) | Toolbar padding and gap [USER-TOKENS]; input inner padding [SRC:F1] |
| `--ill-space-10` | 10px | P | Gap between controls, horizontal and vertical [SRC:G3, G5, T1] |
| `--ill-space-15` | 15px | **L** | Panel gutter [USER-TOKENS] `--panel-padding` |
| `--ill-space-20` | 20px | **L** (toolbar offset) | Toolbar distance from the canvas bottom [USER-TOKENS]; toast offset above the toolbar |
| `--ill-space-30` | 30px | P | Empty-state padding |
| `--ill-space-40` | 40px | P | Dialog body sections |

| Semantic alias | Value | Status |
| --- | --- | --- |
| `--ill-gutter` | `--ill-space-15` | **L** |
| `--ill-gap` | `--ill-space-10` | P |
| `--ill-gap-sm` | `--ill-space-5` | P |
| `--ill-control-pad-x` | `--ill-space-8` (select: `0 20px 0 8px`) | P [SRC:F1] |
| `--ill-section-pad-y` | `10px` | P (D-11; the user used 15 px on all sides) |
| `--ill-layer-indent` | `16px` per depth level | **L** [USER-TOKENS] `.frame-children` |
| `--ill-toolbar-pad` / `--ill-toolbar-gap` | `8px` / `8px` | **L** [USER-TOKENS] |

### 2.5 Sizing

| Property | Value | Status | Evidence / note |
| --- | --- | --- | --- |
| `--ill-size-control` | 30px: input, select, button, segmented track, stepper, colour input | **L** | [USER-TOKENS] `.field` 30; [SRC:F1] |
| `--ill-size-control-sm` | 24px: inline rename, variables-table cell editor, on-canvas value editor | P | [DECISION] |
| `--ill-size-chip` | 22px: style, variable and property chips | P | FVR §8.8 |
| `--ill-size-swatch` | 22px in a colour input; 12px colour dot in lists | P (D-11; user 20) | [SRC:G3, G5] |
| `--ill-size-hit` | **24px** minimum hit area for icon buttons and row toggles | P | WCAG 2.5.8; user 18–20 px micro buttons [USER-TOKENS] |
| `--ill-size-checkbox` | 14px | P | [SRC:F1] |
| `--ill-size-tool` | 32px tool button | **L** | [USER-TOKENS] `.tool` |
| `--ill-size-toolbar` | 48px (32 + 2 × 8) | **L** | [USER-TOKENS] |
| `--ill-size-row` | 30px: layer, page, menu, list and search-result rows | P (D-11; user layer row 32, menu item 36) | [SRC:G2] `--item-height: 30px` |
| `--ill-size-prop-row` | 40px property-row pitch | P | [SRC:G3] |
| `--ill-size-section-header` | 30px | P | FVR §8.3 |
| `--ill-size-panel-header` | 48px: sidebar header, tab bar, dialog header | P (D-11; user tab bar 45) | [SRC:G2] `--header-height: 48px` |
| `--ill-size-rail` | 48px navigation-rail width; 32px rail buttons | P (D-9) | Figma's rail is reported at about 60 px [SRC:https://forum.figma.com/share-your-feedback-26/figma-your-new-left-hand-menu-panel-is-a-disaster-7th-jan-2026-49352 excerpt] |
| `--ill-size-ruler` | 20px | P · V | FVR §9 [KNOW] |
| `--ill-size-icon-12` / `-16` / `-20` | Optical icon sizes (§3) | P | [SRC:F1] small native grids |
| `--ill-size-handle` | 8px square resize handle | **L** (colour) / V (size) | [USER-TOKENS] `.selection-handle`; size [KNOW] |
| `--ill-size-anchor` / `--ill-size-bezier-dot` | 7px / 5px | **L** | [USER-TOKENS]; FVR §9 |
| `--ill-left-w` (default / min / max) | **240** / 200 / 500px | default **L**; min, max P | [USER-TOKENS] `.layers-sidebar 240`; the Figma left sidebar is reported to resize between 225 and 500 [SRC:forum.figma.com 2024 community post, search excerpt, thread not identified] |
| `--ill-right-w` (default / min / max) | **268** / 240 / 480px | default **L**; min, max P | [USER-TOKENS] `--inspector-width: 268px`; Figma's right sidebar is resizable by its inner edge [DOC:23954856027159 excerpt] |
| `--ill-pages-h` (default / min) | 5 rows + header (180px) / 1 row + header (78px); resizable splitter | P | [KNOW] Figma resizes the Pages section |
| `--ill-popover-w` | 240px (generic, effect settings, stroke settings, interaction editor) | P (user effect popover 230) | [USER-TOKENS] |
| `--ill-picker-w` | 240px colour picker | P (D-11; user 280) | FVR M-5 |
| `--ill-menu-w` (min / max) | 180 / 320px; menus never exceed viewport − 16px tall | P (user context menu 224, main menu 245) | [USER-TOKENS] |
| `--ill-tooltip-max-w` | 280px | P | [DECISION] |
| `--ill-toast-max-w` | min(480px, 80vw) | P | [USER-TOKENS] `max-width: 80vw` |
| `--ill-modal-w` (sm / md / lg) | 400 / **480** / 640px; the variables view is full-window with a 16px inset | md **L**; others P | [USER-TOKENS] `dialog 480`; Figma's variables view is edge-to-edge by default [DOC:15145852043927 excerpt] |
| `--ill-window-min` | 960 × 600 px | P | [DECISION] |
| `--ill-titlebar-h` | 40px drag zone in sidebar headers (window controls overlay) | P | §4.2 |

### 2.6 Radii

| Property | Value | Use | Status |
| --- | --- | --- | --- |
| `--ill-radius-0` | 0 | Docked panels, rail, rulers | **L** [USER-TOKENS] |
| `--ill-radius-1` | 1px | Canvas resize handles | P · V |
| `--ill-radius-4` | 4px | Checkbox, swatch in an input, colour swatches, badges, kbd, size and measure pills | **L** (swatch, kbd) / P |
| `--ill-radius-6` | 6px | Tool buttons, segmented indicator, row highlight, menu items, chips, icon-button hover fill | **L** (tool 6) / P |
| `--ill-radius-control` | 8px | Inputs, selects, buttons, segmented track, stepper, colour input, cards, constraints and alignment widgets | P (D-11; user fields 5) [SRC:F1, G3, G4, G5, T1] |
| `--ill-radius-menu` | 12px | Menus and context menus | **L** [USER-TOKENS] context menu 12 (FVR proposed 10, **V**) |
| `--ill-radius-float` | 12px | Floating toolbar, zoom pill, popovers, colour picker | **L** [USER-TOKENS] toolbar and colour popover |
| `--ill-radius-tooltip` | 6px | Tooltips | P · V (user 5) |
| `--ill-radius-toast` | 10px | Toasts | P · V (user 9) |
| `--ill-radius-modal` | **16px** | Dialogs | **L** [USER-TOKENS] |
| `--ill-radius-pill` | 40px | Pills, only if D-3 keeps them | **L** value; usage D-3 |
| `--ill-radius-round` | 50% | Radio, colour dot, avatar, anchor point | P |

### 2.7 Borders and strokes

| Property | Value | Use | Status |
| --- | --- | --- | --- |
| `--ill-border-hairline` | 1px | Dividers, floating-surface edges | **L** |
| `--ill-border-highlight` | 0.5px | Top-lit inner edge | **L** |
| `--ill-focus-inset` | `inset 0 0 0 1px var(--ill-focus)` | Focused inputs | P [SRC:F1] |
| `--ill-focus-outline` | `2px solid var(--ill-focus)`, offset 2px | Keyboard focus on everything else | **L** [USER-TOKENS] |
| `--ill-stroke-canvas` | 1px (screen) | Selection, hover outline, guides, measurements, marquee, component outline | **L** [USER-TOKENS] `vector-effect: non-scaling-stroke` |
| `--ill-stroke-noodle` / `-selected` | 2px / 3px | Prototype connections | P · V |
| `--ill-stroke-drop` | 2px | Drop indicator line | **L** [USER-TOKENS] |
| `--ill-stroke-icon` | 1.5px on-screen | Icons (§3) | P (D-12) |

### 2.8 Shadows and elevation

| Level | Property | Dark | Light | Used by | Status |
| --- | --- | --- | --- | --- | --- |
| e0 | `--ill-shadow-none` | `none` | `none` | Docked panels | **L** |
| e1 | `--ill-shadow-raised` | `0 2px 4px rgba(0,0,0,.15)` + inset `0 0 0 1px rgba(255,255,255,.03)` | `0 0 0 1px rgba(0,0,0,.04), 0 1px 0 rgba(0,0,0,.04), 0 2px 4px rgba(0,0,0,.08)` | Segmented indicator, switch knob | P [SRC:G3, G4] |
| e2 | `--ill-shadow-float` | `0 10px 30px rgba(0,0,0,.25)` + `--ill-highlight-top` | `0 10px 30px rgba(0,0,0,.12)` + `0 0 0 1px rgba(0,0,0,.06)` | Toolbar, zoom pill, toast, colour picker | dark **L**; light P · V |
| e3 | `--ill-shadow-menu` | `0 10px 30px rgba(0,0,0,.4)`, inset `0 .5px 0 rgba(255,255,255,.094)` | `0 8px 24px rgba(0,0,0,.14)` + 1px edge | Menus, dropdowns, context menus | dark **L** [USER-TOKENS] context menu; light P · V |
| e3 | `--ill-shadow-popover` | `0 16px 36px rgba(0,0,0,.55), 0 2px 8px rgba(0,0,0,.4)` | `0 12px 32px rgba(0,0,0,.14), 0 2px 6px rgba(0,0,0,.08)` | Effect, stroke, variable and interaction popovers | dark **L** [USER-TOKENS] effect popover; light P · V |
| e4 | `--ill-shadow-tooltip` | `0 4px 12px rgba(0,0,0,.33)` | same | Tooltips | **L** [USER-TOKENS] |
| e5 | `--ill-shadow-modal` | `0 20px 90px rgba(0,0,0,.6)` | `0 20px 60px rgba(0,0,0,.2)` | Dialogs | dark **L**; light P |
| drag | `--ill-shadow-drag` | `0 8px 24px rgba(0,0,0,.35)` | `0 8px 24px rgba(0,0,0,.15)` | Drag ghost | P |

### 2.9 Blur

| Property | Value | Use | Status |
| --- | --- | --- | --- |
| `--ill-blur-scrim` | 5px | Modal backdrop. Set it to 0 when the "reduce transparency" preference is on, and on low-power GPUs. | **L** [USER-TOKENS] `dialog::backdrop` |
| `--ill-blur-overlay` | 10px | Small translucent buttons over canvas or media (image crop "Done", video controls) | P [SRC:T1] |
| `--ill-blur-panel` | 0 | Docked panels, menus and popovers stay opaque for legibility and GPU cost | P · V (whether Framer 3.0 uses glass is unknown) |

### 2.10 Motion

| Property | Value | Status | Evidence |
| --- | --- | --- | --- |
| `--ill-dur-0` | 0ms | P | Canvas feedback, reduced motion |
| `--ill-dur-exit` | 80ms | P · V | Menu and popover close [KNOW] |
| `--ill-dur-fast` | 100ms | P | Row and card hover overlay [SRC:G5]; tooltip fade |
| `--ill-dur-menu` | 120ms | P · V | Menu and popover open [KNOW] |
| `--ill-dur-base` | 150ms | P | Section collapse, row insert and remove, modal enter, panel content fade [SRC:G1, G2]; matches the user's 0.15 s [USER-TOKENS] |
| `--ill-dur-control` | 200ms | P | Control background change [SRC:F1]; segmented indicator slide [SRC:G4] |
| `--ill-dur-toast` | 200ms in / 150ms out | P | [DECISION] |
| `--ill-delay-tooltip` | 500ms first show; 0ms when moving to an adjacent trigger within 1000ms | P · V | [KNOW] |
| `--ill-dwell-toast` | 3000ms (sticky when it has an action or is an error) | P | [SRC:D1] `durationMs: 3000` |
| `--ill-dur-blink` | 2 × 60ms | P · V | Menu selection confirmation [SRC:U1] |
| `--ill-dur-spinner` | 800ms per turn | P | [SRC:F1] |
| `--ill-ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | P | [SRC:G4] |
| `--ill-ease-fade` | `cubic-bezier(0.5, 0, 0.5, 1)` | P | [SRC:G1, G2] |
| `--ill-ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | P | [DECISION] |
| `--ill-ease-linear` | `linear` | P | Spinner, progress |

**Per interaction type.**

| Interaction | Duration | Easing | Properties animated |
| --- | --- | --- | --- |
| Hover on a control (fill) | 200ms | ease | `background-color` |
| Hover on a row or card (overlay) | 100ms | `--ill-ease-out` | `background-color` |
| Hover-revealed actions (eye, lock, +, −) | 100ms | `--ill-ease-out` | `opacity` |
| Press | 0ms in, 100ms out | — | `background-color` |
| Segmented and tab indicator | 200ms | `--ill-ease-standard` | `transform`, label `color` |
| Toggle switch knob | 150ms | `--ill-ease-standard` | `transform` |
| Section collapse; paint, effect or export row add and remove | 150ms | `--ill-ease-standard` | `height` of that one section, `opacity` |
| Menu or popover open / close | 120 / 80ms | `--ill-ease-standard` / `--ill-ease-out` | `opacity`, `transform: translateY(±4px)` from the anchor side |
| Menu selection confirmation | 2 × 60ms | step | Highlight on / off |
| Tooltip | 500ms delay; 100ms fade | `--ill-ease-out` | `opacity` |
| Modal open / close | 150 / 100ms | `--ill-ease-standard` | `opacity`, `scale(0.98 → 1)` |
| Toast in / out | 200 / 150ms | `--ill-ease-standard` | `opacity`, `translateY(8px)` |
| Theme switch | 0ms | — | None. Swap all tokens in one frame (FVR-001). |
| Panel resize | 0ms | — | Live; never animated |
| Canvas chrome | **0ms** | — | Never animated (P-7) |

**Reduced motion:** every `transform` animation is removed. Opacity fades of 100 ms or less remain. The menu confirmation blink is skipped.

### 2.11 Z-index layers

All chrome lives in one stacking context above the canvas element.

| Property | Value | Contents | Maps the user's old value |
| --- | --- | --- | --- |
| `--ill-z-canvas` | 0 | CanvasKit `<canvas>`; canvas chrome is drawn inside it | — |
| `--ill-z-canvas-dom` | 10 | DOM overlays on the canvas: text-editing surface and IME, on-canvas value editors, comment pins | `.text-editor` 5 |
| `--ill-z-canvas-float` | 20 | Floating toolbar, zoom pill, contextual toolbars, rulers | `.toolbar` 10 |
| `--ill-z-panel` | 30 | Rail and sidebars | `.inspector` 12 |
| `--ill-z-resizer` | 35 | Panel resizers and splitters | local 20 |
| `--ill-z-popover` | 40 | Non-modal popovers (colour picker, effect, stroke, variable, interaction) | 40 / 45 |
| `--ill-z-menu` | 50 | Dropdowns, context menus and submenus; the later-opened one is on top | 50 / 1000 |
| `--ill-z-drag` | 60 | Drag ghost and cross-panel drop indicators | — |
| `--ill-z-scrim` / `--ill-z-modal` | 70 / 71 (each nested dialog +2) | Dialogs, variables view, libraries | — |
| `--ill-z-toast` | 80 | Toasts | 100 |
| `--ill-z-tooltip` | 90 | Tooltips | — |
| `--ill-z-capture` | 100 | Eyedropper loupe and global pointer-capture overlay | — |
| `--ill-z-dev` | 1000 | Development HUDs (never in a release build) | — |

### 2.12 Theme switching in CSS

```css
/* Generated from tokens.json. Dark is the default. */
:root, :root[data-theme="dark"] { color-scheme: dark; --ill-panel: #141414; /* … */ }
:root[data-theme="light"]        { color-scheme: light; --ill-panel: #ffffff; /* … */ }
@media (prefers-color-scheme: light) {
  :root[data-theme="system"]     { color-scheme: light; --ill-panel: #ffffff; /* … */ }
}
@media (prefers-reduced-motion: reduce) {
  :root { --ill-dur-menu: 0ms; --ill-dur-base: 0ms; --ill-dur-control: 0ms; /* fades ≤100ms remain */ }
}
@media (forced-colors: active) { /* map roles to system colours; see P-5 */ }
body { background: var(--ill-panel); color: var(--ill-text); font: var(--ill-fw-medium) var(--ill-fs-12)/var(--ill-lh-12) var(--ill-font-ui); }
```

The theme preference (`dark | light | system`) is stored per device, as in Figma [DOC:5576781786647 excerpt]. It is applied before first paint from the main process, which passes it to the renderer as a query parameter, so the window never flashes the wrong theme.

### 2.13 TypeScript token object shape

```ts
// packages/ui-tokens/src/types.ts (shape only; values live in tokens.json)
export type ThemeName = "dark" | "light";
export type TokenStatus = "locked" | "proposed" | "verify" | "proposed+verify" | "locked+verify";

export interface TokenMeta {
  status: TokenStatus;
  evidence: string[];          // e.g. ["USER-TOKENS", "SRC:G1", "COMPUTED"]
  decision?: `D-${number}`;    // open user decision, if any
  note?: string;
}
export interface Themed<T> { dark: T; light: T }
export interface ColorToken extends TokenMeta { value: Themed<string> }      // CSS colour string
export interface ShadowToken extends TokenMeta { value: Themed<string> }     // CSS box-shadow
export interface LengthToken extends TokenMeta { value: number }             // CSS px at UI scale 1
export interface RangeToken extends TokenMeta { value: { default: number; min: number; max: number } }
export interface TypeStyle extends TokenMeta { size: number; lineHeight: number; weights: (400 | 500 | 600)[] }
export interface DurationToken extends TokenMeta { value: number }           // ms
export interface EasingToken extends TokenMeta { value: string }             // CSS easing

export interface IlligmaTokens {
  meta: { schema: 1; generatedFrom: "tokens.json"; defaultTheme: "dark" };
  color: {
    surface: Record<"canvas" | "panel" | "surface2" | "control" | "controlHover" | "controlActive" | "controlEdge"
      | "raised" | "elevated" | "tooltip" | "toast" | "modal" | "scrim" | "codeBg", ColorToken>;
    border: Record<"divider" | "edge" | "edgeStrong" | "focus" | "dropIndicator", ColorToken>;
    text: Record<"primary" | "strong" | "secondary" | "tertiary" | "placeholder" | "onAccent" | "code", ColorToken>;
    accent: Record<"base" | "hover" | "pressed" | "fill" | "fillHover" | "fillPressed" | "text" | "dim" | "dim2"
      | "selectionBg" | "selectionFg", ColorToken>;
    component: Record<"base" | "text" | "dim" | "fill" | "fillHover", ColorToken>;
    status: Record<"danger" | "dangerText" | "dangerFill" | "dangerFillHover" | "warning" | "warningText"
      | "success" | "successText" | "info", ColorToken>;
    overlay: Record<"hover" | "press" | "mediaScrim", ColorToken>;
    canvas: Record<"sel" | "selHandleFill" | "selHandleStroke" | "marqueeFill" | "whBadgeBg" | "whBadgeText"
      | "frameLabel" | "frameLabelActive" | "guide" | "guideSelected" | "measure" | "measureFill"
      | "layoutOverlay" | "layoutOverlayFill" | "rulerBg" | "rulerTick" | "rulerText" | "rulerSel"
      | "noodle" | "flowBadge" | "slotOutline" | "caret" | "anchorFill" | "anchorStroke"
      | "anchorSelectedFill" | "bezier" | "pixelGrid" | "canvasFocus", ColorToken>;
  };
  highlightTop: ShadowToken;
  font: {
    family: { ui: TokenMeta & { value: string }; mono: TokenMeta & { value: string } };
    features: { ui: string[]; numeric: string[] };
    type: Record<"10" | "11" | "12" | "13" | "24", TypeStyle>;
    weight: { regular: 400; medium: 500; semibold: 600 };
    tracking: { base: 0; display: string };
  };
  space: Record<"1" | "2" | "4" | "5" | "6" | "8" | "10" | "15" | "20" | "30" | "40", LengthToken>
    & { gutter: LengthToken; gap: LengthToken; gapSm: LengthToken; controlPadX: LengthToken;
        sectionPadY: LengthToken; layerIndent: LengthToken; toolbarPad: LengthToken; toolbarGap: LengthToken };
  size: Record<"control" | "controlSm" | "chip" | "swatch" | "hit" | "checkbox" | "tool" | "toolbar" | "row"
      | "propRow" | "sectionHeader" | "panelHeader" | "rail" | "ruler" | "icon12" | "icon16" | "icon20"
      | "handle" | "anchor" | "bezierDot" | "popover" | "picker" | "tooltipMax" | "titlebar", LengthToken>
    & { leftSidebar: RangeToken; rightSidebar: RangeToken; pages: RangeToken; menu: RangeToken;
        modal: Record<"sm" | "md" | "lg", LengthToken> };
  radius: Record<"0" | "1" | "4" | "6" | "control" | "menu" | "float" | "tooltip" | "toast" | "modal" | "pill" | "round",
    LengthToken | (TokenMeta & { value: string })>;
  border: Record<"hairline" | "highlight" | "strokeCanvas" | "strokeNoodle" | "strokeNoodleSelected"
    | "strokeDrop" | "strokeIcon", LengthToken>;
  shadow: Record<"none" | "raised" | "float" | "menu" | "popover" | "tooltip" | "modal" | "drag", ShadowToken>;
  blur: Record<"scrim" | "overlay" | "panel", LengthToken>;
  motion: {
    duration: Record<"none" | "exit" | "fast" | "menu" | "base" | "control" | "toastIn" | "toastOut"
      | "blink" | "spinner", DurationToken>;
    delay: Record<"tooltip" | "tooltipSkipWindow" | "toastDwell", DurationToken>;
    easing: Record<"standard" | "fade" | "out" | "linear", EasingToken>;
  };
  z: Record<"canvas" | "canvasDom" | "canvasFloat" | "panel" | "resizer" | "popover" | "menu" | "drag"
    | "scrim" | "modal" | "toast" | "tooltip" | "capture" | "dev", number>;
}

/** Resolved, theme-specific values for the render core's overlay pass (no CSS at runtime). */
export interface CanvasChromeTheme {
  theme: ThemeName;
  rgba: Record<keyof IlligmaTokens["color"]["canvas"], [r: number, g: number, b: number, a: number]>; // 0..1 floats
  strokePx: { canvas: number; noodle: number; noodleSelected: number; drop: number };
  sizePx: { handle: number; anchor: number; bezierDot: number; ruler: number };
  font: { family: string; labelSize: 11; labelWeight: 500 | 600; numericFeatures: ["tnum"] };
}
```

---

## 3. Iconography

### 3.1 Style specification

The evidence is Framer's own inline SVGs [SRC:F1] (FVR §7): 1.5 px strokes at 1:1 size, round caps and joins, small native grids, and soft corners.

| Rule | Specification | Status |
| --- | --- | --- |
| Optical sizes | Three masters, each drawn natively. **12 px** is micro: chevrons, check, close-in-chip, dropdown carets, in-input prefix glyphs. **16 px** is standard: layer types, panel and section actions, segmented glyphs, menu leading glyphs. **20 px** is large: toolbar tools and rail tabs. Never render a master at another size, except 16 → 14 inside 30 px rows if the workbench shows 16 is too heavy. | P |
| Grid and live area | 12 grid, 10 live (1 px padding). 16 grid, 14 live. 20 grid, 18 live. Keylines: circle Ø 13 on the 16 grid, square 12 × 12, portrait 10 × 13, landscape 13 × 10. Circles are drawn slightly larger than squares for equal optical weight. | P |
| Stroke | **1.5 px on screen** at every size. Exception: 12 px glyphs with three or more parallel strokes may use 1.25 px. The check glyph in a checkbox is 1.75 px [SRC:F1]. | P (D-12; the user's Lucide at `stroke-width: 1.6` on 16 px renders about 1.07 px [USER-TOKENS]) |
| Caps and joins | Round caps, round joins, no miters. | P [SRC:F1] |
| Corners | Rectangles inside glyphs have a 1.5 px corner radius on the 16 grid (1 px on 12, 2 px on 20). Sharp corners only where the shape means "sharp", for example the corner-radius glyph's reference corner. | P [SRC:F1] |
| Pixel fit | At 2× DPR a 1.5 px stroke is crisp when its centreline sits on an x.25 or x.75 coordinate (edges land on whole device pixels). Draw on a 0.25 px snap grid and lint centrelines. At 1×, slight anti-aliasing is accepted. | P [DECISION] |
| Colour | One colour per glyph, `currentColor`. Idle: `--ill-text-2`. Hover: `--ill-text`. Active or selected: `--ill-accent`. Disabled: 50 % opacity. Component family: `--ill-component`, set by the parent's class, never baked into the SVG. | P |
| Fill states | Outline is the default. An "on" or selected variant may add a 0.3-opacity fill inside the outline (Framer's two-tone [SRC:F1]) or a solid fill. Used for: eye / eye-off, lock / unlock, flow start, the component diamond in Assets, and the boolean-op result area. | P |
| Optical consistency | Plus and minus bars are 10 px long on the 16 grid. Arrows have 45° heads with 3.5 px arms. Chevrons are 8 × 4.5 px on the 12 grid [SRC:F1 8 px chevron]. | P |
| Direction | Glyphs that encode direction (alignment, flow, arrows) are **not** mirrored in RTL locales, because they describe canvas geometry, not reading order. | P [DECISION] |
| Prohibited | Do not copy, trace or redraw Figma's or Framer's proprietary icon artwork. Use their icons only to understand **which concept** needs a glyph. | **Rule** |

### 3.2 Naming and packaging

- **Ids:** `<category>/<name>[-<variant>]@<size>`, kebab-case. Examples: `tool/frame@20`, `layer/frame-auto-h@16`, `align/left@16`, `proto/trigger-on-click@16`, `var/type-color@12`. Category prefixes match the inventory tables below.
- **Variants:** `-on` (filled state), `-off`, `-mixed`, `-h` / `-v` (axis), `-wrap`, `-grid`.
- **Source files:** `packages/ui-icons/src/<size>/<category>/<name>.svg`, with `viewBox="0 0 <size> <size>"`, `fill="none"`, `stroke="currentColor"`, a `stroke-width` equal to the on-screen width, and round caps and joins.
- **Build:** SVGO (`svgo@4.1.0`, MIT) normalises the files. A generator emits a sprite per size plus a typed Solid `<Icon name size />` whose `name` is a string-literal union, so a misspelled icon is a compile error. Adapted Lucide glyphs are re-exported at the target stroke: `stroke-width = 1.5 × 24 / renderSize`, which is 2.25 at 16 and 1.8 at 20. Lucide is never rendered at 12 px; 12 px glyphs are custom.
- **Licence manifest:** `packages/ui-icons/LICENSES.md` lists each adapted glyph's origin (Lucide ISC; the Feather-derived subset MIT), and is shipped in the app's About → Licences.

### 3.3 Recommended source

| Option | Licence | Fit | Verdict |
| --- | --- | --- | --- |
| **Lucide** (`lucide-static`). 2,133 icons in 1.53.0 (published 2026-10-08, too new to pin). **Pin 1.47.0 (2026-09-17)** or any version at least two weeks old at adoption. | ISC. The Feather-derived subset is MIT (licence file read in this session). | Same geometry family as Framer (24 grid, 2 px, round caps and joins). Covers generic UI. Lacks most design-tool glyphs. | **Use for generic UI**, re-stroked to 1.5 px on screen. The user's previous choice [USER-TOKENS] `svg.lucide`. |
| **Custom Illigma set** | Illigma's own licence | Required for design-tool concepts: auto layout flows, alignment matrix states, constraints, boolean ops, layer types, variable types, prototype triggers and actions, stroke caps, effects. | **Draw about 150 glyphs** on the 12/16/20 masters. |
| Phosphor (`@phosphor-icons/core@2.1.1`, 2024-03) | MIT | Good, and its *Duotone* weight matches the 0.3 two-tone. | Fallback for gaps, adapted to the same rules. |
| Tabler (`@tabler/icons`; pin 3.48.0, 2026-09-22) | MIT | Very large; slightly more geometric. | Second fallback. |

Glyph names marked `Lucide:<name>` in §3.4 were checked to exist in `lucide-static@1.53.0` in this session. Re-check them against the pinned version (KIT-015). `Custom` means draw from scratch. `Lucide→custom` means use the Lucide glyph as a starting sketch, then redraw it on the native grid.

### 3.4 Inventory needed for Figma parity

Every glyph lists the Figma function it represents. Glyphs are 16 px unless a size is given.

#### A. Toolbar tools and modes (20 px; in flyout menus 16 px)

| Id | Figma function (shortcut per `10-panels…` §4.5) | Source |
| --- | --- | --- |
| `tool/move` | Move tool (V) | Lucide:mouse-pointer-2 → custom |
| `tool/hand` | Hand tool (H; hold Space) | Lucide:hand |
| `tool/scale` | Scale tool (K) | Lucide:scaling → custom |
| `tool/frame` | Frame tool (F, A) | Lucide:frame |
| `tool/section` | Section tool (⇧S) | Custom (frame with a title tab) |
| `tool/slice` | Slice tool (S) | Lucide:slice → custom |
| `tool/rectangle`, `tool/line`, `tool/arrow`, `tool/ellipse`, `tool/polygon`, `tool/star` | Shape tools (R, L, ⇧L, O, —, —) | Lucide:square, Lucide:minus (rotated), Lucide:move-up-right, Lucide:circle, Lucide:triangle, Lucide:star → custom |
| `tool/place-image` | Place image/video (⇧⌘K) | Lucide:image-plus |
| `tool/pen`, `tool/pencil` | Pen (P), Pencil (⇧P) | Lucide:pen-tool, Lucide:pencil |
| `tool/text` | Text (T) | Lucide:type |
| `tool/comment` | Comment (C), local only | Lucide:message-circle |
| `tool/actions` | Actions menu (⌘K) | Custom (spark plus grid) |
| `tool/flyout` @12 | The flyout chevron on grouped tools | Custom chevron |
| `mode/design`, `mode/draw`, `mode/dev` | Mode switch at the toolbar end. Only Design is in scope; the others are out of scope (glyph reserved, not shipped). | Custom |

#### B. Layer-type icons (16 px, in Layers, Assets, menus and the selection header)

| Id | Figma node or state | Data | Source |
| --- | --- | --- | --- |
| `layer/frame` | Frame, no auto layout | `FRAME`, `layoutMode = NONE` [API] | Lucide:frame → custom |
| `layer/frame-auto-v` | Auto layout, vertical | `layoutMode = VERTICAL` | Custom (stacked bars) |
| `layer/frame-auto-h` | Auto layout, horizontal | `HORIZONTAL` | Custom |
| `layer/frame-auto-wrap` | Auto layout with wrap | `layoutWrap = WRAP` | Custom |
| `layer/frame-auto-grid` | Grid flow | `layoutMode = GRID` | Custom (2 × 2 cells) |
| `layer/frame-fixed` | Frame child set to fixed position while scrolling (badge overlay) | `numberOfFixedChildren` [API]; REST `scrollBehavior` FIXED / STICKY_SCROLLS | Custom 6 px pin badge |
| `layer/absolute` | Child that ignores auto layout (corner-marks overlay on its own type icon) | `layoutPositioning = ABSOLUTE` [API] | Custom overlay |
| `layer/group` | Group | `GROUP` | Custom (dashed square) |
| `layer/section` | Section | `SECTION` | Custom |
| `layer/component` | Main component (purple) | `COMPONENT` | Custom 4-diamond |
| `layer/component-set` | Component set (purple) | `COMPONENT_SET` | Custom (dashed 4-diamond) |
| `layer/instance` | Instance (purple) | `INSTANCE` | Custom (hollow diamond) |
| `layer/slot` | Slot (purple) | `SLOT` [API] | Custom (diamond with an insertion bar) |
| `layer/rectangle`, `layer/ellipse`, `layer/polygon`, `layer/star`, `layer/line`, `layer/arrow` | Shapes | `RECTANGLE`, `ELLIPSE`, `POLYGON`, `STAR`, `LINE` (arrow = line with arrow caps) | Custom (thin outline) |
| `layer/vector` | Vector or pen path | `VECTOR` | Lucide:spline → custom |
| `layer/text` | Text | `TEXT` | Custom "T" |
| `layer/text-path` | Text on path | `TEXT_PATH` [API] | Custom |
| `layer/image` | Shape whose only visible fill is an image | `IMAGE` paint | Lucide:image → custom |
| `layer/video` | Video fill | `VIDEO` paint | Lucide:film → custom |
| `layer/bool-union`, `-subtract`, `-intersect`, `-exclude` | Boolean groups by operation | `BOOLEAN_OPERATION.booleanOperation` [API] | Lucide:squares-unite, -subtract, -intersect, -exclude → custom |
| `layer/mask` | Layer used as mask (and masked-group indicator) | `isMask`, `maskType` ALPHA / VECTOR / LUMINANCE [API] | Custom (half-filled circle) |
| `layer/slice` | Slice | `SLICE` | Lucide:slice → custom |
| `layer/transform-group` | Transform group | `TRANSFORM_GROUP` [API]; UI label unknown, verify | Custom |
| `layer/page`, `layer/page-divider` | Page; Figma "---" divider page | `PAGE` | Lucide:file → custom; custom rule |

`10-panels…` §3.1 requires these icons to distinguish the horizontal, vertical, wrap and grid auto layout variants and every boolean operation. Figma's exact glyph meanings are not documented in an official legend [SRC:https://forum.figma.com/ask-the-community-7/what-do-the-different-icons-next-to-the-frame-mean-in-the-layer-overview-on-the-left-35492 excerpt]. Illigma's set is designed to be unambiguous on its own terms (KIT-013).

#### C. Tree and row controls

| Id | Function | Source |
| --- | --- | --- |
| `row/disclosure` @12 | Expand or collapse (rotates 90°) | Custom chevron |
| `row/eye`, `row/eye-off` | Visibility toggle (`visible`) | Lucide:eye, Lucide:eye-off |
| `row/eye-inherited` @12 | Hidden because of an ancestor (subdued dot) | Custom |
| `row/lock`, `row/unlock` | Lock toggle (`locked`) | Lucide:lock, Lucide:lock-open |
| `row/lock-inherited` @12 | Locked because of an ancestor | Custom |
| `row/grip` @12 | Reorder handle (paint, effect, export, interaction and property rows) | Lucide:grip-vertical → custom 6-dot |
| `row/collapse-all` | Collapse layers (⌥L) | Lucide:fold-vertical |

#### D. Navigation rail and file chrome

| Id | Function | Source |
| --- | --- | --- |
| `rail/main-menu` @20 | Main menu (app logo slot); Illigma logo glyph | Custom (brand mark) |
| `rail/file` @20 | File tab: pages and layers | Lucide:layers |
| `rail/assets` @20 | Assets tab | Custom 4-diamond outline |
| `rail/find` @20 | Find and replace (⌘F) | Lucide:text-search |
| `rail/variables` @20 | Variables view | Custom hexagon |
| `rail/notifications` @20 | Library updates and missing fonts (bottom of rail) | Lucide:bell |
| `file/menu` @12 | File-name dropdown | Custom chevron |
| `file/undo`, `file/redo` | Undo, redo | Lucide:undo-2, Lucide:redo-2 |
| `file/history` | Version history | Lucide:history |
| `file/saved`, `file/saving`, `file/unsaved`, `file/recovered`, `file/save-error` @12 | Save state (P-9) | Custom dot and ring states |
| `view/zoom-in`, `view/zoom-out`, `view/fit` | Zoom commands (zoom pill, an Illigma extension) | Lucide:plus, Lucide:minus, Lucide:scan |
| `view/minimize-ui` | Minimize UI (⌘⇧\\) [DOC:360039831974 excerpt] | Lucide:panel-left-close |
| `view/present` | Present / Preview (play) | Lucide:play |

#### E. Panel and section actions

| Id | Function | Source |
| --- | --- | --- |
| `act/add`, `act/remove` | Section "+" and per-row "−" | Lucide:plus, Lucide:minus |
| `act/styles` | Apply or create a style (four-dot glyph in Fill, Stroke, Effects, Layout guide and Typography headers) | Custom 4-dot |
| `act/variable` | Apply variable (shown on field hover) | Custom hexagon |
| `act/detach` | Detach style or variable | Lucide:unlink-2 |
| `act/settings` | Settings popover (effects, layout guides, auto layout, export) | Lucide:sliders-horizontal → custom |
| `act/more` | More actions | Lucide:ellipsis |
| `act/reset` | Reset override | Lucide:refresh-ccw |
| `act/search` | Search | Lucide:search |
| `act/close` @12 / @16 | Close (popovers, dialogs, chips) | Lucide:x |
| `act/check` @12 | Menu checkmark, checkbox check | Custom |
| `act/link` | Link independent values (padding, corner radius, image or grid proportion) | Lucide:link-2 |
| `act/eyedropper` | Eyedropper (I) | Lucide:pipette |
| `act/swap` | Swap instance; swap stroke ends; swap fill and stroke | Lucide:arrow-left-right |
| `act/library` | Libraries | Lucide:library |
| `act/go-to-main` | Go to main component | Custom (diamond plus arrow) |

#### F. Selection-header actions

| Id | Function | Data / command | Source |
| --- | --- | --- | --- |
| `sel/create-component` | Create component (⌥⌘K) | CP §4.1 | Custom 4-diamond plus |
| `sel/create-multiple-components` | Create multiple components | CP | Custom |
| `sel/mask` | Use as mask (⌃⌘M) | `isMask` | Custom |
| `sel/boolean` | Boolean groups split button (shows the last-used op) | `booleanOperation` | the `layer/bool-*` glyphs |
| `sel/edit-object` | Edit object (vector edit, gradient, image crop) | VC | Lucide:spline-pointer → custom |
| `sel/crop` | Crop image | PE | Lucide:crop |
| `sel/detach` | Detach instance (⌥⌘B) | CP | Custom (broken diamond) |
| `sel/frame-type` @12 | Selection-type dropdown caret (frame presets, convert type) | UX §4.1 | Custom chevron |
| `sel/multi-edit-text` | Multi-edit text | TX §4 | Custom |

#### G. Position: alignment, distribution, transform

| Id | Function | Source |
| --- | --- | --- |
| `align/left`, `align/h-center`, `align/right`, `align/top`, `align/v-center`, `align/bottom` | Align (⌥A, ⌥H, ⌥D, ⌥W, ⌥V, ⌥S [KNOW]) | Lucide:align-horizontal-justify-start / -center / -end, align-vertical-justify-start / -center / -end → custom |
| `align/distribute-h`, `align/distribute-v` | Distribute horizontal / vertical spacing | Lucide:align-horizontal-distribute-center, align-vertical-distribute-center → custom |
| `align/tidy-up` | Tidy up | Custom |
| `xform/rotate` @12 | Rotation-field prefix | Custom (arc) |
| `xform/rotate-90` | Rotate 90° | Lucide:rotate-cw-square |
| `xform/flip-h`, `xform/flip-v` | Flip horizontal / vertical (⇧H / ⇧V) | Lucide:flip-horizontal-2, Lucide:flip-vertical-2 |
| `xform/ignore-auto-layout` | Ignore auto layout (absolute position) toggle | Custom |

#### H. Constraints (menu leading glyphs; the widget itself is drawn, §5.28)

| Id | Figma option | Data [API] |
| --- | --- | --- |
| `cons/left`, `cons/right`, `cons/left-right`, `cons/h-center`, `cons/h-scale` | Left, Right, Left & right, Center, Scale | `constraints.horizontal`: MIN, MAX, STRETCH, CENTER, SCALE |
| `cons/top`, `cons/bottom`, `cons/top-bottom`, `cons/v-center`, `cons/v-scale` | Top, Bottom, Top & bottom, Center, Scale | `constraints.vertical`: same enum |

All are custom glyphs: a box with a pinned edge or edges.

#### I. Layout and auto layout

| Id | Figma control | Data [API] | Source |
| --- | --- | --- | --- |
| `al/freeform` | Flow: Freeform (no auto layout) [OBS] | `layoutMode = NONE` | Custom |
| `al/vertical`, `al/horizontal`, `al/grid` | Flow: Vertical, Horizontal, Grid | `VERTICAL`, `HORIZONTAL`, `GRID` | Custom |
| `al/wrap` | Wrap toggle | `layoutWrap` | Lucide:wrap-text → custom |
| `al/gap-h`, `al/gap-v` @12 | Gap prefix (between items, by axis) | `itemSpacing` | Custom |
| `al/gap-cross` @12 | Counter-axis (row) gap prefix, wrap only | `counterAxisSpacing` | Custom |
| `al/pad-h`, `al/pad-v`, `al/pad-top`, `al/pad-right`, `al/pad-bottom`, `al/pad-left` @12 | Padding prefixes | `padding*` | Custom |
| `al/pad-individual` | Individual padding toggle | — | Custom |
| `al/align-*` (sub-glyphs) | Alignment matrix preview bars per state: MIN, CENTER, MAX on each axis; SPACE_BETWEEN; BASELINE | `primaryAxisAlignItems`, `counterAxisAlignItems` | Drawn by the widget (§5.27) |
| `al/size-fixed`, `al/size-hug`, `al/size-fill` @12 | Sizing options in the W/H dropdowns | `layoutSizingHorizontal/Vertical` FIXED, HUG, FILL | Custom |
| `al/min`, `al/max` @12 | Add min / max width or height | `minWidth`, `maxWidth`, … | Custom |
| `al/clip` | Clip content (menu glyph; the control is a checkbox [OBS]) | `clipsContent` | Custom |
| `al/settings` | Layout settings popover | — | `act/settings` |
| `al/stroke-included`, `al/stacking-first`, `al/stacking-last` | Inside stroke Included / Excluded; Canvas stacking first or last on top [OBS] | `strokesIncludedInLayout`, `itemReverseZIndex` | Custom |
| `al/grid-track-fixed`, `-hug`, `-flex` @12 | Grid track size type | `GridTrackSize.type` FIXED, HUG, FLEX | Custom |
| `al/grid-span` | Row and column span | `gridRowSpan`, `gridColumnSpan` | Custom |
| `al/resize-to-fit` | Resize to fit (⌥⇧⌘R) | — | Lucide:shrink |

#### J. Appearance

| Id | Function | Data [API] | Source |
| --- | --- | --- | --- |
| `app/opacity` @12 | Opacity prefix | `opacity` | Custom (checker drop) |
| `app/radius` @12 | Corner-radius prefix | `cornerRadius` | Lucide:square-round-corner → custom |
| `app/radius-tl`, `-tr`, `-br`, `-bl` @12 | Independent corners | `topLeftRadius`, … | Custom |
| `app/radius-independent` | Independent corners toggle | — | Custom |
| `app/smoothing` @12 | Corner smoothing | `cornerSmoothing` | Custom (squircle) |
| `app/blend` | Blend-mode menu button | `blendMode` (19 values incl. PASS_THROUGH) | Lucide:blend → custom |
| `app/visibility` | Layer visibility | `visible` | `row/eye` |

#### K. Paint types, colour and image

| Id | Function | Data [API] | Source |
| --- | --- | --- | --- |
| `paint/solid`, `paint/gradient-linear`, `paint/gradient-radial`, `paint/gradient-angular`, `paint/gradient-diamond`, `paint/image`, `paint/video`, `paint/pattern`, `paint/shader` | Paint-type selector in the colour picker [OBS lists Solid, Gradient, Pattern, Image, Video, Shader] | `Paint.type` | Custom |
| `paint/mixed` | Mixed paints placeholder | `figma.mixed` | Custom (quartered swatch) |
| `paint/none` | No paint (diagonal) | — | Custom |
| `color/model` @12 | Colour-model menu caret (Hex, RGB, CSS, HSL, HSB) [DOC:360043042113 excerpt] | — | Custom |
| `grad/add-stop`, `grad/flip`, `grad/rotate` | Gradient stop and orientation actions | `gradientStops`, `gradientTransform` | Custom; Lucide:rotate-cw-square |
| `img/fill`, `img/fit`, `img/crop`, `img/tile` @12 | Image scale mode | `scaleMode` FILL, FIT, CROP, TILE | Custom |
| `img/exposure`, `img/contrast`, `img/saturation`, `img/temperature`, `img/tint`, `img/highlights`, `img/shadows` | Image adjustments | `ImageFilters` | Lucide:sun-medium, contrast, droplet, thermometer, palette, sun, moon → custom |
| `img/replace`, `img/rotate` | Choose image; rotate 90° | `imageHash`, `rotation` | Lucide:image-up; Lucide:rotate-cw-square |
| `pattern/tile-rect`, `-hex-h`, `-hex-v` @12 | Pattern tile type | `PatternPaint.tileType` | Custom |

#### L. Stroke

| Id | Function | Data [API] | Source |
| --- | --- | --- | --- |
| `stroke/inside`, `stroke/center`, `stroke/outside` | Stroke position | `strokeAlign` | Custom |
| `stroke/sides-all`, `-top`, `-right`, `-bottom`, `-left`, `-custom` | Per-side weights | `strokeTopWeight`, … | Custom |
| `stroke/weight` @12 | Weight prefix | `strokeWeight` | Custom (three bars) |
| `stroke/cap-none`, `-round`, `-square`, `-arrow-lines`, `-arrow-equilateral`, `-triangle-filled`, `-diamond-filled`, `-circle-filled` | End-point caps (8 enum values) | `StrokeCap` | Custom |
| `stroke/join-miter`, `-bevel`, `-round` | Joins | `StrokeJoin` | Custom |
| `stroke/dash` | Dashed style | `dashPattern` | Custom |
| `stroke/variable-width`, `stroke/brush-stretch`, `stroke/brush-scatter`, `stroke/dynamic` | Draw-mode stroke types | `variableWidthStrokeProperties`, `complexStrokeProperties` BRUSH / DYNAMIC | Custom |
| `stroke/swap-ends` | Swap start and end | per-vertex caps | `act/swap` |

#### M. Effects

| Id | Function | Data [API] | Source |
| --- | --- | --- | --- |
| `fx/drop-shadow`, `fx/inner-shadow` | Shadows | `DROP_SHADOW`, `INNER_SHADOW` | Custom |
| `fx/layer-blur`, `fx/background-blur` | Blurs | `LAYER_BLUR`, `BACKGROUND_BLUR` | Custom |
| `fx/blur-uniform`, `fx/blur-progressive` @12 | Blur type switch | `blurType` NORMAL / PROGRESSIVE | Custom |
| `fx/noise` (`-mono`, `-duo`, `-multi` @12) | Noise and its types | `NOISE`, `noiseType` | Lucide:sparkle → custom |
| `fx/texture` | Texture | `TEXTURE` | Custom |
| `fx/glass` | Glass | `GLASS` | Custom (lens) |
| `fx/shader` | Shader effect | `SHADER` | Custom |

#### N. Typography

| Id | Function | Data [API] | Source |
| --- | --- | --- | --- |
| `type/align-left`, `-center`, `-right`, `-justify` | Horizontal alignment | `textAlignHorizontal` | Lucide:text-align-start / -center / -end / -justify |
| `type/valign-top`, `-middle`, `-bottom` | Vertical alignment | `textAlignVertical` | Lucide:arrow-up-from-line → custom |
| `type/auto-width`, `type/auto-height`, `type/fixed`, `type/truncate` | Text resizing (truncate is a type setting) | `textAutoResize`, `textTruncation` | Custom |
| `type/line-height`, `type/letter-spacing`, `type/paragraph-spacing`, `type/paragraph-indent` @12 | Field prefixes | `lineHeight`, `letterSpacing`, `paragraphSpacing`, `paragraphIndent` | Custom |
| `type/case-*` (original, upper, lower, title, small-caps, small-caps-forced) | Text case | `TextCase` | Lucide:case-sensitive / case-upper / case-lower → custom |
| `type/underline`, `type/strikethrough` | Decoration | `TextDecoration` | Lucide:underline, Lucide:strikethrough |
| `type/list-bullet`, `type/list-number` | Lists | `listOptions` | Lucide:list, Lucide:list-ordered |
| `type/settings` | Type settings panel | — | `act/settings` |
| `type/vertical-trim` | Leading trim (cap height to baseline) | `leadingTrim` | Custom |
| `type/hanging-punctuation`, `type/hanging-list` | Hanging punctuation and lists | `hangingPunctuation`, `hangingList` | Custom |
| `type/opentype`, `type/variable-axes` | Type settings Details and Variable tabs | `openTypeFeatures` [API]; variable-axis data per TX §3.11 | Custom |
| `type/link` | Create link | `hyperlink` | Lucide:link |
| `type/missing-font` | Missing font | — | `status/warning` |

#### O. Layout guides and export

| Id | Function | Data [API] | Source |
| --- | --- | --- | --- |
| `guide/columns`, `guide/rows`, `guide/grid` | Layout guide type | `LayoutGrid.pattern` COLUMNS, ROWS, GRID | Lucide:columns-3, Lucide:rows-3, Lucide:grid-3x3 → custom |
| `export/download` | Export button | — | Lucide:download |
| `export/preview` @12 | Export preview disclosure | — | Custom chevron |

#### P. Components and component properties (purple via context)

| Id | Function | Data [API] | Source |
| --- | --- | --- | --- |
| `cp/prop-variant`, `cp/prop-boolean`, `cp/prop-text`, `cp/prop-instance-swap`, `cp/prop-slot` | Property-type glyphs in lists and the "+" menu | `ComponentPropertyType` | Custom |
| `cp/add-variant` | Add variant | — | Custom |
| `cp/apply-property` | "Apply property" control beside visibility, text or nested instance | `componentPropertyReferences` | Custom diamond-link |
| `cp/nested-instance` | Exposed nested instances | `isExposedInstance` | Custom |
| `cp/preferred` @12 | Preferred value marker | `preferredValues` | Lucide:star → custom |
| `cp/override-dot` @12 | Overridden property indicator (FVR M-8) | overrides | Custom 4 px dot |
| `cp/library-update` | Update available | — | Custom (diamond plus arrow) |
| `cp/missing` | Missing or deleted main component | — | `status/warning` |

#### Q. Variables and styles

| Id | Function | Data [API] | Source |
| --- | --- | --- | --- |
| `var/type-color`, `var/type-number`, `var/type-string`, `var/type-boolean` @12 and @16 | Variable types | `VariableResolvedDataType` COLOR, FLOAT, STRING, BOOLEAN | Custom (swatch, #, Aa, toggle) |
| `var/type-easing`, `var/type-timing` @12 and @16 | Newer resolved types present in the typings; UI exposure unverified | `EASING`, `TIMING` [API] | Custom |
| `var/alias` @12 | Value is an alias | `VariableAlias` | Custom (hexagon arrow) |
| `var/collection`, `var/collection-extended` | Collection; extended collection (inherits from a parent) | `VariableCollection`, extended collections [API][DOC:36346281624471 title] | Custom |
| `var/mode` | Mode column, Apply variable mode | `explicitVariableModes` | Custom |
| `var/group` | Group folder | name path | Lucide:folder |
| `var/scope`, `var/code-syntax`, `var/hidden-from-publishing` | Edit-variable panel sections | `scopes`, `codeSyntax`, `hiddenFromPublishing` | Custom; Lucide:braces; Lucide:eye-off |
| `style/paint`, `style/text`, `style/effect`, `style/grid` | Style kinds in pickers and lists | `PaintStyle`, `TextStyle`, `EffectStyle`, `GridStyle` | Custom (12 px swatch, "Ag", shadow square, grid) |
| `var/import`, `var/export` | Variables JSON import / export | — | Lucide:upload, Lucide:download |

#### R. Prototype

| Id | Function | Data [API] | Source |
| --- | --- | --- | --- |
| `pt/on-click`, `pt/on-drag`, `pt/while-hovering`, `pt/while-pressing`, `pt/key-gamepad`, `pt/mouse-enter`, `pt/mouse-leave`, `pt/mouse-down`, `pt/mouse-up`, `pt/after-delay`, `pt/media-hit`, `pt/media-end` | Triggers | `Trigger.type` ON_CLICK, ON_DRAG, ON_HOVER, ON_PRESS, ON_KEY_DOWN, MOUSE_ENTER, MOUSE_LEAVE, MOUSE_DOWN, MOUSE_UP, AFTER_TIMEOUT, ON_MEDIA_HIT, ON_MEDIA_END | Lucide:mouse-pointer-click, hand-grab, pointer, keyboard, gamepad-2, timer → custom |
| `pa/navigate`, `pa/change-to`, `pa/back`, `pa/scroll-to`, `pa/open-link`, `pa/open-overlay`, `pa/swap-overlay`, `pa/close-overlay`, `pa/set-variable`, `pa/set-mode`, `pa/conditional` | Actions | `Action.type` NODE + `Navigation` NAVIGATE, CHANGE_TO, SCROLL_TO, OVERLAY, SWAP; BACK; URL; CLOSE; SET_VARIABLE; SET_VARIABLE_MODE; CONDITIONAL | Custom; Lucide:corner-up-left, Lucide:external-link |
| `pa/media-play`, `-pause`, `-toggle`, `-mute`, `-unmute`, `-toggle-mute`, `-skip-fwd`, `-skip-back`, `-skip-to` | Video actions | `UPDATE_MEDIA_RUNTIME.mediaAction` | Lucide:play, pause, volume-2, volume-x, skip-forward, skip-back |
| `anim/instant`, `anim/dissolve`, `anim/smart-animate`, `anim/move-in`, `anim/move-out`, `anim/push`, `anim/slide-in`, `anim/slide-out`, `anim/scroll-animate` | Animation types | `Transition.type` (+ none = Instant) | Custom |
| `anim/dir-left`, `-right`, `-top`, `-bottom` @12 | Direction | `DirectionalTransition.direction` | Custom arrows |
| `ease/*` (linear, ease-in, ease-out, ease-in-and-out, ease-in-back, ease-out-back, ease-in-and-out-back, custom-bezier, gentle, quick, bouncy, slow, custom-spring) | Easing presets (curve thumbnails) | `Easing.type` (13 values) | Drawn from the curve (§5.39) |
| `scroll/none`, `scroll/h`, `scroll/v`, `scroll/both` | Overflow scrolling | `overflowDirection` | Custom |
| `scroll/with-parent`, `scroll/fixed`, `scroll/sticky` | Position when scrolling | REST `scrollBehavior` SCROLLS / FIXED / STICKY_SCROLLS | Custom |
| `overlay/center`, `/top-left`, `/top-center`, `/top-right`, `/bottom-left`, `/bottom-center`, `/bottom-right`, `/manual` | Overlay position | `overlayPositionType` | Custom (box with a marker) |
| `pt/flow-start` | Flow starting point | `flowStartingPoints` | Custom flag (filled = on) |
| `pt/device` | Device / model | REST `prototypeDevice` | Lucide:monitor-smartphone |
| `pt/connection-handle` @12 | On-canvas connection handle | — | Custom (ring plus) |

#### S. Status, feedback and vector edit mode

| Id | Function | Source |
| --- | --- | --- |
| `status/info`, `status/success`, `status/warning`, `status/error` | Toasts, inline status | Lucide:info, Lucide:circle-check, Lucide:triangle-alert, Lucide:circle-alert |
| `status/spinner` @12 / @16 | Loading | Lucide:loader → custom |
| `status/legacy-layout` | Legacy auto layout version (Update button) [`03-auto-layout.md` §3.14] | Custom |
| `vec/move`, `vec/pen`, `vec/bend`, `vec/paint-bucket`, `vec/lasso`, `vec/done` @20 | Vector edit mode toolbar [`10-panels…` §4.5 rule 5, KNOW] | Lucide:mouse-pointer-2, pen-tool, spline, paint-bucket, lasso, check → custom |
| `vec/mirror-none`, `vec/mirror-angle`, `vec/mirror-angle-length` | Handle mirroring | `HandleMirroring` NONE, ANGLE, ANGLE_AND_LENGTH [API] → custom |
| `vec/winding-nonzero`, `vec/winding-evenodd` | Fill rule | `WindingRule` [API] → custom |

#### T. Cursors (custom, not icons, but in the same pipeline)

Cursors are SVG at 32 × 32 with 1× and 2× PNG fallbacks and an explicit hotspot. They have a white halo for visibility on any canvas. Set: default, move (duplicate ⌥ variant), resize (8 directions, rotated with the selection), rotate (4 corners, rotated), crosshair (shape tools), pen (add point, remove point, close path, convert, continue), bend, paint bucket, eyedropper, text I-beam, hand open and grabbing, zoom in and out, **scrub** (`ew-resize` style double arrow, shown over scrubbable labels), comment, and not-allowed. Cursor behavior is owned by CV and the relevant areas. This list is only the visual inventory.

---

## 4. Editor layout

### 4.1 Layout decisions the user confirmed previously

These come from the user's previous Illigma project. They are **locked (user-approved)** and stay the default unless the user says otherwise.

| Id | Decision | Figma | Framer | Status |
| --- | --- | --- | --- | --- |
| C-1 | **Floating tool strip at the bottom centre of the canvas** ([USER-TOKENS] `.toolbar { bottom: 20px }`). Settles FVR D-1 as option A. | UI3 also has a bottom tool strip [OBS] [DOC:360041064174 excerpt] | **Framer uses a top toolbar** [SRC:U7] plus a floating canvas toolbar [SRC:U11] | **L**, kept although Framer differs |
| C-2 | **Pages and layers on the left**, in the left sidebar | Same [OBS] | Same [SRC:U7, U8] | **L** |
| C-3 | **Properties on the right**, with Figma's Design and Prototype tabs | Same [OBS] | Right panel; 3.0 tabs are Style / Agent [SRC:N2] | **L** |
| C-4 | **Export at the bottom of the right sidebar**, docked as a footer region ([USER-TOKENS] `.sidebar-export`) | Export is the **last** Design-tab section and scrolls with the others [OBS] | n/a | **L**. The content order stays Figma's (Export last). Only its docking differs. |
| C-5 | **No top bar.** File name, save status and history live in the left sidebar header ([USER-TOKENS] "the workspace has no top bar") | UI3 also has no top bar [KNOW] | Top bar [SRC:U7] | **L** |
| C-6 | **Dark theme is the default** | Light, dark or system [DOC:5576781786647 excerpt] | Dark is the signature look [SRC:G1] | **L** |

### 4.2 Regions

```
┌──────┬──────────────────────┬─────────────────────────────────────────────┬────────────────────────┐
│ RAIL │ LEFT SIDEBAR         │ CANVAS (flexible)                           │ RIGHT SIDEBAR          │
│ 48   │ 240  (200–500)       │                                             │ 268  (240–480)         │
│      │┌ header 48 ─────────┐│ ┌ ruler 20 (⇧R, optional) ──────────────┐   │┌ header 48 ───────────┐│
│ [M]  ││ File name ▾  Saved ││ │                                       │   ││ Design  Prototype  ▶ ││
│ File ││ ↶ ↷                ││ │                                       │   │├ selection header 40 ─┤│
│ Asset│├ Pages      +  ▾ ───┤│ │       page background = document data │   ││ Frame ▾   ◇ ▣ ⊕      ││
│ Find ││  page rows (30)    ││ │                                       │   │├ sections (scroll) ───┤│
│ Vars │├ splitter ──────────┤│ │                                       │   ││ Position             ││
│      │├ Layers        ⇣ ───┤│ │                                       │   ││ Layout / Auto layout ││
│      ││  tree, virtualized ││ │                                       │   ││ Appearance · Fill …  ││
│      ││  rows 30           ││ │   toasts (20 px above the toolbar)    │   │├ Export footer ───────┤│
│ Bell ││                    ││ │   ┌ toolbar 48 ┐          ┌ zoom 36 ┐ │   ││ Export   +           ││
│      │└────────────────────┘│ └───┴────────────┴──────────┴─────────┴─┘   ││ [ Export Frame 1 ]   ││
└──────┴──────────────────────┴─────────────────────────────────────────────┴────────────────────────┘
```

| Region | Surface | Edge | Resizable | Hidden by |
| --- | --- | --- | --- | --- |
| Navigation rail | `--ill-panel` | 1 px `--ill-divider` on the right | No | Minimize UI (⌘⇧\\) [DOC:360039831974 excerpt]; Show/Hide UI (⌘\\) [`10-panels…` §4.6] |
| Left sidebar | `--ill-panel` | 1 px `--ill-divider` on the right | Right edge, 200–500 | Same |
| Canvas | Page background (data); `--ill-canvas` before the first render | — | — | — |
| Right sidebar | `--ill-panel` | 1 px `--ill-divider` on the left | Left edge, 240–480 [DOC:23954856027159 excerpt] | Same |
| Floating toolbar and zoom pill | `--ill-panel`, `--ill-radius-float`, `--ill-edge`, `--ill-shadow-float` | — | No (Figma's toolbar cannot be moved or docked [`10-panels…` §4.5 rule 6]) | Show/Hide UI |

### 4.3 Window chrome (Electron, ADR-001)

- **macOS.** `titleBarStyle: "hiddenInset"`. The traffic lights sit at the top-left, over the rail and the left-sidebar header.
  - The top 40 px (`--ill-titlebar-h`) of the rail and the left-sidebar header is a drag region (`-webkit-app-region: drag`). Every interactive element in it is `no-drag`.
  - The file name starts at x = 80 px, which clears the traffic lights.
  - In full screen the traffic lights hide and the header content shifts left to the 15 px gutter, with no animation.
- **Windows and Linux.** A frameless window with a **window-controls overlay** (`titleBarOverlay`) at the top-right. Its colour is `--ill-panel`, its symbol colour `--ill-text-2`, and its height 40 px.
  - The right-sidebar header reserves `env(titlebar-area-*)` space: the tabs stay left, and the Present button sits left of the controls.
  - If the overlay is not supported on a given Linux desktop, Illigma falls back to the native frame [KNOW] (verify on the CI Linux image).
- **Native menubar** (macOS) mirrors the in-app main menu (§5.41).
- The window's minimum size is 960 × 600 (`--ill-window-min`).

### 4.4 Navigation rail (left edge)

Figma's current UI adds a left **navigation bar**, announced at Schema 2025 and rolled out through 2026 [SRC:https://forum.figma.com/ask-the-community-7/missing-the-new-left-navbar-announced-at-schema-2025-47637 excerpt]. The Help Center lists its contents as the Figma menu, Files, Agents, Assets, Tools, the Variables view, and file notifications at the bottom [DOC:360039831974 excerpt]. The 2026-09-27 observation also saw a "navigation rail" [OBS].

| Slot | Illigma content | Figma function | Notes |
| --- | --- | --- | --- |
| Top | **Main menu** (Illigma mark) | Figma menu | Opens the main menu (§5.41) |
| 1 | **File** (pages and layers) | Files tab | Default |
| 2 | **Assets** | Assets tab (moved from the sidebar top) | ⌥2 shows Assets [KNOW] |
| 3 | **Find and replace** | Find, moved into the bar | ⌘F |
| 4 | **Variables** | Variables view entry [DOC:360039831974 excerpt] | Opens the full-window variables view (§5.37) |
| — | Agents, Tools | AI agents; plugins and widgets | **Out of scope** for a local-first app [DECISION]. Their slots are not reserved. |
| Bottom | **Notifications** | Library updates, missing fonts | Badge dot uses `--ill-warning` for missing fonts and `--ill-component` for library updates |

- **Size:** 48 px wide, with 32 px buttons (radius 6) and 8 px gaps (P, D-9).
- **Additional labels:** Figma shows tab labels under the icons by default and lets View toggle them [SRC: same forum excerpt][DOC:23954856027159 excerpt]. With labels on, the rail grows to 64 px and each button shows a 10 px label below a 20 px glyph (P · V).
- **States.**
  - Idle: `--ill-text-2` glyph.
  - Hover: `--ill-surface-2` fill and `--ill-text` glyph.
  - Active: `--ill-control` fill and `--ill-text` glyph.
  - Focus-visible: focus outline.
  - Badge: a 6 px dot at the top-right of the glyph.
- What happens when the user clicks the active tab (collapse the sidebar, or nothing) is unknown → V-UI-03.

### 4.5 Left sidebar

- **Header (48 px):**
  - File name (12/600, inline rename on double-click) with a file-menu caret. The menu contents are Figma's File menu (`10-panels…` §4.6).
  - Below or beside the name: the save-status indicator (P-9, §5.50).
  - Right side: undo and redo icon buttons. These are an **Illigma extension**, kept from the user's prototype ([USER-TOKENS] `.sidebar-history`, **L**). They call the existing Undo and Redo commands.
- **File tab:**
  - **Pages** section. Header "Pages" (12/600), a "+" add-page button and a collapse chevron. Page rows are 30 px (§5.33). A splitter below the section sets its height (`--ill-pages-h`).
  - **Layers** section. Header "Layers" with Collapse layers (⌥L) [`10-panels…` §3.3]. A virtualized tree (§5.32) that fills the rest of the height.
- **Assets tab:** search field, Libraries button, then local components grouped by page and folder, then enabled libraries. Tiles or rows (§5.34). Content belongs to the CP and DS specs.
- **Find and replace tab:** query field with Figma's options, a results list in 30 px rows, and a replace field. Behavior per `10-panels…` §3.11.
- **Width:** 240 px by default (**L**), resizable 200–500 px. Double-clicking the resizer resets it to 240.

### 4.6 Right sidebar

- **Header (48 px):**
  - Left: text tabs **Design** and **Prototype** (⇧E toggles [`09-prototyping.md` §5]).
  - Right: the **Present** split button (play glyph plus caret: Present / Preview) [`09-prototyping.md` §4].
- **Selection header (40 px).** The type icon plus a type or name dropdown (for example "Frame ▾", "3 layers", "Mixed"), followed by Figma's contextual action buttons (Create component, Use as mask, Boolean groups, Edit object, Crop, Detach). The behavior and the list belong to `10-panels…` §4.1.
- **Sections** scroll in Figma's order for the selection type (`10-panels…` §4.2). Each section is a §5.17 header plus rows.
- **Export footer** (C-4):
  - A docked region below the scroll area, separated by a 1 px `--ill-divider`.
  - It contains the Export section header ("Export" plus "+"), its rows (§5.19) and a full-width 30 px primary button "Export <layer name>" or "Export <n> layers" (FVR M-5; [DOC:360040028114 excerpt via `05-paint…` §4]).
  - With no export settings, only the header row (40 px) shows.
  - It grows up to 50 % of the sidebar height and then scrolls internally.
  - With nothing selected it shows the page's export settings, as Figma does [`05-paint…` §4].
  - It is shown on the Design tab only. Figma lists Export among the Design-tab sections [OBS]; its absence from the Prototype tab is [KNOW] → V-UI-04.
- **Width:** 268 px by default (**L**, the user's `--inspector-width`), resizable 240–480 px by the left edge ([USER-TOKENS] `.inspector-resizer`; [DOC:23954856027159 excerpt]).

### 4.7 Canvas area

- **Background.** The page background is document data (`PageNode.backgrounds` [API]). The chrome never tints it.
- **Floating toolbar** (C-1):
  - Placement: centred in the **canvas area**, not the window, 20 px from the bottom (**L**).
  - Surface: `--ill-panel` with 8 px padding and gap, radius 12, `--ill-edge`, `--ill-highlight-top` and `--ill-shadow-float` (**L**).
  - Contents: Figma's tool groups and flyouts (`10-panels…` §4.5).
  - In vector edit mode the same surface shows Figma's contextual vector tools and **Done** [KNOW → `10-panels…` T-03].
- **Zoom pill.** The user's previous layout is kept: [USER-TOKENS] `.zoom-control` (36 px tall, radius 8, padding 4, a 1 × 16 px divider), at the bottom-right of the canvas, 20 px inset, on the toolbar's baseline (**L**).
  - The percentage button opens **Figma's zoom/view menu**: zoom commands, Property labels / Additional labels, rulers, pixel grid, layout guides and the Prototyping toggle. Figma puts this menu in the right-sidebar header [DOC:23954856027159 excerpt][DOC:4411431245335 excerpt].
  - The "−" and "+" buttons are an Illigma extension.
  - D-13 asks whether to also mirror the menu in the right-sidebar header, as Figma does.
- **Rulers** (⇧R): a 20 px strip along the top and left of the canvas area. The corner square is `--ill-panel` (§5.49).
- **Toasts:** bottom centre, 20 px above the toolbar ([USER-TOKENS] `#toast { bottom: 58px }`).
- **Overlap rule.** When the canvas area is narrower than toolbar + zoom pill + 3 × 20 px, the zoom pill moves up to sit 8 px above the toolbar's right end. This follows the user's previous responsive rules (breakpoints at 1050, 760 and 550 px [USER-TOKENS]).
- **Fit commands** ("Zoom to fit", "Zoom to selection") inset the target rectangle by the toolbar's height plus 20 px, so content is never fitted under the toolbar. This is an Illigma chrome rule; the zoom maths is CV's.

### 4.8 Focus regions and their order

F6 / ⌃F6 cycles the regions [DOC:35063862380311 excerpt]: **rail → left sidebar → canvas → toolbar → right sidebar (including the Export footer) → rail**. ⇧F6 cycles backwards (P). The order is [KNOW] → V-UI-01. Entering a region focuses its last-focused element, or its first one. Each region has an `aria-label` and the `region` landmark role.

### 4.9 Window-size behavior and persistence

- **Canvas minimum.** The canvas area keeps at least 360 px. If the stored sidebar widths do not fit the window, the left sidebar shrinks first and then the right one, never below their minimums. The shrink is temporary and does not overwrite the stored preference.
- **Minimize UI** (⌘⇧\\) collapses the rail and both sidebars [DOC:360039831974 excerpt]. **Show/Hide UI** (⌘\\) hides all chrome except the canvas. Neither causes a reflow animation (0 ms).
- **Interface scale** multiplies every size token (§6.4).
- **Persistence.** Panel widths, the Pages split height, the active rail tab, the active right-sidebar tab and collapsed inspector sections are **per-device app preferences** (`10-panels…` §2.3). They are never document data and never undoable.

---

## 5. Component inventory

Each entry gives the **Figma function** it serves (behavior lives in the parity spec cited), its **anatomy**, **variants**, **state deltas** from §5.0, **keyboard** behavior and accessibility notes. All entries are **Not started**. "Owner" names the parity spec that owns the behavior. The kit implements the presentation and the interaction contract; the panel wires it to the engine (§6.5).

### 5.0 Shared state model

| State | Trigger | Treatment (dark; light swaps tokens) | Notes |
| --- | --- | --- | --- |
| Default | — | Per component | |
| Hover | Pointer over, with no drag in progress | Control: `--ill-control` → `--ill-control-hover`. Ghost or row: transparent → `--ill-surface-2`. Glyph: `--ill-text-2` → `--ill-text`. | Never on touch-only input |
| Active (pressed) | Pointer down; Space or Enter held | `--ill-control-active`; accent fills → `*-pressed` | |
| Selected / on | `aria-pressed`, `aria-checked`, `aria-selected` | Row: `--ill-accent-dim`. Segmented: `--ill-raised` indicator. Tool or checkbox: `--ill-accent` fill with a white glyph. | |
| Focus (pointer) | Focus caused by a pointer | Inputs: `--ill-focus-inset`. Other controls: no ring. | [SRC:F1] |
| Focus-visible (keyboard) | `:focus-visible` | Inputs: `--ill-focus-inset`. Everything else: `--ill-focus-outline` (2 px, offset 2). | [USER-TOKENS] |
| Disabled | `aria-disabled="true"` | 50 % opacity, no hover change, default cursor. It stays focusable when its tooltip explains why. | [SRC:F1] (the user used .3–.45) |
| Read-only | The property exists but cannot be edited here (for example X/Y of an auto layout flow child [OBS]) | The value stays at full `--ill-text`; no hover fill; default cursor; a tooltip gives the reason | Owner: AL §4.2 |
| Mixed | The selected nodes disagree | Field: placeholder "Mixed" in `--ill-text-placeholder`. Checkbox: indeterminate dash. Segmented: no indicator. Swatch: `paint/mixed` glyph. | Owner: UX §4.3 |
| Error / invalid | Unparsable or out-of-range input | Inset 1 px `--ill-danger` ring while the text is invalid. On commit the value reverts (Figma [KNOW]). No inline text. | P-4 |
| Bound | A variable or style is applied | A chip replaces the value (§5.35) | Owner: DS §4 |
| Overridden | An instance property differs from its main component | A 4 px `--ill-component` dot before the label or row, with a tooltip "Overridden" | FVR M-8 [DECISION] |
| Drag-over | Valid drop target | `--ill-drop-indicator` line (2 px) or ring (1 px) | [USER-TOKENS] |
| Loading | Async content | `status/spinner` at 12 px inside a box of the final size | P-4 |

### 5.1 Icon

- **Function:** renders a §3 glyph. **Anatomy:** inline SVG `<use>` from the sprite; `aria-hidden` unless it has a label.
- **Variants:** sizes 12, 16, 20; `tone` = inherit, secondary, accent, component, danger, warning, success.
- **A11y:** an icon-only control gets `aria-label` from its command name, which is the same string as its tooltip.

### 5.2 Text, Kbd, Badge, Counter

- **Text:** the type scale of §2.3, with truncation and an automatic tooltip on overflow.
- **Kbd:** shortcut display. "Sheet" variant (user style, §2.3) and "inline" variant (`--ill-text-2`, no chip). Glyphs follow the platform.
- **Badge:** 16 px tall, radius 4, 11/600; tones neutral (`--ill-surface-2` / `--ill-text-2`), accent fill, component fill and danger fill.
- **Counter:** 16 × 16 minimum, radius 4, `#252525` background with `--ill-text-2` text ([USER-TOKENS] `.panel-counter`, **L**).

### 5.3 Button

- **Function:** command buttons, for example "Export Frame 1", "Create variable", dialog actions, the "Update" button for library components.
- **Anatomy:** 30 px tall, padding 0 12 px, radius `--ill-radius-control`, 12/600 label, optional leading 16 px glyph with a 6 px gap.
- **Variants:**

  | Variant | Fill | Label |
  | --- | --- | --- |
  | primary | `--ill-accent-fill` → hover `-hover` → pressed `-pressed` | `--ill-on-accent` |
  | secondary | `--ill-control` → `--ill-control-hover` → `--ill-control-active` | `--ill-text` |
  | ghost | transparent → `--ill-surface-2` | `--ill-text-2` → `--ill-text` |
  | destructive | `--ill-danger-fill` → `-hover` | `--ill-on-accent` |
  | component | `--ill-component-fill` → `-hover` | `--ill-on-accent` |

  Full-width and pill shapes: pills (radius 40) only if D-3 keeps them.
- **States:** §5.0. A loading state swaps the glyph for a spinner and keeps the width.
- **Keyboard:** Enter or Space activates. In dialogs the primary button is the default for Enter, unless focus is in a multi-line field.

### 5.4 IconButton and ToggleIconButton

- **Function:** section "+" / "−", eye, lock, detach, settings, more, close, the alignment buttons and the zoom "−" / "+".
- **Anatomy:** 24 × 24 hit area (`--ill-size-hit`), a 16 px glyph (12 px in chips), radius 6. The hover fill is `--ill-surface-2`, or `--ill-overlay-hover` on coloured rows.
- **Toggle variant:** `aria-pressed`. On = `--ill-accent` glyph (and the `-on` glyph variant where §3 defines one). The user's prototype used an accent glyph on `#0099ff1a` for pressed view toggles ([USER-TOKENS] `#toggle-rulers[aria-pressed]`, **L**).
- **Keyboard:** Enter or Space. **Tooltip:** always, with the Figma shortcut if there is one.

### 5.5 ToolButton with flyout, and Toolbar

- **Function:** Figma's toolbar groups, where the last-used tool of a group is displayed and activated, and a chevron opens the group's list with shortcuts (`10-panels…` §4.5 rules 1–6).
- **Anatomy:**
  - Tool: 32 × 32, radius 6, 20 px glyph (D-12; the user had 18 px).
  - Flyout: a separate 12 × 32 hit zone holding a 12 px chevron, at the right of the tool in a split-button pair.
  - Dividers: 1 × 24 px `--ill-divider` with 2 px margin ([USER-TOKENS], **L**).
- **States:**
  - Idle: `--ill-text-2` glyph.
  - Hover: `--ill-surface-2` fill and `--ill-text` glyph.
  - Active tool: `--ill-accent` fill with a white glyph; hover does not change it ([USER-TOKENS] `.tool.active`, **L**). Whether Framer fills the active tool or only tints the glyph is unverified (FVR §8.1).
  - Flyout open: chevron in `--ill-text` and the menu open above the toolbar.
- **Flyout menu:** a §5.40 menu opening upwards, items = tool glyph + name + shortcut, with the current tool checked.
- **Keyboard:** the toolbar is one tab stop with a roving tabindex. ←/→ move between tools, Enter activates, ↓ or Alt+↓ opens a flyout. The global tool shortcuts (V, F, R, …) work whenever focus is not in a text field.
- **A11y:** `role="toolbar"`, `aria-orientation="horizontal"`; each tool is a `radio` in a `radiogroup` for the active tool, with the flyout as a `menu` button.

### 5.6 Tabs

- **Function:** Design / Prototype (right sidebar); Custom / Libraries (colour picker [OBS]); type-settings tabs (TX §4); variables-view collections when shown as tabs.
- **Anatomy:** text tabs at 12 px. Active: 600 `--ill-text` (light: `--ill-accent-text` per FVR M-7). Inactive: 500 `--ill-text-2`; hover `--ill-text`. The tab bar is 48 px in sidebar headers and 30 px inside popovers.
- **Indicator:** none in the Framer look (FVR §8.2, **V**). The user's prototype used a 2 px accent underline ([USER-TOKENS] `.inspector-tabs button:after`). It is listed under D-11 as the alternative.
- **Keyboard:** ←/→ move and activate (automatic activation, because panels render instantly). Home and End jump. Figma's shortcuts (⇧E, ⌥8, ⌥9) also switch tabs.
- **A11y:** `tablist` / `tab` / `tabpanel`.

### 5.7 SegmentedControl

- **Function:** flow selector (Freeform / Vertical / Horizontal / Grid [OBS]), text alignment, paint type, blur type (Uniform / Progressive), stroke position where Figma shows it as buttons, animation direction.
- **Anatomy:** a 30 px track on `--ill-surface-2` (or `--ill-control` inside cards), radius 8, 2 px inset. The indicator is radius 6, `--ill-raised` with `--ill-shadow-raised`, and slides 200 ms [SRC:G4]. Segments are text (12 px) or 16 px glyphs, equal width or content width.
- **States:**
  - Inactive segment: 500 `--ill-text-2`. Hover: `--ill-text`.
  - Active segment: 600 `--ill-text` (light: `--ill-accent-text`).
  - Mixed: no indicator, all segments inactive.
  - Disabled segment: 50 % opacity, skipped by the arrow keys.
- **Keyboard:** one tab stop. ←/→ move **and** commit, because each commit is one undo step (ADR-011). Home and End jump.
- **A11y:** `radiogroup` / `radio`, with icon segments labelled by their Figma names.
- **Rule:** use a segmented control only where Figma shows mutually exclusive buttons. Where Figma shows a dropdown, use a Select (FVR M-1).

### 5.8 Toggle switch

- **Function:** boolean settings that Figma shows as switches, for example instance BOOLEAN properties (CP §4.4), "Show in exports" and Preferences. The control type follows Figma's choice for each property (FVR §8.5; verify per property, §9).
- **Anatomy:** 28 × 16 track, radius 8. Knob: 12 px white circle with `--ill-shadow-raised`, 2 px inset. On: `--ill-accent` track. Off: `--ill-control` track with a 1 px `--ill-edge` ring (3:1 boundary). The knob slides 150 ms.
- **States:** mixed shows the knob centred on a `--ill-control` track. Disabled: 50 %.
- **Keyboard:** Space toggles. **A11y:** `role="switch"`, `aria-checked`, with `mixed` exposed as `aria-checked="mixed"`.

### 5.9 Checkbox and Radio

- **Function:** Clip content [OBS], "Smart animate matching layers", "Show behind transparent areas", variable scopes, export options.
- **Checkbox:**
  - Geometry: 14 px, radius 4 [SRC:F1].
  - Off: `--ill-control` with an inset 1 px `rgba(255,255,255,.1)` ring (light `rgba(0,0,0,.1)`).
  - On: `--ill-accent` with a 1.75 px white check (white on `#0099ff` = 3.00, which meets the 3:1 non-text minimum [COMPUTED]).
  - Indeterminate: accent fill with an 8 px white dash.
- **Radio:** 14 px circle; the "on" state is a 6 px white dot on accent. Disabled: 30 % [SRC:F1].
- **Label:** 12/500 `--ill-text`, 8 px gap. The whole label is the hit area, at least 24 px tall.
- **Keyboard:** Space. **A11y:** native `input` elements, styled.

### 5.10 TextField

- **Function:** names (layer rename, page, property name, variable name), search, URL (Open link), text component property values, string variable values, export suffix.
- **Anatomy:** 30 px, radius 8, `--ill-control`, borderless, padding 0 8 px, 12/500 text, placeholder in `--ill-text-placeholder`. An optional 12 px leading glyph (search) sets the text inset to 28 px. An optional trailing clear "×" appears when non-empty and focused.
- **Variants:** `sm` (24 px, for inline rename and table cells); multi-line (auto-grow up to 6 lines, then scroll; used for descriptions and the text property); search.
- **Keyboard:** Enter commits (single-line), Esc reverts and blurs, Tab commits and moves on. Text editing shortcuts are native. Global shortcuts are suspended while it has focus (P-3).
- **States:** §5.0. `::selection` uses `--ill-text-selection-bg` / `-fg`.

### 5.11 NumberField

- **Function:** every numeric property: X, Y, W, H, rotation, corner radius, opacity, gap, padding, stroke weight, font size, line height, letter spacing, effect parameters, grid counts, durations and so on. **Owner of the behavior:** `10-panels…` §4.3 and UX-120…122. The fields with their own precision and limits are owned by each area.
- **Anatomy:** `[prefix 12 px glyph or letter] [value, tabular figures] [unit suffix] [trailing zone]`.
  - The prefix is the **scrub handle**, 24 px wide, with the scrub cursor.
  - The unit is in `--ill-text-placeholder`.
  - The trailing zone holds either the sizing caret (W/H, §5.12) or the hover-revealed `act/variable` button where Figma allows binding (DS §4).
  - With Additional labels on, a sub-label sits below in 10/500 `--ill-text-placeholder` and is also scrubbable [SRC:U1].
- **Scrubbing** (behavior: UX-120):
  - Dragging horizontally on the prefix or label changes the value live as one gesture transaction, which is one undo step on release (UX-197).
  - Figma also shows the scrub cursor when ⌥/Alt is held over **any** numeric field in the right sidebar. Moving the pointer towards the top of the screen speeds scrubbing up and towards the bottom slows it down [SRC:https://forum.figma.com/report-a-problem-6/option-drag-to-change-values-is-inconsistent-36984 and …/type-sizing-with-mouse-dragging-57230, search excerpts]. The role of ⇧ is disputed in the sources → V-UI-06.
  - The kit uses Pointer Lock during a scrub, so the gesture is not limited by the screen edge, and draws its own scrub cursor in the overlay layer (P · V).
  - Esc during a scrub cancels the gesture and restores the value (P; verify).
- **Arithmetic** (behavior: UX-122):
  - Accepts `+ − * /`, parentheses and decimal numbers.
  - Accepts a leading operator relative to the current value (`+10`, `*2`).
  - Accepts `%` in dimension fields, meaning a percentage of the current value. Figma staff quoted the Help Center listing `% + − * /` for dimension fields [SRC:forum.figma.com staff reply, search excerpt].
  - Unit suffixes (`px`, `%`, `°`, `ms`) are accepted and stripped when they match the field's unit.
  - With Mixed values, a relative expression applies per node (verify, UX-122).
  - The evaluator is a small, safe parser (no `eval`), shared with the variables expression editor only for numbers.
- **Mixed:** shows the placeholder "Mixed". Typing applies the value to all nodes; Esc leaves all of them untouched (UX §4.3).
- **Keyboard:**
  - ↑/↓: ± small nudge (default 1).
  - ⇧↑ / ⇧↓: ± big nudge (default 10). The nudge amounts come from Preferences → Nudge amount [`10-panels…` §3.18].
  - Enter commits. Whether focus stays in the field is verify I-16.
  - Tab / ⇧Tab commit and move.
  - Esc reverts and blurs.
  - Focusing selects all.
- **Display precision:** the area spec decides precision. The kit trims trailing zeros and shows at most two decimals by default. The stored value is never rounded by the kit.
- **States:**
  - Invalid text → error ring.
  - Read-only for flow children's X/Y [OBS].
  - Disabled.
  - Bound: a chip replaces the value; clicking the chip opens the variable picker, and its detach glyph unbinds.
- **A11y:** `role="spinbutton"`, `aria-valuenow` (omitted when Mixed), `aria-valuetext` ("Mixed", "24 px", "45°"), and a label from the Figma field name (for example "Width"). The scrub handle is `aria-hidden`.

### 5.12 Unit-aware and sizing-aware fields

- **Units:** px (implicit), % (opacity, line height, letter spacing), ° (rotation, gradient angle), ms (durations, delays), "fr" (grid FLEX tracks [API `GridTrackSize`]). The unit shows as a suffix; the line-height field can also show **Auto** [API `LineHeight`].
- **Auto values:** gap **Auto** [OBS; AL §3.6] and line height **Auto** show the word "Auto" as the value in `--ill-text`. Typing a number replaces it. The option is also offered in the field's dropdown.
- **W/H sizing field** (AL §4.1): a NumberField whose trailing zone is a 16 px caret hit area.
  - The caret opens Figma's menu: Fixed width / Hug contents / Fill container (unavailable options disabled), Add min…, Add max…, Remove min and max, Apply variable.
  - When the axis is Hug or Fill, the value field shows the computed size in `--ill-text` and the mode label ("Hug", "Fill") replaces the prefix area.
  - Typing a value switches the axis to Fixed (Figma [DOC:360040451373 excerpt]).
  - Min and max appear as additional NumberFields under W/H with the `al/min` and `al/max` prefixes and a remove "−" on hover.
  - The min/max preview on canvas is shown on hover of the W/H icon [AL §4.3].

### 5.13 Linked and split field groups

- **Function:** padding (horizontal + vertical with an **individual padding** toggle → T/R/B/L) [AL §3.7]; corner radius with **independent corners** → TL/TR/BR/BL [VC]; per-side stroke weights [PE]; X/Y; W/H with an aspect-ratio lock; grid rows × columns.
- **Anatomy:** a 2-up or 4-up row of NumberFields with 10 px gaps and no left label (FVR M-4).
  - The toggle (`al/pad-individual`, `app/radius-independent`) is a ToggleIconButton at the row end.
  - Expanding to four fields animates the section height in 150 ms.
  - A combined field shows **Mixed** when its pair differs (AL-055, VC-023).
- **Keyboard:** Tab order is left-to-right, then top-to-bottom: T, R, B, L for padding; TL, TR, BR, BL for corners [DECISION; verify against Figma's field order, §9].

### 5.14 Select (dropdown)

- **Function:** every Figma dropdown: blend mode, constraints, stroke position, font style, effect type, export format and scale, trigger, action, animation, easing, variable mode, layout-guide type and so on.
- **Anatomy:** the input box (30 px, radius 8, `--ill-control`, padding 0 20 0 8) showing the current value and a 12 px chevron 8 px from the right in `--ill-text-2` [SRC:F1]. It opens a §5.40 **menu**, never a native `<select>` (FVR-012).
  - The current item is checked.
  - The menu opens **over** the trigger, with the selected item aligned to the trigger's text, which matches macOS pop-up behaviour (P · V). If that does not fit, it opens below.
- **Variants:** text; glyph + text (blend modes, effect types); glyph-only (compact, 30 × 30); "inline" (no fill until hover, used in effect rows [USER-TOKENS] `.effect-type-select`).
- **Mixed:** shows "Mixed" and no item is checked.
- **Keyboard:** Enter, Space or ↓ opens. Type-ahead selects. ↑/↓ on a closed select does **not** change the value (avoids accidental undo steps) [DECISION].
- **A11y:** `combobox` (select-only) with a `listbox`, or a menu button, depending on the Zag machine.

### 5.15 Combobox and search

- **Function:** font family picker (TX §4), font size (presets plus typing), instance swap (CP §4.4), destination frame picker (PR), asset search, variable picker search, actions menu search.
- **Anatomy:** a TextField with a dropdown list.
  - Rows are 30 px. The font picker renders each family name in its own face (lazy, cached; fixed row height for no layout shift) [KNOW].
  - Section headers are 11/600 `--ill-text-2`.
  - An empty result shows the "No results" text in `--ill-text-2`.
- **Keyboard:** typing filters; ↑/↓ move the highlight (the list scrolls the highlight into view); Enter applies; Esc closes and restores. In the font picker, ↑/↓ also **preview** the highlighted family on the selection live, as one gesture transaction committed on Enter [KNOW] → V-UI-07.
- **Virtualization:** lists longer than 200 rows use `@tanstack/solid-virtual` (ADR-021).

### 5.16 Slider

- **Function:** only where Figma uses sliders: the colour picker's hue and opacity strips, image adjustments, and some effect parameters (verify per parameter).
- **Anatomy (3.0 style):** 3 px track, radius 2; 12 px white thumb with `0 1px 3px rgba(0,0,0,.2), 0 .5px 0 rgba(0,0,0,.1)`; fill `#707070` in dark and accent in light; rest track `#444` / `#ddd` [SRC:G3].
  - Hue and alpha strips: 12 px tall, radius 6, ring thumb 12 px (2 px white plus shadow), checkerboard under the alpha strip.
  - Image-adjustment sliders are centred at 0 with a centre tick. Double-clicking resets to 0.
- **Keyboard:** ←/→ ±1 unit, ⇧ ±10, Home/End min/max. Each keyboard step is coalesced into one undo step per focus session (UX-197).

### 5.17 Section header

- **Function:** Figma's inspector sections (Position, Layout, Appearance, Fill, Stroke, Effects, Layout guide, Export, Typography, Selection colors, Variables, Styles, Interactions …). In Figma, list sections have "+", a styles/variables button, per-item "−" and an empty state of title plus "+" (`10-panels…` §4.1).
- **Anatomy:** 30 px row inside the section's 10 px top padding.
  - Title: 12/600 `--ill-text`, or `--ill-text-2` when the list is empty (FVR §8.3).
  - Right-aligned actions: `act/styles` (four dots), `act/variable` where relevant, `act/settings` and `act/add`, all 24 px hit areas with 16 px glyphs in `--ill-text-2`.
  - Optional leading 12 px collapse chevron. Collapse state is a per-device preference (§4.9) and never document data.
  - Mixed list contents: the body shows the placeholder text "Click + to replace mixed content" in `--ill-text-2` [KNOW → `10-panels…` I-14].
- **Applied style:** the style chip (§5.35) replaces the rows and shows the style name, a detach glyph and an edit glyph (DS §4).
- **Keyboard:** each action is a tab stop. The section is not a disclosure unless collapse is enabled; then the title is a button with `aria-expanded`.

### 5.18 PropertyRow and panel grid

- **Function:** layout primitive for every inspector row.
- **Variants:**
  - **Labelled** (single-concept rows such as Opacity, Blend, Clip content): grid `[label minmax(0,1.5fr)] [control minmax(62px,1fr)] [control minmax(62px,1fr)]`, 10 px column gap, 15 px label inset, 40 px pitch [SRC:G3].
  - **Unlabelled 2-up / 3-up / 4-up** for multi-field rows (FVR M-4).
  - **Full-width** for lists and widgets.
- **Rules:** controls never shrink below 62 px. Below that, the row wraps to the next line at the same pitch rather than truncating values (checked at 240 px, the right sidebar's minimum; FVR-009). With Additional labels on, every unlabelled field shows a 10 px sub-label.

### 5.19 List item rows (paint, effect, layout guide, export, interaction, property)

- **Function:** Figma's ordered lists: multiple fills and strokes, effects, layout guides, export settings, interactions, component properties.
- **Anatomy:** the 30 px main control plus trailing actions outside it. Actions are an eye (hidden-state glyph stays visible when the item is hidden) and "−" as 24 px hit areas. A 12 px grip appears on hover at the left gutter edge.
- **Reorder:** drag by the grip or the row background. A 2 px insertion line shows the target. The drop is one undo step. Keyboard reorder: ⌥↑ / ⌥↓ on a focused row (P; Figma equivalent unknown → V-UI-08).
- **Add and remove:** the row expands or collapses in 150 ms (height + opacity). Focus moves to the new row's main control, or after removal to the next row, else to the section "+".
- **Hidden item:** the row content shows at 50 % opacity and the eye-off glyph stays visible [USER-TOKENS] `.effect-toggle-btn.is-hidden`.

### 5.20 ColorSwatchInput (swatch + hex + opacity)

- **Function:** fill, stroke, effect-colour, layout-guide colour, page background, prototype background and colour-variable values. Owner: PE §4 (fill row), DS §4.
- **Anatomy:** one 30 px control, radius 8:
  1. A 22 px swatch (radius 4, inset 1 px `rgba(0,0,0,.05)`) at a 4 px inset. Clicking it opens the colour picker (§5.21).
  2. An 8 px gap, then the **uppercase hex** (or the paint-type label: "Linear", "Image", …) in 12/500 `--ill-text`.
  3. A 1 px divider, then the paint opacity "100" with "%" in `--ill-text-placeholder`.
  - The visibility eye and "−" sit outside the control (§5.19).
- **Swatch rendering:** an 8 px checkerboard under translucent colours; gradient and image thumbnails; the `paint/mixed` glyph; `paint/none` for an empty value.
- **Opacity field:** **type-only, not scrubbable.** Figma staff said in September 2026 that the opacity field next to the hex was deliberately made type-only because dragging it interfered with neighbouring fields [SRC:https://forum.figma.com/report-a-problem-6/bug-scrub-drag-percentage-opacity-values-broken-58377 excerpt] → V-UI-09.
- **Hex field:** accepts 3, 6 and 8 digits (8 = with alpha [DOC:360043042113 excerpt]), with or without `#`, and CSS colour names [KNOW → V-UI-10]. Invalid input reverts.
- **Bound:** a style or variable chip replaces the hex and opacity (§5.35).
- **Keyboard:** the swatch is a button (Enter opens the picker); the hex and opacity fields are TextField and NumberField.

### 5.21 ColorPicker popover

- **Function:** edits one paint channel of one target. Figma's picker shows **Custom / Libraries** tabs, paint-type controls, hue and opacity, a colour format, an eyedropper, page swatches and a close control [OBS]. It lets you switch between document colours and library colours, choose a library palette from an **On this page** dropdown, and open the Libraries tab by clicking a style or variable [DOC:360041003774 excerpt]. Colour models are Hex, RGB, CSS, HSL and HSB, and ⌥-drag scrubs the RGB, HSL and HSB fields [DOC:360043042113 excerpt]. Owner: PE §4 and PE-030.
- **Anatomy** (width `--ill-picker-w` 240; surface `--ill-elevated`, radius 12, `--ill-shadow-popover`; body padding 10 px), from top to bottom:
  1. Header, 40 px: text tabs Custom | Libraries, then a close "×".
  2. Paint-type row: an icon segmented control (Solid, Gradient, Pattern, Image, Video, Shader, as available [OBS]) plus a blend-mode select button for the paint [DOC:360040667874 excerpt].
  3. Body for the type. For **Solid**:
     - Colour area: square, radius 6, with a 12 px ring thumb (2 px white plus `0 1px 3px rgba(0,0,0,.6)`, [USER-TOKENS] `.color-square > span`).
     - Row: eyedropper IconButton, then hue strip and opacity strip stacked (§5.16).
     - Row: colour-model Select (Hex / RGB / CSS / HSL / HSB) plus value fields. Hex = one field plus opacity. RGB / HSL / HSB = three NumberFields plus opacity, each 10/500 sub-labelled. CSS = one TextField.
     - **On this page** Select plus a swatch grid: 16 px squares, radius 4, 8 per row, 8 px gaps. The selected swatch has a 1 px `--ill-text-2` ring at 3 px offset ([USER-TOKENS] `.swatch.active`).
  4. Libraries tab: a search field, then collections and style groups as 30 px rows (12 px swatch + name), with headers per library. Selecting applies the style or binds the variable (DS §4).
- **Placement:** anchored to the **left edge of the right sidebar**, top-aligned with the triggering row, and clamped to the viewport with an 8 px margin. Repositioning when the selection changes, or staying open across selection changes, follows Figma → V-UI-05.
- **States:** "Mixed" shows an empty colour area with a "Mixed" label in the value field. Library colours that are unavailable show `status/warning`.
- **Keyboard:**
  - Tab cycles the controls.
  - In the colour area, arrows move 1 % (⇧ 10 %).
  - Hue: ←/→ ±1° (⇧ 10°).
  - **I** starts the eyedropper [PE §5].
  - Esc closes the picker (the edit is already committed per gesture) and returns focus to the swatch.
- **Eyedropper loupe:** on `--ill-z-capture`, a 120 px circle at 8× magnification with a 1 px grid, a centre square in `--ill-sel`, and a hex pill below (11/600 on `--ill-tooltip`). Esc cancels. ⇧-click applies the style or variable instead of the value [PE §5].

### 5.22 GradientEditor

- **Function:** linear, radial, angular and diamond gradients: type, stops, positions, orientation, on-canvas handles [PE §4].
- **Anatomy (inside the picker):**
  - Type Select (Linear, Radial, Angular, Diamond), then flip and rotate-90 IconButtons.
  - **Stop bar:** full width, 12 px tall, radius 6, over a checkerboard. Stops are 12 px squares, radius 4, with a 2 px white ring and a shadow. The selected stop has a 2 px `--ill-sel` ring.
  - Stop list: rows with position % (NumberField 56 px) + ColorSwatchInput + "−".
  - Below: the Solid body for the selected stop.
- **Interactions:** click the bar to add a stop with the interpolated colour; drag a stop to move it; Delete removes the selected stop when more than two exist [KNOW → V-UI-11]. A drag is one undo step.
- **On canvas:** endpoints are 8 px white circles with a 1 px `--ill-sel` stroke; stops sit on the line as 8 px squares filled with their colour; the selected stop is accent-ringed (P-7).
- **Keyboard:** ←/→ move the selected stop by 1 % (⇧ 10 %); Tab moves between stops.

### 5.23 ImageFillEditor (and video, pattern, shader)

- **Function:** scale mode (Fill / Fit / Crop / Tile), tile %, rotate 90°, choose or replace the image, seven adjustments (exposure, contrast, saturation, temperature, tint, highlights, shadows) [DOC:360041098433 excerpt via PE §4][API `ImageFilters`].
- **Anatomy:**
  - Scale-mode Select, then rotate IconButton.
  - Preview: full width, radius 10 [SRC:G3], over a checkerboard. Its "Choose image" or "Replace" button is a translucent button on `--ill-media-scrim` with `--ill-blur-overlay`, shown on hover and focus.
  - Tile %: NumberField (Tile mode only).
  - Seven centred sliders, each with a NumberField (§5.16).
- **Crop mode:** on canvas. Crop handles use the selection-handle style. "Done" sits in the contextual toolbar.
- **Video:** the image controls plus playback options per PE. **Pattern:** source picker, tile-type segmented (`pattern/*`), scale, spacing, alignment [PE §4]. **Shader:** a dynamic list of property controls generated from `ShaderPropertyDefinition` types [API], built from the same primitives.

### 5.24 EffectRow and EffectPopover

- **Function:** Figma's ordered effect stack: drop shadow, inner shadow, layer blur, background blur (uniform or progressive), noise (mono, duo, multi), texture, glass, shader [API `Effect`]. Owner: PE §4.
- **Row:** a §5.19 row. The control is `[settings IconButton with the effect-type glyph] [inline type Select]`, then the eye and "−" outside ([USER-TOKENS] `.effect-row`).
- **Popover** (`--ill-popover-w` 240, header = the effect name), with fields per type, each a NumberField or ColorSwatchInput with Apply variable where Figma allows it:

  | Type | Fields |
  | --- | --- |
  | Drop shadow | X, Y, Blur, Spread (2 × 2 grid), colour, "Show behind transparent areas" checkbox [PE §4] |
  | Inner shadow | X, Y, Blur, Spread, colour |
  | Layer blur, background blur | Uniform / Progressive segmented. Uniform: Blur. Progressive: start and end radius, plus on-canvas start and end handles [API][PE §4] |
  | Noise | Type segmented (Mono / Duo / Multi), size, density, colour(s), opacity [API] |
  | Texture | Size, radius, "Clip to shape" checkbox [API `TextureEffect`] |
  | Glass | Light intensity, light angle, refraction, depth, dispersion, radius [API `GlassEffect`] |
  | Shader | Generated property controls [API `ShaderEffect`] |

  Field labels, order and ranges follow PE and V-29 to V-32. The popover's layout uses a 2-column grid of labelled NumberFields with 10 px gaps.
- **Keyboard:** Enter on the settings button opens the popover with focus on the first field. Esc closes it and returns focus to the button.

### 5.25 Stroke row and StrokeSettingsPopover

- **Function:** stroke paints plus position (Inside / Center / Outside), weight, per-side weights, and advanced settings: style (Solid / Dashed), dash, gap, dash cap, join, start and end points, swap, and the Draw-mode width profile, brush and dynamic stroke [PE §4][DOC:360049283914 excerpt][API].
- **Section anatomy:**
  - Paint rows (§5.19 plus §5.20).
  - A 2-up row: position Select | weight NumberField (`stroke/weight` prefix) with a trailing sides button (`stroke/sides-*`) that opens the per-side menu. Custom sides expand to a 4-up T/R/B/L row (§5.13).
  - Then the `act/settings` button, which opens the popover.
- **Popover:**
  - Style segmented (Solid / Dashed); dash and gap NumberFields (Dashed only); dash-cap Select.
  - Join segmented (`stroke/join-*`).
  - Start-point and end-point Selects with cap glyphs (8 values [API `StrokeCap`]) and a swap button.
  - Draw section: width-profile picker (thumbnails), brush picker (Stretch / Scatter galleries), dynamic stroke options [API `ComplexStrokeProperties`].
- **Mixed:** the weight shows "Mixed" when per-side weights differ (PE-133).

### 5.26 AutoLayoutPanel (the Layout section)

- **Function:** AL §4.1 and §4.2. Every control and option, with the behavior owned by `03-auto-layout.md`.
- **Anatomy** (Design tab, frame-like selection):
  1. **Flow row:** an icon segmented control **Freeform | Vertical | Horizontal | Grid** [OBS shows Freeform, Vertical and a Wrap control], plus a **Wrap** ToggleIconButton that is enabled only for stack flows [AL §4.1].
  2. **Size row:** W and H sizing fields (§5.12), with min/max rows when present.
  3. **Alignment and spacing block:** the alignment matrix (§5.27, 70 × 70) on the left. On the right, two stacked rows: the gap field (`al/gap-h` or `-v` prefix, with "Auto" support), and the counter-axis gap field (wrap only).
  4. **Padding row:** horizontal | vertical fields with the individual-padding toggle → T/R/B/L (§5.13).
  5. **Clip content** checkbox [OBS], then the `act/settings` button opening the **layout settings popover**: Inside stroke (Included / Excluded), Canvas stacking (First on top / Last on top), Layout (Updated / Legacy), Text baseline alignment, Auto spacing type (Between / Around / Evenly) [OBS]. Each is a segmented control or Select per Figma; disabled options stay visible and disabled [OBS].
  6. **Grid flow:** a rows × columns 2-up field (arithmetic allowed [DOC:31289469907863 excerpt]) plus a grid-picker button that opens a cell selector popover (an 8 × 8 hover grid of 16 px cells, accent-dim fill on hover, showing "3 × 4" live); row gap and column gap; auto rows and automatic placement controls (UI form unknown → AL V-33). A **selected track** shows a track-size row: type segmented (Fixed / Hug / Flex) and a value.
  - **Legacy layout:** a warning badge with an "Update" button (`status/legacy-layout`) when `layoutVersion = LEGACY` [AL §3.14].
- **Child of an auto layout frame:** the Position section shows X/Y as read-only [OBS] and the Ignore auto layout toggle (`xform/ignore-auto-layout`). The Layout section shows W/H with Fill available. Constraints show only for absolute children [AL §4.2].
- **Hover links:** hovering the gap or padding fields highlights the matching on-canvas overlay (§5.49) [AL §4.3, KNOW].

### 5.27 AlignmentMatrix (9-position)

- **Function:** sets `primaryAxisAlignItems` × `counterAxisAlignItems` [API][OBS]. With gap Auto only the counter-axis options apply [AL §4.1]. Baseline alignment is offered for horizontal flows with text.
- **Anatomy:** a 70 × 70 `--ill-control` square, radius 8 (P; the user had 84 × 84, [USER-TOKENS] `.al-matrix`), holding a 3 × 3 grid of 20 px cells.
  - Idle cell: a 3 px `--ill-text-3` dot.
  - Hover cell: a preview of three short bars in `--ill-text-2` showing the resulting alignment for the current flow direction [KNOW → V-UI-12].
  - Active cell: the same bars in `--ill-accent`.
  - **Space-between (Auto gap):** the three cells of the active counter-axis line show spread bars; the other cells are disabled dots.
  - **Baseline:** bars aligned to a baseline tick.
  - **Mixed:** no active cell.
  - The user's glow on the active dot is dropped (no glows, P-6).
- **Keyboard:** one tab stop. Arrows move the active alignment and commit (one undo step each). **X** toggles Auto gap and **B** toggles text baseline while the box has focus [DOC excerpt via AL §5]. Enter does nothing.
- **A11y:** `role="radiogroup"` with 9 radios named "Top left" … "Bottom right", followed by the flow-relative name ("Align top left").

### 5.28 ConstraintsWidget

- **Function:** `constraints.horizontal` and `constraints.vertical` = MIN, MAX, STRETCH, CENTER, SCALE [API]. Owner: `02-frames-groups-sections-constraints.md`. A group sets constraints on its children and shows Mixed when they differ [FR, KNOW].
- **Anatomy:**
  - A 64 × 64 `--ill-control` square, radius 8 (P; the user had 76 px). It holds an inner 24 px square (1 px `--ill-text-3` stroke, radius 2), four edge ticks (left, right, top, bottom; 2 × 10 px, radius 1) and a centre crosshair with two ticks (horizontal and vertical centre).
  - Beside it, two Selects ("Horizontal", "Vertical") with Figma's full labels: Left, Right, Left & right, Center, Scale; Top, Bottom, Top & bottom, Center, Scale.
- **States:**
  - Tick idle `--ill-text-3`; hover `--ill-text-2` with a `--ill-surface-2` hit fill; active `--ill-accent`.
  - STRETCH lights both edge ticks of that axis. SCALE lights no tick; the Select shows "Scale".
  - Mixed: no ticks lit and both Selects show "Mixed".
- **Interaction:** clicking an edge tick sets that axis to MIN or MAX. ⇧-click on the opposite edge makes STRETCH. Clicking the centre tick sets CENTER [KNOW → V-UI-13]. Each click is one undo step.
- **Keyboard:** the ticks form a roving group (arrows move between ticks, Space toggles); the Selects follow the widget in tab order.
- **A11y:** each tick is a toggle button labelled "Pin left" and so on. The Selects carry the authoritative value.

### 5.29 LayoutGuideRow and popover

- **Function:** `layoutGrids`: COLUMNS, ROWS and GRID patterns with count, gutter, offset, alignment (MIN, MAX, STRETCH, CENTER), section size, colour and visibility [API `LayoutGrid`]. Layout-guide styles. Owner: FR / DS.
- **Row:** a §5.19 row. The control is `[settings IconButton with the guide/* glyph] [summary text "Columns (12)" / "Grid (8px)"]`, then the eye and "−".
- **Popover:** type Select; for Grid: size NumberField and ColorSwatchInput; for Columns and Rows: count, ColorSwatchInput, type Select (Stretch / Left / Center / Right, or Top / Center / Bottom), width or height (when not Stretch), margin or offset, gutter. Every numeric field supports Apply variable [DS §4].
- **Rendering:** the guide's own colour from data (§2.2.7 note); the chrome adds nothing.

### 5.30 Alignment bar (Position section)

- **Function:** align left / horizontal centre / right / top / vertical centre / bottom, distribute horizontal and vertical spacing, tidy up. Owner: CV.
- **Anatomy:** a full-width row of six 24 × 30 IconButtons (`align/*`), then a "more" Select-style button for distribute and tidy up. Equal spacing, no group borders ([USER-TOKENS] `.align-row` used 30 × 28 buttons with 1 px dividers; the dividers are dropped, P).
- **States:** buttons are disabled when the selection cannot be aligned, per CV.
- **Keyboard:** roving tabindex; Enter applies. The Figma shortcuts are shown in the tooltips.

### 5.31 Typography controls

- **Function:** TX §4. Text style picker, font family, style/weight (including the variable-axes entry), size, line height (Auto / px / %), letter spacing (% / px), horizontal and vertical alignment, resizing, and the type-settings panel (Basics, Details with OpenType features, Variable axes).
- **Anatomy:**
  - Section header with `act/styles`.
  - Font family Combobox, full width.
  - 2-up row: style Select | size Combobox.
  - 2-up row: line-height field | letter-spacing field.
  - 2-up row: paragraph spacing | (paragraph indent where Figma shows it).
  - Alignment segmented controls (4 horizontal glyphs, 3 vertical glyphs).
  - `type/settings` button → popover with tabs.
  - The Details tab lists OpenType features as 30 px rows with a hover preview on the canvas text [DOC:4913951097367 excerpt via TX §4].
- **Missing font:** the family field shows the name in `--ill-warning-text` with a `status/warning` glyph. Clicking it opens the missing-fonts dialog [TX §4].
- **Mixed ranges:** each field shows Mixed independently (TX).

### 5.32 LayerRow and LayerTree

- **Function:** the Layers panel: visible-row derivation, selection gestures, expand and collapse, reveal, rename, drag to reorder and reparent, lock and visibility. Owner: `10-panels…` §3.1–3.6.
- **Row anatomy** (30 px, `--ill-size-row`):

  `[indent 16 px × depth] [chevron 12 (containers with children)] [type icon 16] [6 px] [name 12/500, ellipsis] [spacer] [lock 24] [eye 24]`

  The highlight is inset 4 px from the panel edges with radius 6, so it floats inside the panel. The user's rows were inset 4 px with radius 4 ([USER-TOKENS]; P).
- **States:**

  | State | Treatment |
  | --- | --- |
  | Hover | `--ill-surface-2`. The node's hover outline appears on the canvas [DOC:360040449873 excerpt]. Lock and eye fade in (100 ms). |
  | Selected | `--ill-accent-dim` fill; chevron and icon in `--ill-accent`; name in `--ill-text`. **D-2:** the user's prototype used a solid `#0D99FF` fill with white text and icons ([USER-TOKENS] `.layer-row.selected`). That option would use `--ill-accent-fill` for AA. |
  | Selected + hover | Selected fill plus `--ill-overlay-hover` |
  | Descendant of a selected container | `--ill-accent-dim-2` band [KNOW] |
  | Component family (COMPONENT, COMPONENT_SET, INSTANCE, SLOT) | Icon `--ill-component`, name `--ill-component-text`. Selected fill `--ill-component-dim`. |
  | Hidden (own) | Name and icon at 50 % opacity; eye-off stays visible [USER-TOKENS] |
  | Hidden or locked via an ancestor | `row/eye-inherited` or `row/lock-inherited` as a subdued 12 px glyph in `--ill-text-3`, not a toggle (`10-panels…` §3.1) |
  | Locked (own) | The lock glyph stays visible |
  | Inside an instance (not in a slot) | Normal look, but drops are refused (no indicator, not-allowed cursor) (`10-panels…` §3.1) |
  | Renaming | The name becomes a 24 px TextField (`--ill-control`, inset focus ring) with all text selected |
  | Drag source | 50 % opacity |

- **Drop indicators:**
  - Insert between rows: a 2 px `--ill-drop-indicator` line starting at the target depth's indent, with a 6 px ring at its left end (FVR §8.2).
  - Drop into: a 1 px inset accent ring on the target row.
  - Hovering a collapsed container for 500 ms expands it [KNOW → V-UI-14].
  - The list auto-scrolls within 30 px of its top or bottom edge.
- **"Fixed" / "Scrolls" headers:** 24 px rows, 11/600 `--ill-text-2`, not selectable [API `numberOfFixedChildren`; `10-panels…` §3.1].
- **Keyboard:**
  - The tree is one region (F6).
  - Tab / ⇧Tab move through rows as Figma's documented model describes [DOC:35063862380311 excerpt]. Moving to a row selects its layer → V-UI-02.
  - ↑/↓ nudge the selection on the canvas (Figma); they do not move row focus.
  - ⌘R / Ctrl+R renames the selected layer (whether Enter also renames → V-UI-02); Esc cancels a rename.
  - ⌥L collapses layers.
  - The context-menu key or ⇧F10 opens the row's context menu.
- **A11y:** `role="tree"` with `treeitem`s carrying `aria-level`, `aria-expanded`, `aria-selected`, `aria-setsize` and `aria-posinset` (required because the list is virtualized).
- **Performance:** virtualized. 10,000 visible rows must scroll at display refresh rate (`10-panels…` §3.1, M8).

### 5.33 PageRow and pages list

- **Function:** pages panel: select, add, rename, reorder, delete, divider pages. Owner: `10-panels…` §3.7.
- **Anatomy:** 30 px row, inset 4 px, radius 6, name 12/500 `--ill-text-2`. The **active page** is 600 `--ill-text` on `--ill-surface-2` ([USER-TOKENS] `.page-row.active`, **L**). Hover is `--ill-surface-2`. A divider page renders as a 1 px `--ill-divider` line across a 12 px tall row and is selectable only for rename or delete.
- **Interactions:** double-click renames inline; drag reorders with a 2 px insertion line; right-click opens the page context menu (`10-panels…` §4.6).
- **Keyboard:** the list is a `listbox`. ↑/↓ move and activate the page. Page-switch shortcuts are owned by UX.

### 5.34 AssetTile and asset list row

- **Function:** the Assets panel: local and library components, insertion by drag or click, swap by ⌥-drop, library updates. Owner: CP §4, DS §4.
- **Tile (grid):** square card, radius 8, `--ill-surface-2`. The thumbnail is fitted with a 6 px inset over a checkerboard for transparent content. The name is below in 11/500 `--ill-text`, ellipsized.
  - Hover: `--ill-control-hover`.
  - Focus or selection: 1 px inset `--ill-sel` ring.
  - A component-set badge `layer/component-set` sits at the top-left in `--ill-component`.
- **Row (list):** 30 px with a 16 px glyph or 20 px thumbnail and the name in `--ill-component-text`.
- **Library sections:** a 30 px header with the library name, an "Update" button using the component-fill Button style when updates exist [SRC:U10], and a collapse chevron.
- **Drag:** the ghost is the thumbnail at 70 % with `--ill-shadow-drag`. Canvas drop feedback is CV's.
- **Keyboard:** grid navigation with arrows; Enter inserts at the viewport centre [KNOW → CP]; the context menu offers Figma's asset actions.

### 5.35 VariableChip, StyleChip and PropertyChip

- **Function:** shows an applied variable (`boundVariables` [API]), an applied style (`fillStyleId` and so on), or a component-property reference (`componentPropertyReferences` [API]) in place of a raw value. Owner: DS §4, CP §4.
- **Anatomy:** 22 px tall inside the 30 px control, radius 6, padding 0 6 px. A 12 px leading glyph: the variable type, the style kind, or a colour dot (12 px round [SRC:G5]) for colour values. Then the name in 12/500 `--ill-text`, ellipsized, and on hover a trailing 12 px detach `act/detach`.

  | Chip | Fill | Text |
  | --- | --- | --- |
  | Variable and style chips (neutral) | `--ill-surface-2` (or `--ill-control-hover` when it sits on `--ill-control`) | `--ill-text` |
  | Property chips (purple) | `--ill-component-dim` | `--ill-component-text` |

- **States:**
  - Hover: fill one step up. Click: opens the picker focused on the current binding.
  - Mixed bindings: a "Mixed" chip.
  - **Missing** (deleted variable, unavailable library): `status/warning` glyph and the name in `--ill-warning-text`, with a tooltip.
  - **Alias inside the variables table:** the chip shows `var/alias` plus the target name.
  - Extended-collection overrides: a 4 px override dot (§5.0).
- **Keyboard:** the chip is a button; Delete or Backspace while it has focus detaches (P; verify with Figma's equivalent → V-UI-15).

### 5.36 VariablePicker popover

- **Function:** "Apply variable" for any bindable field. It filters by resolved type and by **scopes** [API `VariableScope`, 23 values], and lists local and library variables (DS §4).
- **Anatomy** (width 240): a search field (autofocus), a collection filter Select, then grouped 30 px rows: type glyph or swatch, name, resolved value preview right-aligned in `--ill-text-2` (tabular figures for numbers). Group headers are 11/600 `--ill-text-2`. At the bottom, "+ Create variable", which opens the create form inline.
- **Keyboard:** typing filters; ↑/↓ move the highlight; Enter binds; Esc closes and returns focus to the field.
- **Empty:** "No variables match this field" with a link-style button "Open variables".

### 5.37 Variables view (table)

- **Function:** create and manage collections, groups, variables, modes, aliases, scopes, code syntax, publishing visibility and extended collections [DS §3.10][DOC:15145852043927 excerpt][DOC:36346281624471 title]. Figma's variables view is **edge-to-edge in the window by default** and can be minimized to a modal. It has a toggleable sidebar, a "+ Create variable" button with a type menu, and new-mode columns added to the right of the headers [DOC:15145852043927 excerpt].
- **Anatomy:**
  - **Frame:** a dialog with a 16 px inset (`--ill-z-modal`, radius 16, `--ill-modal`) and a minimize toggle that switches to an `--ill-modal-w` lg modal.
  - **Header (48 px):** title, search, "+ Create variable" (primary Button with a type menu), JSON import / export IconButtons (`var/import`, `var/export`) [SRC: Figma release notes via search summary, unverified], sidebar toggle, close.
  - **Sidebar (240 px):** collections list (30 px rows; the extended-collection glyph for extensions), "+ Create collection", and the group tree for the selected collection (styled as layer rows, §5.32).
  - **Table:**
    - Sticky header row of 30 px, 12/600 `--ill-text-2`: "Name" | one column per mode (minimum 160 px, resizable, with inline rename) | "+" add mode.
    - Body rows of 36 px with a 1 px `--ill-divider` between rows.
    - Sticky first column: type glyph + name (inline rename).
    - Value cells by type: COLOR = swatch + hex (or an alias chip); FLOAT = NumberField; STRING = TextField; BOOLEAN = Toggle switch; alias = chip. Values inherited in an **extended collection** show in `--ill-text-2` with an "inherited" tooltip; overridden values show `--ill-text` and an override dot.
  - **Edit-variable panel:** a 280 px side panel with name, description, scopes (checkbox list), code syntax (Web, Android, iOS fields [API `CodeSyntaxPlatform`]) and "Hide from publishing".
- **Selection:** row selection uses `--ill-accent-dim`. ⇧-click selects a range [DOC:15145852043927 excerpt]; ⌘-click toggles [KNOW].
- **Keyboard:** grid navigation (arrows between cells, Tab / ⇧Tab), Enter edits a cell, Esc cancels, ⌫ deletes the selected variables, ⇧↵ duplicates (reported [DOC excerpt via DS §5]) → DS V-73.
- **Scale:** virtualized rows and columns. Collections can hold up to 5,000 variables [DOC:15145852043927 excerpt]; scrolling must stay at refresh rate.
- **A11y:** `role="grid"` with `aria-rowcount` and `aria-colcount`.

### 5.38 Component property controls

- **Function:** CP §4.2–4.5.
- **Instance header:** `layer/instance` glyph (purple) + main component name in `--ill-component-text` + caret. It opens the **swap menu**: a Combobox with search, preferred values first, and 40 px rows with thumbnails. Next to it: a Go to main IconButton and More (Reset ▸ per-property list / Reset all changes, Detach instance, Push changes to main, Restore component).
- **Instance properties** (one PropertyRow per property, in definition order):

  | Property type [API `ComponentPropertyType`] | Control |
  | --- | --- |
  | VARIANT | Select listing the values. Whether true/false-like values become a toggle is TBC in CP. |
  | BOOLEAN | Toggle switch |
  | TEXT | TextField (multi-line grows up to 4 lines) |
  | INSTANCE_SWAP | Combobox picker with thumbnails and preferred values first |
  | SLOT | Slot row: content summary, insert-preferred menu, Reset slot, limit warnings in `--ill-warning-text` |

  Exposed nested instances appear as collapsible sub-sections with their own controls, indented by 8 px. Overridden properties show the override dot.
- **Main component and component set:**
  - Header: name, rich-text description editor, documentation link.
  - **Properties** list: rows with a purple type glyph, the name and a default summary; clicking a row opens the edit popover (name, default with Apply variable, preferred values, slot settings: min/max, preferred instances, "only allow preferred", "display empty by default", "fill container by default" [CP §4.2]).
  - "+" opens a menu listing Variant, Boolean, Text, Instance swap and Slot.
  - Variant values are editable inline. A duplicate-combination warning shows in `--ill-warning-text` [CP §4.3].
- **Apply property:** a purple `cp/apply-property` IconButton next to visibility, text content and nested instance name. When bound, a purple PropertyChip replaces the value (§5.35).

### 5.39 Prototype controls and connection styling

- **Function:** PR §4: device and flows (nothing selected), flow starting points, interactions, scroll behavior, overlay settings, interaction details, canvas connections.
- **Interaction row:** a card on `--ill-surface-2`, radius 8, 30 px, with the trigger glyph and a summary such as "On click → Navigate to *Frame 2*" (destination in `--ill-text`, the rest in `--ill-text-2`), then "−". Clicking opens the editor popover.
- **Interaction editor popover** (width 240; scrolls when tall):
  1. **Trigger** Select, with sub-fields: Delay (ms) for mouse triggers; After delay (ms); a **key capture field** ("Press a key…" in `--ill-text-placeholder` with an accent inset ring while recording) plus a device Select for ON_KEY_DOWN; the video time for media triggers [API `Trigger`].
  2. **Actions** list (§5.19 rows with grips): action Select + destination Select (frame picker Combobox with thumbnails) + options (Open in new tab; preserve scroll; overlay position). **Conditional** blocks render as an indented card: an "If" expression field (§5.11 parser for numbers; tokens shown as neutral chips), nested actions, then "Else" [PR §4][DOC:15253220891799 excerpt].
  3. **Animation:** type Select; direction segmented (4 arrows) for directional types; "Smart animate matching layers" checkbox; curve Select with a 24 × 16 curve thumbnail per item; the **curve editor**; Duration NumberField (ms).
     - The curve editor is a 208 × 120 `--ill-control` canvas, radius 8. The curve is a 1.5 px `--ill-accent` line and the two control handles are 8 px rings. Four NumberFields (x1 y1 x2 y2) for a custom bezier, or three (stiffness, damping, mass) for a custom spring.
  4. **State** checkboxes: reset scroll position, reset component state, reset video position [API].
- **Scroll behavior:** Overflow Select (No scrolling / Horizontal / Vertical / Both) and Position Select (Scroll with parent / Fixed / Sticky) [PR §4].
- **Overlay settings:** an overlay-position picker styled like the alignment matrix (7 positions plus Manual), the "Close when clicking outside" checkbox, and the "Add background behind overlay" checkbox with a ColorSwatchInput [PR §4].
- **Flow starting point row:** `pt/flow-start` glyph (filled = on), inline-editable flow name, description field, a "Present flow" IconButton and "−".
- **Canvas connections (noodles):**
  - Visible on the Prototype tab, or when toggled with ⇧E or the view setting [DOC:4411431245335 excerpt][PR-001].
  - Drawn as 2 px `--ill-noodle` cubic curves with a 7 px filled start dot on the hotspot side and an 8 px arrowhead at the destination. The selected connection is 3 px, with 10 px ring handles at both ends for retargeting.
  - Hovering a noodle raises it to 100 % opacity; idle noodles draw at 80 % (P · V).
  - The **connection handle** is a 12 px `pt/connection-handle` ring with "+" at the right-middle of a hovered or selected layer.
  - Hotspot outline: 1 px `--ill-noodle`.
  - **Flow badge:** an `--ill-flow-badge` pill (radius 4, 11/600 white, play glyph plus flow name) above the starting frame's top-left.
  - Overlay frames carry a 12 px overlay glyph next to their title.
  - All are screen-space (P-7). Inherited connections from components appear only when the instance is selected [DOC:4411431245335 excerpt].

### 5.40 Menu and ContextMenu

- **Function:** Figma's canvas and layer context menus, page menus, dropdown menus, the main menu, flyouts. Owner of contents: `10-panels…` §4.6 and each area.
- **Surface:** `--ill-elevated` (`#1c1c1c`), 1 px `--ill-edge-strong` (`#363636`), radius 12, `--ill-shadow-menu`, padding 6 px, width 180–320 px ([USER-TOKENS] `#canvas-context-menu`, **L**).
- **Item:** 30 px (D-11; the user's was about 32), padding 0 9 px ([USER-TOKENS], **L**), radius 6 (P; the user's was 5), 12/500 `--ill-text`.
  - When any item is checkable, a 16 px leading column holds the check or the item's glyph.
  - Trailing shortcut in 11/500 `--ill-text-2` (P; the user's was 10 px at 65 % opacity), with a 24 px minimum gap.
  - A submenu shows a trailing 12 px chevron.
- **Highlight** (hover or keyboard): `--ill-accent-fill` with white text and shortcut. The user's prototype used `#0099ff` (the hue is **L**). D-7 darkens it for AA; D-10 asks whether to keep an accent highlight or use a neutral one.
  - Disabled: 35 % opacity ([USER-TOKENS], **L**).
  - Destructive: `--ill-danger-text`; when highlighted, `--ill-danger-fill`.
- **Separators:** a 1 px `--ill-edge-strong` line with margin 5 px 3 px ([USER-TOKENS], **L**). **Section labels:** 11/600 `--ill-text-2`, 24 px tall.
- **Behavior:**
  - Opens at the pointer (context menu) or the anchor, flipped and shifted to stay 8 px inside the viewport. Taller menus scroll internally.
  - A submenu opens after 150 ms of hover or on → [KNOW].
  - A selection blinks the highlight twice for 60 ms, then the menu closes and the command runs [SRC:U1].
  - Right-clicking an unselected layer selects it first (`10-panels…` §4.6).
- **Keyboard:** ↑/↓ move (wrapping); → and ← open and close submenus; Enter or Space activates; Esc closes one level; type-ahead jumps to the next label match; Home and End jump.
- **A11y:** `menu`, `menuitem`, `menuitemcheckbox`, `menuitemradio`, `separator`, with `aria-keyshortcuts` carrying the shortcut.

### 5.41 Main menu and native menubar

- **Function:** Figma's main menu tree (File, Edit, View, Object, Text, Arrange, Vector, Preferences, Help), with "Back to files" and "Actions…" at the top (`10-panels…` §4.6).
- **In-app:** opened from the rail's main-menu button as a §5.40 menu with submenus, 240 px wide. Every item shows its shortcut and is disabled when not applicable.
- **macOS:** the same tree, plus App and Window, is mirrored into the native menubar from one command registry (ADR-027). Labels and shortcuts are identical. On Windows and Linux the in-app menu is the primary one.
- **Rule:** no Illigma-only item may sit between Figma items without being labelled as an extension in the registry.

### 5.42 Command palette (Actions menu)

- **Function:** Figma's Actions menu (⌘K / Ctrl+K) [DOC:35063862380311 excerpt][`10-panels…` §3.10]: searches commands, assets and settings, with Figma's "simplify focus navigation" accessibility preference [DOC:35063862380311 excerpt].
- **Anatomy:**
  - A floating panel, 480 px wide, centred horizontally at 20 % of the window height. Surface `--ill-elevated`, radius 12, `--ill-shadow-popover`, no scrim.
  - A 40 px search field (16 px glyph, 13/500 text).
  - Optional tabs (Figma's category tabs → V-UI-16).
  - Result rows of 30 px: glyph, name with the matched characters in 600, path or category in `--ill-text-2`, and the shortcut right-aligned.
  - Section headers for Recent, Commands and Assets.
- **Keyboard:** typing filters; ↑/↓ move; Enter runs; Tab switches tabs; Esc closes and restores the previous focus.

### 5.43 Tooltip (with shortcut)

- **Function:** names every icon-only control and shows Figma's shortcut (FVR M-9).
- **Anatomy:** `--ill-tooltip` (`#222`), 1 px `#333` edge, radius 6 (P; the user's was 5), padding 8 × 10 px ([USER-TOKENS], **L**), `--ill-shadow-tooltip`. Label 12/500 `--ill-text` (dark-theme value even in light, since the surface stays dark). Shortcut right-aligned in `--ill-text-2` with a 10 px gap (P; the user's was 18 px and `#888`). Maximum width 280 px; wraps at most 3 lines.
- **Placement:** above toolbar tools with a 6 px offset ([USER-TOKENS] `bottom: 44px`); elsewhere on the side with room (top, then bottom, right, left). No arrow.
- **Timing:** 500 ms first delay, instant between adjacent triggers within 1 s, 100 ms fade. It hides on pointer-down, scroll, Esc or blur.
- **WCAG 1.4.13:** dismissible (Esc), hoverable (the pointer can move onto the tooltip without it closing) and persistent. It also shows on keyboard focus after the delay.

### 5.44 Toast

- **Function:** Figma-style notifications: undo hints, copy confirmations, saves, errors. Four variants: info, success, warning, error [SRC:D1]. Owner: `10-panels…` §3.16.
- **Anatomy:** `--ill-toast` (`#242424`), 1 px `#3b3b3b` edge, radius 10 (P; the user's was 9), padding 12 × 18 px ([USER-TOKENS], **L**), `--ill-shadow-float`, 12/500 `--ill-text`. An optional leading 16 px status glyph in its status colour, and an optional ghost action button (`--ill-accent-text`, 12/600) with a 16 px gap. Maximum width `--ill-toast-max-w`.
- **Placement and stacking:** bottom centre, 20 px above the toolbar. At most 3 visible; the newest is at the bottom and older ones shift up by `transform` only.
- **Timing:** 3,000 ms dwell. Toasts with an action or an error persist until dismissed. Hovering pauses the timer.
- **A11y:** `role="status"` (polite); errors use `role="alert"`. The action is reachable with F6 to the toast region (P).

### 5.45 Modal and Dialog

- **Function:** keyboard shortcuts sheet, missing fonts, libraries, export progress, confirmations, preferences, version history.
- **Surface:** `--ill-modal` (`#141414`), 1 px `#333` edge, radius 16, `--ill-shadow-modal`, padding 28 px, width 480 ([USER-TOKENS] `dialog`, **L**). Scrim `--ill-scrim` with `--ill-blur-scrim` (**L**).
- **Variants:**
  - **standard:** a 48 px header with a 13/600 title and a close "×" (16 px, `--ill-text-2`).
  - **sheet:** the user's style: an eyebrow label (12 px, 1.5 px tracking, `--ill-text-2`) above a 24/500 display title ([USER-TOKENS] `.eyebrow`, `dialog h2`).
  - **confirm:** a standard dialog whose footer holds secondary plus primary or destructive buttons.
- **Footer:** right-aligned 30 px buttons with 10 px gaps. A note row uses 12/1.6 `--ill-text-2` above a 1 px divider ([USER-TOKENS] `.dialog-note`).
- **Behavior:** focus is trapped; the first focusable element gets focus (or the primary button in confirms); Esc closes unless an operation is running; focus returns to the opener. Open 150 ms, close 100 ms.
- **A11y:** `role="dialog"` (`alertdialog` for confirms), `aria-modal`, labelled by the title.

### 5.46 Popover (generic)

- **Function:** the container for §5.21–5.29, §5.36 and §5.39 popovers.
- **Surface:** `--ill-elevated`, `--ill-edge`, radius 12, `--ill-shadow-popover`, width `--ill-popover-w`. Header 40 px (12/600 title, close "×"); body padding 10–15 px.
- **Placement:** inspector popovers open to the **left of the right sidebar**, top-aligned with their trigger row, clamped to the viewport. Others open at their anchor with flip and shift.
- **Dismissal:** Esc, the close button, or a click outside (except on the canvas while the eyedropper is active). Behavior on selection change → V-UI-05.
- **Focus:** keyboard-opened popovers move focus to their first field. On close, focus returns to the trigger.
- **A11y:** `role="dialog"` (non-modal) with a label.

### 5.47 ScrollArea and scrollbars

- **Function:** every scrolling panel, list, menu and table.
- **Anatomy:** overlay scrollbars. The thumb is 6 px wide, radius 3, `#353535` in dark ([USER-TOKENS] `scrollbar-color`, **L**), `#4a4a4a` on hover, and `rgba(0,0,0,.2)` in light. The track is transparent. The thumb appears on scroll or hover and fades after 800 ms (100 ms fade).
- **Rules:** never shift content (P-4). Wheel and trackpad scrolling are native. Keyboard scroll keys work when the area has focus. Under forced colours, fall back to native scrollbars.

### 5.48 Panel resizer and splitter

- **Function:** resize the left and right sidebars and the Pages/Layers split [DOC:23954856027159 excerpt; `10-panels…` §4.1].
- **Anatomy:** a 6 px hit zone centred on the edge ([USER-TOKENS] `.inspector-resizer`), `col-resize` (or `row-resize`) cursor. On hover or drag it shows a 2 px `--ill-accent` line (P; the user filled the full 6 px with accent).
- **Behavior:** live resize at 0 ms. Double-click resets to the default. Widths clamp to min and max.
- **Keyboard:** `role="separator"`, focusable, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`. ←/→ change 10 px (⇧ 50 px); Home and End go to min and max; Enter resets.

### 5.49 Canvas chrome

All canvas chrome is drawn by the render core's overlay pass from `CanvasChromeTheme` (§6.3). It uses screen-space sizes (P-7) and is never animated. **When** each element appears, and what it means, is owned by CV and the area specs. This table defines only the look.

| Element | Figma function (owner) | Geometry (screen px) | Colour tokens | States and notes |
| --- | --- | --- | --- | --- |
| Selection bounds | Selection (CV) | 1 px rectangle following the node's transform | `--ill-sel`; component family `--ill-component` | Multi-selection: each item gets a 1 px outline plus the group bounds. The user's 1 px glow is dropped. |
| Resize handles | Resize (CV) | 8 × 8 squares, radius 1, at the corners. Edges are invisible hit zones [KNOW → V-UI-26]. | `--ill-sel-handle-fill`, `--ill-sel-handle-stroke` | Hidden when the selection is too small on screen (CV rule). Purple for the component family. |
| Rotation zones | Rotate (CV) | Invisible, just outside the corners | — | Rotate cursor (§3.4 T) |
| W × H badge | Size readout (CV) | Pill, radius 4, padding 2 × 4, 4 px below the bounds, 11/600, tabular figures | `--ill-wh-badge-bg`, `--ill-wh-badge-text` | Content (numbers, or Hug and Fill words) per CV → V-UI-27 |
| Hover outline | Hover (CV) | 1 px | `--ill-sel` / `--ill-component` | Also driven by layer-row hover [DOC:360040449873 excerpt] |
| Frame and section titles | Top-level frame and section names (FR) | 11/500, 4 px above the top-left, ellipsized at the frame width | `--ill-frame-label`, `--ill-frame-label-active` (purple for components) | Section titles may sit on a pill in the section's own colour (data) → V-UI-28 |
| Smart guides | Snapping (CV) | 1 px lines across the aligned edges or centres, with 4 px "×" marks at snapped points [KNOW] | `--ill-guide` | Figma's guides are red [SRC forum 28706 excerpt] |
| Distance measurement | ⌥-hover measurement [DOC:360039956974 title] | 1 px lines with 4 px end ticks; value pill radius 4, 11/600 | `--ill-measure`, `--ill-measure-fill`, white text | Red in Figma [SRC forum 28706 excerpt] |
| Equal-spacing indicators | Smart selection and spacing (CV) [DOC:360040450233 title] | Hatched blocks and pills | `--ill-layout-overlay`, `--ill-layout-overlay-fill` | Pink in Figma [KNOW] |
| Auto layout gap and padding overlays and handles | AL §3.17 | Hatch at 45°, 1 px lines every 4 px at 40 %, plus a 15 % fill. Gap handles are 1 × 8 px bars (16 px hit area). Value pills on hover. | `--ill-layout-overlay`, `--ill-layout-overlay-fill` | Pink in Figma [DOC:360040451373 excerpt via AL]. Suppressed when too small (AL) |
| Grid track pills | Grid flow (AL §4.3) | 16 px pills on the top and left edges, 11/500 | `--ill-panel` + `--ill-text-2`; selected `--ill-accent-fill` + white | Reorder preview: 2 px `--ill-sel` line |
| Auto layout insertion indicator | Drag into auto layout (AL §4.3) | 2 px line, 6 px end ring | `--ill-drop-indicator` | — |
| Reparent target | Drag into a frame (CV) | 1 px outline on the target frame | `--ill-sel` | [KNOW] |
| Marquee | Marquee select (CV) | 1 px stroke | `--ill-sel` + `--ill-marquee-fill` | [USER-TOKENS] |
| Rulers | ⇧R (CV) | 20 px strips; ticks at adaptive steps (1, 2, 5 × 10ⁿ); numbers 10/500 tabular | `--ill-ruler-*` | The selection-extent band and its edge numbers use `--ill-accent-text` |
| Ruler guides | Guides [DOC:360040449713 title] | 1 px across the canvas or frame; a position pill while dragging | `--ill-guide`; selected `--ill-guide-selected` | Guide positions are data |
| Vector edit | VC | Anchors: 7 px circles, 1 px stroke. Selected anchors: filled. Bézier handles: 1 px lines with 5 px dots. Hovered segment: 2 px. | `--ill-anchor-*`, `--ill-bezier` | [USER-TOKENS] |
| Text editing | TX §4 | 1 px caret; selection fill; IME composition underline 1 px | `--ill-caret`, `--ill-accent-dim` | Caret blink 500 ms on / 500 ms off, the only "animation" (reduced motion: steady) |
| Component set outline | CP | 1 px dashed (4 / 4) around the set | `--ill-component` | [KNOW] Figma shows a purple dashed set border → V-UI-28 |
| Slot highlight | CP §4.6 | 1 px dashed, plus an empty-state label 11/500 | `--ill-slot-outline` | Always shown on empty instances when `displayEmptyByDefault` (CP) |
| Prototype connections | PR | §5.39 | `--ill-noodle`, `--ill-flow-badge` | Prototype tab or ⇧E |
| Gradient, crop and progressive-blur handles | PE | 8 px white circles with a 1 px accent stroke; connecting line 1 px | `--ill-sel` | — |
| Pixel grid | View → Pixel grid (CV) | 1 device-px lines at every pixel, from the zoom threshold [DOC:360041065034 via old feature guide: ≥ 400 %] | `--ill-pixel-grid` | — |
| Canvas keyboard focus | Tab through layers [DOC:35063862380311 excerpt] | 1 px dashed (3 / 3), 2 px outside the bounds | `--ill-canvas-focus` | Shown only for keyboard navigation |
| Eyedropper loupe | PE | §5.21 | — | `--ill-z-capture` |
| Hide canvas UI during changes | UX-209 preference | — | — | Handles and badges hidden while scrubbing or editing values |

### 5.50 Save-status indicator

- **Function:** P-9; ADR-017 (atomic save) and ADR-018 (autosave, recovery).
- **Anatomy:** in the left-sidebar header, a 6 px status dot plus a 10/500 label in `--ill-text-2`.

  | State | Dot | Label |
  | --- | --- | --- |
  | Saved | `--ill-success` | "Saved" |
  | Saving… | 12 px spinner | "Saving…" |
  | Unsaved changes | Hollow ring in `--ill-text-2` | "Unsaved changes" |
  | Recovered | `--ill-info` | "Recovered" |
  | Save failed | `--ill-danger` | "Save failed" (`--ill-danger-text`), plus a persistent error toast with Retry and Save as… |

  The user's prototype had a save-status line in this position ([USER-TOKENS] `.save-status`, `.status-dot`).
- **A11y:** `role="status"`. Transitions between Saving and Saved are announced politely, at most once every 10 s.

---

## 6. Implementation architecture for the kit

This section refines ADR-021 (SolidJS 1.9, Zag.js / Ark UI, virtualization), ADR-022 (tokens → primitives → composites → panels; CSS Modules; workbench) and ADR-024 (tests).

### 6.1 Packages and build pipeline

```
packages/ui-tokens    tokens.json ─┬─► dist/tokens.css          (:root dark, light, system, reduced-motion, forced-colors blocks)
                                   ├─► dist/tokens.ts           (typed constants implementing IlligmaTokens, §2.13)
                                   ├─► dist/canvas-chrome.ts    (CanvasChromeTheme for dark and light, RGBA floats)
                                   ├─► dist/allowed-vars.json   (allowlist for the style lint)
                                   └─► docs/tables.md           (checked against §2 of this document in CI)
packages/ui-icons     src/{12,16,20}/<category>/*.svg ─► SVGO ─► sprites + <Icon name size> (typed union) + LICENSES.md
packages/ui-kit       primitives/   Icon Text Kbd Badge Button IconButton ToolButton Tabs Segmented Switch Checkbox Radio
                                    TextField NumberField Select Combobox Slider Menu ContextMenu Popover Dialog Tooltip
                                    Toast ScrollArea Splitter
                      composites/   SectionHeader PropertyRow ListRow LinkedFields SizingField ColorSwatchInput ColorPicker
                                    GradientEditor ImageFillEditor EffectRow EffectPopover StrokeSettings AutoLayoutPanel
                                    AlignmentMatrix ConstraintsWidget LayoutGuideRow AlignmentBar TypographyControls
                                    LayerTree PageList AssetGrid Chips VariablePicker VariablesTable ComponentPropertyControls
                                    InteractionEditor CurveEditor CommandPalette SaveStatus
packages/ui-panels    Rail, LeftSidebar (File, Assets, Find), RightSidebar (Design, Prototype, ExportFooter), Toolbar,
                      ZoomPill, MainMenu, VariablesView, Dialogs. Composed from ui-kit only.
apps/workbench        The component workbench (§6.7)
```

- **Layering** (enforced by dependency-cruiser, ADR-023): `ui-panels → ui-kit → ui-icons, ui-tokens`.
  - `ui-kit` never imports the engine, model or render packages.
  - `ui-panels` reaches the engine only through the `editor-core` adapter (`useProps`, `useSelection`, `useCommand`, ADR-021).
  - The render core imports only `ui-tokens/canvas-chrome`.
- **Headless machines:** Zag.js (via Ark UI Solid) for Menu, ContextMenu, Select, Combobox, Popover, Dialog, Tooltip, Tabs, RadioGroup (segmented), Checkbox, Switch, Slider, Splitter and Toast.
  - **NumberField is Illigma's own machine:** scrub with pointer lock, the arithmetic parser, Mixed, and the preview/commit/cancel contract. It follows Zag's state-machine conventions, so it is testable in isolation.
  - **LayerTree is custom**, because of virtualization plus Figma's selection model.
- **Styling:** CSS Modules per component. Styles reference only `var(--ill-*)`. States are exposed as data attributes (`data-state`, `data-hover`, `data-focus-visible`, `data-mixed`, `data-invalid`, `data-bound`, `data-readonly`, `data-overridden`). Styling is therefore declarative, and the workbench can force any state without a pointer.
- **Lint:** Biome plus a style lint forbid raw colours and lengths outside `tokens.css`. The allowlist is `0`, `1px` hairlines, `50%` and `100%`. They also forbid `transition` on properties that cause layout, except the single-section height collapse.

### 6.2 Primitive contracts (shared props)

| Contract | Applies to | Shape |
| --- | --- | --- |
| Value editing | Every value control | `value: T \| MIXED`, `onPreview(v)` (gesture in progress → gesture transaction), `onCommit(v)` (one undo step), `onCancel()` (roll back the gesture). This maps one-to-one onto ADR-011 transactions. |
| Binding | Bindable fields | `binding?: { kind: "variable" \| "style" \| "property"; id; name; missing?: boolean }`, `onBind()`, `onDetach()`, `scopes?: VariableScope[]` |
| State | All | `disabled`, `readOnly`, `invalid`, `overridden`, `loading` |
| Command | Buttons, menu items, tools | `commandId`. The label, shortcut, enabled state and checked state come from the command registry (ADR-027), so tooltips, menus, the palette and the native menubar stay identical (FVR M-9). |
| Labels | Fields | `label` (the Figma field name, always present for accessibility) and `labelMode: "prefix" \| "left" \| "below" \| "hidden"`, driven by Additional labels |

### 6.3 Theming

- `<html data-theme="dark|light|system">`. CSS resolves `system` through `prefers-color-scheme`. Electron's `nativeTheme.themeSource` is set to the same value, so native menus, scrollbars and the window-controls overlay match.
- The theme is applied **before first paint**: the main process reads the preference and passes it on the renderer URL.
- On theme change, the editor core sends one message with the new `CanvasChromeTheme` to the render core. The render core re-runs **only the overlay pass**; document tiles are untouched (KIT-108).
- Forced colours: `@media (forced-colors: active)` maps roles to system colours. The render core receives a forced-colours chrome theme built from the system `Highlight` and `CanvasText` colours, read via `getComputedStyle` on probe elements.

### 6.4 Density and interface scale

- **Interface scale** (Figma's "Make larger" / "Reset" [DOC:35063862380311 excerpt]) is implemented with Electron `webContents.setZoomFactor`. Chromium then scales every CSS length and raises `devicePixelRatio`.
  - The render core already multiplies its backing store by `devicePixelRatio`, so the canvas stays sharp.
  - Document zoom is independent of interface scale.
  - Canvas-chrome sizes follow interface scale unless V-UI-17 shows that Figma keeps them constant.
  - The scale steps are TBD (V-UI-17).
- **Density** is a token subset swapped with `data-density`: `default` ships, `compact` is P2 (P-2). Only these tokens change: `--ill-size-control`, `--ill-size-prop-row`, `--ill-size-row`, `--ill-size-panel-header`, `--ill-space-5`, `--ill-space-10`.

### 6.5 How panels consume the kit

1. **Schema-driven sections.** The right sidebar builds its section list from a declarative table: selection type → ordered sections, transcribed from `10-panels…` §4.2 (each row cites its evidence).
   - A change to Figma's order is then a one-line diff that can be reviewed against Figma.
   - Each section is a composition of kit composites. No panel defines a colour, size or animation.
2. **Field descriptors.** Each field is declared as data, for example:

   ```ts
   { prop: "paddingLeft", control: "number", unit: "px", scrub: true, label: "Left", prefix: "al/pad-left",
     variableScopes: ["GAP"], group: "padding" }
   ```

   A generic `Field` renders the right kit control. It wires Mixed (the adapter returns a `MIXED` sentinel when nodes disagree), bindings (`boundVariables`) and read-only rules (for example flow children's X/Y).
3. **Reactivity.** The adapter exposes fine-grained signals per (node, property) (ADR-013). During a canvas drag, only the X/Y fields re-render (KIT-123).
4. **Gestures.** Scrubs, slider drags, colour-area drags, list reorders and canvas-handle drags all call `onPreview` repeatedly and `onCommit` once. Typing commits once on Enter, Tab or blur. Esc calls `onCancel`.
5. **Commands.** Buttons and menu items name a `commandId`. They never call engine functions directly.
6. **Popovers** are owned by the panel that opened them, and are keyed by (target node ids, property path). An undo or a selection change that invalidates the key closes or rebinds them per V-UI-05.

### 6.6 Visual regression and quality gates

| Gate | Tool | What it checks |
| --- | --- | --- |
| Component snapshots | Playwright 1.64 against the workbench, in Chromium and Electron | Every component × every §5.0 state × both themes × DPR 1 and 2. Animations are off (reduced motion plus `--ill-dur-*: 0ms`) and fonts are bundled. Baselines live in the repo (Git LFS). Threshold: `maxDiffPixelRatio` 0.001. |
| Canvas-chrome goldens | CanvasKit CPU backend in Node (ADR-024) | Each §5.49 element at zoom 10 %, 100 % and 800 % and DPR 1 and 2: stroke widths and sizes are constant. |
| Framer reference sign-off | Workbench reference overlay (§6.7) | Items marked **V** are compared against the user-supplied Framer crops (FVR "Verification needed"). On sign-off, `tokens.json` status flips from verify to locked or proposed. |
| Contrast | Custom test over `tokens.json` (each text token declares `allowedOn` surfaces) | ≥ 4.5:1 text and ≥ 3:1 non-text, in both themes (KIT-008) |
| Accessibility | axe-core on every workbench page, both themes; scripted keyboard tests per component | Zero serious or critical violations; the keyboard maps of §5 |
| Layout shift | Playwright bounding-box diffs | Hover, value changes (`1` → `88888`), Mixed and binding cause zero movement of siblings (KIT-033) |
| Reduced motion and forced colours | Playwright media emulation | No transform transitions; state stays distinguishable |
| Icon lint | Custom SVG lint | On-screen stroke 1.5 ± 0.1, round caps and joins, `currentColor`, viewBox, centrelines on the 0.25 grid, licence manifest entry |
| Locked tokens | CI script | A locked value changes only with a decision-log entry recording the user's approval (KIT-006) |
| Performance | Workbench perf scenes plus the bench package | Inspector update ≤ 1 ms of main-thread work per frame during a drag; the layer tree scrolls 10,000 rows and the variables table 5,000 rows at refresh rate |

### 6.7 Component workbench (`apps/workbench`)

- **Pages:**
  - One route per component, with a **state matrix** that forces every state through data attributes, dark and light side by side.
  - A props panel; theme, density, interface-scale, DPR, reduced-motion and forced-colours toggles.
- **Token page:** generated from `tokens.json`. Swatches, values, **L / P / V badges**, decision ids, evidence, and the live contrast matrix.
- **Icon sheet:** every icon id × size × state, with the lint results and the licence source.
- **Inspector fixtures:** the full Design and Prototype panels for each of the 20 selection types in `10-panels…` §4.2 (plus the AL, CP and PR variants), driven by a mock adapter. Reviewers compare section order and control inventory against Figma screenshots. Only structure is compared, never looks.
- **Canvas-chrome page:** the real overlay pass, rendered with CanvasKit, with zoom and DPR sliders, showing selection, handles, guides, measurements, auto layout overlays and noodles.
- **Reference overlay:** loads a Framer crop (or a Figma screenshot for structure) and shows it as an onion skin or difference blend over the live component at the same DPR.
- **Runtime:** a Vite app that runs in the browser and in an Electron shell, and is also the Playwright target. Storybook 10 (`storybook-solidjs-vite`) remains the named fallback (ADR-022).

### 6.8 Governance

- Every change to `tokens.json` records its status, evidence and decision id.
- **Proposed** values ship only behind the decision's interim choice (§8).
- **Locked** values change only with the user's approval (KIT-006).
- **Verify** values are re-evaluated whenever new Framer captures arrive.
- The tables in §2 are generated. Hand edits to §2 are rejected by CI after M0, and this document then links to the generated tables.

---

## 7. Checklist

Format: `- [ ] **KIT-NNN** Name — expected behavior. _Data:_ … _Test:_ … _M#·P#·evidence_`. Every item is **Not started**.

- Items that reference a Figma behavior ("owner: UX-120" and so on) test the **kit's implementation** of the contract. The behavior itself is signed off in the owning parity spec.
- Items that cite `V-UI-nn` cannot be signed off until that experiment (§9) has been recorded.
- Visual look items are in FVR §13 (FVR-001…036) and are not repeated here.

### 7.1 Tokens and theming

- [ ] **KIT-001** Token generation — `tokens.json` generates `tokens.css`, `tokens.ts`, `canvas-chrome.ts`, `allowed-vars.json` and the §2 tables. The build fails if any colour or shadow token lacks a dark or light value. _Data:_ `tokens.json` _Test:_ run the generator; diff the generated tables against §2; delete one light value → build error. _M0·P0·[DECISION]_
- [ ] **KIT-002** No raw values outside tokens — the style lint rejects hex, rgb(), hsl() and px literals in kit and panel CSS, except the allowlist (`0`, `1px` hairline, `50%`, `100%`). _Data:_ `allowed-vars.json` _Test:_ add `color: #fff` to a module → lint fails; replace it with `var(--ill-text)` → passes. _M0·P0·[DECISION]_
- [ ] **KIT-003** Atomic theme switch — switching dark ↔ light ↔ system restyles all chrome and canvas chrome in one frame; the document and undo stack are unchanged. _Data:_ theme preference _Test:_ toggle the theme on the full-editor fixture with a 60 fps capture; no frame mixes themes; document hash and undo depth unchanged. _M0·P0·[DOC:5576781786647 excerpt][DECISION]_
- [ ] **KIT-004** System theme follows the OS live — with "Use system theme", an OS appearance change switches the theme without reload. _Data:_ `prefers-color-scheme` _Test:_ Playwright `emulateMedia({colorScheme})` flip → tokens swap within one frame. _M0·P1·[DOC:5576781786647 excerpt]_
- [ ] **KIT-005** Theme is a per-device preference — it is never written to `.illigma` files. _Data:_ app preferences _Test:_ save a file in dark; open it on a profile set to light → light chrome; file bytes identical. _M0·P1·[DOC:5576781786647 excerpt]_
- [ ] **KIT-006** Locked-token guard — CI fails when a `locked` token value changes without a decision-log entry recording the user's approval. _Data:_ `tokens.json` status _Test:_ change `--ill-panel` to `#111111` → CI fails; add a D-6 approval entry → passes. _M0·P0·[DECISION]_
- [ ] **KIT-007** Token status metadata — every token has a status (locked / proposed / verify / combinations), evidence tags and an optional decision id; the workbench shows L/P/V badges. _Data:_ `TokenMeta` _Test:_ schema validation; zero tokens without status. _M0·P1·[DECISION]_
- [ ] **KIT-008** Contrast gate — every text token reaches ≥ 4.5:1 on each surface it is allowed on, and every non-text indicator ≥ 3:1, in both themes; the §2.2.8 ratios are reproduced. _Data:_ `allowedOn` metadata _Test:_ the automated computation matches §2.2.8 within ±0.01; a seeded failure (`#777` text on `#2b2b2b`) is caught. _M0·P0·[COMPUTED]_
- [ ] **KIT-009** Reduced motion — with OS reduced motion or the in-app preference, no `transform` transitions run and fades last ≤ 100 ms; the menu blink is skipped. _Data:_ `prefers-reduced-motion` _Test:_ emulate it; audit the computed `transition-duration` of all workbench components. _M0·P0·[DECISION]_
- [ ] **KIT-010** Forced colours — under `forced-colors: active`, every control and state stays distinguishable using system colours, and canvas chrome draws in `Highlight`. _Data:_ — _Test:_ Chromium forced-colours emulation; checkbox on/off, selected row and focus are visible in snapshots. _M8·P1·[DECISION]_

### 7.2 Typography and icons

- [ ] **KIT-011** Bundled Inter 4 with alternates — Inter 4.x loads offline before first paint, and `cv01 cv05 cv09 cv11` render a single-storey "a", a tailed "l" and a flat-top "3". _Data:_ `--ill-font-features` _Test:_ launch offline; assert the GSUB features exist in the bundled file; render "a l 1 3" and compare against the font's own glyph outlines. _M0·P0·[SRC:F1, G2]_
- [ ] **KIT-012** Tabular figures — inputs, rulers, pills, the W × H badge and the zoom % keep constant digit widths. _Data:_ `font-variant-numeric` _Test:_ scrub X from 0 to 1111 and zoom from 9 % to 999 %; the value text width is constant. _M0·P1·[SRC:F1]_
- [ ] **KIT-013** Distinct layer-type icons — every node type and variant in §3.4 B has a unique glyph; auto layout vertical, horizontal, wrap and grid, and the four boolean operations, are pairwise distinguishable. _Data:_ `type`, `layoutMode`, `layoutWrap`, `booleanOperation` _Test:_ contact sheet; perceptual-hash distance above the threshold for every pair; design review sign-off. _M1·P0·[API]_
- [ ] **KIT-014** Icon stroke lint — on-screen stroke 1.5 ± 0.1 px (1.25 for flagged 12 px glyphs), round caps and joins, `currentColor`, viewBox equal to the master size, centrelines on the 0.25 px grid. _Data:_ SVG sources _Test:_ the lint passes on the package; a seeded 2 px stroke fails. _M0·P1·[SRC:F1]_
- [ ] **KIT-015** Icon provenance — every adapted Lucide glyph is listed with its licence (ISC; Feather subset MIT); the pinned version is ≥ 2 weeks old; every `Lucide:` name in §3.4 exists in it. _Data:_ `LICENSES.md` _Test:_ the CI script resolves the names against the pinned package; About → Licences shows the texts. _M0·P1·[SRC: lucide-static licence file]_
- [ ] **KIT-016** No proprietary icon artwork — every icon has a recorded source (custom drawing, Lucide, Phosphor or Tabler) and none is traced from Figma or Framer. _Data:_ icon manifest _Test:_ the review checklist is complete for all ids. _M0·P0·[DECISION]_
- [ ] **KIT-017** Optical masters — each glyph used at 12, 16 or 20 px has a master at that size; requesting a size without a master is a type error. _Data:_ `<Icon name size>` _Test:_ `tsc` fails on a missing master. _M0·P1·[DECISION]_

### 7.3 Layout and window chrome

- [ ] **KIT-018** Default layout — rail 48, left sidebar 240, right sidebar 268, toolbar centred in the canvas 20 px from the bottom, zoom pill at the bottom-right, Export footer docked, no top bar (C-1…C-6). _Data:_ preferences _Test:_ at a 1440 × 900 window, measure the regions. _M1·P0·[USER-TOKENS][OBS]_
- [ ] **KIT-019** Sidebar resizing — left 200–500, right 240–480; values clamp; double-click resets; the keyboard separator works; widths persist per device. _Data:_ preferences _Test:_ drag past the limits → clamps; ← / → change by 10 px; relaunch restores. _M1·P1·[DOC:23954856027159 excerpt][USER-TOKENS]_
- [ ] **KIT-020** Canvas minimum — the canvas keeps ≥ 360 px by temporarily shrinking the left sidebar, then the right; stored widths are unchanged. _Data:_ preferences _Test:_ stored widths 500 / 480 and a 960 px window → left shrinks first; preferences unchanged. _M1·P2·[DECISION]_
- [ ] **KIT-021** Toolbar centred on the canvas — the toolbar centre equals the canvas-area centre ± 0.5 px as the sidebars resize. _Data:_ — _Test:_ resize the left sidebar from 240 to 400 and measure. _M1·P1·[USER-TOKENS]_
- [ ] **KIT-022** Zoom pill avoids the toolbar — on a narrow canvas the pill moves above the toolbar's right end and never overlaps it. _Data:_ — _Test:_ at a 500 px canvas the bounding boxes do not intersect. _M1·P2·[USER-TOKENS]_
- [ ] **KIT-023** Window-chrome safe areas — macOS traffic lights and the Windows/Linux window-controls overlay never cover an interactive element; header drag regions move the window. _Data:_ — _Test:_ Electron Playwright on each OS: `elementFromPoint` at the controls' rectangles returns no kit element; dragging the header moves the window. _M0·P0·[DECISION]_
- [ ] **KIT-024** Minimize UI and Show/Hide UI — ⌘⇧\\ collapses the rail and both sidebars; ⌘\\ hides all chrome; neither animates nor moves the canvas content. _Data:_ view state _Test:_ press each shortcut; the canvas viewport transform is unchanged; screenshot. _M1·P1·[DOC:360039831974 excerpt]_
- [ ] **KIT-025** Region cycling — F6 / ⌃F6 cycles rail → left sidebar → canvas → toolbar → right sidebar; ⇧F6 reverses; each region restores its last focus. _Data:_ — _Test:_ a keyboard script asserts the active region after each press (V-UI-01). _M1·P0·[DOC:35063862380311 excerpt][KNOW]_
- [ ] **KIT-026** Export footer — Export docks at the bottom of the Design tab, grows to 50 % of the sidebar and then scrolls, shows page export settings when nothing is selected, and is absent on the Prototype tab. _Data:_ `exportSettings` [API] _Test:_ add 8 export settings → footer at 50 % with internal scroll; deselect → page settings; switch to Prototype → hidden (V-UI-04). _M2·P1·[USER-TOKENS][OBS]_
- [ ] **KIT-027** Interface scale — Make larger / Reset scale all chrome tokens while document zoom and canvas sharpness stay unchanged. _Data:_ preference _Test:_ at 125 % the toolbar is 60 px tall; a 1 px document line still renders 1 device px wide at 100 % zoom (V-UI-17). _M8·P2·[DOC:35063862380311 excerpt]_
- [ ] **KIT-028** Layout state is not document data — widths, the Pages split, the active rail and right-sidebar tabs and collapsed sections restore per device, never enter `.illigma` and never create undo entries. _Data:_ preferences (`10-panels…` §2.3) _Test:_ change them all; save; the file bytes are unchanged versus a control save; undo depth 0. _M1·P1·[DECISION]_
- [ ] **KIT-029** Additional labels — the View toggle shows rail tab labels and inspector field labels; it is the only user-triggered change to inspector layout. _Data:_ preference _Test:_ toggle → every unlabelled field gains a sub-label; nothing else moves (V-UI-20). _M1·P2·[DOC:23954856027159 excerpt]_

### 7.4 Primitives and shared states

- [ ] **KIT-030** State coverage — every interactive kit component renders each applicable §5.0 state, forced through data attributes in the workbench matrix, in both themes. _Data:_ — _Test:_ the workbench matrix exists for all §5 components; visual baselines are recorded. _M0·P0·[DECISION]_
- [ ] **KIT-031** Focus-visible versus pointer focus — keyboard focus shows the 2 px outline (or the inset ring on inputs); pointer focus on non-inputs shows none. _Data:_ — _Test:_ Tab versus click on a tool button and an input. _M0·P0·[USER-TOKENS][SRC:F1]_
- [ ] **KIT-032** Target size — every interactive hit area is ≥ 24 × 24 CSS px. _Data:_ — _Test:_ an automated DOM audit on the workbench and the full-editor fixture reports zero violations. _M0·P0·[DECISION]_
- [ ] **KIT-033** No layout shift — hover reveals, value changes, Mixed and chip binding move no sibling element. _Data:_ — _Test:_ bounding-box diff over 30 layer rows on hover; set W from `1` to `88888`; bind a variable → 0 px movement. _M0·P0·[DECISION]_
- [ ] **KIT-034** Disabled semantics — 50 % opacity, no hover change, `aria-disabled`, still discoverable by keyboard, with a tooltip giving the reason when known. _Data:_ — _Test:_ the disabled baseline-alignment control [OBS] renders and announces as disabled. _M0·P1·[SRC:F1][OBS]_
- [ ] **KIT-035** Read-only flow-child position — X/Y of an auto layout flow child show values, refuse edits and scrubbing, and explain why in a tooltip. _Data:_ `layoutPositioning = AUTO` [API] _Test:_ select a flow child; type in X → no change; set Ignore auto layout → editable. _M4·P0·[OBS]_
- [ ] **KIT-036** Button variants — primary, secondary, ghost, destructive and component use the §5.3 fills and labels in both themes, with AA labels. _Data:_ — _Test:_ snapshots plus contrast check. _M0·P1·[COMPUTED]_
- [ ] **KIT-037** Pressed icon toggles — `aria-pressed` toggles show the accent glyph and the pressed fill. _Data:_ — _Test:_ toggle Rulers; the snapshot matches; a screen reader announces "pressed". _M0·P1·[USER-TOKENS]_
- [ ] **KIT-038** Toolbar keyboard and flyouts — one tab stop; ← / → move; ↓ opens the flyout; the flyout lists each tool with its shortcut and checks the current one; the group shows its last-used tool. _Data:_ tool state _Test:_ keyboard script; activate Ellipse with O → the shape group shows Ellipse. _M1·P0·[KNOW][`10-panels…` §4.5]_
- [ ] **KIT-039** Tooltips — 500 ms first delay, instant within a 1 s skip window, Esc dismisses, the tooltip is hoverable, it shows on keyboard focus, and it carries the Figma shortcut. _Data:_ command registry _Test:_ timing capture ± 50 ms; WCAG 1.4.13 checks (V-UI-22). _M1·P1·[KNOW]_
- [ ] **KIT-040** One source for shortcuts — tooltips, menus, the palette and the native menubar show identical shortcut strings with platform glyphs. _Data:_ command registry _Test:_ change a binding → all four update; snapshot on macOS and Windows. _M1·P0·[DECISION]_
- [ ] **KIT-041** Segmented control — arrow keys move and commit (one undo step each); Mixed shows no indicator; the indicator slides in 200 ms. _Data:_ — _Test:_ ← three times → three undo entries; select two frames with different flows → no indicator. _M0·P1·[SRC:G4]_
- [ ] **KIT-042** Mixed toggles — switches and checkboxes expose `aria-checked="mixed"` and the mixed visuals. _Data:_ — _Test:_ two frames, one with Clip content and one without → indeterminate checkbox. _M0·P1·[DECISION]_
- [ ] **KIT-043** Select behavior — the kit menu opens aligned to the current item; ↑/↓ on a closed select never change the value. _Data:_ — _Test:_ focus the blend select and press ↓ ↓ with it closed → no undo entry. _M0·P1·[DECISION]_
- [ ] **KIT-044** Combobox scale and font previews — lists over 200 items are virtualized; font names render in their own face at a fixed row height; arrow-key preview of a family is one gesture committed on Enter. _Data:_ `fontName` [API] _Test:_ 2,000 installed fonts scroll at refresh rate; ↓ × 5 then Esc → original font, no undo entry (V-UI-07). _M3·P1·[KNOW]_

### 7.5 NumberField

- [ ] **KIT-045** Label scrubbing — dragging the prefix or label changes the value live; release commits one undo step; Esc during the drag restores it. _Data:_ any numeric property _Test:_ scrub W from 50 to 150, then ⌘Z → 50; scrub plus Esc → 50 with no undo entry (owner: UX-120, UX-197; V-UI-06). _M1·P0·[KNOW]_
- [ ] **KIT-046** ⌥/Alt-hover scrub — holding ⌥/Alt over any numeric field shows the scrub cursor and allows dragging. _Data:_ — _Test:_ hold Alt over the font-size field and drag → the value changes. _M1·P1·[SRC:forum.figma.com 36984 / 57230 excerpts]_
- [ ] **KIT-047** Scrub speed — the vertical pointer position modulates scrub speed as Figma does, with factors measured in V-UI-06. _Data:_ — _Test:_ a scripted drag at three heights → deltas match the recorded Figma ratios. _M1·P2·[SRC:forum.figma.com excerpts]_
- [ ] **KIT-048** Pointer lock — a scrub is not limited by the screen edge, draws its own cursor and always releases on mouse-up or Esc. _Data:_ — _Test:_ scrub from 20 px off the screen edge for 3,000 px of movement; the lock is released afterwards. _M1·P2·[DECISION]_
- [ ] **KIT-049** Arithmetic — supports `+ − * /`, parentheses, a leading operator relative to the current value, `%` of the current value in dimension fields, and matching unit suffixes; no `eval`. _Data:_ — _Test:_ `100/3` → 33.33 (area precision); `+10` on 50 → 60; `50%` on W 200 → 100; `2*(3+4)` → 14; `12px` → 12; `abc` → revert (owner: UX-122). _M1·P0·[SRC:forum.figma.com staff quoting the Help Center, excerpt]_
- [ ] **KIT-050** Mixed numbers — the field shows "Mixed"; typing applies to all; Esc leaves all; relative expressions apply per node. _Data:_ `figma.mixed` [API] _Test:_ X at 0 and 100; type `+10` → 10 and 110 (owner: UX §4.3; verify). _M1·P0·[KNOW]_
- [ ] **KIT-051** Nudge steps — ↑/↓ use the small nudge and ⇧↑/⇧↓ the big nudge from Preferences. _Data:_ nudge preferences _Test:_ set big nudge 8 → ⇧↑ on X adds 8. _M1·P1·[`10-panels…` §3.18 DOC excerpt]_
- [ ] **KIT-052** Commit semantics — Enter commits, Tab commits and moves, ⇧Tab commits and moves back, Esc reverts and blurs, blur commits; each commit is one undo step. _Data:_ — _Test:_ a keyboard script across W → H → X; undo count equals commit count (focus after Enter: `10-panels…` I-16). _M1·P0·[KNOW]_
- [ ] **KIT-053** Invalid input — unparsable text shows the inset danger ring and reverts on commit, without inline text or layout shift. _Data:_ — _Test:_ type `1/0` and `abc` → ring shown; Enter → previous value. _M1·P1·[KNOW]_
- [ ] **KIT-054** Spinbutton accessibility — `role="spinbutton"`, `aria-valuenow`, and `aria-valuetext` including "Mixed" and units; the accessible name is the Figma field name. _Data:_ — _Test:_ axe plus an accessibility-tree snapshot of the Position section. _M1·P1·[DECISION]_
- [ ] **KIT-055** Display precision — the kit never rounds stored values; it displays them at the area's precision with trailing zeros trimmed. _Data:_ — _Test:_ set W = 10.123456 through the API → the field shows the area-precision string; the stored value is unchanged. _M1·P1·[DECISION]_
- [ ] **KIT-056** Sizing field — the W/H caret menu lists Fixed, Hug and Fill (disabled when invalid), Add min…, Add max…, Remove min and max, and Apply variable; typing switches to Fixed; Hug and Fill show their mode label. _Data:_ `layoutSizingHorizontal`, `layoutSizingVertical`, `minWidth`, `maxWidth` [API] _Test:_ the AL fixtures for frame, flow child and text. _M4·P0·[DOC:360040451373 excerpt][OBS]_
- [ ] **KIT-057** Auto values — gap "Auto" and line-height "Auto" display as words and are replaced by typing a number; X in the alignment box toggles Auto gap. _Data:_ `primaryAxisAlignItems`, `lineHeight` [API] _Test:_ set Auto → shows "Auto"; type 8 → fixed 8. _M4·P1·[OBS][DOC:360040451373 excerpt]_
- [ ] **KIT-058** Linked field groups — padding H/V ↔ T/R/B/L, independent corners and per-side stroke weights expand and collapse; a combined field shows Mixed when its pair differs, and typing sets both. _Data:_ `padding*`, `*Radius`, `stroke*Weight` [API] _Test:_ AL-055, VC-023, PE-133. _M4·P0·[API][KNOW]_

### 7.6 Colour, gradient and image

- [ ] **KIT-059** ColorSwatchInput — swatch, uppercase hex or type label, divider and opacity; checkerboard under translucency; the mixed glyph; a chip when bound. _Data:_ `Paint.color`, `Paint.opacity` [API] _Test:_ 50 % red fill; a Linear gradient; mixed fills; a bound variable. _M2·P0·[SRC:G3]_
- [ ] **KIT-060** Opacity next to the hex is type-only — dragging it does nothing; typing works. _Data:_ `Paint.opacity` _Test:_ drag on the % field → no change (V-UI-09). _M2·P2·[SRC:https://forum.figma.com/report-a-problem-6/bug-scrub-drag-percentage-opacity-values-broken-58377 excerpt]_
- [ ] **KIT-061** Hex parsing — accepts 3, 6 and 8 digits with or without `#`; 8 digits carry alpha; invalid input reverts. _Data:_ `RGBA` _Test:_ `f00` → FF0000; `FF000080` → 50 % alpha; `zz` → revert (V-UI-10). _M2·P1·[DOC:360043042113 excerpt]_
- [ ] **KIT-062** Colour-picker inventory — Custom and Libraries tabs; a paint-type row with the available types; a blend button; colour area; eyedropper; hue and opacity strips; a Hex / RGB / CSS / HSL / HSB model select; On this page with swatches; close. _Data:_ `Paint` [API] _Test:_ open the picker on a fill; the control inventory matches [OBS] and the DOC excerpts. _M2·P0·[OBS][DOC:360041003774 excerpt][DOC:360043042113 excerpt]_
- [ ] **KIT-063** Picker keyboard — arrows move in the colour area (⇧ ×10) and on hue; I starts the eyedropper; Esc closes and returns focus to the swatch. _Data:_ — _Test:_ keyboard script. _M2·P1·[PE §5]_
- [ ] **KIT-064** Colour models are display-only — switching models never changes the stored colour and never adds an undo entry. _Data:_ `color` _Test:_ Hex → HSL → RGB; colour bytes identical; undo depth unchanged. _M2·P0·[DOC:360043042113 excerpt]_
- [ ] **KIT-065** ⌥-drag scrubbing in RGB, HSL and HSB fields — one undo step per drag. _Data:_ `color` _Test:_ PE-030. _M2·P1·[DOC:360043042113 excerpt]_
- [ ] **KIT-066** Eyedropper loupe — magnified view with a hex pill; Esc cancels; ⇧-click applies the style or variable. _Data:_ — _Test:_ sample a styled layer with ⇧ → binding applied (PE §5). _M2·P1·[SRC: forum quoting DOC:27643269375767 via PE §5]_
- [ ] **KIT-067** Gradient editor — clicking the bar adds an interpolated stop; dragging moves it as one undo step; deleting is allowed only with more than two stops; on-canvas handles stay screen-space. _Data:_ `gradientStops`, `gradientTransform` [API] _Test:_ add, move and delete stops; undo counts (V-UI-11). _M2·P0·[API][KNOW]_
- [ ] **KIT-068** Image fill editor — scale modes, tile %, rotate, replace, and seven centred adjustments that reset on double-click. _Data:_ `scaleMode`, `ImageFilters` [API] _Test:_ set every adjustment; double-click resets each to 0. _M2·P1·[DOC:360041098433 excerpt][API]_

### 7.7 Effects, stroke and layout widgets

- [ ] **KIT-069** Effect popovers per type — the field sets of §5.24, including GLASS, NOISE (three types), TEXTURE and PROGRESSIVE blur, with Apply variable where allowed. _Data:_ `Effect` union [API] _Test:_ add each type; the field inventory matches the API fields. _M2·P0·[API]_
- [ ] **KIT-070** Stroke settings — position, weight, sides menu, style, dash, gap, caps (8 values), joins, swap and the Draw section. _Data:_ `strokeAlign`, `StrokeCap`, `StrokeJoin`, `dashPattern`, `complexStrokeProperties` [API] _Test:_ control inventory matches; each cap glyph maps to its enum. _M2·P1·[API][DOC:360049283914 excerpt]_
- [ ] **KIT-071** Auto layout panel inventory — Freeform / Vertical / Horizontal / Grid flow; Wrap only for stack flows; W/H sizing; the matrix; gap with Auto; counter-axis gap with wrap; padding; Clip content; the five-option settings popover; grid controls; the legacy badge. _Data:_ AL §2 fields [API] _Test:_ compare with the AL §4.1 table for a frame, an auto layout frame, a grid and a flow child. _M4·P0·[OBS][API]_
- [ ] **KIT-072** Alignment matrix — the 9 positions, space-between, baseline and Mixed are visually distinct; arrows commit; X and B work while focused. _Data:_ `primaryAxisAlignItems`, `counterAxisAlignItems` [API] _Test:_ cycle all states; snapshot each (also FVR-029; V-UI-12). _M4·P0·[API][OBS][DOC:360040451373 excerpt]_
- [ ] **KIT-073** Constraints widget — the ticks represent all 5 × 5 combinations; the Selects carry Figma's full labels; ⇧-click on the opposite edge makes stretch; Mixed shows no ticks. _Data:_ `constraints` [API] _Test:_ set each combination via the Selects → ticks match (V-UI-13). _M4·P0·[API][KNOW]_
- [ ] **KIT-074** Layout guide rows — the summary text and the popover fields per pattern; the guide colour comes from data. _Data:_ `LayoutGrid` [API] _Test:_ create Columns, Rows and Grid; the fields match the API. _M4·P1·[API]_
- [ ] **KIT-075** Grid picker — the hover grid shows "r × c" live; a click sets the counts; typed counts accept arithmetic. _Data:_ `gridRowCount`, `gridColumnCount` [API] _Test:_ hover 3 × 4 → label; click → 3 rows and 4 columns; type `2*3` → 6. _M4·P1·[DOC:31289469907863 excerpt]_
- [ ] **KIT-076** Legacy layout badge — shown for `LEGACY` frames, with an Update button. _Data:_ `layoutVersion` (Illigma) _Test:_ import a legacy fixture → badge shown. _M4·P2·[OBS][AL §3.14]_

### 7.8 Lists, layers, pages and assets

- [ ] **KIT-077** List rows — paint, effect, guide, export, interaction and property rows reorder by drag with an insertion line (one undo step); adding or removing animates for 150 ms and moves focus predictably. _Data:_ `fills`, `effects`, … [API] _Test:_ reorder three fills; undo once; add and remove with the keyboard → focus lands as specified (V-UI-08). _M1·P1·[DECISION]_
- [ ] **KIT-078** Layer-row states — the §5.32 table: component family in purple with AA text, own versus inherited hidden or locked, selected per D-2, the descendant band, renaming, drag source. _Data:_ `visible`, `locked`, `type` [API] _Test:_ a 4-level fixture with one hidden, one locked, one component, one selected and one hovered row; snapshots in both themes. _M1·P0·[USER-TOKENS][`10-panels…` §3.1]_
- [ ] **KIT-079** Row hover → canvas hover — hovering a layer row draws that node's hover outline on the canvas within one frame. _Data:_ — _Test:_ hover rows in turn; frame capture. _M1·P1·[DOC:360040449873 excerpt]_
- [ ] **KIT-080** Layer drop indicators — the insertion line at the target depth with an end ring; a drop-into ring; refusal inside an instance (except slots); auto-expand after a delay; auto-scroll near the edges. _Data:_ — _Test:_ the drag scenarios of `10-panels…` §3.5 (V-UI-14). _M1·P0·[KNOW]_
- [ ] **KIT-081** Inline rename — double-click or ⌘R shows a 24 px input with the name selected; Enter commits; Esc cancels. _Data:_ `name` [API] _Test:_ rename, then cancel; undo counts (owner: `10-panels…` §3.4). _M1·P1·[SRC: figma blog via UX §3.4]_
- [ ] **KIT-082** Tree keyboard model — Tab / ⇧Tab move through rows and select layers; ↑/↓ nudge; ⇧F10 or the context-menu key opens the row menu. _Data:_ — _Test:_ keyboard script (V-UI-02). _M1·P1·[DOC:35063862380311 excerpt][KNOW]_
- [ ] **KIT-083** Virtualized tree ARIA — `aria-level`, `aria-setsize`, `aria-posinset`, `aria-expanded` and `aria-selected` stay correct for virtual rows. _Data:_ — _Test:_ accessibility-tree snapshot after scrolling to row 5,000. _M8·P1·[DECISION]_
- [ ] **KIT-084** Tree performance — 10,000 visible rows scroll at display refresh rate. _Data:_ — _Test:_ bench scene; frame times p95 < 16.7 ms at 60 Hz. _M8·P0·[`10-panels…` §3.1]_
- [ ] **KIT-085** Fixed and Scrolls headers — 24 px non-selectable header rows inside frames with fixed children. _Data:_ `numberOfFixedChildren` [API] _Test:_ a frame with one fixed child → both headers, in the right order. _M7·P2·[API]_
- [ ] **KIT-086** Page rows — the active page treatment, divider-page rendering, inline rename and the reorder indicator. _Data:_ `PageNode` [API] _Test:_ fixture with 4 pages and a divider; snapshots. _M1·P1·[USER-TOKENS]_
- [ ] **KIT-087** Asset tiles — thumbnails, the component-set badge, the purple Update button when a library has updates, the drag ghost. _Data:_ — _Test:_ a library fixture with an outdated component → Update button shown. _M5·P1·[SRC:U10]_

### 7.9 Bindings, variables, components and prototype

- [ ] **KIT-088** Chips — neutral for variables and styles, purple for component properties, a warning state when missing, a Mixed chip, detach on hover; neutral and purple are never confused. _Data:_ `boundVariables`, `componentPropertyReferences` [API] _Test:_ bind a fill to a variable and a text to a property; delete the variable → warning chip (also FVR-030). _M6·P0·[API]_
- [ ] **KIT-089** Variable picker filtering — only variables of the field's resolved type and scope are offered. _Data:_ `VariableScope`, `resolvedType` [API] _Test:_ a FLOAT variable scoped to GAP only is offered for gap and not for corner radius. _M6·P0·[API]_
- [ ] **KIT-090** Variables view frame — edge-to-edge by default with a minimize-to-modal toggle; sidebar toggle; "+ Create variable" with a type menu; a new mode column to the right of the headers. _Data:_ `VariableCollection.modes` [API] _Test:_ open, minimize, add a mode → the column appears with values duplicated from the first column. _M6·P0·[DOC:15145852043927 excerpt]_
- [ ] **KIT-091** Variables table cells — editors per type; alias chips; inherited values in extended collections shown secondary; overrides marked. _Data:_ `valuesByMode`, extended collections [API] _Test:_ an extended-collection fixture → inherited versus overridden rendering. _M6·P1·[API][DOC:36346281624471 title]_
- [ ] **KIT-092** Variables table keyboard and selection — grid navigation, Enter to edit, Esc, ⇧-click range, ⌘-click toggle, ⌫ delete, ⇧↵ duplicate. _Data:_ — _Test:_ keyboard script (DS V-73). _M6·P1·[DOC:15145852043927 excerpt][KNOW]_
- [ ] **KIT-093** Variables table scale — 5,000 variables × 10 modes scroll at refresh rate. _Data:_ — _Test:_ bench fixture; frame times. _M8·P1·[DOC:15145852043927 excerpt]_
- [ ] **KIT-094** Instance property controls — VARIANT select, BOOLEAN switch, TEXT field, INSTANCE_SWAP picker with preferred values first, SLOT row, nested-instance sub-sections, override dots. _Data:_ `ComponentPropertyType`, `componentProperties` [API] _Test:_ an instance fixture with one property of each type. _M5·P0·[API][CP §4.4]_
- [ ] **KIT-095** Property definitions — the list, the edit popover including slot settings, and a "+" menu with the five types. _Data:_ `componentPropertyDefinitions` [API] _Test:_ create one property of each type. _M5·P1·[API][CP §4.2]_
- [ ] **KIT-096** Interaction editor inventory — trigger with its sub-fields (including key capture and device), actions with conditional blocks, animation with direction, smart-animate matching, curve, duration, and the state checkboxes. _Data:_ `Trigger`, `Action`, `Transition`, `Easing` [API] _Test:_ inventory compared with PR §4 and the API unions. _M7·P0·[API][PR §4]_
- [ ] **KIT-097** Curve editor — draws all 13 easing types; edits a bezier through the handles or four fields and a spring through three fields; the Select shows curve thumbnails. _Data:_ `Easing.type`, `easingFunctionCubicBezier`, `easingFunctionSpring` [API] _Test:_ set each preset → thumbnail and curve match the defined function. _M7·P1·[API]_
- [ ] **KIT-098** Noodles — visible on the Prototype tab, via ⇧E or the view toggle; 2 px or 3 px when selected; start dot; arrowhead; retarget handles; flow badge; constant in screen space. _Data:_ `reactions`, `flowStartingPoints` [API] _Test:_ connections at 25 % to 400 % zoom (also FVR-031). _M7·P0·[DOC:4411431245335 excerpt][KNOW]_

### 7.10 Overlays

- [ ] **KIT-099** Menus — the user's surface (`#1c1c1c`, `#363636` edge, radius 12, shadow, highlight), 30 px items, the highlight per D-7 and D-10, disabled at 35 %, destructive styling, separators, section labels. _Data:_ — _Test:_ snapshot of the layer context menu in both themes. _M0·P0·[USER-TOKENS]_
- [ ] **KIT-100** Menu keyboard and placement — arrows, typeahead, submenus with → and ←, Esc one level at a time, clamped 8 px inside the viewport, internal scrolling when tall. _Data:_ — _Test:_ open near each window corner; keyboard script. _M0·P0·[DECISION]_
- [ ] **KIT-101** Menu confirmation blink — the chosen item blinks twice for 60 ms before the command runs; skipped under reduced motion. _Data:_ — _Test:_ 60 fps capture (also FVR-022). _M1·P2·[SRC:U1]_
- [ ] **KIT-102** Main menu and menubar parity — the in-app main menu and the macOS menubar show the same tree, labels, enabled state and shortcuts from one registry. _Data:_ command registry _Test:_ diff the serialized trees. _M1·P1·[`10-panels…` §4.6]_
- [ ] **KIT-103** Command palette — ⌘K opens it; it searches commands and assets; arrows and Enter work; Esc restores the previous focus. _Data:_ command registry _Test:_ run "Add auto layout" from the palette → same result as ⇧A. _M1·P1·[DOC:35063862380311 excerpt]_
- [ ] **KIT-104** Toasts — four variants; stacking of up to three; 3 s dwell, persistent with an action or error; hover pauses; correct live-region roles. _Data:_ — _Test:_ trigger each variant; screen-reader announcement log. _M0·P1·[SRC:D1][USER-TOKENS]_
- [ ] **KIT-105** Dialogs — focus trap and return, Esc handling, and the standard, sheet and confirm variants. _Data:_ — _Test:_ open the keyboard-shortcuts sheet and a delete confirmation; keyboard script. _M0·P0·[USER-TOKENS]_
- [ ] **KIT-106** Popover placement — inspector popovers open left of the right sidebar, top-aligned with their trigger, clamped to the viewport; focus moves in and returns. _Data:_ — _Test:_ open the picker from the last fill row in a short window → clamped (V-UI-05). _M2·P1·[KNOW]_
- [ ] **KIT-107** Scrollbars — overlay style with no content shift; native fallback under forced colours. _Data:_ — _Test:_ grow a list until it scrolls → content width unchanged. _M0·P1·[USER-TOKENS]_

### 7.11 Canvas chrome

- [ ] **KIT-108** Canvas-chrome theme handoff — `CanvasChromeTheme` is generated from tokens; a theme switch re-runs only the overlay pass. _Data:_ `CanvasChromeTheme` _Test:_ performance trace during a switch shows zero document tile renders. _M0·P0·[DECISION]_
- [ ] **KIT-109** Screen-space chrome — stroke widths and handle sizes are constant at 10 %, 100 % and 800 % zoom and at DPR 1 and 2. _Data:_ — _Test:_ CanvasKit goldens (also FVR-025). _M1·P0·[USER-TOKENS]_
- [ ] **KIT-110** No animated canvas feedback — overlays are positioned from the same frame's pointer state. _Data:_ — _Test:_ frame capture during a drag; the overlay offset relative to the pointer is constant. _M1·P0·[DECISION]_
- [ ] **KIT-111** Pills and badges — measurement pills and the W × H badge use AA fills and tabular figures. _Data:_ — _Test:_ contrast computation on rendered pixels; digit widths constant. _M1·P1·[COMPUTED]_
- [ ] **KIT-112** Auto layout overlays — gap and padding hatches, handles and pills in `--ill-layout-overlay`; hovering the gap or padding field highlights the matching overlay. _Data:_ `itemSpacing`, `padding*` [API] _Test:_ hover the fields → the overlay appears (also FVR-028). _M4·P1·[DOC:360040451373 excerpt via AL §3.17]_
- [ ] **KIT-113** Rulers and guides — 20 px rulers with adaptive ticks, a selection band and tabular numbers; guides in `--ill-guide`, the selected guide in the accent. _Data:_ `guides` [API] _Test:_ toggle ⇧R; select a frame → band; drag a guide → position pill. _M1·P1·[KNOW]_
- [ ] **KIT-114** Canvas keyboard focus box — when canvas focus moves by keyboard, a dashed focus box surrounds the layer. _Data:_ — _Test:_ Tab through layers → box shown; a mouse click → no box. _M8·P1·[SRC:https://forum.figma.com/suggest-a-feature-11/keyboard-navigation-focus-indicator-43575 excerpt]_
- [ ] **KIT-115** Pixel grid — appears from Figma's zoom threshold in the token colour. _Data:_ view preference _Test:_ zoom 399 % → absent; 400 % → present (threshold verify). _M1·P2·[DOC:360041065034 via old feature guide]_
- [ ] **KIT-116** Component-set and slot outlines — a dashed purple set border and a dashed slot highlight with its empty label. _Data:_ `COMPONENT_SET`, `SLOT` [API] _Test:_ snapshot (V-UI-28). _M5·P1·[KNOW]_

### 7.12 Workbench, contracts and quality gates

- [ ] **KIT-117** Workbench state matrices — every kit component has a matrix page in both themes, forced by data attributes. _Data:_ — _Test:_ the route list covers §5.1–§5.50. _M0·P0·[DECISION]_
- [ ] **KIT-118** Visual regression — baselines in Chromium and Electron, at DPR 1 and 2, both themes, animations off, bundled fonts; threshold 0.001. _Data:_ — _Test:_ a seeded 1 px radius change fails CI. _M0·P0·[DECISION]_
- [ ] **KIT-119** Framer reference overlay — the workbench loads Framer crops as onion skin or difference; a sign-off flips the token status from verify. _Data:_ `TokenMeta.status` _Test:_ load a crop; record a sign-off → status updated in `tokens.json`. _M0·P1·[DECISION]_
- [ ] **KIT-120** Inspector fixtures — the Design and Prototype panels for the 20 selection types render from the section schema with a mock adapter; section order equals `10-panels…` §4.2. _Data:_ section schema _Test:_ a snapshot per selection type; schema rows cite their evidence. _M1·P0·[OBS][KNOW]_
- [ ] **KIT-121** Edit contract — every value control emits preview, commit and cancel correctly; one gesture equals one undo step. _Data:_ transaction API (ADR-011) _Test:_ mock-adapter assertions for each control type. _M0·P0·[DECISION]_
- [ ] **KIT-122** Save-status indicator — the five states with their tokens; a polite live region throttled to one announcement per 10 s. _Data:_ document save state (ADR-018) _Test:_ simulate each state; announcement log. _M0·P1·[DECISION]_
- [ ] **KIT-123** Inspector update budget — during a canvas drag, inspector work is ≤ 1 ms of main thread per frame and only X/Y re-render. _Data:_ signals (ADR-013) _Test:_ performance trace of a 2 s drag; render counts per component. _M1·P1·[DECISION]_
- [ ] **KIT-124** Accessibility gate — zero serious or critical axe violations on all workbench pages and the full-editor fixture, in both themes. _Data:_ — _Test:_ axe in CI. _M8·P0·[DECISION]_

---

## 8. Decisions

### 8.1 Confirmed previously (locked)

C-1 to C-6 (§4.1): the bottom floating toolbar; pages and layers on the left; properties on the right with Design and Prototype tabs; Export at the bottom of the right sidebar; no top bar; dark theme as the default. **C-1 differs from Framer**, which uses a top toolbar [SRC:U7]. It is kept because the user chose it previously, unless the user says otherwise. It settles FVR D-1.

### 8.2 Open decisions for the user

"Interim" is what M0 builds until the user decides. Every option keeps Figma's behavior; only looks or placement change.

| Id | Decision | Options | Recommendation | Interim |
| --- | --- | --- | --- | --- |
| D-1 | Toolbar placement | Settled by C-1 | — | Bottom (C-1) |
| D-2 | Selected layer-row style | A: `--ill-accent-dim` fill (Framer-calm). B: solid fill like the user's prototype (`#0D99FF`), using `--ill-accent-fill` `#0073e6` for AA white text. | A | A |
| D-3 | Primary button shape | A: 8 px radius (Framer [SRC:F1]). B: 40 px pills (user `--pill-radius`, used for Export and Add). | A; keep pills only as an Illigma signature if the user wants one | A |
| D-4 | Field style | A: borderless `#2b2b2b` fill (Framer). B: `#1c1c1c` fill with a `#292929` border (user). | A | A |
| D-5 | Spacing base | A: 5 px (Framer; fits the user's 15 px gutter). B: 8 px (user `--grid`). | A | A |
| D-6 | Panel background | A: `#141414` (user). B: `#111111` (Framer fallback). | Sample Framer first | A (locked until decided) |
| D-7 | Accessibility overrides of the Framer look | Adopt all, some or none of: (a) `--ill-text-3` restricted to disabled and decorative uses, with placeholders and units at `#999`; (b) text on accent uses `--ill-accent-fill` `#0073e6`, not `#0099ff` (3.00:1); (c) destructive fill `#e5195a`, not `#ff3366` (3.55:1); (d) purple text `#9a70ff`, not `#8855ff` (4.20:1); (e) light `--ill-text-3` `#8a8a8a`. | Adopt all: required by P-5 | Adopt all |
| D-8 | Default page background for **new files** (document data) | A: Figma parity: `#1E1E1E` when created in dark, `#F5F5F5` in light [DOC:360041064814 excerpt]. B: the user's `#090909` for dark files (a data-level deviation from Figma). | A. `--ill-canvas` `#090909` still colours the chrome void. | A |
| D-9 | Navigation rail | A: adopt Figma's current left navigation bar (File, Assets, Find, Variables, notifications) [DOC:360039831974 excerpt]. B: the user's previous structure, without a rail. | A (Figma owns structure) | A |
| D-10 | Menu highlight | A: accent fill with white text (the user's prototype; macOS-like). B: a neutral `--ill-control` highlight (FVR alternative). | A, verify against Framer | A |
| D-11 | Framer geometry package (each item can be accepted separately) | Control radius 5 → 8; layer row 32 → 30; menu item ≈ 32 → 30; tab bar 45 → 48; default weight 400 → 500 (titles 600, no 550); section vertical padding 15 → 10; swatch 20 → 22; colour picker width 280 → 240; alignment matrix 84 → 70; constraints widget 76 → 64; tooltip radius 5 → 6 and shortcut gap 18 → 10; toast radius 9 → 10; tab underline removed. | Adopt (Framer evidence, FVR §3–§8) | Adopt; the user's values remain the fallback |
| D-12 | Icon weight and toolbar glyph size | A: 1.5 px on-screen strokes and 20 px toolbar glyphs. B: the user's Lucide at `stroke-width: 1.6` on 16 px (≈ 1.07 px) and 18 px toolbar glyphs. | A | A |
| D-13 | Zoom/view menu location | A: only the user's floating zoom pill (its menu holds Figma's zoom/view items). B: also mirror Figma's "100 % ▾" menu in the right-sidebar header [DOC:23954856027159 excerpt]. | A; B only if users miss it | A |

---

## 9. Needs live Figma verification

These claims rest on `[KNOW]`, forum posts or search excerpts. They affect **which** chrome exists, **when** it appears or **how** it behaves, so they must be checked in live Figma before the related KIT items are signed off. Each check must be recorded as a before / action / after observation, as the old observation template requires.

| Id | What to verify | Affects |
| --- | --- | --- |
| V-UI-01 | F6 / ⌃F6 region order, ⇧F6 reverse, and which element gets focus on entering a region | KIT-025 |
| V-UI-02 | Layers-panel keyboard model: does Tab move through rows, does it select, what Enter does, and that ↑/↓ always nudge | KIT-082, §5.32 |
| V-UI-03 | Clicking the active navigation-rail tab: does it collapse the sidebar? | §4.4 |
| V-UI-04 | No Export section on the Prototype tab; page export settings shown with nothing selected | KIT-026 |
| V-UI-05 | Colour picker and other inspector popovers: placement, dragging, and behavior when the selection changes or on undo | KIT-106, §5.21, §5.46 |
| V-UI-06 | Scrub details: the role of ⇧ and ⌥ (sources conflict), the speed versus vertical pointer position, Esc during a scrub, step size per field type | KIT-045…047 |
| V-UI-07 | Font picker: does ↑/↓ preview fonts live on the selection, and how is the preview committed or cancelled? | KIT-044 |
| V-UI-08 | Is there a keyboard method to reorder fills, effects and other list rows? | KIT-077 |
| V-UI-09 | The paint-opacity field next to the hex is type-only (forum, 2026-09-25) | KIT-060 |
| V-UI-10 | Hex field input forms: 3, 6 and 8 digits, CSS colour names, pasted `rgb()` | KIT-061 |
| V-UI-11 | Gradient stop deletion gesture (Delete key, dragging off the bar) and the two-stop minimum | KIT-067 |
| V-UI-12 | Alignment-matrix hover preview glyphs, and how space-between and baseline render (FVR "Needs live Figma verification" #4) | KIT-072 |
| V-UI-13 | Constraints-widget gestures: ⇧-click for stretch, clicking the centre, and the behavior on groups | KIT-073 |
| V-UI-14 | Layers drag-and-drop: insertion-line geometry, drop-into ring, auto-expand delay, refusal inside instances | KIT-080 |
| V-UI-15 | Do Delete or Backspace on a focused variable or style chip detach it? | §5.35 |
| V-UI-16 | Actions menu (⌘K) tabs and categories in the current UI | KIT-103 |
| V-UI-17 | Interface-scale steps, and whether canvas chrome scales with the interface | KIT-027 |
| V-UI-18 | Which boolean properties use toggles and which use checkboxes, beyond "Clip content", which is a checkbox [OBS] (FVR #7) | §5.8, §5.9 |
| V-UI-19 | Tab order of padding (T, R, B, L?) and independent corners (TL, TR, BR, BL?) | §5.13 |
| V-UI-20 | Rail labels default to on, the rail width, and what "Additional labels" changes in the inspector | KIT-029, §4.4 |
| V-UI-21 | Can Figma inspector sections be collapsed? If not, Illigma's optional collapse is an **Illigma extension** and stays off by default | §5.17 |
| V-UI-22 | Tooltip delays and the skip window | KIT-039 |
| V-UI-23 | Menu submenu-open delay; whether dropdown menus open over the trigger aligned to the current item | §5.14, §5.40 |
| V-UI-24 | Noodle idle and hover styling, the start dot and arrowhead, and inherited connections shown only on instance selection | KIT-098 |
| V-UI-25 | Variables-table keyboard behavior (DS V-73) | KIT-092 |
| V-UI-26 | Resize handles: corners only or corners plus edges; the minimum on-screen size before handles hide | §5.49 |
| V-UI-27 | Contents of the W × H badge for Hug and Fill axes and for rotated layers | §5.49 |
| V-UI-28 | Section-title pill colouring, and the dashed purple outline on component sets | §5.49, KIT-116 |
| V-UI-29 | Smart-guide, ⌥-measurement and spacing-overlay colours (red and pink), and the equal-spacing indicator style | §2.2.7 |
| V-UI-30 | The Figma toolbar's active-tool treatment (blue fill or tint) and its flyout layout (FVR #2) | §5.5 |
| V-UI-31 | Pixel-grid zoom threshold (400 %?) | KIT-115 |

## 10. Needs Framer verification

The capture list in FVR "Verification needed" (sections A–D) applies unchanged. Its devtools step D.1, reading the 14 `--framer-color-*` tokens from a plugin iframe, settles most **V** colour values in one pass. Additional samples specific to this document:

1. The menu and popover surface and the menu-item highlight (D-10). Does Framer 3.0 use an accent or a neutral highlight?
2. The dark control-hover fill (`--ill-control-hover` proposed `#303030`) and the segmented indicator (`#474747`).
3. Framer's component purple hex (`--ill-component` `#8855ff` is a placeholder).
4. Whether Framer has any left icon rail or tab strip whose styling the Illigma rail (§4.4) should borrow.
5. Tooltip and toast surfaces in Framer's **light** theme: do they stay dark?
6. Canvas guide and measurement colours, and any spacing-overlay colour in Framer's stack or grid editing.
7. Light-theme shadows for menus, popovers and floating toolbars.
8. Whether Framer 3.0 panels or menus use translucency or backdrop blur (`--ill-blur-panel`).
9. Tab-indicator treatment (none versus underline) in Framer 3.0's Style and Agent tabs.
10. Framer's numeric-field scrub cursor and any on-screen scrub affordance. Only the look applies; the behavior is Figma's.
