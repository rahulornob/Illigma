# Components, instances, variants, properties & slots — Figma parity spec

> Status: research draft (date 2026-10-08). Nothing implemented. Every checklist item below is status **Not started**; nothing in this document claims 1:1 parity.
>
> **Evidence legend** (every behavioral claim is tagged):
> - **[API]** — Figma Plugin API typings `@figma/plugin-typings` v1.141.0 (`plugin-api.d.ts`, line refs as `L1234`) or REST API types `@figma/rest-api-spec` v0.44.0 (`api_types.ts`, refs as `REST L1234`). Read directly in this session.
> - **[DOC:<id> excerpt]** — official Figma Help Center article. Article bodies were **not** readable in this session (help.figma.com is DNS-blocked); only search-engine excerpts were seen, so every DOC tag carries "excerpt".
> - **[OBS]** — the 2026-09-27 read-only live-Figma UI observation. It explicitly did **not** cover components, so it is not used as evidence for component behavior in this document.
> - **[KNOW]** — the author's own product knowledge, not verified in this session. Anything [KNOW]-only that affects correctness is repeated in §8.
> - **[SRC:<url>]** — other sources: Figma forum threads, Figma developer changelog (search excerpt), Figma-authored MCP skill documents (`skill://figma/...`, read in full in this session via Figma's own MCP server), third-party guides. `[SRC:search summary → Help Center, article not identified]` marks a search-engine summary that attributes a statement to the Figma Help Center without showing which article. It is weaker than a DOC excerpt.
>
> **Research limits (honesty note).** No live Figma file was inspected for this area. No video was watched. Help Center articles were seen only as search excerpts. The session's shared web-search budget was exhausted part-way through the research, so several sub-topics (exact override list for auto layout properties, nearest-variant selection, restore-component placement, "Simplify instances") rest on [KNOW] and are listed in §8 as experiments.
>
> **Rule reminder.** Figma is the source of truth for behavior and data model; Framer only for the look of the editor. This document describes behavior only.
>
> **Adversarial review (2026-10-08), two passes.**
> - *Pass 1 (interrupted by a session limit).* It re-checked every typings member in this domain, the article catalog and the sibling parity docs. It corrected overstated tags and added CP-203…CP-243. Pass 1 had **no** web-search budget. It re-read the Figma-authored skill docs cited as `skill://figma/...` from Figma's official repository (`raw.githubusercontent.com/figma/mcp-server-guide/main/skills/figma-use/...`). It referenced experiments E-37…E-47 but did not write them, and it wrote no review log.
> - *Pass 2 (interrupted by a usage limit; its claims are corrected here).* Its saved note said it completed the missing experiments, added a further block of items and experiments, and wrote a review log in §10. **None of that content was saved.** The file had no experiments after E-36, no items after CP-243 and no §10. Some in-place corrections of existing items may have been saved; treat them as unreviewed.
> - *Final audit (2026-10-08).* E-37…E-47 are now defined in §8, written from the items that cite them (no new research; each stays [KNOW]-level until run). The audit added CP-244 (§6.25) and re-tagged CP-130 and CP-221 to M6, because both need variables. The review log (§10) still does not exist; review pass RV-07 owns it.

---

## 1. Scope & terminology

### 1.1 Figma terms (use these exact terms in Illigma's UI copy and code)

| Term | Meaning in Figma | Evidence |
| --- | --- | --- |
| **Component** / **main component** | A reusable definition node (`type: 'COMPONENT'`). Formerly called "master component"; "main component" is the current term. Behaves like a frame (`DefaultFrameMixin`) plus publishing, variant and property mixins. | [API L11142-11172] |
| **Instance** | A linked copy of a main component (`type: 'INSTANCE'`). Renders the main's structure; accepts *overrides* and *component property values*; cannot be changed structurally. | [API L11186-11258] [DOC:360039150733 excerpt] |
| **Component set** | Container of variants (`type: 'COMPONENT_SET'`). Only components may be its children. Has no prototyping mixin (extends `BaseFrameMixin`, not `DefaultFrameMixin`). | [API L11117] [DOC:360056440594 excerpt] |
| **Variant** | A `COMPONENT` whose parent is a `COMPONENT_SET`; its layer name encodes property values (`Size=Large, State=Hover`). | [API L9612-9658] [SRC:skill://figma/figma-use/references/component-patterns.md] |
| **Variant property** | A `VARIANT`-type component property with a fixed list of `variantOptions`; values come from variant names. | [API L11104-11115] |
| **Component property** | A named, typed, author-defined knob on a component/set: `BOOLEAN`, `TEXT`, `INSTANCE_SWAP`, `VARIANT`, `SLOT`. | [API L11078] |
| **Property reference** | The link from a sublayer field (`visible`, `characters`, `mainComponent`, slot content) to a property. | [API L6624-6635] |
| **Preferred values** | Curated list of components/component sets offered first for an `INSTANCE_SWAP` or `SLOT` property. | [API L11082-11085] [DOC:5579474826519 excerpt] |
| **Override** | A field on an instance sublayer (or the instance itself) whose value differs from the main because the user changed it in the instance. | [API L11243-11248] |
| **Direct vs inherited override** | Direct = set on *this* instance; inherited = set inside a main component on a nested instance and therefore present in every outer instance. `overrides` lists only direct ones. | [API L11243] |
| **Reset** | Remove overrides (all, per layer, or per property) so values revert to the main. | [DOC:360038665934 excerpt] [API L11250-11257] |
| **Detach** | Convert an instance into a plain frame, keeping the current look but cutting the link. | [DOC:360038665754 excerpt] [API L11221-11225] |
| **Push overrides / push changes to main component** | Apply an instance's overrides to its (local) main component. | [DOC:360038665934 excerpt] |
| **Restore component** | Re-create a deleted main component from one of its instances. | [SRC:codefinity course excerpt] [KNOW] |
| **Swap instance** (action) | Replace an instance's main component with another, preserving overrides heuristically. | [DOC:360039150413 excerpt] [API L11206-11212] |
| **Instance swap property** | A component property whose value is which component a *nested* instance shows. | [API] [DOC:5579474826519 excerpt] |
| **Nested instance** | An instance inside a main component (and therefore inside every instance of it). | [KNOW] [API L11196] |
| **Exposed (nested) instance** | A nested instance flagged so its properties appear at the outer instance's top level. | [API L11234-11241] |
| **Slot** | A frame inside a component (`type: 'SLOT'`) whose children can be freely added/removed/re-ordered in instances. | [API L11259-11283] [DOC:38231200344599 excerpt] |
| **Default variant** | Top-left-most variant of a set; the one inserted when dragging a set from the Assets panel. | [API L11127-11129] |
| **Remote component** | A component that lives in another (library) file; read-only in the consuming file. | [API L9343-9346] |
| **Publish status** | `UNPUBLISHED`, `CURRENT`, `CHANGED`. | [API L6262] |
| **Interactive component** | A component set whose variants have prototype interactions using the `CHANGE_TO` navigation. | [API L5807] [DOC:360061175334 title only] |

### 1.2 In scope (this document)

Create component (single, multiple), main vs instance, instance creation (Alt-drag, duplicate, copy/paste, Assets panel, quick insert), override model, override preservation on swap and variant change, reset (granular and all), detach (incl. nested), go to main component, push overrides, restore deleted main, nested instances, swap, variants/component sets (combine, naming, conflicts, invalid combinations), component properties (BOOLEAN, TEXT, INSTANCE_SWAP with preferred values, VARIANT), exposed instances, slots (current GA feature per typings v1.141.0), descriptions/documentation links, instance inspector UI, instance resizing/constraints/scale, interactive components (cross-ref to prototyping), local-first publishing semantics, auto layout and variables interplay, clipboard/undo/persistence/export behavior of components.

### 1.3 Out of scope (or deferred to other areas)

| Topic | Disposition |
| --- | --- |
| Cloud team libraries, seats/permissions, library analytics, branching | Out of scope for a local-first app; §3.23 defines the local equivalent. |
| "Swap libraries" (article 4404856784663) | M8 / design-systems area. |
| Animated components (article 41307940738967 "Create and use animated components") | Motion/prototyping area (M7). Only the article title was seen in the catalog; not researched here. |
| Dev Mode component playground, Code Connect, annotations/dev resources | Out of scope; data hooks noted (`DevResource.inheritedNodeId` [API L3185]). |
| AI features (e.g., automatic slot suggestions), Figma Make, FigJam, Slides, Buzz | Out of scope. |
| Variables, styles and modes themselves | Variables/design-systems area; only their interplay with components is specified here. |
| Prototype runtime (triggers, transitions) | Prototyping area; only variant-interaction contracts are listed here. |

### 1.4 Terms users confuse (Illigma copy and help must keep these distinct)

- **Variant vs component property.** Variants are separate component nodes that multiply combinatorially; BOOLEAN/TEXT/INSTANCE_SWAP/SLOT properties do not create nodes. [SRC:skill://figma/figma-use/references/working-with-design-systems/wwds-components--creating.md]
- **Instance swap property vs swap instance action vs slot.** Instance swap restricts a container to at most one instance and blocks layout changes to nested layers; slots allow adding/arranging arbitrary content; variants model states/types. [DOC:38741465279895 excerpt]
- **Reset vs detach.** Reset keeps the link and discards changes; detach keeps the changes and discards the link. [DOC:360038665754 excerpt] [DOC:360038665934 excerpt]
- **Deleting a main component vs detaching.** Deleting the main leaves instances linked to a soft-deleted definition that can be restored. [API L6324] [KNOW]
- **Boolean property vs boolean-looking variant property.** A variant property with values `true`/`false` is still a variant (separate nodes) even if the UI renders it as a toggle. [KNOW]
- **Create multiple components vs Combine as variants.** The first makes N independent components; the second wraps components into one component set. [SRC:figma-signup.helpjuice.com mirror excerpt] [API L1835]
- **Component set vs a frame containing components.** Only a `COMPONENT_SET` yields variant properties; a frame of components is just organization. [KNOW]
- **"Master"** is legacy wording for "main component". [KNOW]
- **Component property types are closed.** `ComponentPropertyType` has exactly five members (`BOOLEAN`, `TEXT`, `INSTANCE_SWAP`, `VARIANT`, `SLOT`). `NUMBER`, `IMAGE`, `COLOR`, `POINT`, `GRADIENT` and the other extra types in the typings belong to `ShaderPropertyDefinition` (shaders), not to components. Illigma must not offer number/color/image *component* properties. [API L11078] [API L4941-4955]

---

## 2. Data model

All names below are Figma's (Plugin API v1.141.0 unless marked REST). Illigma's document model must be able to represent every field marked **Document**; **Transient** fields are UI state that must not be written to the file.

### 2.1 Node types

| Type | Mixins / key fields | Notes | Evidence |
| --- | --- | --- | --- |
| `COMPONENT` (`ComponentNode`) | `DefaultFrameMixin` (all frame props incl. auto layout, reactions), `PublishableMixin`, `VariantMixin`, `ComponentPropertiesMixin`; methods `createInstance()`, `createSlot()`, `getInstancesAsync()`, `clone()` (new component, no instances) | `componentPropertyDefinitions` is readable only on a non-variant component; on a variant it throws ("Can only get/set component property definitions of a component set or non-variant component"). | [API L11142-11172] [SRC:skill://figma/figma-use/references/gotchas.md] |
| `COMPONENT_SET` (`ComponentSetNode`) | `BaseFrameMixin` (no prototyping/reactions), `PublishableMixin`, `ComponentPropertiesMixin`; `defaultVariant` (read-only), deprecated `variantGroupProperties`; `clone()` duplicates children as **new** components with no instances | Cannot be empty ("empty component sets are not supported in Figma"). | [API L11117-11137] [API L1849] |
| `INSTANCE` (`InstanceNode`) | `DefaultFrameMixin`, `VariantMixin`; `mainComponent` / `getMainComponentAsync()`, `swapComponent()`, `setProperties()`, `componentProperties`, `detachInstance()`, `scaleFactor`, `exposedInstances`, `isExposedInstance`, `overrides`, `removeOverrides()` (`resetOverrides()` deprecated) | No `PublishableMixin` ⇒ instances have no description of their own. | [API L11186-11258] |
| `SLOT` (`SlotNode`) | `DefaultFrameMixin`; `resetSlot()`, `limitViolations` (read-only); `clone()` returns a plain `FrameNode` | `layoutMode = 'GRID'` throws `cannotApplyGridToSlot`. | [API L11259-11283] [API L7648] |
| REST `INSTANCE` | `componentId`, `isExposedInstance?`, `exposedInstances?` (IDs), `componentProperties?`, `overrides: Overrides[]` (`overriddenFields: string[]`, untyped) | REST v0.44.0 `ComponentPropertyType` lacks `'SLOT'` (plugin typings have it). REST v0.44.0 also has **no `SLOT` node type at all**, so it is unknown how slots appear in REST JSON (FRAME? omitted?). See CP-239. | [REST L1110-1142] [REST L2410] [REST L2480] |

- **An instance always points to a `COMPONENT`, never to a `COMPONENT_SET`.** For sets, `mainComponent` is one variant. `mainComponent: ComponentNode | null` and `swapComponent(componentNode: ComponentNode)` only accept components. [API L11196-11212]

### 2.2 Component property definitions (on non-variant `COMPONENT` or `COMPONENT_SET`) — Document

```
ComponentPropertyDefinitions = {
  [propertyName: string]: {               // e.g. "Label#4:0" (non-VARIANT) or "Size" (VARIANT)
    type: 'BOOLEAN' | 'TEXT' | 'INSTANCE_SWAP' | 'VARIANT' | 'SLOT'
    defaultValue: string | boolean          // BOOLEAN→boolean, TEXT→string, INSTANCE_SWAP→component id;
                                            // VARIANT/SLOT: not editable via editComponentProperty
    preferredValues?: { type: 'COMPONENT' | 'COMPONENT_SET', key: string }[]   // INSTANCE_SWAP, SLOT
    variantOptions?: string[]               // VARIANT only
    description?: string                    // SLOT only
    slotSettings?: SlotSettings             // SLOT only
    readonly boundVariables?: { defaultValue?: VariableAlias }
  }
}
```
[API L11078-11115] [API L6955]

- **Name suffix.** `BOOLEAN`, `TEXT`, `INSTANCE_SWAP` names carry a unique `#<id>` suffix; `VARIANT` names are plain. The suffix lets several properties share a display name. [API L9661] SLOT names are also suffixed in practice (example `"Content#7:1"`). [SRC:skill://figma/figma-use/references/component-patterns.md]
- **Operations.** `addComponentProperty(name, type, defaultValue, options?)` returns the suffixed name. Its `defaultValue` may be a `VariableAlias`, so a definition can be variable-bound when it is created. `editComponentProperty` supports `name` (all types), `defaultValue` (BOOLEAN/TEXT/INSTANCE_SWAP only), `preferredValues` (INSTANCE_SWAP/SLOT), `description` and `slotSettings` (SLOT); `deleteComponentProperty` supports BOOLEAN/TEXT/INSTANCE_SWAP/SLOT, **not** VARIANT. [API L9671-9706]

### 2.3 Slot settings — Document

| Field | Type / default | Meaning | Evidence |
| --- | --- | --- | --- |
| `minChildren` | `number \| null` (unset = no minimum) | Minimum direct children; violation → `BELOW_MIN`. | [API L11086-11092] |
| `maxChildren` | `number \| null` (unset = no maximum; "no limit to the number of layers" by default) | Maximum direct children; violation → `ABOVE_MAX`. | [API] [DOC:38231200344599 excerpt] |
| `allowPreferredValuesOnly` | `boolean` | Restrict content to `preferredValues`; violation → `HAS_NON_PREFERRED`. | [API L11275-11280] |
| `displayEmptyByDefault` | `boolean` | Whether the slot highlight is always shown on empty instances ("Display empty slots by default"). | [SRC:https://developers.figma.com/docs/plugins/updates/2026/06/10/update/ excerpt] [DOC:38231200344599 excerpt] |
| `stretchChildOnInsert` | `boolean` | On insert, apply counter-axis **Fill** to the inserted layer ("Set items to fill container by default"). | same |

`limitViolations: Array<'BELOW_MIN' | 'ABOVE_MAX' | 'HAS_NON_PREFERRED'>` is **derived** (compute, don't store). `BELOW_MIN`/`ABOVE_MAX` are mutually exclusive; `HAS_NON_PREFERRED` is independent. Violations never block edits. [API L11275-11280] [SRC:developers.figma.com 2026-06-10 changelog excerpt]

### 2.4 Instance-side values — Document

```
InstanceNode.componentProperties = {
  [propertyName]: { type, value: string | boolean,
                    preferredValues?, readonly boundVariables?: { value?: VariableAlias } }
}
InstanceNode.overrides = { id: string /* sublayer id */, overriddenFields: NodeChangeProperty[] }[]   // direct only
InstanceNode.mainComponent  // ComponentNode (may be remote or soft-deleted, i.e. parent === null)
InstanceNode.scaleFactor    // 1 unless scaled with the Scale tool (K)
InstanceNode.isExposedInstance / exposedInstances
```
[API L11176-11258] [API L6324] [API L6954]

- `setProperties({...})` takes VARIANT names plain and other names suffixed; values may be `VariableAlias`; unspecified properties keep their values; on a name collision the VARIANT property wins; SLOT properties throw `cannotSetSlotProperty`. [API L11213-11216]
- `NodeChangeProperty` (the vocabulary for `overriddenFields`) includes, among others: `name`, `visible`, `locked`, `opacity`, `blendMode`, `fills`, `strokes`, `strokeWeight`, `strokeAlign`, `strokeCap`, `strokeJoin`, `dashPattern`, `effects`, `cornerRadius` (and per-corner), `characters`, `fontName`, `fontSize`, `lineHeight`, `letterSpacing`, `textCase`, `textDecoration`, `textAutoResize`, `exportSettings`, `layoutGrids`, `fillStyleId`/`strokeStyleId`/`textStyleId`/`effectStyleId`/`gridStyleId`, `layoutMode`, `itemSpacing`, padding fields, `primaryAxisAlignItems`, `counterAxisAlignItems`, `layoutGrow`, `layoutAlign`, `reactions`, `componentProperties`, `width`, `height`, `x`, `y`, `relativeTransform`. **Presence in this union does not prove the field is overridable on an instance sublayer** — it is the generic change vocabulary. [API L3751-3884]
- *Review addendum.* The union also contains the following fields, which are candidates for the E-07 matrix:
  - Text: `textAlignHorizontal`, `textAlignVertical`, `paragraphSpacing`, `paragraphIndent`, `listSpacing`, `textTruncation`, `maxLines`, `leadingTrim`, `hyperlink`, `openTypeFeatures`, `styledTextSegments`.
  - Layout: `layoutWrap`, `counterAxisSpacing`, `counterAxisAlignContent`, `layoutPositioning`, `itemReverseZIndex`, `gridAutoTracks`, `gridItemsPositioning`, `minWidth`/`maxWidth`/`minHeight`/`maxHeight`.
  - Shape and paint: `clipsContent`, `isMask`, `maskType`, `booleanOperation`, `vectorNetwork`, `cornerSmoothing`, `constrainProportions`.
  - Motion: `animations`, `animationStyles`.

  The union does **not** contain `mainComponent`, `isExposedInstance`, `scaleFactor`, `layoutSizingHorizontal` or `layoutSizingVertical`. So the field name that reports a nested instance swap in `overriddenFields` is unknown, and Illigma must not assume it is `'mainComponent'` (CP-060). [API L3751-3884]

### 2.5 Property references on sublayers — Document

```
SceneNode.componentPropertyReferences: { visible?: string, characters?: string, mainComponent?: string } | null
```
- Only component sublayers and instance sublayers may have references; otherwise `null`. [API L6624-6635]
- Field → property type: `visible` ↔ BOOLEAN (any sublayer), `characters` ↔ TEXT (text node), `mainComponent` ↔ INSTANCE_SWAP (instance node). [SRC:skill://figma/figma-use/references/component-patterns.md]
- SLOT binding uses key `slotContentId` in practice (`slotFrame.componentPropertyReferences = { slotContentId: key }`) even though the typings' key union lists only the three keys above — **discrepancy to verify**. Setting may throw `cannotApplySlotPropertyToNonFrameNode`, `cannotApplySlotPropertyToFrameWithGrid`, `cannotApplySlotPropertyToFrame`. [API L6626] [SRC:skill://figma/figma-use/references/component-patterns.md]
- The same skill's code comment says the bound frame "must be a direct child (not nested inside another slot)". It is ambiguous whether slot frames must be **direct children of the component** or may sit at any depth. Verify in CP-236 / E-44. [SRC:skill component-patterns.md, re-read 2026-10-08]

### 2.6 Publishing / documentation metadata — Document

| Field | On | Notes | Evidence |
| --- | --- | --- | --- |
| `description` (plain) / `descriptionMarkdown` (rich) | COMPONENT, COMPONENT_SET (and styles) | Not on instances/frames. | [API L9306-9324] [SRC:skill://figma/figma-use/references/working-with-design-systems/wwds-components.md] |
| `documentationLinks: { uri }[]` | same | API "currently only supports setting a single documentation link"; `[]` clears. | [API L9325-9342] |
| `remote` (read-only) | same | Remote components are read-only; writes throw. | [API L9343-9346] |
| `key` (read-only) | same | Stable identity used to import a published component; present on local and published ones. | [API L9347-9350] |
| `getPublishStatusAsync()` | same | `'UNPUBLISHED' \| 'CURRENT' \| 'CHANGED'`. | [API L6262] [API L9351-9355] |
| REST file metadata `components{}` / `componentSets{}` | file | `key`, `name`, `description`, `componentSetId?`, `documentationLinks`, `remote`. | [REST L2564-2626] [REST L5690] |

### 2.7 Detach provenance — Document

`FrameNode.detachedInfo: { type: 'local', componentId } | { type: 'library', componentKey } | null` — null for components and instances. [API L8636-8645] [API L9393-9396]

### 2.8 Identity rules (Illigma must define; Figma behavior noted)

- Instance sublayer IDs in Figma are composite paths (`I<instanceId>;<mainSublayerId>`, nested: `I<outer>;<nestedInst>;<sub>`). Overrides are keyed by these IDs, so overrides survive renames of sublayers in the main. [KNOW] (verify — §8 E-01)
- Property identity = suffixed name (`Label#4:0`); renaming the display name keeps the id suffix so instance values survive. [API L9661] [KNOW]
- Variant identity = the component node; property values are derived from the variant's layer name. [SRC:skill component-patterns.md] [KNOW]
- A deleted main component is **soft-deleted**: it stays in the document (parentless) while instances reference it. [API L6324]

### 2.9 Proposed Illigma persistence (Document) vs Transient state

| Document (persist, undoable) | Transient (never persisted) |
| --- | --- |
| Component/set/instance/slot nodes; `componentId` (+ library key/version for remote); `componentPropertyDefinitions` incl. order; `componentProperties` values; `componentPropertyReferences`; direct overrides map `{sublayerPath → {field → value}}`; `isExposedInstance`; `slotSettings`; slot content children of instances; `scaleFactor`; `description`, `descriptionMarkdown`, `documentationLinks`; `detachedInfo`; soft-deleted main definitions still referenced; cached copies of remote component definitions + version; hide-from-publishing flag; variant layer names | "Return to instance" target; swap-menu search text and scroll; expanded/collapsed property groups; hover previews; slot highlight on hover; assets panel view mode (list/grid) and search; conflicting-variant warning (derived); `limitViolations` (derived); publish status (derived by diff against last published snapshot) |

---

## 3. Behavior specification

### 3.1 Creating components

1. **Command.** "Create component" (⌥⌘K / Ctrl+Alt+K). [SRC:third-party shortcut lists, e.g. https://www.skillademia.com/shortcuts/figma-shortcuts/] [KNOW] Also exposed in the toolbar/context menu; the toolbar control has an adjacent dropdown for "Create multiple components". [SRC:https://forum.figma.com/archive-21/how-can-i-drag-over-a-bunch-of-frames-and-convert-them-into-multiple-components-as-opposed-to-just-one-big-component-14306]
2. **From a single frame:** the frame itself becomes a component, "preserving all of its properties and children" (auto layout, fills, clip, effects, position, z-order, name). [API L1108-1120] [KNOW]
3. **From a single non-frame layer** (shape, text, vector, boolean, instance, group): Illigma must reproduce Figma's result exactly — hypothesis: a new component frame is created at the layer's bounds, the layer becomes its only child, and the component takes the layer's name; for a group, verify whether the group is kept as a child or dissolved. [KNOW] (§8 E-02)
4. **From a multi-selection:** "Create component" makes **one** component wrapping all selected layers (relative positions and z-order preserved); "Create multiple components" makes one component per selected top-level layer ("frame, group, boolean operation, or path"). [SRC:figma-signup.helpjuice.com/components/create-components-to-reuse-in-designs (mirror of help text) excerpt] [KNOW]
5. **Restrictions:** the source cannot be a component or component set and cannot be inside a component, component set or instance; otherwise the command is unavailable (API throws "Cannot create component from node"). Consequence: main components never nest inside other main components. [API L1112-1118]
6. **Undo:** creating a component is one undo step; undo restores the original layer(s). [SRC:https://forum.figma.com/t/how-can-i-un-component-a-component/4356/8 excerpt] [KNOW]
7. **No "un-componentize":** Figma has no direct command to turn a main component back into a frame; the documented workaround is create instance → detach → delete main. [SRC:forum, 2024 community-support reply excerpt] (verify in UI3, §8 E-03)
8. **Script/API creation:** `createComponent()` creates an empty 100×100 component on the current page. [API L1090-1102]
9. **Sources that contain components or instances** *(review addendum)*. The typings restrict only the *node itself*: it may not be a component or set, and may not be inside a component, set or instance. What happens when the source frame **contains** a main component (refused? nested main converted to an instance?) is unverified. If the source contains instances, they become nested instances, and their overrides become *inherited* overrides for instances of the new component. [API L1112] [KNOW] (CP-203, CP-204, §8 E-47)
10. **"Create component set" straight from plain layers** is claimed by third-party shortcut lists (⌥⇧⌘K) but is not confirmed in any source seen here. Treat it as unverified (CP-206, §8 E-36). [SRC:third-party] [KNOW]

### 3.2 Main components and propagation

1. Every instance is linked to its main; changes to the main apply to all linked instances. In the same file updates are immediate; published components update consumers only after publish. Main components can be edited only in the file where they live. [DOC:360038665934 excerpt]
2. Propagation granularity is **per sublayer per field**: an instance's direct override on field *f* of sublayer *s* blocks propagation of *f* on *s* only. Other fields keep updating. [KNOW] [SRC:https://forum.figma.com/suggest-a-feature-11/push-reset-overrides-of-instances-from-the-main-component-13480 excerpt: "If that aspect is already somehow defined in the instance, the instance wouldn't change"]
3. Structural edits in the main (add/remove/reorder/reparent sublayers) always propagate; overrides that belonged to a removed sublayer are dropped (and restored by undo). [KNOW]
4. The main's own placement (x, y, rotation, parent, constraints in its parent) never propagates; instances keep their own placement. [KNOW]
5. Plugin `documentchange` is not fired for instance sublayers updated because a main changed — i.e. propagation is a derived update, not a user edit. Illigma should likewise treat propagation as derived (not a separate undo entry). [API L594]

**Propagation algorithm (pseudo-code):**
```
onMainChanged(main, change):
  for inst in instancesTransitively(main):        // includes instances nested in other mains
     if change.kind in {ADD_CHILD, REMOVE_CHILD, REORDER, REPARENT}:
         rebuildResolvedTree(inst)                // drop overrides of removed sublayers
     else:  // field change (s, f, newValue)
         path = mapSublayer(inst, change.sublayer)
         if inst.directOverrides.has(path, change.field): continue
         if inheritedOverride(inst, path, change.field) exists: continue   // set inside an outer main
         applyResolved(inst, path, change.field, newValue)
```

### 3.3 Creating and inserting instances

| Method | Rule | Evidence |
| --- | --- | --- |
| ⌥/Alt-drag a main component | Creates an instance. Release the mouse **before** the modifier; releasing the modifier first moves the original component instead. | [DOC:360039150173 excerpt] |
| Duplicate (⌘D/Ctrl+D) a main component | In the same file, creates an instance. | [DOC:360039150173 excerpt] |
| Copy/paste a main component | In the same file, creates an instance. | [DOC:360039150173 excerpt] |
| Copy/paste/duplicate an instance | New instance of the same main, keeping the source instance's overrides and property values. | [API L11194] [KNOW] |
| Drag from Assets panel | Creates an instance at the drop point; a component set inserts its default (top-left-most) variant. | [DOC:360039150173 excerpt] [API L11127-11129] |
| Component details modal / Actions menu "Assets" tab | Alternative insertion routes. | [DOC:360039150173 excerpt] |
| Quick insert ⇧I | Opens the Actions menu to find and insert components (search bar). | [DOC:360039150173 excerpt] |
| Duplicate a frame that contains a main component | The copy contains an **instance** of the original main (no second main). | [API L10764] (plugin `clone()`; UI behavior to verify, §8 E-04) |

- Instance layer name defaults to the main component's name (component-set name for variants). [KNOW] (§8 E-05)
- An instance cannot be placed inside its own main component (cycle). Illigma must block any insert/swap/drop that would create a cycle A→…→A. [KNOW] (§8 E-06)

### 3.4 Override model

**Overridable** (document as *Figma currently allows*; items marked † must be verified, §8 E-07):

| Group | Fields |
| --- | --- |
| Text | characters; font family/style/weight; font size; line height; letter spacing; text case; decoration; text resizing (auto width/height/fixed) | 
| Paint | fills, strokes (paint), stroke weight/align/cap/join/dash†, applied fill/stroke styles, variable bindings on paints† |
| Effects | effects, effect style; opacity†; blend mode† |
| Visibility | `visible` (eye) |
| Naming | layer name |
| Nested instances | swap (`mainComponent`), their component property values, their own overrides |
| Export | export settings |
| Layout guides | layout grids / guides |
| Auto layout† | gap, padding, alignment, min/max, child sizing (hug/fill/fixed): believed overridable. **Review correction:** the earlier draft also listed direction and wrap here. The auto-layout spec (03, AL-224/AL-226) holds that changing the flow/direction, removing auto layout, toggling the layout version and reordering children are **blocked** on instances. Both claims rest on [KNOW] except the reorder rule. Until E-07 is run, treat direction/flow and auto-layout removal as **not overridable** (CP-217). |
| Corner radius† | per-node radius |
| Prototype† | interactions (`reactions`) on instance/sublayers |
| Variables† | explicit variable modes on instance/sublayers |

Source for the core list: "text settings (font, weight, size, line height, letter spacing, resizing), fills and strokes, shadow and blur effects, layout guides, nested instances such as icons, export settings, and layer names". [DOC:360039150733 excerpt]

**Not overridable:** order/z-index of sublayers; position of sublayers (including items in an auto layout frame); constraints on sublayers; bounds of text layers; adding/deleting/reparenting sublayers (except inside slots). For those, detach or edit the main. [DOC:360039150733 excerpt] [API L1861 (children of instances cannot be reparented)]

**Resolution precedence** (outermost wins):
```
resolvedValue(inst, sublayerPath, field):
  1. direct override on (sublayerPath, field) in inst                 → use it
  2. component property value of inst if field is property-bound       → use it
  3. inherited override: set on a nested instance inside inst's main   → use it (recursively)
  4. value in the nested main component definition                     → default
```
[API L11243 (direct vs inherited)] [KNOW for ordering of 1 vs 2 — §8 E-08]

- Editing text bound to a TEXT property on the canvas updates the **property value**, not a separate characters override; direct `characters` writes on property-managed text "may be overridden by the component property system". [SRC:skill://figma/figma-use/references/component-patterns.md] [KNOW]
- `overrides` lists only direct overrides and only the changed fields. [API L11243-11248]
- Whether setting a field back to exactly the main's value clears the override or keeps it as an override is unverified. [KNOW] (§8 E-09)
- **Override granularity is a whole field** *(review addendum, hypothesis)*. List-valued fields (`fills`, `strokes`, `effects`, `layoutGrids`, `exportSettings`) are believed to be overridden as one value. If an instance changes one paint of a two-paint fill, the entire `fills` list is overridden, and later main edits to the *other* paint no longer reach that instance. This matches the field-level `overriddenFields` vocabulary but is not stated anywhere seen. [API L3751 (field-level vocabulary)] [KNOW] (CP-208, §8 E-40)
- **Top-level fields of the main.** Not every root-level field of a main reaches its instances. Placement does not propagate (§3.2.4). It is unverified whether hiding (`visible`) or locking (`locked`) the main itself propagates (CP-207, §8 E-39). [KNOW]

### 3.5 Reset overrides

- From "More actions" next to the component name in the right panel: **Reset → Reset [property]** resets one property; **Reset → Reset all changes** resets all properties *for that layer*. [DOC:360038665934 excerpt]
- Reset on the top-level instance with "Reset all changes" clears all direct overrides of the whole instance (all sublayers, nested swaps, property values). [KNOW] [API L11250-11257 `removeOverrides`: "Removes all direct overrides on this instance"] (§8 E-10)
- Reset on a selected nested layer affects only that layer's overrides. [DOC:360038665934 excerpt]
- Inherited overrides (set in an outer main) cannot be reset from the instance; they are the instance's baseline. [API L11243] [KNOW]
- Reset is a single undo step and works on multi-selection (each instance reset). [KNOW]
- Whether a top-level **size** override is cleared by "Reset all changes" and whether a separate "Reset size" exists is unverified; one forum post says reset size does not restore variables. [SRC:forum excerpt] (§8 E-11)

### 3.6 Instance swap (action)

1. The instance menu (dropdown on the instance name in the right panel) lists swappable components. "Related components" — same file, page and frame, and slash-name siblings (`UI/Button/Hover`) — are grouped. [DOC:360039150413 excerpt]
2. Swapping keeps the instance's placement in its parent (position, constraints, auto layout child settings). [KNOW]
3. **Override preservation:** "Figma will try to preserve any overrides when you select a different variant, or swap between instances in the Instance menu." The layer names of the current and new instance must match; for text, criteria are looser — a text override is kept when the text layer's name matches and its hierarchy is similar. [SRC:forum 14757, quoting DOC:360039150413] *(Review: this tag was downgraded from "DOC excerpt". The wording was seen only as a community quotation of the article, not as an excerpt of the article itself.)* Community reports: naming matters more than structure; nested-instance swaps inside components sometimes lose text overrides. [SRC:https://forum.figma.com/ask-the-community-7/is-layer-hierarchy-still-taken-into-account-when-preserving-overrides-14757] [SRC:https://forum.figma.com/suggest-a-feature-11/preserve-overrides-in-instances-swapped-inside-component-11459]
4. **API distinction:** `swapComponent(c)` preserves overrides with the UI heuristics; assigning `mainComponent = c` sets the main directly and **clears all overrides** (on nested instances it performs nested instance swapping). [API L11195-11212]
5. **Drag-swap from Assets:** hold ⌥ (Mac) / Alt (Win) while dropping a component onto an instance to replace it; release the mouse first, otherwise it is only added. In this path the help text says "Figma only preserves text overrides". [DOC:360039150173 excerpt] Adding ⌘/Ctrl targets a nested instance. [SRC:https://uxdesign.cc/10-components-tips-in-figma-12b80389574 excerpt]
6. Swapping a nested instance inside an instance is itself an override (`mainComponent` on that sublayer); reset reverts it. [API L11196] [KNOW]
7. Size after swap: hypothesis — the instance adopts the new main's size unless its size was overridden (auto layout hug/fill rules apply). (§8 E-12)
8. *(Review addendum)* **Name after swap.** Hypothesis: an instance that was never renamed takes the new main's name (the set name for variants); a renamed instance keeps its name. [KNOW] (CP-214, §8 E-05)
9. *(Review addendum)* **Variant values across sets.** When swapping between two component sets that share VARIANT property names/values (e.g. `Size=Large` in both), the hypothesis is that Figma picks the target variant that matches those values rather than the target's default variant. [KNOW] (CP-219, §8 E-12)
10. *(Review addendum)* The rule in the pseudo-code below — a non-text override survives a *variant* switch only if the overridden field had the same value in both variants — is **[KNOW] only**. No source excerpt in this document states it.

**Swap override-preservation algorithm (Illigma contract; heuristics per DOC, details to verify):**
```
swapPreserving(inst, newMain, mode /* 'INSTANCE_MENU' | 'VARIANT' | 'ASSET_DRAG' */):
  old = collectOverrides(inst)     // [(namePath, layerType, field, value, oldBaseValue)]
  oldPropValues = inst.componentProperties
  inst.mainComponent = newMain; clearOverrides(inst)
  for o in old:
     if mode == 'ASSET_DRAG' and o.field != 'characters': continue      // help: only text kept
     t = findByExactNamePath(newMain, o.namePath)
     if t == null and o.field in TEXT_FIELDS:
         t = findTextByLeafName(newMain, last(o.namePath), similarHierarchy=true)
     if t == null or !fieldApplies(t, o.field): continue
     if mode == 'VARIANT' and o.field not in TEXT_FIELDS:
         if baseValue(t, o.field) != o.oldBaseValue: continue           // only if originally equal
     setOverride(inst, t, o.field, o.value)
  for (name, v) in oldPropValues:                                       // see §3.11 for variant case
     if newMain has property with same identity/name and type: set value
```

### 3.7 Detach instance

1. ⌥⌘B (Mac) / Ctrl+Alt+B (Win); or instance menu → Detach instance; or right-click on canvas or in the Layers panel. [DOC:360038665754 excerpt]
2. Result: a regular **frame** that keeps the current layers and properties; the link is removed and later main edits no longer apply. [DOC:360038665754 excerpt] [API L11221-11225 returns `FrameNode`]
3. The detached frame bakes in the resolved state (overrides, property values, slot content). Text that was bound to a TEXT property becomes plain text. [KNOW]
4. Nested instances inside a detached instance remain instances (only the selected level is detached). [KNOW] (§8 E-13)
5. Detaching a **nested** instance also detaches all ancestor instances. [API L11221-11224] Ancestor nodes get **new IDs** when implicitly detached. [SRC:skill://figma/figma-use/references/gotchas.md]
6. The resulting frame records `detachedInfo` (`local` + componentId or `library` + componentKey). [API L8636-8645, L9393-9396]
7. Detach works only on instances, not on main components. [SRC:forum 2024 community-support reply excerpt]
8. Single undo step; multi-selection detaches each selected instance. [KNOW]

### 3.8 Go to main component, push overrides, restore deleted main

- **Go to main component:** navigates (switching page if needed) to the main and selects it; for library instances it opens the library file at the main's location (requires access). After editing, Figma offers **Return to instance**. [DOC:360038665934 excerpt] UI3 entry points: Design-tab hover on the library/component name, right-click menu. [DOC excerpt] [SRC:https://forum.figma.com/report-a-problem-6/go-to-main-component-link-missing-when-i-right-click-on-components-instances-55974] Native shortcut: unconfirmed (§5).
- **Push overrides / changes to main component:** pushes the instance's changes back to the main, updating other instances. Only possible when the main is in the same file (not for libraries). [DOC:360038665934 excerpt] Other instances that already override the same field keep their override. [SRC:forum push/reset thread excerpt] The pushing instance ends with no overrides (its values now equal the main). [KNOW] One undo step reverts main + instance. [KNOW]
- **Deleted main:** instances keep rendering the soft-deleted definition (`mainComponent` may have no parent). [API L6324] An instance of a deleted main offers **Restore component** in the Design panel. [SRC:codefinity course excerpt] Restoring re-creates the main and re-links all instances; hypothesis: it is restored at its original page/parent/position with its original ID. [KNOW] (§8 E-14) Orphans with no recoverable definition may lack the option. [SRC:https://forum.figma.com/ask-the-community-7/main-component-missing-no-option-to-restore-or-go-to-23676 excerpt]

### 3.9 Nested instances and exposed instances

1. A main component may contain instances of other components; those nested instances keep their own links, so editing the inner main updates the outer main and all outer instances. [KNOW]
2. Overrides set on a nested instance inside the outer main are **inherited overrides** in every outer instance. [API L11243]
3. In an outer instance, the user can select a nested instance (deep select) and change its properties, swap it, or override its sublayers; these are direct overrides of the outer instance. [KNOW]
4. **Expose nested instances:** in the outer main/set, the author picks nested instances to expose; in outer instances their component properties appear at the top level of the instance's property panel, grouped under the nested instance's name. [API L11234-11237] [SRC:https://uxplanet.org/figma-component-properties-update-beta-explained-in-3-min-fd743c6846ae excerpt]
5. `isExposedInstance` is writable only on *primary* instances directly contained in a COMPONENT/COMPONENT_SET; it is inherited by nested instances. [API L11238-11241]
6. Exposure may be lost when the exposed nested instance is swapped (community report). [SRC:https://forum.figma.com/t/expose-nested-instances-lost-if-you-swap-the-nested-instance/54180] (§8 E-15)
7. "Simplify instances" (a main-component option that reduces what instance users see) exists in Figma but is **not in the typings**; exact effect unverified. [SRC:https://forum.figma.com/t/enhancing-the-simplify-instance-function-with-more-granular-controls/86885 title] [KNOW] (§8 E-16)

### 3.10 Variants and component sets

**Combine as variants.** Select components → "Combine as variants" creates a `COMPONENT_SET` containing them (equivalent of `combineAsVariants(nodes, parent, index?)`: non-empty, components only, subject to reparenting restrictions). [API L1833-1857]

**Name parsing on combine** [DOC:360056440594 excerpt] [SRC:https://stevekinney.com/courses/figma/variants excerpt] [SRC:skill component-patterns.md]:
```
parseVariantName(name):
  if name matches /^\s*[^=,]+=[^=,]*(\s*,\s*[^=,]+=[^=,]*)*\s*$/:     // "Size=Large, State=Hover"
      return { props: pairs }                                     // property names taken verbatim
  segs = name.split('/')
  setName = segs[0]; values = segs[1..]
  return { setName, props: { "Property 1": values[0], "Property 2": values[1], ... } }
// Every component must have the same number of slashes so values line up;
// generic property names ("Property 1", ...) are then renamed by the user.
```
- Hypothesis for unparsable/flat names: a single "Property 1" with values "Default", "Variant2", "Variant3"… (§8 E-17). [KNOW]
- **Set contents:** only components; no text, annotations, nested frames, or sub-groups of variants inside a set. [DOC:360056440594 excerpt]
- **Uniqueness:** all variants share the same properties; each must be a unique combination. Identical combinations raise a conflict on the affected variants ("The properties and values of this variant are conflicting. Change the applied values on this variant to resolve this."), even if they look different; fix by changing values. A full matrix is not required. [DOC:360056440594 excerpt] [SRC:https://forum.figma.com/report-a-problem-6/properties-and-values-of-this-variant-are-conflicting-but-they-are-not-51633]
- **Default variant:** the top-left-most variant spatially; it is what dragging the set from Assets inserts. [API L11127-11129] Tie-break (y-first vs x-first) unverified (§8 E-18).
- **Add variant:** "+" control on the set (and an "Add variant" action) adds a new variant by duplicating an existing one, placed next to it, with values made unique. [KNOW] (§8 E-19)
- **Rename property / value:** renaming in the set's property panel rewrites every variant's layer name; instances keep their selection. Editing a variant's layer name to `A=x, B=y` changes its values. [KNOW] (§8 E-20)
- **Add / delete variant property:** adding a property gives all variants a value; deleting one may produce duplicate combinations → conflicts. [KNOW]
- **Empty set:** impossible; removing the last variant removes the set (hypothesis). [API L1849] [KNOW]
- **Set is a frame:** fill, stroke, radius, layout (incl. auto layout) apply to the set; variants can be arranged freely or by auto layout. Script-combined sets stack variants at (0,0) and must be laid out. [API L11117] [SRC:skill component-patterns.md]
- **Clone of a set** duplicates all variants as new components with no instances. [API L11121-11125]
- **Properties on variants:** non-variant properties are defined on the set; reading/writing definitions on a variant throws. [SRC:skill gotchas.md]
- *(Review addendum)* **Existing properties are merged on combine.** Figma's own skill says: "After combining, the component set inherits all properties from its children." So BOOLEAN/TEXT/INSTANCE_SWAP properties defined on standalone components move to set level when combined. Unverified: how same-named properties from different components merge (one property or several), and whether property references are preserved. [SRC:skill component-patterns.md, re-read 2026-10-08] [KNOW] (CP-222, §8 E-41)
- *(Review addendum)* **Sparse matrices: sources disagree.** The help excerpt says a full matrix is not required. Figma's skill says "Every unique combination must exist as a child component — missing ones show as blank gaps in the variant picker." The two can both be true (sparse sets are allowed, but the picker shows gaps). Record the picker UI in E-22. [DOC:360056440594 excerpt] [SRC:skill component-patterns.md]
- *(Review addendum)* **Naming edge cases are unspecified.** No source seen covers:
  - names or values that contain `=` or `,`;
  - whitespace around separators;
  - case (`Size` vs `size`);
  - empty values (`Size=`);
  - a variant layer name that omits an existing property or adds an unknown one.

  Illigma must reproduce Figma exactly (CP-225, CP-226, §8 E-37). [KNOW]
- *(Review addendum)* **Default set styling.** Hypothesis: a set created with "Combine as variants" in the UI gets real node styling (a dashed purple stroke, a small corner radius and padding around the variants) rather than editor chrome. Verify that these are stored stroke/radius values and record them (CP-224, §8 E-41). [KNOW]

**Selecting a variant on an instance.** Each VARIANT property is a dropdown (or toggle for `true/false`-style values, §8 E-21). If the exact combination does not exist, Illigma must reproduce Figma's choice; hypothesis:
```
selectVariant(inst, prop, value):
  cur = inst.variantValues; want = cur with prop := value
  if set.has(want): target = set.get(want)
  else:
     cands = set.variants where v[prop] == value
     target = argmax_{v in cands} |{p ≠ prop : v[p] == cur[p]}|      // keep as many other values as possible
     tie-break: order of variants in the set (layer order) — VERIFY
  swapPreserving(inst, target, 'VARIANT')                           // §3.6 algorithm
  keep BOOLEAN/TEXT/INSTANCE_SWAP/SLOT values whose property identity exists on the set
```
[DOC:360039150413 excerpt for preservation; KNOW for fallback] (§8 E-22)

### 3.11 Component properties (general)

1. Created from the **Properties** section of a selected main component or component set ("Create property" → type → name → default value). [DOC:5579474826519 excerpt]
2. Properties are shown on instances "in a single section of controls in the right sidebar". [DOC:5579474826519 excerpt]
3. One sublayer field references at most one property; one property may be referenced by many sublayers (e.g., one BOOLEAN hiding several layers). [API L6631-6635] [SRC:skill wwds-components.md]
4. In a set, properties live on the set; any variant's sublayers can reference them; a property may be referenced in some variants and not others. [SRC:skill component-patterns.md] [KNOW]
5. A property that is created but not referenced does nothing ("invisible to users of the component"). [SRC:skill wwds-components--creating.md]
6. Changing a property's **default** updates instances that have not set their own value. [KNOW]
7. Deleting a property removes its references; layers keep their main values; instance values for it are discarded. [API L9702-9706] [KNOW]
8. Renaming keeps identity (id suffix) so instance values survive. [API L9661] [KNOW]
9. Name collisions: non-variant properties may share a display name (disambiguated by id); a VARIANT property wins over a same-named non-variant property in `componentProperties`/`setProperties`. [API L9661, L11214-11218]
10. Property values (instance) and defaults (definition) can be bound to variables (`boundVariables.value` / `.defaultValue`); in the UI, BOOLEAN binds boolean variables and TEXT binds string variables. [API L6954-6955, L2240-2252] [KNOW for UI pairing]
11. Multi-selecting several instances of the same component shows shared property controls; differing values show as mixed; nested-instance properties may be hidden in multi-selection (long-standing community complaint). [SRC:https://forum.figma.com/suggest-a-feature-11/nested-property-hidden-with-multiple-selection-27022] [KNOW]
12. Property order in the panel is author-controlled (drag to reorder). [KNOW] (§8 E-23)
13. *(Review addendum)* **Unlinking.** A property reference can be removed from a layer without deleting the property. The layer then shows its main value, and the property may be left unreferenced. Removing it from the layer is a write of `componentPropertyReferences`; the exact UI control is [KNOW]. [API L6624-6635] (CP-229)
14. *(Review addendum)* **Variable-bound VARIANT values.**
    - `setProperties` accepts a `VariableAlias` for *any* property, and `componentProperties[...].boundVariables.value` is typed generically. So the API does not exclude binding a VARIANT value on an instance to a variable.
    - Whether the UI allows it, and which variable types it accepts (string? boolean?), is unverified.
    - If it is supported, switching the variable mode would switch the variant.

    [API L11213-11216] [API L2243-2254] [KNOW] (CP-231, §8 E-43)

### 3.12 BOOLEAN properties

- Control layer **visibility** only ("currently only available for layer visibility"). Create by selecting a nested layer and clicking the **Apply property** control in the Appearance/Layer section; the property is applied to that layer. [DOC:5579474826519 excerpt]
- Default value = boolean (when created from a layer, presumably its current visibility). [API] [KNOW]
- Toggling in an instance shows/hides every referencing layer; hidden children of auto layout collapse out of the flow. [KNOW]
- Interaction between a manual eye toggle on a BOOLEAN-bound sublayer in an instance and the property value is unverified (§8 E-24).

### 3.13 TEXT properties

- Let authors choose which text layers are editable and edit content from the right sidebar. [DOC:5579474826519 excerpt]
- Reference field: `characters` on a text sublayer. Default = string (presumably the layer's text at creation). [API] [KNOW]
- Editing the text on canvas in an instance and editing the sidebar field are the same value. [SRC:skill component-patterns.md] [KNOW]
- Text styling remains separately overridable; behavior with mixed-style text ranges is unverified (§8 E-25).

### 3.14 INSTANCE_SWAP properties and preferred values

- Created from the Properties section ("Instance swap"); applied to a nested **instance** (`mainComponent` reference). The default can be any component from the file or from libraries added to the file. [DOC:5579474826519 excerpt] [API]
- **Preferred values:** list of `{type: 'COMPONENT' | 'COMPONENT_SET', key}` "so others know which instances they can swap to"; shown first in the instance's swap picker; not a hard restriction (any component can still be chosen). [API L11082-11085] [DOC:5579474826519 excerpt] [KNOW for non-restrictive]
- A nested instance commonly carries both a BOOLEAN (`visible`) and an INSTANCE_SWAP (`mainComponent`) reference (e.g., "Show icon" + "Icon"). [SRC:skill component-patterns.md]
- Changing the value swaps the nested instance using swap override preservation (§3.6). [KNOW] (§8 E-26)
- Instance swap works with components, not with variant properties of the swapped content directly (choosing a set opens its variants). [SRC:https://uxdesign.cc/figma-component-properties-broken-logic-or-new-approach-35111b1645b4 excerpt] [KNOW]

### 3.15 VARIANT properties (as component properties)

- `variantOptions` lists values; `defaultValue` cannot be edited directly (it follows the default variant). [API L9683-9690] [KNOW]
- The API cannot delete a VARIANT property (`deleteComponentProperty` excludes VARIANT); whether the UI can delete it directly is unverified (§8 E-27). [API L9702]
- `variantProperties` remains valid on variants in a set; deprecated for instances in favor of `componentProperties`. [API L9612-9658]

### 3.16 Slots

Status: announced at Schema 2025 (Nov 2025) [DOC:35794667554839 excerpt]; open beta reported from 2026-03-05 [SRC:https://www.createwith.com/tool/figma/updates/figma-introduces-slots-feature-in-open-beta-for-full-seat-users excerpt]; "Slots GA" per the Plugin API changelog dated 2026-06-10 [SRC:https://developers.figma.com/docs/plugins/updates/2026/06/10/update/ excerpt]. Help Center pages still carried beta notices when excerpted, so current status must be confirmed live (§8 E-28).

**Creating slots** [DOC:38231200344599 excerpt]:
1. *Convert an existing frame* nested in a main component: right-click menu item, right-sidebar button, or ⌘⇧S (Mac) / Ctrl+Shift+S (Win); then choose an existing SLOT property or create a new one.
2. *Create the property first:* select the main, Create property → Slot; later select a frame → Convert to slot → pick that property.
3. *Wrap layers:* wrapping selected objects creates a new slot around them and a new SLOT property.
4. Script equivalent: `component.createSlot()` creates a `SlotNode` child and auto-creates a linked SLOT property; each call creates a separate slot+property. [API L11156-11161] [SRC:skill component-patterns.md]

**Constraints:**
- Slots only work within components (main components, or variants in the same set — one SLOT property may be applied to slots across variants). [DOC:38231200344599 excerpt]
- A slot property cannot bind to the top-level layer of a component. [DOC:38231200344599 excerpt]
- Must be a frame; GRID auto layout not allowed (`cannotApplyGridToSlot`, `cannotApplySlotPropertyToFrameWithGrid`); frames nested inside another slot cannot themselves be bound. [API L6626, L7648] [SRC:skill component-patterns.md] Community workaround for grid: wrap the grid frame in another frame and convert the outer one. [SRC:https://forum.figma.com/suggest-a-feature-11/will-the-grid-layout-be-available-within-the-new-figma-slots-before-the-end-of-the-beta-51735 excerpt]

**In instances:**
- Content can be added, edited and arranged freely inside the slot (unlike instance swap, which limits to one instance and blocks layout changes). [DOC:38741465279895 excerpt]
- Widgets, stickies and ComponentNodes (main components) cannot be inserted directly into a slot. [SRC:skill component-patterns.md]
- SLOT properties are not set through `setProperties` (throws `cannotSetSlotProperty`); slot content is set by inserting children. [API L11214]
- `resetSlot()` resets the slot to the original component slot content. [API L11270-11273] (The MCP skill says "default empty state"; the typings wording governs — §8 E-28.)
- Properties of instances placed inside a slot are not passed through to the outer instance (community report). [SRC:https://forum.figma.com/report-a-problem-6/figma-slots-do-not-pass-on-component-properties-51891]
- Copying a slot yields a plain FRAME. [API L11264-11268]
- *(Review addendum)* **Open slot questions (all [KNOW], §8 E-44):**
  - Converting a frame that already has children: do those children become the default content? (CP-234)
  - Deleting a SLOT property: `deleteComponentProperty` supports SLOT [API L9702]. What happens to the bound slot node and to custom content in instance slots? (CP-235)
  - Slot depth: may a slot sit anywhere inside the component, or only as a direct child? (CP-236)
  - In instances, are the slot frame's own fill, padding and gap overridable? (CP-237)
  - Is a slot inside a *nested* instance editable from the outer instance? (CP-238)
  - What exactly counts as "preferred" for `HAS_NON_PREFERRED`? (CP-232)

**Slot property settings** (edit via "Edit slot property"): name, description, min/max layer counts, preferred instances, only allow preferred instances, display empty slots by default, set items to fill container by default. No layer limit by default. [DOC:38231200344599 excerpt] [API L11086-11092] Limits **nudge rather than block**: edits that violate them succeed and the slot reports `limitViolations`. [API L11275] [SRC:developers.figma.com changelog excerpt] [SRC:https://eg.linkedin.com/in/asharaby post excerpt "triggering warnings instead of blocking"]

```
limitViolations(slot, settings, prefs):
  n = count(slot.children)                     // hidden children counted? VERIFY (§8 E-29)
  v = []
  if settings.minChildren != null and n < settings.minChildren: v += 'BELOW_MIN'
  elif settings.maxChildren != null and n > settings.maxChildren: v += 'ABOVE_MAX'
  if settings.allowPreferredValuesOnly and
     exists c in slot.children: not (c is INSTANCE and key(mainOrSet(c)) in prefs): v += 'HAS_NON_PREFERRED'
  return v

onInsertIntoSlot(slot, layer, settings):
  if settings.stretchChildOnInsert and slot.layoutMode in {HORIZONTAL, VERTICAL}:
      set counter-axis sizing of layer = FILL
```

### 3.17 Descriptions and documentation links

- Components and component sets carry a description (plain + rich/markdown) and documentation link(s); the API currently supports one link. [API L9306-9342] [DOC:7938814091287 title only]
- Descriptions appear in the Assets panel/component info and when inspecting instances; the set's description is what users usually see for variants. [SRC:skill wwds-components.md] [KNOW] (§8 E-30)

### 3.18 Resizing instances, constraints and scaling

1. Resizing an instance reflows its children by the constraints / auto layout rules defined in the main. [KNOW]
2. The instance's own position, rotation, constraints and auto-layout-child settings in its parent are properties of the instance node (not overrides). [KNOW]
3. Resizing with the Scale tool (K) stores `scaleFactor` on the instance and scales its content; ordinary resize leaves `scaleFactor = 1`. [API L11226-11233]
4. Sublayer geometry cannot be overridden (position, constraints, text bounds). [DOC:360039150733 excerpt]
5. Whether a resized instance keeps its size when the main is resized (size as an override) is unverified (§8 E-11).

### 3.19 Auto layout and components

1. Components are frames, so all auto layout features (incl. wrap, grid, min/max, absolute position) apply to mains and are inherited by instances. [API L11142] [KNOW]
2. Content changes in instances (text overrides, BOOLEAN visibility, swaps, slot content) re-run auto layout: hug containers grow/shrink. [KNOW]
3. An instance placed in an auto layout parent has its own `layoutSizingHorizontal/Vertical`, `layoutPositioning` etc. [KNOW]
4. Slots are usually auto layout frames; GRID is not allowed on slots; `stretchChildOnInsert` applies counter-axis Fill. [API L7648] [SRC:changelog excerpt]
5. Overridability of auto layout properties on instance sublayers: see §3.4 † (§8 E-07).

### 3.20 Variables and styles

1. Variables bound in the main (fills, radius, spacing, visibility, characters…) propagate; rebinding in an instance is an override. [KNOW]
2. Explicit variable modes can be set on an instance (e.g. Light/Dark) and affect its subtree; variants may each set their own explicit modes. [API L10528-10561] [SRC:skill gotchas.md "Explicit variable modes must be set per component"]
3. Applying a style to an instance sublayer is an override of the style id. [API L3751 (`fillStyleId` etc. in change vocabulary)] [KNOW]
4. Component property values/defaults can be variable-bound (§3.11.10).

### 3.21 Interactive components (cross-reference: prototyping area)

- Variants in a set can carry interactions whose action navigates `CHANGE_TO` another variant in the same set; at prototype runtime the instance switches variant without the designer wiring every screen. [API L5807] [DOC:360061175334 title only] [KNOW]
- Navigation actions can reset interactive components on arrival (`resetInteractiveComponents`). [API L5751]
- Prototype connections authored on a main propagate to instances. [DOC:4404380377367 title only] [KNOW]
- Known edge cases (community, 2021–2026): hover variant without the click wiring breaks click navigation; nested interactive components reportedly lose mouse-enter/leave/while-hovering inside other mains; variant interactions ignored when the same trigger has another interaction. [SRC:https://forum.figma.com/t/while-hovering-on-click-interactions-dont-work-well-together/1570] [SRC:https://forum.figma.com/suggest-a-feature-11/interactive-components-not-working-when-nested-inside-a-main-component-12437] These must be validated before being replicated (§8 E-31).
- *(Review addendum)* The sibling prototyping spec (09-prototyping) states that `CHANGE_TO` switches the **closest ancestor instance** of the hotspot, and that "Change to" is offered only inside variants (PR-021, PR-027). Illigma must keep one runtime contract across both documents. Unverified: whether runtime variant changes keep the instance's design-time overrides and property values with the same heuristics as §3.6 (CP-240, §8 E-31). [KNOW]

### 3.22 Copy/paste, duplicate, undo/redo, export, persistence

- Copy/paste and duplicate rules: §3.3. Pasting a main or instance into a **different** file: behavior for unpublished components not verified (§8 E-32).
- Every component operation (create, combine, add variant, property CRUD, swap, set property, reset, detach, push, restore, slot edit) is one undo step and redo re-applies it exactly, including override maps and IDs. [KNOW]
- Export of an instance renders its resolved appearance; export settings on instances are overridable. [DOC:360039150733 excerpt] [KNOW]
- Save/open must round-trip everything in §2.9 "Document".
- *(Review addendum)* **Duplicating containers.** The plugin `clone()` docs for `FrameNode`, `GroupNode`, `TransformGroupNode` and `PageNode` all say that nested components are cloned **as instances of the original main**. `PageNode.clone` also remaps prototype connections to the copied nodes. UI duplicate is expected to match; verify. [API L10570, L10764, L10785, L10809] (CP-210)
- *(Review addendum)* **Deleting a page** that holds main components leaves instances elsewhere pointing at soft-deleted mains, which can be restored. This matches 10-panels-shortcuts-workflow §page deletion. [API L6324] [KNOW] (CP-211)

### 3.23 Local publishing semantics (local-first mapping of Figma libraries)

Figma facts: published components update consumer files only after publishing; remote components are read-only; a component's `key` is stable; publish status is UNPUBLISHED/CURRENT/CHANGED; edit mains only in their own file; push overrides is not possible into libraries; Go to main component opens the library file. [DOC:360038665934 excerpt] [API L9343-9355, L6262] Hidden-from-publishing assets exist ([DOC:360039238193 title only]; name prefix `.` or `_` convention [KNOW]). Published components can be moved between files while keeping instance links ([DOC:4404848314647 title only]).

Illigma mapping (design decision, behavior must match Figma's user-visible semantics):
```
Library      = an Illigma document the user marks "Library" and lists in Settings ▸ Libraries (local path or folder)
Publish      = write an immutable, versioned snapshot of the document's publishable components/sets (+ styles/variables)
               keyed by component key; diff vs previous snapshot → publish status CURRENT / CHANGED / UNPUBLISHED
Enable       = consumer document references library id; Assets panel lists its published (non-hidden) components
Insert       = copy the published definition into the consumer's remote-definition cache (read-only, remote: true)
Update       = when a newer snapshot exists, consumer shows "updates available"; user reviews and accepts;
               accepting re-resolves instances, preserving overrides per §3.2 rules
Offline      = consumer always renders from its cache; missing library file never breaks rendering
```

*(Review addendum)* Related catalog articles that were **not** researched (title only):
- 360039234193 Review and accept library updates
- 360025508373 Publish a library
- 360039236853 Unpublish a library
- 360041051154 Guide to libraries in Figma
- 1500008731201 Add or remove a library from a design file

Unpublish/missing-library handling (CP-241) and granular update review (CP-242) are therefore [KNOW]. They must be aligned with 08-variables-styles-design-systems, which owns library semantics.

### 3.24 Layers panel and selection

- Distinct node-type icons for component, component set, instance, slot (style from Framer, semantics from Figma). [KNOW]
- Instance children are listed but cannot be dragged to reorder or out of the instance; layers cannot be dropped into an instance except into a slot. [DOC:360039150733 excerpt] [KNOW]
- Clicking selects the top-level instance; double-click or ⌘/Ctrl-click deep-selects sublayers. [KNOW]

---

## 4. Inspector & on-canvas controls (Figma UI3, functional only)

Labels marked * were seen in Help Center excerpts; others are [KNOW] and must be confirmed (§8 E-33).

### 4.1 Toolbar / context menu / Actions

| Control | Context | Function |
| --- | --- | --- |
| Create component* | eligible selection | §3.1 |
| Create multiple components* | ≥2 eligible layers | one component per top-level layer |
| Combine as variants | ≥2 components (not in a set) | §3.10 |
| Add variant | component or set | §3.10 |
| Go to main component* | instance | §3.8 |
| Push changes to main component (label TBC) | local instance with overrides | §3.8 |
| Reset → Reset [property] / Reset all changes* | instance or instance sublayer with overrides | §3.5 |
| Detach instance* | instance | §3.7 |
| Restore component* | instance of deleted main | §3.8 |
| Convert to slot*, Wrap in slot (label TBC)* | frame / layers inside a main | §3.16 |
| Actions menu (⌘K/Ctrl+K) Assets tab; quick insert ⇧I* | anywhere | §3.3 |

### 4.2 Right panel — main component (non-variant)

| Section | Controls |
| --- | --- |
| Component header | Name; description editor (rich text); documentation link; (publish status hint when library) |
| Properties | "+" Create property (Variant, Boolean, Text, Instance swap, Slot); list rows (name, type icon, default); click row → edit popover (name, default, preferred values for instance swap; for slot: name, description, min/max, preferred instances, only allow preferred, display empty by default, fill container by default*); delete; drag reorder |
| Nested instances | choose nested instances to expose; (Simplify instances option — TBC) |
| Layer/Appearance etc. | "Apply property" control next to visibility (BOOLEAN)*, text content (TEXT), nested instance name (INSTANCE_SWAP) |

### 4.3 Right panel — component set and variant

| Selection | Controls |
| --- | --- |
| Component set | Name, description, documentation link; Properties list incl. VARIANT properties with their values (rename property/value, add value, reorder); "Add variant"; set frame/layout controls |
| Variant (component inside set) | The variant's value for each VARIANT property (dropdown/text); conflict warning when its combination duplicates another*; its own frame controls |

### 4.4 Right panel — instance

| Region | Controls |
| --- | --- |
| Header | Instance icon + main component name → opens swap instance menu (search, local/library, related grouping, preferred first); Go to main component; More actions (Reset ▸ property list / all changes, Detach, Push changes, Restore component) |
| Properties | VARIANT dropdowns (toggle for true/false-like values, TBC); BOOLEAN toggles; TEXT fields; INSTANCE_SWAP pickers (preferred values first); exposed nested instance groups with their own controls |
| Description/doc link | Read-only display of main's description and link (TBC) |
| Remaining sections | Normal frame sections (layout, appearance, fill…) operate as overrides on the instance |

### 4.5 Right panel — slot

| Selection | Controls |
| --- | --- |
| Slot in main | Slot property assignment (dropdown of SLOT properties), Edit slot property, frame/auto layout controls (no grid) |
| Slot in instance | Reset slot; limit warnings (below min / above max / non-preferred); insert preferred instances (TBC) |

### 4.6 On-canvas

| Control | Function |
| --- | --- |
| Component set "+" add-variant affordance | §3.10 |
| Empty-slot highlight / drop target | shows where content can be inserted; always shown on empty instances when `displayEmptyByDefault` |
| "Return to instance" | temporary control after Go to main component* |
| Assets-panel drag + ⌥/Alt drop on instance | swap (§3.6) |

---

## 5. Keyboard shortcuts (macOS / Windows)

| Action | macOS | Windows | Confidence / evidence |
| --- | --- | --- | --- |
| Create component | ⌥⌘K | Ctrl+Alt+K | third-party lists + forum [SRC] [KNOW] — verify |
| Detach instance | ⌥⌘B | Ctrl+Alt+B | [DOC:360038665754 excerpt] |
| Convert frame to slot | ⌘⇧S | Ctrl+Shift+S | [DOC:38231200344599 excerpt] — verify |
| Quick insert (Assets in Actions menu) | ⇧I | Shift+I | [DOC:360039150173 excerpt] |
| Actions menu (run commands such as "Combine as variants") | ⌘K | Ctrl+K | [SRC:forum, March 2026 thread] [KNOW] |
| Duplicate main → instance | ⌘D | Ctrl+D | [DOC:360039150173 excerpt] |
| Instance by drag | ⌥-drag | Alt-drag | [DOC:360039150173 excerpt] |
| Swap by drag from Assets | hold ⌥ on drop | hold Alt on drop | [DOC:360039150173 excerpt] |
| Swap nested by drag | ⌥⌘ on drop | Alt+Ctrl on drop | [SRC:uxdesign.cc] — verify |
| Deep select inside instance | ⌘-click / double-click | Ctrl-click / double-click | [KNOW] |
| Scale tool (sets `scaleFactor`) | K | K | [API L11226-11233] |
| Go to main component | none confirmed (forum: no native shortcut as of 2024-2025; one mirror lists ⌃⌥⌘K — conflicting) | — | [SRC:https://forum.figma.com/share-your-feedback-26/go-to-main-component-keyboard-shortcut-33739] — verify |
| Create component set / Create multiple components | none confirmed (third-party claims ⌥⇧⌘K; a 2022 feature request proposed it) | — | [SRC] — verify |
| Reset overrides | none confirmed (third-party claims ⌥⌘R) | — | [SRC] — verify |

---

## 6. Parity checklist

All items: status **Not started**.

### 6.1 Creating components

- [ ] **CP-001** Create component from a single frame — the selected frame is converted in place into a COMPONENT keeping all frame properties (size, position, rotation, fills, strokes, effects, clip, auto layout settings, constraints, layout-child settings), children, name and z-index. _Data:_ `type: 'COMPONENT'`, `createComponentFromNode` _Test:_ Build a 200×120 auto layout frame with padding 16, gap 8, 3 children, drop shadow; ⌥⌘K in Figma and Illigma; compare node type, all frame props and children order/IDs. _M5·P0·[API][KNOW]_
- [ ] **CP-002** Create component from a single non-frame layer — a rectangle/text/vector/boolean/instance is wrapped in a new component sized to the layer's bounds, with the layer as sole child at the same canvas position and the component named after the layer. _Data:_ `COMPONENT.children[0]`, `name`, `x/y/width/height` _Test:_ Repeat for rectangle, text, vector, boolean group, instance; record wrapper bounds (geometric vs visual incl. stroke/shadow), name, child offset in Figma (§8 E-02); Illigma must match. _M5·P0·[KNOW]_
- [ ] **CP-003** Create component from a group — reproduce Figma's handling (group kept as child vs dissolved into component). _Data:_ `GROUP`, `COMPONENT.children` _Test:_ Group of 2 rects → create component; inspect layer tree in Figma (§8 E-02). _M5·P1·[KNOW]_
- [ ] **CP-004** Create one component from a multi-selection — all selected sibling layers are wrapped in one component whose bounds are their union; relative positions and z-order preserved; component inserted at the topmost selected layer's z-position in the common parent. _Data:_ `COMPONENT.children` order _Test:_ Select 3 overlapping layers in a frame (non-contiguous z), ⌥⌘K; compare bounds, child order, insertion index. _M5·P0·[KNOW]_
- [ ] **CP-005** Create multiple components — with ≥2 layers selected, "Create multiple components" turns each top-level selected layer (frame, group, boolean operation, path…) into its own component, frames converted in place. _Data:_ N × `COMPONENT` _Test:_ Select 4 frames + 1 vector, run command; expect 5 components with original names/positions. _M5·P1·[SRC:figma-signup.helpjuice.com mirror excerpt][SRC:forum 14306]_
- [ ] **CP-006** Create-component shortcut — ⌥⌘K (Ctrl+Alt+K) runs "Create component" (single component even for multi-selection). _Data:_ — _Test:_ Press shortcut with 1 and with 3 layers selected; compare to Figma. _M5·P0·[SRC:third-party lists][KNOW]_
- [ ] **CP-007** Creation restrictions — command unavailable when the selection is a component or component set, or is inside a component, component set or instance. _Data:_ `createComponentFromNode` error "Cannot create component from node" _Test:_ Try on: main, set, variant, layer inside main, layer inside instance; Illigma must disable the command in all five cases. _M5·P0·[API L1112]_
- [ ] **CP-008** Undo/redo create component — one undo step restores the original layer(s) exactly (types, names, IDs, positions); redo re-creates the same component ID. _Data:_ undo stack _Test:_ Create component from frame and from multi-selection; ⌘Z, ⌘⇧Z; diff document before/after. _M5·P0·[SRC:forum 4356 excerpt][KNOW]_
- [ ] **CP-009** Default component name — name follows the source layer; when wrapping several layers the default name matches Figma's (e.g., "Component 1" — verify). _Data:_ `name` _Test:_ Create components from multi-selection twice; record names in Figma (§8 E-02). _M5·P2·[KNOW]_
- [ ] **CP-010** New component appears in Assets ▸ Local components immediately, grouped by page/frame and slash-name segments. _Data:_ local component index _Test:_ Create "Icons/Arrow/Left" on page "Lib"; Assets shows it under Lib ▸ Icons ▸ Arrow. _M5·P1·[KNOW] (review: downgraded — DOC:360039150413 excerpt concerns swap-menu grouping, not Assets; DOC:360038663994 seen as title only; see 10-panels A-02)_
- [ ] **CP-011** Creating a component from a child of an auto layout frame keeps its flow index and its layout-child settings (fill/hug/fixed, absolute positioning). _Data:_ `layoutSizingHorizontal`, `layoutPositioning`, child index _Test:_ Convert 2nd child (Fill width) of a vertical stack; component remains 2nd and Fill. _M5·P1·[KNOW]_
- [ ] **CP-012** No un-componentize command — Illigma offers no "convert main to frame" unless Figma does; documented path is instance → detach → delete main. _Data:_ — _Test:_ Check Figma UI3 context menu on a main (§8 E-03). _M5·P2·[SRC:forum 2024 excerpt]_
- [ ] **CP-203** Create component from a frame that **contains** a main component — matches Figma exactly. Possible outcomes: the command is refused, or the nested main is converted to an instance. Either way the result never has a main inside a main. _Data:_ `createComponentFromNode` restrictions (the typings restrict only the node itself) _Test:_ Frame F holds main M plus a rectangle; press ⌥⌘K on F; record the resulting tree and M's type (§8 E-47). _M5·P1·[API L1112][KNOW]_
- [ ] **CP-204** Create component from a frame that contains overridden instances — the instances become nested instances that keep their links. Their overrides become **inherited** overrides of the new component: visible in new instances, but absent from those instances' `overrides`. _Data:_ `overrides` (direct only) _Test:_ Frame holds a Button instance with label override "Buy"; ⌥⌘K; create an instance of the new component. Expect label "Buy" and an empty `overrides` list. _M5·P0·[API L11243][KNOW]_
- [ ] **CP-205** Create component from hidden, locked, rotated, flipped or zero-height sources — matches Figma for each. Record whether a hidden or locked source stays hidden or locked. Record whether a rotated frame converted in place keeps its rotation. Record the wrapper size and rotation for a rotated non-frame layer and for a 0-height line. _Data:_ `visible`, `locked`, `rotation`, `relativeTransform`, `height` _Test:_ §8 E-47 (each case in Figma and Illigma; diff the node JSON). _M5·P2·[KNOW]_
- [ ] **CP-206** "Create component set" from plain layers — if Figma UI3 offers it (third-party lists claim ⌥⇧⌘K), it equals "Create multiple components" followed by "Combine as variants" in **one** undo step. Otherwise Illigma must not offer it. _Data:_ `COMPONENT_SET` _Test:_ §8 E-36 (check the shortcut panel and the create-component dropdown). _M5·P2·[SRC:third-party lists][KNOW]_

### 6.2 Main components & propagation

- [ ] **CP-013** Same-file propagation is immediate — editing any non-overridden field in the main updates all instances in the document in the same frame/commit. _Data:_ instance resolution _Test:_ 50 instances across 3 pages; change main fill; all instances (incl. other pages after switching) show new fill. _M5·P0·[DOC:360038665934 excerpt]_
- [ ] **CP-014** Per-field override isolation — an instance overriding fill on sublayer S still receives main changes to S's stroke, radius, effects, and to other sublayers. _Data:_ `overrides[].overriddenFields` _Test:_ Override fill on instance's "Bg"; change Bg stroke and fill in main; instance keeps its fill, takes new stroke. _M5·P0·[KNOW][SRC:forum 13480 excerpt]_
- [ ] **CP-015** Adding a sublayer in the main adds it to every instance at the same z-index with no overrides. _Data:_ children order _Test:_ Insert rect between 2 children in main; verify index in instances. _M5·P0·[KNOW]_
- [ ] **CP-016** Deleting a sublayer in the main removes it (and its overrides) from all instances; undo restores sublayer and the overrides. _Data:_ overrides map _Test:_ Override text in instance; delete that text in main; undo; override is back. _M5·P0·[KNOW]_
- [ ] **CP-017** Reordering/reparenting sublayers in the main is mirrored in instances; overrides follow the sublayer identity, not its index or name. _Data:_ composite sublayer IDs _Test:_ Override fill of child "A"; move A to top and rename to "B" in main; override still on that layer. _M5·P0·[KNOW]_
- [ ] **CP-018** Main placement does not propagate — moving, rotating or reparenting the main never changes instances' position/rotation/parent. _Data:_ `x`, `y`, `rotation`, `parent` _Test:_ Rotate main 15°; instances unchanged. _M5·P0·[KNOW]_
- [ ] **CP-019** Main resize propagation — instances without a size override follow the main's new width/height; instances with a size override keep theirs; in both cases children reflow per constraints/auto layout. _Data:_ `width`, `height` overrides _Test:_ 2 instances, resize one; resize main from 100→160 wide; record both in Figma (§8 E-11). _M5·P0·[KNOW]_
- [ ] **CP-020** Structural edits inside instances are blocked — cannot add, delete, reorder, move or reparent sublayers of an instance (outside slots); drag/drop and paste into an instance target its parent instead or are refused. _Data:_ — _Test:_ Try to drag a rect into an instance, drag a sublayer out, delete a sublayer, ⌘] on a sublayer; Figma refuses all (record exact feedback). _M5·P0·[DOC:360039150733 excerpt][API L1861][KNOW for the redirect-to-parent part]_
- [ ] **CP-021** Propagation is derived, not a user edit — no extra undo entry and no "changed" notification for instance sublayers updated by main changes. _Data:_ undo stack, change events _Test:_ Edit main once; one undo reverts main and all instances. _M5·P0·[API L594][KNOW]_
- [ ] **CP-022** Main components never nest — a main component cannot be placed inside another main component, component set (except as variant) or instance; drop/paste is refused or converted per Figma. _Data:_ parent rules _Test:_ Drag main A into main B in Figma; record result (§8 E-06); Illigma matches. _M5·P1·[API L1112][KNOW]_
- [ ] **CP-023** Instance cycles are impossible — inserting, swapping or setting an INSTANCE_SWAP value that would make a component contain itself (directly or transitively) is blocked. _Data:_ dependency graph _Test:_ A contains instance of B; try to insert instance of A into B; refused. _M5·P0·[KNOW]_
- [ ] **CP-207** Root-level main fields: propagation matrix — reproduce exactly which fields of the main's **root node** reach instances. Appearance and layout of the root (fills, strokes, effects, opacity, blend, radius, clip, auto layout) are expected to propagate. Placement (x/y, rotation, parent, constraints, layout-child sizing) does not (CP-018). Hiding (`visible`), locking (`locked`) and export settings on the main itself are unverified. _Data:_ root-node fields of `COMPONENT` _Test:_ §8 E-39. Toggle each field on the main and record whether 3 existing instances change. _M5·P0·[KNOW]_
- [ ] **CP-208** Override granularity of list-valued fields — overriding one entry (one paint, one shadow, one grid) overrides the **whole** `fills`/`strokes`/`effects`/`layoutGrids` value. Later main edits to other entries of that list then do not reach the instance. Illigma must match Figma's real granularity. _Data:_ `overriddenFields` (`fills`, `effects`, …) _Test:_ The main's "Bg" has 2 fills; in an instance change only the top fill's opacity; in the main recolor the bottom fill; record the instance's bottom fill (§8 E-40). _M5·P0·[API L3751 (field-level vocabulary)][KNOW]_

### 6.3 Creating & inserting instances

- [ ] **CP-024** ⌥/Alt-drag of a main creates an instance; releasing the modifier before the mouse moves the main instead. _Data:_ `INSTANCE.mainComponent` _Test:_ Perform both release orders; first yields instance, second moves main. _M5·P0·[DOC:360039150173 excerpt]_
- [ ] **CP-025** ⌘D/Ctrl+D on a main (same file) creates an instance with the standard duplicate offset/placement rules. _Data:_ — _Test:_ Duplicate main; new node type INSTANCE linked to it. _M5·P0·[DOC:360039150173 excerpt]_
- [ ] **CP-026** Copy/paste of a main within the same file pastes an instance. _Data:_ clipboard payload _Test:_ ⌘C/⌘V main; pasted node is INSTANCE. _M5·P0·[DOC:360039150173 excerpt]_
- [ ] **CP-027** Copy/paste/duplicate of an instance yields an instance of the same main with identical overrides and property values. _Data:_ `overrides`, `componentProperties` _Test:_ Override text+fill, set BOOLEAN false, duplicate; compare overrides lists. _M5·P0·[API L11194][KNOW]_
- [ ] **CP-028** Drag from Assets panel inserts an instance at the drop point (parenting into the frame under the pointer, at the drop index in auto layout). _Data:_ parent, index _Test:_ Drop between 2nd and 3rd child of an auto layout frame; instance becomes 3rd. _M5·P0·[DOC:360039150173 excerpt][KNOW]_
- [ ] **CP-029** Dragging a component set from Assets inserts its default (top-left-most) variant. _Data:_ `defaultVariant` _Test:_ Set with variants at (0,0) and (200,0); drag; instance of (0,0) variant. Move the other variant to (-50,0); repeat. _M5·P0·[API L11127-11129]_
- [ ] **CP-030** Quick insert ⇧I opens Actions ▸ Assets with search across local and enabled library components; Enter/click inserts an instance. _Data:_ — _Test:_ ⇧I, type "button", insert; instance created at viewport/selection per Figma rule (§8 E-33). _M5·P1·[DOC:360039150173 excerpt]_
- [ ] **CP-031** Duplicating a frame that contains a main yields a copy containing an instance of that main (no second main). _Data:_ `FrameNode.clone` semantics _Test:_ Frame with main inside, ⌘D; copy's child type is INSTANCE (§8 E-04). _M5·P1·[API L10764][KNOW]_
- [ ] **CP-032** Default instance name equals the main's name (component-set name for variants); renaming the main renames instances whose name is not overridden. _Data:_ `name` override _Test:_ Rename main "Btn"→"Button"; unrenamed instances follow, renamed ones don't (§8 E-05). _M5·P1·[DOC:360039150733 excerpt (layer name overridable)][KNOW]_
- [ ] **CP-209** Instances reference a variant, never a set — an instance's main is always a `COMPONENT`. Inserting a set yields an instance of one variant (the default variant). No UI path or file state may link an instance to a `COMPONENT_SET`. _Data:_ `InstanceNode.mainComponent: ComponentNode \| null`, `swapComponent(ComponentNode)` _Test:_ Insert a set from Assets; inspect `mainComponent.type === 'COMPONENT'` and that its `parent` is the set. _M5·P0·[API L11196-11212]_
- [ ] **CP-210** Duplicating a page, group or transform group that contains mains — the copy contains **instances** of the original mains (no new mains). On page duplicate, prototype connections in the copy point to the copied nodes. _Data:_ `PageNode.clone`, `GroupNode.clone`, `TransformGroupNode.clone` _Test:_ A page holds main M, an instance of M, and a frame with an On click connection; duplicate the page. In the copy, M is an INSTANCE of the original M and the connection targets the copy. Repeat with a group around M (⌘D). _M5·P1·[API L10570, L10785, L10809][KNOW for UI parity]_
- [ ] **CP-211** Deleting a page that contains mains — instances on other pages keep rendering the soft-deleted definitions and offer Restore (CP-079); one undo restores the page and re-links everything. _Data:_ soft-deleted `COMPONENT` _Test:_ Delete the "Library" page; check instances on "Screens"; ⌘Z. _M5·P1·[API L6324][KNOW] (cross-ref 10-panels page deletion)_
- [ ] **CP-212** Rotating or flipping an instance — rotation and flips (⇧H/⇧V) are the instance's **own** transform, not overrides. Content keeps updating from the main and renders rotated or mirrored. _Data:_ `relativeTransform`, `rotation` _Test:_ Flip an instance horizontally and rotate it 30°; change the main's text. The instance shows the new text mirrored and rotated, and `overrides` stays empty. _M5·P1·[KNOW]_
- [ ] **CP-213** Initial transform of an instance made from a rotated or flipped main — Alt-drag, ⌘D, copy/paste and Assets insertion copy (or reset) the main's rotation and flip exactly as Figma does. _Data:_ `rotation`, `relativeTransform` _Test:_ §8 E-38. _M5·P2·[KNOW]_
- [ ] **CP-214** Instance name after swap or variant change — an instance that was never renamed takes the new main's name (the set name for variants); a renamed instance keeps its name through swaps and variant switches. _Data:_ `name` override _Test:_ Swap an unrenamed instance and a renamed one; compare their names (§8 E-05). _M5·P1·[KNOW]_

### 6.4 Override model

- [ ] **CP-033** Text overrides — characters and text styling (font family/style, size, line height, letter spacing, case, decoration, resizing mode) can be overridden per text sublayer. _Data:_ `characters`, `fontName`, `fontSize`, `lineHeight`, `letterSpacing`, `textCase`, `textDecoration`, `textAutoResize` _Test:_ Override each in an instance; each listed in `overrides`; main change to an un-overridden field still propagates. _M5·P0·[DOC:360039150733 excerpt][API L3751]_
- [ ] **CP-034** Paint overrides — fills and strokes (paints, weight, alignment) and applied fill/stroke styles are overridable on any sublayer and on the instance itself. _Data:_ `fills`, `strokes`, `strokeWeight`, `strokeAlign`, `fillStyleId`, `strokeStyleId` _Test:_ Override each; reset each individually. _M5·P0·[DOC:360039150733 excerpt][KNOW]_
- [ ] **CP-035** Effect overrides — shadows/blurs (and effect style) overridable. _Data:_ `effects`, `effectStyleId` _Test:_ Add shadow on instance sublayer; listed as override. _M5·P0·[DOC:360039150733 excerpt]_
- [ ] **CP-036** Visibility overrides — eye toggle on an instance sublayer creates a `visible` override; hidden layers collapse in auto layout. _Data:_ `visible` _Test:_ Hide sublayer; instance hugs smaller; reset restores. _M5·P0·[KNOW]_
- [ ] **CP-037** Layer-name override — renaming an instance or its sublayer is an override; reset restores main name. _Data:_ `name` _Test:_ Rename sublayer; main rename doesn't affect it until reset. _M5·P1·[DOC:360039150733 excerpt]_
- [ ] **CP-038** Export-settings and layout-guide overrides — export settings and layout grids/guides on the instance or sublayers are overridable. _Data:_ `exportSettings`, `layoutGrids` _Test:_ Add PNG@2x export to instance; main export settings change doesn't remove it. _M5·P1·[DOC:360039150733 excerpt]_
- [ ] **CP-039** Opacity, blend mode, corner radius, dash pattern overridability matches Figma (each verified). _Data:_ `opacity`, `blendMode`, `cornerRadius`, `dashPattern` _Test:_ Try each on instance sublayers in Figma (§8 E-07). _M5·P1·[KNOW]_
- [ ] **CP-040** Non-overridable fields are read-only on instance sublayers — x/y, rotation, constraints, z-order, text box bounds cannot be changed (controls disabled or edits refused). _Data:_ `x`, `y`, `constraints`, child order _Test:_ Try drag, arrow-key nudge, constraint dropdown, resize handles on a text sublayer in an instance; all refused as in Figma. _M5·P0·[DOC:360039150733 excerpt]_
- [ ] **CP-041** Sublayer size overridability matches Figma — resize handles on instance sublayers (frames/shapes) behave exactly as Figma (refused or allowed) incl. auto layout sizing-mode changes (hug/fill/fixed). _Data:_ `width`, `height`, `layoutSizing*` _Test:_ §8 E-07. _M5·P0·[KNOW]_
- [ ] **CP-042** `overrides` contains only direct overrides, grouped by sublayer id with the changed field names. _Data:_ `overrides: {id, overriddenFields}[]` _Test:_ Override 2 fields on 2 sublayers; list has 2 entries with correct fields; inherited overrides absent. _M5·P0·[API L11243-11248]_
- [ ] **CP-043** Resolution precedence — direct override > instance property value > inherited override (set inside an outer main on a nested instance) > nested main default. _Data:_ resolver _Test:_ Card main contains Button instance with text override "Buy"; Card instance overrides to "Pay"; Button main text "Click"; resolve = "Pay"; reset Card → "Buy". _M5·P0·[API L11243][KNOW]_
- [ ] **CP-044** Setting a field back to the main's value — matches Figma (override cleared vs kept). _Data:_ overrides _Test:_ Change fill red→blue→red (main red); inspect overrides (§8 E-09). _M5·P1·[KNOW]_
- [ ] **CP-045** Text range-style overrides — mixed styling inside one text sublayer is preserved as override and survives main changes to un-overridden ranges per Figma. _Data:_ `styledTextSegments` _Test:_ Bold one word in instance; change main font size; record result (§8 E-25). _M5·P1·[KNOW]_
- [ ] **CP-046** Locked state on instance sublayers matches Figma (overridable or not). _Data:_ `locked` _Test:_ Lock a sublayer inside instance; check overrides. _M5·P2·[API L3751][KNOW]_
- [ ] **CP-215** Extended text-field overridability — horizontal/vertical alignment, paragraph spacing and indent, list spacing, truncation and max lines, leading trim, hyperlinks and OpenType features on instance text are allowed or blocked exactly as in Figma. _Data:_ `textAlignHorizontal`, `textAlignVertical`, `paragraphSpacing`, `paragraphIndent`, `listSpacing`, `textTruncation`, `maxLines`, `leadingTrim`, `hyperlink`, `openTypeFeatures` _Test:_ §8 E-07 (text block). Each field appears in `overrides` when changed and in the Reset menu. _M5·P1·[API L3751-3884 (vocabulary only)][KNOW]_
- [ ] **CP-216** Structural geometry inside instances — on instance sublayers, the mask toggle and mask type, boolean operation type, vector network/point edits, clip content and corner smoothing are each allowed (as overrides) or blocked exactly as in Figma. _Data:_ `isMask`, `maskType`, `booleanOperation`, `vectorNetwork`, `clipsContent`, `cornerSmoothing` _Test:_ §8 E-07 (geometry block). _M5·P1·[API L3751-3884 (vocabulary only)][KNOW]_
- [ ] **CP-217** Auto layout on instances (consistent with 03-auto-layout AL-224/AL-226):
  - padding, gap, alignment and min/max are overridable;
  - removing auto layout, changing the flow/direction, toggling the layout version and reordering children are blocked;
  - wrap and counter-axis spacing are as Figma does.

  _Data:_ `paddingLeft…`, `itemSpacing`, `primaryAxisAlignItems`, `layoutMode`, `layoutWrap`, `counterAxisSpacing` _Test:_ §8 E-07 (auto layout block). Both documents must be updated together from the result. _M5·P0·[KNOW] (03 cites DOC:31441443713047 excerpt for the reorder ban)_
- [ ] **CP-218** Paste properties onto an instance — Copy properties / Paste properties (⌥⌘C / ⌥⌘V) onto an instance or an instance sublayer records each pasted **overridable** field as an override. Non-overridable fields (position, rotation, constraints) are ignored and do not cause a structural change. _Data:_ `overrides` _Test:_ Copy properties from a red, rotated frame with a shadow; paste onto an instance sublayer. Fill and shadow become overrides; rotation is unchanged. _M5·P2·[KNOW] (DOC:4412765442967 catalog title only)_

### 6.5 Reset overrides

- [ ] **CP-047** Reset all changes (top-level instance) — clears all direct overrides of the instance including nested sublayers, nested swaps and component property values (property values return to defaults). _Data:_ `removeOverrides()` _Test:_ Apply 6 kinds of overrides incl. nested swap and BOOLEAN false; reset all; `overrides` empty and render equals fresh instance (§8 E-10). _M5·P0·[DOC:360038665934 excerpt][API L11250-11257][KNOW — whether property values count as "direct overrides" is unverified]_
- [ ] **CP-048** Reset all changes on a selected nested layer resets only that layer's overrides. _Data:_ per-sublayer overrides _Test:_ Override 2 sublayers; select one, reset all changes; the other keeps its override. _M5·P0·[DOC:360038665934 excerpt]_
- [ ] **CP-049** Reset a single property — "Reset ▸ Reset [property]" lists exactly the overridden property groups of the selected layer and resets just that one. _Data:_ overriddenFields grouping _Test:_ Override fill and text on a text layer; menu shows both; reset fill only. Record Figma's grouping labels (§8 E-10). _M5·P0·[DOC:360038665934 excerpt]_
- [ ] **CP-050** Inherited overrides are not resettable from the outer instance (they are its baseline). _Data:_ inherited overrides _Test:_ Override inside main on nested instance; outer instance reset leaves it. _M5·P1·[API L11243][KNOW]_
- [ ] **CP-051** Reset is one undo step and applies to every selected instance in a multi-selection. _Data:_ undo _Test:_ Select 3 overridden instances, reset all, ⌘Z restores all 3. _M5·P1·[KNOW]_
- [ ] **CP-052** Top-level size override reset behavior matches Figma (whether "Reset all changes" resets width/height; presence of a separate size reset). _Data:_ `width`, `height` _Test:_ §8 E-11. _M5·P1·[SRC:forum excerpt][KNOW]_

### 6.6 Swap instance

- [ ] **CP-053** Instance menu swap — clicking the instance name opens a searchable picker of components (local + enabled libraries) with related components (same file/page/frame, slash-name siblings) grouped first. _Data:_ — _Test:_ Components "UI/Button/Hover", "UI/Button/Default" in same frame; picker groups them. _M5·P0·[DOC:360039150413 excerpt]_
- [ ] **CP-054** Swap preserves overrides by matching layer names (and hierarchy) between old and new component; text overrides kept when the text layer name matches and hierarchy is similar. _Data:_ `swapComponent` _Test:_ Two icons-in-button components with same layer names but different structure; override text + fill; swap; record which survive in Figma and match (§8 E-12). _M5·P0·[SRC:forum 14757 quoting DOC:360039150413][API L11206-11212]_
- [ ] **CP-055** Swap with non-matching names drops the unmatched overrides (no error). _Data:_ — _Test:_ Rename target's text layer; swap; text override gone. _M5·P0·[DOC:360039150413 excerpt][SRC:forum 14757]_
- [ ] **CP-056** Swap keeps the instance's own placement (parent, index, x/y, constraints, auto-layout child settings, rotation). _Data:_ `x`, `y`, `layoutSizing*`, index _Test:_ Swap instance in auto layout (Fill width); stays Fill and same index. _M5·P0·[KNOW]_
- [ ] **CP-057** Size after swap matches Figma (adopt new main size vs keep overridden size; hug/fill rules). _Data:_ `width`, `height` _Test:_ §8 E-12. _M5·P0·[KNOW]_
- [ ] **CP-058** Drag-swap from Assets — hold ⌥/Alt when dropping onto an instance to replace it; releasing the modifier first only adds; only text overrides are preserved in this path (per help). _Data:_ — _Test:_ Override text+fill, drag-swap; text kept, fill dropped (§8 E-12). _M5·P1·[DOC:360039150173 excerpt]_
- [ ] **CP-059** Drag-swap onto a nested instance with ⌥⌘ (Alt+Ctrl). _Data:_ nested `mainComponent` override _Test:_ Drop icon component onto nested icon inside a button instance with ⌥⌘. _M5·P2·[SRC:uxdesign.cc excerpt]_
- [ ] **CP-060** Nested swap is an override — swapping a nested instance inside an instance records a `mainComponent` override on that sublayer; reset reverts to the main's nested component. _Data:_ nested-swap entry in `overriddenFields` (field name unknown — `mainComponent` is **not** a member of `NodeChangeProperty` v1.141.0) _Test:_ Swap nested icon; check overrides; reset. _M5·P0·[API L11196][KNOW]_
- [ ] **CP-061** Multi-selection swap — selecting several instances (same or different mains) and choosing a component swaps all. _Data:_ — _Test:_ Select 3 instances, swap; all 3 changed in one undo step. _M5·P1·[KNOW]_
- [ ] **CP-062** Direct main reassignment (API/scripting) clears all overrides, unlike swap. _Data:_ `mainComponent =` vs `swapComponent()` _Test:_ Scripted comparison on overridden instance. _M5·P2·[API L11195-11212]_
- [ ] **CP-219** Swapping between component sets keeps matching VARIANT values — when the target set has the same VARIANT property names and values, the swapped instance lands on the matching variant (otherwise on the target's default variant) as Figma does. _Data:_ `componentProperties` (VARIANT) _Test:_ Button set and IconButton set both have `Size=sm/lg`; swap a `Size=lg` Button to IconButton; record the resulting Size (§8 E-12). _M5·P1·[KNOW]_
- [ ] **CP-220** Paste to replace (⇧⌘R / Ctrl+Shift+R) with a component or instance on the clipboard — replacing selected instances yields what Figma yields: either a swap that preserves overrides or a plain replacement that loses them. _Data:_ — _Test:_ Copy main B; select 2 overridden instances of A; Paste to replace; record the result type, overrides and placement (§8 E-46). _M5·P2·[KNOW]_

### 6.7 Detach

- [ ] **CP-063** Detach instance (⌥⌘B / Ctrl+Alt+B, instance menu, right-click canvas or Layers) converts the instance into a FRAME with the same name, size, position, properties and children; future main edits do not affect it. _Data:_ `detachInstance(): FrameNode` _Test:_ Detach, then edit main fill; frame unchanged. _M5·P0·[DOC:360038665754 excerpt][API L11221-11225]_
- [ ] **CP-064** Detach bakes the resolved state — overrides, property values, swapped nested components, slot content are kept visually and structurally; property references are removed. _Data:_ `componentPropertyReferences` → null _Test:_ Instance with TEXT value "Hi", BOOLEAN false, swapped icon; detach; texts/visibility/icon identical; no references. _M5·P0·[KNOW]_
- [ ] **CP-065** Nested instances inside a detached instance remain instances of their mains. _Data:_ child `type` _Test:_ Card instance containing Button instance; detach Card; Button still INSTANCE (§8 E-13). _M5·P0·[KNOW]_
- [ ] **CP-066** Detaching a nested instance also detaches all ancestor instances (they become frames, with new IDs). _Data:_ ancestor `type`, `id` _Test:_ Select nested Button inside Card instance; ⌥⌘B; Card becomes FRAME (record ID change). _M5·P0·[API L11221-11224][SRC:skill gotchas.md]_
- [ ] **CP-067** Detached frames record provenance — `detachedInfo` = local componentId (or library componentKey). _Data:_ `detachedInfo` _Test:_ Detach local and library instance; persist/reload; info kept. _M5·P1·[API L8636-8645, L9393-9396]_
- [ ] **CP-068** Detach unavailable on main components and component sets. _Data:_ — _Test:_ Select main; Detach command disabled. _M5·P1·[SRC:forum 2024 excerpt]_
- [ ] **CP-069** Detach of multi-selection detaches each selected instance in one undo step; undo restores instance links and overrides exactly. _Data:_ undo _Test:_ Detach 3; ⌘Z; overrides lists identical to before. _M5·P1·[KNOW]_
- [ ] **CP-070** Prototype interactions inherited from the main are kept on the detached frame as its own interactions (verify). _Data:_ `reactions` _Test:_ Main has On click → Navigate; detach instance; check interaction (§8 E-31). _M7·P2·[KNOW]_
- [ ] **CP-221** Detach with variable-bound property values — when TEXT/BOOLEAN property values (or defaults) are bound to variables, detaching either moves the binding onto the resulting layer (`characters` / `visible` bound to the same variable) or bakes in the resolved value. Illigma must match Figma. _Data:_ `componentProperties[…].boundVariables.value` → `boundVariables` on the layer _Test:_ Bind Label to the string variable "cta" (modes EN/DE); detach; switch the mode; record whether the text follows (§8 E-13). _M6·P2·[API L11176-11185][KNOW]_

### 6.8 Go to main, push, restore

- [ ] **CP-071** Go to main component selects the main, switching pages if needed, and frames it in the viewport. _Data:_ selection, current page _Test:_ Instance on page 2, main on page 1; command; page 1 active, main selected and visible. _M5·P0·[DOC:360038665934 excerpt]_
- [ ] **CP-072** Return to instance — after Go to main, a temporary control returns to the original page, selection and viewport. _Data:_ transient return target _Test:_ Go to main, edit, click Return to instance. _M5·P1·[DOC:360038665934 excerpt]_
- [ ] **CP-073** Go to main for a nested instance targets the nested instance's own main; for a remote (library) main it opens the library document at the main (local-first: open the library file if available, otherwise show why not). _Data:_ `remote`, library ref _Test:_ Nested icon in button instance → icon main selected. _M5·P1·[DOC:360038665934 excerpt][KNOW]_
- [ ] **CP-074** Push changes to main component — applies the selected instance's direct overrides to its local main; the instance then has no overrides; other instances update except where they override the same fields. _Data:_ main fields, `overrides` _Test:_ Instances I1 (fill override red), I2 (fill override green), I3 none; push from I1; main red, I2 green, I3 red, I1 no overrides. _M5·P0·[DOC:360038665934 excerpt][SRC:forum 13480 excerpt][KNOW for "I1 ends with no overrides"]_
- [ ] **CP-075** Push is disabled when the main is remote (library) or deleted. _Data:_ `remote` _Test:_ Library instance: command disabled. _M5·P0·[DOC:360038665934 excerpt][KNOW for the deleted-main case]_
- [ ] **CP-076** Push of nested overrides (nested swaps, nested property values, nested sublayer overrides) matches Figma. _Data:_ nested overrides _Test:_ §8 E-34. _M5·P1·[KNOW]_
- [ ] **CP-077** Push is a single undo step reverting both main and instance. _Data:_ undo _Test:_ Push, ⌘Z; main and instance back. _M5·P0·[KNOW]_
- [ ] **CP-078** Deleting a main keeps all instances rendering the last definition (soft-deleted main retained in document while referenced, incl. after save/reopen). _Data:_ soft-deleted component, `mainComponent.parent === null` _Test:_ Delete main; instances unchanged; save, reopen; still unchanged. _M5·P0·[API L6324][KNOW]_
- [ ] **CP-079** Restore component — an instance of a deleted main offers "Restore component", which re-creates the main (same ID; original page/parent/position per Figma) and re-links all instances. _Data:_ component id _Test:_ Delete main in frame F on page P; restore from instance on other page; record placement (§8 E-14). _M5·P0·[SRC:codefinity excerpt][KNOW]_
- [ ] **CP-080** Deleted variant — instances of a deleted variant behave as CP-078/079; restoring a variant puts it back in its set when the set exists (verify). _Data:_ set membership _Test:_ §8 E-14. _M5·P1·[KNOW]_
- [ ] **CP-081** Go to main unavailable for deleted mains (Restore offered instead); no option for orphans without recoverable definition. _Data:_ — _Test:_ Context menu on such instance. _M5·P1·[SRC:forum 23676 excerpt][KNOW]_

### 6.9 Nested & exposed instances

- [ ] **CP-082** Nested instances keep their own link — editing the inner main updates the outer main and all outer instances (transitive propagation). _Data:_ dependency graph _Test:_ Icon → Button → Card; change Icon color; all Card instances update. _M5·P0·[KNOW]_
- [ ] **CP-083** Overrides authored on a nested instance inside an outer main are inherited by every outer instance and are not in their `overrides`. _Data:_ inherited overrides _Test:_ In Card main, set nested Button label "Buy"; Card instances show "Buy"; their overrides empty. _M5·P0·[API L11243]_
- [ ] **CP-084** Deep-selecting a nested instance inside an instance shows its own instance panel (properties, swap, reset) and edits are stored as overrides of the outer instance. _Data:_ outer `overrides` with nested sublayer ids _Test:_ ⌘-click nested Button in Card instance; set BOOLEAN; check Card instance overrides. _M5·P0·[KNOW]_
- [ ] **CP-085** Expose nested instances — author selects nested instances in the main/set; in outer instances their component properties appear in the top-level property panel under the nested instance's name. _Data:_ `isExposedInstance`, `exposedInstances` _Test:_ Expose Button in Card; Card instance panel shows "Button" group with its Label/Icon properties; editing changes nested Button. _M5·P0·[API L11234-11241][SRC:uxplanet excerpt] (DOC:8883757553943 title only — not evidence)_
- [ ] **CP-086** `isExposedInstance` editable only on primary nested instances (direct descendants of a COMPONENT/COMPONENT_SET, not inside another instance); inherited by deeper copies. _Data:_ `isExposedInstance` _Test:_ Try to expose an instance nested two levels deep; control unavailable. _M5·P1·[API L11238-11241]_
- [ ] **CP-087** Exposed instances in a set — exposure is per variant layer; instance panel shows exposed groups for the current variant only (verify). _Data:_ per-variant exposure _Test:_ Expose in variant A only; switch instance A→B; group disappears (§8 E-15). _M5·P1·[KNOW]_
- [ ] **CP-088** Exposure after swapping the exposed nested instance matches Figma (community reports loss). _Data:_ `exposedInstances` _Test:_ §8 E-15. _M5·P2·[SRC:forum 54180]_
- [ ] **CP-089** Multi-level exposure — an exposed nested instance's own exposed instances also surface (transitively) per Figma. _Data:_ `exposedInstances` _Test:_ §8 E-15. _M5·P2·[KNOW]_
- [ ] **CP-090** "Simplify instances" option reproduced exactly (effect on instance panel/layers), or explicitly marked unsupported until verified. _Data:_ not in typings (Illigma-internal flag) _Test:_ §8 E-16. _M5·P2·[SRC:forum 86885 title][KNOW]_

### 6.10 Variants & component sets

- [ ] **CP-091** Combine as variants — ≥2 selected components (none already in a set) become variants of a new COMPONENT_SET placed at their former location; set bounds enclose them. _Data:_ `combineAsVariants` _Test:_ Select 3 components, combine; set contains 3 variants; positions preserved. _M5·P0·[API L1833-1857][KNOW]_
- [ ] **CP-092** Slash-name parsing — "Button/Primary/Large" etc. → set "Button", properties "Property 1"="Primary", "Property 2"="Large"; all names must have equal slash counts to align. _Data:_ `variantProperties`, `componentPropertyDefinitions` _Test:_ Combine "Button/Primary/Large", "Button/Secondary/Small"; inspect set name, props, values. _M5·P0·[DOC:360056440594 excerpt]_
- [ ] **CP-093** `Prop=Value, Prop2=Value2` names map directly to properties/values on combine. _Data:_ variant layer name grammar _Test:_ Combine "Size=md, Style=primary" + "Size=md, Style=secondary"; props Size, Style. _M5·P0·[SRC:skill component-patterns.md][SRC:stevekinney excerpt]_
- [ ] **CP-094** Unparsable names (no slash/=) get Figma's default property/value naming. _Data:_ variant names _Test:_ Combine "Alpha", "Beta"; record names in Figma (§8 E-17). _M5·P1·[KNOW]_
- [ ] **CP-095** Set name derivation when components have different first segments matches Figma. _Data:_ set `name` _Test:_ Combine "A/x" and "B/y"; record set name (§8 E-17). _M5·P2·[KNOW]_
- [ ] **CP-096** Component sets contain only components — dropping/pasting text, frames, groups or instances into a set is refused (or lands outside). _Data:_ set children types _Test:_ Drag a text layer into set; refused. _M5·P0·[DOC:360056440594 excerpt]_
- [ ] **CP-097** Moving a standalone component into a set makes it a variant (values from its name); moving a variant out makes it a standalone component; result matches Figma. _Data:_ parent, `variantProperties` _Test:_ §8 E-19. _M5·P1·[KNOW]_
- [ ] **CP-098** Empty sets cannot exist — deleting the last variant removes the set (or Figma's behavior). _Data:_ — _Test:_ Delete variants one by one. _M5·P1·[API L1849][KNOW]_
- [ ] **CP-099** Add variant — the set's "+" affordance / Add variant duplicates an existing variant (selected or last), positions it adjacent and assigns non-conflicting values per Figma. _Data:_ new variant name _Test:_ Click "+" on 2×2 matrix set; record new variant position and values (§8 E-19). _M5·P0·[KNOW]_
- [ ] **CP-100** Add variant on a non-variant component converts it into a set with two variants (original + new). _Data:_ set creation _Test:_ Select plain component, Add variant. _M5·P1·[KNOW]_
- [ ] **CP-101** Duplicating a variant inside its set (⌘D) creates a new variant (component), not an instance, with values made unique or flagged as conflict per Figma. _Data:_ — _Test:_ §8 E-19. _M5·P1·[KNOW]_
- [ ] **CP-102** Variant layer name ↔ values sync — editing values in the inspector rewrites the layer name `A=x, B=y`; editing the layer name updates values (adding new values to the property). _Data:_ `name`, `variantProperties` _Test:_ Rename layer to "Size=xl, State=Default"; property Size gains "xl". _M5·P0·[KNOW][SRC:skill component-patterns.md]_
- [ ] **CP-103** Add a variant property to a set — every variant receives a value (Figma default) and instances keep resolving. _Data:_ `variantOptions` _Test:_ Add property "Theme"; record default value in each variant (§8 E-20). _M5·P0·[KNOW]_
- [ ] **CP-104** Rename a variant property — renames on all variants; instances keep their current variant. _Data:_ property name _Test:_ Rename "Property 1"→"Style"; instance panel label updates, variant unchanged. _M5·P0·[KNOW]_
- [ ] **CP-105** Rename a variant value — renames on all variants having it; instances using it keep their variant. _Data:_ `variantOptions` _Test:_ Rename "Primary"→"Brand". _M5·P0·[KNOW]_
- [ ] **CP-106** Delete a variant property — removed from all variant names; resulting duplicate combinations become conflicts. _Data:_ — _Test:_ Delete "State" where two variants differ only by State; both show conflict. _M5·P1·[KNOW]_
- [ ] **CP-107** Conflict detection — variants with identical value combinations show "The properties and values of this variant are conflicting…" on the affected variants, regardless of visual difference; resolves as soon as values differ. _Data:_ derived conflict state _Test:_ Duplicate variant names; warning appears on both; rename one; warning gone. _M5·P0·[DOC:360056440594 excerpt][SRC:forum 51633]_
- [ ] **CP-108** Sparse matrices allowed — not every combination must exist; no warning for missing combinations. _Data:_ — _Test:_ 2 props × 2 values with 3 variants; no warning; record how the missing combination appears in the instance picker (Figma skill: "blank gaps") (§8 E-22). _M5·P0·[DOC:360056440594 excerpt][SRC:skill component-patterns.md]_
- [ ] **CP-109** Default variant is the top-left-most variant spatially (tie-break per Figma) and updates when variants move. _Data:_ `defaultVariant` _Test:_ Move variants; check which one Assets inserts (§8 E-18). _M5·P0·[API L11127-11129]_
- [ ] **CP-110** Component set behaves as a frame — fills, strokes, radius, clip, auto layout (incl. wrap) can arrange variants; resizing the set doesn't scale variants. _Data:_ `BaseFrameMixin` _Test:_ Apply vertical auto layout gap 20 to a set; variants reflow. _M5·P1·[API L11117][KNOW]_
- [ ] **CP-111** Cloning/duplicating a whole set (outside it) creates a new set with new components and no instances. _Data:_ `ComponentSetNode.clone` _Test:_ ⌘D the set; new set IDs; instances still point to original (UI behavior to verify vs instance-of-set). _M5·P1·[API L11121-11125][KNOW]_
- [ ] **CP-112** Property definitions live on the set — variants expose `variantProperties` but cannot own non-variant property definitions. _Data:_ `componentPropertyDefinitions` owner _Test:_ Select a variant; Properties panel edits set-level properties. _M5·P0·[SRC:skill gotchas.md][API L9612-9658]_
- [ ] **CP-222** Combine as variants merges existing properties — BOOLEAN, TEXT, INSTANCE_SWAP and SLOT properties defined on the combined components become set-level definitions. Layer references and existing instance values are preserved. Same-named properties merge or stay separate exactly as in Figma. _Data:_ set `componentPropertyDefinitions`, sublayer `componentPropertyReferences` _Test:_ Two components each have a TEXT property "Label" that is referenced, plus instances with values; combine; record the number of TEXT properties on the set and the instance values (§8 E-41). _M5·P0·[SRC:skill component-patterns.md "the component set inherits all properties from its children"][KNOW]_
- [ ] **CP-223** Availability of Combine as variants — offered only when every selected node is a component that is not already in a set (frames throw in the API). Record whether a single selected component offers it or only offers "Add variant", and the result for mixed selections (component plus frame, instance, or variant from another set). _Data:_ `combineAsVariants(nodes)` (non-empty, components only) _Test:_ Try the 5 selection cases; Illigma enables or disables the command identically (§8 E-41). _M5·P0·[API L1833-1857][KNOW]_
- [ ] **CP-224** Placement and default styling of a UI-created set — the set is inserted into the components' common parent at Figma's z-index, wraps the variants, and gets Figma's default stroke, radius and padding as **document data** (if E-41 confirms they are not editor chrome). _Data:_ set `strokes`, `dashPattern`, `cornerRadius`, child offsets, parent index _Test:_ Combine 3 components that sit inside a frame; record the set's index, stroke, dash, radius and variant offsets (§8 E-41). _M5·P1·[API L1838-1846 (API default: appended topmost)][KNOW]_
- [ ] **CP-225** Variant naming rules — reproduce Figma for each of these:
  - VARIANT property names must be unique within a set;
  - names or values that contain `=` or `,`;
  - spaces around separators;
  - case (`Size` vs `size`);
  - empty values.

  _Data:_ variant layer-name grammar, `variantOptions` _Test:_ §8 E-37. Type each edge case in the property panel and in the layer name; record whether it is accepted, rejected or sanitized. _M5·P1·[KNOW]_
- [ ] **CP-226** Variant layer name that omits or adds a property — renaming a variant layer so that it drops an existing property (or adds an unknown one) gives Figma's result: a blank value, a new property for all variants, or a conflict. _Data:_ `variantProperties`, `componentPropertyDefinitions` _Test:_ In a Size×State set, rename one variant to "Size=sm"; then to "Size=sm, State=x, Theme=dark"; record the definitions and warnings (§8 E-37). _M5·P1·[KNOW]_
- [ ] **CP-227** Deleting a whole component set — instances of every variant keep rendering their soft-deleted definitions. Restore from any of them restores the set (whole set vs that one variant, as Figma does). One undo restores the set with its IDs. _Data:_ soft-deleted `COMPONENT_SET` and children _Test:_ Delete a 4-variant set that has instances of 2 variants; restore from one; record which variants come back (§8 E-14). _M5·P1·[API L6324][KNOW]_

### 6.11 Switching variants on instances

- [ ] **CP-113** Variant dropdown per VARIANT property on instances lists `variantOptions` in property order; selecting a value with an existing exact combination swaps to that variant. _Data:_ `componentProperties[prop].value` _Test:_ Size × State set; change Size; instance becomes matching variant. _M5·P0·[API L11176-11216][KNOW]_
- [ ] **CP-114** Missing combination fallback — selecting a value whose exact combination doesn't exist picks the variant Figma picks (hypothesis: max matching other values; tie-break by layer order). _Data:_ resolver _Test:_ §8 E-22. _M5·P0·[KNOW]_
- [ ] **CP-115** Variant switch preserves overrides when layer names match and the overridden property originally matched between the two variants; text preserved by name with looser hierarchy check. _Data:_ swap heuristic _Test:_ Default/Hover variants with same "Label" layer; override label text + label color (same in both mains) + bg fill (differs between mains); switch; text and label color kept, bg override dropped. _M5·P0·[SRC:forum 14757 quoting DOC:360039150413][KNOW for the "originally matched" rule — §8 E-12]_
- [ ] **CP-116** Variant switch preserves BOOLEAN/TEXT/INSTANCE_SWAP/SLOT property values (property identity is set-level). _Data:_ `componentProperties` _Test:_ Set Label="Pay", Show icon=false; switch Size; values persist. _M5·P0·[KNOW]_
- [ ] **CP-117** True/false-like variant values render as a toggle in the instance panel (verify value set: true/false, yes/no, on/off). _Data:_ `variantOptions` _Test:_ §8 E-21. _M5·P1·[KNOW]_
- [ ] **CP-118** Variant switch keeps instance placement and applies size rules as in CP-057. _Data:_ — _Test:_ Switch Size=sm→lg in auto layout row; row reflows. _M5·P0·[KNOW]_
- [ ] **CP-119** Multi-selection variant change — selecting several instances of the same set and changing a VARIANT value applies to all (mixed shown when values differ). _Data:_ — _Test:_ 3 instances different sizes; panel shows Mixed; choose Large; all Large. _M5·P1·[KNOW]_
- [ ] **CP-228** Multi-selection of instances from different variants, sets or components — the instance panel shows exactly Figma's control set: shared VARIANT/BOOLEAN/TEXT controls with Mixed values for different variants of one set, and only the swap control (or nothing) for unrelated mains. Edits apply to all selected instances in one undo step. _Data:_ — _Test:_ Select (a) 2 variants of one set, (b) instances of 2 sets with the same property names, (c) instances of unrelated components; record the panel each time (§8 E-42). _M5·P1·[KNOW]_

### 6.12 Component properties — general

- [ ] **CP-120** Create property — "+" in the Properties section of a main/set offers Variant, Boolean, Text, Instance swap, Slot; requires name and default value (where applicable). _Data:_ `addComponentProperty(name, type, defaultValue, options)` _Test:_ Create one of each; definitions match typings shape. _M5·P0·[DOC:5579474826519 excerpt][API L9671-9680]_
- [ ] **CP-121** Property identity suffix — BOOLEAN/TEXT/INSTANCE_SWAP/SLOT properties get a stable unique `#id`; display names may repeat; VARIANT names are plain and unique among variant properties. _Data:_ property keys _Test:_ Create two TEXT properties both named "Label"; both exist, distinct keys. _M5·P0·[API L9661][SRC:skill component-patterns.md]_
- [ ] **CP-122** Edit property — rename (all types), default value (BOOLEAN/TEXT/INSTANCE_SWAP), preferred values (INSTANCE_SWAP/SLOT), description & slot settings (SLOT). _Data:_ `editComponentProperty` _Test:_ Edit each field; VARIANT default not editable. _M5·P0·[API L9681-9700]_
- [ ] **CP-123** Rename keeps instance values — renaming a property's display name keeps all instance values. _Data:_ key suffix _Test:_ Instances with Label="Pay"; rename "Label"→"Text"; values kept. _M5·P0·[KNOW]_
- [ ] **CP-124** Delete property — removes it from definitions and all references; referencing layers fall back to main values; instance values discarded; undo restores everything. _Data:_ `deleteComponentProperty` _Test:_ Delete BOOLEAN with instances set false; hidden layers reappear; ⌘Z. _M5·P0·[API L9702-9706][KNOW]_
- [ ] **CP-125** Default change propagates to instances without an explicit value only. _Data:_ default vs instance value _Test:_ Change TEXT default; instances with custom value unchanged. _M5·P0·[KNOW]_
- [ ] **CP-126** Reference cardinality — one field references ≤1 property; one property can be applied to many layers (incl. across variants). _Data:_ `componentPropertyReferences` _Test:_ Apply one BOOLEAN to 3 layers; toggle hides all 3. _M5·P0·[API L6631-6635][SRC:skill wwds-components.md]_
- [ ] **CP-127** Valid reference targets only — BOOLEAN→any sublayer `visible`; TEXT→text `characters`; INSTANCE_SWAP→instance `mainComponent`; SLOT→eligible frame; never on the component's top-level node. _Data:_ reference rules _Test:_ Apply-property controls appear only on valid targets. _M5·P0·[API L6624-6635][DOC:38231200344599 excerpt]_
- [ ] **CP-128** Instance properties shown in one section in definition order; unreferenced properties still listed (no effect). _Data:_ order _Test:_ Reorder properties in main (drag); instance panel order follows (§8 E-23). _M5·P1·[DOC:5579474826519 excerpt][KNOW]_
- [ ] **CP-129** Name collision VARIANT vs non-variant — VARIANT wins in `componentProperties`/`setProperties`. _Data:_ — _Test:_ Scripted: VARIANT "Size" + TEXT "Size#1:2"; `setProperties({Size})` changes variant. _M5·P2·[API L11213-11218]_
- [ ] **CP-130** Variable binding — instance values and definition defaults of BOOLEAN (boolean variable) and TEXT (string variable) can be bound to variables; resolved per mode. _Data:_ `boundVariables.value`, `boundVariables.defaultValue` _Test:_ Bind Label to string variable with modes EN/DE; instance text follows mode. _M6·P1·[API L6954-6955, L2240-2252][KNOW]_
- [ ] **CP-131** Multi-selection of instances shows common property controls with mixed state; nested-instance properties in multi-selection follow Figma. _Data:_ — _Test:_ Select 2 instances of same main; set BOOLEAN; both change; record nested behavior. _M5·P1·[SRC:forum 27022][KNOW]_
- [ ] **CP-132** Properties survive save/reopen and copy/paste between documents (definitions, references, values, bindings). _Data:_ persistence _Test:_ Round-trip file; diff definitions. _M5·P0·[KNOW]_
- [ ] **CP-229** Unlink a property from a layer — removing a layer's property reference keeps the property definition and makes the layer show its main value. Instance values for that property no longer affect the layer. Undo restores the link and the instance values. _Data:_ `componentPropertyReferences` key removed _Test:_ An instance has Label="Pay"; in the main, unlink TEXT from the label layer; the instance shows the main text; ⌘Z. _M5·P1·[API L6624-6635][KNOW for UI control]_
- [ ] **CP-230** Closed set of property types — the Create-property menu offers exactly Variant, Boolean, Text, Instance swap and Slot. There are no number, color or image component properties (those types exist only for shaders). _Data:_ `ComponentPropertyType` _Test:_ Open the "+" menu in Properties; it lists exactly 5 types. _M5·P0·[API L11078][API L4941-4955]_
- [ ] **CP-231** Variable binding of VARIANT values on instances — if Figma's UI allows binding a variant property value to a (string/boolean) variable, Illigma supports it with per-mode resolution: switching modes switches the variant. If Figma does not allow it, Illigma does not either. _Data:_ `componentProperties[prop].boundVariables.value`, `setProperties({prop: VariableAlias})` _Test:_ §8 E-43. _M6·P1·[API L11176-11185, L11213-11216][KNOW]_

### 6.13 BOOLEAN properties

- [ ] **CP-133** Create BOOLEAN from a layer's visibility via the Apply property control in the Layer/Appearance section; default = current visibility. _Data:_ `type: 'BOOLEAN'`, `visible` reference _Test:_ Select hidden icon in main → Apply property → new property default false. _M5·P0·[DOC:5579474826519 excerpt][KNOW]_
- [ ] **CP-134** Toggling a BOOLEAN on an instance shows/hides all referencing layers; auto layout reflows (hidden layers take no space). _Data:_ `componentProperties[...].value` _Test:_ Toggle "Show icon" off on hug button; width shrinks by icon+gap. _M5·P0·[KNOW]_
- [ ] **CP-135** BOOLEANs control only visibility (no other field binding). _Data:_ reference keys _Test:_ No apply-property affordance on other fields for booleans. _M5·P1·[DOC:5579474826519 excerpt]_
- [ ] **CP-136** Manual eye toggle on a BOOLEAN-bound sublayer in an instance behaves as in Figma (changes property value vs creates visibility override). _Data:_ `visible` _Test:_ §8 E-24. _M5·P1·[KNOW]_

### 6.14 TEXT properties

- [ ] **CP-137** Create TEXT property from a text layer; default = the layer's current characters; reference `characters`. _Data:_ `type: 'TEXT'` _Test:_ Text "Button" → property default "Button". _M5·P0·[API][DOC:5579474826519 excerpt][KNOW]_
- [ ] **CP-138** Instance text field and on-canvas editing are the same value (editing either updates the other; no separate characters override). _Data:_ `componentProperties` _Test:_ Edit on canvas → panel shows new text; reset property → original. _M5·P0·[SRC:skill component-patterns.md][KNOW]_
- [ ] **CP-139** One TEXT property may drive several text layers (all update together). _Data:_ references _Test:_ Apply one TEXT to 2 text layers; change value; both change. _M5·P1·[SRC:skill wwds-components.md]_
- [ ] **CP-140** Text styling of a TEXT-bound layer remains separately overridable and survives value changes. _Data:_ style overrides _Test:_ Override color, then change value; color kept (§8 E-25). _M5·P1·[KNOW]_

### 6.15 INSTANCE_SWAP properties & preferred values

- [ ] **CP-141** Create INSTANCE_SWAP on a nested instance; default = that instance's current main; default can be any local or library component. _Data:_ `type: 'INSTANCE_SWAP'`, `defaultValue` = component id _Test:_ Icon instance in button → property default = that icon. _M5·P0·[DOC:5579474826519 excerpt][API]_
- [ ] **CP-142** Preferred values — author picks components and/or component sets; instance picker lists them first; any other component remains selectable. _Data:_ `preferredValues: {type, key}[]` _Test:_ Set 3 preferred icons; picker shows them in a preferred group; search still finds others. _M5·P0·[API L11082-11085][DOC:5579474826519 excerpt][KNOW]_
- [ ] **CP-143** Preferred component set entries let the user pick the set then a variant. _Data:_ `type: 'COMPONENT_SET'` _Test:_ Preferred = Icon set; choosing it inserts default variant with variant dropdown. _M5·P1·[API L11082-11085][KNOW]_
- [ ] **CP-144** Changing an INSTANCE_SWAP value swaps the referenced nested instance(s) using swap override preservation. _Data:_ swap heuristic _Test:_ Override icon color, change property to another icon with same layer names; record (§8 E-26). _M5·P1·[KNOW]_
- [ ] **CP-145** BOOLEAN + INSTANCE_SWAP on the same nested instance work independently ("Show icon" + "Icon"). _Data:_ `{visible, mainComponent}` references _Test:_ Hide icon, change icon, show; new icon shown. _M5·P0·[SRC:skill component-patterns.md]_

### 6.16 VARIANT properties (definition side)

- [ ] **CP-146** VARIANT definitions expose `variantOptions` and a derived default (from default variant) that cannot be edited directly. _Data:_ `variantOptions`, `defaultValue` _Test:_ Move a different variant to top-left; default value changes accordingly (§8 E-18). _M5·P1·[API L9683-9690][KNOW]_
- [ ] **CP-147** Deleting a VARIANT property from the UI behaves as Figma (allowed with name rewrite vs not allowed). _Data:_ — _Test:_ §8 E-27. _M5·P1·[API L9702][KNOW]_
- [ ] **CP-148** Reordering variant values (dropdown order) matches Figma's available controls and storage. _Data:_ `variantOptions` order _Test:_ §8 E-23. _M5·P2·[KNOW]_

### 6.17 Slots

- [ ] **CP-149** Convert to slot — on a frame nested in a main: context menu, sidebar button, ⌘⇧S/Ctrl+Shift+S; user picks an existing SLOT property or creates one; frame becomes `SLOT`. _Data:_ `type: 'SLOT'`, SLOT property, `componentPropertyReferences.slotContentId` (verify key) _Test:_ Convert "Content" frame; layer type SLOT; property "Content" created. _M5·P0·[DOC:38231200344599 excerpt][SRC:skill component-patterns.md]_
- [ ] **CP-150** Wrap in slot — selected layers in a main are wrapped in a new slot frame + new SLOT property; wrapped layers become the slot's default content. _Data:_ slot children _Test:_ Select 2 text layers, wrap; slot contains both. _M5·P0·[DOC:38231200344599 excerpt]_
- [ ] **CP-151** Create SLOT property first, then assign frames via Convert to slot dropdown (same property usable on slots in several variants of a set). _Data:_ property reuse _Test:_ Set with 2 variants; assign one SLOT property to a frame in each. _M5·P1·[DOC:38231200344599 excerpt]_
- [ ] **CP-152** Slot eligibility — only inside components; not the component's top-level node; must be a FRAME; not GRID; not nested inside another slot; invalid targets give Figma's errors/disabled UI. _Data:_ `cannotApplySlotPropertyToNonFrameNode`, `cannotApplySlotPropertyToFrameWithGrid`, `cannotApplySlotPropertyToFrame`, `cannotApplyGridToSlot` _Test:_ Try each invalid case. _M5·P0·[API L6626, L7648][DOC:38231200344599 excerpt][SRC:skill component-patterns.md]_
- [ ] **CP-153** Setting a slot frame's layout to GRID is refused. _Data:_ `layoutMode` _Test:_ Select slot → grid option disabled/refused. _M5·P0·[API L7648]_
- [ ] **CP-154** Instance slot editing — in an instance, users can insert (draw, paste, drag from Assets), delete, reorder and edit any children inside the slot; everything outside slots stays structurally locked. _Data:_ instance-owned slot children _Test:_ Paste a frame and an instance into a card's slot; reorder; delete default child. _M5·P0·[DOC:38741465279895 excerpt][SRC:skill component-patterns.md]_
- [ ] **CP-155** Slot insert restrictions — main components, widgets and stickies cannot be inserted into a slot (pasting a main inserts an instance or is refused per Figma). _Data:_ — _Test:_ Paste a main into slot; record (§8 E-28). _M5·P1·[SRC:skill component-patterns.md]_
- [ ] **CP-156** Default slot content — content placed in the main's slot appears in instances until the instance's slot is modified. _Data:_ slot default children _Test:_ Main slot has placeholder text; new instance shows it. _M5·P0·[API L11270-11273][KNOW]_
- [ ] **CP-157** Main slot default content edits propagate to instances whose slot content is unmodified; modified slots keep their content (verify granularity). _Data:_ slot override state _Test:_ §8 E-28. _M5·P1·[KNOW]_
- [ ] **CP-158** Reset slot restores the original component slot content and is one undo step. _Data:_ `resetSlot()` _Test:_ Modify slot, reset; content equals main default (§8 E-28). _M5·P0·[API L11270-11273]_
- [ ] **CP-159** Slot settings editor — name, description, min/max layer counts (optional, default none), preferred instances, only allow preferred, display empty by default, fill container by default. _Data:_ `SlotSettings`, `description`, `preferredValues` _Test:_ Set each; persisted in definition. _M5·P0·[DOC:38231200344599 excerpt][API L11086-11092]_
- [ ] **CP-160** Limit violations are non-blocking — exceeding max, going below min, or adding non-preferred content succeeds and is reported (`BELOW_MIN` xor `ABOVE_MAX`, plus independent `HAS_NON_PREFERRED`) with Figma's warning UI. _Data:_ `limitViolations` _Test:_ max 3; insert 4 children; insert allowed, warning shown; remove one; warning cleared. _M5·P0·[API L11275-11280][SRC:changelog excerpt]_
- [ ] **CP-161** stretchChildOnInsert — inserting a layer into a slot with "fill container by default" sets the layer's counter-axis sizing to Fill. _Data:_ `stretchChildOnInsert`, `layoutSizingHorizontal/Vertical` _Test:_ Vertical slot; insert 120px-wide frame; becomes Fill width. _M5·P1·[SRC:changelog excerpt][DOC:38231200344599 excerpt]_
- [ ] **CP-162** displayEmptyByDefault — empty slots in instances always show the slot highlight when enabled; otherwise highlight only on hover/selection (verify). _Data:_ `displayEmptyByDefault` _Test:_ Empty slot in instance with flag on/off. _M5·P1·[SRC:changelog excerpt]_
- [ ] **CP-163** Slot values are content, not settable through property controls/`setProperties` (scripting throws `cannotSetSlotProperty`). _Data:_ — _Test:_ Scripting API call returns that error. _M5·P2·[API L11214]_
- [ ] **CP-164** Copying a slot (from main or instance) and pasting outside a component yields a plain FRAME. _Data:_ `SlotNode.clone(): FrameNode` _Test:_ Copy slot, paste on canvas; type FRAME. _M5·P1·[API L11264-11268]_
- [ ] **CP-165** Variant switch with slots — slot content is preserved when the target variant has a slot bound to the same SLOT property; otherwise behavior per Figma. _Data:_ slot property identity _Test:_ §8 E-28. _M5·P1·[KNOW]_
- [ ] **CP-166** Detaching an instance turns its slot into a normal frame with the current content. _Data:_ — _Test:_ Detach card with custom slot content. _M5·P1·[KNOW]_
- [ ] **CP-167** Multiple slots per component, each with its own SLOT property. _Data:_ definitions _Test:_ Card with Header and Content slots; two SLOT properties. _M5·P1·[SRC:skill component-patterns.md]_
- [ ] **CP-168** Properties of instances placed in a slot are not surfaced on the outer instance (match Figma unless verified otherwise). _Data:_ — _Test:_ Button inside card's slot; card panel shows no Button properties. _M5·P2·[SRC:forum 51891]_
- [ ] **CP-232** Meaning of "preferred" for `allowPreferredValuesOnly` — with the flag on, a slot child counts as preferred only if it is an instance of a preferred component, or of a variant of a preferred set (verify). Any other child (frame, text, non-preferred instance) adds `HAS_NON_PREFERRED` without blocking the edit. _Data:_ `slotSettings.allowPreferredValuesOnly`, `preferredValues`, `limitViolations` _Test:_ Preferred = the Icon set. Insert an Icon variant (expect no violation), then a text layer (expect HAS_NON_PREFERRED), then delete the text (violation cleared) (§8 E-44). _M5·P0·[API L11275-11280][KNOW for the variant-of-preferred-set rule]_
- [ ] **CP-233** Inserting preferred content into an instance slot — the empty slot's insert affordance lists preferred instances first. Choosing one inserts an instance and applies `stretchChildOnInsert`. _Data:_ `preferredValues`, `stretchChildOnInsert` _Test:_ §8 E-44 (record the affordance, list order and placement). _M5·P1·[DOC:38231200344599 excerpt (preferred instances setting)][KNOW for UI]_
- [ ] **CP-234** Converting a frame that has children into a slot — the existing children become the slot's default content in every instance. _Data:_ `SLOT.children` in the main _Test:_ A frame with 2 text layers → Convert to slot; a new instance shows both texts; Reset slot restores them (§8 E-44). _M5·P0·[KNOW]_
- [ ] **CP-235** Deleting a SLOT property — the bound slot nodes and the custom content inside instance slots end up exactly as in Figma (slot reverts to a frame, content is discarded, or content is kept). One undo restores definition, slot nodes and every instance's content. _Data:_ `deleteComponentProperty` (supports SLOT) _Test:_ 2 instances with custom slot content; delete the SLOT property in the main; record the types and content; ⌘Z (§8 E-44). _M5·P0·[API L9702-9706][KNOW]_
- [ ] **CP-236** Slot depth — whether a slot may sit at any depth inside the component (e.g. inside a nested auto layout frame) or only as a direct child, as Figma allows. Invalid targets are refused with Figma's feedback. _Data:_ `componentPropertyReferences.slotContentId` on a descendant frame _Test:_ Try to convert a frame 2 levels deep inside the main (§8 E-44). _M5·P1·[SRC:skill component-patterns.md ("must be a direct child")][KNOW]_
- [ ] **CP-237** The slot frame's own properties in instances — fill, stroke, padding, gap, alignment and size of the slot frame itself are overridable or blocked exactly as in Figma, independently of its content. _Data:_ slot frame fields in `overrides` _Test:_ In an instance, change the slot's padding and fill; record the result and the Reset menu (§8 E-44). _M5·P1·[KNOW]_
- [ ] **CP-238** Slots of nested instances — when component A (which has a slot) is nested in component B, outer B instances can or cannot edit A's slot exactly as in Figma. Content placed in A's slot inside B's main is inherited by B instances. _Data:_ nested slot content _Test:_ §8 E-44. _M5·P1·[KNOW]_
- [ ] **CP-239** REST/.fig interop for slots — the REST spec v0.44.0 has no SLOT node or property type. Illigma's importers must not silently drop slot nodes, SLOT definitions or slot content. Any export to a slot-unaware format must warn the user. _Data:_ `SLOT` node, `ComponentPropertyType` (REST lacks SLOT) _Test:_ Import a Figma file that uses slots; diff against plugin-API JSON of the same file. _M8·P1·[REST L2410][API L11078, L11259-11283]_

### 6.18 Descriptions & documentation

- [ ] **CP-169** Description editing on components and component sets (rich text, stored as plain + markdown) — not available on instances/frames. _Data:_ `description`, `descriptionMarkdown` _Test:_ Add bold+link description; reopen; preserved; instance panel has no editable description. _M5·P1·[API L9306-9324][SRC:skill wwds-components.md]_
- [ ] **CP-170** Documentation link — one URL per component/set; clearing removes it; shown as a link where Figma shows it. _Data:_ `documentationLinks` _Test:_ Set link; visible on instance info (§8 E-30). _M5·P1·[API L9325-9342]_
- [ ] **CP-171** Description surfaces — shown in Assets panel (hover/info), on instance selection and in search per Figma; set description used for variants. _Data:_ — _Test:_ §8 E-30. _M5·P2·[SRC:skill wwds-components.md][KNOW]_

### 6.19 Resizing, constraints, scale

- [ ] **CP-172** Resizing an instance reflows children per the main's constraints (left/right/center/scale/left-right) and auto layout settings. _Data:_ `constraints` (main) _Test:_ Main 100 wide, child Right-constrained at x=80; resize instance to 200; child at x=180. _M5·P0·[KNOW]_
- [ ] **CP-173** Instance-level placement properties (x, y, rotation, its constraints in its parent, layout-child sizing, absolute positioning) are the instance's own, never overrides. _Data:_ — _Test:_ Change them; `overrides` stays empty. _M5·P0·[KNOW]_
- [ ] **CP-174** Scale tool (K) on an instance stores `scaleFactor` and scales strokes/text/effects/radii proportionally; regular resize keeps `scaleFactor = 1`. _Data:_ `scaleFactor` _Test:_ K-scale instance 2×; scaleFactor 2; text size visually doubled. _M5·P1·[API L11226-11233][KNOW for proportional scaling of strokes/effects/radii]_
- [ ] **CP-175** Min/max width/height defined on the main apply to instances; overridability on instances per Figma. _Data:_ `minWidth`, `maxWidth` _Test:_ Main minWidth 80; resize instance to 50 → clamps (§8 E-07). _M5·P2·[KNOW]_

### 6.20 Auto layout interplay

- [ ] **CP-176** Hug instances re-layout on any content change (text value, BOOLEAN, swap, slot insert). _Data:_ auto layout _Test:_ Change Label "OK"→"Continue"; hug button widens by text delta. _M5·P0·[KNOW]_
- [ ] **CP-177** Auto layout properties of the instance and its sublayers (gap, padding, alignment, direction, wrap, child sizing) are overridable exactly where Figma allows. _Data:_ `itemSpacing`, `padding*`, `primaryAxisAlignItems`, `layoutMode`, `layoutWrap`, `layoutSizing*` _Test:_ §8 E-07; see CP-217 for the review correction on direction/flow. _M5·P1·[KNOW]_
- [ ] **CP-178** Instance as auto layout child keeps its own Fill/Hug/Fixed and absolute-position settings across swaps and variant switches. _Data:_ `layoutSizingHorizontal`, `layoutPositioning` _Test:_ Fill instance in row; switch variant; still Fill. _M5·P0·[KNOW]_
- [ ] **CP-179** Component sets accept auto layout (incl. wrap/grid) for variant arrangement without affecting variant identity. _Data:_ set `layoutMode` _Test:_ Wrap layout on set with 8 variants. _M5·P2·[API L11117][KNOW]_

### 6.21 Variables & styles in components

- [ ] **CP-180** Explicit variable modes on instances — setting a collection mode on an instance changes resolved values inside it; variants can carry their own explicit modes. _Data:_ `explicitVariableModes`, `setExplicitVariableModeForCollection` _Test:_ Instance set to Dark; bound fills resolve Dark values. _M6·P1·[API L10528-10561][SRC:skill gotchas.md]_
- [ ] **CP-181** Variable bindings from the main propagate; rebinding/unbinding in an instance is an override that reset reverts. _Data:_ `boundVariables` _Test:_ Rebind fill in instance; reset. _M6·P1·[KNOW]_
- [ ] **CP-182** Applying a style to an instance sublayer is an override of the style id. _Data:_ `fillStyleId`, `textStyleId`, `effectStyleId` _Test:_ Apply text style in instance; in overrides; reset. _M6·P1·[API L3751][KNOW]_

### 6.22 Interactive components (prototyping cross-ref)

- [ ] **CP-183** Variant interactions — interactions on a variant may use "Change to" another variant of the same set; in presentation, instances switch variants at runtime. _Data:_ `Reaction.actions[].navigation = 'CHANGE_TO'`, `destinationId` _Test:_ Toggle on/off set with On click → Change to; prototype toggles. _M7·P0·[API L5807][KNOW] (DOC:360061175334 title only; 09-prototyping PR-021 cites an excerpt)_
- [ ] **CP-184** Interactions authored on main components propagate to instances; instance-level interaction edits are overrides (verify). _Data:_ `reactions` _Test:_ §8 E-31. _M7·P1·[KNOW] (DOC:4404380377367 title only — not evidence)_
- [ ] **CP-185** Navigation can reset interactive component state (`resetInteractiveComponents`). _Data:_ `Action.resetInteractiveComponents` _Test:_ Toggle variant, navigate away and back with reset on/off. _M7·P1·[API L5751]_
- [ ] **CP-186** Nested interactive components inside other components respond to their triggers (incl. hover/press) per current Figma behavior. _Data:_ — _Test:_ §8 E-31. _M7·P1·[SRC:forum 12437]_
- [ ] **CP-187** Trigger conflicts (hover variant vs click navigation on same layer) resolve as in Figma. _Data:_ — _Test:_ §8 E-31. _M7·P2·[SRC:forum 1570]_
- [ ] **CP-240** Overrides at runtime for interactive components — when "Change to" switches an instance's variant during presentation, the instance's design-time overrides and property values are kept with the same heuristics as design-time variant switching (CP-115/CP-116), and the closest ancestor instance is the one that switches (09-prototyping). _Data:_ runtime `instanceVariant` state _Test:_ Override a toggle instance's label to "Wi-Fi"; present; click to switch; the label stays "Wi-Fi" if Figma keeps it (§8 E-31). _M7·P1·[KNOW]_

### 6.23 Local publishing & libraries (local-first)

- [ ] **CP-188** Publish status per component/set — UNPUBLISHED / CURRENT / CHANGED derived by diff against the last published snapshot. _Data:_ `getPublishStatusAsync()` _Test:_ Publish; edit main; status CHANGED; publish; CURRENT. _M6·P1·[API L6262, L9351-9355]_
- [ ] **CP-189** Remote components are read-only in consumer documents; instances render from the cached definition even when the library file is unavailable. _Data:_ `remote: true`, cached definition _Test:_ Insert library instance; move library file away; consumer renders unchanged; main not editable. _M6·P0·[API L9343-9346][DOC:360038665934 excerpt]_
- [ ] **CP-190** Library edits reach consumers only after publish + accept update; overrides preserved per propagation rules. _Data:_ snapshot version _Test:_ Edit library main, don't publish → consumer unchanged; publish → "updates available"; accept → updated, overrides kept. _M6·P0·[DOC:360038665934 excerpt][KNOW]_
- [ ] **CP-191** Stable component key across edits/renames/moves; consumer instances stay linked by key. _Data:_ `key` _Test:_ Rename/move main within library; publish; consumer stays linked. _M6·P1·[API L9347-9350][KNOW for link survival on move] (DOC:4404848314647 title only)_
- [ ] **CP-192** Hide from publishing — components/sets can be hidden (incl. `.`/`_` name prefix convention per Figma) and are not offered to consumers. _Data:_ hidden flag _Test:_ Name "_Base"; not listed in consumer Assets (§8 E-35). _M6·P1·[KNOW] (DOC:360039238193 title only)_
- [ ] **CP-193** Push overrides and editing mains are unavailable for remote components; Go to main opens the library document. _Data:_ `remote` _Test:_ Commands disabled/redirect. _M6·P0·[DOC:360038665934 excerpt]_
- [ ] **CP-241** Unpublished or missing library components — when a library component is unpublished or its library file is gone, consumer instances keep rendering from the cache. They are flagged as coming from a missing or unavailable library and can still be detached or swapped. No data is lost. _Data:_ remote-definition cache, `remote: true` _Test:_ Unpublish a component in the library; reopen the consumer; instances unchanged; flag visible; detach works (§8 E-45). _M6·P1·[KNOW] (DOC:360039236853 title only)_
- [ ] **CP-242** Reviewing library updates one component at a time — the consumer can preview each changed component (before/after) and accept all or a subset, matching Figma's current review flow mapped to local files. _Data:_ snapshot versions per component key _Test:_ Change 3 components in the library and publish; in the consumer, accept only 1; the other 2 stay on the old version (§8 E-45). _M6·P1·[KNOW] (DOC:360039234193 title only)_

### 6.24 Clipboard, undo, persistence, export, layers

- [ ] **CP-194** Cross-document paste of a local main or instance follows Figma's semantics (instance of remote/published component vs new local component). _Data:_ clipboard _Test:_ §8 E-32. _M5·P1·[KNOW]_
- [ ] **CP-195** Every component operation is exactly one undo step and redo restores identical IDs, overrides and property values. _Data:_ undo stack _Test:_ Script 20 mixed operations; undo all; document equals start; redo all; equals end. _M5·P0·[KNOW]_
- [ ] **CP-196** File round-trip — components, sets, instances, override maps, property definitions/values/references, exposed flags, slot settings/content, scaleFactor, descriptions/links, detachedInfo, soft-deleted mains and remote caches survive save/open byte-for-byte semantic equality. _Data:_ §2.9 _Test:_ Golden fixture document; save/open/save; semantic diff empty. _M5·P0·[KNOW]_
- [ ] **CP-197** Export of instances renders the resolved appearance (all overrides, property values, slot content) in PNG/JPG/SVG/PDF; export settings on instances honored. _Data:_ `exportSettings` _Test:_ Export overridden instance; pixel-compare with Figma export. _M5·P1·[DOC:360039150733 excerpt][KNOW]_
- [ ] **CP-198** Layers panel shows distinct icons for component, component set, instance and slot; instance children can't be dragged out/reordered; drop targets inside instances only within slots. _Data:_ node types _Test:_ Try drag operations in Layers panel. _M5·P0·[DOC:360039150733 excerpt][KNOW]_
- [ ] **CP-199** Selection — click selects top-level instance; double-click/⌘-click deep-selects; Enter selects first child, Shift+Enter selects parent, consistent with Figma. _Data:_ — _Test:_ Compare selection sequence on nested Card/Button/Icon. _M5·P0·[KNOW]_
- [ ] **CP-200** Composite sublayer identity — instance sublayers have deterministic IDs derived from instance id + main sublayer id path so overrides are stable across sessions. _Data:_ `I<inst>;<sub>` _Test:_ Save/reopen; override keys unchanged (§8 E-01). _M5·P0·[KNOW]_
- [ ] **CP-201** .fig import maps components, sets, instances, overrides, properties and slots to Illigma's model without detaching. _Data:_ import mapper _Test:_ Import Figma test file; compare property definitions and overrides via REST JSON (slots: see CP-239). _M8·P1·[REST L1110-1142][KNOW]_
- [ ] **CP-202** Performance — editing a main with 5,000 instances (incl. nested) re-resolves without blocking input beyond the budget defined by the performance area; hidden instance children can be skipped in traversal. _Data:_ resolver cache, `skipInvisibleInstanceChildren` analogue _Test:_ Stress fixture timing. _M8·P1·[API L81-109][KNOW]_
- [ ] **CP-243** Select all instances of a component — the UI paths that select every instance of a main work exactly as Figma's (verify the path; e.g. an Edit ▸ "Select all with same …" command or an Assets/context-menu action), including the scope (current page vs document). _Data:_ `ComponentNode.getInstancesAsync()` _Test:_ §8 E-46. _M5·P2·[API L11165][KNOW]_

---

## 7. Cross-area dependencies

| Area (other parity docs) | Dependency |
| --- | --- |
| Foundation (M0): document model, IDs, file format, undo | Composite instance-sublayer IDs, soft-deleted nodes, override maps, remote-definition cache; single-step undo of multi-node changes; derived (non-undo) propagation. |
| Canvas, selection, transforms, layers panel (M1) | Deep select into instances, Enter/Shift+Enter, locked structure inside instances, drag/drop refusal, duplicate offset rules, Alt-drag semantics, Scale tool `scaleFactor`. |
| Frames/groups/sections (M1) | Component = frame; create component from frame/group; clip content; sections may contain mains. |
| Fills/strokes/effects/blend/export (M1/M2) | Every paint/effect field must support "override" state and per-field reset; export of instances. |
| Text & typography (M3) | Text overrides incl. range styles; TEXT properties; font loading for instance text. |
| Constraints & auto layout (M4) | Instance resize reflow, hug re-layout on overrides, slot layout (no GRID), stretchChildOnInsert (Fill), auto layout override set. |
| Variables, styles, libraries (M6) | Variable-bound property values/defaults, explicit modes on instances, style overrides, library publish/update, hidden assets, keys. |
| Prototyping (M7) | `CHANGE_TO` variant interactions, interaction inheritance/overrides on instances, reset of interactive components, nested interactive components. |
| Motion / animated components (M7) | Animated components article (not researched here). |
| Clipboard interop, .fig import, performance (M8) | Cross-file paste semantics, REST/.fig mapping of components/overrides, resolver performance. |
| Inspector/UI kit (M0/M1) | Mixed-value controls, property rows, swap picker, popovers; visual styling from Framer. |

---

## 8. Needs live Figma verification

Each experiment: **Setup → Action → Record**. Run in Figma Design (UI3, current release) on macOS and Windows where shortcuts are involved; save the file and screenshots as fixtures.

- **E-01 Sublayer identity.** Setup: main with child "A"; instance; plugin console. Action: read instance sublayer IDs; rename/move A in main. Record: ID format (`I…;…`), whether override keys survive rename/reorder.
- **E-02 Create component from non-frame/group/multi-selection.** Setup: rect with 4px outside stroke and shadow; text; vector; group of two rects; 3 overlapping siblings in a frame. Action: ⌥⌘K on each; also "Create multiple components". Record: wrapper bounds (geometric vs visual), child offsets, group kept/dissolved, insertion z-index, default names.
- **E-03 Un-componentize.** Setup: main component. Action: open context menu, Actions (⌘K) search "frame", "remove component". Record: any command converting a main to a frame.
- **E-04 Duplicate frame with main inside.** Action: ⌘D frame and ⌘C/⌘V frame (same file). Record: child type in copy.
- **E-05 Instance naming.** Action: insert plain component and set variant; rename main/set; rename one instance. Record: default names and propagation.
- **E-06 Nesting/cycles.** Action: drag main A into main B; drag main A into instance of B; insert instance of A into A; set INSTANCE_SWAP of A to A. Record: refusal messages or conversions.
- **E-07 Overridable field matrix.** Setup: main with frame (auto layout, radius 8, opacity 80%, dashed stroke, min width), text, vector. Action: in an instance try to change each field incl. x/y, w/h of sublayers, constraints, layout direction, gap, padding, alignment, wrap, child sizing hug/fill/fixed, absolute position, corner radius, opacity, blend mode, dash, locked, mask, boolean op type, vector points. Record: allowed / blocked / UI state, and which appear in Reset ▸ list.
- **E-08 Precedence property vs override.** Action: TEXT-bound text: edit via panel, then via canvas; BOOLEAN-bound layer: toggle eye. Record: whether separate overrides appear in Reset menu.
- **E-09 Value equal to main.** Action: change fill red→blue→red. Record: override present?
- **E-10 Reset menus.** Action: create overrides of 8 kinds incl. nested swap and property values; open Reset submenu on top-level and nested layers; run each item. Record: exact labels, grouping, what "Reset all changes" clears at each level.
- **E-11 Size overrides.** Action: resize instance; resize main; Reset all changes. Record: whether instance keeps size, whether reset restores size, any "Reset size" item.
- **E-12 Swap heuristics.** Setup: components X and Y with (a) identical names/structure, (b) same names different nesting, (c) different names. Action: override text, fill, visibility, nested swap; swap via instance menu, via ⌥-drop from Assets, via INSTANCE_SWAP property. Record: surviving overrides, resulting size (hug/fixed/overridden).
- **E-13 Detach nested.** Action: detach Card instance containing Button instance; separately detach nested Button. Record: types of Card/Button after each, ID changes, prototype links.
- **E-14 Restore deleted main.** Setup: main in frame F (auto layout, index 2) on page P; variant in set S. Action: delete; restore from an instance on another page; also after save/reload; delete whole set then restore from a variant instance. Record: restored page/parent/index/position, ID, set membership.
- **E-15 Exposed instances.** Action: expose nested Button in Card; check variants; swap the exposed Button; nest two levels. Record: panel grouping, persistence after swap, transitivity, eligibility (instances without properties).
- **E-16 Simplify instances.** Action: locate the option on a main/set; toggle; inspect instance panel and layers panel. Record: exact effect and label.
- **E-17 Combine-as-variants naming.** Action: combine "Alpha"+"Beta"; "A/x"+"B/y"; "Btn/x/y"+"Btn/z"; mixed "Size=sm"+"Btn/lg". Record: set name, property names, values, warnings.
- **E-18 Default variant.** Action: arrange variants with equal y different x, equal x different y, diagonal; drag set from Assets. Record: which variant is inserted (y-first or x-first), and the VARIANT default values shown.
- **E-19 Add / duplicate / move variants.** Action: click set "+" with and without a selected variant; ⌘D a variant; drag a plain component into a set and a variant out. Record: new names/values, positions, conflicts.
- **E-20 Variant property edits.** Action: add property, rename property/value, delete property; edit layer name to add a new value. Record: default value assigned to existing variants, instance stability.
- **E-21 Toggle rendering.** Action: variant property values true/false, True/False, yes/no, on/off, 0/1. Record: which render as a toggle.
- **E-22 Missing combination selection.** Setup: Size{S,M,L} × State{Default,Hover} with only 4 variants. Action: from each existing variant select each missing combination value. Record: chosen variant each time, any warning.
- **E-23 Ordering.** Action: drag-reorder properties and variant values in main/set panel. Record: whether allowed, and instance panel order.
- **E-24 BOOLEAN-bound eye toggle.** Action: in instance, toggle eye on bound layer. Record: property value change vs separate override; reset behavior.
- **E-25 Text range styles.** Action: bold one word in instance text (bound and unbound), then change main font size / TEXT value. Record: preserved styling.
- **E-26 INSTANCE_SWAP value change.** Action: override nested icon color, change property value. Record: preserved overrides; preferred list UI.
- **E-27 VARIANT property deletion.** Action: try deleting a variant property from the set panel. Record: availability and resulting names.
- **E-28 Slots deep-dive.** Action: default content propagation after editing main slot; reset slot (default content vs empty); paste main into slot; switch variants with/without same SLOT property; slot of nested instance editable from outer instance; slot frame layout overridable; hidden children counted in min/max. Record each outcome and UI warnings.
- **E-29 Limit counting.** Action: min 2/max 3 with hidden child, with nested groups. Record: counts used for warnings.
- **E-30 Description surfaces.** Action: set description + link on set and on one variant; hover in Assets; select instance. Record: where shown and which description wins.
- **E-31 Interactive components.** Action: hover/press/click variants; nested interactive button inside card main; detach instance with inherited interactions; instance-level interaction edit. Record: runtime behavior, override listing.
- **E-32 Cross-file paste.** Action: copy unpublished main and its instance from file A into file B; repeat with published library component. Record: result type, link target, "remote" status.
- **E-33 UI3 labels.** Action: screenshot right panel for main, set, variant, instance, nested instance, slot (main/instance); context menus; toolbar create-component dropdown; quick insert insertion point. Record: exact labels and entry points.
- **E-34 Push nested overrides.** Action: in instance swap nested icon, set nested property, override nested text; Push changes to main. Record: what lands in main.
- **E-35 Publishing hide rules.** Action: names starting with `.` and `_`, and the hide toggle. Record: library listing in a consumer file.
- **E-36 Shortcuts.** Action: open Figma's keyboard shortcuts panel; search "component", "instance", "variant", "slot", "main". Record: every default binding on macOS/Windows (resolves conflicting third-party claims for Go to main component, Create component set, Reset overrides, Convert to slot).

*Final audit (2026-10-08).* E-37…E-47 were cited by items and body text but never written. They are defined below from those citations, with no new research.

- **E-37 Variant naming edge cases.** Setup: a set with properties Size (sm, lg) and State (default, hover). Action: in the property panel and in a variant's layer name, enter a duplicate property name; names and values containing `=` or `,`; spaces around separators; `Size` vs `size`; an empty value. Then rename one variant layer to "Size=sm" (drops State) and to "Size=sm, State=x, Theme=dark" (adds Theme). Record: accepted, rejected or sanitized for each case; resulting `componentPropertyDefinitions`, `variantProperties` and any warning. Gates CP-225, CP-226.
- **E-38 Instances of rotated or flipped mains.** Setup: main rotated 30°; main flipped horizontally. Action: create an instance of each by Alt-drag, ⌘D, copy/paste and Assets insertion. Record: each instance's `rotation` and `relativeTransform`. Gates CP-213.
- **E-39 Root-level propagation matrix.** Setup: main with an instance on the canvas. Action: on the main's root, change fills, strokes, effects, opacity, blend mode, radius, clip content, auto layout, `visible`, `locked`, export settings, x/y, rotation and constraints, one at a time. Record: which changes reach the instance. Gates CP-207.
- **E-40 Override granularity of list fields.** Setup: main child "Bg" with 2 fills, 2 shadows and 2 layout guides; one instance. Action: in the instance change only the top fill's opacity (then one shadow, then one guide); in the main recolor the bottom fill (then edit the other shadow and guide). Record: the instance's untouched entries, and the `overriddenFields` the plugin console reports. Gates CP-208.
- **E-41 Combine as variants.** Setup: two components, each with a referenced TEXT property "Label" and instances carrying values; three components inside a frame; selections of one component, a component plus a frame, a component plus an instance, and a component plus a variant from another set. Action: run Combine as variants in each case. Record: whether it is offered; merged property definitions and instance values; the set's parent index, stroke, dash, radius, padding and variant offsets. Gates CP-222, CP-223, CP-224.
- **E-42 Multi-selected instances.** Action: select (a) two variants of one set, (b) instances of two sets with the same property names, (c) instances of unrelated components; change one control. Record: the instance panel each time and the number of undo steps. Gates CP-228.
- **E-43 Variant value bound to a variable.** Setup: a set with a boolean-like and a string variant property; STRING and BOOLEAN variables with two modes. Action: try to bind each variant property on an instance; switch modes. Record: whether binding is offered and whether the variant switches. Gates CP-231.
- **E-44 Slot open questions.** Action: set `allowPreferredValuesOnly` with Icon set preferred and insert an Icon variant, then a text layer; use the empty slot's insert affordance; convert a frame with 2 text children to a slot and reset it; delete the SLOT property while 2 instances hold custom content, then undo; convert a frame 2 levels deep; change a slot frame's padding and fill in an instance; nest a component with a slot inside another component and edit the slot from the outer instance. Record: each outcome, any `limitViolations`, and the Reset menu. Gates CP-232…CP-238.
- **E-45 Library availability and partial updates.** Setup: a library with 3 components used in a consumer file. Action: unpublish one component and reopen the consumer; change all 3 and publish, then accept only 1 update. Record: rendering, flags, detach and swap availability; which instances update. Gates CP-241, CP-242.
- **E-46 Paste to replace and Select all instances.** Action: copy main B, select 2 overridden instances of A, run Paste to replace; then look for every UI path that selects all instances of a main and run it with instances on 2 pages. Record: result type, overrides and placement; the menu path; the scope (page or document). Gates CP-220, CP-243.
- **E-47 Create component from unusual sources.** Setup: frame F holding a main M and a rectangle; hidden, locked, rotated and flipped sources; a 0-height line. Action: ⌥⌘K on each. Record: the resulting tree and M's type; whether hidden/locked state is kept; rotation of the result; wrapper size of the line. Gates CP-203, CP-205.

---

## 9. Sources

### 9.1 Typings (read directly)

`@figma/plugin-typings` 1.141.0 — `/tmp/.../refs/_figma_plugin-typings/package/plugin-api.d.ts`:
- `skipInvisibleInstanceChildren` L81-109; `documentchange` special case (instance sublayers) L594
- `createComponent` L1090-1102; `createComponentFromNode` + restrictions L1104-1120
- `importComponentByKeyAsync` / `importComponentSetByKeyAsync` L1619-1623
- `combineAsVariants` L1833-1857; `createVariableAlias` (for `setProperties`) L2240-2252
- `DevResource.inheritedNodeId` L3185; `NodeChangeProperty` L3751-3884
- `Reaction` actions incl. `resetInteractiveComponents` L5730-5752; `Navigation` (`CHANGE_TO`) L5807
- `PublishStatus` L6262; `parent` note on remote/soft-deleted mains L6316-6325
- `componentPropertyReferences` L6624-6635; `VariableBindableComponentProperty*Field` L6954-6955
- `layoutMode` GRID not allowed on slots L7648; `DetachedInfo` L8636-8645; `detachedInfo` L9393-9396
- `PublishableMixin` L9306-9356; `VariantMixin` L9612-9658; `ComponentPropertiesMixin` L9659-9706
- `ExplicitVariableModesMixin` L10528-10561; `PageNode.clone` L10570; `FrameNode.clone` L10764
- `ComponentPropertyType`, `InstanceSwapPreferredValue`, `SlotSettings`, `ComponentPropertyOptions`, `ComponentPropertyDefinitions` L11076-11116
- `ComponentSetNode` L11117-11137; `ComponentNode` L11142-11172; `ComponentProperties` L11176-11185; `InstanceNode` L11186-11258; `SlotNode` L11259-11283

`@figma/rest-api-spec` 0.44.0 — `/tmp/.../refs/_figma_rest-api-spec/package/dist/api_types.ts`:
- `componentPropertyReferences` L44-49; `ComponentPropertiesTrait` L669-675; `ComponentNode`/`ComponentSetNode` L990-1004; `InstanceNode` L1110-1142; `ComponentPropertyType` (no SLOT) L2410; `InstanceSwapPreferredValue` L2415; `ComponentPropertyDefinition` L2430; `ComponentProperty` L2455; `Overrides` L2480; `Component`/`ComponentSet` metadata L2564-2626; `GetFileResponse.components` L5690.

### 9.2 Official Figma Help Center articles (search excerpts only; IDs from the 2026-09-27 catalog)

| ID | Title | Used for |
| --- | --- | --- |
| 360038662654 | Guide to components in Figma | terminology (title only) |
| 360038663154 | Create components to reuse in designs | creation (via mirror excerpt) |
| 360039150173 | Create and insert component instances | Alt-drag, ⌘D, copy/paste, Assets, ⇧I, drag-swap |
| 360039150733 | Apply changes to instances (overrides) | overridable / non-overridable list |
| 360039150413 | Swap components and instances | instance menu grouping, preservation criteria |
| 360038665754 | Detach an instance from the component | detach shortcut and result |
| 360038665934 | Edit main components | propagation, go to main, return to instance, push, reset menus |
| 360056440594 | Create and use variants | naming/slash rules, set contents, conflicts |
| 5579474826519 | Explore component properties | property creation, boolean, instance swap, preferred values |
| 8883757553943 | Edit instances with component properties | title only |
| 38231200344599 | Use slots to build flexible components in Figma (title corrected in review per catalog) | slot creation, settings, constraints, ⌘⇧S |
| 38741465279895 | The difference between slots, instance swaps, and variants | concepts |
| 38607529833751 | Migrate a library to using slots | audit steps |
| 35794667554839 | What's new from Schema 2025 | slots announcement |
| 360061175334 | Create interactive components with variants | title only |
| 4404380377367 | Add prototype connections from main components | title only |
| 7938814091287 | Add descriptions to styles, components, and variables | title only |
| 360039238193 | Hide styles, components, and variables when publishing | title only |
| 4404848314647 | Move published components | title only |
| 360038663994 | Name and organize components | title only |
| 41307940738967 | Create and use animated components | title only (out of scope) |

URLs: `https://help.figma.com/hc/en-us/articles/<id>`.

### 9.3 Other sources

- Figma-authored MCP skill docs (read in full this session via Figma's MCP server): `skill://figma/figma-use/SKILL.md`, `skill://figma/figma-use/references/component-patterns.md`, `.../references/gotchas.md` (component sections), `.../references/working-with-design-systems/wwds-components.md`, `...--creating.md`, `...--using.md`.
- Figma developer changelog, Plugin API update 2026-06-10 (slots GA, SlotSettings semantics) — search excerpt: https://developers.figma.com/docs/plugins/updates/2026/06/10/update/
- Forum threads (search excerpts): https://forum.figma.com/ask-the-community-7/is-layer-hierarchy-still-taken-into-account-when-preserving-overrides-14757 ; https://forum.figma.com/suggest-a-feature-11/preserve-overrides-in-instances-swapped-inside-component-11459 ; https://forum.figma.com/suggest-a-feature-11/push-reset-overrides-of-instances-from-the-main-component-13480 ; https://forum.figma.com/report-a-problem-6/properties-and-values-of-this-variant-are-conflicting-but-they-are-not-51633 ; https://forum.figma.com/t/expose-nested-instances-lost-if-you-swap-the-nested-instance/54180 ; https://forum.figma.com/share-your-feedback-26/go-to-main-component-keyboard-shortcut-33739 ; https://forum.figma.com/ask-the-community-7/main-component-missing-no-option-to-restore-or-go-to-23676 ; https://forum.figma.com/report-a-problem-6/figma-slots-do-not-pass-on-component-properties-51891 ; https://forum.figma.com/suggest-a-feature-11/will-the-grid-layout-be-available-within-the-new-figma-slots-before-the-end-of-the-beta-51735 ; https://forum.figma.com/t/while-hovering-on-click-interactions-dont-work-well-together/1570 ; https://forum.figma.com/suggest-a-feature-11/interactive-components-not-working-when-nested-inside-a-main-component-12437 ; https://forum.figma.com/suggest-a-feature-11/nested-property-hidden-with-multiple-selection-27022 ; https://forum.figma.com/t/enhancing-the-simplify-instance-function-with-more-granular-controls/86885 ; https://forum.figma.com/t/how-can-i-un-component-a-component/4356/8 ; https://forum.figma.com/archive-21/how-can-i-drag-over-a-bunch-of-frames-and-convert-them-into-multiple-components-as-opposed-to-just-one-big-component-14306
- Third-party (lower weight, excerpts): https://figma-signup.helpjuice.com/components/create-components-to-reuse-in-designs (mirror of help text); https://uxplanet.org/figma-component-properties-update-beta-explained-in-3-min-fd743c6846ae ; https://uxdesign.cc/10-components-tips-in-figma-12b80389574 ; https://uxdesign.cc/figma-component-properties-broken-logic-or-new-approach-35111b1645b4 ; https://stevekinney.com/courses/figma/variants ; https://www.skillademia.com/shortcuts/figma-shortcuts/ ; codefinity Figma course page (restore component).
- Prior Illigma snapshot (context only, no code reused): `old/docs/figma/source-catalog.md`, `feature-guide.md` §13, `observations/2026-09-27-live-figma.md` (confirms components were *not* observed).
