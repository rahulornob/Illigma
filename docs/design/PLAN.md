# Illigma design plan

13 October 2026 · How we design the editor before writing app code.

## Why this order

Figma did not start by drawing panels. It proved its engine first, treated the canvas as the product, wrote clear principles, and tested with working designers in a long beta. Its 2024 UI3 redesign shipped with floating panels and switched the default back to docked panels after beta feedback. We follow the same order: principles, then the core loop, then canvas behaviour, then flows, then polished screens, then testing.

Every phase ends with a design audit (reference style, photo-editor creep, Figma gaps, top fixes), the fixes applied, and a commit.

## Phases

| # | Phase | Output | Where | Exit gate |
|---|---|---|---|---|
| 1 | **Principles and core loop** | Design principles (one page). Core-loop state map: every step of the v1 journeys and every editor state it needs, tied to P0 inventory sections. | [principles.md](principles.md), [core-loop.md](core-loop.md) | You approve both. The state map replaces the old "States still to design" list. |
| 2 | **Canvas interaction specs** | Behaviour specs with diagrams: selection and handles, deep select, multi-select, snapping and smart guides, resizing in auto layout, text editing, pen tool, zoom and pan, nudging, duplication. | `interactions.md` + Figma section "09 · Canvas interactions" | Every P0 canvas behaviour has a spec and a picture. |
| 3 | **Low-fidelity flows** | Grey-box flows for the six v1 journeys (create, auto layout, components and variables, prototype, hand-off, files on disk). | Figma section "10 · Core flows" | Each journey reads end to end without gaps. |
| 4 | **High-fidelity states** | All states from the map, built only from library components: selection states, popovers and menus, expanded inspector sections, Prototype and Inspect modes, comments, Variables manager, file browser, light mode, docked-panel option for layout B. | Figma sections "11 ·" onwards | Audit passes; every screen uses library instances. |
| 5 | **Prototype and test** | Clickable Figma prototype of journey 1 and 3. Test script (the PRD's 10 tasks), 5 working designers, docked vs floating panels. Findings and fixes. | `usability-test.md` + Figma prototype | 80% of participants finish the 10 tasks unaided (PRD success metric). |
| 6 | **Approval gate** | Final review and sign-off. Development Phase 0 starts (monorepo, CanvasKit spike, document model, file format v0, offline web app). | PRD section 9 | You approve the visuals. |

**In parallel from Phase 2:** the Phase 0 engine spike (CanvasKit, 10k layers at 60 fps) can start, because it does not depend on the UI. It only starts when you say so.

## Status

| Phase | Status |
|---|---|
| 1 · Principles and core loop | Done (2026-10-13) |
| 2 · Canvas interaction specs | Done (2026-10-13) |
| 3 · Low-fidelity flows | Done (2026-10-13). Journey 6 reworked: synced folders + version history; Git optional. |
| 4 · High-fidelity states | In progress. 4.1 Home / file browser: done and audited (Figma section "11 · Home & files": Recents, New file dialog, First run, File menu + missing file + undo). 4.2 empty canvas, Frame tool presets, first frame: done and audited (section "12 · Empty canvas & frames"). 4.3 save and file states: done and audited (section "13 · Save states", save-states.md). 4.4 components and variants: done and audited (section "14 · Components": main component, variant set + Add property menu with Slot, Assets panel with folders and libraries, Swap instance). 4.5 variables manager and mode switching: done and audited (section "15 · Variables", variables.md). 4.6 prototype mode: done and audited (section "16 · Prototype", prototype.md). 4.7 inspect mode: done and audited (section "17 · Inspect", inspect.md). 4.8 export dialog and token export: done and audited (section "18 · Export", export.md). Next: 4.9 version history and Preferences. |
| 5 · Prototype and test | Not started |
| 6 · Approval gate | Not started |
