# Variables and modes

Draft · 13 October 2026 · Phase 4.5 of the [design plan](PLAN.md) · Figma section "15 · Variables"

Variables are named values (colour, number, string, boolean) stored in the `.illigma` file. They work like Figma's variables, with one local-first difference: sharing happens through files on disk and JSON token export, not a cloud library.

## Screens

| Screen | Node | What it shows |
|---|---|---|
| Variables manager · Theme collection | `96:40347` | Full-page manager: collections and groups on the left, a table with one column per mode, an Edit variable popover |
| Editor · Frame mode set to Dark | `96:41049` | Selecting a frame and choosing a mode from the Appearance card. The canvas re-renders the frame in Dark |
| Editor · Bind fill to a variable | `96:42118` | The fill's colour picker on its Variables tab, showing values for the frame's current mode |
| Variables manager · Empty (new file) | `96:42982` | First visit: create a collection or import tokens |
| Variables manager · Mode menu + delete undo | `96:45499` | Mode header menu (rename, duplicate, set default, export, delete) and the undo toast after deleting a variable |
| Variables manager · Create variable type menu | `96:46168` | Choosing Colour / Number / String / Boolean for a new variable |

## Opening the manager

- From the left panel's **Variables** tab (placement still open, see flows.md "What the flows revealed" 3), from **Open variables…** at the bottom of the mode menu, and from the command palette.
- It replaces the canvas area but keeps the title bar and file tabs, so the file stays one click away. **Esc** or the back arrow returns to the canvas with the same selection.

## Manager rules

1. **Collections** (left) hold variables and modes. **Groups** come from the `/` in names (`bg/app` → group `bg`). Selecting a group filters the table.
2. **One column per mode.** The first mode is the default (badge "Default"). **+** at the end of the header adds a mode. Rename or delete a mode from its header menu.
3. **Values** show a swatch and the alias name when a value points to another variable (`coral/500`), or the raw value (`#FF6B4A`, `16`, `Inter`, `true`).
4. **Rows** use the **Variable row** component (`96:40345`): hover shows the edit button; selected rows use the accent row colour; keyboard focus uses the 2 px outside ring.
5. **Edit variable** popover: name, description, value per mode (each can be bound to another variable), **scope** (where the variable is offered: fills, text, stroke, effects, and for numbers: gap, radius, width/height, font size), **code syntax** (Web, iOS, Android), and **hide from files that use this library**.
6. **Delete** is undoable with ⌘Z. Deleting a variable that is in use shows how many layers use it and offers to replace it with another variable first.
7. **Import / Export**: W3C design tokens and Tokens Studio JSON. Export writes a `.json` file next to the design file. Nothing is uploaded.

## Modes on the canvas

- A frame, section or page can **set a mode** for a collection from the Appearance card (sun-moon button). Default is **Auto**: inherit from the parent, then the page, then the collection default.
- The canvas re-renders the frame right away. A small mode chip ("Dark") sits next to the frame name so the override is visible without selecting it.
- **Reset to Auto** (the minus button) removes the override.
- The layer row shows the same mode tag (moon + "Dark") in the Layers panel.

## Binding

- Every field that accepts a variable opens a picker with **Custom | Variables**. The Variables tab lists only variables whose scope allows that field.
- Swatches in the picker show the value for the **selected layer's current mode**, so a Dark frame shows dark values.
- Bound fields use the **Bound to variable** state of the Number input / Property row (hexagon icon + variable name). Hovering a bound row shows a **Detach variable** button (unlink icon) before the eye.

## Components

- **Variable row** (`96:40345`): Type Color / Number / String / Boolean × State Default / Hover / Selected / Focus; text properties Name, Light, Dark.
- **Variable option** (`96:42117`): one entry in the picker; State Default / Highlighted / Selected / Focus; text property Name.

## Known debt

- Boolean cells show `true` / `false` text; an inline checkbox would match Figma.
- Variable row text defaults are colour-style for every type; instances always override them.
