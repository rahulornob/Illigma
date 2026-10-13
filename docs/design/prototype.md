# Prototype mode

Draft · 13 October 2026 · Phase 4.6 of the [design plan](PLAN.md) · Figma section "16 · Prototype"

Prototyping works like Figma's: connections between layers and frames, interactions with triggers and actions, flows with starting points, and a presentation view. The local-first difference is the phone preview. It is served from your own computer over the local network, with no account and nothing uploaded.

## Screens

| Screen | Node | What it shows |
|---|---|---|
| Prototype · Button connected to Home | `96:44507` | Prototype tab with a button selected. A connection noodle runs from the button to Home. The flow start badge sits on Welcome |
| Prototype · Interaction details | `96:46881` | The Interaction popover: trigger, action, destination, animation type, easing curve and duration |
| State · Action menu | `96:47443` | Every action in the Action select |
| Present · Onboarding flow | `96:47537` | Presentation view: flow switcher, device, restart, hotspot hints, Preview on phone, step navigation |
| Present · Preview on phone | `96:47621` | QR code and local address. Shows who is connected (with Disconnect); sharing can be turned off |
| Preview on phone · states | `96:49879` | Waiting for a device, approve a new device (pairing code), no network, blocked by firewall |

## Prototype tab (Properties panel)

- **Interactions**: one **Interaction row** (`96:43682`) per interaction ("On tap · Navigate to Home"). **+** adds one. The minus button removes it (undoable). Clicking a row opens Interaction details.
- **Scroll behaviour**: position (scroll with parent, fixed, sticky) and overflow for frames.
- **Flows on this page**: each flow and its starting frame. **+** adds a flow from the selected frame.
- **Prototype settings** (nothing selected or a top-level frame): device, background colour.

## Canvas

- In Prototype mode, a selected layer shows a **connection handle** (a blue dot on its right edge). Drag it to a frame to create "On tap → Navigate to". Drop it on empty canvas to cancel.
- Connections are blue **noodles** with an arrowhead. While dragging, the target frame shows a dashed blue outline.
- **Flow start** badges (blue, play icon + flow name) sit before the frame name.
- Blue is used here because these are interactive selections, following the colour rules (Ember is brand only).

## Interaction details

- **Trigger**: On tap, On drag, While hovering, While pressing, Key / gamepad, Mouse enter, Mouse leave, Mouse down, Mouse up, After delay.
- **Action**: Navigate to, Change to (component variants only), Back, Scroll to, Open link, Open overlay, Swap overlay, Close overlay, Set variable, Set variable mode, Conditional. **+ Add action** runs several actions on one trigger.
- **Animation**: Instant, Dissolve, Smart animate, Move in / out, Push, Slide in / out; easing curve with a live preview, and duration in ms.
- **Options**: preserve scroll position; preview on hover.
- A connection whose destination was deleted shows the **Error** state of the Interaction row (red tint, warning icon).

## Presentation view

- Opens with **▷** (Present) in the Properties header, or with ⌥⌘↵. It replaces the window and keeps a slim top bar.
- Top bar: back to editor (Esc), flow switcher, device and scale, restart (R), hotspot hints toggle, **Preview on phone**, full screen.
- Hotspot hints (H) outline hotspots in blue; with hints off, clicking where there is no hotspot briefly flashes them. Restart is R.
- Footer: previous / next frame in the flow and the keyboard hints.

## Preview on phone (local network)

- Illigma serves the prototype from your computer on the local network. The dialog shows a QR code, the address and a copy button.
- Sharing is never on in the background. It starts only when you open this dialog (**Allow devices on this network** on), and turning the toggle off stops it at once.
- Connected devices are listed by platform and browser ("iPhone · Safari"), each with **Disconnect**. Edits reach the phone live.
- **Ask before a new device connects** is on by default. A new device shows a 4-digit code on the phone and an Allow / Deny card in the dialog, so a shared café Wi-Fi is safe.
- Errors are never silent: "Not connected to a network" (warning) and "Port 7470 is blocked by your firewall" (error, with Try again).
- Only devices on the same network can connect. There is no account, no relay and nothing is uploaded. When Illigma closes, sharing stops.

## Known debt

- Properties cards and the phone dialog are plain frames that follow the Inspector card and Dialog components; instances can't hold their custom content.
- Standalone HTML export of a prototype (feature inventory `Local:` row) is not designed yet; it belongs to the Export dialog (4.8).
