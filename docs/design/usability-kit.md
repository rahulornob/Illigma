# Usability test kit

Companion to [usability-test.md](usability-test.md). Everything needed to run the 5 real sessions.

## 1 · Recruiting post

> **Help test a new open-source design tool (45 min, remote)**
> We're building Illigma, a free, local-first design tool with Figma's editing model. We're looking for product and UI designers who use Figma every week to try early screens and think aloud. No preparation is needed, and it's not a test of you. Reply with your Figma experience and your time zone.

Places to post: design Slack and Discord communities, local design meetups, LinkedIn, Mastodon. If you can, offer a small thank-you (for example, a book voucher).

## 2 · Screener

| Question | Keep if |
|---|---|
| How often do you use Figma? | Weekly or more |
| How long have you used it? | Aim for a mix: under 1 year, 1–3 years, 3+ years |
| What do you mostly design? | Product or UI screens (not only illustration or slides) |
| Have you used Figma variables? | Mix of yes and no |
| Have you seen Illigma before? | No |
| Do you work at Figma or on Illigma? | No |

Target mix of 5: 2 design-system or product designers, 2 product or UI designers, 1 freelancer or junior.

## 3 · Consent (read aloud, then ask for a yes)

"Thanks for joining. We're testing the design, not you. There are no wrong answers. Please think aloud: say what you're looking for and what you expect. With your permission, I'll record the screen and audio. The recording is used only by the Illigma team to improve the design, is never published, and is deleted after 90 days. You can stop at any time. Is that OK?"

## 4 · Facilitator script

1. **Warm-up (3 min):** "What do you use Figma for? What do you like least about it?"
2. **Set-up (2 min):** share the Figma prototype in presentation mode, starting with the flow "Journey 1 · Create a file". Explain: "Some screens are clickable; for others, point and tell me what you'd do."
3. **Tasks (25 min):** read each task from [usability-test.md](usability-test.md) word for word. Don't help. If they are stuck for 2 minutes, note it as a fail, then say "Let's move on."
   - After each task, ask: "How easy was that, from 1 to 7?"
4. **Panels (5 min):** show "Docked panels" (`96:66946`) next to the floating layout. Ask: "Which would you rather work in all day? Why?"
5. **Trust (3 min):** "Where do you think this file lives? How would you get it onto your other computer?"
6. **SUS (3 min):** the standard 10-question System Usability Scale.
7. **Wrap-up (2 min):** "Anything you expected and didn't see?"

Neutral prompts: "What are you looking for?", "What do you expect to happen?", "Where would you go next?" Never say "Try the left panel".

## 5 · Note template (one per participant)

| Task | First click | Success (Y / N / assisted) | Time | Ease 1–7 | Quote or observation |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |
| 6 | | | | | |
| 7 | | | | | |
| 8 | | | | | |
| 9 | | | | | |
| 10 | | | | | |

Panel preference: floating / docked, and why. SUS score: ___. Top 3 problems: ___.

## 6 · Scoring

- **Pass:** at least 4 of 5 participants finish at least 8 of 10 tasks unaided (PRD: 80%).
- **Severity:** 3 = blocks the task, 2 = slows it or causes an error that gets recovered, 1 = cosmetic. Fix every severity 3 and 2 before Phase 6.
