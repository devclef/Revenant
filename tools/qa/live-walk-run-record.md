# Live_Walk run record (issue #399)

**Status: NOT RUN.** This record is an unrun template. No Live_Walk has run on merged `main`, so no step is passed. A step without a Step_Shot is not passed.

## Commit the walk must run on

- Commit SHA: (empty until a merged-main run exists)
- The walk must run on the merged `main` commit. That commit does not exist yet. This file cannot contain its own SHA.
- The walk prerequisite commits are `d245f47`, `466c72c`, `55cdd6b` and `0c3f0f1`. None of them is on `origin/main` yet. The owner merges them through a reviewed pull request (owner decision).

## Cut order

Steps the cuts removed: none recorded so far.

When a cut removes a walk step, add a line here with the step name, the commit that made the cut, and the reason. Commit `57bb707` changes the matrix and the stop rule and removes no walk step. The owner should confirm this against the diff.

## Walk changes in this PR

- The matrix grows from six runs to eight. Each width adds the no-figure reduced-motion run (commit `57bb707`). The eight rows are in the table below.
- The walk keeps going after a stage defect. The defect is recorded, and the walk runs the next stage. It stops only when a stage's own action fails (commit `57bb707`, `src/test/integration/live-walk.test.ts`).
- The seal step clicks Next when the lost-passkey checkbox is not visible, then checks the box (commit `466c72c`, `src/test/integration/live-walk.test.ts`).
- Earlier-spec tests changed: `src/test/integration/live-walk-matrix.test.ts` and `src/test/integration/live-walk.test.ts` now expect 8 runs in `WALK_MATRIX` instead of 6. The stop rule in `live-walk.test.ts` changed: a stage defect no longer stops the walk, while a stage's own action failure still stops it (commit `57bb707`).

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

The eight rows are the `WALK_MATRIX` entries in `src/test/integration/live-walk-matrix.ts`. The break-method suite in `live-walk.test.ts` is a separate check and is not a walk run.

## Step_Shot names

Each run writes one Step_Shot per walk step. The name pattern is `live-<nn>-<step>-<width>x<height>.png`. The reduced-motion set adds `-reduced` before `.png`. The names come from `stepShotName` in `src/test/integration/live-walk-helpers.ts`.

| Step | 1440x900, motion on | 1440x900, reduced | 390x844, motion on | 390x844, reduced |
|---|---|---|---|---|
| 01 write | `live-01-write-1440x900.png` | `live-01-write-1440x900-reduced.png` | `live-01-write-390x844.png` | `live-01-write-390x844-reduced.png` |
| 02 write-receipts | `live-02-write-receipts-1440x900.png` | `live-02-write-receipts-1440x900-reduced.png` | `live-02-write-receipts-390x844.png` | `live-02-write-receipts-390x844-reduced.png` |
| 03 seal | `live-03-seal-1440x900.png` | `live-03-seal-1440x900-reduced.png` | `live-03-seal-390x844.png` | `live-03-seal-390x844-reduced.png` |
| 04 wait | `live-04-wait-1440x900.png` | `live-04-wait-1440x900-reduced.png` | `live-04-wait-390x844.png` | `live-04-wait-390x844-reduced.png` |
| 05 unlock | `live-05-unlock-1440x900.png` | `live-05-unlock-1440x900-reduced.png` | `live-05-unlock-390x844.png` | `live-05-unlock-390x844-reduced.png` |
| 06 testify | `live-06-testify-1440x900.png` | `live-06-testify-1440x900-reduced.png` | `live-06-testify-390x844.png` | `live-06-testify-390x844-reduced.png` |
| 07 marks | `live-07-marks-1440x900.png` | `live-07-marks-1440x900-reduced.png` | `live-07-marks-390x844.png` | `live-07-marks-390x844-reduced.png` |
| 08 letter (full page) | `live-08-letter-1440x900.png` | `live-08-letter-1440x900-reduced.png` | `live-08-letter-390x844.png` | `live-08-letter-390x844-reduced.png` |
| 09 figures (full page) | `live-09-figures-1440x900.png` | `live-09-figures-1440x900-reduced.png` | `live-09-figures-390x844.png` | `live-09-figures-390x844-reduced.png` |
| 10 close (full page) | `live-10-close-1440x900.png` | `live-10-close-1440x900-reduced.png` | `live-10-close-390x844.png` | `live-10-close-390x844-reduced.png` |

Row by row, each matrix row expects all ten shots above at its own width and motion setting:

- No figure, motion on: the ten shots at the 1440x900 or 390x844 motion-on column. The figures shot shows the Nothing_To_Compare_Line, and the walk ends on the 0-figure close (`live-10-close`).
- No figure, reduced motion: the ten shots in the reduced column for that width.
- One figure, motion on: the ten shots at the motion-on column for that width. A figure is picked at the write-receipts step.
- One figure, reduced motion: the ten shots in the reduced column for that width.

The no-figure and one-figure rows at the same width and motion setting expect the same file names. Keep each run's shots in its own folder, or one run overwrites the other.

The Single_Figure_View has no Step_Shot name in the walk code, and it is not one of the ten steps. The owner must give it a name before the run. Until then this record cannot say whether it was captured. The figures shot (`live-09-figures`) is the only shot for the figure view.

Step_Shot results are NOT RUN in every row. Until a saved run produces a shot, the step is not passed.

## Per-step results

Result recorded for each step, across all eight matrix rows. Every result is NOT RUN, and no step is passed.

| Step | Matrix rows run | Result | Saved output |
|---|---|---|---|
| 01 write | 0 of 8 | NOT RUN | none |
| 02 write-receipts | 0 of 8 | NOT RUN | none |
| 03 seal | 0 of 8 | NOT RUN | none |
| 04 wait | 0 of 8 | NOT RUN | none |
| 05 unlock | 0 of 8 | NOT RUN | none |
| 06 testify | 0 of 8 | NOT RUN | none |
| 07 marks | 0 of 8 | NOT RUN | none |
| 08 letter | 0 of 8 | NOT RUN | none |
| 09 figures | 0 of 8 | NOT RUN | none |
| 10 close | 0 of 8 | NOT RUN | none |

## Defects handed to owners

None recorded. No Live_Walk has run on merged `main`, so no walk defect is on record.

Add a defect only from saved run output. Record the matrix row, the step, the expected result, the observed result, the Step_Shot name and the suspected file. The suspected file for each step is in `STEP_SUSPECTED_FILES` in `src/test/integration/live-walk-helpers.ts`. The owner confirms that file before any fix.

OUT OF SCOPE: this record changes no product file. The product files in `src/components/live/` belong to frontend-dev.

## Open owner steps

These steps are open. None is done.

1. Merge the prerequisite commits `d245f47`, `466c72c`, `55cdd6b` and `0c3f0f1` to `main` through a reviewed pull request. This is an owner decision.
2. Run `npm run live-walk` from a checkout of the new `main` at 1440x900 and 390x844, covering the full matrix above.
3. Replace the NOT RUN rows with the saved output of those runs, and record each defect from that output.
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
