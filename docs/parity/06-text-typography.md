# Text & typography — Figma parity spec

> Status: research draft (date 2026-10-08). Nothing implemented. Every checklist item in §6 is **Not started**; no 1:1 parity is claimed for anything in this area until it is implemented **and** validated against live Figma.
>
> Area: Text & typography · Checklist prefix `TX` · Primary milestone: **M3 Text & typography** (some items belong to M1/M2/M4–M8 and say so).
>
> **Evidence legend** (every behavioral claim is tagged):
> - `[API]` — Figma Plugin API typings v1.141.0 (`plugin-api.d.ts`) or Figma REST API types v0.44.0 (`api_types.ts`). Line references in §9.
> - `[DOC:<article id> excerpt]` — official Figma Help Center article. **Only search-engine excerpts/summaries were seen**; no article body was read in this session (help.figma.com is not fetchable from this environment). Some excerpts came through the `figma-signup.helpjuice.com` mirror of the same articles.
> - `[OBS]` — the read-only live-Figma observation of 2026-09-27 (`old/docs/figma/observations/2026-09-27-live-figma.md`).
> - `[KNOW]` — the author's own knowledge of Figma, **not verified in this session**. Anything correctness-relevant that rests only on `[KNOW]` or `[SRC]` is repeated in §8.
> - `[SRC:<url>]` — other web source (Figma community forum, Figma blog, plugin-API changelog, third-party guides), seen only as search excerpts.
>
> **Research limits (honest statement):** about 20 targeted WebSearch queries were run for this area before the run-wide search budget was exhausted. No live Figma session, no video and no full help-article body was inspected for this document. Where Figma's behavior could not be confirmed, the expected behavior is still written down (so the contract is complete) but tagged `[KNOW]` and listed in §8 as an experiment that must be run before the item can be marked done.

---

## 1. Scope & terminology

### 1.1 In scope

Everything a designer does with text inside the Figma Design editor:

- Text tool creation (click vs. drag), entering/leaving text edit mode, caret/selection/navigation, typing, IME, deletion, line/paragraph breaks.
- Text box resizing modes (Auto width / Auto height / Fixed size), truncation (ellipsis) and Max lines, resizing with handles, the Scale tool on text, text inside auto layout (hug/fill/fixed, min/max, baseline alignment).
- Character-level styling on arbitrary ranges (mixed styles): font family, font style/weight, size, line height, letter spacing, case, decoration (underline styling), fills, OpenType features, variable-font axes, hyperlinks.
- Paragraph-level styling: alignment, paragraph spacing, paragraph indent, lists (bulleted/numbered, nesting, list spacing), hanging punctuation, hanging lists, vertical trim (leading trim), text wrap style (Balance/Pretty).
- Fonts: enumeration of local fonts, loading, glyph fallback, missing fonts, font replacement — adapted to a local-first desktop app.
- Text styles (and their override semantics), variables bound to typography fields and to text content.
- Text layout/rendering accuracy (Figma's own text engine: line-height model, half-leading, baseline placement, fractional metrics).
- Text-specific interactions with undo/redo, clipboard, export/flatten, components/instances, layers panel.
- Text on a path (`TEXT_PATH`, Figma Draw feature) — P2.

### 1.2 Out of scope, or adapted for a local-first app

| Figma feature | Treatment in Illigma | Why |
| --- | --- | --- |
| Organization "shared fonts" uploaded by admins; Google Fonts streamed from Figma's CDN; the browser font helper ("FigmaAgent") | **Adapted**: enumerate OS-installed fonts directly, plus a bundled offline default set (must include Inter so default text works offline), plus optional user/project font folders | No server; Figma's desktop app already reads system fonts directly [DOC:360039956894 excerpt] |
| Multiplayer text editing (other users' carets) | Out of scope | Single-user local app |
| Dev Mode CSS / code output of text | Out of scope | Not editor behavior |
| AI text tools (rewrite, translate, Figma "Agent") | Out of scope | Cloud features |
| FigJam / Slides / Sites text (sticky notes, shape-with-text, table cells, `TextSublayerNode`, connector labels) | Out of scope except **lossless import** of the data (M8) | Other products |
| Plugin text-review API (`figma.textreview`) | Out of scope | Plugin platform |
| Spell check, Find & replace | **P2** in this spec (§3.32) | Expected by pros, not core parity |

### 1.3 Figma terminology used in this spec

| Term (Figma) | Meaning | Data |
| --- | --- | --- |
| Text layer | A node of type `TEXT` | `TextNode` [API] |
| Characters | The raw string; UTF-16 code units; styles are attached to index ranges | `characters` [API] |
| Range / segment | A `[start, end)` UTF-16 range with uniform values for the requested fields | `StyledTextSegment`, `getStyledTextSegments` [API] |
| Paragraph | Text between hard breaks (`\n`, or paragraph separator) | `lineTypes`/`lineIndentations` are per "line delimited by newline or paragraph separator" [API REST] |
| Line | A visual line produced by wrapping (not stored) | derived |
| Text edit mode | State in which a caret/selection exists inside one (or several, with multi-edit) text layers; keystrokes edit text | transient |
| Resizing | Auto width (`WIDTH_AND_HEIGHT`), Auto height (`HEIGHT`), Fixed size (`NONE`) | `textAutoResize` [API] |
| Truncate text / Max lines | Ellipsis truncation and its line cap | `textTruncation`, `maxLines` [API] |
| Typography section | Right-sidebar section with font, size, line height, letter spacing, alignment, Type settings | UI [DOC:360039956634 excerpt] |
| Type settings (panel) | Pop-over opened from the Typography section; has a **Details** tab for OpenType features and a variable-font tab for variable fonts | [DOC:4913951097367 excerpt] [SRC:https://www.thomasphinney.com/tag/variable-fonts/] |
| Vertical trim | Leading trim: "Standard" vs "Cap height to baseline" | `leadingTrim: NONE \| CAP_HEIGHT` [API] |
| Hanging quotes / hanging punctuation | Opening quotation marks hang outside the text box | `hangingPunctuation` [API] |
| Hanging list | List markers hang outside the text box | `hangingList` [API] |
| Text wrap | Auto / Balance / Pretty, per paragraph | `textWrapStyle` [API] |
| Text style | Shared, named set of typographic values (not color) | `TextStyle` [API] |
| Variable font | A font with design axes (wght, wdth, slnt, opsz, ital, custom) | `FontName.variationSettings` [API] |
| Typography variable | A Figma variable bound to a text field (font family, size, …) | `boundVariables` / `VariableBindableTextField` [API] |
| Mixed | Inspector state when a selection spans different values | `figma.mixed` [API] |
| Missing font | Text whose font is unavailable on this machine | `hasMissingFont` [API] |

### 1.4 Terms users confuse (spec must keep them separate)

1. **Variable fonts vs. variables.** Font axes are font data stored in `fontName.variationSettings`; typography variables are document variables bound via `boundVariables`. Figma's own article warns these differ [DOC:5579502031511 excerpt].
2. **Resizing the text box vs. scaling text.** Handles/W/H change the box (and reflow), never the font size; only the Scale tool (K) changes font size [DOC:360040451453 excerpt] [DOC:27378154668951 excerpt].
3. **Line height % is percent of font size** (modern, `FONT_SIZE_%`), not percent of the font's intrinsic line height (legacy `INTRINSIC_%`) [API REST] [SRC:https://www.figma.com/blog/line-height-changes/].
4. **Fixed size does not clip.** Fixed-size text wraps horizontally but overflows below the box and is drawn [DOC:27378154668951 excerpt].
5. **Text styles do not contain color, alignment, resizing.** `TextStyle` has no `fills`, alignment or resizing fields [API].
6. **Text case is presentation only.** `textCase` "overrides the case of the raw characters"; `characters` are unchanged [API].
7. **Bold/italic/underline/link on styled text is an override, not a detach** (`textStyleOverrides` = SEMANTIC_WEIGHT, SEMANTIC_ITALIC, TEXT_DECORATION, HYPERLINK) [API].
8. **Paragraph spacing vs. list spacing vs. line height**: three different vertical gaps [API].
9. **Letter spacing vs. kerning**: letter spacing is a uniform added advance; kerning is the font's `KERN` feature [API] [SRC:https://designcode.io/figma-handbook-text-properties-and-styles/].

---

## 2. Data model

All property names below are Figma's (Plugin API unless marked REST). Illigma's document model must be able to represent every one of them losslessly, because `.fig`/REST import (M8) and round-tripping depend on it.

### 2.1 Node types

| Type | Status in this spec | Evidence |
| --- | --- | --- |
| `TEXT` (`TextNode`) — extends DefaultShapeMixin, ConstraintMixin, NonResizableTextMixin, ComplexStrokesMixin, AnnotationsMixin, AspectRatioLockMixin | Core (M3) | [API] |
| `TEXT_PATH` (`TextPathNode`) — text along a vector path; `textPathStartData {segment, position∈[0,1]}`; read-only `vectorNetwork`; created from a vector, shape or line | P2 (M3) — API marked beta | [API] [SRC:https://forum.figma.com/suggest-a-feature-11/make-text-follow-a-path-or-a-circle-34880] |
| `TextSublayerNode` (sticky/shape/table text) | Import only (M8) | [API] |

### 2.2 Node-level properties (one value per text layer)

| Property | Type / enum | Default for a new layer | Range / rules | Evidence |
| --- | --- | --- | --- | --- |
| `characters` | string | `""` | UTF-16 indices; UI must never split surrogate pairs or grapheme clusters; assigning the whole string resets range styles | [API] |
| `autoRename` | boolean | `true` | becomes `false` when the user renames the layer; while `true`, `name` is derived from `characters` | [API] |
| `textAutoResize` | `'NONE' \| 'HEIGHT' \| 'WIDTH_AND_HEIGHT' \| 'TRUNCATE'` | click-create → `WIDTH_AND_HEIGHT` [DOC:27378154668951 excerpt]; drag-create → `NONE` [KNOW] | `TRUNCATE` is deprecated (= `NONE` + `textTruncation: ENDING`), read-only for legacy | [API] |
| `textTruncation` | `'DISABLED' \| 'ENDING'` | `DISABLED` | with `NONE`: truncates when box is smaller than text; with `HEIGHT`/`WIDTH_AND_HEIGHT`: only with `maxHeight` or `maxLines` | [API] |
| `maxLines` | `number \| null` | `null` | integer ≥ 1; only applies when `textTruncation = ENDING`; `null` disables the cap | [API] |
| `textAlignHorizontal` | `'LEFT' \| 'CENTER' \| 'RIGHT' \| 'JUSTIFIED'` | `LEFT` [KNOW] | node-level (no range setter) | [API] |
| `textAlignVertical` | `'TOP' \| 'CENTER' \| 'BOTTOM'` | `TOP` [KNOW] | node-level | [API] |
| `hangingPunctuation` | boolean | `false` [KNOW] | node-level | [API] |
| `hangingList` | boolean | `false` [KNOW] | node-level | [API] |
| `leadingTrim` | `'NONE' \| 'CAP_HEIGHT'` | `NONE` | typed as possibly `mixed` but has no range accessor → treat as node-level | [API] |
| `textStyleId` | string \| mixed | `""` | per range (see §2.3); node read returns mixed if ranges differ | [API] |
| `width`, `height` | number | from creation | ≥ 0.01 | [API] |
| `layoutSizingHorizontal`, `layoutSizingVertical` | `'FIXED' \| 'HUG' \| 'FILL'` | — | `HUG` is valid on text nodes; `FILL` only for auto-layout children | [API] |
| `minWidth`, `maxWidth`, `minHeight`, `maxHeight` | number \| null | null | `maxHeight` participates in truncation | [API] |
| `targetAspectRatio` | Vector \| null | null | cannot be used when `textAutoResize ≠ NONE` | [API] |
| strokes, `strokeWeight`, `strokeAlign`, effects, opacity, blendMode, constraints, exportSettings, rotation | as other shapes | — | **node-level only** (no per-range strokes/effects) | [API] |
| `hasMissingFont` | boolean, derived | — | true if any range uses an unavailable font | [API] |
| `componentPropertyReferences.characters` | string | — | binds `characters` to a TEXT component property | [API] |
| `boundVariables.characters` | VariableAlias (STRING) | — | `characters` is in `VariableBindableNodeField` | [API] |

### 2.3 Character-level properties (may differ per range)

| Property | Type / enum | Default | Range / rules | Evidence |
| --- | --- | --- | --- | --- |
| `fontName` | `{ family, style, variationSettings? }` | `{ family: 'Inter', style: 'Regular' }` | `variationSettings` present only for variable fonts and lists **every** axis; setting an axis the family lacks is an error; omitting `style` resolves the nearest named instance | [API] |
| `fontWeight` | number (read-only) | 400 | derived from the font (e.g. 400 Regular, 700 Bold) | [API] |
| `fontStyle` (segment field) | `'REGULAR' \| 'ITALIC'` (read-only) | REGULAR | derived | [API] |
| `fontSize` | number | 12 [KNOW] | minimum 1; maximum unknown (§8) | [API] |
| `lineHeight` | `{unit:'AUTO'} \| {value, unit:'PIXELS'\|'PERCENT'}` | AUTO [KNOW] | PERCENT = % of font size (REST `FONT_SIZE_%`); legacy REST `INTRINSIC_%` must be converted on import | [API] |
| `letterSpacing` | `{value, unit:'PIXELS'\|'PERCENT'}` | `{0, PERCENT}` [KNOW] | PERCENT = % of font size [KNOW]; REST reports resolved px | [API] |
| `textCase` | `'ORIGINAL' \| 'UPPER' \| 'LOWER' \| 'TITLE' \| 'SMALL_CAPS' \| 'SMALL_CAPS_FORCED'` | ORIGINAL | presentation only | [API] |
| `textDecoration` | `'NONE' \| 'UNDERLINE' \| 'STRIKETHROUGH'` | NONE | single value → underline and strikethrough are mutually exclusive | [API] |
| `textDecorationStyle` | `'SOLID' \| 'WAVY' \| 'DOTTED' \| null` | null | null unless underlined | [API] |
| `textDecorationOffset` | `{unit:'AUTO'} \| {value, unit:'PIXELS'\|'PERCENT'} \| null` | null | null unless underlined | [API] |
| `textDecorationThickness` | same shape as offset | null | null unless underlined | [API] |
| `textDecorationColor` | `{value: SolidPaint} \| {value:'AUTO'} \| null` | null | AUTO = follows text fill [KNOW] | [API] |
| `textDecorationSkipInk` | boolean \| null | null | null unless underlined | [API] |
| `fills` | Paint[] | `[SOLID #000000, opacity 1]` [KNOW] | any paint type per range; color variables bindable | [API] |
| `fillStyleId` | string | "" | per range | [API] |
| `textStyleId` | string | "" | per range | [API] |
| `hyperlink` | `{type:'URL'\|'NODE', value} \| null` | null | range getter returns mixed if >1 link | [API] |
| `openTypeFeatures` | `{[OpenTypeFeature]: boolean}` | `{}` | only features that **diverge from the font default** are stored; LIGA/CLIG default on, LNUM/TNUM default off | [API] |
| `boundVariables` | `{[VariableBindableTextField]?: VariableAlias}` | — | fields: fontFamily, fontSize, fontStyle, fontWeight, letterSpacing, lineHeight, paragraphSpacing, paragraphIndent | [API] |
| `textStyleOverrides` | `('SEMANTIC_ITALIC'\|'SEMANTIC_WEIGHT'\|'HYPERLINK'\|'TEXT_DECORATION')[]` | [] | overrides that keep the text style attached; REST mirrors as `semanticWeight: BOLD\|NORMAL`, `semanticItalic: ITALIC\|NORMAL`, `isOverrideOverTextStyle` | [API] |

### 2.4 Paragraph-level properties (one value per paragraph; range setters expand to whole paragraphs)

| Property | Type | Default | Rules | Evidence |
| --- | --- | --- | --- | --- |
| `listOptions` | `{type:'ORDERED'\|'UNORDERED'\|'NONE'}` | NONE | REST `lineTypes[]` | [API] |
| `indentation` | number (list nesting level) | 0 [KNOW] | REST `lineIndentations[]`; UI supports 5 levels [DOC:360040449773 excerpt] | [API] |
| `listSpacing` | number (px) | 0 | vertical distance between list items | [API] [DOC:360040449773 excerpt] |
| `paragraphSpacing` | number (px) | 0 | vertical distance between paragraphs | [API] |
| `paragraphIndent` | number (px) | 0 | offset of the first line from the left; negative not accepted in UI [SRC:https://forum.figma.com/suggest-a-feature-11/allow-all-kinds-of-hanging-indents-13126] | [API] |
| `textWrapStyle` | `'AUTO' \| 'BALANCE' \| 'PRETTY'` | AUTO | BALANCE only applies to paragraphs of ≤ 6 wrapped lines | [API] [SRC:https://developers.figma.com/docs/plugins/api/TextWrapStyle/] |

Rule [API]: "all paragraphs covered by the provided text range will be modified, and remaining paragraphs will be untouched" (`setRangeParagraphSpacing` example, applies equally to the other paragraph-level setters).

### 2.5 Text style (`TextStyle`, type `'TEXT'`)

Fields [API]: `fontSize`, `textDecoration`, `fontName` (incl. `variationSettings`), `letterSpacing`, `lineHeight`, `leadingTrim`, `paragraphIndent`, `paragraphSpacing`, `textWrapStyle`, `listSpacing`, `hangingPunctuation`, `hangingList`, `textCase`, `boundVariables` (`VariableBindableTextField`), plus BaseStyle fields (name, description, documentation links, remote/key). `StyleChangeProperty` confirms the same set [API].
**Not** in the style: fills/color, horizontal/vertical alignment, resizing, truncation/max lines, decoration sub-styles, hyperlinks. Whether OpenType features are stored in text styles is **unverified** (REST `TypeStyle.opentypeFlags` exists, the plugin `TextStyle` has no such field) → §8.

### 2.6 Variable bindings

- `VariableBindableTextField` = `fontFamily | fontSize | fontStyle | fontWeight | letterSpacing | lineHeight | paragraphSpacing | paragraphIndent` — bindable per range on text nodes and on text styles [API].
- `characters` is bindable to a STRING variable [API].
- `TEXT_PATH` (REST `TextPathTypeStyle`) only binds `fontFamily, fontSize, fontStyle, fontWeight, letterSpacing` [API REST].
- Launched April 2024 ("typography variables") [SRC:https://forum.figma.com/suggest-a-feature-11/launched-typography-variables-font-size-font-weight-and-style-24920].

### 2.7 Serialized form (REST file schema) — import/export target

`TypePropertiesTrait` [API REST]: `characters`; `style: TypeStyle` (base style); `characterStyleOverrides: number[]` (per character index into `styleOverrideTable`, trailing zeros removed, 0 = base style); `styleOverrideTable: {id: TypeStyle}`; `lineTypes: ('NONE'|'ORDERED'|'UNORDERED')[]` and `lineIndentations: number[]` (one entry per newline/paragraph-separator-delimited line); `layoutVersion` (internal).
`TypeStyle` adds: `fontPostScriptName`, `italic`, `fontWeight`, `lineHeightPx`, `lineHeightPercent` (deprecated, % of intrinsic), `lineHeightPercentFontSize`, `lineHeightUnit: 'PIXELS'|'FONT_SIZE_%'|'INTRINSIC_%'`, `letterSpacing` (px), `opentypeFlags {TAG: 0|1}` (SMCP is represented by `textCase`), `semanticWeight`, `semanticItalic`, `isOverrideOverTextStyle`, `hyperlink {type, url, nodeID}`, `textAutoResize`, `textTruncation`, `maxLines`, `paragraphSpacing`, `paragraphIndent`, `listSpacing`, `textDecoration`, `textAlignHorizontal`, `textAlignVertical`, `boundVariables`.

**Illigma storage recommendation (design decision, not a Figma fact):** store `characters` + run-length character-attribute spans keyed by UTF-16 offsets + a per-paragraph attribute array + node attributes; persist `fontPostScriptName` alongside family/style; keep a derived layout cache that is **not** the source of truth except for the missing-font preview cache (§3.19).

### 2.8 Derived / cached data (recomputed, never user-edited)

- Line boxes, glyph runs (font ref, glyph ids, advances, positions), baselines (first baseline needed by auto-layout baseline alignment), ellipsis placement, **render bounds** (can exceed the box: fixed-size overflow, hanging punctuation/list, negative leading, italic overhang).
- `fontWeight`, `fontStyle`, `hasMissingFont`.
- Missing-font preview cache: Figma lets collaborators **preview** text set in a font they lack, but not edit it [DOC:360039956894 excerpt]; and a text node with a missing font "will be resized but the text will not re-layout until … opened on a machine that has the font" [API]. Illigma therefore must persist enough last-layout data (glyph outlines/positions) to render unchanged without the font.

### 2.9 Transient UI state (not document data)

Edit-mode target node id(s) (several in multi-edit), caret offset + affinity, selection anchor/focus, goal-x for vertical caret movement, pending insertion style (caret-only property changes), IME composition range and string, hovered link popup, font-picker query/preview state, active Type settings tab, link-input draft. App-preference (not document): last-used text properties for new layers [KNOW], font source folders.

### 2.10 Typings observations that affect the model

1. The `OpenTypeFeature` union has **229 tags** (PCAP … CV99, incl. SS01–SS20, CV01–CV99) but **does not contain** LNUM, ONUM, PNUM, TNUM, FRAC, SUPS, SUBS, SMCP, C2SC — although the `openTypeFeatures` doc comment cites "LNUM and TNUM are disabled by default", and REST says SMCP is represented by `textCase` [API]. Numeric figure style/spacing, fractions and super/subscript are therefore probably stored as separate (non-exposed) text properties. Illigma must model them explicitly; exact Figma representation → §8.
2. `lineHeight` is a per-character property even though it acts per line (§3.7 defines how a line resolves mixed values; needs verification).
3. Decoration sub-properties are `null` unless underlined → strikethrough has no style/offset/thickness/color [API], consistent with [SRC:https://forum.figma.com/suggest-a-feature-11/dotted-dashed-etc-underlines-text-decoration-style-support-36309].

---

## 3. Behavior specification

Rules are numbered `R<section>.<n>` so checklist items and tests can cite them.

### 3.1 Creating text with the Text tool

- R3.1.1 `T` (or the toolbar) activates the Text tool [DOC:360039956434 excerpt].
- R3.1.2 **Click** (pointer-up without exceeding the drag threshold) on the canvas creates a text layer with `textAutoResize = WIDTH_AND_HEIGHT` (Auto width) and enters edit mode with a caret [DOC:27378154668951 excerpt]. The layer grows horizontally as text is typed; new lines are created only by Return/Enter [DOC:27378154668951 excerpt].
- R3.1.3 **Drag** creates a text box with the dragged rectangle as its size and `textAutoResize = NONE` (Fixed size), and enters edit mode [KNOW]. Shift while dragging constrains to a square and Alt/Option draws from the center, like other draw tools [KNOW].
- R3.1.4 Placement: the new layer becomes a child of the top-most frame/section under the pointer-down point (same parent rules as other drawn layers, cross-area M1) [KNOW]. Inside an auto-layout frame the layer joins the flow at the insertion index nearest the pointer [KNOW].
- R3.1.5 Exiting edit mode while `characters === ""` deletes the layer; the net history contains no new layer [KNOW].
- R3.1.6 New-layer typography = the most recently used text settings in this session (family, style, size, line height, letter spacing, alignment, fill) when such exist; otherwise defaults Inter Regular, 12, Auto line height, 0% letter spacing, left/top, black fill [API for Inter Regular; rest KNOW].
- R3.1.7 After committing a new text layer with Esc, the tool returns to Move and the new layer stays selected [KNOW].
- R3.1.8 With the Text tool active, clicking **inside an existing text layer** places the caret in that layer at the click position instead of creating a new layer [KNOW].
- R3.1.9 Layer naming: while `autoRename` is true the layer name is derived from `characters`; renaming the layer sets `autoRename = false` and the name stops tracking content [API].

### 3.2 Entering and leaving text edit mode

- R3.2.1 Double-click on a text layer that is selectable at the current depth enters edit mode with the caret at the grapheme boundary nearest to the pointer [KNOW]. Text nested in groups follows the normal deep-select rules first (each double-click goes one level deeper until the text layer is selected; the next double-click edits) [KNOW].
- R3.2.2 Return/Enter with exactly one text layer selected enters edit mode [SRC:https://forum.figma.com/report-a-problem-6/can-t-edit-the-text-layer-while-double-clicking-the-text-layer-or-any-kind-of-text-28005] with **all** characters selected [KNOW].
- R3.2.3 Return/Enter (or the "Multi-edit text" control) with **several** text layers selected starts multi-edit (§3.29) [DOC:360039956434 excerpt].
- R3.2.4 Esc commits the edit and leaves edit mode, leaving the text layer selected; it does **not** cancel/revert the typed text [SRC:https://forum.figma.com/suggest-a-feature-11/make-ux-of-esc-key-more-consistet-cancel-or-submit-10446]. A second Esc then behaves as normal selection Esc (cross-area M1).
- R3.2.5 Clicking anywhere outside the edited layer commits and then processes the click normally (select/deselect/draw) [KNOW].
- R3.2.6 While in edit mode, single-key tool shortcuts (V, R, T, F, K, …) and Delete/Backspace act on text, never on layers; modifier shortcuts that have a text meaning (⌘B, ⌘I, ⌘U, ⌘A, ⌘C/X/V, ⌘Z) act on text [KNOW].
- R3.2.7 Locked text layers cannot be entered from the canvas [KNOW].
- R3.2.8 Edit mode works at any zoom and on rotated/flipped/nested-transformed layers; caret and hit-testing use the layer's full transform [KNOW].

### 3.3 Caret, selection, navigation (inside edit mode)

- R3.3.1 Indices are UTF-16 code units (Figma API semantics) but every UI caret movement, deletion and selection snaps to **extended grapheme cluster** boundaries (UAX #29), so emoji ZWJ sequences, flags, combining marks and surrogate pairs are atomic [API notes on surrogate pairs; grapheme rule KNOW].
- R3.3.2 Click places the caret at the nearest grapheme boundary on the clicked line; a click right of a line end goes to that line end; a click below the last line goes to text end; above first line → text start [KNOW].
- R3.3.3 Drag selects a range; Shift+click extends from the anchor; double-click selects a word (UAX #29 word boundaries); triple-click selects the paragraph [KNOW].
- R3.3.4 Left/Right move by one grapheme (visual order in RTL runs); with a non-empty selection they collapse it to its start/end. Up/Down move by visual line keeping a goal x; Up on the first line → text start, Down on the last line → text end [KNOW].
- R3.3.5 Platform text navigation (macOS / Windows): word ⌥←/→ / Ctrl+←/→; line start/end ⌘←/→ / Home/End; text start/end ⌘↑/↓ / Ctrl+Home/End; add Shift to extend; ⌘A / Ctrl+A selects all characters of the edited layer only [KNOW].
- R3.3.6 Caret at a soft-wrap boundary has affinity (end of upper line vs start of lower line) consistent with where it was placed [KNOW].

### 3.4 Text input

- R3.4.1 Typed characters replace the selection (if any) and take the **insertion style** (R3.5.4).
- R3.4.2 Return/Enter inserts a paragraph break `\n`; the new paragraph inherits paragraph attributes (alignment is node-level; list type/level, spacing, indent, wrap style copy from the current paragraph) [KNOW].
- R3.4.3 Shift+Return inserts a line break **within** the paragraph (no paragraph spacing; in a list item no new marker) [KNOW]; stored as U+2028 LINE SEPARATOR [KNOW] (REST mentions "newline or paragraph separator characters" [API REST]).
- R3.4.4 Tab inserts U+0009 in a normal paragraph; in a list item it increases the list level (§3.14) [DOC:360040449773 excerpt]. Tab-stop width → §8.
- R3.4.5 Backspace/Delete remove one grapheme cluster (Backspace after a combining sequence removes the whole cluster [KNOW]); ⌥⌫ / Ctrl+Backspace removes a word; ⌘⌫ removes to line start [KNOW].
- R3.4.6 IME (CJK etc.): composition (marked) text is shown inline with a composition underline at the caret, is **not** committed to the document or undo history until the IME commits; Return during composition commits the candidate without inserting a newline; Esc during composition cancels the composition and does not leave edit mode; candidate window is positioned at the caret in screen space [KNOW] (article exists: [DOC:360040449673 excerpt]).
- R3.4.7 OS dead keys, press-and-hold accent menu (macOS) and the OS emoji picker (⌃⌘Space / Win+.) insert characters normally [KNOW] (article exists: [DOC:360039957174 excerpt]).
- R3.4.8 No character auto-replacement: "smart symbols" such as `->` → arrow come from the font's contextual alternates (e.g. Inter `CALT`); `characters` still contain `->` and turning `CALT` off shows the literal [API (openTypeFeatures example: "Contextual alternates disabled (shows -> instead of ➔)")].
- R3.4.9 List auto-formatting on typing (§3.14).
- R3.4.10 While typing, Auto width boxes grow horizontally, Auto height boxes grow vertically, Fixed boxes do not change size (text overflows below) [DOC:27378154668951 excerpt].

### 3.5 Where a property change applies; mixed values

- R3.5.1 Layer(s) selected, not editing → applies to **all characters** of every selected text layer (and to text layers inside selected containers? → no; only directly selected text layers) [KNOW].
- R3.5.2 Editing with a non-empty selection → character-level properties apply to that range only; paragraph-level properties apply to every paragraph intersecting the range [API]; node-level properties (alignment, resizing, truncation, max lines, hanging, vertical trim) apply to the whole layer [API: no range setters].
- R3.5.3 Inspector shows **Mixed** for any property whose value differs across the selection (layers or range) [API `figma.mixed`]; entering a value replaces it uniformly.
- R3.5.4 Insertion style: inserted characters copy the style of the preceding character; at index 0 (or when there is no preceding character) the following character's style [API `insertCharacters` default `useStyle: 'BEFORE'`]. A property changed while the caret is collapsed is stored as a pending insertion style used for the next typed characters and discarded if the caret moves without typing [KNOW].
- R3.5.5 Select-all-then-type keeps the style of the first selected character [KNOW].

### 3.6 Resizing modes and handles

Semantics [API] [DOC:27378154668951 excerpt]:

| Mode | Width | Height | Wrapping |
| --- | --- | --- | --- |
| Auto width `WIDTH_AND_HEIGHT` | = widest line | = content height | none except hard breaks |
| Auto height `HEIGHT` | fixed | = content height | wraps at width |
| Fixed size `NONE` | fixed | fixed | wraps at width; overflow below the box is drawn, not clipped |

State machine for direct manipulation (pseudo-code):

```
onCanvasResize(node, handle, newW, newH):         // R3.6.1–R3.6.3
  changesHeight = handle in {top, bottom, any corner} or H typed in inspector
  changesWidthOnly = handle in {left, right} or W typed in inspector
  if changesHeight:            node.textAutoResize = 'NONE'          // [DOC:27378154668951 excerpt]
  elif changesWidthOnly:
      if node.textAutoResize in {'WIDTH_AND_HEIGHT','HEIGHT'}:
                               node.textAutoResize = 'HEIGHT'        // [KNOW] – must verify (§8 E-RS-2)
      else:                    stays 'NONE'
  node.width, node.height = newW, newH                 // font size never changes (only Scale tool)
  relayout(node)
onDoubleClickEdgeHandle(node, edge):                  // [KNOW] – §8 E-RS-3
  if edge in {left,right}: node.textAutoResize = 'WIDTH_AND_HEIGHT'
  if edge in {top,bottom}: node.textAutoResize = 'HEIGHT'
```

- R3.6.1 Manually changing a text layer's height on canvas sets Fixed size [DOC:27378154668951 excerpt].
- R3.6.2 Width-only changes keep the height automatic (→ Auto height) [KNOW; the DOC excerpt generalises "manual resize → Fixed size", so this must be verified].
- R3.6.3 Resizing a text box never changes font size; it only reflows [DOC:27378154668951 excerpt] [DOC:360040451453 excerpt].
- R3.6.4 Growth anchoring for Auto width: LEFT-aligned text grows to the right, CENTER grows equally both ways (box x shifts), RIGHT grows to the left [KNOW]. Auto height grows downward with the top edge fixed [KNOW]. Rotated layers grow along their local axes [KNOW].
- R3.6.5 The resizing control lives in the **Layout** section of the right sidebar [DOC:27378154668951 excerpt]; switching modes recomputes size immediately (Auto width removes soft wraps and sets width to the widest line).
- R3.6.6 Aspect-ratio lock is not applicable to auto-resizing text [API].
- R3.6.7 Legacy `textAutoResize = 'TRUNCATE'` on import maps to `NONE` + `textTruncation = 'ENDING'` [API].

### 3.7 Text layout model (Figma's own engine — normative algorithm, values to be validated)

Figma lays out text with its own engine, not the browser; line-height extra space is distributed **above and below** the glyphs (half-leading), and line height percentages are relative to font size [SRC:https://www.figma.com/blog/line-height-changes/] [API REST `lineHeightUnit`]. Illigma must be deterministic and platform-independent (same file → same glyph positions on macOS/Windows/Linux, at every zoom).

```
layout(node):
  W = (node.textAutoResize == 'WIDTH_AND_HEIGHT') ? (node.maxWidth ?? +INF) : node.width   // maxWidth-wrap: §8 E-AL-3
  paragraphs = splitOn(node.characters, '\n')              // U+2028 = forced break inside a paragraph
  y = 0; prevWasListItem = false; counters = ListCounters()
  for (i, P) in enumerate(paragraphs):
    pa = paragraphAttrs(P)                                  // listOptions, indentation, listSpacing, paragraphSpacing, paragraphIndent, textWrapStyle
    marker = listMarker(pa, counters)                       // §3.14; '' if not a list item
    startInset = listInset(pa.indentation, marker)          // §3.14 (formula: verify)
    runs = itemize(P): split by style run, bidi level (UAX #9), script, and per-character font fallback
    glyphs = shape(runs, openTypeFeatures(run), variationSettings(run))   // HarfBuzz-class shaping, KERN on by default
    glyphs = applyTextCase(glyphs)                          // presentation only (§3.13)
    glyphs = addLetterSpacing(glyphs)                       // +ls after each grapheme cluster; trailing behaviour: §8 E-LS-2
    lines = breakLines(glyphs,
                       availFirst = W - startInset - pa.paragraphIndent,
                       availRest  = W - startInset,
                       wrap = pa.textWrapStyle)             // UAX #14; trailing spaces hang; over-long word: §8 E-WR-2
    for L in lines:
      for r in runs(L):
        LH(r) = AUTO    -> (ascender(r) - descender(r) + lineGap(r)) * size(r)/upm(r)   // metric table choice: §8 E-LH-1
                PIXELS  -> value
                PERCENT -> value/100 * size(r)
      L.height   = max_r LH(r)                              // mixed-LH rule: §8 E-LH-3
      L.ascent   = max_r ascent(r); L.descent = max_r descent(r)
      halfLeading = (L.height - (L.ascent + L.descent)) / 2 // may be negative → glyphs overflow the line box
      L.top = y; L.baseline = y + halfLeading + L.ascent
      y += L.height
    if i < last: y += (isListItem(P) and isListItem(next)) ? pa.listSpacing : pa.paragraphSpacing   // interplay: §8 E-PS-2
  contentTop = 0; contentBottom = y
  if node.leadingTrim == 'CAP_HEIGHT':                       // §3.16
    contentTop    = firstLine.baseline - capHeight(firstLine)
    contentBottom = lastLine.baseline
  contentH = contentBottom - contentTop
  contentW = max over lines of (inset + advance)            // Auto width
  apply alignment (§3.8), truncation (§3.8/§3.9), hanging punctuation/list (§3.15)
  if textAutoResize == 'WIDTH_AND_HEIGHT': node.width = contentW; node.height = contentH
  if textAutoResize == 'HEIGHT':           node.height = contentH
  // all values are fractional; Figma does not round text box size to whole pixels [KNOW] (§8 E-RN-1)
```

- R3.7.1 Empty paragraphs (including a trailing `\n`) produce a line whose height comes from the style at that position (insertion style) [KNOW].
- R3.7.2 Line height smaller than the glyph extent is allowed; box height = Σ line heights, glyphs may draw outside the box [KNOW] [SRC:https://canary.grida.co/docs/@designto-code/figma-line-height].
- R3.7.3 Auto line height uses the font's built-in metrics [KNOW]; which table (hhea vs OS/2 typo vs win) Figma uses is a correctness risk → §8.
- R3.7.4 Text box height/position does not map 1:1 to CSS line boxes; Illigma follows Figma, not the browser [SRC:https://forum.figma.com/report-a-problem-6/text-layer-height-and-vertical-trim-do-not-map-clearly-to-browser-css-line-boxes-57490].
- R3.7.5 Layout is zoom-independent: no hinting-driven reflow; line breaks never change with zoom [KNOW].
- R3.7.6 Figma keeps a `layoutVersion` and offers "Recompute text layout" for selections [API REST] [SRC:https://forum.figma.com/report-a-problem-6/can-t-edit-existing-text-54712]; Illigma stores a layout-engine version with cached layout and recomputes when it changes.

### 3.8 Alignment

- R3.8.1 Horizontal LEFT/CENTER/RIGHT position each line inside `[startInset, W]` of its paragraph [API enum; geometry KNOW].
- R3.8.2 JUSTIFIED distributes the line's remaining width over inter-word spaces; the last line of each paragraph and lines ending in a forced break are start-aligned; a single-word line is start-aligned [KNOW].
- R3.8.3 Vertical TOP/CENTER/BOTTOM position the content block inside the box height; only visible when box height ≠ content height (Fixed size) [API enum; KNOW]. When content is taller than a Fixed box: TOP overflows downward, CENTER overflows equally up and down, BOTTOM overflows upward [KNOW] → §8.
- R3.8.4 Auto width + CENTER/RIGHT changes growth anchoring (R3.6.4).

### 3.9 Truncation (Truncate text + Max lines)

```
truncate(node, lines):
  if node.textTruncation != 'ENDING': return lines                     // [API]
  limit = +INF
  if node.maxLines != null: limit = min(limit, node.maxLines)          // [API] maxLines >= 1
  if node.textAutoResize == 'NONE': limit = min(limit, countLinesFitting(node.height))   // [API]
  if node.maxHeight != null: limit = min(limit, countLinesFitting(node.maxHeight))       // [API]
  limit = max(limit, 1)                                                // [KNOW]
  if lines.count <= limit: return lines
  keep = lines[0 .. limit-1]
  last = keep[limit-1]
  ell  = shape('…', styleOf(lastVisibleChar(last)))               // [KNOW]
  while width(last) + width(ell) > avail(last): drop trailing unit from last
        // unit = whole word per [SRC:https://forum.figma.com/t/rules-of-text-truncate/22408]; grapheme fallback for a single long word [KNOW]
  append ell to last; trailing spaces before the ellipsis are removed [KNOW]
  if node.textAutoResize == 'HEIGHT' or 'WIDTH_AND_HEIGHT': node.height = height(keep)
  return keep
```

- R3.9.1 The toggle and the Max lines field are in the Type settings panel [SRC:https://bringyourownlaptop.com/blog/truncate-text-responsive-ui-figma] [SRC:https://app.uxcel.com/lessons/working-with-texts-in-figma-889/text-truncation-and-max-lines-3569]; Max lines is only editable while truncation is on [KNOW].
- R3.9.2 Truncation is render-only: `characters` are unchanged, copy copies the full text, and edit mode shows the full text [KNOW] → §8.
- R3.9.3 Hug-height parents use the truncated height [KNOW]; a 2024 forum report links truncation to broken auto-layout hugging, so parity must be tested [SRC:https://forum.figma.com/ask-the-community-7/truncate-text-not-changeable-when-turned-into-style-3300].

### 3.10 Font family, style, weight, size

- R3.10.1 Font family picker: lists every available family; type-to-filter (case-insensitive substring); arrow keys move through results; hovering/arrowing previews the font on the selected text and Esc reverts the preview; Enter/click applies [DOC:360041308034 excerpt (article exists); interaction details KNOW].
- R3.10.2 Changing family keeps the current style name if the new family has it; otherwise the closest style (nearest weight, same italic-ness, falling back to Regular) is chosen [KNOW].
- R3.10.3 Style dropdown lists the family's named styles (and, for variable fonts, named instances plus an axes entry) [SRC:https://forum.figma.com/ask-the-community-7/how-do-i-disable-variable-font-axes-option-in-font-style-dropdown-15610].
- R3.10.4 `fontWeight` is derived and read-only [API].
- R3.10.5 ⌘B / ⌘I toggle bold/italic: switch to the family's bold (700, or next heavier) / italic counterpart, preserving the other attribute; toggling again returns to the previous style; no-op if the family has no counterpart [KNOW]. On a range with a text style applied the result is a `SEMANTIC_WEIGHT` / `SEMANTIC_ITALIC` override, and the style stays attached [API].
- R3.10.6 ⌥⌘> / ⌥⌘< step through the family's weights (next heavier/lighter named style, preserving italic) [SRC:https://linuru.com/figma/] [SRC:https://www.raycast.com/arturdz/figma-shortcuts].
- R3.10.7 Font size: minimum 1 [API]; fractional values allowed [KNOW]; ⌘⇧> / ⌘⇧< increase/decrease [SRC:https://www.raycast.com/arturdz/figma-shortcuts] (step → §8). Changing size leaves px line height/letter spacing unchanged while Auto/% values scale with size [API semantics].

### 3.11 Variable fonts

- R3.11.1 Axes: standard `wght`, `wdth`, `slnt`, `opsz`, `ital` and font-specific custom axes; values are continuous within the font's range, `ital` is binary [DOC:5579502031511 excerpt] [SRC:https://www.figma.com/typography/variable-fonts/].
- R3.11.2 The variable tab/controls appear only when the current font is variable [SRC:https://www.thomasphinney.com/tag/variable-fonts/]; each axis has a slider + numeric input bounded by the font's fvar min/max [KNOW].
- R3.11.3 Values are stored in `fontName.variationSettings`; reads list every axis; setting a subset keeps the named instance's values for the others; setting an unknown axis is an error [API].
- R3.11.4 When axis values do not match a named instance, the style field shows a numeric readout (e.g. "Weight: 357") [SRC:https://forum.figma.com/ask-the-community-7/how-do-i-disable-variable-font-axes-option-in-font-style-dropdown-15610]; choosing a named instance resets axes to that instance [KNOW]; `FontNameInput` without `style` resolves the nearest named instance (e.g. wght 900 → "Black") [API].
- R3.11.5 Axis values can differ per range (mixed) [API].

### 3.12 OpenType features

- R3.12.1 Storage = map of features that diverge from their default; defaults on: LIGA, CLIG (and KERN, CALT, CCMP, LOCL, MARK/MKMK, RLIG as shaping defaults [KNOW]); defaults off: e.g. DLIG, SS01–SS20, CV01–CV99, ZERO, ORDN [API (LIGA/CLIG on, LNUM/TNUM off) + KNOW].
- R3.12.2 The Details tab shows only features supported by the current font; unsupported options are greyed out; hovering an option previews it [DOC:4913951097367 excerpt].
- R3.12.3 Groups seen in the Details tab: **Letterforms** (ligatures, rare ligatures, contextual alternates, ordinals), **Stylistic sets** (up to 20, names come from the font), **Character variants**, **Horizontal spacing** (kerning) [DOC:4913951097367 excerpt]; number options (figure style/spacing, fractions, slashed zero), case-sensitive forms, capital spacing, positional forms exist per [KNOW] → §8.
- R3.12.4 Features apply per range; mixed ranges show a mixed/indeterminate checkbox [API; UI KNOW].
- R3.12.5 Letter spacing ≠ 0 and optional ligatures: whether Figma disables LIGA/DLIG when letter spacing is non-zero (CSS does) → §8.

### 3.13 Decoration and case

- R3.13.1 Underline and strikethrough are exclusive (single enum); ⌘U toggles UNDERLINE, ⌘⇧X toggles STRIKETHROUGH; applying one replaces the other [API enum; shortcuts SRC:https://www.raycast.com/arturdz/figma-shortcuts].
- R3.13.2 Underline styling (shipped Nov 2024): style Solid/Wavy/Dotted, thickness Auto/px/%, offset Auto/px/%, color Auto or a solid paint, skip ink on/off [API] [SRC:https://alternativeto.net/news/2024/11/figma-adds-customization-options-for-underlines]. Strikethrough has no options [API] [SRC:https://forum.figma.com/suggest-a-feature-11/dotted-dashed-etc-underlines-text-decoration-style-support-36309]. % values are relative to font size [KNOW].
- R3.13.3 Decoration is drawn per glyph run, continuous across spaces inside the range, broken at line ends; skip ink breaks the underline around descenders [KNOW].
- R3.13.4 Case: ORIGINAL (as typed), UPPER, LOWER, TITLE (first letter of each word uppercased, other letters unchanged [KNOW]), SMALL_CAPS (font `smcp`: lowercase → small caps), SMALL_CAPS_FORCED (also capitals → small caps, `c2sc`) [API enum; mapping KNOW]. Rendering only; `characters` and copied text are unchanged [API]. Behaviour for fonts without `smcp` → §8.

### 3.14 Lists

- R3.14.1 Auto-detection: at the start of a paragraph, typing `-` or `*` followed by Space makes a bulleted list item; `1.` or `1)` followed by Space makes a numbered item; the typed marker characters are removed [DOC:360040449773 excerpt].
- R3.14.2 ⌘Z immediately after an auto-detected list removes the list formatting and restores the literal characters [DOC:360040449773 excerpt].
- R3.14.3 ⌘⇧8 / ⌘⇧7 convert the selection (in edit mode) or entire selected text layers (incl. multiple layers) to bulleted / numbered lists [DOC:360040449773 excerpt]; applying the same list type again removes it [KNOW].
- R3.14.4 Nesting: up to **5** levels [DOC:360040449773 excerpt]. ⌘] / Ctrl+] and Tab (in a list item) increase; ⌘[ decreases [DOC:360040449773 excerpt] [SRC:https://forum.figma.com/report-a-problem-6/keyboard-shortcut-send-backwards-overlapping-with-decrese-indentation-51642]; Shift+Tab → §8.
- R3.14.5 Backspace at the start of a list item deletes the counter/bullet but keeps the indentation level [DOC:360040449773 excerpt]. Return on an empty list item decreases the indentation [DOC:360040449773 excerpt]; at the outermost level it ends the list (paragraph becomes NONE) [KNOW].
- R3.14.6 Return at the end of a non-empty item creates a new item of the same type and level [KNOW].
- R3.14.7 Numbering: counters increment per level within a contiguous run of list items; a deeper level restarts at 1 under each parent item; the counter format rotates between numbers, alphabetical characters and roman numerals with each indentation level [DOC:360040449773 excerpt]. Exact cycle (e.g. `1.` → `a.` → `i.` → `1.` …) and bullet glyphs per level → §8.
- R3.14.8 List spacing (px, default 0, also 0 for existing text styles) sets the distance between items [DOC:360040449773 excerpt] [API].
- R3.14.9 Marker text uses the style of the item's first character (font, size, fill) [KNOW]; markers are not part of `characters` (they are generated) [API REST: list type stored in `lineTypes`].
- R3.14.10 Number markers are left-aligned per item, so items 10+ shift their text relative to items 1–9 (accepted Figma limitation) [SRC:https://forum.figma.com/t/is-there-a-way-to-make-a-numbered-list-without-a-hanging-indent/56402.rss].

```
onSpaceTyped(caret):                                 // R3.14.1
  P = paragraphAt(caret); prefix = P.text[0 .. caret)
  if P.listType == NONE and prefix in {'-', '*'}:   convert(P, UNORDERED); delete prefix; pushUndoStep('auto-list')
  elif P.listType == NONE and prefix in {'1.', '1)'}: convert(P, ORDERED);   delete prefix; pushUndoStep('auto-list')
  else insert ' '
listMarker(P):                                       // R3.14.7
  level = P.indentation (1..5)
  n = 1 + count of preceding contiguous items at same level under the same parent
  ORDERED   -> format(n, cycle[(level-1) mod 3]) + '.'      // cycle = [decimal, lower-alpha, lower-roman]  (verify)
  UNORDERED -> bulletGlyph[(level-1) mod k]                  // glyphs: verify
```

### 3.15 Hanging punctuation and hanging lists

- R3.15.1 `hangingPunctuation` ("Hanging quotes"): opening quotation marks at the start of a line are placed outside the left edge of the text box so the letters align with the edge; only quotation marks hang (asterisks and other symbols do not) [DOC:360040449773 excerpt (TOC shows "Hanging quotes")] [SRC:https://forum.figma.com/suggest-a-feature-11/include-asterisks-when-hanging-punctuation-19920]. Exact character set and whether closing marks hang at the right edge → §8.
- R3.15.2 `hangingList`: bullets/numbers are placed outside the text box so item text aligns with the box edge [API] [DOC:360040449773 excerpt].
- R3.15.3 Both are node-level booleans and part of text styles [API]. Hung glyphs extend render bounds, not layout bounds [KNOW].

### 3.16 Vertical trim (leading trim)

- R3.16.1 "Standard" (`NONE`) does nothing; "Cap height to baseline" (`CAP_HEIGHT`) removes the space above the first line's cap height and below the last line's baseline; all inter-line leading is kept [SRC:https://bejamas.com/blog/everything-you-need-to-know-about-figma-s-vertical-trim-feature] [API].
- R3.16.2 Auto-height/auto-width box height becomes `lastBaseline − (firstBaseline − capHeight)`; the layer's y changes so glyphs stay visually in place [KNOW] → §8.
- R3.16.3 Cap height comes from the font (OS/2 `sCapHeight`); for CJK fonts, Latin cap height makes glyphs protrude slightly [SRC:https://ics.media/en/entry/250319/].
- R3.16.4 Located in Type settings; part of text styles [SRC:https://bejamas.com/blog/everything-you-need-to-know-about-figma-s-vertical-trim-feature] [API].

### 3.17 Text wrap style (Balance / Pretty)

- R3.17.1 Per paragraph: AUTO (default greedy), BALANCE (line lengths made roughly equal; only paragraphs with ≤ 6 wrapped lines), PRETTY (avoid a single word alone on the last line) [API] [SRC:https://developers.figma.com/docs/plugins/api/TextWrapStyle/] [SRC:https://forum.figma.com/product-updates-3/get-responsive-text-across-screens-with-new-text-wrap-styles-56992].
- R3.17.2 Settable on a layer, a text style or an individual paragraph (Type settings) [SRC:https://forum.figma.com/product-updates-3/get-responsive-text-across-screens-with-new-text-wrap-styles-56992]. Launched 2026-08-14 [SRC:https://developers.figma.com/docs/plugins/updates/2026/08/14/version-1-update-134/].
- R3.17.3 Balance keeps the same number of lines as AUTO and only redistributes [KNOW]; no effect on Auto width text (no soft wraps) [KNOW].

### 3.18 Links

- R3.18.1 Create: select a range (edit mode) or a whole layer, press ⌘⇧U / Ctrl+Shift+U (⌘K is no longer the link shortcut since UI3), type a URL, Return to confirm [SRC:https://forum.figma.com/ask-the-community-7/ui3-feedback-create-link-shortcuts-cmd-ctrk-k-cmd-ctrl-v-not-working-30909] [DOC:360045942953 excerpt].
- R3.18.2 With a URL on the clipboard, ⌘V over a selected text range links the range instead of pasting characters [DOC:360045942953 excerpt].
- R3.18.3 Targets: external URL (`type: 'URL'`) or a node/frame/page in the same file (`type: 'NODE'`, value = node id) [API].
- R3.18.4 Linked ranges get the link appearance (underline) automatically [KNOW]; hovering a link on canvas shows a popup with the target and open/edit/remove actions [KNOW] → §8.
- R3.18.5 On text with a text style, a link is a `HYPERLINK` override (style stays attached) [API].
- R3.18.6 `getRangeHyperlink` over several links returns mixed [API]; editing a link with a mixed range replaces all links in the range [KNOW].
- R3.18.7 In prototype/presentation view links are clickable: URL opens externally, NODE navigates (M7) [KNOW].
- R3.18.8 Typing immediately after the end of a link does not extend the link [KNOW] → §8.

### 3.19 Fonts: availability, loading, missing fonts (local-first)

- R3.19.1 Font sources. Figma desktop includes the font helper and uses fonts installed on the computer [DOC:360039956894 excerpt]; fonts installed while the app runs may require relaunch [SRC:https://designbeep.com/2026/04/26/how-to-add-fonts-to-figma/]. Figma priority when the same family exists in several sources: shared organization font → locally installed → Figma default web fonts (Inter handled specially) [DOC:360039956994 excerpt]. **Illigma adaptation:** sources = bundled offline set (incl. Inter) + OS-installed + user/project font folders; Illigma watches for font installs and re-enumerates without restart; conflict priority = user/project folder → OS → bundled (Illigma decision, record in file which source/postscript name/version resolved).
- R3.19.2 Per character, if the run's font lacks a glyph, render it with a fallback font (emoji font, CJK fonts, symbol fonts) without changing `fontName` [KNOW].
- R3.19.3 Missing font: a text node whose `fontName` cannot be resolved has `hasMissingFont = true` [API]. The UI shows a missing-font indicator in the toolbar/left area for the file and an icon next to the font name in the right sidebar for selected layers [DOC:360039956994 excerpt].
- R3.19.4 Missing-fonts modal lists each missing family/style and the affected layers; per missing font the user picks a Replacement family and style from available fonts; **Replace fonts** updates every text object in the file [DOC:360039956994 excerpt]; Illigma makes this one undo step [KNOW].
- R3.19.5 Text with a missing font keeps rendering its last layout (preview) and cannot be edited until the font is available or replaced [DOC:360039956894 excerpt]. Operations that would require re-layout (resize, property change) are blocked or deferred; a resize of such a node changes the box without re-layout [API].
- R3.19.6 When a missing font becomes available, affected nodes re-layout [KNOW] (Figma: "Recompute text layout" exists as a manual command [SRC:https://forum.figma.com/report-a-problem-6/can-t-edit-existing-text-54712]).
- R3.19.7 "Select all with same font" exists under Edit → Select all with [SRC:https://forum.figma.com/report-a-problem-6/can-t-edit-existing-text-54712] (cross-area M1 selection).
- R3.19.8 Icon fonts work through ligatures (typing the icon name with LIGA on) or private-use code points [KNOW] (article exists: [DOC:360040449513 excerpt]).

### 3.20 Text styles and overrides

- R3.20.1 Creating a text style from a selection captures the fields listed in §2.5 from the selection's (first) style run [KNOW]; color is not captured [API].
- R3.20.2 Applying a style sets `textStyleId` and all style fields on the target layer(s) or range [API `setRangeTextStyleIdAsync`].
- R3.20.3 Editing a style re-lays-out every consumer [KNOW].
- R3.20.4 Changing any style-controlled property on a styled range removes the style link from that range (values retained) [KNOW] — except the four override kinds (bold, italic, decoration, hyperlink), which keep the style attached and are recorded in `textStyleOverrides` [API]. A later edit of the style's font re-resolves semantic overrides (e.g. bold override + style font changed to Roboto → Roboto Bold) [KNOW inference from "semantic"] → §8.
- R3.20.5 Detach style keeps current values and clears `textStyleId` [KNOW].
- R3.20.6 Text with a style in the layer shows the style name in the Typography section; mixed styles show Mixed [KNOW].
- R3.20.7 Library/publishing aspects are M6 (cross-area).

### 3.21 Typography variables

- R3.21.1 Bindable: font family (STRING, must name an available family), font style (STRING, must name a valid style of the family), font weight (NUMBER e.g. 400/700, or STRING style name per tutorials), font size, line height, letter spacing, paragraph spacing, paragraph indent (NUMBER) [API] [SRC:https://uxdesign.cc/set-up-typography-variables-in-figma-359cfea88b68].
- R3.21.2 A variable value that does not match an existing style of the family has no effect (e.g. weight name "XBold" when the font only has "Bold") [SRC:https://frontendmasters.com/blog/figma-typography-variables/] → exact fallback in §8.
- R3.21.3 Line-height variables are numbers interpreted as px (no %); letter-spacing unit → §8 [SRC:https://forum.figma.com/suggest-a-feature-11/launched-typography-variables-font-size-font-weight-and-style-24920].
- R3.21.4 Changing a mode or a variable value re-resolves and re-lays-out all bound text (incl. inside text styles) [KNOW].
- R3.21.5 `characters` bound to a STRING variable displays the variable value; typing into it … (detaches or edits the variable?) → §8 [API binding exists; UI KNOW].

### 3.22 Text in auto layout (cross-area M4)

- R3.22.1 Mapping between sizing and resizing [API `layoutSizing*` + KNOW]:

| Horizontal | Vertical | `textAutoResize` |
| --- | --- | --- |
| HUG | HUG | `WIDTH_AND_HEIGHT` |
| FIXED or FILL | HUG | `HEIGHT` |
| any | FIXED or FILL | `NONE` |

- R3.22.2 FILL-width text wraps at the width the parent allots; its hug height updates the parent's hug size in the same layout pass [KNOW].
- R3.22.3 `maxWidth` on a HUG-width text makes it wrap when it reaches the max (CSS-like) [KNOW] → §8.
- R3.22.4 Horizontal auto layout supports `counterAxisAlignItems = 'BASELINE'` (children aligned on the first text baseline); it can only be set on horizontal auto-layout frames [API]; it was disabled in a vertical container in the live observation [OBS].

### 3.23 Scale tool on text

- R3.23.1 Scale (K) scales the text box **and** the font size together, preserving proportions; strokes and effects scale too [DOC:360040451453 excerpt]. Pixel-unit typography values (px line height, px letter spacing, paragraph spacing/indent, list spacing, px decoration thickness/offset) scale by the same factor; %/Auto values stay [KNOW] → §8.
- R3.23.2 `rescale(s)` requires s ≥ 0.01 and scales from the top-left (API); on-canvas the anchor follows the Scale tool's anchor control [API; UI KNOW].
- R3.23.3 Resizing mode is preserved by Scale [KNOW].

### 3.24 Components and instances (cross-area M5)

- R3.24.1 A text layer's `characters` can be bound to a TEXT component property [API].
- R3.24.2 Editing text in an instance creates an override; overridden characters/styles survive main-component updates; non-overridden properties keep following the main component [KNOW].
- R3.24.3 Per-range style overrides in instances (e.g. one word bold) are preserved across main-component text edits as long as the override exists [KNOW] → §8.

### 3.25 Undo/redo

- R3.25.1 Typing is grouped into undo steps (word/pause granularity) while in edit mode; ⌘Z in edit mode undoes text steps and restores the caret/selection [KNOW].
- R3.25.2 Each inspector change is one step; a scrub (drag on a field label/icon) is one step on release [KNOW].
- R3.25.3 Auto-list detection is a separate step (R3.14.2) [DOC:360040449773 excerpt].
- R3.25.4 Creating a text layer + typing + Esc, then ⌘Z repeatedly: steps back through typing then removes the layer [KNOW] → §8.

### 3.26 Clipboard

- R3.26.1 Copy in edit mode: internal clipboard keeps rich text (all character/paragraph attributes); system clipboard gets plain text (UTF-8, `\n` line breaks) [KNOW].
- R3.26.2 Paste in edit mode from Illigma: keeps source styles; paste of external plain text: takes the insertion style; CRLF/CR normalised to `\n`; tabs kept [KNOW]. External rich text formatting is ignored [KNOW] → §8.
- R3.26.3 Paste text while not editing: creates a new text layer containing the text [KNOW] (placement and resizing mode → §8).
- R3.26.4 Copy/paste of whole text layers duplicates everything (M1 clipboard) [KNOW]. Copy/paste properties transfers text properties (cross-area) [KNOW].

### 3.27 Export and flatten

- R3.27.1 Flatten (⌘E) / "Convert text to vector paths" converts glyphs (and decorations) into vector paths; editability is lost; fills/strokes/effects carry over [DOC:360047239073 excerpt (article exists); details KNOW].
- R3.27.2 SVG export outlines text by default with an option to keep `<text>` elements; PDF export keeps text selectable; raster export matches canvas rendering [KNOW] → §8.

### 3.28 Layers panel

- R3.28.1 Text layers show the text-layer icon and the auto-derived name (R3.1.9) [API autoRename; icon KNOW].
- R3.28.2 Double-clicking the layer **name** renames it (does not enter text edit) [KNOW].

### 3.29 Multi-edit

- R3.29.1 Select several text layers, then "Multi-edit text" or Return/Enter → edit them together [DOC:360039956434 excerpt]. Expected: a caret in each layer (initially all text selected in each), typing/deleting/styling applies to every layer, Esc exits [KNOW] → §8.

### 3.30 Text on a path (P2)

- R3.30.1 `TEXT_PATH` is created from a vector, shape or line; text flows along the path from `textPathStartData` (segment index + position 0–1); a blue handle sets the start; a Flip option in the Typography section moves the text to the other side of the path [API] [SRC:https://forum.figma.com/suggest-a-feature-11/make-text-follow-a-path-or-a-circle-34880]. A dedicated tool lets users drag on an empty canvas to make circular text (2026 Draw update) [SRC:https://www.createwith.com/tool/figma/updates/figma-ships-text-on-path-tool-and-auto-layout-to-draw-mode]. The base vector network cannot be modified after creation (API) [API].

### 3.31 International text, emoji

- R3.31.1 Bidirectional text (Arabic/Hebrew) is shaped and ordered by UAX #9; caret movement is visual; paragraph direction from first strong character [KNOW] (article exists: [DOC:4972283635863 excerpt]).
- R3.31.2 CJK: line breaking follows UAX #14 + kinsoku rules; IME per R3.4.6; vertical writing is not supported [KNOW] (article exists: [DOC:360040449673 excerpt]).
- R3.31.3 Emoji render in color through a color-emoji fallback font regardless of the run font [KNOW].

### 3.32 Spell check, find & replace (P2)

- R3.32.1 Spell check underlines misspelled words while editing and offers suggestions on right-click [KNOW]. (Figma plugins can add text-review suggestions — out of scope [API].)
- R3.32.2 Find (⌘F) searches text-layer content (and layer names) on the page/file; Replace replaces in matching text layers preserving the style of the first replaced character [KNOW].

### 3.33 Rendering accuracy requirements

- R3.33.1 Same glyph positions on all platforms and zoom levels (no OS text engine, no hinting).
- R3.33.2 Box sizes are fractional (no snapping to whole pixels) [KNOW].
- R3.33.3 Golden tests: a fixture file of text layers covering every property in §2 is laid out in Figma and Illigma; line count, line breaks, baselines and box sizes must match within 0.01 px (box) and 0.1 px (glyph positions) for fonts installed identically on both [KNOW-derived acceptance threshold].

---

## 4. Inspector & on-canvas controls (functional; visuals come from Framer)

Location notes follow Figma UI3 as far as evidence allows; exact placement within a section is to be confirmed (§8 E-UI-1).

| Control | Location (Figma UI3) | Function | Evidence |
| --- | --- | --- | --- |
| Text tool | Toolbar (bottom), `T` | §3.1 | [DOC:360039956434 excerpt] |
| Resizing: Auto width / Auto height / Fixed size | Layout section (right sidebar) | sets `textAutoResize` | [DOC:27378154668951 excerpt] |
| W / H fields, min/max | Layout section | §3.6, §3.22 | [API] |
| Text style picker (apply/create/detach/edit style) | Typography section header | §3.20 | [DOC:360039957034 excerpt (article exists)] [KNOW] |
| Font family (searchable picker) | Typography | §3.10 | [DOC:360041308034 excerpt] |
| Font style / weight dropdown (incl. variable axes entry) | Typography | §3.10, §3.11 | [SRC:https://forum.figma.com/ask-the-community-7/how-do-i-disable-variable-font-axes-option-in-font-style-dropdown-15610] |
| Font size (numeric combobox) | Typography | §3.10 | [KNOW] |
| Line height (Auto / px / %) | Typography | §3.7 | [API] [DOC:360039956634 excerpt] |
| Letter spacing (% / px) | Typography | §3.7 | [API] [DOC:360039956634 excerpt] |
| Horizontal alignment (left, center, right, justified) | Typography | §3.8 | [API] |
| Vertical alignment (top, middle, bottom) | Typography | §3.8 | [API] |
| Type settings button → panel | Typography | opens tabs below | [DOC:4913951097367 excerpt] |
| ↳ Basics/general tab: decoration (none/underline/strikethrough) + underline style, thickness, offset, color, skip ink; case; vertical trim; list type; paragraph spacing; paragraph indent; list spacing; hanging quotes; hanging list; truncate text + max lines; text wrap (Auto/Balance/Pretty); flip (text on path) | Type settings | §3.13–§3.17, §3.9 | [SRC] per section; grouping [KNOW] |
| ↳ Details tab: OpenType features with hover preview | Type settings | §3.12 | [DOC:4913951097367 excerpt] |
| ↳ Variable tab: one control per axis | Type settings (variable fonts only) | §3.11 | [SRC:https://www.thomasphinney.com/tag/variable-fonts/] |
| Fill section | Right sidebar | per-range text color/paints and color styles/variables | [API] |
| "Apply variable" on font family/size/weight/line height/letter spacing/paragraph fields | field context menus / style editor | §3.21 | [SRC:https://uxdesign.cc/set-up-typography-variables-in-figma-359cfea88b68] |
| Missing-font indicator + modal | Toolbar/left area; icon beside font name in Typography | §3.19 | [DOC:360039956994 excerpt] |
| Multi-edit text button | Shown when several text layers are selected | §3.29 | [DOC:360039956434 excerpt] |
| Numeric field behaviours (scrub by dragging the label/icon, arithmetic, ↑/↓ steps) | all numeric fields | cross-area inspector kit (M0/M1) | [SRC:https://uxcel.com/lessons/lists-paragraphs-in-figma-431] (scrub on list spacing) [KNOW] |

On-canvas: text box outline + resize handles (§3.6), caret and selection highlight (§3.3), IME composition underline (§3.4), list markers (§3.14), truncation ellipsis (§3.9), link hover popup (§3.18), text-path start handle (§3.30), baseline alignment guides in auto layout (M4).

---

## 5. Keyboard shortcuts

Windows mapping: ⌘ → Ctrl, ⌥ → Alt, ⇧ → Shift [SRC:https://www.raycast.com/arturdz/figma-shortcuts]. Third-party lists disagree on some keys; disputed ones are flagged and must be checked against Figma's in-app shortcut panel (§8 E-KB-1).

| Action | macOS | Windows | Evidence |
| --- | --- | --- | --- |
| Text tool | T | T | [DOC:360039956434 excerpt] |
| Edit selected text layer / multi-edit | ↩ | Enter | [SRC:https://forum.figma.com/report-a-problem-6/can-t-edit-the-text-layer-while-double-clicking-the-text-layer-or-any-kind-of-text-28005] [DOC:360039956434 excerpt] |
| Commit and leave edit mode | Esc | Esc | [SRC:https://forum.figma.com/suggest-a-feature-11/make-ux-of-esc-key-more-consistet-cancel-or-submit-10446] |
| Bold / Italic / Underline | ⌘B / ⌘I / ⌘U | Ctrl+B / I / U | [SRC:https://www.raycast.com/arturdz/figma-shortcuts] |
| Strikethrough | ⌘⇧X | Ctrl+Shift+X | [SRC:https://www.raycast.com/arturdz/figma-shortcuts] |
| Create link | ⌘⇧U | Ctrl+Shift+U | [SRC:https://forum.figma.com/ask-the-community-7/ui3-feedback-create-link-shortcuts-cmd-ctrk-k-cmd-ctrl-v-not-working-30909] |
| Bulleted list / Numbered list | ⌘⇧8 / ⌘⇧7 | Ctrl+Shift+8 / 7 | [DOC:360040449773 excerpt] |
| Increase / decrease list indentation | ⌘] (Tab in list) / ⌘[ | Ctrl+] / Ctrl+[ | [DOC:360040449773 excerpt] [SRC:https://forum.figma.com/report-a-problem-6/keyboard-shortcut-send-backwards-overlapping-with-decrese-indentation-51642] |
| Text align left / center / right / justified | ⌥⌘L / ⌥⌘T / ⌥⌘R / ⌥⌘J (disputed: some lists give ⌘⇧L/E/R/J) | Ctrl+Alt+L / T / R / J | [SRC:https://linuru.com/figma/] [SRC:https://www.devlinpeck.com/downloads/figma-keyboard-shortcuts.pdf] |
| Font size up / down | ⌘⇧> / ⌘⇧< | Ctrl+Shift+> / < | [SRC:https://www.raycast.com/arturdz/figma-shortcuts] |
| Font weight up / down | ⌥⌘> / ⌥⌘< | Ctrl+Alt+> / < | [SRC:https://linuru.com/figma/] |
| Letter spacing up / down | ⌥> / ⌥< | Alt+> / < | [SRC:https://www.raycast.com/arturdz/figma-shortcuts] |
| Line height up / down | ⌥⇧> / ⌥⇧< (direction disputed) | Alt+Shift+> / < | [SRC:https://www.raycast.com/arturdz/figma-shortcuts] [SRC:https://forum.figma.com/suggest-a-feature-11/fix-line-height-shortcut-behavior-23443] |
| Scale tool | K | K | [DOC:360040451453 excerpt] |
| Flatten (text → vectors) | ⌘E | Ctrl+E | [KNOW] |
| Soft line break | ⇧↩ | Shift+Enter | [KNOW] |
| Word / line / text navigation, delete word | ⌥←→, ⌘←→, ⌘↑↓, ⌥⌫ | Ctrl+←→, Home/End, Ctrl+Home/End, Ctrl+Backspace | [KNOW] |
| Select all characters (edit mode) | ⌘A | Ctrl+A | [KNOW] |
| Undo / Redo | ⌘Z / ⌘⇧Z | Ctrl+Z / Ctrl+Shift+Z (Ctrl+Y) | [KNOW] |
| Find (and replace) | ⌘F | Ctrl+F | [KNOW] |
| OS emoji picker | ⌃⌘Space | Win+. | [KNOW] (OS feature) |

---
