# Auto layout (flex + grid) — Figma parity spec

> **Status:** research draft (date 2026-10-08). **Nothing implemented.** Every checklist item below is status **Not started**. No item may be marked as parity-complete until it is implemented in Illigma **and** validated against live Figma behavior using the test given in the item.
>
> **Source-of-truth rule:** Figma defines all behavior, data and edge cases in this document. Framer defines only how the editor looks. Framer's Stack/Grid/layout model must never replace Figma's auto layout model.
>
> **Evidence legend** (each behavioral claim carries one or more tags):
> - **[API]**: Figma Plugin API typings `@figma/plugin-typings` v1.141.0 (`plugin-api.d.ts`) or REST API types `@figma/rest-api-spec` v0.44.0 (`api_types.ts`). Line references are in §9.
> - **[DOC:&lt;id&gt; excerpt]**: an official Figma Help Center article, by article id (see §9). **All DOC tags in this file are "excerpt" tags.** In this session help.figma.com was DNS-blocked, so these claims come from search-engine excerpts of the article, not from reading the full article body. `[DOC:360040451373|31289464393751 excerpt]` means the excerpt came from one of the two auto-layout articles and the search result did not identify which one.
> - **[OBS]**: the read-only live-Figma UI observation dated 2026-09-27 (`old/docs/figma/observations/2026-09-27-live-figma.md`). It covers which inspector controls were visible and what values they showed. It does not cover interactions.
> - **[KNOW]**: the author's own knowledge of Figma, not verified in this session. Everything tagged [KNOW] that affects correctness is repeated in §8 as a live-verification experiment (`→ V-nn`).
> - **[SRC:&lt;key&gt;]**: another web source (Figma forum product-update posts, Figma developer changelog, third-party tutorials), seen only as search excerpts. Keys resolve to URLs in §9.
>
> **Research limits for this draft:** the session's shared web-search budget ran out partway through the research. Several topics therefore rest on [KNOW] only and are flagged for verification: Shift+A inference defaults, the order shown in the layers panel, rounding, hidden-child behavior, and the exact stroke rules of the Legacy layout version. Nobody inspected live Figma, watched a video, or read a full article body for this draft.

---

## 1. Scope & terminology

### 1.1 In scope

All of Figma Design's auto layout as of 2026-10:

- **Stack flows:** Horizontal and Vertical, each optionally with **Wrap** (vertical wrap shipped 2026-09-25 [SRC:forum-58389]).
- **Grid flow:** rows and columns; Fixed, Hug and Flex (fr) tracks; spans; automatic rows; automatic placement [API][SRC:forum-54244][SRC:plugin-upd-120].
- **Adding, removing and suggesting auto layout:** Shift+A, the inspector, menus, inference from existing arrangements, and "Suggest auto layout".
- **Spacing:** fixed gap (including negative), Auto gap (Between, Around, Evenly), the wrap counter-axis gap, and grid row/column gaps.
- **Padding:** per side, with the Updated-version padding floor.
- **Alignment:** the 9-position alignment control, text-baseline alignment, and align-content for wrapped tracks.
- **Sizing:** Fixed, Hug and Fill per axis; which options are allowed for each parent/child combination; automatic conversions between them; min/max width and height.
- **Text interplay:** text auto-resize modes mapped to Hug/Fill/Fixed.
- **Ignore auto layout** (absolute positioning inside an auto layout frame), plus Ctrl-drag to place absolutely.
- **Hidden children, canvas stacking order, strokes in layout, the layout version (Updated/Legacy), and clip content.**
- **Reordering:** on canvas, in the layers panel and with the keyboard, plus the insertion rules.
- **On-canvas affordances:** gap and padding handles, grid track pills.
- **Nested layouts:** resizing propagation and the exact numeric layout algorithm (§3.22).
- **Interplay with other systems:** undo/redo, copy/paste, components/instances/slots, variables, export and import.

### 1.2 Out of scope (here) / deferred

- **Visual styling of the controls** (colors, icons, radii). Framer sets the visual design, and it is specified elsewhere.
- **Constraints of non-auto-layout frames and layout guides** (formerly "layout grids"). These belong to the constraints/layout-guides spec. Only their interaction with auto layout is listed here.
- **Dev Mode code generation** (`inferredAutoLayout`, CSS output). It appears here only as an M8/P2 interop note [API].
- **Multiplayer and cloud features.** Illigma is local-first. Anything that depends on Figma's servers (rollout flags, the cloud "Suggest auto layout" model) is out of scope unless it can run locally. Suggest auto layout itself is in scope as a local heuristic at P2.
- **Figma Sites/Make responsive breakpoints, FigJam and Slides layouts** (`SlideGridNode` etc.).

### 1.3 Terminology (Figma terms, with API names)

| Figma UI term (2026) | Meaning | Data |
| --- | --- | --- |
| **Auto layout frame** | Frame, component, component set, instance or slot whose children are placed by a layout rule | `layoutMode ≠ 'NONE'` [API] |
| **Freeform** | The UI3 Layout section option for "no auto layout" [OBS] | `layoutMode = 'NONE'` |
| **Flow**: Vertical / Horizontal / Grid | Layout direction or kind [DOC:31289464393751 excerpt] | `layoutMode` = `VERTICAL` / `HORIZONTAL` / `GRID` |
| **Wrap** | Overflowing stack children move to a new line (horizontal) or column (vertical) | `layoutWrap = 'WRAP'` |
| **Primary axis / counter axis** | The axis the stack flows along / the perpendicular axis | `primaryAxis*` / `counterAxis*` [API] |
| **Gap** (formerly "spacing between items") | Distance between consecutive stack children | `itemSpacing` |
| **Auto gap** (Between / Around / Evenly; formerly "Spacing mode: Space between") | Free space is distributed instead of using a fixed gap | `primaryAxisAlignItems = 'SPACE_BETWEEN' / 'SPACE_AROUND' / 'SPACE_EVENLY'` [API] |
| **Counter-axis gap / row gap** (wrap) | Distance between wrapped lines | `counterAxisSpacing` (null means "same as gap") [API] |
| **Padding** | Inset from the frame's edges to its content | `paddingLeft/Right/Top/Bottom` |
| **Fixed / Hug contents / Fill container** | Per-axis sizing behavior | `layoutSizingHorizontal/Vertical` = `FIXED` / `HUG` / `FILL` [API] |
| **Ignore auto layout** (formerly **Absolute position**) | Child stays in the frame but is out of the flow | `layoutPositioning = 'ABSOLUTE'` [API][DOC:360040451373 excerpt] |
| **Canvas stacking**: First on top / Last on top | Paint order of overlapping stack children | `itemReverseZIndex` true / false [API][OBS] |
| **Strokes in layout** / **Inside stroke: Included / Excluded** | Whether stroke width takes layout space | `strokesIncludedInLayout` [API][OBS] |
| **Layout: Updated / Legacy** | Layout engine version of the frame (CSS-aligned rules shipped 2026-07) | Not exposed in the public API. Illigma field `layoutVersion` [OBS][SRC:forum-56357] |
| **Text baseline alignment** | Horizontal stacks align children on their text baselines | `counterAxisAlignItems = 'BASELINE'` [API] |
| **Tracks / Rows / Columns** (grid) | Grid divisions with Fixed / Hug / Flex(fr) sizes | `gridRowSizes`, `gridColumnSizes` (`GridTrackSize`) [API] |
| **Span** | Number of rows or columns a grid child occupies | `gridRowSpan`, `gridColumnSpan` [API] |
| **Auto rows** | Row count follows the content | `gridAutoTracks = 'ROWS'` [API] |
| **Automatic placement** | Children flow into the next free cell in layer order | `gridItemsPositioning = 'ROW_AUTO_FLOW'` [API] |
| **Min / max width / height** | Size limits on auto layout frames and their direct children | `minWidth`… (`null` = none) [API] |

**Terms users confuse (the implementation must keep these apart):**

1. **Auto layout Grid flow** is not **Layout guides** (formerly "Layout grids") and not the **pixel grid**. Only the first one arranges children.
2. **Gap** is not **Smart selection** spacing (the tidy-up and spacing handles on a plain multi-selection). Smart selection does not create an auto layout frame.
3. **Fill container** (sizing) is not a **Fill** paint.
4. **Hug** (frames) corresponds to the **Auto width / Auto height** text-resize modes, but the UI uses one shared dropdown for both.
5. **Constraints** apply to freeform children and to *Ignore auto layout* children. Sizing applies to flow children.
6. **Wrap** (auto layout) is not text wrapping.
7. **Auto gap** is not *Auto width*.
8. **Section** is not an auto layout frame. Sections cannot have auto layout [KNOW → V-01].

---

## 2. Data model

All properties below are **document data**: persisted, undoable, copied with the node and synced to instances. Exceptions are marked *derived* or *transient*.

### 2.1 Which nodes can be auto layout containers

| Node type | Can be container | Notes |
| --- | --- | --- |
| `FRAME` | yes | `DefaultFrameMixin → BaseFrameMixin → AutoLayoutMixin, GridLayoutMixin` [API] |
| `COMPONENT` | yes | same mixins [API] |
| `COMPONENT_SET` | yes | `BaseFrameMixin` [API] |
| `INSTANCE` | yes, layout inherited from main component; properties overridable (see §3.20) | [API][KNOW → V-38] |
| `SLOT` | yes, but **not `GRID`** (throws `cannotApplyGridToSlot`) | [API] |
| `GROUP`, `SECTION`, shapes, `TEXT`, `BOOLEAN_OPERATION`, `VECTOR` | no | They do not have `AutoLayoutMixin` [API] |

Every `SceneNode` with `LayoutMixin` (which includes `AutoLayoutChildrenMixin` and `GridChildrenMixin`) can be a **child** of an auto layout frame [API].

### 2.2 Container properties: stack flows (`AutoLayoutMixin`)

| Property | Type / enum | Default | Range / rule | Evidence |
| --- | --- | --- | --- | --- |
| `layoutMode` | `'NONE' \| 'HORIZONTAL' \| 'VERTICAL' \| 'GRID'` | `'NONE'` | Setting it repositions children and may resize the frame. Setting `NONE` does **not** restore earlier child positions | [API] |
| `paddingLeft/Right/Top/Bottom` | number | 0 when added via API [KNOW] | ≥ 0 [KNOW → V-12]. Bindable to variables | [API] |
| `horizontalPadding`, `verticalPadding` | number | n/a | **Deprecated** aliases. Import only | [API] |
| `primaryAxisSizingMode` | `'FIXED' \| 'AUTO'` | `AUTO` (Hug) when layoutMode is first set via API ("defaults to Hug x Hug") | `AUTO` = Hug. A frame cannot be AUTO on an axis where it is itself Fill | [API] |
| `counterAxisSizingMode` | `'FIXED' \| 'AUTO'` | `AUTO` (API) | same | [API] |
| `strokesIncludedInLayout` | boolean | API default undocumented. Help says strokes are ignored by default; observed container showed "Included" | true ≈ CSS `box-sizing: border-box` | [API][DOC:360040451373 excerpt][OBS] → V-24 |
| `layoutWrap` | `'NO_WRAP' \| 'WRAP'` | `'NO_WRAP'` | Only for HORIZONTAL/VERTICAL (throws otherwise) | [API] |
| `primaryAxisAlignItems` | `'MIN' \| 'MAX' \| 'CENTER' \| 'SPACE_BETWEEN' \| 'SPACE_EVENLY' \| 'SPACE_AROUND'` | `'MIN'` [KNOW] | `SPACE_*` = Auto gap. REST v0.44 still lists only `MIN/CENTER/MAX/SPACE_BETWEEN`, so importers must accept unknown values | [API] |
| `counterAxisAlignItems` | `'MIN' \| 'MAX' \| 'CENTER' \| 'BASELINE'` | `'MIN'` [KNOW] | `BASELINE` only on HORIZONTAL | [API] |
| `counterAxisAlignContent` | `'AUTO' \| 'SPACE_BETWEEN'` | `'AUTO'` [KNOW] | Only when `layoutWrap='WRAP'` (throws otherwise) | [API] |
| `itemSpacing` | number | 0 (API) [KNOW] | **May be negative** (REST: "Can be negative"). Bindable | [API] |
| `counterAxisSpacing` | `number \| null` | null, meaning in sync with `itemSpacing` | Setting null makes the getter return `itemSpacing`. Must be ≥ 0 ("must be positive"). Only for WRAP. Bindable | [API] |
| `itemReverseZIndex` | boolean | `false` (= "Last on top") | Visual paint order only | [API][OBS] |
| `clipsContent` | boolean | frames: true when drawn with the Frame tool [KNOW]. Auto layout wrappers: → V-27 | Clips descendants to the frame bounds | [API][OBS] |
| `overflowDirection` | `NONE \| HORIZONTAL_SCROLLING \| VERTICAL_SCROLLING \| …` | NONE | Prototype scrolling (M7) | [API] |
| `layoutVersion` *(Illigma field; not in the public API)* | `'LEGACY' \| 'UPDATED'` | `UPDATED` for new frames. Imported/legacy files: `LEGACY` | Instances inherit it from the main component and cannot toggle it | [OBS][SRC:forum-56357][SRC:blog-2026-07] |

### 2.3 Container properties: grid flow (`GridLayoutMixin`)

| Property | Type | Default | Rule | Evidence |
| --- | --- | --- | --- | --- |
| `gridRowCount`, `gridColumnCount` | integer | API: 1 [KNOW] | ≥ 1 (throws < 1). Cannot drop below what the children occupy (API throws; UI moves objects, see §3.19). `gridRowCount` is read-only while `gridAutoTracks='ROWS'` | [API][DOC:31289469907863 excerpt] |
| `gridRowGap`, `gridColumnGap` | number | 0 [KNOW] | ≥ 0 (throws < 0). Bindable | [API] |
| `gridRowSizes`, `gridColumnSizes` | `GridTrackSize[]` (length = count) | API: tracks are `FLEX`. UI: tracks **and** the container start as **Hug** | Order: top→bottom, left→right | [API][SRC:plugin-upd-120] |
| `GridTrackSize.type` | `'FLEX' \| 'FIXED' \| 'HUG'` | `FLEX` for tracks added by raising the count (API) | `HUG` ≈ CSS `fit-content(100%)`. `FLEX` ≈ `fr` and is **invalid when the container hugs on that axis** | [API] |
| `GridTrackSize.value` | number? | FLEX: optional (fr, 1 when absent [KNOW]) | FIXED: px. FLEX: fr factor (values other than 1 allowed since 2025-11) | [API][SRC:plugin-upd-120] |
| `gridAutoTracks` | `'NONE' \| 'ROWS'` | `'NONE'` (API). UI default → V-33 | `ROWS`: rows are added and removed automatically | [API][SRC:forum-54244] |
| `gridItemsPositioning` | `'MANUAL' \| 'ROW_AUTO_FLOW'` | `'MANUAL'` (API). UI default → V-33 | `ROW_AUTO_FLOW`: row-major placement in layer order, like CSS `grid-auto-flow: row` | [API] |
| REST-only `gridRowsSizing`, `gridColumnsSizing` | string | n/a | CSS `grid-template-rows/columns` string. *Derived*, export only | [API REST] |

### 2.4 Child properties (`AutoLayoutChildrenMixin`, `GridChildrenMixin`, `LayoutMixin`)

| Property | Type | Default | Rule | Evidence |
| --- | --- | --- | --- | --- |
| `layoutPositioning` | `'AUTO' \| 'ABSOLUTE'` | `'AUTO'` | ABSOLUTE = Ignore auto layout. Takes x/y/w/h and constraints. Removed from the flow and from Hug | [API] |
| `layoutGrow` | `0 \| 1` | 0 | 1 = Fill along the parent's **primary** axis. Only 0 and 1 are supported | [API] |
| `layoutAlign` | `'INHERIT' \| 'STRETCH' \| 'MIN' \| 'CENTER' \| 'MAX'` | `'INHERIT'` | STRETCH = Fill along the parent's **counter** axis. `MIN/CENTER/MAX` are deprecated (per-child counter alignment was removed). Map them to INHERIT on import | [API] |
| `layoutSizingHorizontal`, `layoutSizingVertical` | `'FIXED' \| 'HUG' \| 'FILL'` | derived | Shorthand for the four fields above (mapping in §2.6). `HUG` only on auto layout frames and text. `FILL` only on auto layout children. Invalid values throw | [API] |
| `minWidth`, `maxWidth`, `minHeight`, `maxHeight` | `number \| null` | null | Positive. Only on auto layout frames and their direct children. Bindable | [API] |
| `gridRowAnchorIndex`, `gridColumnAnchorIndex` | integer (read-only; set via `setGridChildPosition` / `appendChildAt`) | first free cell | 0-based. In bounds. No overlap (throws). Setting is not allowed in `ROW_AUTO_FLOW` | [API] |
| `gridRowSpan`, `gridColumnSpan` | integer ≥ 1 | 1 | Within bounds. No overlap | [API] |
| `gridChildHorizontalAlign`, `gridChildVerticalAlign` | `'MIN' \| 'CENTER' \| 'MAX' \| 'AUTO'` | `'AUTO'` [KNOW] | Alignment inside the grid area. The meaning of AUTO is undocumented → V-35 | [API] |
| `x`, `y`, `relativeTransform` translation | number | *derived* for flow children | Writes to flow children are ignored. Rotation components are kept | [API] |
| `width`, `height` | number | *derived* for Hug/Fill | `resize()` ≥ 0.01. Resizing a child resizes a Hug parent | [API] |
| `targetAspectRatio` | Vector \| null | null | A locked ratio is kept when resized by auto layout (Fill). Not allowed on auto-resizing text | [API] |
| `visible` | boolean | true | Hidden children are excluded from layout [KNOW → V-21]. Bindable to a boolean variable | [API] |

### 2.5 Text-specific fields that act as sizing

| Field | Values | Auto layout meaning | Evidence |
| --- | --- | --- | --- |
| `textAutoResize` | `NONE` (fixed W and H), `HEIGHT` (fixed W, hug H), `WIDTH_AND_HEIGHT` (hug both), `TRUNCATE` (deprecated) | Width Hug ⇔ `WIDTH_AND_HEIGHT`. Height Hug ⇔ `HEIGHT` or `WIDTH_AND_HEIGHT` | [API] |
| `textTruncation`, `maxLines` | `DISABLED/ENDING`, ≥ 1 or null | Truncation caps the hugged height | [API] |
| `leadingTrim` | `NONE / CAP_HEIGHT` | Changes the text box height, and therefore layout | [API] (spec: `06-text-typography.md`) |

### 2.6 Normative mapping: `layoutSizing*` ⇄ underlying fields

For a node **N** whose parent **P** is a stack (`HORIZONTAL`/`VERTICAL`), let *axis* be horizontal (the vertical case is symmetric) [API 7358/7436 shorthand definition]:

| layoutSizingHorizontal | P.layoutMode = HORIZONTAL | P.layoutMode = VERTICAL |
| --- | --- | --- |
| `FILL` | `N.layoutGrow = 1` | `N.layoutAlign = 'STRETCH'` |
| `FIXED` | `N.layoutGrow = 0` and N's own sizing on that axis = FIXED | `N.layoutAlign = 'INHERIT'` and N's own sizing = FIXED |
| `HUG` (N is an auto layout frame) | `N.layoutGrow = 0`; N's axis that is horizontal: if `N.layoutMode = HORIZONTAL` then `N.primaryAxisSizingMode = AUTO`, else `N.counterAxisSizingMode = AUTO` | same with `layoutAlign = INHERIT` |
| `HUG` (N is text) | `textAutoResize = WIDTH_AND_HEIGHT` | same |

If **N** is itself a GRID frame, or its parent is a GRID frame, the API does not document how primary and counter axes map. **Illigma therefore stores `layoutSizingHorizontal/Vertical` explicitly as the canonical value** and derives the legacy fields only for import and export (→ V-34).

### 2.7 Transient UI state (never persisted, never undoable)

- Hovered or active gap/padding handle and its on-canvas numeric field.
- Drag-reorder session: dragged nodes, live placeholder index, insertion indicator, Ctrl/⌘ modifier state.
- Keyboard focus of the alignment box. This enables W/A/S/D, arrow keys, X and B (§5).
- Selected grid track(s), hovered track pill, grid picker hover.
- Whether the min/max fields are expanded. Per [DOC:360040451373 excerpt], they collapse when the object is deselected and reselected, and clicking the W/H icon brings them back.
- Hover preview of min/max limits on canvas.

### 2.8 Persisted derived geometry

Figma files carry resolved geometry for every node. REST exposes `absoluteBoundingBox`, `size` and transforms for auto layout children [API REST]. Illigma must:

1. Persist the resolved child geometry.
2. Re-run layout only for dirty subtrees. Never re-run it as a side effect of painting or opening a file.
3. Make layout **idempotent**: re-running it on an unchanged tree changes nothing, bit for bit.

This also mirrors Figma keeping the old layout when fonts are missing ([API]: text with a missing font "will not re-layout until … opened on a machine that has the font").

---

## 3. Behavior specification

Notation:
- *main* = the primary axis; *cross* = the counter axis.
- *inner size* = frame size − padding − (included strokes).
- *flow children* = children with `visible = true` **and** `layoutPositioning = 'AUTO'`.
- *n* = number of flow children.

### 3.1 Applicability and availability

1. Auto layout can be applied to frames, components, component sets, instances (inherited from the main component) and slots. Slots cannot use GRID [API].
2. Anyone with edit access can apply auto layout, on any plan [DOC:31289464393751 excerpt]. Illigma is local, so this is always allowed.
3. All container fields of §2.2 are stored on every frame-like node, whatever its `layoutMode`. Whether the UI **restores** earlier padding and gap after Freeform → Vertical is unverified → V-03.

### 3.2 Adding auto layout

**Entry points.** The following all apply auto layout to the current selection:

- Shift+A [DOC:5731482952599 excerpt].
- The Layout section of the inspector: choosing Vertical, Horizontal or Grid on a frame that is currently Freeform [OBS].
- The context menu or Object menu "Add auto layout" [KNOW → V-02].

**Rules by selection** (Shift+A):

| Selection | Result | Evidence |
| --- | --- | --- |
| One frame-like node that is not auto layout and has children | That frame **becomes** an auto layout frame in place. It keeps its id, name, fills, effects and position | [DOC:5731482952599 excerpt][KNOW → V-02] |
| One or more layers that are not such a frame (shapes, text, groups, several frames, …) | A **new** auto layout frame is created around them in their common parent. The wrapper takes the z-index slot of the selection's topmost layer [KNOW → V-02]. The wrapper is named "Frame N" [KNOW] | [DOC:5731482952599 excerpt] ("If you have one or more layers selected, Figma will create an auto layout frame around them") |
| Layers that are flow children of an auto layout frame | The new wrapper replaces them **in the flow**, at the index of the first selected child in flow order. It is nested auto layout | [KNOW → V-04] |
| A frame that already has auto layout | The frame is wrapped in a new auto layout parent. Shift+A does not toggle auto layout off | [KNOW → V-04] |
| A group | Wrapped, or converted (unverified) | [KNOW → V-04] |
| Nothing selected | No-op | [KNOW] |

**Inference.** When auto layout is applied by Shift+A (in place or as a wrapper), Figma "will try to determine which auto layout flow — vertical, horizontal, or grid — you want to use" [DOC:31289464393751 excerpt]. Illigma must infer:

- **Flow.** Compare the children's spatial arrangement. Pick HORIZONTAL if their x-intervals are largely disjoint and they are ordered left to right. Pick VERTICAL if their y-intervals are disjoint. Pick GRID if they form a 2-D lattice. Tie-break by the larger extent [KNOW → V-02].
- **Child order** = spatial order along the inferred axis (left to right, or top to bottom), **not** the previous z-order [KNOW → V-02].
- **Gap** = derived from the existing spacing between neighbors (mean, median or first gap; rounding is unknown) [KNOW → V-02].
- **Padding** (in-place conversion) = distance from the children's union bounds to the frame edges, chosen so the frame's size and the children's positions are preserved as far as possible [KNOW → V-02].
- **Padding** (new wrapper) is unknown: 0, or a default such as 10 [KNOW → V-02].
- **Sizing.** After conversion, both axes are Hug unless that would change the size. The API default when setting `layoutMode` is "Hug x Hug" [API]. The UI behavior is → V-02.
- **Alignment.** Inferred from the children's common edges (for example, all left-aligned gives MIN) [KNOW → V-02].
- **Whole operation = one undo step.**

**Suggest auto layout.** Shortcut ⌃⇧A on macOS (Control, not Command) and Ctrl+Alt+Shift+A on Windows. Also available from the right-click menu "More layout options" and from the Actions menu.

- It examines a frame or component, decides which objects belong together in auto layout frames, and creates as many nested auto layout frames as needed in one pass, "attempting to preserve the placement" [DOC:5731482952599 excerpt].
- Figma says it handles moderately complex designs such as cards, navigation bars and mobile screens. For large designs it should be used in batches [DOC:5731482952599 excerpt].
- Illigma: a local heuristic, P2. It must be a single undoable transaction.

### 3.3 Removing auto layout

- **Entry points:** ⌥⇧A on macOS / Alt+Shift+A on Windows [SRC:kinney][SRC:shortcut-guides]; choosing **Freeform** in the Layout section [OBS]; a context-menu item [KNOW].
- It works on a multi-selection: all selected auto layout frames are converted in one step [SRC:forum-remove-all].
- **Effect:**
  - `layoutMode = 'NONE'`.
  - Every child keeps its **current** position and size. "Removing auto-layout from a frame does not restore the children to their original positions" [API].
  - The frame keeps its current size, and its sizing becomes Fixed on both axes.
  - Children that were Fill or Hug relative to this parent become Fixed at their current size. Their own Hug (if they are auto layout frames) stays.
  - Absolute children become ordinary children at the same position.
  - Children's constraints apply from now on [KNOW → V-03].
- Removing auto layout from an **instance** is not allowed. Only the main component can do it [KNOW → V-38].

### 3.4 Flow (direction)

- **Horizontal:** flow children are placed along x, left to right in `children` order. **Vertical:** along y, top to bottom [DOC:31289464393751 excerpt][API].
- **Switching H ↔ V** keeps each child's **horizontal/vertical** sizing intent (`layoutSizingHorizontal/Vertical` unchanged). The underlying `layoutGrow`/`layoutAlign` swap axes, and the frame's own width/height sizing stays [KNOW]. Figma staff acknowledged a 2024 bug where children unexpectedly changed from Fill to Fixed on direction change [SRC:forum-23826]. Illigma must implement the *intended* behavior → V-05.
- **Switching to GRID** from a stack: children are placed into cells in `children` order, row-major. The initial row and column counts are unknown (perhaps derived from the current arrangement) [KNOW → V-33].
- **Switching from GRID** to a stack: `children` order becomes the flow order [KNOW → V-33].
- Every flow change is one undo step, together with all repositioning it causes.

### 3.5 Sizing model (Fixed / Hug / Fill)

**Definitions** [DOC:360040451373 excerpt][API]:

- **Fixed:** the user sets the size. Typing a number into W or H, or resizing on canvas, sets Fixed on that axis.
- **Hug contents:** the smallest size that contains the flow children plus padding and gaps. Only valid on auto layout frames (including AL instances and components) and on text.
- **Fill container:** takes up the available space in the parent auto layout frame along that axis. Only valid for **flow** children of auto layout frames. It is not available on top-level frames or on Ignore-auto-layout children.

**Option availability matrix** (what the W/H dropdowns must offer):

| Node \ context | Parent is page or section, or a freeform frame | Flow child of a stack | Flow child of a grid | Absolute child of an auto layout frame |
| --- | --- | --- | --- | --- |
| Auto layout frame / AL instance | Fixed, Hug | Fixed, Hug, Fill | Fixed, Hug, Fill | Fixed, Hug |
| Text | Fixed, Hug (Auto W/H) | Fixed, Hug, Fill | Fixed, Hug, Fill | Fixed, Hug |
| Frame without auto layout, shape, vector, image, non-AL instance | Fixed | Fixed, Fill | Fixed, Fill | Fixed |
| Group | Fixed | Fixed, plus Fill (unverified) | same | Fixed |

Sources: [API][DOC:360040451373 excerpt][SRC:forum-58344]. The group row is → V-07.

**Automatic conversions** (each is part of the same undo step as the action that triggers it):

1. **A child becomes Fill on an axis where its parent hugs.** The parent switches to **Fixed** on that axis at its current size [DOC:360040451373 excerpt: "If any child objects … are set to Fill container, the parent frame will no longer hug contents and become Fixed for the axis"].
   - Possible counter-axis exception: a Hug parent may keep hugging while at least one other flow child is not Fill on that axis. The Fill children then stretch to the size set by the non-Fill children [KNOW → V-06]. This is a common menu/list pattern.
2. **A parent becomes Hug on an axis where children are Fill.** Those children switch to Fixed at their current size [SRC:forum-19030 (2023)]. On the counter axis this may only happen when *all* flow children are Fill → V-06.
3. **On-canvas resize of a Hug frame along an axis** switches that axis to Fixed. The other axis is unchanged [KNOW → V-08].
4. **On-canvas or inspector resize of a Fill child along an axis** switches that axis to Fixed [KNOW → V-08].
5. **An auto layout frame cannot be Hug and Fill on the same axis at once.** Setting one replaces the other [API: "an auto-layout frame cannot simultaneously stretch to fill its parent and shrink to hug its children"].
6. **Leaving the auto layout parent** (moved out, or the parent's auto layout removed) turns Fill into Fixed at the current size [KNOW → V-03].
7. **Turning on Ignore auto layout** turns Fill into Fixed [SRC:forum-58344][KNOW].
8. **Double-clicking an edge resize handle** of an auto layout frame sets Hug on that axis. For text it sets auto width/height [KNOW → V-08].

**Overflow.** Fixed or Hug children are never shrunk by auto layout. They overflow the frame, and `clipsContent` decides whether the overflow is visible [API example "Child 2 is clipped"][KNOW]. Fill children never get a negative size. Their minimum is `max(minW, floor)`, where *floor* = the child's own padding and included inside strokes in the Updated version, or 0 for non-auto-layout nodes [KNOW → V-10].

**Aspect-ratio-locked children.** A Fill child with `targetAspectRatio` derives its other axis from the ratio [API example: Fill width → 500 × 750 for a 2:3 ratio].

**Rotated children.** They take part in layout with their axis-aligned bounding box [KNOW → V-09]. Fill may be unavailable or behave differently → V-09.

### 3.6 Gap

- **Fixed gap.** `itemSpacing` is placed between **consecutive flow children** only: n − 1 gaps, none before the first or after the last [API]. Hidden and absolute children do not create gaps [KNOW → V-21]. Decimal values are accepted [KNOW].
- **Negative gap** is allowed (REST: "Can be negative") [API]. Children overlap, and canvas stacking (§3.15) decides which is painted on top. The Hug size uses the arithmetic sum `Σ sizes + gap·(n−1)`, so it can be smaller than the largest child. The behavior when that sum falls below the largest child (or below 0) is → V-11.
- **Auto gap.** Selecting **Auto** in the gap field, or pressing **X** while the alignment box is focused, toggles between Auto and a fixed value [DOC:360040451373|31289464393751 excerpt]. Auto distributes free space according to the *auto spacing type* chosen in the layout settings [SRC:forum-57146]:

| UI | Data | Leading/trailing space | Between items | n = 1 |
| --- | --- | --- | --- | --- |
| **Between** (default) | `SPACE_BETWEEN` | 0 | free/(n−1) | child at the **leading edge** |
| **Around** | `SPACE_AROUND` | half of the inter-item gap | free/n | child **centered** |
| **Evenly** | `SPACE_EVENLY` | equal to the gap | free/(n+1) | child **centered** |

  - The labels mirror CSS `space-between`, `space-around` and `space-evenly` [SRC:forum-57146]. Around and Evenly arrived in a staggered rollout in 2026-08 [SRC:forum-57146][SRC:kusiima].
  - **Automatic gaps never become negative.** When the children don't fit, they "bunch at the start of the frame" with a gap of 0, like CSS flexbox `space-between` [SRC:forum-57146][SRC:old-notes→DOC:42031586813719]. The overflow fallback for Around and Evenly is assumed to be the same (start) → V-13.
  - **Toggling Auto off restores the previously stored fixed `itemSpacing`.** The value stays stored while Auto is on [KNOW → V-13].
  - **Auto gap with a Hug primary axis** has no free space, so every gap is 0. The [OBS] recorded the auto-spacing control as "disabled for this configuration" on a Vertical+Wrap container. Exactly when the control is disabled (Hug primary axis vs gap not Auto) is → V-13.
  - **Auto gap with Fill children on the primary axis:** the Fill children consume the free space, so the gaps are 0 [KNOW, CSS-consistent → V-13].
- **Variables.** `itemSpacing` and `counterAxisSpacing` are bindable to number variables [API]. Binding a variable makes the gap fixed (not Auto) [KNOW → V-40]. Whether negative variable values are honored is → V-40.

### 3.7 Padding

- There are four independent values [API]. The inspector shows **horizontal** (L/R) and **vertical** (T/B) combined fields, plus an *individual padding* toggle that shows all four [KNOW][OBS "padding"]. A combined field shows "Mixed" when its pair differs [KNOW].
- **Entry shortcuts:** comma-separated values in CSS order (top, right, bottom, left) [SRC:uxdesign-tricks]. ⌘/Ctrl-click on a padding input edits all padding [SRC:kinney].
- **Padding is ≥ 0.** Negative input is clamped to 0 or rejected [KNOW → V-12].
- **Updated layout version: padding floor** [DOC:42031586813719 excerpt]:
  - A frame can never be smaller than `padStart + padEnd` (+ included inside stroke weights) on each axis. This holds even when it is Fixed or Fill.
  - The floor **beats `max-width` / `max-height`** ("padding is always fully respected and ignores any max width").
  - Worked example from the article: a 50 px wide frame with 30 px left + 30 px right padding becomes 60. Adding a 10 px inside stroke that is Included makes it 80 [DOC:42031586813719 excerpt][SRC:blog-2026-07].
  - Frames may grow when upgraded from Legacy. The documented remedy is to reduce the padding.
- **Legacy layout version:** padding is compressed when the frame is smaller than its padding. Example: a 50 px frame with 60 px of padding [DOC:42031586813719 excerpt]. The exact compression rule (proportional or clipped) is → V-26.
- **Padding and absolute children:** absolute children are positioned relative to the frame's edges, not the padding box, and are not affected by padding [API][KNOW → V-19].
- **Grid frames and padding:** the API's `layoutMode` doc lists padding as applicable to HORIZONTAL/VERTICAL. Whether GRID frames show and honor padding is → V-34.

### 3.8 Alignment

- **The 9-position control** sets `primaryAxisAlignItems` × `counterAxisAlignItems`, each one of MIN, CENTER or MAX [API][OBS "nine-position alignment"].
  - Horizontal flow: columns = primary (left, center, right), rows = counter (top, center, bottom).
  - Vertical flow: rows = primary, columns = counter.
- **There is no per-child counter alignment.** All children share the frame's counter alignment. The old per-child `layoutAlign` MIN/CENTER/MAX values are deprecated [API].
- **With Auto gap:** the primary axis is distributed, so the control only offers the counter-axis position (3 choices) [DOC:31289464393751 excerpt: "the gap between items will determine what alignment options you have available"][KNOW → V-14].
- **Keyboard** (alignment box focused): arrow keys move the selection through the 9 positions. W/A/S/D align to the top, left, bottom or right edge [DOC:360040451373|31289464393751 excerpt].
- **Overflow under packed alignment:** with MIN, overflow goes past the end edge. With MAX, it goes past the start. With CENTER, it overflows both sides equally (unsafe centering, like CSS `center`) [KNOW → V-14].
- **Fill (stretch) children** ignore counter alignment, because they occupy the whole inner cross size. If a stretched child is clamped by `maxH`/`maxW`, it is positioned by the counter alignment [KNOW → V-14].
- **Text baseline alignment** (`counterAxisAlignItems = 'BASELINE'`):
  - Only available on **horizontal** frames that contain a text child. The control is disabled otherwise [API][DOC:360040451373 excerpt][OBS: "baseline control disabled in this context" on a vertical container].
  - Toggled in the layout settings, or with **B** while the alignment box is focused [DOC:360040451373|31289464393751 excerpt].
  - While it is on, only the primary alignment (Left / Center / Right) can be chosen [DOC excerpt].
  - Rule: the children are positioned so that their baselines lie on one horizontal line. A text child uses the baseline of its **first line** [KNOW → V-15].
  - A child without text uses a synthesized baseline (its bottom edge, as in CSS) [KNOW → V-15].
  - A nested auto layout child uses the baseline of its first text descendant [KNOW → V-15].
  - The Hug height is the maximum ascent plus the maximum descent [KNOW].
  - Community reports of inconsistent baselines depending on child order exist [SRC:forum-28674]. The Illigma contract is the deterministic rule above, and it must be checked against Figma → V-15.
- **⌥/Alt + W/A/S/D/H/V** with an auto layout child selected aligns it relative to its parent (the general align shortcut). With an auto layout frame selected, these may set the frame's alignment instead [SRC:skillademia][KNOW → V-14].

### 3.9 Min / max width and height

- **Adding limits.** The W dropdown offers **Add min width** and **Add max width**, and the H dropdown the height equivalents. **Remove min and max** clears them. Each field takes a number or a number variable [DOC:360040451373 excerpt][API].
- **Applies to** auto layout frames and their direct children, whatever the sizing mode (Fixed, Hug or Fill) [DOC:360040451373 excerpt][API].
- **Display.** The W/H icon gets side marks when a limit is set. Hovering the icon previews the limits on canvas. The fields hide after reselecting and can be re-expanded by clicking the icon [DOC:360040451373 excerpt].
- **Resolution order** (Illigma contract, CSS-consistent):
  - `size = max(minV, min(maxV, preferred))`, so **min wins over max** when min > max [KNOW → V-16].
  - In the Updated version, the padding floor is applied last and wins over everything (§3.7).
- **Hug with max:** the frame stops growing at max, and the content overflows (clipped if `clipsContent`). With **Wrap**, Hug + max on the primary axis gives a wrapping limit: the frame grows until max, then wraps [KNOW → V-17].
- **Fill with min/max:** the flexible-length algorithm (§3.22) clamps, then **redistributes** the remaining space to the other Fill siblings. A 2025 forum report showed Figma (Aug 2025 build) **not** redistributing: the other Fill child fell back to its content width [SRC:forum-57215]. The Updated version is documented as CSS-aligned, so Illigma implements redistribution for UPDATED → V-16.
- **Fixed with min/max:** typing a value below min or above max is clamped [KNOW → V-16]. On-canvas resizing stops at the limits [KNOW → V-16].
- **Side effect:** setting min or max width greys out the Left/Right and Scale constraint options for that layer [SRC:forum-20043] → V-16.
- **Grid containers:** min/max were not supported as of May 2025 [SRC:forum-40352]. Current status → V-36.

### 3.10 Text inside auto layout

- **Width Hug** ⇔ `textAutoResize = WIDTH_AND_HEIGHT`: a single line (unless there are hard line breaks), with natural width [API].
- **Width Fixed + Height Hug** ⇔ `HEIGHT`: wraps at the fixed width [API].
- **Fill width** ⇒ the text gets the resolved width from the parent. Its height hugs (`HEIGHT` mode), and it re-wraps whenever the parent's resolved width changes [KNOW → V-18]. This is the most common responsive-text pattern.
- **Fill height** ⇒ the text box is fixed at the resolved height (`NONE`), and text overflows or truncates [KNOW → V-18].
- **Hug width with `maxWidth` set:** the text grows until max, then wraps and its height hugs [KNOW → V-17].
- **Truncation:** `textTruncation = 'ENDING'` with `maxLines` caps the hugged height at `maxLines` lines and adds an ellipsis. With HEIGHT or WIDTH_AND_HEIGHT, truncation only happens together with `maxHeight` or `maxLines` [API].
- **Live editing:** editing characters, font, size, line height or leading trim re-runs layout of every Hug ancestor in the same transaction [KNOW].
- **Font metrics** (ascent/descent, line height, leading trim) come from the text engine (`06-text-typography.md`).

### 3.11 Wrap

- **Availability.** Wrap applies to the horizontal flow (wraps into rows) and, since 2026-09-25, the vertical flow (wraps into columns) [SRC:forum-58389][DOC:360040451373 excerpt]. Vertical wrap "is not masonry": objects keep auto layout order and move to the next column only after the current column reaches the available height [DOC:360040451373 excerpt via search].
- **Line breaking.** Children are taken in order. A child starts a new line when the line is not empty and `lineUsed + gap + childMain > innerMain`. A line always holds at least one child, even if that child alone overflows [API: wrapping semantics; KNOW for the exact comparison → V-17].
- **Wrap boundary:**
  - Fixed primary axis: the inner main size.
  - Hug primary axis **with** a max on that axis: `max − insets`.
  - Hug primary axis **without** a max: no wrapping (one line) [KNOW → V-17].
  - Whether enabling Wrap on a Hug-primary frame silently switches it to Fixed is → V-17.
- **Gaps.** `itemSpacing` applies within a line. `counterAxisSpacing` applies between lines. When it is null it follows `itemSpacing` [API].
  - In the UI, the counter-axis gap field can be set to **Auto**, which maps to `counterAxisAlignContent = 'SPACE_BETWEEN'` [KNOW → V-17].
  - `counterAxisSpacing` must be ≥ 0 [API]. Whether a negative item gap is allowed with wrap is → V-17.
- **Per-line main axis.** Each line distributes its own free space: Fill children of that line grow first, then `primaryAxisAlignItems` (including Auto gap) is applied per line [KNOW → V-17].
- **Line cross size** = the largest hypothetical cross size of the items in that line [API].
- **Align content** [API]:
  - `AUTO`: if **all** children are Fill on the cross axis, the lines stretch to fill the frame (CSS `align-content: stretch`). Otherwise each line takes its largest item's size, and the block of lines is aligned by `counterAxisAlignItems` (CSS `align-content: start | center | end`). `counterAxisSpacing` is respected.
  - `SPACE_BETWEEN`: lines are sized to their largest item, and the free cross space is divided evenly **between** lines. If the lines overflow, the spacing is 0.
- **Items within a line** are aligned by `counterAxisAlignItems` inside the line's cross size. Fill (stretch) items take the line's cross size [KNOW → V-17].
- **Hug cross size** = Σ line cross sizes + `counterAxisSpacing`·(lines−1) + insets [API][KNOW].
- **Fill children in wrap:** for line breaking, a Fill child counts with its hypothetical size, taken as `minWidth` (or `minHeight` for vertical) when set, else its floor, else 0. This makes the "Fill + min width" responsive-card pattern work [KNOW → V-17].
- **Baseline + wrap (horizontal):** baselines are aligned per line [KNOW → V-15].
- **Turning wrap off** returns to a single line. `counterAxisSpacing` and `counterAxisAlignContent` stay stored [KNOW].

### 3.12 Ignore auto layout (absolute children)

- **Toggle.** Selecting a flow child shows an **Ignore auto layout** control (formerly "Absolute position"). It sets `layoutPositioning = 'ABSOLUTE'` [DOC:360040451373 excerpt][API].
  - The child keeps its **current visual position**. Siblings reflow to close the gap, and a Hug parent recomputes without it [API: "may cause the parent layer's size to change, since it will recalculate as if this child did not exist"].
- **Drag-in shortcut.** Holding **⌃ Control** (macOS) or **Ctrl** (Windows) while dragging an object into an auto layout frame drops it as an absolute child at the drop position [DOC:360040451373 excerpt]. Note the conflict: ⌘/Ctrl while dragging also means "do not nest" (§3.16). → V-19 must record exactly what each modifier does on each OS.
- **While absolute:**
  - `x`, `y`, `width`, `height` are editable.
  - The child **respects constraints** relative to the auto layout frame when the frame resizes [API].
  - Fill is not offered for it [SRC:forum-58344]. It can still Hug its own content if it is an auto layout frame or text [KNOW].
  - It takes no part in gaps, Hug, wrap, baseline or Auto-gap distribution [API].
- **Paint order.** The absolute child stays at its index in `children`, so its z-order follows layer order. Whether canvas stacking (`itemReverseZIndex`) also affects absolute children is → V-20.
- **Toggling off:** the child re-enters the flow at its **index in `children`**, not at the flow position closest to where it was drawn [KNOW → V-19].
- **Default constraints** of a newly absolute child are unknown (Left/Top or the previous constraints) → V-19.

### 3.13 Hidden children

- `visible = false` children are **excluded from layout**: they take no size, add no gap and do not affect Hug. The remaining children reflow as if the hidden child were absent [KNOW → V-21]. This is what makes boolean component properties ("show icon") collapse layouts.
- Hidden children keep their index. Showing them again restores them at the same flow position [KNOW].
- Opacity 0 is **not** hidden. The child still takes space [KNOW → V-21].
- `visible` is bindable to a boolean variable. A mode change re-runs layout [API].
- In GRID with manual placement, whether a hidden child keeps its cell (blocking it) or frees it is → V-35.

### 3.14 Strokes in layout and the layout version

**The setting.** The layout settings popover has a strokes control: "Inside stroke: **Included / Excluded**" ([OBS] showed "Inside stroke = Included" on an Updated frame). Older help text calls it "included in layout / excluded from layout" [DOC:360040451373 excerpt]. Data: `strokesIncludedInLayout` [API]. The help text says strokes are ignored by default. The [OBS] container showed Included, and the default for new frames is → V-24.

**Updated version (CSS-aligned, shipped 2026-07-24)** [DOC:42031586813719 excerpt][SRC:blog-2026-07][SRC:forum-56357]:
- Only **inside** strokes of the auto layout frame itself affect layout. Each side's inside stroke weight (`strokeTopWeight` … for individual strokes) is added to that side's padding when Included. This matches CSS `border-box`.
- **Center and outside strokes are visual only.** They never affect layout.
- A parent's stroke setting **no longer carries into its children**. Each frame's strokes follow that frame's own setting.
- The inside stroke counts toward the padding floor (§3.7).
- **Fill siblings divide space by content area.** A Fill sibling with thicker included strokes or larger padding ends up larger on the outside, so that the content areas are equal.

**Legacy version** [KNOW → V-26]:
- When the parent's `strokesIncludedInLayout` is true, the layout boxes of children include their center/outside stroke extents, so outside strokes push siblings.
- The frame's own strokes are treated per its alignment.
- Padding is compressible (§3.7).
- Fill children share space equally by **outer** size.
- The exact rules must be measured before implementing them (P2, needed for importing .fig files).

**Layout version toggle** [OBS: "Layout = Updated"][SRC:forum-56357][SRC:blog-2026-07]:
- Every auto layout frame and main component has a **Layout: Updated / Legacy** setting in its layout settings.
- New frames are Updated. Existing frames stay Legacy until someone updates them.
- **Instances cannot toggle it.** They follow their main component.
- An Actions-menu command, "Update layout version for selection/page", updates in bulk.
- Per [SRC:blog-2026-07], the toggle remains available until **2027-01-24**, after which legacy frames show an **Update** button instead of a switch.
- Switching the version is one undo step. It may resize frames, for example when the padding floor applies.

### 3.15 Canvas stacking and clip content

- **Canvas stacking.** `itemReverseZIndex = false` is **Last on top** (the default; observed as "Last on top" [OBS]). Later children (right-most or bottom-most) paint over earlier ones. `true` is **First on top** [API][DOC:360040451373 excerpt].
  - It matters mainly with negative gaps.
  - It changes **only paint order**. The layers panel and the `children` order are unchanged [DOC:360040451373 excerpt].
  - Whether hit-testing (click-to-select on overlapping children) follows the paint order is → V-20.
  - A 2026-03 forum report says the option is missing for Grid frames [SRC:forum-grid-stacking] → V-20.
- **Clip content.** `clipsContent` clips all descendants to the frame bounds: overflowing flow children, negative-gap overflow, absolute children and Hug-with-max overflow [API][OBS "Clip content"].
  - The default for wrappers created by Shift+A is → V-27.
  - Clipping does not affect layout math.

### 3.16 Reordering and insertion

**Canvas drag inside the same auto layout parent** [KNOW → V-22]:
- Dragging a flow child **reorders** it. It does not set x/y, because x/y of flow children are computed [API].
- During the drag, the siblings reflow live around a placeholder at the prospective index, and the dragged layer follows the pointer.
- On drop, the child is moved to that index in `children`.
- **Insertion index:**
  - Stack without wrap: the index whose sibling midpoint along the main axis is the first one greater than the pointer coordinate.
  - Wrap: first choose the line under the pointer (cross axis), then use the main-axis midpoint rule within that line.
  - Grid (manual placement): the cell under the pointer. Grid (auto flow): the flow index of the cell under the pointer.

**Dragging into an auto layout frame from outside:**
- An insertion indicator (a line at the prospective index) is shown. On drop the layer is inserted at that index and Hug ancestors grow [KNOW → V-22].
- **⌃/Ctrl held:** the layer is inserted as Ignore auto layout at the drop point [DOC:360040451373 excerpt].
- **Large-object safeguard:** dropping an object larger than the auto layout frame does not insert it. Holding ⌘ (Ctrl on Windows) overrides this [DOC:5731482952599 excerpt].
- **⌘/Ctrl held while dragging** keeps the object in its current frame, so it does not nest into the frame under the pointer [DOC:5731482952599 excerpt].

**Other operations:**
- **Dragging out:** moving a flow child outside the parent's bounds reparents it to the container under the pointer (page, section or frame) at the drop position. Its Fill sizing becomes Fixed [KNOW → V-22].
- **Multi-selection drag:** the selected children move as one contiguous block at the drop index, keeping their relative order [KNOW → V-22].
- **Alt/Option-drag duplicate:** the copy is inserted at the drop index, and the original stays in place [KNOW → V-22].
- **Duplicate (⌘D / Ctrl+D):** the copy is inserted **immediately after** the original in flow order [KNOW → V-23].
- **Paste:**
  - Paste with an auto layout flow child selected: inserted after that child (→ V-23).
  - Paste with the auto layout frame selected: appended as the last flow child [KNOW → V-23].
- **Grouping (⌘G) or framing (⌘⌥G) selected flow children:** the new container takes the flow slot of the first selected child [KNOW → V-23].
- **Layers panel:** dragging a row within an auto layout parent reorders the flow. Dragging it to another parent reparents it [KNOW].
  - **Display order:** the panel presents children in reverse `children` order (topmost z at the top), as for every frame. Whether Figma flips this for auto layout frames to match the visual flow is → V-25.
  - Canvas stacking does not change the panel order [DOC excerpt].
- **Keyboard reorder:** with a flow child selected, the arrow keys move it one position. Use ←/→ in horizontal flows and ↑/↓ in vertical flows [SRC:uxdesign-tips][SRC:forum-23623].
  - A third-party tip also lists the `[` and `]` keys → V-23.
  - In 2025, arrow-key reordering was **not** available in Grid [SRC:forum-41164] → V-36.
  - Moving past either end is a no-op [KNOW].
- **Instances:** children of instances cannot be reordered. Reordering must be done in the main component, or after detaching [DOC:31441443713047 excerpt].

### 3.17 On-canvas spacing and padding handles

- **When a selected auto layout frame is hovered**, Figma shows pink overlays and handles for each **gap** (between adjacent flow children) and each **padding** side [DOC:360040451373|31289464393751 excerpt].
- **Dragging a handle** changes the value live. The whole drag is one undo step [DOC excerpt][KNOW].
- **Clicking a handle** shows a numeric field on canvas for typing a value [DOC excerpt].
- **Modifiers while dragging** [SRC:kinney][SRC:uxdesign-tricks][SRC:pixso]:
  - **Shift** snaps to big-nudge increments (default 10).
  - **⌥/Alt** on a padding handle mirrors the change to the opposite side.
  - **⌥/Alt + Shift** changes all four paddings equally.
  - ⌥-click or ⇧⌥-click on the padding area selects the pair or all sides for typing.
  - One older article describes Alt as "same padding for the horizontal or vertical pair", which is the same thing as the opposite side. The current behavior is → V-28.
- **Wrap:** a separate handle for the counter-axis gap between lines [KNOW → V-28].
- **Grid:** handles for row gap and column gap [KNOW → V-28].
- **Auto gap:** dragging a gap handle while the gap is Auto either converts it to a fixed value or is unavailable → V-28.
- **Negative values:** whether dragging can take the gap below 0 → V-28.
- Handles are suppressed when they would be too small at the current zoom [KNOW].

### 3.18 Nested auto layout and resizing propagation

- Every nested auto layout frame has both **parent properties** (its own padding, gap and flow) and **child properties** (its sizing in its parent) [DOC:31441443713047 excerpt].
  - Flows can be mixed freely (vertical in horizontal, grid in vertical, grid in grid) [DOC:31441443713047 excerpt].
  - Deep selection uses ⌘/Ctrl-click [DOC:31441443713047 excerpt].
- **Propagation contract:** any change that can affect a size triggers layout of the affected subtree **in the same transaction**. Such changes include text edits, child add/remove/hide, sizing changes, property changes, variable mode changes, instance swaps and font loads.
  - **Upward (measure):** content-dependent sizes are recomputed up the ancestor chain while the ancestor's size depends on its content (Hug on that axis, wrap, or baseline).
  - **Downward (arrange):** from the highest affected ancestor, each frame places its children. Fill children receive their sizes, and non-auto-layout frames that were resized apply **constraints** to their own children [API: `resize` applies constraints].
- **Determinism:** one layout pass reaches a fixed point. Repeating it changes nothing (§2.8). There must be no oscillation between Hug and Fill ([SRC:old-notes] calls out convergence as a known risk).
- **Interactive resize:** while a fixed auto layout frame is being resized, its Fill descendants update live, and its Hug ancestors are recomputed live [KNOW].

### 3.19 Grid flow

- **What it does:** arranges children in rows and columns, for example galleries, bento layouts and dashboards. Items do not wrap. Any item can span several rows or columns [DOC:31289469907863 excerpt]. Grid became generally available at Config 2026 [SRC:forum-54244].
- **Creating a grid:**
  - Choose **Grid** in the Layout section.
  - A grid created in the UI starts with the **container and all tracks set to Hug**. A grid created via the API starts **Fixed** with **Flex** tracks [SRC:plugin-upd-120].
  - The **grid picker** sets the counts, either by typing into the rows/columns fields (arithmetic accepted) or with an interactive cell selector [DOC:31289469907863 excerpt].
- **Track sizing** [API]:
  - **FIXED** = px.
  - **HUG** = fits content (≈ `fit-content(100%)`).
  - **FLEX** = fraction of the remaining space (≈ `fr`, `value` = factor).
  - FLEX is **not valid** on an axis where the container Hugs. What the UI does to FLEX tracks when the container is switched to Hug is → V-34.
  - Before Nov 2025 only Fixed and "Auto" (≈ 1fr) existed. Hug and fr values other than 1 arrived in Nov 2025 [SRC:plugin-upd-120][SRC:forum-40313].
- **Gaps:**
  - `gridRowGap` and `gridColumnGap` are ≥ 0 and independent of each other [API].
  - They are bindable to variables [API][SRC:forum-grid-gap-vars].
  - Gaps are placed between tracks only.
- **Placement** [API]:
  - Every child has an anchor `(row, column)` and spans `(rowSpan, colSpan) ≥ 1`. Its area must stay in bounds and **must not overlap** another child. There is exactly one child per cell, and overlap is not allowed (unlike CSS) [SRC:nearform].
  - **Manual** (`MANUAL`): children stay in the cell where they were placed. `appendChild` without coordinates puts the child in the **first available cell** in row-major order [API].
  - **Automatic placement** (`ROW_AUTO_FLOW`): children are placed by layer order into the next available cell, row-major, like CSS `grid-auto-flow: row`. Deleting an item makes later items shift to fill the gap [API][SRC:forum-54244]. Explicit positioning is not allowed; reordering is done by changing `children` order.
  - **Automatic rows** (`ROWS`): rows are added as children are appended and removed when a row becomes empty. The row count cannot be set directly [API][SRC:forum-54244].
  - With `NONE`, the row count "will never go below the number of rows necessary to hold all children" [API].
- **Changing track counts:**
  - Lowering the count in the grid picker **keeps** the objects of removed tracks and moves them into the nearest cells. Multi-track objects are trimmed [DOC:31289469907863 excerpt][SRC:forum-update].
  - The API throws instead when the tracks are occupied [API].
  - Raising the count adds FLEX tracks (API). The UI-added track type is → V-34.
- **Deleting a track** (track context or Delete): its contents are removed. Objects spanning it are resized and moved to the closest available track [DOC:31289469907863 excerpt].
- **Track pills** along the top and left edges of a selected grid frame [DOC:31289469907863 excerpt]:
  - Hovering shows a label.
  - A grabber drags the track to a new position, with a blue line as preview. Tracks that items span into move with it (spanned tracks are included automatically) [API: `reorderRows`/`reorderColumns`].
  - With a track selected, **Enter** gives access to its size [SRC:forum-40316]. Exact behavior → V-36.
- **Sizing of children in a cell area:**
  - **Fill** on an axis = the area size on that axis. The area is the spanned tracks plus the inner gaps.
  - **Fixed/Hug** children keep their own size and are aligned in the area by `gridChildHorizontalAlign` / `gridChildVerticalAlign` (MIN, CENTER, MAX or AUTO) [API].
  - Children "that should react to grid resizing need Fill on the relevant axis" [DOC:31289469907863 excerpt, paraphrased by the search tool].
  - The meaning of AUTO (MIN, or a container-level default) is → V-35.
- **Not available in grid:** baseline alignment, wrap, Auto gap, padding (?) and canvas stacking (?) → V-34 and V-20.
- **Nested grids:** grids can be nested inside grids [DOC:31441443713047 excerpt].
- **Slots** cannot be GRID [API].
- **Algorithm:** see §3.22.4.

### 3.20 Components, instances, slots, variables

- **Instances** inherit every auto layout property from their main component. On an instance, the user can override padding, gap, alignment, the instance's own sizing (Fixed/Hug/Fill in its parent) and min/max [KNOW → V-38].
  - Overrides survive edits of other properties on the main component. Non-overridden properties follow the main component [KNOW → V-38].
  - On an instance the user **cannot**: reorder children [DOC:31441443713047 excerpt], toggle the layout version [SRC:blog-2026-07], remove auto layout, or change the flow [KNOW → V-38].
- **Boolean properties, instance swap and variant switch** change visible content and sizes. They re-run layout of the instance and its ancestors (hidden children collapse, §3.13) [KNOW].
- **Detaching** an instance keeps all of its resolved auto layout settings on the resulting frame [KNOW].
- **Slots** (`SLOT` nodes) are frame-like and support stack auto layout. GRID throws `cannotApplyGridToSlot` [API]. Slot limits (`limitViolations`) belong to the components spec.
- **Component sets** can use auto layout to arrange their variants [API: `ComponentSetNode extends BaseFrameMixin`].
- **Variables:** padding, gap, counter-axis gap, grid gaps, min/max, width, height and visible can all be bound [API].
  - Switching the variable mode or editing the variable value re-runs layout.
  - Binding a variable to width or height implies Fixed on that axis [KNOW → V-40].

### 3.21 Undo/redo, clipboard, export

- **One undo step per user action.** A property change, a drag-handle gesture, a reorder, adding or removing auto layout, a flow change or a version update is one step, **including** every child and ancestor geometry change it causes. Redo re-applies the exact same geometry [KNOW → V-39].
- **Copy/paste** of an auto layout frame keeps all container fields, child fields, min/max and variable bindings [KNOW].
  - **Pasting a former auto layout child into a non-auto-layout parent:** `layoutGrow`, `layoutAlign` and `layoutPositioning` stay stored but have no effect. The UI shows Fixed sizing [KNOW → V-23].
  - **Copy/paste properties** (⌘⌥C / ⌘⌥V) may transfer auto layout properties → V-39.
- **Export** (PNG/JPG/SVG/PDF) renders the **resolved** geometry, including negative-gap overlaps in canvas-stacking paint order and clipping [KNOW]. Auto layout itself is not represented in SVG/PDF.
- **Import:**
  - Map deprecated `layoutAlign` MIN/CENTER/MAX to INHERIT.
  - Map deprecated paddings.
  - Unknown enum values (for example newer `SPACE_*`) must be preserved, not dropped [API].
  - Legacy-version frames must keep the LEGACY version (`11-file-format-interop.md`).

### 3.22 Layout algorithm (normative pseudo-algorithm)

This is the contract that Illigma implements and tests numerically. Where Figma's internals are unknown, the rule follows CSS Flexbox / Grid semantics, which Figma documents as the target of the Updated version [DOC:42031586813719 excerpt][SRC:forum-56357][SRC:forum-58389]. Each such rule carries a `V-nn` reference. All arithmetic is in IEEE-754 float64. Rounding is described in §3.23.

#### 3.22.1 Common definitions

```ts
type Axis = 'x' | 'y'
const other = (a: Axis): Axis => (a === 'x' ? 'y' : 'x')

mainAxis(F)  = F.layoutMode === 'HORIZONTAL' ? 'x' : 'y'
crossAxis(F) = other(mainAxis(F))

flowChildren(F) = F.children.filter(c => c.visible && c.layoutPositioning === 'AUTO')   // V-21

// Layout box of a child = unrotated width/height if rotation == 0,
// otherwise the axis-aligned bounding box of the rotated rect (V-09).
// UPDATED: the child's own strokes never enlarge its layout box.
// LEGACY with parent.strokesIncludedInLayout: box grows by outside/center stroke outsets (V-26).

strokeInset(F, side) =
  F.layoutVersion === 'UPDATED'
    ? (F.strokesIncludedInLayout && hasVisibleStroke(F) && F.strokeAlign === 'INSIDE'
         ? weightOf(F, side) : 0)          // individual side weights if set
    : legacyStrokeInset(F, side)           // V-26

inset(F, side)    = padding(F, side) + strokeInset(F, side)
insetSum(F, axis) = axis === 'x' ? inset(F,'left') + inset(F,'right')
                                 : inset(F,'top')  + inset(F,'bottom')

sizing(N, axis): 'FIXED' | 'HUG' | 'FILL'   // = layoutSizingHorizontal / layoutSizingVertical

clampMinMax(v, mn, mx) = Math.max(mn ?? -Infinity, Math.min(v, mx ?? Infinity))  // min beats max (V-16)

// The UPDATED padding floor beats max and every other rule [DOC:42031586813719 excerpt]
finalize(N, axis, v) =
  isAutoLayout(N) && N.layoutVersion === 'UPDATED'
    ? Math.max(insetSum(N, axis), clampMinMax(v, N.min[axis], N.max[axis]))
    : clampMinMax(v, N.min[axis], N.max[axis])

floorOf(N, axis) = isAutoLayout(N) && N.layoutVersion === 'UPDATED' ? insetSum(N, axis) : 0

isAutoGap(F) = F.primaryAxisAlignItems.startsWith('SPACE_')
packedGap(F) = isAutoGap(F) ? 0 : F.itemSpacing       // gap used for measuring and line breaking (V-13)
```

#### 3.22.2 Intrinsic (Hug) measurement: bottom-up

`measure(N, axis, definiteOther?)` returns N's outer size on `axis` when N decides its own size. Width is always resolved before height (width-first), because text height depends on width.

```ts
measure(N, axis, otherSize?) {
  switch (sizing(N, axis)) {
    case 'FIXED': return finalize(N, axis, N.storedSize[axis])
    case 'FILL':  return finalize(N, axis, floorOf(N, axis))   // when a hugging parent measures it (V-06)
    case 'HUG':
      if (isText(N)) return finalize(N, axis, axis === 'x'
           ? textNaturalWidth(N, /*wrapAt*/ N.maxWidth ?? Infinity)          // V-17
           : textHeightForWidth(N, otherSize ?? N.width))                    // respects maxLines/truncation
      if (isStack(N)) return finalize(N, axis, hugStack(N, axis, otherSize))
      if (isGrid(N))  return finalize(N, axis, hugGrid(N, axis))
  }
}

hugStack(F, axis, otherSize?) {
  const items = flowChildren(F), n = items.length
  if (n === 0) return insetSum(F, axis)                                       // V-29
  if (axis === mainAxis(F)) {
    if (F.layoutWrap === 'WRAP' && wrapLimit(F) < Infinity)
      return insetSum(F, axis) + Math.max(...breakLines(F).map(l => lineMainExtent(l)))   // V-17
    return insetSum(F, axis) + Σ items.map(c => measure(c, axis)) + packedGap(F) * (n - 1) // V-11
  }
  // cross axis
  if (F.layoutWrap === 'WRAP') {
    const L = breakLines(F)
    return insetSum(F, axis) + Σ L.map(lineCrossSize) + rowGap(F) * (L.length - 1)
  }
  // lineMainExtent(l) = Σ item main sizes + packedGap·(|l|−1); lineCrossSize(l) = max hypothetical
  // cross size of the items in l (Fill-cross items count as max(min, floor)), see §3.22.4
  if (F.counterAxisAlignItems === 'BASELINE')                                  // horizontal only
    return insetSum(F, 'y') + max(ascentOf(c)) + max(c.height - ascentOf(c)) // V-15
  const defining = items.filter(c => sizing(c, axis) !== 'FILL')
  return insetSum(F, axis) + (defining.length ? Math.max(...defining.map(c => measure(c, axis))) : 0) // V-06
}
```

#### 3.22.3 Arrange a stack (no wrap): top-down

```ts
arrangeStack(F) {                          // F.width/F.height are already final
  const m = mainAxis(F), c = crossAxis(F)
  const items = flowChildren(F), n = items.length
  const innerMain  = F.size[m] - insetSum(F, m)
  const innerCross = F.size[c] - insetSum(F, c)
  const g = packedGap(F)

  // (1) Main sizes. If m === 'y' (vertical), resolve the cross widths first (step 2a),
  //     so that text heights are known before main sizing.
  if (m === 'y') resolveCross(items, innerCross, F)                 // 2a
  const flex = [], fixedSum = { v: 0 }
  for (const ch of items) {
    if (sizing(ch, m) === 'FILL') {
      flex.push({ ch,
        base: F.layoutVersion === 'UPDATED' ? floorOf(ch, m) : 0,   // UPDATED: equal *content* shares
        min: ch.min[m], max: ch.max[m] })
    } else {
      ch.size[m] = measure(ch, m, ch.size[c])
      fixedSum.v += ch.size[m]
    }
  }
  const free = innerMain - fixedSum.v - Σ flex.map(f => f.base) - g * (n - 1)
  resolveFlexible(flex, free, m)           // §3.22.6. Sets ch.size[m] for Fill children.
  if (m === 'x') resolveCross(items, innerCross, F)                 // 2b: heights after widths

  // (3) Main positions
  const sum = Σ items.map(ch => ch.size[m])
  const [start, gap] = distribute(F.primaryAxisAlignItems, innerMain, sum, n, g)
  let p = inset(F, startSide(m)) + start
  for (const ch of items) { ch.pos[m] = p; p += ch.size[m] + gap }

  // (4) Cross positions
  const cs = inset(F, startSide(c))
  for (const ch of items) ch.pos[c] = cs + crossOffset(F.counterAxisAlignItems, innerCross, ch, items, c)

  // (5) Absolute children: constraints relative to F's previous → new size (constraints spec)
  // (6) Recurse: arrange(ch) for every child whose size changed or that is dirty
}

resolveCross(items, innerCross, F) {
  for (const ch of items) {
    const c = crossAxis(F)
    ch.size[c] = sizing(ch, c) === 'FILL'
      ? finalize(ch, c, innerCross)                // stretch, clamped by min/max (V-14)
      : measure(ch, c, ch.size[mainAxis(F)])
  }
}

distribute(mode, innerMain, sum, n, g): [start, gap] {
  const rem = innerMain - sum - g * (n - 1)        // packed remainder
  const free = innerMain - sum                     // used by the auto modes
  switch (mode) {
    case 'MIN':    return [0, g]
    case 'CENTER': return [rem / 2, g]             // can be negative: overflows both sides (V-14)
    case 'MAX':    return [rem, g]
    case 'SPACE_BETWEEN': return (n <= 1 || free <= 0) ? [0, 0] : [0, free / (n - 1)]
    case 'SPACE_AROUND':  return free <= 0 ? [0, 0] : [free / n / 2, free / n]          // n=1 → centered
    case 'SPACE_EVENLY':  return free <= 0 ? [0, 0] : [free / (n + 1), free / (n + 1)]  // n=1 → centered
  }                                                // overflow fallback for AROUND/EVENLY: V-13
}

crossOffset(align, innerCross, ch, items, c /* cross axis */) {
  const s = ch.size[c]
  switch (align) {
    case 'MIN':    return 0
    case 'CENTER': return (innerCross - s) / 2
    case 'MAX':    return innerCross - s
    case 'BASELINE': return max(items.map(ascentOf)) - ascentOf(ch)     // V-15
  }
}
// ascentOf(text) = distance from the box top to the first-line baseline (06-text-typography.md)
// ascentOf(auto layout frame) = its offset to the first descendant text baseline. Otherwise = box height (V-15).
```

#### 3.22.4 Arrange a wrapped stack

```ts
wrapLimit(F) = sizing(F, mainAxis(F)) === 'FIXED' || sizing(F, mainAxis(F)) === 'FILL'
  ? F.size[mainAxis(F)] - insetSum(F, mainAxis(F))
  : (F.max[mainAxis(F)] != null ? F.max[mainAxis(F)] - insetSum(F, mainAxis(F)) : Infinity)  // V-17

hypotheticalMain(ch, m) = sizing(ch, m) === 'FILL'
  ? Math.max(ch.min[m] ?? 0, floorOf(ch, m))        // V-17
  : measure(ch, m)

breakLines(F) {
  const m = mainAxis(F), lim = wrapLimit(F), g = packedGap(F), EPS = 1e-6   // V-17 (tolerance)
  const lines = []; let cur = [], used = 0
  for (const ch of flowChildren(F)) {
    const h = hypotheticalMain(ch, m)
    if (cur.length && used + g + h > lim + EPS) { lines.push(cur); cur = []; used = 0 }
    used = cur.length ? used + g + h : h
    cur.push(ch)
  }
  if (cur.length) lines.push(cur)
  return lines
}

arrangeWrap(F) {
  const m = mainAxis(F), c = crossAxis(F), L = breakLines(F)
  const innerMain = F.size[m] - insetSum(F, m), innerCross = F.size[c] - insetSum(F, c)
  // For each line: run steps (1)–(3) of arrangeStack, treating the line as the item list
  // and innerMain as the line's available size. Fill shares are computed per line.
  const lineCross = L.map(line => Math.max(...line.map(ch =>
      sizing(ch, c) === 'FILL' ? Math.max(ch.min[c] ?? 0, floorOf(ch, c))   // V-17
                               : measure(ch, c, ch.size[m]))))
  const rg = rowGap(F)                       // counterAxisSpacing ?? itemSpacing
  let start = 0, between = rg
  const block = Σ lineCross + rg * (L.length - 1)
  if (F.counterAxisAlignContent === 'SPACE_BETWEEN') {
    between = L.length > 1 ? Math.max(0, (innerCross - Σ lineCross) / (L.length - 1)) : 0
    start = 0                                // single line: start (V-17)
  } else if (flowChildren(F).every(ch => sizing(ch, c) === 'FILL')) {
    const extra = innerCross - block
    if (extra > 0) lineCross.forEach((v, i) => lineCross[i] = v + extra / L.length)
  } else {
    start = { MIN: 0, CENTER: (innerCross - block) / 2, MAX: innerCross - block,
              BASELINE: 0 }[F.counterAxisAlignItems]
  }
  let q = inset(F, startSide(c)) + start
  L.forEach((line, i) => {
    for (const ch of line) {
      if (sizing(ch, c) === 'FILL') ch.size[c] = finalize(ch, c, lineCross[i])
      ch.pos[c] = q + crossOffset(F.counterAxisAlignItems, lineCross[i], ch, line, c)   // per-line baseline
    }
    q += lineCross[i] + between
  })
}
```

#### 3.22.5 Grid: track sizing and placement

```ts
arrangeGrid(G) {
  place(G)            // occupancy: MANUAL = stored anchors; ROW_AUTO_FLOW = first fit in children order;
                      // ROWS auto tracks: append/remove rows as needed (§3.19)
  for (const axis of ['x', 'y'] as Axis[]) {   // columns first, so row sizing can use text heights
    const T = axis === 'x' ? G.gridColumnSizes : G.gridRowSizes
    const gap = axis === 'x' ? G.gridColumnGap : G.gridRowGap
    const ins = insetSum(G, axis)              // V-34: is padding applicable to GRID?
    const size = T.map(t => t.type === 'FIXED' ? t.value : 0)

    // HUG tracks: single-span items first
    for (const ch of itemsSpanning(G, axis, 1)) {
      const k = startIndex(ch, axis)
      if (T[k].type === 'HUG') size[k] = Math.max(size[k], contribution(ch, axis))
    }
    // Multi-span items (sorted by span ascending): spread any shortfall equally over the spanned HUG tracks
    for (const ch of itemsSortedBySpan(G, axis).filter(s => span(s, axis) > 1)) {
      const ks = spannedIndices(ch, axis), hugKs = ks.filter(k => T[k].type === 'HUG')
      const need = contribution(ch, axis) - (Σ ks.map(k => size[k]) + gap * (ks.length - 1))
      if (need > 0 && hugKs.length) hugKs.forEach(k => size[k] += need / hugKs.length)   // V-35
    }
    if (sizing(G, axis) === 'HUG') {
      // FLEX is invalid here [API]. If present on import, treat it as HUG (V-34).
      G.size[axis] = finalize(G, axis, ins + Σ size + gap * (T.length - 1))
    } else {
      const flexK = T.flatMap((t, k) => t.type === 'FLEX' ? [k] : [])
      const fr = Σ flexK.map(k => T[k].value ?? 1)
      const free = G.size[axis] - ins - Σ size - gap * (T.length - 1)
      flexK.forEach(k => size[k] = fr > 0 ? Math.max(0, free) * (T[k].value ?? 1) / fr : 0)
      // V-35: does a FLEX track keep a content minimum (CSS 1fr = minmax(auto, 1fr))?
    }
    // Track offsets
    const off = [inset(G, startSide(axis))]
    for (let k = 1; k < T.length; k++) off[k] = off[k - 1] + size[k - 1] + gap
    for (const ch of flowChildren(G)) {
      const k0 = startIndex(ch, axis), k1 = k0 + span(ch, axis) - 1
      const areaStart = off[k0], areaSize = off[k1] + size[k1] - off[k0]
      ch.size[axis] = sizing(ch, axis) === 'FILL'
        ? finalize(ch, axis, areaSize)
        : measure(ch, axis, ch.size[other(axis)])
      const al = axis === 'x' ? ch.gridChildHorizontalAlign : ch.gridChildVerticalAlign
      ch.pos[axis] = areaStart + ({ MIN: 0, AUTO: 0 /* V-35 */,
          CENTER: (areaSize - ch.size[axis]) / 2, MAX: areaSize - ch.size[axis] })[al]
    }
  }
}
contribution(ch, axis) = sizing(ch, axis) === 'FILL'
  ? (isAutoLayout(ch) || isText(ch) ? hugSizeIgnoringFill(ch, axis) : (ch.min[axis] ?? 0))  // V-35
  : measure(ch, axis)
```

#### 3.22.6 Flexible lengths (Fill distribution with min/max)

This follows CSS Flexbox §9.7 with every flex-grow factor = 1 and no flex-shrink. It applies to UPDATED. For LEGACY see V-16.

```ts
resolveFlexible(items, free, m) {        // items: { ch, base, min, max }; m = main axis
  if (!items.length) return
  let frozen = new Set(), remaining = free
  // Shrinking is not allowed: if free <= 0, each Fill child = finalize(base) (V-10)
  if (free <= 0) { items.forEach(f => f.ch.size[m] = finalize(f.ch, m, f.base)); return }
  while (true) {
    const open = items.filter(f => !frozen.has(f))
    const share = remaining / open.length
    let totalViolation = 0
    for (const f of open) {
      const target = f.base + share
      const clamped = clampMinMax(target, f.min, f.max)
      f.tmp = clamped; f.viol = clamped - target; totalViolation += f.viol
    }
    if (totalViolation === 0) { open.forEach(f => f.ch.size[m] = finalize(f.ch, m, f.tmp)); break }
    const freezeSet = totalViolation > 0 ? open.filter(f => f.viol > 0)   // min violations
                                         : open.filter(f => f.viol < 0)   // max violations
    for (const f of freezeSet) {
      frozen.add(f); f.ch.size[m] = finalize(f.ch, m, f.tmp); remaining -= (f.tmp - f.base)
    }
    if (frozen.size === items.length) break
  }
}
```

#### 3.22.7 Scheduling and propagation

```ts
onDocumentChange(nodes) {
  for (const n of nodes) markDirty(n)
  // climb: a parent must re-arrange if it is an auto layout frame (its children's positions may change).
  // Keep climbing while that parent's own size depends on its content (HUG on any axis, WRAP, BASELINE).
  roots = topmost dirty nodes whose parent is not auto layout, or whose size is content-independent
  for (const r of roots) { measureBottomUp(r); arrangeTopDown(r) }   // single pass, deterministic
  // All geometry writes join the current undo transaction (V-39). Painting never triggers layout.
}
```

#### 3.22.8 Reference numeric fixtures

These are normative for Illigma (UPDATED version). Each fixture becomes a test in the checklist (§6.21) and must be re-measured in Figma (V-41). Coordinates are relative to the frame. "Rect" means a plain rectangle child.

| # | Setup | Expected (Illigma contract) |
| --- | --- | --- |
| F1 | H, Fixed 300×100, padding 10 all, gap 10, cross CENTER. A rect 50×20 Fixed, B rect Fill-W × 30, C rect 80×40 | B.w = 300−20−50−80−20 = **130**. x: A=10, B=70, C=210. y: A=40, B=35, C=30 |
| F2 | H, Fixed W=300, pad 0, 3 rects 50 wide, Auto **Between** | x = 0, 125, 250 |
| F3 | Same as F2 with **Around** | x = 25, 125, 225 |
| F4 | Same as F2 with **Evenly** | x = 37.5, 125, 212.5 |
| F5 | Single rect 50, W=300: Between / Around / Evenly | x = 0 / 125 / 125 |
| F6 | Between, W=100, 3 rects 50 (overflow) | gap 0. x = 0, 50, 100 |
| F7 | H Hug×Hug, padding L/R 16, T/B 12, gap 8, rects 40×40 and 60×20, cross MIN | frame 140×64. x = 16, 64. y = 12, 12 |
| F8 | H Hug, gap −10, 3 rects 50×50 | W = 130. x = 0, 40, 80. Last on top: C paints over B |
| F9 | Padding floor: H Fixed W=50, padL=padR=30, no children | W = **60** |
| F10 | F9 + inside stroke 10 Included | W = **80** |
| F11 | F9 + maxWidth 40 | W = 60 (the floor beats max) |
| F12 | H Fixed W=300, gap 0, two Fill rects, A.minW=200 | A=200, B=100 |
| F13 | H Fixed W=300, two Fill rects, A.maxW=50 | A=50, B=250 |
| F14 | H Fixed W=300, gap 0, A = Fill auto layout frame with padL=padR=20 and no content, B = Fill rect | A=170, B=130 (equal content shares of 130) |
| F15 | H Wrap, Fixed W=200, gap 10, rowGap 20, 5 rects 60×30, Hug H | lines [3,2]. H = 80. Row 2 y = 50. x row 2 = 0, 70 |
| F16 | F15 with Fixed H=200 and align-content SPACE_BETWEEN | row 2 y = 170 |
| F17 | F15 with Fixed H=200, all children Fill-H (stretch), align-content AUTO | each line 90 tall. Children h = 90. Row 2 y = 110 |
| F18 | V Hug-W, children: A rect Fixed 120 wide, B rect Fill-W | frame W = 120 (+pad). B.w = 120 (V-06 contract) |
| F19 | H Hug: A 50, B 50 (hidden), C 50, gap 10 | W = 110. x A=0, C=60 |
| F20 | H Hug: A 50 flow, B absolute at x=200 | W = 50 (+pad). B stays at x=200 |
| F21 | Grid Fixed 300×200, 3 FLEX cols, 2 FLEX rows, gaps 10, pad 0 | col w = 93.3333…, row h = 95. Cell (0,1) x = 103.3333… |
| F22 | Grid Fixed W=400, cols FLEX(1), FLEX(2), FIXED(100), gap 0 | 100, 200, 100 |
| F23 | Grid Hug W, cols FIXED 100, HUG (span-1 children 40 and 70), gap 10, pad 20 | HUG col = 70. W = 220 |
| F24 | F23 + child spanning both cols, Fill-W | child w = 180 |
| F25 | H Fixed W=100, 3 Fill rects, gap 0 | each 33.333… (no rounding: V-30) |

### 3.23 Numeric precision and rounding

- Illigma computes in float64 and stores results **unrounded** [KNOW → V-30]. Figma's file values are floats, and the inspector displays at most 2 decimals [KNOW].
- If Figma turns out to round computed child sizes or positions (to whole pixels or to 1/100), the contract changes to match.
- Auto layout output is not snapped to the pixel grid. "Snap to pixel grid" only affects user transforms [KNOW → V-30].
- The tolerance for wrap line breaking is 1e-6 px (Illigma choice), to avoid float noise sending an exactly-fitting item to the next line.

---

## 4. Inspector & on-canvas controls (Figma UI3, functional only)

### 4.1 Right sidebar: Design tab, frame-like node selected

The [OBS] recorded these Layout-section controls on a Figma UI3 frame and on an auto layout container: flow choice with **Freeform**, Vertical and a **Wrap** control; width/height controls; nine-position alignment; gap; padding; **Clip content**; and a layout settings popover.

| Control | Function | Data | Evidence |
| --- | --- | --- | --- |
| Flow selector: Freeform / Vertical / Horizontal / Grid | Freeform removes auto layout. Choosing a flow on a Freeform frame applies auto layout with that flow | `layoutMode` | [OBS][KNOW → V-03] |
| Wrap control (stack flows only) | Toggles wrap for the current flow | `layoutWrap` | [OBS][SRC:forum-58389] |
| W / H fields + sizing dropdown | Type a value (→ Fixed). Dropdown: Fixed width/height, Hug contents, Fill container (unavailable options are disabled), Add min…, Add max…, Remove min and max, apply variable | `layoutSizing*`, `min*/max*`, `width/height` | [DOC:360040451373 excerpt][OBS] |
| Alignment box (9 positions) | Sets primary × counter alignment. Shows only counter options when gap = Auto. Focusable for keyboard (§5) | `primaryAxisAlignItems`, `counterAxisAlignItems` | [OBS][DOC excerpt] |
| Gap field (`↔` or `↕` gap), with an **Auto** option | Fixed numeric gap (may be negative) or Auto | `itemSpacing`, `primaryAxisAlignItems=SPACE_*` | [OBS][DOC excerpt] |
| Counter-axis gap field (wrap only) | Gap between lines. Supports Auto (→ `counterAxisAlignContent=SPACE_BETWEEN`) | `counterAxisSpacing`, `counterAxisAlignContent` | [API][KNOW → V-17] |
| Padding: horizontal + vertical fields; **individual padding** toggle → 4 fields | Sets the paddings. Fields accept variables | `padding*` | [OBS][KNOW] |
| Clip content checkbox | Clip descendants | `clipsContent` | [OBS] |
| **Layout settings popover**: Inside stroke (Included/Excluded) · Canvas stacking (First on top/Last on top) · Layout (Updated/Legacy) · Text baseline alignment (enabled only for horizontal + text) · Auto spacing type (Between/Around/Evenly) | Advanced settings | `strokesIncludedInLayout`, `itemReverseZIndex`, `layoutVersion`, `counterAxisAlignItems=BASELINE`, `SPACE_*` | [OBS] (all five observed; baseline and auto spacing were disabled in that context) |
| Grid: rows × columns fields + interactive grid picker | Set counts (arithmetic allowed) | `gridRowCount`, `gridColumnCount` | [DOC:31289469907863 excerpt] |
| Grid: row gap, column gap | Track gaps | `gridRowGap`, `gridColumnGap` | [API] |
| Grid: auto rows / automatic placement toggles (UI form unknown) | `gridAutoTracks`, `gridItemsPositioning` | | [API][SRC:forum-54244] → V-33 |
| Selected grid track: size type (Fixed / Hug / Flex·fr) + value | Track sizing | `GridTrackSize` | [API][SRC:forum-40316] → V-36 |

### 4.2 Child of an auto layout frame selected

| Control | Function | Evidence |
| --- | --- | --- |
| W/H sizing dropdown incl. **Fill container** | Per-axis sizing in the parent | [DOC:360040451373 excerpt] |
| **Ignore auto layout** toggle (Position section) | `layoutPositioning` | [DOC:360040451373 excerpt] |
| X/Y fields | For flow children: read-only or disabled (writes are no-ops). For absolute children: editable | [API][KNOW → V-19] |
| Constraints | Only shown for absolute children | [DOC:31441443713047 excerpt][KNOW] |
| Grid child: row/column span + position, alignment in cell (UI form unknown) | `gridRowSpan`, `gridColumnSpan`, anchors, `gridChild*Align` | [API][DOC:31289469907863 excerpt] → V-35 |

### 4.3 On-canvas affordances

1. **Gap handles** between adjacent flow children, and **padding handles** along the inner edges. They appear on hover of a selected auto layout frame (pink overlays). Drag to change the value; click to type [DOC excerpt].
2. **Insertion indicator** while dragging layers into or within an auto layout frame. Siblings reflow live around the placeholder [KNOW → V-22].
3. **Resize handles.** Dragging switches the axis to Fixed. Double-clicking an edge may set Hug [KNOW → V-08].
4. **Min/max preview** on hover of the W/H icon [DOC:360040451373 excerpt].
5. **Grid track pills** on the top and left edges: hover label, grabber to drag-reorder (blue line preview), selection for sizing and deletion. Cell highlighting while dropping into a grid [DOC:31289469907863 excerpt][KNOW → V-36].
6. **Grid span handles / edge dragging** to change a child's span [DOC:31289469907863 excerpt: "controls … for setting spans"] → V-35.

### 4.4 Menus

- Context menu / Object menu: Add auto layout, Remove auto layout, **More layout options → Suggest auto layout** [DOC:5731482952599 excerpt].
- Actions menu: Suggest auto layout [DOC:5731482952599 excerpt]; **Update layout version for selection/page** [SRC:blog-2026-07].

---

## 5. Keyboard shortcuts (macOS / Windows)

| Action | macOS | Windows | Evidence |
| --- | --- | --- | --- |
| Add auto layout / wrap selection in auto layout | ⇧A | Shift+A | [DOC:5731482952599 excerpt] |
| Remove auto layout | ⌥⇧A | Alt+Shift+A | [SRC:kinney][SRC:shortcut-guides] → V-02 |
| Suggest auto layout | ⌃⇧A (Control, not Command) | Ctrl+Alt+Shift+A | [DOC:5731482952599 excerpt] |
| Alignment box focused: move alignment | ← ↑ → ↓ | same | [DOC:360040451373\|31289464393751 excerpt] |
| Alignment box focused: align to edge | W / A / S / D | same | [DOC excerpt] |
| Alignment box focused: toggle Auto gap ⇄ fixed | X | X | [DOC excerpt] |
| Alignment box focused: toggle text baseline | B | B | [DOC excerpt] |
| Reorder selected flow child | ← → (horizontal) / ↑ ↓ (vertical); possibly `[` `]` | same | [SRC:uxdesign-tips][SRC:forum-23623] → V-23 |
| Drag into auto layout as Ignore auto layout | hold ⌃ while dragging | hold Ctrl | [DOC:360040451373 excerpt] → V-19 |
| Drag without nesting / override large-object safeguard | hold ⌘ while dragging | hold Ctrl | [DOC:5731482952599 excerpt] → V-19 |
| Handle drag: big-nudge steps | ⇧ | Shift | [SRC:kinney] |
| Padding handle drag: opposite side too | ⌥ | Alt | [SRC:kinney][SRC:uxdesign-tricks] |
| Padding handle drag: all four sides | ⌥⇧ | Alt+Shift | [SRC:kinney][SRC:pixso] |
| Edit all padding from an input | ⌘-click input | Ctrl-click input | [SRC:kinney] |
| Select children / parent (general) | ↵ / ⇧↵ | Enter / Shift+Enter | [KNOW] (`10-panels-shortcuts-workflow.md`) |
| Deep select inside nested auto layout | ⌘-click | Ctrl-click | [DOC:31441443713047 excerpt] |
| Align selection to parent (general) | ⌥W/A/S/D/H/V | Alt+W/A/S/D/H/V | [SRC:skillademia] → V-14 |
| Show shortcut list | ⌘⇧? | Ctrl+Shift+? | [SRC:shortcut-guides] |

**Conflict to resolve in V-19:** ⌃ (macOS) is documented for "drag in as Ignore auto layout", and ⌘ for "don't nest / override safeguard". On Windows both are documented as Ctrl. Record the actual Windows behavior.

---

## 6. Parity checklist

Every item is **Not started**. Each _Test_ is run in Figma first, to confirm the expected value, and then in Illigma. Items tagged only [KNOW] or [SRC] must pass the referenced V-experiment (§8) before the expected value is final.

### 6.1 Data model & persistence

- [ ] **AL-001** Container node types — Auto layout can be set on FRAME, COMPONENT, COMPONENT_SET, INSTANCE (inherited) and SLOT. It cannot be set on GROUP, SECTION, TEXT, shapes, VECTOR or BOOLEAN_OPERATION (no Layout flow controls for them). _Data:_ `layoutMode` on `BaseFrameMixin` only _Test:_ select each node type in Figma; record whether the Layout flow controls exist; Illigma must offer exactly the same set. _M4·P0·[API]_
- [ ] **AL-002** layoutMode enum & default — Values NONE/HORIZONTAL/VERTICAL/GRID. A newly drawn frame is NONE (Freeform). _Data:_ `layoutMode` _Test:_ draw a frame with F; inspector shows Freeform; saved file has `layoutMode:'NONE'`. _M4·P0·[API][OBS]_
- [ ] **AL-003** Child layout fields — Every child stores `layoutPositioning` (default AUTO), `layoutGrow` ∈ {0,1} (default 0) and `layoutAlign` (default INHERIT). Values other than 0/1 for layoutGrow are rejected. _Data:_ `layoutPositioning`, `layoutGrow`, `layoutAlign` _Test:_ create a child in auto layout; inspect defaults; try layoutGrow=0.5 via API → rejected or normalized. _M4·P0·[API]_
- [ ] **AL-004** Sizing shorthand consistency — `layoutSizingHorizontal/Vertical` ∈ FIXED/HUG/FILL is canonical. It always agrees with layoutGrow / layoutAlign / primaryAxisSizingMode / counterAxisSizingMode / textAutoResize per the §2.6 table. HUG on a non-auto-layout, non-text node or FILL on a non-auto-layout child is rejected. _Data:_ §2.6 _Test:_ for every row of §2.6, set the shorthand and read back the underlying fields in Figma (plugin console); Illigma's serialized fields must match. _M4·P0·[API]_
- [ ] **AL-005** Min/max storage — `minWidth/maxWidth/minHeight/maxHeight` are `number|null`, positive only, null = removed. Allowed only on auto layout frames and their direct children. _Data:_ `minWidth`… _Test:_ set and remove each in Figma and Illigma; try setting on a child of a freeform frame → not offered. _M4·P0·[API]_
- [ ] **AL-006** Wrap fields — `layoutWrap` (default NO_WRAP), `counterAxisSpacing` (null = follows `itemSpacing`, getter never null) and `counterAxisAlignContent` (AUTO default) exist only for HORIZONTAL/VERTICAL with WRAP. _Data:_ `layoutWrap`, `counterAxisSpacing`, `counterAxisAlignContent` _Test:_ set itemSpacing 12 with counterAxisSpacing null → row gap reads 12; set row gap 30 → stays 30 when gap changes. _M4·P0·[API]_
- [ ] **AL-007** Alignment enums — `primaryAxisAlignItems` ∈ MIN/CENTER/MAX/SPACE_BETWEEN/SPACE_AROUND/SPACE_EVENLY; `counterAxisAlignItems` ∈ MIN/CENTER/MAX/BASELINE, with BASELINE rejected on VERTICAL. _Data:_ as named _Test:_ round-trip every value through save/load; BASELINE on a vertical frame is refused. _M4·P0·[API]_
- [ ] **AL-008** Grid container fields — `gridRowCount/ColumnCount` are integers ≥1; `gridRowGap/ColumnGap` ≥0; track arrays have the same length as their counts; `gridAutoTracks` NONE/ROWS; `gridItemsPositioning` MANUAL/ROW_AUTO_FLOW. _Data:_ GridLayoutMixin _Test:_ set count 0 or gap −1 → rejected; arrays resize with counts. _M4·P0·[API]_
- [ ] **AL-009** GridTrackSize — `type` ∈ FLEX/FIXED/HUG; `value` = px for FIXED, fr factor for FLEX (1 when absent). FLEX is invalid on an axis where the container Hugs. _Data:_ `GridTrackSize` _Test:_ set a FIXED 120 track and a FLEX 2 track; save and reload; try FLEX with a Hug container → refused or converted (V-34). _M4·P0·[API]_
- [ ] **AL-010** Grid child fields — Anchors are 0-based; spans ≥1; area within bounds; no two children overlap; `gridChildHorizontalAlign/VerticalAlign` ∈ MIN/CENTER/MAX/AUTO. _Data:_ GridChildrenMixin _Test:_ attempt an overlapping placement → refused; out-of-bounds span → refused. _M4·P0·[API]_
- [ ] **AL-011** Layout version field — Each auto layout frame and main component persists `layoutVersion` ∈ LEGACY/UPDATED. New frames are UPDATED. Instances follow their main component. _Data:_ `layoutVersion` (Illigma) _Test:_ new frame shows "Layout: Updated" in settings; instance shows no toggle. _M4·P1·[OBS][SRC:forum-56357][SRC:blog-2026-07]_
- [ ] **AL-012** Flow children computed position — Writing `x`, `y` or the translation of `relativeTransform` on a flow child has no effect. Rotation is kept. _Data:_ `x`, `y`, `relativeTransform` _Test:_ plugin `child.x = 500` on a flow child → x unchanged; same via Illigma API. _M4·P0·[API]_
- [ ] **AL-013** Persisted resolved geometry — Resolved child geometry is saved. Opening a file does not re-run layout. Re-running layout on an unchanged tree changes no value. _Data:_ node transforms/sizes _Test:_ save, reopen, diff all geometry → identical; run layout twice → identical. _M4·P0·[API REST][KNOW]_
- [ ] **AL-014** Property persistence round-trip — Every field of §2.2–§2.5, including variable bindings and `layoutVersion`, survives save → reopen → save byte-identically (semantic equality). _Data:_ all §2 fields _Test:_ fixture file covering every enum value; double round-trip compare. _M4·P0·[API]_
- [ ] **AL-015** Container fields retained on Freeform — Container fields (padding, gap, alignment, stacking, strokes) stay stored when layoutMode is NONE. Whether the UI restores them on re-enable is V-03. _Data:_ AutoLayoutMixin _Test:_ set padding 24, gap 8 → Freeform → Vertical; record restored values (V-03). _M4·P1·[API][KNOW]_

### 6.2 Adding & removing auto layout

- [ ] **AL-016** Shift+A on layers wraps them — With one or more non-frame layers (or several layers) selected, Shift+A creates a new auto layout frame containing them in their common parent. _Data:_ new FRAME with `layoutMode≠NONE` _Test:_ select 3 rectangles laid out in a row; Shift+A → one new frame, 3 children, horizontal flow. _M4·P0·[DOC:5731482952599 excerpt]_
- [ ] **AL-017** Shift+A on a freeform frame converts in place — A selected frame with children (not auto layout) becomes auto layout itself. Node id, name, fills and position are kept. _Data:_ `layoutMode` _Test:_ frame "Card" with 3 stacked texts → Shift+A → same node id now VERTICAL. _M4·P0·[DOC:5731482952599 excerpt][KNOW→V-02]_
- [ ] **AL-018** Flow inference — On Shift+A the flow (vertical/horizontal/grid) is inferred from the spatial arrangement of the children. _Data:_ `layoutMode` _Test:_ fixtures: a row of 3 → HORIZONTAL; a column of 3 → VERTICAL; a 2×3 lattice → GRID (record Figma result, V-02). _M4·P1·[DOC:31289464393751 excerpt]_
- [ ] **AL-019** Child order inference — On Shift+A the children are ordered by spatial position along the inferred axis, not by previous layer order. _Data:_ `children` order _Test:_ create rectangles right-to-left in time order, arranged left to right; Shift+A → children order left-to-right (V-02). _M4·P1·[KNOW]_
- [ ] **AL-020** Gap inference — On Shift+A the gap is derived from the existing spacing between items. _Data:_ `itemSpacing` _Test:_ items spaced 16 apart → gap 16; unequal spacings 10/20 → record Figma value (V-02). _M4·P1·[KNOW]_
- [ ] **AL-021** Padding inference — Converting a frame in place derives the padding from the content bounds to the frame edges, keeping size and child positions where possible. A new wrapper uses the padding recorded in V-02. _Data:_ `padding*` _Test:_ frame 200×200 with content inset 20/30/20/30 → record padding and final size (V-02). _M4·P1·[KNOW]_
- [ ] **AL-022** Sizing after Shift+A — The resulting sizing per axis (Hug or Fixed) matches Figma. The API default when setting layoutMode is Hug×Hug. _Data:_ `layoutSizing*` _Test:_ record sizing after wrap and after in-place convert (V-02). _M4·P1·[API][KNOW]_
- [ ] **AL-023** Shift+A inside an auto layout parent — Selected flow children are wrapped in a nested auto layout frame that takes the flow index of the first selected child. _Data:_ parent `children` _Test:_ vertical list A..E, select B,C → Shift+A → [A, Frame(B,C), D, E] (V-04). _M4·P1·[KNOW]_
- [ ] **AL-024** Shift+A on an auto layout frame — Wraps the auto layout frame in a new auto layout parent; it does not toggle auto layout off. _Data:_ hierarchy _Test:_ select an auto layout frame → Shift+A → new parent (V-04). _M4·P1·[KNOW]_
- [ ] **AL-025** Shift+A on a group — Matches Figma (wrap the group, or convert it) as recorded in V-04. _Data:_ hierarchy _Test:_ select a group → Shift+A → record. _M4·P2·[KNOW]_
- [ ] **AL-026** Add via inspector flow selector — Choosing Vertical, Horizontal or Grid on a Freeform frame applies auto layout with that flow (no flow inference). _Data:_ `layoutMode` _Test:_ frame with 3 children → click Horizontal → HORIZONTAL regardless of arrangement. _M4·P0·[OBS][KNOW→V-03]_
- [ ] **AL-027** Add/Remove via menus — Context menu and Object menu offer "Add auto layout" and "Remove auto layout" with the same effects as the shortcuts. _Data:_ — _Test:_ right-click a frame; compare results with Shift+A / ⌥⇧A. _M4·P1·[KNOW→V-02]_
- [ ] **AL-028** Remove auto layout keeps geometry — ⌥⇧A / Alt+Shift+A (or Freeform) sets layoutMode NONE. Every child keeps its exact current position and size. The frame keeps its size (becomes Fixed). Children that were Fill/Hug relative to it become Fixed. Absolute children become ordinary. _Data:_ `layoutMode`, child geometry _Test:_ auto layout frame with Fill, Hug and absolute children → remove → all absolute coordinates unchanged (diff = 0). _M4·P0·[API][SRC:kinney]_
- [ ] **AL-029** Remove on multi-selection — Removing auto layout with several auto layout frames selected converts all of them in one undo step. _Data:_ — _Test:_ select 5 auto layout frames → ⌥⇧A → all Freeform; one ⌘Z restores all. _M4·P1·[SRC:forum-remove-all]_
- [ ] **AL-030** Re-adding is not a restore — Remove then re-add does not restore the original children positions. _Data:_ — _Test:_ plugin sequence `layoutMode='VERTICAL'; layoutMode='NONE'` leaves children at their laid-out positions. _M4·P1·[API]_
- [ ] **AL-031** Suggest auto layout — ⌃⇧A (mac) / Ctrl+Alt+Shift+A (win), the context menu "More layout options" and the Actions menu run a local heuristic. It creates nested auto layout frames throughout the selected frame/component while preserving placement, as one undo step. _Data:_ new frames _Test:_ card fixture (image, title, meta row, buttons) → compare the resulting hierarchy with Figma's output; positions must not move > 1px (V-37). _M4·P2·[DOC:5731482952599 excerpt]_
- [ ] **AL-032** Shift+A with empty selection — No-op; no frame is created. _Data:_ — _Test:_ deselect all → Shift+A → document unchanged. _M4·P2·[KNOW]_

### 6.3 Flow (direction)

- [ ] **AL-033** Horizontal flow — Flow children are placed left to right along x in `children` order. _Data:_ `layoutMode='HORIZONTAL'` _Test:_ fixture F7 positions. _M4·P0·[API][DOC:31289464393751 excerpt]_
- [ ] **AL-034** Vertical flow — Flow children are placed top to bottom along y in `children` order. _Data:_ `layoutMode='VERTICAL'` _Test:_ transpose F7 → y = 12…, matching Figma. _M4·P0·[API][DOC:31289464393751 excerpt]_
- [ ] **AL-035** Switching H⇄V keeps per-axis sizing intent — Each child's `layoutSizingHorizontal/Vertical` is unchanged after a flow switch (layoutGrow/layoutAlign swap internally). The frame's own W/H sizing is unchanged. _Data:_ `layoutSizing*` _Test:_ vertical frame with child Fill-W/Hug-H → switch to horizontal → child still Fill-W/Hug-H (V-05). _M4·P0·[KNOW][SRC:forum-23826]_
- [ ] **AL-036** Switch stack → grid — Children are placed into grid cells in `children` order (row-major), with initial counts as recorded. _Data:_ grid fields _Test:_ horizontal 5 children → Grid → record rows/cols and placement (V-33). _M4·P1·[KNOW]_
- [ ] **AL-037** Switch grid → stack — The stack flow order equals `children` order. Grid fields stay stored. _Data:_ — _Test:_ grid with manual placement out of layer order → Vertical → order = layer order (V-33). _M4·P1·[KNOW]_
- [ ] **AL-038** Flow change undo — A flow change plus all resulting geometry changes is one undo step; redo reproduces the identical geometry. _Data:_ — _Test:_ switch, undo, redo → geometry diff 0 vs the first switch. _M4·P0·[KNOW→V-39]_

### 6.4 Gap

- [ ] **AL-039** Fixed gap between flow children only — `itemSpacing` is placed n−1 times, never before the first or after the last child. _Data:_ `itemSpacing` _Test:_ F7 (gap 8) → x = 16, 64; W = 140. _M4·P0·[API]_
- [ ] **AL-040** Decimal gap — Decimal values (e.g. 7.5) are stored and laid out exactly. _Data:_ `itemSpacing` _Test:_ gap 7.5 with two 10-wide rects → x2 = 17.5. _M4·P1·[KNOW→V-30]_
- [ ] **AL-041** Negative gap — Negative values are allowed. Children overlap and Hug shrinks by the negative amount. _Data:_ `itemSpacing<0` _Test:_ F8 → W=130, x = 0, 40, 80. _M4·P0·[API]_
- [ ] **AL-042** Negative gap extreme — When `Σ + gap·(n−1)` falls below the largest child (or below 0), the Hug size and positions match Figma. _Data:_ — _Test:_ two 50-wide rects, gap −80 → record Figma W and x (V-11). _M4·P2·[KNOW]_
- [ ] **AL-043** Gap ignores hidden/absolute — Hidden or absolute children never add a gap (no doubled gaps). _Data:_ — _Test:_ F19 → W=110, C.x=60. _M4·P0·[KNOW→V-21]_
- [ ] **AL-044** Auto gap: Between — `SPACE_BETWEEN`: first and last children flush with the inner edges; equal gaps = free/(n−1). _Data:_ `primaryAxisAlignItems='SPACE_BETWEEN'` _Test:_ F2 → x = 0, 125, 250. _M4·P0·[API][SRC:forum-57146]_
- [ ] **AL-045** Auto gap: Around — `SPACE_AROUND`: inter-item gap = free/n, edge space = half a gap. _Data:_ `SPACE_AROUND` _Test:_ F3 → x = 25, 125, 225. _M4·P1·[API][SRC:forum-57146]_
- [ ] **AL-046** Auto gap: Evenly — `SPACE_EVENLY`: edge space = gap = free/(n+1). _Data:_ `SPACE_EVENLY` _Test:_ F4 → x = 37.5, 125, 212.5. _M4·P1·[API][SRC:forum-57146]_
- [ ] **AL-047** Auto gap single child — n=1: Between puts the child at the leading edge; Around and Evenly center it. _Data:_ — _Test:_ F5 → 0 / 125 / 125. _M4·P0·[SRC:forum-57146][SRC:old-notes]_
- [ ] **AL-048** Auto gap never negative — When Σ sizes > inner size, auto modes use gap 0 and pack children at the start (overflow at the end). _Data:_ — _Test:_ F6 → x = 0, 50, 100 for Between; record Around/Evenly overflow (V-13). _M4·P0·[SRC:forum-57146][SRC:old-notes]_
- [ ] **AL-049** Auto toggle restores fixed value — Switching gap to Auto keeps the stored `itemSpacing`; switching back restores it. _Data:_ `itemSpacing` _Test:_ gap 24 → Auto → fixed → gap shows 24 (V-13). _M4·P1·[KNOW]_
- [ ] **AL-050** X toggles Auto gap — With the alignment box focused, X toggles gap Auto ⇄ fixed. _Data:_ `primaryAxisAlignItems` _Test:_ click the alignment box, press X twice → Auto then fixed. _M4·P1·[DOC:360040451373|31289464393751 excerpt]_
- [ ] **AL-051** Auto spacing type picker — Layout settings offer Between/Around/Evenly. The picker is enabled only in the configurations recorded in V-13 (it was observed disabled on a Vertical+Wrap frame). _Data:_ `SPACE_*` _Test:_ open settings with gap fixed vs Auto, Hug vs Fixed primary → record enabled state. _M4·P1·[OBS][SRC:forum-57146]_
- [ ] **AL-052** Auto gap with Hug primary axis — Matches Figma: either packed with gap 0 (no free space) or the control is unavailable. _Data:_ — _Test:_ Hug-W horizontal with 3 children → choose Auto → record W and positions (V-13). _M4·P1·[KNOW][OBS]_
- [ ] **AL-053** Auto gap with Fill children — When any flow child is Fill on the main axis, it consumes the free space and the auto gaps are 0. _Data:_ — _Test:_ W=300, rects 50, Fill, 50, Between → Fill.w = 200, x = 0, 50, 250 (V-13). _M4·P1·[KNOW]_

### 6.5 Padding

- [ ] **AL-054** Four independent paddings — Left, right, top and bottom are applied as insets from the frame's edges. _Data:_ `paddingLeft/Right/Top/Bottom` _Test:_ padding 1/2/3/4 (T/R/B/L) with one rect, Hug×Hug → rect at (4,1); frame = rect + (6,4). _M4·P0·[API]_
- [ ] **AL-055** Combined & individual fields — The inspector shows horizontal (L=R) and vertical (T=B) fields, and an individual-padding toggle showing 4 fields. Unequal pairs display "Mixed" in the combined field. _Data:_ — _Test:_ set L=8, R=12 → horizontal field shows Mixed. _M4·P0·[OBS][KNOW]_
- [ ] **AL-056** Comma-separated padding entry — Entering CSS-order lists (e.g. "8, 16") into a padding field sets multiple sides. _Data:_ `padding*` _Test:_ enter "4, 8, 12, 16" → T4 R8 B12 L16 (record Figma's accepted forms). _M4·P2·[SRC:uxdesign-tricks]_
- [ ] **AL-057** ⌘/Ctrl-click edits all padding — ⌘/Ctrl-clicking a padding input targets all four sides. _Data:_ — _Test:_ ⌘-click the horizontal field, type 10 → all sides 10. _M4·P2·[SRC:kinney]_
- [ ] **AL-058** Padding non-negative — Negative padding input is clamped to 0 or rejected, as Figma does. _Data:_ — _Test:_ type −5 → record (V-12). _M4·P1·[KNOW]_
- [ ] **AL-059** Updated padding floor — In UPDATED, frame size on each axis ≥ paddingStart + paddingEnd (+ included inside stroke), including for Fixed and Fill. _Data:_ `layoutVersion='UPDATED'` _Test:_ F9 → W=60; F10 → W=80. _M4·P0·[DOC:42031586813719 excerpt]_
- [ ] **AL-060** Padding floor beats max — The padding floor wins over `maxWidth/maxHeight`. _Data:_ — _Test:_ F11 → W=60. _M4·P0·[DOC:42031586813719 excerpt]_
- [ ] **AL-061** Legacy padding compression — In LEGACY, a frame smaller than its padding compresses the padding as Figma does. _Data:_ `layoutVersion='LEGACY'` _Test:_ Legacy frame W=50, padding L/R 30 with a child → record child x and frame W (V-26). _M8·P2·[DOC:42031586813719 excerpt]_
- [ ] **AL-062** Padding ignored by absolute children — Absolute children are positioned relative to the frame edges and are unaffected by padding changes. _Data:_ — _Test:_ absolute child at (0,0); change padding to 40 → child stays at (0,0) (V-19). _M4·P1·[API][KNOW]_
- [ ] **AL-063** Padding variables — Each padding side can be bound to a number variable; mode switch re-runs layout. _Data:_ `boundVariables.paddingLeft` … _Test:_ bind padding to a variable with modes 8/24 → switch mode → frame grows by 32 on that axis. _M6·P0·[API]_

### 6.6 Alignment

- [ ] **AL-064** 9-position control mapping — Each of the 9 positions sets (primary, counter) ∈ {MIN,CENTER,MAX}²; for vertical flows the mapping transposes. _Data:_ `primaryAxisAlignItems`, `counterAxisAlignItems` _Test:_ click bottom-right on a horizontal frame → (MAX, MAX); on a vertical frame → (MAX, MAX) with primary = y. _M4·P0·[API][OBS]_
- [ ] **AL-065** Packed primary alignment — MIN/CENTER/MAX offset the packed content by 0, rem/2, rem. _Data:_ — _Test:_ W=300, two 50 rects, gap 10: MIN x=0,60; CENTER x=95,155; MAX x=190,250. _M4·P0·[API]_
- [ ] **AL-066** Counter alignment — MIN/CENTER/MAX apply to all flow children uniformly. _Data:_ `counterAxisAlignItems` _Test:_ F1 y values (40, 35, 30). _M4·P0·[API]_
- [ ] **AL-067** No per-child counter alignment — Deprecated per-child `layoutAlign` MIN/CENTER/MAX is not offered and is mapped to INHERIT on import. _Data:_ `layoutAlign` _Test:_ import a node with layoutAlign CENTER → treated as INHERIT; frame alignment applies. _M8·P1·[API]_
- [ ] **AL-068** Alignment options with Auto gap — With Auto gap the control offers only the counter-axis choices (3). Picking one keeps the auto mode. _Data:_ — _Test:_ Between gap → the alignment box shows 3 targets; click "bottom" → counter MAX, primary stays SPACE_BETWEEN (V-14). _M4·P0·[DOC:31289464393751 excerpt][KNOW]_
- [ ] **AL-069** Alignment box keyboard — When focused: arrow keys step through the 9 positions; W/A/S/D align to top/left/bottom/right. _Data:_ — _Test:_ focus the box at top-left, press → twice → top-right; press S → bottom edge. _M4·P1·[DOC:360040451373|31289464393751 excerpt]_
- [ ] **AL-070** Overflow under CENTER — With packed CENTER and content larger than the inner size, the content overflows both sides equally (negative start offset). _Data:_ — _Test:_ W=100, rects 80+80 gap 0, CENTER → x=−30, 50 (V-14). _M4·P1·[KNOW]_
- [ ] **AL-071** Stretched child clamped by max — A Fill-cross child clamped by max is positioned by the counter alignment. _Data:_ — _Test:_ H frame inner H=80, child Fill-H maxH=50, counter CENTER → y = pad + 15 (V-14). _M4·P1·[KNOW]_
- [ ] **AL-072** Baseline availability — Text baseline alignment is enabled only on horizontal frames that contain a text child; it is disabled on vertical and grid frames. _Data:_ `counterAxisAlignItems='BASELINE'` _Test:_ open settings on a vertical frame → disabled; on a horizontal frame with text → enabled. _M4·P1·[API][DOC:360040451373 excerpt][OBS]_
- [ ] **AL-073** Baseline toggle with B — With the alignment box focused, B toggles baseline alignment. While it is on, only Left/Center/Right (primary) choices remain. _Data:_ — _Test:_ press B → baseline on; alignment box shows 3 choices. _M4·P1·[DOC excerpt]_
- [ ] **AL-074** Baseline geometry — First-line baselines of all text children lie on one y. Non-text children use their bottom edge, and nested auto layout children use their first text descendant's baseline, as recorded in V-15. Hug height = max ascent + max descent. _Data:_ — _Test:_ texts at 12px and 32px plus a 24px icon → measure baseline y of each in Figma; Illigma within 0.01px. _M4·P1·[KNOW]_
- [ ] **AL-075** Align shortcuts on auto layout — ⌥/Alt+W/A/S/D/H/V with an auto layout frame or a flow child selected behave as recorded in V-14 (either the frame's alignment changes or no-op). _Data:_ — _Test:_ select an auto layout frame, press ⌥D → record. _M4·P2·[SRC:skillademia][KNOW]_

### 6.7 Sizing (Fixed / Hug / Fill)

- [ ] **AL-076** Option availability matrix — W/H dropdowns offer exactly the options of the §3.5 matrix for each node kind × context; unavailable options are not selectable. _Data:_ `layoutSizing*` _Test:_ iterate the matrix in Figma (auto layout frame, text, rect, group, instance × top-level / stack child / grid child / absolute) → identical option sets. _M4·P0·[API][DOC:360040451373 excerpt]_
- [ ] **AL-077** Typing a size sets Fixed — Entering a number in W or H sets Fixed on that axis only. _Data:_ — _Test:_ Hug×Hug frame, type W=200 → W Fixed 200, H still Hug. _M4·P0·[DOC:360040451373 excerpt]_
- [ ] **AL-078** Hug stack size — Hug main = insets + Σ child sizes + gap·(n−1); Hug cross = insets + max defining child cross size. _Data:_ — _Test:_ F7 → 140×64. _M4·P0·[API]_
- [ ] **AL-079** Fill main distribution — Fill children share the free main space equally (UPDATED: equal content areas). _Data:_ `layoutGrow=1` _Test:_ F1 (B=130); F14 (A=170, B=130) (V-32). _M4·P0·[API][SRC:blog-2026-07]_
- [ ] **AL-080** Legacy Fill distribution — In LEGACY, Fill children share equal outer sizes, as recorded in V-26. _Data:_ — _Test:_ F14 on a Legacy frame → record (expected 150/150). _M8·P2·[KNOW]_
- [ ] **AL-081** Fill cross (stretch) — A Fill-cross child takes the inner cross size (clamped by its min/max and floor). _Data:_ `layoutAlign='STRETCH'` _Test:_ V frame W=200, pad 10, child Fill-W → w=180. _M4·P0·[API]_
- [ ] **AL-082** Fill on Hug parent converts the parent — Setting a child to Fill on an axis where the parent Hugs switches the parent to Fixed (current size) on that axis. _Data:_ parent `layoutSizing*` _Test:_ Hug×Hug horizontal frame, child → Fill-W → parent W becomes Fixed. _M4·P0·[DOC:360040451373 excerpt]_
- [ ] **AL-083** Counter-axis Hug with Fill children — A Hug-cross parent stays Hug when at least one flow child is not Fill on that axis; Fill children stretch to the size set by the others. If all are Fill, the parent becomes Fixed. _Data:_ — _Test:_ F18; then make A Fill too → parent W Fixed (V-06). _M4·P1·[KNOW]_
- [ ] **AL-084** Parent set to Hug demotes Fill children — Setting the parent to Hug on an axis converts children that are Fill on that axis to Fixed (current size), per V-06 rules. _Data:_ — _Test:_ Fixed parent with Fill child → set parent Hug → child Fixed. _M4·P1·[SRC:forum-19030]_
- [ ] **AL-085** No self Hug+Fill — A node cannot be Hug and Fill on the same axis; choosing one replaces the other. _Data:_ `primaryAxisSizingMode`/`layoutGrow` _Test:_ nested auto layout child Hug-W → set Fill-W → its own primary sizing becomes FIXED. _M4·P0·[API]_
- [ ] **AL-086** Canvas resize of Hug → Fixed — Dragging a resize handle of a Hug frame switches only that axis to Fixed. _Data:_ — _Test:_ drag the right edge of a Hug×Hug frame → W Fixed, H Hug (V-08). _M4·P0·[KNOW]_
- [ ] **AL-087** Canvas resize of Fill child → Fixed — Resizing a Fill child on that axis (canvas or inspector) switches it to Fixed. _Data:_ — _Test:_ drag a Fill child's edge → Fixed at the new size; siblings reflow (V-08). _M4·P0·[KNOW]_
- [ ] **AL-088** Double-click edge sets Hug — Double-clicking an edge resize handle of an auto layout frame sets Hug on that axis (text: auto width/height). _Data:_ — _Test:_ Fixed frame → double-click the right edge → record (V-08). _M4·P2·[KNOW]_
- [ ] **AL-089** Live parent resize during child resize — Resizing a flow child updates Hug ancestors and sibling positions live during the drag, and commits one undo step. _Data:_ — _Test:_ drag a child in a Hug parent; observe the parent growing per frame; one ⌘Z reverts. _M4·P0·[API][KNOW]_
- [ ] **AL-090** No shrinking of Fixed/Hug children — Fixed or Hug children are never shrunk by the parent; they overflow. _Data:_ — _Test:_ Fixed W=100 parent, two Fixed 80 children → children stay 80, overflow 60. _M4·P0·[API][KNOW]_
- [ ] **AL-091** Fill never negative — When free space < 0, Fill children get max(min, floor), never a negative or zero-crossing size. _Data:_ — _Test:_ W=100, Fixed 80 + Fixed 80 + Fill → Fill.w = 0 or the Figma minimum (V-10). _M4·P1·[KNOW]_
- [ ] **AL-092** Top-level auto layout frame options — Top-level (page/section child) auto layout frames offer Fixed/Hug only, no Fill. _Data:_ — _Test:_ open the W dropdown on a top-level auto layout frame. _M4·P0·[DOC:360040451373 excerpt]_
- [ ] **AL-093** Aspect-ratio-locked Fill child — A Fill child with a locked aspect ratio derives the other axis from the ratio. _Data:_ `targetAspectRatio` _Test:_ the API example: 2:3 image, Fill-W in a 500×1000 parent → 500×750. _M4·P1·[API]_
- [ ] **AL-094** Rotated child in flow — A rotated child participates with its axis-aligned bounding box; Fill availability/behavior matches V-09. _Data:_ `rotation` _Test:_ 100×20 rect rotated 90° in a Hug row → contributes 20 wide (V-09). _M4·P2·[KNOW]_
- [ ] **AL-095** Group child sizing — Sizing options and resizing behavior of groups inside auto layout match Figma (V-07). _Data:_ — _Test:_ group in a vertical auto layout → dropdown options; try Fill. _M4·P2·[KNOW]_
- [ ] **AL-096** Multi-selection sizing — Setting Fill/Hug/Fixed with several children selected applies to each child where valid and skips invalid ones; the inspector shows Mixed when values differ. _Data:_ — _Test:_ select a rect and a text in auto layout → set Hug W → text Hug, rect unchanged/disabled (record). _M4·P1·[KNOW]_
- [ ] **AL-097** Leaving auto layout demotes Fill — Moving a Fill child out of its auto layout parent sets it to Fixed at its current size. _Data:_ — _Test:_ drag a Fill child to the canvas → Fixed with the same size (V-03). _M4·P1·[KNOW]_

### 6.8 Min / max

- [ ] **AL-098** Add/remove min/max UI — W/H dropdowns offer Add min width / Add max width (Height equivalents) and Remove min and max; the fields accept numbers or variables. _Data:_ `minWidth`… _Test:_ add min 120 and max 320 → fields appear; remove → null. _M4·P0·[DOC:360040451373 excerpt]_
- [ ] **AL-099** Min/max with Hug — A Hug frame is clamped to [min, max]; content beyond max overflows and is clipped only if clipsContent. _Data:_ — _Test:_ Hug row of 3×100 rects, maxW 250 → W=250, overflow visible/clipped per setting (V-16). _M4·P0·[KNOW]_
- [ ] **AL-100** Min/max with Fill — Fill children clamp to min/max and the remaining space is redistributed (UPDATED). _Data:_ — _Test:_ F12 → 200/100; F13 → 50/250. _M4·P0·[SRC:forum-57215][SRC:old-notes]_
- [ ] **AL-101** Min/max with Fixed — Typed sizes or canvas resizing outside [min,max] are clamped as Figma does. _Data:_ — _Test:_ min 100 → type W=50 → record (V-16). _M4·P1·[KNOW]_
- [ ] **AL-102** Min > max conflict — When min > max, min wins (or Figma prevents it in the UI). _Data:_ — _Test:_ set max 100 then min 150 → record stored values and size (V-16). _M4·P1·[KNOW]_
- [ ] **AL-103** Min/max apply to Hug/Fill/Fixed alike — Limits are honored in every sizing mode for auto layout frames and their direct children. _Data:_ — _Test:_ a matrix of 3 modes × min/max on one child. _M4·P0·[DOC:360040451373 excerpt][API]_
- [ ] **AL-104** Min/max indicator & preview — The W/H icon shows the limit marker when limits are set; hovering previews the limits on canvas; the fields collapse after reselection and re-expand on icon click. _Data:_ transient _Test:_ set a limit, deselect, reselect → fields hidden; click the icon → shown. _M4·P2·[DOC:360040451373 excerpt]_
- [ ] **AL-105** Min/max disable constraints — Setting min or max width disables Left/Right and Scale horizontal constraints (and the vertical equivalents for height). _Data:_ `constraints` _Test:_ absolute child with minW → constraints dropdown options (V-16). _M4·P2·[SRC:forum-20043]_
- [ ] **AL-106** Min/max variables — Each limit can be bound to a number variable; mode switch re-runs layout. _Data:_ `boundVariables.minWidth` … _Test:_ bind maxW to 320/480 modes → switch mode → Hug width changes. _M6·P1·[API][DOC:360040451373 excerpt]_
- [ ] **AL-107** Canvas resize respects limits — Dragging a frame or child with limits stops at min/max. _Data:_ — _Test:_ drag below min 120 → width stays 120 (V-16). _M4·P1·[KNOW]_
- [ ] **AL-108** Grid container min/max — Availability on grid containers matches current Figma (unsupported as of May 2025). _Data:_ — _Test:_ open the W dropdown on a grid frame → record (V-36). _M4·P2·[SRC:forum-40352]_

### 6.9 Text in auto layout

- [ ] **AL-109** Text Hug width ⇔ WIDTH_AND_HEIGHT — Choosing Hug width on text sets auto width (single line, natural width). _Data:_ `textAutoResize='WIDTH_AND_HEIGHT'` _Test:_ select text in a row → Hug W → textAutoResize reads WIDTH_AND_HEIGHT. _M4·P0·[API]_
- [ ] **AL-110** Text Fixed width + Hug height ⇔ HEIGHT — The text wraps at the fixed width and its height hugs. _Data:_ `textAutoResize='HEIGHT'` _Test:_ W Fixed 120 → long text wraps; H grows. _M4·P0·[API]_
- [ ] **AL-111** Text Fill width — The text width = resolved Fill width; the text wraps and its height hugs; parent Hug height updates. _Data:_ `layoutGrow` or `STRETCH` + `HEIGHT` _Test:_ H frame Fixed W=300, avatar 40, gap 12, text Fill → text w=248; height = lines × line-height (V-18). _M4·P0·[KNOW]_
- [ ] **AL-112** Text Fill height — The text box height = resolved Fill height (fixed box); content overflows or truncates. _Data:_ `textAutoResize='NONE'` _Test:_ V frame Fixed H=200, text Fill-H → h = inner remaining (V-18). _M4·P1·[KNOW]_
- [ ] **AL-113** Text Hug width with max — Hug-width text with maxWidth grows until max, then wraps with Hug height. _Data:_ `maxWidth` _Test:_ maxW 200 with a long string → w=200, multi-line (V-17). _M4·P1·[KNOW]_
- [ ] **AL-114** Truncation caps height — `textTruncation=ENDING` + `maxLines=2` in an auto layout child limits the hugged height to 2 lines. _Data:_ `textTruncation`, `maxLines` _Test:_ 5-line text → height = 2 × line-height; ellipsis shown. _M3·P1·[API]_
- [ ] **AL-115** Live text edit reflow — Typing in a Hug text reflows all Hug ancestors on every keystroke, within the same undo step as the text edit. _Data:_ — _Test:_ type in a button label → button width grows live; ⌘Z reverts text and size together. _M4·P0·[KNOW]_
- [ ] **AL-116** Leading trim affects layout — Changing leadingTrim (CAP_HEIGHT) changes the text box height and thus the auto layout geometry. _Data:_ `leadingTrim` _Test:_ toggle cap-height trim in a Hug button → height changes as in Figma. _M3·P1·[API]_

### 6.10 Wrap

- [ ] **AL-117** Wrap availability — Wrap is available for Horizontal and Vertical flows, not for Grid. _Data:_ `layoutWrap` _Test:_ toggle Wrap in each flow; Grid shows no wrap. _M4·P0·[API][SRC:forum-58389]_
- [ ] **AL-118** Horizontal wrap line breaking — Items move to a new row when `used + gap + size > innerWidth`; exact fits stay; a line always holds ≥1 item. _Data:_ — _Test:_ F15 → rows [3,2], H=80. _M4·P0·[API][KNOW→V-17]_
- [ ] **AL-119** Vertical wrap — Items move to a new column when the column reaches the available height; order is kept (not masonry). _Data:_ `VERTICAL`+`WRAP` _Test:_ transpose F15 → columns [3,2], W=80 (V-37). _M4·P0·[SRC:forum-58389][DOC:360040451373 excerpt]_
- [ ] **AL-120** Row gap — `counterAxisSpacing` separates lines; null follows `itemSpacing`; ≥0. _Data:_ `counterAxisSpacing` _Test:_ F15 second row y=50. _M4·P0·[API]_
- [ ] **AL-121** Align content AUTO (packed) — When not all children are Fill-cross, lines are sized to their tallest item and the block of lines is aligned by `counterAxisAlignItems`. _Data:_ `counterAxisAlignContent='AUTO'` _Test:_ F15 with Fixed H=200, counter CENTER → block height 80 starts at y=60. _M4·P0·[API]_
- [ ] **AL-122** Align content AUTO (stretch) — When all children are Fill-cross, lines stretch equally to fill the frame. _Data:_ — _Test:_ F17 → children h=90, row 2 y=110. _M4·P1·[API]_
- [ ] **AL-123** Align content SPACE_BETWEEN — Free cross space is divided between lines; on overflow the spacing is 0. _Data:_ `counterAxisAlignContent='SPACE_BETWEEN'` _Test:_ F16 → row 2 y=170. _M4·P1·[API]_
- [ ] **AL-124** Row gap Auto UI — The row-gap field's Auto option maps to `counterAxisAlignContent=SPACE_BETWEEN`. _Data:_ — _Test:_ set row gap Auto → read the field via plugin (V-17). _M4·P1·[KNOW]_
- [ ] **AL-125** Per-line main alignment — Each line distributes its own free space (Fill children first, then primary alignment/Auto gap). _Data:_ — _Test:_ F15 with primary CENTER → row 2 x = 35, 105. _M4·P0·[KNOW→V-17]_
- [ ] **AL-126** In-line cross alignment — Items in a line are aligned by `counterAxisAlignItems` within the line's height; Fill-cross items take the line height. _Data:_ — _Test:_ row with 30 and 50 tall items, CENTER → 30-tall item y offset 10 within the line. _M4·P0·[KNOW→V-17]_
- [ ] **AL-127** Hug + wrap without max — With Hug primary and no max, no wrapping occurs (single line). _Data:_ — _Test:_ Hug-W wrap frame with 5 items → 1 row (V-17). _M4·P1·[KNOW]_
- [ ] **AL-128** Hug + max wraps at max — With Hug primary and maxWidth, the frame grows to max and then wraps. _Data:_ `maxWidth` _Test:_ maxW 200 version of F15 with Hug W → W=200, rows [3,2] (V-17). _M4·P0·[KNOW]_
- [ ] **AL-129** Enabling wrap on Hug primary — The sizing change (if any) when enabling wrap on a Hug-primary frame matches Figma. _Data:_ — _Test:_ Hug-W row → toggle Wrap → record W sizing mode (V-17). _M4·P1·[KNOW]_
- [ ] **AL-130** Fill children in wrap — Fill children count with their min (else floor/0) for line breaking and share each line's free space. _Data:_ — _Test:_ W=500, gap 20, 4 Fill children minW 150 → rows [3,1]; row-1 widths (500−40)/3 = 153.33; row-2 child 500 (V-17). _M4·P0·[KNOW]_
- [ ] **AL-131** Hug cross with wrap — Hug cross = insets + Σ line cross + row gap·(lines−1). _Data:_ — _Test:_ F15 → H=80. _M4·P0·[API][KNOW]_
- [ ] **AL-132** Negative gap with wrap — Whether a negative item gap is accepted in wrap mode, and the resulting breaking, match Figma. _Data:_ — _Test:_ wrap frame, set gap −10 → record (V-17). _M4·P2·[KNOW]_
- [ ] **AL-133** Wrap off keeps settings — Turning wrap off returns to one line; `counterAxisSpacing` and align-content stay stored and come back on re-enable. _Data:_ — _Test:_ row gap 30 → wrap off → on → 30. _M4·P2·[KNOW]_

### 6.11 Ignore auto layout (absolute)

- [ ] **AL-134** Ignore auto layout toggle — Toggling on sets `layoutPositioning=ABSOLUTE`; the child keeps its visual position; siblings close the gap; Hug parent recomputes without it. _Data:_ `layoutPositioning` _Test:_ F20: toggle on B → B stays, W shrinks to exclude B. _M4·P0·[DOC:360040451373 excerpt][API]_
- [ ] **AL-135** Absolute child editing — X, Y, W and H of an absolute child are editable and persist. _Data:_ `x`,`y`,`width`,`height` _Test:_ set x=200 → stays after any sibling change. _M4·P0·[API]_
- [ ] **AL-136** Absolute child constraints — An absolute child respects its constraints when the auto layout frame resizes. _Data:_ `constraints` _Test:_ absolute badge with constraints Right/Top; parent widens by 50 → badge moves +50 in x. _M4·P0·[API]_
- [ ] **AL-137** Control-drag in as absolute — Holding ⌃ (mac) / Ctrl (win) while dropping into an auto layout frame inserts the layer as absolute at the drop point. _Data:_ — _Test:_ ⌃-drag a rect into a row → no reflow; rect at the drop location; layoutPositioning ABSOLUTE (V-19). _M4·P0·[DOC:360040451373 excerpt]_
- [ ] **AL-138** Absolute excluded from layout math — Absolute children are excluded from gaps, Hug, wrap breaking, baseline and auto-gap counts. _Data:_ — _Test:_ F20 with Between → positions computed from flow children only. _M4·P0·[API]_
- [ ] **AL-139** No Fill for absolute — Fill is not offered for absolute children; their own Hug (auto layout or text) stays available. _Data:_ — _Test:_ absolute text → dropdown has Fixed/Hug only. _M4·P1·[SRC:forum-58344][KNOW]_
- [ ] **AL-140** Toggle off re-enters flow — Turning Ignore auto layout off puts the child back into the flow at its `children` index. _Data:_ — _Test:_ absolute child at index 0 drawn at the far right → toggle off → it becomes the first flow item (V-19). _M4·P1·[KNOW]_
- [ ] **AL-141** Absolute z-order & stacking — Absolute children paint per layer order; interaction with canvas stacking matches V-20. _Data:_ `itemReverseZIndex` _Test:_ First-on-top frame with an absolute child overlapping → record which paints on top (V-20). _M4·P2·[KNOW]_
- [ ] **AL-142** Default constraints on becoming absolute — The constraints assigned when a child becomes absolute match Figma. _Data:_ `constraints` _Test:_ toggle on → read constraints (V-19). _M4·P2·[KNOW]_

### 6.12 Hidden children

- [ ] **AL-143** Hidden child collapses — A `visible=false` child takes no space and adds no gap; Hug shrinks. _Data:_ `visible` _Test:_ F19 → W=110. _M4·P0·[KNOW→V-21]_
- [ ] **AL-144** Unhide restores position — Showing a hidden child restores it at its original flow index. _Data:_ — _Test:_ hide B, then show B → order A, B, C. _M4·P0·[KNOW]_
- [ ] **AL-145** Opacity 0 still occupies space — Opacity 0 (or a fully transparent fill) does not remove the child from layout. _Data:_ `opacity` _Test:_ B opacity 0 → W unchanged (V-21). _M4·P1·[KNOW]_
- [ ] **AL-146** Visibility by boolean property/variable — Toggling a boolean component property or a bound boolean variable collapses or expands the layout. _Data:_ `componentPropertyReferences.visible`, `boundVariables.visible` _Test:_ button instance "Show icon" off → width shrinks by icon + gap. _M5·P0·[API][KNOW]_
- [ ] **AL-147** Hidden child in grid — In manual grids, a hidden child keeps or frees its cell exactly as Figma does. _Data:_ — _Test:_ hide a grid child, then append a new child → record the placement (V-35). _M4·P2·[KNOW]_

### 6.13 Strokes in layout & layout version

- [ ] **AL-148** Strokes setting — Layout settings show "Inside stroke: Included / Excluded", mapped to `strokesIncludedInLayout`. _Data:_ `strokesIncludedInLayout` _Test:_ toggle → read via plugin. _M4·P0·[API][OBS]_
- [ ] **AL-149** UPDATED: inside stroke adds to insets — With Included, the frame's inside stroke weight (per side for individual strokes) adds to that side's padding. _Data:_ `strokeAlign='INSIDE'`, `strokeWeight`/`stroke*Weight` _Test:_ Hug frame, padding 10, inside stroke 4 Included, child 50×50 → frame 78×78; child at (14,14). _M4·P0·[DOC:42031586813719 excerpt][API]_
- [ ] **AL-150** UPDATED: center/outside strokes ignored — Center and outside strokes never affect layout, Included or not. _Data:_ `strokeAlign` _Test:_ same frame with an outside stroke 4 Included → 70×70. _M4·P0·[DOC:42031586813719 excerpt]_
- [ ] **AL-151** UPDATED: child strokes don't affect siblings — A child's outside stroke does not push siblings regardless of the parent's setting. _Data:_ — _Test:_ child with outside stroke 10 in an Included parent → sibling x unchanged. _M4·P0·[SRC:blog-2026-07]_
- [ ] **AL-152** UPDATED: Fill shares by content area with strokes — Fill siblings with different included inside strokes get equal content areas. _Data:_ — _Test:_ W=300, two Fill auto layout frames, A inside stroke 10 Included → A = 160, B = 140 (V-32). _M4·P1·[SRC:blog-2026-07]_
- [ ] **AL-153** Strokes default for new frames — The default of `strokesIncludedInLayout` for frames created via Shift+A / the Frame tool / converting matches Figma. _Data:_ — _Test:_ create each way → read the value (V-24). _M4·P1·[DOC:360040451373 excerpt][OBS]_
- [ ] **AL-154** LEGACY stroke rules — Legacy frames lay out strokes per the rules measured in V-26 (child outside strokes counted when the parent is Included). _Data:_ `layoutVersion='LEGACY'` _Test:_ legacy fixture set from V-26. _M8·P2·[KNOW]_
- [ ] **AL-155** Layout version toggle — Settings show Layout: Updated/Legacy for frames and main components (not instances); switching is one undo step and may resize frames. _Data:_ `layoutVersion` _Test:_ legacy frame with padding exceeding size → Update → frame grows per floor (V-31). _M8·P1·[OBS][SRC:forum-56357]_
- [ ] **AL-156** Bulk version update — The Actions command "Update layout version for selection/page" updates all legacy frames in scope in one undo step. _Data:_ — _Test:_ page with 10 legacy frames → run → all Updated. _M8·P2·[SRC:blog-2026-07]_
- [ ] **AL-157** Instances follow main version — Instances use their main component's layout version and expose no toggle. _Data:_ — _Test:_ switch the main to Updated → instances re-lay out accordingly. _M5·P1·[SRC:blog-2026-07]_

### 6.14 Canvas stacking & clip content

- [ ] **AL-158** Last on top (default) — With `itemReverseZIndex=false`, later flow children paint above earlier ones. _Data:_ `itemReverseZIndex` _Test:_ F8 → C over B over A (pixel probe at the overlap). _M4·P0·[API][OBS][DOC:360040451373 excerpt]_
- [ ] **AL-159** First on top — With true, earlier children paint above later ones; `children` order and the layers panel are unchanged. _Data:_ — _Test:_ F8 + First on top → A over B over C; layers panel order identical. _M4·P1·[API][DOC:360040451373 excerpt]_
- [ ] **AL-160** Hit-testing follows paint order — Clicking an overlap selects the visually topmost child under both settings (V-20). _Data:_ — _Test:_ click the overlap in F8 under both settings → record the selected node. _M4·P1·[KNOW]_
- [ ] **AL-161** Stacking unavailable for grid — Whether the canvas stacking setting is offered for Grid frames matches Figma (reported missing 2026-03). _Data:_ — _Test:_ open settings on a grid → record (V-20). _M4·P2·[SRC:forum-grid-stacking]_
- [ ] **AL-162** Clip content — `clipsContent` clips overflowing flow children, negative-gap overflow and absolute children at the frame bounds. _Data:_ `clipsContent` _Test:_ child overflowing by 20 → hidden when on, visible when off. _M4·P0·[API][OBS]_
- [ ] **AL-163** Clip default on new auto layout frames — The clip content default for frames created by Shift+A and by Suggest auto layout matches Figma. _Data:_ — _Test:_ create → read clipsContent (V-27). _M4·P1·[KNOW]_
- [ ] **AL-164** Export honors stacking & clipping — PNG/SVG/PDF exports render overlaps in canvas-stacking order and apply clipping. _Data:_ — _Test:_ export F8 under both stacking settings → compare pixels with a Figma export. _M2·P1·[KNOW]_

### 6.15 Reordering & insertion

- [ ] **AL-165** Drag reorder with live reflow — Dragging a flow child within its parent shows a live placeholder (siblings reflow); drop commits the new index; one undo step. _Data:_ `children` order _Test:_ drag A past C in a row of A, B, C → B, C, A (V-22). _M4·P0·[KNOW]_
- [ ] **AL-166** Insertion index rule — The drop index is chosen by the pointer vs sibling midpoints on the main axis (for wrap: line first, then midpoint). _Data:_ — _Test:_ drop with the pointer at 49% vs 51% of a sibling → index before vs after (V-22). _M4·P0·[KNOW]_
- [ ] **AL-167** Drag in from outside — Dragging a layer over an auto layout frame shows an insertion indicator; drop inserts it at that index; Hug ancestors grow. _Data:_ — _Test:_ drag a rect between items 1 and 2 → index 1 (V-22). _M4·P0·[KNOW]_
- [ ] **AL-168** Drag out reparents — Dropping a flow child outside its parent's bounds moves it to the container under the pointer at the drop position. _Data:_ parent _Test:_ drag an item onto the empty canvas → becomes a page child at the drop position (V-22). _M4·P0·[KNOW]_
- [ ] **AL-169** Large-object safeguard — Dropping an object larger than the target auto layout frame does not insert it unless ⌘/Ctrl is held. _Data:_ — _Test:_ drag a 1000×1000 image over a 200×50 row → not inserted; with ⌘ → inserted. _M4·P1·[DOC:5731482952599 excerpt]_
- [ ] **AL-170** ⌘/Ctrl prevents nesting — Holding ⌘/Ctrl while dragging keeps the object in its current parent instead of nesting into the frame under the pointer. _Data:_ — _Test:_ ⌘-drag a page-level rect over an auto layout frame → parent stays the page (V-19). _M4·P1·[DOC:5731482952599 excerpt]_
- [ ] **AL-171** Arrow-key reorder — With a flow child selected, ←/→ (horizontal) or ↑/↓ (vertical) moves it by one position; no-op at the ends. _Data:_ — _Test:_ select B in A, B, C → → → A, C, B. _M4·P1·[SRC:uxdesign-tips][SRC:forum-23623]_
- [ ] **AL-172** Bracket-key reorder — `[` / `]` reorder flow children if, and only if, Figma does (V-23). _Data:_ — _Test:_ press ] with B selected → record. _M4·P2·[SRC:uxdesign-tips]_
- [ ] **AL-173** Layers panel reorder — Dragging rows in the layers panel within an auto layout parent reorders the flow; dragging across parents reparents. _Data:_ — _Test:_ drag row C above A in the panel → canvas order updates. _M4·P0·[KNOW]_
- [ ] **AL-174** Layers panel display order — The order in which an auto layout frame's children are listed matches Figma (z-order list vs flow order; V-25). _Data:_ — _Test:_ vertical A, B, C → screenshot the layers panel. _M4·P0·[KNOW]_
- [ ] **AL-175** Duplicate inserts after — ⌘D / Ctrl+D on a flow child inserts the copy right after it. _Data:_ — _Test:_ duplicate B in A, B, C → A, B, B′, C (V-23). _M4·P1·[KNOW]_
- [ ] **AL-176** Paste position — Paste into an auto layout frame inserts after the selected child, or at the end when the frame is selected (V-23). _Data:_ — _Test:_ copy X; select B; paste → A, B, X, C. _M4·P1·[KNOW]_
- [ ] **AL-177** Alt-drag duplicate — ⌥/Alt-drag of a flow child inserts the copy at the drop index and leaves the original. _Data:_ — _Test:_ ⌥-drag A to the end → A, B, C, A′ (V-22). _M4·P1·[KNOW]_
- [ ] **AL-178** Multi-child drag — Dragging several selected flow children moves them as a contiguous block, keeping their relative order. _Data:_ — _Test:_ select A and C, drag to the end → B, A, C (V-22). _M4·P1·[KNOW]_
- [ ] **AL-179** Group/frame selection in flow — ⌘G / ⌘⌥G on flow children creates the container at the flow slot recorded in V-23. _Data:_ — _Test:_ select B, C → ⌘G → record the index. _M4·P2·[KNOW]_
- [ ] **AL-180** No reorder in instances — Children of an instance cannot be reordered (drag, keys or layers panel). _Data:_ — _Test:_ attempt each method in an instance → order unchanged. _M5·P0·[DOC:31441443713047 excerpt]_

### 6.16 On-canvas handles

- [ ] **AL-181** Gap & padding handles on hover — Hovering a selected auto layout frame shows a handle per gap and per padding side. _Data:_ transient _Test:_ hover a 3-child row → 2 gap and 4 padding affordances. _M4·P0·[DOC:360040451373|31289464393751 excerpt]_
- [ ] **AL-182** Drag a gap handle — Dragging changes `itemSpacing` live; mouse-up commits one undo step. _Data:_ `itemSpacing` _Test:_ drag +20px → gap +20 (1:1 at 100% zoom; scaled by zoom). _M4·P0·[DOC excerpt][KNOW]_
- [ ] **AL-183** Drag a padding handle — Dragging changes that side's padding live; one undo step. _Data:_ `padding*` _Test:_ drag the left padding handle by 8 → paddingLeft +8. _M4·P0·[DOC excerpt]_
- [ ] **AL-184** Click a handle to type — Clicking a gap or padding handle opens an on-canvas numeric field; Enter commits. _Data:_ — _Test:_ click the gap handle, type 24 ↵ → gap 24. _M4·P1·[DOC excerpt]_
- [ ] **AL-185** Shift big-nudge — Shift while dragging a handle snaps to big-nudge increments (default 10). _Data:_ — _Test:_ ⇧-drag → values multiples of 10 (V-28). _M4·P1·[SRC:kinney]_
- [ ] **AL-186** Alt mirrors opposite side — ⌥/Alt while dragging a padding handle applies the same change to the opposite side. _Data:_ — _Test:_ ⌥-drag left +8 → left and right +8 (V-28). _M4·P1·[SRC:kinney][SRC:uxdesign-tricks]_
- [ ] **AL-187** Alt+Shift all sides — ⌥⇧ while dragging a padding handle changes all four sides equally. _Data:_ — _Test:_ ⌥⇧-drag → T=R=B=L (V-28). _M4·P1·[SRC:kinney][SRC:pixso]_
- [ ] **AL-188** Modifier-click padding selection — ⌥-click / ⇧⌥-click on the padding area target the pair / all sides for typing. _Data:_ — _Test:_ ⌥-click the left padding, type 20 → L=R=20 (V-28). _M4·P2·[SRC:kinney]_
- [ ] **AL-189** Row-gap & grid-gap handles — Wrap frames expose a handle for the counter-axis gap; grid frames expose row/column gap handles. _Data:_ `counterAxisSpacing`, `gridRowGap`, `gridColumnGap` _Test:_ hover a wrap/grid frame → drag the row gap handle (V-28). _M4·P1·[KNOW]_
- [ ] **AL-190** Handle limits — Dragging a gap handle below 0, or dragging it while the gap is Auto, behaves as Figma does (negative allowed? converts Auto to fixed?) (V-28). _Data:_ — _Test:_ drag the gap handle leftwards past 0; drag with Auto gap → record. _M4·P2·[KNOW]_

### 6.17 Nested layouts & propagation

- [ ] **AL-191** Nested frames have parent and child properties — A nested auto layout frame has its own padding/gap/flow and its own sizing in its parent. _Data:_ — _Test:_ vertical card containing a horizontal row; set the row Fill-W with its own gap 8. _M4·P0·[DOC:31441443713047 excerpt]_
- [ ] **AL-192** Upward propagation — A size change deep in the tree updates every content-dependent ancestor in the same transaction. _Data:_ — _Test:_ 4-level Hug nesting; change the leaf text → all 4 ancestors resize; one ⌘Z reverts all. _M4·P0·[API][KNOW]_
- [ ] **AL-193** Downward propagation — Resizing a Fixed ancestor re-resolves Fill descendants at every level. _Data:_ — _Test:_ root Fixed W=400 → Fill child → Fill grandchild; set root W=600 → both +200. _M4·P0·[KNOW]_
- [ ] **AL-194** Constraints inside Fill non-auto-layout frames — A non-auto-layout frame resized by auto layout (Fill) applies constraints to its own children. _Data:_ `constraints` _Test:_ Fill frame containing a Right-constrained icon → widen parent → icon stays right-aligned. _M4·P0·[API]_
- [ ] **AL-195** Convergence & idempotence — Layout reaches a fixed point in one pass; re-running layout or reopening changes nothing; no Hug/Fill oscillation. _Data:_ — _Test:_ randomized nested fixtures: layout ×2 → identical floats. _M4·P0·[SRC:old-notes][KNOW]_
- [ ] **AL-196** Mixed flows — Grid inside vertical, horizontal inside grid, and grid inside grid lay out per their own rules. _Data:_ — _Test:_ dashboard fixture with three nesting kinds → compare all child rects with Figma. _M4·P1·[DOC:31441443713047 excerpt]_
- [ ] **AL-197** Deep select in nested auto layout — ⌘/Ctrl-click selects the deepest layer inside nested auto layout frames. _Data:_ — _Test:_ ⌘-click a nested text → the text is selected. _M1·P1·[DOC:31441443713047 excerpt]_
- [ ] **AL-198** Interactive performance — Live reflow during drags (resize, handle drag, reorder) stays interactive on a 500-node nested auto layout tree. _Data:_ — _Test:_ Illigma benchmark ≥ 30 fps at 500 nodes (Illigma target; Figma is the qualitative reference). _M8·P1·[KNOW]_

### 6.18 Grid flow

- [ ] **AL-199** Create grid with UI defaults — Choosing Grid creates a grid whose container and tracks are Hug (UI default); API-created grids are Fixed with FLEX tracks. _Data:_ `layoutMode='GRID'`, `GridTrackSize` _Test:_ select Grid in the inspector → read track types/sizing via plugin. _M4·P0·[SRC:plugin-upd-120]_
- [ ] **AL-200** Grid picker — Rows/columns can be set by typing (with arithmetic) or by the interactive cell picker. _Data:_ `gridRowCount`, `gridColumnCount` _Test:_ type "2*3" in columns → 6; pick 3×4 in the picker → 3 rows, 4 columns. _M4·P1·[DOC:31289469907863 excerpt]_
- [ ] **AL-201** FIXED tracks — A FIXED track has exactly `value` px. _Data:_ — _Test:_ F22 third column = 100. _M4·P0·[API]_
- [ ] **AL-202** FLEX tracks — FLEX tracks share the remaining space proportionally to their fr values (default 1). _Data:_ — _Test:_ F21, F22. _M4·P0·[API]_
- [ ] **AL-203** HUG tracks — A HUG track is as large as its largest single-span item; multi-span shortfalls grow the spanned HUG tracks (V-35). _Data:_ — _Test:_ F23 → column 2 = 70. _M4·P0·[API][KNOW]_
- [ ] **AL-204** Hug grid container — A Hug grid's size = insets + Σ tracks + gaps; FLEX is not allowed on that axis. _Data:_ — _Test:_ F23 → W=220; try to set a FLEX column → refused/converted (V-34). _M4·P0·[API]_
- [ ] **AL-205** Row & column gaps — Independent, ≥0, placed only between tracks, bindable to variables. _Data:_ `gridRowGap`, `gridColumnGap` _Test:_ F21; bind the column gap to a variable → switch mode → layout updates. _M4·P0·[API]_
- [ ] **AL-206** One child per cell area — Children occupy non-overlapping areas; dropping onto an occupied cell does not overlap (swap or reject as Figma does, V-36). _Data:_ anchors/spans _Test:_ drag a child onto an occupied cell → record. _M4·P0·[API][SRC:nearform]_
- [ ] **AL-207** Child spans — A child can span multiple rows/columns; its area includes inner gaps; span edits that would overlap or exceed the bounds are refused. _Data:_ `gridRowSpan`, `gridColumnSpan` _Test:_ F24 → w=180; extend a span into an occupied cell → refused. _M4·P0·[API][DOC:31289469907863 excerpt]_
- [ ] **AL-208** Child Fill in grid — A Fill child fills its area on that axis (clamped by min/max). _Data:_ — _Test:_ F24. _M4·P0·[API][DOC:31289469907863 excerpt]_
- [ ] **AL-209** Child alignment in area — Fixed/Hug children are aligned in their area by `gridChildHorizontalAlign/VerticalAlign`; AUTO behaves as recorded in V-35. _Data:_ — _Test:_ 40×40 child in a 100×100 cell: MIN (0,0), CENTER (30,30), MAX (60,60). _M4·P0·[API]_
- [ ] **AL-210** First-available placement — Appending a child without coordinates places it into the first free cell in row-major order. _Data:_ — _Test:_ 3×3 grid with (0,0) and (0,1) filled → the new child goes to (0,2). _M4·P0·[API]_
- [ ] **AL-211** Auto rows — With `gridAutoTracks=ROWS`, rows are added as children overflow and removed when empty; the row count cannot be edited directly. _Data:_ `gridAutoTracks` _Test:_ 3 columns, append 7 children → 3 rows; delete the 7th child (row 3 becomes empty) → 2 rows. _M4·P0·[API][SRC:forum-54244]_
- [ ] **AL-212** Automatic placement — With `ROW_AUTO_FLOW`, children fill cells in layer order; deleting an item shifts the later items back to fill the gap; manual positioning is unavailable. _Data:_ `gridItemsPositioning` _Test:_ 2 columns, children a–e; delete b → c moves to (0,1). _M4·P0·[API][SRC:forum-54244]_
- [ ] **AL-213** Manual placement by drag — In MANUAL mode, dragging a child onto an empty cell moves its anchor there; cell highlight while dragging. _Data:_ anchors _Test:_ drag a child from (0,0) to (2,1) → anchors 2,1 (V-36). _M4·P1·[KNOW]_
- [ ] **AL-214** Lower count keeps objects — Reducing rows/columns in the picker keeps objects from removed tracks and moves them into the nearest cells (trimming multi-track footprints). _Data:_ — _Test:_ 3×3 with an item at (2,2) → set rows 2 → the item survives in the nearest free cell. _M4·P1·[DOC:31289469907863 excerpt]_
- [ ] **AL-215** Raise count adds tracks — Increasing rows/columns appends tracks of the type recorded in V-34 (API: FLEX). _Data:_ `GridTrackSize.type` _Test:_ 2→3 columns → read the new track type. _M4·P1·[API]_
- [ ] **AL-216** Delete track removes content — Deleting a row/column removes its contents; children spanning it are resized and moved to the closest available track. _Data:_ — _Test:_ delete column 1 of a 3-column grid with an item spanning columns 0–1 → the item spans 1 column. _M4·P1·[DOC:31289469907863 excerpt]_
- [ ] **AL-217** Track pills & reorder — Selected grid frames show track pills on the top/left edges with hover labels; dragging a pill's grabber reorders the track (blue line preview); spanned tracks move together. _Data:_ `reorderRows/Columns` semantics _Test:_ the API example: move row 0 to insertion index 3 → rows 1, 2, 0. _M4·P1·[DOC:31289469907863 excerpt][API]_
- [ ] **AL-218** Track sizing UI — Selecting a track lets the user set its type (Fixed/Hug/Flex) and value; Enter on a selected track edits its size (V-36). _Data:_ `GridTrackSize` _Test:_ select column 2 → set Fixed 120 → width 120. _M4·P1·[API][SRC:forum-40316]_
- [ ] **AL-219** Grid unsupported features — Wrap, Auto gap and baseline are not available in Grid; padding and canvas-stacking availability match V-34/V-20. _Data:_ — _Test:_ open the inspector and settings on a grid → record. _M4·P1·[API][KNOW]_
- [ ] **AL-220** Grid arrow-key reorder — Arrow keys on grid children behave as Figma does (not supported as of 2025) (V-36). _Data:_ — _Test:_ select a grid child, press → → record. _M4·P2·[SRC:forum-41164]_
- [ ] **AL-221** No GRID on slots — Setting GRID on a SLOT is refused (`cannotApplyGridToSlot`). _Data:_ — _Test:_ select a slot → Grid option disabled or errors. _M5·P1·[API]_
- [ ] **AL-222** CSS track strings on export — Exports to REST-shaped JSON include `gridRowsSizing/gridColumnsSizing` CSS strings derived from the tracks. _Data:_ REST fields _Test:_ compare with Figma REST output for the F22 grid (V-34). _M8·P2·[API REST]_

### 6.19 Components, instances, variables, slots

- [ ] **AL-223** Instances inherit layout — Instances inherit every auto layout property from their main component; changes on the main propagate to non-overridden instances. _Data:_ — _Test:_ change the main's gap 8→16 → all instances update. _M5·P0·[KNOW→V-38]_
- [ ] **AL-224** Instance layout overrides — Padding, gap, alignment and min/max can be overridden on an instance; overrides survive other main-component edits; "Reset" restores them. _Data:_ override table _Test:_ instance gap 24 override; change the main's padding → instance gap stays 24, padding updates (V-38). _M5·P0·[KNOW]_
- [ ] **AL-225** Instance sizing per instance — Each instance has its own Fixed/Hug/Fill sizing in its parent. _Data:_ `layoutSizing*` _Test:_ two instances in a list: one Fill-W, one Hug-W. _M5·P0·[KNOW]_
- [ ] **AL-226** Instance restrictions — On an instance the user cannot remove auto layout, change flow, toggle the layout version or reorder children. _Data:_ — _Test:_ try each → disabled (V-38). _M5·P1·[DOC:31441443713047 excerpt][SRC:blog-2026-07][KNOW]_
- [ ] **AL-227** Variant/swap reflow — Switching a variant or swapping a nested instance of a different size reflows the instance and its ancestors. _Data:_ — _Test:_ swap a 16px icon for a 24px icon in a Hug button → width +8. _M5·P0·[KNOW]_
- [ ] **AL-228** Detach keeps layout — Detaching an instance yields a frame with the same resolved auto layout settings. _Data:_ — _Test:_ detach → compare every field. _M5·P1·[KNOW]_
- [ ] **AL-229** Slots use stack auto layout — Slot nodes support horizontal/vertical auto layout and reflow when instance content is placed in them. _Data:_ `SLOT` _Test:_ place 3 items in a vertical slot → stacked with the slot's gap. _M5·P1·[API]_
- [ ] **AL-230** Component set auto layout — Component sets can use auto layout to arrange their variants. _Data:_ `COMPONENT_SET.layoutMode` _Test:_ apply Shift+A on a component set → variants arranged (V-38). _M5·P2·[API]_
- [ ] **AL-231** Variable-bound gap/padding mode switch — Changing a frame's variable mode re-runs layout using the mode's values. _Data:_ `boundVariables` _Test:_ spacing collection compact=8/comfortable=16 → switch mode on a parent → gaps update. _M6·P0·[API]_
- [ ] **AL-232** Binding implies fixed — Binding a variable to a gap disables Auto gap; binding to width/height sets Fixed on that axis (V-40). _Data:_ — _Test:_ bind width to a variable → sizing reads Fixed. _M6·P1·[KNOW]_

### 6.20 Undo, clipboard, import/export

- [ ] **AL-233** Atomic undo — Every auto layout action (property change, handle drag, reorder, add/remove, flow change, version update) undoes in one step, including all derived geometry; redo restores identical geometry. _Data:_ — _Test:_ for each action type: act → ⌘Z → full-document diff = 0 → ⇧⌘Z → diff vs post-action = 0 (V-39). _M4·P0·[KNOW]_
- [ ] **AL-234** Copy/paste preserves auto layout — Copying an auto layout frame (in Illigma, or to another Illigma doc) preserves all container/child fields, min/max and bindings. _Data:_ — _Test:_ paste the F1–F25 fixtures → identical fields and geometry. _M4·P0·[KNOW]_
- [ ] **AL-235** Paste former flow child into freeform — The child keeps its geometry; Fill/Hug relative to the old parent become Fixed in the UI. _Data:_ — _Test:_ copy a Fill child → paste into a freeform frame → W Fixed at the same size (V-23). _M4·P1·[KNOW]_
- [ ] **AL-236** Copy/paste properties — ⌘⌥C / ⌘⌥V transfer auto layout properties if, and only if, Figma does (V-39). _Data:_ — _Test:_ copy properties from an auto layout frame → paste onto a freeform frame → record. _M4·P2·[KNOW]_
- [ ] **AL-237** Export uses resolved geometry — Raster/SVG/PDF exports of auto layout frames match their on-canvas geometry exactly. _Data:_ — _Test:_ export F1, F15, F21 → pixel diff vs Figma export = 0 (antialiasing tolerance). _M2·P0·[KNOW]_
- [ ] **AL-238** Import maps legacy fields — Import maps deprecated `layoutAlign` MIN/CENTER/MAX, `horizontalPadding`/`verticalPadding`, and preserves unknown future enum values. _Data:_ — _Test:_ import a REST JSON fixture containing each → round-trip preserved. _M8·P1·[API]_
- [ ] **AL-239** Legacy version on import — Imported Figma frames keep their layout version (Legacy vs Updated) and are laid out accordingly. _Data:_ `layoutVersion` _Test:_ import a .fig containing both versions → geometry matches Figma within 0.01px. _M8·P2·[SRC:forum-56357]_

### 6.21 Numeric layout fixtures (algorithm contract, §3.22.8)

- [ ] **AL-240** Fixture F1 (mixed Fixed/Fill, padding, CENTER) — B.w=130; x = 10/70/210; y = 40/35/30. _Data:_ §3.22.8 _Test:_ build in Figma and Illigma; compare all child rects to ±0.01px. _M4·P0·[API][KNOW→V-41]_
- [ ] **AL-241** Fixtures F2–F6 (auto gap modes & overflow) — Positions exactly as tabulated. _Data:_ `SPACE_*` _Test:_ as F1. _M4·P0·[SRC:forum-57146][KNOW→V-41]_
- [ ] **AL-242** Fixtures F7–F8 (Hug, negative gap) — 140×64; W=130 with x = 0/40/80. _Data:_ — _Test:_ as F1. _M4·P0·[API][KNOW→V-41]_
- [ ] **AL-243** Fixtures F9–F11 (padding floor) — 60 / 80 / 60. _Data:_ — _Test:_ as F1 on Updated frames. _M4·P0·[DOC:42031586813719 excerpt]_
- [ ] **AL-244** Fixtures F12–F14 (flexible lengths) — 200/100; 50/250; 170/130. _Data:_ — _Test:_ as F1. _M4·P0·[SRC:blog-2026-07][KNOW→V-41]_
- [ ] **AL-245** Fixtures F15–F17 (wrap) — Rows [3,2], H=80; row-2 y=170; stretch lines 90. _Data:_ — _Test:_ as F1. _M4·P0·[API][KNOW→V-41]_
- [ ] **AL-246** Fixtures F18–F20 (counter Hug with Fill, hidden, absolute) — As tabulated. _Data:_ — _Test:_ as F1. _M4·P0·[KNOW→V-41]_
- [ ] **AL-247** Fixtures F21–F24 (grid) — As tabulated. _Data:_ — _Test:_ as F1. _M4·P0·[API][KNOW→V-41]_
- [ ] **AL-248** Fixture F25 & precision — 3 Fill children in W=100 → each 33.333…; stored values unrounded unless V-30 shows Figma rounds. _Data:_ — _Test:_ read child widths via plugin → record precision. _M4·P1·[KNOW→V-30]_
- [ ] **AL-249** Randomized differential suite — 200 randomized stack/wrap/grid fixtures generated from a seed are laid out in Illigma and in Figma (via plugin script) and agree to ±0.01px. _Data:_ — _Test:_ automated comparison harness (M0 test harness). _M4·P1·[KNOW]_

---

## 7. Cross-area dependencies

| Depends on / affects | What auto layout needs from it (or gives to it) | Area / spec |
| --- | --- | --- |
| Document model, transactions, undo/redo (M0) | Every layout pass runs inside the triggering transaction; geometry writes must be undoable atomically; derived geometry persisted (§2.8) | Foundation |
| Renderer (M0) | Paint order override for canvas stacking (`itemReverseZIndex`), clipping (`clipsContent`), no layout during paint | Foundation |
| File format & interop (M0/M8) | Persist all §2 fields + `layoutVersion`; REST/.fig import mapping (deprecated `layoutAlign`, paddings, unknown enums, `gridRowsSizing` strings) | `11-file-format-interop.md` |
| Canvas, selection, transforms, drag & drop (M1) | Resize handles (Hug/Fill → Fixed), double-click edge, reparenting drops, ⌘/⌃ drag modifiers, deep select, Enter/Shift+Enter, nudge = reorder for flow children, rotation bounding boxes | Core editing spec |
| Inspector / layers panel / shortcut registry (M0/M1) | Layout section, W/H dropdowns, alignment box keyboard focus (W/A/S/D/X/B), layers panel order & reorder, numeric fields with math & comma lists | `10-panels-shortcuts-workflow.md` |
| Constraints & layout guides (M4) | Constraints for absolute children and for children of non-AL frames resized by Fill; min/max disabling constraint options | Constraints / layout guides spec |
| Strokes & paints (M2) | `strokeAlign`, individual stroke weights for inside-stroke insets; export of resolved geometry | Vectors & paint spec |
| Text & typography (M3) | `textAutoResize` ⇄ Hug/Fill/Fixed, width-constrained height measurement, first-line baseline/ascent, leading trim, truncation/maxLines, font loading triggers relayout | `06-text-typography.md` |
| Components, instances, slots, variants (M5) | Override model for AL props, per-instance sizing, boolean-property visibility collapse, swap/variant reflow, slot nodes (no GRID), detach | Components spec |
| Variables & modes (M6) | Bindable fields (`itemSpacing`, paddings, `counterAxisSpacing`, min/max, width/height, `gridRowGap/ColumnGap`, `visible`); mode switch triggers relayout | `08-variables-styles-design-systems.md` |
| Prototyping (M7) | `overflowDirection` scrolling of AL frames with clipped overflow; smart-animate between layouts; variable changes at runtime re-layout | Prototyping spec |
| Export (M2/M8) | Raster/SVG/PDF from resolved geometry incl. stacking order | Export spec |
| Test harness (M0) | Differential fixture runner (Figma plugin script ↔ Illigma) for §3.22.8 and the randomized suite | Foundation |
| Performance hardening (M8) | Incremental dirty-subtree layout; interactive reflow during drags | Interop & hardening |

---

## 8. Needs live Figma verification

Each experiment: **Setup → Action → Record.** Run in Figma Design (desktop or browser, UI3), on a new file, at 100% zoom, both on a **new (Updated)** frame and — where marked ★ — on a **Legacy** frame (from a file created before 2026‑07‑24 or toggled to Legacy). Record numbers by reading values with a plugin console (`figma.currentPage.selection[0]`) as well as the inspector. Save screenshots of the inspector state.

1. **V-01 Containers.** Setup: section, group, rectangle, text, frame, component, instance, component set. Action: select each, inspect Layout section; press Shift+A. Record: whether flow controls exist; what Shift+A produces (wrap vs convert).
2. **V-02 Shift+A inference & defaults.** Setup: (a) 3 rects in a row spaced 16; (b) column spaced 10/20 unequal; (c) 2×3 lattice; (d) single text; (e) freeform frame 300×200 with children inset 20/30/20/30; (f) rects created right-to-left in time but arranged left-to-right. Action: Shift+A on each (selection of children for a–d,f; the frame for e). Record: flow, gap, each padding, W/H sizing modes, alignment, child order, wrapper name, clipsContent, strokesIncludedInLayout, z-slot of wrapper; also run "Add auto layout" from the context menu and Object menu; verify ⌥⇧A/Alt+Shift+A removes.
3. **V-03 Remove / Freeform round-trip.** Setup: AL frame with padding 24, gap 8, Fill child, Hug child, absolute child. Action: choose Freeform; then choose Vertical again; separately press ⌥⇧A. Record: every child's absolute rect before/after (expect unchanged), child sizing modes after, child constraints after, whether padding/gap are restored on re-enable, X/Y field state for flow children; drag a Fill child out of the frame → its sizing.
4. **V-04 Shift+A in context.** Setup: vertical list A–E. Action: select B,C → Shift+A; select the list → Shift+A; select a group → Shift+A. Record: hierarchy, indices, sizes.
5. **V-05 Direction switch.** Setup: vertical frame Fixed 300 wide, children: Fill-W/Hug-H text, Fixed rect, Hug AL child. Action: switch to Horizontal and back. Record: each child's `layoutSizingHorizontal/Vertical`, frame sizing, positions.
6. **V-06 Counter-axis Hug with Fill children.** Setup: vertical Hug-W frame; children A rect 120 wide Fixed, B rect. Action: set B Fill-W; then set A Fill-W; then set parent Hug-W again. Record: parent W sizing after each step; B width; whether children are demoted to Fixed. Repeat on primary axis.
7. **V-07 Group children.** Setup: group inside a vertical AL frame. Action: open W/H dropdown; try Fill; resize parent. Record: options; resulting group/child geometry.
8. **V-08 Resize conversions.** Setup: Hug×Hug AL frame; Fill child inside fixed parent; text child. Action: drag right edge; drag bottom edge; double-click right edge handle of a Fixed AL frame and of fixed text. Record: sizing mode per axis after each.
9. **V-09 Rotated children.** Setup: 100×20 rect rotated 90° and 30° in a Hug row. Action: observe; try Fill-W. Record: contributed width, Fill availability, resulting size.
10. **V-10 Negative free space with Fill.** Setup: Fixed W=100 row: Fixed 80, Fixed 80, Fill rect; then Fill AL frame with padding 10/10. Record: Fill widths/positions.
11. **V-11 Extreme negative gap.** Setup: Hug row of two 50 rects. Action: gap −40, −50, −80, −120. Record: frame W and child x each time; any clamping of gap value.
12. **V-12 Padding input limits.** Action: type −5, 0.5, 100000 into padding fields; drag handle past 0. Record: stored values.
13. **V-13 Auto gap details.** Setup: Fixed W=300 row of 3×50. Action: gap 24 → Auto → fixed (value restored?); Around/Evenly with 3×150 (overflow); Auto with Hug-W primary; Auto with one Fill child; open settings and record enabled state of the Between/Around/Evenly picker for: fixed gap, Auto gap, Hug primary, vertical+wrap (re-observe [OBS]); press X in the alignment box.
14. **V-14 Alignment details.** Action: with Auto gap, count alignment-box targets and click each; packed CENTER overflow (W=100, 80+80); Fill-H child with maxH 50 under CENTER; ⌥A/⌥D/⌥W with AL frame selected and with flow child selected. Record positions and property changes.
15. **V-15 Baseline.** Setup: horizontal frame: text 12px (1 line), text 32px (2 lines), 24×24 icon frame, nested AL with text, all baseline-aligned; reorder icon first/last. Record: each child's y and the first-line baseline y (compute from font metrics), frame Hug H; whether baseline is per line in wrap mode.
16. **V-16 Min/max semantics.** Action: min 150 & max 100 (order both ways); type W below min / above max on Fixed; drag below min on canvas; F12/F13 on Updated ★ and Legacy; constraint dropdown options of an absolute child with minW; Hug row exceeding maxW with clip on/off. Record all values.
17. **V-17 Wrap details.** Setup: F15 and variants. Action: exact-fit line (Σ+gaps = inner W exactly, also with decimals); Hug-W wrap without max; Hug-W with maxW; toggle Wrap on Hug-W frame (does W become Fixed?); row-gap field Auto → read `counterAxisAlignContent`; single line with SPACE_BETWEEN content; Fill children with min in wrap; Fill-cross children in mixed lines (line cross size); negative item gap with wrap; vertical wrap transposed fixture. Record breaks, positions, sizing modes.
18. **V-18 Text Fill.** Setup: Fixed W=300 row: avatar 40, gap 12, text Fill-W (long). Action: resize frame; set text Fill-H in a vertical frame. Record text W/H, `textAutoResize`, line count.
19. **V-19 Absolute details & modifiers.** Action: toggle Ignore auto layout on (record position, constraints, X/Y editability), toggle off for a child at index 0 drawn far right (record new index), change padding (absolute child moves?); on macOS: ⌃-drag, ⌘-drag into AL frame; on Windows: Ctrl-drag; large object drop with/without ⌘. Record resulting parent, `layoutPositioning`, position.
20. **V-20 Stacking & hit-testing.** Setup: F8. Action: click overlap under Last/First on top; add an absolute child overlapping; open settings on a grid frame. Record selected node, paint order, availability for grid.
21. **V-21 Hidden & transparent children.** Setup: F19. Action: hide B; set B opacity 0; hide via boolean component property. Record W and positions.
22. **V-22 Drag reorder & reparent.** Action: drag A to positions at 49%/51% of sibling widths; drag in from outside; drag out to canvas; ⌥-drag; multi-select drag; within wrap lines. Record live reflow behavior (video), final indices, sizing of moved children.
23. **V-23 Keyboard & clipboard insertion.** Action: arrow keys and `[`/`]` on a flow child (H and V frames, and grid); ⌘D; paste with child selected / with frame selected; ⌘G and ⌘⌥G on two flow children; paste a former Fill child into freeform frame. Record indices and sizing.
24. **V-24 Strokes default.** Action: create AL frames via Shift+A, via Frame tool + Vertical, via Suggest auto layout. Record `strokesIncludedInLayout` and the settings label.
25. **V-25 Layers panel order.** Setup: vertical A (top), B, C (bottom); horizontal A (left)…; First on top variant. Record panel order top→bottom vs `children` order.
26. **V-26 ★ Legacy rules.** Setup: Legacy frames: padding 30/30 with W=50 and a child; child with outside stroke 10 in Included/Excluded parent; parent inside/center/outside strokes Included; F14. Record all geometry; derive Legacy formulas.
27. **V-27 Clip default.** Action: Shift+A wrapper, Frame-tool frame + auto layout, Suggest auto layout output. Record `clipsContent`.
28. **V-28 Handles.** Action: drag gap/padding handles with Shift, ⌥, ⌥⇧; ⌥-click/⇧⌥-click; drag gap below 0; drag gap handle while Auto; wrap row-gap handle; grid gap handles; zoom 25%. Record values/increments and visibility.
29. **V-29 Empty Hug frame.** Action: delete all children of a Hug×Hug AL frame with padding 10 (Updated ★ and Legacy). Record frame size.
30. **V-30 Precision & rounding.** Setup: F25; F21; CENTER of 15 in 100. Record stored widths/positions via plugin (full float), inspector display; with "Snap to pixel grid" on/off.
31. **V-31 Layout version toggle.** Action: toggle Updated↔Legacy on a frame, a main component, an instance; run Actions "Update layout version for selection/page"; undo. Record availability, resize effects, undo granularity.
32. **V-32 ★ Updated Fill shares.** Setup: F14; two Fill AL frames, one with inside stroke 10 Included; vs Legacy. Record widths.
33. **V-33 Grid creation & conversion.** Action: choose Grid on a frame with 5 children (and on an empty frame); switch grid→vertical; read `gridAutoTracks`, `gridItemsPositioning`, track types, counts, container sizing. Record defaults and placement.
34. **V-34 Grid sizing edge cases.** Action: set container Hug when tracks are FLEX; add a column via picker (record new track type); padding fields on grid (present? honored?); read REST `gridColumnsSizing` string for F22 via REST API; read `primaryAxisSizingMode`/`counterAxisSizingMode` for a grid frame and grid children Fill. Record all.
35. **V-35 Grid child semantics.** Action: AUTO alignment of a 40×40 child in a 100×100 cell (and any container-level alignment control); hidden child + append (cell reuse?); multi-span item larger than two HUG tracks (distribution); FLEX tracks with content larger than share; Fill child in HUG track (contribution); span handles on canvas. Record geometry.
36. **V-36 Grid UI interactions.** Action: drag child onto empty and occupied cells (manual); select a track + Enter; track size type UI; arrow keys on grid child; min/max on grid container; delete track with spanning child. Record behavior.
37. **V-37 Suggest auto layout & vertical wrap.** Action: run ⌃⇧A on a card and a mobile screen fixture; check vertical flow shows Wrap; transpose F15. Record hierarchy and geometry.
38. **V-38 Instances & component sets.** Action: on an instance try: change gap/padding/alignment/flow/remove AL/reorder/layout version; change main gap and padding after instance overrides; Reset overrides; detach; Shift+A on a component set. Record allowed actions and propagation.
39. **V-39 Undo & property clipboard.** Action: for each action type in §3.21 perform, ⌘Z, ⇧⌘Z; ⌘⌥C/⌘⌥V from AL frame to freeform frame. Record undo step count and restored geometry, properties transferred.
40. **V-40 Variables.** Action: bind gap to a variable (Auto still allowed?); negative variable value on gap; bind width (sizing becomes?); bind padding and switch modes. Record.
41. **V-41 Numeric fixtures.** Action: build F1–F25 in Figma (Updated ★ and Legacy). Record all child rects (plugin script dump, full precision) and store as golden JSON in the Illigma test harness.

---

## 9. Sources

### 9.1 Official Figma Help Center articles (catalog retrieved 2026‑09‑27; **only search excerpts were seen in this session**)

| ID | Title (catalog) | URL |
| --- | --- | --- |
| 360040451373 | Guide to auto layout (search results also show it as "Explore auto layout properties") | https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout |
| 5731482952599 | Toggle on auto layout in designs (search title: "Add auto layout to a design") | https://help.figma.com/hc/en-us/articles/5731482952599-Toggle-on-auto-layout-in-designs |
| 31289464393751 | Use the horizontal and vertical flows in auto layout | https://help.figma.com/hc/en-us/articles/31289464393751-Use-the-horizontal-and-vertical-flows-in-auto-layout |
| 31289469907863 | Use the grid auto layout flow | https://help.figma.com/hc/en-us/articles/31289469907863-Use-the-grid-auto-layout-flow |
| 31441443713047 | Combine vertical, horizontal, and grid auto layout flows | https://help.figma.com/hc/en-us/articles/31441443713047-Combine-vertical-horizontal-and-grid-auto-layout-flows |
| 42031586813719 | Use auto layout with CSS Flexbox in mind | https://help.figma.com/hc/en-us/articles/42031586813719-Use-auto-layout-with-CSS-Flexbox-in-mind |
| 360039957734 | Apply constraints to define how layers resize (related; not read) | https://help.figma.com/hc/en-us/articles/360039957734 |
| 27378154668951 | Adjust text dimensions and resizing (related; not read) | https://help.figma.com/hc/en-us/articles/27378154668951 |

### 9.2 Typings (read directly in this session)

`@figma/plugin-typings` 1.141.0 — `refs/_figma_plugin-typings/package/plugin-api.d.ts`:
- `VariableBindableNodeField` L6910–6937 (incl. `itemSpacing`, paddings, min/max, `counterAxisSpacing`, `gridRowGap`, `gridColumnGap`, `visible`, `width`, `height`).
- `x`/`y` computed for AL children L7240–7253; `minWidth/maxWidth/minHeight/maxHeight` L7263–7278; `relativeTransform` AL note L7320–7322.
- `LayoutMixin` L7337; `layoutSizingHorizontal` L7357–7434 (HUG/FILL validity, examples); `layoutSizingVertical` L7436–7442; `resize`/`resizeWithoutConstraints` L7444–7471.
- `AspectRatioLockMixin.targetAspectRatio` L7487–7526 (Fill + locked ratio example; "defaults to Hug x Hug").
- `AutoLayoutMixin` L7636–8143: `layoutMode` L7686 (GRID not for slots L7648; NONE does not restore positions L7642–7644), paddings L7687–7708, `primaryAxisSizingMode` L7723, `counterAxisSizingMode` L7770, `strokesIncludedInLayout` L7811, `layoutWrap` L7821, `primaryAxisAlignItems` L7908 (SPACE_EVENLY/AROUND semantics L7824–7907), `counterAxisAlignItems` L7991 (BASELINE horizontal only), `counterAxisAlignContent` L7993–8002, `itemSpacing` L8054, `counterAxisSpacing` L8055–8102, `itemReverseZIndex` L8103–8142.
- `GridTrackSize` L8147–8160; `GridTrackReorderOptions/Entry` L8165–8204; `GridLayoutMixin` L8206–8460 (`gridRowCount` L8233, `gridColumnCount` L8241, `gridRowGap` L8247, `gridColumnGap` L8253, `gridRowSizes` L8284, `gridColumnSizes` L8292, `appendChildAt` L8329, `gridAutoTracks` L8363, `gridItemsPositioning` L8400, `reorderRows/Columns` L8445/L8459).
- `AutoLayoutChildrenMixin` L8464–8523 (`layoutAlign` L8478, `layoutGrow` L8488, `layoutPositioning` L8522); `GridChildrenMixin` L8527–8628.
- `InferredAutoLayoutResult` L8632; `BaseFrameMixin` (`clipsContent` L9414, `inferredAutoLayout` L9426); `TextNode.textAutoResize` L10977, `textTruncation` L10985, `maxLines` L10993; `SlotNode` L11259; `ChildrenMixin.appendChild/insertChild` AL notes L6990–7020.

`@figma/rest-api-spec` 0.44.0 — `refs/_figma_rest-api-spec/package/dist/api_types.ts`: bound variables L75–130; `HasLayoutTrait` layout fields L215–356 (`layoutSizing*`, `grid*` incl. `gridRowsSizing/gridColumnsSizing` CSS strings L311–319); `HasFramePropertiesTrait` L358–483 (`itemSpacing` "Can be negative" L447–452; `primaryAxisAlignItems` enum lacks `SPACE_EVENLY/AROUND` L416).

### 9.3 Live observation

- [OBS] `old/docs/figma/observations/2026-09-27-live-figma.md` — UI3 Layout section (Freeform; Vertical; Wrap control; W/H; nine-position alignment; gap; padding; Clip content) and layout settings (Inside stroke = Included; Canvas stacking = Last on top; Layout = Updated; baseline disabled; Auto spacing "Between" disabled).

### 9.4 Other sources (search excerpts only; keys used in tags)

| Key | Source |
| --- | --- |
| forum-56357 | Figma Forum product update "Design closer to CSS with the updated auto layout option" — https://forum.figma.com/product-updates-3/design-closer-to-css-with-the-updated-auto-layout-option-56357 |
| blog-2026-07 | Search-tool summary combining Figma forum posts (https://forum.figma.com/share-your-feedback-26/figma-autolayout-changes-57291, https://forum.figma.com/report-a-problem-6/adding-border-now-adds-pixel-56608) and an unnamed third-party blog: release 2026‑07‑24, toggle until 2027‑01‑24, instances can't toggle, Actions "Update layout version for selection/page", inside-only strokes, fill shares by content area. Individual sentence provenance not pinned. |
| forum-57146 | Figma Forum "Responsive spacing across design and CSS" (Around/Evenly) — https://forum.figma.com/product-updates-3/responsive-spacing-across-design-and-css-57146 |
| kusiima | https://www.kusiima.com/blog/figma-spacing-options-auto-layout-css (third-party, release timing) |
| forum-58389 | Figma Forum "Vertical wrap available in auto layout" (2026‑09‑25) — https://forum.figma.com/product-updates-3/vertical-wrap-available-in-auto-layout-58389 |
| forum-54244 | Figma Forum "Do more with grid" (Config 2026) — https://forum.figma.com/product-updates-3/do-more-with-grid-54244 |
| plugin-upd-120 | Figma Plugin API changelog "Version 1, Update 120" (2025‑11) — https://developers.figma.com/docs/plugins/updates/2025/11/06/version-1-update-120 |
| forum-40316 | "[Config 2025] Grid Auto Layout Flow — let's hear what you think!" — https://forum.figma.com/share-your-feedback-26/config-2025-grid-auto-layout-flow-let-s-hear-what-you-think-40316 |
| forum-40313 | "Auto layout grid column hug to content" — https://forum.figma.com/suggest-a-feature-11/auto-layout-grid-column-hug-to-content-40313 |
| forum-grid-gap-vars / forum-update | Figma forum update notes (grid gaps accept variables; picker shifts content on track removal), seen via search summary of grid threads above |
| forum-40352 | "No min/max width options for a frame with new grid auto layout" — https://forum.figma.com/share-your-feedback-26/no-min-max-width-options-for-a-frame-with-new-grid-auto-layout-40352 |
| forum-grid-stacking | 2026‑03 forum report "canvas stacking option missing for Auto Layout Grid" (seen via search summary) |
| forum-41164 | "Keyboard shortcuts for moving/shuffling items in grid layout" — https://forum.figma.com/suggest-a-feature-11/keyboard-shortcuts-for-moving-shuffling-items-in-grid-layout-41164 |
| forum-57215 | "Bug Report: Auto Layout Fill + min-width fails to distribute remaining space" — https://forum.figma.com/report-a-problem-6/bug-report-auto-layout-fill-min-width-fails-to-distribute-remaining-space-57215 |
| forum-20043 | "Left and right constraint disabled when min max width are set" — https://forum.figma.com/ask-the-community-7/left-and-right-constraint-disabled-when-min-max-width-are-set-20043 |
| forum-19030 | "Fill container option changes automatically into fixed width" — https://forum.figma.com/ask-the-community-7/fill-container-option-changes-automaticalli-into-fixed-width-why-19030 |
| forum-23826 | "Autolayout mistake while changing from vertical and horizontal" — https://forum.figma.com/suggest-a-feature-11/autolayout-mistake-while-changing-from-verticle-and-horizental-and-vice-versa-23826 |
| forum-58344 | "Why is there no fill container option when selecting child elements" — https://forum.figma.com/t/why-is-there-no-fill-container-option-when-selecting-child-elements/58344 |
| forum-28674 | "Inconsistent text baseline alignment in auto layout" — https://forum.figma.com/ask-the-community-7/inconsistent-text-baseline-alignment-in-auto-layout-28674 |
| forum-23623 | "Auto layout shortcuts" — https://forum.figma.com/suggest-a-feature-11/auto-layout-shortcuts-23623 |
| forum-remove-all | "Remove all auto layout" — https://forum.figma.com/t/remove-all-auto-layout/72009 |
| kinney | Steve Kinney, Figma course "Auto Layout" — https://stevekinney.com/courses/figma/auto-layout |
| uxdesign-tricks | "10 Auto Layout Tricks in Figma Every Designer Should Know" — https://uxdesign.cc/10-auto-layout-tricks-in-figma-every-designer-should-know-158cf1f87ef |
| uxdesign-tips | "10 Auto-Layout Tips in Figma" — https://uxdesign.cc/10-auto-layout-tips-in-figma-23f530c8098a |
| pixso | https://pixso.net/tips/figma-auto-layout/ |
| shortcut-guides | Third-party shortcut lists (e.g. https://www.skillademia.com/shortcuts/figma-shortcuts/, https://supercharge.design/articles/ultimate-guide-to-auto-layout-in-figma) |
| skillademia | https://www.skillademia.com/shortcuts/figma-shortcuts/ |
| nearform | "Figma's new Grid auto-layout: What it does (and doesn't yet do)" — https://nearform.com/digital-community/figmas-new-grid-auto-layout-what-it-does-and-doesnt-yet-do/ |
| old-notes | Previous Illigma prototype research note `old/docs/auto-layout-2026.md` and `old/docs/figma/feature-guide.md` (2026‑09‑27; they cite 42031586813719, forum 54244/57146/58389). Used as context only; claims re-tagged where independently corroborated. |

### 9.5 Research method & limits

- Typings were read directly (grep/sed). Help articles and forum posts were **not** fetchable (DNS-blocked); all their content here comes from WebSearch result excerpts (≈20 targeted queries) and is tagged accordingly.
- The shared WebSearch budget was exhausted before searches on: Shift+A defaults (padding/gap of wrappers), hidden-child behavior, rounding, counter-axis Auto gap, and negative gap limits. These remain [KNOW] and are listed in §8.
- No live Figma interaction, video, or full article body was consulted for this draft.
