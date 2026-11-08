# Implementation Plan: 09 Demo polish

## Overview

Spec 09 fixes production first, then makes the demo land in its first 30 seconds and pay off at the end. Tasks follow the G3 priority order, and every task in a lower group has a lower number:

| Group | Tasks | What | Roles |
|---|---|---|---|
| A, production health | 1 to 3, 7, plus owner steps O0 to O2 (A6, F1) | Fallback figures, Seed_Job, favicon, honest now states, "Your answer", picker empty state; fonts that load (L1) | data-dev, platform-dev, frontend-dev |
| A, visible bugs | 4 to 6 | Controls that fit, focus, recall field name, marks card, ticks, Ghost exit, Branded_Pages | frontend-dev |
| B, landing | 8 to 12 | Brand_Copy and hero, "Open the demo letters", wide hero, ritual, story, "What no wax seal could do", Sample_Receipt, Coven_Strip, WaxSeal and the `/demo` envelopes; phone rules P1 to P3, P8.4, P9.3, P11 | frontend-dev, platform-dev |
| C, persona journey | 13 to 20 | Persona_Intro and Compact_Top_Bar, Step_Indicator and ritual words, EU unit, Receipt_Card and Answer_List, the climax and touch, the letter on lit paper, the retired-token cleanup, Ghost at the seal; phone rules P2 to P9 | frontend-dev, data-dev, platform-dev |
| D, live demo | 21 to 23 | Live_Stepper, values in the picker, unlock in place, backup first; prompt starters; Scene and Ghost; phone rules P8 to P10 | frontend-dev |
| E, presentation | 24, plus owner step O5 | Final audit and the README, write-up and video Owner_Patches | frontend-dev |

Group P (Phone first) and group F (Framing) have no tasks of their own; each task meets them for its own pages (G3.7, F1). Group L (Letters and type) has task 7 in group A, tasks 11 and 19 of its own, and task 18 in the persona journey, with its criteria also inside tasks 14 and 17. Task 7 carries number 7 but belongs to group A, and every group B task depends on it.

Each task is one GitHub issue worked by one role agent and leaves `main` passing the CI gate. Each PR stays under `max_changed_lines` (5,000) as `.github/agents.json` counts it, and inside its role's paths plus `shared` (G1.1, G3.2).

Follow `design.md` in this folder for file names, constants, copy, values and algorithms, and `requirements.md` for the rules. Every rule of specs 02 to 08 and of `.kiro/steering/` still holds unless requirements.md "Rules this spec replaces" names it. Owner decisions OD1 to OD20 are in requirements.md; until the owner writes a decision into the named task's issue body, the task uses the recommended default.

"Depends on" lists only spec 09 task numbers. Owner steps are not tasks: spec-sync reads only `- [ ] N.` lines, and no role agent can commit an owner-only file.

**What the loop can and can't see.** Spec-sync opens all 24 issues with `status:ready` as soon as this file reaches `main`, and the dispatcher claims any ready issue whose "Depends on" issues are closed, merging on a QA pass. It never reads "Before this task", the Production_Checks, the Real_Device_Checks or the milestone gates, and the agent and QA see only the issue body, never its comments. So every gate below is enforced by hand, with the `status:ready` label, a `Blocked by #N` line in an issue body (which the dispatcher honours), or text in the issue body. Anything an agent must know (the O1 log, an owner decision, the B1.7 timings, a cut) goes into the issue body before the issue is claimed; if it is only in a comment, the default applies.

## Launch order

1. Pull `main`, then commit this spec's edits.
2. Commit Owner patches w, x, y and r (and q, n and o if they are ready). Patch r must be on `main` before any spec 09 issue is claimed, because task 1's QA steps already use `09` rows.
3. Pause the `revenant-dispatch` cron, then push the spec. Spec-sync opens the 24 issues.
4. Edit the issue bodies: paste the O1 log into task 1's; write each recorded owner decision (O4) and the B1.7 timings into the named task's issue body.
5. Remove `status:ready` from task 8's issue until the 10 November gate passes. Every later task depends on task 8 directly or through the chain, so this holds groups B to E. Remove it from task 4's issue too if patch q isn't merged yet.
6. Resume the cron.

## Owner steps

| Step | When | What |
|---|---|---|
| O0 | Now, before task 3 is claimed | Steering first (F1). Commit Owner patches w (`product.md`), x (`tone.md`) and y (`copy-tone-check` hook) to `main`. Every copy task lists "steering updated" under "Before this task", and the dispatcher must not start one before this is done. |
| O1 | Now, before task 1 is claimed (launch step 4) | `kubectl -n <ns> create job --from=cronjob/<release>-fetch-figures fetch-figures-manual-1`, then `kubectl -n <ns> logs job/fetch-figures-manual-1`. Paste the log lines (they contain no secret) into the task 1 issue body, not a comment. If the run exits 0, production has figures until task 1 lands; if not, the log names the failure (`database`, `seed`, a series ID with its reason). |
| O2 | Now | Commit Owner patch n (Journey_Check) and Owner patch o (spec 08 Freshness_Check, keepalive and labels). Run `journey-check` by hand once. It should fail on J1 to J4 (A6.8); keep the issue it opens open until tasks 1 to 3 are deployed. |
| O3 | Patch r before the spec is pushed; patch q before task 4 is claimed | Commit Owner patch r (the QA prompt and the one `--require` line in the frontend-dev prompt) at launch step 2. Commit Owner patch q (`tools/qa/layout-check.mjs`) before task 4: until then, keep `status:ready` off task 4's issue. |
| O4 | Before the named tasks are claimed | Write each decision into the named task's issue body (not a comment), or leave it out to accept the default: OD1 and OD10 (task 3), OD12 (task 8), OD13 (task 13), OD3 (task 15), OD2 and OD15 (task 16), OD5 (task 17), OD6 and OD11 (task 21). OD14 now. OD20 is closed. |
| O5 | Before the freeze | Change the GitHub About description to "The wax seal, resurrected. Memory rewrites itself. Revenant doesn't." Update the Devpost description to the same framing. Replace `docs/concept.png` at the top of the README with a real screenshot or GIF of the reveal once spec 09 is live, or move it down and caption it as the early concept (F9). Add the GitHub About topics `kiro`, `kiro-crew`, `passkeys`, `webauthn`, `time-capsule`, `nextjs` next to `kiroween` (E1.5). Commit Owner patches t, u and v after task 24. |
| Deploy | After each merge to `main` | Roll out the new `dev` image (pod restart with `image.pullPolicy: Always`), run the task's Production_Check and Real_Device_Check (one iPhone with Safari, one Android phone with Chrome), and record both in its issue. Under OD14, a failure opens a new fix task in this file, and the next task in the same group waits for it: add `Blocked by #<fix issue>` to that task's issue body, because a new task in this file changes no existing issue's dependencies. |

## Milestone gates

| Date (end of day, UTC unless stated) | Gate | Effect |
|---|---|---|
| 10 November 2026 | Group A merged and deployed: tasks 1 to 7 merged and their Production_Checks passed. The Journey_Check issue from O2 is closed by a passing run. | Group B is held by keeping `status:ready` off task 8's issue until this passes (launch step 5, G3.3). |
| 20 November 2026 | Real sealing go or no-go (spec 08 R25), recorded in a new owner issue. Per OD7 default, go needs group A merged with Production_Checks passed and the Journey_Check green for the 48 hours before, on a `v*` tag. | No task here changes. |
| 27 November 2026 | Feature freeze. If at risk, cut in this order: tasks 23 (D1) and 22 (D3), then task 20 (C5) and the Coven_Strip parts of tasks 10 and 12 (B3.4). Phone rules are never cut on their own (G3.7). Nothing in group A is cut (G3.5). A cut task's issue is closed unmerged. | Task 24 runs after the freeze and removes claims that depend on cut work (G3.6). |
| 4 December 2026, 2:00 PM PT | Submission. Owner patches t, u, v committed. | |
| 29 January 2027, 23:59:59 PT | End of judging. Journey_Check, Freshness_Check, keepalive and the site keep running. | |

## Rules for every task

- **Branch and PR.** The dispatcher creates `agent/<role>/issue-N` and the PR "Closes #N". Do not push to `main` or merge. After a hook failure, make a new commit; do not amend.
- **Scope (G1.1).** Change only files that match your role's paths in `.github/agents.json` (or `shared`) and are listed in your task's Scope, plus new `*.test.ts(x)` files next to the code they test. Check your diff before you finish.
- **Hard boundaries (G1.2, G1.5, G1.7).** Frontend-dev and platform-dev tasks change nothing under `src/app/api/`, `src/lib/crypto/`, `src/lib/seal-format/`, `src/lib/letter-store/`, `src/lib/db/` or `drizzle/`. The states, events and transitions of `opening-machine.ts` stay unchanged. No crypto primitive, key step, header field, `format_version` or Recall_Record schema change.
- **The three landing files (G1.4).** Frontend-dev tasks never touch `src/app/page.tsx`, `src/app/layout.tsx` or `src/app/globals.css`. Only platform-dev tasks edit them: 7 (`layout.tsx` fonts, `globals.css`), 9 (`page.tsx`, `layout.tsx` viewport and description), 12 (`page.tsx`) and 19 (`globals.css`).
- **Owner_Patch rule (G1.3).** Never commit `tools/**`, `.kiro/**`, `docs/**`, `README.md`, `scripts/check.sh`, `scripts/check-js-budget.mjs` or `.github/**`. When a task needs one, write the diff from design.md "Owner patches", attach it to the issue or PR description under "Owner_Patch <letter>", and keep it out of the diff.
- **Privacy and size (G1.5, G1.6).** CSP header unchanged and `src/lib/security-headers.ts` has no diff. No request to another origin. New code writes nothing to storage, cookies or the URL. No new `dependencies` entry, animation library, WebGL, font, sound or vibration cue. Every route stays inside `scripts/check-js-budget.mjs`.
- **Motion.** Every motion has its Skip and Calm_Mode path, runs only under `prefers-reduced-motion: no-preference` and `[data-ceremony-motion="full"]`, and changes only `transform` and `opacity`.
- **Tokens and the Accent (G1.9).** Colours only from `src/components/ceremony/scene/tokens.module.css`. The Accent marks only the reader's answer, the main buttons, the wax and the focus ring outside the Letter_Block.
- **Framing (group F).** `README.md` on `main` is the source of truth for every user-facing statement. Take the Eyebrow, Tagline, Hero_Sentence, Ritual_Steps and Seal_Mapping only from `src/components/brand/copy.ts`. Use "testify", "testimony", "the record" and "see the receipts"; never "cross-examine", "caught", "wrong" or "you misremembered". Each copy task attaches the G2.9 Retired_Phrase search and the `node tools/hooks/tone-check.mjs` result for each changed copy file.
- **Phone first (G3.7, group P).** Every on-screen task meets group P for the pages and Stages in its Scope at 390×844 and 360×640, and 360×640 must pass too. Add `data-block` to every content block, `data-primary-control` to each Stage's primary control and `data-soil` to the Soil band, so the PH checks can measure them. Every target is at least 44×44 below 600 px.
- **Copy (G1.8).** Every string in its feature folder's copy module, exactly as design.md "Copy" gives it. No sentence over 25 words, no exclamation mark, no pun, no Scoring_Words_Always; no Scoring_Words_Scene in the Scene_Copy_Modules (which now include `src/components/landing/copy.ts`). Never "today", "current", "latest" or "live" about a Now_Figure.
- **Data integrity.** Every figure shown carries value, unit, region, period, source and `retrieved_at`, with its period next to it. Nothing invented, estimated, converted or filled. A display rescale is exact, keyed on the unit string, shown to the user, and the stored value stays as published.
- **Tests (G2.1, G2.2).** Vitest, `renderToStaticMarkup`, every `fetch` stubbed, no network, `DATABASE_URL` unset. Property tests with fast-check, `numRuns` at least 100, tag `// Feature: 09-demo-polish, Property N: <title>`.
- **After the merge (G3.4).** `bash scripts/check.sh` passes on `main`, and `/`, `/demo`, `/demo/live`, `/l/[id]`, `/demo/personas/us-maya` and `/demo/personas/eu-tomas` load, with each persona flow reaching `close` from `/`.
- **The PR description states (G2.3 to G2.8):** the final commit SHA with the `bash scripts/check.sh` exit status and PASS or FAIL; for a screen change, PNG shots at 1366x800, 1280x800, 360x640, 390x844 and 2560x1440 named `<stage-or-page>-<width>x<height>`, plus First_Viewport captures of every Stage the task touches at 390x844 and 360x640; the Real_Device_Check steps copied from the task; every route budget from `node scripts/check-js-budget.mjs` after `npm run build`; earlier-spec tests changed or retired with the reason; assets added with their size; Owner_Patches attached; for groups A and C, the Production_Check steps copied from the task; the `npm run layout-check` result lines for the checks the task names. Write "none" for an empty list.
- If `design.md` and the code on `main` disagree, re-read the code, keep the design's behaviour, and say what you changed. If something is unclear, ask the owner in the issue. Do not guess.

## Tasks

### Group A: production health

- [x] 1. A1 · Fallback figures in the Figures_API, a wait for the schema, and one fetch run at a time
  - Agent: `data-dev` · Depends on: none · Estimated size: ~700 changed lines
  - Before this task: owner step O1 has run, and its log is in this issue.
  - Scope: `src/app/api/figures/db-response.ts`, `src/app/api/figures/respond.ts`, `src/app/api/figures/build-response.ts`, `src/lib/figures/now.ts`, `src/lib/figures/bundled-latest.ts` (new), `scripts/fetch-figures.ts`, `scripts/fetch-figures-store.ts`, `scripts/fetch-figures-freshness.mjs`, and the `*.test.ts` for each file above
  - Design sections: "Production findings and their causes on `main`", "A1. Fallback_Figure in the Figures_API", "A2. The Seed_Job" (waiting for migrations, overlap), "Data Models" (Figures_API entry), "Error Handling".
  - Acceptance:
    - In db mode with a successful read, each Catalogue series gets its stored latest figure (`fallback: false`), else its latest real bundled figure from `fuel-figures.json` copied field for field (`fallback: true`), else `figure: null` with `fallback: false`. No Fallback_Figure is a Fixture_Figure (A1.1 to A1.3).
    - `last_success_at` still comes only from `figure_fetch_runs` (A1.4). A failed read still answers 500 with no list (A1.5). File mode sets `fallback: false` on every entry.
    - `figuresResponseV1Schema` accepts `fallback` as an optional boolean; `pickNow` returns `fallback` on a found figure, `false` when absent (A1.6). The format string stays `revenant-figures-v1`.
    - `scripts/fetch-figures-freshness.mjs` accepts the field; its classification of every existing test case is unchanged (A1.7).
    - `node scripts/fetch-figures.mjs --wait-for-schema=<s>` retries the connection and polls for the `figures` and `figure_fetch_runs` tables every 5 s for up to `s` seconds, then runs; on timeout it logs `fetch-figures failed: schema` and exits 1. Without the flag, behaviour is unchanged (A2.2).
    - The Fetch_Job takes `pg_try_advisory_lock(hashtext('revenant-fetch-figures'))` before any read. Without the lock it logs `fetch-figures skipped: another run in progress`, stores nothing and exits 0 (A2.5).
    - The Figures_API still reads no query parameter (A1.9). No log line holds a connection string or error text.
  - Tests: Property 1 (stored, else bundled, else null), Property 2 (responses parse with or without `fallback`). Example tests: the freshness shape with `fallback`; `--wait-for-schema` success, timeout and no flag with a stubbed store and clock; the lock-held path exits 0 and writes nothing.
  - Earlier-spec tests changed or retired: `api/figures/db-response.test.ts`, `api/figures/route.test.ts`, `lib/figures/now.test.ts`, `sources/fetch-figures-freshness.test.ts`, only where the new field or rule changes an asserted value; name each in the PR.
  - Owner_Patches attached: none.
  - QA shots: none (no screen change).
  - QA steps: 09-01.
  - Production_Check: after deploy, `curl -s https://revenant.devclef.se/api/figures | jq '[.series[] | {id: .metric.id, has: (.figure != null), fallback, last: .last_success_at}]'`. Pass: four entries, every `has` true. If the database still holds no rows, every `fallback` is true and `last` is null.
  - Validation: `bash scripts/check.sh`
  - _Requirements: A1.1–A1.9, A2.2, A2.5, G1, G2_

- [x] 2. A2, A5 · The Seed_Job on install and upgrade, and `public/` in the image
  - Agent: `platform-dev` · Depends on: 1 · Estimated size: ~350 changed lines
  - Before this task: task 1 is on `main` (the `--wait-for-schema` flag exists).
  - Scope: `deploy/helm/revenant/templates/job-fetch-figures-seed.yaml` (new), `deploy/helm/revenant/values.yaml`, `deploy/helm/revenant/Chart.yaml`, `deploy/helm/revenant/README.md`, `deploy/helm/revenant/templates/NOTES.txt`, `Dockerfile`, `src/test/seed-job.test.ts` (new), `src/test/dockerfile-public.test.ts` (new)
  - Design sections: "A2. The Seed_Job", "A5. `public/` in the image", "Testing Strategy" (chart), Owner patch p.
  - Acceptance:
    - With `fetchFigures.enabled` and `fetchFigures.seedOnDeploy` true (the default), the chart renders one plain `Job` named `<fullname>-fetch-seed-r<Release.Revision>`. There is no name override: a fixed name would make the next upgrade that changes the pod template fail, because Kubernetes doesn't allow that change to an existing Job. It carries no `helm.sh/hook` annotation (A2.1, A2.3; OD9).
    - The Job runs `node scripts/fetch-figures.mjs --wait-for-schema=<fetchFigures.seedWaitForSchemaSeconds>` (default 600) with the CronJob's env, ConfigMap, security contexts and resources, `backoffLimit: 0`, `restartPolicy: Never`, `activeDeadlineSeconds` from values, and no `ttlSecondsAfterFinished` (A2.2, A2.4).
    - Nothing in the chart waits on the Job. The web Deployment, the CronJob and the PVC are unchanged.
    - `values.yaml` documents the two new values (`seedOnDeploy`, `seedWaitForSchemaSeconds`); the chart README and `NOTES.txt` say how to read the seed log; chart `version` goes from 0.5.0 to 0.6.0. No new environment variable, so `.env.example` is unchanged (A2.6).
    - The Dockerfile runner stage copies `/app/public` to `./public`, owned by 1001; the stale comment about `public/` is removed (A5.1).
  - Tests: `src/test/seed-job.test.ts` (the template and values rules above); `src/test/dockerfile-public.test.ts` (A5.2). `helm lint` and `helm template` pass in `check.sh` on the default values; the chart test asserts the template's `if` guard on `fetchFigures.enabled` and `fetchFigures.seedOnDeploy`, since `check.sh` renders only the defaults.
  - Earlier-spec tests changed or retired: none expected; name any in the PR.
  - Owner_Patches attached: p (`.github/workflows/ci.yml` smoke paths `/icon.svg` and `/opengraph-image`).
  - QA shots: none.
  - QA steps: none. The QA agent runs `helm template ci deploy/helm/revenant` and checks the Job against A2.1 to A2.4.
  - Production_Check: after Fleet applies chart 0.6.0, `kubectl -n <ns> get jobs | grep fetch-seed` shows one Job for the new revision; `kubectl -n <ns> logs job/<name>` ends without `failed:`; the Fleet bundle is Ready (if it shows Modified because of the Job, add the `diff.comparePatches` entry from design.md "A2. The Seed_Job" to the GitOps `fleet.yaml`; never pin the Job name); `curl -sI https://revenant.devclef.se/icon.svg` returns 200 with an SVG content type; `/api/figures` now shows non-null `last_success_at` for every series the seed fetched.
  - Validation: `bash scripts/check.sh`
  - _Requirements: A2.1–A2.6, A5.1–A5.4_

- [x] 3. A3, A4, A7 · Honest now messages, "Your answer" on every Figure_Entry, and the picker's empty state
  - Agent: `frontend-dev` · Depends on: 1 · Estimated size: ~1,000 changed lines
  - Before this task: task 1 is on `main` (the `fallback` field). OD1 and OD10 recorded, or defaults. Steering updated (Owner patches w, x and y on `main`, owner step O0).
  - Scope: `src/components/reveal/now-message.ts` (new), `src/components/reveal/FiguresThenNow.tsx`, `src/components/reveal/FigureEntry.tsx`, `src/components/reveal/reveal.module.css`, `src/components/reveal/copy.ts`, `src/components/live/figure-hint.ts` (new), `src/components/live/touched.ts` (new), `src/components/live/FigurePicker.tsx`, `src/components/live/WriteForm.tsx`, `src/components/live/SealPage.tsx`, `src/components/live/RealDatePicker.tsx`, `src/components/live/copy.ts`, `src/components/live/live.module.css`, and the `*.test.ts(x)` for each file above
  - Design sections: "A3. Now-figure messages", "A4. Picker empty state and validation timing", "Copy" (`nowRetired`, `nowNotYet`, `fallbackNote`, `figuresNoneAvailable`, `figuresHintOne`, `figuresTooManyOne`, `figuresLoading`).
  - Acceptance:
    - `nowMessageFor` maps `series_missing` to `nowRetired`, `no_figure` to `nowNotYet`, a failed request to `nowUnavailableFetch` (unchanged), and a found Fallback_Figure to `fallbackNote` with its retrieved date (A3.1 to A3.4). "No longer published" appears only for `series_missing`.
    - In every unavailable branch the Then_Figure shows with its period, and no Number_Line or change line is drawn (A3.5).
    - Every Figure_Entry branch shows "Your answer" exactly once: on its own line with the answer and unit in the Accent, or "No answer", when no Number_Line is drawn (A7.1, A7.2).
    - The Seal_Page picker: with Sealable_Count 0, only `figuresNoneAvailable` with a link to `/demo`; with a maximum of 1, the singular forms; otherwise `figuresHint` with the real maximum. While the request is in flight, `figuresLoading` and no message (A4.1 to A4.3, A4.5). A Fallback_Figure in the picker shows its retrieved date and `fallbackNote` (A1.8).
    - No validation message on first load. A field's message shows after `change` or `blur` on it, or after the judge tries to seal; the same rule applies to the letter field, the picker and the `/seal` date field (A4.4).
    - The spec 06 R15.1 order of calls, every request and its body are unchanged.
  - Tests: Property 3 (the now message matches the reason), Property 4 (one "Your answer", for the A7 branches), Property 5 (the picker never states a zero limit). Example tests: a copy test asserting the new strings and banning "today", "current", "latest" and "live" in Now_Figure strings (A3.6); first-load render of `/demo/live` holds no validation message.
  - Earlier-spec tests changed or retired: `reveal/now-copy.test.ts`, `reveal/FiguresThenNow.test.tsx`, `live/FigurePicker.test.tsx`, `live/copy.test.ts`, `live/WriteForm.test.tsx`, `live/SealPage.test.tsx`, only where a string or the message timing changes; name each.
  - Owner_Patches attached: none.
  - QA shots: `close` of both persona pages and the Write step of `/demo/live`, at the five Evidence_Sizes.
  - QA steps: 09-02, 09-03, 09-04, 09-05.
  - Production_Check: open `https://revenant.devclef.se/demo/personas/us-maya` and `/demo/personas/eu-tomas`, answer, break the seal, press "See the numbers". Pass: every card shows a now value with "retrieved …" (and the Fallback_Note if `fallback` is true), and "Your answer" once; no "no longer published". Open `/demo/live`: no message on load, and the picker says "between 1 and 4". Then run the Journey_Check by hand; J1 to J4 pass.
  - Validation: `bash scripts/check.sh`
  - _Requirements: A1.8, A3.1–A3.6, A4.1–A4.5, A7.1–A7.3_

### Group A: visible bugs

- [x] 4. A8, A12, A13 · Controls that fit, focus rings only for the keyboard, and the recall field's name
  - Agent: `frontend-dev` · Depends on: 3 · Estimated size: ~600 changed lines
  - Before this task: task 3 is on `main`; owner step O3 is done (layout checks BO1, BC1 and FV1 exist).
  - Scope: `src/components/ui/Footer.tsx`, `src/components/ui/Footer.module.css` (new if missing), `src/components/reveal/StagePanel.tsx` (the `data-stage-panel` attribute only), `src/components/reveal/RememberedAnswers.tsx`, `src/components/live/WriteForm.tsx`, `src/components/live/FigurePicker.tsx` and `src/components/live/SealedView.tsx` (the `data-card` attribute only), `src/components/ceremony/recall/RecallPager.tsx`, `src/components/ceremony/recall/RecallPager.module.css`, `src/components/ceremony/ceremony.module.css`, `src/components/ceremony/constants.ts`, `src/components/ceremony/constants-css.test.ts`, `src/components/ui/**` (button styles), `src/components/reveal/reveal.module.css`, `src/components/live/live.module.css`, and the `*.test.ts(x)` for each file above
  - Design sections: "A8. Controls that fit", "A12. Focus on headings", "A13. The recall field's name", "Constants" (`RECALL_STACK_BELOW_PX`).
  - Acceptance:
    - Every button and button-styled link wraps its label; none has a fixed width or `white-space: nowrap`; `fieldset` and cards get `min-width: 0` (A8.1, A8.2, A8.4).
    - Below `RECALL_STACK_BELOW_PX` (640) the recall field and its control stack at full card width; at or above it they share a wrapping row (A8.3).
    - Headings with `tabIndex={-1}` show no outline unless `:focus-visible` matches; every control keeps its ring under `:focus-visible`; inside the Letter_Block the ring stays Text_On_Purple (A12.1, A12.2).
    - The spec 08 R2 focus moves still land on the Figures_Heading (A12.3).
    - Check hooks (design "Check hooks"): the recall card, the marks card and each `/demo/live` card carry `data-card`; `StagePanel` carries `data-stage-panel`, so BC1 measures them.
    - The footer links each have a clickable box of at least 44×44 below 600 px, so PH7 passes on every page's footer from here on (P8.4).
    - Each recall field has `aria-labelledby` pointing at its question heading and keeps its `aria-describedby` (A13.1, A13.2).
  - Tests: example tests for A13.3 over every question of both persona letters; a CSS test that the focus rule is present; the `RECALL_STACK_BELOW_PX` CSS constant check.
  - Earlier-spec tests changed or retired: `recall/RecallPager.fit.test.ts` and any button-style snapshot, only where a value changes; name each.
  - Owner_Patches attached: none.
  - QA shots: `recall`, `marks`, `letter` of both persona pages and every step of `/demo/live`, at the five Evidence_Sizes.
  - QA steps: 09-06, 09-07.
  - QA check: BO1 `button-overflow`, BC1 `control-in-card` and FV1 `heading-focus-ring` PASS at every size; N1 and R1 still PASS.
  - Production_Check: on `https://revenant.devclef.se/demo/personas/us-maya` at a 1366×800 window and on a phone, "Record my answers" and "Next question" sit inside their buttons and the card; clicking "See the numbers" with the mouse draws no box round the heading; tabbing to it and pressing Enter does.
  - Validation: `bash scripts/check.sh`
  - _Requirements: A8.1–A8.4, A12.1–A12.3, A13.1–A13.3_

- [x] 5. A9, A10 · Named, spaced recorded scales, one answer format, and even ticks
  - Agent: `frontend-dev` · Depends on: 4 · Estimated size: ~800 changed lines
  - Before this task: task 4 is on `main`.
  - Scope: `src/components/ceremony/recall/RecordedScale.tsx`, `src/components/ceremony/recall/RecallScale.tsx`, `src/components/ceremony/recall/RecallScale.module.css`, `src/components/ceremony/recall/tick-layout.ts`, `src/components/ceremony/recall/answer-text.ts` (new), `src/components/ceremony/recall/RecallPager.tsx` (the parsed-value line only), `src/components/reveal/RememberedAnswers.tsx`, `src/components/reveal/FigureEntry.tsx` and `src/components/ceremony/figures/NumberLine.tsx` (the answer text only), `src/components/ceremony/constants.ts`, and the `*.test.ts(x)` for each file above
  - Design sections: "A9. Marks card and one answer format", "A10. Even ticks", "Constants" (`MARKS_SCALE_GAP_PX`).
  - Acceptance:
    - Each `RecordedScale` root carries `data-recorded-scale`, so RS1 measures it.
    - Each recorded scale shows its metric's display name above it; scales are `MARKS_SCALE_GAP_PX` (32) apart; the answer label sits inside its own scale's box (A9.1 to A9.3).
    - `answerText` keeps every digit of the Recall_Record value and groups with commas; every place that shows an answer uses it, so "3.90" never shows as "3.9" (A9.4).
    - `visibleTicks` draws every k-th tick, k the smallest divisor of (n − 1) that fits, first and last always kept; the EUR range at a narrow track shows 0, 1,000, 2,000, 3,000 (A10.1, A10.3).
  - Tests: Property 6 (ticks evenly spaced, never colliding), Property 7 (Answer_Text keeps every digit). A source-scan test that the answer display files format answers only through `answerText`.
  - Earlier-spec tests changed or retired: the spec 08 Property 14 test (tick labels never overlap) is extended, not removed; `recall/RecallScale.test.tsx`, `reveal/Reveal.marks.test.tsx` where the tick set or answer text changes; name each.
  - Owner_Patches attached: none.
  - QA shots: `recall` and `marks` of both persona pages at the five Evidence_Sizes.
  - QA steps: 09-08.
  - QA check: RS1 `scale-overlap` PASS at every size; T2 `tick-labels` still PASS.
  - Production_Check: on `https://revenant.devclef.se/demo/personas/eu-tomas`, answer and reach "What you remembered" at 1366×800 and on a phone. Pass: each scale names its metric, no label touches the other scale, the ticks are evenly spaced, and a typed "1.50" shows as "1.50" everywhere.
  - Validation: `bash scripts/check.sh`
  - _Requirements: A9.1–A9.4, A10.1–A10.3_

- [x] 6. A11, A14 · The Ghost leaves after the seal breaks, and branded not-found and error pages
  - Agent: `frontend-dev` · Depends on: 5 · Estimated size: ~600 changed lines
  - Before this task: task 5 is on `main`. Steering updated (Owner patches w, x and y on `main`, owner step O0).
  - Scope: `src/components/ceremony/scene/PersonaGhost.tsx`, `src/components/ceremony/scene/scene.module.css`, `src/components/ceremony/scene/ghost-presence.ts`, `src/components/ceremony/constants.ts`, `src/components/ui/BrandedPage.tsx` (new), `src/components/ui/BrandedPage.module.css` (new), `src/components/ui/copy.ts`, `src/app/not-found.tsx` (new), `src/app/error.tsx` (new), and the `*.test.ts(x)` for each file above
  - Design sections: "A11. The Ghost leaves", "A14. Branded_Pages", "Copy" (`ui/copy.ts`), Owner patch s (the `src/app/` and `ui/` lines).
  - Acceptance:
    - The Ghost's root element carries `data-ghost` (if it doesn't already), so GZ1 finds it.
    - During the exit the Ghost layer is above every Stage card and below the Top_Bar, moving only by `transform` and `opacity` (A11.2).
    - On `animationend`, on the `GHOST_EXIT_FALLBACK_MS` timer, or at once under Calm_Mode, Skip or the Skip_Link, the Ghost renders nothing; a fresh render in `letter`, `figures` or `close` has no Ghost element (A11.3, A11.4).
    - `/does-not-exist` answers 404 with the Top_Bar, the Soil_Fallback strip, one `h1`, one line, a link to `/demo` and the footer (A14.1).
    - `src/app/error.tsx` shows the same parts with "Try again" calling `reset()` and never renders the error message or digest (A14.2).
    - The Branded_Pages load no Soil_Canvas, crypto or Opening_Flow code; the `/l/[id]` and persona not-found pages keep their text (A14.3, A14.4).
  - Tests: example tests for Ghost removal per path (end, timer, Calm, Skip); render tests for both Branded_Pages; an import-scan test for A14.3.
  - Earlier-spec tests changed or retired: `scene/ghost-presence.test.ts` and `scene/persona-scene.test.tsx` where they assert the Ghost after the Seal_Break; name each.
  - Owner_Patches attached: s (`structure.md`: `src/app/not-found.tsx`, `src/app/error.tsx`, `src/components/ui/BrandedPage`).
  - QA shots: `seal` (mid-exit), `letter` of Maya, and `/does-not-exist`, at the five Evidence_Sizes.
  - QA steps: 09-09, 09-10.
  - QA check: GZ1 `ghost-after-seal` PASS at every size; X1 still PASS.
  - Production_Check: on `https://revenant.devclef.se/demo/personas/us-maya` at 2560×1440 and 1366×800, break the seal. Pass: the Ghost rises and is gone; nothing shows behind the cards. `curl -s -o /dev/null -w '%{http_code}' https://revenant.devclef.se/does-not-exist` returns 404, and the page in a browser shows the Top_Bar and the demo link.
  - Validation: `bash scripts/check.sh`
  - _Requirements: A11.1–A11.4, A14.1–A14.4_

- [x] 7. L1, L2 · Fonts that load, and sans headings site-wide
  - Agent: `platform-dev` · Depends on: 2 · Estimated size: ~250 changed lines
  - Before this task: task 2 is on `main`. Steering updated (Owner patches w, x and y on `main`, owner step O0). Owner patch q includes FONT1.
  - Scope: `src/app/layout.tsx` (the font consts and their `className` only), `src/app/globals.css`, `src/test/fonts.test.ts` (new)
  - Design sections: "L. Letters and type" (Fonts, Type scale).
  - Acceptance:
    - `globals.css` sets neither `--font-serif` nor `--font-sans` anywhere; the `:root` lines and their comment are removed (L1.1).
    - `layout.tsx` renames the consts to `ebGaramond` and `inter`, keeps `variable: "--font-serif"` and `variable: "--font-sans"`, and passes the fallback stacks through `fallback` (L1.2, L1.3). Nothing else in `layout.tsx` changes.
    - `h1` to `h6` in `globals.css` use `var(--font-sans)` at the weights and letter-spacing design.md "Type scale" states; `body` uses `var(--font-sans)`; `globals.css` adds `button, input, select, textarea { font: inherit; }` (L2.1).
    - After load, on `/`, `/demo`, both persona pages and `/demo/live`, `document.fonts` reports Inter loaded and `body`'s computed `font-family` starts with the Inter Next_Font_Family; on each persona page at `letter`, EB Garamond is loaded too and the Letter_Text starts with it. EB Garamond is not expected loaded on pages without the letter (L1.4). The PR quotes the FONT1 lines.
    - The CSP header is unchanged; the fonts still load from the site's own origin (G1.5).
  - Tests: `src/test/fonts.test.ts` reads `globals.css` and `layout.tsx` and fails if `globals.css` sets `--font-serif` or `--font-sans`, if a font const is named `serif` or `sans`, or if a `localFont` call has no `fallback` (L1.5).
  - Earlier-spec tests changed or retired: any test asserting the `:root` font stacks or a serif heading; name each.
  - Owner_Patches attached: none.
  - QA shots: `/`, `/demo`, `intact` and `letter` of Maya, and the Write step of `/demo/live`, at 1366x800, 1280x800, 390x844, 360x640 and 2560x1440, each after `document.fonts.ready` (G2.10).
  - QA steps: 09-28.
  - QA check: FONT1 `fonts-loaded` PASS on every page at every size: Inter loaded and `body` in Inter everywhere; EB Garamond loaded and the Letter_Text in it where the letter shows. FONT2 (headings and buttons in Inter) is not required here, because ten component CSS modules still set the serif until tasks 11, 14, 17 and 18; it is required from task 19.
  - Production_Check: on `https://revenant.devclef.se/`, run `[...document.fonts].filter(f => f.status === "loaded").map(f => f.family)` in the console (not `document.fonts.check`, which also returns true for a family that isn't defined). Pass: the Inter Next_Font_Family is listed and `getComputedStyle(document.body).fontFamily` starts with it. Then open Maya's letter to `letter` and run the same line: the EB Garamond family is listed too. On `/` alone, EB Garamond is correctly absent, because no text there uses it.
  - Real_Device_Check: on a Mac with Safari, a Windows PC with Chrome, and both phones, open `/` and Maya's letter. Pass: headings are Inter, heavy and sans; the letter body is EB Garamond; nothing renders in Georgia or Times (G2.11).
  - Validation: `bash scripts/check.sh`
  - _Requirements: L1.1–L1.6, L2.1, G2.10, G2.11_

### Group B: the landing page

- [x] 8. B1, B2, B4, F2, F3 · Brand_Copy and the landing hero: eyebrow, tagline, sentence, "Open the demo letters", seal your own, Open Graph image, How_Page lead, phone and wide layouts
  - Agent: `frontend-dev` · Depends on: 6, 7 · Estimated size: ~900 changed lines
  - Before this task: the owner has put `status:ready` back on this issue after the 10 November gate (launch step 5), and has written the B1.7 timings into this issue body. Tasks 1 to 7 are merged and their Production_Checks passed (the 10 November gate). OD12 recorded, or default (c). Steering updated (Owner patches w, x and y on `main`, owner step O0).
  - Scope: `src/components/brand/copy.ts` (new), `src/app/opengraph-image.tsx`, `src/app/how-it-is-sealed/page.tsx`, `src/app/how-it-is-sealed/page.module.css`, `src/components/how/copy.ts`, `src/components/ceremony/scene/SceneHeadline.tsx`, `src/components/ceremony/scene/SoilStrip.tsx` (the `data-soil` attribute only), `src/components/ceremony/ASSETS.md`, `src/components/landing/LandingHero.tsx` (new), `src/components/landing/copy.ts` (new), `src/components/landing/constants.ts` (new), `src/components/landing/landing.module.css` (new), `src/components/ceremony/scene/scene.module.css`, `src/components/ceremony/scene/copy.ts`, `src/components/ceremony/constants.ts`, `src/components/demo/**` (Demo_Index spacing only, if B2.4 needs it), the copy scan tests under `src/components` (additions only), and the `*.test.ts(x)` for each file above
  - Design sections: "F. Framing" (Brand_Copy, the headline, Open Graph image, How_Page lead), "B. The landing page" (layout, ownership, one Accent button to `/demo`, the second click, wide), "Group P. Phone first" (`/` on the phone), "Constants" (`PHONE_BELOW_PX`, `LANDING_GHOST_PHONE_MAX_PX`, `DEAD_SPACE_MAX_PX`, `TOUCH_TARGET_MIN_PX`, `LANDING_WIDE_MIN_PX`, `FLOW_MINUTES`), "Copy" (`landing/copy.ts`).
  - Acceptance:
    - `src/components/brand/copy.ts` holds the Eyebrow, the Tagline, the Hero_Sentence (OD18), the five Ritual_Steps with their lines and the four Seal_Mapping rows, exactly as design.md "Copy" gives them, and nothing imports them from anywhere else (F2.1, F2.2).
    - The `/` headline is the Tagline, with "Revenant doesn't." kept together and no Accent; the Eyebrow sits above it; `headlineLead` and `headlineAccent` are removed; every `SCENE_COPY` key that `src/app/page.tsx` or a platform-dev test reads stays (`landing.paragraphs`, `demoLinkOne`, `demoLinkMany`, `realLink`, `liveLink`, `liveNote`, `howLink`, `sourceLink`, `openLetter`), because only task 9 may edit `page.tsx`; `headlineLead` and `headlineAccent` are read only by files in this Scope and the frontend tests, so they go here; their values are rewritten in the new framing where they carry the old one, and `landing.paragraphs[0]` no longer names the classroom time capsule as what Revenant brings back, so task 9's retired-phrase test passes. Task 10 deletes the keys nothing reads any more (F3, spec 08 R10.1 replaced).
    - `opengraph-image.tsx` draws the Eyebrow, the Tagline and the ghost from Brand_Copy, with no Accent text; its `ASSETS.md` entry says so (F2.3).
    - The How_Page opens with "How the seal works" and the Seal_Mapping table from Brand_Copy, then its current sections (F2.2).
    - `LandingHero` (server component) takes the Persona_List length and Demo_2_On and renders the Eyebrow, the Tagline as `h1`, and the Hero_Sentence; the primary call to action (`data-cta="primary"`, the only Accent button, `href="/demo"`, `primaryCtaOne` for one persona or `primaryCtaMany` for two or more, with `primaryCost`); and, while Demo_2_On, the secondary call to action (`data-cta="secondary"`, outlined, not Accent). With no persona it renders no primary button (B1.2 to B1.4).
    - No persona's name, region or letter link appears in the hero (B2.1). The text of `SCENE_COPY.landing.demoLinkOne` and `demoLinkMany` is copied into `landing/copy.ts` as `primaryCtaOne` and `primaryCtaMany`; the originals stay until task 10, because `page.tsx` and `src/test/landing.test.tsx` still read them. No geolocation, storage or third-party request (B2.3).
    - Every Demo_Index card's open link is inside the first viewport at the Desktop_Sizes and the Wide_Size; if not, the `/demo` intro spacing is tightened and the PR states the before and after positions (B2.4).
    - Render tests only in this task, because `LandingHero` isn't on `/` until task 9 wires it; task 9 runs the browser checks (CTA1, HW1, PH1 to PH3). Phone (P1 to P3, P8.4), at 390×844 and 360×640: the hero's First_Viewport holds the headline, the Hero_Sentence, both calls to action and the Landing_Ghost at the OD12 position and at most 30% of the viewport height, with the light centred on it (P1.1 to P1.3); no gap over 64 px between `data-block` boxes (P2.1); the `/` headline uses the design's phone clamp and `text-wrap: balance` and wraps to at most 3 lines with no lone word (P3); every hero target is at least 44×44 (P8.4).
    - Check hooks: every hero content block carries `data-block`, the Soil band `data-soil`, and the calls to action `data-cta` (PH1, PH2).
    - Below 600 px the hero stacks: headline, Hero_Sentence, both calls to action, then the Landing_Ghost at the OD12 position (default below the calls to action, at most `LANDING_GHOST_PHONE_MAX_PX` and 30% of the viewport height); its box is reserved in the server HTML (B1.5, P1.1).
    - At or above `LANDING_WIDE_MIN_PX` the headline scales to at least 1.5 times its 1366×800 size at 2560×1440 and the Hero centres in the first viewport, left edge on the wordmark (B4.1, B4.2). Check_Size headline sizes are unchanged (B4.3).
    - `src/components/landing/copy.ts` is in the Scene_Copy_Modules scan.
    - `FLOW_MINUTES` matches the owner's timing of the persona flow on a laptop and a phone, which the owner writes into this issue's body before it is claimed; the PR quotes it (B1.7).
  - Tests: render tests of the Open Graph image source (Eyebrow and Tagline, no Accent text) and of the How_Page (the mapping table first); render tests of `LandingHero` for zero, one and two personas and Demo_2_On off: exactly one Accent class, its `href` is `/demo`, the singular or plural label, no persona display name in the markup; the copy strings.
  - Earlier-spec tests changed or retired: `scene/copy.test.ts` for the landing button label and `openLetter` on `/` (spec 07 R7.3, R7.4 and the R24.3 row replaced); name any other.
  - Owner_Patches attached: s (`structure.md`: `src/components/brand/`, `src/components/landing/`).
  - Framing evidence (G2.9): the Retired_Phrase search of the rendered `/`, `/how-it-is-sealed` and the Open Graph image source, and the `node tools/hooks/tone-check.mjs` result for each changed copy file.
  - QA shots: `index` of `/demo` at the five Evidence_Sizes. None of `/` yet (task 9 wires it).
  - QA steps: none on `/` (task 9 runs 09-11, 09-12 and 09-22).
  - QA check: DX1 `demo-cards-in-view` PASS at the Desktop_Sizes and the Wide_Size. PH4 and PH7 are not required before task 13, which builds the Compact_Top_Bar.
  - Real_Device_Check: none on its own; task 9's covers the hero once it is wired.
  - Validation: `bash scripts/check.sh`
  - _Requirements: B1.2–B1.5, B1.7, B2.1–B2.4, B4.1–B4.3, F2.1–F2.3, F3.1–F3.4, P1.1–P1.3, P2.1, P3.1–P3.4, P8.4_

- [x] 9. B1, B2 · The landing page above the fold
  - Agent: `platform-dev` · Depends on: 2, 7, 8 · Estimated size: ~300 changed lines
  - Before this task: task 8 is on `main`. Steering updated (Owner patches w, x and y on `main`, owner step O0).
  - Scope: `src/app/page.tsx`, `src/app/page.test.tsx`, `src/lib/page-metadata.ts`, `src/lib/page-metadata.test.ts`, `src/test/retired-phrases.test.ts` (new), `src/test/tagline-source.test.ts` (new), `src/app/layout.tsx` (the `viewport` export and the site description only), `src/app/globals.css` (only if a landing rule must move), `src/lib/landing-backdrop.ts`, `src/test/viewport-export.test.ts` (new)
  - Design sections: "B. The landing page", "Group P. Phone first" (`/` on the phone; the keyboard paragraph for the `viewport` export).
  - Acceptance:
    - `/` renders `LandingHero` in the Scene in place of the current headline block and the "Open {name}'s letter" button, passes the Persona_List length and Demo_2_On, and keeps the Landing_Ghost, the light, the Soil and one `h1` (B1.1, spec 08 R9.14).
    - The headline stays the LCP element in the server HTML (B1.6). The below-the-fold `/demo` link and the explanation the hero now covers are removed; the How_Page and GitHub links stay in the footer. `/` no longer imports a persona's key or display name.
    - At both Phone_Sizes the First_Viewport of `/` meets P1.1, the Ghost_Body_Box touches no text or control, and there is no gap over 64 px (P1, P2). The backdrop places the Landing_Ghost and the light at the OD12 position below 600 px.
    - `page.tsx` stops reading `SCENE_COPY.landing.paragraphs`, `demoLinkOne`, `demoLinkMany`, `realLink`, `liveLink`, `liveNote`, `howLink`, `sourceLink` and `openLetter`, and `src/test/landing.test.tsx` stops asserting them; task 10 then deletes the keys.
    - The How_Page and GitHub links appear exactly once on `/`, in the footer (P11.1).
    - `src/app/layout.tsx` exports `viewport = { width: "device-width", initialScale: 1, interactiveWidget: "resizes-content" }`, and its site description is `HOME_DESCRIPTION`; nothing else changes in it (P9.3, F2.2).
    - `HOME_DESCRIPTION` in `src/lib/page-metadata.ts` is the Eyebrow and the Tagline from Brand_Copy; the retired tagline is gone from both files (F2.2, OD16).
    - `src/test/retired-phrases.test.ts` and `src/test/tagline-source.test.ts` implement F8.1, F8.2 and F2.4 as design.md "F. Framing" states, and pass on this commit.
  - Tests: `src/app/page.test.tsx` updated: the hero strings, one Accent button linking to `/demo`, no link to `/demo/personas/`, no persona display name, no Ghost Envelope, each of the How_Page and GitHub URLs exactly once. `src/test/viewport-export.test.ts` asserts the `viewport` export.
  - Earlier-spec tests changed or retired: `src/app/page.test.tsx` landing assertions replaced by B1; metadata tests asserting the old description (OD16); name each.
  - Framing evidence (G2.9): the Retired_Phrase search of `/` and the page metadata, and the `node tools/hooks/tone-check.mjs` result for each changed copy file.
  - Owner_Patches attached: none.
  - QA shots: `scene` of `/` at the five Evidence_Sizes, plus First_Viewport captures at both Phone_Sizes.
  - QA steps: 09-11, 09-12, 09-22.
  - QA check: CTA1 `landing-ctas`, HW1 `hero-wide`, and PH1 to PH3 on `/` at both Phone_Sizes PASS; LG1 still PASS. PH4 and PH7 are not required before task 13.
  - Real_Device_Check: open `https://revenant.devclef.se/` on an iPhone (Safari) and an Android phone (Chrome) without scrolling. Pass: the headline (at most 3 lines), the sentence, "Open the demo letters" with its time, "Seal your own" and the Ghost are all on the first screen, with no empty band; each link appears once.
  - Validation: `bash scripts/check.sh`
  - _Requirements: B1.1, B1.5, B1.6, B2.1, F2.2, F2.4, F8.1, F8.2, P1.1–P1.3, P2.1, P9.3, P11.1_

- [x] 10. B3, F6 · Landing sections, and the retired landing keys removed: the ritual, what we resurrected, what no wax seal could do, the Sample_Receipt and the Coven_Strip
  - Agent: `frontend-dev` · Depends on: 8, 9 · Estimated size: ~1,100 changed lines
  - Before this task: task 8 is on `main`. Steering updated (Owner patches w, x and y on `main`, owner step O0).
  - Scope: `src/components/ceremony/scene/copy.ts`, `src/components/ceremony/scene/copy.test.ts`, `src/components/landing/RitualSection.tsx` (new), `src/components/landing/ResurrectionSection.tsx` (new), `src/components/landing/NoSealSection.tsx` (new), `src/components/landing/SampleReceipt.tsx` (new), `src/components/landing/CovenStrip.tsx` (new), `src/components/landing/copy.ts`, `src/components/landing/landing.module.css`, and the `*.test.ts(x)` for each file above
  - Design sections: "B. The landing page" (Sample_Receipt, Kiro_Stats, historical claims), "Copy" (`landing/copy.ts`).
  - Acceptance:
    - `SCENE_COPY` loses every key task 9 stopped reading (`landing.paragraphs`, `demoLinkOne`, `demoLinkMany`, `realLink`, `liveLink`, `liveNote`, `howLink`, `sourceLink`, `openLetter`), after a search shows no reader outside test files; test assertions on them are removed.
    - `RitualSection`: five rectangular cards from Brand_Copy `ritualSteps`, each with its number, name and line; no arch, gravestone, moon, bat, cobweb or arrow (B3.2).
    - `ResurrectionSection`: at most four sentences on the plis cachetés, with the classroom time capsule only as an example, and the four Seal_Mapping rows from Brand_Copy (F6.1).
    - `NoSealSection`: "What no wax seal could do" in at most three sentences (`noSealTitle`, `noSealBody`), with none of the words F1.3 bans (F6.2, F6.3). Each historical number or date links to an Académie des sciences page that states it, or is left out; the PR quotes the source text (B3.3).
    - `SampleReceipt` (client): one `GET /api/figures` after hydration with a 30 s abort, parsed by `parseFiguresResponse`; shows the first series' value, unit, region, period, source, series ID, retrieved date and a source link; `receiptNone` on failure or `figure: null`; `fallbackNote` for a Fallback_Figure; no change and no arrow. Its server HTML is its heading and a reserved box (B3.4, B3.7).
    - `CovenStrip` takes `KiroStats` as props, shows each non-null count with its singular or plural label, hides a null count, and links to the two GitHub URLs of B3.5 (B3.5, B3.6).
    - At both Phone_Sizes every section is one column with no sideways scroll, every link and control is at least 44×44, the seal table reflows to stacked rows, and the Sample_Receipt keeps value and unit on one line with period and region on the next (P6.1 pattern, P8.4).
    - Cut line: if the owner cuts B3.4's Coven_Strip, `CovenStrip.tsx` and its tests are left out of this PR.
  - Tests: render tests for each section; `SampleReceipt` with a stubbed `fetch` for a figure, a Fallback_Figure, `figure: null` and a failed request; no Accent on any figure element.
  - Earlier-spec tests changed or retired: none expected; name any.
  - Owner_Patches attached: none.
  - QA shots: none of `/` yet (task 12 wires it).
  - QA steps: none (task 12 runs 09-13).
  - Validation: `bash scripts/check.sh`
  - _Requirements: B3.1–B3.7, F6.1–F6.3, P8.4_

- [x] 11. L4, L5 · One WaxSeal, and the demo letters as sealed envelopes
  - Agent: `frontend-dev` · Depends on: 10 · Estimated size: ~1,300 changed lines
  - Before this task: task 10 is on `main`. OD20 is closed (dates as in L5.2). Steering updated (Owner patches w, x and y on `main`, owner step O0).
  - Scope: `src/components/ui/WaxSeal.tsx`, `src/components/ui/WaxSeal.module.css`, `src/components/ui/index.ts`, `src/components/ceremony/envelope/**`, `src/components/demo/**`, `src/app/demo/page.tsx`, `src/app/demo/page.module.css`, `src/app/demo/personas/[key]/not-found.tsx`, `src/app/demo/personas/[key]/not-found.module.css`, `src/app/l/[id]/not-found.tsx`, `src/components/ceremony/ASSETS.md`, and the `*.test.ts(x)` for each file above
  - Design sections: "L. Letters and type" (One WaxSeal, The `/demo` envelopes, Type scale, Palette).
  - Acceptance:
    - One WaxSeal component (merging `ui/WaxSeal` and `ceremony/envelope/WaxSeal`) draws every seal; the Envelope_Front has no postmark or seal-like circle; the persona Envelope's flap carries the WaxSeal (L4.1 to L4.3).
    - `/demo` shows each persona as the same closed Envelope, flap side up, WaxSeal on the flap, with display name and region, "Written as of {date}", and "Opens {date}" followed by the Opening_Event's plain name where the Persona_List has one ("Opens 9 June 2024 · European Parliament election"), and no sealed date, in the sans, at least 14 px at the Phone_Sizes, AA on the paper (L5.1, L5.2, OD20).
    - Each envelope is one link with the accessible name "Open {name}'s letter", showing an orange button with that text; no underlined text link, no gold border (L5.3, L5.5).
    - Side by side at the Desktop_Sizes and the Wide_Size, aligned to the heading's left edge; stacked at the Phone_Sizes; every envelope the same size (L5.4, L5.6). B2.4 still holds.
    - The `/demo` page, the demo components, the envelope and both not-found pages use no Retired_Token and no `ParchmentSurface`; the two not-found pages use the task 6 `BrandedPage`. Headings and names are the sans (L2.1, L3.1).
  - Tests: render tests: one WaxSeal markup in every place; `/demo` envelopes (text, one link per envelope, accessible name, no Accent on dates); no Retired_Token in the files this task changes.
  - Earlier-spec tests changed or retired: spec 03 R6 Demo_Index tests only where markup changes (the "exactly the personas in the Persona_List, in order" test passes unchanged); spec 07 R16.3 card link text (replaced by L5.3); name each.
  - Owner_Patches attached: none.
  - QA shots: `index` of `/demo`, and `intact` and `marks` of Maya, at 1366x800, 1280x800, 390x844, 360x640 and 2560x1440 after `document.fonts.ready`, with the FONT1 result (G2.10).
  - QA steps: 09-29.
  - QA check: DX1 and FONT1 PASS on `/demo`. PH4 and PH7 are not required before task 13.
  - Real_Device_Check: on a Mac with Safari, a Windows PC with Chrome, and both phones, open `/demo`. Pass: sealed envelopes with one orange seal each, side by side on the computers, stacked on the phones; tapping anywhere on an envelope opens that letter.
  - Validation: `bash scripts/check.sh`
  - _Requirements: L2.1, L3.1, L4.1–L4.3, L5.1–L5.6, G2.10, G2.11_

- [x] 12. B3 · Wire the landing sections and count the Kiro_Stats at build time
  - Agent: `platform-dev` · Depends on: 9, 10, 11 · Estimated size: ~350 changed lines
  - Before this task: tasks 9, 10 and 11 are on `main`. Steering updated (Owner patches w, x and y on `main`, owner step O0).
  - Scope: `src/app/page.tsx`, `src/app/page.test.tsx`, `next.config.ts`, `.dockerignore`, `src/lib/kiro-stats.ts` (new), `src/lib/kiro-stats.test.ts` (new), `src/test/kiro-stats-build.test.ts` (new)
  - Design sections: "B. The landing page" (Kiro_Stats), "Data Models" (Kiro_Stats).
  - Acceptance:
    - `/` renders, below the Scene and in order, the Ritual_Section, the Resurrection_Section, the "What no wax seal could do" section, the Sample_Receipt and the Coven_Strip, then the footer (B3.1, F6).
    - `countKiroStats` counts as the design states; `next.config.ts` sets `env.REVENANT_KIRO_STATS` at build time; `page.tsx` parses it and passes the numbers to `CovenStrip` (B3.5).
    - `.dockerignore` re-includes `.kiro/specs`, `.kiro/steering`, `.kiro/agents` and `.kiro/hooks` for the builder; the runner stage copies none of them.
    - `src/test/kiro-stats-build.test.ts` fails if any count for the repository is null (B3.6).
    - Cut line: if the Coven_Strip is cut, this task leaves out the stats code and the `.dockerignore` change, and renders the other three sections.
    - The sections add no second How_Page or GitHub link on `/` (P11.1).
  - Tests: Property 12 (Kiro_Stats counts what is there) with generated temp trees.
  - Earlier-spec tests changed or retired: `src/app/page.test.tsx` below-the-fold assertions; name each.
  - Owner_Patches attached: none.
  - QA shots: `/` full page at the five Evidence_Sizes, plus a full-page capture at both Phone_Sizes.
  - QA steps: 09-13, 09-22.
  - QA check: X1 and FT1 still PASS on `/`; PH1 to PH3 still PASS at both Phone_Sizes.
  - Real_Device_Check: scroll `/` to the end on both phones. Pass: four sections, one column, nothing cut off, footer links once.
  - Validation: `bash scripts/check.sh`
  - _Requirements: B3.1, B3.5, B3.6, P11.1_

### Group C: the persona journey and the payoff

Each task in this group meets group P for the Stages it changes (G3.7), and attaches First_Viewport shots of those Stages at both Phone_Sizes.

- [x] 13. C1, P5 · The persona first screen: Persona_Intro, Maya's opening event, the Compact_Top_Bar and a two-line headline
  - Agent: `frontend-dev` · Depends on: 11 · Estimated size: ~1,300 changed lines
  - Before this task: task 11 is on `main`. OD13 recorded, or default (a). Steering updated (Owner patches w, x and y on `main`, owner step O0).
  - Scope: `content/personas/personas.json`, `src/lib/personas/schema.ts`, `src/components/ceremony/intro/PersonaIntro.tsx` (new), `src/components/ceremony/intro/intro.module.css` (new), `src/components/ceremony/scene/TopBar.tsx`, `src/components/ceremony/scene/icons.tsx` (new), `src/components/ceremony/scene/SceneHeadline.tsx`, `src/components/ceremony/scene/scene.module.css`, `src/components/ceremony/scene/copy.ts`, `src/components/ceremony/ASSETS.md`, `src/components/ceremony/copy.ts`, `src/components/ceremony/constants.ts`, `src/app/demo/personas/[key]/page.tsx`, `src/app/demo/page.tsx`, `src/components/demo/**`, and the `*.test.ts(x)` for each file above
  - Design sections: "C1 and C2. Persona_Intro and Step_Indicator" (the intro part), "Group P. Phone first" (the Compact_Top_Bar; the `emerging`, `sealed` and `intact` row), "Data Models" (Persona_List additions), "Constants" (`PHONE_BELOW_PX`, `COMPACT_TOP_BAR_PX`, `DEAD_SPACE_MAX_PX`, `TOUCH_TARGET_MIN_PX`), "Copy" (`intro*`).
  - Acceptance:
    - Each persona gains `intro_line`; `us-maya` gains `opening_event` dated `2024-11-05` with an official publisher and an `https` URL whose page states the date, quoted in the PR. No letter ID changes (C1.3).
    - `PersonaIntro` shows in `emerging`, `sealed` and `intact`: the intro line, "Written as of" and "Opens" dates, the event as "Opens {date} · {event}" with its source link, the question count from the Persona_List, and `introTime` from `FLOW_MINUTES`. Nothing from the payload (C1.1, C1.2).
    - The PR records the `neutrality.md` copy test of both intro lines and Maya's event, with the reviewer's name and pass or fail (C1.4, C1.5).
    - Phone, Compact_Top_Bar (P5): below 600 px the Top_Bar is at most 56 px tall on every page that uses it; motion and Skip take the OD13 form as 44×44 controls with accessible names and `title`s from the copy module, keeping their spec 05 and spec 07 behaviour; the icons are original inline SVG with `ASSETS.md` rows; the persona notice is not in the Top_Bar and is the first line of the Persona_Intro, text unchanged; the Demo chip stays. At 600 px and wider the Top_Bar is unchanged (P5.1 to P5.4).
    - Headings (F7, OD17 default): the persona page's headline is `personaHeading` ("{name}'s letter") and `/demo`'s is `demoHeading` ("The demo letters"), in the `SceneHeadline` position and style; the Tagline appears on neither.
    - Check hooks: the Compact_Top_Bar carries `data-compact` below 600 px (PH4 and PH7 apply to it from here); the persona Stage content wrapper carries `data-stage-content`; the Pick_Up_Button carries `data-primary-control`; persona content blocks carry `data-block`.
    - Phone, first screen (P2, P3, C9.2): at both Phone_Sizes the persona headline uses the design's clamp and `text-wrap: balance` and wraps to at most 2 lines with no lone word; in `intact`, the Persona_Intro and the Pick_Up_Button are both in the First_Viewport; no gap over 64 px between `data-block` boxes before the First_Step; every target is at least 44×44 (P8.4).
  - Tests: Persona_List schema tests for `intro_line` (length, no digit, the spec 03 R1.10 terms) and `opening_event`; render tests of the Top_Bar above and below 600 px (controls, names, no notice below 600 px); the ASSETS test covers `icons.tsx`.
  - Earlier-spec tests changed or retired: the spec 07 R8 Top_Bar tests (96 px limit, notice row) at narrow widths, replaced by P5; `lib/personas/*` schema tests; name each.
  - Owner_Patches attached: s (`structure.md`: `icons.tsx`).
  - QA shots: `emerging`, `intact` of both persona pages at the five Evidence_Sizes; First_Viewport captures of `intact` at both Phone_Sizes; `/` and `/demo/live` First_Viewport at both Phone_Sizes (Top_Bar).
  - QA steps: 09-14, 09-23 (`intact` only).
  - QA check: PH1 (`intact`), PH2, PH3, PH4 and PH7 PASS on both persona pages at both Phone_Sizes; T0 and the spec 07 R8 checks still PASS at 600 px and wider.
  - Production_Check: from `https://revenant.devclef.se/`, press "Open the demo letters", then open each persona from `/demo` on a laptop. Pass: the intro names who wrote it, both dates, the election day as a date with a working source link, the question count and the time.
  - Real_Device_Check: on both phones, open each persona page without scrolling. Pass: the bar at the top is one slim row with icon controls; the headline is 2 lines; the fictional note, the intro and "Pick up the letter" are all on the first screen; each icon announces its name in VoiceOver or TalkBack.
  - Validation: `bash scripts/check.sh`
  - _Requirements: C1.1–C1.5, C9.2, F7.1, F7.2, P2.1, P3.1–P3.4, P5.1–P5.4, P8.4_

- [x] 14. C2, F4, P4, P9 · The Stages: the Step_Indicator, ritual words on Stage headings and buttons, the Hero collapse, the Compact_Ghost and the keyboard
  - Agent: `frontend-dev` · Depends on: 13 · Estimated size: ~1,400 changed lines
  - Before this task: task 13 is on `main`. Steering updated (Owner patches w, x and y on `main`, owner step O0).
  - Scope: `src/components/ui/StepIndicator.tsx` (new), `src/components/ui/StepIndicator.module.css` (new), `src/components/ui/use-keep-in-visual-viewport.ts` (new), `src/components/ceremony/steps.ts` (new), `src/components/ceremony/CeremonyRoot.tsx`, `src/components/ceremony/copy.ts`, `src/components/ceremony/constants.ts`, `src/components/ceremony/scene/PersonaGhost.tsx`, `src/components/ceremony/scene/SceneShell.tsx`, `src/components/ceremony/scene/scene.module.css`, `src/components/ceremony/recall/RecallPager.tsx`, `src/components/ceremony/recall/RecallPager.module.css`, `src/components/reveal/copy.ts`, `src/components/reveal/Reveal.tsx` (the figures button attribute only), and the `*.test.ts(x)` for each file above
  - Design sections: "F. Framing" (button lookup), "C1 and C2. Persona_Intro and Step_Indicator" (the Step_Indicator part), "Group P. Phone first" (the persona Stage table, Hero collapse, Compact_Ghost, Keyboard), "Constants" (`COMPACT_GHOST_MAX_PX`, `PERSONA_STEPS`), "Copy" (`steps*`).
  - Acceptance:
    - Ritual words (F4.4): `stage1Title` "Your testimony", `stage2Next` "See the receipts", `stage3Title` "The receipts", `recallIntro` and `CEREMONY_COPY.recall` as design.md "Copy" gives them; the figures button carries `data-advance="figures"`. No string uses an old ritual name (F4.5).
    - Check hooks: the Step_Indicator root carries `data-step-indicator`; each recall question's field group carries `data-primary-control`.
    - `StepIndicator` shows Testify, Break the seal, Read, See the receipts (names from Brand_Copy) from `intact` to `close`, current step per `personaStepFor`, `aria-current="step"`, one announcement per change, no Accent; one line at the Desktop_Sizes and the Wide_Size, at most two at the Phone_Sizes (C2).
    - Phone, after the First_Step (P4.2, P4.3): the `h1` is visually hidden but stays in the document; the Ghost takes the Compact_Ghost state (at most 120 px tall, at the right end of the Step_Indicator row), still holding the Envelope seal side out; the seal keeps a 44×44 target; the Soil fades out; all by `transform` and `opacity`, final state in the first frame under Calm or reduced motion.
    - Phone, Stage starts (P4.1 items 1 and 2, C9.1): at both Phone_Sizes the Pick_Up_Button at `intact`, and the current question, its field and Next at each `recall` question, are fully in the First_Viewport. The Stages each later task rebuilds (`marks`, `letter`, `figures`) are checked by that task.
    - Keyboard (P9): `useKeepInVisualViewport` keeps each recall field and its Next or submit control inside `window.visualViewport` on focus and on visual viewport `resize` and `scroll`, with `"auto"` scrolling under Calm, and does nothing without `visualViewport`.
    - Every target on these Stages is at least 44×44 at the Phone_Sizes (P8.4).
    - The recall question titles use the sans at the design's heavy weight, and `RecallPager.module.css` references no Retired_Token and no serif (L2.1, L3.1).
  - Tests: Property 10 (the Step_Indicator follows the Stage). Example tests for `useKeepInVisualViewport` with a stubbed `visualViewport` (field below the keyboard is scrolled into view; no stub, no scroll); render tests that the `h1` is visually hidden, not removed, after the First_Step below 600 px.
  - Earlier-spec tests changed or retired: the spec 07 R24.5 copy test for "See the numbers" (replaced by F4.4), the reveal copy tests for the three stage strings and the recall intro; `CeremonyRoot.test.tsx` for the announcement text; the spec 07 R10.15 narrow-scale test (floor 0.8), replaced by P4.2; the spec 08 R8 Hero-size tests below 600 px; name each.
  - Owner_Patches attached: s (`structure.md`: `StepIndicator`, `use-keep-in-visual-viewport`).
  - QA shots: `intact`, `recall`, `marks` of both persona pages at the five Evidence_Sizes; First_Viewport captures of every `recall` question at both Phone_Sizes.
  - QA steps: 09-15, 09-23 (`intact` and `recall`).
  - QA check: ST1 `step-indicator`, PH1 (`intact`, `recall`), PH3, PH4 and PH7 PASS at both Phone_Sizes; R1 and the spec 07 R12.12 marks checks still PASS at the Desktop_Sizes.
  - Production_Check: open both persona pages on a laptop and walk to `close`. Pass: the steps advance with each Stage and the screen reader announces each step once.
  - Real_Device_Check: on both phones, pick up the letter and answer each question. Pass: after "Pick up the letter" the headline is gone and a small Ghost sits beside the steps; each question, its field and Next are on screen; with the keyboard open, the field and Next stay above it on iPhone Safari and Android Chrome (P9).
  - Validation: `bash scripts/check.sh`
  - _Requirements: C2.1–C2.5, C9.1, L2.1, L3.1, F4.1, F4.2, F4.4, F4.5, P4.1–P4.3, P8.4, P9.1–P9.4_
  - Framing evidence (G2.9): the Retired_Phrase search of both persona pages through `close`, and the `node tools/hooks/tone-check.mjs` result for each changed copy file.

- [x] 15. C8 · Display rescale keyed on the sealed unit
  - Agent: `data-dev` · Depends on: 1, 14 · Estimated size: ~200 changed lines
  - Before this task: OD3 recorded, or default (b). If OD3 is (a), this issue is closed unmerged and task 16 follows its "if (a)" line.
  - Scope: `src/lib/figures/rescale.ts`, `src/lib/figures/index.ts` (export only), and the `*.test.ts` for each file above
  - Design sections: "C8. EU display unit (option b)", "Copy" (`rescale.ts` note).
  - Acceptance:
    - `displayRescaleForUnit(unit)` returns `{ displayUnit: "EUR per litre", divisor: 1000, note }` only for exactly `EUR per 1,000 litres`, and null otherwise. It reads no Catalogue (C8.2).
    - Values go through the existing `rescaleForDisplay`, with no `Number`, `parseFloat` or float maths (the existing source scan covers it). Stored values are untouched (C8.3).
  - Tests: Property 8 (the display rescale is exact and keyed on the unit).
  - Earlier-spec tests changed or retired: none expected.
  - Owner_Patches attached: none.
  - QA shots: none.
  - QA steps: none.
  - Production_Check: none on its own; task 16's check covers it.
  - Validation: `bash scripts/check.sh`
  - _Requirements: C8.1–C8.3_

- [x] 16. C3, C8, P6, P7 · The Receipt_Card, the marks card and Answer_List, the EU per-litre display, and the reveal on the phone
  - Agent: `frontend-dev` · Depends on: 14, 15 · Estimated size: ~2,200 changed lines
  - Before this task: task 15 is on `main` or closed unmerged under OD3 (a). OD2 and OD15 recorded, or defaults. Steering updated (Owner patches w, x and y on `main`, owner step O0).
  - Scope: `src/components/reveal/ReceiptCard.tsx` (new), `src/components/reveal/AnswerList.tsx` (new), `src/components/reveal/FigureEntry.tsx`, `src/components/reveal/FigureLine.tsx`, `src/components/reveal/FiguresThenNow.tsx`, `src/components/reveal/ChangeLine.tsx`, `src/components/reveal/RememberedAnswers.tsx`, `src/components/reveal/SealedLetter.tsx` (layout only), `src/components/reveal/Reveal.tsx`, `src/components/reveal/reveal.module.css`, `src/components/reveal/copy.ts`, `src/components/ceremony/figures/NumberLine.tsx`, `src/components/ceremony/figures/figures.module.css`, `src/components/ceremony/close/Close.tsx` (the `data-close-line` attribute only), `src/components/ceremony/recall/unit-ranges.ts`, `src/components/ceremony/recall/RecallPager.tsx`, `src/components/ceremony/recall/RecallScale.tsx`, `src/components/ceremony/recall/RecordedScale.tsx`, `src/components/ceremony/constants.ts`, and the `*.test.ts(x)` for each file above
  - Design sections: "C3. The Receipt_Card", "C8. EU display unit (option b)", "Group P. Phone first" (Receipts and the reveal on the phone; the `letter` and `figures` rows), "Constants" (Unit_Range_Table `EUR per litre`, `NUMBER_LINE_PHONE_PX`), "Copy" (`marksSummary`).
  - Acceptance:
    - Every Figure_Entry branch renders through `ReceiptCard` with the C3.1 rows in order: name, "Your answer", Then, Now (or the A3 message), Number_Line, change line and formula, source control (C3.1).
    - Then and Now share one type style; a rise and its mirror-image fall render the same markup except the spec 07 R20.2 parts (C3.2).
    - The Number_Line's answer label shows only the Answer_Text and unit; each card shows "Your answer" once (C3.3).
    - At 600 px and wider, in `figures` and `close`, the marks card is a closed `<details>` "Your testimony" with its content in the document (C3.4).
    - After "See the receipts", every card is readable scrolling down from the Figures_Heading; at the Desktop_Sizes and the Wide_Size the first card is fully in view (C3.5).
    - No difference, distance or grade between the answer and a figure (C3.6, OD2 default).
    - Under OD3 (b): for the unit `EUR per 1,000 litres`, the recall field, the Recall_Scale (`EUR per litre`, 0 to 3, ticks every 0.5), the marks card, the Answer_List and the card show per-litre values with the rescale note next to each figure; the Recall_Record stores the typed value; the change line keeps its percentage and shows rescaled inputs with the note; no Unit_Helper_Line (C8.1, C8.3 to C8.5).
    - If (a): instead change both EU `recall_subject` strings in `content/personas/personas.json` to name 1,000 litres, give `eu-tomas` a new letter ID, move the old one to `retired_letter_ids`, add `content/personas/personas.json` to this Scope, and skip the C8 (b) items (C8.6).
    - Check hooks: the figures panel carries `data-figures-panel`; the letter Stage root `data-letter-stage`; the close's first line `data-close-line`; the Letter_Text `data-letter-text` (if not already); "See the receipts" and the first Receipt_Card carry `data-primary-control` in their Stages.
    - Phone, receipts (P6): below 600 px each Then and Now row keeps value and unit on one line and period and region on the next; Then stacks above Now at equal weight; the figures panel and every card use `display: flow-root` with no fixed height, so their background contains their content; the `marks` Stage shows the `AnswerList` in place of the read-only Recall_Scales, and from `figures` on no marks card renders (P6.1 to P6.4, OD15).
    - Phone, Stage starts (P4.1 items 4 and 5): at both Phone_Sizes, "See the receipts" (or the start of a longer Letter_Text) at `letter`, and the first Receipt_Card at `figures`, are fully in the First_Viewport.
    - Phone, length (P7): at 390×844 in `close`, the top of the letter Stage to the bottom of the closing line is at most 2,532 px plus the Letter_Text height. The PR states the measured value.
    - Every target on these Stages is at least 44×44 at the Phone_Sizes (P8.4).
  - Tests: Property 4 (one "Your answer", Receipt_Card branches), Property 9 (order, weight and mirror). Example tests for the EU per-litre display, the collapsed marks card above 600 px, and `AnswerList` (each answer, "No answer", no figure value, period or source next to an answer, spec 03 R3.8).
  - Earlier-spec tests changed or retired: `reveal/FigureEntry.test.tsx`, `reveal/figure-entry.property.test.tsx`, `reveal/figure-entry-equal-weight.property.test.tsx`, `ceremony/figures/NumberLine.test.tsx`, the unit-range and Unit_Helper_Line tests (spec 08 R7.8 to R7.10 replaced under OD3 b), `reveal/Reveal.marks.test.tsx` below 600 px (spec 08 R6 replaced on the phone); name each.
  - Owner_Patches attached: none.
  - QA shots: `marks`, `letter`, `figures` and `close` of both persona pages at the five Evidence_Sizes; First_Viewport captures of each at both Phone_Sizes; one full-page capture of `close` at 390×844.
  - QA steps: 09-16, 09-19, 09-23 (`marks`, `letter`, `figures`), 09-24.
  - QA check: RC1 `receipts-in-view`, B1 `figure-boxes` and L1 `line-labels` PASS at every size; PH1 (`letter`, `figures`), PH5, PH6 and PH7 PASS at both Phone_Sizes.
  - Production_Check: on both persona pages at 1366×800, press "See the receipts". Pass: each card holds your answer, then, now, the line and the change together; the marks card is folded; on Tomás's letter the values read per litre with the note, and the question's unit matches.
  - Real_Device_Check: on both phones, walk each persona letter to the end. Pass: the answers show as a short list at the seal; each card reads value and unit on one line, period and region on the next; the dark panel covers all its content; the whole reveal is a few thumb-scrolls.
  - Validation: `bash scripts/check.sh`
  - _Requirements: C3.1–C3.6, C8.1, C8.3–C8.6, P4.1, P6.1–P6.4, P7.1, P8.4_

- [x] 17. C4, C6, C7, P8 · One action at the climax, sound in the Top_Bar, one disclosure at the letter, the seal verdict, the closing line, and the seal by touch
  - Agent: `frontend-dev` · Depends on: 16 · Estimated size: ~1,300 changed lines
  - Before this task: task 16 is on `main`. OD5 recorded, or default (drop the line). Steering updated (Owner patches w, x and y on `main`, owner step O0).
  - Scope: `src/components/ceremony/scene/TopBar.tsx`, `src/components/ceremony/scene/icons.tsx`, `src/components/ceremony/scene/SceneShell.tsx`, `src/components/ceremony/scene/scene.module.css`, `src/components/ceremony/ASSETS.md`, `src/components/ceremony/sound/SoundToggle.tsx`, `src/components/ceremony/seal/**`, `src/components/ceremony/envelope/**`, `src/components/ceremony/close/**`, `src/components/ceremony/copy.ts`, `src/components/ceremony/constants.ts`, `src/components/reveal/Reveal.tsx`, `src/components/reveal/OpeningFlow.tsx` (the Skip_Link only), `src/components/reveal/SealedLetter.tsx`, `src/components/reveal/Fingerprint.tsx`, `src/components/reveal/copy.ts`, `src/components/reveal/reveal.module.css`, and the `*.test.ts(x)` for each file above
  - Design sections: "C4. The climax controls", "C6 and C7. Disclosure, verdict and close", "Group P. Phone first" (the `marks` row; Touch on the seal; the Compact_Top_Bar sound control), "Constants" (`HOLD_PROGRESS_SEGMENTS`), "Copy" (`skipToReceipts`, `letterDisclosure`, `sealVerdict`, `fingerprintShow`, `fingerprintHowLink`, `closeLine`).
  - Acceptance:
    - In `marks` with no running sequence, the Content_Column shows only the instruction line, the seal, "Break the seal" and the Skip_Link, plus the Answer_List below 600 px (C4.1).
    - The Skip_Link "Skip to the receipts" is quiet text, sends `SHOW_ALL` once, shows while any Reveal part is hidden, and focus lands on the Figures_Heading (C4.2, C4.3).
    - The sound toggle sits in the Top_Bar between Calm and Skip, styled like Calm at 600 px and wider, and as the OD13 control with an accessible name below 600 px; sound stays off by default and in memory only (C4.4, P5.2). Top_Bar Skip shows only while a sequence runs (C4.5).
    - The Envelope_Front shows only the two dates at every width (C6.2, OD5).
    - Persona letters show the `letterDisclosure` line ("{name} is fictional. This letter was written as of {date}.") and the `sealedForThisDemo` line ("Sealed for this demo on {date}", from the header's `sealedAt`) in place of the demo note and "Sealed for the demo on" (C6.1, C6.3). Live_Letters keep "Sealed on {date and time}".
    - Persona letters show `sealVerdict`, then a closed `<details>` "Show the fingerprint" with the 16 groups, "demo letter" and the How_Page link. Live_Letter and Real_Letter Fingerprint blocks are unchanged (C6.4, C6.5).
    - The close line is `closeLine`: it names your testimony and the record and leaves the meaning to the reader, with no judgement or direction word; items 2 to 4 of spec 07 R15.1 stay (C7, F5).
    - Touch (P8.1 to P8.3): the seal target has `touch-action: none`, no callout and no selection, captures the pointer, and prevents `contextmenu`; a ring of `HOLD_PROGRESS_SEGMENTS` (12) segments in `--text` shows hold progress by opacity only; releasing early resets the ring and the cracks and sends nothing.
    - The press-and-hold seal and the Seal_Break use the one WaxSeal from task 11, on the held Envelope's flap; `ceremony/seal/**` and `ceremony/close/**` reference no Retired_Token, no serif and no `ParchmentSurface` (L3.1, L4.1, L4.2).
    - Check hooks: the pressable seal and "Break the seal" carry `data-primary-control` in `marks`.
    - Phone, Stage start (P4.1 item 3): at both Phone_Sizes the pressable seal and "Break the seal" are fully in the First_Viewport at `marks`. Every target is at least 44×44 (P8.4).
  - Tests: copy tests for every new or changed string; render tests for the `marks` control set, the Skip_Link event, the sound control position at both widths and the two Fingerprint variants; hold-progress tests with a fake clock (segments at k/12, reset on early release, one `ADVANCE` at the end); the spec 07 R22.4 sound-scope test still passes.
  - Earlier-spec tests changed or retired: `ceremony/copy.test.ts`, `ceremony/copy-exact.property.test.ts` (close line), `reveal/Fingerprint.test.tsx`, `reveal/SealedLetter.test.tsx`, `reveal/eu-persona-labels.test.tsx`, Envelope_Front tests (spec 07 R8.7 desktop line); name each.
  - Owner_Patches attached: none.
  - QA shots: `intact`, `marks`, `seal`, `letter` and `close` of both persona pages at the five Evidence_Sizes; First_Viewport captures of `marks` at both Phone_Sizes.
  - QA steps: 09-17, 09-18, 09-23 (`marks`), 09-25.
  - QA check: N1 PASS after the Skip_Link; BO1 still PASS; PH1 (`marks`), PH4 and PH7 PASS at both Phone_Sizes.
  - Production_Check: on `https://revenant.devclef.se/demo/personas/us-maya` at 1366×800, reach the seal. Pass: one seal, its instruction, "Break the seal" and "Skip to the receipts"; the sound toggle sits next to the motion toggle; the letter says once that Maya is fictional, with both dates; the seal verdict comes first and the fingerprint opens on request; the last line names your testimony and the record.
  - Real_Device_Check: on both phones, at the seal, touch and hold for half a second and lift, then hold until it breaks. Pass: no callout, no selection, no scroll; the ring fills and resets on the short press; the long press breaks the seal; the sound icon toggles and is announced.
  - Validation: `bash scripts/check.sh`
  - _Requirements: C4.1–C4.5, C6.1–C6.5, C7.1, C7.2, F5.1, F5.2, L3.1, L4.1, L4.2, P4.1, P5.2, P8.1–P8.4_
  - Framing evidence (G2.9): the Retired_Phrase search of both persona pages through `close`, and the `node tools/hooks/tone-check.mjs` result for each changed copy file.

- [x] 18. L6 to L9 · The paper holds only the letter, lit by the shaft, with real creases; the attic theme leaves the components
  - Agent: `frontend-dev` · Depends on: 17 · Estimated size: ~1,500 changed lines
  - Before this task: task 17 is on `main`. Steering updated (Owner patches w, x and y on `main`, owner step O0).
  - Scope: `src/components/ceremony/letter/**`, `src/components/reveal/SealedLetter.tsx`, `src/components/reveal/Fingerprint.tsx` (placement only), `src/components/reveal/Reveal.tsx`, `src/components/reveal/reveal.module.css`, `src/components/reveal/FlowError.tsx`, `src/components/reveal/RecallStep.tsx`, `src/components/reveal/SealIntact.tsx`, `src/components/reveal/StagePanel.tsx`, `src/components/reveal/StillSealed.tsx`, `src/components/ceremony/ceremony.module.css`, `src/components/ceremony/scene/scene.module.css`, `src/components/ceremony/scene/SceneBackdrop.tsx`, `src/components/ceremony/constants.ts`, `src/components/ceremony/contrast.test.ts`, `src/components/live/LetterCard.tsx`, `src/components/live/SealedKeepsakes.tsx`, `src/components/live/live.module.css`, `src/components/ui/ParchmentSurface.tsx` and `.module.css` (deleted), `src/components/ui/index.ts`, `src/components/ui/Wordmark.module.css`, and the `*.test.ts(x)` for each file above
  - Design sections: "L. Letters and type" (The paper and the Caption_Block, The Light_Shaft, Creases, Palette, Type scale).
  - Acceptance:
    - The paper holds only the Letter_Text, one text node with `white-space: pre-wrap`. The Caption_Block before it, on the dark, in the sans, holds the Stage heading (a real heading, spec 08 R2), the Letter_Disclosure, "Sealed for this demo on {date}" or "Sealed on {date and time}", and the Seal_Verdict with its Fingerprint control; the disclaimer is one caption line (L6).
    - No solid purple slab. The Light_Shaft moves from the Soil to the paper at the unfold and lights the top edge and the dark around it; the text area is flat `--paper`; at the Phone_Sizes the lit band above the paper is at most 80 px; the receipts column is plain dark; static under Calm or reduced motion; gradients only, `transform` and `opacity` only (L7, OD19).
    - Two horizontal creases at 1/3 and 2/3 of the paper's height, full width, `aria-hidden`, passing the contrast composite test (L8).
    - The live letter card after sealing and the Live_Letter reveal use the same Envelope, WaxSeal and paper; the card's contents are unchanged (L9).
    - No file in this Scope, nor `live.module.css`, references a Retired_Token or the serif except the Letter_Text module; `ParchmentSurface` is deleted and nothing imports it; the contrast tests cover only the remaining pairs, with every threshold kept (L2.2, L3.1, L3.3).
  - Tests: render tests: the paper's only child text is the letter; the Caption_Block order; the creases' positions; the light's Calm path; the contrast test updated (pairs listed in the PR).
  - Earlier-spec tests changed or retired: the spec 07 Letter_Block tests (purple slab, white focus ring inside it, vertical creases), replaced by L6 to L8; the desk token pairs in the contrast test (spec 07 R4.8); `LetterBlock` tests; name each.
  - Owner_Patches attached: none.
  - QA shots: `letter`, `figures` and `close` of both persona pages, `/l/<id>` `letter` for a Live_Letter, and the sealed card on `/demo/live`, at 1366x800, 1280x800, 390x844, 360x640 and 2560x1440 after `document.fonts.ready`, with the FONT1 result (G2.10).
  - QA steps: 09-30.
  - QA check: W1, X1, PH5, PH6 and FONT1 PASS; PH3 still PASS.
  - Production_Check: on both persona pages at 1366×800, break the seal. Pass: the light moves onto the paper; the paper shows only the letter; the heading, dates and seal verdict sit above it in sans on the dark; two faint horizontal folds.
  - Real_Device_Check: on a Mac with Safari, a Windows PC with Chrome, and both phones, open Maya's letter to `close`. Pass: the letter is EB Garamond on flat warm paper, the lit band on the phone is a thin strip above the paper, nothing in Georgia.
  - Validation: `bash scripts/check.sh`
  - _Requirements: L2.2, L3.1, L3.3, L6.1–L6.5, L7.1–L7.6, L8.1, L8.2, L9.1, L9.2, G2.10, G2.11_

- [x] 19. L2, L3 · Delete the retired tokens, and guard the type system and the palette
  - Agent: `platform-dev` · Depends on: 12, 18 · Estimated size: ~200 changed lines
  - Before this task: task 18 is on `main`, so no component references a Retired_Token or the serif outside the Letter_Text module.
  - Scope: `src/app/globals.css`, `src/test/retired-tokens.test.ts` (new), `src/test/serif-scope.test.ts` (new)
  - Design sections: "L. Letters and type" (Palette, Type scale, Guards).
  - Acceptance:
    - `globals.css` defines none of `--seal`, `--gold-text`, `--gold-leaf` and `--ink-faded`, and no `--desk-*` (L3.1).
    - `src/test/retired-tokens.test.ts` fails if any CSS, TS or TSX file under `src/` defines or references a Retired_Token or imports `ParchmentSurface` (L3.2).
    - `src/test/serif-scope.test.ts` fails if any CSS file other than the Letter_Text module sets `font-family` to a serif or references `--font-serif` (L2.3).
    - Both tests pass on this commit.
  - Tests: the two tests above.
  - QA check: FONT2 `fonts-sans-ui` PASS on every page at every size: every `h1` to `h3` and `button` computes to the Inter family.
  - Earlier-spec tests changed or retired: none expected.
  - Owner_Patches attached: none.
  - QA shots: none (no visible change if task 18 was complete). If anything changes on screen, the full G2.10 set.
  - QA steps: none.
  - Validation: `bash scripts/check.sh`
  - _Requirements: L2.3, L3.1, L3.2_

- [x] 20. C5 · Break the seal on the Envelope the Ghost holds
  - Agent: `frontend-dev` · Depends on: 19 · Estimated size: ~500 changed lines
  - Before this task: task 19 is on `main`. Cut candidate (G3.5).
  - Scope: `src/components/ceremony/seal/**`, `src/components/ceremony/scene/PersonaGhost.tsx`, `src/components/ceremony/scene/scene.module.css`, `src/components/reveal/Reveal.tsx` (the seal placement only), and the `*.test.ts(x)` for each file above
  - Design sections: "C5. The seal at the Ghost".
  - Acceptance:
    - At the Desktop_Sizes and the Wide_Size in `marks` and `seal`, the pressable seal is the one on the held Envelope, the instruction line sits within 48 px of the Envelope, and the Content_Column holds no second seal (C5.1, C5.2).
    - The crack animation plays on the held Envelope; Calm and reduced motion show the settled scene (C5.3, C5.4). The Phone_Sizes keep the task 14 Compact_Ghost and the task 17 touch rules (C5.5).
    - The seal's pointer target stays at least 44 by 44 px (spec 07 R10.16, P8.4).
  - Tests: render tests for the seal placement per width class; the spec 07 seal-gate and Calm tests still pass.
  - Earlier-spec tests changed or retired: any test that asserts a Content_Column seal at desktop widths; name each.
  - Owner_Patches attached: none.
  - QA shots: `marks` and `seal` of both persona pages at the five Evidence_Sizes; First_Viewport captures of `marks` at both Phone_Sizes.
  - QA steps: 09-17, 09-25.
  - QA check: G1 to G3 and GZ1 still PASS; PH1 (`marks`) and PH7 still PASS at both Phone_Sizes.
  - Production_Check: on both persona pages at 1366×800 and 2560×1440, press and hold the seal on the Envelope the Ghost holds. Pass: it cracks there, the Ghost leaves, the letter opens.
  - Real_Device_Check: on both phones, confirm the seal still breaks by touch as in task 17.
  - Validation: `bash scripts/check.sh`
  - _Requirements: C5.1–C5.5, P8.4_

### Group D: the live demo

- [x] 21. D2, D4 to D7, P10 · The Live_Stepper, figure values in the picker, unlock in place, the backup key up front, and the live demo on the phone
  - Agent: `frontend-dev` · Depends on: 20 · Estimated size: ~2,900 changed lines
  - Before this task: task 20 is on `main` or closed unmerged. OD6 and OD11 recorded, or defaults. Steering updated (Owner patches w, x and y on `main`, owner step O0).
  - Scope: `src/components/live/stepper/**` (new), `src/components/live/SealPage.tsx`, `src/components/live/WriteForm.tsx`, `src/components/live/FigurePicker.tsx`, `src/components/live/SealedView.tsx`, `src/components/live/BackupFallback.tsx`, `src/components/live/UnlockView.tsx`, `src/components/live/LiveLetter.tsx`, `src/components/live/copy.ts`, `src/components/live/constants.ts`, `src/components/live/live.module.css`, `src/components/reveal/OpeningFlow.tsx` (an `embedded` prop only), `src/app/demo/live/page.tsx`, `src/components/live/passkey-options.test.ts` (new), and the `*.test.ts(x)` for each file above
  - Design sections: "D. The Live_Stepper", "A4" (touched rule), "Group P. Phone first" (The live demo on the phone; Keyboard), "Constants" (`LETTER_FIELD_ROWS`, `LETTER_FIELD_MAX_VH`), "Copy" (`live/copy.ts`).
  - Acceptance:
    - Six steps in order, named Write, Seal the figures, Press the seal, Wait, Testify, See the receipts from Brand_Copy, with the Step_Indicator; the headline is `liveHeading` ("Seal your own letter"); the Create_Press button reads "Press the seal with your passkey" (F4.3, F7). Back before sealing keeps text, figures and the backup decision; no Back and no letter text after the seal is stored (D2.1 to D2.3).
    - The Seal step holds the passkey explanation, the twice-prompt line, the OD6 warning and checkbox, the Create_Press and the Confirm_Press, in that order; the spec 06 R15.1 order, every request and body, and the first-asynchronous-call rule are unchanged (D2.4, D2.5, D2.7, D7).
    - Each step change moves focus to its heading (D2.6).
    - Each picker series shows value, unit, period, region and source, with details one click away, in Catalogue order; a Fallback_Figure shows its date and `fallbackNote` (D4).
    - The Wait step shows the countdown; at zero it checks the letter route once, then mounts the unlock control in place for the sealed letter, with "Go to your letter" below; after unlock it goes to Testify, then Receipts, with the same Opening_Flow and Recall_Record as `/l/[id]`; it never navigates by itself (D5).
    - When the PRF_Hint reports `false`, "Seal with a backup key instead" is the first option; the PRF_Check still decides; the backup path works through unlock in place (D6).
    - Check hooks: each step's heading, fields and Next sit inside one `data-primary-control` group, and each step root carries `data-card`.
    - Phone (P10, P8.4, P9): at both Phone_Sizes each step's heading, fields and Next are in the First_Viewport when the step begins; no validation message before a touch or a seal attempt; the letter textarea starts at 5 rows and grows to at most 50% of the visual viewport; the countdown stays in the First_Viewport of the Wait step until the unlock control replaces it; `useKeepInVisualViewport` keeps the textarea and Next above the keyboard; every target is at least 44×44.
    - `src/components/live/passkey-options.test.ts` asserts that `createPasskey`, `confirmPasskey` and `assertPasskey` pass no `authenticatorAttachment` and no `hints` (P10.4).
  - Tests: Property 11 (Back keeps the draft; nothing goes back after the seal). The spec 08 R17.6 backup-path test extended to unlock in place. Request-order tests from spec 06 pass with only layout assertions changed. The passkey options test.
  - Earlier-spec tests changed or retired: `live/SealPage.test.tsx`, `live/seal-flow.test.ts`, `live/backup-path.e2e.test.ts`, `live/SealedView*.test.tsx`, `live/WriteForm*.test.tsx`, only where layout or wording changes; every request and order assertion stays. Name each.
  - Owner_Patches attached: none.
  - QA shots: every step of `/demo/live` on the passkey path and the backup path at the five Evidence_Sizes; First_Viewport captures of every step at both Phone_Sizes.
  - QA steps: 09-20, 09-21, 09-26.
  - QA check: BO1, BC1 and X1 PASS on every step; PH1, PH4 and PH7 PASS at both Phone_Sizes.
  - Real_Device_Check: on both phones, seal a letter with the phone's own passkey, wait, unlock, answer and reach the receipts. Pass: the phone's own passkey sheet appears (Face ID or Touch ID on iPhone, the Google Password Manager sheet on Android); each step fits one screen; the countdown stays in view; the letter field and Next stay above the keyboard. On a phone whose provider has no PRF, the backup key option comes first and opens the letter.
  - Validation: `bash scripts/check.sh`
  - _Requirements: D2.1–D2.7, D4.1–D4.3, D5.1–D5.5, D6.1–D6.3, D7.1, D7.2, F4.3, F7.1, P8.4, P9.1–P9.4, P10.1–P10.5_
  - Framing evidence (G2.9): the Retired_Phrase search of every `/demo/live` step, and the `node tools/hooks/tone-check.mjs` result for each changed copy file.

- [x] 22. D3 · Prompt starters on the Write step
  - Agent: `frontend-dev` · Depends on: 21 · Estimated size: ~250 changed lines
  - Before this task: task 21 is on `main`. Cut candidate, first in line (G3.5). Steering updated (Owner patches w, x and y on `main`, owner step O0).
  - Scope: `src/components/live/stepper/WriteStep.tsx`, `src/components/live/PromptStarters.tsx` (new), `src/components/live/copy.ts`, `src/components/live/live.module.css`, and the `*.test.ts(x)` for each file above
  - Design sections: "D. The Live_Stepper" (D3), "Copy" (`promptStarters`).
  - Acceptance:
    - Three Prompt_Starter buttons insert their text at the cursor; the field starts empty (D3.1, D3.2).
    - Each starter passes the `neutrality.md` copy test and has no digit; the PR records the review (D3.3).
    - At both Phone_Sizes the starters are 44×44 or larger, wrap under the field, and the Write step still fits its First_Viewport (P8.4, P10.1).
  - Tests: insertion at start, middle and end of a selection; the copy strings.
  - Earlier-spec tests changed or retired: none expected.
  - Owner_Patches attached: none.
  - QA shots: the Write step at the five Evidence_Sizes and its First_Viewport at both Phone_Sizes.
  - QA steps: 09-20, 09-26 (Write step).
  - QA check: PH1 and PH7 PASS on the Write step at both Phone_Sizes.
  - Real_Device_Check: on both phones, tap each starter. Pass: the text appears at the cursor and the keyboard stays usable.
  - Validation: `bash scripts/check.sh`
  - _Requirements: D3.1–D3.3, P8.4, P10.1_

- [x] 23. D1 · The Scene and the Ghost in the live demo
  - Agent: `frontend-dev` · Depends on: 22 · Estimated size: ~900 changed lines
  - Before this task: task 22 is on `main` or closed unmerged. Cut candidate, first in line (G3.5).
  - Scope: `src/components/live/stepper/**`, `src/components/ceremony/scene/PersonaGhost.tsx`, `src/components/ceremony/scene/scene.module.css`, `src/components/ceremony/scene/SceneShell.tsx`, `src/components/ceremony/constants.ts`, `src/app/demo/live/page.tsx`, and the `*.test.ts(x)` for each file above
  - Design sections: "D. The Live_Stepper" (D1), "Group P. Phone first" (Compact_Ghost).
  - Acceptance:
    - `/demo/live` renders in `SceneShell` with the light, Soil and Top_Bar; on a stored seal the Ghost sinks with the Envelope (`transform` and `opacity` only) and the countdown runs in the Scene; on unlock in place the Emergence plays (D1.1 to D1.3).
    - Calm and reduced motion show the settled pose and the countdown still updates (D1.4).
    - The passkey and backup warnings stay plain, unmissable and in the same view as their control (D1.5).
    - `/l/[id]` renders no Ghost and no Soil (D1.6).
    - At both Phone_Sizes the Ghost uses the Compact_Ghost size, and every step still meets P10.1 and P10.5: the Scene never pushes a step's controls or the countdown out of the First_Viewport.
  - Tests: render tests for each step in full and Calm; the spec 07 R17.10 test for `/l/[id]` still passes; the animation scan covers `ghostSink`.
  - Earlier-spec tests changed or retired: any `/demo/live` test that asserts no Scene; name each.
  - Owner_Patches attached: none.
  - QA shots: every step of `/demo/live` at the five Evidence_Sizes and its First_Viewport at both Phone_Sizes.
  - QA steps: 09-20, 09-26.
  - QA check: G1 to G3 on `/demo/live`, X1 and BO1 PASS; PH1, PH4 and PH7 still PASS at both Phone_Sizes.
  - Real_Device_Check: on both phones, seal and wait. Pass: the small Ghost sinks and rises; every step and the countdown still fit the first screen.
  - Validation: `bash scripts/check.sh`
  - _Requirements: D1.1–D1.6, P10.1, P10.5_

### Group E: presentation

- [x] 24. E1 · Final promise audit, and the README, write-up and video script patches
  - Agent: `frontend-dev` · Depends on: 23 · Estimated size: ~200 changed lines
  - Before this task: tasks 1 to 23 merged or closed unmerged; the 20 November decision recorded; the freeze reached or every earlier task closed. Steering updated (Owner patches w, x and y on `main`, owner step O0).
  - Scope: the frontend-dev copy modules (`src/components/**/copy.ts`), `src/components/regions-scan.test.ts`, and the `*.test.ts(x)` for each copy module changed
  - Design sections: Owner patches t, u and v.
  - Acceptance:
    - The PR lists every user-facing claim in the copy modules, the landing page, the How_Page and the README against the code or data on `main` that makes it true, and fixes or removes each that isn't (E1.1, spec 08 R19).
    - Every user-facing statement follows the README framing; the Retired_Phrase search of every page in G2.9 finds nothing (F8).
    - Every claim that depends on a cut task is removed (G3.6). On a real-sealing no-go, nothing promises real sealing (spec 08 R25.2).
  - Tests: a scan of the copy modules for wording that depends on cut tasks or the no-go, matched to the recorded decisions.
  - Earlier-spec tests changed or retired: copy tests of any module whose wording changes; name each.
  - Owner_Patches attached: t (README judge box), u (`docs/kiro-writeup.md`, every count at the stated SHA), v (`docs/video-script.md`) (E1.2 to E1.4, E1.6).
  - QA shots: `/` and `/how-it-is-sealed` at the five Evidence_Sizes, only if this PR changes their copy.
  - QA steps: 09-11, 09-13 if copy changed.
  - Real_Device_Check: only if this PR changes copy on screen; then open the changed pages on both phones.
  - Validation: `bash scripts/check.sh`
  - _Requirements: E1.1–E1.4, E1.6, F8.1, G2.9, G3.6_

## Notes

- **Order.** The dispatcher claims the lowest-numbered ready issue whose dependencies are closed. The frontend-dev tasks (3 to 6, 8, 10, 11, 13, 14, 16 to 18, 20 to 24) form a chain because they share copy modules, `scene/`, `reveal/` and `live/`. Task 1 has no dependency, so it is claimed first; tasks 2 and 3 follow it, and task 7 follows task 2. The platform-dev tasks 7, 9, 12 and 19 chain through `layout.tsx` and `globals.css`. Task 15 waits for task 14 only to keep group order. Task 19 waits for task 18 so the retired tokens are deleted only after no component uses them. A closed-unmerged issue (a cut task, or task 15 under OD3 (a)) also satisfies a dependency.
- **Group A and task 7.** G3.1 asks for group A tasks to carry lower numbers than group B. Task 7 (fonts) does, and the 10 November gate covers tasks 1 to 7.
- **Phone first.** The landing tasks 8 to 12 meet P1 to P3, P8.4, P9.3 and P11; task 13 meets P2, P3 and P5; task 14 meets P4 and P9; task 16 meets P4.1, P6 and P7; task 17 meets P4.1 and P8; task 21 meets P8 to P10.
- **Framing.** Steering first (owner step O0). Brand_Copy and the hero in task 8, metadata and the guard tests in task 9, landing sections in task 10, headings in task 13, stage words in task 14, the closing line in task 17, the live step names in task 21, the final check in task 24.
- **Letters and type.** Fonts and sans headings in task 7; the WaxSeal and the `/demo` envelopes in task 11; recall titles in task 14; the seal Stages in task 17; the paper, light, creases and the component token cleanup in task 18; the token deletion and the two guard tests in task 19.
- **Cuts (G3.5).** A cut goes into the issue body (or the issue is closed unmerged) before the task is claimed. Tasks 23 and 22 first, then task 20 and the Coven_Strip lines of tasks 10 and 12. Nothing in tasks 1 to 7, no phone criterion and no group L criterion on its own.
- **Owner_Patches by task.** w, x and y: owner step O0, no task. n and o: owner step O2, no task. p: task 2. q and r: owner step O3, no task. s: tasks 6, 8, 13 and 14. t, u and v: task 24.
- **Property coverage.** 1, 2 (task 1); 3, 5 (task 3); 4 (tasks 3 and 16); 6, 7 (task 5); 8 (task 15); 9 (task 16); 10 (task 14); 11 (task 21); 12 (task 12).
- **Owner decisions.** OD1 to OD20 are decisions, not tasks. A task that depends on one uses the default unless the owner has written otherwise into its issue body, and the PR names the decision.

## Task Dependency Graph

Dependencies: 1 has none; 2 after 1; 3 after 1; 4 after 3; 5 after 4; 6 after 5; 7 after 2; 8 after 6 and 7; 9 after 2, 7 and 8; 10 after 8; 11 after 10; 12 after 9, 10 and 11; 13 after 11; 14 after 13; 15 after 1 and 14; 16 after 14 and 15; 17 after 16; 18 after 17; 19 after 12 and 18; 20 after 19; 21 after 20; 22 after 21; 23 after 22; 24 after 23.

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2", "3"] },
    { "id": 2, "tasks": ["4", "7"] },
    { "id": 3, "tasks": ["5"] },
    { "id": 4, "tasks": ["6"] },
    { "id": 5, "tasks": ["8"] },
    { "id": 6, "tasks": ["9", "10"] },
    { "id": 7, "tasks": ["11"] },
    { "id": 8, "tasks": ["12", "13"] },
    { "id": 9, "tasks": ["14"] },
    { "id": 10, "tasks": ["15"] },
    { "id": 11, "tasks": ["16"] },
    { "id": 12, "tasks": ["17"] },
    { "id": 13, "tasks": ["18"] },
    { "id": 14, "tasks": ["19"] },
    { "id": 15, "tasks": ["20"] },
    { "id": 16, "tasks": ["21"] },
    { "id": 17, "tasks": ["22"] },
    { "id": 18, "tasks": ["23"] },
    { "id": 19, "tasks": ["24"] }
  ]
}
```
