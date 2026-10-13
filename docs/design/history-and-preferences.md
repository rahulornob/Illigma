# Version history and Preferences

Draft · 13 October 2026 · Phase 4.9 of the [design plan](PLAN.md) · Figma section "19 · History & preferences"

## Screens

| Screen | Node | What it shows |
|---|---|---|
| Version history · viewing a named version | `96:54239` | History in the right panel, a selected named version shown read-only on the canvas, the version ⋯ menu |
| Version history · compare with current | `96:55003` | Two versions side by side, with Changed, Added and Removed markers and a list of changes |
| Preferences · AI tools (MCP server) | `96:55687` | The local MCP server: on/off, address, access level, connected tools, setup command |
| Preferences · Files and saving | `96:56178` | Default folder, autosave, recovery journal, autosave retention, external-change behaviour |
| Version history · Save version (⌥⌘S) | `96:60244` | Name and description for a new named version |
| AI tools (MCP) · states | `96:60818` | Edit approval popover (Allow / Deny, per-session allow, show on canvas), server error (port in use) with port field, no tools connected |

## Version history

- Opens from the File menu, the title bar's save status, or ⌥⌘H. It replaces the right panel, like Figma.
- Versions are stored **inside the `.illigma` file**, so they travel with it through any synced folder. Autosaves are kept for 30 days (configurable). Named versions stay until you delete them.
- **Save version** (⌥⌘S) adds a named version with an optional description.
- Kinds: **Current** (green dot), **Named** (filled blue dot) and **Autosave** (hollow dot). The **Show autosaves** toggle hides autosaves. Versions written by the save rules ("Kept from conflict copy", "Before reload") are named automatically. See [save-states.md](save-states.md).
- Clicking a version shows it **read-only** on the canvas with a banner: **Back to current (Esc)** and **Restore this version**. Only Move, Comment and Hand stay in the tool dock; selecting, copying and exporting still work.
- Consecutive autosaves collapse into a group ("6 more autosaves"). **Show older versions** loads the rest.
- Each row shows **⋯** on hover, selection and focus.
- ⋯ menu: Restore, Compare with current, Duplicate as new file, Rename (Name this version for autosaves), Delete version (undoable).
- **Save version** dialog: name (required), description (optional).
- **Restore** first saves the current state as a version, so restoring can always be undone.

## Compare

- Pick any two versions. Views: **Side by side**, **Overlay** (onion skin) and **Slider**.
- Changed layers are outlined in amber, added in green and removed in red, with a tag. These are status colours, used only for status.
- The panel lists the changes. Clicking one zooms to it. **Restore** restores the whole older version.

## Preferences

Sections: General, Appearance (Dark, Light, System), Canvas (nudge amounts, snapping, pixel grid), Files and saving, Phone preview (port, ask before connect; see [prototype.md](prototype.md)), AI tools (MCP), Shortcuts, Updates and privacy.

### AI tools (MCP)

- A local **MCP server** lets AI tools on the same computer, such as Claude Code or Cursor, read and, if allowed, edit open files. **Off by default.** It listens on `127.0.0.1` only.
- **Access**: Read only (default) or Read and edit. With Read and edit, **Ask before each edit** shows each change for approval. Every AI edit is a normal undo step.
- Connected tools are listed, each with **Disconnect**, or "No tools connected" with a hint. An activity log records the last actions.
- With Ask before each edit, a popover lists the requested changes with **Allow**, **Deny**, **Show on canvas** and an "until I close this file" option.
- If the server cannot start (port in use), an error banner says why and offers another port with **Try again**.
- Honest copy: Illigma sends nothing, but the connected tool may send what it reads to its own service.

### Files and saving

- Default folder for new files, autosave (always on), recovery journal (always on), autosave retention, and what to do when a file changes on disk.

### Updates and privacy

- **No telemetry.** Illigma sends no usage data, so there is nothing to turn off. Crash reports are saved locally, and the user chooses whether to send one.
- Update checks: weekly by default, and nothing is downloaded until the user agrees.

## Known debt

- Compare's Overlay and Slider views are specified but not drawn.
- Change rows, connected-tool rows and dialog containers are plain frames, not components.
