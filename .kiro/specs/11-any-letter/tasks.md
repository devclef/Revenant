# Implementation Plan: 11 Any letter

## Overview

Spec 11 makes the figures outage survivable, makes the Journey_Check honest, and turns Revenant into a general "seal what you believe now, open it later" letter. Price figures stay as an optional receipt. Tasks follow the G3.1 order: task 1 is the steering Owner_Patch, task 2 is the W1 walk, the group X tasks follow, then groups L, P and H. Every task in a lower group has a lower number. The exceptions are named in the Notes.

| Group | Tasks | What | Roles |
|---|---|---|---|
| S, steering | 1 | `product.md`, `tone.md`, `neutrality.md`, `structure.md` patches (owner, S1) | owner |
| W, the walk | 2 | Walk `/demo/live` end to end on a real build, record the findings, change no product file (W1). Runs in parallel with group X. | platform-dev |
| X, production (P0) | 3 to 9 | X1 cause and fix (3, 4), X3 server fallback (5), X2 sealing without figures (6), X3 Reveal line (7), X5 `marks` controls (8), X4 quiet Journey_Check and page fixes (9) | data-dev, platform-dev, frontend-dev |
| L, the general letter (P1) | 10 to 14 | L1 no-figures rule, disclosure, five steps (10); L2 Occasions (11); L3 Write step fits (12); L4 rehearsal (13); L5 no-figures reveal (14) | frontend-dev |
| P, personas | 15 to 20 | P2 samples (15); P3 say each thing once (16); P4 letter first lines (17); P5 receipts precision (18); P1 Text_Persona content and reading path (19); P1 sealing script (20) | frontend-dev, crypto-dev |
| H, landing and presentation | 21 to 24 | H2 Brand_Copy (23); H1 sections and static Coven_Strip (21); H1 render on `/` (22); H3, H4 audit and patches (24) | frontend-dev, platform-dev, owner |
| L6, decision | 25 | Real-sealing go or no-go issue, 20 November (owner) | owner |

Each task is one GitHub issue and one PR for one role, except tasks 1, 24 and 25, which are owner commits or issues with no role PR. Each PR stays under `max_changed_lines` (5,000) as `.github/agents.json` counts it, and inside its role's paths plus `shared` (G1.1, G3.3). Group X and W1 merge by 14 November 2026 (G3.4). Every task is planned to merge by the 27 November 2026 freeze. The cut order is in the Notes.

Follow `design.md` in this folder for file names, constants, copy, values and algorithms, and `requirements.md` for the rules. Every rule of specs 02 to 10 and of `.kiro/steering/` still holds unless requirements.md "Rules this spec replaces" names it. Where the design proposes a value, the owner may change it in the task's issue body before the task is claimed; otherwise the design's value applies.

"Depends on" lists only spec 11 task numbers. Every group L, P and H task also lists any fix task that W1 creates (G3.7); the owner adds that line to the issue body when the fix task exists.

**Brand_Copy path (resolved).** The design left the Brand_Copy path open. On `main` it is `src/components/brand/copy.ts` (exports `BRAND_COPY` with `heroSentence` and `ritualSteps`; test `src/components/brand/copy.test.ts`), which frontend-dev owns under `src/components/**`. The landing sections' own strings are in `src/components/landing/copy.ts`. `live/stepper/live-steps.ts` reads `ritualSteps`. Task 23 edits these paths; there is no `src/lib/brand-copy*`.

**What the loop can and can't see.** The dispatcher never reads "Before this task", the Production_Checks, the Real_Device_Checks or the milestone gates, and the agent and QA see only the issue body, never its comments. So every gate is enforced by hand: with the `status:ready` label, a `Blocked by #N` line in an issue body, or text in the issue body. Task 1's issue gets the label `agent:owner`; `owner` is not in `ROLES` in `tools/dispatcher/revenant_dispatch.py`, so the dispatcher never claims it, and the tasks that depend on it wait until the owner closes it. Anything an agent must know (a reviewer's name, the X1 captures, a changed value, a recorded decision) goes into the issue body before the issue is claimed.

## Launch order

1. Pull `main` (the owner does this, not this spec's author), then commit this file.
2. Confirm the four proposals under "Steering conflicts to confirm" in requirements.md, or replace them (S1.7). The design for P1 depends on them.
3. Pause the `revenant-dispatch` cron, then push the spec. Spec-sync opens the issues.
4. Commit task 1's Owner_Patches, record the validation in task 1's issue, and close it. No role task is dispatched before the S1 Owner_Patch is on `main` (G3.2).
5. Write into the issue bodies, not comments: the copy-test reviewer's name for tasks 11, 16 and 19, and the X1 captures for task 3 (below).
6. Resume the cron.

## Owner steps

| Step | When | What |
|---|---|---|
| O1 | Launch step 4 | Task 1: commit the `product.md`, `tone.md`, `neutrality.md` and `structure.md` patches, then close task 1's issue. |
| O2 | Before task 3 is claimed | Take the X1 captures during a Figures_Outage and during a healthy morning (design "X1 investigation plan"): the Figures_Failure_Lines from the web pod log, the `latestFigures()` and `lastSuccessTimes()` output from `psql`, `select count(*), max(retrieved_at) from figures`, and the last 40 `figure_fetch_runs` rows. Paste them into task 3's issue body. |
| O3 | When task 5 merges | Commit the Journey_Check change for J1 (non-200, any `fallback: true`, any null figure, cache-busting query string) so the fallback never hides an outage. |
| O4 | When task 9 merges | Commit the Journey_Check Owner_Patch (J2, J3, J5, J6, J9, and J10 only on a recorded go). Run it against production and attach the full output of a passing run to task 9's issue (X4.5). |
| O5 | When tasks 7, 13 and 23 merge | Commit the Retired_Phrase patches: "Check your connection and reload the page" (7), "What's on your mind right now?" (13), "Seal the figures" and "fuel prices from the US or the EU" (23), each to `RETIRED_PHRASES` in `tools/hooks/tone-check.mjs` and to the `copy-tone-check` hook. |
| O6 | When tasks 12 and 17 merge | Commit the `layout-check.mjs` patches: the L3 thresholds and the focusable-under-hidden check (12), LT1 (17). |
| O7 | When task 20 merges | Run the Sealing_Script for the new letter ID against production and confirm the row exists before the image that carries the ID is deployed (P1.11). Record the script output in task 20's issue. |
| O8 | 20 November 2026 | Task 25: record the real-sealing go or no-go. With no entry the default is no-go. |
| O9 | When task 22 merges, before 4 December 2026, 2:00 PM PT | Task 24: commit the README and `docs/kiro-writeup.md` patches. |
| Deploy | After each merge to `main` | Roll out the merge's image as `deploy.md` describes, run the task's Production_Check and Real_Device_Check (one iPhone with Safari, one Android phone with Chrome) and record both in its issue (G2.6). A failure opens a fix task, and the next task in the same group gets `Blocked by #<fix issue>` in its body. |

## Milestone gates

| Date (end of day, UTC unless stated) | Gate | Effect |
|---|---|---|
| 14 November 2026 | W1 recorded (task 2) and group X merged (tasks 3 to 9), with the Production_Checks and Real_Device_Checks recorded as passed. | Task 10 depends on tasks 2, 6 and 9, so no group L task starts before then. A fix task from W1 is merged before the first group L task (W1.6). The owner merges no group L task while a group X task is open, unless the open issue records a blocker the owner accepts. |
| 20 November 2026 | Real sealing go or no-go (L6), recorded in the task 25 issue. | On a no-go, `/seal` stays 404 and no page, README line, video script, write-up or metadata mentions it. On a go, the owner sets `realSealing: true` and adds J10 to the Journey_Check. No task here changes. |
| 27 November 2026 | Feature freeze. Every task is planned to be merged. | A task worked but not merged by the end of the day is closed unmerged with the reason. Cut in the order given in the Notes. Task 24 then runs before submission and removes every claim that depends on cut work. |
| 4 December 2026, 2:00 PM PT | Submission. Task 24 patches committed. | |
| 29 January 2027, 23:59:59 PT | End of judging. The site keeps running. | |

## Rules for every task

- **Branch and PR.** The dispatcher creates `agent/<role>/issue-N` and the PR "Closes #N". Do not push to `main` or merge. After a hook failure, make a new commit; do not amend.
- **Scope (G1.1).** Change only files that match your role's paths in `.github/agents.json` (or `shared`) and are listed in your task's Scope, plus new `*.test.ts(x)` files next to the code they test. Check your diff before you finish.
- **Hard boundaries (G1.2, G1.5).** Frontend-dev tasks change nothing under `src/app/api/`, `src/lib/crypto/`, `src/lib/seal-format/`, `src/lib/letter-store/`, `src/lib/db/` or `drizzle/`. No task changes a crypto primitive, key step, header field or `format_version`, a line of `src/lib/seal-format/v1/payload.ts`, `src/app/api/letters/**`, `src/app/api/openings/**`, `src/lib/letter-store/**`, the Helm chart or an environment variable. A letter with no figures is a v1 payload with `metrics: []` and `figures: []`. The Occasion is never stored.
- **Owner_Patch rule (G1.3).** Never commit `tools/**`, `.kiro/**`, `docs/**`, `README.md`, `scripts/check.sh`, `scripts/check-js-budget.mjs` or `.github/**`. When a task needs one, attach the diff to the issue or PR description under "Owner_Patch <name>" and keep it out of the diff.
- **Privacy and size (G1.4).** CSP header byte-identical. No request to another origin. New code writes nothing to `localStorage`, `sessionStorage`, IndexedDB, cookies, the URL path, the query string or the fragment. No new `dependencies` entry, animation library, WebGL, font, sound or vibration cue. Every route stays inside `scripts/check-js-budget.mjs`; a task that would push a route over stops and reports it. No browser file imports `fuel-figures.json` or `bundledLatestFigure` (X3.9).
- **User_Content.** Text the author writes or edits (letter, questions, self-reported rows) is User_Content, carries `data-user-content=""` as spec 10 lists, and is never checked at runtime for its words (spec 10 S2.4). Occasion strings are Our_Copy until edited.
- **Copy (G1.6, G2.7).** Every string in its feature folder's copy module or the persona content files, exactly as design.md "Copy" gives it. Second person, at most 25 words per sentence, no exclamation mark, no pun, no Scoring_Words_Always; no Scoring_Words_Scene in the Scene_Copy_Modules. No answer is called right, close, near, wrong, off or accurate. Each copy task attaches the `node tools/hooks/tone-check.mjs` result for every copy file it changed and a search of the rendered Our_Copy of every page it changed showing no Retired_Phrase remains.
- **Neutrality.** Nothing scores, diffs, highlights, pairs, counts, summarises or explains a gap between testimony and letter, or links an answer to the letter. No AI, similarity measure or keyword match.
- **Accent (G1.7).** The Accent marks only the reader's own answer, the main buttons, the wax and the focus ring. A chosen Occasion button may use it as the reader's own choice, with its label in the text colour.
- **Motion.** Every motion has its Skip and Calm_Mode path, runs only under `prefers-reduced-motion: no-preference` and `[data-ceremony-motion="full"]`, and changes only `transform` and `opacity`.
- **Data integrity.** Every figure shown carries value, unit, region, period, source and `retrieved_at`, with its period next to it. Nothing invented, estimated, converted or filled. A fallback figure is a bundled figure copied field for field.
- **Tests (G2.1, G2.2).** Vitest, `renderToStaticMarkup`, every `fetch` stubbed, no network, `DATABASE_URL` unset. Property tests with fast-check, `numRuns` at least 100, tag `// Feature: 11-any-letter, Property N: <title>`, using the title in design.md "Correctness Properties". A property whose parts land in several tasks is written by the first and extended by the later ones (see Notes, "Property coverage"). The Walk (task 2) is the one run that uses a browser, by hand.
- **Evidence (G2.3, G2.5).** The PR description states the final commit SHA with the `bash scripts/check.sh` exit status and PASS or FAIL; every route budget from `node scripts/check-js-budget.mjs` after `npm run build`; every earlier-spec test changed or retired with the reason; every asset added with its size in bytes; every Owner_Patch attached. Write "none" for an empty list.
- **Screenshots (G2.4).** For a screen change, PNG shots of every Stage or page the task changes at the Evidence_Sizes 2560×1440, 1366×800, 1280×800, 390×844 and 360×640, named `<stage-or-page>-<width>x<height>.png`, and the same set with `prefers-reduced-motion: reduce`, named `<stage-or-page>-<width>x<height>-reduced.png`. Phone shots are First_Viewport captures, plus one full-page capture per page.
- **QA (G2.8).** QA runs the rows of design.md "QA browser steps" the task lists, found with `^\| 11 \|`, and the `npm run layout-check -- --require <ids>` lines the task's "QA check" names.
- **After the merge (G3.5).** `bash scripts/check.sh` passes on `main`, and `/`, `/demo`, `/demo/live`, `/l/[id]` and every persona page load without error.
- If `design.md` and the code on `main` disagree, re-read the code, keep the design's behaviour, and say what you changed. If something is unclear, ask the owner in the issue. Do not guess.

## Tasks

### Group S: steering

- [x] 1. S1 · Steering patches (Owner_Patch)
  - Agent: `owner` · Depends on: none · Estimated size: n/a (owner commit, no PR)
  - Before this task: the owner has confirmed the four proposals under "Steering conflicts to confirm" in requirements.md, or replaced them (S1.7).
  - Scope: `.kiro/steering/product.md`, `.kiro/steering/tone.md`, `.kiro/steering/neutrality.md`, `.kiro/steering/structure.md`. All owner-only (G1.3).
  - Design sections: "S1. Steering patches".
  - Acceptance:
    - `product.md` changes only the S1.2 items: tagline and "What's new", Core loop steps 1, 2, 3 and 7, "Testify step (MVP)", Demo 1 (the text-persona exception and the "fuel personas and the live demo make the judge testify" line, with the "judge's own memory" sentence limited to the fuel personas), the Demo 2 bullet, and the L6 item under "Open product questions".
    - `tone.md` adds the question-wording rule, the "Rehearsal" line and the text-persona Testify line (S1.3).
    - `neutrality.md` adds the Occasion rule and the persona-answers rule (S1.4).
    - `structure.md` lists `src/components/live/occasions.ts`, `src/components/reveal/short-names.ts`, `content/personas/letters/answers.json`, the remaining landing sections, the removal of `SampleReceipt` and the static `CovenStrip` (S1.5).
    - Every other rule is unchanged. The owner records the `neutrality.md` copy test of the new text in this issue (S1.6).
    - The owner closes this issue only after the commit is on `main`. Closing it releases tasks 2, 3, 6 and 8.
  - Tests: none written by a role.
  - Earlier-spec tests changed or retired: none.
  - Owner_Patches attached: the four steering patches, all committed by this task.
  - QA shots: none. QA steps: none (no PR).
  - Production_Check: none (no image change).
  - Validation: `bash scripts/check.sh` on the owner commit, with the SHA and exit status recorded in this issue; `node tools/hooks/tone-check.mjs`.
  - _Requirements: S1.1–S1.7, G3.2_

### Group W: the walk

- [x] 2. W1 · Walk the live path on a real build and record the findings
  - Agent: `platform-dev` · Depends on: 1 · Estimated size: ~300 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Runs in parallel with group X. It changes no product file, so it conflicts with none of tasks 3 to 9. It is due by 14 November 2026.
  - Scope: `src/test/integration/live-walk.test.ts` (new). No product file. The Walk_Findings go into this issue's body.
  - Design sections: "W1. The walk", "QA browser steps" (setup).
  - Acceptance:
    - The Walk runs on `npm run build` and `next start`, against a local PostgreSQL with migrations applied, `RP_ID=localhost`, `APP_ORIGIN=http://localhost:3000`, in headless Chromium with a virtual authenticator that reports PRF support (W1.1).
    - Steps, in order: write a letter with one question; choose one figure; press the seal; create and confirm the passkey; see the sealed view and the letter card; wait 30 seconds; unlock with the passkey; answer the text question and the figure question; break the seal by press-and-hold; read the letter; open the receipts; reach the close (W1.2).
    - Variants: figures available; `/api/figures` forced to fail (expected blocked at the figures step until task 6 merges, recorded as such); the backup-key path; a letter with one question and no figure (expected blocked until task 10, recorded as such) (W1.3).
    - The Walk_Findings are written into the issue body, not a comment: per step pass or fail, what was observed, the screenshot names at 1366×800 and 390×844, and for every defect the step, expected result, observed result and suspected file. They state which of the passkey seal, the Wait step, Testify with Author_Questions and the live Reveal passed (W1.4, W1.8).
    - `live-walk.test.ts` replays the Walk, runs by hand with `WALK=1`, and the PR says whether it can run in CI without a browser (W1.5).
    - The recorded date of the full Walk is the first run's date. When task 6 merges, the owner asks for a re-run of only the "figures forced to fail" variant, recorded in this issue body without repeating the other variants (W1.7).
    - IF the Walk finds a defect on the seal, wait, unlock, testify or reveal path, THEN the owner adds a fix task with a number lower than task 10, and every group L, P and H task lists it under "Depends on" (W1.6, G3.7).
  - Tests: the replay test only. It is skipped unless `WALK=1`.
  - Earlier-spec tests changed or retired: none.
  - Owner_Patches attached: none.
  - QA shots: the Walk's screenshots, named in the findings. QA steps: none. QA check: none.
  - Production_Check: none (a local rehearsal; it does not prove any phone's passkey provider supports PRF).
  - Real_Device_Check: none.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: W1.1–W1.8, G3.1, G3.4_

### Group X: production (P0), merged by 14 November 2026

- [x] 3. X1 · Figures failure: harness, evidence, the fix the data names, and invalid-row skipping
  - Agent: `data-dev` · Depends on: 1 · Estimated size: ~600 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). The owner has pasted the captures from Owner step O2 into this issue's body (X1.2). Without them the task still delivers the harness and stays open (X1.9).
  - Scope: `src/app/api/figures/respond.ts`, `src/app/api/figures/db-response.ts`, `src/app/api/figures/db-store.ts`, `src/app/api/figures/fixtures.test-data.ts` (new, tests only), `src/lib/figures/**` (only if the reader is the place), `scripts/fetch-figures*` (only if the data shows the writer wrote the bad row), and the `*.test.ts` for each file above. A migration in `drizzle/` only if the data names a query or index; the task states the migration name and the owner confirms the role before it is claimed (design "Fixes the data can name").
  - Design sections: "X1 investigation plan (evidence first)", "Candidates", "Morning-pass, evening-fail explanation", "Reproduction harness", "Fixes the data can name", "Error Handling".
  - Acceptance:
    - `fixtures.test-data.ts` holds the shapes the code can fail on: a row with an invalid `retrieved_at`, a row with a null `retrieved_at`, a bad row for a series outside the Catalogue, a store rejecting with `{ name: "PostgresError", code: "57014" }`, and one rejecting with `{ name: "Error", code: "CONNECTION_CLOSED" }` (X1.4, X1.9).
    - A test built from the owner's rows (identifying values kept, nothing invented) fails before the fix and passes after, and asserts the status, the body, the `Cache-Control` header and the one log line (X1.4).
    - The PR explains the morning-pass, evening-fail pattern (J1 passed at 07:14 UTC on 9 November and 07:46 UTC on 10 November, failed at 22:43 and 20:02; the Fetch_Job runs at 06:17 UTC) by naming the row, run or event present only in the failing capture, quoted from the owner's data. An unexplained fix does not close the task (X1.3).
    - The cause is fixed where the data shows it is wrong, and the PR says why that place (X1.5).
    - `shapeDbFiguresResponse` validates each stored row first, skips a row that fails, logs `figures_row_skipped metric_id=<id>` once per metric with no value, and lets `chooseFigure` pick stored, else bundled, else null for that series (X1.7).
    - The log line keeps the spec 10 O1.3 content rules: step, error name and Postgres code only, never message, stack, cause or connection string (X1.8).
    - Closing condition, recorded by the owner: J1 passed on every production run in the 24 hours after the deploy, including one after 18:00 UTC (X1.10).
  - Tests: Property 3 (invalid stored rows are skipped, not fatal). Example tests: each fixture shape asserts status, body, `Cache-Control` and exactly one log line; the log line never contains a fake `postgres://user:secret@host/db` string.
  - Earlier-spec tests changed or retired: `api/figures/respond.test.ts`, `db-response.test.ts`, `db-store.test.ts` where a failing row now skips instead of throwing; name each.
  - Owner_Patches attached: none.
  - QA shots: none (no screen change). QA steps: none. QA check: none.
  - Production_Check: `curl -s https://revenant.devclef.se/api/figures` at two times at least 8 hours apart, one after 18:00 UTC. Pass: no series with `fallback: true` and no null figure (X1.11).
  - Real_Device_Check: none.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: X1.1–X1.5, X1.7–X1.11_

- [x] 4. X1 · Connection retry and client timeouts, only if the Figures_Failure_Lines name a connection-class error
  - Agent: `platform-dev` · Depends on: 3 · Estimated size: ~150 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Task 3 is merged and its PR names the error class from the owner's captures. IF task 3 found no connection-class error (`CONNECTION_CLOSED`, `CONNECTION_ENDED`, `CONNECT_TIMEOUT`, `ECONNRESET`), THEN the owner closes this issue unmerged with that reason and changes nothing (X1.6).
  - Scope: `src/lib/db/client.ts`, its `*.test.ts`. The matching retry (`readWithRetry`, `src/app/api/figures/retry.ts`) is data-dev code; if this task runs, the owner opens a one-file data-dev follow-up in the same issue body, since frontend and platform roles must not edit `src/app/api/figures/**` (G1.8).
  - Design sections: "Fixes the data can name", "Constants" (`CONNECT_TIMEOUT_S`, `IDLE_TIMEOUT_S`, `MAX_LIFETIME_S`, `CONNECTION_ERROR_NAMES`).
  - Acceptance:
    - `getSql()` creates the cached client with finite `connect_timeout` (5 s), `idle_timeout` (30 s) and `max_lifetime` (1,800 s), or the values the owner sets in the issue body (X1.6).
    - The readiness probe client (`max: 1`, `connect_timeout: 2`, `idle_timeout: 2`) and `/api/health/ready` are unchanged (X4.7).
  - Tests: an options test that the client is created with the three finite values; the probe options are unchanged.
  - Earlier-spec tests changed or retired: `lib/db/client.test.ts` where options change; name each.
  - Owner_Patches attached: none.
  - QA shots: none. QA steps: none. QA check: none.
  - Production_Check: `/api/health/ready` still answers 200, and `/api/letters/<id>` answers as before after the rollout.
  - Real_Device_Check: none.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: X1.6, X4.7_

- [x] 5. X3 · The server falls back on a failed read or shape step
  - Agent: `data-dev` · Depends on: 3 · Estimated size: ~500 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Task 3 is merged (this task builds on its row validation in the same files).
  - Scope: `src/app/api/figures/respond.ts`, `src/app/api/figures/db-response.ts`, `src/lib/figures/**` (only `bundledLatestFigure` and `chooseFigure` if they need a type), and the `*.test.ts` for each file above. This is a complete, mergeable PR on its own (X3.13).
  - Design sections: "Figures request: before and after", "X3. Server fallback and the Reveal line" (data-dev part), "Data Models" (Figures_API entry), "Error Handling".
  - Acceptance:
    - `fallbackResponse(generatedAt)` returns `shapeDbFiguresResponse({ rows: [], successTimes: new Map() }, CATALOGUE, generatedAt)`; `hasAnyBundled(body)` is true when any series has a figure (X3.1, X3.2).
    - In the `catch`, after the Figures_Failure_Line, `respondFigures` answers 200 with the Fallback_Response and `Cache-Control: no-store`. It answers 500 `{"error":"figures_unavailable"}` with `no-store` when no series has a bundled figure or the fallback itself throws (X3.1, X3.3, X3.4).
    - A throwing `readStore()` (for example a missing `DATABASE_URL`) falls back the same way. File mode is unchanged.
    - Every fallback figure is copied field for field from `fuel-figures.json`; no Fixture_Figure, no invented value; every `last_success_at` is `null` (X3.2, X3.4).
    - The `respond.ts` header comment and the spec 08 design rule it quotes are rewritten to the new rule (X3.10).
    - No file is added to the browser bundle; an import scan shows no browser file imports `fuel-figures.json` or `bundledLatestFigure` (X3.9).
    - Owner step O3 applies: the Journey_Check J1 fails on any `fallback: true` or null figure (X3.11).
  - Tests: Property 1 (the Fallback_Response copies bundled figures and invents nothing), Property 2 (a failing read or shape step still answers, and logs only the line). Example tests: the 500 case when no bundled figure exists; `Cache-Control: no-store` on every fallback; the browser import scan; `parseFiguresResponse` accepts the Fallback_Response.
  - Earlier-spec tests changed or retired: `respond.test.ts` (the 500-on-failure cases become 200 fallbacks); name each with the reason.
  - Owner_Patches attached: J1 change (O3), for the owner to commit.
  - QA shots: none (no screen change). QA steps: none. QA check: none.
  - Production_Check: with the database read failing in a staging run, or by test, the route answers 200 with every series `fallback: true`. In production `curl -s https://revenant.devclef.se/api/figures` shows no `fallback: true` while the database is healthy.
  - Real_Device_Check: none.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: X3.1–X3.4, X3.9–X3.11, X3.13_

- [x] 6. X2 · Sealing, waiting, testifying and reading never wait on `/api/figures`
  - Agent: `frontend-dev` · Depends on: 1 · Estimated size: ~900 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`).
  - Scope: `src/components/live/figures-state.ts` (new), `src/components/live/ReceiptsDisclosure.tsx` (new), `src/components/live/WriteForm.tsx`, `src/components/live/FigurePicker.tsx`, `src/components/live/seal-runner.ts`, `src/components/live/copy.ts`, `src/components/live/live.module.css`, `src/components/live/stepper/**` (only what the figures state needs), the client parts of the `/seal` page under `src/components/seal/**`, `src/app/demo/live/page.tsx` and `src/app/seal/page.tsx` (page wrappers only), and the `*.test.ts(x)` for each file above. `SealPage.tsx` and its sibling are in this scope under whichever of those paths holds them on `main`; the PR names the path.
  - Design sections: "X2. A live path that never waits on figures", "Live_Stepper after this spec", "Copy" (`receiptsLoading`, `receiptsUnavailable`), "Error Handling".
  - Acceptance:
    - `figuresStateFrom` maps a rejected `fetch`, a non-200, a body `parseFiguresResponse` rejects and an abort to `failed`; `FIGURES_TIMEOUT_MS` is 30,000 and the live hook aborts with an `AbortController` (X2.1).
    - The seal flow is built when the crypto module has loaded; `figuresReady` leaves the condition in `SealPage`. `formReady` no longer reads `figuresStatus`; Next and the passkey press are never disabled by the figures state (X2.1, X2.9).
    - `ReceiptsDisclosure` shows `receiptsLoading` while loading and `receiptsUnavailable` and no picker when failed, with no "check your connection" and no reload instruction (X2.2, X2.3). Its closed `details` shell and its picker body arrive in task 10; this task adds the component and mounts it where the figure step sits today so `/demo/live` is unblocked at once. The existing six-step stepper stays until task 10.
    - A late success before the seal press only makes the picker appear and changes nothing the visitor typed or chose; a response after the press changes nothing (X2.5, X2.6).
    - With the request failed or loading the sealed letter carries 0 official figures and the seal requests are the ones for any 0-figure letter (X2.4).
    - `/seal` (`mode="real"`) behaves the same (X2.7).
    - Until task 10 lands, a letter still needs one figure or one non-empty question to seal: this task makes a failed figures state seal a letter that has at least one non-empty question, using the minimum rule as it stands for `real` mode, and the PR says exactly which rule it used. Task 10 replaces the rule.
  - Tests: Property 5 (sealing never depends on figures). Example tests: the Live_Stepper with a `fetch` that rejects, one that answers 500, one that answers a malformed body, and one that never answers before the abort, each reaching the "Press the seal" step and a stored seal in the seal-flow tests (X2.8); the copy strings exactly.
  - Earlier-spec tests changed or retired: `live/WriteForm.test.tsx`, `live/stepper` tests, `seal/SealPage` tests where `figuresReady` changes an asserted value; name each.
  - Owner_Patches attached: none.
  - Copy evidence (G2.7): the `node tools/hooks/tone-check.mjs` result for each changed copy file, and the Retired_Phrase search of the rendered `/demo/live` and `/seal`.
  - QA shots: the Write and Press-the-seal steps of `/demo/live` with figures loading, failed and ready, at the five Evidence_Sizes, with and without reduced motion; First_Viewport captures at both Phone_Sizes.
  - QA steps: 11-01, 11-02.
  - QA check: `npm run layout-check -- --require GT1,SI1` still PASS on `/demo/live`.
  - Production_Check: on `https://revenant.devclef.se/demo/live`, write a letter with one question and press Next twice. Pass: the page reaches "Press the seal" whether or not figures load; with figures unavailable the disclosure reads "Receipts can't be added right now. Your letter doesn't need one." and no "check your connection" text shows.
  - Real_Device_Check: on both phones, the same flow, then seal with the phone's passkey. Pass: the seal succeeds.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: X2.1–X2.9_

- [x] 7. X3 · The Reveal shows one honest now line, and "Check your connection" retires
  - Agent: `frontend-dev` · Depends on: 5 · Estimated size: ~400 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Task 5 is merged and live, so the browser sees `fallback: true` entries from production.
  - Scope: `src/components/reveal/now-message.ts`, `src/components/reveal/figures-api.ts`, `src/components/reveal/FigureEntry.tsx`, `src/components/reveal/copy.ts`, `src/components/reveal/reveal.module.css` (only if the gap line needs a rule), `src/test/retired-phrases.test.ts` (the phrase row), and the `*.test.ts(x)` for each file above
  - Design sections: "X3. Server fallback and the Reveal line" (frontend-dev part), "Copy" (`nowRequestFailed`).
  - Acceptance:
    - `nowMessageFor` returns the Neutral_Gap_Line (`nowRequestFailed`, "No newer figure could be reached for this series.") when the request failed, `nowNotYet` or `nowRetired` when the series is null or missing, the Bundled_Note (`fallbackNote`) when `fallback` is true, and nothing for a plain figure (X3.5, X3.6).
    - A Now_Figure with `fallback: true` shows its own period and retrieved date with the Bundled_Note; the change is computed only when the existing comparability checks pass. The Then_Figure with its period always shows (X3.5, X3.8).
    - `REVEAL_COPY.nowUnavailableFetch` is removed, and "Check your connection and reload the page" joins `src/test/retired-phrases.test.ts` and passes (X3.7).
    - `Reveal` and `FigurePicker` need no other change for the fallback.
  - Tests: Property 4 (the Reveal shows the sealed figure and exactly one now outcome). Example tests: the copy strings exactly; the retired string appears nowhere in `src/`.
  - Earlier-spec tests changed or retired: `reveal/now-message.test.ts`, `figures-api.test.ts`, `FigureEntry.test.tsx`, `reveal/copy.test.ts`; name each with the reason.
  - Owner_Patches attached: the Retired_Phrase patch for "Check your connection and reload the page" (O5).
  - Copy evidence (G2.7): the `node tools/hooks/tone-check.mjs` result for each changed copy file, and the Retired_Phrase search of the rendered persona pages and `/demo/live`.
  - QA shots: `figures` of both persona pages with a fallback figure and with a failed request, at the five Evidence_Sizes, with and without reduced motion; First_Viewport captures at both Phone_Sizes.
  - QA steps: 11-03, 11-04.
  - QA check: `npm run layout-check -- --require GT1,CF1` still PASS. GT1 ignores any element inside `[data-ghost]` and still covers everything outside the Ghost.
  - Production_Check: open both persona pages to `figures`. Pass: each Then_Figure shows with its period, and each Now_Figure shows with its own period or one gap line; "Check your connection" appears nowhere.
  - Real_Device_Check: on both phones, walk one persona to `figures`. Pass: as above.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: X3.5–X3.8, X3.12, X3.13_

- [x] 8. X5 · The `marks` controls are visible, reachable and still
  - Agent: `frontend-dev` · Depends on: 1 · Estimated size: ~800 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`).
  - Scope: `src/components/ceremony/seal/SealBreak.tsx`, `src/components/ceremony/seal/SealBreak.module.css`, `src/components/ceremony/seal/HeldSeal.tsx`, `src/components/ceremony/seal/HeldSeal.module.css`, `src/components/ceremony/scene/SceneBackdrop.tsx`, `src/components/ceremony/scene/scene.module.css`, `src/components/ceremony/CeremonyRoot.tsx`, `src/components/ceremony/focusable-under-hidden.ts` (new), `src/components/ceremony/contrast.test.ts`, and the `*.test.ts(x)` for each file above
  - Design sections: "X5. The `marks` controls", "Production findings and their causes on `main`".
  - Acceptance:
    - `.hint` and `.textLink` use `var(--on-purple)`; at 900 px and wider they clear 4.5:1 against `--bg` and the lightest stop of the shaft (X5.1).
    - `contrast.test.ts` gains a pair for every text colour used in the Seal_Group on `--bg` and on the lightest shaft stop, read from the CSS tokens, and prints the ratios. The PR attaches measured ratios for the hint and Skip_Link at 2560×1440, 1366×800 and 1280×800 (X5.2, X5.7).
    - The Seal_Button, hint and Skip_Link render in `[data-seal-group]` in a sibling `.marksLayer` outside the `aria-hidden` Ghost layer, positioned in CSS from the same scene variables, so the 900 px and wider position equals spec 10 C6 (20 px outside the body edge, centred on the WaxSeal). The pressable `HeldSeal` stays `aria-hidden` and non-focusable (X5.3, X5.6).
    - `.bob` has no animation while `data-stage` is `marks` or `seal` (X5.5).
    - `focusableUnderHidden(html)` returns every focusable element with an `aria-hidden="true"` ancestor, using a small tag tokenizer with a stack and no new dependency; the ceremony test renders every Stage at a wide and a phone layout and fails on any result (X5.3, X5.4).
    - Owner step O6 applies for the matching `layout-check.mjs` check.
  - Tests: Property 12 (focusable elements are never under `aria-hidden`). Example tests: the contrast pairs; the `.marksLayer` is a sibling of the Ghost layer; `.bob` holds still in `marks` and `seal`.
  - Earlier-spec tests changed or retired: `seal/SealBreak.test.tsx`, `seal/seal-placement.test.ts`, `held-seal-render.test.tsx`, `scene/topbar-skip-marks.test.tsx`, `contrast.test.ts`; name each with the reason.
  - Owner_Patches attached: the `layout-check.mjs` focusable-under-hidden check (O6).
  - QA shots: `marks` and `seal` of both fuel personas and of a Live_Letter, at the five Evidence_Sizes, with and without reduced motion; First_Viewport captures of `marks` at both Phone_Sizes.
  - QA steps: 11-05.
  - QA check: `npm run layout-check -- --require ET1,SG1,AL1,CF1,GT1` PASS at every Evidence_Size, with and without reduced motion; the existing GZ1 and G1 to G3 checks still pass (X5.6).
  - Production_Check: on `https://revenant.devclef.se/demo/personas/us-maya` at 1366×800 and 2560×1440, reach "Break the seal". Pass: the hint and "Skip to the receipts" read clearly on the dark scene; Tab reaches the Seal_Button and the Skip_Link; the Ghost does not move.
  - Real_Device_Check: on both phones, reach `marks` on one persona. Pass: the button and the link are readable and pressable.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: X5.1–X5.7_

- [x] 9. X4 · A quiet Journey_Check: page fixes where the check is right, and the Owner_Patch
  - Agent: `frontend-dev` · Depends on: 5, 6, 7 · Estimated size: ~500 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Tasks 5, 6 and 7 are merged and live, so J1, J3 and J2 can be rewritten against the real behaviour.
  - Scope: the page files the first step below names, limited to `src/components/landing/landing.module.css` (the Landing_Ghost rule below 600 px) and `src/components/ceremony/scene/scene.module.css`, and the `*.test.ts(x)` for each file above. The `/demo/live` Write-step height failure of J6 PH1 is not fixed here: task 12 (L3) removes it and sets the new threshold.
  - Design sections: "X4. A quiet, working Journey_Check".
  - Acceptance:
    - The first step of the task lists every check that fails on a healthy production today (J5 on every persona and size, J6 PH1 on `/` at 360×640, J6 PH1 on `/demo/live` at both Phone_Sizes), reconciles the Landing_Ghost measurement (471 to 670 px in the check against 254 to 454 px measured by hand after 3 s; the design's lead is that the check reads the box before the entry transform settles), and decides per check whether to fix the page or the check, with the measurement (X4.3).
    - Where the page is wrong, the fix is made in the files above. Where the check is wrong, the correction goes in the Owner_Patch.
    - The Owner_Patch changes `tools/qa/journey-check.mjs`: J1 fails on non-200, a body that does not parse, any `fallback: true` or null figure, with a cache-busting query string; J2 starts at `recall` with no pick-up press, walks the Text_Persona to `close` without typing, and fails when any `[data-figure-entry]` has neither a Now_Figure, the Neutral_Gap_Line nor the Bundled_Note; J3 looks inside the Receipts_Disclosure; J5 waits for `recall`; J9 reaches "Press the seal" with 0 figures on `/demo/live` with no write request; J10 for `/seal` only on a recorded go (X4.1, X4.2, X4.4, X4.9).
    - J2 keeps running on the 00:47 UTC run and on manual runs only; J9 runs every time (X4.8).
    - `/api/health/ready` is unchanged and the PR description records the three reasons (one replica, letters no longer depend on figures, the Journey_Check is the figures monitor) (X4.7).
    - A run on a healthy production build passes J1 to J9, and the output is attached to this issue (X4.5). The Journey_Issue lists only failed checks and closes on a pass (X4.6).
  - Tests: CSS rule tests for any value this task changes.
  - Earlier-spec tests changed or retired: any landing or scene layout test whose asserted value changes; name each.
  - Owner_Patches attached: `tools/qa/journey-check.mjs` (J1 to J10 as above), for the owner to commit at step O4.
  - QA shots: `/` at both Phone_Sizes with and without reduced motion, if the Landing_Ghost rule changes.
  - QA steps: 11-06.
  - QA check: `npm run layout-check -- --require PH1` PASS on `/` at 390×844 and 360×640.
  - Production_Check: after the owner commits the patch, run the Journey_Check against production. Pass: J1 to J9 pass with no stale FAIL line.
  - Real_Device_Check: only if a page rule changed; then open `/` on both phones. Pass: the whole Landing_Ghost is on the first screen.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: X4.1–X4.9_

### Group L: the letter becomes general (P1)

- [x] 10. L1 · A letter seals with no figures: the single rule, the Receipts_Disclosure and five steps
  - Agent: `frontend-dev` · Depends on: 2, 6, 9 · Estimated size: ~1,200 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Tasks 2, 6 and 9 are merged. Any W1 fix task is merged (W1.6) and listed under "Depends on" in this issue's body. Group X is merged and its Production_Checks recorded as passed, or a blocker the owner accepts is recorded in the open issue.
  - Scope: `src/components/live/form.ts`, `src/components/live/WriteForm.tsx`, `src/components/live/ReceiptsDisclosure.tsx`, `src/components/live/FigurePicker.tsx`, `src/components/live/SelfReportedRows.tsx`, `src/components/live/write-draft.ts`, `src/components/live/build-payload.ts`, `src/components/live/seal-runner.ts`, `src/components/live/copy.ts`, `src/components/live/live.module.css`, `src/components/live/stepper/live-steps.ts` and the rest of `src/components/live/stepper/**`, the client parts of the `/seal` page under `src/components/seal/**`, `src/components/brand/copy.ts` (only the `ritualSteps` name lookups that `live-steps.ts` reads, if the key indexes change; the Ritual itself is task 23), and the `*.test.ts(x)` for each file above
  - Design sections: "L1. A letter with no figures", "Live_Stepper after this spec", "Data Models" (Sealed payload for a letter with no figures, Write draft), "Copy" (`receiptsSummary`, `receiptsExplain`, `nothingToTestify`).
  - Acceptance:
    - `minFiguresFor`, `MIN_FIGURES` and `figures_none` are removed. `hasSomethingToTestify({ questions, officialFigureCount })` is true when at least one question is non-empty after trimming or one official figure exists; self-reported rows never count; `validateWrite` reports `nothing_to_testify` exactly when it is false and everything else is valid. The rule is the same in `demo` and `real` mode (L1.1, L1.3).
    - Every Occasion, including "Blank", starts with the default question `DEFAULT_QUESTION`; this task seeds the Write draft with it (task 11 adds the Occasion control). A letter never starts blocked; the block appears only after the author removes every question and has no official figure, with the message shown after touch or a seal attempt (L1.2).
    - The figure picker and "Your own numbers" sit in one closed native `details` titled "Add a receipt", after the question rows, with the content in the document and `receiptsExplain` first (L1.4, L1.5).
    - The Live_Stepper has five steps, in order: Write, Press the seal, Wait, Testify, See the receipts. The Step_Indicator shows five items, Wait is 3 of 5, Back keeps the draft before the seal is stored and is not offered after (L1.6).
    - A letter with 0 official figures seals as a v1 payload with `format_version: 1`, `metrics` and `figures` empty or holding only self-reported entries, and the questions as v1 `"text"` questions. The seal requests and their order are unchanged and the first asynchronous call of the passkey press stays the WebAuthn call (L1.7, L1.8).
    - `/demo/live` works with figures available and unavailable (L1.9).
  - Tests: Property 6 (a letter needs a question or an official figure), Property 9 (letters with no official figures seal as v1), Property 10 (the Live_Stepper has five steps and one current step). Example tests: 0 official figures with 1 to 3 questions in both modes, and self-reported-only with a question, passing `payloadV1Schema`; the copy strings exactly; the disclosure is a closed `details` with its content in the markup.
  - Earlier-spec tests changed or retired: `live/form.test.ts`, `live/WriteForm.test.tsx`, `write-validation.property.test.ts`, `build-payload.property.test.ts`, `live/stepper` tests, `live/copy.test.ts`, `seal/SealPage` tests; name each with the reason.
  - Owner_Patches attached: none.
  - Copy evidence (G2.7): the `node tools/hooks/tone-check.mjs` result for each changed copy file, and the Retired_Phrase search of the rendered `/demo/live` and `/seal`.
  - QA shots: every step of `/demo/live` and the Write step of `/seal` (local, `REAL_SEALING=on`), at the five Evidence_Sizes, with and without reduced motion; First_Viewport captures at both Phone_Sizes.
  - QA steps: 11-07, 11-08, 11-09.
  - QA check: `npm run layout-check -- --require GT1,SI1` still PASS on `/demo/live`.
  - Production_Check: on `https://revenant.devclef.se/demo/live`, keep the default question, add no receipt, seal, wait, unlock, answer. Pass: sealing is allowed; five steps show; the Reveal goes from the letter to the close with no figures Stage.
  - Real_Device_Check: on both phones, the same flow with the phone's passkey. Pass: each step on one screen.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: L1.1–L1.9_

- [x] 11. L2 · Occasions
  - Agent: `frontend-dev` · Depends on: 10 · Estimated size: ~900 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Task 10 is merged. The owner has written the copy-test reviewer's name into this issue's body for the Occasion strings.
  - Scope: `src/components/live/occasions.ts` (new), `src/components/live/OccasionPicker.tsx` (new), `src/components/live/WriteForm.tsx`, `src/components/live/AuthorQuestions.tsx`, `src/components/live/write-draft.ts`, `src/components/live/copy.ts`, `src/components/live/live.module.css`, and the `*.test.ts(x)` for each file above
  - Design sections: "L2. Occasions", "Data Models" (Write draft), "Copy" (`occasionLabels`, `occasionLegend`; removed keys).
  - Acceptance:
    - `OCCASIONS` holds the Occasion_Table from L2.8 exactly: "The year ahead", "Work", "Family", "A decision", "Blank", each with its letter starter and its questions, the default question first in every row (L2.8).
    - The Occasion control is a row of buttons above the letter field with `aria-pressed`, targets of at least 44×44 CSS px below 600 px, keyboard reachable, wrapping rather than scrolling at 360×640 (L2.1, L2.9).
    - `applyOccasion` replaces the letter text only if it is empty after trim or equals the previously applied starter, and replaces only question rows that are empty or equal the previously applied Occasion question; typed text is kept; rows are compacted to at most 3; the result always has at least one question (L2.2, L2.10).
    - Each Occasion question is 1 to 200 code points, carries a Sealing_Day_Anchor, has no digit, party, policy or election term, and none of "right now", "today", "currently", "this year"; each starter is one or two sentences without a digit (L2.3, L2.4).
    - The Occasion choice is memory only: no request carries it, the payload has no key for it, nothing is written to storage, cookies or the URL (L2.5).
    - The Prompt_Starters and Question_Starters are removed; the `answerInLetter` line may stay as one line under the question rows (L2.7).
    - Occasion strings are Our_Copy until edited and are scanned by the copy checks; edited text is User_Content and not checked at runtime (L2.6).
    - The prediction question is an ordinary Author_Question; nothing scores, resolves or compares it (L2.11).
  - Tests: Property 7 (applying an Occasion never overwrites what was typed), Property 8 (Occasion text follows the copy rules and is never stored). Example tests: the copy strings exactly; the Occasion_Table through `firstPoliticalTerm`; the seal request bodies carry no Occasion identifier.
  - Earlier-spec tests changed or retired: `live/WriteForm.test.tsx`, `live/copy.test.ts`, `live/author-questions` tests where the starters retire; name each.
  - Owner_Patches attached: none.
  - Copy evidence (G2.7): the `node tools/hooks/tone-check.mjs` result for each changed copy file, the `neutrality.md` copy test of every Occasion string with the reviewer's name, and the Retired_Phrase search of the rendered `/demo/live` and `/seal`.
  - QA shots: the Write step of `/demo/live` with each Occasion chosen, at the five Evidence_Sizes, with and without reduced motion; First_Viewport captures at both Phone_Sizes.
  - QA steps: 11-10.
  - QA check: `npm run layout-check -- --require GT1,SI1` still PASS on `/demo/live`; NEUTRALITY reports no hit from User_Content.
  - Production_Check: on `https://revenant.devclef.se/demo/live`, choose each Occasion, type over the letter and one question, then choose another. Pass: typed text stays; every Occasion starts with the default question; at most three rows.
  - Real_Device_Check: on both phones, choose an Occasion and seal. Pass: the buttons are usable and the question is sealed as written.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: L2.1–L2.11_

- [x] 12. L3 · A Write step that fits one screen
  - Agent: `frontend-dev` · Depends on: 11 · Estimated size: ~600 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Task 11 is merged.
  - Scope: `src/components/live/WriteForm.tsx`, `src/components/live/AuthorQuestions.tsx`, `src/components/live/OccasionPicker.tsx`, `src/components/live/ReceiptsDisclosure.tsx`, `src/components/live/live.module.css`, `src/components/live/copy.ts` (hint line only), and the `*.test.ts(x)` for each file above
  - Design sections: "L3. A Write step that fits", "Constants" (`WRITE_PAGE_MAX_PX_PHONE`).
  - Acceptance:
    - Above Next the step holds only the Occasion control, the letter field with its count, up to three question rows with "Add a question", at most one hint line and the closed disclosure (L3.5). The Rehearsal_Line belongs to the heading block (task 13).
    - Next is fully inside the First_Viewport at 2560×1440, 1366×800, 1280×800 and 390×844 (L3.1, L3.2). The design's fallbacks, in order, apply if the measurement says it does not fit: 44 px question rows with an inline label, a two-column grid at 900 px and wider, a "Questions (3)" summary.
    - At 360×640 there is no horizontal scroll on the document or any card, and the page is at most 960 px tall (L3.3).
    - The letter field keeps its three-row start and half-viewport cap; validation messages show after touch or a seal attempt (L3.4, L3.6).
    - The PR attaches the measured top and bottom of the Next control and the page height at the five Evidence_Sizes (L3.8).
    - Owner step O6 applies: the PH1 threshold for the Write step is set to L3.1 to L3.3 and its message names L3 (L3.7).
  - Tests: Example tests of the CSS rules this task changes; the markup order above Next; the closed disclosure.
  - Earlier-spec tests changed or retired: `live/WriteForm.test.tsx`, layout tests whose asserted values change; name each.
  - Owner_Patches attached: the `layout-check.mjs` PH1 threshold for the Write step (O6).
  - QA shots: the Write step of `/demo/live` and `/seal` at the five Evidence_Sizes, with and without reduced motion; First_Viewport captures plus one full-page capture at both Phone_Sizes.
  - QA steps: 11-11.
  - QA check: `npm run layout-check -- --require PH1,GT1` PASS on `/demo/live` after the owner commits the patch.
  - Production_Check: open `https://revenant.devclef.se/demo/live` at 1366×800 and 390×844. Pass: Next is on the first screen; at 360×640 the page is at most 960 px with no sideways scroll.
  - Real_Device_Check: on both phones, open the Write step. Pass: Next is on or one short scroll below the first screen.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: L3.1–L3.8_

- [x] 13. L4 · A 30-second demo that says it is a rehearsal
  - Agent: `frontend-dev` · Depends on: 12 · Estimated size: ~300 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Task 12 is merged.
  - Scope: `src/components/live/LiveLetter.tsx`, `src/components/live/LiveLockNote.tsx`, `src/components/live/WriteForm.tsx`, `src/components/live/write-draft.ts`, `src/components/live/copy.ts`, `src/components/live/stepper/**` (the Wait step), `src/app/demo/live/page.tsx` (the `rehearsal` prop only), `src/test/retired-phrases.test.ts` (the phrase row), and the `*.test.ts(x)` for each file above
  - Design sections: "L4. The rehearsal", "Copy" (`rehearsalLine`, `lockNote`, `lockNoteComparison`; removed keys).
  - Acceptance:
    - `rehearsalLine` ("This is a rehearsal. A real letter stays sealed for months. This one opens in 30 seconds.") shows under the `/demo/live` Write heading and next to the Wait countdown, and nowhere else: not on `/seal`, not on `/l/[id]` for a Real_Letter, not on any persona page. Only `/demo/live` passes the `rehearsal` prop (L4.1, L4.3, L4.5).
    - `/demo/live` starts with "Blank" chosen, so its first row holds the default question. `livePrefill` and "What's on your mind right now?" are removed, and "What's on your mind right now?" joins the Retired_Phrases and passes (L4.2).
    - The live Close note reads `lockNote`. `lockNoteComparison` ("For a longer comparison, open a persona letter.") shows only when the letter holds official figures; the link to the persona letters shows for every live letter (L4.4).
    - Where the letter holds figures the Reveal shows them honestly; after 30 seconds the Now_Figure matches the Then_Figure and nothing is made up (L4.6).
  - Tests: Property 19 (the Rehearsal_Line appears only on the live demo). Example tests: the copy strings exactly; the Close note with and without official figures.
  - Earlier-spec tests changed or retired: `live/LiveLetter.test.tsx`, `LiveLockNote.test.tsx`, `live/copy.test.ts`, `live/stepper` tests; name each with the reason.
  - Owner_Patches attached: the Retired_Phrase patch for "What's on your mind right now?" (O5).
  - Copy evidence (G2.7): the `node tools/hooks/tone-check.mjs` result for each changed copy file, and the Retired_Phrase search of the rendered `/demo/live`, `/seal` and a persona page.
  - QA shots: the Write, Wait and Close steps of `/demo/live` at the five Evidence_Sizes, with and without reduced motion; First_Viewport captures at both Phone_Sizes.
  - QA steps: 11-12.
  - QA check: `npm run layout-check -- --require GT1,SI1` still PASS on `/demo/live`.
  - Production_Check: on `https://revenant.devclef.se/demo/live`, seal, wait, unlock. Pass: the rehearsal line shows on Write and Wait only; the Close note says the letter was locked for 30 seconds.
  - Real_Device_Check: on both phones, the same flow. Pass: as above.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: L4.1–L4.6_

- [x] 14. L5 · A reveal with no figures is a complete ending
  - Agent: `frontend-dev` · Depends on: 10 · Estimated size: ~500 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Task 10 is merged.
  - Scope: `src/components/reveal/Reveal.tsx`, `src/components/reveal/copy.ts`, `src/components/ceremony/stages.ts`, `src/components/ceremony/steps.ts`, `src/components/ceremony/copy.ts`, `src/components/ceremony/CeremonyRoot.tsx`, `src/components/ceremony/close/**`, and the `*.test.ts(x)` for each file above
  - Design sections: "Stages and steps for a letter with no figures", "Where the pages say 'numbers' or 'figures' for a letter that has none", "L5. A complete ending with no figures", "Copy" (`closeLineNoFigures`).
  - Acceptance:
    - With 0 official figures the Reveal goes from the letter to the Close for every letter kind (persona, Live_Letter, Real_Letter): no figures Stage, no "See the receipts" or "See the numbers", no empty heading or panel. `useFigures()` is not called, so no request is made. A letter whose only figures are self-reported keeps the figures Stage with "Your own numbers" only (L5.1).
    - The persona Close for a letter with no figures ends on `closeLineNoFigures` ("Her testimony and her letter are side by side. What they say is yours to read."), mentions no numbers or prices (L5.2).
    - The persona Step_Indicator for a text-only persona shows Testify, Break the seal and Read (L5.3).
    - The Skip_Link on `marks` reads `skipToLetter` (L5.4).
    - A Real_Letter with no figures ends with no demo links (L5.6).
    - A markup test per letter kind asserts none of: a "then and now" heading, a Receipt_Card, a Number_Line, "figures" as a heading (L5.5).
  - Tests: Property 11 (a reveal with no figures ends on the letter), written here and extended by task 19 for the Text_Persona. Example tests: a `Reveal` render with a 0-figure payload makes no figures request; the copy strings exactly.
  - Earlier-spec tests changed or retired: `reveal/Reveal` tests, `ceremony/stages.test.ts`, `steps.test.ts`, `close/Close.test.tsx`; name each with the reason.
  - Owner_Patches attached: none.
  - Copy evidence (G2.7): the `node tools/hooks/tone-check.mjs` result for each changed copy file, and the Retired_Phrase search of the rendered `letter` and `close` Stages.
  - QA shots: `letter` and `close` of a Live_Letter with no figures at the five Evidence_Sizes, with and without reduced motion; First_Viewport captures at both Phone_Sizes.
  - QA steps: 11-07 (regression; opening half).
  - QA check: `npm run layout-check -- --require GT1,CF1` PASS.
  - Production_Check: on `https://revenant.devclef.se/demo/live`, seal a letter with no receipt, unlock and answer. Pass: the letter, then the close; no figures Stage, no "See the receipts".
  - Real_Device_Check: on both phones, the same flow. Pass: as above.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: L5.1–L5.6_

### Group P: personas

- [x] 15. P2 · A prefilled sample answer never equals the record
  - Agent: `frontend-dev` · Depends on: 2 · Estimated size: ~300 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Any W1 fix task is merged and listed under "Depends on" in this issue's body.
  - Scope: `content/personas/letters/samples.json`, `src/lib/personas/samples.ts`, `src/lib/personas/spread.ts`, `src/lib/personas/record-candidate.ts`, and the `*.test.ts` for each file above
  - Design sections: "P2. Sample answers that are only samples".
  - Acceptance:
    - The first entry (the Record_Candidate) leaves every list. The design's proposed lists apply: Maya regular `3.59, 3.71, 2.99, 4.25`; Maya diesel `3.79, 3.95, 3.19, 4.59`; Tomás unleaded `1.75, 1.85, 1.49, 2.09`; Tomás diesel `1.62, 1.69, 1.35, 1.95` (P2.1).
    - Each list has 3 to 5 distinct candidates and meets the Spread_Rule without a Record_Candidate: one Near (within 5 % and unequal), one Below (at most 85 %), one Above (at least 115 %), computed with `BigInt` (P2.2).
    - No candidate equals the Then_Value at display precision after the Display_Rescale (P2.1, P2.3).
    - The Sample_Label, Sample_Note and the no-grading rule are unchanged; a typed value equal to the Then_Value is treated as any other answer; the sealed payloads are unchanged (P2.4–P2.6).
  - Tests: Property 16 (no sample answer equals the record). The spec 10 property "exactly one Record_Candidate" is inverted to "none".
  - Earlier-spec tests changed or retired: `personas/samples.test.ts` and the spec 10 Record_Candidate property (inverted); name each with the reason.
  - Owner_Patches attached: none.
  - QA shots: `recall` of both fuel personas at the five Evidence_Sizes, with and without reduced motion; First_Viewport captures at both Phone_Sizes.
  - QA steps: 11-13.
  - QA check: `npm run layout-check -- --require FP1,FC1` still PASS (4 activations per persona).
  - Production_Check: open Maya twice and Tomás twice. Pass: no prefilled value equals 3.64, 3.89, 1.79 or 1.65.
  - Real_Device_Check: on both phones, open both personas. Pass: as above.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: P2.1–P2.6_

- [x] 16. P3 · The Testify screen says each thing once
  - Agent: `frontend-dev` · Depends on: 2 · Estimated size: ~400 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Any W1 fix task is merged and listed under "Depends on".
  - Scope: `src/components/ceremony/intro/TestifyContext.tsx`, `src/components/ceremony/intro/PersonaIntro.tsx`, `src/components/ceremony/scene/TopBar.tsx`, `src/components/ceremony/intro/intro.module.css`, `src/components/ceremony/copy.ts`, and the `*.test.ts(x)` for each file above
  - Design sections: "P3. Say each thing once".
  - Acceptance:
    - During `recall` on a persona page the document holds exactly one fictional-persona note, one written-as-of line, one opens line and one seal-intact statement at every Evidence_Size, all kept by `TestifyContext`. `TopBar` and `PersonaIntro` take a `stage` prop and render the note and date lines only when `stage !== "recall"` (P3.1, P3.2).
    - In the Stages after `recall` the fictional-persona note shows in the `TopBar` at 600 px and wider and in the Compact_Top_Bar below that, so the reader always knows the letter is a demo (P3.3).
    - The first question's field stays inside the First_Viewport at every Evidence_Size and its primary control at every size but 360×640 (P3.4).
  - Tests: a markup test counts the four items per persona in `recall` and fails when any count is not 1 (P3.5). Example tests: the note appears in every other Stage.
  - Earlier-spec tests changed or retired: `intro/PersonaIntro.test.tsx`, `TestifyContext.test.tsx`, `scene/topbar` tests; name each with the reason.
  - Owner_Patches attached: none.
  - Copy evidence (G2.7): the `node tools/hooks/tone-check.mjs` result for each changed copy file, and the Retired_Phrase search of the rendered persona pages.
  - QA shots: `recall` of both fuel personas at the five Evidence_Sizes, with and without reduced motion; First_Viewport captures at both Phone_Sizes.
  - QA steps: 11-14.
  - QA check: `npm run layout-check -- --require FC1,GT1,SI1` PASS.
  - Production_Check: open both fuel personas. Pass: the fictional note, the written-as-of line, the opens line and the seal statement each appear once, and the first question's field is on the first screen.
  - Real_Device_Check: on both phones, open both personas. Pass: as above.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: P3.1–P3.5_

- [x] 17. P4 · The first lines of the letter are in view
  - Agent: `frontend-dev` · Depends on: 16 · Estimated size: ~400 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Task 16 is merged.
  - Scope: `src/components/reveal/Reveal.tsx`, `src/components/reveal/AuthorTestimony.tsx`, `src/components/reveal/AnswerList.tsx`, `src/components/reveal/reveal.module.css`, `src/components/ceremony/letter/LetterBlock.tsx`, `src/components/ceremony/letter/LetterBlock.module.css`, `src/components/ceremony/CeremonyRoot.tsx` (the `letter` entry positioning only), and the `*.test.ts(x)` for each file above
  - Design sections: "P4. The letter in view", "Constants" (`ANSWER_CLAMP_LINES_LETTER`).
  - Acceptance:
    - The Seal_Verdict and its fingerprint control sit on one line above the paper (P4.3).
    - The order stays testimony, then letter. Each displayed answer in the testimony block is clamped to two lines with a control that shows the full text; the full text is always in the document (P4.2).
    - The first three lines of the Letter_Text are fully inside the First_Viewport at the start of `letter` at every Evidence_Size for every persona (P4.1). At the Phone_Sizes the Stage positions the paper's top edge just below the Top_Bar without moving focus away from the heading (P4.4).
    - Owner step O6 applies: LT1 `letter-first-lines` (P4.5).
  - Tests: Example tests: the clamp rule and the control; the full answer text is in the markup; the focus target is unchanged.
  - Earlier-spec tests changed or retired: `reveal/AuthorTestimony.test.tsx`, `AnswerList.test.tsx`, `letter/LetterBlock.test.tsx`, `CeremonyRoot.test.tsx`; name each with the reason.
  - Owner_Patches attached: LT1 `letter-first-lines` in `tools/qa/layout-check.mjs` (O6).
  - QA shots: `letter` of both fuel personas and of a Live_Letter with two answers, at the five Evidence_Sizes, with and without reduced motion; First_Viewport captures at both Phone_Sizes.
  - QA steps: 11-15.
  - QA check: `npm run layout-check -- --require LT1,GT1,CF1` PASS after the owner commits the patch.
  - Production_Check: break the seal on each persona at 1366×800 and 390×844. Pass: the first three lines of the letter are on the first screen.
  - Real_Device_Check: on both phones, break the seal on one persona. Pass: as above.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: P4.1–P4.5_

- [x] 18. P5 · Receipts at one precision, with a short name
  - Agent: `frontend-dev` · Depends on: 2 · Estimated size: ~500 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Any W1 fix task is merged and listed under "Depends on".
  - Scope: `src/components/reveal/ReceiptCard.tsx`, `src/components/reveal/FiguresThenNow.tsx`, `src/components/reveal/short-names.ts` (new), `src/components/reveal/display-precision.ts` (new), `src/components/reveal/copy.ts`, `src/components/reveal/reveal.module.css`, and the `*.test.ts(x)` for each file above
  - Design sections: "P5. Receipts at one precision", "Constants" (`DISPLAY_PRECISION_FUEL`), "Copy" (`asPublished`, `roundedNote`).
  - Acceptance:
    - `displayPrecisionForUnit(unit)` returns 2 for `USD per gallon` and for `EUR per 1,000 litres` shown per litre after the Display_Rescale, and `undefined` for other units, which keep their published precision (P5.1).
    - `ReceiptCard` shows Then and Now with `formatValue` at that precision on the rescaled value, so 3.643 reads 3.64. The source details add "As published: {value} {unit}" with the exact sealed value. The change is computed from the As_Published_Values and its formula shows them. One line, `roundedNote`, says the values are rounded for display (P5.1–P5.3).
    - The heading is the Short_Name from `short-names.ts`, a literal lookup keyed by `metric_id` (proposed `us-gasoline-regular` "Regular gasoline", `us-diesel` "Diesel", `eu-petrol-euro95` "Unleaded petrol", `eu-diesel` "Diesel"; the task verifies each key against the real Catalogue IDs in the PR and uses the real ones), with the sealed `display_name` as fallback; the lookup never reads the Catalogue at runtime. The Series_Name shows under Source with the series ID and the link. Each Short_Name is at most 40 characters with no direction word (P5.4, P5.5).
    - The rules hold on persona, live and real letters (P5.6).
  - Tests: Property 17 (receipt values use display precision and the source keeps the published value), Property 18 (the Short_Name falls back to the sealed name). Example test: a payload whose `metric_id` is not in the lookup renders with the sealed `display_name` (P5.7).
  - Earlier-spec tests changed or retired: `reveal/ReceiptCard.property.test.tsx`, `FiguresThenNow.test.tsx`, `reveal/copy.test.ts`; name each with the reason.
  - Owner_Patches attached: none.
  - Copy evidence (G2.7): the `node tools/hooks/tone-check.mjs` result for each changed copy file, and the Retired_Phrase search of the rendered `figures` Stage.
  - QA shots: `figures` and `close` of both fuel personas at the five Evidence_Sizes, with and without reduced motion; First_Viewport captures at both Phone_Sizes.
  - QA steps: 11-16.
  - QA check: `npm run layout-check -- --require GT1,CF1` still PASS.
  - Production_Check: walk Maya to `close`. Pass: values at two decimals; "As published: 3.643 USD per gallon" in the source details; a short heading with the official series name under Source.
  - Real_Device_Check: on both phones, walk one persona to `figures`. Pass: as above.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: P5.1–P5.7_

- [x] 19. P1 · The Text_Persona: schema, content, the reading path and the Demo_Index
  - Agent: `frontend-dev` · Depends on: 14, 16 · Estimated size: ~1,800 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Tasks 14 and 16 are merged. The owner has confirmed the persona key, name, region and window in this issue's body (design proposes `us-priya`), and has written the copy-test reviewer's name in. Any W1 fix task is merged and listed under "Depends on".
  - Scope: `content/personas/personas.json`, `content/personas/letters/<key>.txt`, `content/personas/letters/<key>-copy-test.md`, `content/personas/letters/answers.json` (new), `src/lib/personas/schema.ts`, `src/lib/personas/answers.ts` (new), `src/lib/personas/letter-checks.ts`, `src/lib/personas/index.ts`, `src/components/reveal/opening-machine.ts`, `src/components/reveal/useOpeningFlow.ts`, `src/components/reveal/OpeningFlow.tsx`, `src/components/reveal/Reveal.tsx`, `src/components/reveal/AnswerList.tsx`, `src/components/reveal/AuthorTestimony.tsx`, `src/components/reveal/copy.ts`, `src/components/ceremony/recall/RecallReader.tsx` (new), `src/components/ceremony/recall/RecallReader.module.css` (new), `src/components/ceremony/steps.ts`, `src/components/ceremony/copy.ts`, `src/components/demo/PersonaCard.tsx`, `src/components/demo/copy.ts`, `src/app/demo/page.tsx`, `src/app/demo/page.module.css`, `src/app/demo/personas/[key]/page.tsx`, and the `*.test.ts(x)` for each file above, including tests that name the Persona_List count
  - Design sections: "Text_Persona flow", "P1. The Text_Persona", "Data Models" (Persona_List additions, Flow state additions), "Constants" (`PERSONA_ANSWER_MAX_CODE_POINTS`, `PERSONA_QUESTIONS_MAX`), "Copy" (`personaAnswerLabel`, `personaTestimonyTitle`).
  - Acceptance:
    - `personas.json` gains the Text_Persona: `metrics: []`, 1 to 3 `author_questions`, a new 22-character `letter_id` not in `retired_letter_ids`, a `written_as_of` inside one of the three fixed windows, a plain `opens_at` with no event name. The schema drops `min(1)` on `metrics`, accepts `author_questions` of 1 to 200 code points each (at most 3), rejects a persona with neither, and still rejects `opening_event`. The two fuel personas parse unchanged and their sealed payloads stay byte-identical (P1.1, P1.2).
    - `answers.json` holds one answer of 1 to 500 code points per question, first person; `validatePersonaAnswers` rejects a length mismatch, an out-of-range answer and an entry for a persona with no questions. The answers are never sealed, stored in a table or sent by an API (P1.2, P1.5).
    - The letter and answers contain no price, figure, digit or currency, no election or party term, no stereotype; `checkAnswerText` also rejects verdict words (right, wrong, close, near, off, accurate, changed, mistaken) and any reference to the letter, remembering, forgetting or changing her mind. They differ in plain everyday ways (a detail, an order, an emphasis) that do not touch money, health, character, competence or politics. The copy-test record covers the letter and the answers, with the reviewer's name, before sealing (P1.4, P1.8).
    - A text-only persona with answers enters a `reading` state instead of `recall`: one question at a time with her answer and the Fictional_Label ("Her answer (fictional)"), "Next question" on all but the last and "Break the seal" on the last. There is no answer field, no "No answer", no Sample_Answer, no "Record my answers" and no Memory_Line. No effect posts a Recall_Record; there is no `POST /api/openings` for this walk; the secret-release `GET` is as for any persona letter (P1.5, P1.6).
    - The Fictional_Label shows next to every Persona_Answer in the `recall` Stage, the testimony block of `letter` and the close if it repeats them; the fictional-persona note stays in every Stage; nothing highlights, pairs, aligns, counts, scores or explains any difference; the order is her testimony, then her letter (P1.7, P1.9).
    - The persona Step_Indicator shows three items for her; the Fastest_Path is one activation per question plus "Break the seal", recorded by QA (P1.6, L5.3).
    - The Demo_Index shows three envelopes side by side at the Desktop_Sizes and stacked at the Phone_Sizes, every open link inside the First_Viewport at 1366×800 and 1280×800 (P1.10).
    - Owner step O7 applies after task 20.
  - Tests: Property 13 (the persona schema accepts exactly the valid personas), Property 14 (persona text is everyday and carries no digit), Property 15 (the Text_Persona walk reads and posts nothing); Property 11 extended with the Text_Persona. Example tests: the Persona_List count; the Fictional_Label next to every Persona_Answer in `recall` and `letter` markup; no request to `/api/openings` with a `fetch` stub; no answer field in `recall`; the Opening_Flow reaching `close` for a text-only payload with no figures Stage (P1.12); the copy strings exactly.
  - Earlier-spec tests changed or retired: `personas/schema.test.ts`, `letter-checks*.test.ts`, `index.test.ts`, `reveal/opening-machine` tests, `OpeningFlow.test.tsx`, `demo/page.test.tsx`, `demo/PersonaCard.test.tsx`, `step-indicator.property.test.tsx`; name each with the reason.
  - Owner_Patches attached: none.
  - Copy evidence (G2.7): the `node tools/hooks/tone-check.mjs` result for the letter, the answers and each changed copy file, the `neutrality.md` copy test of the letter and answers with the reviewer's name, and the Retired_Phrase search of the rendered `/demo` and the persona page.
  - QA shots: `index` of `/demo`, and `intro`, `recall`, `marks`, `letter` and `close` of the Text_Persona, at the five Evidence_Sizes, with and without reduced motion; First_Viewport captures at both Phone_Sizes.
  - QA steps: 11-17, 11-18.
  - QA check: `npm run layout-check -- --require GT1,CF1,SI1` PASS on the Text_Persona page.
  - Production_Check: runs after task 20's seal and deploy: open her page with no input and press Next through her questions. Pass: one activation per question plus "Break the seal"; "Her answer (fictional)" next to every answer; no field; no figures Stage; the close line. In the network panel there is no request to `/api/openings`.
  - Real_Device_Check: on both phones, walk her page to `close`. Pass: as above.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: P1.1, P1.2, P1.4–P1.10, P1.12, P1.13, L5.3_

- [x] 20. P1 · Seal a persona with no metrics
  - Agent: `crypto-dev` · Depends on: 19 · Estimated size: ~300 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Task 19 is merged, so the schema and the Persona_List entry exist. Frontend and crypto work are split into two tasks (G1.8).
  - Scope: `scripts/seal-personas-core.ts`, `scripts/seal-personas.ts`, and the `*.test.ts` for each file above. No `src/lib/crypto/**` or `src/lib/seal-format/**` change.
  - Design sections: "P1. The Text_Persona" (Sealing).
  - Acceptance:
    - `buildPersonaPayload` seals a persona with no metrics as a v1 payload with `metrics: []`, `figures: []` and `recall_questions` from `author_questions` as `{ id: "a1", answer_type: "text", text }` in order. For a persona with metrics it behaves as before (P1.3).
    - The script reports the two fuel personas as `skipped` and the new one as `stored`; the new payload passes `payloadV1Schema`.
    - Owner step O7 applies: the owner runs the script against production and confirms the row exists before the image carrying the new ID is deployed, following the spec 10 P2.2 order (init container runs migrations and then `seal-personas` when `demo.sealPersonas` is true; a failing seal keeps the old pod serving), and records the output in this issue (P1.11).
  - Tests: Example tests: a no-metrics persona produces the payload above; the fuel personas' payloads are byte-identical to before; the Persona_List round trip opens with the Demo_Key.
  - Earlier-spec tests changed or retired: `seal-personas*` tests where a persona without metrics is newly valid; name each.
  - Owner_Patches attached: none.
  - QA shots: none. QA steps: none (the page is checked in task 19). QA check: none.
  - Production_Check: after the rollout, open the Text_Persona page. Pass: it loads with the new letter ID and the walk in task 19 completes.
  - Real_Device_Check: none beyond task 19.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: P1.3, P1.11, G1.8_

### Group H: landing and presentation

- [x] 21. H1 · Landing sections for the general letter, the static Coven_Strip, and SampleReceipt deleted
  - Agent: `frontend-dev` · Depends on: 2, 23 · Estimated size: ~700 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Task 23 is merged so the sections read the new Brand_Copy. Any W1 fix task is merged and listed under "Depends on".
  - Scope: `src/components/landing/RitualSection.tsx`, `ResurrectionSection.tsx`, `NoSealSection.tsx`, `CovenStrip.tsx`, `src/components/landing/copy.ts`, `src/components/landing/landing.module.css`, deleted: `src/components/landing/SampleReceipt.tsx`, `SampleReceiptView.tsx`, `sample-receipt.ts` and their tests, and the `*.test.ts(x)` for each file above. No `src/lib/kiro-stats.ts`, no `env` entry in `next.config.ts` (next.config.ts is not in scope).
  - Design sections: "H1 and H2. Landing and brand copy" (frontend-dev part), "Copy".
  - Acceptance:
    - `RitualSection`, `ResurrectionSection` and `NoSealSection` are rewritten for the general letter and name no fuel price as what a letter holds; they are server components with no new client JavaScript (H1.1, H1.4).
    - `CovenStrip` takes no props and shows the existing `covenTitle` ("Built by a coven of Kiro agents") and two links from `COVEN_LINKS`: the `.kiro` folder and `docs/agent-loop.md`. `KiroStats`, `countLabel`, the `stats` prop and the `covenCounts` copy keys are deleted. It shows no count and reads no build-time data (H1.2).
    - `SampleReceipt.tsx`, `SampleReceiptView.tsx`, `sample-receipt.ts`, their tests and copy keys are deleted (H1.2).
    - At both Phone_Sizes the sections and the strip are one column with no sideways scroll and every link at least 44×44 CSS px (H1.6). The two strip links each appear once, only in the strip (H1.5).
    - Until task 22 renders them, the sections are unimported; this PR must not leave an unimported-component test failing, so the import scan lands in task 22.
  - Tests: Example tests: `CovenStrip` takes no props and renders two links; no `kiro-stats` import anywhere; the deleted files are gone; the sections' strings contain no "fuel price" as what a letter holds.
  - Earlier-spec tests changed or retired: `landing/*Section.test.tsx`, `CovenStrip.test.tsx`, `landing/copy.test.ts`; name each with the reason.
  - Owner_Patches attached: none.
  - Copy evidence (G2.7): the `node tools/hooks/tone-check.mjs` result for each changed copy file, and the Retired_Phrase search of each section's rendered output.
  - QA shots: none beyond task 22's (the sections are not on a route until then).
  - QA steps: none. QA check: none.
  - Production_Check: none (no route change).
  - Real_Device_Check: none.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: H1.2, H1.4–H1.6_

- [x] 22. H1 · Render the sections on `/`, and fail on an unimported landing component
  - Agent: `platform-dev` · Depends on: 21 · Estimated size: ~200 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Task 21 is merged.
  - Scope: `src/app/page.tsx`, `src/components/landing/imports.test.ts` (new), `src/app/page.test.tsx`
  - Design sections: "H1 and H2. Landing and brand copy" (platform-dev part).
  - Acceptance:
    - `/` renders `RitualSection`, `ResurrectionSection`, `NoSealSection` and `CovenStrip` below `LandingHero`, in that order, as server components with no new client JavaScript; `/` stays at or under its 160 kB budget (H1.1).
    - The How_Page link and the repository link appear once, in the footer; the two Coven_Strip links appear once, only in the strip (H1.5).
    - `imports.test.ts` fails on any file under `src/components/landing/` that no rendered route imports (H1.3).
    - The hero First_Viewport rules still pass (H1.7).
  - Tests: the import scan; a render test of `/` for the section order and the single footer links.
  - Earlier-spec tests changed or retired: `src/app/page.test.tsx`; name the cases changed.
  - Owner_Patches attached: none.
  - QA shots: `/` at the five Evidence_Sizes, with and without reduced motion; First_Viewport captures plus one full-page capture at both Phone_Sizes.
  - QA steps: 11-19.
  - QA check: `npm run layout-check -- --require PH1` PASS on `/` at both Phone_Sizes.
  - Production_Check: open `https://revenant.devclef.se/`. Pass: the hero, then the ritual (four steps), resurrection and no-seal sections and the strip in that order; no sideways scroll; links 44×44.
  - Real_Device_Check: on both phones, scroll `/` to the bottom. Pass: one column, nothing cut off.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: H1.1, H1.3, H1.5, H1.7_

- [x] 23. H2 · Brand_Copy describes any letter
  - Agent: `frontend-dev` · Depends on: 2 · Estimated size: ~400 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Any W1 fix task is merged and listed under "Depends on". The Brand_Copy path is `src/components/brand/copy.ts` (see Overview); the task confirms it on `main` before editing.
  - Scope: `src/components/brand/copy.ts`, `src/components/brand/copy.test.ts`, `src/components/landing/LandingHero.tsx`, `src/components/landing/copy.ts`, `src/components/live/stepper/live-steps.ts` (key indexes for the four-entry Ritual only), `src/app/layout.tsx` and `src/app/page.tsx` (metadata strings only), `src/app/opengraph-image.tsx`, `src/app/how-it-is-sealed/**` (the lead only), `src/test/retired-phrases.test.ts` (the phrase rows), and the `*.test.ts(x)` for each file above. Where one of the `src/app` files falls under platform-dev in `agents.json`, the PR changes only the strings and the owner confirms the role first.
  - Design sections: "H1 and H2. Landing and brand copy", "Copy" (`heroSentence`, `ritualSteps`).
  - Acceptance:
    - `BRAND_COPY.heroSentence` reads "Seal what you believe now, a goal, a worry, a decision. When it opens, you testify first, then read what you wrote." (H2.1).
    - `BRAND_COPY.ritualSteps` has four entries: Write, Press the seal, Testify, See the receipts. "Seal the figures" retires. The Write line mentions up to three questions and an optional receipt; the See the receipts line is "Your testimony, then what you wrote, then any numbers then and now." The Live_Stepper's name lookups read the new indexes (H2.2).
    - Page metadata, `HOME_DESCRIPTION`, the Open Graph image source, the How_Page lead and the landing sections take their strings from Brand_Copy where it has them (H2.3). Spec 09 F2.4's check that README and Brand_Copy agree still passes, and the owner's README patch (task 24) matches the final Brand_Copy (H2.4).
    - "Seal the figures" (as a step name) and "fuel prices from the US or the EU" (as what a letter holds) join `src/test/retired-phrases.test.ts` for source files under `src/`, with the copy-test records exempt, and the test passes (H2.5).
    - The secondary landing call to action stays while the live demo is on, reworded as "Seal your own. It opens 30 seconds after you seal it." only if the Rehearsal_Line is consistent with it (H2.6).
  - Tests: Example tests: the exact strings; four Ritual entries; the Live_Stepper still names its five steps from the new indexes; the Retired_Phrase scan.
  - Earlier-spec tests changed or retired: `brand/copy.test.ts`, `landing/*.test.tsx`, `live-steps.test.ts`, `app/page.test.tsx`; name each with the reason.
  - Owner_Patches attached: the Retired_Phrase patch for "Seal the figures" and "fuel prices from the US or the EU" (O5).
  - Copy evidence (G2.7): the `node tools/hooks/tone-check.mjs` result for each changed copy file, and the Retired_Phrase search of the rendered `/`, `/demo`, `/how-it-is-sealed` and the Open Graph image text.
  - QA shots: `/` and `/how-it-is-sealed` at the five Evidence_Sizes, with and without reduced motion; First_Viewport captures at both Phone_Sizes.
  - QA steps: 11-19 (hero and ritual wording).
  - QA check: `npm run layout-check -- --require PH1` still PASS on `/`.
  - Production_Check: open `/` and `/how-it-is-sealed`. Pass: the new hero sentence; four ritual steps; no "Seal the figures"; metadata and the Open Graph text match.
  - Real_Device_Check: on both phones, open `/`. Pass: the hero sentence reads in full on the first screen.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: H2.1–H2.6_

- [x] 24. H3, H4 · Final audit and the README and write-up patches (Owner_Patches)
  - Agent: `owner` · Depends on: 22 · Estimated size: n/a (owner commit, no role PR)
  - Before this task: steering updated (S1 Owner_Patch on `main`). Tasks 1 to 23 are merged, or closed unmerged with the reason. The 20 November decision is recorded in task 25. This task runs after the freeze and before 4 December 2026, 2:00 PM PT.
  - Scope: `README.md`, `docs/kiro-writeup.md`. Owner-only (G1.3). The owner starts from the README and write-up as they stand on `main`.
  - Design sections: "Owner patches" item 5.
  - Acceptance:
    - The README status line says specs 01 to 10 are complete and spec 11 (any letter) is in progress, with the date of the patch. The persona demo line describes the personas by their written-as-of and opening dates and names no election. The README opening, "The ritual", "What's actually built" and Judge quick path describe the general letter, the optional receipt, the rehearsal and the text persona, and match Brand_Copy (H3.1, H3.2, H3.4, H2.4).
    - The "merged pull requests" count is recomputed at the final SHA with `gh pr list --state merged --limit 1000 --json number -q length` (184 on 10 November 2026) and matches the write-up (H3.3).
    - `docs/kiro-writeup.md` keeps its seven OWNER notes and gains an "Evidence" list under each with the commands and links the owner can paste (recount note, Kiro surfaces, one real hook block, spec loop vs vibe coding, property tests that caught a bug, Kiro powers, what went wrong once), and fixes the stale text ("spec 10 is in progress", "specs 01 to 09", the SHA `1b28a81`, the 168 count). Every number sits in the same sentence as its command (H4.1–H4.4).
    - Every claim that depends on cut or unmerged work is removed first, including real sealing on a no-go (L6.2, G3.6).
    - A search of the README, `docs/video-script.md`, `docs/kiro-writeup.md`, the Open Graph image, every test and every QA step finds neither retired spec 10 letter ID (`ydsos6hcjdEUOs3sK42RQg`, `8t6Bz4bWlaUky-byt1mzGg`) apart from the `retired_letter_ids` entries and the tests that read that list.
    - Every user-facing claim about Occasions, receipts, the rehearsal, the Text_Persona and real sealing in the copy modules, the landing page, the How_Page, the README, the write-up and the video script is listed against the merged code that makes it true, and each that is not is fixed or removed (spec 10 E1 re-run, per "Rules this spec replaces").
  - Tests: none written by a role. The owner runs `npm run layout-check -- --require FC1,FP1,GT1,PH1` once on a local build of `main` and records the result in this issue.
  - Earlier-spec tests changed or retired: none.
  - Owner_Patches attached: the README and `docs/kiro-writeup.md` patches, committed by this task.
  - QA shots: none. QA steps: 11-17 and 11-19 as a final pass.
  - Production_Check: none required.
  - Validation: `bash scripts/check.sh` on the owner commit, with SHA and exit status recorded in this issue.
  - _Requirements: H3.1–H3.5, H4.1–H4.4, H2.4, L6.2, G3.6_

### Decision

- [x] 25. L6 · Real-sealing go or no-go (owner issue, 20 November 2026)
  - Agent: `owner` · Depends on: none · Estimated size: n/a (owner decision, no PR)
  - Before this task: none.
  - Scope: none. The decision is recorded in this issue.
  - Design sections: "L6. Real sealing decision".
  - Acceptance:
    - The owner records go or no-go on 20 November 2026. With no entry by the end of that day the default is no-go: `REAL_SEALING` stays `off`, `/seal` answers 404, and no page, README line, video script, write-up or metadata mentions sealing a real letter or links to `/seal` (L6.1, L6.2).
    - On a go, the owner sets `realSealing: true` in the GitOps values (the chart default stays `false`); `/seal` shows `REAL_COPY.testNotice` above the Write step and on the sealed view with the earliest opening three months out; the live Close note links to `/seal`; the sealed view tells the author a judge-sealed letter can't be opened before 29 January 2027; the landing hero stays at two calls to action; and J10 joins the Journey_Check (L6.3–L6.5). The owner opens any frontend task needed for this as a new task in this file.
    - The decision changes none of X1 to X5, L1 to L5 or P1 to P5 (L6.6).
  - Tests: none.
  - Earlier-spec tests changed or retired: none.
  - Owner_Patches attached: none.
  - QA shots: none. QA steps: none. Production_Check: none.
  - _Requirements: L6.1–L6.6_

## Notes

- **Order.** The dispatcher claims the lowest-numbered ready issue whose dependencies are closed, one per role at a time. Closing task 1 releases tasks 2 (platform-dev), 3 (data-dev), 6 and 8 (frontend-dev). Tasks 4 and 5 follow task 3. Tasks 6 to 23 are mostly frontend-dev and form one chain in practice, because they share `live/`, `reveal/`, `ceremony/` and the copy modules. Tasks 2 and 25 touch no product file. Task 25 is an owner issue with no dependency.
- **Numbering exceptions to G3.1.** Task 21 (H1 sections) depends on task 23 (H2 Brand_Copy), so the sections read the new strings; task 23 carries the higher number and runs first among the H tasks, as the design's Task outline gives it. Tasks 4, 24 and 25 are as the outline gives them. Task 9 depends on tasks 5, 6 and 7, so group X's last task runs after its fixes are live.
- **Dates.** W1 (task 2) recorded and group X (tasks 3 to 9) merged by 14 November 2026. Real sealing go or no-go on 20 November 2026. Feature freeze 27 November 2026. Submission 4 December 2026, 2:00 PM PT. Judging ends 29 January 2027.
- **Cut order (G3.6).** If the 27 November freeze arrives first, cut in this order. Nothing in S, X, W, G, L1, L3, L4, L5, P2, P3, H2, H3 or H4 is cut. Task 24 (H3) removes every claim that depends on cut work.
  1. P5 (task 18): receipts keep published precision and the sealed `display_name`.
  2. P4 (task 17): the letter stays below the testimony.
  3. H1's "render" option (task 22, and the three sections in task 21): delete the three unrendered sections instead of rendering them; the Coven_Strip stays.
  4. L2's extra Occasions (task 11): keep "The year ahead" and "Blank".
  5. P1 (tasks 19 and 20): the Text_Persona and the S1 Demo 1 wording that describes her.
- **Owner_Patches by task.** Steering patches: task 1. J1 change: task 5 (O3). Journey_Check J2, J3, J5, J6, J9 and J10: task 9 (O4). `layout-check.mjs` focusable-under-hidden: task 8; PH1 Write threshold: task 12; LT1: task 17 (O6). Retired phrases: "Check your connection and reload the page" (task 7), "What's on your mind right now?" (task 13), "Seal the figures" and "fuel prices from the US or the EU" (task 23) (O5). README and write-up: task 24.
- **QA rows by task.** 11-01 and 11-02 (task 6); 11-03 and 11-04 (7); 11-05 (8); 11-06 (9); 11-07, 11-08, 11-09 (10; 11-07 again in 14); 11-10 (11); 11-11 (12); 11-12 (13); 11-13 (15); 11-14 (16); 11-15 (17); 11-16 (18); 11-17 and 11-18 (19); 11-19 (22, 23).
- **Property coverage.** The design's table lists Property 3 as written in task 5 and "extended in task 3", which is backwards (task 3 runs first and contains the invalid-row skipping). This plan corrects it: Property 3 is written in task 3. Properties 1 and 2 are written in task 5 (task 3's harness tests for log content and status are example tests that task 5 extends to Property 2). Property 4 (task 7); Property 5 (task 6); Property 6, Property 9, Property 10 (task 10); Property 7, Property 8 (task 11); Property 11 (written in task 14, extended in task 19); Property 12 (task 8); Properties 13, 14, 15 (task 19); Property 16 (task 15); Properties 17 and 18 (task 18); Property 19 (task 13).
- **Brand_Copy.** The path is `src/components/brand/copy.ts`; the design's `src/lib/brand-copy*` does not exist. The design's file-ownership row for it is superseded by this note.
- **Task 6 and task 10 overlap.** Task 6 unblocks `/demo/live` at once with the old six-step stepper and the existing minimum rule; task 10 replaces the rule and the stepper. Task 6's PR states which minimum rule it used.
- **No optional tasks.** Every task is required, and every property the design lists is a required test in the task that names it.

## Task Dependency Graph

Dependencies: 1 has none; 2 after 1; 3 after 1; 4 after 3; 5 after 3; 6 after 1; 7 after 5; 8 after 1; 9 after 5, 6 and 7; 10 after 2, 6 and 9; 11 after 10; 12 after 11; 13 after 12; 14 after 10; 15 after 2; 16 after 2; 17 after 16; 18 after 2; 19 after 14 and 16; 20 after 19; 21 after 2 and 23; 22 after 21; 23 after 2; 24 after 22; 25 has none. Every group L, P and H task also waits for any W1 fix task.

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2", "3", "6", "8"] },
    { "id": 2, "tasks": ["4", "5", "15", "16", "23"] },
    { "id": 3, "tasks": ["7", "18", "21"] },
    { "id": 4, "tasks": ["9", "17", "22"] },
    { "id": 5, "tasks": ["10"] },
    { "id": 6, "tasks": ["11", "14"] },
    { "id": 7, "tasks": ["12", "19"] },
    { "id": 8, "tasks": ["13", "20"] }
  ]
}
```
