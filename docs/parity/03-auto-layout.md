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
