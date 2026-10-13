# Illigma design principles

Draft · 13 October 2026 · Phase 1 of the [design plan](PLAN.md)

Every design decision is checked against these eight principles. When two conflict, the earlier one wins.

## 1. Never lose work

The file is on the user's disk, and Illigma treats it with care.
- Saving is automatic and visible ("Saved to ~/Design"). There is no Save button to forget.
- Destructive actions can be undone, and the UI says so ("You can undo this with ⌘Z").
- Errors name the cause and the way out ("Couldn't save. Disk is full. Retry").

**Test:** can a crash, a power cut or a mis-click cost the user more than two seconds of work?

## 2. Figma muscle memory works

A designer who knows Figma is productive within an hour.
- The same concepts: frames, auto layout, components, variants, variables, prototypes.
- The same shortcuts where they are not trademarks, and the same place for each control.
- New ideas (pages with emoji, the tab switcher with folder paths) add to Figma's model. They never replace it.

**Test:** would a Figma user find this where they expect it?

## 3. The canvas is the product

Panels exist to serve the canvas.
- Chrome is quiet: neutral surfaces, one accent, alpha text.
- Properties appear in context (the context bar, inline handles) before they appear in a panel.
- Panels can be hidden, and the canvas never jumps when they open or close.

**Test:** does this pull the eye away from the user's design?

## 4. One colour, one job

- Ember is the brand only (logo, marketing, empty states).
- Blue is everything interactive: selection, focus, the active tool, components, primary actions.
- Green, amber and red mean success, warning and danger, and nothing else.
- Layer-type colours tell types apart in the layers panel only.

**Test:** if this colour appears, can the user say what it means?

## 5. Keyboard for everything, mouse for everything

- Every command is in ⌘K, and every frequent command has a shortcut shown next to it.
- Every keyboard action also has a visible control, so nothing is hidden behind a shortcut.

**Test:** can this be done without the mouse, and can it be found without knowing the shortcut?

## 6. Show the state, then the action

- Selected, hovered, focused, disabled, mixed, overridden and bound-to-variable each have one consistent look across the app.
- Controls show their current value before offering to change it.

**Test:** at a glance, can the user tell what is selected and what will change?

## 7. One system, no one-offs

- Every screen is built from library components and semantic tokens.
- Universal rules: 4 px grid, 12 px minimum type, Lucide icons at 1.2 px, 60% corner smoothing, white or black alpha text.
- A new pattern goes into the library first, then into a screen.

**Test:** is every node an instance or bound to a token?

## 8. Local, private and open by default

- Nothing leaves the machine unless the user turns on sync.
- Features that are cloud-only in Figma get a local equivalent: folders instead of projects, the tab switcher shows paths, devices pair over the local network.
- The file format is readable, and AI agents can work on it through the local MCP server.

**Test:** does this work with the network switched off?
