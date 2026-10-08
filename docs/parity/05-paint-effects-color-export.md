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
inner(e): a = 1 - silhouette; a = dilate(a, e.spread) // positive spread contracts the lit area [API]
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
