# Illigma implementation map

Inspected 2026-09-27. This is a navigation aid, not a guarantee of parity. Re-read the current source before editing; function names are more durable than line numbers. Preserve existing user changes.

## Architecture

| Area | Files / entry points | Important detail |
| --- | --- | --- |
| Shell and controls | `index.html`, `src/styles.css` | Static sidebar/tool markup; user-selected tokens and placement |
| Contextual inspector | `src/inspector.js`: `setupInspector`; `src/main.js`: `renderProperties` | One-time control organization; page/object/text/frame sections, mixed values, flow-child positioning locks, persistent panel width |
| Document and history | `src/store.js`: `makeObject`, `validDocument`, `preparePages`, `syncActivePage`, `begin`, `commit`, `cancel`, `history` | Page aliases, schema validation, JSON snapshots, browser persistence |
| Page/frame hierarchy | `src/main.js`: `pageFrames`, `frameContents`, `frameAncestors`, `frameSubtree`, `moveFrame` | Frames use `width/height`, objects use `w/h`; frame IDs and parent IDs matter |
| Rendering | `renderObjects`, `renderView`, `renderSelection`, `shapeElement`, `renderFast` | SVG drawing and overlay layers; do not mutate layout during ordinary rendering |
| Selection | `selectAllLayers`, `selectedFrames`, `selectionBoundsItems`, `selectObject`, `selectionMoveSnapshot` | Frame selection includes special IDs; selected ancestor ownership must prevent double transforms |
| Input | Pointer listeners and `finishGesture` in `src/main.js` | Window move/up handling survives transient capture loss; keyboard shortcuts must respect editors |
| Layers and pages | `renderLayers`, `renderPages` | DOM hierarchy and model hierarchy need to stay consistent |
| Auto layout | `src/autolayout.js`: `computeLayout`, `layoutPadding`; `src/main.js`: `applyAutoLayout`, `applyAllAutoLayouts` | Pure solver plus adapter; world coordinates, nested frames, hidden/ignored children |
| Responsive constraints | `src/constraints.js`: `constraintAxis`, `resizeFrameTree`; `src/main.js`: `resizeFrame`, `constraintTargets`, `renderConstraintGuides` | Optional per-child axis rules; snapshot-based nested resize, inspector pin diagram; see [contract](features/responsive-constraints.md) |
| Spacing/guides | `spacingItems`, `renderSpacing`, `snapMove`, `renderRulers`, `renderAltMeasurements` | Distinguish geometry snapping from overlays and selected-unit spacing |
| Text | `measureText`, `wrappedTextLines`, `shapeElement`, `startText`, `finishText` | Text dimensions, font measurement, SVG output, and textarea overlay must agree |
| Fonts | `src/fonts.js` | Local/Google font loading and caching; explicit imports rather than Figma's OS font service |
| Paint and effects | `applyPaint`, `renderColor`, `renderSwatches`, `renderEffects`; effect-rendering helpers | Selection target, Fill/Stroke channel, live edits, and history |
| Geometry | `src/geometry.js` | Paper.js paths, bounds, transforms, booleans, shape-builder regions |
| Export | `src/main.js`: `exportSvg` | Serialized SVG must omit editor UI and overlays |
| Tests | `tests/editor.spec.js`, `tests/autolayout.spec.js`, `playwright.config.js` | Browser workflows plus layout geometry; inspect fixture scope and selection before assertions |

Find the current implementation:

```sh
rg -n 'function (applyAutoLayout|finishGesture|renderLayers|renderSelection)' src/main.js
rg -n 'widthSizing|heightSizing|layoutAbsolute|childOrder' src
rg -n 'frame|selection|auto layout|pointer' tests
```

## Current representation and risks

- `state.doc` exposes active-page aliases. Use `preparePages`/`syncActivePage` when changing page structure; do not update only one alias and leave persisted pages stale.
- Each page has frame records in `artboards`; `artboard` is the active frame alias. The legacy property name does not mean Illustrator-style artboard behavior.
- Object ownership is stored by `frameId`; frame nesting by `parentId`. The current editor stores canvas/world positions and explicitly moves descendants. Do not insert parent-local coordinates into this schema without a deliberate migration and renderer changes.
- Ordinary groups use `groupId` associations. They are not a general nested group-node model. Components, boolean groups, and masks need richer models than a new icon or label.
- Current geometry has numeric dimensions and SVG paths; it is not a Figma vector-network implementation. Rotated layout items and intrinsic text measurements need particular care.
- Layout changes run through the save/transaction path. Solving geometry inside generic rendering previously interfered with gestures.
- Selection and editing eligibility are not identical concepts. `selectedObjects()` currently filters hidden/locked objects; matching Figma's ability to inspect otherwise unpickable layers may require separating those concerns.
- Keep visual hit areas, selection handles, labels, and ruler marks in screen units. Keep saved geometry in document units.

## Coverage at this snapshot

“Present” means an implementation exists, not that it matches every Figma detail. This table is based on source inspection and the previous task's tests, not a fresh full-suite run for this documentation task.

| Family | Current state | Difference / work needed for broader parity |
| --- | --- | --- |
| Pages and frames | Present, nested frames and multiple frames/page | Audit all reparenting, lock/visibility inheritance, and selection edge cases |
| Layers, selection, move/resize | Present with regression tests | Deep selection and context-specific Figma details still require direct comparison |
| Groups | Basic `groupId` grouping | No general arbitrary nested group tree |
| Auto layout | Horizontal/vertical/grid, wrap, sizing, padding, gap, limits, ignored children | See [layout limitations](../auto-layout-2026.md); on-canvas track controls, baseline, stroke accounting, and full intrinsic sizing differ |
| Smart selection | Numeric spacing for selected units | Not a complete Figma smart-selection/tidy-up interaction model |
| Rulers, smart guides, measurements, pixel grid | Present | Do not assume editable ruler guides, layout-guide styles, or pixel preview exist |
| Freeform constraints | Edge, center, dual-edge and scale modes on both axes; nested frames; numeric and pointer resizing; Command/Ctrl bypass | Uses stored layout boxes for rotated objects; no layout-guide-relative constraints; auto-layout parents use layout sizing instead. See [contract](features/responsive-constraints.md) |
| Pen and vector editing | SVG/Paper.js paths and anchors | Not arbitrary vector networks; audit advanced tools individually |
| Booleans/Pathfinder | Destructive geometry outputs, Illustrator-style operations | Figma's editable boolean groups are a separate feature |
| Masks | Frame clipping exists; full mask system absent | Alpha/vector/luminance mask scopes need a model and rendering |
| Text | Editable text, font loading, typography, fill-width wrapping | No complete rich-text, paragraph, text-on-path, or variable-axis UI |
| Paint | Solid fill/stroke and color popover/swatches | No full multi-paint, gradient, image/video/pattern paint model |
| Effects | Drop/inner shadow, layer/background blur | Do not infer glass, noise, textures, or universal Figma compositing parity |
| Components/variants/slots | Absent | Needs definitions, instances, overrides, dependency propagation |
| Styles/variables/libraries | Swatches only | Needs bindings, typed values, modes, reusable definitions, and potentially backend services |
| Prototype engine | Absent | Requires interaction graph, player, state and animation models |
| Import/export | Editable JSON and SVG output | Not native `.fig` interoperability or a complete import/export format suite |
| Multiplayer/comments/branches | Absent | Requires identity, shared storage, permissions, synchronization and conflict behavior |
| Figma Draw/AI/Motion | Limited overlapping vector tools only | No complete Draw toolset, external AI service, or animation timeline |

## User-specific choices to preserve

These come from this project's conversation, not universal Figma claims:

- Bottom tool strip; left Pages/Layers; right contextual inspector; no top app bar; Export pinned at bottom right.
- Framer-inspired dark tokens, Inter UI type, blue selection, compact Pathfinder icons.
- Frame labels omit dimensions and stay legible through zoom.
- Frame selections avoid extra unnecessary handles; use frame edges for multi-frame bounds.
- Color/swatches in a popover; no redundant Fill/Stroke swatch widget in the toolbar.
- Alt measurements and guide labels include `px`; manual dragging uses whole-pixel positions when smart guides are off.
- Alt+L toggles all layer expansion in Illigma. Do not assert it exactly matches every Figma collapse behavior.
- Existing Adobe-style Pathfinder options coexist with the Figma-like interaction model.

If a future request conflicts with these choices, follow the user's newer direction and update this list.
