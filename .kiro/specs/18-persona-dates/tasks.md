# Implementation Plan: 18 Persona dates

## Overview

Spec 18 moves the three persona letters (Maya, Tomás, Priya) to one written-as-of date, Sunday 17 November 2024, and one opening date, 17 November 2026. It refetches the four fuel series past the opening date, rewrites the persona texts for a November Sunday, reseals the three letters with new ids, and makes `content/personas/personas.json` the only place a persona date is written. Nothing sealed changes in place. The old `demo_letters` rows stay stored under their retired ids.

`requirements.md` says what to build and `design.md` says which files change and how. The work has three phases, split by two owner-only gates:

1. **Before the Approval_Gate (tasks 1 to 8).** Code and tests that touch no persona content: the banned-terms rule table and text checks, the fail-closed Prefetch_Script, the refetch, the sealed-for-demo line, the retired-id scan, the test refactors that read dates from the Persona_List, and the sealing script's pre-checks.
2. **The gate (tasks 9 and 10, owner only).** The owner copies the four at-opening rows from task 3's report into `design.md`, re-reads the whole design, and records the Approval_Gate.
3. **After the gate (tasks 11 to 17).** PR A (content, dates, ids, Date_Guard, steering), docs and QA tooling, a local reseal and walk, the production deploy that seals in the init container, PR B (the three production hashes), the PR B deploy and the final verification.

| Tasks | What | Roles |
|---|---|---|
| 1 | Banned-terms rule table and persona text checks | frontend-dev |
| 2, 3 | Fail-closed Prefetch_Script; the refetch and the figure report | data-dev |
| 4, 5, 6 | Sealed-for-demo line; retired-id scan; tests read the Persona_List | frontend-dev |
| 7 | `at-opening` test and comment | data-dev |
| 8 | Sealing script checks every Persona_Text before it seals | crypto-dev |
| 9, 10 | Design re-presented; Approval_Gate | owner |
| 11 | PR A: dates, ids, texts, samples, copy-test records, Date_Guard | frontend-dev (steering commit by the owner) |
| 12, 13 | README, video script and journey check; Live_Walk, local reseal and layout baseline | platform-dev |
| 14 | Deploy PR A, seal in the init container, record row counts | owner |
| 15 | PR B: the three production `envelope_hash` values | frontend-dev |
| 16 | Deploy PR B | owner |
| 17 | Final verification | platform-dev |

Each agent task is one GitHub issue and one PR for one role, inside that role's paths in `.github/agents.json` (plus `shared`) and under `max_changed_lines` (5,000, test files excluded). Tasks 9, 10, 14 and 16 are owner issues. They carry Agent: `owner`, so spec-sync opens them with the `agent:owner` label. The dispatcher claims only the four dev roles, so it never starts a run for them, and the owner closes each one when it is done. "Depends on" lists only task numbers of this spec, and the agent loop starts an issue only when every issue it depends on is closed. Every agent task from 11 on depends on task 10, so nothing after the gate starts until the owner closes it.

## Before task 1: the spec PR

The owner merges this spec (requirements, design, tasks) and, in the same PR, answers the two open questions that change `requirements.md`:

- **Open question 10 (Date_Guard month form).** Design default: a month form counts only when the text before it is not a day number and a space. If the owner keeps the default, the owner updates Requirement 12.4's wording in the spec PR. Task 11.4 builds whichever rule is recorded.
- **Open question 11 (Prefetch all-or-nothing).** Design default: the Prefetch_Script writes nothing on any failure, and the Fetch_Job keeps spec 08 R21.2. Task 2 builds whichever rule is recorded.

No task below starts until that PR is merged. The other open questions keep the design's default unless the owner records otherwise at the Approval_Gate.

## Rules for every task

- **Branch and PR.** The dispatcher creates `agent/<role>/issue-N` and the PR "Closes #N". Do not push to `main` or merge. After a hook failure, make a new commit; do not amend.
- **Scope.** Change only files that match your role's paths in `.github/agents.json` (or `shared`) and are listed in your task's Scope, plus new `*.test.ts(x)` files next to the code they test. Check your diff with `git diff --name-only origin/main` before you finish and put the list in a commit message body.
- **Frozen paths (Requirement 15).** No task changes a file under `.kiro/`, `.github/`, `tools/agents/`, `tools/dispatcher/`, `tools/hooks/`, `src/lib/crypto/`, `src/lib/seal-format/`, `src/app/api/`, `src/lib/letter-store/`, `src/lib/db/` or `drizzle/`, the Helm chart, `scripts/check.sh`, `scripts/check-js-budget.mjs` values, `package.json`, `package-lock.json`, `.env.example` or `docs/kiro-writeup.md`. No task changes a line of `src/lib/figures/then-now.ts`, and `src/lib/figures/at-opening.ts` changes only in its comments (task 7). No task adds a route or a `format_version`. The only exception to `.kiro/` is the owner's own commits in tasks 9, 10 and 11.7. If a task finds it needs a change in a frozen path, it stops before making it and states the path, the change and the reason in a commit message body. The owner records it in `design.md` and decides (Requirement 15.9).
- **Content freeze until the gate (Requirement 4.6, 11.3).** Until task 10 is closed, no task changes `content/personas/letters/*.txt`, `sealed-answers.json`, `answers.json`, `samples.json`, an `intro_line`, an `author_questions` entry, a `letter_id`, an `envelope_hash`, `retired_letter_ids` or the Persona_Dates in `content/personas/personas.json`, or a copy-test record. No task runs `scripts/seal-personas.ts` (or `npm run seal-personas`) against any database before the gate. Running the Prefetch_Script and committing the refetched Figure_File are allowed (task 3).
- **Owner-only entries.** No agent writes or edits the Approval_Gate section of `design.md`, and no agent sets a copy-test reviewer result to pass or fail. Every copy-test record shows `Reviewer: Jacob Morgan` and `Result: pending` until Jacob Morgan records it (Requirements 4.9, 9.5).
- **Gate check (tasks 11 to 17).** The first step of every task after the gate reads the Approval_Gate section of `design.md` on `main`. It must hold the owner's name, the approval date and a commit id. Then run `git diff <approved commit> origin/main -- .kiro/specs/18-persona-dates/design.md`. If any Persona_Text, Persona_Figure row, Price_Line entry or Sample_Candidate changed since the approved commit, or the section is empty, stop and say so in a commit message body (Requirements 4.10, 4.11). If the owner answered "yes" to "Sealing waits for Jacob Morgan's copy-test pass", tasks 13.2 and 14 also need a recorded pass in each copy-test record (Requirement 6.11).
- **Never change a stored row.** No task updates, deletes or truncates a `demo_letters` or `openings` row, on any database. The Sealing_Script only inserts (Requirement 11.6).
- **Figures come from the file.** Every figure value, period and `retrieved_at` a task writes, in code, a test, a commit body or `design.md`, is read from the committed Figure_File through `thenAndNow` or `figureAtOpening`. Nothing is typed in from memory, a news report or an estimate, and nothing is interpolated, carried forward or converted (Requirements 2.4, 4.8).
- **Persona dates come from the list.** A test that describes a real Persona reads its dates from `src/lib/personas` and formats them with the formatter in `src/components/ui/letter-date.ts` that the UI uses (Requirement 12.1).
- **Copy.** Every string is exactly the string in `requirements.md` or `design.md` ("Data Models", the proposed wording) and follows `tone.md` and `neutrality.md`. Each copy task states in a commit message body the result of `node tools/hooks/tone-check.mjs <file>` for every copy file it changed.
- **Reports.** Anything a requirement asks for "in the PR" or "in the PR description" goes in a commit message body on the task's branch, kept short (bodies are cut at 12,000 characters). No task edits the PR description or attaches files.
- **Tests.** Vitest, `renderToStaticMarkup`, every `fetch` stubbed, no network, `DATABASE_URL` unset, no browser (the Live_Walk and layout check excepted). Property tests use fast-check with `numRuns` of at least 100 and the tag `// Feature: 18-persona-dates, Property N: <title>` with the title from `design.md`. Each property has one test, in its own file. A task that changes behaviour or a string updates or retires each test it outdates in the same commit and names each with its reason (Requirement 16.8).
- **Evidence.** A commit message body states the final commit SHA, the exit status of `bash scripts/check.sh` and PASS or FAIL, and every earlier-spec test changed or retired, each with its reason ("none" if empty). A task that touches a route's bundle also states every route budget from `node scripts/check-js-budget.mjs` after `npm run build` (Requirement 15.6).
- **Local stack.** When a task needs a database, it starts a Postgres container whose name contains "test", puts `DATABASE_URL` in front of each command, never exports, commits or logs it, and stops the app and removes the container afterwards, even if something failed.
- If `design.md` and the code on `main` disagree, re-read the code, keep the design's behaviour, and say what you changed and why in a commit message body under "Decisions". If the disagreement touches figures, persona content or the gate, stop instead.

## Tasks

- [x] 1. Banned-terms rule table and persona text checks
  - Agent: `frontend-dev` · Depends on: none · Estimated size: M, ~900 changed lines
  - Scope: `src/lib/personas/banned-terms.ts`, `letter-checks.ts`, `price-lines.ts` (`weekOfMonthWords`), `season-words.ts` (new), `schema.ts`, `answers.ts` (only to call `firstBannedTerm`), `src/lib/personas/persona-texts.test.ts` (new), and the `*.test.ts` next to each.
  - Design sections: "4. Banned terms", "5. Persona_Texts and their checks", "1. Persona_List" (the schema additions), Properties 6, 7, 8 and 10.
  - Owner decision: open question 7, the default: Requirement 8.1's list plus `christmas` (prefix) and `new year` (phrase); `holiday` stays in.
  - Steps:
    1. Add `TermRule`, `TERM_RULES`, `findBannedTerms`, `firstBannedTerm` and the deprecated alias `firstPoliticalTerm` as in the design's table. Keep every entry from `643aac5a`. Every caller (`checkLetterText`, `checkAnswerText`, the `intro_line` refine, a new `authorQuestionSchema` refine) uses `firstBannedTerm`. No caller keeps its own list.
    2. Prefix the schema's list error with `persona "<key>": <field>` for a bad `written_as_of` or `opens_at`.
    3. Add the no-exclamation-mark rule and the plain-text rule (no HTML tag, no Markdown heading, emphasis, list marker or link) to `checkLetterText`.
    4. Add `weekOfMonthWords(period)` and the season-word checks as pure functions with their own unit tests.
    5. Add `persona-texts.test.ts`. On today's Persona_Texts it runs only the rules today's texts already meet: the extended banned terms, the no-exclamation and plain-text rules, two questions, two sealed answers and two recollections in order. The season-word and period-word assertions on the real texts are added in task 11.2, because today's letters are written for May. Report format is the design's (file path, line or persona key, field and 1-based index). If a current text matches a new term, name it in a commit message body and leave that text's assertion to task 11.2; do not change content.
  - Acceptance:
    - [ ] 1.1 Rule table, matcher and callers
      - One positive sentence per added entry, with the matched term named. The negative words of 8.3 and the design's extra negatives match nothing. "veteran's day", "veterans' day" and a phrase across a line break match.
      - _Requirements: 1.4, 8.1, 8.2, 8.3, 8.5, 8.6, 8.7_
    - [ ] 1.2 Letter rules, season and period words, and `persona-texts.test.ts`
      - _Requirements: 5.2, 5.6, 5.10, 5.11, 6.1, 6.2, 6.3, 6.4, 6.7, 6.8, 8.4, 8.7_
    - [ ] 1.3 Write property test for the banned-term rules
      - **Property 6: Banned terms match by their rule**
      - **Validates: Requirements 8.2, 8.7**
    - [ ] 1.4 Write property test for clean text
      - **Property 7: Clean text matches no banned term**
      - Confirm `CLEAN_WORDS` in `letter-checks.property.test.ts` holds no word the extended list matches.
      - **Validates: Requirements 8.3, 8.8**
    - [ ] 1.5 Write property test for week-of-month words
      - **Property 8: Week-of-month words follow the day ranges**
      - **Validates: Requirements 5.6**
    - [ ] 1.6 Write property test for invalid persona dates
      - **Property 10: Invalid persona dates are rejected with the key and field**
      - **Validates: Requirements 1.4**
  - Earlier-spec tests changed or retired: `letter-checks.test.ts` (political-term message), `banned-terms*.test.ts`, `schema.test.ts` if it pins an error message; name each.
  - Validation: `bash scripts/check.sh`.

- [ ] 2. Fail-closed Prefetch_Script
  - Agent: `data-dev` · Depends on: none · Estimated size: M, ~700 changed lines
  - Scope: `src/lib/sources/prefetch.ts`, `scripts/prefetch-figures-main.ts`, and the `*.test.ts` next to each. No adapter changes, and `refresh.ts` merge rules stay (Requirement 15.2).
  - Design sections: "3. Prefetch_Script", Properties 1 to 5.
  - Owner decision: open question 11, as recorded in the spec PR (default: all-or-nothing for the Prefetch_Script only; the Fetch_Job is unchanged). Open question 3, the default: fail on any Weekly_Gap in a Persona_Series.
  - Steps:
    1. Add `findWeeklyGaps`, `findCoverageMisses` and `findProvenanceMismatches` as pure functions with the design's types.
    2. `PrefetchDeps` gains `coverage`. `runPrefetch` raises `weekly_gap`, `opening_coverage`, `provenance` and `series_failed` as `PrefetchError`s carrying every finding, after the merge and before serialising.
    3. The entry builds the coverage needs from the Persona_List (`opens_at` date part and the six days before it, per persona metric). No date is written into the prefetch code.
    4. The entry prints one finding line per finding in the design's format, then `prefetch failed: <kind>`, and exits 1 without writing either file. On success it writes both files through temp-and-rename and exits 0. No line prints a secret or a URL with a key.
  - Acceptance:
    - [ ] 2.1 Gap, coverage and provenance finders
      - _Requirements: 2.2, 2.3, 2.10_
    - [ ] 2.2 All-or-nothing entry and coverage from the Persona_List
      - One example per finding kind through `main(deps)` with in-memory files: exit 1 and both files byte-for-byte unchanged. One passing run writes both files and exits 0. A source-scan test finds no ISO date literal in `prefetch.ts` or the entry.
      - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 2.9, 2.10_
    - [ ] 2.3 Write property test for weekly gaps
      - **Property 1: Weekly gaps are found exactly**
      - **Validates: Requirements 2.2**
    - [ ] 2.4 Write property test for coverage
      - **Property 2: Coverage is met exactly when a period falls in the window**
      - **Validates: Requirements 2.1, 2.3**
    - [ ] 2.5 Write property test for the write rule
      - **Property 3: The Prefetch_Script writes nothing unless every check passes**
      - **Validates: Requirements 2.2, 2.3, 2.9, 2.10**
    - [ ] 2.6 Write property test for append-only merging
      - **Property 4: The refetch only appends**
      - **Validates: Requirements 2.4, 2.5, 2.6**
    - [ ] 2.7 Write property test for provenance mismatches
      - **Property 5: Provenance mismatches are found**
      - **Validates: Requirements 2.10**
  - Earlier-spec tests changed or retired: `prefetch*.test.ts` cases that expect a partial write and exit 1 on a failed series (spec 08 R21.2 for the Prefetch_Script); name each.
  - Validation: `bash scripts/check.sh`.

- [ ] 3. The refetch and the Persona_Figures report
  - Agent: `data-dev` · Depends on: 2 · Estimated size: S, ~300 changed lines plus the figure file
  - Scope: `src/lib/figures/real/fuel-figures.json`, `src/lib/figures/real/fetch-status.json`, `src/lib/figures/real/real-file.test.ts`, the `bundled-latest` tests, and the "now" assertions in tests that pin the last period `2026-10-26`. Not `then-now.test.ts`'s rule tests on fixture figures.
  - Design sections: "3. Prefetch_Script", "The eight Persona_Figures", "Sample_Candidates", "Error Handling".
  - Network: this task needs network access and `EIA_API_KEY` in the environment. If the Task Runner has neither, the task stops with a commit message body saying so. The owner then runs `node scripts/prefetch-figures.mjs` with the key, and the task resumes from the files the owner left in the working tree. Either way the key is never printed or committed.
  - Steps:
    1. Run `node scripts/prefetch-figures.mjs`. If it exits non-zero (`weekly-gap`, `opening-coverage`, `provenance`, `series-failed`), commit nothing, quote every finding line in a commit message body and stop. A missing week of 16 November 2026 means the source has not published it yet; re-run later. Nothing is estimated or carried forward.
    2. On exit 0, commit both files. Quote every revision line exactly as printed, or state "no revision reported" (Requirement 2.6).
    3. Tests that pin `2026-10-26` read the last period from the Figure_File. `LATE_COVERAGE_LIMIT` in `real-file.test.ts` becomes the latest `opens_at` date in the Persona_List. Add an assertion that each persona metric's `figureAtOpening` period falls in the seven days up to its `opens_at`. Name the reason for each changed test (Requirement 2.8).
    4. With a temporary script outside the repository (no file added), read the committed file through `thenAndNow(metricId, "2024-11-17", …).then` and `figureAtOpening(metricId, "2026-11-17T00:00:00.000Z", …)` and print the eight Persona_Figures rows in the column order of the design's table, "value as shown" at two decimals after the Display_Rescale. Put the eight rows in a commit message body, headed "Persona_Figures rows for design.md (copied from the committed file)".
    5. Compare the four then rows with the design's table. If any field differs, say so under "Then rows differ from design.md" with persona, metric, design value and file value (Requirement 4.7).
    6. Check each Sample_Candidate in the design against the shown at-opening value at two decimals. List any candidate that equals one under "Samples to replace before the gate". Do not edit `samples.json`.
    7. List any `period` or `retrieved_at` value in the file that contains a Date_Form of `2024-11-17` or `2026-11-17`, by series and period, for Requirement 12.8, or say "none".
  - Acceptance:
    - [ ] 3.1 Refetched file committed, last-period tests read the file
      - Every committed point keeps its `value` and `retrieved_at`. Every added point has full provenance and a `retrieved_at` inside the run. Each Persona_Series has a point between `2026-11-11` and `2026-11-17`.
      - _Requirements: 2.1, 2.4, 2.5, 2.6, 2.7, 2.8, 3.2_
    - [ ] 3.2 The figure report for the design
      - The rows come from the committed file through the two functions. No value is typed in.
      - _Requirements: 3.1, 3.2, 4.2, 4.7, 4.8, 7.3, 7.4, 12.8_
  - Earlier-spec tests changed or retired: `real-file.test.ts` (coverage limit), the `bundled-latest` tests, any "now" assertion pinned to `2026-10-26`; name each.
  - Validation: `bash scripts/check.sh`.

- [ ] 4. The sealed-for-demo line
  - Agent: `frontend-dev` · Depends on: 1 · Estimated size: S, ~200 changed lines
  - Scope: `src/components/reveal/copy.ts` (`sealedForThisDemo` only), `src/components/reveal/SealedLetter.tsx`, and the `*.test.tsx` next to them.
  - Design sections: "2. Screens read dates" (the sealed-for-demo line), Property 11.
  - Owner decision: open question 4, the default: "Sealed later, for this demo, on {sealedAt}.". If the owner records other wording at the gate, task 11 changes the string.
  - Steps:
    1. `REVEAL_COPY.sealedForThisDemo` becomes the proposed wording.
    2. `SealedLetterCaption` formats `sealedAt` with `formatLetterDate(…, { kind: "utc" })` first and renders no `<p>` when the result is `""`. Nothing takes its place.
  - Acceptance:
    - [ ] 4.1 New wording, and no line for a missing or bad `sealedAt`
      - _Requirements: 1.6, 10.3, 10.4, 10.5, 10.6_
    - [ ] 4.2 Write property test for the line
      - **Property 11: The sealed-for-demo line shows only the sealing date**
      - **Validates: Requirements 10.4, 10.5, 10.6**
  - Earlier-spec tests changed or retired: `SealedLetter.test.tsx` (old wording); name any other.
  - Copy evidence: tone-check for `reveal/copy.ts`.
  - Validation: `bash scripts/check.sh`.

- [ ] 5. Retired ids are read from the list
  - Agent: `frontend-dev` · Depends on: 4 · Estimated size: S, ~250 changed lines (tests)
  - Scope: `src/components/retired-ids-scan.test.ts`, the six test files `git grep wom_GdH6gqP6AGgnyhIMgA` finds (including `src/lib/personas/intro-line.test.ts` and `src/components/reveal/OpeningFlow.live.test.tsx`).
  - Design sections: "10. Retired ids".
  - Steps:
    1. Part 1 of the scan reads every id from `RETIRED_LETTER_IDS`, lists tracked files with `git ls-files -z`, and fails on any id outside `content/personas/personas.json` and `.kiro/specs/`. It fails, rather than passes, if `git` is unavailable.
    2. Replace each retired id literal in the six test files and in the scan test itself with `RETIRED_LETTER_IDS[n]`.
  - Acceptance:
    - [ ] 5.1 The scan reads the list and no test writes a retired id
      - The scan passes today and fails when a retired id is planted in a tracked file under `src/`, with the file named. Record both runs in a commit message body.
      - _Requirements: 11.7_
  - Earlier-spec tests changed or retired: the six files and `retired-ids-scan.test.ts`; name each.
  - Validation: `bash scripts/check.sh`.

- [ ] 6. Tests that describe a Persona read the Persona_List
  - Agent: `frontend-dev` · Depends on: 5 · Estimated size: M, ~900 changed lines (mostly tests)
  - Scope: the rows marked **R**, **F→** and **C** under `src/components/` and `src/lib/personas/` in the design's per-file table (component 8), and `src/lib/personas/samples.test.ts`. Not `src/lib/figures/` (task 7) or the content files.
  - Design sections: "8. Date_Guard" (the per-file actions), "2. Screens read dates", "6. Sample answers", Property 9.
  - Steps:
    1. **R rows:** `RecallPager.labels.test.tsx`, `eu-persona-labels.test.tsx`, `remembered-phrase.stages.test.tsx`, `src/lib/personas/eu-entry.test.ts`, `index.test.ts` and `intro-line.test.ts` read `written_as_of` and `opens_at` from `PERSONAS` and format them with the UI's formatter. They hold no Persona_Dates literal in any Date_Form, so they pass with today's dates and with the new ones.
    2. `samples.test.ts` reads each Then_Figure through `thenAndNow` at the Persona_List's `written_as_of`, and fails with the metric id when one is missing. The literal list of shown then values stays as today until task 11.2 changes it.
    3. **F→ rows:** move the fixtures in `RecallPager.text.test.tsx`, `written-on.property.test.ts`, `sheet-date.property.test.ts` and `RecallStep.test.tsx` off `2026-11-17` as the design states, keeping each assertion's shape.
    4. **C rows:** update the comments in `src/components/ui/letter-date.ts`, `src/components/ceremony/recall/written-on.ts`, `src/components/live/desk/sheet-date.ts` and `src/components/reveal/copy.ts` as the design states. No comment holds an Old_Persona_Date or a Date_Form of `2024-11-17` or `2026-11-17`.
    5. Leave every **F** row as it is. Confirm none of them equals or contains a Date_Form of the new dates.
  - Acceptance:
    - [ ] 6.1 R rows and the samples test read the list
      - _Requirements: 7.5, 7.6, 12.1, 12.3_
    - [ ] 6.2 F→ fixtures and C comments
      - _Requirements: 12.2, 12.3, 13.8_
    - [ ] 6.3 Write property test for rendering from the list
      - **Property 9: Persona dates render from the list in every timezone**
      - Renders each persona string from a Persona_List with changed dates, at offsets from UTC−12:00 to UTC+14:00.
      - **Validates: Requirements 1.5, 1.7, 1.9, 10.1**
  - Earlier-spec tests changed or retired: every R and F→ file above; name each with its reason.
  - Validation: `bash scripts/check.sh`.

- [ ] 7. `at-opening` reads the list
  - Agent: `data-dev` · Depends on: 3 · Estimated size: S, ~150 changed lines
  - Scope: `src/lib/figures/at-opening.test.ts`, the comment lines of `src/lib/figures/at-opening.ts`.
  - Design sections: "8. Date_Guard" (per-file rows for `at-opening`).
  - Steps:
    1. `at-opening.test.ts` reads Maya's and Tomás's `opens_at` from the Persona_List and the expected figure through `thenAndNow` on the Figure_File.
    2. The comment in `at-opening.ts` names `opens_at`, an ISO instant at 00:00 UTC, with no Old_Persona_Date and no Date_Form of the new dates. No code line changes; `git diff` on the file shows comment lines only.
  - Acceptance:
    - [ ] 7.1 Test reads the list; comment updated
      - `figureAtOpening` and `thenAndNow` return the same figure as at the base commit for every input (`then-now.ts` unchanged).
      - _Requirements: 12.1, 12.3, 13.8, 15.3_
  - Earlier-spec tests changed or retired: `at-opening.test.ts`; name its reason.
  - Validation: `bash scripts/check.sh`.

- [x] 8. The Sealing_Script checks every Persona_Text before it seals
  - Agent: `crypto-dev` · Depends on: 1 · Estimated size: S, ~300 changed lines
  - Scope: `scripts/seal-personas.ts`, `scripts/seal-personas-core.ts`, and their tests.
  - Design sections: "9. Reseal", "Error Handling", Testing Strategy ("Seal payload").
  - Decisions: the design does not say where Requirement 6.8's "seal nothing in that run" is enforced. Today the script loads `PERSONAS` (so the schema checks run) but does not call `checkLetterText` or `checkAnswerText`. This task adds a pre-check, and records that under "Decisions".
  - Steps:
    1. Before any insert, run `checkLetterText` on every letter and `checkAnswerText` on every sealed answer and recollection. If any check reports a problem, print the problems, seal no Persona and exit non-zero. Existing rows are untouched.
    2. Keep `missing_then_figure`, `stored_letter_differs` and `real_letter_collision` as they are. The script only inserts. Its `format_version` per Persona stays as at the base commit (v1 fuel, v2 Priya).
    3. A test shows `buildPersonaPayload` seals the four then figures exactly as stored in the Figure_File, all provenance fields included, with `period` on or before `written_as_of`.
    4. Do not run the script against any database in this task.
  - Acceptance:
    - [ ] 8.1 Pre-check across all Persona_Texts
      - A test with one bad text shows exit non-zero and no insert for any Persona.
      - _Requirements: 1.4, 6.8, 11.6, 11.8_
    - [ ] 8.2 Payload test for the then figures
      - _Requirements: 3.1, 3.3, 3.6, 11.4, 15.4_
  - Earlier-spec tests changed or retired: none expected; name any.
  - Validation: `bash scripts/check.sh`.

- [ ] 9. Owner: fill the at-opening rows and re-present the design
  - Agent: `owner` · Depends on: 3, 7 · Estimated size: n/a (owner step, not dispatched)
  - The owner (or the owner's own Kiro session, committing as the owner) copies the eight rows from task 3's commit body into "The eight Persona_Figures" in `design.md`, replacing each "pending" cell. Each value is copied from task 3's report, which was read from the committed file. Nothing is typed from memory.
  - Fix the then rows if task 3 reported a difference, and replace any Sample_Candidate task 3 listed, with its spread class worked out against the shown then value as in the design. Any approval recorded before this no longer counts (Requirement 4.7).
  - Fill the Date_Guard's Figure_File exemptions from task 3's step 7, or state "none".
  - Close this issue when `design.md` on `main` holds no "pending" cell.
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 4.8, 7.4, 12.8_

- [ ] 10. Owner: Approval_Gate (blocking checkpoint)
  - Agent: `owner` · Depends on: 1, 2, 3, 4, 5, 6, 7, 8, 9 · Estimated size: n/a (owner step, not dispatched)
  - Ensure all tests pass on `main` (`bash scripts/check.sh`), and ask the user if questions arise.
  - Only the owner does this step. No agent writes or edits the Approval_Gate section or a copy-test reviewer result.
  - The owner reads `design.md` on `main`: the three letters, the intro lines, Priya's questions, sealed answers and recollections, the eight Persona_Figures, the price lines, the Sample_Candidates and the self-check. Then the owner fills the Approval_Gate section: name, date, the commit id of the approved `design.md`, whether sealing waits for Jacob Morgan's pass (Requirement 6.11), and any change to the proposed wording (sealed-for-demo line, steering lines, open questions 1 to 14).
  - The owner closes this issue. Tasks 11 to 17 start only after it is closed.
  - _Requirements: 4.6, 4.9, 4.10, 6.11, 11.3_

- [ ] 11. PR A: dates, ids, texts, samples, copy-test records and the Date_Guard
  - Agent: `frontend-dev` (steering commit by the owner, task 11.7) · Depends on: 10 · Estimated size: L, ~1,500 changed lines plus content
  - Scope: `content/personas/personas.json`, `content/personas/letters/us-maya.txt`, `eu-tomas.txt`, `us-priya.txt`, `sealed-answers.json`, `answers.json`, `samples.json`, `us-copy-test.md`, `eu-copy-test.md`, `us-priya-copy-test.md`, `src/lib/personas/samples.test.ts`, `persona-texts.test.ts`, `letter-prices.test.ts`, `price-lines.test.ts`, `src/test/persona-dates-guard.test.ts` (new), `src/test/persona-dates-guard.property.test.ts` (new), `src/components/reveal/copy.ts` (only if the owner changed the sealed-for-demo wording at the gate), and the tests the move outdates.
  - Design sections: "1. Persona_List", "5. Persona_Texts and their checks", "6. Sample answers", "7. Copy-test records", "8. Date_Guard", "Data Models", Properties 12 and 13.
  - Owner decision: open question 10, as recorded in the spec PR (default: the month form counts only when not preceded by a day number and a space). Open questions 2, 5, 6, 9, 13 and 14: as recorded at the gate, else the design's default.
  - Steps:
    1. Run the gate check from "Rules for every task". Copy each Persona_Text, Sample_Candidate and Persona_Dates value from the approved `design.md` into its file, character for character. The letters end with one newline, as today. If any committed text differs from the approved design, stop and list each difference by file and field (Requirement 4.11).
    2. In the Persona_List: set `written_as_of` to `2024-11-17` and `opens_at` to `2026-11-17T00:00:00.000Z` for all three; give each a new `letter_id` from `crypto.randomBytes(16).toString("base64url")`, distinct from each other and from every retired id; add the three Old_Letter_Ids to `retired_letter_ids`, keeping every existing entry. Keep each old `envelope_hash` (task 15 replaces it). Keep the slugs, `display_name`, `region`, `metrics` and `letter_path`.
    3. Change the shown then list in `samples.test.ts` to the four values the approved design quotes, and the price expectations in `letter-prices.test.ts` and `price-lines.test.ts` to the then figures read from the file. Turn on the season-word and period-word assertions on the real texts in `persona-texts.test.ts`.
    4. Rewrite the three copy-test records as the design's component 7 says, with the self-check tables from the approved design, `Reviewer: Jacob Morgan` and `Result: pending`. Keep each "Removal of the opening event (spec 10 X4, issue #300)" section unchanged under "History: spec 18 replaced the dates this section names.".
    5. Add the Date_Guard with the design's `SCAN_ROOTS`, `SKIP_DIRS`, `EXEMPT_FILES` (plus the Figure_File field exemptions task 9 recorded) and `dateFormsOf`. The test file holds no Persona_Dates literal. Record two runs in a commit message body: one that fails after "17 November 2024" is planted in `src/lib/personas/index.ts`, naming file, line and form, and one that passes after it is removed (Requirement 12.6).
    6. Do not run the Sealing_Script against any database in this task. Task 13 runs it locally and task 14 on production.
  - Acceptance:
    - [ ] 11.1 Persona_List dates, new ids and retired ids
      - The schema accepts the list. No current id is in `retired_letter_ids`.
      - _Requirements: 1.1, 1.2, 1.3, 11.1, 11.2_
    - [ ] 11.2 Letters, intro lines, Priya's texts and samples as approved
      - `checkLetterText`, `checkAnswerText`, the price, season and period checks and the extended banned terms pass on every Persona_Text. Each Price_Line equals its then figure from the file.
      - _Requirements: 4.11, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.13, 6.1, 6.2, 6.3, 6.4, 6.5, 6.7, 6.10, 7.1, 7.2, 7.3, 7.5, 7.7, 8.4, 16.8_
    - [ ] 11.3 Copy-test records
      - Each names `2024-11-17` and `2026-11-17T00:00:00.000Z` as plain dates, lists the texts under review, holds the agent self-check headed as not a pass, and shows the reviewer result as pending. The two "Opens: … (… election …)" lines are gone.
      - _Requirements: 5.12, 6.9, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.9, 9.10, 10.8_
    - [ ] 11.4 The Date_Guard
      - Passes on the branch. Reports every occurrence in one run as `<path>:<line>: "<form>"`. Fails naming the Persona_List if it yields no dates.
      - _Requirements: 12.4, 12.5, 12.6, 12.7, 12.8, 12.9_
    - [ ] 11.5 Write property test for the scan
      - **Property 12: The Date_Guard finds every current persona date and only those**
      - **Validates: Requirements 12.4, 12.5**
    - [ ] 11.6 Write property test for the Date_Forms
      - **Property 13: Date_Forms come from the UI formatters**
      - **Validates: Requirements 12.1, 12.4**
    - [ ] 11.7 Owner: steering edits on the PR A branch
      - The owner pushes one commit to this PR's branch with the approved wording for `.kiro/steering/product.md` (Demo 1, lines 57 and 113), `neutrality.md` ("Election dates" heading and first bullet) and `structure.md` (`lib/events/`), and labels the PR `owner` so the path policy accepts it. The PR records the owner's approval of the wording. No agent edits `.kiro/`.
      - After it, no file under `.kiro/steering/` holds "5 November 2024", "9 June 2024", "11 September 2022", "demo window" or "persona window".
      - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8_
  - Earlier-spec tests changed or retired: `samples.test.ts`, `letter-prices.test.ts`, `price-lines.test.ts`, `eu-letter.test.ts`, any test asserting an old id, hash, sample or price; name each with its reason.
  - Copy evidence: tone-check for the three letter files and, if changed, `reveal/copy.ts`.
  - Validation: `bash scripts/check.sh`.

- [ ] 12. README, video script and the journey check
  - Agent: `platform-dev` · Depends on: 11 · Estimated size: S, ~150 changed lines
  - Scope: `README.md`, `docs/video-script.md`, `tools/qa/journey-check.mjs` (only if step 3 finds a literal).
  - Design sections: "11. QA tools and docs".
  - Owner decision: open question 12, the default: a caption under the README hero image; no retake.
  - Steps:
    1. Add directly under `docs/readme-hero2x.png` in `README.md`: "This picture shows the earlier persona letters, written as of an earlier date." Confirm the README holds no Old_Persona_Date and no price from a pre-reseal letter.
    2. Check `docs/video-script.md` for every persona date, month, season, price and quoted letter line. Change each to match the resealed letters and the design's figures, and list each item and its new text in a commit message body, or say "none found".
    3. Confirm `tools/qa/journey-check.mjs` and `.github/workflows/journey-check.yml` hold no Old_Persona_Date or Old_Letter_Id, and that J10 reads ids and hashes from `personas.json` at run time. If the workflow holds one, stop and report it (`.github/` is owner-only).
  - Acceptance:
    - [ ] 12.1 Docs and journey check
      - The Date_Guard and the retired-id scan pass on the branch.
      - _Requirements: 13.2, 13.6, 13.7_
  - Validation: `bash scripts/check.sh`.

- [ ] 13. Live_Walk assertions, local reseal and the layout baseline
  - Agent: `platform-dev` · Depends on: 11, 12 · Estimated size: M, ~800 changed lines
  - Scope: `src/test/integration/live-walk.test.ts`, `live-walk-helpers.ts`, `tools/qa/layout-gate-baseline.json`, and the tests that cover them.
  - Design sections: "9. Reseal" (the local check), "11. QA tools and docs", Testing Strategy (integration and browser checks).
  - Steps:
    1. Extend the Live_Walk to walk `/demo/personas/us-maya`, `eu-tomas` and `us-priya` from Remember to the last step at 1440 × 900 and 390 × 844. It asserts each date against the `letter-date.ts` formatters applied to the Persona_List, the sealed-for-demo line against the served header's `sealedAt` and the approved wording, and fails a step that shows an Old_Persona_Date or a pre-reseal price string (`$3.64`, `$3.89`, `€1.79`, `€1.65`) in letter text or a Price_Line. On a fuel persona's Receipts step the report lists the then and at-opening value and period for each metric and each "historical record, retrieved" date, read from the page. A walk skipped without `WALK=1`, or one that does not reach its last step, does not count as a pass.
    2. Run the gate check, including Requirement 6.11. Start the local stack, run `npm run db:migrate`, `npm run build`, `npm run seal-personas` against the local test database only, then the app on port 3000. Confirm three persona rows exist, each page opens straight on the first question and shows the seal intact. Run `WALK=1 npm run live-walk` and compare the receipts report with the figure table in the approved `design.md`. Quote both in a commit message body.
    3. Regenerate `tools/qa/layout-gate-baseline.json` against that build. GO1 rows that held "Opens 5 November 2024" or "Opens 9 June 2024" hold "Opens 17 November 2026". List every row added, removed or changed. Flag as a finding, with its row id, any row added or removed, or changed for a reason other than date, price, letter or sample text. Confirm the pinned sample with `SAMPLE_SEED = 1` is one of the four new candidates and that no test or baseline names a literal sample value.
    4. Stop the app and remove the container, even if something failed.
  - Acceptance:
    - [ ] 13.1 Live_Walk assertions for the three personas
      - Each helper has a passing and a failing example that runs without a browser.
      - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.7_
    - [ ] 13.2 Local reseal and walk
      - _Requirements: 3.2, 3.4, 3.5, 3.7, 3.8, 10.1, 10.2, 10.7, 11.9, 11.10, 11.11, 15.5_
    - [ ] 13.3 Layout baseline regenerated
      - _Requirements: 13.4, 13.5_
  - Earlier-spec tests changed or retired: walk and layout tests whose rows or steps change; name each.
  - Validation: `bash scripts/check.sh`; `node scripts/check-js-budget.mjs` after `npm run build`.

- [ ] 14. Owner: deploy PR A and seal in the init container
  - Agent: `owner` · Depends on: 11, 12, 13 · Estimated size: n/a (owner step, not dispatched)
  - Before the rollout, check the Approval_Gate still counts and, if Requirement 6.11 applies, that Jacob Morgan has recorded a pass in each copy-test record.
  - Record `SELECT count(*) FROM demo_letters` on production.
  - Bump the image tag in the GitOps repo so Fleet rolls out the image built from PR A's merge. The init container runs migrations, then `seal-personas`, which inserts three new `demo_letters` rows. No row is updated or deleted.
  - If the init container fails for a Persona (`stored_letter_differs`, `real_letter_collision`, `missing_then_figure`, a text check), the pod does not start and Fleet keeps the old ReplicaSet. Copy the result line into this issue and stop. Task 15 records no hash for that Persona.
  - After the rollout, record the row count again (before plus exactly three) and `SELECT id, envelope_hash FROM demo_letters WHERE id IN (<the three Old_Letter_Ids>)`, showing the old rows with their original hashes. Post both in this issue.
  - J10 fails from here until task 16. That is expected.
  - _Requirements: 6.11, 11.4, 11.6, 11.8, 11.11_

- [ ] 15. PR B: record the three production hashes
  - Agent: `frontend-dev` · Depends on: 14 · Estimated size: S, 3 changed lines
  - Scope: the three `envelope_hash` values in `content/personas/personas.json`.
  - Design sections: "9. Reseal".
  - Steps:
    1. Run the gate check. For each Persona, `GET https://revenant.devclef.se/api/letters/<new letter_id>` and read `envelopeHash`. Quote each in a commit message body with the id.
    2. Write each hash into its entry. If task 14 reported a failure for a Persona, leave its entry unchanged and say so.
    3. Change nothing else.
  - Acceptance:
    - [ ] 15.1 Three hashes from production
      - _Requirements: 11.5, 11.8_
  - Validation: `bash scripts/check.sh`.

- [ ] 16. Owner: deploy PR B
  - Agent: `owner` · Depends on: 15 · Estimated size: n/a (owner step, not dispatched)
  - Bump the image tag in the GitOps repo to the image built from PR B's merge. The init container finds the three rows already stored and inserts nothing; confirm the row count is unchanged from task 14.
  - Run the journey check (or wait for the six-hourly run) and post the J2 and J10 result lines in this issue.
  - _Requirements: 11.5, 11.6, 13.1_

- [ ] 17. Final verification on merged `main`, report only
  - Agent: `platform-dev` · Depends on: 1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 15, 16 · Estimated size: S, one empty commit
  - Scope: none. The record is the body of one empty commit (`git commit --allow-empty`).
  - Steps:
    1. Run the gate check. On merged `main`, run `bash scripts/check.sh` and `node scripts/check-js-budget.mjs` after `npm run build`.
    2. Start the local stack as in task 13, seal locally, and run `WALK=1 npm run live-walk` on the same commit. Compare the receipts report with the figure table in `design.md`. Stop the app and remove the container afterwards.
    3. Run `node tools/qa/journey-check.mjs` against production and quote the J2 and J10 lines.
    4. Confirm, with `git diff --name-only <spec base commit> origin/main`, that no frozen path of Requirement 15 changed, the Helm chart `version` is unchanged, and `package.json`, `package-lock.json` and `.env.example` are unchanged.
    5. Quote task 14's row counts and old-row hashes from the owner's issue.
    6. The commit body states the full `main` SHA, that the full suite and the Live_Walk both passed on it, every result line and every budget. If any check fails, name it by criterion number with route, viewport, step, expected and found values, and leave the task open.
  - Acceptance:
    - [ ] 17.1 Suite, Live_Walk, journey check and frozen paths on one commit
      - _Requirements: 11.6, 13.1, 13.3, 15.1, 15.2, 15.3, 15.6, 15.7, 15.8, 16.6, 16.7, 16.9_

## Notes

- Property test sub-tasks are not marked optional. The fail-closed prefetch, the banned-term rules and the Date_Guard are the evidence the owner reads at the gate, so each property gets its test.
- `design.md` is under `.kiro/`, which no agent may change. Task 3 produces the eight Persona_Figures rows in a commit message body, read from the committed file, and the owner copies them into `design.md` in task 9. The owner's copy is the only edit to the figure table.
- PR A spans two owners: frontend-dev writes content, ids, tests and the Date_Guard, and the owner adds the steering commit to the same branch (Requirement 14.8). The PR carries the `owner` label for the policy check.
- The Date_Guard lands in PR A and not earlier. Before the move, the current dates are the old ones that many **F** fixtures keep.
- The season-word and period-word checks are written in task 1 but only applied to the real letters in task 11.2, because today's letters are written for May.
- Between task 14 and task 16, J10 fails and the closed envelope's wax is drawn from the old hash. Both are expected and recorded in task 14's issue.
- Task 8 adds a pre-check to the Sealing_Script that the design does not name. Without it, Requirement 6.8's "seal nothing in that run" holds only for schema failures.
- Requirements 2.6 and 13.4 ask for lists "in the PR description". Following earlier specs, they go in commit message bodies, which the PR shows.
- Tasks 3, 15 and 17 need network access. Tasks 13 and 17 need Docker for the local Postgres container.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "2.2"] },
    { "id": 2, "tasks": ["1.3", "1.4", "1.5", "1.6", "2.3", "2.4", "2.5", "2.6", "2.7"] },
    { "id": 3, "tasks": ["3.1", "4.1", "8.1"] },
    { "id": 4, "tasks": ["3.2", "4.2", "8.2"] },
    { "id": 5, "tasks": ["5.1", "7.1"] },
    { "id": 6, "tasks": ["6.1"] },
    { "id": 7, "tasks": ["6.2"] },
    { "id": 8, "tasks": ["6.3"] },
    { "id": 9, "tasks": ["9"] },
    { "id": 10, "tasks": ["10"] },
    { "id": 11, "tasks": ["11.1"] },
    { "id": 12, "tasks": ["11.2"] },
    { "id": 13, "tasks": ["11.3", "11.4"] },
    { "id": 14, "tasks": ["11.5", "11.6", "11.7"] },
    { "id": 15, "tasks": ["12.1", "13.1"] },
    { "id": 16, "tasks": ["13.2"] },
    { "id": 17, "tasks": ["13.3"] },
    { "id": 18, "tasks": ["14"] },
    { "id": 19, "tasks": ["15.1"] },
    { "id": 20, "tasks": ["16"] },
    { "id": 21, "tasks": ["17.1"] }
  ]
}
```
