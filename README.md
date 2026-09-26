# Illigma

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Frahulornob%2FIlligma)

A lightweight vector editor with a Framer-inspired dark interface. Built with Vite, vanilla JavaScript, an SVG workspace, and Paper.js for Bézier geometry and boolean operations. Inter fonts are bundled locally.

## Run

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The app starts with editable sample artwork. The document menu offers a blank document, the sample, and editable file import/export. Creating a new document can be undone.

```sh
npm run build       # production files in dist/
npm run preview     # serve the production build
npm test            # browser integration tests; Google Chrome required
```

## Tools

- **V — Selection:** select, drag, resize with four corner handles, and rotate using the Rotation field in Properties. Shift-click adds/removes selections; drag empty space for a selection marquee. Hold Shift to constrain a move, preserve aspect ratio during corner resizing.
- **A — Direct selection:** edit path anchors and Bézier handles. Rectangles and ellipses convert to editable paths when selected with this tool. Shift-drag a Bézier handle to mirror its opposite handle.
- **F — Frame:** drag to draw a frame container; Shift constrains to equal dimensions. A click creates a standard frame. Frames group and clip content like Figma.
- **R / O — Rectangle / Ellipse:** drag to draw; Shift constrains to a square or circle. A click creates a 120 × 120 shape.
- **P — Pen:** click for straight segments, or drag an anchor to create symmetric curve handles. A live preview shows the next segment and highlights the first anchor when the path can close. Shift constrains points and handle directions to 45° increments. Click the last anchor to remove its outgoing handle; Alt/Option-drag it to change the outgoing handle independently. Cmd/Ctrl+Z and redo edit the current draft; Backspace removes the last point. Click the first anchor to close the path; Enter finishes an open path; Escape cancels the draft. Rapid clicks and double-clicks do not finish a path.
- **T — Type:** click to create text. Double-click existing text to edit. Use the inspector for font, size, and weight. Click outside or press Cmd/Ctrl+Enter to finish; Escape cancels editing.
- **Shift+M — Shape builder:** first select two or more shapes. Hover to preview a region; drag across regions to merge them. Alt-click or Alt-drag removes regions. Disconnected areas are treated independently. Limited to 24 input shapes and 150 intermediate regions per operation.
- **I — Eyedropper:** sample an object's fill (or its stroke if it has no fill) and apply it to the current selection's active paint channel. It also samples locked objects and the artboard background.
- **H / Space — Hand:** drag to pan. Cmd/Ctrl+scroll zooms around the pointer; regular scroll pans. Shift+1 fits the artboard. Zoom ranges from 2% to 25600%.

## Panels and commands

The inspector includes live X/Y, width/height, rotation, opacity, alignment, fill, stroke, and contextual typography controls. Single-object alignment uses the artboard; multiple-object alignment uses the selection's bounds.

Layers appear under the collapsible artboard. Drag rows to change stacking order, double-click names to rename them, and use visibility and lock controls. The frontmost layer is at the top. `[` and `]` move selected objects one step backward/forward.

Pathfinder has compact icon rows for Shape modes (Unite, Minus Front, Intersect, Exclude) and Pathfinders (Divide, Trim, Merge, Crop, Outline, Minus Back). Hover for operation names. Divide creates separate regions; Trim removes covered areas and strokes; Merge additionally joins matching fill/opacity regions; Crop uses the topmost shape as its boundary; Outline produces individually editable 1px edges split at intersections; Minus Back subtracts back shapes from the frontmost shape. All results are immediately editable paths, so no separate Expand step is needed. Text is excluded from these operations. The operation behavior follows the [Adobe Pathfinder panel reference](https://helpx.adobe.com/illustrator/desktop/manage-objects/reshape-transform-objects/pathfinder-panel-overview.html), with visible 1px strokes for Outline results.

Click a Fill or Stroke color chip to open the floating color picker beside the inspector. It combines the saturation/brightness field, hue slider, native color picker, hex/RGB inputs, and project swatches. Swatches apply immediately; the plus button saves the current color. Close it with the X, Escape, or a click outside. The eyedropper button switches to canvas sampling.

- Cmd/Ctrl+Z: undo; Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y: redo.
- Cmd/Ctrl+A: select visible, unlocked objects.
- Cmd/Ctrl+D: duplicate selection.
- Arrow keys: nudge 1px; Shift+arrows: 10px.
- Delete/Backspace: remove selection.
- Cmd/Ctrl+S: download an editable `.illigma` document.
- `?`: show the shortcuts dialog.

## Saving and scope

Changes are automatically saved in this browser's local storage. Undo history holds the last 100 document edits for the current session. Download an `.illigma` file to keep an editable backup or move work between browsers. Imported documents are validated before replacing the current one; the previous document remains available through Undo.

SVG export includes the active page’s visible artwork and artboard background, without editor controls. Text remains editable and references its font family; install the corresponding fonts in external tools for matching text rendering.

This MVP supports multiple pages with one artboard per page, a two-level artboard/object layer hierarchy, solid fills and strokes, and text using built-in or imported fonts. It does not include arbitrary SVG import, nested groups, gradient editing, text outlining, collaboration, or a backend. Desktop and tablet-sized windows are the primary editing targets.

## Source layout

- `index.html`: accessible editor shell and panels.
- `src/styles.css`: design tokens and responsive UI.
- `src/main.js`: SVG rendering, pointer/keyboard gestures, panels, and file operations.
- `src/store.js`: document model, sample artwork, validation, history, and persistence.
- `src/geometry.js`: transforms, Bézier paths, boolean geometry, region decomposition, and color conversion.
- `tests/editor.spec.js`: browser tests covering the editing workflow and vector operations.

Boolean geometry uses the [Paper.js PathItem API](https://paperjs.org/reference/pathitem/).

## Local and Google Fonts

Select a text layer, then choose **Add fonts** under the font selector. **Google Fonts** accepts a family name such as DM Sans or Noto Sans Bengali, with a few suggestions. The first download needs an internet connection. **Local files** imports TTF, OTF, WOFF, or WOFF2 files up to 20 MB; optionally supply the family name and select the weight, including a variable font range. Import additional weights under the same family name.

A successfully added font is applied to the selected text and becomes available in the font selector. The dialog also lists available fonts for quick application. Font files, including downloaded Google Fonts, are cached in this browser's IndexedDB for offline reuse. Local font files are never uploaded. Documents store font family references, not font binaries: when moving an editable document or SVG to another device, import/install the fonts there too. This does not automatically enumerate fonts installed on your operating system.

Implementation uses the [Google Fonts CSS API](https://developers.google.com/fonts/docs/css2) and the browser [FontFace API](https://developer.mozilla.org/en-US/docs/Web/API/FontFace). Font loading errors are shown in the dialog without replacing the selected text's font.

## Pages

The Pages section above Layers supports up to 100 pages. Click **+** to add a blank page, click a name to switch, and double-click the active page name to rename it. The search button filters pages by name. Hover over a row for its delete button; the last page cannot be deleted. Deletion and other page changes can be undone.

Each page keeps its own artboard and objects. Switching pages finishes active text/pen edits and remembers its canvas view for this session. Autosave and editable `.illigma` files include all pages; SVG export uses the active page. Older single-page documents are migrated automatically.

### Multiple frames
 
Create frames with the **Frame tool (F)** or **+** beside Layers. Select frames by clicking their canvas labels, sidebar rows, or canvas background. Drag a selected frame or its label to move the frame and all nested artwork. The inspector edits X/Y, width, height, background fill, and toggleable "Clip content". Shapes moved or drawn into a frame auto-nest within it like in Figma. Delete removes the selected frame and its contents; each page retains at least one frame. SVG export includes all frames on the current page.

### Auto layout (Figma 1:1)

Turn any frame into an Auto Layout container, or select multiple objects and press **Shift+A** to wrap them in a new Auto Layout frame with 16px padding and spacing.

- **Shortcuts:** `Shift+A` to add/enable Auto Layout; `Option+Shift+A` (or `Alt+Shift+A`) to remove Auto Layout.
- **Direction:** Switch between Horizontal (`→`) and Vertical (`↓`) layouts with instant reflow.
- **Sizing:** Choose between **Hug contents** (frame resizes to fit children plus padding) and **Fixed size** (frame dimensions stay fixed while children align inside). Manual frame resizing automatically switches sizing to fixed.
- **3×3 Interactive Alignment Matrix:** Click any of the 9 alignment points (Top Left, Top Center, Top Right, Center Left, Center, Center Right, Bottom Left, Bottom Center, Bottom Right) to position children along primary and cross axes.
- **Gap & Padding:** Set custom pixel spacing between items, horizontal padding, and vertical padding with live canvas updates.
- **Child Reordering:** Drag children along the layout axis or press arrow keys (`←`/`→` for horizontal, `↑`/`↓` for vertical) to reorder items inside the auto layout frame.
- **Context Menu:** Right-click canvas selections or layers to quickly add or remove Auto Layout.

### Canvas background color (Figma Page / Canvas Background)

Customize the canvas workspace void background color per page like in Figma:

- **Inspector Controls:** Click empty canvas void (or deselect all objects) to display the **Page background** fill section in the inspector.
- **Color Selection:** Enter hex codes, select swatches, or open the full floating color picker (HSV square, hue slider, RGB inputs, and native picker).
- **Live Update:** Changes update the `--canvas-void` workspace background in real time.
- **Per-Page State & Persistence:** Each page remembers its own canvas background color, automatically saved to localStorage and `.illigma` files.
- **Undo / Redo:** Full undo/redo support (`⌘Z` / `⌘⇧Z`).
- **Reset:** Click the minus button next to "Page background" to quickly reset to default dark void (`#090909`).
- **Context Menu:** Right-click empty canvas space and choose **Change canvas color...** to quickly trigger the color picker.

### Shadows and Effects (Figma 1:1)

Add and stack multiple effects on any shape, text, or frame like in Figma:

- **Effect Types:**
  - **Drop shadow:** Casts a soft or crisp shadow behind the layer. Includes global rotation compensation so shadows cast consistently regardless of object orientation.
  - **Inner shadow:** Insets an inner shadow within the boundaries of the shape using SVG alpha masking (`feComposite out`).
  - **Layer blur:** Blurs the entire object or frame contents using Gaussian blur.
  - **Background blur:** Blurs artwork visible beneath the frame using backdrop filtering (`backdrop-filter: blur(...)`).
- **Inspector Effects List:**
  - Click **+** in the **Effects** panel to add a new effect (defaults to Drop shadow).
  - Switch types directly via the row dropdown.
  - Toggle visibility with the eye icon button without losing settings.
  - Delete effects with the minus button.
- **Floating Settings Popover:**
  - Click the effect icon button to open the detailed settings popover beside the inspector.
  - **Shadow controls:** X offset, Y offset, Blur radius, and Spread radius (`feMorphology`).
  - **Color & Opacity:** Color chip preview, hex input, opacity percentage, and native system color picker.
  - **Blur controls:** Blur radius for Layer blur and Background blur.
- **Persistence & Export:**
  - Full persistence in browser storage and `.illigma` JSON document schema.
  - Full undo/redo support (`⌘Z` / `⌘⇧Z`).
  - Native SVG filter export (`<filter>`, `<feGaussianBlur>`, `<feOffset>`, `<feColorMatrix>`, `<feComposite>`, `<feMorphology>`, `<feMerge>`) in `exportSvg()`.


