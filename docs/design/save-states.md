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

## How the web app keeps these rules (18 October 2026)

- **All-or-nothing saves.** A package is several files, so a save is a roll-forward commit: every file is first written as `<name>.illigma-tmp`, then a `.illigma-commit.json` marker lists what to promote, then each file is replaced and the marker removed. A save cut short before the marker leaves the previous save; after the marker, the next read finishes it. A reader never sees half of one save and half of another.
- **Recovered edits wait for the person.** Edits left in the journal by an earlier session stay there until Keep or Discard, even while the person keeps working and autosave runs. Closing the tab without choosing offers them again next time.
- **Keep** replays the recovered edits on a copy of the open file, skips any edit whose layer or parent is gone (the editor says how many), checks the result is a valid file and saves it before showing it. Editing is paused for that moment. If it fails, nothing changes and the error shows in the editor.
- **No false recoveries.** Each save writes an id into the package (`.illigma-rev`) and the same id into the journal, so edits a save already holds are never offered again, even if the tab closed before the journal was trimmed.
- **One editing tab per file.** A second tab on the same file opens read-only with the banner "Open in another tab — read-only here" (Web Locks). It never saves and never touches the journal.
- **Lost folder permission.** Retry asks the browser for write access again (it must be asked from the click), then saves. The error banner also offers "Save a copy elsewhere…": a folder of the person's choice where the browser allows it, otherwise a download of the single-file (zip) form.
- **App updates** never switch versions under an open file: a new version installs in the background and the app shows "Update ready · Reload". Reload first appends the recovery journal and saves.
- **Foreign folders are never touched.** Open Folder creates a file only in an empty folder or one named `*.illigma`; any other folder is refused with "This folder isn't an Illigma file. Choose an empty folder or a .illigma folder." A save removes only `pages/<id>.json` files the previous manifest listed.
- **Changed on disk (rule 4).** Every save first compares the package's save id with the one this tab last read or wrote; a folder is also checked every 5 seconds and on focus. No unsaved edits: reload, with "Updated from disk · Undo". Unsaved edits: saving stops, the title bar reads "Changed on disk" and the banner offers **Compare…** (the disk version, read-only, in a new tab) and **Keep mine** (this version is written as "<name> (conflict <date>)" with a new file id, then the disk version is replaced only after "Replace disk version"). Version history does not exist yet, so the replaced disk version is not kept there.
- **Copies get their own id.** "Save a copy" and conflict copies get a new file id; a folder opened whose id belongs to another existing file (Finder duplicate) gets a new id, saved into it.
- **Recovered edits that don't fit stay.** Keep places a recovered layer whose position a newer sibling took right after it; an edit that still can't apply stays in the journal and the notice offers "Export skipped edits…".
- **Leaving is never silent.** Going Home while the file holds unsaved edits asks first: "Save a copy elsewhere…" or "Leave anyway (edits stay recoverable)".
- **The last edits before closing.** The journal appends every 250 ms, and an append may not finish once the tab closes. On pagehide the not-yet-appended edits are also stashed synchronously in localStorage (bounded, per file); the next load adds the ones the journal lacks and removes the stash, so they are offered like any other recovered edit. A drag still open then is kept first.
