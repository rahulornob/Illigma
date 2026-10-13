# Core flows (low fidelity)

Draft · 13 October 2026 · Phase 3 of the [design plan](PLAN.md) · Figma section "10 · Core flows"

The six v1 journeys from PRD section 3, drawn step by step as grey-box wireframes of layout B. The blue box in each wireframe marks where the user is working. The badge says whether that state is already designed.

**Totals:** 36 steps · 6 Designed · 5 Partial · 24 Missing · 1 Outside the app.

## 1 · Create a file offline

| # | Step | Where | Status |
|---|---|---|---|
| 1 | Home: recent files, folders, New file | Full screen | Missing |
| 2 | Choose where to save (a folder on disk) | Dialog | Missing |
| 3 | Empty canvas with a first-run hint ("Press F to draw a frame") | Canvas | Missing |
| 4 | Frame tool + device presets | Properties panel | Missing |
| 5 | Draw shapes and text inside the frame | Canvas | Designed (interactions spec) |
| 6 | Autosaved to `~/Design/…`, works offline | Title bar | Partial |

## 2 · Five-screen flow with auto layout

| # | Step | Where | Status |
|---|---|---|---|
| 1 | Select layers → Shift+A adds auto layout | Canvas | Designed |
| 2 | Tune gap, padding, alignment | Properties | Designed |
| 3 | Children: Fill / Hug / Fixed | Properties | Partial |
| 4 | ⌘D four times → five screens to the right | Canvas | Designed |
| 5 | Rename frames | Layers panel | Designed |
| 6 | Shift+1 to fit the whole flow | Canvas | Designed |

## 3 · Components, variants, variables

| # | Step | Where | Status |
|---|---|---|---|
| 1 | Select → Create component (⌥⌘K) | Canvas / context bar | Missing |
| 2 | Add a variant property → variant set | Properties | Missing |
| 3 | Variables manager: collection with Light / Dark modes | Full page | Missing |
| 4 | Bind a fill to a variable (colour picker → Variables tab) | Popover | Partial |
| 5 | Assets panel: drop instances into screens | Layers panel → Assets | Missing |
| 6 | Switch a frame's mode Light ↔ Dark | Properties | Missing |

## 4 · Prototype and present

| # | Step | Where | Status |
|---|---|---|---|
| 1 | Switch to the Prototype tab | Properties | Missing |
| 2 | Drag a connection from the button to a frame | Canvas | Missing |
| 3 | On tap → Navigate to → Smart animate | Properties | Missing |
| 4 | Set the flow's starting point | Canvas | Missing |
| 5 | Present full screen (▷) | Full screen | Missing |
| 6 | Live preview on a phone over the local network | Dialog | Missing |

## 5 · Hand off to a developer

| # | Step | Where | Status |
|---|---|---|---|
| 1 | Switch to the Inspect tab | Properties | Missing |
| 2 | Hover to measure and read properties | Canvas | Missing |
| 3 | Copy a CSS / Tailwind / SwiftUI snippet | Properties | Missing |
| 4 | Export PNG / SVG at 1x, 2x, 3x | Properties → Export | Partial |
| 5 | Export tokens as JSON | Dialog | Missing |
| 6 | Turn on the local MCP server for AI tools | Dialog / Preferences | Missing |

## 6 · Files on disk and Git

| # | Step | Where | Status |
|---|---|---|---|
| 1 | Saved as a readable `.illigma` file in a folder | Finder | Partial (format in PRD 6.2) |
| 2 | Version the file with Git: `git commit` in a terminal or GitHub Desktop. Illigma has no screen for this; it works because the file is a normal file on disk. | Outside Illigma | Outside app |
| 3 | On another machine: Home → Open file | Full screen | Missing |
| 4 | File changed on disk → reload banner | Title bar | Missing |
| 5 | Version history panel: named versions, restore | Left panel | Missing |
| 6 | Readable diff of the change | Terminal / Git tool | Missing (needs a diff format spec) |

## What the flows revealed

1. **There is no front door.** Journeys 1 and 6 both start at a Home / file browser that doesn't exist yet. Without it, there is no way to create, open or find a file. It is the first Phase 4 screen.
2. **Prototype and Inspect are empty tabs.** The tabs exist in layout B, but journeys 4 and 5 have no designed content behind them.
3. **The Variables entry point is still undecided.** Journey 3 needs a clear path to the full-page manager. Layout B's "Variable" tab is a placeholder (your call, kept for later).
4. **Saving needs more states.** "Saved" is designed, but saving, disk full, file changed on disk and conflicts are not (principle 1, never lose work).
5. **Local-first replacements need a home.** Phone preview over the network, the MCP server and token export each need a place, most likely Preferences plus a menu entry. Preferences is not designed either.
6. **Diffs need a format decision.** Journey 6 relies on a readable diff, which depends on the `.illigma` format (PRD 6.2). It goes to development Phase 0, not design.

## Phase 4 backlog, in order

1. Home / file browser (+ open, import, new file, choose folder)
2. Empty canvas and first-run hints; frame presets
3. Save states: saving, error, changed on disk, conflict
4. Component creation, main component, variant set, Assets panel
5. Variables manager (full page) and mode switching
6. Prototype mode: connections, interaction panel, flows, presentation view
7. Inspect mode: measurements, properties, code snippets
8. Export dialog and token export
9. Version history, Preferences (incl. phone preview, MCP server)
10. Remaining states from [core-loop.md](core-loop.md): text selected, nothing selected, multi-select, popovers, context menus, light mode, docked panels
