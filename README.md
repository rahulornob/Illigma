# Illigma

An open-source, local-first redesign of Figma: Figma's editing model, your files, your machine.

The previous browser prototype has been retired. Illigma is being rebuilt from scratch as a web-first, offline-capable editor on a GPU canvas (see the PRD).

## Documents

- [Changelog](CHANGELOG.md): the end goal, what has changed, and what comes next.
- [Product requirements (PRD)](docs/PRD.md): vision, scope, requirements, architecture, roadmap, risks and decisions.
- [Visual design](docs/design/): the current editor design (Figma file "Illigma"), exported design tokens (`tokens.json`), and the states still to design.
- [Figma feature inventory](docs/feature-inventory/): 5,356 rows covering every feature in Figma's 896 Help Center articles, plus the Plugin API, REST API and keyboard shortcuts, each with an Illigma priority (P0 = v1.0, P1 = v1.x, P2 = v2+, Module, or a local-first equivalent).

The living, editable version of the PRD is a Claude Doc; this folder holds a snapshot dated Oct 12, 2026. The editor design was approved on 18 October 2026, and development Phase 0 is under way ([plan](docs/dev/phase-0.md)).

## Development

Requires Node 22 or later.

```sh
npm install
npm run build   # type-check and compile every package
npm test        # unit tests
```

| Package | Licence | What it is |
| --- | --- | --- |
| [`@illigma/format`](packages/format) | MIT | The open `.illigma` file format: schema, reader, writer, migrations |
| [`@illigma/core`](packages/core) | MPL-2.0 | The document model: nodes, operations, transactions, undo |
| [`@illigma/layout`](packages/layout) | MPL-2.0 | Layout engine: Figma auto layout and constraints |
| [`@illigma/renderer`](packages/renderer) | MPL-2.0 | GPU canvas renderer (CanvasKit / Skia WASM on WebGL2) |
| [`apps/bench`](apps/bench) | MPL-2.0 | Renderer benchmark: 10,000 layers, `npm run bench` |

### Importing an old prototype document

Documents saved by the retired browser prototype ("Save editable document", a JSON file) convert to `.illigma`:

```sh
npm run import:prototype -- old-document.json "My design.illigma"          # package form (a folder)
npm run import:prototype -- old-document.json "My design.illigma" --zip    # single-file form
```

It runs offline and never overwrites an existing file unless you add `--force`. Pages, frames, shapes, text, groups, colours, opacity, rotation, visibility and locks carry over. Anything the file format can't hold yet (path outlines, effects, swatches, auto layout and constraint settings, letter spacing) is listed when the import finishes. From code: `importPrototypeJson(json)` in `@illigma/format`.

## Licence

MPL-2.0 for the editor ([LICENSE](LICENSE)); MIT for the file format and SDK ([packages/format/LICENSE](packages/format/LICENSE)); AGPL-3.0 for the optional sync relay (later).
