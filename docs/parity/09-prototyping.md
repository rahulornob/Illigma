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

---

## 6. Parity checklist

Format: `- [ ] **PR-NNN** Name — expected Figma behavior. _Data:_ … _Test:_ … _M#·P#·evidence_`. All items: **Not started**. "V-nn" refers to the experiments in §8; an item that cites a V-nn cannot be signed off until that experiment has been recorded.

### 6.1 Prototype tab & editing mode

- [ ] **PR-###** Design/Prototype tab switch — The right sidebar offers Design and Prototype tabs; selecting Prototype shows connection handles and all connections of the page on canvas, selecting Design hides them; switching tabs never changes the document or the undo stack. _Data:_ editor UI state only. _Test:_ Figma page with 3 connections; toggle tabs; record noodle visibility and that Undo after toggling does nothing prototype-related; Illigma identical. _M7·P0·[OBS] [KNOW]_
- [ ] **PR-###** Prototype tab with no selection — Shows Device, Background and Flows sections (in Figma's order). _Data:_ `prototypeDevice`, `prototypeBackgrounds`, `flowStartingPoints`. _Test:_ deselect all in Figma; record section list and order; compare 1:1. _M7·P0·[DOC:21158597546391 excerpt] [DOC:360039823894 excerpt]_
- [ ] **PR-###** Prototype tab with a screen selected — Shows Flow starting point, Interactions, Scroll behavior (Overflow) and, for frames used as overlays, Overlay settings. _Data:_ `reactions`, `overflowDirection`, `overlay*`. _Test:_ select a top-level frame that is an overlay target; record sections; compare. _M7·P0·[DOC:360039823894 excerpt] [DOC:360039818254 excerpt] [KNOW]_
- [ ] **PR-###** Prototype tab with a nested layer selected — Shows Interactions and Scroll behavior → Position (Scroll with parent / Fixed / Sticky); Overflow additionally for frame-like layers. _Data:_ `reactions`, `scrollBehavior`, `overflowDirection`. _Test:_ select a nested rectangle, then a nested frame; record sections. _M7·P0·[DOC:360039818734 excerpt] [KNOW]_
- [ ] **PR-###** No interactions on ineligible nodes — Sections, slices and component sets show no Interactions section and cannot hold reactions. _Data:_ node types per §2.1. _Test:_ select each in Figma; record absence; in Illigma the schema rejects `reactions` on these types. _M7·P1·[API]_
- [ ] **PR-###** Multi-selection interactions — Identical interactions display normally; differing ones display a mixed state; "+" adds the new interaction to every selected layer. _Data:_ `reactions` per node. _Test:_ V-03. _M7·P1·[KNOW]_
- [ ] **PR-###** Design edits keep reactions — Editing fills, size, name, auto layout or converting a frame to a component never drops its `reactions`. _Data:_ `reactions`. _Test:_ give a frame 2 interactions; change fill, resize, rename, Create component; reactions unchanged in Figma and Illigma. _M7·P0·[KNOW]_

### 6.2 Screens & hotspots

- [ ] **PR-###** Screen eligibility — Only FRAME/GROUP/COMPONENT/INSTANCE nodes whose parent is the page or a (possibly nested) section are screens (navigate/overlay destinations, flow starts); frames nested in frames never are. _Data:_ parent type; `prototypeStartNode` type list. _Test:_ V-36; destination dropdown lists frame-in-section and frame-in-nested-section but not frame-in-frame. _M7·P0·[API] [KNOW]_
- [ ] **PR-###** Hotspot node types — Reactions can be set on FRAME, GROUP, TRANSFORM_GROUP, COMPONENT, INSTANCE, SLOT, RECTANGLE, LINE, ELLIPSE, POLYGON, STAR, VECTOR, TEXT, TEXT_PATH, BOOLEAN_OPERATION and the screen itself. _Data:_ `ReactionMixin`. _Test:_ in Figma add an On click to one layer of each type; all accept; Illigma accepts the same set. _M7·P0·[API]_
- [ ] **PR-###** Hidden layers are inert — A layer with `visible:false` (directly or via an ancestor, or via a boolean variable) never receives triggers in the player. _Data:_ `visible`. _Test:_ V-08 case "hidden". _M7·P0·[KNOW]_
- [ ] **PR-###** Zero-opacity hotspots — A layer at 0 % opacity (or with no fill) still receives triggers. _Data:_ `opacity`, `fills:[]`. _Test:_ V-08 case "invisible hotspot". _M7·P1·[KNOW]_
- [ ] **PR-###** Locked layers interactive — `locked:true` does not affect the player. _Data:_ `locked`. _Test:_ V-08 case "locked". _M7·P1·[KNOW]_
- [ ] **PR-###** Clipping limits hit area — Parts of a hotspot clipped by an ancestor with clip content (or by a scroll viewport) are not hit. _Data:_ `clipsContent`. _Test:_ V-08 case "clipped". _M7·P1·[KNOW]_
- [ ] **PR-###** Rotated hotspots — Hit area follows the layer's transformed geometry bounds, not its axis-aligned bounding box. _Data:_ `relativeTransform`. _Test:_ V-08 case "rotated 45°". _M7·P2·[KNOW]_
- [ ] **PR-###** Handler precedence & bubbling — The deepest hit layer that has a reaction for the event's trigger handles it; if it has none, the nearest ancestor (within the screen) that has one handles it; only one handler fires per event. _Data:_ `reactions`. _Test:_ V-08 cases "nested click", "child hover + parent click". _M7·P0·[KNOW]_
- [ ] **PR-###** Pointer cursor over hotspots — Player shows a pointing-hand cursor over layers with click-type triggers (V-37). _Data:_ runtime. _Test:_ V-37. _M7·P2·[KNOW]_

### 6.3 Connections (authoring)

- [ ] **PR-###** Connection handle — In the Prototype tab, a hovered/selected eligible layer shows a circular handle on its right edge; dragging from it starts a noodle. _Data:_ UI. _Test:_ V-02 step 1; record handle placement for a rotated and a tiny (4×4) layer. _M7·P0·[KNOW]_
- [ ] **PR-###** Create connection by drop — Dropping on a screen creates `{trigger: ON_CLICK, actions:[NODE NAVIGATE → screen]}`. _Data:_ `reactions`. _Test:_ drag from a button to Frame B; inspect via plugin `reactions`; Illigma JSON identical (ids aside). _M7·P0·[KNOW]_
- [ ] **PR-###** Drop resolves to screen — Dropping over any child of a screen targets the screen itself. _Data:_ `destinationId`. _Test:_ drop over a text layer inside Frame B; destination = Frame B. _M7·P0·[KNOW]_
- [ ] **PR-###** Default animation of new connections — New connections get Figma's default transition (Instant vs last-used, V-04). _Data:_ `transition`. _Test:_ V-04. _M7·P0·[KNOW]_
- [ ] **PR-###** Variant-to-variant connection — Dragging between two variants of one component set creates `CHANGE_TO` instead of `NAVIGATE`. _Data:_ `navigation:'CHANGE_TO'`. _Test:_ connect Default→Hover variants; inspect `navigation`. _M7·P0·[SRC:smashingmagazine.com/2021/07/introduction-figma-interactive-components/] [DOC:360061175334 excerpt]_
- [ ] **PR-###** Cancel on empty canvas — Releasing a new noodle on empty canvas creates nothing and leaves no undo step. _Data:_ none. _Test:_ V-02 step 2. _M7·P0·[KNOW]_
- [ ] **PR-###** Retarget connection — Dragging the arrow end of an existing connection to another screen changes only `destinationId`; trigger, transition and flags are kept. _Data:_ `destinationId`. _Test:_ V-02 step 3; diff reactions before/after. _M7·P0·[KNOW]_
- [ ] **PR-###** Detach connection end — Dropping an existing connection's end on empty canvas removes the connection (or clears its destination; V-02). _Data:_ `reactions`. _Test:_ V-02 step 4. _M7·P1·[KNOW]_
- [ ] **PR-###** Select & delete noodle — Clicking a noodle selects that interaction and opens Interaction details; Delete/Backspace deletes it (one undo step). _Data:_ `reactions`. _Test:_ V-02 step 5. _M7·P0·[KNOW]_
- [ ] **PR-###** Same-page destinations only — Destinations are limited to screens of the current page; other pages' frames are never offered. _Data:_ `destinationId`. _Test:_ two pages; open destination dropdown; only current-page screens listed. _M7·P0·[API] [KNOW]_
- [ ] **PR-###** Destination picker — Dropdown lists screens (searchable) for navigate/overlay/swap, the current screen's descendants for Scroll to, sibling variants for Change to. _Data:_ `destinationId`. _Test:_ record list contents per action type. _M7·P1·[KNOW]_
- [ ] **PR-###** Noodle drawing rules — Destination-less actions (Back, Close, URL, Set variable(-mode), Conditional, media) draw no noodle; Scroll to draws to the target layer; noodle endpoints update live when frames move. _Data:_ derived. _Test:_ V-02 step 6. _M7·P1·[KNOW]_
- [ ] **PR-###** Automatic flow on first connection — Adding a connection between two frames with no existing connections creates a flow starting point on the source screen. _Data:_ `flowStartingPoints`. _Test:_ empty page, two frames, first connection; record new flow name. _M7·P0·[DOC:360039823894 excerpt]_
- [ ] **PR-###** Add interaction with "+" — Adds a new interaction row with Figma's default trigger and action (V-04) and opens its details. _Data:_ `reactions`. _Test:_ V-04. _M7·P0·[KNOW]_
- [ ] **PR-###** Remove interaction — "−" on a row removes that interaction (one undo step). _Data:_ `reactions`. _Test:_ remove; undo; redo. _M7·P0·[KNOW]_
- [ ] **PR-###** Duplicate-trigger conflict — Two interactions with the same trigger on one layer show a warning; player behavior per V-06. _Data:_ `reactions`. _Test:_ V-06. _M7·P1·[KNOW]_
- [ ] **PR-###** Multi-select connection — Dragging a noodle with several layers selected creates one interaction per selected layer. _Data:_ `reactions`. _Test:_ V-03. _M7·P1·[KNOW]_

### 6.4 Flows & starting points

- [ ] **PR-###** Flow list model — `flowStartingPoints` is an ordered page-level list of `{nodeId, name}`; the first is the default. _Data:_ `PageNode.flowStartingPoints`. _Test:_ create 3 flows; read via plugin; Illigma order identical. _M7·P0·[API]_
- [ ] **PR-###** Add starting point (+) — "+" in Flow starting point on a selected screen adds a flow named "Flow N" (lowest unused N, V-05) and focuses the name field. _Data:_ `flowStartingPoints`. _Test:_ V-05. _M7·P0·[DOC:360039823894 excerpt] [SRC:forum.figma.com/t/auto-focus-flow-starting-points-name-at-creation/39496]_
- [ ] **PR-###** Add starting point (context menu) — Right-click a screen → "Add starting point". _Data:_ same. _Test:_ record menu item label/position. _M7·P1·[DOC:360039823894 excerpt]_
- [ ] **PR-###** One per screen — A screen can hold only one starting point; the add affordance is unavailable when present. _Data:_ unique `nodeId`. _Test:_ attempt second add; refused. _M7·P0·[DOC:360039823894 excerpt]_
- [ ] **PR-###** Screens only — Starting points cannot be set on nested frames or non-screen layers. _Data:_ `nodeId` must be a screen. _Test:_ select nested frame; no Flow section. _M7·P0·[DOC:360039823894 excerpt]_
- [ ] **PR-###** Rename flow — Inline edit of the flow name; empty name rule V-05. _Data:_ `name`. _Test:_ V-05. _M7·P1·[SRC:pwskills.com/blog/figma-prototype]_
- [ ] **PR-###** Flow description — Editable multi-line description shown in the player's flow sidebar (Illigma extension field). _Data:_ `description` (Illigma ext.). _Test:_ V-05 (storage); visible in player sidebar. _M7·P1·[SRC:pwskills.com/blog/figma-prototype] [KNOW]_
- [ ] **PR-###** Remove starting point — Removing deletes the flow entry; the screen and its interactions remain. _Data:_ `flowStartingPoints`. _Test:_ remove; undo restores same name/order. _M7·P0·[SRC:forum.figma.com/t/cant-remove-flows/25184]_
- [ ] **PR-###** Duplicate screen with flow — Duplicating a screen that has a starting point creates a starting point on the copy (naming V-05). _Data:_ `flowStartingPoints`. _Test:_ ⌘D a flow start; record new flow name and list position. _M7·P1·[DOC:360039823894 excerpt]_
- [ ] **PR-###** Delete screen removes flow — Deleting a screen removes its starting point; undo restores both, at the same list index. _Data:_ `flowStartingPoints`. _Test:_ delete middle flow's frame; undo; order preserved. _M7·P0·[KNOW]_
- [ ] **PR-###** Flows list navigation — With nothing selected, hovering a flow offers "Select frame", which selects and zooms to the starting screen. _Data:_ UI. _Test:_ record behavior incl. zoom. _M7·P1·[DOC:360039823894 excerpt]_
- [ ] **PR-###** Canvas flow badge — A starting screen shows a badge with a play icon and the flow name above it; activating it presents that flow. _Data:_ derived. _Test:_ click badge; player opens at that flow. _M7·P1·[DOC:360039823894 excerpt] [KNOW]_
- [ ] **PR-###** Flow membership — A flow comprises all screens reachable from its start through interactions; a screen may be in several flows. _Data:_ derived graph. _Test:_ two flows sharing a screen; both reach it in the player. _M7·P1·[DOC:360039823894 excerpt]_
- [ ] **PR-###** Reorder flows — Flow order is user-changeable if Figma allows it (V-05); order drives the player sidebar and default flow. _Data:_ list order. _Test:_ V-05. _M7·P2·[KNOW]_
- [ ] **PR-###** Legacy start node import — A file with `prototypeStartNodeID` and no flows imports as one flow on that node. _Data:_ `prototypeStartNode`. _Test:_ import a REST JSON fixture with only `prototypeStartNodeID`; one flow created. _M8·P1·[API]_

### 6.5 Triggers

- [ ] **PR-###** On click — Fires on release over the same hotspot that received the press, if pointer travel stayed under the drag threshold (V-07). _Data:_ `{type:'ON_CLICK'}`. _Test:_ V-07. _M7·P0·[DOC:360040035834 excerpt] [KNOW]_
- [ ] **PR-###** Click suppressed by gestures — No On click fires after a drag, scroll or On drag gesture. _Data:_ runtime. _Test:_ V-07 "drag-then-release on hotspot". _M7·P0·[KNOW]_
- [ ] **PR-###** On drag start — Fires when a drag begins on the hotspot, in any direction. _Data:_ `{type:'ON_DRAG'}`. _Test:_ V-09. _M7·P1·[DOC:360040035834 excerpt]_
- [ ] **PR-###** On drag progress — For animated transitions, transition progress follows pointer displacement while dragging (scrubbing back and forth). _Data:_ `transition`. _Test:_ V-09 (record progress vs distance). _M7·P1·[DOC:360040035834 excerpt]_
- [ ] **PR-###** On drag release — On release the transition completes or reverts per Figma's threshold/velocity rule. _Data:_ runtime. _Test:_ V-09. _M7·P1·[KNOW]_
- [ ] **PR-###** On drag vs scroll — A drag starting on an On drag hotspot inside a scroll container triggers the interaction instead of scrolling. _Data:_ runtime. _Test:_ V-09. _M7·P1·[KNOW]_
- [ ] **PR-###** While hovering apply — Actions apply when the pointer enters the hotspot. _Data:_ `{type:'ON_HOVER'}`. _Test:_ hover button → Navigate to B; screen changes on enter. _M7·P0·[DOC:360040035834 excerpt] [API]_
- [ ] **PR-###** While hovering revert — Leaving the hotspot reverts to the prior state with the reverse animation. _Data:_ runtime snapshot. _Test:_ record reverse transition on leave (Move in left → ?). _M7·P0·[DOC:360040035834 excerpt] [API] [KNOW]_
- [ ] **PR-###** While pressing — Applies on button down, reverts on button up (including release outside the hotspot, V-12). _Data:_ `{type:'ON_PRESS'}`. _Test:_ V-12. _M7·P0·[DOC:360040035834 excerpt] [API]_
- [ ] **PR-###** Temporary trigger action set — The set of action types offered under While hovering / While pressing matches Figma. _Data:_ allowed `Action` types. _Test:_ V-12 (record dropdown contents). _M7·P1·[KNOW]_
- [ ] **PR-###** Mouse enter — Fires once when the pointer first crosses into the hotspot; never reverts. _Data:_ `{type:'MOUSE_ENTER', delay, deprecatedVersion:false}`. _Test:_ enter, move around inside: exactly one firing. _M7·P0·[SRC:help.figma.com/hc/en-us/articles/360040035834 excerpt] [API]_
- [ ] **PR-###** Mouse enter/leave delay — With `delay>0`, the pointer must remain inside (enter) / outside (leave) for the delay; leaving earlier cancels. _Data:_ `delay`. _Test:_ V-10. _M7·P1·[API] [KNOW]_
- [ ] **PR-###** Mouse leave — Fires once on first exit from the hotspot. _Data:_ `{type:'MOUSE_LEAVE'}`. _Test:_ enter/exit 3 times → 3 firings, one per exit. _M7·P0·[SRC:help.figma.com excerpt] [API]_
- [ ] **PR-###** Legacy mouse triggers — `deprecatedVersion:true` triggers keep legacy behavior, show the legacy label ("Mouse move inside/outside", V-10) and cannot be newly created. _Data:_ `deprecatedVersion`. _Test:_ V-10 with an imported legacy fixture. _M7·P1·[API] [SRC:help.figma.com excerpt]_
- [ ] **PR-###** Mouse down — Fires on primary button down over the hotspot (after `delay`, V-10); one-way. _Data:_ `{type:'MOUSE_DOWN', delay}`. _Test:_ V-10. _M7·P1·[API]_
- [ ] **PR-###** Mouse up — Fires on primary button up over the hotspot (after `delay`, V-10); one-way. _Data:_ `{type:'MOUSE_UP', delay}`. _Test:_ V-10 incl. press outside then release inside. _M7·P1·[API]_
- [ ] **PR-###** After delay — Fires once `timeout` after the screen is shown; UI default 800 ms (V-01). _Data:_ `{type:'AFTER_TIMEOUT', timeout}`. _Test:_ V-12 (timestamped capture). _M7·P0·[API] [KNOW]_
- [ ] **PR-###** After delay availability — Offered only on screens (and variants, overlays per V-12), not on nested layers. _Data:_ trigger filter. _Test:_ V-12. _M7·P1·[SRC:uxdesign.cc/prototyping-with-figma-interactions-228dbc82fe00]_
- [ ] **PR-###** After delay lifecycle — Timer starts when the screen becomes visible (before/after transition end: V-12), is cancelled on leaving, and restarts on every re-entry. _Data:_ runtime timers. _Test:_ V-12. _M7·P0·[KNOW]_
- [ ] **PR-###** After delay in overlays — An overlay frame's After delay starts when the overlay opens and is cancelled when it closes. _Data:_ runtime. _Test:_ V-12. _M7·P1·[KNOW]_
- [ ] **PR-###** Key trigger capture — Focusing the key field and pressing a key combination records it (modifiers included) into `keyCodes`. _Data:_ `{type:'ON_KEY_DOWN', device:'KEYBOARD', keyCodes}`. _Test:_ V-13 (record keyCodes for A, Shift+A, ⌘K, Space, Enter, ←). _M7·P1·[API] [KNOW]_
- [ ] **PR-###** Key trigger firing & scope — Fires when exactly the recorded keys are down; applies to the current screen and open overlays regardless of pointer position (topmost overlay first). _Data:_ runtime. _Test:_ V-13. _M7·P1·[KNOW]_
- [ ] **PR-###** Gamepad triggers — Devices XBOX_ONE, PS4, SWITCH_PRO, UNKNOWN_CONTROLLER map controller buttons to `keyCodes` via the Gamepad API. _Data:_ `device`, `keyCodes`. _Test:_ V-13 with one controller (record codes per button). _M7·P2·[API] [SRC:uxdesign.cc]_
- [ ] **PR-###** Video hits time — On a layer with a video fill, fires when playback crosses `mediaHitTime` (seconds), once per crossing. _Data:_ `{type:'ON_MEDIA_HIT', mediaHitTime}`. _Test:_ V-24. _M7·P1·[API]_
- [ ] **PR-###** Video ends — Fires when the video reaches its end (looping behavior V-24). _Data:_ `{type:'ON_MEDIA_END'}`. _Test:_ V-24. _M7·P1·[API]_
- [ ] **PR-###** Context-filtered trigger list — Video triggers only for video-filled layers; After delay only for screens/variants; Change-to-specific options only in variants. _Data:_ UI filter. _Test:_ record trigger dropdown for rect, video rect, screen, variant. _M7·P1·[API] [KNOW]_
- [ ] **PR-###** Incomplete interactions — `trigger:null` or empty `actions` persist through save/open and are inert in the player. _Data:_ `Reaction`. _Test:_ create via plugin in Figma; present; nothing happens; round-trip in Illigma. _M7·P0·[API]_
- [ ] **PR-###** Delay/timeout fields — Integer-ms entry; min/max and rounding per V-01; stored in Illigma seconds (§2.11). _Data:_ `timeout`, `delay`. _Test:_ V-01. _M7·P1·[API] [KNOW]_

### 6.6 Actions

- [ ] **PR-###** Navigate to — Replaces the base screen, closes all overlays, pushes a history entry. _Data:_ `NODE/NAVIGATE`. _Test:_ open 2 overlays then Navigate; overlays gone; Back returns to the screen with both overlays (V-16). _M7·P0·[API]_
- [ ] **PR-###** Navigate to current screen — Navigating to the screen already shown re-enters it per Figma (After delay restarts? scroll kept? V-16). _Data:_ same. _Test:_ V-16. _M7·P2·[KNOW]_
- [ ] **PR-###** Back — Returns to the previous history entry, playing the reverse of the transition that led forward. _Data:_ `{type:'BACK'}`. _Test:_ V-16 (Push left forward; record Back animation). _M7·P0·[DOC:360040035874 excerpt] [KNOW]_
- [ ] **PR-###** Back at history root — No effect at the start of history. _Data:_ runtime. _Test:_ V-16. _M7·P1·[KNOW]_
- [ ] **PR-###** Change to availability — Offered only when the hotspot is inside a variant of a component set; destination list = sibling variants. _Data:_ `NODE/CHANGE_TO`. _Test:_ action dropdown on a plain frame vs inside a variant. _M7·P0·[SRC:smashingmagazine.com] [API]_
- [ ] **PR-###** Change to runtime — Switches the closest ancestor instance of the hotspot to the destination variant for this session only. _Data:_ runtime `instanceVariant`. _Test:_ instance in screen; click; variant changes; exit player; document unchanged. _M7·P0·[API]_
- [ ] **PR-###** Change to animations — Offered transition types for Change to match Figma (V-17). _Data:_ `transition`. _Test:_ V-17. _M7·P1·[KNOW]_
- [ ] **PR-###** Scroll to targets — Destination must be a layer within the current screen (including nested scroll containers); layers on other screens/pages are not offered. _Data:_ `NODE/SCROLL_TO`. _Test:_ dropdown contents. _M7·P0·[DOC:360040035874 excerpt] [SRC:forum.figma.com/t/link-to-section-from-other-screen/67252]_
- [ ] **PR-###** Scroll to geometry — Each scrollable ancestor (innermost first, including the screen viewport) scrolls so the destination's top-left aligns to its viewport's top-left, clamped to the scroll range. _Data:_ runtime scroll. _Test:_ V-18 (targets near top, middle, bottom end, inside nested scroller). _M7·P0·[KNOW]_
- [ ] **PR-###** Scroll to animation — Instant (`transition:null`) or animated (`SCROLL_ANIMATE` + easing + duration). _Data:_ `transition.type`. _Test:_ V-18; read `transition.type` after choosing "animate". _M7·P1·[API]_
- [ ] **PR-###** Scroll to offset — If Figma's UI exposes an X/Y offset for Scroll to, Illigma matches it (no data field exists in the typings; V-18). _Data:_ unknown. _Test:_ V-18. _M7·P2·[API] [KNOW]_
- [ ] **PR-###** Open link — Opens `url` in the OS default browser (local-first adaptation of Figma's new-tab/leaving notice); `openInNewTab` persisted. _Data:_ `{type:'URL', url, openInNewTab}`. _Test:_ round-trip `openInNewTab`; activation opens browser after confirmation. _M7·P1·[DOC:360040035874 excerpt] [API]_
- [ ] **PR-###** Open link URL handling — Empty URL is inert; scheme-less URLs are normalized as Figma does (V-38). _Data:_ `url`. _Test:_ V-38. _M7·P2·[KNOW]_
- [ ] **PR-###** Open overlay — Opens the destination above the current stack and pushes history. _Data:_ `NODE/OVERLAY`. _Test:_ open overlay; Back closes it (V-16). _M7·P0·[API] [DOC:360040035874 excerpt]_
- [ ] **PR-###** Open overlay animations — Smart animate is not offered/used for Open overlay; other allowed types per V-11. _Data:_ `transition`. _Test:_ V-11 (record dropdown). _M7·P1·[DOC:360040522373 excerpt]_
- [ ] **PR-###** Swap overlay from overlay — Replaces the topmost overlay; the new overlay takes over the old overlay's settings/position; no history entry. _Data:_ `NODE/SWAP`. _Test:_ overlay A (top-right) → swap to B (center setting); B appears top-right; Back skips A. _M7·P0·[DOC:360040035874 excerpt] [SRC:forum.figma.com/suggest-a-feature-11/swap-overlay-and-set-a-different-position-1653]_
- [ ] **PR-###** Swap from base screen — Behaves like Navigate to without adding history. _Data:_ `NODE/SWAP`. _Test:_ A→(swap)B→Back returns to the screen before A. _M7·P0·[API]_
- [ ] **PR-###** Swap overlay smart animate — Smart animate between swapped overlays with matching layers animates them. _Data:_ `SMART_ANIMATE`. _Test:_ two overlays with a matching "Panel" layer at different heights. _M7·P1·[DOC:360040522373 excerpt]_
- [ ] **PR-###** Close overlay — Closes the overlay per Figma scope (topmost / containing hotspot, V-19) with the reverse of its opening animation. _Data:_ `{type:'CLOSE'}`. _Test:_ V-19. _M7·P0·[DOC:360040035874 excerpt] [KNOW]_
- [ ] **PR-###** Close overlay without overlays — No effect when no overlay is open. _Data:_ runtime. _Test:_ V-19. _M7·P1·[KNOW]_
- [ ] **PR-###** Null destination — `NODE` actions with `destinationId:null` are kept and inert ("None"). _Data:_ `destinationId`. _Test:_ set via plugin; present; nothing happens. _M7·P0·[API]_
- [ ] **PR-###** Deprecated single `action` — Import maps legacy `action` to `actions[0]`; export writes both. _Data:_ `Reaction.action`. _Test:_ fixture with only `action`; behavior identical. _M8·P1·[API]_

### 6.7 Overlays

- [ ] **PR-###** Settings live on the overlay frame — Position, close-outside and background are properties of the destination frame; editing them from any connection changes all connections that open it. _Data:_ `overlayPositionType`, `overlayBackground`, `overlayBackgroundInteraction`. _Test:_ two buttons open the same overlay; change position via one; both affected. _M7·P0·[API] [DOC:360039818254 excerpt]_
- [ ] **PR-###** Overlay canvas icon — Frames used as overlays show an overlay icon next to the frame on canvas; clicking it shows overlay settings. _Data:_ derived. _Test:_ record icon presence for overlay vs non-overlay targets. _M7·P1·[DOC:360039818254 excerpt]_
- [ ] **PR-###** Preset positions — CENTER, TOP_LEFT, TOP_CENTER, TOP_RIGHT, BOTTOM_LEFT, BOTTOM_CENTER, BOTTOM_RIGHT place the overlay per §3.11 relative to the visible viewport of the base screen. _Data:_ `overlayPositionType`. _Test:_ V-11 (each preset, device viewport 390×844, overlay 200×100, base screen scrolled 300 px). _M7·P0·[DOC:360039818254 excerpt] [KNOW]_
- [ ] **PR-###** Default position — A frame never used as overlay has `overlayPositionType` CENTER (V-11). _Data:_ default. _Test:_ V-11 read via plugin. _M7·P1·[KNOW]_
- [ ] **PR-###** Manual position authoring — Choosing Manual lets the user drag an overlay preview on canvas; the offset is stored on the action relative to the hotspot. _Data:_ `overlayRelativePosition`. _Test:_ drag preview; read `overlayRelativePosition`. _M7·P0·[DOC:360039818254 excerpt] [API]_
- [ ] **PR-###** Manual position runtime — Overlay opens at hotspot position + offset, using the hotspot's on-screen position at open time (scrolled). _Data:_ same. _Test:_ V-11 (hotspot in scrolled list). _M7·P1·[API] [KNOW]_
- [ ] **PR-###** Close when clicking outside — Clicking outside the overlay's bounds closes it. _Data:_ `CLOSE_ON_CLICK_OUTSIDE`. _Test:_ click outside → closes. _M7·P0·[DOC:360039818254 excerpt]_
- [ ] **PR-###** Outside click consumption — The outside click that closes an overlay does not also fire hotspots beneath (V-11). _Data:_ runtime. _Test:_ V-11. _M7·P1·[KNOW]_
- [ ] **PR-###** Outside click with stacked overlays — Closes only the topmost overlay (V-11). _Data:_ runtime. _Test:_ V-11. _M7·P1·[KNOW]_
- [ ] **PR-###** Background behind overlay — Enabling adds a solid color layer between overlay and screen; initial color #000000 at 25 %; color/opacity editable. _Data:_ `overlayBackground {SOLID_COLOR, color}`. _Test:_ enable; read color `{r:0,g:0,b:0,a:0.25}`. _M7·P0·[DOC:360039818254 excerpt] [API]_
- [ ] **PR-###** Background and underlying interaction — Whether the base screen stays clickable around an overlay without close-outside, with/without background, matches Figma (V-11). _Data:_ runtime. _Test:_ V-11. _M7·P1·[KNOW]_
- [ ] **PR-###** Overlay stacking — Opening an overlay from an overlay stacks it on top; each keeps its own position. _Data:_ runtime stack. _Test:_ V-11. _M7·P0·[KNOW]_
- [ ] **PR-###** Navigate closes overlays — Navigate to from inside an overlay replaces the base screen and closes all overlays. _Data:_ `NAVIGATE`. _Test:_ button inside overlay → Navigate. _M7·P0·[API]_
- [ ] **PR-###** Overlay close animation — Closing (Close, Back, outside click) plays the reverse of the opening transition (V-15). _Data:_ runtime. _Test:_ V-15 overlay section. _M7·P1·[KNOW]_
- [ ] **PR-###** Large & scrolling overlays — Overlays larger than the viewport are clipped/positioned per Figma; overlays with overflow scroll internally (V-11). _Data:_ `overflowDirection`. _Test:_ V-11. _M7·P1·[KNOW]_
- [ ] **PR-###** Overlay background blur — A background-blur effect on the overlay frame blurs the screen beneath in the player. _Data:_ overlay `effects`. _Test:_ overlay with background blur 20. _M7·P2·[SRC:forum.figma.com/suggest-a-feature-11/add-background-blur-when-opening-overlay-21951]_
- [ ] **PR-###** No actions on implicit close — Close-on-click-outside cannot run extra actions. _Data:_ n/a. _Test:_ confirm no UI to attach actions. _M7·P2·[SRC:forum.figma.com/t/action-when-closing-overlay-when-clicking-outside/85912]_

### 6.8 Multiple actions & conditionals

- [ ] **PR-###** Multiple actions per trigger — One trigger can hold an unlimited number of actions, executed top to bottom. _Data:_ `Reaction.actions[]`. _Test:_ 12 Set variable actions incrementing a counter in order; text shows each step's expected final value. _M7·P0·[DOC:15253220891799 excerpt]_
- [ ] **PR-###** Reorder actions — Actions reorder by dragging their handle; any action can be dragged into/out of a Conditional block. _Data:_ order of `actions`, `conditionalBlocks[].actions`. _Test:_ drag; read order. _M7·P1·[DOC:15253220891799 excerpt]_
- [ ] **PR-###** Sequential animations — When several actions animate, each runs after the previous animation finishes. _Data:_ runtime. _Test:_ Navigate (Dissolve 1000 ms) then Scroll to (animate 1000 ms); record timeline: ~2000 ms total. _M7·P0·[DOC:15253220891799 excerpt]_
- [ ] **PR-###** Order changes outcome — Set variable then Conditional differs from Conditional then Set variable, exactly as in Figma's example. _Data:_ order. _Test:_ reproduce both orders; record resulting screen. _M7·P0·[DOC:15253220891799 excerpt]_
- [ ] **PR-###** Action context after navigation — Behavior of actions placed after a navigation in the same list (which screen Change to/Scroll to resolve against) matches Figma. _Data:_ runtime. _Test:_ V-20. _M7·P1·[KNOW]_
- [ ] **PR-###** Input during running actions — Triggers arriving while an action list is mid-animation are queued/ignored exactly as Figma (V-21). _Data:_ runtime. _Test:_ V-21. _M7·P1·[KNOW]_
- [ ] **PR-###** Conditional if/else — If field takes a boolean expression; true runs the if-actions, false runs the else-actions. _Data:_ `CONDITIONAL`, `conditionalBlocks`. _Test:_ toggle a boolean; click; record branch. _M7·P0·[DOC:15253220891799 excerpt] [API]_
- [ ] **PR-###** Else block encoding — The else block is a `ConditionalBlock` without `condition`; it may be absent. _Data:_ `condition?`. _Test:_ create if-only and if/else in Figma; read via plugin; Illigma encodes identically. _M7·P0·[API]_
- [ ] **PR-###** First matching block — With N blocks, only the first block whose condition is true (or the else block) executes. _Data:_ `conditionalBlocks[]`. _Test:_ V-22 (plugin-authored 3-block chain). _M7·P0·[API] [KNOW]_
- [ ] **PR-###** Runtime supports full data model — Nested Conditionals and else-if chains from imported data execute correctly even if the authoring UI cannot create them. _Data:_ nested `CONDITIONAL`. _Test:_ plugin-authored nested conditional in Figma; same branch results in Illigma. _M8·P1·[API] [SRC:forum.figma.com/t/validating-two-variables-nested-conditionals/47658/2]_
- [ ] **PR-###** Conditional authoring limits — Illigma's UI allows exactly what Figma's UI allows for nesting and else-if (V-22). _Data:_ UI. _Test:_ V-22. _M7·P1·[SRC:forum.figma.com/t/we-could-use-if-else-if-else-statements/54298]_
- [ ] **PR-###** Invalid condition — Unsupported operations/format are outlined red in the editor; runtime outcome per V-22. _Data:_ `condition`. _Test:_ type `a ==` and `a & b`; record UI + runtime. _M7·P1·[DOC:15253220891799 excerpt]_
- [ ] **PR-###** Stacked conditionals — Separate Conditional actions in one list each evaluate in order and see changes made by earlier actions. _Data:_ order. _Test:_ two conditionals where the first's action makes the second true; both branches run. _M7·P1·[SRC:forum.figma.com/t/we-could-use-if-else-if-else-statements/54298]_
- [ ] **PR-###** No reactive evaluation — Conditions evaluate only when their trigger fires; variable changes alone never fire actions. _Data:_ runtime. _Test:_ change a variable elsewhere; conditional on another layer does not run. _M7·P1·[SRC: forum report via search excerpt]_

### 6.9 Variables & expressions in prototypes

- [ ] **PR-###** Set variable target — Picker lists local variables of all four types (boolean, number, string, color). _Data:_ `SET_VARIABLE.variableId`. _Test:_ record picker list with local + library variables present. _M7·P0·[DOC:14506587589399 excerpt] [SRC:forum.figma.com/ask-the-community-7/can-t-access-published-variables-for-prototyping-33816]_
- [ ] **PR-###** Library variables read-only — Remote/library variables cannot be Set variable targets but can be read in expressions. _Data:_ `Variable.remote`. _Test:_ V-25. _M7·P1·[SRC:forum…33816]_
- [ ] **PR-###** Literal values — Value editor per type: toggle for boolean, number field, text field, color picker for color. _Data:_ `variableValue {type, resolvedType, value}`. _Test:_ set each; read `VariableData`. _M7·P0·[API] [KNOW]_
- [ ] **PR-###** Expressions allowed by type — Expressions accepted for number, string and boolean targets; not for color. _Data:_ `variableValue.type:'EXPRESSION'`. _Test:_ attempt expression on color target; refused. _M7·P0·[DOC:15253194385943 excerpt]_
- [ ] **PR-###** Bound properties update — After Set variable, every bound property on the visible screen and overlays updates immediately: text content, visibility, width/height, radii, paddings/gaps, opacity, paints; auto layout re-flows. _Data:_ `boundVariables`, `VariableBindableNodeField`. _Test:_ counter bound to text and to a frame width inside hug auto layout; click; record new layout. _M7·P0·[DOC:14506587589399 excerpt] [API]_
- [ ] **PR-###** Variable change animation — Whether property changes caused by Set variable animate (expected: instant) matches Figma. _Data:_ runtime. _Test:_ V-25. _M7·P2·[KNOW]_
- [ ] **PR-###** Runtime-only values — Variable values changed in the player never modify the document; closing the player or Restart restores authored values. _Data:_ `PlayerSession.variableValues`. _Test:_ increment counter; Restart → initial value; editor shows unchanged variable. _M7·P0·[SRC:forum.figma.com/ask-the-community-7/re-start-prototype-without-re-setting-variables-29061] [KNOW]_
- [ ] **PR-###** Mode independence — A runtime value set by Set variable applies regardless of which mode a layer resolves (no per-mode setting). _Data:_ runtime override. _Test:_ V-25. _M7·P1·[SRC:forum.figma.com/suggest-a-feature-11/set-variable-value-for-specific-mode-36362]_
- [ ] **PR-###** Set variable mode — Switches the current page's mode for the chosen collection; layers whose mode is Auto re-resolve immediately. _Data:_ `SET_VARIABLE_MODE {variableCollectionId, variableModeId}`. _Test:_ Light/Dark collection; button sets Dark; Auto layers switch. _M7·P0·[DOC:14506587589399 excerpt]_
- [ ] **PR-###** Explicit modes vs Set variable mode — Layers with an explicit mode for that collection keep it (V-25). _Data:_ `explicitVariableModes`. _Test:_ V-25. _M7·P1·[KNOW]_
- [ ] **PR-###** Number operators — `+ - * /` on numbers. _Data:_ ADDITION, SUBTRACTION, MULTIPLICATION, DIVISION. _Test:_ `count * 2 - 1` with count=3 → 5. _M7·P0·[DOC:15253194385943 excerpt] [API]_
- [ ] **PR-###** String concatenation — `+` appends strings. _Data:_ ADDITION. _Test:_ `first + " " + last`. _M7·P0·[DOC:15253194385943 excerpt]_
- [ ] **PR-###** Comparisons — `== != > < >= <=` produce booleans. _Data:_ EQUALS … LESS_THAN_OR_EQUAL. _Test:_ truth table for numbers and strings (`"a" == "a"`). _M7·P0·[DOC:15253194385943 excerpt] [API]_
- [ ] **PR-###** Logical operators — `and`, `or` combine booleans. _Data:_ AND, OR. _Test:_ `a == 1 and b == 1` (forum example). _M7·P0·[DOC:15253194385943 excerpt] [SRC:forum.figma.com/t/validating-two-variables-nested-conditionals/47658/2]_
- [ ] **PR-###** NOT / NEGATE / VAR_MODE_LOOKUP — Evaluated per their names when present in data; UI exposure per V-23. _Data:_ ExpressionFunction. _Test:_ V-23 with plugin-authored expressions. _M7·P1·[API]_
- [ ] **PR-###** Precedence and grouping — Operator precedence and any parentheses support match Figma (V-23). _Data:_ expression tree shape. _Test:_ V-23 (`1 + 2 * 3`). _M7·P1·[KNOW]_
- [ ] **PR-###** Type coercion — number+string, boolean in arithmetic, comparisons across types behave as Figma (V-23). _Data:_ runtime. _Test:_ V-23. _M7·P1·[KNOW]_
- [ ] **PR-###** Division by zero — Result and display match Figma (V-23). _Data:_ runtime. _Test:_ V-23. _M7·P2·[KNOW]_
- [ ] **PR-###** Number display in bound text — Float formatting (decimals, trailing zeros, large numbers) when a number variable feeds a text layer matches Figma (V-23). _Data:_ runtime. _Test:_ V-23 (0.1+0.2, 1/3, 1e7). _M7·P1·[KNOW]_
- [ ] **PR-###** Expression editor — Typed text with variable tokens (autocomplete by name), literals and operators; invalid input outlined red. _Data:_ `Expression` tree. _Test:_ build `count + 1`; read stored tree: `{ADDITION, [VARIABLE_ALIAS count, FLOAT 1]}`. _M7·P1·[DOC:15253194385943 excerpt] [API]_
- [ ] **PR-###** Alias resolution — Variable aliases (variable → variable) resolve at evaluation time using runtime overrides and current modes. _Data:_ `VARIABLE_ALIAS`. _Test:_ alias B→A; set A; expression reads B. _M7·P1·[API] [KNOW]_
- [ ] **PR-###** Missing variable — Actions/expressions referencing a deleted variable show a missing state in the editor and are no-ops at runtime (V-25). _Data:_ dangling `variableId`. _Test:_ V-25. _M7·P1·[KNOW]_
- [ ] **PR-###** Visibility toggles hotspots — Hiding a layer via a boolean variable removes it from hit testing; showing it restores it. _Data:_ `visible` binding. _Test:_ toggle; click previously-covered hotspot. _M7·P1·[KNOW]_

### 6.10 Transitions

- [ ] **PR-###** Instant — `transition:null`; destination appears immediately. _Data:_ `transition:null`. _Test:_ frame-capture shows no intermediate frame. _M7·P0·[API] [DOC:360040522373 excerpt]_
- [ ] **PR-###** Dissolve — Destination fades in on top of the current screen over `duration` with `easing`. _Data:_ `DISSOLVE`. _Test:_ 1000 ms linear; capture at 50 %: destination opacity ≈ 0.5 over unchanged source. _M7·P0·[DOC:360040522373 excerpt]_
- [ ] **PR-###** Move in — Destination moves in from the edge opposite the direction while the current screen stays stationary. _Data:_ `MOVE_IN`, `direction`. _Test:_ V-15. _M7·P0·[DOC:360040522373 excerpt]_
- [ ] **PR-###** Move out — Current screen moves out in `direction`, revealing the stationary destination. _Data:_ `MOVE_OUT`. _Test:_ V-15. _M7·P0·[DOC:360040522373 excerpt]_
- [ ] **PR-###** Push — Destination pushes the current screen out; both move together. _Data:_ `PUSH`. _Test:_ V-15. _M7·P0·[DOC:360040522373 excerpt]_
- [ ] **PR-###** Slide in — Destination slides in over the current screen while the current screen is slightly offset and dims/dissolves (factor V-15). _Data:_ `SLIDE_IN`. _Test:_ V-15. _M7·P1·[DOC:360040522373 excerpt]_
- [ ] **PR-###** Slide out — Current screen slides out over the destination, which is slightly offset (factor V-15). _Data:_ `SLIDE_OUT`. _Test:_ V-15. _M7·P1·[DOC:360040522373 excerpt]_
- [ ] **PR-###** Direction convention — LEFT/RIGHT/TOP/BOTTOM mean the direction of motion as in Figma (V-15). _Data:_ `direction`. _Test:_ V-15. _M7·P0·[API] [KNOW]_
- [ ] **PR-###** Match layers — Directional transitions with "Smart animate matching layers" smart-animate matched layers while the rest performs the directional motion. _Data:_ `matchLayers:true`. _Test:_ V-15 (shared header). _M7·P1·[API]_
- [ ] **PR-###** Duration — Integer-ms field, default 300 ms, valid range per V-14; stored per §2.11. _Data:_ `duration`. _Test:_ V-14 (enter 0, 1, 99999, 12.6). _M7·P0·[API] [KNOW]_
- [ ] **PR-###** Spring duration — With spring easings the effective (and displayed) duration is derived from the spring parameters (V-14). _Data:_ `duration`, `easingFunctionSpring`. _Test:_ V-14. _M7·P1·[SRC:forum.figma.com/report-a-problem-6/unable-to-set-correct-spring-animation-duration-through-api-33811]_
- [ ] **PR-###** Viewport clipping — All transitions render clipped to the device viewport (or screen bounds with no device). _Data:_ runtime. _Test:_ Push with device iPhone; nothing draws over bezel. _M7·P1·[KNOW]_
- [ ] **PR-###** Fixed layers during transitions — Fixed and sticky layers move with their screen during directional transitions (V-15). _Data:_ runtime. _Test:_ V-15. _M7·P2·[KNOW]_
- [ ] **PR-###** Time-based animation — Animation progress derives from elapsed time, so dropped frames never lengthen a transition; target display refresh rate. _Data:_ runtime. _Test:_ throttle CPU; 300 ms transition still ends at 300±20 ms. _M7·P0·Illigma quality rule_

### 6.11 Easing

- [ ] **PR-###** Curve menu — Lists Ease in, Ease out, Ease in and out, Linear, Ease in back, Ease out back, Ease in and out back, Custom bezier, Gentle, Quick, Bouncy, Slow, Custom spring, in Figma's order (V-14). _Data:_ `Easing.type`. _Test:_ V-14 record order. _M7·P0·[API] [DOC:360051748654 excerpt]_
- [ ] **PR-###** Bezier preset values — Each bezier preset evaluates exactly with the parameters in §2.8 (once V-14 confirms). _Data:_ `easingFunctionCubicBezier`. _Test:_ V-14 (select preset → switch to Custom bezier → read seeded numbers). _M7·P0·[KNOW]_
- [ ] **PR-###** Back easings overshoot — Ease in/out back curves overshoot (values outside 0–1) without clamping, for position, size and opacity (opacity clamped at render only). _Data:_ `EASE_*_BACK`. _Test:_ Smart animate x 0→100 with Ease out back; capture max x > 100. _M7·P0·[API] [DOC:360051748654 excerpt]_
- [ ] **PR-###** Custom bezier editor — Selecting Custom bezier shows a graph editor seeded with the previously selected curve's values; handles draggable; four numeric fields. _Data:_ `CUSTOM_CUBIC_BEZIER`. _Test:_ choose Ease in → Custom; fields = Ease in values. _M7·P1·[DOC:360051748654 excerpt]_
- [ ] **PR-###** Custom bezier constraints — x1, x2 limited to [0,1]; y1, y2 unbounded (V-14). _Data:_ `x1,y1,x2,y2`. _Test:_ V-14 (enter x1=1.5, y1=−2). _M7·P1·[KNOW]_
- [ ] **PR-###** Copy bezier values — Numeric values can be copied/pasted between interactions; custom curves cannot be saved as named presets. _Data:_ none. _Test:_ copy field text to another interaction. _M7·P2·[DOC:360051748654 excerpt]_
- [ ] **PR-###** Spring presets — Gentle, Quick, Bouncy, Slow use the parameters in §2.8 (once V-14 confirms). _Data:_ `GENTLE|QUICK|BOUNCY|SLOW`. _Test:_ V-14 (preset → Custom spring → read seeded values). _M7·P0·[API] [KNOW]_
- [ ] **PR-###** Custom spring — Editable stiffness, damping, mass (ranges V-14); `initialVelocity` preserved (default 0; REST import has none). _Data:_ `easingFunctionSpring`. _Test:_ V-14. _M7·P1·[API]_
- [ ] **PR-###** Spring solver — Spring progress follows the damped-oscillator solution in §3.14 within 0.5 % of a reference implementation at 1 ms steps. _Data:_ runtime. _Test:_ golden curves for each preset compared to frame captures from Figma (V-14). _M7·P0·[KNOW]_
- [ ] **PR-###** Easing scope — Easing applies to every non-instant transition including Scroll to animation and Change to. _Data:_ `transition.easing`. _Test:_ Scroll to with Linear vs Ease in: different capture curves. _M7·P1·[API]_

### 6.12 Smart animate

- [ ] **PR-###** Layer matching — Layers match when their name path below the screen is equal (screen names ignored), considering hierarchy and order. _Data:_ `name`, tree. _Test:_ V-26 cases "same name different parent", "renamed screen". _M7·P0·[DOC:360039818874 excerpt] [SRC:forum.figma.com/t/what-are-the-layer-matching-rules-of-smart-animate/5935]_
- [ ] **PR-###** Duplicate names — Sibling layers with identical names pair up in layer order (V-26). _Data:_ order. _Test:_ V-26. _M7·P1·[SRC:figma.com/blog/announcing-smart-animate-and-advanced-transitions/]_
- [ ] **PR-###** Type compatibility — Matching across different layer types follows Figma (V-26). _Data:_ `type`. _Test:_ V-26 (rect→ellipse, frame→group, text→text). _M7·P1·[KNOW]_
- [ ] **PR-###** Unmatched layers — Layers only in the destination dissolve in; layers only in the source dissolve out. _Data:_ runtime. _Test:_ add a badge in destination; capture fade. _M7·P0·[DOC:360040522373 excerpt]_
- [ ] **PR-###** Unchanged layers — Matched layers with identical properties are not animated. _Data:_ runtime. _Test:_ capture shows no change. _M7·P1·[DOC:360040522373 excerpt]_
- [ ] **PR-###** Animatable properties — Exactly Figma's set (expected: x, y, width, height, rotation, opacity, solid fill/stroke color, corner radius, blur …; V-26) interpolate. _Data:_ node properties. _Test:_ V-26 property matrix. _M7·P0·[SRC:figanimations.com/blogs/the-complete-guide-to-smart-animate-in-figma] [KNOW]_
- [ ] **PR-###** Unsupported changes — Shape morphs (different geometry) and other unsupported properties (shadows per article, V-26) jump or crossfade exactly as Figma. _Data:_ runtime. _Test:_ V-26. _M7·P1·[DOC:360040522373 excerpt]_
- [ ] **PR-###** Rotation path — Rotation interpolates along Figma's path (shortest vs numeric, e.g. 10°→350°) (V-26). _Data:_ `rotation`. _Test:_ V-26. _M7·P2·[KNOW]_
- [ ] **PR-###** Text layers — Content, font size and color changes in matched text layers animate/crossfade as Figma (V-26). _Data:_ `characters`, text style. _Test:_ V-26. _M7·P1·[KNOW]_
- [ ] **PR-###** Instances & variants — Children of matched instances (also across variant changes via Change to) are matched by path and animated. _Data:_ instance subtree. _Test:_ toggle switch component (knob moves) with Smart animate 300 ms. _M7·P0·[DOC:360061175334 excerpt] [KNOW]_
- [ ] **PR-###** Auto layout — Smart animate interpolates between the resolved (laid-out) positions/sizes of auto-layout children. _Data:_ resolved layout. _Test:_ list item expands in destination; siblings slide. _M7·P0·[KNOW]_
- [ ] **PR-###** Overlay fallback — Smart animate is not applied to Open overlay (overlays are new frames). _Data:_ runtime. _Test:_ V-26 (force via plugin: record what Figma does). _M7·P1·[DOC:360040522373 excerpt]_
- [ ] **PR-###** No matches — Smart animate with no matching layers behaves like Dissolve. _Data:_ runtime. _Test:_ two unrelated screens. _M7·P1·[DOC:360040522373 excerpt]_
- [ ] **PR-###** Scroll offset continuity — Matched scroll containers animate between their scroll offsets per Figma (V-26). _Data:_ runtime. _Test:_ V-26. _M7·P2·[KNOW]_

### 6.13 Scrolling, fixed & sticky

- [ ] **PR-###** Overflow options — No scrolling, Horizontal, Vertical, Both. _Data:_ `overflowDirection` NONE/HORIZONTAL/VERTICAL/BOTH. _Test:_ set each; read via plugin. _M7·P0·[API] [DOC:360039818734 excerpt]_
- [ ] **PR-###** Scroll range — A frame scrolls only along enabled axes and only by the amount its content (children bounds) exceeds the frame. _Data:_ children bounds. _Test:_ V-27 (content 200 px taller → max scroll 200). _M7·P0·[DOC:360039818734 excerpt] [KNOW]_
- [ ] **PR-###** Top-level auto-scroll — Screens larger than the device viewport scroll (vertically/horizontally) without `overflowDirection`. _Data:_ screen size vs viewport. _Test:_ 390×2000 screen on iPhone device scrolls. _M7·P0·[API]_
- [ ] **PR-###** Nested scroll clipping — Scrollable nested frames clip their content in the player (V-27, incl. when clip content is off). _Data:_ `clipsContent`. _Test:_ V-27. _M7·P0·[KNOW]_
- [ ] **PR-###** Scroll input — Wheel/trackpad scroll (Shift+wheel horizontal), click-drag scroll and scrollbar visibility match Figma's desktop player (V-27). _Data:_ runtime. _Test:_ V-27. _M7·P1·[KNOW]_
- [ ] **PR-###** Nested scroll chaining — When an inner scroller reaches its limit, further scrolling passes (or not) to the outer scroller as in Figma (V-27). _Data:_ runtime. _Test:_ V-27. _M7·P1·[KNOW]_
- [ ] **PR-###** Fixed position — A Fixed child stays stationary while its scroll container scrolls. _Data:_ `scrollBehavior:'FIXED'`. _Test:_ fixed header in scrolling screen. _M7·P0·[DOC:360039818734 excerpt]_
- [ ] **PR-###** Fixed z-order invariant — Setting Fixed moves the layer into the parent's fixed segment above all scrolling children; layers panel shows "Fixed"/"Scrolls" headers when ≥1 fixed child. _Data:_ `numberOfFixedChildren`. _Test:_ set Fixed on the bottom-most child; read children order + `numberOfFixedChildren`. _M7·P0·[API]_
- [ ] **PR-###** Fixed in auto layout — Fixed is available only for absolutely-positioned children of auto-layout frames. _Data:_ `layoutPositioning:'ABSOLUTE'`. _Test:_ Position dropdown disabled/enabled. _M7·P0·[DOC:360039818734 excerpt]_
- [ ] **PR-###** Sticky — Sticky layers scroll normally until reaching the top edge of their vertical scroll container, then stick; only offered for vertically scrolling containers. _Data:_ `scrollBehavior:'STICKY_SCROLLS'`. _Test:_ section headers in a list. _M7·P1·[DOC:360039818734 excerpt]_
- [ ] **PR-###** Sticky edge cases — Release when the parent scrolls away, multiple sticky siblings, stacking order interplay (V-27). _Data:_ runtime. _Test:_ V-27. _M7·P2·[SRC:forum.figma.com/ask-the-community-7/navigation-bar-s-scroll-position-stick-and-first-on-top-not-working-41540]_
- [ ] **PR-###** Fixed in screens — Fixed children of a top-level screen stay fixed relative to the device viewport while the screen scrolls (bottom-anchored bars per V-27). _Data:_ `FIXED`. _Test:_ V-27 (tab bar at bottom of tall screen). _M7·P0·[KNOW] [SRC:forum report via search excerpt]_
- [ ] **PR-###** Scroll behavior import — REST `scrollBehavior` and deprecated `isFixed` import to Illigma's canonical model with the z-order invariant. _Data:_ `scrollBehavior`, `isFixed`. _Test:_ REST fixture with a FIXED child below scrolling children → reordered/flagged per V-27. _M8·P1·[API]_
- [ ] **PR-###** Scroll memorization — Scroll positions of screens and scrollable layers are remembered by default when navigating away and back. _Data:_ runtime `scrollMemory`. _Test:_ scroll A 500 px → B → Back: A at 500. _M7·P0·[DOC:360051747774 excerpt]_
- [ ] **PR-###** Scroll sharing by name — Screens with identical names or a shared name prefix share scroll state (V-27 for exact prefix rule). _Data:_ screen `name`. _Test:_ "Checkout / Empty" → "Checkout / Complete" keeps scroll; "Cart" → "Checkout" does not. _M7·P1·[DOC:360051747774 excerpt] [SRC:forum.figma.com/t/solved-preserve-scroll-position-not-working-please-roll-back-the-feature/44115]_
- [ ] **PR-###** Reset scroll position — The interaction's "Reset scroll position" checkbox resets scroll for that navigation, overriding memorization/sharing. _Data:_ `resetScrollPosition`. _Test:_ same as sharing test with box checked → top. _M7·P0·[DOC:360051747774 excerpt] [API]_
- [ ] **PR-###** Legacy preserve flag — Pre-2023 `preserveScrollPosition` maps to `resetScrollPosition = !preserveScrollPosition` on import. _Data:_ `preserveScrollPosition`. _Test:_ fixture. _M8·P1·[API] [DOC:360051747774 excerpt]_
- [ ] **PR-###** Reset component state — "Reset component state" resets interactive-component variants in the destination; otherwise states are memorized like scroll (V-27). _Data:_ `resetInteractiveComponents`. _Test:_ V-27. _M7·P1·[API]_
- [ ] **PR-###** Scroll physics — Momentum/overscroll behavior equals Figma desktop player (V-27). _Data:_ runtime. _Test:_ V-27. _M7·P2·[KNOW]_

### 6.14 Interactive components

- [ ] **PR-###** Variant interactions inherited — Every instance of a component set carries the interactions authored between its variants. _Data:_ variant `reactions`. _Test:_ 3 instances; each toggles independently. _M7·P0·[DOC:360061175334 excerpt]_
- [ ] **PR-###** Per-instance runtime state — Each instance holds its own current variant during the session; the document is unchanged. _Data:_ `instanceVariant`. _Test:_ toggle one of 3 instances; others unchanged; editor unchanged. _M7·P0·[KNOW]_
- [ ] **PR-###** Hover variant revert — While hovering → Change to Hover reverts to the previous variant on leave. _Data:_ `ON_HOVER` + `CHANGE_TO`. _Test:_ button Default/Hover. _M7·P0·[SRC:smashingmagazine.com] [API]_
- [ ] **PR-###** Overrides across Change to — Instance overrides (text, fills, nested swaps) carry across runtime variant changes as in Figma (V-17). _Data:_ instance overrides. _Test:_ V-17. _M7·P1·[KNOW]_
- [ ] **PR-###** Nested interactive instances — An interactive instance inside another interactive component keeps its own interactions; the deepest handler wins per trigger. _Data:_ nested reactions. _Test:_ checkbox inside list-item component, both with On click. _M7·P1·[SRC:forum.figma.com/archive-21/prototyping-limits-nested-interactive-component-interactions-12308] [KNOW]_
- [ ] **PR-###** Instance-level interactions — Regular interactions can be added on an instance in a screen in addition to its variant interactions; precedence for the same trigger per V-30. _Data:_ instance `reactions`. _Test:_ V-30. _M7·P1·[SRC:smashingmagazine.com]_
- [ ] **PR-###** After delay on variants — After delay on a variant runs when an instance shows that variant, enabling loops (spinner A→B→A). _Data:_ `AFTER_TIMEOUT` on variant. _Test:_ V-12 (2-variant loop at 500 ms). _M7·P1·[KNOW]_
- [ ] **PR-###** Boolean consolidation drops connections — Converting variants into a boolean property removes prototype connections that pointed between them. _Data:_ reactions. _Test:_ reproduce in Figma; record warning. _M5·P2·[SRC: search excerpt of DOC:5579474826519]_
- [ ] **PR-###** Missing variant target — If the Change to destination variant is deleted, the action becomes inert (V-33). _Data:_ dangling `destinationId`. _Test:_ V-33. _M7·P1·[KNOW]_

### 6.15 Reactions on components & instances

- [ ] **PR-###** Main component reactions propagate — Interactions on a main component (or its children) appear on all instances and work in the player. _Data:_ component `reactions`. _Test:_ V-30. _M7·P0·[DOC:4404380377367 title] [KNOW]_
- [ ] **PR-###** Instance reaction overrides — Editing an instance's interactions creates an override; "Reset all changes" restores inherited ones. _Data:_ instance override of `reactions`. _Test:_ V-30. _M7·P1·[KNOW]_
- [ ] **PR-###** Detach keeps reactions — Detaching an instance keeps its effective interactions on the resulting frame. _Data:_ `reactions`. _Test:_ V-30. _M7·P1·[KNOW]_
- [ ] **PR-###** Swap instance — After swapping an instance, its interactions follow Figma's override rules (V-30). _Data:_ `reactions`. _Test:_ V-30. _M7·P2·[KNOW]_
- [ ] **PR-###** Cross-page main components — Connections defined on a main component living on another page resolve per Figma (V-30). _Data:_ `destinationId`. _Test:_ V-30. _M7·P2·[SRC:forum.figma.com/ask-the-community-7/nested-component-navigation-interaction-not-working-in-screens-on-another-page-19105]_

### 6.16 Video & GIF

- [ ] **PR-###** Video playback defaults — Video fills play in the player with Figma's default autoplay/loop/mute behavior and settings location (V-24). _Data:_ `VideoPaint` (+ provisional `playback`). _Test:_ V-24. _M7·P1·[KNOW]_
- [ ] **PR-###** Play / pause / toggle — Media actions PLAY, PAUSE, TOGGLE_PLAY_PAUSE control the target video. _Data:_ `UPDATE_MEDIA_RUNTIME.mediaAction`. _Test:_ three buttons; record state. _M7·P1·[API]_
- [ ] **PR-###** Mute / unmute / toggle — MUTE, UNMUTE, TOGGLE_MUTE_UNMUTE. _Data:_ `mediaAction`. _Test:_ audio meter. _M7·P1·[API]_
- [ ] **PR-###** Skip forward/backward — Moves playback by `amountToSkip` seconds, clamped to [0, duration] (V-24). _Data:_ `amountToSkip`. _Test:_ V-24 (skip −10 at 3 s). _M7·P1·[API]_
- [ ] **PR-###** Jump to time — SKIP_TO sets playback to `newTimestamp` seconds (clamped, V-24). _Data:_ `newTimestamp`. _Test:_ V-24. _M7·P1·[API]_
- [ ] **PR-###** Implicit media target — `destinationId:null` targets the video layer that contains the action. _Data:_ `destinationId`. _Test:_ action on the video itself. _M7·P1·[API]_
- [ ] **PR-###** Video position memory — Video playback position is memorized per screen; `resetVideoPosition` restarts destination videos at 00:00. _Data:_ `resetVideoPosition`. _Test:_ play to 5 s → navigate → back: resumes at ~5 s; with reset: 0 s. _M7·P1·[API]_
- [ ] **PR-###** Supported video formats — Player plays MP4, MOV and WebM sources accepted by import (≤100 MB). _Data:_ video asset. _Test:_ one file of each format plays. _M7·P2·[API]_
- [ ] **PR-###** Animated GIFs — Animated GIF image fills animate in the player (loop/restart per V-24). _Data:_ image asset. _Test:_ V-24. _M7·P1·[DOC:360041486873 title] [KNOW]_

### 6.17 Device & background

- [ ] **PR-###** Device types — Device can be None, a preset, Custom size or Presentation. _Data:_ `prototypeDevice.type`. _Test:_ set each in Figma; read REST `prototypeDevice`; Illigma stores same. _M7·P0·[API] [DOC:21158597546391 excerpt]_
- [ ] **PR-###** Preset catalog — Device presets (categories, models, sizes, colors) and their `presetIdentifier` strings match Figma's current list (V-28). _Data:_ `presetIdentifier`, `size`. _Test:_ V-28. _M7·P1·[API]_
- [ ] **PR-###** Device suggestion — Using a frame preset makes the device dropdown select the matching device (V-28). _Data:_ UI. _Test:_ V-28. _M7·P2·[DOC:21158597546391 excerpt]_
- [ ] **PR-###** Rotation — Rotate toggles portrait/landscape (`CCW_90`), swapping viewport width/height. _Data:_ `rotation`. _Test:_ rotate; player viewport swaps. _M7·P1·[API]_
- [ ] **PR-###** Custom size — Custom size stores width/height; in the player it fits the design to the window. _Data:_ `size`. _Test:_ 1440×900 custom in a 1280×720 window. _M7·P1·[API] [DOC:21158597546391 excerpt]_
- [ ] **PR-###** Device frame rendering — With a preset, the player draws a device frame (Illigma's own artwork) around a clipped viewport; "Show device frame" toggles it. _Data:_ player option. _Test:_ toggle option; viewport size unchanged. _M7·P1·[DOC:21158597546391 excerpt]_
- [ ] **PR-###** Prototype background — Background fills the player area outside the viewport/device; single solid color; default per V-29. _Data:_ `prototypeBackgrounds`. _Test:_ set #FF0000; player background red; read default on a new file. _M7·P0·[API]_
- [ ] **PR-###** One device per page — Device and background are per page; different pages can differ. _Data:_ page-level. _Test:_ two pages, two devices. _M7·P1·[API] [SRC:forum.figma.com/t/assign-a-prototype-device-to-specific-frames-screens/20228]_
- [ ] **PR-###** Device edits are document edits — Changing device/background is saved and undoable. _Data:_ page fields. _Test:_ change; undo; save/reopen. _M7·P0·[KNOW]_

### 6.18 In-app player (presentation view)

- [ ] **PR-###** Open player — Present opens Illigma's player window (desktop) / full-window player (browser build) without network access. _Data:_ runtime. _Test:_ offline machine; Present works. _M7·P0·Illigma local-first rule_
- [ ] **PR-###** Start resolution — Selected screen (or the screen containing the selection) → that screen; else the first flow; else the first screen per V-29. _Data:_ `flowStartingPoints`. _Test:_ V-29. _M7·P0·[API] [KNOW]_
- [ ] **PR-###** Present a specific flow — From the flows list or canvas badge, the player opens at that flow's start. _Data:_ flow. _Test:_ second flow badge → player at flow 2. _M7·P1·[DOC:360039823894 excerpt] [KNOW]_
- [ ] **PR-###** Flows sidebar — Lists all flows of the page with names/descriptions; selecting one restarts at its starting screen. _Data:_ `flowStartingPoints`. _Test:_ switch flows; state reset. _M7·P1·[DOC:360040318013 excerpt] [KNOW]_
- [ ] **PR-###** Restart — R or the restart button returns to the current flow's starting screen and clears history, overlays, variables, modes, component states, scroll/video memory. _Data:_ `PlayerSession`. _Test:_ mutate everything; R; all initial. _M7·P0·[SRC:inthepocket.design/course/figma-for-everyone/prototyping] [KNOW]_
- [ ] **PR-###** Arrow-key stepping — ←/→ move to previous/next screen in Figma's order (page order vs flow order, V-31). _Data:_ runtime. _Test:_ V-31. _M7·P1·[SRC: search excerpt of DOC:360040318013]_
- [ ] **PR-###** Esc — Esc exits (fullscreen / player) as Figma (V-31). _Data:_ runtime. _Test:_ V-31. _M7·P1·[SRC: search excerpt]_
- [ ] **PR-###** Scaling modes — Actual size, scale down to fit, fill (up or down), fit width; availability rules: fit width only with No device/Presentation, respect aspect ratio only with No device, show device frame only with a device. _Data:_ player options. _Test:_ V-31. _M7·P1·[DOC:21158597546391 excerpt] [SRC:inthepocket.design]_
- [ ] **PR-###** Hotspot hints on click — When on (default V-31), a click on a non-hotspot area briefly highlights all hotspots on screen. _Data:_ player option. _Test:_ V-31. _M7·P1·[SRC:help.userbrain.com/help/testing-your-figma-prototype-with-userbrain]_
- [ ] **PR-###** Hide UI — Option to hide all player chrome. _Data:_ player option. _Test:_ toggle; only prototype visible. _M7·P2·[SRC:help.userbrain.com]_
- [ ] **PR-###** Disable default keyboard navigation — When on, R and arrow keys go to Key/Gamepad triggers instead of player navigation (R exception V-13). _Data:_ player option. _Test:_ V-13. _M7·P1·[SRC:forum.figma.com/ask-the-community-7/prototype-view-settings-when-linking-out-from-case-study-26397]_
- [ ] **PR-###** Live updates — Edits made in the editor while the player is open appear in the player; deleting the current screen restarts (V-32). _Data:_ document subscription. _Test:_ V-32. _M7·P1·[KNOW]_
- [ ] **PR-###** Options are user preferences — Player options persist per user across sessions and are never written into the document. _Data:_ app prefs. _Test:_ change scaling; reopen file on another account profile → defaults. _M7·P1·Illigma rule_
- [ ] **PR-###** Player never mutates the document — Using the player creates no undo entries and does not mark the file dirty. _Data:_ none. _Test:_ play 2 min; undo stack and dirty flag unchanged. _M7·P0·[KNOW]_
- [ ] **PR-###** Offline external links — External URLs open only on explicit activation, via the OS browser; nothing else touches the network. _Data:_ runtime. _Test:_ network monitor during a session. _M7·P0·Illigma local-first rule_
- [ ] **PR-###** Player performance — Input-to-feedback ≤ 1 frame for hover/press; transitions hold refresh rate on a 50-screen prototype. _Data:_ runtime. _Test:_ perf harness. _M8·P1·Illigma quality rule_

### 6.19 Inline preview

- [ ] **PR-###** Open inline preview — Shift+Space opens a docked player showing the selected screen. _Data:_ runtime. _Test:_ V-35. _M7·P1·[SRC:medium.com/@indigo_29303] [DOC:360040318013 excerpt]_
- [ ] **PR-###** Preview follows selection — Selecting another screen updates the preview; restart starts from the last selected screen. _Data:_ runtime. _Test:_ select B; preview shows B. _M7·P1·[DOC:360040318013 excerpt]_
- [ ] **PR-###** Preview device subset — Inline preview shows only phone, watch and tablet device frames; other devices preview without frame. _Data:_ `prototypeDevice`. _Test:_ desktop device → no frame in preview. _M7·P2·[DOC:21158597546391 excerpt]_
- [ ] **PR-###** Expand preview — The preview can be resized and promoted to the full player with the same state (V-31). _Data:_ runtime. _Test:_ V-31. _M7·P2·[KNOW]_

### 6.20 Document integrity, persistence & interop

- [ ] **PR-###** Undo granularity — Each prototype edit (interaction field, connection drag, flow add/rename/remove, overflow/position, overlay setting, device, background) is exactly one undo step; redo re-applies it. _Data:_ all §2 fields. _Test:_ 10-step script; undo ×10 restores initial JSON. _M7·P0·[KNOW]_
- [ ] **PR-###** Copy/paste on the same page — Pasted layers keep `reactions`; destinations stay pointed at the original screens. _Data:_ `reactions`. _Test:_ V-33. _M7·P0·[KNOW]_
- [ ] **PR-###** Paste to another page or file — Destinations not present in the target page/file are handled as Figma (dropped vs dangling, V-33). _Data:_ `destinationId`. _Test:_ V-33. _M7·P1·[KNOW]_
- [ ] **PR-###** Duplicate screen — The copy keeps outgoing connections; connections that pointed to the original screen from inside it are handled as Figma (V-33). _Data:_ `reactions`. _Test:_ V-33. _M7·P1·[KNOW]_
- [ ] **PR-###** Duplicate page — Connections in a duplicated page point to their equivalents in the copy. _Data:_ `reactions`. _Test:_ duplicate page; connections stay inside new page. _M7·P1·[API]_
- [ ] **PR-###** Delete destination — Deleting a destination leaves interactions without destination (inert, flagged in UI) per V-33; undo restores the link. _Data:_ `destinationId`. _Test:_ V-33. _M7·P0·[KNOW]_
- [ ] **PR-###** Lossless save/open — Every field of §2 round-trips byte-for-byte equivalent (incl. float durations, legacy flags). _Data:_ file format. _Test:_ golden file with every enum value; save/open/compare. _M7·P0·[API]_
- [ ] **PR-###** Unknown values preserved — Unknown trigger/action/transition/easing types from newer files are preserved opaquely and shown as unsupported, never dropped. _Data:_ file format. _Test:_ fixture with `type:'FUTURE_X'`. _M8·P1·Illigma rule_
- [ ] **PR-###** REST/.fig import mapping — Durations/delays ms→s, `overflowDirection` names, `scrollBehavior`, `prototypeDevice`, legacy `action`/`preserveScrollPosition`/`prototypeStartNodeID` map per §2. _Data:_ importer. _Test:_ REST JSON fixture vs Figma player behavior. _M8·P1·[API]_
- [ ] **PR-###** Exports exclude prototype UI — PNG/JPG/SVG/PDF exports never contain noodles, flow badges, overlay icons or device frames. _Data:_ export. _Test:_ export a screen with connections in Prototype tab. _M7·P1·[KNOW]_
- [ ] **PR-###** Renames affect matching live — Renaming a layer immediately changes smart-animate matching and state sharing on next playback. _Data:_ `name`. _Test:_ rename "Card" in destination; Smart animate becomes dissolve for it. _M7·P1·[DOC:360039818874 excerpt]_

### 6.21 Accessibility of prototypes

- [ ] **PR-###** Keyboard access to hotspots — Hotspots are reachable/activatable from the keyboard in the player as Figma's accessible prototypes allow (V-34). _Data:_ runtime. _Test:_ V-34. _M8·P2·[DOC:7810391964695 title] [KNOW]_
- [ ] **PR-###** Screen reader exposure — Text and hotspots are exposed to screen readers as Figma does (V-34). _Data:_ runtime. _Test:_ V-34 with VoiceOver/NVDA. _M8·P2·[DOC:7810391964695 title] [KNOW]_
- [ ] **PR-###** Accessible player chrome — Restart, flows sidebar, options and close are keyboard operable with visible focus. _Data:_ UI. _Test:_ keyboard-only walkthrough. _M8·P1·Illigma rule_
