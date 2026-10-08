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
- R3.4.6 IME (CJK etc.): composition (marked) text is shown inline with a composition underline at the caret, is **not** committed to the document or undo history until the IME commits; Return during composition commits the candidate without inserting a newline; Esc during composition cancels the composition and does not leave edit mode; candidate window is positioned at the caret in screen space [KNOW] (reference article 360040449673, not read).
- R3.4.7 OS dead keys, press-and-hold accent menu (macOS) and the OS emoji picker (⌃⌘Space / Win+.) insert characters normally [KNOW] (reference article 360039957174, not read).
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
- R3.7.2 Line height smaller than the glyph extent is allowed; box height = Σ line heights, glyphs may draw outside the box [KNOW].
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

- R3.10.1 Font family picker: lists every available family; type-to-filter (case-insensitive substring); arrow keys move through results; hovering/arrowing previews the font on the selected text and Esc reverts the preview; Enter/click applies [KNOW] (reference article 360041308034, not read).
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
- R3.16.3 Cap height comes from the font (OS/2 `sCapHeight`); for CJK fonts the Latin cap height makes glyphs protrude slightly beyond the trimmed box [KNOW] (a third-party note on the analogous CSS `text-box-trim` reports the same effect: [SRC:https://ics.media/en/entry/250319/]).
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
- R3.19.8 Icon fonts work through ligatures (typing the icon name with LIGA on) or private-use code points [KNOW] (reference article 360040449513, not read).

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

- R3.27.1 Flatten (⌘E) / "Convert text to vector paths" converts glyphs (and decorations) into vector paths; editability is lost; fills/strokes/effects carry over [KNOW] (reference article 360047239073, not read).
- R3.27.2 SVG export outlines text by default with an option to keep `<text>` elements; PDF export keeps text selectable; raster export matches canvas rendering [KNOW] → §8.

### 3.28 Layers panel

- R3.28.1 Text layers show the text-layer icon and the auto-derived name (R3.1.9) [API autoRename; icon KNOW].
- R3.28.2 Double-clicking the layer **name** renames it (does not enter text edit) [KNOW].

### 3.29 Multi-edit

- R3.29.1 Select several text layers, then "Multi-edit text" or Return/Enter → edit them together [DOC:360039956434 excerpt]. Expected: a caret in each layer (initially all text selected in each), typing/deleting/styling applies to every layer, Esc exits [KNOW] → §8.

### 3.30 Text on a path (P2)

- R3.30.1 `TEXT_PATH` is created from a vector, shape or line; text flows along the path from `textPathStartData` (segment index + position 0–1); a blue handle sets the start; a Flip option in the Typography section moves the text to the other side of the path [API] [SRC:https://forum.figma.com/suggest-a-feature-11/make-text-follow-a-path-or-a-circle-34880]. A dedicated tool lets users drag on an empty canvas to make circular text (2026 Draw update) [SRC:https://www.createwith.com/tool/figma/updates/figma-ships-text-on-path-tool-and-auto-layout-to-draw-mode]. The base vector network cannot be modified after creation (API) [API].

### 3.31 International text, emoji

- R3.31.1 Bidirectional text (Arabic/Hebrew) is shaped and ordered by UAX #9; caret movement is visual; paragraph direction from first strong character [KNOW] (reference article 4972283635863, not read).
- R3.31.2 CJK: line breaking follows UAX #14 + kinsoku rules; IME per R3.4.6; vertical writing is not supported [KNOW] (reference article 360040449673, not read).
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
| Text style picker (apply/create/detach/edit style) | Typography section header | §3.20 | [KNOW] (reference article 360039957034, not read) |
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

## 6. Parity checklist

All items: status **Not started**. IDs are stable once published; new items are appended. Each test means: perform the same steps in Figma (reference) and Illigma, record the listed values, and compare.

### 6.1 Text tool & creation

- [ ] **TX-001** Text tool activation — `T` and the toolbar button activate the Text tool; the pointer becomes a text cursor; the tool stays active until a layer is created or another tool is chosen. _Data:_ transient tool state _Test:_ press T on empty canvas, verify tool state; press V, verify tool switches. _M3·P0·[DOC:360039956434 excerpt]_
- [ ] **TX-002** Click-create = Auto width — a click without drag creates a `TEXT` node with `textAutoResize = WIDTH_AND_HEIGHT`, empty characters, and a caret in edit mode. _Data:_ `type`, `textAutoResize`, `characters` _Test:_ click at (100,100), type "Hello", Esc; read resizing = Auto width, record x/y/w/h and compare the click point to the box's top-left (offset recorded in §8 E-CR-1). _M3·P0·[DOC:27378154668951 excerpt]_
- [ ] **TX-003** Drag-create = Fixed size — dragging a rectangle creates a text box of exactly that size with `textAutoResize = NONE`. _Data:_ `textAutoResize`, `width`, `height` _Test:_ drag 200×80, type 3 lines exceeding 80 px; box stays 200×80 and text overflows below. _M3·P0·[KNOW]_
- [ ] **TX-004** Drag-create modifiers — Shift constrains the drag to a square, Alt/Option draws from the center; a drag below the drag threshold counts as a click. _Data:_ geometry _Test:_ Shift-drag and Alt-drag; record sizes; 2 px drag yields Auto width. _M3·P2·[KNOW]_
- [ ] **TX-005** Parent on creation — text created over a frame/section becomes a child of the top-most frame/section under the pointer-down point; over an auto-layout frame it is inserted into the flow at the nearest index. _Data:_ `parent`, child index _Test:_ create text on nested frames and inside a horizontal auto layout between two children; record parent and index. _M3·P1·[KNOW]_
- [ ] **TX-006** Empty text is discarded — leaving edit mode with no characters deletes the new layer and leaves no layer-creation entry in undo history. _Data:_ node existence _Test:_ click with Text tool, press Esc; layer count unchanged; ⌘Z does not resurrect an empty layer. _M3·P0·[KNOW]_
- [ ] **TX-007** New-layer default properties — new text uses the last-used text properties of the session if any, else Inter Regular 12, Auto line height, 0% letter spacing, left/top alignment, black 100% fill. _Data:_ `fontName`, `fontSize`, `lineHeight`, `letterSpacing`, alignments, `fills` _Test:_ fresh file → create text, read all props; change to Roboto 20 on one layer, create another, read props. _M3·P1·[API][KNOW]_
- [ ] **TX-008** Tool after commit — after Esc commits a new text layer, the active tool is Move and the new layer is selected. _Data:_ tool, selection _Test:_ create text, Esc, read tool and selection. _M3·P1·[KNOW]_
- [ ] **TX-009** Text tool on existing text — with Text tool active, clicking inside an existing text layer places the caret there instead of creating a layer. _Data:_ node count, caret offset _Test:_ click mid-word in an existing layer; no new node; caret offset recorded. _M3·P1·[KNOW]_
- [ ] **TX-010** Auto-rename — while `autoRename` is true the layer name follows `characters`; renaming in the layers panel sets `autoRename = false` and later edits do not rename. _Data:_ `name`, `autoRename` _Test:_ type "Alpha" → name "Alpha"; edit to "Beta" → "Beta"; rename to "X"; edit text → name stays "X". _M3·P0·[API]_
- [ ] **TX-011** Auto-name derivation details — name derived from multi-line or very long content (newline handling, length cap, whitespace trimming). _Data:_ `name` _Test:_ type "A\nB" and a 500-char string; record exact names. _M3·P2·[KNOW]_

### 6.2 Entering & leaving edit mode

- [ ] **TX-012** Double-click enters edit — double-click on a directly selectable text layer enters edit mode with the caret at the nearest grapheme boundary to the pointer. _Data:_ edit target, caret offset _Test:_ double-click between letters 3 and 4 of "abcdef"; caret offset 3; no characters selected (§8 E-ED-1). _M3·P0·[KNOW]_
- [ ] **TX-013** Double-click inside groups — text inside a group requires the normal deep-select sequence (group → text → edit); text directly inside a frame is edited by double-click. _Data:_ selection depth _Test:_ text in group-in-frame; count double-clicks to reach edit mode. _M3·P1·[KNOW]_
- [ ] **TX-014** Enter edits selected layer — Return/Enter with one text layer selected enters edit mode with all characters selected. _Data:_ selection range _Test:_ select layer, ↩, type "Z"; characters = "Z". _M3·P0·[SRC:https://forum.figma.com/report-a-problem-6/can-t-edit-the-text-layer-while-double-clicking-the-text-layer-or-any-kind-of-text-28005][KNOW]_
- [ ] **TX-015** Esc commits — Esc leaves edit mode keeping all edits and leaves the text layer selected; a second Esc follows normal selection behavior. _Data:_ `characters`, selection _Test:_ type, Esc; text kept; layer selected; Esc again; record selection. _M3·P0·[SRC:https://forum.figma.com/suggest-a-feature-11/make-ux-of-esc-key-more-consistet-cancel-or-submit-10446]_
- [ ] **TX-016** Click outside commits — clicking outside the edited layer commits and the click is processed (selects the clicked layer or clears selection). _Data:_ selection _Test:_ edit text, click another rectangle; text committed, rectangle selected. _M3·P0·[KNOW]_
- [ ] **TX-017** Shortcut isolation in edit mode — single-letter tool shortcuts, Delete/Backspace, arrow keys and ⌘A act on text, not on layers or tools, while editing. _Data:_ tool, node list _Test:_ in edit mode type "vrfk", press Backspace and ⌘A; text changes only; tool unchanged; no layer deleted. _M3·P0·[KNOW]_
- [ ] **TX-018** Locked text — a locked text layer cannot enter edit mode from the canvas. _Data:_ `locked` _Test:_ lock layer, double-click it; no edit mode. _M3·P2·[KNOW]_
- [ ] **TX-019** Editing transformed text — edit mode, caret placement and drag-selection are correct for rotated (e.g. 37°), flipped and scaled-parent text at zoom 25%–800%. _Data:_ `relativeTransform` _Test:_ click/drag-select on rotated text; compare selected ranges with Figma. _M3·P1·[KNOW]_

### 6.3 Caret, selection & navigation

- [ ] **TX-020** Click caret placement — click inside text sets caret at nearest grapheme boundary; right of a line end → that line's end; below the last line → end; above the first → start. _Data:_ caret offset _Test:_ 3-line fixture; click 4 positions; record offsets. _M3·P0·[KNOW]_
- [ ] **TX-021** Drag and Shift-click selection — drag selects a contiguous range across lines; Shift+click extends from the anchor. _Data:_ selection start/end _Test:_ drag from line1 col2 to line3 col1; then Shift+click; record ranges. _M3·P0·[KNOW]_
- [ ] **TX-022** Double/triple click — double-click selects a word (UAX #29), triple-click selects the paragraph. _Data:_ selection _Test:_ "foo-bar baz.qux" double-click on "bar" and on "qux"; triple-click; record ranges (punctuation handling recorded). _M3·P1·[KNOW]_
- [ ] **TX-023** Grapheme-atomic movement — arrows, Backspace, Delete, and selection never split surrogate pairs, ZWJ emoji sequences, flags or combining marks. _Data:_ UTF-16 offsets _Test:_ text "a👨‍👧b🇫🇷é(e+◌́)"; step with →; offsets 0,1,6,7,11,13 … recorded and equal. _M3·P0·[API][KNOW]_
- [ ] **TX-024** Horizontal arrows with selection — ←/→ with a non-empty selection collapse to its start/end without moving further. _Data:_ caret _Test:_ select "bcd" in "abcde", press ← → caret 1; reselect, → → caret 4. _M3·P1·[KNOW]_
- [ ] **TX-025** Vertical arrows — ↑/↓ move by visual line preserving goal x; ↑ on first line → start, ↓ on last line → end. _Data:_ caret _Test:_ wrapped paragraph; record offsets after ↓↓↑. _M3·P0·[KNOW]_
- [ ] **TX-026** Word/line/document navigation — macOS ⌥←→ (word), ⌘←→ (line), ⌘↑↓ (text); Windows Ctrl+←→, Home/End, Ctrl+Home/End; Shift extends. _Data:_ caret/selection _Test:_ fixture with punctuation and wrapped lines; record offsets for each key. _M3·P0·[KNOW]_
- [ ] **TX-027** Select all in edit mode — ⌘A/Ctrl+A selects all characters of the edited layer only. _Data:_ selection _Test:_ two text layers; edit one; ⌘A; only that layer's text selected. _M3·P0·[KNOW]_
- [ ] **TX-028** Caret affinity at wraps — caret at a soft-wrap offset renders at the end of the upper line after End/⌘→ and at the start of the lower line after Home/click there. _Data:_ caret affinity _Test:_ place caret at wrap via both methods; record visual line. _M3·P2·[KNOW]_

### 6.4 Text input

- [ ] **TX-029** Typing and replacement — typed text replaces the selection and is inserted at the caret using the insertion style. _Data:_ `characters`, segments _Test:_ select "bc" (bold) in "abcd", type "X"; X is bold (style of first selected char). _M3·P0·[API][KNOW]_
- [ ] **TX-030** Paragraph break — Return inserts `\n`; the new paragraph inherits list type/level, paragraph spacing, indent and wrap style. _Data:_ `characters`, paragraph attrs _Test:_ in a level-2 bulleted item press ↩; new item level 2 bulleted. _M3·P0·[KNOW]_
- [ ] **TX-031** Soft line break — Shift+Return inserts a line break inside the paragraph (stored as U+2028): no paragraph spacing, no new list marker, same paragraph attrs. _Data:_ `characters` code point, `lineTypes` _Test:_ paragraphSpacing 20; Shift+↩; height grows by one line height only; read code point. _M3·P1·[KNOW]_
- [ ] **TX-032** Tab character — Tab inserts U+0009 in a non-list paragraph; tab advance width/stops match Figma. _Data:_ `characters` _Test:_ "a\tb" at 16 px Inter; record x of "b". _M3·P2·[KNOW]_
- [ ] **TX-033** Deletion keys — Backspace/Delete remove one grapheme cluster; ⌥⌫/Ctrl+Backspace one word; ⌘⌫ to line start. _Data:_ `characters` _Test:_ fixture with emoji and accents; record results for each key. _M3·P0·[KNOW]_
- [ ] **TX-034** IME composition — marked text shows inline at the caret, is excluded from the document and undo until commit; ↩ commits without newline; Esc cancels composition without leaving edit mode; candidate window follows the caret. _Data:_ transient composition; `characters` _Test:_ Japanese IME: type "nihon", ↩ → "日本" committed once; Esc during composition → nothing inserted, still editing; one undo step per commit. _M3·P0·[KNOW]_
- [ ] **TX-035** Dead keys, accent menu, OS emoji picker — all insert the expected characters at the caret. _Data:_ `characters` _Test:_ ⌥E then e → "é"; hold "e" → menu → "ê"; ⌃⌘Space insert "😀". _M3·P1·[KNOW]_
- [ ] **TX-036** No silent character replacement — typing `->`, `--`, `"` keeps those characters in `characters`; any arrow/dash appearance comes from font features (e.g. Inter CALT) and disappears when the feature is turned off. _Data:_ `characters`, `openTypeFeatures.CALT` _Test:_ Inter "a -> b"; read characters; set CALT off; glyph changes to hyphen+greater-than. _M3·P1·[API]_
- [ ] **TX-037** Live box growth while typing — Auto width grows horizontally per anchoring rules, Auto height grows vertically, Fixed does not change size. _Data:_ `width`, `height` _Test:_ type 3 lines in each mode; record sizes after each line. _M3·P0·[DOC:27378154668951 excerpt]_

### 6.5 Range application & mixed values

- [ ] **TX-038** Layer-level application — with text layer(s) selected (not editing) a character property change applies to all characters of every selected text layer. _Data:_ segments _Test:_ two layers with mixed sizes; set size 18; every segment = 18. _M3·P0·[KNOW]_
- [ ] **TX-039** Range application — in edit mode with a selection, character-level changes apply only to the selected range. _Data:_ `getStyledTextSegments` _Test:_ select chars 2–5, set red fill and 700 weight; segments split exactly at 2 and 5. _M3·P0·[API]_
- [ ] **TX-040** Paragraph expansion — paragraph-level properties set on a partial range apply to every paragraph intersecting the range and to no other. _Data:_ `paragraphSpacing`, `paragraphIndent`, `listSpacing`, `textWrapStyle`, `listOptions` _Test:_ 3 paragraphs; select last char of P1 + first of P2; set paragraph spacing 20; P1,P2 = 20, P3 = 0. _M3·P0·[API]_
- [ ] **TX-041** Node-level properties ignore range — alignment, resizing, truncation, max lines, hanging punctuation/list and vertical trim always apply to the whole layer even with a partial selection. _Data:_ node props _Test:_ select one word, click Center; whole layer centered. _M3·P0·[API]_
- [ ] **TX-042** Mixed display and override — inspector shows "Mixed" when values differ across the selected layers/range; entering a value applies it uniformly. _Data:_ `figma.mixed` _Test:_ range with 12/16 px → field "Mixed"; type 14 → all 14. _M3·P0·[API]_
- [ ] **TX-043** Insertion style inheritance — inserted characters take the preceding character's style; at index 0 the following character's style. _Data:_ segments _Test:_ "**ab**cd": caret after b, type x → bold; caret at 0, type y → bold. _M3·P0·[API]_
- [ ] **TX-044** Pending style at a collapsed caret — changing a property with a collapsed caret affects only the next typed characters; moving the caret without typing discards it; no document change is recorded. _Data:_ transient insertion style _Test:_ caret mid-word, set red, type "x" → only x red; repeat but move caret first → nothing red; undo history unchanged by the property click (record). _M3·P1·[KNOW]_
- [ ] **TX-045** Multi-layer mixed fonts — selecting layers with different families shows Mixed family; choosing a family applies it to all while keeping each layer's style where available. _Data:_ `fontName` _Test:_ Inter Bold + Roboto Light → choose "Open Sans" → Open Sans Bold / Open Sans Light. _M3·P1·[KNOW]_

### 6.6 Resizing modes & handles

- [ ] **TX-046** Auto width semantics — width = widest line, height = content height, no soft wrapping; only Return creates lines. _Data:_ `textAutoResize=WIDTH_AND_HEIGHT` _Test:_ type 300 chars without Return; 1 line; width = advance width. _M3·P0·[API][DOC:27378154668951 excerpt]_
- [ ] **TX-047** Auto height semantics — fixed width, text wraps, height = content height. _Data:_ `HEIGHT` _Test:_ width 120; paste paragraph; height = lines × line height; record line breaks. _M3·P0·[API][DOC:27378154668951 excerpt]_
- [ ] **TX-048** Fixed size semantics — both dimensions fixed; wraps horizontally; vertical overflow is drawn outside the box (not clipped) and is excluded from the box bounds. _Data:_ `NONE` _Test:_ 120×40 box with 6 lines; overflow visible; layer H stays 40; render bounds recorded. _M3·P0·[API][DOC:27378154668951 excerpt]_
- [ ] **TX-049** Resizing control — Layout section control switches Auto width / Auto height / Fixed size and recomputes size immediately. _Data:_ `textAutoResize` _Test:_ wrapped Auto height → Auto width: lines merge; → Fixed: size unchanged. _M3·P0·[DOC:27378154668951 excerpt]_
- [ ] **TX-050** Height drag → Fixed size — dragging a top/bottom edge or a corner handle (or typing H) sets Fixed size. _Data:_ `textAutoResize` _Test:_ Auto height text; drag bottom edge +30; mode = Fixed size. _M3·P0·[DOC:27378154668951 excerpt]_
- [ ] **TX-051** Width-only drag keeps auto height — dragging a left/right edge (or typing W) on Auto width or Auto height text yields Auto height and reflows. _Data:_ `textAutoResize` _Test:_ Auto width text; drag right edge −50; record mode (expected Auto height) and height. _M3·P0·[KNOW]_
- [ ] **TX-052** Double-click edge handles — double-click on a left/right edge handle sets Auto width; on a top/bottom edge sets Auto height. _Data:_ `textAutoResize` _Test:_ Fixed box; double-click right edge; record; double-click bottom; record. _M3·P1·[KNOW]_
- [ ] **TX-053** Resize never changes font size — any handle/W/H resize of a text box (including Shift for aspect, Alt for center) reflows only. _Data:_ `fontSize` _Test:_ corner-drag ×2; font size unchanged. _M3·P0·[DOC:27378154668951 excerpt][DOC:360040451453 excerpt]_
- [ ] **TX-054** Auto width growth anchoring — LEFT grows right, CENTER grows equally both sides (x shifts by −Δw/2), RIGHT grows left. _Data:_ `x`, `width`, `textAlignHorizontal` _Test:_ for each alignment type 5 more chars; record x and width deltas. _M3·P1·[KNOW]_
- [ ] **TX-055** Auto height growth anchoring — Auto height grows downward with the top fixed, independent of vertical alignment and constraints. _Data:_ `y`, `height` _Test:_ bottom-aligned, bottom-constrained Auto height text; add a line; record y. _M3·P1·[KNOW]_
- [ ] **TX-056** Rotated auto-resize — growth happens along the layer's local axes for rotated text. _Data:_ `relativeTransform` _Test:_ 45° Auto width text; type; record transform/size. _M3·P2·[KNOW]_
- [ ] **TX-057** Aspect lock unavailable for auto-resizing text — aspect-ratio lock can be set only when `textAutoResize = NONE`. _Data:_ `targetAspectRatio` _Test:_ try to lock ratio on Auto width text; record UI state. _M3·P2·[API]_
- [ ] **TX-058** Minimum size — box width/height cannot go below 0.01; negative drags flip per M1 rules. _Data:_ `width`, `height` _Test:_ drag edge past opposite edge; record. _M3·P2·[API]_
- [ ] **TX-059** Legacy TRUNCATE mapping — imported `textAutoResize = TRUNCATE` becomes Fixed size + Truncate on. _Data:_ `textAutoResize`, `textTruncation` _Test:_ import REST JSON fixture; read props. _M8·P1·[API]_

### 6.7 Truncation & max lines

- [ ] **TX-060** Truncate toggle — Type settings toggle sets `textTruncation` ENDING/DISABLED; Max lines is editable only while it is on. _Data:_ `textTruncation`, `maxLines` _Test:_ toggle; check field enablement. _M3·P0·[API][SRC:https://bringyourownlaptop.com/blog/truncate-text-responsive-ui-figma]_
- [ ] **TX-061** Fixed-size truncation — with Fixed size and Truncate on, only lines that fit the box height are drawn and the last drawn line ends with "…" (U+2026). _Data:_ `NONE`, `ENDING` _Test:_ 120×40 box, 16 px/Auto LH, long paragraph; record visible lines and last-line text. _M3·P0·[API]_
- [ ] **TX-062** Max lines with Auto height — `maxLines = N` limits visible lines to N; box height = height of N lines; more text does not grow the box. _Data:_ `maxLines`, `height` _Test:_ N = 2, 5-line paragraph; height = 2 lines. _M3·P0·[API][SRC:https://app.uxcel.com/lessons/working-with-texts-in-figma-889/text-truncation-and-max-lines-3569]_
- [ ] **TX-063** Max lines validation — values < 1 are rejected/clamped to 1, non-integers rounded (rule recorded), empty field = no limit (`null`). _Data:_ `maxLines` _Test:_ type 0, 2.6, "" ; record stored values. _M3·P1·[API][KNOW]_
- [ ] **TX-064** Auto width + truncation — with Auto width, truncation only takes effect via `maxLines`/`maxHeight` (e.g. a max width on a hug text with Max lines 1 gives a single ellipsized line). _Data:_ `WIDTH_AND_HEIGHT`, `maxWidth`, `maxLines` _Test:_ Auto width, max W 100, max lines 1; record. _M3·P1·[API][KNOW]_
- [ ] **TX-065** Max height truncation — Auto height + Truncate + `maxHeight` truncates at the last line fitting maxHeight. _Data:_ `maxHeight` _Test:_ maxHeight 50 with 16/24 lines; 2 lines visible. _M4·P1·[API]_
- [ ] **TX-066** Truncation unit — ellipsis replaces whole trailing words; a single word longer than the line is cut at grapheme level; trailing spaces before "…" removed. _Data:_ render only _Test:_ fixtures "aaaa bbbb cccc" and "Supercalifragilistic"; record last visible text. _M3·P0·[SRC:https://forum.figma.com/t/rules-of-text-truncate/22408][KNOW]_
- [ ] **TX-067** Ellipsis style — "…" uses the style (font, size, fill) of the last visible character. _Data:_ render _Test:_ last visible word red bold; ellipsis red bold. _M3·P1·[KNOW]_
- [ ] **TX-068** Truncation is render-only — `characters` unchanged; copy copies full text; edit mode shows full text; leaving edit mode re-truncates. _Data:_ `characters` _Test:_ truncated layer: copy, paste elsewhere = full text; enter edit mode, record whether full text shows. _M3·P0·[KNOW]_
- [ ] **TX-069** Truncation with alignment — ellipsized line obeys center/right/justified alignment (justified ellipsis line is start-aligned). _Data:_ `textAlignHorizontal` _Test:_ each alignment; record ellipsis-line x. _M3·P2·[KNOW]_
- [ ] **TX-070** Truncation in hug parents — a parent with hug height uses the truncated text height. _Data:_ parent `height` _Test:_ vertical AL hug containing Max lines 2 text; parent height = padding + 2 lines. _M4·P1·[KNOW][SRC:https://forum.figma.com/ask-the-community-7/truncate-text-not-changeable-when-turned-into-style-3300]_

### 6.8 Alignment

- [ ] **TX-071** Horizontal alignment — LEFT/CENTER/RIGHT position each line within the available width of its paragraph (after list/indent insets). _Data:_ `textAlignHorizontal` _Test:_ 3 lines of different length in a 200 px box; record line x positions per mode. _M3·P0·[API]_
- [ ] **TX-072** Justified — extra space distributed over inter-word spaces; last line of each paragraph, lines ending in a forced break, and single-word lines are start-aligned. _Data:_ `JUSTIFIED` _Test:_ 2 paragraphs incl. Shift+↩ line; record word x positions. _M3·P1·[KNOW]_
- [ ] **TX-073** Vertical alignment — TOP/CENTER/BOTTOM place the content block inside a Fixed box; no visible effect for Auto height/Auto width. _Data:_ `textAlignVertical` _Test:_ 200×200 box, 2 lines; record first baseline y per mode. _M3·P0·[API]_
- [ ] **TX-074** Vertical alignment with overflow — content taller than a Fixed box overflows downward (TOP), both ways (CENTER), upward (BOTTOM). _Data:_ `textAlignVertical` _Test:_ 100×40 box, 5 lines; record render bounds per mode. _M3·P1·[KNOW]_
- [ ] **TX-075** Alignment shortcuts — align left/center/right/justified via keyboard (keys per §5, to be confirmed) in both layer and edit mode. _Data:_ `textAlignHorizontal` _Test:_ press each shortcut; read value. _M3·P1·[SRC:https://linuru.com/figma/][SRC:https://www.raycast.com/arturdz/figma-shortcuts]_

### 6.9 Font family, style & weight

- [ ] **TX-076** Font family picker — lists every available family; type-to-filter (case-insensitive substring); keyboard navigation; Enter/click applies. _Data:_ `fontName.family` _Test:_ type "rob" → Roboto*, arrows + ↩ applies. _M3·P0·[KNOW]_
- [ ] **TX-077** Font preview on hover/arrow — hovering or arrowing through families previews them on the selection without creating undo steps; Esc restores the original. _Data:_ transient preview _Test:_ arrow through 5 fonts, Esc; `fontName` unchanged; undo stack unchanged. _M3·P1·[KNOW]_
- [ ] **TX-078** Family change keeps style — switching family keeps the style name if present; else nearest weight with same italic-ness, else Regular. _Data:_ `fontName.style` _Test:_ Inter "Semi Bold Italic" → family without SemiBold; record chosen style. _M3·P0·[KNOW]_
- [ ] **TX-079** Style dropdown — lists all named styles of the family (variable fonts: named instances + axes entry); choosing one sets `fontName.style`. _Data:_ `fontName` _Test:_ Inter: list count and order recorded. _M3·P0·[SRC:https://forum.figma.com/ask-the-community-7/how-do-i-disable-variable-font-axes-option-in-font-style-dropdown-15610]_
- [ ] **TX-080** Derived weight — `fontWeight` is read-only and derived from the chosen style (400 Regular, 700 Bold, …). _Data:_ `fontWeight` _Test:_ set styles Thin…Black; read weights. _M3·P1·[API]_
- [ ] **TX-081** Bold toggle ⌘B — toggles to the family's bold (700 or next heavier) and back, preserving italic; no-op when no heavier style exists. _Data:_ `fontName` _Test:_ Inter Italic → ⌘B → Bold Italic → ⌘B → Italic; family with only Regular → unchanged. _M3·P0·[SRC:https://www.raycast.com/arturdz/figma-shortcuts][KNOW]_
- [ ] **TX-082** Italic toggle ⌘I — toggles italic counterpart preserving weight; no-op without italic. _Data:_ `fontName` _Test:_ Inter Bold ⌘I → Bold Italic; repeat. _M3·P0·[SRC:https://www.raycast.com/arturdz/figma-shortcuts][KNOW]_
- [ ] **TX-083** Weight step shortcuts — ⌥⌘> / ⌥⌘< move to next heavier/lighter named style, preserving italic, clamped at ends. _Data:_ `fontName` _Test:_ from Regular press 3×; record styles. _M3·P1·[SRC:https://linuru.com/figma/]_
- [ ] **TX-084** Mixed fonts in range — a range spanning several fonts shows Mixed family/style; `getRangeAllFontNames` lists each. _Data:_ `fontName` _Test:_ select across two fonts; read UI and API. _M3·P1·[API]_
- [ ] **TX-085** Recent fonts — the font picker surfaces recently used families. _Data:_ app prefs _Test:_ apply 3 fonts; open picker; record recent list. _M3·P2·[KNOW]_

### 6.10 Font size

- [ ] **TX-086** Font size limits — minimum 1 (smaller input clamps to 1), fractional sizes kept (precision recorded), maximum per Figma (§8). _Data:_ `fontSize` _Test:_ enter 0.5, 13.37, 5000; record stored values. _M3·P0·[API][KNOW]_
- [ ] **TX-087** Font size shortcuts — ⌘⇧> / ⌘⇧< increase/decrease size by Figma's step (recorded) on the selection or range. _Data:_ `fontSize` _Test:_ from 16 press each 3×; record values. _M3·P1·[SRC:https://www.raycast.com/arturdz/figma-shortcuts]_
- [ ] **TX-088** Size change and dependent units — changing size keeps px line height/letter spacing; Auto and % values scale with the new size. _Data:_ `lineHeight`, `letterSpacing` _Test:_ 16 px with LH 24 px vs LH 150%; change to 32; record line heights. _M3·P0·[API]_
- [ ] **TX-089** Font size presets — the size combobox offers Figma's preset sizes. _Data:_ UI _Test:_ open dropdown; record list. _M3·P2·[KNOW]_

### 6.11 Line height & baseline model

- [ ] **TX-090** Line height units — Auto, px, % where % is relative to font size. _Data:_ `lineHeight {AUTO|PIXELS|PERCENT}` _Test:_ 20 px font: 150% → line box 30; 24 px → 24. _M3·P0·[API]_
- [ ] **TX-091** Auto line height value — Auto uses the font's built-in metrics; single-line Auto text height equals Figma's value for Inter, Roboto, Georgia, Noto Sans JP, and a font with USE_TYPO_METRICS set. _Data:_ `height` _Test:_ 100 px single line per font; record heights to 0.01 px. _M3·P0·[KNOW]_
- [ ] **TX-092** Half-leading distribution — extra line height is split equally above and below the glyphs; the first baseline = top + (LH − (ascent+descent))/2 + ascent. _Data:_ derived baseline _Test:_ Inter 20 px with LH 40 px; record first baseline y relative to box top. _M3·P0·[SRC:https://www.figma.com/blog/line-height-changes/][KNOW]_
- [ ] **TX-093** Line height input parsing — "Auto" (case-insensitive) sets AUTO; "150%" sets %; "24" and "24px" set px (bare-number unit rule recorded). _Data:_ `lineHeight` _Test:_ type each; read unit/value; also bare number while current unit is %. _M3·P1·[KNOW]_
- [ ] **TX-094** Mixed line heights on one line — a line containing runs with different line heights resolves to Figma's rule (expected: max). _Data:_ per-range `lineHeight` _Test:_ one line with 16 px/LH 20 and 32 px/LH 40 runs; record line box height. _M3·P1·[KNOW]_
- [ ] **TX-095** Tight line height — LH below glyph extent is allowed; box height = Σ line heights; glyphs overflow; no clamping. _Data:_ `height` _Test:_ 40 px font LH 10 px, 3 lines → height 30. _M3·P1·[KNOW]_
- [ ] **TX-096** Empty lines — empty paragraphs and a trailing newline produce lines using the style at that position. _Data:_ `height` _Test:_ "a\n\n" at 20 px; record height = 3 lines. _M3·P0·[KNOW]_
- [ ] **TX-097** Legacy intrinsic % — imported `lineHeightUnit = INTRINSIC_%` is converted so that rendering matches the source exactly. _Data:_ REST `lineHeightUnit`, `lineHeightPercent`, `lineHeightPx` _Test:_ REST fixture with INTRINSIC_% 120; compare line boxes to `lineHeightPx`. _M8·P1·[API]_
- [ ] **TX-098** Line height shortcuts — ⌥⇧> / ⌥⇧< change line height by Figma's step and unit behavior (reported to jump to px). _Data:_ `lineHeight` _Test:_ from 150% press each; record values/units. _M3·P2·[SRC:https://forum.figma.com/suggest-a-feature-11/fix-line-height-shortcut-behavior-23443]_

### 6.12 Letter spacing

- [ ] **TX-099** Letter spacing units — % (of font size) or px; default 0%; negative allowed; range limits per Figma (§8). _Data:_ `letterSpacing` _Test:_ 20 px Inter "AAAA": 10% → +2 px per char; −5 px; record advances. _M3·P0·[API][KNOW]_
- [ ] **TX-100** Letter spacing placement — space added after each grapheme cluster; behavior at line end/last character (affects auto width and centering) matches Figma. _Data:_ `width` _Test:_ Auto width "AB" with 10 px spacing; record width vs 0 px spacing. _M3·P0·[KNOW]_
- [ ] **TX-101** Letter spacing input & shortcuts — typed values keep the current unit unless a unit is typed; ⌥> / ⌥< step by Figma's increment. _Data:_ `letterSpacing` _Test:_ current 0%, type "2" → 2%; type "2px" → px; shortcuts 3×; record. _M3·P1·[SRC:https://www.raycast.com/arturdz/figma-shortcuts][KNOW]_
- [ ] **TX-102** Letter spacing vs ligatures — whether non-zero letter spacing suppresses optional ligatures matches Figma. _Data:_ render _Test:_ "ffi" in a ligature font with 5% spacing; record glyphs. _M3·P2·[KNOW]_

### 6.13 Paragraph spacing & indent

- [ ] **TX-103** Paragraph spacing — px added between paragraphs (not after the last, not at Shift+↩ breaks); included in Auto height. _Data:_ `paragraphSpacing` _Test:_ 3 paragraphs LH 20, spacing 10 → height 80 (single-line paragraphs). _M3·P0·[API][KNOW]_
- [ ] **TX-104** Paragraph spacing limits — negative values rejected/clamped (rule recorded); fractional allowed. _Data:_ `paragraphSpacing` _Test:_ type −5, 2.5; record. _M3·P2·[KNOW]_
- [ ] **TX-105** Paragraph indent — offsets the first line of every paragraph (including the first) by N px; negative values not accepted. _Data:_ `paragraphIndent` _Test:_ indent 24; record first-line x of each paragraph; type −10 → rejected. _M3·P0·[API][SRC:https://forum.figma.com/suggest-a-feature-11/allow-all-kinds-of-hanging-indents-13126]_
- [ ] **TX-106** Paragraph-level storage — paragraph spacing/indent can differ per paragraph within one layer and show Mixed. _Data:_ `getRangeParagraphSpacing` _Test:_ set P2 only; layer field shows Mixed. _M3·P1·[API]_
- [ ] **TX-107** Paragraph vs list spacing interplay — between consecutive list items list spacing applies; between a list and a normal paragraph paragraph spacing applies (rule recorded). _Data:_ `listSpacing`, `paragraphSpacing` _Test:_ list of 3 + paragraph; listSpacing 8, paragraphSpacing 20; record gaps. _M3·P1·[KNOW]_

### 6.14 Decoration

- [ ] **TX-108** Underline/strikethrough exclusivity — one `textDecoration` value per range; applying one replaces the other. _Data:_ `textDecoration` _Test:_ underline a word then ⌘⇧X; value = STRIKETHROUGH only. _M3·P0·[API]_
- [ ] **TX-109** Decoration shortcuts — ⌘U toggles underline, ⌘⇧X toggles strikethrough on selection/range. _Data:_ `textDecoration` _Test:_ press twice each; NONE at end. _M3·P0·[SRC:https://www.raycast.com/arturdz/figma-shortcuts]_
- [ ] **TX-110** Underline style — Solid / Wavy / Dotted. _Data:_ `textDecorationStyle` _Test:_ each style at 24 px; compare rendering. _M3·P1·[API][SRC:https://alternativeto.net/news/2024/11/figma-adds-customization-options-for-underlines]_
- [ ] **TX-111** Underline thickness & offset — Auto, px, or % of font size; Auto uses font metrics (post table). _Data:_ `textDecorationThickness`, `textDecorationOffset` _Test:_ 40 px Inter: Auto vs 3 px vs 10%; record line y/thickness. _M3·P1·[API]_
- [ ] **TX-112** Underline color — Auto follows the text fill; or an explicit solid color (incl. opacity). _Data:_ `textDecorationColor` _Test:_ gradient-filled text with Auto vs red; record rendering. _M3·P1·[API]_
- [ ] **TX-113** Skip ink — on: underline breaks around descenders; off: continuous. _Data:_ `textDecorationSkipInk` _Test:_ "gyp" with each; compare. _M3·P1·[API][SRC:https://forum.figma.com/suggest-a-feature-11/dotted-dashed-etc-underlines-text-decoration-style-support-36309]_
- [ ] **TX-114** Strikethrough has no options — styling controls are unavailable for strikethrough and sub-properties read null. _Data:_ decoration sub-props _Test:_ set strikethrough; read API values; check UI. _M3·P1·[API]_
- [ ] **TX-115** Decoration geometry — continuous across spaces inside the range, broken at line wraps, drawn per run with that run's size. _Data:_ render _Test:_ underline spanning wrap and mixed sizes; compare. _M3·P1·[KNOW]_

### 6.15 Case

- [ ] **TX-116** Case options — As typed, UPPER, lower, Title, Small caps, Forced small caps; render-only. _Data:_ `textCase` _Test:_ "hello World" in each; `characters` unchanged. _M3·P0·[API]_
- [ ] **TX-117** Title case rule — first letter of each word uppercased; other letters left as typed; word boundaries per Figma (hyphen/apostrophe behavior recorded). _Data:_ `TITLE` _Test:_ "o'neil well-known iPhone"; record output. _M3·P1·[KNOW]_
- [ ] **TX-118** Small caps — SMALL_CAPS uses the font's `smcp` (lowercase→small caps); SMALL_CAPS_FORCED also converts capitals (`c2sc`); behavior for fonts lacking these features recorded. _Data:_ `textCase` _Test:_ font with smcp and one without; record rendering/availability. _M3·P1·[API][KNOW]_
- [ ] **TX-119** Case and clipboard — copying UPPER-cased text copies the raw characters. _Data:_ `characters` _Test:_ copy, paste into a plain text editor; compare. _M3·P2·[API][KNOW]_

### 6.16 Lists

- [ ] **TX-120** Bullet auto-detect — at paragraph start, "-" or "*" + Space converts the paragraph to a bulleted item and removes the marker characters. _Data:_ `listOptions=UNORDERED`, `characters` _Test:_ type "- a"; characters = "a"; list = UNORDERED. _M3·P0·[DOC:360040449773 excerpt]_
- [ ] **TX-121** Number auto-detect — "1." or "1)" + Space converts to a numbered item. _Data:_ `ORDERED` _Test:_ type "1) a"; numbered; also "2. " (record whether non-1 starts trigger). _M3·P0·[DOC:360040449773 excerpt]_
- [ ] **TX-122** Undo auto-list — ⌘Z right after auto-detection removes list formatting and restores the literal marker + space. _Data:_ `characters`, `listOptions` _Test:_ "- " then ⌘Z → characters "- ", list NONE. _M3·P0·[DOC:360040449773 excerpt]_
- [ ] **TX-123** List shortcuts — ⌘⇧8 / ⌘⇧7 toggle bulleted/numbered on paragraphs in the range, or on all paragraphs of every selected text layer. _Data:_ `listOptions` _Test:_ select 2 layers, ⌘⇧7 → all paragraphs ORDERED; again → NONE (record). _M3·P0·[DOC:360040449773 excerpt]_
- [ ] **TX-124** Indent levels — Tab (in a list item) and ⌘] increase, ⌘[ decreases; max 5 levels; min level 1 for list items. _Data:_ `indentation` _Test:_ press Tab 6×; level = 5; ⌘[ 5× → 1. _M3·P0·[DOC:360040449773 excerpt]_
- [ ] **TX-125** Shift+Tab in lists — Shift+Tab decreases the level (expected). _Data:_ `indentation` _Test:_ level 3, Shift+Tab; record. _M3·P1·[KNOW]_
- [ ] **TX-126** Backspace at item start — deletes the marker but keeps the indentation level (paragraph no longer a list item). _Data:_ `listOptions`, `indentation` _Test:_ level-2 item, caret at 0, ⌫; record list type and indent. _M3·P0·[DOC:360040449773 excerpt]_
- [ ] **TX-127** Return on empty item — decreases indentation; at the outermost level ends the list. _Data:_ `indentation`, `listOptions` _Test:_ level 2 empty item ↩ → level 1; ↩ again → NONE. _M3·P0·[DOC:360040449773 excerpt][KNOW]_
- [ ] **TX-128** Return continues list — Return at the end of a non-empty item creates a new item with same type/level. _Data:_ `listOptions` _Test:_ type "a↩b"; both items. _M3·P0·[KNOW]_
- [ ] **TX-129** Numbering per level — counters increment within contiguous same-level items, restart at 1 under each parent item, and continue after a nested sub-list. _Data:_ generated markers _Test:_ 1, 1.a, 1.b, 2 structure; record markers. _M3·P0·[DOC:360040449773 excerpt][KNOW]_
- [ ] **TX-130** Number format per level — format rotates numbers → letters → roman numerals with each level (exact sequence and punctuation recorded for levels 1–5). _Data:_ markers _Test:_ 5-level numbered list; record markers. _M3·P1·[DOC:360040449773 excerpt]_
- [ ] **TX-131** Bullet glyph per level — bullet glyphs per level match Figma (recorded for levels 1–5). _Data:_ markers _Test:_ 5-level bulleted list. _M3·P1·[KNOW]_
- [ ] **TX-132** Marker styling — marker uses the font, size and fill of the item's first character. _Data:_ render _Test:_ first char red 24 px; marker red 24 px. _M3·P1·[KNOW]_
- [ ] **TX-133** List indentation geometry — marker position and text start for each level match Figma (indent step formula recorded). _Data:_ derived _Test:_ levels 1–3 at 16 px and 32 px; record marker x/text x. _M3·P0·[KNOW]_
- [ ] **TX-134** List spacing — px gap between list items (default 0 for new lists and existing styles). _Data:_ `listSpacing` _Test:_ 3 items listSpacing 12; record height delta. _M3·P0·[DOC:360040449773 excerpt][API]_
- [ ] **TX-135** Two-digit numbers — items ≥10 shift text start vs items 1–9 (Figma limitation reproduced). _Data:_ derived _Test:_ 12-item list; record text x of item 9 vs 10. _M3·P2·[SRC:https://forum.figma.com/t/is-there-a-way-to-make-a-numbered-list-without-a-hanging-indent/56402.rss]_
- [ ] **TX-136** Wrapped list items — continuation lines align with the item text, not the marker. _Data:_ derived _Test:_ long item in 150 px box; record x of line 2. _M3·P0·[KNOW]_
- [ ] **TX-137** Indent on non-list paragraphs — whether ⌘] indents a plain paragraph (and how it is stored) matches Figma. _Data:_ `indentation` _Test:_ plain paragraph ⌘]; record. _M3·P2·[KNOW]_
- [ ] **TX-138** List copy/paste — copying list items within Illigma preserves list type/level/spacing; plain-text export uses markers per Figma (recorded). _Data:_ `listOptions`, clipboard text _Test:_ copy 3 items into another layer and into a plain-text editor. _M3·P1·[KNOW]_

### 6.17 Hanging punctuation & hanging list

- [ ] **TX-139** Hanging quotes — when on, opening quotation marks at a line start hang outside the left box edge so letters align to the edge; other punctuation (e.g. asterisks) does not hang. _Data:_ `hangingPunctuation` _Test:_ lines starting with “ " ‘ « * ; record glyph x. _M3·P1·[API][SRC:https://forum.figma.com/suggest-a-feature-11/include-asterisks-when-hanging-punctuation-19920]_
- [ ] **TX-140** Hanging list — when on, markers sit outside the left box edge; item text aligns with the edge. _Data:_ `hangingList` _Test:_ bulleted list on/off; record marker and text x. _M3·P1·[API][DOC:360040449773 excerpt]_
- [ ] **TX-141** Hanging bounds — hung glyphs extend render bounds but not the layer box, Auto width size, or auto-layout measurement. _Data:_ `width`, render bounds _Test:_ Auto width with hanging quote; compare width with/without. _M3·P2·[KNOW]_

### 6.18 Vertical trim

- [ ] **TX-142** Cap height to baseline — `CAP_HEIGHT` removes space above the first line's cap height and below the last line's baseline; inner leading unchanged. _Data:_ `leadingTrim` _Test:_ Inter 40 px, 2 lines, LH 60; Auto height box height = LH + capHeight (record exact). _M3·P1·[API][SRC:https://bejamas.com/blog/everything-you-need-to-know-about-figma-s-vertical-trim-feature]_
- [ ] **TX-143** Trim toggling keeps glyphs in place — switching trim on/off adjusts box y/height so glyphs do not move on canvas (or record Figma's actual behavior). _Data:_ `y`, `height` _Test:_ toggle; record glyph baseline in absolute coords. _M3·P1·[KNOW]_
- [ ] **TX-144** Trim with Fixed size & vertical alignment — vertical alignment positions the trimmed block. _Data:_ `leadingTrim`, `textAlignVertical` _Test:_ 200 px box, center; record baseline. _M3·P2·[KNOW]_
- [ ] **TX-145** Trim in auto layout — trimmed text makes hug containers exactly padding + cap-to-baseline height (button use case). _Data:_ parent size _Test:_ button AL padding 12/12 with trimmed 16 px label; record height. _M4·P1·[SRC:https://bejamas.com/blog/everything-you-need-to-know-about-figma-s-vertical-trim-feature]_

### 6.19 Text wrap style

- [ ] **TX-146** Balance — makes line lengths roughly equal without changing the line count; applies only to paragraphs of ≤ 6 wrapped lines. _Data:_ `textWrapStyle=BALANCE` _Test:_ 3-line and 8-line paragraphs; record breaks vs AUTO. _M3·P1·[API][SRC:https://developers.figma.com/docs/plugins/api/TextWrapStyle/]_
- [ ] **TX-147** Pretty — avoids a single word alone on the last line of a paragraph. _Data:_ `PRETTY` _Test:_ paragraph with an orphan under AUTO; record breaks. _M3·P1·[API][SRC:https://forum.figma.com/product-updates-3/get-responsive-text-across-screens-with-new-text-wrap-styles-56992]_
- [ ] **TX-148** Wrap style scope — settable per paragraph, per layer and in a text style; no effect on Auto width text. _Data:_ `textWrapStyle` _Test:_ set on P2 only → layer shows Mixed; Auto width unchanged. _M3·P1·[API][SRC:https://forum.figma.com/product-updates-3/get-responsive-text-across-screens-with-new-text-wrap-styles-56992]_

### 6.20 OpenType features

- [ ] **TX-149** Feature storage — only features differing from the font default are stored; default-on LIGA/CLIG, default-off LNUM/TNUM per API. _Data:_ `openTypeFeatures` _Test:_ toggle LIGA off → `{LIGA:false}`; toggle back → `{}`. _M3·P0·[API]_
- [ ] **TX-150** Details tab availability — only features supported by the current font are enabled; unsupported ones greyed out; hovering previews. _Data:_ font GSUB/GPOS _Test:_ Inter vs Arial; record enabled lists. _M3·P1·[DOC:4913951097367 excerpt]_
- [ ] **TX-151** Letterforms — ligatures, rare/discretionary ligatures, contextual alternates, ordinals. _Data:_ `LIGA`, `CLIG`, `DLIG`, `CALT`, `ORDN` _Test:_ fixture font; compare glyph ids per toggle. _M3·P1·[DOC:4913951097367 excerpt][API]_
- [ ] **TX-152** Stylistic sets — SS01–SS20 with names read from the font's `name` table. _Data:_ `SS01…SS20` _Test:_ Inter: record labels and glyph changes. _M3·P1·[DOC:4913951097367 excerpt][API]_
- [ ] **TX-153** Character variants — CV01–CV99 as offered by the font. _Data:_ `CV01…CV99` _Test:_ Inter cv01 etc.; compare glyphs. _M3·P2·[DOC:4913951097367 excerpt][API]_
- [ ] **TX-154** Kerning toggle — KERN on by default; turning it off removes pair kerning. _Data:_ `KERN` _Test:_ "AVAT" advance widths on/off. _M3·P1·[DOC:4913951097367 excerpt][API]_
- [ ] **TX-155** Number options — figure style (lining/oldstyle), spacing (proportional/tabular), fractions, slashed zero, super/subscript-type positions — UI and storage as in Figma (not in `OpenTypeFeature` enum except ZERO/NUMR/DNOM/SINF). _Data:_ `ZERO`, `NUMR`, `DNOM`, `SINF` + unexposed numeric fields _Test:_ "0123 1/2" each option; compare glyphs; record representation. _M3·P1·[API][KNOW]_
- [ ] **TX-156** Case-related features — case-sensitive forms (CASE), capital spacing (CPSP), petite caps (PCAP/C2PC), titling (TITL), unicase (UNIC). _Data:_ tags _Test:_ font supporting them; compare. _M3·P2·[API]_
- [ ] **TX-157** Per-range features — features can differ per range; mixed state shown. _Data:_ `getRangeOpenTypeFeatures` _Test:_ SS01 on one word; read mixed for layer. _M3·P1·[API]_

### 6.21 Variable fonts

- [ ] **TX-158** Variable controls visibility — the variable-axes controls appear only for variable fonts. _Data:_ `getFontFamilyVariationAxes` _Test:_ Inter (variable) vs Arial (static). _M3·P1·[SRC:https://www.thomasphinney.com/tag/variable-fonts/][API]_
- [ ] **TX-159** Axis controls — one slider + input per axis (standard and custom), bounded by the font's min/max; ital is binary. _Data:_ `fontName.variationSettings` _Test:_ wght 357, wdth 87, opsz 32; out-of-range inputs clamp (record). _M3·P1·[DOC:5579502031511 excerpt][SRC:https://www.figma.com/typography/variable-fonts/]_
- [ ] **TX-160** Variation storage — reads list every axis; setting a subset keeps the named instance's other axis values; unknown axis rejected. _Data:_ `variationSettings` _Test:_ set {wght:650} on Regular; read all axes. _M3·P1·[API]_
- [ ] **TX-161** Style label for custom values — non-instance axis values show a numeric readout (e.g. "Weight: 357") in the style field; picking a named style resets axes. _Data:_ `fontName.style` _Test:_ set wght 357; read label; choose Bold; read axes. _M3·P1·[SRC:https://forum.figma.com/ask-the-community-7/how-do-i-disable-variable-font-axes-option-in-font-style-dropdown-15610][KNOW]_
- [ ] **TX-162** Nearest-instance resolution — a font set without style resolves to the nearest named instance (wght 900 → "Black"). _Data:_ `FontNameInput` _Test:_ import/API fixture; read style. _M3·P2·[API]_
- [ ] **TX-163** Per-range axes — axis values can differ per range and show Mixed. _Data:_ `getRangeFontName` _Test:_ two words different wght; layer field Mixed. _M3·P2·[API]_

### 6.22 Links

- [ ] **TX-164** Create URL link — select range, ⌘⇧U, type URL, ↩ → range gets `{type:'URL'}` link. _Data:_ `hyperlink` _Test:_ link "Figma" to https://example.com; read API. _M3·P0·[SRC:https://forum.figma.com/ask-the-community-7/ui3-feedback-create-link-shortcuts-cmd-ctrk-k-cmd-ctrl-v-not-working-30909][DOC:360045942953 excerpt]_
- [ ] **TX-165** Paste URL to link — with a URL on the clipboard, ⌘V over a selected range adds the link and keeps the characters. _Data:_ `hyperlink`, `characters` _Test:_ copy URL, select word, ⌘V. _M3·P1·[DOC:360045942953 excerpt]_
- [ ] **TX-166** Link to node — link a range to a frame/page in the same file (`type:'NODE'`). _Data:_ `hyperlink.value` = node id _Test:_ create link to frame; read; delete frame → record link state. _M3·P1·[API][DOC:360045942953 excerpt]_
- [ ] **TX-167** Link on whole layer — with a text layer selected (not editing), creating a link applies to all characters. _Data:_ `hyperlink` _Test:_ select layer, ⌘⇧U, URL; read. _M3·P1·[KNOW]_
- [ ] **TX-168** Link appearance — linked text receives Figma's automatic link styling (underline) (recorded). _Data:_ `textDecoration`, overrides _Test:_ create link on plain text; read decoration. _M3·P1·[KNOW]_
- [ ] **TX-169** Link hover popup — hovering a link on canvas (not editing) shows target with open/edit/remove; remove clears the link and its auto-styling. _Data:_ `hyperlink` _Test:_ hover; remove; read. _M3·P1·[KNOW]_
- [ ] **TX-170** Link typing boundary — characters typed immediately after a link end are not linked (or Figma's rule recorded). _Data:_ `hyperlink` _Test:_ caret at link end, type "x"; read. _M3·P2·[KNOW]_
- [ ] **TX-171** Links on styled text — creating a link on styled text records a HYPERLINK override and keeps the text style. _Data:_ `textStyleOverrides`, `textStyleId` _Test:_ apply style, add link; style id unchanged. _M6·P1·[API]_
- [ ] **TX-172** Links in prototypes — in presentation, URL links open externally and NODE links navigate to the target frame. _Data:_ `hyperlink` _Test:_ present; click both. _M7·P1·[KNOW]_

### 6.23 Fonts: local availability, fallback, missing fonts

- [ ] **TX-173** Local font enumeration — all OS-installed fonts (TTF, OTF, TTC/OTC, variable) are available in the picker offline; newly installed fonts appear without restart (Illigma improvement; Figma may require relaunch). _Data:_ font catalog _Test:_ install a font while running; appears within N s. _M3·P0·[DOC:360039956894 excerpt][SRC:https://designbeep.com/2026/04/26/how-to-add-fonts-to-figma/]_
- [ ] **TX-174** Bundled default fonts — Inter (and the bundled set) always available offline so default text works on a clean machine. _Data:_ font catalog _Test:_ clean VM, no network; create text. _M3·P0·[API (Inter default)][DOC:360039956994 excerpt]_
- [ ] **TX-175** Font identity persistence — each run stores family, style, PostScript name (and variation settings); reopening on another machine resolves the same face. _Data:_ `fontName`, REST `fontPostScriptName` _Test:_ save/open across machines; compare. _M3·P0·[API]_
- [ ] **TX-176** Glyph fallback — characters missing from the run font render with a fallback font without changing `fontName` and without marking the font missing. _Data:_ render _Test:_ Inter "abc 日本 😀 ⌘"; fontName unchanged; glyphs visible. _M3·P0·[KNOW]_
- [ ] **TX-177** Missing font detection — text whose font cannot be resolved sets `hasMissingFont` on the node and the document. _Data:_ `hasMissingFont` _Test:_ open file using an uninstalled font. _M3·P0·[API]_
- [ ] **TX-178** Missing font indicators — file-level indicator (toolbar/left area) and an icon beside the font name in the Typography section for selected affected layers. _Data:_ UI _Test:_ open fixture; check both. _M3·P0·[DOC:360039956994 excerpt]_
- [ ] **TX-179** Missing-font preview rendering — affected text renders exactly as last laid out (preview) until the font is available or replaced. _Data:_ cached layout/outlines _Test:_ save on machine A, open on B without font; pixel-compare. _M3·P0·[DOC:360039956894 excerpt][API]_
- [ ] **TX-180** Missing-font editing lock — affected text cannot be edited; resizing changes the box without re-layout. _Data:_ `characters` _Test:_ double-click missing-font text; record behavior; resize; layout unchanged. _M3·P0·[DOC:360039956894 excerpt][API]_
- [ ] **TX-181** Replace fonts modal — lists missing families/styles and affected layers; Replacement family + style pickers show only available fonts; "Replace fonts" updates all affected text in the file in one undo step. _Data:_ `fontName` _Test:_ two missing fonts, replace one; undo restores. _M3·P0·[DOC:360039956994 excerpt]_
- [ ] **TX-182** Re-layout on availability — when a missing font becomes available, affected text re-lays-out and the indicator clears. _Data:_ `hasMissingFont` _Test:_ install font while file open. _M3·P1·[KNOW]_
- [ ] **TX-183** Source priority & conflicts — when the same family exists in several sources, a deterministic priority is applied and recorded in the file (Figma order: shared → installed → default web fonts). _Data:_ font source metadata _Test:_ two versions of a family; record resolution. _M3·P2·[DOC:360039956994 excerpt]_
- [ ] **TX-184** Select all with same font — selects every text layer using the selected layer's font. _Data:_ selection _Test:_ 3 layers in Inter, 1 in Roboto. _M3·P2·[SRC:https://forum.figma.com/report-a-problem-6/can-t-edit-existing-text-54712]_
- [ ] **TX-185** Recompute text layout — command re-lays-out selected text with the current engine/fonts. _Data:_ layout cache _Test:_ fixture with stale cache; run command. _M3·P2·[SRC:https://forum.figma.com/report-a-problem-6/can-t-edit-existing-text-54712]_
- [ ] **TX-186** Icon fonts — ligature-based icon fonts render icons from typed names with LIGA on; PUA code points render. _Data:_ `characters`, `LIGA` _Test:_ Material Symbols "home"; turn LIGA off → text. _M3·P2·[KNOW]_

### 6.24 Text styles

- [ ] **TX-187** Create text style — captures font, size, line height, letter spacing, paragraph spacing/indent, list spacing, decoration, case, vertical trim, hanging punct/list, wrap style (not color/alignment/resizing). _Data:_ `TextStyle` fields _Test:_ create from styled text; read style fields. _M6·P0·[API]_
- [ ] **TX-188** Apply style to layer or range — applying sets `textStyleId` and values on the layer(s) or selected range only. _Data:_ `textStyleId` _Test:_ apply to one word; segments. _M6·P0·[API]_
- [ ] **TX-189** Style edits propagate — editing a style updates and re-lays-out all consumers (incl. Auto width sizes). _Data:_ consumers _Test:_ change style size 16→24; consumers resize. _M6·P0·[KNOW]_
- [ ] **TX-190** Detach on non-semantic change — changing a style-controlled property (e.g. size) on a styled range removes the style link from that range only, keeping values. _Data:_ `textStyleId` _Test:_ styled layer, change size of one word; that word's style id = ""; others keep. _M6·P0·[KNOW]_
- [ ] **TX-191** Semantic overrides keep style — bold, italic, underline/strikethrough and links on a styled range are recorded as overrides and the style stays attached. _Data:_ `textStyleOverrides`, REST `semanticWeight/semanticItalic/isOverrideOverTextStyle` _Test:_ ⌘B on a word; style id unchanged; override present. _M6·P0·[API]_
- [ ] **TX-192** Semantic override re-resolution — after the style's font changes, a SEMANTIC_WEIGHT=BOLD range renders the bold face of the new family. _Data:_ overrides _Test:_ style Inter→Roboto; bold word = Roboto Bold. _M6·P1·[KNOW]_
- [ ] **TX-193** Detach style — keeps all current values, clears the link. _Data:_ `textStyleId` _Test:_ detach; values unchanged. _M6·P0·[KNOW]_
- [ ] **TX-194** Mixed styles display — selection spanning several styles shows Mixed in the style control. _Data:_ `textStyleId` mixed _Test:_ two styles in one layer. _M6·P1·[API]_
- [ ] **TX-195** Color independent of style — fills/color styles stay per range and are not changed by applying a text style. _Data:_ `fills`, `fillStyleId` _Test:_ red text, apply style; still red. _M6·P0·[API]_
- [ ] **TX-196** Style contents beyond typings — whether text styles also carry OpenType features, decoration sub-styles and truncation matches Figma. _Data:_ style fields _Test:_ create style from text with SS01 and wavy underline and Max lines 2; apply elsewhere; record. _M6·P1·[KNOW]_

### 6.25 Typography variables

- [ ] **TX-197** Bindable typography fields — font family, style, weight, size, line height, letter spacing, paragraph spacing, paragraph indent can be bound per range and on text styles. _Data:_ `VariableBindableTextField`, `boundVariables` _Test:_ bind each; read API. _M6·P0·[API][SRC:https://forum.figma.com/suggest-a-feature-11/launched-typography-variables-font-size-font-weight-and-style-24920]_
- [ ] **TX-198** Variable types per field — family/style take STRING; size/line height/letter spacing/paragraph fields take NUMBER; weight accepts NUMBER (and STRING style names per tutorials). _Data:_ variable `resolvedType` _Test:_ try binding wrong types; record allowed set. _M6·P0·[API][SRC:https://uxdesign.cc/set-up-typography-variables-in-figma-359cfea88b68]_
- [ ] **TX-199** Mode switching re-layout — switching a frame's mode or editing a variable value re-resolves and re-lays-out bound text (incl. auto-resize). _Data:_ resolved values _Test:_ size variable 16/24 in modes; switch; record heights. _M6·P0·[KNOW]_
- [ ] **TX-200** Invalid font values — a family/style/weight value with no matching font face leaves the text unchanged (no missing font) per Figma (recorded). _Data:_ resolution _Test:_ weight "XBold" for Inter. _M6·P1·[SRC:https://frontendmasters.com/blog/figma-typography-variables/]_
- [ ] **TX-201** Units of numeric typography variables — line height variable = px; letter spacing variable unit as Figma (recorded). _Data:_ `lineHeight`, `letterSpacing` _Test:_ bind number 24 to each; read unit. _M6·P1·[SRC:https://forum.figma.com/suggest-a-feature-11/launched-typography-variables-font-size-font-weight-and-style-24920]_
- [ ] **TX-202** Characters bound to string variable — text shows the variable's value; mode switch updates characters; behavior on typing into the layer recorded. _Data:_ `boundVariables.characters` _Test:_ bind STRING with 2 modes; switch; type. _M6·P1·[API]_

### 6.26 Text in auto layout

- [ ] **TX-203** Sizing ↔ resizing sync — HUG/HUG ⇔ Auto width; FIXED or FILL width + HUG height ⇔ Auto height; FIXED/FILL height ⇔ Fixed size; changing either control updates the other. _Data:_ `layoutSizingHorizontal/Vertical`, `textAutoResize` _Test:_ each combination; read both. _M4·P0·[API][KNOW]_
- [ ] **TX-204** Fill-width text wraps — FILL-width text wraps at the allotted width and its height feeds the parent's hug height in the same layout pass. _Data:_ sizes _Test:_ resize parent; text height and parent height update together. _M4·P0·[KNOW]_
- [ ] **TX-205** Max width wraps hug text — HUG-width text with `maxWidth` wraps at the max. _Data:_ `maxWidth` _Test:_ max 120 on hug text; type long text; record lines. _M4·P1·[KNOW]_
- [ ] **TX-206** Min width on hug text — `minWidth` keeps the box at least that wide (alignment inside the box applies). _Data:_ `minWidth` _Test:_ min 200, short centered text; record glyph x. _M4·P2·[KNOW]_
- [ ] **TX-207** Baseline alignment — horizontal auto layout with "align to baseline" aligns children's first text baselines; unavailable for vertical layouts. _Data:_ `counterAxisAlignItems = 'BASELINE'` _Test:_ texts of 12/24/40 px; record baselines equal. _M4·P1·[API][OBS]_

### 6.27 Scale tool & transforms

- [ ] **TX-208** Scale tool scales type — Scale (K) by factor s multiplies box size and font size by s and scales strokes/effects. _Data:_ `fontSize`, size _Test:_ 16 px text ×2 → 32 px; box ×2. _M3·P0·[DOC:360040451453 excerpt]_
- [ ] **TX-209** Scale tool on dependent px values — px line height, px letter spacing, paragraph spacing/indent, list spacing and px decoration values scale by s; % and Auto unchanged. _Data:_ those props _Test:_ fixture with each in px and %, ×1.5; record. _M3·P1·[KNOW]_
- [ ] **TX-210** Scale keeps resizing mode — Auto width stays Auto width etc. after scaling. _Data:_ `textAutoResize` _Test:_ scale each mode. _M3·P1·[KNOW]_
- [ ] **TX-211** Scaling containers with text — Scale on a frame scales nested text font sizes; plain resize of the frame applies constraints instead (no font change). _Data:_ nested `fontSize` _Test:_ frame with text: K-scale vs handle resize. _M3·P0·[DOC:360040451453 excerpt]_

### 6.28 Components & instances (text-specific)

- [ ] **TX-212** Text component property — `characters` of a text layer in a component can be bound to a TEXT property; instances expose it in the inspector. _Data:_ `componentPropertyReferences.characters` _Test:_ create property; edit in instance. _M5·P0·[API]_
- [ ] **TX-213** Instance text override survives updates — edited instance characters/styles persist when the main component's text changes; non-overridden props follow the main. _Data:_ overrides _Test:_ override text in instance; change main font size and text; record instance. _M5·P0·[KNOW]_
- [ ] **TX-214** Per-range overrides in instances — bolding one word in an instance is kept when the main's text style changes. _Data:_ segments _Test:_ as described; record. _M5·P1·[KNOW]_
- [ ] **TX-215** Resizing in instances — instance text follows the main's resizing mode unless overridden; overriding width on Auto width text in an instance switches mode like TX rules. _Data:_ `textAutoResize` _Test:_ resize text in instance. _M5·P1·[KNOW]_

### 6.29 Undo/redo

- [ ] **TX-216** Typing undo granularity — ⌘Z in edit mode undoes typed text in Figma-like chunks and restores caret/selection. _Data:_ history _Test:_ type "hello world foo" with pauses; count ⌘Z steps; record caret after each. _M3·P0·[KNOW]_
- [ ] **TX-217** Property change = one step — each inspector commit (enter, dropdown pick, toggle, scrub release) is exactly one undo step, for layer or range. _Data:_ history _Test:_ scrub letter spacing; one ⌘Z restores. _M3·P0·[KNOW]_
- [ ] **TX-218** Undo across edit session — after committing a newly created text with Esc, repeated ⌘Z walks back the typing and finally removes the layer; ⌘⇧Z redoes in order. _Data:_ history _Test:_ create, type 2 words, Esc; ⌘Z until layer gone; count. _M3·P0·[KNOW]_
- [ ] **TX-219** Undo of auto-list and auto-resize side effects — undo restores characters, list attrs and box size/position consistently. _Data:_ history _Test:_ auto-list then ⌘Z (TX auto-list undo) and mode switch then ⌘Z. _M3·P1·[DOC:360040449773 excerpt][KNOW]_

### 6.30 Clipboard

- [ ] **TX-220** Copy range (rich, internal) — copying in edit mode and pasting into another Illigma text keeps character and paragraph attributes. _Data:_ segments _Test:_ copy "ab**cd**" red; paste; segments equal. _M3·P0·[KNOW]_
- [ ] **TX-221** Copy range to OS — system clipboard receives plain text with `\n` breaks (list markers per Figma, recorded). _Data:_ clipboard _Test:_ paste into a plain editor. _M3·P0·[KNOW]_
- [ ] **TX-222** Paste external plain text — inserted text takes the insertion style; CRLF/CR → `\n`; tabs kept; external rich formatting ignored. _Data:_ `characters`, segments _Test:_ paste from a word processor with bold; record. _M3·P0·[KNOW]_
- [ ] **TX-223** Paste text onto canvas — pasting text while not editing creates a new text layer (position, resizing mode and style recorded). _Data:_ new node _Test:_ copy text from OS; select nothing; ⌘V. _M3·P1·[KNOW]_
- [ ] **TX-224** Paste text with a text layer selected — whether Figma replaces content, inserts, or creates a new layer (recorded and matched). _Data:_ nodes _Test:_ select text layer (not editing); ⌘V plain text. _M3·P2·[KNOW]_

### 6.31 Export, flatten & rendering accuracy

- [ ] **TX-225** Flatten text to vectors — ⌘E converts a text layer to a vector whose paths equal the rendered glyphs (incl. decorations, list markers, ellipsis) with fills/strokes/effects kept. _Data:_ resulting `VECTOR` _Test:_ flatten fixture; compare paths/bounds to Figma. _M2·P1·[KNOW]_
- [ ] **TX-226** SVG export of text — default outlines text; option to export as `<text>`; geometry matches canvas. _Data:_ export settings _Test:_ export fixture both ways; diff. _M2·P1·[KNOW]_
- [ ] **TX-227** PDF export of text — text remains selectable/searchable with embedded font subsets. _Data:_ export _Test:_ export; select text in a PDF viewer. _M8·P2·[KNOW]_
- [ ] **TX-228** Raster parity — PNG export and canvas rendering of text match Figma pixel-wise within tolerance at 1×/2×. _Data:_ render _Test:_ golden image diff (ΔE, ≤1% pixels). _M2·P1·[KNOW]_
- [ ] **TX-229** Deterministic layout — identical line breaks/glyph positions across macOS/Windows/Linux and all zoom levels. _Data:_ layout cache _Test:_ same file on 3 OSes; compare layout dumps. _M3·P0·[KNOW]_
- [ ] **TX-230** Fractional geometry — text box sizes are not rounded to integers. _Data:_ `width`, `height` _Test:_ Inter 13 px "Hello"; record width decimals vs Figma. _M3·P0·[KNOW]_
- [ ] **TX-231** Golden layout fixture — a fixture of ≥ 50 text layers covering §2 lays out within 0.01 px (box) / 0.1 px (glyph) of Figma with identical fonts. _Data:_ all _Test:_ compare exported REST/plugin dumps (`absoluteRenderBounds`, line breaks). _M3·P0·[KNOW]_
- [ ] **TX-232** Complex shaping — Arabic joining, Devanagari reordering, Thai, combining marks shape like Figma (HarfBuzz-class). _Data:_ render _Test:_ multilingual fixture; compare glyphs. _M3·P1·[KNOW]_

### 6.32 Layers panel, multi-edit, international text

- [ ] **TX-233** Layers panel entry — text layers show the text icon and the derived name; double-clicking the name renames (does not edit text). _Data:_ `name` _Test:_ double-click name; rename mode. _M3·P1·[KNOW]_
- [ ] **TX-234** Multi-edit — with several text layers selected, Return or "Multi-edit text" edits them together: typing, deleting and styling apply to each layer; Esc exits. _Data:_ transient carets _Test:_ 3 layers "a","b","c"; ↩, type "x"; record results. _M3·P1·[DOC:360039956434 excerpt][KNOW]_
- [ ] **TX-235** Bidirectional text — RTL paragraphs shape/order per UAX #9; mixed LTR/RTL caret movement and selection match Figma. _Data:_ render, caret _Test:_ Hebrew+English fixture; arrow through; record offsets. _M3·P1·[KNOW]_
- [ ] **TX-236** CJK line breaking — CJK text breaks between characters with kinsoku rules (no line-initial 。、 etc.). _Data:_ line breaks _Test:_ Japanese paragraph in 100 px box; compare breaks. _M3·P1·[KNOW]_
- [ ] **TX-237** Color emoji — emoji render in color via fallback regardless of run font, scaled with font size. _Data:_ render _Test:_ Inter "🙂" at 12/48 px. _M3·P1·[KNOW]_

### 6.33 Persistence & interop

- [ ] **TX-238** Round-trip all text properties — save/reopen preserves every node, character and paragraph property of §2 including mixed ranges, overrides, variable bindings and links. _Data:_ all §2 _Test:_ fixture → save → reopen → property dump equal. _M3·P0·[API]_
- [ ] **TX-239** REST/.fig text import mapping — import maps `characterStyleOverrides`/`styleOverrideTable`, `lineTypes`/`lineIndentations`, `opentypeFlags`, `semanticWeight/Italic`, `lineHeightUnit` correctly. _Data:_ REST `TypePropertiesTrait` _Test:_ import REST JSON fixture; compare with source render. _M8·P1·[API]_
- [ ] **TX-240** Text-path import/edit (P2) — `TEXT_PATH` nodes import and render; start position/flip editable. _Data:_ `textPathStartData` _Test:_ fixture with circular text; drag start handle. _M3·P2·[API][SRC:https://forum.figma.com/suggest-a-feature-11/make-text-follow-a-path-or-a-circle-34880]_
- [ ] **TX-241** Large text performance — editing a 20 000-character text layer keeps typing latency < 16 ms per keystroke and re-layout incremental per paragraph. _Data:_ perf _Test:_ benchmark. _M8·P1·[KNOW]_

### 6.34 Spell check, find & replace (P2)

- [ ] **TX-242** Spell check — misspelled words underlined while editing; right-click offers suggestions and "ignore"; language selectable. _Data:_ transient _Test:_ type "teh"; right-click. _M3·P2·[KNOW]_
- [ ] **TX-243** Find & replace text — ⌘F finds text content across layers (page/file scope), replace preserves the first replaced character's style. _Data:_ `characters` _Test:_ replace "foo"→"bar" in styled text; record styles. _M3·P2·[KNOW]_

---

## 7. Cross-area dependencies

| Depends on / affects | Area & milestone | What this area needs from it (or gives to it) |
| --- | --- | --- |
| Document model, persistence, file format | Foundation · M0 | Rich-text representation (character spans + paragraph attributes + node attributes), lossless save/load, layout-engine version stamp, missing-font preview cache (§2.7–§2.8) |
| Renderer | Foundation · M0 | Glyph-outline rendering (GPU path rendering or atlas) independent of OS text engines; color-emoji bitmaps/COLR; decoration drawing; zoom-independent quality |
| Undo/redo engine | Foundation · M0 | Grouping of typing into steps, transient (preview) changes that create no history, caret/selection restoration (§3.25) |
| UI component kit | Foundation · M0 | Numeric fields with units (px/%/Auto), "Mixed" state, scrubbing, arithmetic, combobox (font size), searchable list with live preview (font picker), segmented controls, popovers with tabs (Type settings) |
| Test harness | Foundation · M0 | Golden layout dumps and image diffs against Figma reference exports (TX golden fixture) |
| Canvas, selection, transforms, handles, snapping | Core editing · M1 | Selection depth/deep select (edit-mode entry), Esc semantics, drag threshold, parent assignment on creation, resize handles and modifiers, rotation; text must expose baselines/bounds for snapping and smart guides |
| Layers panel | Core editing · M1 | Text icon, auto-derived names, rename semantics |
| Keyboard shortcut registry | Core editing · M1 | Edit-mode shortcut scoping; conflicts such as ⌘[ "decrease indentation" vs layer ordering [SRC:https://forum.figma.com/report-a-problem-6/keyboard-shortcut-send-backwards-overlapping-with-decrese-indentation-51642] |
| Fills, strokes, effects, color picker, flatten, export | Vectors & paint · M2 | Per-range paints (solid/gradient/image) on text, node-level strokes/effects, Flatten text → vectors, SVG/PNG export of text |
| Auto layout, constraints, min/max | Layout · M4 | HUG/FILL ↔ `textAutoResize` sync, max-width wrapping, baseline alignment, truncation in hug containers (§3.22) |
| Components, instances, overrides, TEXT properties | Components · M5 | Text characters property binding, per-range override persistence (§3.24) |
| Styles, variables, modes, libraries | Design systems · M6 | Text styles (create/apply/detach/override semantics), typography and string variables, mode re-resolution (§3.20–§3.21) |
| Prototyping & presentation | Prototyping · M7 | Clickable hyperlinks (URL/NODE), string variables changing text at runtime, text in Smart Animate |
| Import/export, clipboard interop, version history, performance, accessibility | Interop & hardening · M8 | REST/.fig text mapping (`characterStyleOverrides`, `lineHeightUnit` INTRINSIC_%, deprecated TRUNCATE), PDF text, OS clipboard formats, large-text performance, accessible text editing (screen-reader exposure of the edited text) |
| Inspector visual design (Framer look) | UI kit / inspector spec | This document defines only function; visuals of Typography section, Type settings popover, font picker come from the Framer reference |

---

## 8. Needs live Figma verification

Every experiment: use a fresh Figma Design file (UI3, desktop app, current version), fonts Inter (bundled) plus the named fixtures; record the exact values with the plugin API console (`figma.currentPage.selection[0]` dumps, `getStyledTextSegments([...all fields])`, `absoluteRenderBounds`) **and** a screenshot. Each result becomes the expected value of the referenced TX items. Items whose only evidence is `[KNOW]`/`[SRC]` stay blocked until their experiment is recorded.

| ID | Setup | Action | What to record |
| --- | --- | --- | --- |
| E-CR-1 | Empty page, zoom 100% | Text tool, click at a known canvas point (use a 1 px rectangle as marker), type "Hg", Esc | Box x/y relative to click point; w/h; `textAutoResize` |
| E-CR-2 | Same | Drag 200×80 with Text tool, type 6 lines; also Shift-drag, Alt-drag, a 2 px drag | `textAutoResize` (expected NONE), sizes, overflow drawing |
| E-CR-3 | Fresh session | Create text; then set Roboto 20/LH 150% on it; create another text; restart app; create again | Default props each time (last-used memory scope: session vs persistent) |
| E-CR-4 | Same | Text tool click, Esc without typing; ⌘Z | Layer count, undo history entries |
| E-CR-5 | Frame containing horizontal auto layout with 2 children | Click with Text tool inside the AL gap and inside the frame outside AL | Parent and index of new text |
| E-ED-1 | "abcdef" text layer | Double-click between c and d (layer not selected / selected); select layer and press ↩ | Caret offset or selected range after each |
| E-ED-2 | Editing text | Esc; Esc; also click on empty canvas | Edit committed? selection after each |
| E-ED-3 | 3 text layers "a","b","c" selected | Press ↩ (and click "Multi-edit text"); type "x"; ⌘B; Esc | Characters/styles of each; initial selection per layer |
| E-NV-1 | "foo-bar baz.qux" + wrapped paragraph | Double-click words, triple-click, ⌥/⌘ arrows, Home/End (Windows) | Ranges/offsets |
| E-IN-1 | Bulleted list, paragraphSpacing 20 | Shift+↩ inside an item | Code point inserted (U+2028?), marker behavior, height delta |
| E-IN-2 | Inter 16 | Type "a⇥b", "aaaa⇥b" | x of "b" (tab stop rule) |
| E-IN-3 | macOS Japanese IME | Compose, Esc mid-composition, ↩ to commit, ⌘Z | Inserted text, edit-mode state, undo steps |
| E-RS-1 | Text selected | Inspect right sidebar | Where Auto width/Auto height/Fixed size controls are (Layout vs Typography) and their labels |
| E-RS-2 | Auto width text; Auto height text | Drag right edge only; type a W value | Resulting `textAutoResize` (expected HEIGHT) — DOC excerpt says Fixed size |
| E-RS-3 | Fixed-size text | Double-click right edge handle; double-click bottom edge handle | Resulting `textAutoResize` |
| E-RS-4 | Auto width text aligned L/C/R; Auto height text bottom-aligned with bottom constraint in a frame | Type 5 chars / add a line | x/width deltas; y/height deltas |
| E-TR-1 | Fixed 120×40 & Auto height Max lines 2, Inter 16 | Long text incl. a 30-char word; color last visible word red; enter edit mode; copy | Last visible text, ellipsis style, edit-mode display, clipboard content |
| E-TR-2 | Truncate on | Max lines input 0, 2.6, empty | Stored `maxLines` |
| E-TR-3 | Hug-width text, maxWidth 100, Max lines 1; vertical AL parent hugging | Type long text | Wrap/ellipsis behavior; parent height |
| E-AL-1 | Fixed 100×40, 5 lines | Vertical align top/center/bottom | `absoluteRenderBounds` per mode |
| E-AL-2 | Justified 2 paragraphs, one Shift+↩ line, one single-word line | Inspect | Word positions per line |
| E-AL-3 | Hug text with maxWidth/minWidth | Type long/short text | Wrapping at max width; alignment inside min width |
| E-FN-1 | Inter "Semi Bold Italic" | Change family to fonts lacking that style | Chosen style |
| E-FN-2 | Inter Italic, a family without Bold, a styled range | ⌘B, ⌘I, ⌥⌘> ×3 | Styles; overrides; no-op cases |
| E-FN-3 | Font size field | Enter 0.5, 13.37, 5000, 100000; ⌘⇧>/< ×3; open dropdown | Stored values/clamps, step, preset list |
| E-LH-1 | Single-line text, 100 px, Auto LH, fonts: Inter, Roboto, Georgia, Noto Sans JP, a font with USE_TYPO_METRICS and differing hhea/typo metrics | Read height | Height vs hhea, OS/2 typo, win metrics → identify formula |
| E-LH-2 | Line height field | Type "auto", "AUTO", "150%", "24", "24px", "1.5"; with current unit % and px | Stored unit/value |
| E-LH-3 | One line mixing 16 px/LH 20 and 32 px/LH 40 runs; and mixing fonts with different ascents | Read height and baseline | Line height rule (max?) and baseline rule |
| E-LS-1 | Inter 20 "AAAA" | LS 10%, −5px, 1000%, −1000% | Advances; clamps |
| E-LS-2 | Auto width "AB", LS 10 px, center aligned | Read width and glyph x | Whether spacing is added after the last char / trimmed |
| E-LS-3 | Font with fi ligature | LS 0 vs 5% | Ligature applied? |
| E-PS-1 | 3 single-line paragraphs | paragraphSpacing 10; −5 input | Height; acceptance of negatives |
| E-PS-2 | 3-item list + paragraph after | listSpacing 8, paragraphSpacing 20 | Each gap |
| E-PI-1 | 2 paragraphs | paragraphIndent 24; −10 | First-line x of both; acceptance |
| E-DC-1 | Inter 40 underlined; strikethrough | Auto vs 3 px vs 10% thickness/offset; skip ink; underline across spaces & wrap | Decoration geometry; strikethrough option availability |
| E-CS-1 | "o'neil well-known iPhone"; font with/without smcp | Title, Small caps, Forced small caps; copy | Rendering; availability; clipboard |
| E-LI-1 | Lists | 5-level numbered & bulleted; Shift+Tab; type "2. "; ⌘⇧7 twice; ⌘] on plain paragraph; copy to plain editor | Marker formats/glyphs; indent x per level (16 & 32 px); behaviors |
| E-HP-1 | hangingPunctuation on | Lines starting with “ " ‘ « ( * — and ending with ” | Which glyphs hang (left/right) |
| E-VT-1 | Inter 40, 2 lines, LH 60, Auto height | Toggle vertical trim; Fixed box + center | Height, y change, baseline positions |
| E-WR-1 | 3-line and 8-line paragraphs; orphan case | Balance, Pretty | Line breaks |
| E-WR-2 | Fixed 80 px width | Type a 40-char word | Break inside word or overflow |
| E-OT-1 | Inter, a font with tnum/onum/frac/sups | Open Type settings → Details; toggle every option; create text style from it | UI groups/labels; API `openTypeFeatures` and REST `opentypeFlags` for numeric options; whether style keeps features |
| E-VF-1 | Inter (variable), a font with ital axis | Axis inputs out of range; custom value; choose named style | Clamps, label text, axes after reset, ital UI |
| E-LK-1 | Text with link | Create via ⌘⇧U on range and whole layer; hover; remove; type at link end; delete target frame of NODE link | Decoration/override set; popup actions; link extension; dangling link state |
| E-MF-1 | File using a font not installed | Open; double-click text; resize; Replace fonts; ⌘Z | Indicators, edit lock, rendering, undo steps |
| E-TS-1 | Text style applied | Change size of one word; ⌘B a word; change style font family; detach | Style ids, overrides, re-resolution |
| E-VA-1 | Variables | Bind weight as NUMBER and STRING; invalid "XBold"; LH/LS numbers; STRING bound to characters then type | Allowed types, results, units, typing behavior |
| E-SC-1 | Text with px LH/LS/paragraph spacing/list spacing/underline px | Scale ×1.5 with K | All scaled values; resizing mode |
| E-CP-1 | Component with text; instance overrides (text and one bold word) | Edit main text/style/size | Instance results |
| E-UN-1 | New text | Type "hello world foo" with pauses; ⌘Z repeatedly; scrub LS then ⌘Z | Step boundaries; caret restoration |
| E-CB-1 | OS clipboard | Copy rich range to plain editor; paste rich text from a word processor; paste text with nothing selected and with a text layer selected | Results, new layer props |
| E-EX-1 | Fixture | Export SVG (outline on/off), PDF; flatten | `<text>` presence, PDF selectability, flattened paths incl. decorations/markers |
| E-RN-1 | Inter 13 "Hello" auto width | Read width/height | Decimal precision (rounding rule) |
| E-UI-1 | Text selected | Open Type settings | Tab names (Basics/Details/Variable?), exact control list and placement (truncation, vertical trim, case, decoration, lists, hanging, wrap) |
| E-KB-1 | Figma shortcut panel (⌃⇧? / Ctrl+Shift+?) | Read Text section | Authoritative key list incl. alignment, line height direction, Shift+Tab |
| E-BI-1 | Hebrew+English mixed; Japanese paragraph | Arrow navigation; 100 px wrapping | Caret order; break positions |
| E-LP-1 | Circle → text on path | Create with Draw tool; drag start handle; flip | Node type, `textPathStartData`, available properties |
| E-RA-1 | Two text layers with mixed sizes; "**ab**cd" | Change size with layers selected; range-select and set fill; collapsed caret + set red then type / then move caret; select-all + type; multi-layer family change (Inter Bold + Roboto Light → Open Sans) | Segments after each; undo entries created by caret-only property changes |
| E-FN-4 | Font picker | Type a query, arrow through 5 families, hover, Esc; reopen | Preview behavior, undo entries, recent-fonts list |
| E-MF-2 | Inter text containing 日本, 😀, ⌘, Hebrew; a font installed while Figma desktop is open | Inspect rendering; check picker | Fallback faces used (no missing-font flag); whether new font appears without relaunch |
| E-AL-4 | Text inside horizontal & vertical auto layout | Cycle HUG/FIXED/FILL per axis; set "align to baseline" with 12/24/40 px children | `textAutoResize` after each; baseline y values; control availability |
| E-GL-1 | Golden fixture file (≥ 50 text layers covering §2) | Export plugin dumps (`getStyledTextSegments` all fields, `absoluteRenderBounds`, width/height) and 1×/2× PNGs | Reference data for TX golden-layout and raster-parity items |
| E-SP-1 | Text with "teh"; several layers containing "foo" | Right-click misspelling; ⌘F find/replace "foo"→"bar" on styled text | Suggestions UI; scope; resulting styles |


### 8.1 Checklist items blocked on verification

These items rest only on `[KNOW]` and/or `[SRC]` evidence. Their expected behavior is a hypothesis until the listed experiment is recorded; items with `[API]`/`[DOC]` evidence still need the normal acceptance test but are not blocked.

| Checklist group | Blocked items | Experiment(s) |
| --- | --- | --- |
| §6.1 | TX-003, TX-004, TX-005, TX-006, TX-008, TX-009, TX-011 | E-CR-1…E-CR-5 |
| §6.2 | TX-012, TX-013, TX-014, TX-015, TX-016, TX-017, TX-018, TX-019 | E-ED-1, E-ED-2 |
| §6.3 | TX-020, TX-021, TX-022, TX-024, TX-025, TX-026, TX-027, TX-028 | E-NV-1 |
| §6.4 | TX-030, TX-031, TX-032, TX-033, TX-034, TX-035 | E-IN-1…E-IN-3 |
| §6.5 | TX-038, TX-044, TX-045 | E-RA-1 |
| §6.6 | TX-051, TX-052, TX-054, TX-055, TX-056 | E-RS-1…E-RS-4 |
| §6.7 | TX-066, TX-067, TX-068, TX-069, TX-070 | E-TR-1…E-TR-3 |
| §6.8 | TX-072, TX-074, TX-075 | E-AL-1, E-AL-2, E-KB-1 |
| §6.9 | TX-076, TX-077, TX-078, TX-079, TX-081, TX-082, TX-083, TX-085 | E-FN-1, E-FN-2, E-FN-4 |
| §6.10 | TX-087, TX-089 | E-FN-3 |
| §6.11 | TX-091, TX-092, TX-093, TX-094, TX-095, TX-096, TX-098 | E-LH-1…E-LH-3 |
| §6.12 | TX-100, TX-101, TX-102 | E-LS-1…E-LS-3 |
| §6.13 | TX-104, TX-107 | E-PS-1, E-PS-2, E-PI-1 |
| §6.14 | TX-109, TX-115 | E-DC-1, E-KB-1 |
| §6.15 | TX-117 | E-CS-1 |
| §6.16 | TX-125, TX-128, TX-131, TX-132, TX-133, TX-135, TX-136, TX-137, TX-138 | E-LI-1 |
| §6.17 | TX-141 | E-HP-1 |
| §6.18 | TX-143, TX-144, TX-145 | E-VT-1, E-AL-4 |
| §6.21 | TX-161 | E-VF-1 |
| §6.22 | TX-167, TX-168, TX-169, TX-170, TX-172 | E-LK-1 |
| §6.23 | TX-176, TX-182, TX-184, TX-185, TX-186 | E-MF-1, E-MF-2 |
| §6.24 | TX-189, TX-190, TX-192, TX-193, TX-196 | E-TS-1 |
| §6.25 | TX-199, TX-200, TX-201 | E-VA-1 |
| §6.26 | TX-204, TX-205, TX-206 | E-AL-3, E-AL-4 |
| §6.27 | TX-209, TX-210 | E-SC-1 |
| §6.28 | TX-213, TX-214, TX-215 | E-CP-1 |
| §6.29 | TX-216, TX-217, TX-218 | E-UN-1 |
| §6.30 | TX-220, TX-221, TX-222, TX-223, TX-224 | E-CB-1 |
| §6.31 | TX-225, TX-226, TX-227, TX-228, TX-229, TX-230, TX-231, TX-232 | E-EX-1, E-RN-1, E-GL-1 |
| §6.32 | TX-233, TX-235, TX-236, TX-237 | E-ED-3, E-BI-1 |
| §6.33 | TX-241 | E-LP-1 (perf target is an Illigma budget, no Figma check) |
| §6.34 | TX-242, TX-243 | E-SP-1 |

Total blocked: 133 of the checklist items.

---

## 9. Sources

### 9.1 Offline typings (read directly in this session)

Figma Plugin API typings `@figma/plugin-typings` **v1.141.0** — `plugin-api.d.ts`:
- `createText` L1067; `createTextPath` L1355 (TextPathNode from vector/shape/line; base network not editable afterwards); `listAvailableFontsAsync` L1662; `loadFontAsync` L1698; `getFontFamilyVariationAxes` L1726; document `hasMissingFont` L1730.
- `NodeChangeProperty` text entries L3769–3853; `StyleChangeProperty` (text style fields) L3896–3916.
- `FontName` L3980; `FontNameInput` L4023; `TextCase` L4028; `TextDecoration` L4029; `TextDecorationStyle` L4030; `FontStyle` L4031; `TextDecorationOffset` L4032; `TextDecorationThickness` L4040; `TextDecorationColor` L4048; `OpenTypeFeature` L4055–4284 (229 tags).
- `LetterSpacing` L5451; `LineHeight` L5455; `LeadingTrim` L5463; `TextWrapStyle` L5467; `HyperlinkTarget` L5468; `TextListOptions` L5475; `TextStyleOverrideType` L5508; `StyledTextSegment` L5511; `TextPathStartData` L5638.
- `VariableBindableNodeField` (incl. `characters`) L6910; `VariableBindableTextField` L6938.
- `layoutSizingHorizontal/Vertical` (HUG valid on text) L7434–7442; `resize`/`resizeWithoutConstraints` missing-font caution ~L7444–7472; `rescale` L7482; `targetAspectRatio` (not with auto-resizing text) ~L7490–7524; `counterAxisAlignItems` BASELINE L7919/L7991.
- `BaseNonResizableTextMixin` L9709 (fontSize ≥ 1, fontName, fontWeight, textCase, openTypeFeatures defaults, letterSpacing, hyperlink, characters, insertCharacters/deleteCharacters, range getters/setters, getStyledTextSegments); `NonResizableTextMixin` L10116 (paragraphIndent, paragraphSpacing, textWrapStyle, listSpacing, hangingPunctuation, hangingList, decoration sub-properties, lineHeight, leadingTrim, list/indentation range APIs); `TextSublayerNode` L10403.
- `TextNode` L10944 (textAlignHorizontal/Vertical, textAutoResize incl. deprecated TRUNCATE, textTruncation, maxLines, autoRename, textStyleId); `TextPathNode` L11016.
- `TextStyle` L12529.

Figma REST API types `@figma/rest-api-spec` **v0.44.0** — `dist/api_types.ts`:
- `TypePropertiesTrait` L677 (characters, style, characterStyleOverrides, styleOverrideTable, lineTypes, lineIndentations, layoutVersion); `TextPathPropertiesTrait` L727; `TextNode` L1055; `TextPathNode` L1064; `Hyperlink` L2195; `BaseTypeStyle` L2212 (fontPostScriptName, italic, fontWeight, opentypeFlags, semanticWeight, semanticItalic); `TypeStyle` L2291 (lineHeightPx, lineHeightPercent [deprecated], lineHeightPercentFontSize, lineHeightUnit PIXELS/FONT_SIZE_%/INTRINSIC_%, isOverrideOverTextStyle, boundVariables); `counterAxisAlignItems` incl. BASELINE L422.

Previous prototype context (not copied): `old/docs/figma/source-catalog.md` (Text and typography section, 14 articles), `old/docs/figma/feature-guide.md` §11, `old/docs/figma/observations/2026-09-27-live-figma.md` ([OBS]: baseline control disabled in a vertical auto-layout container).

### 9.2 Official Figma Help Center articles (catalog IDs; bodies **not** read — only search excerpts where tagged "excerpt")

| ID | Title | Use in this spec |
| --- | --- | --- |
| 360039956434 | Guide to text in Figma Design | excerpt: T shortcut; multi-edit text (Enter/Return or "Multi-edit text") |
| 27378154668951 | Adjust text dimensions and resizing | excerpt: three resizing modes; click = Auto width; manual resize → Fixed size; control in Layout section |
| 360039956634 | Explore text properties | excerpt: sections for letter spacing, line height, paragraph spacing (TOC only) |
| 360040449773 | Create bulleted and numbered lists | excerpt: auto-detect markers, ⌘⇧8/⌘⇧7, ⌘Z after auto-list, 5 levels, ⌘]/Tab, Backspace/Return rules, counter format rotation, list spacing default 0, "Hanging quotes"/"Hanging lists" TOC entries |
| 360045942953 | Add links to text | excerpt: link via shortcut, paste URL onto selection, links to frames/pages |
| 4913951097367 | Use OpenType features | excerpt: Details tab, Letterforms/Stylistic sets/Character variants/Horizontal spacing, greyed-out unsupported, hover preview |
| 5579502031511 | Use variable fonts | excerpt: standard axes + custom axes, variable fonts ≠ variables |
| 360039956894 | Add a font to Figma | excerpt: desktop app includes font helper; collaborators can preview but must install to edit |
| 360039956994 | (Missing fonts / font conflicts article; ID from search) | excerpt: missing-font icons, modal, Replace fonts for whole file, source priority |
| 360040451453 | Scale layers while maintaining proportions | excerpt: Scale tool (K) changes bounds and font size together |
| 360041308034 | Browse and apply fonts | not read; reference for the font picker (§3.10) |
| 360039957034 | Create and apply text styles | not read; reference for §3.20 |
| 360039957174 | Add emojis and smart symbols to text | not read; reference for §3.4 |
| 4972283635863 | Add right-to-left text | not read; reference for §3.31 |
| 360040449673 | Add text in Chinese, Japanese, and Korean | not read; reference for §3.4/§3.31 |
| 360040449513 | Use icon fonts | not read; reference for §3.19 |
| 360047239073 | Convert text to vector paths | not read; reference for §3.27 |
| 360040451373 | Explore auto layout properties (#Text_baseline_alignment) | linked from the typings' BASELINE doc comment |

### 9.3 Other web sources (search excerpts only)

- Figma blog, "Getting to the bottom of line height in Figma": https://www.figma.com/blog/line-height-changes/
- Figma variable fonts page: https://www.figma.com/typography/variable-fonts/
- Plugin API docs/changelog: https://developers.figma.com/docs/plugins/api/TextWrapStyle/ · https://developers.figma.com/docs/plugins/updates/2026/08/14/version-1-update-134/ · https://developers.figma.com/docs/plugins/updates/2024/12/19/version-1-update-106/ · https://developers.figma.com/docs/plugins/api/properties/TextNode-maxlines/
- Figma forum: link shortcut ⌘⇧U https://forum.figma.com/ask-the-community-7/ui3-feedback-create-link-shortcuts-cmd-ctrk-k-cmd-ctrl-v-not-working-30909 · Esc commits text https://forum.figma.com/suggest-a-feature-11/make-ux-of-esc-key-more-consistet-cancel-or-submit-10446 · Enter to edit https://forum.figma.com/report-a-problem-6/can-t-edit-the-text-layer-while-double-clicking-the-text-layer-or-any-kind-of-text-28005 · text wrap launch https://forum.figma.com/product-updates-3/get-responsive-text-across-screens-with-new-text-wrap-styles-56992 · underline styles https://forum.figma.com/suggest-a-feature-11/dotted-dashed-etc-underlines-text-decoration-style-support-36309 · truncation rules https://forum.figma.com/t/rules-of-text-truncate/22408 · max lines missing report https://forum.figma.com/report-a-problem-6/no-way-to-set-max-lines-for-truncate-text-50687 · truncation & styles/hug https://forum.figma.com/ask-the-community-7/truncate-text-not-changeable-when-turned-into-style-3300 · hanging punctuation https://forum.figma.com/suggest-a-feature-11/include-asterisks-when-hanging-punctuation-19920 · hanging indents/negative indent https://forum.figma.com/suggest-a-feature-11/allow-all-kinds-of-hanging-indents-13126 · two-digit list numbers https://forum.figma.com/t/is-there-a-way-to-make-a-numbered-list-without-a-hanging-indent/56402.rss · ⌘[ decrease indentation conflict https://forum.figma.com/report-a-problem-6/keyboard-shortcut-send-backwards-overlapping-with-decrese-indentation-51642 · line-height shortcut https://forum.figma.com/suggest-a-feature-11/fix-line-height-shortcut-behavior-23443 · missing fonts / recompute layout / select same font https://forum.figma.com/report-a-problem-6/can-t-edit-existing-text-54712 · https://forum.figma.com/report-a-problem-6/missing-fonts-issue-54365 · variable-font style label https://forum.figma.com/ask-the-community-7/how-do-i-disable-variable-font-axes-option-in-font-style-dropdown-15610 · italic axis https://forum.figma.com/t/variable-fonts-italic-axis/63353 · typography variables launch https://forum.figma.com/suggest-a-feature-11/launched-typography-variables-font-size-font-weight-and-style-24920 · text on a path https://forum.figma.com/suggest-a-feature-11/make-text-follow-a-path-or-a-circle-34880 · vertical trim vs CSS https://forum.figma.com/report-a-problem-6/text-layer-height-and-vertical-trim-do-not-map-clearly-to-browser-css-line-boxes-57490
- Third-party: shortcuts https://www.raycast.com/arturdz/figma-shortcuts · https://linuru.com/figma/ · https://www.devlinpeck.com/downloads/figma-keyboard-shortcuts.pdf · vertical trim https://bejamas.com/blog/everything-you-need-to-know-about-figma-s-vertical-trim-feature · https://blog.logrocket.com/ux-design/vertical-trim-figma/ · https://ics.media/en/entry/250319/ · truncation guides https://bringyourownlaptop.com/blog/truncate-text-responsive-ui-figma · https://app.uxcel.com/lessons/working-with-texts-in-figma-889/text-truncation-and-max-lines-3569 · lists https://uxcel.com/lessons/lists-paragraphs-in-figma-431 · underline launch https://alternativeto.net/news/2024/11/figma-adds-customization-options-for-underlines · text on path 2026 https://www.createwith.com/tool/figma/updates/figma-ships-text-on-path-tool-and-auto-layout-to-draw-mode · variable fonts https://www.thomasphinney.com/tag/variable-fonts/ · typography variables https://uxdesign.cc/set-up-typography-variables-in-figma-359cfea88b68 · https://frontendmasters.com/blog/figma-typography-variables/ · fonts https://designbeep.com/2026/04/26/how-to-add-fonts-to-figma/ · text properties https://designcode.io/figma-handbook-text-properties-and-styles/ · baseline alignment https://uxdesign.cc/ultimate-guide-to-baseline-aligment-using-figmas-auto-layout-3f2f99f976e9

### 9.4 Search log note

About 20 WebSearch queries (standard mode) were made for this area: text resizing, text properties, lists, links, truncation/max lines, vertical trim, Balance/Pretty, line-height model, shortcuts, OpenType, variable fonts, missing fonts, adding fonts, typography variables, underline styles, text on a path, Scale tool, hanging punctuation, text editing keys. Further queries (text-style semantic overrides, multi-edit details, smart symbols, auto-layout baseline alignment) were refused because the run-wide search budget was exhausted; those topics rest on `[API]`/`[KNOW]` and are covered by §8 experiments.
