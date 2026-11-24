# Implementation Plan: 19 Real sealing stepper

## Overview

Spec 19 moves `/seal` from the single `renderState()` form into the Live_Stepper that `/demo/live` already uses. Real_Mode gets its own three-step list (Write, Press the seal, Keep) in the same Stepper_Module. Real_Mode drops every demo and rehearsal line, `REAL_COPY.testNotice` goes away, `/seal` gets the plain backdrop, and the home page gets one quiet text link to `/seal` while real sealing is on.

`requirements.md` says what must hold and `design.md` says which files change and how. The change is page-layer only (Requirement 7). Demo_Mode keeps its code paths: every Demo_Mode change is a new optional prop whose default is today's markup, or a branch that runs only when `mode` is `real`. Task 1 records golden markup, the sealed draft and the request list at the baseline before any `/seal` code change, and every later task in the `/seal` chain must keep the Demo_Mode goldens byte-identical.

| Tasks | What | Roles |
|---|---|---|
| 1 | Goldens and the reducer oracle, recorded at the baseline | frontend-dev |
| 2 | Stepper_Module: modes, the Real_Step_List, the real reducer | frontend-dev |
| 3 | Live_Stepper and Step_Track read the mode's list | frontend-dev |
| 4 | Real copy, Seal_Step lines, Backup_Choice and the `opening` slot | frontend-dev |
| 5 | Date_Picker dark surface, Keep_Step and failure screens without Demo text | frontend-dev |
| 6 | SealPage runs Real_Mode in the Live_Stepper; WriteForm wiring; `/seal` backdrop | frontend-dev |
| 7 | Landing_Hero Real_Seal_Link, copy and CSS | frontend-dev |
| 8 | Landing_Page reads `realSealingOn()` per request | platform-dev |
| 9 | Real walk, landing check, QA_Shots and evidence | platform-dev |
| 10 | Final verification on merged `main`, report only | platform-dev |

Ownership is taken from `.github/agents.json`. `src/components/live/**`, `src/components/landing/**` and `src/app/seal/page.tsx` (`src/app/**/*.tsx`) are frontend-dev's. `src/app/page.tsx` is listed by name under platform-dev and also matches frontend-dev's `src/app/**/*.tsx`; following the design (Components, section 11) and `structure.md`, it is platform-dev's here. `src/test/integration/**` and every `*.test.ts(x)` under `src/` are shared. `tools/qa/**` is platform-dev's.

Each task is one GitHub issue and one PR for one role, inside that role's paths (plus `shared`) and under `max_changed_lines` (5,000, test files excluded). "Depends on" lists only task numbers of this spec, and an issue starts only when every issue it depends on is closed. Tasks 1 and 7 have no dependencies, so the `/seal` chain (1 to 6) and the landing pair (7 and 8) run in parallel.

## Decisions (fixed)

The design records five places where the code differs from the requirements. Each is decided as the design's default:

- **Requirement 3.5, the press.** The press uses `aria-disabled="true"`, not the native `disabled` attribute, and `PressEnvelope` gains no `hardDisabled` prop. No request is sent and the attempt is recorded so `REAL_COPY.dateMissing` can show.
- **`initialStepperState("sealed", "real")`** gives a sealed state with a cleared draft.
- **Real wording for the "Revenant demo" passkey hints** is `REAL_COPY.stepOneHint` and `REAL_COPY.stepPasskeyMade`, as in the design.
- **`SealedView real`** gains `data-step-heading` and `tabIndex={-1}` on its `h1`, in Real_Mode only.
- **`failed`** keeps the temporary "Press the seal" `h1` in Real_Mode.

New copy is final as written in the design's new-copy table.

## Rules for every task

- **Baseline.** "The baseline" is the commit task 1 records its goldens from: task 1's branch base on `origin/main`, before any spec 19 code lands in `src/components/live`. Every mention of `3bee3055` in this file and in `design.md` means that baseline.
- **Branch and PR.** The dispatcher creates `agent/<role>/issue-N` and the PR "Closes #N". Do not push to `main` or merge. After a hook failure, make a new commit; do not amend.
- **Scope.** Change only files that match your role's paths in `.github/agents.json` (or `shared`) and are listed in your task's Scope, plus new `*.test.ts(x)` files next to the code they test. Check your diff with `git diff --name-only origin/main` before you finish and put the list in a commit message body.
- **Frozen paths (Requirement 7).** No task adds, removes, renames or changes a file under `src/app/api/`, `src/lib/crypto/`, `src/lib/seal-format/`, `src/lib/letter-store/`, `src/lib/db/`, `drizzle/` or `deploy/helm/`, or `.env.example`, `package.json` or `package-lock.json`. No task adds, removes or renames an environment variable read by application code. No task changes `src/lib/feature-flags.ts`. No task edits `useSealFlow.ts`, `seal-runner.ts`, `build-payload.ts`, `seal-machine.ts` or `api.ts` under `src/components/live/`, or `src/app/demo/live/page.tsx` (Requirement 5.6). No task changes a file under `.kiro/`, `.github/`, `tools/agents/`, `tools/dispatcher/`, `tools/hooks/` or `scripts/check.sh`. If a task finds it needs a change in a frozen path, it stops before making it and states the path, the change and the reason in a commit message body.
- **Demo_Mode is golden.** Tasks 2 to 6, 9 and 10 run `npx vitest --run src/components/live/SealPage.demo-golden.test.tsx src/components/live/seal-draft.golden.test.tsx` and both pass without `RECORD_GOLDEN`. No task rewrites a golden file under `src/components/live/__golden__/` after task 1 (Requirement 5.1, 5.3, 7.3, 7.4).
- **Changed tests (Requirement 5.7).** A Demo_Mode assertion in an existing test under `src/components/live` stays as it is. A test may change only where it asserted the Real_Mode single form, the Test_Notice in Real_Mode or the Back_To_Demo_Link in Real_Mode. The commit body names each changed test by file and test title, with its reason ("none" if empty). No task adds `.skip`, `.only` or `.todo` (Requirement 8.7).
- **Copy.** Every new string is exactly the string in the design's new-copy table and follows `tone.md` and `neutrality.md`. Each copy task states in a commit message body the result of `node tools/hooks/tone-check.mjs <file>` for every copy file it changed.
- **Tests.** Vitest in Node, `renderToStaticMarkup`, every `fetch` stubbed, no network, `DATABASE_URL` unset, no browser (task 9's walk excepted). No DOM library is added. Property tests use fast-check (already a dev dependency) with `numRuns` of at least 100 and the tag `// Feature: 19-real-sealing-stepper, Property N: <title>` with the title from `design.md`. Each property has one `it` block.
- **Evidence.** A commit message body states the final commit SHA, the exit status of `bash scripts/check.sh` and PASS or FAIL, and every earlier-spec test changed or retired with its reason ("none" if empty).
- **Reports.** Anything a requirement asks for "in the PR description" goes in a commit message body on the task's branch, kept short (bodies are cut at 12,000 characters).
- If `design.md` and the code on `main` disagree, re-read the code, keep the design's behaviour, and say what you changed and why in a commit message body under "Decisions". If the disagreement touches the sealed payload, the request bodies or a frozen path, stop instead.

## Tasks

- [x] 1. Goldens and the reducer oracle, recorded at the baseline
  - Agent: `frontend-dev` · Depends on: none · Estimated size: M, ~900 changed lines (tests and golden files)
  - Follow 'Rules for every task' in tasks.md.
  - Scope: `src/components/live/SealPage.demo-golden.test.tsx` (new), `src/components/live/seal-draft.golden.test.tsx` (new), `src/components/live/__golden__/**` (new), `src/components/live/stepper/live-steps.oracle.property.test.ts` (new). No non-test source file changes in this task.
  - Design sections: Testing Strategy, "Step 0: record the goldens at `3bee3055`".
  - Steps:
    1. The baseline is this task's branch base on `origin/main`. Record `git rev-parse HEAD` in a commit message body. Run `git diff --name-only 3bee3055 HEAD -- src/components/live src/components/landing src/app src/lib`. If it is non-empty, record the goldens from the branch base anyway and list the differing files in a commit message body. Do not stop.
    2. Write the demo markup golden harness: mock `useSealFlow` (state per pair), `useCryptoModule` (null), `usePrfHint` (`none`), `useFigures` (a fixed `ready` response from `DEMO_FIGURES`), wrap `initialStepperState` to set the step and one fixed draft (letter text, two questions with answers, one figure), fix the clock with `vi.setSystemTime` and `deps.nowMs`. With `RECORD_GOLDEN=1` it writes `__golden__/seal-page-demo/<step>--<tag>.html`; without it, it compares byte for byte. Cover every pair in the design's table.
    3. Write the draft and request golden harness: a `useSealFlow` spy records `draft`, `deps.api` and `deps.rpId` in each mode (Real_Mode through today's `renderState()` path, `opensOn` fixed). Seal the recorded draft through the real `pressCreate` and `sealWithPasskey`, with the crypto module loaded by dynamic `import()`, a fake authenticator port with a fixed PRF output, a seeded `crypto.getRandomValues` stub, a fixed clock and a stubbed `fetch` that records method, path and body. Write `__golden__/seal-draft/<mode>.json` with the `SealDraft`, the request list, the decrypted payload, the header and the envelope hash.
    4. Record both goldens with `RECORD_GOLDEN=1`, then run both harnesses without it and confirm they pass twice in a row (the output is stable).
    5. Copy the baseline's `reduceStepper`, `stepIndex`, `canGoBack`, `stepForStage` and `initialStepperState` verbatim into the oracle test file, with no export.
  - Acceptance:
    - [ ] 1.1 Demo markup goldens for every step and Seal_State pair
      - _Requirements: 5.1, 5.2, 5.4_
    - [ ] 1.2 Draft, request, payload, header and hash goldens for both modes
      - The request list in Demo_Mode holds only Demo_Routes; in Real_Mode only Real_Routes.
      - _Requirements: 5.3, 7.3, 7.4_
    - [ ] 1.3 Write property test comparing today's reducer with the oracle
      - **Property 1: The demo reducer matches the `3bee3055` oracle**
      - In this task the test checks `step`, `draft`, `sealed`, `stage` and same-object returns only; task 2.3 adds the `mode` assertion.
      - **Validates: Requirements 1.9, 5.5**
  - Earlier-spec tests changed or retired: none.
  - Validation: `bash scripts/check.sh`.

- [x] 2. Stepper_Module: modes, the Real_Step_List and the real reducer
  - Agent: `frontend-dev` · Depends on: 1 · Estimated size: M, ~700 changed lines
  - Follow 'Rules for every task' in tasks.md.
  - Scope: `src/components/live/stepper/live-steps.ts`, `src/components/live/copy.ts` (only `REAL_COPY.keepStep`), `live-steps.test.ts`, `live-steps.oracle.property.test.ts`, `real-steps.property.test.ts` (new), `step-lookups.property.test.ts` (new).
  - Design sections: Components 1, Data Models ("Step lists", "`StepperState`"), Properties 1 to 4.
  - Steps:
    1. Add `REAL_COPY.keepStep = "Keep"`.
    2. Add `REAL_STEPS`, `RealStep`, `StepperStep`, `StepperMode`, `REAL_STEP_NAMES` (from `RITUAL[0].name`, `RITUAL[1].name`, `REAL_COPY.keepStep`, no literals), `stepsFor`, `stepNamesFor`, `isDemoStep`. Leave `LIVE_STEPS` and `LIVE_STEP_NAMES` unchanged.
    3. Widen `stepIndex`, `stepName` and `canGoBack` with an optional `mode` defaulting to `demo`. Widen `hasPrimaryCard`, `stepperDrawsHeading`, `flowMounted`, `flowPortalTarget` and `movesFocus` to `StepperStep`, returning false or null for `sealed`.
    4. Add `mode` to `StepperState`. `initialStepperState(step = "write", mode = "demo")` starts on `write` for a step outside `stepsFor(mode)`, and on a sealed state with `CLEARED_WRITE_DRAFT` for `("sealed", "real")`.
    5. Move today's reducer body to `reduceDemo` unchanged, with index lookups passing `"demo"`. Add `reduceReal` per the design's action table. `reduceStepper` dispatches on `state.mode`; neither branch writes `mode`.
  - Acceptance:
    - [ ] 2.1 Stepper_Module with both lists and both reducers
      - The Demo_Mode goldens from task 1 pass unchanged.
      - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.10, 4.10_
    - [ ] 2.2 Unit tests in `live-steps.test.ts`
      - The Real_Step_List and its names, `stepIndex` 0 to 2 and `stepName` in Real_Mode, `canGoBack` in Real_Mode, one passing example each for Requirements 1.5, 1.6, 1.7, 1.8 and 1.10, and the `initialStepperState()` defaults (`write`, `demo`).
      - _Requirements: 8.1_
    - [ ] 2.3 Extend the oracle property test with `mode`
      - **Property 1: The demo reducer matches the `3bee3055` oracle**
      - Add `GOTO "sealed"` to the generator and the assertion that `mode` stays `demo`.
      - **Validates: Requirements 1.2, 1.3, 1.9, 5.5**
    - [ ] 2.4 Write property test for the real invariant
      - **Property 2: The real stepper stays inside its three steps**
      - **Validates: Requirements 1.3, 1.11, 8.2**
    - [ ] 2.5 Write property test for the real action table
      - **Property 3: The real reducer follows the real action table**
      - **Validates: Requirements 1.5, 1.6, 1.7, 1.8, 3.10**
    - [ ] 2.6 Write property test for step lookups
      - **Property 4: Step lookups read only the mode's list**
      - **Validates: Requirements 1.1, 1.4, 2.3, 2.5**
  - Earlier-spec tests changed or retired: tests that build a `StepperState` literal without `mode` (for example in `back-draft.property.test.ts`, `five-steps.property.test.ts`, `stage-report.property.test.ts`) may add `mode: "demo"` only; name each.
  - Copy evidence: tone-check for `live/copy.ts`.
  - Validation: `bash scripts/check.sh`.

- [x] 3. Live_Stepper and Step_Track read the mode's list
  - Agent: `frontend-dev` · Depends on: 2 · Estimated size: S, ~300 changed lines
  - Follow 'Rules for every task' in tasks.md.
  - Scope: `src/components/live/stepper/LiveStepper.tsx`, `LiveStepper.test.tsx`, `StepTrack.test.tsx`, `step-track.property.test.ts`. `step-track.ts` and `StepTrack.tsx` do not change.
  - Design sections: Components 2, Property 5.
  - Steps:
    1. `LiveStepper` takes the names from `stepNamesFor(state.mode)` and the position from `stepIndex(state.step, state.mode)`, and fills `{total}` with `names.length`. `StepView.step` and `advanceTo` widen to `StepperStep`. `canGoBack` passes `state.mode`. Focus, scroll, card and Reveal_Host stay as they are.
  - Acceptance:
    - [ ] 3.1 Live_Stepper reads the mode
      - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.7, 3.9, 5.5_
    - [ ] 3.2 Live_Stepper and Step_Track tests for both modes
      - Real_Mode: three dots labelled Write, Press the seal, Keep; on each step exactly one `data-state="current"` with `aria-current="step"`, done before and todo after with no `aria-current`; announcement "Step {n} of 3: {label}" and phone line "Step {n} of 3 · {label}" for `n` 1 to 3. Demo_Mode still shows six dots and "of 6".
      - _Requirements: 2.1, 2.2, 2.3, 2.5, 8.3_
    - [ ] 3.3 Extend the property test for `stepTrackStates`
      - **Property 5: `stepTrackStates` marks exactly one current step**
      - `stepCount` from 1 to 6.
      - **Validates: Requirements 2.2, 2.6**
  - Earlier-spec tests changed or retired: none expected; name any.
  - Validation: `bash scripts/check.sh`.

- [ ] 4. Real copy, Seal_Step lines, Backup_Choice and the `opening` slot
  - Agent: `frontend-dev` · Depends on: 3 · Estimated size: M, ~600 changed lines
  - Follow 'Rules for every task' in tasks.md.
  - Scope: `src/components/live/copy.ts`, `seal-step/SealStep.tsx`, `seal-step/SealSteps.tsx`, `seal-step/seal-steps.ts`, `seal-step/press-status.ts`, `src/components/live/BackupChoice.tsx`, `real-copy-tone.test.ts` (new), `seal-step/real-lines.property.test.ts` (new), and the tests next to each. `press/` does not change.
  - Design sections: Components 5, 8 (the copy table), Data Models ("New props", "Copy changes", the new-copy table), Property 6.
  - Steps:
    1. Add `REAL_COPY.pressNeedsDate`, `stepOneHint`, `stepPasskeyMade`, `figuresNoneAvailable`, `passkeyDeleteNote`, `clockBody` and `busyBody` with the design's exact text. Do not remove `testNotice` yet (task 6 removes it with its last use).
    2. `pressStatusLine` gains optional `needsDate`; `sealStepsView` gains optional `real`; `SealSteps` passes `real` through. Default inputs return today's values.
    3. `BackupChoice` gains `skipHelp` (default true). With false, the skip card renders its title once, no help `span` and no `aria-describedby` to a missing id.
    4. `SealStep` gains `real`, `needsDate` and `opening`. `opening` renders first in the `data-seal-text` column inside `<div data-seal-opening="">`. `SealStep` passes `skipHelp={!real}`, `needsDate` to `pressStatusLine` and `real` to `SealSteps`. The press keeps `aria-disabled="true"` (see "Decisions (fixed)").
  - Acceptance:
    - [ ] 4.1 New `REAL_COPY` strings and the tone test
      - `real-copy-tone.test.ts` runs `toneProblems` over every `REAL_COPY` string and finds none.
      - _Requirements: 4.10, 4.13_
    - [ ] 4.2 Seal_Step props with today's defaults
      - Unit tests: `BackupChoice skipHelp={false}` renders `LIVE_COPY.backupChoiceSkip` once and no `backupChoiceSkipHelp`; `SealStep` with `opening` places it before the backup choice and the press; the Demo_Mode goldens pass unchanged.
      - _Requirements: 3.3, 3.5, 4.3, 4.4, 4.12_
    - [ ] 4.3 Write property test for the real seal-step lines
      - **Property 6: Real seal-step lines change only where specified and never name the demo**
      - **Validates: Requirements 3.5, 4.11, 4.13**
  - Earlier-spec tests changed or retired: none expected; name any.
  - Copy evidence: tone-check for `live/copy.ts`.
  - Validation: `bash scripts/check.sh`.

- [ ] 5. Date_Picker dark surface, Keep_Step and failure screens without Demo text
  - Agent: `frontend-dev` · Depends on: 4 · Estimated size: M, ~700 changed lines
  - Follow 'Rules for every task' in tasks.md.
  - Scope: `src/components/live/RealDatePicker.tsx`, `real-date-picker.module.css` (new), `SealedView.tsx`, `BackupKeyCard.tsx`, `SealFailure.tsx`, `BackupFallback.tsx`, `desk/FigureRows.tsx`, `desk/ReceiptPanel.tsx`, and the tests next to each.
  - Design sections: Components 6, 7, 8, Error Handling.
  - Steps:
    1. `RealDatePicker` gains `surface` (default `paper`). `dark` uses the new CSS module with the design's colours, a 44 px input, `color-scheme: dark` and an orange `:focus-visible` outline. Ids, `min`, `aria-describedby`, the UTC fallback, the chosen-date line and the change and blur rules stay the same.
    2. `BackupKeyCard` gains `showDemoLabel` (default true). `SealedView real` renders no `<DemoLabel />`, passes `showDemoLabel={!real}` to `SealedKeepsakes` and `BackupKeyCard`, and gives its `h1` `data-step-heading=""` and `tabIndex={-1}`. Without `real` it renders as today.
    3. `SealFailure` and `BackupFallback` gain `real` (default false). Real_Mode omits the `/demo` link and the Demo label and uses `REAL_COPY.passkeyDeleteNote`, `clockBody` and `busyBody`. `cannotLockNext2` and `noPrfOther` are kept (design default).
    4. `FigureRows` and `ReceiptPanel` gain `real` (default false). Real_Mode renders `REAL_COPY.figuresNoneAvailable` as plain text with no link.
  - Acceptance:
    - [ ] 5.1 Dark Date_Picker
      - A contrast test checks the label, hint and problem colours against `#0b0912` at 4.5:1 or more; a render test confirms ids and `min` match the paper surface.
      - _Requirements: 3.4_
    - [ ] 5.2 Keep_Step without Demo labels
      - `SealedView real` has zero `data-demo-label` (including `LetterCard` and `BackupKeyCard`) and an `h1` with `data-step-heading`; `SealedView` without `real` matches its markup at `3bee3055`; `LiveWaitStep` still shows the Demo label on `BackupKeyCard`.
      - _Requirements: 3.6, 3.8, 3.9, 4.5, 4.6, 4.7_
    - [ ] 5.3 Failure screens and figure rows in Real_Mode
      - `SealFailure real` for `cannot_lock` (passkey made and not), `cancelled` and each `failed` kind, and `BackupFallback real`, render the `REAL_COPY` bodies, no `/demo` link and no Demo label; `FigureRows real` renders no link. The Demo_Mode goldens pass unchanged.
      - _Requirements: 3.7, 4.1, 4.5, 4.11, 4.13_
  - Earlier-spec tests changed or retired: none expected; name any.
  - Validation: `bash scripts/check.sh`.

- [ ] 6. SealPage runs Real_Mode in the Live_Stepper; WriteForm wiring; `/seal` backdrop
  - Agent: `frontend-dev` · Depends on: 5 · Estimated size: L, ~1,200 changed lines
  - Follow 'Rules for every task' in tasks.md.
  - Scope: `src/components/live/SealPage.tsx`, `src/components/live/WriteForm.tsx`, `src/components/live/copy.ts` (only removing `REAL_COPY.testNotice`), `src/app/seal/page.tsx`, `SealPage.real.test.tsx` (new), `SealPage.test.tsx`, `src/app/seal/page.test.tsx`, `src/components/live/seal-page-imports.test.ts` (new), `src/components/live/test-notice-scan.test.ts` (new).
  - Design sections: Architecture (the step and Seal_State table), Components 3, 4, 9, Error Handling.
  - Steps:
    1. SealPage renders the Live_Stepper in both modes. The Back_To_Demo_Link renders only in Demo_Mode, in the same tree position as today (so `useId` values and the goldens hold). `renderDemoStep` becomes `renderStep`, with the heading rule `realOwnsHeading` in Real_Mode and the content order from the design (sealed, failure, form). Delete `renderState()`'s `sealed` and default branches.
    2. The sealed effect dispatches `SEALED`, then in Real_Mode `GOTO "sealed"`. Demo_Mode keeps `SealedStep`'s `advanceTo("wait")`.
    3. `WriteForm`: `section="write"` passes `real` to the desk receipt; `section="seal"` passes `real`, `needsDate={dateMissing}` and, while `realDate` is set, the `opening` slot with `REAL_COPY.intro` and `RealDatePicker surface="dark"`. Remove the Test_Notice from the `all` form and `REAL_COPY.testNotice` from `copy.ts`.
    4. `/seal` page: `SceneShell variant="plain" demo={false} backdrop`, no `sound`. The off and empty-`RP_ID` branches stay as they are.
    5. Keep `sealApiFor`, `sealDeps`, the `draft` `useMemo`, `opensOn`, `touched`, `timeZone` and `realDate` as they are. Add no static value import of `@/lib/crypto`, `@/lib/letter-store` or `@/lib/feature-flags` to SealPage.
  - Acceptance:
    - [ ] 6.1 SealPage, WriteForm and `/seal` page
      - The Demo_Mode goldens and the draft and request goldens from task 1 pass unchanged, with Real_Mode now going through the stepper path.
      - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.10, 3.11, 3.12, 3.13, 3.14, 3.15, 4.1, 4.2, 4.3, 4.8, 5.1, 5.2, 5.3, 5.4, 5.6, 7.3, 7.4_
    - [ ] 6.2 `SealPage.real.test.tsx` across every step and Seal_State pair
      - `data-live-stepper` present and no `data-card="live-write"`; exactly one `h1` per pair as in the design's table, `REAL_COPY.stillSealed` the only `h1` on Keep; zero `href="/demo"`, `data-demo-label`, `data-live-rehearsal`, `backupChoiceSkipHelp` and Test_Notice text; visible text matches no Requirement 4.11 pattern; on `seal`, `REAL_COPY.intro` once and before the picker, the Backup_Choice and the press; on `write`, no `real-opens-on` input; with no date the press is blocked and the status line is `REAL_COPY.pressNeedsDate`; `onBack` reaches `SealLinks` only while the tag is `write`; Back keeps the draft and the opening date.
      - _Requirements: 3.3, 3.5, 3.8, 3.10, 3.14, 4.1, 4.3, 4.5, 4.11, 8.4_
    - [ ] 6.3 Request recording and failure screens in Real_Mode
      - The `useSealFlow` spy received `deps.api === realLetterSealApi`; the recorded requests from load to Keep include `/api/letters/prepare` and `/api/letters/seal` and no Demo_Route; Try again and the backup-key fallback also use the Real_Routes; each of `cannot_lock`, `cancelled`, `failed` and `fallback_key` replaces the step content with no forbidden text and keeps "Press the seal" current.
      - _Requirements: 3.7, 3.11, 8.5_
    - [ ] 6.4 Page, boundary and Test_Notice tests
      - `src/app/seal/page.test.tsx`: `SceneShell` gets `variant="plain"`, `demo={false}`, `backdrop` and no `sound`; the off and empty-`RP_ID` branches render as before with no Live_Stepper. `seal-page-imports.test.ts`: no static value import (including `export … from` and relative paths) into the three modules. `test-notice-scan.test.ts`: no non-test file under `src/` holds the Test_Notice text, and `REAL_COPY` has no `testNotice` key.
      - _Requirements: 3.13, 3.15, 4.8, 4.9, 7.6_
  - Earlier-spec tests changed or retired: expected `SealPage.test.tsx` "renders the /seal form outside the demo scope the two-column rule needs" and the Real_Mode case of "shows the PRF_Hint on the Write step", and `src/app/seal/page.test.tsx` "renders SealPage in real mode when REAL_SEALING is on" if it pins `SceneShell` props. Name each by file and title, with the Requirement 5.7 reason.
  - Copy evidence: tone-check for `live/copy.ts`.
  - Validation: `bash scripts/check.sh`.

- [x] 7. Landing_Hero Real_Seal_Link, copy and CSS
  - Agent: `frontend-dev` · Depends on: none · Estimated size: S, ~350 changed lines
  - Follow 'Rules for every task' in tasks.md.
  - Scope: `src/components/landing/LandingHero.tsx`, `src/components/landing/copy.ts`, `src/components/landing/landing.module.css`, `LandingHero.test.tsx`, `LandingHero.real-link.property.test.tsx` (new), and the landing CSS test next to the module.
  - Design sections: Components 10, Property 7.
  - Steps:
    1. Add `LANDING_COPY.realSealLink = "Seal a real letter"`.
    2. `LandingHero` gains `realSealing` (default false). While true, render `<p className={styles.realSeal} data-real-seal=""><Link href="/seal" className={styles.realSealLink}>…</Link></p>` after `data-block="actions"` and before `data-block="seal"`, with no `data-cta` and no `cta`, `accent` or `outlined` class. `LandingHero` stays a server component.
    3. Add `.realSeal`, `.realSealLink`, `.realSealLink:focus-visible` and the phone rule as in the design. No class name contains "accent".
  - Acceptance:
    - [ ] 7.1 Link, copy and CSS
      - `landing/copy-tone.test.ts` passes with the new string; a CSS test checks `min-height` and `min-width` of `2.75rem`, `color: var(--text)`, no fill or border, the `3px solid var(--accent)` focus outline with an offset, the phone `order: 1`, and `#f5f3ff` on `#0b0912` above 4.5:1.
      - _Requirements: 6.2, 6.5, 6.6, 6.7, 6.8_
    - [ ] 7.2 Write property test for the landing hero
      - **Property 7: The landing hero keeps two CTAs and shows the real link only while on**
      - **Validates: Requirements 6.2, 6.3, 6.4, 6.5, 8.6**
  - Earlier-spec tests changed or retired: none expected; name any.
  - Copy evidence: tone-check for `landing/copy.ts`.
  - Validation: `bash scripts/check.sh`.

- [ ] 8. Landing_Page reads `realSealingOn()` per request
  - Agent: `platform-dev` · Depends on: 7 · Estimated size: S, ~150 changed lines
  - Follow 'Rules for every task' in tasks.md.
  - Scope: `src/app/page.tsx`, `src/app/page.test.tsx`, `src/lib/feature-flags-client.test.ts` (new, a source scan; `src/lib/*.test.ts` is platform-dev's).
  - Design sections: Components 10 (`page.tsx`).
  - Steps:
    1. In the server page, call `realSealingOn()` inside the request render (the page stays `force-dynamic`) and pass `realSealing` to `LandingHero`. No `"use client"` is added.
  - Acceptance:
    - [ ] 8.1 Landing_Page wiring and tests
      - `page.test.tsx` renders `/` with `REAL_SEALING` set to `on` and then `off` in the same file with no module reload: one Real_Seal_Link between the actions and seal blocks with no `data-cta` in the first case, none and no `LANDING_COPY.realSealLink` text in the second, at most two `data-cta` links in both. The scan test finds no `"use client"` module that imports `@/lib/feature-flags`.
      - _Requirements: 6.1, 6.3, 6.4, 6.9, 8.6_
  - Earlier-spec tests changed or retired: none expected; name any.
  - Validation: `bash scripts/check.sh`.

- [ ] 9. Real walk, landing check, QA_Shots and evidence
  - Agent: `platform-dev` · Depends on: 6, 8 · Estimated size: M, ~600 changed lines (mostly tests)
  - Follow 'Rules for every task' in tasks.md.
  - Scope: `src/test/integration/real-walk.test.ts` (new), `src/test/integration/live-walk-helpers.ts` (only to share helpers, no behaviour change for `live-walk.test.ts`). The QA_Shots are written to `qa-shots/real-walk/`, which is gitignored, so they are not committed; the shot list and the comparison go in a commit message body.
  - Design sections: Testing Strategy ("Integration walk and QA evidence").
  - Steps:
    1. Write `real-walk.test.ts`, skipped unless `WALK=1`, following `live-walk.test.ts`: headless Chromium with a virtual WebAuthn authenticator that reports PRF, against a local build served with `REAL_SEALING=on` and `RP_ID=localhost`, and a local Postgres container whose name contains "test" (`DATABASE_URL` set per command, never exported, committed or logged; container removed afterwards, even on failure).
    2. The walk goes Write → Press the seal → Keep. It checks focus lands on each step's `[data-step-heading]`, Back from the Seal_Step keeps the letter, answers and chosen date, every seal request goes to `/api/letters/*`, and Keep shows `REAL_COPY.stillSealed`.
    3. Landing check in the same walk: at 1280×800, 1440×900 and 390×844 the Real_Seal_Link box sits fully inside the opaque `.realSeal` box, and the CTAs and the link keep their order.
    4. Take the 12 QA_Shots at 1440×900 and 390×844 into `qa-shots/real-walk/`: `/seal` Write_Step, Seal_Step with no date, Seal_Step with a date, Keep_Step after a local seal; `/demo/live` Write_Step and Seal_Step.
    5. Run `npx vitest run src/components/live src/components/landing src/app` and `bash scripts/check.sh` on the head commit and record both exit codes.
    6. Check the boundaries: `git diff --name-only 3bee3055 HEAD -- src/app/api src/lib/crypto src/lib/seal-format src/lib/letter-store src/lib/db drizzle deploy/helm .env.example package-lock.json` is empty, and `git diff 3bee3055 HEAD -- package.json` shows no `dependencies` or `devDependencies` change.
    7. In a commit message body, list every shot file under `qa-shots/real-walk/`, pair each `/seal` Write_Step and Seal_Step shot with the `/demo/live` shot of the same step and size, list the Keep_Step shots on their own, and under each pair list every visible difference other than those Requirement 4 allows, or "none".
  - Acceptance:
    - [ ] 9.1 Real walk and landing check
      - `WALK=1` run passes; record the run in a commit message body.
      - _Requirements: 3.4, 3.9, 3.10, 3.11, 6.6_
    - [ ] 9.2 Test run, check, boundaries, QA_Shots and the comparison
      - _Requirements: 7.1, 7.2, 7.5, 8.7, 8.8, 8.9, 8.10_
  - Earlier-spec tests changed or retired: none expected; name any.
  - Validation: `bash scripts/check.sh`.

- [ ] 10. Final verification on merged `main`, report only
  - Agent: `platform-dev` · Depends on: 1, 2, 3, 4, 5, 6, 7, 8, 9 · Estimated size: S, one empty commit
  - Follow 'Rules for every task' in tasks.md.
  - Scope: none. The record is the body of one empty commit (`git commit --allow-empty`). Change no source file.
  - Steps:
    1. On merged `main`, run `npx vitest run src/components/live src/components/landing src/app` and `bash scripts/check.sh`, and record both exit codes.
    2. Run the Demo_Mode golden tests named in the rules and confirm they pass without `RECORD_GOLDEN`.
    3. Run the Requirement 7 boundary diffs: `git diff --name-only 3bee3055 HEAD -- src/app/api src/lib/crypto src/lib/seal-format src/lib/letter-store src/lib/db drizzle deploy/helm .env.example package-lock.json` is empty, and `git diff 3bee3055 HEAD -- package.json` shows no `dependencies` or `devDependencies` change.
    4. Read task 9's commit message body on `main` (`git log`) and confirm it lists the 12 QA_Shots, pairs each `/seal` Write_Step and Seal_Step shot with its `/demo/live` shot, and states the differences or "none" under each pair.
    5. The commit body states the full `main` SHA and every result. If a check fails, state the failure: the check, the command, the expected and the found result. Make no fix in this task.
  - Acceptance:
    - [ ] 10.1 Suite, check, goldens, boundaries and the QA_Shots comparison on one commit
      - _Requirements: 5.1, 5.3, 7.1, 7.2, 7.5, 8.7, 8.8, 8.9, 8.10_

## Notes

- Property test sub-tasks are not marked optional, following specs 15 to 18. Requirement 8 asks for the invariant and table tests, and the oracle property is the evidence that Demo_Mode is unchanged.
- Task 1 must land before any `/seal` code change, because its goldens are recorded from the baseline. The oracle property test is written there and only gains the `mode` assertion in task 2.3, since `StepperState` has no `mode` until task 2.
- Tasks 1 to 6 stay sequential because they touch the same files under `src/components/live/`. Tasks 7 and 8 touch only the landing files and `src/app/page.tsx`, so they run alongside the `/seal` chain. Landing changes do not affect the goldens, which cover `src/components/live` only.
- `REAL_COPY.testNotice` is removed in task 6, together with its last use in `WriteForm`, so no intermediate commit breaks the build.
- `src/app/page.tsx` matches both platform-dev (by name) and frontend-dev (`src/app/**/*.tsx`). Task 8 gives it to platform-dev, as the design and `structure.md` do. Task 7 lands the prop first with a `false` default, so task 8's wiring is a one-line change.
- Requirement 8.10 asks for pairs "in the PR description". Following earlier specs, they go in a commit message body, which the PR shows. The shots themselves stay local in the gitignored `qa-shots/real-walk/`.
- Task 9 needs Docker for the local Postgres container and a local Chromium for `playwright-core`.
- Every PR is reviewed by the dispatcher's automatic QA run, so no task asks for a review.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "7.1"] },
    { "id": 1, "tasks": ["1.2", "7.2"] },
    { "id": 2, "tasks": ["1.3", "8.1"] },
    { "id": 3, "tasks": ["2.1"] },
    { "id": 4, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6"] },
    { "id": 5, "tasks": ["3.1"] },
    { "id": 6, "tasks": ["3.2", "3.3"] },
    { "id": 7, "tasks": ["4.1"] },
    { "id": 8, "tasks": ["4.2"] },
    { "id": 9, "tasks": ["4.3"] },
    { "id": 10, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 11, "tasks": ["6.1"] },
    { "id": 12, "tasks": ["6.2", "6.3", "6.4"] },
    { "id": 13, "tasks": ["9.1"] },
    { "id": 14, "tasks": ["9.2"] },
    { "id": 15, "tasks": ["10.1"] }
  ]
}
```
