# Illigma

> **Look like Framer. Feel and function like Figma. Run locally.**

Illigma is a local-first, professional desktop design application.

- **Behavior:** its target is 1:1 parity with the Figma Design editor. That covers the canvas, frames, auto layout, vectors, paint and effects, typography, components and variants, variables and styles, prototyping and export, and it uses Figma's own data model.
- **Look:** the editor chrome takes Framer's visual language.
- **Local:** it runs fully offline, with no account. Documents are files on your disk.

## Status: planning

The repository holds **documentation only**. No application code exists yet, and **nothing has been implemented or validated against Figma**.

- All 2,718 parity checklist items are **Not started**.
- All 160 UI items are **Not started**.
- The adversarial review passes of the planning documents are still pending. They are gate G0 in the plan, and they must be finished before M0 implementation begins.

## Documents

- [`PLAN.md`](PLAN.md): the master plan. It covers vision, scope, architecture and UI in brief, the milestones M0–M8, the first implementation slices, the parity validation process, risks and open decisions.
- [`docs/parity/CHECKLIST.md`](docs/parity/CHECKLIST.md): the index of all parity items, with counts by area, milestone and priority.
- [`docs/parity/`](docs/parity/): eleven area specs, each with behavior, data model, shortcuts, checklist and live-verification experiments.
- [`docs/architecture.md`](docs/architecture.md): the stack (Electron, TypeScript, CanvasKit/Skia, SolidJS), decision records, invariants and performance budgets.
- [`docs/ui/design-system.md`](docs/ui/design-system.md) and [`docs/ui/framer-visual-reference.md`](docs/ui/framer-visual-reference.md): tokens, component kit, editor layout and the Framer visual evidence.
- [`AGENTS.md`](AGENTS.md): standing instructions for coding sessions in this repository.
