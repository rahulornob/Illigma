# @illigma/format

The open `.illigma` file format: schema, reader, writer and migrations. MIT licensed, so any tool can read and write Illigma files.

## Format version 0

A file is a folder (the package form):

```
Onboarding flow.illigma/
  manifest.json          format, version, fileId, name, page order, created, app
  pages/<page-id>.json   that page's nodes: a JSON array, one node per line, sorted by id
```

- **Nodes are flat.** Each node has a `parentId` (pages have `null`) and an `index`, a fractional key that orders it among its siblings. Keys compare as plain strings, so inserting or moving a node never rewrites its neighbours.
- **Output is canonical.** Keys are sorted and spacing is fixed, so saving the same file twice gives identical bytes and Git diffs stay small.
- **Versions only go forward.** A reader upgrades older files through `MIGRATIONS` and refuses files from a newer version with a clear message. The app never writes an older version.
- **Validation runs on read and write.** A damaged file is refused with a list of problems; an invalid document is never saved.

The node schema is in [`schema/node.v0.schema.json`](schema/node.v0.schema.json) (JSON Schema 2020-12) and [`src/schema.ts`](src/schema.ts).

Planned for later versions: the single-file zip form, `assets/` for images and fonts, `variables.json`, `styles.json`, components, comments and `history/` (PRD section 6.2).

## Use

```ts
import { readPackage, writePackage } from "@illigma/format";

const tree = writePackage(file);   // Map<path, text>
const again = readPackage(tree);   // throws FormatError with plain-language problems
```
