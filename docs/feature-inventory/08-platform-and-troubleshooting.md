# Help: platform requirements and troubleshooting

## Platform requirements

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Supported browsers | Runs in Chrome, Safari, Edge, Firefox; stable releases only, no beta/dev builds; no Internet Explorer | P0 | [What are the system requirements for Figma?](https://help.figma.com/hc/en-us/articles/360039827194-What-are-the-system-requirements-for-Figma) |
| Minimum browser versions | Chrome 120+, Firefox 128 ESR+, Safari 17.4+, Edge 121+ | P0 | [What are the system requirements for Figma?](https://help.figma.com/hc/en-us/articles/360039827194-What-are-the-system-requirements-for-Figma) |
| Minimum OS versions | Windows 8.1+, macOS 11+, any Linux or ChromeOS running a supported browser | P0 | [What are the system requirements for Figma?](https://help.figma.com/hc/en-us/articles/360039827194-What-are-the-system-requirements-for-Figma) |
| Linux and ChromeOS support | Browser-only on Linux/ChromeOS; no native desktop app for those platforms | P0 | [What are the system requirements for Figma?](https://help.figma.com/hc/en-us/articles/360039827194-What-are-the-system-requirements-for-Figma) |
| 64-bit requirement | Desktop app needs a 64-bit environment; 32-bit Windows unsupported | P0 | [Troubleshooting checklist](https://help.figma.com/hc/en-us/articles/360040523973-Troubleshooting-checklist) |
| Native desktop apps | Desktop apps for macOS and Windows with the same WebGL/GPU requirements as browser | P1 | [What are the system requirements for Figma?](https://help.figma.com/hc/en-us/articles/360039827194-What-are-the-system-requirements-for-Figma) |
| Browser zoom at 100% | Recommends browser page zoom of 100% so files render accurately at high resolutions | P1 | [How do I configure my browser for Figma?](https://help.figma.com/hc/en-us/articles/360039828614-How-do-I-configure-my-browser-for-Figma) |
| Keep browser updated | Recommends latest browser with automatic updates; many issues fixed by updating | P1 | [How do I configure my browser for Figma?](https://help.figma.com/hc/en-us/articles/360039828614-How-do-I-configure-my-browser-for-Figma) |
| Edge Strict mode exception | Edge Strict tracking prevention must be disabled for figma.com or app breaks | Local: N/A, no third-party domains | [How do I configure my browser for Figma?](https://help.figma.com/hc/en-us/articles/360039828614-How-do-I-configure-my-browser-for-Figma) |
| Virtual desktop (VDI) support | Citrix/VMware without GPU performs poorly; recommends assigning a GPU to the VM | P1 | [What are the system requirements for Figma?](https://help.figma.com/hc/en-us/articles/360039827194-What-are-the-system-requirements-for-Figma) |
| Capability self-check | Users verify WebGL via webglreport.com and browser/OS via What's my browser | P1 | [Troubleshooting checklist](https://help.figma.com/hc/en-us/articles/360040523973-Troubleshooting-checklist) |
| Stable internet required | Cloud app needs a reliable connection; no dedicated offline mode | Local: works fully offline by design | [Troubleshooting checklist](https://help.figma.com/hc/en-us/articles/360040523973-Troubleshooting-checklist) |

## Rendering & GPU

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| WebGL canvas renderer | Canvas rendered with WebGL; minimum WebGL 1.0; low graphical requirements | P0 | [What are the system requirements for Figma?](https://help.figma.com/hc/en-us/articles/360039827194-What-are-the-system-requirements-for-Figma) |
| WebGPU for shaders | Shader effects/fills need WebGPU, not compatibility mode; Chrome 113, Firefox 141, Safari 26 | P2 | [What are the system requirements for Figma?](https://help.figma.com/hc/en-us/articles/360039827194-What-are-the-system-requirements-for-Figma) |
| Hardware acceleration required | Browser "Use graphics acceleration" must be on; Chrome flag can override software-rendering list | P0 | [How do I configure my browser for Figma?](https://help.figma.com/hc/en-us/articles/360039828614-How-do-I-configure-my-browser-for-Figma) |
| Extension blocking WebGL | Browser extensions can block WebGL even when it is enabled | P1 | [Troubleshooting checklist](https://help.figma.com/hc/en-us/articles/360040523973-Troubleshooting-checklist) |
| Dual-GPU selection | Dedicated GPU improves performance at battery cost; chosen at OS/driver level | P1 | [What are the system requirements for Figma?](https://help.figma.com/hc/en-us/articles/360039827194-What-are-the-system-requirements-for-Figma) |
| Prefer High-Performance GPU toggle | Desktop tray Troubleshooting toggle; uncheck to fix Windows black-screen GPU incompatibility | P1 | [Figma Desktop app not working on Windows](https://help.figma.com/hc/en-us/articles/38586610259479-Figma-Desktop-app-not-working-on-Windows) |
| Known-bad GPU list | Intel HD Graphics 3000 causes rendering glitches; Windows/Linux need driver updates | P1 | [What are the system requirements for Figma?](https://help.figma.com/hc/en-us/articles/360039827194-What-are-the-system-requirements-for-Figma) |
| GPU report for support | Export chrome://gpu report (version, color space, enabled features) as complete webpage | P1 | [View your graphics card specifications](https://help.figma.com/hc/en-us/articles/360041948573-View-your-graphics-card-specifications) |
| Performance toggles | Turning off multiplayer cursors, layout guides and effects improves rendering performance | P1 | [Troubleshooting checklist](https://help.figma.com/hc/en-us/articles/360040523973-Troubleshooting-checklist) |
| Shader effects | Shader acting on a layer, rendering content beneath it like blur, glass or camera filter | P2 | [Workflow lab: New tools, more expression with Figma Motion, Figma Weave, and shaders](https://help.figma.com/hc/en-us/articles/42847574436119-Workflow-lab-New-tools-more-expression-with-Figma-Motion-Figma-Weave-and-shaders) |
| Shader fills | Shader rendering a layer's own pixels: backgrounds, patterns, gradients | P2 | [Workflow lab: New tools, more expression with Figma Motion, Figma Weave, and shaders](https://help.figma.com/hc/en-us/articles/42847574436119-Workflow-lab-New-tools-more-expression-with-Figma-Motion-Figma-Weave-and-shaders) |
| Shader controls | Each shader exposes custom controls, some on-canvas; controls keyframeable in Motion | P2 | [Workflow lab: New tools, more expression with Figma Motion, Figma Weave, and shaders](https://help.figma.com/hc/en-us/articles/42847574436119-Workflow-lab-New-tools-more-expression-with-Figma-Motion-Figma-Weave-and-shaders) |
| Shader stacking | Other effects can stack on top of a shader and render together | P2 | [Workflow lab: New tools, more expression with Figma Motion, Figma Weave, and shaders](https://help.figma.com/hc/en-us/articles/42847574436119-Workflow-lab-New-tools-more-expression-with-Figma-Motion-Figma-Weave-and-shaders) |
| Shaders via Effects panel | Effects panel > Shader picks from saved shaders; first-party ones in left Tools section | P2 | [Workflow lab: New tools, more expression with Figma Motion, Figma Weave, and shaders](https://help.figma.com/hc/en-us/articles/42847574436119-Workflow-lab-New-tools-more-expression-with-Figma-Motion-Figma-Weave-and-shaders) |
| First-party shaders | Pixel stretch, Lens distortion, Slice shift, Bloom, Nebula fill, S gradient with on-canvas handles | P2 | [Workflow lab: New tools, more expression with Figma Motion, Figma Weave, and shaders](https://help.figma.com/hc/en-us/articles/42847574436119-Workflow-lab-New-tools-more-expression-with-Figma-Motion-Figma-Weave-and-shaders) |
| Shader authoring by prompt | Shaders generated by the agent from prompts; building costs AI credits, applying does not | P2 | [What Figma features are in beta?](https://help.figma.com/hc/en-us/articles/4406787442711-What-Figma-features-are-in-beta) |
| Shader export | PNG for fixed frames, MP4 in Motion, raw JS/WGSL via MCP; not shown in Dev Mode | P2 | [What Figma features are in beta?](https://help.figma.com/hc/en-us/articles/4406787442711-What-Figma-features-are-in-beta) |
| Shader color variables | Gradient shader colors can attach to variables | P2 | [Workflow lab: New tools, more expression with Figma Motion, Figma Weave, and shaders](https://help.figma.com/hc/en-us/articles/42847574436119-Workflow-lab-New-tools-more-expression-with-Figma-Motion-Figma-Weave-and-shaders) |

## Memory & performance

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Per-tab memory ceiling | WASM memory capped near 2GB per browser tab; also applies to desktop app | P0 | [Reduce memory usage in files](https://help.figma.com/hc/en-us/articles/360040528173-Reduce-memory-usage-in-files) |
| Lazy page/layer loading | Loads pages and layers only when opened to keep memory low | P0 | [Reduce memory usage in files](https://help.figma.com/hc/en-us/articles/360040528173-Reduce-memory-usage-in-files) |
| Memory usage meter | Main menu > View > Memory usage shows a meter in the left sidebar | P1 | [Reduce memory usage in files](https://help.figma.com/hc/en-us/articles/360040528173-Reduce-memory-usage-in-files) |
| Manage memory modal | Modal with memory-reduction tips, opened from the memory meter | P1 | [Reduce memory usage in files](https://help.figma.com/hc/en-us/articles/360040528173-Reduce-memory-usage-in-files) |
| Show memory in layers panel | Toggle displaying per-layer and per-component memory usage in Layers panel | P1 | [Reduce memory usage in files](https://help.figma.com/hc/en-us/articles/360040528173-Reduce-memory-usage-in-files) |
| Memory alert thresholds | Banners at 60%, 75%; undismissable red tile at 90%; lock at 100% | P1 | [Reduce memory usage in files](https://help.figma.com/hc/en-us/articles/360040528173-Reduce-memory-usage-in-files) |
| Memory tracked for loaded pages only | Memory percentage counts only pages loaded in the session | P1 | [Reduce memory usage in files](https://help.figma.com/hc/en-us/articles/360040528173-Reduce-memory-usage-in-files) |
| File lock at 100% memory | File locks with "no available memory"; viewers and editors offered reload | P1 | [Reduce memory usage in files](https://help.figma.com/hc/en-us/articles/360040528173-Reduce-memory-usage-in-files) |
| Recovery mode | Loads all pages and Manage memory; exit below 90%; needs Chrome 83, Firefox 89, Safari 15.2, Edge 93 | P1 | [Reduce memory usage in files](https://help.figma.com/hc/en-us/articles/360040528173-Reduce-memory-usage-in-files) |
| Thumbnails-only mode | ?thumbnails-only=1 URL param opens a crashed file with low-res images | P1 | [Reduce memory usage in files](https://help.figma.com/hc/en-us/articles/360040528173-Reduce-memory-usage-in-files) |
| Restore from version (file browser) | Shift+Ctrl+Option-click (Win Alt+Shift) a file to restore a lower-memory version | P1 | [Reduce memory usage in files](https://help.figma.com/hc/en-us/articles/360040528173-Reduce-memory-usage-in-files) |
| Hidden layers cost memory | Hidden layers are still stored and processed, adding significant memory | P1 | [Reduce memory usage in files](https://help.figma.com/hc/en-us/articles/360040528173-Reduce-memory-usage-in-files) |
| Component sets load all variants | Every variant in a set loads for fast switching; thousands of variants exhaust memory | P1 | [Reduce memory usage in files](https://help.figma.com/hc/en-us/articles/360040528173-Reduce-memory-usage-in-files) |
| Image decode memory | Image decoding uses JS memory outside the percentage; rendered images still use WASM | P1 | [Reduce memory usage in files](https://help.figma.com/hc/en-us/articles/360040528173-Reduce-memory-usage-in-files) |
| Browser-level crash without warning | Many high-res images can crash the tab before memory banners appear | P1 | [Reduce memory usage in files](https://help.figma.com/hc/en-us/articles/360040528173-Reduce-memory-usage-in-files) |
| Move components between files | Cut/paste published components to another file and publish without breaking instance links | P1 | [Reduce memory usage in files](https://help.figma.com/hc/en-us/articles/360040528173-Reduce-memory-usage-in-files) |
| Large-file mitigation guidance | Split files per page, compress images (Downsize plugin), import complex SVGs in parts | P1 | [Reduce memory usage in files](https://help.figma.com/hc/en-us/articles/360040528173-Reduce-memory-usage-in-files) |
| Low-bandwidth degradation | Poor connection gives slow loads, low-res images and pan/zoom lag | Local: N/A, files load from disk | [Troubleshooting checklist](https://help.figma.com/hc/en-us/articles/360040523973-Troubleshooting-checklist) |
| Prototype weight guidance | Lightweight test files load faster; Smart Animate uses more RAM than simple transitions | P1 | [Test your prototypes with UserTesting](https://help.figma.com/hc/en-us/articles/19790203466263-Test-your-prototypes-with-UserTesting) |

## Images & import

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Image level-of-detail | Stores high-res (>512x512) and low-res copies; only viewport images get high-res | P0 | [Image loading and performance](https://help.figma.com/hc/en-us/articles/360052988373-Image-loading-and-performance) |
| Progressive image sharpening | Images appear blurry first, then sharpen as you explore the file | P0 | [Image loading and performance](https://help.figma.com/hc/en-us/articles/360052988373-Image-loading-and-performance) |
| Export loads full-res images | Export fetches high-res versions of offscreen images first, so it may be slower | P0 | [Image loading and performance](https://help.figma.com/hc/en-us/articles/360052988373-Image-loading-and-performance) |
| EXIF orientation | Image rotation follows EXIF orientation data; legacy double-rotation needs one manual fix | P0 | [Image loading and performance](https://help.figma.com/hc/en-us/articles/360052988373-Image-loading-and-performance) |
| Reload tab for images | Desktop: right-click file tab > Reload Tab to refetch low-res images | P1 | [Image loading and performance](https://help.figma.com/hc/en-us/articles/360052988373-Image-loading-and-performance) |
| Extension image blocking | Ad blockers (Ghostery, Honey, etc.) can block images in presentation view | P2 | [Image loading and performance](https://help.figma.com/hc/en-us/articles/360052988373-Image-loading-and-performance) |
| Paste vectors from Illustrator | Needs Illustrator "Include SVG Code" (29.7.1+); otherwise pastes as static image | P0 | [Copying vectors from Adobe Illustrator into Figma](https://help.figma.com/hc/en-us/articles/34052019393687-Copying-vectors-from-Adobe-Illustrator-into-Figma) |
| SVG import fallback | Export artwork as SVG and import it when clipboard vector paste fails | P0 | [Copying vectors from Adobe Illustrator into Figma](https://help.figma.com/hc/en-us/articles/34052019393687-Copying-vectors-from-Adobe-Illustrator-into-Figma) |
| Webpage capture to layers | Chrome extension captures element or full page into editable frames, text, images, auto layout | P2 | [Figma Chrome extension](https://help.figma.com/hc/en-us/articles/9067379354135-Figma-Chrome-extension) |
| Variable binding on paste | Pasted captures auto-bind matching color, number and string variables from local or added libraries | P2 | [Figma Chrome extension](https://help.figma.com/hc/en-us/articles/9067379354135-Figma-Chrome-extension) |

## Offline & recovery

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Connection status icon | Toolbar icon shows "saving" vs "offline" with a tooltip | Local: saved/unsaved status indicator | [What can I do offline in Figma?](https://help.figma.com/hc/en-us/articles/360040328553-What-can-I-do-offline-in-Figma) |
| Unsaved changes notice | Bottom notification and white dot beside the file name when changes are unsaved | P0 | [What can I do offline in Figma?](https://help.figma.com/hc/en-us/articles/360040328553-What-can-I-do-offline-in-Figma) |
| Offline: create new file | Only one new file can be created while offline | P0 | [What can I do offline in Figma?](https://help.figma.com/hc/en-us/articles/360040328553-What-can-I-do-offline-in-Figma) |
| Offline: loaded pages only | Only current and already-loaded pages of open files are editable offline | Local: whole file always available | [What can I do offline in Figma?](https://help.figma.com/hc/en-us/articles/360040328553-What-can-I-do-offline-in-Figma) |
| Offline: editing scope | Frames, shapes, booleans, vector networks, local components, layer properties, preloaded prototypes work offline | P0 | [What can I do offline in Figma?](https://help.figma.com/hc/en-us/articles/360040328553-What-can-I-do-offline-in-Figma) |
| Offline: plugins | Only already-open plugins not using external browser APIs run offline | P1 | [What can I do offline in Figma?](https://help.figma.com/hc/en-us/articles/360040328553-What-can-I-do-offline-in-Figma) |
| Offline: unavailable features | No library search/instances, version history, new versions, multiplayer, plugin installs | Local: libraries and history stored on disk | [What can I do offline in Figma?](https://help.figma.com/hc/en-us/articles/360040328553-What-can-I-do-offline-in-Figma) |
| Save local copy (.fig) | Saves snapshot without comments, version history or unloaded pages; reimport creates new file | P0 | [What can I do offline in Figma?](https://help.figma.com/hc/en-us/articles/360040328553-What-can-I-do-offline-in-Figma) |
| Crash-safe autosave | Change deltas saved to IndexedDB; survives tab close, crash, restart, power loss | P0 | [What can I do offline in Figma?](https://help.figma.com/hc/en-us/articles/360040328553-What-can-I-do-offline-in-Figma) |
| Multi-tab change merge | Pending changes from multiple tabs are merged on reconnect | P1 | [What can I do offline in Figma?](https://help.figma.com/hc/en-us/articles/360040328553-What-can-I-do-offline-in-Figma) |
| Offline conflict notification | Conflicting offline edits trigger a notice with Review (version history) or Dismiss | P2 | [What can I do offline in Figma?](https://help.figma.com/hc/en-us/articles/360040328553-What-can-I-do-offline-in-Figma) |
| Offline change retention | Kept 30 days (Chrome 58+, Firefox 51+, Edge 18+, Opera 45+); 7 days Safari 10.1+ | P0 | [What can I do offline in Figma?](https://help.figma.com/hc/en-us/articles/360040328553-What-can-I-do-offline-in-Figma) |
| Offline change loss cases | Lost if cache cleared, private mode, storage quota full, extension blocks, different browser | P0 | [What can I do offline in Figma?](https://help.figma.com/hc/en-us/articles/360040328553-What-can-I-do-offline-in-Figma) |
| Unsynced changes review | File browser banner and unsynced icon list files; "Open to sync" applies changes | P0 | [What can I do offline in Figma?](https://help.figma.com/hc/en-us/articles/360040328553-What-can-I-do-offline-in-Figma) |
| Recovery checkpoints | Adds version checkpoints before and after applying recovered offline changes | P1 | [What can I do offline in Figma?](https://help.figma.com/hc/en-us/articles/360040328553-What-can-I-do-offline-in-Figma) |
| Close/quit prompt | Desktop asks Leave/Log out (keep) or Discard (irreversible) on close with pending changes | P0 | [What can I do offline in Figma?](https://help.figma.com/hc/en-us/articles/360040328553-What-can-I-do-offline-in-Figma) |
| Browser leave warning | Browser "changes may not be saved" dialog on closing a tab with pending changes | P0 | [What can I do offline in Figma?](https://help.figma.com/hc/en-us/articles/360040328553-What-can-I-do-offline-in-Figma) |
| Clear autosave data | Clearing cache/site data deletes pending offline changes permanently | P1 | [What can I do offline in Figma?](https://help.figma.com/hc/en-us/articles/360040328553-What-can-I-do-offline-in-Figma) |
| Scheduled maintenance behavior | 30-60 min outages; red banner; edits unsaved; renames/moves never auto-saved | Local: N/A, no server | [What happens during scheduled maintenance?](https://help.figma.com/hc/en-us/articles/360043196274-What-happens-during-scheduled-maintenance) |
| Service status page | status.figma.com with email, SMS and RSS subscriptions | Local: N/A, no service | [What can I do offline in Figma?](https://help.figma.com/hc/en-us/articles/360040328553-What-can-I-do-offline-in-Figma) |
| Restore deleted files | Deleted tab > Restore keeps permissions, comments, history; needs original folder | Local: OS trash plus recent-deletes list | [Connection or server error 403](https://help.figma.com/hc/en-us/articles/23347716725527-Connection-or-server-error-403) |
| Missing file handling | 404 when file deleted or access removed; save file URLs for support | P0 | [My files are not opening](https://help.figma.com/hc/en-us/articles/360040528973-My-files-are-not-opening) |

## Desktop app

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Bundled font helper | Desktop app includes the font helper, so local fonts need no extra install | P1 | [Missing font alert in Figma Design](https://help.figma.com/hc/en-us/articles/360039956994-Missing-font-alert-in-Figma-Design) |
| Check for Updates | Figma menu (Mac) or top-level menu (Windows) > Check for Updates | P1 | [Troubleshoot opening links in the Desktop app](https://help.figma.com/hc/en-us/articles/22850791655831-Troubleshoot-opening-links-in-the-Desktop-app) |
| Beta desktop channel | Separate beta app, side-by-side install, gets bug fixes and performance changes early | P2 | [What Figma features are in beta?](https://help.figma.com/hc/en-us/articles/4406787442711-What-Figma-features-are-in-beta) |
| Save Debug Info | Help > Troubleshooting > Save Debug Info writes a debug log file | P1 | [Download Figma desktop app debug logs](https://help.figma.com/hc/en-us/articles/19589001018903-Download-Figma-desktop-app-debug-logs) |
| Toggle Developer Tools | Help menu opens DevTools; Troubleshooting > Toggle Web App Developer Tools for profiling | P2 | [Record a performance profile](https://help.figma.com/hc/en-us/articles/360041468414-Record-a-performance-profile) |
| Reset Figma and Restart | Help > Troubleshooting menu item clears the app cache and relaunches | P1 | [Clear the Figma desktop app cache](https://help.figma.com/hc/en-us/articles/22380853110551-Clear-the-Figma-desktop-app-cache) |
| Manual cache reset | Delete ~/Library/Application Support/Figma or %APPDATA%\Figma Desktop, DesktopProfile, font_cache, settings | P1 | [Clear the Figma desktop app cache](https://help.figma.com/hc/en-us/articles/22380853110551-Clear-the-Figma-desktop-app-cache) |
| Windows tray icon menu | System tray icon with Troubleshooting submenu including GPU preference | P1 | [Figma Desktop app not working on Windows](https://help.figma.com/hc/en-us/articles/38586610259479-Figma-Desktop-app-not-working-on-Windows) |
| Open links in desktop app | Preference plus "Open in desktop" action route file links to the app; same account required | P1 | [Troubleshoot opening links in the Desktop app](https://help.figma.com/hc/en-us/articles/22850791655831-Troubleshoot-opening-links-in-the-Desktop-app) |
| Desktop file tabs | Files open as tabs; right-click tab for Copy link and Reload Tab | P1 | [Image loading and performance](https://help.figma.com/hc/en-us/articles/360052988373-Image-loading-and-performance) |
| Managed settings (MDM) | AllowedOriginHosts set via macOS plist or Windows registry, e.g. for Zscaler origins | P2 | [Figma is blocked by Zscaler](https://help.figma.com/hc/en-us/articles/23432055153175-Figma-is-blocked-by-Zscaler) |
| Desktop MCP server | Local MCP server runs through the desktop app; remote server preferred for features | P2 | [Workflow lab: Code to canvas](https://help.figma.com/hc/en-us/articles/40219873508247-Workflow-lab-Code-to-canvas) |
| Desktop link-blocking browsers | Brave Shields and Edge Strict mode can block redirects into the desktop app | P1 | [Troubleshoot opening links in the Desktop app](https://help.figma.com/hc/en-us/articles/22850791655831-Troubleshoot-opening-links-in-the-Desktop-app) |

## Fonts

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Font source priority | Order: org shared fonts, then device-installed fonts, then Figma default web fonts | P0 | [Manage conflicting fonts](https://help.figma.com/hc/en-us/articles/4403175325719-Manage-conflicting-fonts) |
| Default font (Inter) | Inter is default text and UI font; bundled copy used, overriding local install | P0 | [Manage conflicting fonts](https://help.figma.com/hc/en-us/articles/4403175325719-Manage-conflicting-fonts) |
| Always-available default fonts | Google Fonts are built in and always available, incl. Linux/ChromeOS | P0 | [Missing font alert in Figma Design](https://help.figma.com/hc/en-us/articles/360039956994-Missing-font-alert-in-Figma-Design) |
| Local font access helper | FigmaAgent runs localhost HTTP/HTTPS server (127.0.0.1), accepts figma.com only | P0 | [Missing font alert in Figma Design](https://help.figma.com/hc/en-us/articles/360039956994-Missing-font-alert-in-Figma-Design) |
| Supported font formats | Only .TTF and .OTF; each style needs its own file | P0 | [Missing font alert in Figma Design](https://help.figma.com/hc/en-us/articles/360039956994-Missing-font-alert-in-Figma-Design) |
| Linux/ChromeOS local fonts | Not supported; Linux/ChromeOS users limited to default Google Fonts | P0 | [Missing font alert in Figma Design](https://help.figma.com/hc/en-us/articles/360039956994-Missing-font-alert-in-Figma-Design) |
| Missing font icon | Icon in left sidebar and next to font name in right sidebar for missing fonts | P0 | [Missing font alert in Figma Design](https://help.figma.com/hc/en-us/articles/360039956994-Missing-font-alert-in-Figma-Design) |
| Missing fonts modal | Lists missing families/styles with Replacement family and style dropdowns | P0 | [Missing font alert in Figma Design](https://help.figma.com/hc/en-us/articles/360039956994-Missing-font-alert-in-Figma-Design) |
| Replace fonts | Replaces missing fonts in all text objects file-wide, for every collaborator | P0 | [Missing font alert in Figma Design](https://help.figma.com/hc/en-us/articles/360039956994-Missing-font-alert-in-Figma-Design) |
| Missing font styles | Missing style (e.g. Extra Light) raises missing-font error even if family exists | P0 | [Missing font alert in Figma Design](https://help.figma.com/hc/en-us/articles/360039956994-Missing-font-alert-in-Figma-Design) |
| Font picker source sections | Picker groups fonts as "Installed by you" and "Uploaded by you" | P0 | [Missing font alert in Figma Design](https://help.figma.com/hc/en-us/articles/360039956994-Missing-font-alert-in-Figma-Design) |
| Select all with same font | Edit > Select all with > Select all with same font | P0 | [Access and troubleshoot missing Adobe fonts in Figma Design](https://help.figma.com/hc/en-us/articles/23035569468439-Access-and-troubleshoot-missing-Adobe-fonts-in-Figma-Design) |
| Recompute Text Layout in Selection | Quick action that reflows selected text to fix font-version formatting issues | P1 | [Manage conflicting fonts](https://help.figma.com/hc/en-us/articles/4403175325719-Manage-conflicting-fonts) |
| Font version conflicts | Version mismatches shift baselines, change weight/alignment, break ligatures, turn icon fonts into text | P1 | [Manage conflicting fonts](https://help.figma.com/hc/en-us/articles/4403175325719-Manage-conflicting-fonts) |
| Ligatures toggle | Ligatures switched on in Type details panel | P0 | [Manage conflicting fonts](https://help.figma.com/hc/en-us/articles/4403175325719-Manage-conflicting-fonts) |
| User-uploaded fonts | Account > Your uploaded fonts uploads fonts for server-side agent/MCP access | Local: per-project fonts folder | [Missing font alert in Figma Design](https://help.figma.com/hc/en-us/articles/360039956994-Missing-font-alert-in-Figma-Design) |
| Organization shared fonts | Admins upload multiple font files; Skip or Replace on duplicate family names | Local: shared team fonts folder | [Missing font alert in Figma Design](https://help.figma.com/hc/en-us/articles/360039956994-Missing-font-alert-in-Figma-Design) |
| Adobe Fonts support | Adobe fonts used once installed locally via Adobe CC; reload after installing | P1 | [Access and troubleshoot missing Adobe fonts in Figma Design](https://help.figma.com/hc/en-us/articles/23035569468439-Access-and-troubleshoot-missing-Adobe-fonts-in-Figma-Design) |
| Font list refresh | New fonts appear after reloading tab or restarting app | P1 | [Access and troubleshoot missing Adobe fonts in Figma Design](https://help.figma.com/hc/en-us/articles/23035569468439-Access-and-troubleshoot-missing-Adobe-fonts-in-Figma-Design) |
| Font helper status check | Preferences > Permissions and helpers shows helper connection: Blocked or Not connected | P1 | [Troubleshoot the Figma Font installer](https://help.figma.com/hc/en-us/articles/32801027692183-Troubleshoot-the-Figma-Font-installer) |
| Font helper process control | FigmaAgent / figma_agent.exe visible in Activity Monitor or Task Manager; relaunch app to restart | P1 | [Troubleshoot the Figma Font installer](https://help.figma.com/hc/en-us/articles/32801027692183-Troubleshoot-the-Figma-Font-installer) |
| Uninstall font helper | Windows Control Panel (Figma Service/Font Helper/Agent) or Mac uninstall.sh script | P2 | [Uninstall the Figma font helper](https://help.figma.com/hc/en-us/articles/19764441960599-Uninstall-the-Figma-font-helper) |
| Local fonts unavailable to cloud AI | Server-side agent/MCP can't read local-only fonts; errors mention missing fonts | Local: AI runs locally with local fonts | [Missing font alert in Figma Design](https://help.figma.com/hc/en-us/articles/360039956994-Missing-font-alert-in-Figma-Design) |

## Network & security

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Domain allowlist | Requires *.figma.com, *.figma.site, esm.sh, jsdelivr, arkoselabs and Weave domains | Local: N/A, no network needed | [Adjust your network settings](https://help.figma.com/hc/en-us/articles/19424714305943-Adjust-your-network-settings) |
| Blocked-domain failures | Missing domains break library publishing, media in comments, and importing | Local: N/A, no network needed | [Adjust your network settings](https://help.figma.com/hc/en-us/articles/19424714305943-Adjust-your-network-settings) |
| Blocked-traffic symptoms | Blocked domain gives blank homepage; blocked WebSockets give empty file lists | Local: N/A, no network needed | [Adjust your network settings](https://help.figma.com/hc/en-us/articles/19424714305943-Adjust-your-network-settings) |
| Check network settings | Quick action in a file opens Network settings modal listing blocked actions | Local: N/A, no network needed | [Adjust your network settings](https://help.figma.com/hc/en-us/articles/19424714305943-Adjust-your-network-settings) |
| Proxy, VPN and port 443 | Desktop behind proxy/VPN shows Connection Error 407; needs port 443 open | Local: N/A, no network needed | [Connection or server error 403](https://help.figma.com/hc/en-us/articles/23347716725527-Connection-or-server-error-403) |
| Proxy bypass on macOS | Add .figma.com to macOS proxy bypass list, then restart | Local: N/A, no network needed | [Adjust your network settings](https://help.figma.com/hc/en-us/articles/19424714305943-Adjust-your-network-settings) |
| Local Network Access permission | Chrome 142-144 "Local network access", 145+ "Apps on device"; needed for helper features | P1 | [Local network access in Figma](https://help.figma.com/hc/en-us/articles/34458998159511-Local-network-access-in-Figma) |
| Blocked local access impact | Blocking hides local fonts, limits spell-check languages, breaks Open in Desktop | P1 | [Local network access in Figma](https://help.figma.com/hc/en-us/articles/34458998159511-Local-network-access-in-Figma) |
| Spell check via helper | Helper enables OS spell checker and extra spell-check languages | P1 | [Local network access in Figma](https://help.figma.com/hc/en-us/articles/34458998159511-Local-network-access-in-Figma) |
| Cached permission errors | 403 from stale cached permissions; fixed by clearing cache and re-login | Local: N/A, no accounts | [Connection or server error 403](https://help.figma.com/hc/en-us/articles/23347716725527-Connection-or-server-error-403) |
| Signup captcha | Arkose captcha needed to create account; needs *.arkoselabs.com and verify.figma.com | Local: N/A, no accounts | [Troubleshoot Arkose captcha](https://help.figma.com/hc/en-us/articles/30659048904983-Troubleshoot-Arkose-captcha) |
| Account security | Strong password, 2FA, SSO, proactive password resets | Local: N/A, no accounts | [How do I keep my account secure?](https://help.figma.com/hc/en-us/articles/15021280611607-How-do-I-keep-my-account-secure) |
| Connected apps review | Settings > Security lists OAuth apps with Revoke access | Local: N/A, no accounts | [How do I keep my account secure?](https://help.figma.com/hc/en-us/articles/15021280611607-How-do-I-keep-my-account-secure) |
| Personal access tokens | Settings creates named tokens used as API keys for integrations | Local: N/A, local file access | [Bubble and Figma](https://help.figma.com/hc/en-us/articles/360052378433-Bubble-and-Figma) |
| Data subject rights | View/update profile, delete account and data; privacy@figma.com for help | Local: N/A, data stays on disk | [Exercising your Data Subject Rights](https://help.figma.com/hc/en-us/articles/360041060434-Exercising-your-Data-Subject-Rights) |

## Diagnostics & support

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Developer console | Cmd+Option+I / Ctrl+Alt+I (desktop) or F12; Help > Toggle Developer Tools | P2 | [Export console logs](https://help.figma.com/hc/en-us/articles/19818634038935-Export-console-logs) |
| Console log export | Right-click console > Save as to share errors | P2 | [Export console logs](https://help.figma.com/hc/en-us/articles/19818634038935-Export-console-logs) |
| Network HAR export | Export HAR from Network tab; sanitize with Cloudflare tool before sharing | Local: N/A, no network | [Export network logs](https://help.figma.com/hc/en-us/articles/360041949073-Export-network-logs) |
| Performance profile recording | DevTools Performance tab; Cmd+E / Ctrl+E start/stop; Save profile | P2 | [Record a performance profile](https://help.figma.com/hc/en-us/articles/360041468414-Record-a-performance-profile) |
| Debug view | Support-enabled diagnostics (render times, memory, CPU, errors); auto-expires after 7 days | Local: opt-in local diagnostics overlay | [Debug view in Figma](https://help.figma.com/hc/en-us/articles/35340652461079-Debug-view-in-Figma) |
| Help menu (?) | Bottom-right question mark: Contact support, Report abuse | Local: help menu linking repo issues | [What to share in a bug report to Figma Support](https://help.figma.com/hc/en-us/articles/360041468234-What-to-share-in-a-bug-report-to-Figma-Support) |
| Bug report contents | Video, repro steps, screenshot, browser vs desktop, network, other users affected | P1 | [What to share in a bug report to Figma Support](https://help.figma.com/hc/en-us/articles/360041468234-What-to-share-in-a-bug-report-to-Figma-Support) |
| Agent debug details | Info icon on an agent message copies debug details for support | P2 | [Troubleshoot AI tools in Figma](https://help.figma.com/hc/en-us/articles/24142105480343-Troubleshoot-AI-tools-in-Figma) |
| Support channels | AI chatbot Fig, forum, email support by plan; 6 email languages | Local: community forum and issue tracker | [Explore Figma's help and support resources](https://help.figma.com/hc/en-us/articles/360041057214-Explore-Figma-s-help-and-support-resources) |
| Report abuse | In-product and standalone abuse form; DMCA/copyright handled separately | Local: N/A, no hosted content | [Report abuse in Figma](https://help.figma.com/hc/en-us/articles/35780007858711-Report-abuse-in-Figma) |
| Content moderation | Automated scanning of Community files; manual plugin review; appeals within six months | Local: N/A, no hosted content | [How does Figma approach content and account moderation?](https://help.figma.com/hc/en-us/articles/21328699835543-How-does-Figma-approach-content-and-account-moderation) |
| DSA dispute options | EU out-of-court dispute settlement for moderation decisions | Local: N/A, no hosted content | [What are the European Union Digital Services Act resolution options?](https://help.figma.com/hc/en-us/articles/21328356377623-What-are-the-European-Union-Digital-Services-Act-resolution-options) |

## Keyboard & input

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Quick actions bar | Cmd+/ or Cmd+P (Ctrl+/ or Ctrl+P) opens searchable command bar | P0 | [Adjust your network settings](https://help.figma.com/hc/en-us/articles/19424714305943-Adjust-your-network-settings) |
| Select all / copy / paste | Cmd/Ctrl+A, C, V; used to move page content between files | P0 | [Reduce memory usage in files](https://help.figma.com/hc/en-us/articles/360040528173-Reduce-memory-usage-in-files) |
| Duplicate shortcut | Cmd/Ctrl+D duplicates selection | P0 | [Workflow lab: New tools, more expression with Figma Motion, Figma Weave, and shaders](https://help.figma.com/hc/en-us/articles/42847574436119-Workflow-lab-New-tools-more-expression-with-Figma-Motion-Figma-Weave-and-shaders) |
| Trackpad pinch-to-zoom | Pinch zoom on canvas; Safari needs macOS 10.11.1+ | P0 | [How do I configure my browser for Figma?](https://help.figma.com/hc/en-us/articles/360039828614-How-do-I-configure-my-browser-for-Figma) |
| Swipe-back protection | Mac swipe-between-pages can close the file while panning; users told to disable | P0 | [How do I configure my browser for Figma?](https://help.figma.com/hc/en-us/articles/360039828614-How-do-I-configure-my-browser-for-Figma) |
| Delete layer keys | Delete or Backspace removes selected layer | P0 | [Reduce memory usage in files](https://help.figma.com/hc/en-us/articles/360040528173-Reduce-memory-usage-in-files) |
| Modifier-click file restore | Shift+Ctrl+Option-click (Win Alt+Shift) a file opens Restore from version | P1 | [Reduce memory usage in files](https://help.figma.com/hc/en-us/articles/360040528173-Reduce-memory-usage-in-files) |

## Accessibility

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Text contrast review | Recommends checking low-contrast secondary text against WCAG (incl. AAA) when adjusting tokens | P1 | [Workflow lab: Code to canvas](https://help.figma.com/hc/en-us/articles/40219873508247-Workflow-lab-Code-to-canvas) |
| Live variable editing | Editing a variable updates all bound layers in real time for contrast/theme review | P0 | [Workflow lab: Code to canvas](https://help.figma.com/hc/en-us/articles/40219873508247-Workflow-lab-Code-to-canvas) |

## Mobile app

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Mobile app | iOS and Android app for live device preview and viewing files/prototypes | P2 | [What are the system requirements for Figma?](https://help.figma.com/hc/en-us/articles/360039827194-What-are-the-system-requirements-for-Figma) |
| Mobile browser view-only | Phones get view-only files; iOS 16+ Safari (iOS 26 shaders), Android 7+ Chrome | P2 | [What are the system requirements for Figma?](https://help.figma.com/hc/en-us/articles/360039827194-What-are-the-system-requirements-for-Figma) |
| Tablet support | Desktop-OS tablets (Surface, iPad) can view Design files and edit FigJam | P2 | [What are the system requirements for Figma?](https://help.figma.com/hc/en-us/articles/360039827194-What-are-the-system-requirements-for-Figma) |
| Mobile prototype viewing | Prototype links open in mobile browsers; address bar may obstruct actions | P2 | [What are the system requirements for Figma?](https://help.figma.com/hc/en-us/articles/360039827194-What-are-the-system-requirements-for-Figma) |
| No mobile file browser | File browser unsupported on phone browsers; still works on tablets | Local: N/A, OS file manager | [What are the system requirements for Figma?](https://help.figma.com/hc/en-us/articles/360039827194-What-are-the-system-requirements-for-Figma) |

## Multiplayer & collaboration limits

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Participant cap | Up to 500 participants per file, of which 200 can edit | P2 | [How many people can be in a file at once?](https://help.figma.com/hc/en-us/articles/1500006775761-How-many-people-can-be-in-a-file-at-once) |
| Cursor cap | Shows max 200 cursors, editors prioritized; followed cursors exempt | P2 | [How many people can be in a file at once?](https://help.figma.com/hc/en-us/articles/1500006775761-How-many-people-can-be-in-a-file-at-once) |
| Editor overflow | Editors joining over limit become view-only; 20 editors may still join a full file | P2 | [How many people can be in a file at once?](https://help.figma.com/hc/en-us/articles/1500006775761-How-many-people-can-be-in-a-file-at-once) |
| Static view beyond 500 | Late joiners get static view-only file without cursors or live changes | P2 | [How many people can be in a file at once?](https://help.figma.com/hc/en-us/articles/1500006775761-How-many-people-can-be-in-a-file-at-once) |
| Viewer capabilities | Viewers can follow, play prototypes, comment, emote, cursor chat, inspect properties | P2 | [How many people can be in a file at once?](https://help.figma.com/hc/en-us/articles/1500006775761-How-many-people-can-be-in-a-file-at-once) |
| Audio conversations | Headphone toolbar icon for voice; Professional/Org only; org can disable | P2 | [Troubleshooting audio](https://help.figma.com/hc/en-us/articles/4402390108951-Troubleshooting-audio) |
| Audio troubleshooting states | Reconnecting/Disconnected states, device detection, permissions, persistent tab indicator | P2 | [Troubleshooting audio](https://help.figma.com/hc/en-us/articles/4402390108951-Troubleshooting-audio) |
| Timeline comments | Comments pinned to a specific moment on the Motion timeline | Module | [Workflow lab: New tools, more expression with Figma Motion, Figma Weave, and shaders](https://help.figma.com/hc/en-us/articles/42847574436119-Workflow-lab-New-tools-more-expression-with-Figma-Motion-Figma-Weave-and-shaders) |

## AI & agent

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Figma agent | Left-panel agent building animations, shaders, plugins and designs from prompts | P2 | [Workflow lab: New tools, more expression with Figma Motion, Figma Weave, and shaders](https://help.figma.com/hc/en-us/articles/42847574436119-Workflow-lab-New-tools-more-expression-with-Figma-Motion-Figma-Weave-and-shaders) |
| Actions menu AI tools | AI tools via Actions in toolbar (Design, FigJam, Slides, Sites); inline in Buzz | P2 | [Figma AI FAQ](https://help.figma.com/hc/en-us/articles/24919293730327-Figma-AI-FAQ) |
| AI availability rules | Paid plans for most tools; admin opt-out; none for K-12; Gov gets Make only | Local: bring-your-own model, no plans | [Figma AI FAQ](https://help.figma.com/hc/en-us/articles/24919293730327-Figma-AI-FAQ) |
| AI credits and limits | Usage limited by credits; "Limit reached until date" errors | Local: bring-your-own model, no credits | [Troubleshoot AI tools in Figma](https://help.figma.com/hc/en-us/articles/24142105480343-Troubleshoot-AI-tools-in-Figma) |
| AI error handling | Errors for offline, rate limit, oversized selection, missing font, unsafe prompt, stale app | P2 | [Troubleshoot AI tools in Figma](https://help.figma.com/hc/en-us/articles/24142105480343-Troubleshoot-AI-tools-in-Figma) |
| AI layer renaming | Renames layers; reports "No layers need naming" when names are custom | P2 | [Troubleshoot AI tools in Figma](https://help.figma.com/hc/en-us/articles/24142105480343-Troubleshoot-AI-tools-in-Figma) |
| Agent skills | Markdown instruction files the agent calls for repeatable tasks; authored with agent | P2 | [Workflow lab: New tools, more expression with Figma Motion, Figma Weave, and shaders](https://help.figma.com/hc/en-us/articles/42847574436119-Workflow-lab-New-tools-more-expression-with-Figma-Motion-Figma-Weave-and-shaders) |
| MCP server | Remote (mcp.figma.com) or desktop MCP lets agents read designs and write to canvas | P2 | [Workflow lab: Code to canvas](https://help.figma.com/hc/en-us/articles/40219873508247-Workflow-lab-Code-to-canvas) |
| MCP rate limits | Starter/View/Collab: 6 tool calls/month; paid Dev/Full: REST Tier 1 per-minute | Local: local MCP, no limits | [What's new from Schema 2025](https://help.figma.com/hc/en-us/articles/35794667554839-What-s-new-from-Schema-2025) |
| Write to canvas skill | /figma-use creates or edits designs using existing components, variables, styles | P2 | [Workflow lab: Code to canvas](https://help.figma.com/hc/en-us/articles/40219873508247-Workflow-lab-Code-to-canvas) |
| Code-to-canvas skills | /prototype-to-figma, /figma-generate-design, /figma-generate-library import code UIs and tokens | P2 | [Workflow lab: Code to canvas](https://help.figma.com/hc/en-us/articles/40219873508247-Workflow-lab-Code-to-canvas) |
| Code Connect UI | Maps components to code via GitHub; suggestions, AI snippets, MCP usage instructions | P2 | [What's new from Schema 2025](https://help.figma.com/hc/en-us/articles/35794667554839-What-s-new-from-Schema-2025) |
| Generative plugins | Agent builds plugins (e.g. image layout with spacing, randomness, radius) | P2 | [Workflow lab: New tools, more expression with Figma Motion, Figma Weave, and shaders](https://help.figma.com/hc/en-us/articles/42847574436119-Workflow-lab-New-tools-more-expression-with-Figma-Motion-Figma-Weave-and-shaders) |
| Weave tools in Design | Run Figma or Community AI tools on images inside design files | P2 | [Figma Weave FAQ](https://help.figma.com/hc/en-us/articles/35965787376919-Figma-Weave-FAQ) |
| Figma Weave platform | Node graph: palette, prompt, array, list, model, Gen Effect, compositor, LLM, iterator nodes | P2 | [Workflow lab: New tools, more expression with Figma Motion, Figma Weave, and shaders](https://help.figma.com/hc/en-us/articles/42847574436119-Workflow-lab-New-tools-more-expression-with-Figma-Motion-Figma-Weave-and-shaders) |
| Weave Figma node | Brings a frame into Weave; chosen layers replaced by inputs; push updates back | P2 | [Figma Weave FAQ](https://help.figma.com/hc/en-us/articles/35965787376919-Figma-Weave-FAQ) |

## Beta & new features

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Figma Motion | Timeline mode toggled from toolbar; keyframes, easing curves, springs | Module | [What Figma features are in beta?](https://help.figma.com/hc/en-us/articles/4406787442711-What-Figma-features-are-in-beta) |
| Motion animation styles | Presets for position, scale, rotation, size, opacity; delay, duration, easing; stackable, copy/paste | Module | [Workflow lab: New tools, more expression with Figma Motion, Figma Weave, and shaders](https://help.figma.com/hc/en-us/articles/42847574436119-Workflow-lab-New-tools-more-expression-with-Figma-Motion-Figma-Weave-and-shaders) |
| Motion system variables | Timing and easing variables plus animated components carrying motion into instances | Module | [What Figma features are in beta?](https://help.figma.com/hc/en-us/articles/4406787442711-What-Figma-features-are-in-beta) |
| Motion handoff | Read-only Dev Mode timeline; copy code as CSS, JSON or React | Module | [What Figma features are in beta?](https://help.figma.com/hc/en-us/articles/4406787442711-What-Figma-features-are-in-beta) |
| Motion export | MP4, GIF, WebM, animated SVG; opens new tab; Lottie planned; no audio yet | Module | [What Figma features are in beta?](https://help.figma.com/hc/en-us/articles/4406787442711-What-Figma-features-are-in-beta) |
| Variable mode limits | Professional 10 modes per collection; Organization 20 | P0 | [What's new from Schema 2025](https://help.figma.com/hc/en-us/articles/35794667554839-What-s-new-from-Schema-2025) |
| Extended collections | Child collection inherits parent variables, overrides brand values; Enterprise only | P1 | [What's new from Schema 2025](https://help.figma.com/hc/en-us/articles/35794667554839-What-s-new-from-Schema-2025) |
| Slots | Placeholder containers in components accepting custom content without detaching; allowed instances restrictable | P1 | [What's new from Schema 2025](https://help.figma.com/hc/en-us/articles/35794667554839-What-s-new-from-Schema-2025) |
| Check designs | Audits hard-coded values and suggests matching variables before handoff | P1 | [What's new from Schema 2025](https://help.figma.com/hc/en-us/articles/35794667554839-What-s-new-from-Schema-2025) |
| Code layers | Closed beta for designing with code on the canvas | P2 | [What Figma features are in beta?](https://help.figma.com/hc/en-us/articles/4406787442711-What-Figma-features-are-in-beta) |
| 3D transforms | Closed beta for native spatial 3D transforms with dev-ready export | P2 | [What Figma features are in beta?](https://help.figma.com/hc/en-us/articles/4406787442711-What-Figma-features-are-in-beta) |
| Figma Buzz | Brand templates, locked editing regions, bulk creation of thousands of assets | Module | [What Figma features are in beta?](https://help.figma.com/hc/en-us/articles/4406787442711-What-Figma-features-are-in-beta) |
| Figma Sites | Website design with breakpoints, interactions (marquee, parallax), HTML preview, publishing | Module | [What Figma features are in beta?](https://help.figma.com/hc/en-us/articles/4406787442711-What-Figma-features-are-in-beta) |
| Sites custom domains | Unlimited on Org/Enterprise; 10 free on Professional through 2025 | Module | [What Figma features are in beta?](https://help.figma.com/hc/en-us/articles/4406787442711-What-Figma-features-are-in-beta) |
| Agent in FigJam and Slides | Agent turns boards into slides and brainstorms into tickets via connectors | Module | [What Figma features are in beta?](https://help.figma.com/hc/en-us/articles/4406787442711-What-Figma-features-are-in-beta) |
| Make in local codebase | Connect Git repo, edit running app, branch, commit, open PR from Make | Module | [What Figma features are in beta?](https://help.figma.com/hc/en-us/articles/4406787442711-What-Figma-features-are-in-beta) |
| Make kits and npm packages | Import design libraries or npm React packages into Make | Module | [What's new from Schema 2025](https://help.figma.com/hc/en-us/articles/35794667554839-What-s-new-from-Schema-2025) |
| Make limits | 3 attachments per message; 1MB per project file; oversized frames become images | Module | [Troubleshoot in Figma Make](https://help.figma.com/hc/en-us/articles/31304610458647-Troubleshoot-in-Figma-Make) |
| Make Point and edit | Visual element editing; supports Tailwind CSS and shadcn/ui only | Module | [Troubleshoot in Figma Make](https://help.figma.com/hc/en-us/articles/31304610458647-Troubleshoot-in-Figma-Make) |
| Make preview disable | "Open with preview disabled" or &disablepreview URL param for unresponsive files | Module | [Troubleshoot in Figma Make](https://help.figma.com/hc/en-us/articles/31304610458647-Troubleshoot-in-Figma-Make) |
| Make chat context reset | Clear chat context resets AI memory for the file | Module | [Troubleshoot in Figma Make](https://help.figma.com/hc/en-us/articles/31304610458647-Troubleshoot-in-Figma-Make) |

## Prototype sharing (from integrations)

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Link to current selection | Share link targets a selected frame or page via node-id | P1 | [Productboard and Figma](https://help.figma.com/hc/en-us/articles/12805874006551-Productboard-and-Figma) |
| Prototype scaling options | Options menu: Fit width for desktop, Fit to screen for mobile | P1 | [Test your prototypes with UserTesting](https://help.figma.com/hc/en-us/articles/19790203466263-Test-your-prototypes-with-UserTesting) |
| Prototype UI options | Toggle hotspot hints on click, sidebar, and Figma UI in prototype view | P1 | [Test your prototypes with UserTesting](https://help.figma.com/hc/en-us/articles/19790203466263-Test-your-prototypes-with-UserTesting) |
| Options encoded in URL | Changing prototype options changes the prototype URL | P1 | [Test your prototypes with UserTesting](https://help.figma.com/hc/en-us/articles/19790203466263-Test-your-prototypes-with-UserTesting) |
| Multiple flow starting points | Several flows per prototype as checkpoints for testing | P1 | [Test your prototypes with UserTesting](https://help.figma.com/hc/en-us/articles/19790203466263-Test-your-prototypes-with-UserTesting) |
| Public prototype access | Share prototype set to Anyone with Can view for external testers | Local: export standalone HTML prototype | [Test your Figma prototypes with Maze](https://help.figma.com/hc/en-us/articles/360041246514-Test-your-Figma-prototypes-with-Maze) |
| Export layers marked for export | Layers flagged with export settings can be bulk-imported by tools like ProtoPie | P1 | [ProtoPie and Figma](https://help.figma.com/hc/en-us/articles/360039829254-ProtoPie-and-Figma) |
| Shadow positioning rule | Shadows render from canvas position, so they don't rotate with the object | P0 | [Principle and Figma](https://help.figma.com/hc/en-us/articles/360039828914-Principle-and-Figma) |

## Integrations & ecosystem

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Live embeds | Embed live files/prototypes in other apps; updates in real time; respects permissions | Local: export static HTML/PNG embeds | [Confluence and Figma](https://help.figma.com/hc/en-us/articles/360053110673-Confluence-and-Figma) |
| Embed code | Share > Get Embed Code produces iframe snippet with adjustable width/height | Local: export static HTML/PNG embeds | [Pendo and Figma](https://help.figma.com/hc/en-us/articles/360049730094-Pendo-and-Figma) |
| Embed hosts | Confluence, Notion, Dropbox Paper, P2, Productboard, Qatalog, StoriesOnBoard, Superhuman, Trello, Pendo | Local: N/A, cloud-hosted | [Notion and Figma](https://help.figma.com/hc/en-us/articles/360046037373-Notion-and-Figma) |
| Link previews and smart chips | File links unfurl with name and thumbnail in Docs, Teams, Slack, Google Chat | Local: N/A, cloud-hosted | [Figma and Google Docs](https://help.figma.com/hc/en-us/articles/16921520666775-Figma-and-Google-Docs) |
| REST API file read | Third-party tools read files, frames, components and styles via REST API | Local: documented open file format plus CLI | [Bubble and Figma](https://help.figma.com/hc/en-us/articles/360052378433-Bubble-and-Figma) |
| REST API rate limits | Tier 1/2/3 per plan and seat, e.g. 6/month to 150/min; Starter-file cap | Local: N/A, no API limits | [What if I'm rate-limited?](https://help.figma.com/hc/en-us/articles/34963238552855-What-if-I-m-rate-limited) |
| Styles API limitation | API exposes only styles applied to layers in the file | Local: N/A, full file readable | [Zeroheight and Figma](https://help.figma.com/hc/en-us/articles/360039829314-Zeroheight-and-Figma) |
| File-level webhooks | Jira auto-registers webhooks for file edits and Dev Mode status changes | Local: filesystem watch events | [Jira and Figma](https://help.figma.com/hc/en-us/articles/360039827834-Jira-and-Figma) |
| Zapier triggers | New/instant comment, new file version, new dev resource, file updated | Local: CLI hooks on save | [Automate design workflows with Zapier and Figma](https://help.figma.com/hc/en-us/articles/35108701485591-Automate-design-workflows-with-Zapier-and-Figma) |
| Zapier actions | Create image, create/delete comment, react/unreact to comment, create dev resource | Local: CLI export commands | [Automate design workflows with Zapier and Figma](https://help.figma.com/hc/en-us/articles/35108701485591-Automate-design-workflows-with-Zapier-and-Figma) |
| Dev resources links | Linked Jira issues appear as Dev resources in Dev Mode | P2 | [Jira and Figma](https://help.figma.com/hc/en-us/articles/360039827834-Jira-and-Figma) |
| Ready for dev status | Dev Mode status mirrored in Jira; notifies developers when set | P2 | [Jira and Figma](https://help.figma.com/hc/en-us/articles/360039827834-Jira-and-Figma) |
| Jira plugin and widget | Link or create issues from pages/layers; widget turns designs or stickies into issues | Local: plugin ecosystem | [Jira and Figma](https://help.figma.com/hc/en-us/articles/360039827834-Jira-and-Figma) |
| Asana and Confluence widgets | Widgets bring tasks/pages onto canvas; stickies become tasks; manual Sync | Module | [Asana and Figma](https://help.figma.com/hc/en-us/articles/360061900153-Asana-and-Figma) |
| Storybook plugin | Link stories to components/variants/instances; link in right sidebar applies to all instances | P2 | [Storybook and Figma](https://help.figma.com/hc/en-us/articles/360045003494-Storybook-and-Figma) |
| Storybook design addon | @storybook/addon-designs embeds Figma frames in stories | Local: N/A, cloud-hosted | [Storybook and Figma](https://help.figma.com/hc/en-us/articles/360045003494-Storybook-and-Figma) |
| Design-to-code importers | Amplify Studio, Bubble, Maker, Lens Studio convert frames to React, apps, web or AR | Local: plugin and CLI exporters | [AWS Amplify Studio and Figma](https://help.figma.com/hc/en-us/articles/6376798776343-AWS-Amplify-Studio-and-Figma) |
| Design-system doc tools | zeroheight, Lingo, Frontify import styles/components as SVG | Local: open format readers | [Zeroheight and Figma](https://help.figma.com/hc/en-us/articles/360039829314-Zeroheight-and-Figma) |
| Prototyping tool imports | Flinto, Principle, ProtoPie import frames, layers, vectors, constraints; unsupported features flattened | Local: open format readers | [ProtoPie and Figma](https://help.figma.com/hc/en-us/articles/360039829254-ProtoPie-and-Figma) |
| ProtoPie plugin export | Exports top-level frames as scenes, vectors and text as SVG, constraints preserved | P2 | [ProtoPie and Figma](https://help.figma.com/hc/en-us/articles/360039829254-ProtoPie-and-Figma) |
| Usability testing tools | Maze, UXtweak, dscout, UserTesting, Sprig use prototype links for heat maps and metrics | Local: N/A, cloud-hosted | [Test your Figma prototypes with Maze](https://help.figma.com/hc/en-us/articles/360041246514-Test-your-Figma-prototypes-with-Maze) |
| FigJam research embeds | UserTesting, Mixpanel, Maze reports embed in FigJam; only one embed live at a time | Module | [Analyze engagement with Mixpanel](https://help.figma.com/hc/en-us/articles/11756626706199-Analyze-engagement-with-Mixpanel) |
| Meeting apps | Zoom, Teams, Google Meet present Design view-only; FigJam editable; open sessions | Local: N/A, cloud-hosted | [Figma and Zoom](https://help.figma.com/hc/en-us/articles/17720082601751-Figma-and-Zoom) |
| Teams FigJam claim window | Unclaimed FigJam boards from Teams are deleted after 24 hours | Local: N/A, cloud-hosted | [Figma and Microsoft Teams](https://help.figma.com/hc/en-us/articles/7405452518423-Figma-and-Microsoft-Teams) |
| Chat notifications | Slack/Teams/Google Chat: mentions, replies, invites, Dev Mode, branching; reply from chat | Local: N/A, no notifications | [Get Figma notifications in Slack](https://help.figma.com/hc/en-us/articles/360039829154-Get-Figma-notifications-in-Slack) |
| Slack channel subscriptions | Subscribe to file/folder/team; real-time, hourly or daily; comments batched within 10 minutes | Local: N/A, no notifications | [Get Figma notifications in Slack](https://help.figma.com/hc/en-us/articles/360039829154-Get-Figma-notifications-in-Slack) |
| Google Calendar attachments | Chrome extension attaches new or recent Figma/FigJam files to calendar events | Local: N/A, cloud-hosted | [Figma Chrome extension](https://help.figma.com/hc/en-us/articles/9067379354135-Figma-Chrome-extension) |
| Google Classroom | Share FigJam as assignments; add-on to assign, collect, grade | Module | [FigJam and Google Classroom](https://help.figma.com/hc/en-us/articles/25452227367703-FigJam-and-Google-Classroom) |

## Account & plans

| Feature | What it does | Illigma | Source |
| --- | --- | --- | --- |
| Plan detection | Sidebar shows All folders (Starter/Pro/Edu), All teams (Org), All workspaces (Enterprise) | Local: N/A, no plans | [Which plan am I on?](https://help.figma.com/hc/en-us/articles/28598881240087-Which-plan-am-I-on) |
| View admins | Non-guests view team, workspace and org admins | Local: N/A, no accounts | [How do I view admins for my team, workspace, or organization?](https://help.figma.com/hc/en-us/articles/38511946813719-How-do-I-view-admins-for-my-team-workspace-or-organization) |
| Seat approval settings | Manual, manual unless available (default), or auto-approve per seat type | Local: N/A, no billing | [There are additional charges in my Figma bill](https://help.figma.com/hc/en-us/articles/22329527405079-There-are-additional-charges-in-my-Figma-bill) |
| Seat management and billing | Downgrade to View seat; monthly add-on seats; convert to annual | Local: N/A, no billing | [There are additional charges in my Figma bill](https://help.figma.com/hc/en-us/articles/22329527405079-There-are-additional-charges-in-my-Figma-bill) |
| Regional restrictions | Sanctions-based account restrictions; no paid upgrades in Russia | Local: N/A, no accounts | [What's Figma's policy for customers in Russia and Belarus?](https://help.figma.com/hc/en-us/articles/4685987514519-What-s-Figma-s-policy-for-customers-in-Russia-and-Belarus) |
| Official email domains | Figma emails only from @figma.com / @ext.figma.com; never asks for credentials | Local: N/A, no accounts | [What are Figma’s official email addresses?](https://help.figma.com/hc/en-us/articles/32242981110679-What-are-Figma-s-official-email-addresses) |

## Notes

- Hard limits worth noting: about 2GB WASM memory per browser tab, which also applies to the desktop app. Alerts fire at 60/75/90/100%, and at 100% the file locks. Recovery mode needs memory below 90% to exit. A native or desktop Illigma build could avoid this ceiling.
- Figma's autosave is a delta journal in IndexedDB that lasts 30 days (7 on Safari). It is lost to private mode, cleared caches and full storage quotas. Illigma writes to disk, so its main need is a crash-recovery journal and an unsaved-changes prompt, not syncing.
- Rendering needs WebGL 1.0 at minimum. Shaders need WebGPU (Chrome 113+, Firefox 141+, Safari 26+). Illigma needs a fallback path for VDI, blocklisted GPUs like Intel HD 3000, and machines where WebGL is blocked or software-rendered.
- Image level-of-detail (low-res copies, with high-res above 512px only for the viewport) and lazy page loading are Figma's main ways to scale large files. Both matter for P0 performance.
- Fonts are the biggest local-first win. Figma needs a localhost helper (FigmaAgent), Chrome's Local Network Access / "Apps on device" permission, and has no local fonts at all on Linux/ChromeOS. Illigma can read OS fonts directly, but must still handle missing fonts, missing styles, version conflicts and file-wide font replacement.
- Figma only supports .TTF/.OTF fonts, and its bundled Inter overrides a locally installed Inter. Illigma should bundle a default font set because Google Fonts can't be fetched offline.
- Pasting from Illustrator depends on Illustrator's "Include SVG Code" setting. Illigma should read image/svg+xml and plain-text SVG from the clipboard.
- One behavior rule surfaced in an integration article: Figma computes shadows from the object's canvas position, so shadows don't rotate with the object. Illigma should match this for fidelity.
- Most network, account, rate-limit, embed and notification content maps to "Local: N/A". The local equivalents worth building are an open file format with a CLI or local API, filesystem-watch hooks, and a local MCP server for agents.
- This batch has almost nothing on accessibility, international keyboard layouts or keyboard remapping. Those need sources from other batches.
