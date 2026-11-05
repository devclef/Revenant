# Implementation Plan: 08 Judge polish

## Overview

Spec 08 fixes what the owner found walking the site as a judge after spec 07, then adds the product work wanted before judging ends: the daily figure fetch with a freshness alert, an EU persona, thin real sealing, and self-reported numbers if time allows. The tasks follow the R31 build order in seven groups, and every task in a lower group has a lower number:

| Group | Tasks | What | Roles |
|---|---|---|---|
| 1 | 1 to 3 | Reveal fixes and layout checks (R2 to R8, R27, R32) | frontend-dev |
| 2 | 4, 5 | Landing Ghost (R9) | frontend-dev, platform-dev |
| 3 | 6 to 13 | Copy, labels, dates and metadata (R10 to R19, R23, R28, R29) | data-dev, crypto-dev, frontend-dev, platform-dev |
| 4 | 14 to 17 | Daily fetch and freshness alert (R20, R21) | data-dev, frontend-dev, platform-dev |
| 5 | 18, 19 | EU persona (R22) | frontend-dev, crypto-dev |
| 6 | 20 to 22 | Real sealing behind a flag (R24, R25) | platform-dev, crypto-dev, frontend-dev |
| 7 | none here; tasks 23 and 24 are in `later-tasks.md` | Self-reported numbers if time allows (R26), and the final audit refresh | frontend-dev |

Each task is one GitHub issue (template `.github/ISSUE_TEMPLATE/agent-task.md`) worked by one role agent, and leaves `main` passing the CI gate. Each PR stays under `max_changed_lines` (5,000) as `.github/agents.json` counts it (test files, `package-lock.json` and `drizzle/meta/**` excluded; deletions count) and inside its role's paths plus `shared` (`package.json`, `package-lock.json`, `.env.example`) (R1.1, R31.2). Where a requirement spans roles (R9, R14, R20, R21, R24), it is split so each task stays inside one role (R31.3).

Follow `design.md` in this folder for every file name, constant, interface, value and algorithm, and `requirements.md` for the rules. The language is TypeScript (strict), except `scripts/fetch-figures-freshness.mjs`, which is plain ESM JavaScript on Node 22 built-ins. Follow `tone.md`, `neutrality.md`, `data-integrity.md`, `tech.md` and, for crypto-dev, `crypto.md` in `.kiro/steering/`. Every rule of specs 02 to 07 still holds unless requirements.md "Rules this spec replaces" names it.

"Depends on" lists only spec 08 task numbers. "Before this task" lists what else must be on `main` first: earlier tasks, Owner_Patches the owner has committed, and milestone gates. Owner decisions appear as gates, not tasks.

Two owner changes are already on `main` before any task starts; the owner commits them first. Owner_Patch a (`tools/qa/layout-check.mjs`) gives QA the spec 08 layout checks, so no task attaches it. The README Sweden lines are in place: line 20 (the figures sentence of "The ritual", which also drops "groceries, rent") names fuel prices for the US or the EU and has no self-reported clause, and line 46 (the persona demo line) names only a recent US election window. The README already passes the R23.3 search; Owner_Patch f now holds only the "Status" section and the sentence on depending on the Revenant server.

Tasks 23 and 24 (group 7) are in `later-tasks.md`, which spec-sync does not read. The owner moves each into this file when its time comes.

## Milestone gates

| Date (end of day, UTC unless stated) | Gate | Requirement | Effect on tasks |
|---|---|---|---|
| 16 November 2026, 23:59:59 UTC | Fetch decision. Owner_Patch h (`refresh-figures.yml`, the Fallback_Refresh) has only `workflow_dispatch` until the switch. Patch h's push uses `GITHUB_TOKEN`, which starts no workflow, so after the push the workflow runs `gh workflow run ci.yml --ref main`, with permissions `contents: write` and `actions: write`. This assumes `build.yml`'s `workflow_run` trigger (`workflows: [ci]`, `branches: [main]`) fires for that dispatched `ci` run. Owner steps, in this order: (a) commit patch h after task 14 merges, because its commit step adds `fetch-status.json`, which task 14 creates; (b) run `refresh-figures` by hand once before 16 November 2026, confirm a new image tag appears in GHCR, and roll out the new image on the cluster (the `dev` tag needs `image.pullPolicy: Always` and a pod restart, per `deploy.md`); (c) if task 16 is not merged, or no Fetch_Job run on `revenant.devclef.se` has exited 0, the gate triggers: add back `schedule: - cron: "30 6 * * *"` to patch h and set `figures.source: file` in the GitOps values. No Fleet config goes in this repo. | R21.1 | Task 14 ships the file-mode backend and the fallback-ready `prefetch` first, so the switch needs no code. No reveal task moves later to make room for fetch work. |
| 20 November 2026 | Real sealing go or no-go, recorded by the owner in the task 22 issue. Go only if every R24 test passes in `bash scripts/check.sh` and the owner has sealed one Real_Letter on `revenant.devclef.se` and checked its countdown. | R25.1 | On go, tasks 21 and 22 merge. Production then runs a `v*` version tag, not `dev`, because `deploy.md` says `dev` must not serve an installation that holds real letters: the owner cuts the tag and pins `image.tag` to it in the GitOps values before setting `realSealing: true`. On no-go, task 20 stays merged with the flag off, any open PR of task 21 or 22 is closed unmerged (a merged one stays behind the off flag), and task 24 (in `later-tasks.md`) confirms no copy promises real sealing (R19.5, R25.2). |
| 27 November 2026 | Feature freeze. Every task in groups 1 to 5 (tasks 1 to 19) is merged. A group 1 to 5 task not merged by the end of the day is closed unmerged, and task 24 (in `later-tasks.md`) removes every claim that depends on it. Task 23 (in `later-tasks.md`) ships only if merged by this date; otherwise nothing mentions self-reported numbers. | R31.5, R31.6, R26.7 | After this date only task 24, moved in from `later-tasks.md`, and fixes merge. |
| 4 December 2026, 2:00 PM PT | Submission deadline. Task 24 (moved in from `later-tasks.md`), with the refreshed Owner_Patch g, is the last task. | Decisions | |
| 29 January 2027, 23:59:59 PT | End of judging. The Freshness_Check, the keepalive workflow and the site keep running until then. | R21.14, R21.16 | |

## Rules for every task

- **Branch and PR.** The dispatcher creates the branch `agent/<role>/issue-N` and the PR "Closes #N". Do not push to `main`. Do not merge. Do not amend commits after a hook failure; make a new commit.
- **Stay inside Scope (R1.1, R1.8).** Change only files that are both matched by your role's paths in `.github/agents.json` (or the `shared` list) and listed under the task's Scope, plus new `*.test.ts(x)` files next to the code they test. Paths that match your role's globs but are not in your Scope are not yours. Check your own diff before you finish. The role paths are:
  - `frontend-dev`: `src/app/**/*.tsx`, `src/app/**/*.css`, `src/app/fonts/**`, `src/components/**`, `src/lib/cards/**`, `src/lib/ics/**`, `src/lib/recall/**`, `src/lib/personas/**`, `content/personas/**`, `public/**`.
  - `platform-dev`: `*.config.*`, `tsconfig.json`, `Dockerfile`, `deploy/**`, `drizzle/**`, `scripts/migrate.mjs`, `src/middleware.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/app/api/health/**`, `src/lib/db/**`, `src/lib/*.ts`, `src/test/**`, `public/**`, and the other config files listed there.
  - `data-dev`: `src/lib/sources/**`, `src/lib/figures/**`, `src/lib/events/**`, `src/app/api/figures/**`, `src/lib/db/schema/figures*`, `drizzle/**`, `scripts/fetch-figures*`, `scripts/prefetch*`.
  - `crypto-dev`: `src/lib/crypto/**`, `src/lib/seal-format/**`, `src/app/api/letters/**`, `src/app/api/openings/**`, `src/lib/db/schema/letters*`, `drizzle/**`, `scripts/seal-personas*`, `src/lib/letter-store/**`, `src/test/integration/**`.
- **Hard boundaries (R1.2, R1.4).** Frontend-dev and platform-dev tasks add, edit, rename or delete nothing under `src/app/api/`, `src/lib/crypto/`, `src/lib/seal-format/`, `src/lib/letter-store/` or `src/lib/db/`, and nothing under `drizzle/`. The states, events and transitions of `opening-machine.ts` stay unchanged; the only edit allowed there is the `envelopeHash` field on `Opened` in task 8. `opening-machine.test.ts` and `opening-machine.property.test.ts` pass with edits limited to fixtures that add that field.
- **The three landing files (R1.7).** Frontend-dev tasks must not touch `src/app/page.tsx`, `src/app/layout.tsx` or `src/app/globals.css`. They match `frontend-dev`'s globs (`src/app/**/*.tsx`, `src/app/**/*.css`), so the PR check will not catch it. Check your diff for them and remove any change before you open the PR. QA fails a frontend-dev PR that changes one of them and names the file. Only platform-dev tasks 5, 10, 12 and 20 edit `page.tsx` or `layout.tsx`.
- **Owner_Patch rule (R1.3, R29.6).** Never commit a change to `tools/**`, `.kiro/**`, `docs/**`, `scripts/check.sh`, `scripts/check-js-budget.mjs`, `.github/**` or `README.md` (no role owns it). When a task needs one, write the diff from design.md "Owner patches" (letters a to m), attach it to the task's issue or PR description under the heading "Owner_Patch <letter>", and keep it out of the PR diff. Attach each patch to the task named below, not a later one.
- **No new runtime dependency (R1.6).** Add nothing to `dependencies` in `package.json`. No animation library, no WebGL, no browser test framework, no raster or PDF library. `next/og` ships with `next`. If you think you need a dependency, stop and ask the owner in the issue.
- **Privacy (R1.5).** The Content Security Policy header value stays byte-identical, and `src/lib/security-headers.ts` has no diff. The browser makes no request to any origin but the site's own. Code this spec adds writes nothing to `localStorage`, `sessionStorage`, IndexedDB, cookies, the URL path, the query string or the fragment. The landing page has no arrival signal (R9.12). No module statically imports `src/lib/crypto`; `src/lib/crypto`, `src/lib/cards` and `src/lib/ics` stay browser-only, and `src/lib/letter-store` stays server-only. The backup key, PRF output and content key are never logged, sent or stored.
- **Calm, Skip and reduced motion.** Every motion this spec adds or reuses has its Skip path and its Calm_Mode path, and runs only inside `@media (prefers-reduced-motion: no-preference)` and `[data-ceremony-motion="full"]`. Under Calm or reduced motion the final state shows in the first frame. Animations change only `transform` and `opacity` (R8.3, R9.10).
- **Tokens.** Every colour comes from `src/components/ceremony/scene/tokens.module.css` (the Scene tokens); no colour literal outside it, except the hand-written `public/icon.svg` and the `next/og` images, which repeat the token values listed in design.md "Metadata, icons and the Open Graph image". The Accent marks only the reader's own answer, the main buttons, the wax and the focus ring; never a figure value, change, formula, period, direction or source control. Text on purple is `--on-purple`. "Then" and "Now" use one non-Accent token whatever the direction (R4.1, R5.2).
- **Constants.** Every duration, size and layout value this spec adds is a plain literal in `src/components/ceremony/constants.ts` with the names and values of design.md "Constants", unless that section names another owning module. `constants-css.test.ts` checks every value the CSS repeats.
- **Copy modules.** Every user-facing string, including `aria-label`s, legends, live-region lines and error messages, lives in the copy module design.md "Copy" names, with exactly that text. No sentence over 25 words, no exclamation mark, no pun, no scoring word, no comment on what the judge typed or remembered. Each string passes the `neutrality.md` copy test. The words "today", "current", "latest" and "live" never label or describe a Now_Figure (R21.4).
- **Data integrity.** Every figure shown carries its value, unit, region, period, source and `retrieved_at`, with its period next to it. Nothing is invented, estimated, converted or filled. Stored values keep full published precision; rounding happens only in the display formatter. Sweden appears nowhere outside test inputs, recorded excerpts and guard lists (R23).
- **Assets.** Original work only, each with an `ASSETS.md` row (path or component, how it was made, licence "original", date added). No AI-generated asset and nothing from Kiro's logo or mascot (R12.5).
- **Tests (R30.1, R30.2).** Vitest in the `node` environment with `renderToStaticMarkup`, every `fetch` stubbed, no network and `DATABASE_URL` unset. An unstubbed request fails the test. Property tests use fast-check with `numRuns` of at least 100 and the tag `// Feature: 08-judge-polish, Property N: <title>`, with the number and title of design.md "Correctness Properties". The properties a task names are required in that task. Postgres tests go in `src/test/integration/**` (crypto-dev paths) and are skipped without `DATABASE_URL`. Existing data, neutrality, accessibility and contrast tests stay; change one only where a value it asserts changes in this spec, and name it in the PR.
- **The flow works after the merge (R31.4).** After your PR merges, `bash scripts/check.sh` passes on `main`, and `/`, `/demo`, `/demo/live`, `/l/[id]` and `/demo/personas/us-maya` load without error, with the persona flow reaching the `close` Stage from `/`.
- **The PR description states (R30.6 to R30.8, R27.8):**
  - the commit SHA `bash scripts/check.sh` ran on (the final commit), its exit status, and PASS or FAIL;
  - for a task that changes anything on screen, PNG screenshots of every Stage or page it changes at 1366×800, 1280×800 and 360×640, named `<stage-or-page>-<width>x<height>` (the "QA shots" line lists them);
  - every route budget from `node scripts/check-js-budget.mjs` after `npm run build` on the head commit, in kB gzipped, against its limit: `/` 130, `/demo` 130, `/demo/personas/[key]` 190, `/demo/live` 190, `/l/[id]` 190, plus `/how-it-is-sealed` 130 once Owner_Patch e is on `main` and `/seal` 190 on a go decision;
  - every earlier-spec test it changed or retired, by file and test name, with the reason, or "none";
  - every asset it added with its size in bytes and its `ASSETS.md` row, or "none";
  - for a task with QA checks, the `npm run layout-check` result lines (check ID, name, size, Stage, measured values, threshold, PASS or BLOCKER) at the three sizes;
  - every Owner_Patch it attaches, by letter, or "none".
- **Layout checks.** Owner_Patch a (`tools/qa/layout-check.mjs`) is already on `main` before any task starts; the owner commits it first. QA runs `npm run layout-check -- --url <app>`, which defaults to 1366×800, 1280×800 and 360×640. Its BLOCKER lines block the PR; polish and note lines do not.
  - Each result line reads `<PASS|BLOCKER|polish|note> <id> <name> <WxH> <stage> <detail>`; the spec 08 checks print their measured values and `threshold=` in `<detail>`. The neutrality checks are NT1 and NT2; N1 is `numbers-focus`.
  - A check whose element is not on the build prints a note, not a BLOCKER: N1 without `[data-figures-heading]`, B1 without `[data-figure-entry]` or an element whose class contains `figValue`, L1 without `[data-line-label]` elements, and LG1 without `[data-ghost-pit]` on `/`. W1, X1 and R1 always measure and can print BLOCKER.
  - What the checks read: R1 reads after scrolling to the top and waiting until boxes stop moving. W1 measures `[data-letter-text]` if present, else the longest `<p>` in the sealed letter. B1 reads `[data-role="then"|"now"] [class*=figValue]`, `[data-line-label="answer"]` or `[class*=figAnswer]`, `[class*=change]` and `[class*=formula]` inside each `[data-figure-entry]`. L1 reads every `[data-line-label]`, grouped by its `[data-figure-entry]`. FT1 reads the `<footer>` element.
  - On `main` at 6d464d1 the check prints BLOCKER for W1 (5.7em at 1366×800 and 1280×800, 227 px at 360×640) and R1 (field and next control below the viewport at all three sizes), and notes for N1, B1, L1 and LG1. BAND1 `light-band` reads `/` at the `scene` Stage (a pixel column from 2 px inside the Soil strip's bottom, past the explanation section's top edge, with a full-page capture) and the persona page at the `intact` Stage (from 2 px inside the Soil strip's bottom down to the viewport bottom or 4 px above the first text, control or non-page-colour panel). On 6d464d1 it prints polish at all three sizes on both: `/` maxRowChange 114, 113 and 109 at 1366×800, 1280×800 and 360×640 (edgeChange 99, 97 and 68 at the explanation edge), and persona `intact` 114, 113 and 109. Task 1 fixes W1 and R1, so they are in its scope.
  - Each task's "QA check" lines name the checks that must print PASS, not note, once that task lands. Every check that printed PASS before the task must still print PASS.
  - QA takes the numbered rows of design.md "QA browser steps" (`^\| 08 \|`) that the task lists. A Stage a later task rebuilds, still in its old look, is not a finding.
- If `design.md` and the code on `main` disagree, or a name has moved, re-read the code, keep the design's behaviour, and say what you changed in the PR description. If something is unclear, stop and ask the owner in the issue. Do not guess.

## Tasks

### Group 1: reveal fixes and layout checks

- [x] 1. Focus after "See the numbers", the reveal layout and the Hero after the First_Step
  - Agent: `frontend-dev` · Depends on: none · Estimated size: ~1,300 changed lines
  - Before this task: `main` with spec 07 complete. Owner_Patch a (`tools/qa/layout-check.mjs`) is already on `main`, so the N1, W1, X1 and R1 checks exist when tasks 1 to 3 are QA'd.
  - Scope: `src/components/ceremony/stages.ts`, `src/components/ceremony/CeremonyRoot.tsx`, `src/components/ceremony/constants.ts`, `src/components/ceremony/constants-css.test.ts`, `src/components/ceremony/scene/scene.module.css`, `src/components/ceremony/letter/LetterBlock.tsx`, `src/components/ceremony/letter/LetterBlock.module.css`, `src/components/reveal/Reveal.tsx`, `src/components/reveal/FiguresThenNow.tsx` (the `data-figures-heading` attribute only), `src/components/reveal/reveal.module.css`, `src/components/ceremony/scene/animation-scan.test.ts` (additions only), and the `*.test.ts(x)` for each file above, including `src/components/ceremony/CeremonyRoot.test.tsx` and `src/components/ceremony/stages.test.ts`
  - Design sections: "Measured starting point", "Focus after \"See the numbers\"", "The reveal layout after the Ghost leaves", "The Hero after the First_Step", "Constants" (R2, R3, R8 blocks), "Error Handling" (focus target missing, `scrollIntoView`), Owner patch a.
  - Acceptance:
    - `stages.ts` exports `FocusTarget`, `focusTargetFor(prev, next)`, `afterFirstStep(stage)` and `afterGhost(stage)` exactly as the design's table states. Stage names are unchanged.
    - `CeremonyRoot` keeps the previous Stage in a ref and asks `focusTargetFor` on every `[state.tag, stage]` change. For `figures-heading` it calls `focus({ preventScroll: true })` then `scrollIntoView({ block: "start", behavior })`, with `"smooth"` only in full motion with no reduced-motion preference and `"auto"` otherwise. A timer at `FOCUS_SCROLL_CHECK_MS` (900) re-checks the heading top once and jumps with `"auto"` if it is above the Top_Bar bottom or at or below the viewport bottom. The timer clears on unmount and on the next Stage change (R2.1, R2.2, R2.3).
    - The settle from `figures` to `close` (clock or Skip) moves neither focus nor scroll. The one exception is the pure helper `shouldRescueFocus(activeIsBody, target)`: when the focused element was removed in the same commit, focus goes to the Figures_Heading with `preventScroll: true` (R2.4).
    - The Figures_Heading carries `data-figures-heading`, keeps `tabIndex={-1}`, and gets `scroll-margin-top: calc(var(--topbar-clear) + 0.75rem)` with `--topbar-clear: 96px`. No element has a positive `tabindex`; the close controls follow the heading in document order (R2.5). Every other Stage change keeps the spec 07 focus rule (R2.6).
    - After the Ghost leaves (`letter`, `figures`, `close`) the column cap is lifted as the design's selectors state. At or above `REVEAL_SIDE_BY_SIDE_PX` (1,200 px) `.letterFigures` is `minmax(0, 1.4fr) minmax(20rem, 1fr)` with the figures beside the letter; below it the figures sit under the Letter_Block (R3.1). The Letter_Text has `max-width: 34em`; below 600 px the Letter_Block and paper paddings tighten. The computed widths of the design's table hold: 28 to 40 em at the Desktop_Sizes, at least 280 px at 360×640 (R3.2, R3.3).
    - No Stage of the persona page, `/demo/live` or `/l/[id]` scrolls sideways at a Check_Size; the source `details` series ID line gets `overflow-wrap: anywhere` (R3.4). Document and screen order stay: remembered, letter, figures (R3.7).
    - Hero after the First_Step: the headline uses `HERO_AFTER_WIDE` at or above 900 px and `HERO_AFTER_NARROW` below, strictly smaller than in `emerging`, `sealed` and `intact` at every width (R8.1). In full motion only, `heroSettle` animates opacity over `HERO_SETTLE_MS` (240); under Calm or reduced motion the final size shows in the first frame (R8.3, R8.4).
    - Narrow handed lift: below 900 px in `recall`, `marks` and `seal`, the backdrop moves up `NARROW_HANDED_LIFT_VH` (14vh) and the pinned region's `top` subtracts the same, with no JavaScript measurement. At 360×640 the current question, its field and its next control are inside the viewport with the page at the top (R8.2). If the measured G1 check puts the headline on the Ghost body at 360×640, raise the value in steps of 1 up to 18 and state the value in the PR.
    - The PR states the five route budgets measured on the head commit. This sets the starting values for the spec; it changes no budget.
  - Tests: Property 10 (the focus rule). Example tests of design.md "Testing Strategy" for focus (R30.3) and `shouldRescueFocus`; the CSS constant checks for `REVEAL_SIDE_BY_SIDE_PX`, `LETTER_TEXT_MAX_EM`, `HERO_SETTLE_MS` (and that it is at most 400) and `NARROW_HANDED_LIFT_VH`; the hero `clamp()` comparison at every 10 px from 320 to 2560; the animation scan for `heroSettle` (opacity only, behind the motion gate).
  - Earlier-spec tests changed or retired: `ceremony/CeremonyRoot.test.tsx` (adds the focus rule cases; `stageHeadingIndex` tests kept, it is still the default rule). Any other change named in the PR with its reason.
  - Owner_Patches attached: none.
  - QA shots: `intact`, `recall`, `marks`, `letter`, `figures`, `close` of `/demo/personas/us-maya`, each at 1366x800, 1280x800 and 360x640.
  - QA steps: 08-01, 08-02 (letter width and scroll width; the Fingerprint block comes in task 8), 08-03, 08-05, 08-06.
  - QA check: N1 `numbers-focus` PASS at all three sizes after "See the numbers" and after "Show everything", in full motion and in Calm, with the two reads at most 1 px apart (R2.1 to R2.4, R27.2).
  - QA check: W1 `letter-width` PASS (28 to 40 em at 1366×800 and 1280×800, at least 280 px at 360×640) and X1 `scroll-width` PASS in every Stage reached (R3.2 to R3.4, R27.3, R27.4).
  - QA check: R1 `recall-in-view` PASS at all three sizes (R8.2, R27.6).
  - QA check: once this task lands, W1, X1, R1 and N1 print PASS, not note, at all three sizes (this task adds `[data-figures-heading]`, and fixes the W1 and R1 BLOCKERs that `main` prints at 6d464d1). B1, L1 and LG1 may still print notes. Every check that printed PASS before this task still prints PASS.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R1.1–R1.8, R2.1–R2.6, R3.1–R3.4, R3.7, R8.1–R8.4, R27.1–R27.9, R29.6, R30.1, R30.3, R30.6–R30.8, R31.4_

- [x] 2. Figure_Entry at equal weight, one "Your answer", Number_Line labels
  - Agent: `frontend-dev` · Depends on: 1 · Estimated size: ~2,000 changed lines
  - Before this task: task 1 is on `main`.
  - Scope: `src/components/reveal/FigureEntry.tsx`, `src/components/reveal/FigureLine.tsx`, `src/components/reveal/FiguresThenNow.tsx`, `src/components/reveal/ChangeLine.tsx`, `src/components/reveal/reveal.module.css`, `src/components/ceremony/figures/line-labels.ts` (new), `src/components/ceremony/figures/NumberLine.tsx`, `src/components/ceremony/figures/number-line.ts` (only if a geometry export is needed; the range rule is unchanged), `src/components/ceremony/figures/figures.module.css`, `src/components/ceremony/constants.ts`, `src/components/ceremony/copy.ts`, and the `*.test.ts(x)` for each file above, including `reveal/FigureEntry.test.tsx`, `reveal/figure-entry.property.test.tsx`, `reveal/change-neutral.property.test.tsx` and `ceremony/figures/NumberLine.test.tsx`
  - Design sections: "Figure_Entry markup (R4)", "Number_Line labels (`line-labels.ts`)", "Constants" (R3 `FIG_VALUE_SIZE`, R5 block), "Copy" (`lineThen`, `lineNow`, `lineAnswer`, `lineNoAnswer`, `numberLineAlt`, `numberLineAltNoAnswer`), "Error Handling" (label measurement fails).
  - Acceptance:
    - The Then_Value and the Now_Value are both `.figValue`: `FIG_VALUE_SIZE`, weight 800, `--text`, `white-space: nowrap`, tabular digits. No class depends on the sign, and neither uses the Accent. The `youLine` and `.big` classes are removed (R4.1).
    - A comparable entry shows, top to bottom and in document order: name and region, the then row (value, unit, period, region, provenance label), the now row (value, unit, period, region, retrieved date), the Number_Line, the change line, the formula with both inputs as text, the source control (R4.2).
    - Value, unit and period are separate inline spans with a normal space between them, so a line can break only between value and unit or between unit and period (R3.6). Every value, answer, change line and formula stays inside its Figure_Entry at every Check_Size (R3.5).
    - "Your answer" appears as visible text exactly once per entry: as the Number_Line label when a Number_Line is drawn, otherwise as `<p class="figAnswer">` after the now line with the value and unit or "No answer" (R4.3 to R4.5).
    - `line-labels.ts` exports `placeLineLabels` exactly as the design states: centred then clamped, placed in the fixed order Then, Now, Your answer, each in the lowest free row with `LINE_LABEL_GAP_PX`, three rows always reserved. It reads no DOM, clock, random value or figure value (R5.4 to R5.6).
    - `NumberLine` shows visible "Then", "Now" and "Your answer {value} {unit}" (or "No answer") labels as DOM text. "Then" and "Now" use `--muted`; the answer label uses `--accent`. Server and first client render use the `LABEL_CHAR_PX` estimate; after `document.fonts.ready` and on resize the measured widths go through the same function (R5.1 to R5.3). With no answer there is no Mark and the third label reads "No answer" (R5.9).
    - The Number_Line has `role="img"` and an `aria-label` from `numberLineAlt` or `numberLineAltNoAnswer`; the visible labels are `aria-hidden` (R5.8). Its range rule is spec 07 R14.4, unchanged, and no displayed number comes from a position (R5.7).
    - The Number_Line labels carry `data-line-label` with the values `then`, `now` and `answer`, and the value spans use a CSS-module class named `figValue`, so the B1 and L1 checks find them.
    - Spec 07 R14.2, R14.5, R14.6 and R14.10 to R14.12 still hold: payload order, honest unavailable and not-comparable rendering, one fixture note, the Live_Letter zero change, a period next to every number, identical markup for a rise and its mirror-image fall (R4.6).
  - Tests: Property 1 (Number_Line labels never overlap and stay on the line); Property 6 (then and now carry the same weight, and a rise mirrors a fall); Property 11 (Figure_Entry order and one "Your answer"); Property 12 (the Number_Line text alternative names all three points).
  - Earlier-spec tests changed or retired: `reveal/FigureEntry.test.tsx` and `reveal/figure-entry.property.test.tsx` (the `youLine` and `.big` assertions replaced by the R4.2 order, since spec 07 R14.3 items 2, 3 and 6 are replaced by R4 and R5); `reveal/change-neutral.property.test.tsx` (extended to Property 6, `.big` becomes `.figValue`); `ceremony/figures/NumberLine.test.tsx` (labels and accessible name added, pin and Mark assertions kept).
  - Owner_Patches attached: none.
  - QA shots: `figures` and `close` of `/demo/personas/us-maya` at 1366x800, 1280x800 and 360x640.
  - QA steps: 08-03, 08-04.
  - QA check: B1 `figure-boxes` and L1 `line-labels` PASS at all three sizes (R3.5, R5.3, R27.5).
  - QA check: once this task lands, W1, X1, R1, N1, B1 and L1 print PASS, not note, at all three sizes; LG1 may still print a note. Every check that printed PASS before this task still prints PASS.
  - QA check: each entry shows "Your answer" once; then and now values have the same size and weight; no orange on any figure value (R4.1, R4.3).
  - Validation: `bash scripts/check.sh`
  - _Requirements: R3.5, R3.6, R4.1–R4.6, R5.1–R5.9, R30.2_

- [ ] 3. Fixed Recall_Scale ranges, the marks card record and the recall number input
  - Agent: `frontend-dev` · Depends on: 2 · Estimated size: ~2,600 changed lines
  - Before this task: task 2 is on `main`.
  - Scope: `src/components/ceremony/recall/unit-ranges.ts` (new), `recall/scale-math.ts`, `recall/tick-layout.ts` (new), `recall/parse-number.ts` (new), `recall/recall-field.ts` (new), `recall/recall-pager.ts`, `recall/RecallPager.tsx`, `recall/RecallPager.module.css`, `recall/RecallScale.tsx`, `recall/RecallScale.module.css`, `recall/RecordedScale.tsx` (new), `src/components/reveal/Reveal.tsx`, `src/components/reveal/copy.ts`, `src/components/ceremony/copy.ts`, `src/components/ceremony/constants.ts`, the source scan tests under `src/components/ceremony` (additions only), and the `*.test.ts(x)` for each file above, including `recall/RecallScale.test.tsx`, `recall/scale-math.test.ts`, `recall/recall-pager.test.ts`, `recall/RecallPager.property.test.tsx`, `recall/RecallPager.fit.test.ts`, `reveal/Reveal.marks.test.tsx` and `reveal/RecallStep.test.tsx`
  - Design sections: "The Unit_Range_Table (`unit-ranges.ts`) and the scale", "Tick labels (`tick-layout.ts`)", "Recall number input (R32)" (the parser, field state and the field in `RecallPager.tsx`), "The marks card (`RecordedScale.tsx`)", "Constants" (R6 block), "Copy" (`unitHelperEurPer1000L`, `parsedValue`, `readingLegend`, `readingDecimal`, `readingGrouping`, `numberUnreadable`), "Error Handling" (recall number text).
  - Acceptance:
    - `unit-ranges.ts` holds `UNIT_RANGE_TABLE` with exactly the two approved literal entries (`USD per gallon` 0 to 10, ticks 0, 2, 4, 6, 8, 10; `EUR per 1,000 litres` 0 to 3,000, ticks every 500), `FALLBACK_RANGE`, `scaleRangeFor` with an exact `Object.hasOwn` lookup, and `unitHelperFor` keyed only on `UNIT_HELPER_UNIT` (R7.1 to R7.4, R7.10). No key contains `SEK` (R23.1).
    - `scale-math.ts` keeps its Fallback_Range exports and gains `valueAtIn`, `positionOfIn` and `toPlainDecimalIn`. Every track value matches `^[0-9]+(\.[0-9]+)?$` in at most 40 characters. Off-range typed values put the Mark at the nearer edge with the same shape, size and colour at both edges, and the typed string is stored unchanged (R7.5 to R7.7). The slider's `aria-value*` contract is unchanged.
    - `visibleTicks` keeps the first and last tick and drops inner ticks that come within `TICK_GAP_PX`; the 480 px decade-hiding rule is removed. The static markup already has no overlapping tick labels (R6.5).
    - `RecordedScale` replaces `<RecallScale readOnly>` on the marks card: no state, no handlers, no `role="slider"`, no `tabindex`, `cursor: default` everywhere, `role="img"` with its `aria-label`, the Mark and "{value} {unit}" or no Mark and "No answer" (R6.1 to R6.4). `RecallScale` drops its `readOnly` prop.
    - The Unit_Helper_Line "1,000 here means 1 euro per litre." shows inside every `EUR per 1,000 litres` question block, under the unit label, with its id in the field's `aria-describedby`, and on the marks card; for every other unit nothing renders (R7.8, R7.9).
    - `parse-number.ts` implements `parseRecallNumber`, `formatRecallNumber` and `formatParsedValue` exactly as the design's steps and regex table state: the Ambiguous_Input test first, the six Unambiguous_Formats, `rejected/unreadable`, `rejected/too_long`, `rejected/empty`, every typed digit kept (R32.2 to R32.4, R32.9). It is pure and the only code that parses recall number text; `draftNumber` is deleted and a source scan fails on any other parser (R32.10).
    - `recall-field.ts` implements the field state and Mark rules. The draft only ever holds the canonical value or `""`, so an ambiguous, unreadable or empty field stores nothing (R32.1, R32.5, R32.12). `submitAction` gains `ready`, so Enter cannot get round the disabled control.
    - `RecallPager` shows "Read as {value}" beside the field for a value or picked reading, linked by `aria-describedby`, updated on every change, with every typed digit (R32.8). For an Ambiguous_Input it shows the two-reading radio group, decimal first, neither checked, and the next control stays disabled until a pick (R32.4 to R32.6). An unreadable entry shows `numberUnreadable` with its fixed example and keeps the text and the Mark (R32.7). An empty field shows no message, and the next control stays disabled unless "no answer" is ticked (R32.13).
    - `src/lib/recall/**`, `opening-machine.ts` and `useOpeningFlow.ts` are not changed. The Recall_Record schema is unchanged (R7.7, R32.9).
    - With the reading group shown at 360×640, the question, field and next control stay in view; the PR states the measured value (R8.2).
  - Tests: Property 2 (the Recall_Scale range depends only on the exact unit string); Property 3 (every scale value is a valid Recall_Record number, and off-range answers sit at the nearer edge); Property 7 (recall number round trip); Property 8 (an Ambiguous_Input never becomes a single value); Property 9 (the Unit_Helper_Line depends only on the unit string); Property 13 (the recorded scale is a record, not a control); Property 14 (tick labels never overlap); Property 30 (the recall field never stores an unresolved number). Example tests of design.md "Testing Strategy" for the recall field, the Unit_Helper_Line, the Unit_Range_Table literals and unit coverage (every unit in `CATALOGUE` and in the personas sealed by `scripts/seal-personas*`), and the `Intl.NumberFormat` separator check per Catalogue region.
  - Earlier-spec tests changed or retired: `recall/RecallScale.test.tsx` (the `readOnly` cases move to `RecordedScale.test.tsx`; the 480 px decade-hiding assertion is replaced by `visibleTicks`, since the spec 05 tick rule is replaced by R7); `recall/scale-math.test.ts` (kept for the Fallback_Range); `reveal/Reveal.marks.test.tsx` (expects `RecordedScale`); `recall/recall-pager.test.ts` (`draftNumber` tests removed, `submitAction` gains `ready`); `recall/RecallPager.property.test.tsx`, `recall/RecallPager.fit.test.ts`, `reveal/RecallStep.test.tsx` (advancing past an empty or invalid field now expects the control disabled, R32.13; the fit test includes the reading group at 360×640).
  - Owner_Patches attached: none.
  - QA shots: `recall` and `marks` of `/demo/personas/us-maya` at 1366x800, 1280x800 and 360x640, and `recall-readings` (the two-reading group shown) at the same sizes.
  - QA steps: 08-01, 08-07, 08-21 (on the US persona until the EU persona lands in task 18: type "1.585", pick each reading, type "1.585,70", type "-3").
  - QA check: R1 `recall-in-view` PASS at all three sizes, also with the reading group shown (R8.2, R27.6).
  - QA check: on the marks card no slider thumb, cursor default, Tab skips the scales; T2 `tick-labels` prints PASS (polish row, values recorded) (R6.1, R6.2, R6.5).
  - QA check: R1 still prints PASS with the reading group shown. Every check that printed PASS before this task still prints PASS.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R6.1–R6.5, R7.1–R7.10, R8.2, R23.1, R30.2, R32.1–R32.13_

### Group 2: landing Ghost

- [ ] 4. Split the Ghost into a server-safe drawing and a persona client wrapper
  - Agent: `frontend-dev` · Depends on: 3 · Estimated size: ~900 changed lines
  - Before this task: task 3 is on `main`.
  - Scope: `src/components/ceremony/scene/Ghost.tsx`, `scene/PersonaGhost.tsx` (new), `scene/ghost-geometry.ts` (new), `scene/eyes.ts` (the `EyeOffset` type moves out), `scene/SceneBackdrop.tsx` (accepts `children`), `scene/SceneShell.tsx` (landing root keeps `data-ceremony-motion`; `.landingColumn` hook), `scene/scene.module.css`, `src/components/reveal/OpeningFlow.tsx` (imports `PersonaGhost`), `src/components/ceremony/scene/animation-scan.test.ts` (additions only), and the `*.test.ts(x)` for each file above, including `scene/ghost.test.tsx`, `scene/ghost-placement.test.tsx` and `scene/persona-scene.test.tsx`
  - Design sections: "The Landing_Ghost" (the split, `data-ghost-*` attributes, clear of the headline and the button, same x as the light, the band), "The second rise (R9.12)".
  - Acceptance:
    - `Ghost.tsx` has no `"use client"` and no hooks. It exports `Ghost(props)` with `pose`, `eyes`, `gradientId`, `leaving`, `riseRef`, `leaveVars` and `children`, and renders the same layers and classes as before. It imports nothing from `eyes.ts` or `PersonaGhost.tsx` (R9.1, R9.8).
    - `ghost-geometry.ts` holds `BODY_PATH`, `FOLDS_PATH`, the eye positions, the viewBox and the `EyeOffset` type, for the icons in task 10 and 11.
    - `PersonaGhost.tsx` (`"use client"`) holds the motion, Skip, Stage and Emergence hooks, the pointer listeners and `eyeOffset`, and renders `<Ghost …/>`. `OpeningFlow` uses it. No persona behaviour changes: the full Emergence still plays on every load (R9.12).
    - `.ghost` and `.bob` carry `data-ghost-rise` and `data-ghost-bob`; `.pit` carries `data-ghost-pit`. The rise and Idle_Bob CSS is unchanged in duration and easing (R9.4).
    - `SceneBackdrop` renders its `children` inside the backdrop, so the landing can pass a server-rendered Ghost.
    - `scene.module.css` adds `.landingColumn` (persona column cap and the persona wide headline size at or above 900 px) and `.landingColumn .landingCta` (below the Soil strip below 900 px), for task 5 to use (R9.11).
    - `.light` gets `clip-path: inset(0 0 calc(50% - 12px) 0)` on every Scene page, so no lit band shows below the Soil strip (R9.13).
    - `src/app/page.tsx` is not touched. The landing still renders no Ghost until task 5.
  - Tests: none of the numbered properties. Example tests: `Ghost` server markup renders with no hooks and carries the `data-ghost-*` attributes; the import graph of `Ghost.tsx` reaches neither `eyes.ts` nor `PersonaGhost.tsx`; the animation scan covers the new attributes; the light clip value matches the CSS constant check.
  - Earlier-spec tests changed or retired: `scene/ghost.test.tsx`, `scene/ghost-placement.test.tsx`, `scene/persona-scene.test.tsx` (import `PersonaGhost` where they test eyes and Emergence; drawing assertions use `Ghost`); `scene/animation-scan.test.ts` (new attributes).
  - Owner_Patches attached: none.
  - QA shots: `emerging`, `intact`, `recall` and `close` of `/demo/personas/us-maya` at 1366x800, 1280x800 and 360x640 (unchanged look apart from the clipped light).
  - QA steps: 08-01 to 08-04 on the persona page, expected unchanged.
  - QA check: `npm run layout-check` reports no BLOCKER on the persona page at all three sizes. The light clip lands in this task, so BAND1 `light-band` at the persona `intact` Stage prints at most 2 (PASS) at all three sizes. BAND1 at the `/` `scene` Stage may still print polish until task 5, because the explanation edge is in `page.tsx` (R9.13).
  - QA check: no regression: every check that printed PASS before this task still prints PASS. LG1 still prints a note, since `/` has no `[data-ghost-pit]` until task 5.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R9.1, R9.2, R9.4, R9.8, R9.11, R9.12, R9.13_

- [ ] 5. The Landing_Ghost on `/`
  - Agent: `platform-dev` · Depends on: 4 · Estimated size: ~300 changed lines
  - Before this task: task 4 is on `main`.
  - Scope: `src/app/page.tsx`, `src/lib/landing-backdrop.ts`, `src/test/landing.test.tsx`, and new `*.test.ts(x)` files under `src/test/`
  - Design sections: "The Landing_Ghost", "The second rise (R9.12)", Owner patch b.
  - Acceptance:
    - `page.tsx` renders `<LandingBackdrop><Ghost gradientId="ghost-body-landing" /></LandingBackdrop>`, and `LandingBackdrop` passes `children` through to `SceneBackdrop`. The Landing_Ghost is in the server HTML before any client JavaScript runs (R9.1).
    - No Envelope is passed; the Accent link stays in the hero section and is not inside `[data-ghost-pit]` (R9.2). The hero uses `.landingColumn` and the link `.landingCta` (R9.11).
    - The Ghost's centre x equals the light's x, both from the same `.scene` variable (R9.3).
    - The rise and the Idle_Bob run in full motion only; under reduced motion or Calm the Ghost stands risen from the first frame, and turning Calm on stops motion in the next frame (R9.4 to R9.6).
    - `LANDING_NOSCRIPT_STYLE` becomes `[data-ghost-rise],[data-ghost-bob]{animation:none}`, dropping the dead `[data-scene-light]` selector (R9.7). `src/lib/security-headers.ts` has no diff.
    - `/` loads no eye-follow code: the import graph from `src/app/page.tsx` reaches neither `eyes.ts` nor `PersonaGhost.tsx` (R9.8). `/` adds no click handler, flag or storage for arrival (R9.12).
    - `/` stays at or under 130 kB first-load JavaScript (R9.9). The landing keeps spec 07 R7.1 to R7.10 and R7.13: one `h1`, one Accent button, the headline as LCP, the Soil_Canvas by dynamic `import()` only, no Opening_Flow, crypto, API or database code (R9.14).
    - The PR records one manual Lighthouse run on `/` in a production build: CLS exactly 0 (R9.10). Manual items are QA notes, not blockers.
  - Tests: none of the numbered properties. The three R9.15 tests in `src/test/landing.test.tsx`: the Landing_Ghost is in the server HTML (`data-ghost-pit`), it holds no Envelope (no `data-envelope`, Accent link outside the pit), and the import graph from `page.tsx` reaches no eye-follow code; plus the noscript rule names `data-ghost-rise`.
  - Earlier-spec tests changed or retired: `src/test/landing.test.tsx` ("renders no Ghost element" and the no-`ghost` import check are removed, since spec 07 Property 20's landing part is replaced by R9).
  - Owner_Patches attached: b (`.kiro/specs/07-judge-journey/`: R7.12, the `scene` row of R2.1, R26.9, design Property 20, QA step 07-01 and the Architecture node `L2`, each pointing to spec 08 R9) (R29.1).
  - QA shots: `scene` of `/` at 1366x800, 1280x800 and 360x640, in full motion after 3 s and under reduced motion.
  - QA steps: 08-08, 08-09.
  - QA check: LG1 `landing-ghost` PASS at all three sizes, after the rise and under reduced motion (R9.3, R9.11, R27.7).
  - QA check: BAND1 `light-band` at the `/` `scene` Stage prints at most 2 at all three sizes, edgeChange included (R9.13).
  - QA check: once this task lands, LG1 prints PASS, not note, at all three sizes. Every check that printed PASS before this task still prints PASS.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R1.5, R9.1–R9.15, R29.1, R29.6_

### Group 3: copy, labels, dates and metadata

- [x] 6. Period formats, number locales per region, and US and EU only in the figure modules
  - Agent: `data-dev` · Depends on: none · Estimated size: ~300 changed lines
  - Before this task: only `main`. This task shares no file with tasks 1 to 5 and may run beside them.
  - Scope: `src/lib/figures/format-change.ts`, `src/lib/figures/locale.ts`, `src/lib/figures/catalogue.ts` (header comment only), and the `*.test.ts` for each file above, including `format-change.test.ts`, `locale.test.ts`, and a new guard test under `src/lib/figures/`
  - Design sections: "Dates and numbers" (periods, numbers per region, comments), "Sweden is out of scope (R23)" (guards), Owner patch c.
  - Acceptance:
    - `formatPeriod` writes a weekly `YYYY-MM-DD` period as "26 Oct 2026" and a monthly `YYYY-MM` period as "Oct 2026", built from `en-GB` parts with `timeZone: "UTC"`. Its `region` argument stays in the signature and no longer changes the output (R15.2, R15.3).
    - `localeForRegion` maps `U.S.` to `en-US`, `EU27, weighted average` to `en-IE`, and anything else to `en-GB`. No row uses `sv-SE`. Only the number formatter uses it. Stored values keep full precision; rounding happens only in display (R15.4).
    - `formatPeriod` is the one period formatter; no other module formats a period (R15.5).
    - The header comments of `catalogue.ts` and `locale.ts` describe the US and EU entries only, with no mention of Sweden (R23.3).
    - A guard test over `CATALOGUE` and `src/lib/figures/real/fuel-figures.json` fails if any region names Sweden or any unit contains `SEK` (R23.1).
  - Tests: Property 17 (letter dates and periods are written one way), the `formatPeriod` part. Example tests: one value per locale row (R15.4).
  - Earlier-spec tests changed or retired: `lib/figures/format-change.test.ts` ("October 26, 2026" becomes "26 Oct 2026"); `lib/figures/locale.test.ts` (`en` becomes the region table) (R15.2 to R15.4).
  - Owner_Patches attached: c (`.kiro/steering/tech.md`: replace "UI is English only. Dates and numbers are formatted for the figure's region." with the three bullets of design.md Owner patch c) (R15.6, R29.2).
  - QA shots: `close` of `/demo/personas/us-maya` at 1366x800, 1280x800 and 360x640 (periods now "D Mon YYYY").
  - QA steps: none of the numbered rows; 08-20 checks the EU form once task 18 lands. The QA agent reads the diff against R15.2 to R15.4 and runs the tests.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R15.2–R15.6, R23.1, R23.3, R29.2, R29.6_

- [x] 7. The Fingerprint module and the hash in the demo seal response
  - Agent: `crypto-dev` · Depends on: none · Estimated size: ~350 changed lines
  - Before this task: only `main`. This task shares no file with tasks 1 to 6 and may run beside them.
  - Scope: `src/lib/seal-format/fingerprint.ts` (new), `src/lib/seal-format/index.ts` (export), `src/app/api/letters/demo/seal/route.ts` (the live demo seal route on `main`; adjust the path if it differs and say so), and the `*.test.ts` for each file above
  - Design sections: "The Fingerprint", "The seal response".
  - Acceptance:
    - `formatFingerprint(hash)` returns 16 groups of 4 lowercase hex characters separated by single spaces for exactly `^[0-9a-f]{64}$`, and `null` for anything else. `parseFingerprint(text)` is its exact inverse and returns `null` for any other text (R14.7).
    - The module imports nothing from `src/lib/crypto`; `no-cross-import.test.ts` still passes, so browser code can import it with no crypto in its bundle.
    - The demo seal route returns `201 { letterId, sealedAt, opensAt, envelopeHash }`, where `envelopeHash` is the value it stored after recomputing and comparing it. Nothing else in the route changes (R14.1, R24.7).
    - The hash is not secret and may appear in the response; no key material does.
  - Tests: Property 4 (Fingerprint round trip). Example test: the route's 201 body carries the stored hash.
  - Earlier-spec tests changed or retired: the demo seal route tests gain the `envelopeHash` field in the expected 201 body; name each in the PR.
  - Owner_Patches attached: none.
  - QA shots: none (this task changes no page).
  - QA steps: none. The QA agent reads the diff against R14.1, R14.7 and `crypto.md` and runs the tests.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R14.1, R14.7, R24.7, R30.2_

- [ ] 8. One letter-date module, labels by letter kind, and the Fingerprint on the card and at opening
  - Agent: `frontend-dev` · Depends on: 4, 6, 7 · Estimated size: ~2,200 changed lines
  - Before this task: tasks 4, 6 and 7 are on `main`. (The design's table lists 6 and 7; task 4 is added because this task edits `OpeningFlow.tsx`, which task 4 changes, and the frontend-dev chain is straight.)
  - Scope: `src/components/ui/letter-date.ts` (new), `src/components/demo/dates.ts` (delete), `src/components/demo/PersonaCard.tsx`, `src/components/ceremony/envelope/Envelope.tsx`, `src/components/ceremony/recall/RecallPager.tsx` (date import only), `src/components/reveal/StillSealed.tsx`, `reveal/SealedLetter.tsx`, `reveal/FigureEntry.tsx`, `reveal/FigureLine.tsx`, `reveal/FiguresThenNow.tsx`, `reveal/Fingerprint.tsx` (new), `reveal/Reveal.tsx`, `reveal/OpeningFlow.tsx`, `reveal/opening-machine.ts` (the `Opened.envelopeHash` field only), `reveal/useOpeningFlow.ts` (set the field in its two `OPENED` dispatches only), `reveal/copy.ts`, `reveal/reveal.module.css`, `src/components/live/format.ts`, `live/LetterCard.tsx`, `live/SealedView.tsx`, `live/SealedKeepsakes.tsx`, `live/api.ts`, `live/seal-machine.ts`, `live/copy.ts`, `src/lib/cards/letter-card-svg.ts` (new), `src/lib/cards/index.ts`, `src/lib/ics/build-ics.ts` (only if its description writes a letter date), the source scan tests under `src/components` (additions only), and the `*.test.ts(x)` for each file above
  - Design sections: "Dates and numbers" (letter dates, where the zone comes from), "The Fingerprint", "Labels by letter kind (R13)", "The opening Fingerprint block (`Fingerprint.tsx`)", "Copy" (`labelSealedWithLetter`, `labelSelfReported`, the Fingerprint strings, `letterCardFingerprint`, `saveCardImage`).
  - Acceptance:
    - `ui/letter-date.ts` exports `LetterZone`, `formatLetterDate`, `formatCalendarDate` and `letterZoneFor` as the design states, built from `en-GB` parts, so every letter date reads like "30 October 2026" (R15.1). Personas use `utc`, Live_Letters the browser's IANA zone, Real_Letters the zone derived from `opens_at` being local midnight. A `retrieved_at` always uses UTC.
    - Every caller of `demo/dates.ts`, `StillSealed`'s `UTC_DATE` and the date part of `live/format.ts` switches in this PR, and `demo/dates.ts` is deleted. `live/format.ts`'s time formatter is renamed `formatLocalTime` and formats times only. A source scan finds no `Intl.DateTimeFormat`, `toLocaleDateString` or `toLocaleString` outside `ui/letter-date.ts`, `lib/figures/format-change.ts` and `formatLocalTime` (R15.5). The `.ics` description, the cards and every view use the module (R15.1).
    - `FigureEntry` and `FigureLine` take `letterKind` from `OpeningFlow`: persona letters say "historical record, retrieved {date}"; Live_Letters and Real_Letters say "sealed with the letter, retrieved {date}" and never "historical record"; fixture figures say "fixture data"; self-reported figures say "self-reported" and never "retrieved" (R13.1 to R13.4).
    - `Opened` gains exactly one field, `envelopeHash`; `useOpeningFlow` sets it from the hash it passed to `openLetter`, so it is always the verified hash. States, events and transitions are unchanged (R1.4, R14.5).
    - The `letter` Stage shows `Fingerprint.tsx` under the Letter_Block: "Fingerprint at sealing", all 16 groups in two lines of 8 in a monospace face, "The seal check passed." and, for live and real letters, the card sentence; for persona letters "demo letter" and no card wording. It is an `h3`, so the focus rule is unchanged. A failed hash check shows the existing failure only, with no Fingerprint, text or figures (R14.3, R14.6, R14.8).
    - `live/api.ts` parses `envelopeHash` with `z.string().regex(/^[0-9a-f]{64}$/)`; the `SEALED` event and the `sealed` SealState carry it. `LetterCard` prints the Fingerprint under the link, and `letter-card-svg.ts` draws the QR path, the opening date, the link and the Fingerprint as SVG text behind "Save the card as an image". No raster library is added (R14.1, R14.2).
    - The Fingerprint at opening equals the one printed at sealing for the same envelope, character for character (R14.4).
  - Tests: Property 15 (labels name what the figure is); Property 16 (the card and the Reveal show the same Fingerprint); Property 17 (letter dates and periods are written one way), the `formatLetterDate` part. Example tests: the single-date-module source scan; `letterZoneFor` for each letter kind.
  - Earlier-spec tests changed or retired: `demo/dates.test.ts` (moves to `ui/letter-date.test.ts` with the module); `reveal/FigureLine.test.tsx`, `reveal/fixture-label.test.tsx`, `reveal/SealedLetter.live.test.tsx`, `reveal/StillSealed.test.tsx` (date formats and the new live label, R13, R15); `live/api.test.ts`, `live/seal-machine.test.ts` (the seal response and `SEALED` carry `envelopeHash`); `reveal/opening-machine.test.ts`, `reveal/opening-machine.property.test.ts` (fixture `Opened` objects gain `envelopeHash` only, R1.4).
  - Owner_Patches attached: none.
  - QA shots: `letter` and `close` of `/demo/personas/us-maya`, the sealed view with the letter card on `/demo/live`, and `letter` on `/l/<id>`, each at 1366x800, 1280x800 and 360x640.
  - QA steps: 08-02 (the Fingerprint block with 16 groups and "demo letter"), 08-12 (the label and the Fingerprint parts; the backup path itself is task 9).
  - QA check: W1 and X1 still PASS in `letter` with the Fingerprint block shown (R3.2 to R3.4).
  - QA check: no regression: every check that printed PASS before this task still prints PASS at all three sizes.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R1.4, R13.1–R13.4, R14.1–R14.6, R14.8, R15.1, R15.5_

- [ ] 9. Top_Bar on every page, a way back from `/demo/live`, the PRF_Hint, the backup key path and the picker maximum
  - Agent: `frontend-dev` · Depends on: 8 · Estimated size: ~1,800 changed lines
  - Before this task: task 8 is on `main`.
  - Scope: `src/components/ceremony/scene/TopBar.tsx`, `scene/SceneShell.tsx`, `scene/scene.module.css`, `src/app/demo/live/page.tsx`, `src/app/l/[id]/page.tsx`, `src/components/live/SealPage.tsx`, `live/prf-hint.ts` (new), `live/WriteForm.tsx`, `live/clock.ts`, `live/SealedView.tsx`, `live/BackupKeyCard.tsx`, `live/live.module.css`, `live/FigurePicker.tsx`, `live/form.ts`, `live/copy.ts`, `live/backup-path.e2e.test.ts` (new), and the `*.test.ts(x)` for each file above, including `src/app/demo/live/page.test.tsx`, `live/copy.test.ts`, `live/FigurePicker.test.tsx` and `live/form.test.ts`
  - Design sections: "Pages and the Top_Bar", "PRF_Hint", "Backup key path (R17)", "The backup path test (R17.6)", "Copy" (`figuresHint`, `figuresTooMany`, `prfHint`), "Error Handling" (PRF capability call).
  - Acceptance:
    - `TopBar` gains `demo?: boolean` (default `true`) and `controls?: "calm" | "none"`; the wordmark is `<Link href="/" data-wordmark>`. `SceneShell` gains the `plain` variant (token class, `MotionProvider`, Top_Bar, no backdrop, no `data-ceremony` on its root) (R11.1, R11.2).
    - `/demo/live` renders `SceneShell variant="plain" demo` and no `PageShell`. `SealPage` renders one "Back to the demo" link to `/demo` above every Sealing_Flow state, before and after sealing; `SealedView`, `WriteForm`, `SealFailure` and `BackupFallback` are not edited for it (R11.3). The steps, crypto calls, API requests and strings of spec 06 are unchanged, and the spec 06 assertions pass without edits (R11.4).
    - `/l/[id]` renders the `plain` shell with `demo: false`; its region keeps its own Calm, Skip and sound controls and its one `data-ceremony`.
    - `prf-hint.ts` exports `prfHintFrom` and `usePrfHint` as the design states: one `getClientCapabilities()` call on mount, raced with `PRF_HINT_TIMEOUT_MS` (2,000). The hint is `missing` only when the call resolved with `extension:prf` exactly `false` (R16.1 to R16.4). `WriteForm` shows `prfHint` on the Write step when it is `missing` and blocks nothing. The PRF_Check at sealing is unchanged and decides alone (R16.5, R16.6). No request, no storage (R16.7).
    - Backup key path: write `backup-path.e2e.test.ts` first and run it on `main`, then fix the first matching candidate in the design's order. Whatever the cause, `goToLetterReady(opensAtMs, nowMs, offsetMs)` in `clock.ts` decides `done`, and is false for a non-finite input. "Go to your letter" is disabled until the countdown ends, then a link with `href` exactly `/l/{letterId}` (relative, never built from `APP_ORIGIN`) (R17.1 to R17.3). The PR states which candidate was the cause, or that none matched and what was found on `revenant.devclef.se`.
    - Opening with the right backup key stores the Recall_Record before any letter text or figure shows; a wrong or mistyped key keeps the field and its value and shows no content (R17.4, R17.5).
    - The picker hint and the "too many" message state N = min(`MAX_FIGURES`, offered series), which is 4 today, and the selection never exceeds N (R10.7). `MAX_FIGURES` stays 6.
  - Tests: Property 18 (the PRF_Hint shows only on a reported false); Property 19 ("Go to your letter" opens exactly when the countdown ends); Property 29 (the figure picker never offers more than it says). The R17.6 end-to-end test in the design's five steps. Example test: `/demo/live` has no `PageShell` class, a Top_Bar with the Demo chip, `href="/"` on the wordmark, and `href="/demo"` in every `SealState` tag (exhaustive over the tags) (R11).
  - Earlier-spec tests changed or retired: `live/copy.test.ts`, `live/FigurePicker.test.tsx`, `live/form.test.ts` ("6" becomes `{max}` filled with 4, R10.7); `src/app/demo/live/page.test.tsx` (Top_Bar instead of `PageShell`; Sealing_Flow assertions unchanged, R11.4).
  - Owner_Patches attached: none.
  - QA shots: `write`, `sealed` (with the disabled control) and `sealed-done` (with the enabled link) of `/demo/live`, and `unlock` of `/l/<id>`, each at 1366x800, 1280x800 and 360x640; `write-prf-hint` at the same sizes.
  - QA steps: 08-11, 08-12, 08-13.
  - QA check: X1 `scroll-width` PASS on `/demo/live` and `/l/[id]` at all three sizes (R3.4).
  - QA check: in step 08-12 the control was disabled, then became a link to `/l/<id>`, the page opened with the key field only, and the same backup key opened the letter (R17.1 to R17.4).
  - QA check: no regression: every check that printed PASS before this task still prints PASS at all three sizes.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R10.7, R11.1–R11.4, R16.1–R16.7, R17.1–R17.6, R30.2_

- [ ] 10. Site metadata, the title template and the favicon
  - Agent: `platform-dev` · Depends on: 5, 9 · Estimated size: ~250 changed lines
  - Before this task: tasks 5 and 9 are on `main`. (Task 5 is added because both tasks add new `*.test.ts(x)` files under `src/test/`.)
  - Scope: `src/lib/page-metadata.ts` (new), `src/app/layout.tsx` (`generateMetadata` only; the footer comes in task 12), `public/icon.svg` (new), and new `*.test.ts(x)` files under `src/test/` or next to `src/lib/page-metadata.ts`
  - Design sections: "Metadata, icons and the Open Graph image".
  - Acceptance:
    - `pageMetadata(page, path)` returns `title`, the full `openGraph` set (`title`, `description`, `url: path`, `images: ["/opengraph-image"]`, `type`, `siteName: "Revenant"`) and `twitter: { card: "summary_large_image" }`, so every route that calls it gets the whole set.
    - `layout.tsx` replaces its `metadata` const with `generateMetadata()`: `metadataBase: new URL(APP_ORIGIN)` read at request time (falling back to `http://localhost:3000` when unset), `title: { default: "Revenant", template: "%s · Revenant" }`, the description, and `icons: { icon: "/icon.svg", apple: "/apple-icon" }`. `og:url` and `og:image` resolve to absolute URLs that start with `APP_ORIGIN` (R12.2, R12.3). The `/apple-icon` route arrives in task 11.
    - `public/icon.svg` is written by hand from `ghost-geometry.ts`: the sheet ghost on a `#0b0912` rounded square, viewBox 0 0 64 64, about 700 bytes. It is original and contains nothing from Kiro's logo or mascot (R12.1, R12.5). Its `ASSETS.md` row is added in task 11, since `ASSETS.md` is a frontend-dev path; this PR states the row text for it.
    - `/` keeps the title "Revenant". No route title changes yet except through the template.
  - Tests: none of the numbered properties. Example tests: `generateMetadata` with `APP_ORIGIN=https://revenant.devclef.se` gives absolute `og:url` and `og:image`; the title template; `pageMetadata` returns the full Open Graph set.
  - Earlier-spec tests changed or retired: none expected; name any in the PR.
  - Owner_Patches attached: none.
  - QA shots: none on screen; the PR attaches the rendered `<head>` of `/` and `/demo` as text.
  - QA steps: 08-14 (titles and absolute `og:*` on `/`; the other routes after task 11).
  - Validation: `bash scripts/check.sh`
  - _Requirements: R12.1, R12.2, R12.3, R12.5_

- [ ] 11. Landing copy, the footer, the How_Page, the Apple icon and Open Graph image, and per-page titles
  - Agent: `frontend-dev` · Depends on: 10 · Estimated size: ~1,400 changed lines
  - Before this task: task 10 is on `main`.
  - Scope: `src/components/ceremony/scene/copy.ts` (landing keys), `src/components/ui/Footer.tsx` (new), `src/components/ui/copy.ts` (new), `src/components/ui/index.ts`, `src/components/how/copy.ts` (new), `src/app/how-it-is-sealed/page.tsx` (new), `src/app/apple-icon.tsx` (new), `src/app/opengraph-image.tsx` (new), `src/components/ceremony/ASSETS.md`, the metadata exports of `src/app/demo/page.tsx`, `src/app/demo/personas/[key]/page.tsx`, `src/app/demo/live/page.tsx`, `src/app/l/[id]/page.tsx` and the two `not-found.tsx` pages, the copy and import scan tests under `src/components` (additions only), and the `*.test.ts(x)` for each file above
  - Design sections: "Pages and the Top_Bar" (footer), "Metadata, icons and the Open Graph image", "How_Page (`src/app/how-it-is-sealed/page.tsx`)", "Copy" (`landing.*`, `footer.*`, `how/copy.ts`), Owner patches d and e.
  - Acceptance:
    - `scene/copy.ts` gains the landing keys of design.md "Copy" with exactly that text: the four `landing.paragraphs`, `demoLinkOne`, `demoLinkMany`, `liveLink`, `liveNote`, `realLink`, `howLink`, `sourceLink`. They name the classroom time capsule and the future self, describe the figures as fuel prices for the United States and the European Union only, and name no groceries, rent or other region (R10.1, R10.2). `page.tsx` is not edited here; task 12 wires them.
    - `ui/Footer.tsx` is a server component that renders a `<footer>` element (the FT1 check reads that element), with a `--bg` background, `position: relative; z-index: 3`, at most `FOOTER_MAX_PX` (64) tall, holding a link to `/how-it-is-sealed` and a link to exactly `https://github.com/devclef/Revenant` (R12.4). `layout.tsx` renders it in task 12.
    - The How_Page at `/how-it-is-sealed` is a server component on `SceneShell variant="plain"` with one `h1` and the six sections of the design's table, plus the date limitation sentence. Each statement of R18.1 to R18.5 is present; no exclamation mark; every claim is tied to the code the table names (R18.1 to R18.6, R18.8). It imports nothing from `src/lib/crypto`, `src/lib/cards` or `src/lib/ics` and stays within 130 kB first-load JavaScript (R18.7).
    - `apple-icon.tsx` (180×180) and `opengraph-image.tsx` (exactly 1200×630, exported `size = { width: 1200, height: 630 }`) are `next/og` `ImageResponse`s drawn from `ghost-geometry.ts`, with the landing headline and "receipts." in the Accent on the Open Graph image, using the default `next/og` font. No dependency is added (R12.1, R12.3, R1.6).
    - `ASSETS.md` gains rows for `public/icon.svg`, `src/app/apple-icon.tsx` and `src/app/opengraph-image.tsx`: how each was made, licence "original", date added, not AI-generated, no Kiro logo or mascot (R12.1, R12.5).
    - Every frontend-dev route calls `pageMetadata` with the page names of the design's table: "Demo letters", "{name}'s letter", "Seal a demo letter", "Your letter", "How a letter is sealed", and "Not found" for the not-found pages (R12.2, R12.3).
  - Tests: none of the numbered properties. Example tests: the route titles are unique (not-found pages excepted; see the not-found page titles item in design.md "Open items for the owner"); the How_Page holds each R18.1 to R18.5 statement and its import scan finds no `lib/crypto`, `lib/cards` or `lib/ics`; the three new `ASSETS.md` rows pass `assets.test.ts`; the Open Graph `size` export; the footer links; the landing copy names "time capsule" and "future self", no "groceries" or "rent", and exactly the Catalogue regions.
  - Earlier-spec tests changed or retired: `scene/copy.test.ts` (new landing paragraphs); name any other in the PR.
  - Owner_Patches attached: d (`.kiro/steering/structure.md`: the `how-it-is-sealed/` and `api/figures/` lines; the `seal/` line waits for task 22) (R29.3); e (`scripts/check-js-budget.mjs`: `{ route: "/how-it-is-sealed", key: "/how-it-is-sealed/page", maxKb: 130 }`) (R29.5).
  - QA shots: `how-it-is-sealed` at 1366x800, 1280x800 and 360x640; `/opengraph-image` as rendered.
  - QA steps: 08-14, 08-16.
  - QA check: X1 `scroll-width` PASS on the How_Page at all three sizes; the wordmark goes to `/` (R3.4, R11.2).
  - QA check: no regression: every check that printed PASS before this task still prints PASS at all three sizes.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R1.6, R10.1, R10.2, R11.2, R12.1–R12.5, R18.1–R18.8, R29.3, R29.5, R29.6_

- [ ] 12. The footer on every page and the landing links
  - Agent: `platform-dev` · Depends on: 5, 11 · Estimated size: ~200 changed lines
  - Before this task: tasks 5 and 11 are on `main`.
  - Scope: `src/app/layout.tsx` (renders `Footer` after `{children}`), `src/app/page.tsx` (landing copy, links and metadata), `src/test/landing.test.tsx`, and new `*.test.ts(x)` files under `src/test/`
  - Design sections: "Pages and the Top_Bar" (footer), "Copy" (`landing.*`), "The Landing_Ghost" (`.landingCta`).
  - Acceptance:
    - `layout.tsx` renders `Footer` once, after `{children}`, so it comes after all other content in document order on every page and does not meet the Soil strip or any Stage content at a Check_Size (R12.4, R12.6).
    - `page.tsx` takes its paragraphs and link text from `scene/copy.ts`: the Resurrection sentence first (R10.1), the fuel-prices paragraph naming the US and EU only (R10.2), and the demo link "Open the demo letter" while the Persona_List holds one persona and "Open the demo letters" for two or more, read from the Persona_List at render (R10.3).
    - The landing shows the GitHub link with target exactly `https://github.com/devclef/Revenant` (R10.4), the How_Page link (R10.6), and, with real sealing off (always, until task 20), the Seal_Page link with the 30-second note next to it and no link to `/seal` (R10.5).
    - `/` calls `pageMetadata(null, "/")`, so its title stays "Revenant" and it gets the full Open Graph set.
    - The landing keeps exactly one `h1` and one Accent button, the Landing_Ghost, and its budget of 130 kB (R9.9, R9.14).
  - Tests: none of the numbered properties. Example tests of design.md "Testing Strategy" for the landing copy (R10.1 to R10.6): singular and plural link for 1 and 2 personas, the exact GitHub URL, the How_Page link, the live link and note; the footer is the last element of the layout body.
  - Earlier-spec tests changed or retired: `src/test/landing.test.tsx` (new links and copy; the R9.15 tests stay). `src/app/page.test.tsx` is a frontend-dev path and stays unchanged; it still passes because the `/demo` link stays.
  - Owner_Patches attached: none.
  - QA shots: `scene` of `/` at 1366x800, 1280x800 and 360x640, and `footer` (scrolled to the end) of `/`, `/demo`, `/demo/personas/us-maya`, `/demo/live` and `/how-it-is-sealed` at the same sizes.
  - QA steps: 08-10, 08-15.
  - QA check: LG1 `landing-ghost` still PASS at all three sizes with the new copy (R9.11).
  - QA check: FT1 `footer` prints PASS on every page reached, reading the `<footer>` element this task renders: no contact with the Soil strip (polish row, values recorded) (R12.6).
  - QA check: every check that printed PASS before this task still prints PASS at all three sizes.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R9.9, R9.14, R10.1–R10.6, R12.4, R12.6_

- [ ] 13. Promise audit, the regions search test, and the README, write-up and steering patches
  - Agent: `frontend-dev` · Depends on: 12 · Estimated size: ~400 changed lines
  - Before this task: task 12 is on `main`. The README Sweden lines are already on `main`: line 20 names fuel prices for the US or the EU and has no self-reported clause, and line 46 names only a recent US election window. The README already passes the R23.3 search, so there is nothing to wait for.
  - Scope: the frontend-dev copy modules (`src/components/**/copy.ts`), `src/components/live/LetterCard.tsx` and `live/BackupKeyCard.tsx` (card wording only, if the audit finds an untrue claim), `src/components/regions-scan.test.ts` (new), and the `*.test.ts(x)` for each copy module changed
  - Design sections: "Sweden is out of scope (R23)" (search test, README, steering), "How_Page" (the claims table), Owner patches f, g and k.
  - Acceptance:
    - The PR description lists every user-facing claim about what Revenant does in the copy modules, the landing page, the How_Page, the README and the letter and backup key cards, each paired with the file and symbol or data file that makes it true (R19.1).
    - Any claim with no code or data on `main` behind it is rewritten or removed in this PR; a claim in `page.tsx` or `layout.tsx` is listed for the owner and fixed through the copy module it reads from (R19.2).
    - `regions-scan.test.ts` reads `README.md`, every `copy.ts` under `src/components/`, `src/app/how-it-is-sealed/page.tsx`, `src/lib/figures/catalogue.ts`, `locale.ts` and `format-change.ts`, and fails on a case-insensitive match of `Swed`, `SCB`, `sv-SE` or the whole word `SEK`. It reads no test file, nothing under `src/lib/sources/__recorded__/**`, and no guard list such as `src/lib/personas/banned-terms.ts` (R23.3, R23.6).
    - The Persona_List guard (exactly the US and EU keys, R23.2) is added in task 18 with the EU persona, not here.
  - Tests: none of the numbered properties. The R23.3 search test above.
  - Earlier-spec tests changed or retired: the copy tests of any module whose wording changes; name each in the PR.
  - Owner_Patches attached: f (`README.md`: the "Status" section lists every merged feature as done, including the persona demo, the passkey demo, the backup key card, the letter card, the `.ics` file and the Scene, and only unmerged work as later; adds the sentence on depending on the Revenant server. The README Sweden lines (R23.4) are already on `main` and are not part of this patch) (R19.3, R19.4); g (`docs/kiro-writeup.md` draft from the git history, `.kiro/specs/` and `docs/agent-loop.md` only, stating the `main` SHA every count was taken at, naming the command or file behind every number, leaving out any number that cannot be recomputed, and describing how the reveal layout bug passed QA: 1366×800 not covered, and no Figures_Heading focus and in-viewport check, no Letter_Text width check and no scroll width check) (R28.1 to R28.5); k (`.kiro/steering/product.md`, `tech.md` and `structure.md`: every Sweden data mention by file and line on the base commit, each with a proposed replacement, for the owner to keep, mark post-MVP or remove; the PR commits none of them) (R23.5).
  - QA shots: `scene` of `/` and `how-it-is-sealed` at 1366x800, 1280x800 and 360x640, only if this PR changes their copy.
  - QA steps: 08-10, 08-16.
  - QA check: every claim in the audit list names a file and symbol on `main`; the regions search passes on `main` (R19.1, R23.3).
  - QA check: no regression: every check that printed PASS before this task still prints PASS at all three sizes.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R19.1–R19.4, R23.3–R23.6, R28.1–R28.5, R29.6_

### Group 4: daily fetch and freshness alert

- [x] 14. The Figures_API in file mode, fetch status, a fallback-ready prefetch, and the local now pick
  - Agent: `data-dev` · Depends on: 6 · Estimated size: ~900 changed lines
  - Before this task: task 6 is on `main`. This task lands first in group 4 so the 16 November fallback needs no code.
  - Scope: `src/app/api/figures/route.ts` (new), `src/lib/figures/now.ts` (new), `src/lib/figures/real/fetch-status.json` (new), `src/lib/figures/index.ts` (exports), `src/lib/sources/prefetch.ts`, `src/lib/sources/refresh.ts`, `src/lib/sources/fetcher.ts` (optional `timeoutMs`), `scripts/prefetch-figures-main.ts`, `scripts/prefetch-figures.mjs`, and the `*.test.ts` for each file above
  - Design sections: "The daily figure fetch" ("Adapters", "Per series, in order" steps 1, 2 and 4), "The Figures_API", "Fallback_Refresh (R21.1, R21.2)", "Error Handling" (Figures_API fails, response invalid).
  - Acceptance:
    - `GET /api/figures` returns `FiguresResponseV1` with exactly one entry per Catalogue series, in Catalogue order: its metric definition, `period_type`, `last_success_at` (or `null`) and the stored figure with the latest period and, within it, the newest `retrieved_at` (or `null`). It reads no query parameter (R20.8, R21.5). `Cache-Control: public, max-age=600, stale-while-revalidate=3600`.
    - `source_mode` comes from `FIGURES_SOURCE` (`db` or `file`, default `db`). This task ships `file` mode: figures from `fuel-figures.json` through `DEMO_FIGURES`, and `last_success_at` from `fetch-status.json`; a series missing from it, or a missing file, gives `null`. The newest `retrieved_at` is never used as a stand-in. Until task 16 lands, `db` mode answers as `file` mode does and the PR says so.
    - `npm run prefetch` meets R21.2 on its own: the same adapters; the design's per-series validation (zero figures, a missing provenance field, a non-finite value, a period that does not fit the Catalogue's `period_type`, a duplicate period) stores nothing from a failed series; real `retrieved_at` per fetch; a changed value for a stored period is appended as a Revision_Row and no existing row changes; `fetch-status.json` gets the run start time for each successful series (including "no new period") and keeps a failed series' entry; exit 1 if any series failed. The validation is exported so task 16's `fetch-job.ts` reuses it (R20.3 to R20.6, R20.13, R20.14, R20.17, R20.18).
    - `fetcher.ts` gains an optional `timeoutMs`, keeping its 60 s default.
    - `now.ts` exports `parseFiguresResponse` and `pickNow` exactly as the design states: an official then figure matches the one entry whose source, series ID, unit and region all equal the sealed metric's; a match with `figure: null` gives `no_figure`; no match gives `series_missing`; a self-reported figure never matches (R20.9).
    - The file-mode body holds only US and EU series; a guard test fails on any Sweden region or `SEK` unit (R23.1).
  - Tests: Property 23 (the Figures_API lists every series with its latest figure and Last_Success_Time), the file-mode part; Property 24 (the browser picks the now figure by its series alone). Example tests: the route returns one entry per Catalogue series with `Cache-Control`, ignores `?metric=`, and gives `last_success_at: null` for a series missing from `fetch-status.json`; the prefetch revision and status rules.
  - Earlier-spec tests changed or retired: `src/lib/sources/prefetch.test.ts`, `prefetch-figures-main.test.ts`, `refresh.test.ts` and `refresh.property.test.ts` only where the new validation, Revision_Row and status rules change an asserted value; name each in the PR.
  - Owner_Patches attached: none (patch h waits for task 16, with i and j).
  - QA shots: none (this task changes no page).
  - QA steps: 08-17.
  - QA check: `curl -i <app>/api/figures` shows four series (US and EU only), each with its metric, `last_success_at` or `null`, and a figure with every provenance field or `null`, plus the `Cache-Control` header (R20.8, R21.5).
  - Validation: `bash scripts/check.sh`
  - _Requirements: R20.3–R20.6, R20.8, R20.9, R20.13, R20.14, R20.17, R20.18, R21.2, R21.5, R23.1_

- [ ] 15. The Reveal and the Seal_Page read the Figures_API
  - Agent: `frontend-dev` · Depends on: 13, 14 · Estimated size: ~1,100 changed lines
  - Before this task: tasks 13 and 14 are on `main`.
  - Scope: `src/components/reveal/figures-api.ts` (new), `src/components/reveal/FiguresThenNow.tsx`, `reveal/FigureEntry.tsx`, `reveal/Reveal.tsx`, `reveal/copy.ts`, `src/components/live/SealPage.tsx`, `live/FigurePicker.tsx`, `live/catalogue-list.ts`, `live/copy.ts`, the copy scan tests under `src/components/reveal` (additions only), and the `*.test.ts(x)` for each file above, including `reveal/Reveal.real-figures.test.tsx`, `reveal/FiguresThenNow.test.tsx`, `reveal/FiguresThenNow.live.test.tsx` and the `live/SealPage` tests
  - Design sections: "The Figures_API" (the browser side and unavailable reasons), "The Freshness_Check" ("Wording"), "Copy" (`nowUnavailableFetch`, `nowUnavailableMissing`, `figuresLoadFailed`), "Error Handling" (Figures_API fails).
  - Acceptance:
    - `useFigures()` makes exactly one `GET /api/figures` per reveal, with a 30 s abort, and parses it with `parseFiguresResponse`. The Reveal picks each Now_Figure locally with `pickNow` (R20.9). `DEMO_FIGURES` is no longer the "now" source in the browser; it stays for persona sealing and tests.
    - `series_missing` and `no_figure` show `nowUnavailableMissing` ("no longer published by Revenant"); a failed request, non-2xx status or unparsable body shows `nowUnavailableFetch` ("could not be loaded") on every Now_Figure. In both cases the Then_Figure shows with its period, with no change value and no Number_Line (R20.10). `nowUnavailableUnknown` and `nowUnavailableEmpty` are replaced.
    - Every Now_Figure shows "{period} · {region} · retrieved {date}" on its own line or the line below its value (R21.3). No text that labels or describes a Now_Figure uses "today", "current", "latest" or "live" in any case; a copy test bans them (R21.4).
    - The Seal_Page reads its "then" figures from the same response, so a Live_Letter's then and now match after 30 seconds. If the request fails, the picker shows `figuresLoadFailed` and sealing is blocked, with no fallback to the bundled file.
  - Tests: none of the numbered properties. Example tests: one request per reveal; each unavailable reason with its phrase; the four banned words in every Reveal string about a Now_Figure; the Seal_Page blocks sealing when the request fails.
  - Earlier-spec tests changed or retired: `reveal/Reveal.real-figures.test.tsx`, `reveal/FiguresThenNow.test.tsx`, `reveal/FiguresThenNow.live.test.tsx`, the `live/SealPage` tests (the now figure comes from a stubbed Figures_API response built from `DEMO_FIGURES`, so expected values do not change); the copy tests for the two replaced unavailable strings.
  - Owner_Patches attached: none.
  - QA shots: `close` of `/demo/personas/us-maya`, `write` of `/demo/live` and `close` of `/l/<id>` at 1366x800, 1280x800 and 360x640; `close-unavailable` with `/api/figures` blocked, at the same sizes.
  - QA steps: 08-04, 08-12, 08-17.
  - QA check: B1 `figure-boxes` and L1 `line-labels` still PASS at all three sizes with the API-backed now figures (R3.5, R5.3).
  - QA check: no regression: every check that printed PASS before this task still prints PASS at all three sizes.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R20.9, R20.10, R21.3, R21.4_

- [ ] 16. The Fetch_Job, its tables, the Figures_API database mode, and the Freshness_Check script
  - Agent: `data-dev` · Depends on: 14 · Estimated size: ~3,300 changed lines
  - Before this task: task 14 is on `main`.
  - Gate: 16 November 2026, 23:59:59 UTC (R21.1). If this task is not merged, or no Fetch_Job run on `revenant.devclef.se` has exited 0 by then, the owner switches to the Fallback_Refresh (Owner_Patch h and `figures.source: file`). The task then still merges for the record if it is ready, but no reveal task waits for it. The PR states the date of the first successful run, or that the fallback is in use.
  - Scope: `drizzle/0002_figures.sql` (new), `drizzle/meta/**` (generated), `src/lib/db/schema/figures.ts` (new), `src/lib/sources/fetch-job.ts` (new), `src/lib/sources/fetcher.ts`, `src/app/api/figures/route.ts` (database mode), `scripts/fetch-figures.ts` (new), `scripts/fetch-figures.build.mjs` (new), `scripts/fetch-figures-freshness.mjs` (new), and the `*.test.ts` for each file above. The tests for `scripts/fetch-figures.ts` and `scripts/fetch-figures-freshness.mjs` live under `src/lib/sources/`, because Vitest runs only `src/**`; `src/lib/sources/prefetch-figures-main.test.ts` already works this way
  - Design sections: "The daily figure fetch" (all), "The Figures_API" (`db` mode), "The Freshness_Check (R21.5 to R21.15)", "Data Models" (`figures` and `figure_fetch_runs`, insert if different, Last_Success_Time, latest figure), "Constants" (`FETCH_TIMEOUT_MS`, `FRESHNESS_TIMEOUT_MS`, `FETCH_FAILURE_HOURS`, `PERIOD_AGE_WARN_DAYS`), "Error Handling" (Fetch_Job and Freshness_Check rows), Owner patches h, i and j.
  - Acceptance:
    - `0002_figures.sql` creates `figures` and `figure_fetch_runs` with the columns, checks, indexes and the `revenant_forbid_change()` UPDATE, DELETE and TRUNCATE triggers of design.md "Data Models"; `value` is `numeric` with no precision limit (R20.3, R20.5). The triggers are appended by hand after the generated DDL, as in `0000`.
    - `runFetchJob(deps)` in `fetch-job.ts` requests every Catalogue series once through its adapter with `FETCH_TIMEOUT_MS` (30,000), validates each result whole before any write, and writes each series in its own transaction under `pg_advisory_xact_lock`, inserting a figure only if it differs from the newest-`retrieved_at` row for its series and period. Equal adds nothing; different adds a Revision_Row; the Figures_API serves the newest (R20.1, R20.4, R20.17).
    - Outcomes: `stored` or `no_new_period` are successes and record the run's UTC start as the Last_Success_Time; `failed` stores nothing from that series and leaves its Last_Success_Time unchanged. Every series is attempted; the other sources' figures are committed; exit 1 when any series failed, else 0 (R20.6, R20.14 to R20.16, R20.18).
    - A database that cannot be reached, or a failed write, keeps every stored row, counts the affected series as failed and exits 1. Logs are one line per series with a fixed reason token and never a key, URL query or connection string (R20.6, R20.19).
    - Seeding: on a `figures` table with zero rows the job first inserts every figure of `fuel-figures.json` unchanged, in one transaction, writing no run row (R20.12).
    - The job only inserts. `scripts/fetch-figures.ts` wires the Postgres store and sets `process.exitCode`; `fetch-figures.build.mjs` bundles it to `scripts/fetch-figures.mjs` like the other script builds. No HTTP endpoint starts a run (R20.7).
    - `db` mode of `GET /api/figures` reads the latest figure per series and the Last_Success_Time with the design's queries (R20.8, R21.5).
    - `fetch-figures-freshness.mjs` is plain ESM on Node 22 built-ins. It exports `classifyFreshness` and `planIssue` exactly as the design states, requests `https://revenant.devclef.se/api/figures` once with a 30 s abort and no credential, and manages one Freshness_Issue through the GitHub REST API with `GITHUB_TOKEN`, assigned to `FRESHNESS_ASSIGNEE`, labelled `freshness:failure` or `freshness:warning`, creating the labels if missing. It exits 1 on `fail` or a GitHub API error, else 0. `main()` runs only when the file is the entry point (R21.6 to R21.13).
    - The adapters fill no gap, convert no currency and substitute nothing (R20.13).
  - Tests: Property 20 (the Fetch_Job stores what the source published, with full provenance); Property 21 (re-running the Fetch_Job adds zero rows, and a changed value adds one Revision_Row); Property 22 (exit status and isolation per series); Property 23 (the Figures_API lists every series with its latest figure and Last_Success_Time), the database-mode part with an in-memory store; Property 25 (freshness classification is fail, warn or pass by the two rules). Example tests: one per R30.4 item with the in-memory `FigureStore` call log; seeding the real file stores every row equal field by field and writes no run row; the Freshness_Check 48-hour edge, `2026-02` dated 28 February, `last_success_at: null` fails, empty `series` fails, the four `planIssue` rows, and no token sent to `revenant.devclef.se`. The Postgres tests of the triggers and the insert-if-different query need `src/test/integration/**`, a crypto-dev path; they ship in task 19 against this task's store.
  - Earlier-spec tests changed or retired: `src/lib/sources/fetcher.test.ts` only if the timeout option changes an asserted value; name any in the PR.
  - Owner_Patches attached: h (`.github/workflows/refresh-figures.yml`, the Fallback_Refresh, with only `workflow_dispatch` until the switch. Its push uses `GITHUB_TOKEN`, which starts no workflow, so after the push the workflow runs `gh workflow run ci.yml --ref main`, with permissions `contents: write` and `actions: write`. It assumes `build.yml`'s `workflow_run` trigger (`workflows: [ci]`, `branches: [main]`) fires for that dispatched `ci` run. Owner steps, in this order: (a) commit patch h after task 14 merges, because its commit step adds `fetch-status.json`, which task 14 creates; (b) run `refresh-figures` by hand once before 16 November 2026, confirm a new image tag appears in GHCR, and roll out the new image on the cluster (the `dev` tag needs `image.pullPolicy: Always` and a pod restart, per `deploy.md`); (c) if the 16 November gate triggers, add back `schedule: - cron: "30 6 * * *"` and set `figures.source: file` in the GitOps values. No Fleet config goes in the repo) (R21.1, R21.2); i (`.github/workflows/freshness-check.yml` with `cron: "17 */6 * * *"`, `workflow_dispatch`, `permissions: { issues: write }` only and `FRESHNESS_ASSIGNEE: devclef`, and `.github/workflows/keepalive.yml` with `cron: "41 3 * * 1"` and `permissions: { actions: write }` only, re-enabling both workflows weekly; the patch states the three layers that keep the schedule enabled through 29 January 2027, including the owner's 15 January 2027 reminder) (R21.9, R21.14). Patches h and i pin their actions as `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1` and `actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0`; j (`.github/labels.json`: `freshness:failure` and `freshness:warning` with neutral descriptions).
  - QA shots: none (this task changes no page).
  - QA steps: 08-17 in `db` mode against a seeded local database; 08-22 is an owner step after patch i is committed, not a QA blocker.
  - QA check: `npm run build` then `node scripts/fetch-figures.mjs` against a local Postgres seeds once, exits 0 on a second run with every series `no_new_period` or `stored`, and adds zero rows on a third run with the same data (R20.4, R20.12, R20.15). The QA agent records the log lines.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R20.1, R20.3–R20.8, R20.12–R20.19, R21.1, R21.5–R21.14, R30.2, R30.4_

- [ ] 17. The Fetch_Job CronJob in the image and the Helm chart
  - Agent: `platform-dev` · Depends on: 12, 16 · Estimated size: ~350 changed lines
  - Before this task: tasks 12 and 16 are on `main`. (Task 12 is added because both tasks add new `*.test.ts(x)` files under `src/test/`.) This task merges before the Fetch_Job is first deployed (R20.11).
  - Scope: `Dockerfile`, `package.json` (build step for `scripts/fetch-figures.build.mjs`), `.env.example`, `deploy/helm/revenant/templates/cronjob-fetch-figures.yaml` (new), `deploy/helm/revenant/templates/configmap.yaml`, `deploy/helm/revenant/values.yaml`, `deploy/helm/revenant/Chart.yaml`, `deploy/helm/revenant/README.md`, and new `*.test.ts` files under `src/test/`
  - Design sections: "Chart values (platform-dev)", "Environment" (`FIGURES_SOURCE`), "The Freshness_Check" ("Failed CronJob runs stay visible").
  - Acceptance:
    - The image contains `scripts/fetch-figures.mjs`, built by the `npm run build` step, so the web pod, migrations and the job share one image.
    - `cronjob-fetch-figures.yaml` renders one CronJob when `fetchFigures.enabled` is true: `node scripts/fetch-figures.mjs`, `schedule` and `timeZone` from values (default `"17 6 * * *"`, `Etc/UTC`, one run per UTC day), `concurrencyPolicy: Forbid`, `backoffLimit: 0`, `startingDeadlineSeconds`, `activeDeadlineSeconds`, `successfulJobsHistoryLimit` and `failedJobsHistoryLimit` from values (default 3, at least 1), `restartPolicy: Never`, `DATABASE_URL` from `existingSecret`, and the web pod's security contexts (R20.2, R20.7, R21.15).
    - The ConfigMap renders `FIGURES_SOURCE` from `figures.source` (default `db`); `.env.example` lists `FIGURES_SOURCE=` with no value. The chart renders no Secret; the chart README says where a source API key would go (none is needed today) (R20.11).
    - Chart `version` goes from 0.3.0 to 0.4.0.
    - The site keeps serving the Figures_API and the Reveal through 29 January 2027; nothing in the chart removes or schedules them off (R21.16).
  - Tests: none of the numbered properties. Example test: a `src/test/` test reads `values.yaml` and the CronJob template and asserts `concurrencyPolicy: Forbid`, `backoffLimit: 0`, `failedJobsHistoryLimit` at least 1, the schedule from values, and `FIGURES_SOURCE` in the ConfigMap. `helm lint` and `helm template` run in `check.sh` and must render no Secret.
  - Earlier-spec tests changed or retired: none expected; name any in the PR.
  - Owner_Patches attached: none.
  - QA shots: none (this task changes no page).
  - QA steps: none. The QA agent runs `helm template ci deploy/helm/revenant` and checks the CronJob fields against R20.2, R20.7 and R21.15.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R20.2, R20.7, R20.11, R21.15, R21.16_

### Group 5: EU persona

- [ ] 18. The EU persona
  - Agent: `frontend-dev` · Depends on: 15 · Estimated size: ~450 changed lines
  - Before this task: task 15 is on `main`. Must merge by 27 November 2026 (R31.5).
  - Scope: `content/personas/personas.json`, `content/personas/letters/eu-<name>.txt` (new), `src/lib/personas/schema.ts` (`opening_event`), `src/lib/personas/index.ts`, and the `*.test.ts` files under `src/lib/personas/`
  - Design sections: "EU persona (R22)", "Sweden is out of scope (R23)" (Persona_List guard).
  - Acceptance:
    - `personas.json` gains exactly one entry, `key` `eu-<name>`, `region` "European Union", a new random `letter_id`, `opens_at` `2024-06-09T00:00:00.000Z` (or 6, 7 or 8 June if the reviewed text places the persona in a member state that voted then, stated in the PR), and `written_as_of` on or after `2023-06-05` and before its `opens_at` date (R22.1, R22.8).
    - It tracks exactly `eu-petrol-euro95` and `eu-diesel`, with no self-reported and no fixture figure. A test asserts that the `thenAndNow` pick for each equals the row of `fuel-figures.json` with the latest period on or before `written_as_of`, field for field; if the two rules differ for the chosen date, pick a date where they agree and say so, rather than change `then-now.ts` (R22.2).
    - `opening_event` is a new optional strict object on the persona schema with `name`, `date`, `source` "European Parliament" and an `https` `source_url` of the official page used, recorded in the PR (R22.8).
    - The letter text is plain text of 1 to 5,000 characters about everyday life, passes `checkLetterText`, and mentions no party, candidate, official, movement, policy, election outcome, opinion on the election or voting intention, and no group as better or worse off (R22.3).
    - The PR records the `neutrality.md` copy test review of the full letter text with the reviewer's name and pass or fail. The persona is sealed only from a PR whose result is pass (R22.4).
    - The persona page labels each figure "historical record, retrieved {date}", states that the letter was written as of its date and prepared later as a demo, and never says it was sealed on that date (R22.6). Its recall questions show the Unit_Helper_Line and the 0 to 3,000 scale from task 3.
    - A test fails unless the Persona_List keys are exactly the US key and this EU key (R23.2). The landing link becomes "Open the demo letters" with no code change (task 12).
  - Tests: none of the numbered properties. Example tests of design.md "Testing Strategy" for the persona schema (as-of bounds, `opens_at` day, `opening_event`, the figure pick, the Persona_List keys).
  - Earlier-spec tests changed or retired: persona list tests that assert one persona, and the landing singular-link test, if they read the real list; name each in the PR.
  - Owner_Patches attached: l (`README.md`: line 46 adds the EU election window, text in design.md Owner patch l).
  - QA shots: `intact`, `recall`, `letter` and `close` of `/demo/personas/eu-<name>`, and `/demo`, at 1366x800, 1280x800 and 360x640.
  - QA steps: 08-20, 08-21 (on the EU persona).
  - QA check: `npm run layout-check` on the EU persona page reports no BLOCKER at all three sizes, including W1, N1, B1, L1 and R1 with the reading group shown (R3, R5.3, R8.2).
  - QA check: no regression: every check that printed PASS before this task still prints PASS at all three sizes.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R22.1–R22.4, R22.6, R22.8, R23.2_

- [ ] 19. FIXTURE guard in persona sealing, and the Postgres tests for the EU persona and the figures tables
  - Agent: `crypto-dev` · Depends on: 16, 17, 18 · Estimated size: ~100 changed lines (integration tests excluded from the count)
  - Before this task: tasks 16, 17 and 18 are on `main`: task 16 for the figures-table tests, task 18 for the EU persona this task seals, and task 17 because its new `*.test.ts` files under `src/test/` can match `src/test/integration/figures.test.ts`. Must merge by 27 November 2026 (R31.5).
  - Scope: `scripts/seal-personas-core.ts`, `scripts/seal-personas.build.mjs` (only if the new letter file must be listed for the build), `src/test/integration/seal-personas-core.test.ts`, `src/test/integration/seal-personas.test.ts`, `src/test/integration/figures.test.ts` (new), `src/test/integration/setup.ts` (truncate list, additions only), and the `*.test.ts` next to `scripts/seal-personas-core.ts`
  - Design sections: "EU persona (R22)" (FIXTURE guard, idempotent sealing), "Data Models" (`figures`, insert if different), "Testing Strategy" ("Integration tests").
  - Acceptance:
    - Before its first write, `seal-personas-core.ts` checks every figure of every persona. If any `source` or `series_id` starts with `FIXTURE`, it exits with an error naming the persona key and the series ID and writes nothing to any table (R22.7).
    - Running the script seals the EU persona into `demo_letters` with the published demo key and adds no `letters` row; a second run with unchanged inputs adds no row and leaves the stored EU row unchanged (R22.5).
    - `figures.test.ts` (skipped without `DATABASE_URL`) checks that the `figures` and `figure_fetch_runs` triggers reject UPDATE, DELETE and TRUNCATE, that the insert-if-different query adds no row for an equal value and one row for a different value, and that task 16's Postgres store passes the same R30.4 cases as the in-memory store (R20.4, R20.5, R20.17). These tests are here because `src/test/integration/**` is a crypto-dev path.
  - Tests: none of the numbered properties. The integration tests above, plus a unit test of the FIXTURE guard with a fake store.
  - Earlier-spec tests changed or retired: none expected; name any in the PR.
  - Owner_Patches attached: none.
  - QA shots: none (this task changes no page).
  - QA steps: none. The QA agent runs `npm test` with Postgres as CI does and reads the diff against R22.5, R22.7 and `crypto.md`.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R20.4, R20.5, R20.17, R22.5, R22.7, R30.4_

### Group 6: real sealing

- [ ] 20. The real sealing flag, its chart values, and the landing link behind it
  - Agent: `platform-dev` · Depends on: 12, 17, 19 · Estimated size: ~250 changed lines
  - Before this task: tasks 12, 17 and 19 are on `main`. (Task 19 is added because this task's new `*.test.ts(x)` files under `src/test/` can match task 19's `src/test/integration/figures.test.ts`.)
  - Gate: on a no-go on 20 November 2026 this task stays merged with the flag off, so `/seal` and its routes stay off and the landing shows no link (R25.2).
  - Scope: `src/lib/feature-flags.ts` (new), `src/app/page.tsx` (the `/seal` link behind the flag), `deploy/helm/revenant/templates/configmap.yaml`, `deploy/helm/revenant/values.yaml`, `deploy/helm/revenant/Chart.yaml`, `deploy/helm/revenant/README.md`, `.env.example`, `src/test/landing.test.tsx`, and new `*.test.ts(x)` files under `src/test/` or next to `src/lib/feature-flags.ts`
  - Design sections: "Real sealing" ("Flag"), "Environment" (`REAL_SEALING`), "Chart values (platform-dev)".
  - Acceptance:
    - `realSealingOn()` in `src/lib/feature-flags.ts` is server-only and true only when `process.env.REAL_SEALING?.trim() === "on"`; unset or any other value is off (R25.3, R25.4).
    - Chart value `realSealing: false` renders `REAL_SEALING: "off"` in the ConfigMap and `true` renders `"on"`. `.env.example` lists `REAL_SEALING=` with no value. Chart `version` goes to 0.5.0. Switching needs no code change or new image (R25.3).
    - While the flag is on, the landing shows `landing.realLink` to `/seal`; while it is off, it shows no `/seal` link and keeps the Seal_Page link with the 30-second note (R10.5, R24.9).
  - Tests: Property 27 (real sealing is off unless the setting is exactly on). Example tests: both flag states of the landing links; the ConfigMap renders `REAL_SEALING` for both chart values.
  - Earlier-spec tests changed or retired: none expected; name any in the PR.
  - Owner_Patches attached: none.
  - QA shots: `scene` of `/` at 1366x800, 1280x800 and 360x640 with the flag off, and with it on if a restart is possible.
  - QA steps: 08-18 (the landing part), 08-19 (the landing part, skipped as a minor finding if a restart is not possible).
  - QA check: LG1 `landing-ghost` still PASS at all three sizes in both flag states (R9.11).
  - QA check: no regression: every check that printed PASS before this task still prints PASS at all three sizes.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R10.5, R24.9, R25.2, R25.3, R25.4, R30.2_

- [ ] 21. The 3-calendar-month rule, real letter drafts and the real seal routes
  - Agent: `crypto-dev` · Depends on: 19, 20 · Estimated size: ~1,600 changed lines
  - Before this task: tasks 19 and 20 are on `main`.
  - Gate: 20 November 2026 go or no-go (R25.1). Go needs every R24 test of this task and task 22 passing in `bash scripts/check.sh`. On no-go an open PR is closed unmerged; if it has merged, it stays behind the off flag, which this task's tests cover.
  - Scope: `src/lib/seal-format/opening-date.ts` (new), `src/lib/seal-format/index.ts` (exports), `drizzle/0003_letter_drafts.sql` (new), `drizzle/meta/**` (generated), `src/lib/db/schema/letters.ts` (`letterDrafts`), `src/lib/letter-store/real.ts` (new), `src/lib/letter-store/drafts.ts` (`createDraft` gains `table`), `src/lib/letter-store/index` exports if present, `src/app/api/letters/prepare/route.ts` (new), `src/app/api/letters/seal/route.ts` (new), `src/lib/crypto/passkey.ts` (optional `userName`), `src/test/integration/**` (new real-letter tests), and the `*.test.ts` for each file above
  - Design sections: "Real sealing" (sequence, routes, drafts, the 3-calendar-month rule), "Data Models" (`letter_drafts`, the seal response, the real seal errors), "Constants" (`SEAL_MARGIN_MS`, `REAL_LOCK_MONTHS`), "Error Handling" (real seal too early or invalid, real sealing off).
  - Acceptance:
    - `opening-date.ts` exports `addCalendarMonthsUtc`, `addCalendarMonthsLocal`, `opensAtFor`, `earliestOpeningDate` and `meetsRealLock` exactly as the design states: the same day three months later or that month's last day; 00:00 of the picked date in the zone, or the first instant of the day in a DST gap; the earliest date takes the later of the local and UTC rules plus `SEAL_MARGIN_MS` (15 minutes) (R24.2, R24.3).
    - `POST /api/letters/prepare` and `POST /api/letters/seal` use the demo routes' body schema, size limit and error mapping. While `realSealingOn()` is false both return 404 `{ "error": "real_sealing_off" }` and store nothing (R25.4, R25.5).
    - The seal route accepts a Real_Letter only if the envelope hash checks and `opens_at` meets `meetsRealLock` against the server's UTC clock; an earlier `opens_at` gets 422 `opens_at_too_early`, an invalid body 400, and neither stores a row. An accepted letter goes only into `letters` and its draft is deleted; the response is `201 { letterId, sealedAt, opensAt, envelopeHash }` (R24.4, R24.5, R14.1). `opens_at` is the only time value read from the request; the server sets `sealed_at` (R24.14).
    - `letter_drafts` has the columns and checks of `demo_letter_drafts`; `letters`, its `letters_opens_at_min_lock` check and its triggers are unchanged, so an UPDATE or DELETE on a Real_Letter row raises and leaves it unchanged (R24.12).
    - `createPasskey` gains an optional `userName`, defaulting to `PASSKEY_USER_NAME`. It is the only `src/lib/crypto` change in this spec (R24.13). The server still releases the server secret only when its UTC clock is at or after `opens_at` (R24.14).
    - The Live_Letter routes, the 30-second lock and the demo tables behave as before, and their tests pass unchanged (R24.7).
  - Tests: Property 5 (opening dates are local midnight and at least 3 calendar months away); Property 26 (the server's real lock boundary). Example tests (R30.5): rejects `opens_at` one millisecond before server UTC + 3 calendar months with 422; accepts it at the boundary; unset and `"yes"` are off; every request while off is 404 and stores nothing. Integration tests: the `letter_drafts` round trip, the database rejecting a Real_Letter under 3 months, and the triggers on a Real_Letter row.
  - Earlier-spec tests changed or retired: `letter-store/drafts.test.ts` for the new `table` argument; name any other in the PR.
  - Owner_Patches attached: none.
  - QA shots: none (this task changes no page).
  - QA steps: none. The QA agent reads the diff against R24, R25 and `crypto.md` and runs the tests with Postgres.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R14.1, R24.2–R24.5, R24.7, R24.12–R24.14, R25.4, R25.5, R30.2, R30.5_

- [ ] 22. The Real_Seal_Page at `/seal`
  - Agent: `frontend-dev` · Depends on: 18, 21 · Estimated size: ~1,800 changed lines
  - Before this task: tasks 18 and 21 are on `main`.
  - Gate: the owner records go or no-go in this task's issue on 20 November 2026 (R25.1). Go needs every R24 test passing and one Real_Letter sealed on `revenant.devclef.se` with its countdown checked, which needs this branch deployed with `realSealing: true`. On no-go the PR is closed unmerged, or, if merged, stays behind the off flag. On a go, production runs a `v*` version tag, not `dev`, because `deploy.md` says `dev` must not serve an installation that holds real letters: the owner cuts the tag and pins `image.tag` to it in the GitOps values before setting `realSealing: true`.
  - Scope: `src/app/seal/page.tsx` (new), `src/components/live/SealPage.tsx` (`mode`), `live/RealDatePicker.tsx` (new), `live/api.ts` (`realSealApi`), `live/copy.ts` (`REAL_COPY`), `live/useSealFlow.ts` and `live/seal-runner.ts` (only to pass `opensAt` and `userName` in `real` mode), `live/SealedView.tsx` (the real sealed body), `src/components/ceremony/close/Close.tsx` (`kind: "real"`), `src/components/reveal/OpeningFlow.tsx` (close kind), and the `*.test.ts(x)` for each file above
  - Design sections: "Real sealing" ("The page", "Opening"), "Copy" (`REAL_COPY.*`), "Error Handling" (real seal too early or invalid, timezone unknown), Owner patches d and e.
  - Acceptance:
    - `/seal` is a server component with `dynamic = "force-dynamic"`. While `realSealingOn()` is false it calls `notFound()`; otherwise it renders `SceneShell variant="plain"` and `SealPage mode="real"` (R25.5).
    - `SealPage mode="real"` runs the same steps in the same order as the Seal_Page (Write, figures, PRF_Check, passkey, backup key card, letter card, `.ics`), with the PRF_Hint on its Write step (R24.1, R16.1).
    - `RealDatePicker` is `<input type="date" min={earliest}>` with `REAL_COPY.dateLabel`, `dateHint` and the chosen date in the R15.1 format. `opensAt` is `opensAtFor(date, browserTz)` and is the only time sent; the Seal press recomputes `earliestOpeningDate` and refuses a date that became too early before any request. An unknown zone falls back to `UTC` with "It opens at midnight UTC." (R24.2, R24.3, R24.14).
    - `REAL_COPY.testNotice` shows before the passkey step (R24.8). The passkey user name is `Revenant letter · opens {date}` (R24.13).
    - A 422 or 400 keeps the letter text and figures, shows `REAL_COPY.tooEarly` or the invalid message, and lets the user pick another date (R24.5). A failed or unreachable seal shows that nothing was sealed and makes no card, key card or `.ics` (R24.6).
    - A Real_Letter link before `opens_at` shows only "still sealed", the opening date and the time remaining; after it, unlock, recall stored before the letter shows, then reveal, as for a Live_Letter. The close is `kind: "real"` with no `LiveLockNote`; the then label is "sealed with the letter, retrieved {date}" (R24.10, R24.11, R13.2). Existing Real_Letters keep opening when the flag is off (R25.6).
  - Tests: none of the numbered properties beyond tasks 8 and 21. Example tests: `/seal` is not found with the flag off; the step order in `real` mode; the date picker `min`; the too-early path keeps the draft; no keepsakes after a failed seal; the close `kind: "real"`.
  - Earlier-spec tests changed or retired: `live/SealPage` and `ceremony/close/Close.test.tsx` only where the new `mode` and `kind` props change an asserted value; name each in the PR.
  - Owner_Patches attached: d (`.kiro/steering/structure.md`: the `seal/` line, only on a go decision) (R29.4); e (`scripts/check-js-budget.mjs`: `{ route: "/seal", key: "/seal/page", maxKb: 190 }`) (R29.5).
  - QA shots: `write`, `date`, `passkey` and `sealed` of `/seal` with the flag on, and `/seal` not found with it off, at 1366x800, 1280x800 and 360x640.
  - QA steps: 08-18, 08-19.
  - QA check: X1 `scroll-width` PASS on `/seal` at all three sizes (R3.4).
  - QA check: no regression: every check that printed PASS before this task still prints PASS at all three sizes.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R13.2, R16.1, R24.1–R24.3, R24.5, R24.6, R24.8, R24.10, R24.11, R24.13, R24.14, R25.1, R25.5, R25.6, R29.4–R29.6_

## Notes

- **Order and merging.** The dispatcher runs one task at a time and claims the lowest-numbered ready issue whose dependencies are all closed, so "Depends on" decides what can be claimed early, not what runs in parallel. The frontend-dev tasks (1 to 4, 8, 9, 11, 13, 15, 18, 22) form a straight chain because they share `Reveal.tsx`, `FigureEntry.tsx`, `FiguresThenNow.tsx`, the copy modules and `scene/`; tasks 23 and 24 in `later-tasks.md` continue it once moved in. Tasks 6 and 7 share no file with tasks 1 to 5 and can be claimed before them. The data-dev tasks 14 and 16 follow task 6 only, so the file-mode Figures_API and the Fetch_Job can merge before group 3 is done; task 15 waits for both task 13 and task 14. Task 12 waits for tasks 5 and 11, task 18 for task 15, task 19 for tasks 16, 17 and 18, task 20 for tasks 12, 17 and 19, task 21 for tasks 19 and 20, and task 22 for tasks 18 and 21. Every pair of tasks whose Scopes share a file, a glob or a test list has a dependency path between them. Four of these dependencies exist only because both Scopes allow new `*.test.ts(x)` files under `src/test/`: task 10 on task 5, task 17 on task 12, task 19 on task 17 (its `src/test/integration/figures.test.ts`), and task 20 on task 19 (the same file). Narrowing those Scope lines would let the owner drop them.
- **Numbering.** The task list format allows whole task numbers only, so design task 18b is task 19 here, and design tasks 19 to 23 are tasks 20 to 24 (tasks 23 and 24 are in `later-tasks.md`). Where design.md "Owner patches" names task 21 (patches d and e), that is task 22 here; every other patch keeps its task number (b 5, c 6, d and e 11, f, g and k 13, h, i and j 16, l 18, m 23 (in `later-tasks.md`)). Patch a, which design.md names for task 1, is attached to no task, because it is already on `main`.
- **Changes from the design's table.** Task 8 also depends on task 4, because both edit `OpeningFlow.tsx`. Task 19 also carries the Postgres tests of the figures tables and depends on task 16, because `src/test/integration/**` is a crypto-dev path and task 16 (data-dev) cannot write there. The other dependencies that differ from the design's table are listed under "Order and merging". Task 24 (in `later-tasks.md`) sits in group 7 but is not optional: it covers R19.5 and R26.7 whichever way the decisions go.
- **Owner_Patches and when they must be on `main`.**
  - a (layout script): already on `main` before any task starts; the owner commits it first, so every reveal task is QA'd with the new checks. No task attaches it.
  - b (spec 07 docs): attached to task 5.
  - c (`tech.md` dates and numbers): attached to task 6.
  - d (`structure.md`): the How_Page and Figures_API lines with task 11; the `seal/` line with task 22, on a go only.
  - e (`check-js-budget.mjs`): `/how-it-is-sealed` with task 11; `/seal` with task 22.
  - f (README "Status" section and the sentence on depending on the Revenant server): attached to task 13; refreshed with task 24 (in `later-tasks.md`). The README Sweden lines are already on `main` before any task starts, so task 13's search test needs nothing from patch f.
  - g (`docs/kiro-writeup.md`): drafted with task 13; refreshed with task 24 (in `later-tasks.md`) at the final SHA.
  - h (Fallback_Refresh workflow): attached to task 16, with only `workflow_dispatch`. The owner commits it after task 14 merges and runs it by hand once before 16 November 2026. Only if the 16 November gate triggers does the owner add back its schedule (`cron: "30 6 * * *"`) and set `figures.source: file`.
  - i (Freshness_Check and keepalive workflows) and j (`labels.json`): attached to task 16 in group 4; committed by the owner when task 16 merges, so the check runs through 29 January 2027.
  - k (steering Sweden list): attached to task 13.
  - l (README line 46, the EU election window): attached to task 18.
- **Optional task.** Tasks 23 and 24 (group 7) are in `later-tasks.md`, not here. Sub-task 23.1 there (self-reported numbers) is the only optional task (`- [ ]*`); nothing in the loop reads the `*`, so the owner moves task 23 into this file only if there is time before the feature freeze. Every task in this file is required, and the design's properties are required tests in the task that names them.
- **Property coverage.** Properties 1, 6, 11, 12 (task 2); 2, 3, 7, 8, 9, 13, 14, 30 (task 3); 4 (task 7); 10 (task 1); 15, 16, 17 dates (task 8); 17 periods (task 6); 18, 19, 29 (task 9); 20, 21, 22, 25 (task 16); 23 (tasks 14 and 16); 24 (task 14); 5, 26 (task 21); 27 (task 20); 28 (task 23, in `later-tasks.md`).
- **Owner decisions.** The open items of design.md "Open items for the owner" are decisions, not tasks. Where a task depends on one (labels, timeouts, thresholds, the Freshness_Issue account), it uses the design's proposed value and the PR names the item.

## Task Dependency Graph

Dependencies: 1 → 2 → 3 → 4 → 5; 6 and 7 have none; 8 after 4, 6 and 7; 8 → 9; 10 after 5 and 9; 10 → 11; 12 after 5 and 11; 12 → 13; 14 after 6; 15 after 13 and 14; 16 after 14; 17 after 12 and 16; 18 after 15; 19 after 16, 17 and 18; 20 after 12, 17 and 19; 21 after 19 and 20; 22 after 18 and 21. Tasks 23 and 24 are in `later-tasks.md` and are not in this graph; both depend on 22 there.

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "6", "7"] },
    { "id": 1, "tasks": ["2", "14"] },
    { "id": 2, "tasks": ["3", "16"] },
    { "id": 3, "tasks": ["4"] },
    { "id": 4, "tasks": ["5", "8"] },
    { "id": 5, "tasks": ["9"] },
    { "id": 6, "tasks": ["10"] },
    { "id": 7, "tasks": ["11"] },
    { "id": 8, "tasks": ["12"] },
    { "id": 9, "tasks": ["13", "17"] },
    { "id": 10, "tasks": ["15"] },
    { "id": 11, "tasks": ["18"] },
    { "id": 12, "tasks": ["19"] },
    { "id": 13, "tasks": ["20"] },
    { "id": 14, "tasks": ["21"] },
    { "id": 15, "tasks": ["22"] }
  ]
}
```
