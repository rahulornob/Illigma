# Figma Design — interface, layers, drawing, paint, text, layout, import/export

## Interface & navigation

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Editor layout | Navigation bar, left sidebar, canvas, right sidebar, bottom toolbar | P0 | [Explore design files](https://help.figma.com/hc/en-us/articles/15297425105303-Explore-design-files) |
| Toolbar: Move tools | Move (V), Hand (H; hold Space), Scale (K) in one menu | P0 | [Access design tools from the toolbar](https://help.figma.com/hc/en-us/articles/360041064174-Access-design-tools-from-the-toolbar) |
| Toolbar: Region tools | Frame, Section, Slice tools menu | P0 | [Access design tools from the toolbar](https://help.figma.com/hc/en-us/articles/360041064174-Access-design-tools-from-the-toolbar) |
| Toolbar: Shape tools | Rectangle, Line, Arrow, Ellipse, Polygon, Star, Image/video menu | P0 | [Access design tools from the toolbar](https://help.figma.com/hc/en-us/articles/360041064174-Access-design-tools-from-the-toolbar) |
| Toolbar: Creation tools | Pen and Pencil (with path smoothing) | P0 | [Access design tools from the toolbar](https://help.figma.com/hc/en-us/articles/360041064174-Access-design-tools-from-the-toolbar) |
| Toolbar: Text tool | Text tool T | P0 | [Access design tools from the toolbar](https://help.figma.com/hc/en-us/articles/360041064174-Access-design-tools-from-the-toolbar) |
| Toolbar: Comment tools | Comment, Annotation, Measurement tools | P2 | [Access design tools from the toolbar](https://help.figma.com/hc/en-us/articles/360041064174-Access-design-tools-from-the-toolbar) |
| Toolbar: Actions menu | Access AI, asset search, plugins/widgets, commands | P0 | [Access design tools from the toolbar](https://help.figma.com/hc/en-us/articles/360041064174-Access-design-tools-from-the-toolbar) |
| Toolbar: Dev Mode toggle (Shift+D) | Switch to developer inspect interface | P2 | [Access design tools from the toolbar](https://help.figma.com/hc/en-us/articles/360041064174-Access-design-tools-from-the-toolbar) |
| Toolbar: Draw toggle | Switch to Figma Draw illustration mode | P1 | [Access design tools from the toolbar](https://help.figma.com/hc/en-us/articles/360041064174-Access-design-tools-from-the-toolbar) |
| Hand tool touch pan | Touch screen panning with Hand tool | P2 | [Access design tools from the toolbar](https://help.figma.com/hc/en-us/articles/360041064174-Access-design-tools-from-the-toolbar) |
| View-only toolbar | Reduced toolbar with Ask to edit when user lacks edit rights | Local: N/A, no permissions | [Explore design files](https://help.figma.com/hc/en-us/articles/15297425105303-Explore-design-files) |
| Canvas background color | Page bg color per page; default #F5F5F5 light / #1E1E1E dark; hex, opacity, hide toggle | P0 | [Change the background color of the canvas](https://help.figma.com/hc/en-us/articles/360041064814-Change-the-background-color-of-the-canvas) |
| Canvas bg inheritance | New pages inherit current page background | P1 | [Change the background color of the canvas](https://help.figma.com/hc/en-us/articles/360041064814-Change-the-background-color-of-the-canvas) |
| Right sidebar: Design tab | Context-aware properties panel for selection | P0 | [Right sidebar properties panel](https://help.figma.com/hc/en-us/articles/360039832014-Design-prototype-and-explore-layer-properties-in-the-right-sidebar) |
| Right sidebar: no selection | Shows local styles/variables, page background, page export | P0 | [Right sidebar properties panel](https://help.figma.com/hc/en-us/articles/360039832014-Design-prototype-and-explore-layer-properties-in-the-right-sidebar) |
| Right sidebar: section list | Position, frame size/orientation, radius, constraints, guides, component props, instance, AL, blend, text, fill, stroke, effects, export | P0 | [Right sidebar properties panel](https://help.figma.com/hc/en-us/articles/360039832014-Design-prototype-and-explore-layer-properties-in-the-right-sidebar) |
| Right sidebar: Prototype tab | Flow starting points, interactions, scroll behavior, prototype settings | Module | [Right sidebar properties panel](https://help.figma.com/hc/en-us/articles/360039832014-Design-prototype-and-explore-layer-properties-in-the-right-sidebar) |
| Property labels toggle | Show text labels for property fields via zoom/view menu | P1 | [Right sidebar properties panel](https://help.figma.com/hc/en-us/articles/360039832014-Design-prototype-and-explore-layer-properties-in-the-right-sidebar) |
| View-only: Comment tab | Search and filter comments (by date, unread) | P2 | [Right sidebar properties panel](https://help.figma.com/hc/en-us/articles/360039832014-Design-prototype-and-explore-layer-properties-in-the-right-sidebar) |
| View-only: Properties tab | Inspect layer name, layout, colors; copy code; export | P2 | [Right sidebar properties panel](https://help.figma.com/hc/en-us/articles/360039832014-Design-prototype-and-explore-layer-properties-in-the-right-sidebar) |
| Right-click: Copy/Paste as | Copy as code (CSS/iOS/Android), SVG, PNG, link, properties | P0 | [Right sidebar properties panel](https://help.figma.com/hc/en-us/articles/360039832014-Design-prototype-and-explore-layer-properties-in-the-right-sidebar) |
| Canvas pan | Space+drag (mouse) or two-finger trackpad scroll honoring OS direction | P0 | [Explore design files](https://help.figma.com/hc/en-us/articles/15297425105303-Explore-design-files) |
| Canvas zoom | Cmd/Ctrl+scroll or pinch; zoom % shown top-right | P0 | [Explore design files](https://help.figma.com/hc/en-us/articles/15297425105303-Explore-design-files) |
| Pages | Multiple pages per file, each own canvas; page list in left sidebar; + to add | P0 | [Explore design files](https://help.figma.com/hc/en-us/articles/15297425105303-Explore-design-files) |
| Copy link to page | Right-click page name to copy deep link | Local: deep link to page | [Explore design files](https://help.figma.com/hc/en-us/articles/15297425105303-Explore-design-files) |
| Layer type icons | Icons for frame, group, component, instance, text, shape, image, AL, section, GIF/video, slot | P0 | [Explore the navigation bar and left sidebar](https://help.figma.com/hc/en-us/articles/360039831974-Explore-the-navigation-bar-and-left-sidebar) |
| Layer type shortcuts | F frame, Cmd+G group, Opt+Cmd+K component, T text, R shape, Shift+Cmd+K image, Shift+A AL, Shift+S section | P0 | [Explore design files](https://help.figma.com/hc/en-us/articles/15297425105303-Explore-design-files) |
| Container arrow | Disclosure arrow on layers that contain children | P0 | [Explore design files](https://help.figma.com/hc/en-us/articles/15297425105303-Explore-design-files) |
| Hover outline | Hovering canvas object shows outline box | P0 | [Explore design files](https://help.figma.com/hc/en-us/articles/15297425105303-Explore-design-files) |
| Style-bound properties display | Properties using a style show style name/icon instead of raw values | P0 | [Explore design files](https://help.figma.com/hc/en-us/articles/15297425105303-Explore-design-files) |
| Navigation bar | Left vertical bar: Figma menu, File, Agents, Assets, Tools, Variables, notifications | P0 | [Explore the navigation bar and left sidebar](https://help.figma.com/hc/en-us/articles/360039831974-Explore-the-navigation-bar-and-left-sidebar) |
| Navigation bar labels | Toggle tab labels via menu > View | P2 | [Explore the navigation bar and left sidebar](https://help.figma.com/hc/en-us/articles/360039831974-Explore-the-navigation-bar-and-left-sidebar) |
| Left sidebar resize | Drag right edge to adjust width | P0 | [Explore the navigation bar and left sidebar](https://help.figma.com/hc/en-us/articles/360039831974-Explore-the-navigation-bar-and-left-sidebar) |
| Figma (main) menu | App commands, layer actions, file creation, preferences incl. theme | P0 | [Explore the navigation bar and left sidebar](https://help.figma.com/hc/en-us/articles/360039831974-Explore-the-navigation-bar-and-left-sidebar) |
| Theme: dark mode | Light/dark UI theme preference | P0 | [Explore the navigation bar and left sidebar](https://help.figma.com/hc/en-us/articles/360039831974-Explore-the-navigation-bar-and-left-sidebar) |
| File tab (Opt+1 / Alt+1) | Pages, layers, file name and settings | P0 | [Explore the navigation bar and left sidebar](https://help.figma.com/hc/en-us/articles/360039831974-Explore-the-navigation-bar-and-left-sidebar) |
| Edit file menu | Rename file, version history, color profile, move to folder | P0 | [Explore the navigation bar and left sidebar](https://help.figma.com/hc/en-us/articles/360039831974-Explore-the-navigation-bar-and-left-sidebar) |
| File color profile | Set file's color profile (sRGB / Display P3) | P1 | [Explore the navigation bar and left sidebar](https://help.figma.com/hc/en-us/articles/360039831974-Explore-the-navigation-bar-and-left-sidebar) |
| Version history | Track, view and restore previous versions; named milestones | P0 | [Explore design files](https://help.figma.com/hc/en-us/articles/15297425105303-Explore-design-files) |
| New layer insertion order | New layers go top of list/container or just above selected layer | P0 | [Explore the navigation bar and left sidebar](https://help.figma.com/hc/en-us/articles/360039831974-Explore-the-navigation-bar-and-left-sidebar) |
| Assets tab (Opt+2 / Alt+2) | Browse/search local and library components; drag to create instance; grid/list | P0 | [Explore the navigation bar and left sidebar](https://help.figma.com/hc/en-us/articles/360039831974-Explore-the-navigation-bar-and-left-sidebar) |
| Libraries modal (Opt+3 / Alt+3) | Publish styles/components/variables; add libraries; update indicator | P1 | [Explore the navigation bar and left sidebar](https://help.figma.com/hc/en-us/articles/360039831974-Explore-the-navigation-bar-and-left-sidebar) |
| Tools tab | Search/filter plugins, widgets, shaders, Weave tools | P2 | [Explore the navigation bar and left sidebar](https://help.figma.com/hc/en-us/articles/360039831974-Explore-the-navigation-bar-and-left-sidebar) |
| Plugins | Run third-party extensions; "Created by Figma" filter | P2 | [Explore the navigation bar and left sidebar](https://help.figma.com/hc/en-us/articles/360039831974-Explore-the-navigation-bar-and-left-sidebar) |
| Widgets | Interactive canvas objects | P2 | [Explore the navigation bar and left sidebar](https://help.figma.com/hc/en-us/articles/360039831974-Explore-the-navigation-bar-and-left-sidebar) |
| Shaders | Shader fills and shader effects (frosted glass, holographic, fire) | P2 | [Explore the navigation bar and left sidebar](https://help.figma.com/hc/en-us/articles/360039831974-Explore-the-navigation-bar-and-left-sidebar) |
| Variables view | Create/edit variables, modes, collections from navigation bar | P0 | [Explore the navigation bar and left sidebar](https://help.figma.com/hc/en-us/articles/360039831974-Explore-the-navigation-bar-and-left-sidebar) |
| File notifications | Library updates, missing fonts, offline status at bottom of nav bar | P0 | [Explore the navigation bar and left sidebar](https://help.figma.com/hc/en-us/articles/360039831974-Explore-the-navigation-bar-and-left-sidebar) |
| Offline status indicator | Notification when file is offline | Local: always offline, show save status | [Explore the navigation bar and left sidebar](https://help.figma.com/hc/en-us/articles/360039831974-Explore-the-navigation-bar-and-left-sidebar) |
| Live multiplayer files | Simultaneous editing, presence, audio, sharing | P2 | [Explore design files](https://help.figma.com/hc/en-us/articles/15297425105303-Explore-design-files) |
| Share & permissions | Can edit / can view roles, request access | Local: N/A, no accounts | [Explore design files](https://help.figma.com/hc/en-us/articles/15297425105303-Explore-design-files) |

## View, zoom, rulers, guides & outlines

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Rulers | View > Rulers toggles canvas rulers; selection highlighted blue on rulers | P0 | [Add guides to the canvas or frames](https://help.figma.com/hc/en-us/articles/360040449713-Add-guides-to-the-canvas-or-frames) |
| Guides: drag from ruler | Drag from horizontal/vertical ruler to create canvas or frame guide | P0 | [Add guides to the canvas or frames](https://help.figma.com/hc/en-us/articles/360040449713-Add-guides-to-the-canvas-or-frames) |
| Guides: duplicate | Opt/Alt-drag existing guide to create new one | P1 | [Add guides to the canvas or frames](https://help.figma.com/hc/en-us/articles/360040449713-Add-guides-to-the-canvas-or-frames) |
| Guides: frame-level | Guides inside frames act as frame children; dotted where intersecting frames | P0 | [Add guides to the canvas or frames](https://help.figma.com/hc/en-us/articles/360040449713-Add-guides-to-the-canvas-or-frames) |
| Guides: redlines | Opt/Alt while dragging guide shows px distance to frame and objects | P1 | [Add guides to the canvas or frames](https://help.figma.com/hc/en-us/articles/360040449713-Add-guides-to-the-canvas-or-frames) |
| Guides: remove | Drag back to ruler, Delete, or right-click Remove guide | P0 | [Add guides to the canvas or frames](https://help.figma.com/hc/en-us/articles/360040449713-Add-guides-to-the-canvas-or-frames) |
| Zoom/view options menu | Zoom % dropdown with custom value and view toggles | P0 | [Adjust your zoom and view options](https://help.figma.com/hc/en-us/articles/360041065034-Adjust-your-zoom-and-view-options) |
| Zoom in/out (Shift+= / Shift+-) | Step zoom; also Cmd/Ctrl + / - | P0 | [Adjust your zoom and view options](https://help.figma.com/hc/en-us/articles/360041065034-Adjust-your-zoom-and-view-options) |
| Zoom to fit (Shift+1) | Fit all page content; default on file open | P0 | [Adjust your zoom and view options](https://help.figma.com/hc/en-us/articles/360041065034-Adjust-your-zoom-and-view-options) |
| Zoom to selection (Shift+2) | Fit selection in view | P0 | [Adjust your zoom and view options](https://help.figma.com/hc/en-us/articles/360041065034-Adjust-your-zoom-and-view-options) |
| Zoom: per-tab state | Zoom only applies to current tab of file | P1 | [Adjust your zoom and view options](https://help.figma.com/hc/en-us/articles/360041065034-Adjust-your-zoom-and-view-options) |
| Deep link zoom | Opening link to a layer zooms to fit it | P1 | [Adjust your zoom and view options](https://help.figma.com/hc/en-us/articles/360041065034-Adjust-your-zoom-and-view-options) |
| Zoom gestures | Pinch, Cmd/Ctrl+wheel, Magic Mouse double-tap | P0 | [Adjust your zoom and view options](https://help.figma.com/hc/en-us/articles/360041065034-Adjust-your-zoom-and-view-options) |
| UI scale | Desktop app interface scale setting (browser uses browser zoom) | P1 | [Adjust your zoom and view options](https://help.figma.com/hc/en-us/articles/360041065034-Adjust-your-zoom-and-view-options) |
| Pixel preview (Ctrl+P / Ctrl+Alt+P) | Render rasterized preview at 1x or 2x, or Disabled | P1 | [Adjust your zoom and view options](https://help.figma.com/hc/en-us/articles/360041065034-Adjust-your-zoom-and-view-options) |
| Pixel grid (Cmd/Ctrl+') | Show 1px grid at zoom >= 400% | P0 | [Adjust your zoom and view options](https://help.figma.com/hc/en-us/articles/360041065034-Adjust-your-zoom-and-view-options) |
| Snap to pixel grid (Cmd/Ctrl+Shift+') | Snap placement to whole pixels; frames/sections/components always snap | P0 | [Adjust your zoom and view options](https://help.figma.com/hc/en-us/articles/360041065034-Adjust-your-zoom-and-view-options) |
| Layout guides view toggle | Show/hide all layout guides (Ctrl+G mac / Ctrl+Shift+4 win, or Shift+G) | P0 | [Adjust your zoom and view options](https://help.figma.com/hc/en-us/articles/360041065034-Adjust-your-zoom-and-view-options) |
| Multiplayer cursors toggle | Show/hide collaborator cursors (Opt+Cmd+\) | P2 | [Adjust your zoom and view options](https://help.figma.com/hc/en-us/articles/360041065034-Adjust-your-zoom-and-view-options) |
| Prototyping view (viewers) | View-only users toggle prototype connection display | P2 | [Adjust your zoom and view options](https://help.figma.com/hc/en-us/articles/360041065034-Adjust-your-zoom-and-view-options) |
| Minimize UI (Cmd/Ctrl+Shift+\) | Collapse nav bar and sidebars; right panel auto-expands on selection | P0 | [Hide or minimize the UI](https://help.figma.com/hc/en-us/articles/41414918021271-Hide-or-minimize-the-UI) |
| Hide/show UI (Cmd/Ctrl+\) | Hide all UI including toolbar | P0 | [Hide or minimize the UI](https://help.figma.com/hc/en-us/articles/41414918021271-Hide-or-minimize-the-UI) |
| Outlines view (Cmd/Ctrl+Shift+O) | X-ray wireframe mode to see/select hidden, clipped, occluded layers and stroke placement | P0 | [View layer outlines in Figma Design](https://help.figma.com/hc/en-us/articles/5724448965527-View-layer-outlines-in-Figma-Design) |
| Outlines: include hidden layers | Option to show hidden layers in outline mode | P1 | [View layer outlines in Figma Design](https://help.figma.com/hc/en-us/articles/5724448965527-View-layer-outlines-in-Figma-Design) |
| Outlines: include object bounds | Option to show bounding boxes in outline mode | P1 | [View layer outlines in Figma Design](https://help.figma.com/hc/en-us/articles/5724448965527-View-layer-outlines-in-Figma-Design) |

## File utilities, keyboard access & actions menu

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Find (Cmd/Ctrl+F) | Search text and layer names across file; live results | P0 | [Find and replace in Figma](https://help.figma.com/hc/en-us/articles/9141292269847-Find-and-replace-in-Figma) |
| Find: scope | Results for current page or all pages | P0 | [Find and replace in Figma](https://help.figma.com/hc/en-us/articles/9141292269847-Find-and-replace-in-Figma) |
| Find: type filters | Filter by layer type (text, frame, shape...); Other for widgets/slices | P1 | [Find and replace in Figma](https://help.figma.com/hc/en-us/articles/9141292269847-Find-and-replace-in-Figma) |
| Find: result navigation | Prev/next arrows; click result selects layer; Esc returns to Layers | P0 | [Find and replace in Figma](https://help.figma.com/hc/en-us/articles/9141292269847-Find-and-replace-in-Figma) |
| Replace text | Replace in selected results (Cmd/Shift multi-select) or Replace all | P0 | [Find and replace in Figma](https://help.figma.com/hc/en-us/articles/9141292269847-Find-and-replace-in-Figma) |
| Custom file thumbnail | Right-click frame > Set as thumbnail; recommended 1920x1080; restore default | Local: thumbnail embedded in file | [Set custom thumbnails for files](https://help.figma.com/hc/en-us/articles/360038511413-Set-custom-thumbnails-for-files) |
| Default thumbnail | First page content used when none set | P1 | [Set custom thumbnails for files](https://help.figma.com/hc/en-us/articles/360038511413-Set-custom-thumbnails-for-files) |
| Nudge preferences | Preferences > Nudge amount: small (default 1) and big (default 10) | P0 | [Set small and big nudge values](https://help.figma.com/hc/en-us/articles/4404575206295-Set-small-and-big-nudge-values) |
| Keyboard canvas pan | Arrow keys pan with nothing selected; Shift for larger steps | P1 | [Use Figma products with a keyboard](https://help.figma.com/hc/en-us/articles/360040328653-Use-Figma-products-with-a-keyboard) |
| Keyboard zoom | Cmd/Ctrl + / - zoom | P0 | [Use Figma products with a keyboard](https://help.figma.com/hc/en-us/articles/360040328653-Use-Figma-products-with-a-keyboard) |
| Keyboard object creation | Activate tool, crosshair cursor, Enter places object | P2 | [Use Figma products with a keyboard](https://help.figma.com/hc/en-us/articles/360040328653-Use-Figma-products-with-a-keyboard) |
| Toolbar focus (F6 / Ctrl+F6) | Focus toolbar and arrow between tools | P1 | [Use Figma products with a keyboard](https://help.figma.com/hc/en-us/articles/360040328653-Use-Figma-products-with-a-keyboard) |
| Keyboard box selection (Opt+Space / Ctrl+Space) | Pink cursor moved by arrows; Enter selects; Cmd/Ctrl+arrows draws box | P2 | [Use Figma products with a keyboard](https://help.figma.com/hc/en-us/articles/360040328653-Use-Figma-products-with-a-keyboard) |
| Screen reader mode | Preferences > Accessibility > Adapt content for screen readers | P2 | [Use Figma products with a keyboard](https://help.figma.com/hc/en-us/articles/360040328653-Use-Figma-products-with-a-keyboard) |
| Shortcuts panel (Ctrl+Shift+?) | Bottom panel listing shortcuts by category, highlights used ones | P1 | [Use Figma products with a keyboard](https://help.figma.com/hc/en-us/articles/360040328653-Use-Figma-products-with-a-keyboard) |
| Keyboard layout setting | Layout tab in shortcuts panel to pick keyboard layout | P1 | [Use Figma products with a keyboard](https://help.figma.com/hc/en-us/articles/360040328653-Use-Figma-products-with-a-keyboard) |
| Actions menu (Cmd/Ctrl+K) | Command palette searching all actions, AI tools, assets, plugins | P0 | [Use the actions menu in Figma Design](https://help.figma.com/hc/en-us/articles/23570416033943-Use-the-actions-menu-in-Figma-Design) |
| Actions: layer operations | Collapse layers, Frame selection, Rename, Mark ready for dev | P0 | [Use the actions menu in Figma Design](https://help.figma.com/hc/en-us/articles/23570416033943-Use-the-actions-menu-in-Figma-Design) |
| Actions: select all with same | Instance, font, fill, stroke, effect, properties | P1 | [Use the actions menu in Figma Design](https://help.figma.com/hc/en-us/articles/23570416033943-Use-the-actions-menu-in-Figma-Design) |
| Rasterize selection | Convert vector objects to raster image | P1 | [Use the actions menu in Figma Design](https://help.figma.com/hc/en-us/articles/23570416033943-Use-the-actions-menu-in-Figma-Design) |
| Detach instance | Detach selected instance from main component | P0 | [Use the actions menu in Figma Design](https://help.figma.com/hc/en-us/articles/23570416033943-Use-the-actions-menu-in-Figma-Design) |
| Save local copy | Save current file version to device (.fig) | P0 | [Use the actions menu in Figma Design](https://help.figma.com/hc/en-us/articles/23570416033943-Use-the-actions-menu-in-Figma-Design) |
| Actions: view toggles | Layout guides, rulers, dark mode, UI visibility, version history | P0 | [Use the actions menu in Figma Design](https://help.figma.com/hc/en-us/articles/23570416033943-Use-the-actions-menu-in-Figma-Design) |
| Find more like (AI) | Visual similarity search for designs/screenshots across org | P2 | [Use the actions menu in Figma Design](https://help.figma.com/hc/en-us/articles/23570416033943-Use-the-actions-menu-in-Figma-Design) |
| Plugins vs widgets | Plugins visible to runner only; widgets shared canvas objects | P2 | [Use the actions menu in Figma Design](https://help.figma.com/hc/en-us/articles/23570416033943-Use-the-actions-menu-in-Figma-Design) |
| Help and resources menu | Bottom-right help button with shortcuts and resources | P1 | [Use Figma products with a keyboard](https://help.figma.com/hc/en-us/articles/360040328653-Use-Figma-products-with-a-keyboard) |

## AI tools & Figma agent

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| AI: find assets/designs | Search designs by screenshot, selection, or description | P2 | [Use AI tools in Figma Design](https://help.figma.com/hc/en-us/articles/23870272542231-Use-AI-tools-in-Figma-Design) |
| AI: replace content | Fill placeholder text with realistic content | P2 | [Use AI tools in Figma Design](https://help.figma.com/hc/en-us/articles/23870272542231-Use-AI-tools-in-Figma-Design) |
| AI: add interactions | Auto-wire prototype interactions | P2 | [Use AI tools in Figma Design](https://help.figma.com/hc/en-us/articles/23870272542231-Use-AI-tools-in-Figma-Design) |
| AI: rename layers | Meaningful layer names in one click | P2 | [Use AI tools in Figma Design](https://help.figma.com/hc/en-us/articles/23870272542231-Use-AI-tools-in-Figma-Design) |
| AI: rewrite/translate/shorten text | Tone change, translation, shortening | P2 | [Use AI tools in Figma Design](https://help.figma.com/hc/en-us/articles/23870272542231-Use-AI-tools-in-Figma-Design) |
| AI: make/edit images | Generate or edit images from prompt | P2 | [Use AI tools in Figma Design](https://help.figma.com/hc/en-us/articles/23870272542231-Use-AI-tools-in-Figma-Design) |
| AI: remove background | Isolate image subject | P2 | [Use AI tools in Figma Design](https://help.figma.com/hc/en-us/articles/23870272542231-Use-AI-tools-in-Figma-Design) |
| AI: boost resolution | Upscale low-res images | P2 | [Use AI tools in Figma Design](https://help.figma.com/hc/en-us/articles/23870272542231-Use-AI-tools-in-Figma-Design) |
| AI: expand image | Outpaint beyond borders | P2 | [Use AI tools in Figma Design](https://help.figma.com/hc/en-us/articles/23870272542231-Use-AI-tools-in-Figma-Design) |
| AI: isolate/erase objects | Select area to extract as new layer or erase | P2 | [Use AI tools in Figma Design](https://help.figma.com/hc/en-us/articles/23870272542231-Use-AI-tools-in-Figma-Design) |
| Vectorize image | Convert raster image to editable vectors | P2 | [Use AI tools in Figma Design](https://help.figma.com/hc/en-us/articles/23870272542231-Use-AI-tools-in-Figma-Design) |
| First Draft | Generate editable designs from prompt | P2 | [Use AI tools in Figma Design](https://help.figma.com/hc/en-us/articles/23870272542231-Use-AI-tools-in-Figma-Design) |
| AI credits & admin disable | Shared credit system; admin can disable AI | Local: bring-your-own model/key | [Use AI tools in Figma Design](https://help.figma.com/hc/en-us/articles/23870272542231-Use-AI-tools-in-Figma-Design) |
| Agent: on-canvas prompt (Cmd/Ctrl+Enter) | Prompt box on selection; dictate or type | P2 | [Work with the Figma agent](https://help.figma.com/hc/en-us/articles/37998629035799-Work-with-the-Figma-agent-in-design-files) |
| Agent: chat sidebar | Agents tab with chat history, new chat, sharing visibility | P2 | [Work with the Figma agent](https://help.figma.com/hc/en-us/articles/37998629035799-Work-with-the-Figma-agent-in-design-files) |
| Agent: context attachments | Attach Figma files, URLs, images, skills, connected apps | P2 | [Work with the Figma agent](https://help.figma.com/hc/en-us/articles/37998629035799-Work-with-the-Figma-agent-in-design-files) |
| Agent: parallel prompts | Multiple prompts run concurrently with on-canvas progress indicators | P2 | [Work with the Figma agent](https://help.figma.com/hc/en-us/articles/37998629035799-Work-with-the-Figma-agent-in-design-files) |
| Agent: library connection & @mentions | Connect library; @ reference components/variables/styles | P2 | [Work with the Figma agent](https://help.figma.com/hc/en-us/articles/37998629035799-Work-with-the-Figma-agent-in-design-files) |
| Agent: undo | Undo last agent change from chat | P2 | [Work with the Figma agent](https://help.figma.com/hc/en-us/articles/37998629035799-Work-with-the-Figma-agent-in-design-files) |
| Agent: help Q&A | Answers how-to questions from Help Center | P2 | [Work with the Figma agent](https://help.figma.com/hc/en-us/articles/37998629035799-Work-with-the-Figma-agent-in-design-files) |
| Agent: pop-out window | Desktop app pops chat into separate window | P2 | [Work with the Figma agent](https://help.figma.com/hc/en-us/articles/37998629035799-Work-with-the-Figma-agent-in-design-files) |
| Preference: Show AI Chat on canvas | Toggle on-canvas prompting | P2 | [Work with the Figma agent](https://help.figma.com/hc/en-us/articles/37998629035799-Work-with-the-Figma-agent-in-design-files) |
| Agent: skills | Shareable reusable workflow skills run on demand | P2 | [Work with the Figma agent](https://help.figma.com/hc/en-us/articles/37998629035799-Work-with-the-Figma-agent-in-design-files) |
| Agent: MCP connectors & web search | Pull external context via MCP; search the web | P2 | [Work with the Figma agent](https://help.figma.com/hc/en-us/articles/37998629035799-Work-with-the-Figma-agent-in-design-files) |
| Agent: generate plugins/shaders/motion | Create custom plugins, shaders, animations from prompts | P2 | [Work with the Figma agent](https://help.figma.com/hc/en-us/articles/37998629035799-Work-with-the-Figma-agent-in-design-files) |
| Agent: design edits | 0-to-1 screens, layout edits, instances, styles, variables, bulk content | P2 | [Work with the Figma agent](https://help.figma.com/hc/en-us/articles/37998629035799-Work-with-the-Figma-agent-in-design-files) |
| Agent: design feedback | Accessibility checks and persona-based critique | P2 | [Work with the Figma agent](https://help.figma.com/hc/en-us/articles/37998629035799-Work-with-the-Figma-agent-in-design-files) |
| Agent: comments & file actions | Summarize comments, add comments, search other files, select objects | P2 | [Work with the Figma agent](https://help.figma.com/hc/en-us/articles/37998629035799-Work-with-the-Figma-agent-in-design-files) |
| Agent: stop prompt | Stop button ends running task | P2 | [Work with the Figma agent](https://help.figma.com/hc/en-us/articles/37998629035799-Work-with-the-Figma-agent-in-design-files) |
| MCP write-to-canvas | External coding agents write into files via Plugin API over MCP | P2 | [Work with the Figma agent](https://help.figma.com/hc/en-us/articles/37998629035799-Work-with-the-Figma-agent-in-design-files) |

## Layers: panel, selection, lock, visibility, naming

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Layer order (z-order) | Higher in Layers panel renders above lower layers | P0 | [Layers 101: Get started with layers](https://help.figma.com/hc/en-us/articles/26584819173271-Layers-101-Get-started-with-layers) |
| Layer properties by type | Right sidebar shows type-specific sections (position, layout, appearance, typography, fill...) | P0 | [Layers 101: Get started with layers](https://help.figma.com/hc/en-us/articles/26584819173271-Layers-101-Get-started-with-layers) |
| Layer types overview | Frames, text, shapes, pen vectors; images as fills not layers | P0 | [Layers 101: Explore layer types](https://help.figma.com/hc/en-us/articles/26620239826199-Layers-101-Explore-layer-types) |
| Bundled Google fonts | Hundreds of free Google fonts available by default | P0 | [Layers 101: Explore layer types](https://help.figma.com/hc/en-us/articles/26620239826199-Layers-101-Explore-layer-types) |
| Components (overview) | Main component + instances; create component button in sidebar | P0 | [Layers 101: Combine layers](https://help.figma.com/hc/en-us/articles/26610806345623-Layers-101-Combine-layers) |
| Lock layer (Shift+Cmd/Ctrl+L) | Prevent canvas selection/move; props still editable from panel | P0 | [Lock and unlock layers](https://help.figma.com/hc/en-us/articles/360041596573-Lock-and-unlock-layers) |
| Lock: inheritance | Locking parent locks all children; children can't be unlocked separately | P0 | [Lock and unlock layers](https://help.figma.com/hc/en-us/articles/360041596573-Lock-and-unlock-layers) |
| Lock: panel padlock & drag | Hover padlock in Layers panel; drag across rows to lock/unlock many | P0 | [Lock and unlock layers](https://help.figma.com/hc/en-us/articles/360041596573-Lock-and-unlock-layers) |
| Lock: right-click | Right-click > Lock/Unlock | P0 | [Lock and unlock layers](https://help.figma.com/hc/en-us/articles/360041596573-Lock-and-unlock-layers) |
| Hide layer (Shift+Cmd/Ctrl+H) | Toggle visibility; hidden layers greyed in panel and unselectable on canvas | P0 | [Toggle visibility to hide layers](https://help.figma.com/hc/en-us/articles/360041112614-Toggle-visibility-to-hide-layers) |
| Hide: panel eye & sidebar | Eye icon in Layers panel and Appearance section | P0 | [Toggle visibility to hide layers](https://help.figma.com/hc/en-us/articles/360041112614-Toggle-visibility-to-hide-layers) |
| Hide: drag across eyes | Drag across eye icons to toggle many rows | P1 | [Toggle visibility to hide layers](https://help.figma.com/hc/en-us/articles/360041112614-Toggle-visibility-to-hide-layers) |
| Parent/child/sibling model | DOM-like container hierarchy; frames, groups, components, sections as parents | P0 | [Parent, child, and sibling relationships](https://help.figma.com/hc/en-us/articles/360039959014-Parent-child-and-sibling-relationships) |
| Auto reparenting on move | Moving an object over a larger frame reparents it; larger objects don't | P0 | [Parent, child, and sibling relationships](https://help.figma.com/hc/en-us/articles/360039959014-Parent-child-and-sibling-relationships) |
| Space to bypass reparenting | Hold Space when adding/moving to prevent reparenting or keep parent | P0 | [Parent, child, and sibling relationships](https://help.figma.com/hc/en-us/articles/360039959014-Parent-child-and-sibling-relationships) |
| Rename layer inline | Double-click name in Layers panel or frame title on canvas | P0 | [Rename Layers](https://help.figma.com/hc/en-us/articles/360039958934-Rename-Layers) |
| Batch rename (Cmd/Ctrl+R) | Rename-layers modal for multiple layers with preview | P1 | [Rename Layers](https://help.figma.com/hc/en-us/articles/360039958934-Rename-Layers) |
| Batch rename: tokens | Current name, Number ascending/descending with start/stop value | P1 | [Rename Layers](https://help.figma.com/hc/en-us/articles/360039958934-Rename-Layers) |
| Batch rename: match/replace | Match field replaces only matched substring | P1 | [Rename Layers](https://help.figma.com/hc/en-us/articles/360039958934-Rename-Layers) |
| Batch rename: regex | Regex Match with $1, $&, $`, $', $n, $nnn, $NNN replacements | P1 | [Rename Layers](https://help.figma.com/hc/en-us/articles/360039958934-Rename-Layers) |
| AI rename layers | Figma AI renames layers in bulk | P2 | [Rename Layers](https://help.figma.com/hc/en-us/articles/360039958934-Rename-Layers) |
| Select: click | Click selects topmost parent of clicked object | P0 | [Select layers and objects](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects) |
| Select: drill down | Double-click or Enter selects one nesting level deeper | P0 | [Select layers and objects](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects) |
| Deep select (Cmd/Ctrl+click) | Directly select deepest nested layer under cursor | P0 | [Select layers and objects](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects) |
| Select layer menu | Right-click > Select layer lists all layers under cursor incl. locked | P0 | [Select layers and objects](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects) |
| Hierarchy navigation keys | Enter child, Shift+Enter parent, Tab next sibling, Shift+Tab previous | P0 | [Select layers and objects](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects) |
| Layers panel (Opt+1 / Ctrl+1) | Tree of all layers on page; expand/collapse; hover highlights on canvas | P0 | [Select layers and objects](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects) |
| Highlight on hover preference | Toggle canvas highlight when hovering layers | P1 | [Select layers and objects](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects) |
| Shift-click multi-select | Shift+click toggles objects in selection | P0 | [Select layers and objects](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects) |
| Marquee selection | Drag on empty canvas selects intersecting objects; Cmd/Ctrl marquee selects nested | P0 | [Select layers and objects](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects) |
| Marquee: top-level rule | Starting from top-level frame selects only top-level layers | P0 | [Select layers and objects](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects) |
| Layers panel range/toggle select | Shift selects range; Cmd/Ctrl toggles individual rows | P0 | [Select layers and objects](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects) |
| Select matching layers (Opt+Cmd+A / Alt+Ctrl+A) | Select all matching objects across frames; Shift-marquee adds only matches | P1 | [Select layers and objects](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects) |
| Select all with same | Edit > Select all with same properties, fill, stroke, effect, text properties, font, instance | P1 | [Select layers and objects](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects) |
| Select all (Cmd/Ctrl+A) | Select everything at current level | P0 | [Select layers and objects](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects) |
| Select inverse (Cmd/Ctrl+Shift+A) | Invert current selection | P1 | [Select layers and objects](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects) |
| Deselect (Esc / click canvas) | Clear selection | P0 | [Select layers and objects](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects) |
| Collapse all layers | Button collapses all expanded layers except selection | P0 | [Select layers and objects](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects) |
| View-only selection display | Viewers see purple selection box, dashed parent box, layer name, parent component | P2 | [Select layers and objects](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects) |

## Frames & groups

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Frame tool (F / A) | Container layer; click for 100x100 (first) or last top-level size; drag for custom size | P0 | [Frames in Figma Design](https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design) |
| Frame: nested click | Clicking inside a frame with Frame tool adds 100x100 nested frame | P0 | [Frames in Figma Design](https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design) |
| Frame selection (Opt+Cmd+G / Ctrl+Alt+G) | Wraps selected layers in a new frame | P0 | [Frames in Figma Design](https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design) |
| Frame presets | Phone, Tablet, Desktop, Presentation, Watch, Paper, Social Media, Figma Community, Archive | P0 | [Frames in Figma Design](https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design) |
| Frame: change preset | Frame dropdown switches existing frame to another preset size; constraints apply | P0 | [Frames in Figma Design](https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design) |
| Frame: quick-add duplicate | With Frame tool hover frame, click side + to duplicate and push neighbors | P1 | [Frames in Figma Design](https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design) |
| Frame: quick-add blank | Option/Alt + side + creates blank frame of same size | P1 | [Frames in Figma Design](https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design) |
| Frame: section auto-grow | Section resizes to fit duplicated frames inside it | P1 | [Frames in Figma Design](https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design) |
| Frame: Clip content | Hide children overflowing frame bounds | P0 | [Frames in Figma Design](https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design) |
| Frame: properties | Corner radius, clip content, layout guides, auto layout, fills, strokes, effects | P0 | [Frames in Figma Design](https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design) |
| Frame: top-level display | Top-level frames bold in layers panel and named on canvas | P0 | [Frames in Figma Design](https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design) |
| Frame: resize ignoring constraints | Hold Cmd/Ctrl while dragging frame handles to skip child constraints | P0 | [Frames in Figma Design](https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design) |
| Frame: Resize to fit (Opt+Shift+Cmd+R) | Shrink/grow frame to children bounds; also in Layout section | P0 | [Frames in Figma Design](https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design) |
| Frame: ungroup | Cmd/Ctrl+Shift+G or Cmd+Delete / Ctrl+Backspace removes frame keeping children | P0 | [Frames in Figma Design](https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design) |
| Frame: required for features | Layout guides, constraints, auto layout, prototyping require frames | P0 | [Frames in Figma Design](https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design) |
| Group (Cmd/Ctrl+G) | Combine layers; bounds auto-fit children; nestable | P0 | [The difference between frames and groups](https://help.figma.com/hc/en-us/articles/360039832054-The-difference-between-frames-and-groups) |
| Group: ungroup (Shift+Cmd/Ctrl+G) | Ungroup via menu, Shift+Cmd+G, or Cmd+Delete / Ctrl+Backspace | P0 | [The difference between frames and groups](https://help.figma.com/hc/en-us/articles/360039832054-The-difference-between-frames-and-groups) |
| Group: click-through selection | First click selects group; double-click selects child | P0 | [The difference between frames and groups](https://help.figma.com/hc/en-us/articles/360039832054-The-difference-between-frames-and-groups) |
| Group/frame membership by drag | Drag layers in/out of groups and frames on canvas or layers panel | P0 | [The difference between frames and groups](https://help.figma.com/hc/en-us/articles/360039832054-The-difference-between-frames-and-groups) |

## Sections

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Section tool (Shift+S) | Draw labeled canvas region; top-level only; can nest sections; not inside frames/groups | P0 | [Organize your canvas with sections](https://help.figma.com/hc/en-us/articles/9771500257687-Organize-your-canvas-with-sections) |
| Wrap in new section | Right-click selection > Wrap in new section | P0 | [Organize your canvas with sections](https://help.figma.com/hc/en-us/articles/9771500257687-Organize-your-canvas-with-sections) |
| Section: add by move/resize | Moving/resizing section over objects or dragging objects in adds them | P0 | [Organize your canvas with sections](https://help.figma.com/hc/en-us/articles/9771500257687-Organize-your-canvas-with-sections) |
| Section: title edit | Double-click title on canvas or panel | P0 | [Organize your canvas with sections](https://help.figma.com/hc/en-us/articles/9771500257687-Organize-your-canvas-with-sections) |
| Section: fill & stroke | Background and border color via Fill and Stroke | P0 | [Organize your canvas with sections](https://help.figma.com/hc/en-us/articles/9771500257687-Organize-your-canvas-with-sections) |
| Section: navigate | Double-click section icon in layers to zoom to it | P1 | [Organize your canvas with sections](https://help.figma.com/hc/en-us/articles/9771500257687-Organize-your-canvas-with-sections) |
| Section: share link | Copy link to section | Local: deep link to section | [Organize your canvas with sections](https://help.figma.com/hc/en-us/articles/9771500257687-Organize-your-canvas-with-sections) |
| Section: Ready for dev | Mark as ready; auto changes to Changed on edit; resolve with reason | P2 | [Organize your canvas with sections](https://help.figma.com/hc/en-us/articles/9771500257687-Organize-your-canvas-with-sections) |
| Section: delete | Delete removes contents; Cmd+Delete/Ctrl+Backspace removes section only | P0 | [Organize your canvas with sections](https://help.figma.com/hc/en-us/articles/9771500257687-Organize-your-canvas-with-sections) |
| Section: prototype memory | Connecting to section returns to last visited frame | Module | [Organize your canvas with sections](https://help.figma.com/hc/en-us/articles/9771500257687-Organize-your-canvas-with-sections) |

## Shape, arc & pencil tools

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Shape tools menu | Toolbar dropdown: Rectangle, Line, Arrow, Ellipse, Polygon, Star, Image/video | P0 | [Shape tools](https://help.figma.com/hc/en-us/articles/360040450133-Shape-tools) |
| Shape draw: Shift constrain | Shift while dragging for square, circle, regular polygon | P0 | [Shape tools](https://help.figma.com/hc/en-us/articles/360040450133-Shape-tools) |
| Shape draw: Option/Alt from center | Create/resize from center; combine with Shift | P0 | [Shape tools](https://help.figma.com/hc/en-us/articles/360040450133-Shape-tools) |
| Shape draw: dimension label | Live W x H label shown under shape while drawing | P0 | [Shape tools](https://help.figma.com/hc/en-us/articles/360040450133-Shape-tools) |
| Rectangle tool (R) | Draw rectangles/squares; inner-corner radius handles | P0 | [Shape tools](https://help.figma.com/hc/en-us/articles/360040450133-Shape-tools) |
| Line tool (L) | Draw lines in any direction; styled via Stroke section | P0 | [Shape tools](https://help.figma.com/hc/en-us/articles/360040450133-Shape-tools) |
| Arrow tool (Shift+L) | Draw one- or two-sided arrows with configurable end caps | P0 | [Shape tools](https://help.figma.com/hc/en-us/articles/360040450133-Shape-tools) |
| Ellipse tool (O) | Draw ovals/circles | P0 | [Shape tools](https://help.figma.com/hc/en-us/articles/360040450133-Shape-tools) |
| Polygon tool | Draws polygon (default triangle); Count field sets sides; corner rounding | P0 | [Shape tools](https://help.figma.com/hc/en-us/articles/360040450133-Shape-tools) |
| Polygon: stable bounding box | Bounding box stays consistent when points change; flatten snaps to true bounds | P1 | [Shape tools](https://help.figma.com/hc/en-us/articles/360040450133-Shape-tools) |
| Star tool | Default 5 points/10 sides; Count 3-60, Ratio (inner radius %), Radius (rounding) handles | P0 | [Shape tools](https://help.figma.com/hc/en-us/articles/360040450133-Shape-tools) |
| Arc tool: sweep | Ellipse handle drags sweep %, positive or negative, to make pies/arcs | P0 | [Arc tool](https://help.figma.com/hc/en-us/articles/360040450173-Arc-tool-create-arcs-semi-circles-and-rings) |
| Arc tool: start | Start handle rotates where the arc begins | P0 | [Arc tool](https://help.figma.com/hc/en-us/articles/360040450173-Arc-tool-create-arcs-semi-circles-and-rings) |
| Arc tool: ratio | Center ratio handle turns ellipse into ring/donut; closed rings possible | P0 | [Arc tool](https://help.figma.com/hc/en-us/articles/360040450173-Arc-tool-create-arcs-semi-circles-and-rings) |
| Pencil tool (Shift+P) | Freehand sketch; default round 3px black stroke (white on dark); stays active until Esc | P1 | [Sketch on the canvas with the pencil tool](https://help.figma.com/hc/en-us/articles/4402723791511-Sketch-on-the-canvas-with-the-pencil-tool) |
| Pencil: pre-set stroke | Choose color, weight, end point style before or after drawing | P1 | [Sketch on the canvas with the pencil tool](https://help.figma.com/hc/en-us/articles/4402723791511-Sketch-on-the-canvas-with-the-pencil-tool) |
| Pencil: resize sketches | Resize sketch bounds; Shift for proportional | P1 | [Sketch on the canvas with the pencil tool](https://help.figma.com/hc/en-us/articles/4402723791511-Sketch-on-the-canvas-with-the-pencil-tool) |

## Vector editing, networks & boolean operations

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Pen tool (P) | Click to place points; click-drag for curves; click existing point to close; Esc to end open path | P0 | [Vector networks](https://help.figma.com/hc/en-us/articles/360040450213-Vector-networks) |
| Vector networks | Paths can branch in any direction without single-direction constraint | P0 | [Vector networks](https://help.figma.com/hc/en-us/articles/360040450213-Vector-networks) |
| Vector caps: Circle arrow | Additional solid circle cap style for endpoints | P0 | [Vector networks](https://help.figma.com/hc/en-us/articles/360040450213-Vector-networks) |
| Vector caps: per-endpoint | Two-endpoint paths set each cap in sidebar; others per point in edit mode | P0 | [Vector networks](https://help.figma.com/hc/en-us/articles/360040450213-Vector-networks) |
| Vector edit mode (Enter) | Edit points/paths of shapes and vectors; secondary toolbar of vector tools | P0 | [Edit vector layers](https://help.figma.com/hc/en-us/articles/360039957634-Edit-vector-layers) |
| Vector edit: Move (V) | Select and drag points | P0 | [Edit vector layers](https://help.figma.com/hc/en-us/articles/360039957634-Edit-vector-layers) |
| Vector edit: add points with Pen | Click on path with Pen to insert points | P0 | [Edit vector layers](https://help.figma.com/hc/en-us/articles/360039957634-Edit-vector-layers) |
| Vector edit: multi-layer | Shift+click adds more vector layers to editing session | P1 | [Edit vector layers](https://help.figma.com/hc/en-us/articles/360039957634-Edit-vector-layers) |
| Vector edit: switch layer | Cmd/Ctrl+click another layer to switch edited vector | P1 | [Edit vector layers](https://help.figma.com/hc/en-us/articles/360039957634-Edit-vector-layers) |
| Variable width tool | Add width points (pink handle) along stroke; drag/type width; Shift multi-select; Delete removes | P1 | [Edit vector layers](https://help.figma.com/hc/en-us/articles/360039957634-Edit-vector-layers) |
| Variable width: snapping | Width points snap to vector points/midpoints; Ctrl disables snap/pixel grid | P1 | [Edit vector layers](https://help.figma.com/hc/en-us/articles/360039957634-Edit-vector-layers) |
| Variable width: limitations | Not on dynamic/dashed strokes or branching networks | P1 | [Edit vector layers](https://help.figma.com/hc/en-us/articles/360039957634-Edit-vector-layers) |
| Split vector | Right-click/Actions splits branching network into separate paths/layers | P1 | [Edit vector layers](https://help.figma.com/hc/en-us/articles/360039957634-Edit-vector-layers) |
| Cut tool (X) | Click to break path at point; drag across paths to divide into new layer | P1 | [Edit vector layers](https://help.figma.com/hc/en-us/articles/360039957634-Edit-vector-layers) |
| Bend tool | Click point/path to add bézier handles and curve | P0 | [Edit vector layers](https://help.figma.com/hc/en-us/articles/360039957634-Edit-vector-layers) |
| Bézier mirroring | No mirroring, Mirror angle, Mirror angle and length | P0 | [Edit vector layers](https://help.figma.com/hc/en-us/articles/360039957634-Edit-vector-layers) |
| Bézier: move both handles | Shift-select both handles and drag to move together | P1 | [Edit vector layers](https://help.figma.com/hc/en-us/articles/360039957634-Edit-vector-layers) |
| Eraser tool (Shift+E) | Erase parts of paths with configurable weight/shape; adds points; doesn't split layers | P1 | [Edit vector layers](https://help.figma.com/hc/en-us/articles/360039957634-Edit-vector-layers) |
| Lasso tool (Q) | Freeform select points/paths in vector network | P1 | [Edit vector layers](https://help.figma.com/hc/en-us/articles/360039957634-Edit-vector-layers) |
| Multi-point bounding box | Selected points get transform box; Shift proportional, Opt/Alt center, Shift rotate 15° | P0 | [Edit vector layers](https://help.figma.com/hc/en-us/articles/360039957634-Edit-vector-layers) |
| Space to reposition mid-drag | Hold Space during resize/rotate to move, release to resume | P1 | [Edit vector layers](https://help.figma.com/hc/en-us/articles/360039957634-Edit-vector-layers) |
| Paint bucket tool (Shift+B) | Fill/unfill individual closed regions; hover stripes; blue=add, red=remove; drag multi | P1 | [Edit vector layers](https://help.figma.com/hc/en-us/articles/360039957634-Edit-vector-layers) |
| Boolean group (non-destructive) | Combine shapes, vectors, text into live boolean group; not frames/sections | P0 | [Boolean operations](https://help.figma.com/hc/en-us/articles/360039957534-Boolean-operations) |
| Boolean: Union (Opt+Shift+U) | Merge outer edges; top layer supplies fill/stroke/effects | P0 | [Boolean operations](https://help.figma.com/hc/en-us/articles/360039957534-Boolean-operations) |
| Boolean: Subtract (Opt+Shift+S) | Remove overlaps from bottom layer; bottom supplies styling | P0 | [Boolean operations](https://help.figma.com/hc/en-us/articles/360039957534-Boolean-operations) |
| Boolean: Intersect (Opt+Shift+I) | Keep only common overlap; non-overlap yields empty shape | P0 | [Boolean operations](https://help.figma.com/hc/en-us/articles/360039957534-Boolean-operations) |
| Boolean: Exclude (Opt+Shift+E) | Keep non-overlapping areas only | P0 | [Boolean operations](https://help.figma.com/hc/en-us/articles/360039957534-Boolean-operations) |
| Boolean: stroke-aware geometry | Booleans use stroke plus fill geometry; legacy groups prompt update | P1 | [Boolean operations](https://help.figma.com/hc/en-us/articles/360039957534-Boolean-operations) |
| Boolean: edit children | Children keep editable size/position/rotation/radius; styling owned by group; Ungroup reverts | P0 | [Boolean operations](https://help.figma.com/hc/en-us/articles/360039957534-Boolean-operations) |
| Outline stroke (Opt+Cmd+O / Ctrl+Alt+O) | Converts stroke to filled vector path; destructive; style color becomes fill | P0 | [Convert strokes to vector paths](https://help.figma.com/hc/en-us/articles/33052305733015-Convert-strokes-to-vector-paths) |
| Preference: old outline shortcuts | Toggle uses Cmd+Shift+O for outline stroke and Shift+O for outlines view | P2 | [Convert strokes to vector paths](https://help.figma.com/hc/en-us/articles/33052305733015-Convert-strokes-to-vector-paths) |
| Text to vector: flatten | Flatten text into one vector layer, losing editability | P0 | [Convert text to vector paths](https://help.figma.com/hc/en-us/articles/360047239073-Convert-text-to-vector-paths) |
| Text to vector: outline | Outline stroke on text makes each glyph its own vector layer | P1 | [Convert text to vector paths](https://help.figma.com/hc/en-us/articles/360047239073-Convert-text-to-vector-paths) |
| Flatten (Opt+Shift+F) | Merge selection into single vector; containers removed; destructive | P0 | [Flatten layers](https://help.figma.com/hc/en-us/articles/30101373312279-Flatten-layers) |
| Shape builder tool | In vector edit mode, hover regions; drag to merge, click to extract, Opt/Alt+click to delete; destructive | P1 | [Create custom shapes with the shape builder tool](https://help.figma.com/hc/en-us/articles/31616004109847-Create-custom-shapes-with-the-shape-builder-tool) |
| Offset vector | Grow (+) or shrink (-) path evenly by Amount; join Square or Round; destructive | P1 | [Offset a vector path](https://help.figma.com/hc/en-us/articles/33792861450263-Offset-a-vector-path) |
| Simplify vector | Slider removes unnecessary points automatically; destructive | P1 | [Simplify a vector path](https://help.figma.com/hc/en-us/articles/33792593975575-Simplify-a-vector-path) |
| Delete and heal (Shift+Delete) | Remove selected points while preserving path continuity | P1 | [Simplify a vector path](https://help.figma.com/hc/en-us/articles/33792593975575-Simplify-a-vector-path) |

## Masks

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Mask: use as mask (Ctrl+Cmd+M / Ctrl+Alt+M) | Bottom-most selected layer masks siblings above it; creates mask group | P0 | [Masks](https://help.figma.com/hc/en-us/articles/360040450253-Masks) |
| Mask: any layer as mask | Vectors, text, transparent images, groups etc. can be masks | P0 | [Masks](https://help.figma.com/hc/en-us/articles/360040450253-Masks) |
| Mask: scope rule | Masks siblings above until another mask, parent end, or clip-content frame | P0 | [Masks](https://help.figma.com/hc/en-us/articles/360040450253-Masks) |
| Mask: layers panel icon | Mask icon with upward arrow marks masked layers | P0 | [Masks](https://help.figma.com/hc/en-us/articles/360040450253-Masks) |
| Mask type: Alpha | Default; reveal proportional to mask opacity (blur, shadows, gradients count) | P0 | [Masks](https://help.figma.com/hc/en-us/articles/360040450253-Masks) |
| Mask type: Vector | Uses outline; any area >0% opacity becomes fully opaque | P1 | [Masks](https://help.figma.com/hc/en-us/articles/360040450253-Masks) |
| Mask type: Luminance | Brightness determines reveal; black reveals nothing | P1 | [Masks](https://help.figma.com/hc/en-us/articles/360040450253-Masks) |
| Mask type: hover preview | Mask section dropdown previews types on hover | P2 | [Masks](https://help.figma.com/hc/en-us/articles/360040450253-Masks) |
| Mask: add layers | Drag layers into mask group in Layers panel | P0 | [Masks](https://help.figma.com/hc/en-us/articles/360040450253-Masks) |
| Mask: independent transform | Mask and masked layers move/resize independently (siblings) | P0 | [Masks](https://help.figma.com/hc/en-us/articles/360040450253-Masks) |
| Mask: remove | Sidebar toggle, right-click Remove mask, or same shortcut | P0 | [Masks](https://help.figma.com/hc/en-us/articles/360040450253-Masks) |
| Mask outlines view | View > Mask outlines shows mask bounds in green | P1 | [Masks](https://help.figma.com/hc/en-us/articles/360040450253-Masks) |

## Position, transform, measure, smart selection & copy/paste

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Align controls | Align left, h-center, right, top, v-center, bottom; single layer aligns to parent | P0 | [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) |
| Align shortcuts | Alt+W top, Alt+A left, Alt+S bottom, Alt+D right, Alt+V v-center, Alt+H h-center | P0 | [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) |
| Align as group to parent | Shift+click align aligns multi-selection as group to parent frame(s) | P1 | [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) |
| Snap to geometry | Vector edit: snap points to other points (red guides) | P0 | [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) |
| Snap to objects | Snap to centers/edges of other objects with red guides | P0 | [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) |
| Snap toggles | Preferences or quick actions; global per user; Ctrl temporarily disables snapping | P0 | [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) |
| Distribute horizontal/vertical spacing | Equalize spacing keeping outermost layers fixed | P0 | [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) |
| Tidy up | Arrange selection into row, column, or 2D grid using most common spacing from top-left | P1 | [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) |
| Spacing display | Shows mode spacing; pixel-grid snapping allows 1px rounding, else decimals | P1 | [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) |
| Position X/Y | Top-left of bounds coordinates; rotated layers use original top-left | P0 | [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) |
| Arrow nudge | Arrows move by small nudge (1), Shift+arrow big nudge (10) | P0 | [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) |
| Dimensions W/H | Fields and canvas edge/corner handles; blue size label under selection | P0 | [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) |
| Lock aspect ratio | Toggle keeps W/H ratio; Ctrl disables temporarily, Shift enables temporarily | P0 | [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) |
| Lock aspect ratio: min/max | Locked ratio propagates proportional min/max to other axis | P1 | [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) |
| Lock aspect ratio: instances | Not available on instance children | P1 | [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) |
| Rotation field | -180 to 180°, positive counterclockwise, around selection center | P0 | [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) |
| Rotation: canvas handle | Drag just outside corners to rotate; Shift snaps to 15° | P0 | [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) |
| Rotation: effects unrotated | Effects (e.g. shadows) are not rotated with layer | P1 | [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) |
| Rotation origin (Opt/Alt+R) | Reveal and drag rotation origin target | P1 | [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) |
| Flip horizontal/vertical | Shift+H / Shift+V or right-click flips selection | P0 | [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) |
| Layer order: drag in panel | Drag layers in Layers panel to reorder or reparent | P0 | [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) |
| Bring forward/backward | Cmd/Ctrl+] forward, Cmd/Ctrl+[ backward | P0 | [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) |
| Bring to front/send to back | Cmd+Opt+] / Ctrl+Shift+] front; Cmd+Opt+[ / Ctrl+Shift+[ back | P0 | [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) |
| Field equations | + - * / ^ () in position/size/rotation fields; apply to mixed selections (e.g. Mixed+100) | P0 | [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) |
| Field percentage | Dimension fields accept % (e.g. 50%) | P1 | [Frames in Figma Design](https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design) |
| Scrub fields | Drag field label/icon (or Opt/Alt+hover field) to change value; continues off-screen | P0 | [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) |
| Scrub speed | Move cursor up/down to switch scrub speed 2x, 1x, 1/2, 1/4 with notification | P2 | [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) |
| Smart selection: criteria | Equal spacing and overlap on one axis (1D) or both (2D); pink center rings | P1 | [Arrange layers with Smart selection](https://help.figma.com/hc/en-us/articles/360040450233-Arrange-layers-with-Smart-selection) |
| Smart selection: mark layers | Click ring to mark; Shift multi; double-click marks all (1D); Shift+double-click marks axis (2D) | P1 | [Arrange layers with Smart selection](https://help.figma.com/hc/en-us/articles/360040450233-Arrange-layers-with-Smart-selection) |
| Smart selection: adjust spacing | Drag pink handles between items (tooltip px) or edit h/v space-between fields | P1 | [Arrange layers with Smart selection](https://help.figma.com/hc/en-us/articles/360040450233-Arrange-layers-with-Smart-selection) |
| Smart selection: reorder | Drag marked items; blue indicator; Cmd/Ctrl to swap positions; layer order unchanged | P1 | [Arrange layers with Smart selection](https://help.figma.com/hc/en-us/articles/360040450233-Arrange-layers-with-Smart-selection) |
| Smart selection: duplicate | Cmd/Ctrl+D inserts copy right (row) or below (column/grid), others reflow | P1 | [Arrange layers with Smart selection](https://help.figma.com/hc/en-us/articles/360040450233-Arrange-layers-with-Smart-selection) |
| Smart selection: resize | Resize item, siblings reposition to keep spacing; Opt/Alt from center | P1 | [Arrange layers with Smart selection](https://help.figma.com/hc/en-us/articles/360040450233-Arrange-layers-with-Smart-selection) |
| Smart selection: delete | Delete marked items; others shift left/up to close gap | P1 | [Arrange layers with Smart selection](https://help.figma.com/hc/en-us/articles/360040450233-Arrange-layers-with-Smart-selection) |
| Copy/paste (Cmd/Ctrl+C/V) | Copy within page, across pages, or across files | P0 | [Copy and paste objects](https://help.figma.com/hc/en-us/articles/4409078832791-Copy-and-paste-objects) |
| Paste placement: relative position | Keeps x/y relative to container if it fits, else centers per axis | P0 | [Copy and paste objects](https://help.figma.com/hc/en-us/articles/4409078832791-Copy-and-paste-objects) |
| Paste placement: viewport aware | Pastes in view center if far away; nudges/zooms view to show pasted object (50% margin rule) | P1 | [Copy and paste objects](https://help.figma.com/hc/en-us/articles/4409078832791-Copy-and-paste-objects) |
| Duplicate: Opt/Alt-drag | Drag with modifier to duplicate | P0 | [Copy and paste objects](https://help.figma.com/hc/en-us/articles/4409078832791-Copy-and-paste-objects) |
| Duplicate (Cmd/Ctrl+D) | Top-level frames duplicate to the right; others on top | P0 | [Copy and paste objects](https://help.figma.com/hc/en-us/articles/4409078832791-Copy-and-paste-objects) |
| Duplicate: repeat transform | Repeated Cmd+D continues last offset/rotation from previous duplicate | P1 | [Copy and paste objects](https://help.figma.com/hc/en-us/articles/4409078832791-Copy-and-paste-objects) |
| Paste to replace (Shift+Cmd/Ctrl+R) | Replace selected objects with clipboard object, adopting their constraints | P1 | [Copy and paste objects](https://help.figma.com/hc/en-us/articles/4409078832791-Copy-and-paste-objects) |
| Paste over selection (Cmd/Ctrl+Shift+V) | Paste on top of selected frame (not inside) matching its x/y | P1 | [Copy and paste objects](https://help.figma.com/hc/en-us/articles/4409078832791-Copy-and-paste-objects) |
| Multi-paste | Paste into many selected frames at once; multiple copied objects cycle across frames | P1 | [Copy and paste objects](https://help.figma.com/hc/en-us/articles/4409078832791-Copy-and-paste-objects) |
| Paste to clipped frames | Objects outside frame bounds keep outside position when pasted | P1 | [Copy and paste objects](https://help.figma.com/hc/en-us/articles/4409078832791-Copy-and-paste-objects) |
| Copy as PNG (Shift+Cmd/Ctrl+C) | Copies selection as 2x PNG to clipboard | P0 | [Copy and paste objects](https://help.figma.com/hc/en-us/articles/4409078832791-Copy-and-paste-objects) |
| Copy as code | Copy/Paste as > Copy as code: CSS, iOS, Android | P1 | [Copy and paste objects](https://help.figma.com/hc/en-us/articles/4409078832791-Copy-and-paste-objects) |
| Paste image as new layer | Paste clipboard image onto canvas creates rectangle with image fill (4096px cap) | P0 | [Copy and paste objects](https://help.figma.com/hc/en-us/articles/4409078832791-Copy-and-paste-objects) |
| Paste image into fill | Select area left of fill swatch then paste to replace fill | P1 | [Copy and paste objects](https://help.figma.com/hc/en-us/articles/4409078832791-Copy-and-paste-objects) |
| Paste GIF caveat | Browser clipboard GIFs paste as static image | P1 | [Copy and paste objects](https://help.figma.com/hc/en-us/articles/4409078832791-Copy-and-paste-objects) |
| Copy/paste single property | Highlight a fill/stroke/effect in sidebar, copy, paste onto another layer | P0 | [Copy and paste properties between layers](https://help.figma.com/hc/en-us/articles/4412765442967-Copy-and-paste-properties-between-layers) |
| Copy/paste all properties | Opt+Cmd+C / Ctrl+Alt+C then Opt+Cmd+V / Ctrl+Alt+V applies supported properties | P0 | [Copy and paste properties between layers](https://help.figma.com/hc/en-us/articles/4412765442967-Copy-and-paste-properties-between-layers) |
| Paste properties to text range | Paste onto highlighted text or onto run at cursor | P1 | [Copy and paste properties between layers](https://help.figma.com/hc/en-us/articles/4412765442967-Copy-and-paste-properties-between-layers) |
| Bulk edit across containers | Rotate, group, mask, boolean, add AL on multi-selection across frames/groups/sections | P0 | [Edit objects on the canvas in bulk](https://help.figma.com/hc/en-us/articles/21635177948567-Edit-objects-on-the-canvas-in-bulk) |
| Multi-edit variants (Q) | Edits to one variant apply to matching layers in all variants of set | P1 | [Edit objects on the canvas in bulk](https://help.figma.com/hc/en-us/articles/21635177948567-Edit-objects-on-the-canvas-in-bulk) |
| Matching objects | Same layer name, ancestor names and hierarchy across top-level frames | P1 | [Identify matching objects](https://help.figma.com/hc/en-us/articles/21523793229463-Identify-matching-objects) |
| Matching objects: text rule | Auto-named text layers match by text style and position | P1 | [Identify matching objects](https://help.figma.com/hc/en-us/articles/21523793229463-Identify-matching-objects) |
| Matching objects: sections | Objects in sections only match within same section | P1 | [Identify matching objects](https://help.figma.com/hc/en-us/articles/21523793229463-Identify-matching-objects) |
| Highlight matching (Shift hold) | Holding Shift with selection highlights matching objects in light blue | P1 | [Identify matching objects](https://help.figma.com/hc/en-us/articles/21523793229463-Identify-matching-objects) |
| Measure distance (Opt/Alt hover) | Select one object, hover another to show red distance lines and values | P0 | [Measure distances between layers](https://help.figma.com/hc/en-us/articles/360039956974-Measure-distances-between-layers) |
| Measure nested (Cmd+Opt / Ctrl+Alt) | Measure to nested layers through blocking parents | P0 | [Measure distances between layers](https://help.figma.com/hc/en-us/articles/360039956974-Measure-distances-between-layers) |
| Measure: bounds rules | Measures bounding boxes (not strokes, text baselines, odd-polygon shapes) | P0 | [Measure distances between layers](https://help.figma.com/hc/en-us/articles/360039956974-Measure-distances-between-layers) |
| Measure: guides | Selected guide + hover shows guide positions | P1 | [Measure distances between layers](https://help.figma.com/hc/en-us/articles/360039956974-Measure-distances-between-layers) |
| Measure: vector points | In vector edit mode, Opt/Alt hover measures point-to-point | P1 | [Measure distances between layers](https://help.figma.com/hc/en-us/articles/360039956974-Measure-distances-between-layers) |
| Scale tool (K) | Proportional resize that scales strokes, effects, text and ignores constraints | P0 | [Scale layers while maintaining proportions](https://help.figma.com/hc/en-us/articles/360040451453-Scale-layers-while-maintaining-proportions) |
| Scale panel: multiplier | Dropdown or typed multiplier applies scale | P0 | [Scale layers while maintaining proportions](https://help.figma.com/hc/en-us/articles/360040451453-Scale-layers-while-maintaining-proportions) |
| Scale panel: W/H fields | Type one dimension, other updates proportionally | P0 | [Scale layers while maintaining proportions](https://help.figma.com/hc/en-us/articles/360040451453-Scale-layers-while-maintaining-proportions) |
| Scale panel: anchor box | 9-point anchor sets which point stays fixed while scaling | P0 | [Scale layers while maintaining proportions](https://help.figma.com/hc/en-us/articles/360040451453-Scale-layers-while-maintaining-proportions) |
| Scale restrictions | Not on locked layers or instance children | P1 | [Scale layers while maintaining proportions](https://help.figma.com/hc/en-us/articles/360040451453-Scale-layers-while-maintaining-proportions) |

## Constraints & layout guides

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Constraints: horizontal | Left, Right, Left and right, Center, Scale | P0 | [Apply constraints](https://help.figma.com/hc/en-us/articles/360039957734-Apply-constraints-to-define-how-layers-resize) |
| Constraints: vertical | Top, Bottom, Top and bottom, Center, Scale | P0 | [Apply constraints](https://help.figma.com/hc/en-us/articles/360039957734-Apply-constraints-to-define-how-layers-resize) |
| Constraints: default | New layers default to Top and Left | P0 | [Apply constraints](https://help.figma.com/hc/en-us/articles/360039957734-Apply-constraints-to-define-how-layers-resize) |
| Constraints: Scale | Size/position as % of parent maintained on resize | P0 | [Apply constraints](https://help.figma.com/hc/en-us/articles/360039957734-Apply-constraints-to-define-how-layers-resize) |
| Constraints: UI | Constraints in Position section: dropdowns plus interactive diagram; Shift multi-select | P0 | [Apply constraints](https://help.figma.com/hc/en-us/articles/360039957734-Apply-constraints-to-define-how-layers-resize) |
| Constraints: canvas indicator | Blue dotted lines show applied constraints on canvas | P1 | [Apply constraints](https://help.figma.com/hc/en-us/articles/360039957734-Apply-constraints-to-define-how-layers-resize) |
| Constraints: scope | Any layer in a frame incl. nested frames; not outside frames or in AL flow | P0 | [Apply constraints](https://help.figma.com/hc/en-us/articles/360039957734-Apply-constraints-to-define-how-layers-resize) |
| Constraints: groups | Groups have no own constraints; setting on group applies to children | P0 | [Apply constraints](https://help.figma.com/hc/en-us/articles/360039957734-Apply-constraints-to-define-how-layers-resize) |
| Constraints: ignore (Cmd/Ctrl) | Hold modifier while resizing to ignore constraints | P0 | [Apply constraints](https://help.figma.com/hc/en-us/articles/360039957734-Apply-constraints-to-define-how-layers-resize) |
| Constraints + Stretch guides | Constraints relative to nearest guide column/row when guide is Stretch | P1 | [Combine layout guides and constraints](https://help.figma.com/hc/en-us/articles/360039957934-Combine-layout-guides-and-constraints) |
| Constraints + Fixed guides | Constraints relative to frame, not guide, when guide is fixed | P1 | [Combine layout guides and constraints](https://help.figma.com/hc/en-us/articles/360039957934-Combine-layout-guides-and-constraints) |
| Layout guide: add | + in Layout guide section adds uniform grid by default to frames/components | P0 | [Create layout guides](https://help.figma.com/hc/en-us/articles/360040450513-Create-layout-guides) |
| Layout guide: Uniform grid | Square grid with size (default 10px) and color | P0 | [Create layout guides](https://help.figma.com/hc/en-us/articles/360040450513-Create-layout-guides) |
| Layout guide: Columns | Count (number, variable, or Auto), type Left/Center/Right/Stretch, width, offset, gutter, margin | P0 | [Create layout guides](https://help.figma.com/hc/en-us/articles/360040450513-Create-layout-guides) |
| Layout guide: Rows | Count, type Top/Center/Bottom/Stretch, height, offset, gutter, margin | P0 | [Create layout guides](https://help.figma.com/hc/en-us/articles/360040450513-Create-layout-guides) |
| Layout guide: color | Default red #FF0000 at 10% opacity; editable color and opacity | P0 | [Create layout guides](https://help.figma.com/hc/en-us/articles/360040450513-Create-layout-guides) |
| Layout guide: Stretch margin/gutter | Stretch type has margin and gutter; width/height auto | P0 | [Create layout guides](https://help.figma.com/hc/en-us/articles/360040450513-Create-layout-guides) |
| Layout guide: fixed offset | Fixed types set column width/row height and offset from start edge | P0 | [Create layout guides](https://help.figma.com/hc/en-us/articles/360040450513-Create-layout-guides) |
| Layout guide: count variable | Count can bind to number variable | P2 | [Create layout guides](https://help.figma.com/hc/en-us/articles/360040450513-Create-layout-guides) |
| Layout guide: multiple | Stack multiple guides (e.g. columns + rows) on one frame | P0 | [Create layout guides](https://help.figma.com/hc/en-us/articles/360040450513-Create-layout-guides) |
| Layout guide: per-guide visibility | Eye toggle per guide; hidden guides still snap | P0 | [Create layout guides](https://help.figma.com/hc/en-us/articles/360040450513-Create-layout-guides) |
| Layout guide styles | Save guides as reusable grid style; apply from style picker | P1 | [Create layout guides](https://help.figma.com/hc/en-us/articles/360040450513-Create-layout-guides) |
| Layout guide: copy/paste | Highlight guide in sidebar, Cmd/Ctrl+C then paste onto another frame | P1 | [Create layout guides](https://help.figma.com/hc/en-us/articles/360040450513-Create-layout-guides) |
| Layout guide: rotated frames | Guides don't show on rotated frames | P1 | [Create layout guides](https://help.figma.com/hc/en-us/articles/360040450513-Create-layout-guides) |

## Auto layout

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Auto layout: add (Shift+A) | Wrap selection in auto layout frame; Figma infers flow | P0 | [Guide to auto layout in Figma](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma) |
| Auto layout: suggest (Ctrl+Shift+A / Ctrl+Alt+Shift+A) | Suggest auto layout structure for selection | P1 | [Guide to auto layout in Figma](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma) |
| Auto layout: remove (Opt/Alt+Shift+A) | Remove auto layout from frame | P0 | [Guide to auto layout in Figma](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma) |
| Auto layout flow: Vertical | Stack children along y-axis | P0 | [Guide to auto layout in Figma](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma) |
| Auto layout flow: Horizontal | Stack children along x-axis | P0 | [Guide to auto layout in Figma](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma) |
| Auto layout flow: Grid | Place children in rows/columns with spanning | P0 | [Guide to auto layout in Figma](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma) |
| Auto layout: wrap (horizontal) | Children wrap to new row when out of width | P0 | [Guide to auto layout in Figma](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma) |
| Auto layout: wrap (vertical) | Children wrap to new column when out of height (not masonry) | P1 | [Guide to auto layout in Figma](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma) |
| Auto layout: padding | Uniform, vertical/horizontal, or per-side T/R/B/L | P0 | [Guide to auto layout in Figma](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma) |
| Auto layout: gap | Fixed number or Auto (Between, Around, Evenly) for H/V flows | P0 | [Guide to auto layout in Figma](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma) |
| Resizing: Hug contents | Auto layout frame shrinks to children plus padding; double-click edge sets | P0 | [Guide to auto layout in Figma](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma) |
| Resizing: Fill container | Child stretches to available space; not top-level; Opt/Alt+double-click edge sets | P0 | [Guide to auto layout in Figma](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma) |
| Resizing: Fixed | Explicit width/height; set automatically by manual resize or typed value | P0 | [Guide to auto layout in Figma](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma) |
| Resizing: hug overridden by fill child | Fill child forces parent from Hug to Fixed on that axis | P0 | [Guide to auto layout in Figma](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma) |
| Resizing: auto-fill on full drag | Child resized to full available space becomes Fill container | P1 | [Guide to auto layout in Figma](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma) |
| Resizing: hover canvas preview | Hovering resizing options shows on-canvas lines of resulting bounds | P2 | [Guide to auto layout in Figma](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma) |
| Min/max width & height | Add min/max per axis; bindable to number variables; icons show limits; Remove min and max | P0 | [Guide to auto layout in Figma](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma) |
| Ignore auto layout | Child excluded from flow (absolute); uses constraints; Ctrl-drag (mac) to place | P0 | [Guide to auto layout in Figma](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma) |
| Nested auto layout | Mix vertical/horizontal/grid in nested frames each with own padding/gap | P0 | [Combine vertical, horizontal, and grid flows](https://help.figma.com/hc/en-us/articles/31441443713047-Combine-vertical-horizontal-and-grid-auto-layout-flows) |
| Auto layout & constraints | Children can't use constraints unless ignoring auto layout; nested AL frame can | P0 | [Guide to auto layout in Figma](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma) |
| Auto layout in instances | Instances can change padding/gap; can't reorder/add; delete only hides | P0 | [Guide to auto layout in Figma](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma) |
| Text max height vs max lines | Mutually exclusive on text layers | P1 | [Guide to auto layout in Figma](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma) |
| Shortcut: edit all padding | Cmd/Ctrl+click padding field edits all sides | P1 | [Guide to auto layout in Figma](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma) |
| Alignment box keys | Arrows set alignment, W/A/S/D to edge, B baseline toggle, X gap-between toggle | P1 | [Guide to auto layout in Figma](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma) |
| Canvas padding handles | Drag padding/gap handles; Opt mirrors opposite, Opt+Shift all sides, Shift big nudge | P0 | [Guide to auto layout in Figma](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma) |
| Click padding area to input | Opt+click edits opposite padding; Opt+Shift+click all sides | P1 | [Guide to auto layout in Figma](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma) |
| Grid: duplicate fills next cell | Cmd/Ctrl+D in grid places duplicates into subsequent cells | P1 | [Combine vertical, horizontal, and grid flows](https://help.figma.com/hc/en-us/articles/31441443713047-Combine-vertical-horizontal-and-grid-auto-layout-flows) |
| Grid: click frame tool into cell | Frame tool click places frame in grid cell | P1 | [Combine vertical, horizontal, and grid flows](https://help.figma.com/hc/en-us/articles/31441443713047-Combine-vertical-horizontal-and-grid-auto-layout-flows) |
| Auto layout: targets | Applies to frames, components, component sets; groups/selections get wrapped in AL frame | P0 | [Toggle on auto layout in designs](https://help.figma.com/hc/en-us/articles/5731482952599-Toggle-on-auto-layout-in-designs) |
| Auto layout: entry points | Shift+A, + next to Auto layout, right-click Add auto layout, or flow buttons | P0 | [Toggle on auto layout in designs](https://help.figma.com/hc/en-us/articles/5731482952599-Toggle-on-auto-layout-in-designs) |
| Suggest auto layout | Infers and creates nested AL frames across a design in one step; new frames marked with blue dot | P2 | [Toggle on auto layout in designs](https://help.figma.com/hc/en-us/articles/5731482952599-Toggle-on-auto-layout-in-designs) |
| Remove auto layout: Freeform | Freeform button or right-click removes AL, restoring regular frame props | P0 | [Toggle on auto layout in designs](https://help.figma.com/hc/en-us/articles/5731482952599-Toggle-on-auto-layout-in-designs) |
| Remove all auto layout | More layout options removes AL from frame and all nested frames | P1 | [Toggle on auto layout in designs](https://help.figma.com/hc/en-us/articles/5731482952599-Toggle-on-auto-layout-in-designs) |
| Auto layout: instance restriction | AL cannot be removed on instances without detaching | P0 | [Toggle on auto layout in designs](https://help.figma.com/hc/en-us/articles/5731482952599-Toggle-on-auto-layout-in-designs) |
| Layout version (flexbox-aligned) | New AL version matches CSS flexbox; per-frame version switch; Actions update selection/page | P0 | [Use auto layout with CSS Flexbox in mind](https://help.figma.com/hc/en-us/articles/42031586813719-Use-auto-layout-with-CSS-Flexbox-in-mind) |
| Flexbox: padding minimum | Frame can't be smaller than padding (+inside stroke); clamps like border-box | P0 | [Use auto layout with CSS Flexbox in mind](https://help.figma.com/hc/en-us/articles/42031586813719-Use-auto-layout-with-CSS-Flexbox-in-mind) |
| Flexbox: only inside strokes in layout | Inside strokes count like border; center/outside act like outline | P0 | [Use auto layout with CSS Flexbox in mind](https://help.figma.com/hc/en-us/articles/42031586813719-Use-auto-layout-with-CSS-Flexbox-in-mind) |
| Flexbox: stroke setting not inherited | Parent stroke-in-layout setting no longer affects children | P0 | [Use auto layout with CSS Flexbox in mind](https://help.figma.com/hc/en-us/articles/42031586813719-Use-auto-layout-with-CSS-Flexbox-in-mind) |
| Flexbox: fill children border-box | Fill siblings share space by content box, matching CSS | P0 | [Use auto layout with CSS Flexbox in mind](https://help.figma.com/hc/en-us/articles/42031586813719-Use-auto-layout-with-CSS-Flexbox-in-mind) |
| Flexbox: auto gap never negative | Auto gap clamps at 0; overflow collapses to start; explicit negative gap allowed | P0 | [Use auto layout with CSS Flexbox in mind](https://help.figma.com/hc/en-us/articles/42031586813719-Use-auto-layout-with-CSS-Flexbox-in-mind) |
| Flexbox: single child in Between | Aligns start (not center); Around/Evenly still center | P0 | [Use auto layout with CSS Flexbox in mind](https://help.figma.com/hc/en-us/articles/42031586813719-Use-auto-layout-with-CSS-Flexbox-in-mind) |
| Negative gap | Explicit negative gap values for overlapping stacks | P0 | [Use auto layout with CSS Flexbox in mind](https://help.figma.com/hc/en-us/articles/42031586813719-Use-auto-layout-with-CSS-Flexbox-in-mind) |
| Auto layout: alignment box | 9-position alignment (3 when gap Auto) set on parent | P0 | [Use the horizontal and vertical flows](https://help.figma.com/hc/en-us/articles/31289464393751-Use-the-horizontal-and-vertical-flows-in-auto-layout) |
| Auto spacing modes | Between (default), Evenly (1:1), Around (2:1) like CSS space-between/evenly/around | P0 | [Use the horizontal and vertical flows](https://help.figma.com/hc/en-us/articles/31289464393751-Use-the-horizontal-and-vertical-flows-in-auto-layout) |
| Wrap: dual gaps | With wrap, separate item gap and row/column gap | P0 | [Use the horizontal and vertical flows](https://help.figma.com/hc/en-us/articles/31289464393751-Use-the-horizontal-and-vertical-flows-in-auto-layout) |
| Padding: CSS shorthand | Type "1,2,3,4" or "1,2" into padding fields; Tab between fields | P1 | [Use the horizontal and vertical flows](https://help.figma.com/hc/en-us/articles/31289464393751-Use-the-horizontal-and-vertical-flows-in-auto-layout) |
| Padding: individual toggle | Button switches to top/right/bottom/left fields | P0 | [Use the horizontal and vertical flows](https://help.figma.com/hc/en-us/articles/31289464393751-Use-the-horizontal-and-vertical-flows-in-auto-layout) |
| Canvas padding/gap handles | Pink on-canvas handles: click to type, drag to adjust | P0 | [Use the horizontal and vertical flows](https://help.figma.com/hc/en-us/articles/31289464393751-Use-the-horizontal-and-vertical-flows-in-auto-layout) |
| Text baseline alignment | Align children by text baseline (B in alignment box) | P1 | [Use the horizontal and vertical flows](https://help.figma.com/hc/en-us/articles/31289464393751-Use-the-horizontal-and-vertical-flows-in-auto-layout) |
| Strokes in layout | Inside strokes Included/Excluded from layout per frame | P0 | [Use the horizontal and vertical flows](https://help.figma.com/hc/en-us/articles/31289464393751-Use-the-horizontal-and-vertical-flows-in-auto-layout) |
| Canvas stacking | First on top or Last on top (visual only, layer order unchanged) | P1 | [Use the horizontal and vertical flows](https://help.figma.com/hc/en-us/articles/31289464393751-Use-the-horizontal-and-vertical-flows-in-auto-layout) |
| AL: drop to insert | Drag objects in; blue indicator shows insertion; larger objects need Cmd/Ctrl | P0 | [Use the horizontal and vertical flows](https://help.figma.com/hc/en-us/articles/31289464393751-Use-the-horizontal-and-vertical-flows-in-auto-layout) |
| AL: Cmd/Ctrl drag into nested | Modifier drops into nested AL or forces oversized object in | P1 | [Use the horizontal and vertical flows](https://help.figma.com/hc/en-us/articles/31289464393751-Use-the-horizontal-and-vertical-flows-in-auto-layout) |
| AL: duplicate places after | Cmd/Ctrl+D inserts duplicate right/below original | P0 | [Use the horizontal and vertical flows](https://help.figma.com/hc/en-us/articles/31289464393751-Use-the-horizontal-and-vertical-flows-in-auto-layout) |
| AL: reorder by arrows/drag | Arrow keys or drag reorder children; Cmd/Ctrl deep-selects nested | P0 | [Use the horizontal and vertical flows](https://help.figma.com/hc/en-us/articles/31289464393751-Use-the-horizontal-and-vertical-flows-in-auto-layout) |
| AL: hidden children excluded | Hidden children removed from flow; 0% opacity keeps space | P0 | [Use the horizontal and vertical flows](https://help.figma.com/hc/en-us/articles/31289464393751-Use-the-horizontal-and-vertical-flows-in-auto-layout) |
| AL: reversed layer order | Inside AL, layers panel order maps to flow order | P0 | [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) |
| Grid: columns & rows | Grid picker or fields set counts; rows default Auto (grow/shrink); math in fields | P0 | [Use the grid auto layout flow](https://help.figma.com/hc/en-us/articles/31289469907863-Use-the-grid-auto-layout-flow) |
| Grid: track sizing | Per-track Fixed, Fill (fr units), Hug; set via canvas pill label or sidebar list | P0 | [Use the grid auto layout flow](https://help.figma.com/hc/en-us/articles/31289469907863-Use-the-grid-auto-layout-flow) |
| Grid: fr units | Fill tracks share space proportionally by fr; typing Auto/A sets 1fr | P0 | [Use the grid auto layout flow](https://help.figma.com/hc/en-us/articles/31289469907863-Use-the-grid-auto-layout-flow) |
| Grid: drag track edge | Dragging track edge sets it Fixed | P1 | [Use the grid auto layout flow](https://help.figma.com/hc/en-us/articles/31289469907863-Use-the-grid-auto-layout-flow) |
| Grid: multi-track edit | Cmd/Ctrl or Shift select multiple tracks to set size together | P1 | [Use the grid auto layout flow](https://help.figma.com/hc/en-us/articles/31289469907863-Use-the-grid-auto-layout-flow) |
| Grid: reorder tracks | Drag grabber to move row/column, including spanning objects | P1 | [Use the grid auto layout flow](https://help.figma.com/hc/en-us/articles/31289469907863-Use-the-grid-auto-layout-flow) |
| Grid: delete tracks | Delete track (and contents) via label + Delete or sidebar - | P1 | [Use the grid auto layout flow](https://help.figma.com/hc/en-us/articles/31289469907863-Use-the-grid-auto-layout-flow) |
| Grid: row/column gap | Gap between rows and between columns fields | P0 | [Use the grid auto layout flow](https://help.figma.com/hc/en-us/articles/31289469907863-Use-the-grid-auto-layout-flow) |
| Grid: padding | Horizontal/vertical, individual, or CSS shorthand | P0 | [Use the grid auto layout flow](https://help.figma.com/hc/en-us/articles/31289469907863-Use-the-grid-auto-layout-flow) |
| Grid: add/move objects | Create in cell, drag into cell or between cells, arrow keys reorder | P0 | [Use the grid auto layout flow](https://help.figma.com/hc/en-us/articles/31289469907863-Use-the-grid-auto-layout-flow) |
| Grid: swap objects | Drag pink smart-selection circles to swap same-span objects | P1 | [Use the grid auto layout flow](https://help.figma.com/hc/en-us/articles/31289469907863-Use-the-grid-auto-layout-flow) |
| Grid: auto placement | Default left-to-right, top-to-bottom auto flow; overflow creates rows | P0 | [Use the grid auto layout flow](https://help.figma.com/hc/en-us/articles/31289469907863-Use-the-grid-auto-layout-flow) |
| Grid: toggle automatic positioning | Off allows manual placement and empty cells | P1 | [Use the grid auto layout flow](https://help.figma.com/hc/en-us/articles/31289469907863-Use-the-grid-auto-layout-flow) |
| Grid: span | Column span / Row span fields or resize to snap; requires Fill | P0 | [Use the grid auto layout flow](https://help.figma.com/hc/en-us/articles/31289469907863-Use-the-grid-auto-layout-flow) |
| Grid: cell alignment | Align child within its cell: left, h-center, right, top, v-center | P0 | [Use the grid auto layout flow](https://help.figma.com/hc/en-us/articles/31289469907863-Use-the-grid-auto-layout-flow) |
| Grid: min/max | Min/max width/height on grid frames and cell objects | P1 | [Use the grid auto layout flow](https://help.figma.com/hc/en-us/articles/31289469907863-Use-the-grid-auto-layout-flow) |

## Fills, color picker & color models

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Color models | Display colors as Hex (default), RGB, HSB, HSL, CSS; display only, not rendering | P0 | [About color models](https://help.figma.com/hc/en-us/articles/360043042113-About-color-models) |
| Color model: Hex | #RRGGBBAA; 6-digit + separate alpha % or 8-digit with alpha | P0 | [About color models](https://help.figma.com/hc/en-us/articles/360043042113-About-color-models) |
| Color model: RGB | R,G,B 0-255 plus alpha % field | P0 | [About color models](https://help.figma.com/hc/en-us/articles/360043042113-About-color-models) |
| Color model: HSB | Hue 0-360, saturation 0-100, brightness 0-100, alpha | P0 | [About color models](https://help.figma.com/hc/en-us/articles/360043042113-About-color-models) |
| Color model: HSL | Hue 0-360, saturation 0-100, luminance 0-100, alpha | P0 | [About color models](https://help.figma.com/hc/en-us/articles/360043042113-About-color-models) |
| Color model: CSS | Single field accepting rgba(), hsl(), color(display-p3), color(srgb), oklch(), oklab(); stored in entered space | P1 | [About color models](https://help.figma.com/hc/en-us/articles/360043042113-About-color-models) |
| Color profiles | sRGB or Display P3 as default, per-file, or per-export profile | P1 | [About color models](https://help.figma.com/hc/en-us/articles/360043042113-About-color-models) |
| Fill types | Solid, Gradient, Pattern, Image, Video (video incl. animated GIF) | P0 | [Guide to fills](https://help.figma.com/hc/en-us/articles/360041003694-Guide-to-fills) |
| Multiple fills | Layers and strokes can hold multiple fills, each with independent properties | P0 | [Guide to fills](https://help.figma.com/hc/en-us/articles/360041003694-Guide-to-fills) |
| Fill: add/remove | + adds default solid fill; - removes | P0 | [Guide to fills](https://help.figma.com/hc/en-us/articles/360041003694-Guide-to-fills) |
| Fill: opacity field | Per-fill opacity next to swatch | P0 | [Guide to fills](https://help.figma.com/hc/en-us/articles/360041003694-Guide-to-fills) |
| Fill: visibility toggle | Eye icon shows/hides individual fill | P0 | [Guide to fills](https://help.figma.com/hc/en-us/articles/360041003694-Guide-to-fills) |
| Fill: reorder | Drag handle on left edge reorders fills | P0 | [Guide to fills](https://help.figma.com/hc/en-us/articles/360041003694-Guide-to-fills) |
| Fill: text layer fill | Text fill colors glyphs only; background requires frame | P0 | [Guide to fills](https://help.figma.com/hc/en-us/articles/360041003694-Guide-to-fills) |
| Fill: closed-only rule | Layer fills render only on closed objects; strokes on open and closed | P0 | [Guide to fills](https://help.figma.com/hc/en-us/articles/360041003694-Guide-to-fills) |
| Eyedropper tool (I / Ctrl+C mac) | Sample color from any layer, image or page background and apply to selection fill | P0 | [Sample colors with the eyedropper tool](https://help.figma.com/hc/en-us/articles/27643269375767-Sample-colors-with-the-eyedropper-tool) |
| Eyedropper: from color picker | Eyedropper icon in any color picker (stroke, shadow, mixed colors) | P0 | [Sample colors with the eyedropper tool](https://help.figma.com/hc/en-us/articles/27643269375767-Sample-colors-with-the-eyedropper-tool) |
| Eyedropper: hover info | Hover shows color appearance and value; Tab cycles Hex/RGB/HSL/HSB | P1 | [Sample colors with the eyedropper tool](https://help.figma.com/hc/en-us/articles/27643269375767-Sample-colors-with-the-eyedropper-tool) |
| Eyedropper: sample style/variable | Shift+click applies sampled color variable or style rather than raw value | P1 | [Sample colors with the eyedropper tool](https://help.figma.com/hc/en-us/articles/27643269375767-Sample-colors-with-the-eyedropper-tool) |
| Eyedropper: create style/variable | Hold Cmd/Ctrl+Shift and click/Enter to open modal creating style or variable from sample | P1 | [Sample colors with the eyedropper tool](https://help.figma.com/hc/en-us/articles/27643269375767-Sample-colors-with-the-eyedropper-tool) |
| Eyedropper: copy to clipboard | With nothing selected, click copies color value (Shift adds style/variable name) | P1 | [Sample colors with the eyedropper tool](https://help.figma.com/hc/en-us/articles/27643269375767-Sample-colors-with-the-eyedropper-tool) |
| Eyedropper: sample outside app | Desktop macOS 14+ samples anywhere on screen (needs screen recording permission) | P2 | [Sample colors with the eyedropper tool](https://help.figma.com/hc/en-us/articles/27643269375767-Sample-colors-with-the-eyedropper-tool) |
| Color picker: open | Click fill/stroke swatch, or a Selection colors swatch for mixed selections | P0 | [Update fills using the color picker](https://help.figma.com/hc/en-us/articles/360041003774-Update-fills-using-the-color-picker) |
| Color picker: custom/libraries tabs | Choose custom color or browse color styles/variables from file and libraries | P0 | [Update fills using the color picker](https://help.figma.com/hc/en-us/articles/360041003774-Update-fills-using-the-color-picker) |
| Color picker: create style/variable | + in picker creates new color style or variable from current color | P0 | [Update fills using the color picker](https://help.figma.com/hc/en-us/articles/360041003774-Update-fills-using-the-color-picker) |
| Color picker: fill type switcher | Switch between Solid, Gradient, Pattern, Image, Video | P0 | [Update fills using the color picker](https://help.figma.com/hc/en-us/articles/360041003774-Update-fills-using-the-color-picker) |
| Color picker: palette, hue, opacity | 2D saturation/brightness palette, hue slider, opacity slider | P0 | [Update fills using the color picker](https://help.figma.com/hc/en-us/articles/360041003774-Update-fills-using-the-color-picker) |
| Color picker: model dropdown | Toggle values among RGB, HEX, CSS, HSL, HSB | P0 | [Update fills using the color picker](https://help.figma.com/hc/en-us/articles/360041003774-Update-fills-using-the-color-picker) |
| Color picker: document colors | View/select colors used in current file or added libraries | P1 | [Update fills using the color picker](https://help.figma.com/hc/en-us/articles/360041003774-Update-fills-using-the-color-picker) |
| Color contrast checker | WCAG contrast ratio (1:1-21:1) of selected layer vs background in picker | P1 | [Update fills using the color picker](https://help.figma.com/hc/en-us/articles/360041003774-Update-fills-using-the-color-picker) |
| Contrast checker: thresholds | AA 4.5:1 normal text, 3:1 large text/graphics; AAA 7:1 normal text | P1 | [Update fills using the color picker](https://help.figma.com/hc/en-us/articles/360041003774-Update-fills-using-the-color-picker) |
| Contrast checker: auto-fix | Click failing indicator to snap to nearest compliant color | P1 | [Update fills using the color picker](https://help.figma.com/hc/en-us/articles/360041003774-Update-fills-using-the-color-picker) |
| Contrast checker: settings | Category Auto/Large text/Normal text/Graphics; level AA or AAA (text only) | P1 | [Update fills using the color picker](https://help.figma.com/hc/en-us/articles/360041003774-Update-fills-using-the-color-picker) |
| Selection colors section | Lists unique solid/gradient colors in mixed selection grouped by variable, style, raw | P0 | [View and adjust colors in a mixed selection](https://help.figma.com/hc/en-us/articles/360042553434-View-and-adjust-colors-in-a-mixed-selection) |
| Selection colors: edit in place | Click raw color to edit for all layers using it; opacity field per color | P0 | [View and adjust colors in a mixed selection](https://help.figma.com/hc/en-us/articles/360042553434-View-and-adjust-colors-in-a-mixed-selection) |
| Selection colors: swap style/variable | Click style/variable to swap; Detach; Style button to apply or create | P1 | [View and adjust colors in a mixed selection](https://help.figma.com/hc/en-us/articles/360042553434-View-and-adjust-colors-in-a-mixed-selection) |
| Selection colors: select matching | Target icon selects all layers using that color | P1 | [View and adjust colors in a mixed selection](https://help.figma.com/hc/en-us/articles/360042553434-View-and-adjust-colors-in-a-mixed-selection) |
| Selection colors: exclusions | Excludes pattern/image/video, hidden fills, masks, boolean child colors | P1 | [View and adjust colors in a mixed selection](https://help.figma.com/hc/en-us/articles/360042553434-View-and-adjust-colors-in-a-mixed-selection) |

## Gradients & pattern fills

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Gradient: Linear | Straight-line transition between color stops | P0 | [Use gradients as a fill or stroke](https://help.figma.com/hc/en-us/articles/34208860210199-Use-gradients-as-a-fill-or-stroke) |
| Gradient: Radial | Circular gradient from center to edge | P0 | [Use gradients as a fill or stroke](https://help.figma.com/hc/en-us/articles/34208860210199-Use-gradients-as-a-fill-or-stroke) |
| Gradient: Angular | Conic gradient progressing clockwise from start position | P0 | [Use gradients as a fill or stroke](https://help.figma.com/hc/en-us/articles/34208860210199-Use-gradients-as-a-fill-or-stroke) |
| Gradient: Diamond | Four-point gradient from center with independent width/height | P1 | [Use gradients as a fill or stroke](https://help.figma.com/hc/en-us/articles/34208860210199-Use-gradients-as-a-fill-or-stroke) |
| Gradient: on strokes | Gradients usable on stroke paints as well as fills | P0 | [Use gradients as a fill or stroke](https://help.figma.com/hc/en-us/articles/34208860210199-Use-gradients-as-a-fill-or-stroke) |
| Gradient: color stops | Default 2 stops; drag to move; click bar or + to add; Delete or - to remove | P0 | [Use gradients as a fill or stroke](https://help.figma.com/hc/en-us/articles/34208860210199-Use-gradients-as-a-fill-or-stroke) |
| Gradient: on-canvas handles | Drag gradient handles on canvas to set position, direction, size | P0 | [Use gradients as a fill or stroke](https://help.figma.com/hc/en-us/articles/34208860210199-Use-gradients-as-a-fill-or-stroke) |
| Gradient: Flip | Reverse gradient stop order | P0 | [Use gradients as a fill or stroke](https://help.figma.com/hc/en-us/articles/34208860210199-Use-gradients-as-a-fill-or-stroke) |
| Gradient: Rotate | Rotate gradient orientation | P0 | [Use gradients as a fill or stroke](https://help.figma.com/hc/en-us/articles/34208860210199-Use-gradients-as-a-fill-or-stroke) |
| Gradient: variables on stops | Bind color variables to individual stops; detach per stop | P1 | [Use gradients as a fill or stroke](https://help.figma.com/hc/en-us/articles/34208860210199-Use-gradients-as-a-fill-or-stroke) |
| Gradient: save as style | Gradients (incl. variable stops) saveable as color styles | P0 | [Use gradients as a fill or stroke](https://help.figma.com/hc/en-us/articles/34208860210199-Use-gradients-as-a-fill-or-stroke) |
| Pattern fill | Fill/stroke that tiles another canvas object (layer, group or frame) from same file | P1 | [Use patterns as a fill or stroke](https://help.figma.com/hc/en-us/articles/31616030150167-Use-patterns-as-a-fill-or-stroke) |
| Pattern: Select source | Pick source object on canvas; pattern updates live when source changes | P1 | [Use patterns as a fill or stroke](https://help.figma.com/hc/en-us/articles/31616030150167-Use-patterns-as-a-fill-or-stroke) |
| Pattern: options | Tile type, scale, spacing, alignment, opacity | P1 | [Use patterns as a fill or stroke](https://help.figma.com/hc/en-us/articles/31616030150167-Use-patterns-as-a-fill-or-stroke) |

## Images & video

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Image formats | Import JPG, PNG, HEIC, WebP, GIF, TIFF (Safari only) | P0 | [Add images and videos to designs](https://help.figma.com/hc/en-us/articles/360040028034-Add-images-and-videos-to-designs) |
| Video formats | Import MP4, MOV, WebM (paid in Figma) | P1 | [Add images and videos to designs](https://help.figma.com/hc/en-us/articles/360040028034-Add-images-and-videos-to-designs) |
| SVG import to vectors | Imported SVG files become editable vector layers, not images | P0 | [Add images and videos to designs](https://help.figma.com/hc/en-us/articles/360040028034-Add-images-and-videos-to-designs) |
| Images as fills | No image layer type; media are fills on any layer; drop creates rectangle with image fill | P0 | [Add images and videos to designs](https://help.figma.com/hc/en-us/articles/360040028034-Add-images-and-videos-to-designs) |
| Image/video layer icons | Layers panel icon distinguishes Image vs Video/GIF fill | P1 | [Add images and videos to designs](https://help.figma.com/hc/en-us/articles/360040028034-Add-images-and-videos-to-designs) |
| Image size cap | Uploads over 4096x4096 downscaled so longest side is 4096px; metadata may be lost | P0 | [Add images and videos to designs](https://help.figma.com/hc/en-us/articles/360040028034-Add-images-and-videos-to-designs) |
| Upload via color picker | Image/Video fill type shows checker placeholder; Upload from computer | P0 | [Add images and videos to designs](https://help.figma.com/hc/en-us/articles/360040028034-Add-images-and-videos-to-designs) |
| Make an image (AI) | Generate image fill with AI from color picker | P2 | [Add images and videos to designs](https://help.figma.com/hc/en-us/articles/360040028034-Add-images-and-videos-to-designs) |
| Place image/video (Shift+Cmd/Ctrl+K) | Bulk-pick files; cursor badge counts remaining; click to place at original size | P0 | [Add images and videos to designs](https://help.figma.com/hc/en-us/articles/360040028034-Add-images-and-videos-to-designs) |
| Place image: into existing object | Click existing object while placing to replace its fill | P0 | [Add images and videos to designs](https://help.figma.com/hc/en-us/articles/360040028034-Add-images-and-videos-to-designs) |
| Place image: Place all / discard | Place all drops remaining at one location; Delete discards remaining | P1 | [Add images and videos to designs](https://help.figma.com/hc/en-us/articles/360040028034-Add-images-and-videos-to-designs) |
| Paste & drag-drop images | Paste from clipboard or drag files from OS onto canvas | P0 | [Add images and videos to designs](https://help.figma.com/hc/en-us/articles/360040028034-Add-images-and-videos-to-designs) |
| Replace image fill by drag | Drag file onto picker preview or fill swatch; keeps fill mode/crop | P1 | [Add images and videos to designs](https://help.figma.com/hc/en-us/articles/360040028034-Add-images-and-videos-to-designs) |
| AI image edits | Expand images, remove backgrounds etc. with AI | P2 | [Add images and videos to designs](https://help.figma.com/hc/en-us/articles/360040028034-Add-images-and-videos-to-designs) |
| Image fill mode: Fill | Scale to cover layer, clipping overflow | P0 | [Adjust the properties of an image](https://help.figma.com/hc/en-us/articles/360041098433-Adjust-the-properties-of-an-image) |
| Image fill mode: Fit | Whole image visible within layer (letterboxed) | P0 | [Adjust the properties of an image](https://help.figma.com/hc/en-us/articles/360041098433-Adjust-the-properties-of-an-image) |
| Image fill mode: Crop | Non-destructive crop boundaries within layer | P0 | [Adjust the properties of an image](https://help.figma.com/hc/en-us/articles/360041098433-Adjust-the-properties-of-an-image) |
| Image fill mode: Tile | Repeat image; tile size as % of original dimensions | P1 | [Adjust the properties of an image](https://help.figma.com/hc/en-us/articles/360041098433-Adjust-the-properties-of-an-image) |
| Image: Rotate 90° | Rotates image fill clockwise in 90° steps without rotating layer | P0 | [Adjust the properties of an image](https://help.figma.com/hc/en-us/articles/360041098433-Adjust-the-properties-of-an-image) |
| Image adjustments | Non-destructive sliders: Exposure, Contrast, Saturation, Temperature, Tint, Highlights, Shadows | P1 | [Adjust the properties of an image](https://help.figma.com/hc/en-us/articles/360041098433-Adjust-the-properties-of-an-image) |
| Crop tool: activate | Double-click image layer, Crop image button, or fill mode Crop | P0 | [Crop an image](https://help.figma.com/hc/en-us/articles/360040675194-Crop-an-image) |
| Crop tool: controls | Drag handles, crop slider, aspect ratio picker, Resize to fit; Enter/click outside applies | P0 | [Crop an image](https://help.figma.com/hc/en-us/articles/360040675194-Crop-an-image) |
| Crop tool: modifiers | Option/Alt symmetric; Ctrl/Fn free aspect; Cmd/Ctrl+drag corner quick-crop | P1 | [Crop an image](https://help.figma.com/hc/en-us/articles/360040675194-Crop-an-image) |
| Crop: reposition, rotate, resize | Drag faded area to reposition, outside corner to rotate (Shift=15°), edge to resize | P0 | [Crop an image](https://help.figma.com/hc/en-us/articles/360040675194-Crop-an-image) |

## Blend modes

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Blend mode: layer | Appearance section blend mode for whole layer; one per layer | P0 | [Apply blend modes](https://help.figma.com/hc/en-us/articles/360040667874-Apply-blend-modes-to-layers-fills-and-effects) |
| Blend mode: per fill/stroke | Blend mode per fill or stroke paint in color picker; not on color-style fills | P0 | [Apply blend modes](https://help.figma.com/hc/en-us/articles/360040667874-Apply-blend-modes-to-layers-fills-and-effects) |
| Blend mode: per effect | Blend mode on drop shadow, inner shadow, noise | P1 | [Apply blend modes](https://help.figma.com/hc/en-us/articles/360040667874-Apply-blend-modes-to-layers-fills-and-effects) |
| Blend mode: hover preview | Hovering options previews live on canvas | P1 | [Apply blend modes](https://help.figma.com/hc/en-us/articles/360040667874-Apply-blend-modes-to-layers-fills-and-effects) |
| Blend mode: Pass through | Layer default; lets child/fill blend modes reach content below; not on fills/effects | P0 | [Apply blend modes](https://help.figma.com/hc/en-us/articles/360040667874-Apply-blend-modes-to-layers-fills-and-effects) |
| Blend mode: Normal | Default for fills/effects; on parents isolates child blending | P0 | [Apply blend modes](https://help.figma.com/hc/en-us/articles/360040667874-Apply-blend-modes-to-layers-fills-and-effects) |
| Blend modes: darken group | Darken, Multiply, Plus darker, Color burn | P0 | [Apply blend modes](https://help.figma.com/hc/en-us/articles/360040667874-Apply-blend-modes-to-layers-fills-and-effects) |
| Blend modes: lighten group | Lighten, Screen, Plus lighter, Color dodge | P0 | [Apply blend modes](https://help.figma.com/hc/en-us/articles/360040667874-Apply-blend-modes-to-layers-fills-and-effects) |
| Blend modes: contrast group | Overlay, Soft light, Hard light | P0 | [Apply blend modes](https://help.figma.com/hc/en-us/articles/360040667874-Apply-blend-modes-to-layers-fills-and-effects) |
| Blend modes: inversion group | Difference, Exclusion | P0 | [Apply blend modes](https://help.figma.com/hc/en-us/articles/360040667874-Apply-blend-modes-to-layers-fills-and-effects) |
| Blend modes: component group | Hue, Saturation, Color, Luminosity | P0 | [Apply blend modes](https://help.figma.com/hc/en-us/articles/360040667874-Apply-blend-modes-to-layers-fills-and-effects) |

## Strokes

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Stroke: add/remove | + adds stroke, - removes; default solid stroke fill | P0 | [Apply and adjust stroke properties](https://help.figma.com/hc/en-us/articles/360049283914-Apply-and-adjust-stroke-properties) |
| Stroke: multiple fills | Multiple stroke paints sharing position/weight/style; reorder, show/hide each | P0 | [Apply and adjust stroke properties](https://help.figma.com/hc/en-us/articles/360049283914-Apply-and-adjust-stroke-properties) |
| Stroke: styles & variables | Apply color styles/variables to stroke paints via libraries picker; only color is stylable | P0 | [Apply and adjust stroke properties](https://help.figma.com/hc/en-us/articles/360049283914-Apply-and-adjust-stroke-properties) |
| Stroke: position | Inside (default), Center (default for lines), Outside; hover preview on canvas | P0 | [Apply and adjust stroke properties](https://help.figma.com/hc/en-us/articles/360049283914-Apply-and-adjust-stroke-properties) |
| Stroke: weight | Stroke weight in px; not included in layer dimensions | P0 | [Apply and adjust stroke properties](https://help.figma.com/hc/en-us/articles/360049283914-Apply-and-adjust-stroke-properties) |
| Stroke: width profile | Presets taper ends / vary thickness; not on branching, dynamic or dashed strokes | P1 | [Apply and adjust stroke properties](https://help.figma.com/hc/en-us/articles/360049283914-Apply-and-adjust-stroke-properties) |
| Stroke: individual sides | Rect/frame/component/instance: All, Top, Bottom, Left, Right, Custom per-side weights (0 removes) | P0 | [Apply and adjust stroke properties](https://help.figma.com/hc/en-us/articles/360049283914-Apply-and-adjust-stroke-properties) |
| Stroke: per-point properties | Vector edit mode lets stroke props (caps, joins) differ per point | P1 | [Apply and adjust stroke properties](https://help.figma.com/hc/en-us/articles/360049283914-Apply-and-adjust-stroke-properties) |
| Stroke: end points (two-ended path) | Start/end cap selectors in Stroke section for open paths | P0 | [Apply and adjust stroke properties](https://help.figma.com/hc/en-us/articles/360049283914-Apply-and-adjust-stroke-properties) |
| Stroke: end points (multi-endpoint) | Networks with >2 endpoints set caps in Advanced stroke settings, all or per endpoint | P1 | [Apply and adjust stroke properties](https://help.figma.com/hc/en-us/articles/360049283914-Apply-and-adjust-stroke-properties) |
| Stroke cap values | None, Round (default), Square, Line arrow, Triangle arrow, Reverse triangle, Diamond arrow | P0 | [Apply and adjust stroke properties](https://help.figma.com/hc/en-us/articles/360049283914-Apply-and-adjust-stroke-properties) |
| Stroke: Advanced stroke settings | Panel for stroke style (Solid/Dashed/Custom), brush, dynamic, caps, join, miter | P0 | [Apply and adjust stroke properties](https://help.figma.com/hc/en-us/articles/360049283914-Apply-and-adjust-stroke-properties) |
| Stroke: dashed | Dash length and Gap in px; dash cap None/Round/Square; starts/ends with half dash | P0 | [Apply and adjust stroke properties](https://help.figma.com/hc/en-us/articles/360049283914-Apply-and-adjust-stroke-properties) |
| Stroke: dotted recipe | Center stroke, dash 1px, round cap, adjustable gap | P0 | [Apply and adjust stroke properties](https://help.figma.com/hc/en-us/articles/360049283914-Apply-and-adjust-stroke-properties) |
| Stroke: custom dash pattern | Comma list "dash, gap, dash, gap..." with chosen dash cap | P1 | [Apply and adjust stroke properties](https://help.figma.com/hc/en-us/articles/360049283914-Apply-and-adjust-stroke-properties) |
| Stroke: brush stroke | Brush tab of brush styles with hover preview; Direction setting; center only | P1 | [Apply and adjust stroke properties](https://help.figma.com/hc/en-us/articles/360049283914-Apply-and-adjust-stroke-properties) |
| Stroke: dynamic stroke | Hand-drawn bumpy stroke: Frequency, Wiggle, Smoothen; center only | P1 | [Apply and adjust stroke properties](https://help.figma.com/hc/en-us/articles/360049283914-Apply-and-adjust-stroke-properties) |
| Stroke: join | Miter, Bevel, Round; whole path or per anchor | P0 | [Apply and adjust stroke properties](https://help.figma.com/hc/en-us/articles/360049283914-Apply-and-adjust-stroke-properties) |
| Stroke: miter angle | Angles at or below threshold bevel, above stay sharp | P1 | [Apply and adjust stroke properties](https://help.figma.com/hc/en-us/articles/360049283914-Apply-and-adjust-stroke-properties) |
| Stroke: support matrix | Per-layer-type support for position, width profile, per-side, endpoint, join (e.g. lines center only) | P0 | [Apply and adjust stroke properties](https://help.figma.com/hc/en-us/articles/360049283914-Apply-and-adjust-stroke-properties) |
| Stroke: view-only "Borders" | Viewers see strokes as Borders with CSS/Hex/RGB/HSL/HSB representation and Copy | P2 | [Apply and adjust stroke properties](https://help.figma.com/hc/en-us/articles/360049283914-Apply-and-adjust-stroke-properties) |
| Stroke: resize vs scale | Resize keeps stroke weight; Scale tool scales stroke weight proportionally | P0 | [Apply and adjust stroke properties](https://help.figma.com/hc/en-us/articles/360049283914-Apply-and-adjust-stroke-properties) |

## Corner radius & smoothing

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Corner radius | Rounded corners in px for frames, rect, polygon, star, closed vectors, booleans containing rects | P0 | [Adjust corner radius and smoothing](https://help.figma.com/hc/en-us/articles/360050986854-Adjust-corner-radius-and-smoothing) |
| Corner radius: scrub icon | Drag on radius icon left/right to decrease/increase | P0 | [Adjust corner radius and smoothing](https://help.figma.com/hc/en-us/articles/360050986854-Adjust-corner-radius-and-smoothing) |
| Corner radius: arrow-key nudge | Arrow keys apply small nudge, Shift+arrow big nudge to radius field | P0 | [Adjust corner radius and smoothing](https://help.figma.com/hc/en-us/articles/360050986854-Adjust-corner-radius-and-smoothing) |
| Corner radius: canvas handles | Drag on-canvas radius handle on rect/star/polygon corners | P0 | [Adjust corner radius and smoothing](https://help.figma.com/hc/en-us/articles/360050986854-Adjust-corner-radius-and-smoothing) |
| Corner radius: single-corner drag | Hold Option/Alt while dragging handle to round one rectangle corner | P0 | [Adjust corner radius and smoothing](https://help.figma.com/hc/en-us/articles/360050986854-Adjust-corner-radius-and-smoothing) |
| Independent corners | Rect/frame per-corner radius fields; each bindable to number variable | P0 | [Adjust corner radius and smoothing](https://help.figma.com/hc/en-us/articles/360050986854-Adjust-corner-radius-and-smoothing) |
| Corner radius: per vector point | In vector edit mode set radius on individual points | P1 | [Adjust corner radius and smoothing](https://help.figma.com/hc/en-us/articles/360050986854-Adjust-corner-radius-and-smoothing) |
| Corner radius: unsupported targets | Not on lines, arrows, single-stroke vectors, ellipse-only booleans; no per-corner override in instances | P0 | [Adjust corner radius and smoothing](https://help.figma.com/hc/en-us/articles/360050986854-Adjust-corner-radius-and-smoothing) |
| Corner smoothing | Slider 0-100% for continuous-curve "squircle" corners; whole shape only | P1 | [Adjust corner radius and smoothing](https://help.figma.com/hc/en-us/articles/360050986854-Adjust-corner-radius-and-smoothing) |
| Corner smoothing: iOS preset | One-click sets smoothing to 60% | P1 | [Adjust corner radius and smoothing](https://help.figma.com/hc/en-us/articles/360050986854-Adjust-corner-radius-and-smoothing) |

## Effects

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Effects: types | Glass, Drop shadow, Inner shadow, Layer blur, Background blur, Noise, Texture | P0 | [Apply effects to layers](https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers) |
| Effects: per-layer limits | Max 8 drop shadows, 8 inner shadows, 1 layer blur, 2 noise, 1 texture, 1 background blur, 1 glass | P0 | [Apply effects to layers](https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers) |
| Effects: hover preview | Hovering effect type options previews on canvas | P1 | [Apply effects to layers](https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers) |
| Effects: visibility toggle | Toggle individual effects on/off (also for performance) | P0 | [Apply effects to layers](https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers) |
| Effects: copy/paste/duplicate | In effect settings Esc then Cmd/Ctrl+C/V copies effect to other layer; Cmd/Ctrl+D duplicates | P1 | [Apply effects to layers](https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers) |
| Effects: reorder | Drag handles to reorder effects; order affects rendering | P0 | [Apply effects to layers](https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers) |
| Effects: effect styles | Save shadow/blur settings as reusable effect styles | P0 | [Apply effects to layers](https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers) |
| Drop shadow | Shadow behind layer: X, Y, Blur, Spread, Fill color/opacity, blend mode | P0 | [Apply effects to layers](https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers) |
| Inner shadow | Shadow inside layer bounds: X, Y, Blur, Spread, color, blend mode | P0 | [Apply effects to layers](https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers) |
| Drop shadow: Show behind transparent areas | Checkbox shows shadow through translucent fills/stroke-only/non-normal blend layers; not for inner | P1 | [Apply effects to layers](https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers) |
| Shadow: spread support | Spread only on rect, ellipse, frames, components; frames need clip content and fill >=1% | P0 | [Apply effects to layers](https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers) |
| Shadow: CSS mapping | Shadows map to box-shadow; on text to text-shadow | P1 | [Apply effects to layers](https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers) |
| Layer blur: uniform | Same blur radius across entire layer | P0 | [Apply effects to layers](https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers) |
| Layer blur: progressive | Control blur size, direction and start/end intensity | P1 | [Apply effects to layers](https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers) |
| Background blur: uniform | Blurs content behind layer; visible only when fill opacity <100% | P0 | [Apply effects to layers](https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers) |
| Background blur: progressive | Background blur with variable size, direction and start/end intensity | P1 | [Apply effects to layers](https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers) |
| Background blur: no stacking | Other background-blurred layers behind are ignored rather than multiplied | P1 | [Apply effects to layers](https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers) |
| Glass effect | Translucent refractive "liquid glass" on any layer type; one per layer | P1 | [Apply effects to layers](https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers) |
| Glass: settings | Light angle, Light intensity, Refraction, Depth, Dispersion, Frost, Splay | P1 | [Apply effects to layers](https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers) |
| Glass: limitations | Invisible on 100% opaque fills; no glass-on-glass, reflections, SVG export; conflicts with background blur | P1 | [Apply effects to layers](https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers) |
| Noise effect | Grain: Mono/Duo/Multi colors, noise size X/Y, density, color(s) or opacity; blend mode; max 2 | P1 | [Apply effects to layers](https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers) |
| Texture effect | Roughened edge: Size X/Y, Radius, Clip to shape toggle; max 1 | P1 | [Apply effects to layers](https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers) |
| Effects: render order (layers) | Top: layer blur/noise/texture; stroke paints; inner shadow; fill paints; drop shadow; bottom: bg blur/glass | P0 | [Apply effects to layers](https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers) |
| Effects: render order (groups/masks) | Top: blur/noise/texture; inner shadow; child paints/effects; drop shadow; bottom: background blur | P0 | [Apply effects to layers](https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers) |
| Effects: blend isolation by blur | Layer blur/unclipped texture isolates blend modes of shadows/fills to the layer itself | P1 | [Apply effects to layers](https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers) |
| Effects: performance warning | Many blurs (esp. background blur) slow rendering | P0 | [Apply effects to layers](https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers) |

## Text & typography

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Emoji shortcodes | Type : plus name/keyword to insert Apple-style emoji | P2 | [Add emojis and smart symbols to text](https://help.figma.com/hc/en-us/articles/360039957174-Add-emojis-and-smart-symbols-to-text) |
| OS emoji picker | Ctrl+Cmd+Space (Mac) or touch keyboard (Windows) inserts emoji | P0 | [Add emojis and smart symbols to text](https://help.figma.com/hc/en-us/articles/360039957174-Add-emojis-and-smart-symbols-to-text) |
| Smart quotes/symbols preference | Auto-convert -> ← vv ^^ (c) (r) (tm) [ ] and straight to curly quotes | P1 | [Add emojis and smart symbols to text](https://help.figma.com/hc/en-us/articles/360039957174-Add-emojis-and-smart-symbols-to-text) |
| Text links | Link whole text layer or range to URL, file, page, frame or prototype | P1 | [Add links to text](https://help.figma.com/hc/en-us/articles/360045942953-Add-links-to-text) |
| Text links: create | Create link button or Shift+Cmd/Ctrl+U opens URL input | P1 | [Add links to text](https://help.figma.com/hc/en-us/articles/360045942953-Add-links-to-text) |
| Text links: paste on selection | Pasting URL over selected text makes link; paste twice to show URL text | P1 | [Add links to text](https://help.figma.com/hc/en-us/articles/360045942953-Add-links-to-text) |
| Paste without link (Shift+Cmd/Ctrl+V) | Paste URL/email as plain text | P1 | [Add links to text](https://help.figma.com/hc/en-us/articles/360045942953-Add-links-to-text) |
| Copy link to frame | Copy/Paste as > Copy link for frame URL | Local: deep link to node in file | [Add links to text](https://help.figma.com/hc/en-us/articles/360045942953-Add-links-to-text) |
| Text links: follow/preview | Hover preview; click opens frame/page in-file or new tab; external confirmation; Cmd/Ctrl+click suppresses | P1 | [Add links to text](https://help.figma.com/hc/en-us/articles/360045942953-Add-links-to-text) |
| Text links: edit/remove | Edit from link modal; empty URL removes link | P1 | [Add links to text](https://help.figma.com/hc/en-us/articles/360045942953-Add-links-to-text) |
| Text links: default underline | Links underlined by default; Cmd/Ctrl+U toggles underline | P1 | [Add links to text](https://help.figma.com/hc/en-us/articles/360045942953-Add-links-to-text) |
| Text links: limits | No links on images/vectors (prototype hotspots only); mailto unsupported | P1 | [Add links to text](https://help.figma.com/hc/en-us/articles/360045942953-Add-links-to-text) |
| RTL scripts | Arabic, Hebrew, Farsi, Urdu etc. rendered right-to-left | P1 | [Add right-to-left text](https://help.figma.com/hc/en-us/articles/4972283635863-Add-right-to-left-text) |
| Bidirectional text | Mixed RTL/LTR in same paragraph with auto language detection | P1 | [Add right-to-left text](https://help.figma.com/hc/en-us/articles/4972283635863-Add-right-to-left-text) |
| Text direction override | Per-paragraph LTR/RTL toggle in sidebar, quick actions, or Text > Text direction | P1 | [Add right-to-left text](https://help.figma.com/hc/en-us/articles/4972283635863-Add-right-to-left-text) |
| Bidi cursor navigation | Arrow keys move forward/backward by text direction; selection follows script | P1 | [Add right-to-left text](https://help.figma.com/hc/en-us/articles/4972283635863-Add-right-to-left-text) |
| Text alignment memory | New text reuses last edited layer's alignment until tab reload | P2 | [Add right-to-left text](https://help.figma.com/hc/en-us/articles/4972283635863-Add-right-to-left-text) |
| Upgrade RTL plugin text | Type details "Upgrade" converts plugin-reversed text to native bidi | P2 | [Add right-to-left text](https://help.figma.com/hc/en-us/articles/4972283635863-Add-right-to-left-text) |
| Text tool (T): click | Click creates Auto width (point) text layer | P0 | [Guide to text in Figma Design](https://help.figma.com/hc/en-us/articles/360039956434-Guide-to-text-in-Figma-Design) |
| Text tool: click-drag | Drag creates Fixed size (area) text layer that wraps | P0 | [Guide to text in Figma Design](https://help.figma.com/hc/en-us/articles/360039956434-Guide-to-text-in-Figma-Design) |
| Text on a path tool | Hover vector path and click to type along it; vector fill/effects transfer to text | P1 | [Guide to text in Figma Design](https://help.figma.com/hc/en-us/articles/360039956434-Guide-to-text-in-Figma-Design) |
| Text on path: start handle & flip | Blue handle sets start; Flip text orientation swaps side of path | P1 | [Guide to text in Figma Design](https://help.figma.com/hc/en-us/articles/360039956434-Guide-to-text-in-Figma-Design) |
| Edit text (Enter / double-click) | Enter text edit mode; click other text layers to keep editing | P0 | [Guide to text in Figma Design](https://help.figma.com/hc/en-us/articles/360039956434-Guide-to-text-in-Figma-Design) |
| Multi-edit text | Select multiple text layers, Enter or Multi-edit text to edit all contents at once | P1 | [Guide to text in Figma Design](https://help.figma.com/hc/en-us/articles/360039956434-Guide-to-text-in-Figma-Design) |
| Spell check | Check spelling in chosen language while typing | P1 | [Guide to text in Figma Design](https://help.figma.com/hc/en-us/articles/360039956434-Guide-to-text-in-Figma-Design) |
| Custom text rendering | Consistent cross-OS text rendering engine independent of browser | P0 | [Guide to text in Figma Design](https://help.figma.com/hc/en-us/articles/360039956434-Guide-to-text-in-Figma-Design) |
| Text fill/stroke/effects | Fill (color, gradient, image) applies to glyphs; stroke outlines characters | P0 | [Guide to text in Figma Design](https://help.figma.com/hc/en-us/articles/360039956434-Guide-to-text-in-Figma-Design) |
| Text resizing: Auto width | Layer grows horizontally; lines break only on Return | P0 | [Adjust text dimensions and resizing](https://help.figma.com/hc/en-us/articles/27378154668951-Adjust-text-dimensions-and-resizing) |
| Text resizing: Auto height | Fixed width, height grows with content | P0 | [Adjust text dimensions and resizing](https://help.figma.com/hc/en-us/articles/27378154668951-Adjust-text-dimensions-and-resizing) |
| Text resizing: Fixed size | Width and height fixed regardless of content; set when bounds dragged manually | P0 | [Adjust text dimensions and resizing](https://help.figma.com/hc/en-us/articles/27378154668951-Adjust-text-dimensions-and-resizing) |
| Text: bounding-box resize | Dragging text bounds sets Fixed size and reflows by alignment | P0 | [Adjust text dimensions and resizing](https://help.figma.com/hc/en-us/articles/27378154668951-Adjust-text-dimensions-and-resizing) |
| Text: scale tool | Scale tool resizes bounds and font size together (may create fractional sizes) | P0 | [Adjust text dimensions and resizing](https://help.figma.com/hc/en-us/articles/27378154668951-Adjust-text-dimensions-and-resizing) |
| Typography section | Style picker, font family, weight/style, size, line height, letter spacing, H/V align, type settings | P0 | [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties) |
| Default font Inter | New text layers default to Inter | P0 | [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties) |
| Font weight shortcuts | Opt+Cmd / Ctrl+Alt with < or > increases/decreases weight | P1 | [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties) |
| Font size | Size field with preset dropdown; Shift+Cmd / Ctrl+Shift with < > adjusts | P0 | [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties) |
| Font size units | Size in px (dp); PDF export uses pt | P1 | [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties) |
| Line height | Auto (font default), px, or % of size; auto-converts between; Shift+Opt < > shortcuts | P0 | [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties) |
| Letter spacing | Value per layer or range (kerning between two letters); Opt/Alt + < > | P0 | [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties) |
| Horizontal alignment | Left, Center, Right, Justify | P0 | [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties) |
| Vertical alignment | Top, Middle, Bottom; only effective on Fixed size layers | P0 | [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties) |
| Decoration: Strikethrough | Line through text | P0 | [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties) |
| Decoration: Underline | Underline text (shortcut Cmd/Ctrl+U) | P0 | [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties) |
| Underline details | Style solid/dotted/wavy, thickness, offset, skip ink, color | P1 | [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties) |
| Letter case | Non-destructive Uppercase, Lowercase, Capitalize (title), Small caps | P0 | [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties) |
| Letter case: extras | Case-sensitive forms and capital spacing toggles if font supports | P2 | [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties) |
| Type settings panel | Basics, Details, and Variable tabs with hover live preview sample | P0 | [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties) |
| Vertical trim | Trims space above/below text (cap height to baseline); maps to leading-trim | P1 | [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties) |
| Truncate text | Hide overflow with ellipsis | P1 | [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties) |
| Max lines | Truncate after N lines (auto height/width or hug); exclusive with max height | P1 | [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties) |
| Wrap style | Auto (default), Balance, Pretty (avoid orphan in last 4 lines); not for auto width | P1 | [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties) |
| Wrap style: levels | Set per layer, per paragraph, or in text style | P1 | [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties) |
| Paragraph indent | First-line indent in px; left-aligned text only; applies to all paragraphs | P1 | [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties) |
| Paragraph spacing | Space between paragraphs in px | P0 | [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties) |
| Hanging quotes | Opening quotation marks hang outside bounding box | P2 | [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties) |
| Hanging lists | Bullets/numbers hang outside bounding box | P2 | [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties) |
| Numbers: fractions | Convert X/X into a fraction glyph | P2 | [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties) |
| Numbers: superscript/subscript | Position numbers/characters; synthesized "faux" glyphs if font lacks them | P1 | [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties) |
| Numbers: slashed zero | Display zero with slash | P2 | [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties) |
| Numbers: figure style | Proportional or monospace (tabular), lining or old-style (4 combos) | P1 | [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties) |
| View-only text properties | Viewers see content and typography; copy all or single properties | P2 | [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties) |
| Text styles | Save font family/weight/size, line height, letter spacing, paragraph, decoration, case, lists, OpenType, wrap | P0 | [Create and apply text styles](https://help.figma.com/hc/en-us/articles/360039957034-Create-and-apply-text-styles) |
| Text styles: exclusions | Alignment, color/fill, resizing not part of text styles | P0 | [Create and apply text styles](https://help.figma.com/hc/en-us/articles/360039957034-Create-and-apply-text-styles) |
| Text styles: range apply | Apply style to whole layer or a text range | P0 | [Create and apply text styles](https://help.figma.com/hc/en-us/articles/360039957034-Create-and-apply-text-styles) |
| Text styles: create | From layer via style icon + name, or Local styles + with description | P0 | [Create and apply text styles](https://help.figma.com/hc/en-us/articles/360039957034-Create-and-apply-text-styles) |
| Text styles: edit | Edit modal with live preview from sidebar or style picker; updates all uses | P0 | [Create and apply text styles](https://help.figma.com/hc/en-us/articles/360039957034-Create-and-apply-text-styles) |
| Text styles: Go to style definition | Jump to library file defining a published style | P1 | [Create and apply text styles](https://help.figma.com/hc/en-us/articles/360039957034-Create-and-apply-text-styles) |
| Bold/italic/underline in style | Cmd+B/I/U on ranges without detaching style | P0 | [Create and apply text styles](https://help.figma.com/hc/en-us/articles/360039957034-Create-and-apply-text-styles) |
| Lists: bulleted | "- " or "* ", Opt+8, Cmd+Shift+8, or List style menu; bullets not customizable | P0 | [Create bulleted and numbered lists](https://help.figma.com/hc/en-us/articles/360040449773-Create-bulleted-and-numbered-lists) |
| Lists: numbered | "1. " or "1) ", Cmd+Shift+7; counters cycle numbers/letters/roman by level | P0 | [Create bulleted and numbered lists](https://help.figma.com/hc/en-us/articles/360040449773-Create-bulleted-and-numbered-lists) |
| Lists: indentation | Up to 5 levels; Tab or Cmd/Ctrl+] indents; Backspace removes counter; Enter on empty outdents | P0 | [Create bulleted and numbered lists](https://help.figma.com/hc/en-us/articles/360040449773-Create-bulleted-and-numbered-lists) |
| Lists: undo auto-format | Cmd+Z right after list trigger reverts to plain text | P1 | [Create bulleted and numbered lists](https://help.figma.com/hc/en-us/articles/360040449773-Create-bulleted-and-numbered-lists) |
| Lists: list spacing | Px gap between list items (default 0) | P1 | [Create bulleted and numbered lists](https://help.figma.com/hc/en-us/articles/360040449773-Create-bulleted-and-numbered-lists) |
| Lists: bullet styling | Bullet color from first char; following items inherit; stroke/effects apply to bullets | P1 | [Create bulleted and numbered lists](https://help.figma.com/hc/en-us/articles/360040449773-Create-bulleted-and-numbered-lists) |
| Lists: No list | Removes list styling from selection | P0 | [Create bulleted and numbered lists](https://help.figma.com/hc/en-us/articles/360040449773-Create-bulleted-and-numbered-lists) |
| OpenType: letterforms | Ligatures, rare ligatures, contextual alternates, ordinals | P1 | [Use OpenType features](https://help.figma.com/hc/en-us/articles/4913951097367-Use-OpenType-features) |
| OpenType: stylistic sets | ss01-ss20 per font | P1 | [Use OpenType features](https://help.figma.com/hc/en-us/articles/4913951097367-Use-OpenType-features) |
| OpenType: character variants | cvXX alternates per font | P2 | [Use OpenType features](https://help.figma.com/hc/en-us/articles/4913951097367-Use-OpenType-features) |
| OpenType: horizontal spacing | Kerning and kerning pair toggles | P1 | [Use OpenType features](https://help.figma.com/hc/en-us/articles/4913951097367-Use-OpenType-features) |
| OpenType: preview & availability | Hover previews; unsupported features greyed out | P1 | [Use OpenType features](https://help.figma.com/hc/en-us/articles/4913951097367-Use-OpenType-features) |
| Icon fonts | Installed OTF/TTF icon fonts (e.g. Font Awesome 5/6 Free/Pro) usable via pasted glyphs | P1 | [Use icon fonts](https://help.figma.com/hc/en-us/articles/360040449513-Use-icon-fonts) |

## Fonts

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Default fonts | Google fonts and Apple SF Pro/SF Compact included | P0 | [Add a font to Figma](https://help.figma.com/hc/en-us/articles/360039956894-Add-a-font-to-Figma) |
| Local installed fonts | Use TTF/OTF installed on OS (Font Book / Windows Fonts) | P0 | [Add a font to Figma](https://help.figma.com/hc/en-us/articles/360039956894-Add-a-font-to-Figma) |
| Font helper agent | Browser needs localhost FigmaAgent to read local fonts; desktop app built-in | Local: native OS font enumeration | [Add a font to Figma](https://help.figma.com/hc/en-us/articles/360039956894-Add-a-font-to-Figma) |
| Font picker filter: Installed by you | Filter font menu to locally installed fonts | P0 | [Add a font to Figma](https://help.figma.com/hc/en-us/articles/360039956894-Add-a-font-to-Figma) |
| Fonts on Linux/ChromeOS | Figma lacks local fonts on Linux/ChromeOS; Illigma should support Linux fonts | P0 | [Add a font to Figma](https://help.figma.com/hc/en-us/articles/360039956894-Add-a-font-to-Figma) |
| Account-uploaded fonts | Upload fonts to account for any file, MCP and agent | Local: per-project fonts folder | [Add a font to Figma](https://help.figma.com/hc/en-us/articles/360039956894-Add-a-font-to-Figma) |
| Missing font alert | Error when file uses fonts not available locally; replace flow | P0 | [Add a font to Figma](https://help.figma.com/hc/en-us/articles/360039956894-Add-a-font-to-Figma) |
| Font conflicts / Adobe fonts troubleshooting | Handle conflicting duplicate fonts and Adobe font access | P1 | [Add a font to Figma](https://help.figma.com/hc/en-us/articles/360039956894-Add-a-font-to-Figma) |
| Font fallback to Noto | Unsupported characters render in Noto font instead of tofu | P0 | [Add right-to-left text](https://help.figma.com/hc/en-us/articles/4972283635863-Add-right-to-left-text) |
| CJK native fonts | Supports OS CJK fonts (e.g. Hiragino, Microsoft YaHei, Dotum) | P1 | [Add text in Chinese, Japanese, and Korean](https://help.figma.com/hc/en-us/articles/360040449673-Add-text-in-Chinese-Japanese-and-Korean) |
| Bundled Noto fonts | Popular Noto Sans/Serif incl. SC, TC, JP, KR shorthand names | P1 | [Add text in Chinese, Japanese, and Korean](https://help.figma.com/hc/en-us/articles/360040449673-Add-text-in-Chinese-Japanese-and-Korean) |
| Font picker: search | Search fonts by name | P0 | [Browse and apply fonts](https://help.figma.com/hc/en-us/articles/360041308034-Browse-and-apply-fonts) |
| Font picker: filters | All fonts, In this file, Popular, Used at org, Installed by you, Google fonts, Variable fonts | P0 | [Browse and apply fonts](https://help.figma.com/hc/en-us/articles/360041308034-Browse-and-apply-fonts) |
| Font picker: hover preview | Hovering font previews on selected text; remembers last filter per session | P0 | [Browse and apply fonts](https://help.figma.com/hc/en-us/articles/360041308034-Browse-and-apply-fonts) |
| Font apply scope | Apply font to whole layer, multiple layers, or text range | P0 | [Browse and apply fonts](https://help.figma.com/hc/en-us/articles/360041308034-Browse-and-apply-fonts) |
| Variable fonts: axes | Variable tab sliders/inputs for weight, width, optical size, slant, italic, custom axes | P1 | [Use variable fonts](https://help.figma.com/hc/en-us/articles/5579502031511-Use-variable-fonts) |
| Variable fonts: recent axis presets | Font style dropdown lists frequently used axis settings per font | P2 | [Use variable fonts](https://help.figma.com/hc/en-us/articles/5579502031511-Use-variable-fonts) |
| Font source priority | Shared org font > installed font > bundled web font | P1 | [Use variable fonts](https://help.figma.com/hc/en-us/articles/5579502031511-Use-variable-fonts) |
| Variable font replacement | Variable version replaces statics; missing styles prompt replacement | P1 | [Use variable fonts](https://help.figma.com/hc/en-us/articles/5579502031511-Use-variable-fonts) |

## Figma Draw

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Figma Draw: mode toggle | Toolbar toggle switches Design editor into Draw mode with illustration toolset; some Design features hidden | P1 | [Explore Figma Draw](https://help.figma.com/hc/en-us/articles/31440394517143-Explore-Figma-Draw) |
| Figma Draw: toolbar | Draw toolbar gives quick access to Pen, Brush and Pencil tools | P1 | [Explore Figma Draw](https://help.figma.com/hc/en-us/articles/31440394517143-Explore-Figma-Draw) |
| Figma Draw: streamlined right sidebar | Illustration-focused properties with slider controls; transforms accessible | P1 | [Explore Figma Draw](https://help.figma.com/hc/en-us/articles/31440394517143-Explore-Figma-Draw) |
| Figma Draw: enlarged layer previews | Layers panel shows large visual previews; double-click preview zooms to layer | P1 | [Explore Figma Draw](https://help.figma.com/hc/en-us/articles/31440394517143-Explore-Figma-Draw) |
| Brush tool | Paint strokes with textured brush styles; auto-places vector points along drawn path | P1 | [Draw with illustration tools](https://help.figma.com/hc/en-us/articles/31440438150935-Draw-with-illustration-tools) |
| Pencil/Brush: secondary toolbar | Set stroke fill, weight and style before drawing | P1 | [Draw with illustration tools](https://help.figma.com/hc/en-us/articles/31440438150935-Draw-with-illustration-tools) |
| Pencil/Brush: Shift straight line | Hold Shift while drawing to draw a straight line | P1 | [Draw with illustration tools](https://help.figma.com/hc/en-us/articles/31440438150935-Draw-with-illustration-tools) |
| Pencil/Brush: sample stroke | Cmd/Ctrl+click an existing stroke to sample its fill, weight and style | P1 | [Draw with illustration tools](https://help.figma.com/hc/en-us/articles/31440438150935-Draw-with-illustration-tools) |
| Pencil/Brush: editable output | Drawn strokes are vector networks editable in vector edit mode | P1 | [Draw with illustration tools](https://help.figma.com/hc/en-us/articles/31440438150935-Draw-with-illustration-tools) |
| Custom brush: Stretch | Right-click closed vector > Create brush > Stretch; elongates shape along stroke length | P2 | [Draw with illustration tools](https://help.figma.com/hc/en-us/articles/31440438150935-Draw-with-illustration-tools) |
| Custom brush: Scatter | Right-click closed vector > Create brush > Scatter; repeats shape along stroke | P2 | [Draw with illustration tools](https://help.figma.com/hc/en-us/articles/31440438150935-Draw-with-illustration-tools) |
| Custom brush: source rule | Only single closed vector paths (shape, path, flattened text) can become brushes | P2 | [Draw with illustration tools](https://help.figma.com/hc/en-us/articles/31440438150935-Draw-with-illustration-tools) |
| Custom brush: file scope & transfer | Brushes are per-file; pasting a layer using a brush adds it to target file's brush menu | P2 | [Draw with illustration tools](https://help.figma.com/hc/en-us/articles/31440438150935-Draw-with-illustration-tools) |
| Brush styles menu | Pick brush style from toolbar menu or Advanced stroke settings, including custom brushes | P1 | [Draw with illustration tools](https://help.figma.com/hc/en-us/articles/31440438150935-Draw-with-illustration-tools) |
| Transforms: transform group | Non-destructive modifier wraps object in a transform group; originals stay editable; more objects addable | P2 | [Create patterns with transforms](https://help.figma.com/hc/en-us/articles/31440427042839-Create-patterns-with-transforms) |
| Transforms: Radial repeat | Repeats object around a central point in a circular arrangement | P2 | [Create patterns with transforms](https://help.figma.com/hc/en-us/articles/31440427042839-Create-patterns-with-transforms) |
| Transforms: Linear repeat | Repeats object horizontally or vertically with even spacing | P2 | [Create patterns with transforms](https://help.figma.com/hc/en-us/articles/31440427042839-Create-patterns-with-transforms) |
| Transforms: settings | Adjust number of repetitions and spacing in Transform settings | P2 | [Create patterns with transforms](https://help.figma.com/hc/en-us/articles/31440427042839-Create-patterns-with-transforms) |
| Transforms: Apply transforms to selection | Bakes transform repetitions into real layers | P2 | [Create patterns with transforms](https://help.figma.com/hc/en-us/articles/31440427042839-Create-patterns-with-transforms) |

## Import & export

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Paste SVG from other tools | Paste SVG clipboard content as editable vectors; SVG marker/pattern elements dropped | P0 | [Copy assets between design tools](https://help.figma.com/hc/en-us/articles/360040030374-Copy-assets-between-design-tools) |
| Paste here | Right-click canvas > Paste here pastes at cursor location | P0 | [Copy assets between design tools](https://help.figma.com/hc/en-us/articles/360040030374-Copy-assets-between-design-tools) |
| Copy as SVG | Right-click > Copy/Paste as > Copy as SVG puts SVG markup on clipboard | P0 | [Copy assets between design tools](https://help.figma.com/hc/en-us/articles/360040030374-Copy-assets-between-design-tools) |
| Third-party integrations (Zeplin, Principle) | Bring files into external tools via integrations | P2 | [Copy assets between design tools](https://help.figma.com/hc/en-us/articles/360040030374-Copy-assets-between-design-tools) |
| Restrict copying/exporting | File owner can block viewers from copying/exporting | Local: N/A, no sharing permissions | [Copy assets between design tools](https://help.figma.com/hc/en-us/articles/360040030374-Copy-assets-between-design-tools) |
| Export targets | Export layers, frames, components, groups, sections, slice region, whole page, or whole file (.fig) | P0 | [Export static designs from Figma](https://help.figma.com/hc/en-us/articles/360040028114-Export-static-designs-from-Figma) |
| Slice tool | Region tool; drag to define exportable rectangle; movable/resizable; absolute padding | P1 | [Export static designs from Figma](https://help.figma.com/hc/en-us/articles/360040028114-Export-static-designs-from-Figma) |
| Export section | Right-sidebar section; multiple export configs per selection via + | P0 | [Export static designs from Figma](https://help.figma.com/hc/en-us/articles/360040028114-Export-static-designs-from-Figma) |
| Export: whole page | Deselect all then export to export entire page canvas | P1 | [Export static designs from Figma](https://help.figma.com/hc/en-us/articles/360040028114-Export-static-designs-from-Figma) |
| Export: Preview | Preview the export result for single selection | P1 | [Export static designs from Figma](https://help.figma.com/hc/en-us/articles/360040028114-Export-static-designs-from-Figma) |
| Export: save location | Browser saves to downloads; desktop app prompts rename and destination | P0 | [Export static designs from Figma](https://help.figma.com/hc/en-us/articles/360040028114-Export-static-designs-from-Figma) |
| Export: slash names to folders | Layer "a/b/c" exports into nested folders a/b with file named c | P1 | [Export static designs from Figma](https://help.figma.com/hc/en-us/articles/360040028114-Export-static-designs-from-Figma) |
| Fill: Show in exports | Per-fill checkbox to exclude a frame's fill from exported file | P1 | [Export static designs from Figma](https://help.figma.com/hc/en-us/articles/360040028114-Export-static-designs-from-Figma) |
| Bulk export (Shift+Cmd/Ctrl+E) | Modal lists all export-configured selections on page; shows scale/format/size; checkbox to include | P0 | [Export static designs from Figma](https://help.figma.com/hc/en-us/articles/360040028114-Export-static-designs-from-Figma) |
| Bulk export: thumbnail navigation | Hover shows output filename; click thumbnail jumps to selection on canvas | P1 | [Export static designs from Figma](https://help.figma.com/hc/en-us/articles/360040028114-Export-static-designs-from-Figma) |
| Export format: PNG | 32-bit RGBA lossless raster; always includes alpha | P0 | [Export formats and settings](https://help.figma.com/hc/en-us/articles/13402894554519-Export-formats-and-settings-for-static-designs) |
| Export format: JPG | Lossy raster, no transparency; default High quality | P0 | [Export formats and settings](https://help.figma.com/hc/en-us/articles/13402894554519-Export-formats-and-settings-for-static-designs) |
| Export format: SVG | Vector XML; 1x only; strokes exported as fills; text outlined by default; no glass/background blur | P0 | [Export formats and settings](https://help.figma.com/hc/en-us/articles/13402894554519-Export-formats-and-settings-for-static-designs) |
| Export format: PDF | PDF 1.7, 1x only, text as glyphs (selectable); no Plus darker/lighter blend; default Medium quality | P0 | [Export formats and settings](https://help.figma.com/hc/en-us/articles/13402894554519-Export-formats-and-settings-for-static-designs) |
| Export: scale presets & custom | Preset scales or custom value with suffix x (multiplier), w (fixed width), h (fixed height) | P0 | [Export formats and settings](https://help.figma.com/hc/en-us/articles/13402894554519-Export-formats-and-settings-for-static-designs) |
| Export: DPI | Images export at 72 DPI times scale (2x=144, 3x=216) | P1 | [Export formats and settings](https://help.figma.com/hc/en-us/articles/13402894554519-Export-formats-and-settings-for-static-designs) |
| Export: Suffix | Optional text appended to exported filename (e.g. HomePagedraft.png) | P0 | [Export formats and settings](https://help.figma.com/hc/en-us/articles/13402894554519-Export-formats-and-settings-for-static-designs) |
| Export: color profile | Same as file, sRGB, or Display P3 per export | P1 | [Export formats and settings](https://help.figma.com/hc/en-us/articles/13402894554519-Export-formats-and-settings-for-static-designs) |
| Export: Ignore overlapping layers | Default on; excludes intersecting non-selected layers (PNG/JPG/SVG); slice-specific container rule | P1 | [Export formats and settings](https://help.figma.com/hc/en-us/articles/13402894554519-Export-formats-and-settings-for-static-designs) |
| Export: Image quality | Quality/size setting for JPG (default High) and PDF (default Medium) | P1 | [Export formats and settings](https://help.figma.com/hc/en-us/articles/13402894554519-Export-formats-and-settings-for-static-designs) |
| Export: Image resampling | Detailed (bicubic, default) or Basic (nearest neighbor) for JPG/PNG/PDF | P1 | [Export formats and settings](https://help.figma.com/hc/en-us/articles/13402894554519-Export-formats-and-settings-for-static-designs) |
| Export: Include bounding box | Text layers only; export sized by text box (pad/trim) vs glyph bounds | P1 | [Export formats and settings](https://help.figma.com/hc/en-us/articles/13402894554519-Export-formats-and-settings-for-static-designs) |
| Export: Include "id" attribute | SVG only; adds id attributes from layer names | P1 | [Export formats and settings](https://help.figma.com/hc/en-us/articles/13402894554519-Export-formats-and-settings-for-static-designs) |
| Export: Outline text | SVG; default on when text selected; converts text to glyph paths; off keeps editable text | P0 | [Export formats and settings](https://help.figma.com/hc/en-us/articles/13402894554519-Export-formats-and-settings-for-static-designs) |
| Export: Simplify stroke | SVG; default on for vector networks with inside/outside strokes; off uses wider stroke + mask | P1 | [Export formats and settings](https://help.figma.com/hc/en-us/articles/13402894554519-Export-formats-and-settings-for-static-designs) |
| Export animation: video/GIF/SVG | Top-level animated frames export as MP4, WebM, GIF or SVG from Animated tab | Module | [Export animations from Figma](https://help.figma.com/hc/en-us/articles/41307983648407-Export-animations-from-Figma) |
| Export animation: settings | Size (preset/custom), frame rate, quality (MP4/WebM), loop (GIF); free cap 1920x1080 at 30 FPS | Module | [Export animations from Figma](https://help.figma.com/hc/en-us/articles/41307983648407-Export-animations-from-Figma) |
| Export animation: Lottie / dotLottie | Lottie raw JSON (one animation) or dotLottie compressed bundle with assets (multiple animations) | Module | [Export animations from Figma](https://help.figma.com/hc/en-us/articles/41307983648407-Export-animations-from-Figma) |
| Export animation: Lottie limits | Shaders, video unsupported; angular gradients flattened; shadows/noise/glass static from first frame | Module | [Export animations from Figma](https://help.figma.com/hc/en-us/articles/41307983648407-Export-animations-from-Figma) |
| Motion frame indicator | Top-level frames containing animated layers marked with Motion icon | Module | [Export animations from Figma](https://help.figma.com/hc/en-us/articles/41307983648407-Export-animations-from-Figma) |
| Import: images, vectors, video, GIF | Import media into design files | P0 | [Guide to imports in Figma Design](https://help.figma.com/hc/en-us/articles/360040027794-Guide-to-imports-in-Figma-Design) |
| Import: .fig files | Import Figma Design files | P0 | [Guide to imports in Figma Design](https://help.figma.com/hc/en-us/articles/360040027794-Guide-to-imports-in-Figma-Design) |
| Import: very large files | Large imports may fail; split files before importing | P1 | [Guide to imports in Figma Design](https://help.figma.com/hc/en-us/articles/360040027794-Guide-to-imports-in-Figma-Design) |
| Import Sketch (.sketch) | Converts to a design file; one-time, no sync with original | P1 | [Import Sketch files](https://help.figma.com/hc/en-us/articles/360040514273-Import-Sketch-files) |
| Sketch import: artboards to frames | Artboards become frames | P1 | [Import Sketch files](https://help.figma.com/hc/en-us/articles/360040514273-Import-Sketch-files) |
| Sketch import: pages | Each Sketch page imported as separate page | P1 | [Import Sketch files](https://help.figma.com/hc/en-us/articles/360040514273-Import-Sketch-files) |
| Sketch import: symbols to components | Symbols become components on a "Symbols" page; symbol libraries import as design files | P1 | [Import Sketch files](https://help.figma.com/hc/en-us/articles/360040514273-Import-Sketch-files) |
| Sketch import: styles dropped | Styles are not retained and must be recreated | P1 | [Import Sketch files](https://help.figma.com/hc/en-us/articles/360040514273-Import-Sketch-files) |
| Sketch import: missing fonts | Prompts to replace missing fonts after import | P1 | [Import Sketch files](https://help.figma.com/hc/en-us/articles/360040514273-Import-Sketch-files) |
| New from Sketch file | Main menu > File > New from Sketch file inside the editor | P1 | [Import Sketch files](https://help.figma.com/hc/en-us/articles/360040514273-Import-Sketch-files) |
| File browser import | Import .sketch, .fig, .jam, .deck, .buzz, .site, .make, PNG/JPG, .pptx; drag-drop supported | Local: open/import files from disk | [Import files to the file browser](https://help.figma.com/hc/en-us/articles/360041003114-Import-files-to-the-file-browser) |
| Import PowerPoint (.pptx) | Import .pptx via file browser | Module | [Import files to the file browser](https://help.figma.com/hc/en-us/articles/360041003114-Import-files-to-the-file-browser) |

## Code to canvas

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Code to canvas: browser capture | Chrome extension captures live web page/element into editable layers via clipboard | P2 | [Turn coded screens into editable design layers](https://help.figma.com/hc/en-us/articles/40826832449303-Turn-coded-screens-into-editable-design-layers) |
| Code to canvas: from Make preview | Copy design layers out of Make preview | Module | [Turn coded screens into editable design layers](https://help.figma.com/hc/en-us/articles/40826832449303-Turn-coded-screens-into-editable-design-layers) |
| Code to canvas: MCP tool | generate_figma_design MCP tool captures coded screens | P2 | [Turn coded screens into editable design layers](https://help.figma.com/hc/en-us/articles/40826832449303-Turn-coded-screens-into-editable-design-layers) |
| Code to canvas: variable binding | Binds pasted colors, numbers, strings to existing variables by code syntax, name, scope | P2 | [Turn coded screens into editable design layers](https://help.figma.com/hc/en-us/articles/40826832449303-Turn-coded-screens-into-editable-design-layers) |
| Code to canvas: supported props | Frame fills/strokes/weights/radius/padding/gap/opacity; text color/font/size/weight/line height/spacing | P2 | [Turn coded screens into editable design layers](https://help.figma.com/hc/en-us/articles/40826832449303-Turn-coded-screens-into-editable-design-layers) |
| Code to canvas: limits | No component/style mapping; canvas/virtualized pages imperfect; privileged pages blocked | P2 | [Turn coded screens into editable design layers](https://help.figma.com/hc/en-us/articles/40826832449303-Turn-coded-screens-into-editable-design-layers) |
| Send to Figma Make | Right-click frame > Send to Figma Make | Module | [Turn coded screens into editable design layers](https://help.figma.com/hc/en-us/articles/40826832449303-Turn-coded-screens-into-editable-design-layers) |

## Notes

- Hard numeric limits to mirror: per-layer effects (8 drop, 8 inner, 1 layer blur, 1 background blur, 2 noise, 1 texture, 1 glass); star points 3-60; list indent 5 levels; image import auto-downscaled to 4096px longest side; export DPI = 72 x scale; SVG/PDF export 1x only; nudge defaults 1/10.
- Auto layout is mid-migration to a CSS-flexbox-aligned "layout version" (padding clamps size, only inside strokes count, auto gap never negative, single child in Between aligns start). Illigma should ship only the new semantics but must read legacy .fig frames with a version flag.
- Grid auto layout is a full CSS-grid subset (fr tracks, hug/fixed tracks, spans, auto-placement toggle, track reorder/delete); it is a large P0 build on its own.
- Effects render order and blend-isolation rules (layer blur/unclipped texture isolates blend modes; glass and background blur are mutually exclusive) are precisely documented and need a GPU compositor that matches them.
- Glass, progressive blur, noise, texture, dynamic/brush strokes, variable width and width profiles are newer Figma-only renderers; hard to match pixel-for-pixel and are good P1 differentiators rather than v1 blockers.
- Local fonts: Figma needs a localhost "FigmaAgent" in browsers and lacks Linux/ChromeOS local fonts. A native Illigma app can enumerate OS fonts directly and support Linux, which is an easy win. Noto fallback for missing glyphs is required.
- Custom text rendering (same output across OSes), RTL/bidi, CJK, OpenType features, variable-font axes and Balance/Pretty wrap styles mean a real shaping engine (e.g. HarfBuzz) plus custom line breaking.
- Vector networks (branching paths, not just single-direction paths) underpin Pen, Pencil, Brush, Paint bucket, Shape builder and booleans; the data model must support them from day one.
- Cloud-only items mapped to local equivalents: sharing/permissions, account-uploaded fonts, file browser import, links to pages/frames/sections (deep links into a file on disk), custom thumbnails (embedded in file), offline status (always local; show save state).
- AI tools and the agent (credits, MCP, skills, image generation) are P2; Illigma should make them pluggable with a bring-your-own model/API key. Code-to-canvas web capture is also P2.
