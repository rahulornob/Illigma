# Frames, groups, sections, constraints & layout grids — Figma parity spec

> **Status:** research draft (date 2026-10-08). **Nothing is implemented.** Every checklist item below is status **Not started**. No item may be marked as parity until it is implemented in Illigma **and** validated against live Figma behavior.
>
> **Rule of precedence:** Figma is the source of truth for all behavior, data model and edge cases in this document. Framer governs only the editor's visual appearance, which this document does not specify.
>
> **Evidence legend**
>
> | Tag | Meaning |
> | --- | --- |
> | `[API]` | Figma Plugin API typings v1.141.0 (`plugin-api.d.ts`) or Figma REST API types v0.44.0 (`api_types.ts`). Line references are in §9. |
> | `[DOC:<id>]` | Official Figma Help Center article. `excerpt` means that only a WebSearch summary or excerpt of the article was seen in this session; the full article body was **not** read. |
> | `[OBS]` | Read-only live-Figma UI observation, 2026-09-27 (`old/docs/figma/observations/2026-09-27-live-figma.md`). `[OBS:constraints-note]` is the companion inspector observation from the same date, recorded in `old/docs/figma/features/responsive-constraints.md`. Both cover what was visible in the UI, not interaction results. |
> | `[KNOW]` | The author's prior knowledge of Figma. **Not verified in this session.** Wherever it affects correctness, it is repeated in §8. |
> | `[SRC:<url>]` | A non-help-center web source (Figma blog or best-practices page, Figma forum, third-party tutorial), seen only as a search excerpt. |
>
> **Research limitations (stated plainly).** help.figma.com, figma.com and framer.com could not be fetched; the proxy refused the connection. Official articles were seen only as WebSearch excerpts (some via the `figma-signup.helpjuice.com` mirror of the help center, marked "mirror"). In the first research pass the shared WebSearch budget ran out. When the work resumed on 2026-10-08, a second round of searches covered the preset catalog, Resize to fit, group/frame/section conversion, drag-reparent modifiers, section defaults, the Wrap-in-section shortcut, the Clip content default, layout-guide defaults, dev status and duplicate placement. Sections 1–5 were corrected where those excerpts contradicted earlier `[KNOW]` claims. Several answers rest only on forum posts (`[SRC]`) and stay in §8. A third pass on 2026-10-08, after the usage limit reset, made seven more searches (preset catalog, group constraints, layout-guide defaults, Clip content default, the frames article, the layout-guide toggle and section selection). It added the help-center excerpts on group constraints, the layout-guide tint, the scope of the global toggle and hidden guides, plus forum reports on clicking inside sections. That pass also wrote §6–§9. No video was watched, and no live Figma interaction was performed for this document.

---

## 1. Scope & terminology

### 1.1 In scope

- **Frames**: Frame tool (click, drag, modifiers), frame presets (devices, paper, social media, etc.), default properties, nesting, auto-adoption of enclosed layers, reparenting on drag, frame name labels on the canvas (click to select, drag to move, double-click to rename), Clip content, Resize to fit, Frame selection (⌥⌘G), removing a frame while keeping its children, rotation of frames as containers.
- **Groups**: Group (⌘G) and Ungroup (⇧⌘G). Derived bounds, resize behavior (proportional scaling of children), properties a group has and lacks, mask scoping, constraints on groups (applied to children), nested groups.
- **Boolean groups** as *containers*: bounds and constraint pass-through only. Boolean geometry belongs to the vectors area.
- **Sections**: Section tool (⇧S), Wrap in new section, nesting rules (page/section only), adoption of objects by moving or resizing, no constraint propagation, title label, fill/stroke, dev status (Ready for dev/Completed/Changed), hidden contents flag, sections in prototyping and as thumbnails.
- **Constraints**: Left/Right/Left & Right/Center/Scale and Top/Bottom/Top & Bottom/Center/Scale. Default values, applicability, propagation algorithm, nested frames, group and boolean pass-through, absolute-positioned auto-layout children, ignoring constraints while resizing (⌘/Ctrl), interaction with stretch layout guides, aspect-ratio lock, instances.
- **Layout guides** (Figma's UI3 term since May 2025; formerly "layout grids"; the API still calls them `LayoutGrid`): Uniform grid, Columns and Rows. Alignment (Stretch/Left/Center/Right or Top/Center/Bottom), count (incl. Auto), gutter, margin/offset, width/height, color, per-guide visibility, the global show/hide toggle, multiple guides per frame, layout guide styles (`GridStyle`), variable binding.

### 1.2 Out of scope here (owned by other areas; see §7)

- The auto layout engine itself, including Grid auto layout (`layoutMode: 'GRID'`), Hug/Fill, min/max and wrap. Only its boundaries with frames and constraints are covered here.
- The general selection model (deep select, marquee rules, Enter/⇧Enter navigation), transforms, the Scale tool and smart guides/snapping. Only frame/group/section-specific consequences are covered here.
- Components, instances, variants and slots. Only constraint and clip behavior *inside* them is covered here.
- Prototyping (scroll/overflow, fixed layers, flows). Only section navigation and frame container prerequisites are covered here.
- Ruler guides (`guides` on pages and frames), FigJam-only section features, Figma Slides, Figma Draw's `TRANSFORM_GROUP` / repeat modifiers.
- Dev Mode as a product. Illigma has no Dev Mode, but `devStatus` is document data and must be preserved and editable (see FR-148 to FR-150).

### 1.3 Local-first notes

- Frame presets are a static, built-in catalog. Illigma ships it offline. The node data model holds **no** preset identifier: a preset only sets width and height, and usually the name. `[API]` (no preset field exists on `FrameNode`)
- Dev status, "Changed" detection and status descriptions are stored on the node. Multiplayer notification behavior is out of scope.
- Show/hide layout guides, frame-label rendering and preset panel state are editor UI state, not document data (see §2.10).

### 1.4 Terminology (Figma terms)

| Figma term (UI3) | API / data | Meaning | Not to be confused with |
| --- | --- | --- | --- |
| Frame | `FRAME` | Container with its own fixed size, fills, strokes, effects, corner radius, optional clipping, layout guides, auto layout and prototyping settings. Size is independent of its content. `[API]` `[DOC:360041539473 excerpt]` | An Illustrator artboard. A Figma frame can be nested at any depth `[SRC:https://www.figma.com/best-practices/groups-versus-frames/]` |
| Top-level frame | `FRAME` whose parent is a page (or a section, see FR-041) | Shows a name label on the canvas and is bolded in the Layers panel `[DOC:360041539473 excerpt]`. In prototypes it acts as a screen `[KNOW]` | A nested frame |
| Group | `GROUP` | Container whose position and size are **derived** from its children. It has no fill, stroke, clip, layout guide or constraints of its own. `[API]` `[SRC:https://www.figma.com/best-practices/groups-versus-frames/]` | A frame. A group cannot be empty `[API]` |
| Boolean group | `BOOLEAN_OPERATION` | A group-like container whose rendered geometry is the boolean combination of its children. Constraints pass through it, as with groups `[API]` | A flattened vector |
| Section | `SECTION` | Canvas-organizing container. It can live only on a page or in another section. It has no rotation, opacity, effects or constraint propagation. `[API]` `[DOC:9771500257687 excerpt]` | A frame or a page |
| Container parent | – | The nearest ancestor that is a page, frame, component or instance (groups and booleans are skipped). A node's X/Y and constraints are relative to it. `[API]` | The direct parent |
| Constraints | `constraints: {horizontal, vertical}` | Per-axis rule for how a child responds when its container frame is resized `[API]` `[DOC:360039957734 excerpt]` | Auto layout sizing (Fixed/Hug/Fill) |
| Layout guide (formerly layout grid) | `layoutGrids: LayoutGrid[]` | Non-rendered (for export purposes) visual guide attached to a frame: Uniform grid, Columns or Rows `[DOC:360040450513 excerpt]` | Grid auto layout (`layoutMode: 'GRID'`), the pixel grid, ruler guides `[DOC:360040450513 excerpt]` |
| Uniform grid | `pattern: 'GRID'` | Square cells of `sectionSize` `[API]` `[DOC:360040450513 excerpt]` | Grid auto layout |
| Columns / Rows | `pattern: 'COLUMNS' \| 'ROWS'` | Vertical / horizontal bands with count, gutter, margin/offset and alignment `[API]` | – |
| Layout guide style | `GridStyle` (`type: 'GRID'`) | Named, reusable list of layout guides `[API]` `[DOC:360038746534 title]` | Color, text or effect styles |
| Ruler guide | `guides: Guide[]` on a page or frame | Single line at an X or Y offset; frame guides belong to the frame `[API]` | Layout guides |
| Clip content | `clipsContent` | Whether descendants are visible outside the frame's shape `[API]` | Masks, image crop |
| Resize to fit | (command) | One-time fit of a frame's bounds to its children `[DOC:360041539473 excerpt]` | Hug contents (continuous, auto layout only) |
| Frame selection | (command, ⌥⌘G) | Wraps the selection in a new frame `[SRC:forum.figma.com/t/unframe-selection/46384]` | Create component (⌥⌘K) |
| Remove frame | Ungroup (⇧⌘G) applied to a frame | Deletes the frame and keeps its children in place `[SRC:https://www.figma.com/best-practices/groups-versus-frames/]` | Delete (which removes the children too) |
| Wrap in new section | (context-menu command, ⌘S / Ctrl+S) | Wraps the selection in a new section `[DOC:9771500257687 excerpt]` `[SRC:https://forum.figma.com/t/wrap-in-a-section-not-available-in-new-ui3/83232]` | Frame selection; the Section tool (⇧S), which draws an empty section |
| Convert to frame / group / section | Container-type dropdown above the Position fields, context menu "Convert to frame" / "Convert to section", Object menu | Changes the container kind of the selected frame, group or section in place, keeping its name `[SRC:https://forum.figma.com/t/changing-a-section-into-a-group-or-frame/31994]` `[SRC:https://forum.figma.com/suggest-a-feature-11/allow-the-name-to-be-preserved-when-a-group-is-made-into-a-frame-via-ctrl-alt-g-15688]` | Frame selection (⌥⌘G), which adds a new wrapper |
| Scale (constraint) | `SCALE` | Proportional position and size relative to the container, when the container resizes `[DOC:360039957734 excerpt]` | The Scale tool (K), which also scales stroke widths, effects and text size `[KNOW]` |

### 1.5 When to use which (Figma's guidance)

| Need | Use | Why |
| --- | --- | --- |
| Size controlled independently of content; screens/devices; clipping; layout guides; nested scrolling in prototypes; responsive resizing of children | **Frame** | Only frames have independent bounds, clip content, layout guides and act as constraint containers `[SRC:https://www.figma.com/best-practices/groups-versus-frames/]` `[API]` |
| Treat several layers as one unit without adding a box, where the bounds should follow the content | **Group** | The bounds are derived from the children. Grouping is non-destructive `[SRC:https://www.figma.com/best-practices/groups-versus-frames/]` |
| Define resize rules for a set of layers | **Frame**, not a group | Constraints are measured against the nearest frame, never against a group's bounds `[DOC:360039957734 excerpt]` |
| Organize areas of the canvas, label flows, hand off to developers, link a prototype to "the last screen in this area" | **Section** | Sections are labelled canvas regions, can hold dev status, and are prototype destinations `[DOC:9771500257687 excerpt]` `[DOC:16194160540567 excerpt]` |

### 1.6 Terms users often confuse

- "Layout grid" (old name) is the same as "layout guide" (current name) and is **not** the same as "Grid" auto layout. `[DOC:360040450513 excerpt]` `[DOC:360039957934 excerpt]`
- "Resize to fit" (one-time, for freeform frames) is different from "Hug contents" (a continuous auto-layout setting) and from text auto-sizing. `[KNOW]`
- "Remove frame" is not a separate data operation. It is Ungroup applied to a frame. `[SRC:https://www.figma.com/best-practices/groups-versus-frames/]`
- A section is **not** a frame. It cannot be placed in a frame, does not clip, has no constraints and does not scale its children. `[DOC:9771500257687 excerpt]` `[API]`
- The Scale constraint is not the Scale tool (K). `[SRC:https://www.figma.com/best-practices/groups-versus-frames/]` `[KNOW]`

---

## 2. Data model

All property names come from the Plugin API unless marked *REST*. "Doc" means persisted document data, and "UI" means transient editor state.

### 2.1 Capability matrix by node type `[API]`

| Capability | FRAME | COMPONENT / INSTANCE / COMPONENT_SET | GROUP | BOOLEAN_OPERATION | SECTION |
| --- | --- | --- | --- | --- | --- |
| `children` | ✓ | ✓ (instance children cannot be reparented) | ✓ (non-empty) | ✓ | ✓ |
| Independent `width`/`height` | ✓ | ✓ | derived | derived | ✓ |
| `rotation` | ✓ | ✓ | ✓ | ✓ | ✗ (no `LayoutMixin`) |
| `fills` / `strokes` | ✓ (individual stroke sides too) | ✓ | ✗ | ✓ (own geometry paint) | ✓ (`MinimalFillsMixin`, `MinimalStrokesMixin`) |
| `cornerRadius`, per-corner radii, `cornerSmoothing` | ✓ | ✓ | ✗ | `cornerRadius` only | ✓ (`CornerMixin`, `RectangleCornerMixin`) |
| `opacity`, `blendMode`, `effects`, `isMask` | ✓ | ✓ | ✓ | ✓ | ✗ |
| `clipsContent` | ✓ | ✓ | ✗ | ✗ | ✗ |
| `layoutGrids`, `gridStyleId` | ✓ | ✓ | ✗ (REST: "GROUP nodes do not have this attribute") | ✗ | ✗ |
| `guides` (ruler guides) | ✓ | ✓ | ✗ | ✗ | ✗ |
| `constraints` on itself | ✓ | ✓ | ✗ (applied to children) | ✗ (applied to children) | ✗ |
| Propagates constraints to children on resize | ✓ (if `layoutMode: 'NONE'`, or for `ABSOLUTE` children) | ✓ | n/a (resizing a group scales the children, see 3.6) | n/a | ✗ ("Sections do not propagate constraints to their children") |
| `layoutMode` (auto layout) | ✓ | ✓ | ✗ | ✗ | ✗ |
| `devStatus` | ✓ | ✓ | ✗ | ✗ | ✓ |
| `exportSettings` | ✓ | ✓ | ✓ | ✓ | ✓ |
| Prototype `reactions` | ✓ | ✓ | ✓ | ✓ | ✗ |
| `explicitVariableModes` | ✓ | ✓ | ✓ | ✓ | ✓ (via `SceneNodeMixin`) |
| `targetAspectRatio` (lock) | ✓ | ✓ | ✓ | ✓ | ✓ |
| `expanded` (Layers-panel disclosure) | ✓ | ✓ | ✓ | ✓ | – (not on `SectionNode` typings) |
| `sectionContentsHidden` | ✗ | ✗ | ✗ | ✗ | ✓ |
| File thumbnail target | ✓ | ✓ (component, set) | ✗ | ✗ | ✓ |

Nodes that carry `constraints` (`ConstraintMixin`) `[API]`: FRAME, COMPONENT, COMPONENT_SET, INSTANCE, SLOT (via `BaseFrameMixin`), RECTANGLE, LINE, ELLIPSE, POLYGON, STAR, VECTOR, TEXT, TEXT_PATH (and the FigJam-only STAMP and HIGHLIGHT). Nodes that do **not** carry it include GROUP, BOOLEAN_OPERATION, SECTION and SLICE.

### 2.2 Frame properties relevant to this area

| Property | Type / enum | Default (new frame) | Range / rules | Kind |
| --- | --- | --- | --- | --- |
| `type` | `'FRAME'` | – | – | Doc |
| `name` | string | "Frame N" for drawn frames `[KNOW]`; preset name for preset frames `[KNOW]` | any string | Doc |
| `x`, `y` | number | click/drag point | relative to the container parent; fractional allowed `[API]` | Doc |
| `width`, `height` | number | 100 × 100 on click `[API]` | ≥ 0.01 `[API]` | Doc |
| `rotation` | degrees (−180..180] | 0 | `[API]` | Doc |
| `relativeTransform` | 2×3 affine, unit axes | identity + translation | no scale component; size is in `width`/`height` `[API]` | Doc |
| `fills` | `Paint[]` | `[SOLID #FFFFFF, opacity 1]` for `createFrame` / the Frame tool `[API]` | – | Doc |
| `strokes`, `strokeWeight`, individual stroke weights | – | none `[KNOW]` | – | Doc |
| `cornerRadius`, `topLeftRadius`… , `cornerSmoothing` | number; smoothing 0..1 | 0 | ≥ 0; clamped to half the edge length when rendering `[API]` | Doc |
| `clipsContent` | boolean | **Unverified, and the sources conflict.** A February 2024 forum report says all new frames clip. A September 2025 feature request, "Clip content in Layout should be on by default", implies Frame-tool frames now start with `false` `[SRC:https://forum.figma.com/suggest-a-feature-11/clip-content-in-layout-should-be-on-by-default-45504]`. Illigma must make the default a single named constant so it can be set once V-07 is resolved | – | Doc |
| `layoutGrids` | `LayoutGrid[]` | `[]` | ordered list | Doc |
| `gridStyleId` | string | `""` | id of a `GridStyle` | Doc |
| `guides` | `Guide[]` (`axis: 'X'\|'Y'`, `offset`) | `[]` | frame-owned ruler guides `[API]` | Doc |
| `constraints` | `{horizontal, vertical}: ConstraintType` | `{MIN, MIN}` (Left, Top) `[DOC:360039957734 excerpt]` `[DOC:360041539473 excerpt]` | 5 values per axis | Doc |
| `layoutMode` | `'NONE'\|'HORIZONTAL'\|'VERTICAL'\|'GRID'` | `'NONE'` `[API]` | shown as "Freeform" in the UI3 Layout section `[OBS]` | Doc |
| `layoutPositioning` (as a child) | `'AUTO'\|'ABSOLUTE'` | `'AUTO'` | `ABSOLUTE` re-enables constraints inside an auto-layout parent `[API]` | Doc |
| `targetAspectRatio` | `Vector \| null` | null | set via lock/unlock `[API]` | Doc |
| `devStatus` | `{type:'READY_FOR_DEV'\|'COMPLETED', description?} \| null` | null | only on nodes directly under a page or section, and never inside a node that already has a status `[API]` | Doc |
| `overflowDirection`, `numberOfFixedChildren` | prototype | `'NONE'`, 0 | cross-area M7 `[API]` | Doc |
| `detachedInfo` | | null | set when a frame comes from a detached instance `[API]` | Doc |
| `expanded` | boolean | – | Layers-panel disclosure state `[API]`. In Figma this is document data; Illigma may persist it per file | Doc/UI |
| `boundVariables.width/height/cornerRadius/opacity/visible/…` | `VariableAlias` | – | cross-area M6 `[API]` | Doc |

### 2.3 Group properties

- Has `type: 'GROUP'`, `children` (**must be non-empty**: "Figma does not support empty groups"), `opacity`, `blendMode`, `effects`, `effectStyleId`, `isMask`, `maskType`, `x`/`y`/`width`/`height`/`rotation`/`relativeTransform` (derived from children), `exportSettings`, `reactions`, `expanded`, `targetAspectRatio`, `visible`, `locked` and `explicitVariableModes`. `[API]`
- It has **no** `fills`, `strokes`, corner radius, `clipsContent`, `layoutGrids`, `constraints` or `layoutMode`. `[API]`
- *REST*: `GroupNode` is typed as `{type:'GROUP'} & FrameTraits`, so the file-level JSON shares the frame schema. An importer must accept frame-like fields on groups and ignore the ones that do not apply. `[API]` (REST `api_types.ts` L983)

### 2.4 Section properties

- Has `type: 'SECTION'`, `children`, `sectionContentsHidden: boolean`, `fills`, `fillStyleId`, `strokes`, stroke weight and alignment, `cornerRadius`, per-corner radii, `cornerSmoothing`, `x`/`y`/`width`/`height`/`relativeTransform`, `exportSettings`, `devStatus`, `targetAspectRatio`, `visible`, `locked`, `explicitVariableModes`. `[API]`
- It has **no** `rotation`, `opacity`, `blendMode`, `effects`, `constraints`, `clipsContent`, `layoutGrids`, `layoutMode` or `reactions`. `[API]`
- `resize(w,h)` behaves exactly like `resizeWithoutConstraints(w,h)`, with w,h ≥ 0.01. `[API]`
- *REST*: `devStatus.type` may also be `'NONE'`. `[API]`

### 2.5 Constraint enum mapping `[API]` `[OBS:constraints-note]`

| Plugin `ConstraintType` | REST horizontal | REST vertical | UI3 horizontal label | UI3 vertical label |
| --- | --- | --- | --- | --- |
| `MIN` | `LEFT` | `TOP` | Left | Top |
| `MAX` | `RIGHT` | `BOTTOM` | Right | Bottom |
| `STRETCH` | `LEFT_RIGHT` | `TOP_BOTTOM` | Left + Right | Top + Bottom (exact label unverified) |
| `CENTER` | `CENTER` | `CENTER` | Center | Center |
| `SCALE` | `SCALE` | `SCALE` | Scale | Scale |

### 2.6 Layout guide (`LayoutGrid`) schema `[API]`

```
type LayoutGrid = RowsColsLayoutGrid | GridLayoutGrid

RowsColsLayoutGrid {
  pattern:   'ROWS' | 'COLUMNS'
  alignment: 'MIN' | 'MAX' | 'STRETCH' | 'CENTER'   // MIN = Left/Top, MAX = Right/Bottom
  gutterSize: number
  count:      number            // Infinity == "Auto" in the UI
  sectionSize?: number          // column width / row height; IGNORED when alignment == STRETCH
  offset?:      number          // distance to frame edge; IGNORED when alignment == CENTER
  visible?:     boolean         // default true
  color?:       RGBA
  boundVariables?: { sectionSize?, count?, offset?, gutterSize? : VariableAlias }
}
GridLayoutGrid {
  pattern: 'GRID'
  sectionSize: number           // cell size
  visible?: boolean
  color?: RGBA
  boundVariables?: { sectionSize?: VariableAlias }
}
```

- *REST* `LayoutGrid` is a single flat object that always includes `pattern, sectionSize, visible, color, alignment, gutterSize, offset, count`. Its variable binding keys are `gutterSize, numSections, sectionSize, offset`; note that REST names the count binding `numSections`. `[API]`
- Field applicability (what the inspector shows or edits):

| Pattern / alignment | count | width or height (`sectionSize`) | gutter | margin (`offset`, STRETCH) | offset (`offset`, MIN/MAX) |
| --- | --- | --- | --- | --- | --- |
| GRID | – | ✓ (cell size) | – | – | – |
| COLUMNS/ROWS · STRETCH | ✓ | auto-computed, not editable | ✓ | ✓ | – |
| COLUMNS/ROWS · MIN / MAX | ✓ (incl. Auto) | ✓ | ✓ | – | ✓ |
| COLUMNS/ROWS · CENTER | ✓ (incl. Auto) | ✓ | ✓ | – | – (ignored) |

  Calling the STRETCH `offset` "Margin" and the MIN/MAX `offset` "Offset" in the UI is `[SRC:https://uxcel.com/lessons/layout-grids-439]` + `[KNOW]`. The ignore rules come from `[API]`.
- `GridStyle { type:'GRID', layoutGrids: LayoutGrid[], boundVariables?: { layoutGrids?: VariableAlias[] } }`. A frame links to a style through `gridStyleId`. `[API]`

### 2.7 Coordinate rule `[API]`

`relativeTransform` (and so the inspector's X/Y) is relative to the **container parent** (page, frame, component or instance). It is **not** relative to a group or boolean parent. Groups and booleans resize to fit their children, so their transform is derived. Absolute position is the product of container transforms, skipping groups and booleans. Section children: see FR-144 (unverified whether a section acts as a coordinate container in the UI).

### 2.8 Variable binding `[API]`

- Bindable on frames and children: `width`, `height`, `cornerRadius` and per-corner radii, `opacity`, `visible`, `strokeWeight` and per-side weights, padding/spacing (auto layout) and `minWidth`… (auto layout only).
- Bindable on a layout guide: `sectionSize`, `count`, `offset`, `gutterSize`. On a GRID pattern, only `sectionSize`.
- Bindable on a layout guide style: `layoutGrids` (alias list).
- Explicit variable modes can be set on frames, groups, sections and other scene nodes.

### 2.9 Defaults table (all to be confirmed, see §8)

| Item | Default | Evidence |
| --- | --- | --- |
| Frame created by click | 100 × 100, white fill | `[API]` (`createFrame`: "similar to using the F shortcut followed by a click") |
| Constraints of any new layer | Left, Top | `[DOC:360039957734 excerpt]` |
| Type of a newly added layout guide | Uniform grid | `[DOC:360040450513 excerpt]` ("a uniform grid will be applied to the frame by default") |
| Settings flyout on add | Opens automatically when a layout guide is added (since April 2025) | `[SRC:https://forum.figma.com/forum-news-and-guidelines-25/updates-announced-on-the-april-25-release-notes-livestream-39496]` |
| Layout guide color | red at 10% opacity (`#FF0000` per tutorials) | `[DOC:360040450513 excerpt]` ("default tint is red at 10% opacity"), `[SRC:https://uxcel.com/lessons/layout-grids-439]` for the hex value |
| Uniform grid size | 10 (10 × 10 cells) | `[SRC:https://uxcel.com/lessons/layout-grids-439]` (excerpt) `[KNOW]` |
| Columns/Rows when first chosen | count 5, Stretch, margin 0, gutter 20 per `[KNOW]`. Tutorials disagree (count 12; margin 0 or 24) `[SRC]` | V-36 |
| Section fill/stroke | Sources conflict: grey (2023 forum) or white `#FFFFFF` (later forum). There is no user setting for the default | `[SRC:https://forum.figma.com/t/default-section-colours-in-figma/35557]` (V-46) |
| Duplicate of a top-level frame | Placed 40 px to the right of the original (2021 report) | `[SRC:https://forum.figma.com/t/set-default-frame-spacing/2306]` (V-38) |
| Layout guide visible | true | `[API]` ("Defaults to true") |
| `layoutMode` | NONE (Freeform) | `[API]` |
| Group/frame/section names | "Group N" / "Frame N" / "Section N" | `[KNOW]` |

### 2.10 Document data vs. transient UI state

| Document (persist, undoable, copy/paste) | Transient UI (not undoable, not in document export) |
| --- | --- |
| Everything in 2.2–2.8, including `layoutGrids[i].visible` and `devStatus` | Global "Layout guides" view toggle (show/hide all). The help center says it changes visibility "for all layout guides in a file" `[DOC:360040450513 excerpt]`. Whether it persists with the file, per user or per session is unverified (V-31) |
| `name` (shown by the frame label) | Frame-label hover/highlight; label rendering and truncation |
| `expanded` (Figma persists it) | Frame-tool preset panel scroll and expanded categories |
| | The ⌘/Ctrl "ignore constraints" modifier state during a resize gesture |
| | Constraint indicator overlays, resize previews |

### 2.11 Illigma persistence requirements (derived)

- Every Doc property in §2 must round-trip through save, open, undo, redo, copy/paste and duplicate without loss, including `count = Infinity` (Auto), absent optional fields and bound-variable aliases.
- Invalid enum values on import (e.g., a layout guide with `pattern: 'FOO'`) are rejected or repaired deterministically, never silently coerced into a different behavior. This is an Illigma rule; Figma import behavior is out of scope.
- The importer maps REST constraint names to the plugin enum per §2.5.

---

## 3. Behavior specification

### 3.1 Frame creation

1. **Tool.** Frame tool shortcut is `F`, with `A` as an alias. In the UI3 bottom toolbar it shares a flyout with Section (⇧S) and Slice (S). `[KNOW]` (the bottom tool strip itself is `[OBS]`)
2. **Click without drag** creates a 100 × 100 frame with a white fill `[API]`. Placement (top-left at the click point is believed `[KNOW]`), selection of the new frame and the automatic return to the Move tool are `[KNOW]`.
3. **Drag** creates a frame spanning the drag rectangle. A drag in any direction is normalized to positive width and height. While dragging: **Shift** constrains to a square, **Alt/Option** draws from the start point as the center, **Space** (held) moves the in-progress rectangle, and snapping to smart guides and the pixel grid applies. `[KNOW]`
4. **Target parent.** The new frame becomes a child of the innermost eligible container under the drag start point: a frame or component (not an instance's internals), a section, or the page. If that container uses auto layout, the new frame is inserted into the flow (cross-area). `[KNOW]`
5. **Auto-adoption.** Drawing a frame so that it fully encloses existing sibling layers moves those layers into the new frame, keeping their absolute positions. `[KNOW]`, scope unverified: V-04. Partially enclosed layers are not adopted. `[KNOW]`
6. **Z-order.** The new frame is placed above all existing siblings in its parent. `[KNOW]`
7. **Presets.** While the Frame tool is active, the right sidebar lists frame presets grouped by category `[DOC:360041539473 excerpt]`. The nine categories are Phone, Tablet, Desktop, Presentation, Watch, Paper, Social media, Figma Community and Archive `[DOC:360041539473 excerpt, mirror]` `[SRC:https://forum.figma.com/suggest-a-feature-11/ability-to-pin-or-customize-default-frame-presets-50212]`. The individual entries and sizes are not in any source seen (V-01). Users cannot add, pin or reorder presets `[SRC:forum 50212]`. Clicking a preset creates a frame of that exact size, named after the preset `[KNOW]`. Where it is placed (beside existing content, or at the viewport center) is unverified: V-02. Choosing a frame preset also makes Figma select a matching prototype device `[DOC:21158597546391 excerpt]` (cross-area M7). Figma keeps the catalog current with new hardware and moves older devices to **Archive** `[SRC:forum feature request, January 2026, search excerpt]`.
8. **Changing the preset of an existing frame** (selected frame → frame preset dropdown at the top of the Design panel) sets the frame's width and height to the preset's. **Children's constraints are applied**; layers with default Left/Top constraints keep their size and position. `[DOC:360041539473 excerpt]`
9. **Orientation swap** (portrait/landscape) swaps width and height through the same constraint-applying resize. `[KNOW]`, and its presence in UI3 is unverified.
10. **No preset identity is stored.** After creation, a preset frame is an ordinary frame. `[API]` (absence of a field)
11. **Quick-add.** With the Frame tool active, hovering a top-level frame shows a **+** beside it. Clicking it creates a copy of the frame and nudges neighboring frames over to make room. The canvas spec recorded this from a search excerpt of the frames article `[DOC:360041539473 excerpt, via 01-canvas-selection-transform §3]`; this pass did not see that excerpt again (V-49).
12. **Pixel grid.** "Frames, sections and components … always snap to the pixel grid, even if Snap to pixel grid is disabled" `[DOC:360041065034 excerpt, via 01-canvas-selection-transform §3]`. Which operations this covers (draw, move, resize) is owned by the canvas spec (its V-11).

### 3.2 Frame structure, nesting & reparenting

- Frames can contain any layer type **except** sections (and pages) `[DOC:9771500257687 excerpt]`, and they nest to any depth `[SRC:https://www.figma.com/best-practices/groups-versus-frames/]`.
- A frame's bounds never follow its content. Children may extend outside the frame, and resizing a frame never adds or removes children. `[DOC:360041539473 excerpt]` `[KNOW]`
- **Drag-reparenting (canvas):** Figma calls this automatic nesting. When a moved layer is dropped so that the drop location is inside a different frame, it becomes a child of the deepest eligible frame there. When it is dropped outside its frame, it moves to the next container (section or page). The absolute transform (position and rotation) is preserved; the layer is appended at the top of the new parent's z-order. `[KNOW]` `[SRC:https://forum.figma.com/t/disable-auto-nesting-auto-reparenting-while-moving-objects/799]`
  - **Space** pressed at pointer-down, before the drag starts, suppresses reparenting for that gesture. Users report the timing is fussy. `[SRC:forum 799]`
  - A **locked** frame does not adopt layers dragged over it `[SRC:forum 799]`.
  - There is no setting that disables automatic nesting `[SRC:forum 799]`.
  - Whether the decision uses the pointer position or the layer's bounds is unverified: V-05.
- Instance sublayers cannot be reparented, and nodes cannot be moved into an instance. `[API]` (`group` doc: "cannot include any node that cannot be reparented, such as children of instances")
- A container cannot be moved into its own descendant (cycle prevention). `[KNOW]`
- Frames can be rotated. Children rotate with the frame, and constraints are evaluated in the frame's local, unrotated space. `[API]` (rotation), `[KNOW]`

### 3.3 Frame labels & selecting frames on the canvas

- Name labels are drawn for **top-level frames** only `[DOC:360041539473 excerpt]`. Nested frames have no label, and wrapping a labelled frame in another frame removes its label `[SRC:https://forum.figma.com/suggest-a-feature-11/option-to-hide-frame-labels-10420]`. Frames directly inside sections keep their labels `[SRC:https://forum.figma.com/suggest-a-feature-11/option-to-hide-frame-labels-10420]` `[KNOW]`. Grouping a top-level frame (⌘G) removes its label, because the frame is no longer a direct child of the page `[SRC:forum 10420]`. Components and instances at the top level also show labels `[KNOW]`. There is no built-in setting that hides frame labels; the request has been open since 2021 `[SRC:forum 10420]`. One forum reply disputes the "top level only" rule, so it is listed in V-47.
- Label interactions `[KNOW]` (with partial `[SRC:forum anecdote]`):
  - **Click** selects the frame, replacing the selection. **Shift-click** toggles it into the selection.
  - **Drag** moves the frame, even when its content fully covers its area.
  - **Double-click** starts inline rename (Enter commits, Esc cancels).
  - **Hover** highlights the frame's outline.
- Labels have a constant on-screen size, are truncated to the frame's on-screen width, and are never exported. `[KNOW]`
- A click on an empty area of a **top-level frame that has children** does not select the frame; it starts a marquee. A click inside an **empty** top-level frame selects it. `[KNOW]` (V-06)
- Layers panel: top-level frames are shown in bold `[DOC:360041539473 excerpt]`. Frames, groups, sections, components and auto-layout frames each have a distinct type icon `[KNOW]`.

### 3.4 Clip content

- `clipsContent = true`: descendants render only inside the frame's shape, including corner radius and smoothing. Nested clipping frames intersect. `[API]` `[KNOW]`
- `clipsContent = false`: overflowing descendants render normally. `[API]`
- Clipping is purely visual. It never changes the geometry, bounds, constraints or selection bounds of children. Clipped-out parts of children cannot be clicked on the canvas. `[KNOW]` (V-08)
- The frame's **own** outer effects (drop shadow) are never clipped by its own clip `[KNOW]`. A drop shadow's `spread` is accepted on frames only when the frame has visible fills and `clipsContent` is enabled `[API]`.
- Clip content is a checkbox in the UI3 **Layout** section, available for freeform and auto-layout frames alike. `[OBS]`
- Groups and sections cannot clip. `[API]`
- Export of a non-clipping frame with overflowing children: whether the output includes the overflow is unverified (V-09).

### 3.5 Frame selection (wrap), Remove frame, Resize to fit

**Frame selection (⌥⌘G / Ctrl+Alt+G)** `[SRC:forum.figma.com/t/unframe-selection/46384]` `[KNOW]`:

```
frameSelection(sel):
  require sel non-empty and no node in sel is a SECTION or an instance sublayer
  parent = common parent (if all share one) else <unverified: V-10>
  bbox   = union of layout bounds of sel in parent space
  f = new FRAME(name="Frame N", x,y,w,h = bbox)   // fill/clip defaults: V-07
  insert f into parent at index of the topmost selected node
  move sel into f, preserving absolute transforms and relative z-order
  selection = [f]
```

- If the parent uses auto layout, the new frame takes the flow slot of the topmost selected item. `[KNOW]`
- With a single **group** selected, a 2024 forum request reports that ⌥⌘G turns it into a frame with a generic name ("Frame 40"), not the group's name `[SRC:https://forum.figma.com/suggest-a-feature-11/allow-the-name-to-be-preserved-when-a-group-is-made-into-a-frame-via-ctrl-alt-g-15688]`. Whether that is an in-place conversion or a wrap that leaves the group nested inside is unverified: V-11.

**Convert between frame, group and section** `[SRC:https://forum.figma.com/t/changing-a-section-into-a-group-or-frame/31994]` `[SRC:https://uxplanet.org/my-tips-from-our-figma-like-the-pros-talk-during-config-2023-af05ccf25831]` `[SRC:forum 15688]`

- The container-type dropdown above the Position fields lists **Frame**, **Group** and **Section**. Choosing another entry converts the selected container in place. Context-menu, Object-menu and quick-action commands do the same ("Convert to frame", "Convert to section").
- Conversion through the dropdown or the menu **keeps the layer name**, unlike ⌥⌘G.
- Group → frame: the frame takes the group's current bounds and keeps the children's absolute positions. Its default fill and clip are unverified (V-44).
- Frame → group: the frame's fills, strokes, clip, layout guides, auto layout and constraints are lost; the group's bounds snap to the children's union (V-44).
- Frame → section is only offered for a frame whose parent is a page or a section. A nested frame does not offer "Convert to section" `[SRC:https://forum.figma.com/report-a-problem-6/section-in-a-frame-36868]` (January 2025).
- Section → frame, and frame → section, keep the bounds. Which properties survive (fills, strokes, radius, dev status) is unverified (V-44).
- The Plugin API has no conversion call. A converted node gets a new node ID, according to a community answer `[SRC:https://forum.figma.com/t/not-able-to-convert-existing-group-into-frame-by-using-plugin-api/35735]`. Illigma may keep the ID, but the file must stay valid either way.

**Remove frame = Ungroup (⇧⌘G / Ctrl+Shift+G) on a frame** `[SRC:https://www.figma.com/best-practices/groups-versus-frames/]` `[API]` (`ungroup`):

- The children move into the frame's parent at the frame's z-index, keeping their order and absolute transforms. The frame is deleted along with its fills, strokes, effects, layout guides, clip, auto layout and prototype settings. The children's own constraints are kept as values. If the frame was selected, the selection becomes its children.
- Alternative shortcuts (⇧⌫ / ⌘⌫) are only reported by third-party or forum sources; see V-12.

**Resize to fit (⌥⇧⌘R / Ctrl+Alt+Shift+R `[SRC:https://app.uxcel.com/lessons/frames-in-figma-489]` `[SRC:https://forum.figma.com/ask-the-community-7/no-resize-to-fit-option-for-auto-layouts-40657]`; also a properties-panel action `[DOC:360041539473 excerpt]` and a context-menu entry `[SRC:skyeng.ru tutorial]`):**

```
resizeToFit(f):                     // f: FRAME/COMPONENT with layoutMode == NONE
  kids = f.children                 // hidden children included? -> V-13
  if kids empty: no-op
  b = union(layoutBounds(k) in f-local space for k in kids)   // not render bounds (strokes/effects) -> V-13
  for k in kids: k.localPosition -= (b.x, b.y)               // world positions unchanged
  f.position += rotate(f.rotation, (b.x, b.y))
  f.resizeWithoutConstraints(b.w, b.h)                       // constraints NOT applied
```

- With multiple frames selected, each frame fits its own children. `[KNOW]`
- It is not offered for groups, which are already fitted `[KNOW]`.
- **Auto-layout frames:** the menu item is hidden (use Hug), but a May 2025 report says the shortcut still acts on them `[SRC:forum 40657]` (V-14).
- **Sections:** Resize to fit **is** available. It leaves padding between the section edge and the union of its children; reports give 100 px and 80 px, and the padding is not configurable `[SRC:https://forum.figma.com/t/resize-to-fit-in-sections/32400]` (2022, V-14). Double-clicking a section's corner handle also fits the section to its contents in Figma Design (not in FigJam) `[SRC:https://forum.figma.com/t/double-click-corner-of-a-section-in-figjam-to-expand-and-center-objects/51531]` (V-48).
- **Component sets** accept the same shortcut `[SRC:forum, 2021 thread cited in the 2026-10-08 search]`.

```
resizeSectionToFit(s):               // [SRC] only; padding value V-14
  b = union(layoutBounds(k) in page space for k in s.children)
  s.bounds = inflate(b, P)            // P ≈ 100 (or 80) on every side
  // children keep their absolute positions; sections never propagate constraints
```

### 3.6 Groups

**Create (⌘G / Ctrl+G)** `[API]` (`group`: "roughly the equivalent of pressing Ctrl-G/⌘G") `[DOC:360039832054 excerpt]`

- Requires at least one node, and a single node may be grouped `[KNOW]`. Grouped nodes keep their absolute positions `[API]`. The group is inserted at the z-index of the topmost selected node within the parent `[KNOW]`, named "Group N" `[KNOW]`, and selected.
- Sections and instance sublayers cannot be grouped. `[DOC:9771500257687 excerpt]` `[API]`
- With a selection spanning several parents, Figma's behavior is unverified (V-10).

**Bounds (derived)** `[API]` `[SRC:https://www.figma.com/blog/groups-vs-frames/]`

```
groupBounds(g) = union over c in g.children of layoutBounds(c)   // in g's container-parent space
// recomputed after any child move/resize/add/remove/visibility change (visibility: V-15)
// a group with rotation keeps its rotation; its bounds are computed in its own rotated frame (V-16)
```

- Removing or deleting the last child deletes the group. Groups can never be empty. `[API]`
- Moving a group moves every descendant exactly once. `[KNOW]`

**Resize a group directly** (handles or W/H fields): every descendant is scaled by the group's box mapping, **regardless of the descendants' constraint settings**. `[KNOW]` `[SRC:https://forum.figma.com/t/how-can-i-fix-a-nested-element-size-when-resizing-its-parent-component/1166]`

```
resizeGroup(g, newBox):
  sx = newBox.w / g.w ; sy = newBox.h / g.h
  for d in g.children:                         // recurse through nested groups/booleans
     d.box = (newBox.x + (d.x - g.x)*sx, newBox.y + (d.y - g.y)*sy, d.w*sx, d.h*sy)
     if d is frame-like: its own children follow their constraints (V-17)
     if d is TEXT: box resized; font size unchanged (V-17)
     stroke widths / effects unchanged (unlike Scale tool K)
  g.bounds = groupBounds(g)
```

**Properties** `[API]`: opacity, blend mode, effects, mask, visibility, lock, export settings and prototype interactions. Opacity and effects apply to the group's composite `[KNOW]`. A mask inside a group masks only the siblings above it **within that group**, so groups scope masks `[API]` (`isMask` doc).

**Constraints and groups** `[DOC:360039957734 excerpt]` `[API]`:

- A group has no constraints of its own. Setting constraints while a group is selected writes them to **every child** (recursively through nested groups and booleans `[KNOW]`). If the children differ, the UI shows "Mixed" `[KNOW]`.
  - **How the sources fit together.** The plugin docs page for `GroupNode` says that in the UI, "you can change the constraints of a group … Under the hood, Figma applies the provided constraints to each child" `[SRC:https://developers.figma.com/docs/plugins/api/GroupNode excerpt]`. The 2026-09-27 constraints note summarizes the full article as "groups applying to members" `[OBS:constraints-note]`. A 2024 community-support reply and a help-center excerpt say "You can't apply constraints to groups" `[DOC:360039957734 excerpt, mirror]` `[SRC:https://forum.figma.com/ask-the-community-7/constraints-not-showing-in-the-right-panel-8037]`. A later excerpt of the same article gives both halves: a group cannot hold constraints, because it inherits its bounds from its layers, but if you apply constraints to a group, Figma applies them to the individual layers `[DOC:360039957734 excerpt, 2026-10-08 pass 3]`. Read together, the sources describe the write-through above. V-43 still has to confirm that the UI3 Position section offers the controls when a group is selected.
- Children of a group are constrained relative to the **nearest frame ancestor**, never to the group's bounds. When that frame resizes, each child applies its own constraints, and the group's bounds are then recomputed.
- A child's X/Y in the inspector are relative to the container parent, not to the group. `[API]`

**Ungroup (⇧⌘G / Ctrl+Shift+G)** `[API]` (`ungroup`):

- The children move into the group's parent at the group's index, keeping their order and absolute transforms, and the group is removed. If the group was selected, its children become selected.
- Whether the group's opacity, effects or blend mode are discarded or baked into the children is unverified (V-18).
- Several selected groups or frames are ungrouped in one action `[KNOW]`. Ungroup on a non-container leaf is a no-op `[KNOW]`. Nested groups lose one level per Ungroup `[KNOW]`.

**Selecting inside groups** (cross-area, selection spec) `[KNOW]`: a click on any descendant selects the outermost group within the current context. A double-click (or Enter) goes one level deeper. ⌘/Ctrl-click deep-selects the leaf.

### 3.7 Boolean groups as containers `[API]`

- Bounds derive from the children's geometry. `booleanOperation` determines the rendered shape; the operations themselves are cross-area M2.
- Like groups, booleans have no constraints of their own. Resizing the container frame applies the constraints of the boolean's children.
- A boolean has its own fills, strokes and effects, but no clip, layout guides or auto layout.

### 3.8 Sections

**Create** `[DOC:9771500257687 excerpt]`

- Section tool from the toolbar, or ⇧S. Then click-and-drag on the canvas.
- Context menu → **Wrap in new section** wraps the current selection `[DOC:9771500257687 excerpt]`. The command is also available as follows:
  - **⌘S / Ctrl+S** `[SRC:https://forum.figma.com/t/wrap-in-a-section-not-available-in-new-ui3/83232]`. Figma community support confirmed it still works in UI3 (2024).
  - The properties panel's "…" menu, and a "Wrap in new section" icon / container-type dropdown shown for multi-selections `[SRC:forum 83232]` `[SRC:forum, September 2026 staff reply]`.
  - Quick actions (⌘K / ⌘/) `[SRC:forum 83232]`.
  - A feature request asks for ⌘S to work on a **single** object, which implies it currently needs two or more selected layers `[SRC:https://forum.figma.com/suggest-a-feature-11/create-section-when-selecting-single-object-and-hitting-cmd-s-46600]`.
  - Whether the new section is padded around the selection: V-19.
- In UI2, clicking the Section tool with frames selected created a padded section around them. **UI3 removed this**: the tool always draws `[SRC:https://forum.figma.com/t/ui3-removed-auto-create-section-by-clicking-the-section-button-on-toolbar/90156]` (October 2024).
- The click-without-drag default size is unverified (V-19). The default fill is grey or white (sources conflict) and cannot be changed by the user (V-46).

**Nesting rules** `[DOC:9771500257687 excerpt]`

- A section can contain all layer types, including other sections.
- A section can only be a child of a page or of another section. It can never be inside a frame, group, boolean, component or instance. The last three follow from the frame/group rule plus `[KNOW]`.
- Operations that would place a section inside a frame or group are refused: dragging into a frame, Frame selection or Group on a selection containing a section, and pasting into a selected frame (V-20).

**Adoption and release** `[DOC:9771500257687 excerpt]`

- An object becomes a section child when you move the section over it, resize the section over it, or move the object into the section with the mouse or the arrow keys.
- Whether adoption requires full containment, and what happens when a section is resized so that a child ends up outside it, is unverified (V-21). Moving an object out of a section reparents it to the section's parent `[KNOW]`.

**Geometry**

- Moving a section moves all its descendants `[KNOW]`.
- Resizing a section **never** moves or resizes its children, because sections do not propagate constraints `[API]`. Minimum size is 0.01 `[API]`.
- Sections cannot be rotated and have no opacity, blend mode or effects `[API]`.

**Appearance (functional only)**

- Fill (background) and stroke (border) are edited in the Fill and Stroke sections `[DOC:9771500257687 excerpt]`. The typings also expose corner radius; whether the UI does is unverified (V-22).
- The section title is drawn on the canvas. **Double-clicking** the title (on the canvas or in the Layers panel) renames it, and Return/Enter commits `[DOC:9771500257687 excerpt]`. **Clicking** the title selects the section `[KNOW]`.
- Whether clicking an empty area of a section selects it or starts a marquee is unverified (V-23). Users report that clicking empty space inside a section **selects the section**, unlike clicking the empty canvas. Feature requests ask Figma to make sections selectable only by their title, which implies that title-only selection is not current behavior `[SRC:https://forum.figma.com/t/make-it-harder-to-select-and-move-sections/69436]` `[SRC:https://forum.figma.com/suggest-a-feature-11/make-it-harder-to-select-and-move-sections-14735]` (excerpts, 2022–2024). Until V-23 runs, Illigma follows the user reports.
- `sectionContentsHidden` (from FigJam's "Hide section" feature) is document data. Its UI exposure in Figma Design is unverified (V-24). Illigma must round-trip the flag.

**Dev status** `[DOC:9771500257687 excerpt]` `[DOC:26781702258583 excerpt]` `[API]`

- **Mark as ready for dev** sets `devStatus = {type:'READY_FOR_DEV'}`. It applies to sections, frames and components; for sections and frames the control sits next to the canvas label, and for components it sits above the upper-right corner `[DOC:26781702258583 excerpt]` ("Dev Mode statuses and notifications"). The status can be removed from the overflow menu on the status label, and Figma's two articles word that menu item differently ("Remove ready status" vs "Remove status"). `COMPLETED` is the other value; Figma offers it only on Organization/Enterprise plans `[DOC:26781702258583 excerpt]`.
- Marking does not lock the content `[DOC:26781702258583 excerpt]`.
- **Changed** is set automatically when marked content is edited, and users cannot set it by hand. The following do **not** trigger it `[DOC:26781702258583 excerpt]`:
  - instances updated from a shared library;
  - a value change of a variable or style that is already applied;
  - temporary states such as hover previews inside auto layout.
- To clear Changed, the designer clicks the status, may type a reason in the text box, and confirms with **Done with changes**. The status returns to Ready for dev, and the reason goes into version history and notifications `[DOC:26781702258583 excerpt]`. In the plugin data, the reason is `devStatus.description` `[API]`. "Changed" has no enum value in the typings, so it is derived state; V-45 decides how Illigma computes it.
- A status can only be set on a node directly under a page or section, and never inside a node that already has a status `[API]`. For nested sections, the **outer** section is the one that is marked `[SRC:https://forum.figma.com/t/unable-to-mark-ready-for-dev/54825]`.

**Prototyping** `[DOC:16194160540567 excerpt]`

- A prototype connection whose destination is a section navigates to the **last-visited frame** in that section. Cross-area M7.

**Other** `[API]`

- A section can be the file thumbnail.
- A section can carry export settings and explicit variable modes.

### 3.9 Constraints

**Applicability** `[DOC:360039957734 excerpt]` `[API]`

- Constraints take effect only when the node's **container parent** is a frame, component or instance (component sets: V-26) with `layoutMode: 'NONE'`.
- Exception: children with `layoutPositioning: 'ABSOLUTE'` inside an auto-layout frame, whose constraints are fully active (`[API]` example: `constraints = {horizontal:'MAX', vertical:'MIN'}` pins to the top-right).
- Constraints are **not** available for layers directly on a page `[DOC:360039957734 excerpt]` ("not possible to apply constraints to layers outside of a frame"), for flow children of auto layout, or for direct children of sections (they are not propagated `[API]`; the UI hiding them is V-27).
- Values are retained even while inactive: reparenting into a frame makes the stored value active again `[KNOW]`.

**Axis math** (in the container's local, unrotated space). P₀ and P₁ are the container's old and new size on the axis; `s` and `w` are the child's start and size on that axis. `[DOC:360039957734 excerpt]` gives the semantics; the exact formulae are a derived specification to be validated in V-25.

```
applyAxis(c, s, w, P0, P1):
  switch c:
    MIN:     return (s, w)                                  // keep distance to left/top
    MAX:     return (s + (P1 - P0), w)                      // keep distance to right/bottom
    CENTER:  return (s + (P1 - P0)/2, w)                    // keep offset of centers
    STRETCH: return (s, clampMin(w + (P1 - P0)))           // keep both distances; size changes
    SCALE:   k = P1/P0; return (s*k, w*k)                   // keep % position and % size
```

- **Scale example** `[DOC:360039957734 excerpt]`: a child occupying 70% of its frame's width, after the frame is resized to 200 wide, becomes 140 wide.
- Local coordinates make the formula independent of which handle is dragged. Dragging the left or top handle moves the container's origin; MIN children follow the moving edge, and MAX children stay fixed in world space.
- `clampMin` for STRETCH when the frame shrinks below the sum of both margins: unverified (V-25). Candidates are clamp to 0.01, clamp to 0, or allow a negative size that flips.
- **Rounding:** Figma geometry is fractional. Constraint results are believed to be **not** rounded `[KNOW]` (V-25).

**Propagation**

```
resizeWithConstraints(node, W1, H1):            // used by handles, W/H fields, presets, API resize()
  (W0, H0) = node.size; node.size = (W1, H1)
  if node.layoutMode != NONE: run auto layout; for each ABSOLUTE child apply constraints as below; return
  for t in constraintTargets(node):            // direct children; groups/booleans are transparent:
                                               // their descendants are targets (recursively)
     (x, w) = applyAxis(t.constraints.horizontal, t.x, t.w, W0, W1)
     (y, h) = applyAxis(t.constraints.vertical,   t.y, t.h, H0, H1)
     if t.targetAspectRatio: reconcile (w,h) to ratio   // [API] lock honored by constraints; which axis wins: V-28
     t.position = (x, y)
     if (w,h) != t.size: resizeWithConstraints(t, w, h)  // recursion into nested frames; text reflows
  recompute bounds of every group/boolean inside node, bottom-up
```

- The recursion is documented: `resize()` "applies constraints recursively" `[API]`.
- Hidden and locked descendants still respond `[KNOW]`.
- **Rotated children**: whether constraints act on the child's axis-aligned bounding box or on its own box is unverified (V-29).
- **Text children**:
  - Under STRETCH or SCALE, the text box changes and the text reflows; font size is unchanged.
  - Effect on the text auto-resize mode: V-30.
- **Lines** (height 0) under vertical STRETCH or SCALE: V-30.

**Ignoring constraints** `[DOC:360039957734 excerpt]`

- Holding **⌘ (macOS) / Ctrl (Windows)** while resizing the container on the canvas resizes it **without** applying the children's constraints. Children keep their world geometry; in local terms, positions are re-based if the origin moved.
- The modifier is read continuously during the gesture: pressing or releasing it mid-drag switches the preview between constrained and unconstrained, always computed from the gesture's start state `[KNOW]`.
- Numeric W/H edits, preset changes and orientation swaps always apply constraints `[KNOW]` `[DOC:360041539473 excerpt]`.
- Plugin equivalent: `resizeWithoutConstraints` `[API]`.

**Layout guides and constraints** `[DOC:360039957934 excerpt]`

- When a frame has **Stretch** column or row layout guides, a child's constraints are evaluated against the **nearest column or row** (the column's edges, center and span) instead of the frame's edges.
- With **fixed** guides (Left/Right/Center alignment), constraints are evaluated against the frame. "Stretch or fixed determines whether Figma prioritizes the grid or any constraints."
- The proposed algorithm below must be validated (V-32).

```
if container has a visible? (V-32) STRETCH COLUMNS guide G (which one if several: V-32):
  cols0 = tracks(G, W0); cols1 = tracks(G, W1)
  MIN:     i = column containing-or-nearest child.left;  keep child.left - cols0[i].start
  MAX:     j = column containing-or-nearest child.right; keep cols0[j].end - child.right
  STRETCH: anchor left to cols[i].start and right to cols[j].end
  CENTER:  keep offset from center of span cols[i..j]
  SCALE:   proportional within span cols[i..j]
(analogous for ROWS on the vertical axis)
```

**Constraint UI** `[OBS:constraints-note]` `[DOC:360039957734 excerpt]`

- The UI3 **Position** section shows Constraints when the selection's container parent qualifies. There are two dropdowns, horizontal (Left, Right, Left + Right, Center, Scale) and vertical, plus a pin diagram.
- In the pin diagram, **Shift-click** sets two constraints at once (e.g., Left and Right means STRETCH). A plain click selects a single edge, and clicking the inner center lines sets Center `[KNOW]`.
- With a mixed multi-selection, editing one axis sets that axis on all selected nodes and leaves the other axis untouched `[KNOW]`.

**Other interactions**

- Alignment commands applied to children may rewrite their constraints `[SRC:https://forum.figma.com/ask-the-community-7/keyboard-shortcuts-unwanted-change-constraints-23298]` (2023 report; V-33).
- Resizing an **instance** applies the constraints its sublayers inherit from the main component `[KNOW]`. Whether constraints of instance sublayers can be overridden: V-34.
- The **Scale tool (K)** ignores constraints and scales everything proportionally, including stroke weights, effects and font sizes `[SRC:https://www.figma.com/best-practices/groups-versus-frames/]` `[KNOW]`. Cross-area.

### 3.10 Layout guides

**Types** `[DOC:360040450513 excerpt]` `[API]`:

- **Uniform grid**: square cells; suits icons and precise work.
- **Columns** and **Rows**: responsive interfaces.

**Geometry** (derived from `[API]` field semantics and `[DOC:360039957934 excerpt]`: "width or height is automatically calculated based on dimensions of the frame, number of columns or rows, gutter, and margin")

```
tracks(G, L):                      // L = frame width (COLUMNS) or height (ROWS)
  g = G.gutterSize
  if G.alignment == STRETCH:
     n = G.count;  m = G.offset    // UI "Margin"
     s = (L - 2*m - (n-1)*g) / n   // may become <= 0 on small frames: rendering V-35
     start = m
  else:
     s = G.sectionSize
     n = (G.count == Infinity) ? autoCount(...) : G.count      // Auto: V-35
     total = n*s + (n-1)*g
     start = MIN:    G.offset
             MAX:    L - G.offset - total
             CENTER: (L - total)/2          // offset ignored
  return [(start + i*(s+g), s) for i in 0..n-1]   // COLUMNS from frame's left edge; ROWS from top

uniformGrid(G, W, H): vertical lines at x = k*G.sectionSize, horizontal lines at y = k*G.sectionSize,
                      k = 1.. while < W (resp. H), measured from the frame's top-left
```

**Display**

- Guides are drawn inside the frame's bounds, above the frame's content, and rotate and scale with the frame and zoom `[KNOW]`.
- Guides are not rendered in exports or prototypes `[KNOW]`.
- Stretch guides recompute live while the frame resizes `[DOC:360039957934 excerpt]`.
- The guides of nested frames are displayed at the same time as their ancestors' `[KNOW]`.

**Visibility**

- Each guide has its own visibility (`visible`, an eye icon) `[API]`.
- A global view setting, **Layout guides**, shows or hides all guides. It lives in the Zoom/view options menu at the top of the right sidebar, with shortcut **⇧G** per the help center `[DOC:360040450513 excerpt]`; third-party lists give ⌃G (mac) / Ctrl+Shift+4 (Windows) `[SRC]` (V-31).
- The global toggle is UI state only. It changes visibility "for all layout guides in a file" at once. Hiding guides does not remove them, and they keep working while hidden `[DOC:360040450513 excerpt]`. "Working" is read as "constraints still use them" (V-32).
- To hide a single guide, select its frame and use that guide's show/hide control in the Layout guide section `[DOC:360040450513 excerpt]`.

**Editing**

- The **Layout guide** section of the frame inspector `[OBS]` has **+** to add, a row per guide (type icon or settings, visibility, remove), and a settings popover.
- The popover offers:
  - Type: Uniform grid, Columns or Rows.
  - Count: number, dropdown, variable, or Auto `[DOC:360040450513 excerpt]`.
  - Alignment/type: Stretch, Left, Center or Right; for rows, Top, Center or Bottom `[SRC:trupeer tutorial]` `[API]`.
  - Width or height (fixed alignments).
  - Margin (stretch) or offset (left/right).
  - Gutter.
  - Color and opacity `[SRC:uxcel]`.
- Multiple guides per frame are allowed and kept in list order `[API]` `[SRC:uxcel]`.
- Clicking **+** adds a **Uniform grid** `[DOC:360040450513 excerpt]` and, since April 2025, opens its settings flyout automatically `[SRC:forum 39496]`.
- Where a newly added guide goes in the list, and the default values when the type is switched to Columns or Rows, are unverified (V-36).

**Styles** `[API]` `[DOC:360038746534 title]`

- A frame's guide list can be saved as a **layout guide style** (`GridStyle`) and applied to other frames (`gridStyleId`).
- Editing the style updates every frame linked to it. Detaching copies the values locally.
- Local styles only; libraries are cross-area M6.

**Variables** `[API]` `[DOC:360040450513 excerpt]`

- Count, gutter, offset/margin and size can be bound to number variables.
- Changing the variable's value or mode recomputes the guides.

**Applicability** `[API]`

- Frames, components, component sets and instances (`BaseFrameMixin`) can carry guides, including auto-layout frames.
- Groups, booleans and sections cannot.

**Snapping**

- Moving or resizing objects inside a frame snaps to column and row edges `[KNOW]` (V-37).

### 3.11 Cross-cutting behavior

**Undo/redo** (Illigma requirement mirroring Figma `[KNOW]`)

- Each of the following is exactly **one** undo step: frame creation (including any adopted layers); Frame selection; Group; Ungroup or remove frame; Resize to fit; a resize gesture together with all the constraint-driven descendant changes it caused; a preset change; Wrap in new section; one section adoption caused by a move; and one layout-guide field edit.
- Redo restores identical node IDs, z-order and parents.

**Copy/paste and duplicate** `[KNOW]`

- Copying a frame copies its subtree with all properties from §2.
- Duplicating (⌘D) a top-level frame places the copy beside the original. A 2021 report gives 40 px to the right, and a 2023 report says the copy goes after the **last** frame of a row, not next to the original `[SRC:https://forum.figma.com/t/set-default-frame-spacing/2306]` `[SRC:https://forum.figma.com/ask-the-community-7/how-can-i-manage-the-ordering-of-my-toplevel-frames-21673]`. A nested layer is duplicated in place `[SRC:FrontendMasters course excerpt]`. The exact rule is V-38.
- Pasting while a frame is selected places the clipboard inside that frame (clipboard rules are cross-area). A section is never pasted into a frame (V-20).
- Copy/paste of properties (⌥⌘C/⌥⌘V) may include layout guides `[DOC:4412765442967 title]` (V-39).

**Export** (cross-area M2)

- Labels, selection overlays, section titles (V-40) and layout guides are never in exported output `[KNOW]`.
- Frames, groups and sections accept export settings `[API]`.

**Components and instances**

- Components and instances are frame-like. Clip content, layout guides and children's constraints work identically inside them `[API]`.
- Whether clip content and layout guides can be overridden on instances is V-34.
- Groups can be turned into components; the component replaces the group as a frame-like container `[KNOW]` (cross-area M5).

**Auto layout** (cross-area M4)

- An auto-layout frame keeps Clip content and layout guides `[OBS]` `[API]`.
- Its flow children ignore constraints, while `ABSOLUTE` children use them `[API]`.
- A group inside auto layout is a single flow item `[KNOW]`.
- Removing auto layout does not restore the children's previous positions `[API]`.

**Variables** (cross-area M6)

- Width and height variables on a frame resize it with constraint propagation (V-41).
- Layout guide field bindings: see 3.10.

---

## 4. Inspector & on-canvas controls (functional only)

### 4.1 Frame tool active, nothing selected

- The right sidebar shows the **preset list** grouped by category. Clicking an entry creates a frame `[DOC:360041539473 excerpt]` `[KNOW]`.

### 4.2 Frame selected (UI3 Design panel)

Observed section order: **Position, Layout, Appearance, Fill, Stroke, Effects, Layout guide, Export** `[OBS]`.

| Control | Function |
| --- | --- |
| Frame-type / preset dropdown (panel header) | Shows "Frame", or the component and instance equivalents. Lists presets; choosing one resizes with constraints `[DOC:360041539473 excerpt]` `[KNOW]`. It also lists the container types **Frame / Group / Section**; choosing another converts in place (3.5) `[SRC:forum 31994]` `[SRC:uxplanet Config 2023 tips]` |
| Position: alignment buttons, X, Y, rotation | X/Y are relative to the container parent `[API]` `[OBS]` |
| Position: Constraints (pin diagram + 2 dropdowns) | Shown when the frame itself is a child of a qualifying container `[OBS:constraints-note]` |
| Layout: Freeform / auto-layout flow selector | Freeform = `layoutMode: 'NONE'` `[OBS]` |
| Layout: W, H | Resizes with constraint propagation `[KNOW]` |
| Layout: Resize to fit | Fits bounds to children (exact UI3 placement: V-14) `[DOC:360041539473 excerpt]` |
| Layout: Clip content checkbox | Toggles `clipsContent` `[OBS]` |
| Appearance | Opacity, corner radius (incl. independent corners), blend mode, visibility `[OBS]` (section seen) `[KNOW]` (contents) |
| Fill / Stroke / Effects | Cross-area M2 |
| Layout guide | +, rows, visibility, remove, settings popover, style picker `[OBS]` (section seen) `[KNOW]` (contents) |
| Export | Cross-area M2 `[OBS]` |

### 4.3 Group selected

- Position (X, Y, rotation, plus constraints that write to the children), W/H (scales the children), Appearance (opacity, blend mode), Effects and Export `[KNOW]` `[API]`.
- There are no Fill, Stroke, Clip or Layout guide sections for the group itself. UI3 may show a "Selection colors" section aggregating the children's paints (cross-area) `[KNOW]`.

### 4.4 Section selected

- X, Y, W, H, Fill (background), Stroke (border), Export, and the **Mark as ready for dev** action `[DOC:9771500257687 excerpt]` `[API]`.
- There is no rotation, opacity, effects, constraints, clip or layout guide control `[API]`.

### 4.5 Child of a freeform frame selected

- The Constraints controls appear in Position: Left, Right, Left + Right, Center, Scale; Top, Bottom, Top + Bottom, Center, Scale. The default is Left/Top `[OBS:constraints-note]`.
- For children of auto-layout frames, the constraints are hidden unless the child is absolute-positioned `[DOC:360039957734 excerpt]` `[API]`.

### 4.6 Context menu entries in this area `[KNOW]` unless tagged

- Frame selection, Group selection, Ungroup.
- Wrap in new section `[DOC:9771500257687 excerpt]`.
- Convert to frame, Convert to section `[SRC:forum 31994]` `[SRC:forum 36868]`.
- Resize to fit `[SRC:skyeng.ru tutorial]` (V-14).
- "Toggle clip content", which is reachable from Quick actions (⌘/ or ⌘K) and works on all selected frames `[SRC:forum community-support reply, March 2024, search excerpt]`.
- Show/Hide, Lock/Unlock (cross-area).
- Mark as ready for dev, for sections and top-level frames `[DOC:9771500257687 excerpt]`.

### 4.7 On-canvas elements

| Element | Function |
| --- | --- |
| Frame name label (top-level frames and frames in sections) | Click selects, drag moves, double-click renames, hover highlights (3.3) |
| Section title | Click selects (`[KNOW]`), double-click renames `[DOC:9771500257687 excerpt]`, drag moves `[KNOW]` |
| Dev status badge on section/frame | Shows the status; its overflow menu removes or acknowledges it `[DOC:9771500257687 excerpt]` |
| Resize handles (frame/group/section) | Frame: constraint propagation, ⌘/Ctrl ignores constraints. Group: proportional scaling of children. Section: children unaffected |
| Layout guide overlay | Display only, plus snapping targets |
| Constraint indicators while the child or parent is selected | Existence and behavior unverified (V-42) |

### 4.8 Layers panel

- Rows for frames, groups and sections, each with its type icon. Top-level frames are bold `[DOC:360041539473 excerpt]`.
- Disclosure triangles follow `expanded` `[API]`. Double-clicking a row renames it `[DOC:9771500257687 excerpt]` (sections).
- Dragging a row into or out of a container reparents it, with the same section and frame nesting restrictions as on the canvas `[KNOW]`.
- A frame with fixed children shows fixed and scrolling groupings `[API]` (`numberOfFixedChildren`; cross-area M7).

---

## 5. Keyboard shortcuts (macOS / Windows)

| Action | macOS | Windows | Evidence |
| --- | --- | --- | --- |
| Frame tool | `F` (alias `A`) | `F` (alias `A`) | `[KNOW]` |
| Section tool | `⇧S` | `Shift+S` | `[DOC:9771500257687 excerpt]` |
| Draw square frame / section | hold `⇧` while dragging | hold `Shift` | `[KNOW]` |
| Draw from center | hold `⌥` | hold `Alt` | `[KNOW]` |
| Reposition while drawing | hold `Space` | hold `Space` | `[KNOW]` |
| Group selection | `⌘G` | `Ctrl+G` | `[API]` |
| Ungroup / remove frame | `⇧⌘G` | `Ctrl+Shift+G` | `[API]` `[SRC:https://www.figma.com/best-practices/groups-versus-frames/]` |
| Alternative remove-frame keys | `⇧⌫` or `⌘⌫` (reported) | `Shift+Backspace`, `Ctrl+Backspace` or `Ctrl+Shift+Backspace` (reported) | `[SRC]` only (V-12) |
| Frame selection | `⌥⌘G` | `Ctrl+Alt+G` | `[SRC:forum.figma.com/t/unframe-selection/46384]` `[SRC:forum frame-selection-shortuct-ctrl-alt-g-not-working-54782]` |
| Wrap in new section | `⌘S` (2+ layers selected) | `Ctrl+S` | `[SRC:forum 83232]` (community-support reply, 2024) (V-19). Earlier drafts guessed `⌥⌘S`, which is wrong |
| Resize to fit | `⌥⇧⌘R` | `Ctrl+Alt+Shift+R` | `[SRC:uxcel]` `[SRC:forum 40657]` (V-14) |
| Suppress automatic nesting while dragging | hold `Space` from pointer-down | hold `Space` from pointer-down | `[SRC:forum 799]` (V-05) |
| Fit section to contents | double-click a section corner handle | same | `[SRC:forum 51531]` (V-48) |
| Ignore constraints while resizing | hold `⌘` | hold `Ctrl` | `[DOC:360039957734 excerpt]` |
| Show/hide layout guides | `⇧G` per help center. Third-party sources: `⌃G` | `Shift+G` per help center. Third-party sources: `Ctrl+Shift+4` | `[DOC:360040450513 excerpt]` `[SRC]` (V-31) |
| Rename selected layer | `⌘R` | `Ctrl+R` | `[KNOW]` (cross-area) |
| Scale tool (contrast with Scale constraint) | `K` | `K` | `[SRC:https://www.figma.com/best-practices/groups-versus-frames/]` |
| Select children / parent | `Enter` / `⇧Enter` (also `\`) | same | `[KNOW]` (cross-area) |
| Quick actions (fallback to run "Frame selection") | `⌘/` or `⌘K` | `Ctrl+/` or `Ctrl+K` | `[SRC:forum 54782]` `[KNOW]` |

Note: on Windows, Chrome's Gemini shortcut can capture `Ctrl+Alt+G` in the browser `[SRC:forum 54782]`. This is irrelevant to a desktop app, but it shows the binding is in use.


---

## 6. Parity checklist

Every item has status **Not started**. Format: `ID name — expected Figma behavior. Data. Test. Milestone·Priority·evidence`. An item tagged `→V-nn` stays unvalidated until experiment V-nn (§8) has run and the item text matches what it recorded. "Fixture" means a disposable test file (see §8). An "Illigma rule" is a requirement this spec adds where Figma's own behavior is out of scope or unobservable.

### 6.1 Data model & persistence

- [ ] **FR-001** Container capability matrix — each container type exposes exactly the capabilities in §2.1. FRAME, COMPONENT and INSTANCE have fills, strokes, corner radius, clip, layout guides, constraints, `layoutMode` and dev status. GROUP has none of fills, strokes, radius, clip, layout guides, own constraints or `layoutMode`. BOOLEAN_OPERATION has fills, strokes, effects and `cornerRadius`, but no clip, layout guides or auto layout. SECTION has fills, strokes and corner radii, but no rotation, opacity, blend mode, effects, constraints, clip, layout guides or reactions. _Data:_ §2.1 matrix _Test:_ Select a frame, a group, a boolean and a section in turn. In Figma, record which inspector sections and controls appear, and which property writes the Plugin API accepts. Illigma's inspector and model must allow exactly the same set. _M0·P0·[API]_
- [ ] **FR-002** Constraint-carrying node types — `constraints` exists on FRAME, COMPONENT, COMPONENT_SET, INSTANCE, SLOT, RECTANGLE, LINE, ELLIPSE, POLYGON, STAR, VECTOR, TEXT and TEXT_PATH. It is absent on GROUP, BOOLEAN_OPERATION, SECTION and SLICE. _Data:_ `ConstraintMixin` _Test:_ Read `constraints` on each node type with the Plugin API: it is defined only for the listed types. The Illigma schema matches. _M0·P0·[API]_
- [ ] **FR-003** New-frame property defaults — a frame made with F + click has `layoutMode:'NONE'`, `layoutGrids:[]`, `gridStyleId:''`, `guides:[]`, `constraints:{MIN,MIN}`, rotation 0, `cornerRadius` 0, no strokes, `targetAspectRatio:null`, `devStatus:null` and one white SOLID fill. _Data:_ §2.2 _Test:_ F + click in Figma, then dump the node's properties in the plugin console. Do the same in Illigma: every listed field is equal. _M0·P0·[API][DOC:360039957734 excerpt][KNOW]→V-03_
- [ ] **FR-004** Minimum size — the width and height of frames and sections are ≥ 0.01. An inspector entry of 0 or a negative number is clamped or rejected exactly as Figma does. _Data:_ `width`, `height` _Test:_ Type W = 0, then −5, then 0.001 for a frame. Record the stored value each time and match it. _M1·P1·[API]→V-03_
- [ ] **FR-005** Unit-axis transform — a frame's size lives only in `width` and `height`. `relativeTransform` has unit axes (no scale) and rotation is normalized to (−180, 180]. _Data:_ `relativeTransform`, `rotation` _Test:_ Rotate a frame to 270°: the inspector shows −90°. Read the matrix: the column norms are 1 (±1e-6). _M0·P0·[API]_
- [ ] **FR-006** Groups are never empty — the model cannot hold a GROUP with zero children. Any operation that would leave one deletes the group in the same transaction. Importing an empty group drops it (Illigma rule). _Data:_ `GroupNode.children` _Test:_ Delete the only child of a group: the group disappears, and one Undo restores both. Import a JSON fixture with an empty group: the importer drops it and logs it. _M0·P0·[API]_
- [ ] **FR-007** Section schema — SECTION stores `sectionContentsHidden` (default false), `devStatus`, fills, strokes and corner radii, and has no rotation field. `resize` behaves like `resizeWithoutConstraints`. _Data:_ `SectionNode` _Test:_ Create a section. The flag reads false, and setting rotation is impossible (no control; the API refuses it). Round-trip all fields. _M0·P0·[API]_
- [ ] **FR-008** Constraint enum mapping — the importer maps REST `LEFT/RIGHT/LEFT_RIGHT/CENTER/SCALE` and `TOP/BOTTOM/TOP_BOTTOM/CENTER/SCALE` to `MIN/MAX/STRETCH/CENTER/SCALE` and back, per §2.5. _Data:_ `ConstraintType`, REST `LayoutConstraint` _Test:_ Import a REST JSON fixture with all 25 horizontal × vertical combinations and export it again: the values are identical. _M8·P0·[API]_
- [ ] **FR-009** LayoutGrid union schema — ROWS/COLUMNS guides store `alignment`, `gutterSize`, `count`, an optional `sectionSize`, an optional `offset`, `visible` (default true), `color` and `boundVariables`. GRID guides store `sectionSize`, `visible`, `color` and a `sectionSize` binding only. `count = Infinity` is stored losslessly. _Data:_ `RowsColsLayoutGrid`, `GridLayoutGrid` _Test:_ Create one guide of each pattern, including an Auto-count column guide, then save and reopen. A deep-equal compare against a Plugin API dump from the same Figma fixture passes. _M0·P0·[API]_
- [ ] **FR-010** REST flat layout-grid import — a REST `LayoutGrid` always carries all eight fields. For GRID, `alignment`, `gutterSize`, `offset` and `count` are ignored. The `numSections` binding maps to `count`. _Data:_ REST `LayoutGrid` _Test:_ Import REST JSON containing a GRID with junk alignment and gutter values, plus a COLUMNS guide whose `numSections` is bound. Geometry ignores the junk, and the binding shows on Count. _M8·P1·[API]_
- [ ] **FR-011** Ignored layout-grid fields preserved — a `sectionSize` stored on a STRETCH guide and an `offset` stored on a CENTER guide are kept through save and reopen, and never affect geometry. Switching the alignment back uses the stored value. _Data:_ `sectionSize`, `offset` _Test:_ Set Left with width 80, switch to Stretch, then back to Left. Record whether Figma restores 80, and match. _M4·P2·[API][KNOW]→V-36_
- [ ] **FR-012** Layout guide style schema — `GridStyle {type:'GRID', layoutGrids[], boundVariables.layoutGrids[]}`. A frame links to it through `gridStyleId`. _Data:_ `GridStyle`, `gridStyleId` _Test:_ Create a style from a frame's guides. The frame's `gridStyleId` equals the style's id, and the style's `layoutGrids` deep-equals the frame's. _M6·P1·[API]_
- [ ] **FR-013** REST groups carry frame traits — the importer accepts `fills`, `clipsContent`, `layoutGrids` and similar keys on REST GROUP nodes (typed `FrameTraits`). It ignores the ones a group cannot have and never turns the group into a frame. _Data:_ REST `GroupNode` _Test:_ Import a REST GROUP with `clipsContent:true` and a fill: the result is a GROUP with no clip and no fill, and a warning is logged. _M8·P1·[API]_
- [ ] **FR-014** REST dev status NONE — REST `devStatus.type:'NONE'` maps to `devStatus:null`. _Data:_ REST `DevStatusTrait` _Test:_ Import a fixture with NONE: the node has no status badge, and re-export emits no status or NONE. _M8·P2·[API]_
- [ ] **FR-015** Round-trip of every document property — every Doc property in §2 survives save → open, undo → redo, copy → paste and duplicate unchanged, including `count = Infinity`, absent optional fields and variable aliases. _Data:_ §2 _Test:_ Use a golden fixture that covers every property in §2. Run each round trip and deep-compare the serialized nodes (ids excepted for paste and duplicate). _M0·P0·[API]_
- [ ] **FR-016** Invalid values on import — unknown enum values (e.g. `pattern:'FOO'`, `horizontal:'LEFTISH'`) or negative sizes are rejected, or repaired by a documented deterministic rule, and never coerced silently. _Data:_ all enums in §2 _Test:_ Import a corrupted fixture: each invalid field produces a log entry and the documented repair. Rendering is stable across two imports. _M8·P1·[API]_ (Illigma rule)
- [ ] **FR-017** Transient state stays out of the document — the global layout-guide toggle, label hover, preset-panel scroll, the ⌘/Ctrl ignore-constraints state and constraint overlays are not undo steps and are not written into the document. The exception is whatever V-31 shows Figma persisting per file. _Data:_ §2.10 _Test:_ Toggle ⇧G, then press Undo: the toggle is unchanged. Save and diff the file before and after toggling: no document change unless V-31 says otherwise. _M0·P0·[DOC:360040450513 excerpt][KNOW]→V-31_
- [ ] **FR-018** Layers-panel expansion persisted — `expanded` is saved with the document, but expanding or collapsing is not an undo step. _Data:_ `expanded` _Test:_ Expand a frame row, save and reopen: it is still expanded. Collapse it and press Undo: it stays collapsed. Record Figma's behavior for both steps and match. _M1·P2·[API][KNOW]→V-57_

### 6.2 Frame tool & creation

- [ ] **FR-019** Frame tool activation — F, and its alias A, activate the Frame tool. The UI3 bottom toolbar groups Frame, Section and Slice in one flyout. _Data:_ — _Test:_ Press F, then A: the Frame tool is active both times. Open the flyout: it lists Frame, Section and Slice. _M1·P0·[KNOW][OBS]→V-03_
- [ ] **FR-020** Click creates a 100 × 100 frame — a click without drag creates a 100 × 100 frame with a white fill. Its top-left corner sits at the click point, it is selected, and the tool returns to Move. _Data:_ `x`, `y`, `width`, `height`, `fills` _Test:_ At 100% zoom, click at canvas point (200, 300): the frame is at X 200, Y 300 and 100 × 100, it is selected, and Move is the active tool. _M1·P0·[API][KNOW]→V-03_
- [ ] **FR-021** Drag creates a frame — dragging creates a frame that spans the drag rectangle. A drag in any direction gives positive width and height. _Data:_ `x`, `y`, `width`, `height` _Test:_ Drag from (300, 300) to (100, 150): the frame is at X 100, Y 150, 200 × 150. _M1·P0·[KNOW]→V-03_
- [ ] **FR-022** Shift draws a square — holding Shift while dragging constrains the frame to a square, using the larger of the two drag extents. _Data:_ — _Test:_ Shift-drag a 200 × 120 rectangle: the result is 200 × 200. Record which extent wins and in which direction the square grows. _M1·P1·[KNOW]→V-03_
- [ ] **FR-023** Alt/Option draws from the center — holding ⌥/Alt makes the drag start point the center of the frame. Combined with Shift, it draws a centered square. _Data:_ — _Test:_ ⌥-drag from (500, 500) by (+50, +30): the frame spans 450..550 × 470..530. _M1·P1·[KNOW]→V-03_
- [ ] **FR-024** Space repositions while drawing — holding Space during a draw drag moves the in-progress rectangle without resizing it. Releasing Space resumes resizing. _Data:_ — _Test:_ Drag to 100 × 100, hold Space and move by (+40, 0), release Space and continue: the final frame is offset by 40 and has the size of the continued drag. _M1·P2·[KNOW]→V-03_
- [ ] **FR-025** Snapping while drawing — drawn frame edges snap to smart guides and to the pixel grid. Frames always snap to the pixel grid, even with Snap to pixel grid turned off. _Data:_ `x`, `y`, `width`, `height` _Test:_ Turn off Snap to pixel grid, zoom to 800% and draw a frame from a sub-pixel position: X, Y, W and H are integers. Draw near an existing frame edge: it snaps. _M1·P0·[DOC:360041065034 excerpt][KNOW]→V-03_
- [ ] **FR-026** Target parent of a new frame — a new frame becomes a child of the innermost eligible container under the drag start point: a frame or component (never inside an instance), a section, or the page. _Data:_ `parent` _Test:_ Start a drag inside a nested frame B (inside frame A): the new frame's parent is B. Start one inside an instance: the parent is the instance's container parent, not the instance. Start one in a section: the parent is the section. _M1·P0·[KNOW]→V-04_
- [ ] **FR-027** Drawing inside auto layout — a frame drawn inside an auto-layout frame is inserted into its flow at the index nearest the drop point. It is not placed at the drawn coordinates. _Data:_ `parent`, child index _Test:_ Draw between the 1st and 2nd children of a horizontal auto-layout frame: the new frame becomes child index 1. Record the size Figma keeps. _M4·P1·[KNOW]→V-04_
- [ ] **FR-028** Auto-adoption of enclosed layers — drawing a frame that fully encloses existing siblings moves them into the new frame and keeps their absolute positions. Partially enclosed layers stay where they are. _Data:_ `parent`, `absoluteTransform` _Test:_ Two rects; draw a frame that fully covers rect 1 and half of rect 2. Rect 1 becomes a child at an unchanged absolute position; rect 2 keeps its parent. _M1·P0·[KNOW]→V-04_
- [ ] **FR-029** Adoption scope — adoption considers only siblings in the target parent. Locked and hidden layers follow Figma's rule (record it). Adopted layers keep their relative z-order. _Data:_ `parent`, `locked`, `visible` _Test:_ Repeat the previous test with a locked rect and a hidden rect inside the drawn area. Record whether each is adopted and in what order. _M1·P1·[KNOW]→V-04_
- [ ] **FR-030** Z-order of a new frame — the new frame is inserted above every existing sibling in its parent. _Data:_ child index _Test:_ On a page with 3 layers, draw a frame: it is the topmost row in the Layers panel. _M1·P0·[KNOW]→V-04_
- [ ] **FR-031** Default naming — drawn frames are named "Frame N" and N follows Figma's numbering rule (record whether it is per page, the highest N + 1, or a file counter). _Data:_ `name` _Test:_ Draw 3 frames, delete "Frame 2", and draw another. Record the new name and match it. _M1·P1·[KNOW]→V-03_
- [ ] **FR-032** Preset panel categories — with the Frame tool active and nothing selected, the right sidebar lists presets in nine categories: Phone, Tablet, Desktop, Presentation, Watch, Paper, Social media, Figma Community and Archive. _Data:_ static catalog _Test:_ Press F with an empty selection: the category headers appear in this order. _M1·P1·[DOC:360041539473 excerpt][SRC:https://forum.figma.com/suggest-a-feature-11/ability-to-pin-or-customize-default-frame-presets-50212]→V-01_
- [ ] **FR-033** Preset catalog content — every preset entry (name, width, height) matches Figma's current catalog exactly. Older devices are in Archive. _Data:_ built-in catalog _Test:_ Transcribe Figma's full list (V-01) into a fixture and diff it against Illigma's catalog: zero differences. _M1·P1·[SRC:forum, January 2026 request]→V-01_
- [ ] **FR-034** Preset click creates a frame — clicking a preset creates a frame of exactly that size, named after the preset, placed per Figma's rule (beside existing content or at the viewport center), and selected. _Data:_ `name`, `width`, `height`, `x`, `y` _Test:_ Click a Phone preset on an empty page, then again on a page with content. Record name, size and position, and match. _M1·P0·[KNOW]→V-02_
- [ ] **FR-035** Presets are fixed — users cannot add, pin, reorder or delete presets. _Data:_ — _Test:_ No UI exists for customizing the preset list. _M1·P2·[SRC:https://forum.figma.com/suggest-a-feature-11/ability-to-pin-or-customize-default-frame-presets-50212]_
- [ ] **FR-036** Preset selects the prototype device — creating a frame from a device preset sets the prototype's device to the matching device if Figma does so. _Data:_ prototype device setting (M7) _Test:_ Create a frame from a phone preset and open the Prototype tab: record the device and match it. _M7·P2·[DOC:21158597546391 excerpt]→V-02_
- [ ] **FR-037** Changing the preset of an existing frame — choosing a preset from the selected frame's dropdown sets W and H to the preset and applies the children's constraints. Left/Top children keep their position and size. _Data:_ `width`, `height`, children `constraints` _Test:_ A 375 × 812 frame with a Right/Bottom child 20 px from the corner: choose a larger preset. The child stays 20 px from the bottom-right; a Left/Top child does not move. _M4·P0·[DOC:360041539473 excerpt]_
- [ ] **FR-038** Orientation swap — if UI3 offers a portrait/landscape control, it swaps W and H and applies constraints. If it does not, Illigma does not add one. _Data:_ `width`, `height` _Test:_ Check whether the control exists. If it does, swap a 375 × 812 frame: it becomes 812 × 375 and a Right child stays pinned. _M4·P2·[KNOW]→V-50_
- [ ] **FR-039** No preset identity stored — a frame made from a preset has no preset field. Renaming or resizing it does not relate it back to the preset. _Data:_ absence of a field _Test:_ Create from a preset and diff its serialized properties against an F-drawn frame of the same size: only the name differs. _M0·P1·[API]_
- [ ] **FR-040** Frame quick-add (+) — with the Frame tool active, hovering a top-level frame shows a **+** beside it. Clicking it creates a copy of that frame next to it and nudges neighboring frames over to make room. _Data:_ `x` of the copy and its neighbors _Test:_ Three frames in a row, 100 px apart: hover the first frame's + and click. Record the copy's position, the frames' new X values, the gap and the name. _M1·P2·[DOC:360041539473 excerpt]→V-49_

### 6.3 Frame structure, nesting & reparenting

- [ ] **FR-041** Frames inside sections count as top level — a frame whose parent is a section behaves like a page-level frame: it shows a name label, can carry a dev status, is bold in the Layers panel and acts as a prototype screen. Record any of these that do not hold. _Data:_ `parent.type === 'SECTION'` _Test:_ Put a frame in a section. Check the label, the Ready-for-dev action, bolding and whether it appears as a prototype starting-point candidate. _M1·P0·[SRC:https://forum.figma.com/suggest-a-feature-11/option-to-hide-frame-labels-10420][API][KNOW]→V-47_
- [ ] **FR-042** What a frame may contain — frames contain any layer type except sections and pages, and nest to any depth. _Data:_ `children` _Test:_ Nest 10 frames: all are valid. Try to drag a section into a frame: it is refused (see the section items). _M1·P0·[DOC:9771500257687 excerpt][SRC:https://www.figma.com/best-practices/groups-versus-frames/]_
- [ ] **FR-043** Frame bounds are independent of content — children may extend beyond the frame. Resizing a frame never adds or removes children, even when a child ends up fully outside it. _Data:_ `width`, `height`, `children` _Test:_ Shrink a frame until a child lies entirely outside it: the child keeps the same parent. _M1·P0·[DOC:360041539473 excerpt][KNOW]_
- [ ] **FR-044** Drag a layer into a frame — dropping a moved layer inside a different frame makes it a child of the deepest eligible frame at the drop location. Its absolute position and rotation are preserved, and it goes to the top of the new parent's z-order. _Data:_ `parent`, `absoluteTransform`, child index _Test:_ Drag a page-level rect into the middle of frame B (nested in A): the parent is B, the absolute position is unchanged, and it is the topmost child. _M1·P0·[KNOW][SRC:https://forum.figma.com/t/disable-auto-nesting-auto-reparenting-while-moving-objects/799]→V-05_
- [ ] **FR-045** Drag a layer out of a frame — dropping a child entirely outside its frame reparents it to the next container that contains the drop: a section or the page. _Data:_ `parent` _Test:_ Drag a child out of a top-level frame onto empty canvas: its parent is the page. Drop it on a section instead: its parent is the section. _M1·P0·[KNOW]→V-05_
- [ ] **FR-046** Reparenting decision point — whether the target container is chosen by the pointer position or by the moved layer's bounds follows Figma's rule, including partial overlap. _Data:_ — _Test:_ Drag a 200-wide rect so that the pointer is inside frame B while 80% of the rect is outside it. Record the parent. Repeat with the pointer outside and the rect mostly inside. _M1·P0·[KNOW]→V-05_
- [ ] **FR-047** Space suppresses reparenting — holding Space from pointer-down (before the drag starts) moves the layer without changing its parent for the whole gesture. There is no preference that disables auto-nesting. _Data:_ `parent` _Test:_ Hold Space, press on a page-level rect and drag it into a frame: the parent stays the page. Press Space only mid-drag: record whether reparenting happens. _M1·P1·[SRC:https://forum.figma.com/t/disable-auto-nesting-auto-reparenting-while-moving-objects/799]→V-05_
- [ ] **FR-048** Locked frames do not adopt — a layer dropped over a locked frame is not reparented into it. _Data:_ `locked` _Test:_ Lock frame B and drag a rect over it: the rect's parent is unchanged (or becomes B's parent if it left its own frame). _M1·P1·[SRC:https://forum.figma.com/t/disable-auto-nesting-auto-reparenting-while-moving-objects/799]→V-05_
- [ ] **FR-049** Instances are closed — instance sublayers cannot be reparented out of the instance, and no layer can be dropped into an instance. _Data:_ `InstanceNode.children` _Test:_ Drag a sublayer of an instance: it moves only as an override, or not at all, and its parent never changes. Drag a rect over an instance: the parent is not the instance. _M5·P0·[API]_
- [ ] **FR-050** Cycle prevention — a container can never be moved into itself or into one of its descendants, by canvas drag, Layers-panel drag, paste or the API. _Data:_ `parent` _Test:_ Drag frame A's row in the Layers panel onto its own child B: refused. Cut A, select B, paste: A is not placed inside B. _M1·P0·[KNOW]→V-57_
- [ ] **FR-051** Rotated frames — a frame can be rotated. Its children rotate with it, and their X/Y and constraints are evaluated in the frame's local, unrotated space. _Data:_ `rotation`, `relativeTransform` _Test:_ Rotate a frame with a child at local (10, 10) by 30°: the child's displayed X/Y stays (10, 10) and its absolute transform includes the 30°. _M1·P0·[API][KNOW]→V-29_
- [ ] **FR-052** Container-parent coordinates — a node's X/Y is relative to its nearest page, frame, component or instance ancestor, skipping groups and booleans. _Data:_ `relativeTransform`, `x`, `y` _Test:_ Frame at (100, 100) ⊃ Group ⊃ Rect at absolute (150, 150): the rect shows X 50, Y 50, and so does the group. _M0·P0·[API]_

### 6.4 Frame labels & canvas selection

- [ ] **FR-053** Which frames get labels — name labels are drawn only for top-level frames (parent is a page or a section). Nested frames have no label. _Data:_ `parent` _Test:_ Put a frame on the page, a frame in a section and a frame inside a frame: only the first two show labels. _M1·P0·[DOC:360041539473 excerpt][SRC:https://forum.figma.com/suggest-a-feature-11/option-to-hide-frame-labels-10420]→V-47_
- [ ] **FR-054** Label removed when the frame is wrapped — grouping a top-level frame (⌘G) or wrapping it in another frame (⌥⌘G) removes its label. Ungrouping restores it. _Data:_ `parent` _Test:_ Top-level frame F: ⌘G hides F's label, ⇧⌘G brings it back. _M1·P1·[SRC:https://forum.figma.com/suggest-a-feature-11/option-to-hide-frame-labels-10420]→V-47_
- [ ] **FR-055** Labels on components and instances — top-level components, component sets and instances show name labels as frames do. _Data:_ node type _Test:_ Place a component and an instance on the page: record their labels and match. _M5·P1·[KNOW]→V-47_
- [ ] **FR-056** Labels cannot be hidden — there is no setting to hide frame labels. _Data:_ — _Test:_ No preference or view toggle hides labels. _M1·P2·[SRC:https://forum.figma.com/suggest-a-feature-11/option-to-hide-frame-labels-10420]_
- [ ] **FR-057** Label click selects — clicking a frame label replaces the selection with that frame. Shift-click toggles the frame in or out of the selection. _Data:_ `selection` _Test:_ With rect R selected, click frame F's label: the selection is [F]. Shift-click frame G's label: the selection is [F, G]. Shift-click G's label again: [F]. _M1·P0·[KNOW]→V-51_
- [ ] **FR-058** Label drag moves the frame — dragging a label moves the frame, even when the frame's content covers its whole area. _Data:_ `x`, `y` _Test:_ Fill frame F completely with an image child, then drag F's label by (+50, 0): F moves by 50 and the child stays inside F. _M1·P0·[KNOW]→V-51_
- [ ] **FR-059** Label double-click renames — double-clicking a label starts inline rename. Enter commits, Esc cancels, and an empty name restores the previous one. _Data:_ `name` _Test:_ Double-click a label, type "Home" and press Enter: the name is Home. Repeat with Esc: unchanged. Commit an empty string: record the result. _M1·P1·[KNOW]→V-51_
- [ ] **FR-060** Label hover — hovering a label highlights the frame's outline. _Data:_ — (UI) _Test:_ Hover a label: the frame's outline is highlighted, as in Figma. _M1·P2·[KNOW]→V-51_
- [ ] **FR-061** Label sizing — labels keep a constant on-screen size at any zoom, are truncated to the frame's on-screen width, and are never exported. _Data:_ — (UI) _Test:_ Zoom from 10% to 800%: the label's text size is constant and long names are ellipsized at the frame's width. Export the frame as PNG: no label. _M1·P1·[KNOW]→V-51_
- [ ] **FR-062** Clicking the empty area of a top-level frame — on a top-level frame **with** children, a click on empty frame area does not select the frame (a drag starts a marquee). An **empty** top-level frame is selected by a click. _Data:_ `selection` _Test:_ Matches CV-066 in the canvas spec: click and drag the background of a frame with children, then of an empty frame. Record the selection and match. _M1·P0·[KNOW]→V-06_
- [ ] **FR-063** Layers-panel presentation — top-level frames are shown in bold. Frames, groups, sections, components, instances and auto-layout frames each have a distinct type icon. _Data:_ node type, `layoutMode` _Test:_ Build a page with every container type: bolding and icon type match Figma row by row. _M1·P1·[DOC:360041539473 excerpt][KNOW]→V-57_

### 6.5 Clip content

- [ ] **FR-064** Clip on — with `clipsContent = true`, descendants render only inside the frame's shape, including its corner radii and corner smoothing. _Data:_ `clipsContent`, `cornerRadius`, `cornerSmoothing` _Test:_ A 200 × 200 frame with radius 40, smoothing 0.6 and an oversized child: a pixel diff of the 1× export against Figma's export is within tolerance. _M1·P0·[API][KNOW]→V-08_
- [ ] **FR-065** Nested clips intersect — a clipping frame inside a clipping frame shows its content only in the intersection of both shapes. _Data:_ `clipsContent` _Test:_ Overlapping nested clipping frames, each with a big child: the visible region is the intersection. _M1·P0·[KNOW]→V-08_
- [ ] **FR-066** Clip off — with `clipsContent = false`, overflowing descendants render normally outside the frame. _Data:_ `clipsContent` _Test:_ Turn clip off: the overflow is visible on the canvas. _M1·P0·[API]_
- [ ] **FR-067** Clipping is purely visual — clipping never changes a child's geometry, bounds, constraints, or selection bounds and handles. _Data:_ — _Test:_ Select a half-clipped child: its selection box extends beyond the frame, and its W/H equal the unclipped size. _M1·P0·[KNOW]→V-08_
- [ ] **FR-068** Clipped-out parts cannot be clicked — clicking a child's clipped-out area on the canvas does not hit it (the click goes to whatever is beneath). _Data:_ — _Test:_ Click on the visible overflow region of a child under a clipping frame: record what gets selected (expected: not the child). _M1·P1·[KNOW]→V-08_
- [ ] **FR-069** A frame's own effects are not clipped — a frame's drop shadow and other outer effects render outside it even when it clips its content. _Data:_ `effects`, `clipsContent` _Test:_ A clipping frame with a drop shadow (offset 10, blur 20): the shadow is fully visible. _M2·P0·[KNOW]→V-08_
- [ ] **FR-070** Shadow spread needs fills and clip — a drop shadow's `spread` is accepted on a frame only when the frame has visible fills and `clipsContent` is on. Otherwise spread is ignored or disabled. _Data:_ `DropShadowEffect.spread` _Test:_ Set spread 10 on a frame with no fill: record whether the field is disabled or ignored. Turn on a fill and clip: spread takes effect. _M2·P2·[API]_
- [ ] **FR-071** Clip content control — the UI3 Layout section has a Clip content checkbox for freeform and auto-layout frames, components and instances. The "Toggle clip content" quick action toggles it on every selected frame at once. _Data:_ `clipsContent` _Test:_ Select 3 frames with mixed clip states and run Toggle clip content. Record the result (all on? each flipped?) and match. _M1·P0·[OBS][SRC:forum community-support reply, March 2024]→V-07_
- [ ] **FR-072** Default clip for new frames — the default `clipsContent` for frames from the Frame tool, presets, Frame selection and conversions is a single named constant set to Figma's current value. _Data:_ `clipsContent` _Test:_ Create a frame in each of those 4 ways and record the checkbox state. Illigma matches each one. _M1·P0·[SRC:https://forum.figma.com/suggest-a-feature-11/clip-content-in-layout-should-be-on-by-default-45504]→V-07_
- [ ] **FR-073** Groups and sections never clip — selecting a group or a section shows no Clip content control, and setting clip on them is impossible. _Data:_ capability matrix _Test:_ Select a group, then a section: no checkbox, and the quick action is disabled. _M1·P0·[API]_
- [ ] **FR-074** Export of overflow — exporting a non-clipping frame with overflowing children either includes the overflow or crops to the frame, as Figma does. A clipping frame always crops. _Data:_ `exportSettings`, `clipsContent` _Test:_ Export a frame with a child sticking out 50 px, clip off, as PNG and SVG. Record the image size and content in Figma and match. _M2·P1·[KNOW]→V-09_

### 6.6 Frame selection, conversion, remove frame, Resize to fit

- [ ] **FR-075** Frame selection wraps the selection — ⌥⌘G / Ctrl+Alt+G creates a frame whose bounds are the union of the selected layers' bounds. It is inserted at the z-index of the topmost selected layer, and the layers move into it keeping their absolute transforms and relative order. The new frame is selected. _Data:_ `parent`, child order, `absoluteTransform` _Test:_ Select rects at (10, 10, 50×50) and (100, 40, 30×30) on the page, then press ⌥⌘G: the frame is at (10, 10), 120 × 60, contains both rects in their original order at unchanged absolute positions, and is selected. _M1·P0·[SRC:forum.figma.com/t/unframe-selection/46384][KNOW]→V-10_
- [ ] **FR-076** What Frame selection refuses — Frame selection is refused (command disabled, or a toast) if the selection contains a section, or an instance sublayer that cannot be reparented. _Data:_ — _Test:_ Select a section plus a rect and press ⌥⌘G: nothing changes. Record any message. _M1·P0·[DOC:9771500257687 excerpt][API]→V-20_
- [ ] **FR-077** Frame selection across parents — with layers from different parents selected, the new frame's parent and the outcome follow Figma's rule. _Data:_ `parent` _Test:_ Select a child of frame A and a page-level rect, then press ⌥⌘G. Record the new frame's parent, its position and each layer's parent. _M1·P1·[KNOW]→V-10_
- [ ] **FR-078** Frame selection inside auto layout — wrapping children of an auto-layout frame inserts the new frame into the flow at the topmost selected child's index. _Data:_ child index, `layoutMode` _Test:_ Select children 2 and 3 of a 4-child horizontal auto layout and press ⌥⌘G: the parent now has 3 children, with the new frame at index 1. _M4·P1·[KNOW]→V-10_
- [ ] **FR-079** Frame selection naming & properties — the wrapper is named "Frame N" (layer names are not reused). Its fill and clip follow Figma's Frame-selection defaults. _Data:_ `name`, `fills`, `clipsContent` _Test:_ ⌥⌘G on two rects: record the name, fills and clip and match. _M1·P1·[SRC:https://forum.figma.com/suggest-a-feature-11/allow-the-name-to-be-preserved-when-a-group-is-made-into-a-frame-via-ctrl-alt-g-15688]→V-07_
- [ ] **FR-080** ⌥⌘G on a single group — pressing ⌥⌘G with exactly one group selected yields a frame named "Frame N". Whether the group is converted in place or wrapped (left nested inside) follows Figma. _Data:_ `type`, `name`, `children` _Test:_ Select group "Card" and press ⌥⌘G. Record the layer tree: either Frame N ⊃ children, or Frame N ⊃ Card ⊃ children. _M1·P1·[SRC:https://forum.figma.com/suggest-a-feature-11/allow-the-name-to-be-preserved-when-a-group-is-made-into-a-frame-via-ctrl-alt-g-15688]→V-11_
- [ ] **FR-081** Container-type dropdown — when a frame, group or section is selected, a dropdown above Position lists Frame, Group and Section. Choosing another entry converts the node in place, keeping its position in the layer tree. _Data:_ `type` _Test:_ Select a frame and choose Group: the layer row now shows the group icon at the same index. _M1·P1·[SRC:https://forum.figma.com/t/changing-a-section-into-a-group-or-frame/31994][SRC:https://uxplanet.org/my-tips-from-our-figma-like-the-pros-talk-during-config-2023-af05ccf25831]→V-44_
- [ ] **FR-082** Conversion keeps the name — converting through the dropdown or a "Convert to …" command keeps the layer name. _Data:_ `name` _Test:_ Convert group "Card" to a frame: the name is still "Card". _M1·P1·[SRC:https://forum.figma.com/suggest-a-feature-11/allow-the-name-to-be-preserved-when-a-group-is-made-into-a-frame-via-ctrl-alt-g-15688]→V-44_
- [ ] **FR-083** Group → frame — the frame takes the group's current bounds and the children keep their absolute positions. The frame's fill and clip are Figma's values for this path. Opacity, effects and blend mode carry over if Figma carries them. _Data:_ `type`, `fills`, `clipsContent`, `opacity` _Test:_ A group with 50% opacity and a shadow, converted to a frame: record fills, clip, opacity and effects, and match. _M1·P1·[KNOW]→V-44_
- [ ] **FR-084** Frame → group — the frame's fills, strokes, radius, clip, layout guides, auto layout and constraints are dropped, and the group's bounds snap to the union of its children. The children's own constraints are kept. _Data:_ `type`, bounds _Test:_ A frame of 400 × 400 whose children cover 100 × 100, converted to a group: the group is 100 × 100. Converting back does not restore the fills. _M1·P1·[KNOW]→V-44_
- [ ] **FR-085** Frame → section only at top level — "Convert to section" is offered only for a frame whose parent is a page or a section. A nested frame does not offer it. _Data:_ `parent` _Test:_ Right-click a nested frame: no Convert to section. Right-click a top-level frame: it is offered. _M1·P1·[SRC:https://forum.figma.com/report-a-problem-6/section-in-a-frame-36868]_
- [ ] **FR-086** Section ↔ frame — both directions keep the bounds and children. Which of fills, strokes, radius and dev status survive follows Figma. Converting a section that contains sections into a frame is refused or handled as Figma does. _Data:_ `type`, `fills`, `devStatus` _Test:_ A section with a blue fill and Ready for dev, converted to a frame: record the fill and status. Then convert a section that contains a section: record the result. _M1·P1·[KNOW]→V-44_
- [ ] **FR-087** Conversion yields a valid document — after any conversion the file stays valid: no section inside a frame and no empty group. Prototype links that point at the converted node still resolve (Illigma may keep the node ID; Figma reportedly assigns a new one). _Data:_ `id`, `reactions` _Test:_ Convert a frame that is a prototype destination into a section: the link still targets it, or behaves as in Figma (record). _M1·P2·[SRC:https://forum.figma.com/t/not-able-to-convert-existing-group-into-frame-by-using-plugin-api/35735]→V-44_
- [ ] **FR-088** Remove frame via Ungroup — ⇧⌘G / Ctrl+Shift+G on a selected frame moves its children into the frame's parent at the frame's z-index, keeping their order and absolute transforms, and deletes the frame together with its fills, strokes, effects, layout guides, clip, auto layout and prototype settings. The children's constraint values are kept, and the children become the selection. _Data:_ `parent`, child order, `constraints` _Test:_ A frame at (100, 100) with 2 rects, sitting between two siblings: ⇧⌘G puts both rects at that index in order, at unchanged absolute positions, and both are selected. _M1·P0·[SRC:https://www.figma.com/best-practices/groups-versus-frames/][API]_
- [ ] **FR-089** Alternative remove-frame keys — ⇧⌫ and ⌘⌫ (Windows: the Backspace equivalents) remove a frame and keep its children only if Figma binds them. Otherwise they keep their regular meaning. _Data:_ — _Test:_ Press each key on a selected frame and record the result. _M1·P2·[SRC]→V-12_
- [ ] **FR-090** Resize to fit, freeform frame — Resize to fit sets the frame's bounds to the union of its children's layout bounds. Children keep their absolute positions (their local X/Y shift by the old offset), and no constraints are applied. _Data:_ `x`, `y`, `width`, `height`, children `x`, `y` _Test:_ Frame at (0, 0), 400 × 400, with children spanning local (50, 60)–(250, 160), including a Right/Bottom child: after Resize to fit the frame is at (50, 60), 200 × 100, and every child is unchanged in absolute terms. _M1·P0·[DOC:360041539473 excerpt][SRC:https://app.uxcel.com/lessons/frames-in-figma-489]→V-13_
- [ ] **FR-091** Resize to fit edge cases — on an empty frame it does nothing. Hidden children are included or excluded, and strokes, effects and text overflow are included or excluded, exactly as Figma does. _Data:_ `visible`, `strokeWeight`, `effects` _Test:_ A frame with a hidden child far outside it, and a child with a 10 px outside stroke and a shadow: record the fitted bounds and match. _M1·P1·[KNOW]→V-13_
- [ ] **FR-092** Resize to fit on a rotated frame — the fitted frame keeps its rotation. Its position is moved along its rotated axes, and the children do not move in world space. _Data:_ `rotation`, `relativeTransform` _Test:_ Rotate a frame 30° and run Resize to fit: compare the absolute transforms of all children before and after (equal within 1e-6), and the frame's matrix against Figma's. _M1·P1·[KNOW]→V-13_
- [ ] **FR-093** Resize to fit with several frames selected — each selected frame fits its own children, in one undo step. _Data:_ — _Test:_ Select 3 frames and press ⌥⇧⌘R: each one is fitted, and one Undo restores all three. _M1·P1·[KNOW]→V-14_
- [ ] **FR-094** Resize to fit not offered for groups — groups already hug their children, so the command is unavailable or does nothing for them. _Data:_ — _Test:_ Select a group: the command is absent or disabled, and the shortcut changes nothing. _M1·P2·[KNOW][SRC:forum.figma.com/t/new-feature-resize-group-or-frame-to-contents/27575]_
- [ ] **FR-095** Resize to fit on auto layout — the menu item is hidden for auto-layout frames (Hug is the equivalent). The shortcut's effect on an auto-layout frame matches Figma. _Data:_ `layoutMode` _Test:_ Select an auto-layout frame: no menu item. Press ⌥⇧⌘R and record any change to sizing modes or size. _M4·P2·[SRC:https://forum.figma.com/ask-the-community-7/no-resize-to-fit-option-for-auto-layouts-40657]→V-14_
- [ ] **FR-096** Resize to fit on sections — Resize to fit is available for sections. It sets the section's bounds to the union of its children plus Figma's fixed padding (reported as 100 px or 80 px on every side). Children do not move. _Data:_ section bounds _Test:_ A section with two frames spanning (1000, 1000)–(1800, 1600): run Resize to fit. Record the section's bounds and derive the padding, then match. _M1·P1·[SRC:https://forum.figma.com/t/resize-to-fit-in-sections/32400]→V-14_
- [ ] **FR-097** Double-click a section corner — double-clicking a section's corner resize handle fits the section to its contents, as Resize to fit does. _Data:_ section bounds _Test:_ Double-click each of the 4 corner handles in turn and record the resulting bounds. Also try an edge midpoint. _M1·P2·[SRC:https://forum.figma.com/t/double-click-corner-of-a-section-in-figjam-to-expand-and-center-objects/51531]→V-48_
- [ ] **FR-098** Resize to fit on component sets — a component set fits its variants the same way. _Data:_ `COMPONENT_SET` bounds _Test:_ Spread the variants out, then press ⌥⇧⌘R on the set: the set's bounds are the union of the variants, with or without padding as in Figma. _M5·P2·[SRC:forum 2021 thread, search excerpt]→V-14_
- [ ] **FR-099** Where Resize to fit lives — it is reachable through ⌥⇧⌘R / Ctrl+Alt+Shift+R, through the Design panel (its UI3 location to be recorded) and through the context menu. _Data:_ — _Test:_ Find all three entry points in Figma and match each one. _M1·P1·[DOC:360041539473 excerpt][SRC:https://app.uxcel.com/lessons/frames-in-figma-489]→V-14_

### 6.7 Groups

- [ ] **FR-100** Group selection — ⌘G / Ctrl+G groups the selection. One node alone can be grouped. Grouped nodes keep their absolute positions. The group is inserted at the z-index of the topmost selected node, named "Group N", and selected. _Data:_ `type:'GROUP'`, `name`, child index _Test:_ Select the 2nd and 4th of 5 siblings and press ⌘G: the group sits at the old index of the 4th, contains both in their original order, and is selected. _M1·P0·[API][DOC:360039832054 excerpt][KNOW]→V-52_
- [ ] **FR-101** What cannot be grouped — a selection containing a section or an instance sublayer cannot be grouped (the command is disabled or refused). _Data:_ — _Test:_ Select a section plus a rect and press ⌘G: no change. _M1·P0·[DOC:9771500257687 excerpt][API]→V-20_
- [ ] **FR-102** Grouping across parents — grouping layers from different parents follows Figma's rule for the target parent and for each layer's position. _Data:_ `parent` _Test:_ Select a child of frame A and a page-level rect, then press ⌘G. Record the group's parent and the children's absolute positions. _M1·P1·[KNOW]→V-10_
- [ ] **FR-103** Derived group bounds — a group's bounds are always the union of its children's layout bounds in the container parent's space. They are recomputed after any child move, resize, add or remove. _Data:_ group `x`, `y`, `width`, `height` _Test:_ Move a child of a group 50 px to the right, past the group's edge: the group's W grows by the overhang. Delete that child: the group shrinks to fit the rest. _M1·P0·[API][SRC:https://www.figma.com/blog/groups-vs-frames/]_
- [ ] **FR-104** Hidden children and group bounds — whether hidden children count toward a group's bounds follows Figma. _Data:_ `visible` _Test:_ A group of 2 rects 300 px apart: hide one and record the group's W/H, then show it again. _M1·P1·[KNOW]→V-15_
- [ ] **FR-105** Rotated groups — a rotated group keeps its rotation, and its bounds are computed in its own rotated frame, as Figma does. _Data:_ `rotation`, `relativeTransform` _Test:_ Group 2 rects and rotate the group 45°. Move one child, then record the group's rotation, W/H and X/Y and match. _M1·P1·[KNOW]→V-16_
- [ ] **FR-106** Removing the last child deletes the group — deleting, or moving out, the last child of a group deletes the group in the same undo step. _Data:_ `children` _Test:_ Drag the only child out of a group: the group is gone. One Undo restores both. _M1·P0·[API]_
- [ ] **FR-107** Moving a group — moving a group moves every descendant exactly once by the same delta. _Data:_ `absoluteTransform` _Test:_ Move a group containing a nested group by (+30, +20): every leaf's absolute position changes by exactly (30, 20). _M1·P0·[KNOW]_
- [ ] **FR-108** Resizing a group scales its children — resizing a group with its handles or W/H fields maps every descendant's box proportionally (position and size), whatever the descendants' constraint settings are. _Data:_ group bounds, descendants' boxes _Test:_ Group 2 rects with Left/Top constraints, then set the group's W from 200 to 400: both rects double in width and their X offsets within the group double. _M1·P0·[KNOW][SRC:https://forum.figma.com/t/how-can-i-fix-a-nested-element-size-when-resizing-its-parent-component/1166]→V-17_
- [ ] **FR-109** What a group resize does to nested content — a frame inside a resized group is resized, and its own children then follow their constraints. A text layer gets a new box but keeps its font size. Stroke weights and effects do not change (unlike the Scale tool). _Data:_ `fontSize`, `strokeWeight`, `effects` _Test:_ A group containing a frame (with a Right-constrained child), a text layer and a rect with a 4 px stroke: double the group's width. Record the frame child's position, the font size and the stroke weight. _M1·P0·[KNOW]→V-17_
- [ ] **FR-110** Group appearance properties — a group has opacity, blend mode, effects, mask, visibility, lock, export settings and prototype interactions. Opacity and effects apply to the group's composite, not to each child. _Data:_ `opacity`, `blendMode`, `effects` _Test:_ A group of 2 overlapping opaque rects at 50% opacity: the overlap is not darker than the rest (composite opacity). _M2·P0·[API][KNOW]_
- [ ] **FR-111** Groups scope masks — a mask inside a group masks only the siblings above it within that group. _Data:_ `isMask` _Test:_ Group (mask circle, rect A) next to rect B outside the group: A is masked, B is not. _M2·P0·[API]_
- [ ] **FR-112** Constraints on a group write through — when a group is selected, the Constraints controls write the chosen value to every child, recursing through nested groups and booleans. They show "Mixed" when the children differ. The group itself stores nothing. _Data:_ children's `constraints` _Test:_ Inside a frame, a group of 3 rects with different constraints shows Mixed. Set horizontal to Right: every rect, nested ones included, reads MAX, and the vertical values are unchanged. _M4·P0·[DOC:360039957734 excerpt][SRC:https://developers.figma.com/docs/plugins/api/GroupNode][OBS:constraints-note]→V-43_
- [ ] **FR-113** Group children follow the nearest frame — when the frame around a group resizes, each child of the group applies its own constraints relative to that frame, never relative to the group. The group's bounds are recomputed afterwards. _Data:_ `constraints` _Test:_ A 400-wide frame ⊃ group (child A Left, child B Right, 20 px from the right edge): widen the frame to 600. A does not move, B stays 20 px from the right, and the group's width grows by 200. _M4·P0·[DOC:360039957734 excerpt][API]_
- [ ] **FR-114** Group X/Y display — a group's X/Y, like its children's, is shown relative to the container parent. _Data:_ `x`, `y` _Test:_ Frame at (100, 100) ⊃ group whose top-left is at absolute (130, 140): the group shows X 30, Y 40. _M1·P0·[API]_
- [ ] **FR-115** Ungroup — ⇧⌘G / Ctrl+Shift+G moves the group's children into the group's parent at the group's index, keeping order and absolute transforms, and removes the group. If the group was selected, its children become selected. _Data:_ `parent`, child order _Test:_ Ungroup a group at index 2 holding [A, B]: the parent's children are […, A, B, …] at indices 2–3, and A and B are selected. _M1·P0·[API]_
- [ ] **FR-116** Ungroup and group appearance — the group's opacity, blend mode and effects are discarded or baked into the children exactly as Figma does. _Data:_ `opacity`, `effects`, `blendMode` _Test:_ A group at 50% opacity with a drop shadow, ungrouped: record each child's opacity and effects and match. _M1·P1·[KNOW]→V-18_
- [ ] **FR-117** Ungroup variants — several selected groups or frames are ungrouped in one action and one undo step. On a leaf layer, Ungroup does nothing. Nested groups lose one level per Ungroup. _Data:_ — _Test:_ Select 2 groups and a rect, then press ⇧⌘G: both groups dissolve, the rect is unchanged, and one Undo reverts. A three-level nested group needs three presses. _M1·P1·[KNOW]→V-18_
- [ ] **FR-118** Ungroup inside auto layout — ungrouping a group (or removing a frame) that is a flow child of an auto-layout frame inserts its children into the flow at the container's index, in order. _Data:_ child index _Test:_ An auto layout [A, G(B, C), D] becomes [A, B, C, D] after ungrouping G. _M4·P1·[KNOW]→V-18_
- [ ] **FR-119** Selecting inside groups — a click selects the outermost group in the current context, a double-click or Enter goes one level deeper, and ⌘/Ctrl+click deep-selects. The canvas spec owns this behavior. _Data:_ `selection` _Test:_ Per the canvas spec's click-depth items. FR only checks that groups and booleans take part as levels. _M1·P0·[KNOW]→V-52_

### 6.8 Boolean groups as containers

- [ ] **FR-120** Boolean bounds and constraints — a boolean group's bounds come from its children's geometry, and it stores no constraints. When the surrounding frame resizes, the boolean's children apply their own constraints and the boolean result is recomputed. _Data:_ `BOOLEAN_OPERATION`, children `constraints` _Test:_ A frame ⊃ union(rect A Left, rect B Right): widen the frame by 100. A stays, B moves 100, and the union shape spans both. _M4·P0·[API]_
- [ ] **FR-121** Boolean capabilities — a boolean has its own fills, strokes and effects, plus `cornerRadius`, but no clip, layout guides or auto layout. Its constraints controls write through to its children as for groups. _Data:_ capability matrix _Test:_ Select a boolean: Fill, Stroke and Effects are available, Clip and Layout guide are absent, and setting a constraint changes the children. _M2·P1·[API][KNOW]→V-43_

### 6.9 Sections

- [ ] **FR-122** Section tool — ⇧S, or the toolbar flyout, activates the Section tool. Dragging on the canvas creates a section spanning the drag, which is then selected. _Data:_ `type:'SECTION'` _Test:_ Press ⇧S and drag (0, 0)–(800, 600): a section of 800 × 600 at (0, 0), selected. _M1·P0·[DOC:9771500257687 excerpt]_
- [ ] **FR-123** Section click and naming — a Section-tool click without a drag creates a section of Figma's default size, named "Section N", and the tool returns to Move as in Figma. _Data:_ `width`, `height`, `name` _Test:_ ⇧S and click: record the size, name and active tool, and match. _M1·P1·[KNOW]→V-19_
- [ ] **FR-124** Section tool never wraps in UI3 — choosing the Section tool while frames are selected does not wrap them (that UI2 behavior was removed). The tool always draws. _Data:_ — _Test:_ Select 2 frames and press ⇧S: no section is created until you drag. _M1·P2·[SRC:https://forum.figma.com/t/ui3-removed-auto-create-section-by-clicking-the-section-button-on-toolbar/90156]_
- [ ] **FR-125** Wrap in new section — the context menu's "Wrap in new section", ⌘S / Ctrl+S, the properties panel's "…" menu and Quick actions all wrap the selection in a new section. Its bounds are the selection's union, padded as Figma pads them. It is inserted at the topmost selected layer's index, and its children keep their absolute positions. _Data:_ `parent`, section bounds _Test:_ Select 2 top-level frames spanning (0, 0)–(1000, 800) and press ⌘S. Record the section's bounds (padding), its name and its z-index, and match. _M1·P0·[DOC:9771500257687 excerpt][SRC:https://forum.figma.com/t/wrap-in-a-section-not-available-in-new-ui3/83232]→V-19_
- [ ] **FR-126** ⌘S with one layer selected — whether ⌘S wraps a single layer, or needs 2 or more, follows Figma. Its behavior with nothing selected follows Figma too (it must never be "Save" in a context where Figma wraps). _Data:_ — _Test:_ Select one frame and press ⌘S, then deselect all and press ⌘S. Record both results. _M1·P1·[SRC:https://forum.figma.com/suggest-a-feature-11/create-section-when-selecting-single-object-and-hitting-cmd-s-46600]→V-19_
- [ ] **FR-127** Section default appearance — new sections get Figma's default fill and stroke (sources disagree: grey or white). Users cannot change the default. _Data:_ `fills`, `strokes` _Test:_ Create a section in light theme and in dark theme. Read `fills` and `strokes` through the API and match them. _M1·P1·[SRC:https://forum.figma.com/t/default-section-colours-in-figma/35557]→V-46_
- [ ] **FR-128** What a section may contain — a section can contain every layer type, including other sections. _Data:_ `children` _Test:_ Drag a frame, a group, a text layer, a component, an instance and a section into a section: all are accepted as children. _M1·P0·[DOC:9771500257687 excerpt]_
- [ ] **FR-129** Where a section may live — a section's parent is always a page or a section, never a frame, group, boolean, component or instance. _Data:_ `parent` _Test:_ Try each container type as a section's parent through drag, paste, the Layers panel and conversion: all are refused. _M1·P0·[DOC:9771500257687 excerpt][KNOW]→V-20_
- [ ] **FR-130** Refusals that protect section nesting — dragging a section into a frame, running Frame selection or Group on a selection that contains a section, and pasting a section while a frame is selected never put a section inside a frame or group. Record each outcome: refused, or placed on the page instead. _Data:_ `parent` _Test:_ Try all four operations and record the result and any message. _M1·P0·[DOC:9771500257687 excerpt]→V-20_
- [ ] **FR-131** Adopt by moving the section — moving a section over an object makes the object its child. _Data:_ `parent` _Test:_ Drag an empty section so that it covers a page-level rect: the rect's parent becomes the section. _M1·P0·[DOC:9771500257687 excerpt]→V-21_
- [ ] **FR-132** Adopt by resizing the section — resizing a section so that it covers an object makes the object its child. _Data:_ `parent` _Test:_ Drag a section's right edge over a page-level frame: the frame's parent becomes the section. _M1·P0·[DOC:9771500257687 excerpt]→V-21_
- [ ] **FR-133** Adopt by moving the object — moving an object into a section with the mouse **or the arrow keys** makes it a child of the section. _Data:_ `parent` _Test:_ Nudge a rect with → until it is inside a section: its parent becomes the section, and the nudge step that made it enter is the one that reparents it. _M1·P0·[DOC:9771500257687 excerpt]→V-21_
- [ ] **FR-134** Containment rule for adoption — whether adoption needs full containment or partial overlap, and how the pointer position counts during drags, follows Figma. _Data:_ — _Test:_ Move a section so that it covers 50%, 99% and then 100% of a rect, and record the parent each time. Repeat by moving the rect. _M1·P0·[KNOW]→V-21_
- [ ] **FR-135** Release from a section — moving an object out of a section reparents it to the section's parent. _Data:_ `parent` _Test:_ Drag a child out of a section onto the empty page: its parent becomes the page. In nested sections, drag it from the inner one into the outer one: its parent becomes the outer section. _M1·P0·[KNOW]→V-21_
- [ ] **FR-136** Shrinking a section past its children — when a section is resized so that a child ends up partly or fully outside it, the child stays a child or is released, as in Figma. _Data:_ `parent` _Test:_ Shrink a section until a child frame is completely outside it, and record the parent. _M1·P1·[KNOW]→V-21_
- [ ] **FR-137** Nested sections — sections nest. A section inside a section moves with it. Adopting a section into another one follows the same adoption rules, and the inner section's children stay with the inner section. _Data:_ `parent` _Test:_ Drag section S2 (holding frame F) into section S1: S2's parent becomes S1 and F's parent stays S2. _M1·P1·[DOC:9771500257687 excerpt][KNOW]→V-21_
- [ ] **FR-138** Moving a section — moving a section moves all its descendants by the same delta. _Data:_ `absoluteTransform` _Test:_ Move a section by (+100, 0): every descendant's absolute X grows by 100. _M1·P0·[KNOW]_
- [ ] **FR-139** Resizing a section leaves its children alone — resizing a section from any handle never moves or resizes its children, whatever their constraints. Its minimum size is 0.01. _Data:_ section `width`, `height` _Test:_ Drag a section's left edge 200 px to the right: no child moves in absolute terms. _M1·P0·[API]_
- [ ] **FR-140** Sections cannot rotate or blend — a section has no rotation, opacity, blend mode or effects controls, and its rotation handles do not appear. _Data:_ capability matrix _Test:_ Select a section: no rotation field, no Appearance opacity, no Effects. Hover a corner: no rotate cursor. _M1·P0·[API]_
- [ ] **FR-141** Section fill, stroke and radius — a section's fill (background) and stroke (border) are editable. Whether UI3 exposes corner radius follows Figma; the stored radii round-trip either way. _Data:_ `fills`, `strokes`, `cornerRadius` _Test:_ Change the fill to blue and the stroke to 2 px red. Check whether the Appearance radius field exists for sections. _M1·P1·[DOC:9771500257687 excerpt][API]→V-22_
- [ ] **FR-142** Section title rename — double-clicking the section title, on the canvas or in the Layers panel, starts rename. Return/Enter commits. _Data:_ `name` _Test:_ Double-click the title, type "Flow A" and press Enter: the name is Flow A on the canvas and in the panel. _M1·P0·[DOC:9771500257687 excerpt]_
- [ ] **FR-143** Section title click and drag — clicking a section's title selects the section, and dragging the title moves it. _Data:_ `selection` _Test:_ Click the title of a section with children: the section is selected. Drag the title: the section and its children move. _M1·P0·[KNOW]→V-23_
- [ ] **FR-144** Section child coordinates — a child of a section shows X/Y relative to the page (sections are not coordinate containers) or relative to the section, as Figma does. Constraints are never active for direct children of sections. _Data:_ `relativeTransform`, `x`, `y` _Test:_ A section at (500, 500) with a rect at absolute (520, 530): record the displayed X/Y and the plugin `x`/`y`, then match. Must agree with CV-004 in the canvas spec. _M1·P0·[API][KNOW]→V-53_
- [ ] **FR-145** Clicking inside a section — a click on empty space inside a section selects the section, and a drag there moves it (users report this). That differs from empty canvas, where a drag starts a marquee. _Data:_ `selection` _Test:_ Click empty space inside a section and record the selection. Drag from there: record whether the section moves or a marquee starts. _M1·P0·[SRC:https://forum.figma.com/t/make-it-harder-to-select-and-move-sections/69436][SRC:https://forum.figma.com/suggest-a-feature-11/make-it-harder-to-select-and-move-sections-14735]→V-23_
- [ ] **FR-146** Hidden section contents flag — `sectionContentsHidden` round-trips. If Figma Design shows a UI for it, Illigma offers the same UI and rendering (contents hidden, title kept). Otherwise Illigma only preserves the flag. _Data:_ `sectionContentsHidden` _Test:_ Import a fixture with the flag set to true, save and reopen: the flag is unchanged. Record Figma Design's rendering of that fixture and match. _M1·P2·[API]→V-24_
- [ ] **FR-147** Section extras — a section can be the file thumbnail and can carry export settings and explicit variable modes. _Data:_ `exportSettings`, `explicitVariableModes` _Test:_ Set a section as the thumbnail, export it as PNG, and set a variable mode on it: each round-trips, and children resolve the mode. _M6·P2·[API]_
- [ ] **FR-148** Mark as ready for dev — sections, frames and components directly under a page or section can be marked "Ready for dev" (`devStatus = {type:'READY_FOR_DEV'}`). The control sits next to the canvas label of sections and frames, and above the upper-right corner of components. The status label's overflow menu removes the status. _Data:_ `devStatus` _Test:_ Mark a top-level frame, then remove the status through the menu: `devStatus` goes from READY_FOR_DEV to null, one undo step each. _M1·P2·[DOC:9771500257687 excerpt][DOC:26781702258583 excerpt][API]_
- [ ] **FR-149** Where a status can be set — a status can only be set on a node directly under a page or section, and never inside a node that already has one. In nested sections, the outer section is the one marked. `COMPLETED` is stored and round-trips even though Figma limits it to some plans. _Data:_ `devStatus` _Test:_ Try to mark a nested frame: not offered. Mark section S1, then try its child section S2: not offered. Import a fixture with COMPLETED: preserved. _M1·P2·[API][SRC:https://forum.figma.com/t/unable-to-mark-ready-for-dev/54825][DOC:26781702258583 excerpt]_
- [ ] **FR-150** The "Changed" status — editing content that is marked Ready for dev shows it as Changed automatically. These do not trigger it: library instance updates, value changes of an applied variable or style, and transient states such as hover previews. Choosing "Done with changes", optionally with a reason (stored in `description`), returns the status to Ready for dev. _Data:_ `devStatus.description`, Illigma's derived changed flag _Test:_ Mark a frame and change a fill: the frame reads Changed. Change the value of a variable bound in the frame: not Changed. Click Done with changes and type "copy fix": back to Ready, with `description` "copy fix". _M8·P2·[DOC:26781702258583 excerpt][API]→V-45_
- [ ] **FR-151** Marking does not lock — content marked with a status stays fully editable. _Data:_ `locked` _Test:_ Mark a frame: its children can still be selected and edited, and `locked` is false. _M1·P2·[DOC:26781702258583 excerpt]_
- [ ] **FR-152** Sections as prototype destinations — a prototype connection whose destination is a section navigates to the last-visited frame in that section. _Data:_ `reactions` with a section destination _Test:_ In the prototype, visit frame F2 inside section S, return to the start screen, and trigger the link to S: F2 is shown. _M7·P1·[DOC:16194160540567 excerpt]_

### 6.10 Constraints

- [ ] **FR-153** Where constraints apply — constraints act only when the node's container parent is a frame, component or instance with `layoutMode:'NONE'`. _Data:_ `constraints`, parent `layoutMode` _Test:_ Give a child of a freeform frame Right and widen the frame: the child moves. Turn the frame into auto layout: Constraints disappears from the child's inspector. _M4·P0·[DOC:360039957734 excerpt][API]_
- [ ] **FR-154** Absolute children use constraints — a child with `layoutPositioning:'ABSOLUTE'` inside an auto-layout frame shows Constraints and applies them when the frame resizes. MAX/MIN pins it to the top right. _Data:_ `layoutPositioning`, `constraints` _Test:_ An absolute badge set to Right/Top, 8 px from the top-right corner: when the auto-layout frame grows, the badge stays 8 px from the top-right corner. _M4·P0·[API]_
- [ ] **FR-155** Where constraints are unavailable — constraints are not shown for page-level layers, for flow children of auto layout, or for direct children of sections. _Data:_ — _Test:_ Select a page-level rect, an auto-layout flow child and a section child in turn: none shows Constraints. Record whether the section child shows them in Figma. _M4·P0·[DOC:360039957734 excerpt][API]→V-27_
- [ ] **FR-156** Component sets as containers — whether the children of a component set (its variants) show and apply constraints when the set is resized follows Figma. _Data:_ `COMPONENT_SET` _Test:_ Set a variant to Right and widen the set: record whether the variant moves and whether the control is shown. _M5·P2·[API]→V-26_
- [ ] **FR-157** Values kept while inactive — a node's stored constraints survive when they become inactive (moved to the page, a section or an auto-layout flow) and apply again once it is back in a freeform frame. _Data:_ `constraints` _Test:_ Set a child to Right/Bottom, drag it to the page and back into a frame: the inspector shows Right/Bottom again. _M4·P1·[KNOW]→V-27_
- [ ] **FR-158** Default constraints — every new layer gets Left (MIN) and Top (MIN). _Data:_ `constraints` _Test:_ Create each layer type inside a frame: every one reads Left/Top. _M4·P0·[DOC:360039957734 excerpt][OBS:constraints-note]_
- [ ] **FR-159** Left/Top (MIN) — the child keeps its distance to the container's left (top) edge and keeps its size. _Data:_ `MIN` _Test:_ A child at x = 40, w = 100 in a 400-wide frame; widen the frame to 600: x = 40, w = 100. _M4·P0·[DOC:360039957734 excerpt]→V-25_
- [ ] **FR-160** Right/Bottom (MAX) — the child keeps its distance to the container's right (bottom) edge and keeps its size. _Data:_ `MAX` _Test:_ Same setup with Right: x = 240, w = 100, so the right margin stays 260. _M4·P0·[DOC:360039957734 excerpt]→V-25_
- [ ] **FR-161** Center — the offset between the child's center and the container's center stays the same. The child keeps its size. _Data:_ `CENTER` _Test:_ Same setup with Center: x = 140 (40 + 200/2), w = 100. _M4·P0·[DOC:360039957734 excerpt]→V-25_
- [ ] **FR-162** Left & Right / Top & Bottom (STRETCH) — the child keeps both margins, so its size changes by the container's size change. _Data:_ `STRETCH` _Test:_ Same setup with Left & Right: x = 40, w = 300. _M4·P0·[DOC:360039957734 excerpt]→V-25_
- [ ] **FR-163** Scale — the child keeps its position and size as fractions of the container. A child 70% as wide as its frame stays 70% wide after a resize (140 when the frame becomes 200). _Data:_ `SCALE` _Test:_ x = 40, w = 100, frame 400 → 600: x = 60, w = 150. Repeat the help-article example: frame 100 → 200, child 70 → 140. _M4·P0·[DOC:360039957734 excerpt]_
- [ ] **FR-164** Axes are independent — the horizontal and vertical constraints apply independently, and resizing on one axis never changes the other axis. _Data:_ `constraints.horizontal`, `constraints.vertical` _Test:_ Set Right/Scale and change only the frame's width: the vertical position and height do not change. _M4·P0·[API][DOC:360039957734 excerpt]_
- [ ] **FR-165** Which handle is dragged does not matter — results are computed in the container's local space. Dragging the left or top handle moves the container's origin: MIN children follow the moving edge and MAX children stay fixed in world space. _Data:_ — _Test:_ A 400-wide frame at x = 0 with a Left child at local 40 and a Right child: drag the left handle to x = −200. The Left child is at world −160 and the Right child's world X is unchanged. _M4·P0·[DOC:360039957734 excerpt][KNOW]→V-25_
- [ ] **FR-166** Shrinking below a STRETCH child's margins — when a STRETCH child's computed size would fall to 0 or below, the result (clamped to 0.01, to 0, or flipped) matches Figma. Growing the frame back gives a deterministic result. _Data:_ `STRETCH` _Test:_ A child with margins of 40 on each side in a 200-wide frame: resize the frame to 60, then back to 200. Record the child's x and w at each step. _M4·P1·[KNOW]→V-25_
- [ ] **FR-167** No rounding — constraint results are not rounded to whole pixels (except where pixel-grid snapping applies to the dragged container itself). _Data:_ `x`, `width` _Test:_ A Scale child, frame 300 → 301: the child's X/W carry fractional values identical to Figma's (plugin read-out). _M4·P1·[KNOW]→V-25_
- [ ] **FR-168** Recursion into nested frames — when a child frame is resized by its constraints, its own children apply their constraints in turn, at any depth. _Data:_ — _Test:_ Frame A ⊃ frame B (Left & Right) ⊃ rect C (Right): widen A by 100. B grows by 100 and C moves by 100. _M4·P0·[API]_
- [ ] **FR-169** Groups and booleans are transparent — the descendants of groups and booleans are constraint targets in their own right. Group and boolean bounds are recomputed bottom-up after the pass. _Data:_ — _Test:_ Frame ⊃ group(rect Right) ⊃ …: widen the frame by 50 and the rect moves by 50. The group's bounds then match its children's union. _M4·P0·[API]_
- [ ] **FR-170** Aspect-ratio-locked children — a child whose aspect ratio is locked keeps that ratio when its constraints resize it. Which axis wins follows Figma. _Data:_ `targetAspectRatio` _Test:_ A locked 100 × 50 child with Scale/Top: widen the frame by 2×. Record the child's W/H and match. _M4·P1·[API]→V-28_
- [ ] **FR-171** Hidden and locked descendants respond — hidden and locked descendants still apply their constraints. _Data:_ `visible`, `locked` _Test:_ Hide a Right child, widen the frame by 100 and show the child again: it has moved 100. Repeat with a locked child. _M4·P1·[KNOW]→V-25_
- [ ] **FR-172** Rotated children — for a rotated child, constraints act on its axis-aligned bounding box or on its own box, as Figma does. _Data:_ `rotation` _Test:_ A rect rotated 30° with Left & Right: widen the frame by 100. Record its W/H, rotation and position, and compare matrices. _M4·P1·[KNOW]→V-29_
- [ ] **FR-173** Text under constraints — under STRETCH or SCALE a text layer gets a new box and reflows. Its font size is unchanged. The effect on `textAutoResize` follows Figma. _Data:_ `textAutoResize`, `fontSize` _Test:_ Auto-width text with Left & Right: widen the frame. Record whether the mode becomes fixed size and how the text wraps. _M4·P0·[KNOW]→V-30_
- [ ] **FR-174** Lines under vertical STRETCH or SCALE — a horizontal line (height 0) keeps height 0 under vertical constraints, and its position follows the formula. _Data:_ `LINE` _Test:_ A horizontal line with Top & Bottom: make the frame taller and record the line's height and Y. _M4·P2·[KNOW]→V-30_
- [ ] **FR-175** Auto-layout frames — when an auto-layout frame is resized, layout runs first and then its absolute children apply their constraints. _Data:_ `layoutMode`, `layoutPositioning` _Test:_ A vertical auto-layout frame with an absolute Left & Right child: set the frame to Fixed width and widen it. The flow reflows and the absolute child stretches. _M4·P0·[API]_
- [ ] **FR-176** Ignore constraints with ⌘/Ctrl — holding ⌘ (macOS) or Ctrl (Windows) while resizing a frame on the canvas resizes it without applying its children's constraints. The children keep their world geometry; their local X/Y are re-based if the origin moved. _Data:_ — _Test:_ A frame with a Right child: ⌘-drag the right handle +100. The child does not move in world space and its constraints still read Right. Drag the left handle −100 with ⌘: the child's world position is unchanged and its local X grows by 100. _M4·P0·[DOC:360039957734 excerpt]_
- [ ] **FR-177** The modifier is live — pressing or releasing ⌘/Ctrl mid-gesture switches the preview between constrained and unconstrained. The preview is always computed from the gesture's starting state, without drift. _Data:_ — (gesture) _Test:_ Start a resize, toggle ⌘ three times and release: the result equals a single gesture made in the final modifier state. _M4·P1·[KNOW]→V-54_
- [ ] **FR-178** Non-pointer resizes apply constraints — typed W/H, preset changes, orientation swaps and variable-driven size changes always apply constraints. Holding ⌘ while committing a W/H field does not bypass them, unless Figma does. _Data:_ — _Test:_ Type W + 100 in the field: a Right child moves. Repeat while holding ⌘ and record the result. _M4·P0·[KNOW][DOC:360041539473 excerpt]→V-54_
- [ ] **FR-179** Stretch guides drive constraints — when a frame has **Stretch** column (or row) layout guides, a child's constraints are evaluated against its nearest column or row span instead of the frame's edges. _Data:_ `layoutGrids`, `constraints` _Test:_ A 12-column Stretch guide (margin 20, gutter 20) on a 1200-wide frame, and a child spanning columns 3–5 with Left & Right: resize the frame to 1440. The child still spans columns 3–5 exactly. _M4·P0·[DOC:360039957934 excerpt]→V-32_
- [ ] **FR-180** Fixed guides do not drive constraints — with Left, Right or Center column guides, constraints are evaluated against the frame, as if the guides were absent. _Data:_ `alignment` _Test:_ Same as above with Center-aligned columns: the child behaves exactly as without guides. _M4·P0·[DOC:360039957934 excerpt]→V-32_
- [ ] **FR-181** Hidden or multiple guides — hidden guides keep working, so constraints still use them. With several Stretch guides on one axis, the guide that wins follows Figma. _Data:_ `layoutGrids[i].visible` _Test:_ Hide the column guide and repeat the Stretch-guide test: same result. Add a second Stretch column guide with a different count and record which one the child follows. _M4·P1·[DOC:360040450513 excerpt]→V-32_
- [ ] **FR-182** Constraint controls — in the UI3 Position section, a child of a qualifying container shows two dropdowns, horizontal (Left, Right, Left + Right, Center, Scale) and vertical (Top, Bottom, Top + Bottom, Center, Scale), plus a pin diagram. _Data:_ `constraints` _Test:_ Open each dropdown: the options and their order match Figma. Record the exact vertical STRETCH label. _M4·P0·[OBS:constraints-note][DOC:360039957734 excerpt]→V-55_
- [ ] **FR-183** Pin diagram — clicking an edge sets that single constraint. Shift-clicking the opposite edge adds it, giving STRETCH. Clicking the center lines sets Center. _Data:_ `constraints` _Test:_ Click the left pin: Left. Shift-click the right pin: Left & Right. Click the vertical center line: Center. _M4·P1·[KNOW][OBS:constraints-note]→V-55_
- [ ] **FR-184** Multi-selection editing — with several children selected, the dropdowns show "Mixed" where values differ. Editing one axis sets it on every selected node and leaves the other axis untouched. _Data:_ `constraints` _Test:_ Select A (Left/Top) and B (Right/Bottom), then set horizontal to Center: A is Center/Top and B is Center/Bottom. _M4·P1·[KNOW]→V-55_
- [ ] **FR-185** Alignment commands and constraints — the align and distribute commands, and their shortcuts, change children's constraints only if Figma does (a 2023 report says they do). _Data:_ `constraints` _Test:_ A child with Left: press "Align right" (⌥D) inside a frame and record the constraints afterwards. _M4·P2·[SRC:https://forum.figma.com/ask-the-community-7/keyboard-shortcuts-unwanted-change-constraints-23298]→V-33_
- [ ] **FR-186** Instances — resizing an instance applies the constraints its sublayers inherit from the main component. Whether a sublayer's constraints can be overridden on the instance follows Figma. _Data:_ instance overrides _Test:_ A component with a Right-constrained icon: widen an instance and the icon stays pinned right. Try changing the icon's constraints on the instance, and record whether that is allowed and whether it survives a component update. _M5·P0·[KNOW]→V-34_
- [ ] **FR-187** The Scale tool is not the Scale constraint — the Scale tool (K) ignores constraints and scales everything proportionally, including stroke weights, effects and font sizes. Handle resizing with the Scale **constraint** scales only boxes. _Data:_ — _Test:_ K-scale a frame by 2×: the children's strokes and font sizes double. Plain-resize the same frame with Scale-constrained children: strokes and font sizes are unchanged. _M1·P1·[SRC:https://www.figma.com/best-practices/groups-versus-frames/][KNOW]_
- [ ] **FR-188** Constraint indicators — if Figma draws constraint indicators on the canvas (for a selected child, or while its parent is resized), Illigma draws the same indicators in the same situations. They are never exported. _Data:_ — (UI) _Test:_ Select a Right/Bottom child and record any on-canvas indicator. Resize its parent and record any indicator. _M4·P2·[KNOW]→V-42_
- [ ] **FR-189** One undo step per resize — a resize gesture together with all the constraint-driven changes to descendants is one undo step. Redo reproduces it exactly. _Data:_ — _Test:_ Resize a frame with 20 constrained descendants and press Undo once: every descendant returns to its exact previous geometry. Redo: identical to the post-resize state. _M4·P0·[KNOW]→V-56_

### 6.11 Layout guides

- [ ] **FR-190** Which nodes can have layout guides — frames, components, component sets and instances can, including auto-layout frames. Groups, booleans and sections cannot. _Data:_ `layoutGrids` _Test:_ Select each node type: the Layout guide section appears only on the listed types, and on an auto-layout frame. _M4·P0·[API][OBS]_
- [ ] **FR-191** Adding a guide — clicking + in the Layout guide section adds a **Uniform grid** and opens its settings flyout automatically. _Data:_ `layoutGrids` _Test:_ Click +: a GRID guide is added and the flyout is open. _M4·P0·[DOC:360040450513 excerpt][SRC:https://forum.figma.com/forum-news-and-guidelines-25/updates-announced-on-the-april-25-release-notes-livestream-39496]_
- [ ] **FR-192** Uniform grid defaults — a new uniform grid has a cell size of 10, a red tint at 10% opacity and is visible. _Data:_ `sectionSize`, `color`, `visible` _Test:_ Add a guide and read its fields through the API: sectionSize 10, color r=1 g=0 b=0 a=0.1 and visible. Match the exact values Figma stores. _M4·P0·[DOC:360040450513 excerpt][SRC:https://uxcel.com/lessons/layout-grids-439]→V-36_
- [ ] **FR-193** Uniform grid geometry — lines are drawn at every multiple of `sectionSize` from the frame's top-left corner, horizontally and vertically, within the frame's bounds. A frame size that is not a multiple leaves a partial last cell. _Data:_ `sectionSize` _Test:_ A 105 × 55 frame with a grid of 10: there are 10 vertical and 5 horizontal interior lines, and the pixel positions match Figma's rendering. _M4·P0·[API][KNOW]→V-35_
- [ ] **FR-194** Defaults when switching to Columns or Rows — changing a guide's type to Columns (or Rows) fills in Figma's defaults for count, alignment, gutter, margin and size, and keeps the color. _Data:_ `count`, `alignment`, `gutterSize`, `offset`, `sectionSize` _Test:_ Add a guide, switch it to Columns and read every field. Repeat for Rows, and for Columns → Grid → Columns. Match each result. _M4·P0·[KNOW][SRC]→V-36_
- [ ] **FR-195** Stretch geometry — for Stretch, track size = (L − 2·margin − (count − 1)·gutter) / count. The first track starts at the margin, and the tracks recompute live while the frame resizes. _Data:_ `alignment:'STRETCH'`, `offset`, `gutterSize`, `count` _Test:_ A 1440-wide frame with 12 columns, margin 80 and gutter 24: each column is (1440 − 160 − 264)/12 = 84.667, and the first starts at 80. Resize to 1280: the columns are 71.333 wide, live. _M4·P0·[DOC:360039957934 excerpt][API]_
- [ ] **FR-196** Stretch tracks that do not fit — when margins and gutters leave no room (track size ≤ 0), the rendering and stored values match Figma. _Data:_ — _Test:_ A 100-wide frame with 12 columns, margin 20 and gutter 20: record the rendering. Grow the frame back: the guide is intact. _M4·P2·[KNOW]→V-35_
- [ ] **FR-197** Left/Top alignment (MIN) — tracks of `sectionSize` start at `offset` from the left (top) edge, separated by gutters. _Data:_ `alignment:'MIN'` _Test:_ 4 columns of 60, gutter 20, offset 30: the columns start at 30, 110, 190 and 270. _M4·P0·[API]_
- [ ] **FR-198** Right/Bottom alignment (MAX) — the tracks end `offset` from the right (bottom) edge. _Data:_ `alignment:'MAX'` _Test:_ The same guide on a 500-wide frame, Right: the last column ends at 470 and the first starts at 160. _M4·P0·[API]_
- [ ] **FR-199** Center alignment — the track block is centered in the frame and `offset` is ignored. _Data:_ `alignment:'CENTER'` _Test:_ The same guide, Center, on a 500-wide frame: the block of 300 starts at 100, and changing the stored offset has no effect. _M4·P0·[API]_
- [ ] **FR-200** Auto count — with Count set to Auto (`count = Infinity`) on a fixed alignment, as many tracks as Figma's rule allows fill the frame. Whether Auto is offered for Stretch follows Figma. _Data:_ `count = Infinity` _Test:_ Columns of 60, gutter 20, Left, offset 0, Auto, on frames 500 and 510 wide: record the track count and positions. Check whether the Count dropdown offers Auto under Stretch. _M4·P1·[API][DOC:360040450513 excerpt]→V-35_
- [ ] **FR-201** Rows mirror Columns — Rows use the same fields on the vertical axis, with Top/Center/Bottom in place of Left/Center/Right. _Data:_ `pattern:'ROWS'` _Test:_ Repeat the Stretch and Left tests on the frame's height with Rows: the results are equivalent. _M4·P0·[API]_
- [ ] **FR-202** Which fields the settings offer — the settings show the fields of §2.6: Stretch shows Count, Gutter and Margin, with the size computed and read-only. Left/Right show Count, Width (or Height), Gutter and Offset. Center shows Count, Width and Gutter. Grid shows Size only. _Data:_ §2.6 table _Test:_ Open the settings for each pattern × alignment and compare the field list with Figma's. _M4·P0·[API][SRC:https://uxcel.com/lessons/layout-grids-439]→V-36_
- [ ] **FR-203** Gutter on fixed alignments — gutter is editable and affects geometry for Left, Right and Center columns and rows, not only Stretch. A help-center excerpt seems to call it Stretch-only, so the conflict is resolved live. _Data:_ `gutterSize` _Test:_ Left columns: change the gutter from 20 to 40 and record whether the field exists and whether the tracks move. _M4·P1·[API]→V-36_
- [ ] **FR-204** Guide color and opacity — each guide's color and opacity are editable and stored in `color` (RGBA). _Data:_ `color` _Test:_ Set blue at 20%: `color` reads {r:0, g:0, b:1, a:0.2}. _M4·P1·[API][SRC:https://uxcel.com/lessons/layout-grids-439]_
- [ ] **FR-205** Several guides per frame — a frame can hold several guides of any patterns. They keep their list order, and a newly added guide is inserted where Figma inserts it (record whether at the top or the bottom). _Data:_ `layoutGrids` order _Test:_ Add Grid, then Columns, then Rows, and record the panel order and the API array order. _M4·P0·[API][SRC:https://uxcel.com/lessons/layout-grids-439]→V-36_
- [ ] **FR-206** Removing a guide — the remove (−) control on a guide's row deletes that guide only, in one undo step. _Data:_ `layoutGrids` _Test:_ Remove the middle of 3 guides: the other two stay in order, and Undo restores it at its index. _M4·P0·[OBS][KNOW]_
- [ ] **FR-207** Hiding one guide — each guide's eye toggle sets `visible` on that guide only. _Data:_ `layoutGrids[i].visible` _Test:_ Hide guide 2 of 3: only it disappears, and the API shows `visible:false` on it. _M4·P0·[API][DOC:360040450513 excerpt]_
- [ ] **FR-208** Global layout-guide toggle — the view-options menu entry "Layout guides", and ⇧G, show or hide every layout guide in the file at once without changing any guide's `visible`. Hidden guides keep working. _Data:_ UI state (scope V-31) _Test:_ Press ⇧G: all guides disappear, the per-guide eyes are unchanged and constraints still follow the Stretch guides. Reopen the file and record whether the hidden state persisted. _M4·P0·[DOC:360040450513 excerpt]→V-31_
- [ ] **FR-209** How guides are drawn — guides are drawn inside the frame's bounds and above its content, whatever the clip setting. They rotate with the frame, scale with zoom, and show at the same time as the guides of nested frames. _Data:_ — (render) _Test:_ A rotated frame with a nested frame, each with a guide: both sets of guides are drawn rotated, above the content and inside each frame's bounds. _M4·P1·[KNOW]→V-58_
- [ ] **FR-210** Guides never render in output — layout guides do not appear in exports, prototypes or thumbnails. _Data:_ — _Test:_ Export a frame with visible guides as PNG, SVG and PDF: no guide pixels or elements. Present it: no guides. _M2·P0·[KNOW]→V-58_
- [ ] **FR-211** Create a layout guide style — a frame's guide list can be saved as a named layout guide style (`GridStyle`). The frame then links to it through `gridStyleId`. _Data:_ `GridStyle`, `gridStyleId` _Test:_ Create a style from a frame with 2 guides: a style with 2 guides exists and the frame shows it as linked. _M6·P1·[API][DOC:360038746534 title]_
- [ ] **FR-212** Apply and update a style — applying a style to another frame replaces that frame's guides with the style's. Editing the style updates every linked frame. _Data:_ `gridStyleId` _Test:_ Apply the style to 3 frames, then change the style's column count: all 3 frames update in one undo step. _M6·P1·[API][KNOW]→V-59_
- [ ] **FR-213** Detach and local edits — detaching copies the style's guides into the frame as local values and clears `gridStyleId`. Editing a linked frame's guide directly either detaches it or is prevented, as in Figma. _Data:_ `gridStyleId` _Test:_ On a linked frame, change a guide's gutter and record whether `gridStyleId` is cleared. Detach explicitly: the values are the same and the link is gone. _M6·P1·[KNOW]→V-59_
- [ ] **FR-214** Variables on guide fields — count, gutter, offset (margin) and section size can be bound to number variables. A GRID guide can bind section size only. A style can bind its `layoutGrids` as a list of aliases. _Data:_ `boundVariables.{count,gutterSize,offset,sectionSize}` _Test:_ Bind count to the variable `cols` (12): the field shows the variable chip. Unbind: the value stays 12. _M6·P1·[API][DOC:360040450513 excerpt]_
- [ ] **FR-215** Variable changes recompute guides — changing a bound variable's value, or the frame's variable mode, recomputes the guides immediately. _Data:_ `explicitVariableModes` _Test:_ `cols` is 12 in Desktop mode and 4 in Mobile mode: switching the frame to Mobile shows 4 columns. _M6·P1·[API][KNOW]→V-41_
- [ ] **FR-216** Snapping to guides — moving or resizing layers inside a frame snaps to column and row edges (and to uniform-grid lines, if Figma does). _Data:_ — _Test:_ Drag a rect near a column edge: it snaps within Figma's threshold. Repeat for a uniform grid line and record the result. _M4·P1·[KNOW]→V-37_
- [ ] **FR-217** Guides on components and instances — instances inherit the main component's guides. Whether an instance can override them (add, hide, edit) follows Figma. _Data:_ `layoutGrids` on `InstanceNode` _Test:_ Change the column count on an instance and record whether that is allowed and whether it survives a component change. _M5·P2·[API]→V-34_
- [ ] **FR-218** Copy and paste properties — ⌥⌘C / ⌥⌘V (Ctrl+Alt+C / Ctrl+Alt+V) carries layout guides (and the style link) between frames if Figma includes them. _Data:_ `layoutGrids`, `gridStyleId` _Test:_ Copy properties from a frame with 2 guides and paste them onto an empty frame: record whether the guides arrive. _M4·P2·[DOC:4412765442967 title]→V-39_
- [ ] **FR-219** One undo step per guide edit — each committed field edit, add, remove or reorder of a guide is one undo step. A scrub of a field is one step. _Data:_ — _Test:_ Scrub the gutter from 20 to 40 and press Undo once: back to 20. _M4·P1·[KNOW]→V-56_

### 6.12 Cross-cutting behavior

- [ ] **FR-220** Undo granularity — each of these is exactly one undo step: frame creation (including adopted layers), Frame selection, Group, Ungroup / remove frame, Resize to fit, a preset change, Wrap in new section, a section adoption caused by one move, and a conversion. Redo restores the same node IDs, z-order and parents. _Data:_ history _Test:_ Run each operation, press Undo once (the document equals the snapshot from before it), then Redo (it equals the snapshot from after it, ids included). _M1·P0·[KNOW]→V-56_
- [ ] **FR-221** Copying a frame — copy and paste of a frame carries its whole subtree with every property in §2 (clip, guides, style link, constraints of the children, dev status as Figma does). _Data:_ §2 _Test:_ Copy a frame that has every property set and paste it onto another page: a deep compare matches, with dev status as recorded in Figma. _M1·P0·[KNOW]→V-38_
- [ ] **FR-222** Duplicating a top-level frame — ⌘D on a top-level frame places the copy to the right in free space, following Figma's rule for gap and search order (reported: 40 px to the right, or after the last frame of the row). _Data:_ `x`, `y` _Test:_ Frames F1–F5 in a row, 100 px apart: ⌘D on F2. Record where the copy lands and the gap. _M1·P1·[SRC:https://forum.figma.com/t/set-default-frame-spacing/2306][SRC:https://forum.figma.com/ask-the-community-7/how-can-i-manage-the-ordering-of-my-toplevel-frames-21673]→V-38_
- [ ] **FR-223** Duplicating nested layers — ⌘D on a nested layer duplicates it in place (same X/Y), directly above the original. _Data:_ `x`, `y`, child index _Test:_ ⌘D on a child of a frame: the copy has the same X/Y at index + 1. _M1·P1·[SRC:FrontendMasters course excerpt][KNOW]→V-38_
- [ ] **FR-224** Pasting into a selected frame — pasting while a frame is selected puts the clipboard inside that frame. A section on the clipboard is never pasted into a frame. _Data:_ `parent` _Test:_ Copy a rect, select frame F and paste: the rect is a child of F. Copy a section, select F and paste: record where the section goes (never inside F). _M1·P0·[KNOW]→V-20_
- [ ] **FR-225** Export settings and what is excluded — frames, groups and sections accept export settings. Labels, section titles (if Figma excludes them), selection overlays and layout guides are never in the output. _Data:_ `exportSettings` _Test:_ Export a section as PNG and check whether its title is drawn. Export a frame: no label and no guides. _M2·P1·[API][KNOW]→V-40_
- [ ] **FR-226** Components behave like frames — clip content, layout guides and children's constraints behave the same inside components, component sets and instances as inside frames. _Data:_ `BaseFrameMixin` _Test:_ Repeat the clip and constraint tests on a component and on an instance: identical results. _M5·P0·[API]_
- [ ] **FR-227** Instance overrides of clip — whether an instance can override `clipsContent` follows Figma. _Data:_ instance override set _Test:_ Toggle Clip content on an instance and record whether it is allowed and whether it survives a component update. _M5·P2·[KNOW]→V-34_
- [ ] **FR-228** Turning a group into a component — Create component on a selected group makes a frame-like component that replaces the group, with the group's children, name and bounds. _Data:_ `type` _Test:_ Select group "Btn" and press ⌥⌘K: record the resulting tree, name, fill and clip. _M5·P1·[KNOW]→V-44_
- [ ] **FR-229** Auto-layout frames keep clip and guides — turning on auto layout keeps Clip content and the layout guides. Turning it off does not restore the children's earlier positions. _Data:_ `layoutMode`, `clipsContent`, `layoutGrids` _Test:_ A freeform frame with a guide and clip on: add auto layout and both are kept. Remove auto layout: the children stay where auto layout placed them. _M4·P0·[OBS][API]_
- [ ] **FR-230** A group in auto layout is one flow item — a group that is a child of an auto-layout frame takes up a single flow slot sized to its bounds. _Data:_ — _Test:_ Auto layout [A, G(B, C), D] with gap 10: G sits between A and D, sized to B ∪ C. _M4·P0·[KNOW]→V-18_
- [ ] **FR-231** Width and height variables — binding a frame's width or height to a variable and changing its value or mode resizes the frame **with** constraint propagation to its children. _Data:_ `boundVariables.width` _Test:_ Bind W to `w` (375 → 768 by mode): when the mode switches, a Right child stays pinned. _M6·P1·[API]→V-41_
- [ ] **FR-232** Explicit variable modes on containers — frames, groups and sections can set explicit variable modes, and descendants resolve variables through the nearest ancestor that sets a mode. _Data:_ `explicitVariableModes` _Test:_ Set a section to Dark: the frames inside it resolve Dark values unless they set their own mode. _M6·P1·[API]_

### 6.13 Inspector, context menu & Layers panel

- [ ] **FR-233** Frame inspector layout — with a frame selected, UI3 shows Position, Layout, Appearance, Fill, Stroke, Effects, Layout guide and Export, in that order. _Data:_ — (UI) _Test:_ Select a freeform frame and compare the section list with Figma. _M1·P1·[OBS]_
- [ ] **FR-234** Frame header dropdown — the header dropdown shows the node kind (Frame, or the component and instance equivalents), lists the presets (choosing one resizes with constraints) and offers Frame, Group and Section conversion. _Data:_ — _Test:_ Open the dropdown on a frame and record its entries and their order. _M1·P1·[DOC:360041539473 excerpt][SRC:https://forum.figma.com/t/changing-a-section-into-a-group-or-frame/31994]→V-44_
- [ ] **FR-235** Layout section of a frame — it holds the Freeform / auto-layout selector, W and H (which resize with constraints), Resize to fit and the Clip content checkbox. _Data:_ `layoutMode`, `width`, `height`, `clipsContent` _Test:_ Compare the controls and their effects with Figma. _M1·P0·[OBS][KNOW]→V-14_
- [ ] **FR-236** Group inspector — Position (X, Y, rotation, plus constraints that write through to the children), W/H (scaling the children), Appearance (opacity, blend mode), Effects and Export. There are no Fill, Stroke, Clip or Layout guide sections; a "Selection colors" section may list the children's paints. _Data:_ — _Test:_ Select a group and compare the section list with Figma. _M1·P1·[KNOW][API]→V-43_
- [ ] **FR-237** Section inspector — X, Y, W, H, Fill, Stroke, Export and Mark as ready for dev. There is no rotation, opacity, effects, constraints, clip or layout guide control. _Data:_ — _Test:_ Select a section and compare the controls with Figma. _M1·P1·[DOC:9771500257687 excerpt][API]→V-22_
- [ ] **FR-238** Constraints shown for a child — a child of a freeform frame shows Constraints in Position with Left/Top preselected. An auto-layout child shows them only while it is absolute-positioned. _Data:_ — _Test:_ Select a freeform child, then a flow child, then make the flow child absolute: Constraints appear, disappear and reappear. _M4·P0·[OBS:constraints-note][DOC:360039957734 excerpt][API]_
- [ ] **FR-239** Context menu — right-clicking frames, groups and sections offers the entries in §4.6 (Frame selection, Group selection, Ungroup or Remove frame, Wrap in new section, Convert to frame or section, Resize to fit, Mark as ready for dev) under Figma's conditions and in Figma's order. _Data:_ — _Test:_ Right-click a top-level frame, a nested frame, a group, a section and a multi-selection. Record each menu and match it. _M1·P1·[KNOW][DOC:9771500257687 excerpt][SRC:https://forum.figma.com/t/changing-a-section-into-a-group-or-frame/31994]→V-57_
- [ ] **FR-240** Reparenting in the Layers panel — dragging a row into or out of a container reparents it with the same rules as on the canvas: no sections inside frames or groups, no moves into instances or into a node's own descendants, and absolute positions kept. _Data:_ `parent` _Test:_ Drag a rect row into a frame row: it becomes a child at an unchanged absolute position. Drag a section row into a frame row: refused. _M1·P0·[KNOW]→V-57_
- [ ] **FR-241** Disclosure triangles — the Layers panel's disclosure triangles follow `expanded`. Selecting a nested node on the canvas expands its ancestors as Figma does. _Data:_ `expanded` _Test:_ Collapse a frame, then ⌘-click its child on the canvas: record whether the frame row expands. _M1·P1·[API][KNOW]→V-57_
- [ ] **FR-242** Fixed and scrolling groups — a frame with fixed children shows the fixed and scrolling groupings in the Layers panel (prototyping area). _Data:_ `numberOfFixedChildren` _Test:_ Set 2 children as fixed: the panel shows the split as in Figma. _M7·P2·[API]_

### 6.14 Keyboard shortcuts

- [ ] **FR-243** Tool shortcuts — F and A (Frame) and ⇧S (Section) on macOS and Windows. They are ignored while text is being edited. _Data:_ — _Test:_ Press each key on both platforms, and again while editing text: in text, the keys type characters. _M1·P0·[KNOW][DOC:9771500257687 excerpt]_
- [ ] **FR-244** Structure shortcuts — ⌘G / Ctrl+G Group, ⇧⌘G / Ctrl+Shift+G Ungroup or remove frame, ⌥⌘G / Ctrl+Alt+G Frame selection, ⌘S / Ctrl+S Wrap in new section, ⌥⇧⌘R / Ctrl+Alt+Shift+R Resize to fit. _Data:_ — _Test:_ Trigger each shortcut on each platform with a suitable selection and check the outcome in its item. _M1·P0·[API][SRC:forum.figma.com/t/unframe-selection/46384][SRC:https://forum.figma.com/t/wrap-in-a-section-not-available-in-new-ui3/83232][SRC:https://app.uxcel.com/lessons/frames-in-figma-489]→V-19_
- [ ] **FR-245** Gesture modifiers — Shift (square), ⌥/Alt (from center) and Space (reposition) while drawing; ⌘/Ctrl (ignore constraints) while resizing; Space from pointer-down (no reparenting) while moving. _Data:_ — _Test:_ Covered by the drawing, ignore-constraints and Space-reparenting items; run them on both platforms. _M1·P0·[KNOW][DOC:360039957734 excerpt][SRC:https://forum.figma.com/t/disable-auto-nesting-auto-reparenting-while-moving-objects/799]→V-03_
- [ ] **FR-246** Layout-guide toggle shortcut — ⇧G / Shift+G toggles all layout guides, per the help center. Third-party lists give ⌃G / Ctrl+Shift+4 instead, so the live binding decides. _Data:_ — _Test:_ Press each candidate on each platform and record which ones toggle the guides. _M4·P0·[DOC:360040450513 excerpt][SRC]→V-31_
- [ ] **FR-247** Quick-action names — Quick actions (⌘/ or ⌘K) find "Frame selection", "Wrap in new section", "Toggle clip content", "Resize to fit" and "Layout guides" by name. _Data:_ — _Test:_ Search each name in Quick actions and run it: same effect as the menu command. _M1·P2·[SRC:https://forum.figma.com/t/wrap-in-a-section-not-available-in-new-ui3/83232][KNOW]→V-57_

---

## 7. Cross-area dependencies

| Area | FR needs from it | It needs from FR |
| --- | --- | --- |
| **M0 architecture** (document model, history, renderer, persistence) | Node schema with the §2.1 capability matrix; transactions that group a resize with all constraint-driven changes (FR-189); gesture baselines so ⌘ toggling does not drift (FR-177); a render pass for clipping masks; an overlay layer for labels and guides that export skips; stable node IDs across undo and redo | The container capability matrix (§2.1), the persistence rules (§2.11), the list of Doc vs UI state (§2.10) |
| `01-canvas-selection-transform` (CV) | Click depth and marquee rules (top-level frame background: FR-062 must agree with CV-066), the drag-move gesture with drop-target detection (FR-044 to FR-048), the resize gesture with handle anchoring and the ⌘ bypass, snapping and the "frames always snap to the pixel grid" rule (FR-025), duplicate placement (FR-222 and FR-223 must agree with CV-222), the Scale tool (FR-187), section coordinates (FR-144 must agree with CV-004) | Frame, group and section semantics, frame labels as hit targets, clipping for hit-testing (FR-068), the constraint math applied on resize, layout guides as snap targets (FR-216), section nesting rules |
| `03-auto-layout` (AL) | The flow engine, `layoutPositioning:'ABSOLUTE'`, Hug/Fill/Fixed, insertion of drawn or wrapped frames into the flow (FR-027, FR-078, FR-118), auto layout on frames with guides and clip | The constraint pass for absolute children (FR-154, FR-175), group-as-flow-item (FR-230). ⚠ Conflict: AL §2 says Frame-tool frames default to `clipsContent:true` [KNOW], while FR keeps the default open (FR-072, V-07). The losing document is corrected after V-07 |
| `04-shapes-vectors-booleans` (VC) | Boolean operations and their geometry, shape bounds (layout bounds vs render bounds), lines (height 0) | Boolean groups as constraint-transparent containers (FR-120, FR-121), constraint math for shapes |
| `05-paint-effects-color-export` (PE) | Fills, strokes and effects on frames and sections, the drop-shadow spread rule (FR-070), export bounds and the exclusion of overlays (FR-074, FR-210, FR-225), group composite opacity (FR-110) | Clip content as a render mask, the list of overlays that are never exported |
| `06-text-typography` (TX) | `textAutoResize` changes when constraints or a group resize a text box (FR-109, FR-173) | Text boxes as constraint targets |
| `07-components-variants` (CP) | Instance override rules for constraints, clip and layout guides (FR-186, FR-217, FR-227), component sets as containers (FR-098, FR-156), Create component on a group (FR-228), labels on components (FR-055) | Frame-like semantics of components and instances (FR-226), constraint propagation when an instance is resized |
| `08-variables-styles-design-systems` (DS) | Layout guide styles (`GridStyle`) and their library behavior, variable binding and modes (FR-211 to FR-215, FR-231, FR-232) | The guide fields that can be bound, and the requirement that a width/height variable change propagates constraints (FR-231) |
| `09-prototyping` (PR) | Sections as destinations (FR-152), top-level frames as screens (FR-041), fixed children and overflow (FR-242), the device preset link (FR-036) | Which nodes count as top level (FR-041, FR-053), Clip content as the scroll viewport |
| `10-panels-shortcuts-workflow` (UX) | Layers panel rows, icons and drag reparenting (FR-063, FR-240), the context-menu inventory (FR-239), the Quick actions registry (FR-247), the global shortcut map, the view-options menu | FR's shortcuts (§5) and the inspector layouts (§4). ⚠ Conflict: UX lists the layout-guide toggle as ⌃G / Ctrl+Shift+4 (`[SRC:raycast]`), while the help-center excerpt seen here gives ⇧G. FR-208 and FR-246 hold until V-31 decides, then the losing document is corrected |
| `11-file-format-interop` (IO) | REST/.fig import of `layoutGrids` (flat REST shape, `numSections`), REST constraint names, groups that carry frame traits, `devStatus.type:'NONE'` (FR-008, FR-010, FR-013, FR-014, FR-016) | The exact persisted shape of frames, groups, sections, guides and styles (§2) |

---

## 8. Needs live Figma verification

Every experiment runs in a **disposable fixture file designated by the user**. Never modify the user's real files. For each run, record the platform (macOS or Windows), app (desktop or browser), Figma version, date, zoom and the relevant preferences (Snap to pixel grid, nudge amounts). Where a value is numeric, read it through the Plugin API console as well as the inspector, because the inspector rounds. An item may be marked Validated only after its experiments are written up in a dated observation note in `docs/figma/observations/` and the item text is corrected to match. All `[KNOW]` claims in §2–§5 that affect correctness are covered below.

### 8.1 Experiments

| ID | Setup | Action | Record | Gates items |
| --- | --- | --- | --- | --- |
| V-01 | Empty page, Frame tool active, nothing selected | Expand every preset category, including Archive | Category names and order; every entry's name, W and H; whether any entry has an orientation toggle | FR-032, FR-033 |
| V-02 | (a) Empty page; (b) page with content at (0, 0)–(2000, 1000) and the viewport scrolled elsewhere | Click a Phone preset, then a Desktop preset; open the Prototype tab afterwards | Name, W/H, X/Y of each frame and how they relate to the viewport and existing content; prototype device chosen | FR-034, FR-036 |
| V-03 | New page at 100% and at 800% zoom, Snap to pixel grid off | F and A key test; F + click at a known point; drags in 4 directions; Shift, ⌥ and Shift+⌥ drags; Space mid-drag; draw 3 frames, delete the 2nd, draw again; type W = 0, −5 and 0.001 in the inspector; dump every property via the plugin console | Active tool after creation, selection, X/Y/W/H (incl. sub-pixel inputs), the name sequence, every default property value (fills, clip, constraints, strokes), min-size handling, flyout contents | FR-003, FR-004, FR-019, FR-020, FR-021, FR-022, FR-023, FR-024, FR-025, FR-031, FR-245 |
| V-04 | Page with rects R1 (fully inside the planned area), R2 (half inside), R3 locked inside, R4 hidden inside; a nested frame B in A; an instance; a horizontal auto-layout frame | Draw a frame over R1–R4; start a draw inside B, inside the instance, inside a section; draw between two flow children | Which layers are adopted and in what order; parent of each new frame; its z-index; the auto-layout index and size | FR-026, FR-027, FR-028, FR-029, FR-030 |
| V-05 | Frame A ⊃ frame B; a page-level 200-wide rect; locked frame C; a section | Drag the rect so that the pointer is in B while most of the rect is outside it, and the reverse; drag a child out onto the canvas and onto the section; hold Space before pointer-down, then press it only mid-drag; drag over C | Parent after each drop; z-index in the new parent; whether Space timing matters | FR-044, FR-045, FR-046, FR-047, FR-048 |
| V-06 | A top-level frame with children; an empty top-level frame | Click, then drag, on the empty background of each; ⌘-click | Selection and whether a marquee starts. Run together with the canvas spec's V-19 | FR-062 |
| V-07 | New file | Create frames by F + click, F + drag, preset, ⌥⌘G on 2 rects, and group → frame conversion; run "Toggle clip content" on 3 frames with mixed states | Clip content state and fills of each new frame; the toggle's result on the mixed selection | FR-071, FR-072, FR-079 |
| V-08 | A clipping frame (radius 40, smoothing 0.6) with an oversized child, a drop shadow on the frame, and a nested overlapping clipping frame | Export at 1×; click on the clipped-out part of the child; select the child | Pixel output; what the click selects; the child's selection box and W/H; whether the shadow is clipped | FR-064, FR-065, FR-067, FR-068, FR-069 |
| V-09 | A frame with clip off and a child 50 px outside it | Export as PNG, SVG and PDF | Output dimensions and whether the overflow is included | FR-074 |
| V-10 | A child of frame A plus a page-level rect; children 2–3 of a 4-child auto layout | ⌥⌘G and ⌘G on the mixed-parent selection; ⌥⌘G on the auto-layout children | Availability; the new container's parent, index and bounds; each layer's parent and absolute position | FR-075, FR-077, FR-078, FR-102 |
| V-11 | A single group "Card" with 2 children | ⌥⌘G | Resulting tree (converted vs wrapped), name, fills, clip | FR-080 |
| V-12 | A selected frame with 2 children | Press ⇧⌫, ⌘⌫ and (Windows) Ctrl+Shift+Backspace | Whether each removes the frame and keeps the children, or deletes everything | FR-089 |
| V-13 | A 400 × 400 frame at (0, 0) with children at local (50, 60)–(250, 160), one Right/Bottom; plus a hidden child far outside it, a child with a 10 px outside stroke and a shadow; then rotate the frame 30° | Resize to fit, before and after rotation | Frame X/Y/W/H and matrix; each child's absolute transform; whether hidden, stroke or effect extents count | FR-090, FR-091, FR-092 |
| V-14 | 3 freeform frames; an auto-layout frame; a group; a section with 2 frames; a component set with spread-out variants | ⌥⇧⌘R on each, alone and as a multi-selection; look for the command in the Design panel and the context menu | Availability per node type; the resulting bounds; the section padding (px per side); UI3 placement of the control; undo steps | FR-093, FR-095, FR-096, FR-098, FR-099, FR-235 |
| V-15 | A group of 2 rects 300 px apart | Hide one rect, then show it | Group X/Y/W/H in each state | FR-104 |
| V-16 | A group of 2 rects rotated 45° | Move one child by (+50, 0) | Group rotation, X/Y, W/H and matrix | FR-105 |
| V-17 | A group containing a frame (with a Right child), a text layer (auto width) and a rect with a 4 px stroke | Double the group's width with the W field, then with a handle | Each descendant's box; the frame child's position; font size; text resize mode; stroke weight | FR-108, FR-109 |
| V-18 | A group at 50% opacity with a shadow and blend mode Multiply; a 3-level nested group; an auto layout [A, G(B, C), D] | Ungroup each; select 2 groups and a rect and ungroup | Children's opacity, effects and blend mode; levels removed per press; flow order; undo steps | FR-116, FR-117, FR-118, FR-230 |
| V-19 | Empty page; 2 top-level frames spanning (0, 0)–(1000, 800); one lone frame | ⇧S + click; ⌘S with 2 frames, with 1 frame and with nothing selected; context-menu Wrap in new section; the panel's "…" menu; Quick actions | Section size, name and tool state on click; the wrapped section's bounds (padding) and z-index; which entry points exist; ⌘S behavior in each selection state | FR-123, FR-125, FR-126, FR-244 |
| V-20 | A section S, a frame F, a group G | Drag S into F; Frame selection and Group on {S, rect}; copy S, select F and paste; paste S with a nested frame selected | Refusal vs relocation; any message; S's final parent | FR-076, FR-101, FR-129, FR-130, FR-224 |
| V-21 | A section S1, a nested section S2 holding frame F, page-level rects | Move S1 over a rect to 50%, 99% and 100% coverage; resize S1 over a rect; nudge a rect into S1 with → ; drag F out; drag S2 into and out of S1; shrink S1 until a child is fully outside it | Parent after each step; the nudge at which reparenting happens; whether shrinking releases children | FR-131, FR-132, FR-133, FR-134, FR-135, FR-136, FR-137 |
| V-22 | A section | Inspect the Appearance area; try to set a corner radius | Whether a radius control exists for sections | FR-141, FR-237 |
| V-23 | A section with children | Click the title; drag the title; click empty space inside the section; drag from empty space inside it | Selection and whether the section moves or a marquee starts | FR-143, FR-145 |
| V-24 | A fixture with `sectionContentsHidden:true` made through the Plugin API | Open it in Figma Design | Whether the contents are hidden and which UI control (if any) toggles it | FR-146 |
| V-25 | A 400 × 300 frame with five children (x = 40, w = 100), one per horizontal constraint; a STRETCH child with 40 px margins in a 200-wide frame; a Scale child; a hidden and a locked Right child | Widen to 600 with the W field; drag the left handle to −200; shrink the STRETCH frame to 60 and back; resize 300 → 301 | Plugin read-outs of x and w for every child at each step (no rounding expected); world positions under left-handle drags; STRETCH clamping | FR-159, FR-160, FR-161, FR-162, FR-165, FR-166, FR-167, FR-171 |
| V-26 | A component set with a variant set to Right | Widen the set | Whether the variant moves and whether the Constraints control is shown | FR-156 |
| V-27 | A section with a direct child rect; a child set to Right/Bottom | Select the section child; drag the Right/Bottom child to the page and back into a frame | Whether Constraints shows for section children; whether stored values survive the round trip | FR-155, FR-157 |
| V-28 | An aspect-locked 100 × 50 child with Scale/Top | Widen the frame 2× | Child W/H | FR-170 |
| V-29 | A rect rotated 30° with Left & Right; a frame rotated 30° with a child at local (10, 10) | Widen the frame by 100; read the child's X/Y | Child W/H, rotation, matrix; displayed X/Y | FR-051, FR-172 |
| V-30 | Auto-width text with Left & Right; a horizontal line with Top & Bottom | Widen, then heighten the frame | `textAutoResize` after the resize; line height and Y | FR-173, FR-174 |
| V-31 | Frames with guides in file A and file B | Toggle from the view menu; press ⇧G, ⌃G and (Windows) Ctrl+Shift+4; switch files; reopen; restart | Which keys toggle; whether the state is per file, per user or per session; per-guide `visible` unchanged; the effect of hidden guides on constraints | FR-017, FR-208, FR-246 |
| V-32 | A 1200-wide frame with 12 Stretch columns (margin 20, gutter 20); child spanning columns 3–5 with Left & Right; separate children with Left, Right, Center and Scale; then the same with Center-aligned columns; then 2 Stretch column guides with different counts; then with the guide hidden | Resize the frame to 1440 and 900 | Child X/W against column edges for each constraint; which guide wins; effect of hiding; behavior when the child starts in a gutter | FR-179, FR-180, FR-181 |
| V-33 | A child with Left inside a frame | Use each align command (left, center, right, top, middle, bottom) and the distribute commands | Constraints after each command | FR-185 |
| V-34 | A component with a Right icon, clip on and a column guide; an instance of it | On the instance, change the icon's constraints, toggle clip, change the guide count; then edit the main component | Which overrides are allowed and whether they survive the component update | FR-186, FR-217, FR-227 |
| V-35 | Frames 105 × 55 (grid 10), 100 wide (12 Stretch columns, margin 20, gutter 20), 500 and 510 wide (Left columns of 60, gutter 20, Auto count) | Render; open the Count dropdown under each alignment | Line and track positions; rendering with track size ≤ 0; the Auto track count; whether Auto is offered for Stretch | FR-193, FR-196, FR-200 |
| V-36 | A fresh frame | Click +; switch to Columns, Rows, back to Grid and to Columns; set Left with width 80, switch to Stretch and back; add 3 guides; open the settings for every pattern × alignment | Every default value (size, count, alignment, gutter, margin, color); whether the width 80 is restored; list position of new guides; field list per alignment, especially whether Gutter exists for Left/Right/Center (a help excerpt suggests Stretch-only) | FR-011, FR-192, FR-194, FR-202, FR-203, FR-205 |
| V-37 | A frame with Stretch columns and one with a uniform grid | Drag and resize rects near column edges and grid lines | Snapping targets and threshold | FR-216 |
| V-38 | Frames F1–F5 in a row, 100 px apart; a nested rect; a frame with every §2 property set | ⌘D on F2; ⌘D on the nested rect; copy the frame and paste it onto another page | Copy positions and gaps; properties of the pasted subtree, including dev status | FR-221, FR-222, FR-223 |
| V-39 | A frame with 2 guides and a linked guide style; an empty frame | ⌥⌘C on the first, ⌥⌘V on the second | Whether the guides and the style link are pasted | FR-218 |
| V-40 | A section with a title and children; a frame with visible guides | Export the section and the frame as PNG and SVG | Whether the section title is drawn; whether guides or labels appear | FR-225 |
| V-41 | Number variables `cols` (12/4) and `w` (375/768) across 2 modes; a frame with W bound to `w`, a Right child and a column guide bound to `cols` | Switch the frame's mode | Frame width, child position (constraints applied?) and column count | FR-215, FR-231 |
| V-42 | A child with Right/Bottom | Select it; resize its parent | Any on-canvas constraint indicator, and when it shows | FR-188 |
| V-43 | Inside a frame: a group of 3 rects with different constraints (one in a nested group); a boolean of 2 rects | Select the group and then the boolean; read the Position section; set horizontal to Right | Whether the controls appear and show Mixed; every descendant's constraints afterwards; the group/boolean inspector section list | FR-112, FR-121, FR-236 |
| V-44 | Group "Card" (50% opacity, shadow); a 400 × 400 frame with fills, guides, clip and auto layout, whose children cover 100 × 100; a section with a blue fill and Ready for dev; a section containing a section; a frame that is a prototype destination; group "Btn" | Convert each through the container dropdown and "Convert to …"; run ⌥⌘K on "Btn"; read node IDs before and after | Name, bounds, fills, clip, opacity, effects, dev status and ID after each conversion; prototype-link survival; header dropdown entries | FR-081, FR-082, FR-083, FR-084, FR-086, FR-087, FR-228, FR-234 |
| V-45 | A frame marked Ready for dev; a bound variable and an applied style inside it; a library instance inside it | Change a fill; change the variable's value; update the library; hover an auto-layout child in a prototype preview; click the status, enter "copy fix" and choose Done with changes | When Changed appears; the `devStatus` read-out at each step; the stored description | FR-150 |
| V-46 | Empty page in light and in dark theme | Create a section in each | `fills` and `strokes` via the API | FR-127 |
| V-47 | A frame on the page, in a section and nested; a component and an instance at top level; a top-level frame then grouped | Inspect labels; check the Ready-for-dev action, bolding and prototype starting-point eligibility for the frame in the section | Which nodes get labels; whether frames in sections behave as top level in each respect | FR-041, FR-053, FR-054, FR-055 |
| V-48 | A section with 2 frames, with the section much larger than its content | Double-click each corner handle, then an edge midpoint | Resulting bounds and padding | FR-097 |
| V-49 | Three top-level frames in a row, 100 px apart | With the Frame tool active, hover the first frame and click its + | Whether the + exists; the copy's position, gap and name; the neighbors' new X | FR-040 |
| V-50 | A 375 × 812 frame with a Right child | Look for an orientation toggle in UI3 (preset dropdown, Frame-tool panel); use it if present | Whether the control exists; the swapped size; whether constraints applied | FR-038 |
| V-51 | Top-level frames F and G, with F fully covered by an image child; rect R selected | Click F's label; Shift-click G's label twice; drag F's label; double-click and rename, then press Esc, then commit an empty name; hover; zoom 10–800%; export F | Selection after each step; movement; name; label size and truncation; export content | FR-057, FR-058, FR-059, FR-060, FR-061 |
| V-52 | 5 siblings; a single rect; a frame ⊃ group ⊃ rect | ⌘G on the 2nd and 4th siblings; ⌘G on the single rect; click, double-click, ⌘-click the nested rect | Group name, index, children order, selection; whether a single node can be grouped; click depth | FR-100, FR-119 |
| V-53 | A section at (500, 500) with a rect at absolute (520, 530) | Read the inspector X/Y and the plugin `x`/`y`, `relativeTransform` | Whether a section is a coordinate container. Run together with the canvas spec's V-04 | FR-144 |
| V-54 | A frame with a Right child | Start a handle resize and toggle ⌘ three times before release; type W + 100 with and without ⌘ held | Final child geometry vs a single-state gesture; whether ⌘ affects typed edits | FR-177, FR-178 |
| V-55 | Children A (Left/Top) and B (Right/Bottom) | Open both dropdowns; click, Shift-click and center-click the pin diagram; select A and B and set horizontal to Center | Option lists and labels (exact vertical STRETCH label); diagram results; Mixed display; untouched axis | FR-182, FR-183, FR-184 |
| V-56 | A frame with 20 constrained descendants; a guide with a scrubbable gutter; every operation in FR-220 | Perform each operation, then Undo and Redo once | Number of undo steps; whether the document matches the before and after snapshots, IDs included | FR-189, FR-219, FR-220 |
| V-57 | A tree with frames, groups, sections, components, instances and auto-layout frames | Inspect icons and bolding; drag rows into and out of containers (incl. a frame onto its own child and a section onto a frame); collapse a frame and ⌘-click its child on the canvas; expand a row and Undo; save and reopen; right-click each node type and a multi-selection; search Quick actions for each FR command | Icons; reparent results and refusals; auto-expansion; whether expansion persists and is undoable; menus; Quick-action names | FR-018, FR-050, FR-063, FR-239, FR-240, FR-241, FR-247 |
| V-58 | A rotated frame containing a nested frame, each with a guide; clip off on the outer frame | Inspect the rendering; export PNG, SVG and PDF; present | Guide z-order, clipping to the frame, rotation; absence from all outputs | FR-209, FR-210 |
| V-59 | A guide style applied to 3 frames | Edit the style's count; edit a guide on one linked frame directly; detach on another | Updates to linked frames and undo steps; whether a direct edit detaches; detached values | FR-212, FR-213 |

### 8.2 Open conflicts to resolve first

1. **Clip content default (V-07).** In February 2024 the forum said all new frames clip. A September 2025 feature request implies that Frame-tool frames no longer clip by default. The auto-layout spec assumes `true` [KNOW]. Correct whichever document loses.
2. **Constraints on groups (V-43).** One help excerpt says "you can't apply constraints to groups"; another says that applying them to a group applies them to its layers, and the plugin docs agree. FR implements write-through, and V-43 confirms the UI3 controls.
3. **Layout-guide toggle shortcut (V-31).** The help-center excerpt gives ⇧G. Third-party lists, which the UX spec follows, give ⌃G / Ctrl+Shift+4. Bind both only if Figma does.
4. **Gutter on fixed alignments (V-36).** The Plugin API has `gutterSize` on every ROWS/COLUMNS guide, and the geometry needs it. One help-center summary called gutter "Stretch-only". FR follows the API until V-36.
5. **Section default fill (V-46).** The forum reports both grey and white.
6. **Section padding for Resize to fit (V-14).** Reports give 100 px and 80 px.
7. **Frame labels in sections (V-47).** One forum reply disputes the "top-level only" rule.
8. **Top-level frame background click (V-06).** This must agree with the canvas spec's CV-066 and its V-19.

---

## 9. Sources

### 9.1 Official Figma Help Center articles

All of these were seen **only as WebSearch summaries or excerpts**. help.figma.com is DNS-blocked here, so no article body was read in this session. IDs are from `old/docs/figma/source-catalog.md` (retrieved 2026-09-27), except where marked.

| ID | Title | Used for |
| --- | --- | --- |
| 360041539473 | Frames in Figma Design | Preset categories (mirror), changing presets applies constraints, top-level frames bold and labelled, Resize to fit as a panel action, nested frames, quick-add + (excerpt recorded by the canvas spec) |
| 360039832054 | The difference between frames and groups | Grouping with ⌘G; frames vs groups |
| 9771500257687 | Organize your canvas with sections | ⇧S, Wrap in new section, nesting rules, ways to add objects, title rename, fill/stroke, Ready for dev |
| 16194160540567 | Use sections in prototyping | A section destination navigates to the last-visited frame |
| 26781702258583 | Dev Mode statuses and notifications (not in the catalog; title from the excerpt) | Where the status control sits, Remove status, Changed and its exclusions, Done with changes, COMPLETED plan gating, marking does not lock |
| 360039957734 | Apply constraints to define how layers resize | Default Left/Top, the semantics of each constraint, the Scale example, ⌘/Ctrl bypass, none outside frames, groups apply to their layers |
| 360039957934 | Combine layout guides and constraints | Stretch vs fixed guides decide whether constraints use columns; computed stretch width |
| 360040450513 | Create layout guides | Types, default uniform grid on add, Count/Auto, red 10% tint, global toggle (view menu, ⇧G, "all layout guides in a file"), hidden guides keep working, per-guide visibility, variables |
| 360038746534 | Create color, text, effect, and layout guide styles | Title only: layout guide styles exist |
| 4412765442967 | Copy and paste properties between layers | Title only, for V-39 |
| 21158597546391 | Set prototype device and background settings (not in the catalog) | A frame preset selects a matching prototype device |
| 360041065034 | Adjust your zoom and view options | Frames, sections and components always snap to the pixel grid (excerpt recorded by the canvas spec) |

### 9.2 Figma Plugin API typings v1.141.0 (`refs/_figma_plugin-typings/package/plugin-api.d.ts`)

| Line(s) | Symbol | Used for |
| --- | --- | --- |
| 1069–1086 | `createFrame` | "similar to using the F shortcut followed by a click"; white background, 100 × 100 |
| 1301 | `createSection` | Sections can be created |
| 1477, 1517 | `createGridStyle`, `getLocalGridStylesAsync` | Layout guide styles |
| 1861–1879 | `group()` | Non-empty groups, no instance children, ≈ ⌘G, keeps absolute positions, default index = topmost |
| 1949–1959 | `ungroup()` | ≈ ⇧⌘G, children move to the parent, selection rule |
| 4311, 4354 | `DropShadowEffect.spread` / `InnerShadowEffect.spread` | Spread needs visible fills and `clipsContent` on frames |
| 4632–4639 | `ConstraintType`, `Constraints` | Enum values |
| 4993–4996 | `Guide` | Frame ruler guides (out of scope, round-trip only) |
| 5000–5061 | `RowsColsLayoutGrid`, `GridLayoutGrid`, `LayoutGrid` | Layout guide schema, Infinity = Auto, ignore rules, `visible` default true |
| 5691–5694 | `DevStatus` | READY_FOR_DEV / COMPLETED, description |
| 6571–6580 | `DevStatusMixin` | Where a status can be set |
| 6952–6953 | `VariableBindableLayoutGridField`, `VariableBindableGridStyleField` | Bindable guide fields |
| 7225–7234 | `ConstraintMixin` | Groups and booleans have no constraints; resizing a frame applies their children's |
| 7447–7472 | `resize`, `resizeWithoutConstraints` | Recursive constraints, the 0.01 minimum, the auto-layout parent note |
| 7487–7534 | `AspectRatioLockMixin`, `targetAspectRatio` | Lock honored by constraints |
| 7580, 7607 | `isMask`, `expanded` | Mask scoping, Layers-panel disclosure |
| 7686 | `layoutMode` | NONE/HORIZONTAL/VERTICAL/GRID |
| 8522 | `layoutPositioning` | ABSOLUTE children use constraints |
| 9360–9368 | `DefaultShapeMixin` | Booleans carry no `ConstraintMixin` |
| 9372–9431 | `BaseFrameMixin`, `DefaultFrameMixin` | `layoutGrids` (9400), `gridStyleId` (9406), `clipsContent` (9414), `guides` (9418), `detachedInfo` |
| 10534 | `explicitVariableModes` | Variable modes on containers |
| 10758–10783 | `FrameNode`, `GroupNode` | Capability matrix |
| 11117, 11142, 11186, 11259 | `ComponentSetNode`, `ComponentNode`, `InstanceNode`, `SlotNode` | Frame-like containers |
| 11284–11297 | `BooleanOperationNode` | Capability matrix |
| 12256–12290 | `SectionNode` | Mixins, `sectionContentsHidden` (12273), resize without constraints |
| 12618–12632 | `GridStyle` | Style schema and bindings |

### 9.3 Figma REST API types v0.44.0 (`refs/_figma_rest-api-spec/package/dist/api_types.ts`)

| Line(s) | Symbol | Used for |
| --- | --- | --- |
| 172–200 | `HasLayoutTrait` (`constraints?`, `preserveRatio`) | REST constraints on nodes |
| 358–390 | `HasFramePropertiesTrait` | `clipsContent`, `layoutGrids` ("GROUP nodes do not have this attribute") |
| 785–798 | `DevStatusTrait` | NONE / READY_FOR_DEV / COMPLETED |
| 804 | `FrameTraits` | Shared frame schema |
| 960–974 | `SectionNode` | `sectionContentsHidden`, dev status |
| 976–988 | `FrameNode`, `GroupNode` | A group typed as `FrameTraits` |
| 1689–1713 | `LayoutConstraint` | REST constraint names |
| 1743–1802 | `LayoutGrid` | Flat layout-grid shape, `numSections` binding |

### 9.4 Prior Illigma material (context only)

- `old/docs/figma/observations/2026-09-27-live-figma.md` `[OBS]`: the frame inspector section order, Freeform, the Clip content checkbox (checked on the observed frame) and the auto-layout container controls.
- `old/docs/figma/features/responsive-constraints.md` `[OBS:constraints-note]`: the constraint menu options, Left/Top defaults, the pin diagram, and a summary of the full constraints article as retrieved on 2026-09-27.
- `old/docs/figma/source-catalog.md`: the article IDs and titles above.

### 9.5 Web sources (`[SRC]`, seen only as search excerpts)

- Figma best practices, groups vs frames: https://www.figma.com/best-practices/groups-versus-frames/ ; Figma blog: https://www.figma.com/blog/groups-vs-frames/
- Plugin docs, GroupNode: https://developers.figma.com/docs/plugins/api/GroupNode
- Forum threads: unframe selection (46384); Frame selection shortcut (54782); disable auto-nesting (799); option to hide frame labels (10420); pin/customize frame presets (50212); Clip content on by default (45504); unchecking Clip content by default (18903, 2021); Toggle clip content quick action (March 2024 community-support reply); preserve the group name on ⌥⌘G (15688); changing a section into a group or frame (31994); section in a frame (36868); converting a group to a frame with the Plugin API (35735); no Resize to fit for auto layouts (40657); resize group or frame to contents (27575); Resize to fit in sections (32400); double-click a section corner (51531); Wrap in a section in UI3 (83232); ⌘S on a single object (46600); UI3 removed auto-create section (90156); default section colours (35557); unable to mark ready for dev (54825); make it harder to select and move sections (69436, 14735); constraints not showing in the right panel (8037); nested element size when resizing a parent (1166); alignment shortcuts changing constraints (23298); default frame spacing (2306); ordering of top-level frames (21673); April 2025 release-notes livestream (39496).
- Tutorials: uxcel layout grids (https://uxcel.com/lessons/layout-grids-439); uxcel frames (https://app.uxcel.com/lessons/frames-in-figma-489); uxplanet Config 2023 tips; trupeer and skyeng.ru tutorials; FrontendMasters course excerpt; Raycast Figma-shortcuts extension (third-party shortcut list).
- Searches made in pass 3 (2026-10-08): the frame preset list (no official list found; Archive category and device-preset link confirmed); help on group constraints; layout-guide column defaults (no official defaults; the `figma-grid` npm package's 5/20/0 Stretch values are that library's, not Figma's); the Clip content default in 2025 (no release note; forum only); the frames article (no body text); the layout-guide toggle shortcut (⇧G per help); section selection (forum reports).
