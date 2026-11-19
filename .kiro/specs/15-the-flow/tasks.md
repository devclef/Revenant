# Implementation Plan: 15 The flow

## Overview

Spec 15 builds the owner-approved design in `docs/design/15-flow/` (PR #508): one shell for every page, each author question answered when writing and sealed with its answer (format version 2), the reader's recollection set beside it at opening, the receipts in the new order, Priya sealed again as version 2, and persona "now" figures for the week of the opening date.

The prototype is the design. `requirements.md` says what to build, `design.md` says how the pieces connect, and the README in the prototype folder holds every string. A task names the screen IDs it covers and builds them in the app's components and CSS modules.

Order: the opening code first, then the sealed format, the persona sealing and content, the persona figures, the shell, the screens in flow order, the keepsakes, then verification.

| Tasks | What | Roles |
|---|---|---|
| 1 to 3 | Opening code takes any payload version; format version 2; persona sealing script | frontend-dev, crypto-dev |
| 4, 5 | Priya's content; persona "now" figures | frontend-dev, data-dev |
| 6, 7 | The shell; home, demo, how, not-found | frontend-dev |
| 8, 9, 10 | Write; Press the seal and Wait; the opening flow | frontend-dev |
| 11, 12 | Testify; Break the seal and the receipts | frontend-dev |
| 13 | Keepsakes | frontend-dev |
| 14, 15, 16 | Layout rows, walk and docs; fix-up; final walk | platform-dev, frontend-dev |

Each task is one GitHub issue and one PR for one role, inside that role's paths in `.github/agents.json` (plus `shared`) and under its `max_changed_lines` (5,000, test files excluded). "Depends on" lists only task numbers of this spec. The agent loop runs one task at a time and takes the lowest-numbered ready issue.

## Rules for every task

- **Branch and PR.** The dispatcher creates `agent/<role>/issue-N` and the PR "Closes #N". Do not push to `main` or merge. After a hook failure, make a new commit; do not amend.
- **Scope.** Change only files that match your role's paths in `.github/agents.json` (or `shared`) and are listed in your task's Scope, plus new `*.test.ts(x)` files next to the code they test. Check your diff with `git diff --name-only origin/main` before you finish and put the list in a commit message body.
- **Hard boundaries.** No task changes a file under `.kiro/`, `.github/`, `tools/agents/`, `tools/dispatcher/`, `tools/hooks/`, `src/app/api/`, `src/lib/letter-store/`, `src/lib/db/` or `drizzle/`, or `scripts/check.sh`, `docs/kiro-writeup.md`, the Helm chart or an environment variable. `src/lib/crypto/`, `src/lib/seal-format/` and `scripts/seal-personas*` change only in tasks 2 and 3, which may add `format_version` 2 and nothing else of the sealed format: no crypto primitive, key step or header field changes. `README.md` and `docs/video-script.md` change only in task 14.
- **Privacy and size.** CSP header byte-identical. No request to another origin. New code writes nothing to `localStorage`, `sessionStorage`, IndexedDB, cookies, the URL path, the query string or the fragment. No new `dependencies` entry, animation library, WebGL, font file, sound cue or vibration cue.
- **Copy.** Every string lives in its feature folder's `copy.ts` (Occasion wording in `occasions.ts`) and is exactly the string in the README entry for the screen. Second person for sentences that address the reader (Occasion questions are first person), at most 25 words per sentence, no exclamation mark, no pun, nothing on `tone.md`'s avoid list, nothing that grades a testimony. Each copy task states in a commit message body the result of `node tools/hooks/tone-check.mjs <file>` for every copy file it changed.
- **Accent and contrast.** The accent marks only what `tone.md` lists, including the reader's testimony on the receipts. It never marks a figure, a change or a direction and is never text on purple. Every text and number meets WCAG 2.2 AA on its surface. Decoration never sits under text.
- **Neutrality and data integrity.** Nothing scores, diffs, highlights, summarises or explains a gap between testimony and letter, or between a recollection and its sealed answer. Up and down get the same visual treatment. Every figure shown carries value, unit, region, period, source and `retrieved_at`, with its period next to it. Nothing is invented, estimated, converted or filled. The change is computed from full precision in `src/lib/figures`.
- **Motion.** Decorative motion changes only `transform` and `opacity`, runs only under `prefers-reduced-motion: no-preference` with Calm off, and every sequence can be skipped. Keep what the app does today where the prototype shows none.
- **JS budget.** Every route stays inside `scripts/check-js-budget.mjs`. No task raises a value in it. The opening flow loads on `/demo/live` with `next/dynamic` once the Wait step starts. A task that cannot fit reports the measured number in a commit message body and stops, and the owner decides.
- **Reports.** Anything a task asks for "in the PR" goes in a commit message body on the task's branch, kept short (bodies are cut at 12,000 characters). No task edits the PR description or attaches files.
- **Tests.** Vitest, `renderToStaticMarkup`, every `fetch` stubbed, no network, `DATABASE_URL` unset, no browser (layout-check and the Live_Walk excepted). Property tests use fast-check with `numRuns` of at least 100 and the tag `// Feature: 15-the-flow, Property N: <title>` with the title from `design.md`. A task that changes behaviour updates or retires the tests it outdates and names each with its reason.
- **Evidence.** A commit message body states the final commit SHA, the exit status of `bash scripts/check.sh` and PASS or FAIL, every route budget from `node scripts/check-js-budget.mjs` after `npm run build`, and every earlier-spec test changed or retired, each with its reason ("none" if empty).
- **How QA checks a screen.** For every screen ID a task covers, QA drives the real app into the same state at 1440 × 900 and 390 × 844 and compares it with `docs/design/15-flow/shots/{id}-desktop.png` and `{id}-phone.png`. Any visible difference other than live data (dates, letter ids, fingerprints, figure values) is a defect unless the task's commit notes say why. Dev agents attach no screenshots.
- **Layout rows and walk between tasks.** `npm run layout-check` and `npm run live-walk` run against a local production build. A row or step that asserts what this spec replaces may fail until task 14 retires it. QA records each as `EXPECTED: replaced by spec 15` and it does not block. Any other failing row blocks the PR.
- **After the merge.** `bash scripts/check.sh` passes on `main`. On a production build, `/`, `/demo`, `/demo/live`, `/how-it-is-sealed`, every persona page and `/l/<an id that does not exist>` each return a status below 500 and render with no uncaught page error at both sizes.
- If `design.md` and the code on `main` disagree, re-read the code, keep the design's behaviour, and say what you changed and why in a commit message body. If something is still unclear, decide, record the decision in a commit message body under "Decisions", and continue. Do not stop to ask.

## Tasks

- [x] 1. Opening code takes any payload version
  - Agent: `frontend-dev` · Depends on: none · Estimated size: S, ~250 changed lines
  - Scope: `src/components/reveal/opened-payload.ts` (new), `opening-machine.ts`, `FiguresThenNow.tsx`, `src/components/ceremony/recall/RecallPager.tsx`, `src/lib/recall/generate.ts` (types only), and the `*.test.ts(x)` next to each.
  - Design sections: "2. Opening code takes any version".
  - Steps:
    1. Add `OpenedPayload`, the structural subset the reveal reads (`letter_text`, `written_as_of`, `metrics`, `figures`, `recall_questions`), derived from `PayloadV1` so a version 2 payload satisfies it.
    2. Replace the `PayloadV1` annotations in the three consumers with `OpenedPayload`. Change no behaviour.
  - Acceptance:
    - [ ] 1.1 Add `OpenedPayload` and use it in the three consumers
      - A type test (`expectTypeOf`) shows `PayloadV1` is assignable to `OpenedPayload`.
      - _Requirements: 2.4_
  - Earlier-spec tests changed or retired: none expected; name any.
  - Validation: `bash scripts/check.sh`; `npx tsc --noEmit`.

- [ ] 2. Format version 2: a sealed answer for each author question
  - Agent: `crypto-dev` · Depends on: 1 · Estimated size: M, ~900 changed lines
  - Scope: `src/lib/seal-format/**` (`v2/payload.ts`, `v2/header.ts`, `registry.ts`, `index.ts`, `__fixtures__/`), `src/lib/crypto/seal.ts`, `open.ts`, `errors.ts`, and the `*.test.ts(x)` next to each. May change `format_version`. Changes no primitive, key step or header field.
  - Design sections: "1. Sealed format version 2", Properties 1 to 3.
  - Steps:
    1. Add `payloadV2Schema` and `headerV2Schema` as in the design. Add `2` to `formats`. `parsePayload` and `parseEnvelope` return the union types.
    2. Make `sealLetter` and `openLetter` accept either version. `OpenResult.payload` is the union. Export `sealedAnswerOf`.
    3. Keep the version 1 golden fixture and its tests. Add a version 2 golden fixture.
  - Acceptance:
    - [ ] 2.1 Version 2 schemas, registry and the two crypto entry points
      - A version 1 letter opens exactly as before. A version 2 text question without `sealed_answer` is rejected.
      - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
    - [ ] 2.2 Write property tests
      - Property 1 (version 2 round trip), Property 2 (version 1 still opens), Property 3 (a version 2 text question needs an answer).
      - **Validates: Requirements 2.1, 2.3, 2.5**
  - Earlier-spec tests changed or retired: `registry.test.ts` (the registry now has two entries), any test that asserts `parsePayload` returns only `PayloadV1`; name each with its reason.
  - Validation: `bash scripts/check.sh`; the golden fixtures pass.

- [ ] 3. Persona sealing script seals version 2
  - Agent: `crypto-dev` · Depends on: 2 · Estimated size: M, ~600 changed lines
  - Scope: `scripts/seal-personas-core.ts`, `seal-personas.ts`, `seal-personas.build.mjs`, `seal-personas-texts.d.ts`, and the `*.test.ts(x)` next to them.
  - Design sections: "3. Personas".
  - Steps:
    1. `buildPersonaPayload` returns a version 2 payload with each `sealed_answer` for a persona that has an entry in `content/personas/letters/sealed-answers.json`, and a version 1 payload for every other persona. It stays pure and deterministic. The file may be absent: the build then inlines `{}`.
    2. Add the `--hashes` option: print each persona's `key`, `letter_id` and `envelope_hash` and exit before the `DATABASE_URL` guard. It prints no secret.
    3. Test with fixture personas. Do not edit `content/personas/**` (task 4 does).
  - Acceptance:
    - [ ] 3.1 Version 2 persona payloads and `--hashes`
      - Two runs give byte-identical envelopes. A persona without sealed answers is byte-identical to today's.
      - _Requirements: 3.2_
  - Earlier-spec tests changed or retired: name any.
  - Validation: `bash scripts/check.sh`; `npm run build` then `node dist/seal-personas.mjs --hashes` prints one line per persona and the three existing hashes are unchanged.

- [ ] 4. Priya's content: questions, sealed answers, recollections, new letter
  - Agent: `frontend-dev` · Depends on: 3 · Estimated size: S, ~300 changed lines
  - Scope: `content/personas/personas.json`, `content/personas/letters/answers.json`, `content/personas/letters/sealed-answers.json` (new), `content/personas/letters/us-priya-copy-test.md`, `src/lib/personas/**`, and the `*.test.ts(x)` next to them.
  - Design sections: "3. Personas".
  - Steps:
    1. Rewrite Priya's two questions, add her two sealed answers and her two recollections exactly as in the README section "Priya: copy for the owner to approve". Update her copy-test file against `neutrality.md`.
    2. Choose a new letter id (22 random base64url characters), append the old id to `retired_letter_ids`, run `npm run build` then `node dist/seal-personas.mjs --hashes`, and write her new `letter_id` and `envelope_hash`.
    3. Validate both answer files in `src/lib/personas/answers.ts` as in the design.
    4. Say in a commit message body that the old version 1 row stays in `demo_letters` and is not referenced.
  - Acceptance:
    - [ ] 4.1 Priya's content and the new letter
      - The three other personas' fields are unchanged.
      - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6_
  - Earlier-spec tests changed or retired: `answers.test.ts`, `intro-line.test.ts`, `schema*.test.ts`, `index.test.ts`, `src/components/retired-ids-scan.test.ts` (new retired id); name each with its reason.
  - Copy evidence: tone-check for the changed copy files and the neutrality check of `letter-checks` for Priya's answers.
  - Validation: `bash scripts/check.sh`.

- [x] 5. Persona "now" figures for the week of the opening date
  - Agent: `data-dev` · Depends on: none · Estimated size: S, ~250 changed lines
  - Scope: `src/lib/figures/at-opening.ts` (new), `src/lib/figures/index.ts`, and the `*.test.ts(x)` next to them.
  - Design sections: "4. Persona 'now' figures", Property 7.
  - Steps:
    1. Add `figureAtOpening(metricId, opensAt, data)` and `personaNowResponse(persona, data)` as in the design. They return the frozen figure from the file with its provenance and never convert, round or fill.
    2. Pin Maya's two 4 November 2024 records and Tomás's two 3 June 2024 records in a test from `fuel-figures.json`.
  - Acceptance:
    - [ ] 5.1 Implement the two functions and pin the persona records
      - A missing record returns a gap with its reason.
      - _Requirements: 4.1, 4.2, 4.3, 4.5_
    - [ ] 5.2 Write the property test
      - Property 7 (a persona's "now" is the latest record at or before its opening date).
      - **Validates: Requirements 4.1**
  - Earlier-spec tests changed or retired: none expected; name any.
  - Validation: `bash scripts/check.sh`.

- [ ] 6. The shell: top bar, step track, ghost placement, envelope, soil strip
  - Agent: `frontend-dev` · Depends on: none · Estimated size: L, ~2,000 changed lines
  - Scope: `src/components/ceremony/scene/**`, `src/components/ceremony/envelope/**`, `src/components/ceremony/steps.ts`, `src/components/live/stepper/` (the track components), `src/components/ui/**`, `src/components/ceremony/ceremony.module.css`, and the `*.test.ts(x)` next to each.
  - Covers: the shell of every screen ID. Design sections: "5. The shell", Requirement 5.
  - Steps:
    1. `TopBar` to the slots of Requirement 5.1, with the persona notice in the bar (one line) and in the strip (phone), the uppercase wordmark and the DEMO chip.
    2. One `StepTrack` taking `steps` and `current`, with the six-step and three-step lists and the phone line. Replace the two track components that exist today and their callers.
    3. Move the ghost into the column at the three sizes. Delete the viewport-percentage placement (`.ghostPlace`, `--ghost-x`) and every rule that clips it at the right edge. The ghost stays unmounted outside emergence to break.
    4. Delete the `Dirt` group from `Envelope.tsx` and its CSS. Add `SoilStrip` under envelopes.
    5. Keep every other behaviour: Calm, sound, Skip logic, the seal check.
  - Acceptance:
    - [ ] 6.1 Top bar, step track, ghost placement, envelope and soil strip
      - A CSS source test fails if `--ghost-x`, `.ghostPlace` or a `Dirt` rule reappears.
      - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  - Earlier-spec tests changed or retired: the Envelope tests for the dirt band, the Scene tests for the old ghost and bar rules (`ghost-placement.test.tsx`, `layout.test.ts`, `light-x.test.ts`, `topbar-*.test.ts`, `ghost-presence.test.ts`), `StepTrack.test.tsx`, `step-track-css.test.ts`, `ceremony/steps.test.ts`, `step-indicator.property.test.tsx`; name each with its reason.
  - Copy evidence: tone-check for `scene/copy.ts` and `ceremony/copy.ts` if changed.
  - QA: compare the shell on `home` and `demo` (no ghost), `unlock` and `emergence` (ghost), at both sizes.

- [ ] 7. Home, demo, how it is sealed and not found
  - Agent: `frontend-dev` · Depends on: 6 · Estimated size: M, ~1,200 changed lines
  - Scope: `src/app/page.tsx` (see boundary note), `src/app/demo/page.tsx`, `src/app/how-it-is-sealed/page.tsx`, `src/app/not-found.tsx`, `src/app/seal/page.tsx`, `src/components/landing/**`, `src/components/demo/**`, `src/components/how/**`, `src/components/brand/copy.ts`, and the `*.test.ts(x)` next to each.
  - Covers: `home`, `demo`, `how`, `not-found`. Requirement 6.
  - Steps:
    1. Build the four screens. `src/app/page.tsx` belongs to platform-dev in `.github/agents.json`: change only the components it renders, and say in a commit message body if a line in `page.tsx` itself must change, so task 14 makes it.
    2. `/seal` renders the not-found screen while real sealing is off.
    3. Ritual copy as in the README strings for `home`.
  - Acceptance:
    - [ ] 7.1 The four screens and `/seal`
      - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - Earlier-spec tests changed or retired: `src/test/landing*.test.tsx`, `PersonaCard.test.tsx`, `LiveEntry.test.ts` as needed; name each.
  - Copy evidence: tone-check for `brand/copy.ts`, `landing/copy.ts`, `demo/copy.ts`, `how/copy.ts`.

- [ ] 8. Write: answers with every question, new Occasion wording, version 2 payload
  - Agent: `frontend-dev` · Depends on: 2, 6 · Estimated size: L, ~1,800 changed lines
  - Scope: `src/components/live/desk/**`, `src/components/live/occasions.ts`, `src/components/live/build-payload.ts`, `src/components/live/seal-runner.ts` (its `PayloadV1` annotation), `src/components/live/WriteForm.tsx`, `src/components/live/copy.ts`, `src/lib/recall/**`, and the `*.test.ts(x)` next to each.
  - Covers: `write-empty`, `write-filled`, `write-check`, `write-own-number`. Requirements 7 and 8; design "6. Write", Properties 4 and 8.
  - Steps:
    1. Answer field in each question row, one default row, up to three, the 1,000 code point limit, answers kept on removal and Occasion picks as in Requirement 7.5.
    2. Fold check names the first unanswered question and moves focus to its answer; an over-long answer is named and not sealed.
    3. Envelope panel's seal at 35% until the check would pass.
    4. `occasions.ts` takes the README table. `build-payload.ts` builds a version 2 payload.
  - Acceptance:
    - [ ] 8.1 Answers, fold check and version 2 payload
      - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_
    - [ ] 8.2 Occasion wording
      - _Requirements: 8.1, 8.2, 8.3_
    - [ ] 8.3 Write property tests
      - Property 4 (the fold check names the first unanswered question), Property 8 (Occasion questions are first person).
      - **Validates: Requirements 7.4, 8.2**
  - Earlier-spec tests changed or retired: `occasions-desk.test.ts`, `occasions.test.ts`, `copy.test.ts` (the ban on "right now", "today" and "currently"), `src/test/retired-phrases.test.ts` (the retired "right now" entry), `write-check*.test.ts`, `QuestionRow.test.tsx`, `WriteForm*.test.tsx`, `build-payload*.test.ts`; name each with its reason.
  - Copy evidence: tone-check for `live/copy.ts`, `desk/copy.ts`, `occasions.ts`.

- [ ] 9. Press the seal and Wait
  - Agent: `frontend-dev` · Depends on: 8 · Estimated size: L, ~1,600 changed lines
  - Scope: `src/components/live/seal-step/**`, `src/components/live/press/**`, `src/components/live/BackupChoice.tsx`, `BackupFallback.tsx`, `SealFailure.tsx`, `src/components/live/stepper/LiveWaitStep.tsx`, `SealedEnvelopeView.tsx`, `src/components/live/LetterCard.tsx`, `SealedKeepsakes.tsx`, `src/components/live/copy.ts`, `src/components/live/press/copy.ts`, and the `*.test.ts(x)` next to each.
  - Covers: `seal-choose`, `seal-step-1`, `seal-step-2`, `seal-sealing`, `seal-backup`, `seal-no-prf`, `seal-failed`, `wait-counting`, `wait-ready`. Requirement 9.
  - Steps:
    1. Build the seal steps. Keep two presses and the seal machine as they are. The wax carries the relief in every state.
    2. Build the one-card Wait step. "Open your letter" moves the stepper to Testify on the same page. Remove "Go to your letter" and the second unlock panel.
  - Acceptance:
    - [ ] 9.1 Press the seal
      - _Requirements: 9.1, 9.2, 9.3_
    - [ ] 9.2 Wait
      - _Requirements: 9.4, 9.5, 9.6, 9.7_
  - Earlier-spec tests changed or retired: `seal-step*.test.*`, `press*.test.*`, `BackupChoice.test.tsx`, `LiveWaitStep.test.tsx`, `goto-letter.property.test.ts`, `unlock-in-place.test.ts`, `LiveStepper*.test.tsx`; name each.
  - Copy evidence: tone-check for the changed copy files.

- [ ] 10. The opening flow on `/demo/live` and `/l/{id}`
  - Agent: `frontend-dev` · Depends on: 6, 9 · Estimated size: L, ~1,700 changed lines
  - Scope: `src/components/reveal/**` (the still-sealed and unlock parts and `OpeningFlow.tsx`), `src/components/live/UnlockView.tsx`, `src/components/live/stepper/LiveStepper.tsx`, `src/components/ceremony/scene/**` (ghost use), `src/app/l/[id]/**`, `src/app/demo/live/**`, `src/components/reveal/copy.ts`, and the `*.test.ts(x)` next to each.
  - Covers: `still-sealed`, `unlock`, `unlock-backup`, `unlock-error`, `emergence`. Requirement 10; design "8. Opening flow on both routes".
  - Steps:
    1. One opening flow component for unlock, emergence, Testify, Break and receipts. `LiveStepper` renders it for the last three steps and loads it with `next/dynamic` once Wait starts. `/l/{id}` renders it with the three-step track.
    2. Build the five screens. Keep the seal check, the error handling and the cross-device help as they are.
    3. Persona pages open on the first question as today.
    4. Measure the budgets. If `/demo/live` is over, report the number and stop.
  - Acceptance:
    - [ ] 10.1 The five screens and the shared flow
      - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_
  - Earlier-spec tests changed or retired: `UnlockView.test.tsx`, `LiveStepper*.test.tsx`, `OpeningFlow*.test.tsx`, `StillSealed` tests; name each.
  - Copy evidence: tone-check for the changed copy files.

- [ ] 11. Testify
  - Agent: `frontend-dev` · Depends on: 2, 4, 10 · Estimated size: M, ~1,300 changed lines
  - Scope: `src/components/ceremony/recall/**`, `src/components/reveal/RecallStep.tsx`, `TestifyContext.tsx`, `src/components/reveal/copy.ts`, `src/components/ceremony/copy.ts`, and the `*.test.ts(x)` next to each.
  - Covers: `testify-text`, `testify-number`, `testify-last`, `maya-testify`, `priya-testify`. Requirement 11; design "9. Testify and receipts".
  - Steps:
    1. Author questions: the "On {date} you asked yourself:" line, the question on paper, the "What you think you answered" field, "I don't remember". The reader's text is stored as today's text answer.
    2. Persona with sealed answers: show her recollection read-only, labelled fictional.
    3. Figure questions keep today's wording. The scale uses the fixed range from `unit-ranges.ts` only. The counter and sample note as in Requirement 11.4 and 11.5.
    4. On phone the controls are as drawn so the primary action stays in view.
  - Acceptance:
    - [ ] 11.1 Author questions and persona recollections
      - _Requirements: 11.1, 11.2, 11.6_
    - [ ] 11.2 Figure questions, counters and phone controls
      - A test fails if the scale range reads a sealed figure or a sample answer.
      - _Requirements: 11.3, 11.4, 11.5, 11.7_
  - Earlier-spec tests changed or retired: `RecallPager*.test.tsx`, `written-on.property.test.ts`, `TextAnswerField.test.tsx`, `RecallScale.test.tsx`, `answer-display-scan.test.ts`, `samples.test.ts`; name each.
  - Copy evidence: tone-check for the changed copy files.

- [ ] 12. Break the seal and the receipts
  - Agent: `frontend-dev` · Depends on: 5, 11 · Estimated size: L, ~2,000 changed lines
  - Scope: `src/components/ceremony/seal/**`, `src/components/ceremony/close/**`, `src/components/ceremony/letter/**`, `src/components/ceremony/figures/**`, `src/components/reveal/**` (the receipts, `ChangeLine.tsx`, `ReceiptCard.tsx`, `tamper/**`), `src/app/demo/personas/[key]/page.tsx`, `src/components/reveal/copy.ts`, `src/components/ceremony/copy.ts`, and the `*.test.ts(x)` next to each.
  - Covers: `break`, `maya-break`, `receipts-live`, `maya-receipts`, `maya-tampered`, `priya-receipts`. Requirement 12.
  - Steps:
    1. Break the seal as drawn. The ghost hands over the letter and leaves.
    2. One receipts column in the order of Requirement 12.2, with `QuestionPair`, `LetterPaper`, `FigureReceipt`, `SealLine` and `EndCard`. Show "No answer was sealed with this question." for a version 1 question.
    3. The change line, formula and same-period line as in 12.4 and 12.5, from `src/lib/figures` (no change to that folder).
    4. The persona page builds `personaNowResponse` on the server and passes it to the reveal in place of the request. Live and real letters keep the request.
    5. The tamper control moves into the seal row and keeps its behaviour.
  - Acceptance:
    - [ ] 12.1 Break the seal and the receipts column
      - _Requirements: 12.1, 12.2, 12.3, 12.7, 12.8_
    - [ ] 12.2 Figures, change line and persona "now"
      - _Requirements: 4.4, 12.4, 12.5, 12.6_
    - [ ] 12.3 Write property tests
      - Property 5 (receipts pair text without changing it), Property 6 (the change line follows the figures).
      - **Validates: Requirements 12.3, 12.4**
  - Earlier-spec tests changed or retired: `Reveal*.test.tsx`, `ChangeLine*.test.tsx`, `ReceiptCard*.test.tsx`, `LetterBlock*.test.tsx`, `close/*.test.tsx`, `tamper/*.test.tsx`, `ceremony-gates.property.test.tsx`; name each.
  - Copy evidence: tone-check for the changed copy files.

- [ ] 13. Keepsakes
  - Agent: `frontend-dev` · Depends on: 6 · Estimated size: S, ~500 changed lines
  - Scope: `src/lib/cards/**`, `src/components/live/BackupKeyCard.tsx`, `LetterCard.tsx`, `SealedKeepsakes.tsx`, `src/components/live/copy.ts`, and the `*.test.ts(x)` next to each.
  - Covers: `letter-card`, `backup-card`. Requirement 13.
  - Steps: build the two cards as drawn. Keep them browser-only and the key off the server.
  - Acceptance:
    - [ ] 13.1 The two printable cards
      - _Requirements: 13.1, 13.2_
  - Earlier-spec tests changed or retired: `letter-card-svg.test.ts`, `BackupKeyCard.test.tsx`, `keepsake-files.test.ts`; name each.
  - Copy evidence: tone-check for `live/copy.ts`.

- [ ] 14. Layout rows, the Live_Walk and the docs for the new flow
  - Agent: `platform-dev` · Depends on: 7, 8, 9, 10, 11, 12, 13 · Estimated size: L, ~1,800 changed lines
  - Scope: `tools/qa/layout-check.mjs`, `src/test/integration/live-walk*.ts`, `src/app/page.tsx`, `README.md`, `docs/video-script.md`, and the tests that cover them.
  - Requirement 14.
  - Steps:
    1. Layout-check rows for what this spec fixes in position: the ghost in the column and unclipped at 390, the Skip slot stable, no dirt band, one persona notice, one DEMO label, and the primary action in view on the screens of Requirement 1.7. Retire the rows and walk steps this spec replaces, with each reason in a commit message body.
    2. Rewrite the walk for the new flow at both sizes: Write with answers, a fold check failure, Press the seal in two presses, Wait, "Open your letter", Testify (author and figure question), Break the seal, the receipts, and a persona. Each failure helper has a passing and a failing example.
    3. Update `README.md` and `docs/video-script.md` to the new ritual (questions answered when writing and recalled at opening). Keep the provenance comments in the video script correct.
    4. If task 7's commit notes say a line in `src/app/page.tsx` must change, make that change here.
    5. A row or step that fails because of a product file is listed under "For task 15" with its name, output and suspected file. This task edits no product file other than the `src/app/page.tsx` change in step 4 and lowers no threshold.
  - Acceptance:
    - [ ] 14.1 Layout rows and retirements
      - _Requirements: 14.1_
    - [ ] 14.2 Live_Walk rewrite and docs
      - _Requirements: 14.1, 14.2_
  - Earlier-spec tests changed or retired: the layout-check and walk tests whose rows or steps change; name each.
  - QA: `npm run layout-check` against a local production build with the result lines quoted; the helper tests; one `npm run live-walk` run.

- [ ] 15. Fix-up: fix every product failure the rows and the walk report
  - Agent: `frontend-dev` · Depends on: 14 · Estimated size: M, ~1,000 changed lines
  - Scope: frontend-dev paths only, plus the `*.test.ts(x)` next to each file. It does not edit `tools/qa/` or `src/test/`, a layout row, a threshold or a walk step.
  - Steps:
    1. Start the local stack (a Postgres container whose name contains "test", `npm run db:migrate`, `npm run build`, `npm run seal-personas`, the app on port 3000). Put `DATABASE_URL` in front of each command; never export, commit or log it.
    2. Run `npm run layout-check -- --url http://localhost:3000` and `npm run live-walk`. Read "For task 15" in task 14's commit notes first.
    3. For each failure, fix the product file, rebuild and rerun until both pass. If a row or step is itself wrong, say so in the commit notes and leave it.
    4. If nothing fails, make one empty commit that quotes the passing result lines.
    5. Stop the app and remove the container, even if something failed.
  - Acceptance:
    - [ ] 15.1 Fix until both pass
      - The last commit body states the `main` SHA the branch started from, the final SHA and the passing result lines.
      - _Requirements: 14.1_
    - [ ] 15.2 A test for each product fix
      - A markup or CSS source test that fails before the fix and passes after. None when nothing failed.
  - Earlier-spec tests changed or retired: any test a fix changes; "none" if nothing failed.
  - QA: rerun both commands on the final commit and quote their result lines; check the diff touches nothing under `tools/qa/` or `src/test/`.

- [ ] 16. Final walk on merged `main`, report only
  - Agent: `platform-dev` · Depends on: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15 · Estimated size: S, one empty commit
  - Scope: none. The record is the body of one empty commit (`git commit --allow-empty`). It changes no file.
  - Steps:
    1. On merged `main`, start the local stack as in task 15 and run `npm run live-walk` and `npm run layout-check -- --url http://localhost:3000`. Stop the app and remove the container afterwards.
    2. Put every real screen beside its prototype shot (`docs/design/15-flow/shots/{id}-desktop.png` and `{id}-phone.png`) for all 35 screen IDs and list each visible difference other than live data.
    3. The commit body states the full `main` SHA, every result line of both commands and the list of differences, kept short.
  - Acceptance:
    - [ ] 16.1 Run the walk and record it
      - _Requirements: 14.5_

## Notes

- The task numbering differs from the owner's outline in one place: the persona content (task 4) is its own task, because `content/personas/**` and `src/lib/personas/**` are frontend-dev's and the sealing script is crypto-dev's.
- The old version 1 Priya row cannot be removed: sealed rows are immutable. Task 4 retires its id and nothing references it.
- Whether `src/app/page.tsx` needs a change is decided in task 7; it is platform-dev's file in `.github/agents.json`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "5.1", "6.1"] },
    { "id": 1, "tasks": ["2.1", "5.2", "7.1", "13.1"] },
    { "id": 2, "tasks": ["2.2", "3.1", "8.1"] },
    { "id": 3, "tasks": ["4.1", "8.2", "8.3"] },
    { "id": 4, "tasks": ["9.1", "9.2"] },
    { "id": 5, "tasks": ["10.1"] },
    { "id": 6, "tasks": ["11.1", "11.2"] },
    { "id": 7, "tasks": ["12.1", "12.2", "12.3"] },
    { "id": 8, "tasks": ["14.1", "14.2"] },
    { "id": 9, "tasks": ["15.1", "15.2"] },
    { "id": 10, "tasks": ["16.1"] }
  ]
}
```
