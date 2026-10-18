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
| 0.4 Renderer spike | **Done 2026-10-18; with 0.3 this meets the Phase 0 gate.** 10,000 layers: median 60 fps, 100% of frames within 16.7 ms, 4.8 ms draw per frame at 2× pixel density, page recorded once in 24 ms (Chromium, ANGLE Metal, Apple M1, 1440×900). Run `npm run bench` (opens the benchmark) or `npm run bench:measure` (headless, prints JSON). Text, tiles and hit-testing come next |
| 0.5 Offline web app | Next |
| 0.6 Design tokens in code | Not started |

## How the renderer spike works

The page is recorded once into a Skia picture (SkPicture). Each frame only replays that picture under the camera transform, so panning and zooming cost the same however many layers there are. The picture is recorded again only when the document changes. Editing a single layer at 10k+ layers will need finer caching (per-frame pictures or tiles); that is Phase 1 work.

## Choices made for Phase 0

- **npm workspaces** (Node 22), so contributors need nothing beyond Node.
- **TypeScript strict**, ES modules, Vitest for unit tests, Playwright for browser tests from 0.4.
- **React** for panels, as listed first in the PRD (section 6.1). The canvas stays outside React.
- **Vite** for the apps.
- No network calls at runtime (PRD privacy rule).

## Not in Phase 0

Drawing tools, auto layout, text, components and the rest of the editor are Phase 1+ (PRD roadmap).
