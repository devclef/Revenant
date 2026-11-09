# Implementation Plan: 10 Own questions

## Overview

Spec 10 lets the author ask their future self up to three questions, answer them from memory when the letter opens, and see each answer beside the full letter. It first fixes the production bugs the owner found, and it ends with the persona prices, self-reported numbers and a final audit. Tasks follow the G3.1 order, and every task in a lower group has a lower number. The one exception to the order is group O: task 17 carries the last number but runs right after task 1 (requirements O1 and "Rules this spec replaces").

| Group | Tasks | What | Roles |
|---|---|---|---|
| S, steering and the copy scans | 1, 2 | Steering, copy checks and layout checks (owner, S1); the User_Content helper and the retired-phrases exclusion | owner, platform-dev |
| X, production bugs (P0) | 3, 4 | Then_Tick on the axis, the Step_Indicator row, the phone Landing_Ghost, README status (patch ae), plain opening dates. The phone Ghost layer fix (X2.1) moved to task 5 (C1.13), an exception to G3's "group X before group C" | frontend-dev |
| C, the critical path (P1) | 5 to 10, 12 to 14 | C1 no pick-up (5), C3 Recall_Record_V2 (6), C4 Testify (7), C2 Write step questions (8), C5 sample answers (9), C6 Break the seal (10), C7 the other Stages (12), C8 the Reveal (13), C9 the live payoff (14) | frontend-dev |
| P, persona letters with the price | 11 | Price lines in both letters, new letter IDs, the reseal and its deploy order | frontend-dev |
| R, self-reported numbers | 15 | Spec 08 later-tasks task 23, moved in and shipped | frontend-dev |
| E, final audit | 16 | Promise audit, no trace of the retired persona IDs, patches ah and ai | frontend-dev |
| O, operations | 17 | One safe log line in the Figures_API catch, so a figures 500 can be diagnosed; runs right after task 1 | data-dev |

Task 11 (group P) carries number 11 but follows task 9 (C5) and sits between C6 and C7, as the design's Task outline places it (G3.1: group P follows C5).

Each task is one GitHub issue and one PR for one role, except task 1, which is an owner commit with no PR. Each PR stays under `max_changed_lines` (5,000) as `.github/agents.json` counts it, and inside its role's paths plus `shared` (G1.1, G3.2). Every task is planned to merge by the 27 November 2026 freeze. There is no cut order and no optional task (G3.6).

Follow `design.md` in this folder for file names, constants, copy, values and algorithms, and `requirements.md` for the rules. Every rule of specs 02 to 09 and of `.kiro/steering/` still holds unless requirements.md "Rules this spec replaces" names it. Where the design proposes a value, the owner may change it in the task's issue body before the task is claimed; otherwise the design's value applies.

"Depends on" lists only spec 10 task numbers.

**What the loop can and can't see.** Spec-sync opens all 17 issues with `status:ready` as soon as this file reaches `main`. Task 1's issue gets the label `agent:owner`; `owner` is not in `ROLES` in `tools/dispatcher/revenant_dispatch.py`, so the dispatcher never claims it, and tasks 2, 3 and 17 wait until the owner closes it. The dispatcher never reads "Before this task", the Production_Checks, the Real_Device_Checks or the milestone gates, and the agent and QA see only the issue body, never its comments. So every gate below is enforced by hand: with the `status:ready` label, a `Blocked by #N` line in an issue body, or text in the issue body. Anything an agent must know (a reviewer's name, a changed value, a recorded decision) goes into the issue body before the issue is claimed.

## Launch order

1. Pull `main`, then commit this file.
2. Check that spec 09 Owner_Patches o, t, u and v are on `main` (the owner is committing them outside this spec, E1.3). Patch ae (task 3) edits the README as patch t left it, and patch ah (task 16) edits the files t, u and v created.
3. Pause the `revenant-dispatch` cron, then push the spec. Spec-sync opens the 17 issues.
4. Commit task 1's Owner_Patches (z, aa, ab, the task 1 part of ac, ad, af, ag), run task 1's validation, record it in task 1's issue, and close that issue. This is the only way tasks 2, 3 and 17 become claimable, so no role task is dispatched before the S1 Owner_Patch is on `main` (G3.3).
5. Write into the issue bodies, not comments: the copy-test reviewer's name for tasks 4 and 11, and any proposed design value the owner changes.
6. Resume the cron.

## Owner steps

| Step | When | What |
|---|---|---|
| O1 | Launch step 4 | Task 1: commit patches z, aa, ab, the task 1 part of ac, ad, af and ag, then close task 1's issue. |
| O2 | When task 3 merges | Commit patch ae (`README.md` status line and persona demo line, X3). |
| O3 | When task 4 merges | Commit the hook part of patch ac-4 (`RETIRED_PHRASES` and the `copy-tone-check` prompt gain the two election phrases). If spec 09 patch n is on `main`, its J7 gains the same two phrases. |
| O4 | When task 5 merges, and when its image goes live | Commit patch ac-5 (`RETIRED_PHRASES` and the hook prompt gain "Pick up the letter"). If spec 09 patch n is on `main`, commit the J2 change from ac-5 when task 5's image goes live in production, since J2 runs against production. |
| O5 | When task 10 merges | Commit patch ac-10 (`RETIRED_PHRASES` and the hook prompt gain the old `sealInstruction` sentence; J7 too if patch n is on `main`). |
| O6 | When task 11 merges | Follow the P2 deploy order in task 11 and record the init container log and the order of steps in task 11's issue. |
| O7 | When task 16 merges, before 4 December 2026, 2:00 PM PT | Commit patches ah (README, `docs/kiro-writeup.md`, `docs/video-script.md`) and ai (remove the walk's before-and-after branches from `tools/qa/layout-check.mjs` and `.kiro/agents/prompts/qa.md`). |
| Deploy | After each merge to `main` | Roll out the merge's image as `deploy.md` describes, run the task's Production_Check and Real_Device_Check (one iPhone with Safari, one Android phone with Chrome), and record both in its issue (G2.6). A failure is handled as spec 09 OD14 describes: a new fix task in this file, and `Blocked by #<fix issue>` in the body of the next task in the same group. |

## Milestone gates

| Date (end of day, UTC unless stated) | Gate | Effect |
|---|---|---|
| 13 November 2026 | Group S and group X merged: tasks 1 to 4 merged, and the Production_Checks and Real_Device_Checks of tasks 3 and 4 recorded as passed. | Task 5 depends on task 4, so no group C task can start before then. The owner merges no group C task while a group X task is open, unless the open issue records a blocker the owner accepts (G3.4). |
| 20 November 2026 | Real sealing go or no-go (spec 08 R25), unchanged, recorded in a new owner issue. | No task here changes. On a no-go, `/seal` stays behind its flag; task 8's `/seal` work still merges and is tested locally with `REAL_SEALING=on`, and task 16 removes any copy that promises real sealing (spec 08 R25.2). |
| 27 November 2026 | Feature freeze. Every task is planned to be merged. | A task worked but not merged by the end of the day is closed unmerged with the reason (G3.7). Task 16 then runs after it, before submission, and removes every claim that depends on it. |
| 4 December 2026, 2:00 PM PT | Submission. Owner patches ah and ai committed. | |
| 29 January 2027, 23:59:59 PT | End of judging. The site keeps running. | |

## Rules for every task

- **Branch and PR.** The dispatcher creates `agent/<role>/issue-N` and the PR "Closes #N". Do not push to `main` or merge. After a hook failure, make a new commit; do not amend.
- **Scope (G1.1).** Change only files that match your role's paths in `.github/agents.json` (or `shared`) and are listed in your task's Scope, plus new `*.test.ts(x)` files next to the code they test. Check your diff before you finish.
- **Hard boundaries (G1.2, G1.6).** Frontend-dev and platform-dev tasks change nothing under `src/app/api/`, `src/lib/crypto/`, `src/lib/seal-format/`, `src/lib/letter-store/`, `src/lib/db/` or `drizzle/`, and nothing in `scripts/seal-personas*`, `src/lib/figures/**`, `src/lib/sources/**` or `deploy/**`. No crypto primitive, key step, header field or `format_version` changes, and no line of `src/lib/seal-format/v1/payload.ts` or of the Recall_Record version 1 schema. `opening-machine.ts` changes only as C1 and C3 name: `BEGIN`, `verified` and the pick-up gate go, the recall drafts may start with Sample_Answers, and the record becomes Recall_Record_V2. Every other state, event and transition, the single submission, the retry with the same bytes and the reveal gate stay.
- **Owner_Patch rule (G1.3).** Never commit `tools/**`, `.kiro/**`, `docs/**`, `README.md`, `scripts/check.sh`, `scripts/check-js-budget.mjs` or `.github/**`. When a task needs one, take the diff from design.md "Owner patches", attach it to the issue or PR description under "Owner_Patch <letter>", and keep it out of the diff.
- **Privacy and size (G1.4, G1.5).** CSP header byte-identical. No request to another origin. New code writes nothing to `localStorage`, `sessionStorage`, IndexedDB, cookies, the URL path, the query string or the fragment. No new `dependencies` entry, animation library, WebGL, font, sound or vibration cue. Every route stays inside `scripts/check-js-budget.mjs`; a task that would push a route over stops and reports it.
- **User_Content (S2.2, S2.4).** Mark every User_Content element with `data-user-content=""` as the design lists. No runtime code checks, blocks, changes or warns about User_Content for its words; an Author_Question, a Text_Answer or a letter is accepted on its length rules alone.
- **Copy (G1.7, G2.8).** Every string in its feature folder's copy module or the persona content files, exactly as design.md "Copy" gives it. Second person, at most 25 words per sentence, no exclamation mark, no pun, no Scoring_Words_Always; no Scoring_Words_Scene in the Scene_Copy_Modules. No answer is called right, close, near, wrong, off or accurate. Each copy task attaches the `node tools/hooks/tone-check.mjs` result for every copy file it changed and a search of the rendered Our_Copy of every page it changed showing no Retired_Phrase remains.
- **Neutrality (S1.3).** Nothing scores, diffs, highlights, quotes, summarises or links a Text_Answer to the letter, and no measure is computed between them.
- **Tokens and the Accent (G1.8).** Colours only from `src/components/ceremony/scene/tokens.module.css`. The Accent marks only the reader's answer, the main buttons, the wax and the focus ring. A Kept_Sample may use the Accent, with its Sample_Label in the text colour.
- **Motion.** Every motion has its Skip and Calm_Mode path, runs only under `prefers-reduced-motion: no-preference` and `[data-ceremony-motion="full"]`, and changes only `transform` and `opacity`.
- **Data integrity.** Every figure shown carries value, unit, region, period, source and `retrieved_at`, with its period next to it. Nothing invented, estimated, converted or filled.
- **Fixtures (G3.1).** Tasks 6 and 7 build and test text questions with `src/lib/recall/fixtures.test-data.ts` only. No route serves a fixture letter.
- **Tests (G2.1, G2.2).** Vitest, `renderToStaticMarkup`, every `fetch` stubbed, no network, `DATABASE_URL` unset. Property tests with fast-check, `numRuns` at least 100, tag `// Feature: 10-own-questions, Property N: <title>`. A property whose parts land in several tasks is written by the first and extended by the later ones (design "Correctness Properties").
- **Evidence (G2.3 to G2.5).** The PR description states the final commit SHA with the `bash scripts/check.sh` exit status and PASS or FAIL; every route budget from `node scripts/check-js-budget.mjs` after `npm run build`; every earlier-spec test changed or retired with the reason; every asset added with its size in bytes; every Owner_Patch attached. Write "none" for an empty list.
- **Screenshots (G2.4).** For a screen change, PNG shots of every Stage or page the task changes at the Evidence_Sizes 2560×1440, 1366×800, 1280×800, 390×844 and 360×640, named `<stage-or-page>-<width>x<height>.png`. For groups X, C and P, per G2.4, the same set with `prefers-reduced-motion: reduce`, named `<stage-or-page>-<width>x<height>-reduced.png`. Phone shots are First_Viewport captures, plus one full-page capture per page.
- **QA (G2.7).** QA runs the rows of design.md "QA browser steps" the task lists, found with `^\| 10 \| <NN> \|`, and the `npm run layout-check -- --require <ids>` lines the task's "QA check" names.
- **After the merge (G3.5).** `bash scripts/check.sh` passes on `main`, and `/`, `/demo`, `/demo/live`, `/l/[id]`, `/demo/personas/us-maya` and `/demo/personas/eu-tomas` load, with each persona flow reaching `close` from `/`.
- If `design.md` and the code on `main` disagree, re-read the code, keep the design's behaviour, and say what you changed. If something is unclear, ask the owner in the issue. Do not guess.

## Tasks

### Group S: steering and the copy scans

- [x] 1. S1 · Steering, copy checks and layout checks (Owner_Patches z, aa, ab, ac task 1 part, ad, af, ag)
  - Agent: `owner` · Depends on: none · Estimated size: n/a (owner commit, no PR)
  - Before this task: none. This task is the steering update; once it is committed and this issue is closed, "steering updated (S1 Owner_Patch on `main`)" is true for every later task. Spec 09 patches o, t, u and v are committed outside this spec; this task does not need them.
  - Scope: `.kiro/steering/product.md`, `.kiro/steering/neutrality.md`, `.kiro/steering/tone.md`, `.kiro/steering/structure.md`, `.kiro/hooks/copy-tone-check.json`, `.kiro/hooks/ceremony-truth-check.json`, `tools/hooks/tone-check.mjs`, `tools/qa/layout-check.mjs`, `.kiro/agents/prompts/qa.md`. All owner-only; no role agent commits them (S1.1, G1.3).
  - Design sections: "Owner patches" z, aa, ab, ac ("Task 1"), ad, af, ag; "Content and scans: which checks read what".
  - Acceptance:
    - `product.md` (patch z) changes only the S1.2 items: Core loop steps 1, 6 and 7, the "Testify step (MVP)" decision, Demo 1 lines 79 to 84 with plain window dates and no election named, and the Demo 2 bullet. Step 2 is unchanged because it already labels personal numbers self-reported (S1.2).
    - `neutrality.md` (patch aa) gains the three "Revenant does not" bullets, and line 22 is rewritten so election dates only set the persona windows and show as plain dates (S1.3, S1.4).
    - `tone.md` (patch ab) adds the Persona_Letter exception to Testify and keeps "no hints about what's inside" for every other letter (S1.5).
    - Every other rule of the three files is unchanged, and the owner records the `neutrality.md` copy test of the new text in this issue (S1.6).
    - `structure.md` (patch ag) gains `letters/samples.json` and `ui/buttons.module.css`.
    - Patch ac, task 1 part: the `copy-tone-check` prompt flags any answer called right, close, near, wrong, off or accurate and checks source text only; `ceremony-truth-check` gains item (6); `tone-check.mjs` gets the two scoring regexes, an empty `RETIRED_PHRASES` list and its check, skipping `content/personas/letters/*-copy-test.md`. Each rule is true on `main` at the commit: `node tools/hooks/tone-check.mjs` reports nothing new (S2.5, S3.3).
    - Patch ad: the walk tolerates builds before and after tasks 5 and 9; NEUTRALITY skips `[data-user-content]`; TK1, SI1, GT1, FC1, ET1, SG1, AL1, CF1 and FP1 print measured values and `threshold=` and are BLOCKER only with `--require` (X1.4, X2.4, C6.11, C7.5). GT1 ignores any element inside `[data-ghost]`: the Envelope's `<p data-date>` lines and, from task 10, the Seal_Group are inside the Ghost, and ET1 and SG1 cover them. GT1 still covers everything outside the Ghost, and measures the Ghost_Body_Box (the drawing's box less G1's empty margins: 12 % each side, 15.5 % top, 12 % bottom), so the drawing's empty top may overlap the Compact_Top_Bar. GT1 runs at the `intact`, `recall`, `letter`, `figures` and `close` Stage starts, not at `marks` or `seal`, which AL1 and SG1 own. SI1 runs from `recall` on, never at `intact`, which keeps no step row rule until task 5 removes it. `npm run layout-check` without `--require` on a local build of `main` reports no new BLOCKER.
    - Patch af: the QA prompt uses `^\| 10 \| <NN> \|`, the tolerant persona walk, and requires the reduced-motion set for group X, C and P tickets, per G2.4.
    - The Journey_Check is not on `main`; nothing is committed for it here (design "Content and scans").
    - The owner closes this issue only after the commit is on `main`.
  - Tests: none written by a role. The owner runs the validation below on the commit.
  - Earlier-spec tests changed or retired: none.
  - Owner_Patches attached: z, aa, ab, ac (task 1 part), ad, af, ag, all committed by this task.
  - QA shots: none. QA steps: none (no PR).
  - Production_Check: none (group S, no image change).
  - Validation: `bash scripts/check.sh` on the owner commit, with the SHA and exit status recorded in this issue; `node tools/hooks/tone-check.mjs`; `npm run layout-check` against a local build of `main`.
  - _Requirements: S1.1–S1.6, S2.1, S2.5, S3.3, X1.4, X2.4, C6.11, C7.5, G3.3_

- [x] 2. S2, S3 · `textOutsideUserContent`, its property, and the copy-test exclusion in the retired-phrases test
  - Agent: `platform-dev` · Depends on: 1 · Estimated size: ~200 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`); task 1's issue is closed.
  - Scope: `src/test/user-content.ts` (new), `src/test/user-content.test.ts` (new), `src/test/retired-phrases.test.ts`
  - Design sections: "Content and scans: which checks read what", "Retired_Phrases (S3)", Property 1.
  - Acceptance:
    - `textOutsideUserContent(html)` returns every text node outside an element with `data-user-content` and none inside one (S2.2).
    - `src/test/retired-phrases.test.ts` keeps its phrases and inputs, scans `content/personas/` except `content/personas/letters/*-copy-test.md`, names the file and line of each hit, and reads rendered pages through `textOutsideUserContent` (S2.3, S3.2). No phrase is added here: each joins in the task that removes it (4, 5, 10).
    - The test passes on this commit. No runtime module imports `src/test/user-content.ts`.
  - Tests: Property 1 (rendered checks see only Our_Copy). Example tests: a copy-test record holding a retired phrase passes; the same phrase in `content/personas/letters/us-maya.txt` fails with its file and line.
  - Earlier-spec tests changed or retired: `src/test/retired-phrases.test.ts` (the exclusion and the helper only).
  - Owner_Patches attached: none.
  - QA shots: none (no screen change). QA steps: none. QA check: none.
  - Production_Check: none (group S, no runtime change). Real_Device_Check: none.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: S2.2, S2.3, S3.2_

### Group X: production bugs and the election labels

- [x] 3. X1, X2, X3 · The Then_Tick on the axis, the phone persona start, and the Step_Indicator row
  - Agent: `frontend-dev` · Depends on: 1 · Estimated size: ~700 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Spec 09 patch t is on `main`, because patch ae edits the README as t left it.
  - Scope: `src/components/ceremony/figures/figures.module.css`, `src/components/ceremony/figures/NumberLine.tsx`, `src/components/ceremony/figures/tick-leader.ts` (new), `src/components/ceremony/constants.ts`, `src/components/ceremony/constants-css.test.ts`, `src/components/ceremony/scene/scene.module.css`, `src/components/ui/StepIndicator.module.css`, `src/components/landing/landing.module.css` (the `.hero .ghost` rule below 600 px), and the `*.test.ts(x)` for each file above, including `src/components/landing/*.test.ts(x)`
  - Finding J6: a production Journey_Check dry run on 8 November 2026 found PH1 failing on `/` at 360×640. The Landing_Ghost's box reaches 670 px, past the bottom of the 640 px viewport.
  - Design sections: "Production findings and their causes on `main`" (Then_Tick, Ghost, Step_Indicator rows), "X1. The Then_Tick on the axis", "X2. The phone persona start", "Constants" (`TICK_LABEL_GAP_PX`), Owner patch ae.
  - Acceptance:
    - `.pinThen` and `.pinNow` become one `.tick` rule hanging from the axis's top edge; the answer Mark keeps its ring on the axis and gains a 2 px leader under it (X1.1, X1.3).
    - `tickLeaderPx(row, remPx, emPx)` sets each tick's height so it ends `TICK_LABEL_GAP_PX` (4) above its own label row, whatever row `placeLineLabels` gives it; `NumberLine` reads the root font size in its existing layout effect, and the static render uses 16 px (X1.2).
    - Check hooks: the axis carries `data-line-axis`, each tick `data-line-tick="then|now|mark"`, and each label `data-line-label`, so TK1 can measure them.
    - The phone Ghost layer fix (X2.1) is not in this task: it moved to task 5 (C1.13), which removes its cause. `.ghostLayer` is unchanged here.
    - Below 600 px, `[data-ceremony] > [data-step-indicator]` reserves the Compact_Ghost's box as design "X2" gives it; all four step names show in full, in at most two lines at the Phone_Sizes and one line elsewhere (X2.2, X2.3).
    - `.pit[data-compact="true"]` has no transition below 600 px (C1.6). At 600 px and wider nothing changes.
    - On `/`, the Landing_Ghost's box stays fully inside the First_Viewport at both Phone_Sizes, 390×844 and 360×640 (X2.5). Only the `.hero .ghost` rule below 600 px changes in `landing.module.css`.
    - The `intact` Stage and its `scroll-margin-top` rule stay until task 5 removes them.
    - If the pre-change build has a failing SI1 or GT1 line from `npm run layout-check -- --require SI1,GT1` at either Phone_Size, the PR quotes it to confirm the cause; otherwise it says there was none. Below 600 px GT1 prints a note on this task's builds, because the pick-up press is still there.
  - Tests: Property 20 (every tick touches the axis and reaches its label). Example tests: the step row rule is present below 600 px only; `TICK_LABEL_GAP_PX` in `constants-css.test.ts`.
  - Earlier-spec tests changed or retired: `ceremony/figures/NumberLine.test.tsx`, `number-line.test.ts`, `line-labels.test.ts`, `scene/phone-stage-clearance.test.ts`, `scene/compact-ghost.test.tsx`, `scene/intact-clearance.test.ts`, only where the tick geometry or the step row changes an asserted value; name each.
  - Owner_Patches attached: ae (`README.md` status line and persona demo line, on top of patch t, with the patch date) (X3.1 to X3.3).
  - QA shots: `recall`, `figures` and `close` of both persona pages at the five Evidence_Sizes, with and without reduced motion; First_Viewport captures of `recall` at both Phone_Sizes, plus one full-page capture per persona page; First_Viewport captures of `/` at both Phone_Sizes, with and without reduced motion.
  - QA steps: 10-01, 10-02.
  - QA check: `npm run layout-check -- --require TK1,SI1,GT1` PASS at every Evidence_Size, with and without reduced motion. GT1 ignores any element inside `[data-ghost]` (the Envelope's `<p data-date>` lines; ET1 and SG1 cover them) and still covers everything outside the Ghost, measured against the Ghost_Body_Box, not the whole drawing, at the `intact`, `recall`, `letter`, `figures` and `close` Stage starts (not `marks` or `seal`, which AL1 and SG1 own). SI1 runs from `recall` on, never at `intact`. `npm run layout-check -- --require PH1` PASS on `/` at both Phone_Sizes.
  - Production_Check: on `https://revenant.devclef.se/demo/personas/us-maya` in a 1366×800 window, walk to `close`. Pass: every Then, Now and answer mark touches its axis, with its label directly under it. In a 390×844 window, open both persona pages, scroll to the bottom and back. Pass: from `recall` on, the Step_Indicator shows "Testify", "Break the seal", "Read" and "See the receipts" in full. Open `https://revenant.devclef.se/` in a 360×640 window and in a 390×844 window. Pass: the whole Landing_Ghost is on the first screen at both sizes, with nothing cut off at the bottom.
  - Real_Device_Check: on an iPhone with Safari and an Android phone with Chrome, open both persona pages, scroll to the bottom and back, and walk to `close`. Pass: all four step names show in full from `recall` on, and every tick meets its axis. Open `/` on both phones. Pass: the whole Landing_Ghost is on the first screen.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: X1.1–X1.3, X2.2, X2.3, X2.5, X3.1–X3.3, C1.6_

- [x] 4. X4, S2, S3 · Plain opening dates, the election phrases retired, and the Letter_Text marker
  - Agent: `frontend-dev` · Depends on: 2, 3 · Estimated size: ~500 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Tasks 2 and 3 are on `main`. The owner has written the copy-test reviewer's name into this issue's body.
  - Scope: `content/personas/personas.json`, `content/personas/letters/us-copy-test.md`, `content/personas/letters/eu-copy-test.md`, `src/lib/personas/schema.ts`, `src/lib/personas/opening-event.test.ts` (retired), `src/components/ceremony/intro/PersonaIntro.tsx`, `src/components/ceremony/copy.ts`, `src/components/demo/PersonaCard.tsx`, `src/components/demo/copy.ts`, `src/app/demo/page.tsx`, `src/app/demo/personas/[key]/page.tsx`, `src/components/ceremony/letter/LetterBlock.tsx`, `src/test/retired-phrases.test.ts` (the two phrase rows), and the `*.test.ts(x)` for each file above
  - Design sections: "X4. Plain opening dates", "Content and scans" (the marker), "Retired_Phrases (S3)", "Persona_List after X4 and P2", "Copy" (removed keys), Owner patch ac-4.
  - Acceptance:
    - `opening_event` and `openingEventSchema` leave `schema.ts`; the persona object stays strict, so a list with `opening_event` fails to parse; `personas.json` drops both entries (X4.2).
    - `opens_at`, every letter ID and every sealed payload are unchanged (X4.3).
    - `PersonaIntro` has no `openingEvent` prop and no source link; `PersonaCard` and `/demo` show "Opens {date}" only; the persona page and its metadata name no event. `introOpensEvent`, `introEventSource` and `demoOpensEvent` are removed (X4.1).
    - Both copy-test records gain an entry recording the removal, with the reviewer's name from this issue's body (X4.4).
    - `LetterBlock` puts `data-user-content` on the Letter_Text `p` when `letterKind !== "persona"`; the Persona_Letter text carries no marker (S2.2, S2.3).
    - `src/test/retired-phrases.test.ts` gains "U.S. presidential election day" and "European Parliament election" and passes (S3.1, S3.2).
    - `src/lib/events/**` is not touched.
  - Tests: a schema test that a persona with `opening_event` is rejected; render tests of `PersonaIntro`, `PersonaCard` and `/demo` with no event name and no "Date source" link; `LetterBlock` marker per letter kind; the copy strings.
  - Earlier-spec tests changed or retired: `lib/personas/opening-event.test.ts` (retired), `schema.test.ts`, `ceremony/intro/PersonaIntro.test.tsx`, `demo/PersonaCard.test.tsx`, `app/demo/page.test.tsx`, `app/demo/personas/[key]/page.test.tsx`, `ceremony/copy.test.ts`, `copy-exact.property.test.ts`; name each with the reason.
  - Owner_Patches attached: ac-4 (`RETIRED_PHRASES` and the `copy-tone-check` prompt gain the two phrases; J7 too if spec 09 patch n is on `main`) (S3.3).
  - Copy evidence (G2.8): the `node tools/hooks/tone-check.mjs` result for each changed copy file, and the Retired_Phrase search of the rendered `/demo` and both persona pages.
  - QA shots: `index` of `/demo` and `intact` of both persona pages at the five Evidence_Sizes, with and without reduced motion; First_Viewport captures at both Phone_Sizes.
  - QA steps: 10-03.
  - QA check: `npm run layout-check -- --require TK1,SI1,GT1` still PASS. GT1 ignores any element inside `[data-ghost]` (the Envelope's `<p data-date>` lines; ET1 and SG1 cover them) and still covers everything outside the Ghost, measured against the Ghost_Body_Box, not the whole drawing, at the `intact`, `recall`, `letter`, `figures` and `close` Stage starts (not `marks` or `seal`, which AL1 and SG1 own). SI1 runs from `recall` on, never at `intact`.
  - Production_Check: open `https://revenant.devclef.se/demo` and both persona pages, and view each persona page's source. Pass: "Opens 5 November 2024" and "Opens 9 June 2024"; no "election", no event name and no "Date source" link anywhere, including the metadata.
  - Real_Device_Check: on both phones, open `/demo` and both persona pages. Pass: plain dates only.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: X4.1–X4.4, S2.2, S2.3, S3.1, S3.2, S3.3_

### Group C: the critical path

- [x] 5. C1 · No pick-up Stage: one path to Testify, the focus table, the held Envelope and the Testify_Context
  - Agent: `frontend-dev` · Depends on: 4 · Estimated size: ~1,800 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Tasks 3 and 4 merged with their Production_Checks and Real_Device_Checks recorded as passed, or a blocker the owner accepts recorded in the open group X issue (G3.4, the 13 November gate).
  - Scope: `src/components/reveal/opening-machine.ts`, `src/components/reveal/OpeningFlow.tsx`, `src/components/reveal/useOpeningFlow.ts`, `src/components/reveal/held-envelope.ts`, `src/components/reveal/RecallStep.tsx`, `src/components/reveal/begin-guard.ts` (deleted), `src/components/reveal/SealIntact.tsx` (deleted), `src/components/reveal/copy.ts`, `src/components/ceremony/stages.ts`, `src/components/ceremony/steps.ts`, `src/components/ceremony/CeremonyRoot.tsx`, `src/components/ceremony/stage-context.ts`, `src/components/ceremony/copy.ts`, `src/components/ceremony/constants.ts`, `src/components/ceremony/envelope/EnvelopeView.tsx`, `src/components/ceremony/envelope/EnvelopeView.module.css`, `src/components/ceremony/intro/TestifyContext.tsx` (new), `src/components/ceremony/intro/intro.module.css`, `src/components/ceremony/scene/scene.module.css` (the `intact` rules and the phone `.ghostLayer` rule), `src/components/ceremony/recall/RecallPager.tsx` (the `data-stage-heading` attribute only), `src/components/live/stepper/**` (the `stepForFlowPhase` mapping only), `src/app/demo/personas/[key]/page.tsx` (props only), `src/test/retired-phrases.test.ts` (the phrase row), and the `*.test.ts(x)` for each file above
  - Design sections: "Opening_Flow after this spec", "Gestures (C1.10)", "Focus: Load_Entry and Gesture_Entry", "Stages and steps", "C1. The Opening_Flow without the pick-up Stage", "C1. Testify_Context", "X2" items 1 and 2, Owner patch ac-5.
  - Acceptance:
    - Both `OPENED` arms call one `enterRecall(opened, samples)`; the persona's `verifying` and the live letter's `unlocking` reach `recall` with no judge action in between. In this task `enterRecall` has no text cap and `samples` is always `{}`; tasks 6 and 9 add them (C1.1, C1.2).
    - `verified`, `BEGIN`, `begin-guard.ts`, `showPickUp`, `REVEAL_COPY.pickUp`, `REVEAL_COPY.begin`, `SealIntact.tsx`, the `EnvelopeView` variant `verified`, `stageLive.intact` and the `intact` Stage are removed; `stage-context.ts` defaults to `"emerging"`. The PR quotes the search showing none of them has another use (C1.3).
    - A loading, hash or opening failure shows its FlowError and renders no question, no Testify_Context and no seal statement (C1.4).
    - `HELD_TAGS` adds `recall`, `submitting` and `submit_failed`, so the Ghost holds the Envelope through Testify (C1.5). The stage 1 Envelope face is unchanged until task 10.
    - The first question renders in the same render as `recall` at any Emergence phase, and the Ghost_Box overlaps none of its boxes (C1.6). Under reduced motion or Calm_Mode the settled scene shows from the first render (C1.8).
    - The persona Step_Indicator renders from the first `recall` render with Testify current, and not in `emerging`, `sealed` or `error` (C1.7).
    - `stepForFlowPhase` loses its `verified` case; the Live_Stepper keeps six steps and moves from Wait to Testify on the first `recall` phase (C1.9).
    - The passkey assertion is still the first asynchronous call inside the unlock press; the PR states, from design "Gestures", that no other step needs a user gesture (C1.10).
    - `focusTargetFor(prev, next, shape)` with `letterShape(state)`: `emerging` to `recall` returns `stage-heading`, focused with `preventScroll: true` and no scroll; `envelope` to `recall` returns `default` (the answer field). The other rows of the design's table are encoded too, with the `focusHeading` fallback for headings that don't exist yet (C1.12).
    - `TestifyContext` with `data-testify-context`: for a persona, the notice, `contextFrom`, "Written as of {date} · Opens {date}" and `sealIntact`; for a Live_Letter or Real_Letter, `sealIntact` only; three short lines below 600 px, not a card (C4.3, C4.10).
    - Check hooks: each recall question `h2` carries `data-stage-heading` (FC1).
    - The `intact` `scroll-margin-top` rule goes (X2 item 2).
    - Below 600 px on the persona page, `.ghostLayer` is `position: absolute; inset: 0 0 auto 0; height: 100vh`, and the layer is anchored to the top of the document: its containing block starts at the document's top edge at every scroll position. In a trial on `main` with only the `position` change, it did not. The Ghost_Body_Box overlaps no text box of the Persona_Intro or the Testify_Context from first paint to `recall` (C1.13, moved from X2.1). This is an exception to G3's "group X comes before group C": the cause, the pick-up press and its focus scroll, is removed in this task.
    - GT1 passes at both Phone_Sizes in `recall`, at the Stage start and after scrolling to the bottom (C1.13).
    - `src/test/retired-phrases.test.ts` gains "Pick up the letter" and passes (S3.1).
    - Every QA step, layout check and test that names the Pick_Up_Button or `intact` is changed or retired and named in the PR (C1.11).
  - Tests: Property 7 (opening goes straight to Testify on one path; no cap, no samples yet), Property 8 (focus follows the entry; the `recall` entries), Property 9 (no `intact`; steps). Example tests: the phone Ghost layer rule is present below 600 px only and anchored to the top of the document; `holdsEnvelope` for the recall tags; the stepper mapping without `verified`; the first-async-step passkey test; a FlowError renders no question and no Testify_Context.
  - Earlier-spec tests changed or retired: `reveal/opening-machine` tests, `OpeningFlow.test.tsx`, `ceremony/pick-up-gate.property.test.tsx` (retired), `begin-guard.test.ts` (retired), `stages.test.ts`, `steps.test.ts`, `step-indicator.property.test.tsx`, `CeremonyRoot.test.tsx` ("CeremonyRoot focus rule"), `envelope/EnvelopeView.test.tsx`, `scene/pickup-lift.test.ts`, `scene/intact-clearance.test.ts`, `scene/phone-stage-clearance.test.ts`, `scene/compact-ghost.test.tsx`, `reveal/copy.test.ts`, `live/stepper/unlock-in-place.test.ts`, `targets.test.ts`, `constants-css.test.ts`; name each with the reason.
  - Owner_Patches attached: ac-5 (`RETIRED_PHRASES` and the hook prompt gain "Pick up the letter"; if spec 09 patch n is on `main`, J7 gains it and J2 waits for `[data-ceremony="recall"]` with no pick-up press, committed when this task's image goes live).
  - Copy evidence (G2.8): the `node tools/hooks/tone-check.mjs` result for each changed copy file, and the Retired_Phrase search of the rendered persona pages, `/demo/live` and `/l/[id]`.
  - QA shots: `emerging` and `recall` of both persona pages, and the Wait and Testify steps of `/demo/live`, at the five Evidence_Sizes, with and without reduced motion; First_Viewport captures of `recall` at both Phone_Sizes.
  - QA steps: 10-04, 10-05.
  - QA check: `npm run layout-check -- --require FC1,GT1,SI1` PASS at every Evidence_Size, with and without reduced motion; TK1 still PASS. GT1 ignores any element inside `[data-ghost]` (the Envelope's `<p data-date>` lines; ET1 and SG1 cover them) and still covers everything outside the Ghost, measured against the Ghost_Body_Box, not the whole drawing, at the `intact`, `recall`, `letter`, `figures` and `close` Stage starts (not `marks` or `seal`, which AL1 and SG1 own). SI1 runs from `recall` on, never at `intact`.
  - Production_Check: open `https://revenant.devclef.se/demo/personas/us-maya` and `/demo/personas/eu-tomas` and touch nothing. Pass: no "Pick up the letter"; the first question, its field and the seal statement are on the first screen; the page did not scroll; Testify is the current step. In a 390×844 window, scroll each persona page to the bottom and back. Pass: no text under the Ghost at any point. On `/demo/live`, seal, wait and press "Unlock with your passkey" once. Pass: the first question shows with its field focused, with no second press.
  - Real_Device_Check: on both phones, open both persona pages. Pass: no scroll and no keyboard on load; the Testify_Context and the first question are readable and clear of the Ghost; scrolled to the bottom and back, the Ghost never covers text. On `/demo/live`, seal with the phone's passkey, wait, unlock once. Pass: straight to the first question.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: C1.1–C1.13, C4.3, C4.10, S3.1, S3.3_

- [x] 6. C3 · Recall_Record_V2, its builder and parser, the size test, the text cap and the text-question fixtures
  - Agent: `frontend-dev` · Depends on: 5 · Estimated size: ~900 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Task 5 is on `main`.
  - Scope: `src/lib/recall/record.ts` (one export line), `src/lib/recall/record-v2.ts` (new), `src/lib/recall/parse-record.ts` (new), `src/lib/recall/limits.ts` (new), `src/lib/recall/index.ts`, `src/lib/recall/fixtures.test-data.ts` (new, imported by tests only), `src/lib/recall/record-v2-size.test.ts` (new), `src/components/reveal/opening-machine.ts` (the cap in `enterRecall` and the record type), `src/components/reveal/useOpeningFlow.ts` (`submit`), `src/components/reveal/OpeningFlow.tsx` (types only), and the `*.test.ts(x)` for each file above
  - Design sections: "C3. Recall_Record_V2", "The Max_Record size (C3.6)", "Data Models" (Recall_Record_V2), "Constants" (`TEXT_ANSWERS_MAX`, `TEXT_ANSWER_MAX_CODE_POINTS`), "Error Handling".
  - Acceptance:
    - `recallRecordV2Schema` is strict with `version: 2`, at most 20 answers and at most 3 of kind `text`; number answers use the v1 rule and may carry `sample: true`; `sample` anywhere else is an unknown key (C3.1 to C3.4).
    - `record.ts` gains only `export const numberAnswerSchema = numberAnswer;`; every other line of `record.ts` is byte-identical, and a test shows `numberAnswerSchema` accepts and rejects exactly what the v1 number answer does (G1.6).
    - `recallRecordV2SchemaFor(questions)` needs one answer per question ID, with a kind the question's `answer_type` allows (C3.5).
    - `buildRecallRecordV2(questions, drafts, samples)` builds no-answer, trimmed text and number answers, with `sample: true` exactly on Kept_Samples, or returns every invalid question ID (C3.4, C4.6).
    - `parseRecallRecord` accepts version 1 and version 2 and returns exactly the v1 schema's result for version 1; an import-boundary test shows only tests import `parse-record.ts` (C3.7).
    - `record-v2-size.test.ts` builds the Max_Record, encrypts it with a real `encryptOpeningRecord` key, asserts a ciphertext of at most 65,536 bytes and a request body of at most 100,000 characters, and prints the plaintext, ciphertext and body sizes; the PR quotes them (C3.6).
    - `useOpeningFlow.submit` builds and posts a Recall_Record_V2 for every letter, including letters sealed before this spec, with `samples` `{}` until task 9 (C3.8).
    - `enterRecall` returns `{ tag: "open_failed", kind: "invalid_payload" }` for more than `TEXT_ANSWERS_MAX` text questions (C3.9).
    - `fixtures.test-data.ts` holds v1 payloads with 0 to 3 text questions `a1`… before `q1`…, one with 4 text questions, and one with no figures and 2 text questions, each passing `payloadV1Schema` (G3.1).
    - `encryptOpeningRecord`, `decryptOpeningRecord` and `POST /api/openings` are unchanged (C3.12).
  - Tests: Property 10 (the schema accepts exactly the valid records), Property 11 (building the record keeps what was submitted), Property 12 (the record round trip), Property 13 (version 1 records parse as before); Property 7 extended with the C3.9 cap. Example tests: the size test; the import scan; the `numberAnswerSchema` parity test.
  - Earlier-spec tests changed or retired: `lib/recall/record.test.ts` (kept, v1 unchanged), `record-encryption.test.ts`, `reveal/useOpeningFlow` tests, `reveal/opening-machine` tests; name each with the reason.
  - Owner_Patches attached: none.
  - QA shots: none (no screen change).
  - QA steps: none of its own in the table. The QA agent walks both personas to `close` as in 10-04 and checks one `POST /api/openings` with status 201.
  - QA check: `npm run layout-check -- --require FC1,GT1,SI1` still PASS. GT1 ignores any element inside `[data-ghost]` (the Envelope's `<p data-date>` lines; ET1 and SG1 cover them) and still covers everything outside the Ghost, measured against the Ghost_Body_Box, not the whole drawing, at the `intact`, `recall`, `letter`, `figures` and `close` Stage starts (not `marks` or `seal`, which AL1 and SG1 own). SI1 runs from `recall` on, never at `intact`.
  - Production_Check: on `https://revenant.devclef.se/demo/personas/us-maya`, answer and walk to `close` with the network panel open. Pass: exactly one `POST /api/openings`, status 201, and the letter shows only after it.
  - Real_Device_Check: on both phones, walk one persona to `close`. Pass: the answers are recorded once and the reveal follows.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: C3.1–C3.12, G1.6, G3.1_

- [x] 7. C4 · Testify text fields, the Memory_Line, and "No answer" under its field
  - Agent: `frontend-dev` · Depends on: 6 · Estimated size: ~1,000 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Task 6 is on `main` (its fixtures).
  - Scope: `src/components/ceremony/recall/RecallPager.tsx`, `src/components/ceremony/recall/RecallPager.module.css`, `src/components/ceremony/recall/TextAnswerField.tsx` (new), `src/components/ceremony/recall/recall-pager.ts`, `src/components/ceremony/recall/recall-field.ts`, `src/components/ceremony/intro/TestifyContext.tsx`, `src/components/ceremony/intro/intro.module.css`, `src/components/reveal/RecallStep.tsx`, `src/components/reveal/copy.ts`, and the `*.test.ts(x)` for each file above
  - Design sections: "C4. Testify", "C7. The other Stages" (the `recall` "No answer" row), "Constants" (`TEXT_ANSWER_ROWS`), "Copy" (`memoryLine`, `textCount`, `textAnswerInvalid`).
  - Acceptance:
    - Questions show in payload order, one per screen, "Next question" on every one but the last and "Record my answers" on the last (C4.1).
    - A `"text"` question renders `TextAnswerField`: a `textarea` with `rows={4}`, named by its question `h2`, with `data-stage-focus`, a live `textCount` in code points in `aria-describedby`, and the existing "No answer" control; Enter inserts a line break (C4.5).
    - An empty text answer without "No answer", or one over 1,000 code points, keeps the text, shows `textAnswerInvalid` after a submit attempt, and does not advance (C4.6).
    - Number questions keep the Recall_Number_Parser, the Recall_Scale and "No answer" unchanged (C4.7).
    - The question text renders exactly as sealed inside a `data-user-content` element (C4.9).
    - The persona Testify_Context shows `memoryLine` with the written-as-of month in en-GB ("May 2024") (C4.2).
    - "No answer" sits directly under the field group, before the parsed-value line and the scale (C7.2 for `recall`).
    - The PR measures and states, at each Evidence_Size, that the first question's field is in the First_Viewport at the start of `recall`, and its primary control too at every size but 360×640 (C4.4).
    - No letter text, figure or Now_Figure shows before `POST /api/openings` returns 201 (C4.8).
    - Text questions are tested with the task 6 fixtures only; no route serves them. Text-field screenshots and QA 10-09 belong to task 8.
  - Tests: render and example tests with the task 6 fixtures: the accessible name, the code-point count with an astral character, Enter adds a line break, the invalid states keep the text; the "No answer" order; the copy strings exactly.
  - Earlier-spec tests changed or retired: `ceremony/recall/RecallPager.*.test.tsx`, `recall-pager.test.ts`, only where text questions or the "No answer" position change an asserted value; name each.
  - Owner_Patches attached: none.
  - Copy evidence (G2.8): the `node tools/hooks/tone-check.mjs` result for each changed copy file, and the Retired_Phrase search of the rendered persona pages and `/demo/live`.
  - QA shots: `recall` of both persona pages and the Testify step of `/demo/live` at the five Evidence_Sizes, with and without reduced motion; First_Viewport captures at both Phone_Sizes.
  - QA steps: 10-04, 10-05 (regression; the text-answer row 10-09 runs in task 8).
  - QA check: `npm run layout-check -- --require FC1,GT1,SI1` PASS at every Evidence_Size, with and without reduced motion. GT1 ignores any element inside `[data-ghost]` (the Envelope's `<p data-date>` lines; ET1 and SG1 cover them) and still covers everything outside the Ghost, measured against the Ghost_Body_Box, not the whole drawing, at the `intact`, `recall`, `letter`, `figures` and `close` Stage starts (not `marks` or `seal`, which AL1 and SG1 own). SI1 runs from `recall` on, never at `intact`.
  - Production_Check: open `https://revenant.devclef.se/demo/personas/eu-tomas`. Pass: "You lived through May 2024 too. Answer from your own memory of it." above the first question; "No answer" directly under the field; the field in the first screen.
  - Real_Device_Check: on both phones, open both persona pages and answer one question. Pass: the field and "No answer" are in the first screen and the keyboard does not hide the field.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: C4.1–C4.10, C7.2, G3.1_

- [x] 8. C2 · Author_Question rows on the Write step, sealing them, and the `/seal` figure minimum
  - Agent: `frontend-dev` · Depends on: 7 · Estimated size: ~1,200 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Tasks 6 and 7 are on `main` and live in production, so Testify can answer a text question before any letter seals one (G3.1).
  - Scope: `src/components/live/AuthorQuestions.tsx` (new), `src/components/live/author-questions.ts` (new), `src/components/live/write-draft.ts`, `src/components/live/WriteForm.tsx`, `src/components/live/form.ts`, `src/components/live/build-payload.ts`, `src/components/live/seal-runner.ts`, `src/components/live/FigurePicker.tsx`, `src/components/live/copy.ts`, `src/components/live/live.module.css`, `src/components/live/stepper/**` (Back and Next only, if the draft needs it), and the `*.test.ts(x)` for each file above
  - Design sections: "C2. Author_Question rows on the Write step", "Data Models" (Author_Question in the payload, Write draft), "Constants" (`AUTHOR_QUESTIONS_MAX`, `AUTHOR_QUESTION_MAX_CODE_POINTS`), "Copy" (`live/copy.ts`).
  - Acceptance:
    - `AuthorQuestions` renders after the letter field and its Prompt_Starters on `/demo/live` and `/seal`: a `fieldset` with `authorQuestionsLegend` and `authorQuestionsHint`, 0 to 3 rows each with a visible "Question {n}" label and "Remove question {n}", and "Add a question" while fewer than 3 rows exist (C2.1).
    - The Question_Starters are buttons: a press fills the first row that is empty after trimming, else adds a row when fewer than 3 exist, else does nothing, and moves focus to that row (C2.4). The five starters and `livePrefill` are exactly the design's (C2.6).
    - `answerInLetter` shows next to the rows (C2.5).
    - `initialWriteDraft("demo")` starts with the Live_Prefill row; `initialWriteDraft("real")` starts with none, and `/seal` prefills nothing (C2.12, C9.5).
    - `questionsForSeal` drops rows that are empty after trimming, touched or not; only a row over 200 code points blocks, with `questionTooLong` shown after touch or a seal attempt, the text kept (C2.2, C2.3).
    - `buildLivePayload` puts `a1`… `answer_type: "text"` questions with no `metric_id` and the trimmed text before the generator's `q1`… (C2.7, C2.8, C2.9).
    - `validateWrite(…, questions, mode)` reports `figures_none` below `minFiguresFor(mode, questions)`: 0 for `real` with a non-empty question, 1 otherwise; `/demo/live` keeps 1 to 6; the `/seal` picker shows `figuresHintReal` (C2.13).
    - The rows survive Back, Next, the cancelled, failed and cannot-lock screens and Try again; after a 201 the draft is dropped and no question shows again until the letter opens (C2.10, C2.11).
    - Rows carry `data-user-content` once their text differs from the Live_Prefill. Nothing checks a row's words (S2.4).
  - Tests: Property 2 (rows stay within 0 to 3), Property 3 (empty rows are dropped and only long rows block), Property 4 (Author_Questions are sealed as v1 text questions, first), Property 5 (the draft survives every way back; the question rows), Property 6 (the figure minimum follows the mode and the questions). Example tests: the copy strings exactly; the Question_Starters and the Live_Prefill through `checkRecallSubject`'s word list and `firstPoliticalTerm`; a 0-figure Real_Letter payload with one question passes `payloadV1Schema`.
  - Earlier-spec tests changed or retired: `live/WriteForm.test.tsx`, `live/form.test.ts`, `build-payload.property.test.ts`, `write-validation.property.test.ts`, `live/copy.test.ts`, the `stepper` Back tests; name each with the reason.
  - Owner_Patches attached: none.
  - Copy evidence (G2.8): the `node tools/hooks/tone-check.mjs` result for each changed copy file, and the Retired_Phrase search of the rendered `/demo/live` and `/seal`.
  - QA shots: the Write step of `/demo/live` and of `/seal` (local, `REAL_SEALING=on`), and the Testify text question and `marks` of a Live_Letter with Author_Questions, at the five Evidence_Sizes, with and without reduced motion; First_Viewport captures at both Phone_Sizes.
  - QA steps: 10-06, 10-07, 10-08 (sealing only; QA marks its opening half "not run (by design)"), 10-09.
  - QA check: `npm run layout-check -- --require GT1,SI1` PASS on `/demo/live`; NEUTRALITY reports no hit from User_Content. GT1 ignores any element inside `[data-ghost]` (the Envelope's `<p data-date>` lines; ET1 and SG1 cover them) and still covers everything outside the Ghost, measured against the Ghost_Body_Box, not the whole drawing, at the `intact`, `recall`, `letter`, `figures` and `close` Stage starts (not `marks` or `seal`, which AL1 and SG1 own). SI1 runs from `recall` on, never at `intact`.
  - Production_Check: on `https://revenant.devclef.se/demo/live`, keep the Live_Prefill, add a starter, seal, wait 30 seconds, unlock. Pass: both questions are asked first, as multi-line fields, then the figure questions; one `POST /api/openings` with 201. `/seal` is checked only if real sealing is on in production; otherwise write "not run (real sealing off)".
  - Real_Device_Check: on both phones, write a question, seal with the phone's passkey, unlock and answer it with the on-screen keyboard. Pass: the row and the answer field stay above the keyboard and the text is kept.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: C2.1–C2.13, C9.5, S2.4_

- [x] 9. C5 · Sample answers for the persona figure questions
  - Agent: `frontend-dev` · Depends on: 8 · Estimated size: ~1,200 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Task 8 is on `main`.
  - Scope: `content/personas/letters/samples.json` (new), `src/lib/personas/samples.ts` (new), `src/lib/personas/spread.ts` (new), `src/lib/personas/record-candidate.ts` (new), `src/lib/personas/index.ts`, `src/components/reveal/sample-seed.ts` (new), `src/components/reveal/sample-pick.ts` (new), `src/components/reveal/useOpeningFlow.ts`, `src/components/reveal/opening-machine.ts`, `src/components/reveal/OpeningFlow.tsx`, `src/components/reveal/RememberedAnswers.tsx`, `src/components/reveal/FigureEntry.tsx` and `src/components/reveal/ReceiptCard.tsx` (the "Your answer" row only), `src/components/reveal/copy.ts`, `src/components/reveal/reveal.module.css`, `src/components/ceremony/recall/RecallPager.tsx` and `RecallPager.module.css` (the Sample_Note only), `src/app/demo/personas/[key]/page.tsx` (the `sampleCandidates` prop), and the `*.test.ts(x)` for each file above
  - Design sections: "Data flow for sample answers (C5)", "C5. Sample answers", "Data Models" (Sample_Candidates file), "Constants" (`SAMPLE_CANDIDATES_MIN` / `MAX`, `SPREAD_*`, `SAMPLE_DECIMALS`), "Copy" (`sampleNote`, `sampleLabel`), "Error Handling".
  - Acceptance:
    - `samples.json` holds the design's four lists of 5; `samples.ts` validates them strictly and fails if a persona metric has no entry or an entry names a metric the persona doesn't track (C5.1).
    - `recordCandidate(figure)` and `classifyCandidate` (scaled `BigInt`s, never floats) show each list has exactly one Record_Candidate and meets the Spread_Rule; every candidate has two decimals, is in its Unit_Range_Table range and passes `parseRecallNumber` and the v1 number rule (C5.2, C5.3).
    - `drawSampleSeed` runs once in a mount `useEffect` declared before the `loading` effect, from `crypto.getRandomValues(new Uint32Array(1))`; `pickSamples(candidates, questions, seed)` uses `mulberry32`; the runner dispatches `OPENED` with the samples. Nothing is drawn in render, nothing is stored, and `source-scan.test.ts` passes with no new allow-list entry (C5.4, C5.6).
    - With `getRandomValues` missing, `OPENED` carries no samples and the fields start empty; the seed is never replaced with `Math.random`.
    - While a field holds its Sample_Answer, `sampleNote` shows under it and the primary control is enabled at once (C5.5). The judge can edit, clear or choose "No answer" (C5.7).
    - `sample: true` is set exactly on Kept_Samples; `sampleLabel` shows as "· sample answer" in the row's text colour next to a Kept_Sample in the "Your testimony" rows and on its Receipt_Card, and nowhere else (C5.8, G1.8).
    - No candidate, note, label or persona copy calls any answer right, close, near, wrong, off or accurate, and a Kept_Sample equal to the record renders like any other (C5.9).
    - Live_Letters and Real_Letters get no samples (C5.10).
    - The Fastest_Path is 4 activations for each persona (Next question, Record my answers, break the seal, See the receipts) at 1366×800 and 390×844; more than 4 fails (C5.12).
  - Tests: Property 14 (the Spread_Rule classifier is exact), Property 15 (every stored Sample_Candidate is a valid answer), Property 16 (the Sample_Pick always picks a stored candidate), Property 17 (the Sample_Label marks only Kept_Samples; disclosure rows and Receipt_Cards), Property 23 (each question has exactly one Record_Candidate; the stored candidates); Property 7 extended with samples. Example tests: the seed is drawn in a `useEffect` with a mocked `getRandomValues`; the missing-`getRandomValues` path; the copy strings exactly.
  - Earlier-spec tests changed or retired: `reveal/opening-machine` tests, `RememberedAnswers.test.tsx`, `FigureEntry.test.tsx`, `ReceiptCard.property.test.tsx`, only where samples change an asserted value; name each.
  - Owner_Patches attached: none. J2 needs no change, because it keeps pressing "No answer" (patch ac-5).
  - Copy evidence (G2.8): the `node tools/hooks/tone-check.mjs` result for each changed copy file, and the Retired_Phrase search of the rendered persona pages.
  - QA shots: `recall` of both persona pages with a sample and the Sample_Note, and `figures` and `close` with a Sample_Label, at the five Evidence_Sizes, with and without reduced motion; First_Viewport captures at both Phone_Sizes.
  - QA steps: 10-10, 10-11 (the disclosure and Receipt_Card parts; the Answer_List part runs in task 10), 10-12 (the Fastest_Path at 1366×800 and 390×844 for each persona).
  - QA check: `npm run layout-check -- --require FP1,FC1,GT1` PASS; FP1 reports 4 activations for each persona at 1366×800 and 390×844, and fails above 4. GT1 ignores any element inside `[data-ghost]` (the Envelope's `<p data-date>` lines; ET1 and SG1 cover them) and still covers everything outside the Ghost, measured against the Ghost_Body_Box, not the whole drawing, at the `intact`, `recall`, `letter`, `figures` and `close` Stage starts (not `marks` or `seal`, which AL1 and SG1 own). SI1 runs from `recall` on, never at `intact`.
  - Production_Check: open Maya twice and Tomás twice on `https://revenant.devclef.se`. Pass: each field holds a sample with the Sample_Note at first sight; pressing only the primary controls reaches the figures in 4 presses; a kept sample shows "sample answer" on its Receipt_Card and a changed one does not.
  - Real_Device_Check: on both phones, walk each persona with the samples kept. Pass: 4 taps from the page to the figures, and the labels as above.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: C5.1–C5.12, G1.8_

- [x] 10. C6 · Break the seal at the Ghost: the turned Envelope, the Seal_Group, one orange button, the Answer_List at every size, and Skip focus
  - Agent: `frontend-dev` · Depends on: 9 · Estimated size: ~1,600 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Task 9 is on `main`.
  - Scope: `src/components/ceremony/seal/SealBreak.tsx`, `src/components/ceremony/seal/SealBreak.module.css`, `src/components/ceremony/seal/seal-placement.ts`, `src/components/ceremony/seal/HeldSeal.tsx`, `src/components/ceremony/seal/HeldSeal.module.css`, `src/components/ceremony/seal/skip-link.ts`, `src/components/ui/buttons.module.css` (new), `src/components/ceremony/recall/RecallPager.module.css` (`.cta` to the shared class), `src/components/reveal/Reveal.tsx`, `src/components/reveal/AnswerList.tsx`, `src/components/reveal/reveal.module.css`, `src/components/reveal/OpeningFlow.tsx` (`HeldEnvelope` state), `src/components/ceremony/stages.ts`, `src/components/ceremony/CeremonyRoot.tsx`, `src/components/ceremony/copy.ts`, `src/components/ceremony/constants.ts`, `src/components/ceremony/constants-css.test.ts`, `src/components/ceremony/scene/scene.module.css`, `src/components/ceremony/envelope/**`, `src/components/ceremony/letter/LetterBlock.tsx` (the `data-letter-heading` attribute only), `src/test/retired-phrases.test.ts` (the phrase row), and the `*.test.ts(x)` for each file above
  - Design sections: "Production findings and their causes on `main`" (the seal rows), "C6. Break the seal", "Focus: Load_Entry and Gesture_Entry", "Constants" (`SEAL_GROUP_GAP_PX`, `SEAL_GROUP_WIDTH`, `MARKS_COLUMN_MAX`, `SEAL_ON_FLAP`, `PHONE_SEAL_SIZE`, `ANSWER_TEXT_CLAMP_LINES`), "Copy" (`sealHint`, `skipToLetter`), Owner patch ac-10.
  - Acceptance:
    - In `marks` and `seal` the held Envelope draws `state="turned"` (flap down, no text); `[data-envelope-seal]` sits on the flap at left 50 %, top 55.3 %, width 28 %; the turn uses `ENVELOPE_TURN_*` and is off under Calm and reduced motion (C6.1, C6.2).
    - At 900 px and wider, one `[data-seal-group]` (hint, Seal_Button, Skip_Link) sits `SEAL_GROUP_GAP_PX` (20) outside the Ghost_Body_Box edge facing the Content_Column, centred on the WaxSeal, left-aligned, overlapping neither the body nor the Envelope; the Content_Column is `MARKS_COLUMN_MAX` in `marks` and `seal` (C6.3, C6.8). The PR states the measured positions at 1280×800, 1366×800 and 2560×1440.
    - Below 600 px the group (the WaxSeal at `PHONE_SEAL_SIZE`, the hint, the Seal_Button, the Skip_Link) is the first block after the Step_Indicator row, its top within 24 px of the Ghost_Box's bottom, inside the First_Viewport (C6.1, C6.8).
    - `sealHint` replaces `sealInstruction` and names no position; the hint is fully in view and unclipped (C6.4).
    - The Seal_Button uses `buttons.module.css .primary` (lifted from `.cta`), sits directly under the hint and calls `breakNow`; "See the receipts" uses `.primary` too; "Show everything" keeps the outline style (C6.5).
    - The Skip_Link is quiet text under the Seal_Button, sends `SHOW_ALL` once, reads `skipToReceipts` or, with no figures, `skipToLetter`; focus goes to the Author_Testimony_Heading when the letter has Author_Questions and to the Figures_Heading otherwise, with the `focusHeading` fallback until task 13 builds the heading (C6.6).
    - Stage 1 renders no `StagePanel`; the `stage1Title` heading and the Answer_List sit on the dark (C6.7).
    - The Answer_List renders at every Evidence_Size with Author_Questions first, Text_Answers clamped to `ANSWER_TEXT_CLAMP_LINES` (3) with a 3 px Accent left border, the Sample_Label on Kept_Samples, and `data-user-content` on question and answer; it overlaps no Ghost_Box and no part of the Seal_Group (C6.10, C8.1).
    - The hint passes the contrast test against the brightest light composite at its position.
    - Check hooks: `data-seal-group` on the group; `data-letter-heading` on the Caption_Block `h2`.
    - `src/test/retired-phrases.test.ts` gains "Press and hold the seal to break it, or use the button below." and passes (S3.1).
  - Tests: Property 8 extended (the Skip and break targets), Property 17 extended (the Answer_List at every width), Property 18 (the Answer_List lists every answer, Author_Questions first). Example tests: the CSS-repeated constants in `constants-css.test.ts`; no `StagePanel` at stage 1; the button classes; the copy strings exactly.
  - Earlier-spec tests changed or retired: `seal/SealBreak.test.tsx`, `seal/marks-controls.test.ts`, `seal/seal-placement.test.ts`, `seal/held-seal-placement.test.ts`, `seal/held-seal-render.test.tsx`, `reveal/Reveal.marks.test.tsx`, `scene/topbar-skip-marks.test.tsx`, `AnswerList.test.tsx`; name each with the reason.
  - Owner_Patches attached: ac-10 (`RETIRED_PHRASES` and the hook prompt gain the old `sealInstruction` sentence; J7 too if spec 09 patch n is on `main`).
  - Copy evidence (G2.8): the `node tools/hooks/tone-check.mjs` result for each changed copy file, and the Retired_Phrase search of the rendered persona pages and `/demo/live`.
  - QA shots: `marks` and `seal` of both persona pages and of a Live_Letter with Author_Questions, at the five Evidence_Sizes, with and without reduced motion; First_Viewport captures of `marks` at both Phone_Sizes.
  - QA steps: 10-11, 10-13.
  - QA check: `npm run layout-check -- --require ET1,SG1,AL1,CF1` PASS at every Evidence_Size, with and without reduced motion; GT1 and FP1 still PASS. GT1 ignores any element inside `[data-ghost]` (the Envelope's `<p data-date>` lines and the Seal_Group; ET1 and SG1 cover them) and still covers everything outside the Ghost, measured against the Ghost_Body_Box, not the whole drawing, at the `intact`, `recall`, `letter`, `figures` and `close` Stage starts (not `marks` or `seal`, which AL1 and SG1 own). SI1 runs from `recall` on, never at `intact`.
  - Production_Check: on `https://revenant.devclef.se/demo/personas/us-maya` at 2560×1440, 1366×800 and 390×844, reach "Break the seal". Pass: the seal sits on the back of the envelope and covers no text; the hint is left-aligned beside the Ghost with no "below"; the orange "Break the seal" button is under it with "Skip to the receipts" under that; the answers are listed in the column.
  - Real_Device_Check: on both phones, press and hold the seal on one persona and tap the button on the other. Pass: seal, hint and button are on the first screen, under the small Ghost, and both ways break the seal.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: C6.1–C6.11, C8.1, S3.1, S3.3_

### Group P: persona letters with the price

- [ ] 11. P1, P2 · Persona letters that carry the price, and new letter IDs
  - Agent: `frontend-dev` · Depends on: 9 · Estimated size: ~600 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Task 9 is on `main` (`recordCandidate`). The owner has written the copy-test reviewer's name into this issue's body, and has checked that the GitOps values keep `demo.sealPersonas: true` (or plans the manual seal in the P2 deploy order).
  - Scope: `content/personas/letters/us-maya.txt`, `content/personas/letters/eu-tomas.txt`, `content/personas/letters/us-copy-test.md`, `content/personas/letters/eu-copy-test.md`, `content/personas/personas.json`, `src/lib/personas/letter-checks.ts`, `src/lib/personas/price-lines.ts` (new), `src/lib/personas/index.ts`, `src/lib/personas/letter-prices.test.ts` (new), and the `*.test.ts(x)` for each file above, including `src/lib/personas/intro-line.test.ts` and `index.test.ts`, which name the current letter IDs
  - Design sections: "P1. Persona letters", "P2. New letter IDs", "P2. Reseal and deploy order (P2.2)", "Persona_List after X4 and P2".
  - Acceptance:
    - Maya's letter gains the regular line after "…the station by the bridge." and the diesel line "The radio put diesel at about $3.89 a gallon this week, which is what the van runs on." directly after "…the broken scones on the way home."; Tomás's letter gains the two sentences after "…has become a monthly habit."; everything else in both letters is unchanged (P1.1, P1.7).
    - Each line states the official average heard on the news or the radio, never a station sign or a price paid, with "about" and exactly two decimals, and says nothing about whether the price is high, low, rising or falling (P1.1, P1.2, P1.6).
    - `checkLetterText(key, text, prices)` matches `PRICE_RE`; the matches equal `expectedPrices` exactly, each tracked figure once; with them removed, the text has no digit, `$`, `€`, `£` or currency word (P1.3, P1.4). The R1.10 term check and the length checks are unchanged (P1.5).
    - `expectedPrices(payload)` calls `recordCandidate`, so the Letter_Price_Line and the Record_Candidate are the same number. `letter-prices.test.ts` takes each persona's Then_Figures with `thenAndNow(metric_id, written_as_of, DEMO_FIGURES)` and imports nothing from `scripts/` (P1.3).
    - Both copy-test records gain a review entry with the reviewer's name from this issue's body (P1.5).
    - Each persona gets a fresh 22-character `letter_id` from `randomBytes(16).toString("base64url")`, checked against `retired_letter_ids`; `ydsos6hcjdEUOs3sK42RQg` and `8t6Bz4bWlaUky-byt1mzGg` join `retired_letter_ids` (P2.1). Tests that named the old IDs read them from the Persona_List instead.
    - The payloads stay version 1 with Figure_Questions only (P2.4). No `scripts/seal-personas*` change; if one turns out to be needed, the PR stops and the owner opens a crypto-dev task (P2.5).
    - The old rows stay in the database (P2.3).
  - Tests: Property 21 (a persona letter holds exactly its prices); Property 23 extended (`expectedPrices` gives the Record_Candidate). Example test: `letter-prices.test.ts` on both letter files.
  - Earlier-spec tests changed or retired: the spec 03 R1.8 cases in `letter-checks.test.ts` and `letter-checks.property.test.ts` (replaced by P1); `eu-letter.test.ts`; `intro-line.test.ts` and `index.test.ts` (the letter IDs); name each with the reason.
  - Owner_Patches attached: none.
  - Copy evidence (G2.8): the `node tools/hooks/tone-check.mjs` result for both letter files, and the `neutrality.md` copy test of the four sentences with the reviewer's name.
  - QA shots: `letter` of both persona pages at the five Evidence_Sizes, with and without reduced motion; First_Viewport captures at both Phone_Sizes.
  - QA steps: 10-16.
  - QA check: `npm run layout-check -- --require GT1,FP1` still PASS on both persona pages. GT1 ignores any element inside `[data-ghost]` (the Envelope's `<p data-date>` lines and the Seal_Group; ET1 and SG1 cover them) and still covers everything outside the Ghost, measured against the Ghost_Body_Box, not the whole drawing, at the `intact`, `recall`, `letter`, `figures` and `close` Stage starts (not `marks` or `seal`, which AL1 and SG1 own). SI1 runs from `recall` on, never at `intact`.
  - Deploy order (P2.2), by the owner after the merge, recorded in this issue: (1) CI builds `ghcr.io/devclef/revenant:<sha>`; (2) the owner confirms `demo.sealPersonas: true` in the GitOps values and moves the image tag to `<sha>`; (3) the new pod's `migrate` init container runs the migrations and the Sealing_Script, which stores both new rows before the web container starts, while the old pod keeps serving the old IDs; (4) if sealing fails, the new pod never becomes ready and the old pod keeps serving; (5) the owner records `kubectl logs <pod> -c migrate` (one result line per persona, no secret). If the values set `demo.sealPersonas: false`, the owner first runs `kubectl run seal-personas-<sha> --rm -i --restart=Never --image=ghcr.io/devclef/revenant:<sha> --env-from=secret/<existingSecret> -- node scripts/seal-personas.mjs`, checks both `stored` lines, then moves the tag.
  - Production_Check: after the rollout, open both persona pages on `https://revenant.devclef.se` through to `close`. Pass: the page loads the new letter IDs; Maya's letter shows "$3.64" and "$3.89" once each, Tomás's "€1.79" and "€1.65" once each; no other digit.
  - Real_Device_Check: on both phones, open both personas to `close`. Pass: the letters read as above and the flow completes.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: P1.1–P1.7, P2.1–P2.5_

### Group C, continued

- [ ] 12. C7 · The other Stages: the Ghost clear of text, controls next to what they act on, no empty cards
  - Agent: `frontend-dev` · Depends on: 10 · Estimated size: ~600 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Task 10 is on `main`.
  - Scope: `src/components/reveal/Reveal.tsx`, `src/components/reveal/reveal.module.css`, `src/components/reveal/StagePanel.tsx`, `src/components/ceremony/ceremony.module.css`, `src/components/ceremony/scene/scene.module.css`, `src/components/ceremony/recall/RecallPager.module.css`, `src/components/ceremony/letter/LetterBlock.module.css`, `src/components/ceremony/figures/figures.module.css`, `src/components/ceremony/close/**`, and the `*.test.ts(x)` for each file above
  - Design sections: "C7. The other Stages", "Letters with no figures" (the `letter` row).
  - Acceptance:
    - In `recall`, `letter`, `figures` and `close`, the Ghost_Box overlaps no text box, field or control at any Evidence_Size, with and without reduced motion (C7.1).
    - Each control sits within 48 px of what it acts on, or directly under it in the Content_Column (C7.2).
    - No Stage renders a card more than 48 px taller than its content, or a card that holds only controls (C7.3).
    - The PR lists each problem found per Stage and size, starting from the design's C7 table, with a before and after screenshot each (C7.4).
    - Layout and attributes only: no copy, state or event changes.
  - Tests: CSS rule tests for any value this task changes.
  - Earlier-spec tests changed or retired: any layout test whose asserted value changes; name each.
  - Owner_Patches attached: none.
  - QA shots: `recall`, `letter`, `figures` and `close` of both persona pages and of a Live_Letter, at the five Evidence_Sizes, with and without reduced motion, before and after; First_Viewport captures at both Phone_Sizes.
  - QA steps: 10-15.
  - QA check: `npm run layout-check -- --require GT1,CF1` PASS in `recall`, `letter`, `figures` and `close` at every Evidence_Size, with and without reduced motion; ET1, SG1 and AL1 still PASS. GT1 ignores any element inside `[data-ghost]` (the Envelope's `<p data-date>` lines and the Seal_Group; ET1 and SG1 cover them) and still covers everything outside the Ghost, measured against the Ghost_Body_Box, not the whole drawing, at the `intact`, `recall`, `letter`, `figures` and `close` Stage starts (not `marks` or `seal`, which AL1 and SG1 own). SI1 runs from `recall` on, never at `intact`.
  - Production_Check: walk both personas from the first question to `close` on `https://revenant.devclef.se` at 2560×1440, 1366×800 and 390×844. Pass: no text or control under the Ghost; no empty card; each control next to what it acts on.
  - Real_Device_Check: on both phones, walk both personas to `close`. Pass: as above.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: C7.1–C7.5_

- [ ] 13. C8 · The Author_Testimony above the letter, and the Reveal for a letter with no figures
  - Agent: `frontend-dev` · Depends on: 12 · Estimated size: ~1,000 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Task 12 is on `main`.
  - Scope: `src/components/reveal/AuthorTestimony.tsx` (new), `src/components/reveal/Reveal.tsx`, `src/components/reveal/reveal.module.css`, `src/components/reveal/copy.ts`, `src/components/ceremony/stages.ts`, `src/components/ceremony/CeremonyRoot.tsx`, `src/components/ceremony/letter/LetterBlock.tsx`, `src/components/ceremony/close/**`, and the `*.test.ts(x)` for each file above
  - Design sections: "C8. The Reveal", "Letters with no figures (C2.13, C8.9)", "Stages and steps", "Copy" (`authorTestimonyTitle`, `saidJustNow`).
  - Acceptance:
    - `AuthorTestimony` (`data-author-testimony`) renders in the `letter` column above `LetterBlock` from stage 2 on, only when the payload has a `"text"` question: the `h2` `authorTestimonyTitle` with `tabindex="-1"` and `data-author-testimony-heading`, then for each Author_Question in payload order the question text, `saidJustNow`, and the Text_Answer in full or "No answer" (C8.2, C8.6).
    - Question and answer are React text nodes inside `data-user-content` elements, with line breaks kept by `pre-wrap`; never `dangerouslySetInnerHTML` (C8.5, C8.8).
    - The paper keeps the Letter_Text as its one unchanged text node; nothing links, quotes, highlights or measures between the testimony and the letter (C8.3, C8.4).
    - The order stays testimony, the letter, then the numbers (C8.7).
    - With no figures: no `useFigures()` call, no "See the receipts", no "Show everything", no Figures_Heading, no figures list; `stageFor` resolves stages 2 and 3 to `close`; Close renders with the letter; Skip reads `skipToLetter`; focus goes to the Author_Testimony_Heading or `letter-heading` per the design's table (C8.9).
    - Skip from `marks` now focuses the Author_Testimony_Heading for a letter with Author_Questions, with no fallback needed.
  - Tests: Property 19 (the Author_Testimony shows the words as given); Property 9 extended (no figures). Example tests: a `Reveal` render with a 0-figure payload and two text questions makes no figures request and reaches `close` (the opening half of QA 10-08); the copy strings exactly.
  - Earlier-spec tests changed or retired: `reveal/Reveal` tests, `ceremony/letter/LetterBlock.test.tsx`, `close/Close.test.tsx`; name each with the reason.
  - Owner_Patches attached: none.
  - Copy evidence (G2.8): the `node tools/hooks/tone-check.mjs` result for each changed copy file, and the Retired_Phrase search of the rendered `letter` and `close` Stages outside User_Content.
  - QA shots: `letter`, `figures` and `close` of a Live_Letter with two Author_Questions and of both persona pages (no block), at the five Evidence_Sizes, with and without reduced motion; First_Viewport captures at both Phone_Sizes.
  - QA steps: 10-14, 10-19, 10-20.
  - QA check: `npm run layout-check -- --require GT1,CF1` PASS; NEUTRALITY reports no hit from a Text_Answer containing "better!". GT1 ignores any element inside `[data-ghost]` (the Envelope's `<p data-date>` lines and the Seal_Group; ET1 and SG1 cover them) and still covers everything outside the Ghost, measured against the Ghost_Body_Box, not the whole drawing, at the `intact`, `recall`, `letter`, `figures` and `close` Stage starts (not `marks` or `seal`, which AL1 and SG1 own). SI1 runs from `recall` on, never at `intact`.
  - Production_Check: on `https://revenant.devclef.se/demo/live`, seal with two questions, answer one with three lines and mark the other "No answer", break the seal. Pass: "Questions you left for yourself" above the paper with each question, "What you said just now", the three lines with their breaks, and "No answer"; the paper holds only the letter. Press "Skip to the receipts" on a second letter: focus lands on that heading.
  - Real_Device_Check: on both phones, the same flow. Pass: the block reads in full above the letter and stays open at the receipts.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: C8.2–C8.9_

- [ ] 14. C9 · The live demo payoff: your own question first, then the letter, then the figures
  - Agent: `frontend-dev` · Depends on: 13 · Estimated size: ~400 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Task 13 is on `main`.
  - Scope: `src/components/live/stepper/**`, `src/components/live/LiveLetter.tsx`, `src/components/live/LiveLockNote.tsx` (layout only; the text is unchanged), `src/components/live/live.module.css`, `src/components/reveal/Reveal.tsx` (only if the live order needs it), and the `*.test.ts(x)` for each file above
  - Design sections: "C9. The live demo payoff", "C8. The Reveal".
  - Acceptance:
    - The `/demo/live` Write step offers the Author_Question rows and the Question_Starters, starting with the Live_Prefill row built in task 8; a removed or cleared row seals no question (C9.1, C9.5).
    - A Live_Letter with Author_Questions asks them first, then the Figure_Questions (C9.2).
    - The Receipts step leads with the Answer_List at `marks`, then the Author_Testimony and the letter, then the figures (C9.3).
    - `LIVE_COPY.lockNote` is unchanged: it states the 30-second lock without judgement and points to the persona letters (C9.4).
  - Tests: an end-to-end render test of the Live_Stepper from Write to Receipts with the Live_Prefill kept, a starter added and one row removed: the order of the Testify questions and of the Receipts blocks; the lock note text.
  - Earlier-spec tests changed or retired: `live/LiveLetter.test.tsx`, `live/LiveLockNote.test.tsx`, `live/stepper` tests, only where the receipts order changes; name each.
  - Owner_Patches attached: none.
  - QA shots: every step of `/demo/live` from Write to Receipts with the Live_Prefill kept, at the five Evidence_Sizes, with and without reduced motion; First_Viewport captures of every step at both Phone_Sizes.
  - QA steps: 10-17.
  - QA check: `npm run layout-check -- --require GT1,CF1,SG1` PASS on `/demo/live`. GT1 ignores any element inside `[data-ghost]` (the Envelope's `<p data-date>` lines and the Seal_Group; ET1 and SG1 cover them) and still covers everything outside the Ghost, measured against the Ghost_Body_Box, not the whole drawing, at the `intact`, `recall`, `letter`, `figures` and `close` Stage starts (not `marks` or `seal`, which AL1 and SG1 own). SI1 runs from `recall` on, never at `intact`.
  - Production_Check: on `https://revenant.devclef.se/demo/live`, keep the Live_Prefill, seal, wait, unlock, answer. Pass: the question is asked first; the receipts lead with the answers, then the testimony and the letter, then the figures; the lock note is unchanged.
  - Real_Device_Check: on both phones, the same flow with the phone's passkey. Pass: as above, each step on one screen.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: C9.1–C9.5_

### Group R: self-reported numbers

- [ ] 15. R1 · Self-reported numbers on the Write step and in the Reveal (spec 08 later-tasks task 23, moved in)
  - Agent: `frontend-dev` · Depends on: 14 · Estimated size: ~1,500 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Task 14 is on `main`. This task replaces spec 08 `later-tasks.md` task 23 and its dependency on spec 08 task 22; it ships (R1.1).
  - Scope: `src/components/live/SelfReportedRows.tsx` (new), `src/components/live/WriteForm.tsx`, `src/components/live/write-draft.ts`, `src/components/live/form.ts`, `src/components/live/build-payload.ts`, `src/components/live/seal-runner.ts`, `src/components/live/copy.ts`, `src/components/live/live.module.css`, `src/components/reveal/FiguresThenNow.tsx`, `src/components/reveal/copy.ts`, `src/components/reveal/reveal.module.css`, `src/components/ceremony/scene/copy.ts` (landing wording, only as spec 08 R26.5 allows), and the `*.test.ts(x)` for each file above
  - Design sections: "R1. Self-reported numbers", "Data Models" (Write draft), "Copy" (`selfReportedTitle`, the spec 08 self-reported strings); spec 08 design "Self-reported numbers".
  - Acceptance:
    - The "Your own numbers" group renders after `AuthorQuestions` with 0 to 10 rows, each with name, value (0 to 999,999,999, at most 4 decimal places), unit and region (1 to 60 characters each) and period (a month or a date no later than the sealing day) (spec 08 R26.1, applied without condition; R1.1, R1.2).
    - An empty or out-of-bounds field gets a message saying what is allowed, after touch or a seal attempt; every value is kept; sealing is blocked until the field is fixed or the row removed (spec 08 R26.2).
    - The rows live in the same mounted draft as the questions and survive Back, Next and Try again (R1.2).
    - `build-payload.ts` writes each row as a metric `self-<n>` with `source: "self-reported"` and a `kind: "self-reported"` figure with the value, unit, region and period as typed after trimming, no recall question, and no new `format_version` (R1.3, spec 08 R26.3, R26.6).
    - Self-reported figures never count toward the figure minimum, and are not passed to `useFigures` lookups (R1.5).
    - The Reveal lists them after the official figures under "Your own numbers", each labelled "self-reported" next to its value, with its period, no now value, no change and no Number_Line, after the Author_Testimony and the letter; the fields carry `data-user-content` (R1.4, spec 08 R26.4).
    - The landing copy names rent and groceries only as numbers the user enters, labelled self-reported (spec 08 R26.5).
  - Tests: Property 22 (self-reported numbers are validated and sealed as typed); Property 5 extended (the self-reported rows survive every way back); Property 6 extended (self-reported figures never change the minimum).
  - Earlier-spec tests changed or retired: `live/build-payload.property.test.ts`, `write-validation.property.test.ts`, `reveal/FiguresThenNow.test.tsx`, only where the new rows change an asserted value; name each.
  - Owner_Patches attached: none. Spec 08 patch m (README line 20) is folded into patch ah, attached to task 16.
  - Copy evidence (G2.8): the `node tools/hooks/tone-check.mjs` result for each changed copy file, and the Retired_Phrase search of the rendered `/demo/live` and `/seal`.
  - QA shots: the Write step of `/demo/live` and `/seal` with self-reported rows (valid and invalid), and `close` with "Your own numbers", at the five Evidence_Sizes, with and without reduced motion; First_Viewport captures at both Phone_Sizes.
  - QA steps: 10-18.
  - QA check: spec 08 B1 `figure-boxes` PASS with the self-reported group shown; `npm run layout-check -- --require GT1,CF1` PASS; NEUTRALITY reports no hit from a self-reported field. GT1 ignores any element inside `[data-ghost]` (the Envelope's `<p data-date>` lines and the Seal_Group; ET1 and SG1 cover them) and still covers everything outside the Ghost, measured against the Ghost_Body_Box, not the whole drawing, at the `intact`, `recall`, `letter`, `figures` and `close` Stage starts (not `marks` or `seal`, which AL1 and SG1 own). SI1 runs from `recall` on, never at `intact`.
  - Production_Check: on `https://revenant.devclef.se/demo/live`, add two own numbers, one invalid, fix it, seal, wait, unlock. Pass: messages only after touch; sealing blocked until fixed; "Your own numbers" after the official figures, each "self-reported", with its period and no now value or change.
  - Real_Device_Check: on both phones, the same flow. Pass: as above, the rows usable with the on-screen keyboard.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: R1.1–R1.5_

### Group E: final audit and presentation

- [ ] 16. E1 · Promise audit, no trace of the retired persona IDs, and the presentation patches
  - Agent: `frontend-dev` · Depends on: 11, 15 · Estimated size: ~300 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`). Tasks 1 to 15 merged, or closed unmerged with the reason (G3.7). The 20 November decision is recorded. Spec 09 patches o, t, u and v are on `main`.
  - Scope: the frontend-dev copy modules (`src/components/**/copy.ts`), `src/app/opengraph-image.tsx` (only if it names a retired ID), `src/components/retired-ids-scan.test.ts` (new), any `*.test.ts(x)` that names `ydsos6hcjdEUOs3sK42RQg` or `8t6Bz4bWlaUky-byt1mzGg`, and the `*.test.ts(x)` for each copy module changed
  - Design sections: Owner patches ah and ai; "Persona_List after X4 and P2".
  - Acceptance:
    - The PR lists every user-facing claim about Author_Questions, sample answers, self-reported numbers and real sealing in the copy modules, the landing page, the How_Page, the README, `docs/kiro-writeup.md` and `docs/video-script.md`, against the merged code on `main` that makes it true, and fixes or removes each that isn't (E1.1).
    - Every surface that describes self-reported numbers matches the merged task 15 code (E1.2).
    - Patch ah edits the README judge box, ritual steps, persona line and line 20, `docs/kiro-writeup.md` and `docs/video-script.md` in place on top of spec 09 patches t, u and v, without re-creating them; the video script's 1:30 beat shows writing a question, waiting 30 seconds, answering it again and seeing it beside the letter (E1.3). If a task closed unmerged, every line of ah that describes it is dropped first (G3.7).
    - A search of the README, `docs/video-script.md`, `docs/kiro-writeup.md`, the Open Graph image, every test and every QA step finds neither of the two letter IDs this spec retires, `ydsos6hcjdEUOs3sK42RQg` and `8t6Bz4bWlaUky-byt1mzGg`, apart from the `retired_letter_ids` entries and the tests that read that list. Hits in role paths are fixed in this PR; hits in owner-only files are listed in the PR under Owner_Patch ah for the owner (E1.4).
    - The search covers only those two IDs. Older entries of `retired_letter_ids`, such as `wom_GdH6gqP6AGgnyhIMgA`, are ordinary test fixtures and are not searched.
    - `src/components/retired-ids-scan.test.ts` reads letter IDs only: it takes `ydsos6hcjdEUOs3sK42RQg` and `8t6Bz4bWlaUky-byt1mzGg` from `retired_letter_ids` in the Persona_List and fails if any non-test file under `src/` or `content/`, other than `personas.json`, contains either.
    - On a real-sealing no-go, nothing promises real sealing (spec 08 R25.2).
  - Tests: the retired-ID scan; a copy scan for wording that depends on a task closed unmerged or on the no-go, matched to the recorded decisions.
  - Earlier-spec tests changed or retired: copy tests of any module whose wording changes; tests that named a retired ID; name each.
  - Owner_Patches attached: ah (README, `docs/kiro-writeup.md`, `docs/video-script.md`; E1.3), ai (`tools/qa/layout-check.mjs` and `.kiro/agents/prompts/qa.md`: the walk's before-and-after branches removed, so a Pick_Up_Button, `[data-ceremony="intact"]` or an empty persona field is a BLOCKER, and GT1 no longer prints a note below 600 px for a pick-up build).
  - Copy evidence (G2.8): the `node tools/hooks/tone-check.mjs` result for each changed copy file, and the Retired_Phrase search of every page this PR changes.
  - QA shots: `/`, `/how-it-is-sealed` and any other page whose copy this PR changes, at the five Evidence_Sizes.
  - QA steps: 10-03, 10-04 and 10-12, as a final pass. After the owner commits patch ai, the owner runs `npm run layout-check -- --require FC1,FP1,GT1` once on a local build of `main` and records the result in this issue. GT1 ignores any element inside `[data-ghost]` (the Envelope's `<p data-date>` lines and the Seal_Group; ET1 and SG1 cover them) and still covers everything outside the Ghost, measured against the Ghost_Body_Box, not the whole drawing, at the `intact`, `recall`, `letter`, `figures` and `close` Stage starts (not `marks` or `seal`, which AL1 and SG1 own). SI1 runs from `recall` on, never at `intact`.
  - Production_Check: none required for group E. If this PR changes copy on screen, open each changed page on `https://revenant.devclef.se` and check the new wording.
  - Real_Device_Check: only if this PR changes copy on screen; then open the changed pages on both phones.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: E1.1–E1.4, G3.7_

### Group O: operations

- [x] 17. O1 · A diagnosable figures failure: one safe log line in the Figures_API catch
  - Agent: `data-dev` · Depends on: 1 · Estimated size: ~150 changed lines
  - Before this task: steering updated (S1 Owner_Patch on `main`).
  - Order: this task is an exception to the design's "nothing in `src/app/api/**` changes" and to G3.1's "Group E comes last", per requirements O1 and "Rules this spec replaces". It runs right after task 1 and is independent of every other task.
  - Scope: `src/app/api/figures/respond.ts`, `src/app/api/figures/db-response.ts` (only if the reads and the shaping must be split), and their `*.test.ts`
  - Background: on 8 November 2026 `/api/figures` returned 500 on production for several hours and recovered after a pod restart. Postgres logged no error, the data and the query were fine, and `/api/letters` kept working on the same pod. The catch discards the error, so the cause can't be found.
  - Acceptance:
    - Inside the existing catch, one `console.error` line names the step, the error's `name`, and its Postgres `code` if it has a string one (O1.1).
    - The step is `read` for `deps.readStore()` and the two store queries `latestFigures()` and `lastSuccessTimes()`, and `shape` for building the response (O1.2).
    - The line never contains the error's message, stack or cause, or any other value from the error or the request, because they can carry the connection string (O1.3).
    - The response stays exactly HTTP 500, `{"error":"figures_unavailable"}`, `Cache-Control: no-store` (O1.4).
    - A failed read never falls back to the bundled file and never returns a partial list (O1.5).
    - `buildDbFiguresResponse` may be split into a read step and a shape step; its behaviour is otherwise unchanged (O1.6).
    - File mode is unchanged (O1.8).
  - Tests: each step logs its label: a throwing `readStore()`, a throwing `latestFigures()` and a throwing `lastSuccessTimes()` log `read`, and a throwing shape step logs `shape`. An error with a string `code` logs it, and one without logs no code. A thrown error whose message contains a fake `DATABASE_URL` such as `postgres://user:secret@host/db` appears in neither the logged line nor the response body or headers. Exactly one log line per failure. The existing respond, route and db-response tests still pass (O1.7).
  - Earlier-spec tests changed or retired: name any, with the reason.
  - Owner_Patches attached: none.
  - QA shots: none (no screen change). QA steps: none. QA check: none.
  - Production_Check: after the deploy, `curl -sS -o /dev/null -w '%{http_code}' https://revenant.devclef.se/api/figures` prints 200. If a 500 recurs, the owner reads the pod log (`kubectl logs <pod> -c web`, or the container name the chart uses) and records the logged step, name and code in this issue.
  - Real_Device_Check: none.
  - Validation: `bash scripts/check.sh`; route budgets from `node scripts/check-js-budget.mjs` after `npm run build`.
  - _Requirements: O1.1–O1.8_

## Notes

- **Order.** The dispatcher claims the lowest-numbered ready issue whose dependencies are closed, one per role at a time. Task 1 is never claimed (`agent:owner`); closing it releases tasks 2 (platform-dev), 3 (frontend-dev) and 17 (data-dev), which share no file. Task 17 is the only data-dev task, so the dispatcher claims it at once, alongside tasks 2 and 3, although it carries the last number; group E (task 16) still comes last among the other groups. Tasks 3 to 16 are all frontend-dev and form one chain, because they share `reveal/`, `ceremony/`, `live/`, the copy modules and `src/test/retired-phrases.test.ts`. Task 11 depends on task 9 only, as the design's Task outline gives it; when task 10 merges, the dispatcher takes task 11 before task 12 because it has the lower number.
- **Dates.** Groups S and X (tasks 1 to 4) merged by 13 November 2026. Real sealing go or no-go on 20 November 2026, unchanged. Feature freeze 27 November 2026. Submission 4 December 2026, 2:00 PM PT.
- **Deploy holds.** None between the Write step questions and Testify: tasks 6 and 7 put Recall_Record_V2 and the text field on production before task 8 lets the Write step seal a text question (G3.1). The one ordered deploy is the persona reseal in task 11 (P2.2).
- **QA rows by task.** 10-01 and 10-02 (task 3); 10-03 (4); 10-04 and 10-05 (5); 10-06 to 10-09 (8; 10-08 is sealing only); 10-10, 10-11 and 10-12 (9; 10-11 again in 10); 10-13 (10); 10-16 (11); 10-15 (12); 10-14, 10-19 and 10-20 (13); 10-17 (14); 10-18 (15).
- **Layout checks by task.** TK1, SI1 and GT1 from task 3; FC1 from task 5; FP1 from task 9; ET1, SG1, AL1 and CF1 from task 10. Patch ad lands them in task 1, BLOCKER only with `--require`.
- **Owner_Patches by task.** z, aa, ab, the task 1 part of ac, ad, af and ag: task 1. ae: task 3. ac-4: task 4. ac-5 (with the J2 change when task 5's image goes live, if spec 09 patch n is on `main`): task 5. ac-10: task 10. ah and ai: task 16. Each Retired_Phrase joins `RETIRED_PHRASES` and the hook in the same task that removes it, as it joins `src/test/retired-phrases.test.ts`.
- **Property coverage.** 1 (task 2); 2, 3, 4 (task 8); 5 and 6 (tasks 8 and 15); 7 (tasks 5, 6 and 9); 8 (tasks 5 and 10); 9 (tasks 5 and 13); 10 to 13 (task 6); 14, 15, 16 (task 9); 17 (tasks 9 and 10); 18 (task 10); 19 (task 13); 20 (task 3); 21 (task 11); 22 (task 15); 23 (tasks 9 and 11).
- **The Live_Prefill.** The design's Task outline lists the Live_Prefill under task 14 (C9), but its `initialWriteDraft` code, Property 2 and QA 10-06 put the row in task 8 (C2). Task 8 builds it; task 14 checks it end to end with the receipts order.
- **No optional tasks.** Every task is required, and every property the design lists is a required test in the task that names it.

## Task Dependency Graph

Dependencies: 1 has none; 2 after 1; 3 after 1; 4 after 2 and 3; 5 after 4; 6 after 5; 7 after 6; 8 after 7; 9 after 8; 10 after 9; 11 after 9; 12 after 10; 13 after 12; 14 after 13; 15 after 14; 16 after 11 and 15; 17 after 1.

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2", "3", "17"] },
    { "id": 2, "tasks": ["4"] },
    { "id": 3, "tasks": ["5"] },
    { "id": 4, "tasks": ["6"] },
    { "id": 5, "tasks": ["7"] },
    { "id": 6, "tasks": ["8"] },
    { "id": 7, "tasks": ["9"] },
    { "id": 8, "tasks": ["10"] },
    { "id": 9, "tasks": ["11"] },
    { "id": 10, "tasks": ["12"] },
    { "id": 11, "tasks": ["13"] },
    { "id": 12, "tasks": ["14"] },
    { "id": 13, "tasks": ["15"] },
    { "id": 14, "tasks": ["16"] }
  ]
}
```
