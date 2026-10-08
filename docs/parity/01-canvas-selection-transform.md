# Canvas, navigation, selection & transforms — Figma parity spec

> **Status:** research draft (date 2026-10-08). **Nothing is implemented.** Every checklist item in §6 is status **Not started**. No item may be called "1:1 parity" until it is implemented in Illigma **and** validated against live Figma with the item's test.
>
> **Area:** Canvas, navigation, selection & transforms · checklist prefix `CV` · primary milestone **M1 Core editing** (some items are M0, M2, M4–M8 and say so).
>
> **Rule of precedence:** Figma is the source of truth for every behavior, rule, edge case and data structure here. Framer governs only how the editor *looks*. This document specifies behavior only; it never specifies colors, icons, radii or motion.
>
> **Evidence legend.** Every behavioral claim carries one or more tags:
> - `[API]` — Figma Plugin API typings v1.141.0 (`plugin-api.d.ts`, line refs `P:<line>`) or Figma REST API types v0.44.0 (`api_types.ts`, line refs `R:<line>`). These describe the data model, not UI gestures, unless stated.
> - `[DOC:<article id> excerpt]` — an official Figma Help Center article known only through a WebSearch summary/excerpt in this session. help.figma.com cannot be fetched from this environment, so **no article body was read in full in this session**.
> - `[OBS]` — the 2026-09-27 read-only live-Figma UI observation (`old/docs/figma/observations/2026-09-27-live-figma.md`). It covers inspector sections only, not gestures.
> - `[KNOW]` — the author's prior knowledge of Figma, **not verified in this session**.
> - `[SRC:Sx]` — another web source (forum thread, tutorial, cheat sheet) or a prior Illigma research note (`P1`–`P3`). Aliases resolve to URLs/paths in §9.3.
> - `[REQ]` — an Illigma engineering requirement (robustness, invariants). It is not a claim about Figma.
> - `→V-nn` — the claim, or a numeric detail of it, must be confirmed by live experiment V-nn in §8 before the item can be marked Validated. Every `[KNOW]`/`[SRC]` claim that affects correctness carries such a pointer.
>
> **Research limits of this draft.** The first research pass made sixteen WebSearch queries before the run's shared search budget ran out. A resumed pass on the same day made eight more targeted queries. They added evidence on click depth and double-click, marquee modifiers, the *Select layer* menu, Esc, zoom steps, duplicate offset memory, paste placement and two newer resize-snapping targets; the results are folded into §3, §6 and §9. Marquee containment for top-level frames, most context-menu contents and the cursor set still rest on `[KNOW]` and are routed to §8. **No live Figma file was opened, inspected or modified for this draft.**

---

## 1. Scope & terminology

### 1.1 In scope (owned by this document)

| Sub-feature | Covered behavior |
| --- | --- |
| Coordinate system | Page space, container-parent-relative positions, transforms, bounds, rotation convention, flip and skew representation, precision |
| Viewport | Zoom and pan with every input method, zoom range and steps, zoom to fit/selection/100 %, frame-to-frame zoom, zoom tool, per-page view memory |
| View modes | Pixel grid, snap to pixel grid, pixel preview, outline mode, rulers, hide UI, canvas background, display preferences |
| Pages (canvas side) | Page switching, per-page selection and viewport, page background, page guides, cross-page clipboard. Pages-panel CRUD is owned by `10-panels-shortcuts-workflow` (UX) |
| Hit-testing & hover | Pick order, clipping, hidden/locked exclusion, hairline tolerance, hover highlight |
| Selection | Click, Shift, Cmd/Ctrl deep select, double-click descent, Enter / Shift+Enter / Tab / Shift+Tab / Esc, marquee rules, Select all / inverse / matching / "Select all with same …", the "Select layer" menu, locked/hidden rules, selection invariants |
| Transforms | Move (drag, Shift, Alt-duplicate, reparent on drop), nudge and big nudge, resize (corner/edge handles, Shift, Alt, Cmd, aspect lock, flip-through), multi-selection resize, rotate (Shift 15°), flip, Rotate 90°/180°, the Scale tool (K), numeric fields, rounding, "Round to pixel" |
| Snapping | Object edges/centers, parent edges/center, guides, equal spacing, pixel grid, threshold, temporary suspension, preferences |
| Measurement | Alt/Option redlines, Cmd+Alt nested redlines |
| Arrangement | Align, distribute, Tidy up, Smart selection (spacing and reorder handles), arrange (z-order) |
| Rulers & guides | Rulers, canvas and frame guides: create, duplicate, move, delete, measure |
| Duplicate & clipboard | Cmd+D, Alt-drag, offset memory, copy/cut/paste placement, paste over selection, paste to replace, paste here, copy/paste properties |
| Chrome around gestures | Cursors, canvas context menu, undo/redo granularity of every gesture above |

### 1.2 Out of scope or owned elsewhere

- **Multiplayer** (live cursors, follow, spotlight, cursor chat), comments, branching, sharing and permissions do not apply to a local-first, single-user app. Figma restricts several actions here to "can edit" users. Measurement also works with "can view" access [DOC:360039956974 excerpt]. Illigma treats the local user as an editor. A future read-only mode should copy Figma's split.
- **Dev Mode** persistent measurements and annotations (`MeasurementsMixin.addMeasurement`, Shift+M measure tool) are out of scope. The data shape is noted in §2.9; the feature belongs to M8 if ever added.
- **FigJam, Slides, Buzz**: stickables, `stuckNodes`, `viewport.slidesView/canvasView`.
- **Owned by other area docs** (only dependencies are listed here, §7):
  - Layers-panel structure editing and the pages panel: `10-panels-shortcuts-workflow` (UX).
  - Frame/group/section creation, frame labels, clipping, constraints, layout guides: `02-frames-groups-sections-constraints` (FR).
  - Auto layout flow, reorder-by-drag inside auto layout, sizing modes: `03-auto-layout` (AL).
  - Shape tools, vector edit mode, booleans, flatten, masks: `04-shapes-vectors-booleans` (VC).
  - Paint, effects, export: `05-paint-effects-color-export` (PE).
  - Text editing and text resizing modes: `06-text-typography` (TX).
  - Components, instances, overrides: `07-components-variants` (CP).
  - Variables: `08-variables-styles-design-systems` (DS).
  - Prototyping: `09-prototyping` (PR).
  - File format and external clipboard interop: `11-file-format-interop` (IO).
- **AI features**, the actions menu / quick actions search (shell, UX) and plugins are not covered.

**Local-first adaptations, decided here** [REQ]:

- Figma keeps zoom/scroll per browser tab per file. "Zoom changes … only apply in the current tab" [DOC:360041065034 excerpt]. Illigma stores viewport per window, per page, in workspace state. That state is never in the document, never synced and never undoable.
- Figma stores `PageNode.selection` per page and per user [API P:10590-10614]. Illigma persists per-page selection in workspace state, not in the shareable document.
- Preferences such as nudge amounts and snapping toggles are per-user in Figma [KNOW]→V-43. Illigma stores them as app preferences.
- Clipboard uses an Illigma-internal lossless payload plus system-clipboard flavors. Interop is owned by IO.

### 1.3 Terminology

| Term (Figma) | Meaning | Commonly confused with |
| --- | --- | --- |
| **Canvas** | The unbounded 2D drawing surface of one page. | The viewport (the visible window onto the canvas). |
| **Page** | A child of the document with its own canvas, layer tree, guides, background, selection and view state [API P:10563]. REST calls it `CANVAS` [API R:875]. | A frame or artboard. |
| **Page divider** | An empty page whose name is all `*`, all en dashes, all em dashes or all spaces. It has no canvas content [API P:10657, P:1137-1145]. | A section. |
| **Viewport** | The visible rectangle of the current page: `center`, `zoom` (1.0 = 100 %), `bounds` [API P:3306-3331]. | Zoom of the UI chrome (interface scale), which is separate [DOC:360041065034 excerpt]. |
| **Top-level layer / frame** | A direct child of the page (or, for frames, of a section [SRC:P5]). Top-level frames act as "artboards" for click depth and marquee [KNOW]→V-18. | Any frame. |
| **Container parent** | The ancestor that X/Y and `relativeTransform` are relative to: page, frame, component, component set or instance. Groups and boolean operations are skipped [API P:7292-7315]. | The direct parent (which may be a group). |
| **Group-like container** | GROUP, BOOLEAN_OPERATION, TRANSFORM_GROUP. Their bounds derive from their children [API P:10768, P:10792]. | Frames, which have their own size. |
| **Selection** | The set of **directly** selected nodes on the current page. It never holds a node together with one of its descendants [API P:10590-10614]. | Hover highlight, or text range selection (TX). |
| **Deep select** | Cmd (macOS) / Ctrl (Windows) + click selects the deepest layer under the pointer [DOC:360040449873 excerpt]. | Vector edit mode (VC). |
| **Marquee** | A rubber-band selection rectangle dragged on the canvas [KNOW]. | The Section tool's drag. |
| **Bounding box** | `absoluteBoundingBox`: the axis-aligned box of the node's geometry, **excluding** strokes and effects [API P:7332]. | **Render bounds** (`absoluteRenderBounds`), which include strokes, shadows and blurs [API P:7342]. |
| **Selection bounds** | The box with handles. For one node it is oriented with the node's rotation; for several nodes it is the axis-aligned union [KNOW]→V-33. | The bounding box of each child. |
| **Resize** | Changes width/height. For frames it applies children's constraints [API P:7444-7457]. | **Scale** (K tool or `rescale()`), which scales the node *and* its stroke weights, effects, radii and text sizes proportionally [DOC:360040451453 excerpt][API P:7476-7482]. |
| **Nudge / big nudge** | Arrow-key move by the small nudge (default 1), or with Shift by the big nudge (default 10) [DOC:4404575206295 excerpt]. | Smart-selection spacing. |
| **Smart guides** | Transient red alignment and spacing feedback while moving or resizing [KNOW]. | **Ruler guides** (persistent `guides` lines) [API P:4993], **layout guides** (layout grids, FR) and the **pixel grid** (a view aid, ≥400 %) [DOC:360041065034 excerpt]. |
| **Snap to pixel grid** | A placement rule: results land on whole document pixels [DOC:360041065034 excerpt]. | Showing the pixel grid, or **pixel preview** (a rasterized display). |
| **Outline mode** ("Show outlines") | A view mode that draws layers as wireframes [DOC:5724448965527 excerpt]. | **Outline stroke**, a geometry operation (VC). The two shortcuts were swapped in 2024 [DOC:5724448965527 excerpt][SRC:S9]. |
| **Smart selection** | A selection of equally spaced layers that overlap on one axis (1D) or both (2D). It exposes spacing and reorder handles [DOC:360040450233 excerpt]. | **Tidy up** (rearranges into an equally spaced row or grid), **Distribute** (equalizes gaps only) and the auto layout gap (a persistent rule, AL). |
| **Paste variants** | Paste; **Paste over selection** (⇧⌘V); **Paste to replace** (⇧⌘R); **Paste here** (context menu); **Paste properties** (⌥⌘V) [DOC:4409078832791 excerpt][DOC:4412765442967 excerpt]. | Each other. Their placement rules differ (§3.22). |
| **Select matching layers** | ⌥⌘A. Selects layers that correspond by name and hierarchy across top-level frames [DOC:21523793229463 excerpt]. | "Select all with same fill/stroke/…" (property-based) [SRC:S12]. |
| **Redlines** | Temporary Alt/Option distance measurements [DOC:360039956974 excerpt]. | Dev Mode measurements, which are persistent annotations [DOC:360039956974 excerpt]. |
| **Locked / hidden** | `locked`: cannot be clicked or dragged on the canvas, but is still selectable in the layers panel [DOC:360041596573 excerpt]. `visible=false`: not rendered or hit-tested, but still a node [API P:6595]. | Each other. |

---

## 2. Data model

Document data is saved in the file and is undoable. Transient UI or workspace state is never saved in the document and never undoable.

### 2.1 Document and page (document data)

| Property | Type / enum | Default / range | Notes | Evidence |
| --- | --- | --- | --- | --- |
| `DocumentNode.children` | `PageNode[]` | ≥ 1 page | Only pages; order = pages panel order. | [API P:10404-10420] |
| `PageNode.type` | `'PAGE'` (REST `'CANVAS'`) | — | | [API P:10567, R:875-878] |
| `PageNode.children` | `SceneNode[]` | [] | Back-to-front: index 0 is bottom-most. | [API P:6972-6976] |
| `PageNode.guides` | `Guide[]` | [] | Canvas-level ruler guides. Read-only array; replace it to change it. The REST `CanvasNode` exposes no guides field, but Illigma's format must persist them (IO). | [API P:10573-10588, R:875-910] |
| `PageNode.selection` | `SceneNode[]` | [] | Per page, per user. Unique, directly selected only, order unspecified, preserved across page switches. | [API P:10590-10614] |
| `PageNode.backgrounds` | `Paint[]` | one SOLID | "Currently only supports a single solid color paint". REST: `backgroundColor: RGBA`. Default value per theme →V-17. | [API P:10645, R:880-883] |
| `PageNode.isPageDivider` | readonly bool | false | True only if the page is empty and its name is a divider name. | [API P:10657] |
| `PageNode.flowStartingPoints`, `prototypeBackgrounds` | — | — | Owned by PR. | [API] |
| `CanvasNode.measurements` | `Measurement[]` | — | Dev Mode only; out of scope. | [API R:909, P:9500-9530] |

### 2.2 Node geometry (document data)

| Property | Type | Default / range | Semantics | Evidence |
| --- | --- | --- | --- | --- |
| `x`, `y` | number | any finite float | Equal to `relativeTransform[0][2]` / `[1][2]`, in **container-parent** space. Computed (read-only) for auto-layout children. | [API P:7239-7254] |
| `width`, `height` | readonly number | ≥ 0.01. LINE height is exactly 0 | Changed only through resize, resizeWithoutConstraints or rescale. | [API P:7255-7262, P:7444-7482] |
| `relativeTransform` | `[[a,c,tx],[b,d,ty]]` (2×3) | identity | Axis vectors have unit length. Scale is never stored here. Skew is possible but not shown in the UI. Relative to the **container parent**, skipping GROUP and BOOLEAN_OPERATION. | [API P:7279-7324, R:1478-1520] |
| `absoluteTransform` | 2×3 | derived | Relative to the page. | [API P:7325-7328] |
| `absoluteBoundingBox` | `Rect \| null` | derived | Excludes strokes and effects. | [API P:7329-7332, R:173-176] |
| `absoluteRenderBounds` | `Rect \| null` | derived | Includes strokes, shadows, blurs. `null` when the node is invisible. | [API P:7338-7342] |
| `rotation` | number (degrees) | (−180, 180] | `atan2(−m10, m00)`. Setting it through the API rotates about the node's **top-left** origin. | [API P:7349-7356] |
| `targetAspectRatio` | `Vector \| null` | null | Set by `lockAspectRatio()` from the current W:H. When set, resizing from canvas, inspector, constraints and auto layout keeps the ratio. `resize()` ignores it and then updates it. Not allowed with auto-resizing text. | [API P:7487-7534, P:7455-7456] |
| `constrainProportions` | bool | — | Deprecated alias. REST: `preserveRatio`. | [API P:7343-7348, R:186-189] |
| `minWidth/maxWidth/minHeight/maxHeight` | `number \| null` | positive | Auto-layout frames and their children only (AL). | [API P:7263-7278] |
| `constraints` | `{horizontal, vertical}` of `'MIN'\|'CENTER'\|'MAX'\|'STRETCH'\|'SCALE'` | MIN/MIN | GROUP and BOOLEAN_OPERATION have none; their children's constraints apply (FR). | [API P:4632-4639, P:7225-7236] |
| `layoutPositioning` | `'AUTO'\|'ABSOLUTE'` | AUTO | ABSOLUTE children of auto layout can be moved freely (AL). | [API P:8495-8522] |
| **Flip** | — (no property) | — | Representable only as a `relativeTransform` with determinant −1 (one axis reflected). Exact UI encoding →V-03. | [API P:7279-7316] (inference) |
| **Variable bindings** | `boundVariables` | — | `width`, `height` and min/max can be bound. `x`, `y` and `rotation` **cannot** (they are absent from `VariableBindableNodeField`). | [API P:6910-6937] |

**Rotated nodes in the inspector.** The inspector shows `x`, `y` (the transform origin, i.e. the rotated top-left corner) and the unrotated `width`/`height`, not the bounding box [API P:7239-7262][KNOW]→V-02.

### 2.3 Node state (document data)

| Property | Type | Default | Semantics | Evidence |
| --- | --- | --- | --- | --- |
| `visible` | bool | true | Stored per node. Effective visibility = AND over the node and all its ancestors. | [API P:6586-6595, R:16-19] |
| `locked` | bool | false | Stored per node. Effective lock = OR over the node and all its ancestors. Blocks canvas selection and dragging, but not property edits. | [API P:6596-6606, R:21-24] |
| `expanded` | bool | — | Layers-panel expansion state of a container (UX). | [API P:7603-7608] |
| `children` order | array | — | Back-to-front. Reparenting goes through `appendChild`/`insertChild`. | [API P:6972-7022] |

Node types this area must handle (Figma Design subset of `SceneNode` [API P:12426-12460]): FRAME, GROUP, SECTION, COMPONENT, COMPONENT_SET, INSTANCE, SLOT, BOOLEAN_OPERATION, VECTOR, STAR, POLYGON, ELLIPSE, RECTANGLE, LINE, TEXT, TEXT_PATH, TRANSFORM_GROUP, SLICE, MEDIA.

- **Sections** use `OpaqueNodeMixin` (x/y/size/relativeTransform) but **not** `LayoutMixin`. They therefore have no `rotation`, no `absoluteRenderBounds` and no constraints. `resize` is the same as `resizeWithoutConstraints`: children are never affected. Other fields: `sectionContentsHidden` [API P:12256-12298].
- **Groups** cannot be empty: `figma.group` requires a non-empty list [API P:1855-1879]. Ungrouping moves the children into the group's parent. If the group was selected, its children become selected [API P:1950-1959].
- **TRANSFORM_GROUP** (Figma Draw repeat) has `transformModifiers` (`LINEAR`/`RADIAL` `REPEAT`, `count`, `unitType`, `offset`) [API P:10792-10816, P:12820-12854]. For selection and transforms it is treated as a group-like container (inference →V-04).
- **SLICE** has position and size but no fills [API P:10817-10826]. It is selectable and movable like other layers [KNOW].

### 2.4 Guides (document data)

| Field | Type | Notes | Evidence |
| --- | --- | --- | --- |
| `Guide.axis` | `'X' \| 'Y'` | Whether `'X'` is a vertical line (constant x) →V-48 | [API P:4993-4996] |
| `Guide.offset` | number | Page guides: page coordinates. Frame guides: offset from the frame's top-left in frame space →V-48 | [API P:4993-4996] |
| `PageNode.guides` | `Guide[]` | Canvas guides | [API P:10573-10588] |
| `BaseFrameMixin.guides` | `Guide[]` | "Each frame has its own guides, separate from the canvas-wide guides". Applies to frames, components and instances. | [API P:9415-9418] |

### 2.5 Viewport (transient workspace state)

| Field | Semantics | Evidence |
| --- | --- | --- |
| `viewport.center` | Page-space point at the center of the visible area | [API P:3307-3310] |
| `viewport.zoom` | 1.0 = 100 %; < 1 zoomed out; > 1 zoomed in | [API P:3311-3320] |
| `viewport.bounds` | Visible page-space rect. Changes with window size and rulers/UI visibility | [API P:3326-3330] |
| `scrollAndZoomIntoView(nodes)` | Fits the given nodes. The typings call it "the equivalent of pressing Shift-1", though Shift-1 is "zoom to fit" (all) and Shift-2 is "zoom to selection" [DOC:360041065034 excerpt]. Illigma implements both commands as specified in §3.2. | [API P:3321-3325] |
| Range | Reported 2 %–25 600 % (2022). A June 2026 thread attributes a zoom-out stop to very large content, and Figma staff said Slides zoom bounds are relative to the window size, so the limits may depend on content and window | [SRC:S2]→V-05 |

### 2.6 Selection (workspace state; see §1.2)

- The set holds unique nodes, never an ancestor together with its descendant. Selecting an ancestor of a selected node removes that descendant ("indirectly selected") [API P:10609-10614, P:551-560].
- Change notifications fire on user action, page switch (always), deletion of a selected node, and a selected node becoming a descendant of another selected node [API P:551-560]. Illigma's internal event bus must emit the same notifications [REQ].

### 2.7 Preferences and view toggles (app / user state)

| Setting | Default | Evidence |
| --- | --- | --- |
| Small nudge / big nudge | 1 / 10 (points; decimals →V-30) | [DOC:4404575206295 excerpt] |
| Snap to geometry | on | [KNOW]→V-43 |
| Snap to objects | on | [SRC:S1]→V-43 |
| Snap to pixel grid | on | [DOC:360041065034 excerpt] (exists); default [KNOW]→V-43 |
| Pixel grid (display) | on (visible only ≥ 400 %) | [DOC:360041065034 excerpt]; default [KNOW]→V-11 |
| Pixel preview | off (options: off / 1× / 2×) | [KNOW]→V-12 |
| Rulers | off | [KNOW]→V-14 |
| Outlines: show outlines / show hidden layers / show object bounds | off / — / — | [DOC:5724448965527 excerpt]→V-13 |
| Use old shortcuts for outlines | off | [DOC:5724448965527 excerpt] |
| Keyboard zooms into selection | off | [KNOW]→V-06 |
| Invert zoom direction | off | [KNOW]→V-07 |
| Use alternate zoom handling | off | [SRC:S2]→V-05 |
| Highlight layers on hover | on | [KNOW]→V-59 |
| Show dimensions on objects | on | [KNOW]→V-59 |
| Hide canvas UI during changes | off | [KNOW]→V-59 |
| Flip objects while resizing | on | [KNOW]→V-32 |
| Rename duplicated layers | off | [KNOW]→V-49 |

### 2.8 Undo model

- The Plugin API exposes explicit undo checkpoints. Actions between checkpoints undo together [API P:274-298].
- In the UI, each completed gesture or command is one checkpoint [KNOW]→V-56.
- Illigma: every document mutation runs inside a transaction. A pointer gesture opens one transaction at pointer-down and commits it at pointer-up, or rolls it back on Esc or lost capture [REQ].

### 2.9 Out-of-scope data noted for completeness

`Measurement {id, start{node, side}, end{node, side}, offset: INNER{relative}|OUTER{fixed}, freeText}` and `MeasurementSide` (Dev Mode) [API P:9500-9530]. Annotations are owned by UX/PR.

---

## 3. Behavior specification

### 3.1 Coordinate system and the infinite canvas

1. **Axes and units.** X grows rightward and Y grows downward. 1 unit = 1 px at 1× export. Each pixel-grid cell is one exported pixel at 1× [DOC:360041065034 excerpt][API R:1478-1520].
2. **No bounds.** Positions may be negative, fractional or very large. Maximum magnitude and stored precision →V-01 [KNOW].
3. **Container-parent space.** The inspector shows X/Y relative to the container parent [API P:7292-7315][SRC:P2]:

```text
containerParent(n):
  p = n.parent
  while p.type in {GROUP, BOOLEAN_OPERATION, TRANSFORM_GROUP}:   // TRANSFORM_GROUP: inference →V-04
    p = p.parent
  return p    // PAGE | FRAME | COMPONENT | COMPONENT_SET | INSTANCE | SLOT | SECTION(→V-04)

absoluteTransform(n) = (containerParent(n) is PAGE ? I : absoluteTransform(containerParent(n))) · relativeTransform(n)
absoluteBoundingBox(n) = AABB(absoluteTransform(n) · {(0,0),(w,0),(w,h),(0,h)})   // strokes/effects excluded
```

4. **Rotation.** `rotation = atan2(−m10, m00)`, in (−180, 180]. Positive values rotate counter-clockwise on screen. 360 normalizes to 0 and 195 to −165 [API P:7349-7356][SRC:S4]. Setting rotation from the API pivots about the top-left; the on-canvas and inspector UI pivot about the center [KNOW]→V-38.
5. **Displayed geometry.** X/Y = translation of `relativeTransform` (the rotated top-left corner); W/H = unrotated size [API][KNOW]→V-02.
6. **Skew.** A skewed matrix (only possible via import or API) is preserved and rendered, but never surfaced in the inspector [API P:7316-7319].
7. **Flip.** A reflection (determinant −1) with unit axes. Encoding and resulting rotation value →V-03 [API inference].

### 3.2 Viewport: zoom and pan

**Inputs** (all [KNOW]→V-05/V-06/V-07 unless tagged):

| Input | Effect |
| --- | --- |
| Mouse wheel | Pan vertically |
| Shift + wheel | Pan horizontally |
| Trackpad two-finger scroll | Pan freely in both axes |
| Cmd (macOS) / Ctrl (Windows) + wheel | Zoom about the pointer |
| Trackpad pinch | Continuous zoom about the gesture centroid |
| Space + drag | Temporary hand: pan. Releasing Space restores the prior tool |
| H | Hand tool (persistent) |
| Middle-button drag | Pan from any tool |
| `+` / `−` | Zoom in / out by discrete steps. The help article writes them as Shift + `+` / Shift + `−` (on a US layout `+` needs Shift); whether `=` and `−` alone also work →V-05 [DOC:360041065034 excerpt] |
| Shift+0 | 100 % [SRC:S5] |
| Shift+1 | Zoom to fit [DOC:360041065034 excerpt] |
| Shift+2 | Zoom to selection [DOC:360041065034 excerpt] |
| N / Shift+N | Next / previous frame [KNOW]→V-08 |
| Z (held) | Zoom tool: click zooms in; Alt/Option+click zooms out; drag a rectangle to zoom to it [KNOW]→V-09 |
| Zoom menu | Zoom in, out, to fit, to selection, presets 50 %, 100 % and 200 %, and a typed custom percentage [DOC:360041065034 excerpt]. Exact item list →V-05 |

**Algorithms** [REQ, matching the observable Figma behavior →V-06]:

```text
screenToPage(s) = center + (s − viewportScreenCenter) / zoom

zoomAbout(s, z'):                  // s = screen anchor (pointer, gesture centroid, or viewport center)
  p = screenToPage(s)
  zoom = clamp(z', ZMIN, ZMAX)     // ZMIN/ZMAX →V-05 (reported 0.02 / 256 [SRC:S2])
  center = p − (s − viewportScreenCenter) / zoom      // p stays under s

zoomToRect(r, margin):             // fit, selection, next frame
  zoom = clamp(min((vw − 2·margin)/r.w, (vh − 2·margin)/r.h), ZMIN, ZMAX)   // margin and any max-zoom cap →V-08
  center = r.center
```

- **Zoom to fit** uses the union of all visible top-level content on the page. Whether bounding or render bounds are used, the empty-page result, and whether hidden layers count →V-08.
- **Zoom to selection** uses the union of the selected nodes' absolute bounds. With an empty selection →V-08.
- **Keyboard steps.** No official step table was found. A 2024 community report on the macOS app describes steps that multiply or divide by 2: 100 → 200 → 400 → 800 % in, and 100 → 50 → 25 → 13 → 6 % out (the display rounds 12.5 and 6.25) [SRC:S2]. In 2026 users still asked for finer steps and a 75 % preset [SRC:S2], which suggests the coarse ladder is current. Provisional Illigma rule until V-05 runs [REQ]: `zoomIn(z) = 2^(floor(log2(z) + ε) + 1)`, `zoomOut(z) = 2^(ceil(log2(z) − ε) − 1)`, clamped to the limits. Whether Figma snaps to the ladder from an off-ladder zoom (for example after a pinch) or multiplies the current value, and the effect of "Use alternate zoom handling" →V-05.
- **"Keyboard zooms into selection"** (preference). When on, `+`/`−` anchor on the selection center instead of the viewport center [KNOW]→V-06.
- **Persistence.** Opening a file shows the current page zoomed to fit [DOC:360041065034 excerpt]. Switching pages restores each page's last viewport within a session [KNOW]→V-10.
- Zoom and pan never modify the document, never mark it dirty and never create undo steps [KNOW][REQ]→V-56.

### 3.3 View modes and canvas display

- **Pixel grid**: 1×1 document-pixel cells on integer page coordinates. Drawn only at zoom ≥ 400 %. Toggled from the zoom/view menu or ⌘' / Ctrl+' [DOC:360041065034 excerpt]→V-11. Display only.
- **Snap to pixel grid** (preference; ⇧⌘' [KNOW]→V-11): "objects align to the underlying grid when placed or moved". "Frames, sections and components … always snap to the pixel grid, even if Snap to pixel grid is disabled" [DOC:360041065034 excerpt]. Which operations this covers (create, move, resize, nudge, rotate) and how rounding works →V-11.
- **Pixel preview**: shows the canvas as rasterized pixels at 1× or 2× [KNOW]→V-12. Display only; editing stays live.
- **Outline mode** ("Show outlines", ⇧⌘O / Ctrl+Shift+O) [DOC:5724448965527 excerpt]:
  - All layers draw as hairline outlines with no fills, strokes, effects or images.
  - Sub-options: include hidden layers; show object bounds [DOC:5724448965527 excerpt].
  - Hidden layers become selectable when they are outlined [SRC:S9]→V-13.
  - The "Use old shortcuts for outlines" preference restores Shift+O and moves Outline stroke back [DOC:5724448965527 excerpt].
  - Hit-testing in outline mode (are interiors clickable?) →V-13.
- **Rulers** (⇧R) [SRC:S13]: top and left rulers. The origin is relative to the selection's top-level frame, or the page origin [KNOW]→V-14. The selection's extent is highlighted on the rulers [KNOW]→V-14. Rulers are a prerequisite for creating guides [DOC:360040449713 excerpt].
- **Hide UI** (⌘\ / Ctrl+\) hides all chrome; **Minimize UI** (⇧\) collapses panels [KNOW]→V-15. Neither changes the document or the viewport center [KNOW].
- **Canvas background**: `PageNode.backgrounds`, a single solid color. With nothing selected, the right panel shows page properties [OBS], where it can be edited (`360041064814` exists in the catalog; body not consulted). The change is undoable. Not part of frame exports (PE).
- **Show dimensions on objects**: a W × H label next to the selection, with values rounded for display →V-59 [KNOW].

### 3.4 Pages (canvas consequences)

- Pages-panel operations (add, rename, reorder, duplicate, delete, dividers, move to page) are specified in UX §3.7. CV owns their canvas consequences:
  - The current page determines what is rendered, hit-tested, selected and pasted into.
  - Switching pages restores that page's own selection [API P:10609-10612] and viewport [KNOW]→V-10.
  - Switching fires a selection-change notification [API P:556].
- Page guides belong to the page and are not visible on other pages [API P:10573-10588].
- Page dividers cannot become the current page for editing (they have no canvas) [API P:10651-10657][KNOW]→V-16.
- Cut/copy on one page and paste on another keeps page coordinates when possible (§3.22) [KNOW]→V-50.
- **Previous / next page** shortcuts are owned by UX.

### 3.5 Hit-testing and hover

```text
hitStack(pagePoint):                       // topmost first
  for n in paintOrder reversed:            // children back-to-front
    if !effectivelyVisible(n) or effectivelyLocked(n): continue         [API P:6586-6606][DOC:360041596573 excerpt]
    if point is outside the clip rect of any clipsContent ancestor: continue        [KNOW]→V-20 (FR owns clipping)
    if geometryHit(n, point, tolScreenPx / zoom): yield n
geometryHit:
  filled closed shapes, frames, text: interior of the shape/frame box/text box    [KNOW]→V-20
  shapes with no visible fill: interior hit?                                        →V-20
  strokes/open paths/lines: within tolerance of the stroke                          [KNOW]→V-20
```

- Locked layers are skipped. A click on a locked layer behaves as if the layer were absent; it does not select it [DOC:360041596573 excerpt]→V-20.
- **Hover highlight** (preference "Highlight layers on hover", default on [KNOW]→V-59): the canvas outlines the layer that a click *would* select under the current rules (§3.6). With Cmd/Ctrl held, it outlines the deep target. Hovering a layers-panel row highlights that layer on the canvas [KNOW]→V-21.
- The name labels of top-level frames and section titles are separate hit targets (FR §3.3).

### 3.6 Selection: click, double-click and keyboard

**Official baseline** [DOC:360040449873 excerpt]: "When you click on an object that is part of a group or frame, we'll select the parent by default." Double-click, or Enter, selects one level of nesting down; repeating goes deeper. Holding ⌘/Ctrl while clicking selects "the top-level frame or a nested layer" directly. The article also warns that a child can be selected without its parent. It does not spell out how the default depth treats top-level frames (the "artboard" rule below), so that part stays [KNOW]→V-18. Some 2024 forum reports describe inconsistent ⌘/Ctrl-click depth with nested frames; they are not parity targets unless V-18 reproduces them [SRC:S16].

**Click target resolution** [KNOW]→V-18, except where tagged:

```text
clickTarget(point, mods, sel):
  hits = hitStack(point); if empty: return NONE (click clears selection)
  leaf = hits[0]
  if mods.cmdOrCtrl: return leaf                                             [DOC:360040449873 excerpt]
  // 1. keep the current selection depth ("scope")
  for s in sel:
    A = ancestorOrSelf(leaf) whose parent == s.parent
    if A exists: return A                                                    →V-18
  // 2. default depth
  chain = path from page to leaf (excluding page)
  top = chain[0]
  if top is SECTION: return defaultDepth(chain after section)                →V-18
  if top is FRAME or COMPONENT (artboard):
     if leaf != top: return chain[1]   // direct child of the top-level frame, even if that child is a group/frame
     return top has no children ? top : NONE      // background of a top-level frame with children →V-19
  return top                  // top-level group/instance/shape: the whole top-level layer
```

- **Empty area of a top-level frame** [KNOW]→V-19: a click on the empty background of a top-level frame **that has children** does not select the frame. It clears the selection, and a drag starting there draws a marquee over the frame's children. The frame is selected through its name label (FR), the layers panel, or ⌘/Ctrl+click, which can "select the top-level frame" [DOC:360040449873 excerpt]. An **empty** top-level frame (no children) is selected by a click and moved by a drag. An earlier CV draft said the click selects the frame; this version follows the FR spec, and both rest on [KNOW] until V-19 runs. FR owns the frame-label rules.
- **Double-click on a container** (group, frame, instance, boolean) selects the child under the pointer, one level deeper; repeating goes deeper [DOC:360040449873 excerpt]. Whether the container must already be selected, and the instance and boolean cases →V-22.
  - Double-click on a vector or shape enters vector edit mode (VC). On text it enters text editing (TX). On an image fill it may open crop or edit (PE) →V-22.
- **Shift+click** toggles the clicked target in or out of the selection [KNOW][SRC:P3]→V-23. **Shift+Cmd/Ctrl+click** toggles the deep target [KNOW]→V-23.
- **Invariant.** If a toggle would add an ancestor of selected nodes, those descendants are removed. Adding a descendant of a selected node does nothing, or replaces the ancestor →V-23 [API P:10609-10614].
- **Enter** selects the children of every selected container [DOC:360040449873 excerpt]. On a text layer it starts text editing; on a vector it enters vector edit mode; on a leaf without children it does nothing [KNOW]→V-22.
- **Shift+Enter** selects the parent of every selected node [DOC:360040449873 excerpt]. A community answer says `\` also selects the parent [SRC:S19]→V-22. On top-level nodes it does nothing →V-22.
- **Tab / Shift+Tab** select the next / previous sibling [DOC:360040449873 excerpt]. Order, wrap-around, and the multi-selection result →V-22 [SRC:S15].
- **Esc** clears the whole selection, also when the selection is nested. It does **not** step up one level: "Esc to back out one level" (Sketch/XD behavior) has been a feature request since 2021, and Figma pointed users to another key (Shift+Enter) instead [SRC:S19]→V-22. Esc first cancels an in-progress gesture (§3.10), and in text or vector edit mode it exits the mode and leaves the layer selected (TX, VC) [KNOW]→V-22.
- **"Select layer" menu.** Right-click → *Select layer* lists every layer under the pointer, in layers-panel order, with each layer's name and icon. Locked layers are listed with a padlock and can be selected from here; this is the documented route to select a locked layer on the canvas [DOC:360041596573 excerpt]. Hidden layers are **not** listed: hidden layers cannot be picked on the canvas, "including through the right-click option" [DOC:360041112614 excerpt]. A 2024 request describes ⌘/Ctrl+right-click as quick access to this list [SRC:S17]→V-23.
- **Right-click on an unselected layer** selects it before opening the menu [KNOW]→V-54. A 2024 feature request says the right-click selects the **deepest** layer under the pointer (expanding the layers panel) before the menu opens [SRC:S17]. Which depth rule applies is recorded in V-54.
- **Selection display.** One node shows an oriented box with 8 handles. Several nodes show their axis-aligned union box with handles, plus a thin outline on each member [KNOW]→V-33. A frame's selection box is the frame's own bounds, never the union of its children [REQ][SRC:P3].

### 3.7 Marquee selection

[KNOW]→V-24 unless tagged:

1. A drag that starts on empty canvas, with the Move tool or with nothing under the pointer, draws a marquee.
2. On release (with a live preview during the drag), it selects every **top-level** layer whose bounds **intersect** the marquee, except top-level frames.
3. A top-level frame is selected only if the marquee **fully contains** it. Otherwise the frame's direct children that intersect the marquee are selected.
4. A marquee that starts on the empty area of a top-level frame selects that frame's intersecting children.
5. With a nested selection active, a marquee inside that container selects siblings at that depth.
6. **Shift+marquee** adds to the current selection (or toggles →V-24).
7. **Cmd/Ctrl+marquee** selects nested layers [DOC:360040449873 excerpt]. Any layer the marquee merely touches is selected; a 2024 thread reports this as a change in some version [SRC:S16]. Exact depth rule (leaves vs. intermediate containers) →V-24.
8. Hidden and locked layers are never marquee-selected.
9. Dragging past the viewport edge auto-pans.
10. A marquee with zero area is a click.
11. Figma has **no** "fully enclosed only" marquee mode (unlike Sketch's ⌘⌥-drag); users were still requesting one in August 2025 [SRC:S16]. Illigma's default marquee must not switch to containment.
12. Reported glitches (drag selection blocked inside a frame placed close to a section; layers inside a device frame) are bugs, not parity targets [SRC:S16].

### 3.8 Bulk selection commands

- **Select all (⌘A / Ctrl+A)** selects all layers at the same depth and in the same parent as the current selection [SRC:S5]→V-25. The help article says that with a top-level frame selected, only other top-level layers are selected, so nested children are not pulled in [DOC:360040449873 excerpt; the summary did not name the command, which is inferred to be Select all]. With nothing selected, it selects all top-level layers of the page [KNOW]→V-25. Whether locked and hidden layers are included →V-25.
- **Select inverse (⇧⌘A)** selects the siblings not currently selected, within the same parent(s) [SRC:S5]→V-25.
- **Select matching layers (⌥⌘A / Ctrl+Alt+A)** [DOC:21523793229463 excerpt]:
  - The source must sit inside a frame or group that is top-level (or in a section).
  - A layer matches if its name equals the source's name. For text layers named implicitly from their content, the text style must match instead.
  - Ancestor frame names must match, except the top-level frame names (and variant names in a component set), which may differ.
  - The depth in the hierarchy must be identical.
  - If several candidates exist, the child index in the parent breaks the tie. For text candidates, the x/y position in the frame breaks the tie.
  - Scope: the whole current page, including off-screen matches. Never other pages.
  - Holding Shift highlights all matches before selecting →V-25.
- **Select all with same …** (Edit menu: fill, stroke, effect, text properties, font, instance; exact list →V-25) [SRC:S12]. Scope (page vs. frame) →V-25. A reported long-standing bug in "same text properties" is **not** a parity target [SRC:S12].

### 3.9 Locked and hidden layers

- **Lock**:
  - Toggle with ⇧⌘L / Ctrl+Shift+L, the context menu, or the layers-panel padlock. Dragging across padlocks toggles them in bulk [DOC:360041596573 excerpt].
  - A locked layer cannot be clicked, marquee-selected or moved on the canvas. It can be selected in the layers panel and edited in the inspector [DOC:360041596573 excerpt].
  - Locking a parent locks its descendants, and a child cannot be unlocked while its parent is locked [DOC:360041596573 excerpt].
  - Locked layers move along when an unlocked ancestor moves [KNOW].
  - Whether locked layers are still snap targets and measurable →V-26. Whether a panel-selected locked layer responds to arrow nudges and canvas handles →V-26. Whether an "Unlock all" shortcut exists →V-26 [SRC:S10].
- **Hide**:
  - Toggle with ⇧⌘H / Ctrl+Shift+H [SRC:S9]→V-27.
  - A hidden layer stays a node. It is not rendered, hit-tested, exported or included in render bounds (`absoluteRenderBounds = null`) [API P:7338-7342].
  - It can be selected from the layers panel, and its position and properties stay editable [SRC:P4 citing DOC:360041112614 excerpt].
  - When selected, the canvas shows its selection box →V-27.

### 3.10 Move and reparent

Pointer gesture [KNOW]→V-28 unless tagged:

```text
pointerdown on target T (clickTarget rules):
  if T not in selection: selection = [T]         // unless Shift (toggle) — Shift+drag on unselected adds then drags →V-28
  start = pointer; baseline = snapshot(selection transforms)      [REQ]
pointermove:
  if |pointer − start| < DRAG_THRESHOLD_SCREEN_PX: return       // threshold →V-28
  d = (pointer − start)/zoom
  if Shift: zero the smaller axis component (horizontal or vertical lock; 45° diagonal? →V-28)
  d = snapMove(selectionBounds(baseline) + d) (§3.17)  unless snapping suspended
  apply d to every selected node exactly once (descendants of selected nodes are not moved separately)   [REQ][SRC:P3]
  dropTarget = reparentTarget(pointer) (below); show target highlight
pointerup: reparent if dropTarget changed; commit one undo step
Esc during drag: restore baseline, no undo step                                   →V-28
```

- **Alt/Option+drag duplicates.** The copy moves while the original stays [SRC:S1]. Pressing or releasing Alt mid-drag toggles between duplicate and move →V-28.
- **Reparent on drop** [KNOW]→V-29 (FR §3.2 also specifies this):

```text
reparentTarget(pointer):
  candidates = frames/components/instances?/sections under pointer, not in the moving set, visible, unlocked
  choose the deepest frame-like candidate that is a valid parent; groups are never drop targets
  sections may hold frames/layers; sections may not go into frames                       [SRC:P5]
  none → page
```

  Reparenting preserves the absolute transform. The moved layers are appended at the top of the new parent's z-order [KNOW]→V-29. Whether the pointer position or the layer bounds decide, and which modifier suppresses reparenting →V-29.
- **Auto layout.** Dropping into an auto-layout frame inserts into the flow at the indicated index (AL). Children of auto layout have computed X/Y (setting them is a no-op), so dragging them reorders (AL) [API P:7241-7253].
- **Instances.** Instance sublayers cannot be moved or reparented [API P:1861][KNOW]→V-57.
- **Pixel snapping.** With Snap to pixel grid on, the final translation lands on whole pixels [DOC:360041065034 excerpt]→V-11.
- **Auto-pan.** Dragging near the viewport edge auto-pans [KNOW]→V-28.
- **Space during a move drag.** Effect →V-28.

### 3.11 Nudge

- Arrow keys move the selection by the **small nudge** (default 1); Shift+Arrow moves by the **big nudge** (default 10). Units are document points, independent of zoom [DOC:4404575206295 excerpt].
- Values are set in Preferences → Nudge amount. Clicking outside the dialog applies them [DOC:4404575206295 excerpt]. Users have asked for page-level values, which implies one global value today [SRC:S3]→V-30.
- Every selected node moves; locked descendants move with their ancestor [KNOW].
- An auto-layout child moves within the flow order instead (AL) [KNOW]→V-30.
- Undo granularity (one step per key press, or coalesced) →V-30, V-56.
- Nudging a fractional position with pixel snap on: kept as +1, or rounded? →V-30.
- **⌘/Ctrl+Arrow resizes** the selection by the small nudge (right/down grow, left/up shrink, anchored at the top-left); ⇧⌘+Arrow uses the big nudge [KNOW]→V-30.
- A reported vector-edit-mode bug moves points twice the nudge. Not a parity target [SRC:S3].

### 3.12 Resize

**Handles**: 4 corner handles plus 4 edges. Dragging anywhere on an edge resizes that edge [KNOW]. Handles are hidden on small on-screen sizes (threshold →V-34).

```text
resizeDrag(node, handle, pointerPage, mods):           // single node
  L = inverse(absoluteTransform at gesture start)       // work in the node's local, unrotated frame
  q = L · pointerPage
  anchor = mods.alt ? boxCenter : oppositeHandle(handle)              [DOC:360040450233 excerpt (Alt = from center, smart sel.)][KNOW]→V-31
  box = rect spanned by anchor and q along the handle's axes (edge handles change one axis only)
  if mods.shift XOR node.targetAspectRatio != null:                     [API P:7487-7526][KNOW]→V-31
      keep W:H — corner: follow the dominant axis; edge: scale the other axis about the anchor's centerline
  if box.w < 0 or box.h < 0:                                            // dragged past the anchor
      if pref "Flip objects while resizing": reflect on that axis (§3.14)   →V-32
      else clamp at minimum size
  box = snapResize(box) (§3.17); clamp |w|,|h| ≥ MIN (API: 0.01; UI →V-32)
  write width/height; recompute relativeTransform translation so the anchor stays fixed in page space
  if node is FRAME/COMPONENT/INSTANCE and !mods.cmdOrCtrl: apply children's constraints  [API P:7444-7457](FR)
  if mods.cmdOrCtrl on a frame: resize without constraints                                   [SRC:P1]→V-35
  if node is GROUP/BOOLEAN: scale children's geometry proportionally (constraints of group children apply only when the enclosing frame resizes)  [API P:7229-7234][KNOW]→V-33
  if node is SECTION: children unaffected                                                    [API P:12285-12298]
  if node is TEXT: text auto-resize mode changes per TX (e.g. auto-width → fixed)            [KNOW]→V-36
  if node is auto-layout child/parent: sizing mode becomes Fixed on the dragged axis (AL)    [KNOW]→V-36
  if width/height is bound to a variable: binding is detached on manual resize               [KNOW]→V-37
```

**Multi-selection resize** [KNOW]→V-33:

```text
U = union bounds; anchor as above on U; sx = U'.w/U.w, sy = U'.h/U.h
for n in selection (each once):
  if n unrotated: n.x' = anchor.x + (n.x − anchor.x)·sx ; n.w' = n.w·sx  (same for y/h)
  if n rotated: position of its center maps as above; its local size changes along its own axes →V-33
  frames apply their children's constraints (unless Cmd); text boxes resize (glyphs do not scale)
```

- **Inspector W/H** edits keep the top-left (X/Y) fixed for unrotated nodes [KNOW]→V-35. Rotated nodes →V-35.
- **Space while resizing** moves the box instead of resizing →V-31.

### 3.13 Rotate

- Hovering just outside a corner handle shows a rotate cursor. Dragging rotates about the center of the selection bounds [KNOW]→V-38.
- **Shift** snaps the angle to multiples of 15° [SRC:S4]. Whether the absolute angle or the delta snaps →V-38.
- The rotation field takes degrees (decimals allowed) and normalizes to (−180, 180]. 360 → 0 [SRC:S4][API P:7349-7356].
- Typing a value rotates about the node's center [KNOW]→V-38.
- **Multi-selection** rotates as one rigid unit about the union center: positions orbit and each node's rotation increases by the same delta. The field shows "Mixed" when values differ; typing a value sets each node's rotation about its own center →V-38 [KNOW].
- A frame's rotation turns its content visually. Children's X/Y stay unchanged because they are frame-relative [API P:7279-7316].
- Sections cannot rotate [API P:12256-12298]. Groups rotate as a whole; the group transform is derived →V-04.
- Rotated auto-layout children occupy their rotated bounding box in the flow (AL) →V-58.
- Menu commands Rotate 90° left, Rotate 90° right and Rotate 180° exist in the Object menu per UX [KNOW]→V-38.

### 3.14 Flip

- **Flip horizontal (⇧H)** and **Flip vertical (⇧V)** mirror the selection about the vertical/horizontal center line of its bounds [KNOW]→V-03.
- With several nodes, each node is mirrored and its position is mirrored inside the union bounds [KNOW]→V-03.
- The result is stored as a reflection in `relativeTransform`. The rotation field afterwards reads `atan2(−m10, m00)`, so Flip horizontal of an unrotated node may display 180° →V-03 [API inference].
- Text stays editable and is rendered mirrored [KNOW]→V-03.
- Flipping a frame mirrors the rendering of all descendants without changing their local transforms [KNOW]→V-03.
- Available from the context menu, the Object menu and the Position section →V-03.

### 3.15 Scale tool (K)

- **K** selects the Scale tool (also in the toolbar). It "preserves aspect ratios and ignores constraints of any nested layers in order to scale them proportionally" [DOC:360040451453 excerpt].
- "Any blurs or strokes will scale as well" [DOC:360040451453 excerpt]. Forum reports of strokes *not* scaling refer to the ordinary resize [SRC:S8].
- The full list of scaled properties (stroke weights, effect radii/offsets/spread, corner radii, font size, line height, letter spacing, paragraph spacing, auto-layout padding/gap, layout-guide values, image fill transforms) →V-39 [KNOW]. API equivalent: `rescale(scale)` with scale ≥ 0.01, anchored top-left [API P:7476-7482].
- **Inspector while the tool is active**: a scale-factor field (e.g. 2×), W/H fields, and a 9-point **anchor box** that sets the fixed point for numeric scaling. With the anchor at center, the object grows in all directions [DOC:360040451453 excerpt].
- **Dragging**: any handle scales proportionally. Alt scales from the center [SRC:S8]→V-39.
- The tool stays active until another tool is chosen [KNOW]→V-39.
- Scaling an instance writes overrides (CP) →V-39.

### 3.16 Numeric input, precision and rounding

- Fields: X, Y, W, H, rotation, and in Scale mode the scale factor.
- Display rounds to at most 2 decimals; the stored value keeps full precision [KNOW]→V-01.
- Math expressions (`+ − * /`, parentheses) are accepted [KNOW]→V-40.
- With a mixed multi-selection, a field shows "Mixed". A relative expression (e.g. `+10`) applies to each node; an absolute value sets every node to it →V-40.
- Multi-selection X/Y/W/H semantics: shared union value, or per node →V-40.
- In a focused field, ↑/↓ step by 1 and Shift+↑/↓ by 10 (big nudge?) [SRC:P4]→V-40.
- **Scrubbing**: dragging the field label or icon changes the value; Shift uses the big step [DOC:4404575206295 excerpt (big nudge also applies to scrubbing, per search summary)]→V-40.
- Enter commits; Esc reverts; Tab commits and moves on (UX).
- **"Round to pixel"** (Arrange menu) rounds the selected nodes' X/Y/W/H to integers [SRC:P4][KNOW]→V-47.

### 3.17 Snapping and smart guides

```text
snapMove(B):                                    // B = moving selection bounds (page space, axis-aligned)
  if snappingSuspended(): return pixelSnap(B)   // suspension key →V-42
  T = SNAP_THRESHOLD_SCREEN_PX / zoom            // threshold →V-41
  cands = edges + centers of: siblings in the drop parent, the drop parent's bounds, other visible top-level layers in the viewport (→V-41),
          page/frame ruler guides, layout-guide columns/rows/gutters (FR), equal-spacing targets
          excluding: moving nodes and their descendants, hidden layers (locked? →V-26)
  for axis in {x, y}:
     for line in {B.min, B.center, B.max}: nearest candidate within T
     apply the smallest correction; record all coincident lines for display
  equal spacing: when B sits beside/between neighbors so that gap(B, neighbor) == an existing gap → snap and show spacing markers →V-41
  return pixelSnap(B')                           // with Snap to pixel grid on; order of operations →V-11
```

- **Smart guides** show as red lines with distance labels while moving and resizing. They vanish on release and are never exported [KNOW]→V-41.
- **Preferences** (independent toggles) [SRC:S1][DOC:360041065034 excerpt][KNOW]→V-43:
  - Snap to geometry: vector points, owned by VC.
  - Snap to objects.
  - Snap to pixel grid.
- **Temporary suspension while dragging**: a July 2026 forum reply says **Control** on macOS and **S** on Windows. An April 2025 reply says S. A 2022 thread says Ctrl [SRC:S1]→V-42. Cmd held while dragging did **not** suppress smart guides in a 2021 report [SRC:S1]. ⚠ The UX doc lists ⌘/Ctrl, which conflicts.
- Rotated objects snap by their axis-aligned bounding box →V-41.
- Resize snapping applies to the moving edge(s) only. Rotation snapping exists only with Shift (15°) →V-41.
- **Newer resize snap targets** (Figma weekly-updates roundup, undated) [SRC:S20]→V-41:
  - Resizing a text box from its top or bottom edge snaps where the box is centered around its text.
  - Resizing a frame or section snaps to the size at which its children are centered.

### 3.18 Measurement (redlines)

- **Basic**: select layer A, hold Alt/Option, hover layer B. Red lines show the horizontal and vertical distances between A's and B's bounding boxes [DOC:360039956974 excerpt].
- **Nested**: Cmd+Alt / Ctrl+Alt measures between nested layers and shows a single measurement [DOC:360039956974 excerpt].
- Measurements use **bounding boxes**: not stroke extents (center/outside strokes are ignored) and not glyph outlines (text uses its box) [DOC:360039956974 excerpt].
- The red line's color and weight cannot be changed [DOC:360039956974 excerpt].
- **Guides**: two guides can't be measured directly. Selecting one and hovering the other shows both positions on the axis [DOC:360039956974 excerpt]. Guides inside frames act as objects for redlines [DOC:360040449713 excerpt].
- **Parent/containing layer**: hovering the parent (or a layer that contains A) shows distances from A to all four sides [KNOW]→V-44.
- Overlapping layers, label rounding, and Alt pressed during a drag (which duplicates instead) →V-44.
- Read-only; works with view access [DOC:360039956974 excerpt].

### 3.19 Align, distribute, Tidy up and Smart selection

**Align** (6 operations) [KNOW]→V-47:

- Left, horizontal centers, right, top, vertical centers, bottom (shortcuts in §5).
- With several nodes, they align to the union bounds. With one node, it aligns to its container parent's bounds. A top-level single node →V-47.
- Rotated nodes align by their axis-aligned bounding box.
- Alignment is disabled for auto-layout children that are not absolutely positioned [SRC:P2].
- A center alignment that would produce a half pixel: rounding →V-47.
- Nodes from different parents →V-47.

**Distribute** (horizontal / vertical spacing) [DOC:360040450233 excerpt][KNOW]→V-47:

- "Distribute will only set a uniform distance between layers, it doesn't require layers to overlap on either axis" [DOC:360040450233 excerpt].
- Needs ≥ 3 nodes [KNOW].

```text
distributeH(sel):  sort by left edge (→V-47: or center); L = min left; R = max right
  gap = (R − L − Σ w) / (n − 1)        // may be fractional or negative (overlap) →V-47
  x = L; for n in sorted: n.left = x; x += n.w + gap        // extremes stay fixed
```

**Tidy up** [DOC:360040450233 excerpt]; shortcut ⌃⌥T [KNOW]→V-46:

- **1D** (the selection overlaps on one axis): arrange along that axis, using "the most common spacing in the selection" as the gap.
- **2D**: "arranges all objects into a grid that aligns with the top-left corner of your selection".
- It produces a Smart selection when spacing was uneven.

```text
tidyUp(sel):
  if all overlap on y (a row): axis = x;  gap = mode(gaps between neighbors sorted by x)   // ties →V-46
       keep first item's position; place others left→right with gap; align? (cross-axis untouched →V-46)
  elif all overlap on x: same on y
  else: cluster into rows/columns (→V-46); grid anchored at the selection's top-left; uniform row/column gaps (→V-46)
```

**Smart selection** [DOC:360040450233 excerpt]:

- Available when all layers are equally spaced and overlap on x or y (1D) or both (2D).
- Hovering shows pink **circle handles** (one per item center) and pink **spacing handles** (between items).
- **Spacing handles**: dragging one changes every gap uniformly; the gap is also editable numerically [KNOW]→V-45.
- **Circle handles**:
  - Dragging one reorders or swaps the item within the arrangement [DOC excerpt: "rearrange or reorder"][KNOW]→V-45.
  - Clicking one marks the item; Shift+click marks more. Delete/Backspace removes the marked items, and the remaining items close the gap.
- **Resizing**: one item can be resized inside a 2D selection, or several inside a 1D selection. Alt resizes from center.

### 3.20 Rulers and guides

[DOC:360040449713 excerpt] unless tagged:

- Rulers must be visible to create guides (View → Rulers; ⇧R [SRC:S13]).
- **Create**: drag from the horizontal or vertical ruler onto the canvas. Which ruler yields which axis →V-48.
  - Released over a frame, the guide becomes a **frame guide** (stored on that frame, positioned relative to it). Otherwise it becomes a **canvas guide** (on the page).
  - A canvas guide that crosses a frame is drawn with a dotted segment over the frame.
- **Duplicate**: Alt/Option-drag an existing guide.
- **Measure**:
  - Frame guides are objects for redlines.
  - With a top-level frame selected, holding Option (macOS) / Control (Windows) while dragging out a guide shows its distance in px from the frame.
- **Remove**: drag the guide back onto a ruler, or select it and delete (Delete key per excerpt, partially confirmed) →V-48.
- **Move**: drag a guide. Guides snap to objects and the pixel grid while dragged [KNOW]→V-48.
- Frame guides move with their frame [KNOW]→V-48. Guide creation, moving and deletion are document edits and undoable [KNOW][API P:10573-10588].
- Whether guides hide when rulers are hidden, and whether a guide position can be typed →V-48.
- Edit access is required (Illigma: always editable).

### 3.21 Duplicate and offset memory

[KNOW]→V-49 unless tagged:

- **⌘D / Ctrl+D** duplicates each selected node into the same parent, directly above the original in z-order (auto layout: right after it in the flow, AL). The duplicates become the selection.
- New IDs are assigned and all properties copied, including frame guides, constraints, export settings and prototype links (target remapping →V-49).
- **Placement**: nested layers duplicate in place, overlapping the original [KNOW]→V-49. A duplicated top-level frame is placed to the right of the original [SRC:S18]. In a 2023 report, duplicating frame 4 of a row of 10 placed the copy after frame 10, in free space to the right of the row rather than next to the original [SRC:S18]. Figma staff said in September 2024 that there is no shortcut to duplicate in place without an offset [SRC:S18]. The exact free-space search →V-49.
- **Offset memory**: ⌘D repeats the last offset applied to the duplicated object. If a duplicate is moved (drag or nudge) and ⌘D is pressed again, the new copy repeats that offset (series duplication). Alt-drag followed by ⌘D gives evenly spaced copies [SRC:S18]. Community reports say the offset is not always reproduced when rotation is involved [SRC:S18]; that is not a parity target unless V-49 shows it is deliberate. What resets the memory →V-49.
- **Quick-add** (FR): with the Frame tool, clicking the + beside a hovered top-level frame creates a copy and nudges neighboring frames over to make room [DOC:360041539473 excerpt].
- **Names**: duplicates keep the original name. The "Rename duplicated layers" preference changes this →V-49.
- **Components**: duplicating a main component creates a new main component; Alt-drag likewise →V-57 (CP).

### 3.22 Clipboard

- **⌘C / ⌘X / ⌘V** copy, cut and paste the selected subtrees losslessly within Illigma [REQ]. Cut removes the nodes in one undo step.
- **Paste placement** [DOC:4409078832791 excerpt]. Article sections: Paste placement, Canvas view, Copy and paste, Duplicate, Click and drag, Keyboard shortcut, Paste to replace, Paste over selection, Multi-paste (one object / multiple objects), Paste here. Pasted objects "try to maintain the same x and y positions within the destination frame relative to its position in the group or frame it was copied from", decided **per axis**: an axis on which the original coordinate can be matched keeps it, and an axis on which it cannot is centered. The article's example: an ellipse whose x and y both fit keeps its position; a square for which neither fits is centered on both axes. With a frame selected, Figma also "considers your current view of the canvas" when deciding where to paste and whether to adjust the viewport; that part of the excerpt was truncated →V-50.

```text
paste(clip, sel):           // per-axis fit: [DOC:4409078832791 excerpt]; destination choice and view rules: [KNOW]/[SRC:S21]→V-50
  dests = selected frames, if any (multi-paste: one copy per frame)       [DOC excerpt, section "Multi-paste"]
          else the parent of a selected non-frame layer S (insert directly above S)   →V-50
          else the page
  for D in dests:
    if D is a frame:
      for axis a in {x, y}:
        p = clip.offsetInSourceContainer[a]
        if 0 <= p and p + clip.size[a] <= D.size[a]: keep p          // exact fit test (strictness, negative offsets) →V-50
        else: p = (D.size[a] - clip.size[a]) / 2                      // centered on that axis
    else (page): keep the original page coordinates if visible, else center in the visible area   [SRC:S21]→V-50
    if the result is off-screen: pan, or re-place it in view ("Canvas view" rule)                   →V-50
  pasted nodes become the selection; one undo step
```

- Community reports from 2022–2023 describe deviations: a selected frame sometimes ignored, and a paste returning to the source's parent frame while that frame is still in view, even with another frame selected. A 2023 report says a clip larger than a target auto-layout frame pastes one level up, into that frame's parent [SRC:S21]. V-50 records each case before any becomes a requirement.
- **Paste over selection (⇧⌘V / Ctrl+Shift+V)** places the copy *on top of* a selected frame, not inside it, at the same x/y as the selected object. It is also in Edit → Paste over selection [DOC:4409078832791 excerpt]. With nothing selected, the copy pastes as a top-level layer [SRC:S6].
- **Paste to replace (⇧⌘R / Ctrl+Shift+R)** removes each selected layer and puts the clipboard object in its place. The pasted object "will adopt the constraints of the object it replaced" [DOC:4409078832791 excerpt]. Position (top-left vs center), parent/z-index, size and multi-selection behavior →V-51. A September 2025 report that Paste to replace pans the viewport to the last selected node was confirmed by Figma as a bug; it is not a parity target [SRC:S21].
- **Paste here** (context menu) puts the top-left of the copy at the pointer, inside the frame under the pointer. Over an auto-layout frame, the copy lands on top of it, not inside it [SRC:S6]→V-51.
- **Copy / paste properties**:
  - ⌥⌘C / ⌥⌘V (Ctrl+Alt+C / Ctrl+Alt+V), or the context menu Copy/Paste as → Copy properties / Paste properties [DOC:4412765442967 excerpt].
  - Pasting "will apply any properties that are supported by that layer" [DOC:4412765442967 excerpt].
  - A single fill, stroke or effect can be copied and pasted with ⌘C/⌘V from its row in the panel [DOC:4412765442967 excerpt].
  - Exact property list (fills, strokes, effects, opacity, blend, corner radius, layout, text styles …) and whether geometry is excluded →V-52.
- **Across pages**: a paste on another page keeps page coordinates [KNOW]→V-50.
- **Main components**: pasting a main component in the same file creates an instance [KNOW]→V-57 (CP).
- External flavors (Copy as PNG ⇧⌘C, SVG, code; pasting images, SVG and text) are owned by IO, PE and TX.

### 3.23 Arrange (z-order)

[KNOW]→V-53 throughout:

- **Bring forward** ⌘], **Send backward** ⌘[, **Bring to front** ⌥⌘] (Windows Ctrl+Shift+]), **Send to back** ⌥⌘[.
- These change the index among siblings only, never the parent.
- With several nodes in one parent, their relative order is preserved. With several parents, each parent is handled independently.
- Forward/backward move one index regardless of overlap →V-53.
- In auto layout, the order is the flow order (AL).

### 3.24 Cursors and context menu

- **Cursors** [KNOW]→V-55:
  - Arrow (default).
  - Resize cursors, oriented to the handle direction including node rotation.
  - Rotate cursor (outside corners).
  - Grab / grabbing (Space, H).
  - Duplicate indicator (Alt over a selection).
  - Crosshair (creation tools).
  - Zoom in / out (Z).
  - Text I-beam (TX).
  - "Not allowed" for locked targets? →V-55.
- **Canvas context menu**: on a selection it holds Copy, Paste here, Paste to replace, Copy/Paste as ▸, Select layer ▸, the arrange items, Group/Frame selection/Ungroup, Flatten, Outline stroke, Use as mask, Create component, Show/Hide, Lock/Unlock, Flip horizontal/vertical, Move to page ▸ and Delete. On empty canvas: Paste here, Show/Hide UI, plus view items. All [KNOW]→V-54; UX owns the full menu inventory.

### 3.25 Undo/redo of gestures

[KNOW]→V-56 throughout:

- Each completed move, resize, rotate, scale, flip, align, distribute, tidy-up, paste, duplicate (including Alt-drag), arrange, lock/hide toggle and guide edit is exactly **one** undo step. So is a resize together with all constraint-driven descendant changes (FR).
- An inspector field commit is one step. A scrub is one step.
- Selection changes, zoom, pan and page switches are not undo steps.
- Undo/redo restores the selection that existed with the restored state, and switches to the affected page if needed →V-56.
- A gesture cancelled with Esc, or lost through pointer capture, creates no step [REQ].
- Undo ⌘Z; Redo ⇧⌘Z (Windows Ctrl+Shift+Z and Ctrl+Y →V-56).

---

## 4. Inspector & on-canvas controls (functional only)

### 4.1 Right panel (Design tab, UI3)

| Context | Control | Function | Evidence |
| --- | --- | --- | --- |
| No selection | Page properties → Background | Edit `PageNode.backgrounds` (single solid) | [OBS][API P:10645] |
| Any selection | **Position** section | Holds alignment, position, rotation (and constraints for children of freeform frames, FR) | [OBS "Position"][SRC:P2] |
| Position | Alignment row (6 buttons) and overflow (distribute horizontal/vertical spacing, Tidy up) | §3.19. Disabled for auto-layout flow children | [KNOW]→V-47; [SRC:P2] |
| Position | X, Y fields | Container-parent-relative transform origin (§3.1). Computed and disabled for auto-layout flow children | [API P:7239-7254][SRC:P2] |
| Position | Rotation field, plus Rotate 90° / Flip horizontal / Flip vertical buttons? | §3.13–§3.14 | [KNOW]→V-38, V-03 |
| Any frame-like selection | **Layout** section → W, H, aspect-ratio lock toggle | Resize (§3.12). The lock sets `targetAspectRatio` | [OBS "Layout", width/height controls][API P:7487-7534] |
| Multi-selection | Mixed-value fields; Smart-selection spacing fields | §3.16, §3.19 | [KNOW]→V-40, V-45 |
| Scale tool active | Scale factor, W/H, 9-point anchor box | §3.15 | [DOC:360040451453 excerpt] |

### 4.2 Toolbar, menus and preferences

| Control | Function | Evidence |
| --- | --- | --- |
| Move tool (V), Hand tool (H), Scale tool (K) | Selection/transform, pan, proportional scale | [KNOW]; K [DOC:360040451453 excerpt] |
| Zoom / view menu (right side of the toolbar) | Zoom field and commands; Pixel grid; Snap to pixel grid; Pixel preview; Rulers; Layout guides (FR); Outlines ▸ (Show outlines, Show hidden layers, Show object bounds) | [DOC:360041065034 excerpt][DOC:5724448965527 excerpt][KNOW]→V-05, V-11–V-14 |
| Preferences | Nudge amount…; snapping toggles; the other display preferences of §2.7 | [DOC:4404575206295 excerpt][KNOW]→V-43, V-59 |
| Context menu | §3.24 | [KNOW]→V-54 |

### 4.3 On-canvas controls

| Control | Behavior | Evidence |
| --- | --- | --- |
| Selection box + 8 handles | Resize; oriented to the node for one node, axis-aligned union for several | [KNOW]→V-33 |
| Rotation zones (just outside the corners) | Rotate | [KNOW]→V-38 |
| Dimension label (W × H) | Live size readout; optional via preference | [KNOW]→V-59 |
| Hover outline | Previews the click target | [KNOW]→V-21 |
| Marquee rectangle | §3.7 | [KNOW]→V-24 |
| Smart guides (red lines, distance and spacing labels) | §3.17 | [KNOW]→V-41 |
| Alt redlines | §3.18 | [DOC:360039956974 excerpt] |
| Smart-selection pink circle and spacing handles | §3.19 | [DOC:360040450233 excerpt] |
| Ruler guides; dotted indicator where a canvas guide crosses a frame | §3.20 | [DOC:360040449713 excerpt] |
| Pixel grid; outline rendering; pixel preview | §3.3 | [DOC:360041065034 excerpt][DOC:5724448965527 excerpt] |
| Drop-target highlight while dragging | §3.10 | [KNOW]→V-29 |

All overlays are drawn in screen units, are excluded from export and never mutate the document [REQ].

---

## 5. Keyboard shortcuts (macOS / Windows)

The UX doc owns the global registry; this table is the CV subset. ⌘ = Command, ⌥ = Option, ⇧ = Shift, ⌃ = Control.

| Action | macOS | Windows | Evidence |
| --- | --- | --- | --- |
| Pan (temporary hand) | Space + drag | Space + drag | [KNOW]→V-07 |
| Hand tool | H | H | [KNOW]→V-07 |
| Zoom in / out | `+` / `−` (help lists ⇧+ / ⇧−) | `+` / `−` | [DOC:360041065034 excerpt]→V-05 |
| Zoom about pointer | ⌘ + wheel, or pinch | Ctrl + wheel, or pinch | [KNOW]→V-06 |
| Zoom to 100 % | ⇧0 | Shift+0 | [SRC:S5]→V-08 |
| Zoom to fit | ⇧1 | Shift+1 | [DOC:360041065034 excerpt] |
| Zoom to selection | ⇧2 | Shift+2 | [DOC:360041065034 excerpt] |
| Next / previous frame | N / ⇧N | N / Shift+N | [KNOW]→V-08 |
| Zoom tool | Z (held) | Z (held) | [KNOW]→V-09 |
| Pixel grid | ⌘' | Ctrl+' | [DOC:360041065034 excerpt]→V-11 |
| Snap to pixel grid | ⇧⌘' | Ctrl+Shift+' | [KNOW]→V-11 |
| Pixel preview | ⌃P? | ? | [SRC:S5]→V-12 |
| Rulers | ⇧R | Shift+R | [SRC:S13]→V-14 |
| Show outlines | ⇧⌘O (legacy: ⇧O; older ⌘Y) | Ctrl+Shift+O | [DOC:5724448965527 excerpt][SRC:S9]→V-13 |
| Show/hide UI · minimize UI | ⌘\ · ⇧\ | Ctrl+\ · Shift+\ | [KNOW]→V-15 |
| Select all / inverse | ⌘A / ⇧⌘A | Ctrl+A / Ctrl+Shift+A | [SRC:S5]→V-25 |
| Select matching layers | ⌥⌘A | Ctrl+Alt+A | [DOC:21523793229463 excerpt] |
| Select children / parent | Enter / ⇧Enter (parent also `\`?) | Enter / Shift+Enter | [DOC:360040449873 excerpt]; `\` [SRC:S19]→V-22 |
| Next / previous sibling | Tab / ⇧Tab | Tab / Shift+Tab | [DOC:360040449873 excerpt] |
| Deep select | ⌘ + click | Ctrl + click | [DOC:360040449873 excerpt] |
| Toggle in selection | ⇧ + click | Shift + click | [KNOW]→V-23 |
| Deselect all (also from a nested selection) | Esc | Esc | [SRC:S19]→V-22 |
| Lock / unlock | ⇧⌘L | Ctrl+Shift+L | [DOC:360041596573 excerpt] |
| Show / hide | ⇧⌘H | Ctrl+Shift+H | [SRC:S9]→V-27 |
| Nudge / big nudge | Arrows / ⇧Arrows | Arrows / Shift+Arrows | [DOC:4404575206295 excerpt] |
| Resize by nudge / big | ⌘Arrows / ⇧⌘Arrows | Ctrl+Arrows / Ctrl+Shift+Arrows | [KNOW]→V-30 |
| Constrain (move axis / proportional resize / 15° rotate) | ⇧ (during gesture) | Shift | [KNOW][SRC:S4]→V-28, V-31 |
| From center | ⌥ (during resize) | Alt | [DOC:360040450233 excerpt][KNOW]→V-31 |
| Ignore constraints (frame resize) | ⌘ (during resize) | Ctrl | [SRC:P1]→V-35 |
| Duplicate while dragging | ⌥ + drag | Alt + drag | [SRC:S1]→V-28 |
| Suspend snapping while dragging | ⌃ (held) | S (held) | [SRC:S1]→V-42 |
| Measure / nested measure | ⌥ (hover) / ⌘⌥ (hover) | Alt / Ctrl+Alt | [DOC:360039956974 excerpt] |
| Flip horizontal / vertical | ⇧H / ⇧V | Shift+H / Shift+V | [KNOW]→V-03 |
| Scale tool | K | K | [DOC:360040451453 excerpt] |
| Align left / h-center / right | ⌥A / ⌥H / ⌥D | Alt+A / Alt+H / Alt+D | [KNOW]→V-47 |
| Align top / v-center / bottom | ⌥W / ⌥V / ⌥S | Alt+W / Alt+V / Alt+S | [KNOW]→V-47 |
| Distribute horizontal / vertical spacing | ⌃⌥H / ⌃⌥V | verify | [KNOW]→V-47 |
| Tidy up | ⌃⌥T | Ctrl+Alt+T | [KNOW]→V-46 |
| Bring forward / send backward | ⌘] / ⌘[ | Ctrl+] / Ctrl+[ | [KNOW]→V-53 |
| Bring to front / send to back | ⌥⌘] / ⌥⌘[ | Ctrl+Shift+] / Ctrl+Shift+[ | [KNOW]→V-53 |
| Copy / cut / paste | ⌘C / ⌘X / ⌘V | Ctrl+C / X / V | [KNOW] |
| Paste over selection | ⇧⌘V | Ctrl+Shift+V | [DOC:4409078832791 excerpt] |
| Paste to replace | ⇧⌘R | Ctrl+Shift+R | [DOC:4409078832791 excerpt] |
| Duplicate | ⌘D | Ctrl+D | [KNOW]→V-49 |
| Copy / paste properties | ⌥⌘C / ⌥⌘V | Ctrl+Alt+C / Ctrl+Alt+V | [DOC:4412765442967 excerpt] |
| Group / ungroup (FR) | ⌘G / ⇧⌘G | Ctrl+G / Ctrl+Shift+G | [API P:1867, P:1953] |
| Undo / redo | ⌘Z / ⇧⌘Z | Ctrl+Z / Ctrl+Shift+Z (Ctrl+Y?) | [KNOW]→V-56 |

---

## 6. Parity checklist

Status of every item: **Not started**. Format: `ID name — expected Figma behavior. Data. Test. Milestone·Priority·evidence`. An item tagged `→V-nn` cannot be marked Validated until experiment V-nn (§8) has been run and the item text has been corrected to match.

### 6.1 Coordinate system & geometry model

- [ ] **CV-001** Page coordinate space — every page has an unbounded 2D space: X grows rightward, Y grows downward, 1 unit = 1 px at 1× export, and the page origin is (0,0). _Data:_ `PageNode`, `Transform`, `x`, `y` _Test:_ Place rect A at (0,0) and rect B at X=100, Y=50. B renders 100 units right of and 50 units below A. Export the page area at 1×: B's top-left pixel is at (100,50) relative to A's. _M0·P0·[API][DOC:360041065034 excerpt]_
- [ ] **CV-002** Large, negative and fractional coordinates — X/Y accept negative, fractional and large values. Values round-trip through save/reload bit-exactly. The maximum magnitude and the displayed precision match Figma. _Data:_ `x`, `y` (float) _Test:_ Set X = −100000, Y = 100000.25. Reload. The values are unchanged and Zoom to fit shows the object. Record Figma's behavior beyond ±1e6. _M0·P0·[API][KNOW]→V-01_
- [ ] **CV-003** Container-parent-relative position — X/Y and `relativeTransform` are relative to the nearest page, frame, component, component set or instance ancestor. Groups and boolean groups are skipped. _Data:_ `relativeTransform`, `x`, `y`, `parent` _Test:_ Frame at (100,100) ⊃ Group ⊃ Rect at absolute (150,150). Rect shows X=50, Y=50. Group shows X=50, Y=50. Move the frame by +10: no displayed child value changes. _M0·P0·[API]→V-04_
- [ ] **CV-004** Section as position space — a child of a section reports X/Y relative to the section or to the page, matching Figma. _Data:_ `SectionNode`, `x`, `y` _Test:_ Section at (500,500) containing a rect at absolute (520,530). Record the displayed X/Y in Figma and match it. _M1·P0·[KNOW]→V-04_
- [ ] **CV-005** Absolute transform composition — `absoluteTransform` = the container parent's absolute transform × `relativeTransform`, recursively up to the page. _Data:_ `absoluteTransform`, `relativeTransform` _Test:_ A 100×50 rect rotated 30° inside a frame rotated 15° at (200,100). Compare all six matrix values with the Plugin API values from the same fixture (tolerance 1e-4). _M0·P0·[API]_
- [ ] **CV-006** Bounding box vs render bounds — `absoluteBoundingBox` is the axis-aligned box of the transformed geometry and ignores strokes and effects. `absoluteRenderBounds` includes outside/center strokes, shadows and blurs, and is null when the node is not visible. _Data:_ `absoluteBoundingBox`, `absoluteRenderBounds` _Test:_ A 100×100 rect with an 8 px outside stroke and a drop shadow (y 4, blur 10): the bounding box stays 100×100; the render bounds grow accordingly; after hiding the rect the render bounds are null. _M0·P0·[API]_
- [ ] **CV-007** Unit-axis transform invariant — no gesture or command (except a flip, which may reflect an axis) ever writes scale into `relativeTransform`. Size lives only in width/height. _Data:_ `relativeTransform`, `width`, `height` _Test:_ After resize, scale tool, multi-select resize, flip and rotate, both matrix columns have length 1 ± 1e-6. _M0·P0·[API]_
- [ ] **CV-008** Rotation convention — rotation is in degrees within (−180, 180], computed as atan2(−m10, m00). A positive value turns the node counter-clockwise on screen. _Data:_ `rotation`, `relativeTransform` _Test:_ Enter 30: the right end of the top edge is higher than the left end. Enter 195: the field reads −165. Enter 360: the field reads 0. Enter −180: the field reads 180 or −180 (record which). _M0·P0·[API][SRC:S4]→V-38_
- [ ] **CV-009** Skew round-trip — a skewed (non-orthogonal) `relativeTransform`, e.g. from import, is preserved and rendered, but no skew control is exposed. _Data:_ `relativeTransform` _Test:_ Load a fixture node with a skew matrix. It renders sheared. The inspector shows rotation and W/H only. Save/reload keeps the matrix. _M8·P2·[API]_
- [ ] **CV-010** Minimum dimensions — width/height never go below Figma's minimum (API 0.01). A LINE's height is always 0. _Data:_ `width`, `height`, `LineNode` _Test:_ Type W = 0 and W = 0.001 for a rectangle and record Figma's results. Drag a handle past the opposite edge with flipping disabled and record the clamp. Select a line: H shows 0 and is not editable. _M1·P0·[API]→V-32_
- [ ] **CV-011** Derived bounds of group-like containers — a GROUP/BOOLEAN_OPERATION/TRANSFORM_GROUP position and size always equal the bounds of its children and update after any child change. Deleting its last child deletes the group. _Data:_ `GroupNode`, `BooleanOperationNode`, `TransformGroupNode` _Test:_ Move one child 100 px right: the group W grows by up to 100. Delete every child: the group no longer exists and one undo restores everything. _M1·P0·[API][KNOW]→V-33_
- [ ] **CV-012** Sections never rotate — sections expose no rotation. Rotate handles, the rotation field and rotate commands are unavailable or no-ops for sections. _Data:_ `SectionNode` (no `rotation`) _Test:_ Select a section: no rotation field, no rotate cursor at the corners, and Shift+H/Rotate 90° do nothing (record Figma). _M1·P1·[API]→V-04_
- [ ] **CV-013** Displayed geometry of rotated nodes — for a rotated node, X/Y show the transform origin (the rotated top-left corner) and W/H show the unrotated size. _Data:_ `x`, `y`, `width`, `height`, `rotation` _Test:_ A 100×50 rect at (0,0) rotated 90° via the field. Record X/Y/W/H in Figma and match them exactly. _M1·P0·[API][KNOW]→V-02_
- [ ] **CV-014** Geometry fields not variable-bindable — W/H (and min/max) accept number-variable bindings. X, Y and rotation do not offer binding. _Data:_ `VariableBindableNodeField`, `boundVariables` _Test:_ The inspector variable picker appears for W/H and not for X/Y/rotation. _M6·P1·[API]_

### 6.2 Viewport: zoom & pan

- [ ] **CV-015** Viewport is view state only — zoom/pan never mark the document modified, never create undo steps and are never stored in the shared document. _Data:_ `viewport.center`, `viewport.zoom` _Test:_ Open a saved file, pan and zoom, then Undo: nothing changes. Close: no "unsaved changes" prompt. _M1·P0·[API][KNOW][REQ]→V-56_
- [ ] **CV-016** Zoom limits — zoom clamps to Figma's minimum and maximum (reported 2 % and 25 600 %), including any window-size dependency. _Data:_ `viewport.zoom` _Test:_ Repeat zoom-out and zoom-in until they stop; record both limits at two window sizes. _M1·P1·[SRC:S2]→V-05_
- [ ] **CV-017** Pointer-anchored wheel zoom — ⌘/Ctrl + wheel zooms in/out and keeps the page point under the pointer fixed on screen. _Data:_ `viewport` _Test:_ Put the pointer on a rect corner and zoom 5 notches in and 5 out: the corner stays under the pointer within 1 screen px, and the zoom returns to its start value. _M1·P0·[KNOW]→V-06_
- [ ] **CV-018** Trackpad pinch zoom — pinch zooms continuously about the gesture centroid, with no stepping. _Data:_ `viewport.zoom` _Test:_ Pinch on a target point: the point stays stationary; the zoom changes continuously (record whether values snap). _M1·P0·[KNOW]→V-06_
- [ ] **CV-019** Scroll pans — the wheel pans vertically; Shift + wheel pans horizontally; trackpad two-finger scroll pans both axes. The current tool and selection are unaffected. _Data:_ `viewport.center` _Test:_ Each input moves the content in the expected direction by the expected amount (record pixels per notch) and the selection is unchanged. _M1·P0·[KNOW]→V-07_
- [ ] **CV-020** Space-drag pan — holding Space turns the pointer into a hand; dragging pans; releasing Space restores the previous tool, including mid-gesture. Inside a text field or text edit, Space types a space. _Data:_ — _Test:_ With the Rectangle tool active, hold Space and drag: the canvas pans; release: the Rectangle tool is still active. While editing text, Space inserts a character. _M1·P0·[KNOW]→V-07_
- [ ] **CV-021** Hand tool H — H activates a persistent hand tool that pans by dragging and never selects. V returns to Move. _Data:_ — _Test:_ Press H and drag over a layer: pan only, no selection change. _M1·P1·[KNOW]→V-07_
- [ ] **CV-022** Middle-button pan — dragging with the middle mouse button pans from any tool. _Data:_ — _Test:_ With the Pen tool active, middle-drag pans and adds no point. _M1·P1·[KNOW]→V-07_
- [ ] **CV-023** Keyboard zoom steps — `+`/`−` (and menu Zoom in/out) step through Figma's zoom ladder, anchored at the viewport center (or the selection when the preference is on). Reported ladder: doubling and halving (100 → 200 → 400 → 800 %; 100 → 50 → 25 → 12.5 → 6.25 %, displayed 13 % and 6 %). _Data:_ `viewport.zoom` _Test:_ From 100 %, press + 6 times and record each zoom, then − 6 times. Pinch to 37 % and record the first step each way. All sequences match Figma. _M1·P0·[DOC:360041065034 excerpt][SRC:S2]→V-05_
- [ ] **CV-024** Zoom to 100 % (⇧0) — sets zoom to exactly 1.0, keeping the current viewport center (or centering the selection →V-08). _Data:_ `viewport.zoom` _Test:_ At 37 %, press ⇧0: the zoom is 100 % and the center position is as in Figma. _M1·P0·[SRC:S5]→V-08_
- [ ] **CV-025** Zoom to fit (⇧1) — fits all visible content of the current page, with Figma's margin and empty-page behavior. _Data:_ `viewport` _Test:_ Two rects 5000 px apart: after ⇧1 both are fully visible with the same margin as Figma. On an empty page, record the result. With a hidden far-away layer, record whether it counts. _M1·P0·[DOC:360041065034 excerpt][API]→V-08_
- [ ] **CV-026** Zoom to selection (⇧2) — fits the union bounds of the selected nodes (absolute, including nested selections), using Figma's margin and maximum-zoom behavior. _Data:_ `absoluteBoundingBox` _Test:_ Select a 2×2 px nested rect and press ⇧2: record the resulting zoom (any cap) and match it. With nothing selected, record the result. _M1·P0·[DOC:360041065034 excerpt]→V-08_
- [ ] **CV-027** Next / previous frame (N / ⇧N) — zooms to the next/previous top-level frame in Figma's order, and selects it or not as Figma does. _Data:_ `PageNode.children` _Test:_ With three top-level frames, press N repeatedly: record the order, wrap-around and selection, and match them. _M1·P2·[KNOW]→V-08_
- [ ] **CV-028** Zoom tool (Z) — while Z is held, a click zooms in at the point, Alt/Option+click zooms out, and dragging a rectangle zooms to fit it. _Data:_ — _Test:_ Hold Z and drag around a 100×100 rect: it fills the viewport. Hold Z+Alt and click: the zoom decreases one step. _M1·P2·[KNOW]→V-09_
- [ ] **CV-029** Zoom menu and typed zoom — the zoom menu offers zoom in/out, zoom to fit, zoom to selection, presets 50 %, 100 % and 200 %, and accepts a typed custom percentage, clamped to the limits. _Data:_ `viewport.zoom` _Test:_ Type 333 %: the zoom is 3.33. Type 999999: clamped to the maximum. Compare the menu items with Figma. _M1·P1·[DOC:360041065034 excerpt]→V-05_
- [ ] **CV-030** Initial view on open — opening a file shows the current page zoomed to fit. _Data:_ — _Test:_ Open a saved file with content far from the origin: all content is visible. _M1·P1·[DOC:360041065034 excerpt]→V-10_
- [ ] **CV-031** Per-page viewport memory — each page remembers its last zoom/center within the session; switching back restores it. _Data:_ workspace state _Test:_ Page 1 at 250 % on area A, switch to Page 2, then back: Page 1 is at 250 % on area A. Record whether Figma also restores it after reopening the file. _M1·P1·[KNOW]→V-10_
- [ ] **CV-032** Keyboard zooms into selection (preference) — when enabled, keyboard zoom in/out anchors on the selection center instead of the viewport center. _Data:_ preference _Test:_ With the preference on, select an off-center rect and press +: the rect moves toward the center as in Figma. _M1·P2·[KNOW]→V-06_
- [ ] **CV-033** Invert zoom direction (preference) — reverses the wheel zoom direction. _Data:_ preference _Test:_ ⌘+wheel up zooms out when on. _M1·P2·[KNOW]→V-07_
- [ ] **CV-034** Viewport bounds vs UI chrome — showing/hiding rulers or panels changes the visible bounds but never document coordinates. _Data:_ `viewport.bounds` _Test:_ Toggle rulers: no node X/Y changes; the page point at the screen center stays put (record whether Figma keeps the center or the top-left fixed). _M1·P1·[API]→V-14_
- [ ] **CV-035** Zoom/pan numerical stability — 1000 alternating zoom-in/out operations about a fixed pointer leave the zoom and anchor point unchanged (no drift). _Data:_ `viewport` _Test:_ Automated: run the round-trip, then compare center/zoom to the start (tolerance 1e-9 relative). _M1·P1·[REQ]_

### 6.3 View modes & canvas display

- [ ] **CV-036** Pixel grid display — when enabled, a grid of 1×1 document-px cells aligned to integer page coordinates is drawn only at zoom ≥ 400 %. It is toggled from the view menu or ⌘'/Ctrl+'. _Data:_ preference _Test:_ At 399 % no grid; at 400 % the grid appears and the lines coincide with integer coordinates of a rect at (10,10). Toggling hides it at every zoom. _M1·P1·[DOC:360041065034 excerpt]→V-11_
- [ ] **CV-037** Snap to pixel grid (preference) — when on, created, moved and resized layers land on whole document pixels. When off, fractional results are kept. The toggle is independent of the pixel-grid display. _Data:_ preference, `x`, `y`, `width`, `height` _Test:_ At 33 % zoom, drag a rect a few px: on → integer X/Y; off → fractional values are possible. Repeat for resize and creation. _M1·P0·[DOC:360041065034 excerpt]→V-11_
- [ ] **CV-038** Always-pixel-snapped containers — frames, sections and components snap to the pixel grid even when Snap to pixel grid is off. _Data:_ `FRAME`, `SECTION`, `COMPONENT` _Test:_ With the preference off, move/resize a frame at 33 %: X/Y/W/H stay integers; a rectangle in the same test can become fractional. _M1·P1·[DOC:360041065034 excerpt]→V-11_
- [ ] **CV-039** Pixel preview — renders the canvas as if rasterized at 1× (or 2×), for display only. Editing keeps working and exported vectors are unchanged. _Data:_ preference _Test:_ Turn on 1× pixel preview at 800 %: a 0.5 px offset rect shows anti-aliased pixel blocks; the document is unchanged. _M2·P2·[KNOW]→V-12_
- [ ] **CV-040** Outline mode — ⇧⌘O / Ctrl+Shift+O (and the view menu) draws every layer as a hairline outline without fills, strokes, effects or images. Selection and editing keep working. _Data:_ preference _Test:_ Toggle: a filled, stroked, shadowed rect becomes a 1-screen-px outline; toggling back restores rendering; the document is unchanged. _M1·P2·[DOC:5724448965527 excerpt]→V-13_
- [ ] **CV-041** Outline options — the outline submenu offers "show hidden layers" (hidden layers are drawn as outlines and can be selected) and "show object bounds". _Data:_ preferences _Test:_ With hidden layers shown in outline mode, a hidden rect is drawn and can be clicked (record whether clickable). _M1·P2·[DOC:5724448965527 excerpt][SRC:S9]→V-13_
- [ ] **CV-042** Legacy outline shortcut preference — "Use old shortcuts for outlines" switches Show outlines back to ⇧O and moves Outline stroke back to ⇧⌘O. _Data:_ preference _Test:_ With the preference on, ⇧O toggles outlines. _M1·P2·[DOC:5724448965527 excerpt]_
- [ ] **CV-043** Rulers — ⇧R toggles top/left rulers that show page coordinates (or coordinates relative to the selected top-level frame) and highlight the selection's extent. _Data:_ preference _Test:_ Select a rect at (40,60) 100×20 inside a frame: record the ruler zero point and highlighted span, and match them. _M1·P1·[SRC:S13][KNOW]→V-14_
- [ ] **CV-044** Hide / minimize UI — ⌘\ hides all editor chrome and ⇧\ minimizes panels. The canvas content and document are unchanged and the viewport stays centered on the same point. _Data:_ — _Test:_ Toggle both: the center page point is stable; nothing is saved. _M1·P2·[KNOW]→V-15_
- [ ] **CV-045** Canvas background per page — with nothing selected, page properties edit the page background (single solid color). The change is undoable, is saved, and is not part of frame exports. Default color per theme as in Figma. _Data:_ `PageNode.backgrounds`, REST `backgroundColor` _Test:_ Set #222222 on Page 1 only: Page 2 keeps its color; undo restores; reload keeps it. _M1·P1·[API][OBS]→V-17_
- [ ] **CV-046** Show dimensions on objects (preference) — when on, a W × H label is shown next to the selection and updates live during resize. Values are rounded for display as in Figma. _Data:_ preference _Test:_ Resize to 100.4×50.6 with pixel snap off: record the label text and match it. _M1·P2·[KNOW]→V-59_
- [ ] **CV-047** Hide canvas UI during changes (preference) — when on, selection handles and labels hide while a drag is in progress. _Data:_ preference _Test:_ Drag a rect with the preference on: no handles are visible mid-drag. _M1·P2·[KNOW]→V-59_

### 6.4 Pages (canvas consequences)

- [ ] **CV-048** Per-page selection — each page keeps its own selection. Switching away and back restores it, and the switch emits a selection-change notification. _Data:_ `PageNode.selection` _Test:_ Select A on Page 1 and B on Page 2, then switch back and forth: each page shows its own selection. _M1·P0·[API]_
- [ ] **CV-049** Current page scopes all canvas operations — rendering, hit-testing, marquee, Select all, Select matching, zoom to fit and paste target only the current page. _Data:_ `currentPage` _Test:_ Select all on Page 1 selects nothing from Page 2. Select matching layers never selects layers on Page 2. _M1·P0·[API][DOC:21523793229463 excerpt]_
- [ ] **CV-050** Page guides are page-scoped — canvas guides created on Page 1 are not shown on Page 2 and are saved with Page 1. _Data:_ `PageNode.guides` _Test:_ Create a guide on Page 1, switch to Page 2: no guide. Reload: the guide is still on Page 1. _M1·P1·[API]_
- [ ] **CV-051** Page dividers are not canvases — a divider page cannot be opened for editing and holds no layers. _Data:_ `isPageDivider` _Test:_ Rename an empty page to "---": it becomes a divider; clicking it does not show an editable canvas (record Figma); pasting to it is impossible. _M1·P2·[API][KNOW]→V-16_
- [ ] **CV-052** Move to page keeps coordinates — moving layers to another page (context menu) keeps their page coordinates and z-order relative to each other. The current page does not switch. _Data:_ `parent`, `x`, `y` _Test:_ Move a rect at (300,200) to Page 2: on Page 2 it sits at (300,200), on top; Page 1 stays current. One undo restores it. _M1·P1·[KNOW]→V-16_

### 6.5 Hit-testing & hover

- [ ] **CV-053** Topmost-first picking — a click picks the topmost (last in paint order) visible, unlocked layer under the pointer. _Data:_ `children` order _Test:_ Two overlapping rects: a click in the overlap selects the upper one; after Send to back it selects the other. _M1·P0·[API][KNOW]→V-20_
- [ ] **CV-054** Hidden layers are not hit-testable — a node with `visible=false` or any hidden ancestor is never picked, hovered or marquee-selected on the canvas (outline mode with hidden layers excepted). _Data:_ `visible` _Test:_ Hide the upper rect: a click in the overlap selects the lower one. _M1·P0·[API][DOC:5724448965527 excerpt]_
- [ ] **CV-055** Locked layers pass through — a node with `locked=true` or any locked ancestor is never picked, hovered or marquee-selected. A click on it behaves as if it were absent. _Data:_ `locked` _Test:_ Lock the upper rect: a click in the overlap selects the lower one; a click on the locked rect alone clears the selection (record Figma). _M1·P0·[DOC:360041596573 excerpt]→V-20_
- [ ] **CV-056** Clipped content not hit outside the clip — parts of children outside a clipping frame cannot be clicked. _Data:_ `clipsContent` _Test:_ A child overflowing a clipping frame: a click on the overflow area outside the frame does not select it; with clip off it does. _M1·P0·[KNOW]→V-20_
- [ ] **CV-057** Unfilled shape interiors — clicking inside a closed shape with no visible fill follows Figma (selects or passes through). _Data:_ `fills` _Test:_ A rect with stroke only and no fill: click its center and record; repeat for an ellipse and a closed vector. _M1·P0·[KNOW]→V-20_
- [ ] **CV-058** Hairline and open-path tolerance — lines, open paths and thin strokes are pickable within a constant screen-pixel tolerance at every zoom. _Data:_ — _Test:_ A 1 px line at 25 % and 800 %: record the maximum pick distance in screen px at both zooms and match it. _M1·P0·[KNOW][REQ]→V-20_
- [ ] **CV-059** Text picks by text box — a text layer is picked anywhere within its box, not only on glyphs. _Data:_ `TextNode` _Test:_ Click the empty space between two words and inside the box below the last line (fixed-height box): the text is selected. _M3·P1·[KNOW]→V-20_
- [ ] **CV-060** Hover highlight previews the click target — hovering outlines exactly the layer a click would select under the current depth rules; with ⌘/Ctrl held it outlines the deep target. "Highlight layers on hover" disables it. _Data:_ preference _Test:_ Hover a rect inside a group inside a top-level frame: the outline matches the subsequent click's selection; hold ⌘: it outlines the rect. _M1·P1·[KNOW]→V-21_
- [ ] **CV-061** Layers-panel hover highlights on canvas — hovering a row outlines that layer on the canvas, even if it is locked, but not if it is hidden (record). _Data:_ — _Test:_ Hover rows for a locked and a hidden layer and record the canvas feedback. _M1·P2·[KNOW]→V-21_

### 6.6 Click & keyboard selection

- [ ] **CV-062** Click empty canvas clears selection — a click (no drag) on empty canvas deselects everything. _Data:_ `selection` _Test:_ With 3 layers selected, click empty space: the selection is empty. _M1·P0·[KNOW]→V-19_
- [ ] **CV-063** Click selects top-level layer — clicking a top-level shape, group or instance selects that whole top-level layer, never a descendant ("we'll select the parent by default"). _Data:_ `selection` _Test:_ Click a rect inside a top-level group: the group is selected. Click inside a top-level instance: the instance is selected. _M1·P0·[DOC:360040449873 excerpt][KNOW]→V-18_
- [ ] **CV-064** Artboard rule for top-level frames — clicking content inside a top-level frame selects the frame's direct child that contains the hit (even when that child is a group or a nested frame), not the frame itself. _Data:_ `selection`, `parent` _Test:_ Top-level Frame ⊃ Group ⊃ Rect: a click on Rect selects Group. Frame ⊃ Rect: a click selects Rect. _M1·P0·[KNOW]→V-18_
- [ ] **CV-065** Sections are transparent to click depth — clicking content inside a section applies the top-level rules to the section's children (and the artboard rule to frames inside sections). _Data:_ `SectionNode` _Test:_ Section ⊃ Frame ⊃ Rect: a click selects Rect. Section ⊃ Group ⊃ Rect: a click selects Group. _M1·P0·[KNOW]→V-18_
- [ ] **CV-066** Top-level frame background click vs drag — a click on the empty background of a top-level frame that has children does not select the frame (the selection is cleared), and a drag starting there begins a marquee over its children. ⌘/Ctrl+click on the background selects the frame. In an empty top-level frame, a click selects the frame and a drag moves it. _Data:_ — _Test:_ For a frame with children: click its background, then ⌘+click it, then drag on it; record the selection after each. Repeat for an empty frame. _M1·P0·[KNOW][DOC:360040449873 excerpt]→V-19_
- [ ] **CV-067** Selection depth persistence — after selecting a nested layer, clicking another layer within the same parent selects it at the same depth. _Data:_ `selection` _Test:_ Double-click into a group to select child A; a single click on sibling B selects B (not the group). Clicking a layer outside the group reverts to default depth (record). _M1·P0·[KNOW]→V-18_
- [ ] **CV-068** Double-click descends one level — double-clicking a container (group, frame, instance, boolean group) selects its child under the pointer, one level deeper. Repeated double-clicks go deeper. _Data:_ `selection` _Test:_ Frame ⊃ G1 ⊃ G2 ⊃ Rect: the first click selects G1, a double-click selects G2, another double-click selects Rect. Double-click an unselected top-level group: record whether it selects the group or its child. _M1·P0·[DOC:360040449873 excerpt]→V-22_
- [ ] **CV-069** Double-click leaf enters edit mode — double-clicking an already-selected vector/shape enters vector edit (VC) and a text layer enters text edit (TX). _Data:_ — _Test:_ Double-click a selected rectangle: vector edit mode. Double-click a selected text: caret placed at the pointer. _M1·P1·[KNOW]→V-22_
- [ ] **CV-070** Deep select (⌘/Ctrl+click) — selects the deepest visible, unlocked layer under the pointer, regardless of nesting. _Data:_ `selection` _Test:_ Frame ⊃ G1 ⊃ G2 ⊃ Rect: ⌘+click selects Rect directly. _M1·P0·[DOC:360040449873 excerpt]_
- [ ] **CV-071** Shift+click toggles membership — Shift+click adds an unselected target and removes a selected one (target resolved with the click rules). _Data:_ `selection` _Test:_ Select A, Shift+click B: [A, B]. Shift+click A: [B]. _M1·P0·[KNOW][SRC:P3]→V-23_
- [ ] **CV-072** Shift+⌘/Ctrl+click toggles deep target — adds or removes the deepest layer under the pointer. _Data:_ `selection` _Test:_ Select rect A in frame 1, then Shift+⌘+click rect B nested in frame 2: both rects are selected. _M1·P1·[KNOW]→V-23_
- [ ] **CV-073** Ancestor/descendant invariant — the selection never holds a node together with its ancestor. Selecting an ancestor removes its selected descendants; selecting a descendant of a selected node follows Figma (replace or ignore). _Data:_ `PageNode.selection` _Test:_ Select child C, then Shift+click its parent P (via Shift+Enter or a click): the selection is [P] only. Record the reverse case. _M1·P0·[API]→V-23_
- [ ] **CV-074** Multi-parent selection — layers from different parents and frames can be selected together and are transformed together. _Data:_ `selection` _Test:_ ⌘+Shift-click children in two different frames, then drag: both move by the same delta and stay in their parents. _M1·P0·[API][KNOW]→V-29_
- [ ] **CV-075** Enter selects children — Enter replaces each selected container with all of its direct children (including hidden/locked? record). On text it starts text editing; on vectors it enters vector edit; on leaves it does nothing. _Data:_ `children` _Test:_ Select a frame with 3 children and press Enter: 3 children are selected. Press Enter on a text layer: text edit with all text selected or the caret at the end (record). _M1·P0·[DOC:360040449873 excerpt][KNOW]→V-22_
- [ ] **CV-076** Shift+Enter selects parent — Shift+Enter replaces each selected node with its parent (deduplicated). On top-level nodes it does nothing (record). The `\` alias reported by the community is checked. _Data:_ `parent` _Test:_ Select two siblings and press Shift+Enter: only their parent is selected. Repeat with `\`. _M1·P0·[DOC:360040449873 excerpt][SRC:S19]→V-22_
- [ ] **CV-077** Tab / Shift+Tab sibling navigation — Tab selects the next sibling and Shift+Tab the previous one, in layers-panel order, with Figma's wrap-around. With several selected nodes the behavior matches Figma. _Data:_ `children` order _Test:_ Siblings A, B, C (A top in the panel): from A, Tab → B → C → (record wrap); Shift+Tab reverses. With [A, C] selected press Tab and record. _M1·P0·[DOC:360040449873 excerpt][SRC:S15]→V-22_
- [ ] **CV-078** Esc clears the selection — Esc deselects everything, whether the selection is top-level or nested; it does not step up one level (Shift+Enter does). During a gesture, Esc cancels the gesture first; in text or vector edit mode it exits the mode first, leaving the layer selected. _Data:_ `selection` _Test:_ Select a nested rect and press Esc: the selection is empty (record if Figma selects the parent instead). Start a drag and press Esc: the drag is cancelled and the selection is kept. _M1·P0·[SRC:S19][KNOW]→V-22_
- [ ] **CV-079** "Select layer" menu — right-click → Select layer lists every layer under the pointer in layers-panel order, with name and icon. Locked layers are listed with a padlock and can be selected; hidden layers are not listed. Choosing an entry selects that layer. _Data:_ `locked`, `visible` _Test:_ Three stacked visible layers, the middle one locked, plus a hidden fourth: the menu lists the three visible layers (padlock on the middle one) and not the hidden one; choosing the locked one selects it. _M1·P1·[DOC:360041596573 excerpt][DOC:360041112614 excerpt]→V-23_
- [ ] **CV-080** Deleting selected nodes updates selection — after Delete/Backspace the selection becomes empty (or the parent; record). Deleting a node by any other means removes it from the selection and emits a change. _Data:_ `selection` _Test:_ Select a nested rect, press Delete: record the resulting selection. _M1·P0·[API][KNOW]→V-56_
- [ ] **CV-081** Selection box display — one node shows an oriented box aligned with its rotation and 8 handles. Several nodes show the axis-aligned union box with handles plus a member outline on each. A frame's box is its own bounds, never the union of its children. _Data:_ `absoluteTransform` _Test:_ A rotated rect: rotated box. Rect + ellipse: union box. A frame with overflowing children: box = frame bounds. _M1·P0·[KNOW][REQ][SRC:P3]→V-33_

### 6.7 Marquee selection

- [ ] **CV-082** Marquee from empty canvas — dragging from empty canvas draws a rectangle and selects every top-level non-frame layer whose bounds intersect it (partial overlap is enough). _Data:_ `absoluteBoundingBox` _Test:_ Touch only the corner of a rect: it is selected. _M1·P0·[KNOW]→V-24_
- [ ] **CV-083** Top-level frames need full containment — a top-level frame is marquee-selected only if fully enclosed. A partial overlap selects the frame's intersecting direct children instead. _Data:_ — _Test:_ Cover half of a frame containing two children, only one of them touched: only that child is selected. Enclose the whole frame: the frame is selected. _M1·P0·[KNOW]→V-24_
- [ ] **CV-084** Marquee starting inside a top-level frame — dragging from an empty area inside a top-level frame selects the intersecting children of that frame and never moves the frame. _Data:_ — _Test:_ Drag inside a frame across two of its three children: those two are selected; the frame position is unchanged. _M1·P0·[KNOW]→V-24_
- [ ] **CV-085** Marquee respects selection depth — with a nested selection active, a marquee inside that container selects siblings at the same depth. _Data:_ — _Test:_ Double-click into a group, then marquee over two children: both children are selected (not the group). _M1·P1·[KNOW]→V-24_
- [ ] **CV-086** Shift+marquee adds — with Shift held, the marquee result is added to the existing selection (or toggled; record). _Data:_ `selection` _Test:_ Select A, Shift+marquee over B and C: [A, B, C]. Shift+marquee over A again: record. _M1·P0·[KNOW]→V-24_
- [ ] **CV-087** ⌘/Ctrl+marquee deep select — with ⌘/Ctrl held, the marquee selects nested layers, and every layer the rectangle touches is selected (no full-containment requirement). _Data:_ — _Test:_ ⌘+marquee touching only the corner of a rect nested in frame ⊃ group: the rect is selected. ⌘+marquee over frame ⊃ group ⊃ two rects: record whether the group or the rects are selected. _M1·P1·[DOC:360040449873 excerpt][SRC:S16]→V-24_
- [ ] **CV-088** Marquee excludes hidden and locked — hidden or locked layers (and their descendants) are never marquee-selected. _Data:_ `visible`, `locked` _Test:_ Marquee over a locked rect and a visible rect: only the visible one is selected. _M1·P0·[KNOW]→V-24_
- [ ] **CV-089** Live marquee preview and auto-pan — the selection highlight updates during the drag, and dragging beyond the viewport edge auto-pans while extending the marquee. _Data:_ — _Test:_ Drag past the right edge: the canvas scrolls and layers revealed inside the marquee get selected. _M1·P1·[KNOW]→V-24_
- [ ] **CV-090** Zero-area marquee equals click — a press-release without crossing the drag threshold behaves as a click on empty canvas (clears the selection). _Data:_ — _Test:_ A tiny mouse jitter (< threshold) on empty canvas clears the selection and draws no marquee. _M1·P0·[KNOW]→V-28_

### 6.8 Bulk selection commands

- [ ] **CV-091** Select all within scope (⌘A) — selects all layers in the same parent(s) and at the same depth as the current selection; with a top-level frame selected, only top-level layers are selected. With nothing selected, it selects all top-level layers on the current page. _Data:_ `selection`, `children` _Test:_ Select one child of a frame with 5 children and press ⌘A: 5 children are selected. Select a top-level frame and press ⌘A: all top-level layers, and no nested ones, are selected. Clear and press ⌘A: all top-level layers are selected. _M1·P0·[SRC:S5][DOC:360040449873 excerpt][KNOW]→V-25_
- [ ] **CV-092** Select all exclusions — Select all includes or excludes locked and hidden siblings exactly as Figma does. _Data:_ `locked`, `visible` _Test:_ Among 5 siblings, one locked and one hidden: press ⌘A and record which are selected. _M1·P1·[KNOW]→V-25_
- [ ] **CV-093** Select inverse (⇧⌘A) — replaces the selection with the unselected siblings in the same parent(s). _Data:_ `selection` _Test:_ Select 2 of 5 siblings and press ⇧⌘A: the other 3 are selected. _M1·P2·[SRC:S5]→V-25_
- [ ] **CV-094** Select matching layers (⌥⌘A) — selects every layer on the current page that matches the selected layer by name and by ancestor-frame names (top-level frame names and variant names may differ) at the same hierarchy depth. Auto-named text layers match by text style instead of name. Off-screen layers are included; other pages never are. _Data:_ `name`, `parent`, text style _Test:_ Three top-level frames named A, B, C, each ⊃ Card ⊃ Title (text): select Title in A and press ⌥⌘A: all three Titles are selected. Rename one Card to "Card2": that Title is no longer selected. _M1·P2·[DOC:21523793229463 excerpt]_
- [ ] **CV-095** Matching tie-breaks — when several same-named candidates exist in one top-level frame, the candidate with the same child index wins. For text, the one closest in x/y within the frame wins. _Data:_ `children` index _Test:_ Two "Icon" children per frame at indices 0 and 1: select index 1 in A and press ⌥⌘A: index-1 icons are selected in B and C. _M1·P2·[DOC:21523793229463 excerpt]_
- [ ] **CV-096** Matching availability and preview — Select matching layers is offered only when the source is inside a frame or group that is top-level (or in a section). Holding Shift highlights all matches before committing. _Data:_ — _Test:_ A top-level loose rect: the command is unavailable or a no-op. Inside a frame: available; Shift shows highlights (record the trigger location). _M1·P2·[DOC:21523793229463 excerpt]→V-25_
- [ ] **CV-097** Select all with same property — the Edit → Select all with same fill / stroke / effect / text properties / font / instance commands select all matching layers in Figma's scope. _Data:_ `fills`, `strokes`, `effects`, text style, `mainComponent` _Test:_ Three red rects and one blue rect: "same fill" from a red rect selects the 3 red rects. Record the scope (page or frame) and the exact command list. _M1·P2·[SRC:S12]→V-25_

### 6.9 Locked & hidden layers

- [ ] **CV-098** Lock toggle — ⇧⌘L / Ctrl+Shift+L, context-menu Lock/Unlock and the layers-panel padlock toggle `locked` on every selected node. It is one undo step. _Data:_ `locked` _Test:_ Select 3 nodes and press ⇧⌘L: all are locked; undo unlocks all. _M1·P0·[DOC:360041596573 excerpt]_
- [ ] **CV-099** Locked nodes editable via panel — a locked node can be selected in the layers panel and its properties edited in the inspector, but it cannot be clicked or dragged on the canvas. _Data:_ `locked` _Test:_ Select a locked rect from the panel and change its fill and X: both apply. Dragging on the canvas does not move it. _M1·P0·[DOC:360041596573 excerpt]_
- [ ] **CV-100** Lock inheritance — locking a container makes all descendants effectively locked. A child cannot be unlocked while its ancestor is locked. _Data:_ `locked` (effective = OR of ancestors) _Test:_ Lock a frame: its children cannot be clicked. Try to unlock one child: not possible until the frame is unlocked. _M1·P0·[DOC:360041596573 excerpt][API]_
- [ ] **CV-101** Bulk lock by dragging padlocks — dragging across padlock icons in the layers panel sets all crossed rows to the first row's new state. _Data:_ `locked` _Test:_ Drag over 4 rows: all 4 are locked, in one undo step (record). _M1·P1·[DOC:360041596573 excerpt]→V-26_
- [ ] **CV-102** Locked nodes and transforms of others — locked descendants move, resize via constraints and rotate with an unlocked ancestor. Whether locked nodes act as snap targets and redline targets follows Figma. _Data:_ `locked` _Test:_ Move a frame containing a locked child: the child moves too. Drag another rect near a locked rect: record whether it snaps. _M1·P1·[KNOW]→V-26_
- [ ] **CV-103** Keyboard/handles on a panel-selected locked node — arrow nudges, ⌘-arrow resize and canvas handles on a locked node selected via the panel behave as in Figma (blocked or allowed). _Data:_ `locked` _Test:_ Select a locked rect in the panel and press →: record whether X changes; try dragging a handle. _M1·P1·[KNOW]→V-26_
- [ ] **CV-104** Hide toggle — ⇧⌘H / Ctrl+Shift+H, the context menu and the eye icon toggle `visible`. Hidden nodes are not rendered, hit-tested or exported, and their render bounds are null. _Data:_ `visible`, `absoluteRenderBounds` _Test:_ Hide a rect: it disappears; clicks pass through; export of the parent frame omits it; show restores it. _M1·P0·[API][SRC:S9]→V-27_
- [ ] **CV-105** Visibility inheritance — a node renders only if it and all its ancestors are visible. A hidden child stays hidden when its parent is shown. _Data:_ `visible` (effective = AND) _Test:_ Hide the child, then hide and show the parent: the child stays hidden. _M1·P0·[API]_
- [ ] **CV-106** Selected hidden node feedback — a hidden node selected from the panel shows its selection bounds on the canvas (or not; record), and its X/Y/W/H stay editable. _Data:_ `visible` _Test:_ Select a hidden rect from the panel: record the canvas feedback; change X: the value persists. _M1·P1·[KNOW]→V-27_

### 6.10 Move & reparent

- [ ] **CV-107** Drag threshold — a press becomes a move only after the pointer travels more than Figma's threshold (screen px). Below it, the press is a click. _Data:_ — _Test:_ Press on a rect and move 1, 2, 3, 4 px: record when the move starts; the X/Y change only after the threshold. _M1·P0·[KNOW]→V-28_
- [ ] **CV-108** Press-drag on unselected layer — pressing on an unselected layer and dragging selects it (click-depth rules) and moves it in one gesture. _Data:_ `selection`, `x`, `y` _Test:_ With nothing selected, drag a rect 50 px: it is selected and moved; one undo restores its position. _M1·P0·[KNOW]→V-28_
- [ ] **CV-109** Move the whole selection exactly once — dragging moves every selected node by the same page-space delta. A descendant of a moving node is never moved separately. Nodes stay in their parents unless reparented. _Data:_ `relativeTransform` _Test:_ Select two top-level frames and drag 100 px: each frame and its children move exactly 100 px (children's local X/Y unchanged). _M1·P0·[REQ][SRC:P3]→V-29_
- [ ] **CV-110** Shift constrains move axis — holding Shift (pressed before or during the drag) locks the movement to the dominant axis: horizontal, vertical, or 45° diagonal if Figma allows it. _Data:_ — _Test:_ Drag (100, 20) with Shift: ΔY = 0. Drag (100, 95): record whether 45° snapping occurs. _M1·P0·[KNOW]→V-28_
- [ ] **CV-111** Alt/Option-drag duplicates — dragging with Alt held leaves the original in place and moves a duplicate (inserted above the original in the same parent). Toggling Alt mid-drag switches between duplicate and move as in Figma. _Data:_ `children` _Test:_ Alt-drag a rect: 2 rects; undo once: 1 rect at the original position. Press Alt only after starting to drag: record. _M1·P0·[SRC:S1][KNOW]→V-28_
- [ ] **CV-112** Esc cancels a drag — pressing Esc during a move restores all nodes to their pre-drag positions and parents and records no undo step. _Data:_ — _Test:_ Drag halfway, press Esc, release: positions are unchanged and the undo stack is unchanged. _M1·P1·[KNOW][REQ]→V-28_
- [ ] **CV-113** Auto-pan during drag — moving the pointer near or beyond the viewport edge during a move, resize or marquee scrolls the canvas, and the gesture continues. _Data:_ `viewport` _Test:_ Drag a rect to the window edge and hold: the canvas scrolls and the rect follows the pointer in page space. _M1·P1·[KNOW]→V-28_
- [ ] **CV-114** Reparent into frame on drop — dropping layers where the deepest eligible frame under the pointer differs from their parent reparents them into that frame. The absolute transform is preserved and they are placed on top of the new parent's z-order. Groups are never drop targets. _Data:_ `parent`, `relativeTransform`, `children` _Test:_ Drag a top-level rect into a frame: the panel shows it inside the frame, its absolute position is unchanged, and the local X/Y is recomputed. Drag over a group: no reparent into the group. _M1·P0·[KNOW]→V-29_
- [ ] **CV-115** Reparent out of frame — dragging a child fully out of its frame onto empty canvas moves it to the page (or to the enclosing section/frame under the pointer). _Data:_ `parent` _Test:_ Drag a frame child onto empty canvas: it becomes top-level with the same absolute position. Record whether partial overlap keeps it inside. _M1·P0·[KNOW]→V-29_
- [ ] **CV-116** Drop-target decision rule — whether the pointer position or the dragged bounds decide the new parent, and which modifier (if any) suppresses reparenting, match Figma. _Data:_ — _Test:_ Drag a large rect so that the pointer is inside a frame but most of the rect is outside: record the parent. Repeat while holding ⌘, Space and Ctrl. _M1·P0·[KNOW]→V-29_
- [ ] **CV-117** Section drop rules — frames and layers can be dropped into sections. Sections cannot be dropped into frames or groups (the drop is refused or the section stays top-level). _Data:_ `SectionNode` _Test:_ Drag a frame into a section: it is reparented. Drag a section onto a frame: it is not nested (record). _M1·P1·[SRC:P5][KNOW]→V-29_
- [ ] **CV-118** Auto-layout children are flow-positioned — X/Y of non-absolute auto-layout children are computed and read-only. Dragging such a child reorders it within the flow (AL) instead of setting X/Y. _Data:_ `x`, `y`, `layoutPositioning` _Test:_ Drag the first of three auto-layout children past the second: the order changes; the X/Y fields are disabled. _M4·P0·[API][SRC:P2]→V-29_
- [ ] **CV-119** Instance sublayers cannot move — children of instances cannot be dragged, reparented or nudged. Attempts move the selected instance child nowhere (or select the instance; record). _Data:_ `InstanceNode` _Test:_ Deep-select a rect inside an instance and drag: record that its position is unchanged. _M5·P0·[API][KNOW]→V-57_
- [ ] **CV-120** Move rounding with pixel snap — with Snap to pixel grid on, a drag ends with integer X/Y for unrotated nodes (rotated nodes per Figma). With it off, fractional values are kept at low zoom. _Data:_ `x`, `y` _Test:_ At 30 % zoom drag a rect: X/Y integer (on) vs fractional (off). Repeat with a 30°-rotated rect and record. _M1·P0·[DOC:360041065034 excerpt]→V-11_
- [ ] **CV-121** Move preserves everything but translation — moving changes only the translation of `relativeTransform` (and the parent if reparented), never rotation, size or child-local values. _Data:_ `relativeTransform` _Test:_ Move a rotated frame: its rotation and its children's local X/Y are unchanged. _M1·P0·[API]_

### 6.11 Nudge

- [ ] **CV-122** Small nudge — the arrow keys move every selected node by the small nudge (default 1) in document units, independent of zoom. _Data:_ preference `smallNudge`, `x`, `y` _Test:_ At 25 % and at 800 %, → moves X +1. _M1·P0·[DOC:4404575206295 excerpt]_
- [ ] **CV-123** Big nudge — Shift+arrow moves by the big nudge (default 10). _Data:_ preference `bigNudge` _Test:_ Shift+↓ moves Y +10. _M1·P0·[DOC:4404575206295 excerpt]_
- [ ] **CV-124** Nudge amount preferences — Preferences → Nudge amount edits the small and big values (positive; decimal acceptance per Figma). They apply immediately and persist as a user-level preference across documents. _Data:_ preferences _Test:_ Set big = 8: Shift+→ moves +8 in every open document and after restart. Try 0.5 and record. _M1·P1·[DOC:4404575206295 excerpt][SRC:S3]→V-30_
- [ ] **CV-125** Nudge of auto-layout children — arrow keys on a non-absolute auto-layout child reorder it within the flow instead of changing X/Y (AL). _Data:_ `layoutPositioning` _Test:_ Select the first child of a horizontal auto layout and press →: it swaps with the second (record). _M4·P1·[KNOW]→V-30_
- [ ] **CV-126** Nudge rounding with fractional positions — nudging a node at X = 10.4 with pixel snap on gives 11.4 or 11 (or 10→11) exactly as Figma. _Data:_ `x` _Test:_ Set X = 10.4 and press →: record the result. _M1·P1·[KNOW]→V-30_
- [ ] **CV-127** Resize by nudge — ⌘/Ctrl+→/↓ grow width/height by the small nudge and ⌘/Ctrl+←/↑ shrink them, anchored at the top-left. With Shift, they use the big nudge. Frame children follow constraints. _Data:_ `width`, `height` _Test:_ ⌘+→ on a 100×100 rect: 101×100, X unchanged. ⇧⌘+↑: H −10. _M1·P1·[KNOW]→V-30_
- [ ] **CV-128** Nudge undo granularity — undo after a burst of arrow presses (individual presses and key-repeat) reverts exactly as Figma does (one step per press, or coalesced). _Data:_ history _Test:_ Press → five times, then ⌘Z once: record X. _M1·P1·[KNOW]→V-56_

### 6.12 Resize

- [ ] **CV-129** Corner and edge handles — the selection box has 4 corner handles (both axes) and 4 resizable edges (one axis). Dragging keeps the opposite corner/edge fixed in page space. _Data:_ `width`, `height`, `relativeTransform` _Test:_ Drag the bottom-right corner by (+20, +10): W+20, H+10, X/Y unchanged. Drag the left edge by −20: W+20, X−20. _M1·P0·[KNOW]→V-31_
- [ ] **CV-130** Shift keeps proportions — with Shift, a corner drag keeps the starting W:H ratio, following the dominant axis. An edge drag with Shift scales the other axis proportionally (centered on the anchor line) as in Figma. _Data:_ `width`, `height` _Test:_ 200×100 rect: Shift-drag the corner to W=300 → H=150. Shift-drag the right edge +100 and record H and Y. _M1·P0·[KNOW]→V-31_
- [ ] **CV-131** Alt/Option resizes from center — with Alt, the box resizes symmetrically about its center (each side moves equally). _Data:_ — _Test:_ 100×100 rect at (0,0): Alt-drag the right edge +10 → X −10, W 120. _M1·P0·[DOC:360040450233 excerpt][KNOW]→V-31_
- [ ] **CV-132** Shift+Alt combined — proportional resize about the center. _Data:_ — _Test:_ 200×100 at (0,0): Shift+Alt corner to W=300 → H=150, center unchanged. _M1·P1·[KNOW]→V-31_
- [ ] **CV-133** Aspect-ratio lock — with the inspector lock on (`targetAspectRatio` set), canvas, inspector, constraint and auto-layout resizes keep the ratio without Shift. The effect of Shift while locked follows Figma. _Data:_ `targetAspectRatio`, `lockAspectRatio()` _Test:_ Lock 2:1 and drag the corner freely: the ratio stays 2:1. Edit W=50: H=25. Record the effect of Shift. _M1·P0·[API]→V-31_
- [ ] **CV-134** Flip-through on resize — dragging a handle past the opposite edge reflects the node on that axis (when "Flip objects while resizing" is on) and the resize continues. When the preference is off, the size clamps instead. _Data:_ `relativeTransform` (det −1) _Test:_ Drag the right edge of a rect with an arrow-shaped fill past its left edge: the content is mirrored. Record the rotation field and X. _M1·P1·[KNOW]→V-32_
- [ ] **CV-135** Rotated node resize in local axes — handles of a rotated node resize along its own axes. The opposite handle stays fixed in page space and the rotation is unchanged. _Data:_ `relativeTransform` _Test:_ 45°-rotated rect: drag the local-right edge: W changes, H and rotation unchanged, the opposite edge midpoint is fixed in page coordinates. _M1·P0·[KNOW]→V-33_
- [ ] **CV-136** Frame resize applies constraints — resizing a frame (canvas or inspector) repositions and resizes its children per their constraints (FR owns the math). _Data:_ `constraints` _Test:_ A child pinned Right inside a 200-wide frame: widen the frame to 300 and the child's right offset is unchanged. _M1·P0·[API]_
- [ ] **CV-137** ⌘/Ctrl ignores constraints during frame resize — holding ⌘/Ctrl while dragging a frame handle resizes only the frame; the children keep their page geometry. Releasing ⌘ mid-drag restores constrained behavior from the gesture baseline. _Data:_ `resizeWithoutConstraints` _Test:_ Same fixture: ⌘-drag widen → the child's absolute position is unchanged. Record whether the inspector W/H edit has an equivalent. _M1·P1·[SRC:P1]→V-35_
- [ ] **CV-138** Group resize scales children — resizing a group (canvas or W/H fields) scales its children's positions and sizes proportionally. Stroke weights and text sizes do not scale. _Data:_ `GroupNode` _Test:_ A group of two 50×50 rects 50 apart: resize the group to 2× width; each rect becomes 100 wide and the gap 100; strokes unchanged. _M1·P0·[KNOW]→V-33_
- [ ] **CV-139** Section resize leaves children untouched — resizing a section never moves or resizes its children. _Data:_ `SectionNode.resize` _Test:_ Shrink a section over its children: the children keep their absolute positions (record whether they are re-parented out). _M1·P1·[API]→V-29_
- [ ] **CV-140** Multi-selection resize — resizing a multi-selection scales each node's position and size relative to the union box and its anchor. Each node is handled once; rotated members follow Figma's rule. _Data:_ `x`, `y`, `width`, `height` _Test:_ Two rects (0,0,100,100) and (200,0,100,100): drag the union's right edge from 300 to 600 → rects (0,0,200,100) and (400,0,200,100). Add a 30°-rotated rect and record. _M1·P0·[KNOW]→V-33_
- [ ] **CV-141** Text resize changes sizing mode — resizing an auto-width text box sets fixed width with auto height; resizing an auto-height box vertically sets fixed size (TX owns the details). _Data:_ `textAutoResize` _Test:_ Drag the right edge of auto-width text: the mode becomes auto height and the text wraps. _M3·P0·[KNOW]→V-36_
- [ ] **CV-142** Auto-layout sizing on manual resize — manually resizing a Hug auto-layout frame, or a Fill/Hug child, on an axis switches that axis to Fixed (AL owns the details). _Data:_ `layoutSizingHorizontal` _Test:_ Drag the right edge of a Hug frame: horizontal sizing becomes Fixed. _M4·P0·[KNOW]→V-36_
- [ ] **CV-143** Variable-bound size on manual resize — resizing a node whose width/height is bound to a variable behaves as in Figma (detaches the binding or is blocked). _Data:_ `boundVariables.width` _Test:_ Bind W to a variable (=120) and drag the edge: record whether the binding remains and the value. _M6·P1·[KNOW]→V-37_
- [ ] **CV-144** Inspector W/H anchoring — typing W/H keeps the node's X/Y (top-left) fixed for unrotated nodes. Rotated nodes follow Figma's anchor. Frames apply constraints to their children. _Data:_ `width`, `height` _Test:_ Rect at (10,10): set W=300 → X stays 10. A 45° rect: set W and record which point stays fixed. _M1·P0·[KNOW]→V-35_
- [ ] **CV-145** Small-object handles — when a selection is small on screen, handles and edges hide or shrink per Figma so that dragging inside still moves. _Data:_ — _Test:_ Zoom until a rect is 8×8 screen px: record which handles remain; dragging the center moves it. _M1·P1·[KNOW]→V-34_
- [ ] **CV-146** Space during resize — holding Space during a resize drag moves the box instead of resizing it (as during shape creation), if Figma supports it. _Data:_ — _Test:_ Start a corner resize and hold Space while moving: record. _M1·P2·[KNOW]→V-31_
- [ ] **CV-147** Resize snapping — the moving edges snap to object edges/centers, guides and the pixel grid; the fixed edge never moves. _Data:_ — _Test:_ Resize the right edge near another rect's left edge (within the threshold): it snaps and the smart guide shows. _M1·P0·[KNOW]→V-41_

### 6.13 Rotate

- [ ] **CV-148** Rotation zones — hovering just outside each corner handle shows the rotate cursor. Dragging rotates. The zone size is constant in screen px. _Data:_ `rotation` _Test:_ Record the pointer distances at which the rotate cursor appears at 50 % and 400 %; they are equal in screen px. _M1·P0·[KNOW]→V-38_
- [ ] **CV-149** Rotation pivot — on-canvas rotation pivots about the center of the selection bounds; the center stays fixed. _Data:_ `relativeTransform` _Test:_ Rotate a 100×50 rect at (0,0) by 90°: its center stays at (50,25). _M1·P0·[KNOW]→V-38_
- [ ] **CV-150** Shift snaps to 15° — with Shift held during rotation, the angle snaps to multiples of 15° (absolute angle or delta, per Figma). _Data:_ `rotation` _Test:_ Starting at 7°, Shift-rotate: record whether values are 15, 30 … or 22, 37 …. _M1·P0·[SRC:S4]→V-38_
- [ ] **CV-151** Rotation field — the field accepts degrees with decimals and expressions, normalizes to (−180, 180], and rotates about the node's center. _Data:_ `rotation` _Test:_ Type 450: the field reads 90. Type 12.5: 12.5. The center position is unchanged (record). _M1·P0·[API][SRC:S4][KNOW]→V-38_
- [ ] **CV-152** Multi-selection rotation — dragging rotates all selected nodes as one rigid unit about the union center (positions orbit; each rotation += Δ). The field shows Mixed for differing values; typing sets each node's rotation about its own center (per Figma). _Data:_ `rotation`, `x`, `y` _Test:_ Two rects side by side, rotate 90° on the canvas: they end up stacked vertically. Type 0: record. _M1·P0·[KNOW]→V-38_
- [ ] **CV-153** Container rotation keeps child locals — rotating a frame or group rotates its content visually while children's container-relative X/Y/rotation stay unchanged (frame) or are re-derived (group, per Figma). _Data:_ `relativeTransform` _Test:_ Rotate a frame 30°: a child's X/Y/rotation fields are unchanged. Record the same for a group. _M1·P0·[API]→V-04_
- [ ] **CV-154** Rotate 90° / 180° commands — Object menu commands rotate the selection by exactly ±90° or 180° about its center. _Data:_ `rotation` _Test:_ Rotate 90° right on a 0° rect: rotation −90 (clockwise). Record shortcuts if any. _M1·P2·[KNOW]→V-38_
- [ ] **CV-155** Rotated auto-layout children — rotating an auto-layout child is allowed, and the flow uses its rotated bounding box (AL). _Data:_ `rotation` _Test:_ Rotate a 100×20 child by 90°: siblings reflow as if it were 20×100. _M4·P1·[KNOW]→V-58_

### 6.14 Flip

- [ ] **CV-156** Flip horizontal (⇧H) — mirrors the selection about the vertical center line of its bounds. The bounds stay in place. _Data:_ `relativeTransform` _Test:_ A right-pointing arrow vector becomes left-pointing; its bounding box is unchanged. _M1·P0·[KNOW]→V-03_
- [ ] **CV-157** Flip vertical (⇧V) — mirrors about the horizontal center line. _Data:_ `relativeTransform` _Test:_ An up-pointing triangle becomes down-pointing; its bounds are unchanged. _M1·P0·[KNOW]→V-03_
- [ ] **CV-158** Multi-selection flip — each node is mirrored and its position mirrored inside the union bounds. _Data:_ — _Test:_ Rects at x = 0 and x = 200 (each 50 wide) with different colors: after ⇧H, the colors swap sides. _M1·P1·[KNOW]→V-03_
- [ ] **CV-159** Flip encoding and displayed rotation — after a flip, the stored transform is a reflection and the rotation field shows Figma's value (e.g. 180° after a horizontal flip of a 0° node). Flipping twice restores the original matrix. _Data:_ `relativeTransform`, `rotation` _Test:_ ⇧H on a 0° rect: record the rotation field and the Plugin API matrix. ⇧H again: identity. _M1·P0·[API][KNOW]→V-03_
- [ ] **CV-160** Flip of text and containers — flipped text renders mirrored and stays editable. A flipped frame mirrors all descendants without changing their local transforms. _Data:_ `TextNode`, `FrameNode` _Test:_ Flip a text layer, double-click: editable and mirrored. Flip a frame: a child's X/Y fields are unchanged. _M3·P1·[KNOW]→V-03_

### 6.15 Scale tool (K)

- [ ] **CV-161** Scale tool activation — K (or the toolbar) activates the Scale tool. While it is active, handle drags scale proportionally, and the tool stays active until another tool is chosen. _Data:_ — _Test:_ Press K and drag a corner: W:H is kept. Press V: the Move tool is active again. _M1·P1·[DOC:360040451453 excerpt][KNOW]→V-39_
- [ ] **CV-162** Scale ignores nested constraints — scaling a frame scales all descendants proportionally, ignoring their constraints. _Data:_ `rescale` _Test:_ A frame with a child pinned Left+Right: scale 2× → the child doubles in size and position (not stretched by constraint math). _M1·P1·[DOC:360040451453 excerpt][API]_
- [ ] **CV-163** Scale scales style properties — the Scale tool scales stroke weights and blur radii, and everything else Figma scales (shadow offset/spread, corner radii, font size, line height, letter spacing, auto-layout padding/gap, layout guides). _Data:_ `strokeWeight`, `effects`, `cornerRadius`, `fontSize`, `itemSpacing`, `padding*` _Test:_ A rect with 2 px stroke, 8 px radius, shadow (0,4,8), and a 16 px text, scaled 2×: record every resulting value and match it. _M2·P1·[DOC:360040451453 excerpt][KNOW]→V-39_
- [ ] **CV-164** Scale panel numeric input — while the Scale tool is active, the inspector shows a scale factor, W/H fields and a 9-point anchor box. Numeric scaling keeps the chosen anchor fixed. _Data:_ `rescale` _Test:_ Anchor = center, factor 2: the center is unchanged and W/H double. Anchor = top-left: X/Y unchanged. _M1·P1·[DOC:360040451453 excerpt]_
- [ ] **CV-165** Scale modifiers on canvas — Alt/Option during a Scale-tool drag scales from the center. Shift has Figma's effect (if any). _Data:_ — _Test:_ K, then Alt-drag a corner: the center is fixed. _M1·P2·[SRC:S8]→V-39_
- [ ] **CV-166** Scale factor lower bound — scaling below a factor of 0.01 is clamped (API minimum). _Data:_ `rescale(scale ≥ 0.01)` _Test:_ Enter 0.001×: record the clamp. _M1·P2·[API]_
- [ ] **CV-167** Scaling instances writes overrides — Scale on an instance scales its contents as overrides (font size etc.) without detaching. _Data:_ `InstanceNode` _Test:_ Scale an instance 2×: it is still an instance; text size overrides show as changed (record the reset behavior). _M5·P1·[KNOW]→V-39_

### 6.16 Numeric input, precision & rounding

- [ ] **CV-168** Display precision — numeric fields display values rounded to Figma's precision (≤ 2 decimals) while the stored value keeps full precision. Re-committing an unedited field never changes the stored value. _Data:_ `x`, `y`, `width`, `height`, `rotation` _Test:_ Set X = 10.12345 via the API: the field shows 10.12; focus and blur without editing: the API still returns 10.12345. _M1·P0·[KNOW][REQ]→V-01_
- [ ] **CV-169** Math expressions — fields accept `+ − * /` and parentheses (e.g. `100/3`, `50+25`, `(10+5)*2`) and commit the evaluated value. _Data:_ — _Test:_ Type `100/3` in W: 33.33 (stored 33.333…; record). _M1·P1·[KNOW]→V-40_
- [ ] **CV-170** Mixed values in multi-selection — differing values show "Mixed". An absolute entry sets every node; a relative entry (e.g. `+10`) is applied per node, if Figma supports it. _Data:_ — _Test:_ Rects with X = 0 and 50: the field shows Mixed. Type 20: both X = 20. Type `+10` (from Mixed): record. _M1·P0·[KNOW]→V-40_
- [ ] **CV-171** Multi-selection X/Y/W/H semantics — the meaning of X/Y/W/H for a multi-selection (union box vs. per-node values) and the effect of editing them match Figma. _Data:_ — _Test:_ Select rects (0,0,100,100) and (200,50,50,50): record the displayed X/Y/W/H; set W = 400 and record each rect. _M1·P0·[KNOW]→V-40_
- [ ] **CV-172** Arrow keys and scrubbing in fields — in a focused field, ↑/↓ change the value by 1 (Shift: big nudge). Dragging the field label/icon scrubs the value (Shift: big step). Each scrub is one undo step. _Data:_ preferences _Test:_ Focus X = 10 and press Shift+↑: 20 (or per the big nudge). Scrub right 20 px: record the delta; undo once to restore. _M1·P1·[DOC:4404575206295 excerpt][SRC:P4]→V-40_
- [ ] **CV-173** Invalid input rejection — non-numeric or empty input reverts to the previous value without an undo step. Division by zero is rejected. _Data:_ — _Test:_ Type "abc" in X and press Enter: the old value returns; the undo stack is unchanged. _M1·P1·[KNOW]→V-40_
- [ ] **CV-174** Round to pixel command — Arrange → Round to pixel rounds the X/Y/W/H of the selected nodes (and descendants? record) to integers in one undo step. _Data:_ `x`, `y`, `width`, `height` _Test:_ A rect at (10.4, 20.6) 99.5×50.2: after the command, record the values. _M1·P2·[SRC:P4][KNOW]→V-47_

### 6.17 Snapping & smart guides

- [ ] **CV-175** Snap to object edges and centers — while moving, the selection bounds' left/center/right (x) and top/middle/bottom (y) lines snap to the corresponding lines of nearby objects within the threshold. A red smart guide shows each coinciding line. _Data:_ preference "Snap to objects" _Test:_ Drag rect B so that its left edge is 2 screen px from rect A's left edge: B snaps to A's x, and a red vertical guide spans both. _M1·P0·[KNOW]→V-41_
- [ ] **CV-176** Snap to parent frame — the moving layer snaps to its (target) parent frame's edges and center lines. _Data:_ — _Test:_ Drag a child near the frame's horizontal center: it snaps so that the centers coincide. _M1·P0·[KNOW]→V-41_
- [ ] **CV-177** Snap threshold in screen space — the snap distance is a constant number of screen pixels, independent of zoom. _Data:_ — _Test:_ At 25 % and 400 %, record the largest screen-px offset that still snaps; both are equal and match Figma. _M1·P0·[KNOW][REQ]→V-41_
- [ ] **CV-178** Snap candidate set — the objects considered for snapping (siblings only, the target parent's descendants, all visible layers in the viewport, or every layer on the page) match Figma. The moving nodes and their descendants and hidden layers are excluded; locked layers per Figma. _Data:_ — _Test:_ Off-screen rect alignment, a rect in another frame, a locked rect: record which of them produce snaps. _M1·P0·[KNOW]→V-41_
- [ ] **CV-179** Equal-spacing snapping — when a moving layer reaches a position where its gap to a neighbor equals an existing gap between neighbors (or it is centered between two neighbors), it snaps there and spacing markers with the gap value are shown. _Data:_ — _Test:_ Rects A, B with a 40 px gap; drag C to the right of B: it snaps at a 40 px gap with two spacing labels "40". _M1·P0·[KNOW]→V-41_
- [ ] **CV-180** Distance labels during move — smart guides show distance values between the moving layer and its snapped/nearby neighbors as in Figma. _Data:_ — _Test:_ Drag a rect toward another: record which distance labels appear and when. _M1·P1·[KNOW]→V-41_
- [ ] **CV-181** Snap to ruler guides and layout guides — moving and resizing layers snap to page and frame ruler guides and to layout-guide column/row edges (FR). _Data:_ `guides`, `layoutGrids` _Test:_ Guide at x = 100: drag a rect's left edge near it and it snaps to 100. Same for a column edge. _M1·P0·[KNOW]→V-41_
- [ ] **CV-182** Rotated objects snap by bounding box — rotated nodes snap using their axis-aligned bounding box lines (or Figma's rule). _Data:_ `absoluteBoundingBox` _Test:_ Drag a 45° rotated square near a vertical edge: record which line snaps. _M1·P1·[KNOW]→V-41_
- [ ] **CV-183** Snapping preferences — "Snap to geometry", "Snap to objects" and "Snap to pixel grid" are independent toggles. Turning off Snap to objects disables object/guide smart snapping during move and resize. _Data:_ preferences _Test:_ Snap to objects off: a drag near another rect does not snap; pixel snapping still applies if that toggle is on. _M1·P0·[SRC:S1][DOC:360041065034 excerpt][KNOW]→V-43_
- [ ] **CV-184** Temporary snap suspension — holding Figma's suspension key while dragging (reported: Control on macOS, S on Windows) disables object snapping for that drag only. ⌘ does not suspend snapping. _Data:_ — _Test:_ On each platform, drag near another rect while holding Ctrl, S or ⌘ in turn: record which one suppresses the red guides. _M1·P1·[SRC:S1]→V-42_
- [ ] **CV-185** Order of object snap and pixel snap — the final position after object snapping and pixel rounding matches Figma when the snap target sits on a fractional coordinate. _Data:_ — _Test:_ Target rect at x = 10.5; drag a rect to snap its left edge to it with pixel snap on: record 10.5 vs 10/11. _M1·P1·[KNOW]→V-11_
- [ ] **CV-186** Text-box centering snap on vertical resize — dragging a text box's top or bottom edge snaps at the height where the box is centered around its text. _Data:_ `TextNode`, `height`, `textAutoResize` _Test:_ A fixed-size 3-line text box: drag the bottom edge toward the height that equalizes the space above and below the text; it snaps there (record the threshold and any guide shown). _M3·P2·[SRC:S20]→V-41_
- [ ] **CV-187** Container resize snaps to centered children — resizing a frame or section snaps at the size where its children are centered in it. _Data:_ `FrameNode`, `SectionNode`, `width`, `height` _Test:_ A 200-wide frame with one child at x = 40, w = 100: drag the right edge toward 180; it snaps at 180 (child centered) — record the feedback shown. Repeat for a section. _M1·P2·[SRC:S20]→V-41_
- [ ] **CV-188** Smart guides are transient — snapping guides and labels appear only during the gesture, are not selectable, and are never exported or saved. _Data:_ — _Test:_ Export during or after a drag: no guide pixels; file diff unchanged. _M1·P0·[KNOW][REQ]→V-41_

### 6.18 Measurement (redlines)

- [ ] **CV-189** Alt/Option hover measurement — with layer A selected, holding Alt/Option and hovering layer B shows red lines with the horizontal and vertical distances between A's and B's bounding boxes. _Data:_ `absoluteBoundingBox` _Test:_ A at (0,0,100,100), B at (150,120,50,50): labels show 50 (horizontal) and 20 (vertical). _M1·P0·[DOC:360039956974 excerpt]_
- [ ] **CV-190** Nested measurement — ⌘+Alt / Ctrl+Alt while hovering measures to layers nested inside frames, groups or components and shows a single measurement. _Data:_ — _Test:_ A selected; hover a rect nested in a group with ⌘⌥: the distance to the nested rect is shown (not to the group). _M1·P0·[DOC:360039956974 excerpt]_
- [ ] **CV-191** Measures bounding boxes only — measurements ignore stroke extents (center/outside strokes) and glyph outlines (text uses its box). _Data:_ `absoluteBoundingBox` _Test:_ B has a 10 px outside stroke: the measured distance is unchanged versus no stroke. _M1·P0·[DOC:360039956974 excerpt]_
- [ ] **CV-192** Distances to a containing layer — hovering the parent frame, or any layer that contains A, shows the distances from A to all four sides of it. _Data:_ — _Test:_ A inside frame F; Alt+hover F: four labels (left, right, top, bottom) are shown. _M1·P0·[KNOW]→V-44_
- [ ] **CV-193** Overlapping layers measurement — when A and B overlap but neither contains the other, the distances shown follow Figma's rule. _Data:_ — _Test:_ A (0,0,100,100), B (50,50,100,100): record the labels. _M1·P1·[KNOW]→V-44_
- [ ] **CV-194** Guide measurement — with a guide selected, Alt-hovering another guide shows both guides' positions on the axis. Frame guides measure as objects to siblings and to the parent frame. _Data:_ `guides` _Test:_ Two vertical guides at 100 and 160: select one, Alt-hover the other, and both positions are shown. _M1·P2·[DOC:360039956974 excerpt][DOC:360040449713 excerpt]_
- [ ] **CV-195** Measurement label rounding and units — labels show values rounded like Figma (decimals as needed), in document units independent of zoom. _Data:_ — _Test:_ A 33.333 px gap: record the label text. _M1·P1·[KNOW]→V-44_
- [ ] **CV-196** Measurement is read-only — holding Alt to measure never changes the document or the selection; Alt during a drag duplicates instead (§6.10). _Data:_ — _Test:_ Measure, release Alt: the document is unchanged and there is no undo step. _M1·P0·[DOC:360039956974 excerpt]_

### 6.19 Align, distribute, Tidy up & Smart selection

- [ ] **CV-197** Align multiple to union bounds — Align left/h-center/right/top/v-center/bottom aligns each selected node's bounding box to the corresponding line of the selection's union box. _Data:_ `x`, `y` _Test:_ Rects at x = 10, 50, 90 with widths 20, 40, 60: Align right → all right edges at 150. _M1·P0·[KNOW]→V-47_
- [ ] **CV-198** Align single to container parent — with one node selected, alignment uses its container parent's bounds. For a top-level node, Figma's behavior applies (disabled or no-op). _Data:_ — _Test:_ A child at x = 30 in a 200-wide frame: Align h-center → x = (200 − w)/2. A top-level rect: record. _M1·P0·[KNOW]→V-47_
- [ ] **CV-199** Align uses axis-aligned bounds for rotated nodes — rotated nodes align by their absolute bounding box. _Data:_ `absoluteBoundingBox` _Test:_ A 45° square plus a rect: Align left → the square's bounding box left edge equals the rect's left edge. _M1·P1·[KNOW]→V-47_
- [ ] **CV-200** Alignment blocked in auto-layout flow — the align controls are disabled (or retarget the parent's alignment; record) when the selection is a non-absolute auto-layout child. _Data:_ `layoutPositioning` _Test:_ Select an auto-layout child: the align buttons are disabled. _M4·P1·[SRC:P2]→V-47_
- [ ] **CV-201** Align across parents and half pixels — aligning nodes from different parents uses page-space bounds. A center alignment that would land on .5 rounds (or not) as in Figma. _Data:_ — _Test:_ Center a 101-wide rect with a 100-wide rect: record the resulting X. _M1·P1·[KNOW]→V-47_
- [ ] **CV-202** Distribute horizontal/vertical spacing — with ≥ 3 nodes, the outermost nodes stay fixed and the inner nodes are placed so that all gaps are equal. No overlap requirement. Fractional gaps per Figma. _Data:_ `x`, `y` _Test:_ Widths 20, 40, 20 at x = 0, 30, 180: distribute → gap = (200 − 80)/2 = 60 → middle at x = 80. With 2 nodes: no-op/disabled. _M1·P0·[DOC:360040450233 excerpt][KNOW]→V-47_
- [ ] **CV-203** Distribute ordering key — nodes are ordered by left/top edge (or by center) exactly as Figma, including ties and overlaps. _Data:_ — _Test:_ Nested/overlapping nodes with equal left edges: record the output order. _M1·P1·[KNOW]→V-47_
- [ ] **CV-204** Tidy up 1D — for a selection overlapping on one axis, Tidy up arranges the layers along the other axis with "the most common spacing in the selection" as the uniform gap, creating a Smart selection. _Data:_ — _Test:_ 4 rects in a row with gaps 10, 10, 30: Tidy up → all gaps 10. _M1·P1·[DOC:360040450233 excerpt]_
- [ ] **CV-205** Tidy up 2D — for a 2D scatter, Tidy up arranges all layers into a grid aligned with the selection's top-left corner. _Data:_ — _Test:_ 6 roughly gridded rects: Tidy up → 2 rows × 3 columns with uniform gaps; the top-left of the grid equals the original selection top-left. Record the gap and order rules. _M1·P1·[DOC:360040450233 excerpt]→V-46_
- [ ] **CV-206** Tidy up details — the shortcut (⌃⌥T), the anchor item, cross-axis alignment, tie handling of the "most common spacing", and row/column clustering match Figma. _Data:_ — _Test:_ Gaps 10, 20 (tie): record the chosen gap; items with mixed heights in one row: record cross-axis alignment. _M1·P2·[KNOW]→V-46_
- [ ] **CV-207** Smart selection detection — when all selected layers are equally spaced and overlap on x or y (1D) or both (2D), hovering the selection shows pink circle handles at the item centers and spacing handles in the gaps. _Data:_ — _Test:_ 3 equally spaced rects: handles appear. Move one by 1 px: handles disappear (Tidy up is offered). _M1·P1·[DOC:360040450233 excerpt]_
- [ ] **CV-208** Smart selection spacing drag — dragging a spacing handle changes every gap uniformly (live). The gap is also editable numerically in the inspector. _Data:_ — _Test:_ Drag a gap handle +10: all gaps +10; type 24 in the spacing field: all gaps 24. _M1·P1·[KNOW]→V-45_
- [ ] **CV-209** Smart selection reorder — dragging an item's center circle reorders or swaps it with other items while keeping the arrangement's spacing. _Data:_ `x`, `y` (and `children` order? record) _Test:_ Drag the first circle past the third: the positions are permuted; record whether the layer order also changes. _M1·P1·[DOC:360040450233 excerpt][KNOW]→V-45_
- [ ] **CV-210** Smart selection delete closes gap — clicking a center handle marks the item and Shift+click marks more. Delete/Backspace removes the marked items, and the remaining items rearrange to close the gap. _Data:_ — _Test:_ 4 items: mark the 2nd and press Delete: 3 items remain with the original uniform gap. _M1·P1·[DOC:360040450233 excerpt]_
- [ ] **CV-211** Smart selection resizing — one item can be resized inside a 2D smart selection, or several inside a 1D one; Alt/Option resizes from the center; the arrangement keeps its spacing. _Data:_ — _Test:_ 1D row: resize the 2nd item wider; the following items shift to keep the gap (record). _M1·P2·[DOC:360040450233 excerpt]→V-45_

### 6.20 Rulers & guides

- [ ] **CV-212** Rulers required for guides — guides can be created only while rulers are visible (⇧R or View → Rulers). _Data:_ preference _Test:_ With rulers hidden there is nothing to drag from. Show the rulers: dragging creates a guide. _M1·P1·[DOC:360040449713 excerpt][SRC:S13]→V-14_
- [ ] **CV-213** Create guide by dragging from a ruler — dragging from the top or left ruler onto the canvas creates a guide perpendicular to that ruler at the release position (snapped per Figma). _Data:_ `Guide.axis`, `Guide.offset` _Test:_ Drag from the left ruler to x = 120: a vertical guide is created; the Plugin API shows axis/offset (record which axis value). _M1·P1·[DOC:360040449713 excerpt][API]→V-48_
- [ ] **CV-214** Frame guide vs canvas guide — releasing a new guide over a frame stores it on that frame, relative to the frame. Elsewhere it is stored on the page. A canvas guide crossing a frame shows a dotted segment over it. _Data:_ `FrameNode.guides`, `PageNode.guides` _Test:_ Drop a guide inside frame F at frame-x 40: F.guides = [{X?, 40}]. Drop one on empty canvas: page.guides grows. _M1·P1·[DOC:360040449713 excerpt][API]→V-48_
- [ ] **CV-215** Frame guides follow their frame — moving, resizing or rotating a frame carries its guides with it (frame-relative). Canvas guides never move with layers. _Data:_ `guides` _Test:_ Move F by +50: its guide moves +50; a canvas guide stays. Record behavior on frame resize from the left edge. _M1·P1·[API][KNOW]→V-48_
- [ ] **CV-216** Duplicate a guide — Alt/Option-dragging an existing guide creates a copy at the release position. _Data:_ `guides` _Test:_ Alt-drag a guide at 100 to 200: guides at 100 and 200. _M1·P2·[DOC:360040449713 excerpt]_
- [ ] **CV-217** Move and delete guides — dragging a guide moves it. Dragging it back onto a ruler deletes it. Selecting a guide and pressing Delete/Backspace deletes it. Each is one undo step. _Data:_ `guides` _Test:_ Move a guide to 150, undo → 100. Drag it to the ruler: removed; undo → back. Click a guide and press Delete: removed. _M1·P1·[DOC:360040449713 excerpt][KNOW]→V-48_
- [ ] **CV-218** Guide distance while dragging — with a top-level frame selected, holding Option (macOS) / Control (Windows) while dragging out a guide shows its distance in px to the frame. _Data:_ — _Test:_ Select F, ⌥-drag a guide: a distance label to F's edge is shown and updates live. _M1·P2·[DOC:360040449713 excerpt]_
- [ ] **CV-219** Guide snapping and position editing — guides snap to object edges/centers and integer pixels while dragged. Whether a guide's position can be typed and whether guides hide with the rulers match Figma. _Data:_ — _Test:_ Drag a guide near a rect edge: it snaps. Hide the rulers: record guide visibility. Select a guide: record whether a position field appears. _M1·P2·[KNOW]→V-48_
- [ ] **CV-220** Guides are document data — guides persist in the file, survive reload, are copied with their frame on duplicate/copy-paste, and are never exported. _Data:_ `guides` _Test:_ Reload: guides remain. Duplicate frame F: the copy has F's guides. Export F: no guide pixels. _M1·P1·[API][KNOW]→V-49_

### 6.21 Duplicate

- [ ] **CV-221** ⌘D duplicates in place — ⌘D/Ctrl+D creates a copy of each selected node in the same parent, directly above its original in z-order, with new IDs. The copies become the selection. _Data:_ `children`, `id` _Test:_ Select rect R (index 2) and press ⌘D: the copy is at index 3 with identical properties and a new ID; it is selected. _M1·P0·[KNOW]→V-49_
- [ ] **CV-222** Duplicate placement — nested layers duplicate at the same position. A top-level frame's copy is placed to the right of the original, in free space (reported: after the last frame of the row, not necessarily next to the original). There is no duplicate-in-place shortcut. _Data:_ `x`, `y` _Test:_ ⌘D on a nested rect: same X/Y. ⌘D on a top-level frame at (0,0) 375×812: record the copy's X/Y and gap. With frames F1…F5 in a row, ⌘D on F2: record where the copy lands. _M1·P0·[KNOW][SRC:S18]→V-49_
- [ ] **CV-223** Duplicate offset memory — ⌘D repeats the last offset applied to the object: after ⌘D (or Alt-drag) followed by moving the copy, the next ⌘D places the new copy at the same offset from the previous copy (series duplication). The memory is reset by other actions per Figma. _Data:_ — _Test:_ ⌘D, nudge the copy +20 x, then ⌘D ×3: copies at +40, +60, +80. Alt-drag +50 then ⌘D: the next copy is at +100. Record what resets the memory, and the result with a 30° rotated object. _M1·P1·[SRC:S18][KNOW]→V-49_
- [ ] **CV-224** Duplicate naming — duplicates keep the original name unless the "Rename duplicated layers" preference (if present) is on; then Figma's increment scheme applies. _Data:_ `name` _Test:_ Duplicate "Card": record the copy's name with the preference off and on. _M1·P2·[KNOW]→V-49_
- [ ] **CV-225** Duplicate deep-copies the subtree — all descendants, properties, constraints, frame guides, export settings and prototype interactions are copied. Interactions pointing inside the copied subtree are remapped (per Figma). _Data:_ — _Test:_ A frame with an internal prototype link: duplicate it and record where the copy's link points. _M1·P1·[KNOW]→V-49_
- [ ] **CV-226** Duplicate inside auto layout — ⌘D on an auto-layout child inserts the copy right after the original in the flow (AL). _Data:_ `children` _Test:_ Duplicate the middle of 3 children: 4 children, the copy at index+1, and the flow reflows. _M4·P0·[KNOW]→V-49_
- [ ] **CV-227** Duplicate of main components — ⌘D or Alt-drag of a main component creates a new main component (not an instance) per Figma (CP). _Data:_ `ComponentNode` _Test:_ ⌘D on a component: record the copy's type. _M5·P1·[KNOW]→V-57_

### 6.22 Clipboard

- [ ] **CV-228** Copy/cut/paste round-trip — ⌘C/⌘X/⌘V copy, cut and paste full subtrees losslessly (all properties, new IDs). Cut is one undo step and paste is one undo step. _Data:_ clipboard payload _Test:_ Copy a complex frame and paste: a structural diff equals the original except for IDs. Cut + undo restores the original IDs. _M1·P0·[REQ][KNOW]→V-50_
- [ ] **CV-229** Paste with nothing selected — pastes at the original page coordinates if that location is visible in the viewport; otherwise centers the paste in the visible area. Pasted nodes are top-level and become the selection. _Data:_ — _Test:_ Copy a rect at (100,100); paste with it visible: (100,100). Pan far away and paste: centered in the view. _M1·P0·[DOC:4409078832791 excerpt (section titles)][SRC:S21][KNOW]→V-50_
- [ ] **CV-230** Paste into selected frame (per-axis fit) — with a frame selected, paste inserts the clipboard inside it, on top. On each axis the copy keeps its offset from its source frame or group if that offset can be matched in the destination; otherwise it is centered on that axis. _Data:_ `parent`, `x`, `y` _Test:_ Copy a 50×50 rect at (20,300) from a 400×400 frame A. Select a 200×200 frame B and paste: inside B at x = 20 (fits) and y = 75 (centered). Paste a 300×300 rect into B: centered on both axes (record the values). _M1·P0·[DOC:4409078832791 excerpt]→V-50_
- [ ] **CV-231** Paste with a non-frame layer selected — pastes into that layer's parent, directly above it in z-order, at the original coordinates (Figma's rule). _Data:_ `parent`, `children` _Test:_ Select a rect inside frame F and paste another rect: it lands in F above the selected rect. _M1·P0·[KNOW]→V-50_
- [ ] **CV-232** Paste and the canvas view — when the computed paste position is outside the visible viewport, the paste follows the article's "Canvas view" rule (pan to the result, or re-place it in view). _Data:_ `viewport` _Test:_ Select an off-screen frame through the layers panel and paste: record where the copy lands and whether the viewport moves. Repeat with the source's parent frame still in view and a different frame selected. _M1·P1·[DOC:4409078832791 excerpt (truncated)][SRC:S21]→V-50_
- [ ] **CV-233** Oversized paste into auto layout — pasting a clip larger than the selected auto-layout frame places it as Figma does (reported: one level up, in the frame's parent). _Data:_ `layoutMode`, `parent` _Test:_ Select a hug-sized 100×40 auto-layout frame and paste a 300×300 rect: record the pasted rect's parent and index. _M4·P2·[SRC:S21]→V-50_
- [ ] **CV-234** Multi-paste into several frames — with several frames selected, paste puts one copy into each selected frame. _Data:_ — _Test:_ Select 3 frames and paste an icon: each frame gains one icon at the same relative position. _M1·P1·[DOC:4409078832791 excerpt (section "Multi-paste")][KNOW]→V-50_
- [ ] **CV-235** Paste over selection (⇧⌘V) — places the copy on top of the selected frame (not inside it) at the selected object's x/y. With nothing selected, the copy is pasted as a top-level layer. _Data:_ `parent`, `x`, `y` _Test:_ Select frame F at (300,200) and press ⇧⌘V: the copy is a sibling above F at (300,200). _M1·P1·[DOC:4409078832791 excerpt][SRC:S6]→V-50_
- [ ] **CV-236** Paste to replace (⇧⌘R) — replaces each selected layer with a copy of the clipboard in the same parent and z-index. The pasted object adopts the replaced object's constraints. Position anchoring (top-left vs center) and size behavior per Figma. _Data:_ `constraints`, `parent`, `children` _Test:_ Replace a 40×40 icon (constraints Right/Bottom, at index 2) with a 24×24 icon: the new icon is at index 2 with Right/Bottom; record its X/Y. Replace 3 selected icons: 3 replacements. _M1·P1·[DOC:4409078832791 excerpt]→V-51_
- [ ] **CV-237** Paste here — context-menu Paste here places the copy's top-left at the pointer position, inside the frame under the pointer. Over an auto-layout frame, the copy is placed on top of the frame, not inside it. _Data:_ `parent`, `x`, `y` _Test:_ Right-click inside frame F at frame-local (30,40) → Paste here: the copy is in F at (30,40). Over an auto-layout frame: the copy is a sibling above it. _M1·P1·[SRC:S6]→V-51_
- [ ] **CV-238** Copy/paste properties — ⌥⌘C / ⌥⌘V (Ctrl+Alt+C / Ctrl+Alt+V) or Copy/Paste as ▸ copy all properties of the source and apply those the target supports. The exact property set (and whether size/position are included) matches Figma. _Data:_ fills, strokes, effects, opacity, blendMode, cornerRadius, text style … _Test:_ Copy properties from a styled rect, paste onto a text layer and onto an ellipse: record exactly which properties change on each. _M2·P1·[DOC:4412765442967 excerpt]→V-52_
- [ ] **CV-239** Copy/paste a single fill, stroke or effect — selecting a fill/stroke/effect row and pressing ⌘C, then selecting another layer's section and pressing ⌘V, adds or replaces that one property (Figma's rule). _Data:_ `fills`, `strokes`, `effects` _Test:_ Copy the 2nd fill of A, select B's fill section and paste: record whether it is appended or replaces. _M2·P1·[DOC:4412765442967 excerpt]→V-52_
- [ ] **CV-240** Paste across pages — copying on Page 1 and pasting on Page 2 (nothing selected) keeps page coordinates when they are visible, otherwise follows the viewport rule. _Data:_ — _Test:_ Copy a rect at (100,100) on Page 1; on Page 2 with (100,100) visible, paste: the rect is at (100,100). _M1·P1·[KNOW]→V-50_
- [ ] **CV-241** Pasting a main component — pasting a copied main component into the same document creates an instance of it (not a second main), per Figma (CP). _Data:_ `ComponentNode`, `InstanceNode` _Test:_ Copy a component and paste: record the pasted node type. _M5·P0·[KNOW]→V-57_

### 6.23 Arrange (z-order)

- [ ] **CV-242** Bring forward / send backward — ⌘] / ⌘[ move each selected node up/down one index among its siblings (no-op at the ends). _Data:_ `children` order _Test:_ Siblings [A, B, C] (C top): select A and press ⌘] → [B, A, C]. _M1·P0·[KNOW]→V-53_
- [ ] **CV-243** Bring to front / send to back — ⌥⌘] / ⌥⌘[ (Windows Ctrl+Shift+] / Ctrl+Shift+[) move the selection to the top/bottom of its parent's children. _Data:_ `children` order _Test:_ Select A and press ⌥⌘] → [B, C, A]. _M1·P0·[KNOW]→V-53_
- [ ] **CV-244** Arrange preserves relative order and never reparents — with several selected siblings, their relative order is preserved. With selections in several parents, each parent is processed independently. Nodes never change parent. _Data:_ `children`, `parent` _Test:_ Select A and C in [A, B, C, D] and press ⌘] → [B, A, D, C] (record). A selection spanning two frames: each frame reorders internally. _M1·P0·[KNOW]→V-53_
- [ ] **CV-245** Forward/backward ignore overlap — the step is one sibling index regardless of visual overlap (if Figma differs, follow Figma). _Data:_ — _Test:_ A non-overlapping sibling between A and B: ⌘] moves A past it (record whether it skips). _M1·P2·[KNOW]→V-53_
- [ ] **CV-246** Arrange in auto layout changes flow order — arrange commands on auto-layout children change their flow position (AL). _Data:_ `children`, `itemReverseZIndex` _Test:_ Bring to front on the first auto-layout child: it moves to the end of the flow (record). _M4·P1·[KNOW]→V-53_

### 6.24 Cursors & context menu

- [ ] **CV-247** Resize cursors follow handle orientation — the cursor over each handle/edge shows the resize direction, rotated with the node's rotation. _Data:_ — _Test:_ A 30° rect: the cursor over its right edge points along the rotated x axis. _M1·P1·[KNOW]→V-55_
- [ ] **CV-248** Rotate, hand and duplicate cursors — a rotate cursor shows in the rotation zones, grab/grabbing during Space/H pans, and a duplicate indicator while Alt is held over a draggable selection (if Figma shows one). _Data:_ — _Test:_ Record each cursor state in Figma and match the set. _M1·P2·[KNOW]→V-55_
- [ ] **CV-249** Right-click selects then opens menu — right-clicking an unselected layer selects it (by the click-depth rules, or the deepest layer as a 2024 report states; record) and opens the selection context menu. Right-clicking inside the current selection keeps the selection. _Data:_ `selection` _Test:_ With A selected, right-click B (nested in a group in a frame): record which node is selected; the menu opens. With [A, B] selected, right-click A: the selection stays [A, B]. _M1·P0·[KNOW][SRC:S17]→V-54_
- [ ] **CV-250** Selection context menu contents — the canvas context menu for a selection contains the same commands, groups and enablement as Figma (UX owns the full inventory; CV owns Copy, Paste here, Paste to replace, Copy/Paste as, Select layer, arrange, flip, lock, show/hide, move to page). _Data:_ — _Test:_ Compare the menu on a rect, a frame, a text and a multi-selection with Figma screenshots. _M1·P1·[KNOW]→V-54_
- [ ] **CV-251** Empty-canvas context menu — right-click on empty canvas offers Paste here and the view/UI commands Figma lists. _Data:_ — _Test:_ Compare the items with Figma. _M1·P2·[KNOW]→V-54_

### 6.25 Undo/redo of gestures

- [ ] **CV-252** One step per gesture — each completed move, resize, rotate, scale drag, flip, align, distribute, tidy-up, smart-selection edit, paste, duplicate (including Alt-drag), arrange, lock/hide toggle and guide edit is exactly one undo step, including all derived changes (constraints, group bounds, auto-layout reflow). _Data:_ history _Test:_ Perform each operation once, then ⌘Z once: the full pre-operation state is restored (structural diff). _M1·P0·[KNOW][REQ]→V-56_
- [ ] **CV-253** Non-document actions are not undoable — selection changes, zoom, pan, page switches, view toggles and preferences never create undo steps (Figma). _Data:_ history _Test:_ Change the selection, zoom, then ⌘Z: the last document edit is undone, not the selection or zoom. _M0·P0·[KNOW]→V-56_
- [ ] **CV-254** Undo restores selection and page — undo/redo restores the selection associated with the restored state and switches to the page where the change happened. _Data:_ `selection`, `currentPage` _Test:_ Move rect A on Page 1, switch to Page 2, deselect, ⌘Z: Page 1 becomes current (record) with A selected at its old position. _M0·P1·[KNOW]→V-56_
- [ ] **CV-255** Cancelled gestures leave no history — a gesture cancelled with Esc, a lost pointer capture, or a window blur rolls back to the gesture baseline and records no step. _Data:_ history _Test:_ Start a drag, alt-tab away mid-drag: the state equals the baseline (or committed per Figma; record) and the history is consistent. _M1·P0·[REQ][KNOW]→V-56_
- [ ] **CV-256** Redo shortcuts — ⇧⌘Z (macOS) and Ctrl+Shift+Z / Ctrl+Y (Windows, per Figma) redo. A new edit clears the redo stack. _Data:_ history _Test:_ Undo twice, redo once, make a new edit: redo is no longer available. _M0·P0·[KNOW]→V-56_

### 6.26 Interactions with components, auto layout, variables & export

- [ ] **CV-257** Instance children selectable but transform-locked — deep select can select layers inside instances (for overrides), but they show no move/resize/rotate affordances, or the affordances are no-ops (per Figma, CP). _Data:_ `InstanceNode` _Test:_ ⌘+click a rect inside an instance: selected; drag: no move; resize handles: record. _M5·P0·[KNOW]→V-57_
- [ ] **CV-258** Resizing instances applies constraints — resizing an instance resizes its children per the main component's constraints (FR/CP), like a frame. _Data:_ `constraints` _Test:_ An instance of a button with an icon pinned Right: widen it and the icon stays right. _M5·P0·[API][KNOW]→V-57_
- [ ] **CV-259** Absolute-positioned auto-layout children behave freely — a child with `layoutPositioning = ABSOLUTE` can be moved, nudged, resized, rotated and aligned like a freeform child, and respects its constraints (AL). _Data:_ `layoutPositioning`, `constraints` _Test:_ Set a child to absolute and drag it: X/Y change and the flow ignores it. _M4·P0·[API]_
- [ ] **CV-260** Transforms and export bounds — export of a transformed node uses its render bounds after rotation/flip (PE). Overlays (selection, guides, smart guides, redlines, pixel grid) are never exported. _Data:_ `absoluteRenderBounds` _Test:_ Export a 30°-rotated rect at 1×: the image size equals ceil(render bounds); no overlay pixels. _M2·P0·[API][REQ]_
- [ ] **CV-261** Transforms of variable-bound fields keep bindings where possible — Scale and multi-resize on nodes with bound width/height/strokeWeight/radius detach or keep the bindings per Figma (DS). _Data:_ `boundVariables` _Test:_ Bind cornerRadius to a variable and scale 2× with K: record whether the binding remains. _M6·P1·[KNOW]→V-37_

### 6.27 Robustness, performance & accessibility

- [ ] **CV-262** Gesture baseline integrity — every pointer gesture computes from an immutable baseline snapshot. Re-renders, auto-layout passes, or the pointer leaving and re-entering the window never cause drift or double application. _Data:_ — _Test:_ Automated: drag a nested selection in 200 small steps with forced re-renders: the final delta equals the pointer delta exactly. _M0·P0·[REQ]_
- [ ] **CV-263** Screen-space affordances — handle sizes, hit tolerances, rotation zones, snap thresholds and label sizes are constant in screen pixels at all zoom levels; document geometry is never derived from screen rounding. _Data:_ — _Test:_ At 2 % and 25 600 % zoom, handles have the same screen size and picking a 1 px line works. _M1·P0·[REQ][KNOW]→V-41_
- [ ] **CV-264** Interactive performance — pan/zoom and dragging stay at display refresh rate with 10 000 nodes on a page and a 500-node selection, and the marquee preview stays interactive. _Data:_ — _Test:_ Benchmark fixture: frame time ≤ 16.7 ms at the 95th percentile on the reference machine. _M8·P1·[REQ]_
- [ ] **CV-265** Keyboard-only canvas operation — with the canvas focused, Tab/Shift+Tab/Enter/Shift+Enter/Esc, arrows, Shift+arrows and the align/arrange shortcuts allow selecting and transforming without a pointer, consistent with Figma's keyboard-access article (not consulted in this session). _Data:_ — _Test:_ Select a nested layer, move it 10 px and align it using only the keyboard. _M8·P1·[KNOW]→V-22_
- [ ] **CV-266** Text input isolation — global canvas shortcuts (V, H, K, Z, arrows, Space, Delete, Shift+H/V, ⌘D …) never fire while focus is in a text field, text edit, or an IME composition. _Data:_ — _Test:_ Type "hkz" plus arrows in the layer-rename field and in text edit: no tool changes and no nudges. _M0·P0·[REQ]_

---

## 7. Cross-area dependencies

| Area | CV needs from it | It needs from CV |
| --- | --- | --- |
| **M0 architecture** (document model, history, renderer) | Transactions with gesture baselines and rollback; spatial index for hit-testing and snapping; a screen-space overlay layer excluded from export; workspace state (viewport, per-page selection) kept separate from document state | — |
| `02-frames-groups-sections-constraints` (FR) | Frame/group/section semantics, frame labels, clipping (hit-testing), constraint math applied on resize, layout guides as snap targets, section nesting rules, "always pixel-snapped" containers | Click-depth/marquee rules, drag-reparent gesture, resize gesture with the ⌘ constraint bypass, Scale tool, snapping, align/distribute |
| `03-auto-layout` (AL) | Flow positioning (computed X/Y), reorder on drag/nudge/arrange, sizing-mode switches on manual resize, absolute children, layout of rotated children, alignment disabled in flow | Gesture framework, drop-target highlighting/insertion index feedback, nudge routing, multi-selection resize |
| `04-shapes-vectors-booleans` (VC) | Vector edit mode entry (double-click/Enter), Snap to geometry, line geometry (height 0), boolean groups as group-like containers, flatten | Selection model, hit tolerance for open paths, transform of vector networks (flip/rotate) |
| `05-paint-effects-color-export` (PE) | Export bounds of transformed nodes, the property set for copy/paste properties, rasterization for pixel preview, scaling of effects/strokes in K | Overlay exclusion from export, render-bounds computation |
| `06-text-typography` (TX) | Text box hit area, Enter/double-click text edit entry, auto-resize changes on resize, font-size scaling in K, mirrored text rendering | Keyboard-shortcut isolation during text edit, resize gesture |
| `07-components-variants` (CP) | Which instance sublayers can be selected/transformed, override semantics for K-scaling, duplicate/paste of main components, instance resize via constraints | Deep select into instances, Select matching layers (variant-name exemption) |
| `08-variables-styles-design-systems` (DS) | Behavior of bound width/height/radius/stroke under manual resize and K | Knowledge that X/Y/rotation are not bindable |
| `09-prototyping` (PR) | Remapping of interactions on duplicate/paste | Frame-to-frame zoom (N/⇧N), selection of prototype targets |
| `10-panels-shortcuts-workflow` (UX) | Pages panel CRUD, layers-panel selection sync and reveal-on-select, global shortcut registry, menus, preferences dialog, context-menu inventory | Canvas selection model, CV shortcuts (§5), view toggles' behavior. ⚠ Conflicts to reconcile: the snapping-suspension modifier (UX: ⌘/Ctrl; CV evidence: ⌃ macOS / S Windows) and the outlines shortcut (UX: ⌘Y; CV evidence: ⇧⌘O) |
| `11-file-format-interop` (IO) | Persistence of guides (page and frame), page backgrounds, reflected and skewed transforms, clipboard payload format, external paste | Exact data the canvas writes (§2) |

---

## 8. Needs live Figma verification

Every experiment below runs in a **disposable fixture file designated by the user**. Never modify the user's real files. Record platform (macOS/Windows), app (desktop/browser), Figma version, date, zoom, and the relevant preferences (§2.7) for each run. Each experiment lists the checklist items it gates. An item may be marked Validated only after its experiments are recorded in a dated observation note and the item text is corrected to match.

### 8.1 Experiments

| ID | Setup | Action | Record | Gates items |
| --- | --- | --- | --- | --- |
| V-01 | New page; one 100×100 rect | Set X to 1e5, 1e6, 1e7, −1e7, 10.12345, 0.005 via the inspector; read values back via the Plugin API console; Zoom to fit | Max accepted magnitude, any warning, displayed decimals vs stored value, rendering at extreme coordinates | CV-002, CV-168 |
| V-02 | 100×50 rect at (0,0) | Rotate 90° via the field; separately rotate 90° on canvas with Shift | Displayed X/Y/W/H, API `x/y/relativeTransform`, which point stayed fixed | CV-013 |
| V-03 | Asymmetric arrow vector, text layer, frame with 2 children, two differently colored rects | ⇧H, ⇧V, both, twice; on multi-selection; via context menu and Position section | Rotation field value, API matrix (det), children's X/Y, text editability, where flip commands live in UI3 | CV-156, CV-157, CV-158, CV-159, CV-160 |
| V-04 | Section ⊃ rect; Frame ⊃ Group ⊃ Rect; Draw repeat (transform group) ⊃ rect; rotated group | Read X/Y in the inspector and API; try to rotate the section; rotate the group, then inspect the child | Position reference space per container type; section rotation availability; derived group rotation | CV-003, CV-004, CV-012, CV-153 |
| V-05 | 100 % zoom, two window sizes | Press + until it stops, then −; Cmd+wheel notches; type 1 % and 999999 % in the zoom field; toggle "Use alternate zoom handling" | Full step sequences (doubling ladder?), first step from an off-ladder zoom such as 37 %, min/max per window size and content size, typed-value clamping, preference effect | CV-016, CV-023, CV-029 |
| V-06 | Rect corner under pointer; off-center selected rect | Cmd/Ctrl+wheel and pinch over the corner; + with "Keyboard zooms into selection" off/on | Anchor drift in screen px; anchor point for keyboard zoom | CV-017, CV-018, CV-032 |
| V-07 | Any file | Wheel, Shift+wheel, trackpad scroll, Space+drag (with Rectangle tool active, and while editing text), H, middle drag, right drag; "Invert zoom direction" | Pan amounts per notch, tool restoration, Space typing behavior | CV-019, CV-020, CV-021, CV-022, CV-033 |
| V-08 | Two rects 5000 px apart plus a hidden far rect; empty page; 2×2 nested rect; three top-level frames | ⇧0, ⇧1, ⇧2 (with and without selection), N/⇧N repeatedly | Margins in screen px, zoom values, hidden-layer inclusion, max-zoom cap, frame order, wrap, selection side effects | CV-024, CV-025, CV-026, CV-027 |
| V-09 | Any rect | Hold Z: click, Alt+click, drag a rectangle | Zoom result of each | CV-028 |
| V-10 | Two pages at different views | Switch pages; close and reopen the file | Whether the view is restored per page and after reopen | CV-030, CV-031 |
| V-11 | Fresh profile; rect, frame, section, component; target rect at x = 10.5 | Check defaults; ⌘' and ⇧⌘'; at 30 % zoom create, move, resize, nudge each node type with Snap to pixel grid on/off; snap a rect to the 10.5 target; repeat with a 30° rotated rect | Shortcuts, defaults, integer vs fractional results per operation and node type, order of object and pixel snap | CV-036, CV-037, CV-038, CV-120, CV-185 |
| V-12 | Any | Locate Pixel preview in menus/shortcuts | Options (off/1×/2×), shortcut, display behavior | CV-039 |
| V-13 | Filled/stroked rect; hidden rect; locked rect | ⇧⌘O on a fresh profile; toggle outline sub-options; click inside an outlined filled rect; click a hidden outlined rect | Shortcut, options, interior clickability, hidden-layer selectability | CV-040, CV-041 |
| V-14 | Rect in a frame | ⇧R with and without the frame selected; toggle rulers | Ruler origin, selection highlight, viewport center vs top-left stability | CV-034, CV-043, CV-212 |
| V-15 | Any | ⌘\ and ⇧\ | Effects; viewport center stability | CV-044 |
| V-16 | Page divider; rect at (300,200) | Click the divider; Move to page | Divider behavior; destination coordinates, z-order, current page, undo | CV-051, CV-052 |
| V-17 | Light and dark theme | Create a new page; read `page.backgrounds` | Default background color per theme and stored value | CV-045 |
| V-18 | Top-level group ⊃ rect; top-level instance; top-level main component ⊃ rect; Frame ⊃ Group ⊃ Rect; Frame ⊃ Frame ⊃ Rect; Section ⊃ Frame ⊃ Rect; Section ⊃ Group ⊃ Rect | Single click on each rect; double-click into a group, then click a sibling and then an outside layer | Selected node for each click; scope persistence and reset | CV-063, CV-064, CV-065, CV-067 |
| V-19 | Top-level frame with children; empty top-level frame; frame with no fill; plain empty canvas | Click, ⌘/Ctrl+click and drag on the empty background; click empty canvas | Selection result; marquee vs move | CV-062, CV-066 |
| V-20 | Stroke-only rect/ellipse/closed vector; 1 px line; fixed-height text; overflowing child in a clipping frame; locked rect over another rect | Click the interiors; find the max pick distance at 25 % and 800 %; click the text blank areas, the overflow, and the locked rect | Hit/no-hit for each; tolerance in screen px | CV-053, CV-055, CV-056, CV-057, CV-058, CV-059 |
| V-21 | Nested fixture; locked and hidden layers | Hover with and without ⌘; hover panel rows; toggle "Highlight layers on hover" | Highlighted target in each case; default | CV-060, CV-061 |
| V-22 | Frame with hidden and locked children; text; vector; instance; siblings A/B/C | Enter, Shift+Enter, `\`, Tab/Shift+Tab (single and multi), Esc (nested/top-level), double-click on containers and leaves; keyboard-only flow | Resulting selection for each key; wrap; edit-mode entry; text caret placement | CV-068, CV-069, CV-075, CV-076, CV-077, CV-078, CV-265 |
| V-23 | Nested fixture, three stacked layers (one locked, one hidden) | Shift+click, Shift+⌘+click, Shift+click an ancestor/descendant; right-click → Select layer; ⌘/Ctrl+right-click | Toggle rules; menu contents and order | CV-071, CV-072, CV-073, CV-079 |
| V-24 | Matrix: start {empty canvas, inside top-level frame, inside nested context} × modifier {none, Shift, ⌘} × targets {partially covered shape, partially/fully covered frame, locked, hidden} | Drag marquees; drag past the viewport edge | Selected set for each cell; live preview; auto-pan | CV-082, CV-083, CV-084, CV-085, CV-086, CV-087, CV-088, CV-089 |
| V-25 | Frame with 5 children (one locked, one hidden); 3 top-level frames with matching layers; red/blue rects | ⌘A (with and without selection), ⇧⌘A, ⌥⌘A (inside a frame and top-level), Shift preview, Edit → Select all with same … | Selected sets; availability; command list and scope | CV-091, CV-092, CV-093, CV-096, CV-097 |
| V-26 | Locked rect near another rect; 4 layers | Drag near the locked rect (snap?), Alt-measure to it; select it via the panel and press arrows / drag handles; drag across padlocks then undo; search for an "unlock all" shortcut | Snap/measure participation; key/handle effect; undo granularity; shortcut | CV-101, CV-102, CV-103 |
| V-27 | Rect | ⇧⌘H; select a hidden layer from the panel | Shortcut; canvas feedback for a hidden selection | CV-104, CV-106 |
| V-28 | Rect | Move 1–5 px to find the threshold; Shift-drag at (100,20) and (100,95); press/release Alt mid-drag; Esc mid-drag; drag to the window edge; Space during the move | Threshold px; axis/45° behavior; duplicate toggling; cancel; auto-pan; Space effect | CV-090, CV-107, CV-108, CV-110, CV-111, CV-112, CV-113 |
| V-29 | Frames, group, section, large rect; selection across two frames | Drag into/out of frames with pointer-inside/bounds-outside; hold ⌘, Space, Ctrl; drag over a group; drag a section onto a frame; shrink a section over children; drag a multi-parent selection | New parent each time; suppression modifier; z-order on reparent; section rules | CV-074, CV-109, CV-114, CV-115, CV-116, CV-117, CV-118, CV-139 |
| V-30 | Rect at X = 10.4; auto-layout row; preferences | Single presses and held key-repeat followed by one ⌘Z; → with pixel snap; arrows on an auto-layout child; ⌘/⇧⌘+arrows; set nudge 0.5 and 8, check another file | Undo coalescing; rounding; reorder; resize anchor; preference scope and validation | CV-124, CV-125, CV-126, CV-127 |
| V-31 | 200×100 rect | Shift corner/edge, Alt, Shift+Alt, locked-ratio + Shift, Space during resize | Resulting X/Y/W/H in each case | CV-129, CV-130, CV-131, CV-132, CV-133, CV-146 |
| V-32 | Arrow-filled rect | Drag the right edge past the left with "Flip objects while resizing" on/off; type W = 0 / 0.001 | Rotation field, matrix, X, clamp values | CV-010, CV-134 |
| V-33 | Group of two stroked rects; multi-selection with a 30° rect; frame with overflowing children | Resize the group and the multi-selection; observe selection boxes; delete all group children | Children geometry, stroke widths, rotated member result, box display, group removal | CV-011, CV-081, CV-135, CV-138, CV-140 |
| V-34 | Rect | Zoom until it is 8×8 and 4×4 screen px | Which handles remain; drag-inside behavior | CV-145 |
| V-35 | Rect at (10,10); 45° rect; frame with pinned child | Type W/H; ⌘-drag the frame handle; release ⌘ mid-drag | Fixed anchor point; constraint bypass on canvas and in the inspector | CV-137, CV-144 |
| V-36 | Auto-width text; Hug auto-layout frame; Fill child | Drag edges | Resulting text mode and sizing modes (cross-check TX/AL) | CV-141, CV-142 |
| V-37 | Width bound to a number variable; radius bound to a variable | Drag the edge; scale 2× with K | Binding kept/detached; resulting values | CV-143, CV-261 |
| V-38 | 100×50 rect; two rects side by side | Measure rotation zone at 50 %/400 %; rotate with Shift from 7°; type 450, 12.5; rotate a multi-selection on canvas and via the field; Object → Rotate 90°/180°; inspect the Position section | Zone px, pivot, snap rule, normalization, Mixed behavior, command availability and shortcuts, UI3 rotate/flip buttons | CV-008, CV-148, CV-149, CV-150, CV-151, CV-152, CV-154 |
| V-39 | Rect with stroke 2, radius 8, shadow (0,4,8), blur; 16 px text; auto-layout frame; instance | K-scale 2× each by drag and numerically; Alt and Shift drags; press V/Esc | Every scaled property value; modifiers; tool exit; override state | CV-161, CV-163, CV-165, CV-167 |
| V-40 | Rects with X = 0 and 50 | Expressions (`100/3`, `(10+5)*2`, `+10`), Mixed edits, multi-select W/H edits, ↑/Shift+↑ in a field, scrubbing with/without Shift, "abc" input | Committed values; undo steps | CV-169, CV-170, CV-171, CV-172, CV-173 |
| V-41 | Rects A, B with a 40 gap; off-screen rect; rect in another frame; locked rect; guide at x = 100; layout grid; 45° square | Drag C around; resize edges near targets; measure the snap threshold at 25 %/400 %; resize a 3-line text box from its bottom edge; resize a frame and a section toward the children-centered size | Candidate set, threshold px, equal-spacing behavior, labels, rotated snapping, guide/grid snapping | CV-147, CV-175, CV-176, CV-177, CV-178, CV-179, CV-180, CV-181, CV-182, CV-186, CV-187, CV-188, CV-263 |
| V-42 | Two rects | Drag while holding ⌃, S, ⌘ (macOS) and Ctrl, S (Windows) | Which key suspends snapping on each platform | CV-184 |
| V-43 | Fresh profile | Open Preferences | Snap toggle defaults and scope; Snap to geometry effect outside vector edit | CV-183 |
| V-44 | A inside frame F; overlapping A/B; 33.333 px gap | Alt-hover F, B; Alt during a drag | Labels shown; rounding; duplicate vs measure | CV-192, CV-193, CV-195 |
| V-45 | 4 equally spaced rects (1D) and a 2×2 grid | Drag spacing handles; type spacing; drag a center circle past others; resize items | Gap updates, numeric field location, reorder effect on layer order, resize rules | CV-208, CV-209, CV-211 |
| V-46 | Row with gaps 10, 10, 30; tie gaps 10, 20; mixed heights; 2D scatter of 6 | Tidy up (menu and ⌃⌥T) | Chosen gap, anchor item, cross-axis alignment, grid clustering, gaps | CV-205, CV-206 |
| V-47 | Single top-level rect; 101-wide and 100-wide rects; distribute fixtures with ties/overlaps; auto-layout child; rect at (10.4, 20.6) 99.5×50.2 | Align/distribute via buttons and shortcuts on macOS and Windows; Round to pixel | Single-node behavior, half-pixel rounding, ordering, fractional gaps, disabled state, shortcuts, rounding of descendants | CV-174, CV-197, CV-198, CV-199, CV-200, CV-201, CV-202, CV-203 |
| V-48 | Rulers on; frame F | Drag guides from each ruler (inspect `axis`/`offset` via API); drag near an edge; select + Delete; hide rulers; resize F from its left edge; select a guide | Axis meaning, snapping, deletion, visibility, frame-relative behavior, position field | CV-213, CV-214, CV-215, CV-217, CV-219 |
| V-49 | Nested rect; top-level 375×812 frame with guides and an internal prototype link; auto-layout row; "Card" layer | ⌘D, nudge, ⌘D×3; Alt-drag then ⌘D; ⌘D on a 30° rect after an offset; ⌘D on F2 of a row F1…F5; toggle "Rename duplicated layers" | Copy positions, offset memory and reset, names, copied guides/links, auto-layout insertion | CV-220, CV-221, CV-222, CV-223, CV-224, CV-225, CV-226 |
| V-50 | Rect at (100,100) in view/out of view; frames A/B; nested selection; 3 frames; second page | Paste in each context; per-axis fit fixture (50×50 at (20,300) from 400×400 into 200×200); off-screen selected frame; source parent still in view with another frame selected; 300×300 clip into a hug auto-layout frame | Parent, position, z-order, viewport movement of each paste | CV-228, CV-229, CV-230, CV-231, CV-232, CV-233, CV-234, CV-235, CV-240 |
| V-51 | 40×40 icon with Right/Bottom constraints at index 2; 3 icons; auto-layout frame | ⇧⌘R with a 24×24 clipboard; Paste here inside a frame and over auto layout | Position anchoring, size, constraints, z-order, parent | CV-236, CV-237 |
| V-52 | Styled rect; text; ellipse; layers with 2 fills | ⌥⌘C/⌥⌘V onto each; copy a single fill row and paste | Exact property set transferred; append vs replace | CV-238, CV-239 |
| V-53 | [A, B, C, D] siblings; selection in two frames; auto-layout children | ⌘], ⌘[, ⌥⌘], ⌥⌘[ on single, multi and cross-parent selections | Resulting orders | CV-242, CV-243, CV-244, CV-245, CV-246 |
| V-54 | Rect, frame, text, multi-selection, empty canvas | Right-click each | Menu items, enablement, selection side effects | CV-249, CV-250, CV-251 |
| V-55 | Rotated rect | Hover handles/zones; hold Space, H, Alt, Z; hover a locked layer | Cursor shapes and orientation | CV-247, CV-248 |
| V-56 | Any edits on two pages | Undo/redo each gesture type; switch pages before undo; Delete then undo; blur the window mid-drag; Windows redo keys; zoom/selection then undo | Step granularity; restored selection/page; cancellation; shortcuts | CV-015, CV-080, CV-128, CV-252, CV-253, CV-254, CV-255, CV-256 |
| V-57 | Main component; instance with nested rect and pinned icon | Drag/resize the instance child; ⌘D/Alt-drag/copy-paste the main component; resize and K-scale the instance | Allowed transforms; resulting node types; override state | CV-119, CV-227, CV-241, CV-257, CV-258 |
| V-58 | Horizontal auto layout with a 100×20 child | Rotate the child 90° | Flow spacing used | CV-155 |
| V-59 | Rect | Resize to 100.4×50.6 with pixel snap off; toggle display preferences | Dimension label text; preference defaults and effects | CV-046, CV-047 |

### 8.2 Open questions and conflicts found during research

1. **Snapping suspension key.** Forum evidence says ⌃ (macOS) / S (Windows), with an April 2025 report of S and a 2022 report of Ctrl [SRC:S1]. The UX doc states ⌘/Ctrl. Resolve with V-42 and fix the losing document.
2. **Outlines shortcut.** The current help excerpt says ⇧⌘O (with a legacy preference for ⇧O) [DOC:5724448965527 excerpt]. The UX doc lists ⌘Y, which forum answers from 2023/24 also cite [SRC:S9]. Resolve with V-13.
3. **Pixel-grid shortcuts.** ⌘' (display) is supported by a help excerpt and a cheat sheet; ⇧⌘' (snap) is [KNOW] only. V-11.
4. **`scrollAndZoomIntoView` vs ⇧1/⇧2.** The typings call the node-fitting API "Shift-1". The UI command mapping must be confirmed (V-08).
5. **Flip encoding.** There is no flip property in the API; whether UI flips write a reflection matrix (and show 180°) is unverified (V-03).
6. **Section as position space** is not stated in the typings' container-parent list (V-04).
7. **Scale tool stroke scaling.** The official excerpt says strokes scale; forum users report strokes not scaling during ordinary resize. These are different operations, but the full K property list is unverified (V-39).
8. **Zoom range and steps** rest on forum reports: 2 %–25 600 % (2022), a doubling ladder (2024), and a content-size-limited zoom-out (June 2026). No official table was found (V-05).
9. **Top-level frame background click.** An earlier CV draft said a click on the empty background of a top-level frame with children selects the frame; the FR spec says it does not (a marquee starts). This version follows FR. Both are [KNOW]; resolve with V-19 and fix the losing document.
10. **Esc.** Community threads (2021–2023) say Esc deselects everything and does not step up a level; earlier CV drafts assumed "up one level". Resolve with V-22.
11. **Marquee containment.** Help excerpts confirm only that ⌘/Ctrl+drag selects nested layers; forum posts say it selects anything touched. The full-containment rule for top-level frames (§3.7 rule 3) is still [KNOW] (V-24).
12. **Paste placement.** The per-axis fit rule is documented; the destination choice with a non-frame selection, the "Canvas view" rule and the auto-layout overflow case are not (V-50).

---

## 9. Sources

### 9.1 Official Figma Help Center articles

All were seen **only as WebSearch summaries/excerpts** on 2026-10-08. help.figma.com is DNS-blocked here, so no article body was read. IDs are from `old/docs/figma/source-catalog.md` (retrieved 2026-09-27).

| ID | Title | Used for |
| --- | --- | --- |
| 360040449873 | Select layers and objects | Click selects the parent by default; double-click/Enter one level down; deep select ⌘/Ctrl+click (also selects a top-level frame); ⌘/Ctrl+drag marquee selects nested layers; Enter/⇧Enter; Tab/⇧Tab; top-level-frame scope of select all; child selectable without parent |
| 360041065034 | Adjust your zoom and view options | ⇧1/⇧2, `+`/`−` (written ⇧+/⇧−), presets 50/100/200 % and custom %, zoom-to-fit on open, per-tab zoom, pixel grid ≥ 400 %, ⌘' toggle, snap to pixel grid, frames/sections/components always snap, interface scale ≠ canvas zoom |
| 4404575206295 | Set small and big nudge values | Defaults 1/10, points, Preferences → Nudge amount, Shift big nudge |
| 360039956974 | Measure distances between layers | Alt redlines, ⌘⌥ nested, bounding-box rule, strokes/text caveats, guides, view access, Dev Mode distinction |
| 360040450233 | Arrange layers with Smart selection | Requirements, pink handles, delete-and-close-gap, resize rules, Alt center, Tidy up 1D/2D, Distribute vs Tidy up |
| 360040449713 | Add guides to the canvas or frames | Rulers prerequisite, drag from ruler, Alt-duplicate, frame vs canvas guides, dotted indicator, redlines to frame guides, Option/Control distance while dragging, removal |
| 4409078832791 | Copy and paste objects | Section list (paste placement, multi-paste, paste here), per-axis paste-fit rule with its ellipse/square example, "Canvas view" consideration (truncated), Paste to replace ⇧⌘R adopting constraints, Paste over selection ⇧⌘V |
| 4412765442967 | Copy and paste properties between layers | ⌥⌘C/⌥⌘V, Ctrl+Alt+C/V, supported-properties rule, single fill/stroke/effect copy, context menu path |
| 360040451453 | Scale layers while maintaining proportions | K, ignores nested constraints, blurs/strokes scale, anchor box, scale multiplier |
| 360039956914 | Adjust alignment, rotation, position, and dimensions | Location of controls only (rotation section not retrieved) |
| 360041596573 | Lock and unlock layers | ⇧⌘L, canvas vs panel rules, inheritance, padlock drag, Select layer route (locked layers listed with a padlock) |
| 5724448965527 | View layer outlines in Figma Design | ⇧⌘O, view-menu path, hidden layers and object-bounds options, "Use old shortcuts for outlines" |
| 21523793229463 | Identify matching objects | Matching rules, Shift highlight, page scope |
| 27330413404567 | (Slides) Select layers in a slide deck | Context only (matching requirements in Slides) |
| 360041112614 | Toggle visibility to hide layers | Hidden layers cannot be picked on the canvas, including via the right-click Select layer menu; selectable in the layers panel and via outlines |
| 360041539473 | Frames in Figma Design | ⌘D/Ctrl+D duplicates a frame; Frame-tool "+" quick-add creates a copy and nudges neighbors (FR context) |

Relevant catalog articles **not consulted** in this session (search budget exhausted): 360039959014 Parent, child, and sibling relationships; 360039832054 The difference between frames and groups; 9771500257687 Organize your canvas with sections; 360041064814 Change the background color of the canvas; 41414918021271 Hide or minimize the UI; 360040328653 Use Figma products with a keyboard; 21635177948567 Edit objects on the canvas in bulk; 360039832014 Right sidebar; 360039831974 Navigation bar and left sidebar; 23570416033943 Actions menu; 360039957734 Apply constraints (via prior note P1 only).

### 9.2 Typings references

**Plugin API v1.141.0**, `refs/_figma_plugin-typings/package/plugin-api.d.ts`:

| Topic | Lines |
| --- | --- |
| `commitUndo` / `triggerUndo` | P:274-298 |
| `currentPage`, `setCurrentPageAsync` | P:461-470 |
| `selectionchange` / `currentpagechange` semantics | P:545-560 |
| `createPage` / `createPageDivider` | P:1125-1145 |
| `group` (⌘G), `transformGroup`, `flatten`, `ungroup` (⇧⌘G) | P:1855-1959 |
| `ViewportAPI` (center, zoom, scrollAndZoomIntoView, bounds) | P:3306-3331 |
| `Transform`, `Vector`, `Rect` | P:3928-3938 |
| `ConstraintType`, `Constraints` | P:4632-4639 |
| `Guide` | P:4993-4996 |
| `BaseNodeMixin` (id, parent, `remove`) | P:6306-6371 |
| `SceneNodeMixin.visible`, `locked` | P:6584-6606 |
| `VariableBindableNodeField` | P:6910-6937 |
| `ChildrenMixin` (order, appendChild, insertChild) | P:6972-7022 |
| `ConstraintMixin` | P:7225-7236 |
| `DimensionAndPositionMixin` (x, y, width, height, min/max, relativeTransform incl. Scale/Container parent/Skew/Auto-layout notes, absoluteTransform, absoluteBoundingBox) | P:7238-7333 |
| `LayoutMixin` (absoluteRenderBounds, constrainProportions, rotation, resize, resizeWithoutConstraints, rescale) | P:7337-7482 |
| `AspectRatioLockMixin` | P:7487-7534 |
| `ContainerMixin.expanded` | P:7603-7608 |
| `layoutPositioning` | P:8495-8522 |
| `BaseFrameMixin` (clipsContent, guides) | P:9372-9430 |
| `Measurement`, `MeasurementsMixin` | P:9500-9600 |
| `DocumentNode` | P:10404-10420 |
| `PageNode` (guides, selection, backgrounds, isPageDivider) | P:10563-10757 |
| `FrameNode`, `GroupNode`, `TransformGroupNode`, `SliceNode` | P:10758-10826 |
| `SectionNode` | P:12256-12298 |
| `SceneNode` union | P:12426-12460 |
| `TransformModifier` | P:12820-12854 |

**REST API types v0.44.0**, `refs/_figma_rest-api-spec/package/dist/api_types.ts`:

| Topic | Lines |
| --- | --- |
| `IsLayerTrait` (visible, locked, rotation) | R:1-60 |
| `HasLayoutTrait` (absoluteBoundingBox, absoluteRenderBounds, preserveRatio, constraints, relativeTransform, size, layoutPositioning, min/max) | R:172-260 |
| `CanvasNode` (backgroundColor, flowStartingPoints, measurements; no guides) | R:875-910 |
| `SectionNode` | R:960-972 |
| `Transform` documentation | R:1478-1520 |
| `LayoutConstraint` | R:1689-1716 |

### 9.3 Other sources (`[SRC:…]` aliases)

All forum and tutorial content is third-party, seen only through WebSearch summaries on 2026-10-08.

| Alias | Source(s) | Used for |
| --- | --- | --- |
| S1 | forum.figma.com/t/temporarily-disable-snapping/3358/11 · forum.figma.com/report-a-problem-6/ctrl-hotkey-not-working-to-disable-smart-guides-and-all-snapping-56373 (Jul 2026: S on Windows, Control on macOS) · forum.figma.com/suggest-a-feature-11/figjam-hold-ctrl-to-disable-snap-to-grid-36963 (Apr 2025: S; Alt duplicates) | Snap suspension, Alt-drag duplicate, Snap to objects preference |
| S2 | forum.figma.com/archive-21/solved-zoom-bug-is-back-too-large-increments-on-desktop-version-weird-ones-in-browser-version-23242 (2022: 2 %–25 600 %, "Use alternate zoom handling") · forum.figma.com/report-a-problem-6/impossible-to-zoom-out-in-slides-15570 (bounds relative to window) · forum.figma.com/report-a-problem-6/zoom-out-limit-54469 (2026) · forum.figma.com/suggest-a-feature-11/ability-to-zoom-in-out-by-decimal-increments-ux-improvement-suggestion-10303 · forum.figma.com/suggest-a-feature-11/zoom-keyboard-shortcuts-need-more-fine-grained-control-38904 and forum.figma.com/suggest-a-feature-11/custom-zoom-level-28361 (2024 doubling-ladder report and Aug 2026 75 % preset request, as summarized by search; the summary did not tie each claim to one URL) · forum.figma.com/report-a-problem-6/zoom-out-limit-54469 (Jun 2026: content size limits zoom-out) | Zoom range/steps |
| S3 | forum.figma.com/report-a-problem-6/problem-in-nudge-jumping-2px-instead-of-1px-50606 (2026 vector-mode bug) · forum.figma.com/suggest-a-feature-11/nudge-amount-page-settings-23802 | Nudge scope, bug exclusion |
| S4 | app.uxcel.com/courses/figma-intro/layer-alignment-097/rotate-layers-9201 · wpdean.com/how-to-rotate-in-figma/ · forum.figma.com/t/how-to-do-360-rotation/68653 | Rotation sign/range, Shift 15°, 360 → 0 |
| S5 | video.pie-menu.com/figma-cheat-sheet.pdf · www.pie-menu.com/shortcuts/figma · thoughtbot.com/blog/figma-shortcuts-speed-up-your-design-workflow | ⇧0, ⇧⌘A, ⌃P pixel preview, ⌘A scope |
| S6 | forum.figma.com/t/ctrl-shift-v-vs-ctrl-shift-r/57124 · forum.figma.com/t/pasting-outside-frames/72293 · forum.figma.com/suggest-a-feature-11/new-paste-features-simple-but-big-improvements-19788 | Paste here, paste over selection without a selection |
| S7 | forum.figma.com/report-a-problem-6/copy-paste-properties-not-working-41189 · app.uxcel.com (copying properties lesson) | Copy-properties context (bug not a parity target) |
| S8 | forum.figma.com/t/stroke-to-scale-with-the-object/46904 · forum.figma.com/t/resizing-a-vector-proportionally/42614 (and related replies in the same result set) | Strokes not scaling on ordinary resize; Alt from center |
| S9 | forum.figma.com/ask-the-community-7/is-there-any-way-to-revert-the-outline-stroke-shortcut-to-how-it-used-to-be-31463 · forum.figma.com/archive-21/hidden-elements-should-not-be-visible-in-outline-mode-30026 · forum.figma.com/t/toggle-visibility-of-multiple-layers-at-once/39128 (Jul 2026: ⇧⌘H) | Outline shortcut history, hidden layers in outline mode, hide shortcut |
| S10 | forum.figma.com/ask-the-community-7/feature-suggestion-lock-unloack-all-layers-keyboard-shortcut-38444 · forum.figma.com/archive-21/is-it-possible-to-lock-all-the-frames-in-a-page-at-one-click-8258 | Unlock-all shortcut claims |
| S11 | forum.figma.com/t/what-does-matching-means-at-select-all-matching-layers/30164 · forum.figma.com/t/selecting-matching-layers-looks-buggy/69298 · forum.figma.com/report-a-problem-6/keyboard-shortcut-for-select-matching-layers-doesn-t-work-42844 | Matching hierarchy requirement |
| S12 | webdesign.tutsplus.com/figma-object-selection-tips--cms-31983t · stevekinney.com/courses/figma/selecting-and-inspecting · forum.figma.com/t/select-all-across-document-not-current-page/49681 · forum.figma.com/report-a-problem-6/the-selection-command-select-all-with-same-text-properties-deselects-instead-of-selecting-the-desired-text-layers-49518 | "Select all with same …" commands, scope, known bug |
| S13 | Community support reply quoted in the guides search summary (⇧R) · leyaa.ai/codefly/learn/figma/part-1/figma-rulers-and-guides (unverified claims, not relied on) | Rulers shortcut |
| S14 | forum.figma.com/report-a-problem-6/can-t-see-distances-between-elements-even-in-design-mode-and-after-trying-everything-45338 · app.uxcel.com (measuring lesson) | Measurement context |
| S15 | forum.figma.com/t/tab-shift-tab-layer-navigation-when-multiple-component-instances-are-selected/9913 | Tab with multi-selection |
| S16 | forum.figma.com/suggest-a-feature-11/cmd-opt-drag-only-selects-items-in-bounds-24720 (2021 request; Aug 2025 comment: still no enclosed-only mode) · forum.figma.com/t/is-cmd-selecting-layers-changed/88595 (2024: modifier-drag selects any touched layer) · forum.figma.com/t/inconsistent-direct-click-selection-ctrl-click-of-nested-frames/77583 (2024: inconsistent Ctrl-click depth) · forum.figma.com/report-a-problem-6/drag-selection-doesnt-work-in-frames-anymore-39665 and forum.figma.com/report-a-problem-6/bug-selecting-layers-in-figma-motion-56234 (glitch reports) | Marquee modifiers, no containment mode, deep-select inconsistency, non-parity bugs |
| S17 | forum.figma.com/suggest-a-feature-11/when-cmd-ctrl-right-clicking-elements-don-t-select-until-after-mouse-release-19530 (2024: right-click selects the deepest layer before the menu; ⌘/Ctrl+right-click for the list) · forum.figma.com/report-a-problem-6/right-click-selects-locked-frame-40693 (May 2025; not reproduced by support) · forum.figma.com/suggest-a-feature-11/improved-locked-element-handling-2667 | Select layer menu access, right-click selection depth |
| S18 | forum.figma.com/suggest-a-feature-11/keyboard-shortcut-to-duplicate-in-place-without-offset-16726 and forum.figma.com/t/keyboard-shortcut-to-duplicate-in-place-without-offset/86207 (Sep 2024 staff: no duplicate-in-place shortcut; ⌘D repeats the last offset; rotation caveat) · forum.figma.com/t/duplicate-frame-downwards/26206 (frame copies go right) · forum.figma.com/ask-the-community-7/how-can-i-manage-the-ordering-of-my-toplevel-frames-21673 (2023: copy of frame 4 of 10 lands after frame 10) · supademo.com/blog/how-to-duplicate-in-figma (Alt-drag then ⌘D) · frontendmasters.com/courses/figma/aligning-objects/ | Duplicate placement and offset memory |
| S19 | forum.figma.com/t/esc-key-to-back-out-1-level/244 · forum.figma.com/suggest-a-feature-11/esc-key-to-back-out-1-level-35091 (2021–2023: Esc deselects all; Figma points to another key) · forum.figma.com/t/is-there-a-shortcut-to-select-a-layers-group-without-using-the-layer-panel/45109 (`\` selects the parent) | Esc, select-parent alias |
| S20 | forum.figma.com/product-updates-3/it-s-baaack-little-big-updates-but-with-a-weekly-twist-35486 (undated weekly roundup: text-box centering snap; frames/sections snap to centered children on resize) · forum.figma.com/suggest-a-feature-11/turning-off-snap-to-pixel-grid-should-turn-snapping-off-8022 (2021–Sep 2025 complaints) | Newer resize snap targets |
| S21 | forum.figma.com/t/inconsistent-behavior-when-pasting-object-into-a-selected-frame/32173 (2022: selected frame sometimes ignored) · forum.figma.com/suggest-a-feature-11/pasting-items-in-figma-20297 (2023: off-screen paste goes to the center of the visible area) · forum.figma.com/archive-21/copy-pasting-between-frames-doesn-t-place-element-in-same-place-33738 (2023: source parent in view wins) · forum.figma.com/report-a-problem-6/paste-to-replace-moves-the-view-port-an-awkward-location-and-i-have-to-navigate-back-to-where-i-was-45861 (Sep 2025: confirmed bug) · forum.figma.com/report-a-problem-6/paste-here-figma-web-chrome-macos-39044 (Mar 2025, unconfirmed) | Paste placement deviations, auto-layout overflow, non-parity bugs |
| P1 | `old/docs/figma/features/responsive-constraints.md` (prior Illigma session; states DOC:360039957734 was read in full on 2026-09-27 and documents the ⌘/Ctrl constraint bypass) | ⌘ ignore-constraints |
| P2 | `old/docs/figma/features/right-inspector.md` (prior Illigma session live inspection: auto-layout-controlled X/Y and alignment disabled; Position exposes Constraints) | Inspector states |
| P3 | `old/docs/figma/feature-guide.md` (secondary summary of official docs: layers-panel Shift/⌘ selection, modifier-click removal, root-frame multi-selection must not double-transform) | Selection invariants |
| P4 | `docs/parity/10-panels-shortcuts-workflow.md` (sibling UX spec, itself partly [KNOW]) | Menu inventory, field keyboard behavior, Round to pixel, visibility excerpt |
| P5 | `docs/parity/02-frames-groups-sections-constraints.md` (sibling FR spec) | Section nesting, frame-label rules |

### 9.4 Search log

16 WebSearch queries succeeded on 2026-10-08, covering: select layers; zoom/view options; nudge; measure; smart selection; guides; copy/paste objects; copy/paste properties; scale tool; alignment/rotation; lock; outlines; snap suspension; zoom range; select matching; select inverse/same. Four further queries (marquee rules, marquee containment, Select-layer menu, double-click depth) were refused because the run's shared search budget was exhausted. WebFetch of help-center mirrors failed (DNS).

**Resumed pass (2026-10-08, later the same day).** Eight further WebSearch queries (standard mode): marquee containment and modifiers; click depth and double-click; the right-click Select layer menu; zoom steps and limits; ⌘D duplicate placement and offset; paste placement; Esc behavior; 2026 release notes on selection/snapping. Each result is cited inline as `[DOC:… excerpt]` (help-center text seen only in the search summary) or `[SRC:S2, S16–S21]`. No article body was opened, and no live Figma file was used.
