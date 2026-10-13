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
- Design the remaining editor states: core selection states, popovers and menus, expanded inspector sections, and modes and views (Prototype, Inspect, comments, light mode).
- Then start Phase 0 (foundations): TypeScript monorepo, CanvasKit spike, operation-based document model, file format v0 and an offline web app.

### Added
- `CHANGELOG.md`, with the project's end goal (2026-10-13).

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
