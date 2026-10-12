# Figma document model (Plugin API), REST API, and keyboard shortcuts

Ground truth for Parts A–B: `@figma/plugin-typings` v1.141.0 (`plugin-api.d.ts`, 12,854 lines, downloaded 2026-10-12) and Figma's REST OpenAPI spec v0.44.0 (github.com/figma/rest-api-spec). Part C: Figma Help Center articles plus reproductions of the in-app shortcuts panel.

## A1. Node types (document tree)

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| DocumentNode (DOCUMENT) | Root of a file; children are pages; carries documentColorProfile LEGACY \| SRGB \| DISPLAY_P3 | P0 | [DocumentNode](https://developers.figma.com/docs/plugins/api/DocumentNode/) |
| PageNode (PAGE) | Canvas page: children, selection, guides, backgrounds, flow starting points, prototype start node | P0 | [PageNode](https://developers.figma.com/docs/plugins/api/PageNode/) |
| PageNode: page divider | Page can be a divider (isPageDivider); created via createPageDivider(name) | P1 | [PageNode](https://developers.figma.com/docs/plugins/api/PageNode/) |
| PageNode: prototype backgrounds | Separate prototypeBackgrounds paints used in prototype player | P1 | [PageNode](https://developers.figma.com/docs/plugins/api/PageNode/) |
| PageNode: selectedTextRange | Current text caret/selection range {node,start,end} is document state | P0 | [PageNode](https://developers.figma.com/docs/plugins/api/PageNode/) |
| PageNode: focusedNode / focusedSlide | Page tracks a focused node (single-asset view) and focused slide | P2 | [PageNode](https://developers.figma.com/docs/plugins/api/PageNode/) |
| PageNode: lazy loading | Pages load on demand (loadAsync, loadAllPagesAsync) for large files | P1 | [PageNode](https://developers.figma.com/docs/plugins/api/PageNode/) |
| FrameNode (FRAME) | Container with fills, strokes, corners, clipping, auto layout, grid layout, layout grids, guides, prototyping | P0 | [FrameNode](https://developers.figma.com/docs/plugins/api/FrameNode/) |
| GroupNode (GROUP) | Bounds-derived container; blend, effects, mask, export; no fills/strokes of its own | P0 | [GroupNode](https://developers.figma.com/docs/plugins/api/GroupNode/) |
| TransformGroupNode (TRANSFORM_GROUP) | Group with transformModifiers (linear or radial repeat) generating repeated copies | P2 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| SectionNode (SECTION) | Canvas organizer with fills, strokes, corner radii, contentsHidden, devStatus; resizes without constraints | P0 | [SectionNode](https://developers.figma.com/docs/plugins/api/SectionNode/) |
| SliceNode (SLICE) | Invisible export region with position/size and exportSettings | P1 | [SliceNode](https://developers.figma.com/docs/plugins/api/SliceNode/) |
| RectangleNode (RECTANGLE) | Shape with per-corner radii, corner smoothing, individual stroke weights | P0 | [RectangleNode](https://developers.figma.com/docs/plugins/api/RectangleNode/) |
| LineNode (LINE) | Straight line shape; stroke caps apply; height is 0 | P0 | [LineNode](https://developers.figma.com/docs/plugins/api/LineNode/) |
| EllipseNode (ELLIPSE) | Ellipse with arcData (startingAngle, endingAngle, innerRadius) for arcs, pies, donuts | P0 | [EllipseNode](https://developers.figma.com/docs/plugins/api/EllipseNode/) |
| PolygonNode (POLYGON) | Regular polygon with pointCount and corner radius | P0 | [PolygonNode](https://developers.figma.com/docs/plugins/api/PolygonNode/) |
| StarNode (STAR) | Star with pointCount and innerRadius ratio | P0 | [StarNode](https://developers.figma.com/docs/plugins/api/StarNode/) |
| VectorNode (VECTOR) | Arbitrary vector network (vertices, segments, regions) or vector paths | P0 | [VectorNode](https://developers.figma.com/docs/plugins/api/VectorNode/) |
| BooleanOperationNode (BOOLEAN_OPERATION) | Live boolean of children: UNION, INTERSECT, SUBTRACT, EXCLUDE | P0 | [BooleanOperationNode](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/) |
| TextNode (TEXT) | Rich text layer with per-range styling, auto-resize, truncation, lists, links | P0 | [TextNode](https://developers.figma.com/docs/plugins/api/TextNode/) |
| TextPathNode (TEXT_PATH) | Text laid along a vector path; textPathStartData {segment, position} | P2 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| ComponentNode (COMPONENT) | Main component: frame plus publishable metadata, properties, instances list, createInstance, createSlot | P0 | [ComponentNode](https://developers.figma.com/docs/plugins/api/ComponentNode/) |
| ComponentSetNode (COMPONENT_SET) | Variant container; defaultVariant, variantGroupProperties {prop: values[]} | P0 | [ComponentSetNode](https://developers.figma.com/docs/plugins/api/ComponentSetNode/) |
| InstanceNode (INSTANCE) | Instance of component: overrides, componentProperties, swap, detach, scaleFactor, exposed instances | P0 | [InstanceNode](https://developers.figma.com/docs/plugins/api/InstanceNode/) |
| SlotNode (SLOT) | Frame inside a component that instances fill with content; resetSlot, limitViolations | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| SlotNode: limit violations | Reports BELOW_MIN, ABOVE_MAX, HAS_NON_PREFERRED against slot settings | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| MediaNode (MEDIA) | GIF/media layer referenced by hash (createGif) | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| EmbedNode (EMBED) | Embedded URL content: srcUrl, canonicalUrl, title, description, provider | Module | [EmbedNode](https://developers.figma.com/docs/plugins/api/EmbedNode/) |
| LinkUnfurlNode (LINK_UNFURL) | Link preview card: url, title, description, provider | Module | [LinkUnfurlNode](https://developers.figma.com/docs/plugins/api/LinkUnfurlNode/) |
| WidgetNode (WIDGET) | Interactive widget instance with synced state/maps; cloneWidget | P2 | [WidgetNode](https://developers.figma.com/docs/plugins/api/WidgetNode/) |
| StickyNode (STICKY) | FigJam sticky note: text sublayer, author name/visibility, wide width | Module | [StickyNode](https://developers.figma.com/docs/plugins/api/StickyNode/) |
| ConnectorNode (CONNECTOR) | FigJam connector: ELBOWED/STRAIGHT/CURVED, endpoints with magnets, caps, label text | Module | [ConnectorNode](https://developers.figma.com/docs/plugins/api/ConnectorNode/) |
| ShapeWithTextNode (SHAPE_WITH_TEXT) | FigJam diagram shape with text; 30 shapeType values | Module | [ShapeWithTextNode](https://developers.figma.com/docs/plugins/api/ShapeWithTextNode/) |
| CodeBlockNode (CODE_BLOCK) | Code block with code and codeLanguage (17 languages incl. DART) | Module | [CodeBlockNode](https://developers.figma.com/docs/plugins/api/CodeBlockNode/) |
| StampNode (STAMP) | FigJam stamp stuck to nodes; getAuthorAsync | Module | [StampNode](https://developers.figma.com/docs/plugins/api/StampNode/) |
| HighlightNode (HIGHLIGHT) | FigJam marker/highlighter vector stroke, stickable | Module | [HighlightNode](https://developers.figma.com/docs/plugins/api/HighlightNode/) |
| WashiTapeNode (WASHI_TAPE) | FigJam washi tape decorative shape, stickable | Module | [WashiTapeNode](https://developers.figma.com/docs/plugins/api/WashiTapeNode/) |
| TableNode (TABLE) | Table with rows/columns: insert, remove, move, resize rows/columns; cellAt | Module | [TableNode](https://developers.figma.com/docs/plugins/api/TableNode/) |
| TableCellNode (TABLE_CELL) | Cell with text sublayer, fills, row/column index | Module | [TableCellNode](https://developers.figma.com/docs/plugins/api/TableCellNode/) |
| SlideNode (SLIDE) | Slides deck slide (frame-like); slide transition, isSkippedSlide | Module | [SlideNode](https://developers.figma.com/docs/plugins/api/SlideNode/) |
| SlideRowNode / SlideGridNode | Slide grid rows and grid containers for deck layout | Module | [SlideRowNode](https://developers.figma.com/docs/plugins/api/SlideRowNode/) |
| InteractiveSlideElementNode | Slide element: POLL, EMBED, FACEPILE, ALIGNMENT, YOUTUBE | Module | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| TextSublayerNode / LabelSublayerNode | Text and label sublayers owned by stickies, shapes, connectors, table cells | Module | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| RemovedNode | Tombstone {removed:true,type,id} reported in delete change events | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |

## A2. Base and scene node properties (all nodes)

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Node: id | Stable unique node ID string | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Node: name | Editable layer name | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Node: parent / removed | Parent pointer; removed flag after deletion | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Node: remove() | Deletes node from document | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Node: clone() | Duplicates node (and subtree) | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Node: visible | Show/hide layer | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Node: locked | Lock layer against canvas selection/edits | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Node: expanded | Layers-panel expansion state stored per container | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Node: isAsset | Flags nodes considered assets (icons/images) | P2 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Node: getCSSAsync | Returns CSS properties map for a node (Dev Mode code) | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Node: getTopLevelFrame | Returns enclosing top-level frame | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Node: plugin data | Private per-plugin key/value string storage on any node | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Node: shared plugin data | Namespaced key/value storage readable by other plugins | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Node: relaunch data | Per-node relaunch buttons {command: description} shown in UI | P2 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Node: dev resources | Attach/edit/delete links (name,url) per node; preview text; includeChildren query | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Node: devStatus | Frames/sections marked READY_FOR_DEV or COMPLETED with description | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Node: componentPropertyReferences | Binds visible, characters, mainComponent to component properties | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Node: boundVariables | Map of node fields to variable aliases (plus fills/strokes/effects/grids/text ranges) | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Node: setBoundVariable | Binds/unbinds a variable to a node or text field | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Node: inferredVariables | Suggests variables matching current raw values | P2 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Node: explicitVariableModes | Per-node/page mode override per collection; set/clear functions | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Node: resolvedVariableModes | Effective mode per collection after inheritance | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Node: stuckNodes / attachedConnectors | Lists stamps/widgets stuck to node and connectors attached | Module | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Node: stuckTo (StickableMixin) | Stamp/highlight/widget attachment target | Module | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Children: appendChild / insertChild | Reparent node at end or index (z-order) | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Children: find APIs | findChild(ren), findOne, findAll, findAllWithCriteria (types, pluginData keys) | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Children: findWidgetNodesByWidgetId | Finds widget instances by widget ID | P2 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Annotations (AnnotationsMixin) | Nodes carry annotations: label, labelMarkdown, pinned properties, categoryId | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Annotations: pinnable properties | 33 types: width/height/min/max, fills, strokes, effects, typography, spacing, padding, grid props, mainComponent | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Annotation categories | Label + color (yellow, orange, red, pink, violet, blue, teal, green); presets; add/remove | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Measurements (page) | Persistent measurement between node sides (TOP/RIGHT/BOTTOM/LEFT); offset INNER/OUTER; freeText | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |

## A3. Geometry, transform, sizing, constraints

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Position: x / y | Position relative to parent | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Size: width / height | Read-only size; changed via resize / resizeWithoutConstraints / rescale | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Size: min/max width and height | minWidth, maxWidth, minHeight, maxHeight (nullable) limits | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Transform: relativeTransform | 2x3 affine matrix relative to parent (rotation, skew, flip) | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Transform: absoluteTransform | Read-only page-space matrix | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Bounds: absoluteBoundingBox | Page-space bounding box excluding effects | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Bounds: absoluteRenderBounds | Visible bounds including strokes, shadows, blurs | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Rotation | Degrees, -180..180 | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| rescale(scale) | Scale node including strokes, effects, text (scale tool) | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| constrainProportions | Legacy proportional-resize flag | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Aspect ratio lock | targetAspectRatio; lockAspectRatio / unlockAspectRatio | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Constraints | horizontal and vertical ConstraintType: MIN, CENTER, MAX, STRETCH, SCALE | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Layout sizing (horizontal/vertical) | FIXED, HUG, FILL per axis | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Frame: clipsContent | Clip children to frame bounds | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Frame: detachedInfo | Records origin component (local id or library key) after detach | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Ruler guides | Guide {axis X\|Y, offset} on pages and frames | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |

## A4. Auto layout and grid layout

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Auto layout: layoutMode | NONE, HORIZONTAL, VERTICAL, GRID | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Auto layout: padding | paddingLeft/Right/Top/Bottom plus horizontalPadding/verticalPadding shorthands | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Auto layout: itemSpacing | Gap between children on primary axis | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Auto layout: counterAxisSpacing | Gap between wrapped rows/columns (nullable = same as itemSpacing) | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Auto layout: layoutWrap | NO_WRAP or WRAP | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Auto layout: primaryAxisAlignItems | MIN, MAX, CENTER, SPACE_BETWEEN, SPACE_EVENLY, SPACE_AROUND | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Auto layout: counterAxisAlignItems | MIN, MAX, CENTER, BASELINE (text baseline alignment) | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Auto layout: counterAxisAlignContent | AUTO or SPACE_BETWEEN for wrapped tracks | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Auto layout: sizing modes | primaryAxisSizingMode / counterAxisSizingMode FIXED or AUTO (hug) | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Auto layout: strokesIncludedInLayout | Whether stroke width counts in layout (border-box) | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Auto layout: itemReverseZIndex | Earlier children stack on top (reverse canvas stacking) | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Auto layout child: layoutAlign | MIN, CENTER, MAX, STRETCH, INHERIT (legacy per-child alignment) | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Auto layout child: layoutGrow | 0 or 1 to fill primary axis | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Auto layout child: layoutPositioning | AUTO or ABSOLUTE (ignore auto layout) | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Inferred auto layout | inferredAutoLayout suggests auto layout settings for non-AL frames | P2 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Grid layout: rows/columns count | gridRowCount, gridColumnCount | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Grid layout: gaps | gridRowGap, gridColumnGap | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Grid layout: track sizes | gridRowSizes/gridColumnSizes each FLEX, FIXED, or HUG with value | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Grid layout: auto tracks | gridAutoTracks NONE or ROWS (add rows automatically) | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Grid layout: item positioning | gridItemsPositioning MANUAL or ROW_AUTO_FLOW | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Grid layout: reorder tracks | reorderRows / reorderColumns move tracks and report mapping | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Grid layout: appendChildAt | Insert child at row/column cell | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Grid child: anchor and span | Row/column anchor index; gridRowSpan, gridColumnSpan; setGridChildPosition | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Grid child: alignment | gridChildHorizontalAlign / VerticalAlign MIN, CENTER, MAX, AUTO | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |

## A5. Layout grids (column/row/grid overlays)

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Layout grid: GRID pattern | Uniform square grid with sectionSize, color, visibility | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Layout grid: ROWS/COLUMNS pattern | count, gutterSize, sectionSize, offset, color, visible | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Layout grid: alignment | MIN, MAX, STRETCH, CENTER | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Layout grid: variable binding | sectionSize, count, offset, gutterSize bindable to number variables | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Layout grid: style | gridStyleId links frame grids to a GRID style | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |

## A6. Fills and paints

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Fills: paint stack | Ordered array of Paint; can be mixed across text ranges | P0 | [Paint](https://developers.figma.com/docs/plugins/api/Paint/) |
| Paint: common fields | visible, opacity, blendMode per paint | P0 | [Paint](https://developers.figma.com/docs/plugins/api/Paint/) |
| Paint: SOLID | RGB color plus opacity; color bindable to variable | P0 | [Paint](https://developers.figma.com/docs/plugins/api/Paint/) |
| Paint: GRADIENT_LINEAR | Linear gradient via gradientTransform and color stops | P0 | [Paint](https://developers.figma.com/docs/plugins/api/Paint/) |
| Paint: GRADIENT_RADIAL | Radial gradient | P0 | [Paint](https://developers.figma.com/docs/plugins/api/Paint/) |
| Paint: GRADIENT_ANGULAR | Angular (conic) gradient | P0 | [Paint](https://developers.figma.com/docs/plugins/api/Paint/) |
| Paint: GRADIENT_DIAMOND | Diamond gradient | P0 | [Paint](https://developers.figma.com/docs/plugins/api/Paint/) |
| Gradient: color stops | Position 0..1 plus RGBA; stop color bindable to variable | P0 | [Paint](https://developers.figma.com/docs/plugins/api/Paint/) |
| Paint: IMAGE | Image by hash; scaleMode FILL, FIT, CROP, TILE; imageTransform; scalingFactor; rotation | P0 | [Paint](https://developers.figma.com/docs/plugins/api/Paint/) |
| Image filters | exposure, contrast, saturation, temperature, tint, highlights, shadows | P0 | [Paint](https://developers.figma.com/docs/plugins/api/Paint/) |
| Paint: VIDEO | Video fill by hash with same scale modes, transform, filters | P1 | [Paint](https://developers.figma.com/docs/plugins/api/Paint/) |
| Paint: PATTERN | Tiles a source node; tileType RECTANGULAR, HORIZONTAL_HEXAGONAL, VERTICAL_HEXAGONAL; spacing; alignment START/CENTER/END | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Paint: SHADER | Procedural shader fill by id with typed properties | P2 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Shader property types | BOOLEAN, TEXT, NUMBER, IMAGE, INSTANCE_SWAP, SLOT, COLOR, POINT, LINE, CIRCLE, CIRCLE_POINT, COLOR_POINT, GRADIENT | P2 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Shaders: library | listAvailableShaders, importShaderById; shader type effect or fill | P2 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Fill style link | fillStyleId; setFillStyleIdAsync | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Selection colors | getSelectionColors returns paints and paint styles in selection | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Images: store | createImage(bytes), createImageAsync(url), getImageByHash; getBytesAsync, getSizeAsync | P0 | [Image](https://developers.figma.com/docs/plugins/api/Image/) |
| Videos: store | createVideoAsync(bytes) returns Video hash | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Frame backgrounds (deprecated) | backgrounds / backgroundStyleId aliases for frame fills | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Color model | RGB/RGBA floats 0..1; util.rgb/rgba/solidPaint parse CSS color strings | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Document color profile | LEGACY, SRGB, DISPLAY_P3 per document | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |

## A7. Strokes

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Strokes: paint stack | Ordered Paint array for strokes; strokeStyleId | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Stroke: weight | strokeWeight (may be mixed) | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Stroke: individual side weights | strokeTopWeight, Bottom, Left, Right on frames and rectangles | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Stroke: align | CENTER, INSIDE, OUTSIDE | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Stroke: join | MITER, BEVEL, ROUND | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Stroke: miter limit | strokeMiterLimit angle | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Stroke: cap | NONE, ROUND, SQUARE, ARROW_LINES, ARROW_EQUILATERAL, DIAMOND_FILLED, TRIANGLE_FILLED, CIRCLE_FILLED | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Stroke: per-vertex cap/join | Vector vertices can override strokeCap, strokeJoin, cornerRadius | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Stroke: dash pattern | Array of dash/gap lengths | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Stroke: geometry | strokeGeometry read-only outlined stroke paths | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Stroke: outlineStroke() | Converts stroke to a vector node | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Variable width stroke: presets | widthProfile UNIFORM, WEDGE, TAPER, QUARTER_TAPER, EYE, MIRRORED_TAPER | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Variable width stroke: custom | CUSTOM profile with width points {position, width} | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Complex stroke: BASIC | Plain stroke type | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Complex stroke: DYNAMIC | Hand-drawn stroke with frequency, wiggle, smoothen | P2 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Brush: STRETCH | Stretch brushes (15 presets: HEIST, BLOCKBUSTER, ... NEW_WAVE, plus CUSTOM); direction FORWARD/BACKWARD | P2 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Brush: SCATTER | Scatter brushes (10 presets: BUBBLEGUM ... OI, plus CUSTOM); gap, wiggle, sizeJitter, angularJitter, rotation | P2 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Brushes: loading | loadBrushesAsync('STRETCH' or 'SCATTER') before use | P2 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |

## A8. Effects, blending, masks

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Effects: stack | Ordered effects array; effectStyleId link | P0 | [Effect](https://developers.figma.com/docs/plugins/api/Effect/) |
| Effect: DROP_SHADOW | color, offset, radius, spread, blendMode, visible, showShadowBehindNode | P0 | [Effect](https://developers.figma.com/docs/plugins/api/Effect/) |
| Effect: INNER_SHADOW | color, offset, radius, spread, blendMode, visible | P0 | [Effect](https://developers.figma.com/docs/plugins/api/Effect/) |
| Effect: LAYER_BLUR | Blurs layer; blurType NORMAL or PROGRESSIVE | P0 | [Effect](https://developers.figma.com/docs/plugins/api/Effect/) |
| Effect: BACKGROUND_BLUR | Blurs content behind layer; NORMAL or PROGRESSIVE | P0 | [Effect](https://developers.figma.com/docs/plugins/api/Effect/) |
| Blur: progressive | startRadius, startOffset, endOffset gradient blur | P1 | [Effect](https://developers.figma.com/docs/plugins/api/Effect/) |
| Effect: NOISE | noiseType MONOTONE, DUOTONE (secondaryColor), MULTITONE (opacity); noiseSize, density, blendMode | P1 | [Effect](https://developers.figma.com/docs/plugins/api/Effect/) |
| Effect: TEXTURE | Grain/texture with noiseSize, radius, clipToShape | P1 | [Effect](https://developers.figma.com/docs/plugins/api/Effect/) |
| Effect: GLASS | Liquid glass: lightIntensity, lightAngle, refraction, depth, dispersion, radius | P2 | [Effect](https://developers.figma.com/docs/plugins/api/Effect/) |
| Effect: SHADER | Custom shader effect by id with properties | P2 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Effect variable binding | color, radius, spread, offsetX, offsetY bindable to variables | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Layer opacity | opacity 0..1 (bindable to variable) | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Blend mode: pass/normal | PASS_THROUGH (groups/frames), NORMAL | P0 | [BlendMode](https://developers.figma.com/docs/plugins/api/BlendMode/) |
| Blend mode: darken group | DARKEN, MULTIPLY, LINEAR_BURN, COLOR_BURN | P0 | [BlendMode](https://developers.figma.com/docs/plugins/api/BlendMode/) |
| Blend mode: lighten group | LIGHTEN, SCREEN, LINEAR_DODGE, COLOR_DODGE | P0 | [BlendMode](https://developers.figma.com/docs/plugins/api/BlendMode/) |
| Blend mode: contrast group | OVERLAY, SOFT_LIGHT, HARD_LIGHT | P0 | [BlendMode](https://developers.figma.com/docs/plugins/api/BlendMode/) |
| Blend mode: inversion group | DIFFERENCE, EXCLUSION | P0 | [BlendMode](https://developers.figma.com/docs/plugins/api/BlendMode/) |
| Blend mode: component group | HUE, SATURATION, COLOR, LUMINOSITY | P0 | [BlendMode](https://developers.figma.com/docs/plugins/api/BlendMode/) |
| Mask: isMask | Layer masks siblings above it | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Mask: maskType | ALPHA, VECTOR, LUMINANCE | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |

## A9. Shapes, corners, vectors, booleans

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Corner radius | cornerRadius (may be mixed) | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Per-corner radius | topLeft, topRight, bottomLeft, bottomRight radii | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Corner smoothing | cornerSmoothing 0..1 (iOS squircle ~0.6) | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Arc data | startingAngle, endingAngle (radians), innerRadius ratio | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Polygon/star point count | pointCount; star innerRadius | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Vector network: vertices | x, y, optional strokeCap, strokeJoin, cornerRadius, handleMirroring | P0 | [VectorNetwork](https://developers.figma.com/docs/plugins/api/VectorNetwork/) |
| Vector network: segments | start/end vertex indices with tangentStart/tangentEnd bezier handles | P0 | [VectorNetwork](https://developers.figma.com/docs/plugins/api/VectorNetwork/) |
| Vector network: regions | Fillable loops with windingRule and per-region fills/fillStyleId | P0 | [VectorNetwork](https://developers.figma.com/docs/plugins/api/VectorNetwork/) |
| Vector paths | SVG path data strings with windingRule NONZERO, EVENODD, NONE | P0 | [VectorPath](https://developers.figma.com/docs/plugins/api/VectorPath/) |
| Handle mirroring | NONE, ANGLE, ANGLE_AND_LENGTH | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Fill geometry | fillGeometry read-only filled paths | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Boolean ops | figma.union, subtract, intersect, exclude create BooleanOperationNode | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Flatten | figma.flatten merges nodes into one VectorNode | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Group / ungroup | figma.group, figma.ungroup | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Transform modifiers: linear repeat | REPEAT count, unitType RELATIVE/PIXELS, offset, axis HORIZONTAL/VERTICAL | P2 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Transform modifiers: radial repeat | REPEAT count around a center with offset | P2 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| SVG import | createNodeFromSvg(svg) returns a frame of vector nodes | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| JSX import | createNodeFromJSXAsync builds nodes from widget-style JSX | P2 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |

## A10. Text model

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Text: characters | Plain string content; insertCharacters (useStyle BEFORE/AFTER), deleteCharacters | P0 | [TextNode](https://developers.figma.com/docs/plugins/api/TextNode/) |
| Text: fontName | family, style, optional variationSettings axes | P0 | [TextNode](https://developers.figma.com/docs/plugins/api/TextNode/) |
| Text: variable font axes | variationSettings {axis: value}; getFontFamilyVariationAxes | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Text: fontSize | Size in px; bindable | P0 | [TextNode](https://developers.figma.com/docs/plugins/api/TextNode/) |
| Text: fontWeight | Read-only numeric weight derived from font style | P0 | [TextNode](https://developers.figma.com/docs/plugins/api/TextNode/) |
| Text: fontStyle | REGULAR or ITALIC (segment info) | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Text: textCase | ORIGINAL, UPPER, LOWER, TITLE, SMALL_CAPS, SMALL_CAPS_FORCED | P0 | [TextNode](https://developers.figma.com/docs/plugins/api/TextNode/) |
| Text: textDecoration | NONE, UNDERLINE, STRIKETHROUGH | P0 | [TextNode](https://developers.figma.com/docs/plugins/api/TextNode/) |
| Text: decoration style | SOLID, WAVY, DOTTED | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Text: decoration offset/thickness | PIXELS, PERCENT, or AUTO | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Text: decoration color | Solid paint or AUTO | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Text: decoration skip ink | Underline skips descenders toggle | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Text: letterSpacing | value in PIXELS or PERCENT | P0 | [TextNode](https://developers.figma.com/docs/plugins/api/TextNode/) |
| Text: lineHeight | PIXELS, PERCENT, or AUTO | P0 | [TextNode](https://developers.figma.com/docs/plugins/api/TextNode/) |
| Text: leadingTrim | CAP_HEIGHT or NONE (vertical trim) | P1 | [TextNode](https://developers.figma.com/docs/plugins/api/TextNode/) |
| Text: paragraphSpacing | Space between paragraphs | P0 | [TextNode](https://developers.figma.com/docs/plugins/api/TextNode/) |
| Text: paragraphIndent | First-line indent | P0 | [TextNode](https://developers.figma.com/docs/plugins/api/TextNode/) |
| Text: textWrapStyle | AUTO, BALANCE, PRETTY | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Text: hangingPunctuation | Punctuation hangs outside text box | P1 | [TextNode](https://developers.figma.com/docs/plugins/api/TextNode/) |
| Text: hangingList | List markers hang outside text box | P1 | [TextNode](https://developers.figma.com/docs/plugins/api/TextNode/) |
| Text: lists | listOptions ORDERED, UNORDERED, NONE per range; listSpacing; indentation level | P0 | [TextNode](https://developers.figma.com/docs/plugins/api/TextNode/) |
| Text: hyperlink | Range link to URL or NODE target | P0 | [TextNode](https://developers.figma.com/docs/plugins/api/TextNode/) |
| Text: textAlignHorizontal | LEFT, CENTER, RIGHT, JUSTIFIED | P0 | [TextNode](https://developers.figma.com/docs/plugins/api/TextNode/) |
| Text: textAlignVertical | TOP, CENTER, BOTTOM | P0 | [TextNode](https://developers.figma.com/docs/plugins/api/TextNode/) |
| Text: textAutoResize | NONE (fixed), WIDTH_AND_HEIGHT (auto width), HEIGHT (auto height), TRUNCATE | P0 | [TextNode](https://developers.figma.com/docs/plugins/api/TextNode/) |
| Text: truncation | textTruncation DISABLED or ENDING (ellipsis) | P0 | [TextNode](https://developers.figma.com/docs/plugins/api/TextNode/) |
| Text: maxLines | Line limit for truncation (nullable) | P0 | [TextNode](https://developers.figma.com/docs/plugins/api/TextNode/) |
| Text: autoRename | Layer name follows content until renamed | P0 | [TextNode](https://developers.figma.com/docs/plugins/api/TextNode/) |
| Text: textStyleId | Link to TEXT style; per-range setRangeTextStyleIdAsync | P0 | [TextNode](https://developers.figma.com/docs/plugins/api/TextNode/) |
| Text: range get/set API | getRange/setRange for font, size, case, decoration, spacing, fills, styles, lists, links, variables | P0 | [TextNode](https://developers.figma.com/docs/plugins/api/TextNode/) |
| Text: styled segments | getStyledTextSegments(fields) splits text into uniformly styled runs | P1 | [TextNode](https://developers.figma.com/docs/plugins/api/TextNode/) |
| Text: style overrides | Segment overrides SEMANTIC_ITALIC, SEMANTIC_WEIGHT, HYPERLINK, TEXT_DECORATION vs text style | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Text: variable bindings | fontFamily, fontSize, fontStyle, fontWeight, letterSpacing, lineHeight, paragraphSpacing, paragraphIndent | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Text: missing fonts | hasMissingFont on node and document | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Fonts: list/load | listAvailableFontsAsync; loadFontAsync required before editing text | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| OpenType: ligatures | LIGA, CLIG, DLIG, HLIG, RLIG toggles | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| OpenType: kerning and alternates | KERN, CALT, AALT, SALT, RCLT, RVRN, NALT, SWSH, CSWH, HIST, ORNM, RAND, ITAL, TITL | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| OpenType: numerals | ZERO, SINF, ORDN, AFRC, DNOM, NUMR (and fraction/ordinal forms) | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| OpenType: capitals | PCAP, C2PC, CASE, CPSP, UNIC | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| OpenType: widths/spacing | FWID, HWID, HALT, TWID, QWID, PWID, PALT, JUST, LFBD, OPBD, RTBD, VALT, VHAL, VPAL, VKRN | P2 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| OpenType: positional/script | INIT, MEDI, MED2, FINA, FIN2, FIN3, ISOL, CURS, MARK, MKMK, CCMP, LOCL, DIST, ABVM, BLWM | P2 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| OpenType: Indic/complex | ABRV, ABVS, AKHN, BLWF, BLWS, CJCT, CFAR, CPCT, HALF, HALN, NUKT, PREF, PRES, PSTF, PSTS, RKRF, RPHF, VATU | P2 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| OpenType: CJK/Korean | EXPT, FALT, HKNA, HNGL, HOJO, JP78, JP83, JP90, JP04, LJMO, VJMO, TJMO, NLCK, PKNA, RUBY, SMPL, TNAM, TRAD, VKNA, VERT, VRTR, VRT2 | P2 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| OpenType: misc | STCH, SIZE, DTLS, FLAC, MGRK, SSTY, LTRA, LTRM, RTLA, RTLM | P2 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| OpenType: stylistic sets | SS01–SS20 toggles | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| OpenType: character variants | CV01–CV99 toggles | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Text review | Plugins supply spelling/grammar ranges with suggestions and color RED/GREEN/BLUE | P2 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |

## A11. Components, variants, properties, slots, instances

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Component: create | createComponent, createComponentFromNode | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Variants: combineAsVariants | Merge components into a ComponentSetNode | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Variants: variantProperties | Component's property=value map; set's defaultVariant | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Component property types | BOOLEAN, TEXT, INSTANCE_SWAP, VARIANT, SLOT | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Component property: add/edit/delete | Name, defaultValue (bindable), preferredValues, description, slotSettings | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Instance swap preferred values | Preferred COMPONENT or COMPONENT_SET keys | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Slot settings | stretchChildOnInsert, displayEmptyByDefault, min/maxChildren, allowPreferredValuesOnly | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Component: description | Plain description plus descriptionMarkdown | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Component: documentation links | documentationLinks URIs | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Publishable: key / remote | Library key; remote flag for library-imported assets | Local: file-based library keys | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Publish status | UNPUBLISHED, CURRENT, CHANGED | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Component: instances | instances / getInstancesAsync list all instances | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Instance: mainComponent | Get/set main component; getMainComponentAsync | P0 | [InstanceNode](https://developers.figma.com/docs/plugins/api/InstanceNode/) |
| Instance: swapComponent | Swap preserving overrides | P0 | [InstanceNode](https://developers.figma.com/docs/plugins/api/InstanceNode/) |
| Instance: setProperties | Set component property values (string, boolean, variable alias) | P0 | [InstanceNode](https://developers.figma.com/docs/plugins/api/InstanceNode/) |
| Instance: detachInstance | Converts to FrameNode | P0 | [InstanceNode](https://developers.figma.com/docs/plugins/api/InstanceNode/) |
| Instance: overrides | List of overridden node ids and fields; resetOverrides, removeOverrides | P0 | [InstanceNode](https://developers.figma.com/docs/plugins/api/InstanceNode/) |
| Instance: scaleFactor | Instance scaled via scale tool | P1 | [InstanceNode](https://developers.figma.com/docs/plugins/api/InstanceNode/) |
| Instance: exposed nested instances | isExposedInstance; exposedInstances surface nested props | P1 | [InstanceNode](https://developers.figma.com/docs/plugins/api/InstanceNode/) |
| Library import by key | importComponentByKeyAsync, importComponentSetByKeyAsync, importStyleByKeyAsync | Local: import from local library files | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| File thumbnail node | Get/set frame/component/section used as file thumbnail | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |

## A12. Variables

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Variable types | BOOLEAN, COLOR, FLOAT, STRING, EASING, TIMING | P1 | [Variable](https://developers.figma.com/docs/plugins/api/Variable/) |
| Variable: values by mode | valuesByMode map; setValueForMode | P1 | [Variable](https://developers.figma.com/docs/plugins/api/Variable/) |
| Variable: alias | Value can reference another variable (VARIABLE_ALIAS) | P1 | [Variable](https://developers.figma.com/docs/plugins/api/Variable/) |
| Variable: composed color | Color with separate opacity variable, or color alias plus opacity | P2 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Variable: name/description | Slash-grouped name and description | P1 | [Variable](https://developers.figma.com/docs/plugins/api/Variable/) |
| Variable: hiddenFromPublishing | Exclude from library publishing | P1 | [Variable](https://developers.figma.com/docs/plugins/api/Variable/) |
| Variable: code syntax | Per-platform names WEB, ANDROID, iOS | P1 | [Variable](https://developers.figma.com/docs/plugins/api/Variable/) |
| Variable: resolveForConsumer | Resolves value for a node's active modes | P1 | [Variable](https://developers.figma.com/docs/plugins/api/Variable/) |
| Variable scopes: general | ALL_SCOPES, TEXT_CONTENT, CORNER_RADIUS, WIDTH_HEIGHT, GAP, OPACITY | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Variable scopes: color | ALL_FILLS, FRAME_FILL, SHAPE_FILL, TEXT_FILL, STROKE_COLOR, EFFECT_COLOR, COLOR_OPACITY | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Variable scopes: numeric | STROKE_FLOAT, EFFECT_FLOAT | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Variable scopes: typography | FONT_FAMILY, FONT_STYLE, FONT_WEIGHT, FONT_SIZE, LINE_HEIGHT, LETTER_SPACING, PARAGRAPH_SPACING, PARAGRAPH_INDENT | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Bindable node fields | width, height, min/max sizes, padding, gaps, radii, stroke weights, opacity, visible, characters, grid gaps | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Bindable paint/effect/grid/style fields | Paint color, color stops, effect props, grid props, style paints/effects/grids, component property values | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Collection: modes | addMode, renameMode, removeMode; defaultModeId | P1 | [VariableCollection](https://developers.figma.com/docs/plugins/api/VariableCollection/) |
| Collection: hiddenFromPublishing / key / remote | Publishing visibility and library identity | P1 | [VariableCollection](https://developers.figma.com/docs/plugins/api/VariableCollection/) |
| Extended collections | Extend a (library) collection; per-variable mode overrides; parent/root ids | P2 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Expressions | ADDITION, SUBTRACTION, MULTIPLICATION, DIVISION, comparisons, AND, OR, NOT, NEGATE, VAR_MODE_LOOKUP | P2 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Variable data types (incl. expression) | BOOLEAN, COLOR, EASING, EXPRESSION, FLOAT, STRING, TIMING, VARIABLE_ALIAS | P2 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Library variables | teamLibrary lists available library collections and variables; importVariableByKeyAsync | Local: linked local library files | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |

## A13. Styles

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Style types | PAINT, TEXT, EFFECT, GRID, CUSTOM_ANIMATION | P0 | [BaseStyle](https://developers.figma.com/docs/plugins/api/BaseStyle/) |
| PaintStyle | Named paint stack (bindable paints) | P0 | [PaintStyle](https://developers.figma.com/docs/plugins/api/PaintStyle/) |
| TextStyle | Font, size, decoration, spacing, line height, leading trim, indent, wrap, lists, hanging, case | P0 | [TextStyle](https://developers.figma.com/docs/plugins/api/TextStyle/) |
| EffectStyle | Named effects stack | P0 | [EffectStyle](https://developers.figma.com/docs/plugins/api/EffectStyle/) |
| GridStyle | Named layout grids | P0 | [GridStyle](https://developers.figma.com/docs/plugins/api/GridStyle/) |
| CustomAnimationStyle | Named set of animation entries | Module | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Style: consumers | getStyleConsumersAsync lists nodes and fields using a style | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Style: ordering and folders | moveLocal*StyleAfter, moveLocal*FolderAfter reorder styles/folders | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Style: description, docs links, publish status | Same publishable metadata as components | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |

## A14. Prototyping model

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Reactions | Node reactions: trigger plus one or more actions | P1 | [Reaction](https://developers.figma.com/docs/plugins/api/Reaction/) |
| Trigger: ON_CLICK / ON_HOVER / ON_PRESS / ON_DRAG | Basic pointer triggers | P1 | [Trigger](https://developers.figma.com/docs/plugins/api/Trigger/) |
| Trigger: AFTER_TIMEOUT | Fires after timeout (seconds) | P1 | [Trigger](https://developers.figma.com/docs/plugins/api/Trigger/) |
| Trigger: MOUSE_UP / MOUSE_DOWN | Pointer up/down with delay | P1 | [Trigger](https://developers.figma.com/docs/plugins/api/Trigger/) |
| Trigger: MOUSE_ENTER / MOUSE_LEAVE | Hover enter/leave with delay | P1 | [Trigger](https://developers.figma.com/docs/plugins/api/Trigger/) |
| Trigger: ON_KEY_DOWN | keyCodes on KEYBOARD, XBOX_ONE, PS4, SWITCH_PRO, UNKNOWN_CONTROLLER | P1 | [Trigger](https://developers.figma.com/docs/plugins/api/Trigger/) |
| Trigger: ON_MEDIA_HIT / ON_MEDIA_END | Video reaches timestamp or ends | P2 | [Trigger](https://developers.figma.com/docs/plugins/api/Trigger/) |
| Action: NODE | Navigate to destination with navigation, transition, overlay offset, reset scroll/video/component state | P1 | [Action](https://developers.figma.com/docs/plugins/api/Action/) |
| Navigation types | NAVIGATE, SWAP, OVERLAY, SCROLL_TO, CHANGE_TO | P1 | [Action](https://developers.figma.com/docs/plugins/api/Action/) |
| Action: BACK / CLOSE | Go back; close overlay | P1 | [Action](https://developers.figma.com/docs/plugins/api/Action/) |
| Action: URL | Open URL, optionally in new tab | P1 | [Action](https://developers.figma.com/docs/plugins/api/Action/) |
| Action: SET_VARIABLE | Set variable to value or expression | P2 | [Action](https://developers.figma.com/docs/plugins/api/Action/) |
| Action: SET_VARIABLE_MODE | Switch collection mode at runtime | P2 | [Action](https://developers.figma.com/docs/plugins/api/Action/) |
| Action: CONDITIONAL | If/else blocks with condition expressions and action lists | P2 | [Action](https://developers.figma.com/docs/plugins/api/Action/) |
| Action: UPDATE_MEDIA_RUNTIME | PLAY, PAUSE, TOGGLE_PLAY_PAUSE, MUTE, UNMUTE, TOGGLE_MUTE_UNMUTE, SKIP_FORWARD/BACKWARD, SKIP_TO | P2 | [Action](https://developers.figma.com/docs/plugins/api/Action/) |
| Transition: simple | DISSOLVE, SMART_ANIMATE, SCROLL_ANIMATE with easing and duration | P1 | [Transition](https://developers.figma.com/docs/plugins/api/Transition/) |
| Transition: directional | MOVE_IN, MOVE_OUT, PUSH, SLIDE_IN, SLIDE_OUT; LEFT/RIGHT/TOP/BOTTOM; matchLayers | P1 | [Transition](https://developers.figma.com/docs/plugins/api/Transition/) |
| Easing: presets | EASE_IN, EASE_OUT, EASE_IN_AND_OUT, LINEAR, EASE_IN_BACK, EASE_OUT_BACK, EASE_IN_AND_OUT_BACK | P1 | [Easing](https://developers.figma.com/docs/plugins/api/Easing/) |
| Easing: springs | GENTLE, QUICK, BOUNCY, SLOW presets; CUSTOM_SPRING mass, stiffness, damping, initialVelocity | P1 | [Easing](https://developers.figma.com/docs/plugins/api/Easing/) |
| Easing: custom bezier | CUSTOM_CUBIC_BEZIER x1, y1, x2, y2 | P1 | [Easing](https://developers.figma.com/docs/plugins/api/Easing/) |
| Overflow scrolling | overflowDirection NONE, HORIZONTAL, VERTICAL, BOTH | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Fixed children on scroll | numberOfFixedChildren pinned while scrolling | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Overlay position | CENTER, TOP_LEFT, TOP_CENTER, TOP_RIGHT, BOTTOM_LEFT, BOTTOM_CENTER, BOTTOM_RIGHT, MANUAL | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Overlay background | NONE or SOLID_COLOR; interaction NONE or CLOSE_ON_CLICK_OUTSIDE | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Flow starting points | Page list of {nodeId, name} flows | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |

## A15. Motion and animation (timeline model)

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Animation styles on nodes | applyAnimationStyle / removeAnimationStyle; FIGMA presets or CUSTOM; duration, timelineOffset, props | Module | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Built-in animation styles | figma.motion.figmaAnimationStyles lists preset styles with props | Module | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Manual keyframe tracks | Per-field keyframes with timelinePosition, easing, value; operation SET, OFFSET, SCALE | Module | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Keyframe value types | FLOAT, COLOR, TEXT_DATA, VECTOR, BOOL, CIRCLE, LINE, CIRCLE_POINT, COLOR_POINT | Module | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Animatable node fields | 30 fields: radii, stroke weights, padding, spacing, size, opacity, translation, rotation, scale, path trim | Module | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Animatable effect fields | Offset, radius, spread, color, refraction, specular, chromatic aberration, splay, noise size, density | Module | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Motion easing | Prototype easings plus HOLD; normalized spring bounce; physicalSpringToNormalized | Module | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Timelines | Node timelines with id and duration; setTimelineDuration; playheadPosition | Module | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |

## A16. Export settings

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Export: stored settings | exportSettings array on nodes, slices, pages | P0 | [ExportSettings](https://developers.figma.com/docs/plugins/api/ExportSettings/) |
| Export: PNG / JPG | Raster export with constraint SCALE, WIDTH, or HEIGHT; suffix | P0 | [ExportSettings](https://developers.figma.com/docs/plugins/api/ExportSettings/) |
| Export: SVG | svgOutlineText, svgIdAttribute, svgSimplifyStroke options | P0 | [ExportSettings](https://developers.figma.com/docs/plugins/api/ExportSettings/) |
| Export: SVG_STRING | Returns SVG as string | P1 | [ExportSettings](https://developers.figma.com/docs/plugins/api/ExportSettings/) |
| Export: PDF | Vector PDF export | P0 | [ExportSettings](https://developers.figma.com/docs/plugins/api/ExportSettings/) |
| Export: JSON_REST_V1 | Returns node as REST API JSON object | P1 | [ExportSettings](https://developers.figma.com/docs/plugins/api/ExportSettings/) |
| Export: MP4 / WEBM | fps 12/24/30/60; quality LOW/MEDIUM/HIGH; scale 0.5–4 or width/height | Module | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Export: GIF | fps 8/12/15/24/30; loopCount; size constraint | P2 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Export: contentsOnly / useAbsoluteBounds | Exclude overlapping content; use full node bounds | P0 | [ExportSettings](https://developers.figma.com/docs/plugins/api/ExportSettings/) |
| Export: color profile | DOCUMENT, SRGB, DISPLAY_P3_V4 | P1 | [ExportSettings](https://developers.figma.com/docs/plugins/api/ExportSettings/) |
| exportAsync | Exports node bytes/string/object on demand | P0 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |

## A17. Other-product models (FigJam, Slides, Buzz)

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Shape with text: basic shapes | SQUARE, ELLIPSE, ROUNDED_RECTANGLE, DIAMOND, TRIANGLE_UP/DOWN, PARALLELOGRAM_RIGHT/LEFT, TRAPEZOID, HEXAGON, PENTAGON, OCTAGON, STAR, PLUS, CHEVRON | Module | [ShapeWithTextNode](https://developers.figma.com/docs/plugins/api/ShapeWithTextNode/) |
| Shape with text: diagram shapes | ENG_DATABASE, ENG_QUEUE, ENG_FILE, ENG_FOLDER, PREDEFINED_PROCESS, SHIELD, DOCUMENT_SINGLE/MULTIPLE, MANUAL_INPUT, ARROW_LEFT/RIGHT, SUMMING_JUNCTION, OR, SPEECH_BUBBLE, INTERNAL_STORAGE | Module | [ShapeWithTextNode](https://developers.figma.com/docs/plugins/api/ShapeWithTextNode/) |
| Connector caps | NONE, ARROW_EQUILATERAL, ARROW_LINES, TRIANGLE/DIAMOND/CIRCLE_FILLED, ERD crow's-foot (6 variants) | Module | [ConnectorNode](https://developers.figma.com/docs/plugins/api/ConnectorNode/) |
| Connector endpoints | Free position, node+position, or node+magnet (NONE, AUTO, TOP, LEFT, BOTTOM, RIGHT, CENTER) | Module | [ConnectorNode](https://developers.figma.com/docs/plugins/api/ConnectorNode/) |
| Code block languages | TypeScript, C++, Ruby, CSS, JavaScript, HTML, JSON, GraphQL, Python, Go, SQL, Swift, Kotlin, Rust, Bash, Plaintext, Dart | Module | [CodeBlockNode](https://developers.figma.com/docs/plugins/api/CodeBlockNode/) |
| FigJam timer | figma.timer: start(seconds), pause, resume, stop; remaining, total, state | Module | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| FigJam color palettes | figma.constants.colors figJamBase, figJamBaseLight | Module | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Slide transitions | 23 styles (dissolve, slide/push/move from/out 4 directions, smart animate); duration; 8 curves; ON_CLICK/AFTER_DELAY | Module | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Slide grid | getSlideGrid/setSlideGrid 2D arrays; createSlide(row,col); createSlideRow; skipped slides | Module | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Slides view | viewport.slidesView grid or single-slide; slidesviewchange event | Module | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Buzz asset types | 42 social/ad/print formats (Instagram, LinkedIn, YouTube, Google ads, posters, name tags, Zoom background) | Module | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Buzz content fields | getTextContent/getMediaContent editable fields; smartResize(node,w,h) | Module | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Canvas grid | getCanvasGrid/setCanvasGrid, createCanvasRow, moveNodesToCoord; canvasView grid/single-asset | Module | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| Editor types | figma, figjam, dev, slides, buzz | Module | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |

## A18. figma.* global API surface

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| figma.apiVersion / command / pluginId / widgetId | Runtime identity and invoked menu command | P1 | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| figma.editorType | figma, figjam, dev, slides, buzz | P1 | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| figma.mode | default, textreview, inspect, codegen, linkpreview, auth | P1 | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| figma.fileKey | Current file key (private plugins only) | Local: file path or UUID | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| figma.root / currentPage / setCurrentPageAsync | Document root; current page get/switch | P1 | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| figma.skipInvisibleInstanceChildren | Performance flag to skip hidden instance children in traversal | P2 | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| figma.create* (shapes) | createRectangle, Line, Ellipse, Polygon, Star, Vector, Text, Frame, Slice, BooleanOperation | P1 | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| figma.create* (structure) | createPage, createPageDivider, createSection, createComponent(FromNode) | P1 | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| figma.create* (other editors) | createSticky, Connector, ShapeWithText, CodeBlock, Table, Slide, SlideRow, TextPath, LinkPreview, Gif | Module | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| figma.create*Style | createPaintStyle, TextStyle, EffectStyle, GridStyle, CustomAnimationStyle | P1 | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| figma.getLocal*Styles(Async) | Lists local paint, text, effect, grid, custom animation styles | P1 | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| figma.getNodeByIdAsync / getStyleByIdAsync | Lookup by ID (sync versions deprecated with dynamic page loading) | P1 | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| figma.group / ungroup / flatten / booleans / transformGroup | Structural operations on node arrays | P1 | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| figma.combineAsVariants | Creates component set | P1 | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| figma.base64Encode / base64Decode | Binary helpers | P1 | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| figma.notify | Toast with timeout, error flag, action button, dequeue reason (timeout, dismiss, action_button_click) | P1 | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| figma.commitUndo / triggerUndo | Creates undo checkpoint; triggers undo | P1 | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| figma.saveVersionHistoryAsync | Saves named version with description | P1 | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| figma.openExternal | Opens URL in browser | P1 | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| figma.closePlugin | Ends plugin with optional message | P1 | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| figma.showUI | Opens iframe UI: visible, title, width, height, position, themeColors | P1 | [figma.ui](https://developers.figma.com/docs/plugins/api/figma-ui/) |
| figma.ui | show, hide, resize, reposition, getPosition, close, postMessage/onmessage with origin | P1 | [figma.ui](https://developers.figma.com/docs/plugins/api/figma-ui/) |
| figma.util | rgb, rgba, solidPaint parsers; normalizeMarkdown | P1 | [figma.util](https://developers.figma.com/docs/plugins/api/figma-util/) |
| figma.constants | Color palette constants (FigJam base) | Module | [figma.constants](https://developers.figma.com/docs/plugins/api/figma-constants/) |
| figma.clientStorage | Per-plugin local async key/value: getAsync, setAsync, deleteAsync, keysAsync | P1 | [figma.clientStorage](https://developers.figma.com/docs/plugins/api/figma-clientStorage/) |
| figma.parameters | Quick-action parameter input with suggestions, errors, loading message | P2 | [figma.parameters](https://developers.figma.com/docs/plugins/api/figma-parameters/) |
| figma.viewport | center, zoom, bounds, scrollAndZoomIntoView | P1 | [figma.viewport](https://developers.figma.com/docs/plugins/api/figma-viewport/) |
| figma.currentUser / activeUsers | User id, name, photo, color, session; active users' cursor, viewport, selection | Local: single local user | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| figma.variables | Get/create variables and collections, aliases, bind to paints/effects/grids, import by key, extend collections | P1 | [figma.variables](https://developers.figma.com/docs/plugins/api/figma-variables/) |
| figma.teamLibrary | List library variable collections and their variables | Local: linked local library files | [figma.teamLibrary](https://developers.figma.com/docs/plugins/api/figma-teamlibrary/) |
| figma.annotations | Get/add annotation categories | P1 | [figma.annotations](https://developers.figma.com/docs/plugins/api/figma-annotations/) |
| figma.codegen | Dev Mode code generation: generate event returns code results; preferences (PIXEL/SCALED, custom settings) | P2 | [figma.codegen](https://developers.figma.com/docs/plugins/api/figma-codegen/) |
| Codegen languages | TypeScript, C++, Ruby, CSS, JavaScript, HTML, JSON, GraphQL, Python, Go, SQL, Swift, Kotlin, Rust, Bash, Plaintext | P2 | [figma.codegen](https://developers.figma.com/docs/plugins/api/figma-codegen/) |
| figma.devResources | Link preview, auth, open events for third-party dev resource links | P2 | [figma.devResources](https://developers.figma.com/docs/plugins/api/figma-devresources/) |
| figma.vscode | Marker API for plugins running in the VS Code extension | Local: N/A | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| figma.textreview | Request to enable/disable as text-review (spellcheck) provider | P2 | [figma.textreview](https://developers.figma.com/docs/plugins/api/figma-textreview/) |
| figma.payments | Plugin monetization: status UNPAID/PAID/NOT_SUPPORTED, checkout, payment token | Local: N/A, no marketplace payments | [figma.payments](https://developers.figma.com/docs/plugins/api/figma-payments/) |
| figma.timer | FigJam timer control | Module | [figma.timer](https://developers.figma.com/docs/plugins/api/figma-timer/) |
| figma.motion | Playhead position, animation style presets, spring conversion | Module | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| figma.buzz | Buzz frames/instances in grid, asset types, content fields, smart resize | Module | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |
| figma.mixed | Sentinel for mixed values across ranges/children | P1 | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| Event: selectionchange / currentpagechange | Selection or page changed | P1 | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| Event: documentchange | Batched CREATE, DELETE, PROPERTY_CHANGE, STYLE_* changes with LOCAL/REMOTE origin | P1 | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| Event: nodechange (page) | Per-page node change stream | P1 | [PageNode](https://developers.figma.com/docs/plugins/api/PageNode/) |
| Event: stylechange | Style create/delete/property change | P1 | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| Event: drop | Drag-and-drop from plugin UI with items, files, canvas coordinates | P2 | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| Event: run / close | Plugin launched (with parameters or dev resource) / closing | P1 | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| Event: timer* | timerstart, timerstop, timerpause, timerresume, timeradjust, timerdone | Module | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| Event: slidesviewchange / canvasviewchange | View-mode change events | Module | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| Event: textreview | Provider returns review ranges for text | P2 | [figma global](https://developers.figma.com/docs/plugins/api/figma/) |
| Tracked change properties | ~120 NodeChangeProperty names enumerate every observable node field | P1 | [Plugin API typings](https://unpkg.com/@figma/plugin-typings@1.141.0/plugin-api.d.ts) |

## B1. REST API: platform, auth, limits

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| REST base URL | https://api.figma.com (gov: api.figma-gov.com); JSON over HTTPS | P1 | [REST API intro](https://developers.figma.com/docs/rest-api/) |
| Auth: personal access tokens | User-generated tokens with selected scopes and expiry | Local: N/A, localhost token optional | [Personal access tokens](https://developers.figma.com/docs/rest-api/personal-access-tokens/) |
| Auth: OAuth 2 apps | Authorize at figma.com/oauth; token and refresh endpoints | Local: N/A, no accounts | [OAuth apps](https://developers.figma.com/docs/rest-api/oauth-apps/) |
| Auth: plan access tokens | Org/plan-level tokens for admin endpoints | Local: N/A, no accounts | [Plan access tokens](https://developers.figma.com/docs/rest-api/plan-access-tokens/) |
| Scopes | current_user, file_content, file_metadata, file_versions, file_comments(r/w), file_dev_resources(r/w), file_variables(r/w), library_*, projects, folders, webhooks(r/w), org:discovery_read | Local: per-folder read/write permissions | [Scopes](https://developers.figma.com/docs/rest-api/scopes/) |
| Rate limits: tiers | Tier1 10–20/min, Tier2 25–100/min, Tier3 50–150/min for Full/Dev seats by plan; View/Collab far lower | Local: N/A | [Rate limits](https://developers.figma.com/docs/rest-api/rate-limits/) |
| Rate limits: 429 headers | Retry-After, X-Figma-Plan-Tier, X-Figma-Rate-Limit-Type, X-Figma-Upgrade-Link | Local: N/A | [Rate limits](https://developers.figma.com/docs/rest-api/rate-limits/) |
| Errors | Standard HTTP status codes with JSON error bodies | P1 | [Errors](https://developers.figma.com/docs/rest-api/errors/) |
| OpenAPI spec | Official OpenAPI 3.1 spec and TypeScript types (beta) | P1 | [REST API intro](https://developers.figma.com/docs/rest-api/) |
| Branch keys | File endpoints accept branch keys in place of file keys | P2 | [File endpoints](https://developers.figma.com/docs/rest-api/file-endpoints/) |

## B2. REST API: Files and images

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| GET /v1/files/:key | Full file JSON; params version, ids, depth, geometry=paths, plugin_data, branch_data | P1 | [File endpoints](https://developers.figma.com/docs/rest-api/file-endpoints/) |
| GET /v1/files/:key/nodes | JSON for specific node ids with depth/geometry/plugin_data | P1 | [File endpoints](https://developers.figma.com/docs/rest-api/file-endpoints/) |
| GET /v1/images/:key | Render nodes to jpg, png, svg, pdf; scale 0.01–4; SVG text/id/stroke options; contents_only; absolute bounds | P1 | [File endpoints](https://developers.figma.com/docs/rest-api/file-endpoints/) |
| GET /v1/files/:key/images | Download URLs for all image-fill hashes in a file | P1 | [File endpoints](https://developers.figma.com/docs/rest-api/file-endpoints/) |
| GET /v1/files/:key/meta | File metadata (name, owner, thumbnail, last modified, editor type) | P1 | [File endpoints](https://developers.figma.com/docs/rest-api/file-endpoints/) |
| GET /v1/files/:key/versions | Paginated version history list | P1 | [Version history endpoints](https://developers.figma.com/docs/rest-api/version-history-endpoints/) |

## B3. REST API: Comments and reactions

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| GET /v1/files/:key/comments | List comments (optionally as markdown) | P2 | [Comments endpoints](https://developers.figma.com/docs/rest-api/comments-endpoints/) |
| POST /v1/files/:key/comments | Add comment or reply, pinned to canvas position or node | P2 | [Comments endpoints](https://developers.figma.com/docs/rest-api/comments-endpoints/) |
| DELETE /v1/files/:key/comments/:id | Delete own comment | P2 | [Comments endpoints](https://developers.figma.com/docs/rest-api/comments-endpoints/) |
| GET /v1/files/:key/comments/:id/reactions | List emoji reactions on comment | P2 | [Comments endpoints](https://developers.figma.com/docs/rest-api/comments-endpoints/) |
| POST /v1/files/:key/comments/:id/reactions | Add emoji reaction | P2 | [Comments endpoints](https://developers.figma.com/docs/rest-api/comments-endpoints/) |
| DELETE /v1/files/:key/comments/:id/reactions | Remove own reaction | P2 | [Comments endpoints](https://developers.figma.com/docs/rest-api/comments-endpoints/) |

## B4. REST API: Users, teams, projects, folders

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| GET /v1/me | Current authenticated user | Local: N/A, no accounts | [Users endpoints](https://developers.figma.com/docs/rest-api/users-endpoints/) |
| GET /v1/teams/:id/projects (deprecated) | Projects in a team | Local: list folders on disk (P1) | [Projects endpoints](https://developers.figma.com/docs/rest-api/projects-endpoints/) |
| GET /v1/projects/:id/meta (deprecated) | Project metadata | Local: folder metadata (P2) | [Projects endpoints](https://developers.figma.com/docs/rest-api/projects-endpoints/) |
| GET /v1/projects/:id/files (deprecated) | Files in a project, optional branch data | Local: list files in folder (P1) | [Projects endpoints](https://developers.figma.com/docs/rest-api/projects-endpoints/) |
| GET /v2/teams/:id/folders | Top-level folders in a team | Local: list workspace folders (P1) | [Folders endpoints](https://developers.figma.com/docs/rest-api/folders-endpoints/) |
| GET /v2/folders/:id/folders | Subfolders of a folder | Local: list subfolders (P1) | [Folders endpoints](https://developers.figma.com/docs/rest-api/folders-endpoints/) |
| GET /v2/folders/:id/files | Files in a folder | Local: list files (P1) | [Folders endpoints](https://developers.figma.com/docs/rest-api/folders-endpoints/) |
| GET /v2/folders/:id/meta | Folder metadata without listing files | Local: folder stat (P2) | [Folders endpoints](https://developers.figma.com/docs/rest-api/folders-endpoints/) |

## B5. REST API: Components, component sets, styles (published library)

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| GET /v1/teams/:id/components | Paginated published components in team library | Local: list library components (P1) | [Component endpoints](https://developers.figma.com/docs/rest-api/component-endpoints/) |
| GET /v1/files/:key/components | Published components in a file | P1 | [Component endpoints](https://developers.figma.com/docs/rest-api/component-endpoints/) |
| GET /v1/components/:key | Component metadata by key | P1 | [Component endpoints](https://developers.figma.com/docs/rest-api/component-endpoints/) |
| GET /v1/teams/:id/component_sets | Published component sets in team | Local: list library sets (P1) | [Component endpoints](https://developers.figma.com/docs/rest-api/component-endpoints/) |
| GET /v1/files/:key/component_sets | Published component sets in file | P1 | [Component endpoints](https://developers.figma.com/docs/rest-api/component-endpoints/) |
| GET /v1/component_sets/:key | Component set metadata by key | P1 | [Component endpoints](https://developers.figma.com/docs/rest-api/component-endpoints/) |
| GET /v1/teams/:id/styles | Published styles in team | Local: list library styles (P1) | [Component endpoints](https://developers.figma.com/docs/rest-api/component-endpoints/) |
| GET /v1/files/:key/styles | Published styles in file | P1 | [Component endpoints](https://developers.figma.com/docs/rest-api/component-endpoints/) |
| GET /v1/styles/:key | Style metadata by key | P1 | [Component endpoints](https://developers.figma.com/docs/rest-api/component-endpoints/) |

## B6. REST API: Variables

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| GET /v1/files/:key/variables/local | All local and used remote variables, collections, modes (Enterprise) | P1 | [Variables endpoints](https://developers.figma.com/docs/rest-api/variables-endpoints/) |
| GET /v1/files/:key/variables/published | Published variables with subscribed_id; modes omitted (Enterprise) | P1 | [Variables endpoints](https://developers.figma.com/docs/rest-api/variables-endpoints/) |
| POST /v1/files/:key/variables | Atomic bulk create/update/delete of collections, modes, variables, values; temp ids; 4MB body cap | P1 | [Variables endpoints](https://developers.figma.com/docs/rest-api/variables-endpoints/) |

## B7. REST API: Dev resources

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| GET /v1/files/:key/dev_resources | Dev resource links in a file (filter by node ids) | P2 | [Dev resources endpoints](https://developers.figma.com/docs/rest-api/dev-resources-endpoints/) |
| POST /v1/dev_resources | Bulk create across files; max 10 per node; unique URL per node | P2 | [Dev resources endpoints](https://developers.figma.com/docs/rest-api/dev-resources-endpoints/) |
| PUT /v1/dev_resources | Bulk update dev resources | P2 | [Dev resources endpoints](https://developers.figma.com/docs/rest-api/dev-resources-endpoints/) |
| DELETE /v1/files/:key/dev_resources/:id | Delete a dev resource | P2 | [Dev resources endpoints](https://developers.figma.com/docs/rest-api/dev-resources-endpoints/) |

## B8. REST API: Webhooks

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| GET /v2/webhooks | List webhooks by context (team, project, file) or plan | Local: file-watch subscriptions (P2) | [Webhooks endpoints](https://developers.figma.com/docs/rest-api/webhooks-endpoints/) |
| POST /v2/webhooks | Create webhook for event + context; sends PING | Local: file-watch/event hooks (P2) | [Webhooks endpoints](https://developers.figma.com/docs/rest-api/webhooks-endpoints/) |
| GET /v2/webhooks/:id | Get a webhook | Local: event hooks (P2) | [Webhooks endpoints](https://developers.figma.com/docs/rest-api/webhooks-endpoints/) |
| PUT /v2/webhooks/:id | Update webhook (status ACTIVE/PAUSED, endpoint, passcode, description) | Local: event hooks (P2) | [Webhooks endpoints](https://developers.figma.com/docs/rest-api/webhooks-endpoints/) |
| DELETE /v2/webhooks/:id | Delete webhook | Local: event hooks (P2) | [Webhooks endpoints](https://developers.figma.com/docs/rest-api/webhooks-endpoints/) |
| GET /v2/teams/:id/webhooks (deprecated) | Team webhooks | Local: N/A | [Webhooks endpoints](https://developers.figma.com/docs/rest-api/webhooks-endpoints/) |
| GET /v2/webhooks/:id/requests | Last 7 days of webhook requests/responses for debugging | Local: event log (P2) | [Webhooks endpoints](https://developers.figma.com/docs/rest-api/webhooks-endpoints/) |
| Webhook events | PING, FILE_UPDATE, FILE_VERSION_UPDATE, FILE_DELETE, LIBRARY_PUBLISH, FILE_COMMENT, DEV_MODE_STATUS_UPDATE | Local: local event bus (P2) | [Webhooks](https://developers.figma.com/docs/rest-api/webhooks/) |
| Webhook limits | 20 per team, 5 per folder, 3 per file; plan caps 150/300/600; 3 retries (5m, 30m, 3h) | Local: N/A | [Webhooks](https://developers.figma.com/docs/rest-api/webhooks/) |

## B9. REST API: Admin, analytics, billing, embedding

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| GET /v1/activity_logs | Org audit events (admin) | Local: N/A, no org admin | [Activity logs endpoints](https://developers.figma.com/docs/rest-api/activity-logs-endpoints/) |
| POST /v1/developer_logs | Logs of REST API and MCP server requests in org | Local: N/A | [Developer logs](https://developers.figma.com/docs/rest-api/developer-logs/) |
| GET /v1/ai_usage/daily | Per-user, per-day AI credit usage for a plan | Local: N/A | [AI usage](https://developers.figma.com/docs/rest-api/ai-usage/) |
| GET /v1/discovery | Hourly JSON exports of org text events; 24h window; link TTL 60–86400s | Local: N/A | [Discovery endpoints](https://developers.figma.com/docs/rest-api/discovery-endpoints/) |
| GET /v1/payments | Purchase status for Community plugins/widgets/files | Local: N/A, no marketplace | [Payments](https://developers.figma.com/docs/rest-api/payments/) |
| GET /v1/analytics/libraries/:key/component/actions | Component insert/detach actions over time by component or team | Local: library usage scan (P2) | [Library analytics endpoints](https://developers.figma.com/docs/rest-api/library-analytics-endpoints/) |
| GET /v1/analytics/libraries/:key/component/usages | Component instance usage counts by component or file | Local: library usage scan (P2) | [Library analytics endpoints](https://developers.figma.com/docs/rest-api/library-analytics-endpoints/) |
| GET /v1/analytics/libraries/:key/style/actions | Style insert/detach actions over time | Local: library usage scan (P2) | [Library analytics endpoints](https://developers.figma.com/docs/rest-api/library-analytics-endpoints/) |
| GET /v1/analytics/libraries/:key/style/usages | Style usage counts | Local: library usage scan (P2) | [Library analytics endpoints](https://developers.figma.com/docs/rest-api/library-analytics-endpoints/) |
| GET /v1/analytics/libraries/:key/variable/actions | Variable insert/detach actions over time | Local: library usage scan (P2) | [Library analytics endpoints](https://developers.figma.com/docs/rest-api/library-analytics-endpoints/) |
| GET /v1/analytics/libraries/:key/variable/usages | Variable usage counts | Local: library usage scan (P2) | [Library analytics endpoints](https://developers.figma.com/docs/rest-api/library-analytics-endpoints/) |
| GET /v1/oembed | oEmbed data for Figma files and published Makes | Local: N/A, no hosted links | [oEmbed endpoints](https://developers.figma.com/docs/rest-api/oembed-endpoints/) |
| SCIM: ServiceProviderConfig / tenant check | SCIM config and tenant validation | Local: N/A, no accounts | [SCIM endpoints](https://developers.figma.com/docs/rest-api/scim-endpoints/) |
| SCIM: Users | GET/POST/PUT/PATCH/DELETE users; max 3,000 per response; Enterprise roles and admin flag | Local: N/A, no accounts | [SCIM endpoints](https://developers.figma.com/docs/rest-api/scim-endpoints/) |
| SCIM: Groups | GET/POST/PUT/PATCH/DELETE groups linked to workspaces/billing groups | Local: N/A, no accounts | [SCIM endpoints](https://developers.figma.com/docs/rest-api/scim-endpoints/) |

## C1. Shortcuts: essentials and panels

Sources: [Use Figma products with a keyboard](https://help.figma.com/hc/en-us/articles/360040328653-Use-Figma-products-with-a-keyboard), [Hide or minimize the UI](https://help.figma.com/hc/en-us/articles/41414918021271-Hide-or-minimize-the-UI), [Explore the navigation bar and left sidebar](https://help.figma.com/hc/en-us/articles/360039831974-Explore-the-navigation-bar-and-left-sidebar), in-app panel reproductions ([KeyCombiner](https://keycombiner.com/collections/figma/), [defkey](https://defkey.com/figma-shortcuts)).

| Shortcut (Mac) | Shortcut (Windows) | Action | Illigma |
| --- | --- | --- | --- |
| Ctrl+Shift+? | Ctrl+Shift+? | Open keyboard shortcuts panel (highlights used shortcuts; Layout tab) | P0 |
| Cmd+K (legacy Cmd+/) | Ctrl+K (legacy Ctrl+/) | Actions menu / quick actions: search and run any command | P0 |
| Cmd+\ | Ctrl+\ | Hide/show entire UI | P0 |
| Cmd+Shift+\ | Ctrl+Shift+\ | Minimize UI (collapse nav bar and both sidebars) | P0 |
| I or Ctrl+C | I | Pick color (eyedropper) from anywhere | P0 |
| Opt+1 | Alt+1 | Show Layers panel | P0 |
| Opt+2 | Alt+2 | Show Assets panel | P0 |
| Opt+3 | Alt+3 | Open Libraries modal | P1 |
| Opt+8 | Alt+8 | Open Design panel | P0 |
| Opt+9 | Alt+9 | Open Prototype panel | P1 |
| Opt+0 | Alt+0 | Open Code/Inspect panel | P2 |
| Shift+E | Shift+E | Toggle Design/Prototype tab; show prototype connections | P1 |
| Opt+L | Alt+L | Collapse all layers in Layers panel | P0 |
| Shift+I | Shift+I | Quick insert (assets/components search) | P1 |
| Shift+D | Shift+D | Toggle Dev Mode (also design mode toggle in Slides/Buzz) | P2 |
| Shift+C | Shift+C | Show/hide comments | P2 |
| C | C | Comment mode (Esc exits) | P2 |
| / | / | Cursor chat (52-character limit; Esc clears) | P2 |
| Cmd+Enter | Ctrl+Enter | Open on-canvas AI agent prompt for selection | P2 |
| Opt+Cmd+P | Ctrl+Alt+P | Run last plugin | P1 |
| Opt+Cmd+S | Ctrl+Alt+S | Save to version history | P0 |
| Opt+Shift+Cmd+0 | Ctrl+Shift+Alt+0 | Reset UI scale to default (desktop app) | P1 |
| Opt+Shift+Cmd+= | Ctrl+Shift+Alt+= | Make UI larger | P1 |
| Opt+Shift+Cmd+- | Ctrl+Shift+Alt+- | Make UI smaller | P1 |
| F6 | Ctrl+F6 | Focus toolbar for keyboard tool selection (arrows to choose, Enter to place) | P1 |
| Opt+Space | Ctrl+Space | Keyboard box selection tool (arrows move, Enter selects, Cmd/Ctrl+arrows draw box, Esc exits) | P1 |

## C2. Shortcuts: tools

Sources: [Access design tools from the toolbar](https://help.figma.com/hc/en-us/articles/360041064174-Access-design-tools-from-the-toolbar), [Frames in Figma Design](https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design), [Organize your canvas with sections](https://help.figma.com/hc/en-us/articles/9771500257687-Organize-your-canvas-with-sections), [Add images and videos to designs](https://help.figma.com/hc/en-us/articles/360040028034-Add-images-and-videos-to-designs), [KeyCombiner](https://keycombiner.com/collections/figma/).

| Shortcut (Mac) | Shortcut (Windows) | Action | Illigma |
| --- | --- | --- | --- |
| V | V | Move tool | P0 |
| H (or hold Space) | H (or hold Space) | Hand tool (pan without editing) | P0 |
| K | K | Scale tool (scales strokes, effects, text proportionally) | P0 |
| F or A | F or A | Frame tool | P0 |
| Shift+S | Shift+S | Section tool | P0 |
| S | S | Slice tool | P1 |
| R | R | Rectangle tool | P0 |
| O | O | Ellipse tool | P0 |
| L | L | Line tool | P0 |
| Shift+L | Shift+L | Arrow tool | P0 |
| P | P | Pen tool | P0 |
| Shift+P | Shift+P | Pencil tool | P1 |
| T | T | Text tool | P0 |
| Cmd+Shift+K | Ctrl+Shift+K | Place image/video (bulk import, click to place each) | P0 |
| Shift+T | Shift+T | Annotation tool (Dev Mode) | P1 |
| Shift+M | Shift+M | Measurement tool (Dev Mode) | P1 |

## C3. Shortcuts: view and zoom

Sources: [Adjust your zoom and view options](https://help.figma.com/hc/en-us/articles/360041065034-Adjust-your-zoom-and-view-options), [View layer outlines](https://help.figma.com/hc/en-us/articles/5724448965527-View-layer-outlines-in-Figma-Design), [Create layout guides](https://help.figma.com/hc/en-us/articles/360040450513-Create-layout-guides), [KeyCombiner](https://keycombiner.com/collections/figma/).

| Shortcut (Mac) | Shortcut (Windows) | Action | Illigma |
| --- | --- | --- | --- |
| Space+drag | Space+drag | Pan canvas | P0 |
| Arrow keys (nothing selected) | Arrow keys (nothing selected) | Pan canvas; Shift for larger steps (zoom-dependent) | P0 |
| Cmd+scroll / pinch | Ctrl+scroll / pinch | Zoom canvas | P0 |
| + or Cmd+= | + or Ctrl+= | Zoom in | P0 |
| - or Cmd+- | - or Ctrl+- | Zoom out | P0 |
| Shift+0 (also Cmd+0) | Shift+0 (also Ctrl+0) | Zoom to 100% | P0 |
| Shift+1 | Shift+1 | Zoom to fit (all content) | P0 |
| Shift+2 | Shift+2 | Zoom to selection | P0 |
| N | N | Zoom to next frame | P1 |
| Shift+N | Shift+N | Zoom to previous frame | P1 |
| Home | Home | Find previous frame | P1 |
| End | End | Find next frame | P1 |
| Page Up | Page Up | Previous page | P0 |
| Page Down | Page Down | Next page | P0 |
| Shift+R | Shift+R | Toggle rulers | P0 |
| Cmd+Shift+O (legacy Shift+O) | Ctrl+Shift+O (legacy Shift+O) | Toggle outline (wireframe) view | P0 |
| Ctrl+G (also Shift+G) | Ctrl+Shift+4 (also Shift+G) | Toggle layout guides visibility | P0 |
| Cmd+' (also Shift+') | Ctrl+' | Toggle pixel grid | P0 |
| Cmd+Shift+' | Ctrl+Shift+' | Toggle snap to pixel grid | P0 |
| Cmd+Shift+P (older lists Ctrl+Opt+Y) | Ctrl+Shift+P (older Ctrl+Alt+Y) | Toggle pixel preview | P1 |
| Opt+Cmd+\ | Ctrl+Alt+\ | Toggle multiplayer cursors | P2 |
| (Zoom/view menu) | (Zoom/view menu) | Outline view options: include hidden layers, include object bounds | P1 |

## C4. Shortcuts: selection

Sources: [Select layers and objects](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects), [Frames in Figma Design](https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design), [Lock and unlock layers](https://help.figma.com/hc/en-us/articles/360041596573-Lock-and-unlock-layers), [Toggle visibility](https://help.figma.com/hc/en-us/articles/360041112614-Toggle-visibility-to-hide-layers), [KeyCombiner](https://keycombiner.com/collections/figma/).

| Shortcut (Mac) | Shortcut (Windows) | Action | Illigma |
| --- | --- | --- | --- |
| Cmd+A | Ctrl+A | Select all | P0 |
| Cmd+Shift+A | Ctrl+Shift+A | Select inverse | P0 |
| Esc | Esc | Deselect / exit mode | P0 |
| Opt+Cmd+A | Ctrl+Alt+A | Select all matching layers | P1 |
| Enter | Enter | Select children (or edit text/vector/image) | P0 |
| Shift+Enter | Shift+Enter | Select parent | P0 |
| Tab | Tab | Select next sibling | P0 |
| Shift+Tab | Shift+Tab | Select previous sibling | P0 |
| Cmd+click | Ctrl+click | Deep select nested layer | P0 |
| Cmd+drag | Ctrl+drag | Deep select within marquee | P0 |
| Cmd+right-click | Ctrl+right-click | Select layer menu (layers under cursor) | P0 |
| Shift+click | Shift+click | Add/remove from selection | P0 |
| Shift+drag (multi-edit) | Shift+drag (multi-edit) | Add only matching objects to selection | P1 |
| Q | Q | Toggle multi-edit for variants | P1 |
| Cmd+Shift+H | Ctrl+Shift+H | Show/hide selection | P0 |
| Cmd+Shift+L | Ctrl+Shift+L | Lock/unlock selection | P0 |
| Cmd+R | Ctrl+R | Rename selection (batch rename) | P0 |

## C5. Shortcuts: edit, clipboard, history

Sources: [Copy and paste objects](https://help.figma.com/hc/en-us/articles/4409078832791-Copy-and-paste-objects), [Copy and paste properties](https://help.figma.com/hc/en-us/articles/4412765442967-Copy-and-paste-properties-between-layers), [Export static designs](https://help.figma.com/hc/en-us/articles/360040028114-Export-static-designs-from-Figma), [Find and replace](https://help.figma.com/hc/en-us/articles/9141292269847-Find-and-replace-in-Figma), [KeyCombiner](https://keycombiner.com/collections/figma/).

| Shortcut (Mac) | Shortcut (Windows) | Action | Illigma |
| --- | --- | --- | --- |
| Cmd+C | Ctrl+C | Copy (also copies selected guide/effect/interaction) | P0 |
| Cmd+X | Ctrl+X | Cut | P0 |
| Cmd+V | Ctrl+V | Paste (into multiple selected frames; URL onto text adds link) | P0 |
| Cmd+Shift+V | Ctrl+Shift+V | Paste over selection (same x,y, not inside) | P0 |
| Cmd+Shift+R | Ctrl+Shift+R | Paste to replace selection | P0 |
| Cmd+Shift+C | Ctrl+Shift+C | Copy as PNG | P0 |
| Opt+Cmd+C | Ctrl+Alt+C | Copy properties | P0 |
| Opt+Cmd+V | Ctrl+Alt+V | Paste properties | P0 |
| Cmd+D | Ctrl+D | Duplicate (repeats last offset; fills grid cells) | P0 |
| Delete / Backspace | Delete / Backspace | Delete selection | P0 |
| Cmd+Z | Ctrl+Z | Undo | P0 |
| Cmd+Shift+Z | Ctrl+Shift+Z or Ctrl+Y | Redo | P0 |
| Cmd+F | Ctrl+F | Find (and replace) in file | P0 |
| Cmd+Shift+F / Cmd+Shift+D | Ctrl+Shift+F / Ctrl+Shift+D | Find next / previous (older panel lists) | P1 |
| Cmd+Shift+E | Ctrl+Shift+E | Export (bulk export layers with export settings) | P0 |
| Shift+Enter (variables table) | Shift+Enter | Duplicate selected variables | P1 |

## C6. Shortcuts: arrange, align, group, layout

Sources: [Adjust alignment, rotation, position](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions), [Guide to auto layout](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma), [Use the horizontal and vertical flows in auto layout](https://help.figma.com/hc/en-us/articles/31289464393751-Use-the-horizontal-and-vertical-flows-in-auto-layout), [defkey](https://defkey.com/figma-shortcuts), [KeyCombiner](https://keycombiner.com/collections/figma/).

| Shortcut (Mac) | Shortcut (Windows) | Action | Illigma |
| --- | --- | --- | --- |
| Cmd+] | Ctrl+] | Bring forward | P0 |
| Cmd+[ | Ctrl+[ | Send backward | P0 |
| Opt+Cmd+] | Ctrl+Shift+] | Bring to front | P0 |
| Opt+Cmd+[ | Ctrl+Shift+[ | Send to back | P0 |
| Opt+A | Alt+A | Align left | P0 |
| Opt+D | Alt+D | Align right | P0 |
| Opt+W | Alt+W | Align top | P0 |
| Opt+S | Alt+S | Align bottom | P0 |
| Opt+H | Alt+H | Align horizontal centers | P0 |
| Opt+V | Alt+V | Align vertical centers | P0 |
| Ctrl+Opt+H | Alt+Shift+H (some lists Ctrl+Alt+Shift+H) | Distribute horizontal spacing | P0 |
| Ctrl+Opt+V | Alt+Shift+V (some lists Ctrl+Alt+Shift+V) | Distribute vertical spacing | P0 |
| Ctrl+Opt+T | Ctrl+Alt+Shift+T | Tidy up | P0 |
| Shift+click align button | Shift+click align button | Align each object to its parent frame | P0 |
| Cmd+G | Ctrl+G | Group selection | P0 |
| Cmd+Shift+G | Ctrl+Shift+G | Ungroup (also remove slot frame keeping contents) | P0 |
| Cmd+Delete | Ctrl+Backspace | Remove section/frame wrapper (ungroup) | P0 |
| Opt+Cmd+G | Ctrl+Alt+G | Frame selection | P0 |
| Shift+A | Shift+A | Add auto layout (infers horizontal/vertical/grid) | P0 |
| Opt+Shift+A | Alt+Shift+A | Remove auto layout | P0 |
| W / A / S / D (alignment box focused) | W / A / S / D | Set auto layout alignment to frame edge | P1 |
| X (alignment box focused) | X | Toggle packed vs space-between | P1 |
| B (alignment box focused) | B | Toggle text baseline alignment | P1 |
| Cmd+click padding field | Ctrl+click padding field | Uniform padding entry / CSS shorthand (1,2,3,4) | P1 |
| Opt+double-click frame edge | Alt+double-click frame edge | Set child to Fill container on that axis | P1 |
| Ctrl while dragging into AL frame | (Ctrl) while dragging | Place as absolute (ignore auto layout) | P1 |
| Space while dragging | Space while dragging | Keep object in current parent (prevent reparenting) | P0 |
| Arrow keys | Arrow keys | Nudge by small nudge (default 1px) | P0 |
| Shift+Arrow keys | Shift+Arrow keys | Nudge by big nudge (default 10px) | P0 |

## C7. Shortcuts: transform and resize modifiers

Sources: [Adjust alignment, rotation, position](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions), [Apply constraints](https://help.figma.com/hc/en-us/articles/360039957734-Apply-constraints-to-define-how-layers-resize), [Crop an image](https://help.figma.com/hc/en-us/articles/360040675194-Crop-an-image), [KeyCombiner](https://keycombiner.com/collections/figma/).

| Shortcut (Mac) | Shortcut (Windows) | Action | Illigma |
| --- | --- | --- | --- |
| Shift+H | Shift+H | Flip horizontal | P0 |
| Shift+V | Shift+V | Flip vertical | P0 |
| Ctrl+Cmd+M | Ctrl+Alt+M | Use as mask | P0 |
| Opt+R | Alt+R | Reveal/move rotation origin target | P1 |
| Shift while rotating | Shift while rotating | Snap rotation to 15° increments | P0 |
| Shift while resizing | Shift while resizing | Resize proportionally (temporarily lock aspect) | P0 |
| Opt while resizing | Alt while resizing | Resize from center | P0 |
| Cmd while resizing | Ctrl while resizing | Ignore constraints/auto layout (frames); crop (images) | P0 |
| Ctrl while resizing (aspect locked) | Ctrl while resizing | Temporarily unlock aspect ratio | P0 |
| Ctrl while moving | Ctrl while moving | Temporarily disable snapping | P0 |
| Space while resizing/drawing | Space while resizing/drawing | Reposition while drawing or resizing | P0 |
| Opt+drag | Alt+drag | Duplicate while dragging | P0 |
| Opt (hover) | Alt (hover) | Measure distance to hovered layer | P0 |
| Opt+Cmd (hover) | Ctrl+Alt (hover) | Measure to nested layer | P0 |
| Shift while drawing shape | Shift while drawing shape | Constrain to square/circle/regular polygon | P0 |
| Opt while drawing shape | Alt while drawing shape | Draw from center | P0 |
| Opt+double-click image | Alt+double-click image | Crop image | P0 |
| Cmd+drag image corner | Ctrl+drag image corner | Quick crop | P0 |
| Opt while cropping | Alt while cropping | Modify opposite sides too | P1 |
| Enter | Enter | Edit shape/vector, image, or text | P0 |
| 1 … 9 | 1 … 9 | Set opacity 10%–90% | P0 |
| 0 | 0 | Set opacity 100% | P0 |
| 0 0 | 0 0 | Set opacity 0% | P0 |
| Two digits quickly (e.g. 4 5) | Two digits quickly | Set exact opacity (45%) | P0 |

## C8. Shortcuts: shapes, vectors, boolean

Sources: [Boolean operations](https://help.figma.com/hc/en-us/articles/360039957534-Boolean-operations), [Flatten layers](https://help.figma.com/hc/en-us/articles/30101373312279-Flatten-layers), [Convert strokes to vector paths](https://help.figma.com/hc/en-us/articles/33052305733015-Convert-strokes-to-vector-paths), [Edit vector layers](https://help.figma.com/hc/en-us/articles/360039957634-Edit-vector-layers), [Simplify a vector path](https://help.figma.com/hc/en-us/articles/33792593975575-Simplify-a-vector-path), [Shape builder](https://help.figma.com/hc/en-us/articles/31616004109847-Create-custom-shapes-with-the-shape-builder-tool), [KeyCombiner](https://keycombiner.com/collections/figma/).

| Shortcut (Mac) | Shortcut (Windows) | Action | Illigma |
| --- | --- | --- | --- |
| Opt+Shift+U | Alt+Shift+U | Union selection | P0 |
| Opt+Shift+S | Alt+Shift+S | Subtract selection | P0 |
| Opt+Shift+I | Alt+Shift+I | Intersect selection | P0 |
| Opt+Shift+E | Alt+Shift+E | Exclude selection | P0 |
| Opt+Shift+F (legacy Cmd+E) | Alt+Shift+F (legacy Ctrl+E) | Flatten selection (also text to vector) | P0 |
| Opt+Cmd+O (legacy Cmd+Shift+O) | Ctrl+Alt+O (legacy Ctrl+Shift+O) | Outline stroke; preference "Use old shortcuts for outlines" swaps | P0 |
| Opt+/ | Alt+/ | Remove fill | P0 |
| Shift+/ | Shift+/ (some lists /) | Remove stroke | P0 |
| Shift+X | Shift+X | Swap fill and stroke | P0 |
| Enter (vector selected) | Enter | Enter/exit vector edit mode | P0 |
| V (vector edit) | V | Move points | P0 |
| P (vector edit) | P | Pen: add points | P0 |
| Hold Cmd (vector edit) | Hold Ctrl | Bend tool / switch to other vector layer on click | P0 |
| Q (vector edit) | Q | Lasso select points | P1 |
| X (vector edit) | X | Cut path tool | P1 |
| Shift+E (vector edit) | Shift+E | Eraser tool | P1 |
| Shift+B (legacy B) (vector edit) | Shift+B (legacy B) | Paint bucket: fill/unfill regions | P0 |
| Shift+Delete | Shift+Backspace | Delete and heal selected points | P0 |
| Cmd+J | Ctrl+J | Join selected points | P0 |
| Cmd+Shift+J | Ctrl+Shift+J | Smooth join selection | P1 |
| Opt+click region (shape builder) | Alt+click region | Subtract region in shape builder | P1 |
| Ctrl while adjusting handle | Ctrl while adjusting handle | Temporarily ignore pixel grid snapping | P1 |
| Shift+drag handles | Shift+drag handles | Move both bezier handles together / constrain angle | P0 |
| Cmd+click existing stroke (pencil) | Ctrl+click existing stroke | Sample stroke fill, weight, style | P1 |
| Shift while drawing (pencil) | Shift while drawing | Straight line | P1 |

## C9. Shortcuts: text

Sources: [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties), [Create and apply text styles](https://help.figma.com/hc/en-us/articles/360039957034-Create-and-apply-text-styles), [Create bulleted and numbered lists](https://help.figma.com/hc/en-us/articles/360040449773-Create-bulleted-and-numbered-lists), [Add emojis and smart symbols](https://help.figma.com/hc/en-us/articles/360039957174-Add-emojis-and-smart-symbols-to-text), [KeyCombiner](https://keycombiner.com/collections/figma/).

| Shortcut (Mac) | Shortcut (Windows) | Action | Illigma |
| --- | --- | --- | --- |
| Cmd+B | Ctrl+B | Bold (without breaking text style) | P0 |
| Cmd+I | Ctrl+I | Italic | P0 |
| Cmd+U | Ctrl+U | Underline | P0 |
| Cmd+Shift+X | Ctrl+Shift+X | Strikethrough | P0 |
| Cmd+K (while editing text; older) | Ctrl+K | Create link (paste URL onto selected text also links) | P0 |
| Cmd+Shift+7 | Ctrl+Shift+7 | Toggle numbered list | P0 |
| Cmd+Shift+8 | Ctrl+Shift+8 | Toggle bulleted list | P0 |
| Tab / Shift+Tab (in list) | Tab / Shift+Tab | Indent / outdent list item | P0 |
| Opt+Cmd+L | Ctrl+Alt+L | Align text left | P0 |
| Opt+Cmd+T | Ctrl+Alt+T | Align text center | P0 |
| Opt+Cmd+R | Ctrl+Alt+R | Align text right | P0 |
| Opt+Cmd+J | Ctrl+Alt+J | Justify text | P0 |
| Cmd+Shift+< / > | Ctrl+Shift+< / > | Decrease / increase font size | P0 |
| Opt+Cmd+< / > | Ctrl+Alt+< / > | Decrease / increase font weight | P0 |
| Opt+< / > | Alt+< / > | Adjust letter spacing (kerning between letters) | P0 |
| Opt+Shift+< / > | Alt+Shift+< / > | Adjust line height | P0 |
| Cmd+Shift+V (in text) | Ctrl+Shift+V | Paste and match style | P0 |
| Ctrl+Cmd+Space | Win+. (OS) | Emoji picker | P1 |
| Enter (text selected) | Enter | Edit text / multi-edit selected text layers | P0 |
| Esc | Esc | Exit text editing (keeps layer selected) | P0 |

## C10. Shortcuts: components, variants, slots, assets

Sources: [Create components](https://help.figma.com/hc/en-us/articles/360038663154-Create-components-to-reuse-in-designs), [Create and insert component instances](https://help.figma.com/hc/en-us/articles/360039150173-Create-and-insert-component-instances), [Swap components and instances](https://help.figma.com/hc/en-us/articles/360039150413-Swap-components-and-instances), [Create and use slots](https://help.figma.com/hc/en-us/articles/38231200344599-Create-and-use-slots-to-build-flexible-components-in-Figma-Design), [KeyCombiner](https://keycombiner.com/collections/figma/).

| Shortcut (Mac) | Shortcut (Windows) | Action | Illigma |
| --- | --- | --- | --- |
| Opt+Cmd+K | Ctrl+Alt+K | Create component (multiple selected: component set / multiple components) | P0 |
| Opt+Cmd+B | Ctrl+Alt+B | Detach instance | P0 |
| Ctrl+Opt+Cmd+K | Ctrl+Alt+Shift+K | Go to main component | P0 |
| Cmd+Shift+S | Ctrl+Shift+S | Create slot from selection | P1 |
| Opt+drag from Assets onto instance | Alt+drag (help also says Ctrl) | Swap instance | P0 |
| Opt+Cmd+drag from Assets (nested) | Alt+Ctrl+drag | Swap nested instance | P1 |
| Opt+drag component | Alt+drag | Create instance from main component | P0 |
| Cmd+D on component | Ctrl+D | Duplicate as instance / duplicate variant | P0 |
| Opt+Cmd+O (older) | Ctrl+Alt+O | Team library modal (now Opt+3) | P1 |

## C11. Shortcuts: prototyping and presentation

Sources: [Play your prototypes](https://help.figma.com/hc/en-us/articles/360040318013-Play-your-prototypes), [Guide to prototyping](https://help.figma.com/hc/en-us/articles/360040314193-Guide-to-prototyping-in-Figma), [Connect your prototype](https://help.figma.com/hc/en-us/articles/360040315773-Connect-your-prototype).

| Shortcut (Mac) | Shortcut (Windows) | Action | Illigma |
| --- | --- | --- | --- |
| Cmd+Opt+Return | Ctrl+Alt+Enter | Present prototype in presentation view | P1 |
| R (player) | R | Restart prototype / flow | P1 |
| Z (player) | Z | Cycle prototype scale options | P1 |
| → / Space / N (player) | → / Space / N | Next frame | P1 |
| ← (player) | ← | Previous frame | P1 |
| Hold Shift (editing interactions) | Hold Shift | Hide interaction details panel | P1 |
| Cmd+C / Cmd+X / Cmd+V on interaction | Ctrl+C / X / V | Copy/cut/paste interaction details | P1 |
| Tab then Enter (player) | Tab then Enter | Enable prototype accessibility mode via skip link | P2 |

## C12. Shortcuts: lists and panels (variables, styles, layers, files)

Sources: [Create and manage variables](https://help.figma.com/hc/en-us/articles/15145852043927-Create-and-manage-variables-and-collections), [Manage and share styles](https://help.figma.com/hc/en-us/articles/360039820134-Manage-and-share-styles), [Sample colors with the eyedropper](https://help.figma.com/hc/en-us/articles/27643269375767-Sample-colors-with-the-eyedropper-tool), [View a file's version history](https://help.figma.com/hc/en-us/articles/360038006754-View-a-file-s-version-history).

| Shortcut (Mac) | Shortcut (Windows) | Action | Illigma |
| --- | --- | --- | --- |
| Cmd+click | Ctrl+click | Multi-select variables, styles, layers, grid tracks, files | P0 |
| Shift+click | Shift+click | Range-select variables, styles, layers, tracks | P0 |
| Delete (variable field) | Backspace | Detach variable from numeric field | P1 |
| Shift+click field | Shift+click field | Apply variable to multiple fields | P1 |
| Tab (eyedropper) | Tab | Cycle color model shown while sampling | P1 |
| Shift+click (eyedropper) | Shift+click | Apply sampled variable/style to layer; copy variable name | P1 |
| Tab (number fields) | Tab | Move between input fields | P0 |
| Shift+Ctrl+Opt+click file (file browser) | Alt+Shift+click file | Restore version from file browser | Local: N/A |

## Notes

- The Plugin API typings (v1.141.0) expose 36 scene/base node types. Newer ones absent from many Figma clones: SLOT, TEXT_PATH, TRANSFORM_GROUP (linear/radial repeat modifiers), MEDIA, and INTERACTIVE_SLIDE_ELEMENT. A faithful Illigma file format needs room for all of them, even the ones it doesn't render in v1.
- Recent paint and effect additions are easy to miss: PATTERN and SHADER paints; NOISE (mono/duo/multitone), TEXTURE, GLASS and SHADER effects; progressive blur; variable-width strokes (6 presets plus custom); dynamic strokes; 25 named brush presets; text decoration style/offset/thickness/color/skip-ink; textWrapStyle BALANCE/PRETTY.
- Auto layout now has a full GRID mode: FLEX/FIXED/HUG tracks, spans, auto-row flow and track reordering. counterAxisAlignItems includes BASELINE. primaryAxisAlignItems adds SPACE_EVENLY and SPACE_AROUND beyond the UI's space-between.
- Variables have 6 resolved types, including EASING and TIMING for motion. There are 23 scopes and per-platform code syntax (WEB/ANDROID/iOS). Expressions cover arithmetic, comparison and boolean ops plus mode lookup. Collections can be extended, and colors can be composed (separate opacity alias). Prototype CONDITIONAL and SET_VARIABLE actions depend on this expression engine.
- Motion is already in the document model: animation styles, manual keyframe tracks (30 node fields plus effect fields), timelines, and MP4/WEBM/GIF export. Keep these out of v1 but reserve them in the schema for the Motion module.
- REST limits worth mirroring locally: image render scale 0.01–4; max 10 dev resources per node; variables POST body capped at 4MB and applied atomically; webhooks limited to 20 per team, 5 per folder and 3 per file, with 3 retries. Rate limits (Tier 1–3) and SCIM/activity/AI-usage/discovery endpoints have no local equivalent.
- A local HTTP/MCP API could copy the REST shape almost one-to-one: file JSON (with depth/ids/geometry), node render to png/jpg/svg/pdf, image-fill export, versions, comments, published components/styles/variables, and a variables bulk-write.
- Shortcut drift is real: since 2025 Flatten moved Cmd+E → Opt+Shift+F, Outline stroke moved Cmd+Shift+O → Opt+Cmd+O, Show outlines moved Shift+O → Cmd+Shift+O (a preference restores the old ones), boolean ops gained Opt+Shift+U/S/I/E, and the actions menu moved to Cmd+K. Third-party lists (KeyCombiner, defkey) still show the old bindings.
- Figma offers no official, complete shortcuts web page. The canonical list is the in-app panel (Ctrl+Shift+?), which also supports non-US keyboard layouts (AZERTY, QWERTZ, etc.). Rows here combine Help Center articles (authoritative, current) with panel reproductions. Some Windows bindings in those reproductions disagree with each other (distribute spacing, pixel preview).
- Defaults Illigma should match: small nudge 1px, big nudge 10px, rotation snap 15° with Shift, opacity via number keys (1–9, 0, 00, two-digit entry), and a 52-character limit for cursor chat.
