# Variables, modes, styles, libraries & design-system management — Figma parity spec

> **Status:** research draft (date 2026-10-08). **Nothing implemented.** Every checklist item below is status **Not started**. No item may be marked "1:1 parity" until it is implemented **and** validated against live Figma behavior with the test given in the item.
>
> **Behavior source of truth:** Figma (Figma Design, UI3, as of 2026). **Visual source of truth:** Framer (handled in the design-system docs, not here). This document specifies behavior only.
>
> **Evidence legend** (every behavioral claim is tagged):
> - **[API]** — Figma Plugin API typings v1.141.0 (`plugin-api.d.ts`) or Figma REST API types v0.44.0 (`api_types.ts`). Line references are in §9.
> - **[DOC:<id>]** — an official Figma Help Center article. **"excerpt"** means only a web-search excerpt of the article was seen in this session, not the full body. **"title"** means only the article's existence/title is known (from the 2026-09-27 source catalog).
> - **[OBS]** — the 2026-09-27 read-only live Figma UI observation (`old/docs/figma/observations/2026-09-27-live-figma.md`).
> - **[KNOW]** — the author's prior knowledge of Figma, **not verified in this session**. Everything correctness-relevant that rests only on [KNOW] or [SRC] is repeated in §8 as a live-verification experiment.
> - **[SRC:<url>]** — another web source (forum, GitHub issue, third-party blog), usually seen only as a search excerpt.
>
> **Research limits (honest disclosure):** No live Figma session was used for this document. No Help Center article body was read in full (help.figma.com is not fetchable from this environment); 10 web searches returned excerpts before the shared web-search budget for this run was exhausted, so many UI-level details are [KNOW] and are queued for verification in §8.

---

## 1. Scope & terminology

### 1.1 Figma terms used in this document

| Term | Meaning in Figma | Evidence |
| --- | --- | --- |
| **Variable** | A named, typed, reusable value with one value **per mode** of its collection. Resolved types: `BOOLEAN`, `COLOR`, `FLOAT` (UI: "Number"), `STRING`, plus Motion-only `TIMING` and `EASING`. | [API] [DOC:14506821864087 excerpt] |
| **Variable collection** | A set of variables that share the same list of modes. Every variable belongs to exactly one collection (`variableCollectionId` is read-only). | [API] |
| **Mode** | A named column of values in a collection (e.g. Light/Dark, Brand A/B, Compact/Comfortable). A collection always has ≥ 1 mode and exactly one **default mode** (`defaultModeId`). | [API] |
| **Alias** | A variable value that references another variable (`VariableAlias {type:'VARIABLE_ALIAS', id}`) instead of a raw value; may cross collections and libraries. | [API] |
| **Composed color** | A COLOR value made of a color part and an opacity part where at least one part is an alias (`VariableComposedColor`). Introduced 2026 ("control opacity at scale"). | [API] [SRC:https://github.com/figma/plugin-typings/issues/375 excerpt] |
| **Scope** | Per-variable list of property families in whose **pickers** the variable is offered (`VariableScope[]`). Scopes filter UI pickers only; they do not prevent binding. | [API] |
| **Code syntax** | Per-platform (`WEB`, `ANDROID`, `iOS`) code name for a variable, shown to developers. | [API] |
| **Group** | Purely name-derived hierarchy: slash-separated segments of a variable's name (`color/bg/primary`). Not a stored object. | [API] (`variableIds` "does not account for groups") [DOC:15145852043927 excerpt] |
| **Extended collection** | A collection that inherits every variable and mode of a parent collection and stores per-mode **overrides** (`variableOverrides`). Used for multi-brand theming. Figma: Enterprise plan only. | [API] [DOC:36346281624471 excerpt] |
| **Binding / bound variable** | A node (or paint, effect, layout grid, text range, style, component property) field whose value is driven by a variable (`boundVariables`). | [API] |
| **Explicit mode** | A mode chosen for a collection on a specific page or layer (`explicitVariableModes`). | [API] |
| **Auto mode / inherited mode** | No explicit mode on the layer; the layer inherits the mode from its nearest ancestor that has one, else the collection default. UI label "Auto". | [API] (`resolvedVariableModes` doc links "Auto mode") [KNOW] UI label |
| **Resolved mode** | The effective mode per collection for a node (`resolvedVariableModes`), derived; never stored. | [API] |
| **Inferred variable** | A variable whose value uniquely matches a raw (unbound) field value within the variable's scopes (`inferredVariables`). Derived, used for suggestions. | [API] |
| **Style** | A named reusable bundle of a whole property list: **Paint** (UI: color style; can hold multiple paints incl. gradients/images), **Text**, **Effect**, **Grid** (UI3: "layout guide style"). Motion adds `CUSTOM_ANIMATION` styles. | [API] [DOC:360038746534 title] |
| **Style folder** | Slash-delimited name prefix of a style; folders are ordered and can be nested. | [API] (`moveLocal*FolderAfter`) |
| **Library** | A file whose non-hidden components, styles, variables and collections are published for use in other files. | [DOC:360041051154 title] |
| **Local vs remote** | Local = defined in this file (editable). Remote = imported from a library (read-only, `remote: true`). | [API] |
| **Publish status** | `UNPUBLISHED` \| `CURRENT` \| `CHANGED` per publishable asset. | [API] |
| **Hidden from publishing** | Asset stays usable inside its own file but is not published. Variables: explicit flag on variable **and** collection. Styles/components: name prefix `_` or `.` [KNOW] (article [DOC:360039238193 title]). | [API] [KNOW] |
| **Library update** | A newer published version of library assets that consumer files must review/accept before it applies. | [DOC:360039234193 title] [KNOW] |
| **Swap library** | Bulk-replace a file's usages of one library's assets with another library's matching assets. | [DOC:4404856784663 title] [KNOW] |
| **Expression** | Arithmetic/logic over variables, **only in prototype actions** (set variable, conditionals). Variables cannot store expressions as values. | [API] [DOC:15253194385943 title] |

### 1.2 Terms users confuse (implementers must not conflate)

1. **Style vs variable.** A style stores a *whole property list* (all fills, all effects, a full text spec) and has no modes. A variable stores a *single typed value per mode* and binds to one field. Styles can themselves contain variable-bound values. [API] [DOC:15871097384471 title]
2. **Color style vs color variable.** A paint style may contain multiple paints, gradients and images; a COLOR variable is a single RGBA (or composed color). Both appear in the fill picker "Libraries" tab. [API] [OBS: fill popover has Custom/Libraries tabs] [KNOW]
3. **Mode vs variant vs theme.** Modes are collection columns switched per layer; variants are component-set members. A "theme" is a user concept usually implemented as modes.
4. **Collection vs group vs folder.** Collections are stored objects that own modes; groups (variables) and folders (styles) are name prefixes.
5. **Default mode vs Auto.** Default mode is a property of the collection; Auto is the *absence* of an explicit mode on a layer.
6. **Hide from publishing vs delete.** Hidden assets remain usable locally.
7. **Detach style / detach variable vs detach instance.** Detaching a style or variable replaces the reference with its current raw value; detaching an instance converts an instance to a frame (components spec).
8. **Scope vs type.** Type restricts what a variable *can* hold; scope only decides in which pickers it is *offered*.
9. **Bound vs inferred.** Bound = stored reference; inferred = computed suggestion only.
10. **Local variables vs library variables.** Remote variables are read-only copies of the library's published values at the accepted version.

### 1.3 In scope for Illigma (local-first)

- All document-level data and behavior: variables (all four core types), collections, modes, aliases, composed colors, scopes, code syntax, descriptions, hide-from-publishing flags, groups, extended collections, every binding site, explicit modes and resolution, the variables table UI, all four style types, style folders/order, styles with variable values, selection colors, undo/redo, copy/paste, export resolution.
- **Libraries re-mapped to local files**: any `.illigma` file can be published as a library *to disk* (a versioned publish snapshot inside/next to the file); other files link to it by stable library ID + last known path; update review/accept, swap library, missing-library handling and unpublish all operate on local files.
- Import/export of variables: per-mode JSON (Figma's native DTCG-style mode export/import), full-collection W3C DTCG 2025.10 token files, and Figma REST "local variables" JSON.
- Data preservation (round-trip without loss) for Motion `TIMING`/`EASING` variables and `CUSTOM_ANIMATION` styles, even before Motion is implemented.

### 1.4 Out of scope / deliberately different

| Figma feature | Illigma decision |
| --- | --- |
| Team/organization/workspace library enablement, permissions, "enable for team", draft-library access, library analytics, "default libraries" set by admins | **Out of scope.** Libraries are enabled per file by the user. Library analytics out of scope by task definition. |
| Pricing-tier gating (mode caps per plan, Enterprise-only extended collections) | **No plan gating.** See open question Q1 for the mode cap. |
| REST/Plugin API endpoints | Not implemented; used only as the authoritative data model. |
| Multiplayer, branching/merging of variables | Out of scope here (version history is M8). |
| "Check designs" AI linter and AI variable suggestion | Out of scope (external AI service). The **deterministic** `inferredVariables` rule is in scope (P2). |
| Dev Mode code panel | Out of scope here; code syntax **data** is stored, edited and exported (handoff area owns display). |
| Workspace/team-default modes (mentioned in typings) | Out of scope; no team concept. [API] |
| Figma Motion editing UI for timing/easing variables | M7 cross-area; this area only stores/round-trips them. |

---

## 2. Data model

Everything in §2.1–§2.9 is **document data** persisted in the file (or the library snapshot) unless marked *derived* or *UI state*. Names in `code` are Figma's names; Illigma should keep the same names in its schema to ease `.fig`/JSON interop.

### 2.1 Variable [API]

| Field | Type / values | Default on create | Notes |
| --- | --- | --- | --- |
| `id` | string, unique in document | generated | Never reused. Bindings reference `id`, so renames never break bindings. |
| `key` | string | generated | Stable publish identity across library versions. Present on local variables, importable only once published. |
| `name` | string; `/` separates groups | type-based default name [KNOW] | Uniqueness/character rules: §3.3. |
| `description` | plain string | `""` | Variables have plain text descriptions (no markdown in API). |
| `hiddenFromPublishing` | boolean | `false` | Can only be true for local variables. Publishable iff `!variable.hiddenFromPublishing && !collection.hiddenFromPublishing`. |
| `remote` | boolean, read-only | `false` | `true` for library variables imported into a consumer file; remote variables are read-only. |
| `variableCollectionId` | string, read-only | — | A variable cannot change collection through the API. |
| `resolvedType` | `'BOOLEAN' \| 'COLOR' \| 'FLOAT' \| 'STRING' \| 'TIMING' \| 'EASING'`, read-only | chosen at create | **Type is immutable after creation.** |
| `valuesByMode` | `{ [modeId]: VariableValue }` | one entry per mode | Unresolved (aliases kept). Must have a value for every mode of the collection. |
| `scopes` | `VariableScope[]` | `['ALL_SCOPES']` [KNOW] | See §2.4. |
| `codeSyntax` | `{ WEB?, ANDROID?, iOS? }` strings | `{}` | Set/remove per platform. |
| `deletedButReferenced` | boolean (REST) | — | Variable deleted in the editor but still referenced by bindings or aliases (soft-delete). |
| `pluginData` / `sharedPluginData` | key-value | — | Preserve on round-trip; no UI. |

### 2.2 Values by type [API]

| `resolvedType` | Stored value shape | Notes |
| --- | --- | --- |
| `BOOLEAN` | `boolean` | |
| `FLOAT` | `number` (finite) | Negative and fractional allowed [KNOW]; display precision §3.4. |
| `STRING` | `string` | |
| `COLOR` | `RGBA {r,g,b,a}` each 0–1 (plugin also accepts `RGB`) **or** `VariableComposedColor` | Composed: `{color: RGB\|RGBA, opacity: VariableAlias}` or `{color: VariableAlias, opacity: number \| VariableAlias}`. A literal color with a literal opacity is **not** a valid composed color [API] [SRC:https://github.com/figma/plugin-typings/issues/381 excerpt]. |
| `TIMING` | `number` (API doc for Motion uses **seconds**; Help Center describes ms in UI) | Motion only. Unit conflict → V-58. [API] [DOC:14506821864087 excerpt] |
| `EASING` | `MotionEasing {type, easingFunctionCubicBezier?, easingFunctionSpring?{bounce 0..1}}` | `type` ∈ `EASE_IN, EASE_OUT, EASE_IN_AND_OUT, LINEAR, EASE_IN_BACK, EASE_OUT_BACK, EASE_IN_AND_OUT_BACK, CUSTOM_CUBIC_BEZIER, GENTLE, QUICK, BOUNCY, SLOW, CUSTOM_SPRING, HOLD`. Motion only. |
| any | `VariableAlias {type:'VARIABLE_ALIAS', id}` | Target must **resolve to the same type** (REST: "If setting to a variable alias, the alias must resolve to this type"). |

### 2.3 Variable collection [API]

| Field | Type | Notes |
| --- | --- | --- |
| `id`, `key` | string | `key` used to look up a published collection's variables. |
| `name` | string | |
| `hiddenFromPublishing` | boolean | Hides the whole collection and therefore every variable in it. |
| `remote` | boolean | Library collection in a consumer file. |
| `isExtension` | boolean | `true` only for extended collections. |
| `modes` | ordered `{modeId, name}[]` | Order = column order in the table. |
| `defaultModeId` | string | Must be one of `modes`. |
| `variableIds` | ordered string[] | Order is "roughly" the UI order but **does not encode groups**; Illigma must persist its own full order including group positions (see §3.8). |
| Operations | `addMode(name) → modeId` (throws when over the plan limit: "Limited to N modes only"), `removeMode(id)`, `renameMode(id,name)`, `remove()` (deletes collection **and all its variables**), `extend(name)` (local collections only) | |

### 2.4 Variable scopes [API]

`VariableScope` = `ALL_SCOPES, TEXT_CONTENT, CORNER_RADIUS, WIDTH_HEIGHT, GAP, ALL_FILLS, FRAME_FILL, SHAPE_FILL, TEXT_FILL, STROKE_COLOR, STROKE_FLOAT, EFFECT_FLOAT, EFFECT_COLOR, OPACITY, COLOR_OPACITY, FONT_FAMILY, FONT_STYLE, FONT_WEIGHT, FONT_SIZE, LINE_HEIGHT, LETTER_SPACING, PARAGRAPH_SPACING, PARAGRAPH_INDENT` (+ REST-only `FONT_VARIATIONS`).

Rules from the REST documentation [API]:
- Scopes are supported on `FLOAT`, `STRING`, `COLOR` variables (not `BOOLEAN`).
- `ALL_SCOPES` is exclusive: if set, no other scope may be set.
- `ALL_FILLS` is exclusive among fill scopes: if set, `FRAME_FILL`, `SHAPE_FILL`, `TEXT_FILL` may not be set.
- `OPACITY` = layer opacity; `COLOR_OPACITY` = the opacity channel of a color.
- Setting scopes only filters UI pickers; it **does not prevent** binding through other paths and does **not** remove existing bindings.

| Type | Valid scopes (REST doc list) |
| --- | --- |
| `FLOAT` | `ALL_SCOPES, TEXT_CONTENT, WIDTH_HEIGHT, GAP, STROKE_FLOAT, EFFECT_FLOAT, OPACITY, COLOR_OPACITY, FONT_WEIGHT, FONT_SIZE, LINE_HEIGHT, LETTER_SPACING, PARAGRAPH_SPACING, PARAGRAPH_INDENT` — **plus `CORNER_RADIUS`** which exists in the enum and in the Figma UI [KNOW] but is missing from the REST doc list (doc omission? → V-12); `FONT_VARIATIONS` (REST enum only) |
| `STRING` | `ALL_SCOPES, TEXT_CONTENT, FONT_FAMILY, FONT_STYLE` |
| `COLOR` | `ALL_SCOPES, ALL_FILLS, FRAME_FILL, SHAPE_FILL, TEXT_FILL, STROKE_COLOR, EFFECT_COLOR` |
| `BOOLEAN` | none (always offered wherever booleans bind) |

A third-party report mentions a `TRANSFORM` scope present in Figma but missing from typings [SRC:https://github.com/figma/plugin-typings/issues/375 title] → V-13.

### 2.5 Extended variable collection [API]

| Field | Notes |
| --- | --- |
| `isExtension: true` | |
| `parentVariableCollectionId` | Direct parent (local or library collection). |
| `rootVariableCollectionId` | Top of the chain (C extends B extends A → A). |
| `variableIds` | Includes **inherited** variables (same variable IDs as the parent). |
| `modes[]: {modeId, name, parentModeId}` | One extended mode per parent mode; names inherited. REST: `parentModeId` undefined if the mode does not inherit. |
| `variableOverrides: {[variableId]: {[extendedModeId]: VariableValue}}` | Only overridden cells are stored. |
| No `addMode` | Modes cannot be added on an extension; `removeMode` only allowed when the parent mode has been deleted. REST: modes cannot be created/updated on extended collections. |
| `removeOverridesForVariable(v)`, `Variable.removeOverrideForMode(extendedModeId)` | Reset to inherited. |
| `Variable.setValueForMode(extendedModeId, v)` | Writes an override on the extension. |
| `Variable.valuesByModeForCollectionAsync(coll)` | Overridden-or-inherited values for that extension. |

### 2.6 Node-side variable data [API]

| Field | Kind | Notes |
| --- | --- | --- |
| `boundVariables[field]` | document | `VariableAlias` per scalar field; arrays for `fills`, `strokes`, `effects`, `layoutGrids`, `textRangeFills`, and for text fields (`fontSize` etc. are `VariableAlias[]` at node level because ranges may differ); `componentProperties: {[propName]: VariableAlias}`. |
| `explicitVariableModes: {[collectionId]: modeId}` | document | On **every SceneNode** (via `SceneNodeMixin`) and on **PageNode**. Does not include workspace/team-default modes. |
| `resolvedVariableModes: {[collectionId]: modeId}` | *derived* | Explicit modes of the node + ancestors. |
| `inferredVariables[field]` | *derived* | Only for unbound fields; a variable is inferred only when it is the **single** match for the raw value among variables whose scope covers that field; candidates come from local collections and from library variables already used in the file. Fills/strokes are per paint index. |
| Paint `SolidPaint.boundVariables.color` | document | Per paint in `fills`/`strokes`. |
| Gradient `ColorStop.boundVariables.color` | document | Per gradient stop. |
| Shadow effects `boundVariables` | document | `color, radius, spread, offsetX, offsetY`. |
| Blur effects `boundVariables` | document | `radius` only (progressive blur `startRadius`/offsets not bindable). |
| Noise / Texture / Glass effects | — | `boundVariables: {}` — nothing bindable. |
| Layout grid `boundVariables` | document | Rows/columns: `sectionSize, count, offset, gutterSize` (REST: `numSections`); grid pattern: `sectionSize` only. |
| Text range `setRangeBoundVariable(start,end,field,v)` | document | Text fields per character range; `getRangeBoundVariable` may return `mixed`. |
| Component property **instance values** `componentProperties[name].boundVariables.value` | document | |
| Component property **definitions** `componentPropertyDefinitions[name].boundVariables.defaultValue` | document | |

**Bindable node fields** (`VariableBindableNodeField`) [API]: `height, width, characters, itemSpacing, paddingLeft, paddingRight, paddingTop, paddingBottom, visible, cornerRadius, topLeftRadius, topRightRadius, bottomLeftRadius, bottomRightRadius, minWidth, maxWidth, minHeight, maxHeight, counterAxisSpacing, strokeWeight, strokeTopWeight, strokeRightWeight, strokeBottomWeight, strokeLeftWeight, opacity, gridRowGap, gridColumnGap`.
**Bindable text fields** (`VariableBindableTextField`): `fontFamily, fontSize, fontStyle, fontWeight, letterSpacing, lineHeight, paragraphSpacing, paragraphIndent`.
Special rule: on nodes with independent corner radii, a `cornerRadius` binding sets all four corners and is **stored as four per-corner bindings** (`topLeftRadius` … `bottomRightRadius`), not as `cornerRadius` [API].

**Field → expected variable type → scope** (Illigma binding matrix; scope column from §2.4, type column [API]+[KNOW]):

| Field(s) | Var type | Scope that offers it |
| --- | --- | --- |
| `width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight` | FLOAT | `WIDTH_HEIGHT` |
| `itemSpacing`, `counterAxisSpacing`, `gridRowGap`, `gridColumnGap`, `padding*` | FLOAT | `GAP` (padding offered under Gap [KNOW] → V-14) |
| `cornerRadius`, per-corner radii | FLOAT | `CORNER_RADIUS` |
| `strokeWeight`, per-side weights | FLOAT | `STROKE_FLOAT` |
| `opacity` (layer) | FLOAT | `OPACITY` |
| paint opacity / composed color opacity | FLOAT | `COLOR_OPACITY` |
| `visible` | BOOLEAN | — |
| `characters` | STRING (also FLOAT per REST `TEXT_CONTENT` scope list) | `TEXT_CONTENT` |
| `fontFamily` | STRING | `FONT_FAMILY` |
| `fontStyle` | STRING | `FONT_STYLE` |
| `fontWeight` | FLOAT | `FONT_WEIGHT` |
| `fontSize`, `lineHeight`, `letterSpacing`, `paragraphSpacing`, `paragraphIndent` | FLOAT | `FONT_SIZE`, `LINE_HEIGHT`, `LETTER_SPACING`, `PARAGRAPH_SPACING`, `PARAGRAPH_INDENT` |
| fill paint color / gradient stop color | COLOR | `ALL_FILLS` or `FRAME_FILL` / `SHAPE_FILL` / `TEXT_FILL` by node kind |
| stroke paint color | COLOR | `STROKE_COLOR` |
| shadow color | COLOR | `EFFECT_COLOR` |
| shadow radius/spread/offsets, blur radius | FLOAT | `EFFECT_FLOAT` |
| layout grid count/size/gutter/offset | FLOAT | (no dedicated scope; offered with `ALL_SCOPES` [KNOW] → V-15) |
| component property value/default (BOOLEAN / TEXT) | BOOLEAN / STRING | — |
| Motion durations/delays; easing | TIMING; EASING | (Motion, M7) |
| prototype `SET_VARIABLE` / conditions | any | (M7) |

### 2.7 Styles [API]

| Object | Fields | Notes |
| --- | --- | --- |
| `BaseStyle` (all) | `id`, `key`, `type: 'PAINT'\|'TEXT'\|'EFFECT'\|'GRID'\|'CUSTOM_ANIMATION'`, `name` (slash = folders), `description` (plain), `descriptionMarkdown` (rich), `documentationLinks` (≤ 1 link supported), `remote`, `getPublishStatusAsync()`, `getStyleConsumersAsync() → {node, fields: InheritedStyleField[]}[]`, `remove()` | REST style types: `FILL, TEXT, EFFECT, GRID`. |
| `PaintStyle` | `paints: Paint[]`, `boundVariables.paints: VariableAlias[]` | Applied via `fillStyleId`, `strokeStyleId` (and text-range `fillStyleId`). |
| `TextStyle` | `fontName` (incl. variable-font `variationSettings`), `fontSize`, `letterSpacing`, `lineHeight`, `leadingTrim`, `paragraphIndent`, `paragraphSpacing`, `listSpacing`, `hangingPunctuation`, `hangingList`, `textCase`, `textDecoration`, `textWrapStyle`, `boundVariables[VariableBindableTextField]`, `setBoundVariable()` | Default created text style: Inter Regular 12. Not in text style: color, alignment, auto-resize. |
| `EffectStyle` | `effects: Effect[]`, `boundVariables.effects` | |
| `GridStyle` | `layoutGrids: LayoutGrid[]`, `boundVariables.layoutGrids` | |
| `CustomAnimationStyle` | `animationEntries[]` | Motion; preserve only. |
| Node references | `fillStyleId`, `strokeStyleId`, `textStyleId` (may be `mixed` on text), `effectStyleId`, `gridStyleId`, deprecated `backgroundStyleId`; text ranges `getRange/setRangeTextStyleIdAsync`, `getRange/setRangeFillStyleIdAsync` | |
| Text style overrides | `textStyleOverrides: ('SEMANTIC_ITALIC'\|'SEMANTIC_WEIGHT'\|'HYPERLINK'\|'TEXT_DECORATION')[]` per segment | Overrides that can coexist with an applied text style. REST: `TypeStyle.isOverrideOverTextStyle`. |
| Ordering | Per style type: ordered list of styles **within a folder** + ordered list of folders within a parent folder (`moveLocal{Paint,Text,Effect,Grid}StyleAfter`, `moveLocal…FolderAfter` using the full delimited folder path) | REST `PublishedStyle.sort_position` exposes the order to consumers. |

### 2.8 Libraries & publishing [API]

| Item | Notes |
| --- | --- |
| `PublishStatus` | `UNPUBLISHED` (never published), `CURRENT` (published == local), `CHANGED` (local differs from last publish). On styles, components, variables, collections. |
| `LibraryVariableCollection {name, key, libraryName}`, `LibraryVariable {name, key, resolvedType}` | Descriptors of published, enabled-library content available to a file. |
| REST `PublishedVariable` / `PublishedVariableCollection` | `subscribed_id` changes **every time** the asset is modified and published; `updatedAt` timestamp. |
| REST `PublishedStyle` | `key, file_key, node_id, style_type, thumbnail_url, name, description, created_at, updated_at, user, sort_position`. |
| Import | `importVariableByKeyAsync`, `importStyleByKeyAsync`, `extendLibraryCollectionByKeyAsync` — consumer gets a **remote** read-only copy. |

**Illigma local-first mapping (proposed schema, not Figma data):** `LibraryRef {libraryId (UUID of source file), lastKnownPath, acceptedVersion, enabled}`; `PublishedSnapshot {libraryId, version (monotonic int), publishedAt, message, assets: {key → serialized asset}}`; remote assets in a consumer file carry `{libraryId, key, acceptedVersion}` plus a cached copy of the published value so the file renders without the library.

### 2.9 Prototype-only variable data (cross-area M7) [API]

`VariableData {type?: 'BOOLEAN'|'COLOR'|'EASING'|'EXPRESSION'|'FLOAT'|'STRING'|'TIMING'|'VARIABLE_ALIAS', resolvedType?, value?: VariableValue | Expression}`; `Expression {expressionFunction, expressionArguments: VariableData[]}`; `ExpressionFunction` ∈ `ADDITION, SUBTRACTION, MULTIPLICATION, DIVISION, EQUALS, NOT_EQUAL, LESS_THAN, LESS_THAN_OR_EQUAL, GREATER_THAN, GREATER_THAN_OR_EQUAL, AND, OR, VAR_MODE_LOOKUP, NEGATE, NOT`; actions `SET_VARIABLE {variableId, variableValue}`, `SET_VARIABLE_MODE {variableCollectionId, variableModeId}`, `CONDITIONAL {conditionalBlocks: {condition?, actions}[]}`. **`Variable.valuesByMode` cannot contain an `Expression`** — expressions exist only inside prototype actions.

### 2.10 Document data vs transient UI state

| Document data (persist, undoable) | Transient UI / session state (not in undo stack) |
| --- | --- |
| Collections, modes, default mode, variables, values, aliases, overrides, scopes, code syntax, descriptions, hidden flags, variable order incl. group order, explicit modes on pages/nodes, all bindings, styles and their order/folders, style refs on nodes, text style overrides, library links (`LibraryRef`), accepted versions, cached remote assets, publish snapshots (library files) | Variables-modal open/closed, its size/position, selected collection in the sidebar, sidebar visibility, collapsed groups, column widths, search query, selected rows, style picker list-vs-grid view, picker search text, "show updates for all pages" toggle, which library is expanded in the libraries modal |
| *Derived (never persisted, recomputed):* resolved modes, resolved values, inferred variables, publish status, style consumers, usage counts | |

---
## 3. Behavior specification

Conventions: "the file" = the open Illigma document. "Commit" = one undo step (see §3.20). Modifier keys are given as macOS / Windows.

### 3.1 Collections

1. **Create.** In the variables modal sidebar, *More options → Create collection* creates a new local collection with one mode [DOC:15145852043927 excerpt]. Default collection name is `Collection` and the first mode is `Mode 1` [KNOW]; the new collection's name is put in rename state [KNOW]. Creating the first variable in a file that has no collection implicitly creates a collection [KNOW] (→ V-01).
2. **Rename.** From the collections list (sidebar or dropdown) choose rename, or double-click the collection name [DOC:15145852043927 excerpt — rename/delete steps only partially seen] [KNOW]. Empty names are rejected (revert to previous) [KNOW]. Duplicate collection names are allowed [KNOW] (→ V-02).
3. **Delete.** Deletes the collection **and all its variables** [API `VariableCollection.remove`]. Bindings to deleted variables become *deleted-but-referenced* (§3.3.7). One undo step restores everything, including bindings.
4. **Order.** Collections are listed in creation order and can be reordered by drag in the sidebar [KNOW] (→ V-03). Order is document data.
5. **Hide from publishing** (collection setting): hides every variable in the collection from publishing irrespective of each variable's own flag [API].
6. **Duplicate collection**: availability in Figma UI is unconfirmed (→ V-04). If present, it must copy modes (new mode IDs), variables (new IDs/keys), values; aliases pointing *inside* the source collection are re-pointed to the duplicates; aliases pointing outside are kept.
7. **Limits.** Up to **5,000 variables per collection** [DOC:15145852043927 excerpt] [SRC:https://forum.figma.com/ask-the-community-7/what-are-the-limits-for-the-number-of-variables-in-a-file-10909 excerpt]. Illigma must enforce the same cap with a clear error and must stay interactive (§3.22) at that size.

### 3.2 Modes

1. **Add mode**: a `+` control after the last mode column appends a mode named `Mode N` (N = next integer) [KNOW]. New-mode cell values are **copied from the default mode** (aliases copied as aliases) [KNOW] (→ V-05). Not available on extended collections [API].
2. **Rename mode**: double-click the column header or context menu *Rename mode* [KNOW]. Mode names are display-only; bindings reference `modeId`.
3. **Duplicate mode**: context menu on the header; inserts a copy (all values copied, new `modeId`) to the right of the source, named `<name> copy` [KNOW] (→ V-06).
4. **Delete mode**: context menu; **disabled when the collection has a single mode** [KNOW]. Any explicit mode referencing the deleted mode on any node falls back to Auto/inherited resolution [KNOW] (→ V-07). On an extended collection, an inherited mode can only be removed after its parent mode was deleted [API].
5. **Default mode**: exactly one per collection [API]. It is the mode used when no explicit mode applies anywhere in the ancestry. In the table it is the first mode column; changing the default is done by reordering modes (drag the header to first position) and/or a *Set as default* command [KNOW] (→ V-08).
6. **Reorder modes**: drag column headers [KNOW] (→ V-08). Order is document data.
7. **Mode count limits (Figma, plan-dependent)**: Starter = 1 mode (typings: "Starter plan … limited to a single mode") [API]; Professional up to 10, Organization up to 20, Enterprise "unlimited with extended collections" per current plan table [DOC:360040328273 excerpt; column mapping inferred] — historically 4 / 4 / 40 [SRC:forum.figma.com mode-limit thread excerpt]. `addMode` throws `in addMode: Limited to N modes only` when exceeded [API]. **Illigma:** no plan gating; see Q1 for the cap.
8. **Import / export a single mode** (right-click mode header → *Export mode* / *Import mode*): §3.18.

### 3.3 Variables — create, edit, delete

1. **Create**: *+ Create variable* (bottom of the table) opens a type menu: **Color, Number, String, Boolean** (plus Timing/Easing where Motion is available) [DOC:14506821864087 excerpt] [KNOW]. The variable is created in the currently shown collection and — if a group is selected in the sidebar — inside that group (name prefixed with the group path) [KNOW] (→ V-09). The name cell enters edit mode immediately [KNOW].
2. **Default value per type**: Color `#FFFFFF` 100 %, Number `0`, String empty, Boolean `true` [KNOW] (→ V-10). Every mode receives the same default.
3. **Naming rules**:
   - `/` creates groups (§3.9). Leading/trailing spaces around segments are trimmed [KNOW] (→ V-11).
   - Names must be unique **within a collection** (including group path); attempting a duplicate shows an error and reverts [KNOW] (→ V-11).
   - Forbidden characters: `$` confirmed rejected; `.`, `{`, `}` reported as rejected (DTCG reference syntax) [SRC:https://forum.figma.com/t/allow-special-characters-in-variable-names/45692/3 excerpt] [SRC:https://forum.figma.com/share-your-feedback-26/allow-dots-in-variable-names-48096 excerpt]. A name beginning with `.` produced a "special characters" error toast [SRC same thread]. Illigma: reject `$ . { }` with an error toast until V-11 confirms the exact set.
   - Empty name is rejected.
4. **Rename** (double-click name cell, or *Edit variable* panel): updates the display name everywhere (bindings use `id`) and moves the variable between groups if the path changes.
5. **Edit variable panel** (context menu *Edit variable*, or the row's edit/settings control) shows: Name, Description, **Scoping** (§3.5, not for Boolean), **Code syntax** (§3.6), **Hide from publishing** (§3.7) [KNOW] (→ V-16). For remote variables the panel is read-only [API remote].
6. **Duplicate**: context menu *Duplicate*; duplicates selected variables directly below their sources with the name suffix ` copy` (incrementing on collision) [KNOW]; one search excerpt says selected variables can be duplicated with **Shift+Enter** [DOC:15145852043927 excerpt] (→ V-17). Duplicates copy every mode value, description, scopes, code syntax, hidden flag; aliases are copied as aliases.
7. **Delete**: context menu *Delete* or Delete/Backspace with rows selected [KNOW]. The variable is removed from the table, but **bindings and aliases that reference it are retained** and the variable becomes `deletedButReferenced` [API REST]. Consumers keep rendering the last resolved value; UI marks the reference as missing/deleted [KNOW] (→ V-18). Undo restores the variable with the same `id`.
8. **Multi-select**: click selects a row; Shift+click selects a range [DOC:15145852043927 excerpt]; ⌘/Ctrl+click toggles [KNOW]; ⌘/Ctrl+A selects all visible rows [KNOW]. Multi-row operations: delete, duplicate, new group with selection, move (drag), edit shared settings (scopes, hide from publishing) [KNOW] (→ V-19).
9. **Reorder**: drag rows within a group, into another group (renames the path), or to top level [KNOW] (→ V-20). Dragging between collections is not supported (`variableCollectionId` read-only) [API]; cross-collection move availability in UI → V-21.
10. **Type is immutable** — there is no "change type" command [API `resolvedType` read-only].
11. **Remote (library) variables** are listed in pickers but never in the local table; they cannot be renamed, edited or deleted in the consumer file [API].

### 3.4 Values, display and editing

1. **Cell editing per type** [KNOW]: Color cell = swatch + hex + opacity %; clicking the swatch opens the color picker (same picker as fills, minus paint types). Number cell = numeric input (accepts math expressions like other Figma numeric fields? → V-22). String cell = text input. Boolean cell = toggle/checkbox showing `true`/`false`.
2. **Number precision**: stored as a double; displayed rounded (Figma generally shows up to 2 decimals in inspector fields) [KNOW] (→ V-22). Negative values allowed (e.g. letter spacing −0.5).
3. **Color**: stored as RGBA 0–1 [API]; hex input accepts 3/6/8-digit forms like the color picker [KNOW]; the opacity part shows 0–100 %.
4. **Composed color (color + opacity alias)** [API] [SRC:https://github.com/figma/plugin-typings/issues/375 excerpt] [SRC:https://github.com/figma/plugin-typings/issues/381 excerpt]: a color cell may alias another color variable and keep its own opacity (number or FLOAT alias), or keep a literal color with an aliased opacity. If the aliased source color is already translucent, the opacity field is **disabled** and shows the inherited alpha; the stored opacity becomes active again if upstream alpha becomes 1 (stored but inactive) [SRC #381]. Literal color + literal opacity is not a composed value (it is a plain RGBA).
5. **Commit semantics**: an edit commits on Enter/blur; Esc cancels [KNOW]. Each committed cell edit is one undo step. Color picker drags commit once on release [KNOW].
6. **Propagation**: committing a value immediately re-renders every consumer whose resolved mode for that collection selects that mode (including through alias chains, styles and components).

### 3.5 Scopes ("Show in" / Scoping)

1. Default for new COLOR/FLOAT/STRING variables: **All supported properties** (`ALL_SCOPES`) [KNOW] (→ V-12).
2. Unchecking *All supported properties* reveals per-family checkboxes; checking a family removes `ALL_SCOPES` [API exclusivity] [KNOW UI].
3. UI labels → scopes [KNOW] (→ V-12):
   - Color: *Fill* (`ALL_FILLS`) with sub-options *Frame* (`FRAME_FILL`), *Shape* (`SHAPE_FILL`), *Text* (`TEXT_FILL`); *Stroke* (`STROKE_COLOR`); *Effects* (`EFFECT_COLOR`).
   - Number: *Corner radius*, *Width and height*, *Gap* (incl. padding), *Text content*, *Stroke*, *Layer opacity* (`OPACITY`), *Color opacity*? (`COLOR_OPACITY`, new 2026), *Effects* (`EFFECT_FLOAT`), *Font weight*, *Font size*, *Line height*, *Letter spacing*, *Paragraph spacing*, *Paragraph indent*.
   - String: *Text content*, *Font family*, *Font style*.
   - Boolean: no scoping section.
4. Checking all sub-options of Fill collapses to `ALL_FILLS` [API exclusivity] [KNOW].
5. **Effect of scopes**: the variable is listed in a field's picker only if one of its scopes covers that field (or `ALL_SCOPES`) **and** its type matches [API]. Existing bindings are untouched when scopes change [API]. Pasting/copying properties may bind out-of-scope variables (scope is not validation) [API].
6. Extended collections cannot change scope (inherited from parent) [DOC:36346281624471 excerpt].
7. Inference uses scopes: a raw value is inferred to a variable only when exactly one in-scope variable matches [API].

### 3.6 Code syntax

1. Per variable, optional string per platform `WEB`, `ANDROID`, `iOS` [API]. UI: *Code syntax* section in Edit variable with *+* to add a platform row and a remove control per row [KNOW] (→ V-16).
2. Values are free text (e.g. `var(--color-bg)`, `colorBg`, `Color.bg`) — Figma does not validate syntax [KNOW].
3. Consumers: developer handoff/inspect shows the code syntax for the active platform instead of the variable name when set [KNOW] (handoff area). Export (§3.18) includes code syntax.
4. Extended collections inherit code syntax (not overridable) [KNOW] (→ V-45).

### 3.7 Descriptions & hide from publishing

1. **Variable description**: plain text, shown in the Edit variable panel and as hover/tooltip in pickers [KNOW] [DOC:7938814091287 title].
2. **Style description**: plain text + rich text (`descriptionMarkdown`) and up to one documentation link [API]. Shown on hover in style pickers [KNOW].
3. **Hide from publishing — variables/collections**: explicit checkbox on the variable and on the collection; a variable is published only if neither is hidden [API]. Hidden variables remain fully usable inside the file.
4. **Hide from publishing — styles (and components)**: names whose **first character is `_` or `.`** (including the first folder segment, e.g. `_internal/red`) are excluded from publishing [KNOW] [DOC:360039238193 title] (→ V-23).
5. Hiding an already-published asset and republishing removes it from the library for new use; existing consumer usages keep working with their cached remote copy [KNOW] (→ V-24).

### 3.8 Variable order (persistence)

1. The table order of variables **and of groups** within a collection is user-controlled (drag) and is document data [DOC:15145852043927 excerpt] [KNOW].
2. Figma's `variableIds` order is only "roughly" the UI order and does not encode groups [API]; Illigma persists an explicit ordered tree per collection: `order: [ {group: "color", children: [...]}, {variable: id}, … ]`, and derives a flat `variableIds` for export.
3. A newly created variable is appended to the end of the current group (or collection) [KNOW]; a duplicate is inserted directly after its source [KNOW] (→ V-17).
4. Renaming a variable into another group moves it to the end of the target group [KNOW] (→ V-20).
5. Extended collections inherit the parent's order and cannot reorder [DOC:36346281624471 excerpt].

### 3.9 Groups (variables) and folders (styles)

1. A variable's group path = all name segments before the last `/`. Nesting depth unlimited [KNOW].
2. **New group with selection**: select variables (Shift range), right-click → *New group with selection* [DOC:15145852043927 excerpt]; creates a group (default name `Group` / `New group` [KNOW]) and prefixes each selected variable's name with it; name enters edit state.
3. **Rename group** (sidebar double-click) [DOC:15145852043927 excerpt]: rewrites the corresponding path segment of every contained variable (including nested groups). Collisions with existing names → error, no partial rename [KNOW] (→ V-25).
4. **Ungroup** [DOC:15145852043927 excerpt]: removes that path segment from every contained variable (children move up one level). Name collisions → V-25.
5. **Duplicate group** [DOC:15145852043927 excerpt]: duplicates all contained variables under a new group path `<group> copy` [KNOW]; aliases between variables *inside* the duplicated group are re-pointed to the duplicates? (→ V-26).
6. **Delete group** [DOC:15145852043927 excerpt]: deletes all contained variables (soft-delete semantics §3.3.7).
7. **Reorder/nest groups**: drag a group in the sidebar to reorder; drop onto another group to nest it (renames paths) [DOC:15145852043927 excerpt].
8. **Selecting a group** in the sidebar filters the table to that group's variables (and nested) [KNOW]; *All variables* shows the whole collection.
9. **Style folders** follow the same slash rule; folders appear in style pickers and the local styles list; renaming a folder renames all contained styles; folder order is independently orderable [API `moveLocal…FolderAfter`] [KNOW UI].

### 3.10 Variables table (modal) behavior

1. **Open**: with nothing selected, the right panel shows a *Variables* entry ("Open variables"/"Local variables") [KNOW]; it opens a floating, resizable modal [KNOW] (→ V-27). It may stay open while the user edits the canvas [KNOW].
2. **Layout**: collapsible sidebar (*Toggle sidebar*) listing collections and their groups [DOC:15145852043927 excerpt]; main table with a *Name* column and **one column per mode** (default mode first) [KNOW]; resizable columns [KNOW].
3. **Search**: a search field filters rows by name (and value?) across the current collection [KNOW] (→ V-28).
4. **Context menus** [KNOW] (→ V-29): row — Edit variable, Duplicate, New group with selection, Delete, (Copy/Paste?); mode header — Rename, Duplicate, Delete, Set as default?, Import mode, Export mode [DOC:36346281624471 excerpt for import/export]; group — Ungroup, Duplicate group, Delete group [DOC:15145852043927 excerpt]; collection — Rename, Delete, Extend collection (Enterprise) [KNOW], Hide from publishing.
5. **Alias editing in a cell**: open the cell's value menu (or right-click → *Create alias*) to choose a same-type variable from a searchable list grouped by collection and library [KNOW] (→ V-30). Aliased cells show the target variable's name as a pill; a *Detach alias* control replaces the alias with the target's currently resolved value **for that mode** [KNOW].
6. **Extended collections in the table**: overridden cells highlighted (blue); context *Reset change* reverts a cell to inherited [DOC:36346281624471 excerpt].
7. **Large collections**: the table must virtualize rows; exact-name search must always find a variable even if the list rendering is incomplete [SRC:https://forum.figma.com/report-a-problem-6/variables-panel-doesn-t-show-some-existing-local-variables-large-collection-1000-variables-58145 title].
8. **Keyboard** in the table: §5.

### 3.11 Binding variables to properties (general rules)

1. **Entry points** [KNOW] (→ V-31):
   - Numeric fields: hovering a bindable field reveals an *Apply variable* control; clicking opens a picker filtered by **type + scope**, grouped by collection (local first, then each library), searchable.
   - Color: the fill/stroke/effect color popover has **Custom** and **Libraries** tabs [OBS]; the Libraries tab lists color styles and color variables (grouped by library/collection) [KNOW].
   - Text: the typography section and the type-settings panel offer *Apply variable* per text field [KNOW].
   - Visibility (BOOLEAN): via the layer visibility control in the Layer/Appearance section (right-click or apply-variable control) [KNOW] (→ V-32).
   - Component properties: on instances, next to boolean/text property controls; on definitions, in the property edit popover [KNOW].
2. **Bound display**: the field shows the variable name as a pill (with group path abbreviated) instead of the number; hovering shows the resolved value [KNOW] (→ V-31).
3. **Detach variable**: a *Detach variable* control on the pill replaces the binding with the **currently resolved value** for that node; visual result unchanged [KNOW].
4. **Typing a raw value into a bound field** detaches and sets the raw value [KNOW] (→ V-33).
5. **Canvas manipulation of bound geometry** (e.g. dragging a resize handle on a node whose `width` is bound, or dragging radius handles): detaches the binding and writes the new raw value [KNOW] (→ V-34).
6. **Multi-selection**: applying a variable binds the field on every selected node that supports it; if selected nodes have different bindings the field shows *Mixed* [KNOW]. Detaching on a mixed selection detaches all.
7. **Binding resolves immediately**: after binding, the node renders the variable's value in the node's resolved mode (§3.12).
8. **Out-of-type protection**: pickers never offer wrong-type variables [API types]; the data layer rejects wrong-type bindings (Illigma invariant).
9. **Remote variables**: binding a library variable imports a remote copy into the file (read-only) [API `importVariableByKeyAsync`, `remote`].
10. **Selection colors**: the selection-colors section lists distinct raw colors, color styles and color variables used in the selection; editing a raw color there rewrites all occurrences; applying a variable to an entry binds all occurrences; *select matching layers* selects all layers using it [KNOW] [API `getSelectionColors`, returns `null` above 1,000 colors] (→ V-35).

### 3.11a Binding — per field rules

| Field | Rule | Evidence |
| --- | --- | --- |
| Width / height | Binding forces the axis to **Fixed** sizing if it was Hug/Fill [KNOW] (→ V-36); rotation unaffected; constraints still apply to children. | [API] [KNOW] |
| Min/max width/height | Only offered on auto-layout frames/children where min/max are available (layout area) [KNOW]. | [API] |
| Gap (`itemSpacing`) | Not bindable while gap is *Auto* (space between) [KNOW] [OBS: "Auto spacing displays Between"] (→ V-37). | [API] |
| Wrap row gap (`counterAxisSpacing`) | Only when `layoutWrap = WRAP` [API]. | [API] |
| Grid gaps (`gridRowGap`, `gridColumnGap`) | Only for GRID auto layout [API]. | [API] |
| Padding | Each side separately; when the UI shows horizontal/vertical pairs, binding the pair binds both sides [KNOW] (→ V-14). | [API] |
| Corner radius | Binding "all corners" stores four per-corner bindings on nodes with independent radii [API]; per-corner bindable individually. | [API] |
| Stroke weight | Uniform `strokeWeight` or per-side `stroke{Top,Right,Bottom,Left}Weight` [API]. | [API] |
| Layer opacity | FLOAT variable; value interpreted as **percent 0–100** [KNOW] (→ V-38); values outside 0–100 clamp at render [KNOW]. | [API] |
| Visibility | BOOLEAN; `false` hides the layer exactly like toggling the eye; layers panel shows the bound state [KNOW]. | [API] |
| Fill/stroke solid color | Per paint index; binding writes `paints[i].boundVariables.color`; the paint's own opacity remains separate unless the variable is a composed color (→ V-39). | [API] |
| Gradient stops | Per stop color [API]. | [API] |
| Image/video/pattern paints | Not bindable (no `boundVariables` on those paints) [API]. | [API] |
| Shadows | color, blur (`radius`), spread, X, Y offsets [API]. | [API] |
| Layer/background blur | `radius` only; progressive blur start values not bindable [API]. | [API] |
| Noise, texture, glass | Not bindable [API]. | [API] |
| Layout grids | count, gutter, offset, section size (rows/columns); size (grid) [API]. | [API] |
| Text content | STRING → characters; FLOAT → formatted number (→ V-40). Bound text content cannot be edited inline without detaching [KNOW] (→ V-40). | [API] |
| Font family / style | STRING; if the resolved family/style is unavailable → missing-font state (text area) [KNOW] (→ V-41). | [API] |
| Font weight | FLOAT (e.g. 700) mapped to the family's style with that weight [KNOW] (→ V-41). | [API] |
| Font size, paragraph spacing, paragraph indent | FLOAT px. | [API] |
| Line height / letter spacing | FLOAT; unit handling (px vs %) → V-42. | [API] [KNOW] |
| Text ranges | Each text field and fill can be bound per character range; node-level field shows Mixed [API]. | [API] |
| Component property (instance) | TEXT ← STRING, BOOLEAN ← BOOLEAN [API `componentProperties[].boundVariables.value`] [KNOW types]; VARIANT / INSTANCE_SWAP / SLOT bindability → V-43. | [API] |
| Component property (definition default) | `defaultValue` bound [API]. | [API] |
| Motion timing/easing | TIMING → durations/delays, EASING → easing of presets/keyframes [DOC:14506821864087 excerpt] (M7). | [DOC excerpt] |

### 3.12 Mode resolution (explicit modes, Auto, inheritance)

**Where explicit modes can be set:** pages and any layer type the UI exposes — frames, sections, components, component sets, instances, groups (→ V-44 for groups and non-container layers) [API: all SceneNodes and PageNode carry `explicitVariableModes`] [KNOW UI].

**UI** [KNOW] (→ V-44): with a container selected, the Layer/Appearance section shows an *Apply variable mode* control. Its menu lists collections relevant to the selection (collections with > 1 mode that are used by the selection's descendants, including library collections) each with *Auto (<inherited mode name>)* and every mode. With nothing selected, the page panel offers the same for the page. Choosing *Auto* clears the explicit mode.

**Resolution algorithm** (normative for Illigma; derived from [API] `resolvedVariableModes`, `resolveForConsumer` examples and [DOC:36346281624471 excerpt]):

```text
resolvedMode(node, collection):
    for n in [node, parent(node), …, page(node)]:          # nearest wins
        m = n.explicitVariableModes[collection.id]
        if m exists and m ∈ collection.modes: return m       # stale mode ids are skipped (→ V-07)
    return collection.defaultModeId

# Extended collections: an explicit mode set for extension E (whose root is A) also
# selects the mode for A's variables in that subtree. Precedence when both A and E
# (or two extensions of A) have explicit modes at different depths: nearest ancestor wins (→ V-46).
effectiveCollectionAndMode(variable, node):
    A = collection(variable)
    best = nearest n in ancestry(node) having an explicit mode for A or any extension X with root A
    if none: return (A, A.defaultModeId)
    return (X or A, that explicit modeId)

valueFor(variable, coll, modeId):
    if coll.isExtension:
        o = coll.variableOverrides[variable.id]?[modeId]
        if o is defined: return o
        return valueFor(variable, parent(coll), parentModeIdOf(coll, modeId))
    return variable.valuesByMode[modeId]

resolve(variable, node, seen = ∅):
    if variable.id ∈ seen: raise AliasCycle          # cannot happen if §3.13 invariant holds
    (coll, mode) = effectiveCollectionAndMode(variable, node)
    v = valueFor(variable, coll, mode)
    if v is VariableAlias:      return resolve(lookup(v.id), node, seen ∪ {variable.id})   # each hop uses the
                                                                                           # node's mode for the hop's collection
    if v is ComposedColor:      rgb = v.color is alias ? resolve(v.color…) : v.color
                                a   = v.opacity is alias ? resolve(v.opacity…) : v.opacity
                                return withOpacity(rgb, a)   # unit of `a`, and translucent-source rule → V-39
    return v
```

Rules:
1. **Inheritance** — a layer without an explicit mode for a collection uses its nearest ancestor's explicit mode, up to the page; else the collection default [API].
2. **Per-collection independence** — explicit modes are set per collection; a frame can be "Dark" for *Color* and "Compact" for *Spacing* simultaneously [API example].
3. **Alias chains** resolve each hop using the consuming node's resolved mode **for that hop's collection** (two 2-mode collections → up to 4 distinct results) [API example].
4. **Components/instances** — explicit modes set inside a main component are part of the component; an instance inherits the instance's context for collections the component does not set explicitly, and an explicit mode set **on the instance** overrides the component's explicit mode for that collection (instance override, reset by *Reset all changes*) [KNOW] (→ V-47).
5. **Page level** — setting a page mode affects every top-level layer on the page that does not override it [KNOW].
6. **Moving a layer** (drag to another frame, cut/paste) re-resolves in the new context; its own explicit modes travel with it [API data model].
7. **Library collections** — explicit modes may be set for remote collections; the mode ids are those of the accepted library version; if a library update deletes a mode used explicitly, resolution falls back per rule 1 (→ V-07).
8. **Prototype mode switching** (`SET_VARIABLE_MODE`) sets the mode at playback without changing the document [API] (M7).
9. **Workspace/team-default modes** — Figma excludes them from `explicitVariableModes` [API]; not applicable to Illigma.

### 3.13 Alias rules

1. Target must be a variable whose **resolved type equals** the source's type [API REST]. Pickers offer only same-type variables.
2. Aliases may target variables in **other collections** and **library** variables [API].
3. **No cycles**: an alias that would create a cycle (A→B→…→A) is rejected; the picker hides/disables variables that would create a cycle [KNOW] (→ V-48). A variable cannot alias itself.
4. Aliasing a variable in the **same collection** is allowed [KNOW] (→ V-48).
5. Each mode cell aliases independently (a variable can be literal in one mode, alias in another) [API].
6. Deleting an alias target → the alias becomes a reference to a deleted variable; the source cell shows a missing/deleted state and resolves to the last known value [API `deletedButReferenced`] [KNOW] (→ V-18).
7. Alias chains have no documented maximum depth; Illigma must support ≥ 32 hops without stack issues (implementation requirement).

### 3.14 Extended collections

1. **Create**: context menu on a local or library collection → *Extend collection*; prompts for a name [KNOW]; API: `collection.extend(name)` (local) / `extendLibraryCollectionByKeyAsync(key, name)` (library) [API]. Figma: Enterprise only [API]; Illigma: available to all.
2. **Inheritance**: the extension inherits all variables and modes; parent changes (values, new variables, new modes, renames) flow to every non-overridden cell [DOC:36346281624471 excerpt].
3. **Overrides**: any inherited variable can be overridden **per mode**; overridden cells are highlighted; *Reset change* reverts [DOC:36346281624471 excerpt]. API also offers "reset all overrides for a variable" [API].
4. **Structural edits forbidden** in the extension: no adding variables or modes, no changing description or scope (edit the parent) [DOC:36346281624471 excerpt]. Names, order and settings are inherited [DOC:36346281624471 excerpt]. Mode rename on the extension → not allowed (REST: modes cannot be updated on extended collections) [API REST] (plugin typings still expose `renameMode`; treat UI as read-only → V-45).
5. **Parent mode deleted** → the corresponding extended mode becomes removable [API].
6. **Chains**: an extension can itself be extended (`rootVariableCollectionId`) [API].
7. **Applying**: set the extension's mode on a container (§3.12) to re-theme every variable of the root collection used in that subtree [KNOW] (→ V-46).
8. **Publishing**: extensions are publishable collections [KNOW] (→ V-76); a consumer may extend a *library* collection locally [API `extendLibraryCollectionByKeyAsync`]; local extensions of subscribed collections stay editable [SRC:https://developers.figma.com/docs/rest-api/variables-types excerpt via search].
9. **Import mode into an extension**: right-click a mode column → *Import mode* overwrites the extension's values (as overrides) from a JSON file [DOC:36346281624471 excerpt].

### 3.15 Styles — create, apply, edit, detach, delete

1. **Create from selection** [KNOW] [DOC:360038746534 title] (→ V-49): in the Fill, Stroke, Text, Effects or Layout-guide section, click the *Style* control (four-dot icon) → *+* (Create style). Dialog fields: Name, Description. *Create style* creates a local style from **the whole current property list of that section** (all fills / all effects / all grids / the text properties of the first selected text) and **applies it to the selection** in the same commit.
2. **Create without selection**: right panel with nothing selected → each style category has *+* creating a style with default values (paint: one solid fill? text: Inter Regular 12 [API default], effect: one drop shadow?, grid: one 10px grid?) [API text default] [KNOW others] (→ V-50).
3. **Mixed selection** when creating: if the section shows *Mixed*, the create-style control is unavailable [KNOW] (→ V-49).
4. **Apply**: open the style picker from a section's Style control (list or grid view; search; local styles first, then each enabled library) and click a style [KNOW]. Applying a paint style **replaces the entire fills (or strokes) array** with the style's paints and stores `fillStyleId`/`strokeStyleId` [API]. Text style applies to the whole text node or the selected character range [API range APIs]. Effect style replaces the effect list; grid style replaces layout grids [API].
5. **Paint styles on text ranges**: a paint style can be applied to a character range [API `setRangeFillStyleIdAsync`].
6. **Display when applied**: the section shows the style name (and swatch/preview) instead of individual values; individual property fields are hidden until detached [KNOW] (→ V-51).
7. **Detach style**: *Detach style* control on the applied style; keeps current resolved values, removes the style reference (`…StyleId = ''`), and **keeps variable bindings that were inside the style values?** (→ V-52).
8. **Text style + local edits**: bold/italic via shortcut, underline/decoration and hyperlinks are allowed **overrides over the text style** (`SEMANTIC_WEIGHT`, `SEMANTIC_ITALIC`, `TEXT_DECORATION`, `HYPERLINK`) without detaching [API]; other typography changes require detaching or editing the style [KNOW] (→ V-53).
9. **Edit style**: right-click the style (in the picker or the local styles list) → *Edit style* opens an editor with name, description and the property editor [KNOW]. Changes apply live to **all consumers** in the file (and to library consumers after publish + accept).
10. **Rename style**: via the edit dialog or double-click in the local styles list [KNOW]; renaming may move it between folders.
11. **Duplicate style**: availability → V-54.
12. **Delete local style**: consumers keep their current visual values; whether they keep a reference to the deleted style (soft-delete) or are detached → V-55.
13. **Copy/paste**: pasting a layer within the same file keeps style references [KNOW]; cross-file behavior → §3.21.
14. **Selection colors** include color styles (§3.11.10).
15. **Style consumers** are computable for every style (`getStyleConsumersAsync` → node + fields) [API]; Illigma exposes "Select layers using this style" as a P2 extension of Figma's *select matching layers* (→ V-35).

### 3.16 Styles — ordering and folders

1. Local styles are ordered per type; drag to reorder within a folder; drag folders to reorder [API move functions] [KNOW UI].
2. A style or folder can only be moved relative to siblings in the **same folder** via reorder; moving into another folder is done by renaming (or drag onto folder → V-56) [API constraints].
3. Folder rename/ungroup/delete operations analogous to variable groups [KNOW] (→ V-56).
4. Published order is exposed to consumers (`sort_position`) and pickers in consumer files respect the library order [API REST] [KNOW].

### 3.17 Styles with variable values

1. **Paint style**: each paint's solid color (and gradient stops) may be bound to COLOR variables; `PaintStyle.boundVariables.paints` [API].
2. **Text style**: `fontFamily, fontStyle, fontWeight, fontSize, lineHeight, letterSpacing, paragraphSpacing, paragraphIndent` bindable on the style [API `TextStyle.setBoundVariable`].
3. **Effect style**: shadow color/radius/spread/offsets and blur radius bindable [API].
4. **Grid style**: grid numeric fields bindable [API].
5. **Resolution context**: a style's variable-bound values resolve in the **consuming node's** resolved modes, so one style renders differently in Light vs Dark frames [KNOW] (→ V-57). Style thumbnails/previews in pickers use the collection default mode [KNOW] (→ V-57).
6. Detaching a variable inside the style editor converts that cell to a raw value [KNOW].

### 3.18 Import / export of variables and tokens

1. **Figma native (Schema 2025, DTCG-aligned)** [SRC:https://www.figma.com/blog/schema-2025-design-systems-recap/ excerpt] [DOC:36346281624471 excerpt] [DOC:15343816063383 excerpt]:
   - *Export mode*: right-click a mode header → *Export mode* writes that mode's variables to a JSON file.
   - *Import mode*: right-click a mode header → *Import mode* → choose JSON; values **overwrite** the mode's existing values; variables are matched **by token name and type**; matches are updated [DOC:15343816063383 excerpt]. Behavior for non-matching tokens (create vs ignore) → V-59.
   - Known gaps reported: descriptions omitted from export; most composite tokens (typography, gradients, shadows) unsupported [SRC:https://forum.figma.com/suggest-a-feature-11/dtcg-composite-token-export-support-51314 excerpt].
2. **Illigma DTCG mapping (normative for Illigma, to be reconciled with Figma's actual output in V-59/V-60)**:

   | Illigma | DTCG 2025.10 |
   | --- | --- |
   | group path `a/b/c` | nested groups `{"a":{"b":{"c":{…}}}}` |
   | COLOR (RGBA) | `$type: "color"`, `$value: {colorSpace:"srgb", components:[r,g,b], alpha, hex}` |
   | FLOAT | `$type: "number"` (or `"dimension"` with `px` when scoped to geometry/typography? → V-60) |
   | STRING | no DTCG primitive — export as `$type: "string"`? / `$extensions` (→ V-60) |
   | BOOLEAN | no DTCG primitive (→ V-60) |
   | alias | `"{a.b.c}"` curly-brace dot path |
   | description | `$description` |
   | scopes, code syntax, hidden flag, variable id/key | `$extensions["com.figma…"]` (exact key → V-60) |
   | each mode | one file per mode (Figma) **and** optional single-file multi-mode via `$extensions` (Illigma) |
3. **Figma REST JSON**: Illigma imports/exports the `GET /v1/files/:key/variables/local` response shape (`meta.variables`, `meta.variableCollections` with `modes`, `defaultModeId`, `valuesByMode`, `scopes`, `codeSyntax`, `hiddenFromPublishing`, extension fields) losslessly [API].
4. **Validation on import**: type mismatch for an existing name → skip with report; alias to a missing token → report, leave previous value; cycle → reject that cell; over 5,000 variables → reject excess with report.
5. Import is **one undo step** [KNOW] (→ V-59).

### 3.19 Libraries (local-first)

1. **Publish** [DOC:360025508373 title] [KNOW] (→ V-61): *Publish* in the Libraries modal / Assets panel opens a dialog listing **new, changed, removed** components, styles, variables (by collection) with per-item include checkboxes and an optional description; *Publish* writes a new library version. Hidden assets (§3.7) never appear. Assets are identified by `key`; publish status becomes `CURRENT` [API].
2. **Republish** after edits: assets with local changes show `CHANGED` [API]; only included changes are published.
3. **Unpublish library** [DOC:360039236853 title]: removes availability for new consumers; existing consumer usages remain as cached remote assets [KNOW] (→ V-62).
4. **Enable a library in a file** [DOC:1500008731201 title]: Libraries modal lists available libraries (Illigma: recently used library files + *Add library from disk…*); toggling on makes its assets available in pickers and the Assets panel; toggling off is allowed only for libraries with no used assets? (Figma: removing a library with used assets keeps them as remote/"missing" → V-63).
5. **Using library variables/styles**: remote copies are read-only; their collections' modes can be applied (§3.12) [API].
6. **Updates** [DOC:360039234193 title] [KNOW] (→ V-64): when a newer library version exists, the consumer is notified; *Review updates* shows changed assets (with before/after for components; styles and variables listed); *Update all* or accept individually; until accepted, the file keeps rendering the previously accepted version. A *Show updates for all pages* toggle exists in the Updates view [SRC:https://forum.figma.com/report-a-problem-6/plugin-created-extended-collection-is-empty-while-manually-created-one-works-58360 excerpt].
7. **Swap library** [DOC:4404856784663 title] [KNOW] (→ V-65): from the Libraries modal pick a used library → *Swap library* → choose target; every used component/style/variable from the source is replaced by the asset with the **same name (and type)** in the target; unmatched assets stay on the source; summary of swapped/unmatched; one undo step.
8. **Missing libraries** [KNOW] (→ V-66): if a used library cannot be found (file moved/deleted/unpublished), the Libraries modal lists it under *Missing libraries* with usage counts; assets keep rendering from cached copies; actions: locate file (Illigma), swap library, or detach/localize.
9. **Variables in libraries**: published per collection with all modes; consumer files can set explicit modes and alias local variables to library variables [API].
10. **Library variables deleted upstream**: after accepting an update that deletes a variable, bindings remain with a deleted/missing indicator and last value [API `deletedButReferenced`] [KNOW] (→ V-18).
11. **Out of scope**: team/org enablement, default libraries, library analytics, permissions.

### 3.20 Undo/redo

Every committed document mutation in this area is **exactly one undo step** and is redoable [KNOW] (→ V-67): create/rename/delete/duplicate/reorder variable or group; collection create/rename/delete/hide; mode add/rename/duplicate/delete/reorder/set default; any cell value commit (including alias create/detach and override/reset); scope, code-syntax, description and hidden-flag edits; bind/detach on a multi-selection (one step for all nodes); explicit mode change; style create(+apply), apply, detach, edit (one step per committed field), rename, reorder, delete; import mode/file; accept library updates; swap library. Undo restores identical IDs (bindings remain valid). Opening/closing the variables modal, search, selection, collapsing groups are **not** undo steps.

### 3.21 Copy/paste, duplication and cross-file behavior

1. **Same file**: duplicating or copy/pasting layers keeps all bindings, style refs and explicit modes [KNOW].
2. **Copy/paste properties** (⌘⌥C / ⌘⌥V, Ctrl+Alt+C / Ctrl+Alt+V): pasted properties include bound variables and style references [KNOW] [DOC:4412765442967 title] (→ V-68).
3. **Cross-file** (between two Illigma files): references to **library** assets stay library references (library auto-enabled? → V-69); references to **local** variables/styles of the source file: Figma behavior (remote reference to the source file vs local copy vs detach) → V-69. Illigma must never silently lose the visual value.
4. **Paste into a different mode context** re-resolves values (§3.12.6).
5. **Copying variables themselves** between files (table copy/paste): availability → V-70; otherwise use export/import (§3.18).

### 3.22 Export & rendering

1. Raster/vector export renders **resolved values** in each node's resolved modes [KNOW].
2. CSS/code copy (handoff area) emits code syntax when set, else a name-derived token, else raw value [KNOW] (cross-area).
3. Performance: changing one variable value with 10,000 bound consumers must update the canvas in one frame budget target (implementation target, not a Figma fact); resolution results must be cached per (variable, collection, mode) and invalidated on value/mode/alias edits.

### 3.23 Design-system management workflows

1. **Selection colors → select matching layers / swap color for variable** [KNOW] (§3.11.10).
2. **Edit → Select all with same fill / stroke / effect / font / properties** (menu commands) [KNOW]; whether "same" compares style/variable identity or raw value → V-71 (selection area owns the command).
3. **Find usages** (Illigma extension, API-backed): for a style, list consumers (`getStyleConsumersAsync`) and select them; for a variable, list bound fields/aliases. Marked P2 "beyond Figma UI" until V-35 shows Figma has an equivalent.
4. **Inferred-variable suggestions** (P2): for unbound fields, offer the unique in-scope variable whose value matches (`inferredVariables` rule) [API]; one-click bind.
5. **Missing library / missing assets** report (§3.19.8).
6. **Rename safety**: renames never break bindings (ID-based) [API].
7. **Bulk scope/hide edits** on multi-selected variables (§3.3.8).

---

## 4. Inspector & on-canvas controls (Figma UI3, functional only)

| Location | Control | Function | Evidence |
| --- | --- | --- | --- |
| Right panel, **nothing selected** | *Variables* entry / "Open variables" | Opens the variables modal for local collections. | [KNOW] (→ V-27) |
| Right panel, nothing selected | *Styles* list (Color, Text, Effect, Layout guide) with *+* per category | Lists local styles in folders; right-click: Edit style, (Duplicate), Delete; drag to reorder; *+* creates a style. | [KNOW] (→ V-50, V-54) |
| Right panel, nothing selected | Page *Apply variable mode* | Sets explicit modes on the page per collection; *Auto* clears. | [KNOW] (→ V-44) |
| Right panel, layer selected — Layer/Appearance section | *Apply variable mode* control | Per-collection mode menu (Auto + modes) for the selected container(s); shows current resolved mode; *Mixed* for differing selection. | [KNOW] (→ V-44) |
| Layer/Appearance section | Opacity field + *Apply variable* | Bind layer opacity to a FLOAT variable. | [API] [KNOW] |
| Layer/Appearance section | Visibility toggle + variable binding | Bind `visible` to a BOOLEAN variable. | [API] [KNOW] (→ V-32) |
| Position/Layout section | W, H, min/max, radius, gap, padding, grid gaps fields with *Apply variable* on hover | Bind FLOAT variables; pill display; *Detach variable*. | [OBS: W/H, gap and padding controls exist] [API] [KNOW] |
| Fill / Stroke sections | Header *Style* control (four dots) | Opens paint-style picker; *+* creates style from current paints; when applied, shows style name + *Detach style*. | [KNOW] (→ V-49, V-51) |
| Fill / Stroke swatch popover | **Custom** / **Libraries** tabs | Libraries tab lists color styles and color variables (local + enabled libraries), searchable; selecting binds/applies. | [OBS] tabs exist; [KNOW] content |
| Stroke section | Weight field (+ per-side weights) with *Apply variable* | Bind stroke weights. | [OBS: weight control exists] [API] |
| Effects section | Style control; per-effect settings popover with *Apply variable* on color/blur/spread/X/Y | Bind effect fields; effect styles. | [KNOW] [API] |
| Layout guide section | Style control; per-grid popover fields with *Apply variable* | Bind count/gutter/offset/size; grid styles. | [OBS: section exists] [API] [KNOW] |
| Typography section | Text style picker (style name, *Detach style*, *+* create) and type-settings panel with *Apply variable* per property | Text styles; bind font family/style/weight/size/line height/letter spacing/paragraph spacing/indent. | [KNOW] [API] |
| Text content | *Apply variable* on the text layer (content) | Bind `characters` to STRING/FLOAT. | [API] [KNOW] (→ V-40) |
| Selection colors section | List of colors/styles/variables in selection; hover → *Select matching layers*; click → edit/replace | Bulk edit/rebind. | [API `getSelectionColors`] [KNOW] (→ V-35) |
| Instance panel (component properties) | Boolean/text property controls with *Apply variable* | Bind instance property values. | [API] [KNOW] (→ V-43) |
| Component property definition popover | Default value with *Apply variable* | Bind definition defaults. | [API] [KNOW] |
| Variables modal | Sidebar (collections, groups, More options → Create collection), table (Name + mode columns, *+* add mode), *+ Create variable*, search, Edit variable panel, context menus | §3.10. | [DOC:15145852043927 excerpt] [KNOW] |
| Libraries modal (from Assets panel) | This file (Publish), Updates, Enabled/available libraries, Swap library, Missing libraries | §3.19. | [KNOW] (→ V-61–V-66) |
| Assets panel | Lists components; library browsing | Components area owns it; styles/variables appear via pickers. | [KNOW] |
| Canvas | No variable-specific on-canvas controls; resolved values render; dragging bound geometry detaches (→ V-34) | | [KNOW] |

---

## 5. Keyboard shortcuts (macOS / Windows)

| Action | macOS | Windows | Evidence |
| --- | --- | --- | --- |
| Copy properties (incl. bindings & style refs) | ⌘⌥C | Ctrl+Alt+C | [KNOW] [DOC:4412765442967 title] (→ V-68) |
| Paste properties | ⌘⌥V | Ctrl+Alt+V | [KNOW] (→ V-68) |
| Bold / italic on styled text (kept as text-style override) | ⌘B / ⌘I | Ctrl+B / Ctrl+I | [API override types] [KNOW keys] |
| Underline on styled text (kept as override) | ⌘U | Ctrl+U | [API] [KNOW] |
| Undo / redo any variable/style operation | ⌘Z / ⌘⇧Z | Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y) | [KNOW] (→ V-67) |
| Variables table: select range | ⇧-click | Shift-click | [DOC:15145852043927 excerpt] |
| Variables table: toggle row selection | ⌘-click | Ctrl-click | [KNOW] (→ V-73) |
| Variables table: duplicate selected variables | ⇧↵ (reported) | Shift+Enter (reported) | [DOC:15145852043927 excerpt] (→ V-17) |
| Variables table: delete selected variables | ⌫ / Delete | Backspace / Delete | [KNOW] (→ V-73) |
| Variables table: select all | ⌘A | Ctrl+A | [KNOW] (→ V-73) |
| Variables table: rename selected row / start editing cell | ↵ (or double-click) | Enter (or double-click) | [KNOW] (→ V-73) |
| Variables table: cancel edit / close popover | Esc | Esc | [KNOW] |
| Variables table: move between cells | Tab / ⇧Tab, arrows | Tab / Shift+Tab, arrows | [KNOW] (→ V-73) |
| Open Libraries modal | ⌥⌘O? (legacy "Team library") | Ctrl+Alt+O? | [KNOW, uncertain] (→ V-72) |
| Show Assets panel | ⌥2 | Alt+2 | [KNOW] (→ V-72) |
| Open variables modal | — (no default shortcut known) | — | [KNOW] (→ V-72) |

Figma has no default shortcuts for creating/applying styles or variables, switching modes, or detaching [KNOW] (→ V-72). Illigma must not invent conflicting defaults; any added shortcut is an Illigma extension and must be documented as such.

---
## 6. Parity checklist

All items: status **Not started**. "Fixture F1" = a test file with collection `Theme` (modes `Light`, `Dark`), collection `Spacing` (modes `Compact`, `Comfortable`), COLOR `color/bg` (Light `#FFFFFF`, Dark `#000000`), FLOAT `space/md` (8 / 16), STRING `copy/title` ("Hello" / "Bonjour"), BOOLEAN `flag/show` (true / false). Every test is run identically in Figma and Illigma and the observable results compared.

### 6.1 Data model & persistence

- [ ] **DS-001** Variable record — persist `id, key, name, description, hiddenFromPublishing, remote, variableCollectionId, resolvedType, valuesByMode, scopes, codeSyntax` exactly; save/reopen is lossless. _Data:_ `Variable` _Test:_ Export F1 from Figma via REST `variables/local` JSON, import into Illigma, save, reopen, re-export; diff must be empty except IDs remapped consistently. _M6·P0·[API]_
- [ ] **DS-002** Collection record — persist `id, key, name, hiddenFromPublishing, remote, isExtension, modes[] (ordered), defaultModeId`, variable order. _Data:_ `VariableCollection` _Test:_ same round-trip as above on F1 plus a 3-mode collection; mode order and default must survive. _M6·P0·[API]_
- [ ] **DS-003** Stable identities — variable, collection and mode IDs are never reused after delete; renames/reorders never change IDs. _Data:_ `id`, `modeId`, `key` _Test:_ create, delete, create again with the same name; new `id` differs; bindings to the old ID still show deleted state (DS soft-delete item). _M6·P0·[API]_
- [ ] **DS-004** Type immutability — `resolvedType` cannot change after creation in UI or data layer. _Data:_ `resolvedType` (read-only) _Test:_ In Figma confirm no "change type" command exists for a Number variable; Illigma exposes none and rejects a programmatic type change. _M6·P0·[API]_
- [ ] **DS-005** Complete mode coverage invariant — every variable has a value for every mode of its collection at all times (after add/duplicate/delete mode, import, undo). _Data:_ `valuesByMode` keys == collection `modes` _Test:_ property-based test over random mode ops; Figma comparison: add mode then read values via table → every cell filled. _M6·P0·[API]_
- [ ] **DS-006** Explicit modes stored on pages and every scene node type — `explicitVariableModes {collectionId: modeId}` persisted. _Data:_ `ExplicitVariableModesMixin` on `PageNode`, `SceneNodeMixin` _Test:_ set modes on a page, frame, section, instance; save/reopen; values preserved. _M6·P0·[API]_
- [ ] **DS-007** Bindings persisted for every bindable site — node scalar fields, paint colors, gradient stops, effects, layout grids, text fields per range, text-range fills, component property values/defaults, style values. _Data:_ `boundVariables` (all shapes in §2.6) _Test:_ fixture with one binding of each kind; save/reopen; all bindings intact and resolve identically. _M6·P0·[API]_
- [ ] **DS-008** Derived state not persisted — resolved modes, resolved values, inferred variables, publish status, consumers are recomputed on load. _Data:_ `resolvedVariableModes`, `inferredVariables` _Test:_ tamper a saved file's cached resolved values; reopen; values recomputed correctly. _M0·P0·[API]_
- [ ] **DS-009** Soft-deleted referenced variables — deleting a variable that is still referenced keeps a tombstone (`deletedButReferenced`) so bindings/aliases keep their last value and can be restored by undo. _Data:_ `deletedButReferenced` _Test:_ bind a fill to `color/bg`, delete the variable; Figma: record fill appearance and inspector state; Illigma must match (see V-18). _M6·P0·[API]·[KNOW]_
- [ ] **DS-010** Motion variable types preserved — `TIMING` (number) and `EASING` (`MotionEasing`) variables and `CUSTOM_ANIMATION` styles round-trip losslessly even though Motion UI is not implemented. _Data:_ `VariableResolvedDataType 'TIMING'|'EASING'`, `CustomAnimationStyle` _Test:_ import a Figma-exported JSON containing TIMING/EASING variables; export again; identical. _M6·P1·[API]_
- [ ] **DS-011** Plugin data preserved — `pluginData`/`sharedPluginData` on variables, collections and styles survive load/save (no UI). _Data:_ `PluginDataMixin` _Test:_ import fixture with shared plugin data; re-export; identical. _M8·P2·[API]_

### 6.2 Collections

- [ ] **DS-012** Create collection — *More options → Create collection* creates a collection named `Collection` with one mode `Mode 1`, selects it and puts its name in edit state. _Data:_ `createVariableCollection(name)`, `modes[0]` _Test:_ in Figma create a collection in an empty file; record default name, mode name, edit state; Illigma identical. _M6·P0·[DOC:15145852043927 excerpt]·[KNOW]_
- [ ] **DS-013** Implicit collection — creating the first variable in a file without collections creates a collection automatically. _Data:_ `VariableCollection` _Test:_ empty file → *Create variable* → record resulting collection/mode names (V-01). _M6·P1·[KNOW]_
- [ ] **DS-014** Rename collection — commit on Enter/blur, Esc cancels, empty name reverts; duplicate collection names allowed per V-02. _Data:_ `name` _Test:_ rename to "", to an existing name, to "Brand"; compare outcomes. _M6·P0·[KNOW]_
- [ ] **DS-015** Delete collection — removes the collection and all its variables; bound layers keep rendering their last values with deleted-reference state. _Data:_ `VariableCollection.remove()` _Test:_ F1, bind a frame fill to `color/bg`, delete `Theme`; compare fill and inspector state; undo restores bindings live. _M6·P0·[API]·[KNOW]_
- [ ] **DS-016** Reorder collections — drag in the sidebar changes collection order; order persists and is reflected in pickers. _Data:_ document collection order _Test:_ 3 collections, drag last to first, reopen file; compare picker grouping order (V-03). _M6·P2·[KNOW]_
- [ ] **DS-017** Duplicate collection (conditional on V-04) — copies modes and variables with new IDs; internal aliases re-pointed to the copies; external aliases kept. _Data:_ new `VariableCollection` _Test:_ only if Figma offers it: duplicate F1 `Theme`, inspect alias targets in the copy. _M6·P2·[KNOW]_
- [ ] **DS-018** Hide collection from publishing — flag hides every variable of the collection from publish regardless of variable flags. _Data:_ `VariableCollection.hiddenFromPublishing` _Test:_ hide `Spacing`, open publish dialog; none of its variables listed. _M6·P1·[API]_
- [ ] **DS-019** Variable cap — a collection accepts at most 5,000 variables; creating/importing the 5,001st fails with an explanatory message and no partial corruption. _Data:_ collection size _Test:_ import 5,001-token file in Figma and Illigma; compare message and resulting count. _M6·P1·[DOC:15145852043927 excerpt]_

### 6.3 Modes

- [ ] **DS-020** Add mode — *+* after the last mode column appends `Mode N` (next free integer) and focuses its name for editing. _Data:_ `addMode(name) → modeId` _Test:_ collection with Mode 1, Mode 3 (Mode 2 renamed) → add; record new name (V-05). _M6·P0·[KNOW]_
- [ ] **DS-021** New mode values — values of a newly added mode are copied from the default mode (aliases stay aliases). _Data:_ `valuesByMode[newModeId]` _Test:_ F1 `Theme` default Light; add mode; compare new column values (V-05). _M6·P0·[KNOW]_
- [ ] **DS-022** Rename mode — header double-click or context menu; IDs unchanged so explicit modes on layers keep working. _Data:_ `renameMode(id, name)` _Test:_ frame explicitly in Dark; rename Dark→Night; frame still renders dark values and menu shows "Night". _M6·P0·[API]_
- [ ] **DS-023** Duplicate mode — inserts a copy with all values, named `<name> copy`, placed right of the source. _Data:_ new `modeId` _Test:_ duplicate Dark; record name/placement/values (V-06). _M6·P1·[KNOW]_
- [ ] **DS-024** Delete mode — removes the column and its values; disabled when only one mode remains. _Data:_ `removeMode(id)` _Test:_ try deleting the only mode; then delete Dark in F1. _M6·P0·[API]·[KNOW]_
- [ ] **DS-025** Explicit-mode fallback after mode deletion — layers explicitly set to a deleted mode resolve as Auto (inherit/default). _Data:_ stale `explicitVariableModes` entry _Test:_ frame explicit Dark; delete Dark; record frame rendering and mode menu label (V-07). _M6·P0·[KNOW]_
- [ ] **DS-026** Default mode semantics — the default mode is used when no explicit mode exists in the ancestry, and for previews. _Data:_ `defaultModeId` _Test:_ unframed rectangle bound to `color/bg` on a page with no modes renders Light value. _M6·P0·[API]_
- [ ] **DS-027** Change default mode — via reorder to first position and/or *Set as default*; Auto layers immediately re-resolve. _Data:_ `defaultModeId` _Test:_ make Dark default; unmoded rectangle turns black (V-08). _M6·P1·[KNOW]_
- [ ] **DS-028** Reorder modes — drag headers; order persists; explicit modes unaffected. _Data:_ `modes[]` order _Test:_ 3 modes, drag; reopen; compare (V-08). _M6·P1·[KNOW]_
- [ ] **DS-029** Mode cap policy — Illigma supports at least 40 modes per collection with no plan gating; behavior above the cap per Q1. _Data:_ `modes.length` _Test:_ add 40 modes; all editable; table usable (horizontal scroll). _M6·P1·[API]·[DOC:360040328273 excerpt]_
- [ ] **DS-030** Mode IDs stable — rename/reorder/set-default never change `modeId`; export uses IDs plus names. _Data:_ `modeId` _Test:_ REST-JSON export before/after rename; IDs identical. _M6·P0·[API]_

### 6.4 Variables — create, name, edit, delete

- [ ] **DS-031** Create variable type menu — *+ Create variable* offers Color, Number, String, Boolean (Timing/Easing only where Motion exists). _Data:_ `createVariable(name, collection, resolvedType)` _Test:_ open menu in Figma; list items; Illigma lists the same four (Motion types hidden until M7). _M6·P0·[DOC:14506821864087 excerpt]·[KNOW]_
- [ ] **DS-032** Create location — new variable is created in the displayed collection, inside the selected sidebar group (name prefixed), appended at the end, name in edit state. _Data:_ `name`, order _Test:_ select group `color` → create; record full name and position (V-09). _M6·P0·[KNOW]_
- [ ] **DS-033** Default value per type — Color `#FFFFFF`/100 %, Number `0`, String empty, Boolean `true` (to be confirmed) for every mode. _Data:_ `valuesByMode` _Test:_ create one of each in a 2-mode collection; record all cells (V-10). _M6·P0·[KNOW]_
- [ ] **DS-034** Default name per type — type-derived default name with numeric suffix on collision. _Data:_ `name` _Test:_ create three Color variables without renaming; record names (V-10). _M6·P1·[KNOW]_
- [ ] **DS-035** Rename variable — double-click name cell; Enter commits, Esc cancels; bindings unaffected (ID-based). _Data:_ `name` _Test:_ bind fill to `color/bg`, rename to `surface/base`; fill unchanged, pill shows new name. _M6·P0·[API]_
- [ ] **DS-036** Unique names per collection — duplicate full name (incl. group path) within a collection is rejected with feedback; same name in another collection allowed. _Data:_ `name` _Test:_ create two `space/md` in `Spacing`; then one in `Theme` (V-11). _M6·P0·[KNOW]_
- [ ] **DS-037** Forbidden characters — names containing `$` (and `.`, `{`, `}` pending V-11) are rejected with an error toast; previous name kept. _Data:_ `name` _Test:_ try `a$b`, `a.b`, `{a}`, `.5`; record which are rejected and the message. _M6·P0·[SRC:forum.figma.com 45692, 48096 excerpt]_
- [ ] **DS-038** Whitespace & empty names — empty name rejected; whitespace around `/` segments trimmed. _Data:_ `name` _Test:_ rename to `" color / bg "` and `""`; record stored names (V-11). _M6·P1·[KNOW]_
- [ ] **DS-039** Edit variable panel — shows Name, Description, Scoping (not Boolean), Code syntax, Hide from publishing; edits commit individually. _Data:_ `name, description, scopes, codeSyntax, hiddenFromPublishing` _Test:_ open for each type; list sections (V-16). _M6·P0·[KNOW]_
- [ ] **DS-040** Duplicate variable — duplicates selected variables below the source as `<name> copy` (incrementing), copying all mode values, description, scopes, code syntax and hidden flag. _Data:_ new `Variable` _Test:_ duplicate `color/bg` twice; record names, placement, copied settings (V-17). _M6·P1·[KNOW]_
- [ ] **DS-041** Duplicate shortcut — Shift+Enter duplicates the selected variables in the table (as reported). _Data:_ — _Test:_ select 2 rows, press ⇧↵ in Figma; record effect (V-17). _M6·P2·[DOC:15145852043927 excerpt]_
- [ ] **DS-042** Delete variable — context menu or Delete/Backspace removes selected variables from the table in one step. _Data:_ `Variable.remove()` _Test:_ select 3, press ⌫; one undo restores all three in original order. _M6·P0·[API]·[KNOW]_
- [ ] **DS-043** Deleted-variable consumers — bindings and aliases to a deleted variable keep the last resolved value and show a deleted/missing indicator; re-binding is possible. _Data:_ `deletedButReferenced` _Test:_ see V-18; compare inspector pill, value and canvas. _M6·P0·[API]·[KNOW]_
- [ ] **DS-044** Multi-select rows — click, Shift+click range, ⌘/Ctrl+click toggle, ⌘/Ctrl+A all visible. _Data:_ UI state _Test:_ perform each gesture; compare selected sets (V-19, V-73). _M6·P1·[DOC:15145852043927 excerpt]·[KNOW]_
- [ ] **DS-045** Bulk settings edit — with several variables selected, Edit variable applies scope / hidden-flag changes to all (fields with differing values show Mixed). _Data:_ `scopes`, `hiddenFromPublishing` _Test:_ select 3 colors with different scopes; uncheck Stroke; record each result (V-19). _M6·P2·[KNOW]_
- [ ] **DS-046** Reorder variables — drag rows within a group; order persists. _Data:_ collection order tree _Test:_ drag, reopen; compare order in table and pickers (V-20). _M6·P1·[KNOW]_
- [ ] **DS-047** Drag into another group — dropping a variable into another group rewrites its path prefix. _Data:_ `name` _Test:_ drag `color/bg` into group `surface`; name becomes `surface/bg` (V-20). _M6·P1·[KNOW]_
- [ ] **DS-048** No cross-collection move unless Figma supports it — variable cannot change collection (V-21 decides UI). _Data:_ `variableCollectionId` read-only _Test:_ attempt drag to another collection in Figma; record. _M6·P2·[API]_
- [ ] **DS-049** Remote variables read-only — library variables never appear in the local table and cannot be edited, renamed or deleted in a consumer file. _Data:_ `remote: true` _Test:_ consumer file using a library variable; confirm no edit path. _M6·P0·[API]_

### 6.5 Values & aliases

- [ ] **DS-050** Color cell editing — swatch opens color picker; hex field accepts 3/6/8-digit hex; opacity 0–100 %; stored RGBA 0–1. _Data:_ `RGBA` _Test:_ enter `F00`, `FF000080`, opacity 50; compare stored/displayed values. _M6·P0·[API]·[KNOW]_
- [ ] **DS-051** Color picker drag commit — dragging in the cell's color picker previews live on canvas and commits one undo step on release. _Data:_ — _Test:_ drag hue; ⌘Z once returns to original color. _M6·P1·[KNOW]_
- [ ] **DS-052** Number cell — accepts negative and fractional values; display precision matches Figma; arithmetic input behavior per V-22. _Data:_ `number` _Test:_ enter `-0.5`, `1.255`, `8*2`; record stored and displayed values. _M6·P0·[KNOW]_
- [ ] **DS-053** String cell — free text; commit Enter/blur; Esc cancels. _Data:_ `string` _Test:_ enter text with spaces/unicode; compare. _M6·P0·[KNOW]_
- [ ] **DS-054** Boolean cell — toggles between true/false in one click, one undo step per toggle. _Data:_ `boolean` _Test:_ toggle `flag/show`; undo. _M6·P0·[KNOW]_
- [ ] **DS-055** Live propagation — a committed value change re-renders all consumers (direct, via alias chains, via styles, inside instances) whose resolved mode selects that column. _Data:_ resolution graph _Test:_ F1 frames in Light and Dark both using `color/bg`; edit Dark value; only Dark frame changes. _M6·P0·[API]_
- [ ] **DS-056** Create alias — a cell can reference another variable of the **same resolved type** chosen from a searchable picker grouped by collection/library. _Data:_ `VariableAlias` _Test:_ alias `color/text` (Dark) → `color/bg` (Light column of another collection); picker lists only colors (V-30). _M6·P0·[API]·[KNOW]_
- [ ] **DS-057** Cross-collection and library aliases — aliases may target variables in other local collections and in enabled libraries. _Data:_ `VariableAlias.id` _Test:_ semantic collection aliasing a primitive collection and a library color; both resolve. _M6·P0·[API]_
- [ ] **DS-058** Alias cycle prevention — any alias that would create a cycle (including self) is impossible; the picker disables/hides such targets. _Data:_ alias graph _Test:_ A→B, then try B→A; record UI (V-48). _M6·P0·[KNOW]_
- [ ] **DS-059** Same-collection alias — a variable may alias another variable in its own collection. _Data:_ `VariableAlias` _Test:_ `color/fg` → `color/bg` same collection (V-48). _M6·P1·[KNOW]_
- [ ] **DS-060** Per-mode alias independence — each mode cell may independently be literal or alias. _Data:_ `valuesByMode` _Test:_ Light literal, Dark alias; both resolve correctly. _M6·P0·[API]_
- [ ] **DS-061** Alias display — aliased cells show the target name (pill); hover/inspect shows resolved value. _Data:_ — _Test:_ compare cell rendering (V-30). _M6·P1·[KNOW]_
- [ ] **DS-062** Detach alias — replaces the alias with the target's current resolved value for that mode column. _Data:_ `valuesByMode[mode]` _Test:_ alias across a 2-mode chain; detach in Dark; stored literal equals previously resolved Dark value (V-30). _M6·P0·[KNOW]_
- [ ] **DS-063** Alias chain mode resolution — each hop resolves using the consumer's resolved mode for that hop's collection (2×2 modes → 4 outcomes). _Data:_ `resolveForConsumer` semantics _Test:_ reproduce the typings example (values 1,2,3,4) with frames; all four frames render the expected values. _M6·P0·[API]_
- [ ] **DS-064** Composed color: alias + opacity — a color cell may alias a color variable and set its own opacity (literal or FLOAT alias). _Data:_ `VariableComposedColor {color: VariableAlias, opacity: number|VariableAlias}` _Test:_ `brand/primary-50` = alias `brand/primary` at 50 %; canvas alpha halves; changing the source color updates it (V-39). _M6·P1·[API]·[SRC:github plugin-typings #375]_
- [ ] **DS-065** Composed color: literal color + aliased opacity — supported; literal+literal collapses to plain RGBA. _Data:_ `{color: RGB|RGBA, opacity: VariableAlias}` _Test:_ create and export; compare stored shape (V-39). _M6·P1·[API]_
- [ ] **DS-066** Translucent-source opacity rule — when the aliased source color is already translucent, the opacity field is disabled, shows inherited alpha, and the stored opacity is inactive until source alpha becomes 1. _Data:_ composed color _Test:_ source alpha 40 %; record field state and rendering; then set source to 100 % (V-39). _M6·P2·[SRC:github plugin-typings #381 excerpt]_
- [ ] **DS-067** Deleted alias target — alias cell referencing a deleted variable shows deleted state and resolves to last known value. _Data:_ `deletedButReferenced` _Test:_ delete target; record cell + canvas (V-18). _M6·P1·[API]·[KNOW]_
- [ ] **DS-068** Alias depth — chains of ≥ 32 hops resolve without error or noticeable delay. _Data:_ alias graph _Test:_ generated chain of 32 aliases; bound node renders the leaf value. _M6·P2·[KNOW]_

### 6.6 Scopes

- [ ] **DS-069** Default scope — new COLOR/FLOAT/STRING variables default to "All supported properties" (`ALL_SCOPES`). _Data:_ `scopes = ['ALL_SCOPES']` _Test:_ create; open Edit variable; export JSON; compare (V-12). _M6·P0·[KNOW]_
- [ ] **DS-070** `ALL_SCOPES` exclusivity — selecting any specific scope removes `ALL_SCOPES`; re-checking "All" clears specifics. _Data:_ `scopes` _Test:_ toggle sequence; export scopes after each step. _M6·P0·[API]_
- [ ] **DS-071** `ALL_FILLS` exclusivity — Fill parent option = `ALL_FILLS`; selecting a subset stores the sub-scopes; selecting all three collapses to `ALL_FILLS`. _Data:_ `ALL_FILLS, FRAME_FILL, SHAPE_FILL, TEXT_FILL` _Test:_ toggle sub-options; export scopes (V-12). _M6·P0·[API]·[KNOW]_
- [ ] **DS-072** Valid scopes per type — FLOAT/STRING/COLOR scope lists exactly as §2.4 (incl. `CORNER_RADIUS` for FLOAT pending V-12); BOOLEAN has no scoping UI. _Data:_ `VariableScope` _Test:_ open scoping UI for each type; record option labels → scope mapping. _M6·P0·[API]·[KNOW]_
- [ ] **DS-073** Picker filtering — a field's variable picker lists only variables of the matching type whose scopes include the field's scope (or `ALL_SCOPES`). _Data:_ `scopes` _Test:_ FLOAT `radius/sm` scoped to Corner radius appears in radius picker, not in gap picker. _M6·P0·[API]_
- [ ] **DS-074** Fill sub-scopes by node kind — `FRAME_FILL` offered on frames/components/instances/sections, `SHAPE_FILL` on shapes/vectors, `TEXT_FILL` on text. _Data:_ scopes _Test:_ color scoped to Text fill only; check fill pickers of frame, rectangle, text (V-12). _M6·P0·[KNOW]_
- [ ] **DS-075** Scopes are not validation — changing scopes never removes existing bindings; paste-properties can apply out-of-scope variables. _Data:_ `scopes` _Test:_ bind gap, then remove Gap scope; binding persists. _M6·P0·[API]_
- [ ] **DS-076** Layer opacity vs color opacity scopes — `OPACITY` offers the variable in layer opacity; `COLOR_OPACITY` in paint/composed-color opacity. _Data:_ `OPACITY`, `COLOR_OPACITY` _Test:_ scope a FLOAT to each; check both pickers (V-12). _M6·P1·[API]_

### 6.7 Code syntax, descriptions, hide from publishing

- [ ] **DS-077** Add code syntax — per platform WEB/ANDROID/iOS, free text, at most one string per platform. _Data:_ `codeSyntax`, `setVariableCodeSyntax` _Test:_ add all three; export JSON; compare (V-16). _M6·P1·[API]_
- [ ] **DS-078** Remove code syntax — removing a platform row deletes only that key. _Data:_ `removeVariableCodeSyntax` _Test:_ remove ANDROID; others remain. _M6·P1·[API]_
- [ ] **DS-079** Variable description — plain text, multi-line allowed, shown on hover in pickers. _Data:_ `description` _Test:_ add 2-line description; hover in fill picker; compare tooltip (V-16). _M6·P1·[API]·[KNOW]_
- [ ] **DS-080** Style description, rich description & doc link — editable in Edit style; one documentation link. _Data:_ `description`, `descriptionMarkdown`, `documentationLinks` _Test:_ set bold text + link; hover in picker. _M6·P2·[API]·[DOC:7938814091287 title]_
- [ ] **DS-081** Variable hide-from-publishing — checkbox; hidden variables stay usable locally and are excluded from publish. _Data:_ `Variable.hiddenFromPublishing` _Test:_ hide `space/md`; still in local pickers; not in publish dialog. _M6·P1·[API]_
- [ ] **DS-082** Publishability rule — variable published only if neither it nor its collection is hidden. _Data:_ both flags _Test:_ 4 combinations; check publish dialog. _M6·P1·[API]_
- [ ] **DS-083** Style hide prefix — styles whose name (first segment) starts with `_` or `.` are excluded from publishing. _Data:_ `name` _Test:_ `_private/red`, `.tmp` styles; publish dialog excludes them (V-23). _M6·P1·[KNOW]·[DOC:360039238193 title]_

### 6.8 Groups & order

- [ ] **DS-084** Slash grouping — `/` in a variable name creates nested groups in the sidebar and table. _Data:_ `name` _Test:_ `a/b/c` → groups a > b with c. _M6·P0·[DOC:15145852043927 excerpt]_
- [ ] **DS-085** New group with selection — right-click selected variables → *New group with selection* prefixes them with a new group and focuses its name. _Data:_ `name` _Test:_ select 2 variables, run command; record default group name (V-25). _M6·P1·[DOC:15145852043927 excerpt]_
- [ ] **DS-086** Rename group — renaming a group rewrites that segment in every contained (incl. nested) variable name. _Data:_ `name` _Test:_ rename `color` → `colour`; all children renamed; bindings intact. _M6·P0·[DOC:15145852043927 excerpt]_
- [ ] **DS-087** Group rename collision — renaming a group so that names collide is rejected atomically (no partial rename). _Data:_ `name` _Test:_ groups `a` and `b` both contain `x`; rename `a`→`b` (V-25). _M6·P1·[KNOW]_
- [ ] **DS-088** Ungroup — removes the group segment from contained variables, moving them up one level. _Data:_ `name` _Test:_ ungroup `color/bg` group `color`; result `bg` (V-25 collisions). _M6·P1·[DOC:15145852043927 excerpt]_
- [ ] **DS-089** Duplicate group — duplicates all contained variables under a new group name. _Data:_ new variables _Test:_ duplicate `color`; record new group name and alias targets of duplicates (V-26). _M6·P2·[DOC:15145852043927 excerpt]_
- [ ] **DS-090** Delete group — deletes all contained variables (soft-delete semantics), one undo step. _Data:_ `remove()` × n _Test:_ delete group with 5 variables; undo once restores all. _M6·P1·[DOC:15145852043927 excerpt]_
- [ ] **DS-091** Drag groups — reorder groups in the sidebar; drop onto a group to nest it (paths rewritten). _Data:_ order tree, `name` _Test:_ nest `space` into `layout`; names become `layout/space/...`. _M6·P1·[DOC:15145852043927 excerpt]_
- [ ] **DS-092** Group filter — selecting a group in the sidebar shows only its (nested) variables; *All variables* shows all. _Data:_ UI state _Test:_ click group; compare visible rows. _M6·P1·[KNOW]_
- [ ] **DS-093** Persisted order with groups — variable and group order survive save/reopen and are used by pickers. _Data:_ order tree (§3.8) _Test:_ custom order; reopen; compare table and fill picker ordering. _M6·P1·[API]·[KNOW]_

### 6.9 Variables table UI

- [ ] **DS-094** Open variables modal — from the right panel with nothing selected; also reachable while a layer is selected via the panel's variables entry (if present). _Data:_ UI _Test:_ record entry points in Figma (V-27). _M6·P0·[KNOW]_
- [ ] **DS-095** Non-blocking modal — canvas selection/editing remains possible while the modal is open; modal can be moved/resized; position remembered per session. _Data:_ UI state _Test:_ with modal open, select and move a layer (V-27). _M6·P1·[KNOW]_
- [ ] **DS-096** Sidebar — lists collections, their groups (nested, collapsible), *All variables*; *Toggle sidebar* hides it. _Data:_ UI _Test:_ compare sidebar structure for F1. _M6·P1·[DOC:15145852043927 excerpt]_
- [ ] **DS-097** Mode columns — Name column plus one column per mode in collection order, default mode first; horizontal scroll for many modes. _Data:_ `modes` _Test:_ 6-mode collection; compare column order and scrolling. _M6·P0·[KNOW]_
- [ ] **DS-098** Search — filters rows by name (and value? per V-28) within the current collection; clearing restores the view. _Data:_ UI _Test:_ search `bg`, then a hex value; record matches (V-28). _M6·P1·[KNOW]_
- [ ] **DS-099** Context menus — row, mode-header, group and collection menus offer exactly the Figma command set (§3.10.4). _Data:_ — _Test:_ capture each menu in Figma (V-29). _M6·P1·[KNOW]_
- [ ] **DS-100** Large-collection performance — 5,000 variables × 10 modes scroll at 60 fps (virtualized) and exact-name search always finds a variable. _Data:_ — _Test:_ generated fixture; measure frame time; search last variable. _M6·P1·[SRC:forum.figma.com 58145 title]_
- [ ] **DS-101** Keyboard navigation — arrow/Tab moves between cells, Enter edits, Esc cancels, Delete removes selected rows (§5). _Data:_ — _Test:_ keystroke script in both apps (V-73). _M6·P2·[KNOW]_

### 6.10 Binding — general

- [ ] **DS-102** Apply-variable affordance — hovering a bindable inspector field reveals an *Apply variable* control that opens the variable picker. _Data:_ — _Test:_ hover W, gap, radius, opacity; record affordance (V-31). _M6·P0·[KNOW]_
- [ ] **DS-103** Picker contents — filtered by type and scope; grouped by collection (local first, then libraries by name); searchable; shows values in the selection's resolved mode. _Data:_ `scopes`, `resolvedType` _Test:_ open the gap picker in F1; compare groups, order and displayed values (V-31). _M6·P0·[API]·[KNOW]_
- [ ] **DS-104** Bound display — a bound field shows the variable name pill; hover shows the resolved value; clicking the pill reopens the picker to swap variables. _Data:_ `boundVariables[field]` _Test:_ bind gap to `space/md`; compare field rendering (V-31). _M6·P0·[KNOW]_
- [ ] **DS-105** Detach variable — detaching replaces the binding with the currently resolved value; canvas unchanged. _Data:_ `setBoundVariable(field, null)` _Test:_ frame in Comfortable, gap bound to `space/md`; detach → gap 16 raw. _M6·P0·[API]·[KNOW]_
- [ ] **DS-106** Typing into a bound field — entering a number into a bound field detaches and sets the raw value. _Data:_ `boundVariables` removed _Test:_ type 20 into bound gap; record (V-33). _M6·P0·[KNOW]_
- [ ] **DS-107** Canvas edits of bound geometry — resizing/handle-dragging a bound width/height/radius detaches the binding and writes the new raw value. _Data:_ `boundVariables.width` _Test:_ drag right edge of a frame with bound width (V-34). _M6·P0·[KNOW]_
- [ ] **DS-108** Multi-selection binding — applying binds every selected node that supports the field; differing bindings show *Mixed*; detach on mixed detaches all. _Data:_ `boundVariables` per node _Test:_ 3 frames, 2 bound to different variables; inspect field; apply; detach (V-31). _M6·P0·[KNOW]_
- [ ] **DS-109** Fill picker Libraries tab — lists color styles and color variables (local + enabled libraries); choosing a variable binds the active paint's color. _Data:_ `fills[i].boundVariables.color` _Test:_ open fill swatch → Libraries; bind `color/bg`. _M6·P0·[OBS]·[KNOW]_
- [ ] **DS-110** Type safety — the data layer rejects binding a variable whose resolved type does not match the field (e.g. STRING to width). _Data:_ binding validator _Test:_ Illigma unit test; Figma: confirm such binding is impossible via UI. _M6·P0·[API]_
- [ ] **DS-111** Library variable binding — binding a library variable imports a read-only remote copy and records library provenance. _Data:_ `remote`, `key` _Test:_ bind library color; inspect variables list/pickers in consumer. _M6·P0·[API]_
- [ ] **DS-112** Swap bound variable — choosing another variable in the picker of a bound field replaces the binding in one undo step. _Data:_ `boundVariables` _Test:_ swap `space/md`→`space/lg`; ⌘Z restores `space/md`. _M6·P1·[KNOW]_

### 6.11 Binding — per field

- [ ] **DS-113** Width/height binding — FLOAT binds `width`/`height`; binding switches Hug/Fill sizing to Fixed. _Data:_ `width`, `height` _Test:_ hug-width auto-layout frame; bind width; record sizing mode (V-36). _M4·P0·[API]·[KNOW]_
- [ ] **DS-114** Min/max binding — `minWidth, maxWidth, minHeight, maxHeight` bindable where min/max controls exist. _Data:_ fields _Test:_ bind maxWidth on an auto-layout child; resize parent; child clamps at variable value. _M4·P1·[API]_
- [ ] **DS-115** Gap binding — `itemSpacing` bindable; not bindable while gap is Auto (space-between). _Data:_ `itemSpacing` _Test:_ set Auto spacing; check affordance (V-37). _M4·P0·[API]·[OBS]·[KNOW]_
- [ ] **DS-116** Wrap gap binding — `counterAxisSpacing` bindable only when `layoutWrap = WRAP`. _Data:_ `counterAxisSpacing` _Test:_ wrap frame, bind row gap; switch wrap off → field hidden, binding retained? (record). _M4·P1·[API]_
- [ ] **DS-117** Grid gap binding — `gridRowGap`, `gridColumnGap` bindable for GRID auto layout. _Data:_ fields _Test:_ grid frame; bind both; change Spacing mode; gaps update. _M4·P1·[API]_
- [ ] **DS-118** Padding binding — each side bindable; binding the horizontal/vertical pair control binds both sides. _Data:_ `paddingLeft/Right/Top/Bottom` _Test:_ bind horizontal padding; export bindings (V-14). _M4·P0·[API]·[KNOW]_
- [ ] **DS-119** Corner radius binding — binding the uniform radius on a rectangle/frame stores four per-corner bindings; inspector shows one pill. _Data:_ `topLeftRadius…bottomRightRadius` _Test:_ bind radius; REST-export node bindings; four `rectangleCornerRadii` entries. _M2·P0·[API]_
- [ ] **DS-120** Per-corner radius binding — each corner independently bindable from the independent-corners UI. _Data:_ per-corner fields _Test:_ bind only top-left; others raw. _M2·P1·[API]_
- [ ] **DS-121** Stroke weight binding — uniform and per-side weights bindable. _Data:_ `strokeWeight`, `stroke{Top,Right,Bottom,Left}Weight` _Test:_ bind uniform; then per-side top only; render check. _M2·P0·[API]_
- [ ] **DS-122** Layer opacity binding — FLOAT bound to `opacity` interpreted as percent; out-of-range values clamp at render. _Data:_ `opacity` _Test:_ variable 50 → 50 %; 150 → record; −10 → record (V-38). _M6·P0·[API]·[KNOW]_
- [ ] **DS-123** Visibility binding — BOOLEAN bound to `visible`; false hides layer on canvas and in export; layers panel reflects hidden state. _Data:_ `visible` _Test:_ bind to `flag/show`; switch frame mode to Dark (false); layer hidden (V-32). _M6·P0·[API]_
- [ ] **DS-124** Fill color binding per paint — each SOLID paint of a multi-fill layer binds independently; paint opacity remains separate. _Data:_ `fills[i].boundVariables.color` _Test:_ 2 fills bound to different variables; reorder fills; bindings follow paints (V-39). _M2·P0·[API]_
- [ ] **DS-125** Stroke color binding — per stroke paint. _Data:_ `strokes[i].boundVariables.color` _Test:_ bind stroke; switch mode. _M2·P0·[API]_
- [ ] **DS-126** Gradient stop binding — each gradient stop color bindable. _Data:_ `ColorStop.boundVariables.color` _Test:_ linear gradient, bind stop 2; switch mode. _M2·P1·[API]_
- [ ] **DS-127** Non-bindable paints — image, video, pattern and shader paints expose no variable binding. _Data:_ no `boundVariables` _Test:_ inspect image fill popover for apply-variable affordance. _M2·P1·[API]_
- [ ] **DS-128** Shadow bindings — drop/inner shadow color, blur, spread, X, Y bindable. _Data:_ `effects[i].boundVariables{color,radius,spread,offsetX,offsetY}` _Test:_ bind all five; switch modes. _M2·P0·[API]_
- [ ] **DS-129** Blur binding — layer/background blur radius bindable; progressive blur start radius/offsets not. _Data:_ `boundVariables.radius` _Test:_ progressive blur; check affordances. _M2·P1·[API]_
- [ ] **DS-130** Non-bindable effects — noise, texture and glass effects have no bindable fields. _Data:_ `boundVariables: {}` _Test:_ inspect effect popovers. _M2·P2·[API]_
- [ ] **DS-131** Layout grid bindings — columns/rows: count, gutter, offset, section size; grid: size. _Data:_ `layoutGrids[i].boundVariables` _Test:_ bind column count to FLOAT; switch mode; columns change. _M4·P1·[API]_
- [ ] **DS-132** Text content binding (STRING) — `characters` bound to a STRING variable renders the variable text in the node's mode. _Data:_ `boundVariables.characters` _Test:_ bind to `copy/title`; Dark frame shows "Bonjour". _M3·P0·[API]_
- [ ] **DS-133** Text content binding (FLOAT) — number variables bind to text content with Figma's number formatting. _Data:_ `characters` _Test:_ bind 1.5 / 1000 / -0.25; record rendered text (V-40). _M3·P1·[API]·[KNOW]_
- [ ] **DS-134** Editing bound text — double-click editing of bound text content detaches (or is blocked) exactly as Figma. _Data:_ `characters` _Test:_ double-click bound text and type (V-40). _M3·P0·[KNOW]_
- [ ] **DS-135** Font family binding — STRING bound to `fontFamily`; unavailable family → missing-font state. _Data:_ `fontFamily` _Test:_ mode A "Inter", mode B "NoSuchFont"; switch modes (V-41). _M3·P1·[API]·[KNOW]_
- [ ] **DS-136** Font style binding — STRING bound to `fontStyle` (e.g. "Bold Italic"). _Data:_ `fontStyle` _Test:_ variable "Semi Bold"; record rendering; invalid style (V-41). _M3·P1·[API]_
- [ ] **DS-137** Font weight binding — FLOAT bound to `fontWeight` selects the matching style of the family. _Data:_ `fontWeight` _Test:_ 700 → Bold; 650 → record (V-41). _M3·P1·[API]·[KNOW]_
- [ ] **DS-138** Font size / paragraph spacing / paragraph indent binding — FLOAT px. _Data:_ `fontSize, paragraphSpacing, paragraphIndent` _Test:_ bind each; switch modes. _M3·P0·[API]_
- [ ] **DS-139** Line height / letter spacing binding units — unit interpretation (px vs %) matches Figma. _Data:_ `lineHeight, letterSpacing` _Test:_ field unit % then bind variable 120; record (V-42). _M3·P1·[API]·[KNOW]_
- [ ] **DS-140** Text range bindings — text fields and fills bind per character range; node-level fields show Mixed. _Data:_ `setRangeBoundVariable`, `textRangeFills` _Test:_ bind font size on the first word only; inspect whole node. _M3·P1·[API]_
- [ ] **DS-141** Component property value binding (instance) — BOOLEAN and TEXT property values on instances bindable. _Data:_ `componentProperties[name].boundVariables.value` _Test:_ instance with "Show icon" bool; bind to `flag/show`; switch modes (V-43). _M5·P0·[API]_
- [ ] **DS-142** Component property default binding (definition) — property default value bindable on the main component. _Data:_ `componentPropertyDefinitions[name].boundVariables.defaultValue` _Test:_ bind TEXT default to `copy/title`; new instances show bound value (V-43). _M5·P1·[API]_

### 6.12 Explicit modes & resolution

- [ ] **DS-143** Set explicit mode on a frame — *Apply variable mode* → collection → mode; descendants re-resolve. _Data:_ `setExplicitVariableModeForCollection` _Test:_ F1 frame → Theme: Dark; children bound to `color/bg` turn black (V-44). _M6·P0·[API]·[KNOW]_
- [ ] **DS-144** Auto — choosing *Auto* clears the explicit mode; menu shows the inherited mode name. _Data:_ `clearExplicitVariableModeForCollection` _Test:_ nested frame Auto under Dark parent shows "Auto (Dark)" (V-44). _M6·P0·[API]·[KNOW]_
- [ ] **DS-145** Nearest-ancestor inheritance — resolution walks node → ancestors → page → default. _Data:_ `resolvedVariableModes` _Test:_ page Dark, frame Light, child Auto → Light; remove frame mode → Dark. _M6·P0·[API]_
- [ ] **DS-146** Page mode — page-level explicit modes set from the page panel apply to all layers without an override. _Data:_ `PageNode.explicitVariableModes` _Test:_ set page Dark; loose rectangle on page turns black. _M6·P0·[API]·[KNOW]_
- [ ] **DS-147** Per-collection independence — explicit modes are independent per collection. _Data:_ map keyed by collection _Test:_ frame Theme Dark + Spacing Compact; both apply. _M6·P0·[API]_
- [ ] **DS-148** Relevant-collection menu — mode menu lists collections with > 1 mode used within the selection (incl. library collections) per V-44. _Data:_ — _Test:_ frame containing only Theme-bound layers; record listed collections (V-44). _M6·P1·[KNOW]_
- [ ] **DS-149** Mixed mode display — multi-selection with differing modes shows Mixed; choosing a mode sets all. _Data:_ — _Test:_ 2 frames Light/Dark selected (V-44). _M6·P1·[KNOW]_
- [ ] **DS-150** Explicit modes on sections, components, groups — available on every layer type Figma exposes (V-44 list). _Data:_ `explicitVariableModes` _Test:_ try section, component, group, rectangle. _M6·P1·[API]·[KNOW]_
- [ ] **DS-151** Component explicit modes propagate — explicit modes inside a main component apply in all instances. _Data:_ component subtree modes _Test:_ main component child set Dark; instances show Dark child (V-47). _M5·P0·[KNOW]_
- [ ] **DS-152** Instance mode override — setting a mode on an instance is an instance override and wins over inherited context for that collection; *Reset all changes* clears it. _Data:_ `InstanceNode.explicitVariableModes` _Test:_ instance in Light frame set Dark; reset (V-47). _M5·P0·[KNOW]_
- [ ] **DS-153** Re-resolution on move — moving/pasting a layer into another mode context re-resolves values; its own explicit modes travel with it. _Data:_ — _Test:_ drag child from Dark to Light frame. _M6·P0·[API]_
- [ ] **DS-154** Library collection modes — modes of remote collections can be set on layers and resolve with the accepted library version. _Data:_ remote `modeId` _Test:_ library Theme; consumer frame Dark. _M6·P0·[API]_
- [ ] **DS-155** Resolution cache invalidation — any value, alias, mode, explicit-mode or tree change invalidates exactly the affected resolutions (no stale renders). _Data:_ cache _Test:_ randomized edit sequence; compare render with uncached resolver. _M6·P0·[API]_

### 6.13 Extended collections

- [ ] **DS-156** Extend local collection — context menu *Extend collection* creates a named extension inheriting all variables and modes. _Data:_ `collection.extend(name)` _Test:_ extend Theme as "Brand B"; compare variables/modes listed (V-45). _M6·P1·[API]·[DOC:36346281624471 excerpt]_
- [ ] **DS-157** Extend library collection — a consumer file can extend a library collection locally. _Data:_ `extendLibraryCollectionByKeyAsync` _Test:_ extend library Theme; edit overrides locally. _M6·P2·[API]_
- [ ] **DS-158** Override per mode — editing a cell in the extension stores an override for that variable+mode only; cell highlighted as overridden. _Data:_ `variableOverrides` _Test:_ override Dark `color/bg`; Light remains inherited. _M6·P1·[DOC:36346281624471 excerpt]_
- [ ] **DS-159** Reset change — *Reset change* on an overridden cell restores inheritance. _Data:_ `removeOverrideForMode` _Test:_ reset; cell value equals parent's. _M6·P1·[DOC:36346281624471 excerpt]·[API]_
- [ ] **DS-160** Reset all overrides for a variable. _Data:_ `removeOverridesForVariable` _Test:_ variable overridden in 2 modes; reset all (UI per V-45). _M6·P2·[API]_
- [ ] **DS-161** Structural edits blocked — no add variable/mode, no description/scope/code-syntax edits, no reorder/rename of modes in the extension. _Data:_ — _Test:_ attempt each in Figma and record (V-45). _M6·P1·[DOC:36346281624471 excerpt]_
- [ ] **DS-162** Parent propagation — parent value changes appear in non-overridden cells; new parent variables/modes appear in the extension. _Data:_ inheritance _Test:_ add variable and mode to parent; inspect extension. _M6·P1·[DOC:36346281624471 excerpt]_
- [ ] **DS-163** Parent mode deletion — the corresponding extended mode becomes removable (and resolves per V-45 until removed). _Data:_ `ExtendedVariableCollection.removeMode` _Test:_ delete parent Dark; inspect extension. _M6·P2·[API]_
- [ ] **DS-164** Extension chains — an extension can be extended again; values resolve through the chain. _Data:_ `rootVariableCollectionId` _Test:_ A→B→C, override in B only; C shows B's value. _M6·P2·[API]_
- [ ] **DS-165** Theming by extension mode — setting the extension's mode on a frame re-themes all root-collection variables in that subtree; precedence per V-46. _Data:_ explicit mode keyed by extension id _Test:_ frame "Brand B / Dark" vs sibling "Theme / Dark". _M6·P1·[KNOW]_
- [ ] **DS-166** Publish extensions — extensions publish as collections; overrides travel with them. _Data:_ publish snapshot _Test:_ publish; consumer applies Brand B mode (V-76). _M6·P2·[KNOW]·[SRC:developers.figma.com variables-types excerpt]_

### 6.14 Styles — create & apply

- [ ] **DS-167** Create color (paint) style from selection — Style control → *+* → name/description → style created from all fills of the selection and applied in the same undo step. _Data:_ `createPaintStyle`, `paints`, `fillStyleId` _Test:_ rectangle with 2 fills; create style; ⌘Z once removes style and application (V-49). _M6·P0·[KNOW]_
- [ ] **DS-168** Create text style from selection — captures fontName, size, line height, letter spacing, paragraph spacing/indent, list spacing, hanging punctuation/list, case, decoration, leading trim, wrap style; not color/alignment. _Data:_ `TextStyle` fields _Test:_ create from styled text; inspect style editor (V-49). _M6·P0·[API]·[KNOW]_
- [ ] **DS-169** Create effect style from selection — captures the whole effect list in order. _Data:_ `EffectStyle.effects` _Test:_ 2 shadows + blur → style; apply elsewhere; identical. _M6·P0·[API]·[KNOW]_
- [ ] **DS-170** Create layout-guide (grid) style from selection — captures all layout grids. _Data:_ `GridStyle.layoutGrids` _Test:_ 12-col + 8px grid → style. _M6·P1·[API]·[KNOW]_
- [ ] **DS-171** Create style without selection — *+* in right-panel styles list creates a style with default values (text default Inter Regular 12). _Data:_ `createTextStyle()` default _Test:_ create each type with nothing selected; record defaults (V-50). _M6·P1·[API]·[KNOW]_
- [ ] **DS-172** Mixed values block creation — create-style is unavailable when the section shows Mixed. _Data:_ — _Test:_ select two rectangles with different fills (V-49). _M6·P1·[KNOW]_
- [ ] **DS-173** Apply paint style to fill — replaces the entire fills array; `fillStyleId` set. _Data:_ `fillStyleId` _Test:_ 3-fill layer + 1-paint style → 1 paint. _M6·P0·[API]_
- [ ] **DS-174** Apply paint style to stroke — replaces strokes; `strokeStyleId` set. _Data:_ `strokeStyleId` _Test:_ apply from stroke Style control. _M6·P0·[API]_
- [ ] **DS-175** Apply text style — to whole node or selected range; range application yields mixed `textStyleId` at node level. _Data:_ `textStyleId`, `setRangeTextStyleIdAsync` _Test:_ apply to one word; node shows Mixed. _M6·P0·[API]_
- [ ] **DS-176** Apply paint style to text range — character range fill style. _Data:_ `setRangeFillStyleIdAsync` _Test:_ color one word with a color style. _M6·P1·[API]_
- [ ] **DS-177** Apply effect style — replaces effect list; `effectStyleId`. _Data:_ `effectStyleId` _Test:_ layer with 1 effect + 2-effect style. _M6·P0·[API]_
- [ ] **DS-178** Apply grid style — replaces layout grids; `gridStyleId`. _Data:_ `gridStyleId` _Test:_ frame with grid + grid style. _M6·P1·[API]_
- [ ] **DS-179** Applied-style display — section shows style name/preview; individual property fields hidden until detach. _Data:_ — _Test:_ compare fill/text sections (V-51). _M6·P0·[KNOW]_
- [ ] **DS-180** Style picker — list/grid toggle, search, local section first then each enabled library in order, folders shown as headers/nested. _Data:_ UI _Test:_ open picker in a file with local + 2 library styles (V-51). _M6·P1·[KNOW]_
- [ ] **DS-181** Multi-selection apply — applying a style applies to all selected nodes that have the property. _Data:_ style ids _Test:_ 3 layers; apply effect style. _M6·P0·[KNOW]_

### 6.15 Styles — edit, detach, delete, organize

- [ ] **DS-182** Detach style — keeps resolved values; clears style reference; behavior of variable bindings inside the style values per V-52. _Data:_ `…StyleId = ''` _Test:_ detach a paint style whose color is variable-bound; inspect fill binding (V-52). _M6·P0·[KNOW]_
- [ ] **DS-183** Text style semantic overrides — ⌘B/⌘I, underline/decoration and hyperlinks on styled text keep the style applied (recorded as overrides). _Data:_ `textStyleOverrides` _Test:_ apply Body style, ⌘B a word; style still shown (V-53). _M3·P0·[API]·[KNOW]_
- [ ] **DS-184** Other typography edits on styled text — changing size/family etc. requires detach or style edit, exactly as Figma. _Data:_ — _Test:_ attempt ⌘⇧> on styled text; record (V-53). _M3·P1·[KNOW]_
- [ ] **DS-185** Edit style — editor with name, description and properties; changes propagate live to all consumers in the file. _Data:_ style fields _Test:_ edit color style hue; 5 consumers update. _M6·P0·[KNOW]_
- [ ] **DS-186** Rename style — renaming (incl. folder path) keeps all references. _Data:_ `name` _Test:_ rename `Brand/Red` → `Accent/Red`. _M6·P0·[API]_
- [ ] **DS-187** Duplicate style (conditional on V-54). _Data:_ new style _Test:_ check context menu in Figma. _M6·P2·[KNOW]_
- [ ] **DS-188** Delete style — consumers keep visuals; reference semantics per V-55; undo restores reference. _Data:_ `remove()` _Test:_ delete used style; inspect consumer; undo. _M6·P0·[KNOW]_
- [ ] **DS-189** Style folders — `/` creates nested folders in lists and pickers. _Data:_ `name` _Test:_ `Brand/Primary/500`. _M6·P0·[API]_
- [ ] **DS-190** Reorder styles — drag within a folder; order persisted and published. _Data:_ `moveLocal*StyleAfter`, `sort_position` _Test:_ reorder; reopen; consumer picker order (V-56). _M6·P1·[API]·[KNOW]_
- [ ] **DS-191** Reorder folders — drag folders within their parent folder. _Data:_ `moveLocal*FolderAfter` _Test:_ reorder 3 folders (V-56). _M6·P1·[API]_
- [ ] **DS-192** Folder rename/ungroup/delete — rename rewrites contained style paths; other ops per V-56. _Data:_ `name` _Test:_ rename folder; record menu options (V-56). _M6·P2·[KNOW]_
- [ ] **DS-193** Style consumers query — list nodes and fields using a style (internal capability for find-usages and delete warnings). _Data:_ `getStyleConsumersAsync` _Test:_ unit test against fixture; Figma parity via plugin call. _M6·P1·[API]_

### 6.16 Styles with variable values

- [ ] **DS-194** Paint style with variables — paint colors/gradient stops in a style bindable to COLOR variables. _Data:_ `PaintStyle.boundVariables.paints` _Test:_ style color bound to `color/bg`; consumer in Dark frame renders black (V-57). _M6·P0·[API]_
- [ ] **DS-195** Text style with variables — family, style, weight, size, line height, letter spacing, paragraph spacing, indent bindable on the style. _Data:_ `TextStyle.setBoundVariable` _Test:_ size bound to FLOAT with modes; consumers in two modes differ. _M6·P0·[API]_
- [ ] **DS-196** Effect style with variables — shadow color/blur/spread/offsets and blur radius bindable. _Data:_ `EffectStyle.boundVariables.effects` _Test:_ shadow color bound; switch modes. _M6·P1·[API]_
- [ ] **DS-197** Grid style with variables — grid numeric fields bindable. _Data:_ `GridStyle.boundVariables.layoutGrids` _Test:_ gutter bound to `space/md`. _M6·P2·[API]_
- [ ] **DS-198** Consumer-context resolution — variable values inside styles resolve in each consumer's resolved modes. _Data:_ resolver _Test:_ same style in Light & Dark frames renders differently (V-57). _M6·P0·[KNOW]_
- [ ] **DS-199** Style preview mode — style swatches/previews in pickers use the default modes. _Data:_ — _Test:_ record preview while selection is in Dark (V-57). _M6·P2·[KNOW]_

### 6.17 Components & instances interplay

- [ ] **DS-200** Bindings in main components propagate — bindings on layers inside a main component appear in all instances. _Data:_ component tree _Test:_ bind button fill in main; instances follow mode switches. _M5·P0·[KNOW]_
- [ ] **DS-201** Instance override of bound field — changing a bound property on an instance layer (bind another variable, detach, or raw value) is an override; *Reset* restores the main's binding. _Data:_ instance overrides _Test:_ rebind instance fill; reset. _M5·P0·[KNOW]_
- [ ] **DS-202** Style override on instance — applying/detaching a style on an instance layer is an override and resets with *Reset all changes*. _Data:_ instance overrides _Test:_ apply other color style to instance child; reset. _M5·P0·[KNOW]_
- [ ] **DS-203** Main-component edits keep instance overrides — changing a variable binding in the main does not overwrite instance layers that override that field. _Data:_ override precedence _Test:_ instance overrides fill; change main binding; instance keeps override. _M5·P0·[KNOW]_

### 6.18 Clipboard, undo/redo, export

- [ ] **DS-204** Same-file duplicate/copy-paste keeps bindings, style refs and explicit modes. _Data:_ node data _Test:_ ⌘D a bound frame; compare inspector. _M6·P0·[KNOW]_
- [ ] **DS-205** Copy/paste properties carry bindings — ⌘⌥C/⌘⌥V transfers fills/strokes/effects with their variable bindings and style references. _Data:_ — _Test:_ paste properties from bound to raw layer (V-68). _M6·P1·[KNOW]·[DOC:4412765442967 title]_
- [ ] **DS-206** Cross-file paste — library references stay library references; local references of the source file are handled exactly as Figma (V-69); visual value never lost. _Data:_ remote refs _Test:_ copy from file A (local + library vars) to file B. _M8·P1·[KNOW]_
- [ ] **DS-207** Undo granularity — each operation listed in §3.20 is exactly one undo step; undo restores identical IDs. _Data:_ undo stack _Test:_ scripted sequence of 20 ops; undo 20 times; document equals initial (V-67). _M0·P0·[KNOW]_
- [ ] **DS-208** UI state excluded from undo — opening/closing modal, search, row selection, collapse do not create undo steps. _Data:_ — _Test:_ open modal, search, ⌘Z → last document change undone, not UI. _M0·P1·[KNOW]_
- [ ] **DS-209** Export uses resolved values — PNG/SVG/PDF export renders each node in its resolved modes. _Data:_ — _Test:_ export Light and Dark frames; compare pixels. _M2·P0·[KNOW]_
- [ ] **DS-210** Code export uses code syntax — handoff/CSS copy emits WEB code syntax when present. _Data:_ `codeSyntax.WEB` _Test:_ variable with `var(--bg)`; copy CSS (handoff area). _M8·P2·[KNOW]_

### 6.19 Libraries (local-first)

- [ ] **DS-211** Publish dialog — lists new/changed/removed components, styles and variables (by collection) with per-item include checkboxes and a description field. _Data:_ publish snapshot _Test:_ change 1 style, add 1 variable; compare dialog lists (V-61). _M6·P0·[KNOW]·[DOC:360025508373 title]_
- [ ] **DS-212** Publish status — each asset reports `UNPUBLISHED`/`CURRENT`/`CHANGED` correctly before and after publish. _Data:_ `PublishStatus` _Test:_ edit a published style → CHANGED; publish → CURRENT. _M6·P0·[API]_
- [ ] **DS-213** Hidden assets never published — variables/collections with hidden flags and `_`/`.` styles are excluded. _Data:_ flags _Test:_ publish; consumer cannot see them. _M6·P0·[API]·[KNOW]_
- [ ] **DS-214** Library version on disk — publishing writes an immutable versioned snapshot (Illigma local-first format) with keys, values, timestamps and message. _Data:_ `PublishedSnapshot` _Test:_ publish twice; both versions readable; keys stable. _M6·P0·[API keys]_
- [ ] **DS-215** Enable library — a file can enable a library file from disk; its published assets appear in pickers and the Assets panel. _Data:_ `LibraryRef` _Test:_ enable; library variables listed in fill picker. _M6·P0·[DOC:1500008731201 title]·[KNOW]_
- [ ] **DS-216** Remote assets read-only — library styles/variables cannot be edited in consumers; *Go to main/library* opens the library file. _Data:_ `remote` _Test:_ attempt edit; record. _M6·P0·[API]_
- [ ] **DS-217** Update notification — opening/focusing a consumer when its library has a newer version shows an updates notification. _Data:_ `acceptedVersion` vs latest _Test:_ publish change; open consumer (V-64). _M6·P0·[KNOW]_
- [ ] **DS-218** Review & accept updates — Updates view lists changed styles/variables/components; *Update all* or per-item accept; one undo step. _Data:_ remote cache _Test:_ accept one of two; record (V-64). _M6·P0·[DOC:360039234193 title]·[KNOW]_
- [ ] **DS-219** Pending updates do not apply — until accepted, consumers render the previously accepted values. _Data:_ cached remote values _Test:_ publish color change; consumer unchanged until accept. _M6·P0·[KNOW]_
- [ ] **DS-220** Swap library — replaces usages of library A assets with same-named (same-type) assets of library B; unmatched assets reported and left; one undo step. _Data:_ remote refs _Test:_ two libraries with partially overlapping names (V-65). _M6·P1·[DOC:4404856784663 title]·[KNOW]_
- [ ] **DS-221** Missing libraries — unavailable library listed with usage count; assets keep rendering from cache; actions: locate file, swap, localize. _Data:_ `LibraryRef.lastKnownPath` _Test:_ move library file; reopen consumer (V-66). _M6·P1·[KNOW]_
- [ ] **DS-222** Unpublish library — no further updates; existing consumer usages keep working. _Data:_ snapshot status _Test:_ unpublish; consumer behavior (V-62). _M6·P2·[DOC:360039236853 title]·[KNOW]_
- [ ] **DS-223** Upstream deletion — accepting an update that removes a variable/style keeps consumer bindings with deleted indicator and last values. _Data:_ `deletedButReferenced` _Test:_ delete library variable, publish, accept in consumer (V-18). _M6·P1·[API]·[KNOW]_
- [ ] **DS-224** Remove library from file — disabling a library with used assets keeps those assets (remote/missing) exactly as Figma. _Data:_ `LibraryRef.enabled` _Test:_ disable used library (V-63). _M6·P1·[KNOW]_
- [ ] **DS-225** Show updates for all pages — Updates view toggle includes updates on non-current pages. _Data:_ UI _Test:_ library change used only on page 2 (V-64). _M6·P2·[SRC:forum.figma.com 58360 excerpt]_

### 6.20 Import / export

- [ ] **DS-226** Export mode — right-click a mode header → *Export mode* writes that mode's variables to a JSON file. _Data:_ mode values _Test:_ export F1 Dark in Figma; compare file structure with Illigma output (V-60). _M6·P1·[DOC:36346281624471 excerpt]_
- [ ] **DS-227** Import mode — *Import mode* overwrites values of variables matched by name **and** type; behavior for unmatched tokens per V-59. _Data:_ `valuesByMode` _Test:_ import a JSON with 1 match, 1 type mismatch, 1 new token (V-59). _M6·P1·[DOC:15343816063383 excerpt]_
- [ ] **DS-228** Import mode into an extension — writes overrides on the extended collection. _Data:_ `variableOverrides` _Test:_ import Brand B JSON into extension mode. _M6·P2·[DOC:36346281624471 excerpt]_
- [ ] **DS-229** Import validation report — type mismatches, unresolved aliases, cycles and cap overflow are reported; no partial corruption. _Data:_ — _Test:_ malformed fixture set. _M6·P1·[KNOW]_
- [ ] **DS-230** DTCG 2025.10 export — full collections to W3C DTCG JSON (groups nested, `$type`, `$value`, `$description`, curly-brace aliases, Figma extensions for scopes/code syntax). _Data:_ §3.18 mapping _Test:_ validate against DTCG schema; compare with Figma export where overlapping (V-60). _M6·P1·[SRC:figma.com/blog/schema-2025 excerpt]·[KNOW]_
- [ ] **DS-231** DTCG import — creates/updates collections, modes, variables and aliases from DTCG files. _Data:_ — _Test:_ import Figma-exported mode files into a new Illigma file; values identical. _M6·P1·[KNOW]_
- [ ] **DS-232** Figma REST JSON round-trip — import/export `variables/local` response shape losslessly (incl. extensions, `deletedButReferenced`). _Data:_ REST `LocalVariable`, `LocalVariableCollection` _Test:_ round-trip a captured REST payload. _M8·P1·[API]_
- [ ] **DS-233** Import is one undo step. _Data:_ undo stack _Test:_ import 100 tokens; ⌘Z once removes all (V-59). _M6·P1·[KNOW]_
- [ ] **DS-234** Description export gap — document (and test) whether descriptions are exported; Illigma includes `$description` (Figma reportedly omits it). _Data:_ `description` _Test:_ export a described variable from Figma (V-60). _M6·P2·[SRC:forum.figma.com 51314 excerpt]_

### 6.21 Design-system management

- [ ] **DS-235** Selection colors list — distinct raw colors, color styles and color variables in the selection; hidden/null above 1,000 colors. _Data:_ `getSelectionColors` _Test:_ frame with mixed sources; compare list (V-35). _M6·P1·[API]·[KNOW]_
- [ ] **DS-236** Select matching layers — from a selection-colors entry, selects all layers in the selection using that color/style/variable. _Data:_ — _Test:_ click target icon (V-35). _M6·P1·[KNOW]_
- [ ] **DS-237** Bulk edit via selection colors — editing a raw color rewrites all occurrences; applying a variable/style to an entry binds/applies all occurrences in one undo step. _Data:_ — _Test:_ replace `#FF0000` everywhere with `color/bg` (V-35). _M6·P1·[KNOW]_
- [ ] **DS-238** Select all with same fill/stroke/effect/font — Edit-menu commands compare per Figma (raw vs style/variable identity, V-71). _Data:_ — _Test:_ layers with same raw color but different binding (V-71). _M1·P2·[KNOW]_
- [ ] **DS-239** Find usages of a style (Illigma extension) — list and select consumers. _Data:_ `getStyleConsumersAsync` _Test:_ fixture with 7 consumers across 2 pages. _M6·P2·[API]_
- [ ] **DS-240** Find usages of a variable (Illigma extension) — list bound fields, aliases and styles referencing it. _Data:_ reverse index _Test:_ fixture with direct, alias and style usages. _M6·P2·[KNOW]_
- [ ] **DS-241** Inferred-variable suggestion — unbound field whose raw value uniquely matches one in-scope variable offers a one-click bind; ambiguous matches offer none. _Data:_ `inferredVariables` rule _Test:_ width 100 with one WIDTH_HEIGHT variable = 100 → suggestion; two → none. _M6·P2·[API]_
- [ ] **DS-242** Rename safety — renaming variables, groups, collections, styles or folders never breaks bindings/references. _Data:_ ID references _Test:_ rename everything in F1; render unchanged. _M6·P0·[API]_

### 6.22 Prototype & Motion interplay (data only in this area)

- [ ] **DS-243** No expressions in variable values — variable cells accept only literals, aliases or composed colors; expressions exist only in prototype actions. _Data:_ `VariableValue` vs `VariableValueWithExpression` _Test:_ attempt `=a+b` style input in a Figma cell; record (V-22). _M6·P0·[API]_
- [ ] **DS-244** Prototype variable data preserved — `SET_VARIABLE`, `SET_VARIABLE_MODE`, `CONDITIONAL` actions with expressions round-trip losslessly until M7 implements them. _Data:_ `Action`, `VariableData`, `Expression` _Test:_ import a prototype with conditionals; export; identical. _M7·P1·[API]_
- [ ] **DS-245** Prototype mode switching does not mutate document — `SET_VARIABLE_MODE` at playback changes runtime modes only. _Data:_ runtime state _Test:_ play prototype, switch mode, stop; document modes unchanged. _M7·P0·[API]·[KNOW]_
- [ ] **DS-246** Timing/easing variables (Motion) — create/edit TIMING (duration) and EASING (curve/spring) variables and bind to Motion durations/easings, with page-level mode switching. _Data:_ `TIMING`, `EASING`, `MotionEasing` _Test:_ easing variable with 2 modes applied to keyframes; switch page mode (V-58). _M7·P2·[DOC:14506821864087 excerpt]·[API]_

---
## 7. Cross-area dependencies

| Area (milestone) | Dependency |
| --- | --- |
| Document model, persistence, undo/redo (M0) | ID-stable entity store for variables/collections/styles; ordered trees for variable order and style folders; soft-delete tombstones; single-step compound transactions (bulk bind, import, swap library); derived-state caches excluded from persistence. |
| Renderer (M0) | Resolution service (`resolve(variable, node)`) consulted for every bound field at render; invalidation graph (variable → aliases → styles → nodes); per-node resolved-mode computation. |
| UI component kit (M0) | Variable pill, apply-variable affordance on every numeric/color field, searchable grouped picker, data-grid (virtualized, resizable columns), context menus, floating modal. |
| Layers panel & selection (M1) | Visibility bound to BOOLEAN; Edit → *Select all with same …*; selection-colors section; multi-select Mixed states. |
| Shapes, frames, sections, pages (M1) | Explicit modes on pages, frames, sections, groups; corner radius per-corner storage; width/height binding vs fixed sizing. |
| Paint, color picker, effects, export (M2) | Paint/gradient-stop/effect bindings; composed color opacity; Libraries tab in color popover; style application on fills/strokes/effects; export resolves modes. |
| Text & typography (M3) | Text-field and per-range bindings, text styles, semantic overrides (`textStyleOverrides`), missing-font handling for STRING-bound families, text content binding. |
| Layout (M4) | Gap/padding/min-max/grid-gap bindings; Auto gap disables gap binding; layout grids and grid styles; Hug/Fill → Fixed when width/height bound. |
| Components (M5) | Bindings inside main components; instance overrides of bindings, styles and explicit modes; component property value/default bindings; library publishing of components shares the publish/update pipeline. |
| Prototyping & Motion (M7) | `SET_VARIABLE`, `SET_VARIABLE_MODE`, conditionals, expressions; runtime mode state; TIMING/EASING variables and custom animation styles. |
| Interop & hardening (M8) | `.fig` import of variables/styles/bindings; REST-JSON and DTCG interop; cross-file clipboard; version history of library snapshots; performance at 5,000 variables × N modes. |
| Developer handoff / inspect (M8) | Code syntax display; CSS/token output. |
| Framer-styled design system (UI looks) | Visual design of pills, pickers, table, modal — **looks only**; behavior defined here. |

---

## 8. Needs live Figma verification

Each experiment: **Setup → Action → Record**. Use Figma Design (UI3) on desktop or web, a fresh draft file unless noted, and record screenshots plus exported REST/plugin JSON where possible. Results must be written to `docs/figma/observations/` with date, platform and plan.

| ID | Setup | Action | Record |
| --- | --- | --- | --- |
| V-01 | Empty file, no collections | Open variables modal, *Create variable* → Color | Whether a collection is auto-created; its name; mode name; variable default name/value |
| V-02 | Two collections | Rename one to "" and to the other's name | Rejection/acceptance, messages |
| V-03 | 3 collections | Drag to reorder in sidebar; reopen file | Whether reordering exists and persists; picker order |
| V-04 | Collection with aliases inside and outside | Look for *Duplicate collection* in all menus; if present run it | Command presence; new names; alias targets in the copy |
| V-05 | Collection with Mode 1 (values incl. an alias) + Mode 3 | Click *+* add mode | New mode name; values copied from which mode; alias preserved? |
| V-06 | Collection with Dark mode | *Duplicate mode* | Name, position, values |
| V-07 | Frame explicitly set to Dark; library collection likewise | Delete Dark mode (local); in library delete a used mode, publish, accept in consumer | Frame rendering; mode menu label ("Auto"? blank? warning?) |
| V-08 | 3-mode collection | Drag mode headers; look for *Set as default* | Whether default = first column; command presence; effect on Auto layers |
| V-09 | Collection with group `color` selected in sidebar | *Create variable* | Full name (prefix), insertion position |
| V-10 | 2-mode collection | Create one variable of each type, and three Colors without renaming | Default names and values in every mode |
| V-11 | Collection | Names: duplicate full name; `a$b`, `a.b`, `{a}`, `.5`, `a/ b /c`, `""`, very long (300 chars) | Rejections, toast text, stored names |
| V-12 | One variable per type | Open scoping UI; toggle every option; export via REST/plugin | Label→scope mapping; defaults; collapse to ALL_FILLS; whether CORNER_RADIUS and COLOR_OPACITY are present; fill sub-scopes per node kind |
| V-13 | FLOAT variable | Inspect scoping options for any transform/rotation entry | Existence of a `TRANSFORM`-like scope and the fields it offers |
| V-14 | Auto-layout frame | Bind padding via the H/V pair control and individual sides; check whether a Gap-scoped variable appears in padding pickers | Stored bindings per side; scope used for padding |
| V-15 | Frame with column grid | Open grid popover; apply variable to count/gutter/offset with a variable scoped only to Gap | Which scope(s) make variables appear in grid fields |
| V-16 | Each variable type | Open *Edit variable* | Sections, field order, code-syntax add/remove UI, read-only state for remote variables |
| V-17 | 2 selected variables | Context *Duplicate*; then press ⇧↵ | Names, placement, copied settings; shortcut effect |
| V-18 | Fill bound to variable X; alias Y→X | Delete X; inspect fill, Y's cell, canvas; save/reopen; undo | Pill appearance (strike/warning), resolved value, ability to rebind, persistence |
| V-19 | 3 variables with differing scopes | Multi-select, open Edit variable, change scope | Mixed display; bulk application |
| V-20 | Groups `a`, `b` | Drag rows within/between groups; rename into other group | Resulting names and positions |
| V-21 | Two collections | Try dragging a variable to another collection; look for "Move to collection" | Whether moving is possible; ID preserved? bindings? |
| V-22 | Number and String cells | Enter `8*2`, `1.255`, `-0.5`, `=a+b` | Stored vs displayed values; math support; precision |
| V-23 | Styles `_private/red`, `.tmp`, `ok/_x`; variable named `_hidden` | Open publish dialog | Which assets are excluded |
| V-24 | Published variable used in consumer | Hide it, republish, accept in consumer | Consumer binding state; picker visibility |
| V-25 | Groups `a/x`, `b/x` | Rename `a`→`b`; ungroup to collide; *New group with selection* | Collision handling; default group name |
| V-26 | Group with internal alias (`g/b` → `g/a`) | *Duplicate group* | Copy's group name; whether copied alias points to copy or original |
| V-27 | File with variables | Find every entry point to the variables modal (nothing selected, layer selected, menus) | Entry points; modal non-blocking; position persistence |
| V-28 | Collection with names and hex values | Search by name substring, by group, by hex | What search matches |
| V-29 | Variables modal | Right-click row, multi-row, mode header, group, collection, empty area | Full menu item lists |
| V-30 | Two collections | Create alias in a cell (all entry points); detach alias in a non-default mode | UI flow; detached value = resolved value of that mode? |
| V-31 | Frame with all bindable fields | Hover each field; bind; hover pill; click pill; multi-select with mixed bindings | Affordance presence per field; pill text; Mixed |
| V-32 | Layer | Find how to bind visibility (eye, right-click, Appearance) | Entry point; layers-panel indication |
| V-33 | Bound gap | Type a raw value; also scrub-drag the label | Detach vs blocked |
| V-34 | Frame with bound width and bound radius | Drag resize handle; drag radius handle; use arrow-key nudge resize (⇧⌘→) | Binding detached or kept |
| V-35 | Frame with raw, styled and variable colors (>3 occurrences) | Use selection colors: hover, select matching layers, edit raw color, apply variable | Available actions; scope of selection; undo steps; look for any "find usages" feature for variables/styles |
| V-36 | Hug-width auto-layout frame | Bind width | Sizing mode afterwards |
| V-37 | Auto-layout frame | Set gap to Auto (space between); hover gap | Bindability |
| V-38 | Layer | Bind opacity to FLOAT 50, 150, −10, 0.5 | Rendered opacity; display |
| V-39 | Fill bound to color variable with paint opacity 50 %; composed-color variables | Inspect paint opacity field; change composed opacity; export JSON | How paint opacity and variable alpha combine; composed opacity unit (0–1 vs %); translucent-source rule |
| V-40 | Text layer | Bind content to FLOAT 1.5, 1000, −0.25; then double-click and type | Rendered string; edit behavior |
| V-41 | Text layer | Bind family to "NoSuchFont"; style to "Bogus"; weight 650 | Missing-font UI; fallback; nearest weight? |
| V-42 | Text layer with line height in % and letter spacing in % | Bind FLOAT 120 to each | Unit after binding; rendering |
| V-43 | Component with BOOLEAN, TEXT, VARIANT, INSTANCE_SWAP, SLOT properties | Try binding each on instance and definition | Which types accept variables and of which type |
| V-44 | Page, frame, section, group, component, instance, rectangle | Look for *Apply variable mode* on each; open menu with collections used/unused, single-mode collections, library collections; multi-select | Availability per type; listed collections; "Auto (X)" label; Mixed |
| V-45 | Extended collection | Try rename mode, reorder, add variable, edit description/scope/code syntax, reset single/all overrides; delete a parent mode | Allowed/blocked actions; UI for reset-all; extended mode state after parent deletion |
| V-46 | Root `Theme`, extension `Brand B`; nested frames | Outer frame Brand B/Dark, inner frame Theme/Light (and reverse) | Which values render (precedence rule) |
| V-47 | Main component with inner frame explicitly Dark; instance in Light frame | Observe; set instance to Dark/Light; *Reset all changes* | Propagation and override semantics |
| V-48 | Variables A, B same collection; C other collection | Alias A→B, then B→A; A→A; A→C→A | Cycle prevention UI; same-collection alias allowed |
| V-49 | Rectangle with 2 fills; text; mixed selection | Create style from each section; check undo steps | Dialog fields; captured properties; applied immediately; Mixed handling |
| V-50 | Nothing selected | *+* for each style type | Default contents of new styles |
| V-51 | Layers with applied styles | Inspect sections; open picker (list/grid, search, library order) | Display; hidden fields; picker structure |
| V-52 | Paint style with variable-bound color applied to a layer | *Detach style* | Whether resulting fill keeps the variable binding or raw color |
| V-53 | Text with text style | ⌘B, ⌘I, ⌘U, add link, change size via field and ⌘⇧> | Which keep the style (override) vs detach |
| V-54 | Local styles | Right-click a style in list and in picker | Presence of *Duplicate style* and all items |
| V-55 | Style used by layers | Delete style; save/reopen; undo | Consumer state (reference kept vs detached); UI |
| V-56 | Styles in folders | Drag style into another folder; folder context menu | Possible operations; resulting names |
| V-57 | Paint/text style with variable values | Apply in Light and Dark frames; open picker while selection is in Dark | Consumer-context resolution; preview mode |
| V-58 | Motion enabled file | Create TIMING variable; inspect value units in UI and via plugin | ms vs s; display format |
| V-59 | Collection with existing variables | *Import mode* with matching, type-mismatched and new tokens; undo | Update/create/skip rules; messages; undo steps |
| V-60 | F1 (all types, aliases, descriptions, scopes, code syntax, composed colors) | *Export mode* for each mode | Exact JSON: types for FLOAT/STRING/BOOLEAN, alias syntax, extensions keys, descriptions, file naming |
| V-61 | Library file with changes in each asset type | Open publish dialog | Grouping, checkboxes, description field, hidden-asset handling |
| V-62 | Published library used by consumer | Unpublish | Consumer state and messages |
| V-63 | Consumer using library assets | Disable/remove the library | Assets kept? Missing state? |
| V-64 | Consumer + library with changes on 2 pages | Publish; open consumer; review updates; accept one; toggle "show updates for all pages" | Notification, list contents, partial accept, undo |
| V-65 | Libraries A and B with partially matching names (styles, variables in differently named collections) | *Swap library* A→B | Matching rule (name, type, collection name?), unmatched report, undo |
| V-66 | Consumer whose library was deleted | Open Libraries modal | *Missing libraries* presentation and actions |
| V-67 | Any | Perform each §3.20 operation and undo once | Exactly one step each? |
| V-68 | Bound and styled source layer | ⌘⌥C → ⌘⌥V onto raw layer | Bindings/styles transferred? |
| V-69 | File A with local variables/styles (unpublished and published) and library variables | Copy layers to file B | Resulting references (local copy, remote ref to A, detached) |
| V-70 | Variables modal | Select variables, ⌘C, switch file, ⌘V in modal | Whether variables can be copied between files |
| V-71 | Layers with same raw color, one bound to a variable with that value, one styled | *Select all with same fill* | Which layers are selected |
| V-72 | Any | Search keyboard shortcut list (⌃⇧? / Help → Keyboard shortcuts) for variables, styles, libraries | Exact default shortcuts |
| V-73 | Variables table | Arrow keys, Tab, Enter, Esc, ⌘A, ⌘-click, Delete | Navigation and editing behavior |
| V-74 | Starter vs paid plan files (if available) | Try adding modes beyond cap | Exact caps and error texts (for documentation only; Illigma ungated) |
| V-75 | Prototype with expression using VAR_MODE_LOOKUP | Inspect expression builder | Semantics of VAR_MODE_LOOKUP (M7) |
| V-76 | Library with an extended collection (Enterprise file) | Publish; in a consumer, apply the extension's modes and inspect overrides | Whether extensions publish/consume as collections with overrides |

### Open questions (product decisions, not Figma facts)

- **Q1 — Mode cap.** Figma caps modes per plan (Starter 1; current table Pro 10 / Org 20 / Enterprise "unlimited with extended collections"; historically 40). Illigma has no plans. Proposal: no hard cap below 40; soft performance warning above 40.
- **Q2 — Library container format.** Publish snapshots embedded in the library `.illigma` file vs a sidecar `.illigma-lib` file; both must keep immutable versions.
- **Q3 — Cross-file paste of local variables** if Figma creates remote references to an unpublished source file (V-69): Illigma may need to localize instead, since there is no cloud identity.
- **Q4 — Find-usages features** that exceed Figma's UI (style/variable usage lists) — keep as P2 extensions or drop for strict parity.
- **Q5 — DTCG output for STRING/BOOLEAN** (no DTCG primitive) — follow Figma's exact export once V-60 is recorded.

---

## 9. Sources

### 9.1 Typings (offline, authoritative) — `refs/_figma_plugin-typings/package/plugin-api.d.ts` v1.141.0

| Lines | Content |
| --- | --- |
| 431 | `getStyleByIdAsync` |
| 1459–1483 | `createPaintStyle/TextStyle/EffectStyle/GridStyle/CustomAnimationStyle` (text default Inter Regular 12) |
| 1487–1533 | `getLocal*StylesAsync` |
| 1545–1552 | `getSelectionColors` (null > 1000 colors) |
| 1558–1615 | `moveLocal*StyleAfter`, `moveLocal*FolderAfter` |
| 1627 | `importStyleByKeyAsync` |
| 2148–2299 | `VariablesAPI` (create, extend, alias helpers, bind helpers, import) |
| 2300–2315 | `LibraryVariableCollection`, `LibraryVariable` |
| 2504–2541 | `TeamLibraryAPI` |
| 3699–3740 | Style document-change events |
| 4293–4430 | Drop/inner shadow and blur effects with `boundVariables` |
| 4432–4600 | Noise/Texture/Glass effects (`boundVariables: {}`) |
| 4643–4658 | `ColorStop.boundVariables` |
| 4674–4725 | `SolidPaint.boundVariables` |
| 5000–5060 | Layout grid `boundVariables` |
| 5508–5511 | `TextStyleOverrideType` |
| 5511–5632 | `StyledTextSegment` (`textStyleId`, `boundVariables`, `textStyleOverrides`) |
| 5656–5690 | `VariableDataType`, `ExpressionFunction`, `Expression`, `VariableData`, `ConditionalBlock` |
| 5720–5740 | `SET_VARIABLE`, `SET_VARIABLE_MODE`, `CONDITIONAL` actions |
| 5847–5866 | `MotionEasing` |
| 6262 | `PublishStatus` |
| 6584 | `SceneNodeMixin extends ExplicitVariableModesMixin` |
| 6636–6745 | `boundVariables` (incl. corner-radius remark), `setBoundVariable`, `inferredVariables`, `resolvedVariableModes` |
| 6910–6955 | `VariableBindable*Field` types |
| 7594–7598, 8662–8666, 8754–8758, 9406–9410, 11007–11011 | `effectStyleId`, `strokeStyleId`, `fillStyleId`, `gridStyleId`, `textStyleId` + async setters |
| 9306–9356 | `PublishableMixin` (description, descriptionMarkdown, documentationLinks, remote, key, publish status) |
| 9900–9950 | Text range fill/style/variable APIs |
| 10528–10562 | `ExplicitVariableModesMixin` (workspace/team-default modes note) |
| 10563 | `PageNode` carries explicit modes |
| 11078, 11104–11116, 11176–11185, 11216 | Component property types, definition/instance `boundVariables`, `setProperties` with `VariableAlias` |
| 11664–11710 | `VariableResolvedDataType`, `VariableAlias`, `VariableComposedColor`, `VariableValue`, `VariableScope`, `CodeSyntaxPlatform` |
| 11711–11924 | `Variable` (incl. `resolveForConsumer` examples, `setValueForMode`, `scopes` remark, code syntax, extension helpers) |
| 11925–11993 | `VariableCollection` (mode limit error text, extend, remove) |
| 11994–12028 | `ExtendedVariableCollection` |
| 12465–12503 | `StyleType`, `InheritedStyleField`, `StyleConsumers`, `BaseStyleMixin` |
| 12513–12633 | `PaintStyle`, `TextStyle`, `EffectStyle`, `GridStyle` |
| 12634+ | `CustomAnimationStyle` |

### 9.2 REST types (offline, authoritative) — `refs/_figma_rest-api-spec/package/dist/api_types.ts` v0.44.0

| Lines | Content |
| --- | --- |
| 63–162 | Node `boundVariables` (incl. `size`, `individualStrokeWeights`, `rectangleCornerRadii`), `explicitVariableModes` |
| 550–561 | Node `styles` map |
| 1484, 1574, 1796–1803, 1851–1860, 1910 | Paint/effect/grid `boundVariables` (`numSections`) |
| 2050–2072 | `Style` |
| 2359–2405 | `TypeStyle.isOverrideOverTextStyle`, text `boundVariables` |
| 2474 | Component property `boundVariables.value` |
| 2639–2650 | `VariableAlias` (local or remote) |
| 2919–3015 | `SetVariableAction`, `SetVariableModeAction`, `VariableData`, `Expression`, `ExpressionFunction`, `ConditionalBlock` |
| 3415–3472 | `StyleType`, `PublishedStyle` (`sort_position`) |
| 4512–4583 | `VariableScope` documentation (valid scopes per type, exclusivity, OPACITY vs COLOR_OPACITY, FONT_VARIATIONS) |
| 4590–4598 | `VariableCodeSyntax` |
| 4601–4689 | `LocalVariableCollection` (extension fields) |
| 4691–4761 | `LocalVariable` (`deletedButReferenced`) |
| 4766–4836 | `PublishedVariableCollection`, `PublishedVariable` (`subscribed_id`) |
| 4841–5096 | Collection/mode/variable create/update/delete (extension restrictions) |
| 5101–5143 | `VariableModeValue`, `VariableValue` (type rule for aliases), `VariableComposedColor` |
| 7952–7972 | `PostVariablesRequestBody` |

### 9.3 Official Figma Help Center articles (IDs from the 2026-09-27 source catalog)

Seen as **search excerpts** in this session: 15145852043927 *Create and manage variables and collections*; 36346281624471 *Extend a variable collection*; 15343816063383 *Modes for variables*; 14506821864087 *Overview of variables, collections, and modes*; 360040328273 *Figma plans and features* (mode caps table); 41414048690839 *Adjust an animation's easing* (Motion; listed in results only).

Known by **title only** (catalog): 15339657135383 *Guide to variables in Figma*; 15343107263511 *Apply variables to designs*; 15871097384471 *The difference between variables and styles*; 360038746534 *Create color, text, effect, and layout guide styles*; 360039820134 *Manage and share styles*; 360039238753 *Styles in Figma Design*; 360039957034 *Create and apply text styles*; 360040316193 *Apply styles to layers and objects*; 7938814091287 *Add descriptions to styles, components, and variables*; 360041051154 *Guide to libraries in Figma*; 360039238193 *Hide styles, components, and variables when publishing*; 360025508373 *Publish a library*; 360039236853 *Unpublish a library*; 1500008731201 *Add or remove a library from a design file*; 360039234193 *Review and accept library updates*; 4404856784663 *Swap libraries*; 39592284074263 *Check designs in Figma*; 4412765442967 *Copy and paste properties between layers*; 14506587589399 *Use variables in prototypes*; 15253268379799 *Variable modes in prototypes*; 15253194385943 *Use expressions in prototypes*; 15253220891799 *Multiple actions and conditionals*; 5579502031511 *Use variable fonts*.

### 9.4 Other web sources (search excerpts only; none read in full)

- Figma blog, Schema 2025 design systems recap — https://www.figma.com/blog/schema-2025-design-systems-recap/ (extended collections, native DTCG import/export, slots, Check designs).
- Figma forum: mode limits thread — https://forum.figma.com/suggest-a-feature-11/launched-all-plans-should-offer-more-than-4-variable-modes-13979/
- Figma forum: variable count limits — https://forum.figma.com/ask-the-community-7/what-are-the-limits-for-the-number-of-variables-in-a-file-10909
- Figma forum: special characters in variable names — https://forum.figma.com/t/allow-special-characters-in-variable-names/45692/3 ; dots — https://forum.figma.com/share-your-feedback-26/allow-dots-in-variable-names-48096
- Figma forum: large collection display issue — https://forum.figma.com/report-a-problem-6/variables-panel-doesn-t-show-some-existing-local-variables-large-collection-1000-variables-58145
- Figma forum: plugin-created extended collection empty / "Show updates for all pages" — https://forum.figma.com/report-a-problem-6/plugin-created-extended-collection-is-empty-while-manually-created-one-works-58360
- Figma forum: DTCG composite token export — https://forum.figma.com/suggest-a-feature-11/dtcg-composite-token-export-support-51314 ; native variable export — https://forum.figma.com/ask-the-community-7/native-variable-export-feature-47831
- GitHub figma/plugin-typings issues #375 (composed colors read-only at first; COLOR_OPACITY/TRANSFORM scopes) and #381 (opacity on translucent source) — https://github.com/figma/plugin-typings/issues/375 , https://github.com/figma/plugin-typings/issues/381
- Figma developer docs (via search excerpt): REST variables types — https://developers.figma.com/docs/rest-api/variables-types ; Plugin API update 121 (extended collections) and 133 (EASING/TIMING) — https://developers.figma.com/docs/plugins/updates/2025/11/20/version-1-update-121 , https://developers.figma.com/docs/plugins/updates/2026/08/05/version-1-update-133/
- DTCG 2025.10 stable specification context (via search excerpt) — https://www.designtokens.org/

### 9.5 Web searches performed (2026-10-08)

1. "Create and manage variables and collections" rename/duplicate/group — excerpts of 15145852043927.
2. Mode limits per plan — 360040328273 excerpt + forum.
3. Extended collections — 36346281624471 excerpt, developer docs, forum, Supernova.
4. Native variable JSON / DTCG import-export — plugins and forum.
5. "Import mode" / "Export mode" — 36346281624471 and 15343816063383 excerpts.
6. Schema 2025 announcements — Figma blog, forum.
7. Easing/timing variables — Motion help excerpts, plugin update 133.
8. Color alias with opacity — plugin-typings issues.
9. Variable name character restrictions — forum.
10. Max variables per collection — 15145852043927 excerpt, forum.

Four further searches (apply-variable UI, mode UI, scoping labels, code syntax) were **not executed** because the shared web-search budget was exhausted; the corresponding claims are [KNOW] and listed in §8.

### 9.6 Prior Illigma context (not evidence of Figma behavior)

- `old/docs/figma/observations/2026-09-27-live-figma.md` — [OBS]: fill popover Custom/Libraries tabs; Layout guide section; auto-layout gap "Between" state.
- `old/docs/figma/feature-guide.md` §14 — notes timing/easing variables exist; checks list (stable IDs, alias cycles, mode inheritance, missing assets).
