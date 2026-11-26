# Implementation Plan: 20 Easier sealing and receipts

## Overview

Spec 20 has four parts. `requirements.md` says what must hold, and `design.md` says which files change and how.

- **Part C:** a plain Seal_Button under the wax, driven by the same Press_Controller, and a status line that names both ways to press.
- **Part D:** at stage 3 with figures the letter stays open, in its own sticky column at 900 px and wider. The fold is removed.
- **Part A:** "Seal with a backup key instead" is always on the Seal_Step. It seals with the Backup_Wrap only, and "Not now" returns to the Seal_Step.
- **Part B:** on `/demo/live` only, an opt-in Simulated_Mode runs the two presses through an in-memory Simulated_Port, and the backup key is required.

| Task | Part | What | Role | Depends on |
|---|---|---|---|---|
| 1 | C | Layout_Check P1 accepts the Seal_Button as the second orange control | platform-dev | none |
| 2 | C | Seal_Button, `activate()`, the Press_Status_Line and the press copy, with the Part C walk | frontend-dev | 1 |
| 3 | D | Layout_Check readings for the open letter, gated on the split marker | platform-dev | none |
| 4 | D | Open letter on the receipts: one slot, LetterColumn, split CSS, fold removed | frontend-dev | 3 |
| 5 | D | Docs, Layout_Check cleanup and the Part D receipts walk | platform-dev | 4 |
| 6 | A | Seal machine origin and `useSealFlow.onBackupOnlyStart` | frontend-dev | 2 |
| 7 | A | Backup_Only_Start on the Seal_Step, BackupFallback origin and focus, with the Part A walk | frontend-dev | 6 |
| 8 | B | Simulated_Port in `src/lib/crypto/` | crypto-dev | none |
| 9 | B | Simulated_Mode on `/demo/live`, with the Part B walk | frontend-dev | 7, 8 |
| 10 | all | Final verification on merged `main`, report only | platform-dev | 1 to 9 |

Part C (tasks 1 and 2) and Part D (tasks 3 to 5) depend on nothing in Parts A or B, and each part leaves `main` releasable when its last task merges. Part A follows Part C only because both edit `SealStep.tsx` and the seal-page-demo goldens. Task 8 can run at any time, alongside Part A. Task 9 needs both task 7 and task 8.

Ownership is taken from `.github/agents.json`. `src/components/**` and `src/app/**/*.tsx` are frontend-dev's. `src/lib/crypto/**` is crypto-dev's. `README.md`, `docs/video-script.md`, `tools/qa/**` and `src/lib/*.test.ts` are platform-dev's. Every `src/**/*.test.ts(x)` file and `src/test/integration/**` are shared, so the walks under `src/test/integration/` can be written by the role whose part they check.

Each task is one GitHub issue and one PR for one role, inside that role's paths (plus `shared`) and under `max_changed_lines` (5,000, test files excluded). An issue starts only when every task it depends on is closed.

## Decisions (fixed)

- **The layout gate forces the Part C and Part D order.** CI always runs `tools/qa/layout-gate.mjs`. That gate blocks on any new failure of a row in `SPEC15_CHECKS`, which includes `R10.1` and `R10.6`. Today `R10.1` fails unless the letter is folded (`letterClosed`). A frontend PR that opens the letter would fail CI, and frontend-dev cannot edit `tools/qa/**`. So task 3 (platform-dev) lands first. It adds the new readings and picks the new or old reading by whether `[data-receipts][data-receipts-layout="split"]` is present. Task 4 then sets that marker. Task 5 removes the old reading. Row `P1` is polish-level in the gate, so task 1 is not strictly blocking, but it lands first so that Part C's reports are clean (Requirement 1.10 replaces spec 13 P1.3).
- **The design's open-question defaults hold.** Demo_Mode treats `fallback_key` as owning its heading (one h1). The Letter_Column has its own scroll while the letter overflows. `LIVE_COPY.simulatedUnavailable` is added. `REAL_COPY.intro` gets the design's new text in task 7, which the owner may strike in review. The Part C walk under Calm uses a pointer down with no release. The Letter_Page notice for a Simulated_Letter is unchanged (Requirement 14.7). A follow-up spec could change it.
- **Copy is final as written** in design.md sections 1.5, 3.5 and "Data Models, Copy".

## Rules for every task

- **Baseline.** "The baseline" is `c2bf2db8`, the commit requirements.md and design.md were written against. The first task that touches an area re-reads the code facts in requirements.md for that area and reports any difference in a commit message body under "Decisions".
- **Branch and PR.** The dispatcher creates `agent/<role>/issue-N` and the PR "Closes #N". Do not push to `main` or merge. After a hook failure, make a new commit. Do not amend.
- **Scope.** Change only files that match your role's paths in `.github/agents.json` (or `shared`) and are listed in your task's Scope, plus new `*.test.ts(x)` files next to the code they test. Check your diff with `git diff --name-only origin/main` before you finish and put the list in a commit message body.
- **Frozen paths (Requirement 15).** No task adds, removes, renames or changes a file under `src/app/api/`, `src/lib/seal-format/`, `src/lib/letter-store/`, `src/lib/db/`, `drizzle/` or `deploy/helm/`, or `.env.example`, `package.json` or `package-lock.json`. No task adds, removes or renames a `process.env` name read by non-test code under `src/` or `scripts/`. No task changes `src/lib/feature-flags.ts`, `press/press-hold.ts` or `press/constants.ts`. No task changes `LiveLetter.tsx`, `UnlockView.tsx`, `unlock.ts`, `seal-runner.ts`, `build-payload.ts`, `api.ts` or anything under `src/app/l/**` (Requirement 14.7). Only task 8 touches `src/lib/crypto/`, and only by adding files and adding export lines to `src/lib/crypto/index.ts` (Requirement 15.2). No task changes a file under `.kiro/`, `.github/`, `tools/agents/`, `tools/dispatcher/`, `tools/hooks/` or `scripts/check.sh`. If a task finds it needs a change in a frozen path, it stops before making it and states the path, the change and the reason in a commit message body (Requirement 15.8).
- **Goldens (Requirement 17.3).** `src/components/live/__golden__/seal-draft/` never changes, and `seal-draft.golden.test.tsx` passes without `RECORD_GOLDEN` on every task's head commit (Requirement 15.4). A task that changes Demo_Mode Seal_Step markup (tasks 2, 7 and 9) re-records only the affected files under `src/components/live/__golden__/seal-page-demo/` with `RECORD_GOLDEN=1` in the same PR, then runs `SealPage.demo-golden.test.tsx` without `RECORD_GOLDEN` and sees it pass. The commit body lists the path of every changed golden file and says why each changed. Every other task leaves both golden folders unchanged.
- **Tests (Requirement 17.1).** Vitest in Node with no DOM library: pure reducer and press-model tests, runner and `useSealFlow` tests with a fake port, `renderToStaticMarkup`, and source scans. Every `fetch` is stubbed. No network, `DATABASE_URL` unset. No dependency is added. Property tests use fast-check with `numRuns` of at least 100, one `it` block per property, and the tag `// Feature: 20-easier-sealing-and-receipts, Property N: <title>` with the title from design.md.
- **Changed tests.** A test may change only where it pinned behaviour this spec replaces (the fold, the single orange control, the absent `fixFields` line on the Seal_Step, `FALLBACK_DECLINE` always going to `cannot_lock`, the old press copy). The commit body names each changed test by file and test title, with its reason ("none" if empty). No task deletes a test that pinned replaced behaviour instead of rewriting it, and no task adds `.skip`, `.only` or `.todo` (Requirements 6.9, 17.8).
- **Copy (Requirement 16).** Every new or changed user-facing string goes in `LIVE_COPY` or `REAL_COPY` in `src/components/live/copy.ts`, `PRESS_COPY` in `src/components/live/press/copy.ts`, or `REVEAL_COPY` in `src/components/reveal/copy.ts`. No JSX text node or string-literal `aria-label`, `title`, `placeholder` or `alt` adds reader-facing words. No exemption list gains an entry. Each copy task adds its keys by name to `src/components/live/seal-copy-tone.test.ts` (created in task 2) and states in a commit message body the result of `node tools/hooks/tone-check.mjs <file>` for every copy file it changed.
- **Walks (Requirement 17.9).** Walks live under `src/test/integration/`, are skipped unless `WALK=1`, and exit 0 when skipped. With `WALK=1` each walk reports every check as pass or fail with its route, viewport, expected and observed result. The task lists those results in a commit message body. A walk that needs a local Postgres uses a container whose name contains "test", with `DATABASE_URL` set per command and never exported, committed or logged. The container is removed afterwards, even on failure.
- **Done check (Requirement 17.8).** On the head commit, `npx vitest run src/components src/lib src/app` and `bash scripts/check.sh` both exit 0. Each task also runs its own narrower command, listed under "Validation". The commit body states the final commit SHA and both exit codes.
- **Reports.** Anything a requirement asks for "in the PR description" goes in a commit message body on the task's branch, kept short (bodies are cut at 12,000 characters).
- If `design.md` and the code on `main` disagree, re-read the code, keep the design's behaviour, and say what you changed and why in a commit message body under "Decisions". If the disagreement touches the sealed payload, the request bodies or a frozen path, stop instead.

## Tasks

- [x] 1. Part C: Layout_Check P1 accepts the Seal_Button as the second orange control
  - Agent: `platform-dev` · Depends on: none · Estimated size: S, ~120 changed lines
  - Follow 'Rules for every task' in tasks.md.
  - Scope: `tools/qa/layout-check.mjs` (only `p1Failures`, its page reader and the P1 row comment), `src/lib/layout-check-p1.test.ts` (new) or the existing `src/lib/*.test.ts` that pins `p1Failures`.
  - Design sections: Components 1.3 ("Orange").
  - Steps:
    1. `p1Failures` takes `sealButtonIsAccent` and `accentCount`. It passes when the orange controls are the Press_Envelope alone, or the Press_Envelope plus one `[data-seal-button]` inside `[data-press-column]`. Any other orange control fails with a P1.3 reason that names the count. The page reader counts `[data-seal-button]` separately. Today's build, with no Seal_Button, still passes.
    2. Rewrite the P1 row comment and the threshold text ("the Press_Envelope and at most the Seal_Button are orange").
  - Acceptance:
    - [ ] 1.1 P1.3 reads two orange controls
      - _Requirements: 1.10_
    - [ ] 1.2 Unit tests for `p1Failures`
      - One orange press passes. Press plus Seal_Button passes. Press plus any other orange control fails. Seal_Button with a non-orange press fails.
      - _Requirements: 1.10_
  - Earlier-spec tests changed or retired: any test pinning "exactly one orange control" in P1. Name each.
  - Validation: `npx vitest run src/lib` and `bash scripts/check.sh`.

- [ ] 2. Part C: Seal_Button, `activate()`, the Press_Status_Line and the press copy
  - Agent: `frontend-dev` · Depends on: 1 · Estimated size: M, ~700 changed lines plus goldens
  - Follow 'Rules for every task' in tasks.md.
  - Scope: `src/components/live/press/usePressEnvelope.ts`, `press/PressEnvelope.tsx`, `press/copy.ts`, `seal-step/SealStep.tsx`, `seal-step/SealButton.tsx` (new), `seal-step/seal-button.ts` (new), `seal-step/press-status.ts`, `seal-step/seal-step.module.css`, `src/components/live/WriteForm.tsx` (only `fieldProblem` for the Seal_Step), `src/components/live/copy.ts` (only `REAL_COPY.stepOneHint`), `src/components/live/__golden__/seal-page-demo/**`, the tests named below, `src/test/integration/seal-button-walk.test.ts` (new).
  - Design sections: Components 1.1 to 1.5, Data Models ("Press controller", "New props"), Properties 1 to 4, Testing Strategy "Part C".
  - Steps:
    1. Add `activate()` to `PressController` and `UsePressEnvelope` exactly as in design 1.1. It does nothing in `inert`, calls `onAttempt` while disabled, and otherwise sends one `ACTIVATE` through `apply`. Nothing awaits between the call and the press handler. `down`, `up`, `cancel`, `tick` and `click` stay unchanged.
    2. Split `PressEnvelope` into `PressEnvelopeView` (today's markup, takes `press` and `lineId`) and `PressEnvelope` (same props as today, calls `useId` and `usePressEnvelope`, renders the view). The `all` form in `WriteForm.tsx` keeps using `PressEnvelope`.
    3. `SealStep` owns `useId()` for the line and calls `usePressEnvelope`. It renders `PressEnvelopeView`, then `SealButton`, then `SealSteps` inside `[data-press-column]`. It resets the controller when the tag returns to `write`. `SealButton` is a native `type="button"` with `buttonStyles.primary` and `.sealButton`, `data-seal-button`, `aria-disabled` from `pressBlocked`, `aria-describedby` set to the line id and `onClick={onActivate}`. It has no pointer handlers, no `disabled` attribute and no `aria-label`.
    4. `sealButtonLabel(tag, simulated)` in `seal-step/seal-button.ts` returns `sealButtonCreate` for `write` and `creating` and `sealButtonSet` otherwise. In this task the `simulated` argument is accepted, and the simulated key is added in task 9.
    5. `pressStatusLine` gains `fieldProblem` (and an unused optional `simulated`, wired in task 9) with the precedence in design 1.4. `WriteForm` passes `fieldProblem={cryptoLoaded && state.tag === "write" && !buttonLive(state, problems)}` to `SealStep`.
    6. Change the press copy to the values in design 1.5 and add `PRESS_COPY.sealButtonCreate` and `sealButtonSet`. `.sealButton` sets `min-block-size` and `min-inline-size` to `2.75rem` and `margin-block-start: 1rem`.
    7. Re-record the affected `seal-page-demo` goldens (the line `useId` moves to `SealStep`, and the Seal_Button renders).
    8. Write the Part C walk.
  - Acceptance:
    - [ ] 2.1 Press_Controller `activate()` and the `PressEnvelope` split
      - _Requirements: 1.2, 1.3, 1.6, 1.7, 1.8, 1.11, 1.13_
    - [ ] 2.2 Write property test for one prompt per press
      - File: `src/components/live/press/press-activate.property.test.ts`.
      - **Property 1: One press starts at most one prompt across the Seal_Button and the wax**
      - **Validates: Requirements 1.2, 1.3, 1.6, 1.7**
    - [ ] 2.3 Write property test against the baseline wax
      - File: `src/components/live/press/press-oracle.property.test.ts`, holding a verbatim copy of the `c2bf2db8` `createPressController` with no export.
      - **Property 2: The wax behaves as at `c2bf2db8` when the Seal_Button is not used**
      - **Validates: Requirements 1.11, 1.13**
    - [ ] 2.4 Seal_Button, Press_Status_Line, copy and goldens
      - _Requirements: 1.1, 1.4, 1.5, 1.9, 1.10, 1.12, 1.14, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8, 16.1, 16.2, 16.3, 17.3_
    - [ ] 2.5 Write property test for the Seal_Button markup and label
      - File: `src/components/live/seal-step/seal-button.property.test.tsx`. In this task the Simulated_Mode flag is always false; task 9 widens it.
      - **Property 3: The Seal_Button and the wax agree, and the label follows the Seal_State**
      - **Validates: Requirements 1.1, 1.5, 1.9, 1.12, 2.8**
    - [ ] 2.6 Extend the property test for the status line
      - File: `src/components/live/seal-step/press-status.property.test.ts`, with `fieldProblem` added to the generator.
      - **Property 4: The Press_Status_Line is total and follows its precedence**
      - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.7**
    - [ ] 2.7 Unit, sync and copy tests
      - `usePressEnvelope.test.ts`: `activate()` in `write` and `setting`, full and instant, calls the handler once. Disabled `activate()` calls `onAttempt`. `inert` ignores it.
      - `seal-button.sync.test.ts`: with `useSealFlow`'s handlers and a fake crypto module whose `createPasskey` and `confirmPasskey` are spies, calling the Seal_Button's `onClick` leaves the spy count at 1 before the call returns, with no microtask flushed (Requirement 17.2 b).
      - A `useSealFlow` run with a fake port: two create activations and two confirm activations give 1 `create` and at most 1 `get` (Requirement 17.2 a).
      - `SealStep.test.tsx`: the button sits in `[data-press-column]` between the wax wrapper and the press list. `fixFields` shows with a field problem (the old absence assertion is rewritten). A source check finds no `onPointerDown` in `SealButton.tsx`.
      - `SealPage.test.tsx`: no `[data-seal-button]` on the `cannot_lock`, `cancelled`, `failed`, `fallback_key` and `sealed` screens.
      - `seal-step-css.test.ts`: `.sealButton` is at least `2.75rem` by `2.75rem`. The Back link, `.fallback` and the Backup_Choice cards have no `--accent` background, border or colour.
      - `src/components/live/seal-copy-tone.test.ts` (new): lists `PRESS_COPY.holdToSeal`, `pressToSeal`, `setting`, `fixFields`, `stepOneHint`, `stepTwoHint`, `sealButtonCreate`, `sealButtonSet` and `REAL_COPY.stepOneHint` by name. Each value is a non-empty string, `toneProblems` returns an empty list, and the value equals design 1.5.
      - _Requirements: 1.1, 1.4, 1.7, 1.10, 1.12, 1.13, 2.3, 2.5, 2.6, 16.2, 17.2_
    - [ ] 2.8 Part C QA walk
      - `src/test/integration/seal-button-walk.test.ts`, on `/demo/live` with the spec 06 QA stub (`window.__qa`), at 1440×900 and 390×844, full motion, one fresh page load per check, a letter written and the `card` choice made. Checks (a) to (e) and the Calm checks, exactly as in design "QA browser steps, Part C". Report every check with route, viewport, expected and observed result in a commit message body.
      - _Requirements: 17.4, 17.9_
  - Earlier-spec tests changed or retired: expected `SealStep.test.tsx` (the `fixFields` absence assertion), any press copy assertion pinning the old strings, and spec 13 tests pinning one orange control on the Seal_Step. Name each.
  - Copy evidence: tone-check for `live/press/copy.ts` and `live/copy.ts`.
  - Validation: `npx vitest run src/components/live` and the two golden tests from the rules, then the done check.

- [x] 3. Part D: Layout_Check readings for the open letter
  - Agent: `platform-dev` · Depends on: none · Estimated size: M, ~600 changed lines
  - Follow 'Rules for every task' in tasks.md.
  - Scope: `tools/qa/layout-check.mjs`, `src/lib/layout-check-spec16-rows.test.ts`.
  - Design sections: Components 2.6 ("`tools/qa/layout-check.mjs`"), Testing Strategy "QA browser steps, Part D".
  - Steps:
    1. Add `receiptsOrderFailures({ blocks, disclosurePresent, letterTextVisible })` and `splitColumnFailures({ record, letter, width, centre, viewportCentre, personaWidth })` as in design 2.6. Rename the current functions to `receiptsOrderFailuresFolded` and `receiptColumnFailures` (kept as is) for the transition.
    2. The page reader checks for `[data-receipts][data-receipts-layout="split"]`. With the marker, `R10.1` and `R10.6` use the new functions. Without it, they use the folded ones, so today's build still passes. The reader computes `disclosurePresent`, `letterTextVisible` (client rects and `checkVisibility()`), the column rects and the persona width.
    3. Add readings (c) to (g) of design "QA browser steps, Part D", as marker-gated rows that report `missing` when the marker is absent. These are: the column placement and the narrow one-column check, the sticky offset after scrolling, the focused heading in view, `animate` calls on the sheet counted by an init script with the node-identity check, and no `--accent` on figure text. Add the reduced-motion repeat of (f) and the long-letter check (a 5,000-character live letter at 1280×800: `tabindex="0"`, End scrolls the column, the last character comes into view).
    4. Keep `R10.1` and `R10.6` in `SPEC15_CHECKS`. Rewrite the row comments to describe both readings and say the folded one is removed by task 5.
  - Acceptance:
    - [ ] 3.1 New and transitional readings in the Layout_Check
      - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.8, 3.9, 5.1, 5.2, 5.3, 5.5, 5.6, 5.7, 6.6, 17.5_
    - [ ] 3.2 Unit tests for the pure failure functions
      - `receiptsOrderFailures` returns no failure for an open letter in order, a failure for a letter after the figures, a failure for a present disclosure and a failure for invisible letter text. `splitColumnFailures` fails on overlap, on tops more than 1 px apart, on a column under 280 px, on a centre more than 1 px off, and on a live width more than 1 px from the persona width.
      - _Requirements: 6.6_
  - Earlier-spec tests changed or retired: none. The folded-reading tests stay until task 5.
  - Validation: `npx vitest run src/lib` and `bash scripts/check.sh`.

- [ ] 4. Part D: the open letter on the receipts
  - Agent: `frontend-dev` · Depends on: 3 · Estimated size: M, ~700 changed lines
  - Follow 'Rules for every task' in tasks.md.
  - Scope: `src/components/reveal/Reveal.tsx`, `reveal/LetterColumn.tsx` (new), `reveal/own-scroll.ts` (new), `reveal/receipts.module.css`, `reveal/reveal.module.css`, `reveal/SealedLetter.tsx`, `reveal/copy.ts`, `src/components/ceremony/letter/LetterBlock.tsx`, `ceremony/letter/LetterBlock.module.css`, and the tests named below. `ceremony/stages.ts` does not change.
  - Design sections: Components 2.1 to 2.5, Data Models ("Receipts markup"), Properties 5 and 6, Testing Strategy "Part D".
  - Steps:
    1. In `Reveal.tsx`, remove `foldLetter` and the second letter slot. Render `letterStage` once, after the question pairs, inside `LetterColumn split={stage === 3 && figureCount > 0}`, with `still={jumpedToEnd}`. Set `data-receipts-layout="split"` on `[data-receipts]` at stage 3 with at least one figure.
    2. `LetterColumn` renders the `[data-letter-stage]` wrapper with today's classes plus `receiptsStyles.letterColumn`. While `useOwnScroll` reports overflow it adds `tabIndex={0}`, `role="region"`, `aria-label={REVEAL_COPY.stage2Title}` and `data-letter-scroll`. `useOwnScroll` returns false on the server and the first client render, uses a `ResizeObserver` while enabled, returns false when it is missing, and reads no viewport width.
    3. Add the split rules to `receipts.module.css` exactly as in design 2.3. Keep the `.receipts` `inline-size`, `max-inline-size` and `margin-inline` declarations. Set no colour.
    4. Remove the fold: drop `collapsible` from `LetterBlock`, `SealedLetter` and the `Omit` in `SealedLetterCaptionProps`. Remove `REVEAL_COPY.letterDisclosureSummary` and every `.letterDisclosure` CSS rule. Keep `REVEAL_COPY.letterDisclosure` byte-equal.
  - Acceptance:
    - [ ] 4.1 One letter slot, LetterColumn, split CSS and fold removal
      - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.7, 3.9, 3.10, 3.11, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 6.7_
    - [ ] 4.2 Rewrite the receipts order property test
      - File: `src/components/reveal/receipts-order.property.test.tsx`, rewritten (not deleted) to assert the open letter.
      - **Property 5: The receipts keep one open letter in one place**
      - **Validates: Requirements 3.1, 3.7, 3.10, 3.11, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 6.1, 6.8**
    - [ ] 4.3 Write property test for the letter components
      - File: `src/components/ceremony/letter/letter-no-fold.property.test.tsx`.
      - **Property 6: The letter components never fold**
      - **Validates: Requirements 6.2, 6.4**
    - [ ] 4.4 Unit tests, CSS pins and scans
      - `Reveal.receipts-order.test.tsx`, rewritten: Maya's letter and a live letter with one figure, from stage 2 and through "Show everything". Each stage-3 render has one `[data-letter-stage]`, no `[data-letter-disclosure]`, no `details` around the letter text, no "Read the letter again", the order of Requirement 4.1 and `data-receipts-layout="split"` (Requirement 17.2 g).
      - `SealedLetter.test.tsx`: the collapsible tests become "renders no disclosure for any props". `copy.test.ts`: `letterDisclosureSummary` is absent and `letterDisclosure` is byte-equal.
      - `receipts-column.test.ts` passes unchanged. `receipts-split-css.test.ts` (new) pins the split rule: inside `@media (min-width: 900px)`, two `minmax(280px, 1fr)` tracks, `position: sticky`, `top` from `--topbar-clear`, `overflow-y: auto`, `overscroll-behavior: contain`, `grid-row: 1 / span 3`, and no `--accent`.
      - `reveal/no-fold-scan.test.ts` (new): `Reveal.tsx` has neither `foldLetter` nor `collapsible`. `Reveal.tsx`, `LetterColumn.tsx` and `own-scroll.ts` have no `matchMedia`, `innerWidth` or `isPhone` in the receipts layout code. No non-test file under `src/` contains "Read the letter again" (case-insensitive). Task 5 extends this scan to the docs and the Layout_Check.
      - `LetterBlock.spacing.test.ts` and `live-reveal-contrast.test.ts` drop only the `.letterDisclosure` entries. `focus-table.test.ts` and `stages.focus.property.test.ts` pass unchanged.
      - _Requirements: 3.5, 3.7, 3.9, 5.4, 6.1, 6.3, 6.4, 6.7, 6.8, 6.9, 17.2_
  - Earlier-spec tests changed or retired: `Reveal.receipts-order.test.tsx`, `receipts-order.property.test.tsx`, the collapsible tests in `SealedLetter.test.tsx`, the `letterDisclosureSummary` check in `copy.test.ts`, and the disclosure entries in `LetterBlock.spacing.test.ts` and `live-reveal-contrast.test.ts` (spec 16 R10 replaced by Requirements 3 to 6). Name each.
  - Copy evidence: tone-check for `reveal/copy.ts`.
  - Validation: `npx vitest run src/components/reveal src/components/ceremony`, the two golden tests from the rules, then the done check. CI's layout gate uses task 3's new readings for this build.

- [ ] 5. Part D: docs, Layout_Check cleanup and the receipts walk
  - Agent: `platform-dev` · Depends on: 4 · Estimated size: S, ~300 changed lines
  - Follow 'Rules for every task' in tasks.md.
  - Scope: `README.md` (line 54 only), `docs/video-script.md` (line 99 only), `tools/qa/layout-check.mjs`, `src/lib/docs-wording.test.ts`, `src/lib/layout-check-spec16-rows.test.ts`, `src/components/reveal/no-fold-scan.test.ts` (shared, extend only).
  - Design sections: Components 2.6, Testing Strategy "QA browser steps, Part D".
  - Steps:
    1. Replace README ritual step 6 and video-script item 3 with the exact sentences in design 2.6.
    2. `docs-wording.test.ts` asserts each new sentence verbatim and that neither file contains "Read the letter again". It no longer asserts the fold.
    3. Remove `receiptsOrderFailuresFolded`, `receiptColumnFailures`, the `letterClosed` reading and the marker switch. `R10.1` and `R10.6` always use the new readings, and readings (c) to (g) no longer report `missing` for a build without the marker. Rewrite the row comments (lines 181 to 192 at the baseline) and remove every "Read the letter again" from the file. Update `layout-check-spec16-rows.test.ts` to match, keeping the three R10.1 cases of Requirement 6.6.
    4. Extend `no-fold-scan.test.ts` to `README.md`, `docs/video-script.md` and `tools/qa/layout-check.mjs`.
    5. Run the Part D walk.
  - Acceptance:
    - [ ] 5.1 Docs and the docs wording test
      - _Requirements: 6.3, 6.5_
    - [ ] 5.2 Layout_Check cleanup and its tests
      - `R10.1` and `R10.6` stay in `SPEC15_CHECKS`.
      - _Requirements: 6.3, 6.6, 17.5_
    - [ ] 5.3 Part D QA walk
      - `LAYOUT_CHECK=1 bash scripts/check.sh`, plus `node tools/qa/layout-check.mjs` on Maya's Receipts_Stage and on `/demo/live` step 6 at 360×640, 768×1024, 1280×800 and 1440×900, through "See the receipts" and through "Show everything", with the reduced-motion repeat and the long-letter check. List every reading (a) to (g) per route, size and path, with expected and observed result, in a commit message body.
      - _Requirements: 3.2, 3.3, 3.4, 3.6, 3.8, 5.1, 5.2, 5.3, 5.5, 5.6, 5.7, 6.9, 17.5, 17.8, 17.9_
  - Earlier-spec tests changed or retired: `docs-wording.test.ts` (the fold assertion), the folded-reading cases in `layout-check-spec16-rows.test.ts`. Name each.
  - Validation: `npx vitest run src/lib src/components/reveal` and `LAYOUT_CHECK=1 bash scripts/check.sh`.

- [ ] 6. Part A: seal machine origin and `useSealFlow.onBackupOnlyStart`
  - Agent: `frontend-dev` · Depends on: 2 · Estimated size: S, ~350 changed lines (mostly tests)
  - Follow 'Rules for every task' in tasks.md.
  - Scope: `src/components/live/seal-machine.ts`, `src/components/live/useSealFlow.ts`, and the tests named below. No markup changes, so both golden folders stay unchanged.
  - Design sections: Components 3.1, 3.2, Data Models ("Seal machine"), Properties 7, 8 and 10.
  - Steps:
    1. Add `FallbackOrigin`, the `origin` field on `fallback_key`, and the `SEAL_STEP_BACKUP_START` event. Implement the table in design 3.1. Every other state and event pair returns the same object.
    2. Add `onBackupOnlyStart` to `SealFlow` as in design 3.2. It checks `deps`, `inFlight` and `phase.current.tag === "write"` before it generates a key. Then it holds the key and sends the event. It returns true only when it started. `onFallbackDecline`, `onFallbackSealPress`, `sealWithBackupKey` and `onRetry` stay unchanged.
  - Acceptance:
    - [ ] 6.1 Seal machine with origin
      - _Requirements: 7.6, 8.1, 8.5, 8.6_
    - [ ] 6.2 Write property test for start and decline
      - File: `src/components/live/seal-machine.backup-start.property.test.ts`.
      - **Property 7: Backup-only start and decline follow the origin**
      - **Validates: Requirements 7.6, 8.1, 8.5, 8.6**
    - [ ] 6.3 `useSealFlow.onBackupOnlyStart`
      - _Requirements: 7.3, 7.6, 7.12, 8.1, 8.7, 9.1, 9.2, 9.3, 9.7, 9.8_
    - [ ] 6.4 Write property test for one key and no port
      - File: `src/components/live/useSealFlow.backup-only.property.test.ts`, first `it` block.
      - **Property 8: A backup-only start makes one key and touches no port**
      - **Validates: Requirements 7.3, 7.6, 7.12**
    - [ ] 6.5 Write property test for byte-equal paths
      - File: `src/components/live/backup-only-bytes.property.test.ts`. Uses the existing draft arbitraries, a fixed clock, a seeded random source and a fake fetch (Requirement 17.2 d).
      - **Property 10: Both backup-only paths seal the same bytes**
      - **Validates: Requirements 9.3, 9.10**
    - [ ] 6.6 Unit tests
      - `seal-machine.test.ts`: the table in design 3.1, both origins, reference-equal returns (Requirement 17.2 c).
      - `useSealFlow.test.ts`: after "Not now" from origin `seal_step` the state is `write` and `getBackupKeyText()` is null. Two starts with a seeded source give two different keys. A double "Seal with this key" gives one `prepare` request. A failed seal clears the key, and the failure carries `passkeyCreated: false`. "Try again" returns to `write` with no key held.
      - _Requirements: 8.1, 8.5, 8.7, 9.2, 9.7, 9.8, 17.2_
  - Earlier-spec tests changed or retired: `seal-machine.test.ts` cases that build `fallback_key` without `origin` may add `origin: "cannot_lock"` only. Name each.
  - Validation: `npx vitest run src/components/live`, the two golden tests from the rules, then the done check.

- [ ] 7. Part A: Backup_Only_Start on the Seal_Step, BackupFallback origin and focus
  - Agent: `frontend-dev` · Depends on: 6 · Estimated size: M, ~700 changed lines plus goldens
  - Follow 'Rules for every task' in tasks.md.
  - Scope: `src/components/live/SealPage.tsx`, `WriteForm.tsx`, `seal-step/SealStep.tsx`, `seal-step/seal-step.module.css`, `BackupFallback.tsx`, `copy.ts` (`LIVE_COPY.noPrfPress`, `REAL_COPY.intro`), `__golden__/seal-page-demo/**`, `seal-copy-tone.test.ts`, the tests named below, `src/test/integration/backup-only-walk.test.ts` (new).
  - Design sections: Components 3.3 to 3.5, Data Models ("Page state added to SealPage", "New props"), Property 9, Testing Strategy "Part A", "Open questions" (`REAL_COPY.intro`).
  - Steps:
    1. `SealStep` renders the Backup_Only_Start in `write` whenever `onBackupStart` is set, for every PRF hint value, after the Backup_Choice and before `SealLinks`. It uses `styles.fallback`, `data-backup-only-start`, `aria-disabled` from `backupOnlyBlocked` and no `disabled` attribute, and a blocked click calls `onAttempt`. `LIVE_COPY.prfHint` still shows only while the hint is `missing`.
    2. `WriteForm` computes `backupOnlyBlocked` without reading `backupChoice` and passes it and `onBackupStart` to `SealStep`.
    3. `SealPage` adds `onBackupOnlyStart` (freezes `pressedFigures` when the flow starts) and `onFallbackDecline` (for origin `seal_step`, clears `pressedFigures` and focuses `[data-step-heading]` in one animation frame). It passes `origin` and `focusOnMount` to `BackupFallback`. `demoSealOwnsHeading` counts `fallback_key`, so the demo fallback screen has one h1.
    4. `BackupFallback` takes `origin` (required) and `focusOnMount`. Its h1 gets `data-step-heading` and `tabIndex={-1}`, and `noPrfOther` renders only for origin `cannot_lock`. The key, Copy, intro, warning, checkbox and "Seal with this key" stay in the open markup, and the seal control keeps `disabled={!saved}`.
    5. Set `LIVE_COPY.noPrfPress` and `REAL_COPY.intro` to the design's text. Add both to `seal-copy-tone.test.ts`.
    6. Re-record the affected `seal-page-demo` goldens: the `write` seal form (the Backup_Only_Start) and `fallback_key` (one h1, new `noPrfPress`, the origin rule).
    7. Write the Part A walk.
  - Acceptance:
    - [ ] 7.1 Seal_Step, WriteForm, SealPage, BackupFallback, copy and goldens
      - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.7, 7.8, 7.9, 7.10, 7.11, 8.2, 8.3, 8.4, 9.4, 9.5, 9.6, 9.9, 16.1, 16.2, 16.3, 16.5, 17.3_
    - [ ] 7.2 Write property test for "Not now"
      - File: `src/components/live/useSealFlow.backup-only.property.test.ts`, second `it` block, driving the stepper draft with 0 to 30 random draft events and an opening date in Real_Mode.
      - **Property 9: "Not now" from the Seal_Step changes nothing in the letter**
      - **Validates: Requirements 8.1, 8.2**
    - [ ] 7.3 Unit tests
      - `SealStep.test.tsx`: the Backup_Only_Start renders in `write` for PRF hints `none`, `missing` and `unknown` with each Backup_Choice, in the order of Requirement 7.2. It is absent in the other tags. It has `aria-disabled="true"` while blocked and no `disabled` attribute.
      - `BackupFallback.test.tsx`: `noPrfOther` only for origin `cannot_lock`. The h1 has `data-step-heading` and `tabindex="-1"`. `noPrfPress` has no "wax". Real_Mode shows no Demo label for either origin. The seal control is `disabled` until ticked.
      - `SealPage.test.tsx`: with a fake fetch, a backup-only seal in each mode calls only that mode's routes. The demo `fallback_key` render has exactly one h1. After "Not now" the frozen figures are dropped.
      - `SealPage.real.test.tsx` `fallback_key` pair passes with the new origin prop.
      - `seal-step-css.test.ts`: `.fallback` keeps a 44 × 44 px minimum and has no `--accent`.
      - _Requirements: 7.1, 7.2, 7.4, 7.8, 7.10, 7.11, 8.4, 9.4_
    - [ ] 7.4 Part A QA walk
      - `src/test/integration/backup-only-walk.test.ts`, with the QA stub on `/demo/live` and on a local `/seal` with `REAL_SEALING=on`. Checks (a) to (d), the demo open after 31 seconds, and the real still-sealed check, exactly as in design "QA browser steps, Part A". Report every check in a commit message body.
      - _Requirements: 17.6, 17.9_
  - Earlier-spec tests changed or retired: expected `SealStep.test.tsx` cases pinning the fallback button only while `prfMissing`, and `BackupFallback` tests pinning `noPrfOther` or the old `noPrfPress` (spec 06 R15.9.5 replaced for origin `seal_step`). Name each.
  - Copy evidence: tone-check for `live/copy.ts`.
  - Validation: `npx vitest run src/components/live`, the two golden tests from the rules, then the done check.

- [x] 8. Part B: the Simulated_Port
  - Agent: `crypto-dev` · Depends on: none · Estimated size: S, ~150 changed lines plus tests
  - Follow 'Rules for every task' in tasks.md.
  - Scope: `src/lib/crypto/simulated-port.ts` (new), `src/lib/crypto/index.ts` (added lines only), `src/lib/crypto/simulated-port.test.ts` (new), `src/lib/crypto/simulated-port.property.test.ts` (new), `src/lib/crypto/simulated-port.scan.test.ts` (new). No other file under `src/lib/crypto/` changes.
  - Design sections: Components 4.1, Properties 11 to 13, Testing Strategy "Part B" (crypto-dev items).
  - Steps:
    1. Write `createSimulatedPort(): Promise<AuthenticatorPort>` as in design 4.1. It draws a 32-byte secret and imports it as a non-extractable HMAC SHA-256 key with usage `sign`. It zeroes the raw bytes in `finally` and maps import and sign failures to `PortError("failed")`. `create` and `get` return copies, `get` checks the issued credential IDs byte for byte, and the returned object is frozen with only `isAvailable`, `create` and `get`. The module imports only `./authenticator-port`.
    2. Add the comment line and `export { createSimulatedPort } from "./simulated-port";` to the barrel. Remove or change no line.
  - Acceptance:
    - [ ] 8.1 Simulated_Port module and barrel export
      - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.7, 10.8, 10.11, 15.2_
    - [ ] 8.2 Write property test for create and get agreement
      - File: `src/lib/crypto/simulated-port.property.test.ts`, first `it` block, with the known-answer check.
      - **Property 11: The Simulated_Port's create and get agree with HMAC-SHA256**
      - **Validates: Requirements 10.3, 10.4, 10.6**
    - [ ] 8.3 Write property test for distinct instances
      - Same file, second `it` block, secrets from a seeded stub of `crypto.getRandomValues`.
      - **Property 12: Two Simulated_Ports never share a PRF**
      - **Validates: Requirements 10.6, 10.10**
    - [ ] 8.4 Write property test for unknown credentials
      - Same file, third `it` block.
      - **Property 13: The Simulated_Port refuses credentials it did not issue**
      - **Validates: Requirements 10.5**
    - [ ] 8.5 Unit and scan tests
      - `simulated-port.test.ts`: `isAvailable()` returns true and reads no `navigator`. `importKey` is called with `extractable` false and usages `["sign"]`, and the raw array is all zero after the factory resolves. `importKey` and `sign` rejections give `PortError("failed")` with the fixed message. The instance's own and prototype enumerable keys are exactly `isAvailable`, `create` and `get`. `JSON.stringify` and `String()` of the instance and of thrown errors hold no secret bytes. `confirmPasskey` with the port returns `ok: true`.
      - `simulated-port.scan.test.ts`: with comments and strings blanked, the module has none of `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, `console.`, `serviceWorker`, `history.`, `fetch(`, `XMLHttpRequest` or `sendBeacon`. The scan fails when the module path does not exist.
      - `no-fake-import.test.ts` passes with no change.
      - _Requirements: 10.1, 10.2, 10.5, 10.7, 10.8, 10.11, 15.5, 15.6, 15.7, 17.2_
  - Earlier-spec tests changed or retired: none.
  - Validation: `npx vitest run src/lib/crypto`, then the done check. Report the JS budget result from `check.sh`. If the crypto chunk trips the budget, report it and do not raise the budget.

- [ ] 9. Part B: Simulated_Mode on `/demo/live`
  - Agent: `frontend-dev` · Depends on: 7, 8 · Estimated size: L, ~1,300 changed lines plus goldens
  - Follow 'Rules for every task' in tasks.md.
  - Scope: `src/components/live/SealPage.tsx`, `WriteForm.tsx`, `seal-step/SealStep.tsx`, `seal-step/SealSteps.tsx`, `seal-step/seal-steps.ts`, `seal-step/press-status.ts`, `seal-step/seal-button.ts`, `seal-step/simulated-copy.ts` (new), `seal-step/simulated-mode.ts` (new), `seal-step/seal-step.module.css`, `BackupChoice.tsx`, `SealLinks.tsx`, `SealFailure.tsx`, `LiveWaitStep.tsx`, `copy.ts`, `press/copy.ts`, `__golden__/seal-page-demo/**`, `SealPage.real.test.tsx` (export `PAIRS` only), the tests named below, `src/test/integration/simulated-walk.test.ts` (new). `LiveLetter.tsx`, `UnlockView.tsx`, `unlock.ts` and `src/app/l/**` do not change.
  - Design sections: Components 4.2 to 4.5, Data Models ("Page state added to SealPage", "Copy"), Property 14, Testing Strategy "Part B" (frontend items).
  - Steps:
    1. `SealPage` adds `simulateOn`, `simPort` and `simUnavailable`, with `simulated = mode === "demo" && simulateOn`. The effect creates the port through the loaded crypto module's `createSimulatedPort` and ignores a late result after it is turned off or unmounted. On a rejection it turns the mode off and sets `simUnavailable`. `sealDeps` is null while the simulated port is not ready, and the port goes to `SealDeps.port` and to `LiveWaitStep`. `SealPageProps` and `SealPageDeps` gain no field for it, and no static value import of `@/lib/crypto` is added.
    2. `simulatedChoice(simulated, choice)` in `seal-step/simulated-mode.ts` gates Backup_Choice changes. Turning the mode on dispatches `BACKUP_CHOICE_CHANGED` with `card`. Turning it off dispatches nothing.
    3. `SealStep` takes `simulate` (Demo_Mode only) and renders the Simulate_Control, `simulatedNotice` and `simulatedUnavailable` after the Backup_Choice and before the Backup_Only_Start. `BackupChoice` gains `skipDisabled` and `note` (with `aria-describedby`). The control is `disabled` outside `write`.
    4. Add every Simulated_Mode key in design "Data Models, Copy" with its exact text. `sealStepCopy(simulated)` in `seal-step/simulated-copy.ts` picks each Seal_Step line from the table in design 4.3. `pressStatusLine`, `sealStepsView` and `sealButtonLabel` read their simulated strings from it. `SealLinks` and `SealFailure` take `simulated` and hide the lines Requirement 11.8 lists, and `SealStep` hides `prfHint`.
    5. `LiveWaitStep` takes `simulated`. It opens the backup key card at first render, renders no `backupCardShow` control, and shows `simulatedKeyReminder` instead of `keyReminder`.
    6. Re-record the affected `seal-page-demo` goldens (the Simulate_Control in the demo seal form, unchecked).
    7. Write the Part B walk.
  - Acceptance:
    - [ ] 9.1 Simulated_Mode state, port wiring and the backup choice gate
      - _Requirements: 10.9, 10.10, 11.2, 11.3, 11.4, 11.5, 11.9, 11.11, 12.1, 12.3, 12.4, 12.5, 12.8, 13.1, 13.2, 14.1, 14.3_
    - [ ] 9.2 Seal_Step, Backup_Choice, failure screens, Wait step, copy and goldens
      - _Requirements: 11.1, 11.6, 11.7, 11.8, 11.10, 12.2, 12.6, 12.7, 12.9, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 17.3_
    - [ ] 9.3 Write property test for the backup choice gate
      - File: `src/components/live/seal-step/simulated-choice.property.test.ts`, run through `simulatedChoice` and the write-draft reducer.
      - **Property 14: Simulated_Mode keeps the backup key card chosen**
      - **Validates: Requirements 12.1, 12.3, 12.4**
    - [ ] 9.4 Widen Properties 3 and 4 with the Simulated_Mode flag
      - In `seal-button.property.test.tsx` and `press-status.property.test.ts`, generate `simulated` true and false.
      - **Property 3: The Seal_Button and the wax agree, and the label follows the Seal_State**
      - **Property 4: The Press_Status_Line is total and follows its precedence**
      - **Validates: Requirements 1.9, 2.7, 11.7**
    - [ ] 9.5 Page, absence, reach and copy tests
      - `SealPage.simulated.test.tsx` (new), with the golden harness and a crypto stub whose `createSimulatedPort` returns a counting port, covers the following. There is one unchecked Simulate_Control in the order of Requirement 11.1, disabled outside `write`. A seal followed by an in-page unlock gives 1 `create` and 2 `get` on the Simulated_Port and 0 on a counting browser port. Off then on calls the factory twice, and two mounts give different `prfResult` values for one salt. The press is blocked until the factory resolves. No Requirement 11.8 phrase or hidden key appears outside `[data-simulated-notice]` for any seal-form Seal_State, `cannot_lock`, `cancelled`, `failed` or the Wait step. The route sequence and body keys equal a seal with the test fake port. The header has both wraps and `factors: "both"`. The Wait step shows the card open with no `[data-live-backup-offer]` and shows `simulatedKeyReminder`.
      - Render tests of `BackupKeyCard` and `LetterCard` for a Simulated_Letter find none of the Requirement 12.7 strings.
      - `SealPage.real.simulated-absence.test.tsx` (new): imports `PAIRS` from `SealPage.real.test.tsx` and fails if it has fewer entries than at the baseline. It renders each pair with no extra value and with `{ simulated: true }` as a prop, `deps.simulated: true` and a draft field `simulated: true` (by cast), and finds no `[data-simulate-control]` and no Requirement 13.1 string. A driven Real_Mode run (both presses, a backup-only seal, a retry) calls the factory spy 0 times (Requirement 17.2 f).
      - `simulated-port-reach.test.ts` (new): follows every static `import`, `import type` and `export … from` transitively from `src/app/seal/**`, `src/app/l/**` and `src/components/live/LiveLetter.tsx`, and finds no edge to `src/lib/crypto/simulated-port` and no `import()` with that path. `import("@/lib/crypto")` and the `typeof import("@/lib/crypto")` type query are allowed.
      - `source-scan.test.ts`, `seal-page-imports.test.ts` and `no-fake-import.test.ts` pass unchanged.
      - `seal-copy-tone.test.ts` lists every new key in design "Data Models, Copy" and `PRESS_COPY.sealButtonCreateSimulated`. It asserts "leave or reload" in `simulatedNotice` and `simulatedKeyReminder`. It asserts "lost key means a lost letter" and "cannot recover" in `fallbackWarning`, `warningSimulated`, `simulatedBackupRequired` and `simulatedKeyReminder`, with no "may" or "might" in those sentences. It asserts that no new string has "tab" next to "close" or "shut", and that no Simulated_Mode string has a Requirement 16.6 phrase except the one in `simulatedNotice`.
      - _Requirements: 10.9, 10.10, 11.1, 11.2, 11.3, 11.4, 11.5, 11.8, 11.9, 12.5, 12.6, 12.7, 13.1, 13.2, 13.3, 13.4, 15.5, 16.2, 16.4, 16.5, 16.6, 17.2_
    - [ ] 9.6 Part B QA walk
      - `src/test/integration/simulated-walk.test.ts`, on `/demo/live` with no QA stub and no virtual authenticator. An init script counts `navigator.credentials.create` and `get`, makes both reject at once with `NotAllowedError`, and records every 32-byte value from `crypto.getRandomValues` and `crypto.subtle.sign` before the reload. Checks (a) to (g), e2 and the reload check, exactly as in design "QA browser steps, Part B". Report every check in a commit message body.
      - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 17.7, 17.9_
  - Earlier-spec tests changed or retired: `SealPage.real.test.tsx` gains an `export` on `PAIRS` only. Name any other.
  - Copy evidence: tone-check for `live/copy.ts` and `live/press/copy.ts`.
  - Validation: `npx vitest run src/components/live src/lib/crypto`, the two golden tests from the rules, then the done check.

- [ ] 10. Spec 20 final verification on merged `main`, report only
  - Agent: `platform-dev` · Depends on: 1, 2, 3, 4, 5, 6, 7, 8, 9 · Estimated size: S, one empty commit
  - Follow 'Rules for every task' in tasks.md.
  - Scope: none. The record is the body of one empty commit (`git commit --allow-empty`). Change no source file.
  - Steps:
    1. On merged `main`, run `npx vitest run src/components src/lib src/app` and `LAYOUT_CHECK=1 bash scripts/check.sh`, and record both exit codes.
    2. Run `SealPage.demo-golden.test.tsx` and `seal-draft.golden.test.tsx` without `RECORD_GOLDEN` and confirm both pass. Confirm `git diff --name-only c2bf2db8 HEAD -- src/components/live/__golden__/seal-draft/` is empty.
    3. Run the boundary diffs. `git diff --name-status c2bf2db8 HEAD -- src/app/api src/lib/seal-format src/lib/letter-store src/lib/db drizzle deploy/helm .env.example package-lock.json` must be empty. `git diff c2bf2db8 HEAD -- package.json` must show no `dependencies` or `devDependencies` change. Under `src/lib/crypto/`, only `A` entries for the Simulated_Port files and one `M src/lib/crypto/index.ts` with added lines only. No change to `LiveLetter.tsx`, `UnlockView.tsx`, `unlock.ts` or `src/app/l/**`.
    4. Compare the set of `process.env` names read by non-test files under `src/` and `scripts/` at `c2bf2db8` and at `HEAD`. They must be equal.
    5. Run `git diff c2bf2db8 HEAD` over test files and confirm no `.skip`, `.only` or `.todo` was added.
    6. Read the walk reports of tasks 2, 5, 7 and 9 on `main` (`git log`) and confirm each lists every check with route, viewport, expected and observed result.
    7. The commit body states the full `main` SHA and every result. If a check fails, state the check, the command, the expected and the found result. Make no fix in this task.
  - Acceptance:
    - [ ] 10.1 Suite, check, goldens, boundaries, env names and walk reports on one commit
      - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 17.3, 17.8, 17.9_

## Owner step (done, not an issue)

The steering edits were made by the owner before task 1, so every agent and the QA run read steering that already describes this spec (as spec 09 did with step O0). They are in the same commit as this spec. This section has no checkbox, so it opens no issue.

- `product.md` core loop step 7: questions, then the letter, then the figures; the letter stays open. Demo 2: the Receipts step keeps the letter open; a judge may seal with the backup key only or with the simulated passkey; nothing is saved with the simulated passkey. Decisions, Unlocking: backup-key-only sealing on `/demo/live` and `/seal`.
- `tone.md` "See the receipts": questions, then the letter, then the numbers; the letter stays open where the reader read it.
- `tech.md` PRF support: backup-key-only sealing, and the simulated-passkey mode of `/demo/live` with the backup key required.
- `crypto.md` "PRF check at sealing" and "Demo letters": backup-only seals store no passkey wrap; the simulated port is for live demo letters only, never on `/seal`.
- `structure.md`: `lib/crypto/simulated-port.ts`.

## Notes

- Property test sub-tasks are not marked optional, following specs 15 to 19. Requirement 17.2 names several of them, and Property 2 is the evidence that the wax is unchanged.
- Tasks 1 and 3 are platform-dev QA tool changes that land before their frontend task, because frontend-dev cannot edit `tools/qa/**`. Task 3's marker switch exists only so `main` stays green between tasks 3 and 5, and task 5 removes it.
- The seal-page-demo goldens change in tasks 2, 7 and 9, which run in that order because they all touch `SealStep.tsx` and the same golden files. Tasks 4, 6 and 8 change no golden.
- `useSealFlow.backup-only.property.test.ts` gets Property 8 in task 6 and Property 9 in task 7, in separate `it` blocks. `seal-copy-tone.test.ts` is created in task 2 and extended in tasks 7 and 9.
- Owner review points carried from the design (steering is already updated; see "Owner step"): the new `REAL_COPY.intro` text (task 7), the Letter_Page notice for a Simulated_Letter (left unchanged, a follow-up spec), and the Calm variant of walk check (a) in task 2.
- The walks in tasks 7 and 9 that touch `/seal` need a local build with `REAL_SEALING=on` and a local Postgres container. Every walk needs a local Chromium for `playwright-core`.
- Every PR is reviewed by the dispatcher's automatic QA run, so no task asks for a review.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "3.1", "8.1"] },
    { "id": 1, "tasks": ["1.2", "3.2", "8.2", "8.5"] },
    { "id": 2, "tasks": ["2.1", "4.1", "8.3"] },
    { "id": 3, "tasks": ["2.2", "2.3", "4.2", "4.3", "8.4"] },
    { "id": 4, "tasks": ["2.4", "4.4"] },
    { "id": 5, "tasks": ["2.5", "2.6", "2.7", "5.1"] },
    { "id": 6, "tasks": ["2.8", "5.2"] },
    { "id": 7, "tasks": ["5.3", "6.1"] },
    { "id": 8, "tasks": ["6.2", "6.3"] },
    { "id": 9, "tasks": ["6.4", "6.5", "6.6"] },
    { "id": 10, "tasks": ["7.1"] },
    { "id": 11, "tasks": ["7.2", "7.3"] },
    { "id": 12, "tasks": ["7.4"] },
    { "id": 13, "tasks": ["9.1"] },
    { "id": 14, "tasks": ["9.2"] },
    { "id": 15, "tasks": ["9.3", "9.4", "9.5"] },
    { "id": 16, "tasks": ["9.6"] },
    { "id": 17, "tasks": ["10.1"] }
  ]
}
```
