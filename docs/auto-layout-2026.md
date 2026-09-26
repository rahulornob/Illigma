# Auto layout: 2026 research and implementation

Reviewed September 27, 2026. This is an independent implementation of documented behavior, not Figma source code or a claim of complete parity.

## Dated primary sources

| Date | Official source | Behavior used here |
| --- | --- | --- |
| May 22, 2026 | [Do more with grid](https://forum.figma.com/product-updates-3/do-more-with-grid-54244) | Automatic placement fills vacant cells; row count follows content. |
| July 2026 version | [Use auto layout with CSS Flexbox in mind](https://help.figma.com/hc/en-us/articles/42031586813719-Use-auto-layout-with-CSS-Flexbox-in-mind) | Padding establishes a minimum outer size. Fill distributes content space accounting for nested padding. Automatic gaps never become negative. A single Between child starts at the leading edge. |
| August 21, 2026 | [Responsive spacing across design and CSS](https://forum.figma.com/product-updates-3/responsive-spacing-across-design-and-css-57146) | Between distributes free space between children; Around includes half a gap at each edge; Evenly includes equal edge gaps. |
| September 25, 2026 | [Vertical wrap available in auto layout](https://forum.figma.com/product-updates-3/vertical-wrap-available-in-auto-layout-58389) | Vertical overflow wraps to additional columns. |

The July article explicitly identifies its July 2026 layout version. Undated general help pages were contextual reading, not evidence of a 2026 release. Search located 2026 video listings, but only metadata/descriptions were available; no claim is made to have watched them. Exhaustively reading or watching all internet material is not feasible.

## Implemented

- Horizontal, vertical, and grid flows. Wrapping is available in both stack directions; enabling it fixes the main axis so overflow has a boundary.
- Per-axis fixed, hug, and fill sizing; nested layout resolution runs after document changes, not during ordinary pointer rendering.
- Fill space redistribution with min/max constraints, including nested padding in outer sizes.
- Packed spacing (including deliberate negative gaps), Between, Around, and Evenly.
- Separate cross-axis gap, four independent padding values, and the existing nine-point alignment control.
- Grid columns, fractional/fixed/hug tracks, automatic rows and placement, child column/row spans. Track input examples: `120px 1fr 2fr`, `hug`. The last track definition repeats for additional tracks.
- Ignore auto layout preserves a child's position and excludes it from layout and hug calculations. Hidden children collapse out of the flow.
- Group members remain a single moving layout unit. Nested frames move their descendants together.
- Fill-width text wraps at its font size; hug text height and parent hug height respond to changed width.
- Setting a parent axis to hug resets direct fill children on that axis to fixed; setting a child to fill fixes its parent axis.
- Settings persist through document saving/reloading and participate in undo/redo. Disabling/re-enabling layout preserves configuration.

## How to use

Select objects and press Shift+A, or select a frame and use Auto layout +. In the right sidebar choose Flow and each axis's sizing. Set a fixed main-axis size before expecting wrapping or distributed spacing. Select a child to configure Fill, min/max sizes, Ignore auto layout, or grid spans. For grid, enter track sizes separated by spaces.

## Remaining differences

This is not all of Figma's auto-layout system. Canvas track/gap drag handles, manual cell placement, baseline alignment, stroke-alignment accounting, reverse overlap stacking, inference of complex layouts, and text Balance/Pretty are not implemented. Grid configuration currently uses inspector fields rather than on-canvas track controls. Group sizing controls do not expose a separate group container model. Rotated fill children use bounding-box resizing and can differ from Figma in edge cases. Wrap line breaking uses current child sizes, not a complete CSS intrinsic sizing implementation.

## Verification

`tests/autolayout.spec.js` checks geometry, edge cases, padding limits, automatic spacing, wrapping, constraints, and grid spans. Browser tests cover existing nesting/reordering/fill behavior plus the new sidebar controls, undo, persistence, and responsive text. Run `npm test` and `npm run build`.
