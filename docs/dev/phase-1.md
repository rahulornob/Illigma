# Phase 1 · Editor core

Planned for January to April 2027 (alpha, PRD section 9): tools, layers, vector networks, booleans, masks, canvas text, paints, effects, auto layout, constraints and export. Work started early, on 18 October 2026, alongside the Phase 0 follow-ups ([phase-0.md](phase-0.md)).

New screens and panels are still designed in Figma and approved before they are built.

## Status

| Work | Package | Status |
|---|---|---|
| Canvas: direct manipulation | `apps/web`, `@illigma/core` | Done 2026-10-18: move, resize with 8 handles, marquee, Shift/⌘ multi-select, nudge, delete, duplicate, select all; live drags as one undo step (`Document.beginLive`). QC rounds 1–5 closed |
| Layout wiring | `@illigma/layout`, `apps/web` | Done 2026-10-18: relayout runs inside every edit, drag step and recovery replay (core `normalize` hook), constraints on resize, reorder by drag in auto layout. Auto layout and constraints inspector done (Properties: auto layout card, Fixed/Hug/Fill menus, absolute position, constraints card; Shift+A) |
| Vector geometry | `@illigma/format`, `@illigma/renderer` | Done 2026-10-18 (geometry only, no editor UI): format fields, SVG path data in and out, drawing, hit-testing and prototype import. See below |
| Vector editing (pen, edit mode, handles, corner radius per point) | `apps/web` | Not started; needs designs |
| Booleans, flatten, outline stroke | `@illigma/renderer` (geometry) | Not started |

## Vector geometry

- **Fields** (format v0, optional, Figma Plugin API names): `vectorNetwork` on VECTOR (`vertices` `{ x, y, cornerRadius? }`, `segments` `{ start, end, tangentStart, tangentEnd }` with tangents relative to their vertex, `regions` `{ windingRule: "NONZERO" | "EVENODD", loops: number[][] }`), in the node's own space (0…width, 0…height); `pointCount` (POLYGON, default 3; STAR, default 5; whole numbers from 3 to 1,000); `innerRadius` (STAR, 0–1, default 0.382); `strokeCap` (`NONE` default, `ROUND`, `SQUARE`); `strokeJoin` (`MITER` default, `BEVEL`, `ROUND`). Absent fields mean Figma's defaults; files without them save byte for byte as before.
- **Validation** (`validate.ts`, also used by every `Document.transact`): exact keys, finite numbers, integer indices in range, every region loop a chain of segments that join end to end and close (in either direction), caps of 100,000 vertices, 100,000 segments, 10,000 regions and 200,000 loop entries.
- **Helpers** (`@illigma/format`, `vector.ts`): `vectorNetworkFromSvgPath(d, { windingRule })`, `svgPathFromVectorNetwork(net)`, `vectorNetworkProblem`, `walkVectorLoop`, `vectorStrokeChains` (segments joined into runs through points shared by exactly two segments), `vectorNetworkPaths` (flat path commands per region and for the stroke), `arcToCubics`. Bad input only ever throws `FormatError`; a fuzz test checks 3,000 random and mutated paths.
- **Drawing** (`geometry.ts` in `@illigma/renderer`, shared with hit-testing): a vector fills each region with its winding rule (no regions: its runs fill as if closed, as in Figma and SVG) and strokes all segments with caps and joins; polygons and stars sit on the ellipse inscribed in the box, first point at the top centre, corners rounded by `cornerRadius`; a line strokes from (0, 0) to (width, 0). Geometry is cached per network, so moving a vector doesn't rebuild it, and the per-screen picture caching is unchanged.
- **Hit-testing**: polygons and stars by shape; vectors by filled regions when they have a visible fill and by their stroke when they have a visible stroke or no fill; lines by stroke. Strokes reach half their weight plus `tolerance` (default 2 world units; `PageRenderer.hitTest` passes 3 screen pixels).
- **Import**: prototype paths (SVG `d` in a `baseW` × `baseH` box) become networks scaled to the layer, even-odd, with round caps and joins when stroked.
- **Benchmark** (10,000 layers, now including 1,300 stars, polygons and curved vectors with holes; Apple M1, ANGLE Metal, 2× pixel density): median 60 fps, 99.3–99.7% of frames within 16.7 ms, 4.1–4.9 ms draw per frame, page recorded once in 90–96 ms. With one edit per frame (`--edit`): 100% within budget. Before this change (rectangles, ellipses and text only): 100%, 4.5 ms, 87 ms.
- **Not yet:** per-vertex `cornerRadius` and node `cornerRadius` on vectors are stored but not drawn; arrow caps; per-region fills; stroke alignment (strokes are centred); `LINE` arrowheads; `ELLIPSE` arc data; the vector editor itself.
