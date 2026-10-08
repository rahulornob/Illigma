# Shapes, vector networks, booleans & masks — Figma parity spec

> **Status: research draft (date 2026-10-08). Nothing implemented.** Every checklist item in §6 is *Not started*. No item may be called "1:1 parity" until it is implemented in Illigma **and** validated against live Figma behavior (see §8).
>
> **Rule of precedence.** Figma is the source of truth for every behavior, interaction, edge case and data structure in this document. Framer is the source of truth only for how the editor *looks*. This document specifies behavior only; where it mentions a control, handle or cursor it specifies *what it must do or communicate*, never its styling.
>
> **Evidence legend** (every behavioral claim is tagged):
> - **[API]** — Figma Plugin API typings v1.141.0 (`plugin-api.d.ts`) and/or Figma REST API types v0.44.0 (`api_types.ts`), read in this session. Line references are in §9.
> - **[DOC:&lt;article id&gt;]** — an official Figma Help Center article (IDs from the 2026-09-27 source catalog). **"excerpt"** means only a search-engine summary/excerpt of the article was seen in this session, sometimes served from a third-party mirror of Figma's help content (`figma-signup.helpjuice.com`); the article body itself was **not** read (help.figma.com is not reachable from this environment). `[DOC:developers.figma.com/… excerpt]` is the official plugin developer documentation seen the same way.
> - **[OBS]** — the read-only live-Figma UI inspection of 2026-09-27 (UI3, Chrome/macOS). It covered inspector sections and the paint popover only; it established **nothing** about vector editing, masks or booleans. Nothing in this document was observed live in this session.
> - **[KNOW]** — the author's prior knowledge of Figma, **not verified in this session**.
> - **[SRC:&lt;url&gt;]** — a non-help-center web source (Figma community forum, Figma blog title, third-party tutorial, an open-source reimplementation). Seen as search excerpts unless stated otherwise.
>
> Every correctness-relevant claim resting only on [KNOW] or [SRC] is repeated as a concrete experiment in §8. The session's web-search budget ran out part-way through the research (shared across parallel agents); topics that could not be searched (image placement details, mask UI details, some vector-edit shortcuts) are therefore [KNOW]-heavy and explicitly queued in §8.

---

## 1. Scope & terminology

### 1.1 In scope

| Feature | Figma node / data | Notes |
| --- | --- | --- |
| Rectangle | `RECTANGLE` | Uniform or independent corner radii, corner smoothing, per-side stroke weights. |
| Ellipse & arcs | `ELLIPSE` + `arcData` | Arc tool = on-canvas Start / Sweep / Ratio handles on an ellipse (pies, semicircles, rings/donuts). |
| Polygon | `POLYGON` (REST: `REGULAR_POLYGON`) | `pointCount` (sides). |
| Star | `STAR` | `pointCount` (spikes), `innerRadius` (UI "Ratio"). |
| Line & arrow | `LINE` (height always 0) | Arrow tool = line with arrowhead endpoint caps. |
| Shape creation | tools R / O / L / ⇧L / Polygon / Star | Click-to-create default size, drag, Shift, Alt/Option, Space. |
| Pen tool & vector networks | `VECTOR` + `vectorNetwork` | Graph of vertices + Bézier segments + fill regions (not just paths): branching, per-region fills. |
| Vector edit mode | transient editing session over one or more vector-like layers | Point/segment/handle selection, Bend, mirroring, per-vertex corner radius/caps, delete & heal, join/split, Paint bucket, Lasso, Shape builder. |
| Pencil | `VECTOR` | Freehand, auto-placed smoothed points. |
| Boolean groups | `BOOLEAN_OPERATION` | Union / Subtract / Intersect / Exclude, non-destructive, nestable. |
| Flatten | → `VECTOR` | Destructive merge to one vector (⌘E). |
| Outline stroke | → `VECTOR` | Destructive stroke→fill conversion (⌥⌘O). |
| Offset / Simplify vector | → `VECTOR` | Destructive Figma Draw-era path operations (shipped July 2025) — P2. |
| Shape builder | vector edit sub-tool | Destructive region merge/extract/remove. |
| Masks | `isMask` + `maskType` on any blend-capable layer | Alpha / Vector / Luminance; "Use as mask"; sibling-order scope. |
| Slice | `SLICE` | Export region tool. |
| Image placement as shapes | `RECTANGLE` with an `IMAGE` paint | Images are paints, not nodes. |
| Primitive vs converted vector | type change on first geometric edit | Parametric data is lost on conversion. |

### 1.2 Out of scope here (owned by other areas; see §7)

- Paint internals (solid/gradient/image/pattern/video paints, image crop & filters, color picker), stroke dash/alignment UI, effects, blend modes — paints/strokes/effects area.
- Figma Draw illustration features: brushes (`complexStrokeProperties`), variable-width strokes (`variableWidthStrokeProperties`), texture/noise effects, transform groups / repeat modifiers (`TRANSFORM_GROUP`, `transformModifiers`), text on a path (`TEXT_PATH`). They are listed only where they constrain this area (e.g. variable width cannot be applied to branching networks [API]).
- Text-to-outlines (flatten/outline of text) beyond the flatten rule — text area.
- Frames, groups, sections, clipping ("Clip content") — canvas/containers area. Note that frame clipping is **not** a mask.
- Connectors (FigJam `ConnectorStrokeCap`), washi tape (`WASHI_TAPE_*` caps in REST) — FigJam, out of scope.

### 1.3 Local-first notes

All features in this area are purely local geometry operations; none requires a server. Library/component publishing interactions are owned by the design-systems area. AI-assisted vector features (e.g. "vectorize image") are out of scope.

### 1.4 Terms users confuse

| Term | Figma meaning | Not to be confused with |
| --- | --- | --- |
| Vector network | A graph: any vertex may join any number of segments; fills live on *regions* (faces) [API][DOC:360040450213 excerpt] | An SVG path list (one direction, contours only). `vectorPaths` is a lossy view of the network [API]. |
| Vector edit mode | Editing the vertices/segments of a layer ("Edit object") [DOC:360039957634 excerpt] | Selecting a nested *layer* (deep select / Enter into a group). |
| Boolean group | A live container whose children's areas are combined [DOC:360039957534 excerpt] | Flatten (destructive), Shape builder (destructive), Illustrator Pathfinder (destructive). |
| Mask | A sibling layer that limits the visibility of the siblings stacked above it [API][DOC:360040450253 excerpt] | Frame "Clip content"; image crop; boolean Intersect. |
| Mask group | The group Figma creates around a mask and its masked layers [DOC:360040450253 excerpt] | A frame. |
| Arc / Sweep / Ratio | Ellipse `arcData` (start angle, end angle, inner radius ratio) [API] | A separate "arc" node (there is none). |
| Star Ratio | `innerRadius` (inner-point radius as a fraction) [API][DOC:360040450133 excerpt] | Corner radius. |
| Corner smoothing | Squircle-style continuous curvature, whole-shape only [DOC:360050986854 excerpt] | Corner radius (circular rounding). |
| Caps / endpoints / arrowheads | `strokeCap` values on degree-1 vertices [API] | Joins (`strokeJoin`, vertices with ≥2 segments). |
| Outline stroke | Stroke → filled vector (destructive) [DOC:33052305733015 excerpt] | "Show outlines" view mode (⌘⇧O in current Figma) [DOC:33052305733015 excerpt]. |
| Flatten | Merge selection into one `VECTOR` (destructive) [DOC:30101373312279 excerpt] | Group; boolean union; "flatten image" (rasterize). |
| Slice | An export region node with no appearance [API][DOC:360040028114 excerpt] | A frame; the "Crop" image mode. |
| Primitive | Parametric shape node (rect/ellipse/polygon/star/line) | A vector that merely looks like one. |

---

## 2. Data model

All values are document data unless marked *transient*. Ranges are as stated by the typings; UI ranges where different are noted. Illigma must persist the canonical data below and **derive** geometry (`fillGeometry`, `strokeGeometry`, `vectorPaths`) — derived data may be cached but is never the source of truth.

### 2.1 Common to every shape node (`DefaultShapeMixin`) [API]

| Property | Type / values | Default (new shape) | Notes |
| --- | --- | --- | --- |
| `fills` | `Paint[]` | closed shapes: one SOLID fill (Figma default grey, believed `#D9D9D9` [KNOW]); `LINE`: stroke-only | Can be `mixed` only for text. |
| `strokes` | `Paint[]` | `[]` for closed shapes; `LINE`: black, weight 1 [API] | |
| `strokeWeight` | number ≥ 0, fractional | 1 | `mixed` for rectangles with individual side weights [API]. |
| `strokeAlign` | `CENTER` \| `INSIDE` \| `OUTSIDE` | `INSIDE` for closed shapes, `CENTER` for lines/open vectors [KNOW] | Inside/outside are implemented by doubling weight and masking by the fill [API]. |
| `strokeCap` | `NONE` \| `ROUND` \| `SQUARE` \| `ARROW_LINES` \| `ARROW_EQUILATERAL` \| `DIAMOND_FILLED` \| `TRIANGLE_FILLED` \| `CIRCLE_FILLED` | `NONE` | Applies to vertices with exactly one segment; `mixed` if vertices differ [API]. REST names: `LINE_ARROW`, `TRIANGLE_ARROW`, … [API]. |
| `strokeJoin` | `MITER` \| `BEVEL` \| `ROUND` | `MITER` [KNOW] | Applies to vertices with ≥2 segments; `mixed` possible [API]. |
| `strokeMiterLimit` | number | 4 [KNOW] (REST `strokeMiterAngle` default 28.96° ⇔ limit 4 since 2·asin(1/4)=28.955°) [API] | |
| `dashPattern` | `number[]` | `[]` | Owned by strokes area. |
| `isMask` | boolean | `false` | Masks *subsequent* siblings (= layers above it in the layers panel) [API]. |
| `maskType` | `ALPHA` \| `VECTOR` \| `LUMINANCE` | `ALPHA` [API] | Independent of `isMask`; a non-mask may carry a `maskType` [API]. REST `isMaskOutline` is the deprecated alias of `VECTOR` [API]. |
| `effects`, `opacity`, `blendMode`, `visible`, `locked` | — | — | Owned by other areas. |
| `x`, `y`, `width`, `height`, `rotation`, `relativeTransform` | width/height ≥ 0.01 (LINE height must be exactly 0) [API] | | |
| `constraints`, layout-child props | — | — | Layout area. |
| `exportSettings` | `ExportSettings[]` | `[]` | |
| `targetAspectRatio` | — | unset | Aspect-lock (`constrainProportions` deprecated) [API]. |

`CornerMixin` (Rectangle, Ellipse, Polygon, Star, Vector, BooleanOperation, frames) [API]:

| Property | Type / range | Default | Notes |
| --- | --- | --- | --- |
| `cornerRadius` | number ≥ 0, fractional, or `mixed` | 0 | "If an edge length is less than twice the corner radius, the corner radius for each vertex of the edge will be clamped to half the edge length" [API]. `mixed` for rectangles with differing corners and vectors with differing vertex radii [API]. |
| `cornerSmoothing` | 0 … 1 | 0 | 0 = circular; 0.6 = iOS squircle [API][DOC:360050986854 excerpt]. Whole-shape only [DOC:360050986854 excerpt]. |

### 2.2 Per node type

| Node | Specific properties [API] | Defaults | Ranges / invariants |
| --- | --- | --- | --- |
| `RECTANGLE` | `topLeftRadius`, `topRightRadius`, `bottomLeftRadius`, `bottomRightRadius`; `strokeTopWeight`, `strokeRightWeight`, `strokeBottomWeight`, `strokeLeftWeight` | 100×100 when created by click [API: "similar to using the R shortcut followed by a click"] | radii ≥ 0 fractional; REST order `rectangleCornerRadii` = [TL, TR, BR, BL] [API]. |
| `ELLIPSE` | `arcData: { startingAngle, endingAngle, innerRadius }` | 100×100; full ellipse (believed `{0, 2π, 0}` [KNOW]) | Angles in radians, 0 = +x axis, increasing **clockwise** (y-down) [API REST]; `innerRadius` 0…1 [API REST]. |
| `POLYGON` | `pointCount` | 3 (triangle), 100×100 [API] | Integer ≥ 3 [API]; UI max believed 60 (stated for star count) [DOC:360040450133 excerpt]. |
| `STAR` | `pointCount`, `innerRadius` | 5 points, 100×100 [API][DOC:360040450133 excerpt]; `innerRadius` default unknown (believed ≈0.382 [KNOW]) | `pointCount` integer ≥ 3 [API], UI 3…60 [DOC:360040450133 excerpt]; `innerRadius` 0…1 inclusive, 1 ⇒ regular polygon with 2·pointCount edges [API]. |
| `LINE` | (only shape mixins) | width 100 when created by script; black stroke weight 1 [API] | height ≡ 0 [API]. No `CornerMixin`. |
| `VECTOR` | `vectorNetwork`, `vectorPaths`, `handleMirroring` | empty network for scripts [API] | See §2.3. |
| `BOOLEAN_OPERATION` | `booleanOperation: UNION \| INTERSECT \| SUBTRACT \| EXCLUDE`, `children`, `expanded` | — | Has its own fills/strokes/effects/corner radius [API]. Plugin `createBooleanOperation()` is deprecated; use `union/subtract/intersect/exclude(nodes, parent, index?)` [API]. |
| `SLICE` | only base, scene, layout and export mixins | — | No fills/strokes/effects/children/mask [API]. |
| `TEXT_PATH` | read-only `vectorNetwork`, `vectorPaths`, `handleMirroring` | — | Out of scope (text area); base network not editable after creation via API [API]. |
| `TRANSFORM_GROUP` | `transformModifiers: (LinearRepeat \| RadialRepeat)[]` | — | Out of scope (Figma Draw); listed so the file format reserves the type [API]. |

### 2.3 Vector network [API]

```
VectorNetwork {
  vertices: VectorVertex[]          // points of the graph
  segments: VectorSegment[]         // edges; cubic Béziers
  regions?: VectorRegion[]          // fill areas; defaults to []
}
VectorVertex {
  x, y: number                      // relative to the node's origin
  strokeCap?: StrokeCap             // default: node.strokeCap
  strokeJoin?: StrokeJoin           // default: node.strokeJoin
  cornerRadius?: number             // default: node.cornerRadius
  handleMirroring?: HandleMirroring // NONE | ANGLE | ANGLE_AND_LENGTH; default: node.handleMirroring
}
VectorSegment {
  start, end: number                // vertex indices
  tangentStart?: Vector             // control point offset from start vertex; default {0,0}
  tangentEnd?: Vector               // control point offset from end vertex;   default {0,0}
}
VectorRegion {
  windingRule: NONZERO | EVENODD
  loops: number[][]                 // each loop = ordered list of segment indices
  fills?: Paint[]                   // per-region fills
  fillStyleId?: string
}
VectorPath { windingRule: NONZERO | EVENODD | NONE; data: string }  // "M x y", "L", "Q" (input only, converted to cubic), "C", "Z"
```

Invariants (to be enforced by Illigma's model; Figma rules from [API] and [DOC:developers.figma.com/docs/plugins/api/VectorNetwork excerpt]):

1. Segment `i` is the cubic Bézier `P0 = v[start]`, `P1 = v[start] + tangentStart`, `P2 = v[end] + tangentEnd`, `P3 = v[end]`. Zero tangents ⇒ straight segment.
2. A vertex may have 0…n segments (branching is legal) [DOC:360040450213 excerpt].
3. `regions` empty ⇒ all enclosed space is filled with the node fills [DOC:developers.figma.com/docs/plugins/api/VectorNetwork excerpt]. If regions are defined, each region has ≥ 1 loop and each loop is a connected continuous chain of segments (no forks, no gaps) [DOC:developers… excerpt].
4. Node-level `strokeCap`, `strokeJoin`, `cornerRadius`, `handleMirroring` report `mixed` when vertex overrides differ [API].
5. `vectorPaths` is a simplified, incomplete representation (no branching, no per-region fills, no per-vertex properties) [API]; Illigma must never persist only `vectorPaths` for a vector it can represent as a network.
6. REST/`.fig` interop via the REST API exposes only `fillGeometry`/`strokeGeometry` paths with optional `overrideID` → `fillOverrideTable` (per-region fills), not the network [API].

### 2.4 Transient UI state (never persisted, never in undo history unless noted)

| State | Content |
| --- | --- |
| Active tool | Move, Rectangle, Line, Arrow, Ellipse, Polygon, Star, Place image, Pen, Pencil, Slice; vector-edit sub-tool (Move, Pen, Bend, Paint bucket, Lasso, Shape builder). |
| Creation draft | anchor point, current point, modifier state (Shift/Alt/Space), snapped target, parent under pointer. |
| Vector edit session | set of edited node ids; selected vertices / segments / handles; active pen vertex (open-path continuation); hover target (vertex, segment, handle, region); current mirroring choice for new points. The *edits* made in a session are document changes and are undoable. |
| Canvas handles | visibility of corner-radius handles, arc handles, polygon/star count & ratio handles (depends on zoom and selection size). |
| Shape builder / Lasso | hover region, drag path. |
| Image placement queue | list of picked images not yet placed. |
| Pencil stroke in progress | raw input samples (pressure if any). |

---

## 3. Behavior specification

### 3.1 Shape tools — creation

Tools and access: Rectangle **R**, Line **L**, Arrow **⇧L**, Ellipse **O**, Polygon and Star (no default single-key shortcut) — all in the toolbar's *Shape tools* menu [DOC:360040450133 excerpt][SRC:uxcel.com/lessons/basic-shapes-in-figma-657]. Place image **⌘⇧K / Ctrl+Shift+K** lives in the same menu [KNOW].

Creation algorithm (pseudo-code; modifiers from [DOC:360040450133 excerpt], details [KNOW]):

```
onPointerDown(p0):
  anchor = snap(p0)                  // smart guides + pixel grid when enabled
  parent = topmostContainerAt(p0)    // frame / component / section under pointer, else page (never a group or boolean) [KNOW]
onPointerMove(p):
  if Space held: anchor += snap(p) - last; last = snap(p); return   // move draft, keep size [KNOW]
  d = snap(p) - anchor
  if Shift and tool ∈ {rect, ellipse, polygon, star}:
       s = max(|d.x|, |d.y|); d = (sgn(d.x)·s, sgn(d.y)·s)          // which axis wins: verify (§8 E-02)
  if Shift and tool ∈ {line, arrow}: d = rotateToNearest(d, 45°)      // [KNOW]
  if Alt/Option: box = [anchor - |d|, anchor + |d|]                   // draw from center [DOC excerpt]
  else:          box = normalize(anchor, anchor + d)                  // any drag direction gives positive w/h
  flip = (d.x < 0, d.y < 0)    // matters only for polygon/star orientation and line direction — verify (§8 E-03)
onPointerUp:
  if movedLessThan(clickThreshold): createDefault(at p0)              // 100×100 (line: length 100) [API]
  else create(box)
  select(newNode); activeTool = Move                                  // [KNOW]
onEscape during drag: discard draft, no history entry                 // [KNOW]
```

Rules:

- New node is the top-most child of `parent` (above existing siblings) and receives the default name `"<Type> <n>"` (`Rectangle 1`, `Ellipse 2`, `Polygon 3`, `Star 4`, `Line 5`, `Arrow 6`) [KNOW]. Numbering scope (per page vs per file, reuse of gaps) must be verified (§8 E-04).
- Default appearance: closed shapes get one solid fill (believed `#D9D9D9`, 100 %) and no stroke; lines and arrows get a solid black 1 px stroke [API for line][KNOW for fill colour].
- With *snap to pixel grid* on, drawn sizes and positions are integers [KNOW].
- Creating a shape is exactly one undo step; undo removes it and restores the previous selection [KNOW].
- Drawing inside an auto-layout frame inserts the shape into the flow (cross-area, layout) [KNOW, verify §8 E-05].

### 3.2 Rectangle

- **Corner radius.** A single value applies to all four corners; the *Independent corners* control exposes four values TL, TR, BR, BL [DOC:360050986854 excerpt][API]. Different values ⇒ the combined field shows *Mixed*; typing a value into it sets all four [KNOW]. Values are non-negative and fractional [API].
- **Render clamp (uniform radius).** Effective radius per corner `r_eff = min(r, w/2, h/2)` — derived from "clamped to half the edge length" [API]. The stored value is not changed by the clamp [KNOW, verify §8 E-07].
- **Render clamp (unequal radii).** Figma's exact rule is unverified. Candidate (open-source reimplementation `figma-squircle` [SRC:npm figma-squircle@1.1.0, source read]): process corners from largest radius to smallest; each corner's budget along a side is `r/(r + r_adjacent) · sideLength` if the adjacent corner has not been processed yet, else `sideLength − budget_adjacent`; `r_eff = min(r, min(budget_side1, budget_side2))`. Must be confirmed against Figma (§8 E-08) before claiming parity.
- **Corner smoothing** ξ ∈ [0,1], UI 0–100 %, *iOS* preset = 60 % [DOC:360050986854 excerpt][API]. Applies to the whole shape, not per corner [DOC:360050986854 excerpt]. Has no visible effect when radius = 0 [SRC:squircle.js.org/blog/figma-corner-smoothing-on-the-web]. Geometry per 90° corner (from the Figma blog "Desperately seeking squircles" as reimplemented in [SRC:npm figma-squircle@1.1.0]; the blog itself was not read):

```
p = (1 + ξ)·r                       // length of the edge consumed by the corner
if p > budget: ξ = min(ξ, budget/r − 1); p = min(p, budget)   // "what Figma currently does" per the reimplementation's comment
arcDeg   = 90·(1 − ξ)               // circular part shrinks as smoothing grows
arcLen   = sin(arcDeg/2)·r·√2
alpha    = (90 − arcDeg)/2
p3p4     = r·tan(alpha/2)
beta     = 45·ξ
c = p3p4·cos(beta); d = c·tan(beta)
b = (p − arcLen − c − d)/3; a = 2b
corner path = cubic(a,b,c) → circular arc(arcDeg) → mirrored cubic
```

- **Per-side stroke weights**: `strokeTopWeight/Right/Bottom/Left`; `strokeWeight` reads `mixed` when they differ [API]. UI exposes a side selector (All / Top / Bottom / Left / Right / Custom) [KNOW].
- **On-canvas radius handles**: when a rectangle is selected and large enough on screen, a radius handle appears inside each corner; dragging changes all corners; Alt/Option-drag changes only that corner [KNOW, verify §8 E-09].
- **Resize** changes `width/height` only; radii stay in px; the Scale tool (K) multiplies radii and stroke weights [API `rescale`][KNOW].
- **Variables**: `cornerRadius`, the four corner radii, `strokeWeight` and per-side weights are bindable to number variables; binding `cornerRadius` binds all four corners (they appear individually in `boundVariables`) [API].

### 3.3 Ellipse & arcs (Arc tool)

Data: `arcData { startingAngle, endingAngle, innerRadius }`, radians, 0 = +x axis, clockwise positive [API REST]. Sweep displayed as a percentage of the full turn [DOC:360040450173 excerpt].

On-canvas handles [DOC:360040450173 excerpt]:

| Handle | Location | Effect |
| --- | --- | --- |
| Sweep ("Arc") | appears on hover at the right-hand point (angle 0) | Drag around the ellipse to open the shape; tooltip shows sweep %; dragging **up** gives a positive %, **down** a negative %. |
| Start | dotted handle at the start angle | Drag around the ellipse to move where the arc begins (rotates the opening). Whether the end angle moves with it (sweep preserved) must be verified (§8 E-11). |
| Ratio | at the centre | Drag outward to turn the shape into a ring; value = inner radius / outer radius. |

Recipes from the article: closed ring = drag Sweep to make a pie → drag Ratio → drag Sweep back to meet Start [DOC:360040450173 excerpt]. Third-party values: pie (start 0, sweep 75 %, ratio 0), donut (0, 100 %, 50 %), progress ring (0, 75 %, 85 %) [SRC:designcode.io/figma-handbook-apple-watch-ring].

Geometry (pseudo-code; parametric-angle interpretation is [KNOW], verify §8 E-12):

```
a = w/2; b = h/2; c = (w/2, h/2); k = innerRadius
P(θ, s) = c + (s·a·cos θ, s·b·sin θ)             // y-down, θ clockwise
sweep = endingAngle − startingAngle             // may be negative
if |sweep| ≥ 2π:                                 // closed
   outer ellipse; if k > 0: inner ellipse (k·a, k·b) as a hole
else:
   outer arc  θs → θe on scale 1
   if k > 0:  line to P(θe, k); inner arc θe → θs on scale k; close
   else:      line to c; close                    // pie slice
fill rule: hole must render as a hole (EVENODD or opposite winding)
```

- Strokes follow the full outline (outer arc, radial edges, inner arc) [KNOW].
- `cornerRadius` applies to ellipses (CornerMixin) — it rounds the corners formed where radial edges meet arcs [API mixin][KNOW for visual effect].
- Arc values are not bindable to variables (not in `VariableBindableNodeField`; users requested it in 2024) [API][SRC:forum.figma.com/…/add-some-variables-for-the-arc-tool-please-35882].

### 3.4 Polygon & star

- Polygon default: 3 sides; Star default: 5 points (10 sides) [API][DOC:360040450133 excerpt].
- Star handles: Count (3–60), Ratio (inner-point distance as % of the diameter) and a third handle (believed corner radius) [DOC:360040450133 excerpt][KNOW].
- `innerRadius = 1` ⇒ star is a regular 2n-gon [API].
- Geometry ([KNOW] — orientation and box-fitting must be verified, §8 E-13):

```
for k in 0..n-1:
   θk = −π/2 + k·2π/n                 // first vertex at top-centre
   outer[k] = (cos θk, sin θk)
   if star: inner[k] = innerRadius · (cos(θk + π/n), sin(θk + π/n))
pts = interleave(outer, inner)        // polygon: outer only
fit pts' tight bounding box to (0,0,w,h)   // candidate B; candidate A = map unit circle to box
apply cornerRadius at every vertex (clamped), then cornerSmoothing
```

- Changing count or ratio keeps `x, y, width, height` [KNOW].

### 3.5 Line & arrow, endpoints

- `LINE` height is always 0; resize API requires height exactly 0 [API]. The inspector edits length (W) and rotation; H is unavailable [KNOW].
- A selected line shows endpoint handles rather than a bounding box; dragging an endpoint changes length and angle, Shift snaps the angle to 45° steps [KNOW].
- Arrow tool (⇧L) draws a line with an arrowhead at the drag end [DOC:360040450133 excerpt][KNOW for which end/which cap].
- Endpoint options (UI → enum, mapping [KNOW] unless noted):

| UI label | Plugin enum | REST enum | Notes |
| --- | --- | --- | --- |
| None | `NONE` | `NONE` | flush |
| Round | `ROUND` | `ROUND` | extends w/2 |
| Square | `SQUARE` | `SQUARE` | extends w/2 |
| Line arrow | `ARROW_LINES` | `LINE_ARROW` | two 45° strokes at the stroke weight; head length not editable [DOC:360049283914 excerpt] |
| Triangle arrow | `ARROW_EQUILATERAL` | `TRIANGLE_ARROW` | filled triangle [DOC:360049283914 excerpt] |
| Reversed triangle | `TRIANGLE_FILLED` (believed) | `TRIANGLE_FILLED` | points inward toward the path [DOC:360049283914 excerpt] |
| Circle arrow | `CIRCLE_FILLED` | `CIRCLE_FILLED` | presence in current UI unconfirmed [API][SRC:forum.figma.com/…/stroke-cap-big-circle-24751] |
| Diamond arrow | `DIAMOND_FILLED` | `DIAMOND_FILLED` | [DOC:360049283914 excerpt] |

- Caps apply only to vertices with exactly one segment; joins only to vertices with ≥ 2 segments [API]. Closed paths therefore never show caps.
- Setting a cap from the Stroke panel applies to both ends; one-ended arrows require per-endpoint control — historically via vector edit mode [DOC:360049283914 excerpt]; per-vertex `strokeCap` exists in the data [API]. Whether UI3 offers separate *Start*/*End* pickers outside edit mode must be verified (§8 E-15).

### 3.6 Image placement as shapes

- Images are paints, not nodes: placing an image creates a `RECTANGLE` whose `fills` contain one `IMAGE` paint (`scaleMode: FILL`) [API][KNOW].
- *Place image* (⌘⇧K) opens a picker (multiple files allowed); the cursor then carries the image; **click** places it at native pixel size; **drag** draws the rectangle (aspect locked to the image — verify); with several images queued, each click places the next one [KNOW, §8 E-17].
- Dropping or pasting an image file onto the canvas creates the same image rectangle at native size [KNOW]. The layer is named after the file [KNOW]. Images larger than 4096 px on a side are stored at max 4096 px (plugin API limit; UI downscaling to be verified) [API][KNOW].
- An image rectangle is an ordinary rectangle: corner radius, masks, booleans and vector edit apply unchanged [API][KNOW].

### 3.7 Pen tool

State machine ([SRC] tutorials for Shift/Alt/close/Esc; the rest [KNOW]; verify §8 E-18…E-22):

```
state Idle(no active vertex) ── click p ──▶ if no network in edit: create VECTOR in parent at p, enter edit mode
                                            add vertex v (corner); active = v
state Active(v) ── click p ──▶ snap p (Shift: 45° from v); if p hits vertex u: add segment v→u (branch if deg(u)≥1); active = (u closes loop? none : u)
                               elif p hits segment s: split s at t (de Casteljau, shape preserved), connect v→new vertex
                               else add vertex u, straight segment v→u; active = u
                ── press-drag ──▶ add vertex u; drag sets outgoing tangent T = drag vector;
                               incoming tangent of u = −T (mirror angle+length) unless Alt held (break)
                               Shift constrains T to 45° steps
                ── click first vertex of current path ──▶ close loop, active = none (Idle, still in edit mode)
                ── Esc ──▶ active = none (path left open); second Esc: leave Pen for Move in edit mode; further Esc/Enter: exit edit mode
                ── ⌘Z ──▶ remove last vertex/segment, active = previous vertex
Idle ── click an open endpoint e ──▶ active = e (continue that path)
```

- New pen vectors: believed 1 px black stroke, no fill [KNOW]. A closed loop adds a fillable region but shows fill only if the node has fills [KNOW].
- Points snap to other vertices, to horizontal/vertical alignment with other vertices and to the pixel grid [KNOW].
- New points drawn in an existing network's edit mode belong to that network even when disconnected [SRC:third-party tutorial via DOC:360040450213 search].

### 3.8 Vector network rendering

```
fillArea(node):
  if regions empty:  F = all faces enclosed by the segment graph (non-zero)   // "fills all enclosed space"
  else:              F = ∪ over regions r of area(r.loops, r.windingRule), each drawn with r.fills ?? node.fills
strokeArea(node):
  stroke every segment exactly once with node strokes;
  caps at degree-1 vertices (vertex.strokeCap ?? node.strokeCap)
  joins at degree-2 vertices (vertex.strokeJoin ?? node.strokeJoin, miter limit)
  degree ≥ 3: join each angularly adjacent pair — verify (§8 E-25)
  INSIDE/OUTSIDE: stroke at 2×weight clipped to (inside|outside) of fill area [API note]
cornerRadius: before stroking/filling, replace each vertex corner between two straight segments by a circular arc
              of radius min(r, ½ adjacent edge lengths) [API clamp]; then apply cornerSmoothing
```

Whether per-region `fills` fall back to node fills when absent, and whether changing node fills re-colours paint-bucket regions, must be verified (§8 E-24).

### 3.9 Vector edit mode

- **Enter**: select a vector-like layer and press Enter/Return, double-click it, or click *Edit object* in the properties panel [DOC:360039957634 excerpt]. Works on `VECTOR` and the primitives (rectangle, ellipse, polygon, star, line) [KNOW]. Multiple vector layers can be edited at once (multi-edit; Config 2025) — select several and press Enter, or Shift-click layers to add them [DOC:30965205437975 excerpt][DOC:360040450213 excerpt].
- **Sub-tools** (secondary toolbar): Move, Pen, Bend, Paint (bucket), Lasso, Shape builder [DOC:360039957634 excerpt]. Lasso = **Q**; Paint = **⇧B** (older docs/forums say **B**) [DOC:360039957634 excerpt][DOC:360040450213 excerpt].
- **Selection**: click vertex; Shift-click toggles; marquee selects enclosed vertices; ⌘A / Ctrl+A selects all vertices; click a segment selects it; Lasso draws a free shape around points/segments [DOC:360039957634 excerpt for lasso][KNOW rest].
- **Move**: drag vertices/segments; arrow keys nudge 1 px, Shift+arrow 10 px (nudge preference) [KNOW]. Single vertex selected ⇒ X/Y fields edit its position [KNOW].
- **Handles**: shown for selected vertices and their adjacent segments; dragging a handle edits that tangent, constrained by the vertex's mirroring [API][DOC:360039957634 excerpt]. Shift constrains handle angle to 45°; Alt/Option breaks mirroring [SRC:tutorials].
- **Mirroring** dropdown applies to the selected vertices: *No mirroring* (`NONE`), *Mirror angle* (`ANGLE`: opposite handle stays collinear, keeps its own length), *Mirror angle and length* (`ANGLE_AND_LENGTH`: opposite handle = exact negation) [DOC:360039957634 excerpt][API].
- **Bend tool** (hold ⌘/Ctrl, or pick it): drag a segment to curve it with endpoints fixed; drag from a vertex to pull out new handles; click a vertex with handles to make it a sharp corner [DOC:360039957634 excerpt][SRC:tutorial][KNOW for click-to-remove]. New Bend-created handles default to *Mirror angle* [SRC:forum.figma.com, July 2025 thread].
- **Per-vertex properties**: with vertices selected, the Corner radius field writes `vertex.cornerRadius`; with an endpoint selected the endpoint (cap) control writes `vertex.strokeCap` [API][DOC:360049283914 excerpt][KNOW for UI].
- **Delete**: Delete/Backspace removes selected vertices and every attached segment (paths break); removes selected segments only [KNOW]. **Delete & heal**: ⇧Delete (⇧Backspace) removes a vertex while reconnecting its two neighbours with one segment that approximates the old shape [DOC:33792593975575 excerpt][SRC:forum]. A forum report also mentions Option-click as delete & heal [SRC:forum.figma.com/…/23209].
- **Join**: "Join selection" (⌘J reported) connects selected endpoints [SRC:forum.figma.com, March 2025]. Exact semantics (new straight segment vs merging coincident points) — verify §8 E-29.
- **Split vector** (Figma Draw, right-click) separates a vector into multiple layers [DOC:help.figma.com excerpt, article not identified].
- **Paint bucket**: hover a closed region ⇒ diagonal-stripe highlight; cursor shows + (can add fill) or − (can remove); click toggles that region's fill. Holes are made by removing the inner region's fill, independent of path direction [DOC:360040450213 excerpt][SRC:tutorial].
- **Shape builder**: with one or more vector layers in edit mode, hover highlights regions formed by all overlaps; click-drag across regions merges them into one layer; clicking a region extracts it onto its own layer; Option/Alt-click removes a region. Destructive (unlike booleans) [DOC:31616004109847 excerpt].
- **Copy/paste**: copied paths pasted into another vector's edit mode join that vector's network (used as a workaround to merge without breaking component links) [SRC:forum.figma.com/…/please-fix-flatten-command-35696][KNOW].
- **Exit**: Esc (when nothing is sub-selected), Enter, *Done*, or clicking empty canvas [KNOW]. Every edit inside the session is undoable [KNOW].

Delete & heal approximation (Illigma algorithm; Figma's fit is unknown):

```
heal(v): require deg(v) == 2 with segments A = (a→v), B = (v→b)
  samples = sample(A) ++ sample(B)            // arc-length parameterised
  dirStart = A.tangentStart ≠ 0 ? normalize(A.tangentStart) : normalize(v − a)
  dirEnd   = B.tangentEnd   ≠ 0 ? normalize(B.tangentEnd)   : normalize(v − b)
  solve least squares for lengths (l1, l2) ≥ 0 of C = (a, a+l1·dirStart, b+l2·dirEnd, b) against samples
  replace A, B with C; update regions' loops (A,B → C); delete v
```

### 3.10 Pencil

- **⇧P**, or the creation-tools menu; in Figma Draw mode the toolbar also hosts Pencil/Brush [DOC:4402723791511 excerpt][DOC:31440438150935 excerpt].
- Freehand drag creates a `VECTOR`; points are placed automatically (longer/complex paths get more points) with basic smoothing; points are editable in vector edit mode [DOC:360041064174 excerpt][DOC:31440438150935 excerpt].
- Default stroke: round, 3 px, black — unless sketching on a dark canvas or frame [DOC:4402723791511 excerpt] (the alternate colour is believed white [KNOW]).
- Shift constrains the stroke to a straight line [DOC:4402723791511 excerpt].
- Pen pressure may produce variable width; users report no off switch (late 2025) [SRC:forum.figma.com/…/how-can-i-disable-pen-pressure-in-pencil-tool-45313] — variable width is Figma Draw scope.

### 3.11 Primitive vs converted vector

- Primitives keep parametric properties through move, resize, rotate, flip, copy/paste and undo [KNOW].
- The first geometric edit in vector edit mode converts the node to `VECTOR`: `arcData`, `pointCount`, `innerRadius` are lost; name, paints, effects, transform and visual corner rounding (as vertex `cornerRadius`) are kept [KNOW, verify §8 E-31]. One undo step returns the primitive.
- Flatten (⌘E) of a single primitive also yields a `VECTOR` [DOC:30101373312279 excerpt][API].

### 3.12 Boolean groups

- Select at least two supported layers and pick an operation from the *Boolean operations* menu [DOC:360039957534 excerpt] (in UI3 the menu is less prominent than in UI2 [SRC:forum.figma.com/…/where-in-ui3-are-the-boolean-operations…-29050]). Supported operands: shapes, vectors, text (and nested booleans); not frames or sections [DOC:360039957534 excerpt][KNOW for nesting].
- Result: a `BOOLEAN_OPERATION` node containing the selected layers, named after the operation ("Union", …) [DOC:31130266267287 excerpt][API].
- Styling: Union (and, believed, Intersect and Exclude) take fill, stroke and effects from the **top** layer; Subtract takes them from the **bottom** layer; all editable afterwards on the group [DOC:360039957534 excerpt][KNOW for Intersect/Exclude].
- Non-destructive: children keep position, size, rotation and corner radius, all editable; their own fill/stroke/effects/opacity have no effect while inside [DOC:360039957534 excerpt][DOC:31130266267287 excerpt].
- Geometry ([KNOW] for n-ary semantics, verify §8 E-33):

```
A_i = filled area of visible child i (bottom = 0), in the boolean's coordinate space,
      recursively evaluated if child is itself a boolean
UNION:     ⋃ A_i
SUBTRACT:  A_0 − ⋃_{i≥1} A_i
INTERSECT: ⋂ A_i
EXCLUDE:   { p : #{i : p ∈ A_i} is odd }
render result with the boolean node's fills/strokes/effects/cornerRadius
```

- Selecting a boolean group and choosing another operation changes `booleanOperation` in place [KNOW].
- Ungroup (context menu / ⌘⇧G) releases children as siblings with their own styling [DOC:360039957534 excerpt].
- Shortcuts: Union ⌥⇧U, Exclude ⌥⇧E [SRC:third-party lists]; Subtract ⌥⇧S, Intersect ⌥⇧I [KNOW]. Windows: Alt+Shift+… .

### 3.13 Flatten, outline stroke, offset, simplify (all destructive)

- **Flatten** ⌘E / Ctrl+E or context menu: merges the selection into a single vector layer; text becomes outlines; flattening a frame/section merges its children and removes the container [DOC:30101373312279 excerpt][API]. Destructive; recover with undo or version history [DOC:30101373312279 excerpt]. Flattening deletes the originals and creates a new layer, which breaks links that component-swapping relies on [SRC:forum.figma.com/…/please-fix-flatten-command-35696]. Differing blend modes are not preserved [SRC:forum]. Result name and which paint wins for multi-layer flatten must be verified (§8 E-36).
- **Outline stroke** ⌥⌘O / Ctrl+Alt+O or context menu: converts each stroke into a filled vector shape; stroke properties are gone; a stroke style's colour becomes the fill; half-dashes become separately editable pieces [DOC:33052305733015 excerpt]. ⌘⇧O used to be outline stroke and now toggles *Show outlines*; *Preferences → Use old shortcuts for outlines* restores it and moves Show outlines to ⇧O [DOC:33052305733015 excerpt]. The plugin method returns `null` when there are no strokes [API]. Behaviour for a layer that also has fills must be verified (§8 E-37).
- **Offset vector**: Amount (positive = outward, negative = inward), Join (square / round) [DOC:33792861450263 excerpt].
- **Simplify vector**: slider controlling how many points are removed while keeping the shape [DOC:33792593975575 excerpt]. Both shipped in July 2025 with Figma Draw [SRC:forum.figma.com/…/icymi…july-25…-43455]; their menu placement was acknowledged as a bug in March 2026 [SRC:forum.figma.com/…/51615].

### 3.14 Masks

- **Create**: arrange the mask layer *below* the content; select mask + content; *More options → Use as mask* or ⌃⌘M / Ctrl+Alt+M. Figma creates a mask group containing the selection with the bottom layer as the mask [DOC:360040450253 excerpt].
- **Scope**: a mask affects the siblings above it until another mask, the end of its parent frame/group, or a frame/component with clip content [DOC:360040450253 excerpt][API].
- **Types** [DOC:360040450253 excerpt][API REST]:
  - Alpha (default): reveal = the mask's rendered opacity; 0 % opacity reveals nothing. A layer blur on the mask feathers the edge.
  - Vector: only the outlines (fill regions, and stroke regions if strokes are visible) count; partial opacity is ignored.
  - Luminance: reveal = brightness; black reveals nothing.
- The mask layer itself does not appear in the output [KNOW].

```
renderChildren(parent):
  i = 0
  while i < n:
    c = child[i]
    if c.isMask and c.visible:                 // hidden-mask behaviour: verify (§8 E-41)
       j = next index > i with child[j].isMask, else n
       M = coverage(c)                          // ALPHA: rendered alpha (incl. effects/opacity)
                                                // VECTOR: 1 inside fillGeometry ∪ strokeGeometry of visible paints (AA edges)
                                                // LUMINANCE: luma(rgb)·alpha  — verify transparent areas
       render child[i+1 .. j-1] to offscreen; multiply by M; composite
       i = j
    else: render(c); i++
```

### 3.15 Slice

- Slice tool lives in the toolbar's *Region tools* menu (with Frame and Section); drag over any area; position/size adjustable afterwards [DOC:360040028114 excerpt]. Shortcut **S** [SRC:third-party][KNOW].
- Slices are not tied to existing layers; exporting a slice exports everything visible inside its bounds; export settings live in the Export section; editors only (viewers can export but not create slices) [DOC:360040028114 excerpt].
- `SLICE` has no fills/strokes/effects/children [API]; it never renders on canvas output or in other nodes' exports [KNOW].

### 3.16 Cross-cutting rules

- **Undo**: one step per creation, per completed drag, per committed field edit, per pen/bend/heal operation inside vector edit mode, per boolean/flatten/outline/mask command [KNOW].
- **Copy/paste**: primitives paste with parametric data intact; vector networks paste losslessly [KNOW].
- **Export**: SVG export of inside/outside strokes uses an approximation by default (`svgSimplifyStroke` default `true`) [API]. Primitives may export as `<rect>`/`<ellipse>`/`<path>` [KNOW].
- **Components/instances**: plugin `flatten`/boolean creation cannot take children of instances [API]. Geometry edits of instance sublayers are believed blocked (no vector edit mode), while paint/visibility overrides remain allowed [KNOW, verify §8 E-46].
- **Variables**: bindable fields relevant here: `width`, `height`, `cornerRadius`, four corner radii, `strokeWeight` (+ per side), `opacity`, `visible` [API]. Not bindable: `arcData`, `pointCount`, `innerRadius`, `booleanOperation`, `isMask`, `maskType` [API, by absence from `VariableBindableNodeField`].

---

## 4. Inspector & on-canvas controls (Figma UI3; functional only)

The 2026-09-27 observation confirms UI3 inspector sections *Position, Layout, Appearance, Fill, Stroke, Effects, Export* for a frame [OBS]; the shape-specific rows below are [KNOW] unless tagged.

| Context | Control | Function |
| --- | --- | --- |
| Any shape | Position: X, Y, rotation; flip; Layout: W, H, aspect lock | Standard geometry (transforms area). LINE: W = length, H unavailable [API][KNOW]. |
| Rectangle / polygon / star / ellipse / vector / boolean | Appearance → Corner radius field + *Independent corners* button | Independent corners shows TL/TR/BR/BL (rectangles); the corner panel holds the *Corner smoothing* slider and *iOS* (60 %) button [DOC:360050986854 excerpt]. |
| Polygon | Count | `pointCount` (3–60) [DOC:360040450133 excerpt][KNOW for polygon range]. |
| Star | Count, Ratio | `pointCount`, `innerRadius` ×100 % [DOC:360040450133 excerpt]. |
| Ellipse | (on-canvas) Start, Sweep, Ratio handles with % tooltips | `arcData` [DOC:360040450173 excerpt]. Numeric arc fields in UI3: verify (§8 E-14). |
| Rectangle | Stroke sides menu | Per-side weights [API][KNOW]. |
| Line / open path | Stroke endpoint pickers, join, miter | Caps/joins (strokes area owns the panel) [DOC:360049283914 excerpt][KNOW]. |
| Any shape | *Edit object* button | Enter vector edit mode [DOC:360039957634 excerpt]. |
| Multi-selection | Boolean operations menu (Union/Subtract/Intersect/Exclude), *Flatten*, *Use as mask* | [DOC:360039957534 excerpt][DOC:360040450253 excerpt]. |
| Boolean group | Operation menu shows current op; changing it updates in place | [KNOW]. |
| Mask layer | Mask type selector (Alpha / Vector / Luminance); remove mask | [DOC:360040450253 excerpt for types][KNOW for location]. |
| Vector edit mode | Secondary toolbar: Move, Pen, Bend, Paint, Lasso, Shape builder, Done | [DOC:360039957634 excerpt]. |
| Vector edit mode, vertex selected | X/Y of vertex, Mirroring dropdown, Corner radius (per vertex), endpoint cap | [DOC:360039957634 excerpt][API][KNOW]. |
| Selected shape on canvas | Corner-radius handles (rect), count/ratio/radius handles (polygon/star), arc handles (ellipse), endpoint handles (line) | [DOC:360040450133 excerpt][DOC:360040450173 excerpt][KNOW]. |
| Slice | Export section; no Fill/Stroke/Effects | [DOC:360040028114 excerpt][API]. |
| Context menu | Flatten, Outline stroke, Use as mask, Boolean operations, Simplify vector, Offset vector, Split vector (Draw) | [DOC excerpts][SRC:forum 51615]. |

---

## 5. Keyboard shortcuts

Evidence per row; anything not [DOC] is listed in §8 E-50.

| Action | macOS | Windows | Evidence |
| --- | --- | --- | --- |
| Rectangle | R | R | [API "similar to using the R shortcut followed by a click"][SRC:uxcel] |
| Ellipse | O | O | [API "similar to using the O shortcut followed by a click"][SRC:uxcel] |
| Line | L | L | [SRC:uxcel][KNOW] |
| Arrow | ⇧L | Shift+L | [DOC:360040450133 excerpt] |
| Polygon, Star | — (menu) | — (menu) | [SRC:uxcel "no shortcut found"][KNOW] |
| Place image | ⌘⇧K | Ctrl+Shift+K | [KNOW] |
| Pen | P | P | [SRC:uxcel] |
| Pencil | ⇧P | Shift+P | [DOC:4402723791511 excerpt] |
| Slice | S | S | [SRC:third-party][KNOW] |
| Constrain (square, circle, 45°) while drawing/dragging | ⇧ | Shift | [DOC:360040450133 excerpt][SRC] |
| Draw from centre | ⌥ | Alt | [DOC:360040450133 excerpt] |
| Move draft while drawing | Space | Space | [KNOW] |
| Enter / exit vector edit mode | Return / Esc | Enter / Esc | [DOC:360039957634 excerpt][KNOW for Esc] |
| Bend tool (temporary) | hold ⌘ | hold Ctrl | [SRC:tutorial][KNOW] |
| Paint bucket (edit mode) | ⇧B (older: B) | Shift+B | [DOC:360039957634 excerpt][DOC:360040450213 excerpt] |
| Lasso (edit mode) | Q | Q | [DOC:360039957634 excerpt] |
| Break handle mirroring while dragging | ⌥ | Alt | [SRC:tutorial] |
| Delete & heal | ⇧⌫ | Shift+Delete/Backspace | [DOC:33792593975575 excerpt][SRC:forum] |
| Join selection (edit mode) | ⌘J | Ctrl+J | [SRC:forum, March 2025] |
| Select all points (edit mode) | ⌘A | Ctrl+A | [KNOW] |
| Union | ⌥⇧U | Alt+Shift+U | [SRC:third-party] |
| Subtract | ⌥⇧S | Alt+Shift+S | [KNOW] |
| Intersect | ⌥⇧I | Alt+Shift+I | [KNOW] |
| Exclude | ⌥⇧E | Alt+Shift+E | [SRC:third-party] |
| Flatten | ⌘E | Ctrl+E | [DOC:30101373312279 excerpt][API] |
| Outline stroke | ⌥⌘O | Ctrl+Alt+O | [DOC:33052305733015 excerpt] |
| Outline stroke (legacy pref) | ⌘⇧O | Ctrl+Shift+O | [DOC:33052305733015 excerpt] |
| Use as mask / remove mask | ⌃⌘M | Ctrl+Alt+M | [DOC:360040450253 excerpt] |
| Ungroup (incl. boolean / mask group) | ⌘⇧G | Ctrl+Shift+G | [API "roughly the equivalent of ⌘⇧G"] |
| Scale tool | K | K | [KNOW] |
| Flip horizontal / vertical | ⇧H / ⇧V | Shift+H / Shift+V | [KNOW] |

---

## 6. Parity checklist

All items: **Not started**. Format: `ID name — expected Figma behavior. Data. Test. Milestone·Priority·Evidence`. "Verify" inside an item points to an experiment in §8 that must be run before the item can be accepted.

### 6.1 Shape tools — creation (all primitives)

- [ ] **VC-001** Shape tool shortcuts & menu — R selects Rectangle, O Ellipse, L Line, ⇧L Arrow; Polygon and Star have no default single-key shortcut and are picked from the toolbar's Shape tools menu; the last-picked shape tool becomes the visible tool of that toolbar group. _Data:_ transient `activeTool` _Test:_ press each key with canvas focus and confirm the active tool; pick Star from the menu, switch to Move, confirm the group button now shows Star. _M1·P0·[DOC:360040450133 excerpt][SRC:uxcel.com/lessons/basic-shapes-in-figma-657][KNOW]_
- [ ] **VC-002** Drag creation, any direction — pointer-down fixes an anchor; dragging defines the opposite corner; dragging up/left still yields positive width/height with x/y at the minimum corner. _Data:_ `x`,`y`,`width`,`height` _Test:_ with R drag from (200,200) to (100,150) → rectangle x=100, y=150, w=100, h=50. _M1·P0·[KNOW]_
- [ ] **VC-003** Shift = 1:1 constraint — holding Shift while dragging a rectangle/ellipse/polygon/star produces equal width and height (square, circle, regular polygon/star). _Data:_ `width==height` _Test:_ drag 100×40 with Shift → 100×100 (record which axis wins, §8 E-02). _M1·P0·[DOC:360040450133 excerpt]_
- [ ] **VC-004** Alt/Option = draw from centre — the anchor becomes the centre and the size is twice the drag delta. _Data:_ `x`,`y`,`width`,`height` _Test:_ Alt-drag from (100,100) to (150,120) → x=50, y=80, w=100, h=40. _M1·P0·[DOC:360040450133 excerpt]_
- [ ] **VC-005** Shift+Alt combined — centred and 1:1 at once. _Data:_ as above _Test:_ ⇧⌥-drag from (100,100) to (150,120) → 100×100 centred on (100,100). _M1·P1·[DOC:360040450133 excerpt][KNOW]_
- [ ] **VC-006** Live modifier changes — pressing/releasing Shift or Alt mid-drag updates the draft immediately; the state at pointer-up decides the result. _Data:_ — _Test:_ start a drag, press Shift, release Shift before pointer-up → unconstrained result. _M1·P1·[KNOW]_
- [ ] **VC-007** Space moves the draft — holding Space during a creation drag moves the draft without changing its size; releasing resumes resizing from the moved anchor. _Data:_ — _Test:_ drag 100×100, hold Space, move +50,+50, release Space, finish → same size, offset by 50,50. _M1·P1·[KNOW]_
- [ ] **VC-008** Click creates default size — a click without drag creates a 100×100 shape (line: length 100, horizontal); verify whether the click point is the top-left or centre. _Data:_ `width=100`,`height=100` (LINE `height=0`) _Test:_ press R, click at (300,300) → 100×100 rectangle; record its x/y (§8 E-01). _M1·P0·[API][KNOW]_
- [ ] **VC-009** Click vs drag threshold — pointer movement below a small screen-space threshold (zoom-independent) counts as a click. _Data:_ — _Test:_ move 1–2 screen px at 400 % zoom and at 25 % zoom → default-size shape both times; record threshold (§8 E-01). _M1·P1·[KNOW]_
- [ ] **VC-010** Default appearance — closed shapes get one solid fill (believed #D9D9D9, 100 %) and no stroke; lines/arrows get one solid #000000 stroke, weight 1, no fill. _Data:_ `fills`,`strokes`,`strokeWeight` _Test:_ create one of each type and read the Fill/Stroke sections. _M1·P0·[API][KNOW]_
- [ ] **VC-011** Default names — new layers are named "Rectangle n", "Ellipse n", "Polygon n", "Star n", "Line n", "Arrow n", "Vector n" with an incrementing number. _Data:_ `name` _Test:_ create two rectangles → "Rectangle 1", "Rectangle 2"; delete 2 and create again → record numbering rule (§8 E-04). _M1·P1·[KNOW]_
- [ ] **VC-012** Target parent & stacking — a shape drawn over a frame/component/section becomes the top-most child of the deepest such container under pointer-down; over a group it is not inserted into the group; elsewhere it goes to the page root. _Data:_ `parent`, child index _Test:_ draw over a frame containing a group → shape is a child of the frame, above the group. _M1·P0·[KNOW]_
- [ ] **VC-013** Post-creation state — after one shape is drawn the new shape is selected and the tool returns to Move; Esc during the drag cancels without creating a node or history entry. _Data:_ selection, `activeTool` _Test:_ draw, check tool = Move; start a drag, press Esc → nothing created, undo history unchanged. _M1·P0·[KNOW]_
- [ ] **VC-014** Snapping during creation — the moving corner snaps to smart guides (edges/centres of nearby layers) and, when enabled, to the pixel grid (integer x/y/w/h). _Data:_ — _Test:_ with snap-to-pixel-grid on at 37 % zoom, draw a rectangle → all four values integers. _M1·P1·[KNOW]_
- [ ] **VC-015** Creation is one undo step — undo removes the new shape and restores the previous selection; redo restores it with the same id. _Data:_ history _Test:_ select A, draw B, undo → B gone, A selected; redo → B back. _M1·P0·[KNOW]_
- [ ] **VC-016** Degenerate drags — a drag with zero extent on one axis creates either a default-size shape or a shape with the minimum size (≥0.01 per API); record which. _Data:_ `width`,`height` ≥ 0.01 _Test:_ with R drag perfectly horizontally 100 px → record result (§8 E-06). _M1·P2·[API][KNOW]_
- [ ] **VC-017** Layer type identity — each type shows its own icon and type in the layers panel (rectangle, ellipse, polygon, star, line, vector, boolean-op-specific, mask, slice, image rectangle). _Data:_ `type` _Test:_ create each type and compare the layers-panel rows with Figma. _M1·P1·[KNOW]_
- [ ] **VC-018** Shape inspector sections — a selected shape shows Position, Layout, Appearance, Fill, Stroke, Effects and Export sections. _Data:_ — _Test:_ select a rectangle and compare section list with Figma. _M1·P0·[OBS][KNOW]_
- [ ] **VC-019** Resize keeps parametric data — resizing a primitive changes only width/height; corner radius (px), `arcData`, `pointCount`, `innerRadius` and stroke weight are unchanged; the Scale tool (K) additionally scales radius and stroke weight. _Data:_ `rescale()` vs `resize()` _Test:_ rect 100×100 r=10 stroke 2 → drag-resize to 200×200: r=10, stroke 2; K-scale ×2: r=20, stroke 4. _M1·P0·[API][KNOW]_
- [ ] **VC-020** Flip keeps primitive — ⇧H/⇧V mirror the shape via its transform; the node type and parametric data stay the same (visible on polygons, stars, arcs). _Data:_ `relativeTransform` determinant < 0 _Test:_ flip a 25 % arc vertically → still ELLIPSE with same `arcData`, rendered mirrored. _M1·P1·[KNOW]_

### 6.2 Rectangle

- [ ] **VC-021** Uniform corner radius — one non-negative fractional value applies to all corners; negative input clamps to 0. _Data:_ `cornerRadius` _Test:_ type 12.5 → all four corners 12.5; type −4 → 0. _M1·P0·[API][KNOW]_
- [ ] **VC-022** Independent corners — the Independent corners control reveals TL, TR, BR, BL fields; each edits one corner. _Data:_ `topLeftRadius`,`topRightRadius`,`bottomRightRadius`,`bottomLeftRadius` (REST order TL,TR,BR,BL) _Test:_ set 0/10/20/30 → each corner renders its own radius; REST/clipboard order matches. _M1·P0·[DOC:360050986854 excerpt][API]_
- [ ] **VC-023** Mixed radius display — when corners differ the combined field shows Mixed; typing into it sets all four. _Data:_ `cornerRadius === mixed` _Test:_ corners 0/10/20/30 → field "Mixed"; type 8 → 8/8/8/8. _M1·P1·[API][KNOW]_
- [ ] **VC-024** Uniform radius clamp — the rendered radius is clamped to half of the shorter side; the stored value is not changed. _Data:_ `cornerRadius` stored as typed _Test:_ 100×40 rectangle, radius 999 → renders as pill (r_eff 20); field still shows 999 (verify §8 E-07). _M1·P0·[API][KNOW]_
- [ ] **VC-025** Unequal radius clamp — when adjacent radii exceed a side, rendered radii are reduced by Figma's rule (candidate: proportional budget per side, larger corners first). _Data:_ effective radii (derived) _Test:_ 100×100 with TL=80, TR=40 → compare rendered corner extents against Figma export (§8 E-08). _M1·P1·[SRC:npm figma-squircle@1.1.0][KNOW]_
- [ ] **VC-026** On-canvas radius handles — a selected rectangle large enough on screen shows a radius handle inside each corner; dragging changes all corners; Alt/Option-drag changes one corner; handles hide when the shape is too small on screen. _Data:_ `cornerRadius` / per-corner _Test:_ drag a handle → uniform change; Alt-drag TL → only TL changes; zoom out until handles disappear (record threshold, §8 E-09). _M1·P1·[KNOW]_
- [ ] **VC-027** Corner smoothing control — slider 0–100 % (stored 0–1); the iOS button sets 60 %; it applies to the whole shape only. _Data:_ `cornerSmoothing` _Test:_ click iOS → 0.6; no per-corner smoothing UI exists. _M2·P1·[DOC:360050986854 excerpt][API]_
- [ ] **VC-028** Smoothing geometry — with smoothing ξ each corner consumes p=(1+ξ)·r of each edge, the circular part shrinks to 90·(1−ξ)°, transitions are cubic; when p exceeds the available side budget the effective smoothing is reduced. _Data:_ derived `fillGeometry` _Test:_ 200×200, r=40, ξ=0.6 → compare exported SVG path with Figma's within 0.1 px (§8 E-10). _M2·P1·[SRC:npm figma-squircle@1.1.0][KNOW]_
- [ ] **VC-029** Smoothing needs a radius — with radius 0, any smoothing value renders sharp corners but the value is kept. _Data:_ `cornerSmoothing` retained _Test:_ ξ=1, r=0 → square corners; set r=20 → smoothed corners. _M2·P2·[SRC:squircle.js.org/blog/figma-corner-smoothing-on-the-web][KNOW]_
- [ ] **VC-030** Per-side stroke weights — rectangle strokes can use All/Top/Bottom/Left/Right/Custom sides; differing weights make `strokeWeight` read Mixed. _Data:_ `strokeTopWeight`,`strokeRightWeight`,`strokeBottomWeight`,`strokeLeftWeight` _Test:_ set Top only, weight 4 → only top edge stroked. _M2·P1·[API][KNOW]_
- [ ] **VC-031** Radius variables — `cornerRadius` and each corner radius bind to number variables; binding the combined radius binds all four corners. _Data:_ `boundVariables.topLeftRadius` … _Test:_ bind combined radius to `radius/md` → all four corner fields show the variable; change the mode value → all corners update. _M6·P1·[API]_
- [ ] **VC-032** Rectangle → vector keeps rounding — converting a rounded rectangle to a vector (first vector edit) keeps its look by carrying radius to the four vertices. _Data:_ `VectorVertex.cornerRadius` _Test:_ r=16 rect → enter edit, nudge a vertex 1 px, exit → type VECTOR, corners still 16 (verify §8 E-31). _M2·P1·[KNOW]_

### 6.3 Ellipse & arcs

- [ ] **VC-033** Ellipse tool — O draws an ellipse; Shift = circle; Alt = from centre. _Data:_ `type: ELLIPSE` _Test:_ ⇧-drag → equal w/h. _M1·P0·[DOC:360040450133 excerpt][SRC:uxcel]_
- [ ] **VC-034** Default arc data — a new ellipse is a full closed ellipse. _Data:_ `arcData = {startingAngle:0, endingAngle:2π, innerRadius:0}` (verify exact stored values) _Test:_ create ellipse, read arcData via plugin console or export JSON. _M1·P0·[API][KNOW]_
- [ ] **VC-035** Angle convention — angles are radians; 0 is the +x axis (3 o'clock); positive angles go clockwise on screen. _Data:_ `arcData.startingAngle`,`endingAngle` _Test:_ arc start 0 end π/2 renders the bottom-right quarter. _M2·P0·[API]_
- [ ] **VC-036** Sweep handle — hovering a (selected) ellipse shows a handle at its right-hand point; dragging it around opens the shape; the tooltip shows sweep %; dragging up yields a positive %, down a negative %. _Data:_ `endingAngle` _Test:_ drag handle up to 12 o'clock → tooltip ≈75 %; reset, drag down to 6 o'clock → ≈−75 %. _M2·P0·[DOC:360040450173 excerpt]_
- [ ] **VC-037** Sweep value semantics — sweep % = (endingAngle − startingAngle)/2π × 100; negative values are stored and rendered; |sweep| = 100 % closes the shape. _Data:_ `arcData` _Test:_ set −25 % via handle → arcData difference = −π/2 (verify sign convention, §8 E-11). _M2·P0·[DOC:360040450173 excerpt][KNOW]_
- [ ] **VC-038** Start handle — a dotted handle at the start angle moves the arc's start around the ellipse. _Data:_ `startingAngle` (and `endingAngle` if sweep is preserved) _Test:_ 75 % pie, drag Start by 90° → record whether sweep stays 75 % (§8 E-11). _M2·P1·[DOC:360040450173 excerpt]_
- [ ] **VC-039** Ratio handle — a handle at the centre drags outward to create a ring; value = inner radius ÷ outer radius (0–100 %). _Data:_ `innerRadius` 0…1 _Test:_ drag to tooltip 50 % → innerRadius 0.5; hole radius = half the outer radius on both axes. _M2·P0·[DOC:360040450173 excerpt][API]_
- [ ] **VC-040** Closed ring (donut) — sweep 100 % with ratio > 0 renders a ring with a real hole (not a filled disc), stroked on both contours. _Data:_ `arcData{0,2π,0.5}` _Test:_ place over a coloured background → background visible through the hole; stroke draws outer and inner circles. _M2·P0·[DOC:360040450173 excerpt][KNOW]_
- [ ] **VC-041** Pie slice — ratio 0 with sweep < 100 % renders straight radial edges to the centre. _Data:_ `innerRadius=0` _Test:_ sweep 25 % → quarter pie with two radial edges. _M2·P0·[DOC:360040450173 excerpt][KNOW]_
- [ ] **VC-042** Arc segment (ring sector) — ratio > 0 with sweep < 100 % renders an annular sector closed by two radial edges. _Data:_ `arcData{0,π,0.8}` _Test:_ half ring renders as a "C" band with flat ends. _M2·P0·[DOC:360040450173 excerpt][KNOW]_
- [ ] **VC-043** Arcs on non-circular ellipses — angles are applied in the unit-circle (parametric) space and then scaled to w×h (to verify). _Data:_ — _Test:_ 200×100 ellipse, sweep 12.5 % → compare end-point position with Figma (§8 E-12). _M2·P1·[KNOW]_
- [ ] **VC-044** Corner radius on arcs — `cornerRadius` rounds the corners where the radial edges meet the arcs. _Data:_ `cornerRadius` on ELLIPSE _Test:_ quarter pie r=10 → three rounded corners. _M2·P2·[API][KNOW]_
- [ ] **VC-045** Arc numeric entry & snapping — if UI3 exposes numeric Start/Sweep/Ratio, they map to arcData; Shift while dragging arc handles snaps to fixed increments (to verify). _Data:_ `arcData` _Test:_ §8 E-14. _M2·P2·[KNOW]_
- [ ] **VC-046** Arc persistence — arcData survives resize, rotation, copy/paste, undo/redo, save/reload; SVG export emits a path with the arc geometry. _Data:_ `arcData` _Test:_ copy a ring between files, reload → identical arcData and render. _M2·P1·[KNOW]_
- [ ] **VC-047** Arc not bindable — Start/Sweep/Ratio cannot be bound to variables. _Data:_ absent from `VariableBindableNodeField` _Test:_ no variable binding affordance on arc controls. _M6·P2·[API][SRC:forum.figma.com/suggest-a-feature-11/add-some-variables-for-the-arc-tool-please-35882]_

### 6.4 Polygon & star

- [ ] **VC-048** Polygon creation — the Polygon tool creates a triangle by default; Shift makes it regular (equal w/h). _Data:_ `type: POLYGON`, `pointCount=3` _Test:_ click with Polygon → 100×100 triangle, apex up. _M1·P0·[API][DOC:360040450133 excerpt]_
- [ ] **VC-049** Polygon count — integer field, minimum 3, maximum 60 in the UI; out-of-range input clamps; non-integers round (to verify). _Data:_ `pointCount` integer ≥ 3 _Test:_ type 2 → 3; type 100 → 60; type 5.6 → record result (§8 E-13). _M1·P0·[API][DOC:360040450133 excerpt][KNOW]_
- [ ] **VC-050** Polygon geometry — vertices are evenly spaced, the first at top-centre, and the polygon is stretched to fill its bounding box (to verify). _Data:_ derived `fillGeometry` _Test:_ 100×100 triangle → apex (50,0), base on y=100 spanning the full width; pentagon touches all four sides (§8 E-13). _M1·P0·[KNOW]_
- [ ] **VC-051** Count change keeps the box — changing count keeps x, y, w, h. _Data:_ `pointCount` _Test:_ 3→8 → same bounds. _M1·P1·[KNOW]_
- [ ] **VC-052** Star defaults — 5 points (10 sides), 100×100, default Ratio (believed ≈38 %, to verify). _Data:_ `pointCount=5`,`innerRadius` _Test:_ create star, read Ratio (§8 E-13). _M1·P0·[API][DOC:360040450133 excerpt][KNOW]_
- [ ] **VC-053** Star Ratio — Ratio 0–100 % maps to innerRadius 0–1 (inner-point radius); 100 % renders a regular polygon with 2·count edges. _Data:_ `innerRadius` _Test:_ Ratio 100 % on a 5-point star → decagon. _M1·P0·[API][DOC:360040450133 excerpt]_
- [ ] **VC-054** Star count — integer 3–60. _Data:_ `pointCount` _Test:_ 2 → 3; 61 → 60. _M1·P0·[DOC:360040450133 excerpt]_
- [ ] **VC-055** Star on-canvas handles — a selected star shows three handles: count, ratio and (believed) corner radius; dragging updates the property live with a tooltip. _Data:_ `pointCount`,`innerRadius`,`cornerRadius` _Test:_ drag each handle, compare value changes with Figma (§8 E-13). _M1·P1·[DOC:360040450133 excerpt][KNOW]_
- [ ] **VC-056** Polygon on-canvas handles — a selected polygon shows count and radius handles (to verify). _Data:_ `pointCount`,`cornerRadius` _Test:_ §8 E-13. _M1·P2·[KNOW]_
- [ ] **VC-057** Polygon/star rounding — corner radius rounds every vertex (star: verify whether inner vertices are rounded too); smoothing applies. _Data:_ `cornerRadius`,`cornerSmoothing` _Test:_ 5-point star r=8 → compare outer vs inner vertices with Figma. _M1·P1·[API][KNOW]_
- [ ] **VC-058** Mixed polygon selection — selecting shapes with different counts shows Mixed; typing applies to all. _Data:_ `pointCount` _Test:_ triangle + hexagon → Count "Mixed"; type 5 → both pentagons. _M1·P2·[KNOW]_

### 6.5 Line, arrow & endpoints

- [ ] **VC-059** Line creation — L, drag from start to end; the start vertex is at pointer-down. _Data:_ `type: LINE`, `width`=length, `height=0`, `rotation` _Test:_ drag (0,0)→(100,100) → width ≈141.42, rotation −45° (record sign convention). _M1·P0·[API][SRC:uxcel]_
- [ ] **VC-060** Line angle snapping — Shift constrains the line to 45° increments. _Data:_ `rotation` ∈ {0, ±45, ±90, ±135, 180} _Test:_ ⇧-drag at ~30° → snaps to 45°. _M1·P0·[KNOW]_
- [ ] **VC-061** Line has no height — height is always 0 and the H field is unavailable; resizing never introduces height. _Data:_ `height=0` _Test:_ attempt to set H → not possible. _M1·P0·[API][KNOW]_
- [ ] **VC-062** Line endpoint editing — a selected line shows endpoint handles instead of a bounding box; dragging one changes length and angle around the other; Shift snaps the angle. _Data:_ `width`,`rotation`,`x`,`y` _Test:_ drag the end handle → start stays fixed. _M1·P1·[KNOW]_
- [ ] **VC-063** Arrow tool — ⇧L draws a line with an arrowhead at the drag end and no cap at the start (verify node type LINE vs VECTOR and default cap "Line arrow"). _Data:_ `strokeCap` per end _Test:_ §8 E-15. _M2·P0·[DOC:360040450133 excerpt][KNOW]_
- [ ] **VC-064** Endpoint options — None, Round, Square, Line arrow, Triangle arrow, Reversed triangle, Circle arrow (if present), Diamond arrow, mapped to the plugin/REST enums in §3.5. _Data:_ `StrokeCap` _Test:_ set each option, export JSON, compare enum. _M2·P0·[API][DOC:360049283914 excerpt]_
- [ ] **VC-065** Independent start/end — the two ends of a line/open path can have different endpoint styles. _Data:_ vertex `strokeCap` overrides; node `strokeCap` reads `mixed` _Test:_ start None, end Triangle arrow → only end has an arrow; node-level cap reads Mixed. _M2·P0·[API][DOC:360049283914 excerpt][KNOW]_
- [ ] **VC-066** Arrowhead scaling — arrowheads scale with stroke weight; Line-arrow strokes use the path's weight and their length cannot be edited. _Data:_ `strokeWeight` _Test:_ weight 1 → 4 → head grows 4×. _M2·P1·[DOC:360049283914 excerpt]_
- [ ] **VC-067** Caps only at open ends — caps render only at vertices with exactly one segment; closed paths and degree ≥ 2 vertices ignore them. _Data:_ `strokeCap` _Test:_ set Round on a closed triangle → no visible change. _M2·P0·[API]_
- [ ] **VC-068** Round/Square cap extent — Round and Square extend the stroke by half the weight past the endpoint; None is flush. _Data:_ `strokeCap` _Test:_ 100 px line weight 10 → rendered length 110 with Square, 100 with None (compare `absoluteRenderBounds`). _M2·P0·[KNOW]_
- [ ] **VC-069** Joins and miter limit — Miter/Bevel/Round joins at vertices with ≥2 segments; default miter limit ≈4 (28.96° angle) — sharper corners fall back to bevel. _Data:_ `strokeJoin`,`strokeMiterLimit` (REST `strokeMiterAngle`) _Test:_ polyline with a 20° corner, Miter → beveled; 40° corner → mitered. _M2·P0·[API][KNOW]_
- [ ] **VC-070** Thin-line hit testing — lines and unfilled paths are selectable within a constant screen-space tolerance at any zoom. _Data:_ — _Test:_ 0.5 px line at 25 % zoom is clickable within a few screen px. _M1·P1·[KNOW]_

### 6.6 Images placed as shapes

- [ ] **VC-071** Place image command — ⌘⇧K/Ctrl+Shift+K opens a file picker allowing several images. _Data:_ transient placement queue _Test:_ pick 3 PNGs → cursor carries the first. _M2·P1·[KNOW]_
- [ ] **VC-072** Click places native size — clicking places the image as a RECTANGLE with one IMAGE fill (scale mode Fill) at native pixel size, named after the file. _Data:_ `fills[0].type=IMAGE`,`scaleMode=FILL`,`name` _Test:_ place a 640×480 PNG → 640×480 rectangle named after the file (§8 E-17). _M2·P0·[API][KNOW]_
- [ ] **VC-073** Drag places at drawn size — dragging while placing draws the image rectangle (record whether aspect is locked to the image). _Data:_ `width`,`height` _Test:_ §8 E-17. _M2·P1·[KNOW]_
- [ ] **VC-074** Multiple images — each click places the next queued image; a "place all" option may exist (verify). _Data:_ — _Test:_ §8 E-17. _M2·P2·[KNOW]_
- [ ] **VC-075** Place into existing layer — clicking an existing shape/frame while placing sets the image as that layer's fill (verify). _Data:_ `fills` of target _Test:_ §8 E-17. _M2·P2·[KNOW]_
- [ ] **VC-076** Drop/paste image files — dropping or pasting an image creates the same image rectangle at native size at the drop point (paste: viewport centre or selection rules). _Data:_ as VC-072 _Test:_ drag a JPG onto the canvas. _M2·P0·[KNOW]_
- [ ] **VC-077** Size limit — images larger than 4096 px per side are stored at most 4096 px (verify whether the rectangle keeps native or reduced size). _Data:_ image asset dimensions _Test:_ place a 6000×3000 PNG → record rectangle size and stored image size (§8 E-17). _M2·P1·[API][KNOW]_
- [ ] **VC-078** Image rectangles are normal rectangles — corner radius, booleans, masks, vector edit and constraints work exactly as on other rectangles. _Data:_ `type: RECTANGLE` _Test:_ round the corners of an image rectangle; use it as a mask. _M2·P0·[API][KNOW]_

### 6.7 Pen tool

- [ ] **VC-079** Pen starts a vector — P activates Pen; the first click on empty canvas creates a new VECTOR in the container under the pointer and enters vector edit mode. _Data:_ `type: VECTOR` _Test:_ P, click → new layer "Vector n", edit mode active. _M2·P0·[DOC:360041064174 excerpt][SRC:uxcel][KNOW]_
- [ ] **VC-080** Click = corner point — each click adds a vertex joined to the previous one by a straight segment (zero tangents). _Data:_ `segments[i].tangentStart/End = {0,0}` _Test:_ click 3 points → 3 vertices, 2 straight segments. _M2·P0·[API][KNOW]_
- [ ] **VC-081** Click-drag = smooth point — dragging while adding a vertex pulls out mirrored handles (angle and length); the incoming segment becomes a curve. _Data:_ tangents, vertex `handleMirroring` _Test:_ click A, press-drag at B 50 px right → segment A–B curved, B's handles equal and opposite. _M2·P0·[SRC:tutorial][KNOW]_
- [ ] **VC-082** Alt breaks handle mirroring — holding Alt/Option while dragging out handles lets the outgoing handle move independently. _Data:_ `handleMirroring=NONE` on that vertex (verify) _Test:_ press-drag, hold ⌥ mid-drag → only the outgoing handle follows. _M2·P0·[SRC:tutorial]_
- [ ] **VC-083** Shift constraints — Shift constrains new segments (relative to the previous vertex) and handle directions to 45° increments. _Data:_ — _Test:_ ⇧-click at ~10° → horizontal segment. _M2·P0·[SRC:tutorial][KNOW]_
- [ ] **VC-084** Close path — hovering the path's first vertex shows a closing indicator; clicking it closes the loop and ends the current path. _Data:_ closing segment; enclosed area becomes fillable _Test:_ click 3 points then the first → closed triangle; next click starts a new path in the same vector. _M2·P0·[SRC:tutorial][KNOW]_
- [ ] **VC-085** Finish without closing — Esc ends the current open path but stays in edit mode; further Esc/Enter exits edit mode (record exact sequence). _Data:_ — _Test:_ §8 E-18. _M2·P0·[SRC:tutorial][KNOW]_
- [ ] **VC-086** Connect to existing vertex — clicking an existing vertex connects the current path to it; if the vertex already has segments this creates a branch (degree ≥ 3). _Data:_ segment to existing vertex index _Test:_ draw a line A–B, then from new point C click B → B has degree 2; repeat from D → degree 3. _M2·P0·[DOC:360040450213 excerpt][KNOW]_
- [ ] **VC-087** Insert point on segment — hovering a segment with Pen shows an add-point cursor; clicking inserts a vertex without changing the curve's shape. _Data:_ segment split (de Casteljau) _Test:_ click mid-curve → shape unchanged, vertex count +1. _M2·P0·[KNOW]_
- [ ] **VC-088** Continue from an endpoint — with no active vertex, clicking an open endpoint continues that path. _Data:_ — _Test:_ open path A–B, Esc, click B, click C → B–C added, no new path. _M2·P1·[KNOW]_
- [ ] **VC-089** Pen defaults — a new pen vector has a 1 px black stroke and no fill (verify); closing a loop does not add a fill by itself. _Data:_ `strokes`,`fills` _Test:_ §8 E-19. _M2·P1·[KNOW]_
- [ ] **VC-090** Undo while drawing — ⌘Z removes the last vertex/segment and keeps Pen active from the previous vertex. _Data:_ history _Test:_ click 4 points, ⌘Z → 3 points, next click continues from point 3 (§8 E-20). _M2·P1·[KNOW]_
- [ ] **VC-091** Point snapping — new points snap to existing vertices, to horizontal/vertical alignment with other vertices and to the pixel grid. _Data:_ — _Test:_ draw near the y of an existing vertex → snaps with a guide. _M2·P1·[KNOW]_
- [ ] **VC-092** Pen on a selected vector — choosing Pen while a vector is in edit mode adds new paths to that same network, even when disconnected. _Data:_ same node id _Test:_ edit vector, P, draw a separate stroke → still one layer. _M2·P1·[SRC:tutorial][KNOW]_
- [ ] **VC-093** Curved closing — press-dragging on the first vertex to close sets that vertex's handles (curved close). _Data:_ tangents of first vertex _Test:_ §8 E-20. _M2·P2·[KNOW]_

### 6.8 Vector network data & rendering

- [ ] **VC-094** Lossless network model — vertices, segments, regions and optional per-vertex overrides persist and round-trip unchanged through save/load, copy/paste and undo. _Data:_ `vectorNetwork` _Test:_ build a network with a branch and two region fills, save, reload → deep-equal network. _M0·P0·[API]_
- [ ] **VC-095** Segment = cubic from tangents — each segment renders as a cubic Bézier with control points at vertex + tangent; zero tangents are straight. _Data:_ `tangentStart`,`tangentEnd` _Test:_ known network → rendered path equals reference SVG. _M2·P0·[API]_
- [ ] **VC-096** Branching — vertices with 3+ segments render and stroke correctly, and remain editable. _Data:_ degree ≥ 3 _Test:_ "Y" shape with 3 segments from one vertex. _M2·P0·[DOC:360040450213 excerpt][API]_
- [ ] **VC-097** Default enclosed fill — with no explicit regions, every enclosed area is filled with the node fills. _Data:_ `regions=[]` _Test:_ closed square drawn with Pen, add fill → interior filled. _M2·P0·[DOC:developers.figma.com/docs/plugins/api/VectorNetwork excerpt][SRC:tutorial]_
- [ ] **VC-098** Explicit regions — each region is ≥1 closed loop of segment indices with its own winding rule; loops must be continuous chains (no forks/gaps); invalid input is rejected. _Data:_ `VectorRegion.loops`,`windingRule` _Test:_ import a region whose loop has a gap → rejected with no partial change. _M2·P0·[API][DOC:developers.figma.com/docs/plugins/api/VectorNetwork excerpt]_
- [ ] **VC-099** Per-region fills — a region may carry its own fills, overriding the node fills; region without fills uses node fills (verify). _Data:_ `VectorRegion.fills` (REST `fillOverrideTable`/`overrideID`) _Test:_ §8 E-24. _M2·P1·[API][KNOW]_
- [ ] **VC-100** Mixed node-level reporting — node `strokeCap`, `strokeJoin`, `cornerRadius`, `handleMirroring` show Mixed when vertex overrides differ; setting the node value clears the overrides. _Data:_ vertex overrides _Test:_ different caps on two ends → inspector shows Mixed; choose None → both None. _M2·P0·[API][KNOW]_
- [ ] **VC-101** Path view — `vectorPaths` (M/L/C/Z; Q accepted as input and converted to cubic) is derived from the network; setting paths replaces the network. _Data:_ `vectorPaths` _Test:_ set "M 0 0 Q 50 100 100 0" → stored as one cubic segment. _M2·P1·[API]_
- [ ] **VC-102** Bounds normalisation — after edits the node's x/y/w/h equal the geometry bounds (excluding stroke) and vertex coordinates are re-based (verify). _Data:_ `x`,`y`,`width`,`height`, vertex x/y _Test:_ move one vertex outward 20 px → width +20, other vertices keep page positions (§8 E-23). _M2·P1·[KNOW]_
- [ ] **VC-103** Network strokes — every segment is stroked once; caps at degree-1, joins at degree-2 vertices; behaviour at degree ≥ 3 matches Figma (verify). _Data:_ — _Test:_ §8 E-25. _M2·P1·[API][KNOW]_
- [ ] **VC-104** Stroke alignment on networks — Inside/Outside are computed against the fill area (doubling + masking); on open paths record Figma's behaviour. _Data:_ `strokeAlign` _Test:_ §8 E-25. _M2·P1·[API][KNOW]_
- [ ] **VC-105** Vector hit testing — filled regions are clickable inside; unfilled vectors only near their path (screen-space tolerance). _Data:_ — _Test:_ click inside an unfilled closed path → not selected; click on its stroke → selected. _M1·P0·[KNOW]_

### 6.9 Vector edit mode — entering, selecting, moving

- [ ] **VC-106** Enter edit mode — Enter/Return, double-click, or the Edit object button enters vector edit mode for the selected vector-like layer. _Data:_ transient session _Test:_ each of the three routes on a vector. _M2·P0·[DOC:360039957634 excerpt]_
- [ ] **VC-107** Eligible layers — vector edit mode is available for VECTOR, RECTANGLE, ELLIPSE, POLYGON, STAR and LINE; Enter on a frame/group/boolean selects children instead (verify booleans). _Data:_ — _Test:_ press Enter on each type, record result. _M2·P0·[KNOW]_
- [ ] **VC-108** Multi-edit — several vector layers can be in vector edit mode at once (select several then Enter; Shift-click adds layers). _Data:_ session node set _Test:_ two vectors, Enter → vertices of both editable; nudge one vertex from each together. _M2·P1·[DOC:30965205437975 excerpt][DOC:360040450213 excerpt]_
- [ ] **VC-109** Exit edit mode — Esc (with nothing sub-selected), Enter, the Done button, or clicking empty canvas exits and commits (record exact rules). _Data:_ — _Test:_ §8 E-27. _M2·P0·[KNOW]_
- [ ] **VC-110** Edit-mode toolbar — the secondary toolbar offers Move, Pen, Bend, Paint, Lasso and Shape builder (plus Done). _Data:_ transient sub-tool _Test:_ compare tool list with Figma. _M2·P0·[DOC:360039957634 excerpt]_
- [ ] **VC-111** Vertex selection — click selects a vertex; Shift-click toggles; marquee selects enclosed vertices; ⌘A/Ctrl+A selects all vertices of the edited layers. _Data:_ transient selection _Test:_ marquee over 2 of 4 vertices → 2 selected. _M2·P0·[KNOW]_
- [ ] **VC-112** Segment selection — clicking a segment selects it (record whether its endpoints count as selected); Delete then removes only that segment. _Data:_ — _Test:_ §8 E-28. _M2·P1·[KNOW]_
- [ ] **VC-113** Dragging points — dragging selected vertices moves them together with snapping to other vertices and the pixel grid; connected segments update live. _Data:_ vertex x/y _Test:_ drag a corner of a square onto another vertex → snaps exactly. _M2·P0·[KNOW]_
- [ ] **VC-114** Nudging points — arrow keys nudge selected vertices 1 px, Shift+arrow by the big-nudge amount (default 10 px). _Data:_ vertex x/y _Test:_ → ×3 → +3 px; ⇧→ → +10 px. _M2·P1·[KNOW]_
- [ ] **VC-115** Vertex position fields — with one vertex selected X/Y show and edit its position; with several, record what the fields show. _Data:_ vertex x/y _Test:_ §8 E-28. _M2·P1·[KNOW]_
- [ ] **VC-116** Dragging a segment — with the Move sub-tool, dragging a segment translates it (both endpoints) rather than bending it (verify). _Data:_ vertex x/y _Test:_ §8 E-28. _M2·P1·[KNOW]_
- [ ] **VC-117** Handles visibility & editing — handles are shown for selected vertices and their adjacent segments; dragging a handle edits that tangent within the vertex's mirroring rule. _Data:_ `tangentStart`/`tangentEnd` _Test:_ select a smooth vertex, drag one handle → other handle follows per mirroring. _M2·P0·[API][DOC:360039957634 excerpt]_
- [ ] **VC-118** Context during edit mode — other layers are not selectable while editing; clicking another vector exits/switches (verify). _Data:_ — _Test:_ §8 E-27. _M2·P2·[KNOW]_
- [ ] **VC-119** Transformed layers — editing a rotated/flipped/scaled vector happens in its local space; dragged points follow the pointer on screen exactly. _Data:_ `relativeTransform` unchanged _Test:_ rotate a vector 30°, drag a vertex → it stays under the cursor. _M2·P1·[KNOW]_

### 6.10 Handles, mirroring & Bend

- [ ] **VC-120** Mirroring options — the Mirroring control offers No mirroring, Mirror angle, Mirror angle and length and applies to the selected vertices. _Data:_ `handleMirroring` NONE/ANGLE/ANGLE_AND_LENGTH (vertex or node) _Test:_ set each on a vertex, export JSON. _M2·P0·[DOC:360039957634 excerpt][API]_
- [ ] **VC-121** Mirror angle and length — moving one handle sets the opposite handle to the exact negation. _Data:_ tangents _Test:_ drag handle to (+30,+10) → opposite (−30,−10). _M2·P0·[API][KNOW]_
- [ ] **VC-122** Mirror angle — the opposite handle stays collinear (opposite direction) but keeps its own length. _Data:_ tangents _Test:_ handles lengths 20/40; rotate one 30° → other rotates 30°, length stays 40. _M2·P0·[KNOW]_
- [ ] **VC-123** No mirroring — handles move independently. _Data:_ tangents _Test:_ move one, other unchanged. _M2·P0·[KNOW]_
- [ ] **VC-124** Switching mirroring on asymmetric handles — record whether choosing Mirror angle/length immediately adjusts the opposite handle or only constrains future drags. _Data:_ tangents _Test:_ §8 E-26. _M2·P2·[KNOW]_
- [ ] **VC-125** Alt-drag a handle — Alt/Option while dragging a handle breaks the pair for that vertex (record resulting mirroring value). _Data:_ `handleMirroring` _Test:_ §8 E-26. _M2·P1·[SRC:tutorial][KNOW]_
- [ ] **VC-126** Shift-drag a handle — constrains the handle angle to 45° steps. _Data:_ — _Test:_ ⇧-drag handle near 40° → 45°. _M2·P1·[SRC:tutorial]_
- [ ] **VC-127** Bend tool activation — Bend is chosen from the edit toolbar or held temporarily with ⌘/Ctrl. _Data:_ transient _Test:_ hold ⌘ over a segment → bend cursor; release → Move. _M2·P0·[DOC:360039957634 excerpt][SRC:tutorial]_
- [ ] **VC-128** Bend a segment — dragging a segment with Bend curves it, keeping both endpoints fixed. _Data:_ segment tangents _Test:_ bend the middle of a straight 100 px segment 30 px up → endpoints unchanged, curve passes near the pointer (record exact fit). _M2·P0·[DOC:360039957634 excerpt][KNOW]_
- [ ] **VC-129** Bend from a vertex — dragging from a corner vertex with Bend pulls out new handles; new handles default to Mirror angle. _Data:_ tangents, `handleMirroring=ANGLE` _Test:_ ⌘-drag from a square's corner → symmetric handles, mirroring "Mirror angle". _M2·P0·[DOC:360039957634 excerpt][SRC:forum.figma.com (July 2025 thread on Bend default mirroring)]_
- [ ] **VC-130** Bend click removes handles — clicking a smooth vertex with Bend makes it a sharp corner (tangents cleared). _Data:_ tangents → {0,0} _Test:_ ⌘-click a circle's vertex → corner. _M2·P1·[KNOW]_
- [ ] **VC-131** Move both handles together — Shift-selecting both handles of a vertex and dragging one moves both in the same direction. _Data:_ tangents _Test:_ ⇧-select both handles, drag → both translate. _M2·P2·[DOC:360039957634 excerpt]_

### 6.11 Deleting, healing, joining, per-vertex properties, Paint bucket, Lasso, Shape builder

- [ ] **VC-132** Delete vertices — Delete/Backspace removes selected vertices and all segments attached to them; regions using those segments are removed. _Data:_ network _Test:_ delete one corner of a filled square → open 3-segment path, fill gone (record whether remaining open path keeps a fill). _M2·P0·[KNOW]_
- [ ] **VC-133** Delete segments — deleting a selected segment removes only that segment; vertices left without segments are removed (verify). _Data:_ network _Test:_ §8 E-28. _M2·P1·[KNOW]_
- [ ] **VC-134** Delete & heal — ⇧Delete removes a vertex with two segments and joins its neighbours with one segment approximating the original curve. _Data:_ network _Test:_ heal one vertex of an 8-vertex circle → 7 vertices, shape still round, still closed and filled. _M2·P0·[DOC:33792593975575 excerpt][SRC:forum.figma.com]_
- [ ] **VC-135** Heal edge cases — record ⇧Delete on endpoints (degree 1) and branch vertices (degree ≥ 3). _Data:_ — _Test:_ §8 E-29. _M2·P2·[KNOW]_
- [ ] **VC-136** Alt-click heal — record whether Option/Alt-click on a vertex performs delete & heal, and whether region fills block it (forum report). _Data:_ — _Test:_ §8 E-29. _M2·P2·[SRC:forum.figma.com/archive-21/unable-to-delete-and-heal-option-click-if-you-have-b-filled-a-vector-23209]_
- [ ] **VC-137** Emptying a vector — deleting every vertex removes the layer when leaving edit mode (verify). _Data:_ node deleted _Test:_ ⌘A, Delete, Esc → layer gone; one undo restores it. _M2·P1·[KNOW]_
- [ ] **VC-138** Join selection — "Join selection" (⌘J reported) connects the selected endpoints; record whether it adds a straight segment or merges coincident points. _Data:_ network _Test:_ §8 E-29. _M2·P1·[SRC:forum.figma.com (March 2025 reply)][KNOW]_
- [ ] **VC-139** Split vector — the Draw-era context command splits a vector into separate layers (expected: one per connected component). _Data:_ new VECTOR nodes _Test:_ vector with two disconnected paths → Split vector → two layers. _M2·P2·[DOC:help.figma.com excerpt, article not identified]_
- [ ] **VC-140** Per-vertex corner radius — with vertices selected, the Corner radius field sets only those vertices' radius; the layer then reports Mixed. _Data:_ `VectorVertex.cornerRadius` _Test:_ select one corner of a square, set 20 → only that corner rounded. _M2·P0·[API][KNOW]_
- [ ] **VC-141** Vertex radius clamp — a vertex radius is clamped to half the shorter adjacent segment. _Data:_ effective radius _Test:_ 40 px edges, radius 100 → rendered 20. _M2·P1·[API]_
- [ ] **VC-142** Per-endpoint cap — selecting one endpoint in edit mode and choosing an endpoint style changes only that end. _Data:_ `VectorVertex.strokeCap` _Test:_ open path, select end vertex, Triangle arrow → only that end. _M2·P1·[API][DOC:360049283914 excerpt]_
- [ ] **VC-143** Per-vertex join — record whether the UI can set `strokeJoin` per vertex. _Data:_ `VectorVertex.strokeJoin` _Test:_ §8 E-25. _M2·P2·[API]_
- [ ] **VC-144** Paint bucket highlight — with Paint (⇧B), hovering a closed region shows a striped highlight and a +/− cursor depending on whether the region is filled. _Data:_ transient hover _Test:_ hover filled vs empty region → − vs + cursor. _M2·P0·[DOC:360040450213 excerpt][DOC:360039957634 excerpt]_
- [ ] **VC-145** Paint bucket toggle — clicking toggles that region's fill (the bucket is an on/off toggle, not a colour picker); removing the fill of an inner region creates a hole regardless of path direction. _Data:_ `regions` and `fills` _Test:_ square with inner square (one vector) → click inner region → hole. _M2·P0·[DOC:360040450213 excerpt][SRC:tutorial]_
- [ ] **VC-146** Region fills after exit — paint-bucket results persist after exit and through copy/paste; record whether later node fill changes recolour bucket-filled regions. _Data:_ region `fills` _Test:_ §8 E-24. _M2·P1·[KNOW]_
- [ ] **VC-147** Regions at crossings — record whether two crossing segments without a shared vertex produce separately bucket-fillable regions. _Data:_ — _Test:_ §8 E-24. _M2·P2·[KNOW]_
- [ ] **VC-148** Lasso — Q (or the toolbar) selects points/segments by drawing a free shape around them. _Data:_ transient selection _Test:_ lasso 3 non-rectangularly arranged points → exactly those selected. _M2·P1·[DOC:360039957634 excerpt]_
- [ ] **VC-149** Shape builder regions — in edit mode with one or more vectors, hovering with Shape builder highlights each region formed by the overlaps. _Data:_ transient _Test:_ two overlapping circles → 3 regions highlight individually. _M2·P1·[DOC:31616004109847 excerpt]_
- [ ] **VC-150** Shape builder merge — click-dragging across regions merges them into one layer. _Data:_ new VECTOR _Test:_ drag across left + middle region → one merged shape, right region remains separate. _M2·P1·[DOC:31616004109847 excerpt]_
- [ ] **VC-151** Shape builder extract — clicking a single region pulls it out onto its own layer. _Data:_ new VECTOR _Test:_ click middle lens → separate layer. _M2·P1·[DOC:31616004109847 excerpt]_
- [ ] **VC-152** Shape builder remove — Option/Alt-click removes a region from the canvas. _Data:_ — _Test:_ ⌥-click the lens → removed. _M2·P1·[DOC:31616004109847 excerpt]_
- [ ] **VC-153** Shape builder is destructive — originals are permanently changed; only undo/version history restores them. _Data:_ — _Test:_ merge, then ⌘Z → originals back. _M2·P1·[DOC:31616004109847 excerpt]_
- [ ] **VC-154** Copy/paste paths between vectors — paths copied from one vector and pasted while another vector is in edit mode join that vector's network. _Data:_ network merge _Test:_ copy vector A, edit B, paste → still one layer B containing A's paths. _M2·P1·[SRC:forum.figma.com/suggest-a-feature-11/please-fix-flatten-command-35696][KNOW]_

### 6.12 Pencil

- [ ] **VC-155** Pencil access — ⇧P or the creation-tools menu selects Pencil (also available in Draw mode). _Data:_ transient _Test:_ ⇧P → pencil cursor. _M2·P1·[DOC:4402723791511 excerpt][DOC:31440438150935 excerpt]_
- [ ] **VC-156** Freehand vector — a drag creates a VECTOR whose points are placed automatically with basic smoothing (more points for longer/complex strokes). _Data:_ `vectorNetwork` _Test:_ draw an S-curve → one open path, editable in vector edit mode. _M2·P1·[DOC:360041064174 excerpt][DOC:31440438150935 excerpt]_
- [ ] **VC-157** Pencil defaults — round 3 px black stroke; a different (believed white) colour on dark canvases/frames. _Data:_ `strokes`,`strokeWeight=3`,`strokeCap/Join=ROUND` _Test:_ draw on light and on dark canvas; compare (§8 E-30). _M2·P1·[DOC:4402723791511 excerpt][KNOW]_
- [ ] **VC-158** Pencil straight line — holding Shift constrains the stroke to a straight line. _Data:_ — _Test:_ ⇧-draw → 2-vertex straight path. _M2·P2·[DOC:4402723791511 excerpt]_
- [ ] **VC-159** Pencil session — each stroke becomes its own layer and the tool stays active (verify). _Data:_ — _Test:_ §8 E-30. _M2·P2·[KNOW]_

### 6.13 Primitive vs converted vector

- [ ] **VC-160** Entering edit mode is not converting — entering and leaving vector edit mode on a primitive without any geometric change keeps its type (verify). _Data:_ `type` _Test:_ §8 E-31. _M2·P1·[KNOW]_
- [ ] **VC-161** First edit converts — the first geometric edit on a primitive converts it to VECTOR, dropping arcData/pointCount/innerRadius while keeping name, paints, effects, transform and visual rounding. _Data:_ `type: VECTOR` _Test:_ star → move one point → type VECTOR, Count/Ratio controls gone. _M2·P0·[KNOW]_
- [ ] **VC-162** Conversion undo — one undo step after the first edit returns the original primitive with its parameters. _Data:_ history _Test:_ ⌘Z → STAR with original count/ratio. _M2·P1·[KNOW]_
- [ ] **VC-163** Converted topology — record the vertex/segment counts produced from each primitive (rect 4/4, ellipse 4 cubic segments believed, polygon n, star 2n, arc variants). _Data:_ `vectorNetwork` _Test:_ §8 E-31. _M2·P1·[KNOW]_
- [ ] **VC-164** Layer icon updates — after conversion the layers panel shows the vector icon; the name is unchanged. _Data:_ `type`,`name` _Test:_ observe after VC-161. _M2·P1·[KNOW]_

### 6.14 Boolean groups

- [ ] **VC-165** Boolean availability — with ≥2 supported layers selected, Union/Subtract/Intersect/Exclude are available from the Boolean operations menu. _Data:_ — _Test:_ select 1 layer → record whether ops are disabled; select 2 → enabled. _M2·P0·[DOC:360039957534 excerpt]_
- [ ] **VC-166** Boolean shortcuts — ⌥⇧U Union, ⌥⇧S Subtract, ⌥⇧I Intersect, ⌥⇧E Exclude (Alt+Shift on Windows). _Data:_ — _Test:_ each shortcut on two overlapping rectangles. _M2·P1·[SRC:third-party shortcut lists][KNOW]_
- [ ] **VC-167** Boolean node creation — the selection is wrapped in a BOOLEAN_OPERATION named after the operation, inserted where the top-most selected layer was. _Data:_ `type: BOOLEAN_OPERATION`,`booleanOperation`,`name` _Test:_ union two rects between other siblings → "Union" at the upper rect's index. _M2·P0·[DOC:31130266267287 excerpt][API][KNOW]_
- [ ] **VC-168** Styling source — Union, Intersect and Exclude take fill/stroke/effects from the top-most layer; Subtract from the bottom-most layer; the group's styling is then editable. _Data:_ boolean `fills`,`strokes`,`effects` _Test:_ red bottom, blue top → Union blue, Subtract red (verify Intersect/Exclude, §8 E-33). _M2·P0·[DOC:360039957534 excerpt][KNOW]_
- [ ] **VC-169** Union geometry — the result is the union of all children's areas. _Data:_ derived geometry _Test:_ two overlapping circles → one outline. _M2·P0·[DOC:360039957534 excerpt]_
- [ ] **VC-170** Subtract geometry — the bottom child minus every child above it. _Data:_ derived _Test:_ big square bottom, two small squares above → square with two holes. _M2·P0·[DOC:360039957534 excerpt][KNOW]_
- [ ] **VC-171** Intersect geometry — only the area covered by all children (n-ary; verify 3-operand case). _Data:_ derived _Test:_ three circles in a Venn layout → central region only (§8 E-33). _M2·P0·[KNOW]_
- [ ] **VC-172** Exclude geometry — the area covered by an odd number of children (n-ary; verify). _Data:_ derived _Test:_ three-circle Venn → 4 odd-coverage regions filled (§8 E-33). _M2·P0·[KNOW]_
- [ ] **VC-173** Non-destructive children — children remain selectable and editable (position, size, rotation, corner radius, vector edits); the result updates live. _Data:_ children _Test:_ move a subtracted circle → hole moves. _M2·P0·[DOC:360039957534 excerpt]_
- [ ] **VC-174** Child styling ignored — child fills/strokes/effects/opacity have no effect while inside the boolean and reappear when removed. _Data:_ child paints retained _Test:_ change a child's fill → no visual change; ungroup → child shows its fill. _M2·P0·[DOC:360039957534 excerpt][DOC:31130266267287 excerpt]_
- [ ] **VC-175** Change operation in place — choosing another operation with a boolean group selected changes `booleanOperation` without nesting (verify name update). _Data:_ `booleanOperation` _Test:_ Union → Exclude → same node id, op changed. _M2·P1·[KNOW]_
- [ ] **VC-176** Nested booleans — a boolean may contain booleans; inner results feed the outer operation. _Data:_ nested children _Test:_ (A∪B) − C works and stays editable. _M2·P1·[API][KNOW]_
- [ ] **VC-177** Operand types — shapes, vectors, text and booleans can be operands; frames and sections cannot (record behaviour for groups and instances). _Data:_ — _Test:_ select a frame + rect → boolean commands disabled (§8 E-34). _M2·P1·[DOC:360039957534 excerpt][KNOW]_
- [ ] **VC-178** Hidden operands — hiding a child removes it from the operation (verify). _Data:_ child `visible` _Test:_ hide the subtracting circle → hole disappears. _M2·P1·[KNOW]_
- [ ] **VC-179** Order matters — reordering children inside the boolean changes Subtract results. _Data:_ child order _Test:_ move the bottom child to the top → different subtract result. _M2·P1·[KNOW]_
- [ ] **VC-180** Stroke-only / open operands — record how open paths and stroke-only children participate (fill area only vs stroke area). _Data:_ — _Test:_ §8 E-35. _M2·P1·[KNOW]_
- [ ] **VC-181** Empty results — a non-overlapping Intersect renders nothing but the node remains selectable/editable (record bounds). _Data:_ — _Test:_ §8 E-35. _M2·P2·[KNOW]_
- [ ] **VC-182** Ungroup boolean — Ungroup (context menu or ⌘⇧G) removes the boolean and returns children with their own styling at the same positions. _Data:_ — _Test:_ ungroup → children visible with original fills. _M2·P0·[DOC:360039957534 excerpt][API]_
- [ ] **VC-183** Boolean in layers panel — expandable row with an operation-specific icon; children listed under it. _Data:_ `expanded` _Test:_ compare with Figma. _M2·P1·[DOC:31130266267287 excerpt][API][KNOW]_
- [ ] **VC-184** Boolean bounds & resize — record whether bounds = result geometry or union of children; resizing the boolean scales children like a group. _Data:_ — _Test:_ §8 E-35. _M2·P1·[KNOW]_
- [ ] **VC-185** Boolean corner radius — record whether `cornerRadius` on a boolean rounds the result's corners. _Data:_ `cornerRadius` on BOOLEAN_OPERATION _Test:_ §8 E-35. _M2·P2·[API][KNOW]_
- [ ] **VC-186** Mixed parents — record what happens when the selection spans different parents (common parent chosen, positions preserved). _Data:_ — _Test:_ §8 E-34. _M2·P2·[KNOW]_

### 6.15 Flatten, outline stroke, offset, simplify

- [ ] **VC-187** Flatten command — ⌘E/Ctrl+E or the context menu merges the selection into one VECTOR; works on one or many layers. _Data:_ `type: VECTOR` _Test:_ flatten 3 shapes → one layer. _M2·P0·[DOC:30101373312279 excerpt][API]_
- [ ] **VC-188** Flatten is destructive — flatten is one undo step; the originals are deleted. _Data:_ history _Test:_ flatten, ⌘Z → originals with original ids. _M2·P0·[DOC:30101373312279 excerpt][SRC:forum.figma.com/…/please-fix-flatten-command-35696]_
- [ ] **VC-189** Flatten result properties — record the name, z-index, paints and effects of the result for multi-layer flatten with differing paints/blend modes. _Data:_ — _Test:_ §8 E-36. _M2·P1·[SRC:forum.figma.com/t/how-to-flatten-a-logo-with-blend-modes/4832][KNOW]_
- [ ] **VC-190** Flatten containers — flattening a frame or section merges its children and removes the container. _Data:_ — _Test:_ flatten a frame with 2 shapes → one VECTOR, frame gone. _M2·P1·[DOC:30101373312279 excerpt]_
- [ ] **VC-191** Flatten text — flattening a text layer produces glyph outlines as a vector. _Data:_ — _Test:_ flatten "Ag" → vector, no text properties. _M3·P1·[DOC:30101373312279 excerpt]_
- [ ] **VC-192** Flatten boolean — flattening a boolean group bakes its result into a single vector. _Data:_ — _Test:_ flatten a Subtract → vector with hole, no children. _M2·P0·[KNOW][SRC:forum (boolean vs flatten)]_
- [ ] **VC-193** Flatten restrictions — children of instances cannot be flattened; flatten breaks component-swap links. _Data:_ — _Test:_ select an instance sublayer → Flatten unavailable. _M5·P2·[API][SRC:forum.figma.com/…/please-fix-flatten-command-35696]_
- [ ] **VC-194** Outline stroke command — ⌥⌘O / Ctrl+Alt+O or context menu converts strokes to filled vector paths. _Data:_ new VECTOR with fills = former stroke paints _Test:_ 4 px line → filled 4 px-thick shape. _M2·P0·[DOC:33052305733015 excerpt][API]_
- [ ] **VC-195** Outline stroke details — stroke style colour becomes the fill; stroke properties are gone; dashes become separate pieces; caps, joins, arrowheads and alignment are honoured. _Data:_ — _Test:_ dashed rounded-cap arrow → outline matches the stroked render. _M2·P1·[DOC:33052305733015 excerpt][KNOW]_
- [ ] **VC-196** Outline stroke with fill — record the result when the layer has both fill and stroke (single vector vs group). _Data:_ — _Test:_ §8 E-37. _M2·P1·[API][KNOW]_
- [ ] **VC-197** Outline shortcut preference — "Use old shortcuts for outlines" maps ⌘⇧O to outline stroke and Show outlines to ⇧O. _Data:_ user preference (not document) _Test:_ toggle preference, press ⌘⇧O. _M2·P2·[DOC:33052305733015 excerpt]_
- [ ] **VC-198** Offset vector — Amount (positive outward / negative inward) and Join (square/round) produce a destructively offset path. _Data:_ — _Test:_ offset a square +10 round → 120×120 rounded square. _M2·P2·[DOC:33792861450263 excerpt]_
- [ ] **VC-199** Simplify vector — a slider reduces point count while keeping the shape; destructive. _Data:_ — _Test:_ pencil stroke with 80 points → simplify → fewer points, same silhouette. _M2·P2·[DOC:33792593975575 excerpt][SRC:forum.figma.com/…/icymi-…-july-25-…-43455]_

### 6.16 Masks

- [ ] **VC-200** Use as mask command — ⌃⌘M / Ctrl+Alt+M or More options → Use as mask turns the selection into a masked group. _Data:_ `isMask` _Test:_ select circle (below) + image (above) → image clipped to circle. _M2·P0·[DOC:360040450253 excerpt]_
- [ ] **VC-201** Mask group creation — Figma creates a group (mask group) containing the selection; the bottom-most selected layer becomes the mask. _Data:_ new GROUP, `isMask=true` on bottom child _Test:_ record group name and that a single already-grouped layer toggles in place (§8 E-38). _M2·P0·[DOC:360040450253 excerpt][API][KNOW]_
- [ ] **VC-202** Mask scope — a mask clips every sibling above it until the next mask or the end of the parent. _Data:_ sibling order _Test:_ parent with [mask, A, B, mask2, C] → A,B clipped by mask; C by mask2. _M2·P0·[API][DOC:360040450253 excerpt]_
- [ ] **VC-203** Mask not rendered — the mask layer's own paints are not drawn; they only define coverage. _Data:_ — _Test:_ red mask under a blue rect → blue inside mask shape, no red visible. _M2·P0·[KNOW]_
- [ ] **VC-204** Alpha mask — coverage follows the mask's rendered opacity (fill opacity, layer opacity, gradients); 0 % reveals nothing. _Data:_ `maskType=ALPHA` _Test:_ mask with black→transparent gradient → content fades. _M2·P0·[DOC:360040450253 excerpt][API]_
- [ ] **VC-205** Vector mask — only the outline matters: fill regions and (if stroked) stroke regions are fully opaque; translucency ignored. _Data:_ `maskType=VECTOR` _Test:_ 20 %-opacity mask → content fully visible inside the shape. _M2·P0·[DOC:360040450253 excerpt][API]_
- [ ] **VC-206** Luminance mask — brighter mask pixels reveal more; black reveals nothing. _Data:_ `maskType=LUMINANCE` _Test:_ white→black gradient mask → fade; #000000 mask → nothing. _M2·P1·[DOC:360040450253 excerpt][API]_
- [ ] **VC-207** Mask type data — default ALPHA; maskType persists when isMask is off and does not toggle isMask. _Data:_ `maskType`,`isMask` _Test:_ set LUMINANCE, remove mask, re-add → LUMINANCE kept. _M2·P0·[API]_
- [ ] **VC-208** Mask type control — the UI lets the user switch Alpha/Vector/Luminance on a mask layer (record location). _Data:_ `maskType` _Test:_ §8 E-39. _M2·P1·[DOC:360040450253 excerpt][KNOW]_
- [ ] **VC-209** Feathered masks — a layer blur on an alpha mask feathers the masked edge. _Data:_ mask `effects` _Test:_ blur 10 on mask → soft edge. _M2·P1·[DOC:360040450253 excerpt]_
- [ ] **VC-210** Multiple masks per parent — each mask starts a new masked run of siblings. _Data:_ — _Test:_ as VC-202. _M2·P1·[DOC:360040450253 excerpt][API]_
- [ ] **VC-211** Moving in/out of mask — reordering a layer below the mask (or outside the group) removes it from the masked set; moving it above adds it. _Data:_ child order/parent _Test:_ drag C below the mask in the layers panel → C unclipped. _M2·P1·[API][KNOW]_
- [ ] **VC-212** Remove mask — toggling Use as mask (same command) on the mask layer turns masking off; the group remains. _Data:_ `isMask=false` _Test:_ ⌃⌘M on the mask → content unclipped, mask layer rendered normally. _M2·P0·[KNOW]_
- [ ] **VC-213** Hidden mask — record behaviour when the mask layer is hidden (masking disabled vs content hidden). _Data:_ mask `visible=false` _Test:_ §8 E-41. _M2·P2·[KNOW]_
- [ ] **VC-214** Layers panel presentation — the mask layer shows a mask icon and masked siblings are visually marked as masked. _Data:_ — _Test:_ compare with Figma. _M2·P1·[KNOW]_
- [ ] **VC-215** Mask-capable layers — any blend-capable layer (shape, vector, boolean, text, image rectangle, group, frame, instance) can be a mask (verify containers). _Data:_ `isMask` on `BlendMixin` _Test:_ use text as mask over an image; try a group (§8 E-40). _M2·P1·[API][KNOW]_
- [ ] **VC-216** Mask hit testing — clicks on masked-out (invisible) parts of content do not select it (verify). _Data:_ — _Test:_ §8 E-41. _M2·P2·[KNOW]_
- [ ] **VC-217** Masks in auto layout — record whether the mask layer takes up flow space and how masked children lay out. _Data:_ — _Test:_ §8 E-42. _M4·P2·[KNOW]_
- [ ] **VC-218** Mask export — PNG/SVG/PDF exports of a mask group show the masked result; SVG uses mask/clip constructs. _Data:_ — _Test:_ export mask group as SVG and PNG, compare render. _M2·P1·[KNOW]_

### 6.17 Slice

- [ ] **VC-219** Slice tool — available in the Region tools menu (with Frame and Section), shortcut S. _Data:_ transient _Test:_ press S → slice cursor. _M2·P1·[DOC:360040028114 excerpt][SRC:third-party][KNOW]_
- [ ] **VC-220** Draw & edit slice — dragging defines a SLICE; it can be moved/resized afterwards; a click creates a default-size slice (verify). _Data:_ `type: SLICE`, x/y/w/h _Test:_ drag 200×100 → slice of that size; §8 E-43. _M2·P1·[DOC:360040028114 excerpt][API][KNOW]_
- [ ] **VC-221** Slice has no appearance — no Fill/Stroke/Effects/children; never drawn in canvas output or in other layers' exports. _Data:_ SliceNode mixins _Test:_ export the parent frame → no slice outline. _M2·P1·[API][KNOW]_
- [ ] **VC-222** Slice export content — exporting a slice renders everything visible within its bounds, regardless of layer membership. _Data:_ `exportSettings` _Test:_ slice over two overlapping frames → PNG shows both. _M2·P1·[DOC:360040028114 excerpt]_
- [ ] **VC-223** Slice parent — a slice drawn over a frame becomes that frame's child and moves with it. _Data:_ `parent` _Test:_ move the frame → slice follows. _M2·P2·[KNOW]_
- [ ] **VC-224** Slice export defaults — record whether a new slice gets an export setting automatically. _Data:_ `exportSettings` _Test:_ §8 E-43. _M2·P2·[KNOW]_
- [ ] **VC-225** Slice in layers panel — listed with a slice icon; can be renamed, hidden, locked. _Data:_ `name`,`visible`,`locked` _Test:_ compare with Figma. _M2·P2·[KNOW]_

### 6.18 Cross-cutting

- [ ] **VC-226** Undo granularity — creation, each completed drag, each committed field value, each pen click, each bend/heal/delete, each boolean/flatten/outline/mask command is exactly one undo step. _Data:_ history _Test:_ scripted sequence → count ⌘Z presses to return to start. _M2·P0·[KNOW]_
- [ ] **VC-227** Live field preview vs commit — dragging a numeric scrubber (radius, count, ratio) previews live and commits one undo step on release. _Data:_ history _Test:_ scrub radius 0→30 → one ⌘Z returns to 0. _M1·P1·[KNOW]_
- [ ] **VC-228** Copy/paste fidelity — primitives, arcs, networks with region fills/vertex overrides, booleans and mask groups paste with identical data (new ids). _Data:_ all §2 properties _Test:_ copy/paste each type within and across files; deep-compare. _M1·P0·[KNOW]_
- [ ] **VC-229** SVG import — pasting/dropping SVG creates editable vector layers (paths → VECTOR, preserving fills/strokes). _Data:_ `createNodeFromSvg` equivalent (returns a FRAME) _Test:_ import an SVG icon → frame with vectors. _M8·P1·[API][KNOW]_
- [ ] **VC-230** SVG export of this area — primitives, arcs, networks (per-region fills), booleans (result path), masks and inside/outside strokes (simplified by default) export correctly. _Data:_ `ExportSettingsSVG.svgSimplifyStroke` default true _Test:_ export each, render in a browser, pixel-compare with Figma's export. _M2·P1·[API][KNOW]_
- [ ] **VC-231** Variable bindings — width, height, corner radius (all and per corner), stroke weight (all and per side), opacity and visibility of shapes bind to variables; arc, count, ratio, boolean op and mask flags do not. _Data:_ `VariableBindableNodeField` _Test:_ bind each supported field, switch mode. _M6·P1·[API]_
- [ ] **VC-232** Instances — inside an instance, shape sublayers accept paint/visibility/radius overrides but not vector edits, boolean regrouping or flatten (verify each). _Data:_ overrides _Test:_ §8 E-46. _M5·P1·[API][KNOW]_
- [ ] **VC-233** Auto-layout children — shapes are fixed-size or fill-container children; a LINE's height stays 0 in flow; boolean/mask groups behave like groups (hug their content). _Data:_ `layoutSizingHorizontal/Vertical` _Test:_ §8 E-05. _M4·P1·[API][KNOW]_
- [ ] **VC-234** Constraints — shapes, booleans and vectors inside frames follow constraints on parent resize (vectors scale their geometry with Scale constraints). _Data:_ `constraints` _Test:_ star with Scale/Scale in a frame, resize frame → star stretches. _M4·P1·[API][KNOW]_
- [ ] **VC-235** File-format round trip — every property in §2 (incl. `arcData`, region fills, vertex overrides, `maskType`, `booleanOperation`, slices) survives save → close → open. _Data:_ file format _Test:_ golden-file test of a fixture page. _M0·P0·[API]_
- [ ] **VC-236** Rendering accuracy — rendered fills/strokes of this area match Figma's PNG exports within 1 px / ΔE < 2 for a fixture set (Illigma acceptance criterion, not a Figma claim). _Data:_ — _Test:_ fixture comparison harness. _M8·P1·[KNOW]_
- [ ] **VC-237** Interactive performance — editing networks with ≥1 000 vertices and booleans with ≥20 operands stays interactive (Illigma target, not a Figma claim). _Data:_ — _Test:_ benchmark fixture with frame-time budget. _M8·P1·[KNOW]_

---

## 7. Cross-area dependencies

| Depends on / affects | Sibling spec | Why |
| --- | --- | --- |
| Document model, ids, undo/redo, transactions | M0 foundation (01 — canvas/selection/transforms spec, if present) and `11-file-format-interop.md` | Lossless storage of `vectorNetwork`, `arcData`, region fills, vertex overrides, `isMask`/`maskType`, booleans, slices; one-step undo for every command (VC-094, VC-226, VC-235). |
| Geometry kernel (shared) | — (Illigma infrastructure, M0) | Bézier evaluation/splitting, planar arrangement & face finding (Paint bucket, Shape builder, regions), robust polygon booleans on curves (boolean groups, Shape builder, flatten), stroke outlining with caps/joins/dashes (outline stroke, Vector masks, render), offsetting & simplification. One kernel must serve rendering, hit-testing and export. |
| Canvas, selection, transforms, snapping | 01 (canvas/selection) and `02-frames-groups-sections-constraints.md` | Click/drag thresholds, smart guides, pixel-grid snapping, Scale tool, flips, target-parent rules for new shapes, deep selection into booleans/mask groups, group bounds. |
| Containers & clipping | `02-frames-groups-sections-constraints.md` | Mask groups are groups; frame "Clip content" stops masks; flattening frames/sections; constraints on vectors (VC-234). |
| Auto layout | `03-auto-layout.md` | Drawing into auto-layout frames, LINE height 0 in flow, masks in flow (VC-015/233, VC-217). |
| Paints, strokes, effects, blend, export | `05-paint-effects-color-export.md` | Fills/strokes UI, stroke caps/joins/dashes panel, image paints (placement, crop), pattern/video paints, effects on masks (feathering), blend modes and flatten, PNG/SVG/PDF export, slices' export settings. Figma Draw brushes and variable-width strokes constrain vectors (variable width impossible on branching networks [API]). |
| Text | `06-text-typography.md` | Text as boolean operand, flatten/outline of text, text as mask, text on a path (`TEXT_PATH` built from a vector network [API]). |
| Components & instances | `07-components-variants.md` | Override rules for shape sublayers (no vector edit in instances), flatten breaking swap links, booleans/masks inside components (VC-193, VC-232). |
| Variables & styles | `08-variables-styles-design-systems.md` | Bindable radius/stroke/size fields; region `fillStyleId`; arc/count not bindable (VC-031, VC-047, VC-231). |
| Prototyping | `09-prototyping.md` | Smart Animate between shapes/vectors with matching names (interpolating radius, arc, vertex positions) — owned there. |
| Panels, shortcuts, menus | `10-panels-shortcuts-workflow.md` | Toolbar groups (Shape tools, Creation tools, Region tools), edit-mode secondary toolbar, context menu entries, shortcut table consistency (§5). |
| Interop | `11-file-format-interop.md` | SVG import/export, clipboard to/from other tools, REST `fillGeometry`/`fillOverrideTable` mapping, `.fig` import of vector networks. |
| Figma Draw (out of scope here) | — | Transform groups/repeat, brushes, variable width, texture effects; Offset/Simplify/Split vector are Draw-era but specified here as P2. |

---

## 8. Needs live Figma verification

Each experiment: **setup → action → record**. Run in current Figma Design (UI3) on macOS and Windows where shortcuts differ; record the Figma version/date, zoom, and export the result (PNG 1×/2× + SVG + plugin-console dump of the node JSON) so tests can be generated. Until run, the dependent items stay unaccepted.

| # | Covers | Setup → action → record |
| --- | --- | --- |
| E-01 | VC-008, VC-009 | Empty page, 100 % zoom → R, single click at a known canvas point (read from rulers) → record x/y/w/h (top-left vs centre at click); repeat at 25 % and 400 % with 1, 2, 3, 5 screen-px jitter → record the click/drag threshold. Repeat for O, L, ⇧L, Polygon, Star, Slice. |
| E-02 | VC-003 | Rectangle tool, ⇧-drag a 100×40 and a 40×100 delta → record which axis wins (max, min, or dominant direction). Same for ellipse/polygon/star. |
| E-03 | §3.1, VC-002, VC-050 | Polygon and Star: drag down-right vs up-left vs up-right → record whether the triangle/star is flipped (negative scale in transform) or always apex-up. Line: drag right-to-left → record `rotation` and which end is the start (affects arrowheads). |
| E-04 | VC-011 | Create Rectangle ×3, delete #2, create again; repeat on a second page → record name numbering (per page, per file, gap reuse). Record names created by Arrow, Pen, Pencil, Place image, booleans, mask groups, slices, flatten. |
| E-05 | VC-015, VC-233 | Horizontal auto-layout frame with 3 children → draw a rectangle inside between child 1 and 2 → record flow insertion index vs absolute positioning. Add a line, a boolean group and a mask group as children → record sizing options shown and how a LINE's height behaves. |
| E-06 | VC-016 | R: drag exactly horizontally 100 px (0 px vertical) → record resulting height (0.01? 1? default?). Same with ellipse. |
| E-07 | VC-024 | 100×40 rectangle, radius 999 → record displayed field value, exported SVG radius, and plugin `cornerRadius`. |
| E-08 | VC-025 | 100×100 rectangles with radii (TL,TR,BR,BL) = (80,40,0,0), (100,100,0,0), (90,20,90,20) → export SVG paths and record effective corner extents; compare with the candidate proportional algorithm in §3.2. Repeat with smoothing 60 %. |
| E-09 | VC-026 | Rectangle selected at various zooms → record the on-screen size below which radius handles disappear; drag a handle with and without ⌥/⇧ → record which corners change and tooltip content. |
| E-10 | VC-028 | 200×200 r=40 with ξ ∈ {0, 0.3, 0.6, 1}; and 100×50 r=25 with ξ=0.6 (pill) → export SVG, compare to the `figma-squircle` formula (within 0.1 px); record whether smoothing is reduced when budget is exceeded. |
| E-11 | VC-037, VC-038 | Circle: drag the sweep handle up to 12 o'clock and down to 6 o'clock → record tooltip % and plugin `arcData`. Then drag the Start handle 90° → record whether `endingAngle` moves with it. Record Shift-snapping increments on all three handles. |
| E-12 | VC-043 | 200×100 ellipse with arcData {0, π/4, 0} → export SVG; determine whether the end point lies at parametric angle π/4 (x=100+100·cos45°, y=50+50·sin45°) or at the geometric 45° ray. |
| E-13 | VC-049…VC-057 | Create polygon and star by click; record default `innerRadius`; type counts 2, 5.6, 60, 61, 100; drag each on-canvas handle; export 100×100 triangle, pentagon and 5-point star as SVG → record vertex coordinates (box-fitting rule, first-vertex orientation); radius 8 on a star → record which vertices round. |
| E-14 | VC-045 | Select an ellipse in UI3 → record whether the properties panel offers numeric Start/Sweep/Ratio fields (and their units/ranges). |
| E-15 | VC-063, VC-065, §3.5 | ⇧L arrow → record node type (LINE/VECTOR), name, which end has the head, default head type, and the Stroke panel controls offered for start/end. Set each endpoint option → record plugin `strokeCap` (node and per-vertex) to confirm the UI→enum mapping, incl. whether "Circle arrow" exists. |
| E-16 | VC-059, VC-060, VC-062 | Draw lines in 8 directions with/without ⇧ and ⌥ → record `rotation` sign convention, 45° snapping, and whether ⌥ draws from centre. |
| E-17 | VC-071…VC-077 | ⌘⇧K with 3 images (640×480, 6000×3000, animated GIF): click to place, drag to place, click on an existing rectangle and on a frame, look for "place all" → record node types, sizes (incl. >4096 downscaling), names, fill scale mode, and whether drag is aspect-locked. Drag-and-drop and paste the same files → record placement point. |
| E-18 | VC-085 | Pen: 3 clicks → Esc → record mode; Esc again → record; Enter variants. Record whether ⌘/Ctrl or Space have special meaning during pen drawing. |
| E-19 | VC-089 | Pen-draw an open path and a closed path on light canvas and inside a dark frame → record default stroke colour/weight/cap/join, fills, and whether closing adds a fill. |
| E-20 | VC-090, VC-093 | Pen: 4 clicks then ⌘Z ×2 → record vertex count and whether pen continues; press-drag on the first vertex to close → record the closing vertex tangents. |
| E-21 | VC-081…VC-083 | Pen press-drag: record initial mirroring value of the new vertex; hold ⌥ mid-drag; hold ⇧ mid-drag → record resulting tangents and `handleMirroring`. |
| E-22 | VC-086…VC-088, VC-092 | Select an existing open vector (not in edit mode), press P, click its endpoint → record whether it continues that path; click a mid-segment → record split behaviour; click an existing vertex → record branch creation. |
| E-23 | VC-102 | Vector at x=100,y=100; in edit mode drag the left-most vertex 20 px left → record node x/width and the vertex coordinates via plugin. |
| E-24 | VC-099, VC-146, VC-147 | Square-in-square vector; bucket-remove inner fill → dump `vectorNetwork.regions` (fills present? per-region?); then change node fill colour → record whether the remaining region recolours. Draw two crossing segments without a shared vertex → record whether bucket regions split at the crossing. |
| E-25 | VC-103, VC-104, VC-143 | "Y"/"+" shaped networks with weight 20, Miter/Round joins → export PNG/SVG, record the join shapes at degree-3/4 vertices. Open path with Inside/Outside alignment → record rendering and whether the UI allows it. Record whether a per-vertex join control exists. |
| E-26 | VC-124, VC-125 | Vertex with handles of length 20/40 at non-opposite angles → switch mirroring to Angle, then Angle & length → record immediate changes. ⌥-drag one handle of a mirrored vertex → record the resulting `handleMirroring`. |
| E-27 | VC-109, VC-118 | In edit mode with vertex selected / none selected: press Esc, Enter, click Done, click empty canvas, click another layer → record the resulting mode and selection. |
| E-28 | VC-112, VC-115, VC-116, VC-133 | Click a segment → record selection display and inspector; drag it (Move sub-tool) → translate or bend? Delete it → record surviving vertices. Select 2 vertices → record X/Y/W/H fields shown. |
| E-29 | VC-135, VC-136, VC-138 | ⇧Delete on an endpoint and on a degree-3 vertex → record. ⌥-click a vertex with/without bucket fills → record. Two open paths in one vector: select the two facing endpoints → right-click/⌘J "Join selection" → record whether a segment is added or points merge, and behaviour when points coincide. |
| E-30 | VC-157, VC-159 | Pencil: draw 3 strokes in a row on light canvas and on a dark frame → record layer count, tool persistence, stroke colour/weight/caps, number of points created for a 300 px stroke. |
| E-31 | VC-032, VC-160…VC-163 | For rect (r=16), ellipse, 25 % arc, ring, polygon, star: Enter edit mode → Esc without changes → record type; then nudge one vertex → record type, vertex/segment counts, per-vertex corner radius, name. |
| E-32 | VC-128, VC-129 | Bend a straight 100 px segment by dragging its midpoint 30 px → record resulting tangents (does the curve pass through the pointer?). |
| E-33 | VC-168, VC-171, VC-172 | Three overlapping circles in Venn layout coloured red (bottom), green, blue (top) → apply each operation → record result geometry (SVG) and which child's styling the group receives. |
| E-34 | VC-177, VC-186 | Try booleans with: frame+rect, group+rect, instance+rect, text+rect, section+rect, layers in different parents → record availability, resulting parent and positions. |
| E-35 | VC-180, VC-181, VC-184, VC-185 | Boolean with an open stroked path operand and a stroke-only closed shape → record contribution. Non-overlapping Intersect → record bounds/selection. Subtract result smaller than operands → record boolean x/y/w/h. Set cornerRadius 10 on a Union of two rects → record effect. |
| E-36 | VC-189 | Flatten red rect (Multiply) under blue ellipse (Normal) with drop shadow → record result name, z-index, fills, blend mode, effects, and whether strokes stay strokes. Flatten a rotated rectangle → record rotation baked or kept. |
| E-37 | VC-196 | Rectangle with fill + 8 px inside stroke → Outline stroke → record resulting layer structure (one vector? group?) and paints. Repeat with centre/outside alignment and with a dashed open path with arrowheads. |
| E-38 | VC-201 | Select circle + image (no common group) → ⌃⌘M → record group name and structure. Then inside an existing group select a single layer → ⌃⌘M → record whether a new group is created. |
| E-39 | VC-208 | Select a mask layer → record where Alpha/Vector/Luminance is chosen in UI3 and the default shown. |
| E-40 | VC-215 | Use as mask with a group, a frame (with clip on/off), an instance, a text layer and a boolean as the mask → record allowed/denied and rendering. |
| E-41 | VC-213, VC-216 | Hide the mask layer → record masked content visibility. Click on a masked-out area of an image → record whether it gets selected. |
| E-42 | VC-217 | Auto-layout frame containing mask + 2 children → record spacing, whether the mask occupies flow space, and absolute-position options. |
| E-43 | VC-220, VC-224 | S then click; S then drag over a frame and over empty canvas → record default size, parent, default export settings, layers-panel icon. |
| E-44 | VC-149…VC-152 | Shape builder with two vectors vs one vector with self-overlap; drag across 3 regions; ⌥-click; record resulting layer names, paints and z-order. |
| E-45 | VC-144, VC-145 | Paint bucket on a figure-8 (self-intersecting single loop) and on nested squares → record region detection and the +/− cursor states. Record whether the shortcut is ⇧B or B. |
| E-46 | VC-232 | Instance of a component containing rect, star, vector, boolean and mask group → try: change radius, change star count, enter vector edit, change boolean op, toggle mask, flatten → record which are allowed as overrides. |
| E-47 | VC-226, VC-227 | Scripted sequence (draw, scrub radius, pen 5 points, bend, heal, union, flatten) → count undo steps to return to empty. |
| E-48 | VC-230 | Export rect (r=0 and r>0), ellipse, arc, ring, polygon, star, branching vector with region fills, boolean, mask group as SVG with default settings → record element types used (`rect`/`ellipse`/`path`/`mask`/`clipPath`). |
| E-49 | VC-010 | Create each shape type → record exact default fill hex/opacity and stroke defaults (light and dark canvas). |
| E-50 | §5 | Open Figma's keyboard-shortcut panel on macOS and Windows → confirm every row of §5 marked [KNOW]/[SRC] (place image, slice, booleans, ⌘J, ⌘A in edit mode, bend modifier, flatten alternative ⌥⇧F reported in a forum post). |

---

## 9. Sources

### 9.1 Typings read in this session [API]

Figma Plugin API typings **v1.141.0** — `refs/_figma_plugin-typings/package/plugin-api.d.ts`:

| Lines | Content |
| --- | --- |
| 910–931 | `createRectangle()` — 100×100, default fill, "similar to using the R shortcut followed by a click" |
| 932–955 | `createLine()` — width 100, black stroke weight 1; `strokeCap = 'ARROW_LINES'` example |
| 956–980 | `createEllipse()` — "similar to using the `O` shortcut followed by a click"; `arcData` example (0 → π, innerRadius 0.5) |
| 981–1005 | `createPolygon()` — triangle default |
| 1006–1033 | `createStar()` — 5 points default |
| 1034–1041 | `createVector()` — empty network |
| 1180 | `createSlice()` |
| 1333–1355 | `createTextPath()` (out of scope) |
| 1442–1453 | `createBooleanOperation()` deprecated in favour of `union/subtract/intersect/exclude` |
| 1734 | `createNodeFromSvg()` — "equivalent of the SVG import feature" |
| 1742–1778 | `createImage()` / `createImageAsync()` — PNG/JPEG/GIF, max 4096 px |
| 1870–1959 | `group`, `transformGroup`, `flatten` (≈ ⌘E), `union`, `subtract`, `intersect`, `exclude`, `ungroup` (≈ ⌘⇧G) |
| 4285–4289 | `ArcData` |
| 4749–4782 | `ImagePaint` (`scaleMode`, `imageTransform`, `scalingFactor`, `rotation`, `filters`) |
| 5072–5095, 5120–5160 | export settings (`contentsOnly`, `useAbsoluteBounds`, `svgSimplifyStroke` default true at 5139) |
| 5325–5450 | `WindingRule`, `VectorVertex`, `VectorSegment`, `VectorRegion`, `VectorNetwork`, `VectorPath`, `VectorPaths` |
| 5498 | `MaskType` |
| 6641 | `boundVariables` note on corner-radius binding |
| 6910–6935 | `VariableBindableNodeField` |
| 7337–7348 | `LayoutMixin` (`constrainProportions` deprecated) |
| 7440–7482 | `resize` (≥ 0.01; LINE height exactly 0), `rescale` (Scale tool) |
| 7539–7584 | `BlendMixin.isMask`, `maskType` (subsequent-sibling semantics, default ALPHA) |
| 7622–7632 | `StrokeCap`, `StrokeJoin`, `HandleMirroring` |
| 8648–8708 | `MinimalStrokesMixin` (`strokeJoin`, `strokeAlign` doubling/masking note, `dashPattern`, `strokeGeometry`) |
| 8717–8727 | `IndividualStrokesMixin` |
| 8886–8908 | `GeometryMixin` (`strokeCap` degree-1 rule, `strokeMiterLimit`, `outlineStroke()`, `fillGeometry`) |
| 8913–8936 | `ComplexStrokesMixin` (variable width not on branching networks) |
| 8938–8977 | `CornerMixin` (clamp rule, smoothing 0–1, 0.6 = iOS), `RectangleCornerMixin` |
| 9112–9131 | `VectorLikeMixin` |
| 9360–9370 | `DefaultShapeMixin` |
| 10792–10816 | `TransformGroupNode` (out of scope) |
| 10817–10825 | `SliceNode` |
| 10827–10943 | `RectangleNode`, `LineNode`, `EllipseNode`, `PolygonNode`, `StarNode` (`innerRadius` doc), `VectorNode` |
| 11016–11070 | `TextPathNode` (out of scope) |
| 11284–11303 | `BooleanOperationNode` |
| 12822–12855 | `TransformModifier` (out of scope) |

Figma REST API types **v0.44.0** — `refs/_figma_rest-api-spec/package/dist/api_types.ts`: 140–153 (`rectangleCornerRadii` variable aliases), 504–548 (`HasGeometryTrait`: `fillOverrideTable`, `fillGeometry`, `strokeGeometry`, REST `strokeCap` enum incl. `LINE_ARROW`/`TRIANGLE_ARROW`/`WASHI_TAPE_*`, `strokeMiterAngle` default 28.96°), 551–600 (strokes traits), 612–631 (`CornerTrait`, `rectangleCornerRadii` order TL,TR,BR,BL), 641–667 (`HasMaskTrait`: ALPHA/VECTOR/LUMINANCE definitions, deprecated `isMaskOutline`), 806–836 (shape trait composition), 940–955 (`BooleanOperationNode`), 1006–1109 (Vector/Star/Line/Ellipse/RegularPolygon/Rectangle/TextPath/TransformGroup/Slice nodes), 2153–2190 (`Path` with `overrideID`; `ArcData`: "0° is the x axis and increasing angles rotate clockwise").

### 9.2 Official Figma articles (catalog IDs, retrieved 2026-09-27; only search excerpts seen) [DOC]

| ID | Title | Used for |
| --- | --- | --- |
| 360040450133 | Shape tools | tools menu, Shift/Alt modifiers, Arrow ⇧L, star Count 3–60 / Ratio / three handles, 5-point default |
| 360040450173 | Arc tool: create arcs, semi-circles, and rings | Sweep/Start/Ratio handles, % tooltip and sign, ring recipe |
| 360040450213 | Vector networks | branching, Paint bucket stripes and +/− cursor, regions, multi-layer Shift-click |
| 360039957634 | Edit vector layers | entering edit mode, secondary toolbar, Bend, mirroring modes, Paint ⇧B, Lasso Q |
| 360039957534 | Boolean operations | four ops, styling source, non-destructive children, supported types, Ungroup |
| 31130266267287 | FD4B Combine shapes using boolean operations (lesson) | "Union" group naming, child edits have no effect |
| 360040450253 | Masks | Alpha/Vector/Luminance, Use as mask, ⌃⌘M / Ctrl+Alt+M, mask group, scope, feathering |
| 31616004109847 | Create custom shapes with the shape builder tool | merge/extract/⌥-remove, destructive |
| 30101373312279 | Flatten layers | ⌘E, containers, text, destructive |
| 33052305733015 | Convert strokes to vector paths | ⌥⌘O, legacy shortcut preference, dashes, style colour |
| 33792861450263 | Offset a vector path | Amount, Join |
| 33792593975575 | Simplify a vector path | slider, manual Lasso + ⇧Delete heal |
| 4402723791511 | Sketch on the canvas with the pencil tool | ⇧P, 3 px round black default, Shift straight |
| 31440438150935 | Draw with illustration tools | Draw-mode Pencil, automatic point placement |
| 31440394517143 | Explore Figma Draw | scope boundary (not searched individually) |
| 31440427042839 | Create patterns with transforms | scope boundary (transform groups) |
| 360041064174 | Access design tools from the toolbar | Pen/vector networks, pencil smoothing |
| 360050986854 | Adjust corner radius and smoothing | Independent corners, smoothing slider, iOS 60 %, whole-shape only |
| 360049283914 | Apply and adjust stroke properties | endpoint types, line-arrow sizing, one-ended arrows via edit mode |
| 360040028114 | Export static designs from Figma | Slice tool in Region tools, slice export semantics |
| 30965205437975 | What's new from Config 2025 | shape builder, lasso, multi-edit under enhanced vector editing |
| developers.figma.com/docs/plugins/api/VectorNetwork | Plugin docs (official) | regions defaults and loop validity |
| 360040028034 | Add images and videos to designs | **not searched** (budget exhausted) — image placement rules are [KNOW] |

### 9.3 Other web sources [SRC] (search excerpts unless noted)

- Figma community forum: `where-in-ui3-are-the-boolean-operations-i-e-union-subtract-intersect-exclude-29050`; `please-fix-flatten-command-35696`; `t/how-to-flatten-a-logo-with-blend-modes/4832`; `add-some-variables-for-the-arc-tool-please-35882`; `unable-to-delete-and-heal-option-click-if-you-have-b-filled-a-vector-23209`; `is-there-any-way-to-revert-the-outline-stroke-shortcut-to-how-it-used-to-be-31463`; `simplify-vector-and-offset-vector-incorrectly-placed-at-end-of-figma-menu-51615` (March 2026); `icymi-check-out-all-of-the-recent-updates-from-the-july-25-release-notes-livestream-43455`; `corner-smoothing-on-pills-13144`; `how-can-i-disable-pen-pressure-in-pencil-tool-45313`; `stroke-cap-big-circle-24751`; `i-can-t-use-vector-join-selection-with-my-vector-paths-38970` and a March 2025 reply citing Join Selection ⌘J; a July 2025 thread on Bend-tool default mirroring.
- Figma blog titles only (bodies not read): "Delete and Heal for Vector Networks" (figma.com/blog/delete-and-heal-for-vector-networks), "Desperately seeking squircles" (linked from the typings).
- `figma-squircle@1.1.0` from registry.npmjs.org — **source read** (`src/draw.ts`, `src/distribute.ts`); an unofficial reimplementation, explicitly "does not guarantee to produce the same results as you would get in Figma".
- squircle.js.org/blog/figma-corner-smoothing-on-the-web (smoothing range, no effect without radius).
- uxcel.com lessons (shape shortcuts, Pencil location ⇧P), designcode.io/figma-handbook-apple-watch-ring (arc recipes), codefinity/layerpath pen-tool tutorials (Shift 45°, Alt break handles, close on first point, Esc), madebyevan.com/figma/introducing-vector-networks (title only).

### 9.4 Prior Illigma context (not copied)

`scratchpad/old/docs/figma/source-catalog.md` (article IDs), `feature-guide.md` §9–§10 (scope reminders), `observations/2026-09-27-live-figma.md` [OBS] (inspector sections only; explicitly did not establish vector/mask behavior).
