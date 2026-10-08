# Prototyping, interactions & presentation — Figma parity spec

> **Status:** research draft (date 2026-10-08). **Nothing implemented.** Every checklist item in §6 is status **Not started**. No item may be called "1:1 parity" until it is implemented in Illigma **and** validated against live Figma with the test written in the item (and, where flagged, the experiment in §8).
>
> **Precedence:** Figma is the source of truth for all behavior, data and workflow in this document. Framer is the source of truth only for how the editor and player *look*; this document specifies behavior, never styling.
>
> **Evidence legend** (every behavioral claim carries at least one tag):
> - **[API]** — Figma Plugin API typings v1.141.0 (`plugin-api.d.ts`) or Figma REST API types v0.44.0 (`api_types.ts` / `openapi.yaml`). Line references are in §9.
> - **[DOC:&lt;id&gt;]** — official Figma Help Center article; **"excerpt"** means only a WebSearch summary/excerpt of the article was seen, not the article body. No article body was read in this session (help.figma.com is DNS-blocked here).
> - **[OBS]** — the 2026-09-27 read-only live-Figma UI observation (`old/docs/figma/observations/2026-09-27-live-figma.md`). It covers the editor shell only; it did **not** exercise any prototype behavior.
> - **[KNOW]** — the author's own product knowledge, **not verified in this session**. Every [KNOW] claim that affects correctness is repeated in §8.
> - **[SRC:&lt;url&gt;]** — other web sources (forum posts, third-party tutorials, an unverified Help Center mirror) seen only as search excerpts.
>
> **Research limits (honest disclosure).** The shared per-turn WebSearch budget for this workflow was exhausted after 14 queries by this author. Topics that therefore could **not** be confirmed by search and rest only on [API] and [KNOW]: videos in prototypes, variable modes in prototypes, the "State management for prototypes" article body, sections in prototyping, accessible prototypes, offline presentation, connections from main components, viewing connections, animated GIFs, and the exact keyboard shortcuts of presentation view. No live Figma session, video or article body was inspected.

---

## 1. Scope & terminology

### 1.1 Terms (Figma's words; Illigma uses the same words in UI and code)

| Figma term | Meaning | Data name | Evidence |
| --- | --- | --- | --- |
| **Prototype tab** | Right-sidebar tab (next to *Design*) holding all prototype settings for the current selection or page. | — (UI) | [OBS] [DOC:360039832014 title] |
| **Interaction** | One *trigger* plus an ordered list of *actions* on a layer. The UI says "interaction"; the API calls it a *Reaction*. | `Reaction {trigger, actions}` | [API] |
| **Trigger** | The user/system event that starts an interaction (On click, While hovering, After delay, Key/Gamepad, …). | `Trigger.type` | [API] [DOC:360040035834 excerpt] |
| **Action** | What happens (Navigate to, Open overlay, Set variable, Conditional, …). | `Action.type`, `Action.navigation` | [API] [DOC:360040035874 excerpt] |
| **Connection / "noodle"** | The on-canvas arrow from a hotspot to a destination, drawn only in the Prototype tab. | derived from `destinationId` | [KNOW] |
| **Hotspot** | The layer that owns an interaction; the area that reacts in the player. | node with `reactions.length>0` | [DOC:360040035834 excerpt] [KNOW] |
| **Top-level frame / screen** | A frame (or group/component/instance) placed directly on the page canvas or inside a section; the unit the prototype navigates between. | parent is `PAGE` or `SECTION` | [API] (`prototypeStartNode` types) [KNOW] |
| **Destination** | The target node of a node action (a top-level frame, a layer to scroll to, or a variant). | `destinationId` | [API] |
| **Flow / flow starting point** | A named entry point on a top-level frame; the flow is every frame reachable from it through connections. | `PageNode.flowStartingPoints[] {nodeId,name}` | [API] [DOC:360039823894 excerpt] |
| **Overlay** | A top-level frame opened *on top of* the current screen. Its presentation settings live on the overlay frame itself. | `overlayPositionType`, `overlayBackground`, `overlayBackgroundInteraction` | [API] [DOC:360039818254 excerpt] |
| **Base screen** | The current non-overlay screen beneath any overlays. | runtime | [KNOW] |
| **Animation / transition** | How the change is animated (Instant, Dissolve, Smart animate, Move in/out, Push, Slide in/out). "Instant" = no transition. | `Transition` or `null` | [API] [DOC:360040522373 excerpt] |
| **Easing / curve** | Timing function of a transition: cubic-bezier presets, custom bezier, spring presets, custom spring. | `Easing` | [API] [DOC:360051748654 excerpt] |
| **Smart animate** | Transition that matches layers between source and destination and interpolates their properties. | `SMART_ANIMATE` or `matchLayers:true` | [API] [DOC:360039818874 excerpt] |
| **Overflow (scrolling)** | Whether a frame scrolls in the player (none/horizontal/vertical/both). | `overflowDirection` | [API] [DOC:360039818734 excerpt] |
| **Position when scrolling** | Per-layer "Scroll with parent" / "Fixed" / "Sticky". | REST `scrollBehavior`; Plugin `numberOfFixedChildren` | [API] [DOC:360039818734 excerpt] |
| **State memorization / sharing** | Since 2023-05-24 Figma remembers scroll (and component) state per screen and shares it between screens with matching names. | NODE action `reset*` flags | [API] [DOC:360051747774 excerpt] |
| **Interactive component** | Interactions authored *between variants* of a component set; every instance carries them. | reactions on variant `COMPONENT`s with `CHANGE_TO` | [API] [DOC:360061175334 excerpt] |
| **Presentation view** | Figma's full player. In Illigma: the **in-app player window**. | runtime | [DOC:360040318013 excerpt] |
| **Inline preview** | Small player docked on the canvas (Shift+Space). | runtime | [DOC:360040318013 excerpt] [SRC] |
| **Device** | Page-level device frame / viewport used by the player. | REST `prototypeDevice` | [API] [DOC:21158597546391 excerpt] |
| **Prototype background** | Page-level color behind the prototype in the player. | `PageNode.prototypeBackgrounds` | [API] |
| **Hotspot hints** | Player option: clicking a non-interactive area flashes all hotspots. | player option | [SRC:help.userbrain.com] [KNOW] |
| **Expression** | Arithmetic/logic over variables usable only inside Set variable and Conditional actions. | `Expression` | [API] [DOC:15253194385943 excerpt] |

### 1.2 Terms users confuse (Illigma must keep them distinct in UI copy, code and docs)

- **While hovering** (temporary, reverts on exit; `ON_HOVER`) vs **Mouse enter** (one-way, never reverts; `MOUSE_ENTER`). Same for **While pressing** (`ON_PRESS`) vs **Mouse down** (`MOUSE_DOWN`). [API] (REST Trigger doc comment)
- **Swap overlay** (prototype action, `SWAP`) vs **Swap instance** (component editing) vs **Change to** (prototype action that switches an instance's variant at runtime, `CHANGE_TO`). [API]
- **Fixed** (position when scrolling) vs **Fixed** width/height (resizing). **Sticky** (scroll position) vs FigJam sticky notes.
- **Overflow** (player scrolling) vs **Clip content** (canvas clipping). They are separate properties. [API]
- **Flow** (prototype flow) vs auto-layout **flow** (direction). Use "prototype flow" in code identifiers.
- **Smart animate** (prototype transition) vs **Figma Motion / animated components / animation styles** (timeline animation; out of scope, see §1.4).
- **Presentation** device type (`PRESENTATION`) vs **Presentation view** (the player) vs Figma Slides.
- **Preview** (inline, in-canvas) vs **Present** (full player).
- **Back** (prototype action: history pop) vs player "previous frame" key (arrow-left; steps by page order — see §3.22).
- **Scroll to** (an action, `SCROLL_TO`) vs **Scroll animate** (`SCROLL_ANIMATE`, the transition type used by Scroll to). [API]
- **Interaction** (UI) = **Reaction** (API). Illigma code uses `reactions` for data and "interaction" in UI.

### 1.3 In scope (this document)

Prototype tab; hotspots; connections; flows & starting points; all triggers in the data model; all actions in the data model (navigate, change to, back, close overlay, open/swap overlay, scroll to, open link, set variable, set variable mode, conditional, media actions); overlays and their settings; transitions, directions, match layers; easing (bezier presets, custom bezier, spring presets, custom spring); duration; smart animate; overflow scrolling; fixed and sticky layers; state memorization/sharing/reset; interactive components; reactions on components/instances; video and GIF behavior in prototypes; device & background; the in-app player (Illigma's equivalent of presentation view) and inline preview; prototype-only variable runtime and expressions; persistence, undo, copy/paste and import mapping of prototype data.

### 1.4 Out of scope (local-first app or other areas)

| Figma feature | Why out of scope / where it goes | Evidence |
| --- | --- | --- |
| Share prototype link, permissions, password, URL parameters (`hide-ui`, `hotspot-hints`, `scaling`, `starting-point-node-id`, `disable-default-keyboard-nav`) | No cloud. The *options* those parameters control are in scope as player options; the URLs are not. | [SRC:forum.figma.com/ask-the-community-7/prototype-view-settings-when-linking-out-from-case-study-26397] |
| Comment on prototypes, Spotlight, multiplayer observation | Collaboration; not local-first. | [DOC:360039824594 title] [DOC:360040322673 title] |
| Figma mobile app mirror / "View prototypes on a mobile device" | Needs a cloud relay. P2 future idea (LAN mirror), not parity. | [DOC:360040321093 title] |
| Embedding prototypes (Slides, websites), Figma Sites, Figma Make | Other products. | — |
| **Figma Motion**: animation styles, keyframe tracks, animated components, animation export | New timeline-animation system (typings: `AnimationStyle*`, `ManualKeyframeTrack*`, `figma.motion`, `MotionEasing` with `HOLD` and `NormalizedSpring {bounce}`); separate product area. Must not be confused with prototype transitions. See §7 and open questions. | [API] [DOC:41307940738967 title] [DOC:41307983648407 title] [DOC:41414048690839 excerpt] |
| Prototype analytics, user-testing integrations (Maze etc.) | Third-party services. | — |
| Dev Mode "view prototype connections" for view-only users | Dev Mode is out of product scope; editors see connections in the Prototype tab. | [DOC:4411431245335 title] |

Local-first specifics that ARE in scope: the player runs entirely offline in an Illigma window; "Open link" goes to the OS default browser; there is no "Copy link". Figma's "Present prototypes offline" article [DOC:26463081577367 title] exists, but its content was not seen; Illigma is offline by construction.

---

## 2. Data model

All names below are Figma's (Plugin API unless noted). Illigma's document schema must store exactly these fields (plus the documented Illigma extensions) so that .fig/REST import (M8) is lossless. **Document data** is saved in the file, participates in undo/redo and copy/paste. **Runtime state** exists only inside a player session. **Editor UI state** is per-user, per-session.

### 2.1 Which nodes may carry prototype data [API]

| Node type | `reactions` (interactions) | `FramePrototypingMixin` (overflow, fixed children, overlay settings) | Can be a screen (navigate/overlay destination, flow start) |
| --- | --- | --- | --- |
| FRAME | yes | yes | yes, when top-level |
| COMPONENT (incl. variants) | yes | yes | yes, when top-level |
| INSTANCE | yes | yes | yes, when top-level |
| SLOT | yes | yes | no (always nested) |
| GROUP, TRANSFORM_GROUP | yes | no | GROUP: yes when top-level (`prototypeStartNode` type list) |
| RECTANGLE, LINE, ELLIPSE, POLYGON, STAR, VECTOR, TEXT, TEXT_PATH, BOOLEAN_OPERATION | yes | no | no |
| COMPONENT_SET | **no** (BaseFrameMixin only) | **no** | no |
| SECTION, SLICE, PAGE, DOCUMENT | **no** | **no** | no (sections contain screens) |

Source: `DefaultShapeMixin`, `DefaultFrameMixin`, `GroupNode`, `TransformGroupNode`, `ComponentSetNode`, `SlotNode`, `SectionNode`, `PageNode.prototypeStartNode` [API].

### 2.2 Node-level document properties

| Property | Type / enum | Default | Notes | Evidence |
| --- | --- | --- | --- | --- |
| `reactions` | `Reaction[]` | `[]` | Ordered list; order is shown in the Interactions list. | [API] |
| `overflowDirection` | `'NONE' \| 'HORIZONTAL' \| 'VERTICAL' \| 'BOTH'` | `'NONE'` | REST spells `HORIZONTAL_SCROLLING`, `VERTICAL_SCROLLING`, `HORIZONTAL_AND_VERTICAL_SCROLLING`, `NONE`; default `NONE`. Top-level frames scroll in the player without this property when larger than the viewport. | [API] |
| `numberOfFixedChildren` | integer ≥ 0 | `0` | Plugin model: the top-most *N* children (end of `children[]`, i.e. top of z-order) are fixed; fixed children always render above scrolling children; layers panel shows two section headers ("Fixed" / "Scrolls") when N ≥ 1. | [API] |
| `scrollBehavior` (REST, per child) | `'SCROLLS' \| 'FIXED' \| 'STICKY_SCROLLS'` | `'SCROLLS'` | REST-only per-layer field; `isFixed` is its deprecated boolean predecessor. **Illigma canonical:** store `scrollBehavior` per node and maintain the invariant that all `FIXED` children form the top-most contiguous z-order segment; derive `numberOfFixedChildren`. | [API] |
| `overlayPositionType` | `'CENTER' \| 'TOP_LEFT' \| 'TOP_CENTER' \| 'TOP_RIGHT' \| 'BOTTOM_LEFT' \| 'BOTTOM_CENTER' \| 'BOTTOM_RIGHT' \| 'MANUAL'` | `'CENTER'` [KNOW] | Stored on the overlay (destination) frame, not on the action. | [API] [DOC:360039818254 excerpt] |
| `overlayBackground` | `{type:'NONE'} \| {type:'SOLID_COLOR', color: RGBA}` | `{type:'NONE'}` [KNOW] | When the user enables "Add background behind overlay" the initial color is `#000000` at 25 % opacity. | [API] [DOC:360039818254 excerpt] |
| `overlayBackgroundInteraction` | `'NONE' \| 'CLOSE_ON_CLICK_OUTSIDE'` | `'NONE'` [KNOW] | "Close when clicking outside". | [API] [DOC:360039818254 excerpt] |

### 2.3 Page-level document properties

| Property | Type | Default | Notes | Evidence |
| --- | --- | --- | --- | --- |
| `flowStartingPoints` | `{nodeId: string, name: string}[]`, sorted | `[]` | First entry = default flow when presenting with nothing selected. Prototypes are per page. | [API] |
| `flowStartingPoints[i].description` | string | `""` | **Illigma extension**: the flow description editable in Figma's UI is not present in either typings' `FlowStartingPoint`; storage location in .fig unknown (V-05). | [SRC:pwskills.com/blog/figma-prototype] [KNOW] |
| `prototypeStartNode` / REST `prototypeStartNodeID` | node id or null | null | Deprecated single start node (pre-flows). Read-only legacy; import converts it into one flow if `flowStartingPoints` is empty. | [API] |
| `prototypeBackgrounds` | `Paint[]` (currently a single `SOLID`) | V-29 | Player background color. | [API] |
| `prototypeDevice` (REST) | `{type: 'NONE'\|'PRESET'\|'CUSTOM'\|'PRESENTATION', size?: {width,height}, presetIdentifier?: string, rotation: 'NONE'\|'CCW_90'}` | V-28 | Not exposed by the Plugin API; Illigma stores it on the page. | [API] |
| `explicitVariableModes` (page) | `{[collectionId]: modeId}` | `{}` | Authored page modes; `SET_VARIABLE_MODE` overrides them **at runtime only**. | [API] |

### 2.4 Reaction [API]

```ts
type Reaction = { trigger: Trigger | null; actions?: Action[]; /** @deprecated */ action?: Action }
```
- Illigma canonical form stores `actions` only. Import: if `actions` is absent and `action` is present, `actions = [action]`. Export (plugin-compat): write both, `action = actions[0]`.
- `trigger: null` and `actions: []` are valid persisted states (incomplete interaction; inert in the player).

### 2.5 Trigger union [API]

| `type` | Extra fields | UI label (Figma) | Semantics summary |
| --- | --- | --- | --- |
| `ON_CLICK` | — | On click / On tap | one-way |
| `ON_DRAG` | — | On drag | gesture-driven |
| `ON_HOVER` | — | While hovering | **temporary**: reverts when trigger ends |
| `ON_PRESS` | — | While pressing | **temporary** |
| `AFTER_TIMEOUT` | `timeout: number` | After delay | one-way, timer |
| `MOUSE_ENTER`, `MOUSE_LEAVE` | `delay: number`, `deprecatedVersion: boolean` | Mouse enter / Mouse leave | one-way; `deprecatedVersion:true` = legacy pre-2023-11-16 semantics |
| `MOUSE_UP`, `MOUSE_DOWN` | `delay: number` | Mouse up / Mouse down | one-way |
| `ON_KEY_DOWN` | `device: 'KEYBOARD'\|'XBOX_ONE'\|'PS4'\|'SWITCH_PRO'\|'UNKNOWN_CONTROLLER'`, `keyCodes: number[]` | Key/Gamepad | one-way |
| `ON_MEDIA_HIT` | `mediaHitTime: number` (seconds) | Video hits (time) [KNOW label] | only from a video layer |
| `ON_MEDIA_END` | — | Video ends [KNOW label] | only from a video layer |

REST doc comment: "`ON_HOVER` and `ON_PRESS` revert the navigation when the trigger is finished (the result is temporary). `MOUSE_ENTER`, `MOUSE_LEAVE`, `MOUSE_UP` and `MOUSE_DOWN` are permanent, one-way navigation. The `delay` parameter requires the trigger to be held for a certain duration of time before the action occurs. Both `timeout` and `delay` values are in milliseconds. `ON_MEDIA_HIT` and `ON_MEDIA_END` can only trigger from a video." [API]

### 2.6 Action union [API]

| `type` | Fields | Notes |
| --- | --- | --- |
| `BACK` | — | Pop navigation history. |
| `CLOSE` | — | Close overlay. |
| `URL` | `url: string`, `openInNewTab?: boolean` | `openInNewTab` exists in Plugin API only (not REST). |
| `UPDATE_MEDIA_RUNTIME` | `destinationId: string\|null`, `mediaAction: 'PLAY'\|'PAUSE'\|'TOGGLE_PLAY_PAUSE'\|'MUTE'\|'UNMUTE'\|'TOGGLE_MUTE_UNMUTE'` | `destinationId:null` ⇒ "the media node that contains the action" (openapi). |
| `UPDATE_MEDIA_RUNTIME` | `destinationId?`, `mediaAction: 'SKIP_FORWARD'\|'SKIP_BACKWARD'`, `amountToSkip: number` (seconds) | |
| `UPDATE_MEDIA_RUNTIME` | `destinationId?`, `mediaAction: 'SKIP_TO'`, `newTimestamp: number` (seconds) | |
| `SET_VARIABLE` | `variableId: string\|null`, `variableValue?: VariableData` | |
| `SET_VARIABLE_MODE` | `variableCollectionId: string\|null`, `variableModeId: string\|null` | |
| `CONDITIONAL` | `conditionalBlocks: ConditionalBlock[]` | `ConditionalBlock = {condition?: VariableData, actions: Action[]}`; a block without `condition` is the *else* block. |
| `NODE` | `destinationId: string\|null`, `navigation: Navigation`, `transition: Transition\|null`, `preserveScrollPosition?` (deprecated), `overlayRelativePosition?: Vector`, `resetVideoPosition?`, `resetScrollPosition?`, `resetInteractiveComponents?` | `transition:null` = Instant. |

`Navigation` semantics (REST doc comment) [API]:
- `NAVIGATE` — replaces the current screen with the destination, also closing all overlays.
- `OVERLAY` — opens the destination as an overlay on the current screen.
- `SWAP` — on an overlay, replaces the current (topmost) overlay with the destination; on a top-level frame behaves like `NAVIGATE` except that **no entry is added to the navigation history**.
- `SCROLL_TO` — scrolls to the destination on the current screen.
- `CHANGE_TO` — changes the **closest ancestor instance** of the source node to the specified variant.

NODE flag semantics (REST doc comments) [API]: `resetScrollPosition` — scroll offsets of scrollable elements in the current screen/overlay reset when navigating, "applicable only if the layout of both the current frame and its destination are the same"; `preserveScrollPosition` — deprecated inverse; `resetInteractiveComponents` — interactive-component states reset; `resetVideoPosition` — "all videos within the destination frame will reset their memorized playback position to 00:00 before starting to play"; `overlayRelativePosition` — for `OVERLAY` to a frame with `MANUAL` position, "the offset by which the overlay is opened relative to this node".

### 2.7 Transition [API]

```ts
interface SimpleTransition      { type: 'DISSOLVE'|'SMART_ANIMATE'|'SCROLL_ANIMATE'; easing: Easing; duration: number }
interface DirectionalTransition { type: 'MOVE_IN'|'MOVE_OUT'|'PUSH'|'SLIDE_IN'|'SLIDE_OUT';
                                  direction: 'LEFT'|'RIGHT'|'TOP'|'BOTTOM'; matchLayers: boolean; easing: Easing; duration: number }
type Transition = SimpleTransition | DirectionalTransition   // null on the action = Instant
```
REST: "When the transition type is SMART_ANIMATE or when matchLayers is true, the transition will be performed using smart animate." [API]

### 2.8 Easing [API]

```ts
interface Easing { type: 'EASE_IN'|'EASE_OUT'|'EASE_IN_AND_OUT'|'LINEAR'|'EASE_IN_BACK'|'EASE_OUT_BACK'|'EASE_IN_AND_OUT_BACK'
                        |'CUSTOM_CUBIC_BEZIER'|'GENTLE'|'QUICK'|'BOUNCY'|'SLOW'|'CUSTOM_SPRING';
                   easingFunctionCubicBezier?: {x1,y1,x2,y2}; easingFunctionSpring?: {mass, stiffness, damping, initialVelocity} }
```
- REST `easingFunctionSpring` has only `mass, stiffness, damping` (no `initialVelocity`) → import default `initialVelocity = 0`.
- REST descriptions [API]: EASE_IN ≈ CSS ease-in; EASE_OUT ≈ CSS ease-out; EASE_IN_AND_OUT ≈ CSS ease-in-out; LINEAR ≈ CSS linear; EASE_IN_BACK "moves past the initial keyframe's value and then accelerates as it reaches the end"; EASE_OUT_BACK "starts fast, then slows and goes past the ending keyframe's value"; EASE_IN_AND_OUT_BACK overshoots both ends; GENTLE "similar to react-spring"; QUICK "great for toasts and notifications"; BOUNCY "for delightful animations like a heart bounce"; SLOW "a steady, natural way to scale up fullscreen content".

Numeric preset values (all **[KNOW]**, must be confirmed by V-14/V-15):

| Preset | Kind | Parameters |
| --- | --- | --- |
| EASE_IN | bezier | (0.42, 0, 1, 1) |
| EASE_OUT | bezier | (0, 0, 0.58, 1) |
| EASE_IN_AND_OUT | bezier | (0.42, 0, 0.58, 1) |
| LINEAR | bezier | (0, 0, 1, 1) |
| EASE_IN_BACK | bezier | (0.3, −0.05, 0.7, −0.5) |
| EASE_OUT_BACK | bezier | (0.45, 1.45, 0.8, 1) |
| EASE_IN_AND_OUT_BACK | bezier | (0.7, −0.4, 0.4, 1.4) |
| GENTLE | spring | mass 1, stiffness 100, damping 15 |
| QUICK | spring | mass 1, stiffness 300, damping 20 |
| BOUNCY | spring | mass 1, stiffness 600, damping 15 |
| SLOW | spring | mass 1, stiffness 80, damping 20 |

### 2.9 Prototype variable data [API]

```ts
type VariableDataType = 'BOOLEAN'|'COLOR'|'EASING'|'EXPRESSION'|'FLOAT'|'STRING'|'TIMING'|'VARIABLE_ALIAS'
interface VariableData { type?: VariableDataType; resolvedType?: VariableResolvedDataType; value?: VariableValue | Expression }
interface Expression { expressionFunction: ExpressionFunction; expressionArguments: VariableData[] }
type ExpressionFunction = 'ADDITION'|'SUBTRACTION'|'MULTIPLICATION'|'DIVISION'|'EQUALS'|'NOT_EQUAL'|'LESS_THAN'
  |'LESS_THAN_OR_EQUAL'|'GREATER_THAN'|'GREATER_THAN_OR_EQUAL'|'AND'|'OR'|'VAR_MODE_LOOKUP'|'NEGATE'|'NOT'
```
- REST `VariableDataType` lacks `EASING`/`TIMING` (these belong to Figma Motion variables; prototype actions only use BOOLEAN/FLOAT/STRING/COLOR) [API].
- Expressions are only valid inside `SET_VARIABLE.variableValue` and `ConditionalBlock.condition`; a variable's stored value can never be an expression (see 08-variables-styles-design-systems.md §2.9) [API].

### 2.10 Video data relevant to prototypes [API]

- `VideoPaint {type:'VIDEO', scaleMode, videoHash, videoTransform?, scalingFactor?, rotation?, filters?, visible?, opacity?, blendMode?}`. **No playback fields** (autoplay/loop/mute) exist in the typings; where Figma stores video playback settings is unknown (V-24). Illigma must not invent document fields before V-24 resolves; provisional Illigma extension: `VideoPaint.playback = {autoplay, loop, muted}` marked experimental.
- `createVideoAsync`: data must be .MP4, .MOV or .WebM, maximum 100 MB [API].

### 2.11 Time units (normative for Illigma)

| Field | Plugin API | REST | Illigma storage |
| --- | --- | --- | --- |
| `Transition.duration` | **seconds** (doc example shows `0.20000000298023224` = float32 0.2) | **milliseconds** (openapi) | seconds (float64); UI shows integer ms |
| `AFTER_TIMEOUT.timeout`, `MOUSE_*.delay` | unit not stated in typings (V-01) | milliseconds | seconds until V-01 proves otherwise; UI shows integer ms |
| `mediaHitTime`, `amountToSkip`, `newTimestamp` | seconds | seconds | seconds |

Import from REST divides ms by 1000. UI display rounds to the nearest integer ms; editing writes `ms/1000` exactly (no float32 artifacts introduced by Illigma).

### 2.12 Runtime state (player session only; never saved, never in undo history)

```ts
interface PlayerSession {
  pageId: string; flowStartId: string | null
  history: HistoryEntry[]            // navigation stack (NAVIGATE and OVERLAY push; SWAP does not)
  baseScreenId: string
  overlays: OverlayInstance[]        // bottom→top; each {frameId, rect, openedBy, transition, settingsSnapshot}
  variableValues: Map<variableId, ResolvedValue>      // runtime overrides of authored values
  pageModeOverrides: Map<collectionId, modeId>        // from SET_VARIABLE_MODE
  instanceVariant: Map<instancePath, variantId>       // interactive component state
  scrollMemory: Map<stateKey, Map<layerPath, {x,y}>>  // see §3.17
  videoState: Map<layerPath, {time, playing, muted}>
  temporaryStack: TemporaryActivation[]               // active While hovering / While pressing effects
  timers: Timer[]                                     // AFTER_TIMEOUT, MOUSE_* delays
  options: PlayerOptions                              // per-user preference, see 2.13
}
```

### 2.13 Editor UI state (per user; not document data)

Active right-sidebar tab (Design/Prototype); selected connection; noodle drag in progress; Interaction details panel open/anchored; inline preview open/size/position; player options (scaling mode, show hotspot hints on click, show device frame, respect aspect ratio, hide UI, disable default keyboard navigation, sidebar visible). Player options persist per user (app preferences), not in the file.

---

## 3. Behavior specification

### 3.1 Prototype tab and prototype editing mode

1. The right sidebar has **Design** and **Prototype** tabs [OBS]. Selecting Prototype enters prototype editing: connection handles and noodles are drawn on the canvas; switching back to Design hides them. Design-tab editing never changes `reactions` [KNOW].
2. Sections shown in the Prototype tab depend on selection [KNOW] [DOC:21158597546391 excerpt] [DOC:360039823894 excerpt]:
   - **Nothing selected:** Device (type, model/size, rotation), Background, Flows list.
   - **Top-level frame selected:** Flow starting point, Interactions, Scroll behavior (Overflow, plus Position when the frame is nested), Overlay settings when the frame is used as an overlay destination.
   - **Nested layer selected:** Interactions; Scroll behavior → Position (Scroll with parent / Fixed / Sticky); Overflow if the layer is frame-like.
   - **Section / slice / component set:** no Interactions section (these nodes have no `reactions`) [API].
3. Multi-selection: if all selected layers have identical `reactions`, the list is shown and edits apply to all; otherwise a mixed state is shown and adding an interaction adds it to every selected layer (V-03) [KNOW].

### 3.2 Hotspots and screens

- **Screen eligibility.** A screen is a node whose parent is the page or a section (sections may nest) and whose type is FRAME, GROUP, COMPONENT or INSTANCE (`prototypeStartNode` type list) [API] [KNOW]. Frames nested inside other frames are never screens.
- **Hotspot eligibility.** Any node type with `reactions` (table 2.1) inside a screen, or the screen itself [API].
- **Hit testing in the player** (pseudo-code; V-08 confirms the precedence rules) [KNOW]:

```ts
function hitTargets(point, screenStack): Node[] {
  // screenStack = [base, ...overlays]; search topmost overlay first
  for (const layer of [...screenStack].reverse()) {
    if (isOverlay(layer) && !layer.rect.contains(point)) {
      if (layer.overlayBackgroundInteraction === 'CLOSE_ON_CLICK_OUTSIDE') return [OUTSIDE(layer)]
      if (layer.overlayBackground.type !== 'NONE') return []      // dimmed background blocks (V-11)
      continue                                                     // fall through to layers below (V-11)
    }
    const hits = renderTree(layer).nodesAt(point)                  // visible, unclipped geometry; topmost first
      .filter(n => n.visible && isEffectivelyVisibleAfterClipping(n, point))
    if (hits.length) return hits  // deepest topmost node first; ancestors follow (bubbling order)
  }
  return []
}
function dispatch(eventTriggerType, point) {
  for (const node of hitTargets(point, stack)) {
    for (const n of selfAndAncestorsWithinScreen(node)) {
      const r = n.reactions.find(r => r.trigger?.type === eventTriggerType)
      if (r) { run(r, n); return }          // first (deepest) handler wins; no further bubbling
    }
  }
  if (eventTriggerType === 'ON_CLICK' && options.showHotspotHints) flashHotspots()
}
```
- Hidden layers (`visible:false`) are not hotspots. Layers at 0 % opacity are still hotspots [KNOW]. Locked layers are interactive in the player [KNOW]. Clipped-away parts of a layer are not hit [KNOW]. Hit area is the layer's geometry bounds in its transformed (rotated) space (V-08).

### 3.3 Connections (authoring)

1. With a layer selected in the Prototype tab, hovering it shows a circular **connection handle** on its right edge; dragging from it draws a noodle following the pointer [KNOW].
2. While dragging, the screen under the pointer is highlighted as drop target; dropping anywhere on a screen (including over its children) targets that **screen** [KNOW].
3. Dropping on a screen creates `{trigger:{type:'ON_CLICK'}, actions:[{type:'NODE', navigation:'NAVIGATE', destinationId:<screen>, transition:<default>}]}`. Default transition for new connections: V-04 (candidates: `null`/Instant, or the last-used animation) [KNOW].
4. Dropping between two variants of the same component set creates a `CHANGE_TO` action instead of `NAVIGATE` [SRC:smashingmagazine.com/2021/07/introduction-figma-interactive-components/] [DOC:360061175334 excerpt].
5. Dropping on empty canvas cancels a new connection (nothing created) [KNOW]. Dragging the arrow end of an *existing* connection to another screen retargets it, keeping trigger/animation; dropping it on empty canvas removes the connection (V-02) [KNOW].
6. Clicking a noodle selects that interaction and opens Interaction details; Delete/Backspace removes it [KNOW].
7. Only screens on the **current page** can be destinations; the destination dropdown lists the page's screens (with search) [API: "prototypes are per-page"] [KNOW].
8. Actions without a destination (`BACK`, `CLOSE`, `URL`, `SET_VARIABLE*`, `CONDITIONAL`, media actions) draw no noodle [KNOW]; `SCROLL_TO` draws a noodle to the target layer inside the same screen (V-02).
9. **Auto flow:** "When you add a connection between two frames with no existing connections, Figma will create a starting point on the top-level frame where the connection started." [DOC:360039823894 excerpt]
10. Several interactions may exist on one layer; using the same trigger twice on one layer produces a conflict warning and only one fires (V-06) [KNOW].
11. Creating a connection with several layers selected creates the same interaction on each (V-03) [KNOW].
12. Every authoring step (create, retarget, delete, edit field) is exactly one undo step [KNOW].

### 3.4 Flows and starting points

- A flow starting point lives on a top-level frame; a frame can have only one; flows are listed in `PageNode.flowStartingPoints` in panel order; the first is the default [API] [DOC:360039823894 excerpt].
- Add: Prototype tab → Flow starting point "+" on a selected screen; right-click → "Add starting point"; duplicating a frame that has one [DOC:360039823894 excerpt]. New names follow "Flow 1", "Flow 2", … (lowest unused N, V-05) [KNOW]; the name field is auto-focused for typing [SRC:forum.figma.com/t/auto-focus-flow-starting-points-name-at-creation/39496].
- Rename (inline), description (edit icon), remove ("−"/delete) [SRC:pwskills.com/blog/figma-prototype] [SRC:forum.figma.com/t/cant-remove-flows/25184].
- With nothing selected the Flows list shows every flow; hovering a flow offers "Select frame" [DOC:360039823894 excerpt]; each flow has a present (play) affordance [KNOW].
- On canvas, a screen with a starting point shows a badge with a play icon and the flow name [DOC:360039823894 excerpt ("blue preview icon and the flow name")]; activating it presents that flow [KNOW].
- Membership: a flow consists of every frame reachable from its starting point via interactions; frames can belong to multiple flows [DOC:360039823894 excerpt].
- Deleting a screen removes its starting point; undo restores both [KNOW].

### 3.5 Triggers

| Trigger | Rule | Evidence |
| --- | --- | --- |
| On click | Fires on primary-button release over the same hotspot that received the press, if pointer travel stayed below the drag threshold (V-07). Labelled "On tap" for touch devices. | [DOC:360040035834 excerpt] [KNOW] |
| On drag | Fires when a drag gesture starts on the hotspot; any direction. With animated transitions the progress follows the pointer ("moves the user back and forward through the transition"); on release the transition completes or reverts (rule V-09). Drag on a hotspot inside a scroll container takes precedence over scrolling (V-09). | [DOC:360040035834 excerpt] [KNOW] |
| While hovering | Applies its actions when the pointer enters; reverts when the pointer leaves ("moving the cursor off the hotspot sends the user back to the original frame"). Not available on touch. | [DOC:360040035834 excerpt] [API] |
| While pressing | Applies while the primary button is held; reverts on release. | [DOC:360040035834 excerpt] [API] |
| Mouse enter | Since 2023-11-16 fires **once** when the cursor first crosses into the hotspot. Legacy interactions were relabelled ("Mouse move inside") and kept working; they cannot be newly created. `deprecatedVersion:true` marks them. `delay` = pointer must stay inside for `delay` before firing (V-10). | [SRC:help.figma.com/hc/en-us/articles/360040035834 excerpt via search] [API] |
| Mouse leave | Mirror of Mouse enter: fires once on first exit; legacy = "Mouse move outside". | same |
| Mouse down / Mouse up | One-way; fire on press / on release over the hotspot; `delay` semantics V-10. | [API] |
| After delay | Fires once after the containing screen (or overlay, or variant) has been shown for `timeout`; offered only for top-level frames / variants (V-12). Default 800 ms [KNOW]. | [SRC:uxdesign.cc/prototyping-with-figma-interactions-228dbc82fe00] [KNOW] |
| Key/Gamepad | Fires on key-down when all keys in `keyCodes` are down; `device` selects keyboard or a controller family. Scope: the current screen and its overlays regardless of pointer position (V-13). | [API] [SRC:uxdesign.cc] [KNOW] |
| Video hits time | Only on layers with a video fill; fires when playback crosses `mediaHitTime` seconds. | [API] |
| Video ends | Only on video layers; fires when playback reaches the end. Interaction with looping V-24. | [API] |

Temporary-trigger revert algorithm [API semantics] [KNOW details]:
```ts
onTemporaryStart(r, hotspot):          // ON_HOVER enter / ON_PRESS down
  snapshot = captureRevertableState()  // screen, overlays, instance variants affected
  apply(r.actions)
  temporaryStack.push({r, hotspot, snapshot})
onTemporaryEnd(hotspot):               // pointer leave / button up
  t = temporaryStack.popFor(hotspot)
  restore(t.snapshot, reverseOf(t.r.actions[*].transition))   // reverse animation
```
Which action types are allowed under While hovering / While pressing (Navigate, Change to, Open overlay, Swap overlay are expected; Set variable etc. unknown) is V-12.

### 3.6 Actions

- **Navigate to** — replace the base screen, close all overlays, push history. Uses the chosen transition. [API] [DOC:360040035874 excerpt]
- **Back** — pop one history entry and return to it, playing the reverse of the transition that led forward (V-16) [DOC:360040035874 excerpt] [KNOW]. At the history root it does nothing [KNOW].
- **Change to** — only offered when the hotspot is inside a variant of a component set; `destinationId` is a sibling variant; at runtime the **closest ancestor instance** of the hotspot switches to that variant (runtime-only) [API] [SRC:smashingmagazine.com]. Transitions offered: V-17.
- **Scroll to** — destination is any layer inside the current screen (including inside nested scroll containers); the prototype or the nested scrollable container scrolls so the destination comes into view [DOC:360040035874 excerpt]. Algorithm below. Other screens/pages are not valid targets [SRC:forum.figma.com/t/link-to-section-from-other-screen/67252]. Animation: Instant (`transition:null`) or `SCROLL_ANIMATE` with easing+duration [API]. Whether an X/Y offset is offered: V-18 (no offset field exists in the data model [API]).
- **Open link** — opens `url`; external sites show a "leaving Figma" notice [DOC:360040035874 excerpt]. `openInNewTab` [API]. Illigma: always opens in the OS default browser after a confirmation the first time per session (local-first adaptation; `openInNewTab` is persisted but has no effect).
- **Open overlay** — opens destination as overlay above the current stack; pushes history [DOC:360040035874 excerpt] [API]. Smart animate is not supported for open overlay [DOC:360040522373 excerpt].
- **Swap overlay** — from inside an overlay, replaces the topmost overlay; "the replacement takes over the old overlay's settings"; bypasses history so Back will not step between swapped overlays; from a base screen acts like Navigate to without a history entry [DOC:360040035874 excerpt] [API]. Smart animate between swapped overlays with matching layers is supported [DOC:360040522373 excerpt]. The new overlay keeps the old overlay's position [SRC:forum.figma.com/suggest-a-feature-11/swap-overlay-and-set-a-different-position-1653].
- **Close overlay** — removes the overlay(s) above the base screen [DOC:360040035874 excerpt]; exact scope (topmost only vs the overlay containing the hotspot vs all) is V-19 [KNOW: topmost / containing].
- **Set variable / Set variable mode / Conditional** — §3.8–3.10.
- **Video actions** — play, pause, toggle, mute, unmute, toggle mute, jump forward/backward by N s, jump to time [API] [DOC:360040035874 excerpt (list headings only)].

Scroll-to algorithm [KNOW; V-18]:
```ts
function scrollTo(dest, transition) {
  for (const c of scrollableAncestors(dest)) {          // innermost first, up to the screen viewport
    const target = clampToScrollRange(c, offsetOf(dest, inContentOf=c))   // align dest top-left to c's viewport top-left
    animateScroll(c, c.scroll, target, transition)      // instant if transition === null
  }
}
```

### 3.7 Multiple actions & execution model

- One trigger may hold an unlimited number of actions; they run in list order top-to-bottom; reorder by dragging; any action can be dragged into a Conditional [DOC:15253220891799 excerpt].
- "If you have multiple animations on a trigger, they run sequentially." Order changes outcomes (e.g. set-variable-then-check vs check-then-set) [DOC:15253220891799 excerpt].
```ts
async function run(reaction, hotspot) {
  for (const a of reaction.actions) await exec(a, ctx(hotspot))   // awaits animated navigations (sequential)
}
async function exec(a, ctx) {
  switch (a.type) {
    case 'CONDITIONAL': {
      for (const b of a.conditionalBlocks) {
        if (b.condition === undefined || toBool(evaluate(b.condition))) { for (const x of b.actions) await exec(x, ctx); return }
      }
      return
    }
    case 'SET_VARIABLE': setRuntime(a.variableId, coerce(evaluate(a.variableValue), typeOf(a.variableId))); rerender(); return
    case 'SET_VARIABLE_MODE': pageModeOverrides.set(a.variableCollectionId, a.variableModeId); rerender(); return
    case 'NODE': return navigate(a, ctx)            // awaits transition completion
    case 'BACK': return back(); case 'CLOSE': return closeOverlay(ctx)
    case 'URL': return openExternal(a.url); case 'UPDATE_MEDIA_RUNTIME': return media(a, ctx)
  }
}
```
- Context after a navigation: subsequent actions still resolve variables globally; whether a later `CHANGE_TO`/`SCROLL_TO` in the same list targets the new screen is V-20 [KNOW].
- Re-entrancy: input arriving while an action list is mid-animation is V-21 (candidate: queued after completion).

### 3.8 Conditionals

- If/else; the If field takes a boolean expression; true → if-actions, false → else-actions [DOC:15253220891799 excerpt]. Invalid statements are outlined in red [DOC:15253220891799 excerpt].
- Data model allows N blocks (`conditionalBlocks[]`, each optional `condition`) and nested `CONDITIONAL` inside blocks [API]. A 2024 forum report says the UI did not allow a Conditional inside then/else, and no else-if [SRC:forum.figma.com/t/validating-two-variables-nested-conditionals/47658/2] [SRC:forum.figma.com/t/we-could-use-if-else-if-else-statements/54298]. **Illigma rule:** the runtime executes any structure the data model allows (import fidelity); the authoring UI matches current Figma (V-22).
- Separate stacked Conditional actions are each evaluated in turn, seeing state changed by earlier actions [SRC:forum.figma.com/t/we-could-use-if-else-if-else-statements/54298].
- Conditionals only evaluate when a trigger fires; there is no reactive "watch" [SRC:forum report 2024, via search excerpt].

### 3.9 Expressions

Operators per [DOC:15253194385943 excerpt]:

| Kind | Operators | Data mapping [API] |
| --- | --- | --- |
| String | `+` (append) | ADDITION with string operands |
| Number | `+ - * /` | ADDITION, SUBTRACTION, MULTIPLICATION, DIVISION |
| Comparison (→ boolean) | `== != > < >= <=` | EQUALS, NOT_EQUAL, GREATER_THAN, LESS_THAN, GREATER_THAN_OR_EQUAL, LESS_THAN_OR_EQUAL |
| Logical | `and`, `or` | AND, OR |
| Unary | (UI exposure unknown, V-23) | NOT, NEGATE |
| Mode lookup | (UI exposure unknown, V-23) | VAR_MODE_LOOKUP |

- Expressions are allowed in Set variable for number, string and boolean targets (not color) and in Conditional [DOC:15253194385943 excerpt]. Operands: boolean/number/string literals and boolean/string/number variables [DOC:15253194385943 excerpt]. Library variables may be read in expressions but cannot be the *target* of Set variable [SRC:forum.figma.com/ask-the-community-7/can-t-access-published-variables-for-prototyping-33816].
- Evaluation (types and edge cases to be confirmed by V-23) [KNOW]:
```ts
function evaluate(d: VariableData): Value {
  if (d.type === 'VARIABLE_ALIAS') return resolveRuntime(d.value.id)   // runtime override → mode → alias chain
  if (d.type !== 'EXPRESSION') return d.value
  const [a, b] = d.value.expressionArguments.map(evaluate)
  switch (d.value.expressionFunction) {
    case 'ADDITION': return (isString(a) || isString(b)) ? str(a) + str(b) : num(a) + num(b)   // coercion: V-23
    case 'SUBTRACTION': return num(a) - num(b); case 'MULTIPLICATION': return num(a) * num(b)
    case 'DIVISION': return num(a) / num(b)                                              // ÷0 result: V-23
    case 'EQUALS': return eq(a, b); case 'NOT_EQUAL': return !eq(a, b)
    case 'LESS_THAN': return num(a) < num(b); /* … other comparisons … */
    case 'AND': return bool(a) && bool(b); case 'OR': return bool(a) || bool(b)
    case 'NOT': return !bool(a); case 'NEGATE': return -num(a)
    case 'VAR_MODE_LOOKUP': return lookupInMode(a, b)                                    // semantics: V-23
  }
}
```

### 3.10 Variables and modes at runtime

- Set variable changes a variable's value; bound properties update (string → text, number → size/radius/auto-layout spacing, boolean → visibility, color → paints) [DOC:14506587589399 excerpt]. Bindable node fields include `visible`, `width`, `height`, `characters`, paddings, gaps, radii, `opacity`, min/max sizes, stroke weights, grid gaps [API].
- The target must be a **local** variable [SRC:forum…33816]. A value cannot be set for one specific mode [SRC:forum.figma.com/suggest-a-feature-11/set-variable-value-for-specific-mode-36362]; Illigma: runtime override applies regardless of mode (V-25).
- **Set variable mode** "switches the mode of the current page" and affects objects whose mode is Auto [DOC:14506587589399/15253268379799 excerpt]. Nodes with an explicit mode for that collection keep it (V-25) [KNOW].
- Runtime values never write to the document. Restart (R, or reopening the player) resets all runtime values and mode overrides to the authored state [SRC:forum.figma.com/ask-the-community-7/re-start-prototype-without-re-setting-variables-29061].
- Re-render after a variable change re-runs auto layout on visible screens/overlays. Whether the change animates is V-25 (expected: instant) [KNOW].

### 3.11 Overlays

- Settings belong to the overlay frame and apply wherever it is opened; editable from the interaction details or by clicking the overlay icon shown next to the frame on canvas [DOC:360039818254 excerpt].
- **Position:** 7 presets + Manual [DOC:360039818254 excerpt]. Positioning (V-11 for edge cases):
```ts
function overlayRect(ov, viewport /* base screen visible rect in prototype space */, hotspot, action) {
  const {w, h} = ov.size
  switch (ov.overlayPositionType) {
    case 'CENTER':        return at(viewport.cx - w/2, viewport.cy - h/2)
    case 'TOP_LEFT':      return at(viewport.left, viewport.top)
    case 'TOP_CENTER':    return at(viewport.cx - w/2, viewport.top)
    case 'TOP_RIGHT':     return at(viewport.right - w, viewport.top)
    case 'BOTTOM_LEFT':   return at(viewport.left, viewport.bottom - h)
    case 'BOTTOM_CENTER': return at(viewport.cx - w/2, viewport.bottom - h)
    case 'BOTTOM_RIGHT':  return at(viewport.right - w, viewport.bottom - h)
    case 'MANUAL':        return at(screenPosOf(hotspot).x + action.overlayRelativePosition.x,
                                    screenPosOf(hotspot).y + action.overlayRelativePosition.y)   // [API] "relative to this node"
  }
}
```
- Manual position is set by dragging the overlay preview on canvas while editing the interaction [DOC:360039818254 excerpt]; the offset is stored per action [API].
- **Close when clicking outside:** a click outside the overlay's bounds dismisses it [DOC:360039818254 excerpt]. This implicit close cannot carry additional actions [SRC:forum.figma.com/t/action-when-closing-overlay-when-clicking-outside/85912].
- **Add background behind overlay:** a color layer between overlay and the screen; default #000000 at 25 % [DOC:360039818254 excerpt].
- Background blur effects on overlay frames blur the content beneath in the player [SRC:forum.figma.com/suggest-a-feature-11/add-background-blur-when-opening-overlay-21951].
- Overlays stack; Navigate closes all overlays [API]. Overlays can scroll if they have overflow (V-11).

### 3.12 Navigation history

```ts
NAVIGATE: history.push({screen: base, overlays: [...overlays], transitionIn: t}); base = dest; overlays = []
OVERLAY:  history.push({screen: base, overlays: [...overlays], transitionIn: t}); overlays.push(dest)
SWAP:     if (overlays.length) overlays[overlays.length-1] = dest (inherit rect) else base = dest   // no push
BACK:     if (!history.length) return; const e = history.pop(); animate(reverse(currentTransitionIn)); restore(e)
CLOSE:    overlays.pop()  // V-19 for scope; whether CLOSE also pops the matching history entry: V-16
```
[API] for NAVIGATE/OVERLAY/SWAP semantics; history push on OVERLAY and reverse animation on BACK: [KNOW] (V-16).

### 3.13 Transitions

| Type | Behavior | Settings |
| --- | --- | --- |
| Instant | Destination appears immediately. | none |
| Dissolve | Destination fades in on top of the current screen. | duration, easing |
| Smart animate | Matching layers interpolate; see 3.15. | duration, easing |
| Move in | Destination moves in over the current screen; the current screen stays stationary. | direction, easing, duration, match layers |
| Move out | Current screen moves out, revealing the destination beneath. | same |
| Push | Destination pushes the current screen out (both move). | same |
| Slide in | Destination slides in over the current screen while the current screen is slightly offset as it dissolves (parallax). | same |
| Slide out | Current screen slides out over the destination, the destination slightly offset. | same |

Sources: [DOC:360040522373 excerpt] ("Slide will slowly offset the frame as it dissolves, while the Move transition keeps the original frame stationary"). Geometry (V-15 for parallax factor and direction convention) [KNOW]:
```ts
// direction = direction of motion. LEFT ⇒ incoming content travels right→left (enters from the right edge).
const u = {LEFT:[-1,0], RIGHT:[1,0], TOP:[0,-1], BOTTOM:[0,1]}[direction]
MOVE_IN:  dest.offset = lerp(-u*W, 0, e);  src fixed
MOVE_OUT: src.offset  = lerp(0, u*W, e);   dest fixed beneath
PUSH:     dest.offset = lerp(-u*W, 0, e);  src.offset = lerp(0, u*W, e)
SLIDE_IN: dest.offset = lerp(-u*W, 0, e);  src.offset = lerp(0, u*W*k, e); src dims  (k: V-15)
SLIDE_OUT:src.offset  = lerp(0, u*W, e);   dest.offset = lerp(-u*W*k, 0, e)
// W = viewport extent along u; e = easing(progress)
```
- `matchLayers:true` on a directional transition: matched layers smart-animate while unmatched content performs the directional motion [API] (visual details V-15).
- Duration: integer ms in UI; default 300 ms; allowed range V-14 [KNOW].
- For spring easings the displayed/played duration is derived from the spring (a forum report: API-set 200 ms showed and played as 1200 ms) [SRC:forum.figma.com/report-a-problem-6/unable-to-set-correct-spring-animation-duration-through-api-33811] (V-14).
- Transitions render inside the device viewport (clipped) [KNOW].

### 3.14 Easing

- Curve menu: presets (table 2.8) + "Custom bezier" + spring presets + "Custom spring" [DOC:360051748654 excerpt] [API].
- Custom bezier shows a graph editor seeded from the previously selected preset; numeric values can be copied and pasted between interactions; custom curves cannot be saved as reusable presets [DOC:360051748654 excerpt]. Values x1,y1,x2,y2 are identical in UI and API [SRC:developers.figma.com/docs/plugins/api/Transition (excerpt)]. Constraints: x ∈ [0,1], y unbounded (V-14) [KNOW].
- Bezier evaluation = CSS `cubic-bezier` (P0=(0,0), P3=(1,1)); solve x(t)=p by Newton with bisection fallback to 1e-6 [KNOW].
- Spring evaluation (damped harmonic oscillator from 0 to 1) [KNOW]:
```ts
ω0 = sqrt(k/m); ζ = c / (2*sqrt(k*m)); v0 = initialVelocity
underdamped (ζ<1): ωd = ω0*sqrt(1-ζ²); x(t) = 1 - e^(-ζω0 t) * (cos(ωd t) + ((ζω0 - v0)/ωd) * sin(ωd t))
critical (ζ=1):    x(t) = 1 - e^(-ω0 t) * (1 + (ω0 - v0) t)
overdamped (ζ>1):  r1,2 = -ω0(ζ ∓ sqrt(ζ²-1)); x(t) = 1 - (A e^(r1 t) + B e^(r2 t)), A+B=1, r1A + r2B = -v0
settle duration T = min t such that |1-x(t')| < ε and |x'(t')| < ε for all t' ≥ t   (ε: V-14)
```

### 3.15 Smart animate

- Matching: layers match on **name and position in the hierarchy** (name path below the screen; the top-level frame names need not match) [DOC:360039818874 excerpt] [SRC:forum.figma.com/t/what-are-the-layer-matching-rules-of-smart-animate/5935]. Order also matters [SRC:figma.com/blog/announcing-smart-animate-and-advanced-transitions/].
- New layers in the destination dissolve in; unchanged layers are not animated; if nothing matches the result is a dissolve [DOC:360040522373 excerpt].
- Not supported: smart animate for open overlay (overlays are new frames), morphing between different shapes, and (per the article excerpt) drop/inner shadows [DOC:360040522373 excerpt] (V-26 for current state).
- Animatable properties (claimed by third-party sources; V-26): position, size, rotation, opacity, fill color, stroke, corner radius, blur [SRC:figanimations.com/blogs/the-complete-guide-to-smart-animate-in-figma] [KNOW].
```ts
function matchLayers(src: Screen, dst: Screen): Pair[] {
  const key = (n) => pathOfNames(n, stopAt = screen)            // e.g. "Card/Header/Title" (screen name excluded)
  const bySrc = groupBy(descendants(src), key)                    // preserve z-order within each group
  const pairs = []
  for (const d of descendants(dst)) {
    const s = bySrc.get(key(d))?.shift()                          // duplicates matched in order (V-26)
    if (s && compatibleTypes(s, d)) pairs.push({s, d})             // type rule: V-26
  }
  return pairs            // unmatched src → fade out; unmatched dst → fade in
}
// interpolate each pair over eased progress: x, y, w, h, rotation, opacity, solid colors, radii, …
```
- Interactive components: Change to with Smart animate animates matched children of the instance between variants [DOC:360061175334 excerpt] [KNOW].

### 3.16 Scrolling, overflow, fixed and sticky

- Overflow options: No scrolling, Horizontal, Vertical, Both [DOC:360039818734 excerpt] [API]. Scrolling only makes sense when content extends beyond the frame's bounds [DOC:360039818734 excerpt].
- Top-level frames scroll automatically in the player when bigger than the device/screen, without setting overflow [API comment on `overflowDirection`].
- Nested scrollable frames clip their content in the player (V-27) [KNOW].
- Position: each layer has exactly one of Scroll with parent / Fixed / Sticky [DOC:360039818734 excerpt].
  - **Fixed:** stays put while its scroll container scrolls (status bars, bottom menus) [DOC:360039818734 excerpt]. In auto-layout parents, Fixed is only available for children with absolute positioning [DOC:360039818734 excerpt]. Fixed children always render above scrolling children; layers panel shows Fixed/Scrolls headers [API].
  - **Sticky:** only for objects in vertically scrolling frames; sticks to the top edge of its scrolling container [DOC:360039818734 excerpt]. Stacking pitfalls reported with "canvas stacking: last on top" [SRC:forum.figma.com/ask-the-community-7/navigation-bar-s-scroll-position-stick-and-first-on-top-not-working-41540] (V-27).
```ts
function layoutScroll(container, scroll /* {x,y} clamped to [0, content - viewport] */) {
  for (const child of container.children) {
    if (child.scrollBehavior === 'FIXED') place(child, child.authoredPos)                    // no scroll offset
    else if (child.scrollBehavior === 'STICKY_SCROLLS') place(child, {x: child.x - scroll.x,
                                     y: Math.max(child.y - scroll.y, 0 /* container top */)}) // release rule: V-27
    else place(child, {x: child.x - scroll.x, y: child.y - scroll.y})
  }
  // z-order: scrolling children first (in order), then FIXED children (invariant of §2.2)
}
```

### 3.17 State management (scroll / component / video memory)

- Since 2023-05-24: scroll position of top-level frames and scrollable layers is memorized by default; top-level frames with **identical names or a shared prefix** (e.g. `Checkout / Empty` and `Checkout / Complete`) share scroll state; "Reset scroll position" in the interaction's State section overrides memorization and sharing for that interaction [DOC:360051747774 excerpt] [SRC:forum.figma.com/t/solved-preserve-scroll-position-not-working-please-roll-back-the-feature/44115].
- Interactions created before 2023-05-24 used `preserveScrollPosition`; import maps `preserveScrollPosition:true → resetScrollPosition:false`, `false → resetScrollPosition:true` [API] [DOC:360051747774 excerpt].
- Component state and video position follow the same memorize/reset model via `resetInteractiveComponents` and `resetVideoPosition` [API] (V-27).
```ts
const stateKey = (screen) => sharedPrefix(screen.name)   // exact rule for "shared prefix" — V-27
onNavigate(action, from, to) {
  scrollMemory.set(stateKey(from), captureScroll(from))
  if (action.resetScrollPosition) zeroScroll(to)
  else restoreScroll(to, scrollMemory.get(stateKey(to)))   // layers matched by name path (as 3.15)
}
```

### 3.18 Interactive components

- Interactions between variants of a component set are carried by every instance [DOC:360061175334 excerpt]. "Change to" appears only when prototyping within variants [SRC:smashingmagazine.com]. Regular interactions can be layered on top of variant interactions [SRC:smashingmagazine.com].
- Runtime variant switches are per instance and never modify the document [KNOW].
- Nested interactive instances: the deepest handler wins (3.2); forum reports of failures with hover triggers on nested instances are bugs, not behavior to copy [SRC:forum.figma.com/archive-21/prototyping-limits-nested-interactive-component-interactions-12308].
- Consolidating variants into a boolean property removes prototyping connections [SRC: search excerpt of DOC:5579474826519].
- After delay on a variant starts when that variant becomes active, enabling self-advancing loops (V-12) [KNOW].

### 3.19 Reactions on components and instances

- Reactions defined on a main component (or its children) are inherited by all instances; an instance can override them; "reset overrides" restores inherited reactions; detaching keeps the effective reactions [DOC:4404380377367 title] [KNOW] (V-30).
- A connection from a main component to a screen applies to every instance on the same page; cross-page behavior V-30 [SRC:forum.figma.com/ask-the-community-7/nested-component-navigation-interaction-not-working-in-screens-on-another-page-19105].

### 3.20 Video and GIF

- Video fills play in the player; Play/pause etc. actions available; video triggers only on video layers [API] [DOC:360040035874 excerpt]. Autoplay/loop/mute defaults: V-24 [KNOW: autoplay muted loop].
- `UPDATE_MEDIA_RUNTIME.destinationId:null` targets the video containing the hotspot [API]. Skip amounts and SKIP_TO times clamp to [0, duration] (V-24) [KNOW].
- Playback position is memorized per screen unless `resetVideoPosition` [API].
- Animated GIF image fills animate in the player [DOC:360041486873 title] [KNOW] (loop/restart V-24).

### 3.21 Device and background

- Settings live in the Prototype tab with nothing selected; Device controls hardware type, orientation and model; Background sets the color behind the prototype [DOC:21158597546391 excerpt].
- Available options depend on frame dimensions; using a frame preset makes Figma select a matching device [DOC:21158597546391 excerpt]. Only one device per page [SRC:forum.figma.com/t/assign-a-prototype-device-to-specific-frames-screens/20228].
- Custom size (Fit) scales the design to fit the viewing screen; presentation view offers all device types while inline preview offers only phone, watch and tablet frames [DOC:21158597546391 excerpt].
- Illigma device art: Illigma ships its own generic device frames (no copying of Figma's or Apple's bezel assets); `presetIdentifier` strings are mapped by table (V-28).

### 3.22 In-app player (Illigma's presentation view)

- **Open:** Present command (§5) opens a separate Illigma window (desktop) or a full-window overlay (browser build). Start resolution [API] [KNOW] (V-29):
```ts
function startNode(selection, page) {
  const s = topLevelScreenOf(selection[0]); if (s) return s                         // selected screen (or ancestor screen)
  if (page.flowStartingPoints.length) return page.flowStartingPoints[0].nodeId     // [API] default flow
  return firstScreenInPageOrder(page)                                               // V-29
}
```
- **Flows sidebar** lists flows (name + description); choosing one restarts at its starting frame [DOC:360040318013 excerpt] [KNOW].
- **Restart** (R or button) restarts from the flow starting point and resets all runtime state (§2.12) [SRC:inthepocket.design course excerpt] [KNOW]. In inline preview, restart begins from the last selected frame on the canvas [DOC:360040318013 excerpt].
- **Arrow keys** step backward/forward through screens; **Esc** exits [SRC:search excerpt citing DOC:360040318013] (V-31 for order).
- **Options:** Show hotspot hints on click; scaling; show device frame (only when a device is set); respect aspect ratio (only with No device); fit width (only with No device or Presentation); hide UI; disable default keyboard navigation [DOC:21158597546391 excerpt] [SRC:help.userbrain.com/help/testing-your-figma-prototype-with-userbrain] [SRC:forum.figma.com…26397].
- Scaling (V-31):
```ts
scale = { actual: 1, fit: Math.min(1, vw/W, vh/H) /* scale down to fit */, fill: Math.min(vw/W, vh/H) /* up or down */,
          fitWidth: vw/W }[mode]      // W,H = device viewport (or screen) size; centered
```
- **Live updates:** the player reflects document edits made in the editor while it is open; if the current screen is deleted the player restarts (V-32) [KNOW].
- **Hotspot hints:** clicking where no On click hotspot exists flashes all hotspots on the current screen/overlays (duration V-31) [KNOW].
- **Keyboard:** when "disable default keyboard navigation" is on, R/arrows/etc. are delivered to Key/Gamepad triggers instead [SRC:forum…26397]; a report says R still restarts even then (V-13).

### 3.23 Inline preview

Shift+Space opens a small player on the canvas showing the selected screen; it follows selection; restarts from the last selected frame; can be expanded into the full player [DOC:360040318013 excerpt] [SRC:medium.com/@indigo_29303]. Uses the same engine as the full player.

### 3.24 Document integrity

- Undo/redo: every prototype edit (interaction fields, connections, flows, overflow, position, overlay settings, device, background) is one undoable step; player runtime state is never in undo history [KNOW].
- Copy/paste & duplicate: pasted/duplicated layers keep `reactions`; destinations are kept by id when the destination exists on the same page; duplicating a page remaps connections to the equivalents in the copy [API: `PageNode.clone()` doc]; cross-page and cross-file paste behavior V-33 [KNOW].
- Deleting a destination leaves the interaction with no destination (inert, shown as needing a destination) — V-33 [KNOW].
- Save/open must round-trip every field in §2 losslessly, including unknown future enum values (preserve as opaque) [KNOW: Illigma rule].
- Image/SVG/PDF export never includes connections, flow badges or prototype data [KNOW].

### 3.25 Accessibility of prototypes

Figma documents accessible prototypes [DOC:7810391964695 title]; content not seen. Expected (V-34) [KNOW]: keyboard focus can move between hotspots and activate On click; text is exposed to screen readers. Illigma's player UI (flows sidebar, options, restart) must be fully keyboard operable regardless.

---

## 4. Inspector & on-canvas controls (functional only)

| Location | Control | Function | Evidence |
| --- | --- | --- | --- |
| Right sidebar | Design / Prototype tabs | Switch editing mode (3.1). | [OBS] |
| Prototype tab, no selection | Device dropdown | NONE / PRESET (grouped by phone, tablet, desktop, watch, …) / CUSTOM / PRESENTATION. | [API] [DOC:21158597546391 excerpt] |
| ″ | Model / style | Pick preset variant (color/model). | [DOC:21158597546391 excerpt] |
| ″ | Rotation | Toggles `rotation` NONE ↔ CCW_90. | [API] |
| ″ | Custom size W/H | Only for CUSTOM. | [API] |
| ″ | Background | Single solid color (+opacity) → `prototypeBackgrounds`. | [API] |
| ″ | Flows list | Name, description, select frame, present flow, (reorder: V-05). | [DOC:360039823894 excerpt] |
| Prototype tab, screen | Flow starting point (+ / name / description / −) | 3.4. | [DOC:360039823894 excerpt] |
| ″ | Interactions (+ / rows / −) | Row summarises "Trigger → Action destination"; click opens Interaction details. | [KNOW] |
| ″ | Scroll behavior: Overflow | NONE / HORIZONTAL / VERTICAL / BOTH. | [DOC:360039818734 excerpt] |
| ″ | Scroll behavior: Position | Scroll with parent / Fixed / Sticky (nested layers). | [DOC:360039818734 excerpt] |
| ″ | Overlay settings | Position (7 + Manual), Close when clicking outside, Add background behind overlay (color+opacity). | [DOC:360039818254 excerpt] |
| Interaction details panel | Trigger dropdown | 2.5 list, filtered by context; sub-fields: Delay (ms) for mouse triggers, After delay (ms), key capture field + device selector, video time. | [API] [KNOW] |
| ″ | Actions list (+, drag handle, −) | Ordered actions; drag into Conditional. | [DOC:15253220891799 excerpt] |
| ″ | Action type + destination | Navigate to, Change to, Back, Scroll to, Open link (+Open in new tab), Open overlay, Swap overlay, Close overlay, Set variable (variable picker + value/expression), Set variable mode (collection + mode), Conditional (If field + actions + Else), video actions (target video + seconds). | [API] [DOC:360040035874 excerpt] |
| ″ | Animation | Type; direction (4 arrows) for directional types; "Smart animate matching layers" (`matchLayers`); Curve dropdown with preview; bezier editor (graph + 4 fields); spring editor (stiffness, damping, mass); Duration (ms). | [API] [DOC:360051748654 excerpt] |
| ″ | State | Reset scroll position; Reset component state; Reset video position (labels V-27). | [API] [DOC:360051747774 excerpt] |
| Canvas | Connection handle | Drag to create a connection. | [KNOW] |
| Canvas | Noodles | Select / retarget / delete connections. | [KNOW] |
| Canvas | Flow badge | Shows flow name; present that flow. | [DOC:360039823894 excerpt] |
| Canvas | Overlay icon | On frames used as overlays; opens overlay settings. | [DOC:360039818254 excerpt] |
| Canvas | Manual overlay preview | Drag to set `overlayRelativePosition`. | [DOC:360039818254 excerpt] |
| Layers panel | "Fixed" / "Scrolls" headers | Shown inside frames with ≥1 fixed child. | [API] |
| Toolbar | Present (play) + dropdown (Present / Preview) | Opens player or inline preview. | [KNOW] |
| Player | Restart, flows sidebar, options menu, close | 3.22. | [DOC:360040318013 excerpt] |

---

## 5. Keyboard shortcuts (macOS / Windows)

| Action | macOS | Windows | Evidence | Status |
| --- | --- | --- | --- | --- |
| Toggle Design / Prototype tab | ⇧E | Shift+E | [SRC: search excerpt of DOC:360040318013] [KNOW] | verify V-35 |
| Show Prototype tab (legacy panel shortcut) | ⌥9 | Alt+9 | [KNOW] | verify V-35 (UI3 may differ) |
| Present (open player) | ⌥⌘↵ | Ctrl+Alt+Enter | [KNOW] | verify V-35 |
| Open inline preview | ⇧Space | Shift+Space | [SRC:medium.com/@indigo_29303] [KNOW] | verify V-35 |
| Delete selected connection | ⌫ / Delete | Backspace / Delete | [KNOW] | verify V-02 |
| Player: restart | R | R | [SRC: search excerpt of DOC:360040318013] | verify V-31 |
| Player: previous / next screen | ← / → | ← / → | [SRC: search excerpt] | verify V-31 |
| Player: exit | Esc | Esc | [SRC: search excerpt] | verify V-31 |
| Key/Gamepad trigger capture | press the key(s) while the field is focused | same | [KNOW] | verify V-13 |
| Player: toggle fullscreen | ⌃⌘F | F11 | Illigma platform convention (no Figma equivalent claimed) | Illigma-specific |

All global editor shortcuts are owned by 10-panels-shortcuts-workflow.md; conflicts are resolved there.

