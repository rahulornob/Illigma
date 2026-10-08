# Illigma: master plan

| | |
| --- | --- |
| **Phase** | **Planning.** The repository holds documentation only. No application code exists. |
| **Date** | 2026-10-08 |
| **Implementation status** | **Everything is Not started.** That covers all 2,718 Figma-parity items, all 160 UI items, every architecture decision and every performance budget. |
| **Parity claims** | **None.** No feature of Illigma has been implemented or validated against Figma. |
| **Review status** | **The adversarial review passes were not completed for any planning document**, because the research runs hit usage limits. Some documents contain partial corrections from interrupted passes (§6.2). A review pass per area is required before any M0 implementation (§8). |
| **Index of parity items** | [`docs/parity/CHECKLIST.md`](docs/parity/CHECKLIST.md) |
| **Standing instructions for coding sessions** | [`AGENTS.md`](AGENTS.md) |

**Evidence tags** used in this plan and in every planning document:
- `[API]`: Figma Plugin API typings v1.141.0 or REST API types v0.44.0, read locally.
- `[DOC:<id>]`: an official Figma Help Center article. "excerpt" means only a search-engine excerpt was seen, not the article body.
- `[OBS]`: the read-only live-Figma observation of 2026-09-27.
- `[SRC:<url>]`: any other source.
- `[KNOW]`: the author's own knowledge, not verified in a session.

This plan mostly links to the specs. The few Figma facts it states directly carry tags.

---

## Contents

1. [Vision and product direction](#1-vision-and-product-direction)
2. [The non-negotiable rule](#2-the-non-negotiable-rule)
3. [Scope: in, out, later](#3-scope-in-out-later)
4. [Architecture and stack (summary)](#4-architecture-and-stack-summary)
5. [UI direction (summary)](#5-ui-direction-summary)
6. [Planning documents and their honest status](#6-planning-documents-and-their-honest-status)
7. [Milestone roadmap M0–M8](#7-milestone-roadmap-m0m8)
8. [Gate G0: review passes before M0 implementation](#8-gate-g0-review-passes-before-m0-implementation)
9. [M0 implementation slices](#9-m0-implementation-slices)
10. [M1 implementation slices](#10-m1-implementation-slices)
11. [Parity validation process](#11-parity-validation-process)
12. [Status definitions](#12-status-definitions)
13. [Risk summary](#13-risk-summary)
14. [Open decisions for the user](#14-open-decisions-for-the-user)
15. [Needs live Figma verification: roll-up](#15-needs-live-figma-verification-roll-up)
16. [Document map and conventions](#16-document-map-and-conventions)
17. [Change log](#17-change-log)

---

## 1. Vision and product direction

> **"Look like Framer. Feel and function like Figma. Run locally."** (the user)

Illigma is a **professional desktop design application**. It is **not a basic editor, and not a simplified clone.**

- **Feel and function like Figma.** The target is the functionality of the Figma Design editor, at **1:1 parity**:
  - the infinite canvas, selection and transforms;
  - frames, groups and sections;
  - auto layout (including wrap and grid);
  - vector networks and boolean groups;
  - fills, strokes and effects;
  - typography;
  - components, variants, properties and slots;
  - variables, modes and styles;
  - local libraries;
  - prototyping;
  - export.

  Parity covers the data model, the interactions, the modifiers, the edge cases and the workflows.
- **Look like Framer.** The editor's chrome takes Framer's visual language: colours, type, spacing, radii, controls, icons, and the polish of hover states and transitions. The look is calm, dense and dark-first.
- **Run locally.** Illigma is local-first:
  - it works fully offline and needs no account;
  - documents are files on the user's disk;
  - it has no telemetry and no network traffic by default;
  - it never uploads anything.

  Cloud features of Figma are re-mapped to local equivalents where that makes sense (§3).
- **Professional quality.** The targets are:
  - 60 fps with 10k+ nodes on screen, and files with 100k+ nodes;
  - lossless and crash-safe saving;
  - full undo and redo;
  - keyboard-first operation;
  - accessible chrome (WCAG 2.2 AA target).

  These targets are written as measurable budgets in `docs/architecture.md` §1 and §8.
- **Honest parity.** Parity is tracked item by item: **2,718 atomic, testable checklist items** across 11 areas. A claim of parity requires evidence (§11–§12). Until then, Illigma says "Implemented", never "1:1".

## 2. The non-negotiable rule

1. **Figma is the source of truth for all functionality**: behavior, interactions, workflows, edge cases and the data model. The target is 1:1 parity.
   - The data model follows Figma's own typings (`@figma/plugin-typings` 1.141.0 `[API]`), including Figma's property and enum names.
   - **Framer's layout, component and variable systems never replace Figma's.** Illigma has no Framer stacks, breakpoints or component variables `[KNOW]`. It has Figma auto layout, Figma components and Figma variables.
2. **Framer is the source of truth only for the visual appearance of the editor UI.** That means colours, icons, typography, spacing, radii, controls, and hover and transition polish.
3. **When the two conflict, Figma decides behavior and Framer decides looks.** Examples:
   - **Inspector sections.** Their names, order and controls are Figma's: Position, Layout, Appearance, Fill, Stroke, Effects, Layout guide, Export `[OBS]`. The Framer skin restyles them without adding, removing, merging or reordering anything (design-system P-1).
   - **Data stays data.** Document data, such as a page background colour, is never restyled by the theme. Only chrome is (design-system P-8).
   - **Illigma-only additions** are labelled *Illigma extension*. They may only call existing Figma commands, and they never replace the Figma path to a command. An example is the "−/+" buttons in the zoom pill.
   - **Layout placement is a look-versus-structure grey zone.** The floating bottom toolbar was the user's previous choice, and Figma UI3 also has one `[OBS]`. Framer uses a top toolbar `[SRC:U7 in docs/ui/framer-visual-reference.md]`. The user is asked to confirm (U-01).
4. **No parity claim without implementation *and* validation** against Figma behavior (§11). In this phase everything is *Not started*.

## 3. Scope: in, out, later

### 3.1 In scope (M0–M8)

| Capability | Where specified | Milestone(s) |
| --- | --- | --- |
| Infinite canvas, pages, viewport, selection, transforms, snapping, smart guides, measurement, align/distribute, clipboard, z-order | [CV](docs/parity/01-canvas-selection-transform.md) | M1 (model in M0) |
| Frames, groups, sections, clip content, constraints, layout guides (grids) | [FR](docs/parity/02-frames-groups-sections-constraints.md) | M1, M4 |
| Auto layout: horizontal, vertical, wrap, **grid**, min/max, absolute children, layout versions | [AL](docs/parity/03-auto-layout.md) | M4 |
| Shapes, vector networks, pen and pencil, boolean groups, flatten, outline stroke, masks, slices | [VC](docs/parity/04-shapes-vectors-booleans.md) | M1 (primitives), M2 |
| Fills (solid, gradients, image, video, pattern), strokes, effects (shadows, blurs incl. progressive, noise, texture, glass), blend modes, colour picker, colour management, export (PNG, JPG, SVG, PDF) | [PE](docs/parity/05-paint-effects-color-export.md), [IO](docs/parity/11-file-format-interop.md) | M1 (solid), M2 |
| Text and typography: mixed styles, lists, OpenType, variable fonts, truncation, leading trim, IME, missing fonts | [TX](docs/parity/06-text-typography.md) | M3 |
| Components, instances, overrides, variants, component properties, **slots** | [CP](docs/parity/07-components-variants.md) | M5 |
| Styles, variables, collections, modes, extended collections, **local** libraries, design-token (DTCG) export and import | [DS](docs/parity/08-variables-styles-design-systems.md), IO | M6 |
| Prototyping: interactions, transitions, smart animate, overlays, scrolling, variables and conditionals, local presentation player | [PR](docs/parity/09-prototyping.md) | M7 |
| Layers, pages and assets panels; inspector structure; toolbar; menus; Actions menu; full Figma keymap (macOS and Windows/Linux); find and replace; preferences | [UX](docs/parity/10-panels-shortcuts-workflow.md) | M1, then per milestone |
| `.illigma` file format; autosave; crash recovery; **local** version history; migrations; raster and video import; SVG import; system clipboard | IO | M0 (core), M1, M8 |

### 3.2 Out of scope, with reasons

| Capability | Decision | Reason |
| --- | --- | --- |
| **Multiplayer**: real-time co-editing, cursors, observation, audio, cursor chat | Out for v1, **later** candidate (§3.3) | It needs a sync service, which conflicts with the local-first v1. The op log is designed in Figma's multiplayer shape (ADR-012), so this remains possible later without a rewrite. |
| **Cloud / team libraries**, publishing to a cloud, library analytics | **Re-mapped**: local library files (ADR-019, DS §3.19) | Library behavior (publish, accept updates, swap) is in scope. The cloud transport and analytics are not. |
| **Dev Mode** (Inspect, code panels, ready-for-dev, annotations UI, Code Connect) | Out; its **data is preserved** (`devStatus`, measurements, annotations, variable `codeSyntax`) | It is a handoff product, not design editing (UX §1.2, CV §1.2, CP §1.3). Lossless round-trip keeps it possible later. |
| **FigJam, Slides, Sites, Make, Buzz** | Out. Their node types are **preserved opaquely** when they appear on import (IO §1.2). | They are separate products. |
| **Plugins and widgets** | Out for v1, **later** candidate | They need a sandboxed runtime, a large API surface and a security model. The menus are absent, not shown as disabled placeholders (UX §1.2). The internal *Scenario API* (a plugin-API subset, ADR-025) is test infrastructure only. |
| **AI features**: generation, agents, Make, AI-suggested slots | Out | They depend on the cloud. Navigation-rail slots for Agents and Tools are not reserved (design-system §4.4). |
| **Sharing, permissions, link access, "restrict copying"** | Out | OS file permissions apply. |
| **Accounts, telemetry, default network access** | Out (ADR-026) | Local-first. All outbound actions are explicit user actions. |
| **Writing `.fig`** | Out (IO §1.2) | The format is proprietary and carries legal risk. |
| **Copy *to* Figma in Figma's private clipboard format** | Out by default (IO §1.2) | Interop works through SVG and PNG flavours instead. |
| **Browser build as an end-user product; mobile and tablet** | Out | The browser build exists for development, CI and demos only (architecture §3.1). |

### 3.3 Later (after v1, or gated) — each keeps its data lossless now

| Capability | Status now | Revisit |
| --- | --- | --- |
| `.fig` import and paste-from-Figma clipboard | **Feasibility-gated P2 in M8, behind a legal gate** (IO-199, IO-185…IO-199) | Only with the user's legal stance (U-05) |
| Figma REST import (user token in the OS keychain) | P2 in M8 (IO-200…IO-207) | M8 |
| **Comments** (local-only, single author) | P2 in M8 (UX-174…UX-177) | U-07 |
| Branching and merging | P2 local equivalent (IO §3.15) | After M8 |
| **Figma Draw**: brushes, variable-width strokes, transform groups and repeat, text on a path, Offset/Simplify/Split vector | Data is preserved. A few operations stay P2 in their areas (for example TX-240 text-path import, VC Offset/Simplify). Rendering and editing of brushes and repeats are deferred. | After M8, or earlier if U-10 says so |
| **Figma Motion**: animation styles, keyframe tracks, animated components, animation export | **No owning area yet.** TIMING and EASING variables round-trip (DS-010). | U-10. If it is adopted, it becomes a 12th parity area after M7. |
| Shader paints and effects (open beta in Figma) | Preserved, rendered as a placeholder (PE §6.8, P2) | After M2 |
| Multiplayer and sync (Loro as candidate, ADR-012) | Not built | After v1 |
| Plugin runtime | Not built | After v1 |
| WebGPU renderer | Evaluation in M8 (ADR-003 fallback) | M8 |

### 3.4 Platforms

macOS, Windows and Linux (with Linux GPU support best-effort) in an **Electron** shell, so every OS uses the same rendering engine. This is the default unless the user decides otherwise (U-02).

---

## 4. Architecture and stack (summary)

The full rationale is in [`docs/architecture.md`](docs/architecture.md): 27 ADRs, invariants INV-01…INV-10, performance budgets PB-01…PB-16, risks R-01…R-15 and questions Q-1…Q-7. Its status is *Proposed*. Package versions were checked against the npm registry on 2026-10-08.

| Concern | Decision (named fallback) |
| --- | --- |
| Shell | **Electron 44.x** (Chromium 152, Node 24) on all three OSes, plus a Chromium browser build for development and CI. (Fallback: Tauri, only if a WebView parity matrix passes.) |
| Engine | **TypeScript (strict, TS 7)** on the editor's main thread. I/O, image decoding, export and font scanning run off-thread. (Fallback: Rust→WASM kernels, triggered if a budget is missed by more than 20 %.) |
| Renderer | **CanvasKit 0.42** (Skia/WASM, WebGL2). A retained RenderTree receives diffs and sits over a tile cache, per-node picture caches and an overlay pass. SkSL effects cover features Skia lacks, and a custom CanvasKit build adds SkPDF from M2. (Fallback: WebGPU, evaluated in M8.) |
| Hit-testing | CPU geometric hit-testing over a per-page R-tree, with tolerances in **screen pixels**. |
| Geometry | Illigma's own vector-network model, Skia PathOps for booleans, and a custom stroker. |
| Text | SkParagraph (HarfBuzz + ICU) for shaping, plus Illigma's own Figma text-box layer for line height, leading trim, lists, truncation and similar. (Fallback: harfbuzzjs.) |
| Layout | A custom solver with Figma semantics for stack, wrap, grid, min/max and constraints, versioned per frame. Yoga and Taffy are rejected. |
| Document model | A normalized node store. **One schema DSL using Figma property names** generates types, codecs, override and binding tables, and a coverage report against the typings. |
| Edits and undo | Every change is a **transaction**. One gesture makes one undo entry. There is one history per document, shared by all panels. |
| File format | `.illigma` is a single-file ZIP: msgpack chunks per page, content-addressed blobs, a manifest, optional history, and preserved extensions. Saves are atomic, with a journal and crash recovery. |
| UI | **SolidJS 1.9** with Zag.js/Ark UI primitives, CSS Modules over tokens, and a Workbench app. |
| Tests | Vitest with fast-check, numeric and render goldens against Figma fixtures, Playwright for browser and Electron, CI benchmarks, and a **parity matrix generated from tests tagged with checklist IDs**. |
| Figma fixtures | A development plugin exports golden data, but **only inside a disposable fixture file the user designates** (ADR-025). |

**Architecture invariants** (`docs/architecture.md` §3.3, repeated in `AGENTS.md`):
- every document change goes through a transaction;
- transient UI state never mutates document geometry;
- continuous gestures survive re-renders and lost pointer capture;
- a selected ancestor moves its descendants exactly once;
- frame selection bounds use the frame, not its children;
- typing and IME are separate from global shortcuts;
- hit tolerances are in screen pixels;
- results are deterministic;
- unknown data survives a round trip;
- derived writes are recorded in the transaction that caused them.

## 5. UI direction (summary)

The specs are [`docs/ui/design-system.md`](docs/ui/design-system.md) (tokens, iconography, layout, 50 components, KIT-001…KIT-124) and [`docs/ui/framer-visual-reference.md`](docs/ui/framer-visual-reference.md) (Framer evidence, FVR-001…FVR-036).

- **Layout.** These choices are **locked**, from the user's previous project, unless the user changes them:
  - a floating tool strip at the **bottom** centre of the canvas (C-1, confirm with U-01);
  - pages and layers on the left;
  - properties on the right, with Figma's Design and Prototype tabs;
  - Export docked at the bottom of the right sidebar;
  - no top bar;
  - **dark theme by default**, with light and system themes from M0.

  A left navigation rail follows Figma's current UI (design-system D-9, interim).
- **Look.**
  - **Type:** Inter 4, bundled, at 12/18 with weight 500, with alternates `cv01 cv05 cv09 cv11` turned on.
  - **Spacing:** a 5 px rhythm, 30 px controls and a 40 px property-row pitch.
  - **Radii:** 8 px for controls.
  - **Colour:** accent `#0099ff` and a near-black canvas.

  These values come from Framer-authored plugin CSS and the user's previous tokens. **No live Framer screen was inspected.** Values marked "verify" stay provisional until the user provides Framer captures (U-04).
- **Principles:**
  - No layout shift: tabular figures, reserved space for hover actions, fixed control heights.
  - Canvas chrome is drawn in screen space by the renderer, not the DOM.
  - Keyboard first.
  - WCAG 2.2 AA contrast. This overrides a few Framer colours (D-7).
  - Tokens only. A lint step rejects raw colour and size values.
- **Open look decisions.** D-2…D-13 in design-system §8.2 all have recommended interim values, so they do not block work (U-06).

---

## 6. Planning documents and their honest status

### 6.1 Inventory

| Document | Content | Items | Review status |
| --- | --- | ---: | --- |
| [01 Canvas, selection & transforms](docs/parity/01-canvas-selection-transform.md) (CV) | Behavior spec, data model, shortcuts, checklist, 59 experiments | 266 | Research completed 2026-10-08 (two search rounds). **No adversarial review.** |
| [02 Frames, groups, sections, constraints & layout guides](docs/parity/02-frames-groups-sections-constraints.md) (FR) | Same structure, 59 experiments | 247 | Research completed 2026-10-08. **No adversarial review.** |
| [03 Auto layout](docs/parity/03-auto-layout.md) (AL) | Includes a normative layout pseudo-algorithm (§3.22), 41 experiments | 249 | **No adversarial review.** |
| [04 Shapes, vectors, booleans & masks](docs/parity/04-shapes-vectors-booleans.md) (VC) | 50 experiments | 237 | **No adversarial review.** |
| [05 Paint, effects, colour & export](docs/parity/05-paint-effects-color-export.md) (PE) | 52 experiments, source-conflict list (§8.3) | 252 | **No adversarial review.** |
| [06 Text & typography](docs/parity/06-text-typography.md) (TX) | 63 experiments | 243 | **No adversarial review.** |
| [07 Components & variants](docs/parity/07-components-variants.md) (CP) | 36 experiments | 243 | Review **interrupted**; the header overstates what was done (§6.2). |
| [08 Variables, styles & design systems](docs/parity/08-variables-styles-design-systems.md) (DS) | 76 experiments, product questions Q1–Q5 | 246 | Review **interrupted**; the header overstates what was done (§6.2). |
| [09 Prototyping](docs/parity/09-prototyping.md) (PR) | 38 experiments | 275 | Review **interrupted**; the header overstates what was done (§6.2). |
| [10 Panels, shortcuts & workflow](docs/parity/10-panels-shortcuts-workflow.md) (UX) | Full keymap tables, 79 experiments | 214 | **No adversarial review.** |
| [11 File format & interop](docs/parity/11-file-format-interop.md) (IO) | 35 experiments, legality and feasibility analysis | 246 | **No adversarial review.** |
| [Architecture](docs/architecture.md) | 27 ADRs, budgets, risks, roadmap | — | Review interrupted; **not completed.** |
| [UI design system](docs/ui/design-system.md) | Tokens, kit, layout, 31 Figma checks (V-UI-01…31) | 124 KIT | Written in round 3 **without review.** |
| [Framer visual reference](docs/ui/framer-visual-reference.md) | Framer evidence, capture list | 36 FVR | **No adversarial review.** |
| [Parity index](docs/parity/CHECKLIST.md) | Counts, integrity checks, recount commands | — | Counted with grep and awk, 2026-10-08 |

### 6.2 Known gaps and integrity issues (must be fixed in G0)

1. **Interrupted reviews whose headers overstate the work.** The headers of the CP, DS and PR specs describe review passes that "added" CP-244…CP-262, DS-247…DS-293 with V-77…V-91, and PR-276…PR-313. They also point to a review log in "§10". **None of that content exists.** The files end at CP-243, DS-246 and PR-275, have no §10, and CP's body cites experiments E-37…E-47 that its §8 does not define. Treat those passes as **not done** (CHECKLIST §7).
2. **Research limits that apply everywhere:**
   - help.figma.com, figma.com and framer.com could not be fetched. Help Center content was seen only as **search excerpts**, never as full article bodies.
   - The shared web-search budget ran out partway through every research run.
   - No live Figma or Framer session was used in this phase. The only live evidence is the read-only `[OBS]` of 2026-09-27, which covered the shell and inspector, not interactions.
3. **Evidence strength.** About **45 %** of items (1,232 of 2,718) rest only on `[KNOW]` and/or `[SRC]` (CHECKLIST §7.1). These items are hypotheses until their live experiment has been recorded.
4. **Cross-document conflicts** are listed in §15.3.
5. **The `[OBS]` log lives outside the repository.** It exists only in the deleted prototype's snapshot (`old/docs/figma/observations/2026-09-27-live-figma.md`). Moving it into `docs/figma/observations/` is task RV-16.

---

## 7. Milestone roadmap M0–M8

### 7.1 Overview

The counts come from [`docs/parity/CHECKLIST.md`](docs/parity/CHECKLIST.md) and are written as P0 / P1 / P2.

| Milestone | Goal | Parity items (P0/P1/P2) | Main areas (item count) | UI items |
| --- | --- | --- | --- | --- |
| **M0 Foundation** | The proven skeleton: model, transactions, history, file format, renderer, hit-testing, shell, UI kit, test and parity harness | 93 (71/22/0) | IO 26, UX 19, PE 17, CV 14, FR 11, VC 3, DS 3 | KIT 37, FVR 18 |
| **M1 Core editing** | A professional static-layout editor: canvas, selection, transforms, frames, groups, sections, layers, inspector, solid paint, shortcuts, save and open | 587 (305/206/76) | CV 224, UX 132, FR 130, VC 47, PE 36, IO 16, AL 1, DS 1 | KIT 41, FVR 10 |
| **M2 Vectors & paint** | Vector networks, booleans, masks, all paints, strokes, effects, blend modes, colour picker, export | 451 (170/200/81) | VC 175, PE 172, IO 67, DS 11, FR 8, UX 8, CV 5, TX 3, AL 2 | KIT 14, FVR 2 |
| **M3 Text & typography** | Figma text layout and editing | 249 (109/103/37) | TX 205, IO 15, DS 11, UX 10, PE 3, CV 2, AL 2, VC 1 | KIT 1 |
| **M4 Layout** | Constraints, auto layout (wrap, grid, min/max, absolute), layout guides, responsive resizing | 327 (174/117/36) | AL 218, FR 71, CV 9, TX 8, DS 7, UX 5, VC 3, PE 3, IO 3 | KIT 11, FVR 2 |
| **M5 Components** | Components, instances, overrides, variants, properties, slots | 290 (151/104/35) | CP 221, UX 19, AL 12, FR 9, DS 8, CV 6, PE 4, TX 4, IO 4, VC 2, PR 1 | KIT 4, FVR 2 |
| **M6 Design systems** | Styles, variables, collections, modes, local libraries, design-system management | 285 (121/129/35) | DS 198, IO 26, TX 17, CP 12, PE 11, FR 9, AL 4, CV 3, VC 3, UX 2 | KIT 5 |
| **M7 Prototyping** | Interactions, animation, overlays, scrolling, variables in prototypes, presentation | 290 (119/135/36) | PR 263, IO 8, CP 7, FR 3, DS 3, UX 3, PE 2, TX 1 | KIT 4, FVR 1 |
| **M8 Interop & hardening** | SVG/PDF/`.fig` interop, clipboard interop, version history, performance, accessibility, release | 146 (17/64/65) | IO 81, UX 16, PR 11, AL 10, FR 6, TX 5, PE 4, DS 4, CV 3, VC 3, CP 3 | KIT 7, FVR 1 |
| **Total** | | **2,718 (1,237/1,080/401)** | | **160** |

**Milestones are exit gates, not strict waterfalls.** Headless engine work for a later milestone may start once the P0 items it depends on are *Implemented*. An example is the layout solver for M4, which can be built in Node during M2. Exit order stays M0 → M8. Each milestone's items are the ones tagged `_M#·…_` in the area files. A section's ID range is approximate because individual items inside a range can carry another milestone tag; **the tag is authoritative.**

### 7.2 The milestone exit gate (applies to every milestone)

A milestone **exits** only when all of the following hold:

1. **P0:** every P0 item tagged for the milestone is **Validated**. The exception is *Requirement* items, which have no Figma behavior to compare (§12); they must be **Implemented**.
2. **P1:** every P1 item tagged for the milestone is at least **Implemented**, and is **Validated** if its Figma evidence has been captured. At most 10 % of the milestone's P1 items may move to a later milestone. Each move needs a re-tag and a reason in §17.
3. **P2:** items may move freely, but only by re-tagging. Nothing is dropped silently.
4. **Evidence:** every experiment that gates the milestone's P0 items (the area §8 tables list "gates items") has a dated record: a fixture or an observation log.
5. **Budgets:** the milestone's performance budgets (`docs/architecture.md` §8) pass on the reference machines RH-1…RH-3. A miss of more than 20 % triggers the documented fallback ADR.
6. **Safety nets are green:** the persistence fault-injection suite, undo/redo fuzzing, the invariant tests INV-01…INV-10, and the schema-coverage report (no unclassified typings property).
7. **Bugs:** no open data-loss or document-corruption bug. These block release (R-05, R-07).
8. **Look:** the milestone's KIT and FVR P0 items are **Implemented**. FVR items are compared against Framer captures if the user has provided them (U-04). Otherwise they keep the label "verify against Framer".
9. **Next milestone:** the area specs it depends on have had their refresh pass (§11, step 1).

**Without Figma fixture access (U-03 declined or not yet answered),** item 1 cannot be met. The milestone may then exit with its Figma-behavior P0 items at *Implemented*, provided every other criterion holds. It is recorded in §17 as **"exited without validation"**, and no parity claim may be made for it. Its items are validated as soon as fixtures become available.

**"Validated against Figma" means concretely:**
- **Evidence exists.** It is either a fixture captured from current Figma in the user's disposable fixture file (REST-schema JSON, plugin dumps, PNG at 1× and 2×, SVG and PDF as relevant; with `meta.json` giving capture date, Figma version, typings version, platform and fonts), or, for interaction-only behavior, a dated observation log of setup → action → result.
- **A linked test compares Illigma against that evidence** within the ADR-024 tolerances:
  - layout: ε 0.01 px;
  - bounds: ε 0.05 px;
  - path geometry: IoU ≥ 0.999 or Hausdorff distance ≤ 0.05 px;
  - text line boxes: ε 0.5 px;
  - structure, enums, names and ordering: exact;
  - render: ≤ 0.5 % of pixels with ΔE2000 > 2.0 at 1× and 2× (noise and texture compared statistically);
  - interactions: an E2E script that reproduces the observation and asserts document state.
- **Every clause, modifier and edge case of the item** has an assertion.
- **The test passes in CI** on every supported OS, or on the OS the behavior is specific to.
- **Keyboard behavior** is evidenced on both macOS and Windows.

### 7.3 M0 Foundation

- **Goal.** Build everything later features depend on, and prove the risky choices early: the spikes S1–S5 from `docs/architecture.md` §11 (S6 opens M2).
- **Parity scope (93 items).**
  - **CV (14):** CV-001…CV-008 (coordinate and geometry model); CV-252…CV-256 and CV-262 (undo of gestures); CV-266 (text-input isolation).
  - **FR (11):** FR-001…FR-003, FR-005…FR-007, FR-009, FR-015, FR-017, FR-039, FR-052 (capability matrix, schema, round-trip).
  - **VC (3):** VC-094, VC-226, VC-235.
  - **PE (17):** compositing, blend formulas, gradient evaluation, shadow geometry, assets and the colour-managed canvas (PE-009 … PE-244; filter by tag).
  - **DS (3):** DS-008, DS-207, DS-208.
  - **UX (19):** UX-150, UX-168…UX-173, UX-187…UX-189, UX-192…UX-200.
  - **IO (26):** container, integrity, identity, journal, recovery, migrations (IO-001…IO-074; filter by tag).
  - **UI:** KIT 37, FVR 18.
- **Exit criteria.**
  - The gate in §7.2.
  - Spikes S1 (render and performance), S2 (text), S3 (font service), S4 (save fault injection) and S5 (fixture-plugin dry run) each have a recorded outcome, and any fallback ADR they trigger is decided.
  - PB-01…PB-05, PB-08, PB-12 and PB-14 are measured in CI.
  - The parity matrix is generated in CI.
- **Dependencies.**
  - **G0** (§8) must be complete.
  - U-02 (platforms).
  - U-03 (fixture file). S5 and every *Validated* status depend on it. Without it, M0 exits with its Figma-behavior items at *Implemented*, and the plan reports that parity cannot be claimed.

### 7.4 M1 Core editing

- **Goal.** A professional editor for static designs:
  - navigate the infinite canvas and pages;
  - create primitives and frames;
  - select, move, resize, rotate and flip with Figma's modifiers;
  - snapping, smart guides and redlines;
  - groups and sections;
  - the layers and pages panels;
  - inspector basics and solid fills and strokes;
  - the full core keymap and menus;
  - save, open, autosave and recovery.
- **Parity scope (587).**
  - **CV (224):** CV-004…CV-251 and CV-263.
  - **FR (130):** FR-019…FR-152, plus FR-220…FR-247 (cross-cutting, inspector and shortcuts); constraints and layout guides are M4.
  - **UX (132):** UX-001…UX-086, UX-097…UX-150, UX-178…UX-214.
  - **VC (47):** VC-001…VC-070 (primitive tools), VC-105, VC-228.
  - **PE (36):** solid paint stack, colour picker, opacity and blend, basic strokes, mixed selections.
  - **IO (16):** explicit save, untitled documents, single writer, clipboard flavours.
  - **AL (1), DS (1).**
  - **UI:** KIT 41 (for example the NumberField scrub, layers tree, inspector grid), FVR 10.
- **Exit criteria.**
  - The gate in §7.2.
  - PB-03, PB-04, PB-10, PB-12 and PB-14.
  - INV-01…INV-07 enforced by tests.
- **Dependencies.** M0, plus the fixtures and observations for the CV, FR and UX §8 experiments that gate M1 P0 items (§15).

### 7.5 M2 Vectors & paint

- **Goal.** Figma-faithful vector editing and rendering:
  - pen and pencil, the vector edit mode, and bend;
  - boolean groups, flatten, outline stroke and masks;
  - gradients, image, video and pattern fills;
  - full strokes: alignment, dashes, caps, per-side weights, variable width as data;
  - effects, blend modes, the full colour picker and eyedropper;
  - export encoders: PNG, JPG, SVG, PDF.
- **Parity scope (451).** VC 175 (VC-071…VC-225), PE 172, IO 67 (export, image import and colour management), DS 11, FR 8, UX 8, CV 5, TX 3, AL 2.
- **Exit criteria.**
  - The gate in §7.2.
  - Render goldens against Figma exports for every paint, stroke and effect class.
  - **S6** (the effect-fidelity spike for glass, progressive blur and noise) runs first.
  - PB-16.
  - The custom CanvasKit build is reproducible in CI.
- **Dependencies.** M1; resolution of the PE §8.3 source conflicts; U-08 (Pathfinder).

### 7.6 M3 Text & typography

- **Goal.** Figma's text model and layout:
  - the resizing modes;
  - line height and leading trim;
  - lists and paragraph spacing;
  - truncation;
  - OpenType features and variable fonts;
  - RTL and CJK through ICU;
  - IME editing;
  - the missing-font flow.
- **Parity scope (249).** TX 205, IO 15 (font references, embedding, text export), DS 11 (text-style hooks), UX 10, PE 3, CV 2, AL 2, VC 1.
- **Exit criteria.**
  - The gate in §7.2.
  - PB-09.
  - Text fixtures within ε 0.5 px for line boxes and baselines.
  - IME verified on all three OSes.
- **Dependencies.**
  - Spikes S2 and S3 from M0, and M2 paints for text fills.
  - **U-09** (whether glyph outlines may be stored for missing-font preview) must be answered before the text part of the file format freezes.
  - The TX schema-freeze experiments (§15.2).

### 7.7 M4 Layout

- **Goal.**
  - Constraints, including SCALE, and layout guides.
  - Auto layout: horizontal, vertical, wrap, **grid**, min/max, absolute children, baseline, strokes included, canvas stacking.
  - Layout versions.
  - On-canvas padding and gap handles.
  - Resizing rules while editing.
- **Parity scope (327).** AL 218, FR 71 (constraints FR-153…FR-189, layout guides FR-190…FR-219, others by tag), CV 9, TX 8, DS 7, UX 5, VC 3, PE 3, IO 3.
- **Exit criteria.**
  - The gate in §7.2.
  - Numeric fixtures within ε 0.01 px for every enum member.
  - Dual-run scenarios (ADR-025) for reflow.
  - PB-06.
  - The semantics of "Layout = Updated" versus Legacy layout are verified (architecture §12, item 1; `[OBS]` saw a "Layout = Updated" control).
- **Dependencies.** M1 (frames), M3 (text sizing in auto layout).

### 7.8 M5 Components

- **Goal.**
  - Components and instances, with the override model keyed by stable paths.
  - Propagation, reset, swap and detach.
  - Nested and exposed instances.
  - Variants and component sets.
  - Component properties: boolean, text, instance swap, variant.
  - **Slots.**
- **Parity scope (290).** CP 221, UX 19, AL 12, FR 9, DS 8, CV 6, PE 4, TX 4, IO 4, VC 2, PR 1.
- **Exit criteria.**
  - The gate in §7.2.
  - PB-07.
  - Dual-run override scenarios.
  - An invariant checker on commit reports no instance corruption.
  - The slot binding key and the `resetSlot` target are resolved (CP open questions).
- **Dependencies.** M4 (auto layout inside components), M3 (text properties).

### 7.9 M6 Design systems

- **Goal.**
  - Paint, text, effect and grid styles.
  - Variables, collections, modes and extended collections; aliases, scopes and code syntax; bindings everywhere.
  - Mode resolution.
  - **Local** libraries: publish, link, review and accept updates, swap.
  - The assets panel.
  - DTCG export and import.
- **Parity scope (285).** DS 198, IO 26 (local libraries IO-082…IO-091, DTCG IO-209…IO-220, others by tag), TX 17, CP 12, PE 11, FR 9, AL 4, CV 3, VC 3, UX 2.
- **Exit criteria.**
  - The gate in §7.2.
  - PB-13.
  - Variable-resolution fixtures, including explicit and inherited modes and extended collections.
  - DTCG output matches Figma's native export (DS V-60).
- **Dependencies.** M5. The DS product questions Q1–Q5 use the documented defaults unless the user decides otherwise (U-11).

### 7.10 M7 Prototyping

- **Goal.**
  - The reactions model and the Prototype tab.
  - A runtime state machine and a local player window with live updates.
  - Transitions, including smart animate and springs.
  - Overlays.
  - Scrolling, fixed and sticky.
  - Variables, conditionals and expressions.
  - Interactive components and flows.
  - Presentation, fully offline.
- **Parity scope (290).** PR 263, IO 8, CP 7, FR 3, DS 3, UX 3, PE 2, TX 1.
- **Exit criteria.**
  - The gate in §7.2.
  - Deterministic virtual-time tests.
  - The player frame budget equals PB-01.
  - Transitions are compared against recordings of Figma at 60 fps or more.
  - Prototype time units are fixed by PR V-01 **before** the file format freezes.
- **Dependencies.** M4, M5 and M6. U-10 (Figma Motion) must be decided before M7 exits.

### 7.11 M8 Interop & hardening

- **Goal.**
  - SVG import.
  - Figma-JSON (REST) import.
  - Clipboard interop (SVG, PNG, HTML).
  - The **feasibility- and legally-gated** `.fig` import and Figma paste (U-05).
  - The version-history UI.
  - Animated export.
  - Performance hardening (ADR-002b if triggered).
  - WebGPU evaluation.
  - Editor accessibility.
  - Auto-update and signing.
  - Diagnostics.
- **Parity scope (146).** IO 81, UX 16, PR 11, AL 10, FR 6, TX 5, PE 4, DS 4, CV 3, VC 3, CP 3.
- **Exit criteria.**
  - The gate in §7.2.
  - The full PB suite on RH-1…RH-3.
  - A 30-minute soak test with no leaks.
  - SVG-import fixtures.
  - A WCAG 2.2 AA audit of the chrome.
  - Release signing (U-12).
- **Dependencies.** All earlier milestones.

---

## 8. Gate G0: review passes before M0 implementation

**This work is pending. It must be finished before any M0 implementation slice starts.** Each task is one documentation-only PR. Every review must:

- **(a)** re-check every `[API]` claim against typings v1.141.0 and REST types v0.44.0;
- **(b)** check every `[DOC]` ID against the source catalog, and mark excerpt-only evidence;
- **(c)** find correctness claims that rest only on `[KNOW]` or `[SRC]` and lack a §8 experiment, and add one;
- **(d)** make every item atomic and testable, with concrete values;
- **(e)** check the milestone and priority tags against §7;
- **(f)** resolve or cross-link the conflicts in §15.3;
- **(g)** update `docs/parity/CHECKLIST.md` by recounting;
- **(h)** add an honest, dated review log (§10 of the doc) that says what was and was not checked.

| ID | Task | Notes |
| --- | --- | --- |
| RV-01 | Review [CV](docs/parity/01-canvas-selection-transform.md) | Resolve its §8.2 conflicts with UX (snapping-suspension key, Outlines shortcut) and FR (top-level frame background click). |
| RV-02 | Review [FR](docs/parity/02-frames-groups-sections-constraints.md) | Its §8.2 conflicts: clip default, constraints on groups, layout-guide shortcut, section padding and fill. |
| RV-03 | Review [AL](docs/parity/03-auto-layout.md) | Grid padding and alignment semantics, Shift+A inference, rounding. |
| RV-04 | Review [VC](docs/parity/04-shapes-vectors-booleans.md) | Boolean stroke contribution (VC-180), Draw-era operation scope, TRANSFORM_GROUP and TEXT_PATH reservation. |
| RV-05 | Review [PE](docs/parity/05-paint-effects-color-export.md) | Its §8.3 source conflicts: glass, section blend, GIF, effects list, copy-as shortcuts. |
| RV-06 | Review [TX](docs/parity/06-text-typography.md) | Storage of OpenType numeric features (E-OT-1), the fields a text style carries, the resize rule (E-RS-2). |
| RV-07 | Review [CP](docs/parity/07-components-variants.md) | **Fix the header-versus-content mismatch**: restore E-37…E-47 or remove the citations; restore or delete the claimed CP-244…CP-262 and §10. |
| RV-08 | Review [DS](docs/parity/08-variables-styles-design-systems.md) | **Fix the header mismatch** (DS-247…DS-293, V-77…V-91, §10). |
| RV-09 | Review [PR](docs/parity/09-prototyping.md) | **Fix the header mismatch** (PR-276…PR-313, §10). Decide who owns Figma Motion (U-10). |
| RV-10 | Review [UX](docs/parity/10-panels-shortcuts-workflow.md) | Reconcile the keymap with CV, FR and PE. Decide the storage of per-file view state (§15.3, C-09). |
| RV-11 | Review [IO](docs/parity/11-file-format-interop.md) | Collect the schema-freeze blockers (§15.2) into the format spec. |
| RV-12 | Review [architecture](docs/architecture.md) | Re-check package versions, align ADRs with the parity docs (view state, undo scope), finish the interrupted review. |
| RV-13 | Review [UI design system](docs/ui/design-system.md) | Consistency with FVR and with UX §4. Check the KIT items for testability. |
| RV-14 | Review [Framer visual reference](docs/ui/framer-visual-reference.md) | Re-check sources, and fold in any Framer captures the user provides (U-04). |
| RV-15 | Cross-document conflict sweep | Each conflict in §15.3 ends with both documents pointing to the same experiment, and the same interim rule. |
| RV-16 | Move the observation log and add a template | Copy the 2026-09-27 `[OBS]` log into `docs/figma/observations/`. Remove the private file link if the repository is or may become public. Add a before / action / after template for new logs. |

**Exit criteria for G0:**
- all 16 tasks are merged;
- CHECKLIST checks 3–6 pass, with **no** undefined-ID references;
- no header claims content that does not exist;
- the user has answered, or explicitly deferred, U-01…U-04.

## 9. M0 implementation slices

Rules for slices:
- Work in the order shown.
- One slice is one PR.
- If a slice grows beyond about 1,500 changed lines or about 25 checklist items, split it along the checklist sections it covers. Never split one item across PRs.
- Every PR lists the item IDs whose status it changes, and its tests carry those IDs in their titles.

| # | Slice (one PR) | Covers | Acceptance tests (required to merge) |
| --- | --- | --- | --- |
| M0-01 | **Repository scaffold and CI.** pnpm workspaces, Turborepo, TS 7 strict, Biome, dependency-cruiser with the layering rules of architecture §3.2, empty packages as laid out in ADR-023, and CI on macOS, Windows and Linux. | QA-05 | (1) A clean clone runs `pnpm install && pnpm check` green on all three OSes. (2) A commit that makes `ui-kit` import `render` fails dependency-cruiser and names the rule. (3) `AGENTS.md` "Check commands" are filled in by the same PR. |
| M0-02 | **Test harness and parity matrix.** Vitest and fast-check; a Playwright skeleton; `tools/parity-matrix`, which reads `[ID]` test titles and the area docs and writes `docs/parity/matrix.generated.md` and `parity-matrix.json`; the CHECKLIST §8 checks in CI. | ADR-024 | (1) A todo test `[CV-001]` shows CV-001 as *In progress*. (2) A test titled `[CV-9999]` (an ID that does not exist) fails CI as an unknown ID. (3) A duplicate ID, an untagged item, or a hand-ticked `- [x]` without evidence fails CI. (4) Unit tests derive all four statuses, the *Requirement* annotation and staleness demotion (§12). |
| M0-03 | **Schema DSL v0, codegen and coverage.** Figma property names. Generated TS types, msgpack codecs, validators and defaults. `tools/schema-coverage` against plugin typings 1.141.0. The v0 types are DOCUMENT, PAGE, FRAME, GROUP, SECTION, RECTANGLE, ELLIPSE, POLYGON, STAR, LINE, VECTOR (network data) and a TEXT stub; every other node type is an opaque, preserved record. | FR-001…FR-003, FR-007, FR-009, IO-020, VC-094 (data) | (1) The coverage report classifies every SceneNode type and every property of the v0 types as mapped or deferred-with-ID; 0 are unclassified. (2) Setting a property on a node type that does not allow it is a type error and a validation error (FR-001/002). (3) Every `LayoutGrid` variant round-trips (FR-009). (4) Generated defaults for a new frame match FR-003 (values pending FR V-03; until then the item stays *Implemented*). |
| M0-04 | **Model core and transactions.** Node store, stable ids that are never reused, parent pointers, fractional-index child order, `doc.transact`, ChangeSets, and a debug freeze outside transactions. | IO-041, IO-042, FR-006, FR-017, DS-008; INV-01, INV-10 | (1) A property test of 10k random create, delete, reparent and reorder sequences keeps the tree invariants: one parent, no cycles, no orphans, groups never empty. (2) A mutation outside a transaction throws in a debug build. (3) Ids are never reused. (4) A ChangeSet lists exactly the (node, property) pairs that were touched. |
| M0-05 | **Geometry core.** 2×3 transforms; `relativeTransform` and `absoluteTransform` composition with container-parent rules; the rotation convention; the unit-axis invariant; `absoluteBoundingBox` versus `absoluteRenderBounds` for primitives. | CV-001…CV-003, CV-005…CV-008, FR-005, FR-052 | (1) The item tests run headless; for example, CV-001: rect B at (100,50) exports offset by (100,50) at 1×. (2) Numeric goldens follow the formulas documented in the typings. (3) When M0-20 fixtures exist, the same tests read `fx/CV-00x` captures, and those items become eligible for *Validated*. |
| M0-06 | **History engine.** Undo entries with inverse ops and the selection before and after; gesture transactions; coalescing keys; cross-page undo; redo clearing; a memory bound; `commitUndo`. | CV-252…CV-255, UX-193…UX-197, UX-199, UX-200, DS-207, DS-208, PE-244, VC-226 (model), IO-059 | (1) Fuzzing 10k op sequences: undo-all gives a canonical JSON equal to the initial state, and redo-all equals the final state. (2) A 120-event drag gives one entry; a cancelled drag gives none (CV-255). (3) Viewport, selection-only and UI changes add no entry (CV-253, UX-196). (4) A commit after undo clears redo (UX-199). (5) Undoing a page-2 edit while on page 1 switches to page 2 and restores the selection (UX-195, CV-254; Figma behavior is pending experiments, so these items remain *Implemented*). |
| M0-07 | **Spike S1: render and performance.** CanvasKit in Electron and in the browser; the SD-10kV and SD-100k generators; a prototype tile cache and picture cache. | PB-01…PB-05, PB-08 | Bench JSON is committed for every available reference machine. A dated results section is added to `docs/architecture.md`. The go/no-go on ADR-002/003 is recorded (Rust fallback if a budget is missed by more than 20 %). Spike code is promoted or deleted. |
| M0-08 | **Render core v0.** RenderTree with diffs; solid fills and strokes for primitives; clip; tiles; picture cache; overlay pass; DPR handling; rebuild after context loss; a CPU raster path for goldens. | UX-188 | (1) Approved CPU goldens for a 20-scene primitive suite. (2) GPU output matches CPU output within tolerance. (3) Sharp output at DPR 1, 1.25 and 2 (UX-188). (4) A forced context loss rebuilds within 1 s with identical pixels. (5) PB-01/PB-02 on SD-10kV either pass or are filed with numbers. |
| M0-09 | **Hit-testing core.** A per-page R-tree, an ordered hit list, clip awareness, hidden and locked flags, and screen-pixel tolerances. | INV-07; groundwork for CV-053…CV-058 | (1) PB-08 is at most 1 ms p95 on the largest SD-100k page. (2) The same screen-pixel tolerance maps to the correct document distance at 25 %, 100 % and 800 % zoom and at DPR 1 and 2. |
| M0-10a | **Compositing.** Blend formulas; pass-through versus isolated containers; group opacity; the colour-managed canvas (sRGB and Display P3). | PE-009, PE-113, PE-114, PE-118, PE-202 | (1) Unit tests for each formula in PE §3. (2) CPU goldens for every blend mode, both pass-through and isolated. (3) The items stay *Implemented* until the PE V-03 and V-12 fixtures exist. |
| M0-10b | **Gradients, images and the shadow and blur models.** Gradient evaluation and conversion between transforms and handles; content-addressed image assets; the missing-image placeholder; image sampling; shadow geometry; inner-shadow stacking; the progressive-blur model. | PE-061…PE-064, PE-070, PE-090, PE-091, PE-163, PE-169, PE-174 | (1) Gradient evaluation matches the PE §3.3 formulas at 50 sample points per gradient type. (2) Handle↔transform conversion round-trips within 1e-9. (3) A missing blob renders the placeholder and does not throw (PE-090). |
| M0-11 | **File format v1 container and codecs.** The ZIP container of architecture §7: manifest, page chunks, shared chunk, SHA-256 blobs, thumbnail, preserved extensions, the canonical `illigma-json` form, and version gates. | IO-001, IO-003…IO-006, IO-010…IO-013, IO-017, IO-019, IO-040, IO-043, FR-015, FR-039, VC-235, PE-016 | (1) Property test: random documents, including opaque node types, survive save → load → canonical JSON identity. (2) Unknown fields are preserved verbatim (IO-005). (3) A newer `formatVersion` is gated as IO-004 specifies. (4) A corrupted chunk opens in recovery mode (IO-003). (5) Canonical output is byte-stable (IO-006). |
| M0-12 | **doc-io.** Atomic save, journal, autosave, recovery, detection of external modification, disk errors, migrations. | IO-002, IO-048, IO-050, IO-051, IO-054, IO-060, IO-073, IO-074, UX-168, UX-169, UX-171…UX-173 | (1) IO-002: 1,000 kills at random offsets while saving a 100 MB file; every result opens and equals either the pre-save or the post-save state. (2) Killing the process during editing loses at most 1 s of edits (PB-12). (3) Disk-full and permission errors follow the IO-060 flow with no loss. (4) An external change is detected (UX-173). (5) Migrating from a synthetic v0 file creates a backup first (IO-073/074). |
| M0-13 | **Host, Electron shell and browser build.** HostPort for Electron, the browser and memory; the hardened configuration of ADR-026; windows; dialogs; the single-instance lock; OPFS for the browser build. | IO-009 | (1) The E2E suite passes with networking disabled (IO-009). (2) The renderer has no Node access, navigation and `window.open` are blocked, and the CSP rejects remote scripts. (3) PB-05 is measured. (4) One scenario passes in both the browser and the Electron build. |
| M0-14 | **Interaction core.** The tool state-machine base; the drag threshold in screen pixels; the pointer-capture, blur and visibility policy; the Command Registry; keymap scopes (IME > text input > modal > canvas tool > global); undo and redo commands. | CV-256, CV-262, CV-266, UX-150, UX-198; INV-03, INV-06 | (1) A synthetic `lostpointercapture` mid-drag ends the gesture deterministically; it never stays half-applied (CV-262). (2) Typing `v`, `r` or `1` in a focused field or during IME composition fires no command (CV-266). (3) Undo and redo bindings match CV-256 and UX-150 on macOS and Windows. (4) The registry generates a menu model with shortcuts and enablement. |
| M0-15 | **Spikes S2 and S3: text and fonts.** 30 text fixtures through SkParagraph plus the box layer; font scanning on three OSes; bundled Inter. | ADR-007, ADR-008 gates | (1) Line-box and baseline error is at most 0.5 px on the fixtures. This needs U-03; without it, the result is measured against self-goldens and recorded as "gate pending". (2) The font service lists system fonts on all three OSes. (3) Both outcomes are recorded in `docs/architecture.md`. |
| M0-16 | **Tokens and theming.** `tokens.json` → CSS variables, TS and canvas-chrome values; a raw-value lint; dark, light and system themes; the locked-token guard; the contrast gate; reduced motion; Inter 4 with `cv01 cv05 cv09 cv11`; tabular figures. | KIT-001…KIT-009, KIT-011, KIT-012, KIT-108, FVR-001…FVR-004 | (1) `color: #fff` in a module fails the lint (KIT-002). (2) A theme toggle happens in one frame, and the document hash and undo depth are unchanged (KIT-003). (3) A colour pair below 4.5:1 fails the contrast gate (KIT-008). (4) Glyph checks for FVR-002. (5) Canvas chrome reads its colours from the same token source (KIT-108). |
| M0-17 | **Kit primitives, batch 1, and the Workbench.** Icon, Button, IconButton, ToggleIconButton, SegmentedControl, Checkbox and Radio, Select, Menu and ContextMenu; state matrices in the Workbench. | KIT-014…KIT-017, KIT-030…KIT-034, KIT-036, KIT-037, KIT-041…KIT-043, KIT-099, KIT-100, KIT-117; FVR-005…FVR-007, FVR-010…FVR-012, FVR-014, FVR-015, FVR-033 | (1) The Workbench renders every state in both themes. (2) Keyboard E2E covers roving tabindex, menus and placement. (3) An audit confirms hit targets of at least 24×24 (KIT-032). (4) A no-layout-shift test (KIT-033). (5) No proprietary icon artwork (KIT-016). |
| M0-18 | **Kit primitives, batch 2, and visual regression.** Dialog, Toast, Tooltip, Popover, ScrollArea, TextField and a basic NumberField (scrubbing comes in M1); visual snapshots in CI; the Framer reference overlay. | KIT-104, KIT-105, KIT-107, KIT-118, KIT-119, KIT-121; FVR-008, FVR-023, FVR-024, FVR-034, FVR-036 | (1) Visual snapshots for each state in each theme. (2) The KIT-121 edit contract: Enter commits, Esc reverts, blur commits. (3) Dialogs trap and restore focus. |
| M0-19 | **Editor shell layout.** The regions of design-system §4: the rail; the left header with file name, save status, undo and redo; the right header with the Design/Prototype tabs; the canvas; a placeholder floating bottom toolbar; the zoom pill. Window chrome per OS, resizable panels, interface scale, F6 region cycling, toasts. | KIT-023, KIT-122, UX-170, UX-187, UX-189, UX-192 | (1) The minimum window is 960×600, and the canvas never gets narrower than 360 px. (2) Panel widths persist per device and never dirty the document. (3) The save-status indicator follows doc-io events (UX-170, KIT-122). (4) Toasts never take focus (UX-192). (5) Interface scale changes only chrome tokens (UX-187). |
| M0-20 | **Figma fixture exporter v0 and Scenario API (spike S5).** A development plugin with an allowlist guard (`fixtures/figma/config.json`); exports of `fx/<ID>/<case>` frames (JSON_REST_V1, plugin dumps, PNG 1×/2×, SVG, PDF) with `meta.json`; a headless Scenario-API runner in Illigma. | ADR-025 | (1) Unit test: a file key not on the allowlist makes the plugin refuse, with **no** mutation. (2) A dry run **in the user's disposable file** (U-03) captures fixtures for CV-001…CV-008, FR-001…FR-003 and PE-062…PE-064. (3) The tests of M0-05 and M0-10 read those fixtures, and the matrix shows the first *Validated* items. Without U-03, the matrix shows them as *Implemented* with the note "awaiting fixture". |
| M0-21 | **Performance gates in CI.** `bench` per reference machine; baselines for PB-01…PB-05, PB-08, PB-12 and PB-14; a regression of more than 10 % fails the build. | architecture §8 | (1) CI publishes the bench JSON. (2) An injected 20 ms sleep in the render loop fails the gate. |
| M0-22 | **M0 exit audit.** Run the §7.2 gate; capture any missing fixtures; update CHECKLIST and §17. | — | The gate checklist is attached to the PR, and each criterion links to evidence. |

## 10. M1 implementation slices

The same slice rules apply as in §9. The "Covers" column lists checklist sections. Only the items in those sections tagged `_M1·…_` are in scope; items in the same section tagged for another milestone are not. Many M1 items carry `→V-nn` or `(V-nn)` pointers to experiments. Those items can become *Validated* only after the experiment has been recorded; until then they stop at *Implemented*.

| # | Slice (one PR) | Covers | Acceptance tests (examples; every in-scope item's own test is mandatory) |
| --- | --- | --- | --- |
| M1-01 | **Viewport and navigation.** Wheel and pinch zoom anchored at the pointer; scroll pan; Space-drag; the Hand tool; keyboard zoom steps; ⇧0, ⇧1, ⇧2; the zoom pill. The viewport is view state. | CV-015…CV-035 | CV-017 pointer-anchored zoom keeps the document point under the cursor fixed. CV-024 sets zoom to exactly 1.0. CV-015: the viewport never dirties the document or the undo stack. PB-01 and PB-02 on SD-10kV. The zoom ladder waits for CV V-05. |
| M1-02 | **Pages.** Add, rename, duplicate, delete and reorder pages; switching restores selection and viewport; the page background. | UX-071…UX-086, CV-048…CV-052 | UX-072…UX-079 and UX-083. Undoing a page delete restores the same ids. Page background defaults follow U-06/D-8 (Figma parity is recommended). |
| M1-03 | **Toolbar and the Rectangle tool.** The bottom floating toolbar with Figma's tool groups; creation rules for R. | UX-124…UX-130, VC-001…VC-004, VC-008, VC-010, VC-012, VC-013, VC-015, VC-021…VC-032 | VC-002: dragging R from (200,200) to (100,150) gives x=100, y=150, w=100, h=50. VC-015: creation is one undo step. UX-127: the tool reverts after use. VC-024: radius clamp (VC E-07). |
| M1-04 | **Hover and click selection.** Topmost-first picking; hidden, locked and clipped layers; click-depth rules; double-click descends a level; deep select; Shift toggles; Enter, ⇧Enter, Tab; Esc. | CV-053…CV-081 | CV-053…CV-058 picking, using M0-09 tolerances. CV-068 double-click descends one level. CV-073 ancestor/descendant invariant. CV-066 and CV-078 stay *Implemented* until CV V-19 and V-22 are recorded. |
| M1-05 | **Marquee, bulk selection, lock and hide.** | CV-082…CV-106 | CV-090: a zero-area marquee equals a click. CV-088: hidden and locked layers are excluded. CV-083: full containment for top-level frames (CV V-24). CV-100 and CV-105 inheritance. |
| M1-06 | **Move and reparent.** The drag threshold; the selection moves exactly once; Shift locks the axis; Alt duplicates; reparenting into and out of frames; the drop-target rule. | CV-107…CV-121 | CV-109: with a frame and its child both selected, a drag moves the child exactly once (INV-04). CV-114 and CV-115 reparenting. CV-121: a move changes only the translation. PB-03 and PB-04. |
| M1-07 | **Nudge and arrange.** | CV-122…CV-128, CV-242…CV-246, UX-202 | CV-122 and CV-123: 1 px and 10 px nudges (nudge preferences per UX-202). Nudge coalescing per architecture §6 (pending CV and UX experiments). CV-244: arrange never reparents. |
| M1-08 | **Resize and numeric precision.** Handles; Shift and Alt; aspect lock; local axes for rotated nodes; group resize scales its children; multi-selection; W/H anchoring in the inspector; resize snapping; display precision; mixed values. | CV-129…CV-147, CV-168…CV-174 | CV-131: Alt resizes from the centre. CV-138: a group resize scales its children. CV-136: a frame resize applies constraints (for freeform children only; full constraints are M4). INV-05: frame bounds never follow their children. |
| M1-09 | **Rotate, flip and the Scale tool.** | CV-148…CV-167 | CV-150: Shift snaps rotation to 15°. CV-153: rotating a container keeps its children's local transforms. CV-159: flip encoding (CV V-03). |
| M1-10 | **Snapping and smart guides.** | CV-175…CV-188, FR-025 | CV-177: the snap threshold is constant in screen pixels at 25 %, 100 % and 800 %. CV-179: equal-spacing snapping. CV-188: guides never change the document. |
| M1-11 | **Measurement (redlines).** | CV-189…CV-196 | CV-189: Alt-hover measurement. CV-196: measuring is read-only (no document change and no undo entry). |
| M1-12 | **The other primitive tools.** Ellipse (arc data), Polygon, Star, Line and Arrow; the shape inspector; copy and paste fidelity. | VC-033…VC-070, VC-018, VC-019, VC-105, VC-228 | VC-061: a line has no height. VC-050 and VC-053 polygon and star geometry against VC E-03 fixtures. VC-019: a resize keeps parametric data. |
| M1-13 | **The Frame tool, presets and structure.** | FR-019…FR-052 | FR-020: a click makes a 100×100 frame. FR-028: the frame adopts enclosed layers. FR-050: a cycle is refused. FR-043: frame bounds are independent of content. |
| M1-14 | **Frame labels and clip content.** | FR-053…FR-074 | FR-057 and FR-058: clicking a label selects the frame, and dragging the label moves it. FR-065: nested clips intersect. FR-072: the default clip waits for FR V-07. |
| M1-15 | **Groups, frame selection, remove frame, resize to fit.** | FR-075…FR-119 | FR-106: removing the last child deletes the group. FR-108: a group resize scales its children. FR-088: Ungroup removes a frame. Keyboard paths per FR-244. |
| M1-16 | **Sections.** | FR-122…FR-152 | FR-130: nesting refusals. FR-134: the containment rule for adoption. FR-139: resizing a section leaves its children alone. FR-140: sections cannot rotate or blend. |
| M1-17 | **Layers panel, part 1.** The tree, rows, selection, expand and collapse, revealing the selection. | UX-001…UX-033 | UX-001: top-most-first order. UX-018: Shift-click selects a range. UX-024: arrow keys never move row focus, they nudge. PB-10: 100k rows scroll at 60 fps. |
| M1-18 | **Layers panel, part 2.** Rename; drag to reorder and reparent; lock and visibility. | UX-034…UX-070, FR-240 | UX-039: a rename is one undo step. UX-051: reparenting keeps the canvas position. UX-054: Esc cancels a drag, and a completed drag is one undo step. |
| M1-19 | **Inspector structure and basic sections.** The Design/Prototype tabs; the selection header; Position (X, Y, W, H, rotation and the alignment bar); Layout for freeform frames; Appearance; mixed values; field commit keys; NumberField scrubbing and expressions. | UX-097…UX-123, FR-233…FR-242, KIT items tagged M1 | UX-099: the frame inspector order matches Figma (UX I- experiments). UX-118: the "Mixed" placeholder. UX-123: commit keys. PB-10: from selection to a complete inspector in at most 16 ms. |
| M1-20 | **Solid fills, strokes and opacity.** The paint stack; the solid colour picker (HSB, hex, RGB, opacity); live preview with one commit; layer opacity and number keys; stroke defaults, weight and position; selection colours. | M1 items of PE-001…PE-038, PE-111…PE-158, PE-159…PE-197 | PE-001: fill order. PE-025: hex parsing (PE V-08). PE-032: dragging in the picker is one undo step. PE-117: number keys set opacity. PE-190 and PE-191: mixed paints. |
| M1-21 | **Align, distribute, Tidy up, Smart selection.** | CV-197…CV-211 | CV-197: multiple layers align to the union bounds. CV-198: a single layer aligns to its container. CV-202: distributing spacing. |
| M1-22 | **Duplicate and clipboard.** ⌘D placement and offset memory; copy, cut and paste in place or into a frame; clipboard flavours; reference remapping. | CV-221…CV-241, IO-045, IO-172…IO-184, PE-237…PE-243, FR-221, FR-224 | CV-230: pasting into a selected frame fits per axis. IO-174: paste priority. IO-184: a paste is one undo step and selects its result. PE-243: copying a layer keeps its assets. |
| M1-23 | **Menus, context menus, the Actions menu, the keymap, cursors.** | UX-131…UX-150, CV-247…CV-251, FR-243…FR-247 | UX-143: a test of the complete default keymap (macOS and Windows/Linux). UX-145: suppression during text input. CV-249: a right-click selects, then opens the menu. UX-138: menus show shortcuts and disable items that do not apply. |
| M1-24 | **View modes, rulers and guides, view toggles, preferences.** | CV-036…CV-047, CV-212…CV-220, UX-178…UX-188, UX-202…UX-214 | CV-037: the snap-to-pixel-grid preference. Ruler guides persist per page. UX-213 and UX-214: guards for out-of-scope items. |
| M1-25 | **File workflows.** New, Open, Open Recent, Save, Save As, Save a copy; closing or quitting with pending changes; untitled documents; the single-writer lock; the recovery UI. | IO items tagged M1 (IO-008, IO-018, IO-052, IO-053, IO-056 and others) | IO-053: an untitled document survives a crash. IO-056: a second instance gets the lock message. IO-052: explicit save (the Figma analogue waits for UX H-02). |
| M1-26 | **Cross-cutting items and the M1 exit audit.** | FR-220…FR-232, CV-257…CV-266 (M1 tags) | The FR-220 undo granularity checks. The full M1 matrix. The §7.2 gate, with evidence links. |

---

## 11. Parity validation process

Each feature passes through five stages, and parity status is the last of them: **behavior contract → Figma evidence → implementation → tests → parity status.**

1. **Behavior contract (refresh before substantial work).**
   - The contract is the area spec: §3 holds the behavior, §6 the items.
   - Before implementing, re-read the items and their §3 text. Check them against the pinned typings version. Resolve or link conflicts (§15.3).
   - Make sure every clause has a concrete expected value and a test.
   - If the expected behavior changes, update the spec, its tags and CHECKLIST first, in a documentation commit or PR, before or alongside the code.
   - Deliberate deviations from Figma are written as *Illigma extension* or *[DECISION]* entries, and only when the user has asked for them or the spec allows them.
2. **Figma evidence.**
   - Run the area §8 experiments that gate the items, **only in the user-designated disposable fixture file**.
   - Interaction-only behavior is recorded as a dated observation log, `docs/figma/observations/<YYYY-MM-DD>-<topic>.md`, with setup → action → result. The log records the platform, the Figma version, the keyboard layout and the modifiers.
   - Data and render behavior is captured with the fixture exporter into `fixtures/figma/<area>/<ID>/<case>/`, together with `meta.json`.
   - Then update the item's tags. New evidence is cited as `[OBS:<YYYY-MM-DD-topic>]` or `[FIX:<area>/<ID>/<case>]`. The plain `[OBS]` tag stays reserved for the 2026-09-27 log.
3. **Implementation.**
   - Build the feature through the whole data path: schema, transactions and undo, derived pipeline, render, hit-testing, panels, persistence, clipboard and export.
   - Unfinished features stay behind a feature flag (architecture §9).
4. **Tests.**
   - Every test title carries the item IDs it proves, for example `[CV-109]`.
   - Use the layer that fits the behavior: unit or property tests, numeric goldens, render goldens, or interaction E2E (ADR-024).
   - Every clause, modifier and edge case of the item gets an assertion.
   - Keyboard items are tested with both the macOS and the Windows/Linux keymaps.
5. **Parity status.**
   - `tools/parity-matrix` derives the status (§12). A PR lists the IDs whose status changes, and reviewers check the evidence links.
6. **Staleness and re-validation.** *Validated* drops back to *Implemented* when any of these happens:
   - a newer pinned typings release changes the types involved;
   - a newer observation contradicts the evidence;
   - for a P0 item at its milestone's exit, the fixture is more than 6 months old [DECISION].

   Re-capturing the evidence restores the status.

## 12. Status definitions

| Status | Definition | Who sets it |
| --- | --- | --- |
| **Not started** | No test is linked to the item ID. This is the status of all 2,878 items today. | Derived |
| **In progress** | At least one linked test exists, and at least one fails or is skipped or todo. | Derived |
| **Implemented** | Every linked test passes in CI on all supported platforms. The behavior is reachable in the product build. It has not yet been compared against Figma evidence, or the evidence is stale. | Derived |
| **Validated (1:1 parity)** | *Implemented* **and** all of the "validated against Figma" criteria in §7.2 are met. Only this status may be described as "1:1 parity" or "matches Figma". | Derived; reviewers check the evidence |
| *Requirement* (annotation) | The item's tags are only Illigma-requirement tags: `[ILL]`, `[REQ]`, `[DECISION]` or similar. There is no Figma behavior to validate, so *Implemented* is final. These items are reported separately from parity percentages (65 items today, by the heuristic in CHECKLIST §7.1). | Derived from tags |

- **No status is ever set by hand.** Checkboxes in the area docs are ticked only for *Validated* items, together with their evidence (CHECKLIST §1).
- **"Parity" language for an area or milestone** is allowed only when 100 % of its P0 and P1 items are *Validated*. Release notes say "implemented" otherwise.

---

## 13. Risk summary

The architecture risks R-01…R-15 are in `docs/architecture.md` §10. The planning risks are added here.

| Risk | Likelihood / impact | Mitigation |
| --- | --- | --- |
| **The evidence base is weak.** 45 % of items rest only on `[KNOW]`/`[SRC]`, and Help Center content was seen only in excerpts. A spec could encode the wrong behavior. | H / H | Gate G0 reviews. Experiments run before *Validated*. Statuses never claim parity without evidence. Specs are refreshed per slice (§11, step 1). |
| **No access to Figma fixtures** (U-03). Nothing can become *Validated* (R-14). | M / H | Ask now. Batch the captures. The read-only REST route is an alternative. Observation logs cover interactions. Without fixtures, the plan reports "Implemented, not validated". |
| **Scale of scope.** 2,718 parity items and 160 UI items. | H / H | P0-first exit gates, PR-sized slices, automated status tracking, deferral only by explicit re-tag. |
| **Rendering and text fidelity** (R-01, R-03) | H / H | Spikes S1, S2 and S6; golden tolerances; SkSL effect library; harfbuzzjs fallback. |
| **Performance at 10k–100k nodes** (R-02, R-06) | M / H | Benchmarks gate from M0; tiles and picture caches; lazy instance expansion; Rust/WASM fallback trigger. |
| **Semantics of auto layout, overrides and variables** (R-04, R-05) | H / H | Normative algorithms in the specs, dual-run scenarios, property tests, an invariant checker on commit. |
| **Data loss** (R-07) | M / Critical | Atomic save, journal, fault injection from M0; data-loss bugs block release. |
| **Figma is a moving target**: monthly typings releases, Draw, Motion, slots, grid (R-08, R-12) | H / M | Pinned typings with a coverage diff per release, lossless preservation of unknown data, explicit "later" scope (§3.3). |
| **Legal and IP**: `.fig` and clipboard interop; Framer trade dress | M / H | `.fig` is disabled by default behind a legal gate (IO-199, U-05). Illigma uses its own icon set and copies no Framer assets (KIT-016). Framer is a *visual reference*, not a source of assets. |
| **Integrity of the planning docs**: interrupted reviews and conflicts (§6.2, §15.3) | H / M | Gate G0 (RV-01…RV-16), recount checks in CI from M0-02. |
| **Framer look unverified**: no live Framer capture | H / L | Provisional tokens are labelled "verify"; U-04 captures; values are switchable through tokens. |
| **Fonts and licensing** (R-13), and storing glyph outlines for missing-font preview | M / M | Bundled Inter for fixtures, deterministic substitution, U-09 before the M3 format freeze. |
| **Electron footprint, security and GPU variance** (R-10, R-11) | M / M | Hardened configuration, fuses, upgrade cadence, tests across reference machines, CPU raster fallback. |

## 14. Open decisions for the user

### 14.1 Needed before or during M0

| ID | Decision | Options | Default if unanswered | Blocks |
| --- | --- | --- | --- | --- |
| **U-01** | **Toolbar placement.** Confirm the floating **bottom** toolbar, or switch to Framer's top-toolbar pattern. | A: bottom (your earlier choice; Figma UI3 also has a bottom tool strip `[OBS]`). B: Framer-style top bar plus a floating canvas toolbar. | **A**, already locked as C-1 | M0-19 |
| **U-02** | **Platforms and shell.** | macOS, Windows, Linux; install size of roughly 100 MB or more `[KNOW]`, in exchange for identical rendering everywhere | **All three on Electron**, Linux GPU best-effort (Q-1, Q-2) | M0-01, M0-13 |
| **U-03** | **A disposable Figma fixture file.** Will you designate one (new, empty, never your real work), allow a development plugin to run in it, and optionally provide a read-only REST token? | Yes / no / partly | Without it, items can reach *Implemented* but **never *Validated***, and Illigma cannot claim parity (Q-3) | M0-20 and every *Validated* status |
| **U-04** | **Framer captures for token verification.** Screenshots, eyedropper samples and recordings from current Framer, per the list in FVR "Verification needed" (sections A–D). | Provide / skip | Values stay "verify against Framer"; the look is provisional | Locking FVR and KIT colours |

### 14.2 Needed later (each has a default, so work does not stop)

| ID | Decision | Default if unanswered | Needed by |
| --- | --- | --- | --- |
| **U-05** | **Licensing and legal stance on `.fig` import and Figma clipboard paste**, which require reverse-engineering a proprietary format | Not shipped. Only Figma-JSON (REST) import. `.fig` stays behind IO-199 | Before M8 |
| **U-06** | **Look decisions D-2…D-13** in design-system §8.2: layer-row selection style, button radius, field style, spacing base, panel background, the accessibility overrides of Framer colours, the default page background for new files (Figma parity versus your `#090909`), the navigation rail, the menu highlight, Framer geometry, icon weight, the zoom-menu location | The "Interim" column (the recommended options) | Gradually; D-8 before M1-02 |
| **U-07** | **Comments** in v1: local-only and single-author (UX-174…UX-177, P2 in M8), or drop them | Keep as P2 in M8 | M8 |
| **U-08** | **Illustrator-style Pathfinder.** Your earlier prototype had it as a deliberate feature. Figma has boolean groups and Shape builder instead. Keep Pathfinder as a clearly labelled *Illigma extension* after M2, or drop it? | Drop for now. Figma's booleans come first, and Pathfinder can be added as an extension later | M2 |
| **U-09** | **Storing glyph outlines** of user fonts in files so text can be previewed when a font is missing (a font-licensing question) | Do not store outlines. Store the layout metrics only | Before the M3 format freeze |
| **U-10** | **Figma Motion and Figma Draw** (timeline animation; brushes, repeats, variable width) | Data is preserved; editing is deferred until after v1 | Before M7 exits |
| **U-11** | **Undo history across reopen; mode cap; library container.** Figma does not keep undo after a reload `[KNOW]`. The DS questions Q1 (mode cap), Q2 (library container) and Q4 (find-usages extensions) are also open. | Follow Figma: undo is session-only. No hard mode cap below 40. Library snapshots embedded in the file. No find-usages extension | M6 for DS; M1 exit for undo |
| **U-12** | **Code-signing identities and an update host** (Q-6) | Unsigned development builds | First public release |

`docs/architecture.md` Q-4 (keep version history inside the file, on by default) and Q-7 (allow Rust if the WASM fallback triggers) keep their defaults unless you object.

---

## 15. Needs live Figma verification: roll-up

Every claim that affects correctness and rests only on `[KNOW]` or third-party sources is listed in its document's verification section. **All experiments run only in the user-designated disposable fixture file.** Experiment IDs are local to each document, so cite them with the prefix, for example "CV V-19".

### 15.1 Per area

| Area | Section | Experiments | Main topics (not exhaustive) |
| --- | --- | ---: | --- |
| CV | [01 §8](docs/parity/01-canvas-selection-transform.md#8-needs-live-figma-verification) | 59 | Zoom range and steps (V-05); flip encoding (V-03); click and drag thresholds; click on the empty background of a top-level frame (V-19); Esc (V-22); marquee containment (V-24); snapping-suspension key (V-42); paste placement (V-50) |
| FR | [02 §8](docs/parity/02-frames-groups-sections-constraints.md#8-needs-live-figma-verification) | 59 | Frame presets (V-01); default clip (V-07); section padding and fill (V-14, V-46); layout-guide shortcut (V-31); gutter on fixed grids (V-36); constraints on groups (V-43) |
| AL | [03 §8](docs/parity/03-auto-layout.md#8-needs-live-figma-verification) | 41 | Shift+A inference and defaults (V-02); Legacy versus Updated layout; rounding; padding and alignment on GRID; mapping of sizing to the API fields |
| VC | [04 §8](docs/parity/04-shapes-vectors-booleans.md#8-needs-live-figma-verification) | 50 | Click and drag creation thresholds (E-01); radius clamp (E-07); corner smoothing against `fillGeometry`; stroke contribution to booleans; availability of Shape builder and multi-edit |
| PE | [05 §8](docs/parity/05-paint-effects-color-export.md#8-needs-live-figma-verification) | 52 | Default paints (V-02); compositing (V-03); blur-sigma mapping; gradient colour space (V-12); glass (V-32); section blend (V-33); GIF paint type (V-19) |
| TX | [06 §8](docs/parity/06-text-typography.md#8-needs-live-figma-verification) | 63 | Click-create offset (E-CR-1); resize rule (E-RS-2); storage of OpenType numeric features (E-OT-1); AUTO line height; first baseline; leading trim; missing-font behavior |
| CP | [07 §8](docs/parity/07-components-variants.md#8-needs-live-figma-verification) | 36 | Sublayer id format (E-01); the matrix of overridable fields (E-07); nearest-variant fallback; restoring a component; swap override preservation (menu swap versus drag swap). E-37…E-47 are **missing** (§6.2). |
| DS | [08 §8](docs/parity/08-variables-styles-design-systems.md#8-needs-live-figma-verification) | 76 | Collection and mode defaults (V-01…V-07); precedence of modes in extended collections (V-46); DTCG export (V-60); cross-file paste of variables (V-69) |
| PR | [09 §8](docs/parity/09-prototyping.md#8-needs-live-figma-verification) | 38 | Delay units (V-01); connection gestures (V-02); defaults for new interactions (V-04); storage of flow descriptions (V-05); click threshold (V-07); video playback settings (V-24) |
| UX | [10 §8](docs/parity/10-panels-shortcuts-workflow.md#8-needs-live-figma-verification) | 79 | Layer-row selection and ranges (V-02, V-03); persistence of `expanded`; inspector section order (I-); toolbar (T-); the shortcut map on non-US layouts (S-); Cmd/Ctrl+S semantics (H-02) |
| IO | [11 §8](docs/parity/11-file-format-interop.md#8-needs-live-figma-verification) | 35 | Container of `.fig` local copies (V-01); checkpoint cadence (V-03); restore and undo (V-04, V-08); clipboard flavours (V-09) |
| Architecture | [§12](docs/architecture.md#12-needs-live-figma-verification) | 17 | Layout versioning; undo granularity; drag threshold; hit tolerances; blur sigma; colour spaces; text metrics; instance ids; bound-variable literals; smart-animate matching |
| UI design system | [§9](docs/ui/design-system.md#9-needs-live-figma-verification) | 31 | V-UI-01…V-UI-31: focus regions, layers keyboard model, scrub modifiers, colour-picker behavior, canvas overlay colours |
| Framer visual reference | [Needs live Figma verification](docs/ui/framer-visual-reference.md#needs-live-figma-verification) | 10 | Which chrome exists and when, for example tool grouping, overlay vocabulary, noodle styling |
| **Total** | | **646** | Run them in priority order: experiments that gate P0 items of the next milestone first (§7.2, item 4) |

### 15.2 Schema-freeze blockers (resolve before the relevant part of `.illigma` is frozen)

The file format has forward-only migrations (ADR-018), so freezing is not irreversible. Getting these right first still avoids migrations of user files:

1. Prototype time units: seconds or milliseconds (PR V-01).
2. Where flow descriptions are stored (PR V-05).
3. Video playback settings (PR V-24).
4. How fixed and sticky scroll behavior is represented (PR open question).
5. How OpenType numeric and position features are stored (TX E-OT-1).
6. The slot binding key and the `resetSlot` target (CP open questions).
7. The instance sublayer id format and the override key (CP E-01, architecture §12, item 11).
8. Whether a bound variable also stores its resolved literal (architecture §12, item 12).
9. What "Layout = Updated" means, and whether layout versions are per frame (architecture §12, item 1; AL).
10. Whether export quality and resampling are stored per export setting (PE open question).
11. Where per-file view state lives (C-09 below).

### 15.3 Cross-document conflicts to resolve in G0 (RV-15)

| ID | Conflict | Documents | Resolve by |
| --- | --- | --- | --- |
| C-01 | The key that suspends snapping: ⌃ / S, or ⌘ / Ctrl | CV §8.2 #1 ↔ UX keymap | CV V-42 |
| C-02 | The Outlines shortcut: ⇧⌘O, or ⌘Y | CV §8.2 #2 ↔ UX keymap | CV V-13 |
| C-03 | A click on the empty background of a top-level frame: does it select the frame or start a marquee? | CV-066 ↔ FR-062 | CV V-19, FR V-06 |
| C-04 | The default clip-content value for new frames | FR §8.2 #1 ↔ AL's assumption (`true`) | FR V-07 |
| C-05 | The layout-guide toggle shortcut: ⇧G, or ⌃G | FR §8.2 #3 ↔ UX keymap | FR V-31 |
| C-06 | Whether constraints apply to groups (writing through to children) | FR §8.2 #2 (two help excerpts disagree) | FR V-43 |
| C-07 | Blend modes on sections: a help excerpt says yes; `SectionNode` has no blend, opacity or effects `[API]`; FR-140 says sections cannot blend | PE §8.3 #3 ↔ FR-140 | PE V-33 |
| C-08 | The glass effect: no variable binding and depth ≥ 1 `[API]`, versus third-party reports of variables and a 0–100 range | PE §8.3 #1–2 | PE V-32 |
| C-09 | Where per-file view state is stored (current page, viewports, `expanded`): an app-data sidecar keyed by `documentId` (architecture ADR-010, item 7), versus a `user/` section inside the file (IO §2.4, §3.1, IO-001), versus a view-state record inside the package (UX §2.2) | architecture ↔ IO ↔ UX | An Illigma decision in RV-15. Proposal: an app-data sidecar, so that view changes never write to the shared file. Align IO-001 and UX §2.2. Figma's own handling of `expanded` is UX V-08 |
| C-10 | The target of `resetSlot`: the original slot content (typings) or the default empty state (Figma's MCP skill) | CP open question | CP experiment (to be added in RV-07) |
| C-11 | The units of prototype durations and delays: seconds in the Plugin API, milliseconds in REST | PR ↔ IO importer mapping | PR V-01 |

---

## 16. Document map and conventions

| Path | Purpose |
| --- | --- |
| `PLAN.md` | This plan. Vision, scope, roadmap, process, decisions. |
| `AGENTS.md` (loaded through `CLAUDE.md`) | Standing instructions for coding sessions. |
| `README.md` | Short project overview. |
| `docs/architecture.md` | Stack, ADRs, invariants, budgets, risks. |
| `docs/parity/NN-*.md` | Area parity specs: §1 scope, §2 data model, §3 behavior, §4 inspector, §5 shortcuts, §6 checklist, §7 dependencies, §8 live verification, §9 sources. |
| `docs/parity/CHECKLIST.md` | Master index, counts and integrity checks. |
| `docs/parity/matrix.generated.md` | *(from M0-02)* Generated status per item. Never edit it by hand. |
| `docs/ui/design-system.md`, `docs/ui/framer-visual-reference.md` | Look, tokens, kit, layout. |
| `docs/figma/observations/` | *(from RV-16)* Dated read-only and fixture observation logs. |
| `fixtures/figma/<area>/<ID>/` | *(from M0-20)* Golden data captured from the disposable Figma fixture file. |

**Checklist item format:**

```
- [ ] **<PREFIX>-<NNN>** <Feature/behavior name> — <precise expected Figma behavior incl. edge cases/modifiers/values>. _Data:_ `<figma property/enum names>` _Test:_ <concrete acceptance test against Figma>. _M#·P#·<evidence tags>_
```

The prefixes are CV, FR, AL, VC, PE, TX, CP, DS, PR, UX and IO for parity, and KIT and FVR for the UI.

**Priorities:**
- **P0:** essential for the milestone's parity.
- **P1:** expected by professional users.
- **P2:** the long tail.

## 17. Change log

| Date | Change |
| --- | --- |
| 2026-10-08 | First master plan, synthesized from the 11 area specs, the architecture and the two UI documents. The counts were taken with the commands in CHECKLIST §8. Review passes are pending (G0). |
| 2026-10-08 | The planned agent-run final cross-area audit did not run (usage limit). A reduced mechanical audit ran instead: CHECKLIST §8 checks 1–6 (2,718 tagged items = 2,718 definitions, no duplicate IDs, 0 ticked boxes; the 6 known undefined references CP-244, CP-262, DS-247, DS-293, PR-276, PR-313 remain and are tracked in RV-07…RV-09) and a relative-link check over every Markdown file (no broken links outside code blocks). The full cross-area audit is folded into RV-15. |
