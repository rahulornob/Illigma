# Illigma parity checklist: master index

| | |
| --- | --- |
| **Phase** | Planning. Documentation only; no application code exists. |
| **Counted** | 2026-10-08, from the eleven area specs in this folder, using the commands in [§8](#8-how-to-recount). Every number below was counted from the files, not estimated. |
| **Status of every item** | **Not started.** 2,718 Figma-parity items and 160 UI items, and none has been implemented or validated. No feature of Illigma has 1:1 parity with Figma. |
| **Plan** | [`PLAN.md`](../../PLAN.md) holds the roadmap, the validation process and the status definitions. Coding sessions follow [`AGENTS.md`](../../AGENTS.md). |

---

## 1. The rule: statuses change only with linked test evidence

1. An item's status is **derived from tests, never typed by hand.** From slice M0-02 onward (see `PLAN.md` §9), `tools/parity-matrix` reads the test results. A test carries its item ID in its title, for example `it('[AL-012] wrap with SPACE_BETWEEN …')`. The tool writes `docs/parity/matrix.generated.md` and `parity-matrix.json`. Until that tool exists, every item stays **Not started**.
2. **Validated** also requires Figma evidence: a fixture captured from the user-designated disposable Figma file (`fixtures/figma/<area>/<ID>/`, with `meta.json`), or a dated observation log in `docs/figma/observations/` for behavior that is interaction-only. A linked test must compare Illigma's behavior against that evidence. The criteria are in `PLAN.md` §11–§12.
3. **Do not tick checkboxes by hand.** `- [x]` means *Validated*. It is written only in the same change that links the evidence and the passing tests, or by the parity-matrix tool. On 2026-10-08 the files contain no ticked boxes (check 6 in §8).
4. **Moving an item to another milestone** means editing its `_M#·P#_` tag in the area file. The same change must give the reason in `PLAN.md` §17 (change log). Items are never dropped silently.
5. If a linked test starts failing, the status is recomputed and drops (*Validated* or *Implemented* → *In progress*). If the Figma evidence goes stale (`PLAN.md` §11, step 6), *Validated* drops back to *Implemented*.

## 2. Status legend

| Status | Meaning (full definition in `PLAN.md` §12) |
| --- | --- |
| **Not started** | No test is linked to the item ID. |
| **In progress** | At least one linked test exists, and at least one linked test fails or is marked skipped or todo. |
| **Implemented** | Every linked test passes in CI on all supported platforms. Illigma does what the item says, but it has not yet been compared against Figma evidence. |
| **Validated (1:1 parity)** | *Implemented*, **and** at least one linked test compares against current Figma evidence (a fixture or an observation log) within the tolerances of `docs/architecture.md` ADR-024. Every clause of the item, including edge cases and modifiers, has an assertion. The item's correctness claims no longer rest only on `[KNOW]` or `[SRC]`. |
| *Requirement* (annotation) | The item is an Illigma-only requirement: its tags are only `[ILL]`, `[REQ]`, `[DECISION]` or similar, so there is no Figma behavior to compare. Its final status is **Implemented**, and it is reported apart from parity percentages. |

---

## 3. Areas, counted by milestone and priority

Each item has exactly one `_M#·P#_` tag. A tag-occurrence count therefore equals the item count; check 3 in §8 confirms both are 2,718. IDs are contiguous from 001 to the last ID in each area.

| # | Area spec | Prefix | Items | IDs | M0 | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 | P0 | P1 | P2 | Live-verification section |
| --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 01 | [Canvas, navigation, selection & transforms](01-canvas-selection-transform.md) | CV | 266 | CV-001…266 | 14 | 224 | 5 | 2 | 9 | 6 | 3 | 0 | 3 | 135 | 94 | 37 | [§8](01-canvas-selection-transform.md#8-needs-live-figma-verification) (59 exp.) |
| 02 | [Frames, groups, sections, constraints & layout guides](02-frames-groups-sections-constraints.md) | FR | 247 | FR-001…247 | 11 | 130 | 8 | 0 | 71 | 9 | 9 | 3 | 6 | 128 | 85 | 34 | [§8](02-frames-groups-sections-constraints.md#8-needs-live-figma-verification) (59 exp.) |
| 03 | [Auto layout (flex + grid)](03-auto-layout.md) | AL | 249 | AL-001…249 | 0 | 1 | 2 | 2 | 218 | 12 | 4 | 0 | 10 | 124 | 93 | 32 | [§8](03-auto-layout.md#8-needs-live-figma-verification) (41 exp.) |
| 04 | [Shapes, vector networks, booleans & masks](04-shapes-vectors-booleans.md) | VC | 237 | VC-001…237 | 3 | 47 | 175 | 1 | 3 | 2 | 3 | 0 | 3 | 102 | 102 | 33 | [§8](04-shapes-vectors-booleans.md#8-needs-live-figma-verification) (50 exp.) |
| 05 | [Fills, strokes, effects, color & export](05-paint-effects-color-export.md) | PE | 252 | PE-001…252 | 17 | 36 | 172 | 3 | 3 | 4 | 11 | 2 | 4 | 99 | 105 | 48 | [§8](05-paint-effects-color-export.md#8-needs-live-figma-verification) (52 exp.) |
| 06 | [Text & typography](06-text-typography.md) | TX | 243 | TX-001…243 | 0 | 0 | 3 | 205 | 8 | 4 | 17 | 1 | 5 | 108 | 101 | 34 | [§8](06-text-typography.md#8-needs-live-figma-verification) (63 exp.) |
| 07 | [Components, instances, variants, properties & slots](07-components-variants.md) | CP | 243 | CP-001…243 | 0 | 0 | 0 | 0 | 0 | 221 | 12 | 7 | 3 | 120 | 98 | 25 | [§8](07-components-variants.md#8-needs-live-figma-verification) (36 exp.) |
| 08 | [Variables, modes, styles, libraries & design-system management](08-variables-styles-design-systems.md) | DS | 246 | DS-001…246 | 3 | 1 | 11 | 11 | 7 | 8 | 198 | 3 | 4 | 122 | 93 | 31 | [§8](08-variables-styles-design-systems.md#8-needs-live-figma-verification) (76 exp.) |
| 09 | [Prototyping, interactions & presentation](09-prototyping.md) | PR | 275 | PR-001…275 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 263 | 11 | 115 | 133 | 27 | [§8](09-prototyping.md#8-needs-live-figma-verification) (38 exp.) |
| 10 | [Layers, pages, assets, inspector, shortcuts, menus & file workflows](10-panels-shortcuts-workflow.md) | UX | 214 | UX-001…214 | 19 | 132 | 8 | 10 | 5 | 19 | 2 | 3 | 16 | 87 | 86 | 41 | [§8](10-panels-shortcuts-workflow.md#8-needs-live-figma-verification) (79 exp.) |
| 11 | [Local file format, persistence & interoperability](11-file-format-interop.md) | IO | 246 | IO-001…246 | 26 | 16 | 67 | 15 | 3 | 4 | 26 | 8 | 81 | 97 | 90 | 59 | [§8](11-file-format-interop.md#8-needs-live-figma-verification) (35 exp.) |
| | **Total** | | **2,718** | | **93** | **587** | **451** | **249** | **327** | **290** | **285** | **290** | **146** | **1,237** | **1,080** | **401** | **588 exp.** |

"exp." counts the unique experiment IDs defined in each area's §8 (table rows or bullets that start with an ID). Experiment IDs are **local to their file**: `V-01` exists in several areas. Cite them with the area prefix, for example "CV V-19" or "CP E-07".

## 4. Milestone × priority per area (P0 / P1 / P2)

"—" means the area has no items in that milestone.

| Area | M0 | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CV 01 | 13/1/0 | 112/79/33 | 1/3/1 | 1/0/1 | 4/4/1 | 4/2/0 | 0/3/0 | — | 0/2/1 |
| FR 02 | 10/1/0 | 66/48/16 | 4/3/1 | — | 44/19/8 | 3/2/4 | 0/8/1 | 0/1/2 | 1/3/2 |
| AL 03 | — | 0/1/0 | 1/1/0 | 0/2/0 | 115/78/25 | 6/5/1 | 2/2/0 | — | 0/4/6 |
| VC 04 | 3/0/0 | 27/17/3 | 72/76/27 | 0/1/0 | 0/2/1 | 0/1/1 | 0/2/1 | — | 0/3/0 |
| PE 05 | 13/4/0 | 29/7/0 | 51/79/42 | 1/2/0 | 0/3/0 | 2/2/0 | 3/7/1 | 0/0/2 | 0/1/3 |
| TX 06 | — | — | 0/3/0 | 94/79/32 | 2/5/1 | 2/2/0 | 10/7/0 | 0/1/0 | 0/4/1 |
| CP 07 | — | — | — | — | — | 116/82/23 | 3/9/0 | 1/4/2 | 0/3/0 |
| DS 08 | 2/1/0 | 0/0/1 | 6/4/1 | 4/7/0 | 3/4/0 | 7/1/0 | 99/73/26 | 1/1/1 | 0/2/2 |
| PR 09 | — | — | — | — | — | 0/0/1 | — | 115/124/24 | 0/9/2 |
| UX 10 | 10/9/0 | 62/50/20 | 1/5/2 | 3/6/1 | 3/2/0 | 7/7/5 | 0/1/1 | 1/1/1 | 0/5/11 |
| IO 11 | 20/6/0 | 9/4/3 | 34/26/7 | 6/6/3 | 3/0/0 | 4/0/0 | 4/17/5 | 1/3/4 | 16/28/37 |
| **Total** | **71/22/0** | **305/206/76** | **170/200/81** | **109/103/37** | **174/117/36** | **151/104/35** | **121/129/35** | **119/135/36** | **17/64/65** |

## 5. Global totals

| | M0 | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 | **All** |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| P0 | 71 | 305 | 170 | 109 | 174 | 151 | 121 | 119 | 17 | **1,237** |
| P1 | 22 | 206 | 200 | 103 | 117 | 104 | 129 | 135 | 64 | **1,080** |
| P2 | 0 | 76 | 81 | 37 | 36 | 35 | 35 | 36 | 65 | **401** |
| **All** | **93** | **587** | **451** | **249** | **327** | **290** | **285** | **290** | **146** | **2,718** |

Status of all 2,718 items: **Not started 2,718 · In progress 0 · Implemented 0 · Validated 0.**

## 6. UI kit and visual items (not Figma parity)

These items cover Illigma's own chrome: tokens, kit components and the Framer look. They are validated against Framer reference captures and the kit's behavior contracts, not against Figma behavior. They are not counted in the parity totals above.

| Spec | Prefix | Items | IDs | M0 | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 | P0 | P1 | P2 |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| [UI design system](../ui/design-system.md#7-checklist) | KIT | 124 | KIT-001…124 | 37 | 41 | 14 | 1 | 11 | 4 | 5 | 4 | 7 | 53 | 60 | 11 |
| [Framer visual reference](../ui/framer-visual-reference.md#13-visual-acceptance-checklist) | FVR | 36 | FVR-001…036 | 18 | 10 | 2 | 0 | 2 | 2 | 0 | 1 | 1 | 20 | 14 | 2 |
| **UI total** | | **160** | | **55** | **51** | **16** | **1** | **13** | **6** | **5** | **5** | **8** | **73** | **74** | **13** |

Status of all 160 UI items: **Not started.**

## 7. Integrity checks (run 2026-10-08)

| Check | Result |
| --- | --- |
| Duplicate IDs across all 13 checklists (2,718 parity + 160 UI = 2,878 definitions) | **None found.** Each of the 13 prefixes is used by one file only. |
| ID ranges | Contiguous in every file: 001 up to the item count, with no gaps. |
| Items without a milestone/priority tag | **None.** Two CP items (CP-217, CP-225) span several lines; their tags sit on a continuation line and are counted. |
| Ticked boxes `- [x]` | **None**, which is consistent with "Not started". |
| References to undefined checklist IDs | **Six, all in document headers.** `07-components-variants.md` says review pass 2 "added CP-244…CP-262". `08-variables-styles-design-systems.md` says its review added "DS-247 to DS-293". `09-prototyping.md` says its review "added items PR-276…PR-313". The files end at CP-243, DS-246 and PR-275. |
| References to undefined experiment IDs | `07-components-variants.md` cites E-37…E-47 in the body and E-48…E-53 in the header, but its §8 defines only E-01…E-36. `08-variables-styles-design-systems.md` names V-77…V-91 in its header, but §8 defines V-01…V-76. |
| Missing sections | The headers of 07, 08 and 09 refer to a review log in "§10". None of the three files has a §10. |

**Interpretation.** The review passes for 07, 08 and 09 were interrupted by usage limits. Their header notes were saved, but the items, experiments and §10 logs they describe were not. Treat those header notes as **not done**. The per-area review pass (`PLAN.md` §8, tasks RV-07, RV-08 and RV-09) must either restore the missing content or correct the headers. Until then, the counts in this file are authoritative.

### 7.1 Evidence strength (heuristic, for planning only)

This classification looks only at the evidence tags at the end of each item. A Help Center `[DOC]` tag almost always means that only a **search excerpt** was seen, not the article body.

| Area | Items with `[API]`, `[DOC…]` or `[OBS…]` | Items resting only on `[KNOW]` and/or `[SRC]` | Items with Illigma-requirement tags only |
| --- | ---: | ---: | ---: |
| CV | 108 | 154 | 4 |
| FR | 140 | 107 | 0 |
| AL | 132 | 117 | 0 |
| VC | 133 | 104 | 0 |
| PE | 155 | 97 | 0 |
| TX | 110 | 133 | 0 |
| CP | 123 | 120 | 0 |
| DS | 154 | 92 | 0 |
| PR | 154 | 114 | 7 |
| UX | 84 | 120 | 10 |
| IO | 128 | 74 | 44 |
| **Total** | **1,421** | **1,232** | **65** |

About 45 % of the items (1,232 of 2,718) rest only on the author's knowledge or third-party sources. Their tests cannot be trusted as parity tests until the matching live-Figma experiment has been recorded.

---

## 8. How to recount

Run these commands from the repository root with bash. Any change to an area file must leave checks 3–6 consistent; update this index in the same change.

```bash
# 1. Items per area by milestone and priority (each item has one _M<n>·P<n> tag)
for f in docs/parity/[0-9]*.md; do
  printf '%s ' "$f"
  grep -oE '_M[0-9]·P[0-9]' "$f" | sort | uniq -c | awk '{printf "%s=%s ", substr($2,2), $1}'
  echo
done
# 2. Global total of tags (2718 on 2026-10-08)
cat docs/parity/[0-9]*.md | grep -oE '_M[0-9]·P[0-9]' | wc -l
# 3. Item definitions (must equal check 2)
cat docs/parity/[0-9]*.md | grep -cE '^\s*- \[[ xX]\] \*\*[A-Z]+-[0-9]+\*\*'
# 4. Duplicate IDs across all checklists (expect no output)
grep -hoE '^\s*- \[[ xX]\] \*\*[A-Z]+-[0-9]+\*\*' docs/parity/*.md docs/ui/*.md \
  | sed -E 's/.*\*\*([A-Z]+-[0-9]+)\*\*/\1/' | sort | uniq -d
# 5. Referenced IDs that are not defined (2026-10-08: CP-244 CP-262 DS-247 DS-293 PR-276 PR-313; see §7)
comm -23 \
  <(grep -ohE '\b(CV|FR|AL|VC|PE|TX|CP|DS|PR|UX|IO|KIT|FVR)-[0-9]{3}\b' docs/*.md docs/parity/*.md docs/ui/*.md PLAN.md AGENTS.md README.md | sort -u) \
  <(grep -hoE '^\s*- \[[ xX]\] \*\*[A-Z]+-[0-9]+\*\*' docs/parity/*.md docs/ui/*.md | sed -E 's/.*\*\*([A-Z]+-[0-9]+)\*\*/\1/' | sort -u)
# 6. Ticked boxes (expect 0 until Validated items exist)
cat docs/parity/[0-9]*.md docs/ui/*.md | grep -cE '^\s*- \[[xX]\] '
```

From slice M0-02 onward, the parity-matrix tool also runs these checks in CI. It fails the build on a duplicate ID, an untagged item, a test that names an unknown ID, or a hand-ticked box with no evidence.
