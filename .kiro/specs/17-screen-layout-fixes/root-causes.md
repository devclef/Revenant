# Root causes and why the checks missed them

Input for the design of spec 17. Measured on production (`revenant.devclef.se`, read-only: nothing was sealed or recorded) and on a local build of `main` (`ba4000f7`) with a throwaway Postgres and the sealed personas. Probe scripts were in `/tmp/probe` and are not part of the repo. "Confirmed" means measured in a browser. "Likely" means read from the CSS and not yet isolated; task 1 of the design must isolate it before the fix.

## Causes

### D1 and D2: the step card keeps its paper for Seal and Wait (confirmed, not a leak from the desk)

- `src/components/live/stepper/live-steps.ts` `hasPrimaryCard()` returns true for `write`, `seal`, `wait`. `LiveStepper.tsx` gives the card `styles.card` (paper `--paper` `#f6ead4`, `stepper.module.css`), and only the Write step adds `.deskCard`, which removes the paper.
- Seal: `seal-step.module.css` `.step` is its own dark `#0b0912` surface with `max-width: 1240px; margin-inline: auto` inside the grid `.primary`. Measured at 1440x900: card 1360 wide (`rgb(246, 234, 212)`), `[data-seal-step]` 1040 wide at x 61. The panel does not fill the card. Likely sub-cause: an auto-margin grid item sizes to its content, and the press column (`container-type: inline-size`) adds no intrinsic width. Isolate in task 1.
- Wax: `press.module.css` `.wax` has `transform: scale(calc(0.15 + 0.85 * var(--press-progress)))`. At rest the progress is 0, so the wax is 0.15 of its width: 15 px (container 392) and 10 px (container 268). Confirmed. The button itself is 392x253, so a "press target is at least 44x44" test on the button passes. P1 does exactly that.
- Wait: `LiveWaitStep.tsx` renders `.panel` (paper, `live.module.css`) inside the paper card while `waiting`. `SealPage.tsx` `stepHeading("wait")` returns `<h1 class="liveHeading">`, whose colour is `--text` (white, desk text) in `live.module.css`. White on cream. The stepper also draws an `h2` "Wait" in `--ink`, so the card holds two headings from two surface assumptions.
- DEMO twice: `SceneShell demo` draws the Top_Bar chip, and `LiveWaitStep` renders `<DemoLabel />` inside the panel. Seal twice: `SealedEnvelopeView` draws the Envelope with a seal from the hash, and `LetterCard` draws a `WaxSeal` from the same hash (spec 06 U4.3).

### D3: the receipts column uses the Ghost's column cap on a phone (confirmed)

- `scene.module.css` sets `--content-column-max: min(34rem, 46vw)` on `.scene`. `receipts.module.css` `.receipts` uses it as `max-inline-size` with `margin-inline: auto`. At 390 px that is 179.4 px, centred, 89 px each side (measured). The 46vw cap exists to keep the column clear of the Ghost at 72% of the frame at 900 px and wider (see `.flowPersona` and the `@media (min-width: 900px)` block). The Ghost has left by the receipts step, so nothing needs the cap on a phone.
- The live demo uses the same variable, so it is equally narrow. The spec 16 row R10.6 asserts the live column equals the persona column (both 179.4 px) and passes.

### D4: the Ghost's layer ignores the intro text on a phone (confirmed)

- Below 600 px `.ghostLayer` is anchored to the document and the Ghost sits at about y 130..219 at 390x844. The Persona_Intro lines ("A letter from Maya", "Opens 5 November 2024") start at y 206. The Ghost's hem is drawn below the "Ghost_Body_Box" the checks use (they trim 12% at the bottom and 15.5% at the top).

### D5: Previous question assumes a dark surface (confirmed by reading)

- `recall/NavRow.module.css` `.previous` is `#ffffff` on transparent, and its header comment says it is that way "because the recall surface is the dark Scene and not paper". The recall card has been paper since spec 15/16 (`RecallPager`/`RecallReader` use `paper.paper`). Contrast of `#ffffff` on `#f6ead4` is about 1.2:1.

### D6: script focus on load matches `:focus-visible` (confirmed)

- The question heading is `tabindex="-1"` and takes focus when the Stage appears (`CeremonyRoot.tsx` `focusHeading`). `globals.css` and `RecallReader.module.css` hide the ring with `:focus:not(:focus-visible)`. In Chromium, script focus before any user input matches `:focus-visible`, so the rule does not apply and `.desk :focus-visible` / `.onPaper :focus-visible` (`ceremony.module.css`) draws a 2 px `rgb(31, 27, 22)` outline. Measured: active element `H2`, outline `2px solid`.

### D7: Break the seal places three things by three systems (likely)

- The figures are in the persona column (`max-width: min(28rem, 40vw)` for marks, `scene.module.css` line 645). The Seal group is `position: absolute` in `.marksLayer`, placed from the Ghost's geometry (`--ghost-cx`, `--ghost-w`, line 838), not from the column. The Ghost is at 72% of the frame. Measured gap figures to Seal group: 134 px.
- The Soil strip is drawn at 419..545 over the column's left half while the marks column runs 154..545, so the second figure line (y 419..440) is on the strip's top edge. Likely sub-cause: the Soil is anchored to the Scene root's bottom, the column is anchored from the top, and the marks content is not tall enough to reserve `--soil-clear`. Isolate in task 1.

## Why each check missed it

| Defect | What exists | Why it passed or did not fail |
|---|---|---|
| D1 slab | `layout-check` W/W1.6 measure the Write step. P1 (press-envelope) measures the Seal step. | Nothing compares a panel to the surface it sits on. P1 asks "largest element, a focusable button at least 44x44, the only orange control", measured on the button (392x253), not on the wax. |
| D1 wax | P1 | As above. The wax is a child of the button and is never measured. |
| D2 | T1 and TG2 (wait-envelope, wait-ghost) | They print "not reached" on every run (`note T1 ... fastest path not reached`). `journey-check` J9 stops before pressing the seal (its header says so). The live walk that seals with a virtual passkey runs only the spec 16 rows R10.1 and R10.6. |
| D2 contrast | `src/components/live/contrast.test.ts` and similar | They read hex values from CSS tokens and check named pairs. They never see that a heading uses the desk colour on a paper surface. No browser check reads a text node's colour against its real background. |
| D3 | W1 (letter-width), R10.6 | W1 does fail at 390 on the current build (`width=135.0px`), so a manual run exits 1. But `layout-check` is not in `ci.yml`, `scripts/check.sh` or any workflow, and the scheduled `journey-check` does not run it. R10.6 passes because it demands equality between two equally narrow columns. |
| D4 | G1 and GT1 | G1 skips text that has an opaque ancestor, to allow text on paper cards. The `.desk` wrapper has `rgb(11, 9, 18)`, so all text inside it is skipped. On the failing screen G1 returned 0 hits. GT1 does find it (`hits=2 "A letter from Maya"`) but GT1 is a polish row: it is neither in `SPEC15_CHECKS` nor passed with `--require`. Both use the trimmed body box. |
| D5 | none | No check compares a control's colour to its background. `Previous question` appears only from question 2, and the walks answer through it without measuring. |
| D6 | FC1, step-indicator rows, `checkHeadingRing` | FC1 checks that focus is on the heading, not that it draws a ring. The unit tests assert the CSS rule exists, not what Chromium does on load. |
| D7 | F1, F2, SG1, G2 | Soil-over-text (F2) is a blocker only when the text is not on an opaque panel. The figures sit in a panel, so it is reported as "paper panel overlaps the Soil strip (text is on the paper, so it reads)" at polish level. Nothing measures the distance between columns. |

Two further gaps apply to everything:

- `layout-check` and `journey-check` do not share a library. `journey-check` (production, every six hours) opens the right pages at the right sizes but measures only step name, sideways scroll, Motion_Control count and console errors (`evaluateLiveStep`).
- `layout-check` has 40+ rows, and most are polish. A run on the current build ended with `Blockers: 3  Polish: 105  Not reached: 96`. The polish list already held the D4 and D7 overlaps. Nobody triages 105 lines.
