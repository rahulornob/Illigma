# Save and file states

Draft · 13 October 2026 · Phase 4.3 of the [design plan](PLAN.md) · Figma section "13 · Save states"

Principle 1 (never lose work) and principle 8 (local-first) decide every rule here. Illigma has no cloud of its own: files live on disk, and sync (iCloud Drive, Dropbox, a network drive) is done by the operating system or another app.

## Rules

1. **Autosave, no Save button.** Edits are written to disk about 1 second after the last change. The title bar shows "Saving…" only if a write takes longer than 1 second, so it never flickers. It returns to "Saved to <folder>" when done.
2. **Recovery journal.** Every edit is also appended to a recovery journal (OPFS in the browser, an app-data file on desktop) before it reaches the file. If Illigma or the computer stops, the next launch offers the last ~2 seconds of changes ("Recovered after crash"). This backs up the PRD metric "zero data loss; last 2 s of edits recoverable".
3. **Failures are never silent.** If a write fails, the title bar turns red ("Couldn't save · Retry") and a non-dismissible banner says why and what is safe. Illigma retries every 30 seconds and offers "Save a copy elsewhere…".
4. **External changes.** When the file changes on disk (another app, another computer through a synced folder):
   - **No unsaved local edits:** reload automatically and show a quiet "Updated from disk · Undo" notice.
   - **Unsaved local edits:** never reload. Show the "changed on disk" banner with **Compare…** and **Keep mine**. Keeping either version first writes the other one into Version history.
5. **Conflict copies.** When the sync service makes a conflict copy, show the warning banner and the Compare dialog. "Keep this version" moves the other copy to the Trash and can be undone with ⌘Z. "Keep both" leaves both files.
6. **Other file states**, each with a title-bar status and a banner (see the catalogue frame):

| Event | Title bar | Banner | Actions |
|---|---|---|---|
| Still downloading from the sync service | Waiting for iCloud… | Info | Keep waiting (view only until done) |
| File moved or deleted outside Illigma | Can't find file | Error, not dismissible | Locate file…, Save as… |
| No permission to write | Read-only | Warning | Save a copy… |
| Folder on a disconnected drive | Folder unavailable | Warning | Save a copy… (edits kept in the recovery journal) |
| Restarted after a crash | Recovered after crash | Info | Keep recovered changes, Discard |

## Components

- **Save status** (`96:28888`): Saved, Saving, Error, Changed on disk, Conflict, Waiting for sync, Read-only, Folder unavailable, Recovered. Lives in the Title bar.
- **Banner** (`96:28940`): Info (neutral surface), Warning, Error; message, up to two actions, Dismissible. Error banners are not dismissible.
