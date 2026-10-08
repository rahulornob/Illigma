# Framer visual reference for Illigma's editor chrome

> **Phase:** planning. This is documentation only. Every item below has status **Not started**.
> **Rule:** Figma decides behavior and Framer decides looks. This file covers **only the look of the editor chrome**: the panels, controls, menus, the canvas overlays and motion. It never changes what a control does, which controls exist, or how a Figma workflow behaves. Where Figma has a control that Framer lacks, Framer's visual language is applied to that Figma control (see [Mapping principles](#mapping-principles)).
> **Target:** Framer's current editor UI. Framer shipped an "all-new interface" with **Framer 3.0 on 2026-06-16** ([SRC:N1], [SRC:N2]). Values are taken from 3.0-era sources where they exist.
> **Written:** 2026-10-08. No live Framer session, screenshot or video was inspected for this document. framer.com could not be fetched from this environment. The WebSearch budget for the run ran out partway through the research, so some planned queries (canvas background colour, smart-guide colours, menu surfaces) were never run. Those values are marked **TBD** or **[KNOW] approximate**.

---

## 0. Evidence legend and sources

| Tag | Meaning |
| --- | --- |
| `[SRC:<id>]` | Web or package source. Each id resolves to the URL in the table below. "excerpt" means only a search-result summary was seen, not the full page. |
| `[USER-TOKENS]` | The user's previously approved Framer-style tokens, from the deleted prototype's `src/styles.css` (snapshot at `scratchpad/old/src/styles.css`). Treat these as the approved direction. |
| `[KNOW]` | The author's own background knowledge, **not verified in this session**. Every `[KNOW]` value is **approximate: verify against Framer screenshots**. |
| `[API]` | Figma Plugin API typings v1.141.0 (`plugin-api.d.ts`). Used only to name the Figma data a control edits. |
| `[OBS]` | The 2026-09-27 read-only live-Figma observation (old `docs/figma/observations/2026-09-27-live-figma.md`). |

### Primary sources (Framer-authored code, read in full)

These are the strongest evidence available offline. Framer's plugin system deliberately mirrors the editor's own controls, so plugin windows look native.

| Id | Source | What it proves | Confidence |
| --- | --- | --- | --- |
| F1 | `framer.css` from npm `@framer/plugin@5.1.0` (byte-identical to `4.0.3`): https://registry.npmjs.org/@framer/plugin/-/plugin-5.1.0.tgz → `package/styles/framer.css` | Control geometry: 30 px height, 8 px radius, 8 px padding, Inter 12/500, buttons 600, focus ring, checkbox and radio, select chevron, disabled opacity, tint hover and active, transitions. Shipped as the **Framer 3.0** plugin style. | High for geometry and typography. Colours come only as token *names* plus a few hard-coded values. |
| F2 | Same package, `dist/index.d.ts` → `interface ThemeTokens` | The official list of the 14 semantic colour tokens Framer injects per theme: `--framer-color-tint`, `-tint-dimmed`, `-tint-dark`, `-tint-extra-dark`, `-text`, `-text-secondary`, `-text-tertiary`, `-text-reversed`, `-bg`, `-bg-secondary`, `-bg-tertiary`, `-control`, `-control-hover`, `-divider`; plus `ThemeMode = "light" \| "dark"`. | High for names. The values are injected at runtime and are **not** in the package. |
| F3 | `framer.css` from npm `framer-plugin@3.10.3` (pre-3.0): https://registry.npmjs.org/framer-plugin/-/framer-plugin-3.10.3.tgz | Baseline for what 3.0 changed: input padding 10→8 px, checkbox 12→14 px, the new `--framer-color-control` token for dark controls, Inter alternates, `::selection` colours. | High |
| F4 | Framer developer changelog v4.0.0: https://www.framer.com/developers/changelog (excerpt) | "new Plugin styles to match the all-new Framer 3.0 design"; framer.css "updated with Framer 3.0 styles, including new Inter character alternatives, selection colors, and input element styles". npm shows `@framer/plugin@4.0.0` published 2026-06-12. | Medium-high (excerpt) |
| G1 | https://github.com/framer/plugins/blob/main/plugins/code-versions/src/styles.css | Framer engineers' **fallback hex values** for the theme tokens in light and dark, plus the code font (Input Mono, 11 px, 19 px rows) and diff colours. | Medium-high. Fallbacks track the injected values, but are not guaranteed to equal them. |
| G2 | https://github.com/framer/plugins/blob/main/plugins/global-search/src/styles.css | A second fallback palette (text, option, divider and modal surfaces), a **5 px spacing unit**, 48 px header, 30 px item height, the `data-framer-styles="prerelease"` gate for the 3.0 Inter alternates, and the fade-in easing. | Medium-high |
| G3 | https://github.com/framer/plugins/blob/main/plugins/ascii/src/App.css | A recreation of the **property row** (grid `minmax(0,1.5fr) repeat(2, minmax(62px,1fr))`, 10 px column gap, 40 px row pitch, 15 px label inset), the colour input (22 px swatch, radius 4), the segmented indicator (`#474747` dark, top-lit inner edge), the slider, and the 3.0 "prerelease" slider (3 px track, 12 px thumb, `#707070` fill in dark). | Medium-high |
| G4 | https://github.com/framer/plugins/blob/main/plugins/design-system/src/components/segmented-control.css | Segmented control: track 30 px, radius 8, 2 px inset; indicator radius 6 at `#555` (dark) or white (light), shadow `0 2px 4px rgba(0,0,0,.15)`; slides in **200 ms `cubic-bezier(0.2, 0, 0, 1)`**; active label 600, inactive label tertiary 500; in light mode the active label is tint-coloured. | Medium-high |
| G5 | https://github.com/framer/plugins/blob/main/plugins/design-system/src/App.css | 15 px side padding, 10 px gaps, 30 px control rows, 8 px card radius, 0.1 s ease-out hover overlay, 12 px colour dots. | Medium |
| G6 | `framer/plugins` `plugins/hubspot/src/globals.css` (code-search excerpt only) | "framer-red" `#ff3366` and "framer-blue" `#0099ff` named as Framer colours. | Medium (excerpt) |
| G7 | `framer/plugins` `plugins/csv-import/src/App.css` (code-search excerpt only) | `--framer-color-warning` fallback `#ff9500`. | Medium (excerpt) |
| G8 | `framer/plugins` `plugins/google-search-console/src/App.css` (code-search excerpt only) | A tooltip-like surface: `--framer-color-bg`, 1 px `#222` border, `0 6px 12px rgba(0,0,0,.1)`. | Low-medium |
| T1 | https://github.com/triozer/framer-toolbox (`packages/toolbox/src/**.css`, read in full) | A community recreation of Framer controls that Framer's own docs recommend (D1). Number stepper (`#2b2b2b` track, `#444` divider, `#999` glyphs), segmented control (`#555` selected in dark), destructive `#ff3366` with hover `#e15`, and a "clear" button with `backdrop-filter: blur(10px)` over `#00000080`. | Medium |
| D1 | https://github.com/bengold/docs/blob/main/plugins/guides/interface.mdx (a third-party mirror of Framer's developer "Interface" guide, read in full) | The token list, the `[data-framer-theme]` theming hook, notifications in four variants (info, success, warning, error), and native header and context menus rendered by Framer. | Medium |

### Secondary sources (Framer product pages and third parties, seen as search excerpts only)

| Id | Source | Claim used |
| --- | --- | --- |
| N1 | https://www.framer.com/updates/framer-3 (title only) and https://www.therundown.ai/tools/framer-3-0 (excerpt) | Framer 3.0, June 2026: an "all-new interface", agents, branching. |
| N2 | https://www.oma-kase.com/blog/framer-3-launch (excerpt) | In 3.0 the right panel splits into a **Style** tab and an **Agent** tab. |
| U1 | https://www.framer.com/updates/september-update-2024 (excerpt) | "Improved dark mode colors of the Framer interface"; zero-out values in the property panel; **scrub split inputs via the label below**; a **confirmation animation on menu selections**; Copy Fill. |
| U2 | https://www.framer.com/help/articles/light-and-dark-mode-options/ (excerpt) | The light/dark switch lives in the Canvas menu, shortcut ⌃⌘N. |
| U3 | https://www.framer.com/updates/light-and-dark-mode (excerpt) | A canvas-toolbar icon toggles the **app UI** and the colour styles between themes. |
| U4 | https://www.framer.com/updates/vectors (excerpt, 2025-05-21) | Toolbar redesigned, with vector shapes and path-editing tools. |
| U5 | https://www.framer.com/updates/may-update-2025 (excerpt) | A combined Plugins and Actions menu in the **Canvas Toolbar**. |
| U6 | https://www.framer.com/updates/unified-pages and https://framer.com/updates/september-update-2025 (excerpts) | The Pages panel is unified and nested; Pages and Assets support multi-select. |
| U7 | https://www.framer.com/academy/lessons/framer-interface (excerpt) | Toolbar: insert layers and assets, project name, **active branch**, preview, publish. Left sidebar: Pages, Layers, Assets. Right sidebar follows the selection. Canvas: pan, comments, light/dark preview, zoom to fit, zoom to selection, 100 %. |
| U8 | https://www.framer.com/marketplace/tutorials/framer-interface/ (excerpt) | Three left tabs; right panel for size, content and design. |
| U9 | https://www.framer.com/updates/quick-insert and https://www.framer.com/updates/wireframer-icons-and-insert-sections (excerpts) | ⌘K quick insert. The Insert Panel shows sections in light and dark. |
| U10 | https://www.framer.com/help/articles/how-to-update-your-components-in-framer/ (excerpt) | A **purple** "Update" button for components in Assets, which supports purple as the component colour. |
| U11 | https://www.oppadu.com/tools/design-systems-site/brand/framer.html (excerpt) | A "floating tool panel" over the canvas and a "Framer Blue" selection outline. |

**Rejected sources:**
- The `ihlamury/design-skills` "framer-ui-skills" SKILL.md is an automated scan whose values are clearly not editor chrome (for example "text-primary `#89786E`", "93px headings").
- The refero and hagicode "Framer style" pages describe framer.com's **marketing site**, not the editor.
- No Figma-Community "Framer editor UI kit" turned up in search, so none is cited.

---

## 1. Overall appearance and visual hierarchy

1. **Dark is the default and the signature look.** The surfaces are neutral, near-black greys with no blue or warm cast ([SRC:G1], [SRC:G2], [USER-TOKENS]). A full light theme exists and is switched from the Canvas menu or with ⌃⌘N ([SRC:U2], [SRC:U3]). Illigma should ship both themes from M0, with dark as the default.
2. **Hierarchy comes from lightness steps, not lines.** The levels run panel `#111` → secondary `#1d1d1d` → control `#2b2b2b` → raised indicator `#474747`/`#555` ([SRC:G1], [SRC:G3], [SRC:G4]). Dividers are faint (`#252525`) and are used only between panels and between sections. **Controls have no borders**: they are filled shapes with an 8 px radius ([SRC:F1]).
3. **Typography is uniform and small.** Inter 12 px is used almost everywhere. Weight carries the emphasis: 500 is the default and 600 marks titles, buttons and the active state ([SRC:F1]). Grey levels carry the secondary information: text `#fff`, secondary `#999`, tertiary `#777` ([SRC:G1]).
4. **One saturated accent, Framer Blue `#0099ff`.** It is used for focus, selection, primary actions and checked states ([SRC:F1], [SRC:G1], [USER-TOKENS]). **Purple** is reserved for components ([SRC:U10], [KNOW]). **Red `#ff3366`** marks destructive actions ([SRC:G6], [SRC:T1]).
5. **Depth is quiet.** Shadows are short and soft (`0 2px 4px rgba(0,0,0,.15)` on raised indicators). A top-lit 1 px inner highlight appears on raised elements in dark mode ([SRC:G3], [SRC:G4]). Floating chrome (toolbars, menus, popovers) carries the heavier shadow ([USER-TOKENS]).
6. **Density is medium-compact.** The rhythm is 30 px controls on a 40 px row pitch, 15 px gutters and 10 px gaps ([SRC:G3], [SRC:G5]). That is roomier than Figma's 32 px inspector rows, which pack fields edge to edge ([KNOW]).

---

## 2. Colour palette

### 2.1 Framer's semantic tokens with known fallback values

| Framer token ([SRC:F2]) | Dark | Light | Evidence |
| --- | --- | --- | --- |
| `--framer-color-bg` (panel and window background) | `#111111` | `#ffffff` | [SRC:G1]; modal `#111111` / `#ffffff` [SRC:G2] |
| `--framer-color-bg-secondary` | `#1d1d1d` | `#eeeeee` | [SRC:G1] (light "option" surface `#f5f5f5` per [SRC:G2]) |
| `--framer-color-bg-tertiary` (pre-3.0 control fill) | `#2b2b2b` | `#f3f3f3` | [SRC:G1], [SRC:T1]; dark option `#2b2b2b` [SRC:G2] |
| `--framer-color-control` (3.0 dark control fill) | **TBD** (probably near `#2b2b2b`) | (light controls use bg-tertiary) | Token exists from 3.0 ([SRC:F1] vs [SRC:F3]); no value seen |
| `--framer-color-control-hover` | **TBD** (dark button hover fallback `#282828` [SRC:G1]) | `#eeeeee` (button hover light [SRC:G1]) | [SRC:F1] |
| `--framer-color-divider` | `#252525` | `#eeeeee` | [SRC:G1], [SRC:G2] |
| `--framer-color-text` | `#ffffff` | `#333333` | [SRC:G1]; framer.css fallback `#333` [SRC:F1] |
| `--framer-color-text-secondary` | `#999999` | `#666666` | [SRC:G2]; dark `#999` also [SRC:G1] |
| `--framer-color-text-tertiary` | `#777777` ([SRC:G1]) or `#666666` ([SRC:G2]); the two sources **disagree** | `#999999` | [SRC:G1], [SRC:G2] |
| `--framer-color-text-reversed` | `#ffffff` | `#ffffff` | [SRC:G1] |
| `--framer-color-tint` | `#0099ff` | `#0099ff` | [SRC:F1], [SRC:G1] |
| `--framer-color-tint-dark` (hover) | `#0088ff` | `#0088ff` | [SRC:G1] |
| `--framer-color-tint-extra-dark` (pressed) | `#0077ff` | `#0077ff` | [SRC:F1] fallback |
| `--framer-color-tint-dimmed` | `rgba(0,153,255,.15)` | `rgba(0,153,255,.10)` | [SRC:G1]; framer.css fallback `.1` [SRC:F1] |

Other hard-coded values that recur in Framer-authored CSS:
- Pressed button: `#232323` (dark) / `#dddddd` (light) [SRC:F1]
- Slider fill: `#666` (dark, pre-3.0) / `#ccc` (light) [SRC:F1]
- 3.0 dark slider fill: `#707070` [SRC:G3]
- Slider rest track: `#444` / `#ddd` [SRC:G3]
- Stepper divider: `#444` / `#e6e6e6` [SRC:T1]
- Select chevron: `#999` (dark) / `#888` (light) [SRC:F1]
- Code area: `#141414` / `#fdfdfd` [SRC:G1]

### 2.2 Proposed Illigma token sheet, reconciled with the user's tokens

Rule used: if the user's value and Framer's evidence agree within about 2 % lightness, the user's value stands. Where they differ materially, Framer's evidence is proposed **as a recommendation for the user to confirm**. The user's value stays as the interim until the eyedropper samples in the [Verification needed](#verification-needed) section are in hand.

| Illigma token | Role | Dark (proposed) | Light (proposed) | Evidence and reconciliation |
| --- | --- | --- | --- | --- |
| `--ill-canvas` | Infinite-canvas background | `#090909` | `#f5f5f5` | Dark is [USER-TOKENS] `--canvas-void`; no Framer canvas sample exists. Light is [KNOW] approximate. **Verify both.** |
| `--ill-panel` | Docked panels, toolbar, modals | `#141414` (interim) | `#ffffff` | [USER-TOKENS] `--panel-surface #141414` against Framer `#111111` [SRC:G1, G2]. A 1.2 % lightness gap. Keep the user value until sampled. |
| `--ill-surface-2` | Hovered rows, segmented track, cards, popover body | `#1c1c1c` | `#eeeeee` | [USER-TOKENS] `--hover-active #1c1c1c` ≈ Framer `#1d1d1d` [SRC:G1]. Agree. |
| `--ill-control` | Input, select and button fill (idle) | `#2b2b2b` | `#f3f3f3` | Framer bg-tertiary [SRC:G1, T1]. **Changes** the user's field (`#1c1c1c` + `#292929` border): Framer controls are borderless and lighter. |
| `--ill-control-hover` | Control hover | `#333333` [KNOW] | `#eeeeee` [SRC:G1] | The dark control-hover value is unknown. Interim is one step above `--ill-control`. Verify. |
| `--ill-control-active` | Pressed | `#232323` | `#dddddd` | [SRC:F1] |
| `--ill-raised` | Segmented active indicator, toggle knob track | `#474747` | `#ffffff` + layered shadow | [SRC:G3] (3.0-era); `#555` in [SRC:G4, T1] (older). Use `#474747`. |
| `--ill-elevated` | Menus, dropdowns, popovers, color picker | `#1c1c1c` + `--ill-edge` | `#ffffff` + shadow | [KNOW] approximate. Menus read one step above the panel. Verify. |
| `--ill-tooltip` | Tooltip surface | `#222222` | `#222222` (tooltips stay dark in light mode [KNOW]) | [USER-TOKENS] `.tool-tip #222`. Verify. |
| `--ill-scrim` | Modal backdrop | `rgba(0,0,0,.5)` | `rgba(0,0,0,.2)` [KNOW] | Dark: Framer "black-dimmed" [SRC:G1]. [USER-TOKENS] used `#0009` + 5 px blur. Proposed: `.5`, blur optional. |
| `--ill-divider` | Panel and section separators | `#262626` | `#eeeeee` | [USER-TOKENS] `--border #262626` ≈ Framer `#252525` [SRC:G1]. Agree. |
| `--ill-edge` | 1 px edge of floating surfaces | `rgba(255,255,255,.06)` [KNOW] | `rgba(0,0,0,.06)` [KNOW] | Framer uses inset 1 px rings at `.03–.1` alpha on raised controls [SRC:F1, G3]. |
| `--ill-highlight-top` | Top-lit inner edge of raised and floating elements | `inset 0 .5px 0 rgba(255,255,255,.22)` | none | [USER-TOKENS] `--panel-highlight`; matches the Framer pattern (inset ring masked top→bottom) [SRC:G3]. |
| `--ill-text` | Primary text, values | `#ffffff` | `#333333` | [SRC:G1], [USER-TOKENS] |
| `--ill-text-strong` | Titles (light mode) | `#ffffff` | `#222222` | [SRC:G2] |
| `--ill-text-2` | Labels, secondary | `#999999` | `#666666` | [SRC:G1, G2]; [USER-TOKENS] `--text-muted #999`. Agree. |
| `--ill-text-3` | Placeholder, units, inactive tabs, disabled glyphs | `#777777` | `#999999` | [SRC:G1]; [USER-TOKENS] used `#777` ad hoc. Agree. Contrast note in §11. |
| `--ill-on-accent` | Text and icons on tint | `#ffffff` | `#ffffff` | [SRC:G1] |
| `--ill-accent` | Selection, focus, primary action, checked | `#0099ff` | `#0099ff` | [SRC:F1, G1], [USER-TOKENS]. Agree. |
| `--ill-accent-hover` | Primary hover | `#0088ff` | `#0088ff` | [SRC:G1]. **Replaces** the user's `#168ff0`. |
| `--ill-accent-pressed` | Primary pressed | `#0077ff` | `#0077ff` | [SRC:F1] |
| `--ill-accent-dim` | Selected row bg, text selection, marquee fill | `rgba(0,153,255,.15)` | `rgba(0,153,255,.10)` | [SRC:G1, F1] |
| `--ill-component` | Components, instances, component properties | `#8855ff` | `#8855ff` | [KNOW] approximate; purple is supported by [SRC:U10]. **Verify the hex.** |
| `--ill-component-dim` | Selected component row bg, chips | `rgba(136,85,255,.15)` | `rgba(136,85,255,.10)` | Derived, mirroring tint-dimmed |
| `--ill-danger` | Destructive | `#ff3366` | `#ff3366` | [SRC:G6, T1] |
| `--ill-danger-hover` | Destructive hover | `#ee1155` | `#ee1155` | [SRC:T1] (`#e15`) |
| `--ill-warning` | Warnings, missing fonts | `#ff9500` | `#ff9500` | [SRC:G7] excerpt |
| `--ill-success` | Success toasts, saved status | `#00cc88` | `#00b87a` | [SRC:G1] diff-add colours |
| `--ill-focus` | Focus ring | `#0099ff` | `#0099ff` | [SRC:F1] (inset 1 px on inputs) |
| `--ill-text-selection` | `::selection` in inputs | bg `--ill-accent-dim`, text `--ill-accent` | same | [SRC:F1] (3.0 change) |
| `--ill-code-bg` / `--ill-code-text` | Code and CSS blocks | `#141414` / `#eeeeee` | `#fdfdfd` / `#666666` | [SRC:G1] |

The canvas overlay colours are listed separately in §8.

---

## 3. Typography

| Use | Family | Size / line | Weight | Tracking | Colour | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Default UI text: property labels, layer names, menu items, inputs | Inter (variable 100–900) | 12 / 18 px (1.5) | **500** | 0 | text or text-2 | [SRC:F1] body: 12 px, line-height 1.5, weight 500 |
| Emphasis: section titles, buttons, active segment, active tab | Inter | 12 / 18 | **600** | 0 | text | [SRC:F1] buttons 600; [SRC:G4] active segment 600 |
| Small meta: split-input sub-labels ("T R B L"), size badges, measurement labels | Inter | 10–11 px | 500 | 0 | text-3 | [KNOW] approximate. Split inputs have labels below them [SRC:U1]. Verify the size. |
| Panel or modal title | Inter | 13 px [KNOW] | 600 | 0 | text | Verify |
| Numeric values in inputs | Inter + `tnum` | 12 | 500 | 0 | text | [SRC:F1] numeric and date inputs use `tnum` |
| Code (CSS export, code panels) | Input Mono (Framer); for Illigma use an OFL mono such as JetBrains Mono | 11 / 19 px | 400 | 0 | code-text | [SRC:G1] |

Rules:
- **Inter character variants: `cv01`, `cv05`, `cv09`, `cv11` are switched on everywhere in 3.0** ([SRC:F1], [SRC:G2], where they are gated as "prerelease" before launch). By Inter 4's feature naming ([KNOW]) these are the alternate 1, the "l" with a tail, the flat-top 3 and the **single-storey a**. Single-storey `cv11` needs **Inter ≥ 4.0**, so Illigma must bundle Inter 4.x locally (OFL; local-first, so no font CDN). The user's earlier prototype already bundled Inter.
- Rendering: `-webkit-font-smoothing: antialiased`, `font-synthesis: none` ([SRC:F1]; the user's tokens already have `font-synthesis: none`).
- **Letter-spacing 0.** framer.css sets none. The user's `0.05px` on headings is negligible; drop it.
- **No 400 weight in chrome.** Framer's body weight is 500. The user's tokens defaulted to 400 with 500/550 in places. Move the default to 500 and titles to 600; do not use 550, because a variable-font 550 renders differently across platforms.
- Long labels truncate with an ellipsis; values never wrap ([SRC:F1] `text-overflow: ellipsis` on controls).
- **Canvas text** (frame titles, measurement labels) never scales with zoom.

---

## 4. Spacing, sizing and density

| Token | Value | Evidence |
| --- | --- | --- |
| Base unit | **5 px** (scale 2, 5, 10, 15, 20, 30) | [SRC:G1, G2] `--spacing: 5px`. **Differs** from [USER-TOKENS] `--grid: 8px`. Recommend 5 px, because the user's own `--panel-padding: 15px` already sits on that grid. |
| Panel side gutter | **15 px** | [SRC:G3, G5, T1]; [USER-TOKENS] `--panel-padding: 15px`. Agree. |
| Gap between controls (horizontal and vertical) | **10 px** | [SRC:G3, G5, T1] |
| Control height (input, select, button, segmented, stepper, colour input) | **30 px** | [SRC:F1]; [USER-TOKENS] `.field` 30 px. Agree. |
| Property row pitch | **40 px** (30 px control + 5 px above and below) | [SRC:G3] |
| Property-row grid | `[label minmax(0,1.5fr)] [control minmax(62px,1fr)] [control minmax(62px,1fr)]`, column gap 10, label inset 15 | [SRC:G3, T1]. A one-control row spans columns 2–3. |
| Input inner padding | 0 8 px (select: 0 20 0 8 for the chevron) | [SRC:F1] (3.0 reduced this from 10 px [SRC:F3]) |
| Segmented inset | 2 px | [SRC:F1, G4] |
| List and menu item height (layers, pages, menus, search results) | **30 px** | [SRC:G2] `--item-height: 30px`. [USER-TOKENS] used 32 px layer rows and 36 px menu items. Recommend 30. |
| Panel or modal header height | **48 px** | [SRC:G2] `--header-height: 48px` |
| Checkbox and radio | 14 × 14 | [SRC:F1] |
| Colour swatch inside input | 22 × 22 | [SRC:G3] |
| Colour dot (lists, style rows) | 12 × 12 | [SRC:G5] |
| Icon sizes | 16 px (toolbar and panel actions), 14 px (inside rows and controls), 12 px (micro: checkmark, chevrons) | [SRC:F1] 14 px calendar and clock glyphs, 12 px checkmark, 8 px chevron. [USER-TOKENS] 16 px default and 18 px tools. |
| Tool button | 32 × 32, icon 18 | [USER-TOKENS] (no Framer measurement) |
| Left panel width | 240 px default, resizable | [USER-TOKENS]; Framer ≈ 240–260 [KNOW]. Verify. |
| Right panel width | 268 px interim; 260 is the Framer-like candidate | [USER-TOKENS] 268; [KNOW] approximate. Verify. At 260 px the grid gives roughly 86 px of label column and 64 px controls. |

**Density note.** Figma's inspector packs more fields into each row. Illigma keeps **Figma's complete field set and order** and uses Framer's 30/40 px rhythm. Where a Figma section would overflow the 3-column grid (for example X, Y and rotation), use 2-up or 3-up rows **without a left label**, with inline prefix glyphs. See Mapping principle M-4.

---

## 5. Corner radii

| Element | Radius | Evidence |
| --- | --- | --- |
| Inputs, selects, buttons, segmented track, steppers, colour input, cards | **8 px** | [SRC:F1, G3, G4, G5, T1]. **Differs** from [USER-TOKENS] (fields 5 px, buttons 5–6 px). Recommend 8 px. |
| Segmented indicator, inner chips, preview thumbnails | **6 px** | [SRC:G4, G5] |
| Checkbox, swatch in input, small badges | **4 px** | [SRC:F1, G3] |
| Radio, colour dot, avatar | 50 % | [SRC:F1, G5] |
| Image or preview containers | 10 px | [SRC:G3] |
| Floating toolbar | 12 px | [USER-TOKENS] |
| Menus, dropdowns, popovers | 10 px [KNOW], with items at 6 px | [USER-TOKENS] 9 px. Interim 10. Verify. |
| Tooltips | 6 px [KNOW] | [USER-TOKENS] 5 px. Verify. |
| Modals | 16 px | [USER-TOKENS] 16 px. Framer ≈ 12–16 [KNOW]. Verify. |
| Primary buttons | **8 px**, not pills | [SRC:F1]. [USER-TOKENS] `--pill-radius: 40px` was used for "Export" and "Add" pills. **Decision for the user (D-3):** Framer's chrome uses 8 px buttons; keep pills only if the user wants them as an Illigma signature. |
| Docked panels | 0 | [USER-TOKENS] |

---

## 6. Fills, borders, elevation and blur

- **Controls are fills, not outlines.**
  - Idle: `--ill-control`.
  - Hover: `--ill-control-hover`.
  - Focus: an inset ring `box-shadow: inset 0 0 0 1px var(--ill-accent)` ([SRC:F1]).
  - The user's bordered fields (`1px #292929`) become borderless.
- **Checkbox (dark):**
  - Unchecked: fill `--ill-control` with inset 1 px `rgba(255,255,255,.1)`.
  - Checked: tint fill with inset 1 px `rgba(255,255,255,.2)` and a white check of 1.75 px stroke with round caps and joins ([SRC:F1]).
  - Light mode: inset `rgba(0,0,0,.1)`.
- **Raised element (segmented indicator, dark):** `#474747` with inset 1 px `rgba(255,255,255,.03)`, plus a top-lit `rgba(255,255,255,.05)` ring masked from top to bottom ([SRC:G3]). Light: white with `0 0 0 1px rgba(0,0,0,.04), 0 1px 0 rgba(0,0,0,.04), 0 2px 4px rgba(0,0,0,.08)` ([SRC:G3]).
- **Floating chrome** (toolbar, menus, popovers, colour picker): `--ill-elevated` + 1 px `--ill-edge` + `--ill-highlight-top` + shadow `0 10px 30px rgba(0,0,0,.25)`, the user's `--panel-shadow` [USER-TOKENS]. For menus a tighter companion is proposed: `0 4px 12px rgba(0,0,0,.3)` [KNOW].
- **Tooltips:** `0 4px 12px rgba(0,0,0,.33)` ([USER-TOKENS] `#0005`).
- **Modals:** `0 20px 90px rgba(0,0,0,.6)` ([USER-TOKENS]).
- **Blur:** Framer uses `backdrop-filter: blur(10px)` over 50 % black for "clear" buttons on media ([SRC:T1]). Use backdrop blur **only** on small overlays over canvas or media, such as the zoom pill and on-canvas buttons. Docked panels and menus stay opaque for legibility and performance. Whether Framer 3.0 uses translucent "glass" panels is unknown: **verify**.

---

## 7. Iconography

**What the evidence shows** (Framer's own inline SVGs in [SRC:F1]):
- They are drawn on small native grids: 8 px chevron, 9 px resize grip, 12 px check, 14 px calendar and clock.
- **Strokes are 1.5 px** (1.75 px for the check) **at 1:1 pixel size**, with **round caps and round joins**.
- Corners are softly rounded: the calendar has `a2 2` corners on a 14 px grid.
- Colour is a single grey (`#999`, or `#888` in light mode), with an occasional **two-tone accent**: the top band of the calendar is filled at `opacity .3`.
- The glyphs are sized optically for 12 px text. ([SRC:F1])

**Style rules for Illigma's icon set:**
1. Outline style, 1.5 px on-screen stroke, round caps and joins, 2 px-ish corner rounding on 14–16 px grids. Glyphs are pixel-snapped at 1× and 2×.
2. **The default state is outline.** Use a filled variant or a 0.3-opacity fill for "on" or "selected" glyphs, for example the eye/eye-off pair, the lock, and the component diamond.
3. One colour per glyph (`currentColor`). Idle is text-2, hover is text, active or selected is accent. Component glyphs use `--ill-component`.
4. Layer-type icons (frame, group, section, component, instance, text, vector, image, boolean, slot) are 14 px in tertiary grey, or purple for components and instances.
5. Keep the optical sizes consistent: circles slightly larger than squares; plus and minus at 10 px inside a 16 px box.

**Candidate open-source sets (licenses, grids and stroke weights: [KNOW])**

| Set | License | Grid / native stroke | Fit to Framer's look | Notes |
| --- | --- | --- | --- | --- |
| **Lucide** (the user's earlier choice, [USER-TOKENS] `svg.lucide`) | ISC | 24 px / 2 px, round caps and joins | **Good.** Same geometry family: round, outline, softly cornered. | **Use `absoluteStrokeWidth` = 1.5 px.** The user's `stroke-width:1.6` at 16 px renders about 1.07 px on screen, thinner than Framer. Covers general UI; lacks design-tool glyphs. |
| **Phosphor** | MIT | 256 px; Regular ≈ 1 px at 16 px, Bold ≈ 1.5 px | Good. The *Duotone* weight reproduces Framer's 0.3-opacity two-tone accent. | Framer ships an official Phosphor plugin in `framer/plugins`. Broad coverage, including some design glyphs. |
| **Tabler** | MIT | 24 px / 2 px, adjustable | Good | Very large set. Slightly more geometric than Framer. |
| **Radix Icons** | MIT | 15 px; filled outlines ≈ 1 px | Medium: crisp at 1×, but lighter than Framer's 1.5 px | Made by a design-tool team (Modulz). Small set, about 300 icons. |
| Iconoir / Heroicons (outline) | MIT | 24 px / 1.5 px | Medium | Heroicons is too sparse for a design tool. |

**Recommendation:** Lucide (user-approved) at 1.5 px absolute stroke for generic UI, plus a **custom Illigma glyph set drawn on a 16 px grid at 1.5 px** for design-tool-specific icons: boolean ops, constraint glyphs, auto-layout direction, wrap and grid, the alignment matrix, vector tools (bend, paint bucket), the component and instance diamonds, variable "hexagon" chips, prototype triggers, and the layer-type icons. Lucide's 2 px-in-24 geometry scales to that grid cleanly.

---

## 8. Component-by-component specification

All values are dark mode unless stated. Light mode swaps tokens per §2.2.

### 8.1 Toolbar and tools

- **What Framer has:**
  - A top **Toolbar** with insert entry points, project name, active branch, Preview and Publish ([SRC:U7]). It was redesigned in May 2025 to add vector shapes and path tools ([SRC:U4]).
  - A separate **Canvas Toolbar**, a floating tool panel ([SRC:U11]), with the theme toggle ([SRC:U3]), a combined Plugins and Actions menu ([SRC:U5]), and the zoom controls ([SRC:U7]).
  - Its exact 3.0 layout, height and placement were **not verified**.
- **Illigma** keeps **Figma's tool set and grouping**: move/scale, frame/section/slice, the shape flyout, pen/pencil, text, comment, and actions ([KNOW]; Figma UI3 has a bottom tool strip [OBS]). It is presented in Framer's look:
  - **Surface:** a floating strip with `--ill-panel` fill, 12 px radius, 8 px padding, 8 px gap, `--ill-edge`, `--ill-highlight-top` and the floating shadow ([USER-TOKENS] `.toolbar`).
  - **Tool button:** 32 × 32, radius 6–8, 18 px glyph in text-2.
    - Hover: `--ill-control` fill and text-colour glyph.
    - Active: `--ill-accent` fill with a white glyph ([USER-TOKENS] `.tool.active`; Figma UI3 also fills active tools blue [KNOW]). Whether Framer fills the active tool or only tints the glyph is **unverified**.
  - **Flyout caret:** an 8 px chevron at the right of the tool (or below it), in text-3. On click, a menu opens ([§8.9](#89-menus-and-context-menus)) listing the tools with their shortcuts.
  - **Dividers:** 1 × 24 px `--ill-divider`.
- **Insert / Assets entry (Framer "Insert"):** Framer's Insert Panel presents categories plus thumbnail previews, in light and dark ([SRC:U9]), and ⌘K offers quick insert ([SRC:U9]). In Illigma this styling applies to **Figma's** Assets tab and the Resources (⇧I) flow, plus the quick-actions palette ([KNOW] Figma ⌘K / ⌘/). The style is a category list at 30 px rows, a thumbnail grid with 8 px cards on `--ill-surface-2` with 10 px gaps, and a search field (30 px control, 14 px search glyph inset 8 px, text-3 placeholder) ([SRC:G5] layout).
- **Decision D-1 (for the user): toolbar placement.**
  - Option A (interim default, [USER-TOKENS]): the user's last prototype had **no top bar**; document controls lived in the sidebars and the tools sat in a floating bottom strip. This matches Figma UI3's placement [OBS].
  - Option B (Framer layout): a full-width top bar of about 48 px [KNOW] plus a floating canvas toolbar.
  - Either way, the controls and behaviors are Figma's.

### 8.2 Left panel: tabs, pages, layers, assets

- **Tabs.** Framer: Pages / Layers / Assets ([SRC:U7, U8]). **Illigma keeps Figma's structure**: File and Assets tabs, a Pages list and a Layers tree in the File tab ([OBS], [KNOW]). It is styled as Framer text tabs:
  - 12 px, active **600 text**, inactive 500 text-3, hover text-2.
  - No pill and no underline ([KNOW] approximate). The user's old 2 px accent underline is an alternative. **Verify.**
  - Header row is 48 px ([SRC:G2]).
- **Section headers** ("Pages", "Layers"): 12 px 600 text with right-aligned 16 px action icons (+, search, collapse) in text-3, hovering to text. The header row is 30–40 px.
- **Layer row:** 30 px tall ([SRC:G2]), 12 px / 500, name in `--ill-text`.
  - 14 px type icon in text-3; 12 px disclosure chevron; indentation 12–16 px per level [KNOW]. Rows have a 6 px radius with 5 px horizontal inset, so the highlight floats inside the panel [KNOW].
  - Hover: `--ill-surface-2`. The eye and lock actions fade in at the right edge: 20 × 20 hit area, 14 px glyph, text-2.
  - Selected: `--ill-accent-dim` background, with icon and chevron in accent and the name in `--ill-text` (interim). The user's earlier prototype used a solid `#0D99FF`, Figma's style. **Verify Framer's treatment.**
  - Children of a selected container: a lighter `rgba(0,153,255,.06)` band (Figma shows a lighter band [KNOW]).
  - Component, instance and slot rows: name and icon in `--ill-component`; selected uses `--ill-component-dim` ([SRC:U10] purple; [KNOW]).
  - Hidden: name and icon at 50 % opacity ([USER-TOKENS]). Locked: lock glyph stays visible.
  - Drop indicator: a 2 px accent line with a 6 px accent circle at the insertion depth; drop-into shows a 1 px accent ring on the target row ([KNOW]).
  - Inline rename: the row becomes a 24 px input on `--ill-control` with an accent focus ring.
- **Page rows:** 30 px; active page 600 text with a `--ill-surface-2` fill; the others are 500 text-2 ([USER-TOKENS] page-row pattern). The page divider (Figma "---" pages) is a 1 px divider row.
- **Assets list:** components shown as 8 px-radius thumbnail cards or 30 px list rows; style rows show a 12 px colour dot ([SRC:G5]) or text-style "Ag" glyph; purple accent for components ([SRC:U10]).

### 8.3 Right properties panel: tabs and sections

- **Tabs:** Framer 3.0 has Style and Agent ([SRC:N2]). Illigma has **Figma's Design and Prototype tabs** ([OBS]), plus Figma's zoom/view control if retained. The tab style is the same as §8.2.
- **Section:** a 1 px `--ill-divider` on top, 15 px gutters and 10 px vertical padding.
  - Header: a 30 px row with a 12 px **600** title on the left and actions on the right (16 px glyphs in text-3: "+" add, "−" remove, an options icon, "style/variable" chips).
  - Body rows sit on the 40 px pitch ([SRC:G3]).
- **Empty / additive sections** (Fill, Stroke, Effects, Export, Layout guide): the title is in text-2 and a "+" sits on the right. Clicking "+" adds the first row and turns the title to text (a Framer-style progressive section; Figma's behavior is the same idea [KNOW]).
- **Collapsible sections:** an optional 12 px chevron before the title that rotates 90° over 150 ms. Collapse state is per user and does not change the document.
- **Property row (label + control):** label in text-2 at 12/500, ellipsized, with a 15 px inset ([SRC:G3, T1]). Controls fill columns 2–3 per §4.

### 8.4 Inputs

- **Text and number input:** 30 px tall, 8 px radius, `--ill-control` fill, no border, 0 8 px padding, 12/500 text, `tnum` for numbers ([SRC:F1]).
  - Placeholder in text-3.
  - Focus: inset 1 px accent ring; the caret is white in dark mode ([SRC:F1]).
  - Text selection: accent-dim background with accent text ([SRC:F1]).
- **Prefix glyph or letter** (X, Y, W, H, rotation, radius, gap…): 12 px in text-3, 8 px from the left edge. The input text starts at 28–30 px ([SRC:T1] `withIcon` uses 30 px padding with the icon at 10 px).
- **Unit suffix** (%, px, °) in text-3.
- **Scrubbing:** dragging the prefix glyph or label scrubs the value with an `ew-resize` cursor. **Split inputs scrub via the label below** ([SRC:U1]). The *behavior* (step sizes, ⇧ ×10, ⌥ fine control, and so on) follows Figma, which needs live verification.
- **Mixed values:** text "Mixed" in text-2 ([KNOW]; the string and behavior follow Figma).
- **Stepper (Framer's − | + pair):** 30 px, `--ill-control` track, two halves split by a 1 px `#444` divider at 50 % height, glyphs in `#999` ([SRC:T1]). Use it only where Figma has a stepper-like control, for example the grid count. **Do not add steppers that Figma lacks.**
- **Select / dropdown:** the same box as an input, padding 0 20 0 8, with an 8 px chevron (1.5 px stroke, round) at right 8 px in `#999` ([SRC:F1]). It opens a menu (§8.9), not a native select.
- **Textarea:** 8 px padding, minimum 30 px, resize grip in `#555` ([SRC:F1]).
- **Disabled:** 50 % opacity, default cursor ([SRC:F1]).

### 8.5 Segmented controls and toggles

- **Segmented:** a 30 px track on `--ill-surface-2` or `--ill-control` with radius 8 and a 2 px inset ([SRC:G3, G4]).
  - Indicator: radius 6, `--ill-raised` with the top-lit edge in dark mode; white with a layered shadow in light mode ([SRC:G3]).
  - Labels or 14 px glyphs: inactive 500 text-3, hover text-2, active **600 text** in dark mode or **600 accent** in light mode ([SRC:G4, G3]).
  - Motion: the indicator slides in 200 ms `cubic-bezier(0.2,0,0,1)` and label colours ease over 200 ms ([SRC:G4]). One plugin uses 150 ms `ease` ([SRC:G3]); standardize on 200 ms.
- **Booleans:** Framer favours **Yes/No segmented controls** for boolean properties in its panel ([KNOW], verify). Illigma uses the **control type Figma uses** — a checkbox for "Clip content" [OBS], a toggle for "Show in exports" [KNOW] — styled per §6. A switch, where Figma has one, is 28 × 16 with a 12 px white knob, an accent "on" track, a `--ill-control` "off" track, and 150 ms motion ([KNOW] approximate).
- **Checkbox / radio:** 14 px, per §6 ([SRC:F1]).

### 8.6 Colour swatch inputs (fills, strokes, effect colours)

- **Row:** a 30 px control, radius 8, with:
  - a 22 px swatch (radius 4, inset 1 px `rgba(0,0,0,.05)`) at 4 px from the left;
  - an 8 px gap, then the **uppercase hex** in text, 12/500 ([SRC:G3]);
  - then **Figma's** opacity field (`%` in text-3), separated by a 1 px divider;
  - then the row actions outside the control: eye (visibility) and "−" (remove), as 16 px glyphs in text-3.
- **Swatch states:**
  - transparent: an 8 px grey/white checkerboard under the colour;
  - gradient or image: a thumbnail;
  - mixed: a "Mixed" label;
  - bound to a style or variable: a chip replaces the hex (§8.8).
- **"None" / placeholder:** text-3 ([SRC:G3]). The erase "×" affordance is 24 px wide on the right ([SRC:G3]), used only where Figma allows clearing.

### 8.7 Add and remove affordances, lists of paints and effects

- "+" (add) and "−" (remove): 16 px glyphs in 24 px hit boxes, text-3 → text on hover, with a `--ill-control` hover fill (radius 6).
- Reorder handle (6-dot grip): 12 px in text-3, visible on row hover.
- Visibility eye: always visible when a row is hidden (at 50 % opacity on the row), otherwise on hover.
- New rows animate open over 150 ms (height + opacity); removed rows collapse over 150 ms.

### 8.8 Chips: styles, variables, component properties

- **Style or variable binding** (Figma): a chip inside the control, `--ill-surface-2` fill or `--ill-control-hover`, radius 6, height 22, with a 12 px glyph (style or variable hexagon) and the name in 12/500 text. Hover shows a detach glyph. Neutral colour, so it stays distinct from components.
- **Component-property binding** (Figma `componentPropertyReferences` [API]): the same chip shape in `--ill-component-dim` with `--ill-component` text and glyph. Purple stays reserved for component concepts ([SRC:U10]).
- **Instance-swap / slot preferred values:** purple chips.

### 8.9 Menus and context menus

- **Surface:**
  - `--ill-elevated`, radius 10, padding 5, `--ill-edge` + `--ill-highlight-top` + floating shadow.
  - Minimum width 180 px; maximum height is the viewport minus 16 px, with internal scroll.
- **Item:** 30 px tall ([SRC:G2]), radius 6, 0 10 px padding, 12/500 text.
  - Leading 14 px glyph or checkmark column (14 px, accent check). Trailing shortcut in text-3 using the platform's symbols (⌘⇧⌥⌃). Submenu chevron at 8 px.
  - Hover and keyboard highlight: **`--ill-accent` fill, white text and shortcuts** ([KNOW]; macOS-like. Verify Framer, because a neutral `--ill-control` highlight is the alternative.)
  - Disabled: text-3, no highlight.
  - Destructive item: `--ill-danger` text; on highlight, a danger fill with white text.
- **Separators:** a 1 px `--ill-divider` with 5 px vertical margin. Section labels: 11 px 600 text-3.
- **Selection confirmation:** when an item is chosen, the highlight **blinks once** (about 2 × 60 ms) before the menu closes ([SRC:U1] "confirmation animation on menu selections"; the timing is [KNOW]).
- **Open and close:** 120 ms fade + 4 px slide from the anchor (`cubic-bezier(0.2,0,0,1)`); close is 80 ms fade ([KNOW] approximate).
- The **menu content is always Figma's**: the context menu items and order, and the main menu structure.

### 8.10 Tooltips

- **Surface:** `--ill-tooltip`, radius 6, padding 5 × 8, 12/500 text.
- **Shortcut hint:** right-aligned with a 10 px gap, in text-3 (for example "Frame  F"). The user's old tooltip had an 18 px gap and `#888`.
- Offset 6 px from the anchor; no arrow ([KNOW]).
- **Timing:** about 500 ms delay on first hover and 0 ms while moving across adjacent tools within 1 s; fade in over 100 ms ([KNOW] approximate; verify with a screen recording).

### 8.11 Modals, dialogs and toasts

- **Modal:**
  - `--ill-panel` (Framer modal `#111`/`#fff` [SRC:G2]), radius 16 ([USER-TOKENS]), the modal shadow, and `--ill-scrim` behind.
  - Header 48 px ([SRC:G2]) with a 13 px 600 title and a close "×" at the right (16 px, text-3).
  - Body padding 15–20 px. Footer buttons are 30 px with radius 8: the primary is accent, the secondary is `--ill-control`, and a destructive one is `--ill-danger`.
  - Opens over 150 ms (fade + scale from 0.98) and closes over 100 ms.
- **Toast / notification:** four variants: info, success, warning, error ([SRC:D1]).
  - A dark pill-ish card: `#222`, radius 10, 12/500 text, an optional action button and a leading 14 px status glyph in success/warning/danger colour.
  - Bottom centre, 20 px above the toolbar; auto-dismiss about 3 s ([SRC:D1] example `durationMs: 3000`). The user's old toast used `#242424` with a `#3b3b3b` border and radius 9.

### 8.12 Sliders (only where Figma uses them, for example in the colour picker)

- **3.0 style:** a 3 px track, radius 2, a 12 px white thumb with `0 1px 3px rgba(0,0,0,.2), 0 .5px 0 rgba(0,0,0,.1)`, fill `#707070` in dark (accent in light), rest track `#444`/`#ddd` ([SRC:G3]).
- **Hue and alpha strips:** 10–12 px tall with radius 6 and a 12 px ring thumb (2 px white with a shadow). Checkerboard under the alpha strip.

### 8.13 Scrollbars

Thin, overlay-style: a 6 px thumb `rgba(255,255,255,.15)` on a transparent track, shown on scroll or hover ([KNOW]; [USER-TOKENS] `scrollbar-color #353535 transparent`).

---

## 9. Canvas chrome

Figma decides **when** each overlay appears and what it means. This section defines only colours and stroke treatments. All strokes are screen-space and do not scale with zoom.

| Overlay | Proposed style | Evidence |
| --- | --- | --- |
| Selection bounds | 1 px `--ill-accent` (`#0099ff`) | [SRC:U11] "Framer Blue" selection outline; [USER-TOKENS] |
| Resize handles | 8 × 8 squares [KNOW], white fill, 1 px accent stroke, radius 1 | [USER-TOKENS] `.selection-handle`. **Verify** Framer's handle shape and size. |
| Rotation zones | Invisible, 12 px outside the corners; the rotate cursor shows on hover (Figma behavior) | [KNOW] |
| Hover outline | 1 px `--ill-accent`. Component and instance hover uses 1 px `--ill-component`. | [KNOW] |
| Multi-selection | Each item gets a 1 px accent outline; group bounds 1 px accent with handles | [KNOW] (behavior follows Figma) |
| Marquee | Fill `--ill-accent-dim` at about 7 %, 1 px accent stroke | [USER-TOKENS] `#0099ff12` |
| Size badge under the selection ("W × H") | An accent pill, radius 4, 11/600 white text, 4 px below the bounds | [KNOW] (Figma shows a blue size label [KNOW]) |
| Frame / section titles | 11–12 px / 500 text-2 above the top-left corner; on hover and select they turn accent (purple for components) | [KNOW] approximate |
| Smart guides (alignment) | 1 px lines in **TBD** (interim `#ff3366`, Framer red) | No Framer evidence. **Verify.** |
| Distance / measurement (⌥-hover) | 1 px lines plus a pill label (radius 4, 11/600 white on the guide colour) | Colour **TBD**, as for guides |
| Equal-spacing indicators | Pink hatch blocks with numeric pills | Colour **TBD** |
| Auto-layout padding and gap overlays | Hatched fill at about 15 % alpha in the guide colour; the gap handles are 1 × 8 px bars | **TBD.** Figma uses pink [KNOW]. Framer stack visualisation unverified. |
| Vector edit: anchor points | 7 px circles: white fill + 1 px accent stroke; selected = accent fill + white stroke | [USER-TOKENS] `.anchor-point` |
| Vector edit: Bézier handles | 1 px accent line + 5 px accent dot | [USER-TOKENS] `.anchor-line`/`.anchor-control` |
| Text editing | Caret 1 px accent (or text colour); selection `--ill-accent-dim` | [SRC:F1] selection colours |
| Component / instance selection | 1 px `--ill-component` outline and handles; component title in purple | [SRC:U10] purple; [KNOW] |
| Prototype connections (Figma-only "noodles") | 2 px `--ill-accent` curves with a 7 px start dot and an arrowhead; hotspot outline 1 px accent; selected connection 3 px | [KNOW]; no Framer equivalent (see M-6) |
| Layout grids (Figma) | **Document data, not chrome.** Render with the grid's own `color` from `LayoutGrid` [API]. Defaults follow Figma (red at about 10 % [KNOW]). | [API] `layoutGrids` |
| Rulers and guides (Figma) | Ruler 20 px on `--ill-panel`, ticks text-3, labels 10 px; guides 1 px in TBD guide colour, selected guide accent | [KNOW]; `guides` [API] |

---

## 10. States

| State | Treatment | Evidence |
| --- | --- | --- |
| Hover (control) | Fill → `--ill-control-hover` | [SRC:F1] |
| Hover (row or ghost button) | Fill → `--ill-surface-2`; glyph text-3 → text | [USER-TOKENS] |
| Pressed | Fill → `--ill-control-active` (`#232323`) / accent → `#0077ff` | [SRC:F1] |
| Focus (inputs) | `inset 0 0 0 1px --ill-accent` | [SRC:F1] |
| Focus-visible (keyboard, non-inputs) | 2 px accent outline, 2 px offset | [USER-TOKENS]. Kept for accessibility (M8), because Framer's button focus only changes the fill ([SRC:F1]). |
| Selected / on | Accent-dim fill + accent glyph (rows); raised indicator (segmented); accent fill (tools, checkboxes) | [SRC:F1, G4], [USER-TOKENS] |
| Disabled | 50 % opacity (radio 30 %), default cursor, no hover | [SRC:F1] |
| Mixed | "Mixed" text-2 / indeterminate checkbox (accent fill + white 8 px dash) | [KNOW] |
| Error / invalid | 1 px inset `--ill-danger` ring; value reverts on blur (Figma behavior) | [KNOW] |
| Drag-over | 2 px accent indicator | [USER-TOKENS] |

---

## 11. Motion and micro-interactions

| Interaction | Duration | Easing | Evidence |
| --- | --- | --- | --- |
| Button and control background change | 200 ms | ease | [SRC:F1] `transition: background-color 0.2s` |
| Segmented indicator slide; label colour | 200 ms | `cubic-bezier(0.2, 0, 0, 1)` | [SRC:G4] |
| Card or row hover overlay | 100 ms | ease-out | [SRC:G5] |
| Panel content fade-in | 150 ms | `cubic-bezier(0.5, 0, 0.5, 1)` | [SRC:G1, G2] |
| Spinner | 800 ms per turn | linear | [SRC:F1] |
| Menu open / close | 120 / 80 ms | `cubic-bezier(0.2,0,0,1)` / ease-out | [KNOW] approximate |
| Menu-selection confirmation blink | about 120 ms total | step | [SRC:U1] (existence); [KNOW] (timing) |
| Section collapse; row insert/remove | 150 ms | `cubic-bezier(0.2,0,0,1)` | [KNOW] |
| Tooltip | 500 ms delay, 100 ms fade | ease-out | [KNOW] |
| Canvas overlays (selection, guides) | **0 ms.** Never animate canvas feedback; it must track the pointer 1:1. | Design rule (Figma-parity feel) |

- **Reduced motion:** honour `prefers-reduced-motion`. Durations drop to 0 except opacity fades of 100 ms or less.
- **No layout-property animation** in panels at scale. Animate transform and opacity; animate height only for single-section collapse.

**Contrast check** (computed for M8):

| Pair | Ratio | Result |
| --- | --- | --- |
| `#999` on `#111` | 6.6 : 1 | Pass |
| `#777` on `#111` | 4.2 : 1 | Below AA for 12 px text |
| `#777` on `#141414` | 4.1 : 1 | Below AA for 12 px text |
| `#999` on `#2b2b2b` | 5.0 : 1 | Pass |
| White on `#0099ff` | 3.0 : 1 | Fails AA for 12 px text |
| `#999` on white (light tertiary) | 2.8 : 1 | Fails |

Restrict tertiary grey to placeholders, units, disabled text and decorative glyphs. M8 must decide whether to raise them (the user's call, since it departs from Framer).

---

## 12. What Framer 3.0 changed

Only the changes evidenced by the 3.0 plugin styles and release notes:

- Inter alternates `cv01`/`cv05`/`cv09`/`cv11` are now global ([SRC:F1, F4, G2]).
- New `::selection` colours: accent-dim background with accent text ([SRC:F1]).
- Input padding is 8 px (was 10) ([SRC:F1] vs [SRC:F3]).
- Checkbox is 14 px with inset-ring styling (was 12 px with a border) ([SRC:F1] vs [SRC:F3]).
- A dedicated dark **`--framer-color-control`** token for control fills ([SRC:F1, F2]).
- Sliders have a 3 px track and a 12 px thumb, with a grey (not blue) fill in dark mode ([SRC:G3]).
- The right panel splits into **Style** and **Agent** tabs ([SRC:N2]).
- The toolbar shows the **active branch** ([SRC:U7]).
- Everything else about 3.0's look (panel colours, toolbar layout, glass or no glass) is **unverified**.

---

## Mapping principles

How Framer's look is applied to Figma's richer set of controls **without changing their function**.

- **M-1. Function first, then skin.** Every control, option, enum, default, keyboard path and order comes from Figma ([API], help docs, [OBS]). The Framer skin may change only colour, type, radius, spacing, iconography, elevation and motion. It must never remove, merge, rename or reorder a Figma option. Section names stay **Figma's**: Position, Layout, Appearance, Fill, Stroke, Effects, Layout guide, Export [OBS].
- **M-2. One control vocabulary.** Every Figma control maps to one of the Framer primitives in §8:

  | Primitive | Shape |
  | --- | --- |
  | input | 30 px fill, radius 8 |
  | select | input + chevron |
  | segmented | track + raised indicator |
  | checkbox / radio | 14 px |
  | stepper | − \| + pair |
  | swatch input | 22 px swatch + hex |
  | chip | 22 px, radius 6 |
  | icon button | 24 px hit box, 16 px glyph |
  | menu | elevated surface, 30 px items |
  | popover | elevated surface |

  No bespoke one-offs unless the control has no analogue (M-5).
- **M-3. Colour semantics are fixed across the app.**
  - **Blue** = selection, focus, primary, checked, and prototype connections.
  - **Purple** = components, instances, variants, component properties and slots.
  - **Neutral chips** = styles and variables.
  - **Red** = destructive and errors.
  - **Orange** = warnings (missing fonts, detached or outdated library items).
  - **Green** = success.
  - Document colours (layout grids, fills, guides as data) are **data** and render exactly as stored.
- **M-4. Density adapter.**
  - Framer rows use a left label column. Use it for **single-concept rows** (for example "Opacity", "Radius", "Blend", "Clip content").
  - Figma's multi-field rows (X/Y, W/H, min/max, padding T/R/B/L, the typography metrics grid) **drop the left label** and use full-width 2-up or 4-up inputs with prefix glyphs, keeping the 30 px height, 10 px gaps and 15 px gutters.
  - **Split-input sub-labels sit below the fields** in 10–11 px text-3 and are scrubbable ([SRC:U1]).
- **M-5. Figma controls with no Framer analogue.** These are styled with Framer primitives:
  - **Constraints widget** (`constraints.horizontal/vertical: ConstraintType` [API]): a 64 × 64 `--ill-control` square, radius 8, holding an inner 24 px square (1 px text-3 stroke, radius 2) and four edge ticks plus two centre crosshair ticks (2 px, text-3, radius 1). Hover → text-2; active → accent. Next to it, two selects (Horizontal, Vertical) carry the full enum labels Figma uses (Left, Right, Left & right, Center, Scale).
  - **Auto-layout alignment 3×3 matrix** (`primaryAxisAlignItems` / `counterAxisAlignItems` [API]; 9-position grid [OBS]): a 64–84 px `--ill-control` square, radius 8, holding 3×3 cells.
    - Idle cell: a 3 px text-3 dot.
    - Hover cell: a preview glyph of three bars in text-2 showing the resulting alignment, as Figma does ([KNOW]).
    - Active cell: the same bars in accent.
    - SPACE_BETWEEN / baseline states: the bars draw spread or baseline-aligned.
    - The user's old glow on the active dot is dropped, because Framer uses no glows.
  - **Layout mode** (`layoutMode: NONE|HORIZONTAL|VERTICAL|GRID` [API]) and **wrap**: a segmented control with 14 px glyphs.
  - **Gap and padding fields:** inputs with prefix glyphs. "Auto" gap is a select option shown as the text "Auto".
  - **Sizing** (Fixed/Hug/Fill) and **min/max:** a select inside the W/H inputs, as a right-aligned 8 px chevron zone (Figma's behavior; Framer's look).
  - **Layout grids / guides list:** rows like paint rows (§8.6) with a 16 px grid-type glyph instead of a swatch, the settings popover on click, the eye, and "−".
  - **Vector edit mode:** a contextual floating strip (same surface as the toolbar) with Figma's vector tools (bend, paint bucket, etc. [KNOW]) and canvas styling per §9.
  - **Boolean operations:** a split button (glyph + chevron) opening a menu of the four Figma ops plus Flatten, with custom 16 px glyphs.
  - **Variables table / collections** (M6): a full-height modal or panel styled like a data table.
    - Header row 30 px with 12/600 text-2.
    - Body rows 30–40 px with 1 px `--ill-divider` lines.
    - Mode columns min 160 px; editable cells become inputs with the accent inset ring on focus.
    - Group tree on the left uses layer-row styling.
    - Neutral chips for aliases.
  - **Component properties panel** (`componentPropertyDefinitions`, types BOOLEAN/TEXT/INSTANCE_SWAP/VARIANT/SLOT [API]): a purple-accented section; property rows with purple 14 px type glyphs, plus purple chips for bindings (§8.8). The variant picker uses selects; boolean properties use Figma's toggles.
  - **Prototype panel** (`reactions`, `Trigger`, `Action`, `Navigation` [API]): interaction cards on `--ill-surface-2`, radius 8, 10 px padding, with selects for trigger, action, destination and animation. Easing curves are drawn as a 1.5 px accent curve preview on a 64 px `--ill-control` canvas. Noodles per §9.
  - **Color picker** (M2): an elevated popover, 240 px wide, radius 10.
    - Square picker: radius 6, 12 px ring thumb.
    - Hue and alpha strips per §8.12.
    - The format select (Hex/RGB/HSL/HSB/CSS) is a select.
    - Values are inputs.
    - Document swatches are 16 px squares, radius 4, on a 10 px grid.
    - Paint-type picker tabs (Solid, Gradient, Image, Video, Pattern, Shader, as Figma shows them in [OBS]) use a segmented control with glyphs.
    - Custom / Libraries tabs use text tabs.
  - **Effects** (`Effect` union incl. GLASS/NOISE/TEXTURE, PROGRESSIVE blur [API]): rows like paint rows with an effect-type select and a settings popover; every Figma parameter is kept.
  - **Export settings:** rows with a scale select, a format select and a suffix input; the primary "Export …" button is 30 px accent, full width.
- **M-6. Figma-only canvas concepts get Framer-calm visuals.** Prototype noodles, section titles, slices, annotations and measurements, and dev-status badges use the §9 palette with thin (1–2 px) strokes, 11–12 px labels, small radii and no glows or gradients.
- **M-7. Light theme parity.** Every mapped control must have its light-mode tokens before M0 exit. Two light-only rules:
  - The light segmented indicator is white with an accent label ([SRC:G4]).
  - Tooltips stay dark ([KNOW]).
- **M-8. Never let the skin hide state.** If a Framer-like minimal treatment would hide a Figma state (mixed values, overridden instance properties, detached styles, missing fonts, invalid values), add a visible indicator using the same primitives:
  - overridden property → a 4 px purple dot before the label;
  - detached → a neutral chip with a detach glyph;
  - missing font → an orange warning glyph.
- **M-9. Shortcuts shown are Figma's.** Tooltips and menus show Figma's shortcuts, never Framer's. For example, Framer's ⌃⌘N theme toggle is **not** copied unless Figma has the same binding.

### Open design decisions for the user

| Id | Decision | Options | Interim |
| --- | --- | --- | --- |
| D-1 | Toolbar placement | A: floating bottom strip, no top bar ([USER-TOKENS], Figma UI3 placement [OBS]). B: Framer-style top bar plus floating canvas toolbar. | A |
| D-2 | Selected layer-row style | Accent-dim fill (Framer-calm, interim) or solid accent fill (Figma-like, the user's old prototype) | Accent-dim |
| D-3 | Primary button radius | 8 px (Framer evidence) or 40 px pills ([USER-TOKENS]) | 8 px |
| D-4 | Field style | Borderless `#2b2b2b` fills (Framer evidence) or bordered `#1c1c1c` + `#292929` ([USER-TOKENS]) | Borderless |
| D-5 | Spacing base | 5 px (Framer evidence; matches the user's 15 px gutter) or 8 px ([USER-TOKENS]) | 5 px |
| D-6 | Panel bg | `#141414` ([USER-TOKENS]) or `#111111` (Framer fallback) | `#141414` until sampled |
| D-7 | Tertiary text contrast | Framer-faithful `#777` or AA-safe `#8a8a8a` | `#777`, flagged for M8 |

---

## 13. Visual acceptance checklist

All items are **Not started**. "Framer reference" means the screenshots and measurements requested in [Verification needed](#verification-needed).

- [ ] **FVR-001** Theme tokens defined for dark and light — every token in §2.2 exists in both themes; switching theme swaps them all in one frame with no un-themed surfaces. _Data:_ `--ill-*` tokens; theme `dark|light` _Test:_ toggle the theme on a fixture showing every §8 primitive; pixel-diff each against the Framer reference crops; no hard-coded colour outside tokens (lint). _M0·P0·[SRC:F2, G1, G2], [USER-TOKENS]_
- [ ] **FVR-002** Inter 4 bundled locally with `cv01 cv05 cv09 cv11` — chrome text renders a single-storey "a", a tailed "l" and a flat-top "3"; no network font fetch. _Data:_ `font-feature-settings` _Test:_ render "a l 1 3" in a panel label offline; compare glyph shapes with a Framer 3.x crop. _M0·P0·[SRC:F1, G2], [KNOW]_
- [ ] **FVR-003** Base text style 12/18 at weight 500 — all labels, values and menu items are 12 px, line-height 18 px, weight 500, tracking 0. Titles and active states are 600. _Data:_ type tokens _Test:_ computed-style audit of 20 random chrome nodes. _M0·P0·[SRC:F1]_
- [ ] **FVR-004** Numeric inputs use tabular figures — values do not shift width while scrubbing. _Data:_ `tnum` _Test:_ scrub X from 0 to 1111; the text box width is constant. _M0·P1·[SRC:F1]_
- [ ] **FVR-005** Control geometry — inputs, selects, buttons, segmented controls, steppers and colour inputs are 30 px tall with an 8 px radius, borderless, and use the `--ill-control` fill. _Data:_ size and radius tokens _Test:_ measure in devtools; overlay on a Framer 2× crop with a tolerance of ±1 px. _M0·P0·[SRC:F1, G3, G4]_
- [ ] **FVR-006** Input focus ring — focused inputs show an inset 1 px accent ring and accent-dim text selection; no outer glow. _Test:_ tab into W; compare with the Framer focus crop. _M0·P0·[SRC:F1]_
- [ ] **FVR-007** Keyboard focus-visible on non-inputs — buttons, tabs and rows show a 2 px accent outline only for keyboard focus, never for mouse focus. _Test:_ Tab vs click on a tool button. _M0·P0·[USER-TOKENS]_
- [ ] **FVR-008** Property-row grid — single-concept rows use the 1.5fr / 1fr / 1fr grid, 10 px gap, 15 px label inset, 40 px pitch. _Test:_ measure the Opacity row; compare with the Framer properties-panel crop. _M0·P0·[SRC:G3, T1]_
- [ ] **FVR-009** Multi-field rows without a left label — X/Y, W/H and padding rows use full-width 2-up or 4-up inputs with prefix glyphs per M-4, keeping 30 px controls and 10 px gaps. _Test:_ layout snapshot at 240, 268 and 320 px panel widths; no truncation of 5-digit values. _M1·P0·[KNOW]_
- [ ] **FVR-010** Segmented control look and motion — 2 px inset; a radius-6 raised indicator (`#474747` dark, white light); active label 600 (accent in light); the indicator slides 200 ms `cubic-bezier(0.2,0,0,1)`. _Test:_ 60 fps capture of a switch compared with a Framer recording; frame count 11–13. _M0·P0·[SRC:G3, G4]_
- [ ] **FVR-011** Checkbox and radio — 14 px; radius 4 or circle; checked = accent fill with a 1.75 px white check; dark inset rings as specified. _Test:_ render both states in both themes; diff against Framer plugin checkboxes. _M0·P1·[SRC:F1]_
- [ ] **FVR-012** Select chevron — an 8 px chevron with 1.5 px round stroke in `#999`/`#888`, 8 px from the right; the menu opens in Illigma's own menu, not a native one. _Test:_ visual crop compare; menu is a DOM menu. _M0·P1·[SRC:F1]_
- [ ] **FVR-013** Colour swatch input — 22 px radius-4 swatch at 4 px inset, uppercase hex, opacity % field after a divider; a checkerboard shows under translucent colours. _Data:_ `Paint.color`, `Paint.opacity` [API] _Test:_ show a 50 % red fill; compare the layout with Framer's colour input crop. _M2·P0·[SRC:G3]_
- [ ] **FVR-014** Disabled state — 50 % opacity, default cursor, no hover change. _Test:_ disable the baseline control [OBS]; hover; no fill change. _M0·P1·[SRC:F1]_
- [ ] **FVR-015** Primary, secondary and destructive buttons — accent `#0099ff` → hover `#0088ff` → pressed `#0077ff`; secondary uses the control fill; destructive `#ff3366` → hover `#ee1155`; label 600 white. _Test:_ state screenshots against the Framer Publish button samples. _M0·P1·[SRC:F1, G1, T1]_
- [ ] **FVR-016** Tool strip — 32 px tools with 18 px glyphs, hover control fill, active accent fill with white glyph, 1 px dividers, floating surface with highlight and shadow. _Test:_ compare with the Framer canvas toolbar crops; placement per D-1. _M1·P0·[USER-TOKENS], [SRC:U11]_
- [ ] **FVR-017** Tooltips with shortcut hints — `#222`, radius 6, 12/500 label, Figma shortcut in text-3 right-aligned; 500 ms first delay; instant while gliding across tools. _Test:_ screen recording timing within ±50 ms of Framer's measured values. _M1·P1·[KNOW]_
- [ ] **FVR-018** Layer row — 30 px; 12/500 name; 14 px type icon; hover `--ill-surface-2`; selected per D-2; components in purple; hidden at 50 %; eye and lock fade in on hover. _Data:_ `visible`, `locked`, node `type` [API] _Test:_ fixture with a 4-level tree compared with the Framer layers crop. _M1·P0·[SRC:G2, U10], [KNOW]_
- [ ] **FVR-019** Panel tabs — text tabs: active 600 text, inactive 500 text-3; 48 px header. _Test:_ compare with Framer Pages/Layers/Assets and Style/Agent crops. _M1·P1·[SRC:G2, N2], [KNOW]_
- [ ] **FVR-020** Section header with +/− affordances — 12/600 title; text-2 when the section is empty; 16 px add/remove glyphs in 24 px hit boxes. _Test:_ select a frame with no stroke; the Stroke header shows "+" and the title in text-2. _M1·P0·[KNOW]_
- [ ] **FVR-021** Menus — elevated surface, radius 10, 5 px padding, 30 px items, accent highlight with white text (pending verification), Figma shortcuts in text-3, 1 px separators. _Test:_ right-click a layer; crop compare with the Framer context menu. _M1·P0·[SRC:G2], [KNOW]_
- [ ] **FVR-022** Menu selection confirmation blink — the chosen item blinks once before the menu closes. _Test:_ 60 fps capture compared with Framer. _M1·P2·[SRC:U1]_
- [ ] **FVR-023** Modal — panel surface, radius 16, 48 px header with a 600 title, scrim `rgba(0,0,0,.5)`, 150 ms fade+scale in. _Test:_ open the keyboard-shortcuts dialog; compare with a Framer modal crop. _M0·P1·[SRC:G1, G2], [USER-TOKENS]_
- [ ] **FVR-024** Toast variants — info, success, warning, error, with the variant glyph colours and an optional action; bottom centre; about 3 s. _Test:_ trigger each variant; screenshot. _M0·P2·[SRC:D1]_
- [ ] **FVR-025** Canvas selection chrome — 1 px `#0099ff` bounds, 8 px white handles with an accent stroke, a W × H accent badge; no scaling with zoom. _Data:_ `width`, `height` [API] _Test:_ select a frame at 10 %, 100 % and 800 % zoom; stroke widths are constant. _M1·P0·[SRC:U11], [USER-TOKENS]_
- [ ] **FVR-026** Component canvas chrome — component and instance outline, handles and titles render in `--ill-component`. _Data:_ `type: COMPONENT|COMPONENT_SET|INSTANCE` [API] _Test:_ select each type; colour sample equals the token. _M5·P0·[SRC:U10], [KNOW]_
- [ ] **FVR-027** Smart guide and measurement colours locked — guides, distance lines and labels use the verified Framer colours (TBD). _Test:_ drag a layer near a sibling; sample the guide colour against the Framer reference. _M1·P0·[KNOW]_
- [ ] **FVR-028** Auto-layout overlays — padding and gap hatches plus gap handles in the locked spacing-overlay colour. _Data:_ `paddingTop..`, `itemSpacing`, `counterAxisSpacing` [API] _Test:_ hover the padding field; the overlay appears with the verified colour. _M4·P1·[KNOW]_
- [ ] **FVR-029** Alignment matrix and constraints widget skins — Framer primitives per M-5; all Figma states are representable. _Data:_ `primaryAxisAlignItems`, `counterAxisAlignItems`, `constraints` [API] _Test:_ cycle all 9 alignments plus SPACE_BETWEEN, and all 5×5 constraint combinations; every state is visually distinct. _M4·P0·[API], [OBS]_
- [ ] **FVR-030** Variable and style chips vs component-property chips — neutral vs purple chips are never confused. _Data:_ `boundVariables`, `componentPropertyReferences` [API] _Test:_ bind a fill to a variable and a text to a component property; screenshot shows a neutral and a purple chip. _M5·P1 / M6·P1·[API]_
- [ ] **FVR-031** Prototype noodles styled per §9 — 2 px accent curves, start dot, arrowhead; the selected one is 3 px. _Data:_ `reactions` [API] _Test:_ create a connection; zoom from 25 % to 400 %; stroke widths are constant. _M7·P0·[KNOW]_
- [ ] **FVR-032** Vector edit chrome — anchors and handles per §9; the selected anchor is filled accent. _Data:_ `vectorNetwork` [API] _Test:_ enter edit mode on a star; compare with the spec. _M2·P1·[USER-TOKENS]_
- [ ] **FVR-033** Icon set compliance — every chrome glyph is 1.5 px on-screen stroke with round caps and joins on 12/14/16 px grids; component glyphs are purple. _Test:_ an automated SVG lint for `stroke-width × (rendered size / viewBox)` = 1.5 ± 0.1; a visual sheet compared with Framer icon crops. _M0·P1·[SRC:F1]_
- [ ] **FVR-034** Motion tokens — durations and easings per §11; canvas feedback never animates; `prefers-reduced-motion` respected. _Test:_ CSS audit, plus a reduced-motion OS toggle recording. _M0·P1·[SRC:F1, G1, G4]_
- [ ] **FVR-035** Contrast audit — all text tokens are measured against their surfaces; failing pairs (§11) are either restricted to exempt uses or raised per D-7. _Test:_ an automated contrast check over a full-chrome screenshot in both themes. _M8·P0·computed_
- [ ] **FVR-036** Light theme completeness — every §8 primitive and §9 overlay has a light-theme rendering matching the Framer light reference. _Test:_ a side-by-side contact sheet. _M0·P1·[SRC:G1–G4], [KNOW]_

---

## Verification needed

The values tagged [KNOW] or TBD above can only be locked with real Framer captures. Please provide the items below from the **current Framer 3.x desktop app or web editor**, in **both dark and light mode**, on a 2× (Retina) display, as lossless PNGs with the window at 1440 × 900 CSS px.

### A. Eyedropper hex samples (the highest value per minute)

Sample each in dark and light mode. Use a colour picker set to "Display in sRGB" so display profiles do not shift the values.

1. Empty **canvas** background.
2. **Left panel**, **right panel** and **top toolbar** backgrounds, if they differ.
3. **Divider** lines: panel/canvas edge, between sections, under the tab bar.
4. **Input/control fill** at idle, hover and pressed, and the **focus ring** colour and width.
5. **Segmented control** track and active indicator (and whether it has a top highlight).
6. **Dropdown menu** surface, its border, its shadow edge, the **highlighted menu item** fill, and the shortcut text colour.
7. **Tooltip** background and text.
8. **Modal** surface, the **scrim** over the canvas, and the **toast** surface.
9. **Layer rows:** hover fill, selected fill, selected text and icon, and component row text and icon (purple hex) in idle and selected states.
10. Text samples: **primary**, **secondary (labels)**, **tertiary (placeholders and units)**, disabled.
11. **Primary button** (Publish) idle, hover and pressed; any **destructive** button or menu item; warning and success colours.
12. Canvas: **selection outline**, **resize handle** fill and stroke, **hover outline**, **frame/breakpoint title** text (idle and selected), **smart guide** line, **distance measurement** line and label, **stack gap/padding** overlay, **component** selection outline.

### B. Zoomed 2× crops (no compression)

1. The **properties panel** with a Frame or Stack selected, all sections expanded.
2. The same with a **Text** layer selected (typography section).
3. The same with a **component instance** selected (component variables in purple).
4. The same with a **Grid/Stack layout** selected (layout controls).
5. The **fill colour picker** popover open, and the **image fill** popover open.
6. The **effects/shadow** popover open.
7. The **Layers panel** with a 4-level tree containing one hidden, one locked, one component, one selected and one hovered row.
8. The **Pages** and **Assets** tabs.
9. The **top toolbar** and the **canvas toolbar**: each tool idle, hovered and active, and each flyout or menu open. The **Insert panel** open. **⌘K quick actions** open.
10. A **context menu** on a canvas layer with a submenu open; a **select dropdown** open in the properties panel.
11. A **tooltip with a shortcut** over a toolbar button.
12. Canvas: a single selection with handles; multi-selection; hover outline; frame titles idle and selected; **smart guides while dragging** (alignment and equal spacing); **⌥-hover distance measurement**; a stack hover showing gap and padding; a component selection; text editing with a selection; vector path editing with a selected point; the marquee.
13. **20 representative icons** at 2×: tools, layer-type icons, eye, lock, +, −, chevrons, ellipsis, search. If possible, also copy their **SVG markup** from devtools so the viewBox and stroke widths can be read.

### C. Screen recordings (60 fps, a few seconds each)

1. Hover → tooltip appearance (delay and fade); gliding across adjacent tools.
2. Segmented control switching.
3. Section collapse and expand; adding and removing a fill row.
4. Menu open → choose an item (the confirmation blink) → close.
5. Panel tab switches: Pages/Layers/Assets and Style/Agent.
6. Modal open and close.
7. Theme toggle (⌃⌘N).

### D. Devtools measurements (only if Framer's web editor can be inspected)

1. Open **any plugin**, inspect the plugin iframe's `<body>` and copy the inline values of **all 14 `--framer-color-*` tokens** in both themes. This one step locks most of §2.
2. Computed `font-family`, `font-size`, `font-weight`, `line-height`, `letter-spacing` and `font-feature-settings` for: a layer name, a property label, an input value, a section title, a tab label, a menu item, a tooltip.
3. Heights of: the toolbar, the tab bar, a layer row, a property row, an input, a menu item. Default, minimum and maximum widths of the left and right panels.
4. `border-radius` and `box-shadow` of: an input, a button, a menu, a tooltip, a modal, the canvas toolbar.
5. `transition` declarations on: a button, a layer row, the segmented indicator, menus.

---

## Needs live Figma verification

These items are Figma-behavior claims used in the mapping above that rest on [KNOW]. They affect **which** chrome exists and **when** it appears, not how it looks.

1. The Figma UI3 left-panel structure: File/Assets tabs, a collapsible Pages section above Layers ([OBS] confirms the File/Pages/Layers area; the Assets tab label is [KNOW]).
2. The Figma toolbar's tool grouping and flyouts (shape tools, frame/section/slice, pen/pencil), and whether the active tool is shown with a blue fill.
3. The descendant highlight band in Layers when a container is selected.
4. The hover-preview glyphs in the auto-layout 9-position matrix, and how SPACE_BETWEEN and baseline render in that widget.
5. The canvas overlay vocabulary and triggers: size badge, ⌥-distance measurements, equal-spacing indicators, auto-layout padding/gap hatches (and their pink colour), smart guides (and their red colour), rulers and guides.
6. The default layout-grid colour (red at about 10 %) for new grids.
7. Which Figma boolean properties use checkboxes vs toggles (beyond "Clip content", a checkbox per [OBS]).
8. Scrub modifiers and step sizes on numeric fields (⇧ / ⌥), and Figma's "Mixed" wording.
9. The Figma quick-actions entry (⌘K and ⌘/) and the Resources (⇧I) flow.
10. The Figma prototype noodle styling (blue, arrowheads, start dot) and hotspot visuals.
