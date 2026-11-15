# Live_Walk run record (issue #399)

**Task 18 status: FAIL under Q1.6.** No Live_Walk has run on merged `main`. No step is claimed as passed. The walk-stopped-before-unlock result below is reported, not verified in committed files.

## Commit the walk must run on

- pending: merged main SHA not yet produced. The walk must run on the merged `main` commit, which does not exist yet. No SHA is written here.
- Branch tip when this record was last edited: `2ab5c25`. That is not the SHA the walk must run on. This file cannot contain its own SHA.
- The walk script code that matters is in `d245f47`, `466c72c`, `55cdd6b` and `0c3f0f1`. None of them is on `origin/main` yet.

## Cuts

No cuts. Commit `57bb707` changes the matrix and the stop rule, and removes no walk step. The owner should confirm this against the diff.

## Walk changes in this PR

- The matrix grows from six runs to eight. Each width adds the no-figure reduced-motion run (commit `57bb707`). The eight rows are in the table below.
- The walk keeps going after a stage defect. The defect is recorded, and the walk runs the next stage. It stops only when a stage's own action fails (commit `57bb707`, `src/test/integration/live-walk.test.ts`).
- The seal step clicks Next when the lost-passkey checkbox is not visible, then checks the box (commit `466c72c`, `src/test/integration/live-walk.test.ts`).
- Earlier-spec tests changed or retired: none. **This line is inaccurate for this PR.** Commit `57bb707` changes the expected matrix length and the stop rule in existing tests. The owner must record that change before merge.

## Required matrix

Each row is one Live_Walk run on merged `main`. None of the rows has been run on merged `main`.

| Width | Figure | Motion | Status |
|---|---|---|---|
| 1440x900 | no figure | motion on | NOT RUN |
| 1440x900 | no figure | reduced motion | NOT RUN |
| 1440x900 | one figure | motion on | NOT RUN |
| 1440x900 | one figure | reduced motion | NOT RUN |
| 390x844 | no figure | motion on | NOT RUN |
| 390x844 | no figure | reduced motion | NOT RUN |
| 390x844 | one figure | motion on | NOT RUN |
| 390x844 | one figure | reduced motion | NOT RUN |

The no-figure reduced-motion rows are not in `WALK_MATRIX` (`src/test/integration/live-walk-matrix.ts`). The break-method suite in `live-walk.test.ts` covers that case. It is not a walk run, so both rows stay NOT RUN.

## 36-run result: reported from the task brief, not backed by saved output

Label: this 36-run result is reported from the task brief. No saved output backs it, so it is not a verified result.

The task brief reports a 36-run attempt with this result: 6 passed, 30 failed, and the walk stopped before unlock. These counts come from the brief. The committed files do not contain the per-run output, so the table below is not verified.

| Item | Reported value | Verified in committed files |
|---|---|---|
| Runs attempted | 36 | No |
| Passed | 6 | No |
| Failed | 30 | No |
| Walk stopped before unlock | yes | No |

## Defects handed to owners

Every entry is reported, not verified on merged `main`. The brief names the J9 failure on both widths. Its observed text is not in any committed file or saved run, so the observed column does not invent one. The suspected file is either `src/components/live/` (a page defect) or `tools/qa/journey-check.mjs` (a script defect). Which one applies is not yet known.

| # | Step | Expected result | Observed result | Suspected file | Status |
|---|---|---|---|---|---|
| R1 | Wait stage on `/demo/live` after the seal, at 1440x900 and 390x844: text contrast (Q1.6 contrast check) | Text on the wait stage meets WCAG 2.2 AA contrast (`tone.md`) | Failure reported in the brief. Measured ratios and element are not saved. | `src/components/live/` (to confirm) | reported, not verified on merged main |
| R2 | Wait stage on `/demo/live` at 390x844: horizontal scroll (Q1.6 J5 check) | `scrollWidth` no greater than `clientWidth` | Failure reported in the brief. Measured widths are not saved. | `src/components/live/` (to confirm) | reported, not verified on merged main |
| R3 | Clipped text on the write-receipts step of `/demo/live` (Q1.6 clipped-text check) | No clipped text in the receipts | Failure reported in the brief. Element and measurements are not saved. | `src/components/live/` (to confirm) | reported, not verified on merged main |
| D1 | J9 on `/demo/live` at 1440x900: write one sentence and one question, then reach "Press the seal" with 0 figures | Reaches "Press the seal" with 0 figures, with no write request (spec 11 J9) | Failure reported in the brief. Observed detail not saved. | `src/components/live/` or `tools/qa/journey-check.mjs` (to confirm) | reported, not verified on merged main |
| D2 | J9 on `/demo/live` at 390x844: same steps as D1 | Same as D1 | Failure reported in the brief. Observed detail not saved. | `src/components/live/` or `tools/qa/journey-check.mjs` (to confirm) | reported, not verified on merged main |
| D3 | Unlock on `/demo/live` after the 30-second lock (frontend-dev fix task) | Unlock completes with the passkey on the live letter | Not reached. The brief says the walk stopped before unlock, so this step is unverified. | `src/components/live/` | unverified, not reached |
| D4 | Testify on `/demo/live` (frontend-dev fix task) | Recall questions are shown and answered before anything is revealed | Not reached. Unverified. | `src/components/live/` | unverified, not reached |
| D5 | Marks step on `/demo/live` (frontend-dev fix task) | Marks step completes as the journey spec describes | Not reached. Unverified. | `src/components/live/` | unverified, not reached |
| D6 | Letter step on `/demo/live` (frontend-dev fix task) | Letter is shown after the seal breaks | Not reached. Unverified. | `src/components/live/` | unverified, not reached |
| D7 | Figures step on `/demo/live` (frontend-dev fix task) | Figures are shown with their then and now values after the letter | Not reached. Unverified. | `src/components/live/` | unverified, not reached |
| D8 | Close step on `/demo/live` (frontend-dev fix task) | Walk ends at the close step with no error | Not reached. Unverified. | `src/components/live/` | unverified, not reached |

D1 and D2 list `src/components/live/` as the frontend-dev suspect. `tools/qa/journey-check.mjs` becomes the suspect only if the page is shown to be correct for those steps.

Other defects from the 36-run result (reported from the task brief, not backed by saved output) are not in the committed files, so they are not listed here. Add them when the report's per-defect details are copied in.

Owner follow-ups, all to be done by frontend-dev in `src/components/live/` (none is started in this PR): fix R1, R2 and R3 after each is confirmed on merged `main`, and fix D1 and D2 if the page proves to be at fault.

OUT OF SCOPE: the product files in `src/components/live/` (frontend-dev) and `tools/qa/journey-check.mjs`, which defines J9. This record does not change either file. Whether J9 or the page is wrong is still to confirm.

## Open owner steps

These steps are open. None is done.

1. Merge the prerequisite commits `d245f47`, `466c72c`, `55cdd6b` and `0c3f0f1` to `main` through a reviewed pull request. This is an owner decision.
2. Run `npm run live-walk` from a checkout of the new `main` at 1440x900 and 390x844, covering the full matrix above.
3. Replace the NOT RUN rows with the saved output of those runs, and rebuild the defect table from that output.
4. Run the Journey_Check against `https://revenant.devclef.se` with J9 and J2 included. The Production_Check below does not include them.
5. Review the Production_Check below. The owner decides whether it counts for Q1.7.
6. Real_Device_Check: not run.

## Production_Check

Journey_Check against production. This section covers the committed run only.

- Production URL: `https://revenant.devclef.se`
- Command (the scheduled workflow's arguments, with local output only):
  `node tools/qa/journey-check.mjs --url https://revenant.devclef.se --chromium /usr/bin/chromium --require J1,J2,J3,J4,J5,J6,J7,J8 --no-issue`
- Exit code: 0. The script printed the run time `2026-11-14T01:59:00.011Z`.
- `--no-issue` was used, so GitHub was not touched and no Journey_Issue was opened or commented on.
- No `--reveal` flag, so J2 (persona reveal) did not run. J2 runs on the 00:47 UTC schedule and on manual runs only (OD8), because each walk stores an encrypted "no answer" Recall_Record. J9 is not in the workflow's `--require` list, so it did not run either.
- Verdict: **PASS** for every check that ran (J1, J3, J4, J5, J6, J7, J8). J2 did not run in this invocation.
- Required and not run against production: **J9 and J2**. Both are required for Q1.7. The committed run omitted both, so this check is open. J9 was not in `--require`, and J2 needs `--reveal` or the 00:47 UTC run (OD8).
- Rerun command, with J9 required and J2 forced by `--reveal` (OD8):
  `node tools/qa/journey-check.mjs --url https://revenant.devclef.se --chromium /usr/bin/chromium --require J1,J2,J3,J4,J5,J6,J7,J8,J9 --reveal --no-issue`
  `--no-issue` keeps GitHub untouched. Drop it only if the owner wants a Journey_Issue opened.
- Result: not yet recorded. The rerun has not been done, and its output is not saved, so no result from it is recorded here.
- Script summary: `Checks: 128. Failed: 0. Notes: 4.` (PASS lines: 124, FAIL lines: 0, note lines: 4).

Result lines: the complete saved output of the script, unedited. It has 131 lines, including the header and the summary.

```
Revenant journey check: https://revenant.devclef.se at 2026-11-14T01:59:00.011Z. Checks: J1,J2,J3,J4,J5,J6,J7,J8. J2 this run: no (OD8)
PASS J1 /api/figures series=4 null=none threshold=every figure non-null
PASS J4 /icon.svg HTTP 200 image/svg+xml threshold=200
PASS J4 /opengraph-image HTTP 200 image/png threshold=200
PASS J5 / 2560x1440 scrollWidth=2560 clientWidth=2560 threshold=scrollWidth<=clientWidth
PASS J7 / 2560x1440 hits=none threshold=0
PASS J8 / 2560x1440 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J5 /demo 2560x1440 scrollWidth=2560 clientWidth=2560 threshold=scrollWidth<=clientWidth
PASS J7 /demo 2560x1440 hits=none threshold=0
PASS J8 /demo 2560x1440 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J5 /demo/live 2560x1440 scrollWidth=2560 clientWidth=2560 threshold=scrollWidth<=clientWidth
PASS J7 /demo/live 2560x1440 hits=none threshold=0
PASS J8 /demo/live 2560x1440 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J5 /how-it-is-sealed 2560x1440 scrollWidth=2560 clientWidth=2560 threshold=scrollWidth<=clientWidth
PASS J7 /how-it-is-sealed 2560x1440 hits=none threshold=0
PASS J8 /how-it-is-sealed 2560x1440 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J5 /demo/personas/us-maya recall 2560x1440 scrollWidth=2560 clientWidth=2560 threshold=scrollWidth<=clientWidth
PASS J7 /demo/personas/us-maya recall 2560x1440 hits=none threshold=0
PASS J8 /demo/personas/us-maya recall 2560x1440 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J5 /demo/personas/eu-tomas recall 2560x1440 scrollWidth=2560 clientWidth=2560 threshold=scrollWidth<=clientWidth
PASS J7 /demo/personas/eu-tomas recall 2560x1440 hits=none threshold=0
PASS J8 /demo/personas/eu-tomas recall 2560x1440 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J5 / 1366x800 scrollWidth=1366 clientWidth=1366 threshold=scrollWidth<=clientWidth
PASS J7 / 1366x800 hits=none threshold=0
PASS J8 / 1366x800 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J5 /demo 1366x800 scrollWidth=1366 clientWidth=1366 threshold=scrollWidth<=clientWidth
PASS J7 /demo 1366x800 hits=none threshold=0
PASS J8 /demo 1366x800 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J5 /demo/live 1366x800 scrollWidth=1366 clientWidth=1366 threshold=scrollWidth<=clientWidth
PASS J7 /demo/live 1366x800 hits=none threshold=0
PASS J8 /demo/live 1366x800 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J3 /demo/live enabled=4 threshold=>=1
PASS J5 /how-it-is-sealed 1366x800 scrollWidth=1366 clientWidth=1366 threshold=scrollWidth<=clientWidth
PASS J7 /how-it-is-sealed 1366x800 hits=none threshold=0
PASS J8 /how-it-is-sealed 1366x800 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J5 /demo/personas/us-maya recall 1366x800 scrollWidth=1366 clientWidth=1366 threshold=scrollWidth<=clientWidth
PASS J7 /demo/personas/us-maya recall 1366x800 hits=none threshold=0
PASS J8 /demo/personas/us-maya recall 1366x800 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J5 /demo/personas/eu-tomas recall 1366x800 scrollWidth=1366 clientWidth=1366 threshold=scrollWidth<=clientWidth
PASS J7 /demo/personas/eu-tomas recall 1366x800 hits=none threshold=0
PASS J8 /demo/personas/eu-tomas recall 1366x800 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J5 / 1280x800 scrollWidth=1280 clientWidth=1280 threshold=scrollWidth<=clientWidth
PASS J7 / 1280x800 hits=none threshold=0
PASS J8 / 1280x800 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J5 /demo 1280x800 scrollWidth=1280 clientWidth=1280 threshold=scrollWidth<=clientWidth
PASS J7 /demo 1280x800 hits=none threshold=0
PASS J8 /demo 1280x800 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J5 /demo/live 1280x800 scrollWidth=1280 clientWidth=1280 threshold=scrollWidth<=clientWidth
PASS J7 /demo/live 1280x800 hits=none threshold=0
PASS J8 /demo/live 1280x800 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J5 /how-it-is-sealed 1280x800 scrollWidth=1280 clientWidth=1280 threshold=scrollWidth<=clientWidth
PASS J7 /how-it-is-sealed 1280x800 hits=none threshold=0
PASS J8 /how-it-is-sealed 1280x800 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J5 /demo/personas/us-maya recall 1280x800 scrollWidth=1280 clientWidth=1280 threshold=scrollWidth<=clientWidth
PASS J7 /demo/personas/us-maya recall 1280x800 hits=none threshold=0
PASS J8 /demo/personas/us-maya recall 1280x800 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J5 /demo/personas/eu-tomas recall 1280x800 scrollWidth=1280 clientWidth=1280 threshold=scrollWidth<=clientWidth
PASS J7 /demo/personas/eu-tomas recall 1280x800 hits=none threshold=0
PASS J8 /demo/personas/eu-tomas recall 1280x800 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J5 / 390x844 scrollWidth=390 clientWidth=390 threshold=scrollWidth<=clientWidth
PASS J7 / 390x844 hits=none threshold=0
PASS J8 / 390x844 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J6 / 390x844 PH1 headline=151px..210px Hero_Sentence=226px..302px primary=633px..689px Landing_Ghost=615px..769px secondary=701px..762px viewport=390x844 at scrollY 0 threshold=inside viewport
PASS J6 / 390x844 PH2 blocks=5 worstGap=16px below y=135px threshold=<=64px
PASS J6 / 390x844 PH3 lines=2 wordsPerLine=2,2 threshold=lines<=3, no lone word before the last line
PASS J6 / 390x844 PH4 height=56.0px compact=true threshold=<=56px
PASS J6 / 390x844 PH7 targets=8 small=0 threshold=>=44x44px
PASS J5 /demo 390x844 scrollWidth=390 clientWidth=390 threshold=scrollWidth<=clientWidth
PASS J7 /demo 390x844 hits=none threshold=0
PASS J8 /demo 390x844 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J5 /demo/live 390x844 scrollWidth=390 clientWidth=390 threshold=scrollWidth<=clientWidth
PASS J7 /demo/live 390x844 hits=none threshold=0
PASS J8 /demo/live 390x844 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J6 /demo/live 390x844 PH1 Letter_Field 6 of 6 lines=419px..606px viewport=390x844 at scrollY 0 threshold=field top and 6 lines inside viewport (W1.6), Next not asserted
PASS J6 /demo/live 390x844 PH3 lines=1 wordsPerLine=4 threshold=lines<=2, no lone word before the last line
PASS J6 /demo/live 390x844 PH4 height=56.0px compact=true threshold=<=56px
PASS J6 /demo/live 390x844 PH7 targets=17 small=0 threshold=>=44x44px
PASS J5 /how-it-is-sealed 390x844 scrollWidth=390 clientWidth=390 threshold=scrollWidth<=clientWidth
PASS J7 /how-it-is-sealed 390x844 hits=none threshold=0
PASS J8 /how-it-is-sealed 390x844 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J5 /demo/personas/us-maya recall 390x844 scrollWidth=390 clientWidth=390 threshold=scrollWidth<=clientWidth
PASS J7 /demo/personas/us-maya recall 390x844 hits=none threshold=0
PASS J8 /demo/personas/us-maya recall 390x844 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J6 /demo/personas/us-maya recall 390x844 PH1 Next question=334px..378px viewport=390x844 at scrollY 246 (top of [data-stage-content]) threshold=inside viewport
note J6 /demo/personas/us-maya recall 390x844 PH3 the h1 is visually hidden at this Stage threshold=-
PASS J6 /demo/personas/us-maya recall 390x844 PH4 height=56.0px compact=true threshold=<=56px
PASS J6 /demo/personas/us-maya recall 390x844 PH7 targets=9 small=0 threshold=>=44x44px
PASS J5 /demo/personas/eu-tomas recall 390x844 scrollWidth=390 clientWidth=390 threshold=scrollWidth<=clientWidth
PASS J7 /demo/personas/eu-tomas recall 390x844 hits=none threshold=0
PASS J8 /demo/personas/eu-tomas recall 390x844 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J6 /demo/personas/eu-tomas recall 390x844 PH1 Next question=334px..378px viewport=390x844 at scrollY 246 (top of [data-stage-content]) threshold=inside viewport
note J6 /demo/personas/eu-tomas recall 390x844 PH3 the h1 is visually hidden at this Stage threshold=-
PASS J6 /demo/personas/eu-tomas recall 390x844 PH4 height=56.0px compact=true threshold=<=56px
PASS J6 /demo/personas/eu-tomas recall 390x844 PH7 targets=9 small=0 threshold=>=44x44px
PASS J5 / 360x640 scrollWidth=360 clientWidth=360 threshold=scrollWidth<=clientWidth
PASS J7 / 360x640 hits=none threshold=0
PASS J8 / 360x640 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J6 / 360x640 PH1 headline=151px..206px Hero_Sentence=222px..322px primary=509px..565px Landing_Ghost=468px..622px secondary=577px..638px viewport=360x640 at scrollY 0 threshold=inside viewport
PASS J6 / 360x640 PH2 blocks=5 worstGap=16px below y=135px threshold=<=64px
PASS J6 / 360x640 PH3 lines=2 wordsPerLine=2,2 threshold=lines<=3, no lone word before the last line
PASS J6 / 360x640 PH4 height=56.0px compact=true threshold=<=56px
PASS J6 / 360x640 PH7 targets=8 small=0 threshold=>=44x44px
PASS J5 /demo 360x640 scrollWidth=360 clientWidth=360 threshold=scrollWidth<=clientWidth
PASS J7 /demo 360x640 hits=none threshold=0
PASS J8 /demo 360x640 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J5 /demo/live 360x640 scrollWidth=360 clientWidth=360 threshold=scrollWidth<=clientWidth
PASS J7 /demo/live 360x640 hits=none threshold=0
PASS J8 /demo/live 360x640 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J6 /demo/live 360x640 PH1 Letter_Field 6 of 6 lines=419px..606px viewport=360x640 at scrollY 0 threshold=field top and 6 lines inside viewport (W1.6), Next not asserted
PASS J6 /demo/live 360x640 PH3 lines=1 wordsPerLine=4 threshold=lines<=2, no lone word before the last line
PASS J6 /demo/live 360x640 PH4 height=56.0px compact=true threshold=<=56px
PASS J6 /demo/live 360x640 PH7 targets=17 small=0 threshold=>=44x44px
PASS J5 /how-it-is-sealed 360x640 scrollWidth=360 clientWidth=360 threshold=scrollWidth<=clientWidth
PASS J7 /how-it-is-sealed 360x640 hits=none threshold=0
PASS J8 /how-it-is-sealed 360x640 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J5 /demo/personas/us-maya recall 360x640 scrollWidth=360 clientWidth=360 threshold=scrollWidth<=clientWidth
PASS J7 /demo/personas/us-maya recall 360x640 hits=none threshold=0
PASS J8 /demo/personas/us-maya recall 360x640 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J6 /demo/personas/us-maya recall 360x640 PH1 Next question=333px..377px viewport=360x640 at scrollY 244 (top of [data-stage-content]) threshold=inside viewport
note J6 /demo/personas/us-maya recall 360x640 PH3 the h1 is visually hidden at this Stage threshold=-
PASS J6 /demo/personas/us-maya recall 360x640 PH4 height=56.0px compact=true threshold=<=56px
PASS J6 /demo/personas/us-maya recall 360x640 PH7 targets=9 small=0 threshold=>=44x44px
PASS J5 /demo/personas/eu-tomas recall 360x640 scrollWidth=360 clientWidth=360 threshold=scrollWidth<=clientWidth
PASS J7 /demo/personas/eu-tomas recall 360x640 hits=none threshold=0
PASS J8 /demo/personas/eu-tomas recall 360x640 sans=inter sansLoaded=true body=inter letter=none (serif not checked) threshold=loaded and first
PASS J6 /demo/personas/eu-tomas recall 360x640 PH1 Next question=333px..377px viewport=360x640 at scrollY 244 (top of [data-stage-content]) threshold=inside viewport
note J6 /demo/personas/eu-tomas recall 360x640 PH3 the h1 is visually hidden at this Stage threshold=-
PASS J6 /demo/personas/eu-tomas recall 360x640 PH4 height=56.0px compact=true threshold=<=56px
PASS J6 /demo/personas/eu-tomas recall 360x640 PH7 targets=9 small=0 threshold=>=44x44px

Checks: 128. Failed: 0. Notes: 4.
```

About the notes: the script prints a `note` instead of a FAIL when a phone check's element is not on production yet. The four notes are all PH3 on the persona recall Stage (us-maya and eu-tomas, at 390x844 and 360x640). Each note gives the reason "the h1 is visually hidden at this Stage".
