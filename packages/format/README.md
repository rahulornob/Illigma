# @illigma/format

The open `.illigma` file format: schema, reader, writer and migrations. MIT licensed, so any tool can read and write Illigma files.

## Format version 0

A file is a folder (the package form):

```
Onboarding flow.illigma/
  manifest.json          format, version, fileId, name, page order, created, app
  pages/<page-id>.json   that page's nodes: a JSON array, one node per line, sorted by id
```

- **Nodes are flat.** Each node has a `parentId` (pages have `null`) and an `index`, a fractional key that orders it among its siblings. Keys compare as plain strings, so inserting or moving a node never rewrites its neighbours. They follow rocicorp's `fractional-indexing` scheme (`a0`, `a1` … `az`, `b00` …), so repeated appends stay short. Node ids are 1–64 of `A–Z a–z 0–9 _ -`, because a page id is also its file name.
- **Output is canonical.** Keys are sorted and spacing is fixed, so saving the same file twice gives identical bytes and Git diffs stay small.
- **Versions only go forward.** A reader upgrades older files through `MIGRATIONS` and refuses files from a newer version with a clear message. The app never writes an older version.
- **Validation runs on read and write.** A damaged file is refused with a list of problems; an invalid document is never saved.

The node schema is in [`schema/node.v0.schema.json`](schema/node.v0.schema.json) (JSON Schema 2020-12) and [`src/schema.ts`](src/schema.ts).

### Single-file form (done)

For sharing, the same tree can be one `Name.illigma` file: a standard zip archive.

- **Same paths, nothing extra.** The zip holds exactly the package paths. Unzipping a file gives a valid package folder, and zipping a package folder (Finder, Explorer, `zip -r`) gives a file Illigma opens. A single wrapping folder, folder entries and `__MACOSX/` / `.DS_Store` noise are ignored on read.
- **No marker entry.** Instead of an ODF-style `mimetype` file, `manifest.json` is always the first entry and is stored uncompressed, so a tool can read the format, version and name from the first local header without inflating anything. `isZip(bytes)` tells the two forms apart.
- **Deterministic bytes.** Entries after the manifest are in sorted path order and deflated (or stored when that is smaller). Timestamps are fixed at 1980-01-01 00:00, names are flagged UTF-8, and there are no comments, extra fields or data descriptors. The same file always zips to identical bytes.
- **Safe to open.** Reading refuses paths that escape the folder (`..`, absolute paths, drive letters, backslashes), duplicate entries, encrypted, split and ZIP64 archives, unknown compression, CRC mismatches, entries that inflate past their declared size, and archives whose contents add up to more than `maxTotalBytes` (default 512 MB). Every failure is a `FormatError` with a plain message.

DEFLATE comes from [fflate](https://github.com/101arrowz/fflate) (MIT); the zip container code is ours.

Planned for later versions: `assets/` for images and fonts, `variables.json`, `styles.json`, components, comments and `history/` (PRD section 6.2). Binary entries such as `assets/` will need the tree to carry bytes as well as text.

## Use

```ts
import { isZip, readPackage, readZip, writePackage, writeZip } from "@illigma/format";

const tree = writePackage(file);   // Map<path, text>
const again = readPackage(tree);   // throws FormatError with plain-language problems

const bytes = writeZip(tree);      // the single-file form, deterministic
const opened = readPackage(isZip(bytes) ? readZip(bytes, { maxTotalBytes: 512 * 1024 * 1024 }) : tree);
```

## Robustness

`src/fuzz.test.ts` feeds both readers 2,000 seeded random inputs per run (truncated, bit-flipped and spliced archives; damaged JSON; random values in node and manifest fields). Each must open as a valid file or throw a `FormatError`, never another exception. To fuzz longer: `FUZZ_SEED=42 FUZZ_CASES=100000 npx vitest run fuzz`.

## Importing old prototype documents

`importPrototypeJson(json)` converts a document saved by the retired browser prototype (`illigma.document.v1`, version 1, including the older single-artboard form) into a valid format v0 file and returns `{ file, warnings }`. Prototype artboards become frames, `rect` / `ellipse` / `path` / `text` become `RECTANGLE` / `ELLIPSE` / `VECTOR` / `TEXT`, and a shared `groupId` becomes a `GROUP`. Coordinates become parent-relative, rotation moves from the box centre to the top-left corner, `fontWeight` becomes a style name (500 → "Medium") and line height becomes pixels. Everything v0 can't hold is listed in `warnings`. From the command line: `npm run import:prototype -- old.json out.illigma [--zip] [--force]`.
