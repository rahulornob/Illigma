# Fills, strokes, effects, color & export — Figma parity spec

> Status: research draft (date 2026-10-08). Nothing implemented. Every checklist item below is **Not started**; no Illigma feature in this area may be called "1:1 with Figma" until it is implemented **and** validated against live Figma with the experiments in §8.
>
> Evidence legend (every behavioral claim carries at least one tag):
> - **[API]** — Figma Plugin API typings v1.141.0 (`plugin-api.d.ts`) or Figma REST API types v0.44.0 (`api_types.ts`); line references in §9.
> - **[DOC:<id>]** — official Figma Help Center article by ID. **"excerpt"** means only a web-search summary/excerpt of the article was seen in this session; the article body was **not** read (help.figma.com is not fetchable from this environment).
> - **[OBS]** — the read-only live-Figma UI observation of 2026-09-27 (`old/docs/figma/observations/2026-09-27-live-figma.md`).
> - **[KNOW]** — author's prior knowledge of Figma, **not verified in this session**. Everything that rests only on [KNOW] or [SRC] and affects correctness is repeated in §8.
> - **[SRC:<url>]** — third-party or community source (forum posts, tutorials, press, mirrors), seen as a search excerpt only.
>
> Source boundary: Figma is the source of truth for all behavior and data in this document. Visual styling of the controls described here comes from the Framer-style kit and is out of scope for this file.

---

## 1. Scope & terminology

### 1.1 In scope

| Sub-area | Covered here |
| --- | --- |
| Paint stacks | Ordered multiple fills and multiple stroke paints per layer; per-paint visibility, opacity and blend mode; add/remove/reorder; mixed values. |
| Paint types | Solid; Gradient (Linear, Radial, Angular, Diamond) with on-canvas editing; Image (Fill/Fit/Crop/Tile, rotation, 7 adjustments); Video; Pattern; Shader (data pass-through only). |
| Color | Color picker (Custom/Libraries tabs, color area, hue, opacity, color models Hex/RGB/CSS/HSL/HSB, scrubbing), eyedropper, page/document swatches, selection colors, document color profile (sRGB / Display P3), export color profile. |
| Strokes | Multiple stroke paints, weight, Inside/Center/Outside, per-side weights, dash/gap, dash caps, joins, miter limit, caps and arrowheads (start/end), variable-width and brush/dynamic strokes (Figma Draw), stroke-in-layout flag, outline stroke (entry point only). |
| Effects | Drop shadow (incl. spread and "show behind transparent areas"), inner shadow, layer blur (uniform and progressive), background blur, noise (mono/duo/multitone), texture, glass, shader effect (pass-through). |
| Layer appearance | Layer opacity, layer blend mode incl. Pass through, 19 blend modes and their UI labels. |
| Export | Per-node export settings (PNG/JPG/SVG/PDF, scale/width/height constraints, suffix, contents-only, absolute bounds, SVG options, color profile, JPG/PDF quality, resampling), export of multiple layers, slices, page export, export dialog, preview, Copy as PNG/SVG/code, copy/paste properties. |
| Image intake | Drag-drop, place-image tool, paste, supported formats, downsampling to 4096 px. |

### 1.2 Out of scope here (owned elsewhere — see §7)

- Creating/publishing **paint/effect styles** and **color variables** (M6). This file only specifies the *application points* (where a paint/effect field can be bound or linked).
- Vector editing, boolean groups, masks, flatten (M2 vectors spec). This file only specifies *outline stroke* as a stroke entry point and per-vertex cap/join data.
- Text range fills editing UI, text decoration colors (M3).
- Video playback settings, animated GIF playback, MP4/GIF/WebM animation export (M7/M8).
- SVG/PDF/.fig **import** and cross-app clipboard (M8), except paste-of-raster-image as image intake.
- Figma-cloud-only features: team-library color browsing (only local libraries are in scope for a local-first app), paid-plan gating of video, AI image tools, community shader marketplace.

### 1.3 Local-first decisions that do not change Figma behavior

- Images/videos are stored **content-addressed by hash inside the document package** (Figma stores them server-side by hash) [API: `Image.hash` "unique hash of the contents"]. Behavior visible to the user must not differ.
- Browser "download/zip" flows become native save dialogs; Figma's desktop app already "asks you to rename the file and choose where to save it" [DOC:360040028114 excerpt].
- Shader paints/effects and brush assets are Figma-proprietary content; Illigma preserves their data losslessly but renders a documented placeholder until a decision is taken (PE-109/PE-110, PE-156).

### 1.4 Terminology (Figma terms) and common confusions

| Figma term | Meaning | Often confused with |
| --- | --- | --- |
| **Paint** | One entry in `fills` or `strokes` (`SolidPaint`, `GradientPaint`, `ImagePaint`, `VideoPaint`, `PatternPaint`, `ShaderPaint`) [API]. | "Fill" (the whole list) or "color" (only the solid case). |
| **Fill** (section) | The list of paints painted inside the layer's closed regions [API][DOC:360041003694 excerpt]. | Frame "background" (deprecated alias `backgrounds`) [API]. |
| **Stroke** (section) | The list of paints painted on the stroke geometry; all stroke paints share one weight, position and style [DOC:360049283914 excerpt]. | Border (CSS). Inside/outside strokes are *not* CSS borders. |
| **Paint opacity** | `paint.opacity` 0–1 per paint [API]. | Layer opacity; color alpha. A solid paint's `color` has **no alpha** — the hex alpha typed in the picker becomes `paint.opacity` [API: SolidPaint.color doc]. Gradient stops do carry their own alpha (`ColorStop.color: RGBA`) [API]. |
| **Layer opacity** | `node.opacity` 0–1, "as shown in the Layer panel" [API]; applied to the whole composited layer. | Paint opacity. |
| **Blend mode** | Exists at three levels: layer, paint, effect [API][DOC:360040667874 excerpt]. `PASS_THROUGH` is layer-only [API]. | — |
| **Pass through** | Layer default; container children blend directly with what is behind the container [DOC:360040667874 excerpt][KNOW]. | Normal (which isolates the container). |
| **Effect** | Entry in `effects`: DROP_SHADOW, INNER_SHADOW, LAYER_BLUR, BACKGROUND_BLUR, NOISE, TEXTURE, GLASS, SHADER [API]. | Filters (image adjustments are paint-level `filters`, not effects). |
| **Layer blur vs background blur** | Layer blur blurs the layer itself; background blur blurs what is behind the layer inside its shape [SRC:https://grida.co/docs/@designto-code/figma-blur-effects][SRC:https://uxcel.com/lessons/shadows-blurs-866]. | Glass "frost". |
| **Uniform / Progressive** | Blur sub-type `blurType: NORMAL | PROGRESSIVE` [API]; UI labels "Uniform"/"Progressive" [SRC:https://app.uxcel.com/courses/figma-intro/shadows-blurs-866/layer-blur-7140]. | Two separate blur effects. |
| **Image fill** | Images are paints, not nodes; an "image" on canvas is a rectangle with an IMAGE paint [API: createImage remark "Image objects are not nodes"]. | An image layer type. |
| **Crop (image)** | Scale mode `CROP`, non-destructive, "works similarly to using a mask" [DOC:360041098433 excerpt]; REST calls it `STRETCH` [API REST ImagePaint.scaleMode]. | Frame "Clip content", masks. |
| **Selection colors** | Inspector section aggregating colors of a mixed selection [DOC:360042553434 excerpt]. | Page swatches in the picker ("colors on this page") [OBS]. |
| **Export settings** | Document data stored on a node (`exportSettings`) [API]. | The act of exporting; "Save as .fig" (editable document) [KNOW]. |
| **Contents only / Ignore overlapping layers** | `contentsOnly` (default true): export only the node, not overlapping layers [API][SRC:https://forum.figma.com/t/ignore-overlapping-layers-export-option-is-not-respected-in-slice-export/63390]. | Clip content. |
| **File color profile** | `documentColorProfile: LEGACY | SRGB | DISPLAY_P3` [API]. | Export color profile (`colorProfile` on an export setting) [API]. |
| **Outline stroke** | Converts stroke geometry into a new filled vector [API: `outlineStroke()`][DOC:33052305733015 (title only)]. | Inside/outside stroke alignment; Flatten. |

---

## 2. Data model

All property names below are Figma's (Plugin API unless marked REST). "Doc" = persisted document data (saved, undoable, copied with the layer). "UI" = transient/editor state (not saved in the document; may be a per-user preference).

### 2.1 Color primitives

| Name | Shape | Rules | Kind |
| --- | --- | --- | --- |
| `RGB` | `{r,g,b}` floats | 0–1 per channel [API] | Doc |
| `RGBA` | `{r,g,b,a}` floats | 0–1 per channel [API] | Doc |
| Color space of stored values | — | Values are interpreted in the file's `documentColorProfile`; changing the profile with "Assign" keeps numbers, "Convert" rewrites numbers to keep appearance [DOC:360039825114 excerpt] | Doc |
| `figma.mixed` | sentinel | Returned when a property differs across sub-parts (text ranges, vertices, sides) [API] | — |

### 2.2 Paint (common to all paint types)

| Field | Type / values | Default | Notes |
| --- | --- | --- | --- |
| `type` | `SOLID`, `GRADIENT_LINEAR`, `GRADIENT_RADIAL`, `GRADIENT_ANGULAR`, `GRADIENT_DIAMOND`, `IMAGE`, `VIDEO`, `PATTERN`, `SHADER` [API] | — | REST omits VIDEO and SHADER [API REST]. |
| `visible` | boolean | `true` [API] | Hidden paints stay in the list. |
| `opacity` | number 0–1 | `1` [API] | |
| `blendMode` | `BlendMode` minus `PASS_THROUGH` | `NORMAL` [API][DOC:360040667874 excerpt] | |
| `boundVariables.color` | `VariableAlias` | — | **SOLID only** (`VariableBindablePaintField = 'color'`) [API]. |

**SolidPaint**: `color: RGB` (no alpha; alpha lives in `opacity`) [API].

**GradientPaint** [API]:
- `gradientTransform: Transform` (2×3 affine) — "positioning of the gradient within the layer".
- `gradientStops: ColorStop[]`; `ColorStop = { position: 0..1, color: RGBA, boundVariables?.color }`.
- REST equivalent: `gradientHandlePositions: Vector[3]` in normalized object space (0,0 = top-left of bounding box, 1,1 = bottom-right): [0] start (value 0), [1] end (value 1), [2] width handle [API REST].

**ImagePaint** [API]:
- `scaleMode: FILL | FIT | CROP | TILE` (REST: `FILL | FIT | TILE | STRETCH`; STRETCH ≙ CROP) [API REST].
- `imageHash: string | null`.
- `imageTransform?: Transform` — only for CROP.
- `scalingFactor?: number` — only for TILE.
- `rotation?: number` — TILE/FILL/FIT, "must be in increments of +90" (degrees) [API].
- `filters?: ImageFilters` — `exposure, contrast, saturation, temperature, tint, highlights, shadows`, each −1.0…+1.0, default 0.0 [API].
- REST adds `gifRef` for animated GIFs [API REST].

**VideoPaint** [API]: same as ImagePaint with `videoHash` and `videoTransform`.

**PatternPaint** [API]: `sourceNodeId`, `tileType: RECTANGULAR | HORIZONTAL_HEXAGONAL | VERTICAL_HEXAGONAL`, `scalingFactor`, `spacing: Vector`, `horizontalAlignment: START | CENTER | END`; REST additionally has `verticalAlignment: START | CENTER | END` [API REST]. Must be set through async setters because the source node must be loaded [API].

**ShaderPaint** [API]: `id`, `properties` (map of property-definition id → value), `propertyMetadata` (read-only definitions; types BOOLEAN, TEXT, NUMBER, IMAGE, INSTANCE_SWAP, SLOT, COLOR, POINT, LINE, CIRCLE, CIRCLE_POINT, COLOR_POINT, GRADIENT).

### 2.3 Node-level paint, stroke and appearance properties

| Property | Type | Default (new layer) | Kind | Notes |
| --- | --- | --- | --- | --- |
| `fills` | `Paint[]` or `mixed` | per node type (§3.2.2) | Doc | `mixed` only for text with per-range fills [API]. Page uses `backgrounds` (single solid paint) [API]. |
| `fillStyleId` | string or `mixed` | `""` | Doc | Link to PaintStyle [API]. |
| `strokes` | `Paint[]` | per node type | Doc | |
| `strokeStyleId` | string | `""` | Doc | |
| `strokeWeight` | number ≥ 0, fractional, or `mixed` | 1 when a stroke is added [KNOW] | Doc | `mixed` when per-side weights differ [API]. Variable-bindable [API]. |
| `strokeTopWeight`/`Right`/`Bottom`/`Left` | number ≥ 0 | = strokeWeight | Doc | Rectangles and frame-like nodes only (`IndividualStrokesMixin`) [API]; REST `individualStrokeWeights {top,right,bottom,left}` only present when used [API REST]. Each variable-bindable [API]. |
| `strokeAlign` | `CENTER | INSIDE | OUTSIDE` | shapes INSIDE, lines CENTER [DOC:360049283914 excerpt] | Doc | Inside/outside implemented as doubled weight masked by the fill [API]. |
| `strokeJoin` | `MITER | BEVEL | ROUND` or `mixed` | MITER [KNOW] | Doc | Per-vertex in vector networks [API]. |
| `strokeCap` | `NONE | ROUND | SQUARE | ARROW_LINES | ARROW_EQUILATERAL | DIAMOND_FILLED | TRIANGLE_FILLED | CIRCLE_FILLED` or `mixed` | NONE [KNOW] | Doc | Per-vertex in vector networks; `mixed` when endpoints differ [API]. REST names: `LINE_ARROW`, `TRIANGLE_ARROW`, plus FigJam `WASHI_TAPE_1…6` [API REST]. Connectors have their own `ConnectorStrokeCap` set (incl. ERD caps) [API]. |
| `strokeMiterLimit` | number (SVG-style ratio) | 4 (derived) | Doc | REST exposes `strokeMiterAngle`, default **28.96°** [API REST]; 1/sin(28.96°/2) ≈ 4.0. |
| `dashPattern` | `number[]` (alternating dash, gap, … px) | `[]` (solid) | Doc | REST `strokeDashes` [API REST]. |
| `strokesIncludedInLayout` | boolean | false [KNOW] | Doc | Auto layout frames only [API]; UI "Inside stroke: Included" [OBS]. |
| `variableWidthStrokeProperties` | `{widthProfile: UNIFORM|WEDGE|TAPER|QUARTER_TAPER|EYE|MIRRORED_TAPER}` or `{widthProfile:'CUSTOM', variableWidthPoints:[{position 0..1, width (fraction of weight)}]}` or `null` | null | Doc | Not on branching vector networks; not with dynamic strokes [API]. |
| `complexStrokeProperties` | `{type:'BASIC'}` / DYNAMIC `{frequency 0.01–20, wiggle ≥0, smoothen 0–1}` / BRUSH STRETCH `{brushName, direction FORWARD|BACKWARD}` / BRUSH SCATTER `{brushName, gap ≥0.25, wiggle ≥0, sizeJitter 0–3, angularJitter −180–180, rotation −180–180}` | BASIC | Doc | Setting DYNAMIC removes variable-width points [API]. |
| `opacity` | 0–1 | 1 | Doc | Variable-bindable (`opacity`) [API]. |
| `blendMode` | `BlendMode` incl. `PASS_THROUGH` | PASS_THROUGH [DOC:360040667874 excerpt] | Doc | |
| `effects` | `Effect[]` | `[]` | Doc | |
| `effectStyleId` | string | `""` | Doc | |
| `isMask`, `maskType` | boolean, `ALPHA|VECTOR|LUMINANCE` | false, ALPHA | Doc | Owned by masks spec; listed because mask paints drive mask alpha [API]. |
| `exportSettings` | `ExportSettings[]` | `[]` | Doc | §2.6. |

**Which nodes carry what** [API mixins]:

| Node | fills | strokes | per-side weights | effects | opacity/blend | export |
| --- | --- | --- | --- | --- | --- | --- |
| Rectangle | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ellipse, Polygon, Star, Vector, BooleanOperation | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| Line | ✓ (data; not rendered — no closed region) | ✓ | — | ✓ | ✓ | ✓ |
| Text, TextPath | ✓ (per range) | ✓ (node-wide) | — | ✓ | ✓ | ✓ |
| Frame, Component, ComponentSet, Instance | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Group | — | — | — | ✓ | ✓ | ✓ |
| Section | ✓ | ✓ (`MinimalStrokesMixin`) | — | — | — | ✓ |
| Slice | — | — | — | — | — | ✓ |
| Page | `backgrounds` (single solid) | — | — | — | — | (page canvas export) |

### 2.4 Effects

| Effect | Fields (type, rule, default) | Variable-bindable |
| --- | --- | --- |
| `DROP_SHADOW` | `color: RGBA`; `offset: Vector`; `radius ≥ 0`; `spread?` (default 0; positive = larger; only honored on rectangles, ellipses, and frames/components/instances with visible fills and `clipsContent`); `visible`; `blendMode` (typ. NORMAL); `showShadowBehindNode?` (default false) [API] | color, radius, spread, offsetX, offsetY [API] |
| `INNER_SHADOW` | same minus `showShadowBehindNode`; positive spread **contracts** [API] | same |
| `LAYER_BLUR` / `BACKGROUND_BLUR` | `radius ≥ 0` (for progressive = end radius); `visible`; `blurType: NORMAL | PROGRESSIVE`; progressive adds `startRadius`, `startOffset`, `endOffset` (normalized object space) [API] | radius [API] |
| `NOISE` | `noiseType: MONOTONE | DUOTONE | MULTITONE`; `color: RGBA`; `blendMode`; `noiseSize` (= `noiseSizeVector.x` when vector set); `noiseSizeVector?` (x must equal noiseSize or write throws); `density`; DUOTONE adds `secondaryColor: RGBA`; MULTITONE adds `opacity` [API] | none ("currently do not support binding") [API] |
| `TEXTURE` | `visible`; `noiseSize`/`noiseSizeVector?`; `radius`; `clipToShape: boolean` [API] | none [API] |
| `GLASS` | `visible`; `lightIntensity 0–1`; `lightAngle` (degrees); `refraction 0–1`; `depth ≥ 1`; `dispersion 0–1`; `radius` (frost) [API]. The motion keyframe enum additionally names `SPLAY`, `REFRACTION_RADIUS`, `SPECULAR_ANGLE`, `SPECULAR_INTENSITY`, `CHROMATIC_ABERRATION`, `REFRACTION_INTENSITY` [API: EffectKeyframeFieldName] — i.e. the internal model has a "splay" parameter not exposed in `GlassEffect` | none per typings [API]; third-party reports variable support was later added [SRC:https://www.createwith.com/tool/figma/updates/figma-rolls-out-glass-effect-updates-with-independent-corner-rounding-and-variab] → conflict, §8 |
| `SHADER` | `visible`; `id`; `properties`; `propertyMetadata` [API] | via property values (`VariableAlias`) [API] |

REST v0.44.0 `Effect` lacks GLASS and SHADER [API REST]; Illigma's own file format must still persist them.

### 2.5 Blend modes

`BlendMode` = PASS_THROUGH (layers only), NORMAL, DARKEN, MULTIPLY, LINEAR_BURN, COLOR_BURN, LIGHTEN, SCREEN, LINEAR_DODGE, COLOR_DODGE, OVERLAY, SOFT_LIGHT, HARD_LIGHT, DIFFERENCE, EXCLUSION, HUE, SATURATION, COLOR, LUMINOSITY — 19 values [API]. UI groups and labels: Default (Pass through, Normal) · Darker (Darken, Multiply, **Plus darker** = LINEAR_BURN, Color burn) · Lighter (Lighten, Screen, **Plus lighter** = LINEAR_DODGE, Color dodge) · Contrast (Overlay, Soft light, Hard light) · Comparative (Difference, Exclusion) · Color (Hue, Saturation, Color, Luminosity) [DOC:360040667874 excerpt][SRC:https://developers.figma.com/docs/plugins/api/BlendMode (search excerpt)].

### 2.6 Export settings (Doc data on the node)

| Field | Values | Default | Formats |
| --- | --- | --- | --- |
| `format` | `PNG`, `JPG`, `SVG`, `PDF` (plugin-only: `SVG_STRING`, `JSON_REST_V1`; animation: `MP4`, `GIF`, `WEBM`) | PNG when added [KNOW] | — |
| `constraint` | `{type: SCALE | WIDTH | HEIGHT, value}` | `{SCALE, 1}` [API] | PNG, JPG (REST: all) |
| `suffix` | string | `""` [API] | all |
| `contentsOnly` | boolean | `true` [API] | all |
| `useAbsoluteBounds` | boolean | `false` [API] | all |
| `colorProfile` | `DOCUMENT | SRGB | DISPLAY_P3_V4` | `DOCUMENT` [API] | all |
| `svgOutlineText` | boolean | `true` [API] | SVG |
| `svgIdAttribute` | boolean (layer names as `id`) | `false` [API] | SVG |
| `svgSimplifyStroke` | boolean | `true` [API] | SVG |
| JPG/PDF image quality (UI "Image quality": High/Medium/Low) | — | JPG High, PDF Medium [SRC:https://figmalion.com/topics/import-export] | JPG, PDF — **not in typings**; storage location unknown → §8 |
| Image resampling (UI: Detailed = bicubic, Basic = nearest neighbor) | — | Detailed [SRC:https://figmalion.com/topics/import-export] | JPG, PNG, PDF — **not in typings** → §8 |
| REST render API extras | `scale` 0.01–4, `svg_include_node_id` (`data-node-id`) [API REST] | — | — |

Animation export (`MP4`/`WEBM`: fps 12|24|30|60 default 30, quality LOW|MEDIUM|HIGH default HIGH; `GIF`: fps 8|12|15|24|30 default 15, loopCount 0–1000 default 0; scale presets 0.5, 0.75, 1, 1.5, 2, 3, 4 — "the standard Export panel scales") applies only to animated top-level frames [API] and is out of scope (M7/M8), but the scale preset list is evidence for the static Export panel presets.

### 2.7 Document-level and asset data

| Item | Values | Kind |
| --- | --- | --- |
| `documentColorProfile` | `LEGACY | SRGB | DISPLAY_P3`; LEGACY for files created before color management [API] | Doc |
| Page `backgrounds` / `prototypeBackgrounds` | single solid paint each [API] | Doc |
| Image asset | bytes + hash; PNG/JPEG/GIF accepted by plugin `createImage`; max 4096 px per side [API] | Doc (asset store) |
| Video asset | bytes + hash; MP4/MOV/WebM, max 100 MB [API] | Doc (asset store) |
| Paint/Effect styles | `PaintStyle.paints`, `EffectStyle.effects`, bindable `paints`/`effects` [API] | Doc (M6) |

### 2.8 Transient UI state (not document data)

- Picker target (node set + `fills|strokes` + paint index + selected gradient stop), picker tab (Custom/Libraries), picker open/closed [OBS][KNOW].
- Active color model (Hex/RGB/CSS/HSL/HSB) — per-user preference; Figma has a reported regression where it resets to CSS [SRC:https://forum.figma.com/report-a-problem-6/color-picker-color-model-resets-to-css-58618].
- Eyedropper active/inactive; loupe position [KNOW].
- Crop mode active; gradient-handle editing active; progressive-blur handle editing active [KNOW].
- Selection colors "See all" expansion [DOC:360042553434 excerpt].
- Export preview expanded/collapsed [DOC:360040028114 excerpt].
- New-file default color profile (Preferences > Color profile) — user preference [DOC:360039825114 excerpt].

---

## 3. Behavior specification

### 3.1 Paint stacks

#### 3.1.1 Ordering
- `fills`/`strokes` are ordered lists. Rendering is bottom-to-top; the inspector lists the **top-most paint first** [KNOW]. The array index ↔ panel row mapping (index 0 = bottom, rendered first; last index = top row) is [KNOW] and must be confirmed (V-01).
- Reordering by dragging a row changes array order; one undo step [KNOW].

#### 3.1.2 Adding, removing, hiding
- A newly drawn layer gets a default paint per node type (§3.2.2). "By default, Figma adds a solid fill" [DOC:360041003694 excerpt].
- `+` on a Fill section with paints adds a new paint on top; with zero paints it adds one default solid [KNOW] (exact default colors: V-02).
- `−` removes that row only; the section collapses to a header with `+` when empty [KNOW].
- Eye toggle flips `visible`; hidden paints are excluded from rendering, hit-testing (if the only paint), selection colors (V-14) and export, but persist [API][KNOW].
- Fills render only in **closed regions**; lines and open paths show no fill even if fills exist, while strokes render on both [DOC:360041003694 excerpt].

#### 3.1.3 Compositing (pseudo-code; semantic baseline [KNOW], verify V-03)

```
renderLayer(node, backdrop):
  isolated = node.blendMode != PASS_THROUGH || node.opacity < 1 || hasLayerBlur(node) || node.isMask
  target   = isolated ? newTransparentSurface() : backdrop
  drawDropShadows(node, target)                    // §3.6.2; behind the layer content
  drawBackgroundBlur(node, target, backdrop)       // §3.6.4; samples content behind
  for p in node.fills (bottom → top) if p.visible:
      src = evaluatePaint(p, node.box) * p.opacity  // premultiplied RGBA
      src = clip(src, fillRegion(node))
      target = blend(target, src, p.blendMode)      // W3C compositing: source-over + blend function
  if node has children (frame-like/group): for c in children (bottom → top): renderLayer(c, target), clipped if clipsContent
  drawInnerShadows(node, target)                   // order relative to strokes/children: V-04
  for p in node.strokes (bottom → top) if p.visible:
      src = clip(evaluatePaint(p, node.box) * p.opacity, strokeRegion(node))   // §3.5.2
      target = blend(target, src, p.blendMode)
  applyNoiseTextureGlass(node, target)             // order: V-05
  if hasLayerBlur(node): target = gaussian(target, sigma = radius/2)          // §3.6.3
  if isolated: backdrop = blend(backdrop, target * node.opacity, node.blendMode == PASS_THROUGH ? NORMAL : node.blendMode)
```

- Paint blend modes blend against everything already drawn beneath **within the current compositing target**; for a non-isolated leaf (Pass through, opacity 1) that target includes content behind the layer [KNOW] (V-03).
- Layer opacity is group opacity: overlapping fill/stroke/children inside the layer do not show through each other when the layer is at 50% [KNOW].

### 3.2 Solid paints and the color picker

#### 3.2.1 Opening and targeting
- The picker opens by clicking a paint swatch in Fill or Stroke; a layer must have a fill/stroke first [DOC:360041003774 excerpt]. It edits exactly that paint; when several selected layers share identical paints the shared row edits all of them [DOC:360041003774 excerpt].
- UI3 picker contents (observed): Custom/Libraries tabs; paint-type controls; hue and opacity; color format; eyedropper control; page swatches; close control [OBS]. The paint-type control offered Solid, Gradient, Pattern, Image, Video, Shader in the observed account [OBS].
- Picker survives scrolling; selection change re-targets or closes (V-06) [KNOW].
- Esc / click outside / close button closes; edits are already applied (no cancel/revert) [KNOW] (V-06).

#### 3.2.2 Default paints per node type ([KNOW], verify V-02)

| Created by | fills | strokes |
| --- | --- | --- |
| Rectangle/Ellipse/Polygon/Star tools | SOLID #D9D9D9 100% | none |
| Frame tool | SOLID #FFFFFF 100% | none |
| Line / Arrow tools | none | SOLID #000000 100%, 1 px, CENTER; Arrow tool: end cap arrow |
| Pen / Pencil | none | SOLID #000000 100%, 1 px, CENTER |
| Text | SOLID #000000 100% | none |
| Section | SOLID (light) | (verify) |
| `+` Fill on empty | SOLID (shape gray / frame white?) | — |
| `+` Fill on existing | SOLID #000000 20% on top | — |
| `+` Stroke on empty | — | SOLID #000000 100%, 1 px, INSIDE for closed shapes [DOC:360049283914 excerpt for position] |

#### 3.2.3 Color area, hue, opacity
- Color area is HSB: x = saturation 0→100 %, y = brightness 100 % (top) → 0 % (bottom) at the current hue [KNOW].
- Hue slider 0–360°. When saturation or brightness is 0 the hue is not representable in RGB; the picker keeps the last hue so dragging back restores it (V-07) [KNOW].
- Opacity slider/field writes `paint.opacity` (solid) or the **selected stop's alpha** (gradient) [API][KNOW].
- Dragging updates the canvas live; one undo entry per gesture (pointer-down → pointer-up) [KNOW].

#### 3.2.4 Color models and fields
- Models: Hex (default), RGB, CSS, HSL, HSB. Switching models changes only how values are shown, never the stored color [DOC:360043042113 excerpt].
- Hex: 8-character `#RRGGBBAA` syntax, AA 00 = transparent … FF = opaque [DOC:360043042113 excerpt]. RGB: integers 0–255 [DOC:360043042113 excerpt]. CSS: rgba() notation; CSS color strings may be typed directly [DOC:360043042113 excerpt].
- HSL vs HSB differ in saturation/lightness treatment [DOC:360043042113 excerpt].
- Option (Mac) / Alt (Windows) + drag on RGB/HSL/HSB fields scrubs values (left decreases, right increases) [DOC:360043042113 excerpt].

Hex parsing ([KNOW]; verify V-08):
```
parseHex(input):
  s = trim(input).removePrefix('#')
  if !/^[0-9a-f]+$/i: return INVALID            // field reverts, no history entry
  switch len(s):
    1: s = s*6            // "a"  -> "aaaaaa"     (verify)
    2: s = s*3            // "ab" -> "ababab"     (verify)
    3: s = s[0]*2 + s[1]*2 + s[2]*2                // "f0c" -> "ff00cc"
    6: ok
    8: alpha = int(s[6..8],16)/255; s = s[0..6]    // sets paint.opacity
    other: return INVALID (verify 4/5/7 handling)
  rgb = int(pair)/255 each
```

Display rounding [KNOW]: RGB = round(c×255); Hex = same bytes; H = round(h) in 0–359; S/L/B = round(%); opacity = round(%). Stored values stay floats; typing a hex sets exactly n/255; opening/closing the picker must never change stored values (no drift).

Conversions (standard; [KNOW]):
```
rgbToHsb(r,g,b): max=max(r,g,b); min=min(r,g,b); d=max-min
  h = d==0 ? keepLastHue : 60*((max==r ? (g-b)/d mod 6 : max==g ? (b-r)/d+2 : (r-g)/d+4))
  s = max==0 ? 0 : d/max;  v = max
rgbToHsl: l=(max+min)/2; s = d==0 ? 0 : d/(1-|2l-1|); h as above
```

#### 3.2.5 Page swatches and libraries
- The picker shows swatches of colors used on the current page; clicking one applies it to the target paint [OBS][KNOW].
- The Libraries tab lists color styles and variables from the file and enabled libraries; applying one links the paint (M6) [OBS][DOC:360041003774 excerpt].

#### 3.2.6 Eyedropper
- Activate with **I**, or from the picker's eyedropper icon; on Mac also Control+C [DOC:27643269375767 excerpt].
- Click samples the on-screen rendered color (any layer or image on canvas) and applies it to the selected layer(s) / the open picker's paint [DOC:360041003774 excerpt: "eyedropper can select any color from an image or layer in the canvas"].
- Plain click applies the **raw value** even if the source pixel comes from a styled paint [SRC:https://forum.figma.com/t/color-picker-should-apply-color-style/1540].
- **Shift+click** applies the color variable or color style found under the pointer [SRC:https://forum.figma.com/suggest-a-feature-11/color-picker-eyedropper-should-apply-color-style-34313/index3.html quoting DOC:27643269375767]. The article also says the eyedropper can "sample, apply, and create" color variables and styles [DOC:27643269375767 excerpt].
- A magnifier loupe with pixel grid and value preview while hovering; Esc cancels; with nothing selected the sampled hex is copied to the clipboard [KNOW] (V-09).
- Which alpha is applied when sampling a semi-transparent pixel (composited opaque screen color vs. source alpha) is unknown (V-09).

### 3.3 Gradients

#### 3.3.1 Types
Linear (straight line, any angle); Radial (circular/elliptical from center to edge); Angular (clockwise sweep from the start position); Diamond (four-point shape from center; width and height independently adjustable) [DOC:34208860210199 excerpt][API].

#### 3.3.2 Stops
- At least two stops [DOC:34208860210199 excerpt]; a stop's color is edited by selecting its square in the gradient controller [DOC:34208860210199 excerpt].
- Stop position 0–1 [API]; stop color is RGBA (own alpha) in addition to paint opacity [API].
- Add by clicking on the picker's gradient bar or on the on-canvas gradient line; the new stop takes the interpolated color at that position [KNOW]. Delete with Delete/Backspace while a stop is selected or with the stop row's remove control; deletion is blocked at two stops [KNOW].
- UI3 shows a stop list (position %, color, opacity) and "+" to add a stop [KNOW] (V-10).
- Stops at identical positions produce a hard edge; when dragged past each other they re-sort by position [KNOW].
- Stop colors can be bound to color variables [API].

#### 3.3.3 Geometry (pseudo-code; conventions [KNOW], verify V-11)

```
// Plugin: gradientTransform T maps layer-normalized (u,v) ∈ [0,1]² to gradient space (s,t).
// REST handles: H0 = T⁻¹·(0,0.5), H1 = T⁻¹·(1,0.5), H2 = T⁻¹·(0,1)   (verify per type)
// Layer-normalized space follows the layer box, so gradients stretch/rotate with the layer.
x(type, s, t):
  LINEAR : s
  RADIAL : 2 * hypot(s - 0.5, t - 0.5)
  DIAMOND: 2 * (|s - 0.5| + |t - 0.5|)
  ANGULAR: (atan2(t - 0.5, s - 0.5) / 2π) mod 1          // y-down ⇒ clockwise
color(x) = piecewise interpolation of sorted stops at clamp(x, 0, 1)
           (before first stop: first color; after last: last color — "pad")
```

- Interpolation space (gamma-encoded vs linear) and alpha handling (premultiplied vs straight) are unverified; they visibly change gradients to transparent (V-12).
- Switching Solid→Gradient seeds two stops (solid color at 100 % → same color at 0 %) running top-to-bottom [KNOW] (V-10). Switching between gradient types keeps stops and transform [KNOW].
- Gradient on strokes uses the layer box, not stroke bounds; on text it spans the text layer box rather than per glyph [KNOW] (V-13).

#### 3.3.4 On-canvas editing ([KNOW]; verify V-10)
- While a gradient paint is open in the picker, handles render on canvas: start/end points with stops along the axis (linear); center + two axis handles (radial/diamond/angular).
- Dragging a handle moves it in layer-normalized space; dragging a stop along the line changes its position; clicking the line adds a stop.
- Shift while dragging an end handle snaps the angle (45° increments) (unverified).
- UI3 provides flip (reverse stops) and rotate-90° actions for gradients (unverified).

### 3.4 Image, video, pattern, shader paints

#### 3.4.1 Image intake ([KNOW] unless tagged)
- Drag-and-drop image file(s) onto the canvas creates a rectangle at the image's pixel size with an IMAGE paint (scale mode FILL), named after the file; dropping onto an existing shape puts the image into that shape's fills (replace vs add: V-15).
- Place image (Shift+Cmd+K / Shift+Ctrl+K): choose one or more files; the cursor carries the image(s); click places at natural size, drag defines size, click on a shape fills it.
- Paste of a raster from the clipboard creates an image layer.
- Accepted: PNG, JPEG, GIF at least [API: createImage]; WebP/HEIC/TIFF/others unverified (V-16).
- Downsampling: images with width or height above 4096 px are scaled down proportionally so the longest edge fits [API: "maximum size of 4096 pixels"][SRC:https://imagecompressor.tools/guides/does-figma-compress-images quoting Figma]. Exact rounding and whether a notice is shown: V-16.
- Identical bytes share one stored asset (hash) [API].
- Embedded ICC profiles: a user reports Display P3-tagged images mapped to sRGB on import [SRC:https://forum.figma.com/ask-the-community-7/problem-with-managing-image-colour-profiles-34569] (V-26).

#### 3.4.2 Scale modes (pseudo-code; [DOC:360041098433 excerpt] for semantics, geometry [KNOW])

```
W,H = layer box; (w,h) = image pixel size; if rotation ∈ {90,270}: swap(w,h)
FILL: k = max(W/w, H/h); size = (w·k, h·k); centered; overflow clipped by layer shape
FIT : k = min(W/w, H/h); size = (w·k, h·k); centered; uncovered area transparent
TILE: tile = (w·scalingFactor, h·scalingFactor) in layer units; repeat from layer origin (verify origin)
CROP: image drawn through imageTransform (layer-normalized → image-normalized affine);
      identity ⇒ image stretched exactly to the layer box (REST name "STRETCH")
```

- Fill "may clip the image" when shapes differ; Fit "ensures the entire image is visible"; Crop "adjust the boundary lines… non-destructive… similarly to using a mask"; Tile "repeated pattern… size of the tile using the percentage value… percentage of the image's original dimensions" [DOC:360041098433 excerpt].
- The image itself is not resized independently; you resize the layer [DOC:360041098433 excerpt].
- Rotation in 90° steps for FILL/FIT/TILE [API]; for CROP rotation is part of the transform [API].
- Crop editing: crop handles adjust the visible window; dragging inside moves the image; Enter/Esc/click outside exits (entry gesture and keys: V-17) [KNOW]. Switching FILL→CROP keeps the current framing [KNOW] (V-17).

#### 3.4.3 Image adjustments
- Sliders: Exposure, Contrast, Saturation, Temperature, Tint, Highlights, Shadows [API][DOC:360041098433 excerpt][SRC:https://www.figma.com/blog/photo-filters-come-to-figma/]. Stored −1…+1, default 0 [API]; UI range −100…+100 [KNOW].
- Directions: exposure left darkens/right brightens; contrast down mutes; saturation fully down = black and white; temperature down = cooler/blue, up = warmer/amber; tint down = green, up = magenta [DOC:360041098433 excerpt].
- Not available for animated GIFs [DOC:360041098433 excerpt].
- Exact pixel formulas are not public → calibrate against Figma exports (V-18).

#### 3.4.4 Video paints
- Upload .mp4, .mov, .webm [DOC:360041003694 excerpt]; max 100 MB [API]. Same scale modes, rotation and filters fields as images [API]. Canvas shows a still frame; playback lives in prototypes (M7) [KNOW] (V-19).
- Animated GIF handling conflicts between sources (video vs image category) [DOC:360041003694 excerpt] (V-19).

#### 3.4.5 Pattern paints
- Source = another object on the canvas in the same file: a single layer or several layers in a group/frame; apply via picker → Pattern → "Select source" → click object [DOC:31616030150167 excerpt].
- Options: tile type, scale, spacing, alignment, opacity [DOC:31616030150167 excerpt]; data per §2.2 [API].
- Editing the source updates every layer using it [DOC:31616030150167 excerpt].
- Usable as fill or stroke [DOC:31616030150167 excerpt].
- Deleted/hidden source, source on another page, and self-reference (cycle) behavior: V-20.

#### 3.4.6 Shader paints
- Present in UI3 paint types [OBS] and typings [API]; open beta per Help Center excerpt [DOC:41175721167767 excerpt — attribution uncertain]. Illigma: preserve losslessly, render placeholder, mark unsupported (decision pending).

### 3.5 Strokes

#### 3.5.1 Shared stroke properties
- All stroke paints share one weight, position and style [DOC:360049283914 excerpt].
- Changes made with a layer selected apply to the whole layer; per-point stroke settings require vector edit mode [DOC:360049283914 excerpt][API per-vertex caps/joins].

#### 3.5.2 Position (alignment) — algorithm
```
strokeRegion(node):
  base = strokeOutline(geometry, width = w, cap, join, dash)       // centered on path
  CENTER : base
  INSIDE : strokeOutline(geometry, 2w, …) ∩ fillRegion(geometry)   // [API] "doubling … masking by the fill"
  OUTSIDE: strokeOutline(geometry, 2w, …) − fillRegion(geometry)
```
- Consequences: an inside stroke never draws outside the fill and vice versa [API]; dash patterns and caps look different off-center [SRC:https://forum.figma.com/report-a-problem-6/dashed-stroke-incompatible-with-stroke-inside-outside-56095].
- Hovering a position option previews it on canvas before committing [DOC:360049283914 excerpt].
- Open paths have no fill region → Inside/Outside availability: V-21.
- Stroke does not change the layer's W/H; Outside/Center strokes extend render bounds (affects export bounds) [KNOW].

#### 3.5.3 Individual sides
- Rectangles and frame-like nodes only [API]. Menu: All (default), Top, Bottom, Left, Right, Custom; Custom shows four fields [SRC:https://uxcel.com/lessons/strokes-in-figma-975]. Choosing a single side sets the others to 0 [KNOW].
- `strokeWeight` reads `mixed` when sides differ [API]. Rendering of per-side weights with corner radius (inner contour shape): V-22.

#### 3.5.4 Joins, miter, caps, endpoints
- Joins MITER/BEVEL/ROUND [API]; miter switches to bevel below the miter angle, default 28.96° (= ratio 4) [API REST].
- Caps for open path ends: NONE/ROUND/SQUARE [API]; decorative endpoints ARROW_LINES, ARROW_EQUILATERAL, TRIANGLE_FILLED, CIRCLE_FILLED, DIAMOND_FILLED [API]. UI labels and sizes relative to weight: V-23.
- Start and end can differ (per-vertex); node-level `strokeCap` then reads `mixed` [API]. A swap-ends action exists [KNOW] (V-23).

#### 3.5.5 Dashes
- Advanced stroke settings → style Dashed; set dash and gap in px; choose dash cap None/Round/Square [DOC:360049283914 excerpt].
- Figma starts and ends every dashed line with a half-length dash; to edit end pieces, outline the stroke [DOC:360049283914 excerpt]. Exact phase rule on closed shapes: V-24.
- A dotted look starts by setting position to Center (round cap with zero dash) [DOC:360049283914 excerpt].
- Data is a full `dashPattern` array [API]; UI exposes dash+gap; longer imported arrays must be preserved [KNOW].
- SVG export: only center strokes are native in SVG; inside/outside are simplified to look the same (more complex code) [DOC:360049283914 excerpt].

#### 3.5.6 Advanced strokes (Figma Draw)
- Config 2025 added brushes and dynamic stroke controls [DOC:30965205437975 excerpt]. Data per §2.3 [API]. Brush assets are named Figma presets (e.g. STRETCH "HEIST", SCATTER "BUBBLEGUM") [API]; Illigma cannot copy Figma's brush art (P2, decision).
- Variable width: presets UNIFORM/WEDGE/TAPER/QUARTER_TAPER/EYE/MIRRORED_TAPER or CUSTOM points; disallowed on branching networks and with dynamic strokes [API].

### 3.6 Effects

#### 3.6.1 List management
- Effects is an ordered list; add (`+`), change type (dropdown), settings popover, visibility toggle, remove [KNOW]. `+` adds a Drop shadow by default [KNOW] (V-25).
- Per-layer maximums: 8 drop shadows, 8 inner shadows, 1 layer blur, 2 noise, 1 texture, 1 background blur [SRC:figma-signup.helpjuice.com/apply-effects-to-layers — mirror of DOC:360041488473, excerpt]. Glass maximum unknown (V-25).

#### 3.6.2 Shadows (pseudo-code; [KNOW] unless tagged, verify V-27/V-28)
```
silhouette = alphaOf(renderLayerContent(node))       // fills+strokes(+children for containers)
drop(e):  a = dilate(silhouette, e.spread)            // spread only on supported nodes [API]
          a = gaussian(a, sigma = e.radius / 2); a = translate(a, e.offset)
          if !e.showShadowBehindNode: a = a * (1 - shapeCoverage(node))   // knock-out
          draw color e.color with alpha a, blend e.blendMode, behind content
inner(e): a = 1 - silhouette; a = dilate(a, e.spread) // sign per API: "positive spread contracts the shadow"; direction vs CSS inset spread unverified (V-27)
          a = gaussian(translate(a, e.offset), e.radius/2) * silhouette
          draw e.color with alpha a above fills, blend e.blendMode
```
- Defaults when added: X 0, Y 4, Blur 4, Spread 0, #000000 25 % [SRC:https://forum.figma.com/t/set-starting-defaults-for-design-fill-stroke-effects/617 (2021)][KNOW]; inner shadow defaults unverified (V-25).
- Drop shadows do not show through transparent areas by default; to enable, the layer must qualify (e.g. only fills below 100 % opacity, or stroke with no fill) and the option is turned on in the shadow menu; not available for inner shadows [SRC:helpjuice mirror of DOC:360041488473, excerpt][API `showShadowBehindNode`].
- Spread only on rectangles, ellipses, frames, components (and instances) — frames/components need clipping and a visible fill; the API accepts spread anywhere but the canvas ignores it where unsupported [API][SRC:helpjuice mirror of DOC:360041488473, excerpt].
- Variable-bindable: color, radius, spread, offsetX, offsetY [API].

#### 3.6.3 Layer blur
- Uniform: Gaussian over the whole layer render (incl. its shadows: V-29) with sigma = radius/2 [KNOW] (V-29).
- Progressive: blur varies from `startRadius` at `startOffset` to `radius` at `endOffset` (normalized object space) [API]; UI exposes start and end values [SRC:https://app.uxcel.com/courses/figma-intro/shadows-blurs-866/layer-blur-7140]; users describe it as a linear ramp with two knots, no radial option [SRC:https://forum.figma.com/suggest-a-feature-11/progressive-blur-gradient-controls-48326].
```
progressiveRadius(p):  // p = point in layer-normalized space
  d = endOffset - startOffset; t = clamp(dot(p - startOffset, d) / dot(d,d), 0, 1)
  return lerp(startRadius, radius, t)                  // interpolation curve: V-30
```
- In beta in the plugin API from Update 110 (May 2025) [SRC:https://developers.figma.com/docs/plugins/updates/2025/05/07/version-1-update-110/ (search excerpt)].

#### 3.6.4 Background blur
- Blurs content behind the layer, restricted to the layer's shape; visible only where the layer's own paints are not fully opaque [SRC:https://uxcel.com/lessons/shadows-blurs-866]. Progressive is allowed by the data model [API]; UI availability: V-30.

#### 3.6.5 Noise, texture, glass, shader
- Noise and texture arrived with Config 2025 ("add texture and noise for a subtle grainy effect") [DOC:30965205437975 excerpt]. Parameters per §2.4 [API]. UI sliders reportedly cap at 100, so these effects do not scale with the layer [SRC:https://forum.figma.com/share-your-feedback-26/none-scalable-effects-new-effects-43032].
- Noise on a frame applies to the frame's composited content (user report: applied to every element inside the frame) [SRC:https://forum.figma.com/report-a-problem-6/noise-effect-is-applied-to-every-element-within-a-frame-41874] (V-31).
- Texture: `clipToShape` decides whether the texture displacement can extend beyond the shape [API] (semantics: V-31).
- Glass: launched July 2025 (beta, frames only, uniform corner radius); out of beta January 2026, applicable to any object/shape/text with independent corners [SRC:https://www.createwith.com/tool/figma/updates/figma-takes-glass-effect-out-of-beta-with-new-controls][SRC:https://designcompass.org/en/2025/07/18/figma-glass-effect/]. Controls: light angle & intensity (highlight position), refraction (edge bending), depth (thickness), dispersion (chromatic fringing), frost (background blur), splay [SRC same]. A third-party port documents UI ranges light angle −180…180 (0 = top), intensity 0–100 %, others 0–100 [SRC:https://pub.dev/packages/figma_glass] — conflicts with API `depth ≥ 1` (V-32). Plugin-applied glass reportedly lacks the edge highlight seen when applied in the UI [SRC:https://forum.figma.com/report-a-problem-6/glass-effect-api-missing-light-reflection-border-when-applied-via-plugin-42969].
- Shader effect: pass-through only (see 3.4.6).

#### 3.6.6 Effects and containers
- Effects on groups/frames apply to the composited result of the container [KNOW]. Children's effects are clipped by a clipping parent frame [KNOW]. A forum user (seen only in a search summary; thread URL not pinned) reports that effects of objects inside a clipping mask are dropped when the object lies entirely outside the mask bounds [SRC:forum.figma.com, unpinned, low confidence] (V-31).

### 3.7 Layer opacity and blend modes
- Layer default blend = Pass through; paint default = Normal [DOC:360040667874 excerpt]. One blend mode per layer and per fill [DOC:360040667874 excerpt]. Effects carry their own blend mode [API].
- To set a paint blend mode: open the picker, use the blend-mode icon at its top-right [DOC:360040667874 excerpt].
- Restriction: "Blend modes can't be added to fills for color variables, or layers with styles or variables applied. Instead, apply a blend mode to a layer or to a color style" [DOC:360040667874 excerpt] (exact disabled states: V-33).
- Frames and sections: "a frame or section with a blend mode applied will blend with layers nested inside of it", other layers affect layers behind them [DOC:360040667874 excerpt]. This conflicts with the typings (Section has no blend mixin [API]) → V-33.
- Formulas: implement the W3C Compositing & Blending Level 1 separable and non-separable functions; Plus darker = linear burn `max(0, Cb + Cs − 1)`, Plus lighter = linear dodge `min(1, Cb + Cs)` [SRC:https://blog.logrocket.com/ux-design/figma-blend-modes/][KNOW] (V-34).
- Layer opacity 0–100 %; number keys set opacity (§5) [KNOW].
- PDF export does not support Plus darker / Plus lighter [DOC:13402894554519 excerpt].

### 3.8 Mixed selections
- If all selected layers share the same fill/stroke color it is shown in Fill/Stroke; otherwise colors are viewed and edited in **Selection colors** [DOC:360041003774 excerpt].
- Selection colors appears only when the selection contains objects with mixed fills; groups entries by variable, style and plain fills; each color appears once; shows the three most frequently used paints/styles with a "See all colors"/"See all styles" link; variables show as grey pills; clicking a style/variable opens the style modal [DOC:360042553434 excerpt]. The plugin equivalent returns `null` above 1000 colors [API].
- Aggregation (pseudo-code; [KNOW], V-14):
```
for node in selection ∪ descendants: for list in [fills (incl. text ranges), strokes, (effects colors?)]:
  for p in list if p.visible and p.type == SOLID: key = boundVariable ?? styleId ?? (rgb, opacity?)
  count[key]++ ; occurrences[key].push(ref)
editing entry key → rewrite every occurrence (one undo step)
```
- Mixed scalar fields show "Mixed"; typing a value sets all; mixed fill lists show a "replace" affordance via `+` [KNOW].

### 3.9 Color management
- Two profiles: sRGB and Display P3; new files default to sRGB; default changeable in Preferences → Color profile; per file change offers "Keep color values (Assign)" or "Keep appearance (Convert)"; Unmanaged removed August 2023 — legacy files become "Same as preferred profile"; once a profile is assigned it cannot revert to that setting; exports use the file's profile by default [DOC:360039825114 excerpt].
- Export settings may override with sRGB or Display P3 (`colorProfile`) [API]. Whether PNG/JPG embed ICC profiles: V-26.
- Canvas rendering must be color-managed from the document profile to the display [KNOW]; third-party testing found some Figma UI previews clip P3 [SRC:https://bjango.com/articles/colourmanagementsettings/].

### 3.10 Export

#### 3.10.1 Export section and settings
- Exportable: layers, frames, components, groups, sections; a slice region; the entire page canvas (deselect everything first); the whole file as .fig [DOC:360040028114 excerpt].
- `+` adds an export configuration; any number per selection [DOC:360040028114 excerpt]. First added = 1x PNG; subsequent additions increment scale [KNOW] (V-35).
- Scale: preset menu or custom value; suffix letters `x` (multiplier), `w` (fixed width), `h` (fixed height) [DOC:13402894554519 excerpt]. Presets 0.5x, 0.75x, 1x, 1.5x, 2x, 3x, 4x [API: video export doc names these "the standard Export panel scales"]; 512w/512h presets [KNOW].
- Settings list (UI): Scale, Suffix, Color profile, Ignore overlapping layers, Image quality, Image resampling, Include bounding box, Include "id" attribute, Outline text, Simplify stroke [SRC:helpjuice mirror of DOC:13402894554519 — table of contents].
- PNG: lossless, 32-bit RGBA, always has an alpha channel [DOC:13402894554519 excerpt]. PDF: PDF 1.7; text as glyphs (selectable/copyable, not editable); no Plus darker/lighter [DOC:13402894554519 excerpt]. JPG has no alpha [KNOW] (background fill color: V-36).
- Image quality High/Medium/Low for JPG and PDF (JPG default High, PDF default Medium; High = no compression) [SRC:https://figmalion.com/topics/import-export]. Resampling Detailed (bicubic, default) / Basic (nearest neighbor) for JPG, PNG, PDF [SRC:https://figmalion.com/topics/import-export].
- Ignore overlapping layers = `contentsOnly` (default on); off ⇒ layers intersecting the exported node (above or below) are included [API][SRC:https://forum.figma.com/t/ignore-overlapping-layers-export-option-is-not-respected-in-slice-export/63390].
- Include bounding box ↔ `useAbsoluteBounds` (full node dimensions regardless of cropping/empty space; useful for text) — mapping is inferred, V-37 [API].

#### 3.10.2 Pixel size and bounds (pseudo-code; [KNOW], V-37)
```
bounds = s.useAbsoluteBounds ? absoluteBoundingBox(node)
                              : absoluteRenderBounds(node)   // incl. outside/center strokes, shadows, blurs;
                                                             // clipped frame: frame rect ∪ frame's own effects (verify)
k = SCALE ? value : WIDTH ? value / bounds.w : value / bounds.h
pxW, pxH = roundingRule(bounds.w * k), roundingRule(bounds.h * k)   // ceil vs round: V-37
render at k into pxW×pxH; exclude editor overlays; hidden layers/paints/effects excluded
```
- Raster export is "72 DPI × scale" [SRC:https://imagecompressor.tools/guides/does-figma-compress-images].
- REST render API caps scale to 0.01–4 [API REST]; UI limits and maximum pixel dimensions: V-37.

#### 3.10.3 Running an export
- One output file per (node × export setting). Browser downloads; desktop asks for name/location [DOC:360040028114 excerpt]. File name = layer name + suffix (+ automatic `@Nx` when suffix empty and scale ≠ 1 — [KNOW], V-35) + extension; slashes in names produce folders (V-35).
- Preview is optional and not shown when multiple objects are selected [DOC:360040028114 excerpt].
- Export dialog Shift+Cmd+E / Shift+Ctrl+E [SRC:https://dev.to/dishank/best-figma-shortcuts-for-designers-2j6n][SRC:https://forum.figma.com/t/can-t-export/87464] lists exportable items (contents: V-38).
- Slices (tool S) export everything visible in the slice rectangle [API SliceNode][SRC:https://www.guideflow.com/tutorial/how-to-use-the-slice-tool-in-figma].

#### 3.10.4 SVG specifics
- Outline text default on (glyphs as paths); off emits `<text>` relying on viewer fonts [API]. `id` attributes from layer names default off; masks/gradients always get ids [API]. Simplify stroke default on (approximate inside/outside strokes instead of masks) [API][DOC:360049283914 excerpt].
- Angular and diamond gradients have no SVG equivalent [SRC:https://webdesign.tutsplus.com/using-figma-for-svg-design--CRS-200909c/what-exports-well-to-svg]; what Figma emits (raster fallback vs approximation) — V-39. Same question for noise/texture/glass/background blur and progressive blur (a forum asks whether texture can export as vector [SRC:https://forum.figma.com/ask-the-community-7/is-there-a-way-to-export-the-new-texture-feature-of-figma-as-vector-41146 (title only)]).

### 3.11 Copy as / clipboard
- Copy as PNG: Shift+Cmd+C / Shift+Ctrl+C [SRC:forum.figma.com Figma community-support answer seen in a search summary, e.g. https://forum.figma.com/ask-the-community-7/how-to-bring-back-copy-as-png-in-figma-26969 (thread attribution approximate)]; reportedly at 2x [SRC:https://yummygum.com/blog/get-the-most-out-of-figma-with-these-power-features] (V-40).
- Copy as SVG: right-click → Copy/Paste as → Copy as SVG [SRC:https://convert.remotion.dev/docs/figma]. No "copy SVG code" in the Export panel (feature request Sep 2026) [SRC:https://forum.figma.com/suggest-a-feature-11/feature-request-add-copy-svg-code-option-in-export-57587].
- Copy as code (CSS) and copy/paste properties: [KNOW] (V-40, V-41). Pasting SVG markup creates vector layers [SRC:https://forum.figma.com/ask-the-community-7/paste-svg-code-no-longer-available-29257][API createNodeFromSvg].

### 3.12 Cross-cutting rules
- **Undo/redo**: one entry per committed change: picker drag gesture, slider gesture, scrub gesture, gradient/crop/blur-handle drag, typed value (Enter/blur/Tab), add/remove/reorder/toggle, eyedropper apply, image import (layer + asset). Opening/closing the picker, switching color model, switching picker tab, expanding settings: no entry [KNOW] (V-42).
- **Copy/paste/duplicate** of layers carries all paints (incl. image hashes across files), strokes, effects, opacity, blend mode and export settings [KNOW][API].
- **Components/instances**: fills, strokes (paints and properties), effects, opacity, blend mode, export settings are overridable on instances; reset restores main values (M5) [KNOW] (V-43).
- **Auto layout**: strokes are excluded from layout unless `strokesIncludedInLayout` [API][OBS]; effects never affect layout [KNOW]; FILL/FIT images recompute on resize [DOC:360041098433 excerpt].
- **Variables**: bindable — solid paint color, gradient stop color, effect color/radius/spread/offsetX/offsetY, strokeWeight and per-side weights, opacity [API]; noise/texture/glass not bindable per typings [API].

---

## 4. Inspector & on-canvas controls (functional; Figma UI3)

| Control | Location | Function | Evidence |
| --- | --- | --- | --- |
| Appearance section | Right sidebar, Design tab | Layer opacity field (%), layer blend mode menu, visibility toggle (corner radius lives here but belongs to shapes spec) | [OBS: "Appearance" section present][KNOW for contents] |
| Fill section header | Design tab | `+` add paint; styles/variables button (apply style or variable) | [OBS: Fill section][KNOW] |
| Fill row | Fill section | Swatch (opens picker), value (hex or type label), paint opacity %, visibility toggle, remove `−`, drag to reorder | [KNOW] |
| Stroke section | Design tab | Rows as Fill; position (Inside/Center/Outside); weight; individual-sides menu; advanced stroke settings button | [OBS: "Inside placement and weight control are available"][SRC:https://uxcel.com/lessons/strokes-in-figma-975][DOC:360049283914 excerpt] |
| Advanced stroke settings | Popover | Style (Solid/Dashed), dash, gap, dash cap, join, miter (verify), start/end points, swap; Draw: width profile, brush, dynamic | [DOC:360049283914 excerpt][API] |
| Selection colors | Design tab, mixed selections | Grouped color list, See all, edit/apply style/variable | [DOC:360042553434 excerpt] |
| Effects section | Design tab | `+`, effect styles button, rows: type dropdown, settings popover button, visibility, remove | [OBS: "Effects" section][KNOW] |
| Effect settings popover | Popover | Per-type fields (§2.4), Uniform/Progressive switch for blurs, "Show behind transparent areas" | [SRC uxcel][SRC helpjuice mirror] |
| Export section | Design tab bottom | `+`, rows (scale, format, settings `…`, remove), Export button "Export <name>/<n> layers", Preview | [OBS: "Export" section][DOC:360040028114 excerpt] |
| Color picker | Popover | Custom/Libraries tabs; paint-type selector (Solid, Gradient, Pattern, Image, Video, Shader); blend mode icon; color area; hue & opacity sliders; eyedropper; color model menu + fields; page swatches; close | [OBS][DOC:360040667874 excerpt for blend icon] |
| Gradient controls | Picker + canvas | Type menu (Linear/Radial/Angular/Diamond), stop bar, stop list, flip/rotate (verify), on-canvas handles | [DOC:34208860210199 excerpt][KNOW] |
| Image controls | Picker | Scale mode menu (Fill/Fit/Crop/Tile), tile %, rotate 90°, choose/replace image, 7 adjustment sliders | [DOC:360041098433 excerpt] |
| Pattern controls | Picker | Select source, tile type, scale, spacing, alignment | [DOC:31616030150167 excerpt] |
| Crop mode | Canvas | Crop handles, drag image | [DOC:360041098433 excerpt][KNOW] |
| Progressive blur handles | Canvas | Start/end positions | [API][KNOW] (V-30) |
| Eyedropper loupe | Canvas | Magnified pixels + value | [KNOW] |
| Context menu "Copy/Paste as" | Canvas/layers | Copy as PNG, Copy as SVG, Copy as code, copy/paste properties | [SRC remotion][KNOW] |
| Page settings (nothing selected) | Design tab | Page background color, page Export section | [API][DOC:360041064814 (title only)][DOC:360040028114 excerpt] |

---

## 5. Keyboard shortcuts (macOS / Windows)

| Action | macOS | Windows | Evidence |
| --- | --- | --- | --- |
| Eyedropper | I (also Control+C) | I | [DOC:27643269375767 excerpt] |
| Eyedropper: apply style/variable instead of value | Shift+click | Shift+click | [SRC forum 34313 quoting DOC:27643269375767] |
| Scrub picker numeric field | Option+drag | Alt+drag | [DOC:360043042113 excerpt] |
| Set layer opacity 10 %–90 % / 100 % | 1…9 / 0 | 1…9 / 0 | [KNOW] |
| Set exact opacity (two quick digits, e.g. 4 then 5 = 45 %; 0 then 0 = 0 %) | digits | digits | [KNOW] |
| Swap fill and stroke | Shift+X | Shift+X | [KNOW] |
| Outline stroke | Option+Cmd+O | Ctrl+Alt+O | [KNOW] |
| Export dialog | Shift+Cmd+E | Shift+Ctrl+E | [SRC dev.to][SRC forum 87464] |
| Copy as PNG | Shift+Cmd+C | Shift+Ctrl+C | [SRC forum 26969] |
| Copy properties | Option+Cmd+C | Ctrl+Alt+C | [KNOW] (a third-party page wrongly lists this as "copy as PNG" — conflict noted) |
| Paste properties | Option+Cmd+V | Ctrl+Alt+V | [KNOW] |
| Place image | Shift+Cmd+K | Shift+Ctrl+K | [KNOW] |
| Slice tool | S | S | [SRC:https://meshworld.in/blog/cheatsheets/figma-shortcuts-cheatsheet/][KNOW] |
| Delete selected gradient stop | Delete / Backspace | Delete / Backspace | [KNOW] |
| Nudge numeric field | ↑/↓ (±1), Shift+↑/↓ (±10) | same | [KNOW] |
| Remove fill / remove stroke | unverified | unverified | [KNOW, low confidence] |
| Paste to replace (related) | Shift+Cmd+R | Shift+Ctrl+R | [SRC forum excerpt citing Help Center] |

All [KNOW]/[SRC]-only shortcuts are in V-44.

---
## 6. Parity checklist

All items: status **Not started**. Format: `ID name — expected Figma behavior. Data. Test. Milestone·Priority·Evidence`. Items whose evidence is only [KNOW]/[SRC] are listed again in §8.

### 6.1 Paint stack & common paint properties

- [ ] **PE-001** Ordered fill list — a layer holds 0…n fill paints rendered bottom-to-top; the inspector shows the top-most paint as the first row. _Data:_ `fills: Paint[]` _Test:_ rect with red fill, add blue fill via `+`; blue is the first row and covers red; reload and confirm order unchanged; compare with Figma (V-01). _M1·P0·[API]·[KNOW]_
- [ ] **PE-002** Add first fill — `+` on a layer with no fills adds one visible SOLID paint at 100 % with Figma's default color for that node type. _Data:_ `fills=[{type:'SOLID',color,opacity:1,visible:true,blendMode:'NORMAL'}]` _Test:_ remove all fills from rect and from frame, press `+`; color equals Figma's (V-02). _M1·P0·[DOC:360041003694 excerpt]·[KNOW]_
- [ ] **PE-003** Add additional fill — `+` on a layer that already has fills inserts a new SOLID paint on top (Figma default #000000 at 20 %, to verify). _Data:_ `fills` append at top index _Test:_ rect with one fill, press `+`; new top row value/opacity match Figma (V-02). _M1·P1·[KNOW]_
- [ ] **PE-004** Remove paint — `−` on a row deletes only that paint; deleting the last paint leaves an empty list and the section shows only `+`. _Data:_ `fills`, `strokes` _Test:_ 3 fills, remove the middle one; remaining order intact; undo restores at same index. _M1·P0·[KNOW]_
- [ ] **PE-005** Paint visibility — eye toggle flips `visible`; hidden paints are not rendered or exported but remain in the list, saved and undoable. _Data:_ `paint.visible` _Test:_ hide top fill → underlying fill visible; export PNG excludes it; reload keeps hidden state. _M1·P0·[API]_
- [ ] **PE-006** Reorder paints — dragging a fill/stroke row changes stacking order in one undo step. _Data:_ `fills` order _Test:_ drag bottom row to top; render and array order update; single undo reverts. _M2·P1·[KNOW]_
- [ ] **PE-007** Paint opacity — per-paint opacity 0–100 % independent of layer opacity and of gradient-stop alpha; out-of-range input clamps. _Data:_ `paint.opacity` 0–1 _Test:_ type 150 → 100 %, −5 → 0 %; 50 % paint on 50 % layer renders 25 % effective alpha over white. _M1·P0·[API]_
- [ ] **PE-008** Paint blend mode — every paint has its own blend mode (default Normal); Pass through is not offered for paints. _Data:_ `paint.blendMode` _Test:_ open picker blend menu for a fill: 18 modes, no Pass through. _M2·P1·[API]·[DOC:360040667874 excerpt]_
- [ ] **PE-009** Paint compositing — each visible paint is composited over the paints (and backdrop) beneath it using its blend mode and opacity (pseudo-code §3.1.3). _Data:_ `fills[*].blendMode/opacity` _Test:_ white bg, rect with red bottom fill and blue 50 % Multiply top fill; sampled pixel equals Figma export within ±1/255 (V-03). _M0·P0·[KNOW]_
- [ ] **PE-010** Fills need closed regions — fills render only in closed regions; lines and open paths show no fill even with fills present; strokes render on open and closed paths. _Data:_ `fills`, vector regions _Test:_ open pen path with fill: no fill rendered; close the path: fill appears. _M1·P0·[DOC:360041003694 excerpt]_
- [ ] **PE-011** Paint-type switch in place — changing a row's type keeps its position, visibility, opacity and blend mode; Solid→Gradient seeds stops from the solid color; Gradient→Solid takes a stop color (which one: V-10). _Data:_ `paint.type` _Test:_ red solid 60 % Multiply → Linear → Solid; compare each step with Figma. _M2·P1·[KNOW]_
- [ ] **PE-012** Stroke paint list — strokes are an ordered paint list with the same paint types and per-paint properties as fills; all stroke paints share one weight/position/style. _Data:_ `strokes`, `strokeWeight`, `strokeAlign`, `dashPattern` _Test:_ two stroke paints (solid + gradient); change weight → both update. _M1·P0·[API]·[DOC:360049283914 excerpt]_
- [ ] **PE-013** Node capability matrix — fills/strokes/effects/opacity/blend/export availability per node type follows §2.3 (Group: effects+opacity+blend only; Section: fills+strokes, no effects/opacity/blend; Slice: export only). _Data:_ mixins _Test:_ select each node type; inspector shows exactly these sections; compare Section with Figma UI (V-33). _M1·P0·[API]_
- [ ] **PE-014** Page background — the page canvas background is a single solid color editable when nothing is selected; it is not part of any layer's fills. _Data:_ `PageNode.backgrounds` _Test:_ deselect all, change background; layers unchanged; reload persists. _M1·P1·[API]·[DOC:360041064814 (title only)]_
- [ ] **PE-015** Text range fills — text fills can differ per character range; the Fill section shows mixed for the node and editing replaces all ranges; strokes/effects are node-wide. _Data:_ `getRangeFills`, `fills: mixed` _Test:_ color one word red; select text layer: Fill shows mixed; set a fill: whole text recolored. _M3·P0·[API]_
- [ ] **PE-016** Lossless persistence — every paint/effect field (incl. SHADER, NOISE, TEXTURE, GLASS, PATTERN, VIDEO, variable bindings, unknown future fields) round-trips through save/open unchanged; unsupported types are shown as unsupported, never dropped. _Data:_ all §2 fields _Test:_ fixture with every type; save, reopen, byte-compare JSON model. _M0·P0·[API]_

### 6.2 Color picker & solid colors

- [ ] **PE-017** Open picker on target — clicking a fill/stroke swatch opens the picker bound to that exact paint (layer set, fill vs stroke, index); clicking another swatch retargets. _Data:_ UI target state _Test:_ open fill #2 of rect, change hue → only fill #2 changes; click stroke swatch → picker edits stroke. _M1·P0·[DOC:360041003774 excerpt]·[OBS]_
- [ ] **PE-018** Picker tabs — Custom (raw paint editing) and Libraries (styles/variables) tabs exist; Libraries applies a style/variable link. _Data:_ `fillStyleId`, `boundVariables.color` _Test:_ Libraries tab lists local color styles and variables; clicking one links the paint. _M2·P1·[OBS]_
- [ ] **PE-019** Paint type selector — Solid, Gradient, Pattern, Image, Video, Shader types selectable from the picker. _Data:_ `paint.type` _Test:_ each type selectable for a rectangle fill; resulting paint type stored correctly. _M2·P0·[OBS]_
- [ ] **PE-020** HSB color area — 2D area with x = saturation (0→100 % left→right) and y = brightness (100 % top → 0 % bottom) at the current hue; live update during drag; one undo step per drag. _Data:_ `SolidPaint.color` _Test:_ drag to top-right corner at hue 0 → #FF0000; bottom edge → #000000; one undo reverts the whole drag. _M1·P0·[KNOW]_
- [ ] **PE-021** Hue slider memory — hue slider 0–360°; when the color becomes achromatic (S=0 or B=0) the picker retains the last hue so re-saturating restores it. _Data:_ UI hue state _Test:_ pick blue, drag to bottom-left (black), drag back up: hue still blue (V-07). _M1·P1·[KNOW]_
- [ ] **PE-022** Opacity slider — writes `paint.opacity` for solids (not color alpha) and the selected stop's alpha for gradients. _Data:_ `paint.opacity`, `ColorStop.color.a` _Test:_ set 40 % on a solid; data shows opacity 0.4 and color has no alpha. _M1·P0·[API]_
- [ ] **PE-023** Color models — Hex (default), RGB, CSS, HSL, HSB selectable; switching changes only display, never the stored color. _Data:_ UI preference _Test:_ set #3366CC, cycle all models and back; stored floats unchanged. _M1·P0·[DOC:360043042113 excerpt]_
- [ ] **PE-024** Color model persistence — the chosen model persists across picker openings and sessions as a user preference (not document data). _Data:_ user prefs _Test:_ choose HSL, close/reopen picker and app → still HSL (Figma currently has a reported reset-to-CSS bug; Illigma follows the intended behavior). _M2·P2·[SRC:https://forum.figma.com/report-a-problem-6/color-picker-color-model-resets-to-css-58618]·[KNOW]_
- [ ] **PE-025** Hex input parsing — accepts optional `#`, case-insensitive; 6 digits = color; 8 digits = color + alpha → paint opacity (AA/255); 3-digit shorthand expands (f0c → FF00CC); 1- and 2-digit expansions per Figma; invalid input reverts without a history entry. _Data:_ `color`, `opacity` _Test:_ table of inputs `f`, `fc`, `f0c`, `ff00cc80`, `zz`, `12345` vs Figma results (V-08). _M1·P0·[DOC:360043042113 excerpt]·[KNOW]_
- [ ] **PE-026** RGB fields — integers 0–255 per channel; typed values clamp to range; display = round(c×255). _Data:_ `color.r/g/b` _Test:_ type 300 → 255; set 128 → stored 128/255 exactly. _M1·P0·[DOC:360043042113 excerpt]_
- [ ] **PE-027** CSS field — shows `rgba()` notation and accepts typed CSS color strings, including named colors. _Data:_ `color`, `opacity` _Test:_ type `rebeccapurple` → #663399 100 %; type `rgba(255,0,0,.5)` → red 50 % (accepted syntaxes: V-08). _M2·P1·[DOC:360043042113 excerpt]_
- [ ] **PE-028** HSL fields — H 0–360, S and L 0–100 %; conversion per §3.2.4. _Data:_ `color` _Test:_ HSL(210,50,40) → #336699 (±1). _M2·P1·[DOC:360043042113 excerpt]·[KNOW]_
- [ ] **PE-029** HSB fields — H 0–360, S and B 0–100 %; consistent with the color area. _Data:_ `color` _Test:_ HSB(0,100,100) → #FF0000; HSB(120,50,50) → #408040 (±1). _M2·P1·[DOC:360043042113 excerpt]·[KNOW]_
- [ ] **PE-030** Field scrubbing — Option/Alt + drag on RGB/HSL/HSB fields decreases (left) or increases (right) values live; one undo step per scrub. _Data:_ `color` _Test:_ Alt-drag R field right 20 px; value increases; undo once restores. _M2·P1·[DOC:360043042113 excerpt]_
- [ ] **PE-031** Inline row editing — hex and opacity can be edited directly in the Fill/Stroke row without opening the picker, with the same parsing rules. _Data:_ `color`, `opacity` _Test:_ type `00ff00` in row → green; `50` in opacity → 50 %. _M1·P0·[KNOW]_
- [ ] **PE-032** Live preview and commit — all continuous picker gestures preview live on canvas and commit one history entry on release; typed values commit on Enter/Tab/blur. _Data:_ history _Test:_ drag hue across range; undo history grows by exactly one. _M1·P0·[KNOW]_
- [ ] **PE-033** Picker dismissal — Esc, click outside or the close control closes the picker keeping the edited value (no revert). _Data:_ UI _Test:_ change color, press Esc: color stays; compare Esc behavior with Figma (V-06). _M1·P1·[OBS]·[KNOW]_
- [ ] **PE-034** Page swatches — the picker shows colors used on the current page; clicking one applies it to the target paint. _Data:_ derived from page paints _Test:_ page with 3 distinct colors: swatches list them; click applies (ordering/limit: V-06). _M2·P1·[OBS]·[KNOW]_
- [ ] **PE-035** No drift — stored colors are floats; opening/closing the picker, switching models or reselecting never alters stored values. _Data:_ `color` _Test:_ fixture color r=0.123456; open/close picker 10×, switch models; value bit-identical. _M1·P0·[KNOW]_
- [ ] **PE-036** Shared paint editing — when all selected layers share the same fill/stroke color it appears in Fill/Stroke and edits apply to all. _Data:_ selection fills _Test:_ 3 rects same red; change to blue in Fill section → all 3 blue in one undo step. _M1·P0·[DOC:360041003774 excerpt]_
- [ ] **PE-037** Color variable binding on solid paints — a solid paint color can be bound to a color variable (shown as a pill); detaching keeps the resolved color. _Data:_ `boundVariables.color` _Test:_ bind, switch mode → color updates; detach → raw color equals last resolved. _M6·P0·[API]_
- [ ] **PE-038** Blend-mode restriction — blend modes cannot be added to fills bound to color variables or on layers with styles/variables applied (control disabled). _Data:_ `blendMode`, bindings _Test:_ bind fill to variable; blend menu unavailable; compare exact disabled set with Figma (V-33). _M6·P1·[DOC:360040667874 excerpt]_

### 6.3 Eyedropper

- [ ] **PE-039** Activate eyedropper — `I` toggles the eyedropper (Mac also Control+C); also from the picker's eyedropper icon. _Data:_ UI _Test:_ press I with a shape selected → eyedropper cursor; picker icon does the same. _M2·P0·[DOC:27643269375767 excerpt]_
- [ ] **PE-040** Sample and apply — clicking samples the rendered canvas color (including image pixels and composited overlaps) and applies it to the selected layers' fill / the open picker paint. _Data:_ `color`, `opacity` _Test:_ sample a photo pixel; selected rect gets that hex; sampled alpha handling matches Figma (V-09). _M2·P0·[DOC:360041003774 excerpt]·[DOC:27643269375767 excerpt]_
- [ ] **PE-041** Loupe — while hovering, a magnified pixel loupe with the color value follows the pointer. _Data:_ UI _Test:_ hover over 1-px stripes at 100 % zoom; loupe shows individual pixels (V-09). _M2·P1·[KNOW]_
- [ ] **PE-042** Shift+click applies style/variable — Shift+click on a pixel whose color comes from a color style or variable applies that style/variable link to the selection. _Data:_ `fillStyleId`, `boundVariables.color` _Test:_ source rect uses variable `brand/primary`; Shift+click → target bound to it. _M6·P1·[SRC:https://forum.figma.com/suggest-a-feature-11/color-picker-eyedropper-should-apply-color-style-34313/index3.html]·[DOC:27643269375767 excerpt]_
- [ ] **PE-043** Plain click applies raw value — without Shift, the sampled raw color is applied even if the source paint is styled/bound. _Data:_ `color` _Test:_ sample a styled fill; target has no style link. _M2·P1·[SRC:https://forum.figma.com/t/color-picker-should-apply-color-style/1540]_
- [ ] **PE-044** No-selection sampling — with nothing selected, sampling copies the color's hex to the clipboard. _Data:_ clipboard _Test:_ deselect, I, click → clipboard contains hex (V-09). _M2·P2·[KNOW]_
- [ ] **PE-045** Cancel — Esc exits the eyedropper without changes. _Data:_ UI _Test:_ I then Esc → no history entry. _M2·P1·[KNOW]_
- [ ] **PE-046** Create from sample — the eyedropper can create color styles/variables from a sampled color. _Data:_ styles/variables _Test:_ follow Figma's flow and compare (V-09). _M6·P2·[DOC:27643269375767 excerpt]_

### 6.4 Gradients

- [ ] **PE-047** Four gradient types — Linear, Radial, Angular, Diamond selectable for fills and strokes. _Data:_ `GRADIENT_LINEAR|RADIAL|ANGULAR|DIAMOND` _Test:_ each type renders matching Figma export of the same fixture within ΔE₀₀ ≤ 1 (V-11). _M2·P0·[API]·[DOC:34208860210199 excerpt]_
- [ ] **PE-048** Solid→gradient seeding — switching a solid paint to a gradient creates two stops seeded from the solid color (100 % → 0 %) along a default axis (top→bottom). _Data:_ `gradientStops`, `gradientTransform` _Test:_ red solid → Linear: stops and handle positions equal Figma (V-10). _M2·P0·[KNOW]_
- [ ] **PE-049** Type switch keeps stops — switching between gradient types keeps stops and handle geometry. _Data:_ `type`, `gradientStops`, `gradientTransform` _Test:_ 3-stop linear → radial → linear: data unchanged. _M2·P1·[KNOW]_
- [ ] **PE-050** Two-stop minimum — a gradient always has ≥ 2 stops; deleting is blocked at 2. _Data:_ `gradientStops.length ≥ 2` _Test:_ select a stop of a 2-stop gradient, press Delete: nothing happens. _M2·P0·[DOC:34208860210199 excerpt]_
- [ ] **PE-051** Add stop on bar — clicking on the picker's gradient bar adds a stop at that position with the interpolated color. _Data:_ `gradientStops` _Test:_ black→white, click at 50 % → new stop ≈ #808080 (interpolation space: V-12). _M2·P0·[KNOW]_
- [ ] **PE-052** Add stop on canvas — clicking the on-canvas gradient line adds a stop at the projected position. _Data:_ `gradientStops` _Test:_ click at 25 % along line → stop position 0.25 (±0.01). _M2·P1·[KNOW]_
- [ ] **PE-053** Edit stop — selecting a stop targets the picker's color/opacity controls at that stop; UI3 lists stops with position %, color and opacity. _Data:_ `ColorStop.color` _Test:_ select stop 2, set #00FF00 50 % → only stop 2 changes (V-10). _M2·P0·[DOC:34208860210199 excerpt]·[KNOW]_
- [ ] **PE-054** Move stop — dragging a stop (bar or canvas) changes its position, clamped 0–1; stops crossing each other re-sort by position. _Data:_ `ColorStop.position` _Test:_ drag stop past the end → position 1.0; drag A past B → order swaps. _M2·P0·[API]·[KNOW]_
- [ ] **PE-055** Delete stop — Delete/Backspace (or the row's remove control) deletes the selected stop when > 2 stops. _Data:_ `gradientStops` _Test:_ 3 stops, delete middle → 2 remain, render updates. _M2·P0·[KNOW]_
- [ ] **PE-056** Numeric stop position — stop position editable as 0–100 % in the stop list. _Data:_ `position` _Test:_ type 33 → 0.33. _M2·P1·[KNOW]_
- [ ] **PE-057** Coincident stops — two stops at the same position create a hard edge with deterministic ordering. _Data:_ `gradientStops` _Test:_ red@0.5, blue@0.5 → sharp edge identical to Figma export. _M2·P1·[KNOW]_
- [ ] **PE-058** Flip and rotate actions — UI3 gradient controls offer reversing stops and rotating 90° (if present in Figma). _Data:_ `gradientStops`, `gradientTransform` _Test:_ verify presence and result in Figma, then match (V-10). _M2·P2·[KNOW]_
- [ ] **PE-059** On-canvas handles — linear: start/end handles; radial/diamond: center plus two independent axis handles (elliptical/stretched shapes); angular: center plus rotation handle; dragging updates live. _Data:_ `gradientTransform` _Test:_ drag each handle; resulting REST `gradientHandlePositions` equal Figma's for the same drags (V-10). _M2·P0·[DOC:34208860210199 excerpt]·[KNOW]_
- [ ] **PE-060** Normalized handles — gradient geometry is stored in layer-normalized space, so it stretches with resize and rotates with the layer. _Data:_ `gradientHandlePositions` (0–1 space) _Test:_ resize 100×100 → 200×100: handle positions in normalized space unchanged; render stretches. _M2·P0·[API]_
- [ ] **PE-061** Transform↔handles conversion — plugin `gradientTransform` and REST handle positions convert exactly per §3.3.3 for all four types. _Data:_ `gradientTransform`, `gradientHandlePositions` _Test:_ round-trip 20 random gradients exported from Figma via REST and plugin JSON (V-11). _M0·P0·[API]·[KNOW]_
- [ ] **PE-062** Gradient evaluation — color at each pixel follows §3.3.3 (linear projection, radial ellipse, diamond L1, angular clockwise sweep with seam at the start handle). _Data:_ `type` _Test:_ pixel diff vs Figma 2x PNG export ≤ 1/255 mean, ≤ 3/255 max (V-11). _M0·P0·[DOC:34208860210199 excerpt]·[KNOW]_
- [ ] **PE-063** Interpolation space & alpha — interpolation color space and premultiplication match Figma (e.g. red→transparent-blue midpoint). _Data:_ `ColorStop.color` _Test:_ fixtures in V-12; midpoint pixel equal to Figma ±1. _M0·P0·[KNOW]_
- [ ] **PE-064** Outside-range extension — beyond first/last stop colors pad (linear/radial/diamond); angular wraps with a seam. _Data:_ — _Test:_ short linear axis in a wide rect: ends flat-colored. _M0·P0·[KNOW]_
- [ ] **PE-065** Gradients on strokes — stroke gradients map over the layer box (not stroke bounds). _Data:_ `strokes[*]` gradient _Test:_ 20 px outside stroke with linear gradient; compare edge colors with Figma (V-13). _M2·P1·[KNOW]_
- [ ] **PE-066** Gradients on text — a text gradient spans the text layer box, not each glyph. _Data:_ text `fills` _Test:_ two-line text with linear gradient matches Figma export (V-13). _M3·P1·[KNOW]_
- [ ] **PE-067** Stop variable binding — each stop color can be bound to a color variable. _Data:_ `ColorStop.boundVariables.color` _Test:_ bind stop 1, change mode → stop updates. _M6·P1·[API]_
- [ ] **PE-068** Constrained handle drag — Shift while dragging a gradient handle constrains angle (45° increments) if Figma does. _Data:_ `gradientTransform` _Test:_ V-10. _M2·P2·[KNOW]_

### 6.5 Image fills & image intake

- [ ] **PE-069** Image paint model — image paints store image hash, scale mode, crop transform, tile scale, rotation and filters. _Data:_ `imageHash, scaleMode, imageTransform, scalingFactor, rotation, filters` _Test:_ inspect saved JSON for a cropped, rotated, tiled, filtered image fixture. _M2·P0·[API]_
- [ ] **PE-070** Content-addressed assets — identical image bytes are stored once (by hash) and shared by all paints using them. _Data:_ `Image.hash` _Test:_ import the same file 3×; package stores 1 blob; all paints share the hash. _M0·P0·[API]_
- [ ] **PE-071** Drag-and-drop import — dropping an image file on empty canvas creates a rectangle at the image's pixel size with an IMAGE FILL paint, named after the file. _Data:_ RECTANGLE + `fills[IMAGE FILL]`, `name` _Test:_ drop 800×600 `photo.jpg` → 800×600 layer; name/position rule matches Figma (V-15). _M2·P0·[KNOW]_
- [ ] **PE-072** Drop onto shape — dropping an image onto an existing shape puts the image into that shape's fills. _Data:_ `fills` _Test:_ drop onto ellipse with red fill; compare replace-vs-add with Figma (V-15). _M2·P1·[KNOW]_
- [ ] **PE-073** Place image tool — Shift+Cmd+K / Shift+Ctrl+K opens a file chooser; selected images are placed by click (natural size) or drag (custom size), or into a clicked shape; multiple files are placed in sequence; Esc cancels the rest. _Data:_ RECTANGLE + IMAGE paint _Test:_ choose 3 files, click/drag/click-on-shape; compare to Figma (V-15). _M2·P1·[KNOW]_
- [ ] **PE-074** Paste raster image — pasting PNG/JPEG data from the system clipboard creates an image layer. _Data:_ RECTANGLE + IMAGE paint _Test:_ copy screenshot from OS, paste → image layer at pixel size. _M2·P0·[KNOW]_
- [ ] **PE-075** Supported formats — PNG, JPEG, GIF are accepted; other formats (WebP, HEIC, TIFF, BMP, SVG-as-image) follow Figma's support list; unsupported files show an error and create nothing. _Data:_ asset store _Test:_ import each format; compare acceptance with Figma (V-16). _M2·P0·[API]·[KNOW]_
- [ ] **PE-076** Downsampling to 4096 — images whose width or height exceeds 4096 px are scaled proportionally so the longest edge fits 4096. _Data:_ stored image size _Test:_ import 8000×3000 → stored 4096×1536 (rounding per V-16); layer size equals stored size. _M2·P0·[API]·[SRC:https://imagecompressor.tools/guides/does-figma-compress-images]_
- [ ] **PE-077** Fill mode — image covers the layer, centered, aspect preserved, overflow clipped. _Data:_ `scaleMode:'FILL'` _Test:_ 200×100 image in 100×100 rect → center 100×100 crop visible. _M2·P0·[DOC:360041098433 excerpt]_
- [ ] **PE-078** Fit mode — entire image visible, centered, aspect preserved; uncovered area transparent. _Data:_ `scaleMode:'FIT'` _Test:_ 200×100 image in 100×100 rect → 100×50 band centered, rest transparent. _M2·P0·[DOC:360041098433 excerpt]_
- [ ] **PE-079** Crop mode — non-destructive crop through an affine image transform; identity transform stretches the image to the layer box. _Data:_ `scaleMode:'CROP'`, `imageTransform` (REST `STRETCH`) _Test:_ set identity transform → image distorted to box; crop again → original pixels intact. _M2·P0·[DOC:360041098433 excerpt]·[API]_
- [ ] **PE-080** Crop editing gestures — entering crop mode shows crop handles; dragging handles changes the visible window; dragging inside moves the image; Enter/Esc/click outside exits. _Data:_ `imageTransform` _Test:_ compare entry gestures and exit keys with Figma (V-17). _M2·P1·[DOC:360041098433 excerpt]·[KNOW]_
- [ ] **PE-081** Fill→Crop continuity — switching from Fill to Crop keeps the current framing (no visual jump). _Data:_ `imageTransform` initialization _Test:_ screenshot before/after switch identical (V-17). _M2·P1·[KNOW]_
- [ ] **PE-082** Tile mode — image repeats across the layer; tile size = percentage of the image's original dimensions. _Data:_ `scaleMode:'TILE'`, `scalingFactor` _Test:_ 50×50 image at 50 % in 100×100 → 16 tiles of 25×25; tile origin matches Figma (V-17). _M2·P0·[DOC:360041098433 excerpt]·[API]_
- [ ] **PE-083** Rotate 90° — image rotates in 90° steps in Fill/Fit/Tile; Crop rotation lives in the transform. _Data:_ `rotation ∈ {0,90,180,270}` _Test:_ rotate button 4× → back to 0; Fill re-covers rotated image. _M2·P1·[API]_
- [ ] **PE-084** Seven adjustments — Exposure, Contrast, Saturation, Temperature, Tint, Highlights, Shadows sliders (UI −100…100 ↔ stored −1…1, default 0). _Data:_ `filters.*` _Test:_ set each to −100/+100; stored −1/+1; reload persists. _M2·P1·[API]·[DOC:360041098433 excerpt]_
- [ ] **PE-085** Adjustment directions & math — exposure −/+ darkens/brightens; contrast − mutes; saturation −100 = grayscale; temperature − cooler / + warmer; tint − green / + magenta; pixel output matches Figma. _Data:_ `filters` _Test:_ gray-ramp + color-chart fixture at ±50/±100 per slider vs Figma exports (V-18). _M2·P1·[DOC:360041098433 excerpt]_
- [ ] **PE-086** No adjustments on animated GIFs — adjustment controls are unavailable for animated GIF paints. _Data:_ `filters` _Test:_ select GIF layer: sliders disabled/hidden. _M2·P2·[DOC:360041098433 excerpt]_
- [ ] **PE-087** Replace image — choosing a new image for an existing image paint swaps the asset while keeping scale mode, rotation, filters, opacity and blend mode (verify crop handling). _Data:_ `imageHash` _Test:_ Tile 50 %, exposure +30, replace → settings kept (V-15). _M2·P1·[KNOW]_
- [ ] **PE-088** Images on strokes and text — image paints are valid stroke paints and text fills. _Data:_ `strokes[IMAGE]`, text `fills[IMAGE]` _Test:_ 20 px stroke with image, text with image fill render like Figma. _M3·P1·[API]·[KNOW]_
- [ ] **PE-089** Image paint opacity & blend — image paints obey per-paint opacity and blend mode. _Data:_ `opacity`, `blendMode` _Test:_ image 50 % Multiply over red fill matches Figma. _M2·P0·[API]_
- [ ] **PE-090** Missing image placeholder — a paint whose asset is missing/unloaded renders Figma's placeholder state and keeps the paint data. _Data:_ `imageHash` unresolved _Test:_ delete blob from package; open: placeholder, no crash, data preserved (look: V-15). _M0·P1·[KNOW]_
- [ ] **PE-091** Canvas image sampling — images are smoothly filtered when scaled on canvas at normal zooms and show pixels at high zoom like Figma. _Data:_ render _Test:_ compare 50 % and 800 % zoom screenshots (V-18). _M0·P1·[KNOW]_
- [ ] **PE-092** Image export resolution — exported images are rendered from source pixels at the export scale with the chosen resampling method. _Data:_ export settings _Test:_ 400×400 image in 100×100 rect exported 4x keeps full detail. _M2·P0·[SRC:https://figmalion.com/topics/import-export]_
- [ ] **PE-093** Imported image aspect lock — whether imported image layers lock aspect ratio by default matches Figma. _Data:_ `targetAspectRatio` _Test:_ import and inspect lock state (V-15). _M2·P2·[KNOW]_
- [ ] **PE-094** Embedded color profiles — images with embedded ICC profiles are converted/assigned to the document profile as Figma does. _Data:_ asset decode _Test:_ P3-tagged PNG in sRGB and P3 files; compare pixels (V-26). _M2·P1·[SRC:https://forum.figma.com/ask-the-community-7/problem-with-managing-image-colour-profiles-34569]_
- [ ] **PE-095** Animated GIF — GIFs keep their animation data; canvas display and paint category (image vs video) match Figma. _Data:_ REST `gifRef` _Test:_ import GIF, observe canvas/prototype (V-19). _M2·P2·[API]·[DOC:360041003694 excerpt]_

### 6.6 Video fills

- [ ] **PE-096** Video paint model — video paints mirror image paints (scale mode, transform, tile scale, rotation, filters) with a video hash. _Data:_ `VideoPaint` _Test:_ save/reload a video fixture; fields preserved. _M2·P2·[API]_
- [ ] **PE-097** Video import — .mp4, .mov and .webm accepted up to 100 MB; larger/invalid files rejected with a message. _Data:_ asset store _Test:_ import 3 formats + 120 MB file. _M2·P2·[DOC:360041003694 excerpt]·[API]_
- [ ] **PE-098** Video on canvas — the canvas shows a still frame (poster) rather than playing. _Data:_ render _Test:_ compare with Figma (V-19). _M2·P2·[KNOW]_
- [ ] **PE-099** Video static export — PNG/JPG/PDF export of a video-filled layer renders the same frame Figma uses. _Data:_ export _Test:_ V-19. _M2·P2·[KNOW]_
- [ ] **PE-100** Video playback options — autoplay/loop/mute and media actions belong to prototyping. _Data:_ reactions `UPDATE_MEDIA_RUNTIME` _Test:_ covered by M7 spec. _M7·P2·[API]·[DOC:8878274530455 (title only)]_

### 6.7 Pattern fills

- [ ] **PE-101** Pattern paint model — pattern paints reference a source node and store tile type, scale, spacing, horizontal (and REST vertical) alignment. _Data:_ `PatternPaint` _Test:_ save/reload; fields preserved. _M2·P2·[API]_
- [ ] **PE-102** Select source — Pattern → "Select source" → click another layer, group or frame on the canvas in the same file. _Data:_ `sourceNodeId` _Test:_ pick a 20×20 star; rect shows star pattern. _M2·P2·[DOC:31616030150167 excerpt]_
- [ ] **PE-103** Tile types — Rectangular, Horizontal hexagonal, Vertical hexagonal layouts. _Data:_ `tileType` _Test:_ each type matches Figma export of the same fixture. _M2·P2·[API]·[DOC:31616030150167 excerpt]_
- [ ] **PE-104** Scale, spacing, alignment — pattern scale, x/y spacing and alignment change tiling as in Figma. _Data:_ `scalingFactor`, `spacing`, `horizontalAlignment` _Test:_ scale 0.5, spacing (0.2,0.2), CENTER vs Figma. _M2·P2·[API]·[DOC:31616030150167 excerpt]_
- [ ] **PE-105** Live source link — editing the source updates every pattern using it. _Data:_ `sourceNodeId` _Test:_ recolor source star → all pattern fills update in the same frame. _M2·P2·[DOC:31616030150167 excerpt]_
- [ ] **PE-106** Source edge cases — deleted, hidden, off-page or self-referencing sources behave like Figma (no infinite recursion). _Data:_ `sourceNodeId` _Test:_ V-20. _M2·P2·[KNOW]_
- [ ] **PE-107** Pattern strokes — patterns work as stroke paints. _Data:_ `strokes[PATTERN]` _Test:_ 10 px stroke with pattern renders. _M2·P2·[DOC:31616030150167 excerpt]_
- [ ] **PE-108** Vertical alignment round-trip — REST `verticalAlignment` is preserved on import/export of documents. _Data:_ `verticalAlignment` _Test:_ REST JSON fixture round-trip. _M8·P2·[API]_

### 6.8 Shader paints & effects

- [ ] **PE-109** Shader pass-through — SHADER paints and effects load, save and copy losslessly and render as a clearly marked placeholder. _Data:_ `ShaderPaint`, `ShaderEffect` _Test:_ fixture with shader fill; reload; data identical; placeholder visible. _M2·P2·[API]·[OBS]_
- [ ] **PE-110** Shader rendering decision — native shader rendering parity is deferred pending a scope decision (open beta in Figma). _Data:_ — _Test:_ decision recorded in roadmap. _M2·P2·[DOC:41175721167767 excerpt — attribution uncertain]_

### 6.9 Blend modes & layer opacity

- [ ] **PE-111** Blend mode catalog — 19 modes with Figma labels and groups (Plus darker = LINEAR_BURN, Plus lighter = LINEAR_DODGE). _Data:_ `BlendMode` _Test:_ menu lists groups/labels exactly; stored enums correct. _M2·P0·[API]·[DOC:360040667874 excerpt]·[SRC:https://developers.figma.com/docs/plugins/api/BlendMode]_
- [ ] **PE-112** Blend defaults — new layers default to Pass through; paints and effects default to Normal. _Data:_ `node.blendMode`, `paint.blendMode` _Test:_ draw rect/frame/group: Pass through; new paint: Normal. _M2·P0·[DOC:360040667874 excerpt]_
- [ ] **PE-113** Pass-through vs isolated containers — Pass through lets children blend with content behind the container; any other mode (incl. Normal) composites the container as an isolated group first. _Data:_ `blendMode` _Test:_ frame (no fill) containing a Multiply child over a red background: Pass through multiplies with red; Normal does not (V-34). _M0·P0·[KNOW]·[DOC:360040667874 excerpt]_
- [ ] **PE-114** Blend formulas — all separable and non-separable modes produce Figma's pixels. _Data:_ `BlendMode` _Test:_ 19-mode swatch grid fixture vs Figma export ±1/255 (V-34). _M0·P0·[SRC:https://blog.logrocket.com/ux-design/figma-blend-modes/]·[KNOW]_
- [ ] **PE-115** Blend menu hover preview — hovering a mode in the menu previews it on canvas without committing (if Figma does). _Data:_ UI _Test:_ hover modes, Esc → unchanged, no history entry (V-33). _M2·P2·[KNOW]_
- [ ] **PE-116** Layer opacity field — 0–100 % in Appearance; clamps out-of-range input. _Data:_ `node.opacity` _Test:_ type 120 → 100 %. _M1·P0·[API]·[OBS]_
- [ ] **PE-117** Opacity number keys — 1…9 set 10…90 %, 0 sets 100 %; two digits typed quickly set an exact value (4,5 → 45 %; 0,0 → 0 %). _Data:_ `opacity` _Test:_ select rect, press keys; timing threshold measured in Figma (V-44). _M1·P0·[KNOW]_
- [ ] **PE-118** Group opacity semantics — layer opacity applies to the composited layer (fills, strokes, effects, children together). _Data:_ `opacity` _Test:_ frame at 50 % with two overlapping opaque children: overlap not darker than either child. _M0·P0·[KNOW]_
- [ ] **PE-119** Zero-opacity layers — layers at 0 % stay selectable on canvas and export as transparent. _Data:_ `opacity:0` _Test:_ click where a 0 % rect is → it selects (V-33). _M1·P1·[KNOW]_
- [ ] **PE-120** Opacity variable binding — layer opacity can be bound to a number variable. _Data:_ `boundVariables.opacity` _Test:_ bind, change mode → opacity updates. _M6·P1·[API]_
- [ ] **PE-121** Mixed opacity — mixed selection shows "Mixed"; typing sets all; scrubbing behavior matches Figma. _Data:_ `opacity` _Test:_ 30 % and 70 % rects; type 50 → both 50 %. _M1·P0·[KNOW]_
- [ ] **PE-122** Frame/section blend semantics — blend modes on frames/sections behave as Figma documents ("blend with layers nested inside"). _Data:_ `blendMode` _Test:_ V-33 (Section blend availability conflicts with API). _M2·P1·[DOC:360040667874 excerpt]_
- [ ] **PE-123** Effect blend modes — drop/inner shadows and noise have their own blend mode. _Data:_ `effect.blendMode` _Test:_ red shadow with Multiply over blue background matches Figma. _M2·P1·[API]_
- [ ] **PE-124** PDF blend fallback — Plus darker/Plus lighter are unsupported in PDF; Illigma's PDF output for them matches Figma's. _Data:_ export _Test:_ V-36. _M2·P2·[DOC:13402894554519 excerpt]_

### 6.10 Strokes

- [ ] **PE-125** Add stroke defaults — `+` on Stroke adds a SOLID paint with default color, weight 1, position Inside for closed shapes and Center for lines/open paths. _Data:_ `strokes`, `strokeWeight`, `strokeAlign` _Test:_ add stroke to rect and to line; compare color/weight/position (V-02). _M1·P0·[DOC:360049283914 excerpt]·[KNOW]_
- [ ] **PE-126** Stroke weight — non-negative, fractional; 0 draws nothing but keeps paints. _Data:_ `strokeWeight ≥ 0` _Test:_ 0.5 renders hairline; −1 rejected/clamped to 0. _M1·P0·[API]_
- [ ] **PE-127** Position Inside/Center/Outside — stroke region per §3.5.2 (doubled stroke masked by the fill region for Inside/Outside). _Data:_ `strokeAlign` _Test:_ 10 px stroke on 100×100 rect: Inside stays within 100×100; Outside spans 120×120; Center 110×110; pixel compare. _M1·P0·[API]_
- [ ] **PE-128** Position on open paths — open paths/lines expose only the positions Figma allows (Inside/Outside behavior verified). _Data:_ `strokeAlign` _Test:_ V-21. _M2·P1·[KNOW]_
- [ ] **PE-129** Position hover preview — hovering an option in the position menu previews it on canvas before committing. _Data:_ UI _Test:_ hover Outside, Esc → unchanged, no history. _M2·P2·[DOC:360049283914 excerpt]_
- [ ] **PE-130** Stroke vs layer bounds — strokes never change W/H; Center/Outside extend render bounds (used by export). _Data:_ `width/height`, render bounds _Test:_ 10 px Outside stroke: W/H unchanged; PNG export 120×120 (V-37). _M1·P0·[KNOW]_
- [ ] **PE-131** Individual sides menu — rectangles and frame-like nodes offer All, Top, Bottom, Left, Right, Custom. _Data:_ `strokeTopWeight…` _Test:_ menu present for rect/frame; absent for ellipse/vector/text. _M2·P1·[SRC:https://uxcel.com/lessons/strokes-in-figma-975]·[API]_
- [ ] **PE-132** Single-side presets — choosing Top/Bottom/Left/Right keeps that side's weight and sets the others to 0. _Data:_ per-side weights _Test:_ weight 4, choose Top → (4,0,0,0) (V-22). _M2·P1·[KNOW]_
- [ ] **PE-133** Custom per-side weights — four fields; `strokeWeight` reads Mixed when sides differ. _Data:_ per-side weights, `strokeWeight: mixed` _Test:_ set 1/2/3/4 → field shows Mixed; typing 2 in the main field sets all sides to 2. _M2·P1·[API]_
- [ ] **PE-134** Per-side rendering with radius — per-side weights combine with corner radius exactly like Figma (inner contour shape). _Data:_ per-side weights, `cornerRadius` _Test:_ rect r=20, sides 2/10/2/10 Inside vs Figma export (V-22). _M2·P2·[KNOW]_
- [ ] **PE-135** Per-side availability — per-side weights are unavailable on ellipses, polygons, stars, vectors, text, lines. _Data:_ mixins _Test:_ UI check per node type. _M2·P1·[API]_
- [ ] **PE-136** Joins — Miter, Bevel, Round; set at node level or per vertex in vector edit mode (node shows Mixed). _Data:_ `strokeJoin`, `VectorVertex.strokeJoin` _Test:_ polyline with sharp corner; each join matches Figma. _M2·P1·[API]_
- [ ] **PE-137** Miter limit — miter joins fall back to bevel below the miter angle (default 28.96° ≈ ratio 4). _Data:_ `strokeMiterLimit`, REST `strokeMiterAngle` _Test:_ angles 20°, 30°, 60° with 10 px stroke; bevel at 20° only. _M2·P1·[API]_
- [ ] **PE-138** Basic caps — None/Round/Square on open-path ends; Square extends by half the weight; Round adds a half-disk. _Data:_ `strokeCap` _Test:_ 100 px line, 20 px weight: Square/Round add 10 px at each end. _M2·P0·[API]·[KNOW]_
- [ ] **PE-139** Arrowheads/end decorations — Line arrow, Triangle arrow, Triangle (filled), Circle, Diamond endpoints with Figma sizing relative to weight. _Data:_ `ARROW_LINES`, `ARROW_EQUILATERAL`, `TRIANGLE_FILLED`, `CIRCLE_FILLED`, `DIAMOND_FILLED` _Test:_ each cap at weights 1/4/10 vs Figma export; UI labels match (V-23). _M2·P1·[API]_
- [ ] **PE-140** Separate start/end — start and end decorations can differ; node-level cap reads Mixed; swap action exchanges them. _Data:_ per-vertex `strokeCap` _Test:_ start None, end Triangle arrow; swap → reversed (V-23). _M2·P1·[API]·[KNOW]_
- [ ] **PE-141** Caps on closed paths — cap controls are hidden/disabled for closed shapes (they have no ends). _Data:_ `strokeCap` _Test:_ select rect: no end-point controls (V-23). _M2·P1·[KNOW]_
- [ ] **PE-142** Dashed style — Advanced stroke settings → Dashed exposes Dash and Gap (px); switching back to Solid clears the dash pattern. _Data:_ `dashPattern` _Test:_ dash 10 gap 5 → `[10,5]`; Solid → `[]`. _M2·P0·[DOC:360049283914 excerpt]·[API]_
- [ ] **PE-143** Dash caps — None/Round/Square apply to each dash. _Data:_ `strokeCap` with dashes _Test:_ dash 0 gap 10 Round on Center stroke = dotted line. _M2·P1·[DOC:360049283914 excerpt]_
- [ ] **PE-144** Dash phase & distribution — dashed lines start and end with a half-length dash; closed-shape distribution matches Figma. _Data:_ `dashPattern` _Test:_ line 100 px, dash 10 gap 10; closed rect 100×100 (V-24). _M2·P1·[DOC:360049283914 excerpt]_
- [ ] **PE-145** Dashes with Inside/Outside — dashes on non-center strokes are computed on the doubled stroke then masked, like Figma. _Data:_ `dashPattern`, `strokeAlign` _Test:_ Inside dashed rect vs Figma export. _M2·P2·[API]·[SRC:https://forum.figma.com/report-a-problem-6/dashed-stroke-incompatible-with-stroke-inside-outside-56095]_
- [ ] **PE-146** Arbitrary dash arrays — dash arrays longer than [dash, gap] from imports are preserved and rendered even if the UI only edits two values. _Data:_ `dashPattern` _Test:_ import `[5,2,1,2]`; renders and survives save. _M8·P2·[API]_
- [ ] **PE-147** Multiple stroke paints — stroke paints stack bottom-to-top with per-paint opacity/blend like fills. _Data:_ `strokes` _Test:_ red + 50 % blue stroke → purple-ish matching Figma. _M2·P1·[API]_
- [ ] **PE-148** Text strokes — text layers accept node-wide strokes with position options; default position matches Figma. _Data:_ text `strokes`, `strokeAlign` _Test:_ add stroke to text; compare default and rendering (V-21). _M3·P1·[KNOW]_
- [ ] **PE-149** Frame strokes vs children — a frame's stroke renders relative to its children (above/below) and clipping exactly as Figma. _Data:_ frame `strokes`, `clipsContent` _Test:_ child overlapping frame edge with Inside 10 px stroke (V-04). _M1·P1·[KNOW]_
- [ ] **PE-150** Strokes in auto layout — "Inside stroke: Included/Excluded" toggles whether strokes take space in auto layout. _Data:_ `strokesIncludedInLayout` _Test:_ auto layout frame 10 px stroke, padding 0: Included shifts children by 10. _M4·P1·[API]·[OBS]_
- [ ] **PE-151** Stroke weight variables — strokeWeight and each side weight can be bound to number variables. _Data:_ `boundVariables.strokeWeight…` _Test:_ bind and change mode. _M6·P1·[API]_
- [ ] **PE-152** Swap fill and stroke — Shift+X swaps fill and stroke paints. _Data:_ `fills`, `strokes` _Test:_ red fill + blue stroke → blue fill + red stroke; weight/position behavior matches Figma (V-44). _M2·P1·[KNOW]_
- [ ] **PE-153** Outline stroke — converts the stroke into a new filled vector (fill = stroke paints); original stroke removed; available only when strokes exist. _Data:_ `outlineStroke()` _Test:_ outline 10 px Inside stroke; resulting vector geometry equals Figma's (shortcut V-44). _M2·P0·[API]·[DOC:33052305733015 (title only)]_
- [ ] **PE-154** Variable width profiles — presets Uniform, Wedge, Taper, Quarter taper, Eye, Mirrored taper and custom width points (position 0–1, width as fraction of weight). _Data:_ `variableWidthStrokeProperties` _Test:_ each preset on a 200 px line at weight 10 vs Figma export. _M2·P2·[API]_
- [ ] **PE-155** Variable width constraints — not applicable to branching vector networks; incompatible with dynamic strokes. _Data:_ as above _Test:_ branching vector → control disabled; enabling dynamic removes width points. _M2·P2·[API]_
- [ ] **PE-156** Brush strokes — stretch and scatter brushes with Figma's parameters (scatter gap ≥ 0.25, wiggle ≥ 0, size jitter 0–3, angular jitter and rotation −180…180; stretch direction). _Data:_ `complexStrokeProperties` BRUSH _Test:_ data round-trip; rendering pending brush-asset decision. _M2·P2·[API]·[DOC:30965205437975 excerpt]_
- [ ] **PE-157** Dynamic strokes — frequency 0.01–20, wiggle ≥ 0, smoothen 0–1. _Data:_ `complexStrokeProperties` DYNAMIC _Test:_ data round-trip and render vs Figma. _M2·P2·[API]_
- [ ] **PE-158** Non-solid stroke paints — gradients, images and patterns are valid stroke paints. _Data:_ `strokes[*].type` _Test:_ each type renders on a 20 px stroke. _M2·P1·[API]·[DOC:31616030150167 excerpt]_

### 6.11 Effects

- [ ] **PE-159** Effect list — `+` adds an effect (Drop shadow by default); rows can be hidden, removed and their type changed. _Data:_ `effects` _Test:_ press `+` → drop shadow row; compare default type (V-25). _M2·P0·[KNOW]_
- [ ] **PE-160** Type switching — changing a row's effect type converts parameters as Figma does (shared fields kept, others defaulted). _Data:_ `effects[i].type` _Test:_ drop shadow (x 2, y 8, blur 10) → inner shadow → back (V-25). _M2·P1·[KNOW]_
- [ ] **PE-161** Per-type limits — at most 8 drop shadows, 8 inner shadows, 1 layer blur, 1 background blur, 2 noise, 1 texture per layer; types at their limit are not offered. _Data:_ `effects` _Test:_ add 9th drop shadow → impossible; glass limit per V-25. _M2·P1·[SRC:figma-signup.helpjuice.com/apply-effects-to-layers (mirror of DOC:360041488473)]_
- [ ] **PE-162** Drop shadow defaults — new drop shadow X 0, Y 4, Blur 4, Spread 0, #000000 at 25 %, Normal. _Data:_ `DropShadowEffect` _Test:_ add one; compare all fields (V-25). _M2·P0·[SRC:https://forum.figma.com/t/set-starting-defaults-for-design-fill-stroke-effects/617]·[KNOW]_
- [ ] **PE-163** Shadow geometry — offset translates; blur is Gaussian with sigma = blur/2; spread dilates (drop) the silhouette before blurring. _Data:_ `offset`, `radius`, `spread` _Test:_ 100×100 black rect, shadow y 20 blur 20 spread 10 vs Figma export profile (V-27). _M0·P0·[KNOW]_
- [ ] **PE-164** Shadow source silhouette — shadows follow the layer's rendered alpha (fills, strokes and, for containers, children; transparent image pixels cast no shadow). _Data:_ effects on frames/images _Test:_ frame with no fill and two children; PNG with transparency (V-27). _M2·P0·[KNOW]_
- [ ] **PE-165** Shadow knock-out — by default drop shadows are not visible through transparent/translucent parts of the layer. _Data:_ `showShadowBehindNode:false` _Test:_ 50 % fill rect with shadow: no shadow seen through the rect. _M2·P0·[SRC:figma-signup.helpjuice.com/apply-effects-to-layers (mirror of DOC:360041488473)]·[API]_
- [ ] **PE-166** Show behind transparent areas — option available only when the layer qualifies (e.g. only fills < 100 % opacity, or stroke with no fill); not on inner shadows; enabling shows the shadow through the layer. _Data:_ `showShadowBehindNode` _Test:_ toggle on 50 % rect → shadow visible through; option disabled on 100 % fill (V-28). _M2·P1·[SRC:helpjuice mirror of DOC:360041488473]·[API]_
- [ ] **PE-167** Spread support — spread applies only to rectangles, ellipses, and frames/components/instances with a visible fill and clip content; elsewhere it is ignored (UI state per V-28). _Data:_ `spread` _Test:_ spread 20 on a star: no effect; on rect: grows. _M2·P1·[API]·[SRC:helpjuice mirror of DOC:360041488473]_
- [ ] **PE-168** Inner shadow — color, X, Y, blur, spread (positive contracts), blend mode; drawn inside the shape only. _Data:_ `InnerShadowEffect` _Test:_ inner shadow y 4 blur 4 spread 2 vs Figma export (V-27). _M2·P0·[API]_
- [ ] **PE-169** Inner shadow stacking — inner shadows draw above fills; position relative to strokes and children matches Figma. _Data:_ `effects` _Test:_ frame with child + inner shadow; rect with stroke + inner shadow (V-04). _M0·P0·[KNOW]_
- [ ] **PE-170** Multiple shadow order — several shadows composite in list order consistent with Figma. _Data:_ `effects` order _Test:_ red and blue overlapping shadows, swap order, compare (V-27). _M2·P1·[KNOW]_
- [ ] **PE-171** Shadow color/blend/variables — shadow color has its own alpha; blend mode per shadow; color, radius, spread, offsetX, offsetY bindable. _Data:_ `color: RGBA`, `blendMode`, `boundVariables` _Test:_ bind blur to variable; mode switch updates. _M2·P1·[API]_
- [ ] **PE-172** Uniform layer blur — blurs the whole layer render with sigma = radius/2. _Data:_ `LAYER_BLUR`, `blurType:'NORMAL'` _Test:_ 100×100 rect blur 20 vs Figma export (V-29). _M2·P0·[API]·[KNOW]_
- [ ] **PE-173** Progressive layer blur — start radius at start point to end radius at end point; Uniform/Progressive switch; on-canvas start/end handles. _Data:_ `blurType:'PROGRESSIVE'`, `startRadius`, `startOffset`, `endOffset`, `radius` _Test:_ start 0 at top, 40 at bottom on a photo vs Figma export (V-30). _M2·P1·[API]·[SRC:https://app.uxcel.com/courses/figma-intro/shadows-blurs-866/layer-blur-7140]_
- [ ] **PE-174** Progressive interpolation — radius varies along the start→end axis, clamped outside, two knots only. _Data:_ as above _Test:_ sample blur strength at 0/25/50/75/100 % (V-30). _M0·P1·[SRC:https://forum.figma.com/suggest-a-feature-11/progressive-blur-gradient-controls-48326]·[KNOW]_
- [ ] **PE-175** Background blur — blurs content behind the layer within the layer's shape; only visible where the layer's paints are not fully opaque. _Data:_ `BACKGROUND_BLUR` _Test:_ 30 % white rect over text with blur 20 vs Figma export; 100 % fill hides it. _M2·P0·[API]·[SRC:https://uxcel.com/lessons/shadows-blurs-866]_
- [ ] **PE-176** Progressive background blur — supported if Figma's UI exposes it (data model allows). _Data:_ `BACKGROUND_BLUR` + `PROGRESSIVE` _Test:_ V-30. _M2·P2·[API]_
- [ ] **PE-177** Blur ranges — radius ≥ 0; UI maximum and scrubbing step match Figma. _Data:_ `radius` _Test:_ type 10000 and −5; compare clamping (V-29). _M2·P1·[API]_
- [ ] **PE-178** Noise effect — Monotone/Duotone/Multitone with size, density, color(s), multitone opacity, blend mode; at most 2 per layer. _Data:_ `NOISE` fields _Test:_ each type at fixed seed-independent stats (mean/variance) vs Figma export (V-31). _M2·P2·[API]·[DOC:30965205437975 excerpt]_
- [ ] **PE-179** Noise data rules — not variable-bindable; `noiseSizeVector.x` must equal `noiseSize`. _Data:_ `noiseSize`, `noiseSizeVector` _Test:_ model rejects mismatched write. _M2·P2·[API]_
- [ ] **PE-180** Texture effect — size, radius, clip-to-shape; at most 1 per layer. _Data:_ `TEXTURE` _Test:_ clipToShape on/off on a circle vs Figma (V-31). _M2·P2·[API]_
- [ ] **PE-181** Glass effect — light intensity, light angle, refraction, depth, dispersion, frost (radius), splay; ranges per Figma UI. _Data:_ `GLASS` _Test:_ data round-trip; visual approximation reviewed against Figma screenshots (V-32). _M2·P2·[API]·[SRC:https://www.createwith.com/tool/figma/updates/figma-takes-glass-effect-out-of-beta-with-new-controls]_
- [ ] **PE-182** Glass applicability — glass applies to any layer type including text, with independent corner radii, as of Figma's 2026 release. _Data:_ `effects` _Test:_ apply to text and to rect with mixed radii (V-32). _M2·P2·[SRC:https://www.createwith.com/tool/figma/updates/figma-rolls-out-glass-effect-updates-with-independent-corner-rounding-and-variab]_
- [ ] **PE-183** Effect visibility — hidden effects are not rendered or exported but persist. _Data:_ `effect.visible` _Test:_ hide shadow → gone in canvas and PNG; reload keeps. _M2·P0·[API]_
- [ ] **PE-184** Container effects — effects on groups/frames apply to the composited container result. _Data:_ group `effects` _Test:_ group of 2 shapes with drop shadow: one combined shadow, no inner overlap shadow. _M2·P0·[KNOW]_
- [ ] **PE-185** Effect render bounds — effects extend render bounds (canvas invalidation, export size) but not layer W/H. _Data:_ render bounds _Test:_ shadow y 20 blur 20: PNG export grows; W/H unchanged (V-37). _M2·P0·[SRC:https://forum.figma.com/archive-21/figma-exports-framed-icon-with-incorrect-sizes-30924]·[KNOW]_
- [ ] **PE-186** Effects under scaling — K-scale (scale tool) scales shadow/blur values; noise/texture/progressive blur scaling behavior matches Figma. _Data:_ effect fields _Test:_ K-scale 200 %: compare values (V-31). _M2·P2·[SRC:https://forum.figma.com/share-your-feedback-26/none-scalable-effects-new-effects-43032]·[KNOW]_
- [ ] **PE-187** Effect variable bindings — color, radius, spread, offsetX, offsetY are bindable for shadows; radius for blurs; none for noise/texture (glass per V-32). _Data:_ `VariableBindableEffectField` _Test:_ binding UI offered exactly for these fields. _M6·P1·[API]_
- [ ] **PE-188** Effect styles — effects can be linked to an effect style and detached (keeps values). _Data:_ `effectStyleId` _Test:_ apply style, detach, values unchanged. _M6·P0·[API]_
- [ ] **PE-189** Clipped child effects — effects of children inside a clipping frame are clipped by the frame. _Data:_ `clipsContent` _Test:_ child shadow crossing frame edge is cut. _M2·P1·[KNOW]_

### 6.12 Mixed selections & selection colors

- [ ] **PE-190** Identical paints shown once — when all selected layers have identical fills (or strokes), the section shows them and edits apply to all. _Data:_ `fills` _Test:_ see PE-036 with gradient fills too. _M1·P0·[DOC:360041003774 excerpt]_
- [ ] **PE-191** Mixed paints — differing fill lists show a Mixed state; adding/setting a paint replaces all lists with one paint. _Data:_ `fills` _Test:_ red rect + blue ellipse: Fill shows mixed; `+` → both get one identical paint (V-14). _M1·P0·[KNOW]_
- [ ] **PE-192** Selection colors visibility — the Selection colors section appears only when the selection contains objects with mixed fills. _Data:_ derived _Test:_ same-color selection: section absent; mixed: present. _M2·P1·[DOC:360042553434 excerpt]_
- [ ] **PE-193** Selection colors grouping — entries grouped by variable, style and plain color; each color once; three most frequent shown with See all colors/See all styles. _Data:_ derived _Test:_ fixture with 6 colors, 2 styles, 2 variables; order and truncation match Figma (V-14). _M2·P1·[DOC:360042553434 excerpt]_
- [ ] **PE-194** Edit via selection colors — changing an entry updates every occurrence in the selection (fills and strokes, nested descendants) in one undo step; clicking a style/variable opens the style modal. _Data:_ all occurrences _Test:_ frame with nested red fills/strokes; change red → all updated (V-14). _M2·P1·[DOC:360042553434 excerpt]·[KNOW]_
- [ ] **PE-195** Large selections — above 1000 distinct colors the feature degrades as Figma does. _Data:_ — _Test:_ generate 1500 colors; compare UI (V-14). _M2·P2·[API]_
- [ ] **PE-196** Mixed numeric values — stroke weight, effect values and similar fields show Mixed and accept a value for all. _Data:_ various _Test:_ two rects with 1 and 4 px strokes: type 2 → both 2. _M1·P0·[KNOW]_
- [ ] **PE-197** Mixed effects — differing effect lists show a mixed state with a replace affordance. _Data:_ `effects` _Test:_ one rect with shadow, one with blur: Effects shows mixed; replace → identical lists (V-25). _M2·P1·[KNOW]_

### 6.13 Color management

- [ ] **PE-198** Document color profile — each file has a profile sRGB or Display P3 (legacy files LEGACY); rendering and picker values are interpreted in it. _Data:_ `documentColorProfile` _Test:_ same #FF0000 in sRGB vs P3 file renders differently on a P3 display. _M2·P1·[API]·[DOC:360039825114 excerpt]_
- [ ] **PE-199** New-file default — new files use sRGB unless the user preference (Preferences → Color profile) says otherwise. _Data:_ user pref _Test:_ set preference P3, create file → P3. _M2·P1·[DOC:360039825114 excerpt]_
- [ ] **PE-200** Change profile: Assign vs Convert — "Keep color values (Assign)" keeps numbers; "Keep appearance (Convert)" rewrites stored colors (incl. stops, effects) to preserve appearance. _Data:_ all colors _Test:_ convert sRGB #FF0000 to P3 → stored values change (≈ P3 0.918,0.200,0.139); assign → unchanged. _M2·P1·[DOC:360039825114 excerpt]_
- [ ] **PE-201** Legacy/unmanaged files — legacy files behave as "Same as preferred profile"; after assigning a profile they cannot return to it. _Data:_ `LEGACY` _Test:_ import legacy fixture (M8) (V-26). _M8·P2·[DOC:360039825114 excerpt]_
- [ ] **PE-202** Color-managed canvas — the canvas converts from document profile to the display profile. _Data:_ render _Test:_ P3 file on P3 display shows saturated red beyond sRGB. _M0·P1·[KNOW]_
- [ ] **PE-203** Picker values in document space — numeric values shown/entered in the picker are in the document profile (no hidden conversion). _Data:_ `color` _Test:_ P3 file: type #FF0000 → stored (1,0,0). _M2·P1·[KNOW]_
- [ ] **PE-204** Export color profile — exports default to the document profile; per-setting override to sRGB or Display P3; output tagged/converted like Figma. _Data:_ `colorProfile` _Test:_ inspect exported PNG/JPG ICC chunk and pixel values (V-26). _M2·P1·[API]·[DOC:360039825114 excerpt]_

### 6.14 Export settings & exporting

- [ ] **PE-205** Add export setting — `+` in Export adds a setting (first: 1x PNG); further `+` adds settings with incremented scale. _Data:_ `exportSettings` _Test:_ press `+` 3× → compare scales/formats with Figma (V-35). _M2·P0·[DOC:360040028114 excerpt]·[KNOW]_
- [ ] **PE-206** Multiple settings per node — any number of settings; each removable; all persist with the node. _Data:_ `exportSettings[]` _Test:_ 4 settings saved/reloaded. _M2·P0·[DOC:360040028114 excerpt]·[API]_
- [ ] **PE-207** Scale presets & custom — presets 0.5x, 0.75x, 1x, 1.5x, 2x, 3x, 4x (+ width/height presets); custom input with `x`, `w`, `h` suffix. _Data:_ `constraint {SCALE|WIDTH|HEIGHT, value}` _Test:_ type `512w` → WIDTH 512; `300h` → HEIGHT 300; `2.5x` → SCALE 2.5. _M2·P0·[API]·[DOC:13402894554519 excerpt]_
- [ ] **PE-208** Raster size computation — output pixel size = render bounds × scale (or proportional to width/height), rounded as Figma rounds. _Data:_ `constraint` _Test:_ 33.3×10 layer at 1.5x; 100×50 at 512w → 512×256 (V-37). _M2·P0·[KNOW]_
- [ ] **PE-209** File naming & suffix — file name = layer name + suffix + extension; automatic `@Nx` naming for non-1x without suffix (if Figma does). _Data:_ `suffix` _Test:_ "Icon" at 2x no suffix; with suffix "-dark" (V-35). _M2·P0·[API]·[KNOW]_
- [ ] **PE-210** Formats — PNG, JPG, SVG, PDF per setting. _Data:_ `format` _Test:_ each format produces a valid file opened by standard viewers. _M2·P0·[API]_
- [ ] **PE-211** PNG specifics — lossless 32-bit RGBA with alpha; transparent areas stay transparent. _Data:_ PNG _Test:_ frame with no fill exports transparent background. _M2·P0·[DOC:13402894554519 excerpt]_
- [ ] **PE-212** JPG transparency — JPG has no alpha; transparent regions are filled as Figma does. _Data:_ JPG _Test:_ transparent frame export → background color (V-36). _M2·P0·[KNOW]_
- [ ] **PE-213** Image quality — JPG and PDF offer High/Medium/Low (JPG default High = no compression; PDF default Medium). _Data:_ export option (storage V-36) _Test:_ file sizes ordered High > Medium > Low. _M2·P1·[SRC:https://figmalion.com/topics/import-export]·[DOC:13402894554519 excerpt TOC]_
- [ ] **PE-214** Image resampling — Detailed (bicubic, default) vs Basic (nearest neighbor) for JPG/PNG/PDF. _Data:_ export option _Test:_ 16×16 pixel-art image exported 4x: Basic keeps hard edges. _M2·P1·[SRC:https://figmalion.com/topics/import-export]_
- [ ] **PE-215** Ignore overlapping layers — default on (only the node); off includes any layers intersecting the node (above or below). _Data:_ `contentsOnly` _Test:_ rect overlapped by a sibling circle: on → no circle; off → circle included. _M2·P1·[API]·[SRC:https://forum.figma.com/t/ignore-overlapping-layers-export-option-is-not-respected-in-slice-export/63390]_
- [ ] **PE-216** Include bounding box — exports use full node dimensions regardless of cropping/empty space (text not cropped). _Data:_ `useAbsoluteBounds` (mapping V-37) _Test:_ text with large line height: on → full box; off → tight bounds. _M2·P1·[API]_
- [ ] **PE-217** Export bounds — default bounds include visible strokes and effects; clipped frames use the frame rect plus the frame's own effects. _Data:_ render bounds _Test:_ fixtures in V-37. _M2·P0·[KNOW]·[SRC:https://forum.figma.com/archive-21/figma-exports-framed-icon-with-incorrect-sizes-30924]_
- [ ] **PE-218** SVG outline text — default on (text as paths); off emits `<text>` elements. _Data:_ `svgOutlineText` _Test:_ export text both ways; inspect SVG. _M3·P1·[API]_
- [ ] **PE-219** SVG id attribute — off by default; on adds layer names as `id`; masks/gradients always have ids. _Data:_ `svgIdAttribute` _Test:_ inspect SVG ids. _M2·P1·[API]_
- [ ] **PE-220** SVG simplify stroke — default on: inside/outside strokes approximated as plain strokes; off: masking technique. _Data:_ `svgSimplifyStroke` _Test:_ Inside 10 px stroke rect both ways; visual equality. _M2·P1·[API]·[DOC:360049283914 excerpt]_
- [ ] **PE-221** SVG unsupported features — angular/diamond gradients, noise/texture/glass, background and progressive blur export as Figma does (raster fallback or approximation). _Data:_ SVG writer _Test:_ V-39. _M2·P1·[SRC:https://webdesign.tutsplus.com/using-figma-for-svg-design--CRS-200909c/what-exports-well-to-svg]_
- [ ] **PE-222** PDF specifics — PDF 1.7, vector where possible, text as selectable glyphs (not editable). _Data:_ PDF writer _Test:_ export text frame; select/copy text in a viewer. _M2·P1·[DOC:13402894554519 excerpt]_
- [ ] **PE-223** Hidden content excluded — hidden layers, hidden paints and hidden effects are not exported. _Data:_ `visible` _Test:_ export frame with hidden child → absent. _M2·P0·[KNOW]_
- [ ] **PE-224** Preview — optional export preview of the asset; not shown when multiple objects are selected. _Data:_ UI _Test:_ select 2 layers: no preview. _M2·P2·[DOC:360040028114 excerpt]_
- [ ] **PE-225** Run export — one file per (node × setting); multiple outputs go to a chosen folder (Illigma desktop) instead of a browser zip. _Data:_ export pipeline _Test:_ 3 layers × 2 settings → 6 files. _M2·P0·[DOC:360040028114 excerpt]_
- [ ] **PE-226** Name collisions & folders — duplicate names and `/` in layer names are handled like Figma (folders/suffixes). _Data:_ file naming _Test:_ two layers named "a/b" (V-35). _M2·P1·[KNOW]_
- [ ] **PE-227** Page export — with nothing selected, the page's Export section exports the entire page canvas. _Data:_ page export _Test:_ deselect, add 1x PNG, export → bounds of all page content. _M2·P1·[DOC:360040028114 excerpt]_
- [ ] **PE-228** Export dialog — Shift+Cmd+E / Shift+Ctrl+E opens the export dialog listing exportable items with settings and checkboxes. _Data:_ UI _Test:_ compare contents and scope (selection vs page) with Figma (V-38). _M2·P1·[SRC:https://dev.to/dishank/best-figma-shortcuts-for-designers-2j6n]·[KNOW]_
- [ ] **PE-229** Slices — slice tool (S) creates a slice; exporting a slice renders everything visible inside its rectangle. _Data:_ `SliceNode`, `exportSettings` _Test:_ slice over part of two frames → both included. _M2·P1·[API]·[SRC:https://www.guideflow.com/tutorial/how-to-use-the-slice-tool-in-figma]_
- [ ] **PE-230** Export frames to PDF — exporting multiple top-level frames to one multi-page PDF (File menu) if present in Figma. _Data:_ PDF writer _Test:_ V-38. _M2·P2·[KNOW]_
- [ ] **PE-231** Export settings travel with nodes — copy/paste, duplicate and undo preserve export settings. _Data:_ `exportSettings` _Test:_ duplicate a layer with 2 settings → duplicate has both. _M2·P0·[API]·[KNOW]_
- [ ] **PE-232** Export settings on instances — instances inherit export settings from the main component and may override them, as in Figma. _Data:_ `exportSettings` _Test:_ V-43. _M5·P1·[KNOW]_
- [ ] **PE-233** Scale limits — custom scale range and maximum output size match Figma (REST render API: 0.01–4). _Data:_ `constraint.value` _Test:_ type 0.001x, 10x, 20000w (V-37). _M2·P1·[API]_
- [ ] **PE-234** Text export bounds — text layers export uncropped when absolute bounds is enabled. _Data:_ `useAbsoluteBounds` _Test:_ text with descenders/large line height. _M3·P2·[API]_
- [ ] **PE-235** No editor overlays — exports never contain selection outlines, guides, layout grids or handles. _Data:_ export pipeline _Test:_ export frame with visible layout grid → grid absent. _M2·P0·[KNOW]_
- [ ] **PE-236** Animation export (out of scope here) — MP4/GIF/WebM for animated top-level frames are tracked in M7/M8. _Data:_ `ExportSettingsMP4/GIF/WEBM` _Test:_ n/a. _M7·P2·[API]_

### 6.15 Copy as / clipboard

- [ ] **PE-237** Copy as PNG — Shift+Cmd+C / Shift+Ctrl+C puts a PNG rendering of the selection on the clipboard (scale per Figma, reportedly 2x). _Data:_ clipboard image _Test:_ copy 100×100 rect, paste into an image editor → pixel size per V-40. _M2·P1·[SRC:forum.figma.com community-support answer (search summary)]·[SRC:https://yummygum.com/blog/get-the-most-out-of-figma-with-these-power-features]_
- [ ] **PE-238** Copy as SVG — context menu Copy/Paste as → Copy as SVG puts SVG markup on the clipboard. _Data:_ clipboard text _Test:_ paste into text editor → valid SVG equal to SVG export defaults (V-40). _M2·P1·[SRC:https://convert.remotion.dev/docs/figma]_
- [ ] **PE-239** Copy as code (CSS) — copies CSS for the selection (background/linear-gradient, border, box-shadow, filter/backdrop-filter, opacity, mix-blend-mode) in Figma's format, e.g. blur values halved. _Data:_ CSS generator _Test:_ V-40. _M2·P2·[KNOW]_
- [ ] **PE-240** Copy/paste properties — Option+Cmd+C / Ctrl+Alt+C then Option+Cmd+V / Ctrl+Alt+V transfers fills, strokes (paints + settings), effects, opacity and blend mode (export settings per V-41). _Data:_ property clipboard _Test:_ copy from styled rect, paste to plain ellipse; compare transferred set (V-41). _M2·P1·[KNOW]_
- [ ] **PE-241** Copy a single paint/effect row — selecting a fill/effect row and copying/pasting it onto other layers (if Figma supports). _Data:_ clipboard _Test:_ V-41. _M2·P2·[KNOW]_
- [ ] **PE-242** Paste SVG markup — pasting SVG text creates vector layers with paints/strokes mapped (import details in M8). _Data:_ `createNodeFromSvg` equivalent _Test:_ paste simple SVG → vector with fill. _M8·P1·[SRC:https://forum.figma.com/ask-the-community-7/paste-svg-code-no-longer-available-29257]·[API]_
- [ ] **PE-243** Layer copy/paste keeps assets — copying layers with image/video paints between Illigma documents carries the assets. _Data:_ asset store _Test:_ copy image layer to a new file, save, reopen → image present. _M1·P0·[KNOW]_

### 6.16 Undo, components, layout & variables integration

- [ ] **PE-244** Undo granularity — one undo entry per committed paint/stroke/effect/export change as listed in §3.12; no entries for UI-only changes. _Data:_ history _Test:_ scripted sequence of 12 edits → exactly 12 undo steps (V-42). _M2·P0·[KNOW]_
- [ ] **PE-245** Undo with picker open — undo/redo while the picker is open updates the picker to the restored value and keeps its target. _Data:_ UI target _Test:_ change color, Cmd+Z with picker open (V-42). _M2·P1·[KNOW]_
- [ ] **PE-246** Instance overrides — fills, strokes, stroke settings, effects, opacity and blend mode can be overridden on instances. _Data:_ instance overrides _Test:_ override fill on instance; edit main fill → instance keeps override (V-43). _M5·P0·[KNOW]_
- [ ] **PE-247** Reset overrides — resetting restores main-component paint/effect values. _Data:_ overrides _Test:_ reset → instance equals main. _M5·P0·[KNOW]_
- [ ] **PE-248** Image override granularity — image paint overrides behave like Figma when the main component's image/scale mode changes. _Data:_ overrides _Test:_ V-43. _M5·P1·[KNOW]_
- [ ] **PE-249** Paint style linking — a paint list can be linked to a paint style (fills or strokes); editing the style updates all users; detaching keeps paints. _Data:_ `fillStyleId`, `strokeStyleId` _Test:_ link, edit style, detach. _M6·P0·[API]_
- [ ] **PE-250** Images under auto layout resize — Fill/Fit/Tile images recompute when auto layout resizes the layer. _Data:_ `scaleMode` _Test:_ fill-container image in growing parent stays covered. _M4·P1·[DOC:360041098433 excerpt]·[KNOW]_
- [ ] **PE-251** Effects/strokes and layout — effects never affect auto layout; strokes only when included. _Data:_ `strokesIncludedInLayout` _Test:_ large shadow on child: siblings don't move. _M4·P1·[API]·[KNOW]_
- [ ] **PE-252** Mode switching — changing a variable mode re-resolves all bound paint colors, stop colors, effect values, stroke weights and opacity. _Data:_ bound variables _Test:_ light/dark modes on a frame; all bindings update. _M6·P1·[API]_

---
## 7. Cross-area dependencies

| Depends on / feeds | What this area needs or provides |
| --- | --- |
| **M0 Renderer** | Premultiplied compositing with all 19 blend modes and isolation rules (§3.1.3); Gaussian blur (σ = radius/2), progressive blur, morphological dilation for spread; gradient shaders for 4 types; image sampling with filters; color-managed output (document profile → display); offscreen layers for opacity/effects; render-bounds computation shared with export. |
| **M0 Document model / persistence** | Paint/effect/export arrays with lossless unknown-field preservation; content-addressed image/video asset store inside the file package; `documentColorProfile`; undo transactions that coalesce gestures (§3.12). |
| **M0 UI kit** | Numeric fields (scrub, arrow nudge, math, Mixed state), popovers that retain targets, dropdowns with hover preview, sliders, swatches, color area. |
| **M1 Selection & inspector** | Mixed-value aggregation across multi-selection; Appearance/Fill/Stroke/Effects/Export section visibility per node type (§2.3); layer opacity number-key shortcuts must not fire while a text field has focus. |
| **M1 Shapes/frames/sections** | Default paints per created node (§3.2.2); `clipsContent` (clips child effects, affects spread support and export bounds); Section paint capability. |
| **M2 Vectors** | Fill regions of vector networks (closed regions only), per-vertex `strokeCap`/`strokeJoin`, outline stroke → vector, boolean groups own paints, masks use paint alpha/luminance (`maskType`), flatten. |
| **M3 Text** | Per-range fills (`getRangeFills`), text strokes, gradients spanning the text box, SVG outline-text export, PDF glyph export, text bounds for `useAbsoluteBounds`. |
| **M4 Layout** | `strokesIncludedInLayout`; effects never affect layout; image Fill/Fit recompute on resize; individual stroke weights on auto-layout frames. |
| **M5 Components** | Overrides for fills/strokes/effects/opacity/blend/export settings; reset; variant swaps preserving paint overrides; image paints in instances. |
| **M6 Design systems** | Paint styles (`fillStyleId`/`strokeStyleId`), effect styles, variable bindings (paint color, stop color, effect color/radius/spread/offsets, stroke weights, opacity), Libraries tab in the picker, eyedropper Shift+click style/variable, selection colors style modal, blend restriction for bound paints. |
| **M7 Prototyping** | Video playback (`UPDATE_MEDIA_RUNTIME`), GIF animation in presentation, animation export (MP4/GIF/WebM), keyframable effect fields (`EffectKeyframeFieldName`). |
| **M8 Interop & hardening** | SVG/PDF/.fig import of paints (REST `gradientHandlePositions`, `STRETCH`, `gifRef`, `verticalAlignment`, LEGACY profile), clipboard to/from other apps (PNG/SVG), performance with many blurs/large images, accessibility of color picker (keyboard operation of color area, contrast). |
| **Visual spec (Framer)** | Look of swatches, checkerboard for transparency, sliders, handles — behavior here, looks there. |

---

## 8. Needs live Figma verification

No experiment below has been run. Each must be executed in current Figma Design (UI3), desktop app and browser where relevant, on macOS and Windows for shortcuts, and recorded in `docs/figma/observations/` as before/action/after with exported files kept as fixtures. Until then, the linked checklist items must not be claimed as parity.

### 8.1 Experiments

| ID | Setup | Action | Record | Items |
| --- | --- | --- | --- | --- |
| V-01 | Rectangle, plugin console or REST access | Add red fill, then `+` and set blue | Row order in panel; `fills` array order from plugin/REST JSON | PE-001 |
| V-02 | Fresh file | Draw rect, ellipse, polygon, star, frame, line, arrow, pen path, text, section; on each: remove fills/strokes, press Fill `+` twice and Stroke `+` | Default paint type/color/opacity per node; default stroke color/weight/position/cap | PE-002, PE-003, PE-125 |
| V-03 | White background; rect with red bottom fill and 50 % blue Multiply top fill; same rect inside a Normal frame and a Pass-through frame over a gradient | Export 1x PNG | Pixel values at fixed points; compare to §3.1.3 formula | PE-009 |
| V-04 | Frame with Inside 10 px stroke, inner shadow and a child crossing the edge; rect with stroke + inner shadow | Export 4x PNG | Whether stroke and inner shadow draw above/below children and above/below each other | PE-149, PE-169 |
| V-05 | Rect with drop shadow, inner shadow, noise, texture, glass, layer blur together | Toggle each effect; reorder rows | Whether stacking depends on row order or fixed type order | §3.1.3, PE-178–PE-181 |
| V-06 | Picker open on a fill | Press Esc; click outside; change selection with picker open; scroll panel | Picker closes/retargets; value reverted or kept; page-swatch list order and size limit | PE-033, PE-034 |
| V-07 | Picker on blue | Drag color area to black, back up | Hue retained or reset to 0 | PE-021 |
| V-08 | Hex field and CSS field | Type `f`, `fc`, `f0c`, `f0c8`, `ff00cc80`, `12345`, `zz`, `#FFF`, `rebeccapurple`, `rgb(255 0 0 / 50%)`, `hsl(120 50% 50%)` | Resulting color/opacity, rejection behavior, history entries | PE-025, PE-027 |
| V-09 | Image and semi-transparent layers on canvas | Eyedropper with selection, without selection, on 50 %-alpha pixel; Shift+click on styled/variable paint; look at loupe; try "create" flows | Applied hex & opacity; clipboard content; loupe content; style/variable creation UI | PE-040, PE-041, PE-044, PE-046 |
| V-10 | Rect with solid red 60 % Multiply | Switch to each gradient type; inspect stop list; drag each handle with/without Shift; look for flip/rotate; switch back to solid | Seed stops and transform (plugin `gradientTransform`, REST handles); stop-list columns; Shift snapping; flip/rotate presence; which stop color survives | PE-011, PE-048, PE-053, PE-058, PE-059, PE-068 |
| V-11 | 20 gradients of each type with random handles | Read plugin `gradientTransform` and REST `gradientHandlePositions`; export 2x PNG | Validate §3.3.3 conversion and evaluation formulas against pixels | PE-047, PE-061, PE-062 |
| V-12 | Linear gradients: red→blue, red 100 %→blue 0 %, white→#00000000, black→white | Export 1x PNG 256 px wide | Midpoint and quarter-point pixel values → interpolation space & premultiplication | PE-051, PE-063 |
| V-13 | 20 px Outside stroke with linear gradient; 2-line text with gradient | Export | Gradient mapping box for strokes and text | PE-065, PE-066 |
| V-14 | Selection with 6 colors (fills, strokes, nested, one hidden paint), 2 styles, 2 variables; separate 1500-color selection | Inspect Selection colors; edit one entry; undo | Ordering, truncation ("three most frequent"), hidden-paint inclusion, scope of edit, undo steps, >1000 behavior; Fill section "mixed" UI | PE-191, PE-193, PE-194, PE-195 |
| V-15 | Image files 800×600 PNG, JPG | Drop on empty canvas, on a shape with fill, use Place image (click, drag, click-on-shape, multiple files), replace image on a Tile+filtered paint, delete asset | Layer name, size, position, replace-vs-add, aspect-lock state, settings kept on replace, missing-image placeholder | PE-071, PE-072, PE-073, PE-087, PE-090, PE-093 |
| V-16 | Files: WebP, HEIC, TIFF, BMP, AVIF, SVG, 8000×3000 PNG, 4097×10 PNG | Import each | Accepted formats; stored pixel size (rounding); any notice | PE-075, PE-076 |
| V-17 | Image layer | Find all ways to enter crop (double-click, Enter, picker, toolbar); exit with Enter/Esc/click; switch Fill→Crop; Tile 50 % with odd layer size | Gestures/keys; framing continuity; tile origin and partial tiles | PE-080, PE-081, PE-082 |
| V-18 | Gray ramp + color chart image | Each adjustment at −100, −50, +50, +100; export 1x; canvas screenshots at 50 %/800 % | Per-channel transfer curves (fit formulas); canvas filtering | PE-085, PE-091 |
| V-19 | MP4 and animated GIF | Import; observe canvas; export PNG; check picker type | Poster frame, GIF animation on canvas, category (image vs video), exported frame | PE-095, PE-098, PE-099 |
| V-20 | Pattern with source star | Delete source; hide source; move source to another page; try selecting the patterned layer itself or its parent as source | Rendering/error states; cycle prevention | PE-106 |
| V-21 | Open pen path, line, text | Open stroke position menu | Which positions are offered/what they render; text stroke default position | PE-128, PE-148 |
| V-22 | Rect r = 20 | Individual sides: choose Top with weight 4; Custom 2/10/2/10 Inside/Center/Outside | Resulting per-side values; inner contour shape | PE-132, PE-134 |
| V-23 | Open path 200 px, weights 1/4/10 | Every end-point option for start and end; swap; select a closed rect | UI labels ↔ enum mapping (incl. REST names); arrow sizes vs weight; swap behavior; caps UI on closed shapes | PE-139, PE-140, PE-141 |
| V-24 | Line 100 px, rect 100×100, ellipse | Dash 10 gap 10 (and 7/3) | Dash phase at start/end; corner distribution on closed shapes | PE-144 |
| V-25 | Rect | Effects `+` repeatedly; change type of a configured shadow; add glass repeatedly; add inner shadow, blurs, noise, texture | Default type & values per effect; parameter carry-over; per-type maxima incl. glass; mixed-effects UI on multi-selection | PE-159, PE-160, PE-161, PE-162, PE-197 |
| V-26 | sRGB and P3 files; P3-tagged PNG; legacy file | Import image; convert/assign profile; export PNG/JPG/PDF with each `colorProfile` | Stored values after Convert; ICC tags in outputs; pixel values | PE-094, PE-201, PE-204 |
| V-27 | Black 100×100 rect, frame without fill with children, transparent PNG | Shadows with blur 0/10/40, spread ±10, overlapping red/blue shadows in both orders, inner shadow spread ±4 | Shadow profiles (fit σ), silhouette source, stacking | PE-163, PE-164, PE-168, PE-170 |
| V-28 | Rect 100 %, rect 50 % fill, stroke-only rect, star, frame with/without fill/clip | Look for "Show behind transparent areas" and spread controls | Availability conditions and disabled states | PE-166, PE-167 |
| V-29 | Rect, group with shadow | Layer blur 0/4/20/100; type 10000 and −5 | σ fit; whether blur includes shadows; UI clamp | PE-172, PE-177 |
| V-30 | Photo layer | Progressive layer blur start 0 → end 40, move handles; try progressive background blur | Handle UI; radius profile along axis (linear?); availability for background blur | PE-173, PE-174, PE-176 |
| V-31 | Frame with children; circle | Noise (3 types), texture clip on/off; K-scale 200 %; child outside clipping mask | Noise statistics; texture extents; scaling behavior; clipped-effects behavior | PE-178, PE-180, PE-186 |
| V-32 | Frame, rect with mixed radii, text | Apply glass; inspect all controls and ranges; try binding a variable | Controls incl. splay, ranges/units, variable support, plugin-read values | PE-181, PE-182, PE-187 |
| V-33 | Rect, frame, section, group | Inspect blend menu and opacity per node; bind fill to variable/style; hover modes; click on 0 % layer | Section blend/opacity/effects availability (API says none); disabled states; hover preview; hit-testing at 0 % | PE-013, PE-038, PE-115, PE-119, PE-122 |
| V-34 | 19-mode swatch grid over gradient backdrop; Multiply child in Pass-through vs Normal frame | Export 1x PNG | Per-mode pixel values; isolation semantics | PE-113, PE-114 |
| V-35 | Layer "Icon", layer "a/b" ×2 | Export `+` ×3; export at 2x without suffix; duplicate names | Default settings added; file names; folders/conflict handling | PE-205, PE-209, PE-226 |
| V-36 | Transparent frame; Plus darker/lighter layers | Export JPG; export PDF at High/Medium/Low | JPG background color; PDF handling of unsupported modes; where quality/resampling are stored (plugin `exportSettings` read-back) | PE-124, PE-212, PE-213 |
| V-37 | Layers: 33.3×10 rect; 10 px Outside stroke; shadow y 20 blur 20; clipped frame with child overflow and frame shadow; text with large line height | Export at 1x/1.5x/512w; toggle Include bounding box; scales 0.001x, 10x, 20000w | Output pixel sizes (rounding), bounds rules, mapping of "Include bounding box" to `useAbsoluteBounds`, limits | PE-130, PE-185, PE-208, PE-216, PE-217, PE-233 |
| V-38 | Page with 5 frames having export settings | Shift+Cmd+E with/without selection; File menu export items | Dialog contents/scope; multi-page PDF availability | PE-228, PE-230 |
| V-39 | Layers with angular/diamond gradients, noise, texture, glass, background & progressive blur | Export SVG | How each is encoded (raster `<image>`, filter, dropped) | PE-221 |
| V-40 | 100×100 rect with gradient, shadow, blur | Copy as PNG; Copy as SVG; Copy as code (CSS) | PNG scale; SVG equality to export defaults; CSS property mapping (blur halving, gradient angle) | PE-237, PE-238, PE-239 |
| V-41 | Styled rect (2 fills, stroke dashed, 2 effects, 50 % Multiply, export settings) | Copy/paste properties onto ellipse; select single fill/effect row and Cmd+C/Cmd+V onto another layer | Exact transferred property set; row-level paste support | PE-240, PE-241 |
| V-42 | Rect | Script of 12 edits (picker drag, hue drag, scrub, typed hex, add/remove/reorder/hide, eyedropper, crop drag, gradient handle drag, model switch); undo with picker open | History entry count; picker state after undo | PE-244, PE-245 |
| V-43 | Component with image fill + export settings; instance | Override fill/effects/export; change main image and scale mode; reset | Override persistence and granularity; export settings inheritance | PE-232, PE-246, PE-248 |
| V-44 | Rect selected (no text focus), macOS and Windows | Press 5; 4 then 5 quickly/slowly; 0 0; Shift+X; outline-stroke shortcut; look up remove-fill/remove-stroke shortcuts in Figma's shortcut panel | Opacity results and timing threshold; swap behavior incl. weights; shortcuts per OS | PE-117, PE-152, PE-153, §5 |
| V-45 | Rect with 3 fills | Remove middle; drag reorder; inline hex/opacity typing; open/close picker 10× on r = 0.123456; continuous drag then undo | Order, history entries, value stability | PE-004, PE-006, PE-031, PE-032, PE-035 |
| V-46 | 3-stop linear gradient | Type switch round-trip; click canvas line at 25 %; Delete stop; type position 33; coincident stops; short axis | Stop data, hard edge, pad behavior beyond ends | PE-049, PE-052, PE-055, PE-056, PE-057, PE-064 |
| V-47 | 400×400 photo in 100×100 rect; 16×16 pixel art; OS screenshot on clipboard | Paste; export 4x with Detailed and Basic | Pasted layer size; export detail; resampling differences | PE-074, PE-092, PE-214 |
| V-48 | Frame 50 % with overlapping children; group with shadow; child shadow crossing clipped frame edge | Export | Group-opacity, combined container shadow, child effect clipping | PE-118, PE-184, PE-189 |
| V-49 | Two rects with different opacity/stroke weights/effects | Type values; scrub Mixed field | Mixed display and resulting values | PE-121, PE-196 |
| V-50 | P3 file on P3 display | Type #FF0000; compare to sRGB file; read plugin color values | Display rendering and stored values | PE-202, PE-203 |
| V-51 | Frame with hidden child, hidden paint, hidden effect, visible layout grid, guides | Export PNG/SVG/PDF; copy image layer into another file | Exclusion of hidden content and overlays; asset carried across files | PE-223, PE-235, PE-243 |
| V-52 | Instance with overridden paints; styled paint; eyedropper on styled paint; picker model persistence across restarts; HSB area extremes | Reset overrides; plain-click sample; restart app | Reset result; raw vs style application; model persistence; area mapping | PE-020, PE-024, PE-043, PE-045, PE-247 |

### 8.2 Items resting only on [KNOW] or third-party sources (must not ship as "parity" before the listed experiment)

PE-003 (V-02), PE-004 (V-45), PE-006 (V-45), PE-009 (V-03), PE-011 (V-10), PE-020 (V-52), PE-021 (V-07), PE-024 (V-52), PE-031 (V-45), PE-032 (V-45), PE-035 (V-45), PE-041 (V-09), PE-043 (V-52), PE-044 (V-09), PE-045 (V-52), PE-048 (V-10), PE-049 (V-46), PE-051 (V-12), PE-052 (V-46), PE-055 (V-46), PE-056 (V-46), PE-057 (V-46), PE-058 (V-10), PE-063 (V-12), PE-064 (V-46), PE-065 (V-13), PE-066 (V-13), PE-068 (V-10), PE-071 (V-15), PE-072 (V-15), PE-073 (V-15), PE-074 (V-47), PE-081 (V-17), PE-087 (V-15), PE-090 (V-15), PE-091 (V-18), PE-092 (V-47), PE-093 (V-15), PE-094 (V-26), PE-098 (V-19), PE-099 (V-19), PE-106 (V-20), PE-114 (V-34), PE-115 (V-33), PE-117 (V-44), PE-118 (V-48), PE-119 (V-33), PE-121 (V-49), PE-128 (V-21), PE-130 (V-37), PE-132 (V-22), PE-134 (V-22), PE-141 (V-23), PE-148 (V-21), PE-149 (V-04), PE-152 (V-44), PE-159 (V-25), PE-160 (V-25), PE-161 (V-25), PE-162 (V-25), PE-163 (V-27), PE-164 (V-27), PE-169 (V-04), PE-170 (V-27), PE-174 (V-30), PE-182 (V-32), PE-184 (V-48), PE-185 (V-37), PE-186 (V-31), PE-189 (V-48), PE-191 (V-14), PE-196 (V-49), PE-197 (V-25), PE-202 (V-50), PE-203 (V-50), PE-208 (V-37), PE-212 (V-36), PE-214 (V-47), PE-217 (V-37), PE-221 (V-39), PE-223 (V-51), PE-226 (V-35), PE-228 (V-38), PE-230 (V-38), PE-232 (V-43), PE-235 (V-51), PE-237 (V-40), PE-238 (V-40), PE-239 (V-40), PE-240 (V-41), PE-241 (V-41), PE-243 (V-51), PE-244 (V-42), PE-245 (V-42), PE-246 (V-43), PE-247 (V-52), PE-248 (V-43).

Additionally, these items have official/API support for the *existence* of the feature but [KNOW]-level details that affect correctness: PE-002/PE-125 default colors (V-02), PE-025 1/2/4/5/7-digit hex handling (V-08), PE-040 sampled alpha (V-09), PE-053/PE-059 handle and stop-list UI (V-10), PE-061/PE-062 transform conventions (V-11), PE-076 rounding (V-16), PE-080 crop gestures (V-17), PE-082 tile origin (V-17), PE-139/PE-140 cap labels and sizes (V-23), PE-144 dash phase (V-24), PE-166/PE-167 availability conditions (V-28), PE-172/PE-177 σ mapping and clamps (V-29), PE-173/PE-176 progressive UI (V-30), PE-178/PE-180 noise/texture appearance (V-31), PE-181/PE-187 glass ranges and binding conflict (V-32), PE-013/PE-122 Section blend conflict (V-33), PE-205/PE-209 export naming (V-35), PE-213 storage of quality/resampling (V-36), PE-216 bounding-box mapping (V-37).

### 8.3 Known source conflicts to resolve

1. Glass variables: typings say no binding [API]; press says variables supported [SRC createwith] → V-32.
2. Glass depth: API `depth ≥ 1` vs third-party UI range 0–100 [SRC pub.dev] → V-32.
3. Section blend modes: Help Center mentions sections with blend modes [DOC:360040667874 excerpt]; `SectionNode` has no blend/opacity/effects mixins [API] → V-33.
4. Animated GIFs: filed under video in one Help Center excerpt, under image in another [DOC:360041003694 excerpt] → V-19.
5. Effects article: official crawl lists four effect types; a newer mirror lists six with per-type limits [SRC helpjuice mirror] → V-25.
6. Shortcuts: one third-party page lists Option+Cmd+C as "copy as PNG"; Figma community support gives Shift+Cmd+C [SRC] → V-44.
7. Copy as PNG scale (2x per a blog) → V-40.

---

## 9. Sources

### 9.1 Typings (authoritative data model)

Figma Plugin API typings v1.141.0 — `refs/_figma_plugin-typings/package/plugin-api.d.ts`:

| Symbol | Line |
| --- | --- |
| `figma.mixed` | 891 |
| `getSelectionColors()` (null if > 1000 colors) | 1535–1552 |
| `createNodeFromSvg` | 1734 |
| `createImage` (PNG/JPEG/GIF, max 4096 px) | 1736–1742 |
| `createImageAsync`, `getImageByHash` | 1778, 1782 |
| `createVideoAsync` (MP4/MOV/WebM, max 100 MB) | 1786–1792 |
| `loadBrushesAsync` | 2137 |
| `setBoundVariableForPaint`, `setBoundVariableForEffect` | 2263, 2275 |
| `UtilAPI.rgb/rgba/solidPaint` | 2900–2986 |
| `RGB`, `RGBA` | 3942, 3950 |
| `DropShadowEffect` | 4293 |
| `InnerShadowEffect` | 4336 |
| `BlurEffectBase` / `Normal` / `Progressive` | 4375 / 4398 / 4407 |
| `NoiseEffectBase` / `Monotone` / `Duotone` / `Multitone` | 4432 / 4471 / 4481 / 4495 |
| `TextureEffect` | 4513 |
| `GlassEffect` | 4549 |
| `ShaderEffect` | 4592 |
| `Effect` union | 4621 |
| `ColorStop` | 4643 |
| `ImageFilters` | 4662 |
| `SolidPaint` | 4674 |
| `GradientPaint` | 4729 |
| `ImagePaint` | 4749 |
| `VideoPaint` | 4785 |
| `PatternPaint` | 4821 |
| `ShaderPaint` | 4855 |
| `Paint` union | 4883 |
| `ShaderPropertyValue`, `ShaderPropertyDefinition`, `Shader` | 4889, 4933, 4969 |
| `ExportSettingsConstraints`, `ExportSettingsImage` | 5065, 5072 |
| `ExportSettingsSVGBase` / `SVG` / `SVG_STRING` / `PDF` / `REST` | 5120 / 5145 / 5155 / 5164 / 5178 |
| `ExportSettingsMP4` / `GIF` / `WEBM` (scale presets) | 5219 / 5253 / 5287 |
| `ExportSettings` union | 5321 |
| `BlendMode` | 5478 |
| `UPDATE_MEDIA_RUNTIME` actions | 5708–5722 |
| `EffectKeyframeFieldName` (incl. SPLAY) | 6118 |
| `ConnectorStrokeCap` | 6290 |
| `VariableBindableNodeField` / paint / color stop / effect fields | 6910 / 6947 / 6949 / 6950 |
| `BlendMixin` (`isMask`, `maskType`, `effects`, `effectStyleId`) | 7539–7600 |
| `DeprecatedBackgroundMixin` | 7612 |
| `StrokeCap`, `StrokeJoin` | 7622, 7631 |
| `strokesIncludedInLayout` | 7811 |
| `MinimalStrokesMixin` (strokeAlign remark: doubled weight + mask) | 8648–8712 |
| `IndividualStrokesMixin` | 8717 |
| `MinimalFillsMixin` | 8730 |
| `VariableWidthPoint`, preset/custom width properties | 8767, 8776, 8783 |
| `ComplexStrokeProperties`, scatter/stretch brush, dynamic | 8797, 8806, 8839, 8873 |
| `GeometryMixin` (`strokeCap`, `strokeMiterLimit`, `outlineStroke`) | 8886–8911 |
| `ComplexStrokesMixin` | 8913 |
| `ExportMixin` / `exportAsync` | 8982 / 9069 |
| `DefaultShapeMixin`, `BaseFrameMixin` | 9360, 9372 |
| `MinimalBlendMixin` (`opacity`, `blendMode`) | 9436 |
| `getRangeFills` / `setRangeFills` | 9898 / 9904 |
| `DocumentNode.documentColorProfile` | 10416 |
| `PageNode.backgrounds` / `prototypeBackgrounds` | 10645 |
| `GroupNode`, `SliceNode`, `RectangleNode`, `LineNode` | 10768, 10817, 10827, 10846 |
| `BooleanOperationNode` | 11284 |
| `SectionNode` (fills + strokes, no blend) | 12256 |
| `PaintStyle`, `EffectStyle` | 12513, 12602 |
| `Image`, `Video` | 12684, 12701 |

Figma REST API types v0.44.0 — `refs/_figma_rest-api-spec/package/dist/api_types.ts`: `HasBlendModeAndOpacityTrait` 485; `HasExportSettingsTrait` 497; `HasGeometryTrait` (`strokeCap` REST names, `strokeMiterAngle` default 28.96°) 504–549; `MinimalFillsTrait` 551; `MinimalStrokesTrait` (`strokeDashes`) 564; `IndividualStrokesTrait` 600; `HasEffectsTrait` 634; `RGBA` 1296; `Constraint` 1364; `ExportSetting` 1383; `BlendMode` (with group comments) 1431; `ColorStop` 1470; `Transform` 1520; `ImageFilters` 1525; `BasePaint` 1541; `SolidPaint` 1559; `GradientPaint` (`gradientHandlePositions`) 1577; `ImagePaint` (`STRETCH`, `gifRef`) 1600–1644; `PatternPaint` (`verticalAlignment`) 1646; `BaseShadowEffect` 1810; `DropShadowEffect` 1864; `InnerShadowEffect` 1877; `BlurEffect` 1885; `TextureEffect` 1947; `NoiseEffect` 2042; `Effect` 2044; `StrokeWeights` 2113; `PaintOverride` 2138; `GetImagesQueryParams` (scale 0.01–4, SVG flags, `contents_only`, `use_absolute_bounds`) 7132–7187.

### 9.2 Official Figma Help Center articles (IDs from the 2026-09-27 catalog; only search excerpts were seen — bodies not read)

| ID | Title (catalog / current) | Used for |
| --- | --- | --- |
| 360041003694 | Guide to fills | five fill types, default solid, closed-region fills, video formats |
| 360041003774 | Update fills using the color picker / "Apply paints with the color picker" | opening picker, shared vs mixed colors, eyedropper scope |
| 360043042113 | About color models / "Color models in Figma Design" | five models, Hex default, #RRGGBBAA, RGB ints, CSS, scrubbing |
| 27643269375767 | Sample colors with the eyedropper tool | I / Control+C, sample/apply/create variables & styles |
| 34208860210199 | Use gradients as a fill or stroke | four types, ≥ 2 stops, stop selection, UI3 note |
| 31616030150167 | Use patterns as a fill or stroke | source selection, options, live update, strokes |
| 360042553434 | View and adjust colors in a mixed selection | Selection colors rules |
| 360041098433 | Adjust the properties of an image | Fill/Fit/Crop/Tile, rotation, adjustments, GIF limitation |
| 360040667874 | Apply blend modes… / "Use blend modes to create unique effects" | 19 modes & groups, defaults, restrictions, frames/sections |
| 360049283914 | Apply and adjust stroke properties | position defaults, shared settings, dashes, caps, SVG note, hover preview |
| 360041488473 | Apply effects to layers | effect types (official crawl: four; mirror: six + limits) |
| 360039825114 | Color management (profiles) | sRGB/P3, defaults, Assign/Convert, Unmanaged removal, export default |
| 13402894554519 | Export formats and settings for static designs | PNG/PDF specifics, scale syntax, settings TOC |
| 360040028114 | Export static designs from Figma | exportable objects, multiple settings, preview limitation, save location |
| 30965205437975 | What's new from Config 2025 | brushes, dynamic strokes, noise & texture |
| 41175721167767 | (shader article; locale variants seen) | shader fills, open beta — attribution uncertain |
| 33052305733015 | Convert strokes to vector paths | title only |
| 360041064814 | Change the background color of the canvas | title only |
| 8878274530455 | Use videos in prototypes | title only |
| 4412765442967 | Copy and paste properties (linked from old feature guide) | title/link only |

Other catalog articles relevant but not consulted in this session: 360040675194 (Crop an image), 360040028034 (Add images and videos), 360041486873 (animated GIFs in prototypes), 360038746534 (styles), 360040027794 (imports), 360040030374 (copy assets between design tools), 41307983648407 (export animations), 31440438150935 / 31440427042839 (Figma Draw).

### 9.3 Other sources (search excerpts only)

- Help-article mirrors: figma-signup.helpjuice.com/apply-effects-to-layers; …/export-formats-and-settings; …/view-and-adjust-colors-in-a-mixed-selection (DNS-blocked for direct fetch).
- Figma developer docs (search excerpts): developers.figma.com/docs/plugins/api/BlendMode; developers.figma.com/docs/plugins/updates/2025/05/07/version-1-update-110/; developers.figma.com/docs/plugins/adding-pattern-fills-and-strokes.
- Forum threads (forum.figma.com): set-starting-defaults-for-design-fill-stroke-effects/617; color-picker-color-model-resets-to-css-58618; color-picker-should-apply-color-style/1540; color-picker-eyedropper-should-apply-color-style-34313; problem-with-managing-image-colour-profiles-34569; dashed-stroke-incompatible-with-stroke-inside-outside-56095; none-scalable-effects-new-effects-43032; noise-effect-is-applied-to-every-element-within-a-frame-41874; progressive-blur-gradient-controls-48326; feature-suggestion-radial-custom-blur-maps-47404; glass-effect-api-missing-light-reflection-border-when-applied-via-plugin-42969; ignore-overlapping-layers-export-option-is-not-respected-in-slice-export/63390; figma-exports-framed-icon-with-incorrect-sizes-30924; how-to-bring-back-copy-as-png-in-figma-26969; feature-request-add-copy-svg-code-option-in-export-57587; paste-svg-code-no-longer-available-29257; is-there-a-way-to-export-the-new-texture-feature-of-figma-as-vector-41146 (title only); can-t-export/87464; underline-colour-variable-in-selection-colors-shows-an-incomplete-variable-list-on-swap-56344; copy-and-reuse-image-adjustment-settings-across-multiple-image-layers-41977.
- Press / third party: createwith.com (glass out of beta; glass updates with corners & variables); designcompass.org 2025-07-18 (glass launch); alternativeto.net 2025-07 (glass); pub.dev/packages/figma_glass (ranges); uxcel.com lessons (strokes, shadows & blurs, layer blur); grida.co (blur semantics); figmalion.com/topics/import-export (quality/resampling); imagecompressor.tools (4096 downsizing, 72 DPI × scale); blog.logrocket.com/ux-design/figma-blend-modes; webdesign.tutsplus.com (SVG export of gradients); yummygum.com (copy as PNG @2x); convert.remotion.dev/docs/figma (Copy/Paste as → Copy as SVG); dev.to/dishank (Shift+Cmd+E); meshworld.in (Slice = S); bjango.com (color management); figma.com/blog/photo-filters-come-to-figma (adjustments list, title/excerpt).

### 9.4 Research limits of this draft

- help.figma.com, figma.com, developers.figma.com and the helpjuice mirror were not fetchable (DNS); all [DOC] tags are search excerpts.
- The shared web-search budget for this run was exhausted part-way through research; topics not searched at all: variable-width/brush UI details, stroke end-point labels, image import formats and placement, crop gestures, copy-as-code, copy/paste properties, export dialog contents, remove-fill/stroke shortcuts. These rest on [KNOW] and are covered by §8.
- No live Figma session was used for this document; the only live evidence is the 2026-09-27 read-only observation [OBS].
