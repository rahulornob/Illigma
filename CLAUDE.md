# Illigma: project context

Illigma is an open-source, local-first redesign of Figma ("Figma's editing model, your files, your machine"). The old browser prototype (Vite, vanilla JS, SVG, Paper.js) was removed on 2026-10-12. Its code is still in git history at commit `8e3bd2f`, if you need it as a reference. The project is now in the **visual design phase**. Development starts only after the user confirms the visuals in Figma.

## Decisions (2026-10-12, recorded in PRD section 10)

| Topic | Decision |
| --- | --- |
| Name | "Illigma" is final. Run a trademark search before launch, use an original logo, and never style it like Figma's wordmark. |
| Build | From scratch: a TypeScript monorepo, CanvasKit (Skia WASM) GPU renderer, operation-based document model, and our own layout engine. Not a fork of OpenPencil or of the old prototype. |
| Platform | Web-first: an installable web app that works offline (OPFS, plus the File System Access API in Chromium). Tauri desktop app in v1.x. |
| Collaboration | Single-user v1. Multiplayer (CRDT over LAN or a self-hosted relay) in v2. |
| Team / timeline | 3 engineers + 1 designer, plus community contributors and AI agents. v1.0 in October 2027. |
| Licence | MPL-2.0 for the editor, MIT for the file-format spec and SDK, AGPL-3.0 for the optional sync relay. |
| Business model | Pure community project, with no paid plans. |
| Visual identity | Figma-familiar layout with Framer-like polish, but a fresh, original identity. Brand direction **B · Ember**: accent `#FF5B2E` and an anchor-point logo mark (ring + square node). Never use Figma or Framer logos, or Framer blue `#0099FF`. |
| Theme | Dark first; light mode comes later from the same variables. |
| Preferred style | Leaning toward the "Studio" look (Spline / Rive / Jitter feel). See the Figma section below. |

## Documents

- `docs/PRD.md`: snapshot of the full PRD (vision, requirements, architecture, roadmap, risks, decisions).
- `docs/feature-inventory/`: 12 files, 5,356 rows covering every Figma feature from all 896 Help Center articles, plus the Plugin API typings, REST API spec and keyboard shortcuts. Every row has an Illigma priority: P0 = v1.0, P1 = v1.x, P2 = v2+, Module = a later separate module, `Local: …` = the local-first equivalent of a cloud or admin feature.
- The living, editable PRD is a Claude Doc: https://claude.ai/code/artifact/3490f73e-92e4-49cd-a9b3-7b5b1cac7c57. The user writes answers and decisions directly in it, so read it for the latest before changing scope. Re-export `docs/PRD.md` after major edits.

## Figma (visual design)

- File: **"Illigma"**, key `K9mCPjBElVGiPOHJvZ4CWY`. Design work lives on page **"Illigma — Editor v1"** (node `75:1471`).
- Sections, in order:
  1. `01 · Brand directions`: options A Iris, B Ember (chosen), C Mint.
  2. `02 · Editor — Dark`: first full editor screen, 1440×900.
  3. `03 · Editor — 3 versions`: layouts A Floating islands, B Pro dense, C Focus canvas.
  4. `04 · Style explorations`: Glass, Soft round, Aurora glow.
  5. `05 · Studio — modern canvas` (node `77:4970`, screen `77:4973`): the latest direction. It has a dark shell with rounded cards and 8 px gutters, a large Design / Prototype / Inspect switcher, colour-coded layer types, a slider-based inspector, and a dot-grid canvas with a desktop + mobile frame, smart guide, comment pin, minimap and tool dock.
- Variables: two collections. **"Illigma Primitives"** (`VariableCollectionId:94:11919`, one mode) holds raw colour ramps and white/black alpha steps. **"Illigma UI"** (`VariableCollectionId:91:3140`, modes Dark `91:0` and Light `91:1`) holds the semantic tokens (`bg/*`, `text/*`, `border/*`, `accent/*`, `state/*`, `type/*`, `brand/*`, `radius/*`, `size/*`, `space/*`), each aliasing a primitive. Bind UI to the semantic tokens, never to hex values or primitives. The old "Illigma Theme" collection was deleted on 2026-10-13.
- Other pages ("Page 1" with older mockups and captures, "delete", "---", "Page 4") belong to the user. Only read them; do not edit them.
- Tools: use the local **figma-console** MCP (Desktop Bridge). Probe with `figma_get_status` (`probe: true`) and confirm the file name is "Illigma" before editing. After every visual change, take a screenshot with `figma_capture_screenshot` and fix any issues.
- Icons are Lucide SVG paths created with `figma.createNodeFromSvg`. UI type is Inter.

## Working preferences

- The user wants exhaustive coverage ("no Figma feature left out") and is happy for many parallel agents to be used on research.
- Workflow: visual design in Figma → the user confirms → development. Do not start app code until the visuals are approved.
- Design source of truth (2026-10-13): the user's reference "Home — dark" (node 88:24) and "Right panel — states" (88:785). Adopt their **look** (shell + rounded cards, colours, Inter sizes, cards, toggles, layer-type tiles, blue selection) but **not their photo-editor features**. Illigma is a UI design tool like Figma. Chosen editor layout (2026-10-13): **B · Floating canvas**, section "07 · Editor layout — B · Floating canvas (chosen)" (94:3118, screen 94:3119): full-bleed canvas, Layers and Properties float as islands, tools in a bottom dock. Other approaches (A = old "06 · Design editor" 91:3182, C, D–H) live in section "Archive · other approaches" for reference only. Design system: section "00 · Design system" (94:12013) with Foundations and Components boards. Tokens: primitives in "Illigma Primitives", semantic tokens in "Illigma UI" (VariableCollectionId:91:3140); components bind only to semantic tokens. Colour roles: Ember = brand only, Blue = everything interactive (selection, focus, active tool, components); no purple or lime (removed 2026-10-13). Text colours are white/black alpha tokens, not grey hex. 4 px grid everywhere, 12 px minimum type, Lucide icons at 1.2 px.
- Every new or changed design screen gets a **design audit**: a read-only agent checks (A) adoption of the reference style, (B) any photo-editor features that have crept in, (C) gaps against Figma (`docs/feature-inventory/`, PRD section 5), and (D) the top fixes. Apply the fixes, then show the user.
- Git: remote `origin` = github.com/rahulornob/Illigma, branch `main`.
