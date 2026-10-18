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

## Choices made for Phase 0

- **npm workspaces** (Node 22), so contributors need nothing beyond Node.
- **TypeScript strict**, ES modules, Vitest for unit tests, Playwright for browser tests from 0.4.
- **React** for panels, as listed first in the PRD (section 6.1). The canvas stays outside React.
- **Vite** for the apps.
- No network calls at runtime (PRD privacy rule).

## Not in Phase 0

Drawing tools, auto layout, text, components and the rest of the editor are Phase 1+ (PRD roadmap).
