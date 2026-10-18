# Phase 0 · Foundations

Started 18 October 2026, after the design sign-off. Planned to run through December 2026 (PRD section 9).

**Gate (PRD):** a 10,000-layer page pans and zooms at 60 fps, and a file saves and reopens with nothing lost.

## Milestones

| # | Milestone | Package | Done when |
|---|---|---|---|
| 0.1 | Monorepo | root | npm workspaces, strict TypeScript, Vitest, licences (MPL-2.0 editor, MIT format spec and SDK), CI-ready scripts |
| 0.2 | Document model | `@illigma/core` | Flat node map with stable ids, parent id + fractional index ordering, property-level operations, transactions, undo/redo; unit tests |
| 0.3 | File format v0 | `@illigma/format` | `.illigma` package form (manifest, one page file per page, nodes sorted by id, one per line), JSON Schema, versioned migrations, lossless round-trip tests |
| 0.4 | Renderer spike | `@illigma/renderer` + `apps/bench` | CanvasKit (Skia WASM) on WebGL2 draws 10,000 layers; pan and zoom measured at 60 fps |
| 0.5 | Offline web app | `apps/web` | Installable web app: service worker, OPFS working store, folder access in Chromium, autosave and recovery journal, opens and saves `.illigma` |
| 0.6 | Design tokens in code | `@illigma/tokens` | The Figma "Illigma UI" variables exported to `tokens.json` and CSS custom properties (Dark and Light) |

## Status

| # | Status |
|---|---|
| 0.1 Monorepo | Done 2026-10-18 |
| 0.2 Document model | Done 2026-10-18 (`@illigma/core`, unit-tested) |
| 0.3 File format v0 | Done 2026-10-18 (`@illigma/format`, lossless round trip tested). Single-file zip form, reader fuzz tests and CI added 2026-10-18 |
| 0.4 Renderer spike | **Done 2026-10-18; with 0.3 this meets the Phase 0 gate.** 10,000 layers: median 60 fps, 100% of frames within 16.7 ms, 4.8 ms draw per frame at 2× pixel density, page recorded once in 24 ms (Chromium, ANGLE Metal, Apple M1, 1440×900). Run `npm run bench` (opens the benchmark) or `npm run bench:measure` (headless, prints JSON). Text, hit-testing and per-frame picture caching added 2026-10-18 (below); tiles come next |
| 0.5 Offline web app | Done 2026-10-18 (`apps/web`, `@illigma/host-web`): installable PWA with service worker and update prompt, OPFS store, folder access in Chromium, atomic multi-file saves, autosave, recovery journal with Keep/Discard, editing lock per tab, changed-on-disk detection, per-file write queue shared across sessions. 256 unit tests; 7 Playwright suites, 241 checks, no known bugs (`npm run test:e2e`) |
| 0.6 Design tokens in code | Done 2026-10-18 (`@illigma/tokens`: `tokens.json` in DTCG form, `tokens.css` with Dark and Light, `npm run build:tokens -w @illigma/tokens`) |
| 0.7 Layout engine | Done 2026-10-18 (`@illigma/layout`, MPL-2.0): Figma auto layout (horizontal, vertical, wrap; padding, gap incl. negative and Auto; 9-point alignment; Fixed, Hug, Fill; min and max; ignore auto layout) and constraints (left, right, left and right, centre, scale; through groups). Optional layout fields added to format v0. Every geometry case of the prototype's two Playwright specs ported as unit tests; the grid case waits for grid auto layout (P1). 10,000 nested auto layout nodes lay out in about 30 ms; one edit in under 1 ms. See below |
| 0.8 Prototype import | In progress: read the old prototype's JSON into `.illigma` (PRD section 9) |

## How the renderer spike works

Each top-level child of the page (each screen) is recorded into its own Skia picture (SkPicture), and a page picture replays those. Each frame only replays the page picture under the camera transform, so panning and zooming cost the same however many layers there are. A document change re-records only the top-level children whose subtree it touched (found from the change's operations), so editing one layer costs one screen's recording, not the page's.

- **Editing at 10k layers** (`npm run bench:measure -- --edit`, one rectangle recoloured every frame while panning): before, 18.3 ms re-recording per edit and 72% of frames within 16.7 ms; after, 1.2 ms per edit and 100% within budget.
- **Text** uses CanvasKit's Paragraph API with fonts passed to the renderer (`options.fonts`); the benchmark bundles Inter from `@fontsource/inter` (SIL OFL 1.1, see `apps/bench/NOTICE`). The first recording of the 10k-layer page, with 1,000 text layers, takes about 90–115 ms.
- **Hit-testing** (`PageRenderer.hitTest`, `hitTest` in `hit-test.ts`) is pure geometry, no GPU: nesting, frame clipping, rotation, ellipses and rounded corners, z-order, hidden and locked layers.
- **Opacity** is drawn as a layer, so a 50% frame fades its children too. Pictures are culled by what they actually drew, never by node boxes.
- **`GpuCanvas`** keeps one WebGL context per canvas and swaps only the surface on resize (`makeSurface` leaked a context per call and is deprecated).

## How the layout engine works

`@illigma/layout` is pure functions with no DOM. It reads the document and returns `{ id, key, value }` changes to `x`, `y`, `width` and `height`; the caller applies them with `tx.set` inside the same `Document.transact` as the edit, so one undo reverts the edit and its layout together.

- **Fields** (format v0, all optional, named after Figma's Plugin API; absent = Figma's default): on frames `layoutMode`, `itemSpacing`, `counterAxisSpacing`, `paddingLeft/Right/Top/Bottom`, `primaryAxisAlignItems` (incl. `SPACE_BETWEEN`, `SPACE_AROUND`, `SPACE_EVENLY`), `counterAxisAlignItems`, `counterAxisAlignContent`, `primaryAxisSizingMode`, `counterAxisSizingMode`, `layoutWrap`; on any layer `layoutPositioning`, `layoutSizingHorizontal/Vertical`, `constraints`, `minWidth/maxWidth/minHeight/maxHeight`. Files without them save byte for byte as before.
- **`layoutFrame(frame, children)`** lays out one auto layout frame, following Figma's flexbox-aligned version: Fill children share space by content box with min/max freezing as in CSS, Auto gaps never go negative, a frame is never smaller than its padding, hidden and absolute children take no space. Children at 0° or 180° can fill; other angles are placed by their rotated bounding box.
- **`relayout(doc, ids)`** climbs from each changed node to the outermost auto layout frame it is nested in, then lays that out top-down. Hug sizes are measured bottom-up and cached per node and forced size; frames off the changed paths keep their last layout, so an edit costs about its path, not the page. `changedIds(ops)` turns a transaction's operations into the ids to pass. `{ deep: true }` lays out everything, for content never laid out (imports).
- **`resize(doc, id, box)`** is Figma's resize: the node's new box, its children following their constraints from the old size (taken from the document before the change), and any auto layout reflow around it. `{ constraints: false }` is Cmd/Ctrl-resize. Groups take no constraints: their layers follow the frame and the group refits.
- **Tests:** 63 unit tests, including the ported prototype cases, a seeded check that 2,000 random edits on 100 random trees always match a full layout, and the 10,000-node budget.
- **Not yet:** grid auto layout (P1), text Hug (needs text measurement), baseline alignment, strokes in layout, reverse z-order (a renderer concern). Known limit: wrapped content inside a child stretched across a hugging or wrapping frame can need a second pass for its Fill siblings. Not wired into `apps/web` (no layout UI is designed yet).

## Choices made for Phase 0

- **npm workspaces** (Node 22), so contributors need nothing beyond Node.
- **TypeScript strict**, ES modules, Vitest for unit tests, Playwright for browser tests from 0.4.
- **React** for panels, as listed first in the PRD (section 6.1). The canvas stays outside React.
- **Vite** for the apps.
- No network calls at runtime (PRD privacy rule).

## Not in Phase 0

Drawing tools, the auto layout and constraints UI, text, components and the rest of the editor are Phase 1+ (PRD roadmap).
