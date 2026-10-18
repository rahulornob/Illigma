# @illigma/tokens

Illigma's UI design tokens, exported from the Figma file **"Illigma"** (key `K9mCPjBElVGiPOHJvZ4CWY`). MIT licensed.

Figma is the source of truth. Do not edit the generated files by hand: change the variables in Figma, export again, and rebuild.

## What's inside

| File | What it is |
| --- | --- |
| `figma-export.json` | The raw, read-only export: both variable collections (names, types, the alias each mode points at and the resolved value), the local text styles and the local effect styles. |
| `tokens.json` | [W3C Design Tokens](https://www.designtokens.org/tr/2025.10/format/) (DTCG 2025.10). Primitives hold raw values; semantic tokens reference them, for example `"{neutral.1000}"`. |
| `tokens.css` | CSS custom properties for the semantic tokens, type styles and elevation. |
| `src/index.ts` | A typed `tokens` object (semantic name to `{ dark, light }`), plus `textStyles` and `elevations`. |
| `scripts/export-figma.js` | The export script, run inside Figma. |
| `scripts/build.mjs` | The generator (plain Node, no dependencies). |

Contents of the current export:

- **"Illigma Primitives"** (one mode): 83 colours. These are the neutral, ember, blue, green, red, amber and pink ramps, plus white and black alpha steps.
- **"Illigma UI"** (Dark and Light modes): 67 semantic tokens, 54 colours and 13 dimensions (`radius/*`, `size/*`, `space/*`). Every colour aliases a primitive.
- **Text styles:** 14 in total: `UI/*` (9), `Doc/Display`, `Doc/Heading`, `Code/Body` (JetBrains Mono), and `Default/Regular` and `Default/Medium`.
- **Effect styles:** `Elevation/1 island` and `Elevation/2 popover`.

### Modes in `tokens.json`

DTCG has no standard for modes yet, so each semantic token keeps its **Dark** value (the default theme) in `$value`. Both modes are kept in `$extensions["app.illigma"].modes`:

```json
"shell": {
  "$type": "color",
  "$value": "{neutral.1000}",
  "$extensions": { "app.illigma": { "modes": { "dark": "{neutral.1000}", "light": "{neutral.150}" }, "cssVar": "--bg-shell" } }
}
```

Tools that ignore extensions see a complete Dark theme. Colours use the DTCG object form (`colorSpace`, `components`, `alpha`, `hex`), and dimensions use `{ "value": 16, "unit": "px" }`. In typography tokens, `lineHeight` is a ratio, and the pixel line height and the letter spacing in em are kept in the extension.

## Use

```css
@import "@illigma/tokens/tokens.css";

.panel { background: var(--bg-panel); color: var(--text-primary); border-radius: var(--radius-panel); box-shadow: var(--elevation-1-island); }
.label { font: var(--type-ui-label); letter-spacing: var(--type-ui-label-letter-spacing); }
```

The theme is Dark by default. Set `data-theme="light"` or `data-theme="dark"` on any element to force a theme. Without the attribute, the page follows `prefers-color-scheme`. Tokens that are the same in both modes (dimensions and a few colours) are defined once on `:root`.

```ts
import { tokens, textStyles } from "@illigma/tokens";

tokens["accent/default"].dark;   // "#3D8BFF"
tokens["text/primary"].light;    // "rgba(0, 0, 0, 0.9)"
tokens["radius/panel"].dark;     // 16 (px)
```

Bind UI to semantic tokens only. Primitives appear in `tokens.json` so that aliases resolve, but they are not exposed as CSS variables or in TypeScript.

## Naming rule

A CSS variable name is the Figma name, lowercased, with `/` and spaces turned into `-`, and a leading `--`:

- `bg/shell` becomes `--bg-shell`, and `state/danger-fill` becomes `--state-danger-fill`.
- Text styles get the prefix `type-`. `UI/Body` becomes `--type-ui-body` (a `font` shorthand) and `--type-ui-body-letter-spacing`.
- `Elevation/1 island` becomes `--elevation-1-island` (a `box-shadow` value).

In `tokens.json`, the same segments become nested groups: `bg.shell`, `typography.ui.body` and `elevation.1-island`. The build fails if two names map to the same CSS variable.

## Regenerate

1. Open the "Illigma" file in Figma Desktop with the Desktop Bridge plugin running (the figma-console MCP).
2. Run `scripts/export-figma.js` in the file, for example with the `figma_execute` tool and `fileKey: "K9mCPjBElVGiPOHJvZ4CWY"`. The script only reads; it never changes the file.
3. Save the returned JSON string, pretty-printed, as `packages/tokens/figma-export.json`.
4. Build:

   ```sh
   npm run build:tokens -w @illigma/tokens   # writes tokens.json, tokens.css, src/index.ts
   npm run check:tokens -w @illigma/tokens   # fails if the generated files are stale
   npx vitest run packages/tokens
   ```

5. Commit the export and the generated files together.

The tests check the following:

- Every semantic token has both modes.
- No colour has a purple or lime hue.
- The `text/*` colours are alpha white in Dark and alpha black in Light. `text/on-inverse` is excepted, because it sits on `bg/inverse`.
- The CSS is well formed and contains every token.
- The generated files match a fresh build.
