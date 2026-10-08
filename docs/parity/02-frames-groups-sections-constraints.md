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
> **Research limitations (stated plainly).** help.figma.com, figma.com and framer.com could not be fetched; the proxy refused the connection. Official articles were seen only as WebSearch excerpts. Partway through the research, the WebSearch budget shared by all parallel agents ran out, so several planned confirmation searches never ran: preset catalog, Resize to fit placement, group→frame conversion, drag-reparent modifiers, section defaults and others. These behaviors are tagged `[KNOW]` and listed in §8. No video was watched, and no live Figma interaction was performed for this document.

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
- Dev Mode as a product. Illigma has no Dev Mode, but `devStatus` is document data and must be preserved and editable (see FR-150 to FR-152).

### 1.3 Local-first notes

- Frame presets are a static, built-in catalog. Illigma ships it offline. The node data model holds **no** preset identifier: a preset only sets width and height, and usually the name. `[API]` (no preset field exists on `FrameNode`)
- Dev status, "Changed" detection and status descriptions are stored on the node. Multiplayer notification behavior is out of scope.
- Show/hide layout guides, frame-label rendering and preset panel state are editor UI state, not document data (see §2.10).

### 1.4 Terminology (Figma terms)

| Figma term (UI3) | API / data | Meaning | Not to be confused with |
| --- | --- | --- | --- |
| Frame | `FRAME` | Container with its own fixed size, fills, strokes, effects, corner radius, optional clipping, layout guides, auto layout and prototyping settings. Size is independent of its content. `[API]` `[DOC:360041539473 excerpt]` | An Illustrator artboard. A Figma frame can be nested at any depth `[SRC:https://www.figma.com/best-practices/groups-versus-frames/]` |
| Top-level frame | `FRAME` whose parent is a page (or a section, see FR-040) | Shows a name label on the canvas and is bolded in the Layers panel `[DOC:360041539473 excerpt]`. In prototypes it acts as a screen `[KNOW]` | A nested frame |
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
| Wrap in new section | (context-menu command) | Wraps the selection in a new section `[DOC:9771500257687 excerpt]` | Frame selection |
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
| `clipsContent` | boolean | **unverified**: believed `true` for Frame-tool frames `[KNOW]` (see §8 V-07) | – | Doc |
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

`relativeTransform` (and so the inspector's X/Y) is relative to the **container parent** (page, frame, component or instance). It is **not** relative to a group or boolean parent. Groups and booleans resize to fit their children, so their transform is derived. Absolute position is the product of container transforms, skipping groups and booleans. Section children: see FR-145 (unverified whether a section acts as a coordinate container in the UI).

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
| Layout guide color | red at 10% opacity | `[SRC:https://uxcel.com/lessons/layout-grids-439]` (third-party) |
| Uniform grid size | 10 | `[KNOW]` |
| Columns/Rows when first chosen | count 5, Stretch, margin 0, gutter 20 | `[KNOW]` |
| Layout guide visible | true | `[API]` ("Defaults to true") |
| `layoutMode` | NONE (Freeform) | `[API]` |
| Group/frame/section names | "Group N" / "Frame N" / "Section N" | `[KNOW]` |

### 2.10 Document data vs. transient UI state

| Document (persist, undoable, copy/paste) | Transient UI (not undoable, not in document export) |
| --- | --- |
| Everything in 2.2–2.8, including `layoutGrids[i].visible` and `devStatus` | Global "Layout guides" view toggle (show/hide all) `[DOC:360040450513 excerpt]`. Whether it persists per file or per user is unverified (V-31) |
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
7. **Presets.** While the Frame tool is active, the right sidebar lists frame presets grouped by category `[DOC:360041539473 excerpt]`. The categories are believed to be Phone, Tablet, Desktop, Presentation, Watch, Paper, Social media, Figma Community and Archive `[KNOW]`. Clicking a preset creates a frame of that exact size, named after the preset `[KNOW]`. Where it is placed (beside existing content, or at the viewport center) is unverified: V-02.
8. **Changing the preset of an existing frame** (selected frame → frame preset dropdown at the top of the Design panel) sets the frame's width and height to the preset's. **Children's constraints are applied**; layers with default Left/Top constraints keep their size and position. `[DOC:360041539473 excerpt]`
9. **Orientation swap** (portrait/landscape) swaps width and height through the same constraint-applying resize. `[KNOW]`, and its presence in UI3 is unverified.
10. **No preset identity is stored.** After creation, a preset frame is an ordinary frame. `[API]` (absence of a field)

### 3.2 Frame structure, nesting & reparenting

- Frames can contain any layer type **except** sections (and pages) `[DOC:9771500257687 excerpt]`, and they nest to any depth `[SRC:https://www.figma.com/best-practices/groups-versus-frames/]`.
- A frame's bounds never follow its content. Children may extend outside the frame, and resizing a frame never adds or removes children. `[DOC:360041539473 excerpt]` `[KNOW]`
- **Drag-reparenting (canvas):** when a moved layer is dropped so that the drop location is inside a different frame, it becomes a child of the deepest eligible frame there. When it is dropped outside its frame, it moves to the next container (section or page). The absolute transform (position and rotation) is preserved; the layer is appended at the top of the new parent's z-order. `[KNOW]` Whether the decision uses the pointer position or the layer's bounds, and whether a modifier suppresses reparenting, is unverified: V-05.
- Instance sublayers cannot be reparented, and nodes cannot be moved into an instance. `[API]` (`group` doc: "cannot include any node that cannot be reparented, such as children of instances")
- A container cannot be moved into its own descendant (cycle prevention). `[KNOW]`
- Frames can be rotated. Children rotate with the frame, and constraints are evaluated in the frame's local, unrotated space. `[API]` (rotation), `[KNOW]`

### 3.3 Frame labels & selecting frames on the canvas

- Name labels are drawn for **top-level frames** only `[DOC:360041539473 excerpt]`. Nested frames have no label, and wrapping a labelled frame in another frame removes its label `[SRC:https://forum.figma.com/suggest-a-feature-11/option-to-hide-frame-labels-10420]`. Frames directly inside sections keep their labels `[SRC:https://forum.figma.com/suggest-a-feature-11/option-to-hide-frame-labels-10420]` `[KNOW]`. Components and instances at the top level also show labels `[KNOW]`.
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
- With a single **group** selected, whether Figma converts the group into a frame (keeping its name) or wraps it is unverified: V-11.

**Remove frame = Ungroup (⇧⌘G / Ctrl+Shift+G) on a frame** `[SRC:https://www.figma.com/best-practices/groups-versus-frames/]` `[API]` (`ungroup`):

- The children move into the frame's parent at the frame's z-index, keeping their order and absolute transforms. The frame is deleted along with its fills, strokes, effects, layout guides, clip, auto layout and prototype settings. The children's own constraints are kept as values. If the frame was selected, the selection becomes its children.
- Alternative shortcuts (⇧⌫ / ⌘⌫) are only reported by third-party or forum sources; see V-12.

**Resize to fit (⌥⇧⌘R / Ctrl+Alt+Shift+R `[KNOW]`; also available as a properties-panel action `[DOC:360041539473 excerpt]`):**

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
- It does not apply to auto-layout frames (use Hug), groups (already fitted) or sections (V-14). `[KNOW]`

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
- Context menu → **Wrap in new section** wraps the current selection. Its keyboard shortcut (believed ⌥⌘S / Ctrl+Alt+S) and whether the new section is padded around the selection are `[KNOW]` (V-19).
- The click-without-drag default size and the default fill and stroke are unverified (V-19).

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
- Whether clicking an empty area of a section selects it or starts a marquee is unverified (V-23).
- `sectionContentsHidden` (from FigJam's "Hide section" feature) is document data. Its UI exposure in Figma Design is unverified (V-24). Illigma must round-trip the flag.

**Dev status** `[DOC:9771500257687 excerpt]` `[DOC:26781702258583 excerpt]` `[API]`

- **Mark as ready for dev** sets `devStatus = {type:'READY_FOR_DEV'}`. The status can be removed from the overflow menu on the status label, and Figma's two articles word that menu item differently ("Remove ready status" vs "Remove status"). `COMPLETED` is the other value.
- Editing marked content changes the shown status to "Changed". The user can then acknowledge the change, optionally with a description, which returns the status to Ready for dev. The plan entitlement for this flow is unclear.
- A status can only be set on a node directly under a page or section, and never inside a node that already has a status.

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
- The global toggle is UI state only.

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
- Multiple guides per frame are allowed and kept in list order `[API]` `[SRC:uxcel]`. Where a newly added guide goes in the list, and its default type in UI3, are unverified (V-36).

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
- Duplicating (⌘D) a top-level frame places the copy at an offset beside the original; the exact rule is V-38.
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
| Frame-type / preset dropdown (panel header) | Shows "Frame", or the component and instance equivalents. Lists presets; choosing one resizes with constraints `[DOC:360041539473 excerpt]` `[KNOW]` |
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
- Resize to fit (V-14).
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

## 5. Keyboard shortcuts

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
| Wrap in new section | `⌥⌘S` (believed) | `Ctrl+Alt+S` (believed) | `[KNOW]` (V-19) |
| Resize to fit | `⌥⇧⌘R` | `Ctrl+Alt+Shift+R` | `[KNOW]` (V-14) |
| Ignore constraints while resizing | hold `⌘` | hold `Ctrl` | `[DOC:360039957734 excerpt]` |
| Show/hide layout guides | `⇧G` per help center. Third-party sources: `⌃G` | `Shift+G` per help center. Third-party sources: `Ctrl+Shift+4` | `[DOC:360040450513 excerpt]` `[SRC]` (V-31) |
| Rename selected layer | `⌘R` | `Ctrl+R` | `[KNOW]` (cross-area) |
| Scale tool (contrast with Scale constraint) | `K` | `K` | `[SRC:https://www.figma.com/best-practices/groups-versus-frames/]` |
| Select children / parent | `Enter` / `⇧Enter` (also `\`) | same | `[KNOW]` (cross-area) |
| Quick actions (fallback to run "Frame selection") | `⌘/` or `⌘K` | `Ctrl+/` or `Ctrl+K` | `[SRC:forum 54782]` `[KNOW]` |

Note: on Windows, Chrome's Gemini shortcut can capture `Ctrl+Alt+G` in the browser `[SRC:forum 54782]`. This is irrelevant to a desktop app, but it shows the binding is in use.

