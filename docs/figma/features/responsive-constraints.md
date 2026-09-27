# Responsive constraints

Status: implemented and verified at the stated scope
Date: 2026-09-27

## Scope and decision

Add freeform responsive resizing, a missing complement to Illigma's existing auto layout. Children can pin to either edge, both edges, center, or scale on each axis. Include nested frames, multiple selection, pin diagram, transient canvas guides, pointer/numeric resizing, history, persistence, duplication and SVG geometry. Keep Illigma's shell and visual tokens.

Reference research: a separate shallow clone of penpot/penpot at `9d08e26cb3d0ed003a5cf7df37adc778019bf75e`, outside the project. Read the constraints menu and geometry propagation modules. Useful principle: model constraints on each child and propagate parent transforms through the hierarchy. No source, styling, icons, or dependencies are copied into Illigma. Use original JavaScript suited to Illigma's world-coordinate document model.

## Evidence

- Official Figma article [Apply constraints](https://help.figma.com/hc/en-us/articles/360039957734), retrieved in full on 2026-09-27: left/top defaults, edge/center/stretch/scale semantics, nested frames, groups applying to members, and Command/Ctrl bypass. Auto-layout parents are excluded.
- Fresh macOS Figma inspector observation, local Illigma reference, Frame 2 / Rectangle 1, 108%: Position exposes Constraints; Left and Top defaults; opened horizontal menu lists Left, Right, Left + Right, Center, Scale. No document properties changed.
- Live resize interaction not exercised: no designated disposable fixture. Documented semantics support implementation; no live parity claim.

## Behavior contract

| Given | Action | Expected result |
| --- | --- | --- |
| Child in a freeform frame | Select child | Constraints section with two axis selectors and interactive pins |
| Right/bottom pin | Grow parent | Keep trailing offsets and child dimensions |
| Both edges | Grow/shrink parent | Keep leading offset and stretch size; floor at 1 document pixel |
| Center | Resize parent | Preserve center offset |
| Scale | Resize parent | Preserve proportional position and dimensions |
| Nested frame | Resize ancestor | Each descendant transforms once against its immediate parent |
| Multiple eligible children | Edit one axis | Apply that axis to all; preserve the other; show Mixed when needed |
| Pin diagram | Shift-click opposite pin | Select both edges; plain click selects a single edge |
| Canvas frame resize | Hold Command/Ctrl | Leave child world geometry unchanged; releasing modifier restores constrained preview from gesture baseline |
| Auto-layout parent or canvas root | Select child | Hide constraints; existing layout sizing remains authoritative |
| Hidden/locked descendants | Resize parent | Participate in resize even though unpickable |
| Undo / reload / duplicate | Use existing actions | Restore or retain constraints and geometry |

All pointer previews derive from an immutable gesture baseline to avoid drift or irreversible clamping. Constraint guides are noninteractive, screen-sized overlays excluded from export. Old documents use left/top defaults without migration. Invalid enum values are rejected on import.

## Deliberate limits

No layout-guide-relative constraints or arbitrary nested group model. Rotated objects use their stored unrotated layout box and retain rotation; not full Figma transformed-bound parity. Scale uses existing object scaling semantics. Stretched text wraps without stretching glyphs. SVG exports the current appearance, not responsive editor metadata; editable JSON retains it. Auto-layout flow has its own rules, including ignored children in this release.

## Implementation map

- `src/constraints.js`: original axis math, snapshot and hierarchy propagation.
- `src/main.js`: resize entry points, auto-layout adapter, transient guides, history callbacks.
- `src/inspector.js`, `src/styles.css`: contextual controls and pin diagram.
- `src/store.js`: validation; optional fields preserve old documents.
- `tests/constraints.spec.js`: geometry and browser acceptance coverage.

## Acceptance evidence

| Scenario | Evidence | Result |
| --- | --- | --- |
| All five modes, growing and shrinking, moved parent origin | Pure geometry tests | Passed |
| Nested frames, hidden/locked descendants, clamp recovery, bypass | Snapshot propagation test | Passed; descendants transform once |
| Pin diagram, Shift dual-edge pins, mixed selection | Browser controls and stored geometry | Passed; untouched axis retained |
| Pointer resize and temporary capture loss | Real Chrome drag with modifier toggle | Passed; bypass restores original child geometry; one undo restores gesture |
| Multiple root frames | Shared selection-handle drag and undo | Passed; each frame's child follows its own parent exactly once |
| Numeric frame resize, undo/redo, reload, duplicate | Browser workflow | Passed |
| Freeform frame nested in auto layout | Parent-width edit with Fill child | Passed; descendant trailing pin follows resized child |
| Text reflow, editing, switching to proportional scale | Browser SVG and saved dimensions | Passed; fixed box retained during editing, scale transforms verified |
| Invalid constraints | Import validator test | Rejected |
| SVG export | Exported XML check | Geometry retained; constraint guides and UI omitted |
| Inspector appearance | `/tmp/illigma-constraints.png`, visually inspected | Compact controls fit existing dark inspector; no external UI assets |

Verification: `npm run build` passed. Full Playwright suite passed 85/85 on 2026-09-27; included seven new constraint tests. After adding the multi-frame case, the final focused suite passed 8/8 with no application code changes. An existing pen test intermittently read a detached SVG handle between animation frames; its geometry read now polls for a valid bounding box without weakening its assertions.

The live Figma evidence is inspector/menu inspection only. Live resize parity remains unverified, and the deliberate limits above remain in scope notes.
