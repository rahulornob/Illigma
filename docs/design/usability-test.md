# Usability test plan

Draft · 13 October 2026 · Phase 5 of the [design plan](PLAN.md)

**Goal:** check that people who already use Figma can do the core work in Illigma without help. PRD target: **80% of participants finish the 10-task script unaided.**

**Who runs it:** the Illigma designer with the user (project owner). Recruiting and sessions need real people, so this plan is ready to run but has not been run yet.

## Participants

- 5 working product designers who use Figma weekly. Mix: 2 with design-system work, 2 product/UI, 1 freelancer or student.
- 1 developer who reads designs (Inspect tasks only, optional sixth session).
- No Illigma team members and no one who has seen these screens.

## Setup

- **Prototype:** Figma file "Illigma", page "Illigma — Editor v1". Present the flows:
  - **Journey 1 · Create a file** starts at `96:19138` (Home → New design file → Create file → Frame tool → Phone preset → first frame → autosave).
  - **Journey 3 · Components and variables** starts at `96:34466` (main component → Add variant → Variables tab → manager → back → bind fill → frame mode).
- The other tasks use static screens. The facilitator shows the start screen and asks the participant to point and say what they would do. A correct first click or answer counts as success.
- 45 minutes per session, remote, screen and voice recorded with consent. Think aloud.

## Running the study (started 18 October 2026)

1. **Recruit:** post the recruiting text and use the screener from [usability-kit.md](usability-kit.md) in a plain form (Google Forms, Tally). Participants don't need a claude.ai account.
2. **Share the prototype:** in Figma, Share → "Anyone with the link can view", then copy the prototype link for the flow "Journey 1 · Create a file". The page has exactly two flows: Journey 1 (`96:19138`) and Journey 3 (`96:34466`).
3. **Run each session** with the facilitator script, and score it live in the tracker: https://claude.ai/artifact/NwKqftD1bVMWrUqpVMcYdf (source `docs/design/usability-tracker.html`). It computes unaided tasks per participant, the 4-of-5 verdict, average SUS and the panel preference. Use participant codes (P1, P2…), never names or emails.
4. **After 5 sessions:** ask Claude to read the tracker and write the findings into this file.

## The 10 tasks

| # | Task (read aloud) | Start screen | Success = participant… | Journey |
|---|---|---|---|---|
| 1 | "Make a new design file and save it in your Design folder." | Home `96:19138` | clicks New design file, then Create file | 1 |
| 2 | "Add a phone-sized frame." | Empty canvas `96:26601` | chooses the Frame tool, then a Phone preset (or presses F) | 1 |
| 3 | "How do you know your work is saved?" | First frame `96:28247` | points to the save status in the title bar | 1, 6 |
| 4 | "Turn this button into a set with a small size." | Task 4 start `96:72680` | uses Add variant, or Add property → Variant | 3 |
| 5 | "Make a colour that changes between light and dark." | Task 5 start `96:73332` | opens Variables, then creates a variable or mode | 3 |
| 6 | "Make this screen's background use the theme colour." | Task 6 start `96:76581` | opens the fill's Variables tab and picks a variable | 3 |
| 7 | "Show this screen in dark mode only." | Task 7 start `96:74921` | uses the Appearance mode button → Dark | 3 |
| 8 | "Make the button open the Home screen when tapped, then try it." | Task 8 start `96:75753` | drags the connection, then presses Present | 4 |
| 9 | "A developer needs the button's CSS. Get it for them." | Inspect `96:47901` | switches to Inspect and copies the code | 5 |
| 10 | "Go back to the version from before the hand-off." | Version history `96:54239` | opens version history and restores, or compares then restores | 6 |

## What we measure

- **Unaided completion** per task (no hints). Target: 8 of the 10 tasks for at least 4 of 5 participants.
- Time on task, wrong first clicks and recovery.
- After each task: "How easy was that?" (1–7).
- End: System Usability Scale (SUS). Target ≥ 75.

## Docked vs floating panels

Figma moved UI3 back to docked panels after beta feedback. Docked is now the default. Half the participants start docked and half with **floating islands** (`96:77383`). They switch halfway and say which they prefer and why. If 4 or more of 6 prefer floating, floating becomes the default again.

## Questions to answer

1. Do Figma users find Variables from the left panel's Variables tab, or do they look elsewhere?
2. Is the autosave status enough reassurance without a Save button?
3. Do people understand local-only sharing (synced folders, phone preview over Wi-Fi) without a share link?
4. Does the docked default hold up against floating with real users?

## Clean start screens

Each task starts from a fresh state; tasks do not continue from each other. Tasks 4–8 start from the screens in Figma section "22 · Test start screens" (`96:72680`, `96:73332`, `96:76581`, `96:74921`, `96:75753`). They show the state *before* the task (no menu open, nothing already done). The pilot showed that starting from "after" screens confuses people.

## Pilot results (simulated, 13 October 2026)

**This was not a real usability test.** Five AI agents each played a Figma user (design-system lead, startup product designer, agency power user, freelancer, junior designer) and did a first-click test from screenshots only, without seeing layer names. It finds obvious problems cheaply. It does **not** count toward the PRD target, and real people will behave differently.

| Measure | Result |
|---|---|
| Tasks with a confident, correct first click | about 7 of 10 per persona |
| Weakest tasks | 5 (create a light/dark colour), 6 (bind fill), 7 (frame mode): ease 3–5 |
| Strongest tasks | 3 (saved?), 8 (prototype), 9 (CSS), 10 (restore): ease 5–7 |
| Estimated SUS | 70–72 (target ≥ 75) |
| Panel preference | **Docked 5 of 5** ("no wasted gutters", "feels like Figma", "canvas edge predictable") |

### Findings and what changed

| # | Finding | People | Severity | Fix |
|---|---|---|---|---|
| 1 | Inspect values contradicted Design (padding 24/14 vs "24 all sides"; radius 36 vs 999) | 3 / 5 | 3 (hand-off trust) | **Fixed.** Design screens now show padding 24 and radius 999, matching Inspect and the CSS |
| 2 | Start screens for tasks 4–8 looked already done or had an unrelated menu open | 5 / 5 | 2 (test artefact) | **Fixed.** Clean start screens in section 22 |
| 3 | Variables and modes hard to find; the sun-moon button gives no clue; "Theme · Dark values" in the picker reads like a mode switch | 5 / 5 | 2 | **Fixed in part.** A "Variable mode (Light / Dark)" label above the mode control, "Variable mode ▸" in the right-click menu, the picker's select now reads "Collection: Theme" with a note that swatches show this frame's mode. Re-test with real people |
| 4 | "Place an image or SVG" and "Find any action" both showed ⌘K | 5 / 5 | 1 | **Fixed.** Place image is ⇧⌘K |
| 5 | Unclear where a new file is saved | 5 / 5 | 2 | **Fixed in part.** The button reads "New design file…" (the dialog asks for the folder). The save status shows the full path and file name everywhere |
| 6 | Unclear whether Restore overwrites current work | 4 / 5 | 2 | **Fixed.** The banner says "Restoring saves your current work as a version first" |
| 7 | "Kept from conflict copy" sounded like lost work | 2 / 5 | 1 | **Fixed.** Renamed "Mac mini's copy (sync conflict) · kept, nothing lost" |
| 8 | No phone presets visible before drawing a frame | 4 / 5 | 1 | **Fixed in part.** The empty-canvas hint says "Draw a frame, then pick a device size" (presets appear with the Frame tool, `96:27318`) |
| 9 | Present (▷) starts at the flow start, not the selected frame | 3 / 5 | 1 | Open: add "Present from selected frame" to the ▷ menu |
| 10 | Versions live inside the file: if the file is damaged, history goes too. Autosaves expire after 30 days | 4 / 5 | 2 (trust) | **Decided: keep all autosaves by default.** Preferences shows "Forever"; the history footer says everything is kept until you delete it |
| 11 | Profile avatar "R" suggests an account | 2 / 5 | 1 | Open: tooltip "Local profile: your name on comments and versions" |
| 12 | Delete version sits next to Rename with no confirmation | 2 / 5 | 1 | It can be undone (⌘Z). Leave, and watch for it in real sessions |

### Docked vs floating

All five personas chose docked panels. **Decided (13 October 2026): docked panels are the default**, and floating islands stay a View option. All editor screens were converted. The real sessions still compare the two; if most real participants prefer floating, we switch back.

## After the sessions

- Write the findings into this file: each problem, how many people hit it, its severity, and the fix.
- Fix the designs, re-run the design QA, then go to Phase 6 (approval gate).
