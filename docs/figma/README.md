# Figma reference guide for Illigma

Use this guide when asking an AI to implement or fix an editor feature. It supplies shared terminology, official reference links, the code locations to inspect, and a repeatable live-comparison workflow. The root [AGENTS.md](../../AGENTS.md) directs compatible coding agents here automatically. Other AI tools must be given these files explicitly; this does not train a model or grant Figma access.

## Start here

| Need | Read |
| --- | --- |
| Understand “make this work like Figma” | [Feature guide and terminology](feature-guide.md) |
| Turn a request into a tested implementation | [Implementation workflow](implementation-workflow.md) |
| Find the code and known differences | [Illigma code map](code-map.md) |
| Find any article in the supplied category | [Complete source catalog](source-catalog.md) |
| See what was actually inspected live | [September 27 observation](observations/2026-09-27-live-figma.md) |
| Record the next feature specification | [Feature contract template](feature-contract-template.md) |
| Review the previous layout work | [Auto-layout research and limitations](../auto-layout-2026.md) |

## A prompt you can reuse

> Implement **[feature or problem]** in Illigma using the project's Figma reference guide. Read AGENTS.md, find the official documentation, inspect the matching behavior in live Figma, and record a behavior contract. Implement the behavior in the existing code, including canvas/layers/properties, undo, persistence, and relevant export behavior. Test the interaction and report any remaining differences. Preserve my existing UI choices.

You can use shorter requests such as “fix frame selection like Figma” when the agent already has this repository context.

## Reference coverage

Snapshot retrieved **2026-09-27** from the official [Figma Design category](https://help.figma.com/hc/en-us/categories/360002042553-Figma-Design): **183 articles across 24 article-bearing sections** (29 section records including grouping sections). All 183 article bodies were retrieved through Figma's public Help Center API. The catalog covers every returned article; headings and distributed excerpts were reviewed across the collection, with closer reading of core editor behavior. This is not a claim of line-by-line review of all 155,958 words or live testing of every feature. Videos were not watched for this guide.

The scope is the supplied Figma Design category, including Draw, design systems, prototypes, import/export, and collaboration. It does not exhaust all Figma administration, billing, Dev Mode, API, Make, Sites, Motion, FigJam, or third-party documentation. Some articles link to those products.

The retrieval date is not a feature release date. Older foundational articles remain relevant; check their current content. Plan limits, UI rollouts, platform shortcuts, and layout versions need fresh verification.

## Lookup and refresh

```sh
python3 scripts/figma_reference.py "auto layout"
python3 scripts/figma_reference.py "selection"
python3 scripts/figma_reference.py --read 360040449873
python3 scripts/figma_reference.py --refresh
```

The lookup searches local metadata. `--read` retrieves the full current official article for the agent to read. `--refresh` updates the catalog and marks changed bodies as needing review; it never upgrades a source to live-verified. The repository stores metadata and original guidance, not a mirrored copy of the Help Center.
