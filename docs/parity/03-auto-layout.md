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
  - Children "that should react to grid resizing need Fill on the relevant axis" [SRC:search excerpt of help].
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
    return insetSum(F, axis) + Σ L.map(lineCross) + rowGap(F) * (L.length - 1)
  }
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
  resolveFlexible(flex, free)              // §3.22.6. Sets ch.size[m] for Fill children.
  if (m === 'x') resolveCross(items, innerCross, F)                 // 2b: heights after widths

  // (3) Main positions
  const sum = Σ items.map(ch => ch.size[m])
  const [start, gap] = distribute(F.primaryAxisAlignItems, innerMain, sum, n, g)
  let p = inset(F, startSide(m)) + start
  for (const ch of items) { ch.pos[m] = p; p += ch.size[m] + gap }

  // (4) Cross positions
  const cs = inset(F, startSide(c))
  for (const ch of items) ch.pos[c] = cs + crossOffset(F.counterAxisAlignItems, innerCross, ch, items)

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

crossOffset(align, innerCross, ch, items) {
  const c = ch.size[crossAxisOfParent]
  switch (align) {
    case 'MIN':    return 0
    case 'CENTER': return (innerCross - c) / 2
    case 'MAX':    return innerCross - c
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
      ch.pos[c] = q + crossOffset(F.counterAxisAlignItems, lineCross[i], ch, line)   // per-line baseline
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
resolveFlexible(items, free) {           // items: { ch, base, min, max }
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
| Show shortcut list | ⌘⇧? | Ctrl+Shift+? | [SRC:search excerpt] |

**Conflict to resolve in V-19:** ⌃ (macOS) is documented for "drag in as Ignore auto layout", and ⌘ for "don't nest / override safeguard". On Windows both are documented as Ctrl. Record the actual Windows behavior.
