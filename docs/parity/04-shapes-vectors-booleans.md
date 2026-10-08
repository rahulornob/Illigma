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
- Result: a `BOOLEAN_OPERATION` node containing the selected layers, named after the operation ("Union", …) [SRC/DOC lesson 31130266267287 excerpt][API].
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
| Rectangle | R | R | [SRC:uxcel][KNOW] |
| Ellipse | O | O | [SRC:uxcel][KNOW] |
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
