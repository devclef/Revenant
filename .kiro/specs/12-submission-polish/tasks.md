# Implementation Plan: 12 Submission polish

## Overview

Spec 12 repairs what a judge sees in the first five minutes of `/demo/live` and finishes the paperwork for Kiroween 2026. It adds no feature. Group X and Z (the live reveal and the single comparison rule) come first and are P0. Groups W, K and H follow, then the paperwork (D), with the Live_Walk (Q) around them. Every task is one an agent picks up. There are no owner tasks. Ownership (G4) was settled by the "init spec 12" commit, so no task changes it.

| Group | Tasks | What | Roles |
|---|---|---|---|
| X, the live reveal (P0) | 1, 3, 4 | Reveal_Host and one motion control (1); the Close (3); six-step stepper (4) | frontend-dev |
| Z, one comparison rule (P0) | 2, 5 | `isSameFigure` (2); Single_Figure_View (5) | data-dev, frontend-dev |
| Q, the walk | 6, 18 | Live_Walk setup (6); final Live_Walk on merged `main` (18) | platform-dev |
| W, the Write step (P1) | 7 to 9 | Letter_Field, chips, one-sentence rehearsal (7); question rows (8); action row and blank own number (9) | frontend-dev |
| K, the receipt picker (P1) | 10, 11 | Precision, Short_Dates, one note (10); region groups (11) | frontend-dev |
| H, landing (P1) | 12, 13, 14 | Full-width sections (12); ritual row (13); layout-check thresholds and J-check (14) | frontend-dev, platform-dev |
| D, paperwork (P1) | 15 to 17 | Video script (15); Gaps_Report (16); README (17) | platform-dev |

Each task is one GitHub issue and one PR for one role. Each PR stays under `max_changed_lines` (5,000) as `.github/agents.json` counts it, and inside its role's paths plus `shared` (G1.1, G3.2). Sub-tasks listed under a task (the property tests, marked `*`) belong to the same issue and the same PR.

Follow `design.md` in this folder for file names, constants, copy, values and algorithms, and `requirements.md` for the rules. Every rule of `.kiro/steering/` and of specs 02 to 11 still holds unless requirements.md "Rules this spec replaces" names it. The design's "QA browser steps" table has a Task column that is off by one for several rows; the "QA rows by task" note below is the one to use.

"Depends on" lists only spec 12 task numbers (G3.5).

## Queue order and dates

The queue order for groups X and Z is fixed (G3.1, G3.6):

1. Task 1 (X1 and X2, the reveal host) first. Nothing is queued ahead of it, not even the Live_Walk setup.
2. Task 2 (Z1, `isSameFigure`).
3. Task 3 (X3, the Close).
4. Task 4 (X4, six steps).
5. Task 5 (Z2, the Single_Figure_View).

Every group X and Z task has a lower number than every group W, K, H and D task. The Live_Walk setup (task 6) comes after them and is a dependency of none of them. If the setup runs late, X and Z merge first and the walk runs on them afterwards. The README (task 17) is the last task before the final Live_Walk (task 18).

| Date | Gate |
|---|---|
| 18 November 2026 | Groups X and Z (tasks 1 to 5) merged. |
| 27 November 2026 | Feature freeze. Every task is planned to be merged. A task worked but not merged by the end of the day is closed unmerged with the reason, in the cut order below. |
| 4 December 2026, 2:00 PM PT | Submission. |
| 16 December 2026 to 29 January 2027 | Judging. The site keeps running. |

## Rules for every task

- **Branch and PR.** The dispatcher creates `agent/<role>/issue-N` and the PR "Closes #N". Do not push to `main` or merge. After a hook failure, make a new commit; do not amend.
- **Scope (G1.1).** Change only files that match your role's paths in `.github/agents.json` (or `shared`) and are listed in your task's Scope, plus new `*.test.ts(x)` files next to the code they test. Check your diff before you finish.
- **Hard boundaries (G1.2, G1.5).** Frontend-dev tasks change nothing under `src/app/api/`, `src/lib/crypto/`, `src/lib/seal-format/`, `src/lib/letter-store/`, `src/lib/db/` or `drizzle/`. No task changes a crypto primitive, key step, header field or `format_version`, a line of `src/lib/seal-format/v1/payload.ts`, the Helm chart or an environment variable. Each PR states this with a diff check.
- **Paths a task may edit by role (G1.3, G4).** platform-dev owns `README.md`, `docs/video-script.md`, `docs/writeup-gaps.md`, `tools/qa/**` and `scripts/check-js-budget.mjs`, and not the rest of `docs/`. `docs/kiro-writeup.md` belongs to no role and stays byte-identical. Nobody edits `.kiro/**`, `.github/**`, `tools/agents/**`, `tools/dispatcher/**`, `tools/hooks/**` or `scripts/check.sh`. If `pr_policy` refuses a path a task needs, the task reports the refusal in its PR description and changes none of the ownership files (G4.7).
- **Privacy and size (G1.4).** CSP header byte-identical. No request to another origin. New code writes nothing to `localStorage`, `sessionStorage`, IndexedDB, cookies, the URL path, the query string or the fragment. No new `dependencies` entry, animation library, WebGL, font, sound or vibration cue. Every route stays inside `scripts/check-js-budget.mjs`; a task that would push a route over stops and reports it.
- **Copy (G1.6).** Every string in its feature folder's copy module, exactly as design.md "Copy" gives it. Second person, at most 25 words per sentence, no exclamation mark, no pun, no Scoring_Words_Always; no Scoring_Words_Scene in the Scene_Copy_Modules. Nothing grades the testimony or a figure. Each copy task attaches the `node tools/hooks/tone-check.mjs` result for every copy file it changed and a search of the rendered Our_Copy of every page it changed showing no Retired_Phrase remains (G2.6).
- **Accent and contrast (G1.7, G1.8).** The Accent marks only the reader's own answer, the main buttons, the wax and the focus ring. Every text and number meets WCAG 2.2 AA (4.5:1 body, 3:1 large text and controls) on its surface.
- **Neutrality.** Nothing scores, diffs, highlights, pairs, counts, summarises or explains a gap between testimony and letter. Up and down get the same visual treatment.
- **Data integrity.** Every figure shown carries value, unit, region, period, source and `retrieved_at`, with its period next to it. Nothing invented, estimated, converted or filled. Display rounding changes only displayed text, never a stored or sealed value.
- **Motion.** Every motion has its Skip and Calm_Mode path, runs only under `prefers-reduced-motion: no-preference`, and changes only `transform` and `opacity`.
- **Tests (G2.1, G2.2).** Vitest, `renderToStaticMarkup`, every `fetch` stubbed, no network, `DATABASE_URL` unset. Property tests use fast-check with `numRuns` at least 100 and the tag `// Feature: 12-submission-polish, Property N: <title>`, using the title in design.md "Correctness Properties". The Live_Walk (tasks 6 and 18) is the one run that uses a browser.
- **Evidence (G2.3, G2.5).** The PR description states the final commit SHA with the `bash scripts/check.sh` exit status and PASS or FAIL; every route budget from `node scripts/check-js-budget.mjs` after `npm run build`; every earlier-spec test changed or retired with the reason; every asset added with its size in bytes. Write "none" for an empty list.
- **Screenshots (G2.4).** For a screen change, PNG shots of every Stage or page the task changes at 1440×900 and 390×844, named `<stage-or-page>-<width>x<height>.png`, and the same set with `prefers-reduced-motion: reduce`, named `<stage-or-page>-<width>x<height>-reduced.png`. Phone shots are First_Viewport captures, plus one full-page capture per page.
- **QA (G2.7).** QA runs the rows of design.md "QA browser steps" the task lists, found with `^\| 12 \|`. Rows that need a passkey are run by `npm run live-walk` (from task 6 on), and QA quotes its result lines. The QA prompt still limits browser screenshots to 12 and forbids `fullPage`; those limits apply to QA's own browser, not to the script's output.
- **After the merge (G3.3).** `bash scripts/check.sh` passes on `main`, and `/`, `/demo`, `/demo/live`, `/l/[id]` and every persona page load without error.
- If `design.md` and the code on `main` disagree, re-read the code, keep the design's behaviour, and say what you changed. If something is unclear, ask in the issue. Do not guess.

## Cut order (G3.4)

If the 27 November freeze arrives first, cut in this order:

1. K4 (task 11): the picker shows one list with the single Picker_Note and no region headings.
2. The 600 to 1023 px band of W1.2 (inside task 7): the field uses the 6-line minimum from 600 to 1023 px, as it does below 600 px.
3. H2 (task 13): the ritual cards stay as they are on `main`.

Never cut: anything in G, X, Z, Q1, Q2, W1 (apart from that band), W3, W5, K1 to K3, H1, D1 or D2. W5 (inside task 9) and D2 (task 15) are never cut. When a task is cut, the README (task 17) and the video script (task 15) must not claim it.

## Tasks

### Group X: the live reveal (P0), target 18 November 2026

- [x] 1. X1 and X2 · Reveal_Host, full-width dark reveal and one motion control
  - Agent: `frontend-dev` · Depends on: none · Estimated size: ~1,400 changed lines
  - Queue position: first. Nothing is queued ahead of this task, not even task 6.
  - Scope: `src/components/live/stepper/LiveStepper.tsx`, `src/components/live/stepper/live-steps.ts` (only `StepView.host`), `src/components/live/stepper/LiveWaitStep.tsx` (or the path that holds it on `main`), `src/components/live/live.module.css`, `src/components/live/stepper/stepper.module.css`, `src/components/reveal/OpeningFlow.tsx`, `src/components/reveal/reveal.module.css`, `src/components/ceremony/CeremonyRoot.tsx`, `src/components/ceremony/live-reveal-contrast.test.ts` (new), and the `*.test.ts(x)` for each file above.
  - Design sections: "The live reveal, before and after", "Why the reveal is full width on the persona page and was not on the live page", "X1. The Reveal_Host", "X2. One motion control", "Data Models" (Reveal host).
  - Acceptance:
    - Before the first commit the task reproduces the defect: screenshots of `marks`, `letter`, `figures` and `close` from `main` at 1440×900 and 390×844, and a PR-description note naming the wrapper that boxes the reveal and the component behind each of the four symptoms (X1.1).
    - `LiveStepper` renders `<div data-reveal-host>` after the Primary_Card from the first render and passes `host` down. `LiveWaitStep` mounts the Opening_Flow into it with `createPortal` once `flowMounted(step, done)` is true. The target never changes, so the flow never remounts (X1.2).
    - The Primary_Card is rendered for `write`, `seal` and `wait` only. The `.letterColumn` wrapper goes.
    - `OpeningFlow` in embedded mode carries the class `flowLive` and passes `controls="host"`. `CeremonyRoot` accepts `"topbar" | "region" | "host"`; `"host"` renders no Calm or Skip in the region and does not switch the announcement to persona step lines. `/l/[id]` (not embedded) is unchanged (X2.2).
    - `reveal.module.css` gains the `flowLive` rules beside the `flowPersona` ones: a centred column of at most 40rem until the `letter`, `figures` and `close` Stages, then `max-width: none`, with `padding-inline: 0` below 900 px for those three. The persona classes are not edited (X1.9).
    - At 1440×900 the Letter_Block is 560 to 760 px wide and wraps at word boundaries; at 390×844 it is at least 300 px wide; no horizontal scroll on the document or any card (X1.3, X1.4).
    - The Fingerprint lines are grids inside `[data-reveal-host]`: four groups per line at 600 px and wider, two below, never split, full value in the document. The persona Fingerprint is unchanged (X1.6).
    - Every text class in the live reveal meets G1.8 on its surface, including the "Questions you left for yourself" heading and the persona link (X1.5, X1.7). `live-reveal-contrast.test.ts` renders `marks`, `letter`, `figures` and `close`, reads the CSS tokens, and prints every ratio.
    - The `/demo/live` page shows exactly one Motion_Control at every step and Stage, and the persona pages keep exactly one (X2.1, X2.6). A table test counts toggles in the markup of each step and each persona Stage (X2.7).
    - The order stays testimony, then the letter, then any numbers, and the letter text is one unchanged text node (X1.10). Reduced motion and Calm_Mode work as before (X1.11, X2.3, X2.4).
    - The persona reveal looks and behaves as on `main`; the layout check passes for Maya and Tomás at both widths (X1.9).
  - Tests: the contrast test above; the Motion_Control table test; example tests that the host is a sibling of the card, that the flow root carries `flowLive`, and that the persona root does not.
  - Earlier-spec tests changed or retired: `live/stepper/five-steps.property.test.ts` and `LiveStepper*.test.tsx` only if the card structure changes an asserted value (the six-step change is task 4); `LiveWaitStep.test.tsx`, `ceremony/CeremonyRoot.test.tsx`, `reveal/OpeningFlow*.test.tsx`; name each with the reason.
  - Copy evidence (G2.6): none, no copy changes.
  - QA shots: `marks`, `letter`, `figures` and `close` of a Live_Letter and of both fuel personas at 1440×900 and 390×844, with and without reduced motion.
  - QA steps: 12-01, 12-02, 12-03, 12-04, 12-05.
  - Production_Check: after the rollout, seal a 30-second letter on `https://revenant.devclef.se/demo/live`, unlock and break the seal. Pass: the reveal is full width on the dark scene, the fingerprint wraps in clean rows, one Calm control shows.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: X1.1–X1.11, X2.1–X2.7_

- [x] 2. Z1 · `isSameFigure`
  - Agent: `data-dev` · Depends on: none · Estimated size: ~250 changed lines
  - Scope: `src/lib/figures/same-figure.ts` (new), `src/lib/figures/index.ts` (export only), and the `*.test.ts` for each file above. `computeChange`, `format-change.ts` and `decimal.ts` are not edited.
  - Design sections: "Z1. `isSameFigure`", "Single_Figure_View" (the diagram), "Error Handling" (unparseable value, revised figure).
  - Acceptance:
    - [ ] 2.1 Implement `isSameFigure(then, now)`
      - Returns true when both figures are `kind: "official"`, `source`, `series_id`, `unit`, `region` and `period` are equal strings, and the values are equal as exact decimals (`isZero(sub(parseDecimal(a), parseDecimal(b)))`). No tolerance, no rounding, no `Number` (Z1.1, Z1.5).
      - An unparseable value returns false, so the existing `computeChange` path decides (Z1 Error Handling).
      - A revised figure (same period, different value) is not a Same_Figure. A different period is not a Same_Figure, so a zero change across two periods is still computed (Z1.3, Z1.4).
      - The file is covered by the existing no-number source scan (`no-number.test.ts`).
      - _Requirements: Z1.1–Z1.5_
    - [ ]* 2.2 Write property test for `isSameFigure`
      - **Property 3: Same_Figure is exact, symmetric and reflexive**
      - Include `"3.40"` against `"3.4"` (true) and a last-digit difference (false).
      - **Validates: Requirements Z1.1, Z1.5, Z1.6**
  - Earlier-spec tests changed or retired: none.
  - QA shots: none. QA steps: none.
  - Production_Check: none (no screen change; the use is in task 5).
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: Z1.1–Z1.6_

- [x] 3. X3 · The Close is honest and legible
  - Agent: `frontend-dev` · Depends on: 1 · Estimated size: ~400 changed lines
  - Scope: `src/components/live/LiveLockNote.tsx`, `src/components/live/live.module.css` (remove `.lockNote` and `.lockNote p` only; `.lockNoteLink` stays), `src/components/ceremony/close/close.module.css`, `src/components/reveal/copy.ts` (delete `lockNote` and `lockNoteLink` only), and the `*.test.ts(x)` for each file above.
  - Design sections: "X3. The Close".
  - Acceptance:
    - `LiveLockNote` renders in the dark-scene text colour with new `liveNote` and `liveNoteLink` classes in `close.module.css`: `--text` on `--bg`, the link underlined, a 3 px focus ring in `--accent` offset 3 px, `min-height: 44px` below 600 px (X3.3).
    - `REVEAL_COPY.lockNote` and `REVEAL_COPY.lockNoteLink` are deleted with the tests that read them. A test asserts "This letter was locked for 30 seconds." appears exactly once in the live Close markup (X3.1).
    - With official figures the Close shows `LIVE_COPY.lockNoteComparison` and the persona link; with none it shows the persona link alone. The link leads to `/demo` (X3.2).
    - No exclamation mark and no judgement of the testimony (X3.4).
  - Tests: example tests for the once-only sentence, the comparison line with and without official figures, the link target and its 44 px rule.
  - Earlier-spec tests changed or retired: `live/LiveLockNote.test.tsx`, `reveal/copy.test.ts`; name each with the reason.
  - Copy evidence (G2.6): tone-check for each changed copy file; Retired_Phrase search of the rendered live Close.
  - QA shots: `close` of a Live_Letter with and without a figure at both widths, with and without reduced motion.
  - QA steps: 12-06.
  - Production_Check: seal and open a 30-second letter. Pass: the lock sentence shows once, the persona link is readable and underlined.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: X3.1–X3.4_

- [x] 4. X4 · The stepper says "Break the seal" until the seal is broken
  - Agent: `frontend-dev` · Depends on: 1 · Estimated size: ~700 changed lines
  - Scope: `src/components/live/stepper/live-steps.ts`, `src/components/live/stepper/LiveStepper.tsx`, `src/components/live/stepper/stepper.module.css` (only if six items need a rule), `src/components/live/SealPage.tsx` (or the path that holds it on `main`), and the `*.test.ts(x)` for each file above.
  - Design sections: "Stage to step", "Phone step names", "X4. Six steps", "Data Models" (Live_Stepper state).
  - Acceptance:
    - [ ] 4.1 Six steps and the `STAGE` action
      - `LIVE_STEPS` is `write, seal, wait, testify, break, receipts`. `LIVE_STEP_NAMES` takes "Break the seal" from `CEREMONY_COPY.steps[1]` (X4.1).
      - `stepForStage(stage)` is a pure function: `marks` and `seal` give `break`; `letter`, `figures` and `close` give `receipts`; earlier Stages give `null`. `stepForFlowPhase` keeps `testify` for `recall`, `submitting` and `submit_failed` and returns `null` for `reveal` (X4.7).
      - The reducer handles `STAGE` by storing the Stage and applying `GOTO` to its step in one update. `GOTO` still moves forward only. Back is never offered after the seal is stored (X4.6).
      - `SealPage` provides `StageReportContext` and dispatches `STAGE`. `CeremonyRegion` is not changed.
      - The Skip_Link on `marks` moves the indicator to "See the receipts" in the same update that moves the Stage to `letter` (X4.4).
      - The indicator shows every item at both widths; at 480 px and below the numbers stay visible, the current name shows, and the other names stay in the accessibility tree. The PR notes this reading of X4.5 (Open decision 3). The current item has `aria-current="step"` (X4.5).
      - Wait is 3 of 6.
      - _Requirements: X4.1–X4.7_
    - [ ]* 4.2 Write property test for the indicator
      - **Property 1: The indicator has exactly one current item, and Break the seal holds until the seal is broken**
      - **Validates: Requirements X4.1, X4.2, X4.3, X4.8**
    - [ ]* 4.3 Write property test for the reducer
      - **Property 2: Reported Stages never move the step back**
      - **Validates: Requirements X4.3, X4.4, X4.6**
  - Earlier-spec tests changed or retired: `live/stepper/five-steps.property.test.ts`, `live-steps.test.ts`, `LiveStepper*.test.tsx`, `LiveWaitStep.test.tsx` (five to six); name each with the reason.
  - Copy evidence (G2.6): tone-check for each changed copy file; Retired_Phrase search of the rendered `/demo/live`.
  - QA shots: every step of `/demo/live` at both widths, with and without reduced motion; the stepper at `marks` and at `letter`.
  - QA steps: 12-07.
  - Production_Check: walk `/demo/live` to `marks`. Pass: six items, "Break the seal" is current; after the break "See the receipts" is current.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: X4.1–X4.8_

### Group Z: one comparison rule (P0), target 18 November 2026

- [x] 5. Z2 · The Single_Figure_View
  - Agent: `frontend-dev` · Depends on: 2 · Estimated size: ~700 changed lines
  - Scope: `src/components/reveal/receipt-kind.ts` (new), `src/components/reveal/ReceiptCard.tsx`, `src/components/reveal/FiguresThenNow.tsx`, `src/components/reveal/copy.ts` (add `nothingToCompare` only), `src/components/reveal/reveal.module.css` (only if the card needs a rule), and the `*.test.ts(x)` for each file above. `computeChange` and its `allowSamePeriod` option are not edited.
  - Design sections: "Single_Figure_View", "Z2. The Single_Figure_View", "Data Models" (Receipt kind), "Copy" (`nothingToCompare`).
  - Acceptance:
    - [ ] 5.1 `receiptKindFor` and the Single_Figure_View card
      - `receiptKindFor(then, now, change)` returns `"no_now"` with no now figure, `"single"` exactly when `isSameFigure` is true, otherwise `"compared"` or `"not_comparable"` as `computeChange` gives today. A revised figure takes the not-comparable card (Z1.3, Z1.4).
      - `FiguresThenNow` switches on it per figure. A Same_Figure card and a compared card may share a list; each Same_Figure card prints its own Nothing_To_Compare_Line (Z2.7, Z2.8).
      - `ReceiptCard` takes a `single` prop and draws the Short_Name heading, "Your answer" once, the one figure row (value at Display_Precision, unit, period, region, provenance), the line "This is the same record as the one you sealed, so there is nothing to compare yet." and the source control. No "Then:" or "Now:" labels, no Number_Line, no change, no percentage, no formula, no direction word (Z2.1–Z2.3).
      - The As_Published_Value stays in the source details (Z2.4). No colour or icon implies a direction (Z2.6).
      - The Reveal still reaches the Close and the Step_Indicator completes (Z2.9).
      - _Requirements: Z2.1–Z2.9_
    - [ ]* 5.2 Write property test for `receiptKindFor`
      - **Property 4: A figure gets the Single_Figure_View if and only if it is a Same_Figure**
      - Include a zero change across two periods (`compared`) and a revision (`not_comparable`).
      - **Validates: Requirements Z1.3, Z1.4, Z2.7**
    - [ ]* 5.3 Write property test for the Single_Figure_View markup
      - **Property 5: The Single_Figure_View shows the figure once and prints no change**
      - Assert none of `0.000`, `0.0%`, `unchanged`, `rose`, `fell`, the formula element, a Number_Line, or a Then and Now label pair.
      - **Validates: Requirements Z2.1, Z2.2, Z2.3, Z2.4, Z2.5, Z2.10**
  - Earlier-spec tests changed or retired: `reveal/FiguresThenNow*.test.tsx`, `ReceiptCard*.test.tsx`, `reveal/copy.test.ts`; name each with the reason.
  - Copy evidence (G2.6): tone-check for `reveal/copy.ts`; Retired_Phrase search of the rendered `figures` Stage. The line contains no "good", "bad", "same price", "no change" or "unchanged" (Z2.5).
  - QA shots: `figures` of a Live_Letter with one figure (a Same_Figure) and of Maya (a compared figure), at both widths, with and without reduced motion.
  - QA steps: 12-08.
  - Production_Check: seal a 30-second letter with one figure, open it. Pass: the figure shows once with its period and the nothing-to-compare line; no "0.000", "0.0%" or formula. Maya's receipts still show then, now and the change.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: Z1.3, Z1.4, Z2.1–Z2.10_

### Group Q: the walk

- [x] 6. Q1 and Q2 · Live_Walk setup
  - Agent: `platform-dev` · Depends on: none · Estimated size: ~800 changed lines
  - Queue position: after tasks 1 to 5. It is a dependency of none of them (G3.6). If it runs late, X and Z merge first and the walk runs on them afterwards.
  - Scope: `src/test/integration/live-walk.test.ts` (shared), `package.json` (one script; shared), and the `*.test.ts` for the walk helpers. No product file.
  - Design sections: "Q1 and Q2. The Live_Walk", "QA browser steps" (setup).
  - Acceptance:
    - `package.json` gains `"live-walk": "WALK=1 vitest run src/test/integration/live-walk.test.ts"` and nothing else (no new `dependencies` entry).
    - The walk runs on `npm run build` and `next start`, against a local PostgreSQL with migrations applied, `RP_ID=localhost`, `APP_ORIGIN=http://localhost:3000`, in headless Chromium with a virtual authenticator that reports PRF support (Q1.1).
    - It covers, in order, at 1440×900 and 390×844: Write (choose an Occasion, write a letter, edit a question, remove one with the Remove_Icon, open the Receipts_Disclosure, leave an own-number row blank); Press the seal; Wait; unlock; Testify; Break the seal (press and hold, the Seal_Button, and the Skip_Link); the letter; the receipts; the Close (Q1.2). Steps that depend on tasks not yet merged are recorded as expected-blocked, not failed.
    - Two variants per width (no figure, one figure), plus one run under `prefers-reduced-motion: reduce` per width (Q1.3, Q1.4).
    - Step_Shots go to `qa-shots/live-walk/`, named `live-<nn>-<step>-<w>x<h>[-reduced].png`, with `<step>` one of `write`, `write-receipts`, `seal`, `wait`, `unlock`, `testify`, `marks`, `letter`, `figures`, `close`. Full-page captures for `letter`, `figures` and `close`. Each is taken after the Stage settles (the Skip control is gone and `data-ceremony` has not changed for 300 ms) (Q2.1–Q2.5).
    - The script lists every expected Step_Shot by name and prints FAIL for a missing one (Q2.6).
    - It records per step pass or fail, the observation, the Step_Shot names, and for each defect the step, expected result, observed result and suspected file (Q1.5).
    - It fails on: horizontal scroll on the document; clipped text; a Motion_Control count other than 1 (`button[aria-label*="motion" i]`); a current Step_Indicator item that disagrees with the step; contrast below G1.8 computed from real colours; "0.000", "0.0%" or "unchanged" in the final reveal; a console error (Q1.6).
    - The PR says whether the replay can run in CI without a browser (it is expected not to).
  - Tests: the replay test only. It is skipped unless `WALK=1`.
  - Earlier-spec tests changed or retired: `live-walk.test.ts` extended; name what changed.
  - QA shots: the walk's own screenshots. QA steps: none (QA runs `npm run live-walk` and quotes its result lines).
  - Production_Check: none (a local rehearsal; it does not prove any phone's passkey provider supports PRF).
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: Q1.1–Q1.7, Q2.1–Q2.7_

### Group W: the Write step reads as a letter (P1)

- [x] 7. W1, W2 and W4 · Letter_Field, Occasion chips, one-sentence rehearsal
  - Agent: `frontend-dev` · Depends on: 5 · Estimated size: ~1,100 changed lines
  - Scope: `src/components/live/letter-field.module.css` (new), `src/components/live/WriteForm.tsx`, `src/components/live/OccasionPicker.tsx`, `src/components/live/constants.ts` (`LETTER_FIELD_ROWS`), `src/components/live/copy.ts` (`rehearsalLine`, `intro`), `src/components/live/live.module.css`, `src/test/serif-scope.test.ts` (shared; allow the second module), and the `*.test.ts(x)` for each file above.
  - Design sections: "W1. The Letter_Field", "W2. Occasion chips", "W4. One sentence", "W1.6: viewport arithmetic", "Constants", "Copy".
  - Acceptance:
    - The Letter_Field uses `font-family: var(--font-serif)`, line height 1.6, `padding: 1rem`, a paper background and `--ink` text. `--letter-lines` is 6 below 600 px, 8 from 600 to 1023 px and 10 from 1024 px; `min-height: calc(var(--letter-lines) * 1lh + 2rem + 2px)` with an `em` fallback where `lh` is unsupported. `LETTER_FIELD_ROWS` becomes 6 (W1.1, W1.2). The 600 to 1023 px band is the second cut item: if cut, that band uses 6.
    - The growth effect is unchanged. A CSS `min-height` beats the inline `height`, so the minimum holds; past the cap the field scrolls inside itself (W1.3). Label, count against 5,000, validation rule and placeholder (the Occasion starter, not stored) stay (W1.4, W1.5).
    - At 1440×900 the chips and the top of the field are inside the First_Viewport. The PR attaches the measured positions, including Next's bottom, which is a note and not an assertion. At 390×844 the field's top and at least 6 lines are in view, Next is one short scroll away, and 360×640 has no sideways scroll (W1.6–W1.8).
    - The chips sit in one `flex-wrap` row, 32 px tall at 600 px and wider and 44 px below, pressed chip with `aria-pressed`, a leading `✓` (`aria-hidden`) and a 2 px border that may use the Accent. The legend is visually hidden but available to assistive technology. Occasion rules of spec 11 L2.2 to L2.6 are unchanged (W2.1–W2.6).
    - `rehearsalLine` reads "This is a rehearsal: a real letter stays sealed for months, and this one opens in 30 seconds." `intro` reads "This letter is sealed in your browser with your own passkey." No other string on the Write step says the demo is short. The line shows once on Write and once on Wait, and on no other page (W4.1–W4.5).
    - `serif-scope.test.ts` allows `--font-serif` in `reveal.module.css` and `live/letter-field.module.css` only.
  - Tests: example tests for `--letter-lines` at the three bands (W1.9), the chip sizes, the one-sentence and at-most-25-words rule, once per step and on no other page.
  - Earlier-spec tests changed or retired: `live/constants.test.ts`, `copy.test.ts`, `rehearsal-line.property.test.ts`, `write-fit.test.ts`, `OccasionPicker.test.tsx`, `src/test/serif-scope.test.ts`; name each with the reason.
  - Copy evidence (G2.6): tone-check for `live/copy.ts`; Retired_Phrase search of the rendered `/demo/live` and `/seal`.
  - QA shots: the Write step of `/demo/live` and `/seal` at both widths, plus 360×640, with and without reduced motion.
  - QA steps: 12-09, 12-10, 12-11, 12-12.
  - Production_Check: open `/demo/live` at 1440×900 and 390×844. Pass: a tall serif field, chips in one small row, one rehearsal sentence.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: W1.1–W1.9, W2.1–W2.6, W4.1–W4.5_

- [x] 8. W3 · Question rows and the Remove_Icon
  - Agent: `frontend-dev` · Depends on: 7 · Estimated size: ~600 changed lines
  - Scope: `src/components/live/AuthorQuestions.tsx`, `src/components/live/author-questions.ts`, `src/components/live/copy.ts` (`authorQuestionRemoved`, `authorQuestionRemove`), `src/components/live/live.module.css`, and the `*.test.ts(x)` for each file above.
  - Design sections: "W3. Question rows", "Data Models" (Write draft helpers), "Copy".
  - Acceptance:
    - [ ] 8.1 Compact rows, Remove_Icon and focus after removal
      - Each row is one line: a small "Question {n}" label, an auto-sizing `textarea` (`rows=1`, grows with its text, `resize: none`), and the Remove_Icon. A 200-code-point question is fully visible with no ellipsis or horizontal scroll at 1440×900 and 390×844 (W3.1, W3.2).
      - The Remove_Icon is a `button type="button"` with an `aria-hidden` "×" and `aria-label` from `authorQuestionRemove`, no visible text, 44×44 px below 600 px and 32×32 px above, border at 3:1 or better against paper (W3.3–W3.5, W3.9).
      - `focusAfterRemove(countBefore, removedIndex)` is a pure function in `author-questions.ts`, returning the nearest remaining row (the row now at that index, else the one before) or `{ kind: "add" }` when none remain. `AuthorQuestions` uses it and sets a polite live region to "Question {n} removed." (W3.6).
      - "Add a question" is a quiet underlined text control with a 44 px hit area while fewer than three rows exist (W3.7).
      - The rules of spec 10 C2 and spec 11 L1.2 are unchanged (W3.8).
      - _Requirements: W3.1–W3.9_
    - [ ]* 8.2 Write property test for focus after removal
      - **Property 7: Removing a question leaves focus on the nearest remaining row, or on Add**
      - **Validates: Requirements W3.6**
  - Earlier-spec tests changed or retired: `AuthorQuestions.test.tsx`, `WriteForm.questions.test.tsx`, `WriteStep.questions.test.tsx`; name each with the reason.
  - Copy evidence (G2.6): tone-check for `live/copy.ts`; Retired_Phrase search of the rendered Write step.
  - QA shots: the Write step with three rows, one at 200 characters, at both widths, with and without reduced motion.
  - QA steps: 12-13.
  - Production_Check: on `/demo/live`, add three questions, type a long one, remove the middle one. Pass: nothing is cut off, focus lands on the nearest row, the removal is announced.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: W3.1–W3.9_

- [ ] 9. W5 and W6 · Action row, "Add a receipt", and a blank own number
  - Agent: `frontend-dev` · Depends on: 8 · Estimated size: ~700 changed lines
  - Never cut: W5 (G3.4).
  - Scope: `src/components/live/WriteForm.tsx`, `src/components/live/ReceiptsDisclosure.tsx`, `src/components/live/SelfReportedRows.tsx`, `src/components/live/form.ts`, `src/components/live/build-payload.ts`, `src/components/live/write-draft.ts`, `src/components/live/copy.ts` (`receiptsSummary`, `receiptsAction`), `src/components/live/live.module.css`, and the `*.test.ts(x)` for each file above.
  - Design sections: "W5. The action row", "W6. Blank own number", "Data Models" (Write draft), "Copy".
  - Acceptance:
    - [ ] 9.1 Action row, Receipts_Action and blank own-number rows
      - The last row is `display: flex; justify-content: flex-end; gap: 0.75rem`, with the Receipts_Action first in the DOM and Next second, so Next is at the bottom right and the tab order follows the reading order. Below 600 px the row stacks in DOM order (the Receipts_Action, then Next), both 44 px tall and full width (W5.1, W5.5, W5.6). The design keeps DOM order rather than reorder with CSS.
      - The Receipts_Action reads "Add a receipt" and is a secondary outline control; Next is the only primary button (W5.2). The `summary` is renamed "Receipts".
      - `ReceiptsDisclosure` accepts an `openRequest` counter. When it changes the native `details` opens and focus moves, with `preventScroll`, to the first focusable control inside (the first figure checkbox when ready, else the first own-number control). The `summary` still opens it from the keyboard (W5.3, W5.4).
      - With the figures request loading or failed, the Receipts_Action still opens the disclosure to its loading or unavailable line, and Next is not disabled (W5.7).
      - Tab order: chips, Letter_Field, question rows, Add a question, Receipts summary, Receipts_Action, Next.
      - `SelfReportedRows` starts with no row. `isEmptySelfReportedRow(row)` is true when name, value, unit, region and period are all empty after trimming. `validateWrite` ignores empty rows and `buildPayload` drops them; a blank row seals nothing (W6.1).
      - A partly filled row blocks Next only after it is touched or a seal is attempted, and the message names what is missing (W6.2, W6.3). A self-reported row still counts for nothing toward spec 11 L1.2 (W6.4).
      - _Requirements: W5.1–W5.7, W6.1–W6.5_
    - [ ]* 9.2 Write property test for own-number rows
      - **Property 6: A blank own-number row changes nothing, and a partly filled one blocks**
      - **Validates: Requirements W6.1, W6.2, W6.5**
  - Earlier-spec tests changed or retired: `ReceiptsDisclosure.test.tsx`, `WriteForm*.test.tsx`, `self-reported.property.test.ts`, `SelfReportedRows.test.tsx`; name each with the reason.
  - Copy evidence (G2.6): tone-check for `live/copy.ts`; Retired_Phrase search of the rendered Write step.
  - QA shots: the Write step with the disclosure closed and open, at both widths, with and without reduced motion; First_Viewport and full-page captures at 390×844.
  - QA steps: 12-14, 12-15.
  - Production_Check: on `/demo/live`, press "Add a receipt", then add an empty own-number row and press Next. Pass: the disclosure opens with focus inside and the field stays in place; Next goes on with the blank row.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: W5.1–W5.7, W6.1–W6.5_

### Group K: the receipt picker (P1)

- [ ] 10. K1, K2 and K3 · Picker precision, Short_Dates and one note
  - Agent: `frontend-dev` · Depends on: 9 · Estimated size: ~700 changed lines
  - Scope: `src/components/reveal/display-figure.ts` (new), `src/components/ui/letter-date.ts` (new, or the shared date module on `main`), `src/components/reveal/ReceiptCard.tsx` (call sites only), `src/components/live/FigurePicker.tsx`, `src/components/live/copy.ts` (`pickerNote`, `pickerRetrieved`, `pickerPeriod`), and the `*.test.ts(x)` for each file above.
  - Design sections: "K1 to K3. The picker's numbers, dates and note", "Copy".
  - Acceptance:
    - [ ] 10.1 One display function for the picker and the Receipt_Card
      - `displayFigureValue(value, unit, region)` returns `{ text, unit }`, applying `rescaleForDisplay` where `displayRescaleForUnit(unit)` exists and then `formatValue(…, region, displayPrecisionForUnit(shownUnit))`. The picker and `receiptFigureOf` both call it, so 1954.037871213403 EUR per 1,000 litres reads 1.95 EUR per litre in both (K1.1, K1.2, K1.5).
      - Only displayed text changes. No stored, sealed or passed-to-sealing value changes (K1.3). The picker's source control shows "As published: {value} {unit}" as the Receipt_Card does (K1.4).
      - _Requirements: K1.1–K1.5_
    - [ ] 10.2 Short_Dates
      - `formatShortDate(instant)` returns "26 Oct 2026" from the instant's UTC fields. A month period shows "Oct 2026" and a year shows "2026", through `formatPeriod`; no day is invented. The Receipt_Card's "retrieved" label and the picker share this function. Each date is labelled "Period" or "Retrieved" (K2.1–K2.5).
      - _Requirements: K2.1–K2.5_
    - [ ] 10.3 One Picker_Note
      - The picker renders `pickerNote` once above the list when any item has `fallbackRetrievedAt`, and not at all otherwise. Rows show "Retrieved {Short_Date}" and nothing else about the fallback. The Reveal's per-figure `fallbackNote` is untouched (K3.1–K3.5).
      - _Requirements: K3.1–K3.5_
    - [ ]* 10.4 Write property test for picker values
      - **Property 8: The picker shows the Receipt_Card's number and changes no stored value**
      - **Validates: Requirements K1.1, K1.2, K1.3, K1.5**
    - [ ]* 10.5 Write property test for Short_Dates
      - **Property 9: A Short_Date does not depend on the viewer's timezone**
      - **Validates: Requirements K2.1, K2.2, K2.3, K2.6**
    - [ ]* 10.6 Write property test for the Picker_Note
      - **Property 10: The Picker_Note appears once, or not at all**
      - Cover 0, 1, 4 and 8 Fallback_Figures at varied positions.
      - **Validates: Requirements K3.1, K3.2, K3.3, K3.6**
  - Earlier-spec tests changed or retired: `live/FigurePicker.test.tsx`, `reveal/ReceiptCard*.test.tsx`; name each with the reason.
  - Copy evidence (G2.6): tone-check for `live/copy.ts`; Retired_Phrase search of the rendered picker. The note does not judge the figure (K3.5).
  - QA shots: the Receipts_Disclosure open with figures loaded, at both widths, with and without reduced motion.
  - QA steps: 12-16.
  - Production_Check: open Receipts on `/demo/live`. Pass: two-decimal values in the shown unit, "As published" in the source details, Short_Dates, one note at most.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: K1.1–K1.5, K2.1–K2.6, K3.1–K3.6_

- [ ] 11. K4 · Figures grouped by region (first to be cut)
  - Agent: `frontend-dev` · Depends on: 10 · Estimated size: ~400 changed lines
  - Cut order position 1. If cut, the picker keeps one list with the single Picker_Note.
  - Scope: `src/components/live/catalogue-list.ts`, `src/components/live/FigurePicker.tsx`, `src/components/live/copy.ts` (`regionUs`, `regionEu`), `src/components/live/live.module.css`, and the `*.test.ts(x)` for each file above.
  - Design sections: "K4. Regions", "Data Models" (Picker groups).
  - Acceptance:
    - [ ] 11.1 Region groups
      - `regionGroupFor(region)` returns `"us"` for `"U.S."`, `"eu"` for a region starting with `"EU"`, and `null` otherwise. `groupPickable(series)` returns groups in the fixed order United States then European Union, items in Catalogue order, leaves out empty groups and any item whose group is `null` (K4.1, K4.3–K4.5).
      - Each group is a `fieldset` with a `legend` ("United States", "European Union"). No Sweden group or figure (`sweden-guard.test.ts` still passes). The order depends on no value, change or direction (K4.2, K4.3).
      - The figure limit and its hint count across groups (K4.6). Two columns at 1024 px and wider, one column below, every checkbox at least 44×44 px on a phone (K4.7).
      - A test pins that an unknown region is left out rather than shown under an invented heading.
      - _Requirements: K4.1–K4.7_
    - [ ]* 11.2 Write property test for region groups
      - **Property 11: Every pickable figure is in exactly one region group, in a fixed order**
      - **Validates: Requirements K4.1, K4.3, K4.4, K4.5, K4.6, K4.8**
  - Earlier-spec tests changed or retired: `live/FigurePicker.test.tsx`; name the cases changed.
  - Copy evidence (G2.6): tone-check for `live/copy.ts`; Retired_Phrase search of the rendered picker.
  - QA shots: the open picker at both widths, with and without reduced motion.
  - QA steps: 12-17.
  - Production_Check: open Receipts on `/demo/live`. Pass: United States then European Union, no Sweden, no empty heading.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: K4.1–K4.8_

### Group H: landing (P1)

- [ ] 12. H1 · Landing sections use the full width
  - Agent: `frontend-dev` · Depends on: 11 · Estimated size: ~500 changed lines
  - Never cut: H1 (G3.4).
  - Scope: `src/components/ceremony/scene/SceneShell.tsx` (the optional `below` prop), `src/components/ceremony/scene/scene.module.css` (`.landingBelowFrame`), `src/app/page.tsx` (pass the four sections as `below`; strings are not touched), `src/components/landing/landing.module.css`, and the `*.test.ts(x)` for each file above. `src/app/page.tsx` also matches platform-dev; the PR changes only this wiring and the owner of the role confirms it before the task is claimed if `pr_policy` objects.
  - Design sections: "H1 and H2. Landing", "Open decisions" 4.
  - Acceptance:
    - `SceneShell variant="landing"` renders `below` as a sibling of `.landingColumn` inside `main`, in `.landingBelowFrame` of `max-width: 1200px`, aligned to the hero's left edge. The hero stays in the capped column (H1.1).
    - At 1440×900 the left edge of each section equals the hero content's left edge within 2 px and the right edge is within 2 px of the container's right edge. Where "centred" and "same left edge" disagree at 1440 px, H1.2 wins (Open decision 4).
    - No section is narrower than 60% of the viewport at 1440×900 (H1.6). The sections stay server components with no new client JavaScript and `/` stays at or under its 160 kB budget (H1.3).
    - Below 600 px the sections are one column with no sideways scroll and every link at least 44×44 px (H1.4). Order and text are unchanged (H1.5).
  - Tests: example tests that `below` renders outside `.landingColumn`, that the four sections keep their order, and that no client-only import is added.
  - Earlier-spec tests changed or retired: `landing-sections.test.tsx`, `landing-general.test.tsx`, `app/page.test.tsx`; name each with the reason.
  - Copy evidence (G2.6): none, no copy changes.
  - QA shots: `/` at 1440×900 and 390×844 (First_Viewport plus full page), with and without reduced motion.
  - QA steps: 12-18.
  - Production_Check: open `/` at 1440×900. Pass: the four sections span the content width, aligned to the hero's left edge.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: H1.1–H1.5_

- [ ] 13. H2 · Four ritual cards in one row (third to be cut)
  - Agent: `frontend-dev` · Depends on: 12 · Estimated size: ~250 changed lines
  - Cut order position 3. If cut, the cards stay as on `main`.
  - Scope: `src/components/landing/RitualSection.tsx`, `src/components/landing/landing.module.css`, and the `*.test.ts(x)` for each file above.
  - Design sections: "H1 and H2. Landing" (H2), "Constants" (Ritual columns).
  - Acceptance:
    - `.ritualList` is a grid: four equal columns at 1024 px and wider, two from 600 to 1023 px, one below, with equal gaps and `align-items: stretch` for equal heights (H2.1–H2.3).
    - Each card keeps its step number, name and Brand_Copy line with nothing clipped at 1024×768, 1440×900 and 390×844 (H2.4). The cards stay list items of one ordered list in step order (H2.5, H2.7). No colour marks a direction (H2.6).
  - Tests: example test that the four cards are `li` elements of one `ol` in step order.
  - Earlier-spec tests changed or retired: `landing/RitualSection.test.tsx`; name the cases changed.
  - Copy evidence (G2.6): none, no copy changes.
  - QA shots: the ritual section at 1440×900, 800 wide and 390×844, with and without reduced motion.
  - QA steps: 12-19.
  - Production_Check: open `/` at 1440, 800 and 390 wide. Pass: four in a row, two per row, one per row.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: H2.1–H2.7_

- [ ] 14. Layout-check thresholds, landing and ritual checks, and the Q1.8 J-check
  - Agent: `platform-dev` · Depends on: 7, 12, 13 · Estimated size: ~500 changed lines
  - Scope: `tools/qa/layout-check.mjs`, `tools/qa/journey-check.mjs`, and the tests that cover them. If task 13 was cut, the ritual check is omitted and the PR says so.
  - Design sections: "Testing Strategy" (layout checks), "Q1 and Q2" (Q1.8), "W1.6: viewport arithmetic".
  - Acceptance:
    - The Write-step thresholds replace the spec 11 L3 ones as W1.6 describes: the Letter_Field's 10 lines (6 on a phone) and the chips are in view at 1440×900; Next's bottom is printed as a note, not asserted; no sideways scroll at 360×640; the message names W1 (W1.6, W1.7).
    - A new landing check fails when any section's content box is narrower than 60% of the viewport at 1440×900 (H1.6). A ritual check asserts one row of four at 1440×900 (H2.7).
    - A new J-check opens `/demo/live` on production at 1440×900 and 390×844, checks the Write step and the Press the seal screen without pressing the seal, and fails on horizontal scroll, a Motion_Control count other than 1, or a console error (Q1.8).
    - The existing checks (GT1, SI1, CF1, PH1 and the rest) still pass.
  - Tests: unit tests for the new check functions where the file already has them.
  - Earlier-spec tests changed or retired: layout-check tests whose asserted thresholds change; name each with the reason.
  - QA shots: none. QA steps: 12-09, 12-10, 12-18 (the checks are run against a local build).
  - Production_Check: run the Journey_Check against production. Pass: the new J-check passes and no stale FAIL line shows.
  - Validation: `bash scripts/check.sh`; `npm run layout-check` against a local build.
  - _Requirements: H1.6, H2.7, W1.6, W1.7, Q1.8_

### Group D: paperwork (P1)

- [ ] 15. D2 · Video script
  - Agent: `platform-dev` · Depends on: 5, 9 · Estimated size: ~300 changed lines
  - Never cut: D2 (G3.4).
  - Scope: `docs/video-script.md` only.
  - Design sections: "D1 to D3. Paperwork" (D2).
  - Acceptance:
    - The script is a table of time, length, beat, on-screen content, spoken line and word count, built around the six steps Write, Press the seal, Wait, Testify, Break the seal, See the receipts, with the Wait marked as cut (D2.1, D2.8).
    - Beats and lengths: 25 s problem and pli cacheté hook (0:00), 40 s live seal (0:25), 60 s Maya's persona letter (1:05, never under 45 s), 40 s Kiro Crew loop with one real PR, one QA verdict and one hook that stopped an agent (2:05), 7 s close (2:45). The lengths sum to 172 s, so the last beat ends at 2:52, before 2:55. Where arithmetic and a minimum disagree, the 172 s total and the minimums win and Maya's beat absorbs the difference (D2.3, D2.4).
    - Maya's receipts are the payoff. The live beat says plainly that a 30-second letter has nothing to compare yet and shows the Single_Figure_View when the letter holds a figure (D2.5).
    - The script names which beats use a pre-sealed persona and which a live seal (D2.8).
    - Spoken words total at most 400 (budget 375), one line per beat with its word count. No exclamation mark, no judgement of testimony, no claim the product does not make, no Retired_Phrase, and no "Seal the figures" (D2.2, D2.6, D2.7).
    - The PR description lists the total of the beat durations and the total spoken words (D2.9). QA checks the criteria by reading the file and attaches the counts (D2.10).
  - Tests: none (a script test is not possible).
  - Earlier-spec tests changed or retired: none.
  - Copy evidence (G2.6): the Retired_Phrase search of the file.
  - QA shots: none. QA steps: none (read-through with counts).
  - Production_Check: none.
  - Validation: `bash scripts/check.sh`.
  - _Requirements: D2.1–D2.10_

- [ ] 16. D3 · Gaps_Report for the write-up
  - Agent: `platform-dev` · Depends on: none · Estimated size: ~300 changed lines
  - Scope: `docs/writeup-gaps.md` (new) only. `docs/kiro-writeup.md` stays byte-identical, checked with `git diff --exit-code -- docs/kiro-writeup.md`.
  - Design sections: "D1 to D3. Paperwork" (D3).
  - Acceptance:
    - The report lists every OWNER comment found with `grep -n "OWNER" docs/kiro-writeup.md`, each with line number, text and section. At `dcea0e3` there are seven (lines 5, 17, 47, 77, 96, 105 and 115); the report uses the count it finds at the final SHA (D3.2).
    - For each gap it lists the evidence git or GitHub can give, as commands with output and links, and says plainly where there is none: the recount note; the Kiro surfaces note; the hook block note; the spec loop versus vibe coding note; the property test note; the Kiro powers note; and the what-went-wrong note, each with the commands named in D3.3.
    - It writes no opinion. Where evidence suggests a candidate it lists it as a candidate with its link and leaves the choice to the write-up's author (D3.4).
    - It lists stale facts git can contradict (the header SHA `4b71564`, the 206 count, the status line), each with the command that shows the current value, and changes none of them (D3.5).
    - It states the commands run, the date and the SHA (D3.6). A failing command (for example `gh` unauthenticated) is reported with the exact command to run, and the task does not block or substitute a guessed value (D3.7).
    - The same report goes in the PR description.
  - Tests: none.
  - Earlier-spec tests changed or retired: none.
  - Copy evidence (G2.6): none.
  - QA shots: none. QA steps: none.
  - Production_Check: none.
  - Validation: `bash scripts/check.sh`; `git diff --exit-code -- docs/kiro-writeup.md`.
  - _Requirements: D3.1–D3.7_

- [ ] 17. D1 · README (last task before the final walk)
  - Agent: `platform-dev` · Depends on: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 · Estimated size: ~200 changed lines
  - Queue position: last before task 18 (G3.1, D1.7). Every count it states is recomputed at the final SHA, so it waits for every other task, including any that was cut and closed unmerged.
  - Scope: `README.md` only. Edit the lines in place; do not re-create the file (D1.5).
  - Design sections: "D1 to D3. Paperwork" (D1).
  - Acceptance:
    - The Video_Slot marker (`<!-- VIDEO: embed link here -->`, line 13 at `dcea0e3`, beside the `<!-- GIF: docs/reveal.gif -->` marker) stays in place with no visible placeholder text. The PR description gives its line number (D1.1).
    - The status line (line 67 at `dcea0e3`) says "13 specs (two share the number 02)" only when every `tasks.md` under `.kiro/specs/`, spec 12's included, has no open box at generation time, and names the spec directories. If any has an open box, it names each open spec and does not say complete. Spec folders are not renamed (D1.2).
    - The merged PR count (line 117 at `dcea0e3`) is recomputed with `gh pr list --state merged --limit 1000 --json number -q length` at the final SHA, with the command, date and SHA beside it. If `gh` is not authenticated, the exact command goes in the PR description, the task does not block, and the line carries the git-log lower bound labelled as such (D1.3).
    - Every number in the file names its command in the same sentence or an adjacent comment, and none is left uncomputed (D1.4).
    - The live demo is described with the six steps and as a rehearsal. No Retired_Phrase remains. Nothing describes a feature that was cut (D1.6).
  - Tests: none.
  - Earlier-spec tests changed or retired: any test that reads README text (spec 09 F2.4 and spec 11 H2.4 Brand_Copy agreement); name each.
  - Copy evidence (G2.6): tone-check where it applies; Retired_Phrase search of the file.
  - QA shots: none. QA steps: none (read-through).
  - Production_Check: none.
  - Validation: `bash scripts/check.sh`.
  - _Requirements: D1.1–D1.7_

### Group Q: the final walk

- [ ] 18. Q1.7 · Final Live_Walk on merged `main`
  - Agent: `platform-dev` · Depends on: 6, 17 · Estimated size: ~150 changed lines
  - Queue position: last. It has the highest number (G3.1).
  - Scope: `src/test/integration/live-walk.test.ts` (only if the run exposes a defect in the script), and the run record in the PR description. No product file.
  - Design sections: "Q1 and Q2. The Live_Walk".
  - Acceptance:
    - `npm run live-walk` runs the full walk on merged `main` at 1440×900 and 390×844, both variants (no figure, one figure), with and without reduced motion (Q1.2–Q1.4, Q1.7).
    - Every expected Step_Shot exists, including `letter`, `figures` and `close` as full-page captures, the Single_Figure_View and the 0-figure `close`, and each is named in the run record (Q2.1–Q2.6).
    - The run record states the commit SHA, every result line the script prints, pass or fail per step, and for each defect the step, expected result, observed result and suspected file. A step with no Step_Shot is not claimed as passed (Q1.5, Q2.7).
    - The verdict fails on any condition in Q1.6. A defect opens a new fix task for the right role; this task does not fix product files.
    - If tasks were cut under the cut order, the run record lists the steps those cuts removed.
  - Tests: the replay test only, skipped unless `WALK=1`.
  - Earlier-spec tests changed or retired: none.
  - QA shots: all Step_Shots from the run. QA steps: 12-20.
  - Production_Check: the Journey_Check from task 14 passes against production.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: Q1.1–Q1.7, Q2.1–Q2.7_

## Notes

- **Order.** The dispatcher claims the lowest-numbered ready issue whose dependencies are closed, one per role at a time. Tasks 1, 2 and 6 and 16 have no dependency. Task 1 is queued first and nothing is ahead of it. Tasks 3 and 4 follow task 1; task 5 follows task 2. Tasks 7 to 13 are all frontend-dev and form one chain in practice, because they share `live/`, `reveal/` and the copy modules.
- **No owner tasks.** G4 was a precondition. If a task finds `pr_policy` refusing a path it needs, it reports the refusal in its PR description and does not edit the ownership files (G4.7).
- **QA rows by task.** 12-01 to 12-05 (task 1); 12-06 (3); 12-07 (4); 12-08 (5); 12-09 to 12-12 (7); 12-13 (8); 12-14 and 12-15 (9); 12-16 (10); 12-17 (11); 12-18 (12); 12-19 (13); 12-20 (18). Rows 12-09, 12-10 and 12-18 are also run by the checks in task 14. This corrects the Task column in design.md "QA browser steps".
- **Open decisions carried from the design.** X4.5 is read as "no name cut off by ellipsis or clip" with non-current names visually hidden at 480 px and below (task 4). H1.2 wins over H1.1 at 1440 px (task 12). D1.7 and G3.1 are resolved by making the README depend on tasks 1 to 16 and the final walk on the README (tasks 17 and 18). W1.2 wins over spec 11 L3.1 at 1366×800 and 1280×800 (tasks 7 and 14).
- **Host step after the commit.** `python3 tools/agents/generate_agents.py --install-global` runs once on the machine that runs the loop. It changes `~/.kiro/agents/`, not the repo, and is not a task.
- **Optional tasks.** Sub-tasks marked `*` are the property tests. They ship in the same PR as their parent when the PR has room, and may be skipped for a faster path. Parent tasks are never optional.
- **Property coverage.** Property 3 (task 2); Properties 1 and 2 (task 4); Properties 4 and 5 (task 5); Property 7 (task 8); Property 6 (task 9); Properties 8, 9 and 10 (task 10); Property 11 (task 11).

## Task Dependency Graph

Dependencies: 1 none; 2 none; 3 after 1; 4 after 1; 5 after 2; 6 none; 7 after 5; 8 after 7; 9 after 8; 10 after 9; 11 after 10; 12 after 11; 13 after 12; 14 after 7, 12 and 13; 15 after 5 and 9; 16 none; 17 after 1 to 16; 18 after 6 and 17. Task 5 sits one wave after tasks 3 and 4 because it shares `reveal/copy.ts` with task 3. Tasks 6 and 16 touch no file in groups X or Z and may run any time after wave 0 starts; the queue order above still puts task 6 after task 5.

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2.1", "6", "16"] },
    { "id": 1, "tasks": ["2.2", "3", "4.1"] },
    { "id": 2, "tasks": ["4.2", "4.3", "5.1"] },
    { "id": 3, "tasks": ["5.2", "5.3", "7"] },
    { "id": 4, "tasks": ["8.1"] },
    { "id": 5, "tasks": ["8.2", "9.1"] },
    { "id": 6, "tasks": ["9.2", "10.1", "15"] },
    { "id": 7, "tasks": ["10.2"] },
    { "id": 8, "tasks": ["10.3"] },
    { "id": 9, "tasks": ["10.4", "10.5", "10.6", "11.1"] },
    { "id": 10, "tasks": ["11.2", "12"] },
    { "id": 11, "tasks": ["13"] },
    { "id": 12, "tasks": ["14"] },
    { "id": 13, "tasks": ["17"] },
    { "id": 14, "tasks": ["18"] }
  ]
}
```
