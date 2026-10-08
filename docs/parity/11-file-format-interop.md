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
| Browser-tab memory ceiling (Figma) | ≈ 2 GB per tab ("general understanding", device-dependent) | [SRC:forum.figma.com memory threads, e.g. clarification-on-figmas-memory-usage-13811 — excerpt] |
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

**Figma reference behavior.** Edits are saved continuously; there is no Save command in the workflow [KNOW]. Offline edits are cached locally and applied when service returns; reopening a file closed while offline triggers the sync; the cache is local to that browser/computer; quitting/closing/signing out with unsynced edits shows a prompt allowing the user to discard them, while "log out"/"leave" keeps them for later [DOC:360040328553 excerpt]. Causes of lost offline edits include cleared browser data, private sessions, full storage quota [SRC:forum.figma.com unsaved-changes threads, e.g. this-document-contains-unsaved-changes-why-27915 — excerpt, per-thread attribution uncertain].

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

**Figma reference.** Per-tab memory ceiling around 2 GB; files over ~75 % of available memory may fail to open/edit; drivers: large component/variant libraries, many hidden layers, large/high-resolution images; remedies: split files, remove hidden layers, reduce assets, open an earlier version [SRC:forum.figma.com memory threads, e.g. clarification-on-figmas-memory-usage-13811 — excerpt]. Figma's plugin model supports **dynamic page loading** (`"documentAccess": "dynamic-page"`, `PageNode.loadAsync`, `loadAllPagesAsync` "may be slow for large documents") [API], and `skipInvisibleInstanceChildren` notes that invisible instance children make traversal slow in "large documents with tens of thousands of nodes" [API]. Very large `.fig` imports may fail [DOC:360040027794 excerpt].

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
| `COLOR` | `$type:"color"`, `$value:{colorSpace:"srgb" or "display-p3", components:[r,g,b], alpha, hex?}` | Color space follows `documentColorProfile` [ILL] |
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

---

## 4. Inspector & on-canvas controls

Visual styling comes from the Framer-derived design system; this lists **which controls exist and what they do**.

### 4.1 Right sidebar → Export section (per selection; UI owned by PE, data owned here)
Present for frames in UI3 [OBS: Frame inspector shows "Export" section]. Functional elements [DOC:13402894554519 excerpt][API][KNOW]:
- **+** adds an export setting row (default PNG at 1× [KNOW]; `exportAsync` with no settings = PNG 1× [API]); **−** removes a row.
- Per row: **size field** (scale or fixed size: `0.5x … 4x`, `512w`, `512h` [KNOW]; standard scales 0.5/0.75/1/1.5/2/3/4 [API]); **format** (PNG, JPG, SVG, PDF) [DOC:13402894554519 excerpt]; **settings (…)**: Suffix; Ignore overlapping layers (`contentsOnly`); Include bounding box (`useAbsoluteBounds`, text layers); SVG: Outline text, Include "id" attribute, Simplify stroke; JPG/PDF: Image quality; JPG/PNG/PDF: Image resampling; Color profile [DOC:13402894554519 excerpt][API].
- **Export <layer name>** button exports all rows for all selected layers; **Preview** disclosure renders a preview [KNOW].
- With nothing selected, page-level export settings (REST `CanvasNode` has export settings [API]) — verify UI (§8 V-16).

### 4.2 Export dialog (⇧⌘E)
Lists exportable items (layers with export settings in the selection; verify scope with no selection) with checkboxes and previews, total file count, and an **Export** button that writes to a chosen folder [KNOW] (§8 V-16).

### 4.3 Main menu → File (Figma, functional)
New design file; Place image/video… (⇧⌘K); Save local copy…; Save to version history… (⌥⌘S); Show version history; Export… (⇧⌘E); Export frames to PDF…; Preferences → Color profile (default for new files) [DOC:360039825114 excerpt]; per-file color profile change with Assign/Convert choice [DOC:360039825114 excerpt]. Exact labels/placement [KNOW] (§8 V-26).

### 4.4 Context menu → Copy/Paste as ▸
Copy as text; Copy as code (CSS…); Copy as PNG (⇧⌘C); Copy as SVG; Copy link (⌘L); Paste to replace (⇧⌘R); Paste here (canvas context menu) [DOC:360040030374 excerpt][SRC:forum.figma.com/t/ctrl-shift-v-vs-ctrl-shift-r/57124 excerpt][KNOW].

### 4.5 Version history panel (right sidebar)
Opens in the right sidebar; selecting a version previews it in the viewport; per-version menu with **Restore this version** [DOC:360038006754 excerpt]; name/describe versions [DOC:360038006754 excerpt]; "+" save a named version, "Duplicate", "Copy link" [KNOW]. Illigma adds: *Show autosaves* filter, retention info, *Open as copy* [ILL].

### 4.6 Missing fonts
Warning icon in the left sidebar (file-level) and next to the font name in the right sidebar for selected text; clicking opens the **Missing fonts** modal listing missing fonts and affected layers, with replacement pickers and a replace action that changes the file for everyone [DOC:360039956994 excerpt].

### 4.7 Libraries & variables
Libraries modal (enable/disable libraries, updates review) → DS. Variables view: right-click collection → export JSON; right-click mode → Import mode [SRC:atomize.tools excerpt][SRC:github.com/civictheme/uikit/pull/1025 excerpt].

### 4.8 Illigma-only shell controls [ILL]
File ▸ New (⌘N), Open… (⌘O), Open Recent ▸, Close (⌘W), Save (⌘S), Save a Copy… (⇧⌘S), Recover Unsaved Changes…, Import ▸ (Images & Video…, SVG…, Design Tokens…, Figma file (.fig)… [flag], From Figma via API… [optional]), Export ▸ (Selection… ⇧⌘E, Frames to PDF…, Design Tokens…, Canonical JSON…), Document Color Profile…, Libraries…, Version History. Preferences ▸ Autosave & Recovery (shows journal location), Version retention, Default color profile, Fonts (folders, embedding defaults), Figma API token (keychain). Status bar: save state (Saved / Saving… / Recovery data present), memory-budget meter (§3.5). Import report panel listing converted/approximated/dropped features.

### 4.9 On-canvas
Drag-over highlight for droppable targets when dragging files into the window (frame under pointer becomes the parent — verify Figma, §8 V-12) [KNOW]; progress toasts for long imports/exports with Cancel [ILL]; placeholder rendering for missing images/fonts [ILL].

---

## 5. Keyboard shortcuts (macOS / Windows)

| Action | macOS | Windows | Evidence |
| --- | --- | --- | --- |
| Copy / Cut / Paste | ⌘C / ⌘X / ⌘V | Ctrl+C / Ctrl+X / Ctrl+V | [KNOW] |
| Paste over selection | ⇧⌘V | Ctrl+Shift+V | [SRC:forum.figma.com/t/ctrl-shift-v-vs-ctrl-shift-r/57124 excerpt] |
| Paste to replace | ⇧⌘R | Ctrl+Shift+R | [SRC:forum.figma.com/t/ctrl-shift-v-vs-ctrl-shift-r/57124 excerpt] |
| Copy as PNG | ⇧⌘C | Ctrl+Shift+C | [SRC:forum.figma.com paste-files-after-copy-as-png-svg-macos-15378 excerpt (2022)] |
| Copy properties / Paste properties | ⌥⌘C / ⌥⌘V | Ctrl+Alt+C / Ctrl+Alt+V | [KNOW] (owned by CV) |
| Copy link to selection | ⌘L | Ctrl+L | [KNOW] (Illigma: copies an `illigma://` node reference) |
| Export… | ⇧⌘E | Ctrl+Shift+E | [KNOW] |
| Place image / video | ⇧⌘K | Ctrl+Shift+K | [KNOW] |
| Save to version history | ⌥⌘S | Ctrl+Alt+S | [KNOW] |
| Save (Figma: no explicit save; behavior of ⌘S to verify) | ⌘S | Ctrl+S | [KNOW] / Illigma: force flush, first save of untitled shows dialog [ILL] |
| Save a copy… | ⇧⌘S | Ctrl+Shift+S | [ILL] |
| New file / Open / Close | ⌘N / ⌘O / ⌘W | Ctrl+N / Ctrl+O / Ctrl+W | [KNOW] for ⌘N/⌘W in Figma desktop; ⌘O [ILL] |
| Undo / Redo | ⌘Z / ⇧⌘Z | Ctrl+Z / Ctrl+Shift+Z (Ctrl+Y) | [KNOW] |

All entries tagged [KNOW]/[SRC] are listed in §8 V-26 for confirmation against Figma's keyboard-shortcuts panel.

---

## 6. Parity checklist

**Summary:** 246 items — M0 26 · M1 16 · M2 67 · M3 15 · M4 3 · M5 4 · M6 26 · M7 8 · M8 81 (P0 97 · P1 90 · P2 59). Round-trip items for features owned by other milestones (text, layout, components, variables, prototypes) are scheduled in the milestone that introduces the feature: the format must grow with the model, and every feature is incomplete until its round-trip item passes.

Conventions: "round-trip" = create/import → save → quit → reopen → compare a full canonical model dump (must be equal) **and** render hashes of every page (must be equal). "Figma fixture" = a file prepared in live Figma and exported via REST/plugin JSON + PNG renders for comparison. Items tagged only [ILL] define local-first behavior with no Figma counterpart; their tests are Illigma acceptance tests.

### 6.1 Native container & integrity

- [ ] **IO-001** Single self-contained file — Saving writes one `.illigma` file containing document, pages, shared definitions, embedded assets, thumbnail, version history and per-user section; no sidecar files are required to open it elsewhere. _Data:_ `manifest, document/, pages/*, shared/, assets/*, history/, user/*, thumbnail.png` _Test:_ create a 3-page doc with images and a video, save, copy only the `.illigma` file to a clean user profile with networking disabled, open → every page's render hash equals the original. _M0·P0·[ILL][SRC:github.com/sunyui/figma-parser excerpt]_
- [ ] **IO-002** Atomic save — A save interrupted at any point leaves the previous or the new complete state on disk, never a mix. _Data:_ temp-write → fsync → rename _Test:_ 1,000 runs killing the process at random offsets during save of a 100 MB file; every resulting file opens and equals either the pre- or post-save state. _M0·P0·[ILL]_
- [ ] **IO-003** Per-part integrity — Each part has a checksum; a corrupt page part does not prevent opening the file; the damaged page shows a recovery notice offering restore from the newest version snapshot. _Data:_ `manifest.partHashes` _Test:_ flip bytes in one page part of a 5-page fixture; open → 4 pages intact, notice on the 5th, restore recovers it from history. _M0·P1·[ILL]_
- [ ] **IO-004** Format version gate — Manifest carries `formatVersion` (MAJOR.MINOR) and `minReaderVersion`; a reader older than `minReaderVersion` refuses with a message naming the required app version and never crashes. _Data:_ `formatVersion, minReaderVersion` _Test:_ open a fixture stamped MAJOR+1 → refusal dialog with version text; app remains responsive. _M0·P0·[ILL]_
- [ ] **IO-005** Unknown-field preservation — An older build editing a newer-minor file preserves unknown fields/records byte-for-byte on save. _Data:_ unknown fields in nodes, styles, variables, manifest _Test:_ fixture with synthetic unknown fields on 100 nodes; open in current build, edit one unrelated node, save; newer build re-reads all unknown fields unchanged. _M0·P0·[ILL][SRC:github.com/evanw/kiwi README]_
- [ ] **IO-006** Canonical text form — "Export canonical JSON" is deterministic (stable key order, stable child order, assets by hash) and re-importable losslessly. _Data:_ canonical JSON schema _Test:_ export twice → identical bytes; import into a new file and export again → identical bytes; render hashes equal. _M0·P1·[ILL]_
- [ ] **IO-007** File thumbnail — The thumbnail stored in the file renders the custom thumbnail node when set (Frame, Component, ComponentSet or Section only) or the default otherwise; deleting the custom node reverts to default. _Data:_ `getFileThumbnailNodeAsync/setFileThumbnailNodeAsync` equivalent _Test:_ set a section as thumbnail → `thumbnail.png` matches its render; delete section, save → default thumbnail; compare default choice with Figma (§8 V-31). _M1·P2·[API][DOC:360038511413 title][KNOW]_
- [ ] **IO-008** Per-user state isolation — Changing current page, viewport, selection, or layer expansion never dirties the document, never creates undo steps, never increments `revision`; reopening restores last page and viewport. _Data:_ `user/<id>: currentPageId, viewports{pageId:{center,zoom}}, expanded[]` _Test:_ open, pan/zoom/select/switch page, quit → file mtime and revision unchanged; reopen → same page & viewport. _M1·P0·[API][ILL]_
- [ ] **IO-009** Offline operation — Open, edit, save, export, import local files with no network: no errors, no waits > 100 ms attributable to network. _Data:_ — _Test:_ run the full editing smoke suite with network interfaces disabled; zero network calls recorded by the sandbox. _M0·P0·[ILL]_
- [ ] **IO-010** File identity — Every file has an immutable UUID `fileId`; "Save a copy…" and "Duplicate version" produce new `fileId`s; renaming/moving the file keeps it. _Data:_ `manifest.fileId` _Test:_ save copy → ids differ; move original on disk → id unchanged on reopen. _M0·P0·[ILL]_
- [ ] **IO-011** Content-addressed asset storage — Identical image bytes are stored once regardless of how many paints reference them. _Data:_ `imageHash` → `assets/<hash>` _Test:_ place the same 5 MB PNG 50 times → file grows by ≈ 5 MB once; 50 paints share one hash. _M0·P0·[API][ILL]_
- [ ] **IO-012** Asset garbage collection — An asset is removed from the file only when no node, style, variable, remote copy, version snapshot or retained undo state references it. _Data:_ asset reference counts _Test:_ delete all users of an image, save, undo → image restored correctly; prune history, save → asset removed. _M0·P1·[ILL]_
- [ ] **IO-013** Missing asset tolerance — A paint whose asset bytes are absent renders a placeholder, remains selectable/editable, and export reports the problem instead of failing silently. _Data:_ `ImagePaint.imageHash` without asset _Test:_ fixture with a removed asset → no crash; placeholder visible; PNG export completes with a warning listing the layer. _M0·P1·[ILL]_
- [ ] **IO-014** Lazy page loading — The last-viewed page becomes interactive before other pages are decoded; other pages load on demand or in background. _Data:_ independently decodable `pages/<id>` parts _Test:_ 20-page, 400k-node fixture: time-to-interactive on page 1 ≤ the M8 budget; navigating to page 20 shows progress and never blocks input > 100 ms. _M8·P1·[API][ILL]_
- [ ] **IO-015** OS integration — `.illigma` is registered with the OS; double-click/drag-onto-dock opens the file; recent files list updates. _Data:_ UTI/MIME `application/vnd.illigma` (proposed) _Test:_ install build, double-click a file in Finder/Explorer → opens in a new window. _M1·P1·[ILL]_
- [ ] **IO-016** Read-only open — Files that cannot be written (permissions, newer minor with write disabled, locked by another machine) open read-only with a banner and "Save a copy…". _Data:_ — _Test:_ `chmod 444` file → opens read-only; edits disabled; Save a copy works. _M1·P2·[ILL]_

### 6.2 Lossless round-trip of the data model

- [ ] **IO-017** Document fields round-trip — Name, `documentColorProfile` (`LEGACY`, `SRGB`, `DISPLAY_P3`), page order, local style order and folders, document plugin/shared/relaunch data survive round-trip exactly. _Data:_ `DocumentNode`, `documentColorProfile`, `moveLocal*FolderAfter` order _Test:_ round-trip fixture with each profile value and 3 style folders → model dump equal. _M0·P0·[API]_
- [ ] **IO-018** Page fields round-trip — `backgrounds`, `prototypeBackgrounds`, ordered `flowStartingPoints`, `guides`, page export settings and measurements survive; `isPageDivider` is derived from name/children rules, not stored. _Data:_ `PageNode.*`, REST `CanvasNode.*` _Test:_ round-trip; rename a divider page "---" with no children → still divider after reopen; add a child → not divider. _M1·P0·[API]_
- [ ] **IO-019** Numeric precision — All geometric and numeric properties are stored at float64 without rounding; values such as `x = 0.1 + 0.2`, rotation 33.333…°, flips (negative scale) and tiny sizes (0.01) survive bit-for-bit. _Data:_ `relativeTransform`, `width`, `height`, radii, weights _Test:_ set values via scripting, round-trip, compare IEEE-754 bits. _M0·P0·[API][ILL]_
- [ ] **IO-020** Node-type coverage — Every Figma Design node type (`FRAME, GROUP, SECTION, COMPONENT, COMPONENT_SET, INSTANCE, SLOT, BOOLEAN_OPERATION, VECTOR, STAR, LINE, ELLIPSE, POLYGON, RECTANGLE, TEXT, TEXT_PATH, TRANSFORM_GROUP, SLICE`) round-trips type and all of its mixin fields. _Data:_ `SceneNode` union _Test:_ per-type fixture with every field set to a non-default value; round-trip → dump equal (enabled per milestone as types land). _M0·P0·[API]_
- [ ] **IO-021** Foreign node types preserved — FigJam/Slides/Widget types arriving via import (`STICKY, CONNECTOR, SHAPE_WITH_TEXT, CODE_BLOCK, STAMP, WIDGET, EMBED, LINK_UNFURL, MEDIA, HIGHLIGHT, WASHI_TAPE, TABLE, TABLE_CELL, SLIDE, SLIDE_ROW, SLIDE_GRID, INTERACTIVE_SLIDE_ELEMENT`) are stored opaquely, rendered from cached geometry or a labeled placeholder, locked from editing, and re-exported unchanged to canonical JSON. _Data:_ opaque `foreign` record _Test:_ REST JSON fixture containing a STICKY and a TABLE → import, save, reopen, canonical export contains identical source JSON. _M8·P2·[API][ILL]_
- [ ] **IO-022** Paint round-trip — All paint types and fields survive: SOLID; `GRADIENT_LINEAR/RADIAL/ANGULAR/DIAMOND` (transform, stops incl. per-stop alpha); `IMAGE` (`scaleMode FILL/FIT/CROP/TILE`, `imageTransform`, `scalingFactor`, `rotation` in 90° steps, `filters` −1…+1); `VIDEO`; `PATTERN` (source, tile type, scale, spacing, alignment); `SHADER`; plus `visible`, `opacity`, `blendMode`, paint `boundVariables`. _Data:_ `Paint` union, `ImageFilters` _Test:_ one layer per paint variant with non-default values → round-trip dump equal; renders equal. _M2·P0·[API]_
- [ ] **IO-023** Effect round-trip — `DROP_SHADOW`/`INNER_SHADOW` (offset, radius, spread, color, blend, show-behind), `LAYER_BLUR`/`BACKGROUND_BLUR` (normal and progressive), `NOISE` (mono/duo/multi), `TEXTURE`, `GLASS`, `SHADER`, effect styles and effect variable bindings survive. _Data:_ `Effect` union _Test:_ fixture with each effect type → round-trip dump & render equal. _M2·P0·[API]_
- [ ] **IO-024** Stroke round-trip — Stroke paints, weight, per-side weights, align, cap, join, miter limit, dash pattern, complex/variable-width stroke data and per-vertex caps survive. _Data:_ `MinimalStrokesMixin`, `IndividualStrokesMixin`, `ComplexStrokesMixin`, `VectorVertex.strokeCap` _Test:_ fixture → round-trip dump & render equal. _M2·P0·[API]_
- [ ] **IO-025** Vector-network topology — Vertices, segments (with tangents), regions (loops, per-region fills and winding), handle mirroring and per-vertex corner radius are stored as a network, never flattened to paths. _Data:_ `vectorNetwork`, `vectorPaths`, `handleMirroring`, `WindingRule` _Test:_ network with a 3-way branch vertex and two filled regions → round-trip → identical vertex/segment/region counts and indices. _M2·P0·[API]_
- [ ] **IO-026** Text round-trip — `characters` (emoji incl. ZWJ sequences, CJK, RTL, combining marks, surrogate pairs), every styled range (font, variation settings, size, line height, letter spacing, decoration, case, OpenType features, fills, hyperlinks, list type/indent), text style ids per range, auto-resize/truncation/max-lines, `autoRename` survive. _Data:_ `TextNode`, `getStyledTextSegments` fields _Test:_ fixture with 30 ranges → round-trip → identical segments; caret positions identical in all scripts. _M3·P0·[API]_
- [ ] **IO-027** Layout round-trip — Constraints, auto layout (flex and grid) container and child fields, min/max, absolute positioning, and the per-node layout-engine version flag survive; renders identical. _Data:_ `AutoLayoutMixin`, `GridLayoutMixin`, child mixins, layout version flag _Test:_ fixture with nested wrap + grid layouts in both "Updated" and legacy mode → round-trip → layout results bit-identical. _M4·P0·[API][OBS]_
- [ ] **IO-028** Layout grids & guides round-trip — Frame layout grids (all kinds), grid styles, variables bound to grid fields, and page/frame guides survive. _Data:_ `layoutGrids`, `gridStyleId`, `Guide` _Test:_ fixture → round-trip dump equal. _M4·P0·[API]_
- [ ] **IO-029** Component definitions round-trip — Component property definitions (`BOOLEAN`, `TEXT`, `INSTANCE_SWAP` with preferred values, `VARIANT`, `SLOT`), variant properties, descriptions (plain and markdown), documentation links and keys survive. _Data:_ `ComponentPropertiesMixin`, `PublishableMixin` _Test:_ component set with all property kinds → round-trip dump equal. _M5·P0·[API]_
- [ ] **IO-030** Instance round-trip — Main-component reference, component property values, nested-sublayer overrides keyed by stable sublayer ids, exposed instances and slot contents survive; resolved instance trees after reopen equal those before save. _Data:_ `InstanceNode`, overrides, `componentProperties` _Test:_ 3-level nested instances with overrides at each level → round-trip → resolved trees and renders equal. _M5·P0·[API][KNOW]_
- [ ] **IO-031** Style round-trip — Paint, text, effect, grid and custom-animation styles (incl. styles whose values are variable-bound) and all node/range references to them survive. _Data:_ `StyleType`, `*StyleId` _Test:_ fixture → round-trip dump equal. _M6·P0·[API]_
- [ ] **IO-032** Variables round-trip — Collections (modes, default mode, hidden flag), extended collections (parent link + overrides), variables of all six resolved types with `valuesByMode`, aliases, composed colors, scopes, code syntax (`WEB`, `ANDROID`, `iOS`), descriptions, and explicit modes on nodes survive. _Data:_ `VariableCollection`, `ExtendedVariableCollection`, `Variable`, `VariableAlias`, `VariableComposedColor` _Test:_ fixture with 2 collections × 3 modes + an extension → round-trip → dump equal; resolved values per node equal. _M6·P0·[API]_
- [ ] **IO-033** Prototype data round-trip — Reactions (every trigger and action type incl. conditional blocks, set-variable, set-mode, media runtime), transitions and easings, overflow direction, fixed-children count, overlay settings, flows and prototype device/backgrounds survive. _Data:_ `ReactionMixin`, `FramePrototypingMixin`, `flowStartingPoints` _Test:_ fixture → round-trip → dump equal; presentation of both versions produces identical navigation traces. _M7·P0·[API]_
- [ ] **IO-034** Motion data round-trip — Applied animation styles (`FIGMA`/`CUSTOM`), manual keyframe tracks and timeline durations survive. _Data:_ `MotionNodeMixin` _Test:_ fixture → round-trip dump equal. _M7·P1·[API]_
- [ ] **IO-035** Dev data round-trip — Annotations (incl. categories and properties), measurements, dev status, dev resources survive. _Data:_ `AnnotationsMixin`, `MeasurementsMixin`, `DevStatusMixin`, `DevResource` _Test:_ fixture → round-trip dump equal. _M8·P1·[API]_
- [ ] **IO-036** Plugin data round-trip & limits — Private and shared plugin data on document, pages, nodes, styles, variables and collections survive; writes are rejected when an entry (id/namespace + key + value) exceeds 100 kB or a namespace is shorter than 3 alphanumeric characters. _Data:_ `PluginDataMixin` _Test:_ write 100 kB entry → OK and survives; 100 kB + 1 byte → rejected; namespace "ab" → rejected. _M8·P1·[API]_
- [ ] **IO-037** Export settings round-trip — Every field of every stored export-setting variant (§2.6) survives, including explicit non-defaults (`contentsOnly:false`, `useAbsoluteBounds:true`, `colorProfile:'DISPLAY_P3_V4'`, SVG flags, quality, resampling) and row order. _Data:_ `exportSettings` _Test:_ node with 6 rows of mixed formats → round-trip dump equal. _M2·P0·[API]_
- [ ] **IO-038** Masks & booleans round-trip — `isMask`, `maskType` (`ALPHA`, `VECTOR`, `LUMINANCE`), mask ordering, boolean operation type and operands survive. _Data:_ `BlendMixin.isMask/maskType`, `BooleanOperationNode` _Test:_ fixture → round-trip render & dump equal. _M2·P0·[API]_
- [ ] **IO-039** Newer node kinds round-trip — `TRANSFORM_GROUP` with linear/radial repeat modifiers and `TEXT_PATH` survive. _Data:_ `transformModifiers`, `TextPathNode` _Test:_ fixture → round-trip dump equal. _M2·P2·[API]_
- [ ] **IO-040** Numeric hygiene — NaN/±Infinity are never written (rejected at the mutation boundary with an error); −0 is normalized to 0; integers outside safe range rejected. _Data:_ all numeric fields _Test:_ attempt to set `width = NaN` via scripting → error, document unchanged. _M0·P0·[ILL]_

### 6.3 Identity, references & ordering

- [ ] **IO-041** Stable node IDs — Node ids are preserved exactly across save/open and never reused for new nodes within the file's lifetime, even after deletion and reopen. _Data:_ `id` (`sessionID:localID` form) _Test:_ create node (id A), delete, save, reopen, create 10,000 nodes → none has id A. _M0·P0·[API][SRC:registry.npmjs.org/fig-kiwi][KNOW]_
- [ ] **IO-042** Child order persistence — Back-to-front child order (first = bottom) survives any sequence of reorders with no drift or precision exhaustion. _Data:_ `children` order (fractional indices) _Test:_ 10,000 random reorders/inserts between the same two siblings, save, reopen → order equals in-memory order. _M0·P0·[API]_
- [ ] **IO-043** Dangling references preserved — References to missing styles, variables, components, pattern sources or prototype destinations are kept (not dropped) and flagged in the UI; nothing crashes. _Data:_ `*StyleId`, `VariableAlias.id`, main component ref, `sourceNodeId`, `destinationId` _Test:_ fixture with one dangling ref of each kind → opens; a "Problems" list shows 5 entries; re-save keeps them. _M0·P1·[ILL]_
- [ ] **IO-044** Alias-cycle safety — Creating a variable alias that would form a cycle is rejected at write time; a file containing a cycle opens, flags all variables in the cycle as unresolved, and renders with fallback values. _Data:_ `VariableAlias` _Test:_ A→B→A attempt rejected; fixture with cycle opens with 2 flagged variables. _M6·P1·[ILL][SRC:github.com/design-tokens/community-group aliases.md]_
- [ ] **IO-045** Reference remapping on duplicate/paste — Duplicating or pasting a set of nodes remaps internal references within the set (prototype destinations, pattern sources, component property references) to the new copies, and keeps references to nodes outside the set pointing at the originals. _Data:_ `destinationId`, `sourceNodeId`, `componentPropertyReferences` _Test:_ copy two frames A→B linked by a prototype connection; paste → the pasted A' links to B', not B; compare with Figma (§8 V-21). _M1·P0·[KNOW][ILL]_
- [ ] **IO-046** Stable instance-sublayer identity — Overrides inside instances are keyed by stable sublayer identities (compound ids such as `I<instance>;<sublayer>`), so they survive save/open, main-component edits that don't remove the sublayer, and re-resolution. _Data:_ instance sublayer ids, override table _Test:_ override text in a nested instance; edit main (add sibling layer); save/reopen → override still applied to the same sublayer. _M5·P0·[KNOW]_
- [ ] **IO-047** Publish keys — Publishable assets have keys that are stable for the life of the file and unique across files; "Save a copy" assigns new keys. _Data:_ `key` on components, sets, styles, variables, collections _Test:_ publish, save, reopen → keys equal; save a copy → all keys differ from original. _M6·P1·[API][DOC:8403626871063 excerpt][ILL]_

### 6.4 Save model, autosave, recovery & concurrency

- [ ] **IO-048** No-save-needed durability — Every committed change is durable (journaled) within ≤ 1 s, so the user never needs to save to avoid loss (parity of experience with Figma's continuous saving). _Data:_ `journal` _Test:_ make an edit, wait 1 s, `kill -9` → relaunch recovers the edit. _M0·P0·[ILL][DOC:360040328553 excerpt]_
- [ ] **IO-049** Incremental autosave cost — Autosave writes only changed parts; a one-node edit in a 200 MB file causes < 1 MB of writes and no main-thread stall > 16 ms. _Data:_ part-level dirty tracking _Test:_ instrumented build: measure bytes written and frame times during autosave on the 200 MB fixture. _M8·P1·[ILL]_
- [ ] **IO-050** Crash recovery banner — After an unclean exit, reopening replays the journal and shows a non-blocking "Recovered N unsaved changes" banner with Keep (default) / Discard; recovered changes form one non-undoable baseline. _Data:_ `journal.baseRevision` _Test:_ crash with 25 journaled edits → banner N=25; Discard → last compacted state; Keep → 25 edits present, Undo does not undo them individually. _M0·P0·[ILL]_
- [ ] **IO-051** Journal/base mismatch safety — A journal whose base revision doesn't match the file (file replaced externally) is never applied; it is kept aside as a recovery file and the user is told. _Data:_ `journal.baseRevision` vs `manifest.revision` _Test:_ crash, replace file with an older copy, reopen → no replay; recovery file listed in Recover…. _M0·P0·[ILL]_
- [ ] **IO-052** Explicit Save — ⌘S/Ctrl+S on a named file flushes immediately and shows a transient confirmation without a dialog; on an untitled document it shows a Save dialog. _Data:_ — _Test:_ ⌘S → toast within 200 ms, file mtime updated; untitled → dialog; compare Figma's ⌘S feedback (§8 V-25). _M1·P0·[ILL][KNOW]_
- [ ] **IO-053** Untitled documents are safe — New documents are autosaved to an app-managed location before first Save and appear in Recover…/Open Recent after a crash. _Data:_ app "Unsaved documents" folder _Test:_ create untitled doc, edit, kill → relaunch offers it. _M1·P0·[ILL]_
- [ ] **IO-054** Quit/close with pending changes — Closing flushes; only if the flush fails a modal offers Retry / Save a copy… / Close and keep recovery data (analog of Figma's unsynced-changes prompt; Illigma never offers a silent discard). _Data:_ — _Test:_ make the target directory read-only, edit, quit → modal; choose keep → recovery data present on relaunch. _M0·P0·[DOC:360040328553 excerpt][ILL]_
- [ ] **IO-055** Save a copy — "Save a copy…" writes a new file (new `fileId`, new publish keys) with options *Include version history* (default on), *Include comments* (default on), *Embed fonts* (default off); the original stays open, unchanged, and remains the active file. _Data:_ manifest, history, fonts _Test:_ save copy with history off → copy has 0 versions; original unchanged and still focused. _M1·P1·[DOC:8403626871063 excerpt][ILL]_
- [ ] **IO-056** Single writer per file — Opening a file already open for writing focuses its window instead of opening a second writer. _Data:_ advisory lock + heartbeat _Test:_ open same path twice (also via a symlink) → one window. _M1·P0·[ILL]_
- [ ] **IO-057** Foreign lock handling — A lock held by another process/machine offers Open read-only / Open a copy / Take over; locks without heartbeat for ≥ 5 min are treated as stale. _Data:_ lock file with host, pid, heartbeat _Test:_ simulate lock from host B (fresh) → three options; stale lock → takes over with notice. _M1·P1·[ILL]_
- [ ] **IO-058** External modification detection — If the file changes on disk by another writer, a banner offers Reload / Keep mine (saves my state as a copy); never silently overwrites. _Data:_ content hash + mtime _Test:_ modify file externally while open → banner within 2 s; choose Keep mine → copy created, original untouched. _M1·P1·[ILL]_
- [ ] **IO-059** Save and undo are independent — Saving or autosaving never changes the undo stack; reopening a file starts with an empty undo stack. _Data:_ — _Test:_ 10 edits, ⌘S, Undo ×10 → all reverted; quit/reopen → Undo disabled. _M0·P0·[KNOW]_
- [ ] **IO-060** Disk errors — Disk full / permission / removable-media errors surface within 1 s, editing continues in memory + journal (if possible), and saving retries with back-off; no data loss on recovery of the disk. _Data:_ — _Test:_ fill disk during autosave → error banner; free space → next autosave succeeds; content complete. _M0·P0·[ILL]_
- [ ] **IO-061** File moved/renamed while open — Continue saving to the file's new location (OS file reference) or, if unresolvable, prompt for a location; never write a stray file at the old path. _Data:_ OS bookmark / file id _Test:_ rename the open file in Finder, edit → saves land in the renamed file. _M1·P2·[ILL]_

### 6.5 Version history

- [ ] **IO-062** Autosave checkpoints — An automatic version is created when ≥ 30 min have passed since the last checkpoint and changes exist; no checkpoint when nothing changed. _Data:_ `Version{kind:AUTO, created_at, label:null, author}` _Test:_ with a fake clock: edit at t=0, t=31 min → 1 checkpoint; idle 2 h → no new checkpoint. _M8·P1·[DOC:360038006754 excerpt]_
- [ ] **IO-063** Save to version history — ⌥⌘S opens a dialog with Title (required; whitespace-only invalid) and Description (optional); confirming creates a named version capturing the current state. _Data:_ `saveVersionHistoryAsync(title, description?)`, `Version.label/description` _Test:_ empty title → Save disabled; "v1" + description → entry appears first in list with both fields. _M8·P1·[API][KNOW]_
- [ ] **IO-064** Name an autosave — Any autosave checkpoint can be given a title/description later; editing info doesn't change its content or timestamp. _Data:_ `Version.label`, `description` _Test:_ name a 2-day-old checkpoint → label shown; content hash unchanged. _M8·P1·[DOC:360038006754 excerpt]_
- [ ] **IO-065** Version preview — Selecting a version shows it read-only in the viewport (all pages navigable); editing tools are disabled; leaving preview returns to the current state unchanged. _Data:_ snapshot view _Test:_ preview an old version, attempt to move a layer → blocked; exit → current revision unchanged. _M8·P1·[DOC:360038006754 excerpt]_
- [ ] **IO-066** Restore is non-destructive — "Restore this version" adds two checkpoints (before-restore state and restored state), sets the document to the version's content, and keeps the pre-restore state reachable in history; one Undo returns to the pre-restore state. _Data:_ two `Version{kind:AUTO}` entries _Test:_ restore v3 → list gains 2 entries; document equals v3; Undo → equals pre-restore. (Undo behavior in Figma: §8 V-08.) _M8·P1·[DOC:360038006754 excerpt][ILL]_
- [ ] **IO-067** Restore and comments — Restoring keeps comments created after the restored version and does not resurrect deleted comments (applies when local comments exist). _Data:_ comments store _Test:_ create comment after v2, delete another, restore v2 → newer comment remains; deleted stays deleted. _M8·P2·[DOC:360038006754 excerpt]_
- [ ] **IO-068** Duplicate a version — "Duplicate" writes the version's snapshot as a new untitled document (new `fileId`, new keys, no history) and opens it. _Data:_ snapshot → new file _Test:_ duplicate v1 → new window; original unchanged. _M8·P2·[KNOW][ILL]_
- [ ] **IO-069** Version list behavior — Newest first; grouped by day; current version on top; lazy loading keeps the panel responsive with > 5,000 entries. _Data:_ `Version[]` _Test:_ fixture with 5,000 versions → panel opens < 300 ms, scrolls at 60 fps. _M8·P2·[API][ILL]_
- [ ] **IO-070** Retention policy — Named versions are never pruned automatically; autosaves follow a user-configurable thinning policy (default: keep all for 30 days, then one per day); no plan-based limits. _Data:_ retention settings _Test:_ fake clock 90 days of edits → named all present; autosaves thinned per policy. _M8·P2·[ILL][DOC:360038006754 excerpt]_
- [ ] **IO-071** History storage efficiency — Snapshots are stored as deltas with periodic keyframes; 1,000 checkpoints of a 50 MB document with small edits add < 50 MB. _Data:_ `history/` _Test:_ generate fixture → measure file size growth. _M8·P2·[ILL]_
- [ ] **IO-072** Open an earlier version when current fails — If the current state cannot be decoded, the user can open the newest decodable version (Figma offers opening an earlier version from the file browser). _Data:_ history snapshots _Test:_ corrupt the current document part → open offers "Open last good version" → succeeds. _M8·P1·[SRC:forum.figma.com memory/large-file threads, e.g. t/my-figma-file-is-not-loading/44391 — excerpt, per-thread attribution uncertain][ILL]_

### 6.6 Schema migration

- [ ] **IO-073** Ordered migrations — Files from every released `formatVersion` open via ordered, pure migrations and render identically to their recorded golden renders. _Data:_ `formatVersion`, migration registry _Test:_ CI opens one golden fixture per released version → render hashes equal stored goldens. _M0·P0·[ILL]_
- [ ] **IO-074** Pre-migration backup — Before first save after a migration, the original bytes are kept as a pre-migration snapshot in history until the user prunes it. _Data:_ `history/` entry kind `PRE_MIGRATION` _Test:_ open v1 fixture in v2 build, edit, save → history contains pre-migration snapshot; restoring it reproduces v1 content. _M0·P1·[ILL]_
- [ ] **IO-075** Behavior-version flags — Per-node/per-file behavior versions (e.g., auto layout "Updated" vs legacy) are persisted; app updates never change existing layouts until the user opts in; opting in is one undoable step. _Data:_ layout version flag [OBS] _Test:_ legacy-layout fixture opens with identical child positions in a newer build; "Update layout" changes positions; Undo restores them. _M4·P0·[OBS][ILL]_
- [ ] **IO-076** Legacy color profile preserved — `LEGACY` documents keep `LEGACY` until the user explicitly assigns/converts, rendering as the user's preferred profile or sRGB. _Data:_ `documentColorProfile:'LEGACY'` _Test:_ open LEGACY fixture → renders like sRGB; save → still LEGACY. _M2·P1·[API][DOC:360039825114 excerpt]_

### 6.7 Large-file handling

- [ ] **IO-077** Memory budget indicator — A memory meter warns at 75 % of the configured budget and offers remedies (find large images, find hidden layers, split page to new file). _Data:_ runtime memory accounting _Test:_ load images until 75 % → warning appears once with the three actions; each action works. _M8·P1·[SRC:forum.figma.com memory threads, e.g. clarification-on-figmas-memory-usage-13811 — excerpt][ILL]_
- [ ] **IO-078** On-demand page decode — Pages not yet decoded show a progress state on navigation; the UI stays responsive (no input stall > 100 ms). _Data:_ lazy `pages/<id>` _Test:_ 20-page fixture: jump to unloaded page while typing in a text layer on page 1 → no dropped keystrokes. _M8·P1·[API][ILL]_
- [ ] **IO-079** Lazy image decode at needed resolution — Images decode at the mip level needed for the current zoom; a document with 500 distinct 4096² images opens within the memory budget. _Data:_ asset mip cache (derived) _Test:_ open the 500-image fixture at 10 % zoom → resident image memory ≤ budget; zoom into one image → full-res decoded. _M8·P1·[ILL]_
- [ ] **IO-080** Invisible-instance-children cost — Search, select-matching and export traversals can skip invisible instance children, matching the performance intent of Figma's `skipInvisibleInstanceChildren`. _Data:_ traversal option _Test:_ fixture with 50k invisible instance children → "find text" completes ≥ 5× faster with skipping, same visible results. _M8·P2·[API]_
- [ ] **IO-081** Scale fixtures — 100k, 500k and 1M-node fixtures open, pan/zoom, edit and autosave within the M8 performance budgets. _Data:_ generated fixtures _Test:_ automated perf suite reports all metrics under budget on reference hardware. _M8·P1·[ILL]_

### 6.8 Local libraries & cross-file assets

- [ ] **IO-082** Publish snapshot — Publishing a library file snapshots all publishable assets not marked hidden from publishing, increments `libraryVersion`, and records key, name, description and content hash per asset; publishing with no changes reports "No changes". _Data:_ library manifest, `hiddenFromPublishing`, `key` _Test:_ publish 10 components + 1 hidden → manifest lists 10; publish again unchanged → "No changes", version unchanged. _M6·P1·[API][ILL]_
- [ ] **IO-083** Remote assets render without the library — Inserting a library component/style/variable copies the published snapshot into the consumer (`remote: true`); the consumer renders identically when the library file is absent. _Data:_ `shared.remote[]`, `remote` _Test:_ insert instance, close, move library away, reopen consumer → render hash unchanged. _M6·P0·[API][KNOW]_
- [ ] **IO-084** Library updates review — When a newer `libraryVersion` is found on open, the consumer shows "Library updates available"; the review lists changed assets with before/after previews; accept all or individually; overrides preserved per component rules. _Data:_ `libraryRefs.subscribedVersion` _Test:_ change a library button color, publish, open consumer → update listed; accept → instances updated with text overrides intact. _M6·P1·[DOC:360039234193 title][ILL]_
- [ ] **IO-085** Missing library — If a library cannot be located, cached copies keep working, the library is shown as Missing with Relink…; no data is dropped. _Data:_ `libraryRefs.lastKnownPath` _Test:_ delete library file → consumer opens; instances render; Relink to a copy with the same `fileId` restores update checks. _M6·P1·[ILL]_
- [ ] **IO-086** Library relocation — Libraries are resolved by `fileId` via last path, configured library folders and recent files, so moving/renaming library files does not break links. _Data:_ `fileId` _Test:_ rename + move library into a configured folder → consumer finds it automatically. _M6·P1·[ILL]_
- [ ] **IO-087** Remote assets are read-only in consumers — Remote mains/styles/variables cannot be edited in the consuming file; "Go to main component" opens the library file at the node (or explains it's missing). _Data:_ `remote:true` _Test:_ try to edit remote main → blocked with explanation; Go to main → library window focused on node. _M6·P1·[API][KNOW]_
- [ ] **IO-088** Swap library — Swapping library A for B remaps instances/styles/variables by matching key lineage or name path, reporting unmatched assets. _Data:_ keys, names _Test:_ two libraries with same component names → swap → all instances point to B; 1 unmatched reported. _M6·P2·[DOC:4404856784663 title][KNOW]_
- [ ] **IO-089** Private-by-name assets — Components/styles whose names start with `.` or `_` are excluded from publishing (Figma convention — verify). _Data:_ asset names _Test:_ publish library with `_Base` and `.internal` components → excluded; compare with Figma (§8 V-30). _M6·P2·[KNOW]_
- [ ] **IO-090** Remote variables & modes offline — Consumers store remote collections with all modes and values, so mode switching and alias resolution work without the library file. _Data:_ remote `VariableCollection`/`Variable` copies _Test:_ apply a library variable with 3 modes, remove library, switch frame mode → values change correctly. _M6·P0·[API][ILL]_
- [ ] **IO-091** Copy-of-library semantics — A "Save a copy" of a library is a new library (new keys); existing consumers remain linked to the original, mirroring Figma's re-import behavior. _Data:_ `fileId`, `key` _Test:_ copy library, publish copy → consumer still lists original as its library. _M6·P1·[DOC:8403626871063 excerpt][ILL]_

### 6.9 Raster & video import

- [ ] **IO-092** Accepted media formats — PNG, JPG, GIF, WebP, HEIC and TIFF images and MP4, MOV, WebM videos import; detection is by content (wrong extensions still work); unsupported files produce an error and create no node. _Data:_ media sniffing _Test:_ import each format (+ a PNG renamed `.jpg`, + a `.bmp`) → 9 successes, 1 error, no partial node. _M2·P0·[DOC:360040028034 excerpt][ILL]_
- [ ] **IO-093** 4096 px cap — Images wider or taller than 4096 px are downscaled proportionally so the longest side is ≤ 4096 px before storage; the stored asset reports the new pixel size. _Data:_ asset `{w,h}` _Test:_ import 8000×3000 → asset 4096×1536; compare Figma's resulting layer size and pixel size (§8 V-11). _M2·P0·[DOC:360040028034 excerpt][API]_
- [ ] **IO-094** Cap boundary — 4096×4096 is not resampled; 4097×10 is resampled to 4096×(rounding per Figma, §8 V-11). _Data:_ — _Test:_ import both → first byte-identical to source, second resized. _M2·P0·[DOC:360040028034 excerpt]_
- [ ] **IO-095** EXIF orientation — JPEG/HEIC orientation metadata is applied so imported photos appear upright, matching Figma. _Data:_ EXIF `Orientation` _Test:_ import 8 orientation fixtures → match Figma's renders (§8 V-11). _M2·P1·[KNOW]_
- [ ] **IO-096** Animated GIF — Animated GIFs keep all frames; the canvas shows a static frame; prototypes play the animation. _Data:_ asset `animated:true` (REST `gifRef` equivalent) _Test:_ import 10-frame GIF → canvas static; presentation animates; round-trip keeps frames. _M7·P1·[API][DOC:360041486873 title]_
- [ ] **IO-097** Video limits — Videos up to 100 MB import as video paints; larger files are rejected with a message stating the limit. _Data:_ `VideoPaint`, `Video.hash` _Test:_ 99 MB MP4 imports; 101 MB rejected. _M7·P1·[API]_
- [ ] **IO-098** Import-time dedupe — Importing/pasting/dropping the same bytes repeatedly reuses the existing asset hash. _Data:_ `imageHash` _Test:_ drop same file 3× and paste it once → one asset. _M2·P0·[API]_
- [ ] **IO-099** Image color profiles — Embedded ICC profiles are recorded; tagged sRGB/P3/other images are converted to the document profile for display and export, matching Figma's observed handling (Figma reportedly maps P3-tagged images to sRGB — verify and match). _Data:_ asset `profile` _Test:_ import P3-tagged red PNG into sRGB and P3 docs → compare rendered pixel values with Figma (§8 V-23). _M2·P1·[SRC:forum.figma.com problem-with-managing-image-colour-profiles-34569 excerpt][ILL]_
- [ ] **IO-100** Import is one undo step — Any single import action (one or many files) is one undo step; undo removes created layers and leaves no visible trace. _Data:_ — _Test:_ drop 5 images at once → Undo once → all 5 gone; Redo → back with same hashes. _M2·P0·[KNOW]_
- [ ] **IO-101** Bulk import — Selecting/dropping many media files imports all of them with deterministic order and placement (placement rules per PE); failures for individual files are listed without aborting the rest. _Data:_ — _Test:_ drop 20 files incl. 2 corrupt → 18 layers + report of 2 failures; compare arrangement with Figma (§8 V-12). _M2·P1·[DOC:360041089973 excerpt][KNOW]_
- [ ] **IO-102** Decode guard — Pathological images (e.g., 30,000×30,000 PNG, decompression bombs) are handled by streaming downscale or rejected with a message, without exhausting memory. _Data:_ — _Test:_ import a 30k² PNG on an 8 GB machine → succeeds as 4096² or clean rejection; RSS never exceeds budget. _M8·P0·[ILL]_

### 6.10 SVG import

- [ ] **IO-103** Root frame — An imported/pasted SVG becomes one top-level `FRAME` sized from `width`/`height` (else `viewBox`), containing the converted elements; name and clip settings match Figma. _Data:_ `createNodeFromSvg` → `FrameNode` _Test:_ import `<svg width="120" height="80" viewBox="0 0 24 16">` → frame 120×80 with content scaled 5×; compare name/clip with Figma (§8 V-10). _M8·P0·[API][KNOW]_
- [ ] **IO-104** Missing size attributes — An SVG with neither `viewBox` nor `width`/`height` imports exactly as Figma does (reportedly tiny) and never produces a 0-size or invalid frame. _Data:_ — _Test:_ import such a file in both apps → equal frame size. _M8·P1·[SRC:forum.figma.com (SVG threads) excerpt][KNOW]_
- [ ] **IO-105** Groups — `<g>` becomes `GROUP` with children in document order (first element = bottom); group-level attributes (opacity, transform, inherited fill/stroke) apply; layer names follow Figma's rule (id attribute vs element name — verify). _Data:_ `GroupNode` _Test:_ nested-group fixture → identical layer tree & names vs Figma. _M8·P0·[KNOW]_
- [ ] **IO-106** Paths — `<path>`, `<polygon>`, `<polyline>` become `VECTOR`; all path commands incl. arcs (`A`) convert to cubic Béziers within 0.01 px; `fill-rule="evenodd"` sets `EVENODD`, otherwise `NONZERO`. _Data:_ `VectorNode`, `windingRule` _Test:_ path fixture set (arcs, smooth curves, relative commands, implicit repeats) → outlines equal Figma's within 0.01 px. _M8·P0·[API][KNOW]_
- [ ] **IO-107** Primitive elements — `<rect>` (incl. `rx`/`ry`), `<circle>`, `<ellipse>`, `<line>` produce the same node types and properties as Figma (primitive node vs vector — verify). _Data:_ `RectangleNode`, `EllipseNode`, `LineNode`, `VectorNode` _Test:_ fixture → node types equal Figma's. _M8·P1·[KNOW]_
- [ ] **IO-108** Gradients — `<linearGradient>`/`<radialGradient>` (both `gradientUnits`, `gradientTransform`, stop opacity, `href` inheritance) map to `GRADIENT_LINEAR`/`GRADIENT_RADIAL` paints with matching geometry; unsupported spread methods are approximated like Figma. _Data:_ `GradientPaint` _Test:_ gradient fixture → render ΔE00 ≤ 1 vs Figma import. _M8·P0·[KNOW]_
- [ ] **IO-109** Stroke attributes — `stroke-width`, `-linecap`, `-linejoin`, `-miterlimit`, `-dasharray` (odd-length lists repeated per SVG rules), `-dashoffset` map to stroke properties with center alignment. _Data:_ `strokeWeight, strokeCap, strokeJoin, strokeMiterLimit, dashPattern, strokeAlign` _Test:_ fixture → properties equal Figma's import. _M8·P1·[KNOW]_
- [ ] **IO-110** Opacity mapping — `opacity` → node opacity; `fill-opacity`/`stroke-opacity`/stop-opacity → paint or stop alpha; `rgba()`/`#RRGGBBAA` alpha handled like Figma. _Data:_ `opacity`, paint `opacity`, color alpha _Test:_ fixture → values equal Figma's import. _M8·P0·[KNOW]_
- [ ] **IO-111** Transforms — Nested `transform` lists (matrix/translate/scale/rotate/skewX/skewY) produce the same final geometry; rotation is kept on shape nodes where Figma keeps it; skew is baked into geometry. _Data:_ `relativeTransform` _Test:_ fixture → absolute bounding boxes and rotations equal Figma's within 0.01. _M8·P0·[KNOW]_
- [ ] **IO-112** clipPath — `<clipPath>` usage imports exactly as Figma does today (mask group vs dropped — conflicting evidence). _Data:_ `isMask`, `maskType` _Test:_ clipPath fixture in both apps → same layer structure & render. _M8·P1·[SRC:forum.figma.com (SVG threads) excerpt][KNOW]_
- [ ] **IO-113** mask element — `<mask>` imports as Figma does (luminance/alpha mask vs dropped). _Data:_ `maskType` _Test:_ mask fixture comparison with Figma. _M8·P2·[KNOW]_
- [ ] **IO-114** Unsupported pattern & marker — `<pattern>` and `<marker>` are not imported; the remainder of the SVG imports normally and the user gets a non-blocking notice. _Data:_ — _Test:_ SVG with a patterned rect and an arrow marker → rect without pattern fill, line without marker; everything else matches Figma. _M8·P0·[DOC:360040030374 excerpt]_
- [ ] **IO-115** symbol/use/defs — Elements referenced via `<use>`/`<symbol>`/`<defs>` import exactly as Figma does (reportedly not imported). _Data:_ — _Test:_ icon-sprite SVG with `<use href="#a">` → same result as Figma. _M8·P1·[SRC:forum.figma.com (SVG threads) excerpt]_
- [ ] **IO-116** Text elements — `<text>`/`<tspan>` import like Figma (editable TEXT with mapped font props vs dropped); fonts not installed enter missing-font state. _Data:_ `TextNode`, `FontName` _Test:_ fixture with two fonts (one missing) → same result as Figma. _M8·P1·[KNOW]_
- [ ] **IO-117** Embedded images — `<image>` with a data URI becomes a rectangle with an `IMAGE` fill via the raster pipeline; external URLs are never fetched (left empty/placeholder). _Data:_ `ImagePaint` _Test:_ data-URI PNG → image fill; `https://` href → no network request recorded. _M8·P1·[KNOW][ILL]_
- [ ] **IO-118** Filters — `feGaussianBlur` and the filter chains Figma emits for drop/inner shadows map back to `LAYER_BLUR`/`DROP_SHADOW`/`INNER_SHADOW` like Figma; other filters are dropped. _Data:_ `Effect` _Test:_ export a shadowed rectangle from Figma as SVG, import in both apps → identical effects. _M8·P1·[KNOW]_
- [ ] **IO-119** CSS styling — Presentation attributes, inline `style`, and (if Figma supports it) `<style>` class rules resolve with correct precedence. _Data:_ — _Test:_ fixture using all three → colors equal Figma's import. _M8·P2·[KNOW]_
- [ ] **IO-120** Units, keywords and colors — Absolute units convert at 96 px/in; `%` resolves against the viewport; named colors, `currentColor`, `transparent`, `none`, `inherit` resolve like Figma. _Data:_ — _Test:_ fixture with mm/pt/%, `rebeccapurple`, `currentColor` → sizes/colors equal Figma's. _M8·P2·[KNOW]_
- [ ] **IO-121** Paste SVG markup — Pasting SVG source text (from a text editor or another design tool) imports it exactly like the file import; "Paste here" places it at the cursor. _Data:_ clipboard `text/plain` / `image/svg+xml` _Test:_ copy SVG text, paste in Illigma and Figma → same layer tree. _M8·P0·[DOC:360040030374 excerpt]_
- [ ] **IO-122** Figma-SVG round-trip — Re-importing an SVG exported by Figma (with ids on) reproduces Figma's own re-import result (same node types, names, geometry within 0.01 px). _Data:_ — _Test:_ 20 Figma-exported fixture SVGs → structural diff vs Figma re-import = 0. _M8·P1·[ILL]_
- [ ] **IO-123** Hostile SVG safety — External entities, DTD fetching, billion-laughs, 1M-element files and scripts are rejected or neutralized; no network access; no hang > 5 s. _Data:_ parser limits _Test:_ security fixture suite → all rejected/limited, app responsive. _M8·P0·[ILL]_
- [ ] **IO-124** SVG import undo — One SVG import or paste is one undo step. _Data:_ — _Test:_ import → Undo → document identical to before (hash). _M8·P0·[KNOW]_

### 6.11 Export pipeline, PNG & JPG

- [ ] **IO-125** Default export — Exporting a node with no stored settings (API default) produces PNG at 1×. _Data:_ `exportAsync()` default _Test:_ scripted export without settings → PNG with node's pixel size. _M2·P0·[API]_
- [ ] **IO-126** Ignore overlapping layers — With `contentsOnly:true` (default) only the node's subtree is rendered; with `false` all visible layers overlapping its bounds are rendered in z-order; the setting has no effect for nodes not inside a frame/group. _Data:_ `contentsOnly` _Test:_ rect inside frame with an overlapping sibling → true: sibling absent; false: present; top-level node: identical outputs. _M2·P0·[API][DOC:13402894554519 excerpt]_
- [ ] **IO-127** Include bounding box — With `useAbsoluteBounds:true` the export uses the node's full layout box even if content is cropped or empty (text exports uncropped); with `false` the visible render bounds are used. _Data:_ `useAbsoluteBounds` _Test:_ text layer 200×40 with short text → true: 200×40 px; false: tight bounds; both equal Figma (§8 V-14). _M2·P0·[API][DOC:13402894554519 excerpt]_
- [ ] **IO-128** Render bounds — Default export bounds include drop shadows, blurs and outside/center strokes, and respect clipping by clip-content ancestors, exactly as Figma computes them. _Data:_ `absoluteRenderBounds` _Test:_ rect 100×100 with 8 px outside stroke and 20 px blur shadow → output size equals Figma's. _M2·P0·[API][KNOW]_
- [ ] **IO-129** Size constraints & rounding — `SCALE k`, `WIDTH w`, `HEIGHT h` produce proportional output; fractional results round exactly as Figma does. _Data:_ `ExportSettingsConstraints` _Test:_ 10.5×7.25 node at 1×, 1.5×, 3× and `100w` → pixel sizes equal Figma's (§8 V-14). _M2·P0·[API][KNOW]_
- [ ] **IO-130** Scale input parsing — Accepts `0.5x`, `2x`, `512w`, `512h` and plain numbers like Figma; standard presets 0.5/0.75/1/1.5/2/3/4; out-of-range values clamp like Figma (REST range 0.01–4 as reference). _Data:_ `constraint.type/value` _Test:_ enter `5x`, `0x`, `-1x`, `abc` → outcomes equal Figma (§8 V-14). _M2·P0·[API][KNOW]_
- [ ] **IO-131** File naming — Output name = layer name + suffix + extension; illegal characters sanitized per OS; `/` in layer names creates folders (verify); name collisions resolved like Figma. _Data:_ `suffix` _Test:_ export layers "icons/home" and two named "A" → folder + collision handling equal Figma. _M2·P1·[API][DOC:13402894554519 excerpt][KNOW]_
- [ ] **IO-132** Batch export — Multiple export rows on one node produce one file per row; multiple selected nodes export together to a chosen folder (Illigma: optional single ZIP). _Data:_ `exportSettings[]` _Test:_ 3 nodes × 2 rows → 6 files. _M2·P0·[KNOW][ILL]_
- [ ] **IO-133** No editor chrome — Exports never contain selection outlines, guides, layout grids, frame titles, comments, prototype connections, rulers or measurement overlays. _Data:_ — _Test:_ export with all overlays visible → pixel-equal to export with overlays hidden. _M2·P0·[SRC:old/docs/figma/feature-guide.md][KNOW]_
- [ ] **IO-134** Hidden layers — Hidden layers inside the export are not rendered; exporting a hidden node itself behaves like Figma (verify). _Data:_ `visible` _Test:_ frame with hidden child → absent; export a hidden frame → compare Figma (§8 V-17). _M2·P1·[KNOW]_
- [ ] **IO-135** PNG alpha — PNG output is always RGBA; areas without paint are transparent. _Data:_ — _Test:_ export frame with no fill → corner pixel alpha 0. _M2·P0·[DOC:13402894554519 excerpt]_
- [ ] **IO-136** PNG color profile — PNG output is converted to and tagged with the export color profile (`DOCUMENT` → document profile; `SRGB`; `DISPLAY_P3_V4`). _Data:_ `colorProfile` _Test:_ P3 doc red (1,0,0) exported as SRGB → clipped/converted values + sRGB tag; as P3 → (255,0,0) + P3 tag; compare Figma bytes' ICC chunk (§8 V-23). _M2·P1·[API][KNOW]_
- [ ] **IO-137** JPG matte — JPG output has no alpha; transparent areas are composited onto the same matte color Figma uses (white expected — verify). _Data:_ — _Test:_ export transparent frame as JPG in both apps → corner pixel equal. _M2·P0·[DOC:13402894554519 excerpt][KNOW]_
- [ ] **IO-138** JPG quality — Quality options and default (High) match Figma; output file sizes for the reference photo fixture within ±15 % of Figma's at each level. _Data:_ image quality (Illigma extension field) _Test:_ export fixture at each level in both apps → compare sizes and PSNR. _M2·P1·[DOC:13402894554519 excerpt]_
- [ ] **IO-139** Resampling — "Basic" uses nearest-neighbor; the other option (smooth) is the default if Figma's default is smooth (verify); applies to JPG, PNG, PDF. _Data:_ resampling (Illigma extension field) _Test:_ 2× export of a 1-px checkerboard image → Basic keeps hard edges; compare Figma. _M2·P2·[DOC:13402894554519 excerpt]_
- [ ] **IO-140** Pixel parity metric — For the reference export fixture set, Illigma PNG output vs Figma PNG output: mean ΔE00 ≤ 1, max ΔE00 ≤ 3 outside anti-aliased text edges, alpha difference ≤ 2/255. _Data:_ — _Test:_ automated comparison over ≥ 100 fixtures covering paints, effects, masks, blend modes, text. _M2·P0·[ILL]_
- [ ] **IO-141** Slices — Exporting a slice renders its rectangle with all visible content beneath it (slices have no own content). _Data:_ `SliceNode` _Test:_ slice over two overlapping frames → both rendered; compare Figma. _M2·P1·[API][KNOW]_
- [ ] **IO-142** Page-level export — Export settings on a page (nothing selected) export the page content like Figma. _Data:_ REST `CanvasNode.exportSettings` _Test:_ add page export in Figma and Illigma → same bounds/output (§8 V-16). _M2·P2·[API][KNOW]_
- [ ] **IO-143** Very large exports — Exports above the GPU/encoder limits are tiled or downscaled with a warning (Figma REST caps renders at 32 MP; editor behavior to verify); never crash. _Data:_ — _Test:_ export 20000×20000 frame at 4× → completes or warns, matching Figma's behavior class. _M2·P2·[API][KNOW]_
- [ ] **IO-144** Copy as PNG — ⇧⌘C places PNG image data (not a file) of the selection on the clipboard at Figma's default scale (verify, expected 2×?). _Data:_ clipboard `image/png` _Test:_ copy as PNG, paste in an image editor → pixel size equals Figma's. _M2·P1·[SRC:forum.figma.com paste-files-after-copy-as-png-svg-macos-15378 excerpt][KNOW]_
- [ ] **IO-145** Export runs in background — Exports show progress, can be cancelled, don't block editing, and report per-file failures. _Data:_ — _Test:_ export 200 frames → editing remains responsive; cancel → no partial files left. _M2·P1·[ILL]_
- [ ] **IO-146** Export has no document side effects — Exporting neither dirties the document nor creates undo steps. _Data:_ — _Test:_ export after save → revision unchanged; Undo stack unchanged. _M2·P0·[KNOW]_

### 6.12 SVG export

- [ ] **IO-147** SVG defaults — New SVG export settings default to Outline text **on**, Include "id" attribute **off**, Simplify stroke **on**. _Data:_ `svgOutlineText:true, svgIdAttribute:false, svgSimplifyStroke:true` _Test:_ add SVG row → flags as listed; export equals Figma's default-settings export structurally. _M2·P0·[API]_
- [ ] **IO-148** Outline text — On: text is emitted as glyph outline paths (no `<text>`), visually identical to canvas; Off: `<text>`/`<tspan>` with font family, size, weight, letter spacing and line positions so text stays selectable. _Data:_ `svgOutlineText` _Test:_ export a 2-line text layer both ways → On contains no `<text>`; Off contains `<text>`; compare markup patterns with Figma (§8 V-18). _M3·P0·[API]_
- [ ] **IO-149** id attributes — When on, each element gets an `id` derived from its layer name (sanitized, unique within the file; duplicate handling like Figma); when off, only elements that need references (masks, gradients, filters, clip paths, patterns) get ids. _Data:_ `svgIdAttribute` _Test:_ two layers named "Icon" → ids unique and equal Figma's scheme; off → only reference ids. _M2·P1·[API][KNOW]_
- [ ] **IO-150** Reference ids always present — Masks, gradients and other referenced definitions always have ids regardless of the id setting. _Data:_ — _Test:_ gradient + mask export with ids off → `url(#…)` references resolve. _M2·P0·[API]_
- [ ] **IO-151** Inside/outside strokes — With Simplify stroke on, inside/outside strokes are approximated with center strokes on offset geometry where possible; off, a precise mask/clip technique is used; both render within ΔE00 ≤ 1 of the canvas. _Data:_ `svgSimplifyStroke`, `strokeAlign` _Test:_ rect & star with inside/outside strokes → both modes vs canvas render; markup approach comparable to Figma. _M2·P0·[API]_
- [ ] **IO-152** Embedded images — Image fills are embedded inline (base64 data URIs) with the correct crop/tile/fit transform; no external references. _Data:_ `ImagePaint` _Test:_ export frame with FILL/FIT/CROP/TILE images → renders in Chrome/Safari/Firefox equal canvas within ΔE00 ≤ 1. _M2·P0·[KNOW]_
- [ ] **IO-153** Effects in SVG — Drop/inner shadows and layer blur emit SVG filters equivalent to Figma's; background blur and other non-SVG effects are handled exactly like Figma (excerpt: "background blurs must be applied directly to the layer"). _Data:_ `Effect` _Test:_ export each effect in both apps → markup approach and render equal (§8 V-18). _M2·P1·[DOC:13402894554519 excerpt][KNOW]_
- [ ] **IO-154** Blend modes in SVG — Layer and paint blend modes export as CSS `mix-blend-mode` (or Figma's equivalent); pass-through groups produce no isolation. _Data:_ `blendMode` _Test:_ each of the 19 blend modes → browser render equals canvas within tolerance; markup equals Figma's approach. _M2·P1·[API][KNOW]_
- [ ] **IO-155** Non-native paints/effects — Angular/diamond gradients, pattern/video/shader paints, noise/texture/glass effects export exactly as Figma does (rasterized, approximated or omitted — verify each). _Data:_ `Paint`, `Effect` _Test:_ fixture per feature → same strategy as Figma. _M2·P2·[KNOW]_
- [ ] **IO-156** Wide-gamut SVG colors — In Display-P3 documents, exported colors carry a correct sRGB fallback (`fill="#…"` converted with clipping) plus the P3 value (`color(display-p3 r g b)`); deliberate deviation if Figma's fallback is confirmed unconverted. _Data:_ `documentColorProfile`, `colorProfile` _Test:_ P3 (1,0,0) → fallback `#FF0000`-clipped equivalent and `color(display-p3 1 0 0)`; record Figma output (§8 V-23). _M2·P1·[SRC:forum.figma.com svg-export-incorrect-color-profile-39416 excerpt][ILL]_
- [ ] **IO-157** Copy as SVG — Copy as SVG puts the same markup the SVG export would produce with default settings on the clipboard as text. _Data:_ clipboard `text/plain`/`image/svg+xml` _Test:_ diff clipboard text vs exported file → identical. _M2·P0·[DOC:360040030374 excerpt]_
- [ ] **IO-158** No hyperlinks in SVG — Text hyperlinks are not emitted as `<a>` in SVG (Figma parity). _Data:_ text `hyperlink` _Test:_ export linked text → no `<a>`; compare Figma. _M2·P2·[SRC:forum.figma.com exporting-to-svg-and-preserving-hyperlinks-36293 excerpt]_
- [ ] **IO-159** Node-id attributes (advanced) — Optional `data-node-id` attributes like the REST `svg_include_node_id` option. _Data:_ REST `svg_include_node_id` _Test:_ enable → every element carries its node id. _M8·P2·[API]_
- [ ] **IO-160** SVG validity — Output is well-formed, namespace-correct SVG 1.1/2 that renders equally in Chrome, Safari and Firefox (ΔE00 ≤ 1 vs canvas for the fixture set). _Data:_ — _Test:_ XML validator + 3-browser render comparison in CI. _M2·P0·[ILL]_

### 6.13 PDF export

- [ ] **IO-161** PDF at 1× only — PDF export ignores/disables scale constraints (always 1×). _Data:_ `ExportSettingsPDF` (no constraint) _Test:_ try 2× PDF → control unavailable/1× output; compare Figma. _M2·P0·[DOC:13402894554519 excerpt][API]_
- [ ] **IO-162** Vector fidelity & images — Shapes, strokes and gradients are vector; images are embedded at the PDF image-quality setting (default Medium). _Data:_ image quality _Test:_ inspect PDF objects: paths for shapes; image XObjects JPEG-compressed per quality; compare Figma's PDF structure. _M2·P0·[DOC:13402894554519 excerpt]_
- [ ] **IO-163** PDF text — Visual output matches Figma; Illigma emits selectable/searchable text with embedded subsetted fonts when the font's `fsType` permits, else outlines with an invisible text layer for search (superset of Figma, whose text handling is reported as outlined). _Data:_ `fsType`, text runs _Test:_ export paragraph → copy-paste text from PDF viewer yields the characters; render diff vs Figma PDF ≤ tolerance (§8 V-19). _M3·P1·[SRC:forum.figma.com/t/pdf-export-text-not-selectable/286 excerpt][ILL][KNOW]_
- [ ] **IO-164** PDF links — Text hyperlinks become clickable URI annotations; prototype connections create no interactivity. _Data:_ text `hyperlink`, `reactions` _Test:_ PDF with linked text and a prototype hotspot → link works; hotspot inert; matches Figma. _M7·P2·[SRC:forum.figma.com links-between-pages-in-pdf-export-23760 excerpt]_
- [ ] **IO-165** Multi-page PDF — "Export frames to PDF" creates one PDF with one page per top-level frame, ordered by canvas position (left→right, then top→bottom); scope (whole page vs selection) matches Figma. _Data:_ top-level frames on page _Test:_ 6 frames in a 3×2 grid selected in random order → page order row-major; compare scope with Figma (§8 V-19). _M2·P1·[SRC:layerpath.com excerpt][SRC:forum.figma.com 49835 excerpt]_
- [ ] **IO-166** PDF color profile — PDF output is converted to and tagged with the export color profile (ICC-based color space / OutputIntent). _Data:_ `colorProfile` _Test:_ P3 doc → PDF with P3 ICC; sRGB option → sRGB ICC. _M2·P2·[API][KNOW]_
- [ ] **IO-167** Effects in PDF — Shadows, blurs and blend modes render like the canvas (vector where possible, rasterized at ≥ 2× device resolution otherwise) and match Figma's approach. _Data:_ `Effect`, `blendMode` _Test:_ effect fixture → render diff vs canvas ≤ tolerance at 200 % zoom in a PDF viewer. _M2·P1·[KNOW]_
- [ ] **IO-168** PDF page geometry — Each page's MediaBox equals the exported node bounds at 1 px = 1 pt (verify against Figma). _Data:_ — _Test:_ 1440×1024 frame → MediaBox `[0 0 1440 1024]`; compare Figma. _M2·P1·[KNOW]_

### 6.14 Animated export

- [ ] **IO-169** Animated export scope — MP4/GIF/WebM export is only allowed for a top-level frame with animated content; nested frames, keyframed child layers, or frames without animation fail with an explanatory error. _Data:_ `ExportSettingsMP4/GIF/WEBM` _Test:_ try each invalid case → error; valid frame → file whose duration equals the timeline. _M7·P2·[API]_
- [ ] **IO-170** Animated export options — fps (MP4/WebM 12/24/30/60, default 30; GIF 8/12/15/24/30, default 15), quality (LOW/MEDIUM/HIGH, default HIGH), GIF loop count 0–1000 (0 = forever). _Data:_ `fps`, `quality`, `loopCount` _Test:_ export each option → container metadata matches; loopCount 1001 rejected. _M7·P2·[API]_
- [ ] **IO-171** Animated export size — Scale limited to 0.5/0.75/1/1.5/2/3/4 or fixed width/height. _Data:_ `VideoExportConstraint` _Test:_ 1.25× rejected; `WIDTH 640` → width 640, proportional height. _M7·P2·[API]_

### 6.15 System clipboard

- [ ] **IO-172** Copy flavors — ⌘C writes the private Illigma payload, an HTML flavor with an SVG rendering, `image/svg+xml` where supported, and `text/plain`; no PNG unless Copy as PNG. _Data:_ clipboard flavors (§3.10) _Test:_ inspect clipboard after copy on macOS and Windows → listed flavors present. _M1·P0·[ILL]_
- [ ] **IO-173** Full-fidelity paste between Illigma documents — Pasting into another Illigma document reproduces nodes with all properties, images, and needed style/variable/component definitions, following Figma's cross-file rules for linked vs copied assets (verify rules). _Data:_ private payload _Test:_ copy a frame with instances, styles, variables, images from doc A to doc B → render equal; linkage equals Figma's equivalent experiment (§8 V-21). _M5·P0·[KNOW][ILL]_
- [ ] **IO-174** Paste priority — On ⌘V the first available of: Illigma payload → Figma payload (if enabled) → copied files → image data → SVG markup → plain text is used. _Data:_ — _Test:_ clipboard containing both PNG and plain text → image layer created; only text → text layer. _M1·P0·[KNOW][ILL]_
- [ ] **IO-175** Paste image data — Raster image data on the clipboard becomes an image layer through the raster pipeline (4096 cap, dedupe). _Data:_ `ImagePaint` _Test:_ copy a screenshot, paste → image layer of the screenshot's size (capped); compare Figma. _M2·P0·[KNOW][DOC:360040028034 excerpt]_
- [ ] **IO-176** Paste plain text — Plain text with no text layer in edit mode creates a new text layer with default text properties; while editing text it inserts at the caret (rich formatting discarded per Figma). _Data:_ `TextNode` _Test:_ paste "Hello\nWorld" on canvas → 2-line text layer; inside edit → inserted; compare Figma. _M3·P0·[KNOW]_
- [ ] **IO-177** Paste copied files — Files copied in the OS file manager paste as imports (media/SVG); unsupported ones are reported. _Data:_ — _Test:_ copy 2 PNGs + 1 SVG + 1 .txt in Finder, paste → 3 layers + notice. _M2·P1·[KNOW]_
- [ ] **IO-178** Plain text of copied layers — Copying text layers puts their characters on `text/plain` in layer order; behavior for non-text selections matches Figma. _Data:_ `characters` _Test:_ copy two text layers, paste in a text editor → both strings in Figma's order/separator. _M3·P0·[KNOW]_
- [ ] **IO-179** Copy as text / Copy as code — Copy as text copies text content; Copy as code copies the node's CSS equivalent to Figma's inspect CSS. _Data:_ `getCSSAsync` _Test:_ compare copied CSS for 10 fixture nodes with Figma's `getCSSAsync` output. _M8·P2·[API][KNOW]_
- [ ] **IO-180** Large payloads — Clipboard payloads with large assets reference assets by hash + source path when above 20 MB total, and still paste correctly on the same machine; cross-machine paste degrades with a clear message. _Data:_ private payload asset section _Test:_ copy frame with 300 MB of images → paste in second doc succeeds; paste after deleting source file → placeholders + message. _M8·P1·[ILL]_
- [ ] **IO-181** Payload versioning — Clipboard payloads carry a version; pasting a newer payload into an older build keeps known content and reports dropped features. _Data:_ payload `version` _Test:_ synthetic future payload → paste succeeds with notice. _M8·P1·[ILL]_
- [ ] **IO-182** Illigma → Figma via SVG — Content copied from Illigma pastes into Figma as vectors via the SVG flavor; text pasted as `<text>` (not outlined) so that Figma creates editable text if it supports it (verify). _Data:_ SVG flavor _Test:_ copy a card with text from Illigma, paste in Figma → visual match; record whether text is editable (§8 V-10). _M8·P1·[DOC:360040030374 excerpt][KNOW]_
- [ ] **IO-183** Paste from other design tools — SVG clipboard content from Illustrator/Sketch/Inkscape imports through SVG import; raster/PDF-only clipboard content falls back to image import, as in Figma. _Data:_ — _Test:_ copy a vector logo from Illustrator with "Include SVG code" → vectors; without → image. _M8·P2·[DOC:360040030374 excerpt][SRC:forum.figma.com allow-pasting-from-illustrator-as-vector-14524 excerpt]_
- [ ] **IO-184** Paste is one undo step and selects result — Any paste is one undo step; afterwards the pasted top-level nodes are selected. _Data:_ — _Test:_ paste → selection = pasted nodes; Undo → document identical to before. _M1·P0·[KNOW]_

### 6.16 Figma interop (clipboard & plugin bridge)

- [ ] **IO-185** Detect Figma clipboard — Illigma recognizes Figma's HTML clipboard (`(figmeta)`/`(figma)` markers / `data-metadata`/`data-buffer` attributes) without decoding the binary, and offers the configured import path or an explanation. _Data:_ clipboard `text/html` _Test:_ copy from Figma, paste in Illigma with no token → hint dialog; with token → REST path. _M8·P1·[SRC:simonwillison.net/2024/Sep/19/the-webs-clipboard excerpt][SRC:registry.npmjs.org/fig-kiwi]_
- [ ] **IO-186** Paste from Figma via REST-by-reference — With a user token, the figmeta file key + node ids are fetched via the REST API and converted (REST fidelity), positioned like a normal paste. _Data:_ `GET /v1/files/:key/nodes?ids=&geometry=paths` _Test:_ copy a frame in Figma, paste in Illigma → layer tree equals REST JSON conversion; images present. _M8·P2·[SRC:cdn.jsdelivr.net agent-native excerpt][API]_
- [ ] **IO-187** Kiwi clipboard decode (gated) — Direct decoding of Figma's clipboard binary exists only behind an experimental flag **after** recorded legal approval; default builds contain no bundled Figma schema. _Data:_ feature flag, build manifest _Test:_ release build audit → no Figma schema file, flag off. _M8·P2·[SRC:grida.co/docs/wg/feat-fig excerpt][ILL]_
- [ ] **IO-188** Bridge plugin: Illigma → Figma — A Figma plugin (official Plugin API only) imports an Illigma interchange JSON creating frames, shapes, vectors, text (after `loadFontAsync`), images (`createImage`), variables, styles, components and instances; it reports unsupported features. _Data:_ Plugin API create* methods _Test:_ 30-node fixture → Figma result passes a structural diff ≥ 95 % fields equal; report lists the rest. _M8·P2·[API][ILL]_
- [ ] **IO-189** Bridge plugin: Figma → Illigma — The plugin exports selection/page via `exportAsync({format:'JSON_REST_V1'})`, image bytes via `getImageByHash().getBytesAsync()`, and local variables/styles, into a file Illigma imports without any token. _Data:_ `JSON_REST_V1`, `Image.getBytesAsync` _Test:_ export fixture page → import in Illigma → render ΔE00 within REST-fidelity tolerance. _M8·P2·[API]_
- [ ] **IO-190** Never write Figma private formats — No code path writes Figma's clipboard markers or `.fig` binaries. _Data:_ — _Test:_ static check + clipboard inspection after every copy command → no `(figma)`/`fig-kiwi` output. _M8·P0·[ILL][DOC:8403626871063 excerpt]_

### 6.17 `.fig` import (feasibility-gated)

- [ ] **IO-191** Container detection — Accepts ZIP-wrapped `.fig` (with `canvas.fig`) and raw `fig-kiwi` data; rejects `fig-jam.`, `fig-deck` and other preludes (and `.jam/.deck/.buzz/.site/.make`) with a message naming the file kind. _Data:_ 8-byte prelude, u32 version _Test:_ fixtures of each kind → Design accepted, others rejected with correct names. _M8·P2·[SRC:grida.co/docs/wg/feat-fig excerpt][DOC:8403626871063 excerpt]_
- [ ] **IO-192** Self-describing decode — Decoding uses the schema embedded in the file; both deflate and zstd data chunks are supported. _Data:_ schema chunk, data chunk _Test:_ old (deflate) and new (zstd) fixtures decode. _M8·P2·[SRC:github.com/sunyui/figma-parser excerpt]_
- [ ] **IO-193** Import semantics like Figma re-import — The result is a new independent document; components become new main components; instances link to them; no version history or comments. _Data:_ — _Test:_ import fixture with library instances → instances point to local new mains; history empty. _M8·P2·[DOC:8403626871063 excerpt]_
- [ ] **IO-194** Group reconstruction — Frame records that encode groups (`resizeToFit: true`) become `GROUP` nodes; real frames stay frames. _Data:_ `resizeToFit`, `frameMaskDisabled` _Test:_ fixture with 5 groups and 5 frames → correct types. _M8·P2·[SRC:grida.co/docs/wg/feat-fig excerpt]_
- [ ] **IO-195** Image attachment — Images from the archive's `images/` folder attach by hash; missing images become placeholders, not failures. _Data:_ `imageHash` _Test:_ remove one image from fixture ZIP → import succeeds with 1 placeholder reported. _M8·P2·[SRC:github.com/sunyui/figma-parser excerpt][ILL]_
- [ ] **IO-196** Import report & opaque preservation — Unknown node types/fields are preserved opaquely; an import report lists converted / approximated / dropped counts per feature. _Data:_ `foreign` records _Test:_ fixture with FigJam stickies on a design page → preserved + reported. _M8·P2·[ILL][SRC:github.com/sketch-hq/fig2sketch README]_
- [ ] **IO-197** Visual fidelity — Imported fixtures render within ΔE00 ≤ 1 mean vs Figma REST-rendered PNGs of the same nodes. _Data:_ — _Test:_ 20-file fixture corpus comparison. _M8·P2·[API][ILL]_
- [ ] **IO-198** Large/failed imports — Large `.fig` imports stream with progress and cancel; failures or cancellation leave no partial document. _Data:_ — _Test:_ 500 MB fixture import → progress; cancel → nothing created. _M8·P2·[DOC:360040027794 excerpt][ILL]_
- [ ] **IO-199** Legal gate — The `.fig` importer is disabled by default and can be enabled only in builds where legal sign-off is recorded; UI states that `.fig` is proprietary and may change. _Data:_ build flag _Test:_ release build → menu item absent/disabled; flagged build → shows disclaimer. _M8·P0·[DOC:8403626871063 excerpt][KNOW][ILL]_

### 6.18 Figma REST API import (optional)

- [ ] **IO-200** Token handling — A personal access token (or OAuth) is stored only in the OS keychain, can be removed, and never appears in documents, logs, crash reports or exports. _Data:_ keychain item _Test:_ grep all app outputs after an import → token absent; remove token → API features disabled. _M8·P2·[API][ILL]_
- [ ] **IO-201** File URL parsing — Accepts file keys and figma.com URLs (`/file/`, `/design/`, branch URLs, `node-id` with `-`→`:` conversion). _Data:_ file key, node ids _Test:_ 6 URL variants → correct key/ids. _M8·P2·[API][KNOW]_
- [ ] **IO-202** REST mapping — Uses `geometry=paths`; maps `REGULAR_POLYGON`→`POLYGON`, `CANVAS`→page, `STRETCH`→`CROP`, `FILL` style type→`PAINT`; decodes `characterStyleOverrides`/`styleOverrideTable`, list types and indentation. _Data:_ §2.7 _Test:_ fixture file → model fields equal plugin-API dump of the same Figma file (where representable). _M8·P2·[API]_
- [ ] **IO-203** Image fills download — Image-fill URLs are fetched immediately (they expire ≤ 14 days) and stored as assets; failures become placeholders with retry. _Data:_ `GET /v1/files/:key/images` _Test:_ import → all images present offline afterwards. _M8·P2·[API]_
- [ ] **IO-204** Variables without Enterprise — If `variables/local` returns 403, bound variables are imported as resolved raw values with dangling ids and a warning; with access, collections/modes/variables import fully. _Data:_ `boundVariables`, `LocalVariableCollection` _Test:_ non-Enterprise token → warning + raw values; Enterprise fixture → variables present. _M8·P2·[API]_
- [ ] **IO-205** Version & subset import — A specific version (`version=`) and a subset of pages/nodes (`ids=`, `depth=`) can be imported. _Data:_ query params _Test:_ import version N of fixture → equals that version's content. _M8·P2·[API]_
- [ ] **IO-206** Errors, rate limits, atomicity — 403/404 show specific messages; 429 triggers back-off (honoring `Retry-After` if present); the import builds a new document atomically (all-or-nothing). _Data:_ HTTP status handling _Test:_ mock server returning 429 twice then 200 → success; mid-import network loss → no document created. _M8·P2·[API][KNOW]_
- [ ] **IO-207** Lossiness report — The import report lists features REST cannot carry: vector-network topology, `GLASS`, video/shader paints, slots, Motion, `EASING`/`TIMING` variables, custom animation styles. _Data:_ §2.7 _Test:_ fixture using each feature → each listed. _M8·P2·[API]_

### 6.19 Other imports

- [ ] **IO-208** Sketch import — `.sketch` files import as a new document (pages → pages, artboards → frames, symbols → components/instances, shared styles → styles) matching Figma's Sketch import results. _Data:_ Sketch open format _Test:_ fixture `.sketch` imported in Figma and Illigma → structural diff. _M8·P2·[DOC:360040514273 title][DOC:360040027794 excerpt][KNOW]_

### 6.20 Design tokens (DTCG)

- [ ] **IO-209** Export tokens — Exporting a collection writes DTCG JSON per mode (`.tokens.json`, MIME `application/design-tokens+json`) with deterministic ordering; file naming matches Figma's export. _Data:_ `VariableCollection.modes`, DTCG `$type/$value` _Test:_ export 2-mode collection → 2 files; diff against Figma's native export of the same collection (§8 V-29). _M6·P1·[SRC:github.com/design-tokens/community-group file-format.md][SRC:forum.figma.com 47831 excerpt]_
- [ ] **IO-210** Color tokens — COLOR variables export as `{colorSpace, components, alpha, hex}` with `colorSpace` following the document profile. _Data:_ `RGBA`, `documentColorProfile` _Test:_ sRGB doc #3366FF 50 % → `{"colorSpace":"srgb","components":[0.2,0.4,1],"alpha":0.5,"hex":"#3366ff"}` (hex format per Figma). _M6·P1·[SRC:github.com/civictheme/uikit/pull/1025 excerpt][SRC:…/aliases.md]_
- [ ] **IO-211** Number/string/boolean tokens — FLOAT, STRING and BOOLEAN map to `number`/`dimension`/`fontFamily`/`fontWeight`/`$extensions` exactly as Figma's native export does (verify rule, likely scope-driven). _Data:_ `resolvedType`, `scopes` _Test:_ fixture with each type/scope combo → equal to Figma export. _M6·P1·[KNOW]_
- [ ] **IO-212** Alias tokens — Aliased variables export as `"{group.token}"` references; aliases across collections handled like Figma (reference vs resolved value). _Data:_ `VariableAlias` _Test:_ alias chain of 3 → references preserved; cross-collection alias → equals Figma. _M6·P1·[SRC:…/aliases.md][KNOW]_
- [ ] **IO-213** Descriptions — Variable descriptions export as `$description` (deliberate superset if Figma omits them). _Data:_ `Variable.description` _Test:_ described variable → `$description` present; Figma import of the file still succeeds. _M6·P2·[SRC:forum.figma.com 47831 excerpt][ILL]_
- [ ] **IO-214** Figma metadata — Scopes, code syntax, hidden-from-publishing and other Figma-only fields are written under `$extensions` with Figma's exact keys (verify) so Figma re-import preserves them. _Data:_ `scopes`, `codeSyntax`, `hiddenFromPublishing` _Test:_ export → import into Figma → scopes/code syntax retained. _M6·P2·[KNOW]_
- [ ] **IO-215** Import mode — Importing a DTCG file into a chosen mode (or a new collection) updates variables by name path, creates missing ones, never deletes absent ones unless "Replace" is chosen, and is one undo step; legacy hex-string colors are accepted with a warning (Figma rejects them — documented superset). _Data:_ DTCG → `Variable` _Test:_ import file with 3 existing + 2 new tokens → 3 updated, 2 created; Undo → original. _M6·P1·[SRC:github.com/civictheme/uikit/pull/1025 excerpt][ILL]_
- [ ] **IO-216** Circular aliases on import — Circular references are reported as errors for every token in the chain and those tokens are not imported. _Data:_ — _Test:_ a→b→c→a + 2 valid tokens → 3 errors, 2 imported. _M6·P1·[SRC:…/aliases.md]_
- [ ] **IO-217** Type validation — Tokens whose `$value` doesn't match `$type` (or inherited group type) are rejected with per-token errors; unknown `$type` values skipped with warning. _Data:_ DTCG types _Test:_ dimension with unit "em" → error (DTCG allows px/rem only). _M6·P1·[SRC:…/types.md]_
- [ ] **IO-218** Round-trip — Export → import into an empty document → export yields identical JSON. _Data:_ — _Test:_ fixture with all types and aliases. _M6·P1·[SRC:github.com/civictheme/uikit/pull/1025 excerpt][ILL]_
- [ ] **IO-219** Interop with Figma — Illigma-exported files import into Figma via Import mode without errors, and Figma-exported files import into Illigma reproducing names, values and aliases. _Data:_ — _Test:_ bidirectional transfer of a 50-variable fixture → values equal. _M6·P1·[SRC:forum.figma.com 47831 excerpt][SRC:github.com/civictheme/uikit/pull/1025 excerpt]_
- [ ] **IO-220** Styles as composite tokens (extension) — Optional export of text/effect/paint styles as DTCG `typography`/`shadow`/`gradient` composite tokens. _Data:_ `TextStyle`, `EffectStyle`, `PaintStyle` _Test:_ export → valid DTCG composite tokens per spec. _M6·P2·[SRC:…/composite-types.md][ILL]_

### 6.21 Color management

- [ ] **IO-221** New-document profile — New documents use the preferred profile from Preferences (default sRGB). _Data:_ `documentColorProfile` _Test:_ fresh install → new doc SRGB; set preference P3 → next new doc DISPLAY_P3. _M2·P0·[DOC:360039825114 excerpt]_
- [ ] **IO-222** Change profile: Assign vs Convert — Changing a document's profile asks "Keep color values (Assign)" or "Keep appearance (Convert)"; Assign leaves stored numbers unchanged; Convert transforms every stored color so on-screen appearance is preserved within 1/255 per channel for in-gamut colors. _Data:_ all color sites _Test:_ sRGB doc with 20 colors → Convert to P3 → numbers change, display pixels equal within 1/255; Assign → numbers equal. _M2·P1·[DOC:360039825114 excerpt][KNOW]_
- [ ] **IO-223** Convert coverage — Convert updates paints, gradient stops, effects, page and prototype backgrounds, local styles, all modes of local color variables, text range fills and instance overrides, in one undo step; remote library copies are not rewritten. _Data:_ — _Test:_ fixture with a color in every site → all converted; Undo restores all. _M2·P1·[ILL]_
- [ ] **IO-224** Out-of-gamut handling — Converting P3 → sRGB handles out-of-gamut colors exactly as Figma does (clip vs gamut-map — verify). _Data:_ — _Test:_ P3 (1,0,0) → resulting sRGB numbers equal Figma's (§8 V-23). _M2·P1·[KNOW]_
- [ ] **IO-225** Legacy files — `LEGACY` documents render as the preferred profile or sRGB if none. _Data:_ `LEGACY` _Test:_ open LEGACY fixture with preference P3 → renders as P3 assignment; preference unset → sRGB. _M2·P1·[DOC:360039825114 excerpt]_
- [ ] **IO-226** Export color profile — Exports default to the document profile and can be set per export to sRGB or Display P3 (v4 ICC), converting colors accordingly. _Data:_ `colorProfile: DOCUMENT/SRGB/DISPLAY_P3_V4` _Test:_ export each option from a P3 doc → ICC tags and pixel values as expected. _M2·P1·[API][DOC:360039825114 excerpt]_
- [ ] **IO-227** Stored values readout — Color inputs (hex/RGB) show stored document-space values; sampling with the eyedropper stores values in document space. _Data:_ `RGB` _Test:_ P3 doc: type #FF0000 → stored (1,0,0) in P3; eyedropper on that fill returns #FF0000. _M2·P1·[KNOW]_
- [ ] **IO-228** Display color management — The canvas is color-managed to the monitor profile, so P3 content shows wide-gamut color on P3 displays and is correctly mapped on sRGB displays. _Data:_ — _Test:_ measure P3 (1,0,0) patch on a P3 display with a colorimeter vs Figma desktop on the same display. _M2·P1·[KNOW][ILL]_

### 6.22 Fonts

- [ ] **IO-229** References never rewritten on open — Opening a document never changes any `FontName`; missing fonts are detected per family/style (incl. variation settings) and listed. _Data:_ `FontName`, `hasMissingFont` _Test:_ open fixture on a machine lacking 2 fonts → model dump unchanged; list shows exactly those family/style pairs. _M3·P0·[API][DOC:360039956994 excerpt]_
- [ ] **IO-230** Missing-font indicators — A file-level missing-font icon (left sidebar/toolbar) and an icon next to the font name for selected affected text appear, opening the Missing fonts dialog. _Data:_ — _Test:_ fixture → both icons visible; click → dialog. _M3·P0·[DOC:360039956994 excerpt]_
- [ ] **IO-231** Rendering with missing fonts — Text with a missing font renders as Figma does (expected: previously computed appearance retained) and never reflows silently on open. _Data:_ cached glyph/derived text data _Test:_ save on machine A with font, open on B without → render equals A's; compare with Figma on a font-less machine (§8 V-24). _M3·P1·[KNOW]_
- [ ] **IO-232** Editing missing-font text — Which edits are allowed on text with a missing font (move/resize vs character/property edits) matches Figma; disallowed edits explain how to resolve. _Data:_ — _Test:_ attempt typing, font-size change, resize on missing-font text → same allow/deny outcomes as Figma (§8 V-24). _M3·P1·[KNOW]_
- [ ] **IO-233** Replace fonts — The Missing fonts dialog maps each missing family/style to an available one and applies to all affected layers, text ranges and text styles in one undo step, changing the document. _Data:_ `FontName` _Test:_ replace "Foo Bold" → "Inter Bold" → all ranges updated; Undo restores all. _M3·P0·[DOC:360039956994 excerpt]_
- [ ] **IO-234** OS font discovery — Installed OS fonts (system and user) appear; newly installed fonts become available without relaunch (watcher or "Refresh fonts") and missing-font states resolve automatically. _Data:_ font registry _Test:_ install a font while a file using it is open → missing state clears within 5 s. _M3·P1·[DOC:360039956994 excerpt][ILL]_
- [ ] **IO-235** Font formats — TTF and OTF (P0, Figma's supported set), TTC/OTC collections and variable fonts (P1); WOFF/WOFF2 (P2) are supported as font sources. _Data:_ — _Test:_ load each format → glyphs render; variable axes listed. _M3·P1·[DOC:360039956994 excerpt][ILL]_
- [ ] **IO-236** Font embedding (opt-in) — Embedding a font into the document is allowed only when OS/2 `fsType` permits (Installable or Editable; Preview&Print → read-only rendering; Restricted → refused with reason); no automatic embedding. _Data:_ `assets/fonts/*`, `fsType` _Test:_ fonts with each fsType → expected outcomes; UI shows license notice. _M3·P2·[KNOW][ILL]_
- [ ] **IO-237** Embedded font use — Embedded fonts are used only when the OS lacks the font, are never installed system-wide, and are removed when no longer used (on save). _Data:_ — _Test:_ open doc with embedded font on clean machine → renders; OS font list unchanged; delete all uses → font removed after save. _M3·P2·[ILL]_
- [ ] **IO-238** Conflicting font versions — When the available font differs in version/metrics from the one used at authoring time (stored metrics hash), the layer is flagged (Figma cites conflicting versions as a missing-font cause). _Data:_ stored font fingerprint _Test:_ open with an older font version → flag shown; render uses available font only after user confirms. _M3·P2·[DOC:360039956994 excerpt][ILL]_
- [ ] **IO-239** Variable-font settings — `variationSettings` round-trip; setting a font without a style picks the closest named instance (e.g., `wght: 900` → Black). _Data:_ `FontName.variationSettings`, `getFontFamilyVariationAxes` _Test:_ Inter `{wght:550}` round-trips; `{wght:900}` with no style → style "Black". _M3·P1·[API]_

### 6.23 Cloud-feature equivalents

- [ ] **IO-240** Local comments (P2) — Comments pinned to a canvas point or node, with threads, resolve/unresolve and author = local profile, stored in the file; excluded from exports; optional in Save a copy. _Data:_ comments store (Illigma) _Test:_ create, resolve, save, reopen → intact; export PNG → no comment pins. _M8·P2·[DOC:360039825314 title][ILL]_
- [ ] **IO-241** Local branch & merge (P2) — "Create branch" makes a copy recording `baseFileId/baseRevision`; "Merge" computes a 3-way per-node/per-property diff, shows conflicts, and applies the result as one undo step in the main file. _Data:_ branch metadata _Test:_ change different properties of the same node in main and branch → auto-merged; same property → conflict UI. _M8·P2·[DOC:360063144053 title][DOC:5691189138839 title][ILL]_
- [ ] **IO-242** Git-friendly workflow (P2) — The canonical text form can be stored next to the file and re-imported; a text-level merge by Git either yields a valid document or a precise validation error (never a silently corrupted document). _Data:_ canonical JSON _Test:_ two branches edit different nodes → git merge → import valid; conflicting edits → git conflict or validation error. _M8·P2·[ILL]_

### 6.24 Robustness & security

- [ ] **IO-243** Decompression & size limits — All archive/compressed inputs enforce limits on decompressed size, entry count, nesting and node count; violations abort cleanly. _Data:_ parser limits _Test:_ zip bomb and 10M-node synthetic file → clean abort < 5 s, memory bounded. _M8·P0·[ILL]_
- [ ] **IO-244** Fuzzing — Native, SVG, raster, `.fig`, REST JSON, DTCG and clipboard parsers survive ≥ 1M fuzz iterations each without crash, hang or memory-safety error. _Data:_ — _Test:_ CI fuzz jobs green. _M8·P1·[ILL]_
- [ ] **IO-245** No network during open/import — Opening documents and importing local files make no network requests (external `href`s, fonts, images are never fetched). _Data:_ — _Test:_ sandbox records zero outbound connections across the fixture corpus. _M8·P0·[ILL]_
- [ ] **IO-246** Failed import isolation — Any failed or cancelled import leaves the open document byte-identical and the undo stack unchanged. _Data:_ — _Test:_ inject failures at 10 stages of each importer → document hash unchanged. _M8·P0·[ILL]_

---

## 7. Cross-area dependencies

| Area / doc | Dependency |
| --- | --- |
| Foundation (M0: document model, undo/redo, renderer, persistence engine) | The file format serializes the document model 1:1; the journal hooks into the transaction/undo system; export parity depends on the renderer being the same code path as the canvas (no separate export renderer). |
| `01-canvas-selection-transform` (CV) | Paste placement rules, Paste over selection / Paste to replace / Paste here, copy/paste properties, duplicate (ID remapping per IO-045), per-user viewport state. |
| `02-frames-groups-sections-constraints` (FR) | Group-vs-frame reconstruction on `.fig`/SVG import; sections and frames as thumbnail nodes; clip-content effects on export bounds; slices. |
| `03-auto-layout` (AL) | Layout-engine version flag persistence (IO-075); layout field round-trip; REST/`.fig` import of auto layout (incl. GRID). |
| `04-shapes-vectors-booleans` (VC) | Vector-network storage (IO-025); SVG path ↔ network conversion; masks/booleans in SVG import/export; outline stroke used by SVG stroke simplification. |
| `05-paint-effects-color-export` (PE) | Export section/dialog UI over this area's encoders; paint/effect definitions; image placement gestures; color picker readouts and color-profile UI. |
| `06-text-typography` (TX) | Font model and loading, missing-font UI, text layout cache used for missing-font rendering, text in SVG/PDF export, text paste. |
| `07-components-variants` (CP) | Instance override identity (IO-046), remote mains, cross-file paste linkage, new-mains-on-import semantics, slots in REST lossiness. |
| `08-variables-styles-design-systems` (DS) | Library publish/update/swap UI on top of §3.9; variables model; DTCG import/export UI (§3.12); color variables under profile conversion. |
| `09-prototyping` (PR) | Reaction/flow/Motion data round-trip; animated export (MP4/GIF/WebM); GIF/video assets; PDF links. |
| `10-panels-shortcuts-workflow` (UX) | File menu, recent files, version history panel, preferences, missing-fonts entry points, shortcuts table consistency. |
| Performance hardening (M8) | Budgets for open/autosave/memory on 100k–1M node fixtures (IO-014, IO-049, IO-077..081). |
| Accessibility (M8) | Import reports, banners and dialogs must be keyboard- and screen-reader-accessible; PDF text extraction (IO-163) improves accessibility of exports. |
| Legal/licensing (non-engineering) | Sign-off gates for `.fig` import and any Figma clipboard binary decoding (IO-187, IO-199); font embedding license policy (IO-236). |
| Framer-derived visual design system | Visual styling of banners, dialogs, progress toasts and the version-history panel (behavior here, looks there). |

---

## 8. Needs live Figma verification

Each experiment: **setup → action → what to record.** Record Figma version, platform (desktop app macOS/Windows, browser), plan type, and date. Results feed back into the referenced checklist items; until then those items remain hypotheses.

- **V-01 `.fig` container (IO-191/192):** Setup: Design file with 2 pages, 3 images, 1 component. Action: Main menu → File → Save local copy. Record: whether the download is a ZIP; its entries (`canvas.fig`, `meta.json`, `thumbnail.png`, `images/…`); first 12 bytes of `canvas.fig`; compression of chunks (deflate vs zstd); whether fonts are absent.
- **V-02 Local-copy re-import (IO-193):** Setup: file using a team-library component and a local component. Action: save local copy, re-import via file browser. Record: whether library instances become local mains or stay library-linked; component keys changed; history/comments absent.
- **V-03 Checkpoint cadence (IO-062):** Setup: new file. Action: edit continuously for 70 min; then idle 60 min; then 1 edit. Record: timestamps of autosave entries (every 30 min from first edit? from last checkpoint? only when edits occurred?).
- **V-04 Restore entries (IO-066):** Action: restore a 3-entry-old version. Record: the two entries created (titles/labels/order) and whether the restored content equals the selected version exactly.
- **V-05 Named version constraints (IO-063):** Action: save version with whitespace-only title, 1,000-char title, emoji, empty description. Record: validation messages, truncation, max lengths.
- **V-06 Version preview capabilities (IO-065):** Action: preview an old version; try select, copy, export, inspect. Record: what is allowed (copying from old versions?).
- **V-07 Version actions (IO-068):** Record exact per-version menu items (Restore, Duplicate, Copy link, Name/Edit info…) and the result of Duplicate (new file name, location, history).
- **V-08 Undo after restore (IO-066):** Action: restore a version, press ⌘Z. Record: whether undo reverts the restore, does nothing, or undoes earlier edits.
- **V-09 Figma clipboard flavors (IO-172/185):** Action: copy (a) a frame, (b) a text layer, (c) an image layer; inspect the OS clipboard (macOS `osascript -e 'clipboard info'`, Windows clipboard viewer). Record: all flavors and sizes; `text/plain` content for each; whether any image flavor is present on plain copy.
- **V-10 SVG import mapping (§3.7, IO-103…124, IO-182):** Setup: fixture SVGs, one construct each (rect with rx, circle, ellipse, line, polyline, text/tspan, image data URI, linear/radial gradient with transforms, clipPath, mask, pattern, marker, symbol/use, defs, filter shadow, `<style>` classes, units mm/pt/%, currentColor, display:none, no size attributes, viewBox ≠ size). Action: import each via drag-drop and via paste of SVG text. Record: resulting layer tree (types, names), frame size/name/clip, geometry (export JSON via plugin `exportAsync({format:'JSON_REST_V1'})`), dropped elements, warnings; also whether `<text>` from an Illigma SVG becomes editable text.
- **V-11 Raster import (IO-093…095):** Import 8000×3000, 4097×10, 4096×4096 PNGs and 8 EXIF-orientation JPEGs. Record: stored pixel size (via plugin `Image.getSizeAsync`), layer size, rounding, orientation, whether original bytes are kept below 4096 (compare `getBytesAsync` with source bytes).
- **V-12 Drop & bulk placement (IO-101, §4.9):** Drop 1 and 5 images on empty canvas, onto a frame, onto an auto-layout frame; use Place image (⇧⌘K) with 3 files. Record: parent chosen, positions/arrangement, sizes, selection after placement.
- **V-13 Copy as PNG (IO-144):** Copy as PNG a 100×100 frame; paste into an image editor. Record: pixel size (1×/2×), color profile tag, background.
- **V-14 Export bounds & sizes (IO-127…130):** Fixtures: 10.5×7.25 rect; rect with 8 px outside stroke and 20 px shadow; text 200×40 with short text; child clipped by parent. Export at 1×, 1.5×, 3×, `100w`, `5x`, `0x`, `abc`. Record: output pixel sizes, clamping/validation messages, effect inclusion, "Include bounding box" effect.
- **V-15 JPG quality & matte (IO-137/138):** Export a transparent frame and a photo as JPG at each quality level. Record: matte color, quality option names, file sizes, default.
- **V-16 Export UI scope (§4.1/4.2, IO-142):** With nothing selected and with a selection: open ⇧⌘E; add export settings to a page. Record: listed items, default row added by "+" (format/scale), page export bounds.
- **V-17 Hidden node export (IO-134):** Export a hidden frame (eye off) directly. Record: blank output, error, or rendered content.
- **V-18 SVG export structure (IO-148…155):** Export fixtures (text both modes, inside/outside strokes both simplify modes, image fills each scale mode, every effect, 19 blend modes, angular/diamond gradients, noise/texture/glass) with ids on/off. Record: markup patterns (root attributes, defs naming, filter chains, foreignObject usage, rasterization), and P3-document color output.
- **V-19 PDF export (IO-163/165/168):** Export a text paragraph, linked text, a 3×2 grid of frames via "Export frames to PDF" with partial selection. Record: text selectable/searchable? fonts embedded (pdffonts)? link annotations; page order; scope (selection vs page); MediaBox units.
- **V-20 Animated export (IO-169…171):** Export a Motion-animated top-level frame as MP4/GIF/WebM with each option. Record: UI option names/defaults, errors for nested frames, durations.
- **V-21 Cross-file paste & remapping (IO-045/173):** Copy from file A (with unpublished local component instance, published library instance, local style, local variable binding, prototype link between two copied frames, pattern fill) to file B. Record: linkage of each asset in B (remote/local/detached), whether local styles/variables are copied, prototype link targets, pattern source.
- **V-22 Paste priority (IO-174):** Put PNG + plain text on the clipboard (e.g., from a browser image copy) and paste. Record which flavor Figma uses; repeat with SVG text + PNG.
- **V-23 Color management (IO-099/136/156/222/224/226, §3.13):** In sRGB and P3 files: import P3-tagged PNG; set P3 (1,0,0) fill; Convert P3→sRGB; export PNG/JPG/SVG/PDF with each color profile. Record: stored values after Convert (clip vs map), ICC tags in outputs, SVG fallback values, image pixel values on canvas, behavior for library assets with different profiles.
- **V-24 Missing fonts (IO-231/232):** Open a file using a font not installed. Record: rendering (unchanged vs fallback), which edits are blocked (typing, size change, resize, auto-layout reflow), dialog contents, replacement scope (layers, styles).
- **V-25 ⌘S (IO-052):** Press ⌘S/Ctrl+S in Figma desktop and browser. Record: toast text or dialog (e.g., save-to-version-history prompt), whether anything is saved.
- **V-26 Shortcuts & menus (§4.3–4.4, §5):** Open Figma's keyboard-shortcuts panel and main/context menus. Record exact labels and shortcuts for Export, Place image, Save to version history, Copy as PNG/SVG/text/code, Copy link, Paste to replace/over selection/here, Export frames to PDF, Save local copy.
- **V-27 REST auth limits (IO-200/206):** From Figma developer docs (when reachable): token expiry options, scopes, per-endpoint rate limits/tiers and the `Retry-After` header. (Documentation check, not UI.)
- **V-28 REST style values (IO-202):** GET file with unused local styles. Record whether style values are retrievable without a referencing node (and via which endpoint).
- **V-29 Native DTCG export/import (IO-209…219):** Export a collection with COLOR/FLOAT (various scopes)/STRING/BOOLEAN variables, aliases (same/cross collection), descriptions, code syntax, 2 modes; import modified files. Record: file naming, structure, `$type` choices per scope, `$extensions` keys, alias format, error messages, hex vs object colors.
- **V-30 Private-name publishing (IO-089):** Publish a library with components named `_Base` and `.internal`. Record whether they are published.
- **V-31 Default file thumbnail (IO-007):** New file with several frames, no custom thumbnail. Record which content the default thumbnail shows.
- **V-32 Export-setting defaults per format (§2.6):** Add an export row, switch to SVG/PDF/JPG. Record default values of Ignore overlapping layers, Include bounding box, quality, resampling, color profile for each format.
- **V-33 Resampling options (IO-139):** Record option names and default for JPG/PNG/PDF and their visual difference on a 2× upscaled pixel-art image.
- **V-34 Plain-text of non-text layers (IO-178):** Copy a frame without text and a mixed selection; paste into a plain-text editor. Record result.
- **V-35 Legal (IO-187/199, §3.11.0):** Not a live-Figma test: obtain current Figma Terms of Service and Developer Terms text; counsel review of reverse-engineering/interoperability clauses before enabling `.fig` or clipboard-binary features.

---

## 9. Sources

### 9.1 Typings & specifications read in this session
Plugin API typings `plugin-api.d.ts` v1.141.0 (line numbers approximate to this copy):
- `fileKey` 79; `skipInvisibleInstanceChildren` ~85–110; `viewport` 119, `ViewportAPI` 3304–3330; `saveVersionHistoryAsync` 302–338, `VersionHistoryResult` 2142; `importComponentByKeyAsync`/`importComponentSetByKeyAsync`/`importStyleByKeyAsync` 1619–1627; `listAvailableShaders`/`importShaderById` 1633–1660; `listAvailableFontsAsync` 1662; `loadFontAsync` 1698; `getFontFamilyVariationAxes` 1726; `hasMissingFont` 1730; `createNodeFromSvg` 1734; `createImage` (PNG/JPEG/GIF, max 4096) 1742; `createImageAsync` 1778; `getImageByHash` 1782; `createVideoAsync` (MP4/MOV/WebM, 100 MB) 1792; file thumbnail APIs 1972–1990; `loadAllPagesAsync` 2002; `importVariableByKeyAsync` 2298; `LibraryVariableCollection` 2300; `NodeChangeProperty` 3751–3830; `RGB`/`RGBA` 3942/3950; `FontName` 3980; `FontNameInput` 4023; effects 4297–4632 (`GlassEffect` 4549, `Effect` union 4621); `ImageFilters` 4662; `ImagePaint` 4749; `VideoPaint` 4785; `PatternPaint` 4821; `Paint` union 4883; `Shader` 4969; `Guide` 4993; `ExportSettings*` 5063–5321; `WindingRule` 5325; `BlendMode`/`MaskType` 5478–5500; `Font` 5502; `PluginDataMixin` (100 kB limit) 6466–6520; `BaseNodeMixin` 6306; `SceneNodeMixin` 6584; `MotionNodeMixin` 6750; `ChildrenMixin` (back-to-front, fractional indexing) 6972; `ContainerMixin.expanded` 7603; `ExportMixin`/`exportAsync` 8982–9077; `PublishableMixin` 9306–9350; `DocumentNode`/`documentColorProfile` 10404–10416; `PageNode` 10563–10660; `TransformGroupNode` 10807; `SliceNode` 10817; `TextPathNode` 11027; `ComponentPropertyType` 11078; `SlotNode` 11259; `VariableResolvedDataType` 11664; `VariableValue` 11681; `Variable` 11711; `VariableCollection` 11925; `ExtendedVariableCollection` 11994; `SceneNode` union 12426; `StyleType` 12465; `Image` 12684; `Video` 12701; `TransformModifier` 12822.

REST API `api_types.ts` v0.44.0: `IsLayerTrait` (pluginData, boundVariables, explicitVariableModes) 1–165; `HasExportSettingsTrait` 497; `HasGeometryTrait` (`fillGeometry`, `strokeGeometry`, `geometry=paths`) 504–551; `TypePropertiesTrait` (`characterStyleOverrides`, `styleOverrideTable`, `lineTypes`, `lineIndentations`) 677–727; `Node` union 839; `DocumentNode` 869; `CanvasNode` 875–911; `Constraint` 1364; `ExportSetting` 1383; `BlendMode` 1431; `ImageFilters` 1525; paints 1541–1684 (`ImagePaint` with `imageRef`, `gifRef`, `STRETCH` 1600); `Effect` 2044; `Style` 2050; `ComponentPropertyType` 2410; `Component` 2564; `ComponentSet` 2599; `VariableAlias` 2639; `VariableResolvedDataType` 2973; `StyleType` 3415; `Version` 3492; `LocalVariableCollection` 4601; `LocalVariable` 4691; `GetFileResponse` 5653–5745; `GetFileNodesResponse` 5746; `GetImagesResponse` 5811; `GetImageFillsResponse` 5826; `GetFileVersionsResponse` 6126.

REST `openapi.yaml` v0.44.0: `info.termsOfService` (Developer Terms) ~8; `GET /v1/files/{file_key}` (version, ids, depth, geometry, plugin_data, branch_data) 109–194; `GET /v1/images/{file_key}` (scale 0.01–4, formats, svg_outline_text, svg_include_id, svg_include_node_id, svg_simplify_stroke, contents_only, use_absolute_bounds, 32 MP, 30-day expiry) 279–403; `GET /v1/files/{file_key}/images` (≤ 14-day expiry) 404–441; `GET /v1/files/{file_key}/versions` (page_size 30/max 50) 732–788; `GET /v1/files/{file_key}/variables/local` (Enterprise only) 2222–2275.

### 9.2 Official Figma Help Center articles
Seen only as **search excerpts** in this session (bodies not read):
- 13402894554519 Export formats and settings for static designs — https://help.figma.com/hc/en-us/articles/13402894554519
- 360040030374 Copy assets between design tools — https://help.figma.com/hc/en-us/articles/360040030374
- 8403626871063 Save a local copy of files — https://help.figma.com/hc/en-us/articles/8403626871063
- 360040027794 Guide to imports in Figma Design — https://help.figma.com/hc/en-us/articles/360040027794
- 360038006754 (version history) — https://help.figma.com/hc/en-us/articles/360038006754
- 360039825114 (color management / color profiles) — https://help.figma.com/hc/en-us/articles/360039825114
- 360040328553 What can I do offline in Figma? — https://help.figma.com/hc/en-us/articles/360040328553
- 360040028034 Add images and videos to designs — https://help.figma.com/hc/en-us/articles/360040028034
- 360041089973 Add images and videos in bulk — https://help.figma.com/hc/en-us/articles/360041089973
- 360039956994 (missing fonts) — https://help.figma.com/hc/en-us/articles/360039956994
- 360052679454 Access shared resources in an organization — https://help.figma.com/hc/en-us/articles/360052679454

Known from the 2026-09-27 catalog (title/ID only, not read): 360040028114 Export static designs from Figma; 41307983648407 Export animations from Figma; 360040514273 Import Sketch files; 360041003114 Import files to the file browser; 4409078832791 Copy and paste objects; 4412765442967 Copy and paste properties between layers; 360038511413 Set custom thumbnails for files; 360041051154 Guide to libraries in Figma; 360025508373 Publish a library; 360039234193 Review and accept library updates; 4404856784663 Swap libraries; 360063144053 Guide to branching; 5691189138839 Merge branch into main file; 360039825314 Guide to comments in Figma; 360040322673 Present to collaborators using spotlight; 4403130802199 Use cursor chat; 29638316371479 See viewer history; 26463081577367 Present prototypes offline; 360040321093 View prototypes on a mobile device; 360041486873 Use animated GIFs in prototypes; 37998629035799 Work with the Figma agent in design files; 40826832449303 Turn coded screens into editable design layers; 42031586813719 Use auto layout with CSS Flexbox in mind (via old feature guide).

### 9.3 Live observation
- [OBS] `old/docs/figma/observations/2026-09-27-live-figma.md`: Frame inspector shows an Export section; container layout settings show "Layout = Updated".

### 9.4 Other sources
Read in full this session (via GitHub raw / npm registry):
- `fig-kiwi` npm README & metadata (v0.0.1, 2022, no license) — https://registry.npmjs.org/fig-kiwi
- `kiwi-schema` npm metadata (MIT) — https://registry.npmjs.org/kiwi-schema ; Kiwi README & LICENSE — https://github.com/evanw/kiwi
- `openfig-core` npm metadata (v0.4.1, MIT) — https://registry.npmjs.org/openfig-core
- `fig2sketch` README & LICENSE (MIT, Sketch B.V.) — https://github.com/sketch-hq/fig2sketch
- DTCG format chapters (`file-format.md`, `types.md`, `aliases.md`, `groups.md`, `composite-types.md`, `design-token.md`) — https://github.com/design-tokens/community-group/tree/main/technical-reports/format

Search excerpts only:
- Grida `.fig` format notes — https://grida.co/docs/wg/feat-fig/ ; Grida Figma copy-paste — https://grida.co/docs/editor/features/copy-paste-figma
- figma-parser — https://github.com/sunyui/figma-parser
- Simon Willison, "The web's clipboard" — https://simonwillison.net/2024/Sep/19/the-webs-clipboard
- agent-native Figma clipboard importer — https://cdn.jsdelivr.net/npm/@agent-native/core@0.124.6/corpus/templates/design/actions/import-figma-clipboard.ts
- Tencent Cloud article decoding Figma clipboard — https://cloud.tencent.com/developer/article/2435928
- Figma forum threads (forum.figma.com): clarification-on-figmas-memory-usage-13811; t/my-figma-file-is-not-loading/44391; this-document-contains-unsaved-changes-why-27915; t/ctrl-shift-v-vs-ctrl-shift-r/57124; paste-files-after-copy-as-png-svg-macos-15378; t/import-svg/56630; import-svg-4221; t/importing-svg-not-working-properly/2144; importing-sag-logo-file-into-figma-12365; allow-pasting-from-illustrator-as-vector-14524; svg-export-incorrect-color-profile-39416; problem-with-managing-image-colour-profiles-34569; t/pdf-export-text-not-selectable/286; fix-pdf-export-support-font-embedding-instead-of-vector-outlining-50699; links-between-pages-in-pdf-export-23760; export-a-single-multi-page-pdf-from-selected-frames-without-creating-a-new-page-49835; exporting-to-svg-and-preserving-hyperlinks-36293; native-variable-export-feature-47831; t/maximum-image-size/3203
- DTCG/Figma native export: https://github.com/civictheme/uikit/pull/1025 ; https://www.misha.wtf/blog/figma-dtcg-design-tokens ; https://atomize.tools/blog/figma-design-tokens-guide/
- PDF multi-frame guide — https://www.layerpath.com/learn/how-to-export-multiple-frames-in-figma-as-one-pdf
- Color management — https://bjango.com/articles/colourmanagementsettings/
- Previous Illigma prototype docs (context only): `old/docs/figma/feature-guide.md` §16, `old/README.md`.

Not obtainable this session (search budget exhausted / domains blocked): Figma Terms of Service text, REST token expiry & rate-limit documentation, full help-article bodies — see §8 V-26, V-27, V-35.
