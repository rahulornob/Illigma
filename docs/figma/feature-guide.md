# Figma feature language and behavior reference

This is an original implementation-oriented overview of the official documentation, not a replacement for reading the current feature article. **Reference behavior below describes Figma; the separate code map describes Illigma.** Implementation checks are proposed tests, not claims of live verification. See [coverage](README.md#reference-coverage) and the [complete article catalog](source-catalog.md).

## Translate informal requests

| User wording | Likely feature | Distinction to resolve |
| --- | --- | --- |
| Artboard, screen, container | Frame | Independent bounds, optional clipping, nested children; not an Illustrator artboard |
| Group these | Group | Bounds follow children; not automatically a frame or component |
| Page | File page | Separate canvas/tree inside a file; not a frame |
| Section | Canvas section | Organizes design areas; not the same as an auto-layout frame |
| Select inside, direct select | Deep selection or vector editing | Selecting a nested layer is different from editing its path anchors |
| Space between, tidy up | Smart selection or auto-layout gap | Arrangement of selected objects versus a persistent parent layout rule |
| Smart guide, snapping | Geometry alignment feedback | Different from saved ruler guides and layout guides |
| Grid | Pixel grid, layout guide, or auto-layout grid | Display aid, frame guide, or actual arrangement engine |
| Responsive, stretch | Constraints or Fill container | Depends on whether the parent is freeform or auto layout |
| Fit content | Hug contents, resize-to-fit, or text auto size | Continuous sizing rule versus one-time fit versus text box sizing |
| Clip, mask, crop | Frame clipping, mask, image crop | Different models and scopes |
| Scale, resize | Scale tool or dimension change | Proportional content/property scaling versus changing a box |
| Color popout | Fill/stroke color picker | Must retain the edited target and paint channel |
| Pick color | Eyedropper | Sampling color, applying a style/variable, and creating a variable differ |
| Reusable element | Component / instance | A linked definition, not a duplicate or group |
| State, variation | Variant or prototype state | Design configuration versus runtime interaction state |
| Theme, token | Variable / collection / mode | Values and bindings, not merely saved swatch colors |
| Shared design system | Library | Publication/subscription/update behavior beyond local assets |
| Animate | Prototype transition or Motion | Screen interaction versus timeline animation; confirm the intended product |
| Export | Asset export or editable document save | SVG/PNG/PDF output is not a restorable editor document |

## 1. Editor shell, files, and pages

Figma separates navigation, the page/layer tree, contextual properties, canvas, and tools. The right sidebar changes with selection, mode, and access. A file can contain multiple pages; pages organize independent canvas contents. Do not infer document structure from visible panel positioning. [Explore files](https://help.figma.com/hc/en-us/articles/15297425105303), [navigation](https://help.figma.com/hc/en-us/articles/360039831974), [properties](https://help.figma.com/hc/en-us/articles/360039832014).

**Implementation checks:** page switching preserves each page's objects and view state where designed; deleting/duplicating a page updates active selection; hidden/minimized UI does not change artwork; a property panel reflects the actual selected node. Preserve Illigma's explicitly chosen shell rather than copying every newly introduced Figma navigation item.

## 2. Frames, groups, sections, and hierarchy

Frames have their own dimensions and support nested content, clipping, layout, and other properties. Groups derive bounds from their contents. Sections organize canvas areas. Parent/child/sibling relationships describe containment; visual overlap alone is not a reliable persistent parent relationship. Reparenting changes hierarchy. [Frames](https://help.figma.com/hc/en-us/articles/360041539473), [frames versus groups](https://help.figma.com/hc/en-us/articles/360039832054), [relationships](https://help.figma.com/hc/en-us/articles/360039959014), [sections](https://help.figma.com/hc/en-us/articles/9771500257687).

**Implementation checks:** moving a container moves descendants once; changing group contents updates group bounds; reparenting preserves apparent world position when appropriate; cycles are rejected; frame clipping is local to its subtree. A frame's selection boundary must not collapse to its visible child artwork. Investigate default canvas reparenting and its modifiers live before matching it.

## 3. Selection and Layers panel

Canvas selection and layer-row selection are related but have different modifier rules. Figma supports nested selection, deep selection, a menu of layers under the pointer, marquee selection, and multiple selection. Enter descends into a selected hierarchy; Shift+Enter selects its parent. Layers-panel Shift selection covers a range; platform command/control selects individual rows. [Selection](https://help.figma.com/hc/en-us/articles/360040449873).

**Implementation checks:** explicitly test selection scope for root frames versus nested children; clicking a name versus an expand/visibility/lock control; overlapping paths with no fill; offscreen and clipped objects; modifier-click removal. Selection state, drawn bounds, and inspector target must agree. Root-frame multi-selection must not transform children twice.

Do not equate “cannot pick on the canvas” with “cannot inspect in the layer tree.” Locked parents affect descendants. Hidden layers remain document nodes. [Locking](https://help.figma.com/hc/en-us/articles/360041596573), [visibility](https://help.figma.com/hc/en-us/articles/360041112614). Current Illigma selection limitations are listed in the code map.

## 4. Position, resize, scale, align, and distribute

Position/dimension edits, alignment, distribution, tidy-up, and the Scale tool are separate operations. Scale preserves proportions and can affect content properties such as text size; resizing a container instead invokes its sizing/constraint rules. [Geometry controls](https://help.figma.com/hc/en-us/articles/360039956914), [Scale](https://help.figma.com/hc/en-us/articles/360040451453).

**Implementation checks:** different-sized objects, rotation, aspect lock, resize origin, negative positions, nested coordinate conversion, and undo. Alignment of one child relative to a parent differs from aligning several selected objects. Verify the chosen reference box rather than assuming it is always the page or union of bounds.

## 5. Smart selection and spacing

Smart selection works on arrangements of selected layers in one or two dimensions. It supports spacing adjustments and rearrangement without requiring a persistent auto-layout container. Auto layout, by contrast, continuously places children according to parent rules. [Smart selection](https://help.figma.com/hc/en-us/articles/360040450233).

**Implementation checks:** unequal object sizes; one row versus multiple rows; grouped units; duplicate/delete/reorder; negative deliberate overlap; objects in different parents. A temporary multi-selection gap field should not silently convert the selection to auto layout. Observe Figma's tidy-up and drag handles separately from basic distribution.

## 6. Constraints

Constraints govern how children respond to resizing a freeform parent frame. Each axis has edge, center, dual-edge, or proportional behavior. Auto-layout flow uses its own sizing rules. Groups need special treatment because their bounds derive from children. [Constraints](https://help.figma.com/hc/en-us/articles/360039957734), [constraints with layout guides](https://help.figma.com/hc/en-us/articles/360039957934).

**Implementation checks:** anchored offsets, opposite-edge stretching, proportional scaling, nested frames, minimum sizes, and resizing with constraints temporarily ignored. Test parent growth and shrinkage. Do not implement “responsive” solely as multiplying every child coordinate by the parent scale factor.

## 7. Auto layout

Auto layout combines flow, alignment, gap, padding, and per-axis sizing. Its parent and child settings interact: Fixed establishes a dimension, Hug follows content, and Fill consumes available parent space. Min/max constraints bound sizes; Ignore auto layout removes a child from normal flow. Nesting mixes horizontal, vertical, and grid arrangements. [Guide](https://help.figma.com/hc/en-us/articles/360040451373), [enable/remove](https://help.figma.com/hc/en-us/articles/5731482952599), [nested flows](https://help.figma.com/hc/en-us/articles/31441443713047).

Stack flow includes wrapping, alignment, explicit or automatic gaps, independent padding, baseline options, and overlap stacking settings. Grid has tracks, cells, spanning children, automatic placement, and per-track sizing. These are separate from visual layout guides. [Stacks](https://help.figma.com/hc/en-us/articles/31289464393751), [grid](https://help.figma.com/hc/en-us/articles/31289469907863).

Version matters. The July 2026 update changes padding floors, stroke participation, fill allocation, and automatic-gap edge cases. Record Updated versus Legacy from live settings before comparing old files. [2026 sizing](https://help.figma.com/hc/en-us/articles/42031586813719-Use-auto-layout-with-CSS-Flexbox-in-mind). Current Illigma coverage and remaining differences are in [the layout note](../auto-layout-2026.md).

**Implementation checks:** zero/one/many children, wrap in each direction, hidden/ignored children, mixed sizes, nested Fill/Hug, text wrapping, independent padding, limits, negative explicit gaps, grid spans/deletion/reordering, and resizing the parent. Repeated evaluation must converge rather than drift or resize a document during paint-only rendering.

## 8. Rulers, guides, snapping, measurements, and pixel view

Keep these concepts distinct:

| Feature | Purpose |
| --- | --- |
| Rulers | Show canvas/frame coordinates |
| Ruler guides | User-positioned alignment lines |
| Layout guides (formerly layout grids) | Frame-based uniform grids, rows, or columns |
| Smart/geometry guides | Temporary alignment feedback during manipulation |
| Pixel grid | Shows document pixel boundaries at high zoom |
| Snap to pixel grid | A placement rule, separate from displaying the grid |
| Pixel preview | Rasterized preview, distinct from vector rendering |
| Alt/Option measurement | Temporary distance inspection |

The current view guide describes pixel-grid visibility at 400% and above. Measurements use layer bounds, not necessarily stroke extents or glyph outlines. [View options](https://help.figma.com/hc/en-us/articles/360041065034), [ruler guides](https://help.figma.com/hc/en-us/articles/360040449713), [layout guides](https://help.figma.com/hc/en-us/articles/360040450513), [measurements](https://help.figma.com/hc/en-us/articles/360039956974).

**Implementation checks:** pan/zoom stability, one document pixel per cell, constant screen-sized labels, correct nested bounds, subpixel geometry, and temporarily disabling snapping. Illigma's requested integer-drag rule and `px` labels are project choices, not proof of universal Figma behavior.

## 9. Shapes, pen, and vector editing

Figma's vector networks support connected points and segments beyond a simple single-contour path. Shape tools retain special controls such as ellipse arcs and polygon/star parameters until converted. Vector edit mode, Bézier mirroring, shape building, outlining, flattening, offsetting, and simplifying have different effects on editability. [Networks](https://help.figma.com/hc/en-us/articles/360040450213), [editing](https://help.figma.com/hc/en-us/articles/360039957634), [shapes](https://help.figma.com/hc/en-us/articles/360040450133), [arc tool](https://help.figma.com/hc/en-us/articles/360040450173).

**Implementation checks:** open strokes remain selectable; click versus drag thresholds; tangent continuity; modifiers; closing a path; cancel/commit; rapid clicks; point deletion; hit tolerance under zoom; undo while a draft is active. Paper.js/SVG path data is not automatically a full vector-network model.

[Shape builder](https://help.figma.com/hc/en-us/articles/31616004109847), [outline stroke](https://help.figma.com/hc/en-us/articles/33052305733015), [text to paths](https://help.figma.com/hc/en-us/articles/360047239073), [flatten](https://help.figma.com/hc/en-us/articles/30101373312279), [offset](https://help.figma.com/hc/en-us/articles/33792861450263), and [simplify](https://help.figma.com/hc/en-us/articles/33792593975575) need separate contracts. Test whether source geometry remains editable after each operation.

## 10. Boolean operations and masks

Figma's Union, Subtract, Intersect, and Exclude create editable boolean groups. Their operands remain available; the current guide also discusses geometry derived from both fill and stroke. Flattening is a separate destructive conversion. [Booleans](https://help.figma.com/hc/en-us/articles/360039957534).

Masks conceal content non-destructively, with alpha, vector, and luminance interpretations. Their sibling order and parent boundary determine scope. Frame Clip content and image cropping are not substitutes for that model. [Masks](https://help.figma.com/hc/en-us/articles/360040450253).

**Implementation checks:** operand order, ungroup/edit after a boolean, empty intersection, stroke-only operands, mask scope, reordered siblings, opacity, nested clipping, and export. Illigma's Illustrator-style Pathfinder currently outputs paths; matching its final silhouette does not establish Figma boolean-group parity.

## 11. Text and fonts

Separate text content, typography, box dimensions, resizing mode, and scaling. Click-created and drag-created text can have different sizing defaults. Resizing a text box can reflow text without changing glyph size. Text editing should preserve selection, caret, and input behavior under canvas transforms. [Text guide](https://help.figma.com/hc/en-us/articles/360039956434), [dimensions/resizing](https://help.figma.com/hc/en-us/articles/27378154668951), [type properties](https://help.figma.com/hc/en-us/articles/360039956634).

Fonts involve family, style/weight, availability, fallback, variable axes, and OpenType features. Local-font access in Figma's browser may rely on its font service; Illigma's explicit font-file upload is a different mechanism. [Local fonts](https://help.figma.com/hc/en-us/articles/360039956894), [variable fonts](https://help.figma.com/hc/en-us/articles/5579502031511), [OpenType](https://help.figma.com/hc/en-us/articles/4913951097367).

**Implementation checks:** multiline editing, zoom/rotation, font loading failure, copy/paste, Enter/Escape semantics, auto width/height/fixed size, rich-text ranges, IME composition, RTL, mixed scripts, glyph fallback, and text export. Inspect Balance/Pretty, lists, links, text-on-path, and paragraph settings separately before claiming them. See the catalog's Text and typography section for all 14 articles.

## 12. Fills, stroke, color, images, and effects

A layer may have multiple paints, each with its own visibility and properties. Paint type, paint opacity, layer opacity, and blend mode are distinct. The color picker edits the active paint; an eyedropper may sample a raw color or associated reusable asset. [Fills](https://help.figma.com/hc/en-us/articles/360041003694), [picker](https://help.figma.com/hc/en-us/articles/360041003774), [eyedropper](https://help.figma.com/hc/en-us/articles/27643269375767), [color models](https://help.figma.com/hc/en-us/articles/360043042113).

Gradients contain stops and geometry. Images/video are paints rather than necessarily separate node types; image fill modes and cropping preserve the source asset. Pattern fills reference a source object. [Gradients](https://help.figma.com/hc/en-us/articles/34208860210199), [image properties](https://help.figma.com/hc/en-us/articles/360041098433), [crop](https://help.figma.com/hc/en-us/articles/360040675194), [patterns](https://help.figma.com/hc/en-us/articles/31616030150167).

Strokes involve placement, widths, sides, caps, joins, and advanced brush/width behavior. Radius and smoothing are not the same control. Effects are an ordered stack with effect-specific parameters; a background blur samples different content than a layer blur. [Strokes](https://help.figma.com/hc/en-us/articles/360049283914), [corners](https://help.figma.com/hc/en-us/articles/360050986854), [effects](https://help.figma.com/hc/en-us/articles/360041488473), [blend modes](https://help.figma.com/hc/en-us/articles/360040667874).

**Implementation checks:** opening/dismissing a popover without losing the target, Fill versus Stroke, mixed selections, alpha, disabled controls, paint/effect reorder, live preview versus history commit, hidden paints, export and reload. A screenshot of an effect is not proof of correct compositing.

## 13. Components, instances, variants, and slots

A main component defines reusable structure; an instance remains linked and supports overrides. Variants represent named configurations within a component set. Component properties expose selected editable aspects. Slots allow designated content areas to vary; they differ from swapping a single instance or choosing a variant. Detach removes linkage while retaining the current result. [Components](https://help.figma.com/hc/en-us/articles/360038662654), [properties](https://help.figma.com/hc/en-us/articles/5579474826519), [variants](https://help.figma.com/hc/en-us/articles/360056440594), [slots](https://help.figma.com/hc/en-us/articles/38231200344599), [differences](https://help.figma.com/hc/en-us/articles/38741465279895), [detach](https://help.figma.com/hc/en-us/articles/360038665754).

**Implementation checks:** definition updates propagate without overwriting valid overrides; reset and detach differ; nested instances retain identity; property types validate; variants have stable names/values; slot rules are enforced. A duplicate plus a purple icon is not a component system. Animated components and interactive variants require additional runtime models.

## 14. Styles, variables, modes, and libraries

Styles package reusable property combinations. Variables bind typed values and may reference other variables; collections organize them and modes supply contextual values. They are not interchangeable. Current documentation also includes timing/easing variables related to animation. [Styles](https://help.figma.com/hc/en-us/articles/360039238753), [variables overview](https://help.figma.com/hc/en-us/articles/14506821864087), [management](https://help.figma.com/hc/en-us/articles/15145852043927), [modes](https://help.figma.com/hc/en-us/articles/15343816063383).

Libraries make reusable assets available across files through publication and updates. Local definitions, published versions, enabled libraries, and accepted updates are different states. [Libraries](https://help.figma.com/hc/en-us/articles/360041051154), [publishing](https://help.figma.com/hc/en-us/articles/360025508373), [updates](https://help.figma.com/hc/en-us/articles/360039234193).

**Implementation checks:** stable IDs, type checking, alias cycles, mode inheritance, missing assets, override preservation, local versus remote updates, and migration. Saved swatches are not variable bindings. A shared library or permission-sensitive operation needs backend capability, not just a local modal.

## 15. Prototypes and interaction state

A prototype joins hotspots, triggers, actions, destinations, and animations into flows. Overlays, scroll behavior, state preservation, conditional actions, variables, and interactive components add runtime state. Smart Animate matches layers rather than merely crossfading two screenshots. [Prototyping](https://help.figma.com/hc/en-us/articles/360040314193), [triggers](https://help.figma.com/hc/en-us/articles/360040035834), [actions](https://help.figma.com/hc/en-us/articles/360040035874), [Smart Animate](https://help.figma.com/hc/en-us/articles/360039818874), [state](https://help.figma.com/hc/en-us/articles/14397859494295).

**Implementation checks:** distinct editing and playback modes; deterministic navigation history; matching nested layers; overlay dismissal; sticky/fixed/scrolling content; action ordering; variables and conditional branches; reset behavior; keyboard accessibility. A static Preview button is not a prototype engine. See all four prototype-related sections in the catalog for detailed flows, animation, media, mobile, and offline behavior.

## 16. Import, export, and clipboard

Editable document import/export differs from exporting selected artwork. Output format affects transparency, text, filters, rasterization, sizing, and compatibility. Export configurations can be attached to selections; slices define an export region. Copy/paste includes positioning, replacement, and property-only transfers. [Import guide](https://help.figma.com/hc/en-us/articles/360040027794), [export](https://help.figma.com/hc/en-us/articles/360040028114), [formats/settings](https://help.figma.com/hc/en-us/articles/13402894554519), [clipboard](https://help.figma.com/hc/en-us/articles/4409078832791), [property transfer](https://help.figma.com/hc/en-us/articles/4412765442967).

**Implementation checks:** export excludes editor overlays; clipping and transforms remain correct; font/assets are handled explicitly; imported IDs do not collide; malformed files cannot corrupt the current document; clipboard paste targets the intended page/parent. Do not claim native `.fig` interoperability because JSON save/reload exists.

## 17. Comments, multiplayer, history, and branching

Comments can be pinned, replied to, resolved, moved, and filtered. Multiplayer presence and following are separate from persistent document edits. Branches have independent changes, review, synchronization, conflict resolution, and merge behavior. These require shared state and permissions. [Comments](https://help.figma.com/hc/en-us/articles/360039825314), [following/spotlight](https://help.figma.com/hc/en-us/articles/360040322673), [branching](https://help.figma.com/hc/en-us/articles/360063144053).

**Implementation checks:** concurrency, access control, identity, ordered updates, reconnect, conflict semantics, and auditability. Local Undo is not collaborative history; copying a document is not a working branch/merge system. Keep these features marked unsupported until real behavior exists.

## 18. Draw, AI assistance, and neighboring products

Figma Draw adds illustration-oriented tools such as brushes and repeating transforms. Some operations generate a visual result without immediately creating independent duplicated nodes. [Draw](https://help.figma.com/hc/en-us/articles/31440394517143), [illustration tools](https://help.figma.com/hc/en-us/articles/31440438150935), [transforms](https://help.figma.com/hc/en-us/articles/31440427042839).

AI design assistance, code-to-design capture, library checks, and animation features also appear in the category. Their availability and external-service requirements are separate from implementing a local graphics editor. [AI tools](https://help.figma.com/hc/en-us/articles/23870272542231), [agent](https://help.figma.com/hc/en-us/articles/37998629035799), [capture](https://help.figma.com/hc/en-us/articles/40826832449303), [design checks](https://help.figma.com/hc/en-us/articles/39592284074263).

**Implementation checks:** know whether the user wants a drawing operation, an AI service, an asset/library check, or a different Figma product. Never present a decorative placeholder as a functioning service. Consult the full catalog for remaining article-level details rather than guessing from this overview.
