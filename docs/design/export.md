# Export

Draft · 13 October 2026 · Phase 4.8 of the [design plan](PLAN.md) · Figma section "18 · Export"

Export writes files into a folder on your disk. Nothing is uploaded, and there is no "share link". Everything works offline.

## Screens

| Screen | Node | What it shows |
|---|---|---|
| Export · Frame export settings | `96:50721` | The Design tab's Export card: one row per setting (scale, suffix, format), the Export button, a preview, and the success toast with **Open folder**, and the SVG options popover |
| Export dialog (⇧⌘E) · Export all | `96:51613` | Every layer that has export settings, with what each one will write and its size. Option to export the prototype as HTML. Folder and options |
| Export tokens · from Variables manager | `96:53162` | Token export: format, collections, one file per mode, and a live preview of the file |
| Export · progress and failure states | `96:53886` | Exporting in the background, a partial failure (disk full) with Retry, and token export success / permission-lost results |

## Export settings (Properties → Export)

- **+** adds a setting. Each row has a **scale** (0.5x–4x, or a fixed width or height such as `512w`), a **suffix** (`@2x`) and a **format** (PNG, JPG, SVG, PDF). **⋯** opens format options: SVG (outline text, include `id` attribute, simplify stroke, ignore overlapping layers), PNG / JPG (quality, colour profile), PDF (outline text). The minus button removes the row.
- **Export <layer> · N files** writes the files at once. The default folder is `export/` next to the design file, and the Export dialog can change it.
- The **preview** shows the first setting at its real size.
- Success shows a toast: "Exported 3 files to … · Open folder".

## Export dialog (⇧⌘E)

- Lists every layer on the page that has export settings. Each row has a checkbox, a thumbnail, the formats it will write and an estimated size. The header checkbox selects all of them.
- **Also export the prototype as HTML**: writes a folder that opens in any browser, offline, for the chosen flow. This is the local-first stand-in for a shared prototype link.
- **Folder** and **Choose…**. **Replace files with the same name** is off by default, so new files get a number (`Welcome-1.png`) instead of replacing older ones (principle 1, never lose work).
- **Open folder when done** (desktop app only).

### Web vs desktop

- In the desktop app, paths are shown in full (`~/Design/…`) and **Open folder** reveals the folder in Finder, Explorer or Files.
- In the web app, the browser's File System Access API exposes only the folder's name, so the dialog shows `export` with **Change folder**, and there is no Open folder button. Browsers without that API download a `.zip` instead.

## Export tokens

- Opens from **Export…** in the Variables manager.
- **Format**: Design Tokens (W3C JSON), CSS variables, Tailwind. Tokens Studio, Swift and Android XML are under **More**.
- Choose collections, and choose **one file per mode** or one combined file.
- The preview updates live and can be copied. Its header is a menu for switching between the files that will be written. Aliases stay as references (`{gray.950}`).
- The same files can be imported again with **Import tokens…**, so a round trip keeps names, aliases and modes.

## Progress and failures

- Export runs in the background, so you can keep working. Each row shows Done, a count (2 of 3), Waiting or Skipped.
- If some files fail, an error banner says how many succeeded, which files failed and why, and that nothing else changed. **Retry N files** runs only the failed ones. A row that partly failed says how many ("2 failed"). Errors are never silent.
- Token export ends with a toast ("Exported 4 token files to “tokens” · Open folder"), or an error banner if the folder permission was lost, with **Choose folder again**.
