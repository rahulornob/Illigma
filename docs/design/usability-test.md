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

## The 10 tasks

| # | Task (read aloud) | Start screen | Success = participant… | Journey |
|---|---|---|---|---|
| 1 | "Make a new design file and save it in your Design folder." | Home `96:19138` | clicks New design file, then Create file | 1 |
| 2 | "Add a phone-sized frame." | Empty canvas `96:26601` | chooses the Frame tool, then a Phone preset (or presses F) | 1 |
| 3 | "How do you know your work is saved?" | First frame `96:28247` | points to the save status in the title bar | 1, 6 |
| 4 | "Turn this button into a set with a small size." | Main component `96:34466` | uses Add variant, or Add property → Variant | 3 |
| 5 | "Make a colour that changes between light and dark." | Variant set `96:36486` | opens Variables, then creates a variable or mode | 3 |
| 6 | "Make this screen's background use the theme colour." | Bind fill `96:42118` | opens the fill's Variables tab and picks a variable | 3 |
| 7 | "Show this screen in dark mode only." | Frame mode `96:41049` | uses the Appearance mode button → Dark | 3 |
| 8 | "Make the button open the Home screen when tapped, then try it." | Prototype `96:44507` | drags the connection, then presses Present | 4 |
| 9 | "A developer needs the button's CSS. Get it for them." | Inspect `96:47901` | switches to Inspect and copies the code | 5 |
| 10 | "Go back to the version from before the hand-off." | Version history `96:54239` | opens version history and restores, or compares then restores | 6 |

## What we measure

- **Unaided completion** per task (no hints). Target: 8 of the 10 tasks for at least 4 of 5 participants.
- Time on task, wrong first clicks and recovery.
- After each task: "How easy was that?" (1–7).
- End: System Usability Scale (SUS). Target ≥ 75.

## Docked vs floating panels

Figma moved UI3 back to docked panels after beta feedback. Half the participants start with **floating islands** and half with **docked panels** (View menu, `96:64875`). They switch halfway and say which they prefer and why. Decision rule: if 4 or more of 6 prefer docked, docked becomes the default and floating stays an option.

## Questions to answer

1. Do Figma users find Variables from the left panel's Variables tab, or do they look elsewhere?
2. Is the autosave status enough reassurance without a Save button?
3. Do people understand local-only sharing (synced folders, phone preview over Wi-Fi) without a share link?
4. Is the floating layout comfortable for a full session?

## After the sessions

- Write the findings into this file: each problem, how many people hit it, its severity, and the fix.
- Fix the designs, re-run the design QA, then go to Phase 6 (approval gate).
