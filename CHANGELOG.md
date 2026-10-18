# Changelog

All notable changes to Illigma are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions will follow [Semantic Versioning](https://semver.org/) once code ships.

## End goal

**Illigma v1.0 (October 2027):** an open-source, local-first interface design tool with Figma's editing model. Your files stay on your machine. No account, no cloud and no seat licence.

v1.0 is done when a working product designer can build and hand off a multi-screen app design with a component library, entirely offline, without opening Figma. That means:

- **Core Figma parity** for the daily-use 80%: frames, auto layout, constraints, components and variants, variables and modes, styles, text, vector editing, prototyping and export.
- **Local-first files:** an open, documented `.illigma` format on disk, with autosave, crash safety and full history.
- **Performance:** 10k-layer files open in under 2 s and pan at 60 fps.
- **A way in from Figma:** import from Figma (REST API and best-effort `.fig`), SVG and Penpot, with 95% fidelity on a 50-file test corpus.
- **Developer handoff:** an inspect mode with code snippets, token export and a local MCP server for AI agents.
- **An open ecosystem:** a plugin API close enough to Figma's that common plugins port with small changes.

After v1.0: a Tauri desktop app in v1.x, then optional multiplayer (CRDT over LAN or a self-hosted relay) in v2. The full scope, roadmap and gates are in [docs/PRD.md](docs/PRD.md).

**Where we are now:** visual design phase. Development starts once the core editor states are designed and approved in Figma (see [docs/design/README.md](docs/design/README.md)).

## [Unreleased]

### Next
- Phase 0 (foundations): renderer spike (CanvasKit, 10,000 layers at 60 fps), offline web app, design tokens in code. See [docs/dev/phase-0.md](docs/dev/phase-0.md).
- Run the real usability sessions (Phase 5) in parallel; fix what they find.

### Added (2026-10-18, layout engine wired into editing)
- `@illigma/core`: `Document` takes a `normalize` hook (`DocumentOptions.normalize`, type `Normalizer`). It completes every edit inside the edit itself: at the end of each top-level `transact`, after each `LiveEdit.update` step, and after `replay`. Its operations join the same undo step, so one undo reverts an edit and what the hook added. Undo and redo never run it again; they restore exact values. If it throws, the edit is rolled back. `doc.normalizer` reads it back.
- The web app lays out every edit. Each document it creates or opens (`loadDocument`, `sampleDocument`, Keep's replay copy) uses `relayout` on the changed ids as its normalizer. Drag steps, Properties edits, ⌘D, Delete, drawing and recovered edits are all laid out (`apps/web/src/editor/layout.ts`).
- Canvas resize goes through layout `resize`: children follow their constraints. Hold ⌘/Ctrl to resize without constraints, as in Figma. Resizing a Hug or Fill layer by an edge switches that axis to Fixed (an auto layout frame's sizing mode too). Typing W or H in Properties does the same. X and Y of a layer in auto layout belong to its parent and change nothing.
- Dragging a layer in an auto layout flow reorders it instead of moving it. The selection box follows the pointer. A 2 px insertion line (`accent/default`) shows the slot, picked by pointer position along the flow. The order changes on release, as one undo step, and Escape cancels. Arrow keys along the flow reorder by one step. Absolute-positioned children still move freely. Pressing on a selected layer nested inside the one a click would pick (a card's child) keeps the selection.
- ⌘D inside auto layout puts the copy right after the original, and the frame reflows. Delete reflows too.
- The sample file now has an auto layout "Card" (vertical, padding 24, gap 16, three children). Avatar is pinned to the right edge, so resizing Desktop shows constraints at work.
- Tests: 10 for the core hook (undo/redo exact, nested, rollback, live steps and cancel, replay) and 17 for the wiring, including a 10,000-layer live drag and resize within a time budget. There are 14 new e2e checks in `canvas.mjs` (constraints, ⌘-resize, reorder by drag and Escape, ⌘D, edge resize, Delete, arrow reorder, undo). The smoke, recovery and save-errors counts are updated for the 7-layer sample.

### Fixed (2026-10-18, prototype import QC round 5)
- `import:prototype --force` only replaces an Illigma file: a package folder whose manifest.json says `"format": "illigma"`, or a zip holding one. It never replaces another folder with a manifest.json (web projects, browser extensions) or any other file, never the folder it runs in or a parent of it, never the input or a folder holding it, and never writes through a symbolic link. The new file is written under a temporary name and renamed into place, so a failed import leaves the old one as it was.
- The command explains a folder as input, unreadable input, a file in the output's path and an unwritable output folder in plain language, naming the right path. Its logic moved to `src/import-cli.ts` with tests.
- Importer: input with a UTF-8 byte order mark is read; breaking a loop of frames only moves a frame of the loop (frames hanging below it keep their parent) and counts each loop once; missing text settings no longer count as broken values; large groups and older documents with many frames import in near-linear time.
### Fixed (2026-10-18, canvas QC round 5)
- Small layers move: inside the selection an edge grabs at most a quarter of the box, so the middle of a tiny layer always moves it; its corners stay reachable from outside and edge handles hide below 24 px. A line's own length has no top/bottom edge.
- Drags can't get stuck: a move with no button down ends the drag, window blur or a hidden tab cancels it, a second finger or pen is ignored, and right-click never opens the browser menu on the canvas. Closing the tab, going Home, Keep and app updates first keep an open drag instead of saving without it.
- Clicking a handle without dragging keeps the selection; Escape between press and drag drops the press. Handles and the box sit on the layers a resize changes (not locked layers, nor a selected parent's child). Resizing keeps an unscaled axis as it is (a line stays 0 px high).
- ⌘D is never passed to the browser (bookmark dialog), even from a field. Undo of Delete (and redo of a duplicate or drawn shape) selects those layers again. Layers panel: Shift-click selects a range, ⌘-click toggles.
- Recovery: edits made in the last 250 ms before the tab closes are stashed synchronously in localStorage on pagehide and merged into the journal on the next load (matched by session id and seq, so nothing is offered twice or after a save holds it).
- The 10,000-node layout budget test takes the best of 5 runs after a warm-up, so it no longer fails under parallel test load.

### Added (2026-10-18, prototype import: auto layout and constraints)
- `importPrototypeJson` now carries the prototype's auto layout and constraints into the format v0 layout fields: direction, gap (including negative), gap between wrapped lines, padding (with the prototype's 16 px defaults), nine-point alignment, Packed/Between/Around/Evenly spacing, wrap, Hug/Fixed/Fill sizing on frames and layers (text Hug becomes auto height), min and max sizes, "Ignore auto layout", child order, and Left/Right/Left and right/Center/Scale constraints. A `@illigma/layout` relayout of an imported document moves nothing (a test runs it on a document laid out by the prototype's own code). Grid auto layout becomes a plain frame with a warning; grid spans and unclipped frames are still warnings. Known difference: a Fill layer across a hugging frame no longer holds the frame open, as in Figma.

### Added (2026-10-18, Phase 1 first slice: direct manipulation)
- Canvas: move by dragging (click-drag selects and moves; Shift keeps one axis; whole-pixel positions), resize with 8 handles (Shift keeps the ratio, Alt from the centre, flips past the opposite edge, never under 1 px; turned layers resize along their own axes), marquee (from empty canvas over top-level layers, from a top-level frame's empty area over its children), Shift-click to add or remove, hover outline, member outlines and a size label for multi-selections. Escape cancels a drag. Locked layers don't move; hidden ones aren't hit.
- Keys: arrows nudge 1 px (Shift 10 px), Delete/Backspace deletes the selection, ⌘D duplicates in place (a top-level frame's copy goes to its right), ⌘A selects all in the current context.
- Multi-selection everywhere: Layers panel Shift/⌘-click, Properties shows "Mixed" for differing values and edits every selected layer; a screen-reader announcement on selection changes.
- `@illigma/core`: `Document.beginLive()` returns a `LiveEdit` (`update`, `commit`, `cancel`): a drag shows every step live and is recorded as one undo step. The recovery journal skips live steps and the autosaver never writes a drag halfway.

### Added (2026-10-18, development Phase 0)
- `@illigma/layout` (MPL-2.0), milestone 0.7: Figma-compatible auto layout (horizontal, vertical, wrap, padding, fixed, negative and Auto gaps, alignment, Fixed/Hug/Fill sizing, min and max, ignore auto layout, nested frames) and constraints (left, right, left and right, centre, scale; through groups). `relayout` and `resize` return field changes to apply in the same transaction, so one undo reverts an edit and its layout. Every geometry case of the prototype's auto layout and constraints specs is ported as a unit test; 10,000 nested nodes lay out in about 30 ms.
- Format v0: optional auto layout and constraints fields named after Figma's Plugin API (`layoutMode`, `itemSpacing`, `padding*`, `primaryAxisAlignItems`, `layoutSizingHorizontal`, `constraints`, `minWidth` and others), validated and in the JSON Schema. Files without them are unchanged byte for byte.
- Design approved: all 15 areas signed off.
- Monorepo: npm workspaces, strict TypeScript, Vitest; MPL-2.0 and MIT licence files.
- `@illigma/format` (MIT): `.illigma` format v0 (package form, canonical output, fractional-index ordering, validation, migrations, JSON Schema).
- `@illigma/core` (MPL-2.0): document model with operations, transactions, rollback on error, undo/redo (100+ steps) and change events.
- 24 unit tests, including a lossless save-and-reopen round trip and a 10,000-layer file.
- `.illigma` single-file form: `writeZip` / `readZip` / `isZip` (deterministic bytes, manifest first and stored, zip-slip, zip-bomb and size-limit protection; DEFLATE via fflate 0.8.3, MIT).
- Seeded fuzz tests: 2,000 broken inputs per run; every one opens as a valid file or is refused with a `FormatError`. `validateFile` no longer crashes on hostile JSON values such as `{"toString": 1}` in a node's type or parent. Page ids must now be plain file names.
- CI (GitHub Actions): typecheck, tests and the benchmark app build on every push and pull request to `main`.
- Import from the old prototype (0.8): `importPrototypeJson` in `@illigma/format` and `npm run import:prototype -- old.json out.illigma [--zip]`. Reads version 1 documents and the older single-artboard form; maps pages, frames (nested), rectangles, ellipses, paths, text and groups with colours, strokes, opacity, rotation, visibility and locks, keeping the prototype's stacking order. What format v0 can't hold yet is reported as plain-language warnings, one per kind with counts. Unusable input is refused with a `FormatError`; 400 fuzzed documents per test run.

### Added (2026-10-13, design phase 4)
- High-fidelity editor states in Figma, sections 11–20, each audited by the design QA agent with fixes applied: Home and files, empty canvas and frame presets, save and file states, components and variants, Variables manager and modes, Prototype mode with presentation and phone preview over the local network, Inspect mode, Export and token export, version history and compare, Preferences (including the local MCP server), and core states (text and font picker, multi-select, Light mode, comments, import report, stroke and constraints, styles, view menu, docked panels).
- Specs for each area in `docs/design/`: save-states, variables, prototype, inspect, export, history-and-preferences, core-states.
- A clickable prototype of journeys 1 and 3 (flow starting points on the Figma page) and a usability test plan.
- New library components: Variable row, Variable option, Interaction row, Version row, Asset tile; new icons and a Code/Body text style (JetBrains Mono).

### Added (2026-10-13)
- `CHANGELOG.md`, with the project's end goal.
- **Design system** in Figma ("00 · Design system"): a Foundations board (brand roles, primitive palette, alpha scale, semantic tokens, type, spacing, radius, elevation), a Components board (13 component sets) and an Icons board (118 Lucide-based icon components at 12 / 16 / 20 px).
- Two variable collections: "Illigma Primitives" (raw colours and alpha steps) and "Illigma UI" (semantic Dark / Light tokens that alias the primitives).
- Editor B details: Figma-style panel header (profile, present, Export, Design / Prototype / Inspect, zoom), title-bar Feedback and tab switcher (with an open state), a Pages list with emoji and divider pages, close-sidebar buttons, an Absolute position toggle, and an Effects "+" menu.

### Changed (2026-10-13)
- Universal rules: 4 px grid for every size, gap, padding, radius and position; type is 12 px minimum (sizes 12 / 16, line heights 16 / 24); icons are 1.2 px stroke at 12 / 16 / 20 px; every corner uses 60% corner smoothing.
- Text colours are now white / black alpha tokens (92 / 70 / 50 / 32%) instead of grey hex values.
- Filled buttons with text use darker `accent/fill` and `state/danger-fill` so white labels pass 4.5:1 contrast.
- Colour roles reduced to two: Ember (brand) and Blue (everything interactive). Purple and lime were removed; the active tool and components are now blue.

### Removed (2026-10-13)
- The old "Illigma Theme" variable collection from the early prototype (only used on the "delete" page).
- The duplicate selection header in the Properties panel.

### Decided
- Editor layout locked to **Approach B · Floating canvas** (2026-10-13), chosen from eight explored layouts. The others are archived in Figma for reference.

## 2026-10-13: Product and design baseline

### Added
- `docs/PRD.md`: snapshot of the full PRD (vision, requirements, local-first architecture, roadmap, risks and decisions).
- `docs/feature-inventory/`: 12 files and 5,356 rows covering every feature from Figma's 896 Help Center articles, plus the Plugin API, REST API and keyboard shortcuts. Each row has an Illigma priority.
- `docs/design/`: notes on the current editor design (Figma section "06 · Design editor") and the exported "Illigma UI" tokens (`tokens.json`, Dark and Light modes).
- `CLAUDE.md` and `AGENTS.md`: project context and the design-first workflow for agents.

### Decided (2026-10-12)
- The name is "Illigma". The build starts from scratch: a TypeScript monorepo with a CanvasKit GPU renderer, an operation-based document model and our own layout engine.
- Web-first and offline-capable. Desktop app in v1.x. Multiplayer in v2.
- Licences: MPL-2.0 for the editor, MIT for the file-format spec and SDK, and AGPL-3.0 for the optional sync relay. A pure community project, with no paid plans.
- Dark theme first, with an original visual identity.

### Removed (2026-10-12)
- The old browser prototype (Vite, vanilla JS, SVG, Paper.js). Its code remains in git history at commit `8e3bd2f` for reference.
