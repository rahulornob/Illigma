# Canvas interactions

Draft · 13 October 2026 · Phase 2 of the [design plan](PLAN.md) · Diagrams: Figma section "09 · Canvas interactions"

The canvas is the product (principle 3). These specs define how the canvas behaves so that a Figma user's hands already know it (principle 2). Rows marked **Illigma** are our own decision where Figma's exact behaviour is not documented or where we deliberately differ.

## Visual language on the canvas

| Element | Look | Token |
|---|---|---|
| Hover outline | 1 px outline, no handles | `accent/default` |
| Selection box | 1 px outline + 8 handles (8×8 white squares, 1 px blue stroke, radius 2) | `accent/default`, `selection/on` |
| Size label | Pill under the selection: "W × H" (**Illigma:** instances show "◇ Name · W × H") | `accent/default` fill, `accent/on` text |
| Component / instance selection | **Illigma:** same blue box (Figma uses purple); size label starts with ◇ | `accent/default` |
| Parent of selection | **Illigma:** 1 px dashed outline | `accent/default` at 50% |
| Smart guides and spacing | 1 px lines, distance pills | `guide/smart` |
| Auto layout padding / gap | Hatched or tinted areas on hover, drag handles | `guide/smart` at 16% |
| Text selection | Highlight behind text, 2 px caret | `accent/default` at 32%, `accent/default` |
| Marquee | 1 px outline + 8% fill | `accent/default` |
| Drop target (reparenting) | 2 px outline on the receiving frame | `accent/default` |

Overlays never scale with zoom: lines stay 1 px and handles stay 8 px on screen.

## 1. Selecting

| Action | Result |
|---|---|
| Click | Selects the top-most layer at that point **within the current context**. On a page, the context is the top-level frames' direct children. |
| Double-click | Enters the group or frame under the cursor and selects the child there. On text, starts editing. On a vector, enters vector edit mode. |
| ⌘-click | Deep select: selects the deepest layer under the cursor, ignoring groups and frames. |
| Shift-click | Adds or removes a layer from the selection. |
| Drag on empty canvas | Marquee. Selects layers that the marquee touches. ⌘ + drag also reaches inside frames. |
| Enter / Shift+Enter | Select children / select parent. |
| Esc | Deselects, or exits the current mode (text editing, vector edit, a tool). Use Shift+Enter to go to the parent. |
| ⌘A | Selects all layers in the current context. |
| Tab / Shift+Tab | Selects the next / previous sibling. |
| Right-click → Select layer | Lists every layer under the cursor (locked ones included) so a buried layer can be picked. |
| Locked or hidden layers | Cannot be selected on the canvas; select them in the layers panel. |
| Frame title on the canvas | Click selects the frame, drag moves it, double-click renames it. |
| Hover | Shows the hover outline on the layer a click would select. Hold ⌘ to preview the deep-select target. |

## 2. Moving and duplicating

| Action | Result |
|---|---|
| Drag a selection | Moves it. Smart guides appear (section 4). |
| Arrow keys | Nudge 1 px. Shift + arrow nudges by the "big nudge" preference (default 10 px, as in Figma). The 4 px grid rule is for Illigma's own UI, not the user's documents. |
| ⌥ + drag | Duplicates and moves the copy. |
| ⌘D | Duplicates. Top-level frames are placed to the right; inside auto layout the copy goes after the original; after "duplicate then move", the next ⌘D repeats that offset. |
| Drop onto a frame | The frame shows the drop-target outline and the layer becomes its child. Only layers smaller than the frame reparent. Hold Space to keep the current parent; hold ⌘ to drop a larger layer into auto layout. Inside auto layout, an insertion line shows the new position. |
| Align, distribute, flip, order | ⌥A/D/W/S (left/right/top/bottom), ⌥H/V (centres), Shift+H/V flip, ⌘] / ⌘[ bring forward / send backward. |
| Hold Space while drawing or resizing | Moves the shape being drawn instead of resizing it. |

## 3. Resizing and rotating

| Action | Result |
|---|---|
| Drag a corner or edge handle | Resizes. The size label updates live. |
| Shift | Keeps the aspect ratio. |
| ⌥ | Resizes from the centre. |
| Move just outside a corner | Rotate cursor. Drag rotates; Shift snaps to 15°. |
| Scale tool (K) | Scales strokes, effects and text with the object instead of only the box. |
| Corner radius handle | On frames and rectangles ≥ 32 px, a small dot inside each corner drags the radius. ⌥ drags one corner. |
| Resize in auto layout | Dragging the edge of a Hug or Fill child switches it to Fixed; the inspector shows the change. |

## 4. Smart guides, snapping and measuring

- While moving or resizing, edges and centres snap to nearby layers, the parent frame, layout guides and the pixel grid.
- Snap distance: 4 px on screen. Hold **Ctrl** to suspend snapping during a drag (as in Figma). Snapping toggles also live in the View menu and in ⌘K (principle 5).
- Matching edges show a 1 px `guide/smart` line across both layers.
- Equal spacing shows a pill with the gap value between each pair.
- Distances to nearby layers and the parent edge appear as pills when they snap.
- **Hold ⌥** with something selected and hover another layer to measure the distances between them. Nothing moves. ⌘⌥ measures to layers nested inside frames.

## 5. Auto layout on the canvas

| Action | Result |
|---|---|
| Select an auto-layout frame | Padding and gap areas appear on hover, tinted `guide/smart` at 16%, with values. |
| Drag a padding area | Changes that padding. ⌥ changes both sides, ⌥ + Shift changes all four. |
| Drag the gap area | Changes the gap. |
| Drag a child | Reorders it. An insertion line shows where it will land; other children move aside. |
| Click a padding or gap value | Types an exact value. |
| Double-click a child's edge | Sets that axis to Hug (⌥ + double-click sets Fill). |
| Arrow keys with a child selected | Reorder it within the auto-layout frame. |
| Shift + A | Adds auto layout to the selection (or wraps several layers in one auto-layout frame). |

## 6. Text

| Action | Result |
|---|---|
| T, then click | Creates an auto-width text layer and starts editing. |
| T, then drag | Creates a fixed-size text box. |
| Double-click or Enter on text | Edits. The caret and selection use `accent/default`. |
| Esc | Leaves editing and keeps the text layer selected. |
| Resize modes | Auto width, auto height or fixed, set in the text card. Dragging an edge sets Fixed; double-clicking the edge returns to Auto. |
| Clicking another text layer while editing | Keeps editing, in the clicked layer. |
| ⌘B / ⌘I / ⌘U, ⌘⇧> / ⌘⇧< | Bold, italic, underline, font size up / down. |
| Mixed styles | A partial selection shows "Mixed" in any field that differs. |

## 7. Pen and vector editing

| Action | Result |
|---|---|
| P, then click | Adds straight points. |
| Drag while placing a point | Pulls out Bézier handles. ⌥ breaks handle symmetry. |
| Click the first point | Closes the path. Enter or Esc finishes an open path. |
| Double-click a vector, or Enter | Vector edit mode: points, handles and segments are editable; vector networks allow branches. Several selected points get a bounding box. |
| Shift while drawing | Constrains the pen to 45°. Points snap to geometry. |
| ⌘ in vector edit mode | Bend tool: drag a segment to curve it. |
| Boolean operations | Union, subtract, intersect and exclude from the context bar, keeping the result editable. |

## 8. Frames, zoom and panning

| Action | Result |
|---|---|
| F, then drag | Draws a frame. Click alone creates a 100 × 100 frame. |
| F, then pick a preset | The inspector lists device sizes (phone, tablet, desktop, watch, paper). |
| Space + drag, or middle mouse | Pans. |
| Scroll / Shift + scroll | Pans vertically / horizontally. |
| ⌘ + scroll, pinch, Shift+= / Shift+− | Zooms around the cursor. Range 2% to 25,600%. |
| Shift + 0 / 1 / 2 | 100% / zoom to fit everything / zoom to the selection. |
| Zoom ≥ 400% | The pixel grid appears (toggle with ⌘'). Snap to pixel grid: ⇧⌘'. |
| Rulers and guides | ⇧R shows rulers; drag from a ruler to add a guide, drag it off to remove it. |
| ⌘⇧O / ⌘\\ | Outline view / hide the UI. |

## 9. Cross-cutting states

| State | Look |
|---|---|
| Hover | `bg/hover` on controls; hover outline on the canvas |
| Focus (keyboard) | 2 px `accent/default` ring, 2 px offset |
| Pressed | `bg/pressed` |
| Disabled | 40% opacity, no pointer events |
| Mixed value | The field shows "Mixed" in `text/tertiary` |
| Overridden (instance) | Blue dot before the property name; Reset in the card header |
| Bound to a variable | Field shows a variable chip with the ◇ hexagon icon |

## Open questions for testing (Phase 5)

1. Is Ctrl to suspend snapping discoverable enough, with the View menu toggle as backup?
2. Is the same blue for component selection clear enough without Figma's purple?
3. Floating vs docked panels while doing these interactions (Figma moved UI3 back to docked).
