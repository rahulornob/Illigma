# Core states

Draft · 13 October 2026 · Phase 4.10 of the [design plan](PLAN.md) · Figma section "20 · Core states"

These are the everyday editor states from [core-loop.md](core-loop.md) that the earlier phases did not cover.

| Screen | Node | What it shows |
|---|---|---|
| Text selected · font picker open | `96:58050` | Typography card (style, font, weight, size, line height, letter spacing, alignment, resize mode) and the font picker (search, in this file, on this computer, missing-font warning) |
| Multi-select · mixed values · context menu | `96:59092` | Two frames selected: a shared bounding box, "Mixed" values, mixed fills, and the right-click menu with shortcuts |
| Light mode | `96:60967` | The same editor with the **Illigma UI** collection switched to Light. No layout changes; every colour comes from variables |
| Comments | `96:61919` | Pins on the canvas, an open thread with a reply box, and the comments panel with filter and search |
| Import · Figma file report | `96:62621` | Importing a `.fig` from Home: source, converted file, a report (kept, warnings, skipped) and where it is saved |
| Stroke + constraints expanded · shape tool flyout | `96:63086` | Stroke settings (position, weight, per side, dashes), constraints widget, and the shape tool flyout with shortcuts |
| Styles · local styles list + create style | `96:64412` | Text, colour and effect styles with nothing selected, plus the Create style popover |
| Import · progress and error states | `96:68049` | Converting with progress (keep working), and a file that could not be read (nothing created or changed) |
| Docked panels | `96:66946` | The same editor with panels docked to the window edges (no gutters, radius or shadow), for the Phase 5 comparison |
| View menu · zoom, rulers, guides | `96:64875` | Zoom commands, rulers, layout guides, pixel grid, outline mode, floating or docked panels, and hide interface. Rulers and a guide are on the canvas |

## Rules

- **Text**: the font picker lists fonts in this file first, then fonts on this computer (Local Font Access in the browser, system fonts on desktop). Missing fonts show a warning with **Replace…**, and the text keeps its layout with a fallback until the font is replaced.
- **Mixed values** show "Mixed" in the field. Typing a value applies it to every selected layer, as one undo step.
- **Context menu**: the same commands as the menus, with shortcuts. Submenus (Copy as, Align) open to the side.
- **Light mode** is a variable mode, not a second design. Any element that does not switch is a bug.
- **Comments** are stored in the `.illigma` file. Author names come from each person's local profile, and there are no accounts. If two people comment in a synced copy, threads merge when the conflict is resolved (see [save-states.md](save-states.md)).
- **Import** runs on this computer and shows progress; you can keep working. An unreadable file says why and that nothing was created. The report lists what was kept, warnings (missing fonts, plugin data) and anything skipped, and it can be saved. The original file is never changed.
- **Styles** remain for gradients, images, type and effects. For colours that change between modes, the tip points to variables. Colour-style swatches are round, variable swatches square. Rows show ⋯ (edit, duplicate, delete) on hover.
- **View menu** follows Figma's shortcuts: outline ⇧⌘O, pixel grid ⌘', snap to pixel grid ⇧⌘', rulers ⇧R, comments ⇧C.
- **View**: Floating islands (default) or Docked panels. Docked panels are a View option for people who prefer Figma's classic layout; the docked layout itself is tested in Phase 5.

## Known debt

- Comment replies have no @mentions: there are no accounts to notify (feature inventory: Local N/A).
- Style folders and a "new style from selection" entry in pickers are not drawn.
- Rulers do not yet show the selection range highlight.
