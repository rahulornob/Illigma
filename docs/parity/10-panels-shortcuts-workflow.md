# Layers, pages, assets, inspector structure, shortcuts, menus & file workflows — Figma parity spec

> **Status: research draft (date 2026-10-08). Nothing implemented.** Every checklist item below is *Not started*. No item may be marked "parity" until it is implemented in Illigma **and** validated against live Figma behavior (see §8).
>
> **Rule of precedence.** Figma is the source of truth for behavior, data and workflow. Framer is the source of truth only for how the editor *looks* (colors, icons, type, spacing, radii, transitions). This document specifies behavior only; where it names an icon or a control it specifies *what the control must communicate or do*, never its styling.
>
> **Evidence legend** (every behavioral claim is tagged):
> - **[API]** — Figma Plugin API typings v1.141.0 (`plugin-api.d.ts`) or REST API types v0.44.0 (`api_types.ts`), read in this session. Line references in §9.
> - **[DOC:&lt;id&gt;]** — an official Figma Help Center article. **"excerpt"** means only a search-engine excerpt/summary of the article was seen in this session; the article body was **not** read (help.figma.com is not reachable from this environment).
> - **[OBS]** — the read-only live-Figma UI inspection of **2026-09-27** (Chrome/macOS, Figma Design, UI3), recorded in the old `observations/2026-09-27-live-figma.md`; the same session's "Observed" line in the old `features/right-inspector.md` is also cited as [OBS]. Nothing in this document was observed live in *this* session.
> - **[KNOW]** — the author's prior knowledge of Figma, **not verified in this session**. Everything correctness-relevant that rests only on [KNOW] or [SRC] is repeated in §8.
> - **[SRC:&lt;url&gt;]** — a non-Figma-help web source (Figma blog, Figma community forum, third-party cheat sheet). Seen as search excerpts unless stated. The Raycast shortcut dataset was downloaded and parsed in full; it contains demonstrable errors and is used only as a cross-check.
> - **[DECISION]** — an Illigma product decision for a local-first app where Figma's behavior depends on cloud/multiplayer infrastructure. A [DECISION] is never a parity claim.
>
> **Research limits in this session.** The shared web-search budget for the run was exhausted part-way through research; several planned confirmations (UI3 inspector section order per selection type, pages-panel context menu, assets-panel UI3 behavior, layer search) could not be searched and are therefore [KNOW] and listed in §8.

---

## 1. Scope & terminology

### 1.1 In scope

| Sub-area | What this document owns |
| --- | --- |
| **Layers panel** | Tree rendering & ordering, type icons (incl. auto layout flow icons), expand/collapse (incl. recursive Alt-click and "Collapse layers"), selection from rows (click, Shift range, Cmd/Ctrl toggle), rename (inline, Cmd/Ctrl+R, Tab/Shift+Tab chaining, batch rename), drag to reorder/reparent with drop rules, lock/visibility toggles (incl. drag-across), hover highlighting, reveal/scroll-to-selection, layer search via Find. |
| **Pages panel** | Add, rename, reorder, duplicate, delete pages; page dividers; page switching and per-page selection/viewport memory; move layers to another page. |
| **Assets panel** | Local components listing, search, insert by drag/click, variants preview, entry point to libraries (library *semantics* belong to DS). |
| **Inspector structure** | UI3 right sidebar: Design / Prototype tabs; exact section list and order per selection type; mixed-value rules; generic numeric-field behaviors (scrub, arrow keys, math, commit). The *contents* of each section belong to the owning area (see §7). |
| **Toolbar** | UI3 bottom toolbar: tool groups, flyouts, last-used tool memory, contextual (vector-edit) toolbar, mode switch. |
| **Actions menu** | Cmd/Ctrl+K (and legacy Cmd/Ctrl+/) command palette. |
| **Main menu** | Main menu & File menu structure; native menubar mirroring ([DECISION]). |
| **Keyboard shortcuts** | The complete default shortcut map (macOS and Windows/Linux), shortcut dispatch rules, keyboard-shortcuts reference panel. |
| **File workflows** | Find & replace, version history (checkpoints, named versions, restore, duplicate), autosave & crash recovery expectations, comments (local-only scope), multiplayer (explicitly out of scope), notifications/toasts. |
| **View toggles** | Rulers, pixel grid, snap to pixel grid, layout guides, outlines, pixel preview, show/hide/minimize UI, UI zoom and high-DPI. |
| **Undo/redo semantics** | What is and is not undoable across canvas, panels and dialogs; how steps are grouped. |
| **Preferences** | Nudge amounts, snapping toggles and all other editor preferences. |

### 1.2 Out of scope (with reason)

| Feature | Status in Illigma | Reason |
| --- | --- | --- |
| Multiplayer cursors, follow, spotlight, cursor chat, observation mode, avatars, "Share" | **Out of scope** (data model reserves author fields only) | Requires real-time server infrastructure. [DECISION] |
| Dev Mode tab/toggle, annotations, measurements panel, ready-for-dev status | **Out of scope** for this phase (task brief) | Dev handoff excluded. `devStatus`/`measurements` round-trip in file format only (IO area). |
| Figma AI ("Make designs", rename layers with AI, etc.) | Out of scope | External service. Actions menu must not show placeholder AI entries. [DECISION] |
| Plugins & widgets menus | Out of scope for parity in this phase | Requires plugin runtime; menu entries absent (not disabled placeholders). [DECISION] |
| Team/organization libraries, publishing to cloud, library analytics | Replaced by local library files (DS area) | No server. |
| Comment mentions, email/push notifications, reactions from others | Out of scope | No identity/server. Local single-author comments are P2 ([DECISION], §3.12). |
| Branching & merging | Out of scope for this phase | Cloud feature (catalog §"Branching and merging"); listed for IO gap list. |
| Figma Draw mode tools (brushes, transforms) | Not in this area | If adopted later it belongs to VC/PE areas; the toolbar's mode switch is specified only for Design. |

### 1.3 Terminology (Figma terms; terms users confuse)

| Figma term | Meaning | Commonly confused with |
| --- | --- | --- |
| **Layers panel** | The tree of the current page's nodes in the left sidebar ("File" tab) [DOC:360039831974 excerpt]. | "Outline", "Navigator". |
| **Left sidebar / navigation panel** | Holds Main menu, File menu, Pages, Layers; plus Assets tab [DOC:360039831974 excerpt]. | The **navigation bar** (UI3 vertical rail to the left of the panel: File, Assets, Find & replace, notifications) [DOC:23954856027159 excerpt] [OBS]. |
| **Right sidebar / properties panel** | Design and Prototype tabs, contextual to selection [OBS]. | "Inspector" — used in this doc as the Illigma name for the same panel. Not Dev Mode's "Inspect". |
| **Page** | A separate canvas and tree inside one file (`PageNode`, REST `CANVAS`) [API]. | Frame / artboard. |
| **Page divider** | An *empty* page whose name is all asterisks, en dashes, em dashes or spaces; shown as a separator line [API]. | A section. |
| **Assets** | Components (and component sets) available to insert: local and from libraries [DOC:360039831974 excerpt]. | Styles (styles are in the right sidebar, not the Assets tab) [KNOW]. |
| **Actions menu** | Command palette opened with Cmd/Ctrl+K; formerly "Quick actions" (Cmd/Ctrl+/) [DOC:23570416033943 excerpt]. | Context menu; Main menu. |
| **Main menu** | The Figma-logo menu at the top of the left sidebar: File/Edit/View/Object/Text/Arrange/Vector/Plugins/Widgets/Preferences/Help submenus [KNOW]. | **File menu** = the file-name dropdown (rename, duplicate, move, version history, export) [DOC:360039831974 excerpt]. |
| **Version history** | Server-side list of autosave checkpoints and named versions [DOC:360038006754 excerpt]. | Undo history (session-only, per user). |
| **Collapse layers** | Collapse every expanded row except the path to the selection [SRC:forum, see §9]. | Minimize UI. |
| **Minimize UI** (Shift+\\) vs **Show/Hide UI** (Cmd/Ctrl+\\) | Minimize collapses nav bar + panels to compact form; Hide removes all UI [DOC:360039831974 excerpt]. | Each other. |
| **Layout guides** | UI3 name for *layout grids* (`layoutGrids`) [KNOW; old feature-guide]. | Ruler guides (page `guides`), pixel grid, auto layout GRID. |
| **Nudge** | Arrow-key move by "small nudge" (default 1) or with Shift "big nudge" (default 10), in resolution-independent points [DOC:4404575206295 excerpt]. | Smart-selection spacing. |
| **Mixed** | Inspector placeholder when selected nodes disagree on a value [KNOW]. | "Empty" / zero. |

### 1.4 Platform conventions used in this document

- **macOS** uses ⌘ Cmd, ⌥ Option, ⇧ Shift, ⌃ Control. **Windows/Linux** maps ⌘→Ctrl and ⌥→Alt *except where §5 lists an explicit exception*. Figma has no official Linux build; Illigma's Linux keymap = Windows keymap ([DECISION]).
- Figma's default shortcuts are defined for a **US QWERTY** layout and depend on the keyboard-layout preference [DOC:360041065034 excerpt]; Illigma must dispatch letter shortcuts by *logical key* per the selected layout (§3.9).

---

## 2. Data model

This area mostly consumes data owned by other areas. The table distinguishes **document data** (saved in the file, participates in undo where noted), **per-user/per-file view state** (saved, but not document content and not undoable), **app preferences** (global to the user), and **transient UI state** (never saved).

### 2.1 Document data used by the panels

| Entity / property | Type & values | Default | Notes | Evidence |
| --- | --- | --- | --- | --- |
| `DocumentNode.type` | `'DOCUMENT'` | — | Root; parent of pages only. | [API] |
| `DocumentNode.name` | string | file name | File name shown in the File menu; read-only via plugin API. | [API] |
| `DocumentNode.children` | `PageNode[]` (ordered) | 1 page | Order = Pages panel order. `appendChild`/`insertChild(index)` reorder pages. | [API] |
| `DocumentNode.documentColorProfile` | `'LEGACY' \| 'SRGB' \| 'DISPLAY_P3'` | — | Shown in File menu / color settings (PE area). | [API] |
| `PageNode.type` | `'PAGE'` (REST: `'CANVAS'`) | — | | [API] |
| `PageNode.name` | string | `"Page 1"` … [KNOW] | Renaming an **empty** page to a divider name makes it a divider. | [API] |
| `PageNode.isPageDivider` | readonly boolean | false | True only if the page is empty **and** its name consists entirely of `*`, en dashes `–`, em dashes `—`, or spaces. `createPageDivider()` default name is `"---"`. | [API] |
| `PageNode.backgrounds` | `Paint[]` (single SOLID only) | light grey [KNOW: #F5F5F5 in light theme; verify] | Canvas background; edited in Page section of inspector. REST: `backgroundColor: RGBA`. | [API] [OBS: page properties visible with no selection] |
| `PageNode.prototypeBackgrounds` | `Paint[]` (single SOLID) | — | Prototype tab, no selection (PR area). | [API] |
| `PageNode.flowStartingPoints` | `{nodeId, name}[]` sorted | [] | Shown in Prototype tab with no selection; first = default. | [API] |
| `PageNode.guides` | `{axis:'X'\|'Y', offset:number}[]` | [] | Ruler guides (CV area); hidden with rulers toggle? see §8. | [API] |
| `PageNode.selection` | `SceneNode[]` | [] | **Stored per page**; preserved when switching pages; never contains a node together with its descendant; order unspecified. In Figma this is per-user state, not shared document content. | [API] |
| `PageNode.selectedTextRange` | `{node,start,end} \| null` | null | Text edit mode caret/range. | [API] |
| `PageNode.explicitVariableModes` | map | {} | Page-level mode choice (DS area); visible in Page section. | [API] |
| `PageNode.exportSettings` | `ExportSettings[]` | [] | Export section with no selection. | [API] |
| `BaseNode.id` | string `"<a>:<b>"` | — | Stable; URL form uses hyphen (`1-3`). Used for deep links ("Copy link to selection"). | [API] |
| `BaseNode.name` | string | type-based ("Frame 1", "Rectangle 2" …) [KNOW] | Layer row label. | [API] |
| `TextNode.autoRename` | boolean | true | While true, name follows `characters`; manual rename sets it false. Renaming via style name also sets false. | [API] |
| `SceneNode.visible` | boolean | true | Node is effectively visible only if it and **all** ancestors are visible. | [API] |
| `SceneNode.locked` | boolean | false | Node is effectively locked if it **or any** ancestor is locked; prevents canvas selection & dragging; does not prevent programmatic writes. | [API] |
| `ContainerMixin.expanded` | boolean | false [KNOW: new containers start collapsed; verify] | "Whether this container is shown as expanded in the layers panel." Present on frames and everything built on `BaseFrameMixin`/`DefaultFrameMixin` (frames, components, component sets, instances, slots), groups, boolean ops and transform groups. **`SectionNode` does not include `ContainerMixin`** in the typings, so a section's expanded state is not exposed via the API (whether it is saved is unverified, §8 V-08). **It is a document property** and appears in the `NodeChangeProperty` list, i.e. it is saved with the file and emits change events. Whether it is undoable: see §3.13 and §8. | [API] |
| `FrameNode.numberOfFixedChildren` | int ≥ 0 | 0 | When > 0 the layers panel shows two section headers inside the frame (fixed vs scrolling children); fixed children are always on top. | [API] |
| `isMask` / `maskType` | boolean / enum | false | Mask masks *subsequent siblings*, i.e. rows shown **above** it in the layers panel. | [API] |
| `layoutMode` | `'NONE' \| 'HORIZONTAL' \| 'VERTICAL' \| 'GRID'` | NONE | Drives the auto layout row icon. `layoutWrap: 'NO_WRAP' \| 'WRAP'`. | [API] |
| `SectionNode.sectionContentsHidden` | boolean | false | Section-level hide of contents (FR area); affects row rendering. | [API] |
| `SlotNode` (`type:'SLOT'`) | frame-like, inside instances | — | The only container inside an instance whose children can be changed; has `limitViolations`. | [API] |
| Children order | `children[0]` = bottom-most; last = top-most | — | Layers panel lists **top-most first** (reverse of array). Inserting without index appends as top-most. | [API] |
| Version (REST) | `{id, created_at, label: string\|null, description: string\|null, user, thumbnail_url?}` | — | `saveVersionHistoryAsync(title, description?)` requires non-empty title. | [API] |
| Comment (REST) | `{id, client_meta: Vector \| FrameOffset \| Region \| FrameOffsetRegion, parent_id?, user, created_at, resolved_at?, message, order_id, reactions[]}` | — | `FrameOffset = {node_id, node_offset}`; `Region` has `region_width/height > 0` and `comment_pin_corner`. Basis for local comments ([DECISION] §3.12). | [API] |

### 2.2 Per-file view state (saved, not undoable, not document content)

| State | Scope | Default | Evidence |
| --- | --- | --- | --- |
| Current page | per file per user | Last page viewed on reopen [KNOW] | [KNOW] |
| Viewport (`center`, `zoom`) per page | per page | Zoom-to-fit on first open [KNOW] | `viewport.center`, `viewport.zoom` (1.0 = 100 %), `bounds` readonly [API]; persistence [KNOW] |
| Selection per page | per page | [] | [API] (`page.selection` preserved on page switch) |
| Panel widths, Pages/Layers split position, Pages section collapsed | per user (global) [KNOW] | — | [DOC:360039831974 excerpt] (left sidebar resizable) |
| View toggles (rulers, pixel grid, layout guides, outlines, pixel preview, comments visible) | **scope unverified** (global vs per file) | rulers off, pixel grid on [KNOW] | §8 V-17 |
| Last-used tool per toolbar flyout | per user | first tool of group | [KNOW] |

> **[DECISION]** Illigma stores per-file view state in a *view-state record* inside the file package but outside the undoable document graph, so reopening restores page, viewport and selection, and so that sharing a file does not depend on it. The IO area owns the on-disk location.

### 2.3 App preferences (global, persisted, not undoable)

| Preference | Values | Default | Evidence |
| --- | --- | --- | --- |
| Small nudge | number > 0 (points) | 1 | [DOC:4404575206295 excerpt] |
| Big nudge | number > 0 (points) | 10 | [DOC:4404575206295 excerpt] |
| Snap to geometry | bool | on | [KNOW] |
| Snap to objects | bool | on | [KNOW] |
| Snap to pixel grid | bool | on | [DOC:360041065034 excerpt] (toggle exists) / default [KNOW] |
| Keep tool selected after use | bool | off | [KNOW] |
| Highlight layers on hover | bool | on | [KNOW] |
| Rename duplicated layers | bool | **unverified** | [KNOW] |
| Show dimensions on objects | bool | on | [KNOW] |
| Hide canvas UI during changes | bool | off | [KNOW] |
| Keyboard zooms into selection | bool | off | [KNOW] |
| Invert zoom direction / scroll-wheel zoom behavior | bool | off | [KNOW] |
| Theme | Light / Dark / System | System | [KNOW] (visuals from Framer; Illigma default theme = dark per styles.css) |
| Keyboard layout | list of layouts | auto-detect | [DOC:360041065034 excerpt] mentions layout dependence; [SRC:figma-signup.helpjuice.com "select keyboard layout"] |
| UI scale | 50 %–200 % [KNOW: range unverified] | 100 % | [DOC:360049549913 excerpt] (reset = ⌥⇧⌘0) |

### 2.4 Transient UI state (never saved, never undoable)

Hover row, active rename editor, drag-in-progress, Find query and results, Actions-menu query, open popovers, toast queue, expanded state of inspector popovers, scroll offsets of panels, keyboard focus owner.

---
## 3. Behavior specification

### 3.1 Layers panel — tree model and row rendering

**Visible-row derivation** (computed, not stored):

```
rows(page):
  out = []
  for child in reverse(page.children):          # top-most first  [API children back-to-front]
    emit(child, depth=0)
  return out

emit(node, depth):
  out.push(Row(node, depth))
  if isContainer(node) and node.expanded:
    if node is FRAME and node.numberOfFixedChildren > 0:     # [API]
      out.push(Header("Fixed"))                               # label text: verify (§8 V-07)
      for c in reverse(fixedChildren(node)): emit(c, depth+1)
      out.push(Header("Scrolls"))
      for c in reverse(scrollingChildren(node)): emit(c, depth+1)
    else:
      for c in reverse(node.children): emit(c, depth+1)

isContainer(n) = n has ChildrenMixin and n.type != PAGE
               # FRAME, GROUP, SECTION, COMPONENT, COMPONENT_SET, INSTANCE, BOOLEAN_OPERATION,
               # SLOT, TRANSFORM_GROUP  [API]
```

- **Row content** (functional): disclosure chevron (containers with ≥1 child only), type icon, name, and trailing lock/visibility toggles. Toggles are shown on hover; a toggle whose *own* state is non-default (locked, or hidden) stays visible when not hovered so the state is discoverable [KNOW]. Descendants that are effectively hidden/locked because of an ancestor show a subdued inherited indicator, not their own toggle state [KNOW]. Hidden rows render their name de-emphasized [KNOW].
- **Type icon must encode** [KNOW, Illigma prior note says glyph parity was never established]: frame (no auto layout); auto layout frame with `HORIZONTAL`, `VERTICAL`, wrapped (`layoutWrap = WRAP`) and `GRID` variants (each distinguishable); group; section; component; component set; instance; slot; rectangle; ellipse; polygon; star; line; arrow (line with arrowhead caps); vector/pen path; text; image (shape whose only visible fill is an IMAGE paint); video; boolean group per operation (union/subtract/intersect/exclude); mask layer (`isMask = true`); slice. Component, component set, instance and slot rows are additionally marked as "component family" (Figma uses purple) so they are distinguishable at a glance — the color itself comes from the Framer-based design system.
- **Names**: shown verbatim (no truncation of the stored value; visual truncation with ellipsis only). Text layers with `autoRename = true` display (and store) a name derived from their characters [API]; Figma truncates long auto-names (limit unverified, §8 V-05).
- **Hover row ⇒ canvas highlight**: hovering a row draws the hover outline of that node on the canvas [DOC:360040449873 excerpt]. If the node is off-screen nothing scrolls.
- **Canvas hover ⇒ row highlight**: [KNOW, unverified] Figma does not scroll the layers panel on canvas hover; whether the row is tinted is unverified (§8 V-06).
- **Selected rows** are highlighted; ancestors of a selected node that are collapsed show that they contain the selection only after reveal (see §3.3).
- **Instance internals**: rows inside an instance are shown (expandable) but are structurally read-only: cannot be reordered, reparented, deleted or receive drops, except inside `SLOT` nodes [API: SlotNode semantics; drop-rule details KNOW].
- **Performance requirement [DECISION]**: the panel must virtualize rows; 10 000 visible rows must scroll at display refresh rate (M8 hardening).

### 3.2 Layers panel — selecting rows

| Gesture | Result | Evidence |
| --- | --- | --- |
| Click row (name or icon) | Selection := {node}. Works for nodes at any depth (no deep-select modifier needed), for **locked** nodes and for **hidden** nodes. Canvas shows selection bounds; hidden nodes show bounds/outline only [KNOW]. | [DOC:360040449873 excerpt] (row selection), locked/hidden selectability [KNOW] |
| Shift+click row | Range select: all rows between the anchor row and the clicked row, in visible-row order. | [DOC:360040449873 excerpt] |
| Cmd (mac) / Ctrl (win) + click row | Toggle that node in/out of the selection; does not move the anchor? (anchor rule unverified, §8 V-03). | [DOC:360040449873 excerpt] |
| Click chevron | Expand/collapse only; selection unchanged. | [KNOW] |
| Click lock/eye toggle | Toggles the property; selection unchanged [KNOW] (forum reports a regression where the eye icon selects the layer [SRC:forum, §9]). | [KNOW] |
| Click empty panel area below rows | Clears selection [KNOW]. | [KNOW] |

**Selection normalization** (applies to every selection change, from any source) [API]:

```
normalize(S):
  S = dedupe(S)
  S = { n in S | no ancestor of n is in S }      # never node + descendant
  S = { n in S | n.page == currentPage }          # selection is per page
  return S
```

Range rule (Shift+click) — [KNOW, verify §8 V-02]:

```
rangeSelect(anchorRow, clickedRow):
  R = rows strictly between and including anchorRow..clickedRow in visible order
  S = normalize(nodes(R))                  # parents in range swallow their in-range children
  if Cmd/Ctrl also held: S = selection ∪ S
  selection = S                            # anchor stays at anchorRow
```

The anchor is the last row clicked without Shift. If no anchor exists (selection came from the canvas), the anchor is the top-most selected row [KNOW].

The layers panel never uses Up/Down arrow keys to move row focus: arrow keys always **nudge** the selection on canvas (§5) [KNOW]. Sibling navigation is Tab / Shift+Tab, children Enter, parent Shift+Enter (CV area; listed in §5).

### 3.3 Expand / collapse and revealing the selection

- **Chevron click**: toggles `expanded` of that container only [API property; gesture KNOW].
- **Alt/Option+click chevron**: toggles that container **and all descendant containers** to the same new state (recursive expand or recursive collapse) [SRC:forum "hold Alt and press the arrow… to expand all its layers"].
- **Cmd/Ctrl+click chevron with multiple rows selected**: users report it toggles all selected containers together; Figma community support could not confirm it in Help Center docs, and a 2026-09-24 report says it currently collapses only the clicked frame [SRC:forum 58343/56267]. Treat as **P2, verify** (§8 V-04).
- **Collapse layers** (Option+L / Alt+L, and a "Collapse layers" control in the Layers header) [DOC:360040449873 excerpt via forum; shortcut SRC:forum]:

```
collapseLayers():
  keep = set()
  for n in selection: keep |= ancestors(n)        # path to each selected node stays open
  for c in all containers on current page:
     if c not in keep: c.expanded = false
  # With empty selection every container collapses.
  # Reported nuance: when a nested layer is selected, higher-level layers do not collapse
  # (Figma staff: "might be intended") – identical to keeping the ancestor path.
```

- **Reveal on selection** [KNOW]: whenever the selection changes from a non-panel source (canvas click, marquee, Tab/Enter navigation, Find result, undo/redo, Select matching layers), every ancestor of every selected node is set `expanded = true` and the panel scrolls so the first selected row (in visible order) is in view. If the row is already fully visible, no scroll occurs. Selecting from the panel itself never scrolls the panel.
- **Persistence**: `expanded` is saved with the document [API]. Expand/collapse does **not** create an undo step [KNOW, §8 V-08].
- **New containers**: a newly created group/frame from selection appears expanded or collapsed — unverified (§8 V-09).

### 3.4 Renaming

**Inline rename (single layer)** — triggers: double-click the row name; select one layer and press Cmd/Ctrl+R [SRC:figma blog; DOC:360039958934 title only].

```
beginRename(row):
  editor.text = node.name ; select all text                 # forum: Cmd+R once left caret at end (bug, fixed Feb 2024)
on Enter         -> commit()
on Escape        -> cancel()      # restore original, no undo step
on blur/click-away -> commit()
on Tab           -> commit(); beginRename(nextRowBelow)      # [SRC:forum 17592]
on Shift+Tab     -> commit(); beginRename(previousRowAbove)  # [SRC:forum 17592]
commit():
  v = editor.text
  if v == node.name: no-op (no undo step)
  elif trim(v) == "": revert (keep old name)   # [KNOW] verify §8 V-10
  else: node.name = v ; if node is TEXT: node.autoRename = false   # [API]
        push one undo step "Rename"
```

- During Tab chaining, **canvas selection does not follow** the row being renamed [SRC:forum 17592, 2022]. A 2025 forum report says Tab sometimes escapes to browser focus when collapsed frames are present — Illigma must keep focus inside the panel (treat as a Figma bug, not parity) [SRC:forum 45036].
- "Next row" = next row in visible-row order (descends into expanded containers; skips collapsed children) [KNOW, §8 V-11]. At the last row, Tab commits and ends renaming [KNOW].
- Renaming a page divider name onto an empty page converts it to a divider (§3.7).
- Renaming a sublayer of an instance is allowed and is an override (CP area) [KNOW].

**Batch rename (2+ layers selected, Cmd/Ctrl+R or context menu "Rename…")** [SRC:figma blog "spring cleaning" — single shared name, numbered suffix, prefix, rename part of a name, regular expressions]:

| Field | Behavior |
| --- | --- |
| *Match* (optional) | Text or regular expression to find within each current name; when empty the whole name is replaced. [SRC:figma blog] |
| *Rename to* | Replacement template. Insert buttons add tokens: **Current name**, **Number ascending**, **Number descending** [SRC:designcode/uxplanet excerpt]. Token spellings `$&` (current name / whole match), `$n` / `$N` (ascending / descending number) are [KNOW] — verify (§8 V-12). |
| *Start from* | Integer start for numbering (default 1) [KNOW]. |
| Preview | Lists old → new names live before applying [SRC:uxplanet excerpt]. |
| Rename | Applies all renames as **one** undo step [KNOW]. |

Numbering order is defined by layer order in the layers panel (top to bottom) [KNOW]; a forum thread reports numbers appearing reversed, so the exact order (panel order vs. selection order vs. z-order) must be verified (§8 V-12).

```
batchRename(nodes, match, template, start):
  ordered = sortByVisibleRowOrder(nodes)          # verify
  for i, n in enumerate(ordered):
     asc = start + i ; desc = start + len(ordered) - 1 - i
     if match == "": new = expand(template, cur=n.name, asc, desc)
     else:           new = n.name.replace(match, m -> expand(template, cur=m, asc, desc))  # first or all occurrences: verify
     n.name = new ; if n is TEXT: n.autoRename = false
```

### 3.5 Drag to reorder / reparent in the layers panel

**Drop-target resolution** (pointer at panel position `y`, `x`) [KNOW — verify every rule, §8 V-13..V-15]:

```
resolveDrop(pointer, dragged):
  row = rowAt(pointer.y)
  zone = relative position in row: top 25% | middle 50% | bottom 25%
  if zone == middle and isContainer(row.node) and acceptsChildren(row.node, dragged):
      target = (parent=row.node, index=end)               # becomes TOP-MOST child  (verify)
  elif zone == top:
      target = (parent=row.node.parent, index=indexOf(row.node)+1)   # above in panel = higher z
  else: # bottom
      if row.node is expanded container with children:
          target = (parent=row.node, index=end)            # first row under it = top-most child
      else:
          target = (parent=row.node.parent, index=indexOf(row.node))
      # At the bottom edge of the LAST child of a container, the horizontal pointer position
      # chooses the depth: x left of the child's indent => drop after the ancestor at that depth.
  if not valid(target, dragged): show "no drop" feedback; drop does nothing
  return target

valid(target, dragged):
  for d in dragged:
    if target.parent == d or target.parent in descendants(d): return false      # no cycles
  if target.parent is INSTANCE or inside an instance (and not a SLOT): return false
  if target.parent is a non-container (rectangle, text, vector…): return false
  if target.parent is COMPONENT_SET and any d is not COMPONENT: return false     # verify
  if any d is a main COMPONENT and target is inside an INSTANCE of it: return false
  if target.parent is a SECTION: allowed (sections hold frames, groups, shapes…) # nesting rules FR area
  return true
```

- **Indicator**: a horizontal insertion line at the target index, indented to the target depth; a "drop into" highlight on the container row for middle-zone drops [KNOW].
- **Multiple rows** drag together, preserving their relative z-order; the dragged set is first normalized (§3.2) [KNOW].
- **Geometry**: reparenting into a non-auto-layout parent preserves each node's absolute (page) transform; into an auto layout parent the node joins the flow at the target index and the parent re-lays out (`insertChild` "can cause this layer to be resized and children to be moved") [API for AL; KNOW for preservation]. Dragging *out* of auto layout keeps the node's current absolute position [KNOW].
- **Fixed/scrolling sections**: dropping into the "Fixed" section of a frame increases `numberOfFixedChildren` (node becomes fixed) [API model; gesture KNOW].
- **Auto-scroll** when the pointer is within ~1 row of the panel's top/bottom edge; **hover-to-expand** a collapsed container after ~500–800 ms [KNOW, timing unverified].
- **Esc during drag** cancels with no change. A completed drag is **one undo step** that restores parent, index and transforms [KNOW].
- **Alt/Option while dropping** in the panel: no documented duplicate-drag in the layers panel [KNOW, verify §8 V-15].
- **Cross-page**: rows cannot be dragged onto the Pages list to move pages [KNOW]; use "Move to page" (§3.7).

### 3.6 Lock and visibility

- **Toggle from row**: click the lock or eye control on a row (hover reveals it) [DOC:360041596573 excerpt; DOC:360041112614 excerpt].
- **Shortcuts**: Lock/unlock selection **⇧⌘L / Ctrl+Shift+L** [DOC:360041596573 excerpt]; Show/hide selection **⇧⌘H / Ctrl+Shift+H** [DOC:360041112614 excerpt]; works on multi-selection [SRC:forum staff, excerpt].
- **Multi-selection toggle rule** [KNOW, verify §8 V-16]: if *any* selected node is unlocked (resp. visible), the shortcut locks (hides) all; otherwise unlocks (shows) all.
- **Drag across toggles**: press on a row's lock (or eye) control and drag vertically across other rows; every row the pointer passes receives the **same target state** that the first row received (not individually toggled) [DOC:360041596573 excerpt: "Click on the lock and drag across the layers you want to update"; same-target-state semantics KNOW]. A 2026 forum report ("no longer can hold click to show and hide layers", "toggle layer visibility bug") indicates regressions — parity target is the documented behavior (§8 V-16).
- **Effective state** [API]: locked if self or any ancestor locked; visible only if self and all ancestors visible. Unlocking a child of a locked parent does not make it interactive on canvas while the parent stays locked [API semantics; DOC excerpt via forum: "not possible to unlock child layers without unlocking the parent" (effective state)].
- **Canvas consequences**: locked nodes cannot be clicked, marquee-selected or dragged on canvas; hidden nodes are not hit-tested on canvas; both remain selectable in the layers panel and editable in the inspector — "you can still change a hidden layer's position or adjust its properties" [DOC:360041112614 excerpt]. Whether a panel-selected locked node can be **nudged with arrow keys or resized via canvas handles** is unverified (§8 V-16).
- **Inspector**: UI3 Appearance section contains a visibility (eye) toggle that hides/shows the whole selection [SRC:forum staff workaround; KNOW].
- **Unlock all**: action "Unlock all objects" (Actions menu / context menu on canvas) unlocks every locked node on the current page [SRC:forum 2021, excerpt]. There is **no** documented "Show all hidden layers" command [SRC:forum 2023 accepted answer].
- **Export/render**: hidden layers are excluded from rendering and export; locked layers render normally [KNOW].
- Lock and visibility changes are **undoable**, one step per toggle or per drag-across gesture [KNOW].

### 3.7 Pages panel

- **Location**: Pages list sits above Layers in the File tab of the left sidebar; the Pages section can be collapsed and the boundary between Pages and Layers can be dragged [KNOW; OBS confirms "File/Pages/Layers area" and a collapsible Layers heading].
- **Order** = `DocumentNode.children` order [API].
- **Add page** ("+" in Pages header) [KNOW]: creates a page named `Page N` where N = (number of pages incl. dividers? — verify §8 P-01) + 1, inserts it at the **end** of the list [API `createPage` appends; UI placement KNOW], makes it the current page and opens inline rename.
- **Rename**: double-click page name; Enter commits, Esc cancels, blur commits [KNOW]. Empty name reverts [KNOW]. Names need not be unique [KNOW].
- **Page divider** [API]: a page becomes a divider when it is empty and its name consists only of `*`, `–` (en dash), `—` (em dash) or spaces. Default divider name `"---"`. A divider: has no canvas, cannot become the current page, cannot receive layers (dropping/moving layers to it is impossible), can be reordered, renamed, deleted. Context-menu "Add divider"/"Create section divider" wording is [KNOW, verify P-02]. Whether typing ASCII hyphens `---` in the UI creates a divider (the API comment lists en/em dashes, while its default name is `"---"`) must be verified (P-02).
- **Reorder**: drag a page row; insertion line between rows; one undo step [KNOW].
- **Duplicate page** (context menu) [API `PageNode.clone`]: deep-copies all children; **prototype connections in the copy are remapped to the copied nodes**; **main components are cloned as instances whose main component is the original**. New page inserted directly after the source [KNOW] and named `<name> (copy)`? [KNOW, verify P-03]. Selection/viewport of the new page start empty/fit [KNOW].
- **Delete page** (context menu, or Delete key while the page row is focused? — verify P-04): removes the page and all content; **the last remaining non-divider page cannot be deleted** [KNOW]; deleting the current page switches to the adjacent page [KNOW]. Deleting a page containing main components with instances elsewhere leaves those instances pointing to *deleted* main components (restorable via CP "Restore main component") [KNOW]. One undo step restores the page with its ids.
- **Switch page**: click the row. Emits `currentpagechange`, which always also emits `selectionchange` [API]. Restores that page's stored selection [API] and last viewport [KNOW]. Previous/next page: **Page Up / Page Down** [SRC:cheat-sheet; conflicting SRC:raycast maps these to frames — verify §8 P-05]; dividers are skipped [KNOW].
- **Move to page** (context menu on selected layers → submenu of pages): moves the selection to the target page preserving page coordinates, appends as top-most children, does not switch the current page [KNOW, verify P-06]; one undo step spanning two pages.
- **Copy link to page** (context menu) [KNOW]: Illigma equivalent copies an `illigma://open?file=…&page=<id>` deep link ([DECISION], P2).
- **Page limit**: Figma Starter plan files are limited to 3 pages [API remark]. **Illigma: unlimited** ([DECISION]).
- **Page-level properties** with no selection: background color (single solid), variable modes, local styles, export (see §4.1) [API; OBS "page properties"].

### 3.8 Assets panel

- **Open**: Assets tab of the left sidebar / navigation bar; **⌥2 (mac) / Alt+2 (win)**; **⌥1 / Alt+1** returns to File (layers) [DOC:360039831974 excerpt; DOC:360040449873 excerpt gives Ctrl+1 for Windows — conflict, verify A-01].
- **Content**: components and component sets *local to the file* plus components from enabled libraries [DOC:360039831974 excerpt]. Styles and variables are **not** listed here [KNOW]. Local components are grouped by page, then by containing frame/section and by `/`-separated name segments as folders [KNOW, verify A-02].
- **Search**: case-insensitive substring match on component name (incl. folder path) and description [KNOW]; results update as you type; clearing restores the tree [KNOW].
- **Insert by drag**: dragging an asset onto the canvas creates an **instance** at the drop point; the new instance's parent is the top-most frame/section under the pointer (auto layout parents insert at the computed flow index) [KNOW; CP owns instance semantics]. Insertion is one undo step and selects the new instance [KNOW].
- **Insert by click**: UI3 opens an asset detail view (preview, variant/property pickers, "Insert" action) — [KNOW, verify A-03].
- **Swap by drag**: holding **Option/Alt** while dropping onto an existing instance swaps it [KNOW, verify A-04] (CP area).
- **Hidden components**: names starting with `.` or `_` are hidden *from publishing* [DOC:360039238193 title]; whether they still appear in the local Assets list must be verified (A-05).
- **Libraries entry point**: a "Libraries" control opens the library manager (DS area). In Illigma libraries are local files ([DECISION], DS area).
- **Context menu on asset** (local): Go to main component; Copy link? [KNOW, verify A-06].
- Assets panel requires edit access in Figma [DOC:360039831974 excerpt] — Illigma has no permission model; read-only files (e.g. opened from a read-only location) disable insertion ([DECISION]).

### 3.9 Shortcut dispatch rules

```
onKeyDown(e):
  if focus is in a text input (rename editor, inspector field, find box, dialog, text edit mode):
       only that input's keys + global "always" shortcuts (Undo/Redo inside input are local to the input,
       Esc blurs/cancels) are handled                                         # [KNOW]
  elif modal/popover open: popover handles Esc (close) & its own keys first
  else: look up (logicalKey per keyboardLayout preference, modifiers) in keymap  # [DOC:360041065034 excerpt]
        single-letter tool keys (V, F, R, …) never fire while any modifier other than Shift is held
        run action; if action not applicable to current selection -> no-op (no toast) [KNOW]
```

- **Number keys** set opacity of the selection: `1`…`9` → 10 %…90 %, `0` → 100 %, `0` `0` typed quickly → 0 %, two digits typed quickly (e.g. `4` `5`) → 45 % [SRC:raycast for single digits & 00; two-digit rule KNOW]. "Quickly" window unverified (§8 S-03). One undo step per resulting value.
- **Shortcuts reference panel**: Ctrl+Shift+? on both platforms [KNOW; SRC:raycast lists Cmd+Shift+? for mac — conflict, verify S-01]; also from the Help ("?") menu bottom-right [DOC:360041065034 excerpt]. The panel lists all shortcuts by category (Essential, Tools, View, Zoom, Text, Shape, Selection, Cursor, Edit, Transform, Arrange, Components) [KNOW], highlights shortcuts the user has already used [KNOW] and is searchable [SRC:verpex excerpt].
- **No remapping** in Figma (users request it [SRC:forum]); Illigma parity = fixed keymap; a remap UI is an optional post-parity extension ([DECISION], P2).
- **Tool keys while in text edit mode** type characters; Esc exits text edit and selects the text layer [KNOW, TX area].

### 3.10 Actions menu (command palette)

- **Open**: Cmd+K / Ctrl+K, or the Actions button in the bottom toolbar [DOC:23570416033943 excerpt]. Legacy Cmd+/ / Ctrl+/ also opens it [SRC:forum 2025 and 2021, excerpts]. Requires edit access in Figma [DOC excerpt]; Illigma: always available, editing actions disabled for read-only files.
- **Search**: typing filters the list (e.g. "align" shows all alignment actions) [DOC:23570416033943 excerpt]; matching is fuzzy, case-insensitive, over action names and synonyms [KNOW]. Each result shows its keyboard shortcut [KNOW]. Up/Down move highlight, Enter runs, Esc closes; clicking outside closes [KNOW].
- **Empty query**: shows recently used actions [KNOW].
- **Scope**: every main-menu command (incl. view toggles and preferences such as "Nudge amount…", "Unlock all objects") is reachable [SRC:forum excerpts]. Tabs/sections for Assets (search components to insert) and Plugins & widgets [DOC excerpt]; Illigma omits Plugins/AI ([DECISION]).
- **Applicability**: actions not applicable to the current selection are hidden or shown disabled — exact Figma behavior unverified (S-04).
- Running an action from the palette is identical (incl. undo grouping) to running it from its shortcut/menu.
- **Known conflict**: Cmd+K previously inserted a text link in text edit mode; UI3 assigns it to Actions [SRC:forum excerpt]; the current link shortcut must be verified (S-05, TX area).

### 3.11 Find & replace

- **Open**: Cmd+F / Ctrl+F; opens the Find & replace view in the left navigation (UI3 navigation bar) [DOC:9141292269847 excerpt; DOC:23954856027159 excerpt]. Results populate as you type [DOC excerpt].
- **What is searched**: layer names and text-layer content [DOC excerpt implies names are searchable: "If you search for an item that cannot be replaced (such as a widget or frame name), no results will display" for replacement]; scope = current page by default with an option for all pages [KNOW, verify F-01]; filter by layer type (frames, components, instances, groups, text, images, vectors, …) [KNOW, verify F-02].
- **Options**: Match case; Whole words [SRC:uxplanet excerpt].
- **Result list**: each result shows layer name, page/parent context and a text snippet with the match highlighted [KNOW]. Clicking a result selects the layer (switching page if needed), reveals it in the layers panel and zooms the canvas to it [KNOW].
- **Replace**: only text-layer content is replaceable; frames/other names are found but not replaceable [DOC excerpt]. "Replace" replaces the current match; "Replace all" replaces every match in scope as **one** undo step [KNOW]. Replaced text keeps the character style of the first replaced character [KNOW, verify F-03]. Replacing inside an instance creates a text override (CP); text with missing fonts cannot be replaced [KNOW] (Figma requires fonts loaded to edit text).
- A known Figma bug renamed the *layer* instead of changing the text [SRC:forum 2023]; parity target is changing `characters` (and `name` only if `autoRename` is true).
- Find works for viewers too in Figma [DOC excerpt]; in Illigma Find is always available.

### 3.12 Comments — local-only scope [DECISION]

Figma comments are a collaborative, server-side feature (catalog section "Comments": 6 articles). Illigma scope (P2, M8):

- **Comment tool** `C` places a pin; a pin is anchored either at absolute canvas coordinates or relative to the top-level frame under it (`FrameOffset {node_id, node_offset}`) and moves with that frame [API REST model; frame-follow behavior KNOW]. Drag-to-create region comments map to `Region`/`FrameOffsetRegion` with `region_width/height > 0` [API].
- Threads: top-level comment + replies (`parent_id`); numbered (`order_id`) [API]; edit, delete, resolve/unresolve (`resolved_at`) [API model; actions KNOW].
- **Show/hide comments** toggle: Shift+C [KNOW, verify C-01].
- Single local author (name from Preferences); no mentions, notifications, email, reactions ([DECISION]).
- Comments are stored in the file but are **not** part of undo history, not rendered in exports, and not copied with layers [KNOW for Figma; DECISION for Illigma].
- A comments sidebar lists threads with filters (unresolved/resolved, current page/all pages) [KNOW].

### 3.13 Undo/redo semantics

Model [API commitUndo/triggerUndo show the editor groups mutations into steps at commit points; remaining rules KNOW — verify U-01..U-08]:

```
UndoStep = { mutations: [...], selectionBefore, selectionAfter, pageId }

undo():
  step = undoStack.pop()
  if step.pageId != currentPage: switchPage(step.pageId)          # U-03
  revert(step.mutations); selection = step.selectionBefore         # U-02
  redoStack.push(step)
redo(): symmetric, selection = step.selectionAfter
anyNewMutation(): redoStack.clear()
```

| Thing | Undoable? | Rule | Evidence |
| --- | --- | --- | --- |
| Node creation/deletion, property edits, reorder/reparent, rename, lock, hide | Yes | One step per committed gesture/command | [KNOW] |
| Page add/delete/rename/reorder/duplicate, divider creation | Yes | One step each | [KNOW] |
| Styles, variables, component property definitions | Yes | DS/CP areas | [KNOW] |
| Selection change alone | **No** (not a step) | Selection is restored *as part of* undoing a mutation step | [KNOW] U-02 |
| Current page switch alone | No | Undo may switch page to show the change | [KNOW] U-03 |
| Viewport pan/zoom | No | Undo does not restore viewport; whether it scrolls to reveal the change is unverified | [KNOW] U-04 |
| Layers-panel expand/collapse (`expanded`) | No (although saved) | | [KNOW] U-05 |
| Panel tab, widths, find query, preferences, view toggles (rulers, pixel grid, outlines…) | No | | [KNOW] |
| Comments | No | Separate model | [KNOW] |
| Version restore | Yes? | Restore is non-destructive (adds a new version) [DOC:360038006754 excerpt]; whether Cmd+Z reverts it is unverified | U-06 |

**Step grouping (coalescing)** [KNOW, verify U-07]:
- A drag (move, resize, rotate, layers-panel drag, drag-across toggles) = 1 step on pointer-up.
- Inspector scrub (label drag) = 1 step per drag; typing a value = 1 step on commit (Enter/Tab/blur); Esc in a field restores the old value with no step.
- Arrow-key nudges: each key press is its own step [KNOW, verify — Figma may coalesce rapid nudges].
- Color picker drag = 1 step per pointer-up.
- Text editing: steps are coalesced by typing bursts while in text edit mode; leaving text edit mode closes the group (TX area).
- Batch rename, Replace all, Paste, Duplicate, Group, Create component = 1 step each.
- **Inside a text field** (rename, inspector input, find box), Cmd/Ctrl+Z undoes the field's own text edit, not the document [KNOW].
- **Redo** = ⇧⌘Z / Ctrl+Shift+Z (and Ctrl+Y on Windows [KNOW, verify S-02]).
- **History lifetime**: session-only; closing/reopening a file clears undo history [KNOW]. Illigma parity default: not persisted ([DECISION]; crash recovery restores document state, not undo history).
- **Depth**: no user-visible limit [KNOW]; Illigma minimum 1 000 steps or 512 MB of history, oldest dropped first ([DECISION]).

### 3.14 Version history

- **Open**: File menu → "Show version history" (right sidebar becomes a version list; canvas shows the selected version read-only) [DOC:360038006754 excerpt; SRC:forum tip "not in View"].
- **Autosave checkpoints**: Figma records a checkpoint every **30 minutes** of activity, and the current version tracks live edits [SRC:figma blog "Now you can name and annotate your Figma version history", excerpt]. Illigma: a checkpoint snapshot every 30 min **while the document has unsaved-to-history changes**, plus one on close ([DECISION] aligned to Figma cadence).
- **Named versions**: "Save to version history" **⌥⌘S / Ctrl+Alt+S** [SRC:figma blog, launch-era — verify H-01]; dialog with *Title* (required, non-empty [API `saveVersionHistoryAsync` requires non-empty title]) and *Description* (optional). Also a "+" control in the version panel header [SRC:designcode excerpt].
- **Collapsing**: autosaves between two named versions collapse into an expandable group [SRC:figma blog excerpt].
- **Version row**: label (or timestamp for autosaves), author, time [API REST `Version`]. Context menu: *Restore this version*, *Duplicate* (to a new file), *Edit version info* (named versions), *Copy link* [DOC excerpt for Duplicate/Restore; others KNOW].
- **Preview**: clicking a version shows it read-only; you may select and copy layers from it and paste into the current version [SRC:forum tip 38485].
- **Restore**: non-destructive — the current state is kept as a version and the restored content becomes the new current state [DOC:360038006754 excerpt]. Illigma: restore creates checkpoint "Before restore" + new head; restore is also undoable while the session lasts ([DECISION]).
- **Duplicate**: creates a new file from that version; the copy has no comments or version history from the original [DOC excerpt].
- **Retention**: Figma Starter/drafts: 30 days [DOC excerpt]; Illigma: unlimited by default with a user pruning command ([DECISION]).
- Plugin API `saveVersionHistoryAsync` warns changes immediately preceding the call may not be included [API] — Illigma must flush pending edits before snapshotting ([DECISION]).

### 3.15 Autosave & crash recovery (Illigma expectations; Figma analogue noted)

Figma autosaves continuously to the cloud and shows a sync/offline indicator; offline edits are kept locally and synced later [KNOW]. The 2026-09-27 observation saw a transient connection warning [OBS]. Illigma equivalents ([DECISION], M0, details of storage owned by IO area):

1. **No explicit save required**: every committed undo step is durably journaled within ≤ 2 s (target) and compacted into the file periodically.
2. **Cmd/Ctrl+S**: forces an immediate flush and shows a short "Saved" toast; on an untitled document opens *Save as…* [DECISION; Figma behavior for Cmd+S unverified, H-02].
3. **Crash recovery**: on next launch, if a journal newer than the file exists, offer *Recover* / *Discard*; recovery restores the document, current page, viewport and selection, not undo history.
4. **Status indicator** in the File menu header: Saved / Saving… / Error (with retry).
5. **Quit/close** waits for the flush; if the flush fails, a blocking dialog offers *Retry*, *Save as…*, *Quit anyway*.
6. **External modification** of the file on disk while open: prompt to reload or keep (no silent overwrite).

### 3.16 Notifications / toasts

- **Plugin-API notification model** (adopt as Illigma's toast contract) [API `figma.notify`]: shown at the **bottom of the screen**; message limited to **100 characters** (longer truncated); default timeout **3 s**; `timeout: Infinity` persists; `error: true` uses error styling; optional single action **button** (clicking dismisses unless the action returns `false`); notifications **queue**; dequeue reasons `timeout | dismiss | action_button_click`; a handle can `cancel()`.
- **Editor-originated toasts** [KNOW, verify N-01]: "Copied link to clipboard", "Copied as PNG", "Copied as SVG/CSS", "Exported", missing-font warning, "This instance is detached" etc. Destructive bulk actions (e.g. Replace all, delete page) show no toast but are undoable.
- **File notifications** (library updates available, missing fonts) appear at the bottom of the UI3 navigation bar [DOC:23954856027159 excerpt].
- Toasts never steal keyboard focus; Esc does not dismiss them while the canvas has focus [KNOW].

### 3.17 View toggles, UI zoom and high-DPI

| Toggle | Behavior | Evidence |
| --- | --- | --- |
| Rulers (⇧R) | Shows top/left rulers; ruler origin relative to the selection's top-level frame [KNOW]; dragging from a ruler creates guides (CV). | [SRC:saltfish/raycast]; behavior [KNOW] |
| Pixel grid | Grid of 1 × 1 document-pixel cells, drawn **only at zoom ≥ 400 %** | [DOC:360041065034 excerpt] |
| Snap to pixel grid (⇧⌘' / Ctrl+Shift+') | When on, placement/moves/resizes round to whole pixels (CV owns math) | [DOC:360041065034 excerpt] |
| Layout guides (⌃G mac / Ctrl+Shift+4 win) | Toggles visibility of all layout guides (layout grids) | [DOC:360041065034 excerpt] (toggle in Zoom/view menu); shortcut [SRC:raycast, linuru] |
| Outlines (⌘Y mac) | Renders all layers as hairline outlines; hidden-layer outlines option | [SRC:raycast]; [DOC:5724448965527 title]; visibility article tip mentions ⇧⌘O for outlines (excerpt) — conflict, verify V-18 |
| Pixel preview | Renders the canvas rasterized at 1×/2× | [KNOW]; shortcut conflicting (V-18) |
| Multiplayer cursors (⌥⌘\\) | n/a in Illigma (out of scope) | [SRC:raycast] |
| Show/Hide UI (⌘\\ / Ctrl+\\) | Hides all panels/toolbars; canvas fills window | [DOC:360039831974 excerpt] |
| Minimize UI (⇧\\) | Collapses navigation bar, left panel and right panel to compact chips | [DOC:360039831974 excerpt] |
| Comments (⇧C) | Show/hide comment pins | [KNOW] |

- **Zoom/view options menu** in the right sidebar header holds zoom commands and view toggles (layout guides, multiplayer cursors, …) [DOC:360041065034 excerpt]. Current zoom % is shown there and is editable [KNOW].
- **UI zoom (interface scale)**: zoom in / zoom out / reset; reset is **⌥⇧⌘0** on mac [DOC:360049549913 excerpt]; zoom in/out keys [KNOW: ⌥⇧⌘= / ⌥⇧⌘-, verify V-19]. UI scale changes only chrome size; canvas zoom % is unchanged; persisted per user.
- **High-DPI**: canvas renders at `devicePixelRatio`; at 100 % zoom one document pixel = one CSS pixel = DPR device pixels [KNOW]. Hairlines (selection outlines, guides) stay 1 device-independent pixel at every zoom. Pixel grid lines are drawn on document-pixel boundaries.

### 3.18 Preferences

Main menu → Preferences submenu (toggles show a check mark) [KNOW]; nudge values via "Nudge amount…" dialog [DOC:4404575206295 excerpt]:

- **Nudge amount…**: *Small nudge* and *Big nudge* numeric fields; defaults 1 and 10; values in resolution-independent points; clicking outside or the close control applies [DOC excerpt]. Reachable via Actions search "Nudge amount" [SRC:forum staff]. Big nudge also sets the step of Shift+↑/↓ in numeric fields **and** the Shift+font-size step (e.g. 12 → 22 → 32 with big nudge 10) [SRC:forum 2024]. Validation: positive numbers; decimals allowed? (verify P-PR-01). A reported Figma bug nudges vector points by 2× — parity target is 1× [SRC:forum 50606].
- **Snap to geometry / Snap to objects / Snap to pixel grid**: three independent toggles; holding ⌘/Ctrl while dragging temporarily disables snapping (CV) [KNOW].
- **Keep tool selected after use**: when off, creation tools revert to Move after one object [KNOW].
- **Highlight layers on hover**: enables canvas hover outlines [KNOW].
- **Rename duplicated layers**: when on, duplicates get an incremented numeric suffix; when off they keep the source name [KNOW, verify P-PR-02].
- **Show dimensions on objects**: size label under selection [KNOW].
- **Hide canvas UI during changes**: hides selection handles while scrubbing/editing [KNOW].
- **Keyboard zooms into selection**: keyboard zoom centers on the selection instead of the viewport center [KNOW].
- **Invert zoom direction**, **Use right-click to pan?**, **Theme**, **Keyboard layout…**, **Color profile** (PE), **Font settings** (TX) — list completeness unverified (P-PR-03).
- Preferences are global and apply immediately; they are not undoable [KNOW].

### 3.19 Multiplayer (explicitly out of scope)

Figma's multiplayer (live cursors, avatars, follow, spotlight [catalog 360040322673], cursor chat [4403130802199], viewer history [29638316371479]) is **not** implemented. Requirements that remain: (1) the document model keeps `author`/`user` fields for versions and comments; (2) menus and the Actions menu must not show multiplayer commands; (3) the View toggle "Multiplayer cursors" is omitted. [DECISION]

---
## 4. Inspector & on-canvas controls

### 4.1 Right sidebar (inspector) — global structure

- **Header**: (multiplayer avatars and Share — out of scope), **Present / play** prototype button, **Zoom/view options** menu showing current zoom % [DOC:360041065034 excerpt; layout KNOW].
- **Tabs**: **Design** (⌥8 / Alt+8) and **Prototype** (⌥9 / Alt+9) [OBS shows Design/Prototype tabs; shortcuts SRC:raycast]. Dev Mode (⌥0 / Shift+D toggle) is out of scope. The chosen tab persists across selection changes and page switches [KNOW].
- **Selection header row** (UI3) [KNOW, verify I-01]: shows the selection's layer type/name (e.g. "Frame ▾" with frame presets and type conversion, "Group", "Text", "3 layers selected"/"Mixed") and contextual action buttons: *Create component*, *Use as mask*, *Boolean groups ▾*, *Create multiple components*, *Edit object/vector*, *Crop* (images), *Detach/Go to main* (instances).
- **Panel width**: resizable by dragging its left edge [KNOW; DOC:360039831974 excerpt confirms left sidebar resize]; UI preference.
- **Sections**: every section has a title; list sections (Fill, Stroke, Effects, Layout guide, Export) have **+** (add), **−** per item (remove), a styles/variables picker, per-item visibility eye, and drag-reorder of items [KNOW; contents owned by PE/FR/DS areas]. An empty list section shows only its title and **+** [KNOW].

### 4.2 Section order per selection type (Design tab)

`→` separates sections in top-to-bottom order. [OBS] rows were seen live on 2026-09-27; all other rows are [KNOW] and must be verified (§8 I-02..I-14).

| # | Selection | Sections (Design tab), in order | Evidence |
| --- | --- | --- | --- |
| 1 | **Nothing selected (page)** | Page (canvas background color; "Show in exports" option [KNOW]) → Variables (open local variables; page mode picker) → Styles (local Text, Color, Effect, Layout-guide styles) → Export (page export settings) | Page properties visible [OBS]; section list [KNOW] |
| 2 | **Frame** (top-level, `layoutMode = NONE`) | Position → Layout → Appearance → Fill → Stroke → Effects → Layout guide → Export. Layout shows *Freeform* (no auto layout) selected, W/H, *Clip content* checkbox. | **[OBS]** (frame 6:1826: "Position, Layout, Appearance, Fill, Stroke, Effects, Layout guide and Export; Freeform selected; Clip content checked") |
| 3 | **Frame nested inside a frame** | As #2; Position additionally shows **Constraints** (horizontal/vertical) [KNOW] | [KNOW] |
| 4 | **Auto layout frame** | As #2 but Layout section ("Auto layout") shows: flow (vertical/horizontal/grid) and **Wrap**, W/H with Hug/Fill/Fixed, 9-position alignment, gap, padding, *Clip content*, and a settings (⋯) popover with *strokes included in layout*, *canvas stacking* (first/last on top), *layout version* (Updated/Legacy), baseline alignment, auto spacing | **[OBS]** (container 6:1274) |
| 5 | **Child of an auto layout frame** | Position: X/Y and alignment are disabled while in flow, plus an *Ignore auto layout* (absolute position) control; Layout: W/H with Fixed/Hug/Fill and min/max | **[OBS]** (right-inspector: "auto-layout-controlled X/Y and alignment are disabled"); ignore-AL control [KNOW] |
| 6 | **Group** | Position → Layout (W/H; offers adding auto layout) → Appearance (opacity, blend, visibility; **no corner radius**) → Selection colors (if any) → Effects → Export. **No Fill/Stroke** sections. | No fills/strokes on `GroupNode` **[API]**; order [KNOW] |
| 7 | **Section** | Position → Layout (W/H) → Appearance? → Fill → Stroke → Export; (Dev status out of scope) | `SectionNode` has fills, strokes, corner radius **[API]**; order [KNOW] |
| 8 | **Rectangle / Ellipse / Polygon / Star / Vector / Boolean group** | Position → Layout (W/H) → Appearance (opacity, corner radius where applicable, blend, visibility) → Fill → Stroke → Effects → Export. Boolean group header shows the operation selector. Ellipse arc, polygon count and star ratio are edited on-canvas/in Appearance (VC area). | [KNOW] |
| 9 | **Line / Arrow** | As #8 but Layout shows length (W) and no editable H; Stroke includes endpoint/arrowhead controls; Fill section absent? | [KNOW] verify I-08 |
| 10 | **Text** | Position → Layout (W/H, text resizing: auto width / auto height / fixed / truncate) → Appearance → **Typography** → Fill → Stroke → Effects → Export | **[OBS]** (right-inspector lists "Position, Layout/Auto layout, Appearance, Typography, Fill, Stroke, Effects"); resizing location [KNOW] |
| 11 | **Main component** | Component header (name, description/documentation link editor) → **Properties** (component properties list, **+** create property) → Position → Layout → Appearance → Fill → Stroke → Effects → Layout guide → Export | [KNOW] |
| 12 | **Component set** | Component-set header → **Properties** (variant properties and values, add variant) → Position → Layout → Appearance → Fill → Stroke → Effects → Layout guide → Export | [KNOW] |
| 13 | **Variant (component inside a set)** | Variant property value pickers at top → as #11 | [KNOW] |
| 14 | **Instance** | Instance header (main component name with swap menu; ⋯ menu: Go to main component, Push changes to main, Reset all changes, Detach instance) → **Instance properties** (variant dropdowns, boolean toggles, text fields, instance-swap pickers, exposed nested instances, slots) → Position → Layout → Appearance → Fill → Stroke → Effects → Layout guide → Export | [KNOW] (CP area owns controls) |
| 15 | **Image** (shape with image fill) | As #8; Fill row shows the image thumbnail; header offers *Crop* | [KNOW] |
| 16 | **Multiple layers, same type** | Same sections as the type; disagreeing values show **Mixed** | [KNOW] |
| 17 | **Multiple layers, mixed types** | Only sections applicable to **every** selected node appear, plus *Selection colors*; whether *Typography* appears when the selection mixes text and non-text must be verified | [KNOW] verify I-12 |
| 18 | **Text edit mode with a character range** | Typography and Fill reflect the range; other sections reflect the layer | [KNOW] (TX) |
| 19 | **Vector edit mode** | Position shows selected vertex X/Y; Appearance shows vertex corner radius; Stroke caps per endpoint | [KNOW] (VC) |
| 20 | **Slice** | Position → Layout (W/H) → Export | [KNOW] |

**Selection colors** section [KNOW, verify I-13]: appears when the selection (incl. descendants) uses ≥ 2 distinct paints (or any for containers); lists unique solid colors/styles/variables with usage; editing one recolors every usage; position in the list (before/after Effects) is unverified. Mixed-selection color behavior is documented in [DOC:360042553434 title only].

### 4.3 Mixed values and numeric field behavior (applies to all sections)

- **Mixed**: when selected nodes disagree, the field shows the placeholder **Mixed** (not blank/zero) [KNOW]. Typing a value applies it to all; Esc leaves all untouched [KNOW]. List sections with disagreeing contents (e.g. fills) show "Click + to replace mixed content" and **+** replaces all lists with one default item [KNOW, verify I-14].
- **Scrubbing**: dragging horizontally on a field's label/icon changes the value continuously; Shift = ×10 step; Alt/Option = ×0.1 step? [KNOW, verify I-15]. On *Mixed* fields scrubbing applies the delta to each node's own value [KNOW, verify].
- **Keyboard in fields**: ↑/↓ = ± small nudge? or ±1; Shift+↑/↓ = ± big nudge [SRC:forum big-nudge affects font-size steps; general rule KNOW]; Enter commits and keeps focus? (verify I-16); Tab commits and moves to the next field; Shift+Tab previous; Esc reverts and blurs.
- **Math**: fields accept arithmetic (`+ − * /`, parentheses) e.g. `100/3`, `+10` relative to current [KNOW]; units suffixes (`px`, `%` for opacity) accepted [KNOW]. Results are rounded per the property's precision (CV/PE own precision rules).
- **Undo**: one committed value or one scrub = one undo step (§3.13).

### 4.4 Prototype tab structure

| Selection | Sections (Prototype tab) | Evidence |
| --- | --- | --- |
| Nothing selected | Flow starting points (ordered list) → Prototype settings (device/model, background color `prototypeBackgrounds`) | `flowStartingPoints`, `prototypeBackgrounds` [API]; layout [KNOW] |
| Top-level frame | Flow starting point (+) → Interactions → Scroll behavior (overflow, position: scroll with parent / fixed / sticky) → Overlay settings (if used as overlay) | [KNOW] (PR area owns) |
| Nested layer | Interactions → Scroll behavior (position) | [KNOW] |

### 4.5 Bottom toolbar (UI3)

| Group (left → right) | Tools in flyout (shortcut) | Evidence |
| --- | --- | --- |
| Move tools | Move (V) · Hand (H) · Scale (K) | Move default; Hand & Scale behind the arrow [DOC:360041064174 excerpt] |
| Region tools | Frame (F, also A [KNOW]) · Section (⇧S) · Slice (S) | Frame preselected; Section & Slice in flyout [DOC:360041064174 excerpt] |
| Shape tools | Rectangle (R) · Line (L) · Arrow (⇧L) · Ellipse (O) · Polygon · Star · Image/video… (⇧⌘K) | Shape list [SRC:uxcel excerpt]; Image entry [KNOW] |
| Creation tools | Pen (P) · Pencil (⇧P) | [KNOW]; shortcuts [SRC:raycast] |
| Text | Text (T) | [KNOW] |
| Comment | Comment (C) | [KNOW] (local comments P2) |
| Actions | Opens Actions menu (⌘K) | [DOC:23570416033943 excerpt] |
| Mode switch (right end) | Design · (Draw) · (Dev Mode) | [KNOW]; only Design in scope |

Rules [KNOW unless noted; verify T-01..T-04]:
1. A flyout button displays and activates the **last-used** tool of its group; its chevron opens a menu listing every tool with its shortcut.
2. Activating a tool by shortcut updates its group's displayed tool.
3. Creation tools revert to **Move** after one object unless *Keep tool selected after use* is on; Esc returns to Move.
4. Holding **Space** temporarily switches to Hand; releasing restores the previous tool. Holding **Z** = temporary zoom tool (click zoom in, Alt/Option+click zoom out, drag = zoom to rectangle) (CV area).
5. In **vector edit mode** the toolbar is replaced by a contextual toolbar (Move/Select, Pen, Bend, Paint bucket, Lasso? , **Done**) [KNOW]; in image crop and text edit modes it may show contextual controls (verify T-03).
6. The toolbar cannot be moved/docked or customized [SRC:forum Sep 2024 Figmate reply, excerpt].

### 4.6 Left sidebar header, navigation bar, and menus

- **Navigation bar (UI3 rail)**: File (pages/layers), Assets, Find & replace; notifications (library updates, missing fonts) at the bottom [DOC:23954856027159 excerpt; OBS "navigation rail"].
- **Left sidebar header**: Main menu (logo) · File name with **File menu** dropdown (rename file, duplicate, move — n/a locally, version history, export) · *Minimize UI* control [DOC:360039831974 excerpt].
- **Main menu structure** [KNOW — exact item list and order verify M-01]. Every item shows its shortcut and is disabled when not applicable:

| Menu | Items (functional list; shortcuts in §5) |
| --- | --- |
| *(top)* | Back to files (→ Illigma file browser / recent files) · Actions… (⌘K) |
| **File** | New design file · Import file… (incl. .fig, Sketch — IO) · Place image/video… (⇧⌘K) · Save local copy / Save as… · Save to version history… (⌥⌘S) · Show version history · Export… (⇧⌘E) · Export frames to PDF… · Preferences/Color profile entries |
| **Edit** | Undo · Redo · Copy · Cut · Paste · Paste here · Paste to replace (⇧⌘R) · Paste over selection (⇧⌘V) · Duplicate (⌘D) · Delete · Copy as ▸ (PNG ⇧⌘C, SVG, CSS, link to selection) · Copy properties (⌥⌘C) · Paste properties (⌥⌘V) · Pick color (I) · Select all (⌘A) · Select inverse (⇧⌘A) · Select none · Select matching layers (⌥⌘A) · Select all with ▸ (same fill / stroke / effect / text properties / font / instance) · Find and replace… (⌘F) |
| **View** | Pixel grid · Snap to pixel grid · Layout guides · Rulers · Outlines ▸ · Pixel preview · Multiplayer cursors (omitted) · Comments · Panels ▸ (Layers ⌥1, Assets ⌥2, Design ⌥8, Prototype ⌥9) · Minimize UI (⇧\\) · Show/Hide UI (⌘\\) · Zoom in/out/100 %/to fit/to selection · Previous/next page · Zoom to previous/next frame |
| **Object** | Group selection (⌘G) · Ungroup (⇧⌘G) · Frame selection (⌥⌘G) · Remove frame? · Create section? · Use as mask (⌃⌘M) · Set as thumbnail (n/a → Illigma file thumbnail) · Add auto layout (⇧A) · Remove auto layout (⌥⇧A) · Create component (⌥⌘K) · Create multiple components · Reset all changes · Detach instance (⌥⌘B) · Main component ▸ (Go to, Push changes, Restore) · Bring to front / Bring forward / Send backward / Send to back · Flip horizontal/vertical (⇧H/⇧V) · Rotate 180° / 90° left / 90° right · Flatten (⌘E) · Outline stroke (⌥⌘O) · Boolean groups ▸ · Rasterize selection · Resize to fit (⌥⇧⌘R) · Lock/Unlock (⇧⌘L) · Show/Hide (⇧⌘H) · Collapse layers (⌥L) · Remove fill (⌥/) · Remove stroke (⇧/) · Swap fill & stroke (⇧X) · Move to page ▸ |
| **Text** | Bold · Italic · Underline · Strikethrough · Create link · Bulleted list · Numbered list · Alignment ▸ · Adjust ▸ (size, weight, line height, letter spacing) · Text case ▸ |
| **Arrange** | Align left/center/right/top/middle/bottom · Distribute horizontal/vertical spacing · Tidy up · Round to pixel |
| **Vector** | Join selection (⌘J) · Smooth join (⇧⌘J) · Delete and heal (⇧⌫) · Flatten · Outline stroke · Offset path · Simplify path |
| **Plugins / Widgets** | Omitted ([DECISION]) |
| **Preferences** | Toggles of §3.18 · Nudge amount… · Theme · Keyboard layout… · Interface scale ▸ |
| **Help** | Keyboard shortcuts (⌃⇧?) · Release notes · About |

- **Native menubar** ([DECISION], desktop app): on macOS the same tree is mirrored into the system menubar (App, File, Edit, View, Object, Text, Arrange, Vector, Window, Help); on Windows/Linux the in-app Main menu is primary.
- **Layer-row context menu** = the canvas context menu for that selection (Copy/Paste/Paste here, Select layer…, Bring to front …, Group/Frame/Ungroup, Flatten, Outline stroke, Use as mask, Create component, Show/Hide, Lock/Unlock, Move to page ▸, Rename, Copy/Paste properties, Copy as ▸, Delete) [KNOW, verify M-02]; right-clicking an unselected row first selects it [KNOW].
- **Page-row context menu**: Copy link to page · Rename page · Duplicate page · Delete page · (Add divider?) [KNOW, verify P-02].

---
## 5. Keyboard shortcuts (macOS / Windows & Linux)

**How to read this table.** "Win/Linux" applies to Windows and Linux ([DECISION] Linux = Windows). *Owner* is the area that specifies the action's semantics; this area owns only the binding, dispatch (§3.9) and the shortcuts panel. Evidence: **D** = [DOC] excerpt (article id in §9), **S** = [SRC] (R = Raycast dataset, which has known errors; C = other cheat sheets; F = Figma forum/blog), **K** = [KNOW]. Every row not backed by **D** is listed collectively in §8 (S-06: "verify every K/S-only binding in Figma's in-app shortcut panel on macOS and Windows"). ⚠ marks a conflict between sources.

### 5.1 Tools

| Action | macOS | Win/Linux | Ev. | Owner |
| --- | --- | --- | --- | --- |
| Move | V | V | S-R, K | CV |
| Hand (toggle) / temporary Hand | H / hold Space | H / hold Space | S-R, K | CV |
| Scale | K | K | S-R, D:360041064174 (tool exists) | CV |
| Frame | F or A | F or A | S-R (F), K (A) | FR |
| Section | ⇧S | Shift+S | S-R | FR |
| Slice | S | S | S-R | VC |
| Rectangle | R | R | S-R, S-C | VC |
| Ellipse | O | O | S-R | VC |
| Line | L | L | S-R | VC |
| Arrow | ⇧L | Shift+L | S-R | VC |
| Polygon / Star | — (no default) | — | K | VC |
| Pen | P | P | S-R | VC |
| Pencil | ⇧P | Shift+P | S-R | VC |
| Text | T | T | S-R | TX |
| Comment | C | C | S-R | UX (local, P2) |
| Pick color (eyedropper) | I (also ⌃C) | I | S-R (I), K (⌃C) | PE |
| Place image/video | ⇧⌘K | Ctrl+Shift+K | S-R | PE |
| Zoom tool (hold / click / Alt-click) | Z | Z | S-R, K | CV |
| Paint bucket (vector edit) | B | B | S-R | VC |
| Bend (vector edit) | hold ⌘ | hold Ctrl | S-R | VC |
| Shape builder | ⚠ no verified binding | — | D:31616004109847 (tool exists, title only) | VC |
| Actions menu | ⌘K | Ctrl+K | D:23570416033943 | UX |
| Actions menu (legacy Quick actions) | ⌘/ | Ctrl+/ (⚠ R: Ctrl+P) | S-F, S-R | UX |

### 5.2 View & panels

| Action | macOS | Win/Linux | Ev. | Owner |
| --- | --- | --- | --- | --- |
| Show/Hide UI | ⌘\\ | Ctrl+\\ | D:360039831974 | UX |
| Minimize UI | ⇧\\ | Shift+\\ | D:360039831974 | UX |
| File (layers) tab | ⌥1 | Alt+1 (⚠ D:360040449873 says Ctrl+1) | D:360039831974 | UX |
| Assets tab | ⌥2 | Alt+2 | D:360039831974 | UX |
| Design tab | ⌥8 | Alt+8 | S-R | UX |
| Prototype tab | ⌥9 | Alt+9 | S-R | UX |
| Dev Mode / Inspect | ⌥0 / ⇧D | Alt+0 / Shift+D | S-R, K | out of scope |
| Rulers | ⇧R | Shift+R | S-R, S-C | UX/CV |
| Pixel grid | ⚠ ⌘' (D table) vs ⇧' (D inline text) | ⚠ Ctrl+' | D:360041065034 (conflicting), S-R says Ctrl+` | UX |
| Snap to pixel grid | ⇧⌘' | Ctrl+Shift+' | D:360041065034 | UX/CV |
| Layout guides (grids) | ⌃G | Ctrl+Shift+4 | S-R, S-C | FR |
| Outlines | ⌘Y (⚠ ⇧⌘O mentioned in D:360041112614 tip) | ⚠ Ctrl+Shift+3 (R) | S-R | UX |
| Pixel preview | ⚠ ⌥⌘Y (R) | ⚠ Ctrl+Shift+P (R) | S-R | UX |
| Multiplayer cursors | ⌥⌘\\ | Ctrl+Alt+\\ | S-R | omitted |
| Show/hide comments | ⇧C | Shift+C | K | UX |
| Keyboard shortcuts panel | ⌃⇧? (⚠ R: ⌘⇧?) | Ctrl+Shift+? | K, S-R, S-C | UX |
| Find and replace | ⌘F | Ctrl+F | D:9141292269847 | UX |
| Interface scale: reset | ⌥⇧⌘0 | Ctrl+Alt+Shift+0 | D:360049549913 (mac) / K (win) | UX |
| Interface scale: larger / smaller | ⌥⇧⌘= / ⌥⇧⌘- | Ctrl+Alt+Shift+= / - | K | UX |

### 5.3 Zoom & navigation

| Action | macOS | Win/Linux | Ev. | Owner |
| --- | --- | --- | --- | --- |
| Zoom in | ⇧+ ; ⌘+ ; + | Shift++ ; Ctrl+= ; + | D:360041065034 (⇧+), S-R (⌘+), K (+) | CV |
| Zoom out | ⇧- ; ⌘- ; - | Shift+- ; Ctrl+- ; - | D:360041065034, S-R, K | CV |
| Zoom to 100 % | ⇧0 ⚠ / ⌘0 | Shift+0 / Ctrl+0 | S-C (both reported) | CV |
| Zoom to fit (all) | ⇧1 | Shift+1 | D:360041065034 | CV |
| Zoom to selection | ⇧2 | Shift+2 | D:360041065034; API `scrollAndZoomIntoView` "equivalent of Shift-1"(sic) | CV |
| Zoom to next / previous frame | N / ⇧N | N / Shift+N | S-C | CV |
| Previous / next page | PgUp / PgDn ⚠ (R maps to frames) | PgUp / PgDn | S-C, S-R | UX |

### 5.4 Selection

| Action | macOS | Win/Linux | Ev. | Owner |
| --- | --- | --- | --- | --- |
| Select all | ⌘A | Ctrl+A | S-R | CV |
| Select inverse | ⇧⌘A | Ctrl+Shift+A | S-R | CV |
| Select none / exit mode | Esc | Esc | K | CV |
| Select matching layers | ⌥⌘A | Ctrl+Alt+A | D:21523793229463 | CV |
| Select children | Enter | Enter | S-R | CV |
| Select parent | ⇧Enter (also \\) ⚠ R says Esc | Shift+Enter | K | CV |
| Next / previous sibling | Tab / ⇧Tab | Tab / Shift+Tab | S-R | CV |
| Deep select (click / marquee) | ⌘-click / ⌘-drag | Ctrl-click / Ctrl-drag | S-R | CV |
| Layers panel: add/remove row | ⌘-click row | Ctrl-click row | D:360040449873 | UX |
| Layers panel: range | ⇧-click row | Shift-click row | D:360040449873 | UX |
| Collapse layers | ⌥L | Alt+L | S-F | UX |
| Expand/collapse recursively | ⌥-click chevron | Alt-click chevron | S-F | UX |

### 5.5 Edit

| Action | macOS | Win/Linux | Ev. | Owner |
| --- | --- | --- | --- | --- |
| Undo | ⌘Z | Ctrl+Z | S-R | UX/all |
| Redo | ⇧⌘Z | Ctrl+Shift+Z (⚠ also Ctrl+Y?) | S-R, K | UX/all |
| Copy / Cut / Paste | ⌘C / ⌘X / ⌘V | Ctrl+C / X / V | S-R | CV |
| Paste over selection | ⇧⌘V | Ctrl+Shift+V | S-R (named "Paste in place"), K | CV |
| Paste to replace | ⇧⌘R | Ctrl+Shift+R | K | CV |
| Copy as PNG | ⇧⌘C | Ctrl+Shift+C | K | PE |
| Copy properties / Paste properties | ⌥⌘C / ⌥⌘V | Ctrl+Alt+C / Ctrl+Alt+V | S-R | CV |
| Duplicate | ⌘D | Ctrl+D | S-R | CV |
| Delete | ⌫ / ⌦ | Backspace / Delete | S-R | CV |
| Rename layer(s) | ⌘R | Ctrl+R | S-F (blog), S-R | UX |
| Edit shape / text / image / enter vector edit | Enter | Enter | S-R | VC/TX |
| Done / exit edit mode | Esc | Esc | S-R | VC/TX |
| Nudge (small / big) | ← ↑ → ↓ / ⇧+arrows | same | D:4404575206295 (values), S-R | CV |
| Export… | ⇧⌘E | Ctrl+Shift+E | K | PE |
| Save to version history | ⌥⌘S | Ctrl+Alt+S | S-F (blog, launch-era) | UX |
| Save / flush (Illigma) | ⌘S | Ctrl+S | [DECISION] | UX/IO |
| Copy link to selection | ⌘L ⚠ | Ctrl+L | K | UX |
| Present / play prototype | ⌥⌘↵ | Ctrl+Alt+Enter | K | PR |

### 5.6 Transform, shape & arrange

| Action | macOS | Win/Linux | Ev. | Owner |
| --- | --- | --- | --- | --- |
| Set opacity 10–90 % / 100 % / 0 % | 1–9 / 0 / 0 0 | same | S-R | PE |
| Flip horizontal / vertical | ⇧H / ⇧V | Shift+H / Shift+V | S-R | CV |
| Resize to fit | ⌥⇧⌘R | Ctrl+Alt+Shift+R | S-R | FR |
| Group / Ungroup | ⌘G / ⇧⌘G | Ctrl+G / Ctrl+Shift+G | S-R | FR |
| Frame selection | ⌥⌘G | Ctrl+Alt+G | S-R | FR |
| Use as mask | ⌃⌘M | Ctrl+Alt+M | S-R | VC |
| Flatten | ⌘E (⚠ ⌥⇧F per Feb-2025 release notes) | Ctrl+E | S-R, S-F | VC |
| Outline stroke | ⌥⌘O | Ctrl+Alt+O | K | VC |
| Boolean union / subtract / intersect / exclude | ⌥⇧U / ⌥⇧S / ⌥⇧I / ⌥⇧E | Alt+Shift+U/S/I/E | D:360039957534 (U,S,I), K (E), S-F (Feb 2025) | VC |
| Join / smooth join / delete & heal (vector) | ⌘J / ⇧⌘J / ⇧⌫ | Ctrl+J / Ctrl+Shift+J / Shift+Backspace | S-R | VC |
| Remove fill / remove stroke / swap | ⌥/ / ⇧/ / ⇧X | Alt+/ / Shift+/ / Shift+X | S-R | PE |
| Bring forward / send backward | ⌘] / ⌘[ | Ctrl+] / Ctrl+[ | S-R | CV |
| Bring to front / send to back | ⌥⌘] / ⌥⌘[ | **Ctrl+Shift+] / Ctrl+Shift+[** | S-R, K | CV |
| Align left / right / top / bottom | ⌥A / ⌥D / ⌥W / ⌥S | Alt+A / D / W / S | D:360039956914 (letters), S-R | CV |
| Align horizontal / vertical centers | ⌥H / ⌥V | Alt+H / Alt+V | D:360039956914, S-R | CV |
| Distribute horizontal / vertical spacing | ⌃⌥H / ⌃⌥V | ⚠ Ctrl+Alt+H/V (R) vs Alt+Shift+H/V (K) | S-R, K | CV |
| Tidy up | ⌃⌥T | ⚠ Ctrl+Alt+T | S-R | CV |
| Lock / unlock | ⇧⌘L | Ctrl+Shift+L | D:360041596573 | UX |
| Show / hide | ⇧⌘H | Ctrl+Shift+H | D:360041112614 | UX |
| Add / remove auto layout | ⇧A / ⌥⇧A | Shift+A / Alt+Shift+A | S-R | AL |

### 5.7 Components & libraries

| Action | macOS | Win/Linux | Ev. | Owner |
| --- | --- | --- | --- | --- |
| Create component | ⌥⌘K | Ctrl+Alt+K | S-R | CP |
| Detach instance | ⌥⌘B | Ctrl+Alt+B | S-R | CP |
| Libraries | ⌥⌘O | Ctrl+Alt+O | S-R | DS |
| Insert component (assets search) | ⇧I ⚠ | Shift+I | K | UX/CP |
| Reset overrides / Go to main | no verified default (R's ⌥⌘R / ⌥⌘B claims are doubtful) | — | — | CP |

### 5.8 Text (semantics owned by TX)

| Action | macOS | Win/Linux | Ev. |
| --- | --- | --- | --- |
| Bold / Italic / Underline | ⌘B / ⌘I / ⌘U | Ctrl+B / I / U | S-R |
| Strikethrough | ⇧⌘X | Ctrl+Shift+X | S-R |
| Align left / center / right / justify | ⌥⌘L / ⌥⌘T / ⌥⌘R / ⌥⌘J | Ctrl+Alt+L / T / R / J | S-C (linuru, pie-menu, tilda) ⚠ R & verpex use ⇧⌘ (conflicts with Lock ⇧⌘L) |
| Font size + / − | ⇧⌘> / ⇧⌘< | Ctrl+Shift+> / < | S-R |
| Font weight + / − | ⌥⌘> / ⌥⌘< | Ctrl+Alt+> / < | K |
| Line height + / − | ⌥⇧> / ⌥⇧< | Alt+Shift+> / < | S-R |
| Letter spacing + / − | ⌥> / ⌥< | Alt+> / < | S-R |
| Bulleted / numbered list | ⇧⌘8 / ⇧⌘7 | Ctrl+Shift+8 / 7 | K |
| Create link | ⚠ ⌘K was legacy; now taken by Actions | — | S-F |

### 5.9 Modifier gestures (semantics owned by CV)

Alt/Option (hold): measure distances; Alt-drag: duplicate; Alt-resize: from center; Shift-resize: proportional; Shift-drag: constrain axis/15° rotation; Cmd/Ctrl-resize: ignore constraints / crop image; Space during draw/drag: move the shape being drawn; Cmd/Ctrl while dragging: disable snapping [S-R; K]. Alt/Option+click chevron (layers): recursive expand/collapse [S-F].

---
## 6. Parity checklist

Format: `- [ ] **UX-NNN** Name — expected Figma behavior. _Data:_ … _Test:_ … _M#·P#·evidence_`. All items are **Not started**.

### 6.1 Layers panel — tree and rows

- [ ] **UX-001** Top-most-first ordering — rows list each parent's children in reverse array order (last child = top row); inserting a node without index puts it at the top of its parent's list. _Data:_ `children` (back-to-front), `insertChild(index)` _Test:_ create rect A then rect B on a page; rows read B, A; `children` = [A, B]; Bring to front A → rows A, B. _M1·P0·[API]_
- [ ] **UX-002** Indentation by depth — each nesting level indents one step; page children have depth 0. _Data:_ `parent` _Test:_ frame > group > rect shows three indentation levels; reparenting updates indentation immediately. _M1·P0·[KNOW]_
- [ ] **UX-003** Container chevrons — only nodes with children (frame, group, section, component, component set, instance, boolean, slot, transform group) show a chevron; empty containers show none. _Data:_ `ContainerMixin`, `children.length` _Test:_ empty frame has no chevron; add child → chevron appears collapsed/expanded per UX-020 rules. _M1·P0·[API][KNOW]_
- [ ] **UX-004** Type icons distinguish node types — distinct icon per type: frame, group, section, component, component set, instance, slot, rectangle, ellipse, polygon, star, line, arrow, vector, text, image-filled shape, video, boolean (per op), slice, mask. _Data:_ `type`, `isMask`, `booleanOperation`, fills[i].type _Test:_ fixture with one of each; each row icon category matches a Figma screenshot of the same fixture. _M1·P0·[KNOW]_
- [ ] **UX-005** Auto layout flow icons — frames with auto layout show a flow-specific icon: horizontal, vertical, wrap, grid; icon updates immediately when flow changes and reverts to frame icon when auto layout is removed. _Data:_ `layoutMode`, `layoutWrap` _Test:_ toggle Shift+A, switch flows, toggle wrap, Alt+Shift+A; compare row icons with Figma per state. _M4·P1·[KNOW]_
- [ ] **UX-006** Component-family marking — component, component set, instance and slot rows are visually marked as a family distinct from ordinary layers (Figma: purple). _Data:_ `type` _Test:_ rows of COMPONENT/INSTANCE are distinguishable without reading names. _M5·P1·[KNOW]_
- [ ] **UX-007** Text auto-naming — a text layer's row name follows its characters while `autoRename` is true; after a manual rename it no longer changes when text is edited. _Data:_ `TextNode.autoRename`, `name`, `characters` _Test:_ type "Hello" → row "Hello"; edit to "Hi" → "Hi"; rename to "Title"; edit text → row stays "Title". _M3·P0·[API]_
- [ ] **UX-008** Long-name display — names longer than the row are visually truncated with ellipsis; stored name unchanged; full name visible in rename editor. _Data:_ `name` _Test:_ 200-char name; row truncated, Cmd+R shows full text. _M1·P1·[KNOW]_
- [ ] **UX-009** Hidden-row rendering — rows of nodes with `visible=false` show a persistent hidden indicator and de-emphasized name; descendants of a hidden node are de-emphasized but show no own toggle state change. _Data:_ `visible` (effective = self ∧ ancestors) _Test:_ hide a frame; child rows dimmed; child `visible` still true. _M1·P0·[API][KNOW]_
- [ ] **UX-010** Locked-row rendering — rows of `locked=true` nodes show a persistent lock indicator; descendants show an inherited (subdued) lock state. _Data:_ `locked` (effective = self ∨ ancestor) _Test:_ lock a frame; child rows show inherited lock; child `locked` stays false. _M1·P0·[API][KNOW]_
- [ ] **UX-011** Mask rows — the mask layer shows a mask icon and the siblings it masks (rows above it within the same parent) are identifiable as masked. _Data:_ `isMask`, `maskType` _Test:_ Use as mask on bottom rect of a group with 2 shapes above; panel shows mask icon; both shapes indicated as masked; reorder a shape below the mask → no longer masked. _M2·P1·[API]_
- [ ] **UX-012** Fixed-children section headers — frames with `numberOfFixedChildren > 0` show two header rows separating fixed (top) and scrolling children; frames with 0 show none. _Data:_ `numberOfFixedChildren` _Test:_ set one child "Fixed" in Prototype tab; headers appear; unset → headers disappear. _M7·P1·[API]_
- [ ] **UX-013** Row hover highlights canvas — hovering a row draws the node's hover outline on canvas (also for nodes inside collapsed/clipped parents); no outline for hidden nodes? (verify). _Data:_ `transient hover` _Test:_ hover each row of fixture; canvas shows outline matching node bounds. _M1·P0·[DOC:360040449873 excerpt]_
- [ ] **UX-014** Instance sublayers read-only structure — rows inside an instance (outside slots) cannot be reordered, reparented, deleted or receive drops; they can be selected, renamed (override) and hidden (override). _Data:_ `InstanceNode`, `SlotNode` _Test:_ try dragging an instance child to new index → rejected; hide it → override recorded. _M5·P0·[API][KNOW]_
- [ ] **UX-015** Large-tree performance — panel virtualizes rows; expanding a frame with 10 000 descendants and scrolling stays ≥ 55 fps; selecting a node at depth 50 reveals it in < 100 ms. _Data:_ `—` _Test:_ synthetic 10k-node page benchmark. _M8·P1·[DECISION]_
- [ ] **UX-016** Section/component-set child listing — component set rows list variants as children; section rows list contained nodes. _Data:_ `ComponentSetNode.children`, `SectionNode.children` _Test:_ combine 3 components as variants → set row with 3 variant rows. _M5·P1·[API]_

### 6.2 Layers panel — selection

- [ ] **UX-017** Click row selects — clicking a row replaces the selection with that node at any depth, including locked and hidden nodes; inspector updates. _Data:_ `page.selection` _Test:_ click a locked nested rect's row → selected; inspector shows rect. _M1·P0·[DOC:360040449873 excerpt][KNOW]_
- [ ] **UX-018** Shift-click range — selects every row between anchor and clicked row in visible order; parents in range swallow their in-range descendants (normalization). _Data:_ `selection` _Test:_ rows A,B(expanded frame: b1,b2),C; click A, Shift-click C → selection {A,B,C} (b1,b2 implied). Compare with Figma. _M1·P0·[DOC:360040449873 excerpt][KNOW]_
- [ ] **UX-019** Cmd/Ctrl-click toggles — adds/removes the clicked row's node; adding a descendant of a selected node replaces the ancestor? or is ignored? (verify) ; adding an ancestor removes its selected descendants. _Data:_ `selection` normalization _Test:_ select child c, Cmd-click parent P → selection {P}. _M1·P0·[DOC:360040449873 excerpt][API]_
- [ ] **UX-020** Selection normalization — selection never contains both a node and its descendant, never contains duplicates, only contains nodes of the current page. _Data:_ `PageNode.selection` _Test:_ programmatically set [P, child] → stored [P]. _M1·P0·[API]_
- [ ] **UX-021** Range anchor — anchor is the last row clicked without Shift; with canvas-originated selection the anchor is the top-most selected row. _Data:_ `transient` _Test:_ select on canvas, Shift-click row; compare range to Figma. _M1·P1·[KNOW]_
- [ ] **UX-022** Chevron and toggles do not select — clicking a chevron, lock or eye never changes selection. _Data:_ `—` _Test:_ with X selected click eye of Y → selection still X, Y hidden. _M1·P0·[KNOW]_
- [ ] **UX-023** Empty-area click clears — clicking blank panel space below the last row clears the selection. _Data:_ `selection` _Test:_ click below rows → selection []. _M1·P2·[KNOW]_
- [ ] **UX-024** Arrow keys never move row focus — with the layers panel focused, arrow keys nudge the selected layers (small/big nudge) instead of moving row highlight. _Data:_ `nudge prefs` _Test:_ click row, press ↓ → node y +1, selection unchanged. _M1·P0·[KNOW]_
- [ ] **UX-025** Hidden-node selection affordance — selecting a hidden node from the panel shows its bounds on canvas without rendering it. _Data:_ `visible` _Test:_ select hidden rect via row; selection box visible; pixels unchanged. _M1·P1·[KNOW]_

### 6.3 Expand / collapse and reveal

- [ ] **UX-026** Chevron toggles one container — click toggles `expanded` of that container only; children's own expanded states are preserved when re-expanded. _Data:_ `expanded` _Test:_ expand frame & its child group; collapse frame; expand frame → group still expanded. _M1·P0·[API][KNOW]_
- [ ] **UX-027** Alt/Option-click recursive — Alt-click on a chevron sets that container and all descendant containers to the new state. _Data:_ `expanded` _Test:_ 4-level nested frames collapsed; Alt-click top → all 4 expanded; Alt-click again → all collapsed. _M1·P1·[SRC:forum]_
- [ ] **UX-028** Collapse layers (⌥L / Alt+L and header control) — collapses every container on the page except ancestors of selected nodes; with empty selection collapses all. _Data:_ `expanded` _Test:_ expand all; select deep node; ⌥L → only its ancestor path expanded. _M1·P1·[SRC:forum][DOC:360040449873 excerpt]_
- [ ] **UX-029** Multi-select chevron toggle — Cmd/Ctrl-click on a chevron of one of several selected containers toggles all selected containers (reported, regressed 2026-09). _Data:_ `expanded` _Test:_ select 3 frames; Cmd-click one chevron; record Figma result first (V-04). _M1·P2·[SRC:forum]_
- [ ] **UX-030** Reveal selection — selection made outside the panel expands all ancestors and scrolls the first selected row into view; panel-originated selection never scrolls. _Data:_ `expanded`, panel scroll _Test:_ collapse all; Cmd-click deep node on canvas → path expanded, row visible. _M1·P0·[KNOW]_
- [ ] **UX-031** Expanded state persists in file — `expanded` saves and reloads with the document. _Data:_ `ContainerMixin.expanded` _Test:_ expand 2 frames, save, reopen → same rows expanded. _M1·P1·[API]_
- [ ] **UX-032** Expand/collapse not undoable — toggling expansion creates no undo step; undo after a toggle reverts the previous document edit. _Data:_ `—` _Test:_ rename X; collapse Y; Cmd+Z → X name reverted, Y still collapsed. _M1·P1·[KNOW]_
- [ ] **UX-033** Default expansion of new containers — new frame/group/component from selection gets Figma's default expanded state. _Data:_ `expanded` _Test:_ Cmd+G two rects; record expanded state vs Figma (V-09). _M1·P2·[KNOW]_

### 6.4 Rename

- [ ] **UX-034** Double-click name to rename — opens inline editor with entire name selected. _Data:_ `name` _Test:_ double-click row; type "X" replaces whole name. _M1·P0·[KNOW]_
- [ ] **UX-035** Cmd/Ctrl+R with one layer — opens inline rename for the selected row (revealing it first). _Data:_ `name` _Test:_ select on canvas, ⌘R → editor on revealed row, whole name selected. _M1·P0·[SRC:figma blog][SRC:raycast]_
- [ ] **UX-036** Commit/cancel keys — Enter or blur commits; Esc cancels with no change and no undo step. _Data:_ `name` _Test:_ type, Esc → original name; undo stack unchanged. _M1·P0·[KNOW]_
- [ ] **UX-037** Tab / Shift+Tab chaining — Tab commits and starts renaming the next row below; Shift+Tab the row above; canvas selection does not follow; at list end Tab commits and exits. _Data:_ `name` _Test:_ rename 3 consecutive rows with Tab; selection remains the first row (as Figma 2022 behavior). _M1·P1·[SRC:forum 17592]_
- [ ] **UX-038** Empty/whitespace name — committing an empty name keeps the previous name. _Data:_ `name` _Test:_ clear field, Enter → name unchanged (verify V-10). _M1·P1·[KNOW]_
- [ ] **UX-039** Rename is one undo step — each committed rename is a single undoable step; undo restores old name and `autoRename`. _Data:_ `name`, `autoRename` _Test:_ rename text layer; ⌘Z → previous auto name and autoRename=true. _M1·P0·[API][KNOW]_
- [ ] **UX-040** Batch rename dialog — Cmd/Ctrl+R (or "Rename…") with ≥2 layers opens a dialog with Match (optional, text/regex), Rename to (template), insert buttons (current name, ascending number, descending number), start number, live preview and Rename button. _Data:_ `name` _Test:_ select 5 rects, Rename to "Card $n" → "Card 1…5" in Figma's order. _M1·P1·[SRC:figma blog][SRC:uxplanet excerpt]_
- [ ] **UX-041** Batch rename tokens & order — token spellings, numbering order (panel order vs selection order) and Match replacement (first vs all occurrences, regex groups) match Figma exactly. _Data:_ `name` _Test:_ V-12 fixture; compare 10 cases. _M1·P1·[KNOW]_
- [ ] **UX-042** Batch rename is one undo step — all renames revert with one ⌘Z. _Data:_ `name` _Test:_ batch rename 20 layers, ⌘Z once → all original. _M1·P1·[KNOW]_
- [ ] **UX-043** Rename sets `autoRename=false` for text — manual (single or batch) rename of a text layer stops auto-naming. _Data:_ `autoRename` _Test:_ batch rename text layers; edit text → names unchanged. _M3·P0·[API]_

### 6.5 Drag to reorder / reparent

- [ ] **UX-044** Reorder within parent — dragging a row between two siblings moves it to that z-index; insertion line indicates target and depth. _Data:_ `children` order _Test:_ rows A,B,C; drag C between A and B → children order matches Figma. _M1·P0·[KNOW]_
- [ ] **UX-045** Drop into container — dropping on the middle zone of a container row reparents into it as top-most child. _Data:_ `parent`, index _Test:_ drag rect onto frame row → rect is frame's last child (top row). _M1·P0·[KNOW]_
- [ ] **UX-046** Depth by horizontal position — at the bottom of a container's last child, pointer x chooses whether the drop lands inside the container or after an ancestor. _Data:_ `parent` _Test:_ drag to below last child of nested group with x at each indent level; record parent per x (V-13). _M1·P1·[KNOW]_
- [ ] **UX-047** Cycle prevention — a node cannot be dropped into itself or any descendant; feedback shows no-drop and nothing changes. _Data:_ `parent` _Test:_ drag frame onto its own child row → rejected. _M1·P0·[KNOW]_
- [ ] **UX-048** Non-container targets — dropping "into" a rectangle/text/vector is impossible; middle zone behaves as before/after. _Data:_ `—` _Test:_ drag onto rect row middle → becomes sibling. _M1·P0·[KNOW]_
- [ ] **UX-049** Instance/slot drop rules — drops into instances are rejected except into SLOT nodes (subject to slot limits); a main component cannot be dropped into its own instance. _Data:_ `SlotNode.limitViolations` _Test:_ drag rect into instance child → rejected; into slot → accepted. _M5·P0·[API][KNOW]_
- [ ] **UX-050** Component set drop rule — only components (variants) may be dropped into a component set. _Data:_ `ComponentSetNode` _Test:_ drag rect into set → rejected (verify V-14). _M5·P1·[KNOW]_
- [ ] **UX-051** Position preserved on reparent — reparenting into a non-auto-layout parent keeps each node's absolute page position; into auto layout it joins the flow at the drop index and the parent re-lays out. _Data:_ `absoluteTransform`, `layoutMode` _Test:_ drag rect at (100,100) into frame at (50,50) → rect x=50,y=50 relative; into AL frame → placed at index. _M1·P0·[API][KNOW]_
- [ ] **UX-052** Multi-row drag — dragging any selected row moves the whole (normalized) selection, preserving relative order. _Data:_ `children` _Test:_ select A and C, drag into frame → both inside, order kept. _M1·P0·[KNOW]_
- [ ] **UX-053** Auto-scroll and hover-expand — dragging near panel edges scrolls; hovering a collapsed container expands it after a delay. _Data:_ `transient` _Test:_ long list; drag to bottom edge scrolls; hover collapsed frame 1 s → expands. _M1·P1·[KNOW]_
- [ ] **UX-054** Esc cancels drag; completed drag is one undo step — undo restores parent, index and transforms of all moved nodes. _Data:_ `—` _Test:_ drag 3 rows into frame, ⌘Z → original parents/indices/positions. _M1·P0·[KNOW]_
- [ ] **UX-055** Drop into fixed section — dropping a child into the fixed-children section makes it fixed (changes `numberOfFixedChildren`). _Data:_ `numberOfFixedChildren` _Test:_ drag row above "scrolls" header → count +1. _M7·P2·[API][KNOW]_
- [ ] **UX-056** Sections as targets — dropping into a section row reparents into the section following FR nesting rules (e.g. sections inside frames rejected if Figma rejects). _Data:_ `SectionNode` _Test:_ drag section into frame row; compare with Figma. _M1·P1·[KNOW]_

### 6.6 Lock and visibility

- [ ] **UX-057** Row lock toggle — clicking the lock control toggles `locked` of that node only. _Data:_ `locked` _Test:_ lock rect via row; canvas click passes through to object beneath. _M1·P0·[DOC:360041596573 excerpt]_
- [ ] **UX-058** Row visibility toggle — clicking the eye control toggles `visible`. _Data:_ `visible` _Test:_ hide rect via row; canvas no longer renders it. _M1·P0·[DOC:360041112614 excerpt]_
- [ ] **UX-059** Lock shortcut — ⇧⌘L / Ctrl+Shift+L toggles lock of the selection (multi: mixed → lock all? verify). _Data:_ `locked` _Test:_ select 2 (1 locked) → ⇧⌘L → record result (V-16). _M1·P0·[DOC:360041596573 excerpt]_
- [ ] **UX-060** Hide shortcut — ⇧⌘H / Ctrl+Shift+H toggles visibility of the selection, also for hidden nodes selected via panel. _Data:_ `visible` _Test:_ select hidden layer via row, ⇧⌘H → visible. _M1·P0·[DOC:360041112614 excerpt]_
- [ ] **UX-061** Drag-across toggling — pressing on a lock/eye control and dragging across rows applies the first row's new state to every row passed. _Data:_ `locked`/`visible` _Test:_ rows with mixed visibility; press eye of row 1 (visible→hidden) and drag over 4 rows → all 5 hidden. _M1·P1·[DOC:360041596573 excerpt][KNOW]_
- [ ] **UX-062** Effective lock semantics — a node is locked on canvas if it or any ancestor is locked; child unlock does not override a locked parent. _Data:_ `locked` _Test:_ lock frame; unlock child → child still not canvas-selectable. _M1·P0·[API]_
- [ ] **UX-063** Effective visibility semantics — a node renders only if it and all ancestors are visible. _Data:_ `visible` _Test:_ hide group; child visible=true but not rendered/exported. _M1·P0·[API]_
- [ ] **UX-064** Locked/hidden canvas hit-testing — locked nodes ignore canvas click, marquee and drag; hidden nodes are not hit-tested; both selectable from the panel. _Data:_ `locked`, `visible` _Test:_ marquee over locked rect → not selected. _M1·P0·[API][KNOW]_
- [ ] **UX-065** Editing hidden/locked via inspector — hidden (and panel-selected locked) nodes can be edited in the inspector. _Data:_ `—` _Test:_ select hidden rect via row; set X=40 → applied. _M1·P1·[DOC:360041112614 excerpt]_
- [ ] **UX-066** Locked node keyboard/handle edits — behavior of arrow nudges and canvas resize handles on a panel-selected locked node matches Figma. _Data:_ `locked` _Test:_ select locked rect via row, press → ; record (V-16). _M1·P1·[KNOW]_
- [ ] **UX-067** Appearance-section eye — the inspector Appearance section offers a visibility toggle for the whole selection. _Data:_ `visible` _Test:_ select 3 layers; click eye in Appearance → all hidden. _M1·P1·[SRC:forum][KNOW]_
- [ ] **UX-068** Unlock all objects — action unlocks every locked node on the current page as one undo step. _Data:_ `locked` _Test:_ lock 5 nodes at various depths; run action → all `locked=false`. _M1·P2·[SRC:forum]_
- [ ] **UX-069** Lock/hide undo — every toggle (row, shortcut, drag-across gesture) is one undo step. _Data:_ `—` _Test:_ drag-across hide 4 rows; ⌘Z once → all visible. _M1·P0·[KNOW]_
- [ ] **UX-070** Hidden layers excluded from export — hidden nodes do not appear in PNG/SVG/PDF export of a parent; locked nodes do. _Data:_ `visible`, `exportSettings` _Test:_ export frame with hidden child → child absent. _M2·P0·[KNOW]_

### 6.7 Pages panel

- [ ] **UX-071** Page list order = document order — pages appear in `DocumentNode.children` order; reordering in the panel changes that order. _Data:_ `DocumentNode.children` _Test:_ drag page 3 to top → `children[0]` is page 3. _M1·P0·[API]_
- [ ] **UX-072** Add page — "+" creates a page named per Figma's numbering, appends it, makes it current and opens rename. _Data:_ `createPage`, `name` _Test:_ file with 2 pages; click + → "Page 3" current & in rename (verify name rule P-01). _M1·P0·[API][KNOW]_
- [ ] **UX-073** Rename page — double-click to rename; Enter/blur commit; Esc cancels; empty name reverts; duplicate names allowed. _Data:_ `PageNode.name` _Test:_ rename two pages to "A" → both "A". _M1·P0·[KNOW]_
- [ ] **UX-074** Reorder pages by drag — insertion line; one undo step. _Data:_ `insertChild` on document _Test:_ drag; ⌘Z → original order. _M1·P1·[API][KNOW]_
- [ ] **UX-075** Page divider creation — renaming an empty page to a name of only `*`, en dashes, em dashes or spaces makes it a divider; non-empty pages never become dividers. _Data:_ `isPageDivider`, `createPageDivider` _Test:_ empty page renamed "———" → divider; page with a rect renamed "———" → normal page. Also test "---" hyphens (P-02). _M1·P1·[API]_
- [ ] **UX-076** Divider behavior — dividers render as separators, cannot become current, cannot receive layers, can be reordered/renamed/deleted. _Data:_ `isPageDivider` _Test:_ click divider → current page unchanged; Move to page submenu excludes it. _M1·P1·[API][KNOW]_
- [ ] **UX-077** Duplicate page — deep copy inserted after source; prototype connections remapped to copies; main components become instances of the originals; name per Figma rule. _Data:_ `PageNode.clone()`, `reactions`, `mainComponent` _Test:_ page with component C and a flow; duplicate → copy has instance of C, flow targets copied frames. _M1·P0·[API][KNOW]_
- [ ] **UX-078** Delete page — removes page and contents; switches to adjacent page if current; last remaining non-divider page cannot be deleted; one undo step restores page and ids. _Data:_ `remove()` _Test:_ delete current page → neighbor current; ⌘Z → page back with same node ids. _M1·P0·[KNOW]_
- [ ] **UX-079** Switch page restores selection — each page keeps its own selection; switching back restores it; switching emits page-change then selection-change. _Data:_ `PageNode.selection`, `currentpagechange` _Test:_ select X on page 1, switch to 2, back → X selected. _M1·P0·[API]_
- [ ] **UX-080** Switch page restores viewport — each page remembers its last center/zoom within the session and across reopen. _Data:_ `view state` _Test:_ zoom page 1 to 300 %, page 2 to 50 %; switch back and forth; reopen file. _M1·P1·[KNOW]_
- [ ] **UX-081** Previous/next page keys — PgUp/PgDn go to previous/next page, skipping dividers, wrapping? (verify). _Data:_ `current page` _Test:_ 3 pages + divider; press PgDn repeatedly; record Figma (P-05). _M1·P2·[SRC:cheat sheets]_
- [ ] **UX-082** Move to page — context menu "Move to page ▸" moves selected layers to the target page preserving coordinates, as top-most children, staying on the current page; one undo step. _Data:_ `parent` across pages _Test:_ move rect (10,10) to page 2 → rect on page 2 at (10,10). _M1·P1·[KNOW]_
- [ ] **UX-083** Page background — with nothing selected the inspector's Page section edits the page background (single solid color); applies to canvas immediately; undoable. _Data:_ `PageNode.backgrounds` _Test:_ set #222222 → canvas color; ⌘Z → previous. _M1·P0·[API][OBS]_
- [ ] **UX-084** Unlimited pages — Illigma imposes no page limit (Figma Starter: 3). _Data:_ `—` _Test:_ create 200 pages; all usable. _M1·P1·[API][DECISION]_
- [ ] **UX-085** Pages section collapse & split — Pages section can collapse to a header showing the current page name, and the Pages/Layers split is draggable; both are UI state. _Data:_ `UI prefs` _Test:_ collapse; header shows current page; reload → preserved. _M1·P2·[OBS][KNOW]_
- [ ] **UX-086** Copy link to page — context menu copies a deep link that reopens the file on that page. _Data:_ `page id` _Test:_ copy link, open → page current. _M8·P2·[KNOW][DECISION]_

### 6.8 Assets panel

- [ ] **UX-087** Assets tab switch — ⌥2/Alt+2 shows Assets; ⌥1/Alt+1 shows File (layers/pages). _Data:_ `UI state` _Test:_ press each shortcut; correct tab shown; shortcuts ignored while typing in a field. _M5·P1·[DOC:360039831974 excerpt]_
- [ ] **UX-088** Local components listing — lists every component and component set in the file, grouped by page and container/name folders per Figma. _Data:_ `ComponentNode`, `ComponentSetNode`, `name` _Test:_ fixture with components on 2 pages, names "Button/Primary"; compare grouping to Figma (A-02). _M5·P0·[DOC:360039831974 excerpt][KNOW]_
- [ ] **UX-089** Asset search — typing filters components by name (incl. folder path) case-insensitively, live; clearing restores. _Data:_ `name`, `description` _Test:_ search "prim" → "Button/Primary". _M5·P1·[KNOW]_
- [ ] **UX-090** Drag asset to insert — dropping creates an instance at the pointer, parented to the frame/section under the pointer (auto layout → flow index), selected, one undo step. _Data:_ `createInstance`, `parent` _Test:_ drop into AL frame between children → instance at that index. _M5·P0·[KNOW]_
- [ ] **UX-091** Click asset — clicking an asset behaves as in Figma UI3 (detail view with variant/property pickers and insert action, or immediate insert — verify A-03). _Data:_ `—` _Test:_ compare click result. _M5·P1·[KNOW]_
- [ ] **UX-092** Swap by Alt-drop — dropping an asset onto an existing instance with Alt/Option swaps that instance's main component, preserving overrides per CP rules. _Data:_ `swapComponent` _Test:_ Alt-drop Button/B onto instance of Button/A → swapped (A-04). _M5·P1·[KNOW]_
- [ ] **UX-093** Hidden components in local list — components prefixed `.`/`_` appear or not in local Assets exactly as in Figma. _Data:_ `name` _Test:_ create "_Base" → record visibility (A-05). _M5·P2·[DOC:360039238193 title][KNOW]_
- [ ] **UX-094** Library sections — assets from enabled local library files appear in their own sections after local components; a Libraries control opens the library manager (DS). _Data:_ `library refs` _Test:_ enable library file → its components listed and insertable. _M6·P1·[DOC:360039831974 excerpt][DECISION]_
- [ ] **UX-095** Assets panel excludes styles/variables — styles and variables never appear in the Assets tab. _Data:_ `—` _Test:_ file with styles only → Assets shows empty-state. _M5·P2·[KNOW]_
- [ ] **UX-096** Asset context menu — right-click asset offers Go to main component (navigates page, selects component) and other Figma items (A-06). _Data:_ `—` _Test:_ Go to main → component selected & zoomed. _M5·P2·[KNOW]_

### 6.9 Inspector structure

- [ ] **UX-097** Design/Prototype tabs — two tabs; ⌥8/⌥9 (Alt+8/9) switch; tab choice persists across selection and page changes. _Data:_ `UI state` _Test:_ select Prototype, change selection → still Prototype. _M1·P0·[OBS][SRC:raycast]_
- [ ] **UX-098** No-selection inspector — shows Page (background), Variables, Styles (local style lists), Export, in Figma's order. _Data:_ `backgrounds`, local styles, `exportSettings` _Test:_ deselect all; compare section list to Figma (I-02). _M1·P0·[OBS][KNOW]_
- [ ] **UX-099** Frame inspector order — Position → Layout → Appearance → Fill → Stroke → Effects → Layout guide → Export; Layout shows Freeform + Clip content. _Data:_ `FrameNode props` _Test:_ select top-level frame; section titles in that order. _M1·P0·[OBS]_
- [ ] **UX-100** Nested frame constraints — a frame/shape inside a freeform frame shows Constraints within Position. _Data:_ `constraints` _Test:_ select child of frame → constraints visible; select top-level → absent. _M4·P0·[KNOW]_
- [ ] **UX-101** Auto layout frame Layout section — flow, wrap, W/H sizing, 9-position alignment, gap, padding, clip content, settings popover (strokes in layout, canvas stacking, layout version, baseline, auto spacing). _Data:_ `AutoLayoutMixin` _Test:_ select AL frame; controls present as observed. _M4·P0·[OBS]_
- [ ] **UX-102** Auto layout child Position — X/Y and alignment disabled while in flow; Ignore auto layout control shown; enabling it re-enables X/Y. _Data:_ `layoutPositioning` _Test:_ select AL child; X disabled; toggle absolute → enabled. _M4·P0·[OBS][KNOW]_
- [ ] **UX-103** Group inspector — no Fill/Stroke sections; Appearance without corner radius; Selection colors when applicable; Effects; Export. _Data:_ `GroupNode mixins` _Test:_ select group; no Fill section. _M1·P0·[API][KNOW]_
- [ ] **UX-104** Section inspector — sections expose W/H, fill, stroke, corner radius and export as in Figma. _Data:_ `SectionNode` _Test:_ compare section list (I-05). _M1·P1·[API][KNOW]_
- [ ] **UX-105** Shape inspector — Position → Layout → Appearance → Fill → Stroke → Effects → Export for rectangle/ellipse/polygon/star/vector/boolean. _Data:_ `—` _Test:_ compare each type (I-06). _M1·P0·[KNOW]_
- [ ] **UX-106** Line/arrow inspector — length-only dimension and stroke endpoints; Fill presence matches Figma. _Data:_ `LineNode` _Test:_ compare (I-08). _M2·P1·[KNOW]_
- [ ] **UX-107** Text inspector — Typography section between Appearance and Fill; text resizing modes reachable. _Data:_ `TextNode` _Test:_ select text; order Position, Layout, Appearance, Typography, Fill, Stroke, Effects, Export. _M3·P0·[OBS][KNOW]_
- [ ] **UX-108** Main component inspector — component header and Properties section above Position. _Data:_ `componentPropertyDefinitions` _Test:_ select component; Properties first (I-09). _M5·P0·[KNOW]_
- [ ] **UX-109** Component set & variant inspectors — set shows variant properties; a variant shows its property values at top. _Data:_ `variantProperties` _Test:_ compare (I-10). _M5·P0·[KNOW]_
- [ ] **UX-110** Instance inspector — instance header (swap, ⋯ menu: go to main, push changes, reset all, detach) and instance properties above Position. _Data:_ `InstanceNode`, `componentProperties` _Test:_ select instance; compare (I-11). _M5·P0·[KNOW]_
- [ ] **UX-111** Multi-select same type — same sections as single; disagreeing values show Mixed. _Data:_ `—` _Test:_ 2 rects with W 10/20 → W "Mixed". _M1·P0·[KNOW]_
- [ ] **UX-112** Multi-select mixed types — only sections valid for every selected node shown (+ Selection colors); Typography rule matches Figma. _Data:_ `—` _Test:_ select text + rect; compare (I-12). _M1·P0·[KNOW]_
- [ ] **UX-113** Selection colors — lists unique colors (raw, style, variable) used by the selection and descendants; editing one recolors all usages; one undo step. _Data:_ `fills`, `strokes`, `getSelectionColors` _Test:_ frame with 3 children sharing red; change red → all updated; ⌘Z once. _M2·P1·[API][KNOW]_
- [ ] **UX-114** Selection header actions — header shows type label and contextual actions (create component, mask, boolean ▾, etc.) as in Figma UI3. _Data:_ `—` _Test:_ compare header for shape, 2 shapes, instance, image (I-01). _M1·P1·[KNOW]_
- [ ] **UX-115** List-section controls — each list section supports + add, − remove, per-item visibility, drag reorder and style/variable picker; empty sections show title and + only. _Data:_ `fills/strokes/effects/layoutGrids/exportSettings` _Test:_ add 3 fills, reorder, hide one. _M1·P0·[KNOW]_
- [ ] **UX-116** Prototype tab structure — no selection: flow starting points + prototype settings; frame: interactions, scroll behavior, overlay settings. _Data:_ `flowStartingPoints`, `prototypeBackgrounds`, `reactions` _Test:_ compare (I-03). _M7·P0·[API][KNOW]_
- [ ] **UX-117** Inspector panel width — right panel width is user-resizable within limits and persists as UI preference; canvas viewport bounds adjust without moving artwork. _Data:_ `UI pref, viewport.bounds` _Test:_ drag edge; artwork screen position unchanged relative to canvas center? (verify). _M1·P2·[KNOW]_

### 6.10 Inspector fields and mixed values

- [ ] **UX-118** Mixed placeholder — disagreeing numeric/text/enum values display "Mixed"; typing a value applies to all; Esc leaves all. _Data:_ `—` _Test:_ 3 rects different opacity; type 50 → all 50 %. _M1·P0·[KNOW]_
- [ ] **UX-119** Mixed list content — differing fill/stroke/effect lists show a replace-mixed affordance; + replaces every node's list with one default item. _Data:_ `fills` _Test:_ rect red + rect blue+green; click + → both one default fill (I-14). _M2·P1·[KNOW]_
- [ ] **UX-120** Label scrubbing — dragging a field label changes value continuously, Shift ×10, (Alt ×0.1 verify), one undo step per drag; on Mixed applies delta per node. _Data:_ `—` _Test:_ scrub X of 2 rects at 0 and 100 by +10 → 10 and 110 (I-15). _M1·P1·[KNOW]_
- [ ] **UX-121** Field arrow keys — ↑/↓ change by small nudge (or 1), Shift+↑/↓ by big nudge; each press commits per Figma's grouping. _Data:_ `nudge prefs` _Test:_ set big nudge 8; Shift+↑ in W adds 8. _M1·P1·[SRC:forum][KNOW]_
- [ ] **UX-122** Math expressions — fields evaluate `+ − * /` and parentheses; relative entries apply per node for Mixed. _Data:_ `—` _Test:_ W "100/3" → 33.33 (precision per CV); Mixed W "+10" per node (verify). _M1·P1·[KNOW]_
- [ ] **UX-123** Field commit keys — Enter commits (focus behavior per Figma), Tab/Shift+Tab move between fields committing, Esc reverts and blurs. _Data:_ `—` _Test:_ type X then Tab → committed and focus in Y (I-16). _M1·P0·[KNOW]_

### 6.11 Toolbar

- [ ] **UX-124** Toolbar groups — bottom toolbar contains Move/Hand/Scale, Frame/Section/Slice, shapes (Rectangle, Line, Arrow, Ellipse, Polygon, Star, Image/video), Pen/Pencil, Text, Comment, Actions, in that order. _Data:_ `—` _Test:_ compare to Figma screenshot (T-01). _M1·P0·[DOC:360041064174 excerpt][SRC:uxcel][KNOW]_
- [ ] **UX-125** Flyout last-used memory — each group button shows and activates its last-used tool; chevron opens list with shortcuts. _Data:_ `UI pref` _Test:_ choose Ellipse from flyout; press V; click group main button → Ellipse. _M1·P1·[KNOW]_
- [ ] **UX-126** Shortcut updates group icon — pressing O shows Ellipse in the shape group. _Data:_ `—` _Test:_ press O → group icon Ellipse. _M1·P1·[KNOW]_
- [ ] **UX-127** Tool reverts after use — creation tools revert to Move after one object unless Keep tool selected is on; Esc returns to Move. _Data:_ `pref` _Test:_ draw rect → tool Move; enable pref → stays Rectangle. _M1·P0·[KNOW]_
- [ ] **UX-128** Temporary tools — holding Space = Hand, release restores previous tool; holding Z = Zoom tool. _Data:_ `—` _Test:_ with Pen active hold Space, drag pans, release → Pen. _M1·P0·[KNOW]_
- [ ] **UX-129** Contextual vector-edit toolbar — entering vector edit mode replaces toolbar with vector tools and a Done control; Done/Esc exits. _Data:_ `—` _Test:_ Enter on vector → contextual toolbar (T-03). _M2·P1·[KNOW]_
- [ ] **UX-130** Toolbar fixed — toolbar cannot be moved/docked/customized. _Data:_ `—` _Test:_ n/a (absence). _M1·P2·[SRC:forum]_

### 6.12 Actions menu

- [ ] **UX-131** Open actions — ⌘K/Ctrl+K and the toolbar Actions button open the menu with search focused; ⌘/ / Ctrl+/ also open it. _Data:_ `—` _Test:_ each trigger opens; Esc closes. _M1·P1·[DOC:23570416033943 excerpt][SRC:forum]_
- [ ] **UX-132** Search & run — typing filters actions (fuzzy, case-insensitive); ↑/↓ highlight; Enter runs; each result shows its shortcut. _Data:_ `—` _Test:_ type "align" → only alignment actions; Enter on "Align left" aligns. _M1·P1·[DOC:23570416033943 excerpt][KNOW]_
- [ ] **UX-133** Recent actions — empty query lists recently run actions most-recent first. _Data:_ `UI pref` _Test:_ run 3 actions; reopen → listed in reverse order. _M1·P2·[KNOW]_
- [ ] **UX-134** Coverage — every main-menu command and preference (e.g. "Nudge amount…", "Unlock all objects", view toggles) is reachable. _Data:_ `—` _Test:_ script iterates menu tree; each name found. _M1·P1·[SRC:forum]_
- [ ] **UX-135** Applicability handling — non-applicable actions are hidden or disabled exactly as Figma. _Data:_ `—` _Test:_ no selection; search "flatten" → record (S-04). _M1·P2·[KNOW]_
- [ ] **UX-136** Assets in actions menu — the menu can search components and insert the chosen one at viewport center (or Figma's rule). _Data:_ `—` _Test:_ search component, Enter → instance inserted (S-07). _M5·P2·[DOC:23570416033943 excerpt][KNOW]_

### 6.13 Menus

- [ ] **UX-137** Main menu tree — Main menu contains File, Edit, View, Object, Text, Arrange, Vector, Preferences, Help submenus with Figma's items and order (Plugins/Widgets omitted). _Data:_ `—` _Test:_ diff menu tree vs. Figma capture (M-01). _M1·P1·[KNOW]_
- [ ] **UX-138** Menu items show shortcuts and disable when N/A — each item shows its platform shortcut; inapplicable items disabled. _Data:_ `—` _Test:_ no selection → "Group selection" disabled. _M1·P0·[KNOW]_
- [ ] **UX-139** File menu — file-name dropdown offers rename file, duplicate, show version history, export, file location ([DECISION]: reveal in Finder/Explorer). _Data:_ `DocumentNode.name` _Test:_ rename file via menu → title updates & file on disk renamed per IO rules. _M1·P1·[DOC:360039831974 excerpt][DECISION]_
- [ ] **UX-140** Layer-row context menu — right-click on a row selects it (if unselected) and shows the same menu as the canvas context menu for that selection. _Data:_ `—` _Test:_ right-click unselected row → selected; menu identical to canvas (M-02). _M1·P0·[KNOW]_
- [ ] **UX-141** Page-row context menu — Copy link, Rename, Duplicate, Delete (and divider creation if Figma offers it). _Data:_ `—` _Test:_ compare (P-02). _M1·P1·[KNOW]_
- [ ] **UX-142** Native menubar (macOS) — system menubar mirrors the Main menu with identical enablement and shortcuts. _Data:_ `—` _Test:_ every menubar item triggers same action as in-app. _M1·P2·[DECISION]_

### 6.14 Shortcuts & dispatch

- [ ] **UX-143** Complete default keymap — every binding in §5 is implemented for macOS and Windows/Linux, with ⚠ rows resolved by live verification. _Data:_ `keymap` _Test:_ automated keymap table test + manual check vs Figma panel (S-06). _M1·P0·[DOC][SRC][KNOW]_
- [ ] **UX-144** Windows exceptions — bring to front/back use Ctrl+Shift+]/[; mask Ctrl+Alt+M; layout guides Ctrl+Shift+4; others per §5. _Data:_ `keymap` _Test:_ Windows build; each exception fires. _M1·P0·[SRC:raycast][KNOW]_
- [ ] **UX-145** Text-input suppression — single-key and modifier shortcuts do not fire while typing in rename editor, inspector fields, find box, dialogs or text edit mode (except input-local undo/redo/select-all). _Data:_ `—` _Test:_ type "r" in rename → no rectangle tool. _M1·P0·[KNOW]_
- [ ] **UX-146** Keyboard-layout awareness — letter shortcuts follow the logical key per the Keyboard layout preference; punctuation shortcuts (', \\, [, ]) map per layout. _Data:_ `pref` _Test:_ AZERTY layout; "A"-key behavior matches Figma on AZERTY (S-08). _M1·P1·[DOC:360041065034 excerpt]_
- [ ] **UX-147** Opacity number keys — 1–9 → 10–90 %, 0 → 100 %, 00 → 0 %, two quick digits → that percentage; one undo step per value. _Data:_ `opacity` _Test:_ press 4,5 quickly → 45 %; press 4, wait, 5 → 50 % (S-03). _M1·P1·[SRC:raycast][KNOW]_
- [ ] **UX-148** Shortcuts panel — Ctrl+Shift+? (and Help menu) opens a categorized, searchable shortcuts reference; used shortcuts are marked. _Data:_ `usage stats (UI pref)` _Test:_ open; search "group" finds ⌘G (S-01). _M1·P1·[KNOW][DOC:360041065034 excerpt]_
- [ ] **UX-149** No-op on inapplicable — shortcuts whose action is not applicable do nothing (no error toast, no undo step). _Data:_ `—` _Test:_ ⇧⌘G with a rect selected → nothing. _M1·P1·[KNOW]_
- [ ] **UX-150** Undo/redo keys — ⌘Z, ⇧⌘Z (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y if Figma supports it). _Data:_ `—` _Test:_ S-02. _M0·P0·[SRC:raycast][KNOW]_

### 6.15 Find & replace

- [ ] **UX-151** Open find — ⌘F/Ctrl+F opens Find & replace in the navigation area with focus in the query; results populate as you type. _Data:_ `transient` _Test:_ type "but" → results update per keystroke. _M3·P1·[DOC:9141292269847 excerpt]_
- [ ] **UX-152** Searchable content — matches layer names and text content; scope current page / all pages per Figma. _Data:_ `name`, `characters` _Test:_ frame named "Button" and text "Button" both found (F-01). _M3·P1·[DOC:9141292269847 excerpt][KNOW]_
- [ ] **UX-153** Type filters — results filterable by layer type as in Figma. _Data:_ `type` _Test:_ filter Text → only text results (F-02). _M3·P2·[KNOW]_
- [ ] **UX-154** Match case / whole words — options restrict matching accordingly. _Data:_ `—` _Test:_ "cat" whole words excludes "category"; match case excludes "Cat". _M3·P1·[SRC:uxplanet]_
- [ ] **UX-155** Result navigation — clicking a result switches page if needed, selects the layer, reveals its row and zooms to it. _Data:_ `selection, viewport` _Test:_ result on page 2 → page 2 current, node selected and visible. _M3·P1·[KNOW]_
- [ ] **UX-156** Replace text only — replace/replace-all change `characters` of matching text layers only; name matches on non-text layers are not replaced; auto-named text layers' names follow. _Data:_ `characters`, `autoRename` _Test:_ frame "Login" + text "Login"; replace → only text changes. _M3·P1·[DOC:9141292269847 excerpt]_
- [ ] **UX-157** Replace all is one undo step & style preservation — all replacements revert together; replaced ranges keep character styling per Figma. _Data:_ `styled segments` _Test:_ bold "Login" → replace "Sign in" → bold kept (F-03). _M3·P1·[KNOW]_
- [ ] **UX-158** Replace inside instances & missing fonts — replacing in an instance creates text overrides; text with missing fonts is skipped and reported. _Data:_ `overrides, fonts` _Test:_ instance text replaced → override; missing-font text skipped with notice. _M5·P2·[KNOW]_

### 6.16 Version history

- [ ] **UX-159** Show version history — File menu command opens the version list in the right sidebar; selecting a version shows it read-only on canvas; closing returns to current. _Data:_ `versions` _Test:_ open, click older version → canvas shows it; edits disabled. _M8·P1·[DOC:360038006754 excerpt]_
- [ ] **UX-160** Automatic checkpoints — a checkpoint is created every 30 min of editing activity and on close. _Data:_ `Version{created_at,label:null}` _Test:_ fake clock: edit at t0, t0+31 min → 1 checkpoint. _M8·P1·[SRC:figma blog][DECISION]_
- [ ] **UX-161** Named version — ⌥⌘S/Ctrl+Alt+S (or + in panel) opens dialog with required title and optional description; saves a version containing all edits up to that moment. _Data:_ `label`, `description` _Test:_ edit then ⌥⌘S → version includes edit; empty title rejected. _M8·P1·[SRC:figma blog][API]_
- [ ] **UX-162** Autosave collapsing — autosaves between named versions are grouped and expandable. _Data:_ `—` _Test:_ 3 checkpoints then named → collapsed group of 3. _M8·P2·[SRC:figma blog]_
- [ ] **UX-163** Restore version — restoring is non-destructive: current state is preserved as a version and the restored content becomes current. _Data:_ `versions` _Test:_ restore v1; list contains pre-restore state; canvas = v1. _M8·P1·[DOC:360038006754 excerpt]_
- [ ] **UX-164** Duplicate version — creates a new file from that version without comments/version history. _Data:_ `—` _Test:_ duplicate → new file opens; its history empty. _M8·P2·[DOC:360038006754 excerpt]_
- [ ] **UX-165** Copy from old version — layers can be selected/copied in version preview and pasted into the current version. _Data:_ `clipboard` _Test:_ copy rect from v1, return to current, paste → rect added. _M8·P2·[SRC:forum 38485]_
- [ ] **UX-166** Edit version info — named versions' title/description editable; autosave checkpoints can be named. _Data:_ `label`, `description` _Test:_ rename version; persists. _M8·P2·[KNOW]_
- [ ] **UX-167** Retention — Illigma keeps all versions (no 30-day limit) and offers manual pruning. _Data:_ `—` _Test:_ versions older than 30 days remain. _M8·P2·[DOC:360038006754 excerpt][DECISION]_

### 6.17 Autosave & crash recovery ([DECISION]; Figma analogue: continuous cloud autosave)

- [ ] **UX-168** Continuous autosave — every committed change is durably journaled within 2 s without user action. _Data:_ `journal (IO)` _Test:_ edit, kill process after 3 s, relaunch → edit present. _M0·P0·[DECISION][KNOW]_
- [ ] **UX-169** Crash recovery prompt — on relaunch after a crash, user can Recover or Discard; recovery restores page, viewport and selection. _Data:_ `view state` _Test:_ simulated crash; recover → same page & selection. _M0·P0·[DECISION]_
- [ ] **UX-170** Save status indicator — Saved / Saving… / Error visible near the file name; error offers retry. _Data:_ `—` _Test:_ make file read-only mid-session → Error shown, retry after fix → Saved. _M0·P1·[DECISION]_
- [ ] **UX-171** Cmd/Ctrl+S — forces flush and shows "Saved" toast; untitled → Save as. _Data:_ `—` _Test:_ press ⌘S → toast; untitled → dialog. _M0·P1·[DECISION]_
- [ ] **UX-172** Safe close — closing waits for flush; failure shows Retry / Save as / Quit anyway. _Data:_ `—` _Test:_ block disk; close → dialog. _M0·P0·[DECISION]_
- [ ] **UX-173** External modification detection — if the file changes on disk while open, user chooses reload or keep; never silently overwritten. _Data:_ `—` _Test:_ modify file externally → prompt. _M0·P1·[DECISION]_

### 6.18 Comments (local-only, P2)

- [ ] **UX-174** Comment pins — Comment tool (C) places a pin anchored to the top-level frame under it (moves with it) or to canvas coordinates; drag creates a region comment. _Data:_ `client_meta` (`FrameOffset`, `Region`, `FrameOffsetRegion`) _Test:_ pin on frame; move frame → pin follows. _M8·P2·[API][KNOW]_
- [ ] **UX-175** Threads — reply, edit, delete, resolve/unresolve; numbered threads; local author name from preferences. _Data:_ `parent_id`, `order_id`, `resolved_at`, `message` _Test:_ create thread with reply; resolve → hidden under filter. _M8·P2·[API][DECISION]_
- [ ] **UX-176** Comments visibility toggle — Shift+C (or View menu) shows/hides pins; comments sidebar lists/filters threads. _Data:_ `UI state` _Test:_ toggle hides pins (C-01). _M8·P2·[KNOW]_
- [ ] **UX-177** Comments isolation — comments are not undoable, not exported, not copied with layers. _Data:_ `—` _Test:_ add comment, ⌘Z → comment remains; export PNG → no pins. _M8·P2·[KNOW][DECISION]_

### 6.19 View toggles, UI scale, high-DPI

- [ ] **UX-178** Rulers toggle — ⇧R shows/hides rulers; origin relative to selected top-level frame. _Data:_ `view state` _Test:_ toggle; select frame at (100,100) → ruler 0 at frame left edge (CV owns). _M1·P1·[SRC:raycast][KNOW]_
- [ ] **UX-179** Pixel grid toggle — toggles 1-px grid visible only at zoom ≥ 400 %. _Data:_ `view state` _Test:_ on at 399 % → no grid; 400 % → grid aligned to integer coordinates. _M1·P1·[DOC:360041065034 excerpt]_
- [ ] **UX-180** Snap to pixel grid toggle — ⇧⌘'/Ctrl+Shift+' toggles; state shared with Preferences. _Data:_ `pref` _Test:_ off → drag yields fractional x; on → integer. _M1·P0·[DOC:360041065034 excerpt]_
- [ ] **UX-181** Layout guides toggle — ⌃G / Ctrl+Shift+4 and Zoom/view menu toggle visibility of all layout guides without changing data. _Data:_ `layoutGrids` untouched _Test:_ toggle; frames' grids hidden; file unchanged. _M4·P1·[DOC:360041065034 excerpt][SRC:raycast]_
- [ ] **UX-182** Outline mode — toggles outline rendering of all layers (and hidden-layer outlines option). _Data:_ `view state` _Test:_ ⌘Y → outlines; compare (V-18). _M2·P2·[SRC:raycast][DOC:5724448965527 title]_
- [ ] **UX-183** Pixel preview — renders the canvas rasterized at the chosen density. _Data:_ `view state` _Test:_ enable 1× at 800 % → visible pixels. _M2·P2·[KNOW]_
- [ ] **UX-184** Show/Hide UI and Minimize UI — ⌘\\ hides all chrome; ⇧\\ collapses nav bar and both panels to compact controls; neither changes artwork or zoom %. _Data:_ `UI state` _Test:_ toggle; canvas zoom unchanged; artwork pixel position consistent. _M1·P1·[DOC:360039831974 excerpt]_
- [ ] **UX-185** Zoom/view options menu — right-sidebar header menu shows editable zoom % and view toggles with check states. _Data:_ `viewport.zoom` _Test:_ type 250 → zoom 2.5. _M1·P1·[DOC:360041065034 excerpt]_
- [ ] **UX-186** View-toggle persistence scope — each toggle persists globally or per file exactly as Figma. _Data:_ `view state` _Test:_ V-17. _M1·P2·[KNOW]_
- [ ] **UX-187** Interface scale — UI zoom in/out/reset (reset ⌥⇧⌘0) scales chrome only; canvas zoom % unchanged; persisted. _Data:_ `pref` _Test:_ scale 125 %; canvas zoom stays 100 %; reset. _M0·P1·[DOC:360049549913 excerpt][KNOW]_
- [ ] **UX-188** High-DPI rendering — canvas renders at devicePixelRatio; hairlines remain 1 device-independent px at all zooms; moving window between displays re-renders crisply. _Data:_ `—` _Test:_ DPR 1 vs 2 screenshots; 1px rect edges crisp at 100 %. _M0·P0·[KNOW]_

### 6.20 Notifications / toasts

- [ ] **UX-189** Toast contract — bottom-of-screen toasts; ≤ 100 chars (truncate); default 3 s; persistent option; error style; one optional action button; queued; dequeue reasons timeout/dismiss/action. _Data:_ `NotificationOptions` model _Test:_ enqueue 3 toasts → shown sequentially; 120-char message truncated. _M0·P1·[API]_
- [ ] **UX-190** Editor toasts — copy link, copy as PNG/SVG/CSS, export complete, missing fonts, and other Figma toasts appear with Figma's wording and timing. _Data:_ `—` _Test:_ trigger each; compare (N-01). _M1·P2·[KNOW]_
- [ ] **UX-191** File notifications area — missing fonts and library-update notices appear at the bottom of the navigation bar, persisting until resolved. _Data:_ `font/library state` _Test:_ open file with missing font → notice present. _M6·P2·[DOC:23954856027159 excerpt]_
- [ ] **UX-192** Toasts never take focus — keyboard focus stays on canvas/field when a toast appears. _Data:_ `—` _Test:_ show toast while typing in field → typing continues. _M0·P1·[KNOW]_

### 6.21 Undo / redo

- [ ] **UX-193** Document edits undoable from any panel — node, page, style, variable, component edits made via canvas, layers panel, pages panel, inspector, dialogs or actions menu are undoable in one global stack. _Data:_ `undo stack` _Test:_ rename page, reorder layer, change fill; 3×⌘Z reverts in reverse order. _M0·P0·[KNOW]_
- [ ] **UX-194** Selection restored with undo — undo/redo restore the selection that existed before/after the step; pure selection changes create no step. _Data:_ `step.selectionBefore/After` _Test:_ select A, move; select B; ⌘Z → A moved back and A selected (U-02). _M0·P0·[KNOW]_
- [ ] **UX-195** Cross-page undo — undoing a step made on another page switches to that page (U-03). _Data:_ `step.pageId` _Test:_ edit on page 1, switch to page 2, ⌘Z → page 1 current, edit reverted. _M0·P1·[KNOW]_
- [ ] **UX-196** Viewport and UI state not undoable — pan/zoom, panel tabs, widths, expand/collapse, preferences and view toggles are never undo steps. _Data:_ `—` _Test:_ zoom then ⌘Z → previous document edit reverted, zoom unchanged (U-04). _M0·P0·[KNOW]_
- [ ] **UX-197** Gesture grouping — drag, scrub, color-picker drag, layers-panel drag, drag-across toggles = one step each; typed field value = one step on commit. _Data:_ `—` _Test:_ scrub W across 50 values → one ⌘Z restores (U-07). _M0·P0·[KNOW]_
- [ ] **UX-198** Field-local undo — inside a text input ⌘Z undoes the input's text, not the document. _Data:_ `—` _Test:_ type in rename, ⌘Z → field text reverts, doc unchanged. _M0·P1·[KNOW]_
- [ ] **UX-199** Redo cleared by new edit — any new document mutation clears redo. _Data:_ `—` _Test:_ ⌘Z, edit, ⇧⌘Z → nothing. _M0·P0·[KNOW]_
- [ ] **UX-200** Undo lifetime — undo history is per session and not restored after reopen; depth ≥ 1 000 steps. _Data:_ `—` _Test:_ 1 200 edits → 1 000 undoable; reopen → stack empty. _M0·P1·[KNOW][DECISION]_
- [ ] **UX-201** Version restore and undo — restoring a version is undoable within the session (Illigma) ; Figma behavior recorded (U-06). _Data:_ `—` _Test:_ restore, ⌘Z → previous current state. _M8·P2·[DECISION]_

### 6.22 Preferences

- [ ] **UX-202** Nudge amounts — Preferences ▸ Nudge amount… edits small (default 1) and big (default 10) nudge in points; applied on dismiss; used by arrow keys, Shift+arrows and Shift-step in fields/text size. _Data:_ `smallNudge`, `bigNudge` _Test:_ set 2/16; → moves 2; ⇧→ moves 16; Shift+↑ font size +16? (verify with Figma, SRC:forum). _M1·P0·[DOC:4404575206295 excerpt][SRC:forum]_
- [ ] **UX-203** Nudge validation — non-positive or non-numeric entries rejected/reverted; decimal handling per Figma. _Data:_ `prefs` _Test:_ enter 0, -1, 0.5 (P-PR-01). _M1·P2·[KNOW]_
- [ ] **UX-204** Snapping toggles — Snap to geometry, Snap to objects, Snap to pixel grid independently toggle the respective snapping (CV). _Data:_ `prefs` _Test:_ disable objects → no edge snapping while geometry snapping persists. _M1·P0·[KNOW][DOC:360041065034 excerpt]_
- [ ] **UX-205** Keep tool selected after use — see UX-127. _Data:_ `pref` _Test:_ as UX-127. _M1·P1·[KNOW]_
- [ ] **UX-206** Highlight layers on hover — when off, canvas hover outlines are suppressed (layer-row hover highlight behavior per Figma). _Data:_ `pref` _Test:_ off → hovering canvas shows no outline. _M1·P2·[KNOW]_
- [ ] **UX-207** Rename duplicated layers — duplicate naming follows the preference exactly as Figma. _Data:_ `pref, name` _Test:_ ⌘D on "Rect 1" with pref on/off (P-PR-02). _M1·P2·[KNOW]_
- [ ] **UX-208** Show dimensions on objects — toggles the W×H label below selection. _Data:_ `pref` _Test:_ toggle. _M1·P2·[KNOW]_
- [ ] **UX-209** Hide canvas UI during changes — hides selection chrome while scrubbing/editing values. _Data:_ `pref` _Test:_ scrub X → handles hidden until release. _M1·P2·[KNOW]_
- [ ] **UX-210** Keyboard zooms into selection — keyboard zoom centers on selection when on. _Data:_ `pref` _Test:_ select off-center rect; press + → rect stays centered. _M1·P2·[KNOW]_
- [ ] **UX-211** Preferences are global & immediate — apply instantly, persist across files and restarts, never undoable. _Data:_ `prefs` _Test:_ change, restart → retained; ⌘Z doesn't revert. _M1·P1·[KNOW]_
- [ ] **UX-212** Complete preference list — Illigma exposes every Figma Design editor preference relevant offline (list to be captured live, P-PR-03). _Data:_ `prefs` _Test:_ diff against capture. _M1·P2·[KNOW]_

### 6.23 Out-of-scope guards

- [ ] **UX-213** No multiplayer UI — no avatars, cursors toggle, follow, spotlight, cursor chat in menus, toolbar or actions menu. _Data:_ `—` _Test:_ search actions for "cursor", "spotlight" → none. _M1·P1·[DECISION]_
- [ ] **UX-214** No placeholder cloud/AI/plugin entries — no disabled placeholders for AI, plugins, widgets, Dev Mode, Share. _Data:_ `—` _Test:_ menu/toolbar audit. _M1·P1·[DECISION]_

---
