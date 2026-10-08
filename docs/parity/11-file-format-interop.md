# Local file format, persistence & interoperability — Figma parity spec

> **Status:** research draft (date 2026-10-08). **Nothing implemented. Every item below is "Not started".** No statement in this document claims parity; parity may only be claimed for an item after it is implemented *and* validated against live Figma using the item's test.
>
> **Evidence legend** (every behavioral claim is tagged):
> - **[API]** Figma Plugin API typings v1.141.0 (`plugin-api.d.ts`) or Figma REST API types/OpenAPI v0.44.0 (`api_types.ts`, `openapi.yaml`). Line references are given in §9.
> - **[DOC:<id>]** Official Figma Help Center article. **"excerpt"** means only a search-engine excerpt of the article was seen in this session, not the full body. "title" means only the catalog title/ID is known.
> - **[OBS]** Read-only live-Figma UI observation of 2026-09-27 (`old/docs/figma/observations/2026-09-27-live-figma.md`).
> - **[KNOW]** Author's prior knowledge, *not* verified in this session. Every correctness-relevant [KNOW] claim is repeated in §8.
> - **[SRC:<url>]** Other web source (forum, third-party docs, open-source repo). "excerpt" = search excerpt only.
> - **[ILL]** Illigma requirement or design decision for the local-first context. **Not** a claim about Figma behavior; it exists because Figma has no local equivalent (Figma is cloud-first) or because parity requires an Illigma-specific mechanism.
>
> **Research limits of this session:** help.figma.com and figma.com could not be fetched; official articles were seen only as search excerpts. The shared web-search budget ran out mid-research, so some topics (Figma Terms of Service wording, REST token expiry/rate limits, exact SVG-import mapping, paste placement rules) rest on [KNOW] and are listed in §8. Source files that *were* read in full: the typings, the OpenAPI spec, the `fig-kiwi` npm README, the `sketch-hq/fig2sketch` README + LICENSE, the `evanw/kiwi` README + LICENSE, and DTCG spec chapters from `design-tokens/community-group` (GitHub raw).

---

## 1. Scope & terminology

### 1.1 What this area covers

This area defines how Illigma **stores, saves, recovers, versions, imports, exports, and exchanges** documents. It is the contract for:

1. **The native local file format** (working name `.illigma`): a lossless container for the entire Figma-equivalent data model in the typings — document, pages, every node type and property, styles, variables/collections/modes (including extended collections), components/component sets/instances/slots and their overrides, prototyping data, Motion animation data, annotations/measurements/dev resources, plugin data, images/videos/fonts/shaders as assets, references to other files (libraries), and version history.
2. **Persistence semantics:** autosave, explicit save, crash recovery, file locking/external modification, version history (checkpoints and named versions), schema versioning and migration, large-file behavior.
3. **Interoperability:** raster/video/SVG import, PNG/JPG/SVG/PDF (and animated MP4/GIF/WebM) export encoders, system clipboard flavors, clipboard exchange with Figma, `.fig` import, optional Figma REST API import, W3C DTCG design-token export/import, color management (document profiles, export profiles, image profiles), font references/embedding/licensing.
4. **The gap list** between Figma's cloud features (multiplayer, team libraries, comments, branching, sharing/permissions, cloud fonts, version history storage) and their local-first equivalents.

Owned elsewhere (referenced, not re-specified): the per-node **Export section UI** and export-setting editing (→ `05-paint-effects-color-export`, prefix PE); **paste placement / paste-over-selection / paste-to-replace / copy-paste properties** gestures (→ `01-canvas-selection-transform`, CV); font picker and text layout (→ `06-text-typography`, TX); library publish/accept-updates UI and variables UI (→ `08-variables-styles-design-systems`, DS); prototype presentation (→ `09-prototyping`, PR); File menu/workflow shell (→ `10-panels-shortcuts-workflow`, UX). This document owns the **data and codec behavior** underneath those UIs.

### 1.2 In scope vs. out of scope for a local-first app

| Figma capability | Illigma stance |
| --- | --- |
| Continuous autosave to cloud, offline cache + sync on reconnect [DOC:360040328553 excerpt] | **In scope, re-mapped:** continuous journaled autosave to the local file; no sync step. [ILL] |
| Version history (30-min checkpoints, named versions, restore) [DOC:360038006754 excerpt] | **In scope:** stored locally inside the file (or sidecar), retention user-configurable. [ILL] |
| Save local copy as `.fig` [DOC:8403626871063 excerpt] | **Re-mapped:** "Save a copy…" of `.illigma`. Writing `.fig` is **out of scope** (proprietary, legal risk; §3.11). [ILL] |
| Import `.fig` / `.sketch` into file browser [DOC:360040027794 excerpt] | `.fig` import: **feasibility-gated, P2, behind a flag, pending legal review** (§3.11). `.sketch` import: P2. [ILL] |
| PNG/JPG/SVG/PDF export, Copy as PNG/SVG [DOC:13402894554519 excerpt][API] | **In scope (M2), parity target.** |
| MP4/GIF/WebM animation export [API] | **In scope, P2 (M7/M8).** |
| SVG paste/import [DOC:360040030374 excerpt][API] | **In scope (M8), parity target.** |
| Clipboard exchange with Figma (proprietary HTML/kiwi payload) [SRC:simonwillison.net/2024/Sep/19/the-webs-clipboard excerpt] | **Paste-from-Figma: P2, feasibility-gated.** **Copy-to-Figma in Figma's private format: out of scope by default**; interop via SVG/PNG flavors instead. [ILL] |
| REST API import with user token [API] | **Optional, P2.** Token supplied by user, stored in OS keychain, never in documents. [ILL] |
| Native DTCG variable export/import (rolled out late 2025) [SRC:forum.figma.com native-variable-export-feature-47831 excerpt] | **In scope (M6), P1.** |
| Multiplayer, cursors, observation, audio, cursor chat, spotlight | **Out of scope** (gap list §3.15). |
| Team/org libraries, publishing to cloud, library analytics | **Re-mapped** to local library files (§3.9); analytics out of scope. |
| Comments | **P2 local equivalent** (§3.15). |
| Branching & merging | **P2 local equivalent or Git-friendly text export** (§3.15). |
| Sharing, permissions, link access, "restrict copying/exporting" | **Out of scope**; OS file permissions apply. |
| Cloud font service / shared org fonts [DOC:360039956994 excerpt] | **Re-mapped** to OS-installed fonts + optional embedded fonts (§3.14). |
| Figma Make/Sites/Buzz/Slides/FigJam file kinds and node types | **Out of scope** for editing; preserved opaquely when encountered in `.fig`/REST import (§3.11). |

### 1.3 Terms (Figma vocabulary and terms users confuse)

| Term | Meaning (Figma) | Commonly confused with |
| --- | --- | --- |
| **File / document** | One design file; root `DOCUMENT` node whose children are pages [API]. | A page; an exported asset. |
| **Page** (`PAGE` plugin / `CANVAS` REST) | Independent canvas inside a file [API]. | Frame; PDF page. |
| **Node ID** | Per-file identifier like `1:3` (URLs use `1-3`) [API]. | Component **key** (cross-file, publish-time identifier) [API]. |
| **Key** (`key`) | Publish identifier on components, component sets, styles, variables, collections used to import from libraries [API]. | Node ID; image hash. |
| **Image hash / imageRef** | Content hash identifying an image asset (`imageHash` plugin, `imageRef` REST) [API]. | File name of the image. |
| **Autosave / checkpoint** | Automatic version-history entry, every 30 min [DOC:360038006754 excerpt]. | Saving the file (which is continuous). |
| **Named version** | Version-history entry with title (required) and optional description [API]. | Branch; local copy. |
| **Save local copy** | Downloads a `.fig` (no version history, no comments) [DOC:8403626871063 excerpt]. | Export; Illigma's native save. |
| **Export** | Rendering selected layers to PNG/JPG/SVG/PDF; not restorable as an editable document [DOC:13402894554519 excerpt]. | Save local copy. |
| **Import** | Bringing a `.fig`/`.sketch` file in as a new file, or images/SVG into a file [DOC:360040027794 excerpt]. | Place image; paste. |
| **Place image** | Inserting raster/video media into the current file [KNOW]. | Import file. |
| **Copy as SVG / PNG** | Puts rendered/converted data on the clipboard [DOC:360040030374 excerpt]. | Export (writes files). |
| **Document color profile** | `documentColorProfile`: `LEGACY` / `SRGB` / `DISPLAY_P3` [API]. | Export color profile (`DOCUMENT` / `SRGB` / `DISPLAY_P3_V4`) [API]. |
| **Assign vs Convert** | Changing a file profile while keeping numbers (Assign) or appearance (Convert) [DOC:360039825114 excerpt]. | Each other. |
| **Library** | A file whose published components/styles/variables other files consume [DOC:360041051154 title]. | Assets panel; local components. |
| **Remote** (`remote: true`) | Asset that came from another file (a library) [API]. | Missing / detached. |
| **Design tokens (DTCG)** | W3C Design Tokens Community Group JSON format (`$type`, `$value`, aliases) [SRC:github.com/design-tokens/community-group]. | Figma variables (the in-file model). |
| **.fig / fig-kiwi** | Figma's proprietary binary file; Kiwi-encoded, self-describing schema [SRC:grida.co/docs/wg/feat-fig excerpt][SRC:registry.npmjs.org/fig-kiwi]. | Figma REST JSON. |

---

## 2. Data model

This section lists **everything the native format must persist** (document data), what must **not** be persisted as shared document data (transient/per-user UI state), identity/reference rules, and interop data types. Property names are Figma's; Illigma's in-memory names may differ, but the file must be able to represent every listed field and enum value losslessly.

### 2.1 File-level entities

| Entity | Figma source | Persist? | Notes |
| --- | --- | --- | --- |
| Document root | `DocumentNode` (`type:'DOCUMENT'`, `children: PageNode[]`) [API] | Yes | `name` = file name [API]. |
| Document color profile | `documentColorProfile: 'LEGACY' \| 'SRGB' \| 'DISPLAY_P3'` [API] | Yes | `LEGACY` = created before color management [API]; renders as preferred profile or sRGB [DOC:360039825114 excerpt]. |
| Schema version | REST `GetFileResponse.schemaVersion: number` [API] | Yes | Illigma keeps its own `formatVersion` + `minReaderVersion` [ILL]. |
| File version counter | REST `version: string` — "incremented when a file is modified" [API] | Yes | Illigma: monotonically increasing `revision` per committed change batch [ILL]. |
| Editor type | REST `editorType: 'figma' \| 'figjam'` [API] | Yes (import provenance) | Illigma edits `figma`-type content only [ILL]. |
| File thumbnail node | `getFileThumbnailNodeAsync()` → Frame/Component/ComponentSet/Section or `null` = default [API]; [DOC:360038511413 title] | Yes | Plus a rendered thumbnail PNG in the container [ILL]. |
| Pages (ordered) | `DocumentNode.children` [API] | Yes | Order is user-visible. |
| Local styles | `StyleType = 'PAINT'\|'TEXT'\|'EFFECT'\|'GRID'\|'CUSTOM_ANIMATION'` [API] | Yes | Including folder ordering (`moveLocal*FolderAfter`) [API]. |
| Variable collections | `VariableCollection` (`modes[{modeId,name}]`, `defaultModeId`, `variableIds`, `hiddenFromPublishing`, `isExtension`) [API] | Yes | `ExtendedVariableCollection` adds `parentVariableCollectionId` and per-mode overrides [API]. |
| Variables | `Variable` (`name`, `description`, `resolvedType: 'BOOLEAN'\|'COLOR'\|'EASING'\|'FLOAT'\|'STRING'\|'TIMING'`, `valuesByMode`, `scopes`, `codeSyntax{WEB,ANDROID,iOS}`, `hiddenFromPublishing`) [API] | Yes | Values may be `VariableAlias {type:'VARIABLE_ALIAS', id}` or `VariableComposedColor` [API]. |
| Component metadata | REST `components{}` / `componentSets{}` maps (`key`, `name`, `description`, `componentSetId`, `documentationLinks`, `remote`) [API] | Yes | Plugin: `PublishableMixin` (`description`, `descriptionMarkdown`, `documentationLinks`, `remote`, `key`) [API]. |
| Remote (library) asset copies | `remote: true` components/styles/variables; components "could be remote components or soft-deleted components" [API] | Yes | Consuming file must render without the library present [ILL][KNOW]. |
| Images | `Image { hash }` handles; bytes loaded separately [API] | Yes (embedded) | Content-addressed; deduplicated by hash [API][ILL]. |
| Videos | `Video { hash }` [API] | Yes (embedded) | ≤100 MB per video (plugin limit) [API]. |
| Shaders | `Shader` objects, `listAvailableShaders`/`importShaderById` ("materialized into the file") [API] | Yes | Only shaders materialized into the file are document data [API]. |
| Fonts | Referenced by `FontName {family, style, variationSettings?}` [API] | References always; binaries optional | Figma does not embed fonts in files [KNOW]; Illigma optional embedding (§3.14) [ILL]. |
| Annotation categories | `AnnotationCategory` [API] | Yes | Dev-mode data must survive round-trip [ILL]. |
| Plugin data | `setPluginData(key,value)` private; `setSharedPluginData(namespace,key,value)` public; each entry ≤ 100 kB; namespace ≥ 3 alphanumeric chars [API] | Yes | On document, pages, nodes, styles, variables, collections [API]. |
| Relaunch data | `setRelaunchData` on nodes, pages and document [API] | Yes (opaque) | Plugin runtime itself out of scope [ILL]. |
| Version history | REST `Version {id, created_at, label, description, user, thumbnail_url}` [API] | Yes (local) | `.fig` local copies drop it [DOC:8403626871063 excerpt]; Illigma keeps it by default [ILL]. |
| Branch metadata | REST `branches[{key,name,thumbnail_url,last_modified}]`, `mainFileKey` [API] | Optional (P2) | §3.15. |
| Comments | REST `Comment` (cloud) [API] | Optional (P2) | `.fig` local copies drop them [DOC:8403626871063 excerpt]. |

### 2.2 Page-level persisted fields

`name`; `isPageDivider` (derived: no children and name made of all `*`, all en dashes, all em dashes, or all spaces) [API]; `backgrounds: Paint[]`; `prototypeBackgrounds: Paint[]`; `flowStartingPoints[{nodeId,name}]` (ordered as in prototype settings) [API]; deprecated `prototypeStartNode`/REST `prototypeStartNodeID` (read-only, import only) [API]; REST `prototypeDevice` [API]; `guides: Guide[]` [API]; REST page-level `exportSettings` (`CanvasNode` has `HasExportSettingsTrait`) and `measurements` [API]; explicit variable modes (`ExplicitVariableModesMixin`) where applicable [API]; plugin/shared-plugin/relaunch data [API].

### 2.3 Node-level persisted fields (by mixin)

Every `SceneNode` type in the typings must be representable: `SLICE, FRAME, GROUP, COMPONENT_SET, COMPONENT, INSTANCE, BOOLEAN_OPERATION, VECTOR, STAR, LINE, ELLIPSE, POLYGON, RECTANGLE, TEXT, TEXT_PATH, TRANSFORM_GROUP, STICKY, CONNECTOR, SHAPE_WITH_TEXT, CODE_BLOCK, STAMP, WIDGET, EMBED, LINK_UNFURL, MEDIA, SECTION, HIGHLIGHT, WASHI_TAPE, TABLE (+TABLE_CELL), SLIDE, SLIDE_ROW, SLIDE_GRID, SLOT, INTERACTIVE_SLIDE_ELEMENT` [API]. Figma-Design-editable types are the target of editing parity; FigJam/Slides/Widget types (`STICKY, CONNECTOR, SHAPE_WITH_TEXT, CODE_BLOCK, STAMP, WIDGET, EMBED, LINK_UNFURL, MEDIA, HIGHLIGHT, WASHI_TAPE, TABLE, TABLE_CELL, SLIDE, SLIDE_ROW, SLIDE_GRID, INTERACTIVE_SLIDE_ELEMENT`) must be **preserved opaquely** (stored, rendered from cached geometry where possible, not editable) when they arrive via import [ILL].

| Group (typings mixin) | Fields the format must hold (non-exhaustive names → the full mixin is the contract) |
| --- | --- |
| Base (`BaseNodeMixin`, `PluginDataMixin`, `DevResourcesMixin`) | `id`, `name`, (text `autoRename`), plugin data, shared plugin data, relaunch data, dev resources [API]. |
| Scene (`SceneNodeMixin`) | `visible`, `locked`, `componentPropertyReferences`, `boundVariables` (fills, strokes, effects, layoutGrids, componentProperties, textRangeFills, size, padding, radii, min/max, opacity, typography fields…), `explicitVariableModes`, `stuckTo` [API]. |
| Motion (`MotionNodeMixin`) | `animationStyles` (`FIGMA` / `CUSTOM`), `manualKeyframeTracks`, `animations`, `timelines` (durations) [API]. |
| Layout/transform (`LayoutMixin`, `DimensionAndPositionMixin`, `ConstraintMixin`, `AspectRatioLockMixin`) | `relativeTransform` (2×3 affine), `width`, `height`, `constraints {horizontal, vertical: 'MIN'\|'CENTER'\|'MAX'\|'STRETCH'\|'SCALE'}`, min/max sizes, `targetAspectRatio`/lock [API]. |
| Auto layout & grid (`AutoLayoutMixin`, `GridLayoutMixin`, `AutoLayoutChildrenMixin`, `GridChildrenMixin`) | All layout and child-layout fields (see AL spec). Plus the **layout engine version** shown as "Layout = Updated" [OBS] — must be persisted per node so older files keep rendering identically [ILL]. |
| Blend (`BlendMixin`, `MinimalBlendMixin`) | `opacity`, `blendMode` (19 values: `PASS_THROUGH, NORMAL, DARKEN, MULTIPLY, LINEAR_BURN, COLOR_BURN, LIGHTEN, SCREEN, LINEAR_DODGE, COLOR_DODGE, OVERLAY, SOFT_LIGHT, HARD_LIGHT, DIFFERENCE, EXCLUSION, HUE, SATURATION, COLOR, LUMINOSITY`), `isMask`, `maskType: 'ALPHA'\|'VECTOR'\|'LUMINANCE'`, `effects`, `effectStyleId` [API]. |
| Geometry (`GeometryMixin`, `MinimalFillsMixin`, `MinimalStrokesMixin`, `IndividualStrokesMixin`, `ComplexStrokesMixin`) | `fills`, `strokes` (Paint arrays: `SOLID`, `GRADIENT_LINEAR/RADIAL/ANGULAR/DIAMOND`, `IMAGE`, `VIDEO`, `PATTERN`, `SHADER`), `fillStyleId`, `strokeStyleId`, stroke weight/align/cap/join/miter/dash, per-side weights, complex/variable strokes [API]. |
| Corners (`CornerMixin`, `RectangleCornerMixin`) | `cornerRadius`, per-corner radii, `cornerSmoothing` [API]. |
| Vector (`VectorLikeMixin`) | `vectorNetwork` (vertices/segments/regions incl. per-vertex cap/radius, per-region fills & winding), `vectorPaths` (`windingRule: 'NONZERO'\|'EVENODD'`), `handleMirroring` [API]. |
| Text (`NonResizableTextMixin`, `TextNode`, `TextPathNode`) | `characters` + all styled range data (font, size, line height, letter spacing, decoration, case, lists, hyperlinks, OpenType features, variation settings, fills per range, text style ids per range), auto-resize/truncation/max lines, alignment, paragraph spacing/indent, leading trim [API]. |
| Frame / prototyping (`BaseFrameMixin`, `FramePrototypingMixin`, `ReactionMixin`) | `clipsContent`, `layoutGrids`, `gridStyleId`, `overflowDirection`, `numberOfFixedChildren` (fixed children are a *count* of top-most children, not a per-layer flag), overlay settings, `reactions` (triggers, actions incl. `SET_VARIABLE`, `SET_VARIABLE_MODE`, `CONDITIONAL`, `UPDATE_MEDIA_RUNTIME`, transitions/easings) [API]. |
| Export (`ExportMixin`) | `exportSettings: ExportSettings[]` (§2.6) [API]. |
| Components (`ComponentPropertiesMixin`, `VariantMixin`, `PublishableMixin`) | `componentPropertyDefinitions` (`BOOLEAN`, `TEXT`, `INSTANCE_SWAP` + preferred values, `VARIANT`, `SLOT`), variant properties, description(+markdown), documentation links, `key`, `remote` [API]. |
| Instances (`InstanceNode`) | main component reference, `componentProperties` values, overrides (per-sublayer property deltas), exposed instances, scale factor [API]. |
| Annotations / measurements (`AnnotationsMixin`, `MeasurementsMixin`, `DevStatusMixin`) | `annotations`, measurements (page-scoped), `devStatus` [API]. |
| Transform groups (`TransformGroupNode`) | `transformModifiers: (LinearRepeatModifier \| RadialRepeatModifier)[]` [API]. |
| Container UI flag (`ContainerMixin`) | `expanded` — "whether this container is shown as expanded in the layers panel" [API]. Stored as document data in Figma's model; Illigma stores it per user (§2.4) but must round-trip it on import/export to Figma-derived formats [ILL]. |

**Child order.** `children` is "sorted back-to-front": first child = bottom-most, last = top-most [API]. Figma internally uses **fractional indexing** for child positions [API, ChildrenMixin remark]. The file must store an explicit, stable order; an implementation may use fractional index keys so that inserts do not rewrite siblings [ILL].

### 2.4 Document data vs. transient / per-user state

| State | Class | Rule |
| --- | --- | --- |
| Node tree, properties, styles, variables, assets, prototypes | Document | Saved; participates in undo; marks file dirty. [ILL] |
| Current page, per-page viewport (center, zoom) | Per-user view state | Saved in a **separate per-user section** (or sidecar), restored on reopen, **never** marks file dirty, never undoable. Figma's `figma.viewport` is a per-session API, not node data [API][ILL]. |
| Selection, `selectedTextRange`, `focusedNode`, `focusedSlide` | Per-user transient | Exposed on `PageNode` per session [API]; Illigma may restore selection on reopen (P2) but never as document data [ILL]. |
| Layers-panel expanded state (`expanded`) | Per-user view state (Illigma) | See §2.3 note. [ILL] |
| Undo/redo stacks | Session-only | Not persisted; opening a file starts an empty undo stack (matches Figma per-session undo) [KNOW]. |
| Tool state, panel widths, zoom-to-fit memory, rulers visibility, pixel grid, outline mode | App preferences / per-user | Not document data. [ILL] |
| Missing-font status (`hasMissingFont`) | Derived | Computed on load; not stored [API]. |
| Thumbnails, render caches, derived text glyph data | Derived cache | May be stored for fast open and missing-font rendering (§3.14); must be regenerable; never authoritative [ILL]. |

### 2.5 Identity & references

| Reference | Figma form | Format requirement |
| --- | --- | --- |
| Node ID | String like `1:3`; URLs hyphenate (`1-3`) [API]. Internal structure `{sessionID, localID}` [SRC:registry.npmjs.org/fig-kiwi README]. Instance sublayer IDs are compound, e.g. `I1:2;3:4` [KNOW]. | Unique within file; never reused after deletion [KNOW][ILL]; preserved exactly on save/open; preserved on `.fig`/REST import (namespaced if collisions) [ILL]. |
| Style reference | `fillStyleId`, `strokeStyleId`, `textStyleId`, `effectStyleId`, `gridStyleId` (+ per-range text style ids) [API] | Resolve to local or remote style record; dangling refs preserved and flagged, never silently dropped [ILL]. |
| Variable reference | `VariableAlias {type:'VARIABLE_ALIAS', id}` in `boundVariables`, paint `boundVariables`, variable values [API] | Same as above; alias cycles must be rejected at write-time and tolerated (flagged) at read-time [ILL]. |
| Component reference | Instance → main component (local or remote) [API] | Remote mains are stored as cached copies with source library identity + `key` [ILL]. |
| Publish key | `key: string` on components, component sets, styles, variables, collections [API] | Stable across saves of the same file. "Save a copy…" keeps node IDs but gets a **new file identity**, so its publishable assets get **new keys** and are not linked to the original's consumers — mirroring Figma, where a re-imported local copy is a new file whose components become new main components [DOC:8403626871063 excerpt][ILL]. |
| Image/video reference | `imageHash` (plugin) / `imageRef`, `gifRef` (REST) [API] | Content hash of bytes; asset table entry must exist for every referenced hash or the paint renders a "missing image" placeholder (never crashes) [ILL]. |
| Pattern source | REST `PatternPaint.sourceNodeId` [API] | Node reference; must survive copy/paste remapping [ILL]. |
| Prototype destination | `Action` `destinationId`, `flowStartingPoints.nodeId` [API] | Remapped on paste/duplicate within same file; cleared/flagged when destination missing [KNOW][ILL]. |

### 2.6 Export settings data (`ExportMixin.exportSettings`)

| Field | Formats | Default | Values / range |
| --- | --- | --- | --- |
| `format` | — | — | `'JPG' \| 'PNG'` (image), `'SVG'`, `'SVG_STRING'` (API-only string return), `'PDF'`, `'JSON_REST_V1'` (API-only), `'MP4' \| 'GIF' \| 'WEBM'` (animation, `exportAsync` only) [API]. Stored `exportSettings` union = Image \| SVG \| PDF [API]. |
| `suffix` | PNG/JPG/SVG/PDF | `''` | Appended to file name [API][DOC:13402894554519 excerpt]. |
| `contentsOnly` | PNG/JPG/SVG/PDF | `true` | UI "Ignore overlapping layers": `true` = only this node's content; `false` = every visible overlapping layer in the area [API][DOC:13402894554519 excerpt]. |
| `useAbsoluteBounds` | PNG/JPG/SVG/PDF | `false` | UI "Include bounding box": full node dimensions even if cropped/empty; "use this to export text nodes without cropping" [API][DOC:13402894554519 excerpt]. |
| `constraint` | PNG/JPG | `{type:'SCALE', value:1}` | `'SCALE' \| 'WIDTH' \| 'HEIGHT'` + `value` [API]. Export-panel standard scales `0.5, 0.75, 1, 1.5, 2, 3, 4` [API, VideoExportScale doc]. REST render scale range 0.01–4 [API]. |
| `colorProfile` | PNG/JPG/SVG/PDF | `'DOCUMENT'` | `'DOCUMENT' \| 'SRGB' \| 'DISPLAY_P3_V4'` [API]. |
| `svgOutlineText` | SVG | `true` | `true` = glyph outlines; `false` = `<text>` [API]. |
| `svgIdAttribute` | SVG | `false` | Layer names as `id`; masks/gradients always get ids [API]. |
| `svgSimplifyStroke` | SVG | `true` | Approximate inside/outside strokes vs. precise masking [API]. |
| Image quality | JPG, PDF | JPG High, PDF Medium | [DOC:13402894554519 excerpt]; not exposed in typings → persisted as Illigma extension field [ILL]. |
| Image resampling | JPG, PNG, PDF | (verify) | "Basic" = nearest neighbor [DOC:13402894554519 excerpt]; other option name unverified (§8). |
| `fps` | MP4/WEBM; GIF | 30; 15 | MP4/WEBM `12\|24\|30\|60`; GIF `8\|12\|15\|24\|30` [API]. |
| `quality` | MP4/WEBM | `'HIGH'` | `'LOW'\|'MEDIUM'\|'HIGH'` [API]. |
| `loopCount` | GIF | `0` (forever) | Integer 0–1000 [API]. |
| Video `constraint` | MP4/GIF/WEBM | SCALE 1 | SCALE ∈ {0.5,0.75,1,1.5,2,3,4} or WIDTH/HEIGHT px [API]. |

PDF exports only at 1× [DOC:13402894554519 excerpt]. REST `ExportSetting` = `{suffix, format: 'JPG'|'PNG'|'SVG'|'PDF', constraint}` only [API].

### 2.7 Plugin-model vs REST-model naming (importer mapping table)

| Concept | Plugin API | REST API | Mapping rule |
| --- | --- | --- | --- |
| Page | `PAGE` | `CANVAS` (`backgroundColor: RGBA`) | 1:1; REST background → single SOLID page background [API]. |
| Polygon | `POLYGON` | `REGULAR_POLYGON` | 1:1 [API]. |
| Image scale mode | `'FILL'\|'FIT'\|'CROP'\|'TILE'` | `'FILL'\|'FIT'\|'TILE'\|'STRETCH'` | REST `STRETCH` ≙ plugin `CROP` (`imageTransform` present only then) [API]. |
| Style type | `PAINT` | `FILL` | 1:1 [API]. `CUSTOM_ANIMATION` styles have no REST equivalent [API]. |
| Variable types | + `EASING`, `TIMING` | `BOOLEAN\|FLOAT\|STRING\|COLOR` only | REST import cannot carry easing/timing variables [API]. |
| Paint types | + `VIDEO`, `SHADER` | `SOLID\|GRADIENT_*\|IMAGE\|PATTERN` | REST loses video/shader paints [API]. |
| Effects | + `GLASS`, `SHADER` | `DROP_SHADOW\|INNER_SHADOW\|LAYER_BLUR/BACKGROUND_BLUR (NORMAL/PROGRESSIVE)\|TEXTURE\|NOISE` | REST has no `GLASS` [API]. |
| Component property types | + `SLOT` | `BOOLEAN\|INSTANCE_SWAP\|TEXT\|VARIANT` | REST loses slot definitions [API]. |
| Vector geometry | `vectorNetwork` + `vectorPaths` | `fillGeometry`/`strokeGeometry` paths only, with `geometry=paths` | REST import cannot rebuild vector-network topology; import as paths [API]. |
| Rich text | `getStyledTextSegments` | `characterStyleOverrides[]` + `styleOverrideTable{}`, `lineTypes`, `lineIndentations` | Index-run decoding required [API]. |
| Group | `GROUP` | `GROUP` | Note: in `.fig`/clipboard Kiwi data groups are stored as `FRAME` with `resizeToFit: true` [SRC:grida.co/docs/wg/feat-fig excerpt]. |

### 2.8 Limits & ranges relevant to this area

| Limit | Value | Evidence |
| --- | --- | --- |
| Raster image max dimension | Images > 4096 px in width or height are downscaled proportionally so the longest side ≤ 4096; "some file metadata may be lost" | [DOC:360040028034 excerpt]; plugin `createImage` max 4096×4096 [API] |
| Video file size | ≤ 100 MB; MP4, MOV, WebM | [API]; formats also [DOC:360040028034 excerpt] |
| Supported image formats | JPG, PNG, HEIC, WebP, GIF; TIFF only in Safari | [DOC:360040028034 excerpt] (bulk-upload article lists .png/.jpg/.tiff/.heic [DOC:360041089973 excerpt]) |
| Plugin data entry | ≤ 100 kB (pluginId/namespace + key + value) | [API] |
| REST render | scale 0.01–4; ≤ 32 megapixels else scaled down; URLs expire after 30 days | [API] |
| REST image-fill URLs | expire ≤ 14 days | [API] |
| REST versions page size | default 30, max 50 | [API] |
| GIF loop count | 0–1000 (0 = forever) | [API] |
| Browser-tab memory ceiling (Figma) | ≈ 2 GB per tab ("general understanding", device-dependent) | [SRC:forum.figma.com clarification-on-figmas-memory-usage-13811 excerpt] |
| Version history window (Figma Starter/drafts) | 30 days | [DOC:360038006754 excerpt] |
| Named version title | non-empty string required | [API] |

---

## 3. Behavior specification

### 3.1 Native file container (`.illigma`) — requirements

Figma has no user-visible native file on disk (files live in the cloud; `.fig` is a download format) [DOC:8403626871063 excerpt]. Illigma's file therefore has no Figma behavior to copy at the byte level; what must match Figma is **what survives** (everything in §2) and **how the user experiences saving** (never losing work). The following are binding requirements [ILL] unless tagged otherwise.

1. **Single file, self-contained.** One `.illigma` file holds the document, embedded assets (images, videos, materialized shaders, optional fonts), per-user view state in a separable section, thumbnail, and (by default) version history. Precedent: modern `.fig` files are ZIP archives containing `canvas.fig`, `meta.json`, `thumbnail.png`, and an `images/` directory [SRC:github.com/sunyui/figma-parser excerpt]. Recommended: ZIP-compatible container or SQLite; the choice belongs to the architecture doc, but every test in §6.1 must pass.
2. **Self-describing, forward-compatible encoding.** Figma's `.fig` embeds its own Kiwi schema so a reader decodes with the schema shipped in the file [SRC:grida.co/docs/wg/feat-fig excerpt]; Kiwi itself is designed so "old versions of the schema can optionally read new data if a copy of the new schema is bundled with the data" [SRC:github.com/evanw/kiwi README]. Illigma must likewise: (a) carry `formatVersion` and `minReaderVersion`; (b) preserve unknown fields/records verbatim when an older build re-saves a newer-minor file.
3. **Content-addressed assets.** Images/videos stored once per content hash (Figma: `Image.hash` is "a unique hash of the contents of the image file" [API]); garbage-collected only when no node, style, variable, version snapshot, or undo-able state references them.
4. **Canonical text form (P1).** A deterministic JSON (or JSON-Lines) export of the document (stable key order, stable child order, assets referenced by hash) for diffing, Git, debugging, and test fixtures. Re-importing the canonical form must reproduce a byte-identical document section.
5. **Integrity.** Every save is atomic (write temp → fsync → rename); a checksum per part detects truncation/corruption; a corrupt part never prevents opening the rest (pages are independently loadable, §3.5).
6. **No network dependence.** Opening, rendering, and editing never require network access; missing remote resources (fonts, libraries) degrade gracefully (§3.9, §3.14).

```
IlligmaFile (logical layout)
├─ manifest        { formatVersion, minReaderVersion, fileId(UUID), createdBy, revision, documentColorProfile, partHashes }
├─ document/       DOCUMENT + page index (names, order, ids)        ← small, loaded first
├─ pages/<pageId>  node tree for one page (lazy-loadable)
├─ shared/         styles, variable collections + variables, component metadata,
│                  remote (library) asset copies, annotation categories, plugin data
├─ assets/<hash>   image/video/shader/font blobs (+ media type, pixel size, color profile tag)
├─ history/        version snapshots or deltas + version metadata (optional on "Save a copy")
├─ user/<userId>   per-user view state (current page, viewports, expanded, last selection)  ← never dirties the doc
├─ thumbnail.png
└─ journal         write-ahead log of committed but not yet compacted changes (§3.2)
```

### 3.2 Save model, autosave, crash recovery, concurrency

**Figma reference behavior.** Edits are saved continuously; there is no Save command in the workflow [KNOW]. Offline edits are cached locally and applied when service returns; reopening a file closed while offline triggers the sync; the cache is local to that browser/computer; quitting/closing/signing out with unsynced edits shows a prompt allowing the user to discard them, while "log out"/"leave" keeps them for later [DOC:360040328553 excerpt]. Causes of lost offline edits include cleared browser data, private sessions, full storage quota [SRC:forum.figma.com this-document-contains-unsaved-changes-why-27915 excerpt].

**Illigma mapping (parity of experience: "work is never lost, no Save needed").** [ILL]

```
on commit(transaction):                       // every undoable step and every non-undoable doc mutation
    journal.append(seq++, encode(ops))        // durable within ≤ 1 s (group commit)
    revision++ ; state = DIRTY_JOURNALED
on idle(2 s) or 60 s since last compaction or window blur or quit or explicit Save (⌘S):
    snapshot = encode(changed parts only)     // incremental: O(changes), not O(file)
    writeTemp → fsync → atomicRename → journal.truncate(upTo = seq)
    state = CLEAN
on open(path):
    acquire advisory lock (§concurrency)
    if journal exists and journal.baseRevision == manifest.revision:
        replay journal → show non-blocking "Recovered N unsaved changes" banner (Keep / Discard)
    elif journal exists and mismatched: keep journal aside as recovery file, open saved state, notify
on quit with state != CLEAN:
    flush (as above); only if flush FAILS show modal: Retry / Save a copy… / Quit and keep recovery data
```

- **Explicit Save (⌘S / Ctrl+S)** forces the flush and shows a transient confirmation; it never opens a dialog for an already-named file. Untitled new documents are autosaved to an app-managed "Unsaved documents" location until the user picks a path (first ⌘S shows a Save dialog) [ILL]. What ⌘S does in Figma is unverified [KNOW] (§8 V-25).
- **Revert to saved / Recover** menu commands are Illigma additions [ILL].
- **Concurrency:** single writer per file. Opening a file already open for writing in another Illigma window/process focuses the existing window; opening a file locked by another machine (stale lock older than 5 min with no heartbeat → treat as abandoned) offers *Open read-only* / *Open a copy* / *Take over* [ILL]. External modification detected (mtime/hash change not caused by us) → banner *Reload* / *Keep mine (save as copy)*; never silent overwrite [ILL].
- **Undo interplay:** saving/autosaving never alters the undo stack; reopening starts an empty stack [KNOW][ILL]. Journal replay on recovery is a single "Recovered changes" baseline (not individually undoable) [ILL].

### 3.3 Version history

**Figma reference behavior.**
- A new autosave **checkpoint every 30 minutes**; the "current version" always reflects latest edits [DOC:360038006754 excerpt].
- Users can **add names and descriptions** to autosaved versions [DOC:360038006754 excerpt]; creating a version requires a non-empty title, description optional [API `saveVersionHistoryAsync(title, description?)`]; programmatic saves may not include the latest changes unless awaited [API].
- **Restore:** select version to preview in the viewport → "Restore this version"; Figma adds **two autosave checkpoints**; non-destructive (the pre-restore state remains in history) [DOC:360038006754 excerpt]. Restoring does not remove later comments and does not resurrect deleted comments [DOC:360038006754 excerpt].
- **Permissions:** viewers cannot create, name, or restore versions [DOC:360038006754 excerpt].
- **Retention:** drafts / free Starter teams see 30 days; paid plans full history [DOC:360038006754 excerpt].
- REST exposes versions as `{id, created_at, label|null, description|null, user, thumbnail_url?}`, paginated (default 30, max 50) [API]. A file that won't load can be opened at an earlier version from the file browser via a modifier-click [SRC:forum.figma.com my-figma-file-is-not-loading-44391 excerpt].
- Additional per-version actions (duplicate version to a new file, copy link) [KNOW].

**Illigma mapping.** [ILL]
```
checkpointPolicy:
    every committed change updates lastEditTime
    if (now - lastCheckpointTime >= 30 min) and (revision > lastCheckpointRevision):
        createVersion(kind=AUTO, label=null)
namedVersion(title != "", description?):  createVersion(kind=NAMED) ; title trimmed; empty → validation error
restore(v):
    createVersion(kind=AUTO, label=null, note="Before restore")   // checkpoint 1: current state
    document := v.snapshot (new revision)
    createVersion(kind=AUTO, label=null, note="Restored from <v>") // checkpoint 2
    // undo after restore: one undo step returns to the pre-restore state
duplicate(v): write v.snapshot as a new untitled .illigma file (new fileId, new publish keys)
retention: default keep all named versions forever; auto checkpoints thinned (e.g., all for 30 days, then daily) — user-configurable
storage: snapshots stored as deltas against previous snapshot + periodic full keyframes
```
- Preview of a version is **read-only** and isolated: no edits, no autosave, exiting returns to current.
- Version metadata records author as the local OS/user profile name [ILL].
- "Save a copy…" offers *Include version history* (default **on** for Illigma; Figma's `.fig` local copy excludes history [DOC:8403626871063 excerpt]).

### 3.4 Schema versioning & migration

- `formatVersion = MAJOR.MINOR`. Minor bumps add optional fields only; older readers open them and preserve unknown fields on save. Major bumps change semantics; older readers refuse with a message naming the required app version, offering *Open read-only rendering from embedded thumbnail* if available [ILL].
- **Migration pipeline** on open of an older file: `for v in [file.version … current): doc = migrate[v](doc)`; migrations are pure, ordered, idempotent and unit-tested with golden fixtures; the original bytes are backed up (kept in `history/` as a pre-migration snapshot) before the first save in the new version [ILL].
- **Behavioral version flags are data, not code paths to delete:** e.g., the auto layout engine version ("Layout = Updated" vs legacy) [OBS] and Figma's July 2026 auto layout sizing changes [SRC:old/docs/figma/feature-guide.md §auto layout, quoting DOC:42031586813719] mean an old file must keep its old layout results until the user opts in. Every behavior that Figma versions per node/file must be stored as a per-node/per-file flag [ILL].
- `documentColorProfile: LEGACY` files must keep `LEGACY` until the user explicitly assigns/converts (§3.13) [API][DOC:360039825114 excerpt].

### 3.5 Large-file handling

**Figma reference.** Per-tab memory ceiling around 2 GB; files over ~75 % of available memory may fail to open/edit; drivers: large component/variant libraries, many hidden layers, large/high-resolution images; remedies: split files, remove hidden layers, reduce assets, open an earlier version [SRC:forum.figma.com clarification-on-figmas-memory-usage-13811 excerpt]. Figma's plugin model supports **dynamic page loading** (`"documentAccess": "dynamic-page"`, `PageNode.loadAsync`, `loadAllPagesAsync` "may be slow for large documents") [API], and `skipInvisibleInstanceChildren` notes that invisible instance children make traversal slow in "large documents with tens of thousands of nodes" [API]. Very large `.fig` imports may fail [DOC:360040027794 excerpt].

**Illigma requirements.** [ILL]
- Open shows the first/last-viewed page interactively **before** other pages are decoded; other pages load lazily in the background or on navigation.
- Image assets decode lazily at the needed resolution (mip levels); thumbnails shown until decode completes.
- Memory budget indicator and warning at 75 % of budget (mirrors Figma's guidance threshold) with actions: *Find large images*, *Find hidden layers*, *Split page into new file*.
- Save cost proportional to changed parts (incremental), so a 500 MB file with a one-node edit autosaves in well under a second.
- Performance targets (open time, frame time, autosave latency for 100k/500k/1M-node fixtures) are defined in the performance-hardening plan (M8) and tested with generated fixtures.

### 3.6 Raster & video import pipeline

Placement gestures (drag-drop position, Place image tool ⇧⌘K click/drag, multi-image placement, image-to-fill on selected shape) are specified in PE/CV. This section specifies **decoding and storage**, which every entry point (drop, place, paste, SVG `<image>`, `.fig`/REST import) shares.

**Figma reference.** Accepted: JPG, PNG, HEIC, WebP, GIF, TIFF (Safari only); video MP4, MOV, WebM; SVG becomes an editable vector layer instead of an image [DOC:360040028034 excerpt]. Assets wider or taller than 4096 px are scaled proportionally so the longest side is ≤ 4096 px and some metadata may be lost [DOC:360040028034 excerpt]. Dragging an image in creates a rectangle with a single image fill [API, REST `/v1/files/{key}/images` description]. Animated GIFs keep a separate `gifRef` in REST [API] and play in prototypes [DOC:360041486873 title]. Video ≤ 100 MB [API]; video upload restricted to paid plans in Figma [API] (irrelevant locally). Imported Display-P3-tagged images have been reported to be mapped to sRGB [SRC:forum.figma.com problem-with-managing-image-colour-profiles-34569 excerpt].

```
importRaster(bytes, sourceName):
    fmt = sniff(bytes)                       // by magic bytes, not extension
    if fmt == SVG: return importSvg(...)     // §3.7
    if fmt not in {PNG, JPEG, GIF, WEBP, HEIC, TIFF}: error "Unsupported file type" (no partial node created)
    img = decode(bytes)                      // apply EXIF orientation [KNOW]; first frame for poster, all frames kept for GIF
    if max(img.w, img.h) > 4096:
        s = 4096 / max(img.w, img.h)
        img = resample(img, round(img.w*s), round(img.h*s))   // proportional; rounding rule to verify (§8)
        storedBytes = encode(img)            // original bytes NOT kept (parity); see note
    else storedBytes = bytes                 // keep original encoding where possible (verify Figma re-encodes or not)
    profile = embeddedICC(img) ?? sRGB       // §3.13
    hash = contentHash(storedBytes)          // dedupe: identical bytes → one asset
    assets.putIfAbsent(hash, storedBytes, {w, h, mime, profile, animated: isAnimated(img)})
    return ImagePaint{type:'IMAGE', imageHash:hash, scaleMode:'FILL'}
```
Note: keeping the full-resolution original as an *opt-in* Illigma setting ("Keep original images") is allowed as a P2 superset, but the default must reproduce Figma's 4096 cap so exports match [ILL].

### 3.7 SVG import

**Figma reference.** SVG import = `figma.createNodeFromSvg(svg)` which "is equivalent to the SVG import feature in the editor" and returns a **FrameNode** [API]. SVG is recommended as the lossless exchange format between design tools; pasting SVG copied from another app creates vector layers; "SVG marker and pattern elements will not be included in the import" [DOC:360040030374 excerpt]. Community forum replies (seen only as search excerpts; per-thread attribution uncertain among forum.figma.com threads `t/import-svg/56630`, `import-svg-4221`, `t/importing-svg-not-working-properly/2144`, `importing-sag-logo-file-into-figma-12365`) add: a community-support reply that `symbol`, `marker` and `clipPath` are not imported; a reply that `defs`/`use` are rejected; that SVGs lacking `viewBox` or `width`/`height` import tiny; and that masks in Illustrator-exported SVGs may not import correctly [SRC:forum.figma.com (threads above) excerpt]. These are conflicting/possibly outdated — §8 V-10.

**Mapping contract** (expected Figma output; rows tagged [KNOW] must be confirmed by §8 V-10 before implementation is called parity):

| SVG input | Expected node/property result |
| --- | --- |
| root `<svg>` | One top-level `FRAME` [API]; size from `width`/`height`, else `viewBox` [KNOW]; name = file name without extension on file import, generic name on paste [KNOW]; `clipsContent` value to verify [KNOW]; frame fill from root background? none [KNOW]. Placed at drop point / viewport center (placement per CV). |
| `viewBox` ≠ `width`/`height` | Content scaled by `width/viewBoxWidth`, `height/viewBoxHeight`; `preserveAspectRatio` honored or ignored — verify [KNOW]. |
| `<g>` | `GROUP` with children; `<g>` attributes (opacity, transform, fill inheritance) applied [KNOW]. |
| `<path>`, `<polygon>`, `<polyline>` | `VECTOR`; path data → vector network; `fill-rule:evenodd` → `windingRule:'EVENODD'`, else `NONZERO` [API enum][KNOW]. |
| `<rect>` (incl. `rx/ry`) | `RECTANGLE` with corner radius, or `VECTOR` — verify [KNOW]. |
| `<circle>`, `<ellipse>` | `ELLIPSE` or `VECTOR` — verify [KNOW]. |
| `<line>` | `LINE` or `VECTOR` — verify [KNOW]. |
| `<text>`, `<tspan>` | `TEXT` layers (font-family/size/weight/letter-spacing mapped; unmapped fonts → missing-font state) or dropped — verify [KNOW]. |
| `<image>` (data URI) | Rectangle with `IMAGE` fill through §3.6 [KNOW]; external `href` never fetched [ILL]. |
| `<linearGradient>`, `<radialGradient>` | `GRADIENT_LINEAR` / `GRADIENT_RADIAL` with stops + transform; `spreadMethod` other than `pad` approximated [KNOW]. |
| `fill`, `stroke`, `*-opacity`, `opacity` | Paint color + paint opacity; element `opacity` → node `opacity` [KNOW]. |
| `stroke-width/-linecap/-linejoin/-miterlimit/-dasharray` | `strokeWeight`, `strokeCap`, `strokeJoin`, `strokeMiterLimit`, `dashPattern`; `strokeAlign:'CENTER'` [KNOW]. |
| `transform` | Translation/rotation/scale folded into `relativeTransform` or baked into vector geometry; skew baked into geometry [KNOW]. |
| `<clipPath>` | Mask group with the clip shape as `isMask` layer, or dropped — conflicting evidence, verify [SRC][KNOW]. |
| `<mask>` | Luminance/alpha mask, or dropped — verify [KNOW]. |
| `<pattern>`, `<marker>` | **Not imported** [DOC:360040030374 excerpt]. |
| `<symbol>`, `<use>`, `<defs>` | Not imported / rejected per community; verify current behavior [SRC]. |
| `<filter>` (`feGaussianBlur`, `feOffset`+`feFlood`+`feComposite` chains, `feDropShadow`) | Mapped to `LAYER_BLUR` / `DROP_SHADOW` / `INNER_SHADOW` when the chain matches Figma's own export pattern, else dropped — verify [KNOW]. |
| CSS `<style>`, `class`, `style=""` | Inline style supported; `<style>` selectors — verify [KNOW]. |
| `mix-blend-mode` | `blendMode` [KNOW]. |
| `display:none`, `visibility:hidden` | Omitted or hidden layer — verify [KNOW]. |
| `<foreignObject>`, `<script>`, SMIL `<animate*>`, external refs | Ignored; never executed or fetched [KNOW][ILL]. |
| Units `mm, cm, in, pt, pc, em, %` | Converted to px (96 px/in) — verify [KNOW]. |
| `currentColor` | Resolved against `color` (default black) [KNOW]. |
| Malformed XML | Error toast; no partial import; document unchanged [KNOW][ILL]. |

**Round-trip rule:** importing an SVG that Figma itself exported (§3.8.3) must reproduce Figma's re-import result (same node types, names when `svgIdAttribute` was on, same geometry within 0.01 px) [ILL].

**Undo:** one SVG import = one undo step; undo removes the whole imported frame and any newly added image assets become unreferenced [KNOW][ILL].

### 3.8 Export encoders

#### 3.8.1 Common pipeline

```
export(node, s: ExportSettings):
    B = s.useAbsoluteBounds ? node.absoluteBoundingBox      // full layer box, even if cropped/empty
                            : node.absoluteRenderBounds      // visible pixels incl. effects/strokes, clipped by ancestors
    layers = s.contentsOnly ? subtree(node)                   // "Ignore overlapping layers" ON (default)
                            : all visible layers on page intersecting B in z-order
    k = s.constraint.type == 'SCALE'  ? s.constraint.value
      : s.constraint.type == 'WIDTH'  ? s.constraint.value / B.width
      :                                 s.constraint.value / B.height
    raster size = (B.width*k, B.height*k) rounded per rule R (verify: ceil vs round) ; REST clamps k to [0.01, 4] and ≤ 32 MP
    colors converted from documentColorProfile to s.colorProfile (DOCUMENT = no conversion)   // §3.13
    exclude editor chrome (selection, guides, layout grids, comments, prototype noodles, frame titles)
    hidden layers (visible=false) never rendered; exporting a hidden node itself → verify
    filename = sanitize(node.name) + s.suffix + '.' + ext ; '/' in layer names → subfolders (verify)
```
Evidence: contentsOnly/useAbsoluteBounds semantics and defaults [API]; "Ignore overlapping layers" only matters when the node is inside a frame/group [DOC:13402894554519 excerpt]; REST scale/size limits [API]; folder/rounding/hidden-node rules [KNOW] (§8 V-14..V-17). Exports must exclude editor overlays [SRC:old/docs/figma/feature-guide.md §16].

Multiple export settings on one node export one file per setting; exporting several nodes produces several files (desktop: written into the chosen folder; Illigma may also offer ZIP) [KNOW][ILL]. Slices (`SLICE`) export their rectangle with all visible content beneath (they have no content of their own) [API SliceNode][KNOW].

#### 3.8.2 PNG / JPG

- **PNG:** always RGBA (no option to drop alpha) [DOC:13402894554519 excerpt]; 8 bits/channel [KNOW]; embeds/labels the export color profile (sRGB or Display P3) [API colorProfile][KNOW].
- **JPG:** lossy, no transparency [DOC:13402894554519 excerpt]; transparent areas composited onto white — verify [KNOW]; quality setting default **High** [DOC:13402894554519 excerpt]; quality levels and their encoder quality numbers to verify (§8 V-15).
- **Resampling:** "Basic" = nearest-neighbor sampling; available for JPG, PNG, PDF [DOC:13402894554519 excerpt]; the alternative (smooth) option name/default to verify.
- Image fills inside exported nodes are rendered from the stored (≤ 4096 px) asset; upscaled exports cannot exceed stored detail [DOC:360040028034 excerpt][KNOW].

#### 3.8.3 SVG

- Options and defaults: outline text **on**, `id` attributes **off**, simplify stroke **on** [API]. With ids on, ids come from layer names; masks/gradients always carry ids [API]. REST additionally offers `svg_include_node_id` → `data-node-id` attributes [API]; Illigma should offer it as an advanced option (P2) [ILL].
- SVG supports only center strokes; with simplify on, inside/outside strokes are approximated; with simplify off, a precise masking technique is used [API].
- With outline text off, text becomes `<text>` and rendering depends on the viewer [API].
- Background blur caveat ("must be applied directly to the layer") and "strokes exported as fills" appear in the formats article excerpt [DOC:13402894554519 excerpt] — exact meaning to verify (§8 V-18).
- Display-P3 documents: Figma writes the color in the target space but the sRGB fallback is reported as unconverted [SRC:forum.figma.com svg-export-incorrect-color-profile-39416 excerpt]. Illigma must write a correct sRGB fallback **and** (when profile = P3) a `color(display-p3 …)` value; document this deliberate deviation if Figma's bug is confirmed [ILL].
- Expected structure (verify): root `<svg width height viewBox="0 0 W H" fill="none" xmlns=…>`; hidden layers omitted; image fills as `<pattern>` + base64 `<image>`; effects as `<filter>`; blend modes as `mix-blend-mode`; angular/diamond gradients via non-native constructs [KNOW] (§8 V-18).
- Hyperlinks are not preserved in SVG export [SRC:forum.figma.com exporting-to-svg-and-preserving-hyperlinks-36293 excerpt].

#### 3.8.4 PDF

- Only 1× [DOC:13402894554519 excerpt]; image quality default **Medium** [DOC:13402894554519 excerpt]; `contentsOnly`, `useAbsoluteBounds`, `colorProfile` apply [API].
- Vector output for shapes [DOC:13402894554519 excerpt: PDFs include text, fonts, vector graphics, images].
- **Text:** reports conflict — fonts not embedded and text converted to vectors with annotations allowing selection [SRC:forum.figma.com/t/pdf-export-text-not-selectable/286 excerpt]; 2026 requests still describe outlined, non-searchable text [SRC:forum.figma.com fix-pdf-export-support-font-embedding-instead-of-vector-outlining-50699 excerpt]. **Parity target = Figma's visual output;** Illigma additionally embeds subset fonts where the font's OS/2 `fsType` permits (P1 superset) and falls back to outlines otherwise [ILL].
- **Multi-page:** a File-menu command exports frames to one multi-page PDF; page order follows canvas arrangement (left→right, top→bottom), not selection order [SRC:layerpath.com how-to-export-multiple-frames-in-figma-as-one-pdf excerpt]; a 2026 request says the command exports all frames on the current page, not just the selection [SRC:forum.figma.com export-a-single-multi-page-pdf-from-selected-frames-without-creating-a-new-page-49835 excerpt]. Verify (§8 V-19).
- **Links:** text hyperlinks become URL link annotations; prototype connections produce no PDF interactivity; no internal page links [SRC:forum.figma.com links-between-pages-in-pdf-export-23760 excerpt].
- Each PDF page = the exported frame's bounds at 1 pt per px [KNOW] (verify units).

#### 3.8.5 Animated export (MP4 / GIF / WebM)

Only a **top-level frame whose content is animated** can be exported; nested frames or individual keyframed layers reject with an error; rejects if no animated content; the whole frame is encoded across the animation's duration [API]. Options: §2.6. Figma article "Export animations from Figma" exists [DOC:41307983648407 title]. Illigma: P2 (M7/M8) [ILL].

#### 3.8.6 JSON

`exportAsync({format:'JSON_REST_V1'})` returns the REST `/files/:key/nodes` shape for a node [API]. Illigma offers "Export as Figma-REST-compatible JSON" (P2) using the same shape, for tool interop and test fixtures [ILL].

### 3.9 Local libraries & cross-file references

**Figma reference.** Components, component sets, styles, variables and collections carry a publish `key` and a `remote` flag [API]; consumers import by key (`importComponentByKeyAsync`, `importComponentSetByKeyAsync`, `importStyleByKeyAsync`, `importVariableByKeyAsync`), which reject when no published asset has that key [API]; collections can be `hiddenFromPublishing`, as can variables [API]. Consuming files hold remote assets that keep rendering (e.g., instances whose main is "remote" or "soft-deleted") [API]. Library updates are reviewed and accepted [DOC:360039234193 title]; libraries can be swapped [DOC:4404856784663 title]; a re-imported local copy creates new mains disconnected from the original library [DOC:8403626871063 excerpt].

**Illigma mapping.** [ILL]
```
LibraryFile   = any .illigma with ≥1 published asset
publish(lib)  : snapshot published assets (components, sets, styles, variables, collections not hiddenFromPublishing)
                → lib.manifest.libraryVersion++ ; record {key, assetHash, name, description} per asset
consumer.libraryRefs[] = {libraryFileId, lastKnownPath, subscribedVersion, enabled}
on consumer open:
    for ref in libraryRefs: locate lib by fileId (lastKnownPath, then configured library folders, then recent files)
        if found and lib.libraryVersion > ref.subscribedVersion: show "Library updates available" (per-asset review/accept)
        if not found: keep cached remote copies; mark library "Missing" with Relink…; nothing breaks
insert remote asset: copy published snapshot into consumer.shared.remote[] (remote=true, key, sourceLibraryId)
accept update: replace cached copy, re-resolve instances preserving overrides (CP rules)
```
- Keys are stable for the lifetime of the library file and unique across files (e.g., `fileId + localAssetId` hashed) [ILL].
- Moving/renaming a library file on disk must not break links (resolution by `fileId`) [ILL].
- Assets whose names start with `.` or `_` are not published (Figma convention) [KNOW] — verify (§8 V-30).

### 3.10 System clipboard

**Figma reference.**
- **Copy (⌘C)** of layers writes HTML with Figma's binary data base64-encoded in `data-metadata` / `data-buffer` attributes of a `<span>` [SRC:simonwillison.net/2024/Sep/19/the-webs-clipboard excerpt]; the HTML carries `(figmeta)` and `(figma)` marked sections [SRC:registry.npmjs.org/fig-kiwi README: "HTML file from pasteboard with (figma) (/figma) comments"]. Decoded payload is a `NODE_CHANGES` message with `pasteID`, `pasteFileKey`, `pastePageId`, `pasteIsPartiallyOutsideEnclosingFrame` [SRC:registry.npmjs.org/fig-kiwi README]; figmeta in current clients includes the selected node ids [SRC:cdn.jsdelivr.net/npm/@agent-native/core@0.124.6/…/import-figma-clipboard.ts excerpt]. Not a public API; may change without notice [SRC:grida.co/docs/editor/features/copy-paste-figma excerpt].
- **Copy/Paste as ▸ Copy as SVG** puts SVG markup on the clipboard; **Copy as PNG** (⇧⌘C) puts PNG image data (not a file) [DOC:360040030374 excerpt][SRC:forum.figma.com paste-files-after-copy-as-png-svg-macos-15378 excerpt]. Copy as text / Copy as code / Copy link exist [KNOW].
- **Paste SVG text** from another app creates vector layers ("right-click the canvas and select Paste here") [DOC:360040030374 excerpt]. Pasting requires edit access; copying requires at least view access unless the owner restricted copying [DOC:360040030374 excerpt].
- **Paste over selection** ⇧⌘V and **Paste to replace** ⇧⌘R, **Paste here** (context menu only) [SRC:forum.figma.com/t/ctrl-shift-v-vs-ctrl-shift-r/57124 excerpt] — placement semantics owned by CV.

**Illigma write flavors on Copy (⌘C).** [ILL]
| Flavor | Content | Purpose |
| --- | --- | --- |
| `application/x-illigma-nodes` (private type; UTI/clipboard-format registered by app) | Versioned payload: node subtrees, referenced styles/variables/collections/component definitions needed to reconstitute them, image/video assets (inline if total ≤ 20 MB, else by hash + source file path), source `fileId`, `pageId`, original absolute positions, parent context | Full-fidelity paste within/between Illigma documents and instances |
| `text/html` | `<svg>` rendering of the selection plus an Illigma marker comment pointing to the private payload | Paste into HTML-aware apps (docs, mail) |
| `image/svg+xml` (where the OS supports it) | SVG export with default settings | Vector apps |
| `text/plain` | Concatenated `characters` of selected text layers (in layer order); for non-text selections: layer names (verify Figma) | Text editors |
| `image/png` | **Only** for Copy as PNG (⇧⌘C), 2× by default (verify Figma's scale) | Raster apps |

**Paste resolution order (⌘V).** [KNOW for Figma; ILL for Illigma's private type]
1. Illigma private payload → nodes (cross-file rules below).
2. Figma HTML payload (`(figma)` marker) → §3.11.1 if enabled; else fall through to the HTML's visible content / plain text and show a one-time hint explaining Figma-to-Illigma options.
3. File references (files copied in Finder/Explorer) → import each supported media or SVG file (§3.6/§3.7); other file types are ignored with a toast.
4. Image data (`image/png`, `image/jpeg`, TIFF on macOS) → §3.6 image layer.
5. SVG markup (in `image/svg+xml` or in `text/plain` beginning with `<svg` / `<?xml`) → §3.7.
6. Plain text → new text layer (or inserted into the text being edited).

**Cross-file paste semantics** (Figma behavior to verify, §8 V-21) [KNOW]: instances of published library components stay linked to the library; instances of a source file's unpublished local component paste as instances of a remote, non-editable copy; styles/variables referenced from another file follow the same published/unpublished rule; images travel with the paste; missing fonts produce missing-font state. Illigma reproduces whichever behavior Figma exhibits; private payload carries all definitions needed.

### 3.11 Figma interoperability: clipboard, `.fig`, REST API, plugin bridge — feasibility & legality

#### 3.11.0 Legal/ToS position (gate for every path below)

- Figma states that its local-copy formats are **proprietary and may change**, and **recommends against third-party tools that ask for these file types**, pointing to its official APIs instead [DOC:8403626871063 excerpt].
- The REST OpenAPI spec references the Figma **Developer Terms** (`https://www.figma.com/developer-terms/`) [API openapi `info.termsOfService`]. The wording of Figma's general Terms of Service regarding reverse engineering could **not** be verified in this session; it is commonly understood to restrict reverse engineering of the service [KNOW]. Interoperability exceptions in some jurisdictions (e.g., EU Software Directive Art. 6, US DMCA §1201(f)) may apply [KNOW] — **requires legal counsel review before any `.fig`/clipboard-binary feature ships.**
- Third-party code licensing: `kiwi-schema` (Kiwi format, Evan Wallace) — **MIT** [SRC:registry.npmjs.org/kiwi-schema][SRC:github.com/evanw/kiwi LICENSE.md]; `fig2sketch` (Sketch B.V., Python, `.fig`→`.sketch`) — **MIT** [SRC:github.com/sketch-hq/fig2sketch LICENSE]; `openfig-core` 0.4.1 (2026-08) — **MIT** per npm metadata [SRC:registry.npmjs.org/openfig-core]; `fig-kiwi` 0.0.1 (2022) — **no license declared** (treat as all rights reserved; do not vendor or copy) [SRC:registry.npmjs.org/fig-kiwi]; `figma-parser` and Grida `io-figma` — license **not verified** [SRC:github.com/sunyui/figma-parser excerpt][SRC:grida.co/docs/wg/feat-fig excerpt].
- **Policy [ILL]:** (1) prefer official, documented channels (REST API with the user's own token; a Figma plugin using the Plugin API) over binary parsing; (2) any binary parsing is clean-room, read-only, local, opt-in, feature-flagged, and decodes only the schema embedded in the user's own `.fig` file (no Figma schema shipped in Illigma for files); (3) never write Figma-proprietary binary formats; (4) never upload user files anywhere.

#### 3.11.1 Paste from Figma (P2, feasibility-gated)

| Approach | Mechanism | Fidelity | Risk |
| --- | --- | --- | --- |
| A. **REST-by-reference** | Read `(figmeta)` → file key + selected node ids [SRC:jsdelivr agent-native import-figma-clipboard.ts excerpt]; fetch `GET /v1/files/:key/nodes?ids=…&geometry=paths` + image fills with the user's token [API]; convert via §3.11.4 | REST fidelity (paths not networks; no GLASS/VIDEO/SHADER/SLOT/Motion) [API] | Low legal risk (official API); needs network + token; metadata format may change [SRC] |
| B. **Kiwi decode of `(figma)` payload** | base64 → decompress → Kiwi decode with a **bundled** schema (clipboard payload is not self-describing) [SRC:grida.co/docs/wg/feat-fig excerpt]; schema drifts (Grida snapshot Dec 2025) [SRC:grida.co/docs/editor/features/copy-paste-figma excerpt]; blobs (vector networks etc.) need extra decoding [SRC:registry.npmjs.org/fig-kiwi README] | Highest (native node-change records) | High legal + breakage risk; requires shipping Figma-derived schema → **blocked by policy (2) unless counsel approves** |
| C. **Visible fallback** | Use HTML/plain-text/SVG flavors if present | Low | None |

Default: A when a token is configured, else C with a hint. B only behind an experimental flag after legal sign-off [ILL].

#### 3.11.2 Copy to Figma (P1 via SVG; P2 via plugin)

- **SVG path (P1):** Illigma's clipboard always includes SVG (§3.10); Figma pastes SVG as vectors [DOC:360040030374 excerpt]. Loses components, auto layout, variables, text editability when outlined. Illigma must default `Copy as SVG` text to `<text>` (not outlined) so text stays editable after paste into Figma — verify Figma's import of `<text>` (§8 V-10) [ILL].
- **Figma plugin bridge (P2, "Illigma Bridge"):** a Figma plugin built only on the official Plugin API that (a) imports an Illigma interchange JSON by creating nodes (`createFrame`, `createNodeFromSvg`, `createImage`, text with `loadFontAsync`, variables via `figma.variables`, components/instances) [API]; and (b) exports from Figma with `exportAsync({format:'JSON_REST_V1'})` + `getImageByHash(hash).getBytesAsync()` + local variables/styles APIs [API] — no REST token needed and no binary parsing. Recommended high-fidelity path in both directions [ILL].
- **Writing Figma's private clipboard HTML/Kiwi:** **out of scope** (policy 3) [ILL].

#### 3.11.3 `.fig` import (P2, feasibility-gated)

**Format facts (reverse-engineered, unofficial):** 8-byte ASCII prelude — `fig-kiwi` for Design files (`fig-jam.` FigJam, `fig-deck` Slides) — then little-endian u32 version; chunk 1 = compressed Kiwi schema (raw deflate), chunk 2 = compressed scene data (deflate, or zstd in newer files — magic `0xFD2FB528`) [SRC:grida.co/docs/wg/feat-fig excerpt][SRC:github.com/sunyui/figma-parser excerpt]; modern `.fig` downloads are ZIP archives with `canvas.fig`, `meta.json`, `thumbnail.png`, `images/` [SRC:github.com/sunyui/figma-parser excerpt]. Scene data is a node-change message; groups appear as `FRAME` records (`resizeToFit: true`, `frameMaskDisabled: false` distinguish them) [SRC:grida.co/docs/wg/feat-fig excerpt]. Figma's local-copy export now also offers `.jam`, `.deck`, `.buzz`, `.site`, `.make` [DOC:8403626871063 excerpt]. Prior art converting `.fig` to another editor: `fig2sketch` (MIT), which warns on unsupported data and documents structural transformations (nested frames → groups for Sketch) [SRC:github.com/sketch-hq/fig2sketch README].

**Import semantics (must mirror Figma's own re-import):** the result is a **new, independent document**; components in it become **new main components**; instances connect to those new mains and no longer receive updates from the original library [DOC:8403626871063 excerpt]; no version history, no comments [DOC:8403626871063 excerpt].

```
importFig(bytes):
    if zip(bytes): canvas = zip['canvas.fig'] ; images = zip['images/*'] ; meta = zip['meta.json']
    prelude = canvas[0:8]; require prelude == 'fig-kiwi' else error "Only Figma Design files are supported"
    version = u32le(canvas[8:12])
    schema  = kiwiDecodeSchema(inflateRaw(chunk[0]))          // schema from the user's own file
    message = kiwiDecode(schema, decompress(chunk[1]))         // deflate or zstd
    build node tree from node-change records (parentIndex ordering = fractional index)
    map known fields → Illigma model (table maintained per fig 'version')
    unknown node types/fields → preserved in an opaque 'foreign' record + rendered from cached geometry if present, else placeholder
    images: attach by hash; missing image bytes → placeholder paint (never fail whole import)
    report: per-feature import log (counts of converted / approximated / dropped)
    whole import = one new document (not an undo step in an existing doc)
```

#### 3.11.4 Figma REST API import (optional, P2)

- **Auth:** the user pastes a personal access token (or completes OAuth); scopes include `file_content:read` / `files:read` [API openapi security]. Token stored in the OS keychain only; never written into documents, logs, crash reports, or exported files [ILL]. Token expiry/rate-limit numbers unverified (§8 V-27).
- **Calls:** `GET /v1/files/:key` with `geometry=paths` (vector data), `plugin_data=shared`, `branch_data=true`, optional `version=` (import a specific version) and `ids=`/`depth=` (subset, page list) [API]; `GET /v1/files/:key/images` for image-fill download URLs (expire ≤ 14 days → download immediately) [API]; `GET /v1/images/:key` only for rendering fallbacks (URLs expire after 30 days; ≤ 32 MP) [API]; `GET /v1/files/:key/variables/local` **only available to full members of Enterprise orgs** [API] → for others, bound variables arrive as ids in `boundVariables` without definitions: import resolved raw values and keep the ids as dangling references with a warning [ILL].
- **Errors:** 400/403/404/429/500 are defined [API]; 429 → exponential back-off honoring `Retry-After` if present [KNOW][ILL]; 403 → token/permission message; partial failures do not leave a half-built document (import into a new document, commit at end) [ILL].
- **Mapping:** §2.7 table; text runs via `characterStyleOverrides` + `styleOverrideTable` [API]; vectors as paths (no network topology) [API]; components/component sets from `components{}`/`componentSets{}` maps with `key`, `remote` [API]; styles from `styles{}` (metadata only; values taken from nodes using them — verify for unused styles, §8 V-28) [API][KNOW].
- **Semantics:** same as `.fig` import — new independent document [ILL, mirroring DOC:8403626871063 excerpt].

### 3.12 Design tokens (W3C DTCG) export/import

**Figma reference.** Native variable export/import in DTCG JSON was announced at Schema 2025 and rolled out gradually (Nov–Dec 2025) [SRC:forum.figma.com native-variable-export-feature-47831 excerpt][SRC:misha.wtf/blog/figma-dtcg-design-tokens excerpt]. Reported UI: right-click a collection → export to JSON [SRC:atomize.tools/blog/figma-design-tokens-guide excerpt]; Variables view → right-click a mode → **Import mode** [SRC:github.com/civictheme/uikit/pull/1025 excerpt]. Native import rejects legacy hex-string colors and requires the DTCG 2025.10 object form (`colorSpace`/`components`/`alpha`), while Figma's export adds an optional `hex` [SRC:github.com/civictheme/uikit/pull/1025 excerpt]. Native export reportedly omits `$description` [SRC:forum.figma.com native-variable-export-feature-47831 excerpt]. The REST variables API is Enterprise-only [API].

**DTCG facts used (read from spec source):** files are JSON; MIME `application/design-tokens+json` (tools must also accept `application/json`); extensions `.tokens` / `.tokens.json` [SRC:github.com/design-tokens/community-group technical-reports/format/file-format.md]; every token has a `$type` (explicit, inherited from group, or via alias) and `$value` [SRC:…/types.md]; aliases use `{group.token}` and JSON Pointer `$ref` (MUST be supported); circular references MUST be reported as errors for all tokens in the chain [SRC:…/aliases.md]; types: color (Color module), `dimension` (`{value, unit: "px"|"rem"}`), `fontFamily`, `fontWeight` (1–1000 or named), `duration` (`ms`/`s`), `cubicBezier` (x in [0,1]), `number`; composites: `strokeStyle`, `border`, `transition`, `shadow`, `gradient`, `typography` [SRC:…/types.md, composite-types.md].

**Mapping contract** (Figma-native mapping details unverified → §8 V-29; Illigma must match Figma's exported JSON byte-for-byte modulo whitespace where Figma's choice is known) [ILL]:

| Figma variable | DTCG output | Notes |
| --- | --- | --- |
| Collection | One JSON document per **collection × mode** (or per mode on "Import mode") | Mode name in file name [SRC excerpt][KNOW] |
| Variable name `a/b/c` | Nested groups `a` → `b` → token `c` | Slash = group separator [KNOW] |
| `COLOR` | `$type:"color"`, `$value:{colorSpace:"srgb"|"display-p3", components:[r,g,b], alpha, hex?}` | Color space follows `documentColorProfile` [ILL] |
| `FLOAT` | `number`, or `dimension` (`px`) when scopes are dimensional (`WIDTH_HEIGHT`, `GAP`, `CORNER_RADIUS`, `FONT_SIZE`, `LINE_HEIGHT`, `LETTER_SPACING`, `PARAGRAPH_*`, `STROKE_FLOAT`, `EFFECT_FLOAT`) | Figma's rule to verify [KNOW] |
| `STRING` | `fontFamily` when scope `FONT_FAMILY`; otherwise Figma-specific (`$extensions`) | Verify [KNOW] |
| `BOOLEAN` | No DTCG type → `$extensions` | Verify [KNOW] |
| `EASING` / `TIMING` | `cubicBezier` / `duration` | Illigma proposal; Figma behavior unknown [ILL] |
| Alias | `"{group.token}"`; cross-collection aliases resolved or kept as reference | Verify [KNOW] |
| `description` | `$description` (Illigma includes it even if Figma omits it — deliberate superset, flagged) | [ILL] |
| `scopes`, `codeSyntax`, `hiddenFromPublishing`, ids | `$extensions` (vendor namespace) | Exact Figma keys to verify (§8 V-29) |

Import: validate types, report circular aliases (DTCG MUST), unknown `$type` → skip with warning; importing into an existing collection updates by name path, creates missing variables, never deletes absent ones unless "Replace" chosen; one import = one undo step [ILL].

### 3.13 Color management

**Figma reference.** New design files default to **sRGB**; a preferred profile for new files is set in Preferences → Color profile; the "Unmanaged" option was removed in August 2023 and legacy files follow the preferred profile (sRGB if none); changing a file's profile offers **Keep color values (Assign)** or **Keep appearance (Convert)**; exports use the file's profile by default but another can be chosen at export [DOC:360039825114 excerpt]. Typings: `documentColorProfile: 'LEGACY'|'SRGB'|'DISPLAY_P3'`; export `colorProfile: 'DOCUMENT'|'SRGB'|'DISPLAY_P3_V4'`, `SRGB` = pre-color-management behavior [API]. Known issues: imported P3-tagged images reportedly mapped to sRGB [SRC:forum.figma.com problem-with-managing-image-colour-profiles-34569 excerpt]; P3 SVG export with unconverted sRGB fallback [SRC:forum.figma.com svg-export-incorrect-color-profile-39416 excerpt]; color management can fail in some browsers (e.g., Firefox defaults) [SRC:bjango.com/articles/colourmanagementsettings excerpt].

```
Stored colors: RGB(A) floats in [0,1] in the DOCUMENT profile's space (encoded/gamma values, not linear) [API RGB][KNOW]
assignProfile(newP):  doc.profile = newP ; colors unchanged (appearance changes)            // "Keep color values"
convertProfile(newP): for every color c (paints, gradient stops, effects, variables, styles, overrides, text ranges):
                          c' = encode_newP( M(old→new) · decode_oldP(c) )                    // "Keep appearance"
                          out-of-gamut handling (P3→sRGB): clip per channel — verify Figma's method (§8 V-23)
                      images: unchanged bytes; display transform follows embedded ICC
sRGB / Display P3 share the sRGB transfer function and D65 white; linear-light matrices [KNOW]:
  P3→sRGB = [[ 1.2249, -0.2249, 0.0000], [-0.0421, 1.0421, 0.0000], [-0.0196, -0.0786, 1.0983]]
  sRGB→P3 = [[ 0.8225,  0.1775, 0.0000], [ 0.0332, 0.9668, 0.0000], [ 0.0171,  0.0724, 0.9105]]
Rendering: canvas output is color-managed to the display profile; hex readouts show stored values in doc space
Export: target = s.colorProfile == DOCUMENT ? doc.profile : s.colorProfile ; convert ; tag output (ICC in PNG/JPG, OutputIntent/ICC in PDF, color() in SVG)
```
Convert is a single undoable step over all **local** colors. Remote (library) asset copies are not rewritten; they are converted at render time and flagged "library uses a different color profile" [ILL] (Figma's behavior for library assets is unverified, §8 V-23).

### 3.14 Fonts: references, missing fonts, embedding, licensing

**Figma reference.** Text stores font references `FontName {family, style, variationSettings?}`; omitting `style` with `variationSettings` lets Figma pick the closest named instance [API]; `hasMissingFont` reports missing fonts [API]; variable-font axes via `getFontFamilyVariationAxes` [API]. Missing fonts show a warning icon in the left sidebar and next to the font name for selected text; a **Missing fonts** modal lists missing fonts/affected layers and allows replacement, which **changes the file for everyone** [DOC:360039956994 excerpt]. Local fonts must be installed in the OS font manager; browsers need the Font Helper, the desktop app does not; only **.TTF and .OTF** are supported for local/shared fonts [DOC:360039956994 excerpt]; org/team admins can upload shared fonts (Org/Enterprise), with skip/replace on family-name conflicts, and should only upload fonts they are licensed to use [DOC:360052679454 excerpt]. Figma files do not embed font binaries [KNOW]. Figma keeps previously computed text rendering so text with a missing font still displays until edited [KNOW] (§8 V-24).

**Illigma requirements.** [ILL]
- Font sources: OS-installed fonts (enumerated natively), app-bundled fonts (Inter etc.), fonts **embedded in the document** (opt-in, per family), and user font folders. TTF, OTF, TTC/OTC, and variable fonts (P0: TTF/OTF; WOFF/WOFF2 import P2).
- **Never rewrite font references on open.** A missing font keeps its `FontName`; the layer renders from cached glyph outlines/derived layout stored in the file (if present) else from a fallback font with a visible missing-font indicator; editing the text's characters or font properties requires a font decision (replace or install) — mirror Figma's exact editability rules once verified (§8 V-24).
- **Replace fonts** dialog: maps (family, style) → (family, style) for all affected layers/styles/variables in one undo step; also offered at import time (`.fig`/REST/SVG/paste).
- **Embedding policy:** embed only when the font's OpenType `OS/2.fsType` allows (Installable 0x0000 or Editable 0x0008; Preview&Print 0x0004 → embed for rendering/print only, read-only text; Restricted 0x0002 → never embed) [KNOW]; honor subsetting bit (0x0100 no-subsetting) and bitmap-only bit (0x0200) [KNOW]; show the license implication before embedding; never embed fonts automatically. Same rules for PDF font embedding (§3.8.4).
- Font identity matching: family + style name, with PostScript name as tiebreaker; versions differing in metrics are flagged ("conflicting versions" is a Figma-cited cause of missing fonts [DOC:360039956994 excerpt]).

### 3.15 Cloud features → local-first equivalents (gap list)

| Figma cloud feature | Figma behavior summary | Local-first equivalent | Status / priority |
| --- | --- | --- | --- |
| Real-time multiplayer, cursors, observation, spotlight, cursor chat, audio | Concurrent editing in one file [DOC:360040322673 title][DOC:4403130802199 title] | **None in v1.** Single writer + file lock + external-change detection (§3.2). Future: CRDT/OT sync service (not planned). | Out of scope |
| Continuous cloud save, offline cache & sync | [DOC:360040328553 excerpt] | Journaled autosave to local file; crash recovery | M0 P0 |
| Version history (cloud, retention by plan) | [DOC:360038006754 excerpt] | Versions stored in file; configurable retention; no plan limits | M8 P1 |
| Save local copy (.fig) | [DOC:8403626871063 excerpt] | Save a copy… (.illigma), options: include history/comments/embedded fonts | M1 P1 |
| Team/org libraries, publish, updates, swap, analytics | [DOC:360041051154 title][DOC:360025508373 title][DOC:360039234193 title][DOC:4404856784663 title] | Library files on disk; publish = versioned snapshot; consumers cache copies; update review; relink; analytics none | M6 P1 |
| Comments & reactions, notifications, mentions | Cloud-only; not in local copies [DOC:8403626871063 excerpt][DOC:360039825314 title] | Local comment threads stored in file (P2): pinned to node/point, resolve/unresolve, author = local profile; no notifications | M8 P2 |
| Branching & merging, branch review | [DOC:360063144053 title][DOC:5691189138839 title] | P2: "Branch" = copy with `baseFileId/baseRevision`; merge = 3-way per-node/per-property diff with conflict UI; or rely on canonical text form + Git | M8 P2 |
| Sharing, link access, roles, "restrict copying/exporting" | [DOC:8403626871063 excerpt] | OS file permissions; no copy/export restrictions | Out of scope |
| Shared/org fonts, cloud font service | [DOC:360052679454 excerpt] | OS fonts + embedded fonts + font folders | M3 P1 |
| Dev Mode, dev resources, annotations, measurements, dev status | [API] | Data preserved losslessly; UI per other areas | M0 P0 (data) |
| Plugins & widgets runtime | [API] | Data preserved (pluginData/shared/relaunch); runtime out of scope | Data P1 |
| Figma Mirror / mobile prototype viewing, present offline downloads | [DOC:360040321093 title][DOC:26463081577367 title] | Local presentation always offline (PR) | — |
| File browser, projects, teams, drafts, trash | — | OS file system, recent files, app "Unsaved documents" folder | M1 P1 |
| Viewer history, activity logs, webhooks | [DOC:29638316371479 title][API] | None | Out of scope |
| AI features (Figma agent, Make, code-to-design capture) | [DOC:37998629035799 title][DOC:40826832449303 title] | None in this area | Out of scope |
| Shaders from Figma's catalog | `listAvailableShaders` includes owned/subscribed shaders [API] | Only shaders embedded in documents | P2 |

### 3.16 Robustness & security of importers

All parsers (native, SVG, raster, `.fig`, REST JSON, DTCG, clipboard) treat input as untrusted [ILL]:
- Bounded resource use: limits on decompressed size (zip-bomb defense), node count, nesting depth, path length, image pixel count (decode guard before allocation), and time; exceeding a limit aborts with a clear message and **no document change**.
- SVG: no external entity resolution (XXE), no DTD fetching, no network fetches, no script execution.
- Failed imports never corrupt the open document; partial results only when the user accepts an import report listing dropped content.
- Fuzz-tested parsers (M8).
