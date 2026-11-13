# Requirements Document

Spec: 12 Submission polish

## Introduction

Revenant is entered in Kiroween 2026, Resurrection category. Submissions close 4 December 2026, 2:00 PM PT. The owner's feature freeze is 27 November 2026. Judging runs 16 December 2026 to 29 January 2027, and the site must work the whole time, free of charge. Judges score Potential Impact, Technological Implementation (Kiro use), Design, Innovation and Presentation equally. This spec was written against `main` at `4b71564` (the H1 landing merge, #380) and re-based on `main` at `dcea0e3` (#381, which patched `README.md`, `docs/kiro-writeup.md` and `docs/video-script.md`), after the owner walked `/demo/live` on a desktop browser and found the end of the walk broken.

Spec 11 made Revenant a general letter. This spec does not add features. It repairs what a judge sees in the first five minutes and finishes the paperwork. It has seven areas, in priority order:

- **The live reveal is broken on desktop (P0).** After the seal is broken on `/demo/live`, the testimony, the letter and the receipts are drawn in a narrow dark box inside the cream card. The letter sits in a column about 100 px wide. The "Questions you left for yourself" heading is dark on dark. The fingerprint wraps two groups to a line. The "Open a persona letter" link is cream on cream. Maya's persona letter, on the same Ceremony, gets a full-width dark reveal. The page also shows two motion controls, and the stepper shows "See the receipts" before the seal is broken.
- **A zero change is shown as a result.** A letter locked for 30 seconds has the same Then and Now figure, and the receipt prints "unchanged 0.000 0.0%" with a formula.
- **The Write step reads as a form.** It should read as a letter: a large paper-like field, a small row of Occasion chips, compact question rows, and one quiet secondary action.
- **The receipt picker is untidy.** It prints values at full precision, shows dates in a form nobody reads, repeats the "hasn't fetched a newer figure" note per row, and does not group by region. An empty "your own number" row blocks Next.
- **The landing sections are stuck in a narrow left column on desktop.**
- **The paperwork is unfinished.** At `dcea0e3` the README has a video slot but no video link, a status line that will be stale again by the freeze, and a merged-PR count (206, 13 November) that must be recomputed at the final SHA. `docs/video-script.md` no longer names "Seal the figures" but lists four steps, has no spoken lines and no word counts. `docs/kiro-writeup.md` has seven unfilled OWNER notes that only its author can write.
- **QA walks only the first screen.** The live flow has six stepper items (X4) and a reveal, and nobody has a screenshot of the last one.
- **Ownership is already settled.** The session that landed this spec ("init spec 12") widened platform-dev's paths to the five the paperwork and QA tools need (G4). No task of this spec changes ownership, and no task is reserved for a person: an agent picks up every one.

Requirements are grouped and numbered by priority: G (rules for every task); X (the live reveal, P0); Z (the single comparison rule, P0); W (the Write step, P1); K (the receipt picker, P1); H (landing, P1); D (paperwork, P1); Q (QA walk, P0 for X and Z, then P1 for the rest). Every rule of `.kiro/steering/` and of specs 02 to 11 still holds unless "Rules this spec replaces" names it.

## Code facts this spec relies on

Checked on `main` at `dcea0e3` (visual and code facts unchanged since `4b71564`; the README, write-up and video-script rows re-read at `dcea0e3`), in the local checkout, by reading the files named. I did not run a browser for this spec, so every visual claim in the Introduction is the owner's observation and the design must reproduce it before fixing it (X1.1). The right-hand column says what is not yet known.

| Topic | What exists | Not yet known |
|---|---|---|
| Live stepper steps | `LIVE_STEPS` in `src/components/live/stepper/live-steps.ts`: `write`, `seal`, `wait`, `testify`, `receipts`. Names come from `BRAND_COPY.ritualSteps` (Write, Press the seal, Testify, See the receipts) and `LIVE_COPY.waitStep`. `stepForFlowPhase` returns `testify` for `recall`, `submitting`, `submit_failed`, and `receipts` once the flow is in `reveal`. The live stepper has no "Break the seal" item today. | Whether the flow is already in `reveal` while the Stage is still `marks` or `seal`. The owner reports that "See the receipts" is current before the seal is broken. |
| Persona stepper | The persona Step_Indicator (`ceremony/steps.ts`) names Testify, Break the seal, Read and See the receipts. | — |
| Live reveal host | `OpeningFlow` is embedded in `LiveWaitStep.tsx` inside the Live_Stepper's primary card. `LiveGhost.tsx` reuses the persona Ghost and says it keeps "one Calm control and one Skip registry" under `SceneShell`. | Which wrapper makes the reveal a narrow dark box, and which component renders the second motion control. The design finds both. |
| Calm control | `useCalmInForce` in `src/components/ceremony/motion` reads the Calm state; `data-ceremony-motion` carries `full` or `calm`. | Where the two visible controls come from. |
| Lock note | `LIVE_COPY.lockNote` ("This letter was locked for 30 seconds."), `lockNoteComparison` ("For a longer comparison, open a persona letter.") and `lockNoteLink` ("Open a persona letter"). `REVEAL_COPY.lockNote` and `lockNoteLink` carry the older combined sentence. Only `LiveLockNote` renders `LIVE_COPY.lockNote`; `REVEAL_COPY.lockNote` and `REVEAL_COPY.lockNoteLink` are rendered nowhere, so they are dead strings. | — |
| Change line | `src/lib/figures/format-change.ts` is the only place that computes the then-vs-now change. Its result has `direction: "rose" \| "fell" \| "unchanged"`. The Receipt_Card prints the Then and Now values at Display_Precision and the change from the As_Published_Values (spec 11 P5). | How the Receipt_Card renders the `unchanged` direction, and whether the formula is always shown. |
| Rehearsal line | `LIVE_COPY.rehearsalLine`: "This is a rehearsal. A real letter stays sealed for months. This one opens in 30 seconds." It is shown under the Write heading and next to the Wait countdown (`SealPage.tsx`, `LiveWaitStep.tsx`, `data-live-rehearsal`). | — |
| Write step | `WriteForm`, `OccasionPicker`, `AuthorQuestions`, `ReceiptsDisclosure`, `FigurePicker`, `SelfReportedRows` under `src/components/live/`. `LIVE_COPY.authorQuestionRemove` is "Remove question {n}". Spec 11 L3 set the Next control inside the First_Viewport. | The current field height, font and remove-control size. |
| Picker note | `FigurePicker.tsx` (lines 156 to 160) prints `REVEAL_COPY.fallbackNote` with the figure's retrieved date for every Fallback_Figure row. `catalogue-list.ts` carries `fallbackRetrievedAt` per item. | — |
| Landing | `src/app/page.tsx` renders the hero and then `RitualSection`, `ResurrectionSection`, `NoSealSection` and `CovenStrip` (spec 11 H1, #377 and #380). | The container and grid rules in `landing.module.css` that cap the sections to a left column. |
| README | At `dcea0e3`: line 13 holds `<!-- VIDEO: embed link here --> <!-- GIF: docs/reveal.gif -->`. Line 67: "Specs 01 to 10 are complete and spec 11 (any letter) is in progress, as of 13 November 2026." Line 117 already says "206 merged pull requests" with the command and the date but no SHA. The ritual list (lines 49 to 52) already has four steps and no "Seal the figures". | Whether spec 11 is ticked at the time the README is patched (D1.2), and the merged count at the final SHA (D1.3). |
| Video script | `docs/video-script.md` is a short beat sheet. Since #381 its intro lists the four ritual steps (Write, Press the seal, Testify, See the receipts) and no longer names "Seal the figures". Its five beats start at 0:00, 0:20, 1:30, 2:10 and 2:45 and carry no spoken line or word count. The live beat has no Wait or Break the seal step. | — |
| Write-up | `docs/kiro-writeup.md` has seven OWNER comments, at lines 5, 17, 47, 77, 96, 105 and 115 at `dcea0e3` (they were at 5, 15, 40, 64, 78, 82 and 88 at `4b71564`). Its header names SHA `4b71564` and says 206 merged pull requests on 13 November 2026, so it is already behind `main`. | — |
| History | `git log --format=%s` shows 197 commits whose subject ends in `(#N)`; 16 are merge commits. `gh` is installed. | The real merged PR count. It comes from `gh pr list --state merged`, not from either git figure (D1.3). |
| Specs | `.kiro/specs/` holds 01-skeleton, 02-demo-figures, 02-sealed-letters, 03-persona-demo, 04-real-figures, 05-reveal-ceremony, 06-lock-and-unlock, 07-judge-journey, 08-judge-polish, 09-demo-polish, 10-own-questions and 11-any-letter. With spec 12 that is 13 directories (two specs share the number 02, and the folders are not renamed). The README status line (line 67 at `dcea0e3`) says specs 01 to 10 are complete and spec 11 is in progress, as of 13 November 2026. | The ticks at the time the README is patched. D1.2 reads them from each `tasks.md`. |
| Ownership | Already changed by the "init spec 12" commit (G4): `.github/agents.json` gives platform-dev `README.md`, `docs/video-script.md`, `docs/writeup-gaps.md`, `tools/qa/**` and `scripts/check-js-budget.mjs`. The owner-only lists in `tools/agents/generate_agents.py` and `tools/dispatcher/pr_policy.py` deny `tools/agents/**`, `tools/dispatcher/**` and `tools/hooks/**` instead of all of `tools/**`. `.kiro/**`, `.github/**`, `scripts/check.sh` and `docs/kiro-writeup.md` stay with no role. frontend-dev owns `src/app/**/*.tsx`, `src/components/**`; data-dev owns `src/lib/figures/**`. `src/test/integration/live-walk.test.ts` and `package.json` are shared paths, not owned by one role. | — |

## Decisions already made

| Topic | Decision |
|---|---|
| Deadlines | Today is 13 November 2026. Groups X and Z merged by 18 November 2026. Nothing is queued ahead of the reveal-host task (X1 and X2), not even the Q1 walk setup: IF the walk setup takes longer, THEN X and Z ship first and the walk runs on them afterwards. All groups merged by the 27 November 2026 freeze. Submission 4 December 2026, 2:00 PM PT. |
| Order | X1 and X2 (the reveal host and the one motion control) first, then Z1, then X3 and X4, then Z2. After that W, K and H in any order, then D, then the final Q walk on the merged build. No task precedes X1. |
| One reveal | The reveal on `/demo/live` is the same Ceremony reveal Maya's persona page shows: full width, dark, same components. The live page does not get its own reveal layout. |
| One motion control | The page shows one motion control. It is the Ceremony's Calm control. The Live_Stepper adds none. |
| No zero change | A Then and Now that are the same figure show the figure once and a plain "nothing to compare yet" line. No change value, no percentage, no formula, no direction word. |
| Format and crypto | No change. Nothing in this spec touches `src/lib/seal-format/**`, `src/lib/crypto/**`, the envelope, the time lock or any `format_version`. |
| Numbers kept | Letter field at least 10 lines tall on desktop and at least 6 on a phone; walk widths 1440 and 390 px; script under 3 minutes. |
| Every task is an agent's task | The agent loop does everything. README, `docs/video-script.md` and the write-up gaps report are ordinary platform-dev tasks, on paths G4 already grants. No task needs a person to apply a patch, and none is labelled for one. `docs/kiro-writeup.md` belongs to no role, stays byte-identical, and no opinion is written into it (D3). |
| Cut order | K4 first, then the 600 to 1023 px band of W1.2, then H2. W5 and D2 are never cut (G3.4). |
| Picker regions | Two groups, United States then European Union. No Sweden group in the picker (spec 03 R23.1, enforced by `sweden-guard.test.ts`). |
| Stepper | The live stepper has six items: Write, Press the seal, Wait, Testify, Break the seal, See the receipts (X4). |
| Video | The payoff is Maya's receipts, not the 30-second letter (D2). |
| Privacy and size | Spec 09 G1.5 and G1.6 unchanged: CSP header byte-identical, no request to another origin, nothing written to storage, cookies or the URL, no new `dependencies` entry, no animation library, no WebGL, every route inside `scripts/check-js-budget.mjs`. |

### Rules this spec replaces

Each rule below is replaced only for the work of this spec, by the requirement named.

- **Spec 09 D5 and spec 09 D6, where they place the embedded Opening_Flow inside the Live_Stepper's cream primary card**: replaced by X1 for the Break the seal Stage and the reveal. The Wait and Testify steps may stay in the card.
- **Spec 09 F4.3 and spec 11 L1.6, where the Live_Stepper has five fixed step names and "See the receipts" is current from the flow's `reveal` state**: replaced by X4 (the current step reads "Break the seal" until the seal is broken).
- **Spec 11 L1.4 and L3.5, where the Receipts_Disclosure sits after the question rows and Next is the only button row**: replaced by W5 for the arrangement of Next and "Add a receipt". The disclosure stays a native `details`, closed by default.
- **Spec 11 L2.1 and L2.9, where the Occasion control is a single-choice group of labelled buttons above the letter field**: kept in meaning, replaced by W2 for its size (chips in one small row).
- **Spec 10 C2.1, where each Author_Question row has a visible remove control**: replaced by W3 (a small icon button).
- **`LIVE_COPY.authorQuestionRemove` ("Remove question {n}") as the visible label**: replaced by W3. The string stays as the accessible name.
- **Spec 11 L4.1, where the Rehearsal_Line is two sentences or more**: replaced by W4 (one sentence). L4.3 and L4.5 stay.
- **Spec 11 P5.1 to P5.3, for the figure picker only** (they apply to the Receipt_Card): extended by K1 so the picker uses the same precision.
- **Spec 11 X3.5 and the Bundled_Note placement, where each row shows the note**: replaced by K3 for the picker (one note for the list). The Reveal keeps one note per Now_Figure.
- **Spec 11 H1.1 layout rules where they allow a left-column container**: replaced by H1 and H2 at 1024 px and wider.
- **Spec 11 H2.2 `ritualSteps` as the video's step list**: the video script follows it (D2.1); `docs/video-script.md` as it stands is replaced.
- **Spec 11 H3.3 and H4.2** (the README count, the write-up evidence lists): replaced for the README count by D1.3, and kept as a report with git evidence in D3. Spec 11 H3 and H4 merged in #381, so this spec's D tasks edit the files as they stand at `dcea0e3` (D1.5).

## Out of scope

- Any change to `src/lib/seal-format/**`, `src/lib/crypto/**`, the key hierarchy, the time lock or the envelope.
- A new Stage, a new persona, a new Occasion, new figures or new regions.
- Redesigning the persona reveal. The persona page is the reference and is left as it is, except where X1 to X3 share a component.
- Any comparison, score, summary or interpretation of testimony against the letter (`neutrality.md`).
- Writing the owner's opinions, claims or counts into `docs/kiro-writeup.md` (D3).
- Recording the video, producing a GIF or choosing the video host. The README keeps a slot for the video link, to be filled once the video exists.
- Real sealing on `/seal` (spec 11 L6 stays no-go unless the owner records a go).
- Dark mode for the cream Write step. The Write step stays on warm paper.

## Known limitations

- **The video link does not exist yet.** D1.1 keeps the slot marker. It cannot be filled before the video exists, so the README ships with the marker in place.
- **The git history undercounts or overcounts pull requests.** Squash merges put `(#N)` in the subject, and direct commits and merge commits do not. D1.3 takes the count from the GitHub API, and the task reports which command produced it.
- **The Walk is a local rehearsal.** The virtual authenticator proves the code path, not any phone's passkey provider (spec 11 Known limitations).
- **A letter locked for 30 seconds will always show "nothing to compare yet".** That is the honest result, not a defect (Z1).

## Glossary

- **Live_Reveal**: The reveal of a Live_Letter on `/demo/live`: the `marks`, `seal`, `letter`, `figures` and `close` Stages, from the break of the seal to the end (X1).
- **Reveal_Host**: The element that contains the Ceremony's reveal. For a persona it is the full-width Scene content; for a Live_Letter today it is the Live_Stepper's primary card.
- **Primary_Card**: The cream card that holds the current step of the Live_Stepper.
- **Motion_Control**: The visible control that turns decorative motion off or on (Calm control).
- **Same_Figure**: A Then_Figure and a Now_Figure with the same series, unit and region, the same period and the same published value (Z1.1).
- **Single_Figure_View**: The Receipt_Card content for a Same_Figure: the figure once, with its period and source, and the Nothing_To_Compare_Line (Z2).
- **Nothing_To_Compare_Line**: The one plain sentence that says there is nothing to compare yet for a Same_Figure (final wording in the design).
- **Letter_Field**: The `textarea` that holds the letter text on the Write step.
- **Occasion_Chips**: The Occasion choices drawn as small chips in one row above the Letter_Field (W2).
- **Remove_Icon**: The small "×" icon button on an Author_Question row (W3).
- **Receipts_Action**: The "Add a receipt" control beside Next (W5).
- **Picker_Group**: One region's heading and its figures in the figure picker (K4).
- **Picker_Note**: The single "hasn't fetched a newer figure" note shown once above the picker list (K3).
- **Short_Date**: A date written as day, abbreviated month and four-digit year, for example "26 Oct 2026" (K2).
- **Video_Slot**: The README marker that is replaced with the video link once the video exists (D1.1).
- **Gaps_Report**: The list of unfilled OWNER notes in `docs/kiro-writeup.md`, each with the git evidence found for it, delivered in the PR description and in `docs/writeup-gaps.md` and not written into the write-up (D3).
- **Step_Shot**: A PNG screenshot of one step or Stage of the live flow, at 1440 or 390 px wide (Q2).
- **Live_Walk**: The QA walk of the whole `/demo/live` flow, from the first screen to the Close, at both widths (Q1).
- **Evidence_Sizes**, **Phone_Sizes**, **First_Viewport**, **Step_Indicator**, **Receipt_Card**, **Journey_Check**, **Production_Check**, **Brand_Copy**, **Retired_Phrases**, **Copy task**, **Display_Precision**, **As_Published_Value**, **Short_Name**, **Live_Stepper**, **Rehearsal_Line**, **Occasion**, **Receipts_Disclosure**: as defined in specs 09, 10 and 11.
- **Ceremony**, **Stage**, **Skip_Link**, **Seal_Button**, **Seal_Group**, **Calm_Mode**, **Scene**, **Ghost**, **Content_Column**, **Fingerprint**, **Letter_Block**: as defined in specs 05, 07 and 10.
- **Live_Letter**, **Letter_Page**, **Seal_Page**, **Sealing_Flow**: as defined in spec 06.
- **Then_Figure**, **Now_Figure**, **Fallback_Figure**, **Catalogue**, **Figures_API**: as defined in specs 03, 08 and 11.
- **Persona_List**, **Opening_Flow**, **Reveal**: as defined in spec 03.

## Requirements

### G1. Roles and boundaries

**User story:** As the owner, I want each task inside one role's paths, so that the agent loop and the PR policy keep working.

#### Acceptance Criteria

1. THE task's PR SHALL change only files that are matched by the task role's paths or the `shared` list in `.github/agents.json` and are listed in the task's Scope.
2. THE frontend-dev tasks SHALL add, edit or delete no file under `src/app/api/`, `src/lib/crypto/`, `src/lib/seal-format/`, `src/lib/letter-store/`, `src/lib/db/` or `drizzle/`.
3. WHEN a task needs a change to `README.md`, `docs/video-script.md`, `docs/writeup-gaps.md`, `tools/qa/**` or `scripts/check-js-budget.mjs`, THE task SHALL make that change in its own PR as a platform-dev task (G4), and SHALL NOT leave the change for another ticket.
4. THE PRs SHALL keep spec 09 G1.5 and G1.6: the CSP header byte-identical; no browser request to another origin; nothing written by new code to `localStorage`, `sessionStorage`, IndexedDB, cookies, the URL path, the query string or the fragment; no new entry in the `dependencies` object of `package.json`; no animation library, no WebGL, no new font, no sound or vibration cue; every route at or under its budget in `scripts/check-js-budget.mjs`.
5. THE PRs SHALL change no crypto primitive, key hierarchy step, envelope header field or `format_version`, and SHALL edit no line of `src/lib/seal-format/v1/payload.ts`.
6. EVERY string of Our_Copy that a PR adds or changes SHALL live in its feature folder's copy module, SHALL pass the `neutrality.md` copy test and the `tone.md` copy rules (second person, at most 25 words per sentence, no exclamation mark, no pun), and SHALL contain none of the Scoring_Words_Always; strings in the Scene_Copy_Modules SHALL also contain none of the Scoring_Words_Scene.
7. THE Accent SHALL mark only the reader's own answer, the main buttons, the wax and the focus ring. THE Accent SHALL NOT mark a figure, a change or a direction, and SHALL NOT be used for text on purple.
8. EVERY text on a purple or near-black surface SHALL be pure white or the dark-scene text colour, and EVERY text and number SHALL meet WCAG 2.2 AA contrast (4.5:1 for body text, 3:1 for large text and non-text controls) on the surface it sits on.
9. THE task description SHALL name the one role that does the work. A requirement that needs two roles SHALL be split into one task per role, in dependency order.

### G2. Tests and evidence

**User story:** As the owner, I want proof from the browser and from production, so that a task that passes locally can't fail silently on the live site.

#### Acceptance Criteria

1. THE tests SHALL run in `npm test` with no network, with `DATABASE_URL` unset and every `fetch` stubbed, using `renderToStaticMarkup` and no browser, apart from the Live_Walk (Q1), which runs against a production build.
2. THE property tests SHALL use fast-check with `numRuns` of at least 100 and the tag `// Feature: 12-submission-polish, Property N: <title>`.
3. EACH task SHALL run `bash scripts/check.sh` on its final commit and report the commit SHA, the exit status and PASS or FAIL in its PR description.
4. EACH task that changes anything on screen SHALL attach PNG screenshots of every Stage or page it changes at 1440×900 and 390×844, named `<stage-or-page>-<width>x<height>.png`, and the same set with `prefers-reduced-motion: reduce` named `<stage-or-page>-<width>x<height>-reduced.png`. Phone shots SHALL be First_Viewport captures plus one full-page capture per page.
5. EACH task's PR description SHALL state every route budget from `node scripts/check-js-budget.mjs` after `npm run build`, and every earlier-spec test it changed or retired with the reason, writing "none" for an empty list.
6. EACH copy task SHALL attach the result of `node tools/hooks/tone-check.mjs` for every copy file it changed and a search of the rendered Our_Copy of every page it changed showing that no Retired_Phrase remains.
7. THE QA agent SHALL run the rows of the design's "QA browser steps" table that the task lists, found with the pattern `^\| 12 \|`.

### G3. Task order and cuts

**User story:** As the owner, I want the work in an order that fixes the demo first, so that a late freeze costs the least.

#### Acceptance Criteria

1. THE tasks SHALL be numbered so that the first task is the reveal-host task (X1 and X2), then the Z1 task, then the X3 and X4 tasks, then the Z2 task; every group X and group Z task has a lower number than every group W, K, H and D task; the Q1 and Q2 walk-setup task comes after them; the README task (D1) is the last task before the final Q walk; and the final Q walk has the highest number.
2. EACH task SHALL be one GitHub issue and one PR for one role, with a changed-line estimate at or under `max_changed_lines` in `.github/agents.json` (5,000).
3. WHEN a PR merges, `main` SHALL pass `bash scripts/check.sh`, and `/`, `/demo`, `/demo/live`, `/l/[id]` and every persona page SHALL load without error.
4. IF the 27 November 2026 freeze arrives with work open, THEN THE team SHALL cut in this order: K4 first, then the 600 to 1023 px band of W1.2, then H2. Nothing in G, X, Z, Q1, Q2, W1 (apart from that band), W3, W5, K1 to K3, H1, D1 or D2 SHALL be cut.
5. THE tasks SHALL carry "Depends on" lines naming only spec 12 task numbers.
6. THE group X and group Z tasks SHALL NOT depend on the Q1 walk setup, and no task SHALL be queued ahead of the X1 and X2 task; IF the walk setup takes longer than the 18 November 2026 deadline for groups X and Z, THEN THE group X and group Z tasks SHALL merge first and the Live_Walk SHALL run on them afterwards.

### G4. Ownership precondition for the paperwork and QA tools

**User story:** As the agent loop, I want the paperwork and QA tool paths already assigned to a role, so that no task of this spec waits on an ownership change.

This group states the state of the repository when the spec starts. It is a precondition, not a task. The "init spec 12" commit that lands this spec made the change in `.github/agents.json`, in both owner-only lists, in `.kiro/agents/prompts/common.md`, in `docs/agent-loop.md`, in the dispatcher tests and in the regenerated `.kiro/agents/*.json`.

#### Acceptance Criteria

1. THE `.github/agents.json` file at the start of this spec SHALL give platform-dev these paths and only these new ones: `README.md`, `docs/video-script.md`, `docs/writeup-gaps.md`, `tools/qa/**` and `scripts/check-js-budget.mjs`.
2. THE `docs/**` glob SHALL NOT belong to any role. THE `docs/kiro-writeup.md` file SHALL belong to no role, and the dispatcher test in `tools/dispatcher/tests/test_scope_check.py` SHALL check that no role can write it.
3. THE owner-only lists in `tools/agents/generate_agents.py` and `tools/dispatcher/pr_policy.py` SHALL deny `tools/agents/**`, `tools/dispatcher/**` and `tools/hooks/**` in place of all of `tools/**`.
4. THE paths `src/lib/seal-format/**`, `src/lib/crypto/**`, `.kiro/steering/**` and `.kiro/specs/**` SHALL stay assigned to no additional role.
5. THE paths `src/test/integration/live-walk.test.ts` and `package.json` SHALL be shared paths, not paths owned by one role.
6. WHEN a task of this spec changes any path in criterion 1, THE task SHALL run as an ordinary platform-dev task under G1.1.
7. IF a task finds that a path in criterion 1 is refused by `pr_policy`, THEN THE task SHALL report the refusal in its PR description and SHALL NOT change `.github/agents.json`, the generator or the policy.

### Group X. The live reveal (P0)

### X1. The Live_Reveal has the Ceremony's full-width dark layout

**User story:** As a judge who sealed my own letter, I want the reveal to look like Maya's, so that my letter is readable and the end of the demo is worth the wait.

#### Acceptance Criteria

1. THE first X task SHALL reproduce the defect before changing it: it SHALL attach screenshots of the Live_Reveal at 1440×900 and 390×844 for the Stages `marks`, `letter`, `figures` and `close`, and SHALL name in its PR description the wrapper that produces the narrow dark box and the component that renders each of the four symptoms in the Introduction.
2. WHEN a Live_Letter reaches the `marks` Stage, THE Live_Reveal SHALL render in the same Reveal_Host and with the same layout, background and components as the persona reveal, so it spans the Content_Column's full width rather than sitting inside the Primary_Card.
3. AT 1440×900, THE Letter_Block of the Live_Reveal SHALL be at least 560 CSS px wide and at most 760 CSS px wide, SHALL wrap the letter text at word boundaries, and SHALL have no horizontal scroll.
4. AT 390×844, THE Letter_Block SHALL be at least 300 CSS px wide and SHALL cause no horizontal scroll on the document or on any card.
5. THE Live_Reveal SHALL render every heading, label, question, answer and link in a colour that meets G1.8 against the surface behind it, including the "Questions you left for yourself" heading and the "Open a persona letter" link.
6. THE Fingerprint SHALL wrap at most four hex groups per line at 1440×900 and at most two at 390×844 on a clean grid, with the groups never split, and SHALL show its full value in the document.
7. THE Live_Reveal SHALL contain no element that is dark text on a dark surface or light text on a light surface; a contrast test SHALL read the real CSS tokens for every text colour used in the Live_Reveal on the surface it sits on, and SHALL print the ratios.
8. WHEN the Live_Reveal ends in the Close, THE Close SHALL show the lock note and the link to the persona letters in the dark-scene text colour, with the link underlined and a visible focus ring.
9. THE persona reveal SHALL look and behave as it does on `main`; a layout check SHALL pass for both Maya and Tomás at 1440×900 and 390×844.
10. THE order SHALL stay: testimony, then the letter, then any numbers, with the letter text as one unchanged text node and nothing placed against its lines (spec 10 C8.3).
11. THE Live_Reveal SHALL work with and without reduced motion, with the settled Ghost pose and no decorative motion under Calm_Mode.

### X2. One motion control

**User story:** As a visitor who prefers less motion, I want one control that does it, so that I'm not unsure which one works.

#### Acceptance Criteria

1. THE `/demo/live` page SHALL show exactly one Motion_Control at every Stage and at every width, and the document SHALL contain exactly one element that exposes the Calm toggle role.
2. THE Motion_Control SHALL be the Ceremony's Calm control, and the Live_Stepper SHALL render no second one.
3. WHEN the visitor turns decorative motion off with the Motion_Control, THE Ghost, the Envelope and every Stage transition SHALL stop moving, in every step of the Live_Stepper.
4. WHEN `prefers-reduced-motion: reduce` is set, THE page SHALL start with decorative motion off and SHALL show the Motion_Control in the off state.
5. THE Motion_Control SHALL have an accessible name, SHALL be reachable by keyboard and SHALL have a target of at least 44×44 CSS px below 600 px.
6. THE persona pages SHALL keep exactly one Motion_Control.
7. A test SHALL count the Motion_Controls in the markup of each step of the Live_Stepper and of each persona Stage, and SHALL fail when any count is not 1.

### X3. The Close is honest and legible

**User story:** As a judge at the end of the demo, I want a plain closing line and a link I can read.

#### Acceptance Criteria

1. THE task SHALL delete the dead `REVEAL_COPY.lockNote` and `REVEAL_COPY.lockNoteLink` strings, so that `LiveLockNote` is the only component that renders a lock-note sentence, and a test SHALL assert that the sentence "This letter was locked for 30 seconds." appears exactly once in the live Close markup.
2. WHERE the letter holds official figures, THE live Close SHALL show `LIVE_COPY.lockNoteComparison` and the persona link; WHERE the letter holds none, THE live Close SHALL show the persona link alone (spec 11 L4.4).
3. THE persona link SHALL lead to `/demo`, SHALL be at least 44 CSS px tall below 600 px and SHALL meet G1.8 on the Close surface.
4. THE live Close SHALL carry no exclamation mark and no judgement of the testimony.

### X4. The stepper says "Break the seal" until the seal is broken

**User story:** As a judge, I want the stepper to show where I am, so that I know the next thing to do is break the seal.

#### Acceptance Criteria

1. THE Live_Stepper's Step_Indicator SHALL have six items in this order, matching the persona stepper: Write, Press the seal, Wait, Testify, Break the seal, See the receipts.
2. WHILE the seal is not yet broken (the Stage is `marks` or `seal`), THE Step_Indicator SHALL mark "Break the seal" as current and SHALL NOT mark "See the receipts" as current.
3. WHEN the seal is broken (the Stage moves to `letter`), THE Step_Indicator SHALL show "See the receipts" as the current item and "Break the seal" as done.
4. WHEN the visitor activates the Skip_Link on `marks`, THE Step_Indicator SHALL move to "See the receipts" in the same render as the Stage moves to `letter`.
5. THE Step_Indicator SHALL show every item at both widths with no truncation, no ellipsis and no item clipped by the viewport (spec 10 X2.2), and its current item SHALL have `aria-current="step"`.
6. THE Back rule of spec 11 L1.6 SHALL stay: Back is never offered after the seal is stored.
7. THE mapping SHALL be a pure function of the Stage and the flow state, tested in Node, and SHALL NOT depend on a timer.
8. FOR ALL Stages of the Live_Reveal, exactly one item of the Step_Indicator SHALL be current (property test).

### Group Z. One comparison rule (P0)

### Z1. A Same_Figure is not a change

**User story:** As a judge who locked a letter for 30 seconds, I want the receipt to say there is nothing to compare, so that a zero is not shown as a finding.

#### Acceptance Criteria

1. A Then_Figure and a Now_Figure SHALL be a Same_Figure WHEN they share the same series, unit, region and period and their published values are equal as decimal strings after parsing (no floating-point comparison).
2. THE Same_Figure test SHALL live in `src/lib/figures/` beside the change calculation, so the formula shown and the rule used are the same code (`structure.md`).
3. WHEN the Then_Figure and the Now_Figure share a series but differ in period, THE Receipt_Card SHALL compute and show the change exactly as it does today, including a change of zero between two different periods.
4. IF the Now_Figure has the same period as the Then_Figure and a different value (a revised figure), THEN THE Receipt_Card SHALL show the existing revision treatment and SHALL NOT use the Single_Figure_View.
5. THE comparison SHALL use no tolerance, no rounding and no estimate; rounding happens only at display time (`data-integrity.md`).
6. FOR ALL pairs of figures, THE Same_Figure test SHALL be symmetric, and SHALL be true for a figure compared with a copy of itself (property test).

### Z2. The Single_Figure_View

**User story:** As a judge, I want to see the sealed figure once, with its source, and a calm line saying why there is no comparison.

#### Acceptance Criteria

1. WHEN a Receipt_Card holds a Same_Figure, THE Receipt_Card SHALL show the figure once at Display_Precision, with its period (as a Short_Date or the period's own form), its region, its unit and the source control, under the Short_Name heading.
2. THE Single_Figure_View SHALL show the Nothing_To_Compare_Line, a single plain sentence (final wording in the design, for example "This is the same record as the one you sealed, so there is nothing to compare yet.").
3. THE Single_Figure_View SHALL show no change value, no percentage, no formula, no "unchanged", no "rose" or "fell", no Number_Line and no Then or Now label pair.
4. THE Single_Figure_View SHALL keep the As_Published_Value in the source details, so the published value stays visible exactly as sealed.
5. THE Nothing_To_Compare_Line SHALL contain no word that grades the result (no "good", "bad", "same price", "no change", "unchanged") and SHALL pass the `neutrality.md` copy test.
6. THE Single_Figure_View SHALL give up and down no visual treatment, and SHALL use no colour that implies a direction.
7. WHEN a letter holds several figures, THE Reveal SHALL decide per figure: a Same_Figure card and a compared card MAY sit in the same list.
8. WHEN every figure of a letter is a Same_Figure, THE Reveal SHALL show one Nothing_To_Compare_Line per card, not one for the list.
9. THE Reveal SHALL still reach the Close from the figures Stage, and the Step_Indicator SHALL still complete.
10. A test SHALL render a Receipt_Card for a Same_Figure and assert the markup contains none of: "0.000", "0.0%", "unchanged", "rose", "fell" and the formula element.

### Group W. The Write step reads as a letter (P1)

### W1. The Letter_Field is the main thing

**User story:** As an author, I want a big sheet of paper to write on, so that this feels like writing a letter and not filling a form.

#### Acceptance Criteria

1. THE Letter_Field SHALL render in the letter serif (`tone.md`: a serif for the letter text only) on a warm paper surface, with comfortable padding and a line height of at least 1.5.
2. AT 1024 px and wider, THE Letter_Field SHALL be at least 10 lines tall when empty; AT widths below 600 px, THE Letter_Field SHALL be at least 6 lines tall when empty. Between 600 and 1023 px it SHALL be at least 8 lines tall (this band is the second item cut under G3.4).
3. WHEN the author types, THE Letter_Field SHALL grow with its content, with no inner scrollbar, up to the growth cap of half the visual viewport (spec 09 P9). Past the cap, THE Letter_Field SHALL scroll inside itself.
4. THE Letter_Field SHALL keep its visible label, its character count against 5,000 and its validation rule (spec 11 L3.6), and SHALL carry the placeholder from the chosen Occasion's starter without storing it.
5. THE Letter_Field SHALL meet G1.8 for its text and its placeholder on the paper surface.
6. AT 1440×900, THE Occasion_Chips and the top of the Letter_Field SHALL be inside the First_Viewport, and the Next control MAY sit below the fold. THE design SHALL state the measured positions and MAY place Next inside the First_Viewport where it can without shrinking the Letter_Field below its minimum height (replaces the Next part of spec 11 L3.1 at this width).
7. AT 390×844, THE Letter_Field's top and at least 6 of its lines SHALL be inside the First_Viewport, and Next SHALL be reachable by one short scroll, with no horizontal scroll at 360×640.
8. THE layout SHALL keep Next and the focused field above the on-screen keyboard (spec 09 P9).
9. A test SHALL assert the minimum line counts through the CSS custom property or `rows` value the design names, at the three width bands.

### W2. Occasion chips in one small row

**User story:** As an author, I want the Occasion choice to be small, so that it doesn't compete with the letter.

#### Acceptance Criteria

1. THE Occasion_Chips SHALL sit in one row above the Letter_Field, each chip showing its visible label and `aria-pressed`, and the group SHALL keep its legend (`occasionLegend`) available to assistive technology.
2. AT 1024 px and wider, THE five chips SHALL fit on one line.
3. AT widths below 600 px, THE chips SHALL wrap to at most two lines and SHALL cause no horizontal scroll at 360×640.
4. EACH chip SHALL be at least 44×44 CSS px below 600 px and at least 32 CSS px tall elsewhere, with a visible focus ring.
5. A chosen chip MAY use the Accent as the author's own choice, with its label in the text colour, and SHALL never rely on colour alone (it SHALL also show `aria-pressed="true"` and a non-colour mark).
6. THE Occasion rules of spec 11 L2.2 to L2.6 SHALL stay: nothing the author typed is overwritten, and the Occasion is never stored, sent or recorded.

### W3. Question rows

**User story:** As an author, I want my questions to read in full and to be removable with a small control, so that the page isn't full of big buttons.

#### Acceptance Criteria

1. EACH Author_Question row SHALL be full width of the Write column, below the Letter_Field.
2. NO Author_Question text SHALL be cut off: THE row SHALL be a text field that wraps and grows (a `textarea` that auto-sizes, or an equivalent) so that all of a question of up to 200 code points is visible without horizontal scroll or ellipsis at 1440×900 and at 390×844.
3. EACH row SHALL have one Remove_Icon: a visible "×" icon, with the accessible name from `LIVE_COPY.authorQuestionRemove` ("Remove question {n}"), and no visible text label.
4. THE Remove_Icon SHALL have a target of at least 44×44 CSS px below 600 px and at least 32×32 CSS px elsewhere, SHALL be reachable by keyboard and SHALL meet 3:1 contrast against its surface.
5. THE "×" glyph SHALL be hidden from assistive technology (`aria-hidden`) and the control SHALL be a `button` with `type="button"`.
6. WHEN the Remove_Icon is activated, THE row SHALL be removed, focus SHALL move to the nearest remaining row or to "Add a question" if none remains, and a polite live region SHALL announce the removal in calm words.
7. THE "Add a question" control SHALL remain while fewer than three rows exist, as a quiet text control and not a large button.
8. THE rules of spec 10 C2 (0 to 3 rows, 1 to 200 code points, empty rows dropped, no blocking for an empty row) and of spec 11 L1.2 (a letter needs one question or one official figure) SHALL stay.
9. A test SHALL assert the Remove_Icon's accessible name for rows 1 to 3 and that no visible "Remove question" text is rendered.

### W4. One sentence about the rehearsal

**User story:** As a judge, I want one short sentence that says this is a rehearsal, so that I understand without reading a paragraph.

#### Acceptance Criteria

1. THE Rehearsal_Line SHALL be exactly one sentence of at most 25 words (final wording in the design, for example "This is a rehearsal: a real letter stays sealed for months, and this one opens in 30 seconds.").
2. THE `/demo/live` Write step SHALL show the Rehearsal_Line once, under the heading, and THE Wait step SHALL show it once next to the countdown.
3. THE Rehearsal_Line SHALL NOT appear on `/seal`, on `/l/[id]` for a Real_Letter or on any persona page (spec 11 L4.5).
4. THE Write step SHALL carry no other sentence that says the demo is short or a rehearsal.
5. A test SHALL assert the Rehearsal_Line has one sentence terminator, at most 25 words, and appears once per step.

### W5. Next, and "Add a receipt" beside it

**User story:** As an author, I want one clear next step, with receipts as a quiet option, so that the page has one main action.

#### Acceptance Criteria

1. THE Write step's last row SHALL hold Next at the bottom right and the Receipts_Action to its left, in one row at 1024 px and wider.
2. THE Receipts_Action SHALL be a quiet secondary control (text or outline style, not the orange primary button) with the visible label "Add a receipt", and Next SHALL be the only primary button on the step.
3. WHEN the visitor activates the Receipts_Action, THE Write step SHALL open the Receipts_Disclosure (the native `details`, closed by default, with its content in the document) and move focus to its first control, without scrolling the page away from the Letter_Field.
4. THE Receipts_Disclosure SHALL stay in the document when closed, and a keyboard user SHALL be able to open it from its `summary` too.
5. AT widths below 600 px, THE row MAY stack, with Next first and full width and the Receipts_Action under it, both at least 44 CSS px tall.
6. THE tab order SHALL follow the reading order: chips, Letter_Field, question rows, Add a question, Receipts_Action, Next.
7. THE spec 11 X2 rule SHALL stay: when the figures request has failed or is loading, THE Receipts_Action SHALL still open the disclosure, which shows its loading or unavailable line, and Next SHALL NOT be disabled for it.

### W6. A blank own number never blocks Next

**User story:** As an author, I want to move on when I haven't filled in "your own number", so that an optional row isn't a gate.

#### Acceptance Criteria

1. THE "Your own numbers" group SHALL start with at most one row, and a row left entirely empty (no label, no value, no unit) SHALL be dropped at sealing and SHALL NOT block Next.
2. IF a row is partly filled (a label without a value, or a value without a label), THEN THE Write step SHALL show what is missing, after the row was touched or a seal was attempted, and SHALL block Next until the row is fixed or removed.
3. THE validation message for a partly filled row SHALL NOT show before the row was touched (spec 09 A4.4).
4. A self-reported row SHALL still count for nothing toward the "one question or one official figure" rule (spec 11 L1.2).
5. THE rule SHALL be one pure function in `form.ts` (or the module the design names) with tests: FOR ALL drafts whose own-number rows are all empty, validity SHALL equal the validity of the same draft with no rows (property test).

### Group K. The receipt picker (P1)

### K1. The picker uses the Receipt_Card's precision

**User story:** As an author choosing a receipt, I want to see the same numbers the receipt will show, so that nothing looks like a typo.

#### Acceptance Criteria

1. THE figure picker SHALL show each value at Display_Precision, by the same function the Receipt_Card uses (`formatValue(value, region, 2)` on the value after `rescaleForDisplay` where the unit has a Display_Rescale), so 1954.037871213403 EUR per 1,000 litres reads 1.95 EUR per litre.
2. THE picker SHALL show the unit as the Receipt_Card shows it, including the rescaled unit.
3. THE picker SHALL change no stored value, no sealed value and no value passed to sealing; only the displayed text changes (`data-integrity.md`).
4. THE picker's source control SHALL show the As_Published_Value, as the Receipt_Card does (spec 11 P5.2).
5. A test SHALL assert that, for every Catalogue series in the fixtures, the picker's displayed value equals the Receipt_Card's displayed value for the same figure.

### K2. Short dates

**User story:** As an author, I want dates I can read at a glance.

#### Acceptance Criteria

1. THE picker SHALL show each figure's date as a Short_Date ("26 Oct 2026"), in English, for every region.
2. THE Short_Date SHALL be formed from the figure's UTC period or retrieved date, not from the browser's timezone, so the same figure shows the same date at every offset.
3. WHERE a figure's period is a month or a year, THE picker SHALL show the period in its own form ("Oct 2026", "2026") and SHALL NOT invent a day.
4. EVERY displayed figure SHALL still show its own period next to it (`data-integrity.md`); the Short_Date SHALL be the period or the retrieved date, labelled so the reader can tell which.
5. THE Short_Date function SHALL live in a shared module with the Receipt_Card's date formatting, so the two cannot drift.
6. A property test SHALL show that, FOR ALL UTC instants, the Short_Date is the same under every timezone setting.

### K3. One note for the whole list

**User story:** As an author, I want the "hasn't fetched a newer figure" note once, so that the list is easy to scan.

#### Acceptance Criteria

1. WHEN one or more figures in the picker are Fallback_Figures, THE picker SHALL show the Picker_Note once, above the list, in the words of `REVEAL_COPY.fallbackNote` adapted to the plural ("Revenant hasn't fetched newer figures yet. Each figure below shows the date it was retrieved.", final wording in the design).
2. THE picker rows SHALL NOT repeat the note. Each Fallback_Figure row SHALL show its own retrieved date as a Short_Date and nothing else about the fallback.
3. WHEN no figure in the picker is a Fallback_Figure, THE picker SHALL show no Picker_Note.
4. THE Reveal SHALL keep one `fallbackNote` per Now_Figure (spec 11 X3.5); this requirement changes the picker only.
5. THE wording SHALL pass the `neutrality.md` copy test and SHALL not judge the figure.
6. A test SHALL assert the note appears exactly once for 1, 4 and 8 Fallback_Figures, and zero times for none.

### K4. Figures grouped by region

**User story:** As an author, I want the figures grouped by United States and European Union, so that I can find the one I need.

#### Acceptance Criteria

1. THE picker SHALL group its figures into Picker_Groups, one per region present in the Catalogue response among United States and European Union, each with a visible heading naming the region as the source defines it, which are "United States" and "European Union" only.
2. EACH Picker_Group SHALL be a `fieldset` with a `legend`, or an equivalent with an accessible group name.
3. THE picker SHALL show no Sweden group and no Sweden figure (spec 03 R23.1, `sweden-guard.test.ts`), and the order of groups SHALL be fixed (United States, then European Union) and SHALL NOT depend on any figure's value, change or direction (`neutrality.md`).
4. WITHIN a group, THE figures SHALL keep the Catalogue order.
5. WHEN a region has no figure in the response, THE picker SHALL show no heading for it.
6. THE picker SHALL keep the limit of spec 06 R13 (the stated maximum) across all groups, and the hint line SHALL count across groups.
7. AT 390×844, THE groups SHALL stack in one column with every checkbox at least 44×44 CSS px; AT 1440×900 THE picker MAY use two columns, one per region.
8. A property test SHALL show that, FOR ALL Catalogue responses, every figure appears in exactly one group, no group is for Sweden, and the group order is fixed.

### Group H. Landing (P1)

### H1. The sections use the full width

**User story:** As a visitor on a desktop, I want the sections below the hero to use the page, so that the landing page looks finished.

#### Acceptance Criteria

1. AT 1024 px and wider, THE `RitualSection`, `ResurrectionSection`, `NoSealSection` and `CovenStrip` SHALL each span the page's content width (a container of at most 1200 CSS px, centred), and SHALL NOT sit in a column narrower than half of the viewport.
2. AT 1440×900, THE left edge of each section's content box SHALL equal the hero content's left edge to within 2 CSS px, and its right edge SHALL be within 2 CSS px of the container's right edge, so the sections align with the hero.
3. THE sections SHALL stay server components with no new client JavaScript, and `/` SHALL stay at or under its 160 kB budget.
4. AT widths below 600 px, THE sections SHALL stay in one column with no sideways scroll and every link at least 44×44 CSS px (spec 11 H1.6).
5. THE sections SHALL keep their order and their text. This requirement changes layout only.
6. A layout check SHALL fail when any landing section's content box is narrower than 60% of the viewport at 1440×900, and the task SHALL make that change to `tools/qa/layout-check.mjs` itself.

### H2. The four ritual cards in one row

**User story:** As a visitor, I want to see the four steps side by side, so that the ritual reads as one sequence.

#### Acceptance Criteria

1. AT 1024 px and wider, THE `RitualSection` SHALL show its four cards (Write, Press the seal, Testify, See the receipts) in one row of four equal columns, with equal gaps and equal heights.
2. BETWEEN 600 and 1023 px, THE cards SHALL show two per row.
3. BELOW 600 px, THE cards SHALL stack in one column.
4. EACH card SHALL keep its step number, its name and its line from Brand_Copy, with no text clipped, at 1024×768, 1440×900 and 390×844.
5. THE reading order SHALL be the step order, and THE cards SHALL be an ordered list in the markup.
6. THE cards SHALL use no colour to mark a direction, and the Accent SHALL NOT mark a figure.
7. A test SHALL assert the four cards are list items of one ordered list in step order, and the layout check SHALL assert one row at 1440×900.

### Group D. Paperwork (P1)

### D1. README

**User story:** As a judge reading the README, I want a video link, true status and a true count.

#### Acceptance Criteria

1. THE README SHALL keep one Video_Slot: the existing `<!-- VIDEO: embed link here -->` marker (line 13 at `dcea0e3`, beside the `<!-- GIF: docs/reveal.gif -->` marker, which the task leaves as it is), which is replaced with the video link once the video exists. THE task SHALL add no visible placeholder text, and its PR description SHALL give the slot's line number.
2. THE README status line (line 67 at `dcea0e3`) SHALL say "13 specs (two share the number 02)" only WHEN every `tasks.md` under `.kiro/specs/`, spec 12's included, has no open box at generation time, and SHALL give the spec directories by name. IF any `tasks.md` has an open box, THEN THE README SHALL name each open spec and SHALL NOT say it is complete. THE spec folders SHALL NOT be renamed.
3. THE README merged pull request count (line 117 at `dcea0e3`, "206 merged pull requests" with the command and the date but no SHA) SHALL be recomputed with `gh pr list --state merged --limit 1000 --json number -q length` at the final SHA, and the README SHALL state the command, the date and the SHA beside the number. IF `gh` is not authenticated where the agent runs, THEN THE task SHALL write the exact `gh` command in its PR description, SHALL NOT block on it, and SHALL leave the count line carrying the git-log lower bound (`git log --format=%s | grep -cE '\(#[0-9]+\)$'`) labelled as a lower bound.
4. THE README SHALL contain no count that the task has not recomputed in the same change, and every number SHALL name its command in the same sentence or in a comment next to it.
5. THE task SHALL build on the README as it stands on `main` (spec 11 task H3 merged in #381); it SHALL edit the lines in place and SHALL NOT re-create the file.
6. THE README SHALL contain none of the Retired_Phrases, and its description of the live demo SHALL use the six steps (Write, Press the seal, Wait, Testify, Break the seal, See the receipts) and say it is a rehearsal.
7. THE README task SHALL be the last task before the final Q walk, so every count it states is recomputed at the final SHA, and it SHALL depend on every other spec 12 task.

### D2. Video script

**User story:** As a judge who may only watch the video, I want a script that matches the product now and fits under three minutes.

#### Acceptance Criteria

1. THE rewritten `docs/video-script.md` SHALL build its beats around the six steps: Write, Press the seal, Wait, Testify, Break the seal, See the receipts, using the step names from Brand_Copy and `LIVE_COPY.waitStep`, and SHALL treat the wait as cut (D2.8).
2. THE script SHALL NOT mention "Seal the figures" or any other Retired_Phrase.
3. THE script SHALL be a table of time, length, beat and on-screen content, with start times. THE beat lengths SHALL sum to 172 seconds, so the last beat ends at 2:52, before 2:55 and under the 3:00 limit.
4. THE script SHALL use these beat lengths, which add to 172 seconds: 25 seconds on the problem and the pli cacheté hook (0:00), 40 seconds on the live seal (0:25; write, press the seal, then the live reveal), 60 seconds on Maya's persona letter (1:05; testify, break the seal, then-vs-now; never under 45), 40 seconds on the Kiro Crew loop (2:05) with one real PR, one QA verdict and one hook that stopped an agent, and 7 seconds on the close (2:45). Where the arithmetic and a minimum disagree, the 172-second total and the minimums win, and Maya's beat absorbs the difference.
5. THE script SHALL make Maya's receipts the payoff, and SHALL use the Live_Reveal only to show that the seal is real and to say plainly that a 30-second letter has nothing to compare yet (the Single_Figure_View of Z2 when the letter holds a figure), with the then-and-now story shown in Maya's letter.
6. THE script SHALL contain no exclamation mark, no judgement of testimony and no claim the product does not make (no predictions, no interpretation of numbers).
7. THE script SHALL give a spoken line per beat, with a word count per line, and the total spoken words SHALL be at most 400 (about 150 words a minute over 172 seconds, leaving room for silence).
8. THE script SHALL name which beats use a pre-sealed persona and which use a live seal, and SHALL cut the 30-second wait from the video, with the cut marked in the script.
9. THE task's PR description SHALL list the total of the beat durations and the total spoken words.
10. A script test is not possible; THE QA agent SHALL check criteria 1 to 7 by reading the file and SHALL attach the counts.

### D3. The write-up's gaps are a report, not an edit

**User story:** As the author of the write-up, I want a list of what is missing in `docs/kiro-writeup.md` with the evidence git can give, so that the opinions are written by a person who holds them.

#### Acceptance Criteria

1. THE task SHALL produce the Gaps_Report in the task's PR description and commit it as `docs/writeup-gaps.md`, and SHALL leave `docs/kiro-writeup.md` byte-identical (checked with `git diff --exit-code -- docs/kiro-writeup.md`).
2. THE Gaps_Report SHALL list every OWNER comment in `docs/kiro-writeup.md`, found with `grep -n "OWNER" docs/kiro-writeup.md`, each with its line number, its text and the section it sits in. On `main` at `dcea0e3` there are seven (lines 5, 17, 47, 77, 96, 105 and 115); the report SHALL use the count it finds at the final SHA.
3. FOR EACH gap, THE Gaps_Report SHALL list the evidence that can be found in git or on GitHub, as commands with their output and links, and SHALL say plainly where there is none. At least:
   1. The recount note: the final SHA, the spec and task counts (read from each `tasks.md`), the agent-tag commit counts (`git log --format=%s | grep -oE '^\[[a-z-]+\]' | sort | uniq -c`), the merged PR count (D1.3), the property test file count (`git ls-files '*.property.test.*' | wc -l`), and the hook and agent counts.
   2. The Kiro surfaces note: `docs/agent-loop.md`, the count of PRs from agent branches, and the files in `.kiro/hooks/`.
   3. The hook block note: candidate PRs or runs where a hook or scope check stopped an agent (`gh pr list --state all --search 'scope-check OR tone-check in:body'`), each with its link.
   4. The spec loop versus vibe coding note: commits that did not come from a spec task (`git log --no-merges --format='%h %s'` filtered for commits without an agent tag and without a "Tick completed" subject), listed with their hashes.
   5. The property test note: commits whose messages mention a property (`git log -i --grep=property --format='%h %s'`), listed with their hashes, and no judgement of which caught a bug.
   6. The Kiro powers note: whether any power is installed (`ls ~/.kiro/powers`) and any `.kiro` file that names one, with "none found" if so.
   7. The what-went-wrong note: the first Journey_Check run and the Journey_Issue it opened, found with `gh run list --workflow journey-check.yml` and `gh issue list --label journey:failure --state all`, each with its link.
4. THE Gaps_Report SHALL write no opinion: no sentence that says what the spec loop gave, which bug a property caught, why powers were or were not used, or how the three Kiro surfaces differed. Where the evidence suggests a candidate, THE report SHALL list it as a candidate with its link and leave the choice to the write-up's author.
5. THE Gaps_Report SHALL list stale facts in the write-up that git can contradict (for example a status line, a SHA or a count older than `main`), with the command that shows the current value, and SHALL change none of them.
6. THE Gaps_Report SHALL state the commands run, the date and the SHA at which they were run.
7. IF a command fails (for example `gh` is not authenticated), THEN THE Gaps_Report SHALL say which command failed and the exact command to run, and SHALL NOT substitute a guessed value or block the task.

### Group Q. QA walks the whole flow

### Q1. The Live_Walk

**User story:** As the owner, I want QA to walk the whole live flow, so that a broken last step is caught before a judge sees it.

#### Acceptance Criteria

1. THE QA agent SHALL run the Live_Walk on a production build (`npm run build`, `next start`) against a local PostgreSQL with migrations applied, `RP_ID=localhost`, `APP_ORIGIN=http://localhost:3000`, and a headless Chromium with a virtual authenticator that reports PRF support (as spec 11 W1).
2. THE Live_Walk SHALL run at 1440×900 and at 390×844, and SHALL cover in order: the Write step (choose an Occasion, write a letter, edit a question, remove a question with the Remove_Icon, open the Receipts_Disclosure, leave an own-number row blank); Press the seal (create and confirm the passkey); the Wait step (the 30-second countdown); unlock; Testify (answer each question); Break the seal (press and hold, then once with the Seal_Button, then once with the Skip_Link); the letter; the receipts; the Close.
3. THE Live_Walk SHALL run two variants at each width: a letter with no figure, and a letter with one figure, so that both the Nothing_To_Compare_Line (Z2) and the 0-figure Close are seen.
4. THE Live_Walk SHALL run once with `prefers-reduced-motion: reduce`, once at each width.
5. THE Live_Walk SHALL record, per step, pass or fail, what was observed, the Step_Shot names, and for every defect the step, the expected result, the observed result and the suspected file.
6. THE QA verdict SHALL fail when any of these is true at any step: horizontal scroll on the document; text clipped by its container; a Motion_Control count other than 1; a Step_Indicator whose current item disagrees with the step; text and its surface below the G1.8 ratio; the string "0.000", "0.0%" or "unchanged" in the final reveal; a console error.
7. THE QA agent SHALL run the Live_Walk on every PR of groups X, Z, W and K for the steps those groups change, and SHALL run the full Live_Walk on the final merged `main` (the highest-numbered task).
8. THE Journey_Check SHALL add a J-check that walks `/demo/live` against production through the Write step and the Press the seal screen without pressing the seal, at 1440×900 and 390×844, and fails on horizontal scroll, a Motion_Control count other than 1, or a console error. THE task SHALL make that change to `tools/qa/journey-check.mjs` itself. Production cannot reach the Close without storing a seal, so the full Live_Walk through the Close and the reveal SHALL stay local.

### Q2. A screenshot of every step, including the last

**User story:** As the owner, I want to see every step, so that I can check the end myself.

#### Acceptance Criteria

1. THE Live_Walk SHALL save a Step_Shot of every step and Stage at 1440×900 and at 390×844, named `live-<nn>-<step>-<width>x<height>.png`, where `<nn>` is the two-digit order in the walk and `<step>` is one of `write`, `write-receipts`, `seal`, `wait`, `unlock`, `testify`, `marks`, `letter`, `figures`, `close`.
2. THE set SHALL include the final reveal: `letter`, `figures` and `close`, each at both widths, with the full page captured for each (not only the First_Viewport).
3. THE set SHALL include the Single_Figure_View (`figures` with a Same_Figure) and the 0-figure `close`.
4. THE set SHALL include the same steps with `prefers-reduced-motion: reduce`, named with the `-reduced` suffix.
5. EACH Step_Shot SHALL be taken after the Stage has settled (no animation in flight), SHALL show the Step_Indicator, and SHALL be attached to the QA verdict.
6. THE QA verdict SHALL list every Step_Shot by name and SHALL fail when any is missing.
7. THE QA agent SHALL NOT claim a step passed without a Step_Shot for it.
