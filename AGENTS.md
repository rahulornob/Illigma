# Working on Illigma

Illigma is a local-first, professional desktop design application: **"Look like Framer. Feel and function like Figma. Run locally."** It is not a basic editor or a simplified clone.

**Phase (2026-10-08): planning.** The repository holds documentation only. Every parity item is *Not started*.

The user's current instructions take precedence over this file.

## 1. The non-negotiable rule

- **Figma is the source of truth for all functionality**: behavior, interactions, workflows, edge cases and the data model, including Figma's property and enum names. The target is 1:1 parity.
- **Framer's layout, component and variable systems never replace Figma's.**
- **Framer is the source of truth only for the editor UI's appearance**: colours, icons, typography, spacing, radii, controls, and hover and transition polish.
- **On conflict, Figma decides behavior and Framer decides looks.** The skin never adds, removes, merges, renames or reorders a Figma control or option.
- Anything Illigma-only is labelled *Illigma extension* or `[DECISION]`. It only calls existing Figma commands, and it is added only when the user asked for it or the spec allows it.

## 2. Before any feature work

1. Read [`PLAN.md`](PLAN.md): scope, milestone, slice and open decisions.
2. Read the relevant area spec in [`docs/parity/`](docs/parity/CHECKLIST.md): §3 behavior, §6 checklist items, §7 dependencies, §8 live-verification experiments. Also read the ADRs in [`docs/architecture.md`](docs/architecture.md) for the subsystem. For any UI work, read [`docs/ui/design-system.md`](docs/ui/design-system.md) and [`docs/ui/framer-visual-reference.md`](docs/ui/framer-visual-reference.md).
3. **Refresh the behavior contract before substantial implementation** (`PLAN.md` §11):
   - Check the items against the pinned typings.
   - Resolve or link conflicts (`PLAN.md` §15.3).
   - Make every clause concrete and testable.
   - If expected behavior changes, update the spec's text, tags and experiments first, and recount `docs/parity/CHECKLIST.md`.
   - Small fixes need only a short contract in the PR description.
4. **Collect Figma evidence** for the items you touch:
   - Run the experiments from the area's §8 in the disposable fixture file (§6 below).
   - Record interactions as dated logs in `docs/figma/observations/` (setup → action → result; platform, Figma version, keyboard layout, modifiers).
   - Capture data and render goldens with the fixture exporter into `fixtures/figma/<area>/<ID>/`.
   - If live Figma is unavailable, implement from the documented behavior, write "live verification pending" in the item, and keep going. Ask the user only when a missing detail blocks correctness.
5. **Implement through the full data path**: schema, transaction and undo, derived pipeline, render, hit-testing, panels, persistence, clipboard and export. Unfinished features stay behind a feature flag.
6. **Write tests whose titles carry the checklist IDs**, for example `it('[CV-109] …')`. Every clause, modifier and edge case of an item gets an assertion. Keyboard behavior is tested for macOS and for Windows/Linux.
7. In the PR, list the item IDs whose status changes. **Report honestly**: what is implemented, what is tested, and what still differs from Figma.

Keep to the requested scope. Inspect the current code and `git diff` before editing, because the user may have concurrent changes. A document records what was planned on its date; it is not proof that a feature works.

## 3. Evidence tags (every behavioral claim about Figma carries one)

| Tag | Meaning |
| --- | --- |
| `[API]` | Figma Plugin API typings v1.141.0 or REST API types v0.44.0, read locally |
| `[DOC:<id>]` | Official Figma Help Center article. Add "excerpt" if only a search excerpt was seen. |
| `[OBS]` | The read-only live-Figma observation of 2026-09-27 |
| `[OBS:<YYYY-MM-DD-topic>]` | A later dated observation log in `docs/figma/observations/` |
| `[FIX:<area>/<ID>/<case>]` | A golden fixture captured from the disposable Figma file |
| `[SRC:<url>]` | Another web source (forum, third party, repository) |
| `[KNOW]` | The author's own knowledge, not verified in this session |
| `[ILL]`, `[REQ]`, `[DECISION]`, `[USER-TOKENS]`, `[COMPUTED]` | Illigma requirements or decisions, the user's earlier tokens, and computed values. **None of these are claims about Figma.** |

- Every correctness-relevant claim that rests only on `[KNOW]` or `[SRC]` must also appear in the doc's **"Needs live Figma verification"** section.
- **Never claim** to have inspected a live Figma or Framer session, watched a video, or read an article body that you did not actually see.
- Experiment IDs such as `V-01` are local to each doc. Cite them with the prefix, for example "CV V-19".

## 4. Parity status: never claim parity without validation

- Statuses are *Not started*, *In progress*, *Implemented* and *Validated (1:1 parity)* (`PLAN.md` §12).
- They are **derived** by `tools/parity-matrix` from tagged tests and Figma evidence. **Never set a status or tick a `- [ ]` box by hand.**
- Only *Validated* items may be called "1:1", "parity" or "matches Figma". Use "implemented" otherwise, including in commit messages, PRs and user-facing text.
- Moving an item to another milestone means editing its `_M#·P#_` tag and adding a reason in `PLAN.md` §17. Never drop an item silently.
- IDs are unique across all checklists. After editing an area doc, run the recount and integrity commands in `docs/parity/CHECKLIST.md` §8 and update the index.

## 5. Project invariants (normative; see `docs/architecture.md` §3.3)

- **Every document change goes through a transaction and the history** (INV-01). One gesture (drag, resize, scrub, picker drag) is one undo entry. All panels share one history.
- **Transient UI state never mutates document geometry** (INV-02). Hover, marquee, snap guides, drag previews, viewport, selection outlines, panel state and theme are not document data and are never undoable.
- **Continuous pointer gestures survive re-renders and lost capture** (INV-03). Gesture state lives in the tool state machine. A temporary `lostpointercapture` or `buttons === 0` is not, by itself, a completed drag. Blur and visibility loss end the gesture deterministically, by commit or cancel, and never leave it half-applied.
- **A selected ancestor moves its descendants exactly once** (INV-04). Normalize the selection before applying deltas.
- **Frame selection bounds use the frame's own box**, not the union of its children (INV-05). Only groups derive their bounds from their children.
- **Typing and IME are separate from global shortcuts** (INV-06). Single-key shortcuts are suppressed in text fields, in canvas text editing and during IME composition.
- **Hit tolerances are in screen pixels**, converted with zoom and DPR. Geometry is in document coordinates (INV-07).
- **Determinism and round-trips:** results are deterministic (INV-08). Unknown fields survive save (INV-09). Derived writes happen inside the transaction that caused them (INV-10).
- **The canvas never renders through the UI framework.** `render` reads only the RenderTree, and the package layering in architecture §3.2 is enforced.

### UI layout invariants (see `docs/ui/design-system.md` §1 and §4)

- **Layout** (locked; user decision U-01 pending only for the toolbar):
  - the floating tool strip is at the **bottom** centre of the canvas;
  - pages and layers are on the left;
  - properties are on the right, with Figma's Design and Prototype tabs;
  - Export is docked at the bottom of the right sidebar;
  - there is no top bar;
  - the **dark theme is the default**.
- **Inspector sections** keep Figma's names, order and controls. The skin restyles; it never restructures.
- **No layout shift.** Use tabular figures. Hover actions keep their space reserved. Control heights come from tokens. Errors appear as rings and tooltips, never as inserted text. Panel widths change only when the user resizes them.
- **Tokens only.** No raw colour or size values outside `ui-tokens`. There are two themes, and the theme is an app preference, never document data.
- **Canvas chrome** (selection, handles, guides, measurements, noodles) is drawn in screen space by the renderer's overlay pass. It is never animated.
- **Accessibility.** Hit targets are at least 24×24. Text contrast is at least 4.5:1. Focus is always visible. Reduced motion is honoured.
- **Framer is a visual reference only.** Never copy Framer's or Figma's icon artwork, assets or code.

## 6. Figma access rules

- **Read-only inspection of the user's files.** Never change, comment on, share, publish or move them, and never rely on Undo to "restore" them.
- **Mutating experiments happen only in a disposable fixture file that the user has explicitly designated.** The fixture plugin refuses to run in any file not on its allowlist (`fixtures/figma/config.json`).
- **Never publish, share or upload project content.** Never install plugins or upload anything just to inspect behavior.
- Keep REST tokens in the OS keychain or the environment. Never put them in the repository or in documents.
- Keep private file names, links and artwork out of anything that could become public.
- A Figma MCP or design-context tool may be used only read-only on the user's files, and only to read the information a task needs. When a task actually implements a Figma design, follow the installed Figma skill's instructions first.

## 7. Repository map

| Path | What it is |
| --- | --- |
| `PLAN.md` | Master plan |
| `docs/parity/CHECKLIST.md` | Index, counts and integrity checks |
| `docs/parity/NN-*.md` | 11 area specs: CV, FR, AL, VC, PE, TX, CP, DS, PR, UX, IO |
| `docs/architecture.md` | Stack, ADRs, invariants, budgets |
| `docs/ui/*.md` | Design system (KIT) and Framer visual reference (FVR) |
| `docs/figma/observations/` | Dated observation logs (from RV-16) |
| `fixtures/figma/` | Figma golden data (from M0-20) |

## 8. Check commands

- **Code checks:** to be filled in by slice **M0-01** (planned: `pnpm install`, then `pnpm check` for lint, typecheck, dependency rules and unit tests; `pnpm test:e2e`; `pnpm bench`).
- **Documentation-only changes:** run the recount and integrity commands in `docs/parity/CHECKLIST.md` §8. Checks 3–6 must stay consistent. Also check that every relative link resolves. Do not run unrelated full test suites for documentation changes.
