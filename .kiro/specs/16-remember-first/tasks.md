# Implementation Plan: 16 Remember first

## Overview

Spec 16 fixes what the owner found while cutting the demo video. A press on Write scrolls the page between pointer down and pointer up, so the press is lost. "Testify" leaves the UI for "Remember". The Write desk says plainly that each question is answered now. The receipts get one phrase for the reader's side, "At opening" in place of "Now", an unsigned change line, formula inputs at published precision, one rescale note per card, and a new order with the letter folded after the figures. Smaller fixes cover the number field, the break line, the persona date, Press the seal and the home section. Nothing sealed changes.

`requirements.md` says what to build and `design.md` says which files change and how. The spec 15 prototype (`docs/design/15-flow/`) stays the visual reference for everything this spec does not change. Where this spec changes a string, an order or a label the prototype shows, this spec wins and the prototype is not redrawn.

Order: the Keep_Hook fix and its Press_Test first (they block the rest), the retired-word scanner, the Remember rename, the headline, the Write desk, data-dev's precision work, the receipts, the number field, the break line, the persona date, Press the seal, the home section, then docs, layout rows and walk, fix-up and the final walk.

| Tasks | What | Roles |
|---|---|---|
| 1 | Keep_Hook fix and the Press_Test | frontend-dev |
| 2 | Retired-word scanner | platform-dev |
| 3, 4, 5 | Remember and the Remembered_Phrase; the headline; the Write desk | frontend-dev |
| 6 | Published_Precision, `formulaInput`, unsigned magnitudes | data-dev |
| 7, 8 | Figure card (At opening, change line, formula, rescale note); receipts order, live column, sound | frontend-dev |
| 9, 10, 11 | Number field; break line; persona date | frontend-dev |
| 12, 13 | Press the seal; home section | frontend-dev |
| 14, 15 | Docs; layout rows, walk and `page.tsx` | platform-dev |
| 16, 17 | Fix-up; final walk | frontend-dev, platform-dev |

Each task is one GitHub issue and one PR for one role, inside that role's paths in `.github/agents.json` (plus `shared`) and under its `max_changed_lines` (5,000, test files excluded). "Depends on" lists only task numbers of this spec. The agent loop runs one task at a time and takes the lowest-numbered ready issue.

## Before task 1: steering in the spec PR

Requirements 2.10, 10.9 and 15.6 change `.kiro/steering/tone.md`, `product.md`, `neutrality.md` and `structure.md`. These edits ship in the same PR as this spec, made by the owner, because no agent task may change a file under `.kiro/`. They are wording-only swaps of the step name and of "testify" and "testimony", plus three additions: the receipts order with the folded letter (10.9), the maker's story as the only first-person passage (15.6), and the new tagline in `product.md` (5.6). No task below starts until that PR is merged.

## Rules for every task

- **Branch and PR.** The dispatcher creates `agent/<role>/issue-N` and the PR "Closes #N". Do not push to `main` or merge. After a hook failure, make a new commit; do not amend.
- **Scope.** Change only files that match your role's paths in `.github/agents.json` (or `shared`) and are listed in your task's Scope, plus new `*.test.ts(x)` files next to the code they test. Check your diff with `git diff --name-only origin/main` before you finish and put the list in a commit message body.
- **Hard boundaries.** No task changes a file under `.kiro/`, `.github/`, `tools/agents/`, `tools/dispatcher/`, `tools/hooks/`, `src/app/api/`, `src/lib/letter-store/`, `src/lib/db/`, `src/lib/crypto/`, `src/lib/seal-format/` or `drizzle/`, or `scripts/seal-personas*`, `scripts/check.sh`, `docs/kiro-writeup.md`, the Helm chart or an environment variable. No task changes persona letter text, `content/personas/letters/sealed-answers.json`, a letter id or envelope hash in `content/personas/personas.json`, or a value in a figure file (Requirement 16.1). `README.md` and `docs/video-script.md` change only in task 14.
- **Code names stay.** `testimony`, `TestimonyEntry`, `AuthorTestimony`, `testimonyRecorded`, `nothingToTestify`, the step id `"testify"`, `pickNow`, the `now` role and every copy key keep their names. Only string values change (Requirements 2.11, 7.9).
- **Privacy and size.** CSP header byte-identical. No request to another origin. New code writes nothing to `localStorage`, `sessionStorage`, IndexedDB, cookies, the URL path, the query string or the fragment. No new `dependencies` or `devDependencies` entry, animation library, WebGL, font file, sound cue or vibration cue.
- **Copy.** Every string lives in its feature folder's `copy.ts` (Occasion wording in `occasions.ts`) and is exactly the string in `requirements.md` ("Proposed wording" and the requirement text) or in `design.md` ("Where the code differs from the requirements", items 1 to 5 and 8). Second person, except the maker's story (Requirement 15.4). At most 25 words per sentence, no exclamation mark, no pun, nothing on `tone.md`'s avoid list, nothing that grades what the reader remembered. Each copy task states in a commit message body the result of `node tools/hooks/tone-check.mjs <file>` for every copy file it changed.
- **Retired words.** After task 2, `src/test/retired-phrases.test.ts` holds a pending list of today's User-facing strings with "testif" or "testimon". Each entry names the task that removes it. A task that changes such a string removes its entry in the same commit. The test fails on any hit not in the list and on any entry that no longer hits.
- **Accent and contrast.** The accent marks only what `tone.md` lists. It never marks a figure, a change or a direction and is never text on purple. Every text and number meets WCAG 2.2 AA on its surface.
- **Neutrality and data integrity.** Nothing scores, diffs, highlights, summarises or explains a gap between what the reader remembered and the record. Rose, fell and unchanged get the same colour, weight, size and icon (none). No block is reordered, hidden or added based on a direction. Every figure shown keeps value, unit, region, period, source and `retrieved_at`, with its period beside it. The change is computed from full precision in `src/lib/figures`.
- **Motion.** Decorative motion changes only `transform` and `opacity`, runs only under `prefers-reduced-motion: no-preference` with Calm off, and every sequence can be skipped.
- **JS budget.** Every route stays inside `scripts/check-js-budget.mjs`. No task raises a value in it. A task that cannot fit reports the route, its measured size and its budget in a commit message body and stops (Requirement 16.6).
- **Reports.** Anything a task asks for "in the PR" goes in a commit message body on the task's branch, kept short (bodies are cut at 12,000 characters). No task edits the PR description or attaches files.
- **Tests.** Vitest, `renderToStaticMarkup`, every `fetch` stubbed, no network, `DATABASE_URL` unset, no browser (layout-check, the Live_Walk and the Press_Test excepted). Property tests use fast-check with `numRuns` of at least 100 and the tag `// Feature: 16-remember-first, Property N: <title>` with the title from `design.md`. Each property has one test. A task that changes behaviour or a string updates or retires the tests it outdates and names each with its reason and requirement (Requirements 4.7, 17.8).
- **Evidence.** A commit message body states the final commit SHA, the exit status of `bash scripts/check.sh` and PASS or FAIL, every route budget from `node scripts/check-js-budget.mjs` after `npm run build`, and every earlier-spec test changed or retired, each with its reason ("none" if empty).
- **Owner questions.** The owner decided every open question on review: the design's default. The owner also approved all proposed wording as written. A task with an "Owner decision" line builds that default and does not wait. List the decision under "Decisions" in a commit message body.
- **Layout rows and walk between tasks.** `npm run layout-check` and `npm run live-walk` run against a local production build. A row or step that looks for a string or step name this spec renames may fail until task 15 updates it. QA records each as `EXPECTED: renamed by spec 16` and it does not block. Any other failing row blocks the PR. The Press_Test never counts as expected: from task 1 on it must pass.
- **After the merge.** `bash scripts/check.sh` passes on `main`. On a production build, `/`, `/demo`, `/demo/live`, `/how-it-is-sealed`, every persona page and `/l/<an id that does not exist>` each return a status below 500 and render with no uncaught page error at both sizes. Every persona letter's seal check passes with its hash from `1183739` (Requirement 16.2).
- If `design.md` and the code on `main` disagree, re-read the code, keep the design's behaviour, and say what you changed and why in a commit message body. If something is still unclear, decide, record the decision in a commit message body under "Decisions", and continue. Do not stop to ask.

## Tasks

- [x] 1. Keep_Hook fix and the Press_Test
  - Agent: `frontend-dev` · Depends on: none · Estimated size: M, ~900 changed lines
  - Scope: `src/components/ui/use-keep-in-visual-viewport.ts`, `src/components/ui/KeepGroup.tsx` (new), `src/components/live/stepper/LiveStepper.tsx`, `src/components/live/desk/QuestionRow.tsx`, `desk/LetterSheet.tsx`, `src/components/live/WriteForm.tsx`, `AuthorQuestions.tsx`, `desk/OwnNumberView.tsx`, `SelfReportedRows.tsx`, `UnlockView.tsx`, `src/test/integration/press-test.test.ts` (new), `press-test-helpers.ts` (new), `live-walk-helpers.ts`, `live-walk.test.ts` (shared launch helpers only), `package.json` (the `live-walk` script), and the `*.test.ts(x)` next to each.
  - Design sections: "1. Keep_Hook", "2. Press_Test", Properties 1 and 2.
  - Owner decision: open question 4 (the visual viewport `scroll` listener), the default: kept, gated by Keyboard_Open and Text_Field.
  - Steps:
    1. Add `KEYBOARD_THRESHOLD_PX = 150`, `SCALE_TOLERANCE`, `isKeyboardOpen`, `isTextField` and `keptBox`. `keepInVisualViewport` returns 0 unless Keyboard_Open and a Text_Field. The hook attaches the same listeners with or without `visualViewport` and acts only for a focused Text_Field inside its `ref`.
    2. Add `KeepGroup`. Remove the `primaryRef` call from `LiveStepper` and keep `primaryRef` for the step-heading focus. Add a call per Field_Group at the call sites in the design. Leave `RecallPager`'s call as it is.
    3. Write the Press_Test as in the design and point `npm run live-walk` at both files.
    4. Show the test fails before the fix: in a separate worktree at `1183739`, copy in the new test files, build, run with `WALK=1`, and quote the failing lines at 1440 × 900 and 390 × 844 in a commit message body. Then quote the passing run on the task's final commit. Remove the worktree afterwards.
    5. For each of `LiveStepper.tsx`, `AuthorQuestions.tsx`, `desk/QuestionRow.tsx` and `ceremony/recall/RecallPager.tsx`, state in a commit message body whether the fault was found there and what changed (1.10).
  - Acceptance:
    - [ ] 1.1 Keep_Hook rewrite and Field_Group call sites
      - Unit tests show each of the seven cases of 1.13. A test fails if `LiveStepper.tsx` calls the hook.
      - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.13_
    - [ ] 1.2 Write property test for Keyboard_Open and Text_Field gating
      - **Property 1: The Keep_Hook scrolls only for a Text_Field while Keyboard_Open**
      - In its own file, `use-keep-in-visual-viewport.gate.property.test.ts`.
      - **Validates: Requirements 1.4, 1.5, 1.13**
    - [ ] 1.3 Write property test for the kept box
      - **Property 2: The kept box lands in the band**
      - In its own file, `use-keep-in-visual-viewport.band.property.test.ts`.
      - **Validates: Requirements 1.6, 1.7**
    - [ ] 1.4 Press_Test, with the failing run at `1183739` and the passing run on the fix
      - Skipped unless `WALK=1`. Each helper in `press-test-helpers.ts` has a passing and a failing example.
      - _Requirements: 1.1, 1.2, 1.11, 1.12, 17.2_
  - Earlier-spec tests changed or retired: `use-keep-in-visual-viewport.hook.test.ts` (focusin and resize cases expect a scroll on any focus), `use-keep-in-visual-viewport.test.ts`, any `LiveStepper*.test.tsx` that asserts the `primaryRef` call; name each.
  - Validation: `bash scripts/check.sh`; `WALK=1 npm run live-walk` against a local production build.

- [x] 2. Retired-word scanner that reads string values
  - Agent: `platform-dev` · Depends on: 1 · Estimated size: S, ~400 changed lines
  - Scope: `src/test/user-strings.ts` (new), `src/test/retired-phrases.test.ts`, and the `*.test.ts` next to them.
  - Design sections: "4. Retired-word scanner", Property 10.
  - Steps:
    1. Add `userStringsOfTs`, `userStringsOfJson`, `userStringsOfText` and `RETIRED_WORD` as in the design, using the `typescript` dev dependency already present.
    2. Scan the values in every non-test `copy.ts`, `src/components/live/occasions.ts` and the on-screen files under `content/personas/` (copy-test records left out), plus the rendered `/` and its metadata as today. Move `AVOIDED_WORDS` onto the same string reader.
    3. Add the pending list: every hit on today's `main`, each as `path`, value and the task of this spec that removes it (3, 10 or 13). The test fails on a hit not in the list and on an entry that no longer hits. Do not add "Memory rewrites itself" to `RETIRED_PHRASES` (task 4 does).
  - Acceptance:
    - [ ] 2.1 Scanner, value-only scan and the pending list
      - The fixture case of 4.5: a key `testimonyRecorded` with value "What you remembered is recorded." passes; a value with "Testimony" or "testified" fails, and the failure names the file, line and value.
      - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
    - [ ] 2.2 Write property test for the scanner
      - **Property 10: The retired-word scan reads values, not names**
      - **Validates: Requirements 2.8, 4.1, 4.2, 4.3, 4.4**
  - Earlier-spec tests changed or retired: `retired-phrases.test.ts` (`AVOIDED_WORDS` now reads values only); name any other.
  - Validation: `bash scripts/check.sh`.

- [x] 3. Remember and the Remembered_Phrase
  - Agent: `frontend-dev` · Depends on: 2 · Estimated size: M, ~900 changed lines
  - Scope: `src/components/brand/copy.ts`, `src/components/ceremony/copy.ts`, `src/components/reveal/copy.ts`, `src/components/live/copy.ts`, `src/components/live/desk/copy.ts` (`receiptIntro` only), `src/components/landing/copy.ts` (no change to `noSealBody`, task 13 does it), `src/components/ceremony/recall/RecallPager.tsx`, `src/test/integration/live-walk-helpers.ts` (step names), `src/test/retired-phrases.test.ts` (pending list), and the `*.test.ts(x)` next to each.
  - Design sections: "3. Remember, the Remembered_Phrase and the break line" (not the break line), "Where the code differs from the requirements" items 1 to 5.
  - Owner decision: open question 1 ("Receipts" or "See the receipts"), the default: "Receipts" in every track and on the ritual card. Open question 8 (wording of items 1, 2 and 5), the default: as proposed.
  - Steps:
    1. Change the step names, `heroSentence`, `ritualSteps[3].line` (item 1), `recallIntro` (no date; the date work in components is task 11, so fill no `{date}` here), `stageLive.recall` and `receiptIntro`.
    2. Add `REVEAL_COPY.answerSpokenPrefix` ("Your answer") and pass it from `RecallPager` (item 3). Change `yourAnswer`, `stage1Title`, `marksSummary`, `lineAnswer`, `markAnswer`, `saidJustNow` (item 5), `closeLine`, `closeLineNoFigures` and the "You remembered" part of `numberLineAlt` and `numberLineAltNoAnswer`. Leave "Now" in those two lines for task 7.
    3. Update the live-walk step names in `live-walk-helpers.ts`. `tools/qa/` is platform-dev's; its renamed strings wait for task 15 (see Notes).
    4. If the Remembered_Phrase wraps past two lines or overlaps a value, mark or period as the Number_Line label at 390 × 844, report the measured layout and leave the label (3.9). Today no label is drawn (design item 4), so say that.
    5. Remove the entries for strings this task changes from the pending list.
  - Acceptance:
    - [ ] 3.1 Remember in every track, the hero, the ritual cards and the help text
      - Exact-string tests for every Requirement 2 row of the Proposed wording table and item 1.
      - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.9, 2.11_
    - [ ] 3.2 The Remembered_Phrase on the reader's side
      - A test asserts no visible or screen-reader "Your answer" on the break screen, Read and Receipts for the live demo, a fuel persona and a real letter (3.6). Priya shows "She remembered · fictional" and no Remembered_Phrase.
      - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_
  - Earlier-spec tests changed or retired: `ceremony/steps.test.ts`, `live-steps*.test.ts`, `copy-exact.property.test.ts`, `brand/copy.test.ts`, `RecallPager*.test.tsx` (spoken prefix), `ReceiptCard*.test.tsx`, `RememberedAnswers.test.tsx`, `AuthorTestimony.test.tsx`, `close/*.test.tsx`; name each.
  - Copy evidence: tone-check for every changed copy file.
  - Validation: `bash scripts/check.sh`.

- [x] 4. The headline
  - Agent: `frontend-dev` · Depends on: 2 · Estimated size: S, ~300 changed lines
  - Scope: `src/components/brand/copy.ts` (`tagline`), `src/components/ceremony/scene/SceneHeadline.tsx`, `src/components/landing/LandingHero.tsx`, `src/components/landing/landing.module.css`, `src/app/opengraph-image.tsx`, `src/components/ceremony/ASSETS.md`, `src/test/retired-phrases.test.ts`, and the tests named in 5.7.
  - Design sections: "5. Headline".
  - Steps:
    1. Change `BRAND_COPY.tagline`. `KEPT_TOGETHER` becomes "letter doesn't.". The Open Graph image joins "letter" and "doesn't." with a non-breaking space.
    2. The hero's first sentence is its own span, `white-space: nowrap` from 900 px. `.headline` gains `text-wrap: balance`. At 390 px join "with time." with a non-breaking space in the rendered text only.
    3. Add "Memory rewrites itself" to `RETIRED_PHRASES`. `HOME_DESCRIPTION` reads the tagline, so `src/lib/page-metadata.ts` does not change; only its test does. `README.md`, `docs/video-script.md` and `product.md` are not this task's (task 14 and the spec PR).
  - Acceptance:
    - [ ] 4.1 Tagline, hero, metadata and Open Graph image
      - The tests of 5.7 assert the new headline and none asserts "Memory rewrites itself" as current.
      - _Requirements: 4.6, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  - Earlier-spec tests changed or retired: the eight tests listed in 5.7; name each.
  - Copy evidence: tone-check for `brand/copy.ts`.
  - Validation: `bash scripts/check.sh`.

- [ ] 5. Write says you answer now
  - Agent: `frontend-dev` · Depends on: 3 · Estimated size: S, ~200 changed lines
  - Scope: `src/components/live/desk/copy.ts`, `src/components/live/copy.ts`, `src/components/live/AuthorQuestions.tsx`, and the `*.test.ts(x)` next to each.
  - Design sections: "6. Write desk strings".
  - Steps:
    1. Change `psIntro`, `lockLine`, `answerPlaceholder` and `authorQuestionsHint`.
    2. Delete `LIVE_COPY.answerInLetter` and the line in `AuthorQuestions.tsx` that renders it, with no replacement.
    3. Change nothing in `write-check.ts` or the fold behaviour.
  - Acceptance:
    - [ ] 5.1 Write desk strings
      - A render test of the Write step at both layouts finds none of the four retired phrases of 6.6 and finds `psIntro` once.
      - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_
  - Earlier-spec tests changed or retired: `live/copy.test.ts`, `desk/occasions-desk.test.ts`, `QuestionRow.test.tsx`, `AuthorQuestions.test.tsx`, any `WriteForm*.test.tsx` that pins a changed string; name each.
  - Copy evidence: tone-check for `live/copy.ts` and `desk/copy.ts`.
  - Validation: `bash scripts/check.sh`.

- [x] 6. Published_Precision, formula inputs and unsigned magnitudes
  - Agent: `data-dev` · Depends on: 1 · Estimated size: S, ~400 changed lines
  - Scope: `src/lib/figures/published-precision.ts` (new), `src/lib/figures/formula-input.ts` (new), `src/lib/figures/decimal.ts` (`roundDecimal`), `src/lib/figures/format-change.ts`, `src/lib/figures/index.ts`, and the `*.test.ts` next to each.
  - Design sections: "8. Change line, formula and Published_Precision" (the `src/lib/figures` parts), Properties 5 and 6.
  - Owner decision: open question 2 (Oil Bulletin published precision), the default: no row, so Tomás's formula keeps the stored value in full. Add no Oil Bulletin row.
  - Steps:
    1. Open the EIA pages for `EMM_EPMR_PTE_NUS_DPG` and `EMD_EPD2D_PTE_NUS_DPG`. Add a row for each only if the page prints values at a fixed number of decimals, with the URL and the date checked. Quote what the page showed in a commit message body. Infer nothing from the stored values (8.6).
    2. Add `roundDecimal` (BigInt, half away from zero, no `Number`) and `formulaInput` as in the design.
    3. `formatChange` adds `differenceMagnitude` and `percentMagnitude` from the same values as the signed strings. The signed strings do not change.
  - Acceptance:
    - [ ] 6.1 Precision table, `roundDecimal` and `formulaInput`
      - A source-scan test bans `Number(` and `parseFloat` in the new files.
      - _Requirements: 8.4, 8.5, 8.6_
    - [ ] 6.2 Unsigned magnitudes in `formatChange`
      - "unchanged" gives zero magnitudes at the row decimals.
      - _Requirements: 8.2, 8.5_
    - [ ] 6.3 Write property test for formula inputs
      - **Property 5: Formula inputs keep the published decimals**
      - **Validates: Requirements 8.4, 8.6**
    - [ ] 6.4 Write property test for display precision
      - **Property 6: Display precision never changes a result**
      - **Validates: Requirements 8.5, 16.3**
  - Earlier-spec tests changed or retired: `format-change*.test.ts` if it asserts the exact shape of `ChangeDisplay`; name any.
  - Validation: `bash scripts/check.sh`.

- [ ] 7. The figure card: At opening, the change line, the formula and one rescale note
  - Agent: `frontend-dev` · Depends on: 3, 6 · Estimated size: M, ~900 changed lines
  - Scope: `src/components/reveal/copy.ts`, `src/components/ceremony/copy.ts`, `src/components/reveal/ChangeLine.tsx`, `formula.ts`, `FigureEntry.tsx`, `FigureLine.tsx`, `change-display.ts`, `ReceiptCard.tsx`, `FiguresThenNow.tsx`, `src/components/ceremony/figures/NumberLine.tsx`, and the `*.test.ts(x)` next to each.
  - Design sections: "7. At opening", "8. Change line, formula and Published_Precision" (the reveal parts), "9. One rescale note per card", Properties 3, 4, 7 and 13.
  - Owner decision: open question 3 (one label for every letter kind), the default: "At opening" on every letter kind, with the figure's own period beside it.
  - Steps:
    1. `REVEAL_COPY.now` and `CEREMONY_COPY.lineNow` become "At opening", and `numberLineAlt` and `numberLineAltNoAnswer` follow (item 2). `figureLabel(figure, "now", "persona")` returns `labelHistoricalRecord`; fixture and self-reported branches stay first.
    2. `ChangeLine` prints `{direction} {differenceMagnitude} · {percentMagnitude} · {then period} to {now period}` (design item 10) and drops its `display` prop. `readableFormula` takes its inputs from `formulaInput` and keeps the signed result. `FigureEntry` passes `k` (3 for EUR per 1,000 litres, else 0).
    3. `rescaledNote` takes its new value. `receiptFigureOf` stops setting `note`, `ReceiptFigure.note` goes, and `ReceiptCard` prints `rescaleNoteFor(figures)` once, on every branch of `FiguresThenNow`.
    4. Same-period and not-comparable cards keep showing no change line and no formula.
  - Acceptance:
    - [ ] 7.1 "At opening" and the persona retrieval label
      - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9_
    - [ ] 7.2 Unsigned change line and the formula at published precision
      - Maya's regular gasoline reads "fell 0.57 · 15.8% · {then period} to 4 Nov 2024". A test fails if the change line's class differs by direction.
      - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.7, 8.8, 16.4_
    - [ ] 7.3 One rescale note per card
      - Tomás's card shows "Shown in EUR per litre. Published in EUR per 1,000 litres." once; "As published" keeps the stored value and unit.
      - _Requirements: 9.1, 9.2, 9.3, 9.4_
    - [ ] 7.4 Write property test for the change line
      - **Property 3: The change line carries no sign**
      - **Validates: Requirements 8.1, 8.2**
    - [ ] 7.5 Write property test for the formula result
      - **Property 4: The formula's result matches the change**
      - **Validates: Requirements 8.3, 8.5**
    - [ ] 7.6 Write property test for the rescale note
      - **Property 7: One rescale note per card**
      - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**
    - [ ] 7.7 Write property test for the at-opening label
      - **Property 13: The now figure's label follows the letter kind**
      - **Validates: Requirements 7.5, 7.6**
  - Earlier-spec tests changed or retired: `ChangeLine.test.tsx`, `change-line.property.test.ts`, `formula.property.test.ts`, `FormulaLine.test.tsx`, `ReceiptCard.formula.test.tsx`, `FigureLine.test.tsx`, `eu-persona-labels.test.tsx`, `NumberLine*.test.tsx`; name each.
  - Copy evidence: tone-check for `reveal/copy.ts` and `ceremony/copy.ts`.
  - Validation: `bash scripts/check.sh`.

- [ ] 8. Receipts order, the live column and sound in the Top_Bar
  - Agent: `frontend-dev` · Depends on: 7 · Estimated size: M, ~800 changed lines
  - Scope: `src/components/reveal/Reveal.tsx`, `src/components/reveal/receipts.module.css`, `src/components/ceremony/letter/LetterBlock.tsx` (only if `collapsible` needs a change), `src/components/ceremony/CeremonyRoot.tsx`, `src/components/ceremony/scene/SceneShell.tsx`, `src/components/ceremony/scene/` Top_Bar sound slot, `src/components/reveal/OpeningFlow.tsx`, `src/app/demo/live/**`, `src/app/l/[id]/**`, and the `*.test.ts(x)` next to each.
  - Design sections: "10. Receipts order and live step 6", Property 8.
  - Steps:
    1. `foldLetter = stage === 3 && figureCount > 0`. With it: pairs, figures, `LetterPaper` `collapsible` and `still`, seal line, end card. Without it: today's order. `collapsible` no longer reads `isPhone`. "Show everything" lands on stage 3 and follows the same rule.
    2. `.receipts` gains `inline-size: 100%`, `max-inline-size: var(--content-column-max)` and `margin-inline: auto`, so the persona column and the live Reveal_Host share one width and centre.
    3. `CeremonyRoot` renders no `SoundToggle` or `soundNote` in any mode. `SceneShell`'s plain variant takes an optional `sound` prop, set on `/demo/live` and `/l/{id}`; the slot is reserved with `visibility: hidden` until `OpeningFlow` reports through `SoundSlotContext` that it has mounted.
  - Acceptance:
    - [ ] 8.1 Receipts order with the folded letter
      - The `details` is closed on first render and opens on activation; under Calm it opens with no motion.
      - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.8_
    - [ ] 8.2 One live column and sound only in the Top_Bar
      - A test fails if a sound control renders inside the receipts column.
      - _Requirements: 10.6, 10.7_
    - [ ] 8.3 Write property test for the receipts order
      - **Property 8: The receipts order does not depend on direction**
      - **Validates: Requirements 10.1, 10.4, 10.5, 10.8, 16.4**
  - Earlier-spec tests changed or retired: `Reveal.receipts-order.test.tsx`, `Reveal.no-figures.test.tsx`, `CeremonyRoot.test.tsx`, `topbar-sound.test.tsx`, `LetterBlock*.test.tsx` if it pins the phone-only fold; name each.
  - Validation: `bash scripts/check.sh`; `node scripts/check-js-budget.mjs` after `npm run build` (the Top_Bar sound slot touches `/demo/live` and `/l/{id}`).

- [ ] 9. The number field waits until you finish
  - Agent: `frontend-dev` · Depends on: 3 · Estimated size: S, ~400 changed lines
  - Scope: `src/components/ceremony/recall/recall-field.ts`, `RecallPager.tsx`, `src/components/ceremony/copy.ts` (`numberUnreadable` only if 11.7 calls for it), and the `*.test.ts(x)` next to each.
  - Design sections: "11. Number field", Property 9, item 11.
  - Steps:
    1. `FieldState` gains `checked`. Add `isUnreadable`, `checkField` and `unreadableShown`. `typeText` keeps `checked` only while the text stays unreadable. `setFromScale` and `pickReading` clear it.
    2. `RecallPager` takes the message, `aria-invalid` and `aria-describedby` from `unreadableShown`. Apply `checkField` on blur, in `handleSubmit`, and on `onPointerDownCapture` of the `NavRow` container. Next stays disabled while the field is unresolved.
    3. Open `revenant.devclef.se`, reach a figure question, type unreadable text, blur, and record which example the message shows. If it differs from "1085.70", say why (11.7).
  - Acceptance:
    - [ ] 9.1 The message waits for blur or an attempt to advance
      - "4." and "12a" show no message and no `aria-invalid` while focused; after blur "12a" shows both; the next readable or empty edit clears them.
      - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_
    - [ ] 9.2 Write property test for the number field
      - **Property 9: The number message waits for a check**
      - **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6**
  - Earlier-spec tests changed or retired: `RecallPager.field.test.tsx` (message on first paint of "12a"), `recall-field*.test.ts`; name each.
  - Validation: `bash scripts/check.sh`.

- [ ] 10. Break the seal says what happened
  - Agent: `frontend-dev` · Depends on: 3 · Estimated size: S, ~250 changed lines
  - Scope: `src/components/ceremony/copy.ts`, `src/components/ceremony/seal/SealBreak.tsx`, `src/components/reveal/Reveal.tsx` (the `recorded` prop only), `src/test/retired-phrases.test.ts` (pending list), and the `*.test.ts(x)` next to each.
  - Design sections: "3. Remember, the Remembered_Phrase and the break line" (the break line).
  - Steps:
    1. `testimonyRecorded` and `stageLive.marks` become "What you remembered is recorded." Add `recollectionsRead`.
    2. `SealBreak` takes `recorded`. `Reveal` passes `testimony !== undefined`, so Priya gets `false` and the `recollectionsRead` line.
    3. Remove the pending entries this task clears. After this task and task 3, only task 13's entries remain.
  - Acceptance:
    - [ ] 10.1 One plain break line per letter kind
      - The break screen shows exactly one of the two lines once on the live demo, a real letter, a fuel persona and Priya. Neither line has an exclamation mark, "wrong", "caught" or a retired word.
      - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_
  - Earlier-spec tests changed or retired: `SealBreak*.test.tsx`, `LiveRegion*.test.tsx`, `ceremony-gates.property.test.tsx` if it pins the line; name each.
  - Copy evidence: tone-check for `ceremony/copy.ts`.
  - Validation: `bash scripts/check.sh`.

- [ ] 11. The persona Remember step names its date once
  - Agent: `frontend-dev` · Depends on: 9, 10 · Estimated size: S, ~350 changed lines
  - Scope: `src/components/ceremony/recall/RecallPager.tsx`, `RecallReader.tsx`, `src/components/reveal/TestifyContext.tsx`, `ReadingTestify` (its file under `src/components/reveal/`), `src/components/reveal/copy.ts`, and the `*.test.ts(x)` next to each.
  - Design sections: "12. Persona date once", item 6, Property 11.
  - Owner decision: open question 7 (the fuel persona memory line names the month), the default: kept; it is a month, not the written-as-of date.
  - Steps:
    1. `RecallPager` stops filling `{date}` in `recallIntro`. `TestifyContext` and `ReadingTestify` drop "Written as of {date}" and keep the opening-date line and the memory line.
    2. `RecallReader` (Priya) drops the date from the counter and adds "As of {date} you asked yourself:" above each question from `REVEAL_COPY.askedAsOf`.
    3. Leave the live and `/l/{id}` "On {date} you asked yourself:" line unchanged.
  - Acceptance:
    - [ ] 11.1 One written-as-of date per persona Remember screen
      - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_
    - [ ] 11.2 Write property test for the persona date
      - **Property 11: A persona Remember screen names its date once**
      - **Validates: Requirements 13.1, 13.2, 13.4, 13.5**
  - Earlier-spec tests changed or retired: `written-on.property.test.ts`, `RecallReader*.test.tsx`, `TestifyContext*.test.tsx`, `RecallPager*.test.tsx` that pin the date in the intro; name each.
  - Copy evidence: tone-check for `reveal/copy.ts` if changed.
  - Validation: `bash scripts/check.sh`.

- [ ] 12. Press the seal, quick and solemn
  - Agent: `frontend-dev` · Depends on: 5 · Estimated size: S, ~450 changed lines
  - Scope: `src/components/live/copy.ts`, `src/components/live/press/copy.ts`, `src/components/live/press/press-status.ts`, `src/components/live/seal-step/seal-steps.ts`, `src/components/live/seal-step/seal-step.module.css`, the Seal step component under `src/components/live/seal-step/`, and the `*.test.ts(x)` next to each.
  - Design sections: "13. Press the seal", items 8 and 9, Property 12.
  - Owner decision: open question 8 (the `stepPasskeyMade` wording), the default: "Passkey made. Saved as "Revenant demo".". Open question 9 (layout from 900 px), the default: the intro block spans both columns above the wax.
  - Steps:
    1. Change `sealParagraph`, `stepOneHint` and `stepPasskeyMade`.
    2. Press one's hint is `stepOneHint` while pending or current and `stepPasskeyMade` once done. Press two's hint is null in `created` and `stepTwoHint` in `confirming`.
    3. From 900 px, the heading, paragraph and warning sit in a `data-seal-intro` block spanning both columns. No disclosure wraps the warning. Below 900 px the single column is unchanged. List the difference from spec 15 screens 9 to 15 in a commit message body as expected.
    4. The presses, backup choice, cross-device help and no-PRF path keep their code.
  - Acceptance:
    - [ ] 12.1 Seal step strings, hints and layout
      - A CSS source test finds the warning in the spanning intro block from 900 px.
      - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8_
    - [ ] 12.2 Write property test for the Seal step text
      - **Property 12: Press the seal shows each sentence once**
      - **Validates: Requirements 14.1, 14.2, 14.6, 14.7**
  - Earlier-spec tests changed or retired: `seal-steps.test.ts`, `SealSteps.test.tsx`, `seal-step-copy.test.ts`, `seal-step-css.test.ts`, `press*.test.*`; name each with its reason.
  - Copy evidence: tone-check for `live/copy.ts` and `press/copy.ts`.
  - Validation: `bash scripts/check.sh`.

- [ ] 13. What we resurrected, short
  - Agent: `frontend-dev` · Depends on: 3, 4 · Estimated size: S, ~300 changed lines
  - Scope: `src/components/landing/copy.ts`, `src/components/landing/ResurrectionSection.tsx`, `src/components/landing/NoSealSection.tsx`, `src/components/landing/landing.module.css` if needed, `src/test/retired-phrases.test.ts` (pending list), and the `*.test.ts(x)` next to each.
  - Design sections: "14. Home section".
  - Owner decision: open question 5 (the maker's story wording, unsigned, under "Why I built it"), the default: the proposed wording.
  - Steps:
    1. `resurrectedBody` becomes one sentence and `noSealBody` its new two sentences. Add `makerTitle` and `makerBody`. Delete `noSealTitle`.
    2. `ResurrectionSection` renders the heading, `resurrectedBody`, `noSealBody`, then an `h3` with `makerTitle` and `makerBody`. The `sealMapping` table goes from the home page. `/how-it-is-sealed` keeps it, and the footer link stays.
    3. `src/app/page.tsx` is platform-dev's and still renders `NoSealSection`. Make `NoSealSection` render `null` and say in a commit message body that task 15 drops it from `page.tsx` and task 16 deletes the file.
    4. Remove the last pending entries. The pending list is then empty; leave the mechanism in place.
  - Acceptance:
    - [ ] 13.1 The short section and the maker's story
      - A test checks at most three sentences for 15.1, at most two in `makerBody`, at most 25 words per sentence, and no `sealMapping` table on `/`.
      - _Requirements: 2.7, 15.1, 15.2, 15.3, 15.4, 15.5, 15.7, 15.9_
  - Earlier-spec tests changed or retired: `landing-sections.test.tsx` (the four-sentence limit, "a letter in it can hold any part of life", the `NoSealSection` render); name each.
  - Copy evidence: tone-check for `landing/copy.ts`.
  - Validation: `bash scripts/check.sh`.

- [ ] 14. README and video script
  - Agent: `platform-dev` · Depends on: 4, 8, 13 · Estimated size: S, ~300 changed lines
  - Scope: `README.md`, `docs/video-script.md`, `src/test/docs-wording.test.ts` (new).
  - Design sections: "15. QA tooling and docs" (the docs part).
  - Owner decision: open question 6 (pictures with old words), the default: not redrawn; the README image alt text keeps "Testify".
  - Steps:
    1. README line 3 and `docs/video-script.md` lines 5 and 24 take the headline exactly as in 5.1 and 5.6. Rename the step to Remember and describe the receipts order of 10.1. README line 18 says "English teacher" and "fifteen years".
    2. Keep the README image alt text naming the words the image shows. Keep the provenance comments in the video script correct.
    3. Add `docs-wording.test.ts` as in the design.
  - Acceptance:
    - [ ] 14.1 Docs say Remember, the headline and the receipts order
      - _Requirements: 5.6, 15.8, 17.4, 17.5_
  - Earlier-spec tests changed or retired: any test that reads `README.md` or the video script; name each.
  - Validation: `bash scripts/check.sh`.

- [ ] 15. Layout rows, the Live_Walk names and `page.tsx`
  - Agent: `platform-dev` · Depends on: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14 · Estimated size: M, ~1,000 changed lines
  - Scope: `tools/qa/layout-check.mjs`, `tools/qa/journey-check.mjs`, `src/test/integration/live-walk*.ts`, `src/app/page.tsx`, and the tests that cover them.
  - Design sections: "15. QA tooling and docs".
  - Steps:
    1. Add the layout-check rows of 17.3 (receipts order and closed letter, live column centre and width, the warning above the wax, the hero line boxes), each at both sizes. Each row's helper has a passing and a failing example.
    2. Update every step name and string in `layout-check.mjs`, `journey-check.mjs` and the walk that this spec renamed (4.8). The walk asserts the tracks of 2.1 on `/demo/live` and each persona at both sizes.
    3. Drop `NoSealSection` from `src/app/page.tsx` (task 13's note).
    4. A row or step that fails because of a product file is listed under "For task 16" with its name, output and suspected file. This task edits no product file other than `page.tsx` and lowers no threshold.
  - Acceptance:
    - [ ] 15.1 Layout rows of 17.3
      - _Requirements: 17.3_
    - [ ] 15.2 Walk and tool names, and `page.tsx`
      - _Requirements: 4.8, 15.2, 17.1, 17.2_
  - Earlier-spec tests changed or retired: the layout-check and walk tests whose rows or steps change; name each.
  - QA: `npm run layout-check` against a local production build with the result lines quoted; the helper tests; one `npm run live-walk` run (Press_Test included).

- [ ] 16. Fix-up: fix every product failure the rows and the walk report
  - Agent: `frontend-dev` · Depends on: 15 · Estimated size: M, ~800 changed lines
  - Scope: frontend-dev paths only, plus the `*.test.ts(x)` next to each file. It does not edit `tools/qa/` or `src/test/` (other than its own new tests next to product files), a layout row, a threshold or a walk step.
  - Steps:
    1. Delete `src/components/landing/NoSealSection.tsx` and its test, now that `page.tsx` no longer imports it.
    2. Start the local stack (a Postgres container whose name contains "test", `npm run db:migrate`, `npm run build`, `npm run seal-personas`, the app on port 3000). Put `DATABASE_URL` in front of each command; never export, commit or log it.
    3. Run `npm run layout-check -- --url http://localhost:3000` and `npm run live-walk`. Read "For task 16" in task 15's commit notes first.
    4. For each failure, fix the product file, rebuild and rerun until both pass. If a row or step is itself wrong, say so in the commit notes and leave it.
    5. Stop the app and remove the container, even if something failed.
  - Acceptance:
    - [ ] 16.1 Fix until both pass
      - The last commit body states the `main` SHA the branch started from, the final SHA and the passing result lines.
      - _Requirements: 15.2, 17.1, 17.2, 17.3_
    - [ ] 16.2 A test for each product fix
      - A markup or CSS source test that fails before the fix and passes after. None when nothing failed.
      - _Requirements: 17.8_
  - Earlier-spec tests changed or retired: `NoSealSection` tests (file deleted), and any test a fix changes.
  - QA: rerun both commands on the final commit and quote their result lines.

- [ ] 17. Final walk on merged `main`, report only
  - Agent: `platform-dev` · Depends on: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 · Estimated size: S, one empty commit
  - Scope: none. The record is the body of one empty commit (`git commit --allow-empty`). It changes no file.
  - Steps:
    1. On merged `main`, start the local stack as in task 16 and run `npm run live-walk` (Press_Test included) and `npm run layout-check -- --url http://localhost:3000`. Stop the app and remove the container afterwards.
    2. Open each persona letter and confirm its seal check passes with its hash from `1183739`.
    3. List every screen (route, step, viewport) where a string or order from this spec differs from its spec 15 shot under `docs/design/15-flow/shots/`, each marked as an expected difference, plus any other visible difference.
    4. The commit body states the full `main` SHA, every result line of both commands and the list. If any check fails, report the check, route and viewport and leave the task open.
  - Acceptance:
    - [ ] 17.1 Run the walk and record it
      - _Requirements: 16.1, 16.2, 17.6, 17.7_

## Notes

- Steering edits (Requirements 2.10, 10.9, 15.6, and the tagline in `product.md` for 5.6) ship in the spec PR, made by the owner. No task touches `.kiro/`.
- Requirement 4.8 asks the task that renames a string to update `tools/qa/` in the same change. `tools/qa/` is platform-dev's and the rename tasks are frontend-dev's, so `live-walk-helpers.ts` (shared) is updated in task 3 and `tools/qa/` in task 15. Until then QA records those rows as `EXPECTED: renamed by spec 16`.
- Task 2's pending list keeps `bash scripts/check.sh` green while tasks 3, 10 and 13 remove the retired words one area at a time. It is empty after task 13.
- `NoSealSection.tsx` is removed in three steps (task 13 renders `null`, task 15 drops it from `page.tsx`, task 16 deletes it) because `src/app/page.tsx` is platform-dev's.
- Task 6 needs network access to open the EIA pages. Its tests stay offline.
- The owner decided every open question on review: the design's default. The tasks that build one say "Owner decision": 1 (OQ4), 3 (OQ1, OQ8), 6 (OQ2), 7 (OQ3), 11 (OQ7), 12 (OQ8, OQ9), 13 (OQ5), 14 (OQ6).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["2.1", "6.1", "6.2"] },
    { "id": 3, "tasks": ["2.2", "6.3", "6.4"] },
    { "id": 4, "tasks": ["3.1"] },
    { "id": 5, "tasks": ["3.2"] },
    { "id": 6, "tasks": ["4.1", "5.1"] },
    { "id": 7, "tasks": ["7.1", "7.2", "9.1", "12.1", "13.1"] },
    { "id": 8, "tasks": ["7.3", "9.2", "10.1", "12.2"] },
    { "id": 9, "tasks": ["7.4", "7.5", "7.6", "7.7", "11.1"] },
    { "id": 10, "tasks": ["8.1", "11.2"] },
    { "id": 11, "tasks": ["8.2"] },
    { "id": 12, "tasks": ["8.3"] },
    { "id": 13, "tasks": ["14.1"] },
    { "id": 14, "tasks": ["15.1", "15.2"] },
    { "id": 15, "tasks": ["16.1"] },
    { "id": 16, "tasks": ["16.2"] },
    { "id": 17, "tasks": ["17.1"] }
  ]
}
```
