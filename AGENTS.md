# Working on Illigma

Illigma is a vector editor with Figma-like interaction behavior and the user's chosen Framer-style visual tokens. Follow the user's current instructions over these project defaults. Do not rebuild the shell, replace the rendering stack, or change unrelated features to implement a single request.

## Figma reference workflow

For any request to add, fix, or match a Figma-style editor feature:

1. Read `docs/figma/README.md`, the relevant part of `docs/figma/feature-guide.md`, and `docs/figma/code-map.md`.
2. Translate informal wording using the terminology table. “Artboard” means a Figma frame in this project. Distinguish frames from groups, snapping from guides, and smart selection from auto layout.
3. Find the official source using `python3 scripts/figma_reference.py "<feature>"` or `docs/figma/source-catalog.md`. Read the current relevant article, not just its title or a cached overview. `python3 scripts/figma_reference.py --read ARTICLE_ID` retrieves its current text.
4. Follow `docs/figma/implementation-workflow.md`. Inspect the relevant control or interaction in live Figma when available. A screenshot, MCP node data, visible inspector controls, and an exercised interaction establish different kinds of evidence; do not substitute one for another. Do not treat an old observation as a fresh verification.
5. Write a focused behavior contract using `docs/figma/feature-contract-template.md` before a substantial implementation. Record expected behavior, evidence, deliberate differences, and acceptance tests. Proceed with routine authorized work without asking the user to approve the contract.
6. Implement the requested behavior in the existing architecture. Connect rendering, canvas interactions, layer tree, inspector, serialization, undo/redo, and export wherever applicable. Add meaningful regression coverage and run appropriate checks.
7. Report what is implemented and tested, and any remaining difference. Do not label a partial implementation “Figma 1:1.” Update the contract and code map if the supported behavior changes.

If live Figma is unavailable, read the official documentation and record the missing live check. Continue work supported by the evidence. Ask for a file/link or clarification only when the missing detail materially blocks correctness. Never claim to have inspected an inaccessible file or watched a video from its metadata alone.

Figma access does not authorize editing the user's reference artwork. Prefer read-only inspection. Exercise mutating interactions in a user-designated disposable reference fixture; do not publish, share, install plugins, or upload project content just to inspect behavior. Read the installed Figma design-to-code skill before using its design-context tool when a task actually implements a Figma design.

## Project invariants

- Toolbar stays at the bottom; Layers/Pages on the left; properties on the right; Export at the bottom of the right sidebar. Preserve the user's visual choices unless asked to change them.
- Preserve a continuous pointer gesture across panel/render updates. A temporary lost pointer capture or `buttons === 0` is not, by itself, a completed drag.
- A selected ancestor moves its descendants exactly once. Frame selection bounds use the frame, not the union of its artwork.
- Document changes go through history/persistence; transient hover, selection guides, and pan/zoom overlays must not silently alter document geometry.
- Keep typing/IME events separate from global shortcuts. Keep screen-pixel hit tolerances separate from document coordinates.
- Existing Illustrator-style Pathfinder operations are a deliberate feature. Do not equate them with Figma's non-destructive boolean groups.
- Inspect the current code and git diff before editing; the user may have concurrent changes. Documentation is a dated guide, not proof that every feature already works.

## Checks

`npm run build` builds the app. `npm test` runs Playwright with Google Chrome. Use targeted tests while iterating, then the appropriate regression scope. Documentation-only changes need link/schema/lookup checks, not an unrelated full browser run.
